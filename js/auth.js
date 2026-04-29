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
    window.location.href = 'main-app.html';
}

function goToLoginPage() {
    window.location.href = 'login-screen.html';
}

window.showRegister = function () {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('authMessage').innerText = '';
};

window.showLogin = function () {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('authMessage').innerText = '';
};

window.logout = async function () {
    await auth.signOut();
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');
    if (isMainOnlyPage()) {
        goToLoginPage();
        return;
    }
    if (loginScreen) loginScreen.style.display = 'flex';
    if (mainApp) mainApp.style.display = 'none';
};

document.getElementById('googleLoginBtn')?.addEventListener('click', async () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    try {
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (!userDoc.exists) {
            await db.collection('users').doc(user.uid).set({
                ingredients: getSampleIngredients(),
                recipes: getSampleRecipes(),
                salesHistory: []
            });
        }
        if (isLoginOnlyPage()) {
            goToMainPage();
            return;
        }
        const { loginScreen, mainApp } = getAuthPageElements();
        if (loginScreen) loginScreen.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
        loadUserData(user);
    } catch (error) {
        document.getElementById('authMessage').innerText = 'Lỗi: ' + error.message;
    }
});

document.getElementById('registerBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const msg = document.getElementById('authMessage');

    if (!email || !password) {
        msg.innerText = 'Nhập email và mật khẩu';
        return;
    }
    if (password.length < 6) {
        msg.innerText = 'Mật khẩu tối thiểu 6 ký tự';
        return;
    }

    try {
        const user = await auth.createUserWithEmailAndPassword(email, password);
        await db.collection('users').doc(user.user.uid).set({
            ingredients: getSampleIngredients(),
            recipes: getSampleRecipes(),
            salesHistory: []
        });
        if (isLoginOnlyPage()) {
            goToMainPage();
            return;
        }
        const { loginScreen, mainApp } = getAuthPageElements();
        if (loginScreen) loginScreen.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
        loadUserData(user.user);
    } catch (error) {
        msg.innerText = error.message;
    }
});

document.getElementById('loginBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const msg = document.getElementById('authMessage');

    try {
        const user = await auth.signInWithEmailAndPassword(email, password);
        if (isLoginOnlyPage()) {
            goToMainPage();
            return;
        }
        const { loginScreen, mainApp } = getAuthPageElements();
        if (loginScreen) loginScreen.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
        loadUserData(user.user);
    } catch (error) {
        msg.innerText = 'Sai email hoặc mật khẩu';
    }
});

auth.onAuthStateChanged((user) => {
    const loginScreen = document.getElementById('loginScreen');
    const mainApp = document.getElementById('mainApp');

    if (user) {
        if (isLoginOnlyPage()) {
            if (loginScreen) loginScreen.style.display = 'flex';
            return;
        }
        if (loginScreen) loginScreen.style.display = 'none';
        if (mainApp) mainApp.style.display = 'block';
        if (mainApp) {
            loadUserData(user);
        }
    } else {
        if (isMainOnlyPage()) {
            goToLoginPage();
            return;
        }
        if (loginScreen) loginScreen.style.display = 'flex';
        if (mainApp) mainApp.style.display = 'none';
    }
});