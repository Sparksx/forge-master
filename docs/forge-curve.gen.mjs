// Forge balance generator — single source of truth for the forge rarity odds and
// XP/forge pacing baked into src/game/config.js (FORGE_LEVELS + the XP curve).
//
// The numbers in config.js are GENERATED, not hand-tuned. To re-tune the forge,
// edit the KNOBS below, run `node docs/forge-curve.gen.mjs`, eyeball the table and
// the CONSTRAINT CHECK, then paste the emitted FORGE_LEVELS array + constants back
// into src/game/config.js. The reasoning is written up in docs/forge-balance.md.
//
// Usage:
//   node docs/forge-curve.gen.mjs          # print the table + constraint check
//   node docs/forge-curve.gen.mjs --emit   # also print the JS to paste into config

const TIER_NAMES = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic', 'Divine'];

// ─── KNOBS ────────────────────────────────────────────────────────────────────
const N = 35; // number of forge levels
const SIGMA = 0.78; // kernel width: smaller ⇒ rarities enter later & lower (less overlap)
const P = 1.45; // center-slide exponent: >1 ⇒ slow start, long low-rarity early game
const WINDOW = 4; // hard cap on how many rarities are rollable at once
const C_MAX_TARGET_DIVINE = 20; // % Divine at max level (the permanent jackpot ceiling)
// Forge pacing: expected forges to go L→L+1, geometric. Tuned so L1→L2 = 100 and the
// full climb to the cap totals ~1.04M forges (sized for future multi-drop-per-forge).
const F_BASE = 100;
const F_GROWTH = 1.262;
// Optional gold instant-shortcut: geometric, deliberately a cheap "fast lane".
const G_BASE = 10;
const G_GROWTH = 1.33;
// ──────────────────────────────────────────────────────────────────────────────

// Center of the traveling bump at forge level L (1..N). L1 is forced to pure Common.
const center = (L, cmax) => cmax * Math.pow((L - 1) / (N - 1), P);

function chancesFor(L, cmax) {
    if (L === 1) return [100, 0, 0, 0, 0, 0, 0];
    const c = center(L, cmax);
    // Gaussian weight per rarity around the moving center…
    let w = TIER_NAMES.map((_, i) => Math.exp(-((i + 1 - c) ** 2) / (2 * SIGMA * SIGMA)));
    // …keep only the WINDOW heaviest (enforce "≤4 rarities at once")…
    const keep = new Set(
        w.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, WINDOW).map((x) => x[1]),
    );
    w = w.map((v, i) => (keep.has(i) ? v : 0));
    // …drop negligible slivers so a rarity cleanly hits exactly 0 as the bump passes…
    const s0 = w.reduce((a, b) => a + b, 0);
    w = w.map((v) => (v / s0 < 0.005 ? 0 : v));
    // …normalize to integer percentages summing to 100 (largest remainder).
    const s = w.reduce((a, b) => a + b, 0);
    const pct = w.map((v) => (v / s) * 100);
    const floor = pct.map((p) => Math.floor(p));
    let rem = 100 - floor.reduce((a, b) => a + b, 0);
    const frac = pct.map((p, i) => [p - Math.floor(p), i]).sort((a, b) => b[0] - a[0]);
    for (let k = 0; k < rem; k++) floor[frac[k][1]]++;
    return floor;
}

// Solve C_MAX so Divine at the max level lands on the target jackpot %.
let CMAX = 5;
let best = Infinity;
for (let cm = 4.5; cm <= 6.5; cm += 0.005) {
    const d = Math.abs(chancesFor(N, cm)[6] - C_MAX_TARGET_DIVINE);
    if (d < best) { best = d; CMAX = cm; }
}

const goldCost = (L) => (L === 1 ? 0 : Math.round((G_BASE * Math.pow(G_GROWTH, L - 2)) / 5) * 5);
const xpForRarity = (t) => Math.max(1, t);
const avgXp = (ch) => ch.reduce((s, c, i) => s + c * xpForRarity(i + 1), 0) / 100;
const forgesToNext = (L) => Math.round(F_BASE * Math.pow(F_GROWTH, L - 1));
const xpCost = (L, ch) => Math.round(forgesToNext(L) * avgXp(ch));

// ─── Table ──────────────────────────────────────────────────────────────────
console.log(`config: N=${N} sigma=${SIGMA} P=${P} window=${WINDOW} C_MAX=${CMAX.toFixed(3)} F_GROWTH=${F_GROWTH}`);
const head = 'Lvl| ' + TIER_NAMES.map((n) => n.slice(0, 4).padStart(5)).join(' ') + ' |#a| forges|  xpCost|    gold| cumForge';
console.log(head);
console.log('-'.repeat(head.length));
let cum = 0;
for (let L = 1; L <= N; L++) {
    const ch = chancesFor(L, CMAX);
    const f = L < N ? forgesToNext(L) : 0;
    cum += f;
    console.log(
        String(L).padStart(3) + '| ' +
        ch.map((c) => (c === 0 ? '  .  ' : String(c).padStart(5))).join(' ') + ' |' +
        String(ch.filter((x) => x > 0).length).padStart(2) + '|' +
        (f ? String(f).padStart(7) : '   max ') + '|' +
        (L < N ? String(xpCost(L, ch)).padStart(8) : '    max ') + '|' +
        (L < N ? String(goldCost(L)).padStart(8) : '    max ') + '|' +
        String(cum).padStart(9),
    );
}

// ─── Constraint check ─────────────────────────────────────────────────────────
const rows = Array.from({ length: N }, (_, i) => chancesFor(i + 1, CMAX));
const ok = [];
ok.push(['L1 is 100% Common', rows[0][0] === 100 && rows[0].slice(1).every((x) => x === 0)]);
ok.push(['each row sums to 100', rows.every((r) => r.reduce((a, b) => a + b, 0) === 100)]);
ok.push([`≤${WINDOW} rarities active at any level`, rows.every((r) => r.filter((x) => x > 0).length <= WINDOW)]);
ok.push(['Divine at max level == 20%', rows[N - 1][6] === 20]);
ok.push(['L1→L2 == 100 forges', forgesToNext(1) === 100]);
ok.push(['total forges to max ≥ 1,000,000', cum >= 1_000_000]);
// every rarity below the final 4-wide window must reach exactly 0 (decays out).
// Epic..Divine are the final window, so only Common/Uncommon/Rare retire.
for (let t = 0; t < 7 - WINDOW; t++) {
    const last = rows.reduce((acc, r, i) => (r[t] > 0 ? i : acc), -1);
    ok.push([`${TIER_NAMES[t]} decays to 0 (last seen L${last + 1})`, last < N - 1]);
}
console.log('\nCONSTRAINT CHECK');
for (const [label, pass] of ok) console.log(`  ${pass ? '✓' : '✗ FAIL'}  ${label}`);
console.log(`\nTotal forges to max: ${cum.toLocaleString()}`);

// ─── Emit JS for config.js ────────────────────────────────────────────────────
if (process.argv.includes('--emit')) {
    console.log('\nexport const FORGE_LEVELS = [');
    for (let L = 1; L <= N; L++) {
        const ch = chancesFor(L, CMAX).map((x) => String(x).padStart(3)).join(',');
        console.log(`    { cost: ${String(goldCost(L)).padStart(6)}, chances: [${ch}] },`);
    }
    console.log('];');
    console.log(`export const FORGE_BASE_FORGES = ${F_BASE};`);
    console.log(`export const FORGE_FORGE_GROWTH = ${F_GROWTH};`);
}
