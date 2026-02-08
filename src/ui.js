import { EQUIPMENT_TYPES, EQUIPMENT_ICONS, BASE_HEALTH, BASE_DAMAGE } from './config.js';
import { getEquipment, getEquipmentByType, getGold } from './state.js';
import { calculateStats } from './forge.js';

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Helper: create a DOM element with class and text content
function createElement(tag, className, textContent) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent !== undefined) el.textContent = textContent;
    return el;
}

// Build an item card (used in both slots and modal)
function buildItemCard(item) {
    const fragment = document.createDocumentFragment();

    const typeDiv = createElement('div', 'forged-type', `${EQUIPMENT_ICONS[item.type]} ${capitalizeFirst(item.type)}`);
    const levelDiv = createElement('div', 'forged-level', `Level ${item.level}`);
    const statLabel = item.statType === 'health' ? '❤️ Health' : '⚔️ Damage';
    const statDiv = createElement('div', 'forged-stat', `${statLabel}: +${item.stats}`);

    fragment.append(typeDiv, levelDiv, statDiv);
    return fragment;
}

export function updateStats() {
    const equipment = getEquipment();
    const { totalHealth, totalDamage } = calculateStats(equipment);

    document.getElementById('total-health').textContent = BASE_HEALTH + totalHealth;
    document.getElementById('total-damage').textContent = BASE_DAMAGE + totalDamage;
    document.getElementById('gold-amount').textContent = getGold();
}

export function updateEquipmentSlots() {
    EQUIPMENT_TYPES.forEach(type => {
        const slotElement = document.getElementById(`slot-${type}`);
        const item = getEquipmentByType(type);
        slotElement.textContent = '';

        if (item) {
            const statIcon = item.statType === 'health' ? '❤️' : '⚔️';
            const levelDiv = createElement('div', 'item-level', `Level ${item.level}`);
            const statDiv = createElement('div', `item-stat ${item.statType === 'health' ? 'stat-health' : 'stat-damage'}`, `${statIcon} +${item.stats}`);
            slotElement.append(levelDiv, statDiv);
        } else {
            const emptySpan = createElement('span', 'empty-slot', 'Empty');
            slotElement.appendChild(emptySpan);
        }
    });
}

export function updateUI() {
    updateStats();
    updateEquipmentSlots();
}

export function showDecisionModal(item) {
    const modal = document.getElementById('decision-modal');
    const itemInfo = document.getElementById('forged-item-info');
    const equipBtn = document.getElementById('equip-btn');
    const sellBtn = document.getElementById('sell-btn');

    const currentItem = getEquipmentByType(item.type);
    itemInfo.textContent = '';

    if (currentItem) {
        const container = createElement('div', 'comparison-container');

        // Current item card
        const currentCard = createElement('div', 'item-comparison current-item');
        const currentLabel = createElement('div', 'comparison-label', 'Current');
        currentCard.appendChild(currentLabel);
        currentCard.appendChild(buildItemCard(currentItem));

        // Arrow
        const arrow = createElement('div', 'comparison-arrow', '→');

        // New item card
        const newCard = createElement('div', 'item-comparison new-item');
        const newLabel = createElement('div', 'comparison-label', 'New');
        newCard.appendChild(newLabel);
        newCard.appendChild(buildItemCard(item));

        container.append(currentCard, arrow, newCard);
        itemInfo.appendChild(container);

        // Show sell value
        const sellValue = createElement('div', 'sell-value', `💰 Sell value: ${item.level} gold`);
        itemInfo.appendChild(sellValue);

        equipBtn.textContent = '✅ Equip New';
        sellBtn.textContent = `💰 Sell (+${item.level}g)`;
    } else {
        itemInfo.appendChild(buildItemCard(item));

        const sellValue = createElement('div', 'sell-value', `💰 Sell value: ${item.level} gold`);
        itemInfo.appendChild(sellValue);

        equipBtn.textContent = '✅ Equip';
        sellBtn.textContent = `💰 Sell (+${item.level}g)`;
    }

    modal.classList.add('active');
}

export function hideDecisionModal() {
    document.getElementById('decision-modal').classList.remove('active');
}
