import { addGold, addEssence, getCombatProgress, getShopState, setShopState, getDiamonds, spendDiamonds, loadGameFromServer, getForgeLevel, addSkillShards } from './state.js';
import { gameEvents, EVENTS } from './events.js';
import { DIAMOND_SHOP_OFFERS, DIAMOND_PACKS } from './config.js';
import { apiFetch, getAccessToken } from './api.js';

// Daily login reward tiers — players can claim once per day
const DAILY_REWARD_BASE = 50;
const DAILY_REWARD_STREAK_BONUS = 25; // extra gold per consecutive day

// Milestone rewards based on dungeon progress
const MILESTONE_REWARDS = [
    { id: 'wave2',  label: 'Clear Wave 2',  wave: 2,  subWave: 1, gold: 200 },
    { id: 'wave4',  label: 'Clear Wave 4',  wave: 4,  subWave: 1, gold: 500 },
    { id: 'wave6',  label: 'Clear Wave 6',  wave: 6,  subWave: 1, gold: 1000 },
    { id: 'wave8',  label: 'Clear Wave 8',  wave: 8,  subWave: 1, gold: 2500 },
    { id: 'wave10', label: 'Clear Wave 10', wave: 10, subWave: 1, gold: 5000 },
    // Extended waves (require Wave Breaker tech)
    { id: 'wave12', label: 'Clear Wave 12', wave: 12, subWave: 1, gold: 10000,  essence: 500,   shards: 0 },
    { id: 'wave14', label: 'Clear Wave 14', wave: 14, subWave: 1, gold: 25000,  essence: 1000,  shards: 50 },
    { id: 'wave16', label: 'Clear Wave 16', wave: 16, subWave: 1, gold: 50000,  essence: 2500,  shards: 100 },
    { id: 'wave18', label: 'Clear Wave 18', wave: 18, subWave: 1, gold: 100000, essence: 5000,  shards: 150 },
    { id: 'wave20', label: 'Clear Wave 20', wave: 20, subWave: 1, gold: 250000, essence: 10000, shards: 250 },
];

function getToday() {
    return new Date().toISOString().slice(0, 10);
}

function canClaimDaily() {
    return getShopState().dailyLastClaimed !== getToday();
}

function getDailyAmount() {
    const forgeLevelBonus = getForgeLevel() * 50;
    return DAILY_REWARD_BASE + forgeLevelBonus + getShopState().dailyStreak * DAILY_REWARD_STREAK_BONUS;
}

function getDailyEssence() {
    return getForgeLevel() * 3;
}

function claimDaily() {
    if (!canClaimDaily()) return 0;
    const today = getToday();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const shop = getShopState();
    const newStreak = (shop.dailyLastClaimed === yesterday) ? shop.dailyStreak + 1 : 0;
    setShopState({ dailyLastClaimed: today, dailyStreak: newStreak });
    const amount = getDailyAmount();
    addGold(amount);
    const essenceAmount = getDailyEssence();
    if (essenceAmount > 0) addEssence(essenceAmount);
    gameEvents.emit(EVENTS.GOLD_PURCHASED, { type: 'daily', gold: amount });
    return amount;
}

function claimMilestone(id) {
    const shop = getShopState();
    if (shop.claimedMilestones.includes(id)) return 0;
    const m = MILESTONE_REWARDS.find(r => r.id === id);
    if (!m) return 0;
    const progress = getCombatProgress();
    const reached = progress.highestWave > m.wave ||
        (progress.highestWave === m.wave && (progress.highestSubWave || 1) >= m.subWave);
    if (!reached) return 0;
    setShopState({ claimedMilestones: [...shop.claimedMilestones, id] });
    addGold(m.gold);
    if (m.essence) addEssence(m.essence);
    if (m.shards) addSkillShards(m.shards);
    gameEvents.emit(EVENTS.GOLD_PURCHASED, { type: 'milestone', gold: m.gold });
    return m.gold;
}

// --- Diamond shop: buy gold/essence with diamonds ---

export function buyDiamondOffer(offerId) {
    const offer = DIAMOND_SHOP_OFFERS.find(o => o.id === offerId);
    if (!offer) return false;
    if (getDiamonds() < offer.cost) return false;

    if (!spendDiamonds(offer.cost)) return false;

    if (offer.type === 'gold') {
        addGold(offer.amount);
    } else if (offer.type === 'essence') {
        addEssence(offer.amount);
    }
    return true;
}

// --- Real-money diamond purchase via Stripe ---

let purchaseInProgress = false;

