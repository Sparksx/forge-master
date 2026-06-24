// In-game staff panel — a floating ADM/MOD button that opens a moderation +
// admin tools modal. Restored after the UI reforge and scoped to the current
// game's features (gold, forge level, arena, PvP) plus moderation tooling.
import { h, clear, fmt, toast, openModal } from './components.js';
import { getCurrentUser } from '../auth.js';
import { addGold, resetProgress } from '../game/state.js';
import {
    isStaff, isAdmin, getUserRole,
    searchUsers, getUserProfile,
    warnUser, muteUser, unmuteUser, banUser, unbanUser, kickUser,
    addGoldToUser, setUserForgeLevel, setUserRole, resetUserState,
    getServerStats, getAuditLog, broadcastMessage,
} from '../game/admin.js';

let fab = null;
let currentSection = 'players';
let selectedUserId = null;
let logsPage = 1;

/** Create or remove the floating staff button based on the current user's role. */
export function initAdminUI(mountEl) {
    fab?.remove();
    fab = null;
    const user = getCurrentUser();
    if (!user || !isStaff()) return;

    fab = h('button', {
        className: 'admin-fab',
        text: isAdmin() ? 'ADM' : 'MOD',
        attrs: { title: 'Staff tools', 'aria-label': 'Open staff tools' },
        onclick: openAdminPanel,
    });
    (mountEl || document.body).appendChild(fab);
}

function openAdminPanel() {
    currentSection = 'players';
    const panel = h('div', { className: 'admin-panel' });
    renderPanel(panel);
    openModal(panel);
}

function sectionsForRole() {
    const adm = isAdmin();
    const list = [{ id: 'players', label: 'Players', icon: '👥' }];
    if (adm) list.push({ id: 'self', label: 'My Account', icon: '🛠️' });
    if (adm) list.push({ id: 'stats', label: 'Stats', icon: '📊' });
    list.push({ id: 'logs', label: 'Logs', icon: '📋' });
    if (adm) list.push({ id: 'broadcast', label: 'Announce', icon: '📢' });
    return list;
}

function renderPanel(panel) {
    clear(panel);
    panel.appendChild(h('div', { className: 'admin-head' },
        h('h3', { text: 'Staff Tools' }),
        h('span', { className: `admin-role-badge admin-role-${getUserRole()}`, text: getUserRole().toUpperCase() }),
    ));

    const nav = h('div', { className: 'admin-nav' },
        ...sectionsForRole().map((s) => h('button', {
            className: `admin-nav-btn${currentSection === s.id ? ' active' : ''}`,
            text: `${s.icon} ${s.label}`,
            onclick: () => { currentSection = s.id; renderPanel(panel); },
        })),
    );
    panel.appendChild(nav);

    const body = h('div', { className: 'admin-body' });
    panel.appendChild(body);

    switch (currentSection) {
        case 'players': renderPlayers(body); break;
        case 'self': renderSelf(body); break;
        case 'stats': renderStats(body); break;
        case 'logs': renderLogs(body); break;
        case 'broadcast': renderBroadcast(body); break;
    }
}

// ─── Players ──────────────────────────────────────────────────────
function renderPlayers(body) {
    const input = h('input', {
        className: 'admin-input', type: 'text', placeholder: 'Search a player…',
        attrs: { maxlength: '30', autocomplete: 'off' },
    });
    const results = h('div', { className: 'admin-results' });
    const detail = h('div', { className: 'admin-detail' });

    const doSearch = async () => {
        const q = input.value.trim();
        if (!q) return;
        clear(results).appendChild(h('p', { className: 'admin-muted', text: 'Searching…' }));
        try {
            const data = await searchUsers(q);
            renderResults(results, detail, data.users || []);
        } catch (err) {
            clear(results).appendChild(h('p', { className: 'admin-error', text: err.message }));
        }
    };

    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
    body.append(
        h('div', { className: 'admin-search-bar' }, input,
            h('button', { className: 'btn btn-primary btn-sm', text: 'Search', onclick: doSearch })),
        results, detail,
    );
    if (selectedUserId) loadDetail(detail, selectedUserId);
}

