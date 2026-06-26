// Battle Home — the unified core screen. A persistent idle auto-battler sits on
// top; your gear grid and the forge sit below it. This merges the old Forge and
// Arena screens into one cohesive view, inspired by idle merge-RPG layouts:
//   stage label → live battle → gear grid → forge controls + forge-XP bar.
import { h, clear, fmt, toast, openModal, closeModal, confirmDialog } from './components.js';
import { renderItemCard, renderDeltaBadge, powerDelta } from './item-view.js';
import { EQUIPMENT_TYPES, MAX_FORGE_LEVEL, TIERS, avatarEmoji, stageInfo, arenaXp, arenaFallbackRank } from '../game/config.js';
import { slotIcon, itemIcon, slotLabel, rarityColor, rarityName, itemName } from '../game/items.js';
import {
    getEquipment, getEquippedItem, getForgeLevel, getForgeUpgradeCost, getForgeChances,
    upgradeForge, equipItem, trashItem, getGold,
    getArenaRank, setArenaRank, getPowerScore, getAvatar, getCombatStats, grantGold,
    grantPlayerXp, getForgeLevelProgress, getForgeSpeedPct, getForgeBestOf,
} from '../game/state.js';
import { forge } from '../game/forge.js';
import {
    loadAutoForgeSettings, getAutoForgeSettings, isSlotKept, setSlotKept,
    setTrashLowerPower, autoForgeAction,
} from '../game/auto-forge.js';
import { makeEncounter, encounterReward } from '../game/arena.js';
import { getRecentMessages } from '../game/chat.js';
import { openChat } from './chat.js';
import { createDungeon } from './dungeon.js';
import { gameEvents, EVENTS } from '../events.js';

let root = null;
let visible = false;
let dungeon = null;

// Battle loop — the dungeon runs a live, real-time fight and reports the result.
let currentEncounter = null;
let nextTimer = null;
// Combat is always automatic at normal speed — the hero walks to mobs and
// fights on its own; speed is not player-toggleable.
const fast = false;

// Forge
let forging = false;
let autoForge = false;
let autoForgeTimer = null;
// Set while auto-forge is paused waiting on a player decision (the reveal modal
// is open). The loop resumes once that decision is made.
let autoForgePaused = false;

// Restore the player's saved auto-forge filters (kept slots, trash-lower-power).
loadAutoForgeSettings();

export const id = 'home';
export const icon = '🔨';
export const label = 'Forge';

// ── Render ────────────────────────────────────────────────────────────────
export function render(container) {
    root = container;
    clear(root);
    root.appendChild(h('div', { className: 'home-screen' }, buildBattle(), buildForge(), buildChat()));
    gameEvents.on(EVENTS.CHAT_UPDATED, () => syncChat());
    refresh();
}

export function onShow() {
    visible = true;
    refresh();
    dungeon?.start();
    dungeon?.setFast(fast);
    startEncounter(); // spawn a fresh fight: hero left, pack right
    if (autoForge) scheduleAutoForge();
}

export function onHide() {
    visible = false;
    dungeon?.stop();
    clearTimeout(autoForgeTimer);
    autoForgeTimer = null;
    clearTimeout(nextTimer);
    nextTimer = null;
}

export function refresh() {
    if (!root || !root.querySelector('.gear-grid')) return;
    updateGearGrid();
    const chip = root.querySelector('.forge-level-chip');
    if (chip) chip.textContent = `Forge Lv ${getForgeLevel()}`;
    syncForgeXp();
    // A live fight is never disturbed by a gear/gold change — the next encounter
    // picks up the new stats. So there's nothing battle-related to sync here.
}

// ── Battle zone ─────────────────────────────────────────────────────────────
function buildBattle() {
    const dungeonHost = h('div', { className: 'dungeon-host' });
    dungeon = createDungeon({ onResolve: (r) => onFightResolved(r) });
    dungeon.mount(dungeonHost);

    // The stage label floats over the top-left of the fight zone (kept small) so
    // the dungeon itself fills the full width edge-to-edge under the top bar.
    return h('div', { className: 'battle-zone' },
        dungeonHost,
        h('div', { className: 'stage-title', text: 'Hard 1-1' }),
    );
}

