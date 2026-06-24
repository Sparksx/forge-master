// Dungeon — a 2D top-down combat zone rendered on a canvas. The combat zone is
// fully automatic: there is NO player control. The lone hero pathfinds around
// the room's obstacles toward the nearest enemy on its own, and contact starts
// the fight. Home mode is 1 hero vs a *group* of enemies — melee mobs close in,
// ranged mobs (bows/casters) hold a standoff distance and fire from afar.
//
// This is purely the *view*. The owning screen (home.js) keeps driving the
// authoritative combat (fightArena) and pushes HP/damage in via setHp()/attack()
// /floater(); the dungeon turns those into melee lunges, arrows, and floaters.
// When the hero reaches the pack the dungeon fires onEngage().

// Logical room grid (tiles). The canvas scales to fit; tile size is derived.
const COLS = 15;
const ROWS = 9;
// Interior pillars (col,row) — fixed so the room reads like a real chamber.
const PILLARS = [
    [4, 3], [4, 5], [10, 3], [10, 5], [7, 4],
];
// How close (in tiles) the hero must get before a passive enemy aggros.
const AGGRO_TILES = 3;
// Ranged mobs hold roughly this distance instead of closing to melee.
const RANGED_STANDOFF = 3.2;

const now = () => Date.now();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * @param {object} opts
 * @param {() => void} opts.onEngage  called once when the hero reaches the pack.
 */
