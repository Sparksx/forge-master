// Forge screen — the core loop: forge → reveal → equip/sell, plus forge upgrades.
import { h, clear, fmt, toast, openModal, closeModal, confirmDialog } from './components.js';
import { renderItemCard, renderDeltaBadge, powerDelta } from './item-view.js';
import { EQUIPMENT_TYPES, MAX_FORGE_LEVEL, TIERS } from '../game/config.js';
import { slotIcon, slotLabel, rarityColor, rarityName, itemName } from '../game/items.js';
import {
    getEquipment, getEquippedItem, getForgeLevel, getForgeUpgradeCost, getForgeChances,
    upgradeForge, equipItem, sellItem, getSellValue, getGold,
} from '../game/state.js';
import { forge } from '../game/forge.js';
import { gameEvents, EVENTS } from '../events.js';

let root = null;
let forging = false;

export const id = 'forge';
export const icon = '🔨';
export const label = 'Forge';

export function render(container) {
    root = container;
    clear(root);
    root.appendChild(h('div', { className: 'forge-screen' },
        buildAnvil(),
        buildGearGrid(),
    ));
    refresh();
}

export function refresh() {
    if (!root || !root.querySelector('.gear-grid')) return;
    updateGearGrid();
    const chip = root.querySelector('.forge-level-chip');
    if (chip) chip.textContent = `Forge Lv ${getForgeLevel()}`;
}

// ── Anvil + forge button ────────────────────────────────────────────────────
function buildAnvil() {
    const btn = h('button', { className: 'forge-btn', onclick: doForge },
        h('span', { className: 'forge-btn-anvil', text: '⚒️' }),
        h('span', { className: 'forge-btn-label', text: 'FORGE' }),
    );
    return h('div', { className: 'anvil-zone' },
        h('button', { className: 'forge-level-chip', onclick: showForgeUpgrade, text: `Forge Lv ${getForgeLevel()}` }),
        btn,
        h('p', { className: 'anvil-hint', text: 'Tap the anvil to forge a random item' }),
    );
}

function doForge() {
    if (forging) return;
    forging = true;
    const btn = root.querySelector('.forge-btn');
    btn.classList.add('forging');
    setTimeout(() => {
        btn.classList.remove('forging');
        forging = false;
        const item = forge();
        gameEvents.emit(EVENTS.ITEM_FORGED, item);
        showReveal(item);
    }, 850);
}

// ── Reveal modal ────────────────────────────────────────────────────────────
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

// ── Forge upgrade modal ─────────────────────────────────────────────────────
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

// ── Equipped gear grid ──────────────────────────────────────────────────────
function buildGearGrid() {
    const grid = h('div', { className: 'gear-grid' });
    EQUIPMENT_TYPES.forEach((type) => grid.appendChild(buildSlot(type)));
    return h('div', { className: 'gear-section' },
        h('div', { className: 'gear-header' }, h('span', { text: 'Equipped' })),
        grid,
    );
}

function buildSlot(type) {
    return h('button', { className: 'gear-slot', dataset: { type }, onclick: () => showSlotDetail(type) });
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
            slot.appendChild(h('span', { className: 'gear-slot-lvl', text: `${item.level}` }));
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
                        // Unequip first so the save reflects the now-empty slot, then sell.
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
