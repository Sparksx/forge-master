// PvP screen — live duels over the existing server match engine.
import { h, clear, fmt, toast } from './components.js';
import { avatarEmoji } from '../game/config.js';
import { getAvatar, getPowerScore, getCombatStats } from '../game/state.js';
import { getCurrentUser } from '../auth.js';
import { setPvpHandlers, initPvp, pvpQueue, pvpCancel, pvpAction, pvpRequestLeaderboard } from '../game/pvp.js';

let root = null;
let mode = 'idle'; // idle | queue | fight | result
let myMaxHP = 0;
let countdown = null;

export const id = 'pvp';
export const icon = '🏆';
export const label = 'Arena PvP';

export function render(container) {
    root = container;
    clear(root);
    root.appendChild(h('div', { className: 'pvp-screen' },
        section('idle', buildIdle()),
        section('queue', buildQueue()),
        section('fight', buildFight()),
        section('result', buildResult()),
    ));
    bindHandlers();
    show('idle');
    refresh();
}

function section(name, node) {
    node.classList.add('pvp-section');
    node.dataset.section = name;
    return node;
}

function show(m) {
    mode = m;
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
    refresh();
    initPvp();
    pvpRequestLeaderboard();
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
        h('button', { className: 'btn btn-primary btn-block', text: 'Find Match', onclick: () => { initPvp(); if (pvpQueue()) show('queue'); else toast('Not connected', 'error'); } }),
        h('div', { className: 'pvp-leaderboard' },
            h('h3', { text: '🏅 Top Players' }),
            h('div', { className: 'pvp-lb-list', id: 'pvp-lb-list' }, h('p', { className: 'muted', text: 'Loading…' })),
        ),
    );
}

function stat(label, cls, val) {
    return h('div', { className: 'pvp-stat' }, h('span', { className: 'pvp-stat-label', text: label }), h('span', { className: `pvp-stat-val ${cls}`, text: val }));
}

function buildQueue() {
    return h('div', { className: 'pvp-queue' },
        h('div', { className: 'spinner' }),
        h('p', { text: 'Searching for an opponent…' }),
        h('button', { className: 'btn btn-ghost', text: 'Cancel', onclick: () => { pvpCancel(); show('idle'); } }),
    );
}

function buildFight() {
    const fighter = (side, name) => h('div', { className: `pvp-fighter pvp-${side}` },
        h('div', { className: 'pvp-fighter-name', dataset: { side }, text: name }),
        h('div', { className: 'hpbar' }, h('div', { className: 'hpfill', dataset: { side } }), h('span', { className: 'hptext', dataset: { side } })),
    );
    return h('div', {},
        h('div', { className: 'pvp-arena' },
            fighter('you', 'You'),
            h('div', { className: 'pvp-vs' }, h('span', { className: 'pvp-timer', text: '15' }), h('small', { text: 'VS' })),
            fighter('opp', 'Opponent'),
        ),
        h('div', { className: 'pvp-actions' },
            actionBtn('attack', '⚔️ Attack'),
            actionBtn('defend', '🛡️ Defend'),
            actionBtn('special', '💥 Special'),
        ),
        h('div', { className: 'pvp-log', id: 'pvp-log' }),
    );
}

function actionBtn(type, label) {
    return h('button', { className: 'pvp-action', dataset: { action: type }, text: label, onclick: () => { pvpAction(type); setActionsEnabled(false); } });
}

function buildResult() {
    return h('div', { className: 'pvp-result' },
        h('h2', { className: 'pvp-result-title', text: 'Victory!' }),
        h('p', { className: 'pvp-result-rating' }),
        h('button', { className: 'btn btn-primary', text: 'Back to Lobby', onclick: () => { show('idle'); onShow(); } }),
    );
}

function setActionsEnabled(on) {
    root.querySelectorAll('.pvp-action').forEach((b) => { b.disabled = !on; });
}

function setHp(side, hp, maxHP) {
    const pct = Math.max(0, Math.min(100, (hp / maxHP) * 100));
    root.querySelector(`.hpfill[data-side="${side}"]`).style.width = `${pct}%`;
    root.querySelector(`.hptext[data-side="${side}"]`).textContent = `${fmt(Math.max(0, Math.round(hp)))}/${fmt(maxHP)}`;
}

