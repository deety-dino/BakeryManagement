// BakeManage Authentication Module
// Handles login, logout, and navigation for single-page application

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

function showLoginScreen() {
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    const shopManagementApp = document.getElementById('shopManagementApp');

    if (loginScreen) loginScreen.style.display = 'block';
    if (mainApp) mainApp.style.display = 'none';
    if (shopManagementApp) shopManagementApp.style.display = 'none';
    
    setActiveLoginMode('admin');
}

function showShopManagementApp() {
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    const shopManagementApp = document.getElementById('shopManagementApp');

    if (loginScreen) loginScreen.style.display = 'none';
    if (mainApp) mainApp.style.display = 'none';
    if (shopManagementApp) shopManagementApp.style.display = 'block';
    
    // Load shop management UI
    loadShopManagementUI();
}

function showMainApp() {
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    const shopManagementApp = document.getElementById('shopManagementApp');

    if (loginScreen) loginScreen.style.display = 'none';
    if (mainApp) mainApp.style.display = 'block';
    if (shopManagementApp) shopManagementApp.style.display = 'none';
}

function getCurrentUser() {
    const session = window.dbApi?.getSession?.();
    return session?.masterId || session?.shopId || 'Unknown';
}

function updateCurrentUserDisplay() {
    const userSpan = document.getElementById('currentUser');
    if (userSpan) {
        userSpan.innerText = getCurrentUser();
    }
}

window.logout = function() {
    window.dbApi?.clearSession?.();
    showLoginScreen();
    // Clear all form inputs
    document.getElementById('loginMasterId').value = '';
    document.getElementById('loginPassword').value = '';
    document.getElementById('branchMasterId').value = '';
    document.getElementById('branchShopId').value = '';
    document.getElementById('branchPassword').value = '';
};

async function handleAdminLogin() {
    const masterId = document.getElementById('loginMasterId')?.value?.trim();
    const password = document.getElementById('loginPassword')?.value?.trim();

    if (!masterId) {
        setAuthMessage('Vui lòng nhập master_id');
        return;
    }
    if (!password) {
        setAuthMessage('Vui lòng nhập mật khẩu');
        return;
    }

    try {
        setAuthMessage('Đang đăng nhập...');
        await window.dbApi?.masterLogin?.({ masterId, password });
        updateCurrentUserDisplay();
        showShopManagementApp();
    } catch (error) {
        setAuthMessage(`Lỗi: ${error.message || 'Đăng nhập thất bại'}`);
    }
}

async function handleBranchManagerLogin() {
    const masterId = document.getElementById('branchMasterId')?.value?.trim();
    const shopId = document.getElementById('branchShopId')?.value?.trim();
    const password = document.getElementById('branchPassword')?.value?.trim();

    if (!masterId || !shopId || !password) {
        setAuthMessage('Vui lòng điền đầy đủ thông tin');
        return;
    }

    try {
        setAuthMessage('Đang đăng nhập...');
        await window.dbApi?.shopLogin?.({ master_id: masterId, shop_id: shopId, password, role: 'admin' });
        updateCurrentUserDisplay();
        showShopManagementApp();
    } catch (error) {
        setAuthMessage(`Lỗi: ${error.message || 'Đăng nhập thất bại'}`);
    }
}

async function handleBranchStaffLogin() {
    const masterId = document.getElementById('branchMasterId')?.value?.trim();
    const shopId = document.getElementById('branchShopId')?.value?.trim();
    const password = document.getElementById('branchPassword')?.value?.trim();

    if (!masterId || !shopId || !password) {
        setAuthMessage('Vui lòng điền đầy đủ thông tin');
        return;
    }

    try {
        setAuthMessage('Đang đăng nhập...');
        await window.dbApi?.shopLogin?.({ master_id: masterId, shop_id: shopId, password, role: 'staff' });
        updateCurrentUserDisplay();
        showMainApp();
    } catch (error) {
        setAuthMessage(`Lỗi: ${error.message || 'Đăng nhập thất bại'}`);
    }
}

// Initialize auth UI on page load
function initializeAuth() {
    const session = window.dbApi?.getSession?.();
    
    // Set up button event listeners
    const loginAdminBtn = document.getElementById('loginAdminBtn');
    if (loginAdminBtn) {
        loginAdminBtn.addEventListener('click', handleAdminLogin);
    }

    const branchManagerBtn = document.getElementById('branchManagerBtn');
    if (branchManagerBtn) {
        branchManagerBtn.addEventListener('click', handleBranchManagerLogin);
    }

    const branchStaffBtn = document.getElementById('branchStaffBtn');
    if (branchStaffBtn) {
        branchStaffBtn.addEventListener('click', handleBranchStaffLogin);
    }

    // Check if user is already logged in
    if (session?.masterUid) {
        updateCurrentUserDisplay();
        if (session.role === 'staff') {
            showMainApp();
        } else {
            showShopManagementApp();
        }
    } else {
        showLoginScreen();
    }
}

// Helper function to load shop management UI content from HTML if not already present
function loadShopManagementUI() {
    const shopApp = document.getElementById('shopManagementApp');
    if (!shopApp || shopApp.querySelector('.shop-management-content')) {
        return; // Already loaded
    }

    const html = `
        <div class="shop-management-content" style="display:block;">
            <div class="container">
                <div class="app-header">
                    <div>
                        <h1>🏪 Quản lý Chi nhánh</h1>
                        <div class="sub">Quản lý chi nhánh, nguyên liệu và công thức</div>
                    </div>
                    <div class="user-info">
                        <span>👤 <span id="currentUserMgmt"></span></span>
                        <button class="logout-btn" onclick="logout()">Đăng xuất</button>
                    </div>
                </div>

                <div class="tabs">
                    <button class="tab-btn active" data-tab="shops">🏪 Chi nhánh</button>
                    <button class="tab-btn" data-tab="ingredients-mgmt">🥄 Nguyên liệu</button>
                    <button class="tab-btn" data-tab="recipes-mgmt">📝 Công thức</button>
                </div>

                <div id="shops" class="tab-pane active"></div>
                <div id="ingredients-mgmt" class="tab-pane"></div>
                <div id="recipes-mgmt" class="tab-pane"></div>
            </div>
        </div>
    `;

    shopApp.innerHTML = html;
    
    // Update the current user display in the management app
    const userSpan = shopApp.querySelector('#currentUserMgmt');
    if (userSpan) {
        userSpan.innerText = getCurrentUser();
    }

    // Initialize shop management if the function exists
    if (typeof initializeShopManagement === 'function') {
        initializeShopManagement();
    }
}

// Check auth status on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeAuth);
} else {
    initializeAuth();
}
 {
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
