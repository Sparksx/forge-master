import { gameEvents, EVENTS } from './events.js';
import { loadGame, equipItem, getForgedItem, discardForgedItem } from './state.js';
import { forgeEquipment } from './forge.js';
import { updateUI, showDecisionModal, hideDecisionModal } from './ui.js';

// Wire events: state changes trigger UI updates
gameEvents.on(EVENTS.STATE_CHANGED, updateUI);
gameEvents.on(EVENTS.ITEM_FORGED, showDecisionModal);

// Wire DOM interactions
function init() {
    loadGame();
    updateUI();

    document.getElementById('forge-btn').addEventListener('click', forgeEquipment);

    document.getElementById('equip-btn').addEventListener('click', () => {
        const item = getForgedItem();
        if (item) {
            equipItem(item);
        }
        hideDecisionModal();
    });

    document.getElementById('sell-btn').addEventListener('click', () => {
        discardForgedItem();
        hideDecisionModal();
    });
}

window.addEventListener('DOMContentLoaded', init);
