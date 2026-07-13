/*
 * AALCGT - fonctions utilitaires pures.
 *
 * Ce module regroupe la logique metier sans effet de bord (pas d'acces au DOM,
 * au localStorage ni aux variables globales) afin de pouvoir la tester
 * unitairement. Il est charge :
 *   - dans le navigateur via <script src="assets/js/utils.js"></script>
 *     (les fonctions sont exposees sur l'objet global window) ;
 *   - dans Node/Jest via require('./assets/js/utils.js').
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    var api = factory();
    for (var key in api) {
      if (Object.prototype.hasOwnProperty.call(api, key)) {
        root[key] = api[key];
      }
    }
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // Echappe les caracteres HTML dangereux. Reproduit le comportement de
  // l'ancienne implementation basee sur textContent -> innerHTML (qui
  // n'echappe que &, < et >).
  function escapeHtml(t) {
    return String(t || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Determine si un utilisateur peut gerer la caisse.
  function canManageCash(u) {
    return !!(u && (u.role === 'superadmin' || u.role === 'admin' || u.bureauRole === 'tresorier' || u.canManageCash));
  }

  var TYPE_LABELS = {
    emploi: '\uD83D\uDCBC Emploi',
    stage: '\uD83C\uDF93 Stage',
    concours: '\uD83D\uDCDD Concours',
    experience: '\uD83D\uDC54 Exp\u00e9rience',
    actualite: '\uD83D\uDCF0 Actualit\u00e9',
    bourse: '\uD83C\uDF93 Bourse',
    formation: '\uD83D\uDCDA Formation',
    autre: '\uD83D\uDCC4 Autre'
  };

  // Libelle lisible d'un type d'opportunite (retombe sur la cle si inconnue).
  function getTypeLabel(t) {
    return TYPE_LABELS[t] || t;
  }

  var TYPE_BADGE_CLASSES = {
    emploi: 'badge-emploi',
    stage: 'badge-stage',
    concours: 'badge-concours',
    experience: 'badge-experience',
    actualite: 'badge-actualite',
    bourse: 'badge-bourse',
    formation: 'badge-formation'
  };

  // Classe CSS du badge d'un type d'opportunite (defaut: badge-emploi).
  function getTypeBadgeClass(t) {
    return TYPE_BADGE_CLASSES[t] || 'badge-emploi';
  }

  // Calcule recettes / depenses / solde a partir des transactions validees.
  function computeBalance(transactions) {
    var recettes = 0;
    var depenses = 0;
    var list = transactions || [];
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      if (t && t.status === 'validated') {
        if (t.type === 'recette') {
          recettes += t.amount;
        } else {
          depenses += t.amount;
        }
      }
    }
    return { recettes: recettes, depenses: depenses, solde: recettes - depenses };
  }

  // Filtre les transactions selon la valeur du selecteur de la caisse.
  //   'all'      -> toutes
  //   'pending'  -> en attente
  //   'rejected' -> rejetees
  //   autre      -> filtre par type (recette / depense)
  function filterTransactions(transactions, filter) {
    var list = transactions || [];
    return list.filter(function (t) {
      if (filter === 'all') return true;
      if (filter === 'pending') return t.status === 'pending';
      if (filter === 'rejected') return t.status === 'rejected';
      return t.type === filter;
    });
  }

  // Statistiques de messagerie pour l'utilisateur courant.
  function computeMessageStats(messages, currentUserId) {
    var list = messages || [];
    var total = list.length;
    var sent = 0;
    var pinned = 0;
    var unread = 0;
    for (var i = 0; i < list.length; i++) {
      var m = list[i];
      if (m.senderId === currentUserId) sent++;
      if (m.pinned) pinned++;
      if (m.receiverId === currentUserId && !m.read) unread++;
    }
    return {
      total: total,
      sent: sent,
      received: total - sent,
      unread: unread,
      pinned: pinned
    };
  }

  return {
    escapeHtml: escapeHtml,
    canManageCash: canManageCash,
    getTypeLabel: getTypeLabel,
    getTypeBadgeClass: getTypeBadgeClass,
    computeBalance: computeBalance,
    filterTransactions: filterTransactions,
    computeMessageStats: computeMessageStats
  };
});
