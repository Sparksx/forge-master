import {
    EQUIPMENT_TYPES, EQUIPMENT_ICONS, BASE_HEALTH, BASE_DAMAGE,
    BONUS_STATS, BONUS_STAT_KEYS, TIERS, FORGE_LEVELS, MAX_FORGE_LEVEL,
    AUTO_FORGE_INTERVAL
} from '../config.js';
import {
    getEquipment, getEquipmentByType, getGold, getDiamonds, getForgedItem,
    equipItem, sellForgedItem, getSellValue, getForgeLevel,
    getForgeUpgradeCost, startForgeUpgrade, getForgeUpgradeStatus,
    getForgeUpgradeState, speedUpForgeUpgrade, checkForgeUpgradeComplete,
    getPlayerLevel, getPlayerXP, getXPToNextLevel,
    setForgedItem, getTechLevel, getTechEffect,
    addGold, saveGame, getProfileEmoji,
} from '../state.js';
import { calculateStats, calculatePowerScore, forgeEquipment } from '../forge.js';
import { gameEvents, EVENTS } from '../events.js';
import { t } from '../i18n/i18n.js';
import { createElement, formatNumber, formatCompact, formatTime, capitalizeFirst, buildItemCard, showToast, animateGoldToward, initGoldAnimation } from './helpers.js';
import { renderProfileContent } from './profile-ui.js';
import { getSpriteStyle } from '../equipment-templates.js';

let forgeTimerInterval = null;
let decisionModalCallback = null;

// Cached DOM refs (populated on first use)
let domCache = null;
function getDomCache() {
    if (!domCache) {
        domCache = {
            headerLevel: document.getElementById('header-level-value'),
            xpFill: document.getElementById('header-xp-fill'),
            goldAmount: document.getElementById('gold-amount'),
            profileBtn: document.getElementById('profile-btn'),
            profileModal: document.getElementById('profile-modal'),
            forgeLevel: document.getElementById('forge-level'),
            forgeUpgradeBtn: document.getElementById('forge-upgrade-btn'),
            forgeUpgradeModal: document.getElementById('forge-upgrade-modal'),
            decisionModal: document.getElementById('decision-modal'),
            forgedItemInfo: document.getElementById('forged-item-info'),
            autoForgeModal: document.getElementById('auto-forge-modal'),
        };
    }
    return domCache;
}

// --- Auto-forge state ---
const autoForge = {
    active: false,
    selectedTiers: new Set(),
    timer: null,
    stopping: false,
    // Smart filter settings (persisted across auto-forge sessions)
    minLevel: 0,           // Niv.1: minimum item level (0 = disabled)
    minStats: 0,           // Niv.2: minimum main stat value (0 = disabled)
    selectedSlots: null,   // Niv.3: Set of slot types to keep, or null = all
};

// ===== Toast Notifications =====

export function showForgeToast(item) {
    const tierDef = TIERS[(item.tier || 1) - 1];
    const icon = EQUIPMENT_ICONS[item.type] || '';
    const tierName = t('tiers.' + tierDef.name.toLowerCase());
    const displayType = item.name || capitalizeFirst(item.type);
    showToast(t('forge.forged', { icon, tier: tierName, type: displayType }), 'forge');
}

export function showSellToast({ item, goldEarned }) {
    showToast(`+${formatNumber(goldEarned)}g`, 'sell');
}


// ===== Stats & Equipment =====

let cachedStats = { health: 0, damage: 0, bonuses: {}, power: 0 };

