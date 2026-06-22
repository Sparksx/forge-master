// Arena screen — PvE ladder with an animated auto-resolved duel.
import { h, clear, fmt, toast } from './components.js';
import { avatarEmoji, arenaEnemyPower } from '../game/config.js';
import { getAvatar, getArenaRank, getHighestArenaRank, setArenaRank, getPowerScore, getCombatStats, grantGold } from '../game/state.js';
import { fightArena, makeEnemy } from '../game/arena.js';
import { gameEvents, EVENTS } from '../events.js';

let root = null;
let busy = false;
let auto = false;

export const id = 'arena';
export const icon = '⚔️';
export const label = 'Arena';

export function render(container) {
    root = container;
    clear(root);
    root.appendChild(h('div', { className: 'arena-screen' },
        h('div', { className: 'arena-head' },
            h('div', { className: 'arena-rank' }, h('span', { className: 'arena-rank-num', text: `Rank ${getArenaRank()}` }),
                h('span', { className: 'arena-rank-best', text: `Best: ${getHighestArenaRank()}` })),
            h('button', { className: 'btn btn-ghost auto-toggle', text: 'Auto: Off', onclick: toggleAuto }),
        ),
        buildArena(),
        h('div', { className: 'arena-log', id: 'arena-log' }),
        h('button', { className: 'btn btn-primary btn-block fight-btn', text: '⚔️ Fight', onclick: () => startFight() }),
    ));
    refresh();
}

function buildArena() {
    const fighter = (side, name, emoji) => h('div', { className: `fighter fighter-${side}` },
        h('div', { className: 'fighter-avatar', dataset: { side }, text: emoji }),
        h('div', { className: 'fighter-name', dataset: { side }, text: name }),
        h('div', { className: 'hpbar' }, h('div', { className: 'hpfill', dataset: { side } }), h('span', { className: 'hptext', dataset: { side } })),
        h('div', { className: 'fighter-floaters', dataset: { side } }),
    );
    return h('div', { className: 'arena-stage' },
        fighter('player', 'You', avatarEmoji(getAvatar())),
        h('div', { className: 'arena-vs', text: 'VS' }),
        fighter('enemy', 'Enemy', '👹'),
    );
}

export function refresh() {
    if (!root || !root.querySelector('.arena-stage')) return;
    if (busy) return;
    const rank = getArenaRank();
    const enemy = makeEnemy(rank);
    const player = getCombatStats();

    root.querySelector('.arena-rank-num').textContent = `Rank ${rank}`;
    root.querySelector('.arena-rank-best').textContent = `Best: ${getHighestArenaRank()}`;
    setFighter('player', avatarEmoji(getAvatar()), `You · ${fmt(getPowerScore())} pwr`, player.maxHP, player.maxHP);
    setFighter('enemy', enemy.emoji, `${enemy.name} · ${fmt(enemy.power)} pwr`, enemy.maxHP, enemy.maxHP);

    const playerStronger = getPowerScore() >= arenaEnemyPower(rank);
    const log = root.querySelector('#arena-log');
    clear(log);
    log.appendChild(h('p', { className: 'muted', text: playerStronger ? 'You look stronger than this opponent.' : 'This opponent looks tough — forge better gear!' }));
}

function setFighter(side, emoji, name, hp, maxHP) {
    root.querySelector(`.fighter-avatar[data-side="${side}"]`).textContent = emoji;
    root.querySelector(`.fighter-name[data-side="${side}"]`).textContent = name;
    setHp(side, hp, maxHP);
}

function setHp(side, hp, maxHP) {
    const pct = Math.max(0, Math.min(100, (hp / maxHP) * 100));
    root.querySelector(`.hpfill[data-side="${side}"]`).style.width = `${pct}%`;
    root.querySelector(`.hptext[data-side="${side}"]`).textContent = `${fmt(Math.max(0, Math.round(hp)))}/${fmt(maxHP)}`;
}

function floater(side, text, crit) {
    const wrap = root.querySelector(`.fighter-floaters[data-side="${side}"]`);
    const f = h('span', { className: `floater ${crit ? 'crit' : ''}`, text });
    wrap.appendChild(f);
    setTimeout(() => f.remove(), 700);
}

function toggleAuto() {
    auto = !auto;
    const btn = root.querySelector('.auto-toggle');
    btn.textContent = `Auto: ${auto ? 'On' : 'Off'}`;
    btn.classList.toggle('on', auto);
    if (auto && !busy) startFight();
}

async function startFight() {
    if (busy) return;
    busy = true;
    const fightBtn = root.querySelector('.fight-btn');
    fightBtn.disabled = true;

    const result = fightArena();
    const { events, player, enemy } = result;
    setHp('player', player.maxHP, player.maxHP);
    setHp('enemy', enemy.maxHP, enemy.maxHP);

    // Compress very long fights so playback stays snappy.
    const step = events.length > 24 ? Math.ceil(events.length / 24) : 1;
    for (let i = 0; i < events.length; i += step) {
        const ev = events[i];
        await sleep(120);
        if (ev.by === 'player') { setHp('enemy', ev.eHp, enemy.maxHP); floater('enemy', `-${fmt(ev.dmg)}`, ev.crit); if (ev.heal) floater('player', `+${fmt(ev.heal)}`, false); }
        else { setHp('player', ev.pHp, player.maxHP); floater('player', `-${fmt(ev.dmg)}`, ev.crit); }
    }
    const last = events[events.length - 1];
    if (last) { setHp('player', last.pHp, player.maxHP); setHp('enemy', last.eHp, enemy.maxHP); }

    await sleep(250);
    resolveFight(result);
    fightBtn.disabled = false;
    busy = false;
    if (auto) setTimeout(() => { if (auto) startFight(); }, 600);
}

function resolveFight(result) {
    const log = root.querySelector('#arena-log');
    clear(log);
    const granted = grantGold(result.reward);
    if (result.win) {
        const newRank = result.rank + 1;
        setArenaRank(newRank);
        toast(`Victory! +${fmt(granted)} gold`, 'success');
        log.appendChild(h('p', { className: 'log-win', text: `🏆 Defeated rank ${result.rank}! +${fmt(granted)} gold · advancing to rank ${newRank}.` }));
    } else {
        toast(`Defeated · +${fmt(granted)} gold`, 'error');
        log.appendChild(h('p', { className: 'log-lose', text: `💀 Lost at rank ${result.rank}. +${fmt(granted)} gold. Forge stronger gear and try again.` }));
        auto = false;
        const btn = root.querySelector('.auto-toggle');
        if (btn) { btn.textContent = 'Auto: Off'; btn.classList.remove('on'); }
    }
    gameEvents.emit(EVENTS.ARENA_RESULT, result);
    // Refresh the stage for the next opponent after a short beat.
    setTimeout(() => { if (!busy) refresh(); }, auto ? 0 : 1400);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
