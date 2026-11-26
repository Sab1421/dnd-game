// ================================================================
// 📖 ПОЛНОЦЕННЫЙ ЛОРБУК (ЭНЦИКЛОПЕДИЯ КАМПАНИИ) И РАЗДАТКИ / HANDOUTS (lorebook.js)
// Изоляция по комнатам • Видимость (Все / Только ГМ / Конкретный игрок) • Синхронизация Firebase
// ================================================================
(function INIT_LOREBOOK_AND_HANDOUTS() {
    const FB_ROOMS_URL = "https://dnds-23b7d-default-rtdb.firebaseio.com/campaign_v2/rooms";

    const CATEGORIES = [
        { id: 'all',       icon: '📚', label: 'Всё' },
        { id: 'location',  icon: '🗺️', label: 'Локации' },
        { id: 'npc',       icon: '🎭', label: 'Персонажи' },
        { id: 'faction',   icon: '🏛️', label: 'Фракции' },
        { id: 'lore',      icon: '📜', label: 'История и Мифы' },
        { id: 'clue',      icon: '🗝️', label: 'Улики и Письма' },
        { id: 'creature',  icon: '🐾', label: 'Существа' }
    ];

    const DEFAULT_ROOM_1001_ENTRIES = [
        {
            id: 'base_pritishie',
            title: 'Притишье',
            category: 'location',
            tags: 'деревня, старт, охотники',
            visibility: 'all',
            img: '',
            text: 'Маленькая деревня на границе цивилизации. Жители платят дань Охотникам, чтобы те истребляли монстров в округе.\n\n> Смотритель деревни — старый воин, который уже не может сражаться, но может учить.',
            updatedAt: 1001
        },
        {
            id: 'base_empire',
            title: 'Империя',
            category: 'faction',
            tags: 'власть, министр, генерал псов',
            visibility: 'all',
            img: '',
            text: 'Прогнившее государство, которым управляет жадный Министр. Император — марионетка.\n\nГенерал Псов держит страну в страхе и собирает жестокую подать со всех пограничных земель.',
            updatedAt: 1002
        },
        {
            id: 'base_world',
            title: 'Мир и Древо',
            category: 'lore',
            tags: 'древо, ошибка, монстры',
            visibility: 'all',
            img: '',
            text: 'Мир — живое сознание, заточённое в Древе.\n\n**Ошибка** — его противоположность и источник монстров, расползающихся по чаще и руинам.',
            updatedAt: 1003
        }
    ];

    window._loreCache = {};         // { [roomCode]: [entry, ...] }
    window._loreCatFilter = 'all';
    window._loreSearch = '';
    window._loreSelectedId = null;
    window._loreMode = 'view';      // 'view' | 'edit'
    window._loreEditDraft = null;
    window._loreMobView = 'list';   // 'list' | 'detail'

    let activeLoreRoom = null;
    let activeLoreRef = null;
    let activeHandoutRef = null;
    let initialHandoutLoaded = {};
    let modalOpenTime = 0;

    function ESC(s) {
        return String(s || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function ESC_JS(s) {
        return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    }

    function CUR_ROOM() {
        const s = (typeof GET_SESSION === 'function') ? GET_SESSION() : null;
        return (s && s.roomCode) ? String(s.roomCode) : null;
    }

    function IS_GM_NOW() {
        const s = (typeof GET_SESSION === 'function') ? GET_SESSION() : null;
        return !!(s && s.role === 'gm');
    }

    function GET_MY_HERO_ID() {
        const s = (typeof GET_SESSION === 'function') ? GET_SESSION() : null;
        if (!s || s.role !== 'player') return null;
        if (typeof SYNC_MY_PLAYER_INDEX === 'function') SYNC_MY_PLAYER_INDEX();
        const cs = GC();
        const c = cs[PI];
        return (c && c.id) ? String(c.id) : (s.heroId ? String(s.heroId) : ('idx_' + PI));
    }

    function GET_CAT_INFO(catId) {
        return CATEGORIES.find(c => c.id === catId) || CATEGORIES[4];
    }

    function FORMAT_LORE_TEXT(raw) {
        const lines = ESC(raw).split('\n');
        return lines.map(line => {
            const tr = line.trim();
            if (!tr) return '<div style="height:8px;"></div>';
            const withBold = tr.replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>');
            if (/^&gt;\s*/.test(withBold)) {
                return `<div style="border-left:3px solid var(--ui-accent, #c9a96e); background:var(--ui-panel, #221f1c); padding:7px 12px; margin:6px 0; border-radius:0 7px 7px 0; font-style:italic; color:var(--ui-text, #e5e0d7);">${withBold.replace(/^&gt;\s*/, '')}</div>`;
            }
            if (/^[-•*]\s+/.test(withBold)) {
                return `<div style="padding-left:14px; margin:3px 0;">• ${withBold.replace(/^[-•*]\s+/, '')}</div>`;
            }
            return `<div style="margin:4px 0;">${withBold}</div>`;
        }).join('');
    }

    function ENSURE_LORE_CSS() {
        if (document.getElementById('lorebook-v2-css')) return;
        const st = document.createElement('style');
        st.id = 'lorebook-v2-css';
        st.textContent = `
            #lorebook-modal .modal-content {
                max-width: 1020px !important;
                width: 96% !important;
                padding: 16px 20px !important;
            }
            .lore-layout {
                display: grid;
                grid-template-columns: 300px 1fr;
                gap: 14px;
                height: 64vh;
                min-height: 410px;
            }
            .lore-list-col {
                display: flex;
                flex-direction: column;
                min-height: 0;
                background: var(--ui-panel2, #161412);
                border: 1px solid var(--ui-border, #3e372f);
                border-radius: 10px;
                padding: 10px;
            }
            .lore-list-scroll {
                flex: 1;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 6px;
                padding-right: 2px;
            }
            .lore-item-btn {
                width: 100%;
                text-align: left;
                padding: 9px 10px;
                border-radius: 8px;
                border: 1px solid var(--ui-border, #3e372f);
                background: var(--ui-panel, #221f1c);
                color: var(--ui-text, #e5e0d7);
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 9px;
                box-shadow: none;
                transition: border-color 0.14s, background 0.14s;
            }
            .lore-item-btn:hover {
                border-color: var(--ui-accent, #d2b278);
            }
            .lore-item-btn.is-active {
                border-color: var(--ui-accent, #d2b278);
                background: var(--ui-panel2, #161412);
                box-shadow: inset 3px 0 0 var(--ui-accent, #d2b278);
            }
            .lore-reader-col {
                display: flex;
                flex-direction: column;
                min-height: 0;
                overflow-y: auto;
                background: var(--ui-panel2, #161412);
                border: 1px solid var(--ui-border, #3e372f);
                border-radius: 10px;
                padding: 16px 18px;
                text-align: left;
            }
            .lore-mob-back { display: none; }
            @media (max-width: 780px) {
                .lore-layout {
                    grid-template-columns: 1fr !important;
                    height: 68vh;
                }
                .lore-layout.mob-list .lore-reader-col { display: none !important; }
                .lore-layout.mob-detail .lore-list-col { display: none !important; }
                .lore-mob-back { display: inline-flex !important; margin-bottom: 10px; }
            }
        `;
        document.head.appendChild(st);
    }

    // --- 1. ХРАНИЛИЩЕ И МИГРАЦИЯ ПО КОМНАТАМ ---
    function LS_LORE_KEY(rc) {
        return `dnd_lore_v2_room_${rc}`;
    }

    function NORMALIZE_ENTRIES(val) {
        if (!val) return [];
        const arr = Array.isArray(val) ? val : (typeof val === 'object' ? Object.values(val) : []);
        return arr
            .filter(e => e && e.id && e.title)
            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    function BUILD_MIGRATED_ENTRIES(rc) {
        const out = [];
        if (String(rc) === '1001') {
            DEFAULT_ROOM_1001_ENTRIES.forEach(e => out.push(Object.assign({}, e)));
        }
        // Подхватываем старые кастомные статьи из gm.js (dnd_custom_lore)
        try {
            const legacy = (typeof GET_CUSTOM_LORE === 'function') ? GET_CUSTOM_LORE() : [];
            if (Array.isArray(legacy)) {
                legacy.forEach((item, idx) => {
                    if (!item || !item.title) return;
                    out.unshift({
                        id: 'legacy_' + idx + '_' + Date.now(),
                        title: String(item.title),
                        category: 'lore',
                        tags: '',
                        visibility: 'all',
                        img: '',
                        text: String(item.text || ''),
                        updatedAt: Date.now() + idx
                    });
                });
            }
        } catch (e) {}
        return out;
    }

    function GET_LORE_ENTRIES(rc) {
        const code = String(rc || CUR_ROOM() || '1001');
        if (window._loreCache[code]) return window._loreCache[code];
        try {
            const raw = localStorage.getItem(LS_LORE_KEY(code));
            if (raw) {
                const parsed = NORMALIZE_ENTRIES(JSON.parse(raw));
                window._loreCache[code] = parsed;
                return parsed;
            }
        } catch (e) {}
        const migrated = BUILD_MIGRATED_ENTRIES(code);
        window._loreCache[code] = migrated;
        return migrated;
    }

    function SAVE_LORE_ENTRIES(list, rc) {
        const code = String(rc || CUR_ROOM() || '');
        if (!code) return;
        const clean = NORMALIZE_ENTRIES(list);
        window._loreCache[code] = clean;
        try { localStorage.setItem(LS_LORE_KEY(code), JSON.stringify(clean)); } catch (e) {}

        // Храним объектом по id для надёжной синхронизации в Firebase
        const obj = {};
        clean.forEach(e => { obj[e.id] = e; });
        if (window.firebase && firebase.apps && firebase.apps.length) {
            firebase.database().ref(`campaign_v2/rooms/${code}/lore_v2`).set(obj).catch(() => {});
        } else {
            fetch(`${FB_ROOMS_URL}/${encodeURIComponent(code)}/lore_v2.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(obj)
            }).catch(() => {});
        }
    }

    function GET_ROOM_PLAYERS_FOR_VISIBILITY() {
        const rc = CUR_ROOM();
        const cs = GC();
        const idxs = (typeof GET_ROOM_PARTY_INDICES === 'function')
            ? GET_ROOM_PARTY_INDICES(rc)
            : cs.map((_, i) => i);
        return idxs
            .filter(i => cs[i])
            .map(i => {
                const c = cs[i];
                const view = (typeof GET_CHAR_FOR_ROOM === 'function') ? GET_CHAR_FOR_ROOM(c, rc) : c;
                return {
                    heroId: String(c.id || ('idx_' + i)),
                    name: view.name || ('Герой ' + (i + 1))
                };
            });
    }

    function CAN_USER_SEE_ENTRY(entry) {
        if (!entry) return false;
        if (IS_GM_NOW()) return true;
        const vis = entry.visibility || 'all';
        if (vis === 'all') return true;
        if (vis === 'gm') return false;
        if (vis.startsWith('player:')) {
            const myId = GET_MY_HERO_ID();
            return !!(myId && vis === 'player:' + myId);
        }
        return false;
    }

    function VISIBILITY_LABEL(vis) {
        if (!vis || vis === 'all') return { icon: '🌍', text: 'Видно всем', color: '#6cb878' };
        if (vis === 'gm') return { icon: '🔒', text: 'Только Мастеру', color: '#d99a4e' };
        if (vis.startsWith('player:')) {
            const pid = vis.slice(7);
            const pl = GET_ROOM_PLAYERS_FOR_VISIBILITY().find(p => p.heroId === pid);
            return { icon: '🤫', text: `Только: ${pl ? pl.name : 'игроку'}`, color: '#b49bd6' };
        }
        return { icon: '🌍', text: 'Видно всем', color: '#6cb878' };
    }

    // --- 2. РАЗДАТКИ (HANDOUTS) В РЕАЛЬНОМ ВРЕМЕНИ ---
    function HANDOUT_SEEN_KEY(rc) {
        const hid = GET_MY_HERO_ID() || 'guest';
        return `dnd_seen_handout_v2_${rc}_${hid}`;
    }

    function ENSURE_HANDOUT_MODAL() {
        let m = document.getElementById('lore-handout-modal');
        if (m) return m;
        m = document.createElement('div');
        m.className = 'modal';
        m.id = 'lore-handout-modal';
        m.style.zIndex = '96200';
        m.innerHTML = `<div class="modal-content" id="lore-handout-content" style="max-width:640px; width:95%;"></div>`;
        m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('active'); });
        document.body.appendChild(m);
        return m;
    }

    function SHOW_HANDOUT_POPUP(h) {
        if (!h || !h.title) return;
        const m = ENSURE_HANDOUT_MODAL();
        const cont = document.getElementById('lore-handout-content');
        if (!cont) return;
        const cat = GET_CAT_INFO(h.category);
        const isSecret = h.target && h.target.startsWith('player:');

        cont.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; border-bottom:1px solid var(--ui-border, #3e372f); padding-bottom:8px; margin-bottom:12px; flex-wrap:wrap;">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="background:var(--ui-panel2, #161412); border:1px solid var(--ui-border-strong, #695c4c); padding:2px 9px; border-radius:6px; font-size:0.82rem; color:var(--ui-accent, #d2b278);">
                        ${cat.icon} ${cat.label}
                    </span>
                    ${isSecret ? `<span style="background:#3a2b4d; color:#e9d5ff; padding:2px 8px; border-radius:6px; font-size:0.78rem;">🤫 Лично вам</span>` : ''}
                </div>
                <small style="color:var(--ui-muted, #aaa);">📜 Раздатка от ${ESC(h.by || 'Гейм-Мастера')}</small>
            </div>
            <h2 style="margin-top:0; border:none; padding-bottom:4px;">${ESC(h.title)}</h2>
            ${h.img ? `
                <div style="margin:10px 0 14px 0; text-align:center;">
                    <img src="${h.img}" alt="${ESC(h.title)}" style="max-width:100%; max-height:300px; border-radius:9px; border:1px solid var(--ui-border-strong, #695c4c); object-fit:contain; background:#121110;">
                </div>` : ''}
            <div style="background:var(--ui-panel2, #161412); border:1px solid var(--ui-border, #3e372f); border-radius:9px; padding:14px 16px; max-height:42vh; overflow-y:auto; text-align:left; font-size:0.95rem; line-height:1.55;">
                ${FORMAT_LORE_TEXT(h.text)}
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; margin-top:14px; flex-wrap:wrap;">
                ${h.entryId ? `<button class="btn-small btn-save" onclick="document.getElementById('lore-handout-modal').classList.remove('active'); OPEN_ENHANCED_LOREBOOK('${ESC_JS(h.entryId)}');">📖 Открыть в Лорбуке</button>` : '<span></span>'}
                <button onclick="document.getElementById('lore-handout-modal').classList.remove('active');">Закрыть</button>
            </div>
        `;
        m.classList.add('active');
    }

    function HANDLE_INCOMING_HANDOUT(rc, h) {
        if (!h || !h.id || CUR_ROOM() !== rc || IS_GM_NOW()) return;

        // Проверяем адресата
        if (h.target && h.target !== 'all') {
            const myId = GET_MY_HERO_ID();
            if (!myId || h.target !== 'player:' + myId) return;
        }

        const seenKey = HANDOUT_SEEN_KEY(rc);
        if (localStorage.getItem(seenKey) === String(h.id)) return;

        // Если это старая раздатка при первичном входе в комнату (> 5 мин назад) — не спамим окном
        if (!initialHandoutLoaded[rc] && h.ts && (Date.now() - h.ts > 5 * 60 * 1000)) {
            localStorage.setItem(seenKey, String(h.id));
            return;
        }

        localStorage.setItem(seenKey, String(h.id));
        SHOW_HANDOUT_POPUP(h);
    }

    window.GM_BROADCAST_LORE_HANDOUT = function(entryId) {
        if (!IS_GM_NOW()) return;
        const rc = CUR_ROOM();
        if (!rc) return;
        const list = GET_LORE_ENTRIES(rc);
        const entry = list.find(e => e.id === entryId);
        if (!entry) return;

        let target = entry.visibility || 'all';
        if (target === 'gm') {
            if (!confirm(`Запись «${entry.title}» сейчас скрыта от игроков (🔒 Только Мастеру).\n\nОткрыть её в Лорбуке для всех и показать игрокам как раздатку?`)) {
                return;
            }
            entry.visibility = 'all';
            entry.updatedAt = Date.now();
            SAVE_LORE_ENTRIES(list, rc);
            target = 'all';
        }

        const handout = {
            id: 'ho_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            entryId: entry.id,
            title: entry.title,
            category: entry.category || 'lore',
            text: entry.text || '',
            img: entry.img || '',
            target,
            by: (typeof GET_GM_NAME === 'function') ? GET_GM_NAME() : 'Гейм-Мастер',
            ts: Date.now()
        };

        if (window.firebase && firebase.apps && firebase.apps.length) {
            firebase.database().ref(`campaign_v2/rooms/${rc}/handout_live`).set(handout).catch(() => {});
        } else {
            fetch(`${FB_ROOMS_URL}/${encodeURIComponent(rc)}/handout_live.json`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(handout)
            }).catch(() => {});
        }

        const visInfo = VISIBILITY_LABEL(target);
        if (target === 'all') {
            LOG_COMBAT_TO_CHAT(`📜 Гейм-Мастер показал всем раздатку: «${entry.title}» (доступно в Лорбуке).`);
        }
        RENDER_LOREBOOK_V2();
        showMessage('📣 Раздатка отправлена!', `Документ «<b>${ESC(entry.title)}</b>» показан на экране (${visInfo.icon} ${ESC(visInfo.text)}).`);
    };

    // --- 3. СИНХРОНИЗАЦИЯ С FIREBASE ПО КОМНАТАМ ---
    function SYNC_LORE_FOR_ROOM(roomCode) {
        const nextRc = roomCode ? String(roomCode) : null;
        if (nextRc === activeLoreRoom && (nextRc === null || activeLoreRef)) return;

        if (activeLoreRef) { activeLoreRef.off(); activeLoreRef = null; }
        if (activeHandoutRef) { activeHandoutRef.off(); activeHandoutRef = null; }
        activeLoreRoom = nextRc;
        window._loreSelectedId = null;
        window._loreMode = 'view';

        if (!nextRc) return;

        // Быстрая загрузка через REST
        fetch(`${FB_ROOMS_URL}/${encodeURIComponent(nextRc)}/lore_v2.json`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (activeLoreRoom !== nextRc) return;
                if (data) {
                    const norm = NORMALIZE_ENTRIES(data);
                    window._loreCache[nextRc] = norm;
                    try { localStorage.setItem(LS_LORE_KEY(nextRc), JSON.stringify(norm)); } catch (e) {}
                } else {
                    const mig = BUILD_MIGRATED_ENTRIES(nextRc);
                    window._loreCache[nextRc] = mig;
                    if (mig.length) SAVE_LORE_ENTRIES(mig, nextRc);
                }
                if (document.getElementById('lorebook-modal')?.classList.contains('active')) {
                    RENDER_LOREBOOK_V2();
                }
            })
            .catch(() => {});

        const attachSdk = () => {
            if (activeLoreRoom !== nextRc) return true;
            if (window.firebase && firebase.apps && firebase.apps.length) {
                const roomRef = firebase.database().ref(`campaign_v2/rooms/${nextRc}`);
                activeLoreRef = roomRef.child('lore_v2');
                activeHandoutRef = roomRef.child('handout_live');

                activeLoreRef.on('value', (snap) => {
                    if (activeLoreRoom !== nextRc) return;
                    const val = snap.val();
                    if (val) {
                        const norm = NORMALIZE_ENTRIES(val);
                        window._loreCache[nextRc] = norm;
                        try { localStorage.setItem(LS_LORE_KEY(nextRc), JSON.stringify(norm)); } catch (e) {}
                    } else if (!window._loreCache[nextRc]) {
                        window._loreCache[nextRc] = BUILD_MIGRATED_ENTRIES(nextRc);
                    }
                    if (document.getElementById('lorebook-modal')?.classList.contains('active') && window._loreMode === 'view') {
                        RENDER_LOREBOOK_V2();
                    }
                });

                activeHandoutRef.on('value', (snap) => {
                    if (activeLoreRoom !== nextRc) return;
                    HANDLE_INCOMING_HANDOUT(nextRc, snap.val());
                    initialHandoutLoaded[nextRc] = true;
                });
                return true;
            }
            return false;
        };

        if (!attachSdk()) {
            const t = setInterval(() => { if (attachSdk()) clearInterval(t); }, 650);
            setTimeout(() => clearInterval(t), 20000);
        }
    }

    // --- 4. РЕДАКТИРОВАНИЕ И УПРАВЛЕНИЕ СТАТЬЯМИ (ГМ) ---
    window.LORE_SELECT_ENTRY = function(id) {
        window._loreSelectedId = id;
        window._loreMode = 'view';
        window._loreMobView = 'detail';
        RENDER_LOREBOOK_V2();
    };

    window.LORE_SET_CATEGORY = function(catId) {
        window._loreCatFilter = catId;
        window._loreMobView = 'list';
        RENDER_LOREBOOK_V2();
    };

    window.LORE_ON_SEARCH = function(val) {
        window._loreSearch = val || '';
        const listEl = document.getElementById('lore-list-scroll');
        if (listEl) listEl.innerHTML = BUILD_LORE_LIST_ITEMS_HTML();
    };

    window.LORE_START_NEW = function() {
        if (!IS_GM_NOW()) return;
        window._loreMode = 'edit';
        window._loreMobView = 'detail';
        window._loreEditDraft = {
            id: null,
            title: '',
            category: window._loreCatFilter !== 'all' ? window._loreCatFilter : 'location',
            tags: '',
            visibility: 'all',
            img: '',
            text: ''
        };
        RENDER_LOREBOOK_V2();
    };

    window.LORE_START_EDIT = function(entryId) {
        if (!IS_GM_NOW()) return;
        const entry = GET_LORE_ENTRIES().find(e => e.id === entryId);
        if (!entry) return;
        window._loreMode = 'edit';
        window._loreMobView = 'detail';
        window._loreEditDraft = Object.assign({}, entry);
        RENDER_LOREBOOK_V2();
    };

    window.LORE_UPLOAD_IMG = function() {
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
                    const maxSide = 720;
                    const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
                    const c = document.createElement('canvas');
                    c.width = Math.max(1, Math.round(img.width * scale));
                    c.height = Math.max(1, Math.round(img.height * scale));
                    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                    const compressed = c.toDataURL('image/jpeg', 0.82);

                    if (window._loreEditDraft) {
                        window._loreEditDraft.title = document.getElementById('lore-ed-title')?.value ?? window._loreEditDraft.title;
                        window._loreEditDraft.category = document.getElementById('lore-ed-cat')?.value ?? window._loreEditDraft.category;
                        window._loreEditDraft.tags = document.getElementById('lore-ed-tags')?.value ?? window._loreEditDraft.tags;
                        window._loreEditDraft.visibility = document.getElementById('lore-ed-vis')?.value ?? window._loreEditDraft.visibility;
                        window._loreEditDraft.text = document.getElementById('lore-ed-text')?.value ?? window._loreEditDraft.text;
                        window._loreEditDraft.img = compressed;
                    }
                    RENDER_LOREBOOK_V2();
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(f);
        };
        inp.click();
    };

    window.LORE_CLEAR_DRAFT_IMG = function() {
        if (!window._loreEditDraft) return;
        window._loreEditDraft.title = document.getElementById('lore-ed-title')?.value ?? window._loreEditDraft.title;
        window._loreEditDraft.category = document.getElementById('lore-ed-cat')?.value ?? window._loreEditDraft.category;
        window._loreEditDraft.tags = document.getElementById('lore-ed-tags')?.value ?? window._loreEditDraft.tags;
        window._loreEditDraft.visibility = document.getElementById('lore-ed-vis')?.value ?? window._loreEditDraft.visibility;
        window._loreEditDraft.text = document.getElementById('lore-ed-text')?.value ?? window._loreEditDraft.text;
        window._loreEditDraft.img = '';
        RENDER_LOREBOOK_V2();
    };

    window.LORE_SAVE_DRAFT = function() {
        if (!IS_GM_NOW()) return;
        const title = (document.getElementById('lore-ed-title')?.value || '').trim();
        const category = document.getElementById('lore-ed-cat')?.value || 'lore';
        const tags = (document.getElementById('lore-ed-tags')?.value || '').trim();
        const visibility = document.getElementById('lore-ed-vis')?.value || 'all';
        const urlImg = (document.getElementById('lore-ed-img-url')?.value || '').trim();
        const text = (document.getElementById('lore-ed-text')?.value || '').trim();

        if (!title || !text) {
            showMessage('⚠️ Заполните поля', 'Укажите название и текст статьи.');
            return;
        }

        const rc = CUR_ROOM();
        const list = GET_LORE_ENTRIES(rc).slice();
        const draft = window._loreEditDraft || {};
        const finalImg = urlImg || (draft.img && draft.img.startsWith('data:') ? draft.img : '');
        const isNew = !draft.id;
        const id = draft.id || ('lore_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));

        const nextEntry = {
            id, title, category, tags, visibility, img: finalImg, text,
            updatedAt: Date.now()
        };

        const idx = list.findIndex(e => e.id === id);
        if (idx !== -1) list[idx] = nextEntry;
        else list.unshift(nextEntry);

        SAVE_LORE_ENTRIES(list, rc);
        window._loreSelectedId = id;
        window._loreMode = 'view';
        window._loreEditDraft = null;

        if (isNew && visibility === 'all') {
            LOG_COMBAT_TO_CHAT(`📖 В Лорбук добавлена новая запись: «${title}»!`);
        }
        RENDER_LOREBOOK_V2();
    };

    window.LORE_QUICK_TOGGLE_VISIBILITY = function(entryId) {
        if (!IS_GM_NOW()) return;
        const rc = CUR_ROOM();
        const list = GET_LORE_ENTRIES(rc).slice();
        const entry = list.find(e => e.id === entryId);
        if (!entry) return;
        entry.visibility = (entry.visibility === 'all') ? 'gm' : 'all';
        entry.updatedAt = Date.now();
        SAVE_LORE_ENTRIES(list, rc);
        if (entry.visibility === 'all') {
            LOG_COMBAT_TO_CHAT(`📖 В Лорбуке открыта новая запись: «${entry.title}»!`);
        }
        RENDER_LOREBOOK_V2();
    };

    window.LORE_DELETE_ENTRY = function(entryId) {
        if (!IS_GM_NOW()) return;
        const rc = CUR_ROOM();
        const list = GET_LORE_ENTRIES(rc);
        const entry = list.find(e => e.id === entryId);
        if (!entry) return;
        if (!confirm(`Удалить запись «${entry.title}» из Лорбука?`)) return;

        const next = list.filter(e => e.id !== entryId);
        SAVE_LORE_ENTRIES(next, rc);
        window._loreSelectedId = next.length ? next[0].id : null;
        window._loreMode = 'view';
        window._loreMobView = 'list';
        RENDER_LOREBOOK_V2();
    };

    // --- 5. ОТРИСОВКА ОКНА ЛОРБУКА ---
    function GET_FILTERED_ENTRIES() {
        const all = GET_LORE_ENTRIES().filter(CAN_USER_SEE_ENTRY);
        const cat = window._loreCatFilter || 'all';
        const q = (window._loreSearch || '').toLowerCase().trim();
        return all.filter(e => {
            const catOk = (cat === 'all') || ((e.category || 'lore') === cat);
            const qOk = !q ||
                (e.title || '').toLowerCase().includes(q) ||
                (e.tags || '').toLowerCase().includes(q) ||
                (e.text || '').toLowerCase().includes(q);
            return catOk && qOk;
        });
    }

    function BUILD_LORE_LIST_ITEMS_HTML() {
        const filtered = GET_FILTERED_ENTRIES();
        const isGM = IS_GM_NOW();
        if (!filtered.length) {
            return `<div style="padding:24px 10px; text-align:center; color:var(--ui-muted, #888); font-size:0.86rem;">
                Записей пока нет.${isGM ? '<br><br>Нажмите «➕ Новая запись» сверху.' : ''}
            </div>`;
        }
        return filtered.map(e => {
            const isSel = (window._loreMode === 'view' && window._loreSelectedId === e.id);
            const cat = GET_CAT_INFO(e.category);
            const vis = VISIBILITY_LABEL(e.visibility);
            const thumb = e.img
                ? `<img src="${e.img}" style="width:36px; height:36px; border-radius:6px; object-fit:cover; border:1px solid var(--ui-border, #444); flex-shrink:0;">`
                : `<div style="width:36px; height:36px; border-radius:6px; background:var(--ui-panel2, #161412); border:1px solid var(--ui-border, #3e372f); display:flex; align-items:center; justify-content:center; font-size:1.1rem; flex-shrink:0;">${cat.icon}</div>`;
            return `
                <button data-custom-bg="1" class="lore-item-btn ${isSel ? 'is-active' : ''}" onclick="LORE_SELECT_ENTRY('${ESC_JS(e.id)}')">
                    ${thumb}
                    <div style="min-width:0; flex:1;">
                        <div style="font-weight:700; font-size:0.88rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:${isSel ? 'var(--ui-accent, #d2b278)' : 'var(--ui-text, #e5e0d7)'};">
                            ${ESC(e.title)}
                        </div>
                        <div style="font-size:0.74rem; color:var(--ui-muted, #9a9286); display:flex; justify-content:space-between; gap:6px; margin-top:2px;">
                            <span>${cat.label}</span>
                            ${isGM ? `<span style="color:${vis.color};">${vis.icon}</span>` : (e.visibility && e.visibility.startsWith('player:') ? '<span style="color:#b49bd6;">🤫 Личное</span>' : '')}
                        </div>
                    </div>
                </button>`;
        }).join('');
    }

    function BUILD_LORE_READER_HTML() {
        const isGM = IS_GM_NOW();

        if (isGM && window._loreMode === 'edit') {
            const d = window._loreEditDraft || { title: '', category: 'location', tags: '', visibility: 'all', img: '', text: '' };
            const players = GET_ROOM_PLAYERS_FOR_VISIBILITY();
            const catOpts = CATEGORIES.filter(c => c.id !== 'all')
                .map(c => `<option value="${c.id}" ${d.category === c.id ? 'selected' : ''}>${c.icon} ${c.label}</option>`)
                .join('');
            const visOpts = `
                <option value="all" ${(!d.visibility || d.visibility === 'all') ? 'selected' : ''}>🌍 Видно всем игрокам комнаты</option>
                <option value="gm" ${d.visibility === 'gm' ? 'selected' : ''}>🔒 Скрыто (видит только Мастер)</option>
                ${players.map(p => `<option value="player:${ESC(p.heroId)}" ${d.visibility === 'player:' + p.heroId ? 'selected' : ''}>🤫 Только игроку: ${ESC(p.name)}</option>`).join('')}
            `;
            const urlVal = (d.img && !d.img.startsWith('data:')) ? d.img : '';

            return `
                <button class="btn-small lore-mob-back" onclick="window._loreMobView='list'; RENDER_LOREBOOK_V2();">⬅️ К списку</button>
                <h3 style="margin-top:0;">${d.id ? '✏️ Редактировать запись' : '➕ Новая запись в Лорбук'}</h3>

                <div style="display:flex; flex-direction:column; gap:10px;">
                    <div style="display:grid; grid-template-columns: 1.4fr 1fr; gap:8px;">
                        <div>
                            <label style="font-size:0.82rem; color:var(--ui-muted, #aaa);">Название статьи:</label>
                            <input type="text" id="lore-ed-title" value="${ESC(d.title)}" placeholder="Напр.: Таверна «Старый Очаг»" style="margin-top:4px; text-align:left;">
                        </div>
                        <div>
                            <label style="font-size:0.82rem; color:var(--ui-muted, #aaa);">Категория:</label>
                            <select id="lore-ed-cat" style="margin-top:4px; text-align:left;">${catOpts}</select>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
                        <div>
                            <label style="font-size:0.82rem; color:var(--ui-muted, #aaa);">Кто видит запись:</label>
                            <select id="lore-ed-vis" style="margin-top:4px; text-align:left;">${visOpts}</select>
                        </div>
                        <div>
                            <label style="font-size:0.82rem; color:var(--ui-muted, #aaa);">Теги через запятую (для поиска):</label>
                            <input type="text" id="lore-ed-tags" value="${ESC(d.tags || '')}" placeholder="деревня, квест, тайна" style="margin-top:4px; text-align:left;">
                        </div>
                    </div>

                    <div style="background:var(--ui-panel, #221f1c); border:1px solid var(--ui-border, #3e372f); border-radius:8px; padding:10px;">
                        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                            <button class="btn-small" onclick="LORE_UPLOAD_IMG()">🖼️ Загрузить иллюстрацию</button>
                            <input type="text" id="lore-ed-img-url" value="${ESC(urlVal)}" placeholder="Или ссылка (URL) на картинку..." style="flex:1; min-width:170px; text-align:left; font-size:0.84rem;">
                            ${d.img ? `<button class="btn-small btn-danger" onclick="LORE_CLEAR_DRAFT_IMG()">✕</button>` : ''}
                        </div>
                        ${d.img ? `<div style="margin-top:8px;"><img src="${d.img}" style="max-height:110px; max-width:100%; border-radius:6px; border:1px solid var(--ui-border, #444);"></div>` : ''}
                    </div>

                    <div>
                        <label style="font-size:0.82rem; color:var(--ui-muted, #aaa);">Текст (поддерживает <code>**жирный**</code>, списки <code>- пункт</code> и цитаты <code>&gt; письмо</code>):</label>
                        <textarea id="lore-ed-text" style="min-height:170px; margin-top:4px; line-height:1.5;" placeholder="Описание локации, персонажа, улики или легенды...">${ESC(d.text || '')}</textarea>
                    </div>

                    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:4px;">
                        <button class="btn-save" onclick="LORE_SAVE_DRAFT()">💾 Сохранить запись</button>
                        <button onclick="window._loreMode='view'; window._loreEditDraft=null; RENDER_LOREBOOK_V2();">Отмена</button>
                    </div>
                </div>
            `;
        }

        const visibleList = GET_FILTERED_ENTRIES();
        let entry = visibleList.find(e => e.id === window._loreSelectedId)
                 || GET_LORE_ENTRIES().filter(CAN_USER_SEE_ENTRY).find(e => e.id === window._loreSelectedId)
                 || visibleList[0]
                 || null;

        if (!entry) {
            return `
                <div style="margin:auto; text-align:center; color:var(--ui-muted, #888); padding:28px;">
                    <div style="font-size:2.4rem; margin-bottom:8px;">📖</div>
                    <div style="font-weight:bold; color:var(--ui-accent, #d2b278); margin-bottom:6px;">Лорбук комнаты #${CUR_ROOM() || '—'} пуст</div>
                    <p style="font-size:0.9rem;">${isGM ? 'Создайте первую статью — локацию, NPC, фракцию или улику. Скрытые статьи игроки не увидят, пока вы сами их не откроете.' : 'Гейм-Мастер пока не открыл записи в этой комнате.'}</p>
                    ${isGM ? `<button class="btn-save" style="margin-top:12px;" onclick="LORE_START_NEW()">➕ Добавить первую запись</button>` : ''}
                </div>
            `;
        }

        window._loreSelectedId = entry.id;
        const cat = GET_CAT_INFO(entry.category);
        const vis = VISIBILITY_LABEL(entry.visibility);
        const tagsArr = String(entry.tags || '').split(',').map(t => t.trim()).filter(Boolean);

        return `
            <button class="btn-small lore-mob-back" onclick="window._loreMobView='list'; RENDER_LOREBOOK_V2();">⬅️ К списку записей</button>

            <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px; flex-wrap:wrap; margin-bottom:10px; border-bottom:1px solid var(--ui-border, #3e372f); padding-bottom:10px;">
                <div>
                    <div style="display:flex; align-items:center; gap:7px; flex-wrap:wrap; margin-bottom:5px;">
                        <span style="background:var(--ui-panel, #221f1c); border:1px solid var(--ui-border, #3e372f); color:var(--ui-accent, #d2b278); padding:2px 8px; border-radius:6px; font-size:0.78rem; font-weight:600;">
                            ${cat.icon} ${cat.label}
                        </span>
                        ${isGM ? `<span style="font-size:0.78rem; color:${vis.color};">${vis.icon} ${ESC(vis.text)}</span>` : (entry.visibility && entry.visibility.startsWith('player:') ? `<span style="font-size:0.78rem; color:#b49bd6;">🤫 Доступно лично вам</span>` : '')}
                    </div>
                    <h2 style="margin:0; border:none; padding:0; font-size:1.35rem;">${ESC(entry.title)}</h2>
                </div>

                ${isGM ? `
                    <div style="display:flex; gap:5px; flex-wrap:wrap;">
                        <button class="btn-small btn-cast" title="Показать игрокам всплывающим окном (Раздатка)" onclick="GM_BROADCAST_LORE_HANDOUT('${ESC_JS(entry.id)}')">📣 Раздатка</button>
                        <button class="btn-small" title="Переключить видимость для игроков" onclick="LORE_QUICK_TOGGLE_VISIBILITY('${ESC_JS(entry.id)}')">${entry.visibility === 'all' ? '🔒 Скрыть' : '👁️ Открыть всем'}</button>
                        <button class="btn-small" onclick="LORE_START_EDIT('${ESC_JS(entry.id)}')">✏️</button>
                        <button class="btn-small btn-danger" onclick="LORE_DELETE_ENTRY('${ESC_JS(entry.id)}')">🗑️</button>
                    </div>
                ` : ''}
            </div>

            ${entry.img ? `
                <div style="margin-bottom:14px; text-align:center;">
                    <img src="${entry.img}" alt="${ESC(entry.title)}" style="max-width:100%; max-height:280px; border-radius:9px; border:1px solid var(--ui-border-strong, #695c4c); object-fit:contain; background:#121110;">
                </div>` : ''}

            <div style="font-size:0.95rem; line-height:1.58; color:var(--ui-text, #e5e0d7); flex:1;">
                ${FORMAT_LORE_TEXT(entry.text)}
            </div>

            ${tagsArr.length ? `
                <div style="display:flex; gap:5px; flex-wrap:wrap; margin-top:16px; padding-top:10px; border-top:1px dashed var(--ui-border, #3e372f);">
                    ${tagsArr.map(t => `<span style="background:var(--ui-panel, #221f1c); border:1px solid var(--ui-border, #3e372f); color:var(--ui-muted, #aaa); padding:2px 8px; border-radius:12px; font-size:0.76rem;">#${ESC(t)}</span>`).join('')}
                </div>` : ''}
        `;
    }

    window.RENDER_LOREBOOK_V2 = function() {
        ENSURE_LORE_CSS();
        const modal = document.getElementById('lorebook-modal');
        if (!modal) return;
        const mc = modal.querySelector('.modal-content');
        if (!mc) return;

        const isGM = IS_GM_NOW();
        const rc = CUR_ROOM() || '1001';
        const allVisible = GET_LORE_ENTRIES(rc).filter(CAN_USER_SEE_ENTRY);
        const curCat = window._loreCatFilter || 'all';

        const catBtns = CATEGORIES.map(c => {
            const cnt = c.id === 'all' ? allVisible.length : allVisible.filter(e => (e.category || 'lore') === c.id).length;
            const act = curCat === c.id;
            return `
                <button data-custom-bg="1" class="btn-small" onclick="LORE_SET_CATEGORY('${c.id}')"
                    style="padding:4px 9px; font-size:0.78rem; box-shadow:none; background:${act ? 'var(--ui-btn-bg, #c8a66a)' : 'var(--ui-panel2, #161412)'}; color:${act ? 'var(--ui-btn-text, #1a150f)' : 'var(--ui-text, #e5e0d7)'}; border:1px solid ${act ? 'var(--ui-accent, #d2b278)' : 'var(--ui-border, #3e372f)'};">
                    ${c.icon} ${c.label} <span style="opacity:0.75;">(${cnt})</span>
                </button>`;
        }).join('');

        mc.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; border-bottom:1px solid var(--ui-border, #3e372f); padding-bottom:10px; margin-bottom:10px;">
                <div>
                    <h2 style="margin:0; border:none; padding:0; font-size:1.3rem;">📖 Лорбук кампании <small style="color:var(--ui-muted, #9a9286); font-weight:normal;">(Комната #${ESC(rc)})</small></h2>
                </div>
                <div style="display:flex; gap:8px; align-items:center;">
                    ${isGM ? `<button class="btn-small btn-save" onclick="LORE_START_NEW()">➕ Новая запись</button>` : ''}
                    <button class="btn-small" onclick="document.getElementById('lorebook-modal').classList.remove('active');">✕ Закрыть</button>
                </div>
            </div>

            <div style="display:flex; gap:5px; flex-wrap:wrap; margin-bottom:10px;">
                ${catBtns}
            </div>

            <div class="lore-layout mob-${window._loreMobView || 'list'}">
                <div class="lore-list-col">
                    <input type="text" id="lore-search-inp" value="${ESC(window._loreSearch || '')}"
                        oninput="LORE_ON_SEARCH(this.value)"
                        placeholder="🔍 Поиск по Лорбуку..."
                        style="width:100%; margin-bottom:8px; padding:7px 9px; text-align:left; font-size:0.85rem;">
                    <div id="lore-list-scroll" class="lore-list-scroll">
                        ${BUILD_LORE_LIST_ITEMS_HTML()}
                    </div>
                </div>
                <div class="lore-reader-col">
                    ${BUILD_LORE_READER_HTML()}
                </div>
            </div>
        `;
    };

    window.OPEN_ENHANCED_LOREBOOK = function(selectEntryId) {
        const now = Date.now();
        if (now - modalOpenTime < 80 && !selectEntryId) return;
        modalOpenTime = now;

        if (selectEntryId) {
            window._loreSelectedId = selectEntryId;
            window._loreMobView = 'detail';
        }
        window._loreMode = 'view';
        RENDER_LOREBOOK_V2();
        const modal = document.getElementById('lorebook-modal');
        if (modal) modal.classList.add('active');
    };

    // --- 6. ПЕРЕХВАТ СТАРЫХ ТОЧЕК ВХОДА В ЛОРБУК ---
    window.OPEN_GM_LORE_MODAL = function() {
        window.OPEN_ENHANCED_LOREBOOK();
    };

    window.RENDER_CUSTOM_LORE = function() {
        if (document.getElementById('lorebook-modal')?.classList.contains('active') && window._loreMode === 'view') {
            RENDER_LOREBOOK_V2();
        }
    };

    const _ORIG_OM_LORE = window.OM;
    if (typeof _ORIG_OM_LORE === 'function') {
        window.OM = function(id) {
            if (id === 'lorebook-modal') {
                window.OPEN_ENHANCED_LOREBOOK();
                return;
            }
            return _ORIG_OM_LORE(id);
        };
    }

    const _ORIG_OPEN_MODAL_LORE = window.openModal;
    if (typeof _ORIG_OPEN_MODAL_LORE === 'function') {
        window.openModal = function(id) {
            if (id === 'lorebook-modal') {
                window.OPEN_ENHANCED_LOREBOOK();
                return;
            }
            return _ORIG_OPEN_MODAL_LORE(id);
        };
    }

    if (typeof window.SWITCH_FIREBASE_ROOM === 'function') {
        const _ORIG_SW_LORE = window.SWITCH_FIREBASE_ROOM;
        window.SWITCH_FIREBASE_ROOM = function(rc) {
            const res = _ORIG_SW_LORE(rc);
            SYNC_LORE_FOR_ROOM(rc);
            return res;
        };
    }

    const _ORIG_APPLY_LORE = window.APPLY_ROLE_VIEW;
    if (typeof _ORIG_APPLY_LORE === 'function') {
        window.APPLY_ROLE_VIEW = function() {
            _ORIG_APPLY_LORE();
            SYNC_LORE_FOR_ROOM(CUR_ROOM());
        };
    }

    SYNC_LORE_FOR_ROOM(CUR_ROOM());
})();