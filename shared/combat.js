// Deterministic combat engine — SHARED between client and server.
//
// A fight is fully determined by its inputs: (allies, enemies, seed). Given the
// same stat blocks and the same seed, `simulateBattle` always produces the exact
// same outcome AND the exact same `events` timeline — so a fight can be replayed
// identically anywhere (the PvE idle battler, the PvP animation, and the
// server's authoritative anti-cheat resolution all agree).
//
// Lives in shared/ (not src/game/) so the Node server can import the same engine
// it uses for stat math (shared/stats.js) without reaching into client code.
import { BASE_ATTACK_PERIOD, MAX_BATTLE_SECONDS, RANGED_OPENING_FRACTION } from './stats.js';

// Tiny deterministic PRNG (mulberry32). A given seed yields a fixed stream, so a
// fight seeded with it is exactly replayable. Re-exported by src/game/config.js
// for the client callers that historically imported it from there.
export function seededRng(seed) {
    let a = (seed >>> 0) || 1;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/**
 * Roll one attack's damage for a fighter (crit + ±10% variance).
 * `rnd` is an injectable [0,1) generator so callers can drive it from a seeded
 * PRNG and get deterministic, replayable results (defaults to Math.random).
 */
export function computeHit(att, rnd = Math.random) {
    let dmg = att.damage;
    let crit = false;
    if (att.critChance > 0 && rnd() * 100 < att.critChance) {
        dmg = Math.floor(dmg * (1 + att.critMultiplier / 100));
        crit = true;
    }
    dmg = Math.max(1, Math.floor(dmg * (0.9 + rnd() * 0.2)));
    return { dmg, crit };
}

/** Seconds between a fighter's attacks (Attack Speed shortens the interval). */
export const attackPeriod = (c) => BASE_ATTACK_PERIOD / (1 + (c.attackSpeed || 0) / 100);

/**
 * Simulate a group battle (N allies vs M enemies) on a seconds time line.
 * Each fighter attacks every ~BASE_ATTACK_PERIOD seconds (1 hit/sec base);
 * everyone fires the instant they have focus — ranged at t=0, melee after a
 * short approach — then a full period between shots. Fighters focus-fire the first
 * living foe. Returns { win, events, duration, allies, enemies }.
 *
 * Pass `seed` to make the fight fully deterministic/replayable (every crit and
 * damage roll comes from the seeded stream). Omit it for a one-off random fight.
 *
 * events: [{ t, by, bySide, target, targetSide, dmg, crit, heal, ranged,
 *            attackerHp, targetHp }] in time order. `by`/`target` are entity ids.
 */
export function simulateBattle(allies, enemies, seed) {
    const rnd = seed == null ? Math.random : seededRng(seed);
    const mk = (c, side, i) => ({
        ...c,
        id: c.id || `${side}${i}`,
        side,
        hp: c.maxHP,
        // Fire on focus: ranged have it at range (t=0); melee fire after a short
        // approach. After each shot `next` advances one full period.
        next: (c.ranged ? 0 : RANGED_OPENING_FRACTION) * attackPeriod(c),
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

        // Resolve one shot against the current first living foe. Returns false
        // when there is nothing left to hit. `double` flags the extra shot.
        const strike = (double) => {
            const foes = actor.side === 'ally' ? aliveOf(E) : aliveOf(A);
            if (!foes.length) return false;
            const target = foes[0];
            const { dmg, crit } = computeHit(actor, rnd);
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
                dmg, crit, heal, ranged: !!actor.ranged, double,
                attackerHp: actor.hp, targetHp: target.hp,
            });
            return true;
        };

        if (!strike(false)) break;
        // Double Hit: a chance to fire a second, fully independent shot in the
        // same instant — its own crit roll and its own target (it re-acquires the
        // first living foe, so it spills onto the next enemy if the first dropped).
        // Only fighters that carry the stat ever roll, so seeded fights without it
        // are byte-identical to before.
        if (actor.doubleHit > 0 && rnd() * 100 < actor.doubleHit) {
            strike(true);
        }
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
export function simulateDuel(player, enemy, seed) {
    const r = simulateBattle(
        [{ ...player, id: 'p', ranged: !!player.ranged }],
        [{ ...enemy, id: 'e', ranged: !!enemy.ranged }],
        seed,
    );
    const events = r.events.map((ev) => ev.bySide === 'ally'
        ? { by: 'player', dmg: ev.dmg, crit: ev.crit, heal: ev.heal, double: ev.double, pHp: ev.attackerHp, eHp: ev.targetHp }
        : { by: 'enemy', dmg: ev.dmg, crit: ev.crit, heal: 0, double: ev.double, pHp: ev.targetHp, eHp: ev.attackerHp });
    return { win: r.win, events, player, enemy };
}
