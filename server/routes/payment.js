import { Router } from 'express';
import Stripe from 'stripe';
import { requireAuth, logAudit } from '../middleware/auth.js';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, GOLD_PACKS, CORS_ORIGIN } from '../config.js';
import prisma from '../lib/prisma.js';

const router = Router();

// Initialize Stripe (lazy — only when keys are configured)
function getStripe() {
    if (!STRIPE_SECRET_KEY) {
        throw new Error('Stripe is not configured');
    }
    return new Stripe(STRIPE_SECRET_KEY);
}

/**
 * Credit a paid purchase exactly once. The pending→completed flip is an atomic
 * `updateMany` guarded on `status: 'pending'`, so the webhook and the on-return
 * /confirm call can both race here without ever double-crediting. Returns the
 * granted amount and the player's new gold balance.
 */
async function creditPurchase(purchase, paymentIntent) {
    const claim = await prisma.purchase.updateMany({
        where: { id: purchase.id, status: 'pending' },
        data: { status: 'completed', stripePaymentId: paymentIntent ?? purchase.stripePaymentId },
    });

    if (claim.count === 0) {
        // Already credited by the other path — report the current balance, grant nothing.
        const gs = await prisma.gameState.findUnique({
            where: { userId: purchase.userId },
            select: { gold: true },
        });
        return { status: 'completed', granted: 0, gold: gs?.gold ?? 0 };
    }

    const gs = await prisma.gameState.update({
        where: { userId: purchase.userId },
        data: { gold: { increment: purchase.goldGranted } },
        select: { gold: true },
    });

    await logAudit(purchase.userId, 'purchase_gold', purchase.userId, {
        packId: purchase.packId,
        gold: purchase.goldGranted,
        amountCents: purchase.amountCents,
        stripeSessionId: purchase.stripeSessionId,
    });

    console.log(`Purchase completed: user ${purchase.userId} received ${purchase.goldGranted} gold (${purchase.packId})`);
    return { status: 'completed', granted: purchase.goldGranted, gold: gs.gold };
}

// ─── GET /api/payment/packs ─────────────────────────────────────
// Public: return available gold packs (frontend needs this to render the shop)
router.get('/packs', (req, res) => {
    const packs = GOLD_PACKS.map(p => ({
        id: p.id,
        gold: p.gold,
        bonus: p.bonus,
        total: p.gold + p.bonus,
        priceCents: p.priceCents,
        label: p.label,
        tag: p.tag || null,
        oneTime: p.oneTime || false,
    }));
    res.json({ packs });
});

// ─── POST /api/payment/create-checkout-session ──────────────────
// Authenticated: create a Stripe Checkout Session for a gold pack
router.post('/create-checkout-session', requireAuth, async (req, res) => {
    const { packId } = req.body;

    if (!packId || typeof packId !== 'string') {
        return res.status(400).json({ error: 'packId is required' });
    }

    const pack = GOLD_PACKS.find(p => p.id === packId);
    if (!pack) {
        return res.status(400).json({ error: 'Invalid pack' });
    }

    // One-time packs: check if user already purchased
    if (pack.oneTime) {
        const existing = await prisma.purchase.findFirst({
            where: {
                userId: req.user.userId,
                packId: pack.id,
                status: 'completed',
            },
        });
        if (existing) {
            return res.status(400).json({ error: 'This pack can only be purchased once' });
        }
    }

    try {
        const stripe = getStripe();
        const totalGold = pack.gold + pack.bonus;

        // Build success/cancel URLs — only trust origins that match the configured CORS_ORIGIN
        // to prevent open-redirect attacks via forged Origin/Referer headers.
        const rawOrigin = req.headers.origin || req.headers.referer?.replace(/\/+$/, '');
        const allowedOrigins = CORS_ORIGIN === '*'
            ? ['http://localhost:5173', 'http://localhost:3000']
            : [CORS_ORIGIN];
        const baseUrl = (rawOrigin && allowedOrigins.includes(rawOrigin.replace(/\/+$/, '')))
            ? rawOrigin.replace(/\/+$/, '')
            : allowedOrigins[0];
        const successUrl = `${baseUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${baseUrl}?payment=cancelled`;

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `${totalGold.toLocaleString('en-US')} Gold — ${pack.label}`,
                        description: pack.bonus > 0
                            ? `${pack.gold.toLocaleString('en-US')} gold + ${pack.bonus.toLocaleString('en-US')} bonus gold`
                            : `${pack.gold.toLocaleString('en-US')} gold`,
                    },
                    unit_amount: pack.priceCents,
                },
                quantity: 1,
            }],
            metadata: {
                userId: String(req.user.userId),
                packId: pack.id,
                gold: String(totalGold),
            },
            success_url: successUrl,
            cancel_url: cancelUrl,
        });

        // Create a pending purchase record
        await prisma.purchase.create({
            data: {
                userId: req.user.userId,
                stripeSessionId: session.id,
                packId: pack.id,
                goldGranted: totalGold,
                amountCents: pack.priceCents,
                currency: 'usd',
                status: 'pending',
            },
        });

        res.json({ url: session.url });
    } catch (err) {
        console.error('Stripe checkout error:', err);
        if (err.message === 'Stripe is not configured') {
            return res.status(503).json({ error: 'Payment system is not configured' });
        }
        res.status(500).json({ error: 'Failed to create checkout session' });
    }
});

