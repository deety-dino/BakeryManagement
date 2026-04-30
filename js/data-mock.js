// Mock Data for GitHub Pages deployment
// This file provides mock data for shops, ingredients, and recipes

const MOCK_DATA_KEY = 'bakemanage.mockData';

// Initialize mock data structure
function initializeMockData() {
    let mockData = JSON.parse(localStorage.getItem(MOCK_DATA_KEY)) || {
        masters: [
            { master_uid: 'demo-master', password: '123456', name: 'Demo Master' }
        ],
        shops: [
            {
                shop_id: 'shop-001',
                shop_name: 'Tiệm bánh Hà Nội',
                administrator_password: 'admin123',
                staff_password: 'staff123',
                master_uid: 'demo-master'
            }
        ],
        ingredients: [
            { id: 1, name: 'Bột mì', category: 'Bột', unit: 'kg' },
            { id: 2, name: 'Bột đường', category: 'Đường', unit: 'kg' },
            { id: 3, name: 'Đường trắng', category: 'Đường', unit: 'kg' },
            { id: 4, name: 'Trứng gà', category: 'Trứng', unit: 'quả' },
            { id: 5, name: 'Bơ tươi', category: 'Bơ', unit: 'kg' },
            { id: 6, name: 'Sữa tươi', category: 'Sữa', unit: 'lít' },
            { id: 7, name: 'Nước sạch', category: 'Nước', unit: 'lít' },
            { id: 8, name: 'Vani', category: 'Hương liệu', unit: 'ml' }
        ],
        recipes: [
            {
                id: 1,
                name: 'Bánh mì nho',
                category: 'Bánh mì',
                description: 'Bánh mì truyền thống',
                ingredients: { 'Bột mì': 500, 'Nước sạch': 250, 'Bơ tươi': 50 }
            },
            {
                id: 2,
                name: 'Bánh ngọt vani',
                category: 'Bánh ngọt',
                description: 'Bánh ngọt với hương vani',
                ingredients: { 'Bột mì': 300, 'Trứng gà': 3, 'Vani': 5 }
            }
        ]
    };

    localStorage.setItem(MOCK_DATA_KEY, JSON.stringify(mockData));
    return mockData;
}

// Get all mock data
function getMockData() {
    return JSON.parse(localStorage.getItem(MOCK_DATA_KEY)) || initializeMockData();
}

// Update mock data
function saveMockData(data) {
    localStorage.setItem(MOCK_DATA_KEY, JSON.stringify(data));
}

// Master operations
function findMaster(masterId) {
    const data = getMockData();
    return data.masters.find(m => m.master_uid === masterId);
}

function findShop(shopId) {
    const data = getMockData();
    return data.shops.find(s => s.shop_id === shopId);
}

// Add/update/delete operations
function addShop(shopData) {
    const data = getMockData();
    const newId = Math.max(...data.shops.map(s => parseInt(s.shop_id.split('-')[1]) || 0)) + 1;
    const newShop = {
        ...shopData,
        shop_id: `shop-${String(newId).padStart(3, '0')}`
    };
    data.shops.push(newShop);
    saveMockData(data);
    return newShop;
}

function updateShop(shopId, updates) {
    const data = getMockData();
    const shop = data.shops.find(s => s.shop_id === shopId);
    if (shop) {
        Object.assign(shop, updates);
        saveMockData(data);
    }
    return shop;
}

function deleteShop(shopId) {
    const data = getMockData();
    data.shops = data.shops.filter(s => s.shop_id !== shopId);
    saveMockData(data);
}

function addIngredient(ingData) {
    const data = getMockData();
    const newId = Math.max(...data.ingredients.map(i => i.id || 0)) + 1;
    const newIng = { ...ingData, id: newId };
    data.ingredients.push(newIng);
    saveMockData(data);
    return newIng;
}

function updateIngredient(ingId, updates) {
    const data = getMockData();
    const ing = data.ingredients.find(i => i.id === ingId);
    if (ing) {
        Object.assign(ing, updates);
        saveMockData(data);
    }
    return ing;
}

function deleteIngredient(ingId) {
    const data = getMockData();
    data.ingredients = data.ingredients.filter(i => i.id !== ingId);
    saveMockData(data);
}

function addRecipe(recipeData) {
    const data = getMockData();
    const newId = Math.max(...data.recipes.map(r => r.id || 0)) + 1;
    const newRecipe = { ...recipeData, id: newId };
    data.recipes.push(newRecipe);
    saveMockData(data);
    return newRecipe;
}

function updateRecipe(recipeId, updates) {
    const data = getMockData();
    const recipe = data.recipes.find(r => r.id === recipeId);
    if (recipe) {
        Object.assign(recipe, updates);
        saveMockData(data);
    }
    return recipe;
}

function deleteRecipe(recipeId) {
    const data = getMockData();
    data.recipes = data.recipes.filter(r => r.id !== recipeId);
    saveMockData(data);
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeMockData);
} else {
    initializeMockData();
}
