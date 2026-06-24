// Clan screen — create/join a clan, contribute to the treasury, view roster & perks.
import { h, clear, fmt, toast, openModal, closeModal, confirmDialog } from './components.js';
import { CLAN_CREATE_COST, avatarEmoji } from '../game/config.js';
import { clanLevelProgress, treasuryForLevel } from '../../shared/clan-config.js';
import { getGold, spendGold } from '../game/state.js';
import { getCurrentUser } from '../auth.js';
import {
    listClans, createClan, joinClan, leaveClan, contribute,
    getMyClanCached, loadMyClan, hasLoadedClan, canUseClans,
} from '../game/clan.js';
import { gameEvents, EVENTS } from '../events.js';

let root = null;
let topClans = [];

export const id = 'clan';
export const icon = '🏰';
export const label = 'Clan';

export function render(container) {
    root = container;
    rerender();
    gameEvents.off(EVENTS.CLAN_CHANGED, rerender);
    gameEvents.on(EVENTS.CLAN_CHANGED, rerender);
}

export function onHide() {
    gameEvents.off(EVENTS.CLAN_CHANGED, rerender);
}

export async function onShow() {
    if (!canUseClans()) { rerender(); return; }
    if (!hasLoadedClan()) await loadMyClan();
    await refreshList();
    rerender();
}

async function refreshList() {
    try { topClans = await listClans(); } catch { topClans = []; }
}

function rerender() {
    if (!root) return;
    clear(root);
    if (!canUseClans()) {
        root.appendChild(h('div', { className: 'clan-screen' },
            h('div', { className: 'empty-state' }, h('p', { text: 'Sign in with an account to join clans.' }))));
        return;
    }
    const clan = getMyClanCached();
    root.appendChild(h('div', { className: 'clan-screen' }, clan ? buildMyClan(clan) : buildBrowse()));
}

// ── In a clan ───────────────────────────────────────────────────────────────
function buildMyClan(clan) {
    const prog = clanLevelProgress(clan.treasury);
    const me = getCurrentUser();
    const myRole = clan.members?.find((m) => m.userId === me?.id)?.role;

    return h('div', {},
        h('div', { className: 'clan-banner' },
            h('div', { className: 'clan-emblem', text: clan.emblem }),
            h('div', { className: 'clan-banner-info' },
                h('div', { className: 'clan-title' }, h('span', { className: 'clan-name', text: clan.name }), h('span', { className: 'clan-tag', text: `[${clan.tag}]` })),
                h('div', { className: 'clan-sub', text: `Level ${clan.level} · ${clan.memberCount} members · ${fmt(clan.totalPower)} total power` }),
                clan.description ? h('p', { className: 'clan-desc', text: clan.description }) : null,
            ),
        ),
        h('div', { className: 'clan-perks' },
            perkChip('💰', `+${clan.perks.goldBonusPct}% gold`),
            perkChip('🍀', `+${clan.perks.forgeLuckPct}% forge luck`),
            perkChip('👥', `${clan.perks.maxMembers} member cap`),
        ),
        h('div', { className: 'clan-treasury' },
            h('div', { className: 'treasury-head' },
                h('span', { text: `🏛️ Treasury: ${fmt(clan.treasury)} gold` }),
                h('span', { className: 'muted', text: prog.atMax ? 'Max level' : `Lv ${prog.level + 1} at ${fmt(treasuryForLevel(prog.level + 1))}` }),
            ),
            h('div', { className: 'treasury-bar' }, h('div', { className: 'treasury-fill', style: { width: `${Math.round(prog.pct * 100)}%` } })),
            h('button', { className: 'btn btn-primary btn-block', text: 'Contribute Gold', onclick: () => showContribute() }),
        ),
        h('div', { className: 'clan-roster' },
            h('h3', { text: 'Members' }),
            ...(clan.members || []).map((m) => renderMember(m)),
        ),
        h('button', { className: 'btn btn-danger btn-block', text: myRole === 'owner' ? 'Disband / Leave Clan' : 'Leave Clan', onclick: confirmLeave }),
    );
}

function perkChip(icon, text) {
    return h('div', { className: 'perk-chip' }, h('span', { text: icon }), h('span', { text }));
}

function renderMember(m) {
    return h('div', { className: 'clan-member' },
        h('span', { className: 'member-avatar', text: avatarEmoji(m.avatar) }),
        h('div', { className: 'member-info' },
            h('span', { className: 'member-name', text: m.username }, m.role === 'owner' ? h('span', { className: 'member-badge', text: ' 👑' }) : null),
            h('span', { className: 'member-sub', text: `${fmt(m.power)} power · ${fmt(m.contributed)}g given` }),
        ),
    );
}

function showContribute() {
    const input = h('input', { className: 'text-input', attrs: { type: 'number', min: '1', placeholder: 'Amount' } });
    const quick = (amt) => h('button', { className: 'btn btn-ghost', text: fmt(amt), onclick: () => { input.value = String(Math.min(amt, getGold())); } });
    const body = h('div', { className: 'contribute' },
        h('h3', { text: '🏛️ Contribute Gold' }),
        h('p', { className: 'muted', text: `You have ${fmt(getGold())} gold. Contributions raise the clan level and everyone's perks.` }),
        h('div', { className: 'quick-amounts' }, quick(100), quick(1000), quick(10000), quick(getGold())),
        input,
        h('div', { className: 'confirm-actions' },
            h('button', { className: 'btn btn-ghost', text: 'Cancel', onclick: closeModal }),
            h('button', { className: 'btn btn-primary', text: 'Contribute', onclick: async () => {
                const amount = Math.floor(Number(input.value));
                if (!amount || amount <= 0) { toast('Enter an amount', 'error'); return; }
                if (getGold() < amount) { toast('Not enough gold', 'error'); return; }
                spendGold(amount);
                try { await contribute(amount); closeModal(); toast(`Contributed ${fmt(amount)} gold!`, 'success'); }
                catch (err) { toast(err.message || 'Failed', 'error'); }
            } }),
        ),
    );
    openModal(body);
}

