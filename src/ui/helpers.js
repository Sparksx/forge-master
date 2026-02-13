import { BONUS_STATS, TIERS, EQUIPMENT_ICONS } from '../config.js';

export function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export function createElement(tag, className, textContent) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (textContent !== undefined) el.textContent = textContent;
    return el;
}

export function formatNumber(n) {
    return n.toLocaleString('en-US');
}

export function formatCompact(n) {
    if (n < 1000) return String(n);
    if (n < 1_000_000) {
        const k = n / 1000;
        return k >= 100 ? `${Math.floor(k)}k` : `${+k.toFixed(1)}k`;
    }
    if (n < 1_000_000_000) {
        const m = n / 1_000_000;
        return m >= 100 ? `${Math.floor(m)}M` : `${+m.toFixed(1)}M`;
    }
    const b = n / 1_000_000_000;
    return b >= 100 ? `${Math.floor(b)}B` : `${+b.toFixed(1)}B`;
}

export function formatTime(seconds) {
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

export function buildBonusLines(item, compareWith) {
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

export function buildItemCard(item, compareWith) {
    const fragment = document.createDocumentFragment();
    const tierDef = TIERS[(item.tier || 1) - 1];

    const tierDiv = createElement('div', 'forged-tier', tierDef.name);
    tierDiv.style.color = tierDef.color;

    // Show the template name if available, otherwise fall back to generic type
    const displayName = item.name || `${EQUIPMENT_ICONS[item.type]} ${capitalizeFirst(item.type)}`;
    const typeDiv = createElement('div', 'forged-type', displayName);
    const levelDiv = createElement('div', 'forged-level', `Level ${item.level}`);
    const statLabel = item.statType === 'health' ? '\u2764\uFE0F Health' : '\u2694\uFE0F Damage';
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

export function showToast(message, type = 'forge', duration = 1500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = createElement('div', `toast toast-${type}`, message);
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('toast-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, duration);
}

// ===== Gold Drip Animation =====

const DRAIN_DELAY = 1000; // ms to show total before draining

const goldAnim = {
    displayed: 0,
    target: 0,
    pending: 0,
    pendingEl: null,
    timer: null,
    delayTimer: null,
};

function ensureGoldPendingEl() {
    if (goldAnim.pendingEl) return goldAnim.pendingEl;
    const display = document.getElementById('gold-display');
    if (!display) return null;
    const el = createElement('span', 'currency-pending gold-pending');
    el.id = 'gold-pending';
    display.appendChild(el);
    goldAnim.pendingEl = el;
    return el;
}

/**
 * Animate gold display toward the actual gold amount.
 * Call this instead of directly setting the gold text.
 * @param {number} actual - The real gold amount (getGold())
 */
export function animateGoldToward(actual) {
    const amountEl = document.getElementById('gold-amount');
    if (!amountEl) return;

    if (actual > goldAnim.target) {
        // Gold gained
        const diff = actual - goldAnim.target;
        goldAnim.pending += diff;
        goldAnim.target = actual;
        startGoldDrain(amountEl);
    } else if (actual < goldAnim.displayed) {
        // Gold spent — snap immediately
        goldAnim.target = actual;
        goldAnim.displayed = actual;
        goldAnim.pending = Math.max(0, goldAnim.target - goldAnim.displayed);
        amountEl.textContent = formatCompact(actual);
        updatePendingDisplay(goldAnim, ensureGoldPendingEl());
    } else {
        goldAnim.target = actual;
    }
}

function startGoldDrain(amountEl) {
    const pendingEl = ensureGoldPendingEl();
    if (!pendingEl) return;
    updatePendingDisplay(goldAnim, pendingEl);

    if (goldAnim.timer) return; // drain already running, just accumulate

    // Reset delay so new gains extend the pause (lets total accumulate)
    if (goldAnim.delayTimer) clearTimeout(goldAnim.delayTimer);
    goldAnim.delayTimer = setTimeout(() => {
        goldAnim.delayTimer = null;
        goldAnim.timer = setInterval(() => {
            if (goldAnim.pending <= 0) {
                clearInterval(goldAnim.timer);
                goldAnim.timer = null;
                if (pendingEl) pendingEl.classList.remove('active');
                return;
            }
            // Transfer rate: finish in ~1s regardless of amount
            const rate = Math.max(1, Math.ceil(goldAnim.pending / 20));
            const transfer = Math.min(rate, goldAnim.pending);
            goldAnim.pending -= transfer;
            goldAnim.displayed += transfer;
            amountEl.textContent = formatCompact(goldAnim.displayed);
            updatePendingDisplay(goldAnim, pendingEl);
        }, 50);
    }, DRAIN_DELAY);
}

/** Initialize the gold animation displayed value (on game load) */
export function initGoldAnimation(currentGold) {
    goldAnim.displayed = currentGold;
    goldAnim.target = currentGold;
    goldAnim.pending = 0;
}

// ===== Essence Gain Animation =====

const essenceAnim = {
    pending: 0,
    pendingEl: null,
    fadeTimer: null,
};

function ensureEssencePendingEl() {
    if (essenceAnim.pendingEl) return essenceAnim.pendingEl;
    const display = document.getElementById('tech-essence-display');
    if (!display) return null;
    const el = createElement('span', 'currency-pending essence-pending');
    el.id = 'essence-pending';
    display.appendChild(el);
    essenceAnim.pendingEl = el;
    return el;
}

/**
 * Show essence gain animation (accumulates, then fades).
 * @param {number} amount - Essence gained
 */
export function showEssenceGain(amount) {
    if (amount <= 0) return;
    essenceAnim.pending += amount;
    const el = ensureEssencePendingEl();
    if (!el) return;

    el.textContent = `+${formatCompact(essenceAnim.pending)}`;
    el.classList.add('active');

    // Reset fade timer — wait long enough to see the accumulated total
    if (essenceAnim.fadeTimer) clearTimeout(essenceAnim.fadeTimer);
    essenceAnim.fadeTimer = setTimeout(() => {
        el.classList.remove('active');
        essenceAnim.pending = 0;
    }, 2500);
}

// ===== Shared pending display helper =====

function updatePendingDisplay(anim, el) {
    if (!el) return;
    if (anim.pending > 0) {
        el.textContent = `+${formatCompact(anim.pending)}`;
        el.classList.add('active');
    } else {
        el.classList.remove('active');
    }
}
