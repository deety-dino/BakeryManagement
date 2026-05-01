function createImportRow() {
    const row = document.createElement('div');
    row.className = 'import-row';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '2fr 1fr 1fr auto';
    row.style.gap = '15px';
    row.style.alignItems = 'center';
    row.innerHTML = `
        <select class="ingName" style="width:100%;">
            <option value="">-- Chọn nguyên liệu --</option>
        </select>
        <input type="number" class="ingQty" placeholder="Số lượng (g/ml)" style="width:100%;">
        <input type="number" class="ingPrice" placeholder="Tổng tiền (VNĐ)" style="width:100%;">
        <button type="button" class="removeImportRowBtn">🗑️</button>
    `;

    row.querySelector('.removeImportRowBtn')?.addEventListener('click', () => {
        const rows = document.querySelectorAll('#importRows .import-row');
        if (rows.length <= 1) return;
        row.remove();
    });

    return row;
}

const addImportRowBtn = document.getElementById('addImportRowBtn');
if (addImportRowBtn) addImportRowBtn.onclick = () => {
    const container = document.getElementById('importRows');
    if (!container) return;
    container.appendChild(createImportRow());
    renderIngredientSelect();
};

const submitImportsBtn = document.getElementById('submitImportsBtn');
if (submitImportsBtn) submitImportsBtn.onclick = async () => {
    const rows = Array.from(document.querySelectorAll('#importRows .import-row'));
    const items = rows.map((row, index) => ({
        index,
        ingredientId: parseInt(row.querySelector('.ingName')?.value),
        quantity: parseFloat(row.querySelector('.ingQty')?.value),
        totalMoney: parseFloat(row.querySelector('.ingPrice')?.value)
    }));

    if (!items.length) {
        alert('Chưa có dòng nhập hàng nào');
        return;
    }

    for (const item of items) {
        if (!item.ingredientId || !item.quantity || !item.totalMoney) {
            alert(`Dòng ${item.index + 1}: Nhập đầy đủ thông tin`);
            return;
        }
    }

    try {
        await window.dbApi.addIngredientImportsBatch({
            items: items.map(({ ingredientId, quantity, totalMoney }) => ({ ingredientId, quantity, totalMoney }))
        });
        await refreshIngredientTabData();

        const container = document.getElementById('importRows');
        if (container) {
            container.innerHTML = '';
            container.appendChild(createImportRow());
            renderIngredientSelect();
        }
    } catch (e) {
        alert('Lỗi khi nhập hàng: ' + (e?.message || String(e)));
    }
};

const checkImportsBtn = document.getElementById('checkImportsBtn');
if (checkImportsBtn) checkImportsBtn.onclick = async () => {
    await checkImportHistoryByDate();
};

const addNewIngredientBtn = document.getElementById('addNewIngredientBtn');
if (addNewIngredientBtn) addNewIngredientBtn.onclick = async () => {
    const name = document.getElementById('newIngName').value.trim();
    const category = document.getElementById('newIngCategory').value.trim();
    const unit = document.getElementById('newIngUnit').value.trim();

    if (!name) {
        alert('Nhập tên nguyên liệu mới');
        return;
    }
    if (!unit) {
        alert('Nhập đơn vị');
        return;
    }

    try {
        await window.dbApi.addIngredient({ name, category, unit });
        alert('Đã thêm nguyên liệu mới');
        document.getElementById('newIngName').value = '';
        document.getElementById('newIngCategory').value = '';
        document.getElementById('newIngUnit').value = '';
        await refreshIngredientTabData();
    } catch (e) {
        if ((e?.message || '').includes('đã tồn tại')) {
            alert('Nguyên liệu đã tồn tại');
            return;
        }
        alert('Lỗi khi thêm nguyên liệu mới: ' + (e?.message || String(e)));
    }
};

function createRecipeRow() {
    const row = document.createElement('div');
    row.className = 'recipe-row';
    row.style.display = 'grid';
    row.style.gridTemplateColumns = '1fr 2fr 1fr auto';
    row.style.gap = '15px';
    row.style.alignItems = 'center';
    row.innerHTML = `
        <select class="recCategory" style="width:100%;">
            <option value="">-- Chọn category --</option>
        </select>
        <select class="recIngredient" style="width:100%;">
            <option value="">-- Chọn nguyên liệu --</option>
        </select>
        <input type="number" class="recQty" placeholder="Số lượng" style="width:100%;">
        <button type="button" class="removeRecipeRowBtn">🗑️</button>
    `;

    row.querySelector('.recCategory')?.addEventListener('change', () => {
        renderRecipeIngredientOptions(row);
    });

    row.querySelector('.removeRecipeRowBtn')?.addEventListener('click', () => {
        const rows = document.querySelectorAll('#recipeRows .recipe-row');
        if (rows.length <= 1) return;
        row.remove();
    });

    return row;
}

const addRecipeRowBtn = document.getElementById('addRecipeRowBtn');
if (addRecipeRowBtn) addRecipeRowBtn.onclick = () => {
    const container = document.getElementById('recipeRows');
    if (!container) return;
    container.appendChild(createRecipeRow());
    renderRecipeRows();
};

