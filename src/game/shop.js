// Shop model layer (no DOM): Stripe-backed gold packs.
//
// Gold is client-authoritative (the client PUTs its whole balance to
// /api/game/state), so a purchase that only lived in the DB would be clobbered
// by the next save. We therefore reconcile on return from Stripe Checkout —
// before the idle loop starts — by confirming the payment server-side and then
// reloading the authoritative balance via loadFromServer(). This mirrors the
// established server-granted-gold pattern (see creditServerGold in state.js).
import { apiFetch, getAccessToken } from '../api.js';
import { loadFromServer } from './state.js';
import { gameEvents, EVENTS } from '../events.js';

/** Fetch the available gold packs. Returns [] on failure. */
export async function fetchGoldPacks() {
    try {
        const res = await apiFetch('/api/payment/packs');
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data.packs) ? data.packs : [];
    } catch {
        return [];
    }
}

/**
 * Start checkout for a pack: creates a Stripe Checkout Session and redirects the
 * browser to it. Throws with a user-facing message on failure (caller toasts it).
 */
export async function startCheckout(packId) {
    const res = await apiFetch('/api/payment/create-checkout-session', {
        method: 'POST',
        body: { packId },
    });
    let data = {};
    try { data = await res.json(); } catch { /* ignore */ }
    if (!res.ok || !data.url) {
        throw new Error(data.error || 'Could not start checkout');
    }
    window.location.assign(data.url);
}

/** Fetch the player's purchase history. Returns [] on failure. */
export async function fetchPurchaseHistory() {
    try {
        const res = await apiFetch('/api/payment/history');
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data.purchases) ? data.purchases : [];
    } catch {
        return [];
    }
}

/**
 * Handle a return from Stripe Checkout. Reads `?payment=…&session_id=…`, strips
 * those params from the URL, and (on success) confirms + credits the purchase
 * server-side, then reloads state so the local gold balance is authoritative.
 *
 * Returns { status, granted } for the caller to toast, or null if this wasn't a
 * checkout return. Must be awaited during boot BEFORE the UI/idle loop mounts.
 */
export async function reconcileCheckoutReturn() {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const payment = params.get('payment');
    if (!payment) return null;

    const sessionId = params.get('session_id');

    // Clean the URL so a refresh doesn't reprocess the same return.
    params.delete('payment');
    params.delete('session_id');
    const qs = params.toString();
    const cleanUrl = window.location.pathname + (qs ? `?${qs}` : '') + window.location.hash;
    window.history.replaceState({}, '', cleanUrl);

    if (payment !== 'success' || !sessionId || !getAccessToken()) {
        return { status: payment, granted: 0 };
    }

    try {
        const res = await apiFetch('/api/payment/confirm', {
            method: 'POST',
            body: { sessionId },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return { status: 'error', granted: 0 };

        if (data.status === 'completed' || (data.granted ?? 0) > 0) {
            // Re-sync the authoritative balance so the next save won't overwrite it.
            await loadFromServer();
            gameEvents.emit(EVENTS.GOLD_PURCHASED, { granted: data.granted ?? 0 });
        }
        return { status: data.status || 'success', granted: data.granted ?? 0 };
    } catch {
        return { status: 'error', granted: 0 };
    }
}
