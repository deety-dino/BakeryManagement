const AUTH_SESSION_KEY = 'bakemanage.authSession';

function getApiBaseUrl() {
    const configuredBaseUrl = window.BAKEMANAGE_API_BASE_URL || window.apiBaseUrl || '';
    return String(configuredBaseUrl).trim().replace(/\/$/, '');
}

function isProbablyRelativePath(path) {
    return typeof path === 'string' && path.startsWith('/');
}

function buildRequestUrl(path) {
    const baseUrl = getApiBaseUrl();
    if (baseUrl && isProbablyRelativePath(path)) {
        return `${baseUrl}${path}`;
    }
    return path;
}

function shouldUseOfflineFallback(error) {
    const hasBaseUrl = !!getApiBaseUrl();
    return !hasBaseUrl && (window.location.protocol === 'file:' || error.message.includes('Failed to fetch'));
}

function readAuthSession() {
    try {
        const raw = localStorage.getItem(AUTH_SESSION_KEY);
        const session = raw ? JSON.parse(raw) : null;
        if (session) {
            console.log('[auth] Read session from localStorage:', {
                masterUid: session.masterUid,
                masterId: session.masterId,
                shopId: session.shopId,
                role: session.role
            });
        }
        return session;
    } catch (_error) {
        console.error('[auth] Failed to read session:', _error);
        return null;
    }
}

function writeAuthSession(session) {
    if (!session) {
        console.log('[auth] Clearing session');
        localStorage.removeItem(AUTH_SESSION_KEY);
        return null;
    }
    console.log('[auth] Saving session:', {
        masterUid: session.masterUid,
        masterId: session.masterId,
        shopId: session.shopId,
        role: session.role
    });
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    return session;
}

function buildAuthHeaders() {
    const session = readAuthSession();
    if (!session?.masterUid) {
        console.warn('[auth] No session or masterUid found:', session);
        return {};
    }

    const headers = {
        'x-master-id': session.masterUid || session.masterId || '',
        'x-master-uid': session.masterUid || session.masterId || '',
        'x-shop-id': session.shopId || '',
        'x-role': session.role || 'master'
    };
    
    console.log('[auth] Built headers:', {
        'x-master-uid': headers['x-master-uid'],
        'x-shop-id': headers['x-shop-id'],
        'x-role': headers['x-role']
    });
    
    return headers;
}

async function apiRequest(path, options = {}) {
    try {
        const res = await fetch(buildRequestUrl(path), {
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
                ...buildAuthHeaders()
            },
            ...options
        });

        if (!res.ok) {
            let message = `HTTP ${res.status}`;
            try {
                const text = await res.text();
                if (text) {
                    try {
                        const errorData = JSON.parse(text);
                        if (errorData?.error) {
                            message = errorData.error;
                        } else {
                            message = text;
                        }
                    } catch (_) {
                        message = text;
                    }
                }
            } catch (_) {
                // Keep the default HTTP status message if the body cannot be read.
            }
            throw new Error(message);
        }

        if (res.status === 204) return null;
        return res.json();
    } catch (error) {
        // Fallback to mock data only when no backend URL is configured.
        if (shouldUseOfflineFallback(error)) {
            console.log('[api] Using offline fallback for:', path, 'Error was:', error.message);
            return handleOfflineRequest(path, options);
        }
        throw error;
    }
}

