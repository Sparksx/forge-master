// Dungeon — a 2D top-down combat zone rendered on a canvas. The combat zone is
// fully automatic: there is NO player control. The hero pathfinds around the
// room's obstacles toward the closest enemy on its own, and contact starts a
// fight. Enemies stay passive (idle patrol) until the hero steps inside their
// aggressive area, at which point they wake up and close in.
//
// This is purely the *view*. The owning screen (home.js) keeps driving the
// authoritative combat (fightArena) and pushes HP/damage into the dungeon via
// setHp()/floater(); the dungeon turns those into melee lunges and floaters.
// When the hero reaches the mob the dungeon fires onEngage() so the screen can
// resolve a fight.

// Logical room grid (tiles). The canvas scales to fit; tile size is derived.
const COLS = 15;
const ROWS = 9;
// Interior pillars (col,row) — fixed so the room reads like a real chamber.
const PILLARS = [
    [4, 3], [4, 5], [10, 3], [10, 5], [7, 4],
];
// How close (in tiles) the hero must get before a passive enemy aggros.
const AGGRO_TILES = 3;

const now = () => Date.now();
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * @param {object} opts
 * @param {() => void} opts.onEngage  called once when the hero touches the mob.
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
    const player = { x: 0, y: 0, r: 10, emoji: '🧙', label: '', hp: 1, maxHP: 1, lungeAt: 0, lungeDir: { x: 1, y: 0 }, facing: 1 };
    const enemy = { x: 0, y: 0, r: 10, emoji: '👹', label: '', hp: 1, maxHP: 1, lungeAt: 0, lungeDir: { x: -1, y: 0 }, facing: -1, alive: true, deathAt: 0, wanderAt: 0, wander: { x: 0, y: 0 }, aggro: false };
    const floaters = [];    // { x, y, vy, text, color, bornAt }
    const slashes = [];     // { x, y, bornAt, hostile }

    let auto = true;        // combat zone is always automatic; no player control
    let fast = false;
    let engaged = false;    // locked in melee (combat playing out)
    let awaitingEngage = true;
    let started = false;
    let curRank = -1;       // which arena rank the mob represents

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
        player.r = enemy.r = r;
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
        enemy.emoji = m.enemyEmoji;
        enemy.label = m.enemyLabel;
        enemy.maxHP = m.enemyHP;
    }

    /** Advance to a fresh matchup: full HP, respawn the mob away from the hero. */
    function nextMatchup(m) {
        resize();
        curRank = m.rank;
        applyLabels(m);
        player.hp = m.playerHP;
        enemy.hp = m.enemyHP;
        enemy.alive = true;
        enemy.deathAt = 0;
        enemy.aggro = false;   // fresh mobs start passive until the hero gets close

        // First spawn: drop the hero near the left side of the room.
        if (player.x === 0 && player.y === 0) {
            const p = tileCenter(2, Math.floor(ROWS / 2));
            player.x = p.x; player.y = p.y;
        }
        // Spawn the mob at whichever far corner is most distant from the hero.
        const sp = farSpawn();
        enemy.x = sp.x; enemy.y = sp.y;
        enemy.wanderAt = 0;

        engaged = false;
        awaitingEngage = true;
    }

    /** A state change against the *same* opponent — refresh labels/HP, no teleport. */
    function refreshMatchup(m) {
        if (m.rank !== curRank || (player.x === 0 && player.y === 0)) { nextMatchup(m); return; }
        applyLabels(m);
        if (!engaged) { player.hp = m.playerHP; enemy.hp = m.enemyHP; }
    }

    function setHp(side, hp, maxHP) {
        const e = side === 'player' ? player : enemy;
        e.hp = hp;
        e.maxHP = maxHP;
    }

    /** A combat event from the screen. side = who took the hit. */
    function floater(side, text, cls = '') {
        const target = side === 'player' ? player : enemy;
        const attacker = side === 'player' ? enemy : player;
        const dmg = !cls || cls === 'crit';
        if (dmg) {
            // The attacker lunges toward the victim; spawn a slash on the victim.
            const dx = target.x - attacker.x, dy = target.y - attacker.y;
            const len = Math.hypot(dx, dy) || 1;
            attacker.lungeAt = now();
            attacker.lungeDir = { x: dx / len, y: dy / len };
            attacker.facing = dx < 0 ? -1 : 1;
            slashes.push({ x: target.x, y: target.y, bornAt: now(), hostile: side === 'player' });
        }
        const color = cls === 'crit' ? '#f5c451'
            : cls === 'heal' ? '#4ade80'
                : cls === 'gold' ? '#f5c451'
                    : cls === 'xp' ? '#a78bfa'
                        : side === 'player' ? '#ef5466' : '#ffd9de';
        floaters.push({ x: target.x, y: target.y - target.r - 6, vy: -34, text, color, bornAt: now() });
    }

    /** Play the mob's death, then resolve. */
    function killEnemy() {
        enemy.alive = false;
        enemy.deathAt = now();
        return new Promise((res) => setTimeout(res, fast ? 320 : 520));
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
            // Hero: fully automatic — pathfinds around obstacles to the closest
            // enemy. There is no manual control of the combat zone.
            if (auto && enemy.alive) seek(player, enemy, 3.4 * speedScale * tile, dt);
            // Mob stays passive until the hero enters its aggressive area.
            if (enemy.alive) updateEnemy(dt, speedScale);

            // Contact → fight.
            if (enemy.alive && awaitingEngage && dist(player, enemy) <= player.r + enemy.r + 4) {
                awaitingEngage = false;
                engaged = true;
                onEngage?.();
            }
        }

        // Age floaters & slashes.
        for (let i = floaters.length - 1; i >= 0; i--) {
            const f = floaters[i];
            f.y += f.vy * dt;
            if (t - f.bornAt > 800) floaters.splice(i, 1);
        }
        for (let i = slashes.length - 1; i >= 0; i--) {
            if (t - slashes[i].bornAt > 240) slashes.splice(i, 1);
        }
    }

    // Move `e` toward `target`, routing around walls/pillars and stopping at
    // melee range. Walks straight when it has line of sight; otherwise follows a
    // BFS path through the room so it never gets stuck on an obstacle.
    function seek(e, target, speed, dt) {
        const d = dist(e, target);
        if (d <= e.r + target.r + 2) return;

        let aimX = target.x, aimY = target.y;
        if (!clearPath(e.x, e.y, target.x, target.y, e.r)) {
            const wp = nextWaypoint(e, target);
            if (wp) { aimX = wp.x; aimY = wp.y; }
        }
        const dx = aimX - e.x, dy = aimY - e.y;
        const l = Math.hypot(dx, dy) || 1;
        stepEntity(e, dx / l, dy / l, speed, dt);
        // Always face the actual target, not the intermediate waypoint.
        e.facing = (target.x - e.x) < 0 ? -1 : 1;
    }

    // Enemy AI: passive (idle patrol) until the hero steps inside its aggressive
    // area, then it wakes up and chases the hero — also avoiding obstacles.
    function updateEnemy(dt, speedScale) {
        if (!enemy.aggro && dist(player, enemy) <= AGGRO_TILES * tile) {
            enemy.aggro = true;
            // Surprise alert so the wake-up reads clearly.
            floaters.push({ x: enemy.x, y: enemy.y - enemy.r - 6, vy: -34, text: '!', color: '#f5c451', bornAt: now() });
        }
        if (enemy.aggro) {
            seek(enemy, player, 2.3 * speedScale * tile, dt);
        } else {
            idleEnemy(dt, speedScale);
        }
    }

    // Passive wandering — small, aimless drift in place; never seeks the hero.
    function idleEnemy(dt, speedScale) {
        const t = now();
        if (t > enemy.wanderAt) {
            enemy.wanderAt = t + 900 + Math.random() * 1200;
            const ang = Math.random() * Math.PI * 2;
            enemy.wander = { x: Math.cos(ang), y: Math.sin(ang) };
        }
        stepEntity(enemy, enemy.wander.x, enemy.wander.y, 1.1 * speedScale * tile, dt);
        if (enemy.wander.x) enemy.facing = enemy.wander.x < 0 ? -1 : 1;
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

    // Center of the next tile `e` should head for to reach `target`. Picks the
    // furthest BFS waypoint still in line of sight so motion stays smooth.
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

    // Breadth-first search; returns the list of tiles from start (exclusive) to
    // goal (inclusive), or null if unreachable.
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
        // Sample the four cardinal edges of the circle.
        return isWall(x - r, y) || isWall(x + r, y) || isWall(x, y - r) || isWall(x, y + r);
    }

    function isWall(px, py) {
        const c = Math.floor(px / tile), r = Math.floor(py / tile);
        if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return true;
        return walls[r][c];
    }

    function tileCenter(c, r) { return { x: (c + 0.5) * tile, y: (r + 0.5) * tile }; }

    function farSpawn() {
        const candidates = [
            tileCenter(COLS - 3, 2), tileCenter(COLS - 3, ROWS - 3),
            tileCenter(COLS - 2, Math.floor(ROWS / 2)), tileCenter(2, 2), tileCenter(2, ROWS - 3),
        ].filter((p) => !isWall(p.x, p.y));
        let best = candidates[0], bestD = -1;
        for (const c of candidates) {
            const d = dist(player, c);
            if (d > bestD) { bestD = d; best = c; }
        }
        return best;
    }

    // ── Render ───────────────────────────────────────────────────────────────
    function draw() {
        ctx.clearRect(0, 0, COLS * tile, ROWS * tile);
        drawFloor();
        drawAggroArea();

        // Draw back-to-front by y so overlaps look right.
        const order = [];
        if (enemy.alive || now() - enemy.deathAt < 520) order.push(enemy);
        order.push(player);
        order.sort((a, b) => a.y - b.y);
        for (const e of order) drawEntity(e, e === enemy);

        for (const s of slashes) drawSlash(s);
        for (const f of floaters) drawFloater(f);
    }

    // Faint dashed ring showing a passive mob's aggressive area. Disappears the
    // moment it wakes up and starts chasing.
    function drawAggroArea() {
        if (!enemy.alive || enemy.aggro) return;
        ctx.save();
        ctx.globalAlpha = 0.5;
        ctx.strokeStyle = 'rgba(239,84,102,.5)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(enemy.x, enemy.y, AGGRO_TILES * tile, 0, Math.PI * 2);
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

        // Death animation for the mob.
        if (isEnemy && !e.alive) {
            const k = clamp((t - e.deathAt) / 520, 0, 1);
            alpha = 1 - k; scale = 1 + k * 0.6;
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
        ctx.ellipse(drawX, drawY + e.r * 0.85, e.r * 0.9, e.r * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        // Body glow ring (hero violet / mob red).
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(drawX, drawY, e.r * 1.05 * scale, 0, Math.PI * 2);
        ctx.fillStyle = isEnemy ? 'rgba(239,84,102,.16)' : 'rgba(139,92,246,.18)';
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
        if (e.alive || !isEnemy) drawHpBar(drawX, drawY - e.r - 9, e, isEnemy);
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

    return { el, mount, start, stop, setAuto, setFast, setEngaged, nextMatchup, refreshMatchup, setHp, floater, killEnemy };
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
