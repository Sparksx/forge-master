// App shell — header, bottom nav, screen routing, toast/modal roots.
import { h, clear, fmt, setToastRoot, setModalRoot } from './components.js';
import { avatarEmoji } from '../game/config.js';
import { getGold, getPowerScore, getAvatar, getFrame, getPlayerLevel, getPlayerLevelProgress } from '../game/state.js';
import { gameEvents, EVENTS } from '../events.js';

import { initAdminUI } from './admin.js';

import * as home from './home.js';
import * as pvp from './pvp.js';
import * as clan from './clan.js';
import * as shop from './shop.js';
import * as profile from './profile.js';
import { openPowerBreakdown } from './power-breakdown.js';

const screens = [home, pvp, clan, shop, profile];
// Bottom-nav order. Profile is omitted (reachable via the header avatar) and
// Forge (home) is centered among the tabs.
const navScreens = [pvp, home, clan, shop];
// screen.id -> container element. Kept here rather than on the screen modules,
// because `import * as` namespace objects are frozen and can't take properties.
const containers = new Map();
let active = null;
let header = null;

export function initApp(mountEl) {
    clear(mountEl);

    header = buildHeader();
    const stage = h('div', { className: 'screen-stage', id: 'screen-stage' });
    const nav = buildNav();
    const toastRoot = h('div', { className: 'toast-root' });
    const modalRoot = h('div', { className: 'modal-root' });

    mountEl.appendChild(h('div', { className: 'app-root' }, header.el, stage, nav, toastRoot, modalRoot));
    setToastRoot(toastRoot);
    setModalRoot(modalRoot);

    // Mount every screen into its own container (rendered once, shown/hidden).
    screens.forEach((s) => {
        const container = h('div', { className: 'screen', dataset: { screen: s.id } });
        container.style.display = 'none';
        stage.appendChild(container);
        containers.set(s.id, container);
        s.render(container);
    });

    let refreshQueued = false;
    gameEvents.on(EVENTS.STATE_CHANGED, () => {
        if (refreshQueued) return;
        refreshQueued = true;
        requestAnimationFrame(() => {
            refreshQueued = false;
            updateHeader();
            active?.refresh?.();
        });
    });
    gameEvents.on(EVENTS.CLAN_CHANGED, updateHeader);

    // Staff-only floating tools button (moderation, resources, stats…).
    initAdminUI(mountEl.querySelector('.app-root'));

    switchTab('home');
    updateHeader();
}

export function switchTab(name) {
    const screen = screens.find((s) => s.id === name);
    if (!screen) return;
    if (active && active !== screen) active.onHide?.();
    screens.forEach((s) => { containers.get(s.id).style.display = s.id === name ? 'block' : 'none'; });
    document.querySelectorAll('.nav-btn').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
    active = screen;
    screen.onShow?.();
    screen.refresh?.();
}

// ── Header ──────────────────────────────────────────────────────────────────
function buildHeader() {
    const avatarBtn = h('button', { className: 'hdr-avatar', text: avatarEmoji(getAvatar()), onclick: () => switchTab('profile') });
    const level = h('span', { className: 'hdr-hero-lvl-val', text: '1' });
    const xpFill = h('div', { className: 'hdr-xp-fill' });
    // Level + mini XP bar sit right next to the avatar; tapping jumps to profile.
    const hero = h('div', { className: 'hdr-hero' },
        avatarBtn,
        h('div', { className: 'hdr-hero-info', onclick: () => switchTab('profile') },
            h('div', { className: 'hdr-hero-lvl' }, h('span', { className: 'muted', text: 'Lv' }), level),
            h('div', { className: 'hdr-xp-bar' }, xpFill),
        ),
    );
    const gold = h('span', { className: 'hdr-gold-val', text: '0' });
    const power = h('span', { className: 'hdr-power-val', text: '0' });
    const el = h('header', { className: 'app-hdr' },
        hero,
        h('div', { className: 'hdr-stats' },
            h('button', { className: 'hdr-pill hdr-power', attrs: { type: 'button', title: 'How is my Power calculated?' }, onclick: openPowerBreakdown }, h('span', { text: '💪' }), power),
            h('div', { className: 'hdr-pill hdr-gold' }, h('span', { text: '💰' }), gold),
        ),
    );
    return { el, avatarBtn, level, xpFill, gold, power };
}

function updateHeader() {
    if (!header) return;
    const xp = getPlayerLevelProgress();
    header.level.textContent = fmt(getPlayerLevel());
    header.xpFill.style.width = `${Math.round(xp.pct * 100)}%`;
    header.gold.textContent = fmt(getGold());
    header.power.textContent = fmt(getPowerScore());
    header.avatarBtn.textContent = avatarEmoji(getAvatar());
    header.avatarBtn.className = `hdr-avatar frame-${getFrame()}`;
}

// ── Bottom nav ───────────────────────────────────────────────────────────────
function buildNav() {
    return h('nav', { className: 'bottom-nav' },
        ...navScreens.map((s) => h('button', { className: 'nav-btn', dataset: { tab: s.id }, onclick: () => switchTab(s.id) },
            h('span', { className: 'nav-icon', text: s.icon }),
            h('span', { className: 'nav-label', text: s.label }),
        )),
    );
}
