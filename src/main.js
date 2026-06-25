// Gear Master: Reforged — entry point.
import '../css/reforged.css';
import '../css/admin-panel.css';

import { initAuth, setAuthSuccessCallback, getCurrentUser } from './auth.js';
import { getAccessToken } from './api.js';
import { connectSocket } from './socket-client.js';
import { loadFromServer, loadLocal } from './game/state.js';
import { reconcileCheckoutReturn } from './game/shop.js';
import { loadMyClan } from './game/clan.js';
import { initClanMissions } from './game/clan-missions.js';
import { initPvp } from './game/pvp.js';
import { initApp } from './screens/app.js';
import { toast } from './screens/components.js';

// PWA service worker (best-effort), resolved against the deploy base path.
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
}

let started = false;

async function startGame() {
    if (started) return;
    started = true;

    if (getAccessToken()) {
        await loadFromServer();
    } else {
        loadLocal();
    }

    // Reconcile a return from Stripe Checkout BEFORE the idle loop starts, so a
    // purchased gold balance is synced and can't be clobbered by the next save.
    const checkout = await reconcileCheckoutReturn();

    // Live services (chat/PvP) over the authenticated socket.
    connectSocket({ onReconnect: () => initPvp() });

    // Load the player's clan so perks apply before the UI renders.
    await loadMyClan();

    // Track gameplay toward clan missions (forge/defeat/boss/swap/arena).
    initClanMissions();

    initApp(document.getElementById('game-container'));

    // Toast the checkout outcome once the toast root exists (after initApp).
    if (checkout) {
        if (checkout.status === 'completed' || checkout.granted > 0) {
            toast(`Purchase complete — +${checkout.granted.toLocaleString('en-US')} gold!`, 'success');
        } else if (checkout.status === 'cancelled') {
            toast('Checkout cancelled', 'info');
        } else if (checkout.status === 'error') {
            toast('We could not confirm your purchase. Contact support if you were charged.', 'error');
        }
    }
}

function boot() {
    setAuthSuccessCallback(() => startGame());
    initAuth().then((user) => {
        if (user || getCurrentUser()) startGame();
        // Otherwise the auth screen is shown; startGame fires via the success callback.
    });
}

window.addEventListener('DOMContentLoaded', boot);