// Handle API requests in offline mode with mock data
async function handleOfflineRequest(path, options = {}) {
    // Simulate async delay
    await new Promise(resolve => setTimeout(resolve, 100));

    // Ensure mock helpers are available when running in offline (GitHub Pages) mode.
    if (typeof getMockData !== 'function') {
        if (typeof initializeMockData === 'function') {
            initializeMockData();
        } else {
            throw new Error('Offline mock functions missing — include js/data-mock.js before js/api.js');
        }
    }

    const method = options.method || 'GET';
    const body = options.body ? JSON.parse(options.body) : null;

    const masterIdValue = body?.masterId || body?.master_id || body?.masterUid || body?.master_uid || '';
    const shopIdValue = body?.shopId || body?.shop_id || '';

    // Master login
    if (path === '/api/auth/master-login' && method === 'POST') {
        const master = findMaster(masterIdValue);
        const passwordValue = body?.password || body?.passwordHash || '';
        if (!master || master.password !== passwordValue) {
            throw new Error('Master ID hoặc password không đúng');
        }
        const session = {
            masterUid: master.master_uid,
            masterId: master.master_id || master.master_uid,
            role: 'master'
        };
        writeAuthSession(session);
        return { success: true, session };
    }

    // Shop login
    if (path === '/api/auth/shop-login' && method === 'POST') {
        let shop = findShop(shopIdValue);
        const master = findMaster(masterIdValue);
        
        // If shop_id not provided or not found, try to find the user's first shop
        if (!shop && master && !shopIdValue) {
            const data = getMockData();
            shop = data.shops.find(s => s.master_uid === master.master_uid || s.master_id === master.master_id);
        }
        
        if (!shop || !master) {
            throw new Error('Chi nhánh hoặc master không tồn tại');
        }
        
        const passwordValue = body?.password || body?.passwordHash || '';
        const isAdmin = passwordValue === shop.administrator_password;
        const isStaff = passwordValue === shop.staff_password;
        if (!isAdmin && !isStaff) {
            throw new Error('Mật khẩu không đúng');
        }

        const session = {
            masterUid: master.master_uid || masterIdValue,
            masterId: master.master_id || master.master_uid || masterIdValue,
            shopId: shop.shop_id,
            role: isAdmin ? 'admin' : 'staff'
        };
        writeAuthSession(session);
        return { success: true, session };
    }

    // Register shop (master)
    if (path === '/api/auth/register' && method === 'POST') {
        const passwordValue = body?.password || body?.passwordHash || '';
        const masterName = body?.masterName || body?.name || masterIdValue || 'Master User';
        const shopName = body?.shopName || 'Chi nhánh mặc định';
        const data = getMockData();
        
        const existingMaster = data.masters.find(m => m.master_uid === masterIdValue || m.master_id === masterIdValue);
        if (existingMaster) {
            throw new Error('master_id đã tồn tại');
        }

        // Create master
        const newMaster = {
            master_uid: masterIdValue,
            master_id: masterIdValue,
            password: passwordValue,
            name: masterName
        };
        data.masters.push(newMaster);

        // Create default shop (inline to avoid double-save)
        const maxShopNum = Math.max(...data.shops.map(s => parseInt(s.shop_id?.split('-')[1]) || 0), 0);
        const newShopId = `shop-${String(maxShopNum + 1).padStart(3, '0')}`;
        const newShop = {
            shop_id: newShopId,
            shop_name: shopName,
            master_uid: masterIdValue,
            master_id: masterIdValue,
            administrator_password: passwordValue,
            staff_password: passwordValue
        };
        data.shops.push(newShop);

        // Save once with both master and shop
        saveMockData(data);
        
        const session = {
            masterUid: newMaster.master_uid,
            masterId: newMaster.master_id,
            shopId: newShop.shop_id,
            shopName: newShop.shop_name,
            role: 'master'
        };

        writeAuthSession(session);
        return { success: true, session, masterUid: newMaster.master_uid, masterId: newMaster.master_id, shopId: newShop.shop_id, shopName: newShop.shop_name };
    }

    // Get shops
    if (path.includes('/api/shops') && method === 'GET') {
        const data = getMockData();
        const shops = data.shops.map(s => ({
            ...s,
            administrator_password: '••••••••',
            staff_password: '••••••••'
        }));
        return shops;
    }

    // Create shop
    if (path === '/api/shops' && method === 'POST') {
        return addShop(body);
    }

    // Update shop
    if (path.match(/\/api\/shops\/[^/]+$/) && method === 'PUT') {
        const shopId = path.split('/').pop();
        return updateShop(shopId, body);
    }

    // Delete shop
    if (path.match(/\/api\/shops\/[^/]+$/) && method === 'DELETE') {
        const shopId = path.split('/').pop();
        deleteShop(shopId);
        return { success: true };
    }

    // Get ingredients
    if (path.includes('/api/ingredients') && method === 'GET') {
        const data = getMockData();
        return data.ingredients;
    }

    // Add ingredient
    if (path === '/api/ingredients' && method === 'POST') {
        return addIngredient(body);
    }

    // Update ingredient
    if (path.match(/\/api\/ingredients\/[^/]+$/) && method === 'PUT') {
        const ingId = parseInt(path.split('/').pop());
        return updateIngredient(ingId, body);
    }

    // Delete ingredient
    if (path.match(/\/api\/ingredients\/[^/]+$/) && method === 'DELETE') {
        const ingId = parseInt(path.split('/').pop());
        deleteIngredient(ingId);
        return { success: true };
    }

    // Get recipes
    if (path === '/api/recipes' && method === 'GET') {
        const data = getMockData();
        return data.recipes;
    }

    // Add recipe
    if (path === '/api/recipes' && method === 'POST') {
        return addRecipe(body);
    }

    // Update recipe
    if (path.match(/\/api\/recipes\/[^/]+$/) && method === 'PUT') {
        const recipeId = parseInt(path.split('/').pop());
        return updateRecipe(recipeId, body);
    }

    // Update recipe
    

    // Delete recipe
    if (path.match(/\/api\/recipes\/[^/]+$/) && method === 'DELETE') {
        const recipeId = parseInt(path.split('/').pop());
        deleteRecipe(recipeId);
        return { success: true };
    }

    // Get ingredient stock (mock)
    if (path === '/api/ingredient-stock' && method === 'GET') {
        const data = getMockData();
        const stockRows = Array.isArray(data.ingredientStock) ? data.ingredientStock : [];
        const stockMap = new Map(stockRows.map(item => [String(item.ingredient_id ?? item.ingredientId ?? item.id), item]));
        return (data.ingredients || []).map(item => {
            const stock = stockMap.get(String(item.id)) || {};
            return ({
            ingredient_id: item.id,
            name: item.name,
            category: item.category,
            unit: item.unit,
            quantity: Number(stock.quantity ?? stock.qty ?? item.qty ?? 0),
            avg_unit_price_month: 0
            });
        });
    }

    // Get product stock (mock)
    if (path === '/api/product-stock' && method === 'GET') {
        const data = getMockData();
        return (data.products || []).map(item => ({
            product_id: item.id,
            product_name: item.name,
            description: item.description || '',
            base_price: item.price || 0,
            quantity: item.qty || 0,
            cost_per_unit: 0
        }));
    }

    // Get ingredient imports history (mock)
    if (path.includes('/api/ingredient-imports') && method === 'GET') {
        const data = getMockData();
        return (data.imports || []).map(item => ({
            id: item.id,
            ingredient_id: item.ingredientId,
            ingredient_name: item.ingredientName,
            quantity: item.quantity,
            total_money: item.totalMoney ?? item.unitPrice ?? 0,
            unit_price: Number(item.quantity || 0) > 0
                ? Number(item.totalMoney ?? item.unitPrice ?? 0) / Number(item.quantity || 0)
                : 0,
            import_date: item.date || new Date().toISOString().split('T')[0]
        }));
    }

    // Post ingredient imports (mock)
    if (path === '/api/ingredient-imports' && method === 'POST') {
        const data = getMockData();
        if (!data.imports) data.imports = [];
        const newImport = {
            id: (data.imports.length || 0) + 1,
            ingredientId: body?.ingredientId,
            ingredientName: data.ingredients?.find(i => i.id === body?.ingredientId)?.name || '',
            quantity: body?.quantity,
            totalMoney: body?.totalMoney ?? body?.total_money ?? body?.unitPrice,
            unitPrice: Number(body?.quantity || 0) > 0
                ? Number(body?.totalMoney ?? body?.unitPrice ?? 0) / Number(body?.quantity || 0)
                : 0,
            date: new Date().toISOString().split('T')[0]
        };
        data.imports.push(newImport);
        saveMockData(data);
        return { success: true };
    }

    // Post batch ingredient imports (mock)
    if (path === '/api/ingredient-imports/batch' && method === 'POST') {
        const data = getMockData();
        if (!data.imports) data.imports = [];
        const items = body?.items || [];
        items.forEach((item, idx) => {
            const ingredient = data.ingredients?.find(i => i.id === item.ingredientId);
            data.imports.push({
                id: (data.imports.length || 0) + idx + 1,
                ingredientId: item.ingredientId,
                ingredientName: ingredient?.name || '',
                quantity: item.quantity,
                totalMoney: item.totalMoney ?? item.total_money ?? item.unitPrice,
                unitPrice: Number(item.quantity || 0) > 0
                    ? Number(item.totalMoney ?? item.unitPrice ?? 0) / Number(item.quantity || 0)
                    : 0,
                date: new Date().toISOString().split('T')[0]
            });
        });
        saveMockData(data);
        return { success: true, count: items.length };
    }

    throw new Error(`Unsupported offline request: ${method} ${path}`);
}

