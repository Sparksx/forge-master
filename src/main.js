import '../style.css';
import { gameEvents, EVENTS } from './events.js';
import { loadGame, getForgedItem } from './state.js';
import { forgeEquipment } from './forge.js';
import { updateUI, showDecisionModal, showItemDetailModal, hideItemDetailModal, showWipModal, showForgeUpgradeModal } from './ui.js';
import { initNavigation, switchTab } from './navigation.js';
import { initShop } from './shop.js';

// Wire events: state changes trigger UI updates
gameEvents.on(EVENTS.STATE_CHANGED, updateUI);
gameEvents.on(EVENTS.ITEM_FORGED, showDecisionModal);

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

    // Action buttons
    document.getElementById('profile-btn').addEventListener('click', () => showWipModal('Profile'));
    document.getElementById('auto-action-btn').addEventListener('click', () => showWipModal('Auto'));

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
}

window.addEventListener('DOMContentLoaded', init);
