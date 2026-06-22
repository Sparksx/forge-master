// Shared item rendering: cards, bonus lists, and power-delta math.
import { h, fmt } from './components.js';
import { itemName, rarityName, rarityColor, slotIcon, slotLabel, bonusLabel } from '../game/items.js';
import { calculateStats, calculatePowerScore, HEALTH_ITEMS } from '../game/config.js';
import { getEquipment } from '../game/state.js';

export function statTypeLabel(item) {
    return HEALTH_ITEMS.includes(item.type) ? 'Health' : 'Damage';
}

/** Power score if `item` were equipped in its slot (vs current equipment). */
export function powerDelta(item) {
    const current = getEquipment();
    const curPower = calculatePowerScore(...statsTuple(current));
    const next = { ...current, [item.type]: item };
    const nextPower = calculatePowerScore(...statsTuple(next));
    return { current: curPower, next: nextPower, delta: nextPower - curPower };
}

function statsTuple(equipment) {
    const { totalHealth, totalDamage, bonuses } = calculateStats(equipment);
    return [totalHealth, totalDamage, bonuses];
}

export function renderBonusList(bonuses) {
    if (!bonuses || bonuses.length === 0) return null;
    return h('div', { className: 'bonus-list' },
        ...bonuses.map((b) => h('span', { className: 'bonus-chip', text: bonusLabel(b) })),
    );
}

/** A full item card with rarity colour, stat, and bonuses. */
export function renderItemCard(item, { showSlot = true } = {}) {
    const color = rarityColor(item.tier);
    return h('div', { className: 'item-card', style: { '--rarity': color } },
        h('div', { className: 'item-card-head' },
            h('div', { className: 'item-icon', text: slotIcon(item.type) }),
            h('div', { className: 'item-titles' },
                h('div', { className: 'item-name', text: itemName(item) }),
                h('div', { className: 'item-sub' },
                    h('span', { className: 'rarity-tag', style: { color }, text: rarityName(item.tier) }),
                    showSlot ? h('span', { className: 'slot-tag', text: ` · ${slotLabel(item.type)} · Lv ${item.level}` }) : null,
                ),
            ),
        ),
        h('div', { className: 'item-stat' },
            h('span', { className: 'stat-num', text: `+${fmt(item.stats)}` }),
            h('span', { className: 'stat-label', text: statTypeLabel(item) }),
        ),
        renderBonusList(item.bonuses),
    );
}

/** A coloured ▲/▼ power-delta badge. */
export function renderDeltaBadge(delta) {
    const cls = delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : 'delta-flat';
    const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '–';
    return h('span', { className: `delta-badge ${cls}`, text: `${arrow} ${fmt(Math.abs(delta))} Power` });
}
