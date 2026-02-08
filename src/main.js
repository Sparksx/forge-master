import '../style.css';
import { gameEvents, EVENTS } from './events.js';
import { loadGame, equipItem, getForgedItem, sellForgedItem } from './state.js';
import { forgeEquipment } from './forge.js';
import { updateUI, showDecisionModal, hideDecisionModal } from './ui.js';
import { initNavigation } from './navigation.js';

// Wire events: state changes trigger UI updates
gameEvents.on(EVENTS.STATE_CHANGED, updateUI);
gameEvents.on(EVENTS.ITEM_FORGED, showDecisionModal);

// Wire DOM interactions
function init() {
    loadGame();
    updateUI();
    initNavigation();

    document.getElementById('forge-btn').addEventListener('click', forgeEquipment);

    document.getElementById('equip-btn').addEventListener('click', () => {
        const item = getForgedItem();
        if (item) {
            equipItem(item);
        }
        hideDecisionModal();
    });

    document.getElementById('sell-btn').addEventListener('click', () => {
        sellForgedItem();
        hideDecisionModal();
    });
}

window.addEventListener('DOMContentLoaded', init);
