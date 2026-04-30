const AUTH_SESSION_KEY = 'bakemanage.authSession';

// Detect if running in GitHub Pages (offline mode)
const OFFLINE_MODE = !window.location.hostname.includes('localhost') && 
                     !window.location.hostname.includes('127.0.0.1') &&
                     !window.location.hostname.includes(':');

function readAuthSession() {
    try {
        const raw = localStorage.getItem(AUTH_SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (_error) {
        return null;
    }
}

function writeAuthSession(session) {
    if (!session) {
        localStorage.removeItem(AUTH_SESSION_KEY);
        return null;
    }
    localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
    return session;
}

function buildAuthHeaders() {
    const session = readAuthSession();
    if (!session?.masterUid) return {};

    return {
        'x-master-id': session.masterUid,
        'x-master-uid': session.masterUid,
        'x-shop-id': session.shopId || '',
        'x-role': session.role || 'master'
    };
}

async function apiRequest(path, options = {}) {
    try {
        const res = await fetch(path, {
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
        // Fallback to mock data in offline mode
        if (OFFLINE_MODE || error.message.includes('Failed to fetch')) {
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

    // Master login
    if (path === '/api/auth/master-login' && method === 'POST') {
        const master = findMaster(body.masterId);
        if (!master || master.password !== body.password) {
            throw new Error('Master ID hoặc password không đúng');
        }
        const session = {
            masterUid: master.master_uid,
            masterId: body.masterId,
            role: 'master'
        };
        writeAuthSession(session);
        return { success: true, session };
    }

    // Shop login
    if (path === '/api/auth/shop-login' && method === 'POST') {
        const shop = findShop(body.shop_id);
        const master = findMaster(body.master_id);
        if (!shop || !master) {
            throw new Error('Chi nhánh hoặc master không tồn tại');
        }
        
        const isAdmin = body.password === shop.administrator_password;
        const isStaff = body.password === shop.staff_password;
        if (!isAdmin && !isStaff) {
            throw new Error('Mật khẩu không đúng');
        }

        const session = {
            masterUid: body.master_id,
            shopId: body.shop_id,
            role: isAdmin ? 'admin' : 'staff'
        };
        writeAuthSession(session);
        return { success: true, session };
    }

    // Register shop (master)
    if (path === '/api/auth/register' && method === 'POST') {
        const session = {
            masterUid: body.master_id,
            masterId: body.master_id,
            role: 'master'
        };
        
        const data = getMockData();
        const existingMaster = data.masters.find(m => m.master_uid === body.master_id);
        if (!existingMaster) {
            data.masters.push({
                master_uid: body.master_id,
                password: body.password,
                name: body.name || 'Master User'
            });
            saveMockData(data);
        }
        
        writeAuthSession(session);
        return { success: true, session };
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

    // Delete recipe
    if (path.match(/\/api\/recipes\/[^/]+$/) && method === 'DELETE') {
        const recipeId = parseInt(path.split('/').pop());
        deleteRecipe(recipeId);
        return { success: true };
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