const saveRecipeBtn = document.getElementById('saveRecipeBtn');
if (saveRecipeBtn) saveRecipeBtn.onclick = async () => {
    const name = document.getElementById('productName').value.trim();
    const description = document.getElementById('productDescription')?.value.trim() || '';
    const rows = Array.from(document.querySelectorAll('#recipeRows .recipe-row'));
    if (!name) {
        alert('Nhập tên sản phẩm');
        return;
    }

    if (!rows.length) {
        alert('Thêm ít nhất 1 nguyên liệu cho công thức');
        return;
    }

    try {
        const ingredients = [];
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const category = row.querySelector('.recCategory')?.value || '';
            const ingredientId = parseInt(row.querySelector('.recIngredient')?.value);
            const qty = parseFloat(row.querySelector('.recQty')?.value);

            if (!category || !ingredientId || !qty) {
                alert(`Dòng ${i + 1}: nhập đầy đủ category, nguyên liệu, số lượng`);
                return;
            }

            ingredients.push({ ingredientId, quantity: qty });
        }

        await window.dbApi.addRecipe({ name, description, ingredients });
        await refreshRecipesData();
        updateSelects();
        renderAll();
        document.getElementById('productName').value = '';
        if (document.getElementById('productDescription')) {
            document.getElementById('productDescription').value = '';
        }
        const container = document.getElementById('recipeRows');
        if (container) {
            container.innerHTML = '';
            container.appendChild(createRecipeRow());
            renderRecipeRows();
        }
    } catch (e) {
        alert('Không thể lưu công thức');
    }
};

const calcNeedBtn = document.getElementById('calcNeedBtn');
if (calcNeedBtn) calcNeedBtn.onclick = () => {
    const id = parseInt(document.getElementById('prodSelect').value);
    const qty = parseInt(document.getElementById('prodQty').value);
    const recipe = userRecipes.find(r => r.id === id);
    if (!recipe || !qty) {
        alert('Chọn sản phẩm và số lượng');
        return;
    }
    let html = '<strong>📋 Nguyên liệu cần:</strong><br>';
    for (let [ing, gram] of Object.entries(recipe.ingredients)) {
        const need = gram * qty;
        const stock = userIngredients.find(i => i.name === ing);
        const current = stock ? stock.quantity : 0;
        html += `${ing}: cần ${need}g, có ${current}g → ${current >= need ? '✅ Đủ' : '❌ Thiếu'}<br>`;
    }
    document.getElementById('needResult').innerHTML = html;
    document.getElementById('needResult').style.display = 'block';
};

const confirmDeductionBtn = document.getElementById('confirmDeductionBtn');
if (confirmDeductionBtn) confirmDeductionBtn.onclick = async () => {
    const id = parseInt(document.getElementById('prodSelect').value);
    const qty = parseInt(document.getElementById('prodQty').value);
    const recipe = userRecipes.find(r => r.id === id);
    const result = await produceProduct(recipe, qty);
    if (result.success) {
        alert(`✅ Sản xuất thành công ${qty} ${recipe.name}`);
        renderAll();
    } else {
        alert('❌ Thiếu nguyên liệu');
    }
};

const calcMaxBtn = document.getElementById('calcMaxBtn');
if (calcMaxBtn) calcMaxBtn.onclick = () => {
    const id = parseInt(document.getElementById('maxProdSelect').value);
    const recipe = userRecipes.find(r => r.id === id);
    const max = maxPossible(recipe);
    document.getElementById('maxResult').innerHTML = `📦 Tối đa: <strong>${max}</strong> cái "${recipe.name}"`;
};

const recordSaleBtn = document.getElementById('recordSaleBtn');
if (recordSaleBtn) recordSaleBtn.onclick = async () => {
    const id = parseInt(document.getElementById('profitProductSelect').value);
    const qty = parseInt(document.getElementById('soldQty').value);
    const price = parseFloat(document.getElementById('sellPrice').value);
    const recipe = userRecipes.find(r => r.id === id);
    const cost = getProductCost(recipe);
    if (!cost) {
        alert('Không thể tính cost');
        return;
    }
    await window.dbApi.addSale({
        productId: id,
        quantitySold: qty,
        actualSalePrice: price
    });
    await saveAllData();
    renderProfitReport();
    alert('Đã ghi nhận bán hàng!');
};

const resetSalesBtn = document.getElementById('resetSalesBtn');
if (resetSalesBtn) resetSalesBtn.onclick = async () => {
    if (confirm('Xóa lịch sử bán?')) {
        await window.dbApi.resetSales();
        await saveAllData();
        renderProfitReport();
    }
};

const resetDemoBtn = document.getElementById('resetDemoBtn');
if (resetDemoBtn) resetDemoBtn.onclick = async () => {
    if (confirm('Reset dữ liệu mẫu?')) {
        await window.dbApi.resetDemo();
        await saveAllData();
        renderAll();
    }
};

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
        const tabId = btn.getAttribute('data-tab');
        document.getElementById(tabId).classList.add('active');
        if (tabId === 'ingredients') {
            refreshIngredientTabData();
        } else if (tabId === 'recipes') {
            refreshRecipesData();
        }
        renderProfitReport();
    });
});

refreshIngredientTabData();
refreshRecipesData();

const closeRecipeModalBtn = document.getElementById('closeRecipeModalBtn');
if (closeRecipeModalBtn) closeRecipeModalBtn.onclick = () => {
    closeRecipeModal();
};

const recipeDetailModal = document.getElementById('recipeDetailModal');
if (recipeDetailModal) recipeDetailModal.onclick = (e) => {
    if (e.target === recipeDetailModal) closeRecipeModal();
};

const deleteRecipeBtn = document.getElementById('deleteRecipeBtn');
if (deleteRecipeBtn) deleteRecipeBtn.onclick = async () => {
    const productId = window.currentRecipeProductId;
    if (!productId) return;
    if (!confirm('Xóa công thức này?')) return;

    try {
        await window.dbApi.deleteRecipe(productId);
        closeRecipeModal();
        await refreshRecipesData();
        updateSelects();
    } catch (e) {
        alert('Không thể xóa công thức');
    }
};
