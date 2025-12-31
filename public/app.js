
const API_BASE = "/api";
const CART_KEY = "qiu-cart";
const SESSION_KEY = "qiu-session";

const ui = {
  navButtons: document.querySelectorAll(".nav-btn"),
  panels: document.querySelectorAll(".panel"),
  productGrid: document.getElementById("product-grid"),
  productDetail: document.getElementById("product-detail"),
  detailMedia: document.getElementById("detail-media"),
  detailTitle: document.getElementById("detail-title"),
  detailSummary: document.getElementById("detail-summary"),
  detailCategory: document.getElementById("detail-category"),
  detailPrice: document.getElementById("detail-price"),
  detailStock: document.getElementById("detail-stock"),
  detailAdd: document.getElementById("detail-add"),
  closeDetail: document.getElementById("close-detail"),
  searchInput: document.getElementById("search-input"),
  categoryFilter: document.getElementById("category-filter"),
  pagePrev: document.getElementById("page-prev"),
  pageNext: document.getElementById("page-next"),
  pageInfo: document.getElementById("page-info"),
  cartItems: document.getElementById("cart-items"),
  cartSummary: document.getElementById("cart-summary"),
  checkoutForm: document.getElementById("checkout-form"),
  checkoutNote: document.getElementById("checkout-note"),
  ordersList: document.getElementById("orders-list"),
  adminLocked: document.getElementById("admin-locked"),
  adminPanels: document.getElementById("admin-panels"),
  productForm: document.getElementById("product-form"),
  productCancel: document.getElementById("product-cancel"),
  productSubmit: document.getElementById("product-submit"),
  productList: document.getElementById("product-list"),
  adminOrders: document.getElementById("admin-orders"),
  salesChart: document.getElementById("sales-chart"),
  statsOrders: document.getElementById("stats-orders"),
  statsRevenue: document.getElementById("stats-revenue"),
  customerList: document.getElementById("customer-list"),
  metricOrders: document.getElementById("metric-orders"),
  metricRevenue: document.getElementById("metric-revenue"),
  metricOrdersLabel: document.getElementById("metric-orders-label"),
  metricRevenueLabel: document.getElementById("metric-revenue-label"),
  metricsTitle: document.getElementById("metrics-title"),
  metricsSubtitle: document.getElementById("metrics-subtitle"),
  openBuyerSummary: document.getElementById("open-buyer-summary"),
  buyerSummaryDialog: document.getElementById("buyer-summary-dialog"),
  buyerSummaryList: document.getElementById("buyer-summary-list"),
  buyerSummaryTotal: document.getElementById("buyer-summary-total"),
  buyerSummarySub: document.getElementById("buyer-summary-sub"),
  closeBuyerSummary: document.getElementById("close-buyer-summary"),
  authStatus: document.getElementById("auth-status"),
  openAuth: document.getElementById("open-auth"),
  logout: document.getElementById("logout"),
  authModal: document.getElementById("auth-modal"),
  authTabs: document.querySelectorAll("[data-auth-tab]"),
  authPanels: document.querySelectorAll("[data-auth-panel]"),
  loginForm: document.getElementById("login-form"),
  registerForm: document.getElementById("register-form"),
  toast: document.getElementById("toast"),
  sessionSummary: document.getElementById("session-summary"),
  notifications: document.getElementById("notifications"),
  miniCart: document.getElementById("mini-cart"),
};

const state = {
  products: [],
  adminProducts: [],
  orders: [],
  adminOrders: [],
  stats: { count: 0, revenue: 0, daily: [] },
  customers: [],
  categories: [],
  productCache: {},
  pagination: { page: 1, totalPages: 1, limit: 9, total: 0 },
};

let cart = loadCart();
let currentUser = null;
let sessionToken = null;
let editingProductId = null;
let editingProductImage = "";
let searchTimer = null;
let lastView = "shop";
const notifications = [];

initialize();

