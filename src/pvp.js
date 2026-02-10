/**
 * PvP UI — matchmaking queue, real-time combat, and results.
 */

import { getSocket } from './socket-client.js';
import { getCurrentUser } from './auth.js';
import { shareCombatInChat } from './chat.js';

let pvpState = 'idle'; // idle | queued | matched | fighting | ended

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
}

function setupSocketListeners() {
    const socket = getSocket();
    if (!socket) return;

    socket.on('pvp:queued', () => {
        pvpState = 'queued';
        showSection('pvp-queue-section');
    });

    socket.on('pvp:cancelled', () => {
        pvpState = 'idle';
        showSection('pvp-idle-section');
    });

    socket.on('pvp:matched', (data) => {
        pvpState = 'matched';
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
        if (errorEl) errorEl.textContent = data.message || 'PvP error';
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

function updateMatchInfo(data) {
    const opponentName = document.getElementById('pvp-opponent-name');
    const opponentRating = document.getElementById('pvp-opponent-rating');
    if (opponentName) opponentName.textContent = data.opponent.username;
    if (opponentRating) opponentRating.textContent = `Rating: ${data.opponent.rating}`;

    // Init HP bars
    updateHP('pvp-your-hp', data.opponent.maxHP, data.opponent.maxHP, 'pvp-your-hp-text');
    updateHP('pvp-opponent-hp', data.opponent.maxHP, data.opponent.maxHP, 'pvp-opponent-hp-text');
}

function updateCombatUI(data) {
    updateHP('pvp-your-hp', data.you.currentHP, data.you.maxHP, 'pvp-your-hp-text');
    updateHP('pvp-opponent-hp', data.opponent.currentHP, data.opponent.maxHP, 'pvp-opponent-hp-text');

    // Show turn log
    const log = document.getElementById('pvp-combat-log');
    if (log) {
        const line = document.createElement('div');
        line.className = 'pvp-log-entry';
        const yourAction = data.you.action;
        const theirAction = data.opponent.action;
        line.textContent = `Turn ${data.turn}: You ${yourAction} (${data.opponent.damage} dmg taken) — Opponent ${theirAction} (${data.you.damage} dmg taken)`;
        log.appendChild(line);
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
        resultTitle.textContent = isDraw ? 'Draw!' : won ? 'Victory!' : 'Defeat!';
        resultTitle.className = `pvp-result-title ${isDraw ? 'draw' : won ? 'win' : 'loss'}`;
    }

    if (ratingChange) {
        const change = data.you.ratingChange;
        ratingChange.textContent = `Rating: ${change >= 0 ? '+' : ''}${change}`;
        ratingChange.className = `pvp-rating-change ${change >= 0 ? 'positive' : 'negative'}`;
    }

    // Add share button
    const resultSection = document.getElementById('pvp-result-section');
    let shareBtn = document.getElementById('pvp-share-btn');
    if (!shareBtn && resultSection && data.combatId) {
        shareBtn = document.createElement('button');
        shareBtn.id = 'pvp-share-btn';
        shareBtn.className = 'btn pvp-share-btn';
        shareBtn.textContent = '\uD83D\uDCE4 Share in Chat';
        shareBtn.addEventListener('click', () => {
            shareCombatInChat(data.combatId);
            shareBtn.disabled = true;
            shareBtn.textContent = '\u2705 Shared!';
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
}

export function refreshPvpSocket() {
    setupSocketListeners();
}
