// ================================================================
// 🏰 ПОЛНОЕ РАЗГРАНИЧЕНИЕ ОТРЯДОВ, БОЁВ, ОТДЫХА И НАГРАД ПО КОМНАТАМ (rooms.js)
// ================================================================
(function INIT_ROOM_ISOLATION_LOGIC() {
    const FB_ROOMS_URL = "https://dnds-23b7d-default-rtdb.firebaseio.com/campaign_v2/rooms";

    function CUR_ROOM() {
        return (typeof window.GET_ACTIVE_ROOM_CODE === 'function') ? window.GET_ACTIVE_ROOM_CODE() : null;
    }

    // 1. Возвращает индексы персонажей (в общем массиве GC()), которые реально относятся к текущей комнате
    window.GET_ROOM_PARTY_INDICES = function(roomCode) {
        const rCode = String(roomCode || CUR_ROOM() || '');
        const cs = GC();
        if (!rCode) return cs.map((_, i) => i);
        const sess = GET_SESSION();
        const out = [];
        cs.forEach((c, idx) => {
            if (!c) return;
            const hasProg = !!(c.roomProgress && Object.prototype.hasOwnProperty.call(c.roomProgress, rCode));
            const isActiveHere = (String(c._activeRoomCode || '') === rCode);
            const isCurrentPlayerHere = !!(sess && sess.role === 'player' && String(sess.roomCode) === rCode && (idx === PI || (sess.heroId && c.id === sess.heroId)));
            if (hasProg || isActiveHere || isCurrentPlayerHere) {
                out.push(idx);
            }
        });
        return out;
    };

    // 2. Чтение параметров героя именно в контексте указанной комнаты (не ломая его прогресс в других комнатах)
    window.GET_CHAR_FOR_ROOM = function(c, roomCode) {
        if (!c) return null;
        const rCode = String(roomCode || CUR_ROOM() || '');
        if (!rCode || String(c._activeRoomCode || '') === rCode) return c;
        if (c.roomProgress && c.roomProgress[rCode]) {
            const view = Object.assign({}, c, JSON.parse(JSON.stringify(c.roomProgress[rCode])));
            AB(view);
            return view;
        }
        return c;
    };

    // 3. Безопасное изменение героя в конкретной комнате (не затрагивает другие комнаты)
    window.MUTATE_HERO_IN_ROOM = function(c, roomCode, mutatorFn) {
        if (!c || typeof mutatorFn !== 'function') return;
        const rCode = String(roomCode || CUR_ROOM() || '');
        if (!c.roomProgress) c.roomProgress = {};
        if (!rCode || String(c._activeRoomCode || '') === rCode) {
            mutatorFn(c);
            AB(c);
            if (rCode) c.roomProgress[rCode] = EXTRACT_PROGRESS_SNAPSHOT(c);
            return;
        }
        const snap = c.roomProgress[rCode] || c._baseSnapshot || CREATE_CLEAN_LEVEL1_SNAPSHOT(c);
        const temp = Object.assign(CREATE_DEFAULT_CHAR(), c);
        APPLY_PROGRESS_SNAPSHOT(temp, snap);
        mutatorFn(temp);
        AB(temp);
        c.roomProgress[rCode] = EXTRACT_PROGRESS_SNAPSHOT(temp);
    };

    // 4. Заголовок карты по умолчанию для новой комнаты = название этой комнаты
    const _ORIG_GET_MAP_STATE = window.GET_MAP_STATE;
    window.GET_MAP_STATE = function() {
        const raw = localStorage.getItem('dnd_map_state');
        const st = _ORIG_GET_MAP_STATE();
        if (!raw) {
            const rc = CUR_ROOM();
            if (rc) {
                const room = GET_ROOMS().find(r => String(r.code) === String(rc));
                if (room && room.name) {
                    st.title = room.name;
                    st.desc = `Локация комнаты #${room.code}`;
                }
            }
        }
        return st;
    };

    // 5. При удалении комнаты чистим её ветку в Firebase
    const _ORIG_SAVE_ROOMS = window.SAVE_ROOMS;
    window.SAVE_ROOMS = function(nextRooms) {
        const prevCodes = GET_ROOMS().map(r => String(r.code));
        const nextCodes = (nextRooms || []).map(r => String(r.code));
        prevCodes.forEach(code => {
            if (!nextCodes.includes(code)) {
                fetch(`${FB_ROOMS_URL}/${encodeURIComponent(code)}.json`, { method: 'DELETE' }).catch(() => {});
            }
        });
        return _ORIG_SAVE_ROOMS(nextRooms);
    };

    // 6. Корректный вход игрока в комнату (сначала переключаем комнату, потом докидываем фишку на её карту)
    window.PLAYER_JOIN_SELECTED_ROOM = function(roomCode) {
        const rCode = String(roomCode || document.getElementById('player-step3-room-select')?.value || '1001');
        const cs = GC();
        const idx = cs.findIndex(c => c && c.id === window._selectedBaseHeroId);
        if (idx === -1) {
            showMessage('Ошибка', 'Персонаж не найден. Пожалуйста, выберите героя заново.');
            window._lobbyStep = 'player_chars';
            RENDER_LOBBY_HTML();
            return;
        }

        const hero = cs[idx];
        LOAD_HERO_STATE_FOR_ROOM(hero, rCode);
        PI = idx;
        SC(cs);

        window._pendingJoinTokenHero = { roomCode: rCode, charIdx: idx };
        SAVE_SESSION({ role: 'player', roomCode: rCode, playerIdx: idx, heroId: hero.id });
        APPLY_ROLE_VIEW();

        if (window._openSheetAfterJoin) {
            window._openSheetAfterJoin = false;
            setTimeout(() => { OCS(); }, 150);
        }
    };

    // 7. Тестовые союзники привязываются строго к текущей комнате
    window.ADD_TEST_PARTY_MEMBER = function() {
        const cs = GC();
        const rc = CUR_ROOM();
        const num = cs.length + 1;
        const classes = ['Воин', 'Жрец', 'Плут', 'Волшебник', 'Бард', 'Колдун'];
        const races = ['Эльф', 'Дварф', 'Человек', 'Тифлинг'];
        const newChar = CREATE_DEFAULT_CHAR();
        newChar.id = 'hero_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        newChar.name = 'Союзник ' + num;
        newChar.race = races[(num - 2) % races.length];
        newChar.className = classes[(num - 2) % classes.length];
        AB(newChar);
        newChar.hp = newChar.maxHp || 10;
        newChar._baseSnapshot = EXTRACT_PROGRESS_SNAPSHOT(newChar);
        newChar.roomProgress = {};
        if (rc) {
            newChar._activeRoomCode = String(rc);
            newChar.roomProgress[String(rc)] = EXTRACT_PROGRESS_SNAPSHOT(newChar);
        }
        cs.push(newChar);
        SC(cs);
        RMC();
        RPL();
        CHECK_AND_RENDER_REST_POPUP();
    };

    window.REMOVE_LAST_PARTY_MEMBER = function() {
        const rc = CUR_ROOM();
        const cs = GC();
        const indices = GET_ROOM_PARTY_INDICES(rc);
        if (indices.length <= 1) return;
        const lastIdx = indices[indices.length - 1];
        const target = cs[lastIdx];
        if (!target) return;

        if (rc && target.roomProgress && Object.keys(target.roomProgress).length > 1) {
            delete target.roomProgress[String(rc)];
            if (String(target._activeRoomCode) === String(rc)) target._activeRoomCode = '';
        } else {
            cs.splice(lastIdx, 1);
            if (PI >= cs.length) PI = 0;
        }
        localStorage.removeItem('dnd_rest_poll');
        SC(cs);
        RMC();
        RPL();
        CHECK_AND_RENDER_REST_POPUP();
    };

    // 8. Список «Отряд» показывает ТОЛЬКО игроков текущей комнаты
    window.RPL = function() {
        const sess = GET_SESSION();
        const rc = CUR_ROOM();
        const isGM = sess && sess.role === 'gm';
        if (!isGM && sess && sess.role === 'player') SYNC_MY_PLAYER_INDEX();

        const cs = GC();
        const con = document.getElementById('party-list');
        if (!con) return;
        con.innerHTML = '';

        const partyIndices = GET_ROOM_PARTY_INDICES(rc);

        if (isGM) {
            const cntEl = document.getElementById('gm-room-party-count');
            if (cntEl) cntEl.textContent = String(partyIndices.length);

            const hint = document.createElement('div');
            hint.style.cssText = 'color:#c9a96e; font-size:0.9rem; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;';
            hint.innerHTML = `
                <span>👆 <b>Игроки в этой комнате (${partyIndices.length} чел.)</b> — нажмите для доступа к Листу или Рюкзаку:</span>
                <div style="display:flex; gap:6px;">
                    <button class="btn-small" onclick="ADD_TEST_PARTY_MEMBER(); RPL();">+ Игрок</button>
                    ${partyIndices.length > 1 ? '<button class="btn-small btn-danger" onclick="REMOVE_LAST_PARTY_MEMBER(); RPL();">− Убрать</button>' : ''}
                </div>
            `;
            con.appendChild(hint);

            if (partyIndices.length === 0) {
                const empty = document.createElement('p');
                empty.style.cssText = 'color:#888; text-align:center; padding:12px 0;';
                empty.textContent = 'В эту комнату пока не вошёл ни один игрок.';
                con.appendChild(empty);
                return;
            }

            partyIndices.forEach(idx => {
                const c = GET_CHAR_FOR_ROOM(cs[idx], rc);
                if (!c) return;
                const maxS = GET_SPELL_SLOTS(c);
                const usedS = c.usedSpellSlots || {};
                let totM = 0, totU = 0;
                for (let k = 1; k <= 9; k++) { if (maxS[k] > 0) { totM += maxS[k]; totU += (usedS[k] || 0); } }
                const slotsTxt = totM > 0 ? `${totM - totU}/${totM}` : '—';

                const d = document.createElement('div');
                d.className = 'party-member';
                d.style.cursor = 'pointer';
                d.onclick = function() { GM_REQUEST_ACCESS(idx, 'sheet'); };

                const ah = c.avatar ? '<img class="party-avatar" src="' + c.avatar + '" alt="">' : '<div class="party-avatar-placeholder">👤</div>';
                const combatBadge = c.inCombat ? ' <span style="color:#e06060;font-size:0.85em;">⚔️ В бою</span>' : '';
                const trustBadge = c.autoApproveGM
                    ? ' <span style="color:#52b758; font-size:0.78em;">🤝 Доверяет</span>'
                    : ' <span style="color:#c9a96e; font-size:0.78em;">🔒 По запросу</span>';

                d.innerHTML = ah +
                    '<div class="party-info">' +
                        '<div class="party-name">' + (c.name || 'Безымянный') + combatBadge + trustBadge + '</div>' +
                        '<div class="party-detail">' + (c.race || 'Раса не выбрана') + ' | ' + (c.className || 'Класс не выбран') + ' (Ур. ' + (c.level || 1) + ')</div>' +
                    '</div>' +
                    '<div class="party-stats">' +
                        '<div><div class="party-stat-val">' + (c.hp ?? 10) + '/' + (c.maxHp || 10) + '</div><div class="party-stat-lbl">ХП</div></div>' +
                        '<div><div class="party-stat-val">' + CAC(c) + '</div><div class="party-stat-lbl">КБ</div></div>' +
                        '<div><div class="party-stat-val">' + slotsTxt + '</div><div class="party-stat-lbl">Ячейки</div></div>' +
                    '</div>' +
                    '<div style="display:flex; gap:6px; margin-left:10px;" onclick="event.stopPropagation();">' +
                        `<button class="btn-small" onclick="GM_REQUEST_ACCESS(${idx}, 'sheet')">📋 Лист</button>` +
                        `<button class="btn-small btn-save" onclick="GM_REQUEST_ACCESS(${idx}, 'inventory')">🎒 Рюкзак</button>` +
                    '</div>';
                con.appendChild(d);
            });
            return;
        }

        // Режим Игрока
        const others = partyIndices.filter(idx => idx !== PI);
        if (!others.length) {
            con.innerHTML = '<p style="color:#888;text-align:center;">В этой комнате пока нет других персонажей</p>';
        } else {
            others.forEach(idx => {
                const c = GET_CHAR_FOR_ROOM(cs[idx], rc);
                if (!c) return;
                const maxS = GET_SPELL_SLOTS(c);
                const usedS = c.usedSpellSlots || {};
                let totM = 0, totU = 0;
                for (let k = 1; k <= 9; k++) { if (maxS[k] > 0) { totM += maxS[k]; totU += (usedS[k] || 0); } }
                const slotsTxt = totM > 0 ? `${totM - totU}/${totM}` : '—';

                const d = document.createElement('div');
                d.className = 'party-member';
                const ah = c.avatar ? '<img class="party-avatar" src="' + c.avatar + '" alt="">' : '<div class="party-avatar-placeholder">?</div>';
                const combatBadge = c.inCombat ? ' <span style="color:#e06060;font-size:0.8em;">⚔️ В бою</span>' : '';
                d.innerHTML = ah +
                    '<div class="party-info">' +
                        '<div class="party-name">' + (c.name || 'Безымянный') + combatBadge + '</div>' +
                        '<div class="party-detail">' + (c.race || 'Раса') + ' | ' + (c.className || 'Класс') + ' (Ур. ' + (c.level || 1) + ')</div>' +
                    '</div>' +
                    '<div class="party-stats">' +
                        '<div><div class="party-stat-val">' + (c.hp ?? 10) + '/' + (c.maxHp || 10) + '</div><div class="party-stat-lbl">ХП</div></div>' +
                        '<div><div class="party-stat-val">' + CAC(c) + '</div><div class="party-stat-lbl">КБ</div></div>' +
                        '<div><div class="party-stat-val">' + slotsTxt + '</div><div class="party-stat-lbl">Ячейки</div></div>' +
                    '</div>';
                con.appendChild(d);
            });
        }

        // Панель теста мультиплеера (admin.js сам уберёт её у обычных игроков)
        const switcher = document.createElement('div');
        switcher.style.cssText = 'margin-top:10px; padding-top:8px; border-top:1px dashed #333; font-size:0.78em; color:#888; text-align:center;';
        let optionsHtml = '';
        partyIndices.forEach((idx, pos) => {
            const m = cs[idx];
            optionsHtml += `<option value="${idx}" ${idx === PI ? 'selected' : ''}>👤 Игрок ${pos + 1}: ${m.name || 'Персонаж ' + (pos + 1)}</option>`;
        });
        switcher.innerHTML = `
            <div style="margin-bottom:4px;">🔧 <b>Тест мультиплеера (в пределах комнаты #${rc || '—'}):</b></div>
            <div style="display:flex; gap:4px; justify-content:center; flex-wrap:wrap;">
                <select onchange="SWITCH_ACTIVE_PLAYER(parseInt(this.value))" style="background:#1a1a1a; color:#c9a96e; border:1px solid #444; padding:3px 6px; border-radius:4px; width:auto;">
                    ${optionsHtml}
                </select>
                <button class="btn-small" style="padding:3px 7px;" onclick="ADD_TEST_PARTY_MEMBER()">+ Союзник</button>
                ${partyIndices.length > 1 ? '<button class="btn-small btn-danger" style="padding:3px 7px;" onclick="REMOVE_LAST_PARTY_MEMBER()">− Убрать</button>' : ''}
            </div>
        `;
        con.appendChild(switcher);
    };

    // 9. Счётчик игроков в шапке Гейм-Мастера
    const _ORIG_APPLY_ROLE_ROOMS = window.APPLY_ROLE_VIEW;
    window.APPLY_ROLE_VIEW = function() {
        const sess = GET_SESSION();
        if (sess && sess.roomCode && typeof window.SWITCH_FIREBASE_ROOM === 'function') {
            window.SWITCH_FIREBASE_ROOM(String(sess.roomCode));
        }
        _ORIG_APPLY_ROLE_ROOMS();

        if (sess && sess.role === 'gm') {
            const bar = document.getElementById('role-status-bar');
            if (bar) {
                const spans = bar.querySelectorAll('span');
                spans.forEach(sp => {
                    if (sp.textContent && sp.textContent.includes('Игроков в отряде:')) {
                        const cnt = GET_ROOM_PARTY_INDICES(sess.roomCode).length;
                        sp.innerHTML = `(Игроков в комнате: <b id="gm-room-party-count">${cnt}</b>)`;
                    }
                });
            }
        }
    };

    // 10. Пульт Мастера слева: статус боя только по текущей комнате
    window.RENDER_GM_LEFT_COLUMN = function() {
        const gmLeftMenu = document.getElementById('gm-left-menu');
        if (!gmLeftMenu) return;
        gmLeftMenu.style.flex = '0 0 340px';
        gmLeftMenu.style.width = '340px';

        const rc = CUR_ROOM();
        const cs = GC();
        const partyIdx = GET_ROOM_PARTY_INDICES(rc);
        const anyInCombat = partyIdx.some(i => GET_CHAR_FOR_ROOM(cs[i], rc)?.inCombat);
        const curTasks = localStorage.getItem('dnd_tasks') || 'Задачи не добавлены.';
        const shop = GET_SHOP_STATE();

        gmLeftMenu.innerHTML = `
            <div class="panel" style="text-align:center;">
                <h2>👑 Пульт Мастера</h2>
                <div style="display:flex; flex-direction:column; gap:8px; margin-top:10px;">
                    <button onclick="OPEN_GM_EVENTS_MODAL()">⚡ События (Заготовки / На ходу)</button>
                    <button onclick="OPEN_GM_SKILL_CHECK_MODAL()">🎯 Запросить проверку (Бросок)</button>
                    <button onclick="OPEN_GM_REWARD_MODAL()">🎁 Выдать Награду (Лут / XP)</button>
                    <button onclick="OPEN_GM_SHOP_MODAL()">🏪 Лавка Торговца ${shop.active ? '🟢' : ''}</button>
                    <button onclick="OPEN_GM_DICE_MODAL()">🎲 Кубики Мастера</button>
                    <button class="btn-rest" onclick="OPEN_GM_NOTES_MODAL()">📓 Блокнот Мастера и Бэкап</button>
                </div>
            </div>

            <div class="panel">
                <h2>📋 Задачи отряда</h2>
                <div onclick="OPEN_GM_TASKS_MODAL()" style="background:#161514; border:1px solid #38332c; padding:12px; border-radius:8px; min-height:70px; font-size:0.92rem; white-space:pre-wrap; cursor:pointer; color:#d8d4cc;">${curTasks}</div>
                <button class="btn-small" style="width:100%; margin-top:8px;" onclick="OPEN_GM_TASKS_MODAL()">✏️ Изменить задачи</button>
            </div>

            <button onclick="OPEN_GM_LORE_MODAL()">📖 Лорбук (Редактор Мастера)</button>
            <button class="${anyInCombat ? 'btn-danger' : 'btn-save'}" onclick="GM_TOGGLE_PARTY_COMBAT()">
                ${anyInCombat ? '🏳️ Завершить БОЙ у отряда' : '⚔️ Начать БОЙ для отряда'}
            </button>
            <button class="btn-rest" onclick="EXECUTE_LONG_REST_FOR_PARTY()">🌙 Провести Длинный отдых отряду</button>
        `;
    };

    // 11. Бой, хил и открытие листа игрока Гейм-Мастером — строго для текущей комнаты
    window.GM_TOGGLE_PARTY_COMBAT = function() {
        const rc = CUR_ROOM();
        const cs = GC();
        const partyIdx = GET_ROOM_PARTY_INDICES(rc);
        const targetState = !partyIdx.some(i => GET_CHAR_FOR_ROOM(cs[i], rc)?.inCombat);
        partyIdx.forEach(i => {
            MUTATE_HERO_IN_ROOM(cs[i], rc, (ch) => { ch.inCombat = targetState; });
        });
        SC(cs);
        if (targetState) {
            CANCEL_REST_POLL_IF_COMBAT('Гейм-Мастер');
            LOG_COMBAT_TO_CHAT('⚔️ Гейм-Мастер объявил начало БОЯ для всего отряда!');
        } else {
            LOG_COMBAT_TO_CHAT('🕊️ Гейм-Мастер завершил бой. Отряд переходит в мирный режим.');
        }
        RENDER_GM_LEFT_COLUMN();
        RPL();
    };

    const _ORIG_EXEC_GM_OPEN = window.EXECUTE_GM_OPEN_TARGET;
    window.EXECUTE_GM_OPEN_TARGET = function(charIdx, targetType) {
        const rc = CUR_ROOM();
        const cs = GC();
        if (rc && cs[charIdx] && String(cs[charIdx]._activeRoomCode || '') !== String(rc)) {
            LOAD_HERO_STATE_FOR_ROOM(cs[charIdx], rc);
            SC(cs);
        }
        return _ORIG_EXEC_GM_OPEN(charIdx, targetType);
    };

    window.GM_FULL_RESTORE_CHAR = function(charIdx) {
        const rc = CUR_ROOM();
        const cs = GC();
        const c = cs[charIdx];
        if (!c) return;
        MUTATE_HERO_IN_ROOM(c, rc, (ch) => {
            ch.hp = ch.maxHp || 10;
            ch.tempHP = 0;
            ch.usedSpellSlots = {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0};
            ch.usedSpells = {};
            ch.spentHitDice = 0;
            ch.shortRestsUsed = 0;
        });
        SC(cs);
        RPL();
        RENDER_MAP_AREA();
        LOG_COMBAT_TO_CHAT(`👑 Мастер полностью восстановил ХП и ячейки персонажу «${c.name}»!`);
    };

    // 12. Фишки игроков на карте — только из текущей комнаты
    window.GM_SPAWN_PARTY_TOKENS = function() {
        const rc = CUR_ROOM();
        const st = GET_MAP_STATE();
        const cs = GC();
        const partyIdx = GET_ROOM_PARTY_INDICES(rc);
        if (!st.tokens) st.tokens = [];
        st.tokens = st.tokens.filter(t => !t.isPlayer);
        partyIdx.forEach((idx, pos) => {
            const c = GET_CHAR_FOR_ROOM(cs[idx], rc);
            if (!c) return;
            st.tokens.push({
                id: Date.now() + idx,
                isPlayer: true,
                charIdx: idx,
                name: c.name || ('Герой ' + (pos + 1)),
                icon: '🛡️',
                avatar: c.avatar || '',
                x: 25 + (pos * 12) % 55,
                y: 72,
                hp: c.hp ?? 10,
                maxHp: c.maxHp || 10,
                ac: CAC(c),
                init: Math.floor(Math.random() * 20) + 1 + GM(c.dex || 10)
            });
        });
        SAVE_MAP_STATE(st);
        RENDER_MAP_AREA();
        if (document.getElementById('gm-tool-modal')?.classList.contains('active')) {
            OPEN_GM_BESTIARY_MODAL();
        }
    };

    // 13. Награды, проверки навыков и Бестиарий — только игроки текущей комнаты
    window.OPEN_GM_REWARD_MODAL = function() {
        const rc = CUR_ROOM();
        const cs = GC();
        const partyIdx = GET_ROOM_PARTY_INDICES(rc);
        const cont = document.getElementById('gm-tool-modal-content');
        cont.style.maxWidth = '720px';

        let targetOpts = `<option value="all">👥 Всему отряду этой комнаты (${partyIdx.length} чел.)</option>`;
        partyIdx.forEach(idx => {
            const c = GET_CHAR_FOR_ROOM(cs[idx], rc);
            targetOpts += `<option value="${idx}">👤 Только игроку: ${c.name || 'Герой ' + (idx + 1)}</option>`;
        });

        let datalistOptions = '';
        if (gameData.items && gameData.items.catalog) {
            gameData.items.catalog.forEach(item => { datalistOptions += `<option value="${item.name}">${item.name}</option>`; });
        }

        cont.innerHTML = `
            <h2>🎁 Выдать Награду (Предмет, Золото или Опыт)</h2>
            <p style="color:#aba498; font-size:0.9rem; margin-bottom:14px;">
                Награда выдаётся только участникам текущей комнаты #${rc || '—'}.
            </p>
            <datalist id="gm-reward-items">${datalistOptions}</datalist>
            <div style="background:#181715; border:1px solid #423c33; padding:18px; border-radius:10px; display:flex; flex-direction:column; gap:12px;">
                <div>
                    <label style="color:#c9a96e;">Кому вручить награду:</label>
                    <select id="gm-rew-target" style="margin-top:4px; text-align:left;">${targetOpts}</select>
                </div>
                <div style="display:flex; gap:10px;">
                    <div style="flex:2;">
                        <label style="color:#c9a96e;">Предмет (из базы D&D или свой):</label>
                        <input type="text" id="gm-rew-item" list="gm-reward-items" placeholder="Напр.: Зелье лечения, Старинный ключ..." style="margin-top:4px; text-align:left;">
                    </div>
                    <div style="flex:1;">
                        <label style="color:#c9a96e;">Кол-во шт.:</label>
                        <input type="number" id="gm-rew-qty" value="1" min="1" style="margin-top:4px;">
                    </div>
                </div>
                <div style="display:flex; gap:10px;">
                    <div style="flex:1;">
                        <label style="color:#c9a96e;">🪙 Золото (+зм):</label>
                        <input type="number" id="gm-rew-gold" value="0" min="0" style="margin-top:4px;">
                    </div>
                    <div style="flex:1;">
                        <label style="color:#c9a96e;">✨ Опыт (+XP):</label>
                        <input type="number" id="gm-rew-xp" value="0" min="0" step="50" style="margin-top:4px;">
                    </div>
                </div>
                <button class="btn-save" style="padding:12px;" onclick="GM_SEND_REWARD()">🎁 Вручить награду</button>
            </div>
            <div style="margin-top:16px; text-align:right;"><button onclick="CM('gm-tool-modal')">Закрыть</button></div>
        `;
        OM('gm-tool-modal');
    };

    window.GM_SEND_REWARD = function() {
        const rc = CUR_ROOM();
        const target = document.getElementById('gm-rew-target')?.value || 'all';
        const itemName = document.getElementById('gm-rew-item')?.value.trim() || '';
        const qty = Math.max(1, parseInt(document.getElementById('gm-rew-qty')?.value) || 1);
        const gold = Math.max(0, parseInt(document.getElementById('gm-rew-gold')?.value) || 0);
        const xp = Math.max(0, parseInt(document.getElementById('gm-rew-xp')?.value) || 0);

        if (!itemName && !gold && !xp) {
            showMessage('Ошибка', 'Укажите хотя бы предмет, золото или опыт.');
            return;
        }

        const cs = GC();
        const indices = target === 'all' ? GET_ROOM_PARTY_INDICES(rc) : [parseInt(target)];
        const norm = (s) => (s || '').toLowerCase().replace(/ё/g, 'е').trim();

        indices.forEach(i => {
            if (!cs[i]) return;
            MUTATE_HERO_IN_ROOM(cs[i], rc, (ch) => {
                if (itemName) {
                    if (!ch.inventory) ch.inventory = [];
                    const existing = ch.inventory.find(it => !it.equipped && norm(it.name) === norm(itemName));
                    if (existing) existing.qty = String((parseInt(existing.qty) || 1) + qty);
                    else ch.inventory.push(CREATE_ITEM_OBJECT(itemName, String(qty), '', 'Награда от Гейм-Мастера'));
                }
                if (gold > 0) {
                    if (!ch.money) ch.money = { gp: 0, sp: 0, cp: 0 };
                    ch.money.gp = (parseInt(ch.money.gp) || 0) + gold;
                }
                if (xp > 0) {
                    ch.xp = (parseInt(ch.xp) || 0) + xp;
                }
            });
        });

        SC(cs);
        RPL();

        const parts = [];
        if (itemName) parts.push(`📦 Предмет: <b>${itemName} (×${qty})</b>`);
        if (gold > 0) parts.push(`🪙 Золото: <b>+${gold} зм</b>`);
        if (xp > 0) parts.push(`✨ Опыт: <b>+${xp} XP</b>`);

        const evObj = { id: Date.now(), target, title: '🎁 Получена награда!', text: parts.join('<br>') };
        localStorage.setItem('dnd_gm_event', JSON.stringify(evObj));
        LOG_COMBAT_TO_CHAT(`🎁 Гейм-Мастер выдал награду (${parts.join(', ').replace(/<\/?b>/g, '')})!`);
        CM('gm-tool-modal');
        showMessage('✅ Награда вручена', parts.join('<br>'));
    };

    const _ORIG_SKILL_CHECK_MODAL = window.OPEN_GM_SKILL_CHECK_MODAL;
    window.OPEN_GM_SKILL_CHECK_MODAL = function() {
        _ORIG_SKILL_CHECK_MODAL();
        const sel = document.getElementById('gm-check-target');
        if (!sel) return;
        const rc = CUR_ROOM();
        const cs = GC();
        const partyIdx = GET_ROOM_PARTY_INDICES(rc);
        let opts = `<option value="all">👥 Всему отряду этой комнаты (${partyIdx.length} чел.)</option>`;
        partyIdx.forEach(idx => {
            const c = GET_CHAR_FOR_ROOM(cs[idx], rc);
            opts += `<option value="${idx}">👤 Только: ${c.name || 'Игрок ' + (idx + 1)}</option>`;
        });
        sel.innerHTML = opts;
    };

    const _ORIG_BESTIARY_MODAL = window.OPEN_GM_BESTIARY_MODAL;
    window.OPEN_GM_BESTIARY_MODAL = function(highlightTokIdx = -1) {
        _ORIG_BESTIARY_MODAL(highlightTokIdx);
        const rc = CUR_ROOM();
        const cs = GC();
        const partyIdx = GET_ROOM_PARTY_INDICES(rc);
        const opts = partyIdx.map(i => {
            const c = GET_CHAR_FOR_ROOM(cs[i], rc);
            return `<option value="${i}">🎯 ${c.name || 'Герой'} (ХП: ${c.hp ?? 10}/${c.maxHp || 10}, КБ: ${CAC(c)})</option>`;
        }).join('');
        document.querySelectorAll('select[id^="gm-monster-target-"]').forEach(sel => {
            sel.innerHTML = opts || '<option value="">Нет игроков в комнате</option>';
        });
    };

    window.GM_MONSTER_ATTACK_PLAYER = function(tIdx) {
        const rc = CUR_ROOM();
        const st = GET_MAP_STATE();
        const tok = st.tokens && st.tokens[tIdx];
        if (!tok) return;

        const targetSelect = document.getElementById('gm-monster-target-' + tIdx);
        const charIdx = parseInt(targetSelect?.value);
        const cs = GC();
        if (isNaN(charIdx) || !cs[charIdx]) return;

        const targetView = GET_CHAR_FOR_ROOM(cs[charIdx], rc);
        const targetAC = CAC(targetView);
        const d20 = Math.floor(Math.random() * 20) + 1;
        const atkBonus = parseInt(tok.atkBonus) || 0;
        const totalAtk = d20 + atkBonus;
        const isCrit = (d20 === 20);
        const isHit = isCrit || (d20 !== 1 && totalAtk >= targetAC);

        if (isHit) {
            let dmg = Math.max(1, ROLL(tok.dmgFormula || '1к6+2'));
            if (isCrit) dmg += Math.max(1, ROLL(tok.dmgFormula || '1к6'));
            let leftHp = 0, maxHp = targetView.maxHp || 10;
            MUTATE_HERO_IN_ROOM(cs[charIdx], rc, (ch) => {
                ch.hp = Math.max(0, (ch.hp ?? 10) - dmg);
                leftHp = ch.hp;
                maxHp = ch.maxHp || 10;
            });
            SC(cs);
            RPL();
            RENDER_MAP_AREA();
            const critTxt = isCrit ? ' 💥 КРИТ 20!' : '';
            LOG_COMBAT_TO_CHAT(`👹 «${tok.name}» атакует «${targetView.name}»! Попадание: ${d20}${MS(atkBonus)} = ${totalAtk} (против КБ ${targetAC})${critTxt} -> Нанесено ${dmg} урона! (У ${targetView.name} осталось ${leftHp}/${maxHp} ХП)`);
        } else {
            LOG_COMBAT_TO_CHAT(`👹 «${tok.name}» атакует «${targetView.name}», но ПРОМАХИВАЕТСЯ! Бросок: ${d20}${MS(atkBonus)} = ${totalAtk} (нужен КБ ${targetAC}).`);
        }
        OPEN_GM_BESTIARY_MODAL(tIdx);
    };

    // 14. Длинный и Короткий отдых — голосование и восстановление ТОЛЬКО в пределах текущей комнаты
    window.SLR = function() {
        const rc = CUR_ROOM();
        const cs = GC();
        const c = cs[PI];
        if (!c) return;
        const partyIdx = GET_ROOM_PARTY_INDICES(rc);

        const fightingIdx = partyIdx.find(i => GET_CHAR_FOR_ROOM(cs[i], rc)?.inCombat);
        if (c.inCombat || fightingIdx !== undefined) {
            const fighter = fightingIdx !== undefined ? GET_CHAR_FOR_ROOM(cs[fightingIdx], rc) : c;
            const who = c.inCombat ? 'Вы находитесь в бою!' : `Участник отряда «${fighter.name}» сейчас находится в бою!`;
            showMessage('⚔️ Отдых невозможен', `${who}<br><br>Нельзя разбить лагерь или начать голосование за Длинный отдых, пока идёт сражение.`);
            return;
        }

        const poll = GET_REST_POLL();
        const totalPlayers = Math.max(1, partyIdx.length);
        const neededMajority = Math.floor(totalPlayers / 2) + 1;

        if (totalPlayers === 1) {
            document.getElementById('rest-content').innerHTML = `
                <h2>🌙 Лагерь: Длинный отдых</h2>
                <div style="background:#1a1a1a; padding:12px; border-radius:6px; border:1px solid #444; margin-bottom:15px; font-size:0.9em; color:#ccc; text-align:left;">
                    <b>Эффекты Длинного отдыха (D&D 5e / BG3):</b><br>
                    • Полное восстановление <b>ХП (100%)</b> и снятие Временных ХП<br>
                    • Восстановление <b>всех ячеек заклинаний (1–9 круг)</b> и Арканумов<br>
                    • Восстановление <b>Костей Хитов</b> и лимита <b>Коротких отдыхов (2/2)</b>
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
                <div style="background:#1a1a1a; padding:12px; border-radius:6px; border:1px solid #444; margin-bottom:15px; font-size:0.9em; color:#ccc; text-align:left;">
                    <b>Эффекты Длинного отдыха:</b><br>
                    • Полное восстановление <b>ХП</b>, <b>Костей Хитов</b> и <b>всех ячеек заклинаний</b> всему отряду комнаты.<br><br>
                    <span style="color:#c9a96e;">👥 В этой комнате <b>${totalPlayers} чел.</b> Для отдыха требуется согласие большинства (минимум <b>${neededMajority} из ${totalPlayers}</b>).</span>
                </div>
                <button class="btn-save" style="padding:8px 16px;" onclick="START_LONG_REST_POLL()">📣 Начать голосование за Длинный отдых</button>
                <button onclick="CM('rest-modal')">Отмена</button>
            `;
            OM('rest-modal');
            return;
        }

        let yesVotes = 0;
        let statusRows = '';
        partyIdx.forEach(idx => {
            const m = GET_CHAR_FOR_ROOM(cs[idx], rc);
            const v = poll.votes[idx];
            if (v === 'yes') yesVotes++;
            const badge = v === 'yes' ? '<span style="color:#4caf50;">✅ Согласен</span>' : (v === 'no' ? '<span style="color:#e06060;">❌ Против</span>' : '<span style="color:#c9a96e;">⏳ Голосует...</span>');
            statusRows += `<div style="display:flex; justify-content:space-between; padding:6px 10px; background:#252525; border-radius:4px; margin-bottom:4px;"><span><b>${m.name || 'Игрок'}</b></span>${badge}</div>`;
        });

        document.getElementById('rest-content').innerHTML = `
            <h2>🏕️ Идёт голосование за Длинный отдых...</h2>
            <p style="color:#aaa; font-size:0.9em;">Инициатор: <b style="color:#c9a96e;">${poll.initiatorName}</b> | Голосов ЗА: <b>${yesVotes} / ${totalPlayers}</b> (нужно ${neededMajority})</p>
            <div style="margin:12px 0; text-align:left;">${statusRows}</div>
            <button class="btn-danger" onclick="CANCEL_LONG_REST_POLL()">Отозвать голосование</button>
            <button onclick="CM('rest-modal')">Свернуть окно</button>
        `;
        OM('rest-modal');
    };

    window.START_LONG_REST_POLL = function() {
        const rc = CUR_ROOM();
        const cs = GC();
        const c = cs[PI];
        if (!c) return;
        const partyIdx = GET_ROOM_PARTY_INDICES(rc);

        if (partyIdx.some(i => GET_CHAR_FOR_ROOM(cs[i], rc)?.inCombat)) {
            showMessage('⚔️ Бой!', 'Кто-то из отряда находится в бою. Голосование невозможно.');
            return;
        }

        const initiatorName = c.name || ('Игрок ' + (PI + 1));
        SAVE_REST_POLL({ active: true, initiatorIdx: PI, initiatorName, votes: { [PI]: 'yes' } });
        CM('rest-modal');

        const totalPlayers = Math.max(1, partyIdx.length);
        const needed = Math.floor(totalPlayers / 2) + 1;
        LOG_COMBAT_TO_CHAT(`🏕️ предлагает разбить лагерь для Длинного отдыха! Запущено голосование (ЗА: 1/${totalPlayers}, нужно: ${needed}).`);
        CHECK_POLL_RESOLUTION();
        CHECK_AND_RENDER_REST_POPUP();
    };

    window.CAST_REST_POLL_VOTE = function(voteVal) {
        const rc = CUR_ROOM();
        const cs = GC();
        const poll = GET_REST_POLL();
        if (!poll || !poll.active) return;
        const partyIdx = GET_ROOM_PARTY_INDICES(rc);

        const fightingIdx = partyIdx.find(i => GET_CHAR_FOR_ROOM(cs[i], rc)?.inCombat);
        if (fightingIdx !== undefined) {
            const fName = GET_CHAR_FOR_ROOM(cs[fightingIdx], rc)?.name || 'Игрок';
            CANCEL_REST_POLL_IF_COMBAT(fName);
            showMessage('⚔️ Отряд в бою!', `Голосование прервано, так как ${fName} вступил в бой.`);
            return;
        }

        poll.votes[PI] = voteVal;
        SAVE_REST_POLL(poll);

        const totalPlayers = Math.max(1, partyIdx.length);
        const yesCount = partyIdx.filter(i => poll.votes[i] === 'yes').length;
        LOG_COMBAT_TO_CHAT(`${voteVal === 'yes' ? '✅ голосует ЗА Длинный отдых' : '❌ голосует ПРОТИВ Длинного отдыха'} (Голосов ЗА: ${yesCount}/${totalPlayers})`);
        CHECK_AND_RENDER_REST_POPUP();
        CHECK_POLL_RESOLUTION();
    };

    window.CHECK_POLL_RESOLUTION = function() {
        const rc = CUR_ROOM();
        const cs = GC();
        const poll = GET_REST_POLL();
        if (!poll || !poll.active) return;
        const partyIdx = GET_ROOM_PARTY_INDICES(rc);

        const totalPlayers = Math.max(1, partyIdx.length);
        const neededMajority = Math.floor(totalPlayers / 2) + 1;
        let yesVotes = 0, noVotes = 0, votedCount = 0;

        partyIdx.forEach(i => {
            if (poll.votes[i] === 'yes') { yesVotes++; votedCount++; }
            else if (poll.votes[i] === 'no') { noVotes++; votedCount++; }
        });

        if (yesVotes >= neededMajority) {
            EXECUTE_LONG_REST_FOR_PARTY();
            return;
        }
        if (yesVotes + (totalPlayers - votedCount) < neededMajority) {
            SAVE_REST_POLL(null);
            CM('rest-modal');
            CHECK_AND_RENDER_REST_POPUP();
            LOG_COMBAT_TO_CHAT(`🚫 Голосование за Длинный отдых отклонено большинством (ЗА: ${yesVotes}, ПРОТИВ: ${noVotes}). Отряд продолжает путь!`);
            showMessage('🚫 Отдых отклонён', `Большинство игроков проголосовало против привала (ЗА: ${yesVotes}, ПРОТИВ: ${noVotes}).`);
        }
    };

    window.EXECUTE_LONG_REST_FOR_PARTY = function() {
        const rc = CUR_ROOM();
        const cs = GC();
        const partyIdx = GET_ROOM_PARTY_INDICES(rc);
        if (partyIdx.some(i => GET_CHAR_FOR_ROOM(cs[i], rc)?.inCombat)) {
            CANCEL_REST_POLL_IF_COMBAT('Участник отряда');
            return;
        }

        partyIdx.forEach(i => {
            MUTATE_HERO_IN_ROOM(cs[i], rc, (member) => {
                member.hp = member.maxHp || 10;
                member.tempHP = 0;
                member.usedSpellSlots = {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0};
                member.usedSpells = {};
                member.shortRestsUsed = 0;
                member.arcaneRecoveryUsed = false;
                member.spentHitDice = 0;
                member.deathSaveSuccess = '⬤⬤⬤';
                member.deathSaveFail = '⬤⬤⬤';
            });
        });

        SAVE_REST_POLL(null);
        SC(cs);
        CM('rest-modal');
        CHECK_AND_RENDER_REST_POPUP();
        RMC();
        RPL();
        LOG_COMBAT_TO_CHAT('🌙 Отряд провёл Длинный отдых: здоровье, Кости Хитов и все ячейки заклинаний полностью восстановлены.');
        showMessage('🌙 Длинный отдых завершён!', 'Отряд разбил лагерь и спокойно провёл ночь.<br><br>💚 <b>Здоровье (100%)</b>, <b>Кости Хитов</b>, <b>Короткие отдыхи (2/2)</b> и <b>все ячейки магии</b> полностью восстановлены!');
    };

    window.CHECK_AND_RENDER_REST_POPUP = function() {
        let popup = document.getElementById('party-rest-vote-popup');
        const sess = GET_SESSION();
        const rc = CUR_ROOM();
        const poll = GET_REST_POLL();
        const cs = GC();
        const partyIdx = GET_ROOM_PARTY_INDICES(rc);

        if (!sess || sess.role !== 'player' || !poll || !poll.active || partyIdx.length <= 1) {
            if (popup) popup.remove();
            return;
        }

        const fightingIdx = partyIdx.find(i => GET_CHAR_FOR_ROOM(cs[i], rc)?.inCombat);
        if (fightingIdx !== undefined) {
            CANCEL_REST_POLL_IF_COMBAT(GET_CHAR_FOR_ROOM(cs[fightingIdx], rc)?.name || 'Игрок');
            return;
        }

        const totalPlayers = partyIdx.length;
        const neededMajority = Math.floor(totalPlayers / 2) + 1;
        const yesVotes = partyIdx.filter(i => poll.votes[i] === 'yes').length;
        const myVote = poll.votes[PI];
        const currentPlayerName = (cs[PI] && cs[PI].name) ? cs[PI].name : ('Игрок ' + (PI + 1));

        if (!popup) {
            popup = document.createElement('div');
            popup.id = 'party-rest-vote-popup';
            popup.style.cssText = 'position:fixed; top:18px; left:50%; transform:translateX(-50%); width:420px; max-width:94vw; background:#1c1917; border:2px solid #c9a96e; border-radius:12px; padding:16px 20px; box-shadow:0 12px 34px rgba(0,0,0,0.92); z-index:9999; color:#e0e0e0; font-family:Georgia,serif; text-align:center;';
            document.body.appendChild(popup);
        }

        if (!myVote) {
            popup.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                    <span style="color:#c9a96e; font-weight:bold; font-size:1.05em;">🏕️ Голосование за Длинный отдых</span>
                    <span style="background:#3a3222; color:#c9a96e; padding:2px 7px; border-radius:10px; font-size:0.75em;">${yesVotes}/${totalPlayers} ЗА</span>
                </div>
                <p style="font-size:0.88em; color:#ccc; margin-bottom:10px; line-height:1.4;">
                    Игрок <b style="color:#fff;">${poll.initiatorName}</b> предлагает отряду разбить лагерь на ночь.<br>
                    <small style="color:#888;">Ваш персонаж: <b style="color:#c9a96e;">${currentPlayerName}</b> (нужно ${neededMajority} из ${totalPlayers} голосов)</small>
                </p>
                <div style="display:flex; gap:8px;">
                    <button class="btn-save" style="flex:1; padding:8px;" onclick="CAST_REST_POLL_VOTE('yes')">✅ Согласиться</button>
                    <button class="btn-danger" style="flex:1; padding:8px;" onclick="CAST_REST_POLL_VOTE('no')">❌ Отказаться</button>
                </div>
            `;
        } else {
            popup.innerHTML = `
                <div style="display:flex; align-items:center; justify-content:space-between;">
                    <div>
                        <div style="color:#c9a96e; font-weight:bold; font-size:0.9em;">🏕️ Ожидание отряда (${yesVotes}/${totalPlayers} ЗА)</div>
                        <small style="color:#aaa;">Вы проголосовали: <b>${myVote === 'yes' ? '✅ ЗА' : '❌ ПРОТИВ'}</b> (нужно ${neededMajority})</small>
                    </div>
                    <button class="btn-small" style="padding:4px 8px;" onclick="SLR()">Статус</button>
                </div>
            `;
        }
    };

    // 15. Внезапная атака и синхронизация фишек в бою — только для текущей комнаты
    window.SYNC_PLAYER_TOKENS_WITH_CHARS = function(st) {
        const rc = CUR_ROOM();
        const cs = GC();
        if (!st || !st.tokens) return;
        st.tokens.forEach(tok => {
            if (tok.isPlayer && cs[tok.charIdx]) {
                const ch = GET_CHAR_FOR_ROOM(cs[tok.charIdx], rc);
                tok.name = ch.name || tok.name;
                tok.hp = ch.hp ?? 10;
                tok.maxHp = ch.maxHp || 10;
                tok.ac = CAC(ch);
                tok.avatar = ch.avatar || '';
            }
        });
    };

    const _ORIG_START_AMBUSH_TOK = window.START_PLAYER_AMBUSH_TOKEN;
    window.START_PLAYER_AMBUSH_TOKEN = function(targetTokIdx) {
        const rc = CUR_ROOM();
        const cs = GC();
        const savedOtherStates = cs.map((c, idx) => ({ idx, inCombat: !!(c && c.inCombat) }));
        const partySet = new Set(GET_ROOM_PARTY_INDICES(rc));

        _ORIG_START_AMBUSH_TOK(targetTokIdx);

        // Возвращаем inCombat игрокам из других комнат, чтобы бой начался только в текущей
        const freshCs = GC();
        let restored = false;
        savedOtherStates.forEach(({ idx, inCombat }) => {
            if (!partySet.has(idx) && freshCs[idx] && freshCs[idx].inCombat !== inCombat) {
                freshCs[idx].inCombat = inCombat;
                restored = true;
            }
        });
        if (restored) SC(freshCs);
    };

    const _ORIG_START_AMBUSH = window.START_PLAYER_AMBUSH;
    window.START_PLAYER_AMBUSH = function(enemyName, icon, hp, ac) {
        const rc = CUR_ROOM();
        const cs = GC();
        const savedOtherStates = cs.map((c, idx) => ({ idx, inCombat: !!(c && c.inCombat) }));
        const partySet = new Set(GET_ROOM_PARTY_INDICES(rc));

        _ORIG_START_AMBUSH(enemyName, icon, hp, ac);

        const freshCs = GC();
        let restored = false;
        savedOtherStates.forEach(({ idx, inCombat }) => {
            if (!partySet.has(idx) && freshCs[idx] && freshCs[idx].inCombat !== inCombat) {
                freshCs[idx].inCombat = inCombat;
                restored = true;
            }
        });
        if (restored) SC(freshCs);
    };
})();