export function updateStats() {
    const equipment = getEquipment();
    const { totalHealth, totalDamage, bonuses } = calculateStats(equipment);

    const health = BASE_HEALTH + totalHealth;
    const damage = BASE_DAMAGE + totalDamage;
    const power = calculatePowerScore(health, damage, bonuses);

    cachedStats = { health, damage, bonuses, power };

    const dom = getDomCache();

    if (dom.headerLevel) dom.headerLevel.textContent = getPlayerLevel();

    if (dom.xpFill) {
        const xpNeeded = getXPToNextLevel();
        const xpCurrent = getPlayerXP();
        const pct = xpNeeded > 0 ? Math.min(100, (xpCurrent / xpNeeded) * 100) : 100;
        dom.xpFill.style.width = `${pct}%`;
    }

    // Animate gold display (drip effect for gains, snap for spends)
    animateGoldToward(getGold());

    // Update diamond display
    const diamondEl = document.getElementById('diamond-amount');
    if (diamondEl) diamondEl.textContent = formatCompact(getDiamonds());

    if (dom.profileBtn) dom.profileBtn.textContent = getProfileEmoji();

    if (dom.profileModal && dom.profileModal.classList.contains('active')) {
        renderProfileContent();
    }
}

export function getCachedStats() {
    return cachedStats;
}

function renderSingleSlot(type) {
    const slotElement = document.getElementById(`slot-${type}`);
    if (!slotElement) return;
    const item = getEquipmentByType(type);
    slotElement.textContent = '';

    const slotParent = slotElement.closest('.equipment-slot');

    // Update the slot icon: show sprite if available, else keep emoji
    const slotIcon = slotParent.querySelector('.slot-icon');
    if (slotIcon) {
        const spriteCSS = item ? getSpriteStyle(item.type, item.tier, item.spriteCol) : '';
        if (spriteCSS) {
            slotIcon.classList.add('has-sprite');
            slotIcon.style.cssText = spriteCSS;
            slotIcon.textContent = '';
        } else {
            slotIcon.classList.remove('has-sprite');
            slotIcon.style.cssText = '';
            slotIcon.textContent = EQUIPMENT_ICONS[type] || '';
        }
    }

    if (item) {
        const tierDef = TIERS[(item.tier || 1) - 1];
        slotParent.style.borderColor = tierDef.color;
        slotParent.style.borderWidth = '2px';

        // Show template name if available
        if (item.name) {
            const nameDiv = createElement('div', 'item-name', item.name);
            nameDiv.style.color = tierDef.color;
            slotElement.appendChild(nameDiv);
        }

        const levelDiv = createElement('div', 'item-level', `Lv.${item.level}`);
        levelDiv.style.color = tierDef.color;
        slotElement.appendChild(levelDiv);
    } else {
        slotParent.style.borderColor = '#e0e0e0';
        slotParent.style.borderWidth = '1px';
        const emptySpan = createElement('span', 'empty-slot', t('forge.empty'));
        slotElement.appendChild(emptySpan);
    }
}

export function updateEquipmentSlots(changedSlot) {
    if (changedSlot) {
        renderSingleSlot(changedSlot);
    } else {
        EQUIPMENT_TYPES.forEach(renderSingleSlot);
    }
}

// ===== Forge Level Button =====

export function updateForgeInfo() {
    const dom = getDomCache();
    const forgeLevel = getForgeLevel();

    if (dom.forgeLevel) dom.forgeLevel.textContent = forgeLevel;

    if (dom.forgeUpgradeBtn) {
        const upgradeState = getForgeUpgradeState();
        dom.forgeUpgradeBtn.classList.toggle('upgrading', !!upgradeState);
    }

    if (dom.forgeUpgradeModal && dom.forgeUpgradeModal.classList.contains('active')) {
        renderForgeUpgradeContent();
    }
}

// ===== Forge Upgrade Modal =====

