function readSession() {
    return window.dbApi?.getSession?.() || null;
}

function writeSession(session) {
    return window.dbApi?.setSession?.(session);
}

function clearSession() {
    return window.dbApi?.clearSession?.();
}

function isLoginPage() {
    return !!document.getElementById('loginScreen') && !document.getElementById('mainApp') && !document.getElementById('shopManagementApp');
}

function isMainAppPage() {
    return !!document.getElementById('mainApp') && !document.getElementById('loginScreen');
}

function isShopManagementPage() {
    return !!document.getElementById('shopManagementApp') && !document.getElementById('loginScreen');
}

function pagePath(pageName) {
    const path = window.location.pathname || '';
    return path.includes('/html/') ? pageName : `html/${pageName}`;
}

function goToLoginPage() {
    window.location.href = pagePath('login-screen.html');
}

function goToMainAppPage() {
    window.location.href = pagePath('main-app.html');
}

function goToShopManagementPage() {
    window.location.href = pagePath('shop-management.html');
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

function ensureLoginVisible() {
    const loginScreen = document.getElementById('loginScreen');
    if (loginScreen) loginScreen.style.display = 'flex';
    setActiveLoginMode('admin');
}

function updateCurrentUserDisplay() {
    const session = readSession();
    const user = session?.masterId || session?.shopId || '';
    const userSpan = document.getElementById('currentUser');
    if (userSpan) userSpan.innerText = user;
}

window.logout = function () {
    clearSession();
    goToLoginPage();
};

async function handleAdminLogin() {
    const masterId = document.getElementById('loginMasterId')?.value?.trim();
    const password = document.getElementById('loginPassword')?.value?.trim();

    if (!masterId || !password) {
        setAuthMessage('Vui long nhap master_id va mat khau');
        return;
    }

    try {
        setAuthMessage('Dang dang nhap...');
        const result = await window.dbApi?.masterLogin?.({ masterId, password });

        const session = {
            masterUid: result?.masterUid || result?.master_uid || masterId,
            masterId: result?.masterId || result?.master_id || masterId,
            role: 'admin'
        };

        writeSession(session);
        goToShopManagementPage();
    } catch (error) {
        setAuthMessage(`Loi: ${error?.message || 'Dang nhap that bai'}`);
    }
}

async function loginBranch(role) {
    const masterId = document.getElementById('branchMasterId')?.value?.trim();
    const shopId = document.getElementById('branchShopId')?.value?.trim();
    const password = document.getElementById('branchPassword')?.value?.trim();

    if (!masterId || !shopId || !password) {
        setAuthMessage('Vui long dien day du thong tin');
        return;
    }

    try {
        setAuthMessage('Dang dang nhap...');
        const result = await window.dbApi?.shopLogin?.({
            master_id: masterId,
            shop_id: shopId,
            password,
            role
        });

        const session = {
            masterUid: result?.masterUid || result?.master_uid || masterId,
            masterId: result?.masterId || result?.master_id || masterId,
            shopId: result?.shopId || result?.shop_id || shopId,
            role
        };

        writeSession(session);

        if (role === 'staff') {
            goToMainAppPage();
        } else {
            goToShopManagementPage();
        }
    } catch (error) {
        setAuthMessage(`Loi: ${error?.message || 'Dang nhap that bai'}`);
    }
}

function bindLoginEvents() {
    const loginAdminBtn = document.getElementById('loginAdminBtn');
    if (loginAdminBtn) loginAdminBtn.addEventListener('click', handleAdminLogin);

    const branchManagerBtn = document.getElementById('branchManagerBtn');
    if (branchManagerBtn) branchManagerBtn.addEventListener('click', () => loginBranch('admin'));

    const branchStaffBtn = document.getElementById('branchStaffBtn');
    if (branchStaffBtn) branchStaffBtn.addEventListener('click', () => loginBranch('staff'));
}

function bootstrapAuth() {
    const session = readSession();

    if (isLoginPage()) {
        bindLoginEvents();

        if (!session?.masterUid) {
            ensureLoginVisible();
            return;
        }

        if (session.role === 'staff') {
            goToMainAppPage();
        } else {
            goToShopManagementPage();
        }
        return;
    }

    if (!session?.masterUid) {
        goToLoginPage();
        return;
    }

    if (isMainAppPage() && session.role !== 'staff') {
        goToShopManagementPage();
        return;
    }

    if (isShopManagementPage() && session.role === 'staff') {
        goToMainAppPage();
        return;
    }

    updateCurrentUserDisplay();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapAuth);
} else {
    bootstrapAuth();
}
