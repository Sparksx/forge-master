import '../style.css';
import { gameEvents, EVENTS } from './events.js';
import { loadGame, loadGameFromServer, getForgedItem } from './state.js';
import { forgeEquipment } from './forge.js';
import {
    updateUI, handleItemForged, showDecisionModal, showItemDetailModal,
    hideItemDetailModal, showProfileModal, showForgeUpgradeModal, handleAutoForgeClick,
    isAutoForging, showForgeToast, showSellToast, updateCombatUI, updateCombatInfo,
    showDamageNumber, showCombatResult, triggerAttackAnimation, triggerHitAnimation,
    triggerMonsterHitAnimation, updateWaveDisplay, renderMonsters, updateMonsterFocus
} from './ui.js';
import { initNavigation, switchTab } from './navigation.js';
import { initShop } from './shop.js';
import { startCombat, refreshPlayerStats } from './combat.js';
import { initAuth, setAuthSuccessCallback, getCurrentUser, performLogout } from './auth.js';
import { connectSocket } from './socket-client.js';
import { initChat, refreshChatSocket } from './chat.js';
import { initPvp, refreshPvpSocket } from './pvp.js';
import { getAccessToken } from './api.js';

// Wire events: state changes trigger UI updates
gameEvents.on(EVENTS.STATE_CHANGED, updateUI);
gameEvents.on(EVENTS.ITEM_FORGED, handleItemForged);
gameEvents.on(EVENTS.ITEM_FORGED, showForgeToast);
gameEvents.on(EVENTS.ITEM_SOLD, showSellToast);

// Combat events
gameEvents.on(EVENTS.COMBAT_START, (data) => {
    updateCombatInfo(data);
    updateCombatUI();
});

gameEvents.on(EVENTS.COMBAT_TICK, () => {
    updateCombatUI();
});

gameEvents.on(EVENTS.COMBAT_PLAYER_HIT, ({ damage, isCrit, monsterIndex }) => {
    triggerAttackAnimation('player');
    triggerHitAnimation('monster');
    showDamageNumber(damage, 'monster', isCrit, monsterIndex);
});

gameEvents.on(EVENTS.COMBAT_MONSTER_HIT, ({ damage, monsterIndex }) => {
    triggerMonsterHitAnimation(monsterIndex);
    triggerHitAnimation('player');
    showDamageNumber(damage, 'player', false);
});

gameEvents.on(EVENTS.COMBAT_PLAYER_LIFESTEAL, ({ amount }) => {
    showDamageNumber(amount, 'heal', false);
});

gameEvents.on(EVENTS.COMBAT_MONSTER_DEFEATED, () => {
    showCombatResult('Victory!', 'victory');
});

gameEvents.on(EVENTS.COMBAT_PLAYER_DEFEATED, () => {
    showCombatResult('Defeated', 'defeat');
});

gameEvents.on(EVENTS.COMBAT_WAVE_CHANGED, () => {
    updateWaveDisplay();
});

gameEvents.on(EVENTS.COMBAT_FOCUS_CHANGED, (data) => {
    updateMonsterFocus(data);
});

// Refresh player combat stats when equipment changes
gameEvents.on(EVENTS.ITEM_EQUIPPED, () => {
    refreshPlayerStats();
});

// Start the game after successful auth
async function startGame() {
    // Load game state from server if authenticated, otherwise localStorage
    if (getAccessToken()) {
        await loadGameFromServer();
    } else {
        loadGame();
    }

    updateUI();
    initNavigation();

    // Forge button: show pending item or forge new (disabled during auto-forge)
    document.getElementById('forge-btn').addEventListener('click', () => {
        if (isAutoForging()) return;
        const pending = getForgedItem();
        if (pending) {
            showDecisionModal(pending);
        } else {
            forgeEquipment();
        }
    });

    // Gold "+" button -> navigate to shop
    document.getElementById('gold-add-btn').addEventListener('click', () => switchTab('shop'));

    // Shop
    initShop();

    // Forge upgrade icon button -> open forge upgrade modal
    document.getElementById('forge-upgrade-btn').addEventListener('click', () => {
        showForgeUpgradeModal();
    });

    // Auto-forge button
    document.getElementById('auto-action-btn').addEventListener('click', () => {
        handleAutoForgeClick();
    });

    // Profile
    document.getElementById('profile-btn').addEventListener('click', () => {
        showProfileModal(getCurrentUser(), performLogout);
    });

    // Equipment slot clicks -> item detail modal
    document.querySelector('.body-container').addEventListener('click', (e) => {
        const slot = e.target.closest('.equipment-slot');
        if (!slot) return;
        const type = slot.dataset.type;
        if (type) showItemDetailModal(type);
    });

    document.getElementById('item-detail-close').addEventListener('click', hideItemDetailModal);

    // Click outside modal to close
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
            }
        });
    });

    // Start combat system
    updateWaveDisplay();
    startCombat();

    // Connect socket and init chat/PvP
    connectSocket();
    initChat();
    initPvp();
}

// Wire DOM interactions
function init() {
    // Set up auth callback — when user logs in, start the game
    setAuthSuccessCallback(async (user) => {
        await startGame();
    });

    // Try to restore session (auto-login from stored refresh token)
    initAuth().then(async (user) => {
        if (user) {
            await startGame();
        }
        // If no user, auth screen is shown — startGame will be called via callback on login
    });
}

window.addEventListener('DOMContentLoaded', init);
