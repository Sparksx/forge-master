// Gear Master: Reforged — entry point.
import '../css/reforged.css';

import { initAuth, setAuthSuccessCallback, getCurrentUser } from './auth.js';
import { getAccessToken } from './api.js';
import { connectSocket } from './socket-client.js';
import { loadFromServer, loadLocal } from './game/state.js';
import { loadMyClan } from './game/clan.js';
import { initPvp } from './game/pvp.js';
import { initApp } from './screens/app.js';

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

    // Live services (chat/PvP) over the authenticated socket.
    connectSocket({ onReconnect: () => initPvp() });

    // Load the player's clan so perks apply before the UI renders.
    await loadMyClan();

    initApp(document.getElementById('game-container'));
}

function boot() {
    setAuthSuccessCallback(() => startGame());
    initAuth().then((user) => {
        if (user || getCurrentUser()) startGame();
        // Otherwise the auth screen is shown; startGame fires via the success callback.
    });
}

window.addEventListener('DOMContentLoaded', boot);
