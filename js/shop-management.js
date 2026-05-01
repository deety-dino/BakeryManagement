// Shop Management JavaScript
// Handle all CRUD operations for shops, ingredients, and recipes

let currentEditingShopId = null;
let currentEditingIngredientId = null;
let currentEditingRecipeId = null;
let shopSecretsUnlocked = false;

// Initialize event listeners
document.addEventListener('DOMContentLoaded', initializeShopManagement);

function initializeShopManagement() {
    // Guard: Check if user is logged in before trying to load protected data
    const session = readSession?.() || window.dbApi?.getSession?.();
    if (!session?.masterUid) {
        console.log('[shop-management] No session found, skipping initialization until user logs in');
        return;
    }
    
    console.log('[shop-management] Session found, initializing:', { masterId: session.masterId, role: session.role });
    
    // Tab switching
    const tabButtons = document.querySelectorAll('.tab-btn');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTab(e.target.getAttribute('data-tab'));
        });
    });

    // Shop Management Events
    const addNewShopBtn = document.getElementById('addNewShopBtn');
    if (addNewShopBtn) addNewShopBtn.onclick = addNewShop;

    const closeShopModalBtn = document.getElementById('closeShopModalBtn');
    if (closeShopModalBtn) closeShopModalBtn.onclick = closeShopModal;

    const saveShopBtn = document.getElementById('saveShopBtn');
    if (saveShopBtn) saveShopBtn.onclick = saveShop;

    const deleteShopBtn = document.getElementById('deleteShopBtn');
    if (deleteShopBtn) deleteShopBtn.onclick = deleteShop;

    // Ingredient Management Events
    const addNewIngredientBtn = document.getElementById('addNewIngredientBtn');
    if (addNewIngredientBtn) addNewIngredientBtn.onclick = addNewIngredient;

    const closeIngredientModalBtn = document.getElementById('closeIngredientModalBtn');
    if (closeIngredientModalBtn) closeIngredientModalBtn.onclick = closeIngredientModal;

    const saveIngredientBtn = document.getElementById('saveIngredientBtn');
    if (saveIngredientBtn) saveIngredientBtn.onclick = saveIngredient;

    const deleteIngredientBtn = document.getElementById('deleteIngredientBtn');
    if (deleteIngredientBtn) deleteIngredientBtn.onclick = deleteIngredient;

    // Recipe Management Events
    const addRecipeIngredientRowBtn = document.getElementById('addRecipeIngredientRowBtn');
    if (addRecipeIngredientRowBtn) addRecipeIngredientRowBtn.onclick = addRecipeIngredientRow;

    const addNewRecipeBtn = document.getElementById('addNewRecipeBtn');
    if (addNewRecipeBtn) addNewRecipeBtn.onclick = addNewRecipe;

    const newRecipeCategory = document.getElementById('newRecipeCategory');
    if (newRecipeCategory) {
        newRecipeCategory.addEventListener('change', () => {
            refreshRecipeIngredientFilters();
        });
    }

    const closeRecipeModalBtn = document.getElementById('closeRecipeModalBtn');
    if (closeRecipeModalBtn) closeRecipeModalBtn.onclick = closeRecipeModal;

    const saveRecipeBtn = document.getElementById('saveRecipeBtn');
    if (saveRecipeBtn) saveRecipeBtn.onclick = saveRecipe;

    const editRecipeCategory = document.getElementById('editRecipeCategory');
    if (editRecipeCategory) {
        editRecipeCategory.addEventListener('change', () => {
            refreshRecipeIngredientFilters();
        });
    }

    const deleteRecipeBtn = document.getElementById('deleteRecipeBtn');
    if (deleteRecipeBtn) deleteRecipeBtn.onclick = deleteRecipe;

    const addEditRecipeIngredientRowBtn = document.getElementById('addEditRecipeIngredientRowBtn');
    if (addEditRecipeIngredientRowBtn) addEditRecipeIngredientRowBtn.onclick = addEditRecipeIngredientRow;

    const recipeIngredientsRows = document.getElementById('recipeIngredientsRows');
    if (recipeIngredientsRows) {
        recipeIngredientsRows.addEventListener('change', (event) => {
            const target = event.target;
            if (target && target.classList.contains('recipeIngredientCategory')) {
                refreshRecipeIngredientRow(target.closest('.recipe-ingredient-row'), '.recipeIngredientCategory', '.recipeIngredient');
            }
        });
    }

    const editRecipeIngredientsRows = document.getElementById('editRecipeIngredientsRows');
    if (editRecipeIngredientsRows) {
        editRecipeIngredientsRows.addEventListener('change', (event) => {
            const target = event.target;
            if (target && target.classList.contains('editRecipeIngredientCategory')) {
                refreshRecipeIngredientRow(target.closest('.edit-recipe-ingredient-row'), '.editRecipeIngredientCategory', '.editRecipeIngredient');
            }
        });
    }

    const toggleShopSecretsBtn = document.getElementById('toggleShopSecretsBtn');
    if (toggleShopSecretsBtn) toggleShopSecretsBtn.onclick = toggleShopSecrets;

    // Load initial data
    loadShops();
    loadIngredients();
    loadRecipes();
    syncRecipeIngredientFilters();
}

