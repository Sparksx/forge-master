import '../style.css';
import '../admin.css';
import { gameEvents, EVENTS } from './events.js';
import { loadGame, loadGameFromServer, getForgedItem, setForgedItem, addXP, resetGame, addGold, saveGame, getTechEffect, addEssence, setProfilePicture } from './state.js';
import { forgeEquipment } from './forge.js';
import { initResearch } from './research.js';
import { initTechUI, renderTechTree, updateEssenceDisplay } from './ui/tech-ui.js';
import {
    updateUI, showDecisionModal, showItemDetailModal,
    hideItemDetailModal, showProfileModal, showForgeUpgradeModal, handleAutoForgeClick,
    isAutoForging, showForgeToast, showSellToast, updateCombatUI, updateCombatInfo,
    showDamageNumber, showCombatResult, triggerAttackAnimation, triggerHitAnimation,
    triggerMonsterHitAnimation, updateWaveDisplay, renderMonsters, updateMonsterFocus
} from './ui.js';
import { showToast } from './ui/helpers.js';
import { initNavigation, switchTab } from './navigation.js';
import { initShop } from './shop.js';
import { startCombat, stopCombat, refreshPlayerStats } from './combat.js';
import { initAuth, setAuthSuccessCallback, getCurrentUser, performLogout } from './auth.js';
import { connectSocket } from './socket-client.js';
import { initChat, refreshChatSocket } from './chat.js';
import { initPvp, refreshPvpSocket } from './pvp.js';
import { getAccessToken } from './api.js';
import { initAdminUI } from './ui/admin-ui.js';

// PWA: Register service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// PWA: Capture install prompt for later use
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    showInstallButton();
});

function showInstallButton() {
    const btn = document.getElementById('pwa-install-btn');
    if (btn) btn.classList.remove('hidden');
}

function handleInstallClick() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then(() => {
        deferredInstallPrompt = null;
        const btn = document.getElementById('pwa-install-btn');
        if (btn) btn.classList.add('hidden');
    });
}

// Wire events: state changes trigger UI updates
gameEvents.on(EVENTS.STATE_CHANGED, updateUI);
gameEvents.on(EVENTS.STATE_CHANGED, updateEssenceDisplay);
gameEvents.on(EVENTS.ITEM_FORGED, showForgeToast);

// Treasure Hunter: chance to find bonus gold when forging
gameEvents.on(EVENTS.ITEM_FORGED, (item) => {
    const treasureChance = getTechEffect('treasureHunter'); // 10% per level
    if (treasureChance > 0 && Math.random() * 100 < treasureChance) {
        const bonusGold = Math.floor(10 + item.level * (item.tier || 1) * 2);
        addGold(bonusGold);
        showToast(`🗝️ Trésor! +${bonusGold}g`, 'sell');
    }
});
gameEvents.on(EVENTS.ITEM_SOLD, showSellToast);

// Research events
gameEvents.on(EVENTS.RESEARCH_COMPLETED, ({ techId, level }) => {
    showToast(`🔬 Recherche terminée!`, 'study');
    renderTechTree();
    // Refresh combat stats in case vitality/strength changed
    refreshPlayerStats();
});

gameEvents.on(EVENTS.ESSENCE_CHANGED, () => {
    updateEssenceDisplay();
});

// Level-up reward toast
gameEvents.on(EVENTS.PLAYER_LEVEL_UP, ({ level, reward }) => {
    if (reward && reward.gold) {
        const prefix = reward.isMilestone ? '\uD83C\uDF1F' : '\u2B50';
        showToast(`${prefix} Level ${level}! +${reward.gold.toLocaleString('en-US')}g`, reward.isMilestone ? 'level-milestone' : 'level');
    }
});

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

gameEvents.on(EVENTS.COMBAT_MONSTER_DEFEATED, ({ monster }) => {
    showCombatResult('Victory!', 'victory');
    // Award XP based on monster's wave/sub-wave, boosted by battleXP tech
    const stage = ((monster?.wave || 1) - 1) * 10 + (monster?.subWave || 1);
    const baseXP = 5 + Math.floor(stage * 2.5);
    const battleXPBonus = getTechEffect('battleXP'); // +25% per level
    const xp = Math.floor(baseXP * (1 + battleXPBonus / 100));
    addXP(xp);
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

/** Show forged items one by one in the decision modal */
function showForgedBatch(items) {
    if (items.length === 0) return;
    const [first, ...remaining] = items;
    setForgedItem(first);
    showDecisionModal(first, () => {
        if (remaining.length > 0) {
            showForgedBatch(remaining);
        }
    });
}

// Start the game after successful auth
async function startGame() {
    // Load game state from server if authenticated, otherwise localStorage
    if (getAccessToken()) {
        await loadGameFromServer();
        // Sync avatar from user profile (stored on User model, not GameState)
        const user = getCurrentUser();
        if (user && user.profilePicture) {
            setProfilePicture(user.profilePicture);
        }
    } else {
        loadGame();
    }

    updateUI();
    initNavigation();

    // Forge button: show pending item or forge new batch (disabled during auto-forge)
    document.getElementById('forge-btn').addEventListener('click', () => {
        if (isAutoForging()) return;
        const pending = getForgedItem();
        if (pending) {
            showDecisionModal(pending);
        } else {
            const items = forgeEquipment();
            items.forEach(item => gameEvents.emit(EVENTS.ITEM_FORGED, item));
            showForgedBatch(items);
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

    // PWA install button
    document.getElementById('pwa-install-btn').addEventListener('click', handleInstallClick);

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

    // Keyboard: Escape closes active modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const activeModal = document.querySelector('.modal.active');
            if (activeModal) {
                activeModal.classList.remove('active');
                e.preventDefault();
            }
        }
    });

    // Keyboard: Enter/Space on equipment slots
    document.querySelector('.body-container').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            const slot = e.target.closest('.equipment-slot');
            if (!slot) return;
            e.preventDefault();
            const type = slot.dataset.type;
            if (type) showItemDetailModal(type);
        }
    });

    // Init tech tree
    initResearch();
    initTechUI();
    updateEssenceDisplay();

    // Start combat system
    updateWaveDisplay();
    startCombat();

    // Connect socket and init chat/PvP
    connectSocket();
    initChat();
    initPvp();

    // Admin/Moderator panel (role-based)
    initAdminUI();
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
