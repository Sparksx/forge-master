# Forge Master — TODO

## 🔴 Priorité haute — Complété

- [x] **Sécurité XSS — innerHTML** — `ui.js` utilise `innerHTML` avec interpolation. Remplacer par `document.createElement()` / `textContent`
- [x] **Validation des saves** — `loadGame()` ne vérifie pas la structure des items (level, stats, type manquants = crash). Ajouter une fonction `isValidItem()`
- [x] **Système de monnaie (sell)** — Le bouton "Sell" ne fait rien. Implémenter un système d'or gagné à la vente, affichable dans le HUD
- [x] **Tests unitaires** — Ajouter Vitest pour tester `createItem()`, `calculateStats()`, `forgeEquipment()`, l'EventEmitter et le round-trip save/load
- [x] **Responsive / Mobile** — `.body-container` est fixé à 600×700px. Ajouter des media queries et un layout adaptatif
- [x] **Déploiement GitHub Pages** — Ajouter `base: '/forge-master/'` dans vite.config.js + GitHub Action pour build & deploy auto
- [x] **Système de rareté** — 6 tiers (Common → Mythic) avec couleurs, bonus multiples, forge level 1-30
- [x] **Système de donjons** — 10 vagues × 10 sous-vagues, combat tick-based, multi-monstres
- [x] **Mode PvP** — Matchmaking Socket.io, combat par tours, système Elo
- [x] **Chat temps réel** — Canal global, historique, aperçu avec indicateur non-lu
- [x] **Authentification** — JWT avec rotation de refresh tokens, register/login, sauvegarde serveur

## 🔴 Priorité haute — Sécurité & Robustesse

- [x] **Instances PrismaClient multiples** — `server/routes/auth.js`, `server/routes/game.js`, `server/socket/pvp.js` et `server/socket/chat.js` créent chacun leur propre `new PrismaClient()`. Centraliser dans un singleton (`server/lib/prisma.js`) pour éviter les fuites de connexion en production
- [x] **Rate limiting sur l'authentification** — Les routes `POST /api/auth/login` et `/register` n'ont aucun rate limiting. Un attaquant peut brute-force les mots de passe. Ajouter `express-rate-limit` (ex: 5 tentatives/minute par IP)
- [x] **Validation du game state côté serveur** — `PUT /api/game/state` (`server/routes/game.js`) accepte n'importe quel JSON pour `equipment`, `combat`, `forgeUpgrade` sans validation de structure. Un client malveillant peut sauvegarder des données arbitraires. Ajouter une validation similaire à `isValidItem()` côté serveur
- [x] **CORS restrictif en production** — `app.use(cors())` autorise toutes les origines. Restreindre à `https://web-production-aeea.up.railway.app` en production via une variable d'environnement
- [x] **Nettoyage des refresh tokens expirés** — Les `RefreshToken` expirés ne sont jamais supprimés de la DB. Ajouter un job périodique ou un nettoyage au démarrage (ex: `deleteMany({ where: { expiresAt: { lt: new Date() } } })`)

## 🟡 Priorité moyenne — Architecture & Code

- [ ] **Duplication du calcul de stats serveur/client** — `server/socket/pvp.js:computeStatsFromEquipment()` (lignes 327-369) duplique la logique de `src/forge.js` et `src/config.js` avec des constantes en dur. Si l'équilibrage change, les deux versions divergeront. Extraire les constantes et la logique de calcul dans un module partagé (`shared/stats.js`)
- [ ] **Découpage de `ui.js`** — Le fichier fait ~950 lignes et gère le rendu de la forge, du combat, des modales, du profil, de l'auto-forge et des toasts. Découper en modules : `ui/forge-ui.js`, `ui/combat-ui.js`, `ui/profile-ui.js`, `ui/modals.js`
- [ ] **EventEmitter robuste** — Ajouter try-catch dans `emit()` pour isoler les erreurs des listeners. Un listener qui throw casse tous les listeners suivants du même événement (`src/events.js:20`)
- [ ] **ESLint + Prettier** — Config de linting, formatting, pre-commit hooks (husky). Assurerait une cohérence de style dans tout le projet

## 🟡 Priorité moyenne — Accessibilité & UX

- [ ] **Accessibilité (a11y)** — Modal sans `role="dialog"`, pas de `aria-label` sur les slots, focus non piégé, pas de bouton "Fermer" accessible au clavier. Ajouter les attributs ARIA, le piège de focus dans les modales, et la navigation clavier

## 🟡 Priorité moyenne — Gameplay

- [ ] **Progression & endgame** — Niveaux joueur, XP, achievements, objectifs de jeu. Actuellement la progression repose uniquement sur le forge level et le donjon
- [ ] **Boutique réaliste** — `shop.js` ajoute de l'or gratuitement sans aucune vérification de paiement. Soit retirer les prix affichés et en faire une mécanique de jeu (récompenses), soit intégrer un vrai système de paiement
- [ ] **Matchmaking PvP amélioré** — Actuellement les 2 premiers joueurs en file sont appairés (FIFO dans `server/socket/pvp.js:tryMatch()`). Implémenter un matching basé sur le rating Elo pour des combats plus équilibrés
- [ ] **Vitesse d'attaque des monstres** — `combat.js:190` utilise `monstersInWave[0]?.attackSpeed` pour le timing d'attaque de tous les monstres. Chaque monstre devrait attaquer avec sa propre vitesse

## 🟢 Priorité basse — Optimisations

- [ ] **Cache des éléments DOM** — `showDecisionModal()` et `updateStats()` requêtent les mêmes éléments à chaque appel. Cacher les refs à l'init
- [ ] **Re-render ciblé** — `updateEquipmentSlots()` met à jour les 8 slots même si un seul a changé. Cibler le slot modifié
- [ ] **Error boundaries** — Les handlers de click n'ont pas de try-catch. Un échec dans `equipItem()` laisse la modal bloquée ouverte
- [ ] **JSDoc / TypeScript** — Ajouter JSDoc sur les fonctions publiques ou migrer vers TypeScript pour un meilleur outillage

## 🟢 Priorité basse — Fonctionnalités futures

- [ ] **Compétences actives et passives** — Arbre de compétences débloquable avec des points gagnés par la progression
- [ ] **Familiers / Compagnons** — Créatures qui apportent des bonus passifs ou aident en combat
- [ ] **Arbre technologique** — Upgrades permanents qui améliorent la forge, le combat ou les gains d'or
- [ ] **Système de guildes** — Canaux de chat par guilde, boss de guilde, classement de guilde