// Build the full matchup payload (player + pack combat stats) and sync the
// stage header. The dungeon owns positions/timing from here.
function encounterPayload(encounter) {
    const rank = encounter.rank;
    const p = getCombatStats();
    const tag = encounter.kind === 'bigboss' ? ' · 💀 BIG BOSS'
        : encounter.kind === 'boss' ? ' · ☠️ BOSS' : '';
    const titleEl = root.querySelector('.stage-title');
    if (titleEl) titleEl.textContent = stageInfo(rank).label + tag;

    return {
        player: {
            id: 'player',
            emoji: avatarEmoji(getAvatar()),
            label: `You · ${fmt(getPowerScore())}`,
            maxHP: p.maxHP, damage: p.damage,
            critChance: p.critChance, critMultiplier: p.critMultiplier,
            attackSpeed: p.attackSpeed, lifeSteal: p.lifeSteal, healthRegen: p.healthRegen,
            ranged: !!p.ranged,
        },
        enemies: encounter.enemies.map((e) => ({
            id: e.id, emoji: e.emoji, label: `${e.name} · ${fmt(e.power)}`,
            maxHP: e.maxHP, damage: e.damage,
            critChance: e.critChance, critMultiplier: e.critMultiplier,
            attackSpeed: e.attackSpeed, lifeSteal: e.lifeSteal, healthRegen: e.healthRegen,
            ranged: e.ranged, role: e.role,
        })),
    };
}

// Spawn a fresh fight for the current rank: hero on the left, pack on the right.
function startEncounter() {
    if (!dungeon || !visible) return;
    currentEncounter = makeEncounter(getArenaRank());
    dungeon.setMatchup(encounterPayload(currentEncounter));
}

// The dungeon finished a live fight — grant rewards, advance on a win, and queue
// the next encounter.
function onFightResolved({ win }) {
    const enc = currentEncounter;
    if (!enc) return;

    // Gold is scarce — only bosses pay out, so most fights grant nothing here.
    const reward = encounterReward(enc.rank, enc.kind, win);
    if (reward > 0) {
        const granted = grantGold(reward);
        dungeon.floater('player', `+${fmt(granted)}💰`, 'gold');
    }

    if (win) {
        setArenaRank(enc.rank + 1);
        const xp = grantPlayerXp(arenaXp(enc.rank));
        if (xp) dungeon.floater('player', `+${fmt(xp)} XP`, 'xp');
    } else {
        // On a loss, fall back one sub-stage so the player isn't stuck refighting
        // a deterministic fight they keep losing — but never drop a chapter: the
        // floor is sub-stage 1 of the current chapter (e.g. 3-5 → 3-4, 3-1 → 3-1).
        const fallback = arenaFallbackRank(enc.rank);
        if (fallback !== enc.rank) setArenaRank(fallback);
    }
    gameEvents.emit(EVENTS.ARENA_RESULT, { win, rank: enc.rank });

    clearTimeout(nextTimer);
    nextTimer = setTimeout(() => { if (visible) startEncounter(); }, win ? 650 : 900);
}

// ── Forge zone ──────────────────────────────────────────────────────────────
function buildForge() {
    const grid = h('div', { className: 'gear-grid' });
    EQUIPMENT_TYPES.forEach((type) => grid.appendChild(
        h('button', { className: 'gear-slot', dataset: { type }, onclick: () => showSlotDetail(type) })));

    return h('div', { className: 'forge-zone' },
        grid,
        h('div', { className: 'forge-bar' },
            h('button', { className: 'forge-level-chip', onclick: showForgeUpgrade, text: `Forge Lv ${getForgeLevel()}` }),
            h('button', { className: 'forge-btn-main', onclick: doForge },
                h('span', { className: 'forge-btn-anvil', text: '⚒️' }),
                h('span', { className: 'forge-btn-label', text: 'FORGE' }),
                h('div', { className: 'forge-floaters' }),
                // Forge-XP progress lives as a slim fill along the button's bottom
                // edge — forging levels the forge up for free.
                h('div', { className: 'forge-btn-xp' }, h('div', { className: 'forge-btn-xp-fill' })),
            ),
            h('button', { className: 'ctrl-btn auto-forge', onclick: showAutoForgeSettings },
                h('span', { className: 'ctrl-icon', text: '♻️' }), h('span', { text: 'Auto' })),
        ),
    );
}

// Sync the forge-XP fill baked into the FORGE button's bottom edge. At max level
// it simply reads full.
function syncForgeXp() {
    const fill = root?.querySelector('.forge-btn-xp-fill');
    if (!fill) return;
    const prog = getForgeLevelProgress();
    fill.style.width = prog.maxed ? '100%' : `${Math.round(prog.pct * 100)}%`;
    fill.classList.toggle('maxed', !!prog.maxed);
}

// Recent world chat, shown as a faint strip pinned at the bottom of the screen.
// Tapping it opens the full-width chat (General / Clan / Private tabs).
function buildChat() {
    const wrap = h('div', { className: 'home-chat', attrs: { role: 'button', tabindex: '0' }, onclick: () => openChat('general') });
    wrap.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openChat('general'); } });
    syncChat(wrap);
    return wrap;
}

