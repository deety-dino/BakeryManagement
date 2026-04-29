function addIngredient(name, qty, price, unit) {
    const existing = userIngredients.find(i => i.name.toLowerCase() === name.toLowerCase());
    const pricePerGram = price / qty;
    if (existing) {
        const oldCost = existing.quantity * existing.pricePerUnit;
        const newCost = oldCost + (qty * pricePerGram);
        existing.quantity += qty;
        existing.pricePerUnit = newCost / existing.quantity;
    } else {
        userIngredients.push({ id: Date.now(), name, quantity: qty, unit, pricePerUnit: pricePerGram });
    }
    saveAllData();
    return true;
}

function getProductCost(recipe) {
    let cost = 0;
    for (let [ingName, gram] of Object.entries(recipe.ingredients)) {
        const ing = userIngredients.find(i => i.name === ingName);
        if (!ing) return null;
        cost += gram * ing.pricePerUnit;
    }
    return cost;
}

function produceProduct(recipe, quantity) {
    const needed = {};
    for (let [ing, gram] of Object.entries(recipe.ingredients)) needed[ing] = gram * quantity;

    for (let [ing, need] of Object.entries(needed)) {
        const stock = userIngredients.find(i => i.name === ing);
        if (!stock || stock.quantity < need) {
            return { success: false, shortages: Object.keys(needed) };
        }
    }
    for (let [ing, need] of Object.entries(needed)) {
        const stock = userIngredients.find(i => i.name === ing);
        stock.quantity -= need;
    }
    saveAllData();
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