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
import { gameEvents, EVENTS } from '../events.js';

let root = null;
let visible = false;

// Battle loop
let battleBusy = false;
let autoBattle = true; // idle-first: the hero fights on its own by default
let fast = false; // 2x playback speed
let nextFightTimer = null;

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
    if (autoBattle) scheduleNextFight(400);
    if (autoForge) scheduleAutoForge();
}

export function onHide() {
    visible = false;
    clearTimeout(nextFightTimer);
    clearTimeout(autoForgeTimer);
    clearInterval(tickTimer);
    nextFightTimer = autoForgeTimer = tickTimer = null;
}

export function refresh() {
    if (!root || !root.querySelector('.gear-grid')) return;
    updateGearGrid();
    const chip = root.querySelector('.forge-level-chip');
    if (chip) chip.textContent = `Forge Lv ${getForgeLevel()}`;
    updateBoostBtn();
    // Don't disturb a fight in progress; just keep the idle preview fresh.
    if (!battleBusy) updateStage();
}

// ── Battle zone ─────────────────────────────────────────────────────────────
function buildBattle() {
    return h('div', { className: 'battle-zone' },
        h('div', { className: 'stage-head' },
            h('div', { className: 'stage-title', text: 'Hard 1-1' }),
            h('div', { className: 'stage-track' },
                h('span', { className: 'stage-node prev' }),
                h('span', { className: 'stage-node cur' }),
                h('span', { className: 'stage-node next' }),
            ),
        ),
        h('div', { className: 'arena-stage battle-stage' },
            fighter('player'),
            h('div', { className: 'arena-vs', text: 'VS' }),
            fighter('enemy'),
        ),
        h('div', { className: 'stage-progress' },
            h('div', { className: 'stage-bar' }, h('div', { className: 'stage-bar-fill' })),
            h('div', { className: 'stage-meta' },
                h('span', { className: 'stage-bar-label', text: 'Stage 1 / 10' }),
                h('span', { className: 'rank-chip', text: 'Rank 1' }),
            ),
        ),
        h('div', { className: 'battle-controls' },
            h('button', { className: 'ctrl-btn auto-battle on', onclick: toggleAutoBattle },
                h('span', { className: 'ctrl-icon', text: '♾️' }), h('span', { text: 'Auto' })),
            h('button', { className: 'ctrl-btn speed-btn', onclick: toggleSpeed },
                h('span', { className: 'ctrl-icon', text: '⏩' }), h('span', { className: 'speed-label', text: '1x' })),
            h('button', { className: 'ctrl-btn boost-btn', onclick: activateBoost },
                h('span', { className: 'ctrl-icon', text: '⚡' }), h('span', { className: 'boost-label', text: 'Boost x2' })),
            h('button', { className: 'ctrl-btn fight-once hidden', onclick: () => runFight() },
                h('span', { className: 'ctrl-icon', text: '⚔️' }), h('span', { text: 'Fight' })),
        ),
    );
}

function fighter(side) {
    return h('div', { className: `fighter fighter-${side}` },
        h('div', { className: 'fighter-avatar', dataset: { side }, text: side === 'player' ? avatarEmoji(getAvatar()) : '👹' }),
        h('div', { className: 'fighter-name', dataset: { side }, text: '' }),
        h('div', { className: 'hpbar' }, h('div', { className: 'hpfill', dataset: { side } }), h('span', { className: 'hptext', dataset: { side } })),
        h('div', { className: 'fighter-floaters', dataset: { side } }),
    );
}

// Refresh the idle preview (between fights): current opponent + stage labels.
function updateStage() {
    const rank = getArenaRank();
    const enemy = makeEnemy(rank);
    const player = getCombatStats();

    const info = stageInfo(rank);
    root.querySelector('.stage-title').textContent = info.label;
    root.querySelector('.stage-bar-fill').style.width = `${Math.round(info.progress * 100)}%`;
    root.querySelector('.stage-bar-label').textContent = `Stage ${info.sub} / 10`;
    root.querySelector('.rank-chip').textContent = `Rank ${rank}`;

    setFighter('player', avatarEmoji(getAvatar()), `You · ${fmt(getPowerScore())}`, player.maxHP, player.maxHP);
    setFighter('enemy', enemy.emoji, `${enemy.name} · ${fmt(enemy.power)}`, enemy.maxHP, enemy.maxHP);
}

