# Forge balance — rarity odds & XP/forge pacing

The full picture behind the forge curve, so we can revisit it later without
reverse-engineering the numbers. **Everything here is generated from one math
model**, not hand-tuned. The live values live in `src/game/config.js`
(`FORGE_LEVELS`, `FORGE_BASE_FORGES`, `FORGE_FORGE_GROWTH`); the generator is
`docs/forge-curve.gen.mjs`. To change anything, edit the knobs in the generator,
re-run it, and paste the output back — do **not** hand-edit individual rows.

```bash
node docs/forge-curve.gen.mjs          # table + constraint check
node docs/forge-curve.gen.mjs --emit   # also prints the JS to paste into config.js
```

## Design goals (what we asked for)

1. **More forge levels** — 35 (was 12).
2. **Higher rarity is real long work.** L1→L2 takes ~100 forges; reaching the cap
   (level 35) takes **~1.04M forges total**. This is intentionally huge: future
   forges will drop **multiple gear per forge** (2, 3, …), which makes leveling
   faster and faster, so the raw forge count has to be large to stay meaningful.
3. **New rarities unlock low and late**, so by the time a tier matters you already
   have a full set of the tier below and can keep upgrading it. Rare doesn't appear
   until L8, Epic L16, Legendary L23, Mythic L27, Divine L32.
4. **At most 4 rarities rollable at once.** As the curve climbs, the lowest rarity
   fades to **exactly 0** before a 5th would appear (Common gone after L22,
   Uncommon after L26, Rare after L31). So the forge offers a sliding 4-wide
   "rarity window," never a soup of all 7.
5. **At the highest forge level the top rarity (Divine) sits at 20%** — the
   permanent jackpot, never the most common roll.

## The model

### Rarity odds — a "traveling bump"

Picture the 7 rarities on a number line (Common = 1 … Divine = 7). At each forge
level we lay a **Gaussian bump** over that line and read off the weight under each
rarity:

```
weight(tier) = exp( -(tier - c)² / (2·σ²) )
```

