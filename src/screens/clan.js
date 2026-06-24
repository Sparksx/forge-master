// Clan screen — create/join, the clan bank, cooperative Expeditions & Missions,
// member ranks, roster & perks.
import { h, clear, fmt, toast, openModal, closeModal, confirmDialog } from './components.js';
import { CLAN_CREATE_COST, avatarEmoji } from '../game/config.js';
import { getGold, spendGold, creditServerGold } from '../game/state.js';
import { getCurrentUser } from '../auth.js';
import {
    listClans, createClan, joinClan, leaveClan,
    getMyClanCached, loadMyClan, hasLoadedClan, canUseClans,
    listExpeditions, startExpedition, joinExpedition, cancelExpedition, refreshMyClan,
    listMissions, startMission,
    promoteMember, demoteMember, kickMember, transferLeadership,
} from '../game/clan.js';
import { can, rankInfo, nextRankUp, nextRankDown } from '../../shared/clan-ranks.js';
import {
    maxActiveExpeditions, expeditionSlots, expeditionPlan, clampExpeditionHours,
    EXPEDITION_MIN_HOURS, EXPEDITION_MAX_HOURS,
} from '../../shared/clan-activities.js';
import { gameEvents, EVENTS } from '../events.js';

let root = null;
let topClans = [];
let activeTab = 'overview';
let expeditionsData = null;
let missionsData = null;
let timerInterval = null;
// Expeditions we've observed as 'active' this session, so we can tell when one
// flips to 'resolved' on a later poll and refresh the (now-stale) clan XP banner.
const seenActiveExpeditions = new Set();

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
    stopTimers();
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
    stopTimers();
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
function myMember(clan) {
    const me = getCurrentUser();
    return clan.members?.find((m) => m.userId === me?.id) || null;
}

function buildMyClan(clan) {
    const prog = clan.xpProgress || { level: clan.level, pct: 0, atMax: false };
    const myRole = myMember(clan)?.role || 'member';

    const tabs = h('div', { className: 'clan-tabs' },
        tabBtn('overview', '🏰 Overview'),
        tabBtn('expeditions', '🗺️ Expeditions'),
        tabBtn('missions', '🎯 Missions'),
        tabBtn('members', '👥 Members'),
    );

    const panel = h('div', { className: 'clan-tab-panel' });

    const wrap = h('div', {},
        h('div', { className: 'clan-banner' },
            h('div', { className: 'clan-emblem', text: clan.emblem }),
            h('div', { className: 'clan-banner-info' },
                h('div', { className: 'clan-title' }, h('span', { className: 'clan-name', text: clan.name }), h('span', { className: 'clan-tag', text: `[${clan.tag}]` })),
                h('div', { className: 'clan-sub', text: `Level ${clan.level} · ${clan.memberCount} members · ${fmt(clan.totalPower)} total power` }),
                clan.description ? h('p', { className: 'clan-desc', text: clan.description }) : null,
            ),
        ),
        h('div', { className: 'clan-xp' },
            h('div', { className: 'clan-xp-head' },
                h('span', { text: `⭐ Clan XP: ${fmt(clan.xp)}` }),
                h('span', { className: 'muted', text: prog.atMax ? 'Max level' : `${Math.round(prog.pct * 100)}% to Lv ${prog.level + 1}` }),
            ),
            h('div', { className: 'treasury-bar' }, h('div', { className: 'treasury-fill', style: { width: `${Math.round((prog.pct || 0) * 100)}%` } })),
        ),
        tabs,
        panel,
    );

    renderTab(panel, clan, myRole);
    return wrap;
}

function tabBtn(key, label) {
    return h('button', {
        className: `clan-tab${activeTab === key ? ' active' : ''}`,
        text: label,
        onclick: () => {
            activeTab = key;
            rerender();
        },
    });
}

function renderTab(panel, clan, myRole) {
    clear(panel);
    if (activeTab === 'overview') panel.appendChild(buildOverview(clan, myRole));
    else if (activeTab === 'expeditions') panel.appendChild(buildExpeditions(clan, myRole));
    else if (activeTab === 'missions') panel.appendChild(buildMissions(clan, myRole));
    else if (activeTab === 'members') panel.appendChild(buildMembers(clan, myRole));
}

