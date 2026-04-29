async function loadUserData(user) {
    currentUserId = user.uid;
    document.getElementById('currentUser').innerText = user.email || user.displayName;

    const userDoc = await db.collection('users').doc(currentUserId).get();
    if (userDoc.exists) {
        const data = userDoc.data();
        userIngredients = data.ingredients || [];
        userRecipes = data.recipes || [];
        userSalesHistory = data.salesHistory || [];
    } else {
        userIngredients = getSampleIngredients();
        userRecipes = getSampleRecipes();
        userSalesHistory = [];
        await saveAllData();
    }
    renderAll();
}

async function saveAllData() {
    if (!currentUserId) return;
    await db.collection('users').doc(currentUserId).set({
        ingredients: userIngredients,
        recipes: userRecipes,
        salesHistory: userSalesHistory
    });
}