// Arena: a PvE ladder. The hero faces a pre-generated, level-dependent *group*
// of enemies (home mode is 1 hero vs many). Combat is auto-resolved on a real
// time line — every fighter lands ~0.5 hits/sec at base — and ranged fighters
// (bows, casters, distance mobs) open the fight sooner than melee.
import {
    arenaEnemyPower, arenaReward, rankKind, seededRng,
    BOSS_LEAD_SHARE, BIG_BOSS_LEAD_SHARE, ESCORT_SHARE, MAX_GROUP,
    BASE_ATTACK_PERIOD, MAX_BATTLE_SECONDS, RANGED_OPENING_FRACTION,
} from './config.js';

// Melee minion flavour.
const MELEE_NAMES = [
    'Goblin Scrapper', 'Cave Lurker', 'Bandit Brute', 'Iron Sentinel', 'Frost Warden',
    'Ember Stalker', 'Bog Horror', 'Dune Reaver', 'Storm Drake', 'Void Knight',
];
const MELEE_EMOJI = ['👹', '🦇', '🗡️', '🤖', '❄️', '🔥', '🐸', '🦂', '🐲', '⚔️'];

// Ranged minion flavour — these attack from a distance.
const RANGED_NAMES = [
    'Goblin Archer', 'Crossbow Raider', 'Dart Slinger', 'Spore Lobber', 'Hex Caster',
    'Bone Flinger', 'Frost Sniper', 'Wisp Conjurer',
];
const RANGED_EMOJI = ['🏹', '🎯', '🪃', '🍄', '🪄', '💀', '🌬️', '👻'];

// Boss flavour (every 10th rank).
const BOSS_NAMES = ['Warlord', 'Dread Knight', 'Obsidian Golem', 'Plague Tyrant', 'Crimson Wyrm'];
const BOSS_EMOJI = ['👺', '🗿', '🪨', '🧟', '🐉'];

// Big-boss flavour (every 50th rank).
const BIG_BOSS_NAMES = ['Ancient Wyrm', 'World Eater', 'Titan Overlord', 'Eclipse Herald'];
const BIG_BOSS_EMOJI = ['🐉', '🦖', '👾', '🌑'];

const pick = (arr, n) => arr[Math.abs(Math.floor(n)) % arr.length];

/** Build one combat-ready enemy from a power budget + role. */
function buildEnemy({ rank, power, role, ranged, index, name, emoji }) {
    const hpMult = role === 'bigboss' ? 1.15 : role === 'boss' ? 0.95 : 0.7;
    const dmgMult = role === 'bigboss' ? 0.15 : role === 'boss' ? 0.15 : 0.16;
    const floorHP = role === 'normal' ? 120 : 220;
    return {
        id: `m${index}`,
        name,
        emoji,
        power: Math.round(power),
        role,
        ranged: !!ranged,
        maxHP: Math.round(power * hpMult) + floorHP,
        damage: Math.round(power * dmgMult) + 9,
        critChance: Math.min(25, rank * 0.6),
        critMultiplier: 50,
        attackSpeed: 0,
        lifeSteal: 0,
        healthRegen: role === 'bigboss' ? 2 : 0,
    };
}

/**
 * Pre-generate the enemy group for a rank. Deterministic: the same rank always
 * yields the same line-up (seeded by the rank). Normal ranks field a small pack
 * of minions; every 10th rank is a Boss and every 50th a Big Boss, each escorted
 * by a couple of minions.
 */
export function makeEncounter(rank) {
    const kind = rankKind(rank);
    const rng = seededRng(rank * 2654435761);
    const budget = arenaEnemyPower(rank);
    const enemies = [];
    let index = 0;

    if (kind === 'normal') {
        // 1 enemy through the early ranks, growing to a small pack later.
        const count = Math.min(3, 1 + Math.floor((rank - 1) / 8));
        const share = budget / count;
        for (let i = 0; i < count; i++) {
            const ranged = rng() < 0.38;
            const names = ranged ? RANGED_NAMES : MELEE_NAMES;
            const emoji = ranged ? RANGED_EMOJI : MELEE_EMOJI;
            const n = Math.floor(rng() * names.length);
            const suffix = rank > names.length ? ` +${Math.floor(rank / names.length)}` : '';
            enemies.push(buildEnemy({
                rank, power: share, role: 'normal', ranged, index: index++,
                name: `${pick(names, n)}${suffix}`.trim(), emoji: pick(emoji, n),
            }));
        }
    } else {
        const big = kind === 'bigboss';
        const lead = budget * (big ? BIG_BOSS_LEAD_SHARE : BOSS_LEAD_SHARE);
        const names = big ? BIG_BOSS_NAMES : BOSS_NAMES;
        const emoji = big ? BIG_BOSS_EMOJI : BOSS_EMOJI;
        const n = Math.floor(rng() * names.length);
        const interval = big ? 50 : 10;
        enemies.push(buildEnemy({
            rank, power: lead, role: kind, ranged: rng() < 0.45, index: index++,
            name: `${pick(names, n)} ${Math.floor(rank / interval)}`.trim(), emoji: pick(emoji, n),
        }));
        // Escorts: a couple of minions sharing a slice of the budget.
        const escorts = Math.min(MAX_GROUP - 1, big ? 2 : 1);
        for (let i = 0; i < escorts; i++) {
            const ranged = rng() < 0.5;
            const mn = ranged ? RANGED_NAMES : MELEE_NAMES;
            const me = ranged ? RANGED_EMOJI : MELEE_EMOJI;
            const k = Math.floor(rng() * mn.length);
            enemies.push(buildEnemy({
                rank, power: budget * ESCORT_SHARE, role: 'normal', ranged, index: index++,
                name: pick(mn, k), emoji: pick(me, k),
            }));
        }
    }

    return { rank, kind, enemies };
}

