function getAuthPageElements() {
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    return { loginScreen, mainApp };
}

function isLoginOnlyPage() {
    const { loginScreen, mainApp } = getAuthPageElements();
    return !!loginScreen && !mainApp;
}

function isMainOnlyPage() {
    const { loginScreen, mainApp } = getAuthPageElements();
    return !loginScreen && !!mainApp;
}

function goToMainPage() {
    window.location.href = 'shop-management.html';
}

function goToLoginPage() {
    window.location.href = 'login-screen.html';
}

function setAuthMessage(text) {
    const message = document.getElementById('authMessage');
    if (message) message.innerText = text || '';
}

function setActiveLoginMode(mode) {
    const adminPanel = document.getElementById('adminLoginForm');
    const branchPanel = document.getElementById('branchLoginForm');

    if (adminPanel) {
        adminPanel.classList.toggle('active', mode === 'admin');
        adminPanel.style.display = mode === 'admin' ? 'block' : 'none';
    }
    if (branchPanel) {
        branchPanel.classList.toggle('active', mode === 'branch');
        branchPanel.style.display = mode === 'branch' ? 'block' : 'none';
    }

    document.querySelectorAll('.choice-btn').forEach((button) => {
        button.classList.toggle('active', button.dataset.mode === mode);
    });

    setAuthMessage('');
}

window.showAdminLogin = function () {
    setActiveLoginMode('admin');
};

window.showBranchLogin = function () {
    setActiveLoginMode('branch');
};

async function applyAuthenticatedSession(session) {
    window.dbApi.setSession(session);

    if (isLoginOnlyPage()) {
        goToMainPage();
        return;
    }

    const { loginScreen, mainApp } = getAuthPageElements();
    if (loginScreen) loginScreen.style.display = 'none';
    if (mainApp) mainApp.style.display = 'block';
    await loadUserData(session);
}

function getLoginPasswordValue() {
    return document.getElementById('loginPassword')?.value.trim() || '';
}

function getBranchPasswordValue() {
    return document.getElementById('branchPassword')?.value.trim() || '';
}

window.logout = async function () {
    window.dbApi?.clearSession?.();
    currentUserId = null;
    currentMasterId = '';
    currentMasterName = '';
    currentShopId = '';
    currentShopName = '';
    userIngredients = [];
    userRecipes = [];
    userSalesHistory = [];
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    if (isMainOnlyPage()) {
        goToLoginPage();
        return;
    }
    if (loginScreen) loginScreen.style.display = 'flex';
    if (mainApp) mainApp.style.display = 'none';
};

// ==================== MASTER LOGIN ====================
document.getElementById('loginAdminBtn')?.addEventListener('click', async () => {
    const masterId = (document.getElementById('loginMasterId')?.value || '').trim();
    const password = getLoginPasswordValue();

    if (!masterId || !password) {
        setAuthMessage('Nhập master_id và mật khẩu');
        return;
    }

    try {
        const result = await window.dbApi.masterLogin({ masterId, password });
        
        const session = {
            masterUid: result.masterUid || result.master_uid,
            masterId: result.masterId || result.master_id,
            masterName: result.masterName || result.master_name || '',
            shopId: result.shopId || result.shop_id || '',
            shopName: result.shopName || result.shop_name || '',
            role: 'admin'
        };
        
        await applyAuthenticatedSession(session);
    } catch (error) {
        setAuthMessage(error.message || 'Sai master_id hoặc mật khẩu');
    }
});

// ==================== SHOP LOGIN ====================
async function loginBranch(role) {
    const masterId = (document.getElementById('branchMasterId')?.value || '').trim();
    const shopId = (document.getElementById('branchShopId')?.value || '').trim();
    const password = getBranchPasswordValue();

    if (!masterId || !shopId || !password) {
        setAuthMessage('Nhập master_id, shop_id và mật khẩu');
        return;
    }

    try {
        const result = await window.dbApi.shopLogin({ masterId, shopId, role, password });

        const session = {
            masterUid: result.masterUid || result.master_uid,
            masterId: result.masterId || result.master_id,
            masterName: result.masterName || result.master_name || '',
            shopId: result.shopId || result.shop_id,
            shopName: result.shopName || result.shop_name,
            role: role === 'admin' ? 'admin' : 'staff'
        };

        await applyAuthenticatedSession(session);
    } catch (error) {
        setAuthMessage(error.message || 'Sai thông tin chi nhánh');
    }
}

document.getElementById('branchManagerBtn')?.addEventListener('click', async () => {
    await loginBranch('admin');
});

document.getElementById('branchStaffBtn')?.addEventListener('click', async () => {
    await loginBranch('staff');
});

// ==================== SESSION RESTORATION ====================
async function restoreSessionOnLoad() {
    const session = window.dbApi?.getSession?.();
    
    if (!session?.masterUid) {
        if (isMainOnlyPage()) {
            goToLoginPage();
        }
        return;
    }

    if (isLoginOnlyPage()) {
        goToMainPage();
        return;
    }

    const { loginScreen, mainApp } = getAuthPageElements();
    if (loginScreen) loginScreen.style.display = 'none';
    if (mainApp) mainApp.style.display = 'block';
    await loadUserData(session);
}

setActiveLoginMode('admin');

restoreSessionOnLoad();
