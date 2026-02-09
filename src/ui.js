import {
    EQUIPMENT_TYPES, EQUIPMENT_ICONS, BASE_HEALTH, BASE_DAMAGE,
    BONUS_STATS, BONUS_STAT_KEYS, TIERS, MAX_FORGE_LEVEL
} from './config.js';
import {
    getEquipment, getEquipmentByType, getGold, getForgedItem,
    equipItem, sellForgedItem, getSellValue, getForgeLevel,
    getForgeUpgradeCost, upgradeForge
} from './state.js';
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

function formatNumber(n) {
    return n.toLocaleString('fr-FR');
}

function buildBonusLines(item, compareWith) {
    if (!item.bonuses || item.bonuses.length === 0) return [];

    return item.bonuses.map(bonus => {
        const cfg = BONUS_STATS[bonus.type];
        if (!cfg) return null;

        const text = `${cfg.icon} ${cfg.label}: +${bonus.value}${cfg.unit}`;
        const div = createElement('div', 'forged-bonus', text);

        if (compareWith && compareWith.bonuses) {
            const otherBonus = compareWith.bonuses.find(b => b.type === bonus.type);
            if (otherBonus) {
                if (bonus.value > otherBonus.value) div.classList.add('stat-better');
                else if (bonus.value < otherBonus.value) div.classList.add('stat-worse');
            }
        }

        return div;
    }).filter(Boolean);
}

function buildItemCard(item, compareWith) {
    const fragment = document.createDocumentFragment();
    const tierDef = TIERS[(item.tier || 1) - 1];

    const tierDiv = createElement('div', 'forged-tier', tierDef.name);
    tierDiv.style.color = tierDef.color;

    const typeDiv = createElement('div', 'forged-type', `${EQUIPMENT_ICONS[item.type]} ${capitalizeFirst(item.type)}`);
    const levelDiv = createElement('div', 'forged-level', `Level ${item.level}`);
    const statLabel = item.statType === 'health' ? '❤️ Health' : '⚔️ Damage';
    const statDiv = createElement('div', 'forged-stat', `${statLabel}: +${formatNumber(item.stats)}`);

    if (compareWith) {
        if (item.stats > compareWith.stats) statDiv.classList.add('stat-better');
        else if (item.stats < compareWith.stats) statDiv.classList.add('stat-worse');
    }

    fragment.append(tierDiv, typeDiv, levelDiv, statDiv);

    const bonusDivs = buildBonusLines(item, compareWith);
    bonusDivs.forEach(div => fragment.appendChild(div));

    return fragment;
}

export function updateStats() {
    const equipment = getEquipment();
    const { totalHealth, totalDamage, bonuses } = calculateStats(equipment);

    const health = BASE_HEALTH + totalHealth;
    const damage = BASE_DAMAGE + totalDamage;
    document.getElementById('total-health').textContent = formatNumber(health);
    document.getElementById('total-damage').textContent = formatNumber(damage);
    document.getElementById('gold-amount').textContent = formatNumber(getGold());
    document.getElementById('power-score').textContent = formatNumber(calculatePowerScore(health, damage, bonuses));

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

        const slotParent = slotElement.closest('.equipment-slot');

        if (item) {
            const tierDef = TIERS[(item.tier || 1) - 1];
            slotParent.style.borderColor = tierDef.color;
            slotParent.style.borderWidth = '2px';

            const levelDiv = createElement('div', 'item-level', `Lv.${item.level}`);
            levelDiv.style.color = tierDef.color;
            slotElement.appendChild(levelDiv);
        } else {
            slotParent.style.borderColor = '#e0e0e0';
            slotParent.style.borderWidth = '1px';
            const emptySpan = createElement('span', 'empty-slot', 'Empty');
            slotElement.appendChild(emptySpan);
        }
    });
}

export function updateForgeInfo() {
    const forgeLevel = getForgeLevel();
    const forgeLevelEl = document.getElementById('forge-level');
    if (forgeLevelEl) forgeLevelEl.textContent = forgeLevel;

    const upgradeBtn = document.getElementById('upgrade-forge-btn');
    if (!upgradeBtn) return;

    const cost = getForgeUpgradeCost();
    if (cost === null) {
        upgradeBtn.textContent = 'MAX';
        upgradeBtn.disabled = true;
        upgradeBtn.classList.add('btn-disabled');
    } else {
        upgradeBtn.textContent = `${formatNumber(cost)}g`;
        const canAfford = getGold() >= cost;
        upgradeBtn.disabled = !canAfford;
        upgradeBtn.classList.toggle('btn-disabled', !canAfford);
    }
}

export function updateUI() {
    updateStats();
    updateEquipmentSlots();
    updateForgeInfo();
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
        const sellNewValue = getSellValue(item);
        const currentKeep = createElement('div', 'keep-label', `Keep (+${formatNumber(sellNewValue)}g)`);
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
        const sellOldValue = getSellValue(currentItem);
        const newKeep = createElement('div', 'keep-label', `Keep (+${formatNumber(sellOldValue)}g)`);
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

        const sellValue = getSellValue(item);
        const sellValueDiv = createElement('div', 'sell-value', `Sell value: ${formatNumber(sellValue)} gold`);
        itemInfo.appendChild(sellValueDiv);

        const buttons = createElement('div', 'modal-buttons');
        const sellBtn = createElement('button', 'btn btn-sell', `Sell (+${formatNumber(sellValue)}g)`);
        sellBtn.addEventListener('click', () => {
            sellForgedItem();
            hideDecisionModal();
        });
        const equipBtn = createElement('button', 'btn btn-equip', 'Equip');
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
