// Master Setup JavaScript
// Handle master profile completion after registration
// Chỉ gửi những thông tin được điền lên backend

document.addEventListener('DOMContentLoaded', initializeMasterSetup);

function initializeMasterSetup() {
    const completeSetupBtn = document.getElementById('completeSetupBtn');
    const skipSetupBtn = document.getElementById('skipSetupBtn');

    if (completeSetupBtn) {
        completeSetupBtn.addEventListener('click', completeSetup);
    }

    if (skipSetupBtn) {
        skipSetupBtn.addEventListener('click', skipSetup);
    }

    loadMasterInfo();
}

function loadMasterInfo() {
    const session = window.dbApi?.getSession?.();
    
    if (!session?.masterId) {
        window.location.href = 'login-screen.html';
        return;
    }

    const setupMasterId = document.getElementById('setupMasterId');
    if (setupMasterId) {
        setupMasterId.value = session.masterId || '';
    }

    if (session.masterName) {
        const setupMasterName = document.getElementById('setupMasterName');
        if (setupMasterName) setupMasterName.value = session.masterName;
    }

    if (session.shopName) {
        const setupShopName = document.getElementById('setupShopName');
        if (setupShopName) setupShopName.value = session.shopName;
    }
}

async function completeSetup() {
    const session = window.dbApi?.getSession?.();
    const msg = document.getElementById('setupMessage');

    if (!session?.masterId) {
        if (msg) msg.innerText = 'Session không hợp lệ. Vui lòng đăng nhập lại.';
        return;
    }

    const masterName = (document.getElementById('setupMasterName')?.value || '').trim();
    const shopName = (document.getElementById('setupShopName')?.value || '').trim();
    const email = (document.getElementById('setupEmail')?.value || '').trim();
    const phone = (document.getElementById('setupPhone')?.value || '').trim();
    const address = (document.getElementById('setupAddress')?.value || '').trim();

    if (!masterName) {
        if (msg) msg.innerText = 'Nhập tên chủ cửa hàng';
        return;
    }

    if (!shopName) {
        if (msg) msg.innerText = 'Nhập tên cửa hàng chính';
        return;
    }

    try {
        // Xây dựng payload chỉ với những trường được điền
        const payload = {
            masterName,
            shopName
        };

        // Chỉ thêm các trường tùy chọn nếu được điền
        if (email) payload.email = email;
        if (phone) payload.phone = phone;
        if (address) payload.address = address;

        if (window.dbApi && window.dbApi.updateMasterProfile) {
            await window.dbApi.updateMasterProfile(payload);
        }

        // Cập nhật session với thông tin mới
        const updatedSession = {
            ...session,
            masterName,
            shopName
        };
        window.dbApi.setSession(updatedSession);

        window.location.href = 'main-app.html';
    } catch (error) {
        if (msg) msg.innerText = 'Lỗi: ' + (error.message || 'Không thể cập nhật thông tin');
    }
}

async function skipSetup() {
    const session = window.dbApi?.getSession?.();
    
    if (!session?.masterId) {
        window.location.href = 'login-screen.html';
        return;
    }

    window.location.href = 'main-app.html';
}
