// Dungeon — a 2D top-down combat zone rendered on a canvas, driven in REAL TIME.
// There is NO player control. The lone hero pathfinds toward the nearest living
// enemy and attacks it; each enemy independently patrols until the hero enters
// its aggro range, then closes in (melee) or holds a standoff (ranged) and
// fires. Everyone moves and attacks on their own cadence — fighters are fully
// independent, and a far-off enemy keeps doing its own thing while the hero
// trades blows with the one beside it.
//
// Combat math (damage rolls, ~1 hit/sec cadence) comes from the model
// (src/game/arena.js + shared/stats.js); this module owns positions, timing,
// and rendering. It reports the outcome back to the owning screen via
// onResolve({ win }) once a fight ends.
import { computeHit } from '../game/arena.js';
import { BASE_ATTACK_PERIOD, seededRng, EXECUTE_HP_THRESHOLD, MAX_DAMAGE_REDUCTION } from '../game/config.js';
import { getArena, pickArenaId } from '../game/arenas.js';

// Fixed simulation step (seconds). The fight is stepped in fixed increments,
// decoupled from the render framerate, so a given (input, seed) always yields
// the exact same sequence of moves — the basis for deterministic replay (PvP).
const SIM_DT = 1 / 60;

// Logical room grid (tiles). The canvas scales to fit; tile size is derived.
const COLS = 15;
const ROWS = 9;
// How close (in tiles) the hero must get before a passive enemy aggros.
const AGGRO_TILES = 3;
// Ranged fighters attack from (and hold) roughly this distance, in tiles.
const RANGED_STANDOFF = 3.0;

const now = () => Date.now();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * @param {object} opts
 * @param {(r: {win: boolean}) => void} opts.onResolve  called once per fight.
 */
