// ══════════════════════════════════════════════════════════
// Research Engine
// ══════════════════════════════════════════════════════════
// Manages starting, progressing, and completing research.

import { TECHS, getTechById, getResearchCost, getResearchTime } from './tech-config.js';
import {
    getEssence, spendEssence, getTechLevel, getTechEffect,
    getResearchState, setResearchActive, completeResearch,
    getResearchQueue, addToResearchQueue, shiftResearchQueue,
    saveGame,
} from './state.js';
import { gameEvents, EVENTS } from './events.js';
import { SPEED_UP_GOLD_PER_SECOND } from './config.js';
import { getGold, addGold } from './state.js';

let researchTimerInterval = null;

// ── Prerequisites ────────────────────────────────────────

export function isTechUnlocked(techId) {
    const tech = getTechById(techId);
    if (!tech) return false;

    // Already at max level?
    const currentLevel = getTechLevel(techId);
    if (currentLevel >= tech.maxLevel) return false;

    // Check main requires
    const mainMet = tech.requires.every(
        req => getTechLevel(req.tech) >= req.level
    );

    // If tech has altRequires (OR condition), main OR any single altRequire must be met
    if (tech.altRequires) {
        const altMet = tech.altRequires.some(
            req => getTechLevel(req.tech) >= req.level
        );
        return mainMet || altMet;
    }

    return mainMet;
}

export function isTechMaxed(techId) {
    const tech = getTechById(techId);
    if (!tech) return false;
    return getTechLevel(techId) >= tech.maxLevel;
}

// ── Cost with discount ───────────────────────────────────

export function getEffectiveResearchCost(techId, level) {
    const baseCost = getResearchCost(techId, level);
    const discount = getTechEffect('essenceResonance'); // % discount
    return Math.max(1, Math.floor(baseCost * (1 - discount / 100)));
}

// ── Start / Queue Research ───────────────────────────────

export function canStartResearch(techId) {
    if (!isTechUnlocked(techId)) return false;
    const currentLevel = getTechLevel(techId);
    const tech = getTechById(techId);
    if (currentLevel >= tech.maxLevel) return false;

    const nextLevel = currentLevel + 1;
    const cost = getEffectiveResearchCost(techId, nextLevel);
    if (getEssence() < cost) return false;

    return true;
}

export function startResearch(techId) {
    const research = getResearchState();
    const tech = getTechById(techId);
    if (!tech) return false;

    const currentLevel = getTechLevel(techId);
    const nextLevel = currentLevel + 1;
    if (nextLevel > tech.maxLevel) return false;
    if (!isTechUnlocked(techId)) return false;

    const cost = getEffectiveResearchCost(techId, nextLevel);
    if (!spendEssence(cost)) return false;

    const duration = getResearchTime(techId, nextLevel);

    // If nothing is active, start now
    if (!research.active) {
        setResearchActive({
            techId,
            level: nextLevel,
            startedAt: Date.now(),
            duration,
        });
        gameEvents.emit(EVENTS.RESEARCH_STARTED, { techId, level: nextLevel });
        startResearchTimer();
        return true;
    }

    // Otherwise queue it (check max queue size from researchQueue tech)
    const maxQueue = getTechEffect('researchQueue');
    if (research.queue.length >= maxQueue) return false;

    addToResearchQueue({ techId, level: nextLevel, duration });
    return true;
}

// ── Timer management ─────────────────────────────────────

export function startResearchTimer() {
    stopResearchTimer();
    researchTimerInterval = setInterval(() => {
        checkResearchComplete();
    }, 1000);
}

export function stopResearchTimer() {
    if (researchTimerInterval) {
        clearInterval(researchTimerInterval);
        researchTimerInterval = null;
    }
}

export function getResearchStatus() {
    const research = getResearchState();
    if (!research.active) return null;

    const { startedAt, duration } = research.active;
    const elapsed = (Date.now() - startedAt) / 1000;
    const remaining = Math.max(0, duration - elapsed);
    const progress = Math.min(1, elapsed / duration);
    const speedUpCost = Math.ceil(remaining * SPEED_UP_GOLD_PER_SECOND);

    return { remaining, progress, speedUpCost, duration, ...research.active };
}

export function checkResearchComplete() {
    const research = getResearchState();
    if (!research.active) return false;

    const status = getResearchStatus();
    if (status.remaining <= 0) {
        completeResearch(research.active.techId, research.active.level);
        processQueue();
        return true;
    }
    return false;
}

export function speedUpResearch() {
    const status = getResearchStatus();
    if (!status || status.remaining <= 0) {
        return checkResearchComplete();
    }
    const gold = getGold();
    if (gold < status.speedUpCost) return false;

    addGold(-status.speedUpCost);
    const research = getResearchState();
    completeResearch(research.active.techId, research.active.level);
    processQueue();
    return true;
}

function processQueue() {
    const research = getResearchState();
    if (research.active) return; // something still active

    const next = shiftResearchQueue();
    if (!next) {
        stopResearchTimer();
        return;
    }

    setResearchActive({
        techId: next.techId,
        level: next.level,
        startedAt: Date.now(),
        duration: next.duration,
    });
    gameEvents.emit(EVENTS.RESEARCH_STARTED, { techId: next.techId, level: next.level });
}

// ── Init (called on game load to resume timers) ─────────

export function initResearch() {
    const research = getResearchState();

    // Check if active research completed while offline
    if (research.active) {
        const elapsed = (Date.now() - research.active.startedAt) / 1000;
        if (elapsed >= research.active.duration) {
            completeResearch(research.active.techId, research.active.level);
            processQueue();
        } else {
            startResearchTimer();
        }
    }

    // Process queued items that might have completed
    if (!research.active && research.queue.length > 0) {
        processQueue();
        if (research.active) {
            startResearchTimer();
        }
    }
}