function logLine(text, cls = '') {
    const log = root.querySelector('#pvp-log');
    log.insertBefore(h('p', { className: cls, text }), log.firstChild);
    while (log.children.length > 12) log.removeChild(log.lastChild);
}

function startCountdown(seconds) {
    clearInterval(countdown);
    let s = seconds;
    const el = root.querySelector('.pvp-timer');
    if (el) el.textContent = String(s);
    countdown = setInterval(() => {
        s -= 1;
        if (el) el.textContent = String(Math.max(0, s));
        if (s <= 0) clearInterval(countdown);
    }, 1000);
}

// ── Socket handlers ─────────────────────────────────────────────────────────
function bindHandlers() {
    setPvpHandlers({
        onQueued: () => show('queue'),
        onCancelled: () => show('idle'),
        onError: (d) => { toast(d?.message || 'PvP error', 'error'); if (mode === 'queue') show('idle'); },
        onMatched: (d) => {
            myMaxHP = getCombatStats().maxHP;
            const oppMax = d.opponent.maxHP;
            clear(root.querySelector('#pvp-log'));
            root.querySelector('.pvp-fighter-name[data-side="you"]').textContent = `You · ${fmt(d.you.power)}pwr`;
            root.querySelector('.pvp-fighter-name[data-side="opp"]').textContent = `${d.opponent.username} · ${fmt(d.opponent.power)}pwr`;
            setHp('you', myMaxHP, myMaxHP);
            setHp('opp', oppMax, oppMax);
            root.querySelector('.pvp-fighter-name[data-side="opp"]').dataset.max = String(oppMax);
            show('fight');
        },
        onTurn: (d) => { setActionsEnabled(true); startCountdown(Math.round((d.timeLimit || 15000) / 1000)); },
        onTurnResult: (d) => {
            setActionsEnabled(false);
            const oppMax = Number(root.querySelector('.pvp-fighter-name[data-side="opp"]').dataset.max) || d.opponent.maxHP;
            setHp('you', d.you.currentHP, d.you.maxHP || myMaxHP);
            setHp('opp', d.opponent.currentHP, d.opponent.maxHP || oppMax);
            logLine(`You ${d.you.action} (${fmt(d.you.damage)}${d.you.isCrit ? ' crit!' : ''}) · Opponent ${d.opponent.action} (${fmt(d.opponent.damage)})`);
        },
        onEnd: (d) => {
            clearInterval(countdown);
            const won = d.winnerId && d.you && d.winnerId === d.you.userId;
            const draw = !d.winnerId;
            const change = d.you?.ratingChange ?? 0;
            root.querySelector('.pvp-result-title').textContent = draw ? 'Draw' : won ? 'Victory! 🏆' : 'Defeat';
            root.querySelector('.pvp-result-rating').textContent = `ELO ${change >= 0 ? '+' : ''}${change}`;
            // Update local user record so the lobby reflects the result immediately.
            const u = getCurrentUser();
            if (u) { u.pvpRating = (u.pvpRating ?? 1000) + change; if (!draw) { if (won) u.pvpWins = (u.pvpWins ?? 0) + 1; else u.pvpLosses = (u.pvpLosses ?? 0) + 1; } }
            show('result');
        },
        onLeaderboard: (list) => renderLeaderboard(list),
    });
}

function renderLeaderboard(list) {
    const box = root.querySelector('#pvp-lb-list');
    if (!box) return;
    clear(box);
    if (!list || list.length === 0) { box.appendChild(h('p', { className: 'muted', text: 'No ranked players yet — be the first!' })); return; }
    list.forEach((p, i) => box.appendChild(h('div', { className: 'pvp-lb-row' },
        h('span', { className: 'pvp-lb-rank', text: `#${i + 1}` }),
        h('span', { className: 'pvp-lb-name', text: p.username }),
        h('span', { className: 'pvp-lb-elo', text: `${fmt(p.rating)} ELO` }),
    )));
}
