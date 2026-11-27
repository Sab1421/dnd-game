// ================================================================
// 🏠 ГЛАВНАЯ (3 КОЛОНКИ: СТАРТ/ОБНОВЛЕНИЯ | ЛЕНТА | ОБЩИЙ ЧАТ),
// ПРОФИЛЬ, ВКЛАДКА «ИГРАТЬ» И ЛИЧКА ПОЛЬЗОВАТЕЛЕЙ (home_hub.js)
// ================================================================
(function INIT_HOME_HUB_V2() {
    const FB_ROOT = "https://dnds-23b7d-default-rtdb.firebaseio.com/campaign_v2";
    const MY_HUB_CLIENT_ID = 'hub_' + Math.random().toString(36).slice(2, 8) + '_' + Date.now();
    const DM_READ_LS_KEY = 'dnd_user_dm_last_read_v1';

    const STATUS_PRESETS = [
        '🎲 Ищу партию',
        '⚔️ Готов играть',
        '👑 Вожу кампанию',
        '🛠️ Настраиваю билд',
        '☕ Отдыхаю в таверне'
    ];

    const ROLE_PREFS = [
        { id: 'both',   label: '🎭 Игрок и Гейм-Мастер' },
        { id: 'player', label: '⚔️ Предпочитаю играть (Игрок)' },
        { id: 'gm',     label: '👑 Предпочитаю водить (Гейм-Мастер)' }
    ];

    const FEED_TAGS = [
        { id: 'post',   label: '💬 Пост' },
        { id: 'lfg',    label: '🎲 Поиск партии' },
        { id: 'idea',   label: '💡 Идея / Обсуждение' }
    ];

    window._hubMainTab = window._hubMainTab || 'home'; // 'home' | 'profile' | 'play'
    window._hubEditingProfile = false;
    window._hubProfilesCache = {};
    window._hubGlobalChat = [];
    window._hubFeedPosts = [];
    window._hubFeedFilter = 'all';     // 'all' | 'posts' | 'templates' | 'updates'
    window._hubOnlineUsers = {};

    // Состояние лички пользователей (аккаунт -> аккаунт)
    window._hubDmInbox = {};           // { [peerKey]: { peer, lastText, lastTs, lastFrom } }
    window._hubDmActivePeer = null;
    window._hubDmMessages = [];
    window._hubDmSearch = '';
    window._hubDmMobView = 'list';     // 'list' | 'chat'

    let hubPresenceRef = null;
    let hubCloudBound = false;
    let dmInboxOwner = '';
    let dmInboxRef = null;
    let dmInboxInitialLoaded = false;
    let dmThreadRef = null;
    let dmThreadIdActive = '';
    let dmToastTimer = null;

    const ESC = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const ESC_JS = s => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const SAFE_KEY = s => String(s || '').toLowerCase().trim().replace(/[.#$\[\]\/]/g, '_');

    const CUR_USER = () => (typeof GET_CURRENT_USER === 'function') ? GET_CURRENT_USER() : null;
    const CUR_LOGIN_KEY = () => { const u = CUR_USER(); return u && u.login ? SAFE_KEY(u.login) : ''; };

    function DM_THREAD_ID(a, b) {
        return [SAFE_KEY(a), SAFE_KEY(b)].sort().join('__');
    }

    function GET_DM_READ_MAP() {
        try { return JSON.parse(localStorage.getItem(DM_READ_LS_KEY) || '{}') || {}; } catch (e) { return {}; }
    }

    function SET_DM_READ(threadId, ts) {
        const myKey = CUR_LOGIN_KEY();
        if (!myKey || !threadId) return;
        const map = GET_DM_READ_MAP();
        map[`${myKey}:${threadId}`] = Math.max(Number(map[`${myKey}:${threadId}`] || 0), Number(ts || Date.now()));
        try { localStorage.setItem(DM_READ_LS_KEY, JSON.stringify(map)); } catch (e) {}
    }

    function GET_DM_READ_TS(threadId) {
        const myKey = CUR_LOGIN_KEY();
        if (!myKey || !threadId) return 0;
        return Number(GET_DM_READ_MAP()[`${myKey}:${threadId}`] || 0);
    }

    function GET_PROFILE(login) {
        const key = SAFE_KEY(login);
        const accounts = (typeof GET_ACCOUNTS === 'function') ? GET_ACCOUNTS() : {};
        const acc = accounts[key] || {};
        const prof = window._hubProfilesCache[key] || {};
        return {
            login: key,
            displayName: prof.displayName || acc.displayName || acc.login || login || 'Игрок',
            avatar: prof.avatar || '',
            status: prof.status || '☕ Отдыхаю в таверне',
            bio: prof.bio || '',
            favRole: prof.favRole || 'both',
            favClass: prof.favClass || '',
            createdAt: acc.createdAt || prof.createdAt || ''
        };
    }

    function IS_USER_ONLINE(loginKey) {
        const k = SAFE_KEY(loginKey);
        if (!k) return false;
        if (k === CUR_LOGIN_KEY()) return true;
        return Object.values(window._hubOnlineUsers || {}).some(u => u && SAFE_KEY(u.login) === k);
    }

    function SAVE_MY_PROFILE(patch) {
        const u = CUR_USER();
        if (!u || !u.login) return;
        const key = SAFE_KEY(u.login);
        const next = Object.assign({}, GET_PROFILE(key), patch, { updatedAt: Date.now() });
        window._hubProfilesCache[key] = next;
        try { localStorage.setItem('dnd_hub_profiles_v1', JSON.stringify(window._hubProfilesCache)); } catch (e) {}

        if (patch.displayName && patch.displayName !== u.displayName) {
            u.displayName = patch.displayName;
            if (typeof SAVE_CURRENT_USER === 'function') SAVE_CURRENT_USER(u);
            if (typeof GET_ACCOUNTS === 'function' && typeof SAVE_ACCOUNTS === 'function') {
                const accs = GET_ACCOUNTS();
                if (accs[key]) { accs[key].displayName = patch.displayName; SAVE_ACCOUNTS(accs); }
            }
        }

        if (window.firebase && firebase.apps && firebase.apps.length) {
            firebase.database().ref(`campaign_v2/user_profiles/${key}`).set(next).catch(() => {});
        } else {
            fetch(`${FB_ROOT}/user_profiles/${encodeURIComponent(key)}.json`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(next)
            }).catch(() => {});
        }
        PUBLISH_HUB_PRESENCE();
    }

    // --- 1. СТИЛИ ХАБА И ЛИЧКИ ПОЛЬЗОВАТЕЛЕЙ ---
    function ENSURE_HUB_CSS() {
        let st = document.getElementById('home-hub-css');
        if (!st) {
            st = document.createElement('style');
            st.id = 'home-hub-css';
            document.head.appendChild(st);
        }
        st.textContent = `
            .hub-shell { max-width: 1140px; margin: 10px auto 24px auto; }
            .hub-shell.is-wide { max-width: 1520px; }
            .hub-nav-bar {
                background: var(--ui-panel, #221f1c);
                border: 1px solid var(--ui-border-strong, #695c4c);
                border-radius: 12px;
                padding: 10px 14px;
                margin-bottom: 14px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 10px;
                box-shadow: var(--ui-shadow, 0 4px 14px rgba(0,0,0,0.34));
            }
            .hub-tabs-group {
                display: flex; gap: 6px;
                background: var(--ui-panel2, #161412);
                border: 1px solid var(--ui-border, #3e372f);
                border-radius: 9px; padding: 4px; flex-wrap: wrap;
            }
            .hub-tab-btn {
                padding: 7px 14px !important; border-radius: 7px !important;
                font-size: 0.9rem !important; font-weight: 600 !important;
                cursor: pointer; box-shadow: none !important;
                border: 1px solid transparent !important;
                background: transparent !important;
                color: var(--ui-muted, #a69e92) !important;
            }
            .hub-tab-btn.is-active {
                background: var(--ui-btn-bg, #c8a66a) !important;
                color: var(--ui-btn-text, #1a150f) !important;
                border-color: var(--ui-accent, #d2b278) !important;
            }
            /* 3 колонки на Главной: Слева (старт/обновления) | По центру (лента) | Справа (общий чат) */
            .hub-home-grid {
                display: grid;
                grid-template-columns: 320px minmax(360px, 1.3fr) 365px;
                gap: 16px;
                align-items: start;
            }
            .hub-left-col {
                display: flex; flex-direction: column; gap: 14px;
            }
            .hub-updates-panel {
                display: flex; flex-direction: column;
                min-height: 290px;
            }
            .hub-updates-scroll {
                flex: 1;
                max-height: 360px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 8px;
                padding-right: 2px;
            }
            .hub-feed-panel {
                display: flex; flex-direction: column; gap: 12px;
                min-height: 670px;
                text-align: left;
            }
            .hub-feed-card {
                background: var(--ui-panel2, #161412);
                border: 1px solid var(--ui-border, #3e372f);
                border-radius: 10px;
                padding: 12px 14px;
                text-align: left;
            }
            .hub-chat-box {
                display: flex; flex-direction: column;
                height: 670px; min-height: 440px;
            }
            .hub-chat-messages {
                flex: 1; overflow-y: auto;
                background: var(--ui-panel2, #161412);
                border: 1px solid var(--ui-border, #3e372f);
                border-radius: 9px; padding: 10px;
                display: flex; flex-direction: column; gap: 8px;
                margin-bottom: 10px;
            }
            .hub-chat-msg {
                background: var(--ui-chat-msg, #24211d);
                border: 1px solid var(--ui-border, #3e372f);
                border-radius: 9px; padding: 8px 10px;
                display: flex; gap: 9px; align-items: flex-start; text-align: left;
            }
            .hub-chat-msg.is-mine { border-left: 3px solid var(--ui-accent, #d2b278); }
            .hub-avatar-sm {
                width: 34px; height: 34px; border-radius: 50%; object-fit: cover;
                border: 1px solid var(--ui-accent, #d2b278);
                background: var(--ui-panel, #221f1c);
                display: flex; align-items: center; justify-content: center;
                font-size: 0.92rem; flex-shrink: 0; cursor: pointer;
            }
            .hub-profile-banner {
                display: flex; gap: 18px; align-items: center; flex-wrap: wrap;
                background: var(--ui-panel2, #161412);
                border: 1px solid var(--ui-border-strong, #695c4c);
                border-radius: 12px; padding: 18px; margin-bottom: 16px; text-align: left;
            }
            .hub-stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 16px; }
            .hub-stat-card { background: var(--ui-panel2, #161412); border: 1px solid var(--ui-border, #3e372f); border-radius: 10px; padding: 12px 10px; text-align: center; }

            /* Окно личных сообщений пользователей */
            .hub-dm-layout {
                display: grid;
                grid-template-columns: 260px 1fr;
                gap: 12px;
                height: 60vh;
                min-height: 390px;
            }
            .hub-dm-list-col, .hub-dm-chat-col {
                display: flex; flex-direction: column; min-height: 0;
                background: var(--ui-panel2, #161412);
                border: 1px solid var(--ui-border, #3e372f);
                border-radius: 10px; padding: 10px;
            }
            .hub-dm-peer-btn {
                width: 100%; display: flex; align-items: center; gap: 9px;
                padding: 8px 9px; margin-bottom: 5px; border-radius: 8px;
                background: var(--ui-panel, #221f1c); color: var(--ui-text, #e5e0d7);
                border: 1px solid var(--ui-border, #3e372f);
                cursor: pointer; text-align: left; box-shadow: none;
            }
            .hub-dm-peer-btn.is-active {
                border-color: var(--ui-accent, #d2b278);
                box-shadow: inset 3px 0 0 var(--ui-accent, #d2b278);
            }
            .hub-dm-mob-back { display: none; }

            @media (max-width: 1180px) {
                .hub-home-grid { grid-template-columns: 300px 1fr; }
                .hub-chat-box { grid-column: 1 / -1; height: 440px; }
            }
            @media (max-width: 820px) {
                .hub-home-grid { grid-template-columns: 1fr !important; }
                .hub-feed-panel { min-height: 260px; }
                .hub-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
                .hub-dm-layout { grid-template-columns: 1fr !important; height: 66vh; }
                .hub-dm-layout.mob-list .hub-dm-chat-col { display: none !important; }
                .hub-dm-layout.mob-chat .hub-dm-list-col { display: none !important; }
                .hub-dm-mob-back { display: inline-flex !important; }
            }
        `;
    }

    // --- 2. ОБЛАЧНАЯ СИНХРОНИЗАЦИЯ (ЧАТ, ЛЕНТА, ПРОФИЛИ, ОНЛАЙН, ЛИЧКА) ---
    function NORMALIZE_BY_TS(val, maxItems = 120, desc = false) {
        if (!val || typeof val !== 'object') return [];
        const arr = Object.values(val).filter(x => x && x.id);
        arr.sort((a, b) => desc ? ((b.ts || 0) - (a.ts || 0)) : ((a.ts || 0) - (b.ts || 0)));
        return desc ? arr.slice(0, maxItems) : arr.slice(-maxItems);
    }

    function PUBLISH_HUB_PRESENCE() {
        const u = CUR_USER();
        if (!u || !u.login || !window.firebase || !firebase.apps || !firebase.apps.length) return;
        const sess = (typeof GET_SESSION === 'function') ? GET_SESSION() : null;
        const prof = GET_PROFILE(u.login);
        const payload = {
            login: SAFE_KEY(u.login),
            displayName: prof.displayName || u.displayName || u.login,
            where: sess && sess.roomCode ? `Комната #${sess.roomCode}` : 'На Главной',
            ts: firebase.database.ServerValue.TIMESTAMP
        };
        const ref = firebase.database().ref(`campaign_v2/hub_presence/${MY_HUB_CLIENT_ID}`);
        hubPresenceRef = ref;
        ref.onDisconnect().remove().then(() => ref.set(payload).catch(() => {})).catch(() => ref.set(payload).catch(() => {}));
    }

    function REMOVE_HUB_PRESENCE() {
        if (hubPresenceRef) { hubPresenceRef.remove().catch(() => {}); hubPresenceRef = null; }
    }

    function SYNC_HUB_CLOUD() {
        try {
            const cachedP = localStorage.getItem('dnd_hub_profiles_v1');
            if (cachedP) window._hubProfilesCache = JSON.parse(cachedP) || {};
        } catch (e) {}

        Promise.all([
            fetch(`${FB_ROOT}/user_profiles.json`).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(`${FB_ROOT}/global_tavern_chat.json`).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(`${FB_ROOT}/hub_feed.json`).then(r => r.ok ? r.json() : null).catch(() => null)
        ]).then(([profs, chat, feed]) => {
            if (profs && typeof profs === 'object') {
                window._hubProfilesCache = Object.assign({}, window._hubProfilesCache, profs);
                try { localStorage.setItem('dnd_hub_profiles_v1', JSON.stringify(window._hubProfilesCache)); } catch (e) {}
            }
            if (chat) window._hubGlobalChat = NORMALIZE_BY_TS(chat, 120, false);
            if (feed) window._hubFeedPosts = NORMALIZE_BY_TS(feed, 60, true);
            REFRESH_HUB_DYNAMIC();
        });

        const attach = () => {
            if (hubCloudBound) return true;
            if (window.firebase && firebase.apps && firebase.apps.length) {
                hubCloudBound = true;
                const root = firebase.database().ref('campaign_v2');

                root.child('global_tavern_chat').limitToLast(120).on('value', (snap) => {
                    window._hubGlobalChat = NORMALIZE_BY_TS(snap.val(), 120, false);
                    RENDER_GLOBAL_CHAT_ONLY();
                });

                root.child('hub_feed').limitToLast(60).on('value', (snap) => {
                    window._hubFeedPosts = NORMALIZE_BY_TS(snap.val(), 60, true);
                    RENDER_FEED_ITEMS_ONLY();
                });

                root.child('user_profiles').on('value', (snap) => {
                    const val = snap.val();
                    if (val && typeof val === 'object') {
                        window._hubProfilesCache = val;
                        try { localStorage.setItem('dnd_hub_profiles_v1', JSON.stringify(val)); } catch (e) {}
                        REFRESH_HUB_DYNAMIC();
                    }
                });

                root.child('hub_presence').on('value', (snap) => {
                    window._hubOnlineUsers = snap.val() || {};
                    RENDER_ONLINE_STRIP_ONLY();
                });

                PUBLISH_HUB_PRESENCE();
                SYNC_USER_DM_INBOX();
                return true;
            }
            return false;
        };

        if (!attach()) {
            const t = setInterval(() => { if (attach()) clearInterval(t); }, 650);
            setTimeout(() => clearInterval(t), 25000);
        }
    }

    function REFRESH_HUB_DYNAMIC() {
        if ((typeof GET_SESSION === 'function' && GET_SESSION()) || !CUR_USER()) return;
        const lobby = document.getElementById('lobby-screen');
        if (!lobby || lobby.style.display === 'none') return;
        if (window._hubMainTab === 'home') {
            RENDER_GLOBAL_CHAT_ONLY();
            RENDER_ONLINE_STRIP_ONLY();
            RENDER_FEED_ITEMS_ONLY();
        } else if (window._hubMainTab === 'profile' && !window._hubEditingProfile) {
            RENDER_LOBBY_HTML();
        }
    }

    // --- 3. ✉️ ЛИЧКА ПОЛЬЗОВАТЕЛЕЙ (АККАУНТ -> АККАУНТ, ОТДЕЛЬНО ОТ КОМНАТ) ---
    function COUNT_UNREAD_USER_DMS() {
        const myKey = CUR_LOGIN_KEY();
        if (!myKey) return 0;
        let cnt = 0;
        Object.values(window._hubDmInbox || {}).forEach(item => {
            if (!item || !item.peer || !item.lastTs) return;
            const tid = DM_THREAD_ID(myKey, item.peer);
            if (SAFE_KEY(item.lastFrom) !== myKey && Number(item.lastTs) > GET_DM_READ_TS(tid)) {
                cnt++;
            }
        });
        return cnt;
    }

    function UPDATE_USER_DM_BADGE() {
        const cnt = COUNT_UNREAD_USER_DMS();
        const badge = document.getElementById('hub-dm-unread-badge');
        if (!badge) return;
        if (cnt > 0) {
            badge.textContent = String(cnt);
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    function SHOW_USER_DM_TOAST(peerKey, text) {
        const prof = GET_PROFILE(peerKey);
        let box = document.getElementById('hub-dm-toast');
        if (!box) {
            box = document.createElement('div');
            box.id = 'hub-dm-toast';
            box.style.cssText = 'position:fixed; bottom:20px; right:20px; max-width:340px; background:var(--ui-panel,#221f1c); border:2px solid var(--ui-accent,#d2b278); border-radius:11px; padding:11px 14px; color:var(--ui-text,#e5e0d7); box-shadow:0 12px 30px rgba(0,0,0,0.85); z-index:96100; cursor:pointer; text-align:left;';
            document.body.appendChild(box);
        }
        box.innerHTML = `
            <div style="font-size:0.8rem; color:var(--ui-accent,#d2b278); font-weight:bold; margin-bottom:3px;">✉️ Личное сообщение от ${ESC(prof.displayName)} (@${ESC(peerKey)})</div>
            <div style="font-size:0.88rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ESC(text)}</div>
        `;
        box.style.display = 'block';
        box.onclick = () => { box.style.display = 'none'; window.OPEN_USER_DM_MODAL(peerKey); };
        if (dmToastTimer) clearTimeout(dmToastTimer);
        dmToastTimer = setTimeout(() => { if (box) box.style.display = 'none'; }, 6000);
    }

    function SYNC_USER_DM_INBOX() {
        const myKey = CUR_LOGIN_KEY();
        if (myKey === dmInboxOwner && (!myKey || dmInboxRef)) return;

        if (dmInboxRef) { dmInboxRef.off(); dmInboxRef = null; }
        if (dmThreadRef) { dmThreadRef.off(); dmThreadRef = null; }
        dmInboxOwner = myKey;
        dmInboxInitialLoaded = false;
        dmThreadIdActive = '';
        window._hubDmInbox = {};
        window._hubDmActivePeer = null;
        window._hubDmMessages = [];

        if (!myKey) { UPDATE_USER_DM_BADGE(); return; }

        fetch(`${FB_ROOT}/user_dm_inbox/${encodeURIComponent(myKey)}.json`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (dmInboxOwner !== myKey) return;
                window._hubDmInbox = (data && typeof data === 'object') ? data : {};
                UPDATE_USER_DM_BADGE();
                if (document.getElementById('hub-user-dm-modal')?.classList.contains('active')) RENDER_USER_DM_MODAL();
            })
            .catch(() => {});

        const attach = () => {
            if (dmInboxOwner !== myKey) return true;
            if (window.firebase && firebase.apps && firebase.apps.length) {
                dmInboxRef = firebase.database().ref(`campaign_v2/user_dm_inbox/${myKey}`);
                dmInboxRef.on('value', (snap) => {
                    if (dmInboxOwner !== myKey) return;
                    const prev = window._hubDmInbox || {};
                    const next = snap.val() || {};
                    window._hubDmInbox = next;

                    if (dmInboxInitialLoaded) {
                        const modalOpen = document.getElementById('hub-user-dm-modal')?.classList.contains('active');
                        Object.values(next).forEach(item => {
                            if (!item || !item.peer || SAFE_KEY(item.lastFrom) === myKey) return;
                            const oldTs = Number(prev[item.peer]?.lastTs || 0);
                            if (Number(item.lastTs || 0) > oldTs) {
                                const viewingSame = modalOpen && window._hubDmActivePeer === item.peer;
                                if (!viewingSame) SHOW_USER_DM_TOAST(item.peer, item.lastText || '');
                            }
                        });
                    }
                    dmInboxInitialLoaded = true;
                    UPDATE_USER_DM_BADGE();
                    if (document.getElementById('hub-user-dm-modal')?.classList.contains('active')) RENDER_USER_DM_MODAL();
                });
                return true;
            }
            return false;
        };
        if (!attach()) {
            const t = setInterval(() => { if (attach()) clearInterval(t); }, 700);
            setTimeout(() => clearInterval(t), 20000);
        }
    }

    function SUBSCRIBE_DM_THREAD(peerKey) {
        const myKey = CUR_LOGIN_KEY();
        const pk = SAFE_KEY(peerKey);
        if (!myKey || !pk) return;
        const tid = DM_THREAD_ID(myKey, pk);
        if (tid === dmThreadIdActive && dmThreadRef) return;

        if (dmThreadRef) { dmThreadRef.off(); dmThreadRef = null; }
        dmThreadIdActive = tid;
        window._hubDmMessages = [];

        fetch(`${FB_ROOT}/user_dms/${encodeURIComponent(tid)}.json`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (dmThreadIdActive !== tid) return;
                window._hubDmMessages = NORMALIZE_BY_TS(data, 120, false);
                SET_DM_READ(tid, Date.now());
                UPDATE_USER_DM_BADGE();
                RENDER_USER_DM_MESSAGES_ONLY(true);
            })
            .catch(() => {});

        if (window.firebase && firebase.apps && firebase.apps.length) {
            dmThreadRef = firebase.database().ref(`campaign_v2/user_dms/${tid}`).limitToLast(120);
            dmThreadRef.on('value', (snap) => {
                if (dmThreadIdActive !== tid) return;
                window._hubDmMessages = NORMALIZE_BY_TS(snap.val(), 120, false);
                if (document.getElementById('hub-user-dm-modal')?.classList.contains('active')) {
                    SET_DM_READ(tid, Date.now());
                    UPDATE_USER_DM_BADGE();
                    RENDER_USER_DM_MESSAGES_ONLY(true);
                }
            });
        }
    }

    window.OPEN_USER_DM_MODAL = function(peerLogin) {
        if (!CUR_USER()) return;
        SYNC_USER_DM_INBOX();

        let m = document.getElementById('hub-user-dm-modal');
        if (!m) {
            m = document.createElement('div');
            m.className = 'modal';
            m.id = 'hub-user-dm-modal';
            m.style.zIndex = '95600';
            m.innerHTML = `<div class="modal-content" id="hub-user-dm-content" style="max-width:860px; width:96%; padding:16px 18px;"></div>`;
            m.addEventListener('click', e => { if (e.target === m) m.classList.remove('active'); });
            document.body.appendChild(m);
        }

        if (peerLogin && SAFE_KEY(peerLogin) !== CUR_LOGIN_KEY()) {
            window._hubDmActivePeer = SAFE_KEY(peerLogin);
            window._hubDmMobView = 'chat';
            SUBSCRIBE_DM_THREAD(window._hubDmActivePeer);
            SET_DM_READ(DM_THREAD_ID(CUR_LOGIN_KEY(), window._hubDmActivePeer), Date.now());
            UPDATE_USER_DM_BADGE();
        } else if (!window._hubDmActivePeer) {
            const firstDialog = Object.values(window._hubDmInbox || {}).sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0))[0];
            if (firstDialog && firstDialog.peer) {
                window._hubDmActivePeer = SAFE_KEY(firstDialog.peer);
                SUBSCRIBE_DM_THREAD(window._hubDmActivePeer);
            }
        } else {
            SUBSCRIBE_DM_THREAD(window._hubDmActivePeer);
            SET_DM_READ(DM_THREAD_ID(CUR_LOGIN_KEY(), window._hubDmActivePeer), Date.now());
            UPDATE_USER_DM_BADGE();
        }

        m.classList.add('active');
        RENDER_USER_DM_MODAL();
    };

    window.USER_DM_SELECT_PEER = function(peerLogin) {
        const pk = SAFE_KEY(peerLogin);
        if (!pk || pk === CUR_LOGIN_KEY()) return;
        window._hubDmActivePeer = pk;
        window._hubDmMobView = 'chat';
        SET_DM_READ(DM_THREAD_ID(CUR_LOGIN_KEY(), pk), Date.now());
        UPDATE_USER_DM_BADGE();
        SUBSCRIBE_DM_THREAD(pk);
        RENDER_USER_DM_MODAL();
        setTimeout(() => document.getElementById('hub-dm-msg-inp')?.focus(), 40);
    };

    window.USER_DM_SEND = function() {
        const u = CUR_USER();
        const myKey = CUR_LOGIN_KEY();
        const peerKey = window._hubDmActivePeer;
        if (!u || !myKey || !peerKey || peerKey === myKey) return;

        const inp = document.getElementById('hub-dm-msg-inp');
        const text = (inp ? inp.value : '').trim();
        if (!text) return;

        const now = Date.now();
        const id = 'dm_' + now + '_' + Math.random().toString(36).slice(2, 6);
        const tid = DM_THREAD_ID(myKey, peerKey);
        const d = new Date(now);
        const dateStr = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + ' ' +
                        d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const prof = GET_PROFILE(myKey);

        const msg = {
            id, from: myKey, fromName: prof.displayName, to: peerKey,
            text: text.slice(0, 800), ts: now, date: dateStr
        };
        const inboxMy = { peer: peerKey, lastText: msg.text.slice(0, 90), lastTs: now, lastFrom: myKey };
        const inboxPeer = { peer: myKey, lastText: msg.text.slice(0, 90), lastTs: now, lastFrom: myKey };

        if (inp) inp.value = '';
        window._hubDmMessages.push(msg);
        window._hubDmInbox[peerKey] = inboxMy;
        SET_DM_READ(tid, now + 10);
        UPDATE_USER_DM_BADGE();
        RENDER_USER_DM_MESSAGES_ONLY(true);

        if (window.firebase && firebase.apps && firebase.apps.length) {
            const root = firebase.database().ref('campaign_v2');
            root.child(`user_dms/${tid}/${id}`).set(msg).catch(() => {});
            root.child(`user_dm_inbox/${myKey}/${peerKey}`).set(inboxMy).catch(() => {});
            root.child(`user_dm_inbox/${peerKey}/${myKey}`).set(inboxPeer).catch(() => {});
        } else {
            fetch(`${FB_ROOT}/user_dms/${encodeURIComponent(tid)}/${encodeURIComponent(id)}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(msg) }).catch(() => {});
            fetch(`${FB_ROOT}/user_dm_inbox/${encodeURIComponent(myKey)}/${encodeURIComponent(peerKey)}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inboxMy) }).catch(() => {});
            fetch(`${FB_ROOT}/user_dm_inbox/${encodeURIComponent(peerKey)}/${encodeURIComponent(myKey)}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(inboxPeer) }).catch(() => {});
        }
    };

    window.USER_DM_DELETE_MSG = function(msgId) {
        const myKey = CUR_LOGIN_KEY();
        const peerKey = window._hubDmActivePeer;
        if (!myKey || !peerKey) return;
        const msg = window._hubDmMessages.find(m => m.id === msgId);
        if (!msg || SAFE_KEY(msg.from) !== myKey) return;
        const tid = DM_THREAD_ID(myKey, peerKey);

        window._hubDmMessages = window._hubDmMessages.filter(m => m.id !== msgId);
        RENDER_USER_DM_MESSAGES_ONLY();

        if (window.firebase && firebase.apps && firebase.apps.length) {
            firebase.database().ref(`campaign_v2/user_dms/${tid}/${msgId}`).remove().catch(() => {});
        } else {
            fetch(`${FB_ROOT}/user_dms/${encodeURIComponent(tid)}/${encodeURIComponent(msgId)}.json`, { method: 'DELETE' }).catch(() => {});
        }
    };

    function RENDER_USER_DM_MESSAGES_ONLY(scrollBottom = false) {
        const box = document.getElementById('hub-dm-messages-scroll');
        if (!box) return;
        const myKey = CUR_LOGIN_KEY();
        if (!window._hubDmMessages.length) {
            box.innerHTML = `<div style="margin:auto; text-align:center; color:var(--ui-muted,#888); padding:24px; font-size:0.88rem;">Переписка пока пуста — напишите первое сообщение!</div>`;
            return;
        }
        box.innerHTML = window._hubDmMessages.map(m => {
            const mine = SAFE_KEY(m.from) === myKey;
            const prof = GET_PROFILE(m.from);
            return `
                <div style="align-self:${mine ? 'flex-end' : 'flex-start'}; max-width:82%; background:${mine ? 'var(--ui-panel,#221f1c)' : 'var(--ui-chat-msg,#24211d)'}; border:1px solid ${mine ? 'var(--ui-accent,#d2b278)' : 'var(--ui-border,#3e372f)'}; border-radius:10px; padding:7px 11px; text-align:left;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:2px;">
                        <b style="font-size:0.78rem; color:${mine ? 'var(--ui-accent,#d2b278)' : 'var(--ui-text,#e5e0d7)'};">${ESC(prof.displayName)}</b>
                        <div style="display:flex; align-items:center; gap:5px;">
                            <small style="font-size:0.7rem !important; color:var(--ui-muted,#888);">${ESC(m.date || '')}</small>
                            ${mine ? `<button data-custom-bg="1" onclick="USER_DM_DELETE_MSG('${ESC_JS(m.id)}')" style="background:transparent; border:none; color:var(--ui-muted,#888); padding:0 3px; font-size:0.7rem; cursor:pointer; box-shadow:none;" title="Удалить">✕</button>` : ''}
                        </div>
                    </div>
                    <div style="font-size:0.9rem; color:var(--ui-text,#e5e0d7); white-space:pre-wrap; word-break:break-word; line-height:1.4;">${ESC(m.text)}</div>
                </div>`;
        }).join('');
        if (scrollBottom) box.scrollTop = box.scrollHeight;
    }

    function BUILD_DM_PEERS_LIST_HTML() {
        const myKey = CUR_LOGIN_KEY();
        const q = (window._hubDmSearch || '').toLowerCase().trim();
        const inboxList = Object.values(window._hubDmInbox || {})
            .filter(x => x && x.peer && SAFE_KEY(x.peer) !== myKey)
            .sort((a, b) => (b.lastTs || 0) - (a.lastTs || 0));

        const seen = new Set(inboxList.map(x => SAFE_KEY(x.peer)));
        const accounts = (typeof GET_ACCOUNTS === 'function') ? GET_ACCOUNTS() : {};
        const otherLogins = Array.from(new Set(
            Object.keys(accounts)
                .concat(Object.keys(window._hubProfilesCache || {}))
                .concat(Object.values(window._hubOnlineUsers || {}).map(u => u && u.login))
                .map(SAFE_KEY)
                .filter(k => k && k !== myKey && !seen.has(k))
        ));

        const matchesQ = (key) => {
            if (!q) return true;
            const p = GET_PROFILE(key);
            return key.includes(q) || (p.displayName || '').toLowerCase().includes(q);
        };

        const renderPeer = (peerKey, inboxItem) => {
            const p = GET_PROFILE(peerKey);
            const act = window._hubDmActivePeer === peerKey;
            const online = IS_USER_ONLINE(peerKey);
            const tid = DM_THREAD_ID(myKey, peerKey);
            const unread = !!(inboxItem && SAFE_KEY(inboxItem.lastFrom) !== myKey && Number(inboxItem.lastTs || 0) > GET_DM_READ_TS(tid));
            const av = p.avatar
                ? `<img src="${p.avatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover; border:1px solid var(--ui-accent,#d2b278); flex-shrink:0;">`
                : `<div style="width:32px; height:32px; border-radius:50%; background:var(--ui-panel2,#161412); border:1px solid var(--ui-border,#3e372f); display:flex; align-items:center; justify-content:center; flex-shrink:0;">👤</div>`;
            return `
                <button data-custom-bg="1" class="hub-dm-peer-btn ${act ? 'is-active' : ''}" onclick="USER_DM_SELECT_PEER('${ESC_JS(peerKey)}')">
                    ${av}
                    <div style="flex:1; min-width:0;">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:4px;">
                            <span style="font-weight:700; font-size:0.84rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:${act ? 'var(--ui-accent,#d2b278)' : 'var(--ui-text,#e5e0d7)'};">
                                ${online ? '<span style="color:#6cb878; font-size:0.65rem;">●</span> ' : ''}${ESC(p.displayName)}
                            </span>
                            ${unread ? `<span style="background:#a84848; color:#fff; border-radius:10px; padding:1px 6px; font-size:0.68rem; font-weight:bold;">NEW</span>` : ''}
                        </div>
                        <div style="font-size:0.75rem; color:var(--ui-muted,#888); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            ${inboxItem ? ESC(inboxItem.lastText || '') : `@${ESC(peerKey)}`}
                        </div>
                    </div>
                </button>`;
        };

        const dialogsHtml = inboxList.filter(i => matchesQ(i.peer)).map(i => renderPeer(SAFE_KEY(i.peer), i)).join('');
        const othersHtml = otherLogins.filter(matchesQ).map(k => renderPeer(k, null)).join('');

        let out = '';
        if (dialogsHtml) out += `<div style="font-size:0.74rem; color:var(--ui-accent,#d2b278); font-weight:700; margin:2px 0 5px 2px;">💬 Диалоги</div>${dialogsHtml}`;
        if (othersHtml) out += `<div style="font-size:0.74rem; color:var(--ui-muted,#888); font-weight:600; margin:8px 0 5px 2px;">👥 Пользователи сайта</div>${othersHtml}`;
        return out || `<div style="padding:18px; text-align:center; color:var(--ui-muted,#888); font-size:0.84rem;">Пользователи не найдены</div>`;
    }

    window.USER_DM_ON_SEARCH = function(val) {
        window._hubDmSearch = val || '';
        const listEl = document.getElementById('hub-dm-peers-scroll');
        if (listEl) listEl.innerHTML = BUILD_DM_PEERS_LIST_HTML();
    };

    function RENDER_USER_DM_MODAL() {
        const cont = document.getElementById('hub-user-dm-content');
        if (!cont) return;

        const peer = window._hubDmActivePeer;
        let chatColHTML = '';
        if (peer) {
            const p = GET_PROFILE(peer);
            const online = IS_USER_ONLINE(peer);
            chatColHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding-bottom:8px; margin-bottom:8px; border-bottom:1px solid var(--ui-border,#3e372f); flex-wrap:wrap;">
                    <div style="display:flex; align-items:center; gap:8px;">
                        <button class="btn-small hub-dm-mob-back" onclick="window._hubDmMobView='list'; RENDER_USER_DM_MODAL();">⬅️</button>
                        <div style="text-align:left;">
                            <b style="color:var(--ui-accent,#d2b278); font-size:0.98rem;">${ESC(p.displayName)}</b>
                            <small style="color:var(--ui-muted,#888); margin-left:6px;">@${ESC(peer)} • ${online ? '<span style="color:#6cb878;">🟢 в сети</span>' : '⚫ не в сети'}</small>
                        </div>
                    </div>
                    <button class="btn-small" onclick="OPEN_PUBLIC_USER_PROFILE('${ESC_JS(peer)}')">👤 Профиль</button>
                </div>
                <div id="hub-dm-messages-scroll" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:7px; padding-right:4px; margin-bottom:9px;"></div>
                <div style="display:flex; gap:7px;">
                    <input type="text" id="hub-dm-msg-inp" placeholder="Написать ${ESC(p.displayName)}..."
                        onkeypress="if(event.key==='Enter'){ event.preventDefault(); USER_DM_SEND(); }"
                        style="flex:1; padding:8px 11px; text-align:left;">
                    <button class="btn-save" onclick="USER_DM_SEND()">Отправить</button>
                </div>
            `;
        } else {
            chatColHTML = `<div style="margin:auto; text-align:center; color:var(--ui-muted,#888); padding:28px;">
                <div style="font-size:2.2rem; margin-bottom:6px;">✉️</div>
                Выберите пользователя слева, чтобы начать личную переписку.<br>
                <small>Эта личка работает между аккаунтами и не зависит от комнат.</small>
            </div>`;
        }

        cont.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; border-bottom:1px solid var(--ui-border,#3e372f); padding-bottom:8px;">
                <h2 style="margin:0; border:none; padding:0; font-size:1.25rem;">✉️ Личные сообщения пользователей</h2>
                <button class="btn-small" onclick="document.getElementById('hub-user-dm-modal').classList.remove('active')">✕ Закрыть</button>
            </div>
            <div class="hub-dm-layout mob-${window._hubDmMobView || 'list'}">
                <div class="hub-dm-list-col">
                    <input type="text" value="${ESC(window._hubDmSearch || '')}" oninput="USER_DM_ON_SEARCH(this.value)"
                        placeholder="🔍 Поиск по нику или @логину..."
                        style="width:100%; padding:7px 9px; margin-bottom:8px; text-align:left; font-size:0.84rem;">
                    <div id="hub-dm-peers-scroll" style="flex:1; overflow-y:auto; padding-right:2px;">
                        ${BUILD_DM_PEERS_LIST_HTML()}
                    </div>
                </div>
                <div class="hub-dm-chat-col">
                    ${chatColHTML}
                </div>
            </div>
        `;
        if (peer) RENDER_USER_DM_MESSAGES_ONLY(true);
    }

    // --- 4. 📰 ЛЕНТА ТАВЕРНЫ (ЦЕНТРАЛЬНАЯ КОЛОНКА) ---
    window.HUB_SET_FEED_FILTER = function(f) {
        window._hubFeedFilter = f;
        RENDER_FEED_ITEMS_ONLY();
        document.querySelectorAll('[data-hub-feed-filter]').forEach(btn => {
            const act = btn.getAttribute('data-hub-feed-filter') === f;
            btn.className = 'btn-small ' + (act ? 'btn-save' : '');
        });
    };

    window.HUB_PUBLISH_FEED_POST = function() {
        const u = CUR_USER();
        if (!u || !u.login) return;
        const txtEl = document.getElementById('hub-feed-post-inp');
        const tagEl = document.getElementById('hub-feed-post-tag');
        const text = (txtEl ? txtEl.value : '').trim();
        if (!text) return;

        const now = Date.now();
        const id = 'fp_' + now + '_' + Math.random().toString(36).slice(2, 6);
        const prof = GET_PROFILE(u.login);
        const d = new Date(now);
        const dateStr = d.toLocaleDateString('ru-RU') + ' ' + d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

        const post = {
            id,
            login: SAFE_KEY(u.login),
            displayName: prof.displayName,
            tag: tagEl ? tagEl.value : 'post',
            text: text.slice(0, 900),
            ts: now,
            date: dateStr,
            likes: {}
        };

        if (txtEl) txtEl.value = '';
        window._hubFeedPosts.unshift(post);
        RENDER_FEED_ITEMS_ONLY();

        if (window.firebase && firebase.apps && firebase.apps.length) {
            firebase.database().ref(`campaign_v2/hub_feed/${id}`).set(post).catch(() => {});
        } else {
            fetch(`${FB_ROOT}/hub_feed/${encodeURIComponent(id)}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(post) }).catch(() => {});
        }
    };

    window.HUB_TOGGLE_FEED_LIKE = function(postId) {
        const myKey = CUR_LOGIN_KEY();
        if (!myKey) return;
        const post = window._hubFeedPosts.find(p => p.id === postId);
        if (!post) return;
        if (!post.likes || typeof post.likes !== 'object') post.likes = {};
        const had = !!post.likes[myKey];
        if (had) delete post.likes[myKey];
        else post.likes[myKey] = true;
        RENDER_FEED_ITEMS_ONLY();

        if (window.firebase && firebase.apps && firebase.apps.length) {
            const ref = firebase.database().ref(`campaign_v2/hub_feed/${postId}/likes/${myKey}`);
            if (had) ref.remove().catch(() => {}); else ref.set(true).catch(() => {});
        } else {
            fetch(`${FB_ROOT}/hub_feed/${encodeURIComponent(postId)}/likes/${encodeURIComponent(myKey)}.json`, {
                method: had ? 'DELETE' : 'PUT', headers: { 'Content-Type': 'application/json' }, body: had ? undefined : 'true'
            }).catch(() => {});
        }
    };

    window.HUB_DELETE_FEED_POST = function(postId) {
        const myKey = CUR_LOGIN_KEY();
        const isAdm = (typeof window.IS_ADMIN === 'function') && window.IS_ADMIN();
        const post = window._hubFeedPosts.find(p => p.id === postId);
        if (!post) return;
        if (!isAdm && SAFE_KEY(post.login) !== myKey) return;
        if (!confirm('Удалить эту запись из Ленты?')) return;

        window._hubFeedPosts = window._hubFeedPosts.filter(p => p.id !== postId);
        RENDER_FEED_ITEMS_ONLY();
        if (window.firebase && firebase.apps && firebase.apps.length) {
            firebase.database().ref(`campaign_v2/hub_feed/${postId}`).remove().catch(() => {});
        } else {
            fetch(`${FB_ROOT}/hub_feed/${encodeURIComponent(postId)}.json`, { method: 'DELETE' }).catch(() => {});
        }
    };

    function RENDER_FEED_ITEMS_ONLY() {
        const box = document.getElementById('hub-feed-stream');
        if (!box) return;
        const filter = window._hubFeedFilter || 'all';
        const myKey = CUR_LOGIN_KEY();
        const isAdm = (typeof window.IS_ADMIN === 'function') && window.IS_ADMIN();

        const items = [];
        if (filter === 'all' || filter === 'posts') {
            (window._hubFeedPosts || []).forEach(p => items.push({ kind: 'post', ts: p.ts || 0, data: p }));
        }
        if (filter === 'all' || filter === 'templates') {
            const tpls = (typeof GET_SHARED_TEMPLATES === 'function') ? GET_SHARED_TEMPLATES() : [];
            tpls.slice(-6).forEach((t, idx) => items.push({ kind: 'template', ts: Number(t.createdAtTs || t.ts || (idx + 1)), data: t }));
        }
        if (filter === 'all' || filter === 'updates') {
            const upds = (typeof window.GET_SITE_UPDATES === 'function') ? window.GET_SITE_UPDATES().slice(0, 3) : [];
            upds.forEach(u => items.push({ kind: 'update', ts: Number(u.id || 0), data: u }));
        }

        items.sort((a, b) => (b.ts || 0) - (a.ts || 0));

        if (!items.length) {
            box.innerHTML = `<div style="padding:36px 14px; text-align:center; color:var(--ui-muted,#888); background:var(--ui-panel2,#161412); border:1px dashed var(--ui-border,#3e372f); border-radius:10px;">
                📰 В ленте пока пусто.<br><small>Напишите первую заметку или объявление о наборе в кампанию сверху!</small>
            </div>`;
            return;
        }

        box.innerHTML = items.map(it => {
            if (it.kind === 'post') {
                const p = it.data;
                const lk = SAFE_KEY(p.login);
                const prof = GET_PROFILE(lk);
                const tagObj = FEED_TAGS.find(t => t.id === p.tag) || FEED_TAGS[0];
                const likesObj = (p.likes && typeof p.likes === 'object') ? p.likes : {};
                const likeCnt = Object.keys(likesObj).length;
                const liked = !!(myKey && likesObj[myKey]);
                const canDel = isAdm || lk === myKey;
                const av = prof.avatar
                    ? `<img src="${prof.avatar}" class="hub-avatar-sm" onclick="OPEN_PUBLIC_USER_PROFILE('${ESC_JS(lk)}')">`
                    : `<div class="hub-avatar-sm" onclick="OPEN_PUBLIC_USER_PROFILE('${ESC_JS(lk)}')">👤</div>`;
                return `
                    <div class="hub-feed-card">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px;">
                            <div style="display:flex; align-items:center; gap:9px;">
                                ${av}
                                <div>
                                    <b style="color:var(--ui-accent,#d2b278); cursor:pointer; font-size:0.9rem;" onclick="OPEN_PUBLIC_USER_PROFILE('${ESC_JS(lk)}')">${ESC(prof.displayName)}</b>
                                    <small style="color:var(--ui-muted,#888); margin-left:4px;">@${ESC(lk)}</small>
                                    <div style="font-size:0.74rem; color:var(--ui-muted,#888);">${ESC(p.date || '')} • ${tagObj.label}</div>
                                </div>
                            </div>
                            ${canDel ? `<button data-custom-bg="1" class="btn-small" onclick="HUB_DELETE_FEED_POST('${ESC_JS(p.id)}')" style="background:transparent; border:none; color:var(--ui-muted,#888); box-shadow:none; padding:2px 6px;">✕</button>` : ''}
                        </div>
                        <div style="font-size:0.92rem; line-height:1.48; white-space:pre-wrap; word-break:break-word; margin-bottom:9px;">${ESC(p.text)}</div>
                        <div style="display:flex; gap:6px; align-items:center;">
                            <button data-custom-bg="1" class="btn-small" onclick="HUB_TOGGLE_FEED_LIKE('${ESC_JS(p.id)}')"
                                style="padding:3px 9px; font-size:0.8rem; border-radius:14px; box-shadow:none; background:${liked ? 'var(--ui-btn-bg,#c8a66a)' : 'var(--ui-panel,#221f1c)'}; color:${liked ? 'var(--ui-btn-text,#1a150f)' : 'var(--ui-text,#e5e0d7)'}; border:1px solid ${liked ? 'var(--ui-accent,#d2b278)' : 'var(--ui-border,#3e372f)'};">
                                ❤️ ${likeCnt > 0 ? likeCnt : 'Нравится'}
                            </button>
                            ${lk !== myKey ? `<button data-custom-bg="1" class="btn-small" onclick="OPEN_USER_DM_MODAL('${ESC_JS(lk)}')" style="padding:3px 9px; font-size:0.78rem; border-radius:14px; box-shadow:none; background:var(--ui-panel,#221f1c); color:var(--ui-muted,#aaa); border:1px solid var(--ui-border,#3e372f);">✉️ Написать автору</button>` : ''}
                        </div>
                    </div>`;
            }

            if (it.kind === 'template') {
                const t = it.data;
                const ch = t.charSnapshot || {};
                const authorTxt = t.hideAuthor ? 'Анонимный игрок' : `@${t.authorLogin || 'игрок'}`;
                return `
                    <div class="hub-feed-card">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                            <div>
                                <div style="font-size:0.76rem; color:var(--ui-accent,#d2b278); font-weight:700; margin-bottom:3px;">🌟 Новый шаблон персонажа • ${ESC(authorTxt)}</div>
                                <div style="font-weight:700; font-size:0.96rem;">${ESC(ch.name || 'Герой')} <small style="color:var(--ui-muted,#aaa); font-weight:normal;">(${ESC(ch.race || 'Раса')} • ${ESC(ch.className || 'Класс')})</small></div>
                            </div>
                            <button class="btn-small btn-save" onclick="SET_HUB_MAIN_TAB('play', 'player_chars', 'user_templates')">Посмотреть</button>
                        </div>
                    </div>`;
            }

            const u = it.data;
            return `
                <div class="hub-feed-card" style="cursor:pointer;" onclick="OPEN_SITE_UPDATES_MODAL()">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-bottom:4px;">
                        <span style="font-size:0.76rem; color:var(--ui-accent,#d2b278); font-weight:700;">📢 Обновление сайта ${u.version ? `(${ESC(u.version)})` : ''}</span>
                        <small style="color:var(--ui-muted,#888);">${ESC(u.date || '')}</small>
                    </div>
                    <div style="font-weight:700; font-size:0.95rem; margin-bottom:4px;">${ESC(u.title)}</div>
                    <div style="font-size:0.86rem; color:var(--ui-muted,#aaa); white-space:pre-wrap; max-height:74px; overflow:hidden;">${ESC(u.body)}</div>
                </div>`;
        }).join('');
    }

    // --- 5. ОБЩИЙ ЧАТ ТАВЕРНЫ (ПРАВАЯ КОЛОНКА) ---
    window.HUB_SEND_CHAT_MSG = function() {
        const u = CUR_USER();
        if (!u || !u.login) return;
        const inp = document.getElementById('hub-global-chat-inp');
        const text = (inp ? inp.value : '').trim();
        if (!text) return;

        const prof = GET_PROFILE(u.login);
        const now = Date.now();
        const id = 'm_' + now + '_' + Math.random().toString(36).slice(2, 6);
        const d = new Date(now);
        const dateStr = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + ' ' +
                        d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const msg = { id, login: SAFE_KEY(u.login), displayName: prof.displayName, text: text.slice(0, 600), ts: now, date: dateStr };

        if (inp) inp.value = '';
        window._hubGlobalChat.push(msg);
        if (window._hubGlobalChat.length > 120) window._hubGlobalChat.shift();
        RENDER_GLOBAL_CHAT_ONLY(true);

        if (window.firebase && firebase.apps && firebase.apps.length) {
            firebase.database().ref(`campaign_v2/global_tavern_chat/${id}`).set(msg).catch(() => {});
        } else {
            fetch(`${FB_ROOT}/global_tavern_chat/${encodeURIComponent(id)}.json`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(msg) }).catch(() => {});
        }
    };

    window.HUB_DELETE_CHAT_MSG = function(msgId) {
        const myKey = CUR_LOGIN_KEY();
        const isAdm = (typeof window.IS_ADMIN === 'function') && window.IS_ADMIN();
        const msg = window._hubGlobalChat.find(m => m.id === msgId);
        if (!msg || (!isAdm && SAFE_KEY(msg.login) !== myKey)) return;
        if (!confirm('Удалить это сообщение?')) return;

        window._hubGlobalChat = window._hubGlobalChat.filter(m => m.id !== msgId);
        RENDER_GLOBAL_CHAT_ONLY();
        if (window.firebase && firebase.apps && firebase.apps.length) {
            firebase.database().ref(`campaign_v2/global_tavern_chat/${msgId}`).remove().catch(() => {});
        } else {
            fetch(`${FB_ROOT}/global_tavern_chat/${encodeURIComponent(msgId)}.json`, { method: 'DELETE' }).catch(() => {});
        }
    };

    window.HUB_MENTION_USER = function(login) {
        const inp = document.getElementById('hub-global-chat-inp');
        if (!inp) return;
        const tag = `@${login}, `;
        if (!inp.value.startsWith(tag)) inp.value = tag + inp.value;
        inp.focus();
    };

    function RENDER_GLOBAL_CHAT_ONLY(forceBottom = false) {
        const box = document.getElementById('hub-chat-messages');
        if (!box) return;
        const nearBottom = (box.scrollHeight - box.scrollTop - box.clientHeight) < 80;
        const myKey = CUR_LOGIN_KEY();
        const isAdm = (typeof window.IS_ADMIN === 'function') && window.IS_ADMIN();

        if (!window._hubGlobalChat.length) {
            box.innerHTML = `<div style="margin:auto; text-align:center; color:var(--ui-muted,#888); padding:22px; font-size:0.88rem;">🍺 В общей Таверне пока тихо.<br>Напишите первое сообщение!</div>`;
            return;
        }

        box.innerHTML = window._hubGlobalChat.map(m => {
            const lk = SAFE_KEY(m.login);
            const prof = GET_PROFILE(lk);
            const mine = lk === myKey;
            const canDel = isAdm || mine;
            const av = prof.avatar
                ? `<img src="${prof.avatar}" class="hub-avatar-sm" title="Профиль @${ESC(lk)}" onclick="OPEN_PUBLIC_USER_PROFILE('${ESC_JS(lk)}')">`
                : `<div class="hub-avatar-sm" title="Профиль @${ESC(lk)}" onclick="OPEN_PUBLIC_USER_PROFILE('${ESC_JS(lk)}')">👤</div>`;
            return `
                <div class="hub-chat-msg ${mine ? 'is-mine' : ''}">
                    ${av}
                    <div style="flex:1; min-width:0;">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:5px; flex-wrap:wrap; margin-bottom:2px;">
                            <div>
                                <b style="color:var(--ui-accent,#d2b278); font-size:0.85rem; cursor:pointer;" onclick="OPEN_PUBLIC_USER_PROFILE('${ESC_JS(lk)}')">${ESC(prof.displayName || m.displayName)}</b>
                                <small style="color:var(--ui-muted,#888); font-size:0.72rem !important; cursor:pointer; margin-left:4px;" title="Обратиться" onclick="HUB_MENTION_USER('${ESC_JS(lk)}')">@${ESC(lk)}</small>
                            </div>
                            <div style="display:flex; align-items:center; gap:4px;">
                                <small style="color:var(--ui-muted,#888); font-size:0.7rem !important;">${ESC(m.date || '')}</small>
                                ${canDel ? `<button data-custom-bg="1" class="btn-small" onclick="HUB_DELETE_CHAT_MSG('${ESC_JS(m.id)}')" style="padding:1px 4px; font-size:0.68rem; background:transparent; color:var(--ui-muted,#888); border:none; box-shadow:none;">✕</button>` : ''}
                            </div>
                        </div>
                        <div style="font-size:0.88rem; color:var(--ui-text,#e5e0d7); word-break:break-word; white-space:pre-wrap; line-height:1.38;">${ESC(m.text)}</div>
                    </div>
                </div>`;
        }).join('');

        if (forceBottom || nearBottom) box.scrollTop = box.scrollHeight;
    }

    function RENDER_ONLINE_STRIP_ONLY() {
        const box = document.getElementById('hub-online-users-strip');
        if (!box) return;
        const byLogin = {};
        const myKey = CUR_LOGIN_KEY();
        if (myKey) byLogin[myKey] = { login: myKey, displayName: GET_PROFILE(myKey).displayName, where: 'На Главной' };
        Object.values(window._hubOnlineUsers || {}).forEach(u => { if (u && u.login) byLogin[SAFE_KEY(u.login)] = u; });

        const list = Object.values(byLogin);
        const cntEl = document.getElementById('hub-online-count');
        if (cntEl) cntEl.textContent = String(list.length);

        box.innerHTML = list.map(u => {
            const lk = SAFE_KEY(u.login);
            const p = GET_PROFILE(lk);
            return `<button data-custom-bg="1" class="btn-small" onclick="OPEN_PUBLIC_USER_PROFILE('${ESC_JS(lk)}')"
                title="${ESC(u.where || 'Онлайн')} — открыть профиль"
                style="padding:3px 8px; border-radius:14px; font-size:0.76rem; background:var(--ui-panel,#221f1c); color:var(--ui-text,#e5e0d7); border:1px solid var(--ui-border,#3e372f); box-shadow:none; display:inline-flex; align-items:center; gap:4px;">
                <span style="color:#6cb878; font-size:0.65rem;">●</span> ${ESC(p.displayName || u.displayName)}
            </button>`;
        }).join('');
    }

    // --- 6. ПРОФИЛЬ И ПУБЛИЧНАЯ КАРТОЧКА (С КНОПКОЙ «✉️ НАПИСАТЬ В ЛИЧКУ») ---
    window.HUB_UPLOAD_PROFILE_AVATAR = function() {
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*';
        inp.onchange = function(e) {
            const f = e.target.files[0]; if (!f) return;
            const reader = new FileReader();
            reader.onload = ev => {
                const img = new Image();
                img.onload = () => {
                    const size = 240, c = document.createElement('canvas');
                    c.width = size; c.height = size;
                    const minS = Math.min(img.width, img.height);
                    c.getContext('2d').drawImage(img, (img.width - minS) / 2, (img.height - minS) / 2, minS, minS, 0, 0, size, size);
                    SAVE_MY_PROFILE({ avatar: c.toDataURL('image/jpeg', 0.82) });
                    RENDER_LOBBY_HTML();
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(f);
        };
        inp.click();
    };

    window.HUB_SAVE_PROFILE_FORM = function() {
        const displayName = (document.getElementById('hub-prof-name')?.value || '').trim();
        const status = (document.getElementById('hub-prof-status')?.value || '').trim();
        const favRole = document.getElementById('hub-prof-role')?.value || 'both';
        const favClass = (document.getElementById('hub-prof-favclass')?.value || '').trim();
        const bio = (document.getElementById('hub-prof-bio')?.value || '').trim();
        if (!displayName || displayName.length < 2) { showMessage('⚠️ Имя слишком короткое', 'Укажите имя (минимум 2 символа).'); return; }
        SAVE_MY_PROFILE({ displayName, status, favRole, favClass, bio });
        window._hubEditingProfile = false;
        RENDER_LOBBY_HTML();
    };

    window.OPEN_PUBLIC_USER_PROFILE = function(loginKey) {
        const key = SAFE_KEY(loginKey);
        if (!key) return;
        const prof = GET_PROFILE(key);
        const roleObj = ROLE_PREFS.find(r => r.id === prof.favRole) || ROLE_PREFS[0];
        const allTpls = (typeof GET_SHARED_TEMPLATES === 'function') ? GET_SHARED_TEMPLATES() : [];
        const userTpls = allTpls.filter(t => !t.hideAuthor && SAFE_KEY(t.authorLogin) === key);
        const allHeroes = (typeof GC === 'function') ? GC() : [];
        const userHeroes = allHeroes.filter(c => c && (SAFE_KEY(c.owner) === key || SAFE_KEY(c.ownerId) === key));

        let m = document.getElementById('hub-public-profile-modal');
        if (!m) {
            m = document.createElement('div');
            m.className = 'modal'; m.id = 'hub-public-profile-modal'; m.style.zIndex = '95400';
            m.innerHTML = `<div class="modal-content" id="hub-public-profile-content" style="max-width:560px; width:95%;"></div>`;
            m.addEventListener('click', e => { if (e.target === m) m.classList.remove('active'); });
            document.body.appendChild(m);
        }

        const cont = document.getElementById('hub-public-profile-content');
        const av = prof.avatar
            ? `<img src="${prof.avatar}" style="width:74px; height:74px; border-radius:50%; object-fit:cover; border:2px solid var(--ui-accent,#d2b278); flex-shrink:0;">`
            : `<div style="width:74px; height:74px; border-radius:50%; background:var(--ui-panel2,#161412); border:2px solid var(--ui-border-strong,#695c4c); display:flex; align-items:center; justify-content:center; font-size:2.1rem; flex-shrink:0;">👤</div>`;
        const isNotMe = key !== CUR_LOGIN_KEY();

        cont.innerHTML = `
            <div style="display:flex; gap:14px; align-items:center; text-align:left; margin-bottom:14px; border-bottom:1px solid var(--ui-border,#3e372f); padding-bottom:12px;">
                ${av}
                <div>
                    <h2 style="margin:0; border:none; padding:0; font-size:1.28rem;">${ESC(prof.displayName)}</h2>
                    <div style="font-size:0.84rem; color:var(--ui-muted,#9a9286);">@${ESC(key)} • ${IS_USER_ONLINE(key) ? '<span style="color:#6cb878;">🟢 в сети</span>' : '⚫ не в сети'}</div>
                    <div style="font-size:0.86rem; color:var(--ui-accent,#d2b278); margin-top:4px;">${ESC(prof.status)}</div>
                </div>
            </div>
            <div style="display:flex; flex-direction:column; gap:10px; text-align:left; font-size:0.9rem;">
                <div style="background:var(--ui-panel2,#161412); border:1px solid var(--ui-border,#3e372f); border-radius:8px; padding:10px 12px;">
                    <div><b>Роль:</b> ${roleObj.label}</div>
                    ${prof.favClass ? `<div style="margin-top:4px;"><b>Любимый класс / раса:</b> ${ESC(prof.favClass)}</div>` : ''}
                    ${prof.bio ? `<div style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--ui-border,#3e372f); white-space:pre-wrap; line-height:1.45;">${ESC(prof.bio)}</div>` : ''}
                </div>
                <div style="display:flex; gap:12px; font-size:0.84rem; color:var(--ui-muted,#aaa);">
                    <span>⚔️ Персонажей: <b>${userHeroes.length}</b></span>
                    <span>🌟 Открытых шаблонов: <b>${userTpls.length}</b></span>
                </div>
                ${userTpls.length ? `<div><div style="font-weight:bold; color:var(--ui-accent,#d2b278); margin-bottom:5px; font-size:0.85rem;">🌟 Шаблоны игрока:</div>${userTpls.map(t => `<div style="display:flex; justify-content:space-between; align-items:center; background:var(--ui-panel2,#161412); border:1px solid var(--ui-border,#3e372f); border-radius:7px; padding:6px 10px; margin-bottom:5px;"><span><b>${ESC(t.charSnapshot?.name || 'Герой')}</b> <small style="color:var(--ui-muted,#888);">(${ESC(t.charSnapshot?.className || '')})</small></span><button class="btn-small btn-save" onclick="document.getElementById('hub-public-profile-modal').classList.remove('active'); window._hubMainTab='play'; window._lobbyStep='player_chars'; PLAYER_USE_SHARED_USER_TEMPLATE('${ESC_JS(t.templateId)}', false);">Взять</button></div>`).join('')}</div>` : ''}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:14px; flex-wrap:wrap;">
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    ${isNotMe ? `<button class="btn-save btn-small" onclick="document.getElementById('hub-public-profile-modal').classList.remove('active'); OPEN_USER_DM_MODAL('${ESC_JS(key)}');">✉️ Написать в личку</button>` : ''}
                    ${isNotMe && window._hubMainTab === 'home' ? `<button class="btn-small" onclick="document.getElementById('hub-public-profile-modal').classList.remove('active'); HUB_MENTION_USER('${ESC_JS(key)}');">💬 Упомянуть в Таверне</button>` : ''}
                </div>
                <button onclick="document.getElementById('hub-public-profile-modal').classList.remove('active')">Закрыть</button>
            </div>
        `;
        m.classList.add('active');
    };

    // --- 7. НАВИГАЦИЯ И ОТРИСОВКА ВКЛАДОК (ДОМ / ПРОФИЛЬ / ИГРАТЬ) ---
    window.SET_HUB_MAIN_TAB = function(tab, subStep, subCharTab) {
        window._hubMainTab = tab;
        window._hubEditingProfile = false;
        if (tab === 'play') {
            if (subStep) window._lobbyStep = subStep;
            if (subCharTab) window._charCreateTab = subCharTab;
        }
        RENDER_LOBBY_HTML();
    };
    window.HUB_QUICK_ENTER_GM = rc => { if (typeof ENTER_ROOM_AS_GM === 'function') ENTER_ROOM_AS_GM(rc); };
    window.HUB_QUICK_PLAY_HERO = hid => { window._hubMainTab = 'play'; if (typeof PLAYER_SELECT_EXISTING_HERO === 'function') PLAYER_SELECT_EXISTING_HERO(hid); };

    function BUILD_HUB_NAV_BAR() {
        const u = CUR_USER();
        const prof = GET_PROFILE(u ? u.login : '');
        const tab = window._hubMainTab || 'home';

        const updatesList = (typeof window.GET_SITE_UPDATES === 'function') ? window.GET_SITE_UPDATES() : [];
        const seenId = parseInt(localStorage.getItem('dnd_last_seen_update_id') || '0', 10);
        const unreadUpd = updatesList.filter(x => x && x.id && Number(x.id) > seenId).length;
        const updBadge = unreadUpd > 0 ? ` <span style="background:#a84848; color:#fff; border-radius:10px; padding:1px 6px; font-size:0.7rem; margin-left:3px; font-weight:bold;">NEW</span>` : '';

        const dmUnread = COUNT_UNREAD_USER_DMS();
        const isRealAdmin = (typeof window.IS_REAL_ADMIN === 'function') && window.IS_REAL_ADMIN();
        const adminBtn = isRealAdmin
            ? (window._adminPreviewAsUser
                ? `<button class="btn-small btn-warn" data-admin-ui="admin" onclick="TOGGLE_ADMIN_PREVIEW_MODE()">👁️ Вид игрока</button>`
                : `<button class="btn-small btn-danger" data-admin-ui="admin" onclick="OPEN_ADMIN_PANEL()">🛡️ Админка</button>`)
            : '';

        const avMini = prof.avatar
            ? `<img src="${prof.avatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover; border:1px solid var(--ui-accent,#d2b278);">`
            : `<span style="width:32px; height:32px; border-radius:50%; background:var(--ui-panel2,#161412); border:1px solid var(--ui-border-strong,#695c4c); display:inline-flex; align-items:center; justify-content:center;">🐉</span>`;

        const tBtn = (id, label) => `<button data-custom-bg="1" class="hub-tab-btn ${tab === id ? 'is-active' : ''}" onclick="SET_HUB_MAIN_TAB('${id}'${id === 'play' ? ", 'role'" : ''})">${label}</button>`;

        return `
            <div class="hub-nav-bar" data-hub-nav="1">
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <div style="display:flex; align-items:center; gap:8px; cursor:pointer;" onclick="SET_HUB_MAIN_TAB('profile')" title="Открыть профиль">
                        ${avMini}
                        <div style="text-align:left; line-height:1.2;">
                            <div style="font-weight:700; color:var(--ui-accent,#d2b278); font-size:0.95rem;">${ESC(prof.displayName)}</div>
                            <div style="font-size:0.74rem; color:var(--ui-muted,#9a9286);">@${ESC(u?.login || '')}</div>
                        </div>
                    </div>
                    <div class="hub-tabs-group">
                        ${tBtn('home', '🏠 Дом')}
                        ${tBtn('profile', '👤 Профиль')}
                        ${tBtn('play', '🎮 Играть')}
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <button class="btn-small" onclick="OPEN_USER_DM_MODAL()" title="Личные сообщения между пользователями">
                        ✉️ Личка <span id="hub-dm-unread-badge" style="display:${dmUnread > 0 ? 'inline-block' : 'none'}; background:#a84848; color:#fff; border-radius:10px; padding:1px 6px; font-size:0.7rem; margin-left:3px; font-weight:bold;">${dmUnread}</span>
                    </button>
                    <button class="btn-small" data-admin-ui="updates" onclick="OPEN_SITE_UPDATES_MODAL()">📢 Обновления${updBadge}</button>
                    ${adminBtn}
                    <button class="btn-small btn-danger" onclick="LOGOUT_ACCOUNT()">🚪 Выйти</button>
                </div>
            </div>
        `;
    }

    function RENDER_HOME_TAB_HTML() {
        const u = CUR_USER();
        const prof = GET_PROFILE(u.login);
        const rooms = (typeof GET_ROOMS === 'function') ? GET_ROOMS() : [];
        const cs = (typeof GC === 'function') ? GC() : [];
        const myHeroes = cs.filter(c => typeof IS_MY_HERO === 'function' && IS_MY_HERO(c, u));
        const updates = (typeof window.GET_SITE_UPDATES === 'function') ? window.GET_SITE_UPDATES().slice(0, 6) : [];
        const f = window._hubFeedFilter || 'all';

        const roomsHTML = rooms.slice(0, 5).map(r => {
            const meta = (typeof GET_ROOM_META === 'function') ? GET_ROOM_META(r.code) : { hasPassword: false, settings: {} };
            const badges = [];
            if (meta.hasPassword) badges.push('🔒');
            if (meta.settings?.inspMode === 'bg3') badges.push('🔥BG3');
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:7px; padding:7px 9px; background:var(--ui-panel2,#161412); border:1px solid var(--ui-border,#3e372f); border-radius:8px; margin-bottom:6px; text-align:left;">
                    <div style="min-width:0;">
                        <div style="font-weight:700; font-size:0.84rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">🏰 #${ESC(r.code)} — ${ESC(r.name)} ${badges.join(' ')}</div>
                        ${meta.ownerName ? `<small style="color:var(--ui-muted,#888); font-size:0.72rem !important;">👑 ${ESC(meta.ownerName)}</small>` : ''}
                    </div>
                    <button class="btn-small btn-save" style="padding:4px 8px; font-size:0.75rem;" onclick="SET_HUB_MAIN_TAB('play', 'player_chars', 'my')">Войти</button>
                </div>`;
        }).join('');

        const updatesHTML = updates.length
            ? updates.map(up => `
                <div style="padding:9px 11px; background:var(--ui-panel2,#161412); border:1px solid var(--ui-border,#3e372f); border-radius:8px; text-align:left; cursor:pointer;" onclick="OPEN_SITE_UPDATES_MODAL()">
                    <div style="display:flex; justify-content:space-between; gap:6px; align-items:center; margin-bottom:3px;">
                        <b style="color:var(--ui-accent,#d2b278); font-size:0.85rem;">${up.version ? `[${ESC(up.version)}] ` : ''}${ESC(up.title)}</b>
                        <small style="color:var(--ui-muted,#888); font-size:0.71rem !important; flex-shrink:0;">${ESC(up.date || '')}</small>
                    </div>
                    <div style="font-size:0.8rem; color:var(--ui-muted,#aaa); line-height:1.38; max-height:66px; overflow:hidden; white-space:pre-wrap;">${ESC(up.body)}</div>
                </div>`).join('')
            : `<div style="color:var(--ui-muted,#888); font-size:0.84rem; padding:14px; text-align:center;">Записей об обновлениях пока нет</div>`;

        const fBtn = (id, label) => `<button class="btn-small ${f === id ? 'btn-save' : ''}" data-hub-feed-filter="${id}" style="padding:4px 9px; font-size:0.78rem;" onclick="HUB_SET_FEED_FILTER('${id}')">${label}</button>`;

        return `
            <div class="hub-home-grid">
                <!-- 1. ЛЕВАЯ КОЛОНКА: БЫСТРЫЙ СТАРТ, КАМПАНИИ, РАСТЯНУТЫЕ ОБНОВЛЕНИЯ -->
                <div class="hub-left-col">
                    <div class="panel" style="text-align:left;">
                        <h2 style="margin-top:0; font-size:1.08rem;">🎮 Быстрый старт</h2>
                        <p style="font-size:0.84rem; color:var(--ui-muted,#aaa); margin-bottom:10px; line-height:1.38;">
                            <b style="color:var(--ui-accent,#d2b278);">${ESC(prof.status)}</b> • Героев: <b>${myHeroes.length}</b>
                        </p>
                        <button class="btn-save" style="width:100%; padding:10px; font-size:0.95rem; margin-bottom:7px;" onclick="SET_HUB_MAIN_TAB('play', 'role')">
                            ⚔️ Играть (Игрок / Мастер) ➡️
                        </button>
                        <div style="display:flex; gap:6px;">
                            <button class="btn-small" style="flex:1; padding:7px;" onclick="SET_HUB_MAIN_TAB('play', 'player_chars', 'my')">🛡️ Герои</button>
                            <button class="btn-small" style="flex:1; padding:7px;" onclick="SET_HUB_MAIN_TAB('play', 'gm_rooms')">👑 Стол ГМ</button>
                        </div>
                    </div>

                    <div class="panel" style="text-align:left;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <h2 style="margin:0; border:none; padding:0; font-size:1.04rem;">🏰 Кампании (${rooms.length})</h2>
                            <button class="btn-small" style="padding:3px 8px; font-size:0.74rem;" onclick="SET_HUB_MAIN_TAB('play', 'gm_rooms')">+ Создать</button>
                        </div>
                        ${roomsHTML || '<div style="color:var(--ui-muted,#888); font-size:0.84rem;">Комнат пока нет</div>'}
                    </div>

                    <div class="panel hub-updates-panel">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:9px;">
                            <h2 style="margin:0; border:none; padding:0; font-size:1.04rem;">📢 Последние обновления</h2>
                            <button class="btn-small" style="padding:3px 8px; font-size:0.74rem;" onclick="OPEN_SITE_UPDATES_MODAL()">Все →</button>
                        </div>
                        <div class="hub-updates-scroll">
                            ${updatesHTML}
                        </div>
                    </div>
                </div>

                <!-- 2. ЦЕНТРАЛЬНАЯ КОЛОНКА: ЛЕНТА ТАВЕРНЫ -->
                <div class="panel hub-feed-panel">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                        <h2 style="margin:0; border:none; padding:0; font-size:1.15rem;">📰 Лента</h2>
                        <div style="display:flex; gap:5px; flex-wrap:wrap;">
                            ${fBtn('all', 'Всё')}
                            ${fBtn('posts', '💬 Посты')}
                            ${fBtn('templates', '🌟 Шаблоны')}
                            ${fBtn('updates', '📢 Новости')}
                        </div>
                    </div>

                    <div style="background:var(--ui-panel2,#161412); border:1px solid var(--ui-border,#3e372f); border-radius:10px; padding:10px;">
                        <textarea id="hub-feed-post-inp" style="min-height:62px; margin-bottom:8px; font-size:0.88rem;" placeholder="Поделиться новостью, позвать в партию или написать заметку в Ленту..."></textarea>
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                            <select id="hub-feed-post-tag" style="width:auto; padding:5px 9px; font-size:0.82rem; text-align:left;">
                                ${FEED_TAGS.map(t => `<option value="${t.id}">${t.label}</option>`).join('')}
                            </select>
                            <button class="btn-small btn-save" style="padding:6px 14px;" onclick="HUB_PUBLISH_FEED_POST()">📝 Опубликовать</button>
                        </div>
                    </div>

                    <div id="hub-feed-stream" style="display:flex; flex-direction:column; gap:10px;"></div>
                </div>

                <!-- 3. ПРАВАЯ КОЛОНКА: ОБЩИЙ ЧАТ ТАВЕРНЫ -->
                <div class="panel hub-chat-box">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; margin-bottom:8px; flex-wrap:wrap;">
                        <h2 style="margin:0; border:none; padding:0; font-size:1.1rem;">🍺 Общий чат</h2>
                        <small style="color:var(--ui-muted,#9a9286);">Чат пользователей</small>
                    </div>

                    <div style="background:var(--ui-panel2,#161412); border:1px solid var(--ui-border,#3e372f); border-radius:8px; padding:6px 9px; margin-bottom:9px; text-align:left;">
                        <div style="font-size:0.74rem; color:var(--ui-muted,#aaa); margin-bottom:4px;">🟢 На сайте (<b id="hub-online-count">1</b>):</div>
                        <div id="hub-online-users-strip" style="display:flex; gap:5px; flex-wrap:wrap;"></div>
                    </div>

                    <div id="hub-chat-messages" class="hub-chat-messages"></div>

                    <div style="display:flex; gap:6px;">
                        <input type="text" id="hub-global-chat-inp"
                            placeholder="Написать в Таверну..."
                            onkeypress="if(event.key==='Enter'){ event.preventDefault(); HUB_SEND_CHAT_MSG(); }"
                            style="flex:1; padding:8px 10px; text-align:left; border-radius:8px; font-size:0.88rem;">
                        <button class="btn-save" style="padding:8px 12px;" onclick="HUB_SEND_CHAT_MSG()">➡️</button>
                    </div>
                </div>
            </div>
        `;
    }

    function RENDER_PROFILE_TAB_HTML() {
        const u = CUR_USER();
        const key = SAFE_KEY(u.login);
        const prof = GET_PROFILE(key);
        const cs = (typeof GC === 'function') ? GC() : [];
        const myHeroes = cs.filter(c => typeof IS_MY_HERO === 'function' && IS_MY_HERO(c, u));
        const rooms = (typeof GET_ROOMS === 'function') ? GET_ROOMS() : [];
        const myGmRooms = rooms.filter(r => {
            const meta = (typeof GET_ROOM_META === 'function') ? GET_ROOM_META(r.code) : {};
            return meta.ownerLogin === key || (Array.isArray(meta.coMasters) && meta.coMasters.includes(key));
        });
        const allTpls = (typeof GET_SHARED_TEMPLATES === 'function') ? GET_SHARED_TEMPLATES() : [];
        const myTpls = allTpls.filter(t => SAFE_KEY(t.authorLogin) === key);

        const joinedRoomsSet = new Set();
        let maxLv = 1;
        myHeroes.forEach(h => {
            if ((h.level || 1) > maxLv) maxLv = h.level || 1;
            if (h.roomProgress) Object.entries(h.roomProgress).forEach(([rk, rp]) => { joinedRoomsSet.add(rk); if (rp && (rp.level || 1) > maxLv) maxLv = rp.level || 1; });
        });
        myGmRooms.forEach(r => joinedRoomsSet.add(String(r.code)));

        const avBig = prof.avatar
            ? `<img src="${prof.avatar}" style="width:92px; height:92px; border-radius:50%; object-fit:cover; border:2px solid var(--ui-accent,#d2b278);">`
            : `<div style="width:92px; height:92px; border-radius:50%; background:var(--ui-panel,#221f1c); border:2px dashed var(--ui-border-strong,#695c4c); display:flex; align-items:center; justify-content:center; font-size:2.4rem;">👤</div>`;
        const roleLabel = (ROLE_PREFS.find(r => r.id === prof.favRole) || ROLE_PREFS[0]).label;

        const headerBlock = window._hubEditingProfile ? `
            <div class="hub-profile-banner" style="flex-direction:column; align-items:stretch;">
                <h2 style="margin-top:0;">✏️ Редактирование профиля</h2>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                    <div><label style="font-size:0.82rem; color:var(--ui-muted,#aaa);">Отображаемое имя:</label><input type="text" id="hub-prof-name" value="${ESC(prof.displayName)}" style="margin-top:4px; text-align:left;"></div>
                    <div><label style="font-size:0.82rem; color:var(--ui-muted,#aaa);">Предпочитаемая роль:</label><select id="hub-prof-role" style="margin-top:4px; text-align:left;">${ROLE_PREFS.map(r => `<option value="${r.id}" ${prof.favRole === r.id ? 'selected' : ''}>${r.label}</option>`).join('')}</select></div>
                    <div>
                        <label style="font-size:0.82rem; color:var(--ui-muted,#aaa);">Статус:</label>
                        <input type="text" id="hub-prof-status" value="${ESC(prof.status)}" style="margin-top:4px; text-align:left;">
                        <div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:5px;">${STATUS_PRESETS.map(p => `<button class="btn-small" style="padding:2px 6px; font-size:0.72rem;" onclick="document.getElementById('hub-prof-status').value='${ESC_JS(p)}'">${ESC(p)}</button>`).join('')}</div>
                    </div>
                    <div><label style="font-size:0.82rem; color:var(--ui-muted,#aaa);">Любимый класс / раса:</label><input type="text" id="hub-prof-favclass" value="${ESC(prof.favClass)}" placeholder="Напр.: Тифлинг-Колдун" style="margin-top:4px; text-align:left;"></div>
                </div>
                <div><label style="font-size:0.82rem; color:var(--ui-muted,#aaa);">О себе:</label><textarea id="hub-prof-bio" style="min-height:80px; margin-top:4px;">${ESC(prof.bio)}</textarea></div>
                <div style="display:flex; gap:8px; justify-content:flex-end;">
                    <button class="btn-save" onclick="HUB_SAVE_PROFILE_FORM()">💾 Сохранить профиль</button>
                    <button onclick="window._hubEditingProfile=false; RENDER_LOBBY_HTML();">Отмена</button>
                </div>
            </div>
        ` : `
            <div class="hub-profile-banner">
                <div style="display:flex; flex-direction:column; align-items:center; gap:6px;">
                    ${avBig}
                    <button class="btn-small" style="padding:3px 8px; font-size:0.74rem;" onclick="HUB_UPLOAD_PROFILE_AVATAR()">📷 Фото</button>
                </div>
                <div style="flex:1; min-width:240px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap;">
                        <div>
                            <h2 style="margin:0; border:none; padding:0; font-size:1.45rem;">${ESC(prof.displayName)}</h2>
                            <div style="color:var(--ui-muted,#9a9286); font-size:0.86rem;">Логин: <b>@${ESC(key)}</b>${prof.createdAt ? ` • с ${ESC(prof.createdAt)}` : ''}</div>
                        </div>
                        <button class="btn-small" onclick="window._hubEditingProfile=true; RENDER_LOBBY_HTML();">✏️ Редактировать</button>
                    </div>
                    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; font-size:0.84rem;">
                        <span style="background:var(--ui-panel,#221f1c); border:1px solid var(--ui-accent,#d2b278); color:var(--ui-accent,#d2b278); padding:3px 10px; border-radius:14px;">${ESC(prof.status)}</span>
                        <span style="background:var(--ui-panel,#221f1c); border:1px solid var(--ui-border,#3e372f); padding:3px 10px; border-radius:14px;">${roleLabel}</span>
                        ${prof.favClass ? `<span style="background:var(--ui-panel,#221f1c); border:1px solid var(--ui-border,#3e372f); padding:3px 10px; border-radius:14px;">✨ ${ESC(prof.favClass)}</span>` : ''}
                    </div>
                    ${prof.bio ? `<div style="margin-top:10px; font-size:0.9rem; white-space:pre-wrap; line-height:1.45;">${ESC(prof.bio)}</div>` : ''}
                </div>
            </div>
        `;

        const heroesHTML = myHeroes.length
            ? myHeroes.map(h => {
                const rKeys = h.roomProgress ? Object.keys(h.roomProgress) : [];
                const badges = rKeys.length
                    ? rKeys.map(rk => `<span style="background:var(--ui-panel,#221f1c); border:1px solid var(--ui-border,#3e372f); padding:2px 7px; border-radius:6px; font-size:0.75rem; color:var(--ui-accent,#d2b278);">#${rk}: ${h.roomProgress[rk].level || 1} ур.</span>`).join(' ')
                    : '<span style="font-size:0.78rem; color:var(--ui-muted,#888);">Стартовый 1 ур.</span>';
                return `
                    <div style="background:var(--ui-panel2,#161412); border:1px solid var(--ui-border,#3e372f); border-radius:10px; padding:12px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:8px; text-align:left;">
                        <div style="display:flex; align-items:center; gap:11px; flex:1; min-width:210px;">
                            ${h.avatar ? `<img src="${h.avatar}" style="width:46px; height:46px; border-radius:50%; object-fit:cover; border:2px solid var(--ui-accent,#d2b278);">` : `<div style="width:46px; height:46px; border-radius:50%; background:var(--ui-panel,#221f1c); border:1px dashed var(--ui-border,#555); display:flex; align-items:center; justify-content:center; font-size:1.3rem;">🛡️</div>`}
                            <div>
                                <div style="font-weight:700; color:var(--ui-accent,#d2b278);">${ESC(h.name || 'Герой')}</div>
                                <div style="font-size:0.82rem; color:var(--ui-muted,#aaa); margin-bottom:4px;">${ESC(h.race || 'Раса не выбрана')}${h.subrace ? ` (${ESC(h.subrace)})` : ''} • ${ESC(h.className || 'Класс не выбран')}</div>
                                <div style="display:flex; gap:5px; flex-wrap:wrap;">${badges}</div>
                            </div>
                        </div>
                        <div style="display:flex; gap:6px; flex-wrap:wrap;">
                            <button class="btn-small" onclick="PLAYER_EDIT_HERO_SHEET_IN_LOBBY('${ESC_JS(h.id)}')">📋 Лист</button>
                            <button class="btn-small" onclick="OPEN_SHARE_CHAR_MODAL('${ESC_JS(h.id)}')">📤 Шаблон</button>
                            <button class="btn-small btn-save" onclick="HUB_QUICK_PLAY_HERO('${ESC_JS(h.id)}')">⚔️ Играть</button>
                        </div>
                    </div>`;
            }).join('')
            : `<div style="padding:22px; text-align:center; background:var(--ui-panel2,#161412); border:1px dashed var(--ui-border,#3e372f); border-radius:10px; color:var(--ui-muted,#888);">Персонажей пока нет — создайте героя или выберите шаблон во вкладке «🎮 Играть».</div>`;

        const gmRoomsHTML = myGmRooms.length
            ? myGmRooms.map(r => `<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:9px 12px; background:var(--ui-panel2,#161412); border:1px solid var(--ui-border,#3e372f); border-radius:8px; margin-bottom:6px; text-align:left;"><span>👑 <b>#${ESC(r.code)}</b> — ${ESC(r.name)}</span><button class="btn-small btn-save" onclick="HUB_QUICK_ENTER_GM('${ESC_JS(r.code)}')">Открыть стол ГМ ➡️</button></div>`).join('')
            : `<div style="font-size:0.86rem; color:var(--ui-muted,#888); padding:8px 0;">Закреплённых за вами комнат пока нет.</div>`;

        return `
            <div class="panel">
                ${headerBlock}
                <div class="hub-stat-grid">
                    <div class="hub-stat-card"><div style="font-size:1.4rem; font-weight:800; color:var(--ui-accent,#d2b278);">${myHeroes.length}</div><div style="font-size:0.78rem; color:var(--ui-muted,#aaa);">Личных героев</div></div>
                    <div class="hub-stat-card"><div style="font-size:1.4rem; font-weight:800;">${joinedRoomsSet.size}</div><div style="font-size:0.78rem; color:var(--ui-muted,#aaa);">Кампаний</div></div>
                    <div class="hub-stat-card"><div style="font-size:1.4rem; font-weight:800; color:#6cb878;">${myHeroes.length ? maxLv : '—'}</div><div style="font-size:0.78rem; color:var(--ui-muted,#aaa);">Макс. уровень</div></div>
                    <div class="hub-stat-card"><div style="font-size:1.4rem; font-weight:800; color:var(--ui-accent,#d2b278);">${myTpls.length}</div><div style="font-size:0.78rem; color:var(--ui-muted,#aaa);">Шаблонов</div></div>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
                    <h2 style="margin:0; border:none; padding:0; font-size:1.15rem;">⚔️ Мои персонажи (${myHeroes.length})</h2>
                    <div style="display:flex; gap:6px;">
                        <button class="btn-small btn-save" onclick="SET_HUB_MAIN_TAB('play', 'player_chars', 'create')">➕ Создать героя</button>
                        <button class="btn-small" onclick="SET_HUB_MAIN_TAB('play', 'role')">🎮 К игре</button>
                    </div>
                </div>
                ${heroesHTML}
                <div style="margin-top:16px; padding-top:12px; border-top:1px solid var(--ui-border,#3e372f); text-align:left;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <h3 style="margin:0;">👑 Мои кампании как Гейм-Мастера (${myGmRooms.length})</h3>
                        <button class="btn-small" onclick="SET_HUB_MAIN_TAB('play', 'gm_rooms')">+ Создать кампанию</button>
                    </div>
                    ${gmRoomsHTML}
                </div>
            </div>
        `;
    }

    // --- 8. ХУКИ В RENDER_LOBBY_HTML И СМЕНУ АККАУНТА ---
    const _ORIG_LOBBY_HUB = window.RENDER_LOBBY_HTML;
    if (typeof _ORIG_LOBBY_HUB === 'function') {
        window.RENDER_LOBBY_HTML = function() {
            ENSURE_HUB_CSS();
            const lobby = document.getElementById('lobby-screen');
            const u = CUR_USER();
            if (!lobby || !u) return _ORIG_LOBBY_HUB();

            SYNC_USER_DM_INBOX();
            const tab = window._hubMainTab || 'home';

            if (tab === 'play') {
                _ORIG_LOBBY_HUB();
                const oldBar = lobby.firstElementChild;
                const navWrap = document.createElement('div');
                navWrap.className = 'hub-shell';
                navWrap.style.marginBottom = '12px';
                navWrap.innerHTML = BUILD_HUB_NAV_BAR();
                if (oldBar && oldBar.querySelector('button[onclick="LOGOUT_ACCOUNT()"]')) {
                    if (window._lobbyStep && window._lobbyStep !== 'role') {
                        const backWrap = document.createElement('div');
                        backWrap.style.cssText = 'max-width:1040px; margin:0 auto 10px auto; text-align:left;';
                        backWrap.innerHTML = `<button class="btn-small" onclick="window._lobbyStep='role'; RENDER_LOBBY_HTML();">⬅️ Назад к выбору роли (Игрок / Мастер)</button>`;
                        oldBar.after(backWrap);
                    }
                    oldBar.replaceWith(navWrap);
                } else {
                    lobby.prepend(navWrap);
                }
                return;
            }

            const bodyHTML = (tab === 'profile') ? RENDER_PROFILE_TAB_HTML() : RENDER_HOME_TAB_HTML();
            lobby.innerHTML = `
                <div class="hub-shell ${tab === 'home' ? 'is-wide' : ''}">
                    ${BUILD_HUB_NAV_BAR()}
                    ${bodyHTML}
                </div>
            `;

            if (tab === 'home') {
                RENDER_ONLINE_STRIP_ONLY();
                RENDER_GLOBAL_CHAT_ONLY(true);
                RENDER_FEED_ITEMS_ONLY();
            }
        };
    }

    const _ORIG_LOGOUT_HUB = window.LOGOUT_ACCOUNT;
    if (typeof _ORIG_LOGOUT_HUB === 'function') {
        window.LOGOUT_ACCOUNT = function() {
            REMOVE_HUB_PRESENCE();
            if (dmInboxRef) { dmInboxRef.off(); dmInboxRef = null; }
            if (dmThreadRef) { dmThreadRef.off(); dmThreadRef = null; }
            dmInboxOwner = '';
            dmThreadIdActive = '';
            window._hubDmInbox = {};
            window._hubDmActivePeer = null;
            return _ORIG_LOGOUT_HUB();
        };
    }

    const _ORIG_APPLY_HUB = window.APPLY_ROLE_VIEW;
    if (typeof _ORIG_APPLY_HUB === 'function') {
        window.APPLY_ROLE_VIEW = function() {
            _ORIG_APPLY_HUB();
            PUBLISH_HUB_PRESENCE();
            SYNC_USER_DM_INBOX();
        };
    }

    window.addEventListener('beforeunload', REMOVE_HUB_PRESENCE);
    SYNC_HUB_CLOUD();
    if (!CUR_USER() || (typeof GET_SESSION === 'function' && GET_SESSION())) return;
    if (typeof RENDER_LOBBY_HTML === 'function') RENDER_LOBBY_HTML();
})();