import {
    EQUIPMENT_TYPES, EQUIPMENT_ICONS, BASE_HEALTH, BASE_DAMAGE,
    BONUS_STATS, BONUS_STAT_KEYS, TIERS, FORGE_LEVELS, MAX_FORGE_LEVEL,
    AUTO_FORGE_INTERVAL
} from '../config.js';
import {
    getEquipment, getEquipmentByType, getGold, getForgedItem,
    equipItem, sellForgedItem, getSellValue, getForgeLevel,
    getForgeUpgradeCost, startForgeUpgrade, getForgeUpgradeStatus,
    getForgeUpgradeState, speedUpForgeUpgrade, checkForgeUpgradeComplete,
    getPlayerLevel, getPlayerXP, getXPToNextLevel,
    getStudyValue, addEssence, setForgedItem, getTechLevel, getTechEffect,
    addGold, saveGame, getProfileEmoji,
} from '../state.js';
import { calculateStats, calculatePowerScore, forgeEquipment } from '../forge.js';
import { gameEvents, EVENTS } from '../events.js';
import { createElement, formatNumber, formatCompact, formatTime, capitalizeFirst, buildItemCard, showToast } from './helpers.js';
import { renderProfileContent } from './profile-ui.js';

let forgeTimerInterval = null;
let decisionModalCallback = null;

// --- Auto-forge state ---
const autoForge = {
    active: false,
    selectedTiers: new Set(),
    timer: null,
    stopping: false,
    autoStudy: false,  // if true, rejected items are studied (essence) instead of sold (gold)
};

// ===== Toast Notifications =====

export function showForgeToast(item) {
    const tierDef = TIERS[(item.tier || 1) - 1];
    const icon = EQUIPMENT_ICONS[item.type] || '';
    showToast(`${icon} ${tierDef.name} ${capitalizeFirst(item.type)} forged!`, 'forge');
}

export function showSellToast({ item, goldEarned }) {
    showToast(`+${formatNumber(goldEarned)}g`, 'sell');
}

export function showStudyToast(essenceEarned) {
    showToast(`+${formatNumber(essenceEarned)} 🔮`, 'study');
}

/** Study (dismantle) any item for essence, applying tech bonuses */
function studyItem(item) {
    let essenceEarned = getStudyValue(item);
    const studyBonus = getTechEffect('essenceStudy'); // +2% per level
    essenceEarned = Math.floor(essenceEarned * (1 + studyBonus / 100));

    // Double Harvest: chance to also get gold
    const doubleChance = getTechEffect('doubleHarvest');
    if (doubleChance > 0 && Math.random() * 100 < doubleChance) {
        const goldBonus = getTechEffect('goldRush');
        const goldValue = Math.floor(getSellValue(item) * (1 + goldBonus / 100));
        addGold(goldValue);
        showToast(`🎰 Double! +${formatNumber(goldValue)}g`, 'sell');
    }

    addEssence(essenceEarned);
    showStudyToast(essenceEarned);
    return essenceEarned;
}

/** Study (dismantle) the currently forged item for essence instead of gold */
export function studyForgedItem() {
    const item = getForgedItem();
    if (!item) return 0;

    const essenceEarned = studyItem(item);
    setForgedItem(null);
    saveGame();
    return essenceEarned;
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

    const headerLevel = document.getElementById('header-level-value');
    if (headerLevel) headerLevel.textContent = getPlayerLevel();

    // Update header XP bar
    const xpFill = document.getElementById('header-xp-fill');
    if (xpFill) {
        const xpNeeded = getXPToNextLevel();
        const xpCurrent = getPlayerXP();
        const pct = xpNeeded > 0 ? Math.min(100, (xpCurrent / xpNeeded) * 100) : 100;
        xpFill.style.width = `${pct}%`;
    }

    document.getElementById('gold-amount').textContent = formatCompact(getGold());

    // Update avatar in header
    const profileBtn = document.getElementById('profile-btn');
    if (profileBtn) profileBtn.textContent = getProfileEmoji();

    const profileModal = document.getElementById('profile-modal');
    if (profileModal && profileModal.classList.contains('active')) {
        renderProfileContent();
    }
}

