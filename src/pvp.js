/**
 * PvP UI — lobby with player card & leaderboard, matchmaking queue,
 * real-time combat, and power-weighted results.
 */

import { t } from './i18n/i18n.js';
import { gameEvents, EVENTS } from './events.js';
import { getSocket } from './socket-client.js';
import { getCurrentUser } from './auth.js';
import { shareCombatInChat } from './chat.js';
import { calculateStats, calculatePowerScore } from './forge.js';
import { getEquipment } from './state.js';
import { PVP_BASE_POWER_RANGE, PVP_POWER_RANGE_EXPANSION, PVP_RANGE_INTERVAL } from '../shared/pvp-config.js';

let pvpState = 'idle'; // idle | queued | matched | fighting | ended
let myPower = 0;

function getEloRank(rating) {
    if (rating >= 2000) return { name: 'Master', icon: '\uD83D\uDC51' };
    if (rating >= 1700) return { name: 'Diamond', icon: '\uD83D\uDC8E' };
    if (rating >= 1400) return { name: 'Platinum', icon: '\u2B50' };
    if (rating >= 1200) return { name: 'Gold', icon: '\uD83E\uDD47' };
    if (rating >= 1000) return { name: 'Silver', icon: '\uD83E\uDD48' };
    return { name: 'Bronze', icon: '\uD83E\uDD49' };
}

export function initPvp() {
    const queueBtn = document.getElementById('pvp-queue-btn');
    const cancelBtn = document.getElementById('pvp-cancel-btn');
    const actionBtns = document.querySelectorAll('.pvp-action-btn');
    const backBtn = document.getElementById('pvp-back-btn');

    queueBtn?.addEventListener('click', joinQueue);
    cancelBtn?.addEventListener('click', cancelQueue);
    backBtn?.addEventListener('click', resetPvpUI);

    actionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const action = btn.dataset.action;
            if (action) sendAction(action);
        });
    });

    setupSocketListeners();
    refreshPlayerCard();
    gameEvents.on(EVENTS.LOCALE_CHANGED, refreshPlayerCard);
}

function setupSocketListeners() {
    const socket = getSocket();
    if (!socket) return;

    socket.on('pvp:queued', (data) => {
        pvpState = 'queued';
        if (data && data.power) myPower = data.power;
        showSection('pvp-queue-section');
        startQueuePowerRange();
    });

    socket.on('pvp:cancelled', () => {
        pvpState = 'idle';
        showSection('pvp-idle-section');
        stopQueuePowerRange();
    });

    socket.on('pvp:matched', (data) => {
        pvpState = 'matched';
        stopQueuePowerRange();
        showSection('pvp-fight-section');
        updateMatchInfo(data);
    });

    socket.on('pvp:turn', (data) => {
        pvpState = 'fighting';
        enableActions();
        startTurnTimer(data.timeLimit);
    });

    socket.on('pvp:turn-result', (data) => {
        updateCombatUI(data);
    });

    socket.on('pvp:end', (data) => {
        pvpState = 'ended';
        showResult(data);
    });

    socket.on('pvp:error', (data) => {
        const errorEl = document.getElementById('pvp-error');
        if (errorEl) errorEl.textContent = data.message || t('pvp.error');
    });

    socket.on('pvp:leaderboard', (data) => {
        renderLeaderboard(data);
    });
}

function joinQueue() {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('pvp:queue');
}

function cancelQueue() {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('pvp:cancel');
}

function sendAction(type) {
    const socket = getSocket();
    if (!socket) return;
    socket.emit('pvp:action', { type });
    disableActions();
}

function showSection(id) {
    const sections = ['pvp-idle-section', 'pvp-queue-section', 'pvp-fight-section', 'pvp-result-section'];
    sections.forEach(s => {
        const el = document.getElementById(s);
        if (el) el.classList.toggle('hidden', s !== id);
    });
}

// --- Player Card ---