// ─── POST /api/payment/confirm ──────────────────────────────────
// Authenticated: called when the player returns from Stripe Checkout. Verifies
// payment directly with Stripe and credits the gold, so purchases land
// immediately even if the webhook is delayed or not configured. Idempotent.
router.post('/confirm', requireAuth, async (req, res) => {
    const { sessionId } = req.body;

    if (!sessionId || typeof sessionId !== 'string') {
        return res.status(400).json({ error: 'sessionId is required' });
    }

    try {
        const purchase = await prisma.purchase.findUnique({
            where: { stripeSessionId: sessionId },
        });

        if (!purchase || purchase.userId !== req.user.userId) {
            return res.status(404).json({ error: 'Purchase not found' });
        }

        if (purchase.status === 'completed') {
            const gs = await prisma.gameState.findUnique({
                where: { userId: req.user.userId },
                select: { gold: true },
            });
            return res.json({ status: 'completed', granted: 0, gold: gs?.gold ?? 0 });
        }
        if (purchase.status === 'refunded') {
            return res.json({ status: 'refunded', granted: 0 });
        }

        // Still pending — confirm the payment actually went through before crediting.
        const stripe = getStripe();
        const session = await stripe.checkout.sessions.retrieve(sessionId);
        if (session.payment_status !== 'paid') {
            return res.json({ status: 'pending', granted: 0 });
        }

        const result = await creditPurchase(purchase, session.payment_intent);
        res.json(result);
    } catch (err) {
        console.error('Confirm error:', err);
        if (err.message === 'Stripe is not configured') {
            return res.status(503).json({ error: 'Payment system is not configured' });
        }
        res.status(500).json({ error: 'Failed to confirm purchase' });
    }
});

// ─── POST /api/payment/webhook ──────────────────────────────────
// Stripe webhook — no JWT auth, verified by Stripe signature
router.post('/webhook', async (req, res) => {
    const sig = req.headers['stripe-signature'];

    if (!sig || !STRIPE_WEBHOOK_SECRET) {
        return res.status(400).json({ error: 'Missing signature or webhook secret' });
    }

    let event;
    try {
        const stripe = getStripe();
        event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: 'Invalid signature' });
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        try {
            const purchase = await prisma.purchase.findUnique({
                where: { stripeSessionId: session.id },
            });

            if (!purchase) {
                console.warn('Webhook: no purchase record for session', session.id);
                return res.json({ received: true });
            }

            // creditPurchase is idempotent — a no-op if /confirm already credited it.
            await creditPurchase(purchase, session.payment_intent);
        } catch (err) {
            console.error('Webhook processing error:', err);
            return res.status(500).json({ error: 'Processing failed' });
        }
    }

    if (event.type === 'charge.refunded') {
        const charge = event.data.object;
        try {
            // Find purchase by payment intent
            const purchase = await prisma.purchase.findFirst({
                where: { stripePaymentId: charge.payment_intent },
            });

            if (purchase && purchase.status === 'completed') {
                // Atomically claim the refund so it can't double-reverse.
                const claim = await prisma.purchase.updateMany({
                    where: { id: purchase.id, status: 'completed' },
                    data: { status: 'refunded' },
                });

                if (claim.count > 0) {
                    // Clawback the gold, clamped so the balance can't go negative.
                    const gs = await prisma.gameState.findUnique({
                        where: { userId: purchase.userId },
                        select: { gold: true },
                    });
                    const newGold = Math.max(0, (gs?.gold ?? 0) - purchase.goldGranted);
                    await prisma.gameState.update({
                        where: { userId: purchase.userId },
                        data: { gold: newGold },
                    });

                    await logAudit(purchase.userId, 'refund_gold', purchase.userId, {
                        packId: purchase.packId,
                        gold: purchase.goldGranted,
                        stripePaymentId: charge.payment_intent,
                    });

                    console.log(`Refund processed: user ${purchase.userId} lost ${purchase.goldGranted} gold`);
                }
            }
        } catch (err) {
            console.error('Refund webhook error:', err);
            return res.status(500).json({ error: 'Refund processing failed' });
        }
    }

    res.json({ received: true });
});

// ─── GET /api/payment/history ───────────────────────────────────
// Authenticated: return user's purchase history
router.get('/history', requireAuth, async (req, res) => {
    try {
        const purchases = await prisma.purchase.findMany({
            where: { userId: req.user.userId },
            orderBy: { createdAt: 'desc' },
            take: 50,
            select: {
                id: true,
                packId: true,
                goldGranted: true,
                amountCents: true,
                currency: true,
                status: true,
                createdAt: true,
            },
        });
        res.json({ purchases });
    } catch (err) {
        console.error('Purchase history error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;
