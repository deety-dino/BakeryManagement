let currentUserId = null;
let currentMasterId = '';
let currentMasterName = '';
let currentShopId = '';
let currentShopName = '';
let currentAuthMode = 'master';
let userIngredients = [];
let userRecipes = [];
let userSalesHistory = [];
let windowDbSnapshot = null;

function getSampleIngredients() {
    return [
        { id: Date.now() + 1, name: "Bột mì", quantity: 1500, unit: "g", pricePerUnit: 0.02 },
        { id: Date.now() + 2, name: "Đường", quantity: 800, unit: "g", pricePerUnit: 0.025 },
        { id: Date.now() + 3, name: "Bơ", quantity: 500, unit: "g", pricePerUnit: 0.12 },
        { id: Date.now() + 4, name: "Nho khô", quantity: 200, unit: "g", pricePerUnit: 0.15 }
    ];
}

function getSampleRecipes() {
    return [
        { id: Date.now() + 101, name: "Cookies Matcha", ingredients: { "Bột mì": 50, "Đường": 20, "Bơ": 25 } },
        { id: Date.now() + 102, name: "Bánh nho", ingredients: { "Bột mì": 60, "Đường": 15, "Nho khô": 12, "Bơ": 20 } }
    ];
}