function buildSideBySideChances(currentChances, nextChances) {
    const table = createElement('div', 'forge-chances-compare');

    const header = createElement('div', 'forge-compare-row forge-compare-header');
    header.append(
        createElement('span', 'forge-compare-cell forge-compare-name', ''),
        createElement('span', 'forge-compare-cell forge-compare-cur', t('forge.currentItem')),
        createElement('span', 'forge-compare-cell forge-compare-arrow', ''),
        createElement('span', 'forge-compare-cell forge-compare-next', t('forge.newItem'))
    );
    table.appendChild(header);

    TIERS.forEach((tier, i) => {
        if (currentChances[i] <= 0 && (!nextChances || !nextChances[i] || nextChances[i] <= 0)) return;
        const row = createElement('div', 'forge-compare-row');

        const name = createElement('span', 'forge-compare-cell forge-compare-name', t('tiers.' + tier.name.toLowerCase()));
        name.style.color = tier.color;

        const curPct = createElement('span', 'forge-compare-cell forge-compare-cur', `${currentChances[i]}%`);

        const arrowCell = createElement('span', 'forge-compare-cell forge-compare-arrow');
        const nextPct = createElement('span', 'forge-compare-cell forge-compare-next');

        if (nextChances) {
            nextPct.textContent = `${nextChances[i]}%`;
            if (nextChances[i] > currentChances[i]) {
                nextPct.classList.add('stat-better');
                arrowCell.textContent = '\u25B2';
                arrowCell.classList.add('stat-better');
            } else if (nextChances[i] < currentChances[i]) {
                nextPct.classList.add('stat-worse');
                arrowCell.textContent = '\u25BC';
                arrowCell.classList.add('stat-worse');
            } else {
                arrowCell.textContent = '=';
            }
        }

        row.append(name, curPct, arrowCell, nextPct);
        table.appendChild(row);
    });

    return table;
}

function startForgeTimer() {
    stopForgeTimer();
    forgeTimerInterval = setInterval(() => {
        const upgradeState = getForgeUpgradeState();
        if (!upgradeState) { stopForgeTimer(); return; }
        if (checkForgeUpgradeComplete()) {
            stopForgeTimer();
            renderForgeUpgradeContent();
            updateForgeInfo();
            return;
        }
        updateForgeTimerDisplay();
    }, 1000);
}

function stopForgeTimer() {
    if (forgeTimerInterval) {
        clearInterval(forgeTimerInterval);
        forgeTimerInterval = null;
    }
}

function updateForgeTimerDisplay() {
    const status = getForgeUpgradeStatus();
    if (!status) return;

    const timerText = document.getElementById('forge-timer-text');
    if (timerText) timerText.textContent = formatTime(status.remaining);

    const progressBar = document.getElementById('forge-progress-fill');
    if (progressBar) progressBar.style.width = `${(status.progress * 100).toFixed(1)}%`;

    const speedUpBtn = document.getElementById('forge-speed-up-btn');
    if (speedUpBtn) {
        speedUpBtn.textContent = `\u26A1 ${formatNumber(status.speedUpCost)} \uD83D\uDC8E`;
        const canAfford = getDiamonds() >= status.speedUpCost;
        speedUpBtn.disabled = !canAfford;
        speedUpBtn.classList.toggle('btn-disabled', !canAfford);
    }
}

function renderForgeUpgradeContent() {
    const info = document.getElementById('forge-upgrade-info');
    if (!info) return;
    info.textContent = '';

    const forgeLevel = getForgeLevel();
    const currentChances = FORGE_LEVELS[forgeLevel - 1].chances;
    const upgradeState = getForgeUpgradeState();
    const isUpgrading = !!upgradeState;
    const isMaxLevel = forgeLevel >= MAX_FORGE_LEVEL;

    const levelDisplay = createElement('div', 'forge-level-display', t('forge.forgeLevel', { level: forgeLevel }));
    info.appendChild(levelDisplay);

    const nextChances = !isMaxLevel ? FORGE_LEVELS[forgeLevel].chances : null;
    info.appendChild(buildSideBySideChances(currentChances, nextChances));

    if (isMaxLevel) {
        info.appendChild(createElement('div', 'forge-section-max', t('forge.maxLevel')));
        return;
    }

    if (isUpgrading) {
        const timerSection = createElement('div', 'forge-timer-section');
        const progressContainer = createElement('div', 'forge-progress-bar');
        const progressFill = createElement('div', 'forge-progress-fill');
        progressFill.id = 'forge-progress-fill';
        progressContainer.appendChild(progressFill);
        timerSection.appendChild(progressContainer);

        const timerText = createElement('div', 'forge-timer-text');
        timerText.id = 'forge-timer-text';
        timerSection.appendChild(timerText);

        const speedUpBtn = createElement('button', 'btn btn-speed-up');
        speedUpBtn.id = 'forge-speed-up-btn';
        speedUpBtn.addEventListener('click', () => { speedUpForgeUpgrade(); });
        timerSection.appendChild(speedUpBtn);

        info.appendChild(timerSection);
        updateForgeTimerDisplay();
        startForgeTimer();
    } else {
        const cost = getForgeUpgradeCost();
        const time = FORGE_LEVELS[forgeLevel].time;
        const upgradeBtn = createElement('button', 'btn btn-upgrade-forge',
            `\u2B06\uFE0F ${t('forge.upgradeCost', { cost: formatNumber(cost) })} \u00B7 ${formatTime(time)}`);
        upgradeBtn.id = 'upgrade-forge-btn';
        const canAfford = getGold() >= cost;
        upgradeBtn.disabled = !canAfford;
        upgradeBtn.classList.toggle('btn-disabled', !canAfford);
        upgradeBtn.addEventListener('click', () => { startForgeUpgrade(); });
        info.appendChild(upgradeBtn);
    }
}