function initialize() {
  ui.navButtons.forEach((button) => {
    button.addEventListener("click", () => {
      setView(button.dataset.nav);
    });
  });

  ui.searchInput.addEventListener("input", () => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.pagination.page = 1;
      fetchProducts();
    }, 300);
  });

  ui.categoryFilter.addEventListener("change", () => {
    state.pagination.page = 1;
    fetchProducts();
  });

  ui.pagePrev.addEventListener("click", () => {
    if (state.pagination.page > 1) {
      state.pagination.page -= 1;
      fetchProducts();
    }
  });

  ui.pageNext.addEventListener("click", () => {
    if (state.pagination.page < state.pagination.totalPages) {
      state.pagination.page += 1;
      fetchProducts();
    }
  });

  ui.productGrid.addEventListener("click", handleProductGridClick);
  ui.closeDetail.addEventListener("click", closeDetail);
  ui.detailAdd.addEventListener("click", () => {
    const productId = ui.detailAdd.dataset.id;
    addToCart(productId, 1);
    closeDetail();
  });

  ui.cartItems.addEventListener("click", handleCartClick);
  ui.checkoutForm.addEventListener("submit", handleCheckout);

  ui.openAuth.addEventListener("click", () => ui.authModal.showModal());
  ui.logout.addEventListener("click", logout);

  ui.authTabs.forEach((tab) => {
    tab.addEventListener("click", () => switchAuthTab(tab.dataset.authTab));
  });

  ui.authModal.addEventListener("click", (event) => {
    if (event.target === ui.authModal) {
      ui.authModal.close();
    }
  });

  ui.authModal.querySelector(".close-dialog").addEventListener("click", () => {
    ui.authModal.close();
  });

  ui.loginForm.addEventListener("submit", handleLogin);
  ui.registerForm.addEventListener("submit", handleRegister);

  ui.productForm.addEventListener("submit", handleProductSubmit);
  ui.productCancel.addEventListener("click", resetProductForm);

  ui.productList.addEventListener("click", handleAdminProductClick);
  ui.adminOrders.addEventListener("change", handleAdminOrderChange);
  ui.sessionSummary.addEventListener("click", handleSessionSummaryClick);
  ui.openBuyerSummary.addEventListener("click", openBuyerSummary);
  ui.closeBuyerSummary.addEventListener("click", () => ui.buyerSummaryDialog.close());
  ui.buyerSummaryDialog.addEventListener("click", (event) => {
    if (event.target === ui.buyerSummaryDialog) {
      ui.buyerSummaryDialog.close();
    }
  });

  bootstrap();
}

async function bootstrap() {
  try {
    await restoreSession();
    await fetchCategories();
    await fetchProducts();
    await fetchOrders();
    await fetchAdminData();
  } catch (error) {
    showToast(error.message);
  }
  renderSession();
  renderCart();
  renderMiniCart();
  renderNotifications();
  updateMetrics();
  updateCheckoutPrefill();
  setView(getActiveView());
}

