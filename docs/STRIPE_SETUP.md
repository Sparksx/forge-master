# Stripe Payment Integration — Guide de configuration

## Vue d'ensemble

Le système de paiement utilise **Stripe Checkout** (page de paiement hébergée par Stripe).
Flux : Joueur clique "Buy" → redirigé vers Stripe → paye → webhook crédite les diamants.

---

## 1. Créer un compte Stripe

1. Va sur **https://dashboard.stripe.com/register**
2. Crée ton compte, confirme ton email
3. Tu arrives sur le dashboard en **mode Test** (bandeau jaune "TEST MODE")

---

## 2. Récupérer les clés API

1. **Developers → API keys** (https://dashboard.stripe.com/test/apikeys)
2. Copie la **Secret key** (commence par `sk_test_`)
3. Ajoute-la dans tes variables d'environnement (Railway, .env, etc.) :
   ```
   STRIPE_SECRET_KEY=<ta-secret-key-ici>
   ```

> La Publishable key (commence par `pk_test_`) n'est pas nécessaire — on utilise Stripe Checkout hébergé.

---

## 3. Configurer le Webhook

Le webhook est **indispensable** : c'est lui qui confirme le paiement et crédite les diamants.

1. **Developers → Webhooks** (https://dashboard.stripe.com/test/webhooks)
2. Clique **"Add endpoint"**
3. Configure :
   - **Endpoint URL** : `https://<ton-domaine>/api/payment/webhook`
   - **Events** : sélectionne ces 2 événements :
     - `checkout.session.completed` (paiement réussi)
     - `charge.refunded` (remboursement → retire les diamants)
4. Clique **"Add endpoint"**
5. Sur la page du webhook, clique **"Reveal"** sous **Signing secret**
6. Copie le secret (commence par `whsec_`)
7. Ajoute-le dans tes variables d'environnement :
   ```
   STRIPE_WEBHOOK_SECRET=<ton-webhook-secret-ici>
   ```

---

## 4. Récapitulatif des variables d'environnement

| Variable | Description | Exemple |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Clé secrète API | Commence par `sk_test_` ou `sk_live_` |
| `STRIPE_WEBHOOK_SECRET` | Secret de signature webhook | Commence par `whsec_` |

---

## 5. Tester en mode Test

Stripe fournit des cartes de test :

| Carte | Comportement |
|-------|-------------|
| `4242 4242 4242 4242` | Paiement réussi |
| `4000 0000 0000 0002` | Paiement refusé |
| `4000 0000 0000 3220` | Demande 3D Secure |

Pour toutes les cartes : date = n'importe quelle date future, CVC = 3 chiffres quelconques.

### Test local avec Stripe CLI

Pour tester le webhook en local (sans déployer) :

```bash
# Installer Stripe CLI : https://stripe.com/docs/stripe-cli
stripe login
stripe listen --forward-to localhost:3000/api/payment/webhook
```

La CLI affiche un `whsec_...` temporaire à utiliser comme `STRIPE_WEBHOOK_SECRET` en local.

---

## 6. Passer en production

### Checklist

- [ ] Activer le compte Stripe : **Settings → Account details** → remplir les infos business
- [ ] Ajouter un compte bancaire pour recevoir les versements
- [ ] Remplacer les clés test par les clés live :
  - Remplacer la clé test par la clé live
- [ ] Créer un **nouveau webhook en mode live** (même URL, mêmes events)
- [ ] Mettre à jour `STRIPE_WEBHOOK_SECRET` avec le nouveau secret live
- [ ] Vérifier que `CORS_ORIGIN` pointe vers ton domaine de production
- [ ] Tester un vrai paiement avec une carte réelle (petite somme)
- [ ] Vérifier dans le Stripe Dashboard que le paiement apparaît
- [ ] Vérifier que les diamants sont crédités en jeu

### Changements de clés

| Environnement | Secret Key | Webhook Secret |
|--------------|-----------|----------------|
| Test | Commence par `sk_test_` | Commence par `whsec_` (du webhook test) |
| Production | Commence par `sk_live_` | Commence par `whsec_` (du webhook live) |

> **Important** : les webhooks test et live sont **séparés**. Il faut créer un endpoint dans chaque mode.

---

## Architecture technique

```
Joueur clique "Buy"
    ↓
POST /api/payment/create-checkout-session
    ↓ (crée une session Stripe + enregistre Purchase en DB avec status "pending")
Redirect vers Stripe Checkout (page hébergée)
    ↓
Joueur paye
    ↓
Stripe envoie POST /api/payment/webhook (event: checkout.session.completed)
    ↓ (vérifie signature, marque Purchase "completed", crédite diamonds via transaction)
Joueur redirigé vers le jeu (?payment=success)
    ↓ (recharge le game state depuis le serveur pour récupérer les nouveaux diamants)
```

### Fichiers impliqués

| Fichier | Rôle |
|---------|------|
| `server/routes/payment.js` | Routes API (checkout, webhook, historique) |
| `server/config.js` | Clés Stripe + définition des packs |
| `prisma/schema.prisma` | Table `Purchase` |
| `src/shop.js` | UI d'achat + gestion du retour Stripe |
| `src/config.js` | Packs diamants côté client (affichage) |

### Packs disponibles

| ID | Diamants | Bonus | Prix |
|----|----------|-------|------|
| `welcome` | 100 | — | $2.99 (one-time) |
| `starter` | 50 | — | $4.99 |
| `popular` | 100 | +20 | $9.99 |
| `value` | 200 | +60 | $19.99 |
| `premium` | 500 | +200 | $49.99 |
| `ultimate` | 1000 | +500 | $99.99 |

Les packs sont définis dans `server/config.js` (source de vérité) et dupliqués dans `src/config.js` (affichage).
