async function addIngredient(name, qty, price, unit) {
    if (!window.dbApi) {
        throw new Error('Thiếu cấu hình API');
    }

    const created = await window.dbApi.addIngredient({
        name,
        category: '',
        unit
    });

    if (Number.isFinite(qty) && Number.isFinite(price) && qty > 0 && price > 0) {
        await window.dbApi.addIngredientImport({
            ingredientId: created.id,
            quantity: qty,
            unitPrice: price / qty
        });
    }

    await saveAllData();
    return true;
}

function getProductCost(recipe) {
    let cost = 0;
    for (let [ingName, gram] of Object.entries(recipe.ingredients)) {
        const ing = userIngredients.find(i => i.name === ingName);
        if (!ing) return null;
        cost += gram * Number(ing.avg_unit_price_month || 0);
    }
    return cost;
}

async function produceProduct(recipe, quantity) {
    const needed = {};
    for (let [ing, gram] of Object.entries(recipe.ingredients)) needed[ing] = gram * quantity;

    for (let [ing, need] of Object.entries(needed)) {
        const stock = userIngredients.find(i => i.name === ing);
        if (!stock || stock.quantity < need) {
            return { success: false, shortages: Object.keys(needed) };
        }
    }

    await window.dbApi.addProduction({
        productId: recipe.id,
        quantityProduced: quantity
    });
    await saveAllData();
    return { success: true };
}

function maxPossible(recipe) {
    let max = Infinity;
    for (let [ing, gram] of Object.entries(recipe.ingredients)) {
        const stock = userIngredients.find(i => i.name === ing);
        if (!stock) return 0;
        const possible = Math.floor(stock.quantity / gram);
        if (possible < max) max = possible;
    }
    return max === Infinity ? 0 : max;
}