function switchTab(tabId) {
    // Remove active class from all tabs
    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Add active class to selected tab
    const selectedPane = document.getElementById(tabId);
    if (selectedPane) {
        selectedPane.classList.add('active');
    }

    // Add active class to button
    document.querySelector(`.tab-btn[data-tab="${tabId}"]`)?.classList.add('active');

    // Refresh data when switching tabs
    if (tabId === 'shops') loadShops();
    else if (tabId === 'ingredients-mgmt') loadIngredients();
    else if (tabId === 'recipes-mgmt') {
        loadRecipes();
        syncRecipeIngredientFilters();
    }
}

// ==================== SHOP MANAGEMENT ====================

async function loadShops() {
    const loadingDiv = document.getElementById('shopsLoading');
    const table = document.getElementById('shopsTable');
    const tbody = table?.querySelector('tbody');

    if (!loadingDiv || !table || !tbody) return;

    try {
        loadingDiv.style.display = 'block';
        table.style.display = 'none';

        // Get shops from API or mock data
        const shops = await fetchShops(shopSecretsUnlocked);

        tbody.innerHTML = '';
        shops.forEach(shop => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><span class="shop-id-text">${escapeHtml(shop.shop_id || '')}</span></td>
                <td>${escapeHtml(shop.shop_name || '')}</td>
                <td>
                    <span class="secret-password">${shopSecretsUnlocked ? escapeHtml(shop.administrator_password || '') : '••••••••'}</span>
                </td>
                <td>
                    <span class="secret-password">${shopSecretsUnlocked ? escapeHtml(shop.staff_password || '') : '••••••••'}</span>
                </td>
                <td>
                    <button class="action-btn btn-edit" onclick="editShop('${escapeHtml(shop.shop_id)}')">✏️ Sửa</button>
                </td>
            `;
            tbody.appendChild(row);
        });

        updateToggleShopSecretsButton();

        loadingDiv.style.display = 'none';
        table.style.display = 'table';
    } catch (error) {
        loadingDiv.innerHTML = `<div class="error">Lỗi: ${error.message}</div>`;
    }
}

async function fetchShops(includePasswords = false) {
    if (window.dbApi && window.dbApi.getShops) {
        return await window.dbApi.getShops(includePasswords);
    }
    // Fallback to mock data or return empty array
    return [];
}

function applySecretVisibility() {
    document.querySelectorAll('.secret-password').forEach((field) => {
        field.style.fontFamily = 'monospace';
        field.style.letterSpacing = '0.03em';
    });

    document.querySelectorAll('.shop-id-text').forEach((field) => {
        field.style.fontFamily = 'monospace';
        field.style.letterSpacing = '0.03em';
        field.style.fontWeight = '600';
    });
}

function updateToggleShopSecretsButton() {
    const button = document.getElementById('toggleShopSecretsBtn');
    if (!button) return;
    button.textContent = shopSecretsUnlocked ? '🙈 Ẩn thông tin' : '🔐 Hiện thông tin';
}

async function toggleShopSecrets() {
    if (!shopSecretsUnlocked) {
        const session = window.dbApi?.getSession?.();
        const masterId = session?.masterId || '';
        if (!masterId) {
            alert('Không tìm thấy master_id trong phiên đăng nhập');
            return;
        }

        const masterPassword = prompt('Nhập mật khẩu master để hiện thông tin chi nhánh');
        if (!masterPassword) return;

        try {
            await window.dbApi.masterLogin({ masterId, password: masterPassword });
            shopSecretsUnlocked = true;
            await loadShops();
        } catch (error) {
            alert(error?.message || 'Xác thực master thất bại');
        }
        return;
    }

    shopSecretsUnlocked = false;
    await loadShops();
}

async function addNewShop() {
    const shopId = document.getElementById('newShopId').value.trim();
    const shopName = document.getElementById('newShopName').value.trim();
    const adminPassword = document.getElementById('newAdminPassword').value.trim();
    const staffPassword = document.getElementById('newStaffPassword').value.trim();

    if (!shopId) {
        alert('Nhập Shop ID');
        return;
    }
    if (!shopName) {
        alert('Nhập Tên Chi nhánh');
        return;
    }
    if (!adminPassword) {
        alert('Nhập Mật khẩu Administrator');
        return;
    }
    if (!staffPassword) {
        alert('Nhập Mật khẩu Staff');
        return;
    }

    try {
        if (window.dbApi && window.dbApi.createShop) {
            await window.dbApi.createShop({
                shop_id: shopId,
                shop_name: shopName,
                administrator_password: adminPassword,
                staff_password: staffPassword
            });
        }

        alert('Đã thêm chi nhánh mới thành công');
        document.getElementById('newShopId').value = '';
        document.getElementById('newShopName').value = '';
        document.getElementById('newAdminPassword').value = '';
        document.getElementById('newStaffPassword').value = '';

        loadShops();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

async function editShop(shopId) {
    try {
        const shops = await fetchShops();
        const shop = shops.find(s => s.shop_id === shopId);

        if (!shop) {
            alert('Không tìm thấy chi nhánh');
            return;
        }

        currentEditingShopId = shopId;
        document.getElementById('editShopId').value = shop.shop_id;
        document.getElementById('editShopName').value = shop.shop_name || '';
        document.getElementById('editAdminPassword').value = shop.administrator_password || '';
        document.getElementById('editStaffPassword').value = shop.staff_password || '';

        const modal = document.getElementById('shopEditModal');
        if (modal) modal.style.display = 'block';
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

function closeShopModal() {
    const modal = document.getElementById('shopEditModal');
    if (modal) modal.style.display = 'none';
    currentEditingShopId = null;
}

async function saveShop() {
    if (!currentEditingShopId) return;

    const shopName = document.getElementById('editShopName').value.trim();
    const adminPassword = document.getElementById('editAdminPassword').value.trim();
    const staffPassword = document.getElementById('editStaffPassword').value.trim();

    if (!shopName) {
        alert('Nhập Tên Chi nhánh');
        return;
    }
    if (!adminPassword) {
        alert('Nhập Mật khẩu Administrator');
        return;
    }
    if (!staffPassword) {
        alert('Nhập Mật khẩu Staff');
        return;
    }

    try {
        if (window.dbApi && window.dbApi.updateShop) {
            await window.dbApi.updateShop(currentEditingShopId, {
                shop_name: shopName,
                administrator_password: adminPassword,
                staff_password: staffPassword
            });
        }

        alert('Đã lưu thay đổi thành công');
        closeShopModal();
        loadShops();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

async function deleteShop() {
    if (!currentEditingShopId) return;

    if (!confirm('Bạn có chắc muốn xóa chi nhánh này? Hành động này không thể hoàn tác.')) {
        return;
    }

    try {
        if (window.dbApi && window.dbApi.deleteShop) {
            await window.dbApi.deleteShop(currentEditingShopId);
        }

        alert('Đã xóa chi nhánh thành công');
        closeShopModal();
        loadShops();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

// ==================== INGREDIENT MANAGEMENT ====================

async function loadIngredients() {
    const loadingDiv = document.getElementById('ingredientsLoadingMgmt');
    const table = document.getElementById('ingredientsMgmtTable');
    const tbody = table?.querySelector('tbody');

    if (!loadingDiv || !table || !tbody) return;

    try {
        loadingDiv.style.display = 'block';
        table.style.display = 'none';

        const ingredients = await fetchIngredients();

        // Cache ingredients globally
        window.dbIngredientCatalog = ingredients;

        tbody.innerHTML = '';
        ingredients.forEach(ingredient => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${escapeHtml(ingredient.name || '')}</td>
                <td>${escapeHtml(ingredient.category || '')}</td>
                <td>${escapeHtml(ingredient.unit || '')}</td>
                <td>
                    <button class="action-btn btn-edit" onclick="editIngredient(${ingredient.id})">✏️ Sửa</button>
                </td>
            `;
            tbody.appendChild(row);
        });

        // Populate ingredient selectors
        updateIngredientSelectors(ingredients);
        syncRecipeIngredientFilters();

        loadingDiv.style.display = 'none';
        table.style.display = 'table';
    } catch (error) {
        loadingDiv.innerHTML = `<div class="error">Lỗi: ${error.message}</div>`;
    }
}

