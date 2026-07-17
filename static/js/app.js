/* ============================================================
   Foodie Express - Frontend JavaScript (app.js) — Enhanced
   KEY FIX: category filter now uses addEventListener, not
   inline onclick, so it always works regardless of render order.
   ============================================================ */

// ---- GLOBAL STATE ----
let currentUser    = null;
let menuData       = [];   // all items from API
let activeCategory = '';   // currently selected category tab
let promoDiscount  = 0;    // promo code discount amount
let detailItem     = null; // item shown in detail modal

// ============================================================
// ROUTER
// ============================================================
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  const el = document.getElementById('page-' + page);
  if (el) el.classList.add('active');

  const link = document.querySelector(`.nav-link[data-page="${page}"]`);
  if (link) link.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Page-specific loaders
  if (page === 'home')     loadMenu();
  if (page === 'cart')     { if (!requireAuth()) return; loadCart(); }
  if (page === 'checkout') loadCheckoutSummary();
  if (page === 'orders')   { if (!requireAuth()) return; loadOrders(); }
  if (page === 'profile')  { if (!requireAuth()) return; loadProfile(); }
  if (page === 'admin')    {
    if (currentUser?.role !== 'admin') { navigate('home'); return; }
    loadAdminMenu();
  }
}

function requireAuth() {
  if (!currentUser) { navigate('login'); return false; }
  return true;
}

// ============================================================
// API HELPER
// ============================================================
async function api(method, path, body = null) {
  try {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include'
    };
    if (body) opts.body = JSON.stringify(body);
    const res  = await fetch(path, opts);
    return await res.json();
  } catch (e) {
    return { success: false, message: 'Network error. Is the server running?' };
  }
}

// ============================================================
// TOAST
// ============================================================
let toastTimer = null;
function toast(msg, type = 'default') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = 'toast show ' + type;
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = 'toast'; }, 3200);
}

// ============================================================
// AUTH
// ============================================================
async function checkSession() {
  const data = await api('GET', '/api/me');
  if (data.success) {
    currentUser = data.data;
    updateNavForUser();
  }
}

function updateNavForUser() {
  const loginBtn     = document.getElementById('loginBtn');
  const userMenu     = document.getElementById('userMenu');
  const greeting     = document.getElementById('userGreeting');
  const adminLink    = document.querySelector('.admin-only');
  const profileLink  = document.getElementById('profileNavLink');
  const heroLoginBtn = document.getElementById('heroLoginBtn');

  // Mobile nav items
  const mobileProfile = document.getElementById('mobileProfile');
  const mobileAdmin   = document.getElementById('mobileAdmin');
  const mobileLogout  = document.getElementById('mobileLogout');
  const mobileLogin   = document.getElementById('mobileLogin');

  if (currentUser) {
    loginBtn.style.display   = 'none';
    userMenu.style.display   = 'flex';
    greeting.textContent     = '👋 ' + currentUser.name.split(' ')[0];
    if (profileLink)  profileLink.style.display  = 'inline';
    if (adminLink)    adminLink.style.display     = currentUser.role === 'admin' ? 'inline' : 'none';
    if (heroLoginBtn) heroLoginBtn.style.display  = 'none';
    if (mobileProfile) mobileProfile.style.display = 'block';
    if (mobileLogout)  mobileLogout.style.display  = 'block';
    if (mobileLogin)   mobileLogin.style.display   = 'none';
    if (mobileAdmin && currentUser.role === 'admin') mobileAdmin.style.display = 'block';
  } else {
    loginBtn.style.display   = 'inline-block';
    userMenu.style.display   = 'none';
    if (profileLink)  profileLink.style.display  = 'none';
    if (adminLink)    adminLink.style.display     = 'none';
    if (heroLoginBtn) heroLoginBtn.style.display  = 'inline-block';
    if (mobileProfile) mobileProfile.style.display = 'none';
    if (mobileAdmin)   mobileAdmin.style.display   = 'none';
    if (mobileLogout)  mobileLogout.style.display  = 'none';
    if (mobileLogin)   mobileLogin.style.display   = 'block';
  }
  refreshCartBadge();
}

