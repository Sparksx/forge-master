// Shared public-profile modal: a player's avatar, headline stats, their equipped
// gear (each item opens a stat preview) and a friendly-duel challenge. Used by the
// clan roster and the PvP leaderboard so ANY player can be inspected and duelled —
// not just clanmates.
import { h, fmt, openModal, closeModal } from './components.js';
import { EQUIPMENT_TYPES, avatarEmoji } from '../game/config.js';
import { slotIcon, itemIcon, slotLabel, rarityColor, itemName } from '../game/items.js';
import { renderItemCard } from './item-view.js';
import { FRAMES } from '../../shared/cosmetics.js';
import { getCurrentUser } from '../auth.js';
import { switchTab } from './app.js';
import { startFriendly } from './pvp.js';

// Only render frame classes we actually ship — guards against a tampered save
// injecting an arbitrary class name onto the avatar.
const VALID_FRAMES = new Set(FRAMES.map((f) => f.id));
const safeFrame = (id) => (VALID_FRAMES.has(id) ? id : 'none');

function statRow(label, value) {
    return h('div', { className: 'member-stat-row' },
        h('span', { className: 'muted member-stat-label', text: label }),
        h('span', { className: 'member-stat-val', text: value }),
    );
}

/** Read-only equipped-gear grid; tapping a filled slot opens its item preview. */
function gearGrid(equipment, onPick) {
    const grid = h('div', { className: 'gear-grid' });
    EQUIPMENT_TYPES.forEach((type) => {
        const item = equipment?.[type] || null;
        const slot = h('div', {
            className: `gear-slot${item ? ' filled' : ''}`,
            attrs: { title: item ? `${itemName(item)} · ${slotLabel(type)}` : slotLabel(type) },
            onclick: item ? () => onPick(item) : undefined,
        });
        if (item) {
            slot.style.setProperty('--rarity', rarityColor(item.tier));
            slot.appendChild(h('span', { className: 'gear-slot-icon', text: itemIcon(item) }));
            slot.appendChild(h('span', { className: 'gear-slot-lvl', text: `Lv ${item.level}` }));
        } else {
            slot.appendChild(h('span', { className: 'gear-slot-icon empty', text: slotIcon(type) }));
        }
        grid.appendChild(slot);
    });
    return grid;
}

/** Item-stat preview, with a Back button that returns to the player profile. */
export function showItemPreview(item, onBack) {
    const body = h('div', { className: 'item-preview' },
        renderItemCard(item),
        h('div', { className: 'confirm-actions' },
            h('button', { className: 'btn btn-ghost', text: '← Back', onclick: onBack }),
            h('button', { className: 'btn btn-primary', text: 'Close', onclick: closeModal }),
        ),
    );
    openModal(body);
}

/**
 * Open a player's public profile modal.
 *
 * `player` carries the public fields: { userId, username, avatar, frame, level,
 * power, rating, wins, losses, equipment }. Options:
 *  - `extraStats`: [[label, value], …] appended after the base stat grid.
 *  - `subtitle`:   text shown under the name (e.g. a clan rank).
 *  - `badge`:      a small glyph shown beside the name (e.g. a rank icon).
 */
export function showPlayerProfile(player, { extraStats = [], subtitle = null, badge = null } = {}) {
    const me = getCurrentUser();
    const isMe = me?.id === player.userId;
    const hasGear = player.equipment && EQUIPMENT_TYPES.some((t) => player.equipment[t]);
    // Re-open this same profile (used as the item preview's Back action).
    const reopen = () => showPlayerProfile(player, { extraStats, subtitle, badge });

    const body = h('div', { className: 'member-modal' },
        h('div', { className: 'member-modal-head' },
            h('span', { className: `member-modal-avatar frame-${safeFrame(player.frame)}`, text: avatarEmoji(player.avatar) }),
            h('div', { className: 'member-modal-id' },
                h('div', { className: 'member-modal-name' },
                    h('span', { text: player.username }),
                    badge ? h('span', { className: 'member-badge', text: ` ${badge}` }) : null,
                ),
                subtitle ? h('div', { className: 'muted', text: subtitle }) : null,
            ),
        ),
        h('div', { className: 'member-stats' },
            statRow('⭐ Level', fmt(player.level || 1)),
            statRow('💪 Power', fmt(player.power)),
            statRow('🏆 PvP ELO', fmt(player.rating ?? 1000)),
            statRow('📊 PvP Record', `${fmt(player.wins || 0)}W / ${fmt(player.losses || 0)}L`),
            ...extraStats.map(([label, value]) => statRow(label, value)),
        ),
        hasGear
            ? h('div', { className: 'profile-gear' },
                h('div', { className: 'profile-gear-title', text: '🎒 Equipped Gear' }),
                gearGrid(player.equipment, (item) => showItemPreview(item, reopen)),
                h('p', { className: 'muted small', text: 'Tap an item to preview its stats.' }),
            )
            : h('p', { className: 'muted small', text: 'No gear equipped yet.' }),
        isMe ? null : h('button', {
            className: 'btn btn-primary btn-block', text: '⚔️ Friendly Duel',
            onclick: () => { closeModal(); switchTab('pvp'); startFriendly(player.userId); },
        }),
        isMe ? null : h('p', { className: 'muted small member-duel-note', text: 'A practice fight against their gear — your ELO and record stay unchanged.' }),
        h('button', { className: 'btn btn-ghost btn-block', text: 'Close', onclick: closeModal }),
    );
    openModal(body);
}
