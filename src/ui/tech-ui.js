// ══════════════════════════════════════════════════════════
// Tech Tree UI
// ══════════════════════════════════════════════════════════

import { TECH_BRANCHES, TECHS, getTechById } from '../tech-config.js';
import { getTechLevel, getEssence, getDiamonds, getTechEffect } from '../state.js';
import {
    isTechUnlocked, isTechMaxed, getEffectiveResearchCost,
    getResearchStatus, startResearch, speedUpResearch,
    canStartResearch, checkResearchComplete, startResearchTimer,
} from '../research.js';
import { getResearchTime } from '../tech-config.js';
import { getResearchState } from '../state.js';
import { createElement, formatNumber, formatCompact, formatTime } from './helpers.js';
import { t } from '../i18n/i18n.js';
import { gameEvents, EVENTS } from '../events.js';

let selectedBranch = 'forge';
let techTimerInterval = null;

// ── Initialise branch tabs ───────────────────────────────

export function initTechUI() {
    const nav = document.getElementById('tech-branch-nav');
    if (!nav) return;
    nav.textContent = '';

    TECH_BRANCHES.forEach(branch => {
        const btn = createElement('button', 'tech-branch-tab', `${branch.icon} ${branch.name}`);
        btn.dataset.branch = branch.id;
        btn.setAttribute('role', 'tab');
        if (branch.id === selectedBranch) btn.classList.add('active');
        btn.addEventListener('click', () => {
            selectedBranch = branch.id;
            nav.querySelectorAll('.tech-branch-tab').forEach(b => b.classList.toggle('active', b.dataset.branch === branch.id));
            renderTechList();
        });
        nav.appendChild(btn);
    });

    renderTechTree();

    gameEvents.on(EVENTS.LOCALE_CHANGED, () => { initTechUI(); });
}

// ── Render everything ────────────────────────────────────

export function renderTechTree() {
    renderActiveResearch();
    renderTechList();
}

// ── Active Research Banner ───────────────────────────────

export function renderActiveResearch() {
    const container = document.getElementById('tech-research-active');
    if (!container) return;
    container.textContent = '';

    const research = getResearchState();

    // Show queue info
    const queue = research.queue || [];

    if (!research.active && queue.length === 0) {
        container.classList.remove('has-research');
        return;
    }

    container.classList.add('has-research');

    if (research.active) {
        const tech = getTechById(research.active.techId);
        if (!tech) return;

        const header = createElement('div', 'research-banner');

        const title = createElement('div', 'research-banner-title',
            `${tech.icon} ${tech.name} ${t('tech.level', { level: research.active.level })}`);
        header.appendChild(title);

        const progressBar = createElement('div', 'research-progress-bar');
        const progressFill = createElement('div', 'research-progress-fill');
        progressFill.id = 'research-progress-fill';
        progressBar.appendChild(progressFill);
        header.appendChild(progressBar);

        const infoRow = createElement('div', 'research-banner-info');
        const timerText = createElement('span', 'research-timer-text');
        timerText.id = 'research-timer-text';
        infoRow.appendChild(timerText);

        const speedUpBtn = createElement('button', 'btn btn-speed-up btn-speed-up-research');
        speedUpBtn.id = 'research-speed-up-btn';
        speedUpBtn.addEventListener('click', () => {
            speedUpResearch();
            renderTechTree();
        });
        infoRow.appendChild(speedUpBtn);
        header.appendChild(infoRow);

        container.appendChild(header);
        updateResearchTimerDisplay();
        startTechTimer();
    }

    // Show queue
    if (queue.length > 0) {
        const queueDiv = createElement('div', 'research-queue');
        const queueLabel = createElement('div', 'research-queue-label', t('tech.queue', { count: queue.length }));
        queueDiv.appendChild(queueLabel);

        queue.forEach(entry => {
            const tech = getTechById(entry.techId);
            if (!tech) return;
            const item = createElement('div', 'research-queue-item',
                `${tech.icon} ${tech.name} ${t('tech.level', { level: entry.level })}`);
            queueDiv.appendChild(item);
        });

        container.appendChild(queueDiv);
    }
}

// ── Tech List for selected branch ────────────────────────

export function renderTechList() {
    const list = document.getElementById('tech-list');
    if (!list) return;
    list.textContent = '';

    const branchTechs = TECHS.filter(t => t.branch === selectedBranch);

    branchTechs.forEach(tech => {
        const card = buildTechCard(tech);
        list.appendChild(card);
    });
}