async function fetchIngredients() {
    if (window.dbApi && window.dbApi.getIngredients) {
        return await window.dbApi.getIngredients();
    }
    if (window.dbIngredientCatalog) {
        return window.dbIngredientCatalog;
    }
    return [];
}

function updateIngredientSelectors(ingredients) {
    refreshRecipeIngredientFilters();
}

function syncRecipeIngredientFilters() {
    refreshRecipeIngredientFilters();
}

async function addNewIngredient() {
    const name = document.getElementById('newIngredientName').value.trim();
    const category = document.getElementById('newIngredientCategory').value.trim();
    const unit = document.getElementById('newIngredientUnit').value.trim();

    if (!name) {
        alert('Nhập Tên Nguyên liệu');
        return;
    }
    if (!unit) {
        alert('Nhập Đơn vị');
        return;
    }

    try {
        if (window.dbApi && window.dbApi.addIngredient) {
            await window.dbApi.addIngredient({
                name,
                category: category || 'Khác',
                unit
            });
        }

        alert('Đã thêm nguyên liệu mới thành công');
        document.getElementById('newIngredientName').value = '';
        document.getElementById('newIngredientCategory').value = '';
        document.getElementById('newIngredientUnit').value = '';

        loadIngredients();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

async function editIngredient(ingredientId) {
    try {
        const ingredients = await fetchIngredients();
        const ingredient = ingredients.find(i => i.id === ingredientId);

        if (!ingredient) {
            alert('Không tìm thấy nguyên liệu');
            return;
        }

        currentEditingIngredientId = ingredientId;
        document.getElementById('editIngredientName').value = ingredient.name || '';
        document.getElementById('editIngredientCategory').value = ingredient.category || '';
        document.getElementById('editIngredientUnit').value = ingredient.unit || '';

        const modal = document.getElementById('ingredientEditModal');
        if (modal) modal.style.display = 'block';
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

function closeIngredientModal() {
    const modal = document.getElementById('ingredientEditModal');
    if (modal) modal.style.display = 'none';
    currentEditingIngredientId = null;
}

async function saveIngredient() {
    if (!currentEditingIngredientId) return;

    const name = document.getElementById('editIngredientName').value.trim();
    const category = document.getElementById('editIngredientCategory').value.trim();
    const unit = document.getElementById('editIngredientUnit').value.trim();

    if (!name) {
        alert('Nhập Tên Nguyên liệu');
        return;
    }
    if (!unit) {
        alert('Nhập Đơn vị');
        return;
    }

    try {
        if (window.dbApi && window.dbApi.updateIngredient) {
            await window.dbApi.updateIngredient(currentEditingIngredientId, {
                name,
                category: category || 'Khác',
                unit
            });
        }

        alert('Đã lưu thay đổi thành công');
        closeIngredientModal();
        loadIngredients();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

async function deleteIngredient() {
    if (!currentEditingIngredientId) return;

    if (!confirm('Bạn có chắc muốn xóa nguyên liệu này? Hành động này không thể hoàn tác.')) {
        return;
    }

    try {
        if (window.dbApi && window.dbApi.deleteIngredient) {
            await window.dbApi.deleteIngredient(currentEditingIngredientId);
        }

        alert('Đã xóa nguyên liệu thành công');
        closeIngredientModal();
        loadIngredients();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

// ==================== RECIPE MANAGEMENT ====================

function addRecipeIngredientRow() {
    const container = document.getElementById('recipeIngredientsRows');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'recipe-ingredient-row';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '1fr 2fr 1fr auto';
    row.style.gap = '10px';
    row.style.alignItems = 'center';

    const categorySelectHtml = buildIngredientCategoryOptionsHtml('');
    const selectHtml = buildIngredientOptionsHtml('');

    row.innerHTML = `
        <select class="recipeIngredientCategory" style="width:100%;">
            ${categorySelectHtml}
        </select>
        <select class="recipeIngredient" style="width:100%;">
            ${selectHtml}
        </select>
        <input type="number" class="recipeIngQuantity" placeholder="Số lượng" step="0.01" style="width:100%;">
        <button type="button" class="removeRecipeIngredientBtn" style="padding:6px 12px;">🗑️</button>
    `;

    row.querySelector('.recipeIngredientCategory').addEventListener('change', () => {
        refreshRecipeIngredientRow(row, '.recipeIngredientCategory', '.recipeIngredient');
    });

    row.querySelector('.removeRecipeIngredientBtn').onclick = () => {
        const rows = document.querySelectorAll('#recipeIngredientsRows .recipe-ingredient-row');
        if (rows.length <= 1) return;
        row.remove();
    };

    container.appendChild(row);
}

function addEditRecipeIngredientRow() {
    const container = document.getElementById('editRecipeIngredientsRows');
    if (!container) return;

    const row = document.createElement('div');
    row.className = 'edit-recipe-ingredient-row';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '1fr 2fr 1fr auto';
    row.style.gap = '10px';
    row.style.alignItems = 'center';

    const categorySelectHtml = buildIngredientCategoryOptionsHtml('');
    const selectHtml = buildIngredientOptionsHtml('');

    row.innerHTML = `
        <select class="editRecipeIngredientCategory" style="width:100%;">
            ${categorySelectHtml}
        </select>
        <select class="editRecipeIngredient" style="width:100%;">
            ${selectHtml}
        </select>
        <input type="number" class="editRecipeIngQuantity" placeholder="Số lượng" step="0.01" style="width:100%;">
        <button type="button" class="removeEditRecipeIngredientBtn" style="padding:6px 12px;">🗑️</button>
    `;

    row.querySelector('.editRecipeIngredientCategory').addEventListener('change', () => {
        refreshRecipeIngredientRow(row, '.editRecipeIngredientCategory', '.editRecipeIngredient');
    });

    row.querySelector('.removeEditRecipeIngredientBtn').onclick = () => {
        const rows = document.querySelectorAll('#editRecipeIngredientsRows .edit-recipe-ingredient-row');
        if (rows.length <= 1) return;
        row.remove();
    };

    container.appendChild(row);
}

function buildIngredientOptionsHtml(category = '') {
    const normalizedCategory = String(category || '').trim().toLowerCase();
    const ingredients = Array.isArray(window.dbIngredientCatalog) ? window.dbIngredientCatalog : [];
    const filteredIngredients = normalizedCategory
        ? ingredients.filter((ingredient) => String(ingredient.category || '').trim().toLowerCase() === normalizedCategory)
        : ingredients;

    return ['<option value="">-- Chọn nguyên liệu --</option>']
        .concat(filteredIngredients.map((ingredient) => {
            const label = `${ingredient.name}${ingredient.unit ? ` (${ingredient.unit})` : ''}`;
            return `<option value="${ingredient.id}">${escapeHtml(label)}</option>`;
        }))
        .join('');
}

function buildIngredientCategoryOptionsHtml(selectedCategory = '') {
    const categories = ['Bột', 'Đường', 'Trứng', 'Bơ', 'Sữa', 'Nước', 'Hương liệu', 'Khác'];
    const normalizedSelectedCategory = String(selectedCategory || '').trim().toLowerCase();

    return ['<option value="">-- Chọn category --</option>']
        .concat(categories.map((category) => {
            const selected = String(category).trim().toLowerCase() === normalizedSelectedCategory ? ' selected' : '';
            return `<option value="${escapeHtml(category)}"${selected}>${escapeHtml(category)}</option>`;
        }))
        .join('');
}

function refreshRecipeIngredientRow(row, categorySelector, ingredientSelector) {
    if (!row) return;

    const categoryValue = row.querySelector(categorySelector)?.value || '';
    const ingredientSelect = row.querySelector(ingredientSelector);
    if (!ingredientSelect) return;

    const currentValue = ingredientSelect.value;
    ingredientSelect.innerHTML = buildIngredientOptionsHtml(categoryValue);
    ingredientSelect.value = currentValue;
}

function refreshRecipeIngredientFilters() {
    document.querySelectorAll('#recipeIngredientsRows .recipe-ingredient-row').forEach((row) => {
        refreshRecipeIngredientRow(row, '.recipeIngredientCategory', '.recipeIngredient');
    });

    document.querySelectorAll('#editRecipeIngredientsRows .edit-recipe-ingredient-row').forEach((row) => {
        refreshRecipeIngredientRow(row, '.editRecipeIngredientCategory', '.editRecipeIngredient');
    });
}

function refreshRecipeIngredientRows(category, containerSelector, ingredientSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;

    const rows = Array.from(container.querySelectorAll(ingredientSelector));
    rows.forEach((selector) => {
        const currentValue = selector.value;
        selector.innerHTML = buildIngredientOptionsHtml(category);
        selector.value = currentValue;
    });
}

async function loadRecipes() {
    const loadingDiv = document.getElementById('recipesMgmtLoading');
    const table = document.getElementById('recipesMgmtTable');
    const tbody = table?.querySelector('tbody');

    if (!loadingDiv || !table || !tbody) return;

    try {
        loadingDiv.style.display = 'block';
        table.style.display = 'none';

        const recipes = await fetchRecipes();

        tbody.innerHTML = '';
        recipes.forEach(recipe => {
            const row = document.createElement('tr');
            const ingredientCount = recipe.ingredients ? Object.keys(recipe.ingredients).length : 0;
            row.innerHTML = `
                <td>${escapeHtml(recipe.name || '')}</td>
                <td>${escapeHtml(recipe.category || '')}</td>
                <td>${ingredientCount}</td>
                <td>
                    <button class="action-btn btn-edit" onclick="editRecipe(${recipe.id})">✏️ Sửa</button>
                </td>
            `;
            tbody.appendChild(row);
        });

        loadingDiv.style.display = 'none';
        table.style.display = 'table';
    } catch (error) {
        loadingDiv.innerHTML = `<div class="error">Lỗi: ${error.message}</div>`;
    }
}

async function fetchRecipes() {
    if (window.dbApi && window.dbApi.getRecipes) {
        return await window.dbApi.getRecipes();
    }
    if (window.dbRecipes) {
        return window.dbRecipes;
    }
    return [];
}

async function addNewRecipe() {
    const name = document.getElementById('newRecipeName').value.trim();
    const category = document.getElementById('newRecipeCategory').value.trim();
    const description = document.getElementById('newRecipeDescription').value.trim();

    if (!name) {
        alert('Nhập Tên Công thức');
        return;
    }

    // Collect ingredients
    const ingredientRows = document.querySelectorAll('#recipeIngredientsRows .recipe-ingredient-row');
    const ingredients = [];

    for (const row of ingredientRows) {
        const ingredientId = row.querySelector('.recipeIngredient').value;
        const quantity = parseFloat(row.querySelector('.recipeIngQuantity').value);

        if (!ingredientId || !quantity || quantity <= 0) continue;

        ingredients.push({
            ingredientId: Number(ingredientId),
            quantity
        });
    }

    if (ingredients.length === 0) {
        alert('Thêm ít nhất 1 nguyên liệu');
        return;
    }

    try {
        if (window.dbApi && window.dbApi.addRecipe) {
            await window.dbApi.addRecipe({
                name,
                category: category || 'Khác',
                description,
                ingredients
            });
        }

        alert('Đã thêm công thức mới thành công');
        document.getElementById('newRecipeName').value = '';
        document.getElementById('newRecipeCategory').value = '';
        document.getElementById('newRecipeDescription').value = '';
        const container = document.getElementById('recipeIngredientsRows');
        if (container) {
            container.innerHTML = '';
            addRecipeIngredientRow();
        }

        refreshRecipeIngredientFilters();

        loadRecipes();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

async function editRecipe(recipeId) {
    try {
        const recipes = await fetchRecipes();
        const recipe = recipes.find(r => r.id === recipeId);

        if (!recipe) {
            alert('Không tìm thấy công thức');
            return;
        }

        currentEditingRecipeId = recipeId;
        document.getElementById('editRecipeName').value = recipe.name || '';
        document.getElementById('editRecipeCategory').value = recipe.category || '';
        document.getElementById('editRecipeDescription').value = recipe.description || '';

        // Load ingredients
        const container = document.getElementById('editRecipeIngredientsRows');
        if (container) {
            container.innerHTML = '';

            if (recipe.ingredients && typeof recipe.ingredients === 'object') {
                Object.entries(recipe.ingredients).forEach(([ingName, quantity]) => {
                    const ing = (window.dbIngredientCatalog || []).find(i => i.name === ingName);
                    if (ing) {
                        const row = document.createElement('div');
                        row.className = 'edit-recipe-ingredient-row';
                        row.style.display = 'grid';
                        row.style.gridTemplateColumns = '1fr 2fr 1fr auto';
                        row.style.gap = '10px';
                        row.style.alignItems = 'center';

                        const categorySelectHtml = buildIngredientCategoryOptionsHtml(ing.category || '');
                        const selectHtml = buildIngredientOptionsHtml(ing.category || '');

                        row.innerHTML = `
                            <select class="editRecipeIngredientCategory" style="width:100%;">
                                ${categorySelectHtml}
                            </select>
                            <select class="editRecipeIngredient" style="width:100%;">
                                ${selectHtml}
                            </select>
                            <input type="number" class="editRecipeIngQuantity" placeholder="Số lượng" step="0.01" style="width:100%;">
                            <button type="button" class="removeEditRecipeIngredientBtn" style="padding:6px 12px;">🗑️</button>
                        `;

                        row.querySelector('.editRecipeIngredientCategory').addEventListener('change', () => {
                            refreshRecipeIngredientRow(row, '.editRecipeIngredientCategory', '.editRecipeIngredient');
                        });

                        row.querySelector('.editRecipeIngredient').value = ing.id;
                        row.querySelector('.editRecipeIngQuantity').value = quantity;

                        row.querySelector('.removeEditRecipeIngredientBtn').onclick = () => {
                            const rows = document.querySelectorAll('#editRecipeIngredientsRows .edit-recipe-ingredient-row');
                            if (rows.length <= 1) return;
                            row.remove();
                        };

                        container.appendChild(row);
                    }
                });
            }

            if (container.children.length === 0) {
                addEditRecipeIngredientRow();
            }
        }

        const modal = document.getElementById('recipeEditModal');
        if (modal) modal.style.display = 'block';

        refreshRecipeIngredientFilters();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

function closeRecipeModal() {
    const modal = document.getElementById('recipeEditModal');
    if (modal) modal.style.display = 'none';
    currentEditingRecipeId = null;
}

async function saveRecipe() {
    if (!currentEditingRecipeId) return;

    const name = document.getElementById('editRecipeName').value.trim();
    const category = document.getElementById('editRecipeCategory').value.trim();
    const description = document.getElementById('editRecipeDescription').value.trim();

    if (!name) {
        alert('Nhập Tên Công thức');
        return;
    }

    // Collect ingredients
    const ingredientRows = document.querySelectorAll('#editRecipeIngredientsRows .edit-recipe-ingredient-row');
    const ingredients = [];

    for (const row of ingredientRows) {
        const ingredientId = row.querySelector('.editRecipeIngredient').value;
        const quantity = parseFloat(row.querySelector('.editRecipeIngQuantity').value);

        if (!ingredientId || !quantity || quantity <= 0) continue;

        ingredients.push({
            ingredientId: Number(ingredientId),
            quantity
        });
    }

    if (ingredients.length === 0) {
        alert('Thêm ít nhất 1 nguyên liệu');
        return;
    }

    try {
        if (window.dbApi && window.dbApi.updateRecipe) {
            await window.dbApi.updateRecipe(currentEditingRecipeId, {
                name,
                category: category || 'Khác',
                description,
                ingredients
            });
        }

        alert('Đã lưu thay đổi thành công');
        closeRecipeModal();
        loadRecipes();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

async function deleteRecipe() {
    if (!currentEditingRecipeId) return;

    if (!confirm('Bạn có chắc muốn xóa công thức này? Hành động này không thể hoàn tác.')) {
        return;
    }

    try {
        if (window.dbApi && window.dbApi.deleteRecipe) {
            await window.dbApi.deleteRecipe(currentEditingRecipeId);
        }

        alert('Đã xóa công thức thành công');
        closeRecipeModal();
        loadRecipes();
    } catch (error) {
        alert('Lỗi: ' + error.message);
    }
}

// ==================== UTILITY FUNCTIONS ====================

function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

// Close modals when clicking outside
document.addEventListener('click', (e) => {
    const shopModal = document.getElementById('shopEditModal');
    if (shopModal && e.target === shopModal) {
        closeShopModal();
    }

    const ingredientModal = document.getElementById('ingredientEditModal');
    if (ingredientModal && e.target === ingredientModal) {
        closeIngredientModal();
    }

    const recipeModal = document.getElementById('recipeEditModal');
    if (recipeModal && e.target === recipeModal) {
        closeRecipeModal();
    }
});
