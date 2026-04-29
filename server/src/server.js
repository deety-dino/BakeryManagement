import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const webRoot = path.join(__dirname, '..', '..');
app.use(express.static(webRoot));

function getAuthContext(req) {
    return {
        masterUid: req.header('x-master-id') || '',
        shopId: req.header('x-shop-id') || '',
        role: req.header('x-role') || ''
    };
}

function requireMaster(req, res) {
    const { masterUid } = getAuthContext(req);
    if (!masterUid) {
        res.status(401).json({ error: 'Thiếu master_id' });
        return null;
    }
    return masterUid;
}

function requireShop(req, res) {
    const { shopId } = getAuthContext(req);
    if (!shopId) {
        res.status(401).json({ error: 'Thiếu shop_id' });
        return null;
    }
    return shopId;
}

app.get('/api/health', async (_req, res) => {
    try {
        const [rows] = await pool.query('SELECT 1 AS ok');
        res.json({ ok: true, db: rows?.[0]?.ok === 1 });
    } catch (error) {
        res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
});

app.post('/api/auth/master-login', async (req, res) => {
    const masterId = String(req.body?.masterId || '').trim();
    const passwordHash = String(req.body?.passwordHash || '').trim();

    if (!masterId || !passwordHash) {
        return res.status(400).json({ error: 'Thiếu thông tin đăng nhập' });
    }

    try {
        const [rows] = await pool.query(
            `SELECT master_uid, master_id, password_hash, master_name
             FROM master
             WHERE master_id = ?`,
            [masterId]
        );

        if (!rows.length) {
            return res.status(404).json({ error: 'Cửa hàng không tồn tại' });
        }

        const master = rows[0];
        if (master.password_hash !== passwordHash) {
            return res.status(401).json({ error: 'Sai mật khẩu' });
        }

        res.json({ masterUid: master.master_uid, masterId: master.master_id, masterName: master.master_name });
    } catch (error) {
        res.status(500).json({ error: error?.message || String(error) });
    }
});

app.post('/api/auth/shop-login', async (req, res) => {
    const masterUid = String(req.body?.masterUid || '').trim();
    const shopId = String(req.body?.shopId || '').trim();
    const role = String(req.body?.role || '').trim();
    const password = String(req.body?.password || '').trim();

    if (!masterUid || !shopId || !role || !password) {
        return res.status(400).json({ error: 'Thiếu thông tin đăng nhập' });
    }

    try {
        const [rows] = await pool.query(
            `SELECT shop_id, shop_name, administrator_password, staff_password
             FROM shop
             WHERE shop_id = ? AND master_id = ?`,
            [shopId, masterUid]
        );

        if (!rows.length) {
            return res.status(404).json({ error: 'không tìm thấy chi nhánh' });
        }

        const shop = rows[0];
        const expected = role === 'admin' ? shop.administrator_password : shop.staff_password;
        if (expected !== password) {
            return res.status(401).json({ error: 'Sai mật khẩu' });
        }

        res.json({ shopId: shop.shop_id, shopName: shop.shop_name, role });
    } catch (error) {
        res.status(500).json({ error: error?.message || String(error) });
    }
});

app.post('/api/oauth/google/url', async (req, res) => {
    const authUrl = String(req.body?.authUrl || '').trim();
    const clientId = String(req.body?.clientId || '').trim();
    const redirectUri = String(req.body?.redirectUri || '').trim();
    const scope = String(req.body?.scope || '').trim();
    const state = String(req.body?.state || '').trim();

    if (!authUrl || !clientId || !redirectUri || !scope) {
        return res.status(400).json({ error: 'Thiếu cấu hình OAuth' });
    }

    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope,
        access_type: 'offline',
        prompt: 'consent'
    });
    if (state) params.set('state', state);

    res.json({ url: `${authUrl}?${params.toString()}` });
});

app.get('/api/ingredients/catalog', async (_req, res) => {
    try {
        const masterUid = requireMaster(_req, res);
        if (!masterUid) return;
        const [rows] = await pool.query(
            `SELECT id, name, category, unit
             FROM ingredients
             WHERE master_id = ?
             ORDER BY name ASC`,
            [masterUid]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error?.message || String(error) });
    }
});