// ── Overview ──────────────────────────────────────────────────────────────────
function buildOverview(clan, myRole) {
    const p = clan.perks;
    return h('div', {},
        h('div', { className: 'clan-perks' },
            perkChip('💰', `+${p.goldBonusPct}% gold`),
            perkChip('🍀', `+${p.forgeLuckPct}% forge luck`),
            perkChip('⚒️', `+${p.forgeSpeedPct}% forge speed`),
            perkChip('🎲', `Best of ${p.forgeBestOf} forge`),
            perkChip('💪', `+${p.statBonusPct}% HP & damage`),
            perkChip('👥', `${p.maxMembers} member cap`),
        ),
        h('p', { className: 'muted small clan-perks-note', text: 'Level the clan by playing together — expeditions and missions earn clan XP (never gold) and unlock these perks for everyone.' }),
        h('button', { className: 'btn btn-danger btn-block', text: myRole === 'owner' ? 'Disband / Leave Clan' : 'Leave Clan', onclick: confirmLeave }),
    );
}

function perkChip(icon, text) {
    return h('div', { className: 'perk-chip' }, h('span', { text: icon }), h('span', { text }));
}

// ── Expeditions ───────────────────────────────────────────────────────────────
function buildExpeditions(clan, myRole) {
    const box = h('div', { className: 'clan-activities' },
        h('p', { className: 'muted small', text: 'Send members on timed runs. Fill the slots with power to boost the odds — success pays clan XP and gold to everyone aboard.' }),
        h('div', { className: 'activity-list', id: 'expedition-list' }, h('p', { className: 'muted', text: 'Loading…' })),
    );
    if (can(myRole, 'startActivity')) {
        box.insertBefore(
            h('button', { className: 'btn btn-primary btn-block', text: '🗺️ Launch Expedition', onclick: () => showStartExpedition(clan) }),
            box.querySelector('#expedition-list'),
        );
    }
    loadExpeditions();
    return box;
}

async function loadExpeditions() {
    try { expeditionsData = await listExpeditions(); } catch { expeditionsData = null; }
    handleExpeditionResolutions();
    renderExpeditionList();
}

/**
 * Reconcile the effects of any expedition that resolved server-side on this poll:
 *  - credit the reward gold the server granted us (else our next save clobbers it),
 *  - refresh the clan so the XP banner reflects the just-earned clan XP.
 * Both are gated so they fire once per resolution, not on every poll.
 */
function handleExpeditionResolutions() {
    const exps = expeditionsData?.expeditions || [];
    let justResolved = false;
    for (const e of exps) {
        if (e.status === 'resolved' && seenActiveExpeditions.has(e.id)) {
            seenActiveExpeditions.delete(e.id);
            justResolved = true;
        }
    }
    for (const e of exps) if (e.status === 'active') seenActiveExpeditions.add(e.id);

    const gained = Math.floor(Number(expeditionsData?.goldGained) || 0);
    if (gained > 0) {
        creditServerGold(gained);
        toast(`Expedition paid ${fmt(gained)} gold!`, 'success');
    }
    // A server-side resolution moved clan XP; pull the fresh clan into the banner.
    // (refreshMyClan emits CLAN_CHANGED → rerender; the resolved id is already out
    // of seenActiveExpeditions, so the re-fetch won't loop.)
    if (justResolved || gained > 0) refreshMyClan();
}

function renderExpeditionList() {
    const list = root?.querySelector('#expedition-list');
    if (!list) return;
    clear(list);
    const items = (expeditionsData?.expeditions || []).filter((e) => e.status === 'active');
    const done = (expeditionsData?.expeditions || []).filter((e) => e.status === 'resolved').slice(0, 3);
    if (!items.length && !done.length) {
        list.appendChild(h('p', { className: 'muted', text: 'No expeditions running. Launch one!' }));
        return;
    }
    const myUserId = expeditionsData?.myUserId;
    const myRole = expeditionsData?.myRole;
    items.forEach((e) => list.appendChild(renderExpeditionCard(e, myUserId, myRole)));
    if (done.length) {
        list.appendChild(h('h4', { className: 'activity-subhead', text: 'Recent' }));
        done.forEach((e) => list.appendChild(renderResolvedExpedition(e)));
    }
    startTimers();
}