async function confirmLeave() {
    const ok = await confirmDialog({ title: 'Leave clan?', message: 'You will lose your contribution standing. If you are the owner, ownership passes to another member (or the clan disbands if empty).', confirmText: 'Leave' });
    if (!ok) return;
    try { await leaveClan(); await refreshList(); toast('Left clan', 'info'); }
    catch (err) { toast(err.message || 'Failed', 'error'); }
}

// ── Browsing / creating ─────────────────────────────────────────────────────
function buildBrowse() {
    const searchInput = h('input', { className: 'text-input', attrs: { type: 'text', placeholder: 'Search clans…' } });
    searchInput.addEventListener('input', debounce(async () => {
        try { topClans = await listClans(searchInput.value.trim()); renderClanList(); } catch { /* ignore */ }
    }, 300));

    const wrap = h('div', {},
        h('div', { className: 'clan-intro' },
            h('h2', { text: '🏰 Clans' }),
            h('p', { className: 'muted', text: 'Team up. Pool gold into a shared treasury to level the clan and grant everyone passive perks — more gold and better forge luck.' }),
            h('button', { className: 'btn btn-primary btn-block', text: `Create a Clan · ${fmt(CLAN_CREATE_COST)}g`, onclick: showCreate }),
        ),
        h('div', { className: 'clan-list-section' },
            h('div', { className: 'clan-list-head' }, h('h3', { text: 'Top Clans' }), searchInput),
            h('div', { className: 'clan-list', id: 'clan-list' }),
        ),
    );
    setTimeout(renderClanList, 0);
    return wrap;
}

function renderClanList() {
    const box = root.querySelector('#clan-list');
    if (!box) return;
    clear(box);
    if (!topClans || topClans.length === 0) { box.appendChild(h('p', { className: 'muted', text: 'No clans yet — create the first one!' })); return; }
    topClans.forEach((c) => box.appendChild(h('div', { className: 'clan-row' },
        h('span', { className: 'clan-row-emblem', text: c.emblem }),
        h('div', { className: 'clan-row-info' },
            h('span', { className: 'clan-row-name', text: `${c.name} [${c.tag}]` }),
            h('span', { className: 'clan-row-sub', text: `Lv ${c.level} · ${c.memberCount} members · ${fmt(c.totalPower)} power` }),
        ),
        h('button', { className: 'btn btn-primary btn-sm', text: 'Join', onclick: () => doJoin(c.id) }),
    )));
}

async function doJoin(clanId) {
    try { await joinClan(clanId); toast('Joined clan!', 'success'); }
    catch (err) { toast(err.message || 'Failed to join', 'error'); }
}

function showCreate() {
    if (getGold() < CLAN_CREATE_COST) { toast(`Need ${fmt(CLAN_CREATE_COST)} gold to found a clan`, 'error'); return; }
    const EMBLEMS = ['⚔️', '🛡️', '🐉', '🔥', '💀', '👑', '🐺', '⭐', '🦅', '🦁'];
    let emblem = EMBLEMS[0];
    const nameI = h('input', { className: 'text-input', attrs: { type: 'text', maxlength: '30', placeholder: 'Clan name (3–30 chars)' } });
    const tagI = h('input', { className: 'text-input', attrs: { type: 'text', maxlength: '5', placeholder: 'TAG (2–5)' } });
    const descI = h('input', { className: 'text-input', attrs: { type: 'text', maxlength: '200', placeholder: 'Description (optional)' } });
    const emblemRow = h('div', { className: 'emblem-row' });
    EMBLEMS.forEach((e, i) => {
        const b = h('button', { className: `emblem-opt${i === 0 ? ' selected' : ''}`, text: e, onclick: () => {
            emblem = e; emblemRow.querySelectorAll('.emblem-opt').forEach((x) => x.classList.remove('selected')); b.classList.add('selected');
        } });
        emblemRow.appendChild(b);
    });

    const body = h('div', { className: 'create-clan' },
        h('h3', { text: '🏰 Found a Clan' }),
        h('label', { className: 'field-label', text: 'Emblem' }), emblemRow,
        h('label', { className: 'field-label', text: 'Name' }), nameI,
        h('label', { className: 'field-label', text: 'Tag' }), tagI,
        h('label', { className: 'field-label', text: 'Description' }), descI,
        h('div', { className: 'confirm-actions' },
            h('button', { className: 'btn btn-ghost', text: 'Cancel', onclick: closeModal }),
            h('button', { className: 'btn btn-primary', text: `Create · ${fmt(CLAN_CREATE_COST)}g`, onclick: async () => {
                const name = nameI.value.trim(); const tag = tagI.value.trim();
                if (name.length < 3) { toast('Name must be 3+ characters', 'error'); return; }
                if (!/^[A-Za-z0-9]{2,5}$/.test(tag)) { toast('Tag must be 2–5 letters/numbers', 'error'); return; }
                if (getGold() < CLAN_CREATE_COST) { toast('Not enough gold', 'error'); return; }
                try {
                    await createClan({ name, tag, emblem, description: descI.value.trim() });
                    spendGold(CLAN_CREATE_COST);
                    closeModal();
                    toast('Clan founded! ⚔️', 'success');
                } catch (err) { toast(err.message || 'Failed to create clan', 'error'); }
            } }),
        ),
    );
    openModal(body);
}

function debounce(fn, ms) {
    let t;
    return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}