export function showForgeUpgradeModal() {
    renderForgeUpgradeContent();
    document.getElementById('forge-upgrade-modal').classList.add('active');
}

export function hideForgeUpgradeModal() {
    stopForgeTimer();
    document.getElementById('forge-upgrade-modal').classList.remove('active');
}

// ===== Decision Modal =====

export function showDecisionModal(item, onClose) {
    decisionModalCallback = onClose || null;
    const dom = getDomCache();
    const modal = dom.decisionModal;
    const itemInfo = dom.forgedItemInfo;

    const slotType = item.type;
    let topItem = getEquipmentByType(slotType);
    let bottomItem = item;
    let hasSwapped = false;
    let powerDiffShown = null;

    renderDecisionContent();
    modal.classList.add('active');

    function calculateEquipPowerDiff(itemToEquip) {
        const currentPower = cachedStats.power;
        const equipment = { ...getEquipment() };
        equipment[itemToEquip.type] = itemToEquip;
        const { totalHealth, totalDamage, bonuses } = calculateStats(equipment);
        const hypotheticalPower = calculatePowerScore(
            BASE_HEALTH + totalHealth, BASE_DAMAGE + totalDamage, bonuses
        );
        return hypotheticalPower - currentPower;
    }

    function renderDecisionContent() {
        itemInfo.textContent = '';

        // === TOP SECTION: Equipped Item ===
        const topSection = createElement('div', 'decision-section decision-top');

        const topHeader = createElement('div', 'decision-header');
        const topLabel = createElement('div', 'decision-label decision-label-equipped',
            topItem ? `⚔️ ${t('forge.equipped')}` : `${EQUIPMENT_ICONS[slotType]} ${t('forge.emptySlot')}`);
        topHeader.appendChild(topLabel);

        if (powerDiffShown !== null) {
            const sign = powerDiffShown >= 0 ? '+' : '-';
            const badgeClass = powerDiffShown >= 0 ? 'power-up' : 'power-down';
            const badge = createElement('span', `decision-power-badge ${badgeClass}`,
                `${sign}${formatCompact(Math.abs(powerDiffShown))} ⚡`);
            topHeader.appendChild(badge);
        }

        topSection.appendChild(topHeader);

        if (topItem) {
            const topCard = createElement('div', 'decision-card');
            topCard.appendChild(buildItemCard(topItem, bottomItem));
            topSection.appendChild(topCard);
        } else {
            const emptyDiv = createElement('div', 'decision-empty');
            emptyDiv.textContent = t('forge.noEquipment');
            topSection.appendChild(emptyDiv);
        }

        itemInfo.appendChild(topSection);

        // === BOTTOM SECTION: Action Item ===
        const bottomSection = createElement('div', 'decision-section decision-bottom');

        const bottomLabel = createElement('div', 'decision-label decision-label-new',
            hasSwapped ? `📦 ${t('forge.old')}` : `✨ ${t('forge.newItem')}`);
        bottomSection.appendChild(bottomLabel);

        const bottomCard = createElement('div', 'decision-card');
        bottomCard.appendChild(buildItemCard(bottomItem, topItem));
        bottomSection.appendChild(bottomCard);

        // === ACTIONS ===
        const actionsContainer = createElement('div', 'decision-actions');

        // Equip button
        const powerDiff = calculateEquipPowerDiff(bottomItem);
        const sign = powerDiff >= 0 ? '+' : '-';
        const equipLabel = `🔄 ${t('forge.equip')} (${sign}${formatCompact(Math.abs(powerDiff))} ⚡)`;
        const equipBtn = createElement('button', 'btn decision-btn-equip', equipLabel);
        if (powerDiff > 0) equipBtn.classList.add('equip-upgrade');
        if (powerDiff < 0) equipBtn.classList.add('equip-downgrade');
        equipBtn.addEventListener('click', handleEquip);
        actionsContainer.appendChild(equipBtn);

        // Separator
        const separator = createElement('div', 'decision-separator');
        actionsContainer.appendChild(separator);

        // Sell button
        const sellValue = getSellValue(bottomItem);
        const sellBtn = createElement('button', 'btn decision-btn-sell',
            `💰 ${t('forge.sell', { amount: formatNumber(sellValue) })}`);
        sellBtn.addEventListener('click', handleSell);
        actionsContainer.appendChild(sellBtn);

        bottomSection.appendChild(actionsContainer);
        itemInfo.appendChild(bottomSection);
    }

    function handleEquip() {
        if (!topItem) {
            // Empty slot — just equip and close
            equipItem(bottomItem);
            hideDecisionModal();
            return;
        }

        // Calculate power diff before equipping
        const diff = calculateEquipPowerDiff(bottomItem);

        const oldTop = topItem;

        // Equip the bottom item without selling the old one
        equipItem(bottomItem, { studyOld: true });

        // Store old item as forgedItem so it is preserved if modal closes
        setForgedItem(oldTop);

        // Update modal state
        topItem = bottomItem;
        bottomItem = oldTop;
        hasSwapped = !hasSwapped;
        powerDiffShown = diff;

        // Re-render
        renderDecisionContent();

        // Fade out power badge after a short delay
        setTimeout(() => {
            const badge = itemInfo.querySelector('.decision-power-badge');
            if (badge) badge.classList.add('badge-fade-out');
        }, 2000);
    }

    function handleSell() {
        // Selling a higher-tier item than what is equipped requires confirmation
        if (topItem && (bottomItem.tier || 1) > (topItem.tier || 1)) {
            showSellConfirmation();
            return;
        }
        doSell();
    }

    function doSell() {
        const goldEarned = getSellValue(bottomItem);
        addGold(goldEarned);
        gameEvents.emit(EVENTS.ITEM_SOLD, { item: bottomItem, goldEarned });
        setForgedItem(null);
        hideDecisionModal();
    }

    function showSellConfirmation() {
        // Remove existing overlay if any
        const existing = modal.querySelector('.decision-confirm-overlay');
        if (existing) existing.remove();

        const overlay = createElement('div', 'decision-confirm-overlay');
        const box = createElement('div', 'decision-confirm-box');

        const title = createElement('div', 'decision-confirm-title', `⚠️ ${t('forge.sellConfirmTitle')}`);
        const msg = createElement('div', 'decision-confirm-msg',
            t('forge.sellConfirmMsg'));

        const btns = createElement('div', 'decision-confirm-btns');
        const cancelBtn = createElement('button', 'btn decision-confirm-cancel', t('forge.cancel'));
        cancelBtn.addEventListener('click', () => overlay.remove());
        const confirmBtn = createElement('button', 'btn decision-confirm-yes', t('forge.sellConfirmYes'));
        confirmBtn.addEventListener('click', () => { overlay.remove(); doSell(); });

        btns.append(cancelBtn, confirmBtn);
        box.append(title, msg, btns);
        overlay.appendChild(box);

        modal.querySelector('.modal-content').appendChild(overlay);
    }
}

