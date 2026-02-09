# Forge Master ⚒️

> ⚠️ **Work In Progress** — Ce projet est en cours de développement. Des fonctionnalités peuvent être incomplètes ou changer à tout moment.

**Forge Master** est un jeu web full-stack de craft d'équipement et de progression : forgez des objets aléatoires, équipez-les, combattez dans des donjons, affrontez d'autres joueurs en PvP et discutez en temps réel.

🎮 **[Jouer maintenant sur GitHub Pages](https://sparksx.github.io/forge-master/)**

## Concept

Forgez des équipements aléatoires (armes, armures, accessoires), équipez les meilleurs, vendez les autres et améliorez votre score de puissance. Progressez à travers 100 stages de donjon et affrontez d'autres joueurs en PvP temps réel.

## Fonctionnalités

### Système de forge
- Forge d'équipements aléatoires avec niveaux (1-100)
- 8 emplacements d'équipement : Chapeau, Armure, Ceinture, Bottes, Gants, Collier, Anneau, Arme
- **6 niveaux de rareté** : Common, Uncommon, Rare, Epic, Legendary, Mythic — chacun avec un code couleur
- Bonus de stats aléatoires (0 à 3 selon la rareté) : Vitesse d'attaque, Chance de critique, Multiplicateur de critique, Multi santé, Multi dégâts, Régénération, Vol de vie
- Comparaison visuelle des stats entre l'ancien et le nouvel objet (surbrillance verte/rouge)
- **Auto-forge** : forge automatique avec filtres par rareté, auto-vente des objets non désirés

### Niveau de forge
- 30 niveaux de forge débloquables avec de l'or
- Chaque niveau améliore les chances d'obtenir des raretés supérieures
- Système de timer avec possibilité d'accélérer contre de l'or
- Comparaison côte à côte des probabilités actuelles vs suivantes

### Système de combat (Donjon)
- 10 vagues × 10 sous-vagues = 100 stages de progression
- Moteur de combat tick-based (100ms) avec barres de vie en temps réel
- Multi-monstres par sous-vague (1 à 3 selon la difficulté)
- Système de ciblage : focus sur un monstre avec changement automatique
- 10 thèmes de monstres (Rat, Loup, Araignée, Ogre, Squelette, Zombie, Spectre, Drake, Démon, Infernal)
- Nombres de dégâts flottants avec effets de critique
- Régénération de vie et vol de vie actifs en combat
- Défaite = recul d'une sous-vague, victoire = progression automatique

### PvP temps réel
- File d'attente de matchmaking via Socket.io
- Combat par tours avec timer (15s par tour)
- 3 actions : Attaque, Défense, Spécial (haut risque/récompense)
- Système de classement Elo (K=32)
- Suivi victoires/défaites par joueur
- Anti-triche : calcul des stats côté serveur à partir de l'équipement

### Chat en temps réel
- Canal de discussion global
- Historique des 50 derniers messages
- Aperçu des messages en bas de l'écran avec indicateur de non-lu
- Overlay plein écran pour le chat complet

### Authentification
- Inscription (username, email, mot de passe hashé bcrypt)
- Connexion par username ou email
- JWT : access token (15min) + refresh token (7j) avec rotation
- Restauration automatique de session
- Sauvegarde du jeu côté serveur (avec fallback localStorage)
- Jeu possible sans compte (sauvegarde locale uniquement)

### Progression
- Score de puissance calculé à partir de la santé effective, des dégâts effectifs et de tous les bonus
- Système d'or : vente d'objets, boutique (4 paliers)
- Sauvegarde automatique vers localStorage + serveur (debounced)

### Interface
- Navigation par onglets : PvP, Donjon, Accueil, Améliorations, Boutique
- Modales de détail d'objet avec comparaison colorée
- Design responsive optimisé mobile
- Notifications toast (forge, vente)
- Modal de profil avec stats détaillées et bonus

### Qualité
- Suite de tests unitaires (45+ tests avec Vitest)
- CI/CD avec GitHub Actions (tests + build sur PR, déploiement auto sur push)
- Déploiement automatique du frontend sur GitHub Pages
- Backend déployable sur Railway

## Stack technique

### Frontend
- JavaScript (ES6 modules)
- Vite 6
- CSS vanilla
- Socket.io Client

### Backend
- Node.js + Express 5
- Prisma ORM (PostgreSQL)
- Socket.io
- bcrypt (hash mots de passe)
- jsonwebtoken (JWT)
- express-validator

### Tests & CI/CD
- Vitest
- GitHub Actions (CI + déploiement GitHub Pages)
- Railway (backend)

## Architecture

```
forge-master/
├── src/                    # Frontend
│   ├── main.js             # Point d'entrée, wiring des événements
│   ├── config.js           # Constantes du jeu (équipements, tiers, niveaux de forge)
│   ├── state.js            # Gestion de l'état du jeu (équipement, or, progression)
│   ├── forge.js            # Création d'items, calcul de stats, roll de rareté
│   ├── combat.js           # Moteur de combat tick-based multi-monstres
│   ├── monsters.js         # Définitions et scaling des monstres
│   ├── ui.js               # Manipulation du DOM et rendu
│   ├── navigation.js       # Navigation par onglets
│   ├── shop.js             # Boutique d'or
│   ├── pvp.js              # Interface PvP (matchmaking, combat, résultats)
│   ├── chat.js             # Interface chat temps réel
│   ├── auth.js             # Écran login/register
│   ├── api.js              # Client API avec gestion JWT et auto-refresh
│   ├── socket-client.js    # Connexion WebSocket
│   ├── events.js           # EventEmitter custom et registre d'événements
│   └── __tests__/          # Tests unitaires
├── server/                 # Backend
│   ├── index.js            # Serveur Express + Socket.io
│   ├── config.js           # Variables d'environnement
│   ├── routes/
│   │   ├── auth.js         # Endpoints d'authentification (register, login, refresh, logout)
│   │   └── game.js         # Endpoints de sauvegarde/chargement de l'état du jeu
│   ├── middleware/
│   │   └── auth.js         # Middleware de vérification JWT
│   └── socket/
│       ├── index.js        # Configuration Socket.io
│       ├── chat.js         # Handlers du chat temps réel
│       └── pvp.js          # Matchmaking et combat PvP
├── prisma/
│   └── schema.prisma       # Modèles de données (User, GameState, ChatMessage, RefreshToken)
└── .github/workflows/      # CI/CD
    ├── ci.yml              # Tests automatiques sur PR
    └── deploy.yml          # Déploiement GitHub Pages
```

## Scripts

```bash
npm run dev          # Serveur de dev Vite (frontend)
npm run dev:server   # Serveur Node.js (backend)
npm run build        # Build de production
npm start            # Déploiement : setup DB + serveur
npm test             # Lancer les tests Vitest
npm run test:watch   # Tests en mode watch
npm run db:generate  # Générer le client Prisma
npm run db:migrate   # Migration Prisma
npm run db:push      # Push du schema vers la DB
```

## Variables d'environnement

Voir `.env.example` pour la configuration requise (DATABASE_URL, JWT secrets, port, etc.).

## Fonctionnalités à venir

- Progression & endgame (niveaux joueur, XP, achievements)
- Améliorations (Compétences, Familiers, Technologies)
- Accessibilité (a11y)
- ESLint + Prettier