function renderExpeditionCard(e, myUserId, myRole) {
    const joined = (e.members || []).some((m) => m.userId === myUserId);
    const full = e.filled >= e.slots;
    const powerPct = Math.min(100, Math.round((e.totalPower / Math.max(1, e.powerReq)) * 100));
    const each = e.filled > 0 ? Math.round(e.rewardGold / e.filled) : e.rewardGold;
    // The launcher can always call off their own run; leadership can cancel any.
    const canCancel = e.startedBy === myUserId || can(myRole, 'cancelActivity');
    return h('div', { className: 'activity-card' },
        h('div', { className: 'activity-head' },
            h('span', { className: 'activity-name', text: `${e.name} · ${e.difficulty}` }),
            h('span', { className: 'activity-timer', dataset: { ends: String(new Date(e.endsAt).getTime()) }, text: fmtDuration(e.msLeft) }),
        ),
        h('div', { className: 'activity-sub muted', text: `${e.filled}/${e.slots} slots · ${fmt(e.totalPower)}/${fmt(e.powerReq)} power (${powerPct}%) · 🏆 ${fmt(e.rewardXp)} clan XP · ${fmt(e.rewardGold)}g pot (~${fmt(each)}g each)` }),
        h('div', { className: 'activity-bar' }, h('div', { className: 'activity-fill', style: { width: `${powerPct}%` } })),
        joined
            ? h('button', { className: 'btn btn-ghost btn-sm btn-block', text: '✓ Registered', attrs: { disabled: 'true' } })
            : h('button', { className: 'btn btn-primary btn-sm btn-block', text: full ? 'Full' : 'Join Expedition', attrs: full ? { disabled: 'true' } : {}, onclick: () => doJoinExpedition(e.id) }),
        canCancel ? h('button', { className: 'btn btn-ghost btn-sm btn-block activity-cancel', text: '✕ Cancel expedition', onclick: () => doCancelExpedition(e.id) }) : null,
    );
}

function renderResolvedExpedition(e) {
    return h('div', { className: `activity-card resolved ${e.success ? 'win' : 'loss'}` },
        h('div', { className: 'activity-head' },
            h('span', { className: 'activity-name', text: `${e.name}` }),
            h('span', { text: e.success ? '✅ Success' : '❌ Failed' }),
        ),
        h('div', { className: 'activity-sub muted', text: `${e.filled} members · ${e.success ? `${fmt(e.rewardGold)}g pot split` : 'salvaged a little'}` }),
    );
}

async function doJoinExpedition(id) {
    try { await joinExpedition(id); toast('Joined the expedition!', 'success'); await loadExpeditions(); }
    catch (err) { toast(err.message || 'Failed to join', 'error'); }
}

async function doCancelExpedition(id) {
    const ok = await confirmDialog({
        title: 'Cancel expedition?',
        message: 'Everyone registered will be released and the run ends with no reward. This cannot be undone.',
        confirmText: 'Cancel run',
        cancelText: 'Keep going',
    });
    if (!ok) return;
    try { await cancelExpedition(id); toast('Expedition cancelled', 'info'); await loadExpeditions(); }
    catch (err) { toast(err.message || 'Failed to cancel', 'error'); }
}

function showStartExpedition(clan) {
    const catalog = expeditionsData?.catalog || [];
    // Running expeditions only (expired-but-unresolved ones don't count toward the cap).
    const running = (expeditionsData?.expeditions || []).filter((e) => e.status === 'active' && e.msLeft > 0).length;
    const cap = maxActiveExpeditions(clan.level);
    const atCap = running >= cap;
    const slots = expeditionSlots(clan.memberCount);
    let hours = clampExpeditionHours(4); // sensible default within the allowed band

    const durValue = h('span', { className: 'muted', text: `${hours}h` });
    const slider = h('input', {
        className: 'range-input',
        attrs: { type: 'range', min: String(EXPEDITION_MIN_HOURS), max: String(EXPEDITION_MAX_HOURS), step: '1', value: String(hours) },
    });
    const tierList = h('div', { className: 'expedition-tiers' });

    const renderTiers = () => {
        clear(tierList);
        catalog.forEach((def) => {
            const plan = expeditionPlan(def, hours, slots);
            const each = Math.round(plan.rewardGold / slots);
            const locked = clan.level < def.minClanLevel;
            const disabled = locked || atCap;
            tierList.appendChild(h('button', {
                className: 'btn btn-ghost btn-block activity-pick',
                attrs: disabled ? { disabled: 'true' } : {},
                onclick: async () => {
                    try { await startExpedition(def.key, hours); closeModal(); toast(`${def.name} launched!`, 'success'); await loadExpeditions(); }
                    catch (err) { toast(err.message || 'Failed', 'error'); }
                },
            },
                h('div', { className: 'activity-pick-name', text: `${def.name} · ${def.difficulty}${locked ? ` · 🔒 Lv ${def.minClanLevel}` : ''}` }),
                h('div', { className: 'muted small', text: `${slots} slots · ${hours}h · 🏆 ${fmt(plan.rewardXp)} clan XP · ${fmt(plan.rewardGold)}g pot (~${fmt(each)}g each)` }),
            ));
        });
    };

    slider.addEventListener('input', () => {
        hours = clampExpeditionHours(slider.value);
        durValue.textContent = `${hours}h`;
        renderTiers();
    });
    renderTiers();

    const body = h('div', { className: 'start-activity' },
        h('h3', { text: '🗺️ Launch an Expedition' }),
        h('p', { className: 'muted', text: `Free to launch · ${running}/${cap} running · ${slots} slots (scales with clan size)` }),
        h('div', { className: 'expedition-duration' },
            h('div', { className: 'activity-head' }, h('span', { text: '⏱️ Duration' }), durValue),
            slider,
            h('p', { className: 'muted small', text: 'Longer runs pay better per hour (a duration bonus). Gold is a small shared pot, split across everyone who joins.' }),
        ),
        tierList,
        atCap ? h('p', { className: 'muted small', text: `Max ${cap} expedition${cap === 1 ? '' : 's'} running — level the clan to run more at once.` }) : null,
        h('button', { className: 'btn btn-ghost btn-block', text: 'Close', onclick: closeModal }),
    );
    openModal(body);
}