async function buyDiamondPack(packId) {
    if (purchaseInProgress) return;
    if (!getAccessToken()) return;

    purchaseInProgress = true;
    try {
        const res = await apiFetch('/api/payment/create-checkout-session', {
            method: 'POST',
            body: { packId },
        });

        if (!res.ok) {
            const data = await res.json();
            alert(data.error || 'Purchase failed');
            return;
        }

        const { url } = await res.json();
        // Redirect to Stripe Checkout
        window.location.href = url;
    } catch (err) {
        console.error('Purchase error:', err);
        alert('Unable to start purchase. Please try again.');
    } finally {
        purchaseInProgress = false;
    }
}

function createElement(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
}

function formatPrice(cents) {
    return `$${(cents / 100).toFixed(2)}`;
}

function renderShop() {
    const container = document.getElementById('shop-offers');
    if (!container) return;
    container.textContent = '';

    const progress = getCombatProgress();
    const shop = getShopState();
    const isLoggedIn = !!getAccessToken();

    // --- Buy Diamonds Section (real money) ---
    if (isLoggedIn) {
        const buyTitle = createElement('div', 'shop-section-title', '\uD83D\uDC8E Buy Diamonds');
        container.appendChild(buyTitle);

        DIAMOND_PACKS.forEach(pack => {
            const card = createElement('div', 'shop-card shop-card-buy');
            card.dataset.action = 'buy-pack';
            card.dataset.pack = pack.id;

            const totalDiamonds = pack.diamonds + pack.bonus;
            const bonusText = pack.bonus > 0 ? ` +${pack.bonus} bonus` : '';

            const btn = createElement('button', 'shop-card-btn shop-card-btn-buy', formatPrice(pack.priceCents));

            const nameEl = createElement('div', 'shop-card-name', pack.label);
            const amountEl = createElement('div', 'shop-card-diamonds', `\uD83D\uDC8E ${totalDiamonds}`);

            card.append(
                createElement('div', 'shop-card-icon', '\uD83D\uDC8E'),
                nameEl,
                amountEl
            );

            if (pack.bonus > 0) {
                card.appendChild(createElement('div', 'shop-card-bonus', `+${pack.bonus} bonus`));
            }

            if (pack.oneTime) {
                card.appendChild(createElement('div', 'shop-card-tag', 'One-time'));
            }

            card.appendChild(btn);
            container.appendChild(card);
        });
    }

    // Daily reward card
    const rewardsTitle = createElement('div', 'shop-section-title', '\uD83C\uDF81 Free Rewards');
    container.appendChild(rewardsTitle);

    const dailyCard = createElement('div', 'shop-card');
    dailyCard.dataset.action = 'daily';
    const dailyAvailable = canClaimDaily();
    const dailyBtn = createElement('button', 'shop-card-btn', dailyAvailable ? 'Claim!' : 'Claimed');
    dailyBtn.disabled = !dailyAvailable;
    const dailyEssence = getDailyEssence();
    dailyCard.append(
        createElement('div', 'shop-card-icon', '\uD83C\uDF81'),
        createElement('div', 'shop-card-name', 'Daily Reward'),
        createElement('div', 'shop-card-gold', `\uD83D\uDCB0 ${getDailyAmount()}`),
    );
    if (dailyEssence > 0) {
        dailyCard.appendChild(createElement('div', 'shop-card-essence', `\uD83D\uDD2E ${dailyEssence}`));
    }
    if (shop.dailyStreak > 0) {
        dailyCard.appendChild(createElement('div', 'shop-card-streak', `\uD83D\uDD25 ${shop.dailyStreak} day streak`));
    }
    dailyCard.appendChild(dailyBtn);
    container.appendChild(dailyCard);

    // --- Diamond Shop Section (spend diamonds) ---
    const diamondTitle = createElement('div', 'shop-section-title', '\uD83D\uDC8E Diamond Shop');
    container.appendChild(diamondTitle);

    const diamonds = getDiamonds();

    DIAMOND_SHOP_OFFERS.forEach(offer => {
        const card = createElement('div', 'shop-card shop-card-diamond');
        card.dataset.action = 'diamond';
        card.dataset.offer = offer.id;

        const icon = offer.type === 'gold' ? '\uD83D\uDCB0' : '\uD83D\uDD2E';
        const resourceLabel = offer.type === 'gold' ? 'Gold' : 'Essence';
        const canAfford = diamonds >= offer.cost;

        const btn = createElement('button', 'shop-card-btn', canAfford ? 'Buy' : 'Not enough \uD83D\uDC8E');
        btn.disabled = !canAfford;

        card.append(
            createElement('div', 'shop-card-icon', icon),
            createElement('div', 'shop-card-name', `${offer.amount.toLocaleString('en-US')} ${resourceLabel}`),
            createElement('div', 'shop-card-cost', `\uD83D\uDC8E ${offer.cost}`),
            btn
        );
        container.appendChild(card);
    });
}