function syncChat(wrap = root?.querySelector('.home-chat')) {
    if (!wrap) return;
    const msgs = getRecentMessages(3);
    clear(wrap);
    if (msgs.length === 0) {
        wrap.appendChild(h('div', { className: 'home-chat-line home-chat-hint' },
            h('span', { className: 'home-chat-text muted', text: '💬 Tap to open chat' })));
        return;
    }
    msgs.forEach((m) => wrap.appendChild(
        h('div', { className: 'home-chat-line' },
            h('span', { className: 'home-chat-sender', text: `${m.sender}: ` }),
            h('span', { className: 'home-chat-text', text: m.content }),
        )));
    wrap.appendChild(h('div', { className: 'home-chat-line home-chat-hint' },
        h('span', { className: 'home-chat-text muted', text: '💬 Tap to open chat' })));
}

function doForge() {
    if (forging) return;
    forging = true;
    const btn = root.querySelector('.forge-btn-main');
    btn.classList.add('forging');
    setTimeout(() => {
        btn.classList.remove('forging');
        forging = false;
        const { item, gold, rolls } = forge(getForgeBestOf());
        gameEvents.emit(EVENTS.ITEM_FORGED, item);
        if (gold > 0) {
            const granted = grantGold(gold);
            forgeFloater(`+${fmt(granted)}💰`, '#ffcf4d');
        }
        showReveal(item, rolls);
    }, 700);
}

function setAutoForge(on) {
    autoForge = on;
    autoForgePaused = false;
    root.querySelector('.auto-forge')?.classList.toggle('on', autoForge);
    if (autoForge) scheduleAutoForge();
    else { clearTimeout(autoForgeTimer); autoForgeTimer = null; }
}

function scheduleAutoForge() {
    clearTimeout(autoForgeTimer);
    if (autoForgePaused) return; // waiting on a player decision — don't roll over it
    // Clan forge-speed perk shortens the interval (capped so it never gets silly).
    const base = fast ? 900 : 1600;
    const delay = Math.max(400, Math.round(base / (1 + getForgeSpeedPct() / 100)));
    autoForgeTimer = setTimeout(() => {
        if (!visible || !autoForge || autoForgePaused) return;
        const { item, gold, rolls } = forge(getForgeBestOf());
        gameEvents.emit(EVENTS.ITEM_FORGED, item);
        if (gold > 0) {
            const granted = grantGold(gold);
            forgeFloater(`+${fmt(granted)}💰`, '#ffcf4d');
        }
        // Auto-forge never equips on its own: it only trashes clearly-unwanted
        // rolls and PRESENTS anything that could raise your power, so your power
        // can only ever change when you choose to equip.
        const { delta } = powerDelta(item);
        if (autoForgeAction(item, getEquippedItem(item.type), delta) === 'trash') {
            trashItem(item);
            forgeFloater('🗑️', '');
            scheduleAutoForge();
        } else {
            // Pause and hand the decision to the player; resume when they're done.
            autoForgePaused = true;
            forgeFloater(`❔ ${rarityName(item.tier)}`, rarityColor(item.tier));
            showReveal(item, rolls, { onResolved: () => {
                autoForgePaused = false;
                if (autoForge && visible) scheduleAutoForge();
            } });
        }
    }, delay);
}

