function applyWorkspaceSnapshot(snapshot) {
    windowDbSnapshot = snapshot || null;

    const session = snapshot?.session || window.dbApi?.getSession?.() || null;
    currentUserId = session?.masterUid || '';
    currentMasterId = session?.masterId || '';
    currentMasterName = session?.masterName || '';
    currentShopId = session?.shopId || '';
    currentShopName = session?.shopName || '';
    currentAuthMode = session?.role || 'master';

    const currentUserElement = document.getElementById('currentUser');
    if (currentUserElement) {
        currentUserElement.innerText = currentMasterName || currentMasterId || currentUserId || '';
    }

    const catalog = Array.isArray(snapshot?.ingredients) ? snapshot.ingredients : [];
    const stock = Array.isArray(snapshot?.stock) ? snapshot.stock : [];
    const imports = Array.isArray(snapshot?.imports) ? snapshot.imports : [];
    const recipes = Array.isArray(snapshot?.recipes) ? snapshot.recipes : [];
    const sales = Array.isArray(snapshot?.sales) ? snapshot.sales : [];

    window.dbIngredientCatalog = catalog;
    window.dbIngredientStock = stock;
    window.dbIngredientImports = imports;
    window.dbRecipes = recipes;

    userIngredients = stock;
    userRecipes = recipes;
    userSalesHistory = sales;
}

async function loadUserData(session) {
    const activeSession = session || window.dbApi?.getSession?.();
    if (!activeSession?.masterUid) {
        return;
    }

    if (window.dbApi?.setSession) {
        window.dbApi.setSession(activeSession);
    }

    const snapshot = await window.dbApi.bootstrap();
    applyWorkspaceSnapshot({
        ...snapshot,
        session: snapshot?.session || activeSession
    });
    renderAll();
}

async function saveAllData() {
    if (!currentUserId || !window.dbApi?.bootstrap) return;
    const snapshot = await window.dbApi.bootstrap();
    applyWorkspaceSnapshot({
        ...snapshot,
        session: snapshot?.session || window.dbApi.getSession?.()
    });
    renderAll();
}