function setFighter(side, emoji, name, hp, maxHP) {
    root.querySelector(`.fighter-avatar[data-side="${side}"]`).textContent = emoji;
    root.querySelector(`.fighter-name[data-side="${side}"]`).textContent = name;
    setHp(side, hp, maxHP);
}

function setHp(side, hp, maxHP) {
    const pct = Math.max(0, Math.min(100, (hp / maxHP) * 100));
    root.querySelector(`.hpfill[data-side="${side}"]`).style.width = `${pct}%`;
    root.querySelector(`.hptext[data-side="${side}"]`).textContent = `${fmt(Math.max(0, Math.round(hp)))}/${fmt(maxHP)}`;
}

function floater(side, text, cls = '') {
    const wrap = root.querySelector(`.fighter-floaters[data-side="${side}"]`);
    if (!wrap) return;
    const f = h('span', { className: `floater ${cls}`, text });
    wrap.appendChild(f);
    setTimeout(() => f.remove(), 800);
}

// ── Battle loop ─────────────────────────────────────────────────────────────
function scheduleNextFight(delay) {
    clearTimeout(nextFightTimer);
    nextFightTimer = setTimeout(() => { if (visible && autoBattle) runFight(); }, delay);
}

async function runFight() {
    if (battleBusy || !visible) return;
    battleBusy = true;
    root.querySelector('.battle-stage')?.classList.add('fighting');

    const result = fightArena();
    const { events, player, enemy } = result;
    const info = stageInfo(result.rank);
    root.querySelector('.stage-title').textContent = info.label;
    setFighter('player', avatarEmoji(getAvatar()), `You · ${fmt(getPowerScore())}`, player.maxHP, player.maxHP);
    setFighter('enemy', enemy.emoji, `${enemy.name} · ${fmt(enemy.power)}`, enemy.maxHP, enemy.maxHP);

    // Compress long fights so playback stays snappy; honor the 2x speed toggle.
    const step = events.length > 20 ? Math.ceil(events.length / 20) : 1;
    const beat = fast ? 55 : 110;
    for (let i = 0; i < events.length; i += step) {
        if (!visible) break;
        const ev = events[i];
        await sleep(beat);
        if (ev.by === 'player') {
            setHp('enemy', ev.eHp, enemy.maxHP);
            floater('enemy', `-${fmt(ev.dmg)}`, ev.crit ? 'crit' : '');
            if (ev.heal) floater('player', `+${fmt(ev.heal)}`, 'heal');
        } else {
            setHp('player', ev.pHp, player.maxHP);
            floater('player', `-${fmt(ev.dmg)}`, ev.crit ? 'crit' : '');
        }
    }
    const last = events[events.length - 1];
    if (last) { setHp('player', last.pHp, player.maxHP); setHp('enemy', last.eHp, enemy.maxHP); }

    await sleep(fast ? 120 : 220);
    resolveFight(result);

    root.querySelector('.battle-stage')?.classList.remove('fighting');
    battleBusy = false;
    if (visible && autoBattle) scheduleNextFight(fast ? 350 : 750);
    else if (visible) updateStage(); // reset the idle preview to the next opponent
}

function resolveFight(result) {
    const mult = boostActive() ? 2 : 1;
    const granted = grantGold(result.reward * mult);
    floater('player', `+${fmt(granted)}💰`, 'gold');

    if (result.win) {
        setArenaRank(result.rank + 1);
    }
    gameEvents.emit(EVENTS.ARENA_RESULT, result);
}

function toggleAutoBattle() {
    autoBattle = !autoBattle;
    const btn = root.querySelector('.auto-battle');
    btn.classList.toggle('on', autoBattle);
    root.querySelector('.fight-once').classList.toggle('hidden', autoBattle);
    if (autoBattle && !battleBusy) scheduleNextFight(150);
}

function toggleSpeed() {
    fast = !fast;
    const btn = root.querySelector('.speed-btn');
    btn.classList.toggle('on', fast);
    root.querySelector('.speed-label').textContent = fast ? '2x' : '1x';
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
