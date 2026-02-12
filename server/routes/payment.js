import { Router } from 'express';
import Stripe from 'stripe';
import { requireAuth, logAudit } from '../middleware/auth.js';
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, DIAMOND_PACKS, CORS_ORIGIN } from '../config.js';
import prisma from '../lib/prisma.js';

const router = Router();

// Initialize Stripe (lazy — only when keys are configured)
function getStripe() {
    if (!STRIPE_SECRET_KEY) {
        throw new Error('Stripe is not configured');
    }
    return new Stripe(STRIPE_SECRET_KEY);
}

// ─── GET /api/payment/packs ─────────────────────────────────────
// Public: return available diamond packs (frontend needs this to render the shop)
router.get('/packs', (req, res) => {
    const packs = DIAMOND_PACKS.map(p => ({
        id: p.id,
        diamonds: p.diamonds,
        bonus: p.bonus,
        priceCents: p.priceCents,
        label: p.label,
        oneTime: p.oneTime || false,
    }));
    res.json({ packs });
});

// ─── POST /api/payment/create-checkout-session ──────────────────
// Authenticated: create a Stripe Checkout Session for a diamond pack
router.post('/create-checkout-session', requireAuth, async (req, res) => {
    const { packId } = req.body;

    if (!packId || typeof packId !== 'string') {
        return res.status(400).json({ error: 'packId is required' });
    }

    const pack = DIAMOND_PACKS.find(p => p.id === packId);
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
        const totalDiamonds = pack.diamonds + pack.bonus;

        // Build success/cancel URLs
        const baseUrl = CORS_ORIGIN !== '*' ? CORS_ORIGIN : 'http://localhost:5173';
        const successUrl = `${baseUrl}?payment=success&session_id={CHECKOUT_SESSION_ID}`;
        const cancelUrl = `${baseUrl}?payment=cancelled`;

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            line_items: [{
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: `${totalDiamonds} Diamonds — ${pack.label}`,
                        description: pack.bonus > 0
                            ? `${pack.diamonds} diamonds + ${pack.bonus} bonus diamonds`
                            : `${pack.diamonds} diamonds`,
                    },
                    unit_amount: pack.priceCents,
                },
                quantity: 1,
            }],
            metadata: {
                userId: String(req.user.userId),
                packId: pack.id,
                diamonds: String(totalDiamonds),
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
                diamondsGranted: totalDiamonds,
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
            // Idempotence: check if already processed
            const purchase = await prisma.purchase.findUnique({
                where: { stripeSessionId: session.id },
            });

            if (!purchase) {
                console.warn('Webhook: no purchase record for session', session.id);
                return res.json({ received: true });
            }

            if (purchase.status === 'completed') {
                // Already processed — idempotent
                return res.json({ received: true });
            }

            // Credit diamonds and mark purchase as completed in a transaction
            await prisma.$transaction([
                prisma.purchase.update({
                    where: { stripeSessionId: session.id },
                    data: {
                        status: 'completed',
                        stripePaymentId: session.payment_intent,
                    },
                }),
                prisma.gameState.update({
                    where: { userId: purchase.userId },
                    data: {
                        diamonds: { increment: purchase.diamondsGranted },
                    },
                }),
            ]);

            // Audit log
            await logAudit(purchase.userId, 'purchase_diamonds', purchase.userId, {
                packId: purchase.packId,
                diamonds: purchase.diamondsGranted,
                amountCents: purchase.amountCents,
                stripeSessionId: session.id,
            });

            console.log(`Purchase completed: user ${purchase.userId} received ${purchase.diamondsGranted} diamonds (${purchase.packId})`);
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
                await prisma.$transaction([
                    prisma.purchase.update({
                        where: { id: purchase.id },
                        data: { status: 'refunded' },
                    }),
                    prisma.gameState.update({
                        where: { userId: purchase.userId },
                        data: {
                            diamonds: { decrement: purchase.diamondsGranted },
                        },
                    }),
                ]);

                await logAudit(purchase.userId, 'refund_diamonds', purchase.userId, {
                    packId: purchase.packId,
                    diamonds: purchase.diamondsGranted,
                    stripePaymentId: charge.payment_intent,
                });

                console.log(`Refund processed: user ${purchase.userId} lost ${purchase.diamondsGranted} diamonds`);
            }
        } catch (err) {
            console.error('Refund webhook error:', err);
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
                diamondsGranted: true,
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
