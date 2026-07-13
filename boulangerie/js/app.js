/*
 * app.js — Application de gestion de boulangerie
 * Routage, rendu des vues et logique métier.
 */
(function (global) {
  'use strict';

  const CATEGORIES = ['Pains', 'Viennoiseries', 'Pâtisseries', 'Boissons', 'Autre'];
  const UNITS = ['kg', 'g', 'L', 'ml', 'unité', 'sachet'];
  const EXPENSE_CATEGORIES = ['Ingrédients', 'Salaires', 'Énergie', 'Loyer', 'Équipement', 'Transport', 'Autre'];
  const ORDER_STATUS = ['En attente', 'En préparation', 'Prête', 'Livrée', 'Annulée'];
  const PAYMENTS = ['Espèces', 'Mobile Money', 'Carte', 'Crédit'];

  const ROUTES = {
    dashboard: { title: 'Tableau de bord', icon: '📊', render: renderDashboard },
    pos: { title: 'Caisse / Ventes', icon: '🧾', render: renderPOS },
    products: { title: 'Produits', icon: '🥖', render: renderProducts },
    ingredients: { title: 'Ingrédients / Stock', icon: '🌾', render: renderIngredients },
    recipes: { title: 'Recettes / Production', icon: '📖', render: renderRecipes },
    orders: { title: 'Commandes', icon: '📦', render: renderOrders },
    clients: { title: 'Clients', icon: '👥', render: renderClients },
    suppliers: { title: 'Fournisseurs', icon: '🚚', render: renderSuppliers },
    employees: { title: 'Employés', icon: '👨‍🍳', render: renderEmployees },
    expenses: { title: 'Dépenses', icon: '💸', render: renderExpenses },
    reports: { title: 'Rapports', icon: '📈', render: renderReports },
    settings: { title: 'Paramètres', icon: '⚙️', render: renderSettings },
  };

  let currentRoute = 'dashboard';
  let cart = []; // panier de la caisse

  /* ================================================================== */
  /* Initialisation                                                     */
  /* ================================================================== */
  function init() {
    Store.load();
    applyTheme(Store.get().settings.theme);
    buildNav();
    bindGlobalEvents();
    const hash = (location.hash || '').replace('#', '');
    navigate(ROUTES[hash] ? hash : 'dashboard');
  }

  function buildNav() {
    const nav = U.el('nav-menu');
    nav.innerHTML = Object.keys(ROUTES).map(function (key) {
      const r = ROUTES[key];
      return '<a href="#' + key + '" class="nav-item" data-route="' + key + '">' +
        '<span class="nav-icon">' + r.icon + '</span>' +
        '<span class="nav-label">' + r.title + '</span></a>';
    }).join('');
    U.el('brand-name').textContent = Store.get().settings.bakeryName;
  }

  function bindGlobalEvents() {
    U.el('nav-menu').addEventListener('click', function (e) {
      const link = e.target.closest('[data-route]');
      if (link) {
        e.preventDefault();
        navigate(link.getAttribute('data-route'));
        closeSidebar();
      }
    });
    U.el('theme-toggle').addEventListener('click', toggleTheme);
    U.el('menu-toggle').addEventListener('click', toggleSidebar);
    U.el('sidebar-overlay').addEventListener('click', closeSidebar);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') U.closeModal();
    });
    window.addEventListener('hashchange', function () {
      const hash = (location.hash || '').replace('#', '');
      if (ROUTES[hash] && hash !== currentRoute) navigate(hash);
    });
  }

  function navigate(route) {
    currentRoute = route;
    location.hash = route;
    U.qsa('[data-route]').forEach(function (a) {
      a.classList.toggle('active', a.getAttribute('data-route') === route);
    });
    const r = ROUTES[route];
    U.el('page-title').textContent = r.title;
    const main = U.el('main-content');
    main.innerHTML = '';
    r.render(main);
    main.scrollTop = 0;
  }

  function refresh() { navigate(currentRoute); }

  /* ---- Thème & barre latérale ---- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme === 'dark' ? 'dark' : 'light');
    const btn = U.el('theme-toggle');
    if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
  }
  function toggleTheme() {
    const s = Store.get().settings;
    s.theme = s.theme === 'dark' ? 'light' : 'dark';
    Store.save();
    applyTheme(s.theme);
  }
  function toggleSidebar() {
    document.body.classList.toggle('sidebar-open');
  }
  function closeSidebar() {
    document.body.classList.remove('sidebar-open');
  }

  /* ================================================================== */
  /* Helpers d'analyse                                                  */
  /* ================================================================== */
  function salesBetween(startISO, endISO) {
    return Store.collection('sales').filter(function (s) {
      return s.date >= startISO && s.date <= endISO;
    });
  }
  function sum(arr, fn) {
    return arr.reduce(function (a, x) { return a + (fn ? fn(x) : x); }, 0);
  }
  function saleProfit(sale) {
    return sum(sale.items, function (i) { return (i.price - (i.cost || 0)) * i.qty; }) - (sale.discount || 0);
  }
  function lowStockIngredients() {
    return Store.collection('ingredients').filter(function (i) { return i.stock <= i.minStock; });
  }
  function lowStockProducts() {
    const th = Store.get().settings.lowStockThreshold;
    return Store.collection('products').filter(function (p) {
      return p.active && p.stock < 900 && p.stock <= th;
    });
  }

  function card(label, value, sub, color) {
    return '<div class="stat-card ' + (color || '') + '">' +
      '<div class="stat-label">' + label + '</div>' +
      '<div class="stat-value">' + value + '</div>' +
      (sub ? '<div class="stat-sub">' + sub + '</div>' : '') +
      '</div>';
  }

  /* ================================================================== */
  /* Tableau de bord                                                    */
  /* ================================================================== */
  function renderDashboard(main) {
    const today = Store.todayISO();
    const sales = Store.collection('sales');
    const todaySales = sales.filter(function (s) { return s.date === today; });
    const revToday = sum(todaySales, function (s) { return s.total; });
    const profitToday = sum(todaySales, saleProfit);
    const nbTx = todaySales.length;
    const avgTicket = nbTx ? revToday / nbTx : 0;

    // 7 derniers jours
    const days = [];
    for (let d = 6; d >= 0; d--) {
      const iso = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
      const rev = sum(sales.filter(function (s) { return s.date === iso; }), function (s) { return s.total; });
      days.push({ iso: iso, rev: rev });
    }
    const maxRev = Math.max.apply(null, days.map(function (d) { return d.rev; }).concat([1]));

    // Top produits
    const prodMap = {};
    sales.forEach(function (s) {
      s.items.forEach(function (i) {
        prodMap[i.name] = (prodMap[i.name] || 0) + i.qty;
      });
    });
    const topProducts = Object.keys(prodMap).map(function (k) {
      return { name: k, qty: prodMap[k] };
    }).sort(function (a, b) { return b.qty - a.qty; }).slice(0, 5);

    const lowIng = lowStockIngredients();
    const lowProd = lowStockProducts();
    const pendingOrders = Store.collection('orders').filter(function (o) {
      return o.status !== 'Livrée' && o.status !== 'Annulée';
    });

    let html = '<div class="stats-grid">' +
      card('Chiffre d\'affaires (aujourd\'hui)', U.currency(revToday), nbTx + ' vente(s)', 'accent') +
      card('Bénéfice (aujourd\'hui)', U.currency(profitToday), '', 'green') +
      card('Ticket moyen', U.currency(avgTicket), '', 'blue') +
      card('Produits actifs', Store.collection('products').filter(function (p) { return p.active; }).length, '', 'purple') +
      card('Commandes en cours', pendingOrders.length, '', 'orange') +
      card('Alertes stock', (lowIng.length + lowProd.length), 'ingrédients + produits', (lowIng.length + lowProd.length) ? 'danger' : '') +
      '</div>';

    // Graphique CA 7 jours
    html += '<div class="grid-2">';
    html += '<div class="panel"><div class="panel-header"><h3>Ventes des 7 derniers jours</h3></div>' +
      '<div class="bar-chart">' +
      days.map(function (d) {
        const h = Math.round((d.rev / maxRev) * 100);
        const label = new Date(d.iso).toLocaleDateString('fr-FR', { weekday: 'short' });
        return '<div class="bar-col" title="' + U.currency(d.rev) + '">' +
          '<div class="bar" style="height:' + h + '%"></div>' +
          '<div class="bar-label">' + label + '</div></div>';
      }).join('') +
      '</div></div>';

    // Top produits
    html += '<div class="panel"><div class="panel-header"><h3>Top produits (qté vendue)</h3></div>' +
      '<div class="panel-body">';
    if (topProducts.length) {
      const maxQty = topProducts[0].qty || 1;
      html += topProducts.map(function (p) {
        return '<div class="progress-row"><span class="progress-name">' + U.escapeHtml(p.name) + '</span>' +
          '<div class="progress-bar"><div class="progress-fill" style="width:' + Math.round(p.qty / maxQty * 100) + '%"></div></div>' +
          '<span class="progress-val">' + p.qty + '</span></div>';
      }).join('');
    } else {
      html += '<p class="empty">Aucune vente enregistrée.</p>';
    }
    html += '</div></div>';
    html += '</div>';

    // Alertes
    if (lowIng.length || lowProd.length) {
      html += '<div class="panel alert-panel"><div class="panel-header"><h3>⚠️ Alertes de stock</h3></div><div class="panel-body">';
      if (lowIng.length) {
        html += '<h4>Ingrédients</h4><ul class="alert-list">' + lowIng.map(function (i) {
          return '<li>' + U.escapeHtml(i.name) + ' : <strong>' + U.number(i.stock) + ' ' + i.unit +
            '</strong> (min ' + U.number(i.minStock) + ')</li>';
        }).join('') + '</ul>';
      }
      if (lowProd.length) {
        html += '<h4>Produits</h4><ul class="alert-list">' + lowProd.map(function (p) {
          return '<li>' + U.escapeHtml(p.name) + ' : <strong>' + U.number(p.stock) + '</strong> en stock</li>';
        }).join('') + '</ul>';
      }
      html += '</div></div>';
    }

    main.innerHTML = html;
  }

  /* ================================================================== */
  /* Caisse / POS                                                       */
  /* ================================================================== */
  function renderPOS(main) {
    const products = Store.collection('products').filter(function (p) { return p.active; });
    let html = '<div class="pos-layout">';

    // Colonne produits
    html += '<div class="pos-products"><div class="pos-search-row">' +
      '<input type="text" id="pos-search" class="input" placeholder="Rechercher un produit...">' +
      '<select id="pos-cat" class="input"><option value="">Toutes catégories</option>' +
      CATEGORIES.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select></div>' +
      '<div class="pos-grid" id="pos-grid"></div></div>';

    // Colonne panier
    html += '<div class="pos-cart"><div class="panel-header"><h3>Panier</h3>' +
      '<button class="btn btn-ghost btn-sm" id="pos-clear">Vider</button></div>' +
      '<div class="cart-items" id="cart-items"></div>' +
      '<div class="cart-summary" id="cart-summary"></div>' +
      '</div>';

    html += '</div>';
    main.innerHTML = html;

    renderPosGrid();
    renderCart();

    U.el('pos-search').addEventListener('input', renderPosGrid);
    U.el('pos-cat').addEventListener('change', renderPosGrid);
    U.el('pos-clear').addEventListener('click', function () {
      cart = [];
      renderCart();
    });
    U.el('pos-grid').addEventListener('click', function (e) {
      const tile = e.target.closest('[data-add]');
      if (tile) addToCart(tile.getAttribute('data-add'));
    });
  }

  function renderPosGrid() {
    const search = (U.el('pos-search') && U.el('pos-search').value || '').toLowerCase();
    const cat = U.el('pos-cat') && U.el('pos-cat').value;
    const products = Store.collection('products').filter(function (p) {
      if (!p.active) return false;
      if (cat && p.category !== cat) return false;
      if (search && p.name.toLowerCase().indexOf(search) === -1 &&
          (p.sku || '').toLowerCase().indexOf(search) === -1) return false;
      return true;
    });
    const grid = U.el('pos-grid');
    if (!products.length) {
      grid.innerHTML = '<p class="empty">Aucun produit.</p>';
      return;
    }
    grid.innerHTML = products.map(function (p) {
      const out = p.stock < 900 && p.stock <= 0;
      return '<button class="pos-tile ' + (out ? 'out' : '') + '" data-add="' + p.id + '"' + (out ? ' disabled' : '') + '>' +
        '<div class="pos-tile-cat">' + U.escapeHtml(p.category) + '</div>' +
        '<div class="pos-tile-name">' + U.escapeHtml(p.name) + '</div>' +
        '<div class="pos-tile-price">' + U.currency(p.price) + '</div>' +
        (p.stock < 900 ? '<div class="pos-tile-stock">Stock: ' + p.stock + '</div>' : '') +
        '</button>';
    }).join('');
  }

  function addToCart(productId) {
    const p = Store.findById('products', productId);
    if (!p) return;
    const existing = cart.find(function (c) { return c.productId === productId; });
    if (existing) {
      existing.qty += 1;
    } else {
      cart.push({ productId: p.id, name: p.name, price: p.price, cost: p.cost, qty: 1 });
    }
    renderCart();
  }

  function renderCart() {
    const box = U.el('cart-items');
    const summary = U.el('cart-summary');
    if (!box) return;
    if (!cart.length) {
      box.innerHTML = '<p class="empty">Panier vide. Cliquez sur un produit.</p>';
      summary.innerHTML = '';
      return;
    }
    box.innerHTML = cart.map(function (c, idx) {
      return '<div class="cart-item">' +
        '<div class="cart-item-info"><div class="cart-item-name">' + U.escapeHtml(c.name) + '</div>' +
        '<div class="cart-item-price">' + U.currency(c.price) + '</div></div>' +
        '<div class="qty-control">' +
        '<button class="qty-btn" data-cart-dec="' + idx + '">−</button>' +
        '<span class="qty-num">' + c.qty + '</span>' +
        '<button class="qty-btn" data-cart-inc="' + idx + '">+</button></div>' +
        '<div class="cart-item-total">' + U.currency(c.price * c.qty) + '</div>' +
        '<button class="cart-remove" data-cart-rm="' + idx + '">🗑</button>' +
        '</div>';
    }).join('');

    const subtotal = sum(cart, function (c) { return c.price * c.qty; });
    const taxRate = Store.get().settings.taxRate || 0;
    summary.innerHTML =
      '<div class="summary-row"><span>Sous-total</span><span>' + U.currency(subtotal) + '</span></div>' +
      '<div class="summary-row"><span>Remise</span><input type="number" id="cart-discount" class="input input-sm" value="0" min="0"></div>' +
      (taxRate ? '<div class="summary-row"><span>TVA (' + taxRate + '%)</span><span id="cart-tax">' + U.currency(subtotal * taxRate / 100) + '</span></div>' : '') +
      '<div class="summary-row total"><span>Total</span><span id="cart-total">' + U.currency(subtotal) + '</span></div>' +
      '<div class="form-group"><label>Client (optionnel)</label>' + clientSelect(null, 'cart-client') + '</div>' +
      '<div class="form-group"><label>Employé</label>' + employeeSelect(null, 'cart-emp') + '</div>' +
      '<div class="form-group"><label>Paiement</label><select id="cart-payment" class="input">' +
      PAYMENTS.map(function (p) { return '<option>' + p + '</option>'; }).join('') + '</select></div>' +
      '<button class="btn btn-primary btn-block btn-lg" id="cart-checkout">Encaisser ' +
      '<span id="cart-checkout-total">' + U.currency(subtotal) + '</span></button>';

    box.querySelectorAll('[data-cart-inc]').forEach(function (b) {
      b.addEventListener('click', function () { cart[+b.dataset.cartInc].qty++; renderCart(); });
    });
    box.querySelectorAll('[data-cart-dec]').forEach(function (b) {
      b.addEventListener('click', function () {
        const i = +b.dataset.cartDec;
        cart[i].qty--;
        if (cart[i].qty <= 0) cart.splice(i, 1);
        renderCart();
      });
    });
    box.querySelectorAll('[data-cart-rm]').forEach(function (b) {
      b.addEventListener('click', function () { cart.splice(+b.dataset.cartRm, 1); renderCart(); });
    });
    U.el('cart-discount').addEventListener('input', updateCartTotal);
    U.el('cart-checkout').addEventListener('click', checkout);
  }

  function updateCartTotal() {
    const subtotal = sum(cart, function (c) { return c.price * c.qty; });
    const discount = Number(U.el('cart-discount').value) || 0;
    const taxRate = Store.get().settings.taxRate || 0;
    const taxable = Math.max(0, subtotal - discount);
    const tax = taxable * taxRate / 100;
    const total = taxable + tax;
    if (U.el('cart-tax')) U.el('cart-tax').textContent = U.currency(tax);
    U.el('cart-total').textContent = U.currency(total);
    U.el('cart-checkout-total').textContent = U.currency(total);
  }

  function checkout() {
    if (!cart.length) return;
    const subtotal = sum(cart, function (c) { return c.price * c.qty; });
    const discount = Number(U.el('cart-discount').value) || 0;
    const taxRate = Store.get().settings.taxRate || 0;
    const taxable = Math.max(0, subtotal - discount);
    const tax = taxable * taxRate / 100;
    const total = taxable + tax;
    const clientId = U.el('cart-client').value || null;
    const employeeId = U.el('cart-emp').value || null;
    const payment = U.el('cart-payment').value;

    const sale = {
      id: Store.uid('sale'),
      date: Store.todayISO(),
      createdAt: Date.now(),
      items: cart.map(function (c) { return { productId: c.productId, name: c.name, price: c.price, cost: c.cost, qty: c.qty }; }),
      subtotal: subtotal,
      discount: discount,
      tax: tax,
      total: total,
      payment: payment,
      clientId: clientId,
      employeeId: employeeId,
    };
    Store.add('sales', sale);

    // Décrémenter le stock des produits + ingrédients (recette)
    cart.forEach(function (c) {
      const p = Store.findById('products', c.productId);
      if (p) {
        if (p.stock < 900) p.stock = Math.max(0, p.stock - c.qty);
        (p.recipe || []).forEach(function (r) {
          const ing = Store.findById('ingredients', r.ingredientId);
          if (ing) ing.stock = Math.max(0, ing.stock - r.qty * c.qty);
        });
      }
    });
    // Fidélité + total dépensé client
    if (clientId) {
      const cli = Store.findById('clients', clientId);
      if (cli) {
        cli.loyaltyPoints = (cli.loyaltyPoints || 0) + Math.floor(total / 100);
        cli.totalSpent = (cli.totalSpent || 0) + total;
      }
    }
    Store.save();

    cart = [];
    U.toast('Vente enregistrée : ' + U.currency(total), 'success');
    showReceipt(sale);
    renderPosGrid();
    renderCart();
  }

  function showReceipt(sale) {
    const s = Store.get().settings;
    const cli = sale.clientId ? Store.findById('clients', sale.clientId) : null;
    let body = '<div class="receipt" id="receipt-print">' +
      '<div class="receipt-head"><strong>' + U.escapeHtml(s.bakeryName) + '</strong><br>' +
      (s.address ? U.escapeHtml(s.address) + '<br>' : '') +
      (s.phone ? 'Tél: ' + U.escapeHtml(s.phone) + '<br>' : '') +
      '</div><hr>' +
      '<div class="receipt-meta">' + U.formatDateTime(sale.createdAt) + '<br>Reçu N° ' + sale.id.slice(-6).toUpperCase() +
      (cli ? '<br>Client: ' + U.escapeHtml(cli.name) : '') + '</div><hr>' +
      '<table class="receipt-table"><tbody>' +
      sale.items.map(function (i) {
        return '<tr><td>' + U.escapeHtml(i.name) + '</td><td>x' + i.qty + '</td><td class="right">' + U.currency(i.price * i.qty) + '</td></tr>';
      }).join('') + '</tbody></table><hr>' +
      '<div class="summary-row"><span>Sous-total</span><span>' + U.currency(sale.subtotal) + '</span></div>' +
      (sale.discount ? '<div class="summary-row"><span>Remise</span><span>-' + U.currency(sale.discount) + '</span></div>' : '') +
      (sale.tax ? '<div class="summary-row"><span>TVA</span><span>' + U.currency(sale.tax) + '</span></div>' : '') +
      '<div class="summary-row total"><span>TOTAL</span><span>' + U.currency(sale.total) + '</span></div>' +
      '<div class="summary-row"><span>Paiement</span><span>' + U.escapeHtml(sale.payment) + '</span></div>' +
      '<div class="receipt-foot">Merci de votre visite !</div></div>';
    const footer = '<button class="btn btn-ghost" onclick="U.closeModal()">Fermer</button>' +
      '<button class="btn btn-primary" id="receipt-print-btn">🖨 Imprimer</button>';
    U.openModal('Reçu de vente', body, { footer: footer, size: 'modal-sm', onOpen: function (overlay) {
      overlay.querySelector('#receipt-print-btn').addEventListener('click', function () {
        printElement('receipt-print', 'Reçu');
      });
    } });
  }

  function printElement(id, title) {
    const content = document.getElementById(id).innerHTML;
    const w = window.open('', '_blank', 'width=380,height=600');
    w.document.write('<html><head><title>' + title + '</title><style>' +
      'body{font-family:monospace;font-size:12px;padding:10px;} table{width:100%;border-collapse:collapse;} ' +
      'td{padding:2px 0;} .right{text-align:right;} hr{border:none;border-top:1px dashed #000;} ' +
      '.summary-row{display:flex;justify-content:space-between;} .total{font-weight:bold;font-size:14px;} ' +
      '.receipt-head,.receipt-foot{text-align:center;} .receipt-meta{font-size:11px;}' +
      '</style></head><body>' + content + '</body></html>');
    w.document.close();
    w.focus();
    setTimeout(function () { w.print(); w.close(); }, 300);
  }

  /* ================================================================== */
  /* Composants réutilisables                                           */
  /* ================================================================== */
  function clientSelect(selected, id) {
    return '<select class="input" id="' + (id || '') + '" name="clientId"><option value="">— Aucun —</option>' +
      Store.collection('clients').map(function (c) {
        return '<option value="' + c.id + '"' + (c.id === selected ? ' selected' : '') + '>' + U.escapeHtml(c.name) + '</option>';
      }).join('') + '</select>';
  }
  function employeeSelect(selected, id) {
    return '<select class="input" id="' + (id || '') + '" name="employeeId"><option value="">— Aucun —</option>' +
      Store.collection('employees').filter(function (e) { return e.active; }).map(function (e) {
        return '<option value="' + e.id + '"' + (e.id === selected ? ' selected' : '') + '>' + U.escapeHtml(e.name) + '</option>';
      }).join('') + '</select>';
  }
  function supplierSelect(selected, id) {
    return '<select class="input" id="' + (id || '') + '" name="supplierId"><option value="">— Aucun —</option>' +
      Store.collection('suppliers').map(function (s) {
        return '<option value="' + s.id + '"' + (s.id === selected ? ' selected' : '') + '>' + U.escapeHtml(s.name) + '</option>';
      }).join('') + '</select>';
  }

  function toolbar(title, addLabel, addAction, extra) {
    return '<div class="toolbar">' +
      '<input type="text" class="input search-input" id="list-search" placeholder="Rechercher...">' +
      (extra || '') +
      (addLabel ? '<button class="btn btn-primary" data-action="' + addAction + '">+ ' + addLabel + '</button>' : '') +
      '</div>';
  }

  function filterRows(list, term, fields) {
    if (!term) return list;
    term = term.toLowerCase();
    return list.filter(function (x) {
      return fields.some(function (f) {
        return String(x[f] == null ? '' : x[f]).toLowerCase().indexOf(term) !== -1;
      });
    });
  }

  /* ================================================================== */
  /* Produits                                                           */
  /* ================================================================== */
  function renderProducts(main) {
    const catFilter = '<select class="input" id="prod-cat-filter"><option value="">Toutes catégories</option>' +
      CATEGORIES.map(function (c) { return '<option>' + c + '</option>'; }).join('') + '</select>';
    main.innerHTML = toolbar('Produits', 'Nouveau produit', 'add-product', catFilter) +
      '<div class="panel"><div class="table-wrap"><table class="data-table" id="products-table"></table></div></div>';

    function draw() {
      const term = U.el('list-search').value;
      const cat = U.el('prod-cat-filter').value;
      let list = Store.collection('products');
      if (cat) list = list.filter(function (p) { return p.category === cat; });
      list = filterRows(list, term, ['name', 'sku', 'category']);
      const rows = list.map(function (p) {
        const margin = p.price ? Math.round((p.price - p.cost) / p.price * 100) : 0;
        const stockTxt = p.stock >= 900 ? '∞' : p.stock;
        return '<tr>' +
          '<td><strong>' + U.escapeHtml(p.name) + '</strong><br><small>' + U.escapeHtml(p.sku || '') + '</small></td>' +
          '<td>' + U.escapeHtml(p.category) + '</td>' +
          '<td>' + U.currency(p.price) + '</td>' +
          '<td>' + U.currency(p.cost) + '</td>' +
          '<td><span class="badge ' + (margin >= 40 ? 'badge-green' : 'badge-orange') + '">' + margin + '%</span></td>' +
          '<td>' + stockTxt + '</td>' +
          '<td>' + (p.active ? '<span class="badge badge-green">Actif</span>' : '<span class="badge">Inactif</span>') + '</td>' +
          '<td class="actions">' +
          '<button class="icon-btn" data-action="edit-product" data-id="' + p.id + '" title="Modifier">✏️</button>' +
          '<button class="icon-btn" data-action="del-product" data-id="' + p.id + '" title="Supprimer">🗑</button>' +
          '</td></tr>';
      }).join('');
      U.el('products-table').innerHTML =
        '<thead><tr><th>Produit</th><th>Catégorie</th><th>Prix</th><th>Coût</th><th>Marge</th><th>Stock</th><th>Statut</th><th></th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="8" class="empty">Aucun produit.</td></tr>') + '</tbody>';
    }
    draw();
    U.el('list-search').addEventListener('input', draw);
    U.el('prod-cat-filter').addEventListener('change', draw);
    main._draw = draw;
  }

  function productForm(p) {
    p = p || {};
    return '<form id="entity-form" class="form-grid">' +
      '<div class="form-group"><label>Nom *</label><input class="input" name="name" required value="' + U.escapeHtml(p.name || '') + '"></div>' +
      '<div class="form-group"><label>Référence (SKU)</label><input class="input" name="sku" value="' + U.escapeHtml(p.sku || '') + '"></div>' +
      '<div class="form-group"><label>Catégorie</label><select class="input" name="category">' +
        CATEGORIES.map(function (c) { return '<option' + (c === p.category ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-group"><label>Prix de vente *</label><input class="input" type="number" name="price" min="0" step="1" required value="' + (p.price != null ? p.price : '') + '"></div>' +
      '<div class="form-group"><label>Coût de revient</label><input class="input" type="number" name="cost" min="0" step="1" value="' + (p.cost != null ? p.cost : 0) + '"></div>' +
      '<div class="form-group"><label>Stock (999 = illimité)</label><input class="input" type="number" name="stock" min="0" step="1" value="' + (p.stock != null ? p.stock : 0) + '"></div>' +
      '<div class="form-group checkbox-group"><label><input type="checkbox" name="active"' + (p.active !== false ? ' checked' : '') + '> Produit actif</label></div>' +
      '</form>';
  }

  function openProductModal(id) {
    const p = id ? Store.findById('products', id) : null;
    const footer = '<button class="btn btn-ghost" onclick="U.closeModal()">Annuler</button>' +
      '<button class="btn btn-primary" id="save-entity">Enregistrer</button>';
    U.openModal(id ? 'Modifier le produit' : 'Nouveau produit', productForm(p), { footer: footer, onOpen: function (overlay) {
      overlay.querySelector('#save-entity').addEventListener('click', function () {
        const form = overlay.querySelector('#entity-form');
        if (!form.reportValidity()) return;
        const data = U.formData(form);
        if (id) {
          Store.update('products', id, data);
          U.toast('Produit modifié', 'success');
        } else {
          data.recipe = [];
          Store.add('products', data);
          U.toast('Produit ajouté', 'success');
        }
        U.closeModal();
        refresh();
      });
    } });
  }

  /* ================================================================== */
  /* Ingrédients / Stock                                                */
  /* ================================================================== */
  function renderIngredients(main) {
    main.innerHTML = toolbar('Ingrédients', 'Nouvel ingrédient', 'add-ing') +
      '<div class="panel"><div class="table-wrap"><table class="data-table" id="ing-table"></table></div></div>';
    function draw() {
      const term = U.el('list-search').value;
      const list = filterRows(Store.collection('ingredients'), term, ['name', 'unit']);
      const rows = list.map(function (i) {
        const low = i.stock <= i.minStock;
        const sup = i.supplierId ? Store.findById('suppliers', i.supplierId) : null;
        return '<tr class="' + (low ? 'row-alert' : '') + '">' +
          '<td><strong>' + U.escapeHtml(i.name) + '</strong></td>' +
          '<td>' + U.number(i.stock) + ' ' + U.escapeHtml(i.unit) + (low ? ' ⚠️' : '') + '</td>' +
          '<td>' + U.number(i.minStock) + '</td>' +
          '<td>' + U.currency(i.cost) + ' / ' + U.escapeHtml(i.unit) + '</td>' +
          '<td>' + U.currency(i.cost * i.stock) + '</td>' +
          '<td>' + (sup ? U.escapeHtml(sup.name) : '—') + '</td>' +
          '<td class="actions">' +
          '<button class="icon-btn" data-action="restock-ing" data-id="' + i.id + '" title="Réapprovisionner">➕</button>' +
          '<button class="icon-btn" data-action="edit-ing" data-id="' + i.id + '" title="Modifier">✏️</button>' +
          '<button class="icon-btn" data-action="del-ing" data-id="' + i.id + '" title="Supprimer">🗑</button>' +
          '</td></tr>';
      }).join('');
      const totalValue = sum(Store.collection('ingredients'), function (i) { return i.cost * i.stock; });
      U.el('ing-table').innerHTML =
        '<thead><tr><th>Ingrédient</th><th>Stock</th><th>Seuil min</th><th>Coût unitaire</th><th>Valeur</th><th>Fournisseur</th><th></th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="7" class="empty">Aucun ingrédient.</td></tr>') + '</tbody>' +
        '<tfoot><tr><td colspan="4"><strong>Valeur totale du stock</strong></td><td colspan="3"><strong>' + U.currency(totalValue) + '</strong></td></tr></tfoot>';
    }
    draw();
    U.el('list-search').addEventListener('input', draw);
    main._draw = draw;
  }

  function ingredientForm(i) {
    i = i || {};
    return '<form id="entity-form" class="form-grid">' +
      '<div class="form-group"><label>Nom *</label><input class="input" name="name" required value="' + U.escapeHtml(i.name || '') + '"></div>' +
      '<div class="form-group"><label>Unité</label><select class="input" name="unit">' +
        UNITS.map(function (u) { return '<option' + (u === i.unit ? ' selected' : '') + '>' + u + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-group"><label>Stock actuel</label><input class="input" type="number" name="stock" min="0" step="0.01" value="' + (i.stock != null ? i.stock : 0) + '"></div>' +
      '<div class="form-group"><label>Seuil minimum</label><input class="input" type="number" name="minStock" min="0" step="0.01" value="' + (i.minStock != null ? i.minStock : 0) + '"></div>' +
      '<div class="form-group"><label>Coût unitaire</label><input class="input" type="number" name="cost" min="0" step="1" value="' + (i.cost != null ? i.cost : 0) + '"></div>' +
      '<div class="form-group"><label>Fournisseur</label>' + supplierSelect(i.supplierId, '') + '</div>' +
      '</form>';
  }

  function openIngredientModal(id) {
    const i = id ? Store.findById('ingredients', id) : null;
    const footer = '<button class="btn btn-ghost" onclick="U.closeModal()">Annuler</button>' +
      '<button class="btn btn-primary" id="save-entity">Enregistrer</button>';
    U.openModal(id ? 'Modifier l\'ingrédient' : 'Nouvel ingrédient', ingredientForm(i), { footer: footer, onOpen: function (overlay) {
      overlay.querySelector('#save-entity').addEventListener('click', function () {
        const form = overlay.querySelector('#entity-form');
        if (!form.reportValidity()) return;
        const data = U.formData(form);
        if (id) { Store.update('ingredients', id, data); U.toast('Ingrédient modifié', 'success'); }
        else { Store.add('ingredients', data); U.toast('Ingrédient ajouté', 'success'); }
        U.closeModal();
        refresh();
      });
    } });
  }

  function openRestockModal(id) {
    const i = Store.findById('ingredients', id);
    if (!i) return;
    const body = '<form id="entity-form"><p>Réapprovisionner <strong>' + U.escapeHtml(i.name) + '</strong> (stock actuel : ' + U.number(i.stock) + ' ' + i.unit + ')</p>' +
      '<div class="form-group"><label>Quantité à ajouter (' + i.unit + ')</label><input class="input" type="number" name="qty" min="0.01" step="0.01" required autofocus></div>' +
      '<div class="form-group checkbox-group"><label><input type="checkbox" name="expense" checked> Enregistrer comme dépense</label></div></form>';
    const footer = '<button class="btn btn-ghost" onclick="U.closeModal()">Annuler</button>' +
      '<button class="btn btn-primary" id="save-entity">Ajouter au stock</button>';
    U.openModal('Réapprovisionnement', body, { footer: footer, size: 'modal-sm', onOpen: function (overlay) {
      overlay.querySelector('#save-entity').addEventListener('click', function () {
        const form = overlay.querySelector('#entity-form');
        if (!form.reportValidity()) return;
        const data = U.formData(form);
        i.stock = (i.stock || 0) + data.qty;
        if (data.expense) {
          Store.add('expenses', { date: Store.todayISO(), category: 'Ingrédients', label: 'Réappro ' + i.name + ' (' + data.qty + ' ' + i.unit + ')', amount: data.qty * i.cost, supplierId: i.supplierId || null });
        }
        Store.save();
        U.toast('Stock mis à jour', 'success');
        U.closeModal();
        refresh();
      });
    } });
  }

  /* ================================================================== */
  /* Recettes / Production                                              */
  /* ================================================================== */
  function renderRecipes(main) {
    const products = Store.collection('products');
    let html = '<div class="info-banner">Définissez la composition de chaque produit. Lors d\'une vente, les ingrédients sont automatiquement décomptés du stock. La production permet de fabriquer un lot à l\'avance.</div>';
    html += '<div class="cards-grid">';
    html += products.map(function (p) {
      const recipe = p.recipe || [];
      const recCost = sum(recipe, function (r) {
        const ing = Store.findById('ingredients', r.ingredientId);
        return ing ? ing.cost * r.qty : 0;
      });
      return '<div class="panel recipe-card">' +
        '<div class="panel-header"><h3>' + U.escapeHtml(p.name) + '</h3>' +
        '<span class="badge">' + U.escapeHtml(p.category) + '</span></div>' +
        '<div class="panel-body">' +
        (recipe.length ? '<ul class="recipe-list">' + recipe.map(function (r) {
          const ing = Store.findById('ingredients', r.ingredientId);
          return '<li>' + (ing ? U.escapeHtml(ing.name) : '?') + ' — ' + U.number(r.qty) + ' ' + (ing ? ing.unit : '') + '</li>';
        }).join('') + '</ul>' : '<p class="empty">Aucune recette définie.</p>') +
        '<div class="recipe-cost">Coût matières : <strong>' + U.currency(recCost) + '</strong></div>' +
        '<div class="btn-row">' +
        '<button class="btn btn-sm btn-ghost" data-action="edit-recipe" data-id="' + p.id + '">📖 Recette</button>' +
        (recipe.length ? '<button class="btn btn-sm btn-primary" data-action="produce" data-id="' + p.id + '">🏭 Produire</button>' : '') +
        '</div></div></div>';
    }).join('');
    html += '</div>';
    main.innerHTML = html;
  }

  function openRecipeModal(id) {
    const p = Store.findById('products', id);
    if (!p) return;
    p.recipe = p.recipe || [];
    const ingredients = Store.collection('ingredients');

    function rowsHtml() {
      return p.recipe.map(function (r, idx) {
        return '<div class="recipe-edit-row" data-idx="' + idx + '">' +
          '<select class="input recipe-ing">' + ingredients.map(function (ing) {
            return '<option value="' + ing.id + '"' + (ing.id === r.ingredientId ? ' selected' : '') + '>' + U.escapeHtml(ing.name) + ' (' + ing.unit + ')</option>';
          }).join('') + '</select>' +
          '<input class="input recipe-qty" type="number" min="0" step="0.001" value="' + r.qty + '">' +
          '<button type="button" class="icon-btn recipe-del">🗑</button></div>';
      }).join('');
    }

    const body = '<div id="recipe-rows">' + (p.recipe.length ? rowsHtml() : '<p class="empty" id="recipe-empty">Aucun ingrédient.</p>') + '</div>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="recipe-add-row">+ Ajouter un ingrédient</button>';
    const footer = '<button class="btn btn-ghost" onclick="U.closeModal()">Annuler</button>' +
      '<button class="btn btn-primary" id="save-entity">Enregistrer la recette</button>';

    U.openModal('Recette : ' + p.name, body, { footer: footer, onOpen: function (overlay) {
      const rowsBox = overlay.querySelector('#recipe-rows');
      overlay.querySelector('#recipe-add-row').addEventListener('click', function () {
        const empty = overlay.querySelector('#recipe-empty');
        if (empty) empty.remove();
        const div = document.createElement('div');
        div.className = 'recipe-edit-row';
        div.innerHTML = '<select class="input recipe-ing">' + ingredients.map(function (ing) {
          return '<option value="' + ing.id + '">' + U.escapeHtml(ing.name) + ' (' + ing.unit + ')</option>';
        }).join('') + '</select>' +
          '<input class="input recipe-qty" type="number" min="0" step="0.001" value="0">' +
          '<button type="button" class="icon-btn recipe-del">🗑</button>';
        rowsBox.appendChild(div);
      });
      rowsBox.addEventListener('click', function (e) {
        if (e.target.classList.contains('recipe-del')) e.target.closest('.recipe-edit-row').remove();
      });
      overlay.querySelector('#save-entity').addEventListener('click', function () {
        const recipe = [];
        U.qsa('.recipe-edit-row', overlay).forEach(function (row) {
          const ingId = row.querySelector('.recipe-ing').value;
          const qty = Number(row.querySelector('.recipe-qty').value) || 0;
          if (ingId && qty > 0) recipe.push({ ingredientId: ingId, qty: qty });
        });
        Store.update('products', id, { recipe: recipe });
        U.toast('Recette enregistrée', 'success');
        U.closeModal();
        refresh();
      });
    } });
  }

  function openProduceModal(id) {
    const p = Store.findById('products', id);
    if (!p || !(p.recipe || []).length) return;
    const body = '<form id="entity-form"><p>Produire un lot de <strong>' + U.escapeHtml(p.name) + '</strong>.</p>' +
      '<div class="form-group"><label>Quantité à produire</label><input class="input" type="number" name="qty" min="1" step="1" value="10" required autofocus></div>' +
      '<div id="produce-preview" class="produce-preview"></div></form>';
    const footer = '<button class="btn btn-ghost" onclick="U.closeModal()">Annuler</button>' +
      '<button class="btn btn-primary" id="save-entity">Lancer la production</button>';
    U.openModal('Production', body, { footer: footer, onOpen: function (overlay) {
      const qtyInput = overlay.querySelector('[name="qty"]');
      function preview() {
        const qty = Number(qtyInput.value) || 0;
        let ok = true;
        const list = p.recipe.map(function (r) {
          const ing = Store.findById('ingredients', r.ingredientId);
          const need = r.qty * qty;
          const enough = ing && ing.stock >= need;
          if (!enough) ok = false;
          return '<div class="produce-row ' + (enough ? '' : 'insufficient') + '">' +
            (ing ? U.escapeHtml(ing.name) : '?') + ' : besoin ' + U.number(need) + ' ' + (ing ? ing.unit : '') +
            ' / dispo ' + (ing ? U.number(ing.stock) : 0) + (enough ? '' : ' ⚠️ insuffisant') + '</div>';
        }).join('');
        overlay.querySelector('#produce-preview').innerHTML = list;
        overlay.querySelector('#save-entity').disabled = !ok || qty <= 0;
      }
      qtyInput.addEventListener('input', preview);
      preview();
      overlay.querySelector('#save-entity').addEventListener('click', function () {
        const qty = Number(qtyInput.value) || 0;
        p.recipe.forEach(function (r) {
          const ing = Store.findById('ingredients', r.ingredientId);
          if (ing) ing.stock = Math.max(0, ing.stock - r.qty * qty);
        });
        if (p.stock < 900) p.stock = (p.stock || 0) + qty;
        Store.save();
        U.toast(qty + ' × ' + p.name + ' produits', 'success');
        U.closeModal();
        refresh();
      });
    } });
  }

  /* ================================================================== */
  /* Commandes                                                          */
  /* ================================================================== */
  function renderOrders(main) {
    main.innerHTML = toolbar('Commandes', 'Nouvelle commande', 'add-order') +
      '<div class="panel"><div class="table-wrap"><table class="data-table" id="orders-table"></table></div></div>';
    function draw() {
      const term = U.el('list-search').value;
      let list = Store.collection('orders').slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
      list = list.filter(function (o) {
        const cli = o.clientId ? Store.findById('clients', o.clientId) : null;
        const name = cli ? cli.name : '';
        return !term || name.toLowerCase().indexOf(term.toLowerCase()) !== -1 || (o.status || '').toLowerCase().indexOf(term.toLowerCase()) !== -1;
      });
      const rows = list.map(function (o) {
        const cli = o.clientId ? Store.findById('clients', o.clientId) : null;
        const statusClass = { 'En attente': 'badge-orange', 'En préparation': 'badge-blue', 'Prête': 'badge-purple', 'Livrée': 'badge-green', 'Annulée': 'badge-red' }[o.status] || '';
        return '<tr>' +
          '<td>' + U.escapeHtml((o.id || '').slice(-6).toUpperCase()) + '</td>' +
          '<td>' + (cli ? U.escapeHtml(cli.name) : '<em>Comptoir</em>') + '</td>' +
          '<td>' + o.items.reduce(function (a, i) { return a + i.qty; }, 0) + ' article(s)</td>' +
          '<td>' + U.currency(o.total) + '</td>' +
          '<td>' + U.formatDate(o.dueDate) + '</td>' +
          '<td><span class="badge ' + statusClass + '">' + U.escapeHtml(o.status) + '</span></td>' +
          '<td class="actions">' +
          '<button class="icon-btn" data-action="view-order" data-id="' + o.id + '" title="Voir">👁</button>' +
          '<button class="icon-btn" data-action="edit-order" data-id="' + o.id + '" title="Modifier">✏️</button>' +
          '<button class="icon-btn" data-action="del-order" data-id="' + o.id + '" title="Supprimer">🗑</button>' +
          '</td></tr>';
      }).join('');
      U.el('orders-table').innerHTML =
        '<thead><tr><th>N°</th><th>Client</th><th>Articles</th><th>Total</th><th>Échéance</th><th>Statut</th><th></th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="7" class="empty">Aucune commande.</td></tr>') + '</tbody>';
    }
    draw();
    U.el('list-search').addEventListener('input', draw);
    main._draw = draw;
  }

  function openOrderModal(id) {
    const o = id ? Store.findById('orders', id) : { items: [], status: 'En attente', date: Store.todayISO(), dueDate: Store.todayISO() };
    const products = Store.collection('products').filter(function (p) { return p.active; });
    let items = (o.items || []).map(function (i) { return Object.assign({}, i); });

    function itemsHtml() {
      if (!items.length) return '<p class="empty" id="order-empty">Aucun article. Ajoutez-en ci-dessous.</p>';
      return '<table class="mini-table"><thead><tr><th>Produit</th><th>Qté</th><th>Total</th><th></th></tr></thead><tbody>' +
        items.map(function (it, idx) {
          return '<tr><td>' + U.escapeHtml(it.name) + '</td><td>' + it.qty + '</td><td>' + U.currency(it.price * it.qty) + '</td>' +
            '<td><button type="button" class="icon-btn" data-oitem-rm="' + idx + '">🗑</button></td></tr>';
        }).join('') + '</tbody></table>';
    }

    const body = '<form id="entity-form" class="form-grid">' +
      '<div class="form-group"><label>Client</label>' + clientSelect(o.clientId, '') + '</div>' +
      '<div class="form-group"><label>Statut</label><select class="input" name="status">' +
        ORDER_STATUS.map(function (s) { return '<option' + (s === o.status ? ' selected' : '') + '>' + s + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-group"><label>Date</label><input class="input" type="date" name="date" value="' + (o.date || Store.todayISO()) + '"></div>' +
      '<div class="form-group"><label>Échéance</label><input class="input" type="date" name="dueDate" value="' + (o.dueDate || Store.todayISO()) + '"></div>' +
      '<div class="form-group form-group-full"><label>Notes</label><input class="input" name="notes" value="' + U.escapeHtml(o.notes || '') + '"></div>' +
      '</form>' +
      '<div class="order-items"><h4>Articles</h4><div id="order-items-box">' + itemsHtml() + '</div>' +
      '<div class="add-item-row"><select class="input" id="order-prod">' +
        products.map(function (p) { return '<option value="' + p.id + '">' + U.escapeHtml(p.name) + ' — ' + U.currency(p.price) + '</option>'; }).join('') +
        '</select><input class="input input-sm" id="order-qty" type="number" min="1" value="1">' +
        '<button type="button" class="btn btn-ghost btn-sm" id="order-add-item">Ajouter</button></div>' +
      '<div class="order-total-line">Total : <strong id="order-total">' + U.currency(sum(items, function (i) { return i.price * i.qty; })) + '</strong></div></div>';

    const footer = '<button class="btn btn-ghost" onclick="U.closeModal()">Annuler</button>' +
      '<button class="btn btn-primary" id="save-entity">Enregistrer</button>';

    U.openModal(id ? 'Modifier la commande' : 'Nouvelle commande', body, { footer: footer, size: 'modal-lg', onOpen: function (overlay) {
      function redrawItems() {
        overlay.querySelector('#order-items-box').innerHTML = itemsHtml();
        overlay.querySelector('#order-total').textContent = U.currency(sum(items, function (i) { return i.price * i.qty; }));
      }
      overlay.querySelector('#order-add-item').addEventListener('click', function () {
        const pid = overlay.querySelector('#order-prod').value;
        const qty = Number(overlay.querySelector('#order-qty').value) || 1;
        const p = Store.findById('products', pid);
        if (!p) return;
        const ex = items.find(function (i) { return i.productId === pid; });
        if (ex) ex.qty += qty; else items.push({ productId: p.id, name: p.name, price: p.price, qty: qty });
        redrawItems();
      });
      overlay.querySelector('#order-items-box').addEventListener('click', function (e) {
        const btn = e.target.closest('[data-oitem-rm]');
        if (btn) { items.splice(+btn.dataset.oitemRm, 1); redrawItems(); }
      });
      overlay.querySelector('#save-entity').addEventListener('click', function () {
        const form = overlay.querySelector('#entity-form');
        const data = U.formData(form);
        data.items = items;
        data.total = sum(items, function (i) { return i.price * i.qty; });
        if (id) { Store.update('orders', id, data); U.toast('Commande modifiée', 'success'); }
        else { Store.add('orders', data); U.toast('Commande créée', 'success'); }
        U.closeModal();
        refresh();
      });
    } });
  }

  function viewOrder(id) {
    const o = Store.findById('orders', id);
    if (!o) return;
    const cli = o.clientId ? Store.findById('clients', o.clientId) : null;
    const body = '<div class="detail-list">' +
      '<div><span>Client</span><strong>' + (cli ? U.escapeHtml(cli.name) : 'Comptoir') + '</strong></div>' +
      '<div><span>Date</span><strong>' + U.formatDate(o.date) + '</strong></div>' +
      '<div><span>Échéance</span><strong>' + U.formatDate(o.dueDate) + '</strong></div>' +
      '<div><span>Statut</span><strong>' + U.escapeHtml(o.status) + '</strong></div>' +
      (o.notes ? '<div><span>Notes</span><strong>' + U.escapeHtml(o.notes) + '</strong></div>' : '') +
      '</div><h4>Articles</h4><table class="mini-table"><tbody>' +
      o.items.map(function (i) { return '<tr><td>' + U.escapeHtml(i.name) + '</td><td>x' + i.qty + '</td><td class="right">' + U.currency(i.price * i.qty) + '</td></tr>'; }).join('') +
      '</tbody></table><div class="order-total-line">Total : <strong>' + U.currency(o.total) + '</strong></div>';
    U.openModal('Commande ' + o.id.slice(-6).toUpperCase(), body, { footer: '<button class="btn btn-primary" onclick="U.closeModal()">Fermer</button>' });
  }

  /* ================================================================== */
  /* Clients                                                            */
  /* ================================================================== */
  function renderClients(main) {
    main.innerHTML = toolbar('Clients', 'Nouveau client', 'add-client') +
      '<div class="panel"><div class="table-wrap"><table class="data-table" id="clients-table"></table></div></div>';
    function draw() {
      const term = U.el('list-search').value;
      const list = filterRows(Store.collection('clients'), term, ['name', 'phone', 'email']);
      const rows = list.map(function (c) {
        return '<tr>' +
          '<td><strong>' + U.escapeHtml(c.name) + '</strong></td>' +
          '<td>' + U.escapeHtml(c.phone || '—') + '</td>' +
          '<td>' + U.escapeHtml(c.email || '—') + '</td>' +
          '<td><span class="badge badge-purple">' + (c.loyaltyPoints || 0) + ' pts</span></td>' +
          '<td>' + U.currency(c.totalSpent || 0) + '</td>' +
          '<td class="actions">' +
          '<button class="icon-btn" data-action="edit-client" data-id="' + c.id + '" title="Modifier">✏️</button>' +
          '<button class="icon-btn" data-action="del-client" data-id="' + c.id + '" title="Supprimer">🗑</button>' +
          '</td></tr>';
      }).join('');
      U.el('clients-table').innerHTML =
        '<thead><tr><th>Nom</th><th>Téléphone</th><th>Email</th><th>Fidélité</th><th>Total dépensé</th><th></th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="6" class="empty">Aucun client.</td></tr>') + '</tbody>';
    }
    draw();
    U.el('list-search').addEventListener('input', draw);
    main._draw = draw;
  }

  function openClientModal(id) {
    const c = id ? Store.findById('clients', id) : {};
    const body = '<form id="entity-form" class="form-grid">' +
      '<div class="form-group"><label>Nom *</label><input class="input" name="name" required value="' + U.escapeHtml(c.name || '') + '"></div>' +
      '<div class="form-group"><label>Téléphone</label><input class="input" name="phone" value="' + U.escapeHtml(c.phone || '') + '"></div>' +
      '<div class="form-group"><label>Email</label><input class="input" type="email" name="email" value="' + U.escapeHtml(c.email || '') + '"></div>' +
      '<div class="form-group"><label>Adresse</label><input class="input" name="address" value="' + U.escapeHtml(c.address || '') + '"></div>' +
      '<div class="form-group"><label>Points de fidélité</label><input class="input" type="number" name="loyaltyPoints" min="0" value="' + (c.loyaltyPoints || 0) + '"></div>' +
      '</form>';
    const footer = '<button class="btn btn-ghost" onclick="U.closeModal()">Annuler</button><button class="btn btn-primary" id="save-entity">Enregistrer</button>';
    U.openModal(id ? 'Modifier le client' : 'Nouveau client', body, { footer: footer, onOpen: function (overlay) {
      overlay.querySelector('#save-entity').addEventListener('click', function () {
        const form = overlay.querySelector('#entity-form');
        if (!form.reportValidity()) return;
        const data = U.formData(form);
        if (id) { Store.update('clients', id, data); U.toast('Client modifié', 'success'); }
        else { data.totalSpent = 0; Store.add('clients', data); U.toast('Client ajouté', 'success'); }
        U.closeModal();
        refresh();
      });
    } });
  }

  /* ================================================================== */
  /* Fournisseurs                                                       */
  /* ================================================================== */
  function renderSuppliers(main) {
    main.innerHTML = toolbar('Fournisseurs', 'Nouveau fournisseur', 'add-supplier') +
      '<div class="panel"><div class="table-wrap"><table class="data-table" id="suppliers-table"></table></div></div>';
    function draw() {
      const term = U.el('list-search').value;
      const list = filterRows(Store.collection('suppliers'), term, ['name', 'contact', 'phone', 'email']);
      const rows = list.map(function (s) {
        return '<tr>' +
          '<td><strong>' + U.escapeHtml(s.name) + '</strong></td>' +
          '<td>' + U.escapeHtml(s.contact || '—') + '</td>' +
          '<td>' + U.escapeHtml(s.phone || '—') + '</td>' +
          '<td>' + U.escapeHtml(s.email || '—') + '</td>' +
          '<td>' + U.escapeHtml(s.address || '—') + '</td>' +
          '<td class="actions">' +
          '<button class="icon-btn" data-action="edit-supplier" data-id="' + s.id + '" title="Modifier">✏️</button>' +
          '<button class="icon-btn" data-action="del-supplier" data-id="' + s.id + '" title="Supprimer">🗑</button>' +
          '</td></tr>';
      }).join('');
      U.el('suppliers-table').innerHTML =
        '<thead><tr><th>Nom</th><th>Contact</th><th>Téléphone</th><th>Email</th><th>Adresse</th><th></th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="6" class="empty">Aucun fournisseur.</td></tr>') + '</tbody>';
    }
    draw();
    U.el('list-search').addEventListener('input', draw);
    main._draw = draw;
  }

  function openSupplierModal(id) {
    const s = id ? Store.findById('suppliers', id) : {};
    const body = '<form id="entity-form" class="form-grid">' +
      '<div class="form-group"><label>Nom *</label><input class="input" name="name" required value="' + U.escapeHtml(s.name || '') + '"></div>' +
      '<div class="form-group"><label>Contact</label><input class="input" name="contact" value="' + U.escapeHtml(s.contact || '') + '"></div>' +
      '<div class="form-group"><label>Téléphone</label><input class="input" name="phone" value="' + U.escapeHtml(s.phone || '') + '"></div>' +
      '<div class="form-group"><label>Email</label><input class="input" type="email" name="email" value="' + U.escapeHtml(s.email || '') + '"></div>' +
      '<div class="form-group form-group-full"><label>Adresse</label><input class="input" name="address" value="' + U.escapeHtml(s.address || '') + '"></div>' +
      '</form>';
    const footer = '<button class="btn btn-ghost" onclick="U.closeModal()">Annuler</button><button class="btn btn-primary" id="save-entity">Enregistrer</button>';
    U.openModal(id ? 'Modifier le fournisseur' : 'Nouveau fournisseur', body, { footer: footer, onOpen: function (overlay) {
      overlay.querySelector('#save-entity').addEventListener('click', function () {
        const form = overlay.querySelector('#entity-form');
        if (!form.reportValidity()) return;
        const data = U.formData(form);
        if (id) { Store.update('suppliers', id, data); U.toast('Fournisseur modifié', 'success'); }
        else { Store.add('suppliers', data); U.toast('Fournisseur ajouté', 'success'); }
        U.closeModal();
        refresh();
      });
    } });
  }

  /* ================================================================== */
  /* Employés                                                           */
  /* ================================================================== */
  function renderEmployees(main) {
    main.innerHTML = toolbar('Employés', 'Nouvel employé', 'add-employee') +
      '<div class="panel"><div class="table-wrap"><table class="data-table" id="emp-table"></table></div></div>';
    function draw() {
      const term = U.el('list-search').value;
      const list = filterRows(Store.collection('employees'), term, ['name', 'role', 'phone']);
      const rows = list.map(function (e) {
        return '<tr>' +
          '<td><strong>' + U.escapeHtml(e.name) + '</strong></td>' +
          '<td>' + U.escapeHtml(e.role || '—') + '</td>' +
          '<td>' + U.escapeHtml(e.phone || '—') + '</td>' +
          '<td>' + U.currency(e.salary || 0) + '</td>' +
          '<td>' + U.formatDate(e.hireDate) + '</td>' +
          '<td>' + (e.active ? '<span class="badge badge-green">Actif</span>' : '<span class="badge">Inactif</span>') + '</td>' +
          '<td class="actions">' +
          '<button class="icon-btn" data-action="edit-employee" data-id="' + e.id + '" title="Modifier">✏️</button>' +
          '<button class="icon-btn" data-action="del-employee" data-id="' + e.id + '" title="Supprimer">🗑</button>' +
          '</td></tr>';
      }).join('');
      const totalSalary = sum(Store.collection('employees').filter(function (e) { return e.active; }), function (e) { return e.salary || 0; });
      U.el('emp-table').innerHTML =
        '<thead><tr><th>Nom</th><th>Poste</th><th>Téléphone</th><th>Salaire</th><th>Embauche</th><th>Statut</th><th></th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="7" class="empty">Aucun employé.</td></tr>') + '</tbody>' +
        '<tfoot><tr><td colspan="3"><strong>Masse salariale (actifs)</strong></td><td colspan="4"><strong>' + U.currency(totalSalary) + '</strong></td></tr></tfoot>';
    }
    draw();
    U.el('list-search').addEventListener('input', draw);
    main._draw = draw;
  }

  function openEmployeeModal(id) {
    const e = id ? Store.findById('employees', id) : { active: true, hireDate: Store.todayISO() };
    const body = '<form id="entity-form" class="form-grid">' +
      '<div class="form-group"><label>Nom *</label><input class="input" name="name" required value="' + U.escapeHtml(e.name || '') + '"></div>' +
      '<div class="form-group"><label>Poste</label><input class="input" name="role" value="' + U.escapeHtml(e.role || '') + '"></div>' +
      '<div class="form-group"><label>Téléphone</label><input class="input" name="phone" value="' + U.escapeHtml(e.phone || '') + '"></div>' +
      '<div class="form-group"><label>Salaire mensuel</label><input class="input" type="number" name="salary" min="0" value="' + (e.salary || 0) + '"></div>' +
      '<div class="form-group"><label>Date d\'embauche</label><input class="input" type="date" name="hireDate" value="' + (e.hireDate || Store.todayISO()) + '"></div>' +
      '<div class="form-group checkbox-group"><label><input type="checkbox" name="active"' + (e.active !== false ? ' checked' : '') + '> Actif</label></div>' +
      '</form>';
    const footer = '<button class="btn btn-ghost" onclick="U.closeModal()">Annuler</button><button class="btn btn-primary" id="save-entity">Enregistrer</button>';
    U.openModal(id ? 'Modifier l\'employé' : 'Nouvel employé', body, { footer: footer, onOpen: function (overlay) {
      overlay.querySelector('#save-entity').addEventListener('click', function () {
        const form = overlay.querySelector('#entity-form');
        if (!form.reportValidity()) return;
        const data = U.formData(form);
        if (id) { Store.update('employees', id, data); U.toast('Employé modifié', 'success'); }
        else { Store.add('employees', data); U.toast('Employé ajouté', 'success'); }
        U.closeModal();
        refresh();
      });
    } });
  }

  /* ================================================================== */
  /* Dépenses                                                           */
  /* ================================================================== */
  function renderExpenses(main) {
    main.innerHTML = toolbar('Dépenses', 'Nouvelle dépense', 'add-expense') +
      '<div class="panel"><div class="table-wrap"><table class="data-table" id="exp-table"></table></div></div>';
    function draw() {
      const term = U.el('list-search').value;
      let list = Store.collection('expenses').slice().sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); });
      list = filterRows(list, term, ['label', 'category']);
      const rows = list.map(function (x) {
        const sup = x.supplierId ? Store.findById('suppliers', x.supplierId) : null;
        return '<tr>' +
          '<td>' + U.formatDate(x.date) + '</td>' +
          '<td><span class="badge">' + U.escapeHtml(x.category) + '</span></td>' +
          '<td>' + U.escapeHtml(x.label) + '</td>' +
          '<td>' + (sup ? U.escapeHtml(sup.name) : '—') + '</td>' +
          '<td class="right">' + U.currency(x.amount) + '</td>' +
          '<td class="actions">' +
          '<button class="icon-btn" data-action="edit-expense" data-id="' + x.id + '" title="Modifier">✏️</button>' +
          '<button class="icon-btn" data-action="del-expense" data-id="' + x.id + '" title="Supprimer">🗑</button>' +
          '</td></tr>';
      }).join('');
      const total = sum(list, function (x) { return x.amount; });
      U.el('exp-table').innerHTML =
        '<thead><tr><th>Date</th><th>Catégorie</th><th>Libellé</th><th>Fournisseur</th><th class="right">Montant</th><th></th></tr></thead>' +
        '<tbody>' + (rows || '<tr><td colspan="6" class="empty">Aucune dépense.</td></tr>') + '</tbody>' +
        '<tfoot><tr><td colspan="4"><strong>Total</strong></td><td class="right"><strong>' + U.currency(total) + '</strong></td><td></td></tr></tfoot>';
    }
    draw();
    U.el('list-search').addEventListener('input', draw);
    main._draw = draw;
  }

  function openExpenseModal(id) {
    const x = id ? Store.findById('expenses', id) : { date: Store.todayISO(), category: 'Ingrédients' };
    const body = '<form id="entity-form" class="form-grid">' +
      '<div class="form-group"><label>Date</label><input class="input" type="date" name="date" value="' + (x.date || Store.todayISO()) + '"></div>' +
      '<div class="form-group"><label>Catégorie</label><select class="input" name="category">' +
        EXPENSE_CATEGORIES.map(function (c) { return '<option' + (c === x.category ? ' selected' : '') + '>' + c + '</option>'; }).join('') + '</select></div>' +
      '<div class="form-group form-group-full"><label>Libellé *</label><input class="input" name="label" required value="' + U.escapeHtml(x.label || '') + '"></div>' +
      '<div class="form-group"><label>Montant *</label><input class="input" type="number" name="amount" min="0" required value="' + (x.amount != null ? x.amount : '') + '"></div>' +
      '<div class="form-group"><label>Fournisseur</label>' + supplierSelect(x.supplierId, '') + '</div>' +
      '</form>';
    const footer = '<button class="btn btn-ghost" onclick="U.closeModal()">Annuler</button><button class="btn btn-primary" id="save-entity">Enregistrer</button>';
    U.openModal(id ? 'Modifier la dépense' : 'Nouvelle dépense', body, { footer: footer, onOpen: function (overlay) {
      overlay.querySelector('#save-entity').addEventListener('click', function () {
        const form = overlay.querySelector('#entity-form');
        if (!form.reportValidity()) return;
        const data = U.formData(form);
        if (id) { Store.update('expenses', id, data); U.toast('Dépense modifiée', 'success'); }
        else { Store.add('expenses', data); U.toast('Dépense ajoutée', 'success'); }
        U.closeModal();
        refresh();
      });
    } });
  }

  /* ================================================================== */
  /* Rapports                                                           */
  /* ================================================================== */
  function renderReports(main) {
    const end = Store.todayISO();
    const start = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
    main.innerHTML =
      '<div class="toolbar"><label class="inline-label">Du <input type="date" class="input" id="rep-start" value="' + start + '"></label>' +
      '<label class="inline-label">Au <input type="date" class="input" id="rep-end" value="' + end + '"></label>' +
      '<button class="btn btn-ghost" id="rep-export">⬇ Exporter CSV</button></div>' +
      '<div id="report-body"></div>';

    function draw() {
      const s = U.el('rep-start').value;
      const e = U.el('rep-end').value;
      const sales = salesBetween(s, e);
      const revenue = sum(sales, function (x) { return x.total; });
      const profit = sum(sales, saleProfit);
      const nbTx = sales.length;
      const expenses = Store.collection('expenses').filter(function (x) { return x.date >= s && x.date <= e; });
      const totalExp = sum(expenses, function (x) { return x.amount; });
      const net = profit - totalExp;

      // Ventes par produit
      const byProduct = {};
      sales.forEach(function (sale) {
        sale.items.forEach(function (i) {
          if (!byProduct[i.name]) byProduct[i.name] = { qty: 0, revenue: 0, profit: 0 };
          byProduct[i.name].qty += i.qty;
          byProduct[i.name].revenue += i.price * i.qty;
          byProduct[i.name].profit += (i.price - (i.cost || 0)) * i.qty;
        });
      });
      const prodRows = Object.keys(byProduct).map(function (k) {
        return { name: k, qty: byProduct[k].qty, revenue: byProduct[k].revenue, profit: byProduct[k].profit };
      }).sort(function (a, b) { return b.revenue - a.revenue; });

      // Ventes par catégorie
      const byCat = {};
      sales.forEach(function (sale) {
        sale.items.forEach(function (i) {
          const p = Store.findById('products', i.productId);
          const cat = p ? p.category : 'Autre';
          byCat[cat] = (byCat[cat] || 0) + i.price * i.qty;
        });
      });

      // Paiements
      const byPay = {};
      sales.forEach(function (sale) { byPay[sale.payment] = (byPay[sale.payment] || 0) + sale.total; });

      // Dépenses par catégorie
      const expByCat = {};
      expenses.forEach(function (x) { expByCat[x.category] = (expByCat[x.category] || 0) + x.amount; });

      let html = '<div class="stats-grid">' +
        card('Chiffre d\'affaires', U.currency(revenue), nbTx + ' vente(s)', 'accent') +
        card('Marge brute', U.currency(profit), '', 'green') +
        card('Dépenses', U.currency(totalExp), '', 'orange') +
        card('Résultat net', U.currency(net), '', net >= 0 ? 'green' : 'danger') +
        '</div>';

      html += '<div class="grid-2">';
      html += '<div class="panel"><div class="panel-header"><h3>Ventes par catégorie</h3></div><div class="panel-body">' +
        distList(byCat) + '</div></div>';
      html += '<div class="panel"><div class="panel-header"><h3>Modes de paiement</h3></div><div class="panel-body">' +
        distList(byPay) + '</div></div>';
      html += '</div>';

      html += '<div class="panel"><div class="panel-header"><h3>Détail par produit</h3></div><div class="table-wrap"><table class="data-table">' +
        '<thead><tr><th>Produit</th><th>Qté vendue</th><th>CA</th><th>Marge</th></tr></thead><tbody>' +
        (prodRows.length ? prodRows.map(function (p) {
          return '<tr><td>' + U.escapeHtml(p.name) + '</td><td>' + p.qty + '</td><td>' + U.currency(p.revenue) + '</td><td>' + U.currency(p.profit) + '</td></tr>';
        }).join('') : '<tr><td colspan="4" class="empty">Aucune vente sur la période.</td></tr>') +
        '</tbody></table></div></div>';

      html += '<div class="panel"><div class="panel-header"><h3>Dépenses par catégorie</h3></div><div class="panel-body">' +
        (Object.keys(expByCat).length ? distList(expByCat) : '<p class="empty">Aucune dépense.</p>') + '</div></div>';

      U.el('report-body').innerHTML = html;
      main._reportData = { prodRows: prodRows, revenue: revenue, profit: profit, totalExp: totalExp, net: net, period: s + ' → ' + e };
    }

    function distList(obj) {
      const keys = Object.keys(obj);
      if (!keys.length) return '<p class="empty">Aucune donnée.</p>';
      const total = keys.reduce(function (a, k) { return a + obj[k]; }, 0) || 1;
      return keys.sort(function (a, b) { return obj[b] - obj[a]; }).map(function (k) {
        const pct = Math.round(obj[k] / total * 100);
        return '<div class="progress-row"><span class="progress-name">' + U.escapeHtml(k) + '</span>' +
          '<div class="progress-bar"><div class="progress-fill" style="width:' + pct + '%"></div></div>' +
          '<span class="progress-val">' + U.currency(obj[k]) + '</span></div>';
      }).join('');
    }

    draw();
    U.el('rep-start').addEventListener('change', draw);
    U.el('rep-end').addEventListener('change', draw);
    U.el('rep-export').addEventListener('click', function () {
      const d = main._reportData;
      let csv = 'Produit,Quantite,CA,Marge\n';
      d.prodRows.forEach(function (p) { csv += '"' + p.name + '",' + p.qty + ',' + p.revenue + ',' + p.profit + '\n'; });
      csv += '\nPeriode,' + d.period + '\nChiffre affaires,' + d.revenue + '\nMarge brute,' + d.profit + '\nDepenses,' + d.totalExp + '\nResultat net,' + d.net + '\n';
      U.download('rapport_' + Store.todayISO() + '.csv', '\ufeff' + csv, 'text/csv;charset=utf-8');
      U.toast('Rapport exporté', 'success');
    });
  }

  /* ================================================================== */
  /* Paramètres                                                         */
  /* ================================================================== */
  function renderSettings(main) {
    const s = Store.get().settings;
    main.innerHTML =
      '<div class="panel"><div class="panel-header"><h3>Informations de la boulangerie</h3></div><div class="panel-body">' +
      '<form id="settings-form" class="form-grid">' +
      '<div class="form-group"><label>Nom de la boulangerie</label><input class="input" name="bakeryName" value="' + U.escapeHtml(s.bakeryName) + '"></div>' +
      '<div class="form-group"><label>Devise</label><input class="input" name="currency" value="' + U.escapeHtml(s.currency) + '"></div>' +
      '<div class="form-group"><label>Téléphone</label><input class="input" name="phone" value="' + U.escapeHtml(s.phone || '') + '"></div>' +
      '<div class="form-group"><label>Email</label><input class="input" type="email" name="email" value="' + U.escapeHtml(s.email || '') + '"></div>' +
      '<div class="form-group form-group-full"><label>Adresse</label><input class="input" name="address" value="' + U.escapeHtml(s.address || '') + '"></div>' +
      '<div class="form-group"><label>Taux de TVA (%)</label><input class="input" type="number" name="taxRate" min="0" step="0.1" value="' + (s.taxRate || 0) + '"></div>' +
      '<div class="form-group"><label>Seuil d\'alerte stock produits</label><input class="input" type="number" name="lowStockThreshold" min="0" value="' + (s.lowStockThreshold || 0) + '"></div>' +
      '</form>' +
      '<button class="btn btn-primary" id="save-settings">Enregistrer les paramètres</button>' +
      '</div></div>' +
      '<div class="panel"><div class="panel-header"><h3>Données</h3></div><div class="panel-body">' +
      '<p class="muted">Sauvegardez ou restaurez toutes vos données (produits, ventes, clients...).</p>' +
      '<div class="btn-row">' +
      '<button class="btn btn-ghost" id="btn-export">⬇ Exporter (JSON)</button>' +
      '<button class="btn btn-ghost" id="btn-import">⬆ Importer (JSON)</button>' +
      '<input type="file" id="import-file" accept="application/json" hidden>' +
      '<button class="btn btn-ghost" id="btn-seed">🔄 Réinitialiser (données démo)</button>' +
      '<button class="btn btn-danger" id="btn-clear">🗑 Tout effacer</button>' +
      '</div></div></div>';

    U.el('save-settings').addEventListener('click', function () {
      const data = U.formData(U.el('settings-form'));
      Object.assign(Store.get().settings, data);
      Store.save();
      U.el('brand-name').textContent = data.bakeryName;
      applyTheme(Store.get().settings.theme);
      U.toast('Paramètres enregistrés', 'success');
    });
    U.el('btn-export').addEventListener('click', function () {
      U.download('boulangerie_backup_' + Store.todayISO() + '.json', Store.exportJSON(), 'application/json');
      U.toast('Données exportées', 'success');
    });
    U.el('btn-import').addEventListener('click', function () { U.el('import-file').click(); });
    U.el('import-file').addEventListener('change', function (e) {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = function () {
        try {
          Store.importJSON(reader.result);
          U.toast('Données importées', 'success');
          buildNav();
          refresh();
        } catch (err) {
          U.toast('Fichier invalide', 'error');
        }
      };
      reader.readAsText(file);
    });
    U.el('btn-seed').addEventListener('click', function () {
      U.confirm('Réinitialiser toutes les données avec les données de démonstration ?', function () {
        Store.resetAll();
        buildNav();
        applyTheme(Store.get().settings.theme);
        U.toast('Données réinitialisées', 'success');
        refresh();
      });
    });
    U.el('btn-clear').addEventListener('click', function () {
      U.confirm('Effacer DÉFINITIVEMENT toutes les données ? Cette action est irréversible.', function () {
        Store.clearAll();
        buildNav();
        U.toast('Données effacées', 'success');
        refresh();
      }, { yesLabel: 'Tout effacer' });
    });
  }

  /* ================================================================== */
  /* Délégation des actions (data-action)                               */
  /* ================================================================== */
  function bindActionDelegation() {
    U.el('main-content').addEventListener('click', function (e) {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const action = btn.getAttribute('data-action');
      const id = btn.getAttribute('data-id');
      switch (action) {
        case 'add-product': openProductModal(); break;
        case 'edit-product': openProductModal(id); break;
        case 'del-product': confirmDelete('products', id, 'ce produit'); break;
        case 'add-ing': openIngredientModal(); break;
        case 'edit-ing': openIngredientModal(id); break;
        case 'restock-ing': openRestockModal(id); break;
        case 'del-ing': confirmDelete('ingredients', id, 'cet ingrédient'); break;
        case 'edit-recipe': openRecipeModal(id); break;
        case 'produce': openProduceModal(id); break;
        case 'add-order': openOrderModal(); break;
        case 'edit-order': openOrderModal(id); break;
        case 'view-order': viewOrder(id); break;
        case 'del-order': confirmDelete('orders', id, 'cette commande'); break;
        case 'add-client': openClientModal(); break;
        case 'edit-client': openClientModal(id); break;
        case 'del-client': confirmDelete('clients', id, 'ce client'); break;
        case 'add-supplier': openSupplierModal(); break;
        case 'edit-supplier': openSupplierModal(id); break;
        case 'del-supplier': confirmDelete('suppliers', id, 'ce fournisseur'); break;
        case 'add-employee': openEmployeeModal(); break;
        case 'edit-employee': openEmployeeModal(id); break;
        case 'del-employee': confirmDelete('employees', id, 'cet employé'); break;
        case 'add-expense': openExpenseModal(); break;
        case 'edit-expense': openExpenseModal(id); break;
        case 'del-expense': confirmDelete('expenses', id, 'cette dépense'); break;
      }
    });
  }

  function confirmDelete(collection, id, label) {
    U.confirm('Supprimer ' + label + ' ?', function () {
      Store.remove(collection, id);
      U.toast('Supprimé', 'success');
      refresh();
    }, { yesLabel: 'Supprimer' });
  }

  /* ================================================================== */
  document.addEventListener('DOMContentLoaded', function () {
    init();
    bindActionDelegation();
  });

  global.App = { navigate: navigate, refresh: refresh };
})(window);
