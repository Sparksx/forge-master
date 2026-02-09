import {
    EQUIPMENT_TYPES, EQUIPMENT_ICONS, BASE_HEALTH, BASE_DAMAGE,
    BONUS_STATS, BONUS_STAT_KEYS, TIERS, FORGE_LEVELS, MAX_FORGE_LEVEL,
    AUTO_FORGE_INTERVAL
} from './config.js';
import {
    getEquipment, getEquipmentByType, getGold, getForgedItem,
    equipItem, sellForgedItem, getSellValue, getForgeLevel,
    getForgeUpgradeCost, startForgeUpgrade, getForgeUpgradeStatus,
    getForgeUpgradeState, speedUpForgeUpgrade, checkForgeUpgradeComplete,
    getCombatProgress
} from './state.js';
import { calculateStats, calculatePowerScore, forgeEquipment } from './forge.js';
import { getPlayerCombatState, getMonsterCombatState, getAllMonsters, getCurrentMonsterIndex, getMonsterProgress } from './combat.js';
import { getWaveLabel, WAVE_COUNT, SUB_WAVE_COUNT } from './monsters.js';

let forgeTimerInterval = null;
let decisionModalCallback = null;

// --- Auto-forge state ---
const autoForge = {
    active: false,
    selectedTiers: new Set(),
    timer: null,
    stopping: false,
};

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
    return n.toLocaleString('en-US');
}

function formatTime(seconds) {
    if (seconds <= 0) return '0s';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (d > 0) return h > 0 ? `${d}d ${h}h` : `${d}d`;
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
    return `${s}s`;
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

// ===== Toast Notifications =====

function showToast(message, type = 'forge', duration = 1500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = createElement('div', `toast toast-${type}`, message);
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, duration);
}

export function showForgeToast(item) {
    const tierDef = TIERS[(item.tier || 1) - 1];
    const icon = EQUIPMENT_ICONS[item.type] || '';
    showToast(`${icon} ${tierDef.name} ${capitalizeFirst(item.type)} forged!`, 'forge');
}

export function showSellToast({ item, goldEarned }) {
    showToast(`+${formatNumber(goldEarned)}g`, 'sell');
}

// ===== Stats & Equipment =====

// Cached stats for profile modal
let cachedStats = { health: 0, damage: 0, bonuses: {}, power: 0 };

