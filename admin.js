// ================================================================
// 🛡️ АДМИН-ПАНЕЛЬ, ОГРАНИЧЕНИЯ ИГРОКОВ И ЛЕНТА ОБНОВЛЕНИЙ САЙТА (admin.js)
// ================================================================
(function INIT_ADMIN_AND_UPDATES_MODULE() {
    // 👇 ВПИШИ СЮДА СВОЙ ЛОГИН (строчными буквами). Можно несколько через запятую.
    const HARDCODED_ADMIN_LOGINS = ['lwolf'];

    const ADMIN_FB_URL = "https://dnds-23b7d-default-rtdb.firebaseio.com/campaign_v2";
    window._adminPreviewAsUser = false; // Режим предпросмотра сайта глазами обычного игрока
    window._adminTab = 'updates';       // 'updates' | 'moderation' | 'users' | 'debug'
    window._editingUpdateId = null;
    window._dismissedUpdateBannerId = null;

    // --- 1. ПРОВЕРКА ПРАВ АДМИНА ---
    function GET_CLOUD_ADMINS() {
        try {
            const raw = localStorage.getItem('dnd_site_admins');
            const parsed = raw ? JSON.parse(raw) : [];
            return Array.isArray(parsed) ? parsed.map(x => String(x).toLowerCase().trim()) : [];
        } catch (e) { return []; }
    }

    function SAVE_CLOUD_ADMINS(list) {
        const clean = Array.from(new Set(list.map(x => String(x).toLowerCase().trim()).filter(Boolean)));
        localStorage.setItem('dnd_site_admins', JSON.stringify(clean));
        fetch(`${ADMIN_FB_URL}/site_admins.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clean)
        }).catch(() => {});
    }

    window.IS_REAL_ADMIN = function() {
        const user = (typeof GET_CURRENT_USER === 'function') ? GET_CURRENT_USER() : null;
        if (!user || !user.login) return false;
        const login = String(user.login).toLowerCase().trim();
        if (HARDCODED_ADMIN_LOGINS.map(x => x.toLowerCase().trim()).includes(login)) return true;
        return GET_CLOUD_ADMINS().includes(login);
    };

    // Если админ включил предпросмотр «глазами игрока», IS_ADMIN() временно вернёт false
    window.IS_ADMIN = function() {
        return window.IS_REAL_ADMIN() && !window._adminPreviewAsUser;
    };

    function CAN_EDIT_GAME_VALUES() {
        if (window.IS_ADMIN()) return true;
        const sess = (typeof GET_SESSION === 'function') ? GET_SESSION() : null;
        return !!(sess && sess.role === 'gm');
    }

    // --- 2. ХРАНИЛИЩЕ ОБНОВЛЕНИЙ САЙТА (СИНХРОНИЗАЦИЯ С FIREBASE) ---
    window.GET_SITE_UPDATES = function() {
        try {
            const raw = localStorage.getItem('dnd_site_updates');
            const arr = raw ? JSON.parse(raw) : [];
            return Array.isArray(arr) ? arr : [];
        } catch (e) { return []; }
    };

    function SAVE_SITE_UPDATES(list) {
        const clean = Array.isArray(list) ? list : [];
        localStorage.setItem('dnd_site_updates', JSON.stringify(clean));
        fetch(`${ADMIN_FB_URL}/site_updates.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(clean)
        }).catch(() => {});
    }

    function GET_UNREAD_UPDATES_COUNT() {
        const list = window.GET_SITE_UPDATES();
        if (!list.length) return 0;
        const seenId = parseInt(localStorage.getItem('dnd_last_seen_update_id') || '0', 10);
        return list.filter(u => (u && u.id && Number(u.id) > seenId)).length;
    }

    function MARK_UPDATES_AS_READ() {
        const list = window.GET_SITE_UPDATES();
        if (list.length && list[0] && list[0].id) {
            localStorage.setItem('dnd_last_seen_update_id', String(list[0].id));
        }
        REFRESH_TOP_BAR_AND_LOBBY();
    }

    function NORMALIZE_FB_LIST(val) {
        if (!val) return [];
        if (Array.isArray(val)) return val.filter(Boolean);
        if (typeof val === 'object') return Object.values(val).filter(Boolean);
        return [];
    }

    function REFRESH_TOP_BAR_AND_LOBBY() {
        const sess = (typeof GET_SESSION === 'function') ? GET_SESSION() : null;
        const user = (typeof GET_CURRENT_USER === 'function') ? GET_CURRENT_USER() : null;
        if (!user) {
            if (typeof RENDER_AUTH_SCREEN === 'function') RENDER_AUTH_SCREEN();
            return;
        }
        if (!sess) {
            if (typeof RENDER_LOBBY_HTML === 'function') RENDER_LOBBY_HTML();
        } else {
            INJECT_ROOM_TOPBAR_BUTTONS();
        }
    }

    // Первичная загрузка обновлений и списка админов + живая подписка Firebase
    async function SYNC_ADMIN_AND_UPDATES_FROM_CLOUD() {
        try {
            const [uRes, aRes] = await Promise.all([
                fetch(`${ADMIN_FB_URL}/site_updates.json`),
                fetch(`${ADMIN_FB_URL}/site_admins.json`)
            ]);
            if (uRes.ok) {
                const remU = NORMALIZE_FB_LIST(await uRes.json());
                remU.sort((a, b) => (b.id || 0) - (a.id || 0));
                localStorage.setItem('dnd_site_updates', JSON.stringify(remU));
            }
            if (aRes.ok) {
                const remA = NORMALIZE_FB_LIST(await aRes.json());
                localStorage.setItem('dnd_site_admins', JSON.stringify(remA));
            }
            REFRESH_TOP_BAR_AND_LOBBY();
        } catch (e) {}

        // Подключаем realtime-слушатель, как только Firebase SDK подгрузится из gm.js
        const waitFb = setInterval(() => {
            if (window.firebase && firebase.apps && firebase.apps.length) {
                clearInterval(waitFb);
                const root = firebase.database().ref('campaign_v2');
                root.child('site_updates').on('value', (snap) => {
                    const arr = NORMALIZE_FB_LIST(snap.val());
                    arr.sort((a, b) => (b.id || 0) - (a.id || 0));
                    localStorage.setItem('dnd_site_updates', JSON.stringify(arr));
                    REFRESH_TOP_BAR_AND_LOBBY();
                    if (document.getElementById('site-updates-modal')?.classList.contains('active')) {
                        RENDER_SITE_UPDATES_MODAL();
                    }
                    if (document.getElementById('admin-panel-modal')?.classList.contains('active') && window._adminTab === 'updates') {
                        RENDER_ADMIN_PANEL_MODAL();
                    }
                });
                root.child('site_admins').on('value', (snap) => {
                    const arr = NORMALIZE_FB_LIST(snap.val());
                    localStorage.setItem('dnd_site_admins', JSON.stringify(arr));
                    REFRESH_TOP_BAR_AND_LOBBY();
                });
            }
        }, 700);
        setTimeout(() => clearInterval(waitFb), 25000);
    }

    // --- 3. СОЗДАНИЕ МОДАЛЬНЫХ ОКОН (ПОВЕРХ ЛОББИ И ЭКРАНА ВХОДА) ---
    function ENSURE_ADMIN_MODALS() {
        // Поднимаем z-index стандартного окна сообщений, чтобы оно всегда было видно поверх админки
        const msgModal = document.getElementById('message-modal');
        if (msgModal) msgModal.style.zIndex = '96000';

        if (!document.getElementById('site-updates-modal')) {
            const m = document.createElement('div');
            m.className = 'modal';
            m.id = 'site-updates-modal';
            m.style.zIndex = '95000';
            m.innerHTML = `<div class="modal-content" id="site-updates-content" style="max-width:740px; width:95%;"></div>`;
            m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('active'); });
            document.body.appendChild(m);
        }

        if (!document.getElementById('admin-panel-modal')) {
            const m = document.createElement('div');
            m.className = 'modal';
            m.id = 'admin-panel-modal';
            m.style.zIndex = '95000';
            m.innerHTML = `<div class="modal-content" id="admin-panel-content" style="max-width:960px; width:96%;"></div>`;
            m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('active'); });
            document.body.appendChild(m);
        }
    }

    function ESC_HTML(str) {
        return String(str || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function FORMAT_UPDATE_BODY(text) {
        const lines = ESC_HTML(text).split('\n');
        return lines.map(line => {
            const trimmed = line.trim();
            if (/^[-•*]\s+/.test(trimmed)) {
                return `<div style="padding-left:14px; margin:3px 0;">• ${trimmed.replace(/^[-•*]\s+/, '')}</div>`;
            }
            return trimmed ? `<div style="margin:4px 0;">${trimmed}</div>` : `<div style="height:6px;"></div>`;
        }).join('');
    }

    // --- 4. ОКНО «📢 ОБНОВЛЕНИЯ САЙТА» (ДЛЯ ВСЕХ ПОЛЬЗОВАТЕЛЕЙ) ---
    window.OPEN_SITE_UPDATES_MODAL = function() {
        ENSURE_ADMIN_MODALS();
        MARK_UPDATES_AS_READ();
        RENDER_SITE_UPDATES_MODAL();
        OM('site-updates-modal');
    };

    function RENDER_SITE_UPDATES_MODAL() {
        const cont = document.getElementById('site-updates-content');
        if (!cont) return;
        const list = window.GET_SITE_UPDATES();
        const isAdm = window.IS_ADMIN();

        const cardsHTML = list.length ? list.map((u, idx) => {
            const isLatest = idx === 0;
            return `
                <div style="background:#181715; border:1px solid ${isLatest ? '#c9a96e' : '#3d3830'}; border-radius:10px; padding:14px 16px; margin-bottom:12px; text-align:left;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px;">
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            ${u.version ? `<span style="background:#c9a96e; color:#181510; font-weight:bold; padding:2px 8px; border-radius:6px; font-size:0.82rem;">${ESC_HTML(u.version)}</span>` : ''}
                            <span style="background:#26231e; border:1px solid #524a3d; color:#e6c88c; padding:2px 8px; border-radius:6px; font-size:0.8rem;">${ESC_HTML(u.tag || '✨ Новое')}</span>
                            <b style="color:#f5f3ef; font-size:1.06rem;">${ESC_HTML(u.title)}</b>
                        </div>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <small style="color:#888;">${ESC_HTML(u.date || '')}</small>
                            ${isAdm ? `
                                <button class="btn-small" style="padding:2px 7px; font-size:0.75rem;" onclick="ADMIN_EDIT_UPDATE(${u.id})">✏️</button>
                                <button class="btn-small btn-danger" style="padding:2px 7px; font-size:0.75rem;" onclick="ADMIN_DELETE_UPDATE(${u.id})">🗑️</button>
                            ` : ''}
                        </div>
                    </div>
                    <div style="color:#d8d4cc; font-size:0.93rem; line-height:1.48;">
                        ${FORMAT_UPDATE_BODY(u.body)}
                    </div>
                    ${u.author ? `<div style="margin-top:8px; color:#7a756c; font-size:0.78rem;">Опубликовал: ${ESC_HTML(u.author)}</div>` : ''}
                </div>
            `;
        }).join('') : `
            <div style="padding:32px; text-align:center; background:#181715; border:1px dashed #423c33; border-radius:10px; color:#9e988e;">
                <div style="font-size:2.2rem; margin-bottom:8px;">📜</div>
                Записей об обновлениях пока нет.
            </div>
        `;

        cont.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #3d3830; padding-bottom:10px; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
                <h2 style="margin:0; border:none; padding:0;">📢 Обновления сайта</h2>
                ${isAdm ? `<button class="btn-small btn-save" onclick="CM('site-updates-modal'); window._adminTab='updates'; window._editingUpdateId=null; OPEN_ADMIN_PANEL();">➕ Выложить обновление</button>` : ''}
            </div>
            <div style="max-height:62vh; overflow-y:auto; padding-right:4px;">
                ${cardsHTML}
            </div>
            <div style="margin-top:14px; text-align:right;">
                <button onclick="CM('site-updates-modal')">Закрыть</button>
            </div>
        `;
    }

    // --- 5. ПАНЕЛЬ АДМИНИСТРАТОРА ---
    window.OPEN_ADMIN_PANEL = function() {
        if (!window.IS_REAL_ADMIN()) {
            showMessage('🔒 Доступ запрещён', 'Этот раздел доступен только администратору сайта.');
            return;
        }
        ENSURE_ADMIN_MODALS();
        RENDER_ADMIN_PANEL_MODAL();
        OM('admin-panel-modal');
    };

    window.TOGGLE_ADMIN_PREVIEW_MODE = function() {
        if (!window.IS_REAL_ADMIN()) return;
        window._adminPreviewAsUser = !window._adminPreviewAsUser;
        CM('admin-panel-modal');
        APPLY_ROLE_VIEW();
    };

    window.ADMIN_PUBLISH_UPDATE = function() {
        if (!window.IS_REAL_ADMIN()) return;
        const version = (document.getElementById('adm-upd-ver')?.value || '').trim();
        const tag = (document.getElementById('adm-upd-tag')?.value || '✨ Новое').trim();
        const title = (document.getElementById('adm-upd-title')?.value || '').trim();
        const body = (document.getElementById('adm-upd-body')?.value || '').trim();

        if (!title || !body) {
            showMessage('⚠️ Заполните поля', 'Укажите заголовок и описание обновления.');
            return;
        }

        const user = GET_CURRENT_USER();
        const list = window.GET_SITE_UPDATES();
        const now = new Date();
        const dateStr = now.toLocaleDateString('ru-RU') + ' ' + now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

        if (window._editingUpdateId) {
            const item = list.find(x => String(x.id) === String(window._editingUpdateId));
            if (item) {
                item.version = version;
                item.tag = tag;
                item.title = title;
                item.body = body;
            }
            window._editingUpdateId = null;
        } else {
            const newId = Date.now();
            list.unshift({
                id: newId,
                version,
                tag,
                title,
                body,
                author: user ? user.displayName : 'Админ',
                date: dateStr
            });
            // Админ сам только что создал обнову — сразу считаем её прочитанной для него
            localStorage.setItem('dnd_last_seen_update_id', String(newId));
        }

        SAVE_SITE_UPDATES(list);
        RENDER_ADMIN_PANEL_MODAL();
        REFRESH_TOP_BAR_AND_LOBBY();
        showMessage('✅ Обновление опубликовано!', 'Пользователи увидят значок <b>NEW</b> на кнопке «📢 Обновления» и смогут прочитать список изменений.');
    };

    window.ADMIN_EDIT_UPDATE = function(updId) {
        if (!window.IS_REAL_ADMIN()) return;
        window._editingUpdateId = updId;
        window._adminTab = 'updates';
        CM('site-updates-modal');
        OPEN_ADMIN_PANEL();
    };

    window.ADMIN_DELETE_UPDATE = function(updId) {
        if (!window.IS_REAL_ADMIN()) return;
        if (!confirm('Удалить эту запись об обновлении?')) return;
        const list = window.GET_SITE_UPDATES().filter(x => String(x.id) !== String(updId));
        SAVE_SITE_UPDATES(list);
        if (document.getElementById('site-updates-modal')?.classList.contains('active')) RENDER_SITE_UPDATES_MODAL();
        if (document.getElementById('admin-panel-modal')?.classList.contains('active')) RENDER_ADMIN_PANEL_MODAL();
        REFRESH_TOP_BAR_AND_LOBBY();
    };

    window.ADMIN_GRANT_OR_REVOKE = function(loginKey, grant) {
        if (!window.IS_REAL_ADMIN()) return;
        const key = String(loginKey || '').toLowerCase().trim();
        if (!key) return;
        if (!grant && HARDCODED_ADMIN_LOGINS.map(x => x.toLowerCase()).includes(key)) {
            showMessage('ℹ️ Главный админ', 'Этот логин закреплён в коде admin.js, его нельзя снять из панели.');
            return;
        }
        let list = GET_CLOUD_ADMINS();
        if (grant) list.push(key);
        else list = list.filter(x => x !== key);
        SAVE_CLOUD_ADMINS(list);
        RENDER_ADMIN_PANEL_MODAL();
    };

    window.ADMIN_DELETE_ROOM = function(roomCode) {
        if (!window.IS_REAL_ADMIN()) return;
        const rooms = GET_ROOMS();
        if (rooms.length <= 1) {
            showMessage('⚠️ Нельзя удалить', 'На сайте должна остаться хотя бы одна комната.');
            return;
        }
        if (!confirm(`Удалить комнату #${roomCode}?`)) return;
        SAVE_ROOMS(rooms.filter(r => r.code !== roomCode));
        RENDER_ADMIN_PANEL_MODAL();
        REFRESH_TOP_BAR_AND_LOBBY();
    };

    window.ADMIN_MOD_ACTION = function(action) {
        if (!window.IS_REAL_ADMIN()) return;
        if (action === 'clear_chat') {
            if (!confirm('Очистить весь чат игроков?')) return;
            SMS([]); RCH();
            showMessage('✅ Готово', 'Чат игроков очищен.');
        } else if (action === 'clear_sys') {
            if (!confirm('Очистить весь системный лог?')) return;
            SSYS([]); RCH();
            showMessage('✅ Готово', 'Системный лог очищен.');
        } else if (action === 'clear_npc_log') {
            if (!confirm('Очистить историю диалогов с NPC?')) return;
            localStorage.removeItem('dnd_npc_dialog_log');
            showMessage('✅ Готово', 'История NPC очищена.');
        } else if (action === 'reset_popups') {
            localStorage.removeItem('dnd_rest_poll');
            localStorage.removeItem('dnd_gm_skill_check');
            localStorage.removeItem('dnd_gm_edit_request');
            localStorage.removeItem('dnd_vn_dialog');
            if (typeof CHECK_AND_RENDER_REST_POPUP === 'function') CHECK_AND_RENDER_REST_POPUP();
            if (typeof CHECK_AND_RENDER_SKILL_ROLL_POPUP === 'function') CHECK_AND_RENDER_SKILL_ROLL_POPUP();
            if (typeof CHECK_AND_RENDER_PERMISSION_POPUP === 'function') CHECK_AND_RENDER_PERMISSION_POPUP();
            if (typeof RENDER_MAP_AREA === 'function') RENDER_MAP_AREA();
            showMessage('✅ Готово', 'Все зависшие голосования, проверки и диалоги сброшены.');
        } else if (action === 'reset_active_char') {
            RST();
        }
    };


    window.RENDER_ADMIN_PANEL_MODAL = function() {
    function RENDER_ADMIN_PANEL_MODAL() {
        const cont = document.getElementById('admin-panel-content');
        if (!cont) return;
        const tab = window._adminTab || 'updates';
        const tBtn = (id, label) => `
            <button class="btn-small" onclick="window._adminTab='${id}'; RENDER_ADMIN_PANEL_MODAL();"
                style="flex:1; min-width:140px; padding:9px; background:${tab===id ? '#c9a96e' : '#181715'}; color:${tab===id ? '#181510' : '#ccc'}; border:1px solid ${tab===id ? '#e0c58e' : '#423c33'};">
                ${label}
            </button>`;

        let bodyHTML = '';

        if (tab === 'updates') {
            const list = window.GET_SITE_UPDATES();
            const editObj = window._editingUpdateId ? list.find(x => String(x.id) === String(window._editingUpdateId)) : null;

            const histHTML = list.map(u => `
                <div style="background:#181715; border:1px solid #3d3830; border-radius:8px; padding:10px 12px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
                    <div style="text-align:left;">
                        <b style="color:#e6c88c;">${u.version ? `[${ESC_HTML(u.version)}] ` : ''}${ESC_HTML(u.title)}</b>
                        <small style="color:#888; margin-left:6px;">${ESC_HTML(u.date || '')}</small>
                        <div style="color:#aaa; font-size:0.84rem; margin-top:3px; max-height:42px; overflow:hidden;">${ESC_HTML(u.body)}</div>
                    </div>
                    <div style="display:flex; gap:6px; flex-shrink:0;">
                        <button class="btn-small" onclick="ADMIN_EDIT_UPDATE(${u.id})">✏️</button>
                        <button class="btn-small btn-danger" onclick="ADMIN_DELETE_UPDATE(${u.id})">🗑️</button>
                    </div>
                </div>
            `).join('');

            bodyHTML = `
                <div style="display:grid; grid-template-columns: 1.15fr 1fr; gap:16px; align-items:start;">
                    <div style="background:#181715; border:1px solid #c9a96e; border-radius:10px; padding:14px; text-align:left;">
                        <h3 style="margin-top:0;">${editObj ? '✏️ Редактировать обновление' : '➕ Выложить обновление сайта'}</h3>
                        <div style="display:flex; gap:8px; margin-bottom:8px;">
                            <input type="text" id="adm-upd-ver" value="${ESC_HTML(editObj?.version || '')}" placeholder="Версия (напр. v1.4)" style="width:130px; text-align:left;">
                            <select id="adm-upd-tag" style="flex:1; text-align:left;">
                                ${['✨ Новое', '🛠️ Исправления', '🗺️ Карты и редактор', '⚔️ Бой и механики', '📢 Важное'].map(tg =>
                                    `<option value="${tg}" ${(editObj?.tag || '✨ Новое') === tg ? 'selected' : ''}>${tg}</option>`
                                ).join('')}
                            </select>
                        </div>
                        <input type="text" id="adm-upd-title" value="${ESC_HTML(editObj?.title || '')}" placeholder="Заголовок обновления..." style="margin-bottom:8px; text-align:left;">
                        <textarea id="adm-upd-body" style="min-height:130px; margin-bottom:10px;" placeholder="Что изменилось? Можно писать списком через дефис:\n- Добавлена админка\n- Исправлены баги карты">${ESC_HTML(editObj?.body || '')}</textarea>
                        <div style="display:flex; gap:8px;">
                            <button class="btn-save" style="flex:1;" onclick="ADMIN_PUBLISH_UPDATE()">${editObj ? '💾 Сохранить правки' : '🚀 Опубликовать для всех'}</button>
                            ${editObj ? `<button onclick="window._editingUpdateId=null; RENDER_ADMIN_PANEL_MODAL();">Отмена</button>` : ''}
                        </div>
                    </div>

                    <div style="text-align:left;">
                        <h3 style="margin-top:0;">📜 Опубликованные (${list.length})</h3>
                        <div style="max-height:320px; overflow-y:auto;">
                            ${histHTML || '<div style="color:#777; padding:16px; text-align:center;">Обновлений ещё нет</div>'}
                        </div>
                    </div>
                </div>
            `;
        } else if (tab === 'moderation') {
            const templates = (typeof GET_SHARED_TEMPLATES === 'function') ? GET_SHARED_TEMPLATES() : [];
            const tplHTML = templates.map(t => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#181715; border:1px solid #38332c; padding:8px 12px; border-radius:6px; margin-bottom:6px;">
                    <span>📋 <b>${ESC_HTML(t.charSnapshot?.name || 'Шаблон')}</b> <small style="color:#aaa;">(Автор: ${ESC_HTML(t.authorName || '—')})</small></span>
                    <button class="btn-small btn-danger" onclick="DELETE_USER_SHARED_TEMPLATE('${t.templateId}'); RENDER_ADMIN_PANEL_MODAL();">🗑️ Удалить</button>
                </div>
            `).join('');

            bodyHTML = `
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; text-align:left;">
                    <div style="background:#181715; border:1px solid #423c33; border-radius:10px; padding:14px; display:flex; flex-direction:column; gap:8px;">
                        <h3 style="margin-top:0;">🧹 Очистка и сбросы</h3>
                        <button class="btn-danger" onclick="ADMIN_MOD_ACTION('clear_chat')">🗑️ Очистить Чат игроков</button>
                        <button class="btn-danger" onclick="ADMIN_MOD_ACTION('clear_sys')">🗑️ Очистить Системный лог</button>
                        <button class="btn-small btn-danger" onclick="ADMIN_MOD_ACTION('clear_npc_log')">🗑️ Очистить историю диалогов NPC</button>
                        <button class="btn-small btn-warn" onclick="ADMIN_MOD_ACTION('reset_popups')">🔄 Сбросить зависшие голосования / проверки / NPC</button>
                        ${GET_SESSION() ? `<button class="btn-small btn-danger" onclick="ADMIN_MOD_ACTION('reset_active_char')">⚠️ Сбросить текущего персонажа до 1 ур.</button>` : ''}
                    </div>

                    <div style="background:#181715; border:1px solid #423c33; border-radius:10px; padding:14px;">
                        <h3 style="margin-top:0;">🌟 Витрина шаблонов игроков (${templates.length})</h3>
                        <div style="max-height:240px; overflow-y:auto;">
                            ${tplHTML || '<div style="color:#777;">Шаблонов нет</div>'}
                        </div>
                    </div>
                </div>
            `;
        } else if (tab === 'users') {
            const accounts = (typeof GET_ACCOUNTS === 'function') ? GET_ACCOUNTS() : {};
            const cloudAdmins = GET_CLOUD_ADMINS();
            const hardcoded = HARDCODED_ADMIN_LOGINS.map(x => x.toLowerCase());
            const rooms = GET_ROOMS();

            const accHTML = Object.entries(accounts).map(([k, a]) => {
                const lk = String(a.login || k).toLowerCase().trim();
                const isAdm = hardcoded.includes(lk) || cloudAdmins.includes(lk);
                return `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:#181715; border:1px solid ${isAdm ? '#c9a96e' : '#38332c'}; padding:8px 12px; border-radius:6px; margin-bottom:6px;">
                        <div>
                            <b>${ESC_HTML(a.displayName || a.login)}</b> <small style="color:#888;">(${ESC_HTML(lk)})</small>
                            ${isAdm ? '<span style="color:#e6c88c; font-size:0.8rem; margin-left:6px;">🛡️ Админ</span>' : ''}
                        </div>
                        ${hardcoded.includes(lk)
                            ? '<small style="color:#c9a96e;">Главный</small>'
                            : (isAdm
                                ? `<button class="btn-small btn-danger" onclick="ADMIN_GRANT_OR_REVOKE('${ESC_HTML(lk)}', false)">Снять админа</button>`
                                : `<button class="btn-small btn-save" onclick="ADMIN_GRANT_OR_REVOKE('${ESC_HTML(lk)}', true)">Выдать админа</button>`)
                        }
                    </div>
                `;
            }).join('');

            const roomHTML = rooms.map(r => `
                <div style="display:flex; justify-content:space-between; align-items:center; background:#181715; border:1px solid #38332c; padding:8px 12px; border-radius:6px; margin-bottom:6px;">
                    <span>🏰 <b>#${ESC_HTML(r.code)}</b> — ${ESC_HTML(r.name)}</span>
                    ${rooms.length > 1 ? `<button class="btn-small btn-danger" onclick="ADMIN_DELETE_ROOM('${ESC_HTML(r.code)}')">🗑️</button>` : '<small style="color:#888;">Основная</small>'}
                </div>
            `).join('');

            bodyHTML = `
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:16px; text-align:left;">
                    <div>
                        <h3 style="margin-top:0;">👥 Аккаунты (${Object.keys(accounts).length})</h3>
                        <div style="max-height:280px; overflow-y:auto;">${accHTML || '<div style="color:#777;">Нет данных</div>'}</div>
                    </div>
                    <div>
                        <h3 style="margin-top:0;">🏰 Комнаты кампаний (${rooms.length})</h3>
                        <div style="max-height:280px; overflow-y:auto;">${roomHTML}</div>
                    </div>
                </div>
            `;
        } else {
            bodyHTML = `
                <div style="background:#181715; border:1px solid #423c33; border-radius:10px; padding:16px; text-align:left; display:flex; flex-direction:column; gap:12px;">
                    <h3 style="margin-top:0;">👁️ Предпросмотр и отладка</h3>
                    <p style="color:#ccc; font-size:0.92rem;">
                        Включите <b>«Вид обычного игрока»</b>, чтобы проверить, что у других пользователей скрыты кнопка сброса персонажа, смена уровня, читы инвентаря, тест мультиплеера и очистка чата.
                    </p>
                    <div>
                        <button class="${window._adminPreviewAsUser ? 'btn-save' : 'btn-warn'}" onclick="TOGGLE_ADMIN_PREVIEW_MODE()">
                            ${window._adminPreviewAsUser ? '🛡️ Вернуться в полноценный режим Админа' : '👁️ Включить вид обычного игрока (Предпросмотр)'}
                        </button>
                    </div>
                </div>
            `;
        }

        cont.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #3d3830; padding-bottom:10px; margin-bottom:14px; flex-wrap:wrap; gap:8px;">
                <h2 style="margin:0; border:none; padding:0;">🛡️ Панель Администратора</h2>
                <button class="btn-small ${window._adminPreviewAsUser ? 'btn-save' : 'btn-warn'}" onclick="TOGGLE_ADMIN_PREVIEW_MODE()">
                    ${window._adminPreviewAsUser ? '🛡️ Выйти из предпросмотра' : '👁️ Вид обычного игрока'}
                </button>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:14px;">
                ${tBtn('updates', '📢 Обновления сайта')}
                ${tBtn('moderation', '🧹 Модерация и Чат')}
                ${tBtn('users', '👥 Аккаунты и Комнаты')}
                ${tBtn('debug', '🛠️ Отладка')}
            </div>
            ${bodyHTML}
            <div style="margin-top:16px; text-align:right;">
                <button onclick="CM('admin-panel-modal')">Закрыть</button>
            </div>
        `;
    }

    // --- 6. КНОПКИ «📢 ОБНОВЛЕНИЯ» И «🛡️ АДМИНКА» В ШАПКАХ ---
    function BUILD_UPDATES_BTN_HTML(extraStyle = '') {
        const unread = GET_UNREAD_UPDATES_COUNT();
        const badge = unread > 0
            ? ` <span style="background:#ef4444; color:#fff; border-radius:10px; padding:1px 6px; font-size:0.74rem; margin-left:3px; font-weight:bold;">NEW</span>`
            : '';
        return `<button class="btn-small" data-admin-ui="updates" style="background:#26231e; color:#e6c88c; border:1px solid ${unread > 0 ? '#ef4444' : '#c9a96e'}; ${extraStyle}" onclick="OPEN_SITE_UPDATES_MODAL()">📢 Обновления${badge}</button>`;
    }

    function BUILD_ADMIN_BTN_HTML() {
        if (!window.IS_REAL_ADMIN()) return '';
        if (window._adminPreviewAsUser) {
            return `<button class="btn-small btn-warn" data-admin-ui="admin" onclick="TOGGLE_ADMIN_PREVIEW_MODE()">👁️ Вид игрока (Вернуть Админа)</button>`;
        }
        return `<button class="btn-small" data-admin-ui="admin" style="background:linear-gradient(180deg, #dc2626 0%, #991b1b 100%); color:#fff; border-color:#f87171;" onclick="OPEN_ADMIN_PANEL()">🛡️ Админка</button>`;
    }

    function INJECT_ROOM_TOPBAR_BUTTONS() {
        const bar = document.getElementById('role-status-bar');
        if (!bar || bar.style.display === 'none') return;
        bar.querySelectorAll('[data-admin-ui="updates"], [data-admin-ui="admin"]').forEach(el => el.remove());

        const exitBtn = bar.querySelector('button[onclick="SHOW_LOBBY_SCREEN()"]');
        if (!exitBtn) return;

        let row = exitBtn.closest('[data-admin-topbar-row]');
        if (!row) {
            row = document.createElement('div');
            row.setAttribute('data-admin-topbar-row', '1');
            row.style.cssText = 'display:flex; align-items:center; gap:6px; flex-wrap:wrap; justify-content:flex-end;';
            exitBtn.before(row);
            row.appendChild(exitBtn);
        }
        const temp = document.createElement('div');
        temp.innerHTML = BUILD_UPDATES_BTN_HTML() + BUILD_ADMIN_BTN_HTML();
        while (temp.firstChild) row.insertBefore(temp.firstChild, exitBtn);
    }

    // --- 7. ОГРАНИЧЕНИЯ ДЛЯ ОБЫЧНЫХ ПОЛЬЗОВАТЕЛЕЙ (ПЕРЕХВАТ ФУНКЦИЙ И UI) ---

    // 7.1. Легитимное повышение уровня, когда Мастер выдал достаточно XP
    const _ORIG_ULV = window.ULV;
    window.PLAYER_LEGIT_LEVEL_UP = function() {
        const cs = GC();
        const c = cs[PI];
        if (!c) return;
        const nextLv = (c.level || 1) + 1;
        if (nextLv > 20 || (c.xp || 0) < XPL(nextLv)) {
            showMessage('🔒 Недостаточно опыта', `Для ${nextLv}-го уровня нужно ${XPL(nextLv)} XP (у вас ${c.xp || 0} XP).`);
            return;
        }
        _ORIG_ULV(nextLv);
        LOG_COMBAT_TO_CHAT(`🌟 повышает уровень до ${nextLv}-го!`);
    };

    window.ULV = function(lv) {
        if (!CAN_EDIT_GAME_VALUES()) {
            showMessage('🔒 Только для Мастера / Админа', 'Уровень повышается автоматически при накоплении опыта или выдаётся Гейм-Мастером.');
            ROS();
            return;
        }
        return _ORIG_ULV(lv);
    };

    const _ORIG_UHP = window.UHP;
    window.UHP = function(field, val) {
        if (!CAN_EDIT_GAME_VALUES()) {
            showMessage('🔒 Недоступно', 'Здоровье изменяется в бою, зельями, отдыхом или Гейм-Мастером.');
            ROS();
            return;
        }
        return _ORIG_UHP(field, val);
    };

    const _ORIG_UCF = window.UCF;
    window.UCF = function(f, v) {
        if ((f === 'xp' || f === 'inspiration') && !CAN_EDIT_GAME_VALUES()) {
            return;
        }
        return _ORIG_UCF(f, v);
    };

    // 7.2. Сброс персонажа (только Админ)
    const _ORIG_RST = window.RST;
    window.RST = function() {
        if (!window.IS_ADMIN()) {
            showMessage('🔒 Недоступно', 'Сброс персонажа доступен только администратору.');
            return;
        }
        return _ORIG_RST();
    };

    // 7.3. Задачи отряда (игрок только читает)
    const _ORIG_EDT = window.EDT;
    window.EDT = function() {
        if (!CAN_EDIT_GAME_VALUES()) return;
        return _ORIG_EDT();
    };

    // 7.4. Тест мультиплеера и добавление тестовых союзников (только Админ)
    const _ORIG_SWITCH_PLAYER = window.SWITCH_ACTIVE_PLAYER;
    window.SWITCH_ACTIVE_PLAYER = function(idx) {
        if (!window.IS_ADMIN()) return;
        return _ORIG_SWITCH_PLAYER(idx);
    };
    const _ORIG_ADD_TEST = window.ADD_TEST_PARTY_MEMBER;
    window.ADD_TEST_PARTY_MEMBER = function() {
        if (!window.IS_ADMIN()) return;
        return _ORIG_ADD_TEST();
    };
    const _ORIG_REM_TEST = window.REMOVE_LAST_PARTY_MEMBER;
    window.REMOVE_LAST_PARTY_MEMBER = function() {
        if (!window.IS_ADMIN()) return;
        return _ORIG_REM_TEST();
    };

    // 7.5. Очистка чата и лога (только Админ)
    const _ORIG_CLEAR_CHAT = window.CLEAR_CURRENT_CHAT_TAB;
    window.CLEAR_CURRENT_CHAT_TAB = function() {
        if (!window.IS_ADMIN()) {
            showMessage('🔒 Недоступно', 'Очистка чата и лога доступна только администратору.');
            return;
        }
        return _ORIG_CLEAR_CHAT();
    };

    const _ORIG_RCH = window.RCH;
    window.RCH = function() {
        _ORIG_RCH();
        if (!window.IS_ADMIN()) {
            const clrBtn = document.querySelector('#chat-tabs-header button[onclick="CLEAR_CURRENT_CHAT_TAB()"]');
            if (clrBtn) clrBtn.remove();
        }
    };

    // 7.6. Отряд: убираем блок «Тест мультиплеера» у обычных пользователей
    const _ORIG_RPL_ADM = window.RPL;
    window.RPL = function() {
        _ORIG_RPL_ADM();
        if (!window.IS_ADMIN()) {
            const con = document.getElementById('party-list');
            if (!con) return;
            Array.from(con.children).forEach(el => {
                if (el.innerHTML && (el.innerHTML.includes('Тест мультиплеера') || el.innerHTML.includes('SWITCH_ACTIVE_PLAYER'))) {
                    el.remove();
                }
            });
            con.querySelectorAll('button[onclick*="ADD_TEST_PARTY_MEMBER"], button[onclick*="REMOVE_LAST_PARTY_MEMBER"]').forEach(b => b.remove());
        }
    };

    // 7.7. Лист персонажа: скрываем ручное редактирование Уровня, XP, ХП и Вдохновения у игроков
    const _ORIG_OCS_ADM = window.OCS;
    window.OCS = function() {
        _ORIG_OCS_ADM();
        if (CAN_EDIT_GAME_VALUES()) return;
        const cont = document.getElementById('char-sheet-content');
        if (!cont) return;
        const cs = GC();
        const c = cs[PI];
        if (!c) return;

        const lvInp = cont.querySelector('input[onchange^="ULV("]');
        if (lvInp) {
            const wrap = document.createElement('span');
            const curLv = c.level || 1;
            const canLvlUp = curLv < 20 && (c.xp || 0) >= XPL(curLv + 1);
            wrap.innerHTML = `<b style="color:#e6c88c; font-size:1.1rem;">${curLv} ур.</b>` +
                (canLvlUp ? ` <button class="btn-small btn-save" style="margin-left:6px; padding:3px 9px;" onclick="PLAYER_LEGIT_LEVEL_UP()">⬆️ Повысить до ${curLv + 1} ур.!</button>` : '');
            lvInp.replaceWith(wrap);
        }

        const xpInp = cont.querySelector('input[onchange*="UCF(\'xp\'"]');
        if (xpInp) {
            const s = document.createElement('b');
            s.textContent = String(c.xp || 0);
            xpInp.replaceWith(s);
        }

        const hpInp = cont.querySelector('input[onchange*="UHP(\'hp\'"]');
        if (hpInp) {
            const s = document.createElement('b');
            s.textContent = String(c.hp ?? 10);
            hpInp.replaceWith(s);
        }

        const thpInp = cont.querySelector('input[onchange*="UHP(\'tempHP\'"]');
        if (thpInp) {
            const s = document.createElement('b');
            s.textContent = String(c.tempHP || 0);
            thpInp.replaceWith(s);
        }

        const inspInp = cont.querySelector('input[onchange*="UCF(\'inspiration\'"]');
        if (inspInp) {
            const s = document.createElement('b');
            s.textContent = String(c.inspiration || '0');
            inspInp.replaceWith(s);
        }
    };

    // 7.8. Рюкзак: убираем накрутку золота, выдачу себе любых вещей и чит-редактирование предметов у игроков
    const _ORIG_UMY = window.UMY;
    window.UMY = function(coin, val) {
        if (!CAN_EDIT_GAME_VALUES()) return;
        return _ORIG_UMY(coin, val);
    };

    const _ORIG_ADDITEM = window.ADDITEM;
    window.ADDITEM = function() {
        if (!CAN_EDIT_GAME_VALUES()) {
            showMessage('🔒 Недоступно', 'Новые предметы можно купить в Лавке, найти на карте или получить от Гейм-Мастера.');
            return;
        }
        return _ORIG_ADDITEM();
    };

    const _ORIG_CA = window.CA;
    window.CA = function(act) {
        if (['edit', 'weapon', 'shield', 'armor'].includes(act) && !CAN_EDIT_GAME_VALUES()) {
            HCM();
            return;
        }
        return _ORIG_CA(act);
    };

    const _ORIG_SCM = window.SCM;
    window.SCM = function(e, idx) {
        _ORIG_SCM(e, idx);
        if (CAN_EDIT_GAME_VALUES()) return;
        const menu = document.getElementById('context-menu');
        if (!menu) return;
        menu.querySelectorAll('button').forEach(btn => {
            const oc = btn.getAttribute('onclick') || '';
            if (oc.includes("CA('edit')") || oc.includes("CA('weapon')") || oc.includes("CA('shield')") || oc.includes("CA('armor')")) {
                btn.remove();
            }
        });
    };

    const _ORIG_OINV_ADM = window.OINV;
    window.OINV = function() {
        _ORIG_OINV_ADM();
        if (CAN_EDIT_GAME_VALUES()) return;
        const cont = document.getElementById('inventory-content');
        if (!cont) return;

        // Кошелёк — только чтение
        cont.querySelectorAll('input[onchange^="UMY("]').forEach(inp => {
            const valDiv = document.createElement('div');
            valDiv.style.cssText = 'font-weight:bold; font-size:1.15rem; color:#e6c88c; margin-top:4px;';
            valDiv.textContent = inp.value || '0';
            inp.replaceWith(valDiv);
        });

        // Убираем панель добавления произвольных вещей и пустые слоты «+»
        const addInp = cont.querySelector('#new-item-name');
        if (addInp && addInp.parentElement && addInp.parentElement.parentElement) {
            addInp.parentElement.parentElement.remove();
        }
        cont.querySelectorAll('.inv-slot.empty').forEach(el => el.remove());

        const grids = cont.querySelectorAll('.inventory-grid');
        const backpackGrid = grids[grids.length - 1];
        if (backpackGrid && backpackGrid.children.length === 0) {
            backpackGrid.innerHTML = '<div style="grid-column:1/-1; color:#777; text-align:center; padding:14px;">В рюкзаке пока нет предметов</div>';
        }
    };

    // 7.9. Ручное переключение ячеек заклинаний (только Админ / Мастер)
    const _ORIG_TOGGLE_SLOT = window.TOGGLE_MANUAL_SLOT;
    window.TOGGLE_MANUAL_SLOT = function(slotLv) {
        if (!CAN_EDIT_GAME_VALUES()) return;
        return _ORIG_TOGGLE_SLOT(slotLv);
    };

    const _ORIG_OAT_ADM = window.OAT;
    window.OAT = function() {
        _ORIG_OAT_ADM();
        if (CAN_EDIT_GAME_VALUES()) return;
        const cont = document.getElementById('attacks-content');
        if (!cont) return;
        cont.querySelectorAll('[onclick^="TOGGLE_MANUAL_SLOT("]').forEach(el => {
            el.removeAttribute('onclick');
            el.style.cursor = 'default';
            el.title = 'Ячейки расходуются при колдовстве и восстанавливаются на отдыхе';
        });
    };

    // 7.10. Боевой HUD игрока: убираем кнопку хода за врага и пропуск чужого хода
    const _ORIG_BG3_HUD = window.RENDER_BG3_COMBAT_HUD;
    if (typeof _ORIG_BG3_HUD === 'function') {
        window.RENDER_BG3_COMBAT_HUD = function() {
            _ORIG_BG3_HUD();
            if (window.IS_ADMIN()) return;
            const hud = document.getElementById('bg3-player-combat-hud');
            if (!hud) return;
            hud.querySelectorAll('button[onclick="BG3_EXECUTE_ENEMY_AI_TURN()"]').forEach(b => b.remove());
            if (!hud.textContent.includes('ВАШ ХОД')) {
                const nextBtn = hud.querySelector('button[onclick="GM_NEXT_TURN()"]');
                if (nextBtn) {
                    nextBtn.disabled = true;
                    nextBtn.style.opacity = '0.4';
                    nextBtn.title = 'Дождитесь своего хода';
                }
            }
        };
    }

    // 7.11. Перехват рендера экрана входа, Лобби и комнаты для вставки кнопок и скрытия «Сбросить»
    const _ORIG_AUTH_SCREEN = window.RENDER_AUTH_SCREEN;
    window.RENDER_AUTH_SCREEN = function() {
        _ORIG_AUTH_SCREEN();
        const panel = document.querySelector('#auth-overlay-screen .panel');
        if (panel && !panel.querySelector('[data-admin-ui="updates"]')) {
            const box = document.createElement('div');
            box.style.cssText = 'margin-top:14px; padding-top:12px; border-top:1px dashed #3d3830;';
            box.innerHTML = BUILD_UPDATES_BTN_HTML('width:100%; padding:8px;');
            panel.appendChild(box);
        }
    };

    const _ORIG_LOBBY_ADM = window.RENDER_LOBBY_HTML;
    window.RENDER_LOBBY_HTML = function() {
        _ORIG_LOBBY_ADM();
        const lobby = document.getElementById('lobby-screen');
        if (!lobby) return;

        // Вставляем кнопки «📢 Обновления» и «🛡️ Админка» в верхнюю полосу Лобби
        const logoutBtn = lobby.querySelector('button[onclick="LOGOUT_ACCOUNT()"]');
        if (logoutBtn && logoutBtn.parentElement) {
            logoutBtn.parentElement.querySelectorAll('[data-admin-ui]').forEach(el => el.remove());
            const temp = document.createElement('div');
            temp.innerHTML = BUILD_UPDATES_BTN_HTML() + BUILD_ADMIN_BTN_HTML();
            while (temp.firstChild) logoutBtn.parentElement.insertBefore(temp.firstChild, logoutBtn);
        }

        // Если есть непрочитанное обновление — показываем компактную плашку в Лобби
        const updates = window.GET_SITE_UPDATES();
        const unread = GET_UNREAD_UPDATES_COUNT();
        if (unread > 0 && updates[0] && window._dismissedUpdateBannerId !== updates[0].id) {
            const latest = updates[0];
            const banner = document.createElement('div');
            banner.setAttribute('data-admin-ui', 'update-banner');
            banner.style.cssText = 'max-width:1040px; margin:0 auto 16px auto; background:linear-gradient(90deg, #2b2418 0%, #1c1915 100%); border:1px solid #c9a96e; border-radius:10px; padding:10px 16px; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;';
            banner.innerHTML = `
                <div style="text-align:left; font-size:0.94rem;">
                    <span style="background:#ef4444; color:#fff; padding:2px 7px; border-radius:6px; font-size:0.75rem; font-weight:bold; margin-right:6px;">НОВОЕ ОБНОВЛЕНИЕ</span>
                    <b style="color:#e6c88c;">${latest.version ? `[${ESC_HTML(latest.version)}] ` : ''}${ESC_HTML(latest.title)}</b>
                    <small style="color:#aaa; margin-left:6px;">(${ESC_HTML(latest.date || '')})</small>
                </div>
                <div style="display:flex; gap:6px;">
                    <button class="btn-small btn-save" onclick="OPEN_SITE_UPDATES_MODAL()">📖 Прочитать</button>
                    <button class="btn-small" style="padding:4px 8px;" onclick="window._dismissedUpdateBannerId=${latest.id}; this.closest('[data-admin-ui]').remove();">✕</button>
                </div>
            `;
            const firstBar = lobby.firstElementChild;
            if (firstBar) firstBar.after(banner);
            else lobby.prepend(banner);
        }
    };

    const _ORIG_APPLY_ROLE_ADM = window.APPLY_ROLE_VIEW;
    window.APPLY_ROLE_VIEW = function() {
        _ORIG_APPLY_ROLE_ADM();
        ENSURE_ADMIN_MODALS();
        INJECT_ROOM_TOPBAR_BUTTONS();

        // Скрываем кнопку «🔄 Сбросить» персонажа у обычных игроков
        const resetBtn = document.querySelector('#left-column .btn-reset');
        if (resetBtn) {
            resetBtn.style.display = window.IS_ADMIN() ? '' : 'none';
        }

        // Убираем вид кликабельности у блока «Задачи» для обычных игроков
        const tasksBox = document.getElementById('tasks-content');
        if (tasksBox) {
            tasksBox.style.cursor = CAN_EDIT_GAME_VALUES() ? 'pointer' : 'default';
        }
    };

    // Запуск модуля
    ENSURE_ADMIN_MODALS();
    SYNC_ADMIN_AND_UPDATES_FROM_CLOUD();
    APPLY_ROLE_VIEW();
})();