app.post('/api/ingredients', async (req, res) => {
    const masterUid = requireMaster(req, res);
    if (!masterUid) return;
    const name = String(req.body?.name || '').trim();
    const category = String(req.body?.category || '').trim();
    const unit = String(req.body?.unit || '').trim();

    if (!name) {
        return res.status(400).json({ error: 'Tên nguyên liệu không được để trống' });
    }
    if (!unit) {
        return res.status(400).json({ error: 'Đơn vị không được để trống' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [existingRows] = await conn.query(
            'SELECT id FROM ingredients WHERE master_id = ? AND LOWER(name) = LOWER(?) LIMIT 1',
            [masterUid, name]
        );

        if (existingRows.length) {
            await conn.rollback();
            return res.status(409).json({ error: 'Nguyên liệu đã tồn tại' });
        }

        const [insertResult] = await conn.query(
            `INSERT INTO ingredients (name, category, unit)
             VALUES (?, ?, ?)`,
            [name, category || null, unit]
        );

        const ingredientId = insertResult.insertId;
        await conn.query(
            `UPDATE ingredients
             SET master_id = ?
             WHERE id = ?`,
            [masterUid, ingredientId]
        );
        await conn.query(
            `INSERT INTO ingredient_stock (shop_id, ingredient_id, quantity)
             SELECT s.shop_id, ?, 0
             FROM shop s
             WHERE s.master_id = ?
             ON DUPLICATE KEY UPDATE quantity = quantity`,
            [ingredientId, masterUid]
        );

        await conn.commit();
        res.json({ success: true, id: ingredientId });
    } catch (error) {
        await conn.rollback();
        res.status(500).json({ error: error?.message || String(error) });
    } finally {
        conn.release();
    }
});

app.get('/api/ingredient-stock', async (_req, res) => {
    try {
        const masterUid = requireMaster(_req, res);
        const shopId = requireShop(_req, res);
        if (!masterUid || !shopId) return;
        const [rows] = await pool.query(
            `SELECT i.id AS ingredient_id,
                    i.name,
                    i.unit,
                    COALESCE(s.quantity, 0) AS quantity,
                    COALESCE(agg.avg_unit_price_month, 0) AS avg_unit_price_month,
                    s.last_updated
             FROM ingredients i
             LEFT JOIN ingredient_stock s ON s.ingredient_id = i.id AND s.shop_id = ?
              LEFT JOIN (
                    SELECT ingredient_id, AVG(import_price) AS avg_unit_price_month
                    FROM ingredient_imports
                    WHERE shop_id = ?
                      AND YEAR(import_date) = YEAR(CURDATE())
                      AND MONTH(import_date) = MONTH(CURDATE())
                    GROUP BY ingredient_id
              ) agg ON agg.ingredient_id = i.id
             WHERE i.master_id = ?
             ORDER BY i.name ASC`,
            [shopId, shopId, masterUid]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error?.message || String(error) });
    }
});

app.post('/api/ingredient-imports', async (req, res) => {
    const masterUid = requireMaster(req, res);
    const shopId = requireShop(req, res);
    if (!masterUid || !shopId) return;
    const ingredientId = Number(req.body?.ingredientId);
    const quantity = Number(req.body?.quantity);
    const unitPrice = Number(req.body?.unitPrice);

    if (!Number.isFinite(ingredientId) || ingredientId <= 0) {
        return res.status(400).json({ error: 'ingredientId không hợp lệ' });
    }
    if (!Number.isFinite(quantity) || quantity <= 0) {
        return res.status(400).json({ error: 'quantity phải lớn hơn 0' });
    }
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
        return res.status(400).json({ error: 'unitPrice phải lớn hơn 0' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [ingredientRows] = await conn.query('SELECT id FROM ingredients WHERE master_id = ? AND id = ?', [masterUid, ingredientId]);
        if (!ingredientRows.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Nguyên liệu không tồn tại' });
        }

        await conn.query(
            `INSERT INTO ingredient_imports (shop_id, ingredient_id, quantity, import_price)
             VALUES (?, ?, ?, ?)`,
            [shopId, ingredientId, quantity, unitPrice]
        );

        await conn.query(
            `INSERT INTO ingredient_stock (shop_id, ingredient_id, quantity)
             VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
            [shopId, ingredientId, quantity]
        );

        await conn.commit();
        res.json({ success: true });
    } catch (error) {
        await conn.rollback();
        res.status(500).json({ error: error?.message || String(error) });
    } finally {
        conn.release();
    }
});

app.post('/api/ingredient-imports/batch', async (req, res) => {
    const masterUid = requireMaster(req, res);
    const shopId = requireShop(req, res);
    if (!masterUid || !shopId) return;
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    if (!items.length) {
        return res.status(400).json({ error: 'Danh sách nhập hàng trống' });
    }

    const normalized = items.map((item, index) => ({
        index,
        ingredientId: Number(item?.ingredientId),
        quantity: Number(item?.quantity),
        unitPrice: Number(item?.unitPrice)
    }));

    for (const item of normalized) {
        if (!Number.isFinite(item.ingredientId) || item.ingredientId <= 0) {
            return res.status(400).json({ error: `Dòng ${item.index + 1}: ingredientId không hợp lệ` });
        }
        if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
            return res.status(400).json({ error: `Dòng ${item.index + 1}: quantity phải lớn hơn 0` });
        }
        if (!Number.isFinite(item.unitPrice) || item.unitPrice <= 0) {
            return res.status(400).json({ error: `Dòng ${item.index + 1}: unitPrice phải lớn hơn 0` });
        }
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        for (const item of normalized) {
            const [ingredientRows] = await conn.query('SELECT id FROM ingredients WHERE master_id = ? AND id = ?', [masterUid, item.ingredientId]);
            if (!ingredientRows.length) {
                await conn.rollback();
                return res.status(404).json({ error: `Dòng ${item.index + 1}: Nguyên liệu không tồn tại` });
            }

            await conn.query(
                `INSERT INTO ingredient_imports (shop_id, ingredient_id, quantity, import_price)
                 VALUES (?, ?, ?, ?)`,
                [shopId, item.ingredientId, item.quantity, item.unitPrice]
            );

            await conn.query(
                `INSERT INTO ingredient_stock (shop_id, ingredient_id, quantity)
                 VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE quantity = quantity + VALUES(quantity)`,
                [shopId, item.ingredientId, item.quantity]
            );
        }

        await conn.commit();
        res.json({ success: true, count: normalized.length });
    } catch (error) {
        await conn.rollback();
        res.status(500).json({ error: error?.message || String(error) });
    } finally {
        conn.release();
    }
});

app.get('/api/ingredient-imports', async (req, res) => {
    const masterUid = requireMaster(req, res);
    const shopId = requireShop(req, res);
    if (!masterUid || !shopId) return;
    const fromDate = String(req.query?.from_date || '').trim();
    const toDate = String(req.query?.to_date || '').trim();

    const conditions = [];
    const params = [];
    if (fromDate) {
        conditions.push('ii.import_date >= ?');
        params.push(fromDate);
    }
    if (toDate) {
        conditions.push('ii.import_date <= ?');
        params.push(toDate);
    }

    try {
        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const [rows] = await pool.query(
            `SELECT ii.id,
                    ii.import_date,
                    ii.quantity,
                    ii.import_price AS unit_price,
                    i.id AS ingredient_id,
                    i.name AS ingredient_name,
                    i.unit
             FROM ingredient_imports ii
             INNER JOIN ingredients i ON i.id = ii.ingredient_id
             WHERE ii.shop_id = ? AND i.master_id = ?
             ${whereClause ? `AND ${whereClause.replace('WHERE ', '')}` : ''}
             ORDER BY ii.import_date DESC, ii.id DESC`
            ,
            [shopId, masterUid, ...params]
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error?.message || String(error) });
    }
});

app.get('/api/recipes', async (_req, res) => {
    try {
        const [rows] = await pool.query(
            `SELECT p.id,
                    p.name,
                    p.description,
                    COALESCE(SUM(r.quantity_needed * COALESCE(ip.avg_unit_price, 0)), 0) AS cost
             FROM products p
             LEFT JOIN recipes r ON r.product_id = p.id
             LEFT JOIN (
                SELECT ingredient_id, AVG(unit_price) AS avg_unit_price
                FROM ingredient_imports
                GROUP BY ingredient_id
             ) ip ON ip.ingredient_id = r.ingredient_id
             GROUP BY p.id, p.name, p.description
             ORDER BY p.name ASC`
        );
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error?.message || String(error) });
    }
});

app.get('/api/recipes/:productId', async (req, res) => {
    const productId = Number(req.params.productId);
    if (!Number.isFinite(productId) || productId <= 0) {
        return res.status(400).json({ error: 'productId không hợp lệ' });
    }

    try {
        const [productRows] = await pool.query(
            `SELECT id, name, description
             FROM products
             WHERE id = ?`,
            [productId]
        );

        if (!productRows.length) {
            return res.status(404).json({ error: 'Không tìm thấy công thức' });
        }

        const [ingredientRows] = await pool.query(
            `SELECT r.ingredient_id,
                    i.name AS ingredient_name,
                    i.category,
                    i.unit,
                    r.quantity_needed,
                    COALESCE(ip.avg_unit_price, 0) AS unit_price,
                    (r.quantity_needed * COALESCE(ip.avg_unit_price, 0)) AS line_cost
             FROM recipes r
             INNER JOIN ingredients i ON i.id = r.ingredient_id
             LEFT JOIN (
                SELECT ingredient_id, AVG(unit_price) AS avg_unit_price
                FROM ingredient_imports
                GROUP BY ingredient_id
             ) ip ON ip.ingredient_id = r.ingredient_id
             WHERE r.product_id = ?
             ORDER BY i.name ASC`,
            [productId]
        );

        const cost = ingredientRows.reduce((sum, item) => sum + Number(item.line_cost || 0), 0);
        res.json({
            product: productRows[0],
            ingredients: ingredientRows,
            cost
        });
    } catch (error) {
        res.status(500).json({ error: error?.message || String(error) });
    }
});

app.post('/api/recipes', async (req, res) => {
    const name = String(req.body?.name || '').trim();
    const description = String(req.body?.description || '').trim();
    const ingredients = Array.isArray(req.body?.ingredients) ? req.body.ingredients : [];

    if (!name) {
        return res.status(400).json({ error: 'Tên sản phẩm không được để trống' });
    }
    if (!ingredients.length) {
        return res.status(400).json({ error: 'Công thức phải có ít nhất 1 nguyên liệu' });
    }

    const normalized = ingredients.map((item, index) => ({
        index,
        ingredientId: Number(item?.ingredientId),
        quantity: Number(item?.quantity)
    }));

    for (const item of normalized) {
        if (!Number.isFinite(item.ingredientId) || item.ingredientId <= 0) {
            return res.status(400).json({ error: `Dòng ${item.index + 1}: ingredientId không hợp lệ` });
        }
        if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
            return res.status(400).json({ error: `Dòng ${item.index + 1}: quantity phải lớn hơn 0` });
        }
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [insertProduct] = await conn.query(
            `INSERT INTO products (name, description, selling_price)
             VALUES (?, ?, 0)`,
            [name, description || null]
        );
        const productId = insertProduct.insertId;

        for (const item of normalized) {
            const [ingredientRows] = await conn.query('SELECT id FROM ingredients WHERE id = ?', [item.ingredientId]);
            if (!ingredientRows.length) {
                await conn.rollback();
                return res.status(404).json({ error: `Dòng ${item.index + 1}: Nguyên liệu không tồn tại` });
            }

            await conn.query(
                `INSERT INTO recipes (product_id, ingredient_id, quantity_needed)
                 VALUES (?, ?, ?)`,
                [productId, item.ingredientId, item.quantity]
            );
        }

        await conn.commit();
        res.json({ success: true, productId });
    } catch (error) {
        await conn.rollback();
        res.status(500).json({ error: error?.message || String(error) });
    } finally {
        conn.release();
    }
});

app.delete('/api/recipes/:productId', async (req, res) => {
    const productId = Number(req.params.productId);
    if (!Number.isFinite(productId) || productId <= 0) {
        return res.status(400).json({ error: 'productId không hợp lệ' });
    }

    try {
        const [result] = await pool.query('DELETE FROM products WHERE id = ?', [productId]);
        if (!result.affectedRows) {
            return res.status(404).json({ error: 'Không tìm thấy công thức' });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error?.message || String(error) });
    }
});

app.get('/', (_req, res) => {
    res.sendFile(path.join(webRoot, 'index.html'));
});

const port = Number(process.env.PORT || 3001);
app.listen(port, () => {
    console.log(`Server listening on http://localhost:${port}`);
});
