// ══════════════════════════════════════════════════════════
// Tech Tree Configuration
// ══════════════════════════════════════════════════════════
//
// Each tech has:
//   id            – unique key
//   name          – display name
//   icon          – emoji
//   branch        – category id
//   maxLevel      – how many times it can be researched
//   description   – what it does (use {n} for per-level value)
//   baseCost      – essence cost for level 1
//   costScale     – multiplier per level  (cost = baseCost * costScale^(level-1))
//   baseTime      – research time in seconds for level 1
//   timeScale     – multiplier per level  (time = baseTime * timeScale^(level-1))
//   requires      – array of { tech, level } prerequisites
//   effect        – { type, value } per level (used by game systems)

// ── Branches ─────────────────────────────────────────────

export const TECH_BRANCHES = [
    { id: 'forge',      name: 'Forge',        icon: '🔨' },
    { id: 'equipment',  name: 'Équipement',   icon: '🛡️' },
    { id: 'combat',     name: 'Combat',       icon: '⚔️' },
    { id: 'economy',    name: 'Économie',     icon: '💰' },
    { id: 'automation', name: 'Automatisation', icon: '🤖' },
];

// ── Tech Definitions ─────────────────────────────────────

export const TECHS = [

    // ─── FORGE ───────────────────────────────────────────
    {
        id: 'forgeMultiple',
        name: 'Forge Multiple',
        icon: '🔨',
        branch: 'forge',
        maxLevel: 5,
        description: '+1 item forgé par appui sur Forge',
        baseCost: 500,
        costScale: 3,
        baseTime: 300,       // 5 min
        timeScale: 3,
        requires: [],
        effect: { type: 'forgeMultiple', perLevel: 1 },
    },
    {
        id: 'quickForge',
        name: 'Forge Rapide',
        icon: '⚡',
        branch: 'forge',
        maxLevel: 3,
        description: '-10% intervalle auto-forge',
        baseCost: 250,
        costScale: 3,
        baseTime: 360,       // 6 min
        timeScale: 3,
        requires: [{ tech: 'forgeMultiple', level: 1 }],
        effect: { type: 'quickForge', perLevel: 10 },
    },
    {
        id: 'tierAffinity',
        name: 'Affinité de Tier',
        icon: '✨',
        branch: 'forge',
        maxLevel: 3,
        description: '+2% chances de tier supérieur',
        baseCost: 400,
        costScale: 3,
        baseTime: 600,       // 10 min
        timeScale: 3,
        requires: [{ tech: 'forgeMultiple', level: 2 }],
        effect: { type: 'tierAffinity', perLevel: 2 },
    },
    {
        id: 'selectiveForge',
        name: 'Forge Sélective',
        icon: '🎯',
        branch: 'forge',
        maxLevel: 2,
        description: 'Niv.1: Filtrer santé/dégâts — Niv.2: Filtrer par slot',
        baseCost: 800,
        costScale: 4,
        baseTime: 900,       // 15 min
        timeScale: 4,
        requires: [{ tech: 'forgeMultiple', level: 3 }],
        effect: { type: 'selectiveForge', perLevel: 1 },
    },
    {
        id: 'masterSmith',
        name: 'Maître Forgeron',
        icon: '👑',
        branch: 'forge',
        maxLevel: 1,
        description: 'Garantir un tier minimum (coûte de l\'or)',
        baseCost: 8000,
        costScale: 1,
        baseTime: 7200,      // 2h
        timeScale: 1,
        requires: [{ tech: 'tierAffinity', level: 3 }],
        effect: { type: 'masterSmith', perLevel: 1 },
    },

    // ─── EQUIPMENT (8 mastery techs — one per slot) ─────
    {
        id: 'hatMastery',
        name: 'Maîtrise: Chapeau',
        icon: '🎩',
        branch: 'equipment',
        maxLevel: 25,
        description: '+2 niveau max chapeau',
        baseCost: 15,
        costScale: 1.18,
        baseTime: 30,        // 30s
        timeScale: 1.12,
        requires: [],
        effect: { type: 'hatMastery', perLevel: 2 },
    },
    {
        id: 'armorMastery',
        name: 'Maîtrise: Armure',
        icon: '🛡️',
        branch: 'equipment',
        maxLevel: 25,
        description: '+2 niveau max armure',
        baseCost: 15,
        costScale: 1.18,
        baseTime: 30,
        timeScale: 1.12,
        requires: [],
        effect: { type: 'armorMastery', perLevel: 2 },
    },
    {
        id: 'beltMastery',
        name: 'Maîtrise: Ceinture',
        icon: '📿',
        branch: 'equipment',
        maxLevel: 25,
        description: '+2 niveau max ceinture',
        baseCost: 15,
        costScale: 1.18,
        baseTime: 30,
        timeScale: 1.12,
        requires: [],
        effect: { type: 'beltMastery', perLevel: 2 },
    },
    {
        id: 'bootsMastery',
        name: 'Maîtrise: Bottes',
        icon: '👢',
        branch: 'equipment',
        maxLevel: 25,
        description: '+2 niveau max bottes',
        baseCost: 15,
        costScale: 1.18,
        baseTime: 30,
        timeScale: 1.12,
        requires: [],
        effect: { type: 'bootsMastery', perLevel: 2 },
    },
    {
        id: 'glovesMastery',
        name: 'Maîtrise: Gants',
        icon: '🧤',
        branch: 'equipment',
        maxLevel: 25,
        description: '+2 niveau max gants',
        baseCost: 15,
        costScale: 1.18,
        baseTime: 30,
        timeScale: 1.12,
        requires: [],
        effect: { type: 'glovesMastery', perLevel: 2 },
    },
    {
        id: 'necklaceMastery',
        name: 'Maîtrise: Collier',
        icon: '📿',
        branch: 'equipment',
        maxLevel: 25,
        description: '+2 niveau max collier',
        baseCost: 15,
        costScale: 1.18,
        baseTime: 30,
        timeScale: 1.12,
        requires: [],
        effect: { type: 'necklaceMastery', perLevel: 2 },
    },
    {
        id: 'ringMastery',
        name: 'Maîtrise: Anneau',
        icon: '💍',
        branch: 'equipment',
        maxLevel: 25,
        description: '+2 niveau max anneau',
        baseCost: 15,
        costScale: 1.18,
        baseTime: 30,
        timeScale: 1.12,
        requires: [],
        effect: { type: 'ringMastery', perLevel: 2 },
    },
    {
        id: 'weaponMastery',
        name: 'Maîtrise: Arme',
        icon: '⚔️',
        branch: 'equipment',
        maxLevel: 25,
        description: '+2 niveau max arme',
        baseCost: 15,
        costScale: 1.18,
        baseTime: 30,
        timeScale: 1.12,
        requires: [],
        effect: { type: 'weaponMastery', perLevel: 2 },
    },
    {
        id: 'bonusEnhance',
        name: 'Bonus Améliorés',
        icon: '💎',
        branch: 'equipment',
        maxLevel: 5,
        description: '+8% valeur des bonus stats',
        baseCost: 300,
        costScale: 2.5,
        baseTime: 480,       // 8 min
        timeScale: 2.5,
        requires: [{ tech: 'hatMastery', level: 5 }],
        requiresAny: true,
        altRequires: [
            { tech: 'armorMastery', level: 5 },
            { tech: 'beltMastery', level: 5 },
            { tech: 'bootsMastery', level: 5 },
            { tech: 'glovesMastery', level: 5 },
            { tech: 'necklaceMastery', level: 5 },
            { tech: 'ringMastery', level: 5 },
            { tech: 'weaponMastery', level: 5 },
        ],
        effect: { type: 'bonusEnhance', perLevel: 8 },
    },
    {
        id: 'extraBonus',
        name: 'Bonus Supplémentaire',
        icon: '🌟',
        branch: 'equipment',
        maxLevel: 1,
        description: '+1 slot de bonus sur les items forgés',
        baseCost: 12000,
        costScale: 1,
        baseTime: 14400,     // 4h
        timeScale: 1,
        requires: [{ tech: 'bonusEnhance', level: 5 }, { tech: 'masterwork', level: 1 }],
        effect: { type: 'extraBonus', perLevel: 1 },
    },
    {
        id: 'masterwork',
        name: 'Chef-d\'oeuvre',
        icon: '🏆',
        branch: 'equipment',
        maxLevel: 1,
        description: '10% chance: item forgé +20 niveaux',
        baseCost: 6000,
        costScale: 1,
        baseTime: 7200,      // 2h
        timeScale: 1,
        requires: [{ tech: 'hatMastery', level: 10 }, { tech: 'weaponMastery', level: 10 }],
        effect: { type: 'masterwork', perLevel: 1 },
    },

    // ─── COMBAT ──────────────────────────────────────────
    {
        id: 'vitality',
        name: 'Vitalité',
        icon: '❤️',
        branch: 'combat',
        maxLevel: 10,
        description: '+2% santé totale',
        baseCost: 20,
        costScale: 1.4,
        baseTime: 60,        // 1 min
        timeScale: 1.3,
        requires: [],
        effect: { type: 'vitality', perLevel: 2 },
    },
    {
        id: 'strength',
        name: 'Force',
        icon: '💪',
        branch: 'combat',
        maxLevel: 10,
        description: '+2% dégâts totaux',
        baseCost: 20,
        costScale: 1.4,
        baseTime: 60,        // 1 min
        timeScale: 1.3,
        requires: [],
        effect: { type: 'strength', perLevel: 2 },
    },
    {
        id: 'swiftStrikes',
        name: 'Frappe Rapide',
        icon: '⚡',
        branch: 'combat',
        maxLevel: 5,
        description: '+3% vitesse d\'attaque',
        baseCost: 200,
        costScale: 2.5,
        baseTime: 600,       // 10 min
        timeScale: 2.5,
        requires: [{ tech: 'strength', level: 3 }],
        effect: { type: 'swiftStrikes', perLevel: 3 },
    },
    {
        id: 'waveBreaker',
        name: 'Brise-Vagues',
        icon: '🌊',
        branch: 'combat',
        maxLevel: 5,
        description: '+2 vagues max (au-delà de 10)',
        baseCost: 400,
        costScale: 2,
        baseTime: 1200,      // 20 min
        timeScale: 2,
        requires: [{ tech: 'vitality', level: 3 }, { tech: 'strength', level: 3 }],
        effect: { type: 'waveBreaker', perLevel: 2 },
    },
    {
        id: 'battleXP',
        name: 'Expérience de Bataille',
        icon: '📖',
        branch: 'combat',
        maxLevel: 5,
        description: '+10% XP de combat',
        baseCost: 150,
        costScale: 2,
        baseTime: 300,       // 5 min
        timeScale: 2,
        requires: [{ tech: 'waveBreaker', level: 1 }],
        effect: { type: 'battleXP', perLevel: 10 },
    },

    // ─── ECONOMY ─────────────────────────────────────────
    {
        id: 'goldRush',
        name: 'Ruée vers l\'Or',
        icon: '💰',
        branch: 'economy',
        maxLevel: 25,
        description: '+2% or de vente',
        baseCost: 10,
        costScale: 1.15,
        baseTime: 30,        // 30s
        timeScale: 1.1,
        requires: [],
        effect: { type: 'goldRush', perLevel: 2 },
    },
    {
        id: 'essenceStudy',
        name: 'Essence de Forge',
        icon: '🔮',
        branch: 'economy',
        maxLevel: 25,
        description: '+2% essence obtenue en forgeant',
        baseCost: 15,
        costScale: 1.15,
        baseTime: 45,        // 45s
        timeScale: 1.1,
        requires: [{ tech: 'goldRush', level: 5 }],
        effect: { type: 'essenceStudy', perLevel: 2 },
    },
    {
        id: 'treasureHunter',
        name: 'Chercheur de Trésors',
        icon: '🗝️',
        branch: 'economy',
        maxLevel: 3,
        description: '+5% chance d\'or bonus en forgeant',
        baseCost: 500,
        costScale: 3,
        baseTime: 900,       // 15 min
        timeScale: 3,
        requires: [{ tech: 'goldRush', level: 10 }],
        effect: { type: 'treasureHunter', perLevel: 5 },
    },
    {
        id: 'essenceResonance',
        name: 'Résonance d\'Essence',
        icon: '💠',
        branch: 'economy',
        maxLevel: 3,
        description: '-10% coût de recherche',
        baseCost: 600,
        costScale: 3,
        baseTime: 1200,      // 20 min
        timeScale: 3,
        requires: [{ tech: 'essenceStudy', level: 5 }],
        effect: { type: 'essenceResonance', perLevel: 10 },
    },
    // ─── AUTOMATION ──────────────────────────────────────
    {
        id: 'smartFilter',
        name: 'Filtre Intelligent',
        icon: '🧠',
        branch: 'automation',
        maxLevel: 3,
        description: 'Niv.1: filtre niveau min — Niv.2: filtre stats min — Niv.3: filtre par slot',
        baseCost: 1500,
        costScale: 4,
        baseTime: 1800,      // 30 min
        timeScale: 4,
        requires: [{ tech: 'forgeMultiple', level: 2 }, { tech: 'goldRush', level: 5 }],
        effect: { type: 'smartFilter', perLevel: 1 },
    },
    {
        id: 'autoEquip',
        name: 'Auto-Équipement',
        icon: '🔄',
        branch: 'automation',
        maxLevel: 1,
        description: 'Auto-équipe si strictement meilleur',
        baseCost: 8000,
        costScale: 1,
        baseTime: 7200,      // 2h
        timeScale: 1,
        requires: [{ tech: 'smartFilter', level: 3 }, { tech: 'forgeMultiple', level: 3 }],
        effect: { type: 'autoEquip', perLevel: 1 },
    },
    {
        id: 'researchQueue',
        name: 'File de Recherche',
        icon: '📋',
        branch: 'automation',
        maxLevel: 3,
        description: '+1 recherche en file d\'attente',
        baseCost: 2000,
        costScale: 4,
        baseTime: 2400,      // 40 min
        timeScale: 4,
        requires: [{ tech: 'smartFilter', level: 1 }, { tech: 'essenceStudy', level: 3 }],
        effect: { type: 'researchQueue', perLevel: 1 },
    },
];

// ── Helpers ──────────────────────────────────────────────

const techMap = new Map(TECHS.map(t => [t.id, t]));

export function getTechById(id) {
    return techMap.get(id);
}

/** Cost in essence for a given tech at a given level (1-based: level you are researching) */
export function getResearchCost(techId, level) {
    const tech = techMap.get(techId);
    if (!tech) return Infinity;
    return Math.floor(tech.baseCost * Math.pow(tech.costScale, level - 1));
}

/** Duration in seconds for a given tech at a given level */
export function getResearchTime(techId, level) {
    const tech = techMap.get(techId);
    if (!tech) return Infinity;
    return Math.floor(tech.baseTime * Math.pow(tech.timeScale, level - 1));
}
