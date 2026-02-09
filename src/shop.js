import { addGold, getCombatProgress } from './state.js';
import { gameEvents, EVENTS } from './events.js';

// Daily login reward tiers — players can claim once per day
const DAILY_REWARD_BASE = 50;
const DAILY_REWARD_STREAK_BONUS = 25; // extra gold per consecutive day

// Milestone gold rewards based on dungeon progress
const MILESTONE_REWARDS = [
    { id: 'wave2',  label: 'Clear Wave 2',  wave: 2,  subWave: 1, gold: 200 },
    { id: 'wave4',  label: 'Clear Wave 4',  wave: 4,  subWave: 1, gold: 500 },
    { id: 'wave6',  label: 'Clear Wave 6',  wave: 6,  subWave: 1, gold: 1000 },
    { id: 'wave8',  label: 'Clear Wave 8',  wave: 8,  subWave: 1, gold: 2500 },
    { id: 'wave10', label: 'Clear Wave 10', wave: 10, subWave: 1, gold: 5000 },
];

let dailyState = { lastClaimed: null, streak: 0 };
let claimedMilestones = new Set();

function loadShopState() {
    try {
        const daily = localStorage.getItem('forgemaster_daily');
        if (daily) dailyState = { ...dailyState, ...JSON.parse(daily) };
    } catch { /* ignore */ }
    try {
        const ms = localStorage.getItem('forgemaster_milestones');
        if (ms) claimedMilestones = new Set(JSON.parse(ms));
    } catch { /* ignore */ }
}

function saveDailyState() {
    try { localStorage.setItem('forgemaster_daily', JSON.stringify(dailyState)); } catch { /* ignore */ }
}

function saveMilestones() {
    try { localStorage.setItem('forgemaster_milestones', JSON.stringify([...claimedMilestones])); } catch { /* ignore */ }
}

function getToday() {
    return new Date().toISOString().slice(0, 10);
}

function canClaimDaily() {
    return dailyState.lastClaimed !== getToday();
}

function getDailyAmount() {
    return DAILY_REWARD_BASE + dailyState.streak * DAILY_REWARD_STREAK_BONUS;
}

function claimDaily() {
    if (!canClaimDaily()) return 0;
    const today = getToday();
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    dailyState.streak = (dailyState.lastClaimed === yesterday) ? dailyState.streak + 1 : 0;
    dailyState.lastClaimed = today;
    const amount = getDailyAmount();
    addGold(amount);
    saveDailyState();
    gameEvents.emit(EVENTS.GOLD_PURCHASED, { type: 'daily', gold: amount });
    return amount;
}

function claimMilestone(id) {
    if (claimedMilestones.has(id)) return 0;
    const m = MILESTONE_REWARDS.find(r => r.id === id);
    if (!m) return 0;
    const progress = getCombatProgress();
    const reached = progress.highestWave > m.wave ||
        (progress.highestWave === m.wave && (progress.highestSubWave || 1) >= m.subWave);
    if (!reached) return 0;
    claimedMilestones.add(id);
    addGold(m.gold);
    saveMilestones();
    gameEvents.emit(EVENTS.GOLD_PURCHASED, { type: 'milestone', gold: m.gold });
    return m.gold;
}

function createElement(tag, className, text) {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text !== undefined) el.textContent = text;
    return el;
}

function renderShop() {
    const container = document.getElementById('shop-offers');
    if (!container) return;
    container.textContent = '';

    const progress = getCombatProgress();

    // Daily reward card
    const dailyCard = createElement('div', 'shop-card');
    dailyCard.dataset.action = 'daily';
    const dailyAvailable = canClaimDaily();
    const dailyBtn = createElement('button', 'shop-card-btn', dailyAvailable ? 'Claim!' : 'Claimed');
    dailyBtn.disabled = !dailyAvailable;
    if (dailyState.streak > 0) {
        dailyCard.append(
            createElement('div', 'shop-card-icon', '🎁'),
            createElement('div', 'shop-card-name', 'Daily Reward'),
            createElement('div', 'shop-card-gold', `💰 ${getDailyAmount()}`),
            createElement('div', 'shop-card-streak', `🔥 ${dailyState.streak} day streak`),
            dailyBtn
        );
    } else {
        dailyCard.append(
            createElement('div', 'shop-card-icon', '🎁'),
            createElement('div', 'shop-card-name', 'Daily Reward'),
            createElement('div', 'shop-card-gold', `💰 ${getDailyAmount()}`),
            dailyBtn
        );
    }
    container.appendChild(dailyCard);

    // Milestone cards
    MILESTONE_REWARDS.forEach(m => {
        const card = createElement('div', 'shop-card');
        card.dataset.action = 'milestone';
        card.dataset.milestone = m.id;

        const reached = progress.highestWave > m.wave ||
            (progress.highestWave === m.wave && (progress.highestSubWave || 1) >= m.subWave);
        const claimed = claimedMilestones.has(m.id);

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
            createElement('div', 'shop-card-icon', '🏆'),
            createElement('div', 'shop-card-name', m.label),
            createElement('div', 'shop-card-gold', `💰 ${m.gold.toLocaleString('en-US')}`),
            btn
        );
        container.appendChild(card);
    });
}

function showPurchaseFeedback(card) {
    card.classList.add('purchased');
    setTimeout(() => card.classList.remove('purchased'), 600);
}

export function initShop() {
    loadShopState();
    renderShop();

    const container = document.getElementById('shop-offers');
    if (!container) return;

    container.addEventListener('click', (e) => {
        const card = e.target.closest('.shop-card');
        if (!card) return;
        const btn = card.querySelector('.shop-card-btn');
        if (!btn || btn.disabled) return;

        let earned = 0;
        if (card.dataset.action === 'daily') {
            earned = claimDaily();
        } else if (card.dataset.action === 'milestone') {
            earned = claimMilestone(card.dataset.milestone);
        }
        if (earned > 0) {
            showPurchaseFeedback(card);
            renderShop();
        }
    });

    // Re-render shop when combat progress changes (milestone may become claimable)
    gameEvents.on(EVENTS.COMBAT_WAVE_CHANGED, renderShop);
}
