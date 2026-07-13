/*
 * utils.js — Fonctions utilitaires (format, modales, notifications, etc.)
 */
(function (global) {
  'use strict';

  function currency(amount) {
    const cur = (global.Store && Store.get().settings.currency) || 'FCFA';
    const n = Number(amount) || 0;
    return n.toLocaleString('fr-FR', { maximumFractionDigits: 2 }) + ' ' + cur;
  }

  function number(n, digits) {
    return (Number(n) || 0).toLocaleString('fr-FR', {
      maximumFractionDigits: digits == null ? 2 : digits,
    });
  }

  function formatDate(iso) {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function formatDateTime(ms) {
    const d = new Date(ms);
    return d.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function escapeHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function el(id) { return document.getElementById(id); }

  function qs(sel, root) { return (root || document).querySelector(sel); }

  function qsa(sel, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(sel));
  }

  /* ---- Notifications (toast) ---- */
  function toast(message, type) {
    let container = el('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }
    const t = document.createElement('div');
    t.className = 'toast toast-' + (type || 'info');
    t.textContent = message;
    container.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('show'); });
    setTimeout(function () {
      t.classList.remove('show');
      setTimeout(function () { t.remove(); }, 300);
    }, 3000);
  }

  /* ---- Modale générique ---- */
  function openModal(title, bodyHtml, opts) {
    opts = opts || {};
    closeModal();
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'active-modal';
    overlay.innerHTML =
      '<div class="modal ' + (opts.size || '') + '">' +
        '<div class="modal-header">' +
          '<h3>' + escapeHtml(title) + '</h3>' +
          '<button class="modal-close" aria-label="Fermer">&times;</button>' +
        '</div>' +
        '<div class="modal-body">' + bodyHtml + '</div>' +
        (opts.footer ? '<div class="modal-footer">' + opts.footer + '</div>' : '') +
      '</div>';
    document.body.appendChild(overlay);
    document.body.classList.add('modal-open');
    overlay.querySelector('.modal-close').addEventListener('click', closeModal);
    overlay.addEventListener('mousedown', function (e) {
      if (e.target === overlay && !opts.persistent) closeModal();
    });
    if (typeof opts.onOpen === 'function') opts.onOpen(overlay);
    return overlay;
  }

  function closeModal() {
    const m = el('active-modal');
    if (m) m.remove();
    document.body.classList.remove('modal-open');
  }

  /* ---- Confirmation ---- */
  function confirm(message, onYes, opts) {
    opts = opts || {};
    const footer =
      '<button class="btn btn-ghost" data-confirm="no">Annuler</button>' +
      '<button class="btn btn-danger" data-confirm="yes">' + escapeHtml(opts.yesLabel || 'Confirmer') + '</button>';
    const overlay = openModal(opts.title || 'Confirmation',
      '<p class="confirm-text">' + escapeHtml(message) + '</p>', { footer: footer, size: 'modal-sm' });
    overlay.querySelector('[data-confirm="no"]').addEventListener('click', closeModal);
    overlay.querySelector('[data-confirm="yes"]').addEventListener('click', function () {
      closeModal();
      if (typeof onYes === 'function') onYes();
    });
  }

  /* ---- Téléchargement de fichier ---- */
  function download(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ---- Sérialisation d'un formulaire ---- */
  function formData(form) {
    const data = {};
    qsa('[name]', form).forEach(function (input) {
      const name = input.getAttribute('name');
      if (input.type === 'checkbox') {
        data[name] = input.checked;
      } else if (input.type === 'number') {
        data[name] = input.value === '' ? null : Number(input.value);
      } else {
        data[name] = input.value;
      }
    });
    return data;
  }

  global.U = {
    currency,
    number,
    formatDate,
    formatDateTime,
    escapeHtml,
    el, qs, qsa,
    toast,
    openModal,
    closeModal,
    confirm,
    download,
    formData,
  };
})(window);
