import { EQUIPMENT_TYPES, EQUIPMENT_ICONS, BASE_HEALTH, BASE_DAMAGE, BONUS_STATS, BONUS_STAT_KEYS } from './config.js';
import { getEquipment, getEquipmentByType, getGold, getForgedItem, equipItem, sellForgedItem } from './state.js';
import { calculateStats, calculatePowerScore } from './forge.js';

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function createElement(tag, className, textContent) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent !== undefined) el.textContent = textContent;
    return el;
}

function buildBonusLine(item, compareWith) {
    if (!item.bonusType || !item.bonusValue) return null;
    const cfg = BONUS_STATS[item.bonusType];
    if (!cfg) return null;

    const text = `${cfg.icon} ${cfg.label}: +${item.bonusValue}${cfg.unit}`;
    const div = createElement('div', 'forged-bonus', text);

    if (compareWith) {
        const sameType = compareWith.bonusType === item.bonusType;
        if (sameType) {
            if (item.bonusValue > compareWith.bonusValue) div.classList.add('stat-better');
            else if (item.bonusValue < compareWith.bonusValue) div.classList.add('stat-worse');
        }
        // Different bonus types = black text (no color)
    }

    return div;
}

function buildItemCard(item, compareWith) {
    const fragment = document.createDocumentFragment();

    const typeDiv = createElement('div', 'forged-type', `${EQUIPMENT_ICONS[item.type]} ${capitalizeFirst(item.type)}`);
    const levelDiv = createElement('div', 'forged-level', `Level ${item.level}`);
    const statLabel = item.statType === 'health' ? '❤️ Health' : '⚔️ Damage';
    const statDiv = createElement('div', 'forged-stat', `${statLabel}: +${item.stats}`);

    if (compareWith) {
        if (item.stats > compareWith.stats) statDiv.classList.add('stat-better');
        else if (item.stats < compareWith.stats) statDiv.classList.add('stat-worse');
    }

    fragment.append(typeDiv, levelDiv, statDiv);

    const bonusDiv = buildBonusLine(item, compareWith);
    if (bonusDiv) fragment.appendChild(bonusDiv);

    return fragment;
}

export function updateStats() {
    const equipment = getEquipment();
    const { totalHealth, totalDamage, bonuses } = calculateStats(equipment);

    const health = BASE_HEALTH + totalHealth;
    const damage = BASE_DAMAGE + totalDamage;
    document.getElementById('total-health').textContent = health;
    document.getElementById('total-damage').textContent = damage;
    document.getElementById('gold-amount').textContent = getGold();
    document.getElementById('power-score').textContent = calculatePowerScore(health, damage, bonuses);

    const bonusRow = document.getElementById('bonus-stats-row');
    bonusRow.textContent = '';

    const hasAnyBonus = BONUS_STAT_KEYS.some(key => bonuses[key] > 0);
    if (hasAnyBonus) {
        BONUS_STAT_KEYS.forEach(key => {
            if (bonuses[key] <= 0) return;
            const cfg = BONUS_STATS[key];
            const div = createElement('div', 'bonus-stat', `${cfg.icon} ${bonuses[key]}${cfg.unit}`);
            div.title = cfg.label;
            bonusRow.appendChild(div);
        });
    }
}

export function updateEquipmentSlots() {
    EQUIPMENT_TYPES.forEach(type => {
        const slotElement = document.getElementById(`slot-${type}`);
        const item = getEquipmentByType(type);
        slotElement.textContent = '';

        if (item) {
            const levelDiv = createElement('div', 'item-level', `Lv.${item.level}`);
            slotElement.appendChild(levelDiv);
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

export function showItemDetailModal(type) {
    const item = getEquipmentByType(type);
    if (!item) return;

    const modal = document.getElementById('item-detail-modal');
    const info = document.getElementById('item-detail-info');
    info.textContent = '';

    info.appendChild(buildItemCard(item));

    modal.classList.add('active');
}

export function hideItemDetailModal() {
    document.getElementById('item-detail-modal').classList.remove('active');
}

export function showDecisionModal(item) {
    const modal = document.getElementById('decision-modal');
    const itemInfo = document.getElementById('forged-item-info');

    const currentItem = getEquipmentByType(item.type);
    itemInfo.textContent = '';

    if (currentItem) {
        const instruction = createElement('div', 'choice-instruction', 'Choose the equipment to keep');
        itemInfo.appendChild(instruction);

        const container = createElement('div', 'comparison-container');

        // Current item card - click to keep current (sell new)
        const currentCard = createElement('div', 'item-comparison current-item clickable');
        const currentLabel = createElement('div', 'comparison-label', 'Current');
        currentCard.appendChild(currentLabel);
        currentCard.appendChild(buildItemCard(currentItem, item));
        const currentKeep = createElement('div', 'keep-label', `Keep (+${item.level}g)`);
        currentCard.appendChild(currentKeep);
        currentCard.addEventListener('click', () => {
            sellForgedItem();
            hideDecisionModal();
        });

        // New item card - click to equip new (sell old)
        const newCard = createElement('div', 'item-comparison new-item clickable');
        const newLabel = createElement('div', 'comparison-label', 'New');
        newCard.appendChild(newLabel);
        newCard.appendChild(buildItemCard(item, currentItem));
        const newKeep = createElement('div', 'keep-label', `Keep (+${currentItem.level}g)`);
        newCard.appendChild(newKeep);
        newCard.addEventListener('click', () => {
            const forgedItem = getForgedItem();
            if (forgedItem) equipItem(forgedItem);
            hideDecisionModal();
        });

        container.append(currentCard, newCard);
        itemInfo.appendChild(container);
    } else {
        itemInfo.appendChild(buildItemCard(item));

        const sellValue = createElement('div', 'sell-value', `💰 Sell value: ${item.level} gold`);
        itemInfo.appendChild(sellValue);

        const buttons = createElement('div', 'modal-buttons');
        const sellBtn = createElement('button', 'btn btn-sell', `💰 Sell (+${item.level}g)`);
        sellBtn.addEventListener('click', () => {
            sellForgedItem();
            hideDecisionModal();
        });
        const equipBtn = createElement('button', 'btn btn-equip', '✅ Equip');
        equipBtn.addEventListener('click', () => {
            const forgedItem = getForgedItem();
            if (forgedItem) equipItem(forgedItem);
            hideDecisionModal();
        });
        buttons.append(sellBtn, equipBtn);
        itemInfo.appendChild(buttons);
    }

    modal.classList.add('active');
}

export function hideDecisionModal() {
    document.getElementById('decision-modal').classList.remove('active');
}

export function showWipModal(title) {
    const modal = document.getElementById('wip-modal');
    document.getElementById('wip-modal-title').textContent = title;
    modal.classList.add('active');
}