async function apiFetch(path, options = {}) {
  const config = {
    headers: {
      ...(options.headers || {}),
    },
    method: options.method || "GET",
  };

  if (!options.isFormData) {
    config.headers["Content-Type"] = "application/json";
  }

  if (sessionToken) {
    config.headers.Authorization = `Bearer ${sessionToken}`;
  }

  if (options.body) {
    config.body = options.isFormData
      ? options.body
      : typeof options.body === "string"
      ? options.body
      : JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE}${path}`, config);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload.message || "请求失败";
    throw new Error(message);
  }
  return payload;
}

async function restoreSession() {
  const saved = localStorage.getItem(SESSION_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    sessionToken = parsed.token || null;
    currentUser = parsed.user || null;
  }

  if (!sessionToken) {
    return;
  }

  try {
    const response = await apiFetch("/auth/me");
    currentUser = response.user;
    saveSession();
  } catch (_error) {
    clearSession();
  }
}

function saveSession() {
  if (!sessionToken || !currentUser) {
    clearSession();
    return;
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify({ token: sessionToken, user: currentUser }));
}

function clearSession() {
  sessionToken = null;
  currentUser = null;
  localStorage.removeItem(SESSION_KEY);
}

function loadCart() {
  const saved = localStorage.getItem(CART_KEY);
  return saved ? JSON.parse(saved) : [];
}

function saveCart() {
  localStorage.setItem(CART_KEY, JSON.stringify(cart));
}

async function fetchCategories() {
  try {
    state.categories = await apiFetch("/products/categories");
    updateCategoryFilter();
  } catch (_error) {
    state.categories = [];
  }
}

async function fetchProducts() {
  const query = ui.searchInput.value.trim();
  const category = ui.categoryFilter.value;
  const params = new URLSearchParams();
  if (query) params.set("search", query);
  if (category && category !== "all") params.set("category", category);
  params.set("page", String(state.pagination.page));
  params.set("limit", String(state.pagination.limit));

  try {
    const response = await apiFetch(`/products?${params.toString()}`);
    state.products = response.items || [];
    state.pagination.page = response.page || 1;
    state.pagination.totalPages = response.totalPages || 1;
    state.pagination.total = response.total || 0;
    state.products.forEach((product) => {
      state.productCache[product.id] = product;
    });
    updateCategoryFilter();
    renderProducts();
  } catch (error) {
    showToast(error.message);
  }
}

async function fetchOrders() {
  if (!currentUser) {
    state.orders = [];
    renderOrders();
    updateMetrics();
    return;
  }
  state.orders = await apiFetch("/orders");
  renderOrders();
  updateMetrics();
}

async function fetchAdminProducts() {
  if (!currentUser || currentUser.role !== "sales") {
    state.adminProducts = [];
    return;
  }
  const response = await apiFetch("/products?all=true");
  state.adminProducts = response.items || [];
}

async function fetchAdminData() {
  if (!currentUser || currentUser.role !== "sales") {
    state.adminOrders = [];
    state.customers = [];
    state.stats = { count: 0, revenue: 0, daily: [] };
    state.adminProducts = [];
    renderAdmin();
    return;
  }

  const [orders, stats, customers] = await Promise.all([
    apiFetch("/admin/orders"),
    apiFetch("/admin/stats"),
    apiFetch("/admin/customers"),
  ]);
  state.adminOrders = orders;
  state.stats = stats;
  state.customers = customers;
  await fetchAdminProducts();
  renderAdmin();
  updateMetrics();
}

function setView(viewName) {
  if (viewName === "admin" && (!currentUser || currentUser.role !== "sales")) {
    showToast("销售后台仅销售账号可访问");
    viewName = "shop";
  }

  lastView = viewName;
  ui.navButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.nav === viewName);
  });

  ui.panels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.view !== viewName);
  });
}

function getActiveView() {
  const activeButton = Array.from(ui.navButtons).find((button) =>
    button.classList.contains("active")
  );
  return activeButton ? activeButton.dataset.nav : lastView;
}

function updateCategoryFilter() {
  const current = ui.categoryFilter.value || "all";
  const categories = state.categories.length
    ? ["all", ...state.categories]
    : ["all", ...new Set(state.products.map((product) => product.category))];
  ui.categoryFilter.innerHTML = "";
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category === "all" ? "全部分类" : category;
    ui.categoryFilter.appendChild(option);
  });
  ui.categoryFilter.value = categories.includes(current) ? current : "all";
}

function renderProducts() {
  ui.productGrid.innerHTML = "";
  if (!state.products.length) {
    ui.productGrid.innerHTML = `<div class="callout">没有匹配的商品。</div>`;
    ui.pageInfo.textContent = "第 1 / 1 页";
    ui.pagePrev.disabled = true;
    ui.pageNext.disabled = true;
    return;
  }

  state.products.forEach((product, index) => {
    const card = document.createElement("article");
    card.className = "card product-card";
    card.style.animationDelay = `${index * 0.05}s`;
    const colors = product.colors && product.colors.length ? product.colors : ["#e9e2d7", "#f4f0e8"];
    const media = product.image
      ? `<img class="product-image" src="${product.image}" alt="${product.name}" />`
      : `<div class="product-art" style="background: linear-gradient(135deg, ${colors[0]}, ${colors[1]});"></div>`;
    card.innerHTML = `
      ${media}
      <div>
        <div class="metric-label">${product.category}</div>
        <div class="metric-value">${product.name}</div>
        <p class="muted small">${product.summary || ""}</p>
      </div>
      <div class="metric-value">${formatMoney(product.price)}</div>
      <div class="muted small">库存：${product.stock}</div>
      <div class="product-actions">
        <button class="btn ghost detail-btn" data-id="${product.id}">详情</button>
        <button class="btn primary add-btn" data-id="${product.id}">加入</button>
      </div>
    `;
    ui.productGrid.appendChild(card);
  });

  ui.pageInfo.textContent = `第 ${state.pagination.page} / ${state.pagination.totalPages} 页`;
  ui.pagePrev.disabled = state.pagination.page <= 1;
  ui.pageNext.disabled = state.pagination.page >= state.pagination.totalPages;
}

function handleProductGridClick(event) {
  const button = event.target.closest("button");
  if (!button) {
    return;
  }

  const productId = button.dataset.id;
  if (button.classList.contains("add-btn")) {
    addToCart(productId, 1);
  }
  if (button.classList.contains("detail-btn")) {
    openDetail(productId);
  }
}

function openDetail(productId) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) {
    return;
  }
  const colors = product.colors && product.colors.length ? product.colors : ["#e9e2d7", "#f4f0e8"];
  if (product.image) {
    ui.detailMedia.style.background = "none";
    ui.detailMedia.innerHTML = `<img src="${product.image}" alt="${product.name}" />`;
  } else {
    ui.detailMedia.innerHTML = "";
    ui.detailMedia.style.background = `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`;
  }
  ui.detailTitle.textContent = product.name;
  ui.detailSummary.textContent = product.summary || "";
  ui.detailCategory.textContent = product.category;
  ui.detailPrice.textContent = formatMoney(product.price);
  ui.detailStock.textContent = product.stock;
  ui.detailAdd.dataset.id = product.id;
  ui.productDetail.classList.remove("hidden");
  logAction(`浏览商品：${product.name}`);
}

function closeDetail() {
  ui.productDetail.classList.add("hidden");
}

function addToCart(productId, qty) {
  const product = state.products.find((item) => item.id === productId);
  if (!product) {
    return;
  }
  if (product.stock === 0) {
    showToast("商品已售罄");
    return;
  }

  const existing = cart.find((item) => item.productId === productId);
  if (existing) {
    const nextQty = Math.min(existing.qty + qty, product.stock);
    existing.qty = nextQty;
  } else {
    cart.push({
      productId: product.id,
      name: product.name,
      price: product.price,
      qty: Math.min(qty, product.stock),
    });
  }

  saveCart();
  renderCart();
  renderMiniCart();
  logAction(`加入购物车：${product.name}`);
  showToast(`${product.name} 已加入购物车`);
}

function renderCart() {
  ui.cartItems.innerHTML = "";
  if (!cart.length) {
    ui.cartItems.innerHTML = `<div class="callout">购物车是空的。</div>`;
    ui.cartSummary.innerHTML = "";
    return;
  }

  cart.forEach((item) => {
    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <div>
        <div class="metric-value">${item.name}</div>
        <div class="muted small">${formatMoney(item.price)} / 件</div>
      </div>
      <div class="qty-controls">
        <button data-action="decrease" data-id="${item.productId}">-</button>
        <span>${item.qty}</span>
        <button data-action="increase" data-id="${item.productId}">+</button>
      </div>
      <button class="btn ghost" data-action="remove" data-id="${item.productId}">移除</button>
    `;
    ui.cartItems.appendChild(row);
  });

  const totals = calculateTotals();
  ui.cartSummary.innerHTML = `
    <div class="card">
      <div class="stack">
        <div class="metric-label">商品件数</div>
        <div class="metric-value">${totals.items} 件</div>
        <div class="metric-label">小计</div>
        <div class="metric-value">${formatMoney(totals.subtotal)}</div>
        <div class="metric-label">税费</div>
        <div class="metric-value">${formatMoney(totals.tax)}</div>
        <div class="metric-label">合计</div>
        <div class="metric-value">${formatMoney(totals.total)}</div>
      </div>
    </div>
  `;
}

