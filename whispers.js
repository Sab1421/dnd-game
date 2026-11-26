// ================================================================
// 🤫 ЛИЧНЫЕ СООБЩЕНИЯ (ШЁПОТ) ИГРОК ↔ ИГРОК И ГМ ↔ ИГРОК (whispers.js)
// Полностью изолированы по комнатам и синхронизируются через Firebase
// ================================================================
(function INIT_ROOM_WHISPERS_MODULE() {
    const FB_BASE_URL = "https://dnds-23b7d-default-rtdb.firebaseio.com/campaign_v2/rooms";

    window._activeDmPeerId = null;
    window._dmMessagesCache = {}; // { [roomCode]: [msg, ...] }

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

    function GET_CUR_ROOM() {
        const sess = (typeof GET_SESSION === 'function') ? GET_SESSION() : null;
        return (sess && sess.roomCode) ? String(sess.roomCode) : null;
    }

    // Личность текущего пользователя в системе лички
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

    // Локальное хранилище меток прочтения (личное для текущего браузера, не синкается)
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

    // Все доступные собеседники в текущей комнате
    function GET_DM_PEERS() {
        const rc = GET_CUR_ROOM();
        const me = GET_MY_DM_IDENTITY();
        if (!rc || !me) return [];

        const map = new Map();
        const addPeer = (id, name, isGM) => {
            if (!id || id === me.id) return;
            if (!map.has(id)) map.set(id, { id, name, isGM: !!isGM });
        };

        // Игроки всегда могут написать Мастеру
        if (!me.isGM) {
            addPeer('gm', '👑 Гейм-Мастер', true);
        }

        // Все герои текущей комнаты
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

        // Подхватываем собеседников из уже существующих переписок (если кто-то выходил)
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

    // Всплывающий тост о новом личном сообщении
    function SHOW_WHISPER_TOAST(msg) {
        let box = document.getElementById('dm-whisper-toast');
        if (!box) {
            box = document.createElement('div');
            box.id = 'dm-whisper-toast';
            box.style.cssText = 'position:fixed; bottom:18px; right:18px; max-width:340px; background:linear-gradient(180deg, #2b2138 0%, #17131e 100%); border:2px solid #c084fc; border-radius:10px; padding:11px 14px; color:#f3e8ff; box-shadow:0 10px 30px rgba(0,0,0,0.85); z-index:94000; cursor:pointer; font-size:0.9rem;';
            document.body.appendChild(box);
        }
        const preview = msg.text.length > 75 ? msg.text.slice(0, 75) + '…' : msg.text;
        box.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:4px;">
                <b style="color:#e9d5ff;">🤫 Личное от ${ESC_DM(msg.fromName)}</b>
                <span style="color:#aaa; font-size:0.78rem;">${ESC_DM(msg.time || '')}</span>
            </div>
            <div style="color:#e2d9f3; line-height:1.35;">${ESC_DM(preview)}</div>
            <div style="color:#c084fc; font-size:0.76rem; margin-top:5px;">Нажмите, чтобы ответить</div>
        `;
        box.style.display = 'block';
        box.onclick = function() {
            box.style.display = 'none';
            window._activeDmPeerId = msg.fromId;
            window._chatTab = 'dm';
            RCH();
            const inp = document.getElementById('chat-input');
            if (inp) inp.focus();
        };

        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(() => {
            if (box) box.style.display = 'none';
        }, 5500);
    }

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

        const curRc = GET_CUR_ROOM();
        if (curRc !== rc) return;

        const me = GET_MY_DM_IDENTITY();
        if (me && initialRoomLoadDone[rc]) {
            const freshForMe = nextList.filter(m => m.toId === me.id && !prevIds.has(m.id));
            if (freshForMe.length > 0) {
                const lastMsg = freshForMe[freshForMe.length - 1];
                const isViewingThisThread = (window._chatTab === 'dm' && window._activeDmPeerId === lastMsg.fromId);
                if (isViewingThisThread) {
                    MARK_PEER_READ(rc, me.id, lastMsg.fromId, lastMsg.ts);
                } else {
                    SHOW_WHISPER_TOAST(lastMsg);
                }
            }
        }
        initialRoomLoadDone[rc] = true;
        RCH();
    }

    // Подписка на личные сообщения конкретной комнаты
    function SYNC_WHISPERS_FOR_ROOM(roomCode) {
        const nextRc = roomCode ? String(roomCode) : null;
        if (nextRc === activeWhisperRoom && (nextRc === null || activeWhisperRef)) return;

        if (activeWhisperRef) {
            activeWhisperRef.off();
            activeWhisperRef = null;
        }
        activeWhisperRoom = nextRc;
        window._activeDmPeerId = null;

        const toast = document.getElementById('dm-whisper-toast');
        if (toast) toast.style.display = 'none';

        if (!nextRc) return;

        // 1. Быстрая начальная загрузка через REST (работает сразу, не ждёт SDK)
        fetch(`${FB_BASE_URL}/${encodeURIComponent(nextRc)}/whispers.json`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (activeWhisperRoom !== nextRc) return;
                HANDLE_INCOMING_WHISPERS(nextRc, NORMALIZE_WHISPERS_OBJ(data));
            })
            .catch(() => {});

        // 2. Живая WebSocket-подписка через Firebase SDK
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

    // Отправка личного сообщения (атомарная запись по msg.id — сообщения разных людей не затирают друг друга)
    window.SEND_ROOM_WHISPER = function(rawText) {
        const text = String(rawText || '').trim();
        if (!text) return;
        const rc = GET_CUR_ROOM();
        const me = GET_MY_DM_IDENTITY();
        if (!rc || !me) return;

        const peers = GET_DM_PEERS();
        if (!peers.length) {
            showMessage('🤫 Нет собеседников', 'В этой комнате пока нет других участников для личной переписки.');
            return;
        }
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

        // Оптимистично показываем сразу у отправителя
        if (!window._dmMessagesCache[rc]) window._dmMessagesCache[rc] = [];
        window._dmMessagesCache[rc].push(msg);
        MARK_PEER_READ(rc, me.id, target.id, now);
        RCH();

        // Сохраняем в Firebase для комнаты
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

    window.SELECT_DM_PEER = function(peerId) {
        window._activeDmPeerId = peerId;
        const rc = GET_CUR_ROOM();
        const me = GET_MY_DM_IDENTITY();
        if (rc && me) {
            const msgs = GET_ROOM_WHISPERS(rc).filter(m => m.fromId === peerId && m.toId === me.id);
            const maxTs = msgs.length ? Math.max(...msgs.map(m => m.ts || 0)) : Date.now();
            MARK_PEER_READ(rc, me.id, peerId, maxTs);
        }
        RCH();
        const inp = document.getElementById('chat-input');
        if (inp) inp.focus();
    };

    // Перехватываем #chat-input, чтобы в режиме «🤫 Личка» Enter отправлял сообщение строго в личку
    function BIND_CHAT_INPUT_WITH_DM() {
        const oldInput = document.getElementById('chat-input');
        if (!oldInput || oldInput.dataset.dmBound === '1') return;
        const newInput = oldInput.cloneNode(true);
        newInput.dataset.dmBound = '1';
        oldInput.parentNode.replaceChild(newInput, oldInput);

        newInput.addEventListener('keypress', function(e) {
            if (e.key !== 'Enter') return;
            const text = this.value.trim();
            if (!text) return;

            if (window._chatTab === 'dm') {
                e.preventDefault();
                window.SEND_ROOM_WHISPER(text);
                this.value = '';
                return;
            }

            const ms = GMS();
            const sender = (typeof GET_CURRENT_SPEAKER_NAME === 'function') ? GET_CURRENT_SPEAKER_NAME() : 'Игрок';
            const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            ms.push(`[${time}] ${sender}: ${text}`);
            if (ms.length > 100) ms.shift();
            SMS(ms);
            window._chatTab = 'players';
            RCH();
            this.value = '';
        });
    }

    // Очистка текущей ветки лички (только для Админа)
    const _ORIG_CLEAR_CHAT_DM = window.CLEAR_CURRENT_CHAT_TAB;
    window.CLEAR_CURRENT_CHAT_TAB = function() {
        if (window._chatTab !== 'dm') {
            return _ORIG_CLEAR_CHAT_DM();
        }
        if (typeof window.IS_ADMIN === 'function' && !window.IS_ADMIN()) {
            showMessage('🔒 Недоступно', 'Очистка сообщений доступна только администратору.');
            return;
        }
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
        RCH();
    };

    // Расширяем отрисовку панели чата (RCH) третьей вкладкой «🤫 Личка»
    const _ORIG_RCH_DM = window.RCH;
    window.RCH = function() {
        _ORIG_RCH_DM();
        BIND_CHAT_INPUT_WITH_DM();

        const con = document.getElementById('chat-messages');
        const header = document.getElementById('chat-tabs-header');
        const chatInput = document.getElementById('chat-input');
        if (!con || !header) return;

        const tab = window._chatTab || 'players';
        const unreadInfo = GET_UNREAD_BY_PEER();
        const unreadBadge = (unreadInfo.total > 0)
            ? ` <span style="background:#ef4444; color:#fff; border-radius:10px; padding:1px 5px; font-size:0.72em;">+${unreadInfo.total}</span>`
            : '';

        // Добавляем вкладку «🤫 Личка» в шапку чата и слегка ужимаем подписи, чтобы 3 кнопки встали в 1 ряд
        const btnRow = header.querySelector('div > div');
        if (btnRow) {
            const pBtn = btnRow.querySelector("button[onclick=\"SET_CHAT_TAB('players')\"]");
            const sBtn = btnRow.querySelector("button[onclick=\"SET_CHAT_TAB('sys')\"]");
            if (pBtn) { pBtn.style.fontSize = '0.82rem'; pBtn.style.padding = '6px 4px'; pBtn.innerHTML = '💬 Чат'; }
            if (sBtn) { sBtn.style.fontSize = '0.82rem'; sBtn.style.padding = '6px 4px'; }

            const dmBtn = document.createElement('button');
            dmBtn.className = 'btn-small';
            dmBtn.setAttribute('onclick', "SET_CHAT_TAB('dm')");
            dmBtn.style.cssText = `flex:1; font-size:0.82rem; padding:6px 4px; font-weight:bold; background:${tab === 'dm' ? '#9b59b6' : '#1f1f1f'}; color:${tab === 'dm' ? '#fff' : '#d8b4fe'}; border:1px solid ${tab === 'dm' ? '#d8b4fe' : (unreadInfo.total > 0 ? '#ef4444' : '#444')};`;
            dmBtn.innerHTML = `🤫 Личка${unreadBadge}`;
            btnRow.appendChild(dmBtn);
        }

        // Панель выбора собеседника (показывается только во вкладке «🤫 Личка»)
        let peersBar = document.getElementById('dm-peers-bar');
        if (!peersBar) {
            peersBar = document.createElement('div');
            peersBar.id = 'dm-peers-bar';
            header.after(peersBar);
        }

        if (tab !== 'dm') {
            peersBar.style.display = 'none';
            return;
        }

        const rc = GET_CUR_ROOM();
        const me = GET_MY_DM_IDENTITY();
        const peers = GET_DM_PEERS();

        if (peers.length > 0 && (!window._activeDmPeerId || !peers.some(p => p.id === window._activeDmPeerId))) {
            // Если есть непрочитанный собеседник — открываем его первым
            const unreadPeer = peers.find(p => unreadInfo.byPeer[p.id] > 0);
            window._activeDmPeerId = unreadPeer ? unreadPeer.id : peers[0].id;
        }

        const activePeer = peers.find(p => p.id === window._activeDmPeerId) || null;

        peersBar.style.display = 'flex';
        peersBar.style.cssText = 'display:flex; gap:5px; flex-wrap:wrap; margin-bottom:8px; padding:6px; background:#141218; border:1px solid #443054; border-radius:7px;';

        if (!peers.length) {
            peersBar.innerHTML = '<span style="color:#888; font-size:0.82rem;">В комнате пока нет собеседников</span>';
            con.innerHTML = '<div style="color:#777; text-align:center; padding-top:34px; font-size:0.88rem;">Как только в комнату зайдут игроки, здесь можно будет писать им лично.</div>';
            if (chatInput) chatInput.style.display = 'none';
            return;
        }

        peersBar.innerHTML = peers.map(p => {
            const isSel = activePeer && p.id === activePeer.id;
            const cnt = unreadInfo.byPeer[p.id] || 0;
            const b = cnt > 0 ? ` <span style="background:#ef4444; color:#fff; border-radius:8px; padding:0 5px; font-size:0.72rem;">+${cnt}</span>` : '';
            return `
                <button class="btn-small" onclick="SELECT_DM_PEER('${ESC_DM(p.id)}')"
                    style="padding:4px 8px; font-size:0.78rem; background:${isSel ? '#7c3aed' : '#221e29'}; color:${isSel ? '#fff' : '#d8d4cc'}; border:1px solid ${isSel ? '#e9d5ff' : (cnt > 0 ? '#ef4444' : '#4a3d5c')};">
                    ${ESC_DM(p.name)}${b}
                </button>`;
        }).join('');

        // Отрисовываем личную переписку с выбранным собеседником
        const thread = GET_ROOM_WHISPERS(rc).filter(m =>
            (m.fromId === me.id && m.toId === activePeer.id) ||
            (m.fromId === activePeer.id && m.toId === me.id)
        );

        // Помечаем входящие в открытом диалоге как прочитанные
        const incoming = thread.filter(m => m.fromId === activePeer.id && m.toId === me.id);
        if (incoming.length > 0) {
            const maxTs = Math.max(...incoming.map(m => m.ts || 0));
            const prevSeen = GET_SEEN_MAP(rc, me.id)[activePeer.id] || 0;
            if (maxTs > prevSeen) {
                MARK_PEER_READ(rc, me.id, activePeer.id, maxTs);
                // Обновим бейдж вкладки на следующем кадре без зацикливания
                setTimeout(() => RCH(), 0);
            }
        }

        con.innerHTML = '';
        if (!thread.length) {
            con.innerHTML = `<div style="color:#888; text-align:center; padding-top:34px; font-size:0.86rem;">
                🤫 Личная переписка с <b style="color:#e9d5ff;">${ESC_DM(activePeer.name)}</b>.<br>
                <small style="color:#666;">Эти сообщения видите только вы вдвоём.</small>
            </div>`;
        } else {
            thread.forEach(m => {
                const isMine = (m.fromId === me.id);
                const d = document.createElement('div');
                d.style.cssText = isMine
                    ? 'padding:6px 9px; margin-bottom:6px; margin-left:18px; background:#232922; border-right:3px solid #52b758; border-radius:6px; font-size:0.86rem; color:#e6f4ea; word-break:break-word; line-height:1.35;'
                    : 'padding:6px 9px; margin-bottom:6px; margin-right:18px; background:#261e30; border-left:3px solid #c084fc; border-radius:6px; font-size:0.86rem; color:#f3e8ff; word-break:break-word; line-height:1.35;';
                d.innerHTML = `
                    <div style="display:flex; justify-content:space-between; gap:8px; font-size:0.74rem; color:${isMine ? '#86efac' : '#d8b4fe'}; margin-bottom:2px;">
                        <b>${isMine ? 'Вы' : ESC_DM(m.fromName)}</b>
                        <span style="color:#888;">${ESC_DM(m.time || '')}</span>
                    </div>
                    <div>${ESC_DM(m.text)}</div>
                `;
                con.appendChild(d);
            });
        }
        con.scrollTop = con.scrollHeight;

        if (chatInput) {
            chatInput.style.display = 'block';
            chatInput.placeholder = `🤫 Лично для «${activePeer.name}» (Enter)...`;
        }
    };

    // Подключаемся к переключению комнат и смене роли
    if (typeof window.SWITCH_FIREBASE_ROOM === 'function') {
        const _ORIG_SWITCH_DM = window.SWITCH_FIREBASE_ROOM;
        window.SWITCH_FIREBASE_ROOM = function(rc) {
            const res = _ORIG_SWITCH_DM(rc);
            SYNC_WHISPERS_FOR_ROOM(rc);
            return res;
        };
    }

    const _ORIG_APPLY_DM = window.APPLY_ROLE_VIEW;
    window.APPLY_ROLE_VIEW = function() {
        _ORIG_APPLY_DM();
        SYNC_WHISPERS_FOR_ROOM(GET_CUR_ROOM());
    };

    // Инициализация, если комната уже открыта
    BIND_CHAT_INPUT_WITH_DM();
    SYNC_WHISPERS_FOR_ROOM(GET_CUR_ROOM());
})();