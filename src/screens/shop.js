// Shop screen — two tabs that together close the monetization loop:
//   • Gold:      buy the scarce currency with real money via Stripe Checkout.
//   • Cosmetics: spend that gold on premium avatars & profile frames.
// Packs and cosmetics buy gold and looks only — never gear or power — so the
// shop stays out of pay-to-win territory (see CLAUDE.md / REDESIGN.md).
import { h, clear, fmt, toast } from './components.js';
import { avatarEmoji } from '../game/config.js';
import {
    getGold, getAvatar, setAvatar, getFrame, setFrame, ownsCosmetic, purchaseCosmetic,
} from '../game/state.js';
import { fetchGoldPacks, startCheckout, fetchPurchaseHistory } from '../game/shop.js';
import { PREMIUM_AVATARS, FRAMES } from '../../shared/cosmetics.js';
import { gameEvents, EVENTS } from '../events.js';

let root = null;
let packs = [];
let history = [];
let loaded = false;
let loading = false;
let buying = false;
let tab = 'gold';

export const id = 'shop';
export const icon = '🛒';
export const label = 'Shop';

export function render(container) {
    root = container;
    rerender();
}

export function onShow() {
    rerender();
    if (!loaded) loadData();
    else refreshHistory();
}

export function refresh() {
    if (root && root.querySelector('.shop-screen')) rerender();
}

async function loadData() {
    if (loading) return;
    loading = true;
    rerender();
    [packs, history] = await Promise.all([fetchGoldPacks(), fetchPurchaseHistory()]);
    loaded = true;
    loading = false;
    rerender();
}

async function refreshHistory() {
    history = await fetchPurchaseHistory();
    rerender();
}

const TAG_LABEL = { popular: 'Most popular', 'best-value': 'Best value', 'one-time': 'One-time' };

function ownsOneTime(packId) {
    return history.some((p) => p.packId === packId && p.status === 'completed');
}

async function buy(pack) {
    if (buying) return;
    buying = true;
    rerender();
    try {
        await startCheckout(pack.id);
        // On success the browser navigates to Stripe — this line is not reached.
    } catch (err) {
        toast(err.message || 'Could not start checkout', 'error');
        buying = false;
        rerender();
    }
}

function rerender() {
    if (!root) return;
    clear(root);
    root.appendChild(h('div', { className: 'shop-screen' },
        h('div', { className: 'shop-head' },
            h('h2', { className: 'shop-title', text: '🛒 Shop' }),
            h('div', { className: 'shop-balance' }, h('span', { text: '💰' }), h('span', { text: fmt(getGold()) })),
        ),
        h('div', { className: 'shop-tabs' },
            tabBtn('gold', '💰 Gold'),
            tabBtn('cosmetics', '✨ Cosmetics'),
        ),
        tab === 'gold' ? buildGoldTab() : buildCosmeticsTab(),
    ));
}

function tabBtn(name, text) {
    return h('button', {
        className: `shop-tab${tab === name ? ' active' : ''}`,
        text,
        onclick: () => { if (tab !== name) { tab = name; rerender(); } },
    });
}

// ── Gold tab (Stripe) ───────────────────────────────────────────────────────
function buildGoldTab() {
    return h('div', {},
        h('p', { className: 'shop-blurb muted', text: 'Top up your gold to fast-track forge upgrades, found a clan, and unlock cosmetics. Gold never buys gear directly — no pay-to-win.' }),
        buildPacks(),
        buildHistory(),
    );
}

function buildPacks() {
    if (loading && !loaded) {
        return h('div', { className: 'shop-loading muted', text: 'Loading packs…' });
    }
    if (loaded && packs.length === 0) {
        return h('div', { className: 'shop-empty muted', text: 'The shop is unavailable right now. Check back soon!' });
    }
    return h('div', { className: 'shop-grid' }, ...packs.map(packCard));
}

function packCard(pack) {
    const total = pack.total ?? (pack.gold + pack.bonus);
    const owned = pack.oneTime && ownsOneTime(pack.id);
    const tagEl = pack.tag ? h('span', { className: `shop-tag shop-tag-${pack.tag}`, text: TAG_LABEL[pack.tag] || pack.tag }) : null;

    return h('div', { className: `shop-pack${pack.tag ? ' shop-pack-' + pack.tag : ''}` },
        tagEl,
        h('div', { className: 'shop-pack-icon', text: '💰' }),
        h('div', { className: 'shop-pack-label', text: pack.label }),
        h('div', { className: 'shop-pack-gold', text: `${fmt(total)} gold` }),
        pack.bonus > 0
            ? h('div', { className: 'shop-pack-bonus', text: `${fmt(pack.gold)} + ${fmt(pack.bonus)} bonus` })
            : h('div', { className: 'shop-pack-bonus muted', text: 'No bonus' }),
        h('button', {
            className: 'btn btn-primary shop-buy',
            text: owned ? 'Owned' : (buying ? '…' : formatPrice(pack.priceCents)),
            disabled: owned || buying ? 'disabled' : null,
            onclick: owned ? null : () => buy(pack),
        }),
    );
}

