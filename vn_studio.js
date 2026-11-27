// ================================================================
// 🎭 ВИЗУАЛЬНАЯ НОВЕЛЛА NPC И МАСТЕРСКАЯ NPC v2 (vn_studio.js)
// Чистая сцена на карте • Пульт управления под картой • Карточка + 3-вкладочный редактор
// ================================================================
(function INIT_VN_STUDIO_V2() {
    const FB_ROOMS_URL = "https://dnds-23b7d-default-rtdb.firebaseio.com/campaign_v2/rooms";

    const EMOTIONS = [
        { id: 'neutral',   icon: '😐', label: 'Спокойный',  glow: '#c9a96e' },
        { id: 'happy',     icon: '😊', label: 'Радостный',  glow: '#6cb878' },
        { id: 'angry',     icon: '😠', label: 'Злой',       glow: '#d66565' },
        { id: 'surprised', icon: '😮', label: 'Удивлённый', glow: '#5b8fb8' },
        { id: 'sad',       icon: '😢', label: 'Грустный',   glow: '#8b95a5' },
        { id: 'smug',      icon: '😏', label: 'Хитрый',     glow: '#b49bd6' }
    ];

    const ATTITUDES = [
        { id: 'ally',     icon: '🤝', label: 'Союзник',     color: '#6cb878' },
        { id: 'neutral',  icon: '⚖️', label: 'Нейтральный', color: '#d2b278' },
        { id: 'hostile',  icon: '⚔️', label: 'Враждебный',  color: '#d66565' },
        { id: 'merchant', icon: '🏪', label: 'Торговец',    color: '#5b8fb8' },
        { id: 'mystery',  icon: '❓', label: 'Тайный',      color: '#b49bd6' }
    ];

    window._vnNpcsCache = {};
    window._vnSceneCache = {};
    window._vnUi = {
        minimized: false,
        historyOpen: false,
        instantText: localStorage.getItem('dnd_vn_instant_text') === '1',
        playerActionMode: false,
        gmSpeakMode: 'speech',      // 'speech' | 'whisper' | 'narrator'
        gmChoicesOpen: false,
        gmSecondPickerOpen: false,
        search: '',
        attFilter: 'all',
        selectedId: null,
        previewEmo: 'neutral',
        editMode: false,            // false = чистая карточка NPC, true = редактор с 3 вкладками
        editTab: 'main',            // 'main' | 'art' | 'dialog'
        editArtEmo: 'neutral',
        draft: null,
        lastTypedKey: ''
    };

    let activeRoom = null;
    let npcsRef = null;
    let sceneRef = null;
    let typeTimer = null;

    const ESC = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const ESC_JS = s => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const CUR_ROOM = () => { const s = (typeof GET_SESSION === 'function') ? GET_SESSION() : null; return (s && s.roomCode) ? String(s.roomCode) : null; };
    const IS_GM = () => { const s = (typeof GET_SESSION === 'function') ? GET_SESSION() : null; return !!(s && s.role === 'gm'); };
    const MY_PIDX = () => { const s = (typeof GET_SESSION === 'function') ? GET_SESSION() : null; return (s && s.role === 'player') ? (s.playerIdx || PI || 0) : -1; };
    const GET_EMO = id => EMOTIONS.find(e => e.id === id) || EMOTIONS[0];
    const GET_ATT = id => ATTITUDES.find(a => a.id === id) || ATTITUDES[1];

    function GET_NPC_SPRITE(npc, emotionId) {
        if (!npc) return '';
        const emos = npc.emotions || {};
        return emos[emotionId] || emos.neutral || npc.avatar || '';
    }

    // Аккуратный тёмно-фэнтезийный силуэт (вместо жёлтого смайлика, пока не загружен арт)
    function BUILD_SILHOUETTE_SVG(accentColor, sizePx = 110) {
        const col = accentColor || '#c9a96e';
        return `
            <svg width="${sizePx}" height="${Math.round(sizePx * 1.15)}" viewBox="0 0 120 138" fill="none" xmlns="http://www.w3.org/2000/svg" style="display:block; filter:drop-shadow(0 6px 16px rgba(0,0,0,0.8));">
                <defs>
                    <linearGradient id="vnSilG_${col.replace('#','')}" x1="60" y1="8" x2="60" y2="134" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stop-color="#302b25"/>
                        <stop offset="100%" stop-color="#171512"/>
                    </linearGradient>
                </defs>
                <path d="M60 12C43 12 31 24 31 41C31 53 38 63 46 67C28 73 14 91 12 128C12 132 15 134 19 134H101C105 134 108 132 108 128C106 91 92 73 74 67C82 63 89 53 89 41C89 24 77 12 60 12Z"
                      fill="url(#vnSilG_${col.replace('#','')})" stroke="${col}" stroke-width="2.2" stroke-opacity="0.72"/>
                <path d="M40 72L60 92L80 72" stroke="${col}" stroke-width="1.6" stroke-opacity="0.45" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>`;
    }

    // --- 1. СТИЛИ ---
    function ENSURE_VN_CSS() {
        let st = document.getElementById('vn-studio-css');
        if (!st) {
            st = document.createElement('style');
            st.id = 'vn-studio-css';
            document.head.appendChild(st);
        }
        st.textContent = `
            /* Сцена Визуальной Новеллы поверх карты (чистая, без завалов кнопками) */
            .vn-stage {
                position: absolute; inset: 0; z-index: 15;
                display: flex; flex-direction: column; justify-content: flex-end;
                overflow: hidden;
                background: radial-gradient(circle at 50% 30%, rgba(18,16,14,0.42) 0%, rgba(10,9,8,0.86) 100%);
                backdrop-filter: blur(4px);
            }
            .vn-topbar {
                position: absolute; top: 10px; left: 12px; right: 12px; z-index: 6;
                display: flex; justify-content: space-between; align-items: center; gap: 8px; flex-wrap: wrap;
                pointer-events: none;
            }
            .vn-topbar > * { pointer-events: auto; }
            .vn-glass-btn {
                background: rgba(18, 16, 14, 0.88) !important;
                color: #ebe6dc !important;
                border: 1px solid rgba(201, 169, 110, 0.48) !important;
                border-radius: 7px !important;
                padding: 5px 11px !important;
                font-size: 0.8rem !important;
                font-weight: 600 !important;
                cursor: pointer;
                box-shadow: 0 3px 10px rgba(0,0,0,0.45) !important;
                line-height: 1.2 !important;
            }
            .vn-glass-btn:hover { border-color: #d2b278 !important; background: rgba(34, 30, 26, 0.95) !important; }
            .vn-glass-btn.is-danger { background: rgba(118, 44, 44, 0.92) !important; border-color: #b85c5c !important; color: #fff !important; }

            .vn-actors {
                flex: 1; min-height: 160px;
                display: flex; align-items: flex-end; justify-content: center;
                gap: 28px; padding: 44px 24px 0 24px;
                pointer-events: none;
            }
            .vn-actors.two { justify-content: space-between; padding: 44px 10% 0 10%; }
            .vn-actor {
                display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
                position: relative; max-width: 44%; pointer-events: auto;
                transition: transform 0.22s ease, filter 0.22s ease, opacity 0.22s ease;
            }
            .vn-actor.speaking { transform: translateY(-2px) scale(1.03); opacity: 1; filter: brightness(1.04); z-index: 2; }
            .vn-actor.listening { transform: translateY(8px) scale(0.93); opacity: 0.82; filter: brightness(0.55) saturate(0.75); z-index: 1; }
            .vn-actor-img {
                max-height: 255px; max-width: 260px; object-fit: contain;
                filter: drop-shadow(0 10px 24px rgba(0,0,0,0.9));
                border-radius: 8px; user-select: none;
            }
            .vn-actor-tag {
                position: absolute; bottom: 8px;
                background: rgba(14,13,12,0.92); color: #ebe6dc;
                border: 1px solid rgba(201,169,110,0.5);
                border-radius: 14px; padding: 2px 10px;
                font-size: 0.76rem; white-space: nowrap;
                box-shadow: 0 4px 12px rgba(0,0,0,0.75);
            }

            .vn-plate {
                background: linear-gradient(180deg, rgba(22,20,18,0.95) 0%, rgba(13,12,11,0.99) 100%);
                border-top: 2px solid var(--ui-accent, #c9a96e);
                padding: 13px 18px 14px 18px;
                text-align: left; z-index: 4;
                display: flex; flex-direction: column; gap: 7px;
            }
            .vn-speech {
                color: #f4f0e8; font-size: 1.04rem; line-height: 1.5;
                max-height: 105px; overflow-y: auto; font-family: Georgia, serif;
                cursor: pointer; white-space: pre-wrap; padding-right: 4px;
            }
            .vn-speech.mode-whisper { color: #d5cfc5; font-style: italic; opacity: 0.9; }
            .vn-speech.mode-narrator { color: #e8cf9b; font-style: italic; }

            .vn-history-overlay {
                position: absolute; inset: 0; z-index: 9;
                background: rgba(14,13,12,0.96); backdrop-filter: blur(5px);
                display: flex; flex-direction: column; padding: 14px 18px; text-align: left;
            }

            /* Пульт сцены под картой (чистый, просторный, в палитре сайта) */
            #vn-dock-panel {
                margin-top: 12px;
                background: var(--ui-panel2, #161412);
                border: 1px solid var(--ui-border-strong, #695c4c);
                border-radius: 10px;
                padding: 12px 14px;
                display: flex; flex-direction: column; gap: 10px;
                text-align: left;
            }
            #vn-dock-panel input[type="text"],
            #vn-dock-panel select {
                background: var(--ui-input-bg, #131110) !important;
                color: var(--ui-text, #e5e0d7) !important;
                border: 1px solid var(--ui-border-strong, #52483c) !important;
                border-radius: 7px; text-align: left !important;
                padding: 7px 10px; box-sizing: border-box; color-scheme: dark;
            }
            .vn-soft-btn {
                background: var(--ui-panel, #221f1c) !important;
                color: var(--ui-text, #e5e0d7) !important;
                border: 1px solid var(--ui-border, #3e372f) !important;
                border-radius: 7px !important;
                padding: 5px 10px !important;
                font-size: 0.82rem !important;
                font-weight: 500 !important;
                cursor: pointer; box-shadow: none !important;
            }
            .vn-soft-btn:hover { border-color: var(--ui-accent, #d2b278) !important; }
            .vn-soft-btn.is-active {
                background: var(--ui-btn-bg, #c8a66a) !important;
                color: var(--ui-btn-text, #1a150f) !important;
                border-color: var(--ui-accent, #d2b278) !important;
                font-weight: 700 !important;
            }

            /* Мастерская NPC (Карточка + 3-вкладочный редактор) */
            .vns-layout {
                display: grid; grid-template-columns: 270px 1fr; gap: 14px;
                height: 62vh; min-height: 430px;
            }
            .vns-sidebar, .vns-main {
                display: flex; flex-direction: column; min-height: 0;
                background: var(--ui-panel2, #161412);
                border: 1px solid var(--ui-border, #3e372f);
                border-radius: 10px; padding: 12px; text-align: left;
            }
            .vns-main { overflow-y: auto; gap: 12px; }
            .vns-layout input[type="text"],
            .vns-layout input[type="url"],
            .vns-layout textarea,
            .vns-layout select {
                background: var(--ui-input-bg, #131110) !important;
                color: var(--ui-text, #e5e0d7) !important;
                border: 1px solid var(--ui-border-strong, #52483c) !important;
                border-radius: 7px !important;
                text-align: left !important;
                box-sizing: border-box !important;
                color-scheme: dark;
            }
            .vns-layout select option { background: var(--ui-panel, #221f1c); color: var(--ui-text, #e5e0d7); }
            .vns-npc-item {
                width: 100%; display: flex; align-items: center; gap: 10px;
                padding: 8px 10px; margin-bottom: 6px; border-radius: 8px;
                background: var(--ui-panel, #221f1c) !important;
                color: var(--ui-text, #e5e0d7) !important;
                border: 1px solid var(--ui-border, #3e372f) !important;
                cursor: pointer; text-align: left; box-shadow: none !important;
            }
            .vns-npc-item:hover { border-color: var(--ui-border-strong, #695c4c) !important; }
            .vns-npc-item.is-selected {
                border-color: var(--ui-accent, #d2b278) !important;
                box-shadow: inset 3px 0 0 var(--ui-accent, #d2b278) !important;
            }
            .vns-emo-grid {
                display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
            }
            .vns-emo-card {
                background: var(--ui-panel, #221f1c);
                border: 1px solid var(--ui-border, #3e372f);
                border-radius: 9px; padding: 8px;
                display: flex; flex-direction: column; align-items: center; gap: 6px;
                cursor: pointer;
            }
            .vns-emo-card.is-active { border-color: var(--ui-accent, #d2b278); }
            @media (max-width: 820px) {
                .vns-layout { grid-template-columns: 1fr !important; height: auto; }
                .vns-sidebar { max-height: 220px; }
                .vns-emo-grid { grid-template-columns: repeat(2, 1fr); }
                .vn-actor-img { max-height: 170px; max-width: 155px; }
                .vn-actors.two { padding: 40px 10px 0 10px; }
            }
        `;
    }

    // --- 2. ХРАНИЛИЩЕ И FIREBASE ПО КОМНАТАМ ---
    function NORMALIZE_NPCS(val) {
        if (!val) return [];
        const arr = Array.isArray(val) ? val : (typeof val === 'object' ? Object.values(val) : []);
        return arr.filter(n => n && n.id && n.name).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    function MIGRATE_LEGACY_NPCS() {
        const legacy = (typeof GET_NPCS === 'function') ? GET_NPCS() : [];
        if (!Array.isArray(legacy)) return [];
        return legacy.filter(n => n && n.name).map((n, i) => ({
            id: 'npc_leg_' + i + '_' + n.name.length,
            name: String(n.name),
            role: String(n.role || ''),
            race: '',
            attitude: /генерал|враг|разбой/i.test(n.name + ' ' + n.role) ? 'hostile' : 'neutral',
            voice: '',
            gmSecret: '',
            avatar: n.avatar || '',
            emotions: n.avatar ? { neutral: n.avatar } : {},
            defaultText: String(n.defaultText || ''),
            choices: String(n.choices || '').split('|').map(x => x.trim()).filter(Boolean),
            quickLines: [],
            updatedAt: 1000 + i
        }));
    }

    function GET_STUDIO_NPCS(rc) {
        const code = String(rc || CUR_ROOM() || '');
        if (!code) return [];
        if (window._vnNpcsCache[code]) return window._vnNpcsCache[code];
        const mig = MIGRATE_LEGACY_NPCS();
        window._vnNpcsCache[code] = mig;
        return mig;
    }

    function SAVE_STUDIO_NPCS(list, rc) {
        const code = String(rc || CUR_ROOM() || '');
        if (!code) return;
        const clean = NORMALIZE_NPCS(list);
        window._vnNpcsCache[code] = clean;

        const obj = {};
        clean.forEach(n => { obj[n.id] = n; });
        if (window.firebase && firebase.apps && firebase.apps.length) {
            firebase.database().ref(`campaign_v2/rooms/${code}/vn_studio/npcs`).set(obj).catch(() => {});
        } else {
            fetch(`${FB_ROOMS_URL}/${encodeURIComponent(code)}/vn_studio/npcs.json`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(obj)
            }).catch(() => {});
        }
    }

    function GET_LIVE_SCENE(rc) {
        const code = String(rc || CUR_ROOM() || '');
        return code ? (window._vnSceneCache[code] || null) : null;
    }

    function SAVE_LIVE_SCENE(scene, rc) {
        const code = String(rc || CUR_ROOM() || '');
        if (!code) return;
        window._vnSceneCache[code] = scene || null;

        if (typeof SAVE_ACTIVE_VN_DIALOG === 'function' && typeof GET_ACTIVE_VN_DIALOG === 'function' && GET_ACTIVE_VN_DIALOG()) {
            SAVE_ACTIVE_VN_DIALOG(null);
        }

        if (window.firebase && firebase.apps && firebase.apps.length) {
            const ref = firebase.database().ref(`campaign_v2/rooms/${code}/vn_studio/scene`);
            if (scene) ref.set(scene).catch(() => {});
            else ref.remove().catch(() => {});
        } else {
            fetch(`${FB_ROOMS_URL}/${encodeURIComponent(code)}/vn_studio/scene.json`, {
                method: scene ? 'PUT' : 'DELETE',
                headers: scene ? { 'Content-Type': 'application/json' } : undefined,
                body: scene ? JSON.stringify(scene) : undefined
            }).catch(() => {});
        }
        RENDER_VN_STAGE_AND_DOCK();
    }

    function SYNC_VN_FOR_ROOM(roomCode) {
        const nextRc = roomCode ? String(roomCode) : null;
        if (nextRc === activeRoom && (!nextRc || sceneRef)) return;

        if (npcsRef) { npcsRef.off(); npcsRef = null; }
        if (sceneRef) { sceneRef.off(); sceneRef = null; }
        activeRoom = nextRc;
        window._vnUi.minimized = false;
        window._vnUi.historyOpen = false;
        window._vnUi.lastTypedKey = '';
        window._vnUi.editMode = false;
        window._vnUi.draft = null;
        if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }

        if (!nextRc) { RENDER_VN_STAGE_AND_DOCK(); return; }

        fetch(`${FB_ROOMS_URL}/${encodeURIComponent(nextRc)}/vn_studio.json`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (activeRoom !== nextRc) return;
                if (data && data.npcs) window._vnNpcsCache[nextRc] = NORMALIZE_NPCS(data.npcs);
                else {
                    const mig = MIGRATE_LEGACY_NPCS();
                    window._vnNpcsCache[nextRc] = mig;
                    if (mig.length && IS_GM()) SAVE_STUDIO_NPCS(mig, nextRc);
                }
                window._vnSceneCache[nextRc] = (data && data.scene && data.scene.active) ? data.scene : null;
                RENDER_VN_STAGE_AND_DOCK();
            })
            .catch(() => {});

        const attach = () => {
            if (activeRoom !== nextRc) return true;
            if (window.firebase && firebase.apps && firebase.apps.length) {
                const base = firebase.database().ref(`campaign_v2/rooms/${nextRc}/vn_studio`);
                npcsRef = base.child('npcs');
                sceneRef = base.child('scene');

                npcsRef.on('value', (snap) => {
                    if (activeRoom !== nextRc) return;
                    const val = snap.val();
                    if (val) window._vnNpcsCache[nextRc] = NORMALIZE_NPCS(val);
                    if (document.getElementById('vn-studio-modal-marker') && !window._vnUi.editMode) {
                        RENDER_NPC_STUDIO_MODAL();
                    }
                    RENDER_VN_STAGE_AND_DOCK();
                });

                sceneRef.on('value', (snap) => {
                    if (activeRoom !== nextRc) return;
                    const val = snap.val();
                    window._vnSceneCache[nextRc] = (val && val.active) ? val : null;
                    RENDER_VN_STAGE_AND_DOCK();
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

    // --- 3. УПРАВЛЕНИЕ СЦЕНОЙ НОВЕЛЛЫ ---
    function APPEND_HISTORY(scene, entry) {
        if (!Array.isArray(scene.history)) scene.history = [];
        const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        scene.history.push(Object.assign({ id: 'h_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5), time }, entry));
        if (scene.history.length > 80) scene.history = scene.history.slice(-80);
    }

    window.VN_START_SCENE_WITH_NPC = function(npcId, startEmotion) {
        if (!IS_GM()) return;
        const npc = GET_STUDIO_NPCS().find(n => n.id === npcId);
        if (!npc) return;

        const emo = startEmotion || window._vnUi.previewEmo || 'neutral';
        const text = (npc.defaultText || '...').trim() || '...';
        const choices = Array.isArray(npc.choices) ? npc.choices.slice() : [];
        const existing = GET_LIVE_SCENE();
        const history = (existing && Array.isArray(existing.history)) ? existing.history.slice() : [];

        const scene = {
            active: true,
            id: 'sc_' + Date.now(),
            leftSlot: { npcId: npc.id, emotion: emo },
            rightSlot: null,
            activeSlot: 'left',
            speakMode: 'speech',
            text,
            textStamp: Date.now(),
            choices,
            playerReplies: [],
            leftPlayers: [],
            history
        };
        APPEND_HISTORY(scene, { kind: 'npc', speaker: npc.name, role: npc.role || '', emotion: emo, text });

        window._vnUi.minimized = false;
        window._vnUi.historyOpen = false;
        window._vnUi.gmSecondPickerOpen = false;
        window._vnUi.gmSpeakMode = 'speech';
        SAVE_LIVE_SCENE(scene);
        CM('gm-tool-modal');
    };

    window.VN_ADD_SECOND_NPC_TO_SCENE = function(npcId) {
        if (!IS_GM()) return;
        const scene = GET_LIVE_SCENE();
        if (!scene || !scene.active) { window.VN_START_SCENE_WITH_NPC(npcId); return; }
        const npc = GET_STUDIO_NPCS().find(n => n.id === npcId);
        if (!npc) return;

        if (scene.leftSlot && scene.leftSlot.npcId === npc.id) {
            scene.activeSlot = 'left';
        } else {
            scene.rightSlot = { npcId: npc.id, emotion: 'neutral' };
            scene.activeSlot = 'right';
        }
        window._vnUi.gmSecondPickerOpen = false;
        if (window._vnUi.gmSpeakMode === 'narrator') window._vnUi.gmSpeakMode = 'speech';
        SAVE_LIVE_SCENE(scene);
        CM('gm-tool-modal');
    };

    window.VN_REMOVE_RIGHT_NPC = function() {
        if (!IS_GM()) return;
        const scene = GET_LIVE_SCENE(); if (!scene) return;
        scene.rightSlot = null;
        if (scene.activeSlot === 'right') scene.activeSlot = 'left';
        SAVE_LIVE_SCENE(scene);
    };

    window.VN_GM_SET_ACTIVE_SLOT = function(slot) {
        if (!IS_GM()) return;
        const scene = GET_LIVE_SCENE(); if (!scene) return;
        if (slot === 'right' && !scene.rightSlot) return;
        scene.activeSlot = slot;
        if (slot === 'narrator') window._vnUi.gmSpeakMode = 'narrator';
        else if (window._vnUi.gmSpeakMode === 'narrator') window._vnUi.gmSpeakMode = 'speech';
        SAVE_LIVE_SCENE(scene);
    };

    window.VN_GM_SET_EMOTION = function(emotionId) {
        if (!IS_GM()) return;
        const scene = GET_LIVE_SCENE(); if (!scene) return;
        const target = (scene.activeSlot === 'right' && scene.rightSlot) ? scene.rightSlot : scene.leftSlot;
        if (target) {
            target.emotion = emotionId;
            SAVE_LIVE_SCENE(scene);
        }
    };

    window.VN_GM_SPEAK = function(presetLine) {
        if (!IS_GM()) return;
        const inp = document.getElementById('vn-gm-live-input');
        const text = (presetLine !== undefined ? presetLine : (inp ? inp.value : '')).trim();
        if (!text) return;
        const scene = GET_LIVE_SCENE(); if (!scene) return;

        const mode = window._vnUi.gmSpeakMode || 'speech';
        const isNarrator = (mode === 'narrator' || scene.activeSlot === 'narrator');
        const npcs = GET_STUDIO_NPCS();
        const activeSlotObj = (scene.activeSlot === 'right' && scene.rightSlot) ? scene.rightSlot : scene.leftSlot;
        const activeNpc = activeSlotObj ? npcs.find(n => n.id === activeSlotObj.npcId) : null;

        scene.speakMode = isNarrator ? 'narrator' : mode;
        scene.text = text;
        scene.textStamp = Date.now();
        scene.playerReplies = [];

        APPEND_HISTORY(scene, isNarrator
            ? { kind: 'narrator', speaker: 'Рассказчик', text }
            : { kind: 'npc', speaker: activeNpc ? activeNpc.name : 'NPC', role: activeNpc?.role || '', emotion: activeSlotObj?.emotion || 'neutral', text, whisper: mode === 'whisper' }
        );

        if (inp && presetLine === undefined) inp.value = '';
        SAVE_LIVE_SCENE(scene);
    };

    window.VN_GM_ADD_LIVE_CHOICE = function() {
        if (!IS_GM()) return;
        const inp = document.getElementById('vn-gm-choice-inp');
        const val = (inp ? inp.value : '').trim();
        if (!val) return;
        const scene = GET_LIVE_SCENE(); if (!scene) return;
        if (!Array.isArray(scene.choices)) scene.choices = [];
        scene.choices.push(val);
        if (inp) inp.value = '';
        SAVE_LIVE_SCENE(scene);
    };

    window.VN_GM_REMOVE_LIVE_CHOICE = function(idx) {
        if (!IS_GM()) return;
        const scene = GET_LIVE_SCENE();
        if (!scene || !Array.isArray(scene.choices)) return;
        scene.choices.splice(idx, 1);
        SAVE_LIVE_SCENE(scene);
    };

    window.VN_GM_END_SCENE = function() {
        if (!IS_GM()) return;
        window._vnUi.historyOpen = false;
        window._vnUi.minimized = false;
        SAVE_LIVE_SCENE(null);
    };

    window.VN_PLAYER_SEND_REPLY = function(presetText, forceAction) {
        const scene = GET_LIVE_SCENE(); if (!scene || !scene.active) return;
        let text = presetText, isAction = !!forceAction;
        if (text === undefined) {
            const inp = document.getElementById('vn-pl-live-input');
            text = (inp ? inp.value : '').trim();
            isAction = !!window._vnUi.playerActionMode;
            if (inp) inp.value = '';
        }
        if (!text) return;
        if (!isAction && /^(уйти|отойти|покинуть|закончить разговор)/i.test(text.trim())) {
            window.VN_PLAYER_LEAVE(); return;
        }
        const heroName = GC()[MY_PIDX()]?.name || 'Игрок';
        if (!Array.isArray(scene.playerReplies)) scene.playerReplies = [];
        scene.playerReplies.push({ sender: heroName, text, isAction, ts: Date.now() });
        if (scene.playerReplies.length > 8) scene.playerReplies = scene.playerReplies.slice(-8);
        APPEND_HISTORY(scene, { kind: 'player', speaker: heroName, text, isAction });
        SAVE_LIVE_SCENE(scene);
    };

    window.VN_PLAYER_LEAVE = function() {
        const scene = GET_LIVE_SCENE(); if (!scene) return;
        const myIdx = MY_PIDX();
        if (!Array.isArray(scene.leftPlayers)) scene.leftPlayers = [];
        if (!scene.leftPlayers.includes(myIdx)) scene.leftPlayers.push(myIdx);
        const heroName = GC()[myIdx]?.name || 'Игрок';
        APPEND_HISTORY(scene, { kind: 'narrator', speaker: 'Сцена', text: `${heroName} отходит от разговора.` });
        SAVE_LIVE_SCENE(scene);
    };

    window.VN_PLAYER_REJOIN = function() {
        const scene = GET_LIVE_SCENE(); if (!scene) return;
        const myIdx = MY_PIDX();
        scene.leftPlayers = (scene.leftPlayers || []).filter(i => i !== myIdx);
        window._vnUi.minimized = false;
        SAVE_LIVE_SCENE(scene);
    };

    window.VN_TOGGLE_INSTANT_TEXT = function() {
        window._vnUi.instantText = !window._vnUi.instantText;
        localStorage.setItem('dnd_vn_instant_text', window._vnUi.instantText ? '1' : '0');
        RENDER_VN_STAGE_AND_DOCK();
    };

    // --- 4. ОТРИСОВКА ЧИСТОЙ СЦЕНЫ НА КАРТЕ + УДОБНОГО ПУЛЬТА ПОД КАРТОЙ ---
    function RUN_TYPEWRITER(elId, fullText, stampKey, quoteWrap) {
        if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
        const el = document.getElementById(elId); if (!el) return;
        const formatted = quoteWrap ? `«${fullText}»` : fullText;

        if (window._vnUi.instantText || window._vnUi.lastTypedKey === stampKey || fullText.length > 420) {
            el.textContent = formatted;
            window._vnUi.lastTypedKey = stampKey;
            return;
        }
        window._vnUi.lastTypedKey = stampKey;
        el.textContent = '';
        let pos = 0;
        const step = Math.max(1, Math.ceil(formatted.length / 42));
        typeTimer = setInterval(() => {
            pos += step;
            if (pos >= formatted.length) { el.textContent = formatted; clearInterval(typeTimer); typeTimer = null; }
            else el.textContent = formatted.slice(0, pos);
        }, 20);
        el.onclick = () => { if (typeTimer) { clearInterval(typeTimer); typeTimer = null; el.textContent = formatted; } };
    }

    function RENDER_VN_STAGE_AND_DOCK() {
        ENSURE_VN_CSS();
        const mapArea = document.getElementById('map-area');
        if (!mapArea) return;
        const mapPanel = mapArea.parentElement;
        const gmMapBtns = document.getElementById('gm-map-edit-btn-wrap');

        // Сохраняем текст и фокус ввода в пульте под картой
        const prevGmVal = document.getElementById('vn-gm-live-input')?.value || '';
        const prevPlVal = document.getElementById('vn-pl-live-input')?.value || '';
        const prevChVal = document.getElementById('vn-gm-choice-inp')?.value || '';
        const focusId = document.activeElement ? document.activeElement.id : '';

        mapArea.querySelectorAll('#vn-stage-root, #vn-mini-bar').forEach(n => n.remove());
        const oldDock = document.getElementById('vn-dock-panel');

        const scene = GET_LIVE_SCENE();
        const isGM = IS_GM();
        const myIdx = MY_PIDX();

        if (!scene || !scene.active) {
            if (oldDock) oldDock.remove();
            if (gmMapBtns && isGM) gmMapBtns.style.display = 'block';
            return;
        }

        const npcs = GET_STUDIO_NPCS();
        const leftNpc = scene.leftSlot ? npcs.find(n => n.id === scene.leftSlot.npcId) : null;
        const rightNpc = scene.rightSlot ? npcs.find(n => n.id === scene.rightSlot.npcId) : null;
        const activeNpc = (scene.activeSlot === 'right' && rightNpc) ? rightNpc : leftNpc;
        const activeSlotObj = (scene.activeSlot === 'right' && scene.rightSlot) ? scene.rightSlot : scene.leftSlot;
        const isNarrator = (scene.speakMode === 'narrator' || scene.activeSlot === 'narrator');
        const isLeftOut = (!isGM && Array.isArray(scene.leftPlayers) && scene.leftPlayers.includes(myIdx));

        // Если сцена свёрнута к карте или игрок отошёл — показываем компактную полоску и возвращаем кнопки карты
        if (isLeftOut || window._vnUi.minimized) {
            if (oldDock) oldDock.remove();
            if (gmMapBtns && isGM) gmMapBtns.style.display = 'block';

            const mini = document.createElement('div');
            mini.id = 'vn-mini-bar';
            mini.style.cssText = 'position:absolute; top:10px; left:50%; transform:translateX(-50%); z-index:16; background:rgba(18,16,14,0.95); border:1px solid #c9a96e; border-radius:20px; padding:5px 14px; display:flex; align-items:center; gap:10px; box-shadow:0 6px 20px rgba(0,0,0,0.8);';
            mini.onclick = e => e.stopPropagation();
            mini.innerHTML = `
                <span style="color:#e6c88c; font-size:0.84rem; font-weight:600;">🎭 ${isLeftOut ? 'Идёт диалог:' : 'Диалог свёрнут:'} ${ESC(activeNpc ? activeNpc.name : 'NPC')}</span>
                <button class="btn-small btn-save" style="padding:3px 10px; font-size:0.78rem;" onclick="${isLeftOut ? 'VN_PLAYER_REJOIN()' : 'window._vnUi.minimized=false; RENDER_VN_STAGE_AND_DOCK();'}">${isLeftOut ? 'Вернуться' : 'Развернуть'}</button>
            `;
            mapArea.appendChild(mini);
            return;
        }

        // Пока новелла развёрнута — прячем кнопки редактирования карты, на их место встаёт пульт сцены
        if (gmMapBtns && isGM) gmMapBtns.style.display = 'none';

        // 1. ЧИСТАЯ СЦЕНА НА КАРТЕ
        const renderActor = (npc, slotObj, slotName) => {
            if (!npc || !slotObj) return '';
            const emo = GET_EMO(slotObj.emotion);
            const att = GET_ATT(npc.attitude);
            const sprite = GET_NPC_SPRITE(npc, slotObj.emotion);
            const speaking = !isNarrator && (scene.activeSlot === slotName);
            const hasCustomEmo = !!(npc.emotions && npc.emotions[slotObj.emotion] && slotObj.emotion !== 'neutral');
            const clickAttr = isGM ? `onclick="VN_GM_SET_ACTIVE_SLOT('${slotName}')" style="cursor:pointer;" title="Переключить говорящего на ${ESC(npc.name)}"` : '';

            return `
                <div class="vn-actor ${speaking ? 'speaking' : 'listening'}" ${clickAttr}>
                    ${sprite
                        ? `<img src="${sprite}" class="vn-actor-img" alt="${ESC(npc.name)}">`
                        : BUILD_SILHOUETTE_SVG(att.color, leftNpc && rightNpc ? 115 : 138)}
                    <div class="vn-actor-tag">
                        ${(slotObj.emotion && slotObj.emotion !== 'neutral') || hasCustomEmo ? `${emo.icon} ` : ''}<b>${ESC(npc.name)}</b>
                    </div>
                </div>`;
        };

        const twoActors = !!(leftNpc && rightNpc);
        const actorsHTML = renderActor(leftNpc, scene.leftSlot, 'left') + renderActor(rightNpc, scene.rightSlot, 'right');

        const replies = Array.isArray(scene.playerReplies) ? scene.playerReplies.slice(-2) : [];
        const repliesHTML = replies.length ? `
            <div style="border-top:1px dashed rgba(255,255,255,0.12); padding-top:6px; display:flex; flex-direction:column; gap:4px;">
                ${replies.map(r => `
                    <div style="background:rgba(63,110,73,0.25); border-left:3px solid #6cb878; padding:4px 10px; border-radius:4px; font-size:0.86rem; color:#dff5e2;">
                        ${r.isAction ? `✨ <b>${ESC(r.sender)}</b> <i>${ESC(r.text)}</i>` : `🗣️ <b>${ESC(r.sender)}:</b> «${ESC(r.text)}»`}
                    </div>`).join('')}
            </div>` : '';

        let historyHTML = '';
        if (window._vnUi.historyOpen) {
            const hist = Array.isArray(scene.history) ? scene.history : [];
            historyHTML = `
                <div class="vn-history-overlay" onclick="event.stopPropagation();">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid rgba(255,255,255,0.12); padding-bottom:8px; margin-bottom:10px;">
                        <b style="color:#e6c88c; font-size:1rem;">📜 История диалога (${hist.length})</b>
                        <button data-custom-bg="1" class="vn-glass-btn" onclick="window._vnUi.historyOpen=false; RENDER_VN_STAGE_AND_DOCK();">✕ К сцене</button>
                    </div>
                    <div id="vn-hist-scroll" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:7px; padding-right:4px;">
                        ${hist.map(h => {
                            const emo = (h.emotion && h.emotion !== 'neutral') ? GET_EMO(h.emotion).icon + ' ' : '';
                            const col = h.kind === 'player' ? '#6cb878' : (h.kind === 'narrator' ? '#9e978b' : '#d2b278');
                            return `<div style="background:rgba(30,27,24,0.92); border:1px solid rgba(255,255,255,0.08); border-left:3px solid ${col}; border-radius:7px; padding:7px 11px; font-size:0.87rem;">
                                <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:2px;">
                                    <b style="color:${col};">${emo}${ESC(h.speaker)}${h.role ? ` <small style="color:#8f887d; font-weight:normal;">— ${ESC(h.role)}</small>` : ''}</b>
                                    <small style="color:#8f887d; font-size:0.74rem !important;">${ESC(h.time || '')}</small>
                                </div>
                                <div style="color:${h.isAction || h.whisper || h.kind === 'narrator' ? '#cbc4b8; font-style:italic' : '#f1ede6'}; line-height:1.42;">${ESC(h.text)}</div>
                            </div>`;
                        }).join('') || '<div style="text-align:center; color:#888; padding:24px;">История пока пуста</div>'}
                    </div>
                </div>`;
        }

        const attInfo = activeNpc ? GET_ATT(activeNpc.attitude) : null;
        const leftBadge = (isGM && scene.leftPlayers && scene.leftPlayers.length)
            ? `<small style="color:#e07a7a;">• Отошли: ${scene.leftPlayers.map(i => GC()[i]?.name || 'Игрок').join(', ')}</small>` : '';

        const stage = document.createElement('div');
        stage.id = 'vn-stage-root';
        stage.className = 'vn-stage';
        stage.onclick = e => e.stopPropagation();
        stage.ondblclick = e => e.stopPropagation();

        stage.innerHTML = `
            <div class="vn-topbar">
                <div style="display:flex; gap:6px; align-items:center;">
                    <button data-custom-bg="1" class="vn-glass-btn" onclick="window._vnUi.historyOpen=!window._vnUi.historyOpen; RENDER_VN_STAGE_AND_DOCK();">📜 История (${(scene.history || []).length})</button>
                    <button data-custom-bg="1" class="vn-glass-btn" onclick="window._vnUi.minimized=true; RENDER_VN_STAGE_AND_DOCK();">🗺️ Карта</button>
                    <button data-custom-bg="1" class="vn-glass-btn" title="Переключить эффект печати текста" onclick="VN_TOGGLE_INSTANT_TEXT()">${window._vnUi.instantText ? '⚡ Сразу' : '⌨️ Печать'}</button>
                </div>
                ${isGM ? `<button data-custom-bg="1" class="vn-glass-btn is-danger" onclick="VN_GM_END_SCENE()">✕ Завершить сцену</button>` : ''}
            </div>

            <div class="vn-actors ${twoActors ? 'two' : ''}">
                ${actorsHTML}
            </div>

            <div class="vn-plate">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                    <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                        ${isNarrator
                            ? `<span style="background:rgba(201,169,110,0.16); border:1px solid #c9a96e; color:#e6c88c; font-weight:700; padding:2px 10px; border-radius:5px; font-size:0.9rem;">📖 Рассказчик</span>`
                            : `<span style="background:#c9a96e; color:#18140f; font-weight:700; padding:2px 11px; border-radius:5px; font-size:0.94rem;">${ESC(activeNpc ? activeNpc.name : 'NPC')}</span>
                               ${activeNpc?.role ? `<span style="color:#a8a094; font-size:0.86rem;">${ESC(activeNpc.role)}</span>` : ''}
                               ${attInfo ? `<span style="font-size:0.78rem; color:${attInfo.color};">● ${attInfo.label}</span>` : ''}`}
                        ${leftBadge}
                    </div>
                    ${isGM && activeNpc?.voice ? `<small style="color:#9e978b; font-style:italic;">🎙️ ${ESC(activeNpc.voice)}</small>` : ''}
                </div>
                <div id="vn-live-speech" class="vn-speech mode-${scene.speakMode || 'speech'}" title="Кликните, чтобы показать фразу целиком"></div>
                ${repliesHTML}
            </div>

            ${historyHTML}
        `;
        mapArea.appendChild(stage);
        RUN_TYPEWRITER('vn-live-speech', scene.text || '...', `${scene.id}_${scene.textStamp}`, !isNarrator);

        if (window._vnUi.historyOpen) {
            const sc = document.getElementById('vn-hist-scroll');
            if (sc) sc.scrollTop = sc.scrollHeight;
        }

        // 2. ПУЛЬТ УПРАВЛЕНИЯ ПОД КАРТОЙ (РАЗНЫЙ ДЛЯ ИГРОКА И ГМ)
        let dock = oldDock;
        if (!dock && mapPanel) {
            dock = document.createElement('div');
            dock.id = 'vn-dock-panel';
            mapArea.after(dock);
        }
        if (!dock) return;

        if (!isGM) {
            const choicesBtns = (scene.choices || []).map(ch => {
                const isLeave = /^(уйти|отойти|покинуть|закончить)/i.test(ch.trim());
                return `<button data-custom-bg="1" class="vn-soft-btn ${isLeave ? '' : ''}" style="${isLeave ? 'border-color:#9e5858 !important; color:#f2b8b8 !important;' : ''}" onclick="VN_PLAYER_SEND_REPLY('${ESC_JS(ch)}', false)">${isLeave ? '🚪 ' : '💬 '}${ESC(ch)}</button>`;
            }).join('');

            dock.innerHTML = `
                ${choicesBtns ? `<div style="display:flex; gap:6px; flex-wrap:wrap;">${choicesBtns}</div>` : ''}
                <div style="display:flex; gap:7px; align-items:center; flex-wrap:wrap;">
                    <button data-custom-bg="1" class="vn-soft-btn ${window._vnUi.playerActionMode ? 'is-active' : ''}" onclick="window._vnUi.playerActionMode=!window._vnUi.playerActionMode; RENDER_VN_STAGE_AND_DOCK();" title="Переключить: прямая речь или описание действия">
                        ${window._vnUi.playerActionMode ? '✨ *Действие*' : '💬 Речь'}
                    </button>
                    <input type="text" id="vn-pl-live-input" value="${ESC(prevPlVal)}"
                        placeholder="${window._vnUi.playerActionMode ? 'Опишите действие персонажа...' : `Ответить «${ESC(activeNpc ? activeNpc.name : 'NPC')}»...`}"
                        onkeypress="if(event.key==='Enter'){ event.preventDefault(); VN_PLAYER_SEND_REPLY(); }"
                        style="flex:1; min-width:180px;">
                    <button class="btn-save" style="padding:7px 14px;" onclick="VN_PLAYER_SEND_REPLY()">Ответить</button>
                    <button class="btn-small btn-danger" style="padding:7px 10px;" onclick="VN_PLAYER_LEAVE()">🚪 Отойти</button>
                </div>
            `;
        } else {
            const gmM = window._vnUi.gmSpeakMode || 'speech';
            const curEmo = activeSlotObj ? (activeSlotObj.emotion || 'neutral') : 'neutral';
            const otherNpcs = npcs.filter(n => n.id !== scene.leftSlot?.npcId && n.id !== scene.rightSlot?.npcId);
            const quickLines = (activeNpc && Array.isArray(activeNpc.quickLines)) ? activeNpc.quickLines : [];

            const secondPickerHTML = window._vnUi.gmSecondPickerOpen ? `
                <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; padding:8px 10px; background:var(--ui-panel,#221f1c); border:1px solid var(--ui-border,#3e372f); border-radius:8px;">
                    <span style="font-size:0.8rem; color:var(--ui-muted,#aaa);">Добавить вторым в кадр:</span>
                    ${otherNpcs.length
                        ? otherNpcs.map(n => `<button data-custom-bg="1" class="vn-soft-btn" onclick="VN_ADD_SECOND_NPC_TO_SCENE('${ESC_JS(n.id)}')">+ ${ESC(n.name)}</button>`).join('')
                        : `<small style="color:var(--ui-muted,#888);">Создайте ещё одного NPC в Каталоге</small>`}
                    <button data-custom-bg="1" class="vn-soft-btn" style="margin-left:auto;" onclick="window._vnUi.gmSecondPickerOpen=false; RENDER_VN_STAGE_AND_DOCK();">✕</button>
                </div>` : '';

            const choicesPanelHTML = window._vnUi.gmChoicesOpen ? `
                <div style="display:flex; flex-direction:column; gap:7px; padding:9px 10px; background:var(--ui-panel,#221f1c); border:1px solid var(--ui-border,#3e372f); border-radius:8px;">
                    <div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center;">
                        <small style="color:var(--ui-muted,#aaa); margin-right:4px;">Кнопки у игроков:</small>
                        ${(scene.choices || []).map((ch, i) => `
                            <span style="display:inline-flex; align-items:center; gap:6px; background:var(--ui-panel2,#161412); border:1px solid var(--ui-accent,#d2b278); color:var(--ui-accent,#d2b278); padding:3px 8px; border-radius:6px; font-size:0.8rem;">
                                ${ESC(ch)} <b style="cursor:pointer; color:#e07a7a;" onclick="VN_GM_REMOVE_LIVE_CHOICE(${i})">✕</b>
                            </span>`).join('') || '<small style="color:var(--ui-muted,#777);">нет (игроки пишут сами)</small>'}
                    </div>
                    <div style="display:flex; gap:6px;">
                        <input type="text" id="vn-gm-choice-inp" value="${ESC(prevChVal)}" placeholder="Добавить вариант ответа игрокам..." onkeypress="if(event.key==='Enter'){ event.preventDefault(); VN_GM_ADD_LIVE_CHOICE(); }" style="flex:1;">
                        <button class="btn-small btn-save" onclick="VN_GM_ADD_LIVE_CHOICE()">+ Добавить</button>
                    </div>
                </div>` : '';

            const quickLinesHTML = quickLines.length ? `
                <div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center;">
                    <small style="color:var(--ui-muted,#888);">⚡ Заготовки:</small>
                    ${quickLines.map(ql => `<button data-custom-bg="1" class="vn-soft-btn" style="padding:3px 8px !important; font-size:0.78rem !important;" onclick="VN_GM_SPEAK('${ESC_JS(ql)}')">«${ESC(ql.length > 38 ? ql.slice(0, 38) + '…' : ql)}»</button>`).join('')}
                </div>` : '';

            dock.innerHTML = `
                <!-- Строка 1: Кто говорит + 2-й NPC + Эмоция -->
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                    <div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center;">
                        ${leftNpc ? `<button data-custom-bg="1" class="vn-soft-btn ${scene.activeSlot === 'left' && gmM !== 'narrator' ? 'is-active' : ''}" onclick="window._vnUi.gmSpeakMode='speech'; VN_GM_SET_ACTIVE_SLOT('left');">🎭 ${ESC(leftNpc.name)}</button>` : ''}
                        ${rightNpc
                            ? `<button data-custom-bg="1" class="vn-soft-btn ${scene.activeSlot === 'right' && gmM !== 'narrator' ? 'is-active' : ''}" onclick="window._vnUi.gmSpeakMode='speech'; VN_GM_SET_ACTIVE_SLOT('right');">🎭 ${ESC(rightNpc.name)}</button>
                               <button data-custom-bg="1" class="vn-soft-btn" title="Убрать второго NPC" onclick="VN_REMOVE_RIGHT_NPC()">✕</button>`
                            : `<button data-custom-bg="1" class="vn-soft-btn" onclick="window._vnUi.gmSecondPickerOpen=!window._vnUi.gmSecondPickerOpen; RENDER_VN_STAGE_AND_DOCK();">+ 2-й NPC</button>`}
                        <button data-custom-bg="1" class="vn-soft-btn ${gmM === 'narrator' ? 'is-active' : ''}" onclick="window._vnUi.gmSpeakMode='narrator'; VN_GM_SET_ACTIVE_SLOT('narrator');">📖 Рассказчик</button>
                    </div>

                    ${gmM !== 'narrator' ? `
                        <div style="display:flex; gap:4px; flex-wrap:wrap; align-items:center;">
                            ${EMOTIONS.map(em => {
                                const hasArt = !!(activeNpc && activeNpc.emotions && activeNpc.emotions[em.id]);
                                return `<button data-custom-bg="1" class="vn-soft-btn ${curEmo === em.id ? 'is-active' : ''}" style="padding:4px 7px !important; ${hasArt && curEmo !== em.id ? 'border-color:#588a62 !important;' : ''}" title="${em.label}${hasArt ? ' (есть спрайт)' : ''}" onclick="VN_GM_SET_EMOTION('${em.id}')">${em.icon}</button>`;
                            }).join('')}
                        </div>` : ''}
                </div>

                ${secondPickerHTML}

                <!-- Строка 2: Ввод реплики -->
                <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                    ${gmM !== 'narrator' ? `
                        <button data-custom-bg="1" class="vn-soft-btn ${gmM === 'whisper' ? 'is-active' : ''}" title="Переключить: обычная речь или тихий шёпот"
                            onclick="window._vnUi.gmSpeakMode=(window._vnUi.gmSpeakMode==='whisper'?'speech':'whisper'); RENDER_VN_STAGE_AND_DOCK();">
                            ${gmM === 'whisper' ? '💭 Шёпот' : '💬 Речь'}
                        </button>` : ''}
                    <input type="text" id="vn-gm-live-input" value="${ESC(prevGmVal)}"
                        placeholder="${gmM === 'narrator' ? 'Опишите происходящее от лица Рассказчика...' : `Фраза от лица «${ESC(activeNpc ? activeNpc.name : 'NPC')}»...`}"
                        onkeypress="if(event.key==='Enter'){ event.preventDefault(); VN_GM_SPEAK(); }"
                        style="flex:1; min-width:200px;">
                    <button class="btn-save" style="padding:7px 15px;" onclick="VN_GM_SPEAK()">Отправить</button>
                </div>

                ${quickLinesHTML}
                ${choicesPanelHTML}

                <!-- Строка 3: Вспомогательные инструменты сцены -->
                <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap; padding-top:4px; border-top:1px dashed var(--ui-border,#3e372f);">
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <button data-custom-bg="1" class="vn-soft-btn ${window._vnUi.gmChoicesOpen ? 'is-active' : ''}" onclick="window._vnUi.gmChoicesOpen=!window._vnUi.gmChoicesOpen; RENDER_VN_STAGE_AND_DOCK();">💬 Варианты ответов (${(scene.choices || []).length})</button>
                        <button data-custom-bg="1" class="vn-soft-btn" onclick="OPEN_GM_SKILL_CHECK_MODAL()">🎯 Проверка навыка</button>
                        <button data-custom-bg="1" class="vn-soft-btn" onclick="OPEN_GM_SHOP_MODAL()">🏪 Лавка</button>
                        <button data-custom-bg="1" class="vn-soft-btn" onclick="OPEN_GM_NPC_MODAL()">🎭 Все NPC</button>
                    </div>
                </div>
            `;
        }

        if (focusId && document.getElementById(focusId)) {
            const el = document.getElementById(focusId);
            el.focus();
            if (typeof el.setSelectionRange === 'function') el.setSelectionRange(el.value.length, el.value.length);
        }
    }

    // --- 5. МАСТЕРСКАЯ NPC (КАРТОЧКА ПРОСМОТРА + 3-ВКЛАДОЧНЫЙ РЕДАКТОР) ---
    function SYNC_DRAFT_FROM_CURRENT_TAB() {
        const d = window._vnUi.draft; if (!d) return;
        const t = window._vnUi.editTab;
        if (t === 'main') {
            d.name = document.getElementById('vns-f-name')?.value ?? d.name;
            d.role = document.getElementById('vns-f-role')?.value ?? d.role;
            d.race = document.getElementById('vns-f-race')?.value ?? d.race;
            d.voice = document.getElementById('vns-f-voice')?.value ?? d.voice;
            d.gmSecret = document.getElementById('vns-f-secret')?.value ?? d.gmSecret;
        } else if (t === 'dialog') {
            d.defaultText = document.getElementById('vns-f-greeting')?.value ?? d.defaultText;
        }
    }

    window.VNS_SELECT_NPC = function(npcId) {
        window._vnUi.selectedId = npcId;
        window._vnUi.editMode = false;
        window._vnUi.draft = null;
        window._vnUi.previewEmo = 'neutral';
        RENDER_NPC_STUDIO_MODAL();
    };

    window.VNS_START_EDIT = function(npcId) {
        const n = npcId ? GET_STUDIO_NPCS().find(x => x.id === npcId) : null;
        window._vnUi.editMode = true;
        window._vnUi.editTab = 'main';
        window._vnUi.editArtEmo = 'neutral';
        window._vnUi.draft = n ? JSON.parse(JSON.stringify(n)) : {
            id: null, name: '', role: '', race: '', attitude: 'neutral',
            voice: '', gmSecret: '', avatar: '', emotions: {},
            defaultText: '', choices: ['Расспросить подробнее', 'Спросить про награду', 'Уйти'], quickLines: []
        };
        if (!window._vnUi.draft.emotions) window._vnUi.draft.emotions = {};
        if (!Array.isArray(window._vnUi.draft.choices)) window._vnUi.draft.choices = [];
        if (!Array.isArray(window._vnUi.draft.quickLines)) window._vnUi.draft.quickLines = [];
        RENDER_NPC_STUDIO_MODAL();
    };

    window.VNS_SWITCH_EDIT_TAB = function(tab) {
        SYNC_DRAFT_FROM_CURRENT_TAB();
        window._vnUi.editTab = tab;
        RENDER_NPC_STUDIO_MODAL();
    };

    window.VNS_SET_DRAFT_ATTITUDE = function(attId) {
        SYNC_DRAFT_FROM_CURRENT_TAB();
        if (window._vnUi.draft) window._vnUi.draft.attitude = attId;
        RENDER_NPC_STUDIO_MODAL();
    };

    window.VNS_UPLOAD_EMO_FILE = function(emoId) {
        SYNC_DRAFT_FROM_CURRENT_TAB();
        window._vnUi.editArtEmo = emoId;
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*';
        inp.onchange = function(e) {
            const f = e.target.files[0]; if (!f) return;
            const reader = new FileReader();
            reader.onload = ev => {
                const img = new Image();
                img.onload = () => {
                    const maxSide = 520;
                    const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
                    const c = document.createElement('canvas');
                    c.width = Math.max(1, Math.round(img.width * scale));
                    c.height = Math.max(1, Math.round(img.height * scale));
                    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                    const dataUrl = /png|webp/i.test(f.type) ? c.toDataURL('image/webp', 0.85) : c.toDataURL('image/jpeg', 0.83);
                    if (window._vnUi.draft) {
                        if (!window._vnUi.draft.emotions) window._vnUi.draft.emotions = {};
                        window._vnUi.draft.emotions[emoId] = dataUrl;
                        if (emoId === 'neutral' || !window._vnUi.draft.avatar) window._vnUi.draft.avatar = dataUrl;
                    }
                    RENDER_NPC_STUDIO_MODAL();
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(f);
        };
        inp.click();
    };

    window.VNS_APPLY_EMO_URL = function() {
        const emoId = window._vnUi.editArtEmo || 'neutral';
        const url = (document.getElementById('vns-art-url-inp')?.value || '').trim();
        if (!url || !/^https?:\/\//i.test(url)) {
            showMessage('⚠️ Некорректная ссылка', 'Вставьте прямую ссылку на картинку, начинающуюся с https://');
            return;
        }
        if (window._vnUi.draft) {
            if (!window._vnUi.draft.emotions) window._vnUi.draft.emotions = {};
            window._vnUi.draft.emotions[emoId] = url;
            if (emoId === 'neutral' || !window._vnUi.draft.avatar) window._vnUi.draft.avatar = url;
        }
        RENDER_NPC_STUDIO_MODAL();
    };

    window.VNS_CLEAR_EMO = function(emoId) {
        if (!window._vnUi.draft?.emotions) return;
        delete window._vnUi.draft.emotions[emoId];
        if (emoId === 'neutral') window._vnUi.draft.avatar = Object.values(window._vnUi.draft.emotions)[0] || '';
        RENDER_NPC_STUDIO_MODAL();
    };

    window.VNS_ADD_DRAFT_CHIP = function(field, inpId) {
        SYNC_DRAFT_FROM_CURRENT_TAB();
        const inp = document.getElementById(inpId);
        const val = (inp ? inp.value : '').trim();
        if (!val || !window._vnUi.draft) return;
        if (!Array.isArray(window._vnUi.draft[field])) window._vnUi.draft[field] = [];
        window._vnUi.draft[field].push(val);
        RENDER_NPC_STUDIO_MODAL();
    };

    window.VNS_REMOVE_DRAFT_CHIP = function(field, idx) {
        SYNC_DRAFT_FROM_CURRENT_TAB();
        if (!window._vnUi.draft || !Array.isArray(window._vnUi.draft[field])) return;
        window._vnUi.draft[field].splice(idx, 1);
        RENDER_NPC_STUDIO_MODAL();
    };

    window.VNS_SAVE_DRAFT = function() {
        if (!IS_GM()) return;
        SYNC_DRAFT_FROM_CURRENT_TAB();
        const d = window._vnUi.draft;
        if (!d || !String(d.name || '').trim()) {
            window._vnUi.editTab = 'main';
            RENDER_NPC_STUDIO_MODAL();
            showMessage('⚠️ Введите имя', 'Укажите имя NPC на вкладке «👤 Основное».');
            return;
        }
        const list = GET_STUDIO_NPCS().slice();
        const id = d.id || ('npc_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6));
        const saved = {
            id,
            name: String(d.name).trim(),
            role: String(d.role || '').trim(),
            race: String(d.race || '').trim(),
            attitude: d.attitude || 'neutral',
            voice: String(d.voice || '').trim(),
            gmSecret: String(d.gmSecret || '').trim(),
            emotions: d.emotions || {},
            avatar: (d.emotions && d.emotions.neutral) || d.avatar || Object.values(d.emotions || {})[0] || '',
            defaultText: String(d.defaultText || '').trim(),
            choices: Array.isArray(d.choices) ? d.choices : [],
            quickLines: Array.isArray(d.quickLines) ? d.quickLines : [],
            updatedAt: Date.now()
        };
        const idx = list.findIndex(x => x.id === id);
        if (idx !== -1) list[idx] = saved;
        else list.unshift(saved);

        SAVE_STUDIO_NPCS(list);
        window._vnUi.selectedId = id;
        window._vnUi.editMode = false;
        window._vnUi.draft = null;
        RENDER_NPC_STUDIO_MODAL();
    };

    window.VNS_DELETE_NPC = function(npcId) {
        if (!IS_GM()) return;
        const list = GET_STUDIO_NPCS();
        const n = list.find(x => x.id === npcId);
        if (!n || !confirm(`Удалить NPC «${n.name}» из комнаты?`)) return;
        const next = list.filter(x => x.id !== npcId);
        SAVE_STUDIO_NPCS(next);
        window._vnUi.selectedId = next[0]?.id || null;
        window._vnUi.editMode = false;
        window._vnUi.draft = null;
        RENDER_NPC_STUDIO_MODAL();
    };

    window.VNS_PLACE_ON_MAP = function(npcId) {
        if (!IS_GM()) return;
        const n = GET_STUDIO_NPCS().find(x => x.id === npcId); if (!n) return;
        const att = GET_ATT(n.attitude);
        const st = GET_MAP_STATE();
        if (!st.pins) st.pins = [];
        const ex = st.pins.find(p => p.npcId === n.id);
        if (ex) {
            ex.label = n.name; ex.icon = att.icon; ex.color = att.color;
        } else {
            st.pins.push({
                id: Date.now(), x: 46 + Math.floor(Math.random() * 12), y: 46 + Math.floor(Math.random() * 12),
                icon: att.icon, label: n.name, color: att.color,
                actionText: `${n.role ? n.role + '. ' : ''}${n.defaultText || 'Готов к разговору.'}`,
                npcId: n.id, oneTime: false
            });
        }
        SAVE_MAP_STATE(st);
        window._vnUi.minimized = true;
        CM('gm-tool-modal');
        RENDER_MAP_AREA();
        showMessage('📍 NPC на карте', `Значок «<b>${ESC(n.name)}</b>» размещён в центре карты — перетащите его мышкой в нужное место.`);
    };

    window.VNS_TO_BESTIARY = function(npcId) {
        if (!IS_GM()) return;
        const n = GET_STUDIO_NPCS().find(x => x.id === npcId);
        if (!n || typeof GET_BESTIARY !== 'function') return;
        const list = GET_BESTIARY();
        if (!list.some(b => b.name === n.name)) {
            list.push({
                name: n.name, icon: GET_ATT(n.attitude).icon,
                hp: 26, maxHp: 26, ac: 14, atkBonus: 4, dmgFormula: '1к8+2',
                desc: n.role || 'Персонаж из Мастерской NPC'
            });
            SAVE_BESTIARY(list);
        }
        showMessage('⚔️ Готово', `«<b>${ESC(n.name)}</b>» добавлен в Бестиарий.<div style="margin-top:10px;"><button class="btn-small btn-save" onclick="closeModal('message-modal'); OPEN_GM_BESTIARY_MODAL();">Открыть Бестиарий</button></div>`);
    };

    window.VNS_TO_LOREBOOK = function(npcId) {
        if (!IS_GM()) return;
        const n = GET_STUDIO_NPCS().find(x => x.id === npcId);
        const rc = CUR_ROOM();
        if (!n || !rc) return;

        const entry = {
            id: 'lore_npc_' + n.id,
            title: n.name,
            category: 'npc',
            tags: [n.race, n.role].filter(Boolean).join(', '),
            visibility: 'all',
            img: n.avatar || '',
            text: `${n.role ? `**${n.role}**` : ''}${n.race ? ` (${n.race})` : ''}\n\n${n.defaultText || 'Персонаж кампании.'}`,
            updatedAt: Date.now()
        };

        // Синхронно обновляем кэш lorebook.js + localStorage + Firebase!
        if (!window._loreCache) window._loreCache = {};
        const curList = Array.isArray(window._loreCache[rc]) ? window._loreCache[rc].slice() : [];
        const exIdx = curList.findIndex(e => e.id === entry.id);
        if (exIdx !== -1) curList[exIdx] = entry; else curList.unshift(entry);
        window._loreCache[rc] = curList;
        try { localStorage.setItem(`dnd_lore_v2_room_${rc}`, JSON.stringify(curList)); } catch (e) {}

        if (window.firebase && firebase.apps && firebase.apps.length) {
            firebase.database().ref(`campaign_v2/rooms/${rc}/lore_v2/${entry.id}`).set(entry).catch(() => {});
        } else {
            fetch(`${FB_ROOMS_URL}/${encodeURIComponent(rc)}/lore_v2/${encodeURIComponent(entry.id)}.json`, {
                method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry)
            }).catch(() => {});
        }
        showMessage('📖 Добавлено в Лорбук', `Запись «<b>${ESC(n.name)}</b>» появилась в разделе «🎭 Персонажи» Лорбука (секретные заметки Мастера скрыты).`);
    };

    function BUILD_DOSSIER_VIEW_HTML(npc, scene) {
        if (!npc) {
            return `<div style="margin:auto; text-align:center; padding:32px; color:var(--ui-muted,#888);">
                <div style="font-size:2.4rem; margin-bottom:8px;">🎭</div>
                <div style="font-weight:700; color:var(--ui-accent,#d2b278); margin-bottom:6px;">В этой комнате пока нет NPC</div>
                <p style="font-size:0.88rem; margin-bottom:14px;">Создайте персонажа с портретом, эмоциями и стартовой репликой.</p>
                <button class="btn-save" onclick="VNS_START_EDIT(null)">➕ Создать первого NPC</button>
            </div>`;
        }

        const att = GET_ATT(npc.attitude);
        const pEmo = window._vnUi.previewEmo || 'neutral';
        const sprite = GET_NPC_SPRITE(npc, pEmo);
        const emoCount = Object.keys(npc.emotions || {}).filter(k => npc.emotions[k]).length;

        const emoBtns = EMOTIONS.map(em => {
            const has = !!(npc.emotions && npc.emotions[em.id]);
            const act = pEmo === em.id;
            return `<button data-custom-bg="1" class="vn-soft-btn ${act ? 'is-active' : ''}" style="padding:3px 7px !important; font-size:0.78rem !important; ${has && !act ? 'border-color:#588a62 !important;' : ''}" title="${em.label}${has ? ' (есть спрайт)' : ''}" onclick="window._vnUi.previewEmo='${em.id}'; RENDER_NPC_STUDIO_MODAL();">${em.icon}</button>`;
        }).join('');

        return `
            <div style="display:flex; gap:18px; align-items:flex-start; flex-wrap:wrap;">
                <!-- Портрет и предпросмотр эмоций -->
                <div style="width:170px; flex-shrink:0; display:flex; flex-direction:column; align-items:center; gap:8px;">
                    <div style="width:166px; height:195px; border-radius:10px; background:var(--ui-panel,#221f1c); border:1px solid var(--ui-border-strong,#695c4c); display:flex; align-items:flex-end; justify-content:center; overflow:hidden; padding:6px;">
                        ${sprite
                            ? `<img src="${sprite}" style="max-width:100%; max-height:100%; object-fit:contain;">`
                            : BUILD_SILHOUETTE_SVG(att.color, 118)}
                    </div>
                    <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:center;">${emoBtns}</div>
                    <small style="color:var(--ui-muted,#888); font-size:0.74rem !important;">Загружено поз: ${emoCount} из 6</small>
                </div>

                <!-- Описание NPC -->
                <div style="flex:1; min-width:240px; display:flex; flex-direction:column; gap:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:8px; flex-wrap:wrap;">
                        <div>
                            <h3 style="margin:0; font-size:1.35rem; color:var(--ui-accent,#d2b278);">${ESC(npc.name)}</h3>
                            <div style="font-size:0.88rem; color:var(--ui-muted,#aaa); margin-top:2px;">
                                ${ESC(npc.role || 'Без должности')}${npc.race ? ` • ${ESC(npc.race)}` : ''}
                            </div>
                        </div>
                        <span style="background:var(--ui-panel,#221f1c); border:1px solid ${att.color}; color:${att.color}; padding:3px 10px; border-radius:14px; font-size:0.8rem; font-weight:600;">
                            ${att.icon} ${att.label}
                        </span>
                    </div>

                    ${npc.voice ? `<div style="font-size:0.85rem; color:var(--ui-text,#ddd); background:var(--ui-panel,#221f1c); border-radius:8px; padding:7px 10px; border:1px solid var(--ui-border,#3e372f);">🎙️ <b>Отыгрыш:</b> ${ESC(npc.voice)}</div>` : ''}

                    <div style="background:var(--ui-panel,#221f1c); border:1px solid var(--ui-border,#3e372f); border-left:3px solid var(--ui-accent,#d2b278); border-radius:8px; padding:10px 12px;">
                        <div style="font-size:0.76rem; color:var(--ui-muted,#888); margin-bottom:4px;">Стартовая фраза:</div>
                        <div style="font-family:Georgia, serif; font-size:0.95rem; line-height:1.45; color:var(--ui-text,#ebe8e2);">«${ESC(npc.defaultText || 'Не задана')}»</div>
                        ${(npc.choices || []).length ? `
                            <div style="display:flex; gap:5px; flex-wrap:wrap; margin-top:8px;">
                                ${npc.choices.map(ch => `<span style="background:var(--ui-panel2,#161412); border:1px solid var(--ui-border,#3e372f); color:var(--ui-muted,#ccc); padding:2px 8px; border-radius:6px; font-size:0.76rem;">💬 ${ESC(ch)}</span>`).join('')}
                            </div>` : ''}
                    </div>

                    ${npc.gmSecret ? `<div style="font-size:0.84rem; color:#d8c29d; background:rgba(150,102,56,0.12); border:1px dashed #966638; border-radius:8px; padding:7px 10px;">🔒 <b>Секрет Мастера:</b> ${ESC(npc.gmSecret)}</div>` : ''}
                </div>
            </div>

            <!-- Главные действия -->
            <div style="margin-top:auto; padding-top:12px; border-top:1px solid var(--ui-border,#3e372f); display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="btn-save" style="padding:9px 18px; font-size:0.95rem;" onclick="VN_START_SCENE_WITH_NPC('${ESC_JS(npc.id)}')">🎬 Начать диалог</button>
                    ${scene && scene.active ? `<button class="btn-cast" style="padding:9px 14px;" onclick="VN_ADD_SECOND_NPC_TO_SCENE('${ESC_JS(npc.id)}')">👥 + Вторым в сцену</button>` : ''}
                </div>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button data-custom-bg="1" class="vn-soft-btn" onclick="VNS_START_EDIT('${ESC_JS(npc.id)}')">✏️ Редактировать</button>
                    <button data-custom-bg="1" class="vn-soft-btn" onclick="VNS_PLACE_ON_MAP('${ESC_JS(npc.id)}')">📍 На карту</button>
                    <button data-custom-bg="1" class="vn-soft-btn" onclick="VNS_TO_BESTIARY('${ESC_JS(npc.id)}')">⚔️ В Бестиарий</button>
                    <button data-custom-bg="1" class="vn-soft-btn" onclick="VNS_TO_LOREBOOK('${ESC_JS(npc.id)}')">📖 В Лорбук</button>
                    <button class="btn-small btn-danger" title="Удалить NPC" onclick="VNS_DELETE_NPC('${ESC_JS(npc.id)}')">🗑️</button>
                </div>
            </div>
        `;
    }

    function BUILD_EDITOR_VIEW_HTML() {
        const d = window._vnUi.draft;
        const tab = window._vnUi.editTab || 'main';
        const tBtn = (id, label) => `<button data-custom-bg="1" class="vn-soft-btn ${tab === id ? 'is-active' : ''}" style="flex:1; padding:7px !important;" onclick="VNS_SWITCH_EDIT_TAB('${id}')">${label}</button>`;

        let body = '';
        if (tab === 'main') {
            body = `
                <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:10px;">
                    <div>
                        <label style="font-size:0.82rem; color:var(--ui-muted,#aaa);">Имя NPC:</label>
                        <input type="text" id="vns-f-name" value="${ESC(d.name)}" placeholder="Напр.: Трактирщик Бром" style="width:100%; padding:8px 10px; margin-top:4px; font-weight:600;">
                    </div>
                    <div>
                        <label style="font-size:0.82rem; color:var(--ui-muted,#aaa);">Должность / Титул:</label>
                        <input type="text" id="vns-f-role" value="${ESC(d.role)}" placeholder="Напр.: Хозяин «Старого Очага»" style="width:100%; padding:8px 10px; margin-top:4px;">
                    </div>
                </div>

                <div>
                    <label style="font-size:0.82rem; color:var(--ui-muted,#aaa); display:block; margin-bottom:5px;">Отношение к отряду:</label>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        ${ATTITUDES.map(a => `<button data-custom-bg="1" class="vn-soft-btn ${d.attitude === a.id ? 'is-active' : ''}" onclick="VNS_SET_DRAFT_ATTITUDE('${a.id}')">${a.icon} ${a.label}</button>`).join('')}
                    </div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1.3fr; gap:10px;">
                    <div>
                        <label style="font-size:0.82rem; color:var(--ui-muted,#aaa);">Раса / Фракция:</label>
                        <input type="text" id="vns-f-race" value="${ESC(d.race || '')}" placeholder="Дварф, Гильдия купцов..." style="width:100%; padding:8px 10px; margin-top:4px;">
                    </div>
                    <div>
                        <label style="font-size:0.82rem; color:var(--ui-muted,#aaa);">🎙️ Манера речи и голос (подсказка ГМ):</label>
                        <input type="text" id="vns-f-voice" value="${ESC(d.voice || '')}" placeholder="Говорит хрипло, постоянно протирает кружку..." style="width:100%; padding:8px 10px; margin-top:4px;">
                    </div>
                </div>

                <div>
                    <label style="font-size:0.82rem; color:var(--ui-muted,#aaa);">🔒 Секретные заметки Мастера (игроки не видят):</label>
                    <textarea id="vns-f-secret" style="width:100%; min-height:76px; padding:8px 10px; margin-top:4px;" placeholder="Тайные мотивы, что скрывает, за какую цену выдаст секрет...">${ESC(d.gmSecret || '')}</textarea>
                </div>
            `;
        } else if (tab === 'art') {
            const selEmo = window._vnUi.editArtEmo || 'neutral';
            const selMeta = GET_EMO(selEmo);
            const curUrl = (d.emotions?.[selEmo] && !d.emotions[selEmo].startsWith('data:')) ? d.emotions[selEmo] : '';

            body = `
                <div style="font-size:0.84rem; color:var(--ui-muted,#aaa);">
                    Загрузите основной портрет в <b>«Спокойный»</b> — остальные эмоции необязательны (если загрузить отдельные позы, они будут плавно меняться прямо в диалоге). Поддерживаются PNG/WebP с прозрачным фоном.
                </div>
                <div class="vns-emo-grid">
                    ${EMOTIONS.map(em => {
                        const src = d.emotions && d.emotions[em.id];
                        const act = selEmo === em.id;
                        return `
                            <div class="vns-emo-card ${act ? 'is-active' : ''}" onclick="window._vnUi.editArtEmo='${em.id}'; RENDER_NPC_STUDIO_MODAL();">
                                <div style="width:100%; height:96px; border-radius:7px; background:var(--ui-panel2,#161412); display:flex; align-items:center; justify-content:center; overflow:hidden;">
                                    ${src ? `<img src="${src}" style="max-width:100%; max-height:100%; object-fit:contain;">` : `<span style="font-size:1.7rem; opacity:0.65;">${em.icon}</span>`}
                                </div>
                                <div style="font-size:0.8rem; font-weight:600; color:${act ? 'var(--ui-accent,#d2b278)' : 'var(--ui-text,#ddd)'};">${em.icon} ${em.label}</div>
                                <div style="display:flex; gap:4px; width:100%;">
                                    <button data-custom-bg="1" class="vn-soft-btn" style="flex:1; padding:3px 6px !important; font-size:0.74rem !important;" onclick="event.stopPropagation(); VNS_UPLOAD_EMO_FILE('${em.id}')">📷 Файл</button>
                                    ${src ? `<button class="btn-small btn-danger" style="padding:3px 7px; font-size:0.74rem;" onclick="event.stopPropagation(); VNS_CLEAR_EMO('${em.id}')">✕</button>` : ''}
                                </div>
                            </div>`;
                    }).join('')}
                </div>
                <div style="display:flex; gap:6px; align-items:center;">
                    <input type="url" id="vns-art-url-inp" value="${ESC(curUrl)}" placeholder="Или ссылка URL для «${selMeta.label}» (https://...)" style="flex:1; padding:7px 10px; font-size:0.84rem;">
                    <button data-custom-bg="1" class="vn-soft-btn" onclick="VNS_APPLY_EMO_URL()">🔗 Применить URL</button>
                </div>
            `;
        } else {
            body = `
                <div>
                    <label style="font-size:0.82rem; color:var(--ui-accent,#d2b278); font-weight:600;">💬 Стартовая фраза NPC (при открытии диалога):</label>
                    <textarea id="vns-f-greeting" style="width:100%; min-height:80px; padding:8px 10px; margin-top:4px;" placeholder="Что персонаж говорит при встрече...">${ESC(d.defaultText || '')}</textarea>
                </div>

                <div style="background:var(--ui-panel,#221f1c); border:1px solid var(--ui-border,#3e372f); border-radius:9px; padding:10px;">
                    <div style="font-size:0.82rem; color:var(--ui-accent,#d2b278); font-weight:600; margin-bottom:6px;">🔘 Кнопки быстрых ответов для игроков:</div>
                    <div style="display:flex; gap:5px; flex-wrap:wrap; margin-bottom:8px;">
                        ${(d.choices || []).map((ch, i) => `
                            <span style="display:inline-flex; align-items:center; gap:6px; background:var(--ui-panel2,#161412); border:1px solid var(--ui-border-strong,#695c4c); padding:3px 9px; border-radius:6px; font-size:0.82rem;">
                                💬 ${ESC(ch)} <b style="cursor:pointer; color:#e07a7a;" onclick="VNS_REMOVE_DRAFT_CHIP('choices', ${i})">✕</b>
                            </span>`).join('') || '<small style="color:var(--ui-muted,#888);">Вариантов нет (игроки будут писать сами)</small>'}
                    </div>
                    <div style="display:flex; gap:6px;">
                        <input type="text" id="vns-add-choice-inp" placeholder="Напр.: Попросить скидку" onkeypress="if(event.key==='Enter'){ event.preventDefault(); VNS_ADD_DRAFT_CHIP('choices','vns-add-choice-inp'); }" style="flex:1; padding:6px 9px; font-size:0.84rem;">
                        <button data-custom-bg="1" class="vn-soft-btn" onclick="VNS_ADD_DRAFT_CHIP('choices','vns-add-choice-inp')">+ Добавить</button>
                    </div>
                </div>

                <div style="background:var(--ui-panel,#221f1c); border:1px solid var(--ui-border,#3e372f); border-radius:9px; padding:10px;">
                    <div style="font-size:0.82rem; color:var(--ui-accent,#d2b278); font-weight:600; margin-bottom:6px;">⚡ Заготовки фраз NPC (отправляются в 1 клик во время диалога):</div>
                    <div style="display:flex; gap:5px; flex-wrap:wrap; margin-bottom:8px;">
                        ${(d.quickLines || []).map((ql, i) => `
                            <span style="display:inline-flex; align-items:center; gap:6px; background:var(--ui-panel2,#161412); border:1px solid var(--ui-border,#3e372f); padding:3px 9px; border-radius:6px; font-size:0.8rem;">
                                «${ESC(ql)}» <b style="cursor:pointer; color:#e07a7a;" onclick="VNS_REMOVE_DRAFT_CHIP('quickLines', ${i})">✕</b>
                            </span>`).join('') || '<small style="color:var(--ui-muted,#888);">Пока нет заготовок</small>'}
                    </div>
                    <div style="display:flex; gap:6px;">
                        <input type="text" id="vns-add-ql-inp" placeholder="Напр.: Убирайтесь из моего трактира!" onkeypress="if(event.key==='Enter'){ event.preventDefault(); VNS_ADD_DRAFT_CHIP('quickLines','vns-add-ql-inp'); }" style="flex:1; padding:6px 9px; font-size:0.84rem;">
                        <button data-custom-bg="1" class="vn-soft-btn" onclick="VNS_ADD_DRAFT_CHIP('quickLines','vns-add-ql-inp')">+ Добавить</button>
                    </div>
                </div>
            `;
        }

        return `
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-size:1.12rem;">${d.id ? `✏️ Редактирование: ${ESC(d.name)}` : '➕ Новый NPC'}</h3>
            </div>
            <div style="display:flex; gap:6px; background:var(--ui-panel,#221f1c); padding:4px; border-radius:9px; border:1px solid var(--ui-border,#3e372f);">
                ${tBtn('main', '👤 Основное')}
                ${tBtn('art', '🎨 Внешность и эмоции')}
                ${tBtn('dialog', '💬 Реплики и варианты')}
            </div>
            <div style="display:flex; flex-direction:column; gap:11px; flex:1;">${body}</div>
            <div style="display:flex; justify-content:flex-end; gap:8px; padding-top:10px; border-top:1px solid var(--ui-border,#3e372f);">
                <button class="btn-save" onclick="VNS_SAVE_DRAFT()">💾 Сохранить NPC</button>
                <button data-custom-bg="1" class="vn-soft-btn" onclick="window._vnUi.editMode=false; window._vnUi.draft=null; RENDER_NPC_STUDIO_MODAL();">Отмена</button>
            </div>
        `;
    }

    function RENDER_NPC_STUDIO_MODAL() {
        ENSURE_VN_CSS();
        const cont = document.getElementById('gm-tool-modal-content');
        if (!cont) return;
        cont.style.maxWidth = '1020px';

        const allNpcs = GET_STUDIO_NPCS();
        const scene = GET_LIVE_SCENE();
        const q = (window._vnUi.search || '').toLowerCase().trim();
        const attF = window._vnUi.attFilter || 'all';

        if (!window._vnUi.editMode && !allNpcs.some(n => n.id === window._vnUi.selectedId)) {
            window._vnUi.selectedId = allNpcs[0]?.id || null;
        }
        const selectedNpc = allNpcs.find(n => n.id === window._vnUi.selectedId) || null;

        const filtered = allNpcs.filter(n => {
            const attOk = attF === 'all' || (n.attitude || 'neutral') === attF;
            const qOk = !q || (n.name || '').toLowerCase().includes(q) || (n.role || '').toLowerCase().includes(q);
            return attOk && qOk;
        });

        const listHTML = filtered.map(n => {
            const att = GET_ATT(n.attitude);
            const isSel = (!window._vnUi.editMode && window._vnUi.selectedId === n.id) || (window._vnUi.editMode && window._vnUi.draft?.id === n.id);
            return `
                <button data-custom-bg="1" class="vns-npc-item ${isSel ? 'is-selected' : ''}" onclick="VNS_SELECT_NPC('${ESC_JS(n.id)}')">
                    ${n.avatar
                        ? `<img src="${n.avatar}" style="width:38px; height:38px; border-radius:50%; object-fit:cover; border:2px solid ${att.color}; flex-shrink:0;">`
                        : `<div style="width:38px; height:38px; border-radius:50%; background:var(--ui-panel2,#161412); border:1px solid ${att.color}; display:flex; align-items:center; justify-content:center; flex-shrink:0; font-size:0.95rem;">${att.icon}</div>`}
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:700; font-size:0.88rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:${isSel ? 'var(--ui-accent,#d2b278)' : 'var(--ui-text,#e5e0d7)'};">${ESC(n.name)}</div>
                        <div style="font-size:0.75rem; color:var(--ui-muted,#888); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ESC(n.role || att.label)}</div>
                    </div>
                </button>`;
        }).join('') || '<div style="text-align:center; padding:18px; color:var(--ui-muted,#888); font-size:0.84rem;">Никого не найдено</div>';

        const filterPills = [
            { id: 'all', lbl: 'Все' },
            { id: 'ally', lbl: '🤝 Союз.' },
            { id: 'neutral', lbl: '⚖️ Нейтр.' },
            { id: 'hostile', lbl: '⚔️ Враги' },
            { id: 'merchant', lbl: '🏪 Торг.' }
        ].map(f => `<button data-custom-bg="1" class="vn-soft-btn ${attF === f.id ? 'is-active' : ''}" style="padding:3px 7px !important; font-size:0.74rem !important;" onclick="window._vnUi.attFilter='${f.id}'; RENDER_NPC_STUDIO_MODAL();">${f.lbl}</button>`).join('');

        cont.innerHTML = `
            <div id="vn-studio-modal-marker"></div>
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; border-bottom:1px solid var(--ui-border,#3e372f); padding-bottom:10px; margin-bottom:12px;">
                <h2 style="margin:0; border:none; padding:0; font-size:1.25rem;">🎭 Персонажи NPC <small style="color:var(--ui-muted,#888); font-weight:normal;">(Комната #${ESC(CUR_ROOM())})</small></h2>
                <div style="display:flex; gap:8px;">
                    ${scene && scene.active ? `<button class="btn-small btn-danger" onclick="VN_GM_END_SCENE(); RENDER_NPC_STUDIO_MODAL();">✕ Завершить диалог</button>` : ''}
                    <button data-custom-bg="1" class="vn-soft-btn" onclick="CM('gm-tool-modal')">✕ Закрыть</button>
                </div>
            </div>

            <div class="vns-layout">
                <div class="vns-sidebar">
                    <button class="btn-save" style="width:100%; padding:8px; margin-bottom:9px; font-size:0.88rem;" onclick="VNS_START_EDIT(null)">➕ Создать NPC</button>
                    <input type="text" value="${ESC(window._vnUi.search)}" oninput="window._vnUi.search=this.value; RENDER_NPC_STUDIO_MODAL();" placeholder="🔍 Поиск по имени..." style="width:100%; padding:7px 9px; margin-bottom:7px; font-size:0.84rem;">
                    <div style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:9px;">${filterPills}</div>
                    <div style="flex:1; overflow-y:auto; padding-right:2px;">${listHTML}</div>
                </div>

                <div class="vns-main">
                    ${window._vnUi.editMode ? BUILD_EDITOR_VIEW_HTML() : BUILD_DOSSIER_VIEW_HTML(selectedNpc, scene)}
                </div>
            </div>
        `;
    }

    // --- 6. ХУКИ ---
    window.OPEN_GM_NPC_MODAL = function() {
        if (!IS_GM()) return;
        window._vnUi.editMode = false;
        window._vnUi.draft = null;
        RENDER_NPC_STUDIO_MODAL();
        OM('gm-tool-modal');
    };

    const _ORIG_RENDER_MAP_VN = window.RENDER_MAP_AREA;
    if (typeof _ORIG_RENDER_MAP_VN === 'function') {
        window.RENDER_MAP_AREA = function() {
            _ORIG_RENDER_MAP_VN();
            RENDER_VN_STAGE_AND_DOCK();
        };
    }

    const _ORIG_PIN_INT = window.INTERACT_WITH_MAP_PIN;
    if (typeof _ORIG_PIN_INT === 'function') {
        window.INTERACT_WITH_MAP_PIN = function(pinIdx) {
            const st = GET_MAP_STATE();
            const pin = st && st.pins && st.pins[pinIdx];
            if (pin && pin.npcId) {
                const npc = GET_STUDIO_NPCS().find(n => n.id === pin.npcId);
                if (npc) {
                    if (IS_GM()) { window.VNS_SELECT_NPC(npc.id); OM('gm-tool-modal'); return; }
                    const scene = GET_LIVE_SCENE();
                    const onStage = scene && scene.active && (scene.leftSlot?.npcId === npc.id || scene.rightSlot?.npcId === npc.id);
                    if (onStage) { window.VN_PLAYER_REJOIN(); return; }
                    const att = GET_ATT(npc.attitude);
                    showMessage(`${att.icon} ${npc.name}`, `
                        <div style="text-align:center;">
                            ${npc.avatar ? `<img src="${npc.avatar}" style="max-height:150px; max-width:150px; object-fit:contain; border-radius:10px; border:2px solid ${att.color}; margin-bottom:10px;">` : ''}
                            <div style="color:var(--ui-muted,#aaa); font-size:0.92rem; margin-bottom:12px;">${ESC(npc.role || att.label)}</div>
                            <button class="btn-save" onclick="closeModal('message-modal'); LOG_COMBAT_TO_CHAT('🗣️ подходит и обращается к «${ESC_JS(npc.name)}»!');">💬 Подойти и заговорить</button>
                        </div>
                    `);
                    return;
                }
            }
            return _ORIG_PIN_INT(pinIdx);
        };
    }

    if (typeof window.SWITCH_FIREBASE_ROOM === 'function') {
        const _ORIG_SW_VN = window.SWITCH_FIREBASE_ROOM;
        window.SWITCH_FIREBASE_ROOM = function(rc) { const r = _ORIG_SW_VN(rc); SYNC_VN_FOR_ROOM(rc); return r; };
    }

    const _ORIG_APPLY_VN = window.APPLY_ROLE_VIEW;
    if (typeof _ORIG_APPLY_VN === 'function') {
        window.APPLY_ROLE_VIEW = function() { _ORIG_APPLY_VN(); SYNC_VN_FOR_ROOM(CUR_ROOM()); RENDER_VN_STAGE_AND_DOCK(); };
    }

    SYNC_VN_FOR_ROOM(CUR_ROOM());
    RENDER_VN_STAGE_AND_DOCK();
})();