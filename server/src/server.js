import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { pool } from './db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.options('*', cors());
app.use(express.json());

const webRoot = path.join(__dirname, '..', '..');
app.use(express.static(webRoot));

function sha256Hex(value) {
    return createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

function getAuthContext(req) {
    return {
        masterUid: req.header('x-master-uid') || req.header('x-master-id') || '',
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

async function getDefaultShop(masterUid) {
    const [rows] = await pool.query(
        `SELECT shop_id, shop_name
         FROM shop
         WHERE master_id = ?
         ORDER BY created_at ASC, shop_name ASC
         LIMIT 1`,
        [masterUid]
    );
    return rows[0] || null;
}

async function getNextId(connection, tableName, whereClause = '', params = []) {
    const [rows] = await connection.query(
        `SELECT COALESCE(MAX(id), 0) + 1 AS next_id
         FROM ${tableName}
         ${whereClause ? `WHERE ${whereClause}` : ''}`,
        params
    );
    return Number(rows[0]?.next_id || 1);
}

async function buildIngredientCatalog(masterUid) {
    const [rows] = await pool.query(
        `SELECT id, name, category, unit
         FROM ingredients
         WHERE master_id = ?
         ORDER BY name ASC`,
        [masterUid]
    );
    return rows;
}

async function buildIngredientStock(masterUid, shopId) {
    const [rows] = await pool.query(
        `SELECT i.id AS ingredient_id,
                i.name,
                i.category,
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
    return rows;
}

async function buildIngredientImports(masterUid, shopId, fromDate = '', toDate = '') {
    const filters = ['ii.shop_id = ?', 'i.master_id = ?'];
    const params = [shopId, masterUid];

    if (fromDate) {
        filters.push('ii.import_date >= ?');
        params.push(fromDate);
    }
    if (toDate) {
        filters.push('ii.import_date <= ?');
        params.push(toDate);
    }

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
         WHERE ${filters.join(' AND ')}
         ORDER BY ii.import_date DESC, ii.id DESC`,
        params
    );
    return rows;
}

async function buildRecipeList(masterUid) {
    const [rows] = await pool.query(
        `SELECT p.id AS product_id,
                p.name AS product_name,
                p.description,
                p.base_price,
                r.ingredient_id,
                i.name AS ingredient_name,
                i.category,
                i.unit,
                r.quantity_needed,
                COALESCE(ip.avg_unit_price, 0) AS unit_price,
                (r.quantity_needed * COALESCE(ip.avg_unit_price, 0)) AS line_cost
         FROM products p
         LEFT JOIN recipes r ON r.product_id = p.id AND r.master_id = p.master_id
         LEFT JOIN ingredients i ON i.id = r.ingredient_id AND i.master_id = p.master_id
         LEFT JOIN (
            SELECT ingredient_id, AVG(import_price) AS avg_unit_price
            FROM ingredient_imports
            GROUP BY ingredient_id
         ) ip ON ip.ingredient_id = r.ingredient_id
         WHERE p.master_id = ?
         ORDER BY p.name ASC, i.name ASC`,
        [masterUid]
    );

    const recipeMap = new Map();
    for (const row of rows) {
        if (!recipeMap.has(row.product_id)) {
            recipeMap.set(row.product_id, {
                id: row.product_id,
                name: row.product_name,
                description: row.description || '',
                basePrice: Number(row.base_price || 0),
                cost: 0,
                ingredients: {},
                ingredientRows: []
            });
        }

        if (row.ingredient_id) {
            const recipe = recipeMap.get(row.product_id);
            const quantityNeeded = Number(row.quantity_needed || 0);
            const unitPrice = Number(row.unit_price || 0);
            const lineCost = Number(row.line_cost || 0);

            recipe.ingredients[row.ingredient_name] = quantityNeeded;
            recipe.ingredientRows.push({
                ingredient_id: row.ingredient_id,
                ingredient_name: row.ingredient_name,
                category: row.category,
                unit: row.unit,
                quantity_needed: quantityNeeded,
                unit_price: unitPrice,
                line_cost: lineCost
            });
            recipe.cost += lineCost;
        }
    }

    return [...recipeMap.values()];
}

async function buildSalesHistory(masterUid, shopId) {
    const [rows] = await pool.query(
        `SELECT ds.id,
                ds.sale_date,
                ds.quantity_sold,
                ds.actual_sale_price AS sell_price,
                p.id AS product_id,
                p.name AS product_name,
                COALESCE(cost.cost_per_unit, 0) AS cost_per_unit,
                (ds.quantity_sold * ds.actual_sale_price) AS total_revenue,
                (ds.quantity_sold * COALESCE(cost.cost_per_unit, 0)) AS total_cost
         FROM daily_sales ds
         INNER JOIN products p ON p.id = ds.product_id AND p.master_id = ?
         LEFT JOIN (
            SELECT r.product_id,
                   SUM(r.quantity_needed * COALESCE(ip.avg_unit_price, 0)) AS cost_per_unit
            FROM recipes r
            LEFT JOIN (
                SELECT ingredient_id, AVG(import_price) AS avg_unit_price
                FROM ingredient_imports
                GROUP BY ingredient_id
            ) ip ON ip.ingredient_id = r.ingredient_id
            WHERE r.master_id = ?
            GROUP BY r.product_id
         ) cost ON cost.product_id = ds.product_id
         WHERE ds.shop_id = ?
         ORDER BY ds.sale_date DESC, ds.id DESC`,
        [masterUid, masterUid, shopId]
    );

    return rows.map((row) => ({
        id: row.id,
        productId: row.product_id,
        productName: row.product_name,
        quantity: Number(row.quantity_sold || 0),
        sellPrice: Number(row.sell_price || 0),
        costPerUnit: Number(row.cost_per_unit || 0),
        totalRevenue: Number(row.total_revenue || 0),
        totalCost: Number(row.total_cost || 0),
        date: row.sale_date
    }));
}

async function buildBootstrap(masterUid, shopId) {
    const [masterRows] = await pool.query(
        `SELECT master_uid, master_id, master_name
         FROM master
         WHERE master_uid = ?
         LIMIT 1`,
        [masterUid]
    );
    const master = masterRows[0] || null;
    const shop = shopId
        ? (await pool.query(
            `SELECT shop_id, shop_name
             FROM shop
             WHERE shop_id = ? AND master_id = ?
             LIMIT 1`,
            [shopId, masterUid]
        ))[0][0] || null
        : await getDefaultShop(masterUid);

    if (!master) {
        return null;
    }

    const activeShop = shop || (await getDefaultShop(masterUid));
    const resolvedShopId = activeShop?.shop_id || shopId || '';

    return {
        session: {
            masterUid: master.master_uid,
            masterId: master.master_id,
            masterName: master.master_name,
            shopId: resolvedShopId,
            shopName: activeShop?.shop_name || '',
            role: 'master'
        },
        ingredients: await buildIngredientCatalog(masterUid),
        stock: resolvedShopId ? await buildIngredientStock(masterUid, resolvedShopId) : [],
        imports: resolvedShopId ? await buildIngredientImports(masterUid, resolvedShopId) : [],
        recipes: await buildRecipeList(masterUid),
        sales: resolvedShopId ? await buildSalesHistory(masterUid, resolvedShopId) : []
    };
}

async function ensureShopIdColumnCompatibility() {
    const targetTables = [
        'shop',
        'ingredient_imports',
        'daily_productions',
        'daily_sales',
        'fixed_costs',
        'ingredient_stock',
        'product_stock'
    ];

    for (const tableName of targetTables) {
        const [rows] = await pool.query(
            `SELECT CHARACTER_MAXIMUM_LENGTH AS max_length
             FROM information_schema.COLUMNS
             WHERE TABLE_SCHEMA = DATABASE()
               AND TABLE_NAME = ?
               AND COLUMN_NAME = 'shop_id'
             LIMIT 1`,
            [tableName]
        );

        if (!rows.length) {
            continue;
        }

        const currentLength = Number(rows[0]?.max_length || 0);
        if (currentLength >= 36) {
            continue;
        }

        await pool.query(
            `ALTER TABLE ${tableName}
             MODIFY COLUMN shop_id VARCHAR(36) NOT NULL`
        );
    }
}

app.get('/api/health', async (_req, res) => {
    try {
        const [rows] = await pool.query('SELECT 1 AS ok');
        res.json({ ok: true, db: rows?.[0]?.ok === 1 });
    } catch (error) {
        res.status(500).json({ ok: false, error: error?.message || String(error) });
    }
});

app.all('/api/auth/master-login', async (req, res) => {
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    const source = req.method === 'GET' ? req.query : req.body;
    const masterId = String(source?.masterId || '').trim();
    const password = String(source?.password || source?.passwordHash || '').trim();

    if (!masterId || !password) {
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
        const passwordHash = sha256Hex(password);
        if (master.password_hash !== passwordHash && master.password_hash !== password) {
            return res.status(401).json({ error: 'Sai mật khẩu' });
        }

        const defaultShop = await getDefaultShop(master.master_uid);
        res.json({
            masterUid: master.master_uid,
            masterId: master.master_id,
            masterName: master.master_name,
            shopId: defaultShop?.shop_id || '',
            shopName: defaultShop?.shop_name || '',
            role: 'master'
        });
    } catch (error) {
        res.status(500).json({ error: error?.message || String(error) });
    }
});

app.all('/api/auth/shop-login', async (req, res) => {
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    const source = req.method === 'GET' ? req.query : req.body;
    const masterId = String(source?.masterId || '').trim();
    const masterUid = String(source?.masterUid || '').trim();
    const shopId = String(source?.shopId || '').trim();
    const role = String(source?.role || '').trim();
    const password = String(source?.password || source?.passwordHash || '').trim();

    if (!password || !role || (!masterUid && !masterId)) {
        return res.status(400).json({ error: 'Thiếu thông tin đăng nhập' });
    }

    try {
        let resolvedMasterUid = masterUid;
        let resolvedMasterId = masterId;
        let resolvedMasterName = '';

        if (!resolvedMasterUid) {
            const [masterRows] = await pool.query(
                `SELECT master_uid, master_id, master_name
                 FROM master
                 WHERE master_id = ?
                 LIMIT 1`,
                [resolvedMasterId]
            );

            if (!masterRows.length) {
                return res.status(404).json({ error: 'Không tìm thấy cửa hàng' });
            }

            resolvedMasterUid = masterRows[0].master_uid;
            resolvedMasterId = masterRows[0].master_id;
            resolvedMasterName = masterRows[0].master_name;
        } else {
            const [masterRows] = await pool.query(
                `SELECT master_uid, master_id, master_name
                 FROM master
                 WHERE master_uid = ?
                 LIMIT 1`,
                [resolvedMasterUid]
            );

            if (!masterRows.length) {
                return res.status(404).json({ error: 'Không tìm thấy cửa hàng' });
            }

            resolvedMasterId = masterRows[0].master_id;
            resolvedMasterName = masterRows[0].master_name;
        }

        let resolvedShopId = shopId;
        if (!resolvedShopId) {
            const defaultShop = await getDefaultShop(resolvedMasterUid);
            resolvedShopId = defaultShop?.shop_id || '';
        }

        if (!resolvedShopId) {
            return res.status(404).json({ error: 'không tìm thấy chi nhánh' });
        }

        const [rows] = await pool.query(
            `SELECT shop_id, shop_name, administrator_password, staff_password
             FROM shop
             WHERE shop_id = ? AND master_id = ?`,
            [resolvedShopId, resolvedMasterUid]
        );

        if (!rows.length) {
            return res.status(404).json({ error: 'không tìm thấy chi nhánh' });
        }

        const shop = rows[0];
        const passwordHash = sha256Hex(password);
        const expected = role === 'admin' ? shop.administrator_password : shop.staff_password;
        if (expected !== passwordHash && expected !== password) {
            return res.status(401).json({ error: 'Sai mật khẩu' });
        }

        res.json({
            masterUid: resolvedMasterUid,
            masterId: resolvedMasterId,
            masterName: resolvedMasterName,
            shopId: shop.shop_id,
            shopName: shop.shop_name,
            role
        });
    } catch (error) {
        res.status(500).json({ error: error?.message || String(error) });
    }
});

app.all('/api/auth/register', async (req, res) => {
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    const source = req.method === 'GET' ? req.query : req.body;
    const masterId = String(source?.masterId || '').trim();
    const password = String(source?.password || source?.passwordHash || '').trim();
    const recheckPassword = String(source?.recheckPassword || source?.confirmPassword || '').trim();
    const masterName = String(source?.masterName || masterId).trim() || masterId;
    const shopName = String(source?.shopName || 'Chi nhánh mặc định').trim() || 'Chi nhánh mặc định';

    if (!masterId || !password || !recheckPassword) {
        return res.status(400).json({ error: 'Thiếu thông tin đăng ký' });
    }

    if (password !== recheckPassword) {
        return res.status(400).json({ error: 'Mật khẩu nhập lại không khớp' });
    }

    const passwordHash = sha256Hex(password);

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [exists] = await conn.query('SELECT master_uid FROM master WHERE master_id = ? LIMIT 1', [masterId]);
        if (exists.length) {
            await conn.rollback();
            return res.status(409).json({ error: 'master_id đã tồn tại' });
        }

        await conn.query(
            `INSERT INTO master (master_id, password_hash, master_name)
             VALUES (?, ?, ?)`,
            [masterId, passwordHash, masterName]
        );

        const [mrows] = await conn.query('SELECT master_uid FROM master WHERE master_id = ? LIMIT 1', [masterId]);
        const masterUid = mrows[0]?.master_uid;
        if (!masterUid) {
            await conn.rollback();
            return res.status(500).json({ error: 'Không thể tạo master' });
        }

        await conn.query(
            `INSERT INTO shop (master_id, shop_name, administrator_password, staff_password)
             VALUES (?, ?, ?, ?)`,
            [masterUid, shopName, passwordHash, passwordHash]
        );

        const [srows] = await conn.query('SELECT shop_id FROM shop WHERE master_id = ? AND shop_name = ? LIMIT 1', [masterUid, shopName]);
        const shopId = srows[0]?.shop_id || '';

        // No ingredients/products exist for a fresh master, so nothing to seed.

        await conn.commit();

        res.json({ masterUid, masterId, masterName, shopId, shopName });
    } catch (error) {
        await conn.rollback();
        res.status(500).json({ error: error?.message || String(error) });
    } finally {
        conn.release();
    }
});

app.all('/api/oauth/google/url', async (req, res) => {
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    const source = req.method === 'GET' ? req.query : req.body;
    const authUrl = String(source?.authUrl || source?.authUri || '').trim();
    const clientId = String(source?.clientId || '').trim();
    const redirectUri = String(source?.redirectUri || '').trim();
    const scope = String(source?.scope || '').trim();
    const state = String(source?.state || '').trim();

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

app.all('/api/bootstrap', async (req, res) => {
    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    try {
        const masterUid = requireMaster(req, res);
        if (!masterUid) return;
        const source = req.method === 'GET' ? req.query : req.body;
        const shopId = String(source?.shopId || getAuthContext(req).shopId || '').trim();
        const snapshot = await buildBootstrap(masterUid, shopId);
        if (!snapshot) {
            return res.status(404).json({ error: 'Không tìm thấy dữ liệu' });
        }
        res.json(snapshot);
    } catch (error) {
        res.status(500).json({ error: error?.message || String(error) });
    }
});

app.get('/api/shops', async (req, res) => {
    const masterUid = requireMaster(req, res);
    if (!masterUid) return;
    const includePasswords = String(req.query?.includePasswords || '').trim() === '1';
    const role = String(getAuthContext(req).role || '').trim();

    if (includePasswords && role !== 'master' && role !== 'admin') {
        return res.status(403).json({ error: 'Không được phép xem thông tin chi nhánh' });
    }

    try {
        const [rows] = await pool.query(
            `SELECT shop_id, shop_name, administrator_password, staff_password, created_at
             FROM shop
             WHERE master_id = ?
             ORDER BY created_at ASC, shop_name ASC`,
            [masterUid]
        );

        res.json(rows.map((row) => ({
            shop_id: row.shop_id,
            shop_name: row.shop_name,
            administrator_password: includePasswords ? row.administrator_password : '',
            staff_password: includePasswords ? row.staff_password : '',
            created_at: row.created_at
        })));
    } catch (error) {
        res.status(500).json({ error: error?.message || String(error) });
    }
});

app.post('/api/shops', async (req, res) => {
    const masterUid = requireMaster(req, res);
    if (!masterUid) return;

    const shopId = String(req.body?.shop_id || '').trim();
    const shopName = String(req.body?.shop_name || '').trim();
    const adminPassword = String(req.body?.administrator_password || '').trim();
    const staffPassword = String(req.body?.staff_password || '').trim();

    if (!shopId) {
        return res.status(400).json({ error: 'shop_id không được để trống' });
    }
    if (!shopName) {
        return res.status(400).json({ error: 'shop_name không được để trống' });
    }
    if (!adminPassword) {
        return res.status(400).json({ error: 'administrator_password không được để trống' });
    }
    if (!staffPassword) {
        return res.status(400).json({ error: 'staff_password không được để trống' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [existing] = await conn.query(
            'SELECT shop_id FROM shop WHERE shop_id = ? LIMIT 1',
            [shopId]
        );
        if (existing.length) {
            await conn.rollback();
            return res.status(409).json({ error: 'shop_id đã tồn tại' });
        }

        await conn.query(
            `INSERT INTO shop (shop_id, master_id, shop_name, administrator_password, staff_password)
             VALUES (?, ?, ?, ?, ?)`,
            [shopId, masterUid, shopName, sha256Hex(adminPassword), sha256Hex(staffPassword)]
        );

        const [ingredientRows] = await conn.query(
            'SELECT id FROM ingredients WHERE master_id = ?',
            [masterUid]
        );
        for (const ingredientRow of ingredientRows) {
            await conn.query(
                `INSERT INTO ingredient_stock (shop_id, ingredient_id, quantity)
                 VALUES (?, ?, 0)
                 ON DUPLICATE KEY UPDATE quantity = quantity`,
                [shopId, ingredientRow.id]
            );
        }

        const [productRows] = await conn.query(
            'SELECT id FROM products WHERE master_id = ?',
            [masterUid]
        );
        for (const productRow of productRows) {
            await conn.query(
                `INSERT INTO product_stock (shop_id, product_id, quantity)
                 VALUES (?, ?, 0)
                 ON DUPLICATE KEY UPDATE quantity = quantity`,
                [shopId, productRow.id]
            );
        }

        await conn.commit();
        res.json({ success: true, shop_id: shopId, shop_name: shopName });
    } catch (error) {
        await conn.rollback();
        res.status(500).json({ error: error?.message || String(error) });
    } finally {
        conn.release();
    }
});

app.put('/api/shops/:shopId', async (req, res) => {
    const masterUid = requireMaster(req, res);
    if (!masterUid) return;

    const shopId = String(req.params.shopId || '').trim();
    const shopName = String(req.body?.shop_name || '').trim();
    const adminPassword = String(req.body?.administrator_password || '').trim();
    const staffPassword = String(req.body?.staff_password || '').trim();

    if (!shopId) {
        return res.status(400).json({ error: 'shopId không hợp lệ' });
    }
    if (!shopName) {
        return res.status(400).json({ error: 'shop_name không được để trống' });
    }
    if (!adminPassword) {
        return res.status(400).json({ error: 'administrator_password không được để trống' });
    }
    if (!staffPassword) {
        return res.status(400).json({ error: 'staff_password không được để trống' });
    }

    try {
        const [result] = await pool.query(
            `UPDATE shop
             SET shop_name = ?, administrator_password = ?, staff_password = ?
             WHERE shop_id = ? AND master_id = ?`,
            [shopName, sha256Hex(adminPassword), sha256Hex(staffPassword), shopId, masterUid]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ error: 'Không tìm thấy chi nhánh' });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error?.message || String(error) });
    }
});

app.delete('/api/shops/:shopId', async (req, res) => {
    const masterUid = requireMaster(req, res);
    if (!masterUid) return;

    const shopId = String(req.params.shopId || '').trim();
    if (!shopId) {
        return res.status(400).json({ error: 'shopId không hợp lệ' });
    }

    try {
        const [countRows] = await pool.query(
            'SELECT COUNT(*) AS total FROM shop WHERE master_id = ?',
            [masterUid]
        );
        if (Number(countRows[0]?.total || 0) <= 1) {
            return res.status(409).json({ error: 'Không thể xóa chi nhánh cuối cùng' });
        }

        const [result] = await pool.query(
            'DELETE FROM shop WHERE shop_id = ? AND master_id = ?',
            [shopId, masterUid]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ error: 'Không tìm thấy chi nhánh' });
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error?.message || String(error) });
    }
});

