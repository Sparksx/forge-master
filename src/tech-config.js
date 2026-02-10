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
        baseCost: 80,
        costScale: 4,
        baseTime: 120,       // 2 min
        timeScale: 4,
        requires: [],
        effect: { type: 'forgeMultiple', perLevel: 1 },
    },
    {
        id: 'quickForge',
        name: 'Forge Rapide',
        icon: '⚡',
        branch: 'forge',
        maxLevel: 3,
        description: '-15% intervalle auto-forge',
        baseCost: 200,
        costScale: 4,
        baseTime: 300,       // 5 min
        timeScale: 4,
        requires: [{ tech: 'forgeMultiple', level: 1 }],
        effect: { type: 'quickForge', perLevel: 15 },
    },
    {
        id: 'tierAffinity',
        name: 'Affinité de Tier',
        icon: '✨',
        branch: 'forge',
        maxLevel: 3,
        description: '+3% chances de tier supérieur',
        baseCost: 300,
        costScale: 4,
        baseTime: 600,       // 10 min
        timeScale: 4,
        requires: [{ tech: 'forgeMultiple', level: 2 }],
        effect: { type: 'tierAffinity', perLevel: 3 },
    },
    {
        id: 'selectiveForge',
        name: 'Forge Sélective',
        icon: '🎯',
        branch: 'forge',
        maxLevel: 2,
        description: 'Niv.1: Filtrer santé/dégâts — Niv.2: Filtrer par slot',
        baseCost: 500,
        costScale: 5,
        baseTime: 900,       // 15 min
        timeScale: 5,
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
        baseCost: 5000,
        costScale: 1,
        baseTime: 7200,      // 2h
        timeScale: 1,
        requires: [{ tech: 'tierAffinity', level: 3 }],
        effect: { type: 'masterSmith', perLevel: 1 },
    },

    // ─── EQUIPMENT ───────────────────────────────────────
    {
        id: 'armorMastery',
        name: 'Maîtrise d\'Armure',
        icon: '🛡️',
        branch: 'equipment',
        maxLevel: 5,
        description: '+2 niveau max items santé',
        baseCost: 100,
        costScale: 4,
        baseTime: 180,       // 3 min
        timeScale: 4,
        requires: [],
        effect: { type: 'armorMastery', perLevel: 2 },
    },
    {
        id: 'weaponMastery',
        name: 'Maîtrise d\'Arme',
        icon: '⚔️',
        branch: 'equipment',
        maxLevel: 5,
        description: '+2 niveau max items dégâts',
        baseCost: 100,
        costScale: 4,
        baseTime: 180,       // 3 min
        timeScale: 4,
        requires: [],
        effect: { type: 'weaponMastery', perLevel: 2 },
    },
    {
        id: 'bonusEnhance',
        name: 'Bonus Améliorés',
        icon: '💎',
        branch: 'equipment',
        maxLevel: 5,
        description: '+10% valeur des bonus stats',
        baseCost: 250,
        costScale: 4,
        baseTime: 480,       // 8 min
        timeScale: 4,
        requires: [{ tech: 'armorMastery', level: 1 }],  // OR weaponMastery handled in code
        requiresAny: true,  // any of the requires is enough
        altRequires: [{ tech: 'weaponMastery', level: 1 }],
        effect: { type: 'bonusEnhance', perLevel: 10 },
    },
    {
        id: 'extraBonus',
        name: 'Bonus Supplémentaire',
        icon: '🌟',
        branch: 'equipment',
        maxLevel: 3,
        description: '+1 slot de bonus sur les items forgés',
        baseCost: 1500,
        costScale: 5,
        baseTime: 3600,      // 1h
        timeScale: 4,
        requires: [{ tech: 'bonusEnhance', level: 3 }],
        effect: { type: 'extraBonus', perLevel: 1 },
    },
    {
        id: 'masterwork',
        name: 'Chef-d\'œuvre',
        icon: '🏆',
        branch: 'equipment',
        maxLevel: 1,
        description: '10% chance: item forgé +20 niveaux',
        baseCost: 4000,
        costScale: 1,
        baseTime: 7200,      // 2h
        timeScale: 1,
        requires: [{ tech: 'armorMastery', level: 3 }, { tech: 'weaponMastery', level: 3 }],
        effect: { type: 'masterwork', perLevel: 1 },
    },

    // ─── COMBAT ──────────────────────────────────────────
    {
        id: 'vitality',
        name: 'Vitalité',
        icon: '❤️',
        branch: 'combat',
        maxLevel: 5,
        description: '+10% santé de base',
        baseCost: 80,
        costScale: 4,
        baseTime: 150,       // 2.5 min
        timeScale: 4,
        requires: [],
        effect: { type: 'vitality', perLevel: 10 },
    },
    {
        id: 'strength',
        name: 'Force',
        icon: '💪',
        branch: 'combat',
        maxLevel: 5,
        description: '+10% dégâts de base',
        baseCost: 80,
        costScale: 4,
        baseTime: 150,       // 2.5 min
        timeScale: 4,
        requires: [],
        effect: { type: 'strength', perLevel: 10 },
    },
    {
        id: 'swiftStrikes',
        name: 'Frappe Rapide',
        icon: '⚡',
        branch: 'combat',
        maxLevel: 3,
        description: '+5% vitesse d\'attaque',
        baseCost: 300,
        costScale: 4,
        baseTime: 600,       // 10 min
        timeScale: 4,
        requires: [{ tech: 'strength', level: 2 }],
        effect: { type: 'swiftStrikes', perLevel: 5 },
    },
    {
        id: 'waveBreaker',
        name: 'Brise-Vagues',
        icon: '🌊',
        branch: 'combat',
        maxLevel: 5,
        description: '+2 vagues max (au-delà de 10)',
        baseCost: 500,
        costScale: 5,
        baseTime: 1800,      // 30 min
        timeScale: 4,
        requires: [{ tech: 'vitality', level: 2 }, { tech: 'strength', level: 2 }],
        effect: { type: 'waveBreaker', perLevel: 2 },
    },
    {
        id: 'battleXP',
        name: 'Expérience de Bataille',
        icon: '📖',
        branch: 'combat',
        maxLevel: 3,
        description: '+25% XP de combat',
        baseCost: 400,
        costScale: 4,
        baseTime: 900,       // 15 min
        timeScale: 4,
        requires: [{ tech: 'waveBreaker', level: 1 }],
        effect: { type: 'battleXP', perLevel: 25 },
    },

    // ─── ECONOMY ─────────────────────────────────────────
    {
        id: 'goldRush',
        name: 'Ruée vers l\'Or',
        icon: '💰',
        branch: 'economy',
        maxLevel: 5,
        description: '+20% or de vente',
        baseCost: 60,
        costScale: 4,
        baseTime: 120,       // 2 min
        timeScale: 4,
        requires: [],
        effect: { type: 'goldRush', perLevel: 20 },
    },
    {
        id: 'essenceStudy',
        name: 'Étude Efficace',
        icon: '🔮',
        branch: 'economy',
        maxLevel: 3,
        description: '+25% essence obtenue en étudiant',
        baseCost: 200,
        costScale: 4,
        baseTime: 480,       // 8 min
        timeScale: 4,
        requires: [{ tech: 'goldRush', level: 2 }],
        effect: { type: 'essenceStudy', perLevel: 25 },
    },
    {
        id: 'treasureHunter',
        name: 'Chercheur de Trésors',
        icon: '🗝️',
        branch: 'economy',
        maxLevel: 3,
        description: '10% chance d\'or bonus en forgeant',
        baseCost: 400,
        costScale: 4,
        baseTime: 900,       // 15 min
        timeScale: 4,
        requires: [{ tech: 'goldRush', level: 3 }],
        effect: { type: 'treasureHunter', perLevel: 10 },
    },
    {
        id: 'essenceResonance',
        name: 'Résonance d\'Essence',
        icon: '💠',
        branch: 'economy',
        maxLevel: 3,
        description: '-15% coût de recherche',
        baseCost: 500,
        costScale: 4,
        baseTime: 1200,      // 20 min
        timeScale: 4,
        requires: [{ tech: 'essenceStudy', level: 2 }],
        effect: { type: 'essenceResonance', perLevel: 15 },
    },
    {
        id: 'doubleHarvest',
        name: 'Double Récolte',
        icon: '🎰',
        branch: 'economy',
        maxLevel: 1,
        description: '5% chance: recevoir or ET essence',
        baseCost: 8000,
        costScale: 1,
        baseTime: 10800,     // 3h
        timeScale: 1,
        requires: [{ tech: 'essenceResonance', level: 2 }, { tech: 'treasureHunter', level: 2 }],
        effect: { type: 'doubleHarvest', perLevel: 5 },
    },

    // ─── AUTOMATION ──────────────────────────────────────
    {
        id: 'smartFilter',
        name: 'Filtre Intelligent',
        icon: '🧠',
        branch: 'automation',
        maxLevel: 3,
        description: 'Niv.1: filtre niveau min — Niv.2: filtre stats min — Niv.3: règles custom',
        baseCost: 150,
        costScale: 4,
        baseTime: 240,       // 4 min
        timeScale: 4,
        requires: [],
        effect: { type: 'smartFilter', perLevel: 1 },
    },
    {
        id: 'autoEquip',
        name: 'Auto-Équipement',
        icon: '🔄',
        branch: 'automation',
        maxLevel: 1,
        description: 'Auto-équipe si strictement meilleur',
        baseCost: 2000,
        costScale: 1,
        baseTime: 3600,      // 1h
        timeScale: 1,
        requires: [{ tech: 'smartFilter', level: 2 }],
        effect: { type: 'autoEquip', perLevel: 1 },
    },
    {
        id: 'researchQueue',
        name: 'File de Recherche',
        icon: '📋',
        branch: 'automation',
        maxLevel: 3,
        description: '+1 recherche en file d\'attente',
        baseCost: 300,
        costScale: 5,
        baseTime: 600,       // 10 min
        timeScale: 5,
        requires: [{ tech: 'smartFilter', level: 1 }],
        effect: { type: 'researchQueue', perLevel: 1 },
    },
    {
        id: 'autoStudy',
        name: 'Auto-Étude',
        icon: '📚',
        branch: 'automation',
        maxLevel: 1,
        description: 'L\'auto-forge peut auto-étudier pour l\'essence',
        baseCost: 120,
        costScale: 1,
        baseTime: 180,       // 3 min
        timeScale: 1,
        requires: [],
        effect: { type: 'autoStudy', perLevel: 1 },
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
