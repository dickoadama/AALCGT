# 🥖 Gestion de Boulangerie

Application web complète (HTML / CSS / JavaScript pur, sans dépendance ni serveur) pour la gestion totale d'une boulangerie. Toutes les données sont stockées **localement dans le navigateur** (`localStorage`).

## Lancer l'application

Ouvrez simplement `index.html` dans un navigateur, ou via GitHub Pages :
`https://dickoadama.github.io/AALCGT/boulangerie/`

## Modules

| Module | Description |
|--------|-------------|
| 📊 **Tableau de bord** | CA du jour, bénéfice, ticket moyen, graphique des ventes sur 7 jours, top produits, alertes de stock. |
| 🧾 **Caisse / Ventes** | Point de vente tactile : sélection des produits, panier, remise, TVA, choix du client/employé/paiement, encaissement et **reçu imprimable**. Décrémente automatiquement le stock produits et ingrédients. |
| 🥖 **Produits** | CRUD complet : prix, coût, marge calculée, catégorie, SKU, stock, statut actif/inactif. |
| 🌾 **Ingrédients / Stock** | Gestion des matières premières, seuils d'alerte, valeur du stock, **réapprovisionnement** (avec création de dépense). |
| 📖 **Recettes / Production** | Composition de chaque produit en ingrédients, coût matières, **lancement de production** (avec vérification des stocks). |
| 📦 **Commandes** | Commandes clients avec articles, échéance, statuts (en attente → livrée). |
| 👥 **Clients** | Fiches clients, points de fidélité, total dépensé. |
| 🚚 **Fournisseurs** | Carnet de fournisseurs. |
| 👨‍🍳 **Employés** | Personnel, postes, salaires, masse salariale. |
| 💸 **Dépenses** | Suivi des charges par catégorie. |
| 📈 **Rapports** | Analyse sur période : CA, marge, dépenses, résultat net, ventes par produit/catégorie/paiement, **export CSV**. |
| ⚙️ **Paramètres** | Infos boulangerie, devise, TVA, seuil d'alerte, **export/import JSON**, réinitialisation. |

## Fonctionnalités transversales

- Thème clair / sombre
- Interface responsive (mobile, tablette, desktop)
- Notifications (toasts), fenêtres modales, recherche/filtre dans chaque liste
- Données de démonstration au premier lancement
- Sauvegarde / restauration complète (JSON)

## Structure

```
boulangerie/
├── index.html          # Structure et point d'entrée
├── css/styles.css      # Styles + thèmes + responsive
└── js/
    ├── store.js        # Données & persistance (localStorage) + données démo
    ├── utils.js        # Helpers (format, modales, toasts, download...)
    └── app.js          # Routage et logique de tous les modules
```
