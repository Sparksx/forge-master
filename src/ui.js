import { EQUIPMENT_TYPES, EQUIPMENT_ICONS, BASE_HEALTH, BASE_DAMAGE, BONUS_STATS, BONUS_STAT_KEYS } from './config.js';
import { getEquipment, getEquipmentByType, getGold } from './state.js';
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
    const equipBtn = document.getElementById('equip-btn');
    const sellBtn = document.getElementById('sell-btn');

    const currentItem = getEquipmentByType(item.type);
    itemInfo.textContent = '';

    if (currentItem) {
        const container = createElement('div', 'comparison-container');

        const currentCard = createElement('div', 'item-comparison current-item');
        const currentLabel = createElement('div', 'comparison-label', 'Current');
        currentCard.appendChild(currentLabel);
        currentCard.appendChild(buildItemCard(currentItem, item));

        const arrow = createElement('div', 'comparison-arrow', '→');

        const newCard = createElement('div', 'item-comparison new-item');
        const newLabel = createElement('div', 'comparison-label', 'New');
        newCard.appendChild(newLabel);
        newCard.appendChild(buildItemCard(item, currentItem));

        container.append(currentCard, arrow, newCard);
        itemInfo.appendChild(container);

        const sellValue = createElement('div', 'sell-value', `💰 Sell new: ${item.level}g | Equip & sell old: ${currentItem.level}g`);
        itemInfo.appendChild(sellValue);

        equipBtn.textContent = `✅ Equip (+${currentItem.level}g)`;
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