// ── Missions ──────────────────────────────────────────────────────────────────
function buildMissions(clan, myRole) {
    const box = h('div', { className: 'clan-activities' },
        h('p', { className: 'muted small', text: 'Clan goals that everyone chips away at just by playing. Complete them for clan XP.' }),
        h('div', { className: 'activity-list', id: 'mission-list' }, h('p', { className: 'muted', text: 'Loading…' })),
    );
    if (can(myRole, 'startActivity')) {
        box.insertBefore(
            h('button', { className: 'btn btn-primary btn-block', text: '🎯 Start a Mission', onclick: () => showStartMission() }),
            box.querySelector('#mission-list'),
        );
    }
    loadMissions();
    return box;
}

async function loadMissions() {
    try { missionsData = await listMissions(); } catch { missionsData = null; }
    renderMissionList();
}

function renderMissionList() {
    const list = root?.querySelector('#mission-list');
    if (!list) return;
    clear(list);
    const active = (missionsData?.missions || []).filter((m) => m.status === 'active');
    const done = (missionsData?.missions || []).filter((m) => m.status === 'completed').slice(0, 3);
    if (!active.length && !done.length) {
        list.appendChild(h('p', { className: 'muted', text: 'No missions yet. Start one!' }));
        return;
    }
    active.forEach((m) => list.appendChild(renderMissionCard(m)));
    if (done.length) {
        list.appendChild(h('h4', { className: 'activity-subhead', text: 'Completed' }));
        done.forEach((m) => list.appendChild(h('div', { className: 'activity-card resolved win' },
            h('div', { className: 'activity-head' }, h('span', { className: 'activity-name', text: m.name }), h('span', { text: `✅ +${fmt(m.rewardXp)} XP` })))));
    }
}

function renderMissionCard(m) {
    const pct = Math.min(100, Math.round((m.progress / Math.max(1, m.target)) * 100));
    const top = (m.topContributors || []).map((c) => `${c.username} (${fmt(c.amount)})`).join(', ');
    return h('div', { className: 'activity-card' },
        h('div', { className: 'activity-head' },
            h('span', { className: 'activity-name', text: m.name }),
            h('span', { className: 'muted', text: `🏆 ${fmt(m.rewardXp)} XP` }),
        ),
        h('div', { className: 'activity-sub muted', text: m.desc }),
        h('div', { className: 'activity-bar' }, h('div', { className: 'activity-fill', style: { width: `${pct}%` } })),
        h('div', { className: 'activity-sub muted', text: `${fmt(m.progress)} / ${fmt(m.target)}${top ? ` · top: ${top}` : ''}` }),
    );
}

function showStartMission() {
    const catalog = missionsData?.catalog || [];
    const activeKeys = new Set((missionsData?.missions || []).filter((m) => m.status === 'active').map((m) => m.defKey));
    const body = h('div', { className: 'start-activity' },
        h('h3', { text: '🎯 Start a Mission' }),
        ...catalog.map((def) => h('button', {
            className: 'btn btn-ghost btn-block activity-pick',
            attrs: activeKeys.has(def.key) ? { disabled: 'true' } : {},
            onclick: async () => {
                try { await startMission(def.key); closeModal(); toast(`${def.name} started!`, 'success'); await loadMissions(); }
                catch (err) { toast(err.message || 'Failed', 'error'); }
            },
        },
            h('div', { className: 'activity-pick-name', text: `${def.name}${activeKeys.has(def.key) ? ' (active)' : ''}` }),
            h('div', { className: 'muted small', text: `${def.desc} · 🏆 ${fmt(def.rewardXp)} XP` }),
        )),
        h('button', { className: 'btn btn-ghost btn-block', text: 'Close', onclick: closeModal }),
    );
    openModal(body);
}

