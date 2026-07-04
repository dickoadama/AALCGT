**AALCGT — Site publié**

- **Site (GitHub Pages)**: https://dickoadama.github.io/AALCGT/
- **Page principale**: [index.html](index.html)
- **Images locales**: [assets/images](assets/images) — fichiers `illustration1|2|3-light.jpg` et `-dark.jpg` pour chaque variante.
- **Thème & images**: le basculement clair/sombre est géré par `toggleDarkMode()` et la fonction `updateThemeImages()` dans [index.html](index.html). Ces fonctions remplacent la `src` des éléments ayant la classe `theme-illustration` selon `data-light` / `data-dark`.
- **Déploiement automatique**: workflow GitHub Actions ajouté — [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) (déploiement vers la branche `gh-pages` à chaque push sur `main`).
- **Modifier les images**: remplacer les fichiers dans `assets/images/` ou modifier les attributs `data-light`/`data-dark` dans [index.html](index.html).
- **Crédits images**: images originales issues de Unsplash (utilisation permissive). Conservez attribution si nécessaire.

Si vous voulez, je peux ajouter une courte page d'attribution ou remplacer les images existantes — dites-moi lesquelles.
