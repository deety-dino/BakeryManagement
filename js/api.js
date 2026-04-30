const AUTH_SESSION_KEY = 'bakemanage.authSession';

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
