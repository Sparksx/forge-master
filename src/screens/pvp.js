// PvP screen — async, auto-resolved duels. A fight is resolved server-side
// against a stored snapshot of another player and returned as a deterministic
// timeline (seed + stat blocks + event log); the dungeon replays it identically.
// No live opponent, no per-turn actions — the gear does the fighting (same model
// as the PvE idle battler).
import { h, clear, fmt, toast } from './components.js';
import { avatarEmoji } from '../game/config.js';
import { getAvatar, getPowerScore } from '../game/state.js';
import { getCurrentUser } from '../auth.js';
import { createDungeon } from './dungeon.js';
import { pvpFight, pvpLeaderboard } from '../game/pvp.js';

let root = null;
let dungeon = null;
let visible = false;
let busy = false;          // a fight request is in flight or replaying
let lastResult = null;     // the resolved fight, shown once the replay finishes
let friendlyTarget = null; // userId for a one-shot unranked clan duel

export const id = 'pvp';
export const icon = '🏆';
export const label = 'Arena PvP';

export function render(container) {
    root = container;
    clear(root);
    root.appendChild(h('div', { className: 'pvp-screen' },
        section('idle', buildIdle()),
        section('fight', buildFight()),
        section('result', buildResult()),
    ));
    show('idle');
    refresh();
}

function section(name, node) {
    node.classList.add('pvp-section');
    node.dataset.section = name;
    return node;
}

function show(m) {
    root.querySelectorAll('.pvp-section').forEach((s) => s.classList.toggle('hidden', s.dataset.section !== m));
}

export function refresh() {
    if (!root) return;
    const u = getCurrentUser() || {};
    const set = (sel, val) => { const el = root.querySelector(sel); if (el) el.textContent = val; };
    set('.pvp-elo', fmt(u.pvpRating ?? 1000));
    set('.pvp-power', fmt(getPowerScore()));
    set('.pvp-record', `${u.pvpWins ?? 0}W / ${u.pvpLosses ?? 0}L`);
    set('.pvp-avatar', avatarEmoji(getAvatar()));
}

export function onShow() {
    visible = true;
    refresh();
    dungeon?.start();
    loadLeaderboard();
    if (!busy) show('idle');
}

export function onHide() {
    visible = false;
    dungeon?.stop();
}

/**
 * Kick off an unranked friendly duel against a clanmate. Called after navigating
 * to this screen (e.g. from the clan roster). Resolves through the same async
 * fight pipeline, but the server skips all Elo / win-loss bookkeeping.
 */
export function startFriendly(targetUserId) {
    friendlyTarget = targetUserId;
    findMatch();
}

// ── Sections ────────────────────────────────────────────────────────────────
function buildIdle() {
    return h('div', {},
        h('div', { className: 'pvp-card' },
            h('div', { className: 'pvp-avatar', text: '🧙' }),
            h('div', { className: 'pvp-card-stats' },
                stat('ELO', 'pvp-elo', '1000'),
                stat('Power', 'pvp-power', '0'),
                stat('Record', 'pvp-record', '0W / 0L'),
            ),
        ),
        h('button', { className: 'btn btn-primary btn-block pvp-find', text: 'Find Match', onclick: () => findMatch() }),
        h('div', { className: 'pvp-leaderboard' },
            h('h3', { text: '🏅 Top Players' }),
            h('div', { className: 'pvp-lb-list', id: 'pvp-lb-list' }, h('p', { className: 'muted', text: 'Loading…' })),
        ),
    );
}

function stat(label, cls, val) {
    return h('div', { className: 'pvp-stat' }, h('span', { className: 'pvp-stat-label', text: label }), h('span', { className: `pvp-stat-val ${cls}`, text: val }));
}

function buildFight() {
    const host = h('div', { className: 'dungeon-host' });
    dungeon = createDungeon({ onResolve: onReplayDone });
    dungeon.mount(host);
    return h('div', {},
        h('div', { className: 'pvp-arena-head' },
            h('span', { className: 'pvp-vs-name', dataset: { side: 'you' }, text: 'You' }),
            h('small', { text: 'VS' }),
            h('span', { className: 'pvp-vs-name', dataset: { side: 'opp' }, text: 'Opponent' }),
        ),
        host,
    );
}

