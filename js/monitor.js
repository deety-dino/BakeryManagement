document.addEventListener('DOMContentLoaded', async () => {
    const state = {
        ingredients: [],
        ingredientCatalog: [],
        products: [],
        staff: [],
        imports: [],
        importList: []
    };

    const importCategory = document.getElementById('importCategory');
    const importIngredient = document.getElementById('importIngredient');
    const importQuantity = document.getElementById('importQuantity');
    const importUnitPrice = document.getElementById('importUnitPrice');
    const toast = document.getElementById('monitorToast');

    const userEl = document.getElementById('currentUser');
    const session = readAuthSession?.() || (window.dbApi?.getSession?.());
    if (userEl && session) {
        userEl.textContent = session.masterId || session.masterUid || 'Người dùng';
    }

    async function loadData() {
        try {
            const session = readAuthSession?.() || (window.dbApi?.getSession?.());
            console.log('[monitor] Current session:', session);

            if (!session || !session.masterUid) {
                console.warn('[monitor] No session available, redirecting to login');
                showToast('Vui lòng đăng nhập lại');
                setTimeout(() => goToLoginPage?.(), 1500);
                return;
            }

            console.log('[monitor] Loading data for shop:', session.shopId);

            const requests = [
                { name: 'ingredient-stock', promise: apiRequest('/api/ingredient-stock') },
                { name: 'ingredients/catalog', promise: apiRequest('/api/ingredients/catalog') },
                { name: 'product-stock', promise: apiRequest('/api/product-stock') },
                { name: 'ingredient-imports', promise: apiRequest('/api/ingredient-imports') }
            ];

            const results = await Promise.allSettled(requests.map((r) => r.promise));

            results.forEach((result, index) => {
                const reqName = requests[index].name;
                if (result.status === 'fulfilled') {
                    console.log(`[monitor] ${reqName} loaded:`, result.value);
                } else {
                    console.error(`[monitor] ${reqName} failed:`, result.reason);
                }
            });

            state.ingredients = results[0].status === 'fulfilled' ? results[0].value || [] : [];
            state.ingredientCatalog = results[1].status === 'fulfilled' ? results[1].value || [] : [];
            state.products = results[2].status === 'fulfilled' ? results[2].value || [] : [];
            state.imports = results[3].status === 'fulfilled' ? results[3].value || [] : [];

            renderCategoryOptions();
            renderWarehouse();
            renderImportHistory();
            showToast('Dữ liệu tải thành công');
        } catch (error) {
            console.error('[monitor] Failed to load data:', error);
            showToast(`Lỗi tải dữ liệu: ${error.message}`);
        }
    }

    function showToast(message) {
        if (!toast) return;
        toast.textContent = message;
        toast.classList.add('show');
        window.clearTimeout(window.__monitorToastTimer);
        window.__monitorToastTimer = window.setTimeout(() => {
            toast.classList.remove('show');
        }, 2400);
    }

    function renderCategoryOptions() {
        if (!importCategory) return;
        const categories = [...new Set(state.ingredientCatalog.map((item) => item.category).filter(Boolean))].sort();
        importCategory.innerHTML = '<option value="">-- Chọn danh mục --</option>';
        categories.forEach((cat) => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            importCategory.appendChild(option);
        });
    }

    function renderIngredientOptions() {
        if (!importIngredient) return;
        const selectedCategory = importCategory?.value || '';
        const filteredItems = selectedCategory
            ? state.ingredientCatalog.filter((item) => item.category === selectedCategory)
            : state.ingredientCatalog;

        importIngredient.innerHTML = '<option value="">-- Chọn nguyên liệu --</option>';
        filteredItems.forEach((item) => {
            const option = document.createElement('option');
            option.value = String(item.id);
            option.textContent = `${item.name} (${item.unit})`;
            option.dataset.name = item.name;
            importIngredient.appendChild(option);
        });
    }

    function renderImportList() {
        const listBody = document.getElementById('importListBody');
        if (!listBody) return;

        listBody.innerHTML = state.importList.map((item, index) => `
            <tr>
                <td>${item.ingredientName}</td>
                <td><strong>${Number(item.quantity).toLocaleString('vi-VN')}</strong></td>
                <td>${Number(item.totalMoney).toLocaleString('vi-VN')}</td>
                <td>
                    <button type="button" class="btn-outline danger-outline" onclick="window.removeImportRow(${index})">🗑️ Xóa</button>
                </td>
            </tr>
        `).join('');
    }

    function renderImportHistory() {
        const historyBody = document.getElementById('importHistoryBody');
        if (!historyBody) return;

        const recentImports = state.imports.slice(0, 10);
        historyBody.innerHTML = recentImports.map((item) => {
            const date = new Date(item.import_date);
            const formattedDate = date.toLocaleDateString('vi-VN');
            const totalMoney = Number(item.total_money || item.unit_price || 0);
            return `
                <tr>
                    <td>${item.ingredient_name}</td>
                    <td><strong>${item.quantity}</strong></td>
                    <td>${totalMoney.toLocaleString('vi-VN')}</td>
                    <td>${formattedDate}</td>
                </tr>
            `;
        }).join('');
    }

    function renderWarehouse() {
        const ingredientBody = document.getElementById('ingredientStockBody');
        const cakeBody = document.getElementById('cakeStockBody');

        if (ingredientBody) {
            ingredientBody.innerHTML = state.ingredients.map((item) => `
                <tr>
                    <td>${item.name}</td>
                    <td><strong>${Number(item.quantity || 0).toLocaleString('vi-VN')}</strong></td>
                    <td>${item.unit}</td>
                    <td>${Number(item.avg_unit_price_month || 0).toLocaleString('vi-VN')}</td>
                </tr>
            `).join('');
        }

        if (cakeBody) {
            cakeBody.innerHTML = state.products.map((item) => `
                <tr>
                    <td>${item.product_name}</td>
                    <td><strong>${Number(item.quantity || 0).toLocaleString('vi-VN')}</strong></td>
                    <td>${Number(item.cost_per_unit || 0).toLocaleString('vi-VN')}</td>
                </tr>
            `).join('');
        }

        const ingredientSummary = document.getElementById('ingredientSummary');
        const cakeSummary = document.getElementById('cakeSummary');
        const metricIngredientCount = document.getElementById('metricIngredientCount');
        const metricCakeCount = document.getElementById('metricCakeCount');
        const metricEmployeeCount = document.getElementById('metricEmployeeCount');

        if (ingredientSummary) ingredientSummary.textContent = `${state.ingredients.length} mặt hàng`;
        if (cakeSummary) cakeSummary.textContent = `${state.products.length} mặt hàng`;
        if (metricIngredientCount) {
            const stockedIngredients = state.ingredients.filter((item) => Number(item.quantity || 0) > 0).length;
            metricIngredientCount.textContent = `${stockedIngredients}/${state.ingredients.length}`;
        }
        if (metricCakeCount) {
            metricCakeCount.textContent = state.products.reduce((sum, item) => sum + Number(item.quantity || 0), 0).toLocaleString('vi-VN');
        }
        if (metricEmployeeCount) metricEmployeeCount.textContent = '0';
    }

    window.removeImportRow = function (index) {
        state.importList.splice(index, 1);
        renderImportList();
        showToast('Đã xóa khỏi danh sách.');
    };

    document.getElementById('importCategory')?.addEventListener('change', renderIngredientOptions);

    document.getElementById('addImportRowBtn')?.addEventListener('click', () => {
        const ingredientId = Number(importIngredient?.value);
        const ingredientOption = importIngredient?.options[importIngredient.selectedIndex];
        const ingredientName = ingredientOption?.dataset.name || ingredientOption?.textContent || '';
        const quantity = Number(importQuantity?.value);
        const totalMoney = Number(importUnitPrice?.value);

        if (!ingredientId || !quantity || !totalMoney) {
            showToast('Vui lòng chọn nguyên liệu, nhập số lượng và tổng tiền.');
            return;
        }

        state.importList.push({
            ingredientId,
            ingredientName,
            quantity,
            totalMoney
        });

        importIngredient.value = '';
        importQuantity.value = '';
        importUnitPrice.value = '';
        renderIngredientOptions();
        renderImportList();
        showToast(`Đã thêm ${ingredientName} vào danh sách.`);
    });

    document.getElementById('submitImportBtn')?.addEventListener('click', async () => {
        if (!state.importList.length) {
            showToast('Danh sách nhập hàng trống.');
            return;
        }

        try {
            const response = await apiRequest('/api/ingredient-imports/batch', {
                method: 'POST',
                body: JSON.stringify({
                    items: state.importList.map((item) => ({
                        ingredientId: item.ingredientId,
                        quantity: item.quantity,
                        totalMoney: item.totalMoney
                    }))
                })
            });

            state.importList = [];
            renderImportList();
            await loadData();
            showToast(`Đã nhập ${response.count || state.importList.length} mặt hàng thành công.`);
        } catch (error) {
            console.error('[monitor] Batch import failed:', error);
            showToast(`Lỗi: ${error.message}`);
        }
    });

    document.getElementById('resetImportFormBtn')?.addEventListener('click', () => {
        importCategory.value = '';
        importIngredient.value = '';
        importQuantity.value = '';
        importUnitPrice.value = '';
        state.importList = [];
        renderIngredientOptions();
        renderImportList();
        showToast('Đã làm mới form nhập kho.');
    });

    await loadData();
});