async function handleCartClick(event) {
  const action = event.target.dataset.action;
  const productId = event.target.dataset.id;
  if (!action || !productId) {
    return;
  }

  const item = cart.find((entry) => entry.productId === productId);
  if (!item) {
    return;
  }

  if (action === "increase") {
    let product = state.products.find((entry) => entry.id === productId);
    if (!product && state.productCache[productId]) {
      product = state.productCache[productId];
    }
    if (!product) {
      try {
        product = await apiFetch(`/products/${productId}`);
        if (product && product.id) {
          state.productCache[product.id] = product;
        }
      } catch (error) {
        showToast(error.message);
        return;
      }
    }

    if (!product) {
      showToast("商品信息已失效");
      return;
    }
    if (product && item.qty < product.stock) {
      item.qty += 1;
    } else {
      showToast("库存不足");
    }
  }

  if (action === "decrease") {
    item.qty -= 1;
    if (item.qty <= 0) {
      cart = cart.filter((entry) => entry.productId !== productId);
    }
  }

  if (action === "remove") {
    cart = cart.filter((entry) => entry.productId !== productId);
  }

  saveCart();
  renderCart();
  renderMiniCart();
}

async function handleCheckout(event) {
  event.preventDefault();
  if (!cart.length) {
    showToast("请先添加商品");
    return;
  }

  if (!currentUser) {
    showToast("请先登录后再结算");
    ui.authModal.showModal();
    return;
  }

  const formData = new FormData(ui.checkoutForm);
  const shipping = Object.fromEntries(formData.entries());
  const paymentMethod = shipping.paymentMethod;
  const paymentProvider = resolvePaymentProvider(paymentMethod);
  let paymentId = "";

  const payload = {
    items: cart.map((item) => ({ productId: item.productId, qty: item.qty })),
    shipping: {
      fullName: shipping.fullName,
      email: shipping.email,
      address: shipping.address,
      city: shipping.city,
      postal: shipping.postal,
      country: shipping.country,
    },
    paymentMethod,
  };

  try {
    if (paymentProvider) {
      const intent = await apiFetch(`/payments/${paymentProvider}/intent`, {
        method: "POST",
        body: { items: payload.items },
      });
      paymentId = intent.paymentId;
      showToast(`${paymentMethod} 已创建，正在模拟支付`);
    }

    const orderResponse = await apiFetch("/orders", {
      method: "POST",
      body: { ...payload, paymentProvider, paymentId },
    });
    if (orderResponse.mailWarning) {
      showToast(orderResponse.mailWarning);
      pushNotification(orderResponse.mailWarning);
    }

    if (paymentProvider) {
      const webhookResponse = await apiFetch(`/payments/${paymentProvider}/webhook`, {
        method: "POST",
        body: {
          paymentId,
          status: paymentProvider === "stripe" ? "succeeded" : "TRADE_SUCCESS",
        },
      });
      if (webhookResponse.mailWarning) {
        showToast(webhookResponse.mailWarning);
        pushNotification(webhookResponse.mailWarning);
        pushNotification("支付成功，但未发送确认邮件。");
      } else {
        pushNotification(`支付成功，确认邮件已发送至 ${shipping.email}。`);
      }
      showToast("支付成功，订单已确认");
    } else {
      if (orderResponse.mailWarning) {
        pushNotification("订单已创建，但未发送确认邮件。");
        showToast("下单成功，但未发送邮件");
      } else {
        pushNotification(`订单已创建，确认邮件已发送至 ${shipping.email}。`);
        showToast("下单成功，邮件已发送");
      }
    }

    cart = [];
    saveCart();
    await fetchProducts();
    await fetchOrders();
    await fetchAdminData();
    renderCart();
    renderMiniCart();
  } catch (error) {
    showToast(error.message);
  }
}

