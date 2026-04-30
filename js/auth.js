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
    const registerPanel = document.getElementById('registerStoreForm');

    if (adminPanel) {
        adminPanel.classList.toggle('active', mode === 'admin');
        adminPanel.style.display = mode === 'admin' ? 'block' : 'none';
    }
    if (branchPanel) {
        branchPanel.classList.toggle('active', mode === 'branch');
        branchPanel.style.display = mode === 'branch' ? 'block' : 'none';
    }
    if (registerPanel) {
        registerPanel.classList.remove('active');
        registerPanel.style.display = 'none';
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

window.showRegisterStore = function () {
    const adminPanel = document.getElementById('adminLoginForm');
    const branchPanel = document.getElementById('branchLoginForm');
    const registerPanel = document.getElementById('registerStoreForm');

    if (adminPanel) {
        adminPanel.classList.remove('active');
        adminPanel.style.display = 'none';
    }
    if (branchPanel) {
        branchPanel.classList.remove('active');
        branchPanel.style.display = 'none';
    }
    if (registerPanel) {
        registerPanel.classList.add('active');
        registerPanel.style.display = 'block';
    }

    document.querySelectorAll('.choice-btn').forEach((button) => {
        button.classList.remove('active');
    });

    setAuthMessage('');
};

function handleRegisterStore() {
    const masterId = document.getElementById('registerMasterId')?.value?.trim();
    const masterName = document.getElementById('registerMasterName')?.value?.trim();
    const shopName = document.getElementById('registerShopName')?.value?.trim();
    const password = document.getElementById('registerPassword')?.value?.trim();
    const confirmPassword = document.getElementById('registerConfirmPassword')?.value?.trim();

    if (!masterId || !password || !confirmPassword) {
        setAuthMessage('Vui long nhap day du thong tin dang ky');
        return;
    }

    if (password !== confirmPassword) {
        setAuthMessage('Mat khau nhap lai khong khop');
        return;
    }

    window.dbApi?.registerShop?.({
        masterId,
        masterName: masterName || masterId,
        shopName: shopName || 'Chi nhánh mặc định',
        password,
        recheckPassword: confirmPassword
    })
        .then((result) => {
            const createdShopId = result?.shopId || result?.session?.shopId || '';
            const createdMasterId = result?.masterId || result?.session?.masterId || masterId;
            
            const session = {
                masterUid: result?.masterUid || result?.session?.masterUid || masterId,
                masterId: createdMasterId,
                shopId: createdShopId,
                shopName: result?.shopName || result?.session?.shopName || shopName || 'Chi nhánh mặc định',
                role: 'master'
            };

            writeSession(session);
            
            // Show created credentials so user can login as branch later
            const credsMsg = `Tạo tài khoản thành công!\n\nThông tin chi nhánh:\nMaster ID: ${createdMasterId}\nShop ID: ${createdShopId}\nMật khẩu: ${password}\n\nBạn có thể dùng thông tin này để đăng nhập chi nhánh.`;
            alert(credsMsg);
            
            goToShopManagementPage();
        })
        .catch((error) => {
            setAuthMessage(`Loi: ${error?.message || 'Dang ky that bai'}`);
        });
}

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

    const registerStoreBtn = document.getElementById('registerStoreBtn');
    if (registerStoreBtn) registerStoreBtn.addEventListener('click', handleRegisterStore);

    const cancelRegisterBtn = document.getElementById('cancelRegisterBtn');
    if (cancelRegisterBtn) cancelRegisterBtn.addEventListener('click', () => setActiveLoginMode('admin'));
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