function renderResults(results, detail, users) {
    clear(results);
    if (!users.length) {
        results.appendChild(h('p', { className: 'admin-muted', text: 'No players found.' }));
        return;
    }
    users.forEach((u) => {
        const badge = u.role && u.role !== 'user'
            ? h('span', { className: `admin-role-badge admin-role-${u.role}`, text: u.role.toUpperCase() })
            : null;
        results.appendChild(h('button', {
            className: 'admin-user-row',
            onclick: () => { selectedUserId = u.id; loadDetail(detail, u.id); },
        },
            h('span', { className: 'admin-user-name', text: u.username }),
            badge,
            h('span', { className: 'admin-muted', text: `#${u.id}` }),
        ));
    });
}

async function loadDetail(detail, userId) {
    clear(detail).appendChild(h('p', { className: 'admin-muted', text: 'Loading…' }));
    try {
        const data = await getUserProfile(userId);
        renderDetail(detail, data);
    } catch (err) {
        clear(detail).appendChild(h('p', { className: 'admin-error', text: err.message }));
    }
}

function renderDetail(detail, data) {
    const { user, warnings = [], bans = [], mutes = [] } = data;
    const gs = user.gameState || {};
    const player = (gs.player && typeof gs.player === 'object') ? gs.player : {};
    const adm = isAdmin();
    clear(detail);

    const card = h('div', { className: 'admin-detail-card' });
    card.appendChild(h('div', { className: 'admin-detail-head' },
        h('span', { className: 'admin-user-name', text: user.username }),
        h('span', { className: `admin-role-badge admin-role-${user.role}`, text: user.role.toUpperCase() }),
    ));
    card.appendChild(h('div', { className: 'admin-stat-row' },
        chip('💰', fmt(gs.gold || 0)),
        chip('🔨', `Lv ${gs.forgeLevel || 1}`),
        chip('⚔️', `Arena ${player.arenaRank || 1}`),
        chip('🏆', `${user.pvpRating ?? 1000} ELO`),
        chip('📊', `${user.pvpWins ?? 0}W/${user.pvpLosses ?? 0}L`),
    ));

    // Moderation (admin + moderator)
    const mod = h('div', { className: 'admin-action-grid' });
    mod.append(
        actionBtn('Warn', 'warn', () => act('warn', user.id, detail)),
        actionBtn('Mute', 'mute', () => act('mute', user.id, detail)),
        actionBtn('Ban', 'ban', () => act('ban', user.id, detail)),
        actionBtn('Kick', 'kick', () => act('kick', user.id, detail)),
    );
    if (adm) mod.append(actionBtn('Perma-ban', 'permban', () => act('permban', user.id, detail)));
    if (bans.some((b) => b.active)) mod.append(actionBtn('Unban', 'unban', () => act('unban', user.id, detail)));
    if (mutes.some((m) => m.active)) mod.append(actionBtn('Unmute', 'unmute', () => act('unmute', user.id, detail)));
    card.append(h('h4', { text: 'Moderation' }), mod);

    // Admin-only: resources + progression + role
    if (adm) {
        const grid = h('div', { className: 'admin-action-grid' });
        grid.append(
            actionBtn('+10K 💰', 'gold', () => act('gold-10k', user.id, detail)),
            actionBtn('+100K 💰', 'gold', () => act('gold-100k', user.id, detail)),
            actionBtn('+1M 💰', 'gold', () => act('gold-1m', user.id, detail)),
            actionBtn('Set Forge Lv', 'forge', () => act('forge', user.id, detail)),
            actionBtn('Set Role', 'role', () => act('role', user.id, detail)),
            actionBtn('Reset State', 'danger', () => act('reset', user.id, detail)),
        );
        card.append(h('h4', { text: 'Admin' }), grid);
    }

    card.append(
        history('Warnings', warnings, (w) => `${shortDate(w.createdAt)} — ${w.reason}`),
        history('Bans', bans, (b) => `${b.active ? '● ' : ''}${shortDate(b.createdAt)} — ${b.expiresAt ? shortDate(b.expiresAt) : 'permanent'} — ${b.reason}`),
        history('Mutes', mutes, (m) => `${m.active ? '● ' : ''}${shortDate(m.createdAt)} — ${m.reason}`),
    );
    detail.appendChild(card);
}