export function hideDecisionModal() {
    getDomCache().decisionModal.classList.remove('active');
    if (decisionModalCallback) {
        const cb = decisionModalCallback;
        decisionModalCallback = null;
        cb();
    }
}

// ===== Auto Forge =====

export function isAutoForging() {
    return autoForge.active;
}

function getEffectiveAutoForgeInterval() {
    const quickForgeBonus = getTechEffect('quickForge'); // -15% per level
    return Math.floor(AUTO_FORGE_INTERVAL * (1 - quickForgeBonus / 100));
}

function scheduleNextAutoForge() {
    if (autoForge.stopping || !autoForge.active) { cleanupAutoForge(); return; }
    autoForge.timer = setTimeout(() => { doOneAutoForge(); }, getEffectiveAutoForgeInterval());
}

/** Check if an item passes all active smart filter criteria */
function passesSmartFilter(item) {
    const filterLevel = getTechEffect('smartFilter');

    // Niv.1+: minimum level filter
    if (filterLevel >= 1 && autoForge.minLevel > 0) {
        if (item.level < autoForge.minLevel) return false;
    }

    // Niv.2+: minimum main stat filter
    if (filterLevel >= 2 && autoForge.minStats > 0) {
        const mainStat = item.stats || 0;
        if (mainStat < autoForge.minStats) return false;
    }

    // Niv.3+: slot type filter
    if (filterLevel >= 3 && autoForge.selectedSlots && autoForge.selectedSlots.size > 0) {
        if (!autoForge.selectedSlots.has(item.type)) return false;
    }

    return true;
}

