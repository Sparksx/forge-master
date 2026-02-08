# Forge Master — TODO

## 🔴 Priorité haute

- [x] **Sécurité XSS — innerHTML** — `ui.js` utilise `innerHTML` avec interpolation. Remplacer par `document.createElement()` / `textContent`
- [x] **Validation des saves** — `loadGame()` ne vérifie pas la structure des items (level, stats, type manquants = crash). Ajouter une fonction `isValidItem()`
- [x] **Système de monnaie (sell)** — Le bouton "Sell" ne fait rien. Implémenter un système d'or gagné à la vente, affichable dans le HUD
- [x] **Tests unitaires** — Ajouter Vitest pour tester `createItem()`, `calculateStats()`, `forgeEquipment()`, l'EventEmitter et le round-trip save/load
- [x] **Responsive / Mobile** — `.body-container` est fixé à 600×700px. Ajouter des media queries et un layout adaptatif

## 🟡 Priorité moyenne

- [ ] **Accessibilité (a11y)** — Modal sans `role="dialog"`, pas de `aria-label` sur les slots, focus non piégé, pas de bouton "Fermer"
- [ ] **Système de rareté** — Commun / Rare / Épique / Légendaire avec couleurs, multiplicateurs de stats, feedback visuel
- [ ] **Progression & endgame** — Niveaux joueur, XP, achievements, objectifs de jeu
- [x] **Déploiement GitHub Pages** — Ajouter `base: '/forge-master/'` dans vite.config.js + GitHub Action pour build & deploy auto
- [ ] **ESLint + Prettier** — Config de linting, formatting, pre-commit hooks (husky)

## 🟢 Priorité basse

- [ ] **Cache des éléments DOM** — `showDecisionModal()` et `updateStats()` requêtent les mêmes éléments à chaque appel. Cacher les refs à l'init
- [ ] **Re-render ciblé** — `updateEquipmentSlots()` met à jour les 8 slots même si un seul a changé. Cibler le slot modifié
- [ ] **JSDoc / TypeScript** — Ajouter JSDoc sur les fonctions publiques ou migrer vers TypeScript
- [ ] **Error boundaries** — Les handlers de click n'ont pas de try-catch. Un échec dans `equipItem()` laisse la modal bloquée
- [ ] **EventEmitter robuste** — Vérification de type + try-catch sur les callbacks pour éviter qu'un listener qui throw casse les suivants
