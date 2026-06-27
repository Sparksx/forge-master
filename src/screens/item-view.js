// Shared item rendering: cards, bonus lists, and power-delta math.
import { h, fmt } from './components.js';
import { itemName, rarityName, rarityColor, itemIcon, slotLabel, bonusLabel } from '../game/items.js';
import { calculateStats, calculatePowerScore, HEALTH_ITEMS, weaponStyle, BONUS_STATS, BONUS_STAT_KEYS } from '../game/config.js';
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
            h('div', { className: 'item-icon', text: itemIcon(item) }),
            h('div', { className: 'item-titles' },
                h('div', { className: 'item-name', text: itemName(item) }),
                h('div', { className: 'item-sub' },
                    h('span', { className: 'rarity-tag', style: { color }, text: rarityName(item.tier) }),
                    showSlot ? h('span', { className: 'slot-tag', text: ` · ${slotLabel(item.type)} · Lv ${item.level}` }) : null,
                    item.type === 'weapon'
                        ? h('span', { className: 'slot-tag', text: ` · ${weaponStyle(item) === 'ranged' ? '🏹 Ranged' : '⚔️ Melee'}` })
                        : null,
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

/** Collapse an item's bonus array into a {type: value} map (summing dupes). */
function bonusMap(item) {
    const map = {};
    if (item?.bonuses && Array.isArray(item.bonuses)) {
        item.bonuses.forEach((b) => {
            if (b && b.type && typeof b.value === 'number') map[b.type] = (map[b.type] || 0) + b.value;
        });
    }
    return map;
}

/**
 * A full stat-by-stat comparison between the currently equipped item and a new
 * one (e.g. a fresh forge). Lists the main stat plus every bonus present on
 * either item, with the new column coloured ▲/▼ against the equipped value so
 * the player can weigh more than just the level.
 */
export function renderItemComparison(newItem, equipped) {
    const isHealth = HEALTH_ITEMS.includes(newItem.type);
    const curBonus = bonusMap(equipped);
    const newBonus = bonusMap(newItem);

    // Main stat first (same slot → same Health/Damage type on both items), then
    // every bonus stat that appears on either item, in canonical order.
    const rows = [{
        icon: isHealth ? '❤️' : '⚔️',
        label: isHealth ? 'Health' : 'Damage',
        unit: '',
        cur: equipped ? equipped.stats : 0,
        next: newItem.stats,
    }];
    BONUS_STAT_KEYS.forEach((key) => {
        const cur = curBonus[key] || 0;
        const next = newBonus[key] || 0;
        if (cur === 0 && next === 0) return; // neither item has it — skip
        const def = BONUS_STATS[key];
        rows.push({ icon: def.icon, label: def.label, unit: def.unit, cur, next });
    });

    const cell = (value, unit) => (value ? `${fmt(value)}${unit}` : '—');

    return h('div', { className: 'stat-compare' },
        h('div', { className: 'stat-compare-row stat-compare-head' },
            h('span', { className: 'sc-label', text: 'Stat' }),
            h('span', { className: 'sc-col', text: equipped ? `Equipped · Lv ${equipped.level}` : 'Equipped' }),
            h('span', { className: 'sc-col sc-new', text: `New · Lv ${newItem.level}` }),
        ),
        ...rows.map((r) => {
            const delta = r.next - r.cur;
            const cls = delta > 0 ? 'sc-up' : delta < 0 ? 'sc-down' : 'sc-flat';
            return h('div', { className: 'stat-compare-row' },
                h('span', { className: 'sc-label', text: `${r.icon} ${r.label}` }),
                h('span', { className: 'sc-col', text: cell(r.cur, r.unit) }),
                h('span', { className: `sc-col sc-new ${cls}` },
                    h('span', { className: 'sc-val', text: cell(r.next, r.unit) }),
                    delta !== 0
                        ? h('span', { className: 'sc-delta', text: `${delta > 0 ? '▲' : '▼'}${fmt(Math.abs(delta))}${r.unit}` })
                        : null,
                ),
            );
        }),
    );
}

/** A coloured ▲/▼ power-delta badge. */
export function renderDeltaBadge(delta) {
    const cls = delta > 0 ? 'delta-up' : delta < 0 ? 'delta-down' : 'delta-flat';
    const arrow = delta > 0 ? '▲' : delta < 0 ? '▼' : '–';
    return h('span', { className: `delta-badge ${cls}`, text: `${arrow} ${fmt(Math.abs(delta))} Power` });
}
