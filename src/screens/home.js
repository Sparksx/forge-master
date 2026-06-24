// Battle Home — the unified core screen. A persistent idle auto-battler sits on
// top; your gear grid and the forge sit below it. This merges the old Forge and
// Arena screens into one cohesive view, inspired by idle merge-RPG layouts:
//   stage track → live battle → progress bar → controls → gear → forge.
import { h, clear, fmt, toast, openModal, closeModal, confirmDialog } from './components.js';
import { renderItemCard, renderDeltaBadge, powerDelta } from './item-view.js';
import { EQUIPMENT_TYPES, MAX_FORGE_LEVEL, TIERS, avatarEmoji, stageInfo } from '../game/config.js';
import { slotIcon, slotLabel, rarityColor, rarityName, itemName } from '../game/items.js';
import {
    getEquipment, getEquippedItem, getForgeLevel, getForgeUpgradeCost, getForgeChances,
    upgradeForge, equipItem, sellItem, getSellValue, getGold,
    getArenaRank, setArenaRank, getPowerScore, getAvatar, getCombatStats, grantGold,
} from '../game/state.js';
import { forge } from '../game/forge.js';
import { fightArena, makeEnemy } from '../game/arena.js';
import { createDungeon } from './dungeon.js';
import { gameEvents, EVENTS } from '../events.js';

let root = null;
let visible = false;
let dungeon = null;

// Battle loop
let battleBusy = false;
// Combat is always automatic at normal speed — the hero walks to mobs and
// fights on its own; neither auto nor speed is player-toggleable.
const autoBattle = true;
const fast = false;

// Forge
let forging = false;
let autoForge = false;
let autoForgeTimer = null;

// Boost: a free, self-contained 2x-gold buff on a cooldown (no ads needed).
const BOOST_DURATION = 120000; // 2 min active
const BOOST_COOLDOWN = 240000; // 4 min lockout after it ends
let boostUntil = 0;
let boostReadyAt = 0;
let tickTimer = null;

export const id = 'home';
export const icon = '🔨';
export const label = 'Forge';

// ── Render ────────────────────────────────────────────────────────────────
export function render(container) {
    root = container;
    clear(root);
    root.appendChild(h('div', { className: 'home-screen' }, buildBattle(), buildForge()));
    refresh();
}

export function onShow() {
    visible = true;
    refresh();
    startTicker();
    dungeon?.start();
    dungeon?.setAuto(autoBattle);
    dungeon?.setFast(fast);
    updateStage(); // spawn the current matchup; auto-walk will engage it
    if (autoForge) scheduleAutoForge();
}

export function onHide() {
    visible = false;
    dungeon?.stop();
    clearTimeout(autoForgeTimer);
    clearInterval(tickTimer);
    autoForgeTimer = tickTimer = null;
}

export function refresh() {
    if (!root || !root.querySelector('.gear-grid')) return;
    updateGearGrid();
    const chip = root.querySelector('.forge-level-chip');
    if (chip) chip.textContent = `Forge Lv ${getForgeLevel()}`;
    updateBoostBtn();
    // Don't disturb a fight in progress; just keep the idle preview fresh.
    if (!battleBusy) syncPreview();
}

// ── Battle zone ─────────────────────────────────────────────────────────────
function buildBattle() {
    const dungeonHost = h('div', { className: 'dungeon-host' });
    dungeon = createDungeon({ onEngage: () => runFight() });
    dungeon.mount(dungeonHost);

    return h('div', { className: 'battle-zone' },
        h('div', { className: 'stage-head' },
            h('div', { className: 'stage-title', text: 'Hard 1-1' }),
            h('div', { className: 'stage-track' },
                h('span', { className: 'stage-node prev' }),
                h('span', { className: 'stage-node cur' }),
                h('span', { className: 'stage-node next' }),
            ),
        ),
        dungeonHost,
        h('div', { className: 'stage-progress' },
            h('div', { className: 'stage-bar' }, h('div', { className: 'stage-bar-fill' })),
            h('div', { className: 'stage-meta' },
                h('span', { className: 'stage-bar-label', text: 'Stage 1 / 10' }),
                h('span', { className: 'rank-chip', text: 'Rank 1' }),
            ),
        ),
        h('div', { className: 'battle-controls' },
            h('button', { className: 'ctrl-btn boost-btn', onclick: activateBoost },
                h('span', { className: 'ctrl-icon', text: '⚡' }), h('span', { className: 'boost-label', text: 'Boost x2' })),
        ),
    );
}

