import { describe, it, expect } from 'vitest';
import { ARENAS, getArena, pickArenaId, randomArenaId } from '../arenas.js';

// Mirror the dungeon's fixed room grid so layout assertions match what's drawn.
const COLS = 15;
const ROWS = 9;
// Hero spawns on col 2; the enemy pack spawns on cols 11–13. A pillar on any of
// these would land a fighter inside a wall or wall off its approach.
const PLAYER_COL = 2;
const ENEMY_COLS = [11, 12, 13];

// Build the same wall grid the dungeon does: solid perimeter + interior pillars.
function buildWalls(pillars) {
    const grid = [];
    for (let r = 0; r < ROWS; r++) {
        const row = [];
        for (let c = 0; c < COLS; c++) {
            row.push(r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1);
        }
        grid.push(row);
    }
    for (const [c, r] of pillars) grid[r][c] = true;
    return grid;
}

// Flood-fill from a start tile; returns the set of reachable open tiles.
function reachable(grid, startC, startR) {
    const key = (c, r) => `${c},${r}`;
    const seen = new Set([key(startC, startR)]);
    const queue = [[startC, startR]];
    while (queue.length) {
        const [c, r] = queue.shift();
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nc = c + dc, nr = r + dr;
            if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
            if (grid[nr][nc]) continue;
            const k = key(nc, nr);
            if (seen.has(k)) continue;
            seen.add(k);
            queue.push([nc, nr]);
        }
    }
    return seen;
}

describe('arena definitions', () => {
    it('pre-generates at least 5 arenas', () => {
        expect(ARENAS.length).toBeGreaterThanOrEqual(5);
    });

    it('every arena has a unique id and a complete theme', () => {
        const ids = ARENAS.map((a) => a.id);
        expect(new Set(ids).size).toBe(ids.length);
        for (const a of ARENAS) {
            expect(typeof a.name).toBe('string');
            for (const k of ['floorA', 'floorB', 'wallBase', 'wallInset', 'wallShade']) {
                expect(typeof a.theme[k]).toBe('string');
            }
        }
    });

    it('pillars stay inside the room and clear of spawn columns', () => {
        for (const a of ARENAS) {
            for (const [c, r] of a.pillars) {
                expect(c).toBeGreaterThan(0);
                expect(r).toBeGreaterThan(0);
                expect(c).toBeLessThan(COLS - 1);
                expect(r).toBeLessThan(ROWS - 1);
                expect(c).not.toBe(PLAYER_COL);
                expect(ENEMY_COLS).not.toContain(c);
            }
        }
    });

    it('leaves a clear path from the hero spawn to every enemy spawn', () => {
        const mid = Math.floor(ROWS / 2);
        for (const a of ARENAS) {
            const grid = buildWalls(a.pillars);
            const open = reachable(grid, PLAYER_COL, mid);
            for (const c of ENEMY_COLS) {
                // At least one open row in each enemy spawn column is reachable.
                const anyReachable = Array.from({ length: ROWS }, (_, r) => r)
                    .some((r) => !grid[r][c] && open.has(`${c},${r}`));
                expect(anyReachable, `${a.id} blocks enemy col ${c}`).toBe(true);
            }
        }
    });
});

describe('arena selection', () => {
    it('getArena resolves a known id and falls back to the default', () => {
        expect(getArena(ARENAS[2].id)).toBe(ARENAS[2]);
        expect(getArena('does-not-exist')).toBe(ARENAS[0]);
        expect(getArena()).toBe(ARENAS[0]);
    });

    it('pickArenaId is deterministic per seed and returns a real arena', () => {
        expect(pickArenaId(12345)).toBe(pickArenaId(12345));
        expect(ARENAS.map((a) => a.id)).toContain(pickArenaId(12345));
    });

    it('pickArenaId varies across seeds (covers more than one arena)', () => {
        const picks = new Set(Array.from({ length: 200 }, (_, i) => pickArenaId(i * 2654435761)));
        expect(picks.size).toBeGreaterThan(1);
    });

    it('randomArenaId always returns a defined arena id', () => {
        const ids = new Set(ARENAS.map((a) => a.id));
        for (let i = 0; i < 50; i++) expect(ids.has(randomArenaId())).toBe(true);
    });
});