app.get('/api/ingredients/catalog', async (_req, res) => {
    try {
        const masterUid = requireMaster(_req, res);
        if (!masterUid) return;
        const rows = await buildIngredientCatalog(masterUid);
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

        const nextIngredientId = await getNextId(conn, 'ingredients');

        const [existingRows] = await conn.query(
            'SELECT id FROM ingredients WHERE master_id = ? AND LOWER(name) = LOWER(?) LIMIT 1',
            [masterUid, name]
        );

        if (existingRows.length) {
            await conn.rollback();
            return res.status(409).json({ error: 'Nguyên liệu đã tồn tại' });
        }

        const [insertResult] = await conn.query(
            `INSERT INTO ingredients (id, master_id, name, category, unit)
             VALUES (?, ?, ?, ?, ?)`,
            [nextIngredientId, masterUid, name, category || null, unit]
        );

        const ingredientId = insertResult.insertId || nextIngredientId;
        const [shopRows] = await conn.query('SELECT shop_id FROM shop WHERE master_id = ?', [masterUid]);
        for (const shopRow of shopRows) {
            await conn.query(
                `INSERT INTO ingredient_stock (shop_id, ingredient_id, quantity)
                 VALUES (?, ?, 0)
                 ON DUPLICATE KEY UPDATE quantity = quantity`,
                [shopRow.shop_id, ingredientId]
            );
        }

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
        if (!masterUid) return;
        const shopId = requireShop(_req, res);
        if (!shopId) return;
        const rows = await buildIngredientStock(masterUid, shopId);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error?.message || String(error) });
    }
});

