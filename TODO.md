# Gear Master — TODO

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

## 🟡 Priorité moyenne — Architecture & Code — Complété

- [x] **Duplication du calcul de stats serveur/client** — Extrait dans `shared/stats.js`, module partagé importé par le client (`src/forge.js`, `src/config.js`) et le serveur (`server/socket/pvp.js`)
- [x] **Découpage de `ui.js`** — Découpé en `src/ui/helpers.js`, `src/ui/forge-ui.js`, `src/ui/combat-ui.js`, `src/ui/profile-ui.js`. `src/ui.js` est un barrel re-export
- [x] **EventEmitter robuste** — try-catch ajouté dans `emit()` pour isoler les erreurs des listeners (`src/events.js`)
- [x] **ESLint + Prettier** — Configuration ajoutée (`eslint.config.js`, `.prettierrc`), scripts `lint`, `lint:fix`, `format`, `format:check` dans `package.json`

## 🟡 Priorité moyenne — Accessibilité & UX — Complété

- [x] **Accessibilité (a11y)** — Ajout de `role="dialog"` + `aria-modal` sur les modales, `aria-label` sur les slots/boutons, `role="tablist"`/`role="tab"` sur la navigation, `.sr-only` labels, `:focus-visible` style, fermeture par Escape, navigation clavier sur les equipment slots

## 🟡 Priorité moyenne — Gameplay — Complété

- [x] **Progression & endgame** — Système XP/niveaux joueur (max 100) avec XP gagné par monstre vaincu, affichage dans le header, persistance locale et serveur
- [x] **Boutique réaliste** — Remplacé les faux achats IAP par un système de récompenses quotidiennes (daily reward avec streak) et de milestones liés à la progression donjon
- [x] **Matchmaking PvP amélioré** — Matching basé sur le rating Elo avec plage de recherche qui s'élargit progressivement (100 Elo de base + 50 par tranche de 5 secondes)
- [x] **Vitesse d'attaque des monstres** — Chaque monstre attaque maintenant indépendamment avec sa propre vitesse via des timers individuels (`lastMonsterAttacks[]`)

## 🔴 Priorité haute — Bugs & Sécurité

- [x] **Race condition sur la sauvegarde** — `saveGame()` dans `state.js` utilise un debounce simple. Remplacé par un système dirty flag + in-flight protection pour ne jamais perdre de sauvegardes intermédiaires
- [x] **Accumulation de dégâts en combat** — `combat.js` remettait `lastPlayerAttack = 0` au lieu de soustraire `attackSpeed`. Corrigé avec `lastPlayerAttack -= attackSpeed` pour éviter les multi-hits sur les onglets en arrière-plan
- [x] **Body consommé sur retry API** — `api.js` sérialisait le body dans l'objet options du caller. Corrigé : le body est copié localement et l'objet caller n'est plus muté. `clearTokens()` ajouté sur auth perdu
- [x] **Refresh token non transactionnel** — `server/routes/auth.js` supprimait l'ancien token puis créait le nouveau sans transaction. Corrigé avec `prisma.$transaction()` pour atomicité
- [x] **Collision username guest** — `server/routes/auth.js` pouvait crash si toutes les tentatives échouaient. Corrigé : utilisation directe de `prisma.user.create` avec catch P2002 + retour 503 explicite
- [x] **Race condition username Discord/Google** — Le pattern check-then-create pouvait rater en concurrent. Corrigé : try/create avec catch P2002 et retry avec suffix aléatoire (Discord et Google)
- [x] **Validation gold négative manquante** — `server/routes/game.js` acceptait n'importe quel nombre. Corrigé : validation explicite `gold >= 0`, `forgeLevel` borné 1-30, `essence >= 0` avec erreurs 400
- [x] **Socket sans refresh token** — `socket-client.js` ne gérait pas l'expiration du token. Corrigé : mise à jour de `socket.auth` sur `connect_error` et reconnexion automatique sur `io server disconnect`
- [x] **Null check manquant PvP stats** — `server/socket/pvp.js:27` vérifie déjà null et émet `pvp:error` (déjà corrigé)
- [x] **Stalemate infini en PvP** — Ajout d'une limite de 50 tours (`MAX_TURNS`). Au-delà, victoire au joueur avec le meilleur % de HP, ou match nul

## 🟡 Priorité moyenne — Architecture & Performance