function buildHistory() {
    if (!history.length) return null;
    return h('div', { className: 'shop-section' },
        h('h3', { text: 'Purchase history' }),
        h('div', { className: 'shop-history' },
            ...history.slice(0, 10).map((p) => h('div', { className: 'shop-history-row' },
                h('span', { className: 'shop-history-pack', text: p.packId }),
                h('span', { className: 'shop-history-gold', text: `+${fmt(p.goldGranted)} gold` }),
                h('span', { className: `shop-history-status status-${p.status}`, text: p.status }),
                h('span', { className: 'shop-history-amount muted', text: formatPrice(p.amountCents) }),
            )),
        ),
    );
}

// ── Cosmetics tab (gold sink) ───────────────────────────────────────────────
function buildCosmeticsTab() {
    return h('div', {},
        h('p', { className: 'shop-blurb muted', text: 'Spend gold on looks, not power. Premium avatars and profile frames are purely cosmetic.' }),
        h('div', { className: 'shop-section' },
            h('h3', { text: 'Premium Avatars' }),
            h('div', { className: 'cos-grid' }, ...PREMIUM_AVATARS.map(avatarCard)),
        ),
        h('div', { className: 'shop-section' },
            h('h3', { text: 'Profile Frames' }),
            h('div', { className: 'cos-grid' }, ...FRAMES.map(frameCard)),
        ),
    );
}

function avatarCard(item) {
    const owned = ownsCosmetic(item.id);
    const equipped = owned && getAvatar() === item.id;
    return h('div', { className: `cos-card${equipped ? ' equipped' : ''}` },
        h('div', { className: 'cos-preview', text: item.emoji }),
        h('div', { className: 'cos-name', text: item.name }),
        cosmeticAction(item, owned, equipped, () => {
            setAvatar(item.id);
            if (getAvatar() === item.id) toast(`${item.name} equipped`, 'success');
            rerender();
        }),
    );
}

function frameCard(item) {
    const owned = ownsCosmetic(item.id);
    const equipped = owned && getFrame() === item.id;
    return h('div', { className: `cos-card${equipped ? ' equipped' : ''}` },
        h('div', { className: `cos-preview frame-${item.id}`, text: avatarEmoji(getAvatar()) }),
        h('div', { className: 'cos-name', text: item.name }),
        cosmeticAction(item, owned, equipped, () => {
            if (setFrame(item.id)) toast(`${item.name} equipped`, 'success');
            rerender();
        }),
    );
}

function cosmeticAction(item, owned, equipped, onEquip) {
    if (equipped) {
        return h('button', { className: 'btn shop-buy', text: 'Equipped', disabled: 'disabled' });
    }
    if (owned) {
        return h('button', { className: 'btn shop-buy cos-equip', text: 'Equip', onclick: onEquip });
    }
    const canAfford = getGold() >= item.price;
    return h('button', {
        className: 'btn btn-primary shop-buy',
        text: `💰 ${fmt(item.price)}`,
        disabled: canAfford ? null : 'disabled',
        onclick: canAfford ? () => purchase(item) : null,
    });
}

function purchase(item) {
    const res = purchaseCosmetic(item.id);
    if (!res.ok) {
        toast(res.error || 'Could not purchase', 'error');
        return;
    }
    toast(`Unlocked ${item.name}!`, 'success');
    // Auto-equip the freshly bought cosmetic so the purchase feels immediate.
    if (FRAMES.some((f) => f.id === item.id)) setFrame(item.id);
    else setAvatar(item.id);
    rerender();
}

function formatPrice(cents) {
    return `$${(Math.round(cents) / 100).toFixed(2)}`;
}

// Keep the header gold balance / button state fresh after a completed purchase.
gameEvents.on(EVENTS.GOLD_PURCHASED, () => { buying = false; refresh(); });

// Starting checkout navigates away to Stripe with `buying` left true (so the buy
// buttons read "…"). If the player cancels or taps Back, the browser often
// restores this screen from the back/forward cache (iOS Safari especially)
// without re-running the module — leaving every buy button stuck on "…" and
// disabled. Clear the flag whenever the page is shown again so the buttons
// become clickable. (A normal full reload already resets module state, so this
// is a no-op there.)
if (typeof window !== 'undefined') {
    window.addEventListener('pageshow', () => {
        if (buying) { buying = false; refresh(); }
    });
}