window.dbApi = {
    getSession: () => readAuthSession(),
    setSession: (session) => writeAuthSession(session),
    clearSession: () => writeAuthSession(null),
    masterLogin: (payload) => apiRequest('/api/auth/master-login', {
        method: 'POST',
        body: JSON.stringify(payload)
    }),
    shopLogin: (payload) => apiRequest('/api/auth/shop-login', {
        method: 'POST',
        body: JSON.stringify(payload)
    }),
    googleOAuthUrl: (payload) => apiRequest('/api/oauth/google/url', {
        method: 'POST',
        body: JSON.stringify(payload)
    }),
    registerShop: (payload) => {
        const password = payload?.password ?? payload?.passwordHash ?? '';
        return apiRequest('/api/auth/register', {
            method: 'POST',
            body: JSON.stringify({
                ...payload,
                password,
                recheckPassword: payload?.recheckPassword ?? password,
                confirmPassword: payload?.confirmPassword ?? password
            })
        });
    },
    bootstrap: () => apiRequest('/api/bootstrap', {
        method: 'POST'
    }),
    health: () => apiRequest('/api/health'),
    ingredientCatalog: () => apiRequest('/api/ingredients/catalog'),
    ingredientStock: () => apiRequest('/api/ingredient-stock'),
    ingredientImports: (fromDate, toDate) => {
        const params = new URLSearchParams();
        if (fromDate) params.set('from_date', fromDate);
        if (toDate) params.set('to_date', toDate);
        const query = params.toString();
        return apiRequest(`/api/ingredient-imports${query ? `?${query}` : ''}`);
    },
    addIngredientImport: (payload) => apiRequest('/api/ingredient-imports', {
        method: 'POST',
        body: JSON.stringify(payload)
    }),
    addIngredientImportsBatch: (payload) => apiRequest('/api/ingredient-imports/batch', {
        method: 'POST',
        body: JSON.stringify(payload)
    }),
    addIngredient: (payload) => apiRequest('/api/ingredients', {
        method: 'POST',
        body: JSON.stringify(payload)
    }),
    recipes: () => apiRequest('/api/recipes'),
    recipeDetail: (productId) => apiRequest(`/api/recipes/${productId}`),
    addRecipe: (payload) => apiRequest('/api/recipes', {
        method: 'POST',
        body: JSON.stringify(payload)
    }),
    deleteRecipe: (productId) => apiRequest(`/api/recipes/${productId}`, {
        method: 'DELETE'
    }),
    addProduction: (payload) => apiRequest('/api/daily-productions', {
        method: 'POST',
        body: JSON.stringify(payload)
    }),
    addSale: (payload) => apiRequest('/api/daily-sales', {
        method: 'POST',
        body: JSON.stringify(payload)
    }),
    salesHistory: () => apiRequest('/api/sales/history'),
    resetSales: () => apiRequest('/api/sales/reset', {
        method: 'POST'
    }),
    resetDemo: () => apiRequest('/api/demo/reset', {
        method: 'POST'
    }),
    updateMasterProfile: (payload) => apiRequest('/api/auth/master/profile', {
        method: 'PUT',
        body: JSON.stringify(payload)
    }),
    getShops: (includePasswords = false) => apiRequest(`/api/shops${includePasswords ? '?includePasswords=1' : ''}`),
    createShop: (payload) => apiRequest('/api/shops', {
        method: 'POST',
        body: JSON.stringify(payload)
    }),
    updateShop: (shopId, payload) => apiRequest(`/api/shops/${shopId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
    }),
    deleteShop: (shopId) => apiRequest(`/api/shops/${shopId}`, {
        method: 'DELETE'
    }),
    getIngredients: () => apiRequest('/api/ingredients/catalog'),
    updateIngredient: (ingredientId, payload) => apiRequest(`/api/ingredients/${ingredientId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
    }),
    deleteIngredient: (ingredientId) => apiRequest(`/api/ingredients/${ingredientId}`, {
        method: 'DELETE'
    }),
    getRecipes: () => apiRequest('/api/recipes'),
    updateRecipe: (recipeId, payload) => apiRequest(`/api/recipes/${recipeId}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
    })
};
