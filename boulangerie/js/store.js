/*
 * store.js — Couche de données et persistance (localStorage)
 * Gère l'état global de l'application de gestion de boulangerie.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'boulangerie_data_v1';

  const DEFAULT_SETTINGS = {
    bakeryName: 'Ma Boulangerie',
    address: '',
    phone: '',
    email: '',
    currency: 'FCFA',
    taxRate: 0,
    lowStockThreshold: 10,
    theme: 'light',
  };

  /* ------------------------------------------------------------------ */
  /* Utilitaires internes                                                */
  /* ------------------------------------------------------------------ */
  function uid(prefix) {
    return (prefix || 'id') + '_' + Date.now().toString(36) + '_' +
      Math.random().toString(36).slice(2, 8);
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  /* ------------------------------------------------------------------ */
  /* Données de démonstration                                            */
  /* ------------------------------------------------------------------ */
  function seedData() {
    const now = Date.now();
    const ingredients = [
      { id: 'ing_farine', name: 'Farine de blé', unit: 'kg', stock: 120, minStock: 30, cost: 550, supplierId: 'sup_moulin' },
      { id: 'ing_levure', name: 'Levure', unit: 'kg', stock: 8, minStock: 5, cost: 3500, supplierId: 'sup_moulin' },
      { id: 'ing_sel', name: 'Sel', unit: 'kg', stock: 25, minStock: 10, cost: 300, supplierId: 'sup_epicerie' },
      { id: 'ing_sucre', name: 'Sucre', unit: 'kg', stock: 40, minStock: 15, cost: 700, supplierId: 'sup_epicerie' },
      { id: 'ing_beurre', name: 'Beurre', unit: 'kg', stock: 18, minStock: 20, cost: 4200, supplierId: 'sup_laiterie' },
      { id: 'ing_oeuf', name: 'Œufs', unit: 'unité', stock: 300, minStock: 100, cost: 100, supplierId: 'sup_ferme' },
      { id: 'ing_lait', name: 'Lait', unit: 'L', stock: 60, minStock: 20, cost: 800, supplierId: 'sup_laiterie' },
      { id: 'ing_choco', name: 'Chocolat', unit: 'kg', stock: 12, minStock: 8, cost: 6500, supplierId: 'sup_epicerie' },
    ];

    const products = [
      { id: 'prod_baguette', name: 'Baguette', category: 'Pains', price: 150, cost: 60, stock: 80, sku: 'PAIN-001', active: true, recipe: [ { ingredientId: 'ing_farine', qty: 0.25 }, { ingredientId: 'ing_levure', qty: 0.005 }, { ingredientId: 'ing_sel', qty: 0.005 } ] },
      { id: 'prod_pain_complet', name: 'Pain complet', category: 'Pains', price: 250, cost: 110, stock: 40, sku: 'PAIN-002', active: true, recipe: [ { ingredientId: 'ing_farine', qty: 0.35 }, { ingredientId: 'ing_levure', qty: 0.006 } ] },
      { id: 'prod_croissant', name: 'Croissant', category: 'Viennoiseries', price: 300, cost: 130, stock: 60, sku: 'VIEN-001', active: true, recipe: [ { ingredientId: 'ing_farine', qty: 0.06 }, { ingredientId: 'ing_beurre', qty: 0.03 }, { ingredientId: 'ing_sucre', qty: 0.01 } ] },
      { id: 'prod_pain_choco', name: 'Pain au chocolat', category: 'Viennoiseries', price: 350, cost: 160, stock: 50, sku: 'VIEN-002', active: true, recipe: [ { ingredientId: 'ing_farine', qty: 0.06 }, { ingredientId: 'ing_beurre', qty: 0.03 }, { ingredientId: 'ing_choco', qty: 0.02 } ] },
      { id: 'prod_eclair', name: 'Éclair au chocolat', category: 'Pâtisseries', price: 600, cost: 250, stock: 25, sku: 'PATI-001', active: true, recipe: [ { ingredientId: 'ing_farine', qty: 0.05 }, { ingredientId: 'ing_oeuf', qty: 1 }, { ingredientId: 'ing_choco', qty: 0.03 }, { ingredientId: 'ing_lait', qty: 0.1 } ] },
      { id: 'prod_tarte', name: 'Tarte aux pommes', category: 'Pâtisseries', price: 2500, cost: 1100, stock: 8, sku: 'PATI-002', active: true, recipe: [ { ingredientId: 'ing_farine', qty: 0.3 }, { ingredientId: 'ing_beurre', qty: 0.15 }, { ingredientId: 'ing_sucre', qty: 0.1 } ] },
      { id: 'prod_cafe', name: 'Café', category: 'Boissons', price: 500, cost: 150, stock: 999, sku: 'BOIS-001', active: true, recipe: [] },
      { id: 'prod_jus', name: 'Jus d\'orange', category: 'Boissons', price: 700, cost: 300, stock: 30, sku: 'BOIS-002', active: true, recipe: [] },
    ];

    const suppliers = [
      { id: 'sup_moulin', name: 'Grand Moulin', contact: 'M. Diallo', phone: '77 123 45 67', email: 'contact@moulin.sn', address: 'Zone industrielle' },
      { id: 'sup_epicerie', name: 'Épicerie Centrale', contact: 'Mme Ndiaye', phone: '76 987 65 43', email: 'vente@epicerie.sn', address: 'Marché central' },
      { id: 'sup_laiterie', name: 'Laiterie du Fleuve', contact: 'M. Sow', phone: '78 555 44 33', email: 'info@laiterie.sn', address: 'Route de la ferme' },
      { id: 'sup_ferme', name: 'Ferme Avicole Keur', contact: 'M. Fall', phone: '70 222 11 00', email: 'ferme@keur.sn', address: 'Rufisque' },
    ];

    const clients = [
      { id: 'cli_1', name: 'Aïssatou Ba', phone: '77 000 11 22', email: 'aissatou@mail.com', address: 'Dakar', loyaltyPoints: 120, totalSpent: 0 },
      { id: 'cli_2', name: 'Restaurant Le Baobab', phone: '78 333 44 55', email: 'baobab@resto.com', address: 'Plateau', loyaltyPoints: 540, totalSpent: 0 },
      { id: 'cli_3', name: 'Moussa Diop', phone: '76 666 77 88', email: 'moussa@mail.com', address: 'Pikine', loyaltyPoints: 30, totalSpent: 0 },
    ];

    const employees = [
      { id: 'emp_1', name: 'Fatou Sarr', role: 'Boulanger', phone: '77 111 22 33', salary: 180000, hireDate: '2023-01-15', active: true },
      { id: 'emp_2', name: 'Ibrahima Gueye', role: 'Pâtissier', phone: '78 444 55 66', salary: 200000, hireDate: '2022-06-01', active: true },
      { id: 'emp_3', name: 'Awa Ndoye', role: 'Vendeur', phone: '76 777 88 99', salary: 130000, hireDate: '2024-03-10', active: true },
    ];

    // Ventes de démonstration réparties sur les derniers jours
    const sales = [];
    const dayMs = 86400000;
    for (let d = 6; d >= 0; d--) {
      const dateISO = new Date(now - d * dayMs).toISOString().slice(0, 10);
      const nbSales = 2 + Math.floor(Math.random() * 3);
      for (let s = 0; s < nbSales; s++) {
        const items = [];
        const nbItems = 1 + Math.floor(Math.random() * 3);
        let total = 0;
        for (let i = 0; i < nbItems; i++) {
          const p = products[Math.floor(Math.random() * products.length)];
          const qty = 1 + Math.floor(Math.random() * 4);
          items.push({ productId: p.id, name: p.name, price: p.price, qty: qty, cost: p.cost });
          total += p.price * qty;
        }
        sales.push({
          id: uid('sale'),
          date: dateISO,
          createdAt: now - d * dayMs + s * 3600000,
          items: items,
          subtotal: total,
          discount: 0,
          tax: 0,
          total: total,
          payment: ['Espèces', 'Mobile Money', 'Carte'][Math.floor(Math.random() * 3)],
          clientId: Math.random() > 0.6 ? clients[Math.floor(Math.random() * clients.length)].id : null,
          employeeId: employees[Math.floor(Math.random() * employees.length)].id,
        });
      }
    }

    const orders = [
      { id: 'ord_1', clientId: 'cli_2', date: todayISO(), dueDate: new Date(now + dayMs).toISOString().slice(0, 10), items: [ { productId: 'prod_baguette', name: 'Baguette', price: 150, qty: 50 }, { productId: 'prod_croissant', name: 'Croissant', price: 300, qty: 30 } ], total: 16500, status: 'En attente', notes: 'Livraison le matin' },
    ];

    const expenses = [
      { id: 'exp_1', date: todayISO(), category: 'Ingrédients', label: 'Achat farine (500kg)', amount: 275000, supplierId: 'sup_moulin' },
      { id: 'exp_2', date: todayISO(), category: 'Salaires', label: 'Avance salaire', amount: 50000, supplierId: null },
      { id: 'exp_3', date: todayISO(), category: 'Énergie', label: 'Facture électricité', amount: 85000, supplierId: null },
    ];

    return {
      settings: Object.assign({}, DEFAULT_SETTINGS),
      ingredients,
      products,
      suppliers,
      clients,
      employees,
      sales,
      orders,
      expenses,
    };
  }

  /* ------------------------------------------------------------------ */
  /* API du Store                                                        */
  /* ------------------------------------------------------------------ */
  let state = null;

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        state = JSON.parse(raw);
        // garantir la présence des paramètres par défaut
        state.settings = Object.assign({}, DEFAULT_SETTINGS, state.settings || {});
        ['ingredients', 'products', 'suppliers', 'clients', 'employees', 'sales', 'orders', 'expenses']
          .forEach(function (k) { if (!Array.isArray(state[k])) state[k] = []; });
        return state;
      }
    } catch (e) {
      console.error('Erreur de chargement des données', e);
    }
    state = seedData();
    save();
    return state;
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      console.error('Erreur de sauvegarde', e);
    }
  }

  function get() {
    if (!state) load();
    return state;
  }

  function collection(name) {
    return get()[name];
  }

  function findById(name, id) {
    return collection(name).find(function (x) { return x.id === id; }) || null;
  }

  function add(name, obj) {
    if (!obj.id) obj.id = uid(name.slice(0, 3));
    collection(name).push(obj);
    save();
    return obj;
  }

  function update(name, id, patch) {
    const item = findById(name, id);
    if (item) {
      Object.assign(item, patch);
      save();
    }
    return item;
  }

  function remove(name, id) {
    const arr = collection(name);
    const idx = arr.findIndex(function (x) { return x.id === id; });
    if (idx > -1) {
      arr.splice(idx, 1);
      save();
      return true;
    }
    return false;
  }

  function resetAll() {
    state = seedData();
    save();
    return state;
  }

  function clearAll() {
    state = {
      settings: Object.assign({}, DEFAULT_SETTINGS),
      ingredients: [], products: [], suppliers: [], clients: [],
      employees: [], sales: [], orders: [], expenses: [],
    };
    save();
    return state;
  }

  function exportJSON() {
    return JSON.stringify(get(), null, 2);
  }

  function importJSON(json) {
    const parsed = typeof json === 'string' ? JSON.parse(json) : json;
    state = Object.assign(seedData(), parsed);
    state.settings = Object.assign({}, DEFAULT_SETTINGS, parsed.settings || {});
    save();
    return state;
  }

  global.Store = {
    STORAGE_KEY,
    DEFAULT_SETTINGS,
    uid,
    todayISO,
    load,
    save,
    get,
    collection,
    findById,
    add,
    update,
    remove,
    resetAll,
    clearAll,
    exportJSON,
    importJSON,
  };
})(window);
