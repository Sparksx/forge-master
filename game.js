// Game State
const gameState = {
    equipment: {
        hat: null,
        armor: null,
        belt: null,
        boots: null,
        gloves: null,
        necklace: null,
        ring: null,
        weapon: null
    },
    forgedItem: null
};

// Equipment configuration
const EQUIPMENT_TYPES = ['hat', 'armor', 'belt', 'boots', 'gloves', 'necklace', 'ring', 'weapon'];
const HEALTH_ITEMS = ['hat', 'armor', 'belt', 'boots'];
const DAMAGE_ITEMS = ['gloves', 'necklace', 'ring', 'weapon'];

const EQUIPMENT_ICONS = {
    hat: '🎩',
    armor: '🛡️',
    belt: '📿',
    boots: '👢',
    gloves: '🧤',
    necklace: '📿',
    ring: '💍',
    weapon: '⚔️'
};

const BASE_HEALTH = 100;
const BASE_DAMAGE = 10;
const HEALTH_PER_LEVEL = 5;
const DAMAGE_PER_LEVEL = 2;

// Initialize game
function init() {
    loadGame();
    updateUI();

    // Event listeners
    document.getElementById('forge-btn').addEventListener('click', forgeEquipment);
    document.getElementById('equip-btn').addEventListener('click', equipItem);
    document.getElementById('sell-btn').addEventListener('click', sellItem);
}

// Generate random equipment
function forgeEquipment() {
    const randomType = EQUIPMENT_TYPES[Math.floor(Math.random() * EQUIPMENT_TYPES.length)];

    // Determine level based on current equipment
    const currentItem = gameState.equipment[randomType];
    let randomLevel;

    if (currentItem) {
        // Generate level within ±10 of current item level
        const minLevel = Math.max(1, currentItem.level - 10);
        const maxLevel = Math.min(100, currentItem.level + 10);
        randomLevel = Math.floor(Math.random() * (maxLevel - minLevel + 1)) + minLevel;
    } else {
        // No current item - generate level 1-10 for first item
        randomLevel = Math.floor(Math.random() * 10) + 1;
    }

    const item = createItem(randomType, randomLevel);
    gameState.forgedItem = item;

    showDecisionModal(item);
}

// Create item object
function createItem(type, level) {
    const isHealthItem = HEALTH_ITEMS.includes(type);
    const stats = isHealthItem ? level * HEALTH_PER_LEVEL : level * DAMAGE_PER_LEVEL;

    return {
        type: type,
        level: level,
        stats: stats,
        statType: isHealthItem ? 'health' : 'damage'
    };
}

// Show decision modal
function showDecisionModal(item) {
    const modal = document.getElementById('decision-modal');
    const itemInfo = document.getElementById('forged-item-info');
    const equipBtn = document.getElementById('equip-btn');
    const sellBtn = document.getElementById('sell-btn');

    const currentItem = gameState.equipment[item.type];
    const statLabel = item.statType === 'health' ? '❤️ Health' : '⚔️ Damage';

    if (currentItem) {
        // Player already has this type of equipment - show comparison
        itemInfo.innerHTML = `
            <div class="comparison-container">
                <div class="item-comparison current-item">
                    <div class="comparison-label">Current</div>
                    <div class="forged-type">${EQUIPMENT_ICONS[item.type]} ${capitalizeFirst(item.type)}</div>
                    <div class="forged-level">Level ${currentItem.level}</div>
                    <div class="forged-stat">${statLabel}: +${currentItem.stats}</div>
                </div>
                <div class="comparison-arrow">→</div>
                <div class="item-comparison new-item">
                    <div class="comparison-label">New</div>
                    <div class="forged-type">${EQUIPMENT_ICONS[item.type]} ${capitalizeFirst(item.type)}</div>
                    <div class="forged-level">Level ${item.level}</div>
                    <div class="forged-stat">${statLabel}: +${item.stats}</div>
                </div>
            </div>
        `;
        equipBtn.textContent = '✅ Equip New';
        sellBtn.textContent = '⏸️ Keep Current';
    } else {
        // No current equipment - show only new item
        itemInfo.innerHTML = `
            <div class="forged-type">${EQUIPMENT_ICONS[item.type]} ${capitalizeFirst(item.type)}</div>
            <div class="forged-level">Level ${item.level}</div>
            <div class="forged-stat">${statLabel}: +${item.stats}</div>
        `;
        equipBtn.textContent = '✅ Equip';
        sellBtn.textContent = '💰 Sell';
    }

    modal.classList.add('active');
}

// Hide decision modal
function hideDecisionModal() {
    const modal = document.getElementById('decision-modal');
    modal.classList.remove('active');
}

// Equip item
function equipItem() {
    const item = gameState.forgedItem;
    if (item) {
        gameState.equipment[item.type] = item;
        updateUI();
        saveGame();
    }
    hideDecisionModal();
}

// Sell item
function sellItem() {
    // For now, just discard the item
    // In future versions, we can add gold/currency
    hideDecisionModal();
}

// Update UI
function updateUI() {
    updateStats();
    updateEquipmentSlots();
}

// Update player stats
function updateStats() {
    let totalHealth = BASE_HEALTH;
    let totalDamage = BASE_DAMAGE;

    // Calculate stats from equipment
    Object.values(gameState.equipment).forEach(item => {
        if (item) {
            if (item.statType === 'health') {
                totalHealth += item.stats;
            } else {
                totalDamage += item.stats;
            }
        }
    });

    document.getElementById('total-health').textContent = totalHealth;
    document.getElementById('total-damage').textContent = totalDamage;
}

// Update equipment slots
function updateEquipmentSlots() {
    EQUIPMENT_TYPES.forEach(type => {
        const slotElement = document.getElementById(`slot-${type}`);
        const item = gameState.equipment[type];

        if (item) {
            const statLabel = item.statType === 'health' ? '❤️' : '⚔️';
            slotElement.innerHTML = `
                <div class="item-level">Level ${item.level}</div>
                <div class="item-stat ${item.statType === 'health' ? 'stat-health' : 'stat-damage'}">
                    ${statLabel} +${item.stats}
                </div>
            `;
        } else {
            slotElement.innerHTML = '<span class="empty-slot">Empty</span>';
        }
    });
}

// Save game to localStorage
function saveGame() {
    const saveData = JSON.stringify(gameState.equipment, null, 2);
    localStorage.setItem('forgemaster_save', saveData);
}

// Load game from storage
function loadGame() {
    try {
        const savedData = localStorage.getItem('forgemaster_save');
        if (savedData) {
            const loadedEquipment = JSON.parse(savedData);
            gameState.equipment = loadedEquipment;
        }
    } catch (error) {
        console.error('Error loading save:', error);
    }
}

// Utility function
function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Start the game when page loads
window.addEventListener('DOMContentLoaded', init);