function renderOrders() {
  ui.ordersList.innerHTML = "";

  if (!currentUser) {
    ui.ordersList.innerHTML = `<div class="callout">登录后可查看订单。</div>`;
    return;
  }

  if (!state.orders.length) {
    ui.ordersList.innerHTML = `<div class="callout">暂无订单。</div>`;
    return;
  }

  state.orders.forEach((order) => {
    const card = document.createElement("div");
    card.className = "card";
    const paymentStatus = order.isPaid ? "已支付" : "待支付";
    const paymentMethod = order.payment && order.payment.method ? order.payment.method : "未知";
    card.innerHTML = `
      <div class="order-head">
        <div>
          <div class="metric-label">订单号 ${order.id}</div>
          <div class="metric-value">${formatMoney(order.total)}</div>
          <div class="muted small">${formatDate(order.createdAt)}</div>
        </div>
        <div class="order-status">${order.status}</div>
      </div>
      <div class="muted small">支付方式：${paymentMethod} · ${paymentStatus}</div>
      <div class="order-items">
        ${order.items
          .map(
            (item) =>
              `<div>${item.qty}x ${item.name} <span class="muted small">${formatMoney(
                item.price
              )}</span></div>`
          )
          .join("")}
      </div>
      <div class="timeline">
        ${order.timeline.map((step) => `<span>${step.label}</span>`).join("")}
      </div>
    `;
    ui.ordersList.appendChild(card);
  });
}

function renderAdmin() {
  const isSales = currentUser && currentUser.role === "sales";

  ui.adminLocked.classList.toggle("hidden", isSales);
  ui.adminPanels.classList.toggle("hidden", !isSales);

  renderAdminProducts();
  renderAdminOrders();
  renderSalesStats();
  renderCustomers();
}

function renderAdminProducts() {
  ui.productList.innerHTML = "";
  state.adminProducts.forEach((product) => {
    const row = document.createElement("div");
    row.className = "card";
    row.innerHTML = `
      <div class="metric-label">${product.category}</div>
      <div class="metric-value">${product.name}</div>
      <div class="muted small">${formatMoney(product.price)} | 库存 ${product.stock}</div>
      <div class="product-actions">
        <button class="btn ghost" data-action="edit" data-id="${product.id}">编辑</button>
        <button class="btn ghost" data-action="delete" data-id="${product.id}">删除</button>
      </div>
    `;
    ui.productList.appendChild(row);
  });
}

function renderAdminOrders() {
  ui.adminOrders.innerHTML = "";
  if (!state.adminOrders.length) {
    ui.adminOrders.innerHTML = `<div class="callout">暂无订单。</div>`;
    return;
  }

  state.adminOrders.forEach((order) => {
    const card = document.createElement("div");
    card.className = "card";
    const customerName = order.user ? order.user.name : "顾客";
    const paymentStatus = order.isPaid ? "已支付" : "待支付";
    card.innerHTML = `
      <div class="order-head">
        <div>
          <div class="metric-label">${customerName}</div>
          <div class="metric-value">${formatMoney(order.total)}</div>
          <div class="muted small">${paymentStatus}</div>
        </div>
        <select class="order-status-select" data-id="${order.id}">
          ${["处理中", "已发货", "已送达"].map((status) => {
            const selected = order.status === status ? "selected" : "";
            return `<option value="${status}" ${selected}>${status}</option>`;
          })}
        </select>
      </div>
      <div class="muted small">${order.items
        .map((item) => `${item.qty}x ${item.name}`)
        .join("，")}</div>
    `;
    ui.adminOrders.appendChild(card);
  });
}

function renderSalesStats() {
  ui.statsOrders.textContent = state.stats.count || 0;
  ui.statsRevenue.textContent = formatMoney(state.stats.revenue || 0);
  renderSalesChart(state.stats.daily || []);
}

function renderSalesChart(dailyTotals) {
  const days = dailyTotals.length ? dailyTotals : getRecentDailyTotals();
  const mapped = days.map((entry) => ({
    label: formatDayLabel(entry.label),
    value: entry.value,
  }));
  const max = Math.max(...mapped.map((entry) => entry.value), 0);
  ui.salesChart.innerHTML = "";

  mapped.forEach((entry) => {
    const bar = document.createElement("div");
    bar.className = "chart-bar";
    const height = max === 0 ? 10 : Math.max((entry.value / max) * 100, 10);
    bar.style.height = `${height}%`;
    bar.innerHTML = `<span>${entry.label}</span>`;
    ui.salesChart.appendChild(bar);
  });
}

