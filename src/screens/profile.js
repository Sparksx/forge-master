// Profile screen — avatar, stats summary, account, logout.
import { h, clear, fmt, toast } from './components.js';
import { AVATARS, avatarEmoji } from '../game/config.js';
import { PREMIUM_AVATARS } from '../../shared/cosmetics.js';
import {
    getAvatar, setAvatar, getFrame, ownsCosmetic, getPowerScore, getHighestArenaRank, getArenaRank, getGold, getForgeLevel,
    getPlayerLevel, getPlayerLevelProgress, getForgeLevelProgress,
} from '../game/state.js';
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
            h('div', { className: `profile-avatar-big frame-${getFrame()}`, text: avatarEmoji(getAvatar()) }),
            h('div', {},
                h('div', { className: 'profile-username', text: u.username || 'Guest' }),
                h('div', { className: 'muted', text: u.isGuest ? 'Guest account' : (u.email || 'Registered') }),
            ),
        ),
        h('div', { className: 'profile-stats' },
            statCard('⭐', 'Level', String(getPlayerLevel())),
            statCard('💪', 'Power', fmt(getPowerScore())),
            statCard('⚔️', 'Arena Rank', `${getArenaRank()} (best ${getHighestArenaRank()})`),
            statCard('🏆', 'PvP ELO', fmt(u.pvpRating ?? 1000)),
            statCard('📊', 'PvP Record', `${u.pvpWins ?? 0}W / ${u.pvpLosses ?? 0}L`),
            statCard('💰', 'Gold', fmt(getGold())),
            statCard('🔨', 'Forge Lv', String(getForgeLevel())),
        ),
        h('div', { className: 'profile-section' },
            h('h3', { text: 'Progression' }),
            xpRow('⭐', 'Player Level', getPlayerLevelProgress(), 'Defeat enemies to gain XP'),
            xpRow('🔨', 'Forge Level', getForgeLevelProgress(), 'Forge gear to gain XP'),
        ),
        h('div', { className: 'profile-section' },
            h('h3', { text: 'Avatar' }),
            h('div', { className: 'avatar-grid' },
                ...[...AVATARS, ...PREMIUM_AVATARS.filter((a) => ownsCosmetic(a.id))].map((a) => h('button', {
                    className: `avatar-opt${a.id === getAvatar() ? ' selected' : ''}`,
                    text: a.emoji,
                    onclick: () => { setAvatar(a.id); rerender(); toast('Avatar updated', 'success'); },
                })),
            ),
            h('div', { className: 'muted profile-cos-hint', text: 'Unlock premium avatars & profile frames in the Shop ✨' }),
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

function xpRow(icon, label, prog, hint) {
    const right = prog.maxed ? 'MAX' : `${fmt(prog.xp)} / ${fmt(prog.need)} XP`;
    return h('div', { className: 'xp-row' },
        h('div', { className: 'xp-row-head' },
            h('span', { className: 'xp-row-label', text: `${icon} ${label} ${prog.level}` }),
            h('span', { className: 'xp-row-val muted', text: right }),
        ),
        h('div', { className: 'xp-row-bar' },
            h('div', { className: 'xp-row-fill', style: { width: `${Math.round(prog.pct * 100)}%` } })),
        h('div', { className: 'xp-row-hint muted', text: prog.maxed ? 'Maxed out' : hint }),
    );
}