// Build the matchup payload for the current rank and sync the stage header text.
function matchupPayload() {
    const rank = getArenaRank();
    const enemy = makeEnemy(rank);
    const player = getCombatStats();

    const info = stageInfo(rank);
    root.querySelector('.stage-title').textContent = info.label;
    root.querySelector('.stage-bar-fill').style.width = `${Math.round(info.progress * 100)}%`;
    root.querySelector('.stage-bar-label').textContent = `Stage ${info.sub} / 10`;
    root.querySelector('.rank-chip').textContent = `Rank ${rank}`;

    return {
        rank,
        playerEmoji: avatarEmoji(getAvatar()),
        playerLabel: `You · ${fmt(getPowerScore())}`,
        playerHP: player.maxHP,
        enemyEmoji: enemy.emoji,
        enemyLabel: `${enemy.name} · ${fmt(enemy.power)}`,
        enemyHP: enemy.maxHP,
    };
}

// Spawn the next opponent (onShow / after a fight): the mob respawns and, with
// auto on, the hero walks over to engage it.
function updateStage() {
    if (dungeon) dungeon.nextMatchup(matchupPayload());
}

// Lightweight refresh on a state change (gear/gold) — never moves the mob.
function syncPreview() {
    if (dungeon) dungeon.refreshMatchup(matchupPayload());
}

// ── Battle loop ─────────────────────────────────────────────────────────────
// Triggered by the dungeon when the hero reaches the mob (auto-walk or steered).
async function runFight() {
    if (battleBusy || !visible) return;
    battleBusy = true;
    dungeon.setEngaged(true);

    const result = fightArena();
    const { events, player, enemy } = result;
    const info = stageInfo(result.rank);
    root.querySelector('.stage-title').textContent = info.label;
    dungeon.setHp('player', player.maxHP, player.maxHP);
    dungeon.setHp('enemy', enemy.maxHP, enemy.maxHP);

    // Compress long fights so playback stays snappy; honor the 2x speed toggle.
    const step = events.length > 20 ? Math.ceil(events.length / 20) : 1;
    const beat = fast ? 55 : 110;
    for (let i = 0; i < events.length; i += step) {
        if (!visible) break;
        const ev = events[i];
        await sleep(beat);
        if (ev.by === 'player') {
            dungeon.setHp('enemy', ev.eHp, enemy.maxHP);
            dungeon.floater('enemy', `-${fmt(ev.dmg)}`, ev.crit ? 'crit' : '');
            if (ev.heal) dungeon.floater('player', `+${fmt(ev.heal)}`, 'heal');
        } else {
            dungeon.setHp('player', ev.pHp, player.maxHP);
            dungeon.floater('player', `-${fmt(ev.dmg)}`, ev.crit ? 'crit' : '');
        }
    }
    const last = events[events.length - 1];
    if (last) { dungeon.setHp('player', last.pHp, player.maxHP); dungeon.setHp('enemy', last.eHp, enemy.maxHP); }

    await sleep(fast ? 120 : 220);
    resolveFight(result);
    if (result.win) await dungeon.killEnemy();

    dungeon.setEngaged(false);
    battleBusy = false;
    if (visible) updateStage(); // spawn the next opponent (advanced rank on a win)
}

function resolveFight(result) {
    const mult = boostActive() ? 2 : 1;
    const granted = grantGold(result.reward * mult);
    dungeon.floater('player', `+${fmt(granted)}💰`, 'gold');

    if (result.win) {
        setArenaRank(result.rank + 1);
    }
    gameEvents.emit(EVENTS.ARENA_RESULT, result);
}

// ── Boost ───────────────────────────────────────────────────────────────────
const boostActive = () => Date.now() < boostUntil;
const boostReady = () => Date.now() >= boostReadyAt;

function activateBoost() {
    if (boostActive()) { toast('Boost already active', 'info'); return; }
    if (!boostReady()) { toast('Boost is recharging', 'error'); return; }
    boostUntil = Date.now() + BOOST_DURATION;
    boostReadyAt = boostUntil + BOOST_COOLDOWN;
    toast('⚡ 2x gold for 2 minutes!', 'gold');
    updateBoostBtn();
}

