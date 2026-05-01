function renderIngredientsTable() {
    const loading = document.getElementById('ingredientsLoading');
    const table = document.getElementById('ingredientsTable');
    const tbody = table?.querySelector('tbody');
    if (!tbody) return;

    if (!Array.isArray(window.dbIngredientStock)) {
        loading.style.display = 'block';
        table.style.display = 'none';
        loading.innerHTML = 'Đang tải...';
        return;
    }

    if (!window.dbIngredientStock.length) {
        loading.style.display = 'block';
        table.style.display = 'none';
        loading.innerHTML = 'Chưa có nguyên liệu';
        return;
    }

    loading.style.display = 'none';
    table.style.display = 'table';
    tbody.innerHTML = '';

    window.dbIngredientStock.forEach(ing => {
        const row = tbody.insertRow();
        row.insertCell(0).innerText = ing.name;
        row.insertCell(1).innerText = ing.unit || '';
        row.insertCell(2).innerText = Number(ing.avg_unit_price_month || 0).toLocaleString() + ' đ';
    });
}

function renderIngredientSelect() {
    const options = (window.dbIngredientCatalog || []).map(i => `<option value="${i.id}" data-unit="${i.unit || ''}">${i.name}</option>`).join('');
    document.querySelectorAll('#importRows .ingName').forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">-- Chọn nguyên liệu --</option>' + options;
        if (currentValue) select.value = currentValue;
    });
}

function renderRecipeCategoryOptions() {
    const categories = [...new Set((window.dbIngredientCatalog || []).map(i => (i.category || '').trim()).filter(Boolean))].sort();
    const options = categories.map(c => `<option value="${c}">${c}</option>`).join('');
    document.querySelectorAll('#recipeRows .recCategory').forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">-- Chọn category --</option>' + options;
        if (currentValue && categories.includes(currentValue)) {
            select.value = currentValue;
        }
    });
}

function renderRecipeIngredientOptions(row) {
    if (!row) return;
    const catSelect = row.querySelector('.recCategory');
    const ingSelect = row.querySelector('.recIngredient');
    if (!catSelect || !ingSelect) return;

    const selectedCategory = catSelect.value;
    const currentValue = ingSelect.value;
    const ingredients = (window.dbIngredientCatalog || []).filter(i => (i.category || '') === selectedCategory);
    const options = ingredients.map(i => `<option value="${i.id}">${i.name}</option>`).join('');
    ingSelect.innerHTML = '<option value="">-- Chọn nguyên liệu --</option>' + options;
    if (currentValue && ingredients.some(i => String(i.id) === currentValue)) {
        ingSelect.value = currentValue;
    }
}

function renderRecipeRows() {
    renderRecipeCategoryOptions();
    document.querySelectorAll('#recipeRows .recipe-row').forEach(row => renderRecipeIngredientOptions(row));
}

function renderImportsTable() {
    const loading = document.getElementById('importsLoading');
    const table = document.getElementById('importsTable');
    const tbody = table?.querySelector('tbody');
    if (!loading || !table || !tbody) return;

    if (!Array.isArray(window.dbIngredientImports)) {
        loading.style.display = 'block';
        table.style.display = 'none';
        loading.innerHTML = 'Đang tải...';
        return;
    }

    if (!window.dbIngredientImports.length) {
        loading.style.display = 'block';
        table.style.display = 'none';
        loading.innerHTML = 'Chưa có lịch sử nhập hàng';
        return;
    }

    loading.style.display = 'none';
    table.style.display = 'table';
    tbody.innerHTML = '';

    window.dbIngredientImports.forEach(item => {
        const row = tbody.insertRow();
        row.insertCell(0).innerText = item.import_date || '';
        row.insertCell(1).innerText = item.ingredient_name || '';
        row.insertCell(2).innerText = `${Number(item.quantity || 0).toFixed(2)} ${item.unit || ''}`;
        row.insertCell(3).innerText = Number(item.total_money || item.unit_price || 0).toLocaleString() + ' đ';
    });
}

