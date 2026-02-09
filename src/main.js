import '../style.css';
import { gameEvents, EVENTS } from './events.js';
import { loadGame, getForgedItem } from './state.js';
import { forgeEquipment } from './forge.js';
import {
    updateUI, handleItemForged, showDecisionModal, showItemDetailModal,
    hideItemDetailModal, showWipModal, showForgeUpgradeModal, handleAutoForgeClick,
    showForgeToast, showSellToast, updateCombatUI, updateCombatInfo,
    showDamageNumber, showCombatResult, triggerAttackAnimation, triggerHitAnimation,
    updateWaveDisplay
} from './ui.js';
import { initNavigation, switchTab } from './navigation.js';
import { initShop } from './shop.js';
import { startCombat, refreshPlayerStats } from './combat.js';

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

gameEvents.on(EVENTS.COMBAT_PLAYER_HIT, ({ damage, isCrit }) => {
    triggerAttackAnimation('player');
    triggerHitAnimation('monster');
    showDamageNumber(damage, 'monster', isCrit);
});

gameEvents.on(EVENTS.COMBAT_MONSTER_HIT, ({ damage }) => {
    triggerAttackAnimation('monster');
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

// Refresh player combat stats when equipment changes
gameEvents.on(EVENTS.ITEM_EQUIPPED, () => {
    refreshPlayerStats();
});

// Wire DOM interactions
function init() {
    loadGame();
    updateUI();
    initNavigation();

    // Forge button: show pending item or forge new
    document.getElementById('forge-btn').addEventListener('click', () => {
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
    document.getElementById('profile-btn').addEventListener('click', () => showWipModal('Profile'));

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
}

window.addEventListener('DOMContentLoaded', init);
