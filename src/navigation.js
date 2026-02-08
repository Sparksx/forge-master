const TAB_NAMES = ['skills', 'pets', 'home', 'dungeon', 'shop'];

export function initNavigation() {
    const nav = document.getElementById('bottom-nav');
    nav.addEventListener('click', (e) => {
        const tab = e.target.closest('.nav-tab');
        if (!tab) return;

        const tabName = tab.dataset.tab;
        if (tabName) switchTab(tabName);
    });
}

export function switchTab(tabName) {
    if (!TAB_NAMES.includes(tabName)) return;

    // Update nav buttons
    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update views
    document.querySelectorAll('.tab-view').forEach(view => {
        view.classList.toggle('active', view.id === `view-${tabName}`);
    });
}
