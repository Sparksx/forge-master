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

    const typeDiv = createElement('div', 'forged-type', `${EQUIPMENT_ICONS[item.type]} ${capitalizeFirst(item.type)}`);
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