/** Try to auto-equip an item if autoEquip tech is active and item is strictly better */
function tryAutoEquip(item) {
    if (getTechEffect('autoEquip') < 1) return false;

    const currentEquipped = getEquipmentByType(item.type);
    if (!currentEquipped) {
        // Empty slot — always equip
        equipItem(item);
        showToast(`🔄 ${t('forge.autoEquipped', { icon: EQUIPMENT_ICONS[item.type] || '', level: item.level })}`, 'forge');
        return true;
    }

    // Calculate power with current vs with new item
    const equipment = { ...getEquipment() };
    const { totalHealth: curH, totalDamage: curD, bonuses: curB } = calculateStats(equipment);
    const currentPower = calculatePowerScore(BASE_HEALTH + curH, BASE_DAMAGE + curD, curB);

    equipment[item.type] = item;
    const { totalHealth: newH, totalDamage: newD, bonuses: newB } = calculateStats(equipment);
    const newPower = calculatePowerScore(BASE_HEALTH + newH, BASE_DAMAGE + newD, newB);

    if (newPower > currentPower) {
        equipItem(item);
        const diff = newPower - currentPower;
        showToast(`🔄 ${t('forge.autoEquippedDiff', { icon: EQUIPMENT_ICONS[item.type] || '', level: item.level, diff: formatCompact(diff) })}`, 'forge');
        return true;
    }

    return false;
}

function doOneAutoForge() {
    if (autoForge.stopping || !autoForge.active) { cleanupAutoForge(); return; }
    const items = forgeEquipment();

    // Emit events for all items (toasts, treasure hunter)
    items.forEach(item => gameEvents.emit(EVENTS.ITEM_FORGED, item));

    // Separate matching (tier + smart filter) and non-matching (auto-disposed)
    const matching = [];
    const nonMatching = [];
    for (const item of items) {
        if (autoForge.selectedTiers.has(item.tier) && passesSmartFilter(item)) {
            matching.push(item);
        } else {
            nonMatching.push(item);
        }
    }

    // Auto-sell non-matching items
    for (const item of nonMatching) {
        const goldEarned = getSellValue(item);
        addGold(goldEarned);
        gameEvents.emit(EVENTS.ITEM_SOLD, { item, goldEarned });
    }

    // Auto-equip matching items if tech is active, show remaining to player
    const remaining = [];
    for (const item of matching) {
        if (!tryAutoEquip(item)) {
            remaining.push(item);
        }
    }

    // Show remaining items one by one, then schedule next auto-forge
    showAutoForgeBatch(remaining);
}