function switchAuthTab(tab) {
  document.getElementById('loginForm').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('registerForm').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('tabLogin').classList.toggle('active',    tab === 'login');
  document.getElementById('tabRegister').classList.toggle('active', tab === 'register');
}

function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') { input.type = 'text';     btn.textContent = '🙈'; }
  else                           { input.type = 'password'; btn.textContent = '👁'; }
}

function checkPwStrength(val) {
  const bar = document.getElementById('pwStrength');
  if (!val) { bar.className = 'pw-strength'; return; }
  if (val.length < 6)  bar.className = 'pw-strength weak';
  else if (val.length < 10 || !/[0-9]/.test(val)) bar.className = 'pw-strength medium';
  else bar.className = 'pw-strength strong';
}

async function doLogin() {
  const email    = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errEl    = document.getElementById('loginError');
  errEl.textContent = '';

  if (!email || !password) { errEl.textContent = 'Please fill in all fields.'; return; }

  const btn = document.getElementById('loginSubmitBtn');
  btn.textContent = 'Logging in…'; btn.disabled = true;

  const data = await api('POST', '/api/login', { email, password });

  btn.textContent = 'Login →'; btn.disabled = false;

  if (data.success) {
    currentUser = data.data;
    updateNavForUser();
    toast('Welcome back, ' + currentUser.name.split(' ')[0] + '! 🎉', 'success');
    navigate('home');
  } else {
    errEl.textContent = data.message;
  }
}

async function doRegister() {
  const name     = document.getElementById('regName').value.trim();
  const email    = document.getElementById('regEmail').value.trim();
  const phone    = document.getElementById('regPhone').value.trim();
  const password = document.getElementById('regPassword').value;
  const confirm  = document.getElementById('regConfirm').value;
  const errEl    = document.getElementById('regError');
  errEl.textContent = '';

  if (!name || !email || !password) { errEl.textContent = 'Name, email & password are required.'; return; }
  if (password.length < 6)          { errEl.textContent = 'Password must be at least 6 characters.'; return; }
  if (password !== confirm)          { errEl.textContent = 'Passwords do not match.'; return; }

  const btn = document.getElementById('regSubmitBtn');
  btn.textContent = 'Creating…'; btn.disabled = true;

  const data = await api('POST', '/api/register', { name, email, phone, password });

  btn.textContent = 'Create Account →'; btn.disabled = false;

  if (data.success) {
    currentUser = data.data;
    updateNavForUser();
    toast('Account created! Welcome 🚀', 'success');
    navigate('home');
  } else {
    errEl.textContent = data.message;
  }
}

async function logout() {
  await api('POST', '/api/logout');
  currentUser  = null;
  menuData     = [];
  promoDiscount = 0;
  updateNavForUser();
  toast('Logged out successfully.');
  navigate('home');
}

// ============================================================
// MOBILE NAV
// ============================================================
function toggleMobileNav() {
  document.getElementById('mobileNav').classList.toggle('open');
}
function closeMobileNav() {
  document.getElementById('mobileNav').classList.remove('open');
}

// ============================================================
// MENU  ← THE KEY FIX IS HERE
// ============================================================
async function loadMenu() {
  const grid = document.getElementById('menuGrid');
  grid.innerHTML = '<div class="loading-spinner"><div class="spinner"></div><p>Loading…</p></div>';

  const data = await api('GET', '/api/menu');
  if (!data.success) {
    grid.innerHTML = '<div class="empty-state">Failed to load menu. Please refresh.</div>';
    return;
  }

  menuData       = data.data.items || [];
  activeCategory = '';                      // reset filter on fresh load

  buildCategoryTabs(data.data.categories || []);
  filterMenu();                             // render all items initially
}

/**
 * FIX: Build tabs using addEventListener instead of inline onclick.
 * This avoids timing issues where the handler fires before menuData is ready.
 */
