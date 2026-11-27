// ================================================================
// 🎭 ВИЗУАЛЬНАЯ НОВЕЛЛА NPC (2 ПЕРСОНАЖА, ЭМОЦИИ/ПОЗЫ, ИСТОРИЯ)
// И МАСТЕРСКАЯ РЕДАКТОРА NPC ДЛЯ ГЕЙМ-МАСТЕРА (vn_studio.js)
// Полная изоляция по комнатам • Мгновенная синхронизация Firebase
// ================================================================
(function INIT_VN_STUDIO_MODULE() {
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

    window._vnNpcsCache = {};      // { [roomCode]: [npc, ...] }
    window._vnSceneCache = {};     // { [roomCode]: sceneObj | null }
    window._vnUi = {
        minimized: false,
        historyOpen: false,
        instantText: localStorage.getItem('dnd_vn_instant_text') === '1',
        playerActionMode: false,   // false = речь, true = *действие*
        gmSpeakMode: 'speech',     // 'speech' | 'whisper' | 'narrator'
        gmChoicesBarOpen: false,
        editorSearch: '',
        editorAttFilter: 'all',
        editorSelectedId: null,
        editorDraft: null,
        editorEmotionTab: 'neutral',
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

    // --- 1. СТИЛИ НОВЕЛЛЫ И МАСТЕРСКОЙ NPC ---
    function ENSURE_VN_CSS() {
        if (document.getElementById('vn-studio-css')) return;
        const st = document.createElement('style');
        st.id = 'vn-studio-css';
        st.textContent = `
            .vn-stage-overlay {
                position: absolute; inset: 0; z-index: 15;
                display: flex; flex-direction: column; justify-content: flex-end;
                overflow: hidden;
                background: radial-gradient(circle at 50% 35%, rgba(16,14,12,0.28) 0%, rgba(8,7,6,0.78) 100%);
                backdrop-filter: blur(2px);
            }
            .vn-top-bar {
                position: absolute; top: 8px; left: 10px; right: 10px; z-index: 5;
                display: flex; justify-content: space-between; align-items: center; gap: 6px; flex-wrap: wrap;
                pointer-events: none;
            }
            .vn-top-bar > * { pointer-events: auto; }
            .vn-actors-layer {
                flex: 1; min-height: 110px;
                display: flex; align-items: flex-end; justify-content: center;
                gap: 24px; padding: 36px 20px 0 20px;
                pointer-events: none; position: relative;
            }
            .vn-actors-layer.two-actors { justify-content: space-between; padding: 36px 8% 0 8%; }
            .vn-actor-slot {
                display: flex; flex-direction: column; align-items: center; justify-content: flex-end;
                transition: transform 0.22s ease, filter 0.22s ease, opacity 0.22s ease;
                max-width: 44%; position: relative; pointer-events: auto;
            }
            .vn-actor-slot.is-speaking { transform: translateY(-4px) scale(1.04); filter: brightness(1.04); opacity: 1; z-index: 2; }
            .vn-actor-slot.is-listening { transform: translateY(6px) scale(0.94); filter: brightness(0.58) saturate(0.8); opacity: 0.9; z-index: 1; }
            .vn-sprite-img {
                max-height: 225px; max-width: 240px; object-fit: contain;
                filter: drop-shadow(0 8px 20px rgba(0,0,0,0.92));
                border-radius: 10px;
                user-select: none;
            }
            .vn-sprite-fallback {
                width: 104px; height: 104px; border-radius: 50%; margin-bottom: 12px;
                background: radial-gradient(circle, #352e22 0%, #171512 100%);
                border: 3px solid var(--ui-accent, #c9a96e);
                display: flex; align-items: center; justify-content: center;
                font-size: 2.8rem; box-shadow: 0 8px 24px rgba(0,0,0,0.88);
            }
            .vn-emo-pill {
                position: absolute; bottom: 8px; right: -4px;
                background: rgba(16,14,12,0.92); border: 1px solid var(--ui-border-strong, #695c4c);
                border-radius: 14px; padding: 2px 8px; font-size: 0.75rem; color: #ebe8e2;
                white-space: nowrap; box-shadow: 0 3px 10px rgba(0,0,0,0.7);
            }
            .vn-dialogue-box {
                background: linear-gradient(180deg, rgba(22,20,18,0.96) 0%, rgba(12,11,10,0.99) 100%);
                border-top: 2px solid var(--ui-accent, #c9a96e);
                padding: 12px 16px; text-align: left;
                display: flex; flex-direction: column; gap: 7px;
                box-shadow: 0 -10px 28px rgba(0,0,0,0.9);
                z-index: 4;
            }
            .vn-speech-text {
                color: #f3efe8; font-size: 1.02rem; line-height: 1.48;
                max-height: 92px; overflow-y: auto; padding-right: 4px;
                font-family: Georgia, serif; cursor: pointer;
                white-space: pre-wrap;
            }
            .vn-speech-text.mode-whisper { color: #d5cfc5; font-style: italic; opacity: 0.92; }
            .vn-speech-text.mode-narrator { color: #e6c88c; font-style: italic; }
            .vn-history-drawer {
                position: absolute; inset: 0; z-index: 8;
                background: rgba(13,12,11,0.95); backdrop-filter: blur(4px);
                display: flex; flex-direction: column; padding: 14px 18px;
                text-align: left;
            }
            /* Мастерская NPC */
            .vn-studio-grid {
                display: grid; grid-template-columns: 280px 1fr; gap: 14px;
                height: 64vh; min-height: 430px;
            }
            .vn-studio-list, .vn-studio-editor {
                display: flex; flex-direction: column; min-height: 0;
                background: var(--ui-panel2, #161412); border: 1px solid var(--ui-border, #3e372f);
                border-radius: 10px; padding: 11px; text-align: left;
            }
            .vn-studio-editor { overflow-y: auto; gap: 10px; }
            .vn-npc-card-btn {
                width: 100%; display: flex; align-items: center; gap: 9px;
                padding: 8px 9px; margin-bottom: 6px; border-radius: 8px;
                background: var(--ui-panel, #221f1c); color: var(--ui-text, #e5e0d7);
                border: 1px solid var(--ui-border, #3e372f);
                cursor: pointer; text-align: left; box-shadow: none;
            }
            .vn-npc-card-btn.is-active {
                border-color: var(--ui-accent, #d2b278);
                box-shadow: inset 3px 0 0 var(--ui-accent, #d2b278);
            }
            .vn-studio-editor input, .vn-studio-editor textarea, .vn-studio-editor select,
            .vn-studio-list input, .vn-dialogue-box input {
                background: var(--ui-input-bg, #141210) !important;
                color: var(--ui-text, #e5e0d7) !important;
                border: 1px solid var(--ui-border-strong, #52483c) !important;
                border-radius: 7px; box-sizing: border-box;
                color-scheme: dark;
            }
            .vn-studio-editor select option { background: var(--ui-panel, #221f1c); color: var(--ui-text, #e5e0d7); }
            @media (max-width: 820px) {
                .vn-studio-grid { grid-template-columns: 1fr !important; height: auto; }
                .vn-studio-list { max-height: 210px; }
                .vn-sprite-img { max-height: 150px; max-width: 150px; }
                .vn-actors-layer.two-actors { padding: 34px 10px 0 10px; }
            }
        `;
        document.head.appendChild(st);
    }

    // --- 2. ХРАНИЛИЩЕ И СИНХРОНИЗАЦИЯ ПО КОМНАТАМ (FIREBASE) ---
    function NORMALIZE_NPCS(val) {
        if (!val) return [];
        const arr = Array.isArray(val) ? val : (typeof val === 'object' ? Object.values(val) : []);
        return arr.filter(n => n && n.id && n.name).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    function MIGRATE_LEGACY_NPCS() {
        const legacy = (typeof GET_NPCS === 'function') ? GET_NPCS() : [];
        if (!Array.isArray(legacy)) return [];
        return legacy.filter(n => n && n.name).map((n, i) => ({
            id: 'npc_leg_' + i + '_' + (n.name.length),
            name: String(n.name),
            role: String(n.role || ''),
            race: '',
            faction: '',
            attitude: /генерал|враг|разбой/i.test(n.name + ' ' + n.role) ? 'hostile' : 'neutral',
            voice: '',
            gmSecret: '',
            avatar: n.avatar || '',
            emotions: n.avatar ? { neutral: n.avatar } : {},
            defaultText: String(n.defaultText || ''),
            choices: String(n.choices || '').split('|').map(x => x.trim()).filter(Boolean),
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
        if (!code) return null;
        return window._vnSceneCache[code] || null;
    }

    function SAVE_LIVE_SCENE(scene, rc) {
        const code = String(rc || CUR_ROOM() || '');
        if (!code) return;
        window._vnSceneCache[code] = scene || null;

        // Очищаем устаревший dnd_vn_dialog из gm.js, чтобы окна не наслаивались
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
        RENDER_VN_STAGE_ON_MAP();
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
        if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }

        if (!nextRc) { RENDER_VN_STAGE_ON_MAP(); return; }

        fetch(`${FB_ROOMS_URL}/${encodeURIComponent(nextRc)}/vn_studio.json`)
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (activeRoom !== nextRc) return;
                if (data && data.npcs) {
                    window._vnNpcsCache[nextRc] = NORMALIZE_NPCS(data.npcs);
                } else {
                    const mig = MIGRATE_LEGACY_NPCS();
                    window._vnNpcsCache[nextRc] = mig;
                    if (mig.length && IS_GM()) SAVE_STUDIO_NPCS(mig, nextRc);
                }
                window._vnSceneCache[nextRc] = (data && data.scene && data.scene.active) ? data.scene : null;
                RENDER_VN_STAGE_ON_MAP();
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
                    if (document.getElementById('vn-studio-modal-marker') && !window._vnUi.editorDraft) {
                        RENDER_NPC_STUDIO_MODAL();
                    }
                    RENDER_VN_STAGE_ON_MAP();
                });

                sceneRef.on('value', (snap) => {
                    if (activeRoom !== nextRc) return;
                    const val = snap.val();
                    window._vnSceneCache[nextRc] = (val && val.active) ? val : null;
                    RENDER_VN_STAGE_ON_MAP();
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

    // --- 3. УПРАВЛЕНИЕ СЦЕНОЙ ВИЗУАЛЬНОЙ НОВЕЛЛЫ ---
    function APPEND_HISTORY(scene, entry) {
        if (!Array.isArray(scene.history)) scene.history = [];
        const time = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        scene.history.push(Object.assign({ id: 'h_' + Date.now() + '_' + Math.random().toString(36).slice(2, 5), time }, entry));
        if (scene.history.length > 80) scene.history = scene.history.slice(-80);
    }

    window.VN_START_SCENE_WITH_NPC = function(npcId, customText, customChoices) {
        if (!IS_GM()) return;
        const npc = GET_STUDIO_NPCS().find(n => n.id === npcId);
        if (!npc) return;

        const text = (customText !== undefined ? customText : (npc.defaultText || '...')).trim() || '...';
        const choices = Array.isArray(customChoices) ? customChoices : (Array.isArray(npc.choices) ? npc.choices.slice() : []);
        const existing = GET_LIVE_SCENE();
        const history = (existing && Array.isArray(existing.history)) ? existing.history.slice() : [];

        const scene = {
            active: true,
            id: 'sc_' + Date.now(),
            leftSlot: { npcId: npc.id, emotion: 'neutral' },
            rightSlot: null,
            activeSlot: 'left',     // 'left' | 'right' | 'narrator'
            speakMode: 'speech',    // 'speech' | 'whisper' | 'narrator'
            text,
            textStamp: Date.now(),
            choices,
            playerReplies: [],
            leftPlayers: [],
            history
        };
        APPEND_HISTORY(scene, {
            kind: 'npc',
            speaker: npc.name,
            role: npc.role || '',
            emotion: 'neutral',
            text
        });

        window._vnUi.minimized = false;
        window._vnUi.historyOpen = false;
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
        SAVE_LIVE_SCENE(scene);
        CM('gm-tool-modal');
    };

    window.VN_REMOVE_RIGHT_NPC = function() {
        if (!IS_GM()) return;
        const scene = GET_LIVE_SCENE();
        if (!scene) return;
        scene.rightSlot = null;
        if (scene.activeSlot === 'right') scene.activeSlot = 'left';
        SAVE_LIVE_SCENE(scene);
    };

    window.VN_GM_SET_ACTIVE_SLOT = function(slot) {
        if (!IS_GM()) return;
        const scene = GET_LIVE_SCENE();
        if (!scene) return;
        if (slot === 'right' && !scene.rightSlot) return;
        scene.activeSlot = slot;
        if (slot === 'narrator') window._vnUi.gmSpeakMode = 'narrator';
        else if (window._vnUi.gmSpeakMode === 'narrator') window._vnUi.gmSpeakMode = 'speech';
        SAVE_LIVE_SCENE(scene);
    };

    window.VN_GM_SET_EMOTION = function(emotionId) {
        if (!IS_GM()) return;
        const scene = GET_LIVE_SCENE();
        if (!scene) return;
        const target = (scene.activeSlot === 'right' && scene.rightSlot) ? scene.rightSlot : scene.leftSlot;
        if (target) {
            target.emotion = emotionId;
            SAVE_LIVE_SCENE(scene);
        }
    };

    window.VN_GM_SPEAK = function() {
        if (!IS_GM()) return;
        const inp = document.getElementById('vn-gm-live-input');
        const text = (inp ? inp.value : '').trim();
        if (!text) return;
        const scene = GET_LIVE_SCENE();
        if (!scene) return;

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

        if (inp) inp.value = '';
        SAVE_LIVE_SCENE(scene);
    };

    window.VN_GM_ADD_LIVE_CHOICE = function() {
        if (!IS_GM()) return;
        const inp = document.getElementById('vn-gm-live-choice-inp');
        const val = (inp ? inp.value : '').trim();
        if (!val) return;
        const scene = GET_LIVE_SCENE();
        if (!scene) return;
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

    // --- ДЕЙСТВИЯ ИГРОКОВ В НОВЕЛЛЕ ---
    window.VN_PLAYER_SEND_REPLY = function(presetText, forceAction) {
        const scene = GET_LIVE_SCENE();
        if (!scene || !scene.active) return;

        let text = presetText;
        let isAction = !!forceAction;
        if (text === undefined) {
            const inp = document.getElementById('vn-pl-live-input');
            text = (inp ? inp.value : '').trim();
            isAction = !!window._vnUi.playerActionMode;
            if (inp) inp.value = '';
        }
        if (!text) return;

        if (!isAction && /^(уйти|отойти|покинуть|закончить разговор)/i.test(text.trim())) {
            window.VN_PLAYER_LEAVE();
            return;
        }

        const cs = GC();
        const myIdx = MY_PIDX();
        const heroName = cs[myIdx]?.name || 'Игрок';
        if (!Array.isArray(scene.playerReplies)) scene.playerReplies = [];
        scene.playerReplies.push({ sender: heroName, text, isAction, ts: Date.now() });
        if (scene.playerReplies.length > 10) scene.playerReplies = scene.playerReplies.slice(-10);

        APPEND_HISTORY(scene, { kind: 'player', speaker: heroName, text, isAction });
        SAVE_LIVE_SCENE(scene);
    };

    window.VN_PLAYER_LEAVE = function() {
        const scene = GET_LIVE_SCENE();
        if (!scene) return;
        const myIdx = MY_PIDX();
        if (!Array.isArray(scene.leftPlayers)) scene.leftPlayers = [];
        if (!scene.leftPlayers.includes(myIdx)) scene.leftPlayers.push(myIdx);
        const heroName = GC()[myIdx]?.name || 'Игрок';
        APPEND_HISTORY(scene, { kind: 'narrator', speaker: 'Сцена', text: `${heroName} отходит от разговора.` });
        SAVE_LIVE_SCENE(scene);
    };

    window.VN_PLAYER_REJOIN = function() {
        const scene = GET_LIVE_SCENE();
        if (!scene) return;
        const myIdx = MY_PIDX();
        scene.leftPlayers = (scene.leftPlayers || []).filter(i => i !== myIdx);
        window._vnUi.minimized = false;
        SAVE_LIVE_SCENE(scene);
    };

    window.VN_TOGGLE_INSTANT_TEXT = function() {
        window._vnUi.instantText = !window._vnUi.instantText;
        localStorage.setItem('dnd_vn_instant_text', window._vnUi.instantText ? '1' : '0');
        RENDER_VN_STAGE_ON_MAP();
    };

    // --- 4. ОТРИСОВКА СЦЕНЫ НОВЕЛЛЫ ПОВЕРХ КАРТЫ ---
    function RUN_TYPEWRITER(elId, fullText, stampKey, quoteWrap) {
        if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
        const el = document.getElementById(elId);
        if (!el) return;
        const formatted = quoteWrap ? `«${fullText}»` : fullText;

        if (window._vnUi.instantText || window._vnUi.lastTypedKey === stampKey || fullText.length > 420) {
            el.textContent = formatted;
            window._vnUi.lastTypedKey = stampKey;
            return;
        }

        window._vnUi.lastTypedKey = stampKey;
        el.textContent = '';
        let pos = 0;
        const step = Math.max(1, Math.ceil(formatted.length / 45));
        typeTimer = setInterval(() => {
            pos += step;
            if (pos >= formatted.length) {
                el.textContent = formatted;
                clearInterval(typeTimer);
                typeTimer = null;
            } else {
                el.textContent = formatted.slice(0, pos);
            }
        }, 20);

        el.onclick = () => {
            if (typeTimer) {
                clearInterval(typeTimer);
                typeTimer = null;
                el.textContent = formatted;
            }
        };
    }

    function RENDER_VN_STAGE_ON_MAP() {
        ENSURE_VN_CSS();
        const mapArea = document.getElementById('map-area');
        if (!mapArea) return;

        // Сохраняем недописанный текст в поле ввода при живом обновлении
        const prevGmInp = document.getElementById('vn-gm-live-input');
        const prevPlInp = document.getElementById('vn-pl-live-input');
        const keepGmText = prevGmInp ? prevGmInp.value : '';
        const keepPlText = prevPlInp ? prevPlInp.value : '';
        const focusedId = document.activeElement ? document.activeElement.id : '';

        mapArea.querySelectorAll('#vn-studio-stage-root, #vn-studio-mini-pill').forEach(n => n.remove());

        const scene = GET_LIVE_SCENE();
        if (!scene || !scene.active) return;

        const isGM = IS_GM();
        const myIdx = MY_PIDX();
        const npcs = GET_STUDIO_NPCS();
        const leftNpc = scene.leftSlot ? npcs.find(n => n.id === scene.leftSlot.npcId) : null;
        const rightNpc = scene.rightSlot ? npcs.find(n => n.id === scene.rightSlot.npcId) : null;
        const activeNpc = (scene.activeSlot === 'right' && rightNpc) ? rightNpc : leftNpc;
        const activeSlotObj = (scene.activeSlot === 'right' && scene.rightSlot) ? scene.rightSlot : scene.leftSlot;
        const isNarrator = (scene.speakMode === 'narrator' || scene.activeSlot === 'narrator');
        const isLeftOut = (!isGM && Array.isArray(scene.leftPlayers) && scene.leftPlayers.includes(myIdx));

        // Свёрнутый режим (просмотр карты) или отошедший игрок
        if (isLeftOut || window._vnUi.minimized) {
            const pill = document.createElement('div');
            pill.id = 'vn-studio-mini-pill';
            pill.style.cssText = 'position:absolute; top:10px; left:50%; transform:translateX(-50%); z-index:15; background:rgba(20,18,16,0.95); border:1px solid var(--ui-accent,#d2b278); border-radius:20px; padding:5px 12px; display:flex; align-items:center; gap:8px; box-shadow:0 6px 18px rgba(0,0,0,0.85);';
            pill.onclick = e => e.stopPropagation();
            pill.innerHTML = `
                <span style="color:var(--ui-accent,#d2b278); font-size:0.84rem; font-weight:bold;">
                    🎭 ${isLeftOut ? 'Идёт диалог:' : 'Диалог свёрнут:'} ${ESC(activeNpc ? activeNpc.name : 'NPC')}
                </span>
                <button class="btn-small btn-save" style="padding:3px 9px; font-size:0.78rem;" onclick="${isLeftOut ? 'VN_PLAYER_REJOIN()' : 'window._vnUi.minimized=false; RENDER_VN_STAGE_ON_MAP();'}">
                    ${isLeftOut ? 'Вернуться' : 'Развернуть'}
                </button>
            `;
            mapArea.appendChild(pill);
            return;
        }

        // Строим актёров на сцене (1 по центру или 2 по краям)
        const renderActor = (npc, slotObj, slotName) => {
            if (!npc || !slotObj) return '';
            const emo = GET_EMO(slotObj.emotion);
            const sprite = GET_NPC_SPRITE(npc, slotObj.emotion);
            const speaking = !isNarrator && (scene.activeSlot === slotName);
            const clickAttr = isGM ? `onclick="VN_GM_SET_ACTIVE_SLOT('${slotName}')" title="Нажмите, чтобы переключить говорящего на ${ESC(npc.name)}" style="cursor:pointer;"` : '';
            return `
                <div class="vn-actor-slot ${speaking ? 'is-speaking' : 'is-listening'}" ${clickAttr}>
                    ${sprite
                        ? `<img src="${sprite}" class="vn-sprite-img" style="border:2px solid ${speaking ? emo.glow : 'transparent'};" alt="${ESC(npc.name)}">`
                        : `<div class="vn-sprite-fallback" style="border-color:${emo.glow};">${emo.icon}</div>`}
                    <span class="vn-emo-pill">${emo.icon} ${ESC(npc.name)}</span>
                </div>`;
        };

        const twoActors = !!(leftNpc && rightNpc);
        const actorsHTML = renderActor(leftNpc, scene.leftSlot, 'left') + renderActor(rightNpc, scene.rightSlot, 'right');

        // Ответы игроков под текущей репликой
        const replies = Array.isArray(scene.playerReplies) ? scene.playerReplies.slice(-3) : [];
        const repliesHTML = replies.length ? `
            <div style="border-top:1px dashed var(--ui-border,#3e372f); padding-top:6px; max-height:68px; overflow-y:auto; display:flex; flex-direction:column; gap:4px;">
                ${replies.map(r => `
                    <div style="background:rgba(63,110,73,0.24); border-left:3px solid #6cb878; padding:3px 9px; border-radius:4px; font-size:0.84rem; color:#d8f3dc;">
                        ${r.isAction ? `✨ <b>${ESC(r.sender)}</b> <i>${ESC(r.text)}</i>` : `🗣️ <b>${ESC(r.sender)}:</b> «${ESC(r.text)}»`}
                    </div>`).join('')}
            </div>` : '';

        // История диалога (Бэклог)
        let historyDrawerHTML = '';
        if (window._vnUi.historyOpen) {
            const hist = Array.isArray(scene.history) ? scene.history : [];
            historyDrawerHTML = `
                <div class="vn-history-drawer" onclick="event.stopPropagation();">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--ui-border,#3e372f); padding-bottom:8px; margin-bottom:10px;">
                        <b style="color:var(--ui-accent,#d2b278); font-size:1rem;">📜 История диалога (${hist.length})</b>
                        <button class="btn-small" onclick="window._vnUi.historyOpen=false; RENDER_VN_STAGE_ON_MAP();">✕ К сцене</button>
                    </div>
                    <div id="vn-history-scroll" style="flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:7px; padding-right:4px;">
                        ${hist.map(h => {
                            const emo = h.emotion ? GET_EMO(h.emotion).icon + ' ' : '';
                            const border = h.kind === 'player' ? '#6cb878' : (h.kind === 'narrator' ? '#9a9286' : 'var(--ui-accent,#d2b278)');
                            return `
                                <div style="background:var(--ui-panel,#221f1c); border:1px solid var(--ui-border,#3e372f); border-left:3px solid ${border}; border-radius:7px; padding:7px 10px; font-size:0.86rem;">
                                    <div style="display:flex; justify-content:space-between; gap:8px; margin-bottom:2px;">
                                        <b style="color:${border};">${emo}${ESC(h.speaker)}${h.role ? ` <small style="color:var(--ui-muted,#888); font-weight:normal;">— ${ESC(h.role)}</small>` : ''}</b>
                                        <small style="color:var(--ui-muted,#888); font-size:0.74rem !important;">${ESC(h.time || '')}</small>
                                    </div>
                                    <div style="${h.isAction || h.whisper || h.kind === 'narrator' ? 'font-style:italic; color:var(--ui-muted,#ccc);' : 'color:var(--ui-text,#ebe8e2);'} line-height:1.42;">${ESC(h.text)}</div>
                                </div>`;
                        }).join('') || '<div style="text-align:center; color:#888; padding:24px;">История пока пуста</div>'}
                    </div>
                </div>`;
        }

        // Панель управления: разная для Игрока и для Мастера
        let controlsHTML = '';
        if (!isGM) {
            const choicesBtns = (scene.choices || []).map((ch, idx) => {
                const isLeave = /^(уйти|отойти|покинуть|закончить)/i.test(ch.trim());
                return `<button class="btn-small ${isLeave ? 'btn-danger' : ''}" style="padding:5px 10px; font-size:0.82rem;" onclick="VN_PLAYER_SEND_REPLY('${ESC_JS(ch)}', false)">${isLeave ? '🚪 ' : '💬 '}${ESC(ch)}</button>`;
            }).join('');

            controlsHTML = `
                ${choicesBtns ? `<div style="display:flex; gap:6px; flex-wrap:wrap;">${choicesBtns}</div>` : ''}
                <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                    <button class="btn-small ${window._vnUi.playerActionMode ? 'btn-cast' : ''}" style="padding:6px 8px; font-size:0.78rem;" title="Переключить: Речь или *Действие*" onclick="window._vnUi.playerActionMode=!window._vnUi.playerActionMode; RENDER_VN_STAGE_ON_MAP();">
                        ${window._vnUi.playerActionMode ? '✨ *Действие*' : '💬 Речь'}
                    </button>
                    <input type="text" id="vn-pl-live-input" value="${ESC(keepPlText)}"
                        placeholder="${window._vnUi.playerActionMode ? 'Опишите действие (напр.: кладёт руку на эфес)...' : 'Напишите свой ответ NPC...'}"
                        onkeypress="if(event.key==='Enter'){ event.preventDefault(); VN_PLAYER_SEND_REPLY(); }"
                        style="flex:1; min-width:160px; padding:6px 10px; font-size:0.86rem; text-align:left;">
                    <button class="btn-small btn-save" style="padding:6px 12px;" onclick="VN_PLAYER_SEND_REPLY()">Ответить</button>
                    <button class="btn-small btn-danger" style="padding:6px 9px; font-size:0.8rem;" onclick="VN_PLAYER_LEAVE()">🚪 Отойти</button>
                </div>`;
        } else {
            const curEmo = activeSlotObj ? (activeSlotObj.emotion || 'neutral') : 'neutral';
            const emoBtns = EMOTIONS.map(em => `
                <button data-custom-bg="1" class="btn-small" title="${em.label}" onclick="VN_GM_SET_EMOTION('${em.id}')"
                    style="padding:3px 7px; font-size:0.86rem; box-shadow:none; background:${curEmo === em.id ? 'var(--ui-btn-bg,#c8a66a)' : 'var(--ui-panel,#221f1c)'}; border:1px solid ${curEmo === em.id ? em.glow : 'var(--ui-border,#3e372f)'};">
                    ${em.icon}
                </button>`).join('');

            const gmM = window._vnUi.gmSpeakMode || 'speech';
            const modeBtn = (m, lbl) => `
                <button class="btn-small ${gmM === m ? 'btn-save' : ''}" style="padding:3px 8px; font-size:0.74rem;"
                    onclick="window._vnUi.gmSpeakMode='${m}'; ${m === 'narrator' ? "VN_GM_SET_ACTIVE_SLOT('narrator');" : (scene.activeSlot === 'narrator' ? "VN_GM_SET_ACTIVE_SLOT('left');" : "RENDER_VN_STAGE_ON_MAP();")}">${lbl}</button>`;

            const slotSwitchers = `
                ${leftNpc ? `<button class="btn-small ${scene.activeSlot === 'left' && gmM !== 'narrator' ? 'btn-save' : ''}" style="padding:3px 8px; font-size:0.74rem;" onclick="window._vnUi.gmSpeakMode='speech'; VN_GM_SET_ACTIVE_SLOT('left');">◀ ${ESC(leftNpc.name)}</button>` : ''}
                ${rightNpc ? `<button class="btn-small ${scene.activeSlot === 'right' && gmM !== 'narrator' ? 'btn-save' : ''}" style="padding:3px 8px; font-size:0.74rem;" onclick="window._vnUi.gmSpeakMode='speech'; VN_GM_SET_ACTIVE_SLOT('right');">${ESC(rightNpc.name)} ▶</button><button class="btn-small btn-danger" style="padding:2px 6px; font-size:0.72rem;" title="Убрать второго NPC из кадра" onclick="VN_REMOVE_RIGHT_NPC()">✕</button>` : ''}`;

            const liveChoicesEditor = window._vnUi.gmChoicesBarOpen ? `
                <div style="background:var(--ui-panel,#221f1c); border:1px solid var(--ui-border,#3e372f); border-radius:7px; padding:6px 8px; display:flex; flex-direction:column; gap:5px;">
                    <div style="display:flex; gap:5px; flex-wrap:wrap;">
                        ${(scene.choices || []).map((ch, i) => `<span style="background:var(--ui-panel2,#161412); border:1px solid var(--ui-accent,#d2b278); color:var(--ui-accent,#d2b278); padding:2px 7px; border-radius:6px; font-size:0.76rem;">${ESC(ch)} <b style="cursor:pointer; color:#d66565; margin-left:4px;" onclick="VN_GM_REMOVE_LIVE_CHOICE(${i})">✕</b></span>`).join('') || '<small style="color:#888;">Кнопок ответов нет</small>'}
                    </div>
                    <div style="display:flex; gap:5px;">
                        <input type="text" id="vn-gm-live-choice-inp" placeholder="Новый вариант ответа игрокам..." onkeypress="if(event.key==='Enter') VN_GM_ADD_LIVE_CHOICE();" style="flex:1; padding:4px 8px; font-size:0.8rem; text-align:left;">
                        <button class="btn-small btn-save" style="padding:4px 9px; font-size:0.78rem;" onclick="VN_GM_ADD_LIVE_CHOICE()">+ Добавить</button>
                    </div>
                </div>` : '';

            controlsHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:6px; flex-wrap:wrap;">
                    <div style="display:flex; gap:4px; flex-wrap:wrap; align-items:center;">${emoBtns}</div>
                    <div style="display:flex; gap:4px; flex-wrap:wrap; align-items:center;">
                        ${slotSwitchers}
                        ${modeBtn('speech', '💬 Речь')}
                        ${modeBtn('whisper', '💭 Шёпот')}
                        ${modeBtn('narrator', '📖 Рассказчик')}
                    </div>
                </div>
                ${liveChoicesEditor}
                <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                    <input type="text" id="vn-gm-live-input" value="${ESC(keepGmText)}"
                        placeholder="${gmM === 'narrator' ? 'Описание сцены от Рассказчика...' : `Фраза от лица «${ESC(activeNpc ? activeNpc.name : 'NPC')}»...`}"
                        onkeypress="if(event.key==='Enter'){ event.preventDefault(); VN_GM_SPEAK(); }"
                        style="flex:1; min-width:170px; padding:6px 10px; font-size:0.86rem; text-align:left;">
                    <button class="btn-small btn-save" style="padding:6px 11px;" onclick="VN_GM_SPEAK()">Сказать</button>
                    <button class="btn-small ${window._vnUi.gmChoicesBarOpen ? 'btn-save' : ''}" style="padding:6px 8px; font-size:0.78rem;" title="Кнопки вариантов ответа игрокам" onclick="window._vnUi.gmChoicesBarOpen=!window._vnUi.gmChoicesBarOpen; RENDER_VN_STAGE_ON_MAP();">💬 Кнопки</button>
                    <button class="btn-small" style="padding:6px 8px; font-size:0.78rem;" title="Запросить проверку (Убеждение / Обман / Проницательность)" onclick="OPEN_GM_SKILL_CHECK_MODAL()">🎲</button>
                    <button class="btn-small" style="padding:6px 8px; font-size:0.78rem;" title="Мастерская NPC (добавить второго NPC или сменить)" onclick="OPEN_GM_NPC_MODAL()">🎭 NPC</button>
                </div>`;
        }

        const attInfo = activeNpc ? GET_ATT(activeNpc.attitude) : null;
        const leftNote = (isGM && scene.leftPlayers && scene.leftPlayers.length)
            ? `<small style="color:#d66565; margin-left:6px;">(🚪 Отошли: ${scene.leftPlayers.map(i => GC()[i]?.name || 'Игрок').join(', ')})</small>`
            : '';

        const root = document.createElement('div');
        root.id = 'vn-studio-stage-root';
        root.className = 'vn-stage-overlay';
        root.onclick = e => e.stopPropagation();
        root.ondblclick = e => e.stopPropagation();

        root.innerHTML = `
            <div class="vn-top-bar">
                <div style="display:flex; gap:5px; align-items:center;">
                    <button class="btn-small" style="padding:4px 9px; font-size:0.78rem; background:rgba(20,18,16,0.9);" onclick="window._vnUi.historyOpen=!window._vnUi.historyOpen; RENDER_VN_STAGE_ON_MAP();">📜 История (${(scene.history || []).length})</button>
                    <button class="btn-small" style="padding:4px 9px; font-size:0.78rem; background:rgba(20,18,16,0.9);" onclick="window._vnUi.minimized=true; RENDER_VN_STAGE_ON_MAP();">🗺️ Карта</button>
                    <button class="btn-small" style="padding:4px 8px; font-size:0.74rem; background:rgba(20,18,16,0.9);" title="Переключить анимацию печати текста" onclick="VN_TOGGLE_INSTANT_TEXT()">${window._vnUi.instantText ? '⚡ Мгн.' : '⌨️ Печать'}</button>
                </div>
                <div style="display:flex; gap:5px;">
                    ${isGM && activeNpc && activeNpc.attitude === 'merchant' ? `<button class="btn-small btn-save" style="padding:4px 9px; font-size:0.78rem;" onclick="OPEN_GM_SHOP_MODAL()">🏪 Лавка</button>` : ''}
                    ${isGM ? `<button class="btn-small btn-danger" style="padding:4px 10px; font-size:0.78rem;" onclick="VN_GM_END_SCENE()">✕ Завершить</button>` : ''}
                </div>
            </div>

            <div class="vn-actors-layer ${twoActors ? 'two-actors' : ''}">
                ${actorsHTML}
            </div>

            <div class="vn-dialogue-box">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                    <div style="display:flex; align-items:center; gap:7px; flex-wrap:wrap;">
                        ${isNarrator
                            ? `<span style="background:var(--ui-panel,#221f1c); border:1px solid var(--ui-accent,#d2b278); color:var(--ui-accent,#d2b278); font-weight:bold; padding:2px 10px; border-radius:5px; font-size:0.9rem;">📖 Рассказчик</span>`
                            : `<span style="background:var(--ui-accent,#c9a96e); color:#16130e; font-weight:bold; padding:2px 11px; border-radius:5px; font-size:0.94rem;">🎭 ${ESC(activeNpc ? activeNpc.name : 'NPC')}</span>
                               ${activeNpc?.role ? `<span style="color:var(--ui-muted,#a39c90); font-size:0.84rem;">— ${ESC(activeNpc.role)}</span>` : ''}
                               ${attInfo ? `<span style="font-size:0.76rem; color:${attInfo.color};">${attInfo.icon} ${attInfo.label}</span>` : ''}`}
                        ${leftNote}
                    </div>
                    ${isGM && activeNpc?.voice ? `<small style="color:var(--ui-muted,#9a9286); font-style:italic;">🎙️ ${ESC(activeNpc.voice)}</small>` : ''}
                </div>

                <div id="vn-live-speech-text" class="vn-speech-text mode-${scene.speakMode || 'speech'}" title="Нажмите, чтобы показать всю фразу сразу"></div>
                ${repliesHTML}
                ${controlsHTML}
            </div>

            ${historyDrawerHTML}
        `;

        mapArea.appendChild(root);
        RUN_TYPEWRITER('vn-live-speech-text', scene.text || '...', `${scene.id}_${scene.textStamp}`, !isNarrator);

        if (window._vnUi.historyOpen) {
            const sc = document.getElementById('vn-history-scroll');
            if (sc) sc.scrollTop = sc.scrollHeight;
        }
        if (focusedId === 'vn-gm-live-input' || focusedId === 'vn-pl-live-input') {
            const el = document.getElementById(focusedId);
            if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
        }
    }

    // --- 5. МАСТЕРСКАЯ / РЕДАКТОР NPC ДЛЯ ГЕЙМ-МАСТЕРА ---
    function CAPTURE_DRAFT_FROM_FORM() {
        const d = window._vnUi.editorDraft;
        if (!d) return;
        d.name = document.getElementById('vns-name')?.value ?? d.name;
        d.role = document.getElementById('vns-role')?.value ?? d.role;
        d.race = document.getElementById('vns-race')?.value ?? d.race;
        d.attitude = document.getElementById('vns-att')?.value ?? d.attitude;
        d.voice = document.getElementById('vns-voice')?.value ?? d.voice;
        d.gmSecret = document.getElementById('vns-secret')?.value ?? d.gmSecret;
        d.defaultText = document.getElementById('vns-text')?.value ?? d.defaultText;
        const chRaw = document.getElementById('vns-choices')?.value;
        if (chRaw !== undefined) d.choices = chRaw.split('\n').map(s => s.trim()).filter(Boolean);
    }

    window.VNS_SELECT_NPC = function(npcId) {
        const n = GET_STUDIO_NPCS().find(x => x.id === npcId);
        if (!n) return;
        window._vnUi.editorSelectedId = n.id;
        window._vnUi.editorDraft = JSON.parse(JSON.stringify(n));
        if (!window._vnUi.editorDraft.emotions) window._vnUi.editorDraft.emotions = {};
        window._vnUi.editorEmotionTab = 'neutral';
        RENDER_NPC_STUDIO_MODAL();
    };

    window.VNS_NEW_NPC = function() {
        window._vnUi.editorSelectedId = null;
        window._vnUi.editorEmotionTab = 'neutral';
        window._vnUi.editorDraft = {
            id: null, name: '', role: '', race: '', attitude: 'neutral',
            voice: '', gmSecret: '', avatar: '', emotions: {},
            defaultText: '', choices: ['Расспросить подробнее', 'Спросить о награде', 'Уйти']
        };
        RENDER_NPC_STUDIO_MODAL();
    };

    window.VNS_SET_EMO_TAB = function(emoId) {
        CAPTURE_DRAFT_FROM_FORM();
        window._vnUi.editorEmotionTab = emoId;
        RENDER_NPC_STUDIO_MODAL();
    };

    window.VNS_UPLOAD_SPRITE = function() {
        CAPTURE_DRAFT_FROM_FORM();
        const emoId = window._vnUi.editorEmotionTab || 'neutral';
        const inp = document.createElement('input');
        inp.type = 'file'; inp.accept = 'image/*';
        inp.onchange = function(e) {
            const f = e.target.files[0]; if (!f) return;
            const reader = new FileReader();
            reader.onload = ev => {
                const img = new Image();
                img.onload = () => {
                    const maxSide = 480;
                    const scale = Math.min(1, maxSide / Math.max(img.width || 1, img.height || 1));
                    const c = document.createElement('canvas');
                    c.width = Math.max(1, Math.round(img.width * scale));
                    c.height = Math.max(1, Math.round(img.height * scale));
                    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
                    // Сохраняем прозрачность PNG/WebP для спрайтов новеллы!
                    const isAlpha = /png|webp/i.test(f.type);
                    const dataUrl = isAlpha ? c.toDataURL('image/webp', 0.84) : c.toDataURL('image/jpeg', 0.82);

                    if (window._vnUi.editorDraft) {
                        if (!window._vnUi.editorDraft.emotions) window._vnUi.editorDraft.emotions = {};
                        window._vnUi.editorDraft.emotions[emoId] = dataUrl;
                        if (emoId === 'neutral' || !window._vnUi.editorDraft.avatar) {
                            window._vnUi.editorDraft.avatar = dataUrl;
                        }
                    }
                    RENDER_NPC_STUDIO_MODAL();
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(f);
        };
        inp.click();
    };

    window.VNS_SET_SPRITE_URL = function() {
        CAPTURE_DRAFT_FROM_FORM();
        const emoId = window._vnUi.editorEmotionTab || 'neutral';
        const url = (prompt(`Прямая ссылка (URL) на спрайт эмоции «${GET_EMO(emoId).label}»:`) || '').trim();
        if (!url || !/^https?:\/\//i.test(url)) return;
        if (!window._vnUi.editorDraft.emotions) window._vnUi.editorDraft.emotions = {};
        window._vnUi.editorDraft.emotions[emoId] = url;
        if (emoId === 'neutral' || !window._vnUi.editorDraft.avatar) window._vnUi.editorDraft.avatar = url;
        RENDER_NPC_STUDIO_MODAL();
    };

    window.VNS_CLEAR_SPRITE = function() {
        CAPTURE_DRAFT_FROM_FORM();
        const emoId = window._vnUi.editorEmotionTab || 'neutral';
        if (window._vnUi.editorDraft?.emotions) delete window._vnUi.editorDraft.emotions[emoId];
        if (emoId === 'neutral' && window._vnUi.editorDraft) {
            window._vnUi.editorDraft.avatar = Object.values(window._vnUi.editorDraft.emotions || {})[0] || '';
        }
        RENDER_NPC_STUDIO_MODAL();
    };

    window.VNS_SAVE_NPC = function(thenAction) {
        if (!IS_GM()) return;
        CAPTURE_DRAFT_FROM_FORM();
        const d = window._vnUi.editorDraft;
        if (!d || !String(d.name || '').trim()) {
            showMessage('⚠️ Введите имя NPC', 'Укажите имя персонажа перед сохранением.');
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
            updatedAt: Date.now()
        };
        const idx = list.findIndex(x => x.id === id);
        if (idx !== -1) list[idx] = saved;
        else list.unshift(saved);

        SAVE_STUDIO_NPCS(list);
        window._vnUi.editorSelectedId = id;
        window._vnUi.editorDraft = JSON.parse(JSON.stringify(saved));

        if (thenAction === 'start') { window.VN_START_SCENE_WITH_NPC(id, saved.defaultText, saved.choices); return; }
        if (thenAction === 'second') { window.VN_ADD_SECOND_NPC_TO_SCENE(id); return; }
        RENDER_NPC_STUDIO_MODAL();
    };

    window.VNS_DELETE_NPC = function(npcId) {
        if (!IS_GM()) return;
        const list = GET_STUDIO_NPCS();
        const n = list.find(x => x.id === npcId);
        if (!n || !confirm(`Удалить NPC «${n.name}» из комнаты?`)) return;
        const next = list.filter(x => x.id !== npcId);
        SAVE_STUDIO_NPCS(next);
        if (window._vnUi.editorSelectedId === npcId) {
            window._vnUi.editorSelectedId = next[0]?.id || null;
            window._vnUi.editorDraft = next[0] ? JSON.parse(JSON.stringify(next[0])) : null;
        }
        RENDER_NPC_STUDIO_MODAL();
    };

    window.VNS_PLACE_NPC_ON_MAP = function() {
        if (!IS_GM()) return;
        window.VNS_SAVE_NPC();
        const d = window._vnUi.editorDraft;
        if (!d || !d.id) return;
        const att = GET_ATT(d.attitude);
        const st = GET_MAP_STATE();
        if (!st.pins) st.pins = [];
        st.pins.push({
            id: Date.now(),
            x: 45 + Math.floor(Math.random() * 14),
            y: 45 + Math.floor(Math.random() * 14),
            icon: att.icon,
            label: d.name,
            color: att.color,
            actionText: `${d.role ? d.role + '. ' : ''}${d.defaultText || 'Готов к разговору.'}`,
            npcId: d.id,
            oneTime: false
        });
        SAVE_MAP_STATE(st);
        CM('gm-tool-modal');
        RENDER_MAP_AREA();
        showMessage('📍 NPC на карте', `Значок «<b>${ESC(d.name)}</b>» поставлен на карту! Перетащите его в нужное место.`);
    };

    window.VNS_SEND_NPC_TO_BESTIARY = function() {
        if (!IS_GM()) return;
        window.VNS_SAVE_NPC();
        const d = window._vnUi.editorDraft;
        if (!d || !d.name || typeof GET_BESTIARY !== 'function') return;
        const list = GET_BESTIARY();
        list.push({
            name: d.name, icon: GET_ATT(d.attitude).icon,
            hp: 24, maxHp: 24, ac: 14, atkBonus: 4, dmgFormula: '1к8+2',
            desc: d.role || 'Персонаж из Мастерской NPC'
        });
        SAVE_BESTIARY(list);
        showMessage('⚔️ Добавлен в Бестиарий', `NPC «<b>${ESC(d.name)}</b>» скопирован в Бестиарий — теперь его можно выставить как врага на карту.`);
    };

    window.VNS_SEND_NPC_TO_LOREBOOK = function() {
        if (!IS_GM()) return;
        window.VNS_SAVE_NPC();
        const d = window._vnUi.editorDraft;
        const rc = CUR_ROOM();
        if (!d || !d.name || !rc) return;
        const entry = {
            id: 'lore_npc_' + d.id,
            title: d.name,
            category: 'npc',
            tags: [d.race, d.role].filter(Boolean).join(', '),
            visibility: 'all',
            img: d.avatar || '',
            text: `${d.role ? `**${d.role}**` : ''}${d.race ? ` (${d.race})` : ''}\n\n${d.defaultText || 'Персонаж кампании.'}`,
            updatedAt: Date.now()
        };
        if (window.firebase && firebase.apps && firebase.apps.length) {
            firebase.database().ref(`campaign_v2/rooms/${rc}/lore_v2/${entry.id}`).set(entry).catch(() => {});
        }
        showMessage('📖 Добавлен в Лорбук', `Карточка «<b>${ESC(d.name)}</b>» добавлена в раздел «🎭 Персонажи» Лорбука (без ваших секретных заметок).`);
    };

    function RENDER_NPC_STUDIO_MODAL() {
        ENSURE_VN_CSS();
        const cont = document.getElementById('gm-tool-modal-content');
        if (!cont) return;
        cont.style.maxWidth = '1040px';

        const allNpcs = GET_STUDIO_NPCS();
        const scene = GET_LIVE_SCENE();
        const q = (window._vnUi.editorSearch || '').toLowerCase().trim();
        const attF = window._vnUi.editorAttFilter || 'all';

        if (!window._vnUi.editorDraft) {
            if (allNpcs.length) {
                window._vnUi.editorSelectedId = allNpcs[0].id;
                window._vnUi.editorDraft = JSON.parse(JSON.stringify(allNpcs[0]));
            } else {
                window._vnUi.editorDraft = { id: null, name: '', role: '', race: '', attitude: 'neutral', voice: '', gmSecret: '', avatar: '', emotions: {}, defaultText: '', choices: ['Расспросить подробнее', 'Уйти'] };
            }
        }

        const filtered = allNpcs.filter(n => {
            const attOk = attF === 'all' || (n.attitude || 'neutral') === attF;
            const qOk = !q || (n.name || '').toLowerCase().includes(q) || (n.role || '').toLowerCase().includes(q);
            return attOk && qOk;
        });

        const listHTML = filtered.map(n => {
            const att = GET_ATT(n.attitude);
            const act = window._vnUi.editorDraft?.id === n.id;
            const emoCnt = Object.keys(n.emotions || {}).filter(k => n.emotions[k]).length;
            return `
                <button data-custom-bg="1" class="vn-npc-card-btn ${act ? 'is-active' : ''}" onclick="VNS_SELECT_NPC('${ESC_JS(n.id)}')">
                    ${n.avatar ? `<img src="${n.avatar}" style="width:38px; height:38px; border-radius:50%; object-fit:cover; border:2px solid ${att.color}; flex-shrink:0;">` : `<div style="width:38px; height:38px; border-radius:50%; background:var(--ui-panel2,#161412); border:1px solid ${att.color}; display:flex; align-items:center; justify-content:center; flex-shrink:0;">${att.icon}</div>`}
                    <div style="flex:1; min-width:0;">
                        <div style="font-weight:700; font-size:0.86rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:${act ? 'var(--ui-accent,#d2b278)' : 'var(--ui-text,#e5e0d7)'};">${ESC(n.name)}</div>
                        <div style="font-size:0.73rem; color:var(--ui-muted,#888); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${att.icon} ${ESC(n.role || att.label)}${emoCnt > 1 ? ` • ${emoCnt} поз` : ''}</div>
                    </div>
                </button>`;
        }).join('') || '<div style="text-align:center; padding:18px; color:var(--ui-muted,#888); font-size:0.84rem;">NPC не найдены</div>';

        const d = window._vnUi.editorDraft;
        const emoTab = window._vnUi.editorEmotionTab || 'neutral';
        const curEmoSprite = (d.emotions && d.emotions[emoTab]) || '';
        const emoTabsHTML = EMOTIONS.map(em => {
            const has = !!(d.emotions && d.emotions[em.id]);
            const act = emoTab === em.id;
            return `<button data-custom-bg="1" class="btn-small" onclick="VNS_SET_EMO_TAB('${em.id}')"
                style="padding:4px 8px; font-size:0.76rem; box-shadow:none; background:${act ? 'var(--ui-btn-bg,#c8a66a)' : 'var(--ui-panel,#221f1c)'}; color:${act ? 'var(--ui-btn-text,#1a150f)' : 'var(--ui-text,#e5e0d7)'}; border:1px solid ${act ? em.glow : (has ? '#6cb878' : 'var(--ui-border,#3e372f)')};">
                ${em.icon} ${em.label}${has ? ' ✓' : ''}
            </button>`;
        }).join('');

        cont.innerHTML = `
            <div id="vn-studio-modal-marker"></div>
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; border-bottom:1px solid var(--ui-border,#3e372f); padding-bottom:9px; margin-bottom:11px;">
                <h2 style="margin:0; border:none; padding:0; font-size:1.25rem;">🎭 Мастерская NPC и Визуальная Новелла <small style="color:var(--ui-muted,#888); font-weight:normal;">(Комната #${ESC(CUR_ROOM())})</small></h2>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button class="btn-small btn-save" onclick="VNS_NEW_NPC()">➕ Новый NPC</button>
                    ${scene && scene.active ? `<button class="btn-small btn-danger" onclick="VN_GM_END_SCENE(); RENDER_NPC_STUDIO_MODAL();">✕ Завершить сцену</button>` : ''}
                    <button class="btn-small" onclick="CM('gm-tool-modal')">Закрыть</button>
                </div>
            </div>

            <div class="vn-studio-grid">
                <div class="vn-studio-list">
                    <input type="text" value="${ESC(window._vnUi.editorSearch)}" oninput="window._vnUi.editorSearch=this.value; RENDER_NPC_STUDIO_MODAL();" placeholder="🔍 Поиск NPC..." style="width:100%; padding:6px 9px; margin-bottom:6px; font-size:0.84rem;">
                    <div style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:8px;">
                        <button class="btn-small ${attF === 'all' ? 'btn-save' : ''}" style="padding:2px 7px; font-size:0.72rem;" onclick="window._vnUi.editorAttFilter='all'; RENDER_NPC_STUDIO_MODAL();">Все</button>
                        ${ATTITUDES.map(a => `<button class="btn-small ${attF === a.id ? 'btn-save' : ''}" style="padding:2px 6px; font-size:0.72rem;" title="${a.label}" onclick="window._vnUi.editorAttFilter='${a.id}'; RENDER_NPC_STUDIO_MODAL();">${a.icon}</button>`).join('')}
                    </div>
                    <div style="flex:1; overflow-y:auto; padding-right:2px;">${listHTML}</div>
                </div>

                <div class="vn-studio-editor">
                    <!-- Спрайты эмоций и основные данные -->
                    <div style="background:var(--ui-panel,#221f1c); border:1px solid var(--ui-border,#3e372f); border-radius:9px; padding:10px;">
                        <div style="display:flex; gap:12px; align-items:flex-start; flex-wrap:wrap;">
                            <div style="display:flex; flex-direction:column; align-items:center; gap:6px; width:132px; flex-shrink:0;">
                                <div onclick="VNS_UPLOAD_SPRITE()" title="Нажмите, чтобы загрузить спрайт для этой эмоции"
                                    style="width:124px; height:124px; border-radius:10px; border:2px dashed var(--ui-accent,#d2b278); background:var(--ui-panel2,#161412); display:flex; flex-direction:column; align-items:center; justify-content:center; overflow:hidden; cursor:pointer;">
                                    ${curEmoSprite
                                        ? `<img src="${curEmoSprite}" style="width:100%; height:100%; object-fit:contain;">`
                                        : `<span style="font-size:2rem;">${GET_EMO(emoTab).icon}</span><small style="color:var(--ui-muted,#aaa); font-size:0.7rem; text-align:center; padding:0 4px;">Спрайт: ${GET_EMO(emoTab).label}</small>`}
                                </div>
                                <div style="display:flex; gap:4px; width:100%;">
                                    <button class="btn-small" style="flex:1; padding:3px 5px; font-size:0.72rem;" onclick="VNS_UPLOAD_SPRITE()">📷 Файл</button>
                                    <button class="btn-small" style="padding:3px 6px; font-size:0.72rem;" title="Вставить ссылку URL" onclick="VNS_SET_SPRITE_URL()">🔗</button>
                                    ${curEmoSprite ? `<button class="btn-small btn-danger" style="padding:3px 6px; font-size:0.72rem;" onclick="VNS_CLEAR_SPRITE()">✕</button>` : ''}
                                </div>
                            </div>

                            <div style="flex:1; min-width:220px; display:flex; flex-direction:column; gap:7px;">
                                <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:7px;">
                                    <input type="text" id="vns-name" value="${ESC(d.name)}" placeholder="Имя NPC..." style="padding:7px 9px; font-weight:bold;">
                                    <select id="vns-att" style="padding:7px 9px;">${ATTITUDES.map(a => `<option value="${a.id}" ${d.attitude === a.id ? 'selected' : ''}>${a.icon} ${a.label}</option>`).join('')}</select>
                                </div>
                                <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:7px;">
                                    <input type="text" id="vns-role" value="${ESC(d.role)}" placeholder="Должность / Титул..." style="padding:7px 9px; font-size:0.86rem;">
                                    <input type="text" id="vns-race" value="${ESC(d.race || '')}" placeholder="Раса / Фракция..." style="padding:7px 9px; font-size:0.86rem;">
                                </div>
                                <input type="text" id="vns-voice" value="${ESC(d.voice || '')}" placeholder="🎙️ Подсказка отыгрыша (голос, манера, привычка — видно только ГМ)" style="padding:6px 9px; font-size:0.82rem;">
                                <div style="font-size:0.74rem; color:var(--ui-muted,#aaa); margin-top:2px;">Эмоции / позы (выберите вкладку и загрузите отдельный спрайт):</div>
                                <div style="display:flex; gap:4px; flex-wrap:wrap;">${emoTabsHTML}</div>
                            </div>
                        </div>
                    </div>

                    <div style="display:grid; grid-template-columns:1.2fr 1fr; gap:9px;">
                        <div>
                            <label style="font-size:0.8rem; color:var(--ui-accent,#d2b278); font-weight:bold;">💬 Стартовая фраза NPC:</label>
                            <textarea id="vns-text" style="width:100%; min-height:76px; padding:7px 9px; margin-top:4px; font-size:0.86rem;" placeholder="Что скажет персонаж при появлении...">${ESC(d.defaultText || '')}</textarea>
                        </div>
                        <div>
                            <label style="font-size:0.8rem; color:var(--ui-accent,#d2b278); font-weight:bold;">🔘 Варианты ответа (по 1 на строку):</label>
                            <textarea id="vns-choices" style="width:100%; min-height:76px; padding:7px 9px; margin-top:4px; font-size:0.84rem;" placeholder="Спросить о деле&#10;Попросить скидку&#10;Уйти">${ESC((d.choices || []).join('\n'))}</textarea>
                        </div>
                    </div>

                    <div>
                        <label style="font-size:0.8rem; color:var(--ui-muted,#aaa);">🔒 Секретные заметки Мастера (игроки никогда не увидят):</label>
                        <input type="text" id="vns-secret" value="${ESC(d.gmSecret || '')}" placeholder="Истинные мотивы, тайный квест, слабость..." style="width:100%; padding:6px 9px; margin-top:3px; font-size:0.84rem;">
                    </div>

                    <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; justify-content:space-between; padding-top:4px; border-top:1px dashed var(--ui-border,#3e372f);">
                        <div style="display:flex; gap:6px; flex-wrap:wrap;">
                            <button class="btn-save" onclick="VNS_SAVE_NPC('start')">🎬 Начать диалог</button>
                            ${scene && scene.active ? `<button class="btn-cast" onclick="VNS_SAVE_NPC('second')">👥 + 2-м в кадр</button>` : ''}
                            <button class="btn-small" onclick="VNS_SAVE_NPC()">💾 Сохранить</button>
                        </div>
                        <div style="display:flex; gap:5px; flex-wrap:wrap;">
                            <button class="btn-small" title="Поставить значок этого NPC на карту" onclick="VNS_PLACE_NPC_ON_MAP()">📍 На карту</button>
                            <button class="btn-small" title="Скопировать в Бестиарий для боя" onclick="VNS_SEND_NPC_TO_BESTIARY()">⚔️ Бестиарий</button>
                            <button class="btn-small" title="Добавить карточку в Лорбук" onclick="VNS_SEND_NPC_TO_LOREBOOK()">📖 Лорбук</button>
                            ${d.id ? `<button class="btn-small btn-danger" onclick="VNS_DELETE_NPC('${ESC_JS(d.id)}')">🗑️</button>` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // --- 6. ХУКИ (КНОПКА «🎭 ДИАЛОГ NPC», КАРТА, ЗНАЧКИ НА КАРТЕ, СМЕНА КОМНАТЫ) ---
    window.OPEN_GM_NPC_MODAL = function() {
        if (!IS_GM()) return;
        RENDER_NPC_STUDIO_MODAL();
        OM('gm-tool-modal');
    };

    const _ORIG_RENDER_MAP_VN = window.RENDER_MAP_AREA;
    if (typeof _ORIG_RENDER_MAP_VN === 'function') {
        window.RENDER_MAP_AREA = function() {
            _ORIG_RENDER_MAP_VN();
            RENDER_VN_STAGE_ON_MAP();
        };
    }

    // Интерактивность значка NPC на карте
    const _ORIG_PIN_INT = window.INTERACT_WITH_MAP_PIN;
    if (typeof _ORIG_PIN_INT === 'function') {
        window.INTERACT_WITH_MAP_PIN = function(pinIdx) {
            const st = GET_MAP_STATE();
            const pin = st && st.pins && st.pins[pinIdx];
            if (pin && pin.npcId) {
                const npc = GET_STUDIO_NPCS().find(n => n.id === pin.npcId);
                if (npc) {
                    if (IS_GM()) {
                        window.VNS_SELECT_NPC(npc.id);
                        OM('gm-tool-modal');
                        return;
                    }
                    const scene = GET_LIVE_SCENE();
                    const isHere = scene && scene.active && ((scene.leftSlot && scene.leftSlot.npcId === npc.id) || (scene.rightSlot && scene.rightSlot.npcId === npc.id));
                    if (isHere) { window.VN_PLAYER_REJOIN(); return; }
                    const att = GET_ATT(npc.attitude);
                    showMessage(`${att.icon} ${npc.name}`, `
                        <div style="text-align:center;">
                            ${npc.avatar ? `<img src="${npc.avatar}" style="max-height:150px; max-width:150px; object-fit:contain; border-radius:10px; border:2px solid ${att.color}; margin-bottom:10px;">` : ''}
                            <div style="color:var(--ui-muted,#aaa); font-size:0.9rem; margin-bottom:8px;">${ESC(npc.role || att.label)}</div>
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
        window.SWITCH_FIREBASE_ROOM = function(rc) {
            const r = _ORIG_SW_VN(rc);
            SYNC_VN_FOR_ROOM(rc);
            return r;
        };
    }

    const _ORIG_APPLY_VN = window.APPLY_ROLE_VIEW;
    if (typeof _ORIG_APPLY_VN === 'function') {
        window.APPLY_ROLE_VIEW = function() {
            _ORIG_APPLY_VN();
            SYNC_VN_FOR_ROOM(CUR_ROOM());
            RENDER_VN_STAGE_ON_MAP();
        };
    }

    SYNC_VN_FOR_ROOM(CUR_ROOM());
    RENDER_VN_STAGE_ON_MAP();
})();