function showAutoForgeBatch(items) {
    if (items.length === 0) {
        scheduleNextAutoForge();
        return;
    }
    const [first, ...remaining] = items;
    setForgedItem(first);
    showDecisionModal(first, () => {
        showAutoForgeBatch(remaining);
    });
}

function cleanupAutoForge() {
    autoForge.active = false;
    autoForge.stopping = false;
    if (autoForge.timer) { clearTimeout(autoForge.timer); autoForge.timer = null; }
    updateAutoForgeButton();
}

function updateAutoForgeButton() {
    const btn = document.getElementById('auto-action-btn');
    if (btn) btn.classList.toggle('auto-active', autoForge.active);
    const forgeBtn = document.getElementById('forge-btn');
    if (forgeBtn) {
        forgeBtn.disabled = autoForge.active;
        forgeBtn.classList.toggle('forge-btn-disabled', autoForge.active);
        // Animate forge button to show auto-forge is working
        forgeBtn.classList.toggle('forging', autoForge.active);
    }
}

export function handleAutoForgeClick() {
    if (autoForge.active) { cleanupAutoForge(); return; }
    showAutoForgeModal();
}

function showAutoForgeModal() {
    const info = document.getElementById('auto-forge-info');
    if (!info) return;
    info.textContent = '';

    const smartFilterLevel = getTechEffect('smartFilter');
    const hasAutoEquip = getTechEffect('autoEquip') >= 1;

    info.appendChild(createElement('div', 'auto-forge-desc', t('autoForge.selectTiersDesc')));

    const tierList = createElement('div', 'auto-forge-tiers');
    const forgeLevel = getForgeLevel();
    const chances = FORGE_LEVELS[forgeLevel - 1].chances;

    TIERS.forEach((tier, i) => {
        const row = createElement('label', 'auto-forge-tier-row');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'auto-forge-checkbox';
        checkbox.dataset.tier = tier.id;
        if (chances[i] > 0 && tier.id >= 2) checkbox.checked = true;
        if (chances[i] <= 0) { checkbox.disabled = true; row.classList.add('auto-forge-tier-disabled'); }

        const label = createElement('span', 'auto-forge-tier-name', `${t('tiers.' + tier.name.toLowerCase())} (${chances[i]}%)`);
        label.style.color = tier.color;

        row.append(checkbox, label);
        tierList.appendChild(row);
    });

    info.appendChild(tierList);

    // === Smart Filter section (only if tech researched) ===
    if (smartFilterLevel >= 1) {
        const filterSection = createElement('div', 'auto-forge-filter-section');
        const filterTitle = createElement('div', 'auto-forge-filter-title', `🧠 ${t('autoForge.smartFilter')}`);
        filterSection.appendChild(filterTitle);

        // Niv.1: Minimum level filter
        const levelRow = createElement('div', 'auto-forge-filter-row');
        const levelLabel = createElement('label', 'auto-forge-filter-label', t('autoForge.minLevelLabel'));
        const levelInput = document.createElement('input');
        levelInput.type = 'number';
        levelInput.className = 'auto-forge-filter-input';
        levelInput.id = 'smart-filter-min-level';
        levelInput.min = '0';
        levelInput.max = '999';
        levelInput.value = autoForge.minLevel || 0;
        levelInput.placeholder = '0';
        levelRow.append(levelLabel, levelInput);
        filterSection.appendChild(levelRow);

        // Niv.2: Minimum stats filter
        if (smartFilterLevel >= 2) {
            const statsRow = createElement('div', 'auto-forge-filter-row');
            const statsLabel = createElement('label', 'auto-forge-filter-label', t('autoForge.minStatLabel'));
            const statsInput = document.createElement('input');
            statsInput.type = 'number';
            statsInput.className = 'auto-forge-filter-input';
            statsInput.id = 'smart-filter-min-stats';
            statsInput.min = '0';
            statsInput.max = '99999';
            statsInput.value = autoForge.minStats || 0;
            statsInput.placeholder = '0';
            statsRow.append(statsLabel, statsInput);
            filterSection.appendChild(statsRow);
        }

        // Niv.3: Slot type filter
        if (smartFilterLevel >= 3) {
            const slotTitle = createElement('div', 'auto-forge-filter-subtitle', t('autoForge.slotsToKeepLabel'));
            filterSection.appendChild(slotTitle);

            const slotList = createElement('div', 'auto-forge-slot-list');
            EQUIPMENT_TYPES.forEach(type => {
                const row = createElement('label', 'auto-forge-slot-row');
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'auto-forge-slot-checkbox';
                checkbox.dataset.slot = type;
                checkbox.checked = !autoForge.selectedSlots || autoForge.selectedSlots.has(type);

                const icon = EQUIPMENT_ICONS[type] || '';
                const slotLabel = createElement('span', 'auto-forge-slot-name', `${icon} ${capitalizeFirst(type)}`);
                row.append(checkbox, slotLabel);
                slotList.appendChild(row);
            });
            filterSection.appendChild(slotList);
        }

        info.appendChild(filterSection);
    }

    // Auto-equip indicator (if tech is active)
    if (hasAutoEquip) {
        const equipRow = createElement('div', 'auto-forge-equip-row');
        equipRow.textContent = `🔄 ${t('autoForge.autoEquipActive')}`;
        info.appendChild(equipRow);
    }

    const startBtn = createElement('button', 'btn btn-start-auto', `\u25B6 ${t('autoForge.startAutoForge')}`);
    startBtn.addEventListener('click', () => {
        const selected = new Set();
        tierList.querySelectorAll('.auto-forge-checkbox:checked').forEach(cb => {
            selected.add(Number(cb.dataset.tier));
        });
        if (selected.size === 0) return;
        autoForge.selectedTiers = selected;
        autoForge.active = true;
        autoForge.stopping = false;

        // Read smart filter values
        if (smartFilterLevel >= 1) {
            const minLevelInput = document.getElementById('smart-filter-min-level');
            autoForge.minLevel = minLevelInput ? parseInt(minLevelInput.value, 10) || 0 : 0;
        }
        if (smartFilterLevel >= 2) {
            const minStatsInput = document.getElementById('smart-filter-min-stats');
            autoForge.minStats = minStatsInput ? parseInt(minStatsInput.value, 10) || 0 : 0;
        }
        if (smartFilterLevel >= 3) {
            const slotCheckboxes = info.querySelectorAll('.auto-forge-slot-checkbox');
            const selectedSlots = new Set();
            slotCheckboxes.forEach(cb => {
                if (cb.checked) selectedSlots.add(cb.dataset.slot);
            });
            // If all slots selected, treat as no filter
            autoForge.selectedSlots = selectedSlots.size === EQUIPMENT_TYPES.length ? null : selectedSlots;
        }

        hideAutoForgeModal();
        updateAutoForgeButton();
        scheduleNextAutoForge();
    });
    info.appendChild(startBtn);

    getDomCache().autoForgeModal.classList.add('active');
}

function hideAutoForgeModal() {
    getDomCache().autoForgeModal.classList.remove('active');
}

// ===== Event handler =====

export function handleItemForged(item) {
    if (autoForge.active) return;
    showDecisionModal(item);
}

// ===== Item Detail Modal =====

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

// ===== Aggregate update =====

export function updateUI() {
    updateStats();
    updateEquipmentSlots();
    updateForgeInfo();
}

// Re-render translatable UI when locale changes
gameEvents.on(EVENTS.LOCALE_CHANGED, () => { updateEquipmentSlots(); });