function buildTechCard(tech) {
    const currentLevel = getTechLevel(tech.id);
    const isMaxed = currentLevel >= tech.maxLevel;
    const isUnlocked = isTechUnlocked(tech.id);
    const research = getResearchState();
    const isBeingResearched = research.active && research.active.techId === tech.id;
    const isQueued = research.queue.some(q => q.techId === tech.id);

    let cardClass = 'tech-card';
    if (isMaxed) cardClass += ' tech-maxed';
    else if (isBeingResearched) cardClass += ' tech-active';
    else if (isQueued) cardClass += ' tech-queued';
    else if (!isUnlocked) cardClass += ' tech-locked';

    const card = createElement('div', cardClass);
    card.setAttribute('role', 'listitem');

    // Header row: icon + name + level
    const headerRow = createElement('div', 'tech-card-header');

    const icon = createElement('span', 'tech-card-icon', tech.icon);
    headerRow.appendChild(icon);

    const nameCol = createElement('div', 'tech-card-name-col');
    nameCol.appendChild(createElement('div', 'tech-card-name', tech.name));
    nameCol.appendChild(createElement('div', 'tech-card-desc', tech.description));
    headerRow.appendChild(nameCol);

    // Level indicator
    const levelCol = createElement('div', 'tech-card-level-col');
    if (tech.maxLevel <= 10) {
        const levelDots = createElement('div', 'tech-card-dots');
        for (let i = 1; i <= tech.maxLevel; i++) {
            const dot = createElement('span', 'tech-dot');
            if (i <= currentLevel) dot.classList.add('tech-dot-filled');
            levelDots.appendChild(dot);
        }
        levelCol.appendChild(levelDots);
    } else {
        const progressBar = createElement('div', 'tech-level-bar');
        const progressFill = createElement('div', 'tech-level-fill');
        const pct = tech.maxLevel > 0 ? (currentLevel / tech.maxLevel) * 100 : 0;
        progressFill.style.width = `${pct}%`;
        progressBar.appendChild(progressFill);
        levelCol.appendChild(progressBar);
    }
    const levelLabel = createElement('span', 'tech-card-level', `${currentLevel}/${tech.maxLevel}`);
    levelCol.appendChild(levelLabel);
    headerRow.appendChild(levelCol);

    card.appendChild(headerRow);

    // Bottom: action zone
    if (isMaxed) {
        card.appendChild(createElement('div', 'tech-card-status tech-status-max', t('tech.max')));
    } else if (isBeingResearched) {
        card.appendChild(createElement('div', 'tech-card-status tech-status-active', t('tech.researching')));
    } else if (isQueued) {
        card.appendChild(createElement('div', 'tech-card-status tech-status-queued', t('tech.queued')));
    } else if (!isUnlocked) {
        // Show prerequisite info
        const reqText = buildRequiresText(tech);
        const lockRow = createElement('div', 'tech-card-requires');
        lockRow.appendChild(createElement('span', 'tech-lock-icon', '🔒'));
        lockRow.appendChild(createElement('span', 'tech-lock-text', reqText));
        card.appendChild(lockRow);
    } else {
        // Available: show cost, time, and button
        const nextLevel = currentLevel + 1;
        const cost = getEffectiveResearchCost(tech.id, nextLevel);
        const time = getResearchTime(tech.id, nextLevel);
        const canAfford = getEssence() >= cost;

        const actionRow = createElement('div', 'tech-card-action');

        const costSpan = createElement('span', 'tech-card-cost', `${formatNumber(cost)} 🔮`);
        if (!canAfford) costSpan.classList.add('tech-cost-insufficient');
        actionRow.appendChild(costSpan);

        actionRow.appendChild(createElement('span', 'tech-card-time', formatTime(time)));

        const researchBtn = createElement('button', 'btn btn-research', t('tech.research'));
        const hasActiveOrFull = !!research.active;
        const maxQueue = getTechEffect('researchQueue');
        const canQueue = hasActiveOrFull && research.queue.length < maxQueue;

        if (!canAfford) {
            researchBtn.disabled = true;
            researchBtn.classList.add('btn-disabled');
        } else if (hasActiveOrFull && !canQueue) {
            researchBtn.disabled = true;
            researchBtn.classList.add('btn-disabled');
            if (maxQueue === 0) {
                researchBtn.textContent = t('tech.busy');
            } else {
                researchBtn.textContent = t('tech.queueFull');
            }
        }

        if (canAfford && hasActiveOrFull && canQueue) {
            researchBtn.textContent = t('tech.enqueue');
        }

        researchBtn.addEventListener('click', () => {
            startResearch(tech.id);
            renderTechTree();
        });

        actionRow.appendChild(researchBtn);
        card.appendChild(actionRow);
    }

    return card;
}

function buildRequiresText(tech) {
    const parts = [];

    const addReqParts = (reqs) => {
        return reqs.map(req => {
            const reqTech = getTechById(req.tech);
            return reqTech ? `${reqTech.name} ${t('tech.level', { level: req.level })}` : req.tech;
        });
    };

    if (tech.altRequires) {
        parts.push(t('tech.mastery'));
    } else {
        parts.push(...addReqParts(tech.requires));
    }

    return t('tech.requires', { reqs: parts.join(' + ') });
}

// ── Timer display ────────────────────────────────────────

function startTechTimer() {
    stopTechTimer();
    techTimerInterval = setInterval(() => {
        const status = getResearchStatus();
        if (!status) { stopTechTimer(); return; }
        if (checkResearchComplete()) {
            renderTechTree();
            return;
        }
        updateResearchTimerDisplay();
    }, 1000);
}

function stopTechTimer() {
    if (techTimerInterval) {
        clearInterval(techTimerInterval);
        techTimerInterval = null;
    }
}

function updateResearchTimerDisplay() {
    const status = getResearchStatus();
    if (!status) return;

    const timerText = document.getElementById('research-timer-text');
    if (timerText) timerText.textContent = formatTime(status.remaining);

    const progressFill = document.getElementById('research-progress-fill');
    if (progressFill) progressFill.style.width = `${(status.progress * 100).toFixed(1)}%`;

    const speedUpBtn = document.getElementById('research-speed-up-btn');
    if (speedUpBtn) {
        speedUpBtn.textContent = `⚡ ${formatNumber(status.speedUpCost)} 💎`;
        const canAfford = getDiamonds() >= status.speedUpCost;
        speedUpBtn.disabled = !canAfford;
        speedUpBtn.classList.toggle('btn-disabled', !canAfford);
    }
}

// ── Essence display in header ────────────────────────────

export function updateEssenceDisplay() {
    const el = document.getElementById('essence-amount');
    if (el) el.textContent = formatCompact(getEssence());
}