function showPurchaseFeedback(card) {
    card.classList.add('purchased');
    setTimeout(() => card.classList.remove('purchased'), 600);
}

// Handle payment return from Stripe Checkout
function handlePaymentReturn() {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');

    if (!paymentStatus) return;

    // Clean URL without reloading
    const cleanUrl = window.location.pathname;
    window.history.replaceState({}, '', cleanUrl);

    if (paymentStatus === 'success') {
        // Reload game state from server to pick up the new diamonds
        if (getAccessToken()) {
            loadGameFromServer().then(() => {
                renderShop();
            });
        }
    }
}

export function renderMilestones() {
    const container = document.getElementById('achievements-list');
    if (!container) return;
    container.textContent = '';

    // Close button
    const closeBtn = createElement('button', 'modal-close-btn', '\u2715');
    closeBtn.addEventListener('click', () => {
        document.getElementById('achievements-modal').classList.remove('active');
    });
    container.appendChild(closeBtn);

    const progress = getCombatProgress();
    const shop = getShopState();

    MILESTONE_REWARDS.forEach(m => {
        const card = createElement('div', 'shop-card');
        card.dataset.action = 'milestone';
        card.dataset.milestone = m.id;

        const reached = progress.highestWave > m.wave ||
            (progress.highestWave === m.wave && (progress.highestSubWave || 1) >= m.subWave);
        const claimed = shop.claimedMilestones.includes(m.id);

        const btn = createElement('button', 'shop-card-btn');
        if (claimed) {
            btn.textContent = 'Claimed';
            btn.disabled = true;
        } else if (reached) {
            btn.textContent = 'Claim!';
        } else {
            btn.textContent = 'Locked';
            btn.disabled = true;
            card.classList.add('shop-card-locked');
        }

        card.append(
            createElement('div', 'shop-card-icon', '\uD83C\uDFC6'),
            createElement('div', 'shop-card-name', m.label),
            createElement('div', 'shop-card-gold', `\uD83D\uDCB0 ${m.gold.toLocaleString('en-US')}`),
        );
        if (m.essence) {
            card.appendChild(createElement('div', 'shop-card-essence', `\uD83D\uDD2E ${m.essence.toLocaleString('en-US')}`));
        }
        if (m.shards) {
            card.appendChild(createElement('div', 'shop-card-shards', `\u2728 ${m.shards} shards`));
        }
        card.appendChild(btn);
        container.appendChild(card);
    });
}

export function initMilestones() {
    const container = document.getElementById('achievements-list');
    if (!container) return;

    renderMilestones();

    container.addEventListener('click', (e) => {
        const card = e.target.closest('.shop-card');
        if (!card) return;
        const btn = card.querySelector('.shop-card-btn');
        if (!btn || btn.disabled) return;

        if (card.dataset.action === 'milestone') {
            const success = claimMilestone(card.dataset.milestone) > 0;
            if (success) {
                card.classList.add('purchased');
                setTimeout(() => card.classList.remove('purchased'), 600);
                renderMilestones();
            }
        }
    });

    gameEvents.on(EVENTS.COMBAT_WAVE_CHANGED, renderMilestones);
}

export function initShop() {
    // Check for Stripe return params
    handlePaymentReturn();

    renderShop();

    const container = document.getElementById('shop-offers');
    if (!container) return;

    container.addEventListener('click', (e) => {
        const card = e.target.closest('.shop-card');
        if (!card) return;
        const btn = card.querySelector('.shop-card-btn');
        if (!btn || btn.disabled) return;

        if (card.dataset.action === 'buy-pack') {
            buyDiamondPack(card.dataset.pack);
            return;
        }

        let success = false;
        if (card.dataset.action === 'daily') {
            success = claimDaily() > 0;
        } else if (card.dataset.action === 'diamond') {
            success = buyDiamondOffer(card.dataset.offer);
        }
        if (success) {
            showPurchaseFeedback(card);
            renderShop();
        }
    });

    // Re-render when diamonds change (update affordability)
    gameEvents.on(EVENTS.DIAMONDS_CHANGED, renderShop);
}
