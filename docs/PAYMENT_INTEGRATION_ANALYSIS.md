# Analyse d'intégration de paiement — Forge Master

## Contexte du projet

Forge Master est un RPG browser-based avec un système de monnaie virtuelle à trois niveaux :
- **Gold** : monnaie in-game (obtenue en jouant)
- **Essence** : monnaie de progression (arbre technologique)
- **Diamonds** : monnaie premium (actuellement 100 offerts au départ, aucun moyen d'en acheter)

Le Diamond Shop existe déjà (`src/shop.js`) et permet de convertir des diamants en gold ou essence. Il manque uniquement la brique **achat de diamants avec de l'argent réel**.

**Stack technique** : Vite + Vanilla JS (frontend) / Node.js + Express + Prisma + PostgreSQL (backend) / Hébergé sur Railway + GitHub Pages.

---

## 1. Comparatif des solutions de paiement

### 1.1 Stripe

| Critère | Détail |
|---------|--------|
| **Frais** | 2.9% + 0.30 $ par transaction (cartes en ligne) |
| **Frais internationaux** | +1% cartes internationales, +1% conversion devise |
| **Frais fixes** | Aucun abonnement mensuel |
| **Chargebacks** | 15 $ par litige |
| **Méthodes supportées** | CB, Apple Pay, Google Pay, Link, SEPA, iDEAL, 40+ méthodes |
| **Checkout hébergé** | Oui (Stripe Checkout — page hébergée par Stripe) |
| **Webhooks** | Robustes, bien documentés |
| **SDK/API** | Excellent, librairies Node.js officielles |
| **Conformité** | PCI DSS Level 1 géré par Stripe |
| **Documentation** | Excellente, exemples gaming disponibles |
| **Délai de versement** | 2-7 jours |

**Avantages :**
- API la plus mature et la mieux documentée du marché
- Stripe Checkout élimine le besoin de construire une UI de paiement
- Support natif des webhooks pour confirmer les paiements côté serveur
- Intégration Express Checkout Element (Apple Pay, Google Pay en 1 clic)
- Adaptive Pricing pour localiser les prix dans 150+ pays
- Frais fixes les plus bas du marché (0.30 $ vs 0.49-0.50 $ chez les concurrents)
- Pas de frais mensuels — on ne paie que quand on traite des transactions
- Écosystème complet : Radar (anti-fraude), Billing, Tax

**Inconvénients :**
- Le frais fixe de 0.30 $ est significatif sur les micro-transactions (30% sur un achat à 1 $)
- Pas de gestion automatique de la TVA (il faut Stripe Tax en supplément ou le gérer soi-même)
- N'est pas "Merchant of Record" — la responsabilité fiscale reste sur le développeur
- Nécessite un serveur backend pour créer les sessions et traiter les webhooks

---

### 1.2 PayPal Checkout

| Critère | Détail |
|---------|--------|
| **Frais** | 3.49% + 0.49 $ par transaction |
| **Frais internationaux** | +1.5% international + 4% conversion devise |
| **Chargebacks** | 15-30 $ par litige |
| **Méthodes supportées** | PayPal, CB, Pay Later |
| **Checkout hébergé** | Oui (boutons PayPal intégrables) |
| **Délai de versement** | Immédiat sur compte PayPal |

**Avantages :**
- Marque très reconnue — les joueurs font confiance à PayPal
- Disponibilité PayPal immédiate sur le compte du joueur
- Large base d'utilisateurs existante (400M+ comptes)
- Intégration des boutons relativement simple

**Inconvénients :**
- **Frais les plus élevés du comparatif** : 3.49% + 0.49 $ (63% de plus que Stripe en frais fixes)
- Frais internationaux prohibitifs (~5.5% total)
- Expérience checkout moins fluide (redirection vers PayPal)
- API moins moderne que Stripe
- Gestion des litiges laborieuse
- Pas adapté aux micro-transactions (0.49 $ de frais fixe = 49% sur un achat à 1 $)

---

### 1.3 Paddle (Merchant of Record)

| Critère | Détail |
|---------|--------|
| **Frais** | 5% + 0.50 $ par transaction |
| **Frais internationaux** | Inclus dans les 5% |
| **TVA/Taxes** | Gérée automatiquement (Paddle est le vendeur légal) |
| **Chargebacks** | Gérés par Paddle |
| **Méthodes supportées** | CB, PayPal, Apple Pay, wire transfers |
| **Checkout hébergé** | Oui (overlay Paddle.js) |

**Avantages :**
- **Merchant of Record** : Paddle gère la TVA, les taxes, la conformité fiscale dans 200+ pays
- Aucune responsabilité légale de vente pour le développeur
- Chargebacks gérés par Paddle
- Frais internationaux inclus — pas de surprise
- Un seul contrat, un seul point de contact

**Inconvénients :**
- **Frais élevés** : 5% + 0.50 $ (presque le double de Stripe)
- Sur un achat de 5 $ : 0.75 $ de frais (15%)
- Principalement orienté SaaS — support gaming limité
- Moins de flexibilité sur le checkout
- Politique potentiellement restrictive sur les "virtual goods" gaming
- Checkout overlay peut sembler intrusif

---

### 1.4 Lemon Squeezy (Merchant of Record)

| Critère | Détail |
|---------|--------|
| **Frais** | 5% + 0.50 $ par transaction (annoncé), potentiellement 5.9% + 0.95 $ en 2026 |
| **TVA/Taxes** | Gérée automatiquement |
| **Chargebacks** | Gérés par Lemon Squeezy |
| **Méthodes supportées** | CB, PayPal |

**Avantages :**
- Merchant of Record (gestion fiscale automatique)
- Interface simple et moderne
- Bon pour les créateurs indépendants
- Outils marketing intégrés (emails, affiliés)

**Inconvénients :**
- **Frais très élevés**, potentiellement jusqu'à 5.9% + 0.95 $ en 2026
- Frais cachés pour les paiements internationaux (jusqu'à 10% total signalé par des utilisateurs)
- Moins adapté au gaming — orienté produits digitaux (ebooks, SaaS)
- Moins de méthodes de paiement
- Écosystème moins riche que Stripe ou Paddle
- Risque de restriction sur la vente de monnaie virtuelle

---

### 1.5 Xsolla (Spécialisé Gaming)

| Critère | Détail |
|---------|--------|
| **Frais** | Revenue share (non publié — contacter les ventes), historiquement ~5% |
| **Frais internationaux** | Inclus |
| **TVA/Taxes** | Gérée automatiquement |
| **Chargebacks** | 7-15 $ |
| **Méthodes supportées** | 700+ méthodes de paiement, 130+ devises |
| **Spécialisation** | 100% gaming |

**Avantages :**
- **Conçu spécifiquement pour le gaming** — support natif des monnaies virtuelles
- 700+ méthodes de paiement dans le monde
- Outils intégrés : virtual currency management, in-game store builder, anti-fraude gaming
- Gestion automatique des taxes mondiales
- Réduction jusqu'à 30% pour les studios indie
- UI de checkout optimisée pour le gaming

**Inconvénients :**
- **Tarification opaque** — pas de prix public, nécessite un contact commercial
- Surqualifié pour un projet indie/petit — pensé pour des studios moyens à gros
- Temps d'intégration plus long (API plus complexe)
- Settlement times variables selon le contrat
- Overhead administratif (contrat, onboarding)
- Peut refuser les petits projets

---

## 2. Tableau comparatif synthétique

| Critère | Stripe | PayPal | Paddle | Lemon Squeezy | Xsolla |
|---------|--------|--------|--------|----------------|--------|
| **Frais sur 5 $** | 0.45 $ (9%) | 0.66 $ (13.2%) | 0.75 $ (15%) | 0.75-1.25 $ (15-25%) | ~0.50 $ (≈10%) |
| **Frais sur 10 $** | 0.59 $ (5.9%) | 0.84 $ (8.4%) | 1.00 $ (10%) | 1.00-1.54 $ (10-15%) | ~0.50 $ (≈5%) |
| **Frais sur 20 $** | 0.88 $ (4.4%) | 1.19 $ (5.95%) | 1.50 $ (7.5%) | 1.50-2.13 $ (7.5-10%) | ~1.00 $ (≈5%) |
| **Frais sur 50 $** | 1.75 $ (3.5%) | 2.24 $ (4.5%) | 3.00 $ (6%) | 3.00-3.90 $ (6-8%) | ~2.50 $ (≈5%) |
| **Gestion TVA** | Manuel/Stripe Tax | Manuel | Automatique | Automatique | Automatique |
| **Setup** | Aucun | Aucun | Aucun | Aucun | Contrat |
| **Adapté gaming** | Oui (générique) | Moyen | Non (SaaS) | Non (digital) | Excellent |
| **Complexité intégration** | Moyenne | Moyenne | Simple | Simple | Élevée |
| **Documentation** | Excellente | Bonne | Bonne | Correcte | Bonne |

---

## 3. Recommandation : Stripe Checkout

### Pourquoi Stripe est la meilleure option pour Forge Master

1. **Frais les plus bas** : à 2.9% + 0.30 $, Stripe offre le meilleur rapport sur toutes les tranches de prix. Sur des packs de 5-50 $, l'économie vs les concurrents est significative.

2. **Parfaitement adapté au stack** : Node.js + Express backend avec `stripe` npm package. L'intégration est directe et bien documentée.

3. **Stripe Checkout hébergé** : pas besoin de construire un formulaire de paiement. Stripe fournit une page de checkout sécurisée, conforme PCI, avec Apple Pay/Google Pay intégrés.

4. **Webhooks fiables** : le pattern "créer une session → recevoir un webhook de confirmation → créditer les diamants" s'intègre naturellement dans l'architecture Express existante.

5. **Scalable** : si Forge Master grandit, Stripe offre des remises volume (à partir de 100k$/mois) et des features avancées (Billing, Tax, Radar).

6. **Pas de lock-in contractuel** : pas d'abonnement, pas de contrat. Adapté à un projet indie qui démarre sa monétisation.

7. **Pour la TVA** : en phase initiale, utiliser les fonctionnalités de Stripe Tax (0.5% additionnel) est optionnel. On peut commencer sans et l'ajouter quand le volume justifie la conformité fiscale internationale.

---

## 4. Grille de prix des diamants

### Principes de pricing

- **Prix minimum de 4.99 $** pour minimiser l'impact du frais fixe Stripe (0.30 $)
- **Bonus croissant** pour inciter les achats plus importants (volume discount)
- **Pas de pack à 0.99-1.99 $** — les frais de transaction rendraient ces packs non viables
- **Alignement avec le Diamond Shop existant** : les packs doivent avoir du sens par rapport aux offres gold/essence (10-100 diamants)

### Packs proposés

| Pack | Prix | Diamants | Bonus | Diamants totaux | $/diamant | Marge après Stripe |
|------|------|----------|-------|-----------------|-----------|-------------------|
| **Starter** | 4.99 $ | 50 | — | 50 | 0.100 $ | 4.55 $ (91.1%) |
| **Popular** | 9.99 $ | 120 | +20 (17%) | 120 | 0.083 $ | 9.40 $ (94.1%) |
| **Value** | 19.99 $ | 260 | +60 (30%) | 260 | 0.077 $ | 19.11 $ (95.6%) |
| **Premium** | 49.99 $ | 700 | +200 (40%) | 700 | 0.071 $ | 48.24 $ (96.5%) |
| **Ultimate** | 99.99 $ | 1500 | +500 (50%) | 1500 | 0.067 $ | 96.69 $ (96.7%) |

### Cohérence avec l'économie existante

| Achat Diamond Shop | Coût en diamants | Équivalent $ (via pack Starter) | Équivalent $ (via pack Ultimate) |
|--------------------|------------------|---------------------------------|----------------------------------|
| 5 000 Gold | 10 💎 | 1.00 $ | 0.67 $ |
| 30 000 Gold | 50 💎 | 5.00 $ | 3.33 $ |
| 75 000 Gold | 100 💎 | 10.00 $ | 6.67 $ |
| 100 Essence | 10 💎 | 1.00 $ | 0.67 $ |
| 600 Essence | 50 💎 | 5.00 $ | 3.33 $ |
| 1 500 Essence | 100 💎 | 10.00 $ | 6.67 $ |
| Speed-up 1h | 60 💎 | 6.00 $ | 4.00 $ |

### Première offre spéciale (one-time)

| Pack | Prix | Diamants | Remarque |
|------|------|----------|----------|
| **Welcome Pack** | 2.99 $ | 100 | Achat unique pour nouveaux joueurs — prix cassé pour convertir |

> Ce pack "Welcome" est limité à 1 achat par compte et sert de porte d'entrée à la monétisation. À 2.99 $, même avec les frais Stripe (0.39 $), la marge reste à 2.60 $ et le joueur reçoit un excellent rapport qualité-prix qui l'habitude à acheter.

---

## 5. Plan d'intégration technique

### Phase 1 — Backend : Routes de paiement

**Fichiers à créer/modifier :**

#### `server/routes/payment.js` (nouveau)
```
POST /api/payment/create-checkout-session
  - Authentification JWT requise (middleware existant)
  - Paramètre : { packId: string }
  - Valide le pack dans la config
  - Crée une Stripe Checkout Session avec :
    - line_items (prix du pack)
    - metadata (userId, packId)
    - success_url / cancel_url
  - Retourne { sessionUrl }

POST /api/payment/webhook
  - Pas d'authentification JWT (vient de Stripe)
  - Vérification signature Stripe (stripe.webhooks.constructEvent)
  - Écoute l'événement checkout.session.completed
  - Crédite les diamants au joueur via Prisma
  - Enregistre la transaction dans une nouvelle table
```

#### Modèle Prisma (nouveau)
```prisma
model Purchase {
  id                String   @id @default(uuid())
  userId            String
  user              User     @relation(fields: [userId], references: [id])
  stripeSessionId   String   @unique
  stripePaymentId   String?
  packId            String
  diamondsGranted   Int
  amountCents       Int
  currency          String   @default("usd")
  status            String   @default("pending") // pending, completed, refunded
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}
```

#### `server/config.js` (modifier)
```
Ajouter :
- STRIPE_SECRET_KEY (env var)
- STRIPE_WEBHOOK_SECRET (env var)
- DIAMOND_PACKS (configuration des packs et prix)
```

### Phase 2 — Frontend : Boutique de diamants

**Fichiers à modifier :**

#### `src/shop.js` (modifier)
```
- Ajouter une section "Buy Diamonds" au-dessus du Diamond Shop existant
- Afficher les packs avec prix, diamants, bonus
- Au clic sur "Buy" : appel API → redirection vers Stripe Checkout
- Au retour (success_url) : recharger le state depuis le serveur
```

#### `src/config.js` (modifier)
```
- Ajouter DIAMOND_PACKS en tant que constante client
  (id, label, price, diamonds, bonus)
```

### Phase 3 — Sécurisation

1. **Idempotence** : vérifier que `stripeSessionId` n'a pas déjà été traité avant de créditer
2. **Validation serveur** : ne jamais créditer des diamants côté client — uniquement via webhook
3. **Rate limiting** : limiter la création de sessions (ex: 5/minute par user)
4. **Audit log** : enregistrer chaque achat dans la table `AuditLog` existante
5. **Monitoring** : alertes sur les webhooks échoués

### Phase 4 — Configuration Stripe

1. Créer un compte Stripe (stripe.com)
2. Configurer les produits/prix dans le Stripe Dashboard
3. Ajouter les variables d'environnement sur Railway :
   - `STRIPE_SECRET_KEY`
   - `STRIPE_PUBLISHABLE_KEY`
   - `STRIPE_WEBHOOK_SECRET`
4. Configurer le webhook endpoint dans Stripe Dashboard → `https://<backend-url>/api/payment/webhook`
5. Activer les événements : `checkout.session.completed`, `charge.refunded`

### Phase 5 — Tests et déploiement

1. Tester en mode Stripe Test (cartes de test : 4242 4242 4242 4242)
2. Vérifier le flux complet : achat → webhook → diamants crédités
3. Tester les cas d'erreur : paiement annulé, webhook replay, double crédit
4. Ajouter des tests unitaires pour les routes de paiement
5. Déployer en production et passer en mode Stripe Live

---

## 6. Variables d'environnement à ajouter

```env
# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Frontend (Vite)
VITE_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

---

## 7. Dépendances npm à ajouter

```
npm install stripe          # Backend — SDK Stripe officiel
```

> Note : côté frontend, aucune dépendance supplémentaire n'est nécessaire. Stripe Checkout redirige vers une page hébergée par Stripe — pas besoin de Stripe.js côté client pour ce flow.

---

## 8. Estimation du coût par transaction

| Pack | Prix | Frais Stripe (2.9% + 0.30$) | Revenue net | Marge |
|------|------|------------------------------|-------------|-------|
| Welcome | 2.99 $ | 0.39 $ | 2.60 $ | 87.0% |
| Starter | 4.99 $ | 0.44 $ | 4.55 $ | 91.1% |
| Popular | 9.99 $ | 0.59 $ | 9.40 $ | 94.1% |
| Value | 19.99 $ | 0.88 $ | 19.11 $ | 95.6% |
| Premium | 49.99 $ | 1.75 $ | 48.24 $ | 96.5% |
| Ultimate | 99.99 $ | 3.20 $ | 96.79 $ | 96.8% |

---

## 9. Résumé

| Décision | Choix |
|----------|-------|
| **Solution de paiement** | Stripe Checkout |
| **Raison principale** | Frais les plus bas, meilleure API, adapté au stack Node.js/Express |
| **Prix minimum du pack** | 2.99 $ (Welcome, one-time) / 4.99 $ (Starter, récurrent) |
| **Nombre de packs** | 5 réguliers + 1 Welcome |
| **Bonus volume** | De 0% (Starter) à 50% (Ultimate) |
| **Méthode d'intégration** | Stripe Checkout Sessions (page hébergée) |
| **Sécurité** | Webhooks + idempotence + validation serveur uniquement |
| **Effort d'intégration** | 4 fichiers à créer/modifier, 1 migration Prisma |