export function createDungeon({ onEngage } = {}) {
    // ── DOM ──────────────────────────────────────────────────────────────────
    const canvas = document.createElement('canvas');
    canvas.className = 'dungeon-canvas';
    const ctx = canvas.getContext('2d');

    const el = document.createElement('div');
    el.className = 'dungeon';
    el.appendChild(canvas);

    // ── World state ──────────────────────────────────────────────────────────
    let tile = 24;          // px per tile (recomputed on resize)
    const walls = buildWalls();
    const player = newEntity({ id: 'player', emoji: '🧙', facing: 1 });
    let enemies = [];       // array of enemy entities
    const floaters = [];    // { x, y, vy, text, color, bornAt }
    const slashes = [];     // { x, y, bornAt, hostile }
    const shots = [];       // ranged projectiles { x, y, tx, ty, bornAt, dur, hostile }

    let auto = true;        // combat zone is always automatic; no player control
    let fast = false;
    let engaged = false;    // locked in combat (playback running)
    let awaitingEngage = true;
    let started = false;
    let curRank = -1;       // which arena rank the pack represents

    function newEntity(over = {}) {
        return {
            id: '', x: 0, y: 0, r: 10, emoji: '👹', label: '', hp: 1, maxHP: 1,
            lungeAt: 0, lungeDir: { x: -1, y: 0 }, facing: -1, ranged: false,
            alive: true, deathAt: 0, wanderAt: 0, wander: { x: 0, y: 0 }, aggro: false,
            ...over,
        };
    }

    const entityById = (id) => (id === 'player' ? player : enemies.find((e) => e.id === id));
    const aliveEnemies = () => enemies.filter((e) => e.alive);
    const nearestEnemy = () => {
        let best = null, bestD = Infinity;
        for (const e of aliveEnemies()) {
            const d = dist(player, e);
            if (d < bestD) { bestD = d; best = e; }
        }
        return best;
    };

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

    function setAuto(v) { auto = v; }
    function setFast(v) { fast = v; }
    function setEngaged(v) { engaged = v; }

    function applyLabels(m) {
        player.emoji = m.playerEmoji;
        player.label = m.playerLabel;
        player.maxHP = m.playerHP;
        player.ranged = !!m.playerRanged;
        // Sync the enemy roster to the matchup (reuse entities by index).
        m.enemies.forEach((spec, i) => {
            const e = enemies[i] || newEntity();
            e.id = spec.id;
            e.emoji = spec.emoji;
            e.label = spec.label;
            e.maxHP = spec.maxHP;
            e.ranged = !!spec.ranged;
            e.role = spec.role;
            enemies[i] = e;
        });
        enemies.length = m.enemies.length;
    }

    /** Advance to a fresh pack: full HP, respawn the mobs away from the hero. */
    function nextMatchup(m) {
        resize();
        curRank = m.rank;
        enemies = [];
        applyLabels(m);

        player.hp = m.playerHP;

        // First spawn: drop the hero near the left side of the room.
        if (player.x === 0 && player.y === 0) {
            const p = tileCenter(2, Math.floor(ROWS / 2));
            player.x = p.x; player.y = p.y;
        }

        // Spread the pack across far spawn points, most-distant first.
        const spots = farSpawns(m.enemies.length);
        m.enemies.forEach((spec, i) => {
            const e = enemies[i];
            const sp = spots[i % spots.length];
            e.x = sp.x; e.y = sp.y;
            e.hp = spec.maxHP;
            e.alive = true;
            e.deathAt = 0;
            e.aggro = false;
            e.wanderAt = 0;
            e.r = player.r;
        });

        engaged = false;
        awaitingEngage = true;
    }

    /** A state change against the *same* pack — refresh labels/HP, no teleport. */
    function refreshMatchup(m) {
        if (m.rank !== curRank || (player.x === 0 && player.y === 0) || enemies.length !== m.enemies.length) {
            nextMatchup(m); return;
        }
        applyLabels(m);
        if (!engaged) {
            player.hp = m.playerHP;
            m.enemies.forEach((spec, i) => { if (enemies[i]) enemies[i].hp = spec.maxHP; });
        }
    }

    function setHp(id, hp, maxHP) {
        const e = entityById(id);
        if (!e) return;
        e.hp = hp;
        if (maxHP != null) e.maxHP = maxHP;
    }

    /** Visualise an attack from `fromId` at `toId` — melee lunge or ranged shot. */
    function attack(fromId, toId, { ranged = false } = {}) {
        const attacker = entityById(fromId);
        const target = entityById(toId);
        if (!attacker || !target) return;
        const dx = target.x - attacker.x, dy = target.y - attacker.y;
        const len = Math.hypot(dx, dy) || 1;
        attacker.facing = dx < 0 ? -1 : 1;
        const hostile = fromId !== 'player';
        if (ranged) {
            // A small lunge for recoil, then a projectile flies to the target.
            attacker.lungeAt = now();
            attacker.lungeDir = { x: dx / len * 0.4, y: dy / len * 0.4 };
            shots.push({
                x: attacker.x, y: attacker.y - attacker.r * 0.4,
                tx: target.x, ty: target.y,
                bornAt: now(), dur: fast ? 150 : 240, hostile,
            });
        } else {
            attacker.lungeAt = now();
            attacker.lungeDir = { x: dx / len, y: dy / len };
            slashes.push({ x: target.x, y: target.y, bornAt: now(), hostile });
        }
    }

    /** Floating combat text over an entity. */
    function floater(id, text, cls = '') {
        const target = entityById(id);
        if (!target) return;
        const color = cls === 'crit' ? '#f5c451'
            : cls === 'heal' ? '#4ade80'
                : cls === 'gold' ? '#f5c451'
                    : cls === 'xp' ? '#a78bfa'
                        : id === 'player' ? '#ef5466' : '#ffd9de';
        floaters.push({ x: target.x, y: target.y - target.r - 6, vy: -34, text, color, bornAt: now() });
    }

    /** Play one mob's death animation. Resolves after the anim. */
    function killEnemy(id) {
        const e = entityById(id);
        if (e && e !== player) { e.alive = false; e.deathAt = now(); }
        return new Promise((res) => setTimeout(res, fast ? 300 : 480));
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
        const dt = Math.min(0.05, (t - last) / 1000);
        last = t;
        update(dt);
        draw();
        if (started) raf = requestAnimationFrame(loop);
    }

    function update(dt) {
        const t = now();
        const speedScale = fast ? 1.7 : 1;

        if (!engaged) {
            const target = nearestEnemy();
            // Hero: fully automatic — pathfinds to the nearest living enemy.
            if (auto && target) seek(player, target, 3.4 * speedScale * tile, dt);
            for (const e of aliveEnemies()) updateEnemy(e, dt, speedScale);

            // Contact with any mob → start the fight.
            if (target && awaitingEngage && contactRange(target)) {
                awaitingEngage = false;
                engaged = true;
                onEngage?.();
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

    // Whether the hero is close enough to `e` to engage (ranged mobs count once
    // the hero is within their standoff band).
    function contactRange(e) {
        const reach = e.ranged ? RANGED_STANDOFF * tile : player.r + e.r + 4;
        return dist(player, e) <= reach;
    }

    // Move `e` toward `target`, routing around walls/pillars and stopping at
    // melee range. Walks straight when it has line of sight; otherwise follows a
    // BFS path through the room so it never gets stuck on an obstacle.
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

    // Enemy AI: passive patrol until the hero enters its aggressive area, then it
    // closes in (melee) or advances to a standoff distance (ranged).
    function updateEnemy(e, dt, speedScale) {
        if (!e.aggro && dist(player, e) <= AGGRO_TILES * tile) {
            e.aggro = true;
            floaters.push({ x: e.x, y: e.y - e.r - 6, vy: -34, text: '!', color: '#f5c451', bornAt: now() });
        }
        if (e.aggro) {
            const stopAt = e.ranged ? RANGED_STANDOFF * tile : e.r + player.r + 2;
            seek(e, player, 2.3 * speedScale * tile, dt, stopAt);
        } else {
            idleEnemy(e, dt, speedScale);
        }
    }

    // Passive wandering — small, aimless drift in place; never seeks the hero.
    function idleEnemy(e, dt, speedScale) {
        const t = now();
        if (t > e.wanderAt) {
            e.wanderAt = t + 900 + Math.random() * 1200;
            const ang = Math.random() * Math.PI * 2;
            e.wander = { x: Math.cos(ang), y: Math.sin(ang) };
        }
        stepEntity(e, e.wander.x, e.wander.y, 1.1 * speedScale * tile, dt);
        if (e.wander.x) e.facing = e.wander.x < 0 ? -1 : 1;
    }

    // ── Pathfinding (BFS over the tile grid) ──────────────────────────────────
    function tileOf(p) {
        return { c: clamp(Math.floor(p.x / tile), 0, COLS - 1), r: clamp(Math.floor(p.y / tile), 0, ROWS - 1) };
    }

    function walkable(c, r) {
        return c >= 0 && r >= 0 && c < COLS && r < ROWS && !walls[r][c];
    }

    // True if a straight line from (ax,ay)→(bx,by) is clear of walls for radius r.
    function clearPath(ax, ay, bx, by, r) {
        const steps = Math.max(1, Math.ceil(dist({ x: ax, y: ay }, { x: bx, y: by }) / (tile * 0.25)));
        for (let i = 1; i <= steps; i++) {
            const k = i / steps;
            if (hitsWall(ax + (bx - ax) * k, ay + (by - ay) * k, r)) return false;
        }
        return true;
    }

    // Center of the next tile `e` should head for to reach `target`.
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

    // Breadth-first search; returns tiles from start (exclusive) to goal
    // (inclusive), or null if unreachable.
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

    // Per-axis move with wall collision (slides along walls / around pillars).
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

    // Spread up to `n` mobs across the far reaches of the room, most-distant
    // points first so a pack fans out instead of stacking.
    function farSpawns(n) {
        const candidates = [
            tileCenter(COLS - 3, 2), tileCenter(COLS - 3, ROWS - 3),
            tileCenter(COLS - 2, Math.floor(ROWS / 2)), tileCenter(COLS - 4, 2),
            tileCenter(COLS - 4, ROWS - 3), tileCenter(2, 2), tileCenter(2, ROWS - 3),
        ].filter((p) => !isWall(p.x, p.y));
        candidates.sort((a, b) => dist(player, b) - dist(player, a));
        const out = [];
        for (let i = 0; i < Math.max(1, n); i++) out.push(candidates[i % candidates.length]);
        return out;
    }

    // ── Render ───────────────────────────────────────────────────────────────
    function draw() {
        ctx.clearRect(0, 0, COLS * tile, ROWS * tile);
        drawFloor();
        for (const e of enemies) drawAggroArea(e);

        // Draw back-to-front by y so overlaps look right.
        const order = [...enemies.filter((e) => e.alive || now() - e.deathAt < 500), player];
        order.sort((a, b) => a.y - b.y);
        for (const e of order) drawEntity(e, e !== player);

        for (const s of shots) drawShot(s);
        for (const s of slashes) drawSlash(s);
        for (const f of floaters) drawFloater(f);
    }

    // Faint dashed ring showing a passive mob's aggressive area.
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
                    ctx.fillStyle = '#0c0a18';
                    ctx.fillRect(x, y, tile, tile);
                    ctx.fillStyle = 'rgba(46,38,80,.9)';
                    ctx.fillRect(x + 1, y + 1, tile - 2, tile - 2);
                    ctx.fillStyle = 'rgba(0,0,0,.35)';
                    ctx.fillRect(x + 1, y + tile - 5, tile - 2, 4);
                } else {
                    ctx.fillStyle = (c + r) % 2 ? '#181230' : '#1d1638';
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
        // Bosses render a touch bigger so they read as the threat.
        const roleScale = e.role === 'bigboss' ? 1.45 : e.role === 'boss' ? 1.22 : 1;

        // Death animation for a mob.
        if (isEnemy && !e.alive) {
            const k = clamp((t - e.deathAt) / 500, 0, 1);
            alpha = 1 - k; scale = roleScale * (1 + k * 0.6);
        } else {
            scale = roleScale;
        }
        // Attack lunge.
        const lk = clamp((t - e.lungeAt) / 180, 0, 1);
        if (lk < 1) {
            const push = Math.sin(lk * Math.PI) * tile * 0.4;
            drawX += e.lungeDir.x * push;
            drawY += e.lungeDir.y * push;
        }

        // Shadow.
        ctx.globalAlpha = alpha * 0.35;
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.ellipse(drawX, drawY + e.r * 0.85, e.r * 0.9 * scale, e.r * 0.4 * scale, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body glow ring (hero violet / mob red; ranged mobs tinted gold).
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(drawX, drawY, e.r * 1.05 * scale, 0, Math.PI * 2);
        ctx.fillStyle = !isEnemy ? 'rgba(139,92,246,.18)'
            : e.ranged ? 'rgba(245,196,81,.18)' : 'rgba(239,84,102,.16)';
        ctx.fill();

        // Emoji sprite (flip horizontally to face the right way).
        const size = e.r * 2.1 * scale;
        ctx.save();
        ctx.translate(drawX, drawY);
        ctx.scale(e.facing < 0 ? -1 : 1, 1);
        ctx.font = `${size}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(e.emoji, 0, 0);
        ctx.restore();

        // HP bar above the head.
        if (e.alive || !isEnemy) drawHpBar(drawX, drawY - e.r * scale - 9, e, isEnemy);
        ctx.globalAlpha = 1;
    }

    function drawHpBar(cx, cy, e, isEnemy) {
        const w = Math.max(tile * 1.1, e.r * 2.4), hgt = 5;
        const x = cx - w / 2;
        const pct = clamp(e.hp / e.maxHP, 0, 1);
        ctx.fillStyle = 'rgba(0,0,0,.6)';
        ctx.fillRect(x - 1, cy - 1, w + 2, hgt + 2);
        ctx.fillStyle = isEnemy ? '#b91c3c' : '#22c55e';
        ctx.fillRect(x, cy, w, hgt);
        ctx.fillStyle = isEnemy ? '#ef5466' : '#4ade80';
        ctx.fillRect(x, cy, w * pct, hgt);
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
        // Arrowhead.
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

    return {
        el, mount, start, stop, setAuto, setFast, setEngaged,
        nextMatchup, refreshMatchup, setHp, attack, floater, killEnemy,
    };
}

// Room layout: solid perimeter + interior pillars.
function buildWalls() {
    const grid = [];
    for (let r = 0; r < ROWS; r++) {
        const row = [];
        for (let c = 0; c < COLS; c++) {
            row.push(r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1);
        }
        grid.push(row);
    }
    for (const [c, r] of PILLARS) grid[r][c] = true;
    return grid;
}
