// ================================================================
// 🕵️ ТАЙНЫЕ КВЕСТЫ ОТ ГМ + 💬 КОММЕНТАРИИ И РЕАКЦИИ К ОБНОВЛЕНИЯМ (quests_and_social.js)
// Тайные квесты изолированы по комнатам и не попадают в общий лог/чат.
// Комментарии к обновлениям подписываются логином пользователя.
// ================================================================
(function INIT_SECRET_QUESTS_AND_UPDATE_SOCIAL() {
    const FB_ROOT = "https://dnds-23b7d-default-rtdb.firebaseio.com/campaign_v2";

    const REACTIONS = [
        { key: 'fire',  icon: '🔥' },
        { key: 'heart', icon: '❤️' },
        { key: 'like',  icon: '👍' },
        { key: 'party', icon: '🎉' },
        { key: 'eyes',  icon: '👀' },
        { key: 'laugh', icon: '😂' }
    ];

    const QUEST_STATUSES = {
        active: { icon: '🕵️', label: 'Активен',  color: '#d2b278' },
        done:   { icon: '✅', label: 'Выполнен', color: '#6cb878' },
        failed: { icon: '❌', label: 'Провален', color: '#d66565' }
    };

    window._secretQuestsCache = {};   // { [roomCode]: [quest, ...] }
    window._editingSecretQuestId = null;
    window._updateSocialCache = {};   // { [updId]: { reactions: {}, comments: {} } }
    window._openCommentBoxIds = {};   // { [updId]: true }

    let activeSqRoom = null;
    let activeSqRef = null;
    let initialSqLoaded = {};
    let socialRef = null;
    let sqToastTimer = null;

    function ESC(s) {
        return String(s || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function ESC_JS(s) {
        return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    }

    function SAFE_FB_KEY(str) {
        return String(str || '').toLowerCase().trim().replace(/[.#$\[\]\/]/g, '_');
    }

    function CUR_ROOM() {
        const s = (typeof GET_SESSION === 'function') ? GET_SESSION() : null;
        return (s && s.roomCode) ? String(s.roomCode) : null;
    }

    function IS_GM() {
        const s = (typeof GET_SESSION === 'function') ? GET_SESSION() : null;
        return !!(s && s.role === 'gm');
    }

    function MY_HERO_ID() {
        const s = (typeof GET_SESSION === 'function') ? GET_SESSION() : null;
        if (!s || s.role !== 'player') return null;
        if (typeof SYNC_MY_PLAYER_INDEX === 'function') SYNC_MY_PLAYER_INDEX();
        const cs = GC();
        const c = cs[PI];
        return (c && c.id) ? String(c.id) : (s.heroId ? String(s.heroId) : ('idx_' + PI));
    }

    function NORMALIZE_LIST(val) {
        if (!val) return [];
        const arr = Array.isArray(val) ? val : (typeof val === 'object' ? Object.values(val) : []);
        return arr.filter(Boolean).sort((a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0));
    }

    // ================================================================
    // 🕵️ ЧАСТЬ 1: ТАЙНЫЕ КВЕСТЫ ОТ ГЕЙМ-МАСТЕРА (ПРИВАТНО ПО КОМНАТАМ)
    // ================================================================
    function LS_SQ_KEY(rc) { return `dnd_secret_quests_v1_${rc}`; }
    function SEEN_SQ_KEY(rc, heroId) { return `dnd_seen_sq_v1_${rc}_${heroId}`; }

    function GET_ROOM_SECRET_QUESTS(rc) {
        const code = String(rc || CUR_ROOM() || '');
        if (!code) return [];
        if (window._secretQuestsCache[code]) return window._secretQuestsCache[code];
        try {
            const raw = localStorage.getItem(LS_SQ_KEY(code));
            if (raw) {
                const parsed = NORMALIZE_LIST(JSON.parse(raw));
                window._secretQuestsCache[code] = parsed;
                return parsed;
            }
        } catch (e) {}
        return [];
    }

    function SAVE_ROOM_SECRET_QUESTS(list, rc) {
        const code = String(rc || CUR_ROOM() || '');
        if (!code) return;
        const clean = NORMALIZE_LIST(list);
        window._secretQuestsCache[code] = clean;
        try { localStorage.setItem(LS_SQ_KEY(code), JSON.stringify(clean)); } catch (e) {}

        const obj = {};
        clean.forEach(q => { if (q && q.id) obj[q.id] = q; });

        if (window.firebase && firebase.apps && firebase.apps.length) {
            firebase.database().ref(`campaign_v2/rooms/${code}/secret_quests`).set(obj).catch(() => {});
        } else {
            fetch(`${FB_ROOT}/rooms/${encodeURIComponent(code)}/secret_quests.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(obj)
            }).catch(() => {});
        }
    }

    function GET_ROOM_HEROES() {
        const rc = CUR_ROOM();
        const cs = GC();
        const idxs = (typeof GET_ROOM_PARTY_INDICES === 'function')
            ? GET_ROOM_PARTY_INDICES(rc)
            : cs.map((_, i) => i);
        return idxs
            .filter(i => cs[i])
            .map(i => {
                const raw = cs[i];
                const view = (typeof GET_CHAR_FOR_ROOM === 'function') ? GET_CHAR_FOR_ROOM(raw, rc) : raw;
                return {
                    heroId: String(raw.id || ('idx_' + i)),
                    name: view.name || ('Герой ' + (i + 1))
                };
            });
    }

    function SHOW_SECRET_QUEST_TOAST(quest, isStatusChange) {
        let box = document.getElementById('sq-private-toast');
        if (!box) {
            box = document.createElement('div');
            box.id = 'sq-private-toast';
            box.style.cssText = 'position:fixed; top:74px; right:18px; max-width:340px; background:var(--ui-panel, #221f1c); border:2px solid var(--ui-accent, #d2b278); border-radius:11px; padding:12px 15px; color:var(--ui-text, #e5e0d7); box-shadow:0 12px 32px rgba(0,0,0,0.88); z-index:94800; cursor:pointer; font-size:0.9rem;';
            document.body.appendChild(box);
        }
        const stInfo = QUEST_STATUSES[quest.status] || QUEST_STATUSES.active;
        const header = isStatusChange
            ? `${stInfo.icon} Тайный квест: ${stInfo.label}`
            : '🕵️ Получен тайный квест!';
        box.innerHTML = `
            <div style="font-weight:bold; color:${stInfo.color}; margin-bottom:4px;">${header}</div>
            <div style="font-weight:700; margin-bottom:4px;">${ESC(quest.title)}</div>
            <div style="font-size:0.78rem; color:var(--ui-muted, #aaa);">🤫 Видите только вы и Мастер • Нажмите, чтобы открыть</div>
        `;
        box.style.display = 'block';
        box.onclick = () => {
            box.style.display = 'none';
            window.OPEN_PLAYER_SECRET_QUEST(quest.id);
        };
        if (sqToastTimer) clearTimeout(sqToastTimer);
        sqToastTimer = setTimeout(() => { if (box) box.style.display = 'none'; }, 6500);
    }

    function HANDLE_INCOMING_SECRET_QUESTS(rc, nextList) {
        window._secretQuestsCache[rc] = nextList;
        try { localStorage.setItem(LS_SQ_KEY(rc), JSON.stringify(nextList)); } catch (e) {}

        if (CUR_ROOM() !== rc) return;

        if (!IS_GM()) {
            const myId = MY_HERO_ID();
            if (myId) {
                const seenKey = SEEN_SQ_KEY(rc, myId);
                let seenMap = {};
                try { seenMap = JSON.parse(localStorage.getItem(seenKey) || '{}') || {}; } catch (e) {}
                let changed = false;

                const myQuests = nextList.filter(q => q.targetHeroId === myId);
                myQuests.forEach(q => {
                    const stamp = Number(q.updatedAt || q.createdAt || 1);
                    if (seenMap[q.id] !== stamp) {
                        const wasKnown = !!seenMap[q.id];
                        seenMap[q.id] = stamp;
                        changed = true;
                        // Показываем уведомление при живом обновлении или если квест свежий (< 5 мин)
                        if (initialSqLoaded[rc] || (Date.now() - stamp < 5 * 60 * 1000)) {
                            SHOW_SECRET_QUEST_TOAST(q, wasKnown);
                        }
                    }
                });
                if (changed) {
                    try { localStorage.setItem(seenKey, JSON.stringify(seenMap)); } catch (e) {}
                }
            }
            RENDER_PLAYER_SECRET_QUESTS_BOX();
        } else {
            UPDATE_GM_SQ_BUTTON_BADGE();
            if (document.getElementById('gm-sq-modal-marker')) {
                RENDER_GM_SECRET_QUESTS_MODAL();
            }
        }
        initialSqLoaded[rc] = true;
    }

    function SYNC_SECRET_QUESTS_FOR_ROOM(roomCode) {
        const nextRc = roomCode ? String(roomCode) : null;
        if (nextRc === activeSqRoom && (nextRc === null || activeSqRef)) return;

        if (activeSqRef) { activeSqRef.off(); activeSqRef = null; }
        activeSqRoom = nextRc;
        window._editingSecretQuestId = null;

        const toast = document.getElementById('sq-private-toast');
        if (toast) toast.style.display = 'none';

        if (!nextRc) {
            RENDER_PLAYER_SECRET_QUESTS_BOX();
            return;
        }

        fetch(`${FB_ROOT}/rooms/${encodeURIComponent(nextRc)}/secret_quests.json`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (activeSqRoom !== nextRc) return;
                HANDLE_INCOMING_SECRET_QUESTS(nextRc, NORMALIZE_LIST(data));
            })
            .catch(() => {});

        const attach = () => {
            if (activeSqRoom !== nextRc) return true;
            if (window.firebase && firebase.apps && firebase.apps.length) {
                const ref = firebase.database().ref(`campaign_v2/rooms/${nextRc}/secret_quests`);
                activeSqRef = ref;
                ref.on('value', (snap) => {
                    if (activeSqRoom !== nextRc) return;
                    HANDLE_INCOMING_SECRET_QUESTS(nextRc, NORMALIZE_LIST(snap.val()));
                });
                return true;
            }
            return false;
        };

        if (!attach()) {
            const t = setInterval(() => { if (attach()) clearInterval(t); }, 650);
            setTimeout(() => clearInterval(t), 20000);
        }
    }

    // --- UI ИГРОКА: ПРИВАТНЫЙ БЛОК ТАЙНЫХ КВЕСТОВ ПОД ЗАДАЧАМИ ---
    function RENDER_PLAYER_SECRET_QUESTS_BOX() {
        const tasksEl = document.getElementById('tasks-content');
        if (!tasksEl || !tasksEl.parentElement) return;
        const panel = tasksEl.parentElement;

        let box = document.getElementById('player-secret-quests-box');
        const rc = CUR_ROOM();
        const myId = MY_HERO_ID();

        if (!rc || IS_GM() || !myId) {
            if (box) box.remove();
            return;
        }

        const myQuests = GET_ROOM_SECRET_QUESTS(rc).filter(q => q.targetHeroId === myId);
        if (!myQuests.length) {
            if (box) box.remove();
            return;
        }

        if (!box) {
            box = document.createElement('div');
            box.id = 'player-secret-quests-box';
            box.style.cssText = 'margin-top:10px; padding-top:8px; border-top:1px dashed var(--ui-border-strong, #695c4c);';
            panel.appendChild(box);
        }

        const cards = myQuests.map(q => {
            const st = QUEST_STATUSES[q.status] || QUEST_STATUSES.active;
            const dim = q.status === 'active' ? '1' : '0.72';
            return `
                <button data-custom-bg="1" onclick="OPEN_PLAYER_SECRET_QUEST('${ESC_JS(q.id)}')"
                    style="width:100%; margin-top:5px; padding:7px 9px; border-radius:7px; text-align:left; background:var(--ui-panel2, #161412); color:var(--ui-text, #e5e0d7); border:1px solid var(--ui-border-strong, #695c4c); opacity:${dim}; cursor:pointer; box-shadow:none; display:flex; justify-content:space-between; align-items:center; gap:6px; font-size:0.84rem;">
                    <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${st.icon} <b>${ESC(q.title)}</b></span>
                    <small style="color:${st.color}; flex-shrink:0; font-size:0.74rem !important;">${st.label}</small>
                </button>`;
        }).join('');

        box.innerHTML = `
            <div style="font-size:0.8rem; font-weight:700; color:var(--ui-accent, #d2b278); display:flex; justify-content:space-between; align-items:center;">
                <span>🕵️ Тайные квесты</span>
                <small style="color:var(--ui-muted, #9a9286); font-size:0.72rem !important;">только вы</small>
            </div>
            ${cards}
        `;
    }

    window.OPEN_PLAYER_SECRET_QUEST = function(questId) {
        const q = GET_ROOM_SECRET_QUESTS().find(x => x.id === questId);
        if (!q) return;
        const st = QUEST_STATUSES[q.status] || QUEST_STATUSES.active;
        const cont = document.getElementById('gm-tool-modal-content');
        if (!cont) return;
        cont.style.maxWidth = '560px';

        cont.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; border-bottom:1px solid var(--ui-border, #3e372f); padding-bottom:8px; margin-bottom:12px; flex-wrap:wrap;">
                <span style="color:${st.color}; font-weight:bold; font-size:0.9rem;">${st.icon} Тайный квест • ${st.label}</span>
                <small style="color:var(--ui-muted, #aaa);">🤫 Видите только вы и Мастер</small>
            </div>
            <h2 style="margin-top:0; border:none; padding-bottom:4px;">${ESC(q.title)}</h2>
            <div style="background:var(--ui-panel2, #161412); border:1px solid var(--ui-border, #3e372f); border-radius:9px; padding:14px; text-align:left; white-space:pre-wrap; line-height:1.52; font-size:0.95rem;">${ESC(q.text)}</div>
            ${q.reward ? `
                <div style="margin-top:10px; background:var(--ui-panel2, #161412); border:1px dashed var(--ui-accent, #d2b278); border-radius:8px; padding:9px 12px; text-align:left; font-size:0.88rem;">
                    <b style="color:var(--ui-accent, #d2b278);">🎁 Награда / примечание:</b> ${ESC(q.reward)}
                </div>` : ''}
            <div style="margin-top:14px; text-align:right;"><button onclick="CM('gm-tool-modal')">Закрыть</button></div>
        `;
        OM('gm-tool-modal');
    };

    // --- UI МАСТЕРА: ВЫДАЧА И ТРЕКЕР ВСЕХ ТАЙНЫХ КВЕСТОВ КОМНАТЫ ---
    window.OPEN_GM_SECRET_QUESTS_MODAL = function() {
        if (!IS_GM()) return;
        window._editingSecretQuestId = null;
        RENDER_GM_SECRET_QUESTS_MODAL();
        OM('gm-tool-modal');
    };

    window.GM_SAVE_SECRET_QUEST = function() {
        if (!IS_GM()) return;
        const targetHeroId = document.getElementById('sq-gm-target')?.value || '';
        const title = (document.getElementById('sq-gm-title')?.value || '').trim();
        const text = (document.getElementById('sq-gm-text')?.value || '').trim();
        const reward = (document.getElementById('sq-gm-reward')?.value || '').trim();

        if (!targetHeroId) {
            showMessage('⚠️ Выберите игрока', 'В комнате пока нет персонажей для выдачи тайного квеста.');
            return;
        }
        if (!title || !text) {
            showMessage('⚠️ Заполните поля', 'Укажите название и суть тайного квеста.');
            return;
        }

        const rc = CUR_ROOM();
        const list = GET_ROOM_SECRET_QUESTS(rc).slice();
        const heroObj = GET_ROOM_HEROES().find(h => h.heroId === targetHeroId);
        const targetName = heroObj ? heroObj.name : 'Игрок';
        const now = Date.now();

        if (window._editingSecretQuestId) {
            const existing = list.find(q => q.id === window._editingSecretQuestId);
            if (existing) {
                existing.targetHeroId = targetHeroId;
                existing.targetName = targetName;
                existing.title = title;
                existing.text = text;
                existing.reward = reward;
                existing.updatedAt = now;
            }
            window._editingSecretQuestId = null;
        } else {
            list.unshift({
                id: 'sq_' + now + '_' + Math.random().toString(36).slice(2, 6),
                targetHeroId,
                targetName,
                title,
                text,
                reward,
                status: 'active',
                createdAt: now,
                updatedAt: now,
                by: (typeof GET_GM_NAME === 'function') ? GET_GM_NAME() : 'Гейм-Мастер'
            });
        }

        SAVE_ROOM_SECRET_QUESTS(list, rc);
        UPDATE_GM_SQ_BUTTON_BADGE();
        RENDER_GM_SECRET_QUESTS_MODAL();
        showMessage('🕵️ Тайный квест сохранён', `Задание «<b>${ESC(title)}</b>» отправлено лично игроку <b>${ESC(targetName)}</b>.<br><small>В общий чат и системный лог ничего не попало.</small>`);
    };

    window.GM_SET_SECRET_QUEST_STATUS = function(qId, nextStatus) {
        if (!IS_GM()) return;
        const rc = CUR_ROOM();
        const list = GET_ROOM_SECRET_QUESTS(rc).slice();
        const q = list.find(x => x.id === qId);
        if (!q) return;
        q.status = nextStatus;
        q.updatedAt = Date.now();
        SAVE_ROOM_SECRET_QUESTS(list, rc);
        UPDATE_GM_SQ_BUTTON_BADGE();
        RENDER_GM_SECRET_QUESTS_MODAL();
    };

    window.GM_EDIT_SECRET_QUEST = function(qId) {
        if (!IS_GM()) return;
        window._editingSecretQuestId = qId;
        RENDER_GM_SECRET_QUESTS_MODAL();
    };

    window.GM_DELETE_SECRET_QUEST = function(qId) {
        if (!IS_GM()) return;
        if (!confirm('Удалить этот тайный квест?')) return;
        const rc = CUR_ROOM();
        const next = GET_ROOM_SECRET_QUESTS(rc).filter(x => x.id !== qId);
        if (window._editingSecretQuestId === qId) window._editingSecretQuestId = null;
        SAVE_ROOM_SECRET_QUESTS(next, rc);
        UPDATE_GM_SQ_BUTTON_BADGE();
        RENDER_GM_SECRET_QUESTS_MODAL();
    };

    function RENDER_GM_SECRET_QUESTS_MODAL() {
        const cont = document.getElementById('gm-tool-modal-content');
        if (!cont) return;
        cont.style.maxWidth = '960px';

        const rc = CUR_ROOM();
        const list = GET_ROOM_SECRET_QUESTS(rc);
        const heroes = GET_ROOM_HEROES();
        const editObj = window._editingSecretQuestId ? list.find(q => q.id === window._editingSecretQuestId) : null;

        const heroOpts = heroes.length
            ? heroes.map(h => `<option value="${ESC(h.heroId)}" ${editObj && editObj.targetHeroId === h.heroId ? 'selected' : ''}>👤 ${ESC(h.name)}</option>`).join('')
            : '<option value="">В комнате пока нет игроков</option>';

        const cardsHTML = list.map(q => {
            const st = QUEST_STATUSES[q.status] || QUEST_STATUSES.active;
            return `
                <div style="background:var(--ui-panel2, #181715); border:1px solid var(--ui-border, #3e372f); border-left:4px solid ${st.color}; border-radius:9px; padding:11px 13px; margin-bottom:9px; text-align:left;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; flex-wrap:wrap; margin-bottom:5px;">
                        <div>
                            <b style="color:var(--ui-accent, #e6c88c);">${ESC(q.title)}</b>
                            <div style="font-size:0.8rem; color:var(--ui-muted, #aaa); margin-top:2px;">
                                Кому: <b style="color:var(--ui-text, #eee);">${ESC(q.targetName)}</b> • <span style="color:${st.color};">${st.icon} ${st.label}</span>
                            </div>
                        </div>
                        <div style="display:flex; gap:4px; flex-wrap:wrap;">
                            ${q.status !== 'done' ? `<button class="btn-small btn-save" style="padding:3px 7px; font-size:0.76rem;" title="Отметить выполненным" onclick="GM_SET_SECRET_QUEST_STATUS('${ESC_JS(q.id)}', 'done')">✅</button>` : ''}
                            ${q.status !== 'failed' ? `<button class="btn-small btn-warn" style="padding:3px 7px; font-size:0.76rem;" title="Отметить проваленным" onclick="GM_SET_SECRET_QUEST_STATUS('${ESC_JS(q.id)}', 'failed')">❌</button>` : ''}
                            ${q.status !== 'active' ? `<button class="btn-small" style="padding:3px 7px; font-size:0.76rem;" title="Вернуть в активные" onclick="GM_SET_SECRET_QUEST_STATUS('${ESC_JS(q.id)}', 'active')">🔄</button>` : ''}
                            <button class="btn-small" style="padding:3px 7px; font-size:0.76rem;" onclick="GM_EDIT_SECRET_QUEST('${ESC_JS(q.id)}')">✏️</button>
                            <button class="btn-small btn-danger" style="padding:3px 7px; font-size:0.76rem;" onclick="GM_DELETE_SECRET_QUEST('${ESC_JS(q.id)}')">🗑️</button>
                        </div>
                    </div>
                    <div style="font-size:0.86rem; color:var(--ui-text, #ddd); white-space:pre-wrap; line-height:1.4;">${ESC(q.text)}</div>
                    ${q.reward ? `<div style="font-size:0.8rem; color:var(--ui-accent, #d2b278); margin-top:5px;">🎁 ${ESC(q.reward)}</div>` : ''}
                </div>`;
        }).join('');

        cont.innerHTML = `
            <div id="gm-sq-modal-marker"></div>
            <h2>🕵️ Тайные квесты комнаты #${ESC(rc)}</h2>
            <p style="color:var(--ui-muted, #aaa); font-size:0.88rem; margin-bottom:14px;">
                Тайный квест видит только выбранный игрок и вы. В общий чат и системный лог ничего не отправляется.
            </p>
            <div style="display:grid; grid-template-columns: 1fr 1.15fr; gap:16px; align-items:start;">
                <div style="background:var(--ui-panel2, #181715); border:1px solid var(--ui-border-strong, #695c4c); border-radius:10px; padding:14px; text-align:left; display:flex; flex-direction:column; gap:10px;">
                    <h3 style="margin:0;">${editObj ? '✏️ Изменить тайный квест' : '➕ Выдать тайный квест'}</h3>
                    <div>
                        <label style="font-size:0.84rem; color:var(--ui-muted, #aaa);">Игрок:</label>
                        <select id="sq-gm-target" style="margin-top:4px; text-align:left;">${heroOpts}</select>
                    </div>
                    <div>
                        <label style="font-size:0.84rem; color:var(--ui-muted, #aaa);">Название задания:</label>
                        <input type="text" id="sq-gm-title" value="${ESC(editObj?.title || '')}" placeholder="Напр.: Украсть печать Министра" style="margin-top:4px; text-align:left;">
                    </div>
                    <div>
                        <label style="font-size:0.84rem; color:var(--ui-muted, #aaa);">Подробности для игрока:</label>
                        <textarea id="sq-gm-text" style="min-height:110px; margin-top:4px;" placeholder="Что нужно сделать и почему это нужно держать в тайне от остальных...">${ESC(editObj?.text || '')}</textarea>
                    </div>
                    <div>
                        <label style="font-size:0.84rem; color:var(--ui-muted, #aaa);">Награда / подсказка (необязательно):</label>
                        <input type="text" id="sq-gm-reward" value="${ESC(editObj?.reward || '')}" placeholder="Напр.: 100 зм или секретный артефакт" style="margin-top:4px; text-align:left;">
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-save" style="flex:1;" ${!heroes.length ? 'disabled' : ''} onclick="GM_SAVE_SECRET_QUEST()">${editObj ? '💾 Сохранить правки' : '🕵️ Отправить тайно'}</button>
                        ${editObj ? `<button onclick="window._editingSecretQuestId=null; RENDER_GM_SECRET_QUESTS_MODAL();">Отмена</button>` : ''}
                    </div>
                </div>

                <div style="text-align:left;">
                    <h3 style="margin-top:0;">📋 Выданные тайные квесты (${list.length})</h3>
                    <div style="max-height:400px; overflow-y:auto; padding-right:2px;">
                        ${cardsHTML || '<div style="padding:26px; text-align:center; color:var(--ui-muted, #888); background:var(--ui-panel2, #181715); border:1px dashed var(--ui-border, #3e372f); border-radius:9px;">Вы ещё не выдавали тайных квестов в этой комнате.</div>'}
                    </div>
                </div>
            </div>
            <div style="margin-top:14px; text-align:right;"><button onclick="CM('gm-tool-modal')">Закрыть</button></div>
        `;
    }

    function UPDATE_GM_SQ_BUTTON_BADGE() {
        const btn = document.getElementById('gm-secret-quests-btn');
        if (!btn) return;
        const activeCnt = GET_ROOM_SECRET_QUESTS().filter(q => q.status === 'active').length;
        btn.textContent = activeCnt > 0 ? `🕵️ Тайные квесты (${activeCnt})` : '🕵️ Тайные квесты';
    }

    function INJECT_GM_SECRET_QUESTS_BUTTON() {
        if (!IS_GM()) return;
        const gmMenu = document.getElementById('gm-left-menu');
        if (!gmMenu) return;
        const firstPanel = gmMenu.querySelector('.panel');
        if (!firstPanel) return;
        const btnContainer = firstPanel.querySelector('div[style*="flex-direction:column"]');
        if (!btnContainer || btnContainer.querySelector('#gm-secret-quests-btn')) {
            UPDATE_GM_SQ_BUTTON_BADGE();
            return;
        }
        const btn = document.createElement('button');
        btn.id = 'gm-secret-quests-btn';
        btn.onclick = () => window.OPEN_GM_SECRET_QUESTS_MODAL();
        const rewardBtn = Array.from(btnContainer.querySelectorAll('button')).find(b => b.textContent.includes('Награду'));
        if (rewardBtn) rewardBtn.after(btn);
        else btnContainer.appendChild(btn);
        UPDATE_GM_SQ_BUTTON_BADGE();
    }

    // ================================================================
    // 💬 ЧАСТЬ 2: КОММЕНТАРИИ (ПО ЛОГИНУ) И ЭМОДЗИ-РЕАКЦИИ К ОБНОВЛЕНИЯМ
    // ================================================================
    function SYNC_UPDATE_SOCIAL_FROM_CLOUD() {
        fetch(`${FB_ROOT}/site_updates_social.json`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data && typeof data === 'object') {
                    window._updateSocialCache = data;
                    REFRESH_OPEN_UPDATES_SOCIAL();
                }
            })
            .catch(() => {});

        const attach = () => {
            if (window.firebase && firebase.apps && firebase.apps.length) {
                socialRef = firebase.database().ref('campaign_v2/site_updates_social');
                socialRef.on('value', (snap) => {
                    window._updateSocialCache = snap.val() || {};
                    REFRESH_OPEN_UPDATES_SOCIAL();
                });
                return true;
            }
            return false;
        };
        if (!attach()) {
            const t = setInterval(() => { if (attach()) clearInterval(t); }, 700);
            setTimeout(() => clearInterval(t), 25000);
        }
    }

    window.TOGGLE_UPDATE_REACTION = function(updId, reactKey) {
        const user = (typeof GET_CURRENT_USER === 'function') ? GET_CURRENT_USER() : null;
        if (!user || !user.login) {
            showMessage('🔑 Нужен вход', 'Войдите в свой аккаунт, чтобы ставить реакции.');
            return;
        }
        const idStr = String(updId);
        const loginExact = String(user.login).trim();
        const uKey = SAFE_FB_KEY(loginExact);

        if (!window._updateSocialCache[idStr]) window._updateSocialCache[idStr] = {};
        if (!window._updateSocialCache[idStr].reactions) window._updateSocialCache[idStr].reactions = {};
        if (!window._updateSocialCache[idStr].reactions[reactKey]) window._updateSocialCache[idStr].reactions[reactKey] = {};

        const bucket = window._updateSocialCache[idStr].reactions[reactKey];
        const hasMine = !!bucket[uKey];

        if (hasMine) delete bucket[uKey];
        else bucket[uKey] = loginExact;

        REFRESH_OPEN_UPDATES_SOCIAL();

        const path = `site_updates_social/${idStr}/reactions/${reactKey}/${uKey}`;
        if (window.firebase && firebase.apps && firebase.apps.length) {
            const ref = firebase.database().ref(`campaign_v2/${path}`);
            if (hasMine) ref.remove().catch(() => {});
            else ref.set(loginExact).catch(() => {});
        } else {
            fetch(`${FB_ROOT}/${path}.json`, {
                method: hasMine ? 'DELETE' : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: hasMine ? undefined : JSON.stringify(loginExact)
            }).catch(() => {});
        }
    };

    window.TOGGLE_UPDATE_COMMENTS_PANEL = function(updId) {
        const idStr = String(updId);
        window._openCommentBoxIds[idStr] = !window._openCommentBoxIds[idStr];
        REFRESH_OPEN_UPDATES_SOCIAL();
        if (window._openCommentBoxIds[idStr]) {
            const inp = document.getElementById(`upd-cmt-inp-${idStr}`);
            if (inp) inp.focus();
        }
    };

    window.ADD_UPDATE_COMMENT = function(updId) {
        const user = (typeof GET_CURRENT_USER === 'function') ? GET_CURRENT_USER() : null;
        if (!user || !user.login) {
            showMessage('🔑 Нужен вход', 'Войдите в свой аккаунт, чтобы оставлять комментарии.');
            return;
        }
        const idStr = String(updId);
        const inp = document.getElementById(`upd-cmt-inp-${idStr}`);
        const text = (inp ? inp.value : '').trim();
        if (!text) return;

        const now = Date.now();
        const cId = 'c_' + now + '_' + Math.random().toString(36).slice(2, 6);
        const dateStr = new Date(now).toLocaleDateString('ru-RU') + ' ' +
                        new Date(now).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

        // Подпись строго логином пользователя!
        const cmt = {
            id: cId,
            login: String(user.login).trim(),
            text: text.slice(0, 500),
            date: dateStr,
            ts: now
        };

        if (!window._updateSocialCache[idStr]) window._updateSocialCache[idStr] = {};
        if (!window._updateSocialCache[idStr].comments) window._updateSocialCache[idStr].comments = {};
        window._updateSocialCache[idStr].comments[cId] = cmt;

        if (inp) inp.value = '';
        window._openCommentBoxIds[idStr] = true;
        REFRESH_OPEN_UPDATES_SOCIAL();

        const path = `site_updates_social/${idStr}/comments/${cId}`;
        if (window.firebase && firebase.apps && firebase.apps.length) {
            firebase.database().ref(`campaign_v2/${path}`).set(cmt).catch(() => {});
        } else {
            fetch(`${FB_ROOT}/${path}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(cmt)
            }).catch(() => {});
        }
    };

    window.DELETE_UPDATE_COMMENT = function(updId, cId) {
        const user = (typeof GET_CURRENT_USER === 'function') ? GET_CURRENT_USER() : null;
        const isAdmin = (typeof window.IS_ADMIN === 'function') && window.IS_ADMIN();
        const idStr = String(updId);
        const bucket = window._updateSocialCache[idStr]?.comments;
        const cmt = bucket && bucket[cId];
        if (!cmt) return;

        const isOwner = !!(user && user.login && SAFE_FB_KEY(user.login) === SAFE_FB_KEY(cmt.login));
        if (!isAdmin && !isOwner) return;
        if (!confirm('Удалить этот комментарий?')) return;

        delete bucket[cId];
        REFRESH_OPEN_UPDATES_SOCIAL();

        const path = `site_updates_social/${idStr}/comments/${cId}`;
        if (window.firebase && firebase.apps && firebase.apps.length) {
            firebase.database().ref(`campaign_v2/${path}`).remove().catch(() => {});
        } else {
            fetch(`${FB_ROOT}/${path}.json`, { method: 'DELETE' }).catch(() => {});
        }
    };

    function RENDER_SOCIAL_FOR_CARD(card, updId) {
        const idStr = String(updId);
        const social = window._updateSocialCache[idStr] || {};
        const reactionsObj = social.reactions || {};
        const commentsObj = social.comments || {};
        const commentsList = Object.values(commentsObj)
            .filter(c => c && c.id && c.text)
            .sort((a, b) => (a.ts || 0) - (b.ts || 0));

        const user = (typeof GET_CURRENT_USER === 'function') ? GET_CURRENT_USER() : null;
        const myLoginKey = (user && user.login) ? SAFE_FB_KEY(user.login) : '';
        const isAdmin = (typeof window.IS_ADMIN === 'function') && window.IS_ADMIN();

        let box = card.querySelector('[data-upd-social-box]');
        if (!box) {
            box = document.createElement('div');
            box.setAttribute('data-upd-social-box', idStr);
            box.style.cssText = 'margin-top:10px; padding-top:8px; border-top:1px dashed var(--ui-border, #3e372f);';
            card.appendChild(box);
        }

        // Сохраняем недописанный текст комментария при живом перерисовывании
        const existingInp = document.getElementById(`upd-cmt-inp-${idStr}`);
        const draftText = existingInp ? existingInp.value : '';
        const hadFocus = (document.activeElement && document.activeElement.id === `upd-cmt-inp-${idStr}`);

        const reactBtns = REACTIONS.map(r => {
            const usersMap = reactionsObj[r.key] || {};
            const logins = Object.values(usersMap).filter(Boolean);
            const cnt = logins.length;
            const mine = !!(myLoginKey && usersMap[myLoginKey]);
            const tip = cnt ? `Отреагировали: ${logins.join(', ')}` : `Поставить ${r.icon}`;
            return `
                <button data-custom-bg="1" class="btn-small" title="${ESC(tip)}" onclick="TOGGLE_UPDATE_REACTION('${ESC_JS(idStr)}', '${r.key}')"
                    style="padding:3px 8px; font-size:0.8rem; border-radius:14px; box-shadow:none; background:${mine ? 'var(--ui-btn-bg, #c8a66a)' : 'var(--ui-panel, #221f1c)'}; color:${mine ? 'var(--ui-btn-text, #1a150f)' : 'var(--ui-text, #e5e0d7)'}; border:1px solid ${mine ? 'var(--ui-accent, #d2b278)' : 'var(--ui-border, #3e372f)'};">
                    ${r.icon}${cnt > 0 ? ` <b style="margin-left:2px;">${cnt}</b>` : ''}
                </button>`;
        }).join('');

        const isOpen = !!window._openCommentBoxIds[idStr];
        let commentsHTML = '';
        if (isOpen) {
            const listHtml = commentsList.length
                ? commentsList.map(c => {
                    const canDel = isAdmin || (myLoginKey && SAFE_FB_KEY(c.login) === myLoginKey);
                    return `
                        <div style="background:var(--ui-panel, #221f1c); border:1px solid var(--ui-border, #3e372f); border-radius:7px; padding:7px 10px; margin-bottom:6px; font-size:0.86rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:3px;">
                                <b style="color:var(--ui-accent, #d2b278); font-size:0.82rem;">@${ESC(c.login)}</b>
                                <div style="display:flex; align-items:center; gap:6px;">
                                    <small style="color:var(--ui-muted, #888); font-size:0.74rem !important;">${ESC(c.date || '')}</small>
                                    ${canDel ? `<button class="btn-small btn-danger" style="padding:1px 6px; font-size:0.72rem;" title="Удалить комментарий" onclick="DELETE_UPDATE_COMMENT('${ESC_JS(idStr)}', '${ESC_JS(c.id)}')">✕</button>` : ''}
                                </div>
                            </div>
                            <div style="color:var(--ui-text, #e5e0d7); word-break:break-word; line-height:1.4;">${ESC(c.text)}</div>
                        </div>`;
                }).join('')
                : `<div style="color:var(--ui-muted, #888); font-size:0.82rem; padding:6px 2px;">Комментариев пока нет — напишите первый!</div>`;

            const formHtml = user && user.login
                ? `<div style="display:flex; gap:6px; margin-top:6px;">
                        <input type="text" id="upd-cmt-inp-${ESC(idStr)}" value="${ESC(draftText)}"
                            placeholder="Комментарий от @${ESC(user.login)}..."
                            onkeypress="if(event.key==='Enter'){ event.preventDefault(); ADD_UPDATE_COMMENT('${ESC_JS(idStr)}'); }"
                            style="flex:1; padding:6px 10px; font-size:0.85rem; text-align:left;">
                        <button class="btn-small btn-save" onclick="ADD_UPDATE_COMMENT('${ESC_JS(idStr)}')">Отправить</button>
                   </div>`
                : `<div style="font-size:0.8rem; color:var(--ui-muted, #888); margin-top:4px;">Войдите в аккаунт, чтобы оставлять комментарии.</div>`;

            commentsHTML = `<div style="margin-top:8px;">${listHtml}${formHtml}</div>`;
        }

        box.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">
                <div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center;">${reactBtns}</div>
                <button data-custom-bg="1" class="btn-small" onclick="TOGGLE_UPDATE_COMMENTS_PANEL('${ESC_JS(idStr)}')"
                    style="padding:3px 9px; font-size:0.8rem; box-shadow:none; background:var(--ui-panel, #221f1c); color:var(--ui-accent, #d2b278); border:1px solid var(--ui-border, #3e372f);">
                    💬 Комментарии (${commentsList.length}) ${isOpen ? '▴' : '▾'}
                </button>
            </div>
            ${commentsHTML}
        `;

        if (hadFocus) {
            const nextInp = document.getElementById(`upd-cmt-inp-${idStr}`);
            if (nextInp) {
                nextInp.focus();
                nextInp.setSelectionRange(nextInp.value.length, nextInp.value.length);
            }
        }
    }

    let socialObserver = null;
    function REFRESH_OPEN_UPDATES_SOCIAL() {
        const modal = document.getElementById('site-updates-modal');
        const cont = document.getElementById('site-updates-content');
        if (!modal || !modal.classList.contains('active') || !cont) return;

        const updates = (typeof window.GET_SITE_UPDATES === 'function') ? window.GET_SITE_UPDATES() : [];
        if (!updates.length) return;

        const scrollWrap = cont.querySelector('div[style*="overflow-y:auto"]');
        if (!scrollWrap) return;

        const cards = Array.from(scrollWrap.children);
        if (socialObserver) socialObserver.disconnect();
        cards.forEach((card, idx) => {
            const u = updates[idx];
            if (u && u.id) RENDER_SOCIAL_FOR_CARD(card, u.id);
        });
        ATTACH_UPDATES_OBSERVER();
    }

    function ATTACH_UPDATES_OBSERVER() {
        const cont = document.getElementById('site-updates-content');
        if (!cont) return;
        if (!socialObserver) {
            socialObserver = new MutationObserver(() => {
                REFRESH_OPEN_UPDATES_SOCIAL();
            });
        }
        socialObserver.observe(cont, { childList: true });
    }

    // --- ХУКИ ---
    const _ORIG_OPEN_UPDATES = window.OPEN_SITE_UPDATES_MODAL;
    if (typeof _ORIG_OPEN_UPDATES === 'function') {
        window.OPEN_SITE_UPDATES_MODAL = function() {
            _ORIG_OPEN_UPDATES();
            ATTACH_UPDATES_OBSERVER();
            REFRESH_OPEN_UPDATES_SOCIAL();
        };
    }

    const _ORIG_GM_LEFT_SQ = window.RENDER_GM_LEFT_COLUMN;
    if (typeof _ORIG_GM_LEFT_SQ === 'function') {
        window.RENDER_GM_LEFT_COLUMN = function() {
            _ORIG_GM_LEFT_SQ();
            INJECT_GM_SECRET_QUESTS_BUTTON();
        };
    }

    const _ORIG_LDT_SQ = window.LDT;
    if (typeof _ORIG_LDT_SQ === 'function') {
        window.LDT = function() {
            _ORIG_LDT_SQ();
            RENDER_PLAYER_SECRET_QUESTS_BOX();
        };
    }

    if (typeof window.SWITCH_FIREBASE_ROOM === 'function') {
        const _ORIG_SW_SQ = window.SWITCH_FIREBASE_ROOM;
        window.SWITCH_FIREBASE_ROOM = function(rc) {
            const res = _ORIG_SW_SQ(rc);
            SYNC_SECRET_QUESTS_FOR_ROOM(rc);
            return res;
        };
    }

    const _ORIG_APPLY_SQ = window.APPLY_ROLE_VIEW;
    if (typeof _ORIG_APPLY_SQ === 'function') {
        window.APPLY_ROLE_VIEW = function() {
            _ORIG_APPLY_SQ();
            SYNC_SECRET_QUESTS_FOR_ROOM(CUR_ROOM());
            INJECT_GM_SECRET_QUESTS_BUTTON();
            RENDER_PLAYER_SECRET_QUESTS_BOX();
        };
    }

    SYNC_UPDATE_SOCIAL_FROM_CLOUD();
    SYNC_SECRET_QUESTS_FOR_ROOM(CUR_ROOM());
    INJECT_GM_SECRET_QUESTS_BUTTON();
    RENDER_PLAYER_SECRET_QUESTS_BOX();
})();