function buildResult() {
    return h('div', { className: 'pvp-result' },
        h('h2', { className: 'pvp-result-title', text: 'Victory!' }),
        h('p', { className: 'pvp-result-rating' }),
        h('button', { className: 'btn btn-primary', text: 'Fight Again', onclick: () => { show('idle'); refresh(); findMatch(); } }),
        h('button', { className: 'btn btn-ghost', text: 'Back to Lobby', onclick: () => { show('idle'); refresh(); loadLeaderboard(); } }),
    );
}

// ── Flow ──────────────────────────────────────────────────────────────────--
async function findMatch() {
    if (busy) return;
    busy = true;
    setFindEnabled(false);
    const target = friendlyTarget; // consume the one-shot friendly challenge, if any
    friendlyTarget = null;
    try {
        const data = await pvpFight(target);
        lastResult = data;
        startReplay(data);
    } catch (err) {
        busy = false;
        setFindEnabled(true);
        toast(err.message || 'Matchmaking failed', 'error');
    }
}

function setFindEnabled(on) {
    const b = root?.querySelector('.pvp-find');
    if (!b) return;
    b.disabled = !on;
    b.textContent = on ? 'Find Match' : 'Finding…';
}

// Hand the server's deterministic fight to the dungeon to animate.
function startReplay(data) {
    const you = data.you;
    const opp = data.opponent;
    root.querySelector('.pvp-vs-name[data-side="you"]').textContent = `You · ${fmt(you.power)}`;
    root.querySelector('.pvp-vs-name[data-side="opp"]').textContent = `${opp.username}${data.friendly ? ' 🤝' : ''} · ${fmt(opp.power)}`;
    show('fight');
    dungeon.start();
    dungeon.setMatchup({
        seed: data.seed,
        win: data.win,
        events: data.events,
        player: fighterSpec('player', avatarEmoji(getAvatar()), you),
        enemies: [fighterSpec('opp', avatarEmoji(opp.avatar), opp)],
    });
}

// Map a server stat block to the dungeon's matchup spec.
function fighterSpec(id, emoji, s) {
    return {
        id, emoji, role: 'normal',
        maxHP: s.maxHP, damage: s.damage,
        critChance: s.critChance, critMultiplier: s.critMultiplier,
        attackSpeed: s.attackSpeed, lifeSteal: s.lifeSteal, healthRegen: s.healthRegen,
        ranged: !!s.ranged,
    };
}

// The dungeon finished playing the fight back — reveal the authoritative result.
function onReplayDone() {
    busy = false;
    setFindEnabled(true);
    const data = lastResult;
    if (!data) { show('idle'); return; }

    const won = data.winner === 'you';
    root.querySelector('.pvp-result-title').textContent = won ? 'Victory! 🏆' : 'Defeat';
    const change = data.ratingChange || 0;
    const ratingEl = root.querySelector('.pvp-result-rating');
    ratingEl.textContent = data.friendly
        ? 'Friendly duel — no rating change'
        : data.opponent.isBot
            ? 'Sparring match — no rating change'
            : `ELO ${change >= 0 ? '+' : ''}${change}`;

    // Reflect the result locally so the lobby updates instantly. Friendly duels and
    // sparring bots are unranked, so leave the record untouched.
    const u = getCurrentUser();
    if (u && !data.opponent.isBot && !data.friendly) {
        u.pvpRating = data.newRating ?? ((u.pvpRating ?? 1000) + change);
        if (won) u.pvpWins = (u.pvpWins ?? 0) + 1;
        else u.pvpLosses = (u.pvpLosses ?? 0) + 1;
    }

    if (visible) show('result');
    loadLeaderboard();
}

async function loadLeaderboard() {
    const list = await pvpLeaderboard();
    renderLeaderboard(list);
}

function renderLeaderboard(list) {
    const box = root?.querySelector('#pvp-lb-list');
    if (!box) return;
    clear(box);
    if (!list || list.length === 0) { box.appendChild(h('p', { className: 'muted', text: 'No ranked players yet — be the first!' })); return; }
    list.forEach((p, i) => box.appendChild(h('div', { className: 'pvp-lb-row' },
        h('span', { className: 'pvp-lb-rank', text: `#${i + 1}` }),
        h('span', { className: 'pvp-lb-name', text: p.username }),
        h('span', { className: 'pvp-lb-elo', text: `${fmt(p.rating)} ELO` }),
    )));
}
