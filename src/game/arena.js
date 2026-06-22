// Arena: a PvE ladder. Auto-resolved duels against scaling opponents.
import { arenaEnemyPower, arenaReward } from './config.js';
import { getCombatStats, getArenaRank } from './state.js';

const ENEMY_NAMES = [
    'Goblin Scrapper', 'Cave Lurker', 'Bandit Brute', 'Iron Sentinel', 'Frost Warden',
    'Ember Stalker', 'Bog Horror', 'Dune Reaver', 'Storm Drake', 'Void Knight',
    'Ashen Tyrant', 'Obsidian Golem', 'Plague Revenant', 'Crimson Wyrm', 'Eclipse Herald',
];
const ENEMY_EMOJI = ['👹', '🦇', '🗡️', '🤖', '❄️', '🔥', '🐸', '🦂', '🐲', '⚔️', '👺', '🪨', '🧟', '🐉', '🌑'];

/** Build an enemy whose stats track a target power for the given rank. */
export function makeEnemy(rank) {
    const power = arenaEnemyPower(rank);
    const i = (rank - 1) % ENEMY_NAMES.length;
    return {
        name: `${ENEMY_NAMES[i]} ${rank >= ENEMY_NAMES.length ? '+' + Math.floor(rank / ENEMY_NAMES.length) : ''}`.trim(),
        emoji: ENEMY_EMOJI[i],
        power,
        maxHP: Math.round(power * 0.7) + 120,
        damage: Math.round(power * 0.16) + 9,
        critChance: Math.min(25, rank * 0.6),
        critMultiplier: 50,
        attackSpeed: 0,
        lifeSteal: 0,
        healthRegen: 0,
    };
}

function attackDamage(att) {
    let dmg = att.damage;
    let crit = false;
    if (att.critChance > 0 && Math.random() * 100 < att.critChance) {
        dmg = Math.floor(dmg * (1 + att.critMultiplier / 100));
        crit = true;
    }
    dmg = Math.max(1, Math.floor(dmg * (0.9 + Math.random() * 0.2)));
    return { dmg, crit };
}

/**
 * Simulate a duel. Returns { win, events, player, enemy }.
 * events: [{ by:'player'|'enemy', dmg, crit, heal, pHp, eHp }] in time order.
 */
export function simulateDuel(player, enemy) {
    const p = { ...player, hp: player.maxHP };
    const e = { ...enemy, hp: enemy.maxHP };
    const pInterval = 1 / (1 + (p.attackSpeed || 0) / 100);
    const eInterval = 1;
    let pNext = pInterval;
    let eNext = eInterval;
    let lastTime = 0;
    const events = [];
    const MAX_EVENTS = 300;

    const regen = (who, now) => {
        const pct = (who.healthRegen || 0) / 100;
        if (pct <= 0) return;
        who.hp = Math.min(who.maxHP, who.hp + who.maxHP * pct * (now - lastTime) * 0.1);
    };

    while (p.hp > 0 && e.hp > 0 && events.length < MAX_EVENTS) {
        const now = Math.min(pNext, eNext);
        regen(p, now);
        lastTime = now;

        if (pNext <= eNext) {
            const { dmg, crit } = attackDamage(p);
            e.hp = Math.max(0, e.hp - dmg);
            let heal = 0;
            if (p.lifeSteal > 0) { heal = Math.floor(dmg * p.lifeSteal / 100); p.hp = Math.min(p.maxHP, p.hp + heal); }
            events.push({ by: 'player', dmg, crit, heal, pHp: p.hp, eHp: e.hp });
            pNext += pInterval;
        } else {
            const { dmg, crit } = attackDamage(e);
            p.hp = Math.max(0, p.hp - dmg);
            events.push({ by: 'enemy', dmg, crit, heal: 0, pHp: p.hp, eHp: e.hp });
            eNext += eInterval;
        }
    }

    const win = e.hp <= 0 ? true : p.hp <= 0 ? false : (p.hp / p.maxHP) >= (e.hp / e.maxHP);
    return { win, events, player, enemy };
}

/** Run a fight at the current rank. Reward is returned for the caller to grant. */
export function fightArena(rank = getArenaRank()) {
    const player = getCombatStats();
    const enemy = makeEnemy(rank);
    const result = simulateDuel(player, enemy);
    result.rank = rank;
    result.reward = result.win ? arenaReward(rank) : Math.floor(arenaReward(rank) * 0.25);
    return result;
}
