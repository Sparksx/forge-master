// Profile screen — avatar, stats summary, account, logout.
import { h, clear, fmt, toast } from './components.js';
import { AVATARS, avatarEmoji } from '../game/config.js';
import { getAvatar, setAvatar, getPowerScore, getHighestArenaRank, getArenaRank, getGold, getForgeLevel } from '../game/state.js';
import { getCurrentUser, performLogout } from '../auth.js';

let root = null;

export const id = 'profile';
export const icon = '👤';
export const label = 'Profile';

export function render(container) {
    root = container;
    rerender();
}

export function onShow() { rerender(); }
export function refresh() { if (root && root.querySelector('.profile-screen')) rerender(); }

function rerender() {
    if (!root) return;
    clear(root);
    const u = getCurrentUser() || {};
    root.appendChild(h('div', { className: 'profile-screen' },
        h('div', { className: 'profile-head' },
            h('div', { className: 'profile-avatar-big', text: avatarEmoji(getAvatar()) }),
            h('div', {},
                h('div', { className: 'profile-username', text: u.username || 'Guest' }),
                h('div', { className: 'muted', text: u.isGuest ? 'Guest account' : (u.email || 'Registered') }),
            ),
        ),
        h('div', { className: 'profile-stats' },
            statCard('💪', 'Power', fmt(getPowerScore())),
            statCard('⚔️', 'Arena Rank', `${getArenaRank()} (best ${getHighestArenaRank()})`),
            statCard('🏆', 'PvP ELO', fmt(u.pvpRating ?? 1000)),
            statCard('📊', 'PvP Record', `${u.pvpWins ?? 0}W / ${u.pvpLosses ?? 0}L`),
            statCard('💰', 'Gold', fmt(getGold())),
            statCard('🔨', 'Forge Lv', String(getForgeLevel())),
        ),
        h('div', { className: 'profile-section' },
            h('h3', { text: 'Avatar' }),
            h('div', { className: 'avatar-grid' },
                ...AVATARS.map((a) => h('button', {
                    className: `avatar-opt${a.id === getAvatar() ? ' selected' : ''}`,
                    text: a.emoji,
                    onclick: () => { setAvatar(a.id); rerender(); toast('Avatar updated', 'success'); },
                })),
            ),
        ),
        h('div', { className: 'profile-section' },
            h('button', { className: 'btn btn-danger btn-block', text: 'Log Out', onclick: performLogout }),
        ),
    ));
}

function statCard(icon, label, value) {
    return h('div', { className: 'stat-card' },
        h('span', { className: 'stat-card-icon', text: icon }),
        h('span', { className: 'stat-card-value', text: value }),
        h('span', { className: 'stat-card-label', text: label }),
    );
}
