// Barrel file — re-exports from split UI modules
// Keeps all existing imports from main.js working unchanged.

export {
    showForgeToast, showSellToast,
    updateStats, getCachedStats, updateEquipmentSlots,
    updateForgeInfo, showForgeUpgradeModal, hideForgeUpgradeModal,
    showDecisionModal, hideDecisionModal,
    isAutoForging, handleAutoForgeClick,
    showItemDetailModal, hideItemDetailModal,
    updateUI,
} from './ui/forge-ui.js';

export {
    renderMonsters, updateMonsterFocus,
    updateCombatUI, updateCombatInfo, updateWaveDisplay,
    showDamageNumber, showCombatResult,
    triggerAttackAnimation, triggerHitAnimation, triggerMonsterHitAnimation,
} from './ui/combat-ui.js';

export {
    showProfileModal, renderProfileContent,
} from './ui/profile-ui.js';

// Wire the cachedStats getter so profile-ui can access it
import { getCachedStats } from './ui/forge-ui.js';
import { _setCachedStatsGetter } from './ui/profile-ui.js';
_setCachedStatsGetter(getCachedStats);
