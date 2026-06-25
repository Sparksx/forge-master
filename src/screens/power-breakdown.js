// Power breakdown modal — opened by tapping the Power pill in the header.
// Demystifies the Power score: shows every stat (base from level + gear) in a
// table and walks through the exact formula that produces the total.
import { h, fmt, openModal } from './components.js';
import { getPowerBreakdown } from '../game/state.js';

/** Format a stat value: flat numbers get fmt(), % bonuses keep their unit. */
function statValue(value, unit, { zeroDash = false } = {}) {
    if (zeroDash && !value) return '—';
    return unit === '%' ? `${value}%` : fmt(value);
}

function statRow(row) {
    return h('tr', { className: 'pwr-row' },
        h('td', { className: 'pwr-stat' },
            h('span', { className: 'pwr-stat-icon', text: row.icon }),
            h('span', { text: row.label }),
        ),
        h('td', { className: 'pwr-num pwr-muted', text: statValue(row.base, row.unit, { zeroDash: true }) }),
        h('td', { className: 'pwr-num pwr-gear', text: statValue(row.gear, row.unit, { zeroDash: true }) }),
        h('td', { className: 'pwr-num pwr-total', text: statValue(row.total, row.unit) }),
    );
}

/** One line of the formula walkthrough. */
function calcRow(label, value, { strong = false, note = null } = {}) {
    return h('div', { className: `pwr-calc-row${strong ? ' strong' : ''}` },
        h('div', { className: 'pwr-calc-label' },
            h('span', { text: label }),
            note ? h('span', { className: 'pwr-calc-note', text: note }) : null,
        ),
        h('span', { className: 'pwr-calc-val', text: value }),
    );
}

export function buildPowerBreakdown() {
    const b = getPowerBreakdown();
    const hasClan = b.statBonusPct > 0;

    const table = h('table', { className: 'pwr-table' },
        h('thead', {},
            h('tr', {},
                h('th', { text: 'Stat' }),
                h('th', { className: 'pwr-num', text: 'Base' }),
                h('th', { className: 'pwr-num', text: 'Gear' }),
                h('th', { className: 'pwr-num', text: 'Total' }),
            ),
        ),
        h('tbody', {}, ...b.rows.map(statRow)),
    );

    const calc = h('div', { className: 'pwr-calc' },
        calcRow(`Base stats (Level ${b.playerLevel})`, `+${fmt(b.baseHealth + b.baseDamage)}`,
            { note: `❤️ ${fmt(b.baseHealth)} HP · ⚔️ ${fmt(b.baseDamage)} Dmg` }),
        calcRow('Gear health × bonuses', `+${fmt(b.effectiveHealth)}`,
            { note: `${fmt(b.gearHealth)} × ${b.healthMult.toFixed(2)}` }),
        calcRow('Gear damage × bonuses', `+${fmt(b.effectiveDamage)}`,
            { note: `${fmt(b.gearDamage)} × ${b.damageMult.toFixed(2)}` }),
        calcRow('Subtotal', fmt(b.subtotal)),
        hasClan
            ? calcRow('Clan stat perk', `× ${b.clanMult.toFixed(2)}`, { note: `+${b.statBonusPct}%` })
            : null,
        calcRow('Total Power', `💪 ${fmt(b.total)}`, { strong: true }),
    );

    return h('div', { className: 'pwr-breakdown' },
        h('h3', { text: 'Power Breakdown' }),
        h('div', { className: 'pwr-hero' },
            h('span', { className: 'pwr-hero-num', text: fmt(b.total) }),
            h('span', { className: 'pwr-hero-label', text: 'Total Power' }),
        ),
        h('p', { className: 'pwr-intro muted', text:
            'Power blends your effective Health and Damage. Health bonuses (Health Multi, '
            + 'Regen, Life Steal) scale your Health; Damage bonuses (Damage Multi, Attack Speed, '
            + 'Crit) scale your Damage. Your level adds flat base stats, then your clan perk '
            + 'scales the whole total.' }),
        h('div', { className: 'pwr-section-label muted', text: 'Your Stats' }),
        table,
        h('div', { className: 'pwr-section-label muted', text: 'How it adds up' }),
        calc,
    );
}

/** Open the Power breakdown as a modal. */
export function openPowerBreakdown() {
    return openModal(buildPowerBreakdown());
}