export function refreshPlayerCard() {
    const user = getCurrentUser();
    if (!user) return;

    const equipment = getEquipment();
    const { totalHealth, totalDamage, bonuses } = calculateStats(equipment);
    const power = calculatePowerScore(totalHealth, totalDamage, bonuses);
    myPower = power;

    const rating = user.pvpRating || 1000;
    const rank = getEloRank(rating);

    const rankIcon = document.getElementById('pvp-rank-icon');
    const rankName = document.getElementById('pvp-rank-name');
    const eloEl = document.getElementById('pvp-my-elo');
    const powerEl = document.getElementById('pvp-my-power');
    const recordEl = document.getElementById('pvp-my-record');

    if (rankIcon) rankIcon.textContent = rank.icon;
    if (rankName) rankName.textContent = rank.name;
    if (eloEl) eloEl.textContent = rating.toLocaleString();
    if (powerEl) powerEl.textContent = power.toLocaleString();
    if (recordEl) recordEl.textContent = `${user.pvpWins || 0} / ${user.pvpLosses || 0}`;

    // Also request leaderboard
    const socket = getSocket();
    if (socket) socket.emit('pvp:leaderboard');
}

// --- Leaderboard ---

function renderLeaderboard(players) {
    const list = document.getElementById('pvp-leaderboard-list');
    if (!list) return;

    if (!players || players.length === 0) {
        list.innerHTML = `<div class="pvp-leaderboard-empty">${t('pvp.noRankedPlayers')}</div>`;
        return;
    }

    const user = getCurrentUser();
    list.innerHTML = players.map((p, i) => {
        const rank = getEloRank(p.rating);
        const isMe = user && p.id === user.id;
        return `<div class="pvp-lb-row${isMe ? ' pvp-lb-me' : ''}">
            <span class="pvp-lb-pos">#${i + 1}</span>
            <span class="pvp-lb-name">${rank.icon} ${escapeHtml(p.username)}</span>
            <span class="pvp-lb-elo">${p.rating || 0}</span>
            <span class="pvp-lb-power">${(p.power || 0).toLocaleString()}</span>
            <span class="pvp-lb-record">${p.wins || 0}W ${p.losses || 0}L</span>
        </div>`;
    }).join('');
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// --- Queue power range display ---

let queueRangeInterval = null;
let queueStartTime = 0;

function startQueuePowerRange() {
    queueStartTime = Date.now();
    updateQueuePowerRange();
    queueRangeInterval = setInterval(updateQueuePowerRange, 1000);
}

function stopQueuePowerRange() {
    if (queueRangeInterval) {
        clearInterval(queueRangeInterval);
        queueRangeInterval = null;
    }
}

function updateQueuePowerRange() {
    const el = document.getElementById('pvp-queue-power-range');
    if (!el || !myPower) return;

    const elapsed = Date.now() - queueStartTime;
    const expansions = Math.floor(elapsed / PVP_RANGE_INTERVAL);
    const rangePct = PVP_BASE_POWER_RANGE + expansions * PVP_POWER_RANGE_EXPANSION;
    const low = Math.round(myPower * (1 - rangePct));
    const high = Math.round(myPower * (1 + rangePct));

    el.textContent = t('pvp.powerRange', { low: Math.max(0, low).toLocaleString(), high: high.toLocaleString() }) + (expansions > 0 ? ` ${t('pvp.expanding')}` : '');
}

// --- Match Info ---

function updateMatchInfo(data) {
    const opponentName = document.getElementById('pvp-opponent-name');
    const opponentRating = document.getElementById('pvp-opponent-rating');
    const opponentPower = document.getElementById('pvp-opponent-power');
    if (opponentName) opponentName.textContent = data.opponent.username;
    if (opponentRating) opponentRating.textContent = `${getEloRank(data.opponent.rating).icon} ${data.opponent.rating}`;
    if (opponentPower) opponentPower.textContent = `Power: ${data.opponent.power.toLocaleString()}`;

    // Init HP bars
    updateHP('pvp-your-hp', data.opponent.maxHP, data.opponent.maxHP, 'pvp-your-hp-text');
    updateHP('pvp-opponent-hp', data.opponent.maxHP, data.opponent.maxHP, 'pvp-opponent-hp-text');
}

function updateCombatUI(data) {
    updateHP('pvp-your-hp', data.you.currentHP, data.you.maxHP, 'pvp-your-hp-text');
    updateHP('pvp-opponent-hp', data.opponent.currentHP, data.opponent.maxHP, 'pvp-opponent-hp-text');

    // Show turn log (keep only last 20 entries to avoid DOM bloat)
    const log = document.getElementById('pvp-combat-log');
    if (log) {
        const line = document.createElement('div');
        line.className = 'pvp-log-entry';
        const yourAction = data.you.action;
        const theirAction = data.opponent.action;
        line.textContent = t('pvp.turnLog', { turn: data.turn, yourAction, oppDmg: data.opponent.damage, oppAction: theirAction, yourDmg: data.you.damage });
        log.appendChild(line);
        while (log.children.length > 20) {
            log.firstChild.remove();
        }
        log.scrollTop = log.scrollHeight;
    }
}

function updateHP(barId, current, max, textId) {
    const bar = document.getElementById(barId);
    const text = document.getElementById(textId);
    if (bar) bar.style.width = `${Math.max(0, (current / max) * 100)}%`;
    if (text) text.textContent = `${Math.max(0, Math.floor(current))} / ${max}`;
}

let turnTimerInterval = null;

function startTurnTimer(timeLimit) {
    if (turnTimerInterval) clearInterval(turnTimerInterval);
    const timerEl = document.getElementById('pvp-turn-timer');
    if (!timerEl) return;

    let remaining = timeLimit / 1000;
    timerEl.textContent = `${Math.ceil(remaining)}s`;

    turnTimerInterval = setInterval(() => {
        remaining -= 0.1;
        if (remaining <= 0) {
            clearInterval(turnTimerInterval);
            timerEl.textContent = '0s';
        } else {
            timerEl.textContent = `${Math.ceil(remaining)}s`;
        }
    }, 100);
}

function enableActions() {
    document.querySelectorAll('.pvp-action-btn').forEach(btn => btn.disabled = false);
}

function disableActions() {
    document.querySelectorAll('.pvp-action-btn').forEach(btn => btn.disabled = true);
}

function showResult(data) {
    showSection('pvp-result-section');

    const user = getCurrentUser();
    const won = data.winnerId === user?.id;
    const isDraw = !data.winnerId;

    const resultTitle = document.getElementById('pvp-result-title');
    const ratingChange = document.getElementById('pvp-rating-change');

    if (resultTitle) {
        resultTitle.textContent = isDraw ? t('pvp.draw') : won ? t('pvp.victory') : t('pvp.defeat');
        resultTitle.className = `pvp-result-title ${isDraw ? 'draw' : won ? 'win' : 'loss'}`;
    }

    if (ratingChange) {
        const change = data.you.ratingChange;
        ratingChange.textContent = t('pvp.ratingLabel', { change: `${change >= 0 ? '+' : ''}${change}` });
        ratingChange.className = `pvp-rating-change ${change >= 0 ? 'positive' : 'negative'}`;
    }

    // Update local user pvp stats for the player card
    if (user) {
        user.pvpRating = (user.pvpRating || 1000) + (data.you.ratingChange || 0);
        if (won) user.pvpWins = (user.pvpWins || 0) + 1;
        else if (!isDraw) user.pvpLosses = (user.pvpLosses || 0) + 1;
    }

    // Add share button
    const resultSection = document.getElementById('pvp-result-section');
    let shareBtn = document.getElementById('pvp-share-btn');
    if (!shareBtn && resultSection && data.combatId) {
        shareBtn = document.createElement('button');
        shareBtn.id = 'pvp-share-btn';
        shareBtn.className = 'btn pvp-share-btn';
        shareBtn.textContent = '\uD83D\uDCE4 ' + t('pvp.shareInChat');
        shareBtn.addEventListener('click', () => {
            shareCombatInChat(data.combatId);
            shareBtn.disabled = true;
            shareBtn.textContent = '\u2705 ' + t('pvp.shared');
        });
        resultSection.appendChild(shareBtn);
    }
}

function resetPvpUI() {
    pvpState = 'idle';
    showSection('pvp-idle-section');

    // Clear combat log
    const log = document.getElementById('pvp-combat-log');
    if (log) log.innerHTML = '';

    // Clear error
    const errorEl = document.getElementById('pvp-error');
    if (errorEl) errorEl.textContent = '';

    // Remove share button
    const shareBtn = document.getElementById('pvp-share-btn');
    if (shareBtn) shareBtn.remove();

    if (turnTimerInterval) clearInterval(turnTimerInterval);
    stopQueuePowerRange();

    // Refresh player card with updated stats
    refreshPlayerCard();
}

export function refreshPvpSocket() {
    setupSocketListeners();
}
