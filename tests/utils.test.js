'use strict';

const {
  escapeHtml,
  canManageCash,
  getTypeLabel,
  getTypeBadgeClass,
  computeBalance,
  filterTransactions,
  computeMessageStats
} = require('../assets/js/utils.js');

describe('escapeHtml', () => {
  test('echappe les caracteres HTML speciaux', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    );
  });

  test('echappe les esperluettes avant les autres entites', () => {
    expect(escapeHtml('a & b < c')).toBe('a &amp; b &lt; c');
    expect(escapeHtml('&lt;')).toBe('&amp;lt;');
  });

  test('retourne une chaine vide pour null, undefined ou 0', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(0)).toBe('');
    expect(escapeHtml('')).toBe('');
  });

  test('convertit les valeurs non-chaines en texte', () => {
    expect(escapeHtml(42)).toBe('42');
  });

  test('laisse le texte sans caractere special intact', () => {
    expect(escapeHtml('Bonjour le monde')).toBe('Bonjour le monde');
  });
});

describe('canManageCash', () => {
  test('autorise superadmin et admin', () => {
    expect(canManageCash({ role: 'superadmin' })).toBe(true);
    expect(canManageCash({ role: 'admin' })).toBe(true);
  });

  test('autorise le tresorier du bureau', () => {
    expect(canManageCash({ role: 'membre', bureauRole: 'tresorier' })).toBe(true);
  });

  test('autorise via le drapeau canManageCash', () => {
    expect(canManageCash({ role: 'membre', canManageCash: true })).toBe(true);
  });

  test('refuse un membre standard', () => {
    expect(canManageCash({ role: 'membre' })).toBe(false);
  });

  test('renvoie false (et non une valeur falsy) pour null/undefined', () => {
    expect(canManageCash(null)).toBe(false);
    expect(canManageCash(undefined)).toBe(false);
  });
});

describe('getTypeLabel', () => {
  test('retourne le libelle connu pour chaque type', () => {
    expect(getTypeLabel('emploi')).toBe('\uD83D\uDCBC Emploi');
    expect(getTypeLabel('stage')).toBe('\uD83C\uDF93 Stage');
    expect(getTypeLabel('concours')).toBe('\uD83D\uDCDD Concours');
    expect(getTypeLabel('experience')).toBe('\uD83D\uDC54 Exp\u00e9rience');
    expect(getTypeLabel('actualite')).toBe('\uD83D\uDCF0 Actualit\u00e9');
    expect(getTypeLabel('bourse')).toBe('\uD83C\uDF93 Bourse');
    expect(getTypeLabel('formation')).toBe('\uD83D\uDCDA Formation');
    expect(getTypeLabel('autre')).toBe('\uD83D\uDCC4 Autre');
  });

  test('retombe sur la cle pour un type inconnu', () => {
    expect(getTypeLabel('inconnu')).toBe('inconnu');
  });
});

describe('getTypeBadgeClass', () => {
  test('retourne la classe connue pour chaque type', () => {
    expect(getTypeBadgeClass('emploi')).toBe('badge-emploi');
    expect(getTypeBadgeClass('stage')).toBe('badge-stage');
    expect(getTypeBadgeClass('concours')).toBe('badge-concours');
    expect(getTypeBadgeClass('experience')).toBe('badge-experience');
    expect(getTypeBadgeClass('actualite')).toBe('badge-actualite');
    expect(getTypeBadgeClass('bourse')).toBe('badge-bourse');
    expect(getTypeBadgeClass('formation')).toBe('badge-formation');
  });

  test('retombe sur badge-emploi pour un type inconnu', () => {
    expect(getTypeBadgeClass('autre')).toBe('badge-emploi');
    expect(getTypeBadgeClass('xyz')).toBe('badge-emploi');
  });
});

describe('computeBalance', () => {
  test('additionne uniquement les transactions validees', () => {
    const tx = [
      { type: 'recette', amount: 5000, status: 'validated' },
      { type: 'depense', amount: 3500, status: 'validated' },
      { type: 'recette', amount: 50000, status: 'validated' },
      { type: 'depense', amount: 25000, status: 'pending' }
    ];
    expect(computeBalance(tx)).toEqual({
      recettes: 55000,
      depenses: 3500,
      solde: 51500
    });
  });

  test('ignore les transactions non validees (pending, rejected)', () => {
    const tx = [
      { type: 'recette', amount: 1000, status: 'pending' },
      { type: 'depense', amount: 2000, status: 'rejected' }
    ];
    expect(computeBalance(tx)).toEqual({ recettes: 0, depenses: 0, solde: 0 });
  });

  test('traite tout type non-recette comme une depense', () => {
    const tx = [{ type: 'depense', amount: 700, status: 'validated' }];
    expect(computeBalance(tx)).toEqual({ recettes: 0, depenses: 700, solde: -700 });
  });

  test('gere une liste vide ou absente', () => {
    expect(computeBalance([])).toEqual({ recettes: 0, depenses: 0, solde: 0 });
    expect(computeBalance()).toEqual({ recettes: 0, depenses: 0, solde: 0 });
  });
});

describe('filterTransactions', () => {
  const tx = [
    { id: 1, type: 'recette', status: 'validated' },
    { id: 2, type: 'depense', status: 'pending' },
    { id: 3, type: 'recette', status: 'rejected' },
    { id: 4, type: 'depense', status: 'validated' }
  ];

  test("'all' retourne toutes les transactions", () => {
    expect(filterTransactions(tx, 'all')).toHaveLength(4);
  });

  test("'pending' ne garde que les transactions en attente", () => {
    expect(filterTransactions(tx, 'pending').map((t) => t.id)).toEqual([2]);
  });

  test("'rejected' ne garde que les transactions rejetees", () => {
    expect(filterTransactions(tx, 'rejected').map((t) => t.id)).toEqual([3]);
  });

  test('filtre par type sinon (recette / depense)', () => {
    expect(filterTransactions(tx, 'recette').map((t) => t.id)).toEqual([1, 3]);
    expect(filterTransactions(tx, 'depense').map((t) => t.id)).toEqual([2, 4]);
  });

  test('gere une liste absente', () => {
    expect(filterTransactions(undefined, 'all')).toEqual([]);
  });

  test('ne mute pas le tableau source', () => {
    const copy = tx.slice();
    filterTransactions(tx, 'recette');
    expect(tx).toEqual(copy);
  });
});

describe('computeMessageStats', () => {
  const messages = [
    { senderId: 1, receiverId: 2, read: true, pinned: false },
    { senderId: 2, receiverId: 1, read: false, pinned: true },
    { senderId: 2, receiverId: 1, read: true, pinned: false },
    { senderId: 1, receiverId: 2, read: false, pinned: true }
  ];

  test('calcule total, envoyes, recus, non lus et epingles', () => {
    expect(computeMessageStats(messages, 1)).toEqual({
      total: 4,
      sent: 2,
      received: 2,
      unread: 1,
      pinned: 2
    });
  });

  test('les non lus ne comptent que ceux recus par l utilisateur', () => {
    // Pour l'utilisateur 2, un seul message recu non lu (le dernier).
    expect(computeMessageStats(messages, 2)).toMatchObject({
      sent: 2,
      received: 2,
      unread: 1
    });
  });

  test('gere une liste vide ou absente', () => {
    expect(computeMessageStats([], 1)).toEqual({
      total: 0,
      sent: 0,
      received: 0,
      unread: 0,
      pinned: 0
    });
    expect(computeMessageStats(undefined, 1)).toEqual({
      total: 0,
      sent: 0,
      received: 0,
      unread: 0,
      pinned: 0
    });
  });
});
