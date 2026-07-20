export const DEFAULT_GAME_STATE = {
    equipment: {},
    gold: 100,
    diamonds: 100,
    forgeLevel: 1,
    combat: { currentWave: 1, currentSubWave: 1, highestWave: 1, highestSubWave: 1 },
    essence: 0,
    player: { level: 1, xp: 0, profilePicture: 'wizard' },
    research: { completed: {}, active: null, queue: [] },
    forgeHighestLevel: {},
    skills: { unlocked: {}, equipped: [] },
};