async function refreshIngredientTabData() {
    const loading = document.getElementById('ingredientsLoading');
    if (loading) {
        loading.style.display = 'block';
        loading.innerHTML = 'Đang tải...';
    }

    try {
        if (!window.dbApi) throw new Error('Thiếu cấu hình API');
        const [catalog, stock, imports] = await Promise.all([
            window.dbApi.ingredientCatalog(),
            window.dbApi.ingredientStock(),
            window.dbApi.ingredientImports()
        ]);

        window.dbIngredientCatalog = Array.isArray(catalog) ? catalog : [];
        window.dbIngredientStock = Array.isArray(stock) ? stock : [];
        window.dbIngredientImports = Array.isArray(imports) ? imports : [];
        userIngredients = window.dbIngredientStock;

        renderIngredientSelect();
        renderRecipeRows();
        renderIngredientsTable();
        renderStockTable();
        renderImportsTable();
    } catch (_e) {
        if (loading) {
            loading.style.display = 'block';
            loading.innerHTML = 'Không tải được dữ liệu kho nguyên liệu';
        }

        const importsLoading = document.getElementById('importsLoading');
        if (importsLoading) {
            importsLoading.style.display = 'block';
            importsLoading.innerHTML = 'Không tải được lịch sử nhập hàng';
        }
    }
}

async function checkImportHistoryByDate() {
    const fromDate = document.getElementById('from_date')?.value || '';
    const toDate = document.getElementById('to_date')?.value || '';

    if (fromDate && toDate && fromDate > toDate) {
        alert('from_date phải nhỏ hơn hoặc bằng to_date');
        return;
    }

    const loading = document.getElementById('importsLoading');
    if (loading) {
        loading.style.display = 'block';
        loading.innerHTML = 'Đang tải...';
    }

    try {
        const imports = await window.dbApi.ingredientImports(fromDate, toDate);
        window.dbIngredientImports = Array.isArray(imports) ? imports : [];
        renderImportsTable();
    } catch (_e) {
        if (loading) {
            loading.style.display = 'block';
            loading.innerHTML = 'Không tải được lịch sử nhập hàng';
        }
    }
}

async function refreshRecipesData() {
    const container = document.getElementById('recipesList');
    if (container) container.innerHTML = 'Đang tải...';

    try {
        const recipes = await window.dbApi.recipes();
        window.dbRecipes = Array.isArray(recipes) ? recipes : [];
        userRecipes = window.dbRecipes;
        renderRecipesList();
        updateSelects();
        renderProfitReport();
    } catch (_e) {
        if (container) container.innerHTML = '<p>Không tải được danh sách công thức</p>';
    }
}

function openRecipeModal(recipeDetail) {
    const modal = document.getElementById('recipeDetailModal');
    const title = document.getElementById('recipeDetailTitle');
    const body = document.getElementById('recipeDetailBody');
    if (!modal || !title || !body) return;

    window.currentRecipeProductId = recipeDetail?.product?.id || null;
    title.innerText = `🍪 ${recipeDetail?.product?.name || 'Công thức'}`;

    const desc = recipeDetail?.product?.description || 'Không có mô tả';
    const ingredients = Array.isArray(recipeDetail?.ingredients) ? recipeDetail.ingredients : [];

    const lines = ingredients.map(i => `
        <tr>
            <td>${i.ingredient_name}</td>
            <td>${Number(i.quantity_needed || 0).toFixed(2)} ${i.unit || ''}</td>
            <td>${Number(i.unit_price || 0).toLocaleString()} đ</td>
            <td>${Number(i.line_cost || 0).toLocaleString()} đ</td>
        </tr>
    `).join('');

    body.innerHTML = `
        <p><strong>Cách làm:</strong> ${desc}</p>
        <table>
            <thead><tr><th>Nguyên liệu</th><th>Định lượng</th><th>Đơn giá vi mô</th><th>Chi phí</th></tr></thead>
            <tbody>${lines}</tbody>
            <tfoot><tr><td colspan="3"><strong>Tổng cost</strong></td><td><strong>${Number(recipeDetail?.cost || 0).toLocaleString()} đ</strong></td></tr></tfoot>
        </table>
    `;

    modal.style.display = 'block';
}

