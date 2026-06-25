// Arena: a PvE ladder. The hero faces a pre-generated, level-dependent *group*
// of enemies (home mode is 1 hero vs many). Combat is auto-resolved on a real
// time line — every fighter lands ~1 hit/sec at base — and ranged fighters
// (bows, casters, distance mobs) open the fight sooner than melee.
import {
    arenaEnemyPower, rankKind, seededRng, BOSS_INTERVAL,
    BOSS_LEAD_SHARE, BIG_BOSS_LEAD_SHARE, ESCORT_SHARE, MAX_GROUP,
} from './config.js';
// Combat resolution now lives in the shared deterministic engine so the server
// runs the exact same fight. Re-exported here for back-compat with callers/tests
// that have always imported these from arena.js.
export { computeHit, simulateBattle, simulateDuel } from '../../shared/combat.js';

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

/**
 * Gold reward for an encounter — a tiny "gift", never a faucet. Only bosses pay
 * out, only on a win, and only a handful of gold that grows very slowly with
 * depth. Normal packs — and any loss — drop nothing.
 */
export function encounterReward(rank, kind, win) {
    if (!win || kind === 'normal') return 0;
    const steps = Math.floor(rank / BOSS_INTERVAL); // 1 at the first boss, +1 per boss rank
    return kind === 'bigboss' ? 25 + steps * 5 : 8 + steps * 2;
}