function renderCustomers() {
  ui.customerList.innerHTML = "";
  if (!state.customers.length) {
    ui.customerList.innerHTML = `<div class="callout">暂无客户。</div>`;
    return;
  }

  state.customers.forEach((user) => {
    const card = document.createElement("div");
    card.className = "card";
    const logs = (user.logs || []).slice(-4).reverse();
    card.innerHTML = `
      <div class="metric-value">${user.name}</div>
      <div class="muted small">${user.email} · ${user.role}</div>
      <div class="muted small">订单 ${user.orderCount || 0} 笔 · ${formatMoney(
      user.orderTotal || 0
    )}</div>
      <div class="log-list">
        ${
          logs.length
            ? logs.map((log) => `<div class="muted small">${log.action}</div>`).join("")
            : `<div class="muted small">暂无行为记录。</div>`
        }
      </div>
    `;
    ui.customerList.appendChild(card);
  });
}

async function handleAdminProductClick(event) {
  const action = event.target.dataset.action;
  const productId = event.target.dataset.id;
  if (!action || !productId) {
    return;
  }

  if (action === "edit") {
    const product = state.adminProducts.find((item) => item.id === productId);
    if (!product) {
      return;
    }
    editingProductId = productId;
    editingProductImage = product.image || "";
    ui.productForm.name.value = product.name;
    ui.productForm.category.value = product.category;
    ui.productForm.price.value = product.price;
    ui.productForm.stock.value = product.stock;
    ui.productForm.summary.value = product.summary || "";
    ui.productForm.colorA.value = product.colors && product.colors[0] ? product.colors[0] : "";
    ui.productForm.colorB.value = product.colors && product.colors[1] ? product.colors[1] : "";
    ui.productSubmit.textContent = "更新商品";
  }

  if (action === "delete") {
    try {
      await apiFetch(`/products/${productId}`, { method: "DELETE" });
      await fetchCategories();
      await fetchProducts();
      await fetchAdminData();
      renderCart();
      renderMiniCart();
      showToast("商品已删除");
    } catch (error) {
      showToast(error.message);
    }
  }
}

async function uploadImage(file) {
  const formData = new FormData();
  formData.append("image", file);
  const result = await apiFetch("/uploads", {
    method: "POST",
    body: formData,
    isFormData: true,
  });
  return result.url;
}

async function handleProductSubmit(event) {
  event.preventDefault();
  const formData = new FormData(ui.productForm);
  const payload = Object.fromEntries(formData.entries());
  const colors = [payload.colorA || "#e9e2d7", payload.colorB || "#f4f0e8"];

  let imageUrl = editingProductImage;
  const imageFile = ui.productForm.image && ui.productForm.image.files[0];
  if (imageFile) {
    try {
      imageUrl = await uploadImage(imageFile);
    } catch (error) {
      showToast(error.message || "图片上传失败");
      return;
    }
  }

  const body = {
    name: payload.name,
    category: payload.category,
    price: Number(payload.price),
    stock: Number(payload.stock),
    summary: payload.summary || "",
    colors,
    image: imageUrl || "",
  };

  try {
    if (editingProductId) {
      await apiFetch(`/products/${editingProductId}`, { method: "PUT", body });
      showToast("商品已更新");
    } else {
      await apiFetch("/products", { method: "POST", body });
      showToast("商品已新增");
    }
    await fetchCategories();
    await fetchProducts();
    await fetchAdminData();
    resetProductForm();
  } catch (error) {
    showToast(error.message);
  }
}

function resetProductForm() {
  editingProductId = null;
  editingProductImage = "";
  ui.productForm.reset();
  ui.productSubmit.textContent = "新增商品";
}

async function handleAdminOrderChange(event) {
  if (!event.target.classList.contains("order-status-select")) {
    return;
  }

  const orderId = event.target.dataset.id;
  const status = event.target.value;
  try {
    const response = await apiFetch(`/admin/orders/${orderId}/status`, {
      method: "PUT",
      body: { status },
    });
    await fetchOrders();
    await fetchAdminData();
    if (response.mailWarning) {
      showToast(response.mailWarning);
    } else {
      showToast(`订单 ${orderId} 已更新`);
    }
  } catch (error) {
    showToast(error.message);
  }
}

function renderSession() {
  ui.sessionSummary.innerHTML = "";
  const summary = document.createElement("div");
  summary.className = "stack";

  if (currentUser) {
    const verifyLabel = currentUser.emailVerified ? "已验证" : "未验证";
    summary.innerHTML = `
      <div class="metric-label">已登录</div>
      <div class="metric-value">${currentUser.name}</div>
      <div class="muted small">${currentUser.email}</div>
      <div class="muted small">角色：${currentUser.role}</div>
      <div class="muted small">邮箱状态：${verifyLabel}</div>
    `;
    if (!currentUser.emailVerified) {
      summary.innerHTML += `
        <div class="callout">邮箱未验证，订单邮件不会发送。</div>
        <div class="stack">
          <input id="verify-code" type="text" placeholder="输入邮箱验证码" />
          <button class="btn primary" data-action="verify-email">验证邮箱</button>
          <button class="btn ghost" data-action="resend-code">重发验证码</button>
        </div>
      `;
    }
  } else {
    summary.innerHTML = `
      <div class="metric-label">游客会话</div>
      <div class="muted small">请登录或注册后体验完整功能。</div>
    `;
  }
  ui.sessionSummary.appendChild(summary);

  ui.authStatus.textContent = currentUser
    ? `${currentUser.name} · ${currentUser.role}`
    : "游客模式";
  ui.openAuth.classList.toggle("hidden", Boolean(currentUser));
  ui.logout.classList.toggle("hidden", !currentUser);

  const adminBtn = Array.from(ui.navButtons).find((btn) => btn.dataset.nav === "admin");
  if (adminBtn) {
    const locked = !currentUser || currentUser.role !== "sales";
    adminBtn.classList.toggle("disabled", locked);
  }

  updateMetrics();
}

