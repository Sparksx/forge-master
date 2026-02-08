const TAB_NAMES = ['pvp', 'dungeon', 'home', 'upgrade', 'shop'];

export function initNavigation() {
    const nav = document.getElementById('bottom-nav');
    nav.addEventListener('click', (e) => {
        const tab = e.target.closest('.nav-tab');
        if (!tab) return;

        const tabName = tab.dataset.tab;
        if (tabName) switchTab(tabName);
    });

    // Sub-tab navigation within Upgrade
    const upgradeNav = document.getElementById('upgrade-sub-nav');
    if (upgradeNav) {
        upgradeNav.addEventListener('click', (e) => {
            const btn = e.target.closest('.sub-tab');
            if (!btn) return;
            const subTab = btn.dataset.subtab;
            if (subTab) switchSubTab(subTab);
        });
    }
}

export function switchTab(tabName) {
    if (!TAB_NAMES.includes(tabName)) return;

    document.querySelectorAll('.nav-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    document.querySelectorAll('.tab-view').forEach(view => {
        view.classList.toggle('active', view.id === `view-${tabName}`);
    });
}

function switchSubTab(subTabName) {
    document.querySelectorAll('.sub-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.subtab === subTabName);
    });

    document.querySelectorAll('.sub-tab-content').forEach(view => {
        view.classList.toggle('active', view.id === `subtab-${subTabName}`);
    });
}
