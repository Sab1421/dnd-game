// ================================================================
// ✉️ ПЛАВАЮЩИЙ МИНИ-МЕССЕНДЖЕР (ЛИЧКА ИГРОК ↔ ИГРОК И ГМ ↔ ИГРОК)
// Кнопки «✉️» в «Отряде» + «✉️ Личка» в шапке • Изоляция по комнатам
// ================================================================
(function INIT_FLOATING_WHISPERS_V2() {
    const FB_BASE_URL = "https://dnds-23b7d-default-rtdb.firebaseio.com/campaign_v2/rooms";

    window._dmWidgetState = 'closed'; // 'closed' | 'minimized' | 'open'
    window._activeDmPeerId = null;
    window._dmMessagesCache = {};     // { [roomCode]: [msg, ...] }

    let activeWhisperRoom = null;
    let activeWhisperRef = null;
    let initialRoomLoadDone = {};
    let toastTimer = null;

    function ESC_DM(str) {
        return String(str || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function ESC_JS_STR(str) {
        return String(str || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    }

    function GET_CUR_ROOM() {
        const sess = (typeof GET_SESSION === 'function') ? GET_SESSION() : null;
        return (sess && sess.roomCode) ? String(sess.roomCode) : null;
    }

    function GET_MY_DM_IDENTITY() {
        const sess = (typeof GET_SESSION === 'function') ? GET_SESSION() : null;
        if (!sess || !sess.roomCode) return null;
        if (sess.role === 'gm') {
            const gmName = (typeof GET_GM_NAME === 'function') ? GET_GM_NAME() : 'Гейм-Мастер';
            return { id: 'gm', name: `👑 ${gmName}`, shortName: gmName, isGM: true };
        }
        if (typeof SYNC_MY_PLAYER_INDEX === 'function') SYNC_MY_PLAYER_INDEX();
        const cs = GC();
        const c = cs[PI];
        const heroId = (c && c.id) ? c.id : (sess.heroId || ('idx_' + PI));
        const heroName = (c && c.name) ? c.name : 'Игрок';
        return { id: 'hero:' + heroId, name: `⚔️ ${heroName}`, shortName: heroName, isGM: false };
    }

    function GET_ROOM_WHISPERS(roomCode) {
        const rc = String(roomCode || GET_CUR_ROOM() || '');
        if (!rc) return [];
        return window._dmMessagesCache[rc] || [];
    }

    function SEEN_STORAGE_KEY(rc, myId) {
        return `dnd_dm_seen_v1_${rc}_${myId}`;
    }

    function GET_SEEN_MAP(rc, myId) {
        try {
            const raw = localStorage.getItem(SEEN_STORAGE_KEY(rc, myId));
            return raw ? JSON.parse(raw) : {};
        } catch (e) { return {}; }
    }

    function MARK_PEER_READ(rc, myId, peerId, tsVal) {
        if (!rc || !myId || !peerId) return;
        const map = GET_SEEN_MAP(rc, myId);
        const nextTs = Math.max(map[peerId] || 0, tsVal || Date.now());
        if (map[peerId] === nextTs) return;
        map[peerId] = nextTs;
        try { localStorage.setItem(SEEN_STORAGE_KEY(rc, myId), JSON.stringify(map)); } catch (e) {}
    }

    function GET_DM_PEERS() {
        const rc = GET_CUR_ROOM();
        const me = GET_MY_DM_IDENTITY();
        if (!rc || !me) return [];

        const map = new Map();
        const addPeer = (id, name, isGM) => {
            if (!id || id === me.id) return;
            if (!map.has(id)) map.set(id, { id, name, isGM: !!isGM });
        };

        // Для игрока Мастер всегда первый в списке
        if (!me.isGM) {
            addPeer('gm', '👑 Гейм-Мастер', true);
        }

        const cs = GC();
        const indices = (typeof GET_ROOM_PARTY_INDICES === 'function')
            ? GET_ROOM_PARTY_INDICES(rc)
            : cs.map((_, i) => i);

        indices.forEach(idx => {
            const rawC = cs[idx];
            if (!rawC) return;
            const c = (typeof GET_CHAR_FOR_ROOM === 'function') ? GET_CHAR_FOR_ROOM(rawC, rc) : rawC;
            const pid = 'hero:' + (rawC.id || ('idx_' + idx));
            addPeer(pid, `⚔️ ${c.name || ('Герой ' + (idx + 1))}`, false);
        });

        GET_ROOM_WHISPERS(rc).forEach(m => {
            if (!m) return;
            if (m.fromId === me.id && m.toId) addPeer(m.toId, m.toName || m.toId, m.toId === 'gm');
            else if (m.toId === me.id && m.fromId) addPeer(m.fromId, m.fromName || m.fromId, m.fromId === 'gm');
        });

        return Array.from(map.values());
    }

    function GET_UNREAD_BY_PEER() {
        const rc = GET_CUR_ROOM();
        const me = GET_MY_DM_IDENTITY();
        if (!rc || !me) return { total: 0, byPeer: {} };
        const seen = GET_SEEN_MAP(rc, me.id);
        const byPeer = {};
        let total = 0;

        GET_ROOM_WHISPERS(rc).forEach(m => {
            if (!m || m.toId !== me.id) return;
            const lastSeen = seen[m.fromId] || 0;
            if ((m.ts || 0) > lastSeen) {
                byPeer[m.fromId] = (byPeer[m.fromId] || 0) + 1;
                total++;
            }
        });
        return { total, byPeer };
    }

    // --- 1. ВСПЛЫВАЮЩЕЕ УВЕДОМЛЕНИЕ О НОВОМ ЛИЧНОМ СООБЩЕНИИ ---
    function SHOW_WHISPER_TOAST(msg) {
        let box = document.getElementById('dm-whisper-toast');
        if (!box) {
            box = document.createElement('div');
            box.id = 'dm-whisper-toast';
            box.style.cssText = 'position:fixed; bottom:18px; left:18px; max-width:340px; background:linear-gradient(180deg, #2b2138 0%, #17131e 100%); border:2px solid #c084fc; border-radius:10px; padding:11px 14px; color:#f3e8ff; box-shadow:0 10px 30px rgba(0,0,0,0.9); z-index:94000; cursor:pointer; font-size:0.9rem;';
            document.body.appendChild(box);
        }
        // Если свёрнутая полоска мессенджера уже лежит внизу слева — поднимаем тост над ней
        box.style.bottom = (window._dmWidgetState === 'minimized') ? '68px' : '18px';

        const preview = msg.text.length > 80 ? msg.text.slice(0, 80) + '…' : msg.text;
        box.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:4px;">
                <b style="color:#e9d5ff;">✉️ Личное от ${ESC_DM(msg.fromName)}</b>
                <span style="color:#aaa; font-size:0.78rem;">${ESC_DM(msg.time || '')}</span>
            </div>
            <div style="color:#e2d9f3; line-height:1.35;">${ESC_DM(preview)}</div>
            <div style="color:#c084fc; font-size:0.76rem; margin-top:5px;">Нажмите, чтобы открыть и ответить</div>
        `;
        box.style.display = 'block';
        box.onclick = function() {
            box.style.display = 'none';
            window.OPEN_DM_WIDGET(msg.fromId);
        };

        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            if (box) box.style.display = 'none';
        }, 5500);
    }

    // --- 2. КНОПКИ «✉️ Личка» В ШАПКЕ И «✉️» НА КАРТОЧКАХ В ОТРЯДЕ ---
    function INJECT_DM_TOPBAR_BUTTON() {
        const bar = document.getElementById('role-status-bar');
        if (!bar || bar.style.display === 'none' || !GET_CUR_ROOM()) return;

        bar.querySelectorAll('[data-dm-ui="topbar-btn"]').forEach(el => el.remove());

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

        const btn = document.createElement('button');
        btn.className = 'btn-small';
        btn.setAttribute('data-dm-ui', 'topbar-btn');
        btn.setAttribute('onclick', 'TOGGLE_DM_WIDGET()');
        btn.title = 'Открыть личные сообщения комнаты';

        // Вставляем самым первым в правой группе кнопок (перед «📢 Обновления»)
        row.insertBefore(btn, row.firstChild);
        UPDATE_DM_BADGES();
    }

    function UPDATE_DM_BADGES() {
        const unread = GET_UNREAD_BY_PEER();

        // 1. Кнопка в верхней шапке
        const topBtn = document.querySelector('#role-status-bar [data-dm-ui="topbar-btn"]');
        if (topBtn) {
            const badge = unread.total > 0
                ? ` <span style="background:#ef4444; color:#fff; border-radius:10px; padding:1px 6px; font-size:0.74rem; margin-left:3px; font-weight:bold;">${unread.total}</span>`
                : '';
            const isOpen = (window._dmWidgetState === 'open');
            topBtn.style.cssText = `background:${isOpen ? '#6d28d9' : '#241e2e'}; color:${isOpen ? '#fff' : '#e9d5ff'}; border:1px solid ${unread.total > 0 ? '#ef4444' : '#a855f7'};`;
            topBtn.innerHTML = `✉️ Личка${badge}`;
        }

        // 2. Кнопки «✉️» на карточках в «👥 Отряд»
        document.querySelectorAll('[data-dm-peer-btn]').forEach(btn => {
            const pid = btn.getAttribute('data-dm-peer-btn');
            const cnt = unread.byPeer[pid] || 0;
            btn.style.background = cnt > 0 ? '#5b21b6' : '#241e2e';
            btn.style.borderColor = cnt > 0 ? '#ef4444' : '#7c5aa6';
            btn.style.color = '#f3e8ff';
            btn.innerHTML = cnt > 0
                ? `✉️ <span style="background:#ef4444; color:#fff; border-radius:8px; padding:0 5px; font-size:0.72rem; margin-left:2px;">${cnt}</span>`
                : '✉️';
        });
    }

    function INJECT_PARTY_DM_BUTTONS() {
        const sess = (typeof GET_SESSION === 'function') ? GET_SESSION() : null;
        const rc = GET_CUR_ROOM();
        if (!sess || !rc) return;

        const con = document.getElementById('party-list');
        if (!con) return;

        const cs = GC();
        const isGM = (sess.role === 'gm');
        const allRoomIdx = (typeof GET_ROOM_PARTY_INDICES === 'function')
            ? GET_ROOM_PARTY_INDICES(rc)
            : cs.map((_, i) => i);
        const shownIdx = (isGM ? allRoomIdx : allRoomIdx.filter(idx => idx !== PI)).filter(idx => !!cs[idx]);
        const cards = con.querySelectorAll('.party-member');

        cards.forEach((card, pos) => {
            const idx = shownIdx[pos];
            if (idx === undefined || !cs[idx]) return;
            const rawC = cs[idx];
            const pid = 'hero:' + (rawC.id || ('idx_' + idx));
            const heroName = rawC.name || ('Герой ' + (idx + 1));

            card.querySelectorAll('[data-dm-peer-btn]').forEach(b => b.remove());

            const dmBtn = document.createElement('button');
            dmBtn.className = 'btn-small';
            dmBtn.setAttribute('data-dm-peer-btn', pid);
            dmBtn.title = `Написать лично: ${heroName}`;
            dmBtn.style.cssText = 'padding:5px 9px; font-size:0.86rem; background:#241e2e; color:#f3e8ff; border:1px solid #7c5aa6; flex-shrink:0;';
            dmBtn.onclick = function(e) {
                e.stopPropagation();
                window.OPEN_DM_WIDGET(pid);
            };

            if (isGM) {
                // Вставляем рядом с «📋 Лист» и «🎒 Рюкзак»
                const btnGroup = card.querySelector('div[onclick*="stopPropagation"]');
                if (btnGroup) btnGroup.appendChild(dmBtn);
                else card.appendChild(dmBtn);
            } else {
                dmBtn.style.marginLeft = '8px';
                card.appendChild(dmBtn);
            }
        });

        UPDATE_DM_BADGES();
    }

    // --- 3. ПЛАВАЮЩИЙ МИНИ-МЕССЕНДЖЕР (В НИЖНЕМ ЛЕВОМ УГЛУ) ---
    function ENSURE_DM_WIDGET_SHELL() {
        let widget = document.getElementById('dm-floating-widget');
        if (widget) return widget;

        widget = document.createElement('div');
        widget.id = 'dm-floating-widget';
        widget.style.cssText = 'position:fixed; bottom:14px; left:14px; width:365px; max-width:calc(100vw - 28px); background:#18161c; border:2px solid #9b59b6; border-radius:12px; box-shadow:0 12px 36px rgba(0,0,0,0.92); z-index:93000; display:none; flex-direction:column; overflow:hidden; color:#ebe8e2;';

        widget.innerHTML = `
            <div id="dm-widget-header" style="background:linear-gradient(90deg, #2d2040 0%, #1d1826 100%); border-bottom:1px solid #4c366b; padding:8px 12px; display:flex; justify-content:space-between; align-items:center; gap:8px; cursor:pointer;">
                <div id="dm-widget-header-title" style="font-weight:bold; font-size:0.94rem; color:#f3e8ff; display:flex; align-items:center; gap:6px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
                    ✉️ Личка
                </div>
                <div style="display:flex; gap:4px; flex-shrink:0;" onclick="event.stopPropagation();">
                    <button id="dm-widget-clear-btn" class="btn-small btn-danger" style="display:none; padding:2px 7px; font-size:0.78rem;" title="Очистить этот диалог (Админ)" onclick="ADMIN_CLEAR_CURRENT_DM_THREAD()">🗑️</button>
                    <button id="dm-widget-min-btn" class="btn-small" style="padding:2px 8px; font-size:0.82rem; background:#262033; color:#e9d5ff; border:1px solid #5e4480;" title="Свернуть / Развернуть" onclick="MINIMIZE_OR_RESTORE_DM_WIDGET()">—</button>
                    <button class="btn-small" style="padding:2px 8px; font-size:0.82rem; background:#3b1d24; color:#fca5a5; border:1px solid #7f2d3a;" title="Закрыть" onclick="CLOSE_DM_WIDGET()">✕</button>
                </div>
            </div>

            <div id="dm-widget-body" style="display:flex; flex-direction:column; height:365px; max-height:64vh;">
                <div id="dm-widget-peers" style="display:flex; gap:5px; overflow-x:auto; padding:7px 8px; background:#121017; border-bottom:1px solid #302640; flex-shrink:0;"></div>
                <div id="dm-widget-messages" style="flex:1; overflow-y:auto; padding:10px; background:#15131a;"></div>
                <div style="display:flex; gap:6px; padding:8px; background:#121017; border-top:1px solid #302640; flex-shrink:0;">
                    <input type="text" id="dm-widget-input" placeholder="Написать сообщение..."
                           style="flex:1; padding:8px 10px; background:#1c1924; color:#fff; border:1px solid #5c447d; border-radius:7px; font-size:0.9rem; outline:none;">
                    <button id="dm-widget-send-btn" class="btn-small" style="background:linear-gradient(180deg, #8b5cf6 0%, #6d28d9 100%); color:#fff; border-color:#c084fc; padding:0 13px; font-size:0.95rem;" onclick="SEND_FROM_DM_WIDGET()">➤</button>
                </div>
            </div>
        `;

        widget.querySelector('#dm-widget-header').addEventListener('click', () => {
            if (window._dmWidgetState === 'minimized') {
                window.OPEN_DM_WIDGET(window._activeDmPeerId);
            }
        });

        const inp = widget.querySelector('#dm-widget-input');
        inp.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                window.SEND_FROM_DM_WIDGET();
            }
        });

        document.body.appendChild(widget);
        return widget;
    }

    function RENDER_DM_WIDGET_CONTENT() {
        const rc = GET_CUR_ROOM();
        const me = GET_MY_DM_IDENTITY();
        const widget = ENSURE_DM_WIDGET_SHELL();

        if (!rc || !me || window._dmWidgetState === 'closed') {
            widget.style.display = 'none';
            UPDATE_DM_BADGES();
            return;
        }

        widget.style.display = 'flex';
        const body = document.getElementById('dm-widget-body');
        const minBtn = document.getElementById('dm-widget-min-btn');
        const titleEl = document.getElementById('dm-widget-header-title');
        const clearBtn = document.getElementById('dm-widget-clear-btn');
        const peersEl = document.getElementById('dm-widget-peers');
        const msgsEl = document.getElementById('dm-widget-messages');
        const inp = document.getElementById('dm-widget-input');
        const sendBtn = document.getElementById('dm-widget-send-btn');

        const peers = GET_DM_PEERS();
        const unread = GET_UNREAD_BY_PEER();

        if (peers.length > 0 && (!window._activeDmPeerId || !peers.some(p => p.id === window._activeDmPeerId))) {
            const unreadPeer = peers.find(p => unread.byPeer[p.id] > 0);
            window._activeDmPeerId = unreadPeer ? unreadPeer.id : peers[0].id;
        }
        const activePeer = peers.find(p => p.id === window._activeDmPeerId) || null;

        if (window._dmWidgetState === 'minimized') {
            widget.style.width = '290px';
            body.style.display = 'none';
            if (minBtn) minBtn.textContent = '▢';
            if (clearBtn) clearBtn.style.display = 'none';
            const badge = unread.total > 0
                ? `<span style="background:#ef4444; color:#fff; border-radius:10px; padding:1px 6px; font-size:0.74rem;">+${unread.total}</span>`
                : '';
            titleEl.innerHTML = `✉️ Личка${activePeer ? ': ' + ESC_DM(activePeer.name) : ''} ${badge}`;
            UPDATE_DM_BADGES();
            return;
        }

        // Развёрнутое состояние
        widget.style.width = '365px';
        body.style.display = 'flex';
        if (minBtn) minBtn.textContent = '—';

        const isAdmin = (typeof window.IS_ADMIN === 'function') ? window.IS_ADMIN() : false;
        if (clearBtn) clearBtn.style.display = (isAdmin && activePeer) ? 'inline-block' : 'none';

        titleEl.innerHTML = activePeer
            ? `🤫 ${ESC_DM(activePeer.name)} <small style="color:#a78bfa; font-weight:normal; font-size:0.76rem !important;">(лично)</small>`
            : '✉️ Личные сообщения';

        // Полоска собеседников
        if (!peers.length) {
            peersEl.innerHTML = '<span style="color:#888; font-size:0.8rem; padding:2px 4px;">В комнате пока нет собеседников</span>';
            msgsEl.innerHTML = '<div style="color:#777; text-align:center; padding-top:46px; font-size:0.88rem;">Как только в комнату зайдут игроки, их имена появятся здесь и в блоке «Отряд».</div>';
            if (inp) { inp.disabled = true; inp.placeholder = 'Нет получателя...'; }
            if (sendBtn) sendBtn.disabled = true;
            UPDATE_DM_BADGES();
            return;
        }

        if (inp) {
            inp.disabled = false;
            inp.placeholder = `Лично для «${activePeer.name.replace(/^[^\s]+\s/, '')}»...`;
        }
        if (sendBtn) sendBtn.disabled = false;

        // Помечаем входящие в активном открытом диалоге прочитанными
        const thread = GET_ROOM_WHISPERS(rc).filter(m =>
            (m.fromId === me.id && m.toId === activePeer.id) ||
            (m.fromId === activePeer.id && m.toId === me.id)
        );
        const incoming = thread.filter(m => m.fromId === activePeer.id && m.toId === me.id);
        if (incoming.length > 0) {
            const maxTs = Math.max(...incoming.map(m => m.ts || 0));
            MARK_PEER_READ(rc, me.id, activePeer.id, maxTs);
        }

        // Пересчитываем непрочитанные после отметки прочтения
        const freshUnread = GET_UNREAD_BY_PEER();

        peersEl.innerHTML = peers.map(p => {
            const isSel = activePeer && p.id === activePeer.id;
            const cnt = freshUnread.byPeer[p.id] || 0;
            const b = cnt > 0 ? ` <span style="background:#ef4444; color:#fff; border-radius:8px; padding:0 5px; font-size:0.72rem;">${cnt}</span>` : '';
            return `
                <button class="btn-small" onclick="SELECT_DM_PEER('${ESC_JS_STR(p.id)}')"
                    style="padding:4px 9px; font-size:0.78rem; white-space:nowrap; flex-shrink:0; background:${isSel ? '#7c3aed' : '#221d2b'}; color:${isSel ? '#fff' : '#d8d4cc'}; border:1px solid ${isSel ? '#e9d5ff' : (cnt > 0 ? '#ef4444' : '#433557')};">
                    ${ESC_DM(p.name)}${b}
                </button>`;
        }).join('');

        // Сообщения
        if (!thread.length) {
            msgsEl.innerHTML = `
                <div style="color:#888; text-align:center; padding-top:46px; font-size:0.86rem; line-height:1.45;">
                    🤫 Начало личной переписки с <b style="color:#e9d5ff;">${ESC_DM(activePeer.name)}</b>.<br>
                    <small style="color:#666;">Эти сообщения видите только вы вдвоём.</small>
                </div>`;
        } else {
            msgsEl.innerHTML = thread.map(m => {
                const isMine = (m.fromId === me.id);
                const boxStyle = isMine
                    ? 'padding:6px 10px; margin-bottom:7px; margin-left:28px; background:#1f2e22; border-right:3px solid #52b758; border-radius:8px 2px 8px 8px; font-size:0.88rem; color:#e6f4ea; word-break:break-word; line-height:1.35;'
                    : 'padding:6px 10px; margin-bottom:7px; margin-right:28px; background:#271e36; border-left:3px solid #c084fc; border-radius:2px 8px 8px 8px; font-size:0.88rem; color:#f3e8ff; word-break:break-word; line-height:1.35;';
                return `
                    <div style="${boxStyle}">
                        <div style="display:flex; justify-content:space-between; gap:8px; font-size:0.73rem; color:${isMine ? '#86efac' : '#d8b4fe'}; margin-bottom:2px;">
                            <b>${isMine ? 'Вы' : ESC_DM(m.fromName)}</b>
                            <span style="color:#888;">${ESC_DM(m.time || '')}</span>
                        </div>
                        <div>${ESC_DM(m.text)}</div>
                    </div>`;
            }).join('');
            msgsEl.scrollTop = msgsEl.scrollHeight;
        }

        UPDATE_DM_BADGES();
    }

    // --- 4. ПУБЛИЧНЫЕ ДЕЙСТВИЯ ВИДЖЕТА ---
    window.OPEN_DM_WIDGET = function(peerId) {
        if (!GET_CUR_ROOM()) return;
        const toast = document.getElementById('dm-whisper-toast');
        if (toast) toast.style.display = 'none';
        if (peerId) window._activeDmPeerId = peerId;
        window._dmWidgetState = 'open';
        RENDER_DM_WIDGET_CONTENT();
        const inp = document.getElementById('dm-widget-input');
        if (inp && !inp.disabled) inp.focus();
    };

    window.TOGGLE_DM_WIDGET = function() {
        if (window._dmWidgetState === 'open') {
            window.CLOSE_DM_WIDGET();
        } else {
            window.OPEN_DM_WIDGET(window._activeDmPeerId);
        }
    };

    window.MINIMIZE_OR_RESTORE_DM_WIDGET = function() {
        window._dmWidgetState = (window._dmWidgetState === 'minimized') ? 'open' : 'minimized';
        RENDER_DM_WIDGET_CONTENT();
    };

    window.CLOSE_DM_WIDGET = function() {
        window._dmWidgetState = 'closed';
        RENDER_DM_WIDGET_CONTENT();
    };

    window.SELECT_DM_PEER = function(peerId) {
        window._activeDmPeerId = peerId;
        window._dmWidgetState = 'open';
        RENDER_DM_WIDGET_CONTENT();
        const inp = document.getElementById('dm-widget-input');
        if (inp && !inp.disabled) inp.focus();
    };

    window.SEND_FROM_DM_WIDGET = function() {
        const inp = document.getElementById('dm-widget-input');
        if (!inp) return;
        const val = inp.value.trim();
        if (!val) return;
        inp.value = '';
        window.SEND_ROOM_WHISPER(val);
        inp.focus();
    };

    window.SEND_ROOM_WHISPER = function(rawText) {
        const text = String(rawText || '').trim();
        if (!text) return;
        const rc = GET_CUR_ROOM();
        const me = GET_MY_DM_IDENTITY();
        if (!rc || !me) return;

        const peers = GET_DM_PEERS();
        if (!peers.length) return;
        let target = peers.find(p => p.id === window._activeDmPeerId);
        if (!target) {
            target = peers[0];
            window._activeDmPeerId = target.id;
        }

        const now = Date.now();
        const msg = {
            id: 'dm_' + now + '_' + Math.random().toString(36).slice(2, 7),
            fromId: me.id,
            fromName: me.name,
            toId: target.id,
            toName: target.name,
            text: text,
            time: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            ts: now
        };

        if (!window._dmMessagesCache[rc]) window._dmMessagesCache[rc] = [];
        window._dmMessagesCache[rc].push(msg);
        MARK_PEER_READ(rc, me.id, target.id, now);
        RENDER_DM_WIDGET_CONTENT();

        if (window.firebase && firebase.apps && firebase.apps.length) {
            firebase.database().ref(`campaign_v2/rooms/${rc}/whispers/${msg.id}`).set(msg).catch(() => {});
        } else {
            fetch(`${FB_BASE_URL}/${encodeURIComponent(rc)}/whispers/${encodeURIComponent(msg.id)}.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(msg)
            }).catch(() => {});
        }
    };

    window.ADMIN_CLEAR_CURRENT_DM_THREAD = function() {
        if (typeof window.IS_ADMIN === 'function' && !window.IS_ADMIN()) return;
        const rc = GET_CUR_ROOM();
        const me = GET_MY_DM_IDENTITY();
        const peerId = window._activeDmPeerId;
        if (!rc || !me || !peerId) return;
        const peer = GET_DM_PEERS().find(p => p.id === peerId);
        if (!confirm(`Очистить личную переписку с «${peer ? peer.name : peerId}»?`)) return;

        const list = GET_ROOM_WHISPERS(rc);
        const toDelete = list.filter(m =>
            (m.fromId === me.id && m.toId === peerId) ||
            (m.fromId === peerId && m.toId === me.id)
        );
        window._dmMessagesCache[rc] = list.filter(m => !toDelete.includes(m));

        toDelete.forEach(m => {
            if (window.firebase && firebase.apps && firebase.apps.length) {
                firebase.database().ref(`campaign_v2/rooms/${rc}/whispers/${m.id}`).remove().catch(() => {});
            } else {
                fetch(`${FB_BASE_URL}/${encodeURIComponent(rc)}/whispers/${encodeURIComponent(m.id)}.json`, { method: 'DELETE' }).catch(() => {});
            }
        });
        RENDER_DM_WIDGET_CONTENT();
    };

    // --- 5. СИНХРОНИЗАЦИЯ С FIREBASE ПО КОМНАТАМ ---
    function NORMALIZE_WHISPERS_OBJ(val) {
        if (!val || typeof val !== 'object') return [];
        return Object.values(val)
            .filter(m => m && m.id && m.fromId && m.toId && m.text)
            .sort((a, b) => (a.ts || 0) - (b.ts || 0));
    }

    function HANDLE_INCOMING_WHISPERS(rc, nextList) {
        const prevList = window._dmMessagesCache[rc] || [];
        const prevIds = new Set(prevList.map(m => m.id));
        window._dmMessagesCache[rc] = nextList;

        if (GET_CUR_ROOM() !== rc) return;

        const me = GET_MY_DM_IDENTITY();
        if (me && initialRoomLoadDone[rc]) {
            const freshForMe = nextList.filter(m => m.toId === me.id && !prevIds.has(m.id));
            if (freshForMe.length > 0) {
                const lastMsg = freshForMe[freshForMe.length - 1];
                const isViewingNow = (window._dmWidgetState === 'open' && window._activeDmPeerId === lastMsg.fromId);
                if (isViewingNow) {
                    MARK_PEER_READ(rc, me.id, lastMsg.fromId, lastMsg.ts);
                } else {
                    SHOW_WHISPER_TOAST(lastMsg);
                }
            }
        }
        initialRoomLoadDone[rc] = true;
        RENDER_DM_WIDGET_CONTENT();
    }

    function SYNC_WHISPERS_FOR_ROOM(roomCode) {
        const nextRc = roomCode ? String(roomCode) : null;
        if (nextRc === activeWhisperRoom && (nextRc === null || activeWhisperRef)) return;

        if (activeWhisperRef) {
            activeWhisperRef.off();
            activeWhisperRef = null;
        }
        activeWhisperRoom = nextRc;
        window._activeDmPeerId = null;
        window._dmWidgetState = 'closed';

        const toast = document.getElementById('dm-whisper-toast');
        if (toast) toast.style.display = 'none';
        RENDER_DM_WIDGET_CONTENT();

        if (!nextRc) return;

        fetch(`${FB_BASE_URL}/${encodeURIComponent(nextRc)}/whispers.json`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (activeWhisperRoom !== nextRc) return;
                HANDLE_INCOMING_WHISPERS(nextRc, NORMALIZE_WHISPERS_OBJ(data));
            })
            .catch(() => {});

        const attachSdk = () => {
            if (activeWhisperRoom !== nextRc) return true;
            if (window.firebase && firebase.apps && firebase.apps.length) {
                const ref = firebase.database().ref(`campaign_v2/rooms/${nextRc}/whispers`);
                activeWhisperRef = ref;
                ref.on('value', (snap) => {
                    if (activeWhisperRoom !== nextRc) return;
                    HANDLE_INCOMING_WHISPERS(nextRc, NORMALIZE_WHISPERS_OBJ(snap.val()));
                });
                return true;
            }
            return false;
        };

        if (!attachSdk()) {
            const t = setInterval(() => {
                if (attachSdk()) clearInterval(t);
            }, 600);
            setTimeout(() => clearInterval(t), 20000);
        }
    }

    // --- 6. ХУКИ В СУЩЕСТВУЮЩИЙ UI ---
    if (typeof window.SWITCH_FIREBASE_ROOM === 'function') {
        const _ORIG_SWITCH_DM = window.SWITCH_FIREBASE_ROOM;
        window.SWITCH_FIREBASE_ROOM = function(rc) {
            const res = _ORIG_SWITCH_DM(rc);
            SYNC_WHISPERS_FOR_ROOM(rc);
            return res;
        };
    }

    const _ORIG_RPL_DM = window.RPL;
    window.RPL = function() {
        _ORIG_RPL_DM();
        INJECT_PARTY_DM_BUTTONS();
    };

    const _ORIG_APPLY_DM = window.APPLY_ROLE_VIEW;
    window.APPLY_ROLE_VIEW = function() {
        _ORIG_APPLY_DM();
        const rc = GET_CUR_ROOM();
        SYNC_WHISPERS_FOR_ROOM(rc);
        INJECT_DM_TOPBAR_BUTTON();
        INJECT_PARTY_DM_BUTTONS();
        if (!rc) {
            window._dmWidgetState = 'closed';
            RENDER_DM_WIDGET_CONTENT();
        }
    };

    // Первичная инициализация
    const curRc = GET_CUR_ROOM();
    SYNC_WHISPERS_FOR_ROOM(curRc);
    INJECT_DM_TOPBAR_BUTTON();
    INJECT_PARTY_DM_BUTTONS();
})();