function updateBoostBtn() {
    const btn = root?.querySelector('.boost-btn');
    if (!btn) return;
    const label = btn.querySelector('.boost-label');
    if (boostActive()) {
        btn.classList.add('active'); btn.classList.remove('cooling');
        label.textContent = `x2 · ${clock(boostUntil - Date.now())}`;
    } else if (!boostReady()) {
        btn.classList.remove('active'); btn.classList.add('cooling');
        label.textContent = clock(boostReadyAt - Date.now());
    } else {
        btn.classList.remove('active', 'cooling');
        label.textContent = 'Boost x2';
    }
}

function startTicker() {
    clearInterval(tickTimer);
    tickTimer = setInterval(() => { if (visible) updateBoostBtn(); }, 500);
}

function clock(ms) {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// ── Forge zone ──────────────────────────────────────────────────────────────
function buildForge() {
    const grid = h('div', { className: 'gear-grid' });
    EQUIPMENT_TYPES.forEach((type) => grid.appendChild(
        h('button', { className: 'gear-slot', dataset: { type }, onclick: () => showSlotDetail(type) })));

    return h('div', { className: 'forge-zone' },
        h('div', { className: 'gear-header' }, h('span', { text: 'Equipped Gear' })),
        grid,
        h('div', { className: 'forge-bar' },
            h('button', { className: 'forge-level-chip', onclick: showForgeUpgrade, text: `Forge Lv ${getForgeLevel()}` }),
            h('button', { className: 'forge-btn-main', onclick: doForge },
                h('span', { className: 'forge-btn-anvil', text: '⚒️' }),
                h('span', { className: 'forge-btn-label', text: 'FORGE' }),
                h('div', { className: 'forge-floaters' }),
            ),
            h('button', { className: 'ctrl-btn auto-forge', onclick: toggleAutoForge },
                h('span', { className: 'ctrl-icon', text: '♻️' }), h('span', { text: 'Auto' })),
        ),
    );
}

function doForge() {
    if (forging) return;
    forging = true;
    const btn = root.querySelector('.forge-btn-main');
    btn.classList.add('forging');
    setTimeout(() => {
        btn.classList.remove('forging');
        forging = false;
        const item = forge();
        gameEvents.emit(EVENTS.ITEM_FORGED, item);
        showReveal(item);
    }, 700);
}

function toggleAutoForge() {
    autoForge = !autoForge;
    root.querySelector('.auto-forge').classList.toggle('on', autoForge);
    if (autoForge) { toast('Auto-forge on — keeps upgrades, sells the rest', 'info'); scheduleAutoForge(); }
    else clearTimeout(autoForgeTimer);
}

function scheduleAutoForge() {
    clearTimeout(autoForgeTimer);
    autoForgeTimer = setTimeout(() => {
        if (!visible || !autoForge) return;
        const item = forge();
        gameEvents.emit(EVENTS.ITEM_FORGED, item);
        const { delta } = powerDelta(item);
        if (delta > 0) {
            equipItem(item);
            forgeFloater(`▲ ${rarityName(item.tier)}`, rarityColor(item.tier));
        } else {
            const v = sellItem(item);
            forgeFloater(`+${fmt(v)}💰`, '');
        }
        scheduleAutoForge();
    }, fast ? 900 : 1600);
}

function forgeFloater(text, color) {
    const wrap = root?.querySelector('.forge-floaters');
    if (!wrap) return;
    const f = h('span', { className: 'forge-floater', text });
    if (color) f.style.color = color;
    wrap.appendChild(f);
    setTimeout(() => f.remove(), 900);
}

// ── Reveal / slot detail / forge upgrade (kept from the old Forge screen) ─────
function showReveal(item) {
    let decided = false;
    const { delta } = powerDelta(item);
    const equipped = getEquippedItem(item.type);

    const sell = () => { decided = true; const v = sellItem(item); closeModal(); toast(`Sold for ${fmt(v)} gold`, 'gold'); };
    const equip = () => { decided = true; equipItem(item); closeModal(); toast(`Equipped ${itemName(item)}`, 'success'); };

    const body = h('div', { className: 'reveal', style: { '--rarity': rarityColor(item.tier) } },
        h('div', { className: 'reveal-flash', text: rarityName(item.tier) }),
        renderItemCard(item),
        h('div', { className: 'reveal-delta' }, renderDeltaBadge(delta)),
        equipped ? h('p', { className: 'reveal-replaces', text: `Replaces ${itemName(equipped)} (Lv ${equipped.level}) · auto-sells for ${fmt(getSellValue(equipped))}g` }) : null,
        h('div', { className: 'reveal-actions' },
            h('button', { className: 'btn btn-ghost', text: `Sell · ${fmt(getSellValue(item))}g`, onclick: sell }),
            h('button', { className: 'btn btn-primary', text: delta >= 0 ? 'Equip ✓' : 'Equip anyway', onclick: equip }),
        ),
    );
    openModal(body, { onClose: () => { if (!decided) sell(); } });
}

function updateGearGrid() {
    EQUIPMENT_TYPES.forEach((type) => {
        const slot = root.querySelector(`.gear-slot[data-type="${type}"]`);
        if (!slot) return;
        clear(slot);
        const item = getEquippedItem(type);
        if (item) {
            slot.style.setProperty('--rarity', rarityColor(item.tier));
            slot.classList.add('filled');
            slot.appendChild(h('span', { className: 'gear-slot-icon', text: slotIcon(type) }));
            slot.appendChild(h('span', { className: 'gear-slot-lvl', text: `Lv ${item.level}` }));
        } else {
            slot.classList.remove('filled');
            slot.style.removeProperty('--rarity');
            slot.appendChild(h('span', { className: 'gear-slot-icon empty', text: slotIcon(type) }));
        }
    });
}

function showSlotDetail(type) {
    const item = getEquippedItem(type);
    if (!item) {
        const body = h('div', { className: 'slot-detail' },
            h('div', { className: 'slot-detail-empty' },
                h('span', { className: 'slot-detail-icon', text: slotIcon(type) }),
                h('h3', { text: `${slotLabel(type)} — empty` }),
                h('p', { className: 'muted', text: 'Forge gear to fill this slot.' }),
            ),
            h('button', { className: 'btn btn-ghost btn-block', text: 'Close', onclick: closeModal }),
        );
        openModal(body);
        return;
    }
    const body = h('div', { className: 'slot-detail' },
        renderItemCard(item),
        h('div', { className: 'slot-detail-actions' },
            h('button', {
                className: 'btn btn-danger', text: `Sell · ${fmt(getSellValue(item))}g`,
                onclick: async () => {
                    const ok = await confirmDialog({ title: 'Sell equipped item?', message: `${itemName(item)} will be removed and sold.`, confirmText: 'Sell' });
                    if (ok) {
                        getEquipment()[type] = null;
                        const v = sellItem(item);
                        closeModal();
                        toast(`Sold for ${fmt(v)} gold`, 'gold');
                    }
                },
            }),
            h('button', { className: 'btn btn-primary', text: 'Close', onclick: closeModal }),
        ),
    );
    openModal(body);
}

function showForgeUpgrade() {
    const level = getForgeLevel();
    const cost = getForgeUpgradeCost();
    const cur = getForgeChances(level);
    const next = level < MAX_FORGE_LEVEL ? getForgeChances(level + 1) : null;

    const oddsRow = (label, chances) => h('div', { className: 'odds-row' },
        h('span', { className: 'odds-label', text: label }),
        h('div', { className: 'odds-bars' },
            ...chances.map((c, i) => c > 0
                ? h('span', { className: 'odds-bar', style: { background: TIERS[i].color, flexGrow: String(c) }, attrs: { title: `${TIERS[i].name}: ${c}%` } })
                : null).filter(Boolean)),
    );

    const body = h('div', { className: 'forge-upgrade' },
        h('h3', { text: '⚒️ Forge Upgrade' }),
        h('p', { className: 'muted', text: 'A higher forge level shifts the odds toward rarer gear. Upgrades are instant.' }),
        h('div', { className: 'odds-legend' },
            ...TIERS.map((t) => h('span', { className: 'legend-item' },
                h('span', { className: 'legend-dot', style: { background: t.color } }), t.name))),
        oddsRow(`Now · Lv ${level}`, cur),
        next ? oddsRow(`Next · Lv ${level + 1}`, next) : null,
        level >= MAX_FORGE_LEVEL
            ? h('p', { className: 'maxed', text: 'Forge is at maximum level!' })
            : h('button', {
                className: 'btn btn-primary btn-block',
                text: `Upgrade · ${fmt(cost)} gold`,
                onclick: () => {
                    if (getGold() < cost) { toast('Not enough gold', 'error'); return; }
                    if (upgradeForge()) { toast(`Forge upgraded to Lv ${getForgeLevel()}!`, 'success'); closeModal(); showForgeUpgrade(); }
                },
            }),
        h('button', { className: 'btn btn-ghost btn-block', text: 'Close', onclick: closeModal }),
    );
    openModal(body);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