- **`c` (the bump's center)** slides upward as the forge levels up. It does **not**
  move linearly — it follows `c(L) = C_MAX · ((L-1)/(N-1))^P` with `P = 1.45`, so
  it crawls through the low rarities early (long Common/Uncommon phase) and speeds
  up later. This is what keeps Rare out until L8.
- **`σ = 0.78`** is the bump width. Narrow ⇒ rarities overlap less, so new tiers
  enter later and at a lower share. This is the main "how gradual is it" dial.
- After computing weights we **keep only the 4 heaviest rarities** (hard cap),
  zero everything below a 0.5% sliver, and normalize to integer percents summing
  to 100. The hard cap + sliver-trim is what guarantees "≤4 active" and "the
  lowest decays to exactly 0."

Because the bump *travels*, the newest (highest) rarity is always on its **rising
edge** = low %, and the oldest (lowest) is on the **falling edge** → 0. The bulk
sits in the middle. That's exactly the "unlock new tier cheap, retire old tier"
feel we wanted, and it falls straight out of the geometry — no per-row tuning.

**Why Divine caps at 20%:** we stop the center at `C_MAX ≈ 5.915` (solved so the
max-level Divine share is exactly 20). The center never reaches 7, so Divine never
climbs past its rising edge — it's pinned as the jackpot. `C_MAX` is auto-solved by
the generator from the `C_MAX_TARGET_DIVINE` knob; change the target, not `C_MAX`.

### Forge / XP pacing — geometric forge count

Leveling the forge is driven by **forge XP** (earned every forge; a Common roll
grants 1 XP, Divine grants 7 — rarer rolls advance faster). We express pacing as an
**expected number of forges** per level, then convert to an XP threshold:

```
forgesForLevel(L) = FORGE_BASE_FORGES · FORGE_FORGE_GROWTH^(L-1)   # 100 · 1.262^(L-1)
forgeXpForLevel(L) = round( forgesForLevel(L) · avgForgeXp(L) )
```

`avgForgeXp(L)` is the average XP a single forge grants at level L given that
level's rarity odds. Multiplying by it means the **expected** forges to fill the
bar equals `forgesForLevel(L)` — rarity weighting only adds upside variance, it
doesn't shorten the grind. So the "expected forges" column is honest.

`FORGE_FORGE_GROWTH = 1.262` is solved so the cumulative climb is ~1.04M forges.
Want a longer/shorter grind? Nudge that one number and re-run.

### Gold instant-shortcut — the cheap fast lane

Each level also carries a gold `cost` (`10 → ~122k`, geometric ×1.33) to buy the
level instantly. This is **deliberately far below** the forge-XP grind — it's the
intended sink for (future, currently dormant) **shop gold**, not something you can
realistically pay for by grinding in-game gold, which is scarce by design (see
`REDESIGN.md` and `CLAUDE.md`). If multi-drop ever makes the forge path trivial we
may want to rescale this up; for now it's the explicit fast lane.

## The generated table

| Lvl | Com | Unc | Rare | Epic | Leg | Myth | Div | Active | Forges→next | Cumulative |
|----:|----:|----:|----:|----:|----:|----:|----:|:--:|----:|----:|
| 1 | 100 | – | – | – | – | – | – | 1 | 100 | 100 |
| 2 | 92 | 8 | – | – | – | – | – | 2 | 126 | 226 |
| 3 | 91 | 9 | – | – | – | – | – | 2 | 159 | 385 |
| 4 | 90 | 10 | – | – | – | – | – | 2 | 201 | 586 |
| 5 | 88 | 12 | – | – | – | – | – | 2 | 254 | 840 |
| 6 | 87 | 13 | – | – | – | – | – | 2 | 320 | 1,160 |
| 7 | 84 | 16 | – | – | – | – | – | 2 | 404 | 1,564 |
| 8 | 81 | 18 | 1 | – | – | – | – | 3 | 510 | 2,074 |
| 9 | 77 | 22 | 1 | – | – | – | – | 3 | 643 | 2,717 |
| 10 | 73 | 25 | 2 | – | – | – | – | 3 | 812 | 3,529 |
| 11 | 68 | 30 | 2 | – | – | – | – | 3 | 1,025 | 4,554 |
| 12 | 61 | 35 | 4 | – | – | – | – | 3 | 1,293 | 5,847 |
| 13 | 55 | 40 | 5 | – | – | – | – | 3 | 1,632 | 7,479 |
| 14 | 47 | 45 | 8 | – | – | – | – | 3 | 2,060 | 9,539 |
| 15 | 39 | 49 | 12 | – | – | – | – | 3 | 2,599 | 12,138 |
| 16 | 31 | 52 | 16 | 1 | – | – | – | 4 | 3,280 | 15,418 |
| 17 | 24 | 52 | 22 | 2 | – | – | – | 4 | 4,140 | 19,558 |
| 18 | 17 | 51 | 29 | 3 | – | – | – | 4 | 5,224 | 24,782 |
| 19 | 11 | 47 | 36 | 6 | – | – | – | 4 | 6,593 | 31,375 |
| 20 | 7 | 40 | 44 | 9 | – | – | – | 4 | 8,320 | 39,695 |
| 21 | 4 | 33 | 49 | 14 | – | – | – | 4 | 10,500 | 50,195 |
| 22 | 2 | 25 | 52 | 21 | – | – | – | 4 | 13,251 | 63,446 |
| 23 | – | 18 | 51 | 28 | 3 | – | – | 4 | 16,723 | 80,169 |
| 24 | – | 11 | 46 | 37 | 6 | – | – | 4 | 21,104 | 101,273 |
| 25 | – | 7 | 39 | 44 | 10 | – | – | 4 | 26,633 | 127,906 |
| 26 | – | 4 | 31 | 50 | 15 | – | – | 4 | 33,611 | 161,517 |
| 27 | – | – | 23 | 52 | 23 | 2 | – | 4 | 42,417 | 203,934 |
| 28 | – | – | 15 | 49 | 32 | 4 | – | 4 | 53,531 | 257,465 |
| 29 | – | – | 9 | 43 | 41 | 7 | – | 4 | 67,556 | 325,021 |
| 30 | – | – | 5 | 34 | 48 | 13 | – | 4 | 85,255 | 410,276 |
| 31 | – | – | 3 | 25 | 52 | 20 | – | 4 | 107,592 | 517,868 |
| 32 | – | – | – | 17 | 50 | 30 | 3 | 4 | 135,781 | 653,649 |
| 33 | – | – | – | 10 | 45 | 39 | 6 | 4 | 171,356 | 825,005 |
| 34 | – | – | – | 5 | 36 | 47 | 12 | 4 | 216,251 | 1,041,256 |
| 35 | – | – | – | 2 | 26 | 52 | 20 | 4 | max | 1,041,256 |

## Knobs at a glance

| Knob | In | Effect |
|------|-----|--------|
| `N` | generator | number of forge levels |
| `SIGMA` | generator | rarity overlap — smaller = later/lower unlocks |
| `P` | generator | how slow the early (low-rarity) game is |
| `C_MAX_TARGET_DIVINE` | generator | the max-level jackpot % (currently 20) |
| `FORGE_BASE_FORGES` | config + generator | forges for L1→L2 (100) |
| `FORGE_FORGE_GROWTH` | config + generator | grind length — 1.262 ≈ 1.04M total |
| `G_BASE` / `G_GROWTH` | generator | gold fast-lane cost curve |

## Future: multiple gear per forge

The plan is for the forge to eventually drop 2, 3, or more items per forge. That
multiplies the effective forge rate, which is precisely why the grind is sized at
~1M forges rather than ~40k — so it stays a long-haul once drops-per-forge climb.
When that lands, revisit `FORGE_FORGE_GROWTH` (and possibly the gold fast-lane) so
the *time* to max stays where we want it, and update this doc + re-run the generator.