app.post('/api/ingredient-imports', async (req, res) => {
    const masterUid = requireMaster(req, res);
    if (!masterUid) return;
    const shopId = requireShop(req, res);
    if (!shopId) return;
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

        const nextImportId = await getNextId(conn, 'ingredient_imports');

        const [ingredientRows] = await conn.query('SELECT id FROM ingredients WHERE master_id = ? AND id = ?', [masterUid, ingredientId]);
        if (!ingredientRows.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Nguyên liệu không tồn tại' });
        }

        await conn.query(
            `INSERT INTO ingredient_imports (id, shop_id, ingredient_id, quantity, import_price)
             VALUES (?, ?, ?, ?, ?)`,
            [nextImportId, shopId, ingredientId, quantity, unitPrice]
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
    if (!masterUid) return;
    const shopId = requireShop(req, res);
    if (!shopId) return;
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

        const nextImportId = await getNextId(conn, 'ingredient_imports');

        for (const item of normalized) {
            const [ingredientRows] = await conn.query('SELECT id FROM ingredients WHERE master_id = ? AND id = ?', [masterUid, item.ingredientId]);
            if (!ingredientRows.length) {
                await conn.rollback();
                return res.status(404).json({ error: `Dòng ${item.index + 1}: Nguyên liệu không tồn tại` });
            }

            await conn.query(
                `INSERT INTO ingredient_imports (id, shop_id, ingredient_id, quantity, import_price)
                 VALUES (?, ?, ?, ?, ?)`,
                [nextImportId + item.index, shopId, item.ingredientId, item.quantity, item.unitPrice]
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
    if (!masterUid) return;
    const shopId = requireShop(req, res);
    if (!shopId) return;
    const fromDate = String(req.query?.from_date || '').trim();
    const toDate = String(req.query?.to_date || '').trim();

    try {
        const rows = await buildIngredientImports(masterUid, shopId, fromDate, toDate);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error?.message || String(error) });
    }
});

app.get('/api/recipes', async (_req, res) => {
    try {
        const masterUid = requireMaster(_req, res);
        if (!masterUid) return;
        const rows = await buildRecipeList(masterUid);
        res.json(rows.map((row) => ({
            id: row.id,
            name: row.name,
            description: row.description,
            cost: row.cost,
            ingredients: row.ingredients,
            basePrice: row.basePrice
        })));
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
        const masterUid = requireMaster(req, res);
        if (!masterUid) return;
        const [productRows] = await pool.query(
            `SELECT id, name, description, base_price
             FROM products
             WHERE id = ? AND master_id = ?`,
            [productId, masterUid]
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
             WHERE r.product_id = ? AND r.master_id = ?
             ORDER BY i.name ASC`,
            [productId, masterUid]
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
    const masterUid = requireMaster(req, res);
    if (!masterUid) return;
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

        const nextProductId = await getNextId(conn, 'products');

        const [insertProduct] = await conn.query(
            `INSERT INTO products (id, master_id, name, description, base_price)
             VALUES (?, ?, ?, ?, 0)`,
            [nextProductId, masterUid, name, description || null]
        );
        const productId = insertProduct.insertId || nextProductId;

        for (const item of normalized) {
            const [ingredientRows] = await conn.query('SELECT id FROM ingredients WHERE id = ? AND master_id = ?', [item.ingredientId, masterUid]);
            if (!ingredientRows.length) {
                await conn.rollback();
                return res.status(404).json({ error: `Dòng ${item.index + 1}: Nguyên liệu không tồn tại` });
            }

            await conn.query(
                `INSERT INTO recipes (master_id, product_id, ingredient_id, quantity_needed)
                 VALUES (?, ?, ?, ?)`,
                [masterUid, productId, item.ingredientId, item.quantity]
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
        const masterUid = requireMaster(req, res);
        if (!masterUid) return;
        const [result] = await pool.query('DELETE FROM products WHERE id = ? AND master_id = ?', [productId, masterUid]);
        if (!result.affectedRows) {
            return res.status(404).json({ error: 'Không tìm thấy công thức' });
        }
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error?.message || String(error) });
    }
});

app.post('/api/daily-productions', async (req, res) => {
    const masterUid = requireMaster(req, res);
    if (!masterUid) return;
    const shopId = requireShop(req, res);
    if (!shopId) return;

    const productId = Number(req.body?.productId);
    const quantityProduced = Number(req.body?.quantityProduced || req.body?.quantity || 0);

    if (!Number.isFinite(productId) || productId <= 0) {
        return res.status(400).json({ error: 'productId không hợp lệ' });
    }
    if (!Number.isFinite(quantityProduced) || quantityProduced <= 0) {
        return res.status(400).json({ error: 'quantityProduced phải lớn hơn 0' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [productRows] = await conn.query('SELECT id FROM products WHERE id = ? AND master_id = ?', [productId, masterUid]);
        if (!productRows.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
        }

        const recipes = await buildRecipeList(masterUid);
        const recipe = recipes.find((item) => item.id === productId);
        if (!recipe || !Object.keys(recipe.ingredients || {}).length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Sản phẩm chưa có công thức' });
        }

        const stockRows = await buildIngredientStock(masterUid, shopId);
        const stockMap = new Map(stockRows.map((item) => [item.name, Number(item.quantity || 0)]));
        for (const [ingredientName, amountNeeded] of Object.entries(recipe.ingredients)) {
            const currentQuantity = Number(stockMap.get(ingredientName) || 0);
            if (currentQuantity < amountNeeded * quantityProduced) {
                await conn.rollback();
                return res.status(409).json({ error: `Không đủ nguyên liệu: ${ingredientName}` });
            }
        }

        const nextProductionId = await getNextId(conn, 'daily_productions', 'shop_id = ?', [shopId]);
        await conn.query(
            `INSERT INTO daily_productions (id, shop_id, product_id, quantity_produced)
             VALUES (?, ?, ?, ?)`,
            [nextProductionId, shopId, productId, quantityProduced]
        );

        await conn.commit();
        res.json({ success: true, id: nextProductionId });
    } catch (error) {
        await conn.rollback();
        res.status(500).json({ error: error?.message || String(error) });
    } finally {
        conn.release();
    }
});

app.post('/api/daily-sales', async (req, res) => {
    const masterUid = requireMaster(req, res);
    if (!masterUid) return;
    const shopId = requireShop(req, res);
    if (!shopId) return;

    const productId = Number(req.body?.productId);
    const quantitySold = Number(req.body?.quantitySold || req.body?.quantity || 0);
    const actualSalePrice = Number(req.body?.actualSalePrice || req.body?.sellPrice || req.body?.price || 0);

    if (!Number.isFinite(productId) || productId <= 0) {
        return res.status(400).json({ error: 'productId không hợp lệ' });
    }
    if (!Number.isFinite(quantitySold) || quantitySold <= 0) {
        return res.status(400).json({ error: 'quantitySold phải lớn hơn 0' });
    }
    if (!Number.isFinite(actualSalePrice) || actualSalePrice <= 0) {
        return res.status(400).json({ error: 'actualSalePrice phải lớn hơn 0' });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [productRows] = await conn.query('SELECT id FROM products WHERE id = ? AND master_id = ?', [productId, masterUid]);
        if (!productRows.length) {
            await conn.rollback();
            return res.status(404).json({ error: 'Không tìm thấy sản phẩm' });
        }

        const [stockRows] = await conn.query('SELECT quantity FROM product_stock WHERE shop_id = ? AND product_id = ?', [shopId, productId]);
        const currentQuantity = Number(stockRows[0]?.quantity || 0);
        if (currentQuantity < quantitySold) {
            await conn.rollback();
            return res.status(409).json({ error: 'Không đủ tồn kho thành phẩm' });
        }

        const nextSaleId = await getNextId(conn, 'daily_sales', 'shop_id = ?', [shopId]);
        await conn.query(
            `INSERT INTO daily_sales (id, shop_id, product_id, quantity_sold, actual_sale_price)
             VALUES (?, ?, ?, ?, ?)`,
            [nextSaleId, shopId, productId, quantitySold, actualSalePrice]
        );

        await conn.commit();
        res.json({ success: true, id: nextSaleId });
    } catch (error) {
        await conn.rollback();
        res.status(500).json({ error: error?.message || String(error) });
    } finally {
        conn.release();
    }
});

app.get('/api/sales/history', async (req, res) => {
    try {
        const masterUid = requireMaster(req, res);
        if (!masterUid) return;
        const shopId = requireShop(req, res);
        if (!shopId) return;
        const rows = await buildSalesHistory(masterUid, shopId);
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: error?.message || String(error) });
    }
});

app.post('/api/sales/reset', async (req, res) => {
    const masterUid = requireMaster(req, res);
    if (!masterUid) return;
    const shopId = requireShop(req, res);
    if (!shopId) return;

    try {
        await pool.query('DELETE FROM daily_sales WHERE shop_id = ?', [shopId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error?.message || String(error) });
    }
});

app.post('/api/demo/reset', async (req, res) => {
    const masterUid = requireMaster(req, res);
    if (!masterUid) return;
    const shopId = requireShop(req, res);
    if (!shopId) return;

    const sampleIngredients = [
        { name: 'Bột mì', category: 'Bột', unit: 'g', quantity: 1500, pricePerUnit: 0.02 },
        { name: 'Đường', category: 'Gia vị', unit: 'g', quantity: 800, pricePerUnit: 0.025 },
        { name: 'Bơ', category: 'Bơ sữa', unit: 'g', quantity: 500, pricePerUnit: 0.12 },
        { name: 'Nho khô', category: 'Phụ liệu', unit: 'g', quantity: 200, pricePerUnit: 0.15 }
    ];
    const sampleRecipes = [
        { name: 'Cookies Matcha', description: 'Công thức mẫu', ingredients: { 'Bột mì': 50, 'Đường': 20, 'Bơ': 25 } },
        { name: 'Bánh nho', description: 'Công thức mẫu', ingredients: { 'Bột mì': 60, 'Đường': 15, 'Nho khô': 12, 'Bơ': 20 } }
    ];

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        await conn.query('DELETE FROM daily_sales WHERE shop_id = ?', [shopId]);
        await conn.query('DELETE FROM daily_productions WHERE shop_id = ?', [shopId]);
        await conn.query('DELETE FROM ingredient_imports WHERE shop_id = ?', [shopId]);
        await conn.query('DELETE FROM ingredient_stock WHERE shop_id = ?', [shopId]);
        await conn.query('DELETE FROM product_stock WHERE shop_id = ?', [shopId]);
        await conn.query('DELETE FROM recipes WHERE master_id = ?', [masterUid]);
        await conn.query('DELETE FROM products WHERE master_id = ?', [masterUid]);
        await conn.query('DELETE FROM ingredients WHERE master_id = ?', [masterUid]);

        const ingredientIdMap = new Map();
        for (const sample of sampleIngredients) {
            const nextIngredientId = await getNextId(conn, 'ingredients');
            await conn.query(
                `INSERT INTO ingredients (id, master_id, name, category, unit)
                 VALUES (?, ?, ?, ?, ?)`,
                [nextIngredientId, masterUid, sample.name, sample.category, sample.unit]
            );
            ingredientIdMap.set(sample.name, nextIngredientId);

            await conn.query(
                `INSERT INTO ingredient_imports (id, shop_id, ingredient_id, quantity, import_price)
                 VALUES (?, ?, ?, ?, ?)`,
                [await getNextId(conn, 'ingredient_imports'), shopId, nextIngredientId, sample.quantity, sample.pricePerUnit]
            );
        }

        for (const sample of sampleRecipes) {
            const nextProductId = await getNextId(conn, 'products');
            await conn.query(
                `INSERT INTO products (id, master_id, name, description, base_price)
                 VALUES (?, ?, ?, ?, 0)`,
                [nextProductId, masterUid, sample.name, sample.description]
            );
            await conn.query(
                `INSERT INTO product_stock (shop_id, product_id, quantity)
                 VALUES (?, ?, 0)
                 ON DUPLICATE KEY UPDATE quantity = VALUES(quantity)`,
                [shopId, nextProductId]
            );

            for (const [ingredientName, quantityNeeded] of Object.entries(sample.ingredients)) {
                await conn.query(
                    `INSERT INTO recipes (master_id, product_id, ingredient_id, quantity_needed)
                     VALUES (?, ?, ?, ?)`,
                    [masterUid, nextProductId, ingredientIdMap.get(ingredientName), quantityNeeded]
                );
            }
        }

        await conn.commit();
        res.json({ success: true });
    } catch (error) {
        await conn.rollback();
        res.status(500).json({ error: error?.message || String(error) });
    } finally {
        conn.release();
    }
});

app.get('/', (_req, res) => {
    res.sendFile(path.join(webRoot, 'index.html'));
});

const port = Number(process.env.PORT || 3001);

async function startServer() {
    try {
        await ensureShopIdColumnCompatibility();
        app.listen(port, () => {
            console.log(`Server listening on http://localhost:${port}`);
        });
    } catch (error) {
        console.error('Failed to start server:', error?.message || String(error));
        process.exit(1);
    }
}

startServer();