// ── Members & ranks ───────────────────────────────────────────────────────────
function buildMembers(clan, myRole) {
    return h('div', { className: 'clan-roster' },
        ...(clan.members || []).map((m) => renderMember(m, myRole)),
    );
}

function renderMember(m, myRole) {
    const info = rankInfo(m.role);
    const actions = h('div', { className: 'member-actions' });
    if (can(myRole, 'promote', m.role) && nextRankUp(m.role)) {
        actions.appendChild(h('button', { className: 'icon-btn', attrs: { title: 'Promote' }, text: '⬆️', onclick: () => doRank(promoteMember, m, `Promoted ${m.username}`) }));
    }
    if (can(myRole, 'demote', m.role) && nextRankDown(m.role)) {
        actions.appendChild(h('button', { className: 'icon-btn', attrs: { title: 'Demote' }, text: '⬇️', onclick: () => doRank(demoteMember, m, `Demoted ${m.username}`) }));
    }
    if (myRole === 'owner' && m.role !== 'owner') {
        actions.appendChild(h('button', { className: 'icon-btn', attrs: { title: 'Make Leader' }, text: '👑', onclick: () => confirmTransfer(m) }));
    }
    if (can(myRole, 'kick', m.role)) {
        actions.appendChild(h('button', { className: 'icon-btn danger', attrs: { title: 'Kick' }, text: '✕', onclick: () => confirmKick(m) }));
    }
    return h('div', { className: 'clan-member' },
        h('span', { className: 'member-avatar', text: avatarEmoji(m.avatar) }),
        h('div', { className: 'member-info' },
            h('span', { className: 'member-name', text: m.username }, h('span', { className: 'member-badge', text: ` ${info.icon}` })),
            h('span', { className: 'member-sub', text: `${info.name} · ${fmt(m.power)} power · ${fmt(m.xpContributed || 0)} clan XP` }),
        ),
        actions,
    );
}

async function doRank(fn, m, okMsg) {
    try { await fn(m.userId); toast(okMsg, 'success'); }
    catch (err) { toast(err.message || 'Failed', 'error'); }
}

async function confirmKick(m) {
    const ok = await confirmDialog({ title: `Kick ${m.username}?`, message: 'They will be removed from the clan.', confirmText: 'Kick' });
    if (!ok) return;
    try { await kickMember(m.userId); toast(`Kicked ${m.username}`, 'info'); }
    catch (err) { toast(err.message || 'Failed', 'error'); }
}

async function confirmTransfer(m) {
    const ok = await confirmDialog({ title: `Make ${m.username} the Leader?`, message: "You'll step down to Co-Leader. This can't be undone without the new Leader's help.", confirmText: 'Transfer' });
    if (!ok) return;
    try { await transferLeadership(m.userId); toast(`${m.username} is now the Leader`, 'success'); }
    catch (err) { toast(err.message || 'Failed', 'error'); }
}

// ── Live countdown timers ─────────────────────────────────────────────────────
function startTimers() {
    stopTimers();
    timerInterval = setInterval(() => {
        const cells = root?.querySelectorAll('.activity-timer');
        if (!cells || !cells.length) { stopTimers(); return; }
        let anyExpired = false;
        cells.forEach((cell) => {
            const left = Number(cell.dataset.ends) - Date.now();
            if (left <= 0) { cell.textContent = 'resolving…'; anyExpired = true; }
            else cell.textContent = fmtDuration(left);
        });
        if (anyExpired) { stopTimers(); setTimeout(loadExpeditions, 1500); }
    }, 1000);
}

function stopTimers() {
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
}

function fmtDuration(ms) {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h2 = Math.floor(s / 3600);
    const m2 = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h2 > 0) return `${h2}h ${m2}m`;
    if (m2 > 0) return `${m2}m ${sec}s`;
    return `${sec}s`;
}

async function confirmLeave() {
    const ok = await confirmDialog({ title: 'Leave clan?', message: 'You will lose your standing. If you are the Leader, leadership passes to another member (or the clan disbands if empty).', confirmText: 'Leave' });
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
            h('p', { className: 'muted', text: 'Team up. Run cooperative expeditions and missions to earn clan XP, level the clan, and grant everyone passive perks — gold, forge luck & speed, best-of forge, and bonus HP & damage. No pay-to-win: gold never buys clan power.' }),
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