async function act(action, userId, detail) {
    try {
        switch (action) {
            case 'warn': {
                const reason = prompt('Warning reason:');
                if (!reason) return;
                await warnUser(userId, reason);
                toast('Warning issued', 'success');
                break;
            }
            case 'mute': {
                const reason = prompt('Mute reason:');
                if (!reason) return;
                const duration = prompt('Duration (e.g. 30m, 1h, 24h):', '1h');
                if (!duration) return;
                await muteUser(userId, reason, duration);
                toast('Player muted', 'success');
                break;
            }
            case 'ban': {
                const reason = prompt('Temp-ban reason:');
                if (!reason) return;
                const duration = prompt('Duration (e.g. 1h, 1d, 7d):', '1d');
                if (!duration) return;
                await banUser(userId, reason, duration);
                kickUser(userId);
                toast('Player banned', 'success');
                break;
            }
            case 'permban': {
                const reason = prompt('Permanent ban reason:');
                if (!reason) return;
                if (!confirm('Permanently ban this player?')) return;
                await banUser(userId, reason, null);
                kickUser(userId);
                toast('Player permanently banned', 'success');
                break;
            }
            case 'kick': kickUser(userId); toast('Player kicked', 'success'); break;
            case 'unban': await unbanUser(userId); toast('Player unbanned', 'success'); break;
            case 'unmute': await unmuteUser(userId); toast('Player unmuted', 'success'); break;
            case 'gold-10k': await addGoldToUser(userId, 10_000); toast('+10K gold', 'success'); break;
            case 'gold-100k': await addGoldToUser(userId, 100_000); toast('+100K gold', 'success'); break;
            case 'gold-1m': await addGoldToUser(userId, 1_000_000); toast('+1M gold', 'success'); break;
            case 'forge': {
                const lvl = parseInt(prompt('Set forge level (1–12):', '6'), 10);
                if (!lvl) return;
                await setUserForgeLevel(userId, lvl);
                toast(`Forge level set to ${lvl}`, 'success');
                break;
            }
            case 'role': {
                const role = prompt('New role (user / moderator / admin):', 'user');
                if (!role) return;
                if (!confirm(`Set role to "${role.trim()}"?`)) return;
                await setUserRole(userId, role.trim());
                toast(`Role set to ${role}`, 'success');
                break;
            }
            case 'reset': {
                if (!confirm('Reset this player? Wipes their progression. Irreversible.')) return;
                await resetUserState(userId);
                toast('Player state reset', 'success');
                break;
            }
        }
        loadDetail(detail, userId);
    } catch (err) {
        toast(err.message, 'error');
    }
}

// ─── My Account (admin only) ──────────────────────────────────────
function renderSelf(body) {
    if (!isAdmin()) {
        body.appendChild(h('p', { className: 'admin-muted', text: 'Moderators manage players from the Players tab.' }));
        return;
    }
    const grid = h('div', { className: 'admin-action-grid' });
    const grant = (amt, label) => grid.appendChild(actionBtn(label, 'gold', () => { addGold(amt); toast(label, 'success'); }));
    grant(10_000, '+10K 💰');
    grant(100_000, '+100K 💰');
    grant(1_000_000, '+1M 💰');
    grant(10_000_000, '+10M 💰');
    body.append(
        h('h4', { text: 'Grant gold (this account)' }), grid,
        h('div', { className: 'admin-action-grid' },
            actionBtn('Reset my progression', 'danger', () => {
                if (!confirm('Reset your progression? Wipes your gear, gold and forge level.')) return;
                resetProgress();
                toast('Progression reset', 'success');
            }),
        ),
    );
}