export function updateStats() {
    const equipment = getEquipment();
    const { totalHealth, totalDamage, bonuses } = calculateStats(equipment);

    const health = BASE_HEALTH + totalHealth;
    const damage = BASE_DAMAGE + totalDamage;
    const power = calculatePowerScore(health, damage, bonuses);

    // Cache stats for profile modal
    cachedStats = { health, damage, bonuses, power };

    // Update header power display
    const headerPower = document.getElementById('header-power-value');
    if (headerPower) headerPower.textContent = formatNumber(power);

    // Update gold
    document.getElementById('gold-amount').textContent = formatNumber(getGold());

    // Update profile modal if open
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

    // Update upgrading visual state on the button
    const btn = document.getElementById('forge-upgrade-btn');
    if (btn) {
        const upgradeState = getForgeUpgradeState();
        btn.classList.toggle('upgrading', !!upgradeState);
    }

    // Refresh the modal content if it's currently open
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
                arrowCell.textContent = '▲';
                arrowCell.classList.add('stat-better');
            } else if (nextChances[i] < currentChances[i]) {
                nextPct.classList.add('stat-worse');
                arrowCell.textContent = '▼';
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
        if (!upgradeState) {
            stopForgeTimer();
            return;
        }
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
        speedUpBtn.textContent = `⚡ ${formatNumber(status.speedUpCost)}g`;
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
        const maxDiv = createElement('div', 'forge-section-max', 'Max level reached!');
        info.appendChild(maxDiv);
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
        speedUpBtn.addEventListener('click', () => {
            speedUpForgeUpgrade();
        });
        timerSection.appendChild(speedUpBtn);

        info.appendChild(timerSection);

        updateForgeTimerDisplay();
        startForgeTimer();
    } else {
        const cost = getForgeUpgradeCost();
        const time = FORGE_LEVELS[forgeLevel].time;
        const upgradeBtn = createElement('button', 'btn btn-upgrade-forge',
            `⬆️ Upgrade (${formatNumber(cost)}g · ${formatTime(time)})`);
        upgradeBtn.id = 'upgrade-forge-btn';
        const canAfford = getGold() >= cost;
        upgradeBtn.disabled = !canAfford;
        upgradeBtn.classList.toggle('btn-disabled', !canAfford);
        upgradeBtn.addEventListener('click', () => {
            startForgeUpgrade();
        });
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

    const currentItem = getEquipmentByType(item.type);
    itemInfo.textContent = '';

    if (currentItem) {
        const instruction = createElement('div', 'choice-instruction', 'Choose the equipment to keep');
        itemInfo.appendChild(instruction);

        const container = createElement('div', 'comparison-container');

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

function scheduleNextAutoForge() {
    if (autoForge.stopping || !autoForge.active) {
        cleanupAutoForge();
        return;
    }
    autoForge.timer = setTimeout(() => {
        doOneAutoForge();
    }, AUTO_FORGE_INTERVAL);
}

function doOneAutoForge() {
    if (autoForge.stopping || !autoForge.active) {
        cleanupAutoForge();
        return;
    }
    // Forge a new item (this sets forgedItem in state)
    const item = forgeEquipment();

    if (autoForge.selectedTiers.has(item.tier)) {
        // Tier is selected: show decision modal, pause auto-forge
        showDecisionModal(item, () => {
            // After decision, continue auto-forge
            scheduleNextAutoForge();
        });
    } else {
        // Tier not selected: auto-sell and continue
        sellForgedItem();
        scheduleNextAutoForge();
    }
}

function cleanupAutoForge() {
    autoForge.active = false;
    autoForge.stopping = false;
    if (autoForge.timer) {
        clearTimeout(autoForge.timer);
        autoForge.timer = null;
    }
    updateAutoForgeButton();
}

function updateAutoForgeButton() {
    const btn = document.getElementById('auto-action-btn');
    if (btn) {
        btn.classList.toggle('auto-active', autoForge.active);
    }
}

export function handleAutoForgeClick() {
    if (autoForge.active) {
        // Immediately stop auto-forge and cleanup
        cleanupAutoForge();
        return;
    }
    // Show auto-forge config modal
    showAutoForgeModal();
}

function showAutoForgeModal() {
    const info = document.getElementById('auto-forge-info');
    if (!info) return;
    info.textContent = '';

    const desc = createElement('div', 'auto-forge-desc',
        'Select tiers to keep. Other items will be auto-sold.');
    info.appendChild(desc);

    const tierList = createElement('div', 'auto-forge-tiers');

    // Get current forge level chances to know which tiers are available
    const forgeLevel = getForgeLevel();
    const chances = FORGE_LEVELS[forgeLevel - 1].chances;

    TIERS.forEach((tier, i) => {
        const row = createElement('label', 'auto-forge-tier-row');

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.className = 'auto-forge-checkbox';
        checkbox.dataset.tier = tier.id;
        // Pre-check tiers that have >0 chance and are uncommon+
        if (chances[i] > 0 && tier.id >= 2) {
            checkbox.checked = true;
        }
        // Disable tiers with 0% chance
        if (chances[i] <= 0) {
            checkbox.disabled = true;
            row.classList.add('auto-forge-tier-disabled');
        }

        const label = createElement('span', 'auto-forge-tier-name', `${tier.name} (${chances[i]}%)`);
        label.style.color = tier.color;

        row.append(checkbox, label);
        tierList.appendChild(row);
    });

    info.appendChild(tierList);

    const startBtn = createElement('button', 'btn btn-start-auto', '▶ Start Auto Forge');
    startBtn.addEventListener('click', () => {
        // Collect selected tiers
        const selected = new Set();
        tierList.querySelectorAll('.auto-forge-checkbox:checked').forEach(cb => {
            selected.add(Number(cb.dataset.tier));
        });
        if (selected.size === 0) return;

        autoForge.selectedTiers = selected;
        autoForge.active = true;
        autoForge.stopping = false;

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

// ===== Handling ITEM_FORGED event =====

export function handleItemForged(item) {
    // During auto-forge, the auto-forge system handles items directly
    // via doOneAutoForge(). The event should not trigger the modal again.
    if (autoForge.active) return;
    showDecisionModal(item);
}

// ===== Misc =====

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

// ===== Combat UI =====

let renderedMonsterCount = 0; // tracks how many monster rows are in the DOM

/**
 * Build (or rebuild) the monster-side DOM to match the current wave's monsters.
 * Called on COMBAT_START when a new sub-wave begins.
 */
export function renderMonsters(data) {
    if (!data) return;
    const { monsters, focusIndex } = data;
    const container = document.getElementById('monsters-side');
    if (!container) return;

    container.textContent = '';
    renderedMonsterCount = monsters.length;

    monsters.forEach((m, i) => {
        const row = createElement('div', `monster-row${i === focusIndex ? ' monster-focused' : ''}${m.currentHP <= 0 ? ' monster-dead' : ''}`);
        row.dataset.index = i;

        const emoji = createElement('div', 'monster-row-emoji', m.emoji);
        const info = createElement('div', 'monster-row-info');

        const name = createElement('div', 'monster-row-name', m.name);
        name.style.color = m.color;

        const hpContainer = createElement('div', 'hp-bar-container');
        const hpBar = createElement('div', 'hp-bar hp-bar-monster');
        hpBar.id = `monster-hp-bar-${i}`;
        const hpText = createElement('span', 'hp-text');
        hpText.id = `monster-hp-text-${i}`;
        hpContainer.append(hpBar, hpText);

        // Damage numbers container for this monster
        const dmgContainer = createElement('div', 'damage-numbers damage-numbers-monster');
        dmgContainer.id = `damage-numbers-monster-${i}`;

        info.append(name, hpContainer);
        row.append(emoji, info, dmgContainer);
        container.appendChild(row);
    });

    // Initial HP update
    updateAllMonstersHP(monsters, focusIndex);
}

/** Update focus highlight when player switches target. */
export function updateMonsterFocus(data) {
    if (!data) return;
    const { focusIndex, monsters } = data;
    const container = document.getElementById('monsters-side');
    if (!container) return;

    container.querySelectorAll('.monster-row').forEach((row, i) => {
        row.classList.toggle('monster-focused', i === focusIndex);
        row.classList.toggle('monster-dead', monsters[i].currentHP <= 0);
    });
}

export function updateCombatUI() {
    const player = getPlayerCombatState();
    const monsters = getAllMonsters();
    if (!player || monsters.length === 0) return;

    // Player HP bar
    const playerHPBar = document.getElementById('player-hp-bar');
    const playerHPText = document.getElementById('player-hp-text');
    if (playerHPBar && playerHPText) {
        const playerHPPct = Math.max(0, (player.currentHP / player.maxHP) * 100);
        playerHPBar.style.width = `${playerHPPct}%`;
        playerHPBar.className = `hp-bar hp-bar-player ${getHPColorClass(playerHPPct)}`;
        playerHPText.textContent = `${formatNumber(Math.ceil(player.currentHP))} / ${formatNumber(player.maxHP)}`;
    }

    // All monster HP bars
    updateAllMonstersHP(monsters, getCurrentMonsterIndex());
}

function updateAllMonstersHP(monsters, focusIndex) {
    monsters.forEach((m, i) => {
        const bar = document.getElementById(`monster-hp-bar-${i}`);
        const text = document.getElementById(`monster-hp-text-${i}`);
        if (!bar || !text) return;

        const pct = Math.max(0, (m.currentHP / m.maxHP) * 100);
        bar.style.width = `${pct}%`;
        bar.className = `hp-bar hp-bar-monster ${getHPColorClass(pct)}`;
        text.textContent = `${formatNumber(Math.max(0, Math.ceil(m.currentHP)))} / ${formatNumber(m.maxHP)}`;

        // Update dead state
        const row = bar.closest('.monster-row');
        if (row) {
            row.classList.toggle('monster-dead', m.currentHP <= 0);
            row.classList.toggle('monster-focused', i === focusIndex && m.currentHP > 0);
        }
    });
}

function getHPColorClass(pct) {
    if (pct > 60) return 'hp-high';
    if (pct > 30) return 'hp-mid';
    return 'hp-low';
}

export function updateCombatInfo(data) {
    if (!data) return;
    // renderMonsters handles the full UI setup
    renderMonsters(data);
    updateWaveDisplay();
}

export function updateWaveDisplay() {
    const { currentWave, currentSubWave } = getCombatProgress();
    const waveLabel = document.getElementById('wave-label');
    if (waveLabel) waveLabel.textContent = `Wave ${getWaveLabel(currentWave, currentSubWave)}`;

    const progressFill = document.getElementById('wave-progress-fill');
    if (progressFill) {
        const total = WAVE_COUNT * SUB_WAVE_COUNT;
        const current = (currentWave - 1) * SUB_WAVE_COUNT + currentSubWave;
        progressFill.style.width = `${(current / total) * 100}%`;
    }
}

/**
 * Show a floating damage number.
 * type: 'player' (red, near player), 'monster' (green, near focused monster), 'heal' (blue, near player)
 */
export function showDamageNumber(damage, type, isCrit, monsterIndex) {
    let container;

    if (type === 'monster') {
        // Damage dealt TO a monster → show near that monster
        const idx = monsterIndex !== undefined ? monsterIndex : getCurrentMonsterIndex();
        container = document.getElementById(`damage-numbers-monster-${idx}`);
    } else {
        // Damage taken by player or heal → show near player
        container = document.getElementById('damage-numbers-player');
    }
    if (!container) return;

    // Limit simultaneous numbers to reduce clutter
    if (container.children.length >= 4) {
        container.firstChild?.remove();
    }

    const dmgEl = createElement('div', `damage-number damage-${type}${isCrit ? ' damage-crit' : ''}`,
        `${type === 'heal' ? '+' : '-'}${formatNumber(damage)}`);

    // Random horizontal offset
    const offsetX = (Math.random() - 0.5) * 30;
    dmgEl.style.setProperty('--offset-x', `${offsetX}px`);
    // Random vertical start offset to prevent stacking
    const offsetY = Math.random() * -12;
    dmgEl.style.setProperty('--offset-y', `${offsetY}px`);

    container.appendChild(dmgEl);
    dmgEl.addEventListener('animationend', () => dmgEl.remove());
}

export function showCombatResult(text, type) {
    const el = document.getElementById('combat-result');
    if (!el) return;

    el.textContent = text;
    el.className = `combat-result combat-result-${type} combat-result-show`;

    setTimeout(() => {
        el.classList.remove('combat-result-show');
    }, 1200);
}

export function triggerAttackAnimation(side) {
    if (side === 'player') {
        const el = document.getElementById('combatant-player');
        if (!el) return;
        el.classList.add('attacking');
        setTimeout(() => el.classList.remove('attacking'), 300);
    } else {
        // Animate the focused monster row
        const idx = getCurrentMonsterIndex();
        const row = document.querySelector(`.monster-row[data-index="${idx}"]`);
        if (!row) return;
        row.classList.add('attacking');
        setTimeout(() => row.classList.remove('attacking'), 300);
    }
}

export function triggerHitAnimation(side) {
    if (side === 'player') {
        const el = document.getElementById('combatant-player');
        if (!el) return;
        el.classList.add('hit');
        setTimeout(() => el.classList.remove('hit'), 300);
    } else {
        // Shake the hit monster row
        const idx = getCurrentMonsterIndex();
        const row = document.querySelector(`.monster-row[data-index="${idx}"]`);
        if (!row) return;
        row.classList.add('hit');
        setTimeout(() => row.classList.remove('hit'), 300);
    }
}

/** Trigger hit shake on a specific monster by index */
export function triggerMonsterHitAnimation(monsterIndex) {
    const row = document.querySelector(`.monster-row[data-index="${monsterIndex}"]`);
    if (!row) return;
    row.classList.add('attacking');
    setTimeout(() => row.classList.remove('attacking'), 300);
}

export function showProfileModal(user, onLogout) {
    renderProfileContent(user, onLogout);
    document.getElementById('profile-modal').classList.add('active');
}

export function renderProfileContent(user, onLogout) {
    // Store last known user/logout for re-renders
    if (user) showProfileModal._user = user;
    if (onLogout) showProfileModal._onLogout = onLogout;
    const currentUser = user || showProfileModal._user;
    const currentLogout = onLogout || showProfileModal._onLogout;

    const info = document.getElementById('profile-info');
    if (!info) return;
    info.textContent = '';

    // Player info section
    if (currentUser) {
        const infoSection = createElement('div', 'profile-section');
        const infoTitle = createElement('div', 'profile-section-title', 'Account');
        infoSection.appendChild(infoTitle);

        const nameRow = createElement('div', 'profile-info-row');
        nameRow.append(
            createElement('span', 'profile-info-label', 'Username'),
            createElement('span', 'profile-info-value', currentUser.username || 'Unknown')
        );
        infoSection.appendChild(nameRow);

        if (currentUser.email) {
            const emailRow = createElement('div', 'profile-info-row');
            emailRow.append(
                createElement('span', 'profile-info-label', 'Email'),
                createElement('span', 'profile-info-value', currentUser.email)
            );
            infoSection.appendChild(emailRow);
        }

        info.appendChild(infoSection);
    }

    // Stats section
    const statsSection = createElement('div', 'profile-section');
    const statsTitle = createElement('div', 'profile-section-title', 'Stats');
    statsSection.appendChild(statsTitle);

    const statsGrid = createElement('div', 'profile-stats-grid');

    const powerCard = createElement('div', 'profile-stat-card');
    powerCard.append(
        createElement('span', 'profile-stat-icon', '🔥'),
        createElement('div', 'profile-stat-value', formatNumber(cachedStats.power)),
        createElement('div', 'profile-stat-label', 'Power')
    );

    const healthCard = createElement('div', 'profile-stat-card');
    healthCard.append(
        createElement('span', 'profile-stat-icon', '❤️'),
        createElement('div', 'profile-stat-value', formatNumber(cachedStats.health)),
        createElement('div', 'profile-stat-label', 'Health')
    );

    const damageCard = createElement('div', 'profile-stat-card');
    damageCard.append(
        createElement('span', 'profile-stat-icon', '⚔️'),
        createElement('div', 'profile-stat-value', formatNumber(cachedStats.damage)),
        createElement('div', 'profile-stat-label', 'Damage')
    );

    const forgeLvlCard = createElement('div', 'profile-stat-card');
    forgeLvlCard.append(
        createElement('span', 'profile-stat-icon', '⚒️'),
        createElement('div', 'profile-stat-value', String(getForgeLevel())),
        createElement('div', 'profile-stat-label', 'Forge Level')
    );

    statsGrid.append(powerCard, healthCard, damageCard, forgeLvlCard);
    statsSection.appendChild(statsGrid);
    info.appendChild(statsSection);

    // Bonus stats section
    const bonuses = cachedStats.bonuses || {};
    const hasAnyBonus = BONUS_STAT_KEYS.some(key => bonuses[key] > 0);
    if (hasAnyBonus) {
        const bonusSection = createElement('div', 'profile-section');
        const bonusTitle = createElement('div', 'profile-section-title', 'Bonuses');
        bonusSection.appendChild(bonusTitle);

        const bonusList = createElement('div', 'profile-bonus-list');
        BONUS_STAT_KEYS.forEach(key => {
            if (bonuses[key] <= 0) return;
            const cfg = BONUS_STATS[key];
            const tag = createElement('span', 'profile-bonus-tag', `${cfg.icon} ${cfg.label}: ${bonuses[key]}${cfg.unit}`);
            bonusList.appendChild(tag);
        });
        bonusSection.appendChild(bonusList);
        info.appendChild(bonusSection);
    }

    // Logout button
    if (currentLogout) {
        const logoutBtn = createElement('button', 'profile-logout-btn', 'Logout');
        logoutBtn.addEventListener('click', () => {
            document.getElementById('profile-modal').classList.remove('active');
            currentLogout();
        });
        info.appendChild(logoutBtn);
    }
}
