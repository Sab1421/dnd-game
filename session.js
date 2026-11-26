// ================================================================
// ⏱️ СЕССИИ, ТАЙМЕР, ПАУЗА, СТАТУСЫ ОНЛАЙН/АФК И ВДОХНОВЕНИЕ (session.js)
// Полная изоляция по комнатам • Синхронизация через Firebase
// ================================================================
(function INIT_SESSION_AND_INSPIRATION_MODULE() {
    const FB_ROOMS_URL = "https://dnds-23b7d-default-rtdb.firebaseio.com/campaign_v2/rooms";
    const MY_PRES_ID = 'p_' + Math.random().toString(36).slice(2, 8) + '_' + Date.now();

    const DEFAULT_SESS_STATE = () => ({
        status: 'idle',        // 'idle' | 'active' | 'paused'
        startedAt: null,
        accumulatedMs: 0,
        sessionNum: 1,
        pausedBy: '',
        pausePoll: null,       // { active, mode: 'pause'|'resume', initiatorIdx, initiatorName, votes: {} }
        afkHeroes: {},         // { [charIdx]: true }
        gmAfk: false,
        history: []            // [{ num, date, durationMs, summary, endedBy }]
    });

    window._roomSessionCache = {};   // { [roomCode]: state }
    window._roomPresenceCache = {};  // { [roomCode]: { [clientId]: { role, heroId, charIdx, name } } }
    window._roomPresenceLoaded = {}; // { [roomCode]: true }
    window._inspArmed = false;       // Заряжено ли Вдохновение на следующий бросок (Преимущество 2к20)

    let activeRoom = null;
    let activeSessRef = null;
    let activePresRef = null;
    let myPresRef = null;
    let timerInterval = null;

    function ESC(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function CUR_ROOM() {
        const s = (typeof GET_SESSION === 'function') ? GET_SESSION() : null;
        return (s && s.roomCode) ? String(s.roomCode) : null;
    }

    function GET_SESS_STATE(rc) {
        const code = String(rc || CUR_ROOM() || '');
        const raw = code && window._roomSessionCache[code];
        const st = Object.assign(DEFAULT_SESS_STATE(), raw || {});
        if (!st.afkHeroes || typeof st.afkHeroes !== 'object') st.afkHeroes = {};
        if (!Array.isArray(st.history)) st.history = [];
        return st;
    }

    function SAVE_SESS_STATE(st, rc) {
        const code = String(rc || CUR_ROOM() || '');
        if (!code) return;
        const clean = Object.assign(DEFAULT_SESS_STATE(), st || {});
        window._roomSessionCache[code] = clean;

        if (window.firebase && firebase.apps && firebase.apps.length) {
            firebase.database().ref(`campaign_v2/rooms/${code}/session_ctrl`).set(clean).catch(() => {});
        } else {
            fetch(`${FB_ROOMS_URL}/${encodeURIComponent(code)}/session_ctrl.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(clean)
            }).catch(() => {});
        }

        RENDER_SESSION_BAR();
        CHECK_AND_RENDER_PAUSE_POLL_POPUP();
        CHECK_AND_RENDER_REST_POPUP();
    }

    function FORMAT_DURATION(ms) {
        const sec = Math.max(0, Math.floor((ms || 0) / 1000));
        const h = Math.floor(sec / 3600);
        const m = Math.floor((sec % 3600) / 60);
        const s = sec % 60;
        const pad = (n) => String(n).padStart(2, '0');
        return `${pad(h)}:${pad(m)}:${pad(s)}`;
    }

    function GET_ELAPSED_MS(st) {
        if (!st) return 0;
        let ms = Number(st.accumulatedMs) || 0;
        if (st.status === 'active' && st.startedAt) {
            ms += Math.max(0, Date.now() - Number(st.startedAt));
        }
        return ms;
    }

    function GET_TOTAL_CAMPAIGN_MS(st) {
        if (!st) return 0;
        const pastMs = (st.history || []).reduce((sum, h) => sum + (Number(h && h.durationMs) || 0), 0);
        return pastMs + GET_ELAPSED_MS(st);
    }

    function FORMAT_HUMAN_DURATION(ms) {
        const totalMin = Math.floor(Math.max(0, ms || 0) / 60000);
        const h = Math.floor(totalMin / 60);
        const m = totalMin % 60;
        if (h === 0) return `${m} мин`;
        return `${h} ч ${m} мин`;
    }

    // ================================================================
    // 1. ПРИСУТСТВИЕ (ОНЛАЙН / ОФФЛАЙН / АФК) И АКТИВНЫЙ СОСТАВ ОТРЯДА
    // ================================================================
    function IS_GM_ONLINE(rc) {
        const code = String(rc || CUR_ROOM() || '');
        const pres = window._roomPresenceCache[code] || {};
        return Object.values(pres).some(p => p && p.role === 'gm');
    }

    window.GET_HERO_STATUS_INFO = function(charIdx, rc) {
        const code = String(rc || CUR_ROOM() || '');
        const cs = GC();
        const c = cs[charIdx];
        const st = GET_SESS_STATE(code);
        const isManualAfk = !!(st.afkHeroes && st.afkHeroes[charIdx]);

        if (isManualAfk) {
            return { state: 'afk', icon: '🟠', label: 'Отошёл (Офф)', color: '#d99a4e', interactive: false };
        }

        const pres = window._roomPresenceCache[code] || {};
        const presLoaded = !!window._roomPresenceLoaded[code];
        const sess = GET_SESSION();
        const isMeRightNow = !!(sess && sess.role === 'player' && String(sess.roomCode) === code && charIdx === PI);
        const isOnline = isMeRightNow || Object.values(pres).some(p =>
            p && p.role === 'player' && ((c && c.id && p.heroId === c.id) || p.charIdx === charIdx)
        );

        // Реальный персонаж (привязан к аккаунту) с закрытой вкладкой -> Не в сети
        const isRealOwnedHero = !!(c && (c.owner || c.ownerId));
        if (presLoaded && isRealOwnedHero && !isOnline) {
            return { state: 'offline', icon: '⚫', label: 'Не в сети', color: '#8a8680', interactive: false };
        }

        if (isOnline) {
            return { state: 'online', icon: '🟢', label: 'В сети', color: '#6cb878', interactive: true };
        }

        // Тестовый союзник (без аккаунта) — считается активным, пока не нажат Офф
        return { state: 'npc_ally', icon: '🟢', label: 'В игре', color: '#6cb878', interactive: true };
    };

    window.IS_HERO_INACTIVE_IN_ROOM = function(charIdx, rc) {
        const info = window.GET_HERO_STATUS_INFO(charIdx, rc);
        return !info.interactive;
    };

    window.GET_ACTIVE_PARTY_INDICES = function(rc) {
        const code = String(rc || CUR_ROOM() || '');
        const all = (typeof GET_ROOM_PARTY_INDICES === 'function')
            ? GET_ROOM_PARTY_INDICES(code)
            : GC().map((_, i) => i);
        return all.filter(idx => !window.IS_HERO_INACTIVE_IN_ROOM(idx, code));
    };

    window.IS_ROOM_PAUSED = function(rc) {
        const st = GET_SESS_STATE(rc);
        return st.status === 'paused';
    };

    // Регистрация текущего пользователя в списке присутствия комнаты
    function PUBLISH_MY_ROOM_PRESENCE(rc) {
        const sess = GET_SESSION();
        if (!rc || !sess || !window.firebase || !firebase.apps || !firebase.apps.length) return;
        const cs = GC();
        const c = cs[PI];
        const payload = {
            role: sess.role,
            heroId: (sess.role === 'player' && c && c.id) ? c.id : (sess.heroId || ''),
            charIdx: (sess.role === 'player') ? PI : -1,
            name: (sess.role === 'gm') ? GET_GM_NAME() : (c?.name || 'Игрок'),
            ts: firebase.database.ServerValue.TIMESTAMP
        };

        const ref = firebase.database().ref(`campaign_v2/rooms/${rc}/room_presence/${MY_PRES_ID}`);
        myPresRef = ref;
        ref.onDisconnect().remove().then(() => {
            ref.set(payload).catch(() => {});
        }).catch(() => {
            ref.set(payload).catch(() => {});
        });
    }

    function REMOVE_MY_ROOM_PRESENCE() {
        if (myPresRef) {
            myPresRef.remove().catch(() => {});
            myPresRef = null;
        }
    }

    function SYNC_SESSION_FOR_ROOM(roomCode) {
        const nextRc = roomCode ? String(roomCode) : null;
        if (nextRc === activeRoom && (nextRc === null || activeSessRef)) {
            if (nextRc) PUBLISH_MY_ROOM_PRESENCE(nextRc);
            return;
        }

        REMOVE_MY_ROOM_PRESENCE();
        if (activeSessRef) { activeSessRef.off(); activeSessRef = null; }
        if (activePresRef) { activePresRef.off(); activePresRef = null; }

        activeRoom = nextRc;
        window._inspArmed = false;

        const pausePop = document.getElementById('party-pause-vote-popup');
        if (pausePop) pausePop.remove();

        if (!nextRc) {
            RENDER_SESSION_BAR();
            return;
        }

        // Быстрая начальная загрузка REST
        fetch(`${FB_ROOMS_URL}/${encodeURIComponent(nextRc)}/session_ctrl.json`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (activeRoom !== nextRc) return;
                window._roomSessionCache[nextRc] = Object.assign(DEFAULT_SESS_STATE(), data || {});
                RENDER_SESSION_BAR();
                CHECK_AND_RENDER_PAUSE_POLL_POPUP();
                RPL();
            })
            .catch(() => {});

        const attachSdk = () => {
            if (activeRoom !== nextRc) return true;
            if (window.firebase && firebase.apps && firebase.apps.length) {
                const roomRef = firebase.database().ref(`campaign_v2/rooms/${nextRc}`);
                activeSessRef = roomRef.child('session_ctrl');
                activePresRef = roomRef.child('room_presence');

                activeSessRef.on('value', (snap) => {
                    if (activeRoom !== nextRc) return;
                    window._roomSessionCache[nextRc] = Object.assign(DEFAULT_SESS_STATE(), snap.val() || {});
                    RENDER_SESSION_BAR();
                    CHECK_AND_RENDER_PAUSE_POLL_POPUP();
                    CHECK_PAUSE_POLL_RESOLUTION();
                    CHECK_AND_RENDER_REST_POPUP();
                    RPL();
                    RMC();
                    RENDER_MAP_AREA();
                });

                activePresRef.on('value', (snap) => {
                    if (activeRoom !== nextRc) return;
                    window._roomPresenceCache[nextRc] = snap.val() || {};
                    window._roomPresenceLoaded[nextRc] = true;
                    RENDER_SESSION_BAR();
                    CHECK_PAUSE_POLL_RESOLUTION();
                    if (typeof CHECK_POLL_RESOLUTION === 'function') CHECK_POLL_RESOLUTION();
                    CHECK_AND_RENDER_PAUSE_POLL_POPUP();
                    CHECK_AND_RENDER_REST_POPUP();
                    RPL();
                });

                PUBLISH_MY_ROOM_PRESENCE(nextRc);
                return true;
            }
            return false;
        };

        if (!attachSdk()) {
            const t = setInterval(() => { if (attachSdk()) clearInterval(t); }, 600);
            setTimeout(() => clearInterval(t), 20000);
        }
    }

    // ================================================================
    // 2. УПРАВЛЕНИЕ СЕССИЕЙ, ПАУЗОЙ, АФК И ХРОНИКОЙ
    // ================================================================
    window.GM_START_SESSION = function() {
        const sess = GET_SESSION();
        if (!sess || sess.role !== 'gm') return;
        const st = GET_SESS_STATE();
        if (st.status === 'active') return;
        st.status = 'active';
        st.startedAt = Date.now();
        st.accumulatedMs = 0;
        st.pausedBy = '';
        st.pausePoll = null;
        SAVE_SESS_STATE(st);
        LOG_COMBAT_TO_CHAT(`▶️ Сессия #${st.sessionNum || 1} началась! Таймер запущен.`);
        RENDER_MAP_AREA();
    };

    window.GM_TOGGLE_PAUSE = function() {
        const sess = GET_SESSION();
        if (!sess || sess.role !== 'gm') return;
        const st = GET_SESS_STATE();
        if (st.status === 'idle') {
            window.GM_START_SESSION();
            return;
        }
        if (st.status === 'active') {
            st.accumulatedMs = GET_ELAPSED_MS(st);
            st.startedAt = null;
            st.status = 'paused';
            st.pausedBy = `👑 ${GET_GM_NAME()}`;
            st.pausePoll = null;
            SAVE_SESS_STATE(st);
            LOG_COMBAT_TO_CHAT(`⏸️ Гейм-Мастер поставил игру на ПАУЗУ (прошло ${FORMAT_DURATION(st.accumulatedMs)}).`);
        } else if (st.status === 'paused') {
            st.status = 'active';
            st.startedAt = Date.now();
            st.pausedBy = '';
            st.pausePoll = null;
            SAVE_SESS_STATE(st);
            LOG_COMBAT_TO_CHAT(`▶️ Гейм-Мастер снял паузу — игра продолжается!`);
        }
        RENDER_MAP_AREA();
    };

    window.OPEN_END_SESSION_MODAL = function() {
        const sess = GET_SESSION();
        if (!sess || sess.role !== 'gm') return;
        const st = GET_SESS_STATE();
        const elapsed = GET_ELAPSED_MS(st);
        const cont = document.getElementById('gm-tool-modal-content');
        if (!cont) return;
        cont.style.maxWidth = '560px';

        cont.innerHTML = `
            <h2>⏹️ Завершить сессию #${st.sessionNum || 1} на сегодня</h2>
            <div style="background:var(--ui-panel2, #181715); border:1px solid var(--ui-border, #423c33); border-radius:10px; padding:14px; margin-bottom:14px; text-align:left;">
                <div style="margin-bottom:6px;">⏱️ Длительность этой сессии: <b style="color:var(--ui-accent, #e6c88c);">${FORMAT_DURATION(elapsed)}</b></div>
                <div style="margin-bottom:10px; color:var(--ui-muted, #aaa); font-size:0.88rem;">⏳ Общее время кампании: <b style="color:var(--ui-text, #ebe8e2);">${FORMAT_DURATION(GET_TOTAL_CAMPAIGN_MS(st))}</b> (${FORMAT_HUMAN_DURATION(GET_TOTAL_CAMPAIGN_MS(st))})</div>
                <label style="color:var(--ui-accent, #c9a96e); font-size:0.9rem; font-weight:bold;">📖 На чём остановились (заметка в Хронику):</label>
                <textarea id="end-session-summary-inp" style="min-height:95px; margin-top:6px;" placeholder="Например: отряд победил разведчиков в чаще и остановился на привал у старой башни..."></textarea>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:8px;">
                <button class="btn-save" onclick="CONFIRM_END_SESSION()">💾 Завершить и сохранить в Хронику</button>
                <button onclick="CM('gm-tool-modal')">Отмена</button>
            </div>
        `;
        OM('gm-tool-modal');
    };

    window.CONFIRM_END_SESSION = function() {
        const sess = GET_SESSION();
        if (!sess || sess.role !== 'gm') return;
        const st = GET_SESS_STATE();
        const elapsed = GET_ELAPSED_MS(st);
        const summary = (document.getElementById('end-session-summary-inp')?.value || '').trim();
        const num = st.sessionNum || 1;

        st.history.unshift({
            num,
            date: new Date().toLocaleDateString('ru-RU'),
            durationMs: elapsed,
            summary: summary || 'Заметка не добавлена.',
            endedBy: GET_GM_NAME()
        });
        if (st.history.length > 25) st.history = st.history.slice(0, 25);

        st.status = 'idle';
        st.startedAt = null;
        st.accumulatedMs = 0;
        st.pausedBy = '';
        st.pausePoll = null;
        st.sessionNum = num + 1;
        SAVE_SESS_STATE(st);

        CM('gm-tool-modal');
        LOG_COMBAT_TO_CHAT(`⏹️ Сессия #${num} завершена! Длительность: ${FORMAT_DURATION(elapsed)}.${summary ? ' Итог: ' + summary : ''} До следующей встречи!`);
        RENDER_MAP_AREA();
    };

    window.OPEN_SESSION_HISTORY_MODAL = function() {
        const st = GET_SESS_STATE();
        const cont = document.getElementById('gm-tool-modal-content');
        if (!cont) return;
        cont.style.maxWidth = '660px';

        const hist = st.history || [];
        const totalMs = GET_TOTAL_CAMPAIGN_MS(st);
        const avgMs = hist.length
            ? Math.round(hist.reduce((s, h) => s + (Number(h && h.durationMs) || 0), 0) / hist.length)
            : 0;

        const cards = hist.map(h => `
            <div style="background:var(--ui-panel2, #181715); border:1px solid var(--ui-border, #3d3830); border-radius:9px; padding:12px 14px; margin-bottom:10px; text-align:left;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:6px; flex-wrap:wrap;">
                    <b style="color:var(--ui-accent, #e6c88c);">📖 Сессия #${h.num}</b>
                    <small style="color:var(--ui-muted, #9e988e);">📅 ${ESC(h.date)} • ⏱️ ${FORMAT_DURATION(h.durationMs)}</small>
                </div>
                <div style="font-size:0.93rem; line-height:1.45; white-space:pre-wrap;">${ESC(h.summary)}</div>
            </div>
        `).join('');

        cont.innerHTML = `
            <h2>📜 Хроника встреч комнаты #${CUR_ROOM() || '—'}</h2>
            <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:8px; margin-bottom:14px;">
                <div style="background:var(--ui-panel2, #181715); border:1px solid var(--ui-border, #3d3830); border-radius:8px; padding:10px; text-align:center;">
                    <div style="font-size:0.78rem; color:var(--ui-muted, #aaa);">⏳ Всего в кампании</div>
                    <div style="font-weight:bold; font-size:1.05rem; color:var(--ui-accent, #e6c88c); margin-top:2px;">${FORMAT_HUMAN_DURATION(totalMs)}</div>
                    <div style="font-size:0.75rem; font-family:monospace; color:var(--ui-muted, #888);">${FORMAT_DURATION(totalMs)}</div>
                </div>
                <div style="background:var(--ui-panel2, #181715); border:1px solid var(--ui-border, #3d3830); border-radius:8px; padding:10px; text-align:center;">
                    <div style="font-size:0.78rem; color:var(--ui-muted, #aaa);">📖 Завершено сессий</div>
                    <div style="font-weight:bold; font-size:1.15rem; color:var(--ui-text, #ebe8e2); margin-top:4px;">${hist.length}</div>
                </div>
                <div style="background:var(--ui-panel2, #181715); border:1px solid var(--ui-border, #3d3830); border-radius:8px; padding:10px; text-align:center;">
                    <div style="font-size:0.78rem; color:var(--ui-muted, #aaa);">📊 Средняя встреча</div>
                    <div style="font-weight:bold; font-size:1.05rem; color:var(--ui-text, #ebe8e2); margin-top:4px;">${hist.length ? FORMAT_HUMAN_DURATION(avgMs) : '—'}</div>
                </div>
            </div>
            <div style="max-height:50vh; overflow-y:auto; padding-right:4px;">
                ${cards || '<div style="padding:26px; text-align:center; color:var(--ui-muted, #888);">Завершённых сессий пока нет. Когда Мастер нажмёт «Завершить на сегодня», запись появится здесь.</div>'}
            </div>
            <div style="margin-top:14px; text-align:right;"><button onclick="CM('gm-tool-modal')">Закрыть</button></div>
        `;
        OM('gm-tool-modal');
    };

    // Переключение АФК / Офф для Игрока (сам за себя) или Мастера (за себя / за игрока)
    window.TOGGLE_MY_AFK_STATUS = function() {
        const sess = GET_SESSION();
        if (!sess) return;
        const st = GET_SESS_STATE();

        if (sess.role === 'gm') {
            st.gmAfk = !st.gmAfk;
            SAVE_SESS_STATE(st);
            LOG_COMBAT_TO_CHAT(st.gmAfk ? `🟠 Гейм-Мастер временно отошёл (АФК).` : `🟢 Гейм-Мастер вернулся за стол!`);
            return;
        }

        const isNowAfk = !st.afkHeroes[PI];
        if (isNowAfk) st.afkHeroes[PI] = true;
        else delete st.afkHeroes[PI];

        // Если игрок ушёл в офф во время своего хода — передаём ход дальше
        const mapSt = GET_MAP_STATE();
        if (isNowAfk && mapSt.turnOrder && mapSt.turnOrder.active && mapSt.tokens && mapSt.tokens.length) {
            const cur = mapSt.tokens[(mapSt.turnOrder.currentIdx || 0) % mapSt.tokens.length];
            if (cur && cur.isPlayer && cur.charIdx === PI) {
                SAVE_SESS_STATE(st);
                GM_NEXT_TURN();
            } else {
                SAVE_SESS_STATE(st);
            }
        } else {
            SAVE_SESS_STATE(st);
        }

        LOG_COMBAT_TO_CHAT(isNowAfk
            ? `🟠 переходит в статус «Отошёл / Офф» (персонаж временно вне игры и голосований).`
            : `🟢 возвращается в игру!`);

        CHECK_PAUSE_POLL_RESOLUTION();
        if (typeof CHECK_POLL_RESOLUTION === 'function') CHECK_POLL_RESOLUTION();
        RPL();
        RMC();
        RENDER_MAP_AREA();
    };

    window.GM_TOGGLE_PLAYER_AFK = function(charIdx) {
        const sess = GET_SESSION();
        if (!sess || sess.role !== 'gm') return;
        const st = GET_SESS_STATE();
        const cs = GC();
        const name = cs[charIdx]?.name || 'Игрок';
        const isNowAfk = !st.afkHeroes[charIdx];
        if (isNowAfk) st.afkHeroes[charIdx] = true;
        else delete st.afkHeroes[charIdx];
        SAVE_SESS_STATE(st);

        LOG_COMBAT_TO_CHAT(isNowAfk
            ? `🟠 Мастер перевёл «${name}» в статус «Офф / АФК» (вне игры и голосований).`
            : `🟢 Мастер вернул «${name}» в активный состав.`);

        CHECK_PAUSE_POLL_RESOLUTION();
        if (typeof CHECK_POLL_RESOLUTION === 'function') CHECK_POLL_RESOLUTION();
        RPL();
        RENDER_MAP_AREA();
    };

    // --- ГОЛОСОВАНИЕ ИГРОКОВ ЗА ПАУЗУ / ПРОДОЛЖЕНИЕ ---
    window.PLAYER_REQUEST_PAUSE_TOGGLE = function() {
        const sess = GET_SESSION();
        if (!sess || sess.role !== 'player') return;
        if (window.IS_HERO_INACTIVE_IN_ROOM(PI)) {
            showMessage('🟠 Вы в статусе Офф', 'Сначала нажмите «🟢 Вернуться», чтобы участвовать в голосовании.');
            return;
        }
        const st = GET_SESS_STATE();
        if (st.status === 'idle') {
            showMessage('⏱️ Сессия ещё не начата', 'Дождитесь, пока Гейм-Мастер запустит сессию.');
            return;
        }
        if (st.pausePoll && st.pausePoll.active) {
            CHECK_AND_RENDER_PAUSE_POLL_POPUP();
            return;
        }

        const activeIds = window.GET_ACTIVE_PARTY_INDICES();
        const mode = (st.status === 'active') ? 'pause' : 'resume';
        const cs = GC();
        const myName = cs[PI]?.name || 'Игрок';

        if (activeIds.length <= 1) {
            if (mode === 'pause') {
                st.accumulatedMs = GET_ELAPSED_MS(st);
                st.startedAt = null;
                st.status = 'paused';
                st.pausedBy = myName;
                LOG_COMBAT_TO_CHAT(`⏸️ ставит игру на паузу.`);
            } else {
                st.status = 'active';
                st.startedAt = Date.now();
                st.pausedBy = '';
                LOG_COMBAT_TO_CHAT(`▶️ снимает паузу — игра продолжается!`);
            }
            st.pausePoll = null;
            SAVE_SESS_STATE(st);
            RENDER_MAP_AREA();
            return;
        }

        const needed = Math.floor(activeIds.length / 2) + 1;
        st.pausePoll = {
            active: true,
            mode,
            initiatorIdx: PI,
            initiatorName: myName,
            votes: { [PI]: 'yes' },
            ts: Date.now()
        };
        SAVE_SESS_STATE(st);
        LOG_COMBAT_TO_CHAT(mode === 'pause'
            ? `⏸️ предлагает поставить игру на паузу! Голосование: ЗА 1/${activeIds.length} (нужно ${needed}).`
            : `▶️ предлагает снять паузу и продолжить! Голосование: ЗА 1/${activeIds.length} (нужно ${needed}).`);
        CHECK_PAUSE_POLL_RESOLUTION();
    };

    window.CAST_PAUSE_POLL_VOTE = function(voteVal) {
        const st = GET_SESS_STATE();
        if (!st.pausePoll || !st.pausePoll.active) return;
        st.pausePoll.votes[PI] = voteVal;
        SAVE_SESS_STATE(st);
        const activeIds = window.GET_ACTIVE_PARTY_INDICES();
        const yes = activeIds.filter(i => st.pausePoll.votes[i] === 'yes').length;
        LOG_COMBAT_TO_CHAT(`${voteVal === 'yes' ? '✅ голосует ЗА' : '❌ голосует ПРОТИВ'} ${st.pausePoll.mode === 'pause' ? 'паузы' : 'продолжения'} (${yes}/${activeIds.length})`);
        CHECK_PAUSE_POLL_RESOLUTION();
    };

    window.CANCEL_PAUSE_POLL = function() {
        const st = GET_SESS_STATE();
        if (!st.pausePoll) return;
        st.pausePoll = null;
        SAVE_SESS_STATE(st);
        LOG_COMBAT_TO_CHAT(`↩️ Голосование за паузу отменено.`);
    };

    function CHECK_PAUSE_POLL_RESOLUTION() {
        const st = GET_SESS_STATE();
        if (!st.pausePoll || !st.pausePoll.active) return;

        const activeIds = window.GET_ACTIVE_PARTY_INDICES();
        const total = Math.max(1, activeIds.length);
        const needed = Math.floor(total / 2) + 1;
        let yes = 0, no = 0, voted = 0;

        activeIds.forEach(i => {
            const v = st.pausePoll.votes && st.pausePoll.votes[i];
            if (v === 'yes') { yes++; voted++; }
            else if (v === 'no') { no++; voted++; }
        });

        if (yes >= needed) {
            const mode = st.pausePoll.mode;
            if (mode === 'pause') {
                st.accumulatedMs = GET_ELAPSED_MS(st);
                st.startedAt = null;
                st.status = 'paused';
                st.pausedBy = `голосование отряда (${st.pausePoll.initiatorName})`;
                LOG_COMBAT_TO_CHAT(`⏸️ Отряд проголосовал за ПАУЗУ (${yes}/${total}). Таймер остановлен.`);
            } else {
                st.status = 'active';
                st.startedAt = Date.now();
                st.pausedBy = '';
                LOG_COMBAT_TO_CHAT(`▶️ Отряд проголосовал за ПРОДОЛЖЕНИЕ (${yes}/${total}). Таймер снова идёт!`);
            }
            st.pausePoll = null;
            SAVE_SESS_STATE(st);
            RENDER_MAP_AREA();
        } else if (yes + (total - voted) < needed) {
            const mode = st.pausePoll.mode;
            st.pausePoll = null;
            SAVE_SESS_STATE(st);
            LOG_COMBAT_TO_CHAT(`🚫 Голосование за ${mode === 'pause' ? 'паузу' : 'продолжение'} отклонено (ЗА: ${yes}, ПРОТИВ: ${no}).`);
        }
    }

    function CHECK_AND_RENDER_PAUSE_POLL_POPUP() {
        let popup = document.getElementById('party-pause-vote-popup');
        const sess = GET_SESSION();
        const st = GET_SESS_STATE();
        const poll = st.pausePoll;

        if (!sess || sess.role !== 'player' || !poll || !poll.active || window.IS_HERO_INACTIVE_IN_ROOM(PI)) {
            if (popup) popup.remove();
            return;
        }

        const activeIds = window.GET_ACTIVE_PARTY_INDICES();
        const total = Math.max(1, activeIds.length);
        const needed = Math.floor(total / 2) + 1;
        const yes = activeIds.filter(i => poll.votes && poll.votes[i] === 'yes').length;
        const myVote = poll.votes && poll.votes[PI];
        const title = poll.mode === 'pause' ? '⏸️ Голосование за паузу' : '▶️ Голосование за продолжение';

        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'party-pause-vote-popup';
            popup.style.cssText = 'position:fixed; top:20px; left:50%; transform:translateX(-50%); width:410px; max-width:94vw; background:var(--ui-panel, #1e1c1a); border:2px solid var(--ui-accent, #c9a96e); border-radius:12px; padding:14px 18px; box-shadow:0 12px 34px rgba(0,0,0,0.88); z-index:94200; color:var(--ui-text, #ebe8e2); text-align:center;';
            document.body.appendChild(popup);
        }

        if (!myVote) {
            popup.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                    <b style="color:var(--ui-accent, #e6c88c);">${title}</b>
                    <small style="color:var(--ui-muted, #aaa);">ЗА: ${yes}/${total} (нужно ${needed})</small>
                </div>
                <p style="font-size:0.88rem; margin-bottom:10px; color:var(--ui-text, #ddd);">
                    <b>${ESC(poll.initiatorName)}</b> предлагает ${poll.mode === 'pause' ? 'поставить игру на паузу' : 'снять паузу и продолжить'}.
                </p>
                <div style="display:flex; gap:8px;">
                    <button class="btn-save" style="flex:1; padding:8px;" onclick="CAST_PAUSE_POLL_VOTE('yes')">✅ За</button>
                    <button class="btn-danger" style="flex:1; padding:8px;" onclick="CAST_PAUSE_POLL_VOTE('no')">❌ Против</button>
                </div>
            `;
        } else {
            popup.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
                    <div style="text-align:left;">
                        <b style="color:var(--ui-accent, #e6c88c); font-size:0.9rem;">${title} (${yes}/${total})</b><br>
                        <small style="color:var(--ui-muted, #aaa);">Ваш голос: ${myVote === 'yes' ? '✅ За' : '❌ Против'} (нужно ${needed})</small>
                    </div>
                    ${poll.initiatorIdx === PI ? `<button class="btn-small btn-danger" onclick="CANCEL_PAUSE_POLL()">Отменить</button>` : ''}
                </div>
            `;
        }
    }

    // --- ПАНЕЛЬ СЕССИИ ПОД ШАПКОЙ КОМНАТЫ ---
    function RENDER_SESSION_BAR() {
        const topBar = document.getElementById('role-status-bar');
        const sess = GET_SESSION();
        let bar = document.getElementById('room-session-bar');

        if (!sess || !sess.roomCode || !topBar || topBar.style.display === 'none') {
            if (bar) bar.style.display = 'none';
            return;
        }

        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'room-session-bar';
            bar.style.cssText = 'max-width:1780px; margin:-6px auto 12px auto; display:flex; justify-content:space-between; align-items:center; background:var(--ui-panel2, #151413); border:1px solid var(--ui-border, #3e3830); padding:7px 14px; border-radius:10px; flex-wrap:wrap; gap:8px; font-size:0.86rem;';
            topBar.after(bar);
        }
        bar.style.display = 'flex';

        const st = GET_SESS_STATE();
        const isGM = (sess.role === 'gm');
        const elapsedStr = FORMAT_DURATION(GET_ELAPSED_MS(st));
        const totalCampaignStr = FORMAT_DURATION(GET_TOTAL_CAMPAIGN_MS(st));

        let statusBadge = '';
        if (st.status === 'active') {
            statusBadge = `<span style="color:#6cb878; font-weight:bold;">🟢 Сессия #${st.sessionNum || 1} идёт</span>`;
        } else if (st.status === 'paused') {
            statusBadge = `<span style="color:#d99a4e; font-weight:bold;">⏸️ ПАУЗА</span> <small style="color:var(--ui-muted, #aaa);">(${ESC(st.pausedBy || 'отряд')})</small>`;
        } else {
            statusBadge = `<span style="color:var(--ui-muted, #aaa);">⚪ Сессия #${st.sessionNum || 1} не начата</span>`;
        }

        let gmStatusHTML = '';
        if (!isGM) {
            const gmOn = IS_GM_ONLINE();
            gmStatusHTML = st.gmAfk
                ? `<span style="color:#d99a4e; margin-left:6px;">• 👑 Мастер: 🟠 отошёл</span>`
                : (gmOn
                    ? `<span style="color:#6cb878; margin-left:6px;">• 👑 Мастер: 🟢 в сети</span>`
                    : `<span style="color:var(--ui-muted, #888); margin-left:6px;">• 👑 Мастер: ⚫ не в сети</span>`);
        }

        let controlsHTML = '';
        if (isGM) {
            const startPauseBtns = st.status === 'idle'
                ? `<button class="btn-small btn-save" onclick="GM_START_SESSION()">▶️ Начать сессию</button>`
                : (st.status === 'active'
                    ? `<button class="btn-small btn-warn" onclick="GM_TOGGLE_PAUSE()">⏸️ Пауза</button>
                       <button class="btn-small btn-danger" onclick="OPEN_END_SESSION_MODAL()">⏹️ Завершить на сегодня</button>`
                    : `<button class="btn-small btn-save" onclick="GM_TOGGLE_PAUSE()">▶️ Продолжить</button>
                       <button class="btn-small btn-danger" onclick="OPEN_END_SESSION_MODAL()">⏹️ Завершить на сегодня</button>`);

            const gmAfkBtn = st.gmAfk
                ? `<button class="btn-small btn-save" onclick="TOGGLE_MY_AFK_STATUS()">🟢 Я на месте</button>`
                : `<button class="btn-small" onclick="TOGGLE_MY_AFK_STATUS()">🟠 Отошёл</button>`;

            controlsHTML = `${startPauseBtns} ${gmAfkBtn} <button class="btn-small" onclick="OPEN_SESSION_HISTORY_MODAL()">📜 Хроника (${st.history.length})</button>`;
        } else {
            const isMyAfk = !!(st.afkHeroes && st.afkHeroes[PI]);
            const pauseBtn = (st.status !== 'idle')
                ? `<button class="btn-small ${st.status === 'paused' ? 'btn-save' : 'btn-warn'}" onclick="PLAYER_REQUEST_PAUSE_TOGGLE()">${st.status === 'paused' ? '▶️ Голосовать: продолжить' : '⏸️ Пауза (голосование)'}</button>`
                : '';
            const afkBtn = isMyAfk
                ? `<button class="btn-small btn-save" onclick="TOGGLE_MY_AFK_STATUS()">🟢 Вернуться в игру</button>`
                : `<button class="btn-small" title="Пометить персонажа неактивным (вас не будут ждать в голосованиях и бою)" onclick="TOGGLE_MY_AFK_STATUS()">🟠 Отошёл (Офф)</button>`;
            controlsHTML = `${pauseBtn} ${afkBtn} <button class="btn-small" onclick="OPEN_SESSION_HISTORY_MODAL()">📜 Хроника (${st.history.length})</button>`;
        }

        bar.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
                ${statusBadge}
                <span title="Время текущей сессии" style="background:var(--ui-panel, #1e1c1a); border:1px solid var(--ui-border, #3e3830); padding:2px 9px; border-radius:6px; font-family:monospace; font-weight:bold; color:var(--ui-accent, #e6c88c);">
                    ⏱️ Сессия: <span id="session-timer-clock">${elapsedStr}</span>
                </span>
                <span title="Общее время кампании за все сессии" style="background:var(--ui-panel, #1e1c1a); border:1px solid var(--ui-border, #3e3830); padding:2px 9px; border-radius:6px; font-family:monospace; color:var(--ui-muted, #aaa);">
                    ⏳ Всего: <span id="campaign-total-clock">${totalCampaignStr}</span>
                </span>
                ${gmStatusHTML}
            </div>
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                ${controlsHTML}
            </div>
        `;
    }

    // Локальное тиканье таймера сессии и общего времени кампании (0 запросов к Firebase)
    if (!timerInterval) {
        timerInterval = setInterval(() => {
            if (!CUR_ROOM()) return;
            const st = GET_SESS_STATE();
            const sessEl = document.getElementById('session-timer-clock');
            const totEl = document.getElementById('campaign-total-clock');
            if (sessEl) sessEl.textContent = FORMAT_DURATION(GET_ELAPSED_MS(st));
            if (totEl) totEl.textContent = FORMAT_DURATION(GET_TOTAL_CAMPAIGN_MS(st));
        }, 1000);
    }

    // ================================================================
    // 3. МЕХАНИКА ВДОХНОВЕНИЯ (ВЫДАЧА ГМ + ПРЕИМУЩЕСТВО 2к20 У ИГРОКА)
    // ================================================================
    window.GET_INSPIRATION_COUNT = function(c) {
        if (!c || c.inspiration === undefined || c.inspiration === null || c.inspiration === '') return 0;
        if (typeof c.inspiration === 'number') return Math.max(0, Math.floor(c.inspiration));
        const s = String(c.inspiration).trim();
        const num = parseInt(s, 10);
        if (!isNaN(num)) return Math.max(0, num);
        return /^(да|есть|yes|true|★|⭐)$/i.test(s) ? 1 : 0;
    };

    window.GM_CHANGE_INSPIRATION = function(charIdx, delta) {
        const sess = GET_SESSION();
        if (!sess || sess.role !== 'gm') return;
        const rc = CUR_ROOM();
        const cs = GC();
        if (!cs[charIdx]) return;

        let newVal = 0;
        const heroName = cs[charIdx].name || 'Герой';
        const updater = (ch) => {
            const cur = window.GET_INSPIRATION_COUNT(ch);
            newVal = Math.max(0, Math.min(5, cur + delta));
            ch.inspiration = newVal;
        };
        if (typeof MUTATE_HERO_IN_ROOM === 'function') MUTATE_HERO_IN_ROOM(cs[charIdx], rc, updater);
        else updater(cs[charIdx]);

        SC(cs);
        RPL();

        if (delta > 0) {
            LOG_COMBAT_TO_CHAT(`⭐ Гейм-Мастер дарует Вдохновение герою «${heroName}»! (Всего: ${newVal})`);
            const evObj = {
                id: Date.now(),
                target: String(charIdx),
                title: '⭐ Получено Вдохновение!',
                text: `Гейм-Мастер наградил вас <b>Вдохновением</b> за отличный отыгрыш или ход!<br><br>Вы можете потратить его, чтобы совершить <b>любую атаку, проверку навыка или спасбросок с Преимуществом (2к20)</b>.`
            };
            localStorage.setItem('dnd_gm_event', JSON.stringify(evObj));
        } else {
            LOG_COMBAT_TO_CHAT(`⭐ Гейм-Мастер снял 1 Вдохновение у «${heroName}» (осталось: ${newVal}).`);
        }
    };

    function CONSUME_MY_INSPIRATION() {
        const cs = GC();
        const c = cs[PI];
        if (!c) return false;
        const cur = window.GET_INSPIRATION_COUNT(c);
        if (cur <= 0) {
            window._inspArmed = false;
            return false;
        }
        c.inspiration = cur - 1;
        window._inspArmed = false;
        SC(cs);
        RMC();
        return true;
    }

    window.TOGGLE_ARM_INSPIRATION = function() {
        const cs = GC();
        const c = cs[PI];
        if (!c || window.GET_INSPIRATION_COUNT(c) <= 0) {
            window._inspArmed = false;
            return;
        }
        window._inspArmed = !window._inspArmed;
        RMC();
        if (typeof RENDER_BG3_COMBAT_HUD === 'function') RENDER_BG3_COMBAT_HUD();
        if (typeof CHECK_AND_RENDER_SKILL_ROLL_POPUP === 'function') CHECK_AND_RENDER_SKILL_ROLL_POPUP();
    };

    window.OPEN_INSPIRATION_MODAL = function() {
        const cs = GC();
        const c = cs[PI];
        const cnt = window.GET_INSPIRATION_COUNT(c);
        if (!c || cnt <= 0) return;

        const cont = document.getElementById('gm-tool-modal-content');
        if (!cont) return;
        cont.style.maxWidth = '500px';
        cont.innerHTML = `
            <h2>⭐ Вдохновение (${cnt})</h2>
            <p style="color:var(--ui-muted, #aaa); font-size:0.92rem; margin-bottom:14px; line-height:1.45;">
                Вдохновение позволяет бросить <b>2к20 и выбрать лучший результат</b> (Преимущество) для атаки, проверки навыка, концентрации или спасброска от смерти.
            </p>
            <div style="display:flex; flex-direction:column; gap:8px;">
                <button class="btn-save" style="padding:11px;" onclick="window._inspArmed=true; CM('gm-tool-modal'); RMC(); if(typeof RENDER_BG3_COMBAT_HUD==='function') RENDER_BG3_COMBAT_HUD();">
                    🎯 Зарядить Преимущество на следующий бросок
                </button>
                <button class="btn-cast" style="padding:11px;" onclick="SPEND_INSPIRATION_FREE_ROLL()">
                    🎲 Бросить 2к20 с Преимуществом прямо сейчас
                </button>
                <button onclick="CM('gm-tool-modal')">Отмена</button>
            </div>
        `;
        OM('gm-tool-modal');
    };

    window.SPEND_INSPIRATION_FREE_ROLL = function() {
        if (!CONSUME_MY_INSPIRATION()) return;
        CM('gm-tool-modal');
        const r1 = Math.floor(Math.random() * 20) + 1;
        const r2 = Math.floor(Math.random() * 20) + 1;
        const best = Math.max(r1, r2);
        LOG_COMBAT_TO_CHAT(`⭐ тратит Вдохновение (Преимущество 2к20): выпало ${r1} и ${r2} -> лучший результат: ${best}!`);
        showMessage('⭐ Бросок с Вдохновением (2к20)', `
            <div style="text-align:center; padding:8px 0;">
                <div style="font-size:2.4rem; font-weight:bold; color:var(--ui-accent, #e6c88c);">${best}</div>
                <div style="color:var(--ui-muted, #aaa); margin-top:4px;">Кубики: <b>${r1}</b> и <b>${r2}</b> (выбран лучший)</div>
            </div>
        `);
    };

    // Интеграция Вдохновения (2к20) во все ключевые броски игрока
    const _ORIG_SKILL_EXEC = window.PLAYER_EXECUTE_SKILL_ROLL;
    window.PLAYER_EXECUTE_SKILL_ROLL = function() {
        const cs = GC();
        const c = cs[PI];
        if (!window._inspArmed || !c || window.GET_INSPIRATION_COUNT(c) <= 0) {
            return _ORIG_SKILL_EXEC();
        }
        const sess = GET_SESSION();
        const req = GET_SKILL_CHECK_REQ();
        if (!sess || !req) return;
        const myIdx = sess.playerIdx || 0;
        const bonus = GET_CHAR_CHECK_BONUS(c, req.checkName);
        const r1 = Math.floor(Math.random() * 20) + 1;
        const r2 = Math.floor(Math.random() * 20) + 1;
        const d20 = Math.max(r1, r2);
        const total = d20 + bonus;
        const success = (d20 === 20) || (d20 !== 1 && total >= req.dc);

        CONSUME_MY_INSPIRATION();
        if (!req.rolledBy) req.rolledBy = {};
        req.rolledBy[myIdx] = { d20, bonus, total, success };
        SAVE_SKILL_CHECK_REQ(req);
        CHECK_AND_RENDER_SKILL_ROLL_POPUP();

        const statusBadge = d20 === 20 ? '🌟 КРИТИЧЕСКИЙ УСПЕХ (20)!' : (d20 === 1 ? '💀 КРИТИЧЕСКИЙ ПРОВАЛ (1)!' : (success ? '✅ УСПЕХ!' : '❌ ПРОВАЛ!'));
        LOG_COMBAT_TO_CHAT(`⭐ [Вдохновение] Проверка «${req.checkName}» (Сл ${req.dc}): макс(${r1}, ${r2})=${d20}${MS(bonus)} = ${total} — ${statusBadge}`);
        showMessage(`⭐ Результат: ${req.checkName}`, `
            <div style="text-align:center; padding:10px 0;">
                <div style="font-size:2.4rem; font-weight:bold; color:${success ? '#6cb878' : '#d66565'}; margin-bottom:6px;">${total}</div>
                <div style="color:var(--ui-muted, #ccc); margin-bottom:8px;">⭐ Вдохновение (2к20): <b>${r1}</b> и <b>${r2}</b> → <b>${d20}</b> | Мод: <b>${MS(bonus)}</b> | Сл: <b>${req.dc}</b></div>
                <div style="font-size:1.15rem; font-weight:bold; color:${success ? '#6cb878' : '#d66565'};">${statusBadge}</div>
            </div>
        `);
    };

    const _ORIG_SKILL_POPUP = window.CHECK_AND_RENDER_SKILL_ROLL_POPUP;
    window.CHECK_AND_RENDER_SKILL_ROLL_POPUP = function() {
        _ORIG_SKILL_POPUP();
        const popup = document.getElementById('player-skill-check-popup');
        if (!popup) return;
        const cs = GC();
        const c = cs[PI];
        const cnt = window.GET_INSPIRATION_COUNT(c);
        if (cnt <= 0) return;

        let inspRow = popup.querySelector('[data-insp-skill-row]');
        if (!inspRow) {
            inspRow = document.createElement('div');
            inspRow.setAttribute('data-insp-skill-row', '1');
            inspRow.style.cssText = 'margin-top:8px;';
            popup.appendChild(inspRow);
        }
        inspRow.innerHTML = `
            <button class="btn-small ${window._inspArmed ? 'btn-save' : ''}" style="width:100%;" onclick="TOGGLE_ARM_INSPIRATION()">
                ${window._inspArmed ? '⭐ Вдохновение АКТИВНО (2к20) — нажмите для отмены' : `⭐ Потратить Вдохновение (${cnt}) для Преимущества 2к20`}
            </button>`;
    };

    const _ORIG_BG3_WEP = window.BG3_PLAYER_USE_WEAPON;
    if (typeof _ORIG_BG3_WEP === 'function') {
        window.BG3_PLAYER_USE_WEAPON = function(invIdx) {
            if (window.IS_ROOM_PAUSED()) { showMessage('⏸️ Игра на паузе', 'Снимите паузу, чтобы совершать действия в бою.'); return; }
            if (window.IS_HERO_INACTIVE_IN_ROOM(PI)) { showMessage('🟠 Вы в статусе Офф', 'Сначала нажмите «🟢 Вернуться в игру».'); return; }

            const cs = GC();
            const c = cs[PI];
            if (!window._inspArmed || !c || window.GET_INSPIRATION_COUNT(c) <= 0) {
                return _ORIG_BG3_WEP(invIdx);
            }
            const item = c.inventory && c.inventory[invIdx];
            if (!item) return;
            const st = GET_MAP_STATE();
            const to = ENSURE_TURN_STATE(st);
            if (to.attacksLeft <= 0) return;

            const pb = GPB(c.level || 1);
            const sm = GM(c.str || 10), dm = GM(c.dex || 10);
            const am = item.finesse ? Math.max(sm, dm) : (item.ranged ? dm : sm);
            const r1 = Math.floor(Math.random() * 20) + 1;
            const r2 = Math.floor(Math.random() * 20) + 1;
            const d20 = Math.max(r1, r2);
            const atkTotal = d20 + am + pb;
            const isCrit = (d20 === 20);
            let dmg = Math.max(1, ROLL(item.damage || '1к4') + am);
            if (isCrit) dmg += ROLL(item.damage || '1к4');

            CONSUME_MY_INSPIRATION();
            to.attacksLeft = Math.max(0, to.attacksLeft - 1);
            if (to.attacksLeft === 0) to.actionsLeft = 0;
            SAVE_MAP_STATE(st);

            BG3_APPLY_DAMAGE_TO_SELECTED_TOKEN(dmg, d20 === 1 ? 1 : atkTotal, isCrit, `⭐ ${item.name} (2к20: ${r1},${r2})`);
            RMC();
            RENDER_MAP_AREA();
        };
    }

    const _ORIG_BG3_UNARMED = window.BG3_PLAYER_UNARMED;
    if (typeof _ORIG_BG3_UNARMED === 'function') {
        window.BG3_PLAYER_UNARMED = function() {
            if (window.IS_ROOM_PAUSED()) { showMessage('⏸️ Игра на паузе', 'Снимите паузу, чтобы совершать действия в бою.'); return; }
            if (window.IS_HERO_INACTIVE_IN_ROOM(PI)) { showMessage('🟠 Вы в статусе Офф', 'Сначала нажмите «🟢 Вернуться в игру».'); return; }
            return _ORIG_BG3_UNARMED();
        };
    }

    const _ORIG_BG3_SPELL = window.BG3_PLAYER_CAST_SPELL;
    if (typeof _ORIG_BG3_SPELL === 'function') {
        window.BG3_PLAYER_CAST_SPELL = function(name) {
            if (window.IS_ROOM_PAUSED()) { showMessage('⏸️ Игра на паузе', 'Снимите паузу, чтобы творить заклинания в бою.'); return; }
            if (window.IS_HERO_INACTIVE_IN_ROOM(PI)) { showMessage('🟠 Вы в статусе Офф', 'Сначала нажмите «🟢 Вернуться в игру».'); return; }
            return _ORIG_BG3_SPELL(name);
        };
    }

    const _ORIG_DEATH_SAVE = window.ROLL_MY_DEATH_SAVE;
    if (typeof _ORIG_DEATH_SAVE === 'function') {
        window.ROLL_MY_DEATH_SAVE = function() {
            const cs = GC();
            const c = cs[PI];
            if (!window._inspArmed || !c || window.GET_INSPIRATION_COUNT(c) <= 0 || (c.hp ?? 10) > 0) {
                return _ORIG_DEATH_SAVE();
            }
            if (!c.deathSaves) c.deathSaves = { ok: 0, fail: 0, stable: false };
            const r1 = Math.floor(Math.random() * 20) + 1;
            const r2 = Math.floor(Math.random() * 20) + 1;
            const d20 = Math.max(r1, r2);
            CONSUME_MY_INSPIRATION();
            const freshCs = GC();
            const fc = freshCs[PI];
            if (!fc.deathSaves) fc.deathSaves = { ok: 0, fail: 0, stable: false };

            if (d20 === 20) {
                fc.hp = 1;
                fc.deathSaves = { ok: 0, fail: 0, stable: false };
                LOG_COMBAT_TO_CHAT(`⭐ [Вдохновение] Спас от смерти: макс(${r1},${r2})=20! Герой приходит в сознание с 1 ХП!`);
            } else if (d20 >= 10) {
                fc.deathSaves.ok = Math.min(3, (fc.deathSaves.ok || 0) + 1);
                if (fc.deathSaves.ok >= 3) fc.deathSaves.stable = true;
                LOG_COMBAT_TO_CHAT(`⭐ [Вдохновение] Спас от смерти: макс(${r1},${r2})=${d20} — Успех (${fc.deathSaves.ok}/3)!`);
            } else {
                fc.deathSaves.fail = Math.min(3, (fc.deathSaves.fail || 0) + (d20 === 1 ? 2 : 1));
                LOG_COMBAT_TO_CHAT(`⭐ [Вдохновение] Спас от смерти: макс(${r1},${r2})=${d20} — Провал (${fc.deathSaves.fail}/3).`);
            }
            SC(freshCs);
            RMC();
            RENDER_MAP_AREA();
        };
    }

    // ================================================================
    // 4. УЧЁТ ОФФ/АФК В ГОЛОСОВАНИЯХ ЗА ДЛИННЫЙ ОТДЫХ, БОЮ И ВЗАИМОДЕЙСТВИЯХ
    // ================================================================
    window.SLR = function() {
        const rc = CUR_ROOM();
        const cs = GC();
        const c = cs[PI];
        if (!c) return;
        if (window.IS_HERO_INACTIVE_IN_ROOM(PI, rc)) {
            showMessage('🟠 Вы в статусе Офф', 'Сначала вернитесь в игру, чтобы голосовать за отдых.');
            return;
        }

        const activeIdx = window.GET_ACTIVE_PARTY_INDICES(rc);
        const fightingIdx = activeIdx.find(i => GET_CHAR_FOR_ROOM(cs[i], rc)?.inCombat);
        if (c.inCombat || fightingIdx !== undefined) {
            const fighter = fightingIdx !== undefined ? GET_CHAR_FOR_ROOM(cs[fightingIdx], rc) : c;
            showMessage('⚔️ Отдых невозможен', `${c.inCombat ? 'Вы находитесь в бою!' : `«${fighter.name}» сейчас в бою!`}<br><br>Нельзя разбить лагерь во время сражения.`);
            return;
        }

        const poll = GET_REST_POLL();
        const totalPlayers = Math.max(1, activeIdx.length);
        const neededMajority = Math.floor(totalPlayers / 2) + 1;

        if (totalPlayers === 1) {
            document.getElementById('rest-content').innerHTML = `
                <h2>🌙 Лагерь: Длинный отдых</h2>
                <div style="background:var(--ui-panel2, #1a1a1a); padding:12px; border-radius:6px; border:1px solid var(--ui-border, #444); margin-bottom:15px; font-size:0.9em; text-align:left;">
                    Полное восстановление ХП, Костей Хитов, Коротких отдыхов и всех ячеек магии для активных героев комнаты.
                </div>
                <button class="btn-save" style="padding:8px 16px;" onclick="EXECUTE_LONG_REST_FOR_PARTY()">🔥 Разбить лагерь и отдохнуть</button>
                <button onclick="CM('rest-modal')">Отмена</button>
            `;
            OM('rest-modal');
            return;
        }

        if (!poll || !poll.active) {
            document.getElementById('rest-content').innerHTML = `
                <h2>🌙 Лагерь: Длинный отдых</h2>
                <div style="background:var(--ui-panel2, #1a1a1a); padding:12px; border-radius:6px; border:1px solid var(--ui-border, #444); margin-bottom:15px; font-size:0.9em; text-align:left;">
                    Активных игроков в комнате: <b>${totalPlayers}</b> (оффлайн/АФК герои не учитываются).<br>
                    Для отдыха нужно минимум <b>${neededMajority} из ${totalPlayers}</b> голосов.
                </div>
                <button class="btn-save" style="padding:8px 16px;" onclick="START_LONG_REST_POLL()">📣 Начать голосование за Длинный отдых</button>
                <button onclick="CM('rest-modal')">Отмена</button>
            `;
            OM('rest-modal');
            return;
        }

        let yesVotes = 0, statusRows = '';
        activeIdx.forEach(idx => {
            const m = GET_CHAR_FOR_ROOM(cs[idx], rc);
            const v = poll.votes[idx];
            if (v === 'yes') yesVotes++;
            const badge = v === 'yes' ? '<span style="color:#6cb878;">✅ Согласен</span>' : (v === 'no' ? '<span style="color:#d66565;">❌ Против</span>' : '<span style="color:#d99a4e;">⏳ Голосует...</span>');
            statusRows += `<div style="display:flex; justify-content:space-between; padding:6px 10px; background:var(--ui-panel2, #252525); border-radius:4px; margin-bottom:4px;"><span><b>${ESC(m.name || 'Игрок')}</b></span>${badge}</div>`;
        });

        document.getElementById('rest-content').innerHTML = `
            <h2>🏕️ Голосование за Длинный отдых</h2>
            <p style="color:var(--ui-muted, #aaa); font-size:0.9em;">Инициатор: <b>${ESC(poll.initiatorName)}</b> | ЗА: <b>${yesVotes}/${totalPlayers}</b> (нужно ${neededMajority})</p>
            <div style="margin:12px 0; text-align:left;">${statusRows}</div>
            <button class="btn-danger" onclick="CANCEL_LONG_REST_POLL()">Отозвать голосование</button>
            <button onclick="CM('rest-modal')">Свернуть</button>
        `;
        OM('rest-modal');
    };

    window.START_LONG_REST_POLL = function() {
        const rc = CUR_ROOM();
        const cs = GC();
        const c = cs[PI];
        if (!c) return;
        const activeIdx = window.GET_ACTIVE_PARTY_INDICES(rc);
        if (activeIdx.some(i => GET_CHAR_FOR_ROOM(cs[i], rc)?.inCombat)) {
            showMessage('⚔️ Бой!', 'Кто-то из активных участников находится в бою.');
            return;
        }
        SAVE_REST_POLL({ active: true, initiatorIdx: PI, initiatorName: c.name || 'Игрок', votes: { [PI]: 'yes' } });
        CM('rest-modal');
        const total = Math.max(1, activeIdx.length);
        LOG_COMBAT_TO_CHAT(`🏕️ предлагает Длинный отдых! Голосов ЗА: 1/${total} (нужно ${Math.floor(total / 2) + 1}).`);
        CHECK_POLL_RESOLUTION();
        CHECK_AND_RENDER_REST_POPUP();
    };

    window.CAST_REST_POLL_VOTE = function(voteVal) {
        const rc = CUR_ROOM();
        const poll = GET_REST_POLL();
        if (!poll || !poll.active) return;
        poll.votes[PI] = voteVal;
        SAVE_REST_POLL(poll);
        const activeIdx = window.GET_ACTIVE_PARTY_INDICES(rc);
        const yesCount = activeIdx.filter(i => poll.votes[i] === 'yes').length;
        LOG_COMBAT_TO_CHAT(`${voteVal === 'yes' ? '✅ голосует ЗА Длинный отдых' : '❌ голосует ПРОТИВ'} (ЗА: ${yesCount}/${activeIdx.length})`);
        CHECK_AND_RENDER_REST_POPUP();
        CHECK_POLL_RESOLUTION();
    };

    window.CHECK_POLL_RESOLUTION = function() {
        const rc = CUR_ROOM();
        const poll = GET_REST_POLL();
        if (!poll || !poll.active) return;
        const activeIdx = window.GET_ACTIVE_PARTY_INDICES(rc);
        const total = Math.max(1, activeIdx.length);
        const needed = Math.floor(total / 2) + 1;
        let yes = 0, no = 0, voted = 0;

        activeIdx.forEach(i => {
            if (poll.votes[i] === 'yes') { yes++; voted++; }
            else if (poll.votes[i] === 'no') { no++; voted++; }
        });

        if (yes >= needed) {
            EXECUTE_LONG_REST_FOR_PARTY();
        } else if (yes + (total - voted) < needed) {
            SAVE_REST_POLL(null);
            CM('rest-modal');
            CHECK_AND_RENDER_REST_POPUP();
            LOG_COMBAT_TO_CHAT(`🚫 Голосование за Длинный отдых отклонено (ЗА: ${yes}, ПРОТИВ: ${no}).`);
        }
    };

    window.CHECK_AND_RENDER_REST_POPUP = function() {
        let popup = document.getElementById('party-rest-vote-popup');
        const sess = GET_SESSION();
        const rc = CUR_ROOM();
        const poll = GET_REST_POLL();
        const activeIdx = window.GET_ACTIVE_PARTY_INDICES(rc);

        if (!sess || sess.role !== 'player' || !poll || !poll.active || activeIdx.length <= 1 || window.IS_HERO_INACTIVE_IN_ROOM(PI, rc)) {
            if (popup) popup.remove();
            return;
        }

        const total = activeIdx.length;
        const needed = Math.floor(total / 2) + 1;
        const yes = activeIdx.filter(i => poll.votes[i] === 'yes').length;
        const myVote = poll.votes[PI];

        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'party-rest-vote-popup';
            popup.style.cssText = 'position:fixed; top:18px; left:50%; transform:translateX(-50%); width:420px; max-width:94vw; background:var(--ui-panel, #1c1917); border:2px solid var(--ui-accent, #c9a96e); border-radius:12px; padding:16px 20px; box-shadow:0 12px 34px rgba(0,0,0,0.9); z-index:94100; color:var(--ui-text, #e0e0e0); text-align:center;';
            document.body.appendChild(popup);
        }

        if (!myVote) {
            popup.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <b style="color:var(--ui-accent, #c9a96e);">🏕️ Голосование за Длинный отдых</b>
                    <small style="color:var(--ui-muted, #aaa);">${yes}/${total} ЗА</small>
                </div>
                <p style="font-size:0.88rem; margin-bottom:10px;">
                    <b>${ESC(poll.initiatorName)}</b> предлагает разбить лагерь (нужно ${needed} из ${total} активных).
                </p>
                <div style="display:flex; gap:8px;">
                    <button class="btn-save" style="flex:1; padding:8px;" onclick="CAST_REST_POLL_VOTE('yes')">✅ Согласиться</button>
                    <button class="btn-danger" style="flex:1; padding:8px;" onclick="CAST_REST_POLL_VOTE('no')">❌ Отказаться</button>
                </div>`;
        } else {
            popup.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div style="text-align:left;">
                        <b style="color:var(--ui-accent, #c9a96e); font-size:0.9rem;">🏕️ Отдых: ${yes}/${total} ЗА</b><br>
                        <small style="color:var(--ui-muted, #aaa);">Ваш голос: ${myVote === 'yes' ? '✅ ЗА' : '❌ ПРОТИВ'} (нужно ${needed})</small>
                    </div>
                    <button class="btn-small" onclick="SLR()">Статус</button>
                </div>`;
        }
    };

    // Пропускаем Офф/АФК героев при смене хода в бою и защищаем их от атак врагов и взаимодействий
    const _ORIG_NEXT_TURN_SESS = window.GM_NEXT_TURN;
    window.GM_NEXT_TURN = function() {
        if (window.IS_ROOM_PAUSED()) {
            showMessage('⏸️ Игра на паузе', 'Снимите паузу, чтобы продолжить ходы.');
            return;
        }
        const st = GET_MAP_STATE();
        SYNC_PLAYER_TOKENS_WITH_CHARS(st);
        if (!st.tokens || !st.tokens.length) return;
        const to = ENSURE_TURN_STATE(st);
        to.active = true;

        let loops = 0;
        do {
            to.currentIdx = to.currentIdx + 1;
            if (to.currentIdx >= st.tokens.length) {
                to.currentIdx = 0;
                to.round = (to.round || 1) + 1;
            }
            loops++;
        } while (
            loops < st.tokens.length &&
            (st.tokens[to.currentIdx].hp <= 0 ||
             (st.tokens[to.currentIdx].isPlayer && window.IS_HERO_INACTIVE_IN_ROOM(st.tokens[to.currentIdx].charIdx)))
        );

        RESET_ACTIONS_FOR_CURRENT_FIGHTER(st);
        SAVE_MAP_STATE(st);
        const curTok = st.tokens[to.currentIdx];
        LOG_COMBAT_TO_CHAT(`⏭️ [Раунд ${to.round}] Очередь хода переходит к «${curTok ? curTok.name : 'Бойцу'}»!`);
        RENDER_MAP_AREA();
    };

    const _ORIG_ENEMY_AI_SESS = window.BG3_EXECUTE_ENEMY_AI_TURN;
    if (typeof _ORIG_ENEMY_AI_SESS === 'function') {
        window.BG3_EXECUTE_ENEMY_AI_TURN = function() {
            if (window.IS_ROOM_PAUSED()) return;
            const st = GET_MAP_STATE();
            const cs = GC();
            // Временно скрываем Офф/АФК игроков от выбора цели врагом
            const savedHps = [];
            (st.tokens || []).forEach(t => {
                if (t.isPlayer && window.IS_HERO_INACTIVE_IN_ROOM(t.charIdx) && cs[t.charIdx]) {
                    savedHps.push({ idx: t.charIdx, hp: cs[t.charIdx].hp });
                    cs[t.charIdx].hp = 0;
                }
            });
            if (savedHps.length) {
                SC(cs);
                _ORIG_ENEMY_AI_SESS();
                const fresh = GC();
                savedHps.forEach(s => { if (fresh[s.idx]) fresh[s.idx].hp = s.hp; });
                SC(fresh);
                RPL();
                return;
            }
            return _ORIG_ENEMY_AI_SESS();
        };
    }

    // Блокируем взаимодействие с Офф/АФК персонажем (Лист/Рюкзак, Внезапная атака)
    const _ORIG_GM_REQ_ACCESS = window.GM_REQUEST_ACCESS;
    window.GM_REQUEST_ACCESS = function(charIdx, targetType) {
        const info = window.GET_HERO_STATUS_INFO(charIdx);
        if (info.state === 'afk') {
            showMessage('🟠 Персонаж в статусе Офф (АФК)', 'Игрок пометил своего героя как неактивного — взаимодействовать с ним нельзя, пока он не вернётся (или пока вы не нажмёте «▶️» на его карточке).');
            return;
        }
        return _ORIG_GM_REQ_ACCESS(charIdx, targetType);
    };

    const _ORIG_OPEN_AMBUSH_SESS = window.OPEN_AMBUSH_MODAL;
    if (typeof _ORIG_OPEN_AMBUSH_SESS === 'function') {
        window.OPEN_AMBUSH_MODAL = function() {
            if (window.IS_ROOM_PAUSED()) { showMessage('⏸️ Игра на паузе', 'Нападение невозможно во время паузы.'); return; }
            if (window.IS_HERO_INACTIVE_IN_ROOM(PI)) { showMessage('🟠 Вы в статусе Офф', 'Сначала нажмите «🟢 Вернуться в игру».'); return; }
            _ORIG_OPEN_AMBUSH_SESS();
        };
    }

    // Блокируем перетаскивание фишек на паузе или для Офф-игрока
    const _ORIG_START_DRAG_SESS = window.START_DRAG_MAP_OBJ;
    if (typeof _ORIG_START_DRAG_SESS === 'function') {
        window.START_DRAG_MAP_OBJ = function(type, index, domId) {
            const sess = GET_SESSION();
            if (window.IS_ROOM_PAUSED() && !(sess && sess.role === 'gm')) return;
            if (sess && sess.role === 'player' && window.IS_HERO_INACTIVE_IN_ROOM(PI)) return;
            return _ORIG_START_DRAG_SESS(type, index, domId);
        };
    }

    // ================================================================
    // 5. ХУКИ В UI (КАРТОЧКА ГЕРОЯ, ОТРЯД, КАРТА, БОЕВОЙ HUD)
    // ================================================================
    const _ORIG_RMC_SESS = window.RMC;
    window.RMC = function() {
        _ORIG_RMC_SESS();
        const sess = GET_SESSION();
        if (!sess || sess.role !== 'player') return;
        const card = document.querySelector('#left-column .char-card');
        if (!card) return;

        card.querySelectorAll('[data-session-ui]').forEach(el => el.remove());

        const cs = GC();
        const c = cs[PI];
        if (!c) return;

        const inspCnt = window.GET_INSPIRATION_COUNT(c);
        if (inspCnt > 0) {
            const box = document.createElement('div');
            box.setAttribute('data-session-ui', 'insp');
            box.style.cssText = 'margin:6px 0; padding:6px 10px; border-radius:8px; background:var(--ui-panel2, #1a1814); border:1px solid var(--ui-accent, #c9a96e); display:flex; justify-content:space-between; align-items:center; gap:6px;';
            box.innerHTML = `
                <span style="color:var(--ui-accent, #e6c88c); font-weight:bold; font-size:0.88rem;">
                    ⭐ Вдохновение (${inspCnt})${window._inspArmed ? ' • 🎯 2к20' : ''}
                </span>
                <button class="btn-small ${window._inspArmed ? 'btn-save' : ''}" style="width:auto; margin:0; padding:3px 9px; font-size:0.8rem;" onclick="OPEN_INSPIRATION_MODAL()">
                    ${window._inspArmed ? '🎯 Заряжено' : '✨ Исп.'}
                </button>
            `;
            const hpBar = card.querySelector('.hp-bar');
            if (hpBar) hpBar.after(box);
            else card.appendChild(box);
        }

        if (window.IS_HERO_INACTIVE_IN_ROOM(PI)) {
            const afkBanner = document.createElement('div');
            afkBanner.setAttribute('data-session-ui', 'afk');
            afkBanner.style.cssText = 'margin:6px 0; padding:6px 8px; border-radius:7px; background:var(--ui-panel2, #1a1814); border:1px dashed #d99a4e; color:#d99a4e; font-size:0.84rem;';
            afkBanner.innerHTML = `🟠 Вы в статусе <b>Офф / АФК</b> <button class="btn-small btn-save" style="width:auto; margin:4px 0 0 0; padding:3px 9px; font-size:0.78rem;" onclick="TOGGLE_MY_AFK_STATUS()">🟢 Вернуться</button>`;
            const hpBar = card.querySelector('.hp-bar');
            if (hpBar) hpBar.after(afkBanner);
        }
    };

    const _ORIG_RPL_SESS = window.RPL;
    window.RPL = function() {
        _ORIG_RPL_SESS();
        const sess = GET_SESSION();
        const rc = CUR_ROOM();
        if (!sess || !rc) return;

        const con = document.getElementById('party-list');
        if (!con) return;

        const cs = GC();
        const isGM = (sess.role === 'gm');
        const allIdx = (typeof GET_ROOM_PARTY_INDICES === 'function') ? GET_ROOM_PARTY_INDICES(rc) : cs.map((_, i) => i);
        const shownIdx = (isGM ? allIdx : allIdx.filter(idx => idx !== PI)).filter(idx => !!cs[idx]);
        const cards = con.querySelectorAll('.party-member');

        cards.forEach((card, pos) => {
            const idx = shownIdx[pos];
            if (idx === undefined || !cs[idx]) return;
            const ch = (typeof GET_CHAR_FOR_ROOM === 'function') ? GET_CHAR_FOR_ROOM(cs[idx], rc) : cs[idx];
            const info = window.GET_HERO_STATUS_INFO(idx, rc);
            const insp = window.GET_INSPIRATION_COUNT(ch);

            card.style.opacity = info.interactive ? '1' : '0.52';

            const nameEl = card.querySelector('.party-name');
            if (nameEl) {
                nameEl.querySelectorAll('[data-sess-badge]').forEach(b => b.remove());
                const stBadge = document.createElement('span');
                stBadge.setAttribute('data-sess-badge', 'status');
                stBadge.style.cssText = `font-size:0.76em; margin-left:6px; color:${info.color}; font-weight:normal;`;
                stBadge.textContent = `${info.icon} ${info.label}`;
                nameEl.appendChild(stBadge);

                if (insp > 0) {
                    const iBadge = document.createElement('span');
                    iBadge.setAttribute('data-sess-badge', 'insp');
                    iBadge.style.cssText = 'font-size:0.78em; margin-left:6px; color:var(--ui-accent, #e6c88c);';
                    iBadge.textContent = `⭐×${insp}`;
                    iBadge.title = `Вдохновение: ${insp}`;
                    nameEl.appendChild(iBadge);
                }
            }

            if (isGM) {
                const btnGroup = card.querySelector('div[onclick*="stopPropagation"]');
                if (btnGroup) {
                    btnGroup.querySelectorAll('[data-sess-gm-btn]').forEach(b => b.remove());

                    const inspBtn = document.createElement('button');
                    inspBtn.className = 'btn-small';
                    inspBtn.setAttribute('data-sess-gm-btn', 'insp');
                    inspBtn.title = 'Выдать +1 Вдохновение (ПКМ — забрать 1)';
                    inspBtn.style.cssText = 'padding:5px 8px; font-size:0.82rem;';
                    inspBtn.textContent = insp > 0 ? `⭐+${insp}` : '⭐';
                    inspBtn.onclick = (e) => { e.stopPropagation(); window.GM_CHANGE_INSPIRATION(idx, 1); };
                    inspBtn.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); window.GM_CHANGE_INSPIRATION(idx, -1); };
                    btnGroup.appendChild(inspBtn);

                    const afkBtn = document.createElement('button');
                    afkBtn.className = 'btn-small';
                    afkBtn.setAttribute('data-sess-gm-btn', 'afk');
                    afkBtn.title = info.state === 'afk' ? 'Вернуть персонажа в активный состав' : 'Пометить персонажа Офф / АФК';
                    afkBtn.style.cssText = 'padding:5px 8px; font-size:0.82rem;';
                    afkBtn.textContent = info.state === 'afk' ? '▶️' : '🟠';
                    afkBtn.onclick = (e) => { e.stopPropagation(); window.GM_TOGGLE_PLAYER_AFK(idx); };
                    btnGroup.appendChild(afkBtn);
                }
            }
        });
    };

    const _ORIG_RENDER_MAP_SESS = window.RENDER_MAP_AREA;
    window.RENDER_MAP_AREA = function() {
        _ORIG_RENDER_MAP_SESS();
        const mapArea = document.getElementById('map-area');
        if (!mapArea || !CUR_ROOM()) return;

        // Помечаем АФК-фишки на карте
        const mapSt = GET_MAP_STATE();
        (mapSt.tokens || []).forEach((tok, tIdx) => {
            if (tok.isPlayer && window.IS_HERO_INACTIVE_IN_ROOM(tok.charIdx)) {
                const el = document.getElementById('map-tok-' + tIdx);
                if (el) el.style.opacity = '0.42';
            }
        });

        // Плашка паузы поверх карты (не закрывает чат и личку)
        mapArea.querySelectorAll('#map-pause-banner').forEach(el => el.remove());
        if (window.IS_ROOM_PAUSED()) {
            const st = GET_SESS_STATE();
            const sess = GET_SESSION();
            const isGM = sess && sess.role === 'gm';
            const ov = document.createElement('div');
            ov.id = 'map-pause-banner';
            ov.style.cssText = 'position:absolute; inset:0; background:rgba(14,13,12,0.52); backdrop-filter:blur(2px); z-index:16; display:flex; align-items:center; justify-content:center; padding:16px;';
            ov.onclick = (e) => e.stopPropagation();
            ov.innerHTML = `
                <div style="background:var(--ui-panel, #1e1c1a); border:2px solid var(--ui-accent, #c9a96e); border-radius:12px; padding:16px 22px; text-align:center; max-width:390px; box-shadow:0 12px 32px rgba(0,0,0,0.85);">
                    <div style="font-size:1.7rem; margin-bottom:4px;">⏸️</div>
                    <b style="color:var(--ui-accent, #e6c88c); font-size:1.1rem;">Игра на паузе</b>
                    <div style="color:var(--ui-muted, #aaa); font-size:0.86rem; margin:6px 0 12px 0;">
                        Поставил: ${ESC(st.pausedBy || 'отряд')}.<br>Чат и личка работают как обычно.
                    </div>
                    ${isGM
                        ? `<button class="btn-save" onclick="GM_TOGGLE_PAUSE()">▶️ Продолжить игру</button>`
                        : `<button class="btn-save" onclick="PLAYER_REQUEST_PAUSE_TOGGLE()">▶️ Голосовать за продолжение</button>`
                    }
                </div>
            `;
            mapArea.appendChild(ov);
        }
    };

    const _ORIG_HUD_SESS = window.RENDER_BG3_COMBAT_HUD;
    if (typeof _ORIG_HUD_SESS === 'function') {
        window.RENDER_BG3_COMBAT_HUD = function() {
            _ORIG_HUD_SESS();
            const sess = GET_SESSION();
            if (!sess || sess.role !== 'player') return;
            const hud = document.getElementById('bg3-player-combat-hud');
            if (!hud) return;

            const cs = GC();
            const c = cs[PI];
            if (!c || !c.inCombat) return;

            if (window.IS_HERO_INACTIVE_IN_ROOM(PI)) {
                hud.innerHTML = `
                    <div style="margin-top:12px; padding:12px 16px; border-radius:10px; background:var(--ui-panel2, #181715); border:1px dashed #d99a4e; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap;">
                        <span style="color:#d99a4e;">🟠 Ваш персонаж в статусе <b>Офф / АФК</b> — вы временно исключены из боя.</span>
                        <button class="btn-small btn-save" onclick="TOGGLE_MY_AFK_STATUS()">🟢 Вернуться в бой</button>
                    </div>`;
                return;
            }

            const cnt = window.GET_INSPIRATION_COUNT(c);
            if (cnt > 0) {
                const headerBtns = hud.querySelector('button[onclick="GM_NEXT_TURN()"]')?.parentElement;
                if (headerBtns && !headerBtns.querySelector('[data-hud-insp]')) {
                    const b = document.createElement('button');
                    b.className = 'btn-small ' + (window._inspArmed ? 'btn-save' : '');
                    b.setAttribute('data-hud-insp', '1');
                    b.textContent = window._inspArmed ? '⭐ 2к20 АКТИВНО' : `⭐ Вдохн. (${cnt})`;
                    b.title = 'Потратить Вдохновение для Преимущества (2к20) на следующую атаку';
                    b.onclick = () => window.TOGGLE_ARM_INSPIRATION();
                    headerBtns.prepend(b);
                }
            }
        };
    }

    // Привязка к смене комнаты и роли
    if (typeof window.SWITCH_FIREBASE_ROOM === 'function') {
        const _ORIG_SW_SESS = window.SWITCH_FIREBASE_ROOM;
        window.SWITCH_FIREBASE_ROOM = function(rc) {
            const res = _ORIG_SW_SESS(rc);
            SYNC_SESSION_FOR_ROOM(rc);
            return res;
        };
    }

    const _ORIG_APPLY_SESS = window.APPLY_ROLE_VIEW;
    window.APPLY_ROLE_VIEW = function() {
        _ORIG_APPLY_SESS();
        const rc = CUR_ROOM();
        SYNC_SESSION_FOR_ROOM(rc);
        RENDER_SESSION_BAR();
    };

    window.addEventListener('beforeunload', REMOVE_MY_ROOM_PRESENCE);

    SYNC_SESSION_FOR_ROOM(CUR_ROOM());
    RENDER_SESSION_BAR();
})();