// Clicking "Auto" opens the control panel: start/stop the loop, pick which
// slots to keep (auto-trash new rolls for them), and optionally auto-trash
// same/higher-rarity rolls that aren't a power gain.
function showAutoForgeSettings() {
    const settings = getAutoForgeSettings();

    const switchEl = (on, label, onToggle) => {
        const el = h('button', {
            className: `toggle-switch${on ? ' on' : ''}`,
            attrs: { type: 'button', role: 'switch', 'aria-checked': String(on), 'aria-label': label },
        }, h('span', { className: 'toggle-knob' }));
        el.addEventListener('click', () => {
            const next = !el.classList.contains('on');
            el.classList.toggle('on', next);
            el.setAttribute('aria-checked', String(next));
            onToggle(next);
        });
        return el;
    };

    const slotRow = (type) => {
        const equipped = getEquippedItem(type);
        return h('div', { className: 'auto-forge-slot-row' },
            h('span', {
                className: 'auto-slot-icon',
                text: equipped ? itemIcon(equipped) : slotIcon(type),
                style: equipped ? { '--rarity': rarityColor(equipped.tier) } : null,
            }),
            h('div', { className: 'auto-slot-meta' },
                h('span', { className: 'auto-slot-name', text: slotLabel(type) }),
                h('span', { className: 'auto-slot-sub muted', text: equipped ? `${rarityName(equipped.tier)} · Lv ${equipped.level}` : 'Empty' }),
            ),
            switchEl(isSlotKept(type), `Keep ${slotLabel(type)}`, (on) => setSlotKept(type, on)),
        );
    };

    const startBtn = h('button', {
        className: 'btn btn-primary btn-block',
        text: autoForge ? '⏸ Stop auto-forge' : '▶ Start auto-forge',
        onclick: () => { setAutoForge(!autoForge); closeModal(); toast(autoForge ? 'Auto-forge started' : 'Auto-forge stopped', 'info'); },
    });

    const body = h('div', { className: 'auto-forge-settings' },
        h('h3', { text: '♻️ Auto-Forge' }),
        h('p', { className: 'muted', text: 'Keeps forging for you. Lower-rarity rolls are trashed automatically — same-or-better gear is shown to you, so your power only changes when you choose to equip.' }),
        h('div', { className: 'auto-forge-filter-section' },
            h('div', { className: 'auto-section-label', text: 'Keep slots — auto-trash new rolls for these' }),
            h('div', { className: 'auto-slot-list' }, ...EQUIPMENT_TYPES.map(slotRow)),
        ),
        h('div', { className: 'auto-forge-filter-section auto-forge-toggle-row' },
            h('div', { className: 'auto-slot-meta' },
                h('span', { className: 'auto-slot-name', text: 'Auto-trash lower-power gear' }),
                h('span', { className: 'auto-slot-sub muted', text: "Also trash same/higher-rarity rolls that aren't a power gain" }),
            ),
            switchEl(settings.trashLowerPower, 'Auto-trash lower-power gear', (on) => setTrashLowerPower(on)),
        ),
        startBtn,
        h('button', { className: 'btn btn-ghost btn-block', text: 'Close', onclick: closeModal }),
    );
    openModal(body);
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
function showReveal(item, rolls = 1, { onResolved } = {}) {
    let resolved = false;
    const { delta } = powerDelta(item);
    const equipped = getEquippedItem(item.type);

    // Run the chosen action once, then notify the caller (used by auto-forge to
    // resume its loop) — whether the player equipped, trashed, or dismissed.
    const finish = (action) => {
        if (resolved) return;
        resolved = true;
        action();
        onResolved?.();
    };
    const trash = () => finish(() => { trashItem(item); closeModal(); toast(`Trashed ${itemName(item)}`, 'info'); });
    const equip = () => finish(() => { equipItem(item); closeModal(); toast(`Equipped ${itemName(item)}`, 'success'); });

    const body = h('div', { className: 'reveal', style: { '--rarity': rarityColor(item.tier) } },
        h('div', { className: 'reveal-flash', text: rarityName(item.tier) }),
        rolls > 1 ? h('div', { className: 'reveal-bestof muted', text: `🍀 Best of ${rolls} (clan perk)` }) : null,
        renderItemCard(item),
        h('div', { className: 'reveal-delta' }, renderDeltaBadge(delta)),
        equipped ? h('p', { className: 'reveal-replaces', text: `Replaces ${itemName(equipped)} (Lv ${equipped.level})` }) : null,
        h('div', { className: 'reveal-actions' },
            h('button', { className: 'btn btn-ghost', text: '🗑️ Trash', onclick: trash }),
            h('button', { className: 'btn btn-primary', text: delta >= 0 ? 'Equip ✓' : 'Equip anyway', onclick: equip }),
        ),
    );
    // Backdrop dismiss = trash (the modal is already closing, so don't re-close).
    openModal(body, { onClose: () => finish(() => { trashItem(item); toast(`Trashed ${itemName(item)}`, 'info'); }) });
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
            slot.appendChild(h('span', { className: 'gear-slot-icon', text: itemIcon(item) }));
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
                className: 'btn btn-danger', text: '🗑️ Trash',
                onclick: async () => {
                    const ok = await confirmDialog({ title: 'Trash equipped item?', message: `${itemName(item)} will be removed for good — gear can't be sold for gold.`, confirmText: 'Trash' });
                    if (ok) {
                        getEquipment()[type] = null;
                        trashItem(item);
                        closeModal();
                        toast(`Trashed ${itemName(item)}`, 'info');
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

    const prog = getForgeLevelProgress();
    const xpBar = prog.maxed
        ? null
        : h('div', { className: 'forge-xp' },
            h('div', { className: 'forge-xp-bar' },
                h('div', { className: 'forge-xp-fill', style: { width: `${Math.round(prog.pct * 100)}%` } })),
            h('div', { className: 'forge-xp-label muted', text: `Forge XP ${fmt(prog.xp)} / ${fmt(prog.need)} — keep forging to level up for free` }),
        );

    const body = h('div', { className: 'forge-upgrade' },
        h('h3', { text: '⚒️ Forge Upgrade' }),
        h('p', { className: 'muted', text: 'A higher forge level shifts the odds toward rarer gear. Forging fills the XP bar to level up for free, or pay gold to upgrade instantly.' }),
        xpBar,
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