/** The lead enemy for a rank (kept for the matchup preview / legacy callers). */
export function makeEnemy(rank) {
    return makeEncounter(rank).enemies[0];
}

/** Roll one attack's damage for a fighter (crit + ±10% variance). */
export function computeHit(att) {
    let dmg = att.damage;
    let crit = false;
    if (att.critChance > 0 && Math.random() * 100 < att.critChance) {
        dmg = Math.floor(dmg * (1 + att.critMultiplier / 100));
        crit = true;
    }
    dmg = Math.max(1, Math.floor(dmg * (0.9 + Math.random() * 0.2)));
    return { dmg, crit };
}

/** Gold reward for clearing (or losing) an encounter of the given kind/rank. */
export function encounterReward(rank, kind, win) {
    const base = arenaReward(rank);
    const mult = kind === 'bigboss' ? 3 : kind === 'boss' ? 1.8 : 1;
    return win ? Math.round(base * mult) : Math.floor(base * 0.25);
}

const attackPeriod = (c) => BASE_ATTACK_PERIOD / (1 + (c.attackSpeed || 0) / 100);

/**
 * Simulate a group battle (N allies vs M enemies) on a seconds time line.
 * Each fighter attacks every ~BASE_ATTACK_PERIOD seconds (0.5 hits/sec base);
 * ranged fighters fire their first shot early. Fighters focus-fire the first
 * living foe. Returns { win, events, duration, allies, enemies }.
 *
 * events: [{ t, by, bySide, target, targetSide, dmg, crit, heal, ranged,
 *            attackerHp, targetHp }] in time order. `by`/`target` are entity ids.
 */
export function simulateBattle(allies, enemies) {
    const mk = (c, side, i) => ({
        ...c,
        id: c.id || `${side}${i}`,
        side,
        hp: c.maxHP,
        // Ranged fighters get a head start; melee wait a full period.
        next: (c.ranged ? RANGED_OPENING_FRACTION : 1) * attackPeriod(c),
    });
    const A = allies.map((c, i) => mk(c, 'ally', i));
    const E = enemies.map((c, i) => mk(c, 'enemy', i));
    const all = [...A, ...E];
    const aliveOf = (arr) => arr.filter((c) => c.hp > 0);
    const events = [];
    const MAX_EVENTS = 400;
    let last = 0;

    const regenAll = (now) => {
        const dt = now - last;
        if (dt <= 0) return;
        for (const c of all) {
            if (c.hp <= 0) continue;
            const pct = (c.healthRegen || 0) / 100;
            if (pct > 0) c.hp = Math.min(c.maxHP, c.hp + c.maxHP * pct * dt * 0.1);
        }
    };

    while (aliveOf(A).length && aliveOf(E).length && events.length < MAX_EVENTS) {
        // Next to act = lowest scheduled time among living fighters.
        let actor = null;
        for (const c of all) {
            if (c.hp <= 0) continue;
            if (!actor || c.next < actor.next) actor = c;
        }
        if (!actor) break;
        const now = actor.next;
        if (now > MAX_BATTLE_SECONDS) break;
        regenAll(now);
        last = now;

        const foes = actor.side === 'ally' ? aliveOf(E) : aliveOf(A);
        if (!foes.length) break;
        const target = foes[0];

        const { dmg, crit } = computeHit(actor);
        target.hp = Math.max(0, target.hp - dmg);
        let heal = 0;
        if (actor.lifeSteal > 0) {
            heal = Math.floor(dmg * actor.lifeSteal / 100);
            actor.hp = Math.min(actor.maxHP, actor.hp + heal);
        }
        events.push({
            t: now,
            by: actor.id, bySide: actor.side,
            target: target.id, targetSide: target.side,
            dmg, crit, heal, ranged: !!actor.ranged,
            attackerHp: actor.hp, targetHp: target.hp,
        });
        actor.next += attackPeriod(actor);
    }

    const frac = (arr) => {
        const hp = arr.reduce((s, c) => s + Math.max(0, c.hp), 0);
        const max = arr.reduce((s, c) => s + c.maxHP, 0) || 1;
        return hp / max;
    };
    const win = aliveOf(E).length === 0 ? true
        : aliveOf(A).length === 0 ? false
            : frac(A) >= frac(E);

    return { win, events, duration: last, allies: A, enemies: E };
}

/**
 * 1v1 compatibility wrapper over simulateBattle. Returns the legacy event shape
 * ({ by:'player'|'enemy', dmg, crit, heal, pHp, eHp }) used by older callers.
 */
export function simulateDuel(player, enemy) {
    const r = simulateBattle(
        [{ ...player, id: 'p', ranged: !!player.ranged }],
        [{ ...enemy, id: 'e', ranged: !!enemy.ranged }],
    );
    const events = r.events.map((ev) => ev.bySide === 'ally'
        ? { by: 'player', dmg: ev.dmg, crit: ev.crit, heal: ev.heal, pHp: ev.attackerHp, eHp: ev.targetHp }
        : { by: 'enemy', dmg: ev.dmg, crit: ev.crit, heal: 0, pHp: ev.targetHp, eHp: ev.attackerHp });
    return { win: r.win, events, player, enemy };
}