async function handleLogin(event) {
  event.preventDefault();
  const formData = new FormData(ui.loginForm);
  const email = formData.get("email").trim().toLowerCase();
  const password = formData.get("password");
  try {
    const response = await apiFetch("/auth/login", {
      method: "POST",
      body: { email, password },
    });
    sessionToken = response.token;
    currentUser = response.user;
    saveSession();
    ui.authModal.close();
    renderSession();
    await fetchOrders();
    await fetchAdminData();
    updateCheckoutPrefill();
    if (currentUser && !currentUser.emailVerified) {
      showToast("邮箱未验证，请在侧边栏完成验证");
    } else {
      showToast("欢迎回来");
    }
  } catch (error) {
    showToast(error.message);
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const formData = new FormData(ui.registerForm);
  const payload = Object.fromEntries(formData.entries());
  try {
    const response = await apiFetch("/auth/register", {
      method: "POST",
      body: {
        name: payload.name,
        email: payload.email,
        password: payload.password,
        salesCode: payload.salesCode || "",
      },
    });
    sessionToken = response.token;
    currentUser = response.user;
    saveSession();
    ui.authModal.close();
    renderSession();
    await fetchOrders();
    await fetchAdminData();
    updateCheckoutPrefill();
    if (response.mailWarning) {
      showToast(response.mailWarning);
    } else {
      showToast("账号创建成功，验证码已发送");
    }
  } catch (error) {
    showToast(error.message);
  }
}

function logout() {
  clearSession();
  renderSession();
  fetchOrders();
  fetchAdminData();
  updateCheckoutPrefill();
  showToast("已退出登录");
}

function switchAuthTab(tabName) {
  ui.authTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.authTab === tabName);
  });
  ui.authPanels.forEach((panel) => {
    panel.classList.toggle("active", panel.dataset.authPanel === tabName);
  });
}

function updateCheckoutPrefill() {
  if (!currentUser) {
    ui.checkoutForm.reset();
    updateCheckoutNote();
    return;
  }
  ui.checkoutForm.fullName.value = currentUser.name;
  ui.checkoutForm.email.value = currentUser.email;
  updateCheckoutNote();
}

function updateCheckoutNote() {
  if (!currentUser) {
    ui.checkoutNote.textContent = "登录后可完成支付并发送确认邮件。";
  } else if (!currentUser.emailVerified) {
    ui.checkoutNote.textContent = "邮箱未验证，订单邮件将不会发送。";
  } else {
    ui.checkoutNote.textContent = `确认邮件将发送至 ${currentUser.email}。`;
  }
}

async function handleSessionSummaryClick(event) {
  const action = event.target.dataset.action;
  if (!action) {
    return;
  }
  if (action === "verify-email") {
    const input = ui.sessionSummary.querySelector("#verify-code");
    const code = input ? input.value.trim() : "";
    if (!code) {
      showToast("请输入邮箱验证码");
      return;
    }
    try {
      const response = await apiFetch("/auth/verify", {
        method: "POST",
        body: { code },
      });
      currentUser = response.user;
      saveSession();
      renderSession();
      updateCheckoutPrefill();
      showToast(response.message || "邮箱验证成功");
    } catch (error) {
      showToast(error.message);
    }
  }

  if (action === "resend-code") {
    try {
      const response = await apiFetch("/auth/resend", { method: "POST" });
      if (response.mailWarning) {
        showToast(response.mailWarning);
      } else {
        showToast(response.message || "验证码已发送");
      }
    } catch (error) {
      showToast(error.message);
    }
  }
}

function resolvePaymentProvider(method) {
  if (!method) return null;
  if (method.includes("Stripe")) return "stripe";
  if (method.includes("支付宝")) return "alipay";
  return null;
}

function calculateTotals() {
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);
  const tax = subtotal * 0.08;
  const total = subtotal + tax;
  const items = cart.reduce((sum, item) => sum + item.qty, 0);
  return { subtotal, tax, total, items };
}

function getRecentDailyTotals() {
  const days = [];
  for (let i = 4; i >= 0; i -= 1) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    days.push({ label: key, value: 0 });
  }
  return days;
}