// ─── Stats (admin only) ───────────────────────────────────────────
async function renderStats(body) {
    body.appendChild(h('p', { className: 'admin-muted', text: 'Loading stats…' }));
    try {
        const s = await getServerStats();
        clear(body).appendChild(h('div', { className: 'admin-stats-grid' },
            statCard(s.totalUsers, 'Total players'),
            statCard(s.registeredUsers, 'Registered'),
            statCard(s.totalGuests, 'Guests'),
            statCard(fmt(s.totalGoldInCirculation || 0), 'Gold in circulation'),
        ));
    } catch (err) {
        clear(body).appendChild(h('p', { className: 'admin-error', text: err.message }));
    }
}

// ─── Logs ─────────────────────────────────────────────────────────
async function renderLogs(body) {
    clear(body).appendChild(h('p', { className: 'admin-muted', text: 'Loading logs…' }));
    try {
        const data = await getAuditLog(logsPage);
        clear(body);
        if (!data.logs.length) {
            body.appendChild(h('p', { className: 'admin-muted', text: 'No log entries.' }));
            return;
        }
        const list = h('div', { className: 'admin-log-list' });
        data.logs.forEach((log) => {
            list.appendChild(h('div', { className: 'admin-log-item' },
                h('span', { className: 'admin-muted', text: shortDate(log.createdAt) }),
                h('span', { className: 'admin-log-action', text: log.action }),
                h('span', { text: `${log.actor?.username || '?'}${log.targetId ? ` → #${log.targetId}` : ''}` }),
            ));
        });
        body.append(list, h('div', { className: 'admin-pager' },
            h('button', { className: 'btn btn-ghost btn-sm', text: 'Prev', attrs: data.page <= 1 ? { disabled: 'true' } : {},
                onclick: () => { if (logsPage > 1) { logsPage--; renderLogs(body); } } }),
            h('span', { className: 'admin-muted', text: `Page ${data.page} / ${data.pages}` }),
            h('button', { className: 'btn btn-ghost btn-sm', text: 'Next', attrs: data.page >= data.pages ? { disabled: 'true' } : {},
                onclick: () => { if (logsPage < data.pages) { logsPage++; renderLogs(body); } } }),
        ));
    } catch (err) {
        clear(body).appendChild(h('p', { className: 'admin-error', text: err.message }));
    }
}

// ─── Broadcast (admin only) ───────────────────────────────────────
function renderBroadcast(body) {
    const ta = h('textarea', { className: 'admin-input', attrs: { rows: '3', maxlength: '500', placeholder: 'System announcement…' } });
    body.append(
        h('p', { className: 'admin-muted', text: 'Sends a golden message to every player in general chat.' }),
        ta,
        h('button', {
            className: 'btn btn-primary btn-block', text: 'Send announcement',
            onclick: async () => {
                const text = ta.value.trim();
                if (!text) return;
                try { await broadcastMessage(text); toast('Announcement sent', 'success'); ta.value = ''; }
                catch (err) { toast(err.message, 'error'); }
            },
        }),
    );
}

// ─── Small builders ───────────────────────────────────────────────
function chip(icon, text) {
    return h('span', { className: 'admin-chip' }, h('span', { text: icon }), h('span', { text: String(text) }));
}
function actionBtn(label, kind, onclick) {
    return h('button', { className: `btn btn-sm admin-act admin-act-${kind}`, text: label, onclick });
}
function statCard(value, label) {
    return h('div', { className: 'admin-stat-card' },
        h('div', { className: 'admin-stat-value', text: String(value) }),
        h('div', { className: 'admin-muted', text: label }),
    );
}
function history(title, items, fmtItem) {
    const wrap = h('div', { className: 'admin-history' }, h('h4', { text: `${title} (${items.length})` }));
    if (!items.length) {
        wrap.appendChild(h('p', { className: 'admin-muted', text: 'None' }));
    } else {
        items.slice(0, 10).forEach((it) => wrap.appendChild(h('div', { className: 'admin-history-item', text: fmtItem(it) })));
    }
    return wrap;
}
function shortDate(iso) {
    const d = new Date(iso);
    if (isNaN(d)) return '?';
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
