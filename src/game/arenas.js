// Battle arenas — the pre-generated *rooms* a fight is staged in. The dungeon
// renderer (src/screens/dungeon.js) owns combat/positions; this module owns the
// purely-cosmetic scenery: the interior pillar layout and the floor/wall colour
// theme. A handful of distinct arenas are defined here and one is picked per
// fight so battles stop looking identical.
//
// Replay-safe by design: an arena is referenced by a stable `id`, and a fight
// can either carry an explicit arena id or derive one deterministically from its
// seed (`pickArenaId`). Because PvP matches share a seed across both clients,
// seed-derived selection makes every viewer/replay render the *same* arena — no
// extra data needs to travel with the fight.
//
// All arenas share the dungeon's fixed 15×9 tile grid and a solid perimeter, so
// pillar coordinates stay clear of the hero spawn column (col 2) and the enemy
// spawn columns (cols 11–13) and never wall off a lane — the line-up always has
// a clear path to engage.
import { seededRng } from './config.js';

/**
 * @typedef {object} ArenaTheme
 * @property {string} floorA   checkerboard tile colour A
 * @property {string} floorB   checkerboard tile colour B
 * @property {string} wallBase outer wall fill (darkest)
 * @property {string} wallInset inset wall face
 * @property {string} wallShade bottom shadow strip on walls
 */

/**
 * @typedef {object} Arena
 * @property {string} id        stable identifier (stored/replayed)
 * @property {string} name      display label
 * @property {Array<[number, number]>} pillars  interior [col,row] wall tiles
 * @property {ArenaTheme} theme  floor/wall palette
 */

/** @type {Arena[]} */
export const ARENAS = [
    {
        id: 'obsidian-hall',
        name: 'Obsidian Hall',
        pillars: [[4, 3], [4, 5], [10, 3], [10, 5], [7, 4]],
        theme: {
            floorA: '#1d1638', floorB: '#181230',
            wallBase: '#0c0a18', wallInset: 'rgba(46,38,80,.9)', wallShade: 'rgba(0,0,0,.35)',
        },
    },
    {
        id: 'verdant-court',
        name: 'Verdant Court',
        pillars: [[7, 2], [7, 6]],
        theme: {
            floorA: '#16301f', floorB: '#12281a',
            wallBase: '#08160d', wallInset: 'rgba(40,80,52,.9)', wallShade: 'rgba(0,0,0,.35)',
        },
    },
    {
        id: 'ember-pit',
        name: 'Ember Pit',
        pillars: [[7, 2], [5, 4], [9, 4], [7, 6]],
        theme: {
            floorA: '#301a16', floorB: '#281512',
            wallBase: '#160a08', wallInset: 'rgba(96,52,40,.9)', wallShade: 'rgba(0,0,0,.4)',
        },
    },
    {
        id: 'frost-vault',
        name: 'Frost Vault',
        pillars: [[4, 2], [10, 2], [4, 6], [10, 6]],
        theme: {
            floorA: '#16263a', floorB: '#122033',
            wallBase: '#08111a', wallInset: 'rgba(44,68,100,.9)', wallShade: 'rgba(0,0,0,.35)',
        },
    },
    {
        id: 'sunken-divide',
        name: 'Sunken Divide',
        pillars: [[7, 1], [7, 3], [7, 5], [7, 7]],
        theme: {
            floorA: '#332b1a', floorB: '#2b2415',
            wallBase: '#161208', wallInset: 'rgba(96,84,44,.9)', wallShade: 'rgba(0,0,0,.4)',
        },
    },
    {
        id: 'royal-ring',
        name: 'Royal Ring',
        pillars: [[5, 3], [9, 3], [5, 5], [9, 5], [7, 2], [7, 6]],
        theme: {
            floorA: '#2a163a', floorB: '#231233',
            wallBase: '#120818', wallInset: 'rgba(72,42,96,.9)', wallShade: 'rgba(0,0,0,.4)',
        },
    },
];

const byId = new Map(ARENAS.map((a) => [a.id, a]));

/** Look up an arena by id, falling back to the first (default) arena. */
export function getArena(id) {
    return byId.get(id) || ARENAS[0];
}

/**
 * Deterministically pick an arena id from a fight seed. The same seed always
 * yields the same arena, so PvP replays (which share a seed across clients)
 * stage the fight in the identical room everywhere.
 */
export function pickArenaId(seed) {
    const rng = seededRng((seed >>> 0) || 1);
    return ARENAS[Math.floor(rng() * ARENAS.length) % ARENAS.length].id;
}

/**
 * Pick a random arena id for a fresh fight (PvE variety). Store the result with
 * the encounter so the chosen arena can be reproduced if the fight is restaged.
 */
export function randomArenaId() {
    return ARENAS[Math.floor(Math.random() * ARENAS.length) % ARENAS.length].id;
}
