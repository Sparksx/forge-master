import { EQUIPMENT_TYPES, EQUIPMENT_ICONS, BASE_HEALTH, BASE_DAMAGE } from './config.js';
import { getEquipment, getEquipmentByType } from './state.js';
import { calculateStats } from './forge.js';

function capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export function updateStats() {
    const equipment = getEquipment();
    const { totalHealth, totalDamage } = calculateStats(equipment);

    document.getElementById('total-health').textContent = BASE_HEALTH + totalHealth;
    document.getElementById('total-damage').textContent = BASE_DAMAGE + totalDamage;
}

export function updateEquipmentSlots() {
    EQUIPMENT_TYPES.forEach(type => {
        const slotElement = document.getElementById(`slot-${type}`);
        const item = getEquipmentByType(type);

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

export function updateUI() {
    updateStats();
    updateEquipmentSlots();
}

export function showDecisionModal(item) {
    const modal = document.getElementById('decision-modal');
    const itemInfo = document.getElementById('forged-item-info');
    const equipBtn = document.getElementById('equip-btn');
    const sellBtn = document.getElementById('sell-btn');

    const currentItem = getEquipmentByType(item.type);
    const statLabel = item.statType === 'health' ? '❤️ Health' : '⚔️ Damage';

    if (currentItem) {
        itemInfo.innerHTML = `
            <div class="comparison-container">
                <div class="item-comparison current-item">
                    <div class="comparison-label">Current</div>
                    <div class="forged-type">${EQUIPMENT_ICONS[item.type]} ${capitalizeFirst(item.type)}</div>
                    <div class="forged-level">Level ${currentItem.level}</div>
                    <div class="forged-stat">${statLabel}: +${currentItem.stats}</div>
                </div>
                <div class="comparison-arrow">&rarr;</div>
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

export function hideDecisionModal() {
    document.getElementById('decision-modal').classList.remove('active');
}
