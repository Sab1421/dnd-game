// ================================================================
// 🏰 БЕЗОПАСНОСТЬ КОМНАТ (ВЛАДЕЛЕЦ + ПАРОЛЬ), НАСТРОЙКИ КАМПАНИИ
// (ВДОХНОВЕНИЕ D&D 5e / BG3, ЗАДАЧИ ОТ ГМ) И БИБЛИОТЕКА СЦЕН (room_rules.js)
// ================================================================
(function INIT_ROOM_RULES_SECURITY_AND_SCENES() {
    const FB_ROOT = "https://dnds-23b7d-default-rtdb.firebaseio.com/campaign_v2";
    const UNLOCK_LS_KEY = 'dnd_unlocked_rooms_v1';

    window._roomsMetaCloud = {};    // { [roomCode]: { ownerLogin, ownerName, coMasters, passHash, hasPassword, settings } }
    window._roomScenesCache = {};   // { [roomCode]: [scene, ...] }
    window._bg3LastRollCtx = null;  // Контекст последнего броска для переброса за Вдохновение (BG3)

    let activeSceneRoom = null;
    let activeSceneRef = null;
    let metaRef = null;

    function ESC(s) {
        return String(s || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function ESC_JS(s) {
        return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    }

    function HASH_STR(str) {
        if (typeof HASH_PASSWORD === 'function') return HASH_PASSWORD(str);
        let h = 2166136261 >>> 0;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 16777619);
        }
        return 'h_' + (h >>> 0).toString(16);
    }

    function CUR_ROOM() {
        const s = (typeof GET_SESSION === 'function') ? GET_SESSION() : null;
        return (s && s.roomCode) ? String(s.roomCode) : null;
    }

    function IS_GM() {
        const s = (typeof GET_SESSION === 'function') ? GET_SESSION() : null;
        return !!(s && s.role === 'gm');
    }

    function IS_ADMIN_NOW() {
        return (typeof window.IS_ADMIN === 'function') && window.IS_ADMIN();
    }

    function CUR_LOGIN() {
        const u = (typeof GET_CURRENT_USER === 'function') ? GET_CURRENT_USER() : null;
        return (u && u.login) ? String(u.login).toLowerCase().trim() : '';
    }

    function DEFAULT_ROOM_SETTINGS() {
        return {
            inspMode: 'dnd5e',     // 'dnd5e' | 'bg3'
            tasksMode: 'gm_only'   // 'gm_only' | 'all'
        };
    }

    // --- 1. МЕТАДАННЫЕ КОМНАТ (ВЛАДЕЛЕЦ, ПАРОЛЬ, ПРАВИЛА) ---
    window.GET_ROOM_META = function(roomCode) {
        const rc = String(roomCode || CUR_ROOM() || '');
        if (!rc) return { ownerLogin: '', ownerName: '', coMasters: [], passHash: '', hasPassword: false, settings: DEFAULT_ROOM_SETTINGS() };

        const roomObj = (typeof GET_ROOMS === 'function' ? GET_ROOMS() : []).find(r => String(r.code) === rc) || {};
        const cloud = window._roomsMetaCloud[rc] || {};

        const settings = Object.assign(
            DEFAULT_ROOM_SETTINGS(),
            roomObj.settings || {},
            cloud.settings || {}
        );

        const coMasters = Array.isArray(cloud.coMasters)
            ? cloud.coMasters
            : (Array.isArray(roomObj.coMasters) ? roomObj.coMasters : []);

        const passHash = cloud.passHash !== undefined ? cloud.passHash : (roomObj.passHash || '');
        return {
            ownerLogin: cloud.ownerLogin !== undefined ? cloud.ownerLogin : (roomObj.ownerLogin || ''),
            ownerName: cloud.ownerName !== undefined ? cloud.ownerName : (roomObj.ownerName || ''),
            coMasters: coMasters.map(x => String(x || '').toLowerCase().trim()).filter(Boolean),
            passHash,
            hasPassword: !!passHash,
            settings
        };
    };

    window.SAVE_ROOM_META = function(roomCode, metaObj) {
        const rc = String(roomCode || CUR_ROOM() || '');
        if (!rc) return;

        const clean = {
            ownerLogin: String(metaObj.ownerLogin || '').toLowerCase().trim(),
            ownerName: String(metaObj.ownerName || '').trim(),
            coMasters: (Array.isArray(metaObj.coMasters) ? metaObj.coMasters : [])
                .map(x => String(x || '').toLowerCase().trim()).filter(Boolean),
            passHash: String(metaObj.passHash || ''),
            hasPassword: !!metaObj.passHash,
            settings: Object.assign(DEFAULT_ROOM_SETTINGS(), metaObj.settings || {})
        };

        window._roomsMetaCloud[rc] = clean;

        // Дублируем в dnd_rooms для локального офлайн-доступа
        if (typeof GET_ROOMS === 'function' && typeof SAVE_ROOMS === 'function') {
            const rooms = GET_ROOMS();
            const r = rooms.find(x => String(x.code) === rc);
            if (r) {
                r.ownerLogin = clean.ownerLogin;
                r.ownerName = clean.ownerName;
                r.coMasters = clean.coMasters;
                r.passHash = clean.passHash;
                r.hasPassword = clean.hasPassword;
                r.settings = clean.settings;
                SAVE_ROOMS(rooms);
            }
        }

        if (window.firebase && firebase.apps && firebase.apps.length) {
            firebase.database().ref(`campaign_v2/rooms_meta/${rc}`).set(clean).catch(() => {});
        } else {
            fetch(`${FB_ROOT}/rooms_meta/${encodeURIComponent(rc)}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clean)
            }).catch(() => {});
        }

        APPLY_TASKS_PERMISSION_UI();
        if (!CUR_ROOM() && typeof RENDER_LOBBY_HTML === 'function') RENDER_LOBBY_HTML();
    };

    window.CAN_USER_GM_ROOM = function(roomCode) {
        if (IS_ADMIN_NOW()) return true;
        const meta = window.GET_ROOM_META(roomCode);
        if (!meta.ownerLogin) return true; // Старая комната без владельца — открыта до закрепления
        const me = CUR_LOGIN();
        if (!me) return false;
        return meta.ownerLogin === me || meta.coMasters.includes(me);
    };

    function GET_UNLOCKED_MAP() {
        try { return JSON.parse(localStorage.getItem(UNLOCK_LS_KEY) || '{}') || {}; } catch (e) { return {}; }
    }

    function IS_ROOM_UNLOCKED_FOR_ME(roomCode) {
        const rc = String(roomCode || '');
        const meta = window.GET_ROOM_META(rc);
        if (!meta.hasPassword) return true;
        if (window.CAN_USER_GM_ROOM(rc) && meta.ownerLogin) return true;
        if (IS_ADMIN_NOW()) return true;
        const key = `${CUR_LOGIN()}_${rc}`;
        return GET_UNLOCKED_MAP()[key] === meta.passHash;
    }

    function MARK_ROOM_UNLOCKED(roomCode, passHash) {
        const map = GET_UNLOCKED_MAP();
        map[`${CUR_LOGIN()}_${roomCode}`] = passHash;
        try { localStorage.setItem(UNLOCK_LS_KEY, JSON.stringify(map)); } catch (e) {}
    }

    function SYNC_ROOMS_META_CLOUD() {
        fetch(`${FB_ROOT}/rooms_meta.json`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data && typeof data === 'object') {
                    window._roomsMetaCloud = Object.assign({}, window._roomsMetaCloud, data);
                    APPLY_TASKS_PERMISSION_UI();
                    if (!CUR_ROOM() && typeof RENDER_LOBBY_HTML === 'function') RENDER_LOBBY_HTML();
                }
            })
            .catch(() => {});

        const attach = () => {
            if (window.firebase && firebase.apps && firebase.apps.length) {
                metaRef = firebase.database().ref('campaign_v2/rooms_meta');
                metaRef.on('value', (snap) => {
                    const val = snap.val();
                    if (val && typeof val === 'object') {
                        window._roomsMetaCloud = val;
                        APPLY_TASKS_PERMISSION_UI();
                        if (!CUR_ROOM() && typeof RENDER_LOBBY_HTML === 'function') RENDER_LOBBY_HTML();
                    }
                });
                return true;
            }
            return false;
        };
        if (!attach()) {
            const t = setInterval(() => { if (attach()) clearInterval(t); }, 650);
            setTimeout(() => clearInterval(t), 22000);
        }
    }

    // Чистим rooms_meta при удалении комнаты
    const _ORIG_SAVE_ROOMS_RR = window.SAVE_ROOMS;
    if (typeof _ORIG_SAVE_ROOMS_RR === 'function') {
        window.SAVE_ROOMS = function(nextRooms) {
            const prevCodes = GET_ROOMS().map(r => String(r.code));
            const nextCodes = (nextRooms || []).map(r => String(r.code));
            prevCodes.forEach(code => {
                if (!nextCodes.includes(code)) {
                    delete window._roomsMetaCloud[code];
                    fetch(`${FB_ROOT}/rooms_meta/${encodeURIComponent(code)}.json`, { method: 'DELETE' }).catch(() => {});
                }
            });
            return _ORIG_SAVE_ROOMS_RR(nextRooms);
        };
    }

    // --- 2. ЗАЩИТА ВХОДА (ВЛАДЕЛЕЦ ДЛЯ ГМ, ПАРОЛЬ ДЛЯ ИГРОКОВ) ---
    const _ORIG_ENTER_GM = window.ENTER_ROOM_AS_GM;
    if (typeof _ORIG_ENTER_GM === 'function') {
        window.ENTER_ROOM_AS_GM = function(roomCode) {
            const rc = String(roomCode || '');
            if (!window.CAN_USER_GM_ROOM(rc)) {
                const meta = window.GET_ROOM_META(rc);
                showMessage('🔒 Доступ Гейм-Мастера закрыт', `У комнаты <b>#${ESC(rc)}</b> уже есть владелец: <b>${ESC(meta.ownerName || meta.ownerLogin)}</b>.<br><br>Попросите владельца добавить ваш логин (<b>${ESC(CUR_LOGIN())}</b>) в со-мастера в настройках комнаты, или войдите как Игрок.`);
                return;
            }
            return _ORIG_ENTER_GM(rc);
        };
    }

    window.CREATE_NEW_ROOM_WITH_RULES = function() {
        const nameInp = document.getElementById('lobby-new-room-name');
        const passInp = document.getElementById('lobby-new-room-pass');
        const inspSel = document.getElementById('lobby-new-room-insp');
        const tasksSel = document.getElementById('lobby-new-room-tasks');

        const roomName = (nameInp?.value || '').trim();
        if (!roomName) {
            showMessage('⚠️ Введите название', 'Укажите название новой кампании.');
            return;
        }

        const rooms = GET_ROOMS();
        let code = '';
        let guard = 0;
        do {
            code = String(Math.floor(1000 + Math.random() * 9000));
            guard++;
        } while (rooms.some(r => String(r.code) === code) && guard < 100);

        const user = (typeof GET_CURRENT_USER === 'function') ? GET_CURRENT_USER() : null;
        const passRaw = (passInp?.value || '').trim();
        const passHash = passRaw ? HASH_STR(`${code}:${passRaw}`) : '';
        const settings = {
            inspMode: inspSel?.value === 'bg3' ? 'bg3' : 'dnd5e',
            tasksMode: tasksSel?.value === 'all' ? 'all' : 'gm_only'
        };

        const newRoom = {
            code,
            name: roomName,
            createdAt: new Date().toLocaleDateString('ru-RU'),
            ownerLogin: user ? String(user.login).toLowerCase().trim() : '',
            ownerName: user ? (user.displayName || user.login) : GET_GM_NAME(),
            coMasters: [],
            passHash,
            hasPassword: !!passHash,
            settings
        };

        rooms.push(newRoom);
        SAVE_ROOMS(rooms);
        window.SAVE_ROOM_META(code, newRoom);

        window.ENTER_ROOM_AS_GM(code);
    };

    const _ORIG_PLAYER_JOIN = window.PLAYER_JOIN_SELECTED_ROOM;
    if (typeof _ORIG_PLAYER_JOIN === 'function') {
        window.PLAYER_JOIN_SELECTED_ROOM = function(roomCode) {
            const rc = String(roomCode || document.getElementById('player-step3-room-select')?.value || '1001');
            if (!IS_ROOM_UNLOCKED_FOR_ME(rc)) {
                OPEN_ROOM_PASSWORD_PROMPT(rc);
                return;
            }
            return _ORIG_PLAYER_JOIN(rc);
        };
    }

    function OPEN_ROOM_PASSWORD_PROMPT(roomCode) {
        const room = GET_ROOMS().find(r => String(r.code) === String(roomCode));
        const cont = document.getElementById('gm-tool-modal-content');
        if (!cont) return;
        cont.style.maxWidth = '440px';
        cont.innerHTML = `
            <h2>🔒 Комната защищена паролем</h2>
            <p style="color:var(--ui-muted, #aaa); font-size:0.9rem; margin-bottom:12px;">
                Введите пароль для входа в комнату <b>#${ESC(roomCode)} — ${ESC(room?.name || '')}</b>:
            </p>
            <div id="rr-pass-err" style="display:none; background:#3b1d24; border:1px solid #a84848; color:#fecaca; padding:8px 10px; border-radius:7px; margin-bottom:10px; font-size:0.86rem;"></div>
            <input type="password" id="rr-join-pass-inp" placeholder="Пароль комнаты..."
                onkeypress="if(event.key==='Enter') SUBMIT_ROOM_JOIN_PASSWORD('${ESC_JS(roomCode)}');"
                style="width:100%; padding:10px; text-align:left; margin-bottom:14px;">
            <div style="display:flex; justify-content:flex-end; gap:8px;">
                <button class="btn-save" onclick="SUBMIT_ROOM_JOIN_PASSWORD('${ESC_JS(roomCode)}')">🔓 Войти</button>
                <button onclick="CM('gm-tool-modal')">Отмена</button>
            </div>
        `;
        OM('gm-tool-modal');
        setTimeout(() => document.getElementById('rr-join-pass-inp')?.focus(), 50);
    }

    window.SUBMIT_ROOM_JOIN_PASSWORD = function(roomCode) {
        const rc = String(roomCode || '');
        const inp = document.getElementById('rr-join-pass-inp');
        const err = document.getElementById('rr-pass-err');
        const pass = (inp?.value || '').trim();
        const meta = window.GET_ROOM_META(rc);

        if (!pass || HASH_STR(`${rc}:${pass}`) !== meta.passHash) {
            if (err) {
                err.style.display = 'block';
                err.textContent = '⚠️ Неверный пароль комнаты!';
            }
            return;
        }
        MARK_ROOM_UNLOCKED(rc, meta.passHash);
        CM('gm-tool-modal');
        _ORIG_PLAYER_JOIN(rc);
    };

    // --- 3. НАСТРОЙКИ КОМНАТЫ ДЛЯ МАСТЕРА (ВНУТРИ КОМНАТЫ) ---
    window.OPEN_GM_ROOM_SETTINGS_MODAL = function() {
        if (!IS_GM()) return;
        const rc = CUR_ROOM();
        if (!rc) return;
        const room = GET_ROOMS().find(r => String(r.code) === rc) || { code: rc, name: 'Кампания' };
        const meta = window.GET_ROOM_META(rc);
        const me = CUR_LOGIN();
        const user = (typeof GET_CURRENT_USER === 'function') ? GET_CURRENT_USER() : null;

        const cont = document.getElementById('gm-tool-modal-content');
        if (!cont) return;
        cont.style.maxWidth = '640px';

        const ownerBlock = meta.ownerLogin
            ? `<div style="font-size:0.88rem;">👑 Владелец комнаты: <b style="color:var(--ui-accent, #e6c88c);">${ESC(meta.ownerName || meta.ownerLogin)}</b> <small style="color:var(--ui-muted, #aaa);">(@${ESC(meta.ownerLogin)})</small></div>`
            : `<div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span style="font-size:0.86rem; color:#d99a4e;">⚠️ У этой комнаты ещё нет владельца — любой может зайти как ГМ.</span>
                    <button class="btn-small btn-save" onclick="GM_CLAIM_ROOM_OWNERSHIP()">👑 Закрепить за собой</button>
               </div>`;

        cont.innerHTML = `
            <h2>⚙️ Настройки комнаты #${ESC(rc)}</h2>
            <div style="display:flex; flex-direction:column; gap:12px; text-align:left;">
                <div style="background:var(--ui-panel2, #181715); border:1px solid var(--ui-border, #3e372f); border-radius:9px; padding:12px;">
                    ${ownerBlock}
                </div>

                <div>
                    <label style="font-size:0.86rem; color:var(--ui-accent, #c9a96e); font-weight:bold;">Название кампании:</label>
                    <input type="text" id="rr-set-name" value="${ESC(room.name || '')}" style="margin-top:4px; text-align:left;">
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
                    <div>
                        <label style="font-size:0.86rem; color:var(--ui-accent, #c9a96e); font-weight:bold;">⭐ Правило Вдохновения:</label>
                        <select id="rr-set-insp" style="margin-top:4px; text-align:left;">
                            <option value="dnd5e" ${meta.settings.inspMode !== 'bg3' ? 'selected' : ''}>🎲 D&D 5e (Преимущество 2к20 до броска)</option>
                            <option value="bg3" ${meta.settings.inspMode === 'bg3' ? 'selected' : ''}>🔥 Baldur's Gate 3 (Переброс после броска, макс. 4)</option>
                        </select>
                    </div>
                    <div>
                        <label style="font-size:0.86rem; color:var(--ui-accent, #c9a96e); font-weight:bold;">📋 Кто пишет «Задачи»:</label>
                        <select id="rr-set-tasks" style="margin-top:4px; text-align:left;">
                            <option value="gm_only" ${meta.settings.tasksMode !== 'all' ? 'selected' : ''}>👑 Только Гейм-Мастер</option>
                            <option value="all" ${meta.settings.tasksMode === 'all' ? 'selected' : ''}>👥 Мастер и игроки</option>
                        </select>
                    </div>
                </div>

                <div style="background:var(--ui-panel2, #181715); border:1px solid var(--ui-border, #3e372f); border-radius:9px; padding:12px; display:flex; flex-direction:column; gap:10px;">
                    <div>
                        <label style="font-size:0.85rem; color:var(--ui-accent, #c9a96e); font-weight:bold;">🔒 Пароль для входа игроков:</label>
                        <div style="display:flex; gap:8px; margin-top:4px; align-items:center;">
                            <input type="password" id="rr-set-pass" placeholder="${meta.hasPassword ? '•••••••• (оставьте пустым, чтобы не менять)' : 'Без пароля (введите, чтобы закрыть комнату)'}" style="flex:1; text-align:left;">
                            ${meta.hasPassword ? `<label style="display:flex; align-items:center; gap:5px; font-size:0.82rem; white-space:nowrap; cursor:pointer;"><input type="checkbox" id="rr-clear-pass"> Снять пароль</label>` : ''}
                        </div>
                    </div>

                    <div>
                        <label style="font-size:0.85rem; color:var(--ui-accent, #c9a96e); font-weight:bold;">🤝 Со-мастера (логины через запятую):</label>
                        <input type="text" id="rr-set-comasters" value="${ESC(meta.coMasters.join(', '))}" placeholder="Напр.: friend_login, second_gm" style="margin-top:4px; text-align:left;">
                        <small style="color:var(--ui-muted, #888);">Пользователи из этого списка тоже смогут открывать стол Гейм-Мастера в этой комнате.</small>
                    </div>
                </div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:16px;">
                <button class="btn-save" onclick="SAVE_GM_ROOM_SETTINGS()">💾 Сохранить настройки</button>
                <button onclick="CM('gm-tool-modal')">Отмена</button>
            </div>
        `;
        OM('gm-tool-modal');
    };

    window.GM_CLAIM_ROOM_OWNERSHIP = function() {
        const rc = CUR_ROOM();
        const user = (typeof GET_CURRENT_USER === 'function') ? GET_CURRENT_USER() : null;
        if (!rc || !user || !user.login) return;
        const meta = window.GET_ROOM_META(rc);
        meta.ownerLogin = String(user.login).toLowerCase().trim();
        meta.ownerName = user.displayName || user.login;
        window.SAVE_ROOM_META(rc, meta);
        window.OPEN_GM_ROOM_SETTINGS_MODAL();
    };

    window.SAVE_GM_ROOM_SETTINGS = function() {
        if (!IS_GM()) return;
        const rc = CUR_ROOM();
        if (!rc) return;

        const nameVal = (document.getElementById('rr-set-name')?.value || '').trim();
        const inspMode = document.getElementById('rr-set-insp')?.value === 'bg3' ? 'bg3' : 'dnd5e';
        const tasksMode = document.getElementById('rr-set-tasks')?.value === 'all' ? 'all' : 'gm_only';
        const newPass = (document.getElementById('rr-set-pass')?.value || '').trim();
        const clearPass = !!document.getElementById('rr-clear-pass')?.checked;
        const coRaw = (document.getElementById('rr-set-comasters')?.value || '');

        const meta = window.GET_ROOM_META(rc);
        meta.settings = { inspMode, tasksMode };
        meta.coMasters = coRaw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

        if (clearPass) meta.passHash = '';
        else if (newPass) meta.passHash = HASH_STR(`${rc}:${newPass}`);

        if (nameVal) {
            const rooms = GET_ROOMS();
            const r = rooms.find(x => String(x.code) === rc);
            if (r) {
                r.name = nameVal;
                SAVE_ROOMS(rooms);
            }
        }

        window.SAVE_ROOM_META(rc, meta);
        CM('gm-tool-modal');
        showMessage('✅ Настройки комнаты сохранены', `
            Правило Вдохновения: <b>${inspMode === 'bg3' ? '🔥 Baldur\'s Gate 3 (переброс)' : '🎲 D&D 5e (2к20 заранее)'}</b><br>
            Блок «Задачи»: <b>${tasksMode === 'gm_only' ? '👑 Только Гейм-Мастер' : '👥 Мастер и игроки'}</b><br>
            Пароль: <b>${meta.passHash ? '🔒 Установлен' : '🌍 Открытая комната'}</b>
        `);
    };

    // --- 4. ЗАДАЧИ ПИШЕТ ГЕЙМ-МАСТЕР (ЗАЩИТА ДЛЯ ИГРОКОВ + РЕДАКТОР ДЛЯ ГМ) ---
    function APPLY_TASKS_PERMISSION_UI() {
        const rc = CUR_ROOM();
        const tasksEl = document.getElementById('tasks-content');
        const tasksEdit = document.getElementById('tasks-edit');
        if (!tasksEl) return;

        const meta = window.GET_ROOM_META(rc);
        const lockedForPlayer = !IS_GM() && (meta.settings.tasksMode !== 'all');

        tasksEl.style.cursor = lockedForPlayer ? 'default' : 'pointer';
        tasksEl.title = lockedForPlayer
            ? 'Задачи кампании заполняет Гейм-Мастер'
            : 'Нажмите, чтобы отредактировать задачи';

        if (lockedForPlayer && tasksEdit) {
            tasksEdit.style.display = 'none';
            tasksEl.style.display = 'block';
        }

        const panel = tasksEl.parentElement;
        const h2 = panel ? panel.querySelector('h2') : null;
        if (h2) {
            h2.querySelectorAll('[data-rr-tasks-tag]').forEach(n => n.remove());
            if (lockedForPlayer) {
                const sp = document.createElement('small');
                sp.setAttribute('data-rr-tasks-tag', '1');
                sp.style.cssText = 'font-weight:normal; font-size:0.72rem !important; color:var(--ui-muted, #9a9286); margin-left:6px;';
                sp.textContent = '(от Мастера)';
                h2.appendChild(sp);
            }
        }
    }

    ['editTasks', 'ET'].forEach(fnName => {
        const orig = window[fnName];
        if (typeof orig !== 'function') return;
        window[fnName] = function(...args) {
            const meta = window.GET_ROOM_META();
            if (!IS_GM() && meta.settings.tasksMode !== 'all') {
                return;
            }
            return orig.apply(this, args);
        };
    });

    window.OPEN_GM_TASKS_MODAL = function() {
        if (!IS_GM()) return;
        const curTasks = localStorage.getItem('dnd_tasks') || '';
        const cont = document.getElementById('gm-tool-modal-content');
        if (!cont) return;
        cont.style.maxWidth = '580px';
        cont.innerHTML = `
            <h2>📋 Общие задачи партии</h2>
            <p style="color:var(--ui-muted, #aaa); font-size:0.88rem; margin-bottom:10px;">
                Этот список отображается в блоке «📋 Задачи» у всех игроков комнаты <b>#${ESC(CUR_ROOM())}</b>.
            </p>
            <textarea id="rr-gm-tasks-area" style="min-height:190px; line-height:1.5;" placeholder="- Найти пропавшего кузнеца&#10;- Расспросить трактирщика о старой башне...">${ESC(curTasks)}</textarea>
            <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:12px;">
                <button class="btn-save" onclick="GM_SAVE_PARTY_TASKS()">💾 Обновить задачи у игроков</button>
                <button onclick="CM('gm-tool-modal')">Отмена</button>
            </div>
        `;
        OM('gm-tool-modal');
    };

    window.GM_SAVE_PARTY_TASKS = function() {
        if (!IS_GM()) return;
        const val = (document.getElementById('rr-gm-tasks-area')?.value || '').trim();
        localStorage.setItem('dnd_tasks', val);
        if (typeof LDT === 'function') LDT();
        CM('gm-tool-modal');
        LOG_COMBAT_TO_CHAT('📋 Гейм-Мастер обновил список задач отряда.');
    };

    // --- 5. ВДОХНОВЕНИЕ ПО ПРАВИЛАМ BALDUR'S GATE 3 (ПЕРЕБРОС ПОСЛЕ БРОСКА, МАКС. 4) ---
    function IS_BG3_INSP_MODE() {
        return window.GET_ROOM_META().settings.inspMode === 'bg3';
    }

    // При режиме BG3 лимит выдачи у ГМ = 4
    const _ORIG_GM_INSP = window.GM_CHANGE_INSPIRATION;
    if (typeof _ORIG_GM_INSP === 'function') {
        window.GM_CHANGE_INSPIRATION = function(charIdx, delta) {
            if (IS_BG3_INSP_MODE() && delta > 0) {
                const cs = GC();
                const ch = (typeof GET_CHAR_FOR_ROOM === 'function') ? GET_CHAR_FOR_ROOM(cs[charIdx], CUR_ROOM()) : cs[charIdx];
                const cur = (typeof GET_INSPIRATION_COUNT === 'function') ? GET_INSPIRATION_COUNT(ch) : 0;
                if (cur >= 4) {
                    showMessage('🔥 Лимит Вдохновения (BG3)', 'По правилам Baldur\'s Gate 3 у персонажа может быть максимум <b>4</b> очка Вдохновения.');
                    return;
                }
            }
            return _ORIG_GM_INSP(charIdx, delta);
        };
    }

    // Адаптируем окно Вдохновения под выбранное правило комнаты
    const _ORIG_OPEN_INSP_MODAL = window.OPEN_INSPIRATION_MODAL;
    if (typeof _ORIG_OPEN_INSP_MODAL === 'function') {
        window.OPEN_INSPIRATION_MODAL = function() {
            if (!IS_BG3_INSP_MODE()) return _ORIG_OPEN_INSP_MODAL();
            const cs = GC();
            const c = cs[PI];
            const cnt = (typeof GET_INSPIRATION_COUNT === 'function') ? GET_INSPIRATION_COUNT(c) : 0;
            if (!c || cnt <= 0) return;

            const last = window._bg3LastRollCtx;
            const cont = document.getElementById('gm-tool-modal-content');
            if (!cont) return;
            cont.style.maxWidth = '510px';
            cont.innerHTML = `
                <h2>🔥 Вдохновение — правила BG3 (${cnt}/4)</h2>
                <p style="color:var(--ui-muted, #aaa); font-size:0.9rem; margin-bottom:14px; line-height:1.45;">
                    В этой комнате действует правило <b>Baldur's Gate 3</b>: Вдохновение тратится <b>после броска</b>, чтобы перебросить неудачную проверку навыка, спасбросок или испытание.
                </p>
                <div style="display:flex; flex-direction:column; gap:8px;">
                    ${last ? `
                        <button class="btn-save" style="padding:11px;" onclick="CM('gm-tool-modal'); EXECUTE_BG3_INSPIRATION_REROLL();">
                            🔥 Перебросить «${ESC(last.label)}» (было: ${last.total})
                        </button>` : `
                        <div style="background:var(--ui-panel2, #161412); border:1px dashed var(--ui-border, #3e372f); border-radius:8px; padding:10px; font-size:0.84rem; color:var(--ui-muted, #aaa);">
                            Совершите любую проверку (по запросу Мастера или через «🎲 Броски»), и прямо в окне результата появится кнопка переброса.
                        </div>`}
                    <button class="btn-cast" style="padding:10px;" onclick="BG3_FREE_REROLL_D20()">🎲 Потратить 1 Вдохновение на чистый переброс 1к20</button>
                    <button onclick="CM('gm-tool-modal')">Закрыть</button>
                </div>
            `;
            OM('gm-tool-modal');
        };
    }

    function SPEND_ONE_INSPIRATION() {
        const cs = GC();
        const c = cs[PI];
        if (!c || typeof GET_INSPIRATION_COUNT !== 'function') return false;
        const cnt = GET_INSPIRATION_COUNT(c);
        if (cnt <= 0) return false;
        c.inspiration = cnt - 1;
        window._inspArmed = false;
        SC(cs);
        RMC();
        return true;
    }

    window.BG3_FREE_REROLL_D20 = function() {
        if (!SPEND_ONE_INSPIRATION()) return;
        CM('gm-tool-modal');
        const d20 = Math.floor(Math.random() * 20) + 1;
        LOG_COMBAT_TO_CHAT(`🔥 [Вдохновение BG3] Переброс 1к20: выпало ${d20}!`);
        showMessage('🔥 Переброс (BG3)', `<div style="text-align:center; font-size:2.4rem; font-weight:bold; color:var(--ui-accent, #e6c88c); padding:10px 0;">${d20}</div>`);
    };

    window.EXECUTE_BG3_INSPIRATION_REROLL = function() {
        const ctx = window._bg3LastRollCtx;
        if (!ctx) return;
        if (!SPEND_ONE_INSPIRATION()) {
            showMessage('🔥 Нет Вдохновения', 'У вашего персонажа не осталось очков Вдохновения.');
            return;
        }

        const d20 = Math.floor(Math.random() * 20) + 1;
        const total = d20 + (ctx.bonus || 0);
        const modStr = (typeof MS === 'function') ? MS(ctx.bonus || 0) : ((ctx.bonus >= 0 ? '+' : '') + ctx.bonus);
        const cs = GC();
        const remInsp = (typeof GET_INSPIRATION_COUNT === 'function') ? GET_INSPIRATION_COUNT(cs[PI]) : 0;

        ctx.total = total;
        ctx.d20 = d20;

        if (ctx.type === 'gm_skill') {
            const req = GET_SKILL_CHECK_REQ();
            const success = (d20 === 20) || (d20 !== 1 && total >= ctx.dc);
            if (req && req.id === ctx.reqId) {
                if (!req.rolledBy) req.rolledBy = {};
                req.rolledBy[ctx.playerIdx] = { d20, bonus: ctx.bonus, total, success };
                SAVE_SKILL_CHECK_REQ(req);
                if (typeof CHECK_AND_RENDER_SKILL_ROLL_POPUP === 'function') CHECK_AND_RENDER_SKILL_ROLL_POPUP();
            }
            const statusBadge = d20 === 20 ? '🌟 КРИТИЧЕСКИЙ УСПЕХ (20)!' : (d20 === 1 ? '💀 КРИТИЧЕСКИЙ ПРОВАЛ (1)!' : (success ? '✅ УСПЕХ!' : '❌ ПРОВАЛ!'));
            LOG_COMBAT_TO_CHAT(`🔥 [Вдохновение BG3] Переброс «${ctx.label}» (Сл ${ctx.dc}): ${d20}${modStr} = ${total} — ${statusBadge}`);
            const rerollAgainBtn = (!success && remInsp > 0)
                ? `<div style="margin-top:12px;"><button class="btn-warn" style="width:100%;" onclick="EXECUTE_BG3_INSPIRATION_REROLL()">🔥 Перебросить ещё раз (осталось Вдохновения: ${remInsp})</button></div>`
                : '';
            showMessage(`🔥 Переброс: ${ctx.label}`, `
                <div style="text-align:center; padding:8px 0;">
                    <div style="font-size:2.4rem; font-weight:bold; color:${success ? '#6cb878' : '#d66565'}; margin-bottom:6px;">${total}</div>
                    <div style="color:var(--ui-muted, #aaa); margin-bottom:8px;">Новый 1к20: <b>${d20}</b> | Мод: <b>${modStr}</b> | Сл: <b>${ctx.dc}</b></div>
                    <div style="font-size:1.12rem; font-weight:bold; color:${success ? '#6cb878' : '#d66565'};">${statusBadge}</div>
                    ${rerollAgainBtn}
                </div>
            `);
            return;
        }

        // Переброс обычной проверки из панели «🎲 Броски»
        const critTag = d20 === 20 ? ' • 🌟 Нат. 20!' : (d20 === 1 ? ' • 💀 Нат. 1!' : '');
        const color = d20 === 20 ? '#6cb878' : (d20 === 1 ? '#d66565' : 'var(--ui-accent, #d2b278)');
        const detail = `Переброс BG3: ${d20} ${modStr} = ${total}${critTag}`;
        window._ptLastRoll = { title: `🔥 ${ctx.label}`, total, detail, color };
        if (Array.isArray(window._playerDiceHistory)) {
            window._playerDiceHistory.unshift({ label: `🔥 ${ctx.label}`, res: detail, secret: !!ctx.secret });
        }
        if (!ctx.secret && CUR_ROOM()) {
            LOG_COMBAT_TO_CHAT(`🔥 [Вдохновение BG3] Переброс «${ctx.label}»: ${d20} ${modStr} = ${total}${critTag}`);
        }
        if (window._ptRollDrawerOpen && typeof TOGGLE_PLAYER_ROLL_DRAWER === 'function') {
            window.SET_PT_ROLL_TAB(window._ptRollTab || 'skills');
        }
        const rerollBtn = remInsp > 0
            ? `<div style="margin-top:12px;"><button class="btn-warn" style="width:100%;" onclick="EXECUTE_BG3_INSPIRATION_REROLL()">🔥 Перебросить ещё раз (Вдохновение: ${remInsp})</button></div>`
            : '';
        showMessage(`🔥 Переброс: ${ctx.label}`, `
            <div style="text-align:center; padding:8px 0;">
                <div style="font-size:2.4rem; font-weight:bold; color:${color}; margin-bottom:6px;">${total}</div>
                <div style="color:var(--ui-muted, #aaa);">Новый 1к20: <b>${d20}</b> | Модификатор: <b>${modStr}</b>${critTag}</div>
                ${rerollBtn}
            </div>
        `);
    };

    // Перехватываем бросок проверки от Мастера, чтобы при режиме BG3 подставлять кнопку переброса
    const _ORIG_SKILL_EXEC_RR = window.PLAYER_EXECUTE_SKILL_ROLL;
    if (typeof _ORIG_SKILL_EXEC_RR === 'function') {
        window.PLAYER_EXECUTE_SKILL_ROLL = function() {
            const sess = GET_SESSION();
            const reqBefore = GET_SKILL_CHECK_REQ();
            const cs = GC();
            const c = cs[PI];
            const bonus = (c && reqBefore && typeof GET_CHAR_CHECK_BONUS === 'function')
                ? GET_CHAR_CHECK_BONUS(c, reqBefore.checkName)
                : 0;

            if (IS_BG3_INSP_MODE()) window._inspArmed = false; // В BG3 не тратим заранее!
            _ORIG_SKILL_EXEC_RR();

            if (IS_BG3_INSP_MODE() && sess && reqBefore && c) {
                const reqAfter = GET_SKILL_CHECK_REQ();
                const myRes = reqAfter?.rolledBy?.[sess.playerIdx || 0];
                if (myRes) {
                    window._bg3LastRollCtx = {
                        type: 'gm_skill',
                        reqId: reqAfter.id,
                        playerIdx: sess.playerIdx || 0,
                        label: reqAfter.checkName,
                        dc: reqAfter.dc,
                        bonus,
                        d20: myRes.d20,
                        total: myRes.total
                    };
                    const cnt = (typeof GET_INSPIRATION_COUNT === 'function') ? GET_INSPIRATION_COUNT(c) : 0;
                    const msgBody = document.getElementById('message-body');
                    if (cnt > 0 && msgBody && !myRes.success && !msgBody.querySelector('[data-bg3-reroll-btn]')) {
                        const wrap = document.createElement('div');
                        wrap.setAttribute('data-bg3-reroll-btn', '1');
                        wrap.style.cssText = 'margin-top:12px;';
                        wrap.innerHTML = `<button class="btn-warn" style="width:100%;" onclick="EXECUTE_BG3_INSPIRATION_REROLL()">🔥 Перебросить за 1 Вдохновение (BG3 • есть ${cnt})</button>`;
                        msgBody.appendChild(wrap);
                    }
                }
            }
        };
    }

    // Перехватываем броски из панели «🎲 Броски» (player_tools.js) для записи контекста переброса BG3
    const _ORIG_QUICK_CHK_RR = window.EXECUTE_QUICK_CHECK;
    if (typeof _ORIG_QUICK_CHK_RR === 'function') {
        window.EXECUTE_QUICK_CHECK = function(kind, name) {
            if (IS_BG3_INSP_MODE()) window._inspArmed = false;
            _ORIG_QUICK_CHK_RR(kind, name);

            const cs = GC();
            const c = cs[PI];
            if (!IS_BG3_INSP_MODE() || !c || !window._ptLastRoll) return;

            let bonus = 0;
            if (kind === 'skill') bonus = GET_CHAR_CHECK_BONUS(c, name);
            else if (kind === 'save') bonus = GET_CHAR_CHECK_BONUS(c, 'Спасбросок: ' + name);
            else if (kind === 'init') bonus = GM(c.dex || 10) + (parseInt(c.initiativeBonus) || 0);
            else {
                const mapF = { 'Сила': 'str', 'Ловкость': 'dex', 'Телосложение': 'con', 'Интеллект': 'intl', 'Мудрость': 'wis', 'Харизма': 'cha' };
                bonus = GM(c[mapF[name] || 'str'] || 10);
            }
            window._bg3LastRollCtx = {
                type: 'quick',
                label: window._ptLastRoll.title,
                bonus,
                total: window._ptLastRoll.total,
                secret: !!window._ptRollSecret
            };

            const cnt = (typeof GET_INSPIRATION_COUNT === 'function') ? GET_INSPIRATION_COUNT(c) : 0;
            const drawer = document.getElementById('pt-roll-drawer');
            if (cnt > 0 && drawer) {
                drawer.querySelectorAll('[data-bg3-drawer-reroll]').forEach(n => n.remove());
                const btn = document.createElement('button');
                btn.className = 'btn-small btn-warn';
                btn.setAttribute('data-bg3-drawer-reroll', '1');
                btn.style.cssText = 'margin:0 10px 8px 10px; padding:6px 8px; font-size:0.8rem;';
                btn.textContent = `🔥 Перебросить «${name}» за 1 Вдохновение (${cnt})`;
                btn.onclick = () => window.EXECUTE_BG3_INSPIRATION_REROLL();
                const scrollBody = drawer.querySelector('div[style*="overflow-y:auto"]');
                if (scrollBody) scrollBody.before(btn);
            }
        };
    }

    // --- 6. БИБЛИОТЕКА СЦЕН ВНУТРИ КОМНАТЫ (ТОЛЬКО ДЛЯ МАСТЕРА) ---
    function LS_SCENES_KEY(rc) { return `dnd_scenes_v1_${rc}`; }

    function GET_ROOM_SCENES(rc) {
        const code = String(rc || CUR_ROOM() || '');
        if (!code) return [];
        if (window._roomScenesCache[code]) return window._roomScenesCache[code];
        try {
            const raw = localStorage.getItem(LS_SCENES_KEY(code));
            if (raw) {
                const arr = Object.values(JSON.parse(raw)).filter(Boolean);
                window._roomScenesCache[code] = arr;
                return arr;
            }
        } catch (e) {}
        return [];
    }

    function SAVE_ROOM_SCENES(list, rc) {
        const code = String(rc || CUR_ROOM() || '');
        if (!code) return;
        const clean = (list || []).filter(s => s && s.id).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
        window._roomScenesCache[code] = clean;

        const obj = {};
        clean.forEach(s => { obj[s.id] = s; });
        try { localStorage.setItem(LS_SCENES_KEY(code), JSON.stringify(obj)); } catch (e) {}

        if (window.firebase && firebase.apps && firebase.apps.length) {
            firebase.database().ref(`campaign_v2/rooms/${code}/scenes`).set(obj).catch(() => {});
        } else {
            fetch(`${FB_ROOT}/rooms/${encodeURIComponent(code)}/scenes.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(obj)
            }).catch(() => {});
        }
    }

    function SYNC_SCENES_FOR_ROOM(roomCode) {
        const nextRc = roomCode ? String(roomCode) : null;
        if (nextRc === activeSceneRoom && (nextRc === null || activeSceneRef)) return;
        if (activeSceneRef) { activeSceneRef.off(); activeSceneRef = null; }
        activeSceneRoom = nextRc;
        if (!nextRc) return;

        fetch(`${FB_ROOT}/rooms/${encodeURIComponent(nextRc)}/scenes.json`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (activeSceneRoom !== nextRc || !data) return;
                window._roomScenesCache[nextRc] = Object.values(data).filter(Boolean).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0));
            })
            .catch(() => {});

        const attach = () => {
            if (activeSceneRoom !== nextRc) return true;
            if (window.firebase && firebase.apps && firebase.apps.length) {
                activeSceneRef = firebase.database().ref(`campaign_v2/rooms/${nextRc}/scenes`);
                activeSceneRef.on('value', (snap) => {
                    if (activeSceneRoom !== nextRc) return;
                    const val = snap.val();
                    window._roomScenesCache[nextRc] = val
                        ? Object.values(val).filter(Boolean).sort((a, b) => (b.savedAt || 0) - (a.savedAt || 0))
                        : [];
                    if (document.getElementById('rr-scenes-modal-marker')) RENDER_GM_SCENES_MODAL();
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

    function CAPTURE_CURRENT_MAP_SNAPSHOT() {
        const st = GET_MAP_STATE();
        return {
            bg: st.bg || '',
            title: st.title || '',
            desc: st.desc || '',
            gridSize: st.gridSize || 48,
            mapCols: st.mapCols || 0,
            mapRows: st.mapRows || 0,
            collisionMask: st.collisionMask || '',
            fogMode: st.fogMode || 'none',
            fogZones: JSON.parse(JSON.stringify(st.fogZones || [])),
            pins: JSON.parse(JSON.stringify(st.pins || [])),
            weather: st.weather || 'none',
            tokens: JSON.parse(JSON.stringify(st.tokens || []))
        };
    }

    window.OPEN_GM_SCENES_MODAL = function() {
        if (!IS_GM()) return;
        RENDER_GM_SCENES_MODAL();
        OM('gm-tool-modal');
    };

    window.GM_SAVE_CURRENT_SCENE = function(overwriteId) {
        if (!IS_GM()) return;
        const rc = CUR_ROOM();
        if (!rc) return;
        const list = GET_ROOM_SCENES(rc).slice();

        if (overwriteId) {
            const ex = list.find(s => s.id === overwriteId);
            if (!ex) return;
            ex.mapData = CAPTURE_CURRENT_MAP_SNAPSHOT();
            ex.savedAt = Date.now();
            SAVE_ROOM_SCENES(list, rc);
            RENDER_GM_SCENES_MODAL();
            showMessage('💾 Сцена обновлена', `Сцена «<b>${ESC(ex.name)}</b>» обновлена текущим состоянием карты.`);
            return;
        }

        if (list.length >= 12) {
            showMessage('⚠️ Лимит сцен', 'В комнате можно хранить до 12 сцен. Удалите ненужную или обновите существующую.');
            return;
        }

        const inp = document.getElementById('rr-new-scene-name');
        const st = GET_MAP_STATE();
        const name = (inp?.value || '').trim() || st.title || `Сцена ${list.length + 1}`;
        list.unshift({
            id: 'sc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            name,
            savedAt: Date.now(),
            mapData: CAPTURE_CURRENT_MAP_SNAPSHOT()
        });
        SAVE_ROOM_SCENES(list, rc);
        RENDER_GM_SCENES_MODAL();
    };

    window.GM_LOAD_SCENE = function(sceneId) {
        if (!IS_GM()) return;
        const rc = CUR_ROOM();
        const scene = GET_ROOM_SCENES(rc).find(s => s.id === sceneId);
        if (!scene || !scene.mapData) return;

        const keepParty = !!document.getElementById('rr-scene-keep-party')?.checked;
        const curSt = GET_MAP_STATE();
        const nextSt = Object.assign({}, curSt, JSON.parse(JSON.stringify(scene.mapData)));

        if (keepParty) {
            const curPlayers = (curSt.tokens || []).filter(t => t.isPlayer);
            const sceneEnemies = (nextSt.tokens || []).filter(t => !t.isPlayer);
            const scenePlayers = (nextSt.tokens || []).filter(t => t.isPlayer);
            // Переносим текущие ХП и состояния живых игроков, используя их позиции из сохранённой сцены, если они там были
            const mergedPlayers = curPlayers.map(cp => {
                const savedPos = scenePlayers.find(sp => sp.charIdx === cp.charIdx);
                return savedPos ? Object.assign({}, cp, { x: savedPos.x, y: savedPos.y }) : cp;
            });
            nextSt.tokens = mergedPlayers.concat(sceneEnemies);
        }

        if (nextSt.turnOrder) nextSt.turnOrder.active = false;
        SAVE_MAP_STATE(nextSt);
        CM('gm-tool-modal');
        LOG_COMBAT_TO_CHAT(`🗺️ Локация переключена: «${scene.name}»!`);
        RENDER_MAP_AREA();
    };

    window.GM_DELETE_SCENE = function(sceneId) {
        if (!IS_GM()) return;
        const rc = CUR_ROOM();
        const list = GET_ROOM_SCENES(rc);
        const sc = list.find(s => s.id === sceneId);
        if (!sc || !confirm(`Удалить сцену «${sc.name}»?`)) return;
        SAVE_ROOM_SCENES(list.filter(s => s.id !== sceneId), rc);
        RENDER_GM_SCENES_MODAL();
    };

    function RENDER_GM_SCENES_MODAL() {
        const cont = document.getElementById('gm-tool-modal-content');
        if (!cont) return;
        cont.style.maxWidth = '760px';

        const rc = CUR_ROOM();
        const list = GET_ROOM_SCENES(rc);
        const curTitle = GET_MAP_STATE().title || '';

        const cards = list.map(sc => {
            const md = sc.mapData || {};
            const hasBg = !!md.bg;
            const enemyCnt = (md.tokens || []).filter(t => !t.isPlayer).length;
            const pinCnt = (md.pins || []).length;
            const dateStr = sc.savedAt ? new Date(sc.savedAt).toLocaleDateString('ru-RU') : '';
            return `
                <div style="background:var(--ui-panel2, #181715); border:1px solid var(--ui-border, #3e372f); border-radius:10px; padding:11px; display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:9px; flex-wrap:wrap; text-align:left;">
                    <div style="display:flex; align-items:center; gap:11px; flex:1; min-width:220px;">
                        ${hasBg
                            ? `<img src="${md.bg}" style="width:68px; height:46px; object-fit:cover; border-radius:6px; border:1px solid var(--ui-border-strong, #695c4c); flex-shrink:0;">`
                            : `<div style="width:68px; height:46px; border-radius:6px; background:var(--ui-panel, #221f1c); border:1px dashed var(--ui-border, #444); display:flex; align-items:center; justify-content:center; font-size:1.3rem; flex-shrink:0;">🗺️</div>`}
                        <div>
                            <div style="font-weight:bold; color:var(--ui-accent, #e6c88c); font-size:0.98rem;">${ESC(sc.name)}</div>
                            <small style="color:var(--ui-muted, #aaa);">
                                👹 Врагов: ${enemyCnt} • 📍 Значков: ${pinCnt} ${md.collisionMask && md.collisionMask.includes('1') ? '• 🧱 Стены' : ''} ${dateStr ? `• ${dateStr}` : ''}
                            </small>
                        </div>
                    </div>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <button class="btn-small btn-save" onclick="GM_LOAD_SCENE('${ESC_JS(sc.id)}')">▶️ Переключиться</button>
                        <button class="btn-small" title="Перезаписать эту сцену текущей картой" onclick="GM_SAVE_CURRENT_SCENE('${ESC_JS(sc.id)}')">💾 Обновить</button>
                        <button class="btn-small btn-danger" onclick="GM_DELETE_SCENE('${ESC_JS(sc.id)}')">🗑️</button>
                    </div>
                </div>`;
        }).join('');

        cont.innerHTML = `
            <div id="rr-scenes-modal-marker"></div>
            <h2>🗺️ Библиотека сцен комнаты #${ESC(rc)} (${list.length}/12)</h2>
            <p style="color:var(--ui-muted, #aaa); font-size:0.88rem; margin-bottom:12px;">
                Сохраняйте подготовленные локации (карта, стены, туман, значки, враги) и переключайтесь между ними в один клик.
            </p>

            <div style="background:var(--ui-panel2, #181715); border:1px solid var(--ui-border-strong, #695c4c); border-radius:10px; padding:12px; margin-bottom:14px; text-align:left;">
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <input type="text" id="rr-new-scene-name" value="${ESC(curTitle)}" placeholder="Название новой сцены (напр. Таверна)..." style="flex:1; min-width:200px; text-align:left;">
                    <button class="btn-save" onclick="GM_SAVE_CURRENT_SCENE()">💾 Сохранить текущую карту</button>
                </div>
                <label style="display:flex; align-items:center; gap:8px; margin-top:9px; font-size:0.84rem; color:var(--ui-muted, #aaa); cursor:pointer;">
                    <input type="checkbox" id="rr-scene-keep-party" checked>
                    <span>Переносить текущие фишки игроков (с их актуальным ХП) при переключении сцены</span>
                </label>
            </div>

            <div style="max-height:46vh; overflow-y:auto; padding-right:2px;">
                ${cards || '<div style="padding:26px; text-align:center; color:var(--ui-muted, #888);">Сохранённых сцен пока нет. Подготовьте карту и нажмите «💾 Сохранить текущую карту».</div>'}
            </div>

            <div style="margin-top:14px; text-align:right;"><button onclick="CM('gm-tool-modal')">Закрыть</button></div>
        `;
    }

    // --- 7. УЛУЧШЕНИЕ ЛОББИ И ЛЕВОЙ ПАНЕЛИ ГМ ---
    function ENHANCE_LOBBY_ROOM_UI() {
        const lobby = document.getElementById('lobby-screen');
        if (!lobby || lobby.style.display === 'none') return;

        // А) Шаг выбора/создания комнаты у Гейм-Мастера
        if (window._lobbyStep === 'gm_rooms') {
            const sel = document.getElementById('lobby-gm-room');
            if (sel) {
                Array.from(sel.options).forEach(opt => {
                    const rc = opt.value;
                    const meta = window.GET_ROOM_META(rc);
                    const canGm = window.CAN_USER_GM_ROOM(rc);
                    const tags = [];
                    if (meta.hasPassword) tags.push('🔒');
                    if (meta.settings.inspMode === 'bg3') tags.push('🔥BG3');
                    if (!canGm) tags.push(`только @${meta.ownerLogin}`);
                    else if (meta.ownerLogin === CUR_LOGIN()) tags.push('👑 ваша');
                    if (tags.length && !opt.dataset.rrTagged) {
                        opt.dataset.rrTagged = '1';
                        opt.textContent += ` [${tags.join(' • ')}]`;
                    }
                });
            }

            const newInp = document.getElementById('lobby-new-room-name');
            if (newInp && !document.getElementById('lobby-new-room-rules-wrap')) {
                const row = newInp.parentElement;
                const oldBtn = row.querySelector('button[onclick*="CREATE_NEW_ROOM_AS_GM"]');
                if (oldBtn) oldBtn.setAttribute('onclick', 'CREATE_NEW_ROOM_WITH_RULES()');

                const extra = document.createElement('div');
                extra.id = 'lobby-new-room-rules-wrap';
                extra.style.cssText = 'display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; text-align:left;';
                extra.innerHTML = `
                    <div style="grid-column:1 / -1;">
                        <input type="password" id="lobby-new-room-pass" placeholder="🔒 Пароль для игроков (необязательно — оставьте пустым для открытой)" style="width:100%; padding:9px; text-align:left; font-size:0.86rem;">
                    </div>
                    <div>
                        <small style="color:var(--ui-muted, #aaa); display:block; margin-bottom:3px;">⭐ Правило Вдохновения:</small>
                        <select id="lobby-new-room-insp" style="width:100%; padding:8px; font-size:0.84rem; text-align:left;">
                            <option value="dnd5e">🎲 D&D 5e (2к20 заранее)</option>
                            <option value="bg3">🔥 Baldur's Gate 3 (переброс)</option>
                        </select>
                    </div>
                    <div>
                        <small style="color:var(--ui-muted, #aaa); display:block; margin-bottom:3px;">📋 Кто пишет «Задачи»:</small>
                        <select id="lobby-new-room-tasks" style="width:100%; padding:8px; font-size:0.84rem; text-align:left;">
                            <option value="gm_only">👑 Только Мастер</option>
                            <option value="all">👥 Мастер и игроки</option>
                        </select>
                    </div>
                `;
                row.after(extra);
            }
        }

        // Б) Шаг выбора комнаты у Игрока — показываем бейджи замка и правил кампании
        if (window._lobbyStep === 'player_rooms') {
            lobby.querySelectorAll('button[onclick^="PLAYER_JOIN_SELECTED_ROOM("]').forEach(btn => {
                const m = (btn.getAttribute('onclick') || '').match(/'([^']+)'/);
                if (!m) return;
                const rc = m[1];
                const card = btn.parentElement;
                if (!card || card.querySelector('[data-rr-room-badges]')) return;

                const meta = window.GET_ROOM_META(rc);
                const badges = [];
                if (meta.hasPassword) {
                    const unlocked = IS_ROOM_UNLOCKED_FOR_ME(rc);
                    badges.push(unlocked ? '🔓 Пароль введён' : '🔒 Нужен пароль');
                }
                badges.push(meta.settings.inspMode === 'bg3' ? '🔥 Вдохновение: BG3' : '🎲 Вдохновение: D&D 5e');
                if (meta.ownerName || meta.ownerLogin) {
                    badges.push(`👑 Мастер: ${meta.ownerName || meta.ownerLogin}`);
                }

                const infoCol = card.firstElementChild;
                if (infoCol) {
                    const line = document.createElement('div');
                    line.setAttribute('data-rr-room-badges', '1');
                    line.style.cssText = 'display:flex; gap:6px; flex-wrap:wrap; margin-top:6px; font-size:0.78rem; color:var(--ui-muted, #aaa);';
                    line.innerHTML = badges.map(b => `<span style="background:var(--ui-panel, #221f1c); border:1px solid var(--ui-border, #3e372f); padding:2px 7px; border-radius:6px;">${ESC(b)}</span>`).join('');
                    infoCol.appendChild(line);
                }
            });
        }
    }

    function INJECT_GM_MENU_BUTTONS() {
        if (!IS_GM()) return;
        const gmMenu = document.getElementById('gm-left-menu');
        if (!gmMenu) return;
        const firstPanel = gmMenu.querySelector('.panel');
        const btnWrap = firstPanel ? firstPanel.querySelector('div[style*="flex-direction:column"]') : null;
        if (!btnWrap) return;

        if (!btnWrap.querySelector('#gm-scenes-lib-btn')) {
            const scBtn = document.createElement('button');
            scBtn.id = 'gm-scenes-lib-btn';
            scBtn.textContent = '🗺️ Сцены комнаты';
            scBtn.onclick = () => window.OPEN_GM_SCENES_MODAL();
            btnWrap.appendChild(scBtn);
        }

        if (!btnWrap.querySelector('#gm-party-tasks-btn')) {
            const tBtn = document.createElement('button');
            tBtn.id = 'gm-party-tasks-btn';
            tBtn.textContent = '📋 Задачи партии';
            tBtn.onclick = () => window.OPEN_GM_TASKS_MODAL();
            btnWrap.appendChild(tBtn);
        }

        if (!btnWrap.querySelector('#gm-room-settings-btn')) {
            const sBtn = document.createElement('button');
            sBtn.id = 'gm-room-settings-btn';
            sBtn.textContent = '⚙️ Настройки комнаты';
            sBtn.onclick = () => window.OPEN_GM_ROOM_SETTINGS_MODAL();
            btnWrap.appendChild(sBtn);
        }
    }

    // --- ХУКИ ---
    const _ORIG_LOBBY_RR = window.RENDER_LOBBY_HTML;
    if (typeof _ORIG_LOBBY_RR === 'function') {
        window.RENDER_LOBBY_HTML = function() {
            _ORIG_LOBBY_RR();
            ENHANCE_LOBBY_ROOM_UI();
        };
    }

    const _ORIG_GM_LEFT_RR = window.RENDER_GM_LEFT_COLUMN;
    if (typeof _ORIG_GM_LEFT_RR === 'function') {
        window.RENDER_GM_LEFT_COLUMN = function() {
            _ORIG_GM_LEFT_RR();
            INJECT_GM_MENU_BUTTONS();
        };
    }

    const _ORIG_LDT_RR = window.LDT;
    if (typeof _ORIG_LDT_RR === 'function') {
        window.LDT = function() {
            _ORIG_LDT_RR();
            APPLY_TASKS_PERMISSION_UI();
        };
    }

    if (typeof window.SWITCH_FIREBASE_ROOM === 'function') {
        const _ORIG_SW_RR = window.SWITCH_FIREBASE_ROOM;
        window.SWITCH_FIREBASE_ROOM = function(rc) {
            window._bg3LastRollCtx = null;
            const res = _ORIG_SW_RR(rc);
            SYNC_SCENES_FOR_ROOM(rc);
            APPLY_TASKS_PERMISSION_UI();
            return res;
        };
    }

    const _ORIG_APPLY_RR = window.APPLY_ROLE_VIEW;
    if (typeof _ORIG_APPLY_RR === 'function') {
        window.APPLY_ROLE_VIEW = function() {
            _ORIG_APPLY_RR();
            SYNC_SCENES_FOR_ROOM(CUR_ROOM());
            INJECT_GM_MENU_BUTTONS();
            APPLY_TASKS_PERMISSION_UI();
        };
    }

    SYNC_ROOMS_META_CLOUD();
    SYNC_SCENES_FOR_ROOM(CUR_ROOM());
    INJECT_GM_MENU_BUTTONS();
    APPLY_TASKS_PERMISSION_UI();
})();