function updateMetrics() {
  const isSales = currentUser && currentUser.role === "sales";
  const isBuyer = currentUser && currentUser.role === "customer";

  if (isSales) {
    ui.metricsTitle.textContent = "销售可视化";
    ui.metricsSubtitle.textContent = "商品、订单、统计、客户行为统一管理，实时掌握经营状态。";
    ui.metricOrdersLabel.textContent = "累计订单";
    ui.metricRevenueLabel.textContent = "累计收入";
    ui.metricOrders.textContent = state.stats.count || 0;
    ui.metricRevenue.textContent = formatMoney(state.stats.revenue || 0);
    ui.openBuyerSummary.classList.add("hidden");
    return;
  }

  ui.metricsTitle.textContent = "我的近30天消费";
  ui.metricsSubtitle.textContent = currentUser
    ? "点击查看最近30天购买明细与发货进度。"
    : "登录后查看近30天购买情况。";
  ui.metricOrdersLabel.textContent = "近30天商品数";
  ui.metricRevenueLabel.textContent = "近30天消费";

  const recentOrders = getRecentOrders();
  const { totalSpend, totalItems } = computeBuyerMetrics(recentOrders);
  ui.metricOrders.textContent = totalItems;
  ui.metricRevenue.textContent = formatMoney(totalSpend);
  ui.openBuyerSummary.classList.toggle("hidden", !isBuyer);
}

function renderMiniCart() {
  ui.miniCart.innerHTML = "";
  if (!cart.length) {
    ui.miniCart.innerHTML = `<div class="muted small">购物车为空。</div>`;
    return;
  }
  cart.forEach((item) => {
    const row = document.createElement("div");
    row.className = "muted small";
    row.textContent = `${item.qty}x ${item.name}`;
    ui.miniCart.appendChild(row);
  });
}

function logAction(action) {
  if (!currentUser) {
    return;
  }
  apiFetch("/logs", { method: "POST", body: { action } }).catch(() => {});
}

function pushNotification(message) {
  notifications.unshift({ message, at: new Date().toISOString() });
  if (notifications.length > 5) {
    notifications.pop();
  }
  renderNotifications();
}

function renderNotifications() {
  ui.notifications.innerHTML = "";
  if (!notifications.length) {
    ui.notifications.innerHTML = `<li class="muted small">暂无通知。</li>`;
    return;
  }
  notifications.forEach((note) => {
    const item = document.createElement("li");
    item.textContent = note.message;
    ui.notifications.appendChild(item);
  });
}

function getRecentOrders() {
  if (!currentUser) {
    return [];
  }
  const since = new Date();
  since.setDate(since.getDate() - 30);
  return state.orders.filter((order) => new Date(order.createdAt) >= since);
}

function computeBuyerMetrics(orders) {
  const totalSpend = orders.reduce((sum, order) => sum + (order.total || 0), 0);
  const totalItems = orders.reduce((sum, order) => {
    const count = (order.items || []).reduce((inner, item) => inner + (item.qty || 0), 0);
    return sum + count;
  }, 0);
  return { totalSpend, totalItems };
}

function resolveItemSummary(item) {
  if (item.summary) {
    return item.summary;
  }
  if (item.product && state.productCache[item.product]) {
    return state.productCache[item.product].summary || "";
  }
  return "";
}

function renderBuyerSummary() {
  const orders = getRecentOrders().sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
  );
  const { totalSpend, totalItems } = computeBuyerMetrics(orders);
  ui.buyerSummaryTotal.textContent = formatMoney(totalSpend);
  ui.buyerSummarySub.textContent = `共 ${totalItems} 件商品 · ${orders.length} 笔订单`;
  ui.buyerSummaryList.innerHTML = "";

  if (!orders.length) {
    ui.buyerSummaryList.innerHTML = `<div class="callout">近30天暂无购买记录。</div>`;
    return;
  }

  orders.forEach((order) => {
    const shipped = order.status === "已发货" || order.status === "已送达";
    const delivered = order.status === "已送达";
    (order.items || []).forEach((item) => {
      const row = document.createElement("div");
      row.className = "summary-row";
      const summary = resolveItemSummary(item) || "暂无介绍";
      row.innerHTML = `
        <span>${formatDate(order.createdAt)}</span>
        <span>${item.name}</span>
        <span class="muted">${summary}</span>
        <span>${item.qty}</span>
        <span>${shipped ? "已发货" : "未发货"}</span>
        <span>${delivered ? "已签收" : "未签收"}</span>
      `;
      ui.buyerSummaryList.appendChild(row);
    });
  });
}

function openBuyerSummary() {
  if (!currentUser) {
    showToast("请先登录后查看");
    ui.authModal.showModal();
    return;
  }
  if (currentUser.role !== "customer") {
    return;
  }
  renderBuyerSummary();
  ui.buyerSummaryDialog.showModal();
}

function showToast(message) {
  ui.toast.textContent = message;
  ui.toast.classList.add("show");
  setTimeout(() => ui.toast.classList.remove("show"), 2400);
}

function formatMoney(amount) {
  return `￥${Number(amount || 0).toFixed(2)}`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("zh-CN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDayLabel(dateKey) {
  const date = new Date(dateKey);
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}