export function getCachedStats() {
    return cachedStats;
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

// ===== Forge Level Button =====

export function updateForgeInfo() {
    const forgeLevel = getForgeLevel();
    const forgeLevelEl = document.getElementById('forge-level');
    if (forgeLevelEl) forgeLevelEl.textContent = forgeLevel;

    const btn = document.getElementById('forge-upgrade-btn');
    if (btn) {
        const upgradeState = getForgeUpgradeState();
        btn.classList.toggle('upgrading', !!upgradeState);
    }

    const modal = document.getElementById('forge-upgrade-modal');
    if (modal && modal.classList.contains('active')) {
        renderForgeUpgradeContent();
    }
}

// ===== Forge Upgrade Modal =====

function buildSideBySideChances(currentChances, nextChances) {
    const table = createElement('div', 'forge-chances-compare');

    const header = createElement('div', 'forge-compare-row forge-compare-header');
    header.append(
        createElement('span', 'forge-compare-cell forge-compare-name', 'Tier'),
        createElement('span', 'forge-compare-cell forge-compare-cur', 'Current'),
        createElement('span', 'forge-compare-cell forge-compare-arrow', ''),
        createElement('span', 'forge-compare-cell forge-compare-next', 'Next')
    );
    table.appendChild(header);

    TIERS.forEach((tier, i) => {
        if (currentChances[i] <= 0 && (!nextChances || !nextChances[i] || nextChances[i] <= 0)) return;
        const row = createElement('div', 'forge-compare-row');

        const name = createElement('span', 'forge-compare-cell forge-compare-name', tier.name);
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
        speedUpBtn.textContent = `\u26A1 ${formatNumber(status.speedUpCost)}g`;
        const canAfford = getGold() >= status.speedUpCost;
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

    const levelDisplay = createElement('div', 'forge-level-display', `Level ${forgeLevel}`);
    info.appendChild(levelDisplay);

    const nextChances = !isMaxLevel ? FORGE_LEVELS[forgeLevel].chances : null;
    info.appendChild(buildSideBySideChances(currentChances, nextChances));

    if (isMaxLevel) {
        info.appendChild(createElement('div', 'forge-section-max', 'Max level reached!'));
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
            `\u2B06\uFE0F Upgrade (${formatNumber(cost)}g \u00B7 ${formatTime(time)})`);
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
    const modal = document.getElementById('decision-modal');
    const itemInfo = document.getElementById('forged-item-info');

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
            topItem ? '⚔️ Équipé' : `${EQUIPMENT_ICONS[slotType]} Emplacement vide`);
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
            emptyDiv.textContent = 'Aucun équipement dans cet emplacement';
            topSection.appendChild(emptyDiv);
        }

        itemInfo.appendChild(topSection);

        // === BOTTOM SECTION: Action Item ===
        const bottomSection = createElement('div', 'decision-section decision-bottom');

        const bottomLabel = createElement('div', 'decision-label decision-label-new',
            hasSwapped ? '📦 Ancien' : '✨ Nouveau');
        bottomSection.appendChild(bottomLabel);

        const bottomCard = createElement('div', 'decision-card');
        bottomCard.appendChild(buildItemCard(bottomItem, topItem));
        bottomSection.appendChild(bottomCard);

        // === ACTIONS ===
        const actionsContainer = createElement('div', 'decision-actions');

        // Equip button (visually separated from sell/study)
        const powerDiff = calculateEquipPowerDiff(bottomItem);
        const sign = powerDiff >= 0 ? '+' : '-';
        const equipLabel = `🔄 Équiper (${sign}${formatCompact(Math.abs(powerDiff))} ⚡)`;
        const equipBtn = createElement('button', 'btn decision-btn-equip', equipLabel);
        if (powerDiff > 0) equipBtn.classList.add('equip-upgrade');
        if (powerDiff < 0) equipBtn.classList.add('equip-downgrade');
        equipBtn.addEventListener('click', handleEquip);
        actionsContainer.appendChild(equipBtn);

        // Separator
        const separator = createElement('div', 'decision-separator');
        actionsContainer.appendChild(separator);

        // Sell & Study buttons (grouped together)
        const disposeGroup = createElement('div', 'decision-dispose-group');

        const sellValue = getSellValue(bottomItem);
        const sellBtn = createElement('button', 'btn decision-btn-sell',
            `💰 Vendre · ${formatNumber(sellValue)}g`);
        sellBtn.addEventListener('click', handleSell);

        const baseStudyValue = getStudyValue(bottomItem);
        const studyBonus = getTechEffect('essenceStudy');
        const effectiveStudyValue = Math.floor(baseStudyValue * (1 + studyBonus / 100));
        const studyBtn = createElement('button', 'btn decision-btn-study',
            `🔮 Étudier · ${formatNumber(effectiveStudyValue)}`);
        studyBtn.addEventListener('click', handleStudy);

        disposeGroup.append(sellBtn, studyBtn);
        actionsContainer.appendChild(disposeGroup);

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

    function handleStudy() {
        studyItem(bottomItem);
        setForgedItem(null);
        saveGame();
        hideDecisionModal();
    }

    function showSellConfirmation() {
        // Remove existing overlay if any
        const existing = modal.querySelector('.decision-confirm-overlay');
        if (existing) existing.remove();

        const overlay = createElement('div', 'decision-confirm-overlay');
        const box = createElement('div', 'decision-confirm-box');

        const title = createElement('div', 'decision-confirm-title', '⚠️ Confirmer la vente');
        const msg = createElement('div', 'decision-confirm-msg',
            'Cet item a un tier supérieur à celui équipé. Êtes-vous sûr de vouloir le vendre ?');

        const btns = createElement('div', 'decision-confirm-btns');
        const cancelBtn = createElement('button', 'btn decision-confirm-cancel', 'Annuler');
        cancelBtn.addEventListener('click', () => overlay.remove());
        const confirmBtn = createElement('button', 'btn decision-confirm-yes', 'Confirmer la vente');
        confirmBtn.addEventListener('click', () => { overlay.remove(); doSell(); });

        btns.append(cancelBtn, confirmBtn);
        box.append(title, msg, btns);
        overlay.appendChild(box);

        modal.querySelector('.modal-content').appendChild(overlay);
    }
}

export function hideDecisionModal() {
    document.getElementById('decision-modal').classList.remove('active');
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

function doOneAutoForge() {
    if (autoForge.stopping || !autoForge.active) { cleanupAutoForge(); return; }
    const item = forgeEquipment();

    if (autoForge.selectedTiers.has(item.tier)) {
        showDecisionModal(item, () => { scheduleNextAutoForge(); });
    } else {
        if (autoForge.autoStudy) {
            studyForgedItem();
        } else {
            sellForgedItem();
        }
        scheduleNextAutoForge();
    }
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

    const hasAutoStudyTech = getTechLevel('autoStudy') >= 1;
    const desc = hasAutoStudyTech
        ? 'Select tiers to keep. Others will be auto-sold or auto-studied.'
        : 'Select tiers to keep. Other items will be auto-sold.';
    info.appendChild(createElement('div', 'auto-forge-desc', desc));

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

        const label = createElement('span', 'auto-forge-tier-name', `${tier.name} (${chances[i]}%)`);
        label.style.color = tier.color;

        row.append(checkbox, label);
        tierList.appendChild(row);
    });

    info.appendChild(tierList);

    // Auto-study toggle (only visible with autoStudy tech)
    if (hasAutoStudyTech) {
        const studyRow = createElement('label', 'auto-forge-study-row');
        const studyCheck = document.createElement('input');
        studyCheck.type = 'checkbox';
        studyCheck.className = 'auto-forge-checkbox';
        studyCheck.id = 'auto-study-toggle';
        studyCheck.checked = autoForge.autoStudy;
        const studyLabel = createElement('span', 'auto-forge-study-label', '🔮 Auto-study (essence au lieu d\'or)');
        studyRow.append(studyCheck, studyLabel);
        info.appendChild(studyRow);
    }

    const startBtn = createElement('button', 'btn btn-start-auto', '\u25B6 Start Auto Forge');
    startBtn.addEventListener('click', () => {
        const selected = new Set();
        tierList.querySelectorAll('.auto-forge-checkbox:checked').forEach(cb => {
            selected.add(Number(cb.dataset.tier));
        });
        if (selected.size === 0) return;
        autoForge.selectedTiers = selected;
        autoForge.active = true;
        autoForge.stopping = false;
        const studyToggle = document.getElementById('auto-study-toggle');
        autoForge.autoStudy = studyToggle ? studyToggle.checked : false;
        hideAutoForgeModal();
        updateAutoForgeButton();
        scheduleNextAutoForge();
    });
    info.appendChild(startBtn);

    document.getElementById('auto-forge-modal').classList.add('active');
}

function hideAutoForgeModal() {
    document.getElementById('auto-forge-modal').classList.remove('active');
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
