async function apiRequest(path, options = {}) {
    const res = await fetch(path, {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        },
        ...options
    });

    if (!res.ok) {
        let message = `HTTP ${res.status}`;
        try {
            const errorData = await res.json();
            if (errorData?.error) message = errorData.error;
        } catch (_) {
            const text = await res.text();
            if (text) message = text;
        }
        throw new Error(message);
    }

    if (res.status === 204) return null;
    return res.json();
}

window.dbApi = {
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
    })
};
