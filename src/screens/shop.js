// Shop screen — buy gold packs via Stripe Checkout.
//
// Gold is the game's single currency and deliberately scarce; the shop is the
// sanctioned way to acquire it in bulk. Packs buy gold only — never gear — so
// the shop stays out of pay-to-win territory (see CLAUDE.md / REDESIGN.md).
import { h, clear, fmt, toast } from './components.js';
import { getGold } from '../game/state.js';
import { fetchGoldPacks, startCheckout, fetchPurchaseHistory } from '../game/shop.js';
import { gameEvents, EVENTS } from '../events.js';

let root = null;
let packs = [];
let history = [];
let loaded = false;
let loading = false;
let buying = false;

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
            h('h2', { className: 'shop-title', text: '🛒 Gold Shop' }),
            h('div', { className: 'shop-balance' }, h('span', { text: '💰' }), h('span', { text: fmt(getGold()) })),
        ),
        h('p', { className: 'shop-blurb muted', text: 'Top up your gold to fast-track forge upgrades and found a clan. Gold never buys gear directly — no pay-to-win.' }),
        buildPacks(),
        buildHistory(),
    ));
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
    const tag = pack.tag ? h('span', { className: `shop-tag shop-tag-${pack.tag}`, text: TAG_LABEL[pack.tag] || pack.tag }) : null;

    return h('div', { className: `shop-pack${pack.tag ? ' shop-pack-' + pack.tag : ''}` },
        tag,
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

function formatPrice(cents) {
    return `$${(Math.round(cents) / 100).toFixed(2)}`;
}

// Keep the header gold balance / button state fresh after a completed purchase.
gameEvents.on(EVENTS.GOLD_PURCHASED, () => { buying = false; refresh(); });