- [x] **Cache des éléments DOM** — `showDecisionModal()` et `updateStats()` requêtent les mêmes éléments à chaque appel. Cachés dans `domCache` avec lazy init dans `forge-ui.js`
- [x] **Re-render ciblé** — `updateEquipmentSlots()` met à jour les 8 slots même si un seul a changé. Extrait `renderSingleSlot(type)` pour cibler un slot unique
- [x] **Error boundaries** — Try-catch ajouté sur les handlers de click forge/equipment dans `main.js`. Ferme automatiquement les modals bloquées en cas d'erreur
- [x] **Matchmaking O(n²)** — Queue triée par power, recherche limitée aux 10 voisins les plus proches + early exit quand l'écart dépasse le range max
- [x] **Fuite mémoire monstres morts** — Ajout d'un compteur `aliveMonstersCount` décrémenté à la mort, utilisé pour skip l'itération quand tous sont morts
- [x] **DOM non-limité dans le combat log PvP** — Limite de 20 entrées dans le combat log PvP avec suppression FIFO
- [x] **Leaderboard non-caché** — Cache avec TTL de 60s, invalidé à la fin de chaque match PvP
- [x] **Constantes dupliquées client/serveur** — Centralisées dans `shared/pvp-config.js`, importées par client et serveur
- [x] **Timeouts sur les fetch** — `AbortController` avec timeout 10s sur `apiFetch()` et `refreshAccessToken()` via helper `withTimeout()`
- [x] **Milestones côté serveur** — Shop state (milestones + daily) centralisé dans `state.js`, embarqué dans le JSON `player` pour persistance serveur sans migration de schéma. `shop.js` utilise `getShopState()`/`setShopState()` au lieu de localStorage

## 🟡 Priorité moyenne — Qualité du code

- [ ] **JSDoc / TypeScript** — Ajouter JSDoc sur les fonctions publiques ou migrer vers TypeScript pour un meilleur outillage
- [ ] **Validation des probabilités de forge** — `config.js` définit les chances par tier pour chaque forge level mais rien ne vérifie que la somme fait 100%. Ajouter un test ou une assertion au démarrage
- [ ] **Duplication des slot masteries** — `tech-config.js:109-217` définit 8 techs de maîtrise de slot avec une structure identique. Utiliser une fonction génératrice pour réduire la duplication
- [ ] **Tests d'intégration serveur** — Le serveur n'a aucun test. Ajouter des tests pour les routes auth (register, login, refresh), game state (save/load) et les sockets (chat, PvP)
- [ ] **Gestion XP overflow** — `state.js:174` remet l'XP à 0 au level up mais l'excédent est perdu. Si le joueur gagne 200 XP alors qu'il ne lui en manque que 50, les 150 restants disparaissent
- [ ] **Validation profonde du game state serveur** — `server/routes/game.js` vérifie la structure mais pas les plages de valeurs (gold négatif, level > 100, wave > 10). Ajouter des bornes numériques
- [ ] **Index manquants en base** — `User.createdAt` et `ChatMessage.senderId` ne sont pas indexés mais utilisés dans des requêtes fréquentes. Ajouter des `@@index` dans le schema Prisma

## 🟡 Priorité moyenne — UX & Gameplay

- [ ] **Confirmation sur actions coûteuses** — Pas de dialogue de confirmation avant de dépenser de grosses sommes d'essence ou d'or (changement de pseudo, speed-up de recherche). Ajouter une modale de confirmation
- [ ] **Messages d'erreur explicites** — Quand une action échoue (queue pleine, essence insuffisante, tech non débloquée), aucun feedback utilisateur. Ajouter des notifications toast
- [ ] **Indicateur de connexion serveur** — Aucun indicateur visuel quand le WebSocket se déconnecte ou que la sauvegarde serveur échoue. Ajouter un badge de statut dans le header
- [ ] **Comparaison d'items améliorée** — La comparaison actuelle ne montre que les stats brutes. Ajouter un résumé du changement de power score total si on équipe l'item
- [ ] **Historique de combat PvP** — Aucun historique des matchs passés (adversaire, résultat, changement Elo). Ajouter un onglet historique dans la section PvP
- [ ] **Tutoriel / Onboarding** — Aucune aide pour les nouveaux joueurs. Ajouter un tutoriel interactif qui guide les premières forges et le premier combat

## 🟢 Priorité basse — Fonctionnalités futures

- [ ] **Compétences actives et passives** — Arbre de compétences débloquable avec des points gagnés par la progression
- [ ] **Familiers / Compagnons** — Créatures qui apportent des bonus passifs ou aident en combat
- [ ] **Enchantements d'items** — Système permettant d'ajouter des bonus spéciaux aux items existants (feu, glace, vampirisme) via des matériaux obtenus en donjon
- [ ] **Système de guildes** — Canaux de chat par guilde, boss de guilde, classement de guilde
- [ ] **Mode Endless / Classement donjon** — Mode donjon infini avec scaling progressif et classement global des vagues atteintes
- [ ] **Succès / Achievements** — Système de badges pour des objectifs spécifiques (première Mythic, 100 PvP wins, donjon wave 10 sans équipement, etc.)
- [ ] **Système de feedback joueur** — Permettre aux joueurs d'envoyer des retours, suggestions et rapports de bugs directement depuis le jeu (formulaire intégré avec catégories : bug, suggestion, autre)
- [ ] **Échange d'items entre joueurs** — Marketplace ou trade direct entre joueurs connectés, avec commission d'or
- [ ] **Système de saisons PvP** — Reset Elo périodique avec récompenses de fin de saison basées sur le rank atteint
- [ ] **Thèmes visuels** — Mode sombre/clair, thèmes de couleur personnalisables, animations de craft améliorées
- [ ] **Sons et musique** — Effets sonores pour le craft, le combat et les notifications, musique d'ambiance par zone de donjon
