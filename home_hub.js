// ================================================================
// 🏠 ГЛАВНАЯ СТРАНИЦА (ДОМ), ОБЩИЙ ЧАТ ПОЛЬЗОВАТЕЛЕЙ, ПРОФИЛЬ И ВКЛАДКА «ИГРАТЬ»
// (home_hub.js) — полная совместимость с auth.js, admin.js, room_rules.js и ui_settings.js
// ================================================================
(function INIT_HOME_HUB_AND_PROFILES() {
    const FB_ROOT = "https://dnds-23b7d-default-rtdb.firebaseio.com/campaign_v2";
    const MY_HUB_CLIENT_ID = 'hub_' + Math.random().toString(36).slice(2, 8) + '_' + Date.now();

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

    window._hubMainTab = 'home';        // 'home' | 'profile' | 'play'
    window._hubEditingProfile = false;
    window._hubProfilesCache = {};      // { [loginKey]: { avatar, bio, status, favRole, favClass, updatedAt } }
    window._hubGlobalChat = [];         // [{ id, login, displayName, text, ts, date }]
    window._hubOnlineUsers = {};        // { [clientId]: { login, displayName, where, ts } }

    let hubPresenceRef = null;
    let hubChatListenerBound = false;

    const ESC = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const ESC_JS = s => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const SAFE_KEY = s => String(s || '').toLowerCase().trim().replace(/[.#$\[\]\/]/g, '_');

    function CUR_USER() {
        return (typeof GET_CURRENT_USER === 'function') ? GET_CURRENT_USER() : null;
    }

    function CUR_LOGIN_KEY() {
        const u = CUR_USER();
        return u && u.login ? SAFE_KEY(u.login) : '';
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

    function SAVE_MY_PROFILE(patch) {
        const u = CUR_USER();
        if (!u || !u.login) return;
        const key = SAFE_KEY(u.login);
        const cur = GET_PROFILE(key);
        const next = Object.assign({}, cur, patch, { updatedAt: Date.now() });
        window._hubProfilesCache[key] = next;

        try {
            localStorage.setItem('dnd_hub_profiles_v1', JSON.stringify(window._hubProfilesCache));
        } catch (e) {}

        // Синхронизируем отображаемое имя с аккаунтом, если поменялось
        if (patch.displayName && patch.displayName !== u.displayName) {
            u.displayName = patch.displayName;
            if (typeof SAVE_CURRENT_USER === 'function') SAVE_CURRENT_USER(u);
            if (typeof GET_ACCOUNTS === 'function' && typeof SAVE_ACCOUNTS === 'function') {
                const accs = GET_ACCOUNTS();
                if (accs[key]) {
                    accs[key].displayName = patch.displayName;
                    SAVE_ACCOUNTS(accs);
                }
            }
        }

        if (window.firebase && firebase.apps && firebase.apps.length) {
            firebase.database().ref(`campaign_v2/user_profiles/${key}`).set(next).catch(() => {});
        } else {
            fetch(`${FB_ROOT}/user_profiles/${encodeURIComponent(key)}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(next)
            }).catch(() => {});
        }
        PUBLISH_HUB_PRESENCE();
    }

    // --- 1. СТИЛИ ХАБА (НАТИВНО ПОД ВСЕ 12 ПАЛИТР И МОБИЛКУ) ---
    function ENSURE_HUB_CSS() {
        if (document.getElementById('home-hub-css')) return;
        const st = document.createElement('style');
        st.id = 'home-hub-css';
        st.textContent = `
            .hub-shell {
                max-width: 1120px;
                margin: 12px auto 24px auto;
            }
            .hub-nav-bar {
                background: var(--ui-panel, #221f1c);
                border: 1px solid var(--ui-border-strong, #695c4c);
                border-radius: 12px;
                padding: 10px 14px;
                margin-bottom: 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                flex-wrap: wrap;
                gap: 10px;
                box-shadow: var(--ui-shadow, 0 4px 14px rgba(0,0,0,0.34));
            }
            .hub-tabs-group {
                display: flex;
                gap: 6px;
                background: var(--ui-panel2, #161412);
                border: 1px solid var(--ui-border, #3e372f);
                border-radius: 9px;
                padding: 4px;
                flex-wrap: wrap;
            }
            .hub-tab-btn {
                padding: 7px 14px !important;
                border-radius: 7px !important;
                font-size: 0.9rem !important;
                font-weight: 600 !important;
                cursor: pointer;
                box-shadow: none !important;
                border: 1px solid transparent !important;
                background: transparent !important;
                color: var(--ui-muted, #a69e92) !important;
            }
            .hub-tab-btn.is-active {
                background: var(--ui-btn-bg, #c8a66a) !important;
                color: var(--ui-btn-text, #1a150f) !important;
                border-color: var(--ui-accent, #d2b278) !important;
            }
            .hub-home-grid {
                display: grid;
                grid-template-columns: 1.45fr 1fr;
                gap: 16px;
                align-items: start;
            }
            .hub-chat-box {
                display: flex;
                flex-direction: column;
                height: 520px;
                min-height: 360px;
            }
            .hub-chat-messages {
                flex: 1;
                overflow-y: auto;
                background: var(--ui-panel2, #161412);
                border: 1px solid var(--ui-border, #3e372f);
                border-radius: 9px;
                padding: 10px;
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-bottom: 10px;
            }
            .hub-chat-msg {
                background: var(--ui-chat-msg, #24211d);
                border: 1px solid var(--ui-border, #3e372f);
                border-radius: 9px;
                padding: 8px 11px;
                display: flex;
                gap: 10px;
                align-items: flex-start;
                text-align: left;
            }
            .hub-chat-msg.is-mine {
                border-left: 3px solid var(--ui-accent, #d2b278);
            }
            .hub-avatar-sm {
                width: 34px;
                height: 34px;
                border-radius: 50%;
                object-fit: cover;
                border: 1px solid var(--ui-accent, #d2b278);
                background: var(--ui-panel, #221f1c);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 0.95rem;
                flex-shrink: 0;
                cursor: pointer;
            }
            .hub-profile-banner {
                display: flex;
                gap: 18px;
                align-items: center;
                flex-wrap: wrap;
                background: var(--ui-panel2, #161412);
                border: 1px solid var(--ui-border-strong, #695c4c);
                border-radius: 12px;
                padding: 18px;
                margin-bottom: 16px;
                text-align: left;
            }
            .hub-stat-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 10px;
                margin-bottom: 16px;
            }
            .hub-stat-card {
                background: var(--ui-panel2, #161412);
                border: 1px solid var(--ui-border, #3e372f);
                border-radius: 10px;
                padding: 12px 10px;
                text-align: center;
            }
            @media (max-width: 900px) {
                .hub-home-grid { grid-template-columns: 1fr !important; }
                .hub-chat-box { height: 420px; }
                .hub-stat-grid { grid-template-columns: repeat(2, 1fr) !important; }
            }
        `;
        document.head.appendChild(st);
    }

    // --- 2. ОБЛАЧНАЯ СИНХРОНИЗАЦИЯ (ЧАТ ТАВЕРНЫ, ПРОФИЛИ, ОНЛАЙН НА САЙТЕ) ---
    function NORMALIZE_CHAT(val) {
        if (!val || typeof val !== 'object') return [];
        return Object.values(val)
            .filter(m => m && m.id && m.text)
            .sort((a, b) => (a.ts || 0) - (b.ts || 0))
            .slice(-120);
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
        if (hubPresenceRef) {
            hubPresenceRef.remove().catch(() => {});
            hubPresenceRef = null;
        }
    }

    function SYNC_HUB_CLOUD() {
        try {
            const cachedP = localStorage.getItem('dnd_hub_profiles_v1');
            if (cachedP) window._hubProfilesCache = JSON.parse(cachedP) || {};
        } catch (e) {}

        // Начальная REST-загрузка профилей и чата
        Promise.all([
            fetch(`${FB_ROOT}/user_profiles.json`).then(r => r.ok ? r.json() : null).catch(() => null),
            fetch(`${FB_ROOT}/global_tavern_chat.json`).then(r => r.ok ? r.json() : null).catch(() => null)
        ]).then(([profs, chat]) => {
            if (profs && typeof profs === 'object') {
                window._hubProfilesCache = Object.assign({}, window._hubProfilesCache, profs);
                try { localStorage.setItem('dnd_hub_profiles_v1', JSON.stringify(window._hubProfilesCache)); } catch (e) {}
            }
            if (chat) {
                window._hubGlobalChat = NORMALIZE_CHAT(chat);
            }
            REFRESH_HUB_DYNAMIC_PARTS();
        });

        // Живые слушатели Firebase
        const attach = () => {
            if (hubChatListenerBound) return true;
            if (window.firebase && firebase.apps && firebase.apps.length) {
                hubChatListenerBound = true;
                const root = firebase.database().ref('campaign_v2');

                root.child('global_tavern_chat').limitToLast(120).on('value', (snap) => {
                    window._hubGlobalChat = NORMALIZE_CHAT(snap.val());
                    RENDER_GLOBAL_CHAT_MESSAGES_ONLY();
                });

                root.child('user_profiles').on('value', (snap) => {
                    const val = snap.val();
                    if (val && typeof val === 'object') {
                        window._hubProfilesCache = val;
                        try { localStorage.setItem('dnd_hub_profiles_v1', JSON.stringify(val)); } catch (e) {}
                        REFRESH_HUB_DYNAMIC_PARTS();
                    }
                });

                root.child('hub_presence').on('value', (snap) => {
                    window._hubOnlineUsers = snap.val() || {};
                    RENDER_ONLINE_STRIP_ONLY();
                });

                PUBLISH_HUB_PRESENCE();
                return true;
            }
            return false;
        };

        if (!attach()) {
            const t = setInterval(() => { if (attach()) clearInterval(t); }, 650);
            setTimeout(() => clearInterval(t), 25000);
        }
    }

    function REFRESH_HUB_DYNAMIC_PARTS() {
        if ((typeof GET_SESSION === 'function' && GET_SESSION()) || !CUR_USER()) return;
        const lobby = document.getElementById('lobby-screen');
        if (!lobby || lobby.style.display === 'none') return;
        if (window._hubMainTab === 'home') {
            RENDER_GLOBAL_CHAT_MESSAGES_ONLY();
            RENDER_ONLINE_STRIP_ONLY();
        } else if (window._hubMainTab === 'profile' && !window._hubEditingProfile) {
            RENDER_LOBBY_HTML();
        }
    }

    // --- 3. ОБЩИЙ ЧАТ ПОЛЬЗОВАТЕЛЕЙ (ТАВЕРНА) ---
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
        const timeStr = d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const dateStr = d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' }) + ' ' + timeStr;

        const msg = {
            id,
            login: SAFE_KEY(u.login),
            displayName: prof.displayName || u.displayName || u.login,
            text: text.slice(0, 600),
            ts: now,
            date: dateStr
        };

        if (inp) inp.value = '';
        window._hubGlobalChat.push(msg);
        if (window._hubGlobalChat.length > 120) window._hubGlobalChat.shift();
        RENDER_GLOBAL_CHAT_MESSAGES_ONLY(true);

        if (window.firebase && firebase.apps && firebase.apps.length) {
            firebase.database().ref(`campaign_v2/global_tavern_chat/${id}`).set(msg).catch(() => {});
        } else {
            fetch(`${FB_ROOT}/global_tavern_chat/${encodeURIComponent(id)}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(msg)
            }).catch(() => {});
        }
    };

    window.HUB_DELETE_CHAT_MSG = function(msgId) {
        const u = CUR_USER();
        const isAdm = (typeof window.IS_ADMIN === 'function') && window.IS_ADMIN();
        const msg = window._hubGlobalChat.find(m => m.id === msgId);
        if (!msg) return;
        if (!isAdm && (!u || SAFE_KEY(u.login) !== SAFE_KEY(msg.login))) return;
        if (!confirm('Удалить это сообщение из общего чата?')) return;

        window._hubGlobalChat = window._hubGlobalChat.filter(m => m.id !== msgId);
        RENDER_GLOBAL_CHAT_MESSAGES_ONLY();

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

    function RENDER_GLOBAL_CHAT_MESSAGES_ONLY(forceScrollBottom = false) {
        const box = document.getElementById('hub-chat-messages');
        if (!box) return;
        const wasNearBottom = (box.scrollHeight - box.scrollTop - box.clientHeight) < 80;
        const myKey = CUR_LOGIN_KEY();
        const isAdm = (typeof window.IS_ADMIN === 'function') && window.IS_ADMIN();

        if (!window._hubGlobalChat.length) {
            box.innerHTML = `<div style="margin:auto; text-align:center; color:var(--ui-muted,#888); padding:24px; font-size:0.9rem;">🍺 В общей Таверне пока тихо.<br>Напишите первое сообщение — позовите друзей в партию или обсудите билды!</div>`;
            return;
        }

        box.innerHTML = window._hubGlobalChat.map(m => {
            const lKey = SAFE_KEY(m.login);
            const prof = GET_PROFILE(lKey);
            const mine = lKey === myKey;
            const canDel = isAdm || mine;
            const avHTML = prof.avatar
                ? `<img src="${prof.avatar}" class="hub-avatar-sm" title="Открыть профиль @${ESC(lKey)}" onclick="OPEN_PUBLIC_USER_PROFILE('${ESC_JS(lKey)}')">`
                : `<div class="hub-avatar-sm" title="Открыть профиль @${ESC(lKey)}" onclick="OPEN_PUBLIC_USER_PROFILE('${ESC_JS(lKey)}')">👤</div>`;

            return `
                <div class="hub-chat-msg ${mine ? 'is-mine' : ''}">
                    ${avHTML}
                    <div style="flex:1; min-width:0;">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:2px;">
                            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                                <b style="color:var(--ui-accent, #d2b278); font-size:0.88rem; cursor:pointer;" onclick="OPEN_PUBLIC_USER_PROFILE('${ESC_JS(lKey)}')">${ESC(prof.displayName || m.displayName)}</b>
                                <small style="color:var(--ui-muted, #888); font-size:0.75rem !important; cursor:pointer;" title="Обратиться в чате" onclick="HUB_MENTION_USER('${ESC_JS(lKey)}')">@${ESC(lKey)}</small>
                            </div>
                            <div style="display:flex; align-items:center; gap:6px;">
                                <small style="color:var(--ui-muted, #888); font-size:0.72rem !important;">${ESC(m.date || '')}</small>
                                ${canDel ? `<button data-custom-bg="1" class="btn-small" title="Удалить" onclick="HUB_DELETE_CHAT_MSG('${ESC_JS(m.id)}')" style="padding:1px 5px; font-size:0.7rem; background:transparent; color:var(--ui-muted,#888); border:none; box-shadow:none;">✕</button>` : ''}
                            </div>
                        </div>
                        <div style="font-size:0.9rem; color:var(--ui-text, #e5e0d7); word-break:break-word; white-space:pre-wrap; line-height:1.4;">${ESC(m.text)}</div>
                    </div>
                </div>`;
        }).join('');

        if (forceScrollBottom || wasNearBottom) {
            box.scrollTop = box.scrollHeight;
        }
    }

    function RENDER_ONLINE_STRIP_ONLY() {
        const box = document.getElementById('hub-online-users-strip');
        if (!box) return;
        const byLogin = {};
        const myKey = CUR_LOGIN_KEY();
        const me = CUR_USER();
        if (myKey && me) {
            const p = GET_PROFILE(myKey);
            byLogin[myKey] = { login: myKey, displayName: p.displayName, where: 'На Главной' };
        }
        Object.values(window._hubOnlineUsers || {}).forEach(u => {
            if (u && u.login) byLogin[SAFE_KEY(u.login)] = u;
        });

        const list = Object.values(byLogin);
        const cntEl = document.getElementById('hub-online-count');
        if (cntEl) cntEl.textContent = String(list.length);

        box.innerHTML = list.map(u => {
            const lk = SAFE_KEY(u.login);
            const prof = GET_PROFILE(lk);
            return `
                <button data-custom-bg="1" class="btn-small" onclick="OPEN_PUBLIC_USER_PROFILE('${ESC_JS(lk)}')"
                    title="${ESC(u.where || 'Онлайн')} — нажмите, чтобы открыть профиль"
                    style="padding:4px 9px; border-radius:16px; font-size:0.8rem; background:var(--ui-panel2, #161412); color:var(--ui-text, #e5e0d7); border:1px solid var(--ui-border, #3e372f); box-shadow:none; display:inline-flex; align-items:center; gap:5px;">
                    <span style="color:#6cb878; font-size:0.7rem;">●</span>
                    <span>${ESC(prof.displayName || u.displayName)}</span>
                </button>`;
        }).join('');
    }

    // --- 4. ПРОФИЛЬ: РЕДАКТИРОВАНИЕ, АВАТАР И ПУБЛИЧНАЯ КАРТОЧКА ---
    window.HUB_UPLOAD_PROFILE_AVATAR = function() {
        const inp = document.createElement('input');
        inp.type = 'file';
        inp.accept = 'image/*';
        inp.onchange = function(e) {
            const f = e.target.files[0];
            if (!f) return;
            const reader = new FileReader();
            reader.onload = function(ev) {
                const img = new Image();
                img.onload = function() {
                    const size = 240;
                    const c = document.createElement('canvas');
                    c.width = size; c.height = size;
                    const minS = Math.min(img.width, img.height);
                    const sx = (img.width - minS) / 2, sy = (img.height - minS) / 2;
                    c.getContext('2d').drawImage(img, sx, sy, minS, minS, 0, 0, size, size);
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

        if (!displayName || displayName.length < 2) {
            showMessage('⚠️ Имя слишком короткое', 'Укажите отображаемое имя (минимум 2 символа).');
            return;
        }
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
            m.className = 'modal';
            m.id = 'hub-public-profile-modal';
            m.style.zIndex = '95400';
            m.innerHTML = `<div class="modal-content" id="hub-public-profile-content" style="max-width:560px; width:95%;"></div>`;
            m.addEventListener('click', e => { if (e.target === m) m.classList.remove('active'); });
            document.body.appendChild(m);
        }

        const cont = document.getElementById('hub-public-profile-content');
        const av = prof.avatar
            ? `<img src="${prof.avatar}" style="width:76px; height:76px; border-radius:50%; object-fit:cover; border:2px solid var(--ui-accent,#d2b278); flex-shrink:0;">`
            : `<div style="width:76px; height:76px; border-radius:50%; background:var(--ui-panel2,#161412); border:2px solid var(--ui-border-strong,#695c4c); display:flex; align-items:center; justify-content:center; font-size:2.2rem; flex-shrink:0;">👤</div>`;

        cont.innerHTML = `
            <div style="display:flex; gap:14px; align-items:center; text-align:left; margin-bottom:14px; border-bottom:1px solid var(--ui-border,#3e372f); padding-bottom:12px;">
                ${av}
                <div>
                    <h2 style="margin:0; border:none; padding:0; font-size:1.3rem;">${ESC(prof.displayName)}</h2>
                    <div style="font-size:0.84rem; color:var(--ui-muted,#9a9286);">@${ESC(key)}${prof.createdAt ? ` • с ${ESC(prof.createdAt)}` : ''}</div>
                    <div style="font-size:0.86rem; color:var(--ui-accent,#d2b278); margin-top:4px;">${ESC(prof.status)}</div>
                </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:10px; text-align:left; font-size:0.9rem;">
                <div style="background:var(--ui-panel2,#161412); border:1px solid var(--ui-border,#3e372f); border-radius:8px; padding:10px 12px;">
                    <div><b>Роль:</b> ${roleObj.label}</div>
                    ${prof.favClass ? `<div style="margin-top:4px;"><b>Любимый класс / раса:</b> ${ESC(prof.favClass)}</div>` : ''}
                    ${prof.bio ? `<div style="margin-top:8px; padding-top:8px; border-top:1px dashed var(--ui-border,#3e372f); white-space:pre-wrap; line-height:1.45;">${ESC(prof.bio)}</div>` : ''}
                </div>

                <div style="display:flex; gap:10px; font-size:0.84rem; color:var(--ui-muted,#aaa);">
                    <span>⚔️ Персонажей: <b>${userHeroes.length}</b></span>
                    <span>🌟 Открытых шаблонов: <b>${userTpls.length}</b></span>
                </div>

                ${userTpls.length ? `
                    <div>
                        <div style="font-weight:bold; color:var(--ui-accent,#d2b278); margin-bottom:5px; font-size:0.86rem;">🌟 Опубликованные шаблоны:</div>
                        ${userTpls.map(t => `
                            <div style="display:flex; justify-content:space-between; align-items:center; background:var(--ui-panel2,#161412); border:1px solid var(--ui-border,#3e372f); border-radius:7px; padding:7px 10px; margin-bottom:5px;">
                                <span><b>${ESC(t.charSnapshot?.name || 'Герой')}</b> <small style="color:var(--ui-muted,#888);">(${ESC(t.charSnapshot?.race || '')} • ${ESC(t.charSnapshot?.className || '')})</small></span>
                                <button class="btn-small btn-save" onclick="document.getElementById('hub-public-profile-modal').classList.remove('active'); window._hubMainTab='play'; window._lobbyStep='player_chars'; PLAYER_USE_SHARED_USER_TEMPLATE('${ESC_JS(t.templateId)}', false);">Взять</button>
                            </div>`).join('')}
                    </div>` : ''}
            </div>

            <div style="display:flex; justify-content:space-between; gap:8px; margin-top:14px;">
                ${key !== CUR_LOGIN_KEY() && window._hubMainTab === 'home'
                    ? `<button class="btn-small" onclick="document.getElementById('hub-public-profile-modal').classList.remove('active'); HUB_MENTION_USER('${ESC_JS(key)}');">💬 Написать в Таверне</button>`
                    : '<span></span>'}
                <button onclick="document.getElementById('hub-public-profile-modal').classList.remove('active')">Закрыть</button>
            </div>
        `;
        m.classList.add('active');
    };

    // --- 5. НАВИГАЦИЯ ПО ХАБУ ---
    window.SET_HUB_MAIN_TAB = function(tab, subStep, subCharTab) {
        window._hubMainTab = tab;
        window._hubEditingProfile = false;
        if (tab === 'play') {
            if (subStep) window._lobbyStep = subStep;
            if (subCharTab) window._charCreateTab = subCharTab;
        }
        RENDER_LOBBY_HTML();
    };

    window.HUB_QUICK_ENTER_GM = function(roomCode) {
        if (typeof ENTER_ROOM_AS_GM === 'function') ENTER_ROOM_AS_GM(roomCode);
    };

    window.HUB_QUICK_PLAY_HERO = function(heroId) {
        window._hubMainTab = 'play';
        if (typeof PLAYER_SELECT_EXISTING_HERO === 'function') PLAYER_SELECT_EXISTING_HERO(heroId);
    };

    function BUILD_HUB_NAV_BAR() {
        const u = CUR_USER();
        const prof = GET_PROFILE(u ? u.login : '');
        const tab = window._hubMainTab || 'home';

        const updatesList = (typeof window.GET_SITE_UPDATES === 'function') ? window.GET_SITE_UPDATES() : [];
        const seenId = parseInt(localStorage.getItem('dnd_last_seen_update_id') || '0', 10);
        const unread = updatesList.filter(x => x && x.id && Number(x.id) > seenId).length;
        const updBadge = unread > 0
            ? ` <span style="background:#a84848; color:#fff; border-radius:10px; padding:1px 6px; font-size:0.72rem; margin-left:3px; font-weight:bold;">NEW</span>`
            : '';

        const isRealAdmin = (typeof window.IS_REAL_ADMIN === 'function') && window.IS_REAL_ADMIN();
        const adminBtn = isRealAdmin
            ? (window._adminPreviewAsUser
                ? `<button class="btn-small btn-warn" data-admin-ui="admin" onclick="TOGGLE_ADMIN_PREVIEW_MODE()">👁️ Вид игрока</button>`
                : `<button class="btn-small btn-danger" data-admin-ui="admin" onclick="OPEN_ADMIN_PANEL()">🛡️ Админка</button>`)
            : '';

        const avMini = prof.avatar
            ? `<img src="${prof.avatar}" style="width:32px; height:32px; border-radius:50%; object-fit:cover; border:1px solid var(--ui-accent,#d2b278);">`
            : `<span style="width:32px; height:32px; border-radius:50%; background:var(--ui-panel2,#161412); border:1px solid var(--ui-border-strong,#695c4c); display:inline-flex; align-items:center; justify-content:center;">🐉</span>`;

        const tBtn = (id, label) => `
            <button data-custom-bg="1" class="hub-tab-btn ${tab === id ? 'is-active' : ''}" onclick="SET_HUB_MAIN_TAB('${id}'${id === 'play' ? ", 'role'" : ''})">${label}</button>`;

        return `
            <div class="hub-nav-bar" data-hub-nav="1">
                <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                    <div style="display:flex; align-items:center; gap:8px; cursor:pointer;" onclick="SET_HUB_MAIN_TAB('profile')" title="Открыть свой профиль">
                        ${avMini}
                        <div style="text-align:left; line-height:1.2;">
                            <div style="font-weight:700; color:var(--ui-accent,#d2b278); font-size:0.96rem;">${ESC(prof.displayName)}</div>
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
                    <button class="btn-small" data-admin-ui="updates" onclick="OPEN_SITE_UPDATES_MODAL()">📢 Обновления${updBadge}</button>
                    ${adminBtn}
                    <button class="btn-small btn-danger" onclick="LOGOUT_ACCOUNT()">🚪 Выйти</button>
                </div>
            </div>
        `;
    }

    // --- 6. ЭКРАН «🏠 ДОМ» (ГЛАВНАЯ СТРАНИЦА) ---
    function RENDER_HOME_TAB_HTML() {
        const u = CUR_USER();
        const prof = GET_PROFILE(u.login);
        const rooms = (typeof GET_ROOMS === 'function') ? GET_ROOMS() : [];
        const cs = (typeof GC === 'function') ? GC() : [];
        const myHeroes = cs.filter(c => typeof IS_MY_HERO === 'function' && IS_MY_HERO(c, u));
        const updates = (typeof window.GET_SITE_UPDATES === 'function') ? window.GET_SITE_UPDATES().slice(0, 2) : [];
        const sharedTpls = (typeof GET_SHARED_TEMPLATES === 'function') ? GET_SHARED_TEMPLATES().slice(-3).reverse() : [];

        const roomsListHTML = rooms.slice(0, 5).map(r => {
            const meta = (typeof GET_ROOM_META === 'function') ? GET_ROOM_META(r.code) : { hasPassword: false, settings: {} };
            const badges = [];
            if (meta.hasPassword) badges.push('🔒');
            if (meta.settings && meta.settings.inspMode === 'bg3') badges.push('🔥BG3');
            return `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:8px 10px; background:var(--ui-panel2,#161412); border:1px solid var(--ui-border,#3e372f); border-radius:8px; margin-bottom:6px; text-align:left;">
                    <div style="min-width:0;">
                        <div style="font-weight:700; font-size:0.88rem; color:var(--ui-text,#e5e0d7); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                            🏰 #${ESC(r.code)} — ${ESC(r.name)} ${badges.join(' ')}
                        </div>
                        ${meta.ownerName ? `<small style="color:var(--ui-muted,#888); font-size:0.74rem !important;">👑 Мастер: ${ESC(meta.ownerName)}</small>` : ''}
                    </div>
                    <button class="btn-small btn-save" style="padding:4px 9px; font-size:0.78rem;" onclick="SET_HUB_MAIN_TAB('play', 'player_chars', 'my')">Войти</button>
                </div>`;
        }).join('');

        const updatesHTML = updates.length
            ? updates.map(up => `
                <div style="padding:8px 10px; background:var(--ui-panel2,#161412); border:1px solid var(--ui-border,#3e372f); border-radius:8px; margin-bottom:6px; text-align:left; cursor:pointer;" onclick="OPEN_SITE_UPDATES_MODAL()">
                    <div style="display:flex; justify-content:space-between; gap:6px; align-items:center;">
                        <b style="color:var(--ui-accent,#d2b278); font-size:0.86rem;">${up.version ? `[${ESC(up.version)}] ` : ''}${ESC(up.title)}</b>
                        <small style="color:var(--ui-muted,#888); font-size:0.72rem !important;">${ESC(up.date || '')}</small>
                    </div>
                    <div style="font-size:0.8rem; color:var(--ui-muted,#aaa); margin-top:3px; max-height:36px; overflow:hidden;">${ESC(up.body)}</div>
                </div>`).join('')
            : `<div style="color:var(--ui-muted,#888); font-size:0.84rem; padding:10px; text-align:center;">Записей пока нет</div>`;

        const tplsHTML = sharedTpls.length
            ? sharedTpls.map(t => `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; padding:6px 9px; background:var(--ui-panel2,#161412); border:1px solid var(--ui-border,#3e372f); border-radius:7px; margin-bottom:5px; font-size:0.82rem;">
                    <span>📋 <b>${ESC(t.charSnapshot?.name || 'Билд')}</b> <small style="color:var(--ui-muted,#888);">(${ESC(t.charSnapshot?.className || 'Класс')})</small></span>
                    <button class="btn-small" style="padding:3px 8px; font-size:0.75rem;" onclick="SET_HUB_MAIN_TAB('play', 'player_chars', 'user_templates')">Открыть</button>
                </div>`).join('')
            : '';

        return `
            <div class="hub-home-grid">
                <!-- ЛЕВАЯ ЧАСТЬ: ОБЩИЙ ЧАТ ТАВЕРНЫ И ОНЛАЙН -->
                <div class="panel hub-chat-box">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:8px; flex-wrap:wrap;">
                        <h2 style="margin:0; border:none; padding:0; font-size:1.15rem;">🍺 Общий чат Таверны</h2>
                        <small style="color:var(--ui-muted,#9a9286);">Чат пользователей • не связан с комнатами</small>
                    </div>

                    <div style="background:var(--ui-panel2,#161412); border:1px solid var(--ui-border,#3e372f); border-radius:8px; padding:7px 10px; margin-bottom:10px; text-align:left;">
                        <div style="font-size:0.76rem; color:var(--ui-muted,#aaa); margin-bottom:5px;">
                            🟢 Сейчас на сайте (<b id="hub-online-count">1</b>) — нажмите на ник, чтобы открыть профиль:
                        </div>
                        <div id="hub-online-users-strip" style="display:flex; gap:5px; flex-wrap:wrap;"></div>
                    </div>

                    <div id="hub-chat-messages" class="hub-chat-messages"></div>

                    <div style="display:flex; gap:8px;">
                        <input type="text" id="hub-global-chat-inp"
                            placeholder="Написать в Таверну как ${ESC(prof.displayName)}..."
                            onkeypress="if(event.key==='Enter'){ event.preventDefault(); HUB_SEND_CHAT_MSG(); }"
                            style="flex:1; padding:9px 12px; text-align:left; border-radius:8px;">
                        <button class="btn-save" style="padding:9px 16px;" onclick="HUB_SEND_CHAT_MSG()">Отправить</button>
                    </div>
                </div>

                <!-- ПРАВАЯ ЧАСТЬ: БЫСТРЫЙ СТАРТ, КОМНАТЫ И ОБНОВЛЕНИЯ -->
                <div style="display:flex; flex-direction:column; gap:14px;">
                    <div class="panel" style="text-align:left;">
                        <h2 style="margin-top:0; font-size:1.1rem;">🎮 Быстрый старт</h2>
                        <p style="font-size:0.86rem; color:var(--ui-muted,#aaa); margin-bottom:12px; line-height:1.4;">
                            Статус: <b style="color:var(--ui-accent,#d2b278);">${ESC(prof.status)}</b> • Персонажей: <b>${myHeroes.length}</b>
                        </p>
                        <button class="btn-save" style="width:100%; padding:11px; font-size:1rem; margin-bottom:8px;" onclick="SET_HUB_MAIN_TAB('play', 'role')">
                            ⚔️ Играть (Игрок или Гейм-Мастер) ➡️
                        </button>
                        <div style="display:flex; gap:6px;">
                            <button class="btn-small" style="flex:1; padding:8px;" onclick="SET_HUB_MAIN_TAB('play', 'player_chars', 'my')">🛡️ Мои герои</button>
                            <button class="btn-small" style="flex:1; padding:8px;" onclick="SET_HUB_MAIN_TAB('play', 'gm_rooms')">👑 Стол Мастера</button>
                        </div>
                    </div>

                    <div class="panel" style="text-align:left;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <h2 style="margin:0; border:none; padding:0; font-size:1.05rem;">🏰 Кампании (${rooms.length})</h2>
                            <button class="btn-small" style="padding:3px 8px; font-size:0.76rem;" onclick="SET_HUB_MAIN_TAB('play', 'gm_rooms')">+ Создать</button>
                        </div>
                        ${roomsListHTML || '<div style="color:var(--ui-muted,#888); font-size:0.84rem;">Комнат пока нет</div>'}
                    </div>

                    <div class="panel" style="text-align:left;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <h2 style="margin:0; border:none; padding:0; font-size:1.05rem;">📢 Последние обновления</h2>
                            <button class="btn-small" style="padding:3px 8px; font-size:0.76rem;" onclick="OPEN_SITE_UPDATES_MODAL()">Все →</button>
                        </div>
                        ${updatesHTML}
                    </div>

                    ${tplsHTML ? `
                        <div class="panel" style="text-align:left;">
                            <h2 style="margin-top:0; font-size:1.02rem;">🌟 Свежие шаблоны игроков</h2>
                            ${tplsHTML}
                        </div>` : ''}
                </div>
            </div>
        `;
    }

    // --- 7. ЭКРАН «👤 ПРОФИЛЬ» ---
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
        let maxHeroLevel = 1;
        myHeroes.forEach(h => {
            if ((h.level || 1) > maxHeroLevel) maxHeroLevel = h.level || 1;
            if (h.roomProgress) {
                Object.entries(h.roomProgress).forEach(([rk, rp]) => {
                    joinedRoomsSet.add(rk);
                    if (rp && (rp.level || 1) > maxHeroLevel) maxHeroLevel = rp.level || 1;
                });
            }
        });
        myGmRooms.forEach(r => joinedRoomsSet.add(String(r.code)));

        const avBig = prof.avatar
            ? `<img src="${prof.avatar}" style="width:92px; height:92px; border-radius:50%; object-fit:cover; border:2px solid var(--ui-accent,#d2b278);">`
            : `<div style="width:92px; height:92px; border-radius:50%; background:var(--ui-panel,#221f1c); border:2px dashed var(--ui-border-strong,#695c4c); display:flex; align-items:center; justify-content:center; font-size:2.5rem;">👤</div>`;

        const roleLabel = (ROLE_PREFS.find(r => r.id === prof.favRole) || ROLE_PREFS[0]).label;

        const headerBlock = window._hubEditingProfile ? `
            <div class="hub-profile-banner" style="flex-direction:column; align-items:stretch;">
                <h2 style="margin-top:0;">✏️ Редактирование профиля</h2>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                    <div>
                        <label style="font-size:0.82rem; color:var(--ui-muted,#aaa);">Отображаемое имя (Никнейм):</label>
                        <input type="text" id="hub-prof-name" value="${ESC(prof.displayName)}" style="margin-top:4px; text-align:left;">
                    </div>
                    <div>
                        <label style="font-size:0.82rem; color:var(--ui-muted,#aaa);">Предпочитаемая роль:</label>
                        <select id="hub-prof-role" style="margin-top:4px; text-align:left;">
                            ${ROLE_PREFS.map(r => `<option value="${r.id}" ${prof.favRole === r.id ? 'selected' : ''}>${r.label}</option>`).join('')}
                        </select>
                    </div>
                    <div>
                        <label style="font-size:0.82rem; color:var(--ui-muted,#aaa);">Статус (настроение):</label>
                        <input type="text" id="hub-prof-status" value="${ESC(prof.status)}" placeholder="Напр.: 🎲 Ищу партию" style="margin-top:4px; text-align:left;">
                        <div style="display:flex; gap:4px; flex-wrap:wrap; margin-top:5px;">
                            ${STATUS_PRESETS.map(p => `<button class="btn-small" style="padding:2px 6px; font-size:0.72rem;" onclick="document.getElementById('hub-prof-status').value='${ESC_JS(p)}'">${ESC(p)}</button>`).join('')}
                        </div>
                    </div>
                    <div>
                        <label style="font-size:0.82rem; color:var(--ui-muted,#aaa);">Любимый класс / раса:</label>
                        <input type="text" id="hub-prof-favclass" value="${ESC(prof.favClass)}" placeholder="Напр.: Тифлинг-Колдун" style="margin-top:4px; text-align:left;">
                    </div>
                </div>
                <div>
                    <label style="font-size:0.82rem; color:var(--ui-muted,#aaa);">О себе (видно другим игрокам при клике на ваш профиль):</label>
                    <textarea id="hub-prof-bio" style="min-height:80px; margin-top:4px;" placeholder="Люблю отыгрыш, детективы, тактические бои...">${ESC(prof.bio)}</textarea>
                </div>
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
                            <div style="color:var(--ui-muted,#9a9286); font-size:0.86rem;">
                                Логин: <b>@${ESC(key)}</b>${prof.createdAt ? ` • на сайте с ${ESC(prof.createdAt)}` : ''}
                            </div>
                        </div>
                        <button class="btn-small" onclick="window._hubEditingProfile=true; RENDER_LOBBY_HTML();">✏️ Редактировать профиль</button>
                    </div>

                    <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px; font-size:0.84rem;">
                        <span style="background:var(--ui-panel,#221f1c); border:1px solid var(--ui-accent,#d2b278); color:var(--ui-accent,#d2b278); padding:3px 10px; border-radius:14px;">${ESC(prof.status)}</span>
                        <span style="background:var(--ui-panel,#221f1c); border:1px solid var(--ui-border,#3e372f); padding:3px 10px; border-radius:14px;">${roleLabel}</span>
                        ${prof.favClass ? `<span style="background:var(--ui-panel,#221f1c); border:1px solid var(--ui-border,#3e372f); padding:3px 10px; border-radius:14px;">✨ ${ESC(prof.favClass)}</span>` : ''}
                    </div>

                    ${prof.bio ? `<div style="margin-top:10px; font-size:0.9rem; color:var(--ui-text,#e5e0d7); white-space:pre-wrap; line-height:1.45;">${ESC(prof.bio)}</div>` : ''}
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
                            ${h.avatar ? `<img src="${h.avatar}" style="width:48px; height:48px; border-radius:50%; object-fit:cover; border:2px solid var(--ui-accent,#d2b278);">` : `<div style="width:48px; height:48px; border-radius:50%; background:var(--ui-panel,#221f1c); border:1px dashed var(--ui-border,#555); display:flex; align-items:center; justify-content:center; font-size:1.3rem;">🛡️</div>`}
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
            : `<div style="padding:24px; text-align:center; background:var(--ui-panel2,#161412); border:1px dashed var(--ui-border,#3e372f); border-radius:10px; color:var(--ui-muted,#888);">
                    У вас ещё нет персонажей. Нажмите «➕ Создать героя» выше или возьмите готовый шаблон во вкладке «🎮 Играть»!
               </div>`;

        const gmRoomsHTML = myGmRooms.length
            ? myGmRooms.map(r => `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:9px 12px; background:var(--ui-panel2,#161412); border:1px solid var(--ui-border,#3e372f); border-radius:8px; margin-bottom:6px; text-align:left;">
                    <span>👑 <b>#${ESC(r.code)}</b> — ${ESC(r.name)}</span>
                    <button class="btn-small btn-save" onclick="HUB_QUICK_ENTER_GM('${ESC_JS(r.code)}')">Открыть стол ГМ ➡️</button>
                </div>`).join('')
            : `<div style="font-size:0.86rem; color:var(--ui-muted,#888); padding:10px 0;">У вас пока нет закреплённых за вами комнат. Создать свою кампанию можно во вкладке «🎮 Играть → Гейм-Мастер».</div>`;

        return `
            <div class="panel">
                ${headerBlock}

                <div class="hub-stat-grid">
                    <div class="hub-stat-card">
                        <div style="font-size:1.45rem; font-weight:800; color:var(--ui-accent,#d2b278);">${myHeroes.length}</div>
                        <div style="font-size:0.78rem; color:var(--ui-muted,#aaa);">Личных героев</div>
                    </div>
                    <div class="hub-stat-card">
                        <div style="font-size:1.45rem; font-weight:800; color:var(--ui-text,#e5e0d7);">${joinedRoomsSet.size}</div>
                        <div style="font-size:0.78rem; color:var(--ui-muted,#aaa);">Кампаний (комнат)</div>
                    </div>
                    <div class="hub-stat-card">
                        <div style="font-size:1.45rem; font-weight:800; color:#6cb878;">${myHeroes.length ? maxHeroLevel : '—'}</div>
                        <div style="font-size:0.78rem; color:var(--ui-muted,#aaa);">Макс. уровень</div>
                    </div>
                    <div class="hub-stat-card">
                        <div style="font-size:1.45rem; font-weight:800; color:var(--ui-accent,#d2b278);">${myTpls.length}</div>
                        <div style="font-size:0.78rem; color:var(--ui-muted,#aaa);">Выложено шаблонов</div>
                    </div>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
                    <h2 style="margin:0; border:none; padding:0; font-size:1.15rem;">⚔️ Мои персонажи (${myHeroes.length})</h2>
                    <div style="display:flex; gap:6px;">
                        <button class="btn-small btn-save" onclick="SET_HUB_MAIN_TAB('play', 'player_chars', 'create')">➕ Создать героя</button>
                        <button class="btn-small" onclick="SET_HUB_MAIN_TAB('play', 'role')">🎮 Перейти к игре</button>
                    </div>
                </div>
                ${heroesHTML}

                <div style="margin-top:18px; padding-top:14px; border-top:1px solid var(--ui-border,#3e372f); text-align:left;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <h3 style="margin:0;">👑 Мои кампании как Гейм-Мастера (${myGmRooms.length})</h3>
                        <button class="btn-small" onclick="SET_HUB_MAIN_TAB('play', 'gm_rooms')">+ Создать кампанию</button>
                    </div>
                    ${gmRoomsHTML}
                </div>
            </div>
        `;
    }

    // --- 8. ПЕРЕХВАТ RENDER_LOBBY_HTML (ДОМ / ПРОФИЛЬ / ИГРАТЬ) ---
    const _ORIG_LOBBY_HUB = window.RENDER_LOBBY_HTML;
    if (typeof _ORIG_LOBBY_HUB === 'function') {
        window.RENDER_LOBBY_HTML = function() {
            ENSURE_HUB_CSS();
            const lobby = document.getElementById('lobby-screen');
            const u = CUR_USER();
            if (!lobby || !u) return _ORIG_LOBBY_HUB();

            const tab = window._hubMainTab || 'home';

            if (tab === 'play') {
                // Отрисовываем стандартное «Играть» (auth.js + admin.js + room_rules.js), но заменяем старую полосу на нашу единую шапку Хаба
                _ORIG_LOBBY_HUB();
                const oldBar = lobby.firstElementChild;
                const navWrap = document.createElement('div');
                navWrap.className = 'hub-shell';
                navWrap.style.marginBottom = '12px';
                navWrap.innerHTML = BUILD_HUB_NAV_BAR();

                if (oldBar && oldBar.querySelector('button[onclick="LOGOUT_ACCOUNT()"]')) {
                    // Если внутри «Играть» пользователь ушёл глубже выбора роли — добавляем аккуратную кнопку «⬅️ К выбору роли»
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

            // Для «🏠 Дом» и «👤 Профиль» рендерим чистый интерфейс Хаба
            const bodyHTML = (tab === 'profile') ? RENDER_PROFILE_TAB_HTML() : RENDER_HOME_TAB_HTML();
            lobby.innerHTML = `
                <div class="hub-shell">
                    ${BUILD_HUB_NAV_BAR()}
                    ${bodyHTML}
                </div>
            `;

            if (tab === 'home') {
                RENDER_ONLINE_STRIP_ONLY();
                RENDER_GLOBAL_CHAT_MESSAGES_ONLY(true);
            }
        };
    }

    // Обновляем статус присутствия при входе/выходе из комнаты
    const _ORIG_APPLY_HUB = window.APPLY_ROLE_VIEW;
    if (typeof _ORIG_APPLY_HUB === 'function') {
        window.APPLY_ROLE_VIEW = function() {
            _ORIG_APPLY_HUB();
            PUBLISH_HUB_PRESENCE();
        };
    }

    window.addEventListener('beforeunload', REMOVE_HUB_PRESENCE);
    SYNC_HUB_CLOUD();
    if (!CUR_USER() || (typeof GET_SESSION === 'function' && GET_SESSION())) return;
    if (typeof RENDER_LOBBY_HTML === 'function') RENDER_LOBBY_HTML();
})();