function buildCategoryTabs(cats) {
  const container = document.getElementById('categoryTabs');
  container.innerHTML = '';  // clear old buttons

  // "All" button
  const allBtn = document.createElement('button');
  allBtn.type      = 'button';
  allBtn.className = 'tab active';
  allBtn.dataset.cat = '';
  allBtn.textContent = 'All';
  allBtn.addEventListener('click', () => setCategory(''));
  container.appendChild(allBtn);

  // One button per category
  cats.forEach(cat => {
    const btn = document.createElement('button');
    btn.type        = 'button';
    btn.className   = 'tab';
    btn.dataset.cat = cat;
    btn.textContent = cat;
    btn.addEventListener('click', () => setCategory(cat));
    container.appendChild(btn);
  });
}

function setCategory(cat) {
  activeCategory = cat;

  // Highlight the right tab
  document.querySelectorAll('#categoryTabs .tab').forEach(btn => {
    btn.classList.toggle('active', (btn.dataset.cat || '') === cat);
  });

  filterMenu();
}

function onSearch() {
  const val   = document.getElementById('searchInput').value;
  const clear = document.getElementById('searchClear');
  if (clear) clear.style.display = val ? 'block' : 'none';
  filterMenu();
}

function clearSearch() {
  document.getElementById('searchInput').value = '';
  const clear = document.getElementById('searchClear');
  if (clear) clear.style.display = 'none';
  filterMenu();
}

function filterMenu() {
  const search = (document.getElementById('searchInput')?.value || '').toLowerCase().trim();
  const sort   = document.getElementById('sortSelect')?.value || 'default';

  let filtered = menuData.filter(item => {
    const matchCat  = !activeCategory || String(item.category).trim() === String(activeCategory).trim();
    const matchText = !search ||
      item.name.toLowerCase().includes(search) ||
      (item.description || '').toLowerCase().includes(search) ||
      item.category.toLowerCase().includes(search);
    return matchCat && matchText;
  });

  // Sort
  if (sort === 'price-asc')  filtered.sort((a,b) => a.price - b.price);
  if (sort === 'price-desc') filtered.sort((a,b) => b.price - a.price);
  if (sort === 'name-asc')   filtered.sort((a,b) => a.name.localeCompare(b.name));

  const countEl = document.getElementById('resultsCount');
  if (countEl) countEl.textContent = `${filtered.length} item${filtered.length !== 1 ? 's' : ''} found`;

  renderMenuGrid(filtered);
}

function renderMenuGrid(items) {
  const grid = document.getElementById('menuGrid');
  if (!items.length) {
    grid.innerHTML = `<div class="empty-state">
      😕 No items found.<br/>
      <a href="#" onclick="clearSearch();setCategory('')">Show all items</a>
    </div>`;
    return;
  }
  grid.innerHTML = items.map(item => `
    <div class="menu-card" onclick="openItemDetail(${item.id})">
      <img class="card-img"
           src="${item.image_url || ''}"
           alt="${escHtml(item.name)}"
           onerror="this.src='https://via.placeholder.com/400x200?text=${encodeURIComponent(item.name)}'"/>
      <div class="card-body">
        <div class="card-category">${escHtml(item.category)}</div>
        <div class="card-name">${escHtml(item.name)}</div>
        <div class="card-desc">${escHtml(item.description || '')}</div>
        <div class="card-footer">
          <div class="card-price">₹${parseFloat(item.price).toFixed(0)}</div>
          <button class="btn-add" onclick="event.stopPropagation();addToCart(${item.id},'${escHtml(item.name)}')">
            + Add
          </button>
        </div>
      </div>
    </div>
  `).join('');
}