export function createDungeon({ onResolve } = {}) {
    // ── DOM ──────────────────────────────────────────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.className = 'dungeon-canvas';
    const ctx = canvas.getContext('2d');

    const el = document.createElement('div');
    el.className = 'dungeon';
    el.appendChild(canvas);

    // ── World state ──────────────────────────────────────────────────────────
    let tile = 24;          // px per tile (recomputed on resize)
    // Scenery (pillar layout + colour theme) is chosen per fight in setMatchup;
    // start on the default arena so the room is valid before the first matchup.
    let arena = getArena();
    let walls = buildWalls(arena.pillars);
    let theme = arena.theme;
    const player = newEntity({ id: 'player', emoji: '🧙', facing: 1 });
    let enemies = [];       // array of enemy entities
    const floaters = [];    // { x, y, vy, text, color, bornAt }
    const slashes = [];     // { x, y, bornAt, hostile }
    const shots = [];       // ranged projectiles { x, y, tx, ty, bornAt, dur, hostile }

    let fast = false;
    let started = false;
    let active = false;     // a fight is in progress (entities act)
    let resolved = false;   // outcome already reported for the current fight
    let outcome = null;     // 'win' | 'lose' once the fight ends (drives the banner)
    let outcomeAt = 0;      // wall-clock time the outcome was decided
    let simClock = 0;       // deterministic seconds elapsed in the current fight
    let rng = Math.random;  // seeded per-fight so combat is replayable
    let accumulator = 0;    // leftover real time waiting to be stepped

    // ── Replay mode (PvP) ──────────────────────────────────────────────────────
    // When a matchup carries a precomputed `events` list, the dungeon does NOT
    // roll its own combat: it animates that authoritative timeline (HP, crits and
    // deaths come straight from the log) so the on-screen fight can never disagree
    // with the server's verdict. Movement stays procedural, purely for flavour.
    let replayMode = false;
    let replayEvents = [];
    let replayIdx = 0;
    let replayWin = false;

    function newEntity(over = {}) {
        return {
            id: '', x: 0, y: 0, r: 10, emoji: '👹', label: '', hp: 1, maxHP: 1,
            // combat stats
            damage: 1, critChance: 0, critMultiplier: 0, attackSpeed: 0,
            lifeSteal: 0, healthRegen: 0, ranged: false, role: 'normal',
            cooldown: 0,            // seconds until this fighter can attack again
            // animation / ai
            lungeAt: 0, lungeDir: { x: -1, y: 0 }, facing: -1, cheerAt: 0,
            alive: true, deathAt: 0, wanderAt: 0, wander: { x: 0, y: 0 }, aggro: false,
            ...over,
        };
    }

    const aliveEnemies = () => enemies.filter((e) => e.alive);
    const nearestEnemy = () => {
        let best = null, bestD = Infinity;
        for (const e of aliveEnemies()) {
            const d = dist(player, e);
            if (d < bestD) { bestD = d; best = e; }
        }
        return best;
    };
    const attackPeriod = (c) => BASE_ATTACK_PERIOD / (1 + (c.attackSpeed || 0) / 100);
    // How close a fighter must be to its target to land a blow.
    const reachOf = (atk, target) => (atk.ranged ? RANGED_STANDOFF * tile : atk.r + target.r + 4);

    // ── Sizing ───────────────────────────────────────────────────────────────
    function resize() {
        const cssW = el.clientWidth || 320;
        tile = cssW / COLS;
        const cssH = tile * ROWS;
        const dpr = Math.min(2, window.devicePixelRatio || 1);
        canvas.style.height = `${cssH}px`;
        canvas.width = Math.round(cssW * dpr);
        canvas.height = Math.round(cssH * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        const r = tile * 0.34;
        player.r = r;
        for (const e of enemies) e.r = r;
    }

    // ── Public API ───────────────────────────────────────────────────────────
    function mount(host) {
        host.appendChild(el);
        resize();
    }

    function setFast(v) { fast = v; }

    /**
     * Begin a fresh fight. The hero spawns on the LEFT side of the room and the
     * whole enemy pack spawns down the RIGHT side — a clean every-fight reset.
     * payload = { seed?, player: {emoji,label,maxHP,...stats}, enemies: [{id,emoji,label,maxHP,...stats,role}] }.
     *
     * The fight is fully deterministic in (input, seed): pass an explicit
     * `payload.seed` to replay an exact animation (e.g. a PvP match both clients
     * must see identically); omit it and a seed is derived from the line-up, so
     * the same matchup always plays out the same way.
     */
    function setMatchup(payload) {
        resize();
        resolved = false;
        active = true;
        outcome = null;
        simClock = 0;
        accumulator = 0;
        const seed = payload.seed != null ? payload.seed : seedFromPayload(payload);
        rng = seededRng(seed);
        floaters.length = 0; slashes.length = 0; shots.length = 0;

        // Stage the fight in an arena. An explicit `payload.arena` wins (PvE picks
        // one per fight); otherwise derive it from the seed so seed-shared fights
        // (PvP replays on every client) render the identical room.
        arena = getArena(payload.arena != null ? payload.arena : pickArenaId(seed));
        walls = buildWalls(arena.pillars);
        theme = arena.theme;

        // PvP replay: animate a precomputed authoritative timeline instead of
        // rolling combat live. `payload.win` is the result from the hero's side.
        replayMode = Array.isArray(payload.events);
        replayEvents = replayMode ? payload.events : [];
        replayIdx = 0;
        replayWin = !!payload.win;

        // Hero on the left, full HP, ready to strike the instant focus is acquired.
        applyStats(player, payload.player);
        player.alive = true;
        player.deathAt = 0;
        player.cheerAt = 0;
        player.lungeAt = 0;
        player.hp = player.maxHP;
        player.facing = 1;
        player.cooldown = 0;            // fire on first contact, then a full period between shots
        const hp = tileCenter(2, Math.floor(ROWS / 2));
        player.x = hp.x; player.y = hp.y;

        // Rebuild the enemy roster on the right side, spread along the column.
        enemies = payload.enemies.map((spec, i) => {
            const e = newEntity();
            applyStats(e, spec);
            e.r = player.r;
            e.hp = e.maxHP;
            e.alive = true;
            // In a replay both duellists are already engaged (no patrol/aggro).
            e.aggro = replayMode;
            e.facing = -1;
            e.cooldown = 0;            // fires the instant it reaches firing range
            const sp = rightSpawn(i, payload.enemies.length);
            e.x = sp.x; e.y = sp.y;
            return e;
        });
    }

    function applyStats(e, spec) {
        e.id = spec.id || e.id;
        e.emoji = spec.emoji;
        e.label = spec.label || '';
        e.maxHP = spec.maxHP;
        e.damage = spec.damage || 1;
        e.critChance = spec.critChance || 0;
        e.critMultiplier = spec.critMultiplier || 0;
        e.attackSpeed = spec.attackSpeed || 0;
        e.lifeSteal = spec.lifeSteal || 0;
        e.healthRegen = spec.healthRegen || 0;
        e.doubleHit = spec.doubleHit || 0;
        e.damageReduction = spec.damageReduction || 0;
        e.reflect = spec.reflect || 0;
        e.execute = spec.execute || 0;
        e.ranged = !!spec.ranged;
        e.role = spec.role || 'normal';
    }

    // Derive a stable integer seed from the matchup so the same line-up always
    // plays out identically when no explicit seed is supplied.
    function seedFromPayload(payload) {
        const parts = [payload.player, ...payload.enemies].map((c) =>
            [c.id, c.maxHP, c.damage, c.critChance, c.critMultiplier, c.attackSpeed,
                c.lifeSteal, c.healthRegen, c.ranged ? 1 : 0].join(','));
        const str = parts.join('|');
        let h = 2166136261;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return h >>> 0;
    }

    /** Spawn floating text over an entity (used by the screen for reward popups). */
    function floater(id, text, cls = '') {
        const target = id === 'player' ? player : enemies.find((e) => e.id === id);
        if (!target) return;
        spawnFloater(target, text, cls === 'player' ? '' : cls, id === 'player');
    }

    function start() {
        if (started) return;
        started = true;
        resize();
        window.addEventListener('resize', resize);
        last = now();
        raf = requestAnimationFrame(loop);
    }

    function stop() {
        started = false;
        window.removeEventListener('resize', resize);
        if (raf) cancelAnimationFrame(raf);
        raf = null;
    }

    // ── Simulation ───────────────────────────────────────────────────────────
    let raf = null;
    let last = 0;

    function loop() {
        const t = now();
        const frame = Math.min(0.1, (t - last) / 1000);
        last = t;
        // Step the sim in FIXED increments so the outcome/animation is identical
        // regardless of display framerate (deterministic replay).
        accumulator += frame * (fast ? 1.7 : 1);
        let steps = 0;
        while (accumulator >= SIM_DT && steps < 8) {
            update(SIM_DT);
            accumulator -= SIM_DT;
            steps++;
        }
        draw();
        if (started) raf = requestAnimationFrame(loop);
    }

    function update(dt) {
        const t = now();

        if (active && replayMode) {
            simClock += dt;
            stepReplay(dt);
        } else if (active) {
            simClock += dt;
            // Hero acts independently: walk to the nearest living enemy and, once
            // in reach, strike IT (never a far-off mob).
            const target = nearestEnemy();
            if (player.alive && target) {
                // The cooldown ticks down while closing in too, so the "wait a
                // period" happens during the approach — once in reach (focus
                // acquired) the hit lands immediately, then a full period apart.
                // Clamped at 0 so time spent walking can't bank up extra shots.
                player.cooldown = Math.max(0, player.cooldown - dt);
                const reach = reachOf(player, target);
                if (dist(player, target) > reach) {
                    seek(player, target, 3.4 * tile, dt, reach);
                } else {
                    player.facing = (target.x - player.x) < 0 ? -1 : 1;
                    if (player.cooldown <= 0) {
                        doAttack(player, target);
                        // Double Hit: a chance at an independent second shot, which
                        // re-acquires the nearest living foe (so it spills onto the
                        // next enemy if the first dropped).
                        if (player.alive && player.doubleHit > 0 && rng() * 100 < player.doubleHit) {
                            const t2 = nearestEnemy();
                            if (t2) doAttack(player, t2);
                        }
                        player.cooldown += attackPeriod(player);
                    }
                }
            }

            // Each enemy acts on its own — independent aggro, movement, cadence.
            for (const e of aliveEnemies()) updateEnemy(e, dt);

            // Health regen ticks for everyone still standing.
            applyRegen(player, dt);
            for (const e of aliveEnemies()) applyRegen(e, dt);

            // Resolve once a side is wiped out.
            if (!resolved) {
                if (aliveEnemies().length === 0) finish(true);
                else if (!player.alive) finish(false);
            }
        }

        // Age floaters, slashes, projectiles.
        for (let i = floaters.length - 1; i >= 0; i--) {
            const f = floaters[i];
            f.y += f.vy * dt;
            if (t - f.bornAt > 800) floaters.splice(i, 1);
        }
        for (let i = slashes.length - 1; i >= 0; i--) {
            if (t - slashes[i].bornAt > 240) slashes.splice(i, 1);
        }
        for (let i = shots.length - 1; i >= 0; i--) {
            if (t - shots[i].bornAt > shots[i].dur) shots.splice(i, 1);
        }
    }

    // Enemy AI: passive patrol until the hero enters its aggro area, then close
    // to attack reach (melee) / standoff (ranged) and fire on its own cadence.
    function updateEnemy(e, dt) {
        if (!e.aggro && dist(player, e) <= AGGRO_TILES * tile) {
            e.aggro = true;
            spawnFloater(e, '!', 'alert', false);
        }
        if (e.aggro && player.alive) {
            // Same as the hero: the period elapses while closing in, so the shot
            // fires the instant it reaches range. Clamped at 0 to avoid banking.
            e.cooldown = Math.max(0, e.cooldown - dt);
            const reach = reachOf(e, player);
            if (dist(e, player) > reach) {
                seek(e, player, 2.3 * tile, dt, reach);
            } else {
                e.facing = (player.x - e.x) < 0 ? -1 : 1;
                if (e.cooldown <= 0) {
                    doAttack(e, player);
                    if (e.alive && player.alive && e.doubleHit > 0 && rng() * 100 < e.doubleHit) {
                        doAttack(e, player);
                    }
                    e.cooldown += attackPeriod(e);
                }
            }
        } else if (!e.aggro) {
            idleEnemy(e, dt);
        }
    }

    // ── Replay stepping (PvP) ──────────────────────────────────────────────────
    // Animate the precomputed event timeline. Fighters close in for flavour, but
    // every hit's damage / crit / resulting HP comes straight from the log, so the
    // animation is a faithful replay of the server's authoritative fight.
    function stepReplay(dt) {
        const entById = (id) => (id === player.id ? player : enemies.find((e) => e.id === id));

        // Flavour movement: both sides walk toward their foe, then trade in place.
        const foe = nearestEnemy();
        if (player.alive && foe) {
            const reach = reachOf(player, foe);
            if (dist(player, foe) > reach) seek(player, foe, 3.4 * tile, dt, reach);
            else player.facing = (foe.x - player.x) < 0 ? -1 : 1;
        }
        for (const e of aliveEnemies()) {
            if (!player.alive) break;
            const reach = reachOf(e, player);
            if (dist(e, player) > reach) seek(e, player, 2.3 * tile, dt, reach);
            else e.facing = (player.x - e.x) < 0 ? -1 : 1;
        }

        // Fire events in order once they're due — but hold the opening blows until
        // the attacker has actually closed on its target (so the first strike
        // doesn't fly across the room). A 2s grace prevents any stall.
        while (replayIdx < replayEvents.length) {
            const ev = replayEvents[replayIdx];
            if (simClock < ev.t) break;
            const attacker = entById(ev.by);
            const target = entById(ev.target);
            if (attacker && target && attacker.alive) {
                const inReach = dist(attacker, target) <= reachOf(attacker, target) + 2;
                if (!inReach && simClock < ev.t + 2) break;
            }
            applyReplayEvent(ev, attacker, target);
            replayIdx++;
        }

        if (replayIdx >= replayEvents.length && !resolved) finish(replayWin);
    }

    // Apply one logged event: snap HP to the authoritative values and play the
    // hit/heal/death animation (no damage is rolled here).
    function applyReplayEvent(ev, attacker, target) {
        if (!attacker || !target) return;
        target.hp = Math.max(0, ev.targetHp);
        attacker.hp = Math.max(0, ev.attackerHp);

        const dx = target.x - attacker.x, dy = target.y - attacker.y;
        const len = Math.hypot(dx, dy) || 1;
        attacker.facing = dx < 0 ? -1 : 1;
        const hostile = attacker.id !== 'player';
        if (ev.ranged) {
            attacker.lungeAt = now();
            attacker.lungeDir = { x: dx / len * 0.4, y: dy / len * 0.4 };
            shots.push({
                x: attacker.x, y: attacker.y - attacker.r * 0.4,
                tx: target.x, ty: target.y, bornAt: now(), dur: fast ? 150 : 240, hostile,
            });
        } else {
            attacker.lungeAt = now();
            attacker.lungeDir = { x: dx / len, y: dy / len };
        }
        slashes.push({ x: target.x, y: target.y, bornAt: now(), hostile });
        spawnFloater(target, `-${fmt(ev.dmg)}`, ev.crit ? 'crit' : '', target.id === 'player');
        if (ev.heal > 0) spawnFloater(attacker, `+${fmt(ev.heal)}`, 'heal', attacker.id === 'player');

        if (target.hp <= 0) {
            target.alive = false;
            target.deathAt = now();
        }
    }

    // Resolve one attack: roll damage, apply it, animate, handle lifesteal/death.
    function doAttack(attacker, target) {
        if (!target.alive) return;
        const hit = computeHit(attacker, rng);
        const crit = hit.crit;
        let dmg = hit.dmg;
        // Execute: extra damage to a badly-wounded foe (HP checked before the hit).
        if (attacker.execute > 0 && target.hp < target.maxHP * EXECUTE_HP_THRESHOLD) {
            dmg = Math.floor(dmg * (1 + attacker.execute / 100));
        }
        // Damage Reduction: target mitigates a capped % of the incoming hit.
        if (target.damageReduction > 0) {
            const dr = Math.min(MAX_DAMAGE_REDUCTION, target.damageReduction) / 100;
            dmg = Math.max(1, Math.floor(dmg * (1 - dr)));
        }
        target.hp = Math.max(0, target.hp - dmg);

        const dx = target.x - attacker.x, dy = target.y - attacker.y;
        const len = Math.hypot(dx, dy) || 1;
        attacker.facing = dx < 0 ? -1 : 1;
        const hostile = attacker.id !== 'player';
        if (attacker.ranged) {
            attacker.lungeAt = now();
            attacker.lungeDir = { x: dx / len * 0.4, y: dy / len * 0.4 };
            shots.push({
                x: attacker.x, y: attacker.y - attacker.r * 0.4,
                tx: target.x, ty: target.y, bornAt: now(), dur: fast ? 150 : 240, hostile,
            });
        } else {
            attacker.lungeAt = now();
            attacker.lungeDir = { x: dx / len, y: dy / len };
        }
        slashes.push({ x: target.x, y: target.y, bornAt: now(), hostile });
        spawnFloater(target, `-${fmt(dmg)}`, crit ? 'crit' : '', target.id === 'player');

        if (attacker.lifeSteal > 0) {
            const heal = Math.floor(dmg * attacker.lifeSteal / 100);
            if (heal > 0) {
                attacker.hp = Math.min(attacker.maxHP, attacker.hp + heal);
                spawnFloater(attacker, `+${fmt(heal)}`, 'heal', attacker.id === 'player');
            }
        }

        // Reflect (thorns): the target bounces a % of the damage it took back at
        // the attacker — which can finish off a low-HP attacker.
        if (target.reflect > 0) {
            const back = Math.floor(dmg * target.reflect / 100);
            if (back > 0) {
                attacker.hp = Math.max(0, attacker.hp - back);
                spawnFloater(attacker, `-${fmt(back)}`, '', attacker.id === 'player');
                if (attacker.hp <= 0) {
                    attacker.alive = false;
                    attacker.deathAt = now();
                }
            }
        }

        if (target.hp <= 0) {
            target.alive = false;
            target.deathAt = now();
        }
    }

    function applyRegen(e, dt) {
        const pct = (e.healthRegen || 0) / 100;
        if (pct > 0 && e.hp > 0) e.hp = Math.min(e.maxHP, e.hp + e.maxHP * pct * dt * 0.1);
    }

    // End the fight: raise the win/lose banner, stop acting, and report the
    // outcome after a beat so the banner + final death animation read.
    function finish(win) {
        resolved = true;
        outcome = win ? 'win' : 'lose';
        outcomeAt = now();
        if (win) player.cheerAt = now();
        setTimeout(() => {
            active = false;
            onResolve?.({ win });
        }, fast ? 700 : 1050);
    }

    // Passive wandering — small, aimless drift in place; never seeks the hero.
    // Driven by the seeded RNG + sim clock so patrols replay identically.
    function idleEnemy(e, dt) {
        if (simClock >= e.wanderAt) {
            e.wanderAt = simClock + 0.9 + rng() * 1.2;
            const ang = rng() * Math.PI * 2;
            e.wander = { x: Math.cos(ang), y: Math.sin(ang) };
        }
        stepEntity(e, e.wander.x, e.wander.y, 1.1 * tile, dt);
        if (e.wander.x) e.facing = e.wander.x < 0 ? -1 : 1;
    }

    function spawnFloater(target, text, cls, isPlayer) {
        const color = cls === 'crit' ? '#f5c451'
            : cls === 'heal' ? '#4ade80'
                : cls === 'gold' ? '#f5c451'
                    : cls === 'xp' ? '#a78bfa'
                        : cls === 'alert' ? '#f5c451'
                            : isPlayer ? '#ef5466' : '#ffd9de';
        floaters.push({ x: target.x, y: target.y - target.r - 6, vy: -34, text, color, bornAt: now() });
    }

    // Move `e` toward `target`, routing around walls/pillars, stopping at `stopAt`.
    function seek(e, target, speed, dt, stopAt = e.r + target.r + 2) {
        const d = dist(e, target);
        if (d <= stopAt) return;

        let aimX = target.x, aimY = target.y;
        if (!clearPath(e.x, e.y, target.x, target.y, e.r)) {
            const wp = nextWaypoint(e, target);
            if (wp) { aimX = wp.x; aimY = wp.y; }
        }
        const dx = aimX - e.x, dy = aimY - e.y;
        const l = Math.hypot(dx, dy) || 1;
        stepEntity(e, dx / l, dy / l, speed, dt);
        e.facing = (target.x - e.x) < 0 ? -1 : 1;
    }

    // ── Pathfinding (BFS over the tile grid) ──────────────────────────────────
    function tileOf(p) {
        return { c: clamp(Math.floor(p.x / tile), 0, COLS - 1), r: clamp(Math.floor(p.y / tile), 0, ROWS - 1) };
    }

    function walkable(c, r) {
        return c >= 0 && r >= 0 && c < COLS && r < ROWS && !walls[r][c];
    }

    function clearPath(ax, ay, bx, by, r) {
        const steps = Math.max(1, Math.ceil(dist({ x: ax, y: ay }, { x: bx, y: by }) / (tile * 0.25)));
        for (let i = 1; i <= steps; i++) {
            const k = i / steps;
            if (hitsWall(ax + (bx - ax) * k, ay + (by - ay) * k, r)) return false;
        }
        return true;
    }

    function nextWaypoint(e, target) {
        const path = findPath(tileOf(e), tileOf(target));
        if (!path || !path.length) return null;
        let wp = path[0];
        for (const node of path) {
            const c = tileCenter(node.c, node.r);
            if (clearPath(e.x, e.y, c.x, c.y, e.r)) wp = node; else break;
        }
        return tileCenter(wp.c, wp.r);
    }

    function findPath(start, goal) {
        if (start.c === goal.c && start.r === goal.r) return [];
        const key = (c, r) => r * COLS + c;
        const prev = new Map();
        const seen = new Set([key(start.c, start.r)]);
        const queue = [start];
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        while (queue.length) {
            const cur = queue.shift();
            for (const [dc, dr] of dirs) {
                const nc = cur.c + dc, nr = cur.r + dr;
                if (!walkable(nc, nr)) continue;
                const k = key(nc, nr);
                if (seen.has(k)) continue;
                seen.add(k);
                prev.set(k, cur);
                if (nc === goal.c && nr === goal.r) {
                    const path = [];
                    let node = { c: nc, r: nr };
                    while (!(node.c === start.c && node.r === start.r)) {
                        path.push(node);
                        node = prev.get(key(node.c, node.r));
                    }
                    return path.reverse();
                }
                queue.push({ c: nc, r: nr });
            }
        }
        return null;
    }

    function stepEntity(e, nx, ny, speed, dt) {
        const step = speed * dt;
        const tryX = e.x + nx * step;
        if (!hitsWall(tryX, e.y, e.r)) e.x = tryX;
        const tryY = e.y + ny * step;
        if (!hitsWall(e.x, tryY, e.r)) e.y = tryY;
    }

    function hitsWall(x, y, r) {
        return isWall(x - r, y) || isWall(x + r, y) || isWall(x, y - r) || isWall(x, y + r);
    }

    function isWall(px, py) {
        const c = Math.floor(px / tile), r = Math.floor(py / tile);
        if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
        return walls[r][c];
    }

    function tileCenter(c, r) { return { x: (c + 0.5) * tile, y: (r + 0.5) * tile }; }

    // Spawn point #i (of n) down the right edge of the room, avoiding walls.
    function rightSpawn(i, n) {
        const cols = [COLS - 2, COLS - 3, COLS - 4];
        const rowsFor = (count) => {
            if (count <= 1) return [Math.floor(ROWS / 2)];
            const out = [];
            for (let k = 0; k < count; k++) {
                out.push(Math.round(1 + (ROWS - 3) * (k / (count - 1))));
            }
            return out;
        };
        const rows = rowsFor(n);
        for (let attempt = 0; attempt < cols.length; attempt++) {
            const c = cols[(attempt) % cols.length];
            const r = rows[i % rows.length];
            const p = tileCenter(c, r);
            if (!isWall(p.x, p.y)) return p;
        }
        return tileCenter(COLS - 2, clamp(rows[i % rows.length], 1, ROWS - 2));
    }

    // ── Render ───────────────────────────────────────────────────────────────
    function draw() {
        ctx.clearRect(0, 0, COLS * tile, ROWS * tile);
        drawFloor();
        for (const e of enemies) drawAggroArea(e);

        const order = [...enemies.filter((e) => e.alive || now() - e.deathAt < 500), player];
        order.sort((a, b) => a.y - b.y);
        for (const e of order) drawEntity(e, e !== player);

        for (const s of shots) drawShot(s);
        for (const s of slashes) drawSlash(s);
        for (const f of floaters) drawFloater(f);
        if (outcome) drawOutcomeBanner();
    }

    // Big "VICTORY" / "DEFEAT" flourish once a fight is decided.
    function drawOutcomeBanner() {
        const k = clamp((now() - outcomeAt) / 280, 0, 1);    // pop-in
        const win = outcome === 'win';
        const cx = COLS * tile / 2, cy = ROWS * tile / 2;
        const text = win ? 'VICTORY' : 'DEFEAT';
        ctx.save();
        // Dim the room a touch so the banner stands out.
        ctx.globalAlpha = 0.32 * k;
        ctx.fillStyle = win ? '#0b3b1f' : '#3a0d14';
        ctx.fillRect(0, 0, COLS * tile, ROWS * tile);
        ctx.globalAlpha = 1;
        ctx.translate(cx, cy);
        ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = `900 ${Math.round(tile * 1.6)}px system-ui, sans-serif`;
        ctx.lineWidth = Math.max(3, tile * 0.12);
        ctx.strokeStyle = 'rgba(0,0,0,.75)';
        ctx.strokeText(text, 0, 0);
        ctx.fillStyle = win ? '#4ade80' : '#ff5468';
        ctx.fillText(text, 0, 0);
        ctx.restore();
    }

    function drawAggroArea(e) {
        if (!e.alive || e.aggro) return;
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = 'rgba(239,84,102,.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(e.x, e.y, AGGRO_TILES * tile, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    function drawFloor() {
        for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
                const x = c * tile, y = r * tile;
                if (walls[r][c]) {
                    ctx.fillStyle = theme.wallBase;
                    ctx.fillRect(x, y, tile, tile);
                    ctx.fillStyle = theme.wallInset;
                    ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2);
                    ctx.fillStyle = theme.wallShade;
                    ctx.fillRect(x + 1, y + tile - 5, tile - 2, 4);
                } else {
                    ctx.fillStyle = (c + r) % 2 ? theme.floorB : theme.floorA;
                    ctx.fillRect(x, y, tile, tile);
                    ctx.strokeStyle = 'rgba(0,0,0,.18)';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x + 0.5, y + 0.5, tile - 1, tile - 1);
                }
            }
        }
    }

    function drawEntity(e, isEnemy) {
        const t = now();
        let drawX = e.x, drawY = e.y, alpha = 1, scale = 1;
        const roleScale = e.role === 'bigboss' ? 1.45 : e.role === 'boss' ? 1.22 : 1;

        if (!e.alive && e.deathAt) {
            // Death: enemies puff up & fade out; the hero crumples & sinks.
            const k = clamp((t - e.deathAt) / 500, 0, 1);
            alpha = 1 - k;
            scale = isEnemy ? roleScale * (1 + k * 0.6) : roleScale * (1 - k * 0.4);
            if (!isEnemy) drawY += k * e.r * 0.5;
        } else {
            scale = roleScale;
        }
        const lk = clamp((t - e.lungeAt) / 180, 0, 1);
        if (lk < 1) {
            const push = Math.sin(lk * Math.PI) * tile * 0.4;
            drawX += e.lungeDir.x * push;
            drawY += e.lungeDir.y * push;
        }
        // Victory cheer: the hero hops a few times.
        const ck = clamp((t - (e.cheerAt || 0)) / 900, 0, 1);
        if (e.cheerAt && ck < 1) drawY -= Math.abs(Math.sin(ck * Math.PI * 3)) * tile * 0.35;

        ctx.globalAlpha = alpha * 0.35;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(drawX, drawY + e.r * 0.85, e.r * 0.9 * scale, e.r * 0.4 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(drawX, drawY, e.r * 1.05 * scale, 0, Math.PI * 2);
        ctx.fillStyle = !isEnemy ? 'rgba(139,92,246,.18)'
            : e.ranged ? 'rgba(245,196,81,.18)' : 'rgba(239,84,102,.16)';
        ctx.fill();

        const size = e.r * 2.1 * scale;
        ctx.save();
        ctx.translate(drawX, drawY);
        ctx.scale(e.facing < 0 ? -1 : 1, 1);
        ctx.font = `${size}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(e.emoji, 0, 0);
        ctx.restore();

        if (e.alive || !isEnemy) drawHpBar(drawX, drawY - e.r * scale - 9, e, isEnemy);
        ctx.globalAlpha = 1;
    }

    function drawHpBar(cx, cy, e, isEnemy) {
        // The hero's bar is taller and outlined so the player's life is easy to
        // read; the depleted track is near-black for strong contrast against the
        // bright fill (so remaining HP is unmistakable on the dark floor).
        const hgt = isEnemy ? 4 : 7;
        const w = Math.max(tile * (isEnemy ? 1.1 : 1.35), e.r * 2.4);
        const x = cx - w / 2;
        const pct = clamp(e.hp / e.maxHP, 0, 1);

        // Outer frame.
        ctx.fillStyle = '#000';
        ctx.fillRect(x - 1.5, cy - 1.5, w + 3, hgt + 3);
        // Empty track (dark, tinted by team).
        ctx.fillStyle = isEnemy ? '#2a0a10' : '#0c2a18';
        ctx.fillRect(x, cy, w, hgt);
        // Filled portion (bright, high-saturation).
        ctx.fillStyle = isEnemy ? '#ff4d63' : '#37e57e';
        ctx.fillRect(x, cy, w * pct, hgt);
        // Gloss highlight along the top of the filled portion.
        ctx.fillStyle = isEnemy ? 'rgba(255,180,190,.55)' : 'rgba(190,255,215,.6)';
        ctx.fillRect(x, cy, w * pct, Math.max(1, hgt * 0.34));
        // Crisp outline so the hero's bar pops against any tile.
        if (!isEnemy) {
            ctx.strokeStyle = 'rgba(255,255,255,.5)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x - 0.5, cy - 0.5, w + 1, hgt + 1);
        }
    }

    function drawShot(s) {
        const k = clamp((now() - s.bornAt) / s.dur, 0, 1);
        const x = s.x + (s.tx - s.x) * k;
        const y = s.y + (s.ty - s.y) * k;
        const ang = Math.atan2(s.ty - s.y, s.tx - s.x);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        ctx.globalAlpha = 0.95;
        ctx.strokeStyle = s.hostile ? '#f5c451' : '#cdb4ff';
        ctx.lineWidth = 2.5;
        const len = tile * 0.5;
        ctx.beginPath();
        ctx.moveTo(-len / 2, 0);
        ctx.lineTo(len / 2, 0);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(len / 2, 0);
        ctx.lineTo(len / 2 - 4, -3);
        ctx.moveTo(len / 2, 0);
        ctx.lineTo(len / 2 - 4, 3);
        ctx.stroke();
        ctx.restore();
        ctx.globalAlpha = 1;
    }

    function drawSlash(s) {
        const k = clamp((now() - s.bornAt) / 240, 0, 1);
        ctx.globalAlpha = (1 - k) * 0.9;
        ctx.strokeStyle = s.hostile ? '#fff0c0' : '#ffd9de';
        ctx.lineWidth = 3;
        const rad = tile * (0.3 + k * 0.5);
        ctx.beginPath();
        ctx.arc(s.x, s.y, rad, -0.6, 1.0);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }

    function drawFloater(f) {
        const k = clamp((now() - f.bornAt) / 800, 0, 1);
        ctx.globalAlpha = 1 - k;
        ctx.fillStyle = f.color;
        ctx.font = `900 ${Math.round(tile * 0.6)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(f.text, f.x, f.y);
        ctx.globalAlpha = 1;
    }

    // Small number formatter (kept local so the view has no screen deps).
    function fmt(n) {
        n = Math.round(n);
        if (n >= 1e9) return `${(n / 1e9).toFixed(1)}B`;
        if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
        if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
        return `${n}`;
    }

    return { el, mount, start, stop, setFast, setMatchup, floater };
}

// Room layout: solid perimeter + the chosen arena's interior pillars.
function buildWalls(pillars = []) {
    const grid = [];
    for (let r = 0; r < ROWS; r++) {
        const row = [];
        for (let c = 0; c < COLS; c++) {
            row.push(r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1);
        }
        grid.push(row);
    }
    for (const [c, r] of pillars) {
        if (r > 0 && c > 0 && r < ROWS - 1 && c < COLS - 1) grid[r][c] = true;
    }
    return grid;
}
