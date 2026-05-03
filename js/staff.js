// Staff UI: render recipes, manage cart, and checkout (save to daily_sales)
(function(){
    const recipesEl = document.getElementById('recipesList');
    const productsPalette = document.getElementById('productsPalette');
    const cartItemsEl = document.getElementById('cartItems');
    const cartTotalEl = document.getElementById('cartTotal');
    const checkoutBtn = document.getElementById('checkoutBtn');

    let recipes = [];
    let cart = [];

    function formatCurrency(v){ return Number(v||0).toLocaleString(); }

    function renderRecipesList(){
        if(!recipesEl) return;
        if(!recipes.length) { recipesEl.innerHTML = '<div>Không có công thức</div>'; return; }
        recipesEl.innerHTML = '';
        recipes.forEach(r=>{
            const card = document.createElement('div');
            card.className = 'recipe-card';
            card.innerHTML = `<h4>${r.name}</h4><div class="sub">${r.category||''}</div><div style="margin-top:8px;">${r.description||''}</div><div style="margin-top:10px;"><button data-id="${r.id}">Thêm vào giỏ</button></div>`;
            const btn = card.querySelector('button');
            btn.addEventListener('click', ()=>{ addToCart(r,1); });
            recipesEl.appendChild(card);
        });
    }

    function renderProductsPalette(){
        if(!productsPalette) return;
        productsPalette.innerHTML = '';
        recipes.forEach(r=>{
            const t = document.createElement('div');
            t.className = 'product-tile';
            t.innerHTML = `<div>${r.name}</div><div style="display:flex;gap:8px;align-items:center;"><input class="qty-input" type="number" min="1" value="1" data-id="${r.id}"><button data-id="${r.id}">Thêm</button></div>`;
            const btn = t.querySelector('button');
            const input = t.querySelector('input');
            btn.addEventListener('click', ()=>{ addToCart(r, Number(input.value||1)); });
            productsPalette.appendChild(t);
        });
    }

    function addToCart(product, qty){
        const existing = cart.find(c=>c.id===product.id);
        if(existing){ existing.qty += qty; }
        else { cart.push({ id: product.id, name: product.name, qty: qty, price: product.price || 0 }); }
        renderCart();
    }

    function renderCart(){
        if(!cartItemsEl) return;
        if(!cart.length){ cartItemsEl.innerHTML = 'Giỏ hàng trống'; cartTotalEl.innerText = '0'; return; }
        cartItemsEl.innerHTML = '';
        let total = 0;
        cart.forEach(item=>{
            const el = document.createElement('div'); el.className='cart-item';
            const price = Number(item.price||0);
            const subtotal = price * item.qty;
            total += subtotal;
            el.innerHTML = `<div style="flex:1"><strong>${item.name}</strong><div class="sub">Số lượng: <input type="number" min="1" value="${item.qty}" data-id="${item.id}" class="cart-qty" style="width:64px"></div></div><div style="text-align:right"><div>${formatCurrency(subtotal)} ₫</div><div style="margin-top:6px;"><button data-id="${item.id}" class="remove">Xóa</button></div></div>`;
            cartItemsEl.appendChild(el);
        });
        // attach qty/change handlers
        cartItemsEl.querySelectorAll('.cart-qty').forEach(inp=>{
            inp.addEventListener('change', (e)=>{
                const id = Number(e.target.dataset.id);
                const v = Math.max(1, Number(e.target.value||1));
                const it = cart.find(c=>c.id===id); if(it){ it.qty = v; renderCart(); }
            });
        });
        cartItemsEl.querySelectorAll('.remove').forEach(b=>{
            b.addEventListener('click', ()=>{ const id=Number(b.dataset.id); cart=cart.filter(c=>c.id!==id); renderCart(); });
        });
        cartTotalEl.innerText = formatCurrency(total);
    }

    async function saveSaleToServer(item){
        try{
            const session = window.dbApi?.getSession?.() || {};
            await window.dbApi.addSale({ productId: Number(item.id), quantitySold: Number(item.qty), actualSalePrice: Number(item.price||0), masterId: session.masterUid, shopId: session.shopId });
            return { success:true };
        }catch(err){
            console.warn('Server sale failed, falling back to mock storage', err?.message||err);
            // Fallback to mock data (if available)
            if(typeof getMockData === 'function' && typeof saveMockData === 'function'){
                const d = getMockData(); d.sales = d.sales || [];
                d.sales.push({ id: d.sales.length+1, shop_id: (window.dbApi?.getSession?.()?.shopId||''), product_id: item.id, quantity_sold: item.qty, actual_sale_price: item.price||0, date: new Date().toISOString() });
                saveMockData(d);
                return { success:true, fallback:true };
            }
            throw err;
        }
    }

    async function doCheckout(){
        if(!cart.length) return alert('Giỏ hàng trống');
        checkoutBtn.disabled = true; checkoutBtn.innerText = 'Đang xử lý...';
        try{
            for(const item of cart){
                await saveSaleToServer(item);
            }
            cart = [];
            renderCart();
            alert('Thanh toán thành công');
        }catch(err){
            alert('Thanh toán gặp lỗi: ' + (err?.message||err));
        }finally{
            checkoutBtn.disabled = false; checkoutBtn.innerText = 'Thanh toán';
        }
    }

    // Tab handling & logout stub
    function bindTabs(){
        document.querySelectorAll('.tab-btn').forEach(b=>{
            b.addEventListener('click', ()=>{
                document.querySelectorAll('.tab-btn').forEach(x=>x.classList.remove('active'));
                document.querySelectorAll('.tab-pane').forEach(p=>p.classList.remove('active'));
                b.classList.add('active');
                const t = b.dataset.tab; document.getElementById(t).classList.add('active');
            });
        });
    }

    function logout(){
        if(window.dbApi?.clearSession) window.dbApi.clearSession();
        window.location.href = '../index.html';
    }
    window.logout = logout;

    async function loadRecipes(){
        try{
            recipes = await window.dbApi.getRecipes();
        }catch(err){
            // fallback to mock
            if(typeof getMockData === 'function'){
                const d = getMockData(); recipes = d.recipes || [];
            }else{ recipes = []; }
        }
        renderRecipesList(); renderProductsPalette();
    }

    // wire up
    document.addEventListener('DOMContentLoaded', ()=>{
        bindTabs();
        if(document.getElementById('currentUser')){
            const s = window.dbApi?.getSession?.(); document.getElementById('currentUser').innerText = s?.masterId || s?.masterUid || s?.shopId || '';
        }
        if(checkoutBtn) checkoutBtn.addEventListener('click', doCheckout);
        loadRecipes();
        renderCart();
    });
})();