// ============================================================
// ITEM DETAIL MODAL
// ============================================================
function openItemDetail(itemId) {
  detailItem = menuData.find(i => i.id === itemId);
  if (!detailItem) return;

  document.getElementById('detailImg').src        = detailItem.image_url || '';
  document.getElementById('detailCategory').textContent = detailItem.category;
  document.getElementById('detailName').textContent     = detailItem.name;
  document.getElementById('detailDesc').textContent     = detailItem.description || '';
  document.getElementById('detailPrice').textContent    = '₹' + parseFloat(detailItem.price).toFixed(0);
  document.getElementById('detailQtyNum').textContent   = '1';
  updateDetailSubtotal();

  document.getElementById('itemDetailModal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

function closeItemDetail() {
  document.getElementById('itemDetailModal').style.display = 'none';
  document.body.style.overflow = '';
}

function detailQty(delta) {
  const el  = document.getElementById('detailQtyNum');
  const cur = parseInt(el.textContent) || 1;
  const nxt = Math.max(1, cur + delta);
  el.textContent = nxt;
  updateDetailSubtotal();
}

function updateDetailSubtotal() {
  if (!detailItem) return;
  const qty = parseInt(document.getElementById('detailQtyNum').textContent) || 1;
  const sub = parseFloat(detailItem.price) * qty;
  document.getElementById('detailSubtotal').textContent = 'Subtotal: ₹' + sub.toFixed(0);
}

async function addFromDetail() {
  if (!detailItem) return;
  const qty = parseInt(document.getElementById('detailQtyNum').textContent) || 1;
  await addToCart(detailItem.id, detailItem.name, qty);
  closeItemDetail();
}

// ============================================================
// CART
// ============================================================
async function addToCart(itemId, name, qty = 1) {
  if (!currentUser) { toast('Please login to add items 🔒', 'error'); navigate('login'); return; }

  const data = await api('POST', '/api/cart', { item_id: itemId, quantity: qty });
  if (data.success) {
    toast(`${name} added to cart 🛒`, 'success');
    refreshCartBadge();
  } else {
    toast(data.message, 'error');
  }
}

async function refreshCartBadge() {
  if (!currentUser) { updateCartBadge(0); return; }
  const data = await api('GET', '/api/cart');
  if (data.success) updateCartBadge(data.data.items.length);
}

function updateCartBadge(count) {
  const badge = document.getElementById('cartBadge');
  badge.textContent  = count;
  badge.style.background = count > 0 ? 'var(--accent)' : '#888';
}

async function loadCart() {
  const data = await api('GET', '/api/cart');
  if (!data.success) return;

  const items    = data.data.items || [];
  const subtotal = data.data.total;
  const container = document.getElementById('cartItems');
  const summary   = document.getElementById('cartSummary');
  const clearBtn  = document.getElementById('clearCartBtn');

  if (!items.length) {
    promoDiscount = 0;
    container.innerHTML = `<div class="empty-state">
      🛒 Your cart is empty.<br/>
      <a href="#" onclick="navigate('home')">Browse menu →</a>
    </div>`;
    summary.style.display   = 'none';
    clearBtn.style.display  = 'none';
    updateCartBadge(0);
    return;
  }

  summary.style.display  = 'block';
  clearBtn.style.display = 'inline-flex';
  updateCartBadge(items.length);

  container.innerHTML = items.map(item => `
    <div class="cart-item" id="cart-row-${item.item_id}">
      <img src="${item.image_url || ''}" alt="${escHtml(item.name)}"
           onerror="this.src='https://via.placeholder.com/88x88?text=Food'"/>
      <div class="cart-item-info">
        <div class="cart-item-name">${escHtml(item.name)}</div>
        <div class="cart-item-price">₹${parseFloat(item.price).toFixed(0)} each</div>
        <div class="qty-control">
          <button class="qty-btn" onclick="changeQty(${item.item_id}, ${item.quantity - 1})">−</button>
          <span class="qty-num">${item.quantity}</span>
          <button class="qty-btn" onclick="changeQty(${item.item_id}, ${item.quantity + 1})">+</button>
        </div>
      </div>
      <div style="text-align:right">
        <div style="font-weight:800;font-size:1.05rem">₹${parseFloat(item.subtotal).toFixed(0)}</div>
        <button class="remove-btn" onclick="removeItem(${item.item_id})" title="Remove">🗑</button>
      </div>
    </div>
  `).join('');

  // Summary lines
  document.getElementById('cartSummaryItems').innerHTML =
    items.map(i => `<div class="summary-item-line">
      <span>${escHtml(i.name)} ×${i.quantity}</span>
      <span>₹${parseFloat(i.subtotal).toFixed(0)}</span>
    </div>`).join('');

  updateCartTotals(subtotal);
}

function updateCartTotals(subtotal) {
  const delivery = 30;
  const total    = subtotal + delivery - promoDiscount;
  document.getElementById('summarySubtotal').textContent = '₹' + subtotal.toFixed(0);
  document.getElementById('summaryTotal').textContent    = '₹' + Math.max(0, total).toFixed(0);

  const promoRow = document.getElementById('promoRow');
  if (promoDiscount > 0) {
    promoRow.style.display = 'flex';
    document.getElementById('promoDiscount').textContent = '-₹' + promoDiscount.toFixed(0);
  } else {
    promoRow.style.display = 'none';
  }
}

async function changeQty(itemId, newQty) {
  if (newQty < 1) { await removeItem(itemId); return; }
  const data = await api('PUT', `/api/cart/${itemId}`, { quantity: newQty });
  if (data.success) loadCart();
  else toast(data.message, 'error');
}

async function removeItem(itemId) {
  const data = await api('DELETE', `/api/cart/${itemId}`);
  if (data.success) { toast('Item removed.'); loadCart(); }
  else toast(data.message, 'error');
}

async function clearCart() {
  if (!confirm('Clear your entire cart?')) return;
  const data = await api('DELETE', '/api/cart/clear');
  if (data.success) { toast('Cart cleared.'); loadCart(); }
}

// Promo code
const PROMO_CODES = { 'SAVE10': 10, 'FOODIE20': 20, 'FIRST50': 50 };

function applyPromo() {
  const code = (document.getElementById('promoInput').value || '').trim().toUpperCase();
  const msg  = document.getElementById('promoMsg');

  if (PROMO_CODES[code]) {
    promoDiscount = PROMO_CODES[code];
    msg.style.color = 'var(--success)';
    msg.textContent = `✅ Promo applied! You save ₹${promoDiscount}.`;
    toast('Promo code applied 🎉', 'success');
    loadCart();
  } else {
    msg.style.color = 'var(--error)';
    msg.textContent = '❌ Invalid promo code. Try SAVE10, FOODIE20 or FIRST50.';
  }
}

// ============================================================
// CHECKOUT
// ============================================================
async function loadCheckoutSummary() {
  const data = await api('GET', '/api/cart');
  if (!data.success || !data.data.items.length) { navigate('cart'); return; }

  const items    = data.data.items;
  const subtotal = data.data.total;
  const delivery = 30;
  const total    = subtotal + delivery - promoDiscount;

  document.getElementById('ckItems').innerHTML = items.map(item => `
    <div class="ck-item">
      <span>${escHtml(item.name)} × ${item.quantity}</span>
      <span>₹${parseFloat(item.subtotal).toFixed(0)}</span>
    </div>
  `).join('');

  document.getElementById('ckSubtotal').textContent = '₹' + subtotal.toFixed(0);
  document.getElementById('ckTotal').textContent    = '₹' + Math.max(0, total).toFixed(2);

  const ckPromoRow = document.getElementById('ckPromoRow');
  if (promoDiscount > 0) {
    ckPromoRow.style.display = 'flex';
    document.getElementById('ckPromoDiscount').textContent = '-₹' + promoDiscount.toFixed(0);
  } else {
    ckPromoRow.style.display = 'none';
  }

  // Pre-fill from profile
  if (currentUser) {
    document.getElementById('ckName').value    = currentUser.name    || '';
    document.getElementById('ckPhone').value   = currentUser.phone   || '';
    document.getElementById('ckAddress').value = currentUser.address || '';
  }
}

function selectPaymentCard(label) {
  document.querySelectorAll('.radio-card').forEach(c => c.classList.remove('active'));
  label.classList.add('active');
}

async function placeOrder() {
  const name    = document.getElementById('ckName').value.trim();
  const phone   = document.getElementById('ckPhone').value.trim();
  const address = document.getElementById('ckAddress').value.trim();
  const notes   = document.getElementById('ckNotes').value.trim();
  const payment = document.querySelector('input[name="payment"]:checked')?.value || 'Cash on Delivery';
  const errEl   = document.getElementById('checkoutError');
  errEl.textContent = '';

  if (!name)    { errEl.textContent = 'Please enter your name.';          return; }
  if (!phone)   { errEl.textContent = 'Please enter your phone number.';  return; }
  if (!address) { errEl.textContent = 'Please enter a delivery address.'; return; }

  const deliveryAddress = notes
    ? `${name}, ${phone}\n${address}\nNote: ${notes}`
    : `${name}, ${phone}\n${address}`;

  const btn = document.getElementById('placeOrderBtn');
  btn.textContent = '⏳ Placing order…'; btn.disabled = true;

  const data = await api('POST', '/api/orders', { delivery_address: deliveryAddress, payment_method: payment });

  btn.textContent = '🎉 Place Order'; btn.disabled = false;

  if (data.success) {
    promoDiscount = 0;
    updateCartBadge(0);
    document.getElementById('successMsg').textContent =
      `Order #${data.data.order_id} placed! Total paid: ₹${(data.data.total + 30).toFixed(2)}`;
    navigate('success');
  } else {
    errEl.textContent = data.message;
  }
}

// ============================================================
// ORDERS
// ============================================================
let allOrders = [];

async function loadOrders() {
  const data = await api('GET', '/api/orders');
  const container = document.getElementById('ordersList');

  if (!data.success) {
    container.innerHTML = '<div class="empty-state">Failed to load orders.</div>'; return;
  }
  allOrders = data.data || [];
  filterOrders();
}

function filterOrders() {
  const filter    = document.getElementById('orderStatusFilter')?.value || '';
  const container = document.getElementById('ordersList');
  const filtered  = filter ? allOrders.filter(o => o.status === filter) : allOrders;

  if (!filtered.length) {
    container.innerHTML = `<div class="empty-state">
      No orders found.<br/><a href="#" onclick="navigate('home')">Order something →</a>
    </div>`;
    return;
  }

  container.innerHTML = filtered.map(o => `
    <div class="order-card">
      <div class="order-header">
        <div>
          <span class="order-id">Order #${o.id}</span>
          <span style="font-size:.8rem;color:var(--mid);margin-left:10px">${o.payment_method}</span>
        </div>
        <span class="status-badge status-${o.status}">${o.status}</span>
      </div>
      <div class="order-items">
        ${o.items.map(i => `<span>• ${escHtml(i.name)} × ${i.quantity} (₹${parseFloat(i.unit_price).toFixed(0)})</span>`).join('<br/>')}
      </div>
      <div class="order-footer">
        <span>🕐 ${new Date(o.created_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
        <span class="order-total">₹${parseFloat(o.total_amount).toFixed(2)}</span>
      </div>
    </div>
  `).join('');
}

// ============================================================
// PROFILE
// ============================================================
async function loadProfile() {
  const data = await api('GET', '/api/me');
  if (!data.success) return;

  const u = data.data;
  currentUser = u;

  document.getElementById('profileAvatar').textContent = u.name ? u.name.charAt(0).toUpperCase() : '👤';
  document.getElementById('profileName').textContent   = u.name  || '—';
  document.getElementById('profileEmail').textContent  = u.email || '';
  document.getElementById('profileRole').textContent   = u.role === 'admin' ? '⚙️ Admin' : '🍔 Foodie';

  document.getElementById('pfName').value    = u.name    || '';
  document.getElementById('pfPhone').value   = u.phone   || '';
  document.getElementById('pfAddress').value = u.address || '';

  // Load order stats
  const oData = await api('GET', '/api/orders');
  if (oData.success) {
    const orders = oData.data || [];
    document.getElementById('pstatOrders').textContent =
      orders.length;
    document.getElementById('pstatSpent').textContent =
      '₹' + orders.reduce((s, o) => s + parseFloat(o.total_amount), 0).toFixed(0);
  }
}

async function saveProfile() {
  const name    = document.getElementById('pfName').value.trim();
  const phone   = document.getElementById('pfPhone').value.trim();
  const address = document.getElementById('pfAddress').value.trim();
  const msg     = document.getElementById('profileMsg');
  msg.textContent = '';

  const data = await api('PUT', '/api/profile', { name, phone, address });
  if (data.success) {
    currentUser.name    = name;
    currentUser.phone   = phone;
    currentUser.address = address;
    document.getElementById('userGreeting').textContent = '👋 ' + name.split(' ')[0];
    msg.textContent = '✅ Profile updated successfully!';
    toast('Profile saved!', 'success');
  } else {
    msg.style.color = 'var(--error)'; msg.textContent = data.message;
  }
}

async function changePassword() {
  const currentPw = document.getElementById('pfCurrentPw').value;
  const newPw     = document.getElementById('pfNewPw').value;
  const msg       = document.getElementById('pwChangeMsg');
  msg.textContent = '';

  if (!currentPw || !newPw) { msg.textContent = 'Both fields are required.'; return; }
  if (newPw.length < 6)     { msg.textContent = 'New password must be at least 6 characters.'; return; }

  const data = await api('PUT', '/api/profile/password', { current_password: currentPw, new_password: newPw });
  if (data.success) {
    document.getElementById('pfCurrentPw').value = '';
    document.getElementById('pfNewPw').value     = '';
    toast('Password updated!', 'success');
  } else {
    msg.textContent = data.message;
  }
}

// ============================================================
// ADMIN
// ============================================================
function adminTab(tab) {
  const menuPanel   = document.getElementById('adminMenuPanel');
  const ordersPanel = document.getElementById('adminOrdersPanel');
  document.getElementById('adminTabMenu').classList.toggle('active',   tab === 'menu');
  document.getElementById('adminTabOrders').classList.toggle('active', tab === 'orders');

  if (tab === 'menu') {
    menuPanel.style.display   = 'block';
    ordersPanel.style.display = 'none';
    loadAdminMenu();
  } else {
    menuPanel.style.display   = 'none';
    ordersPanel.style.display = 'block';
    loadAdminOrders();
    loadAdminStats();
  }
}

async function loadAdminStats() {
  const [menuData2, orderData] = await Promise.all([
    api('GET', '/api/menu'),
    api('GET', '/api/admin/orders')
  ]);

  const items   = menuData2.success  ? menuData2.data.items  : [];
  const orders  = orderData.success  ? orderData.data        : [];
  const revenue = orders.reduce((s, o) => s + parseFloat(o.total_amount), 0);
  const pending = orders.filter(o => o.status === 'pending').length;

  document.getElementById('adminStats').innerHTML = `
    <div class="stat-card"><div class="stat-card-icon">🍔</div><div><div class="stat-card-val">${items.length}</div><div class="stat-card-label">Menu Items</div></div></div>
    <div class="stat-card"><div class="stat-card-icon">📋</div><div><div class="stat-card-val">${orders.length}</div><div class="stat-card-label">Total Orders</div></div></div>
    <div class="stat-card"><div class="stat-card-icon">⏳</div><div><div class="stat-card-val">${pending}</div><div class="stat-card-label">Pending</div></div></div>
    <div class="stat-card"><div class="stat-card-icon">💰</div><div><div class="stat-card-val">₹${revenue.toFixed(0)}</div><div class="stat-card-label">Revenue</div></div></div>
  `;
}

async function loadAdminMenu() {
  loadAdminStats();
  const data = await api('GET', '/api/menu');
  if (!data.success) return;

  document.getElementById('adminMenuPanel').innerHTML = `
    <div class="admin-table-wrap">
      <table>
        <thead>
          <tr><th>ID</th><th>Name</th><th>Category</th><th>Price</th><th>Available</th><th>Actions</th></tr>
        </thead>
        <tbody>
          ${data.data.items.map(item => `
            <tr>
              <td>#${item.id}</td>
              <td><strong>${escHtml(item.name)}</strong></td>
              <td>${item.category}</td>
              <td>₹${parseFloat(item.price).toFixed(0)}</td>
              <td>${item.is_available ? '✅' : '❌'}</td>
              <td>
                <div class="admin-actions">
                  <button class="btn-edit"   onclick="openEditItemModal(${item.id})">✏️ Edit</button>
                  <button class="btn-delete" onclick="deleteMenuItem(${item.id})">🗑 Delete</button>
                </div>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function loadAdminOrders() {
  const data = await api('GET', '/api/admin/orders');
  if (!data.success) return;

  document.getElementById('adminOrdersPanel').innerHTML = `
    <div class="admin-table-wrap">
      <table>
        <thead>
          <tr><th>ID</th><th>Customer</th><th>Amount</th><th>Payment</th><th>Date</th><th>Status</th></tr>
        </thead>
        <tbody>
          ${data.data.map(o => `
            <tr>
              <td>#${o.id}</td>
              <td>${escHtml(o.user_name)}<br/><small style="color:var(--mid)">${o.user_email}</small></td>
              <td><strong>₹${parseFloat(o.total_amount).toFixed(0)}</strong></td>
              <td>${o.payment_method}</td>
              <td>${new Date(o.created_at).toLocaleDateString('en-IN')}</td>
              <td>
                <select class="status-select" onchange="updateOrderStatus(${o.id}, this.value)">
                  ${['pending','confirmed','preparing','delivered','cancelled'].map(s =>
                    `<option value="${s}" ${o.status === s ? 'selected' : ''}>${s}</option>`
                  ).join('')}
                </select>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function updateOrderStatus(orderId, status) {
  const data = await api('PUT', `/api/admin/orders/${orderId}/status`, { status });
  toast(data.success ? `Status → ${status} ✔` : data.message,
        data.success ? 'success' : 'error');
}

function openAddItemModal() {
  document.getElementById('modalTitle').textContent = 'Add Menu Item';
  document.getElementById('modalItemId').value = '';
  ['modalName','modalDesc','modalPrice','modalImage'].forEach(id => { document.getElementById(id).value = ''; });
  document.getElementById('modalAvailable').value = '1';
  document.getElementById('modalError').textContent = '';
  document.getElementById('itemModal').style.display = 'flex';
}

async function openEditItemModal(id) {
  const data = await api('GET', `/api/menu/${id}`);
  if (!data.success) return;
  const item = data.data;
  document.getElementById('modalTitle').textContent      = 'Edit Menu Item';
  document.getElementById('modalItemId').value           = item.id;
  document.getElementById('modalName').value             = item.name;
  document.getElementById('modalDesc').value             = item.description || '';
  document.getElementById('modalPrice').value            = item.price;
  document.getElementById('modalCategory').value         = item.category;
  document.getElementById('modalImage').value            = item.image_url || '';
  document.getElementById('modalAvailable').value        = String(item.is_available);
  document.getElementById('modalError').textContent      = '';
  document.getElementById('itemModal').style.display     = 'flex';
}

async function saveMenuItem() {
  const id      = document.getElementById('modalItemId').value;
  const errEl   = document.getElementById('modalError');
  const payload = {
    name:         document.getElementById('modalName').value.trim(),
    description:  document.getElementById('modalDesc').value.trim(),
    price:        parseFloat(document.getElementById('modalPrice').value),
    category:     document.getElementById('modalCategory').value,
    image_url:    document.getElementById('modalImage').value.trim(),
    is_available: parseInt(document.getElementById('modalAvailable').value)
  };

  if (!payload.name || !payload.price || !payload.category) {
    errEl.textContent = 'Name, price and category are required.'; return;
  }

  const data = id
    ? await api('PUT',  `/api/admin/menu/${id}`, payload)
    : await api('POST', '/api/admin/menu',        payload);

  if (data.success) {
    toast(id ? 'Item updated ✔' : 'Item added ✔', 'success');
    closeModal();
    loadAdminMenu();
    loadMenu();      // refresh public menu too
  } else {
    errEl.textContent = data.message;
  }
}

async function deleteMenuItem(id) {
  if (!confirm('Delete this menu item? This cannot be undone.')) return;
  const data = await api('DELETE', `/api/admin/menu/${id}`);
  if (data.success) { toast('Item deleted.', 'success'); loadAdminMenu(); loadMenu(); }
  else toast(data.message, 'error');
}

function closeModal() {
  document.getElementById('itemModal').style.display = 'none';
}

// ============================================================
// UTILITIES
// ============================================================
function escHtml(str) {
  return String(str).replace(/[&<>"']/g,
    c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// Back-to-top button visibility
window.addEventListener('scroll', () => {
  const btn = document.getElementById('backToTop');
  if (btn) btn.classList.toggle('visible', window.scrollY > 400);
});

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  await checkSession();
  navigate('home');
});