function closeRecipeModal() {
    const modal = document.getElementById('recipeDetailModal');
    if (modal) modal.style.display = 'none';
    window.currentRecipeProductId = null;
}

function renderRecipesList() {
    const container = document.getElementById('recipesList');
    const recipes = Array.isArray(window.dbRecipes) ? window.dbRecipes : [];

    if (!recipes.length) {
        container.innerHTML = '<p>Chưa có công thức</p>';
        return;
    }

    let html = '<table><thead><tr><th>Tên</th><th>Cost</th><th>Chi tiết</th></tr></thead><tbody>';
    recipes.forEach(rec => {
        html += `
            <tr>
                <td>${rec.name}</td>
                <td>${Number(rec.cost || 0).toLocaleString()} đ</td>
                <td><button class="open-recipe-detail" data-id="${rec.id}" title="Xem chi tiết">📖</button></td>
            </tr>
        `;
    });
    html += '</tbody></table>';
    container.innerHTML = html;

    document.querySelectorAll('.open-recipe-detail').forEach(btn => {
        btn.onclick = async () => {
            const id = parseInt(btn.getAttribute('data-id'));
            try {
                const detail = await window.dbApi.recipeDetail(id);
                openRecipeModal(detail);
            } catch (_e) {
                alert('Không tải được chi tiết công thức');
            }
        };
    });
}

function renderStockTable() {
    const loading = document.getElementById('stockLoading');
    const table = document.getElementById('stockTable');
    const tbody = table?.querySelector('tbody');
    if (!tbody) return;

    if (!userIngredients.length) {
        loading.style.display = 'block';
        table.style.display = 'none';
        return;
    }

    loading.style.display = 'none';
    table.style.display = 'table';
    tbody.innerHTML = '';

    userIngredients.forEach(ing => {
        const row = tbody.insertRow();
        row.insertCell(0).innerText = ing.name;
        row.insertCell(1).innerText = `${ing.quantity.toFixed(2)} ${ing.unit}`;
    });
}

function renderProfitReport() {
    const container = document.getElementById('profitReport');
    if (!userSalesHistory.length) {
        container.innerHTML = '<p>Chưa có dữ liệu bán hàng</p>';
        return;
    }

    let totalRevenue = 0, totalCost = 0;
    let html = '<table><thead><tr><th>Sản phẩm</th><th>Số lượng</th><th>Giá bán</th><th>Cost/SP</th><th>Lợi nhuận</th></tr></thead><tbody>';
    userSalesHistory.forEach(s => {
        const profit = (s.sellPrice - s.costPerUnit) * s.quantity;
        totalRevenue += s.totalRevenue;
        totalCost += s.totalCost;
        html += `<tr><td>${s.productName}</td><td>${s.quantity}</td><td>${s.sellPrice.toLocaleString()}đ</td><td>${s.costPerUnit.toLocaleString()}đ</td><td>${profit.toLocaleString()}đ</td></tr>`;
    });
    html += `</tbody><tfoot><tr><td colspan="4"><strong>Tổng doanh thu</strong></td><td><strong>${totalRevenue.toLocaleString()}đ</strong></td></tr>
             <tr><td colspan="4"><strong>Tổng chi phí</strong></td><td><strong>${totalCost.toLocaleString()}đ</strong></td></tr>
             <tr><td colspan="4"><strong>Lợi nhuận ròng</strong></td><td><strong style="color:#e67e22;">${(totalRevenue - totalCost).toLocaleString()}đ</strong></td></tr></tfoot>`;
    container.innerHTML = html;
}

function updateSelects() {
    const selects = ['prodSelect', 'maxProdSelect', 'profitProductSelect'];
    selects.forEach(id => {
        const sel = document.getElementById(id);
        if (sel) {
            const recipes = Array.isArray(window.dbRecipes) ? window.dbRecipes : [];
            sel.innerHTML = '<option value="">-- Chọn sản phẩm --</option>' + recipes.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
        }
    });
}

function renderAll() {
    renderIngredientsTable();
    renderRecipesList();
    renderStockTable();
    updateSelects();
    renderProfitReport();
}
