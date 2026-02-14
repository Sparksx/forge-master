import { gameEvents, EVENTS } from './events.js';
import { getEquipment, getForgeLevel, getCombatProgress, getTotalItemsSold } from './state.js';
import { showToast } from './ui/helpers.js';
import { t } from './i18n/i18n.js';

// Feature definitions: id, unlock condition, UI selectors, and unlock message
const FEATURES = [
    {
        id: 'forgeUpgrade',
        label: 'Forge Upgrade',
        toastKey: 'featureUnlock.forgeUpgrade',
        condition: () => getTotalItemsSold() >= 2,
        selectors: ['#forge-upgrade-btn'],
    },
    {
        id: 'shop',
        label: 'Shop',
        toastKey: 'featureUnlock.shop',
        condition: () => getOverallSubWave() >= 5,
        selectors: ['.nav-tab[data-tab="shop"]'],
    },
    {
        id: 'upgrade',
        label: 'Upgrade',
        toastKey: 'featureUnlock.upgrade',
        condition: () => getOverallSubWave() >= 10,
        selectors: ['.nav-tab[data-tab="upgrade"]', '.sub-tab[data-subtab="techs"]'],
    },
    {
        id: 'skills',
        label: 'Skills',
        toastKey: 'featureUnlock.skills',
        condition: () => getOverallSubWave() >= 20,
        selectors: ['.sub-tab[data-subtab="skills"]'],
    },
    {
        id: 'autoForge',
        label: 'Auto Forge',
        toastKey: 'featureUnlock.autoForge',
        condition: () => getForgeLevel() >= 3,
        selectors: ['#auto-action-btn'],
    },
    {
        id: 'diamonds',
        label: 'Diamonds',
        toastKey: 'featureUnlock.diamonds',
        condition: () => getForgeLevel() >= 3 || getOverallSubWave() >= 30,
        selectors: ['#diamond-display'],
    },
    {
        id: 'chat',
        label: 'Chat',
        toastKey: 'featureUnlock.chat',
        condition: () => getOverallSubWave() >= 20,
        selectors: ['#chat-preview'],
    },
    {
        id: 'achievements',
        label: 'Achievements',
        toastKey: 'featureUnlock.achievements',
        condition: () => getOverallSubWave() >= 10,
        selectors: ['#achievements-fab'],
    },
    {
        id: 'pvp',
        label: 'PvP Arena',
        toastKey: 'featureUnlock.pvp',
        condition: () => getOverallSubWave() >= 40,
        selectors: ['.nav-tab[data-tab="pvp"]'],
    },
    {
        id: 'dungeon',
        label: 'Dungeon',
        condition: () => false,
        selectors: ['.nav-tab[data-tab="dungeon"]'],
    },
    {
        id: 'pets',
        label: 'Pets',
        condition: () => false,
        selectors: ['.sub-tab[data-subtab="pets"]'],
    },
];

// Track which features have been unlocked (to show toasts only once per session)
const unlockedSet = new Set();

// Track which features were already unlocked on load (skip toasts for those)
const initiallyUnlocked = new Set();

function countEquipped() {
    const eq = getEquipment();
    return Object.values(eq).filter(Boolean).length;
}

function getOverallSubWave() {
    const combat = getCombatProgress();
    return ((combat.highestWave - 1) * 10) + combat.highestSubWave;
}

export function isFeatureUnlocked(featureId) {
    return unlockedSet.has(featureId);
}

/** Returns all feature IDs that gate a specific nav tab */
export function isTabUnlocked(tabName) {
    const feature = FEATURES.find(f => f.selectors.some(s => s === `.nav-tab[data-tab="${tabName}"]`));
    if (!feature) return true; // ungated tabs (home, dungeon) are always accessible
    return unlockedSet.has(feature.id);
}

function applyUnlockToDOM(feature) {
    feature.selectors.forEach(selector => {
        const el = document.querySelector(selector);
        if (el) {
            el.classList.remove('feature-locked');
            el.classList.add('feature-just-unlocked');
            // Remove the animation class after it plays
            setTimeout(() => el.classList.remove('feature-just-unlocked'), 600);
        }
    });
}

function applyLockToDOM(feature) {
    feature.selectors.forEach(selector => {
        const el = document.querySelector(selector);
        if (el) {
            el.classList.add('feature-locked');
        }
    });
}

/** Check all features and unlock any whose conditions are now met */
export function checkUnlocks() {
    for (const feature of FEATURES) {
        if (unlockedSet.has(feature.id)) continue;

        if (feature.condition()) {
            unlockedSet.add(feature.id);
            applyUnlockToDOM(feature);

            // Only show toast if this wasn't already unlocked when the game loaded
            if (!initiallyUnlocked.has(feature.id)) {
                showToast(t(feature.toastKey), 'unlock', 3000);
            }
        }
    }
}

/** Initialize the unlock system: apply locks, check initial state, wire events */
export function initFeatureUnlock() {
    // First pass: determine which features are already unlocked from saved progress
    for (const feature of FEATURES) {
        if (feature.condition()) {
            initiallyUnlocked.add(feature.id);
            unlockedSet.add(feature.id);
        }
    }

    // Apply locks to features that are NOT yet unlocked
    for (const feature of FEATURES) {
        if (!unlockedSet.has(feature.id)) {
            applyLockToDOM(feature);
        }
    }

    // Default sub-tab is techs in HTML. If skills is unlocked, switch to skills as default.
    if (unlockedSet.has('upgrade') && unlockedSet.has('skills')) {
        const skillsTab = document.querySelector('.sub-tab[data-subtab="skills"]');
        const techsTab = document.querySelector('.sub-tab[data-subtab="techs"]');
        const skillsContent = document.getElementById('subtab-skills');
        const techsContent = document.getElementById('subtab-techs');
        if (skillsTab && techsTab && skillsContent && techsContent) {
            techsTab.classList.remove('active');
            skillsTab.classList.add('active');
            techsContent.classList.remove('active');
            skillsContent.classList.add('active');
        }
    }

    // Re-check on every state change
    gameEvents.on(EVENTS.STATE_CHANGED, checkUnlocks);
}
