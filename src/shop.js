import { addGold } from './state.js';
import { gameEvents, EVENTS } from './events.js';

export const SHOP_OFFERS = [
    { id: 'pouch', name: 'Pouch of Gold', icon: '👛', gold: 100, price: '0.99$' },
    { id: 'chest', name: 'Chest of Gold', icon: '📦', gold: 500, price: '4.99$' },
    { id: 'treasury', name: 'Treasury', icon: '🏦', gold: 2000, price: '14.99$' },
    { id: 'hoard', name: 'Dragon Hoard', icon: '🐉', gold: 10000, price: '49.99$' },
];

export function purchaseGold(offerId) {
    const offer = SHOP_OFFERS.find(o => o.id === offerId);
    if (!offer) return;

    addGold(offer.gold);
    gameEvents.emit(EVENTS.GOLD_PURCHASED, { offer });
}

export function initShop() {
    const container = document.getElementById('shop-offers');
    if (!container) return;

    container.addEventListener('click', (e) => {
        const card = e.target.closest('.shop-card');
        if (!card) return;

        const offerId = card.dataset.offer;
        if (offerId) {
            purchaseGold(offerId);
            showPurchaseFeedback(card);
        }
    });
}

function showPurchaseFeedback(card) {
    card.classList.add('purchased');
    setTimeout(() => card.classList.remove('purchased'), 600);
}
