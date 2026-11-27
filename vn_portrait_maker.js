// ================================================================
// 📚 ЧИСТАЯ БИБЛИОТЕКА NPC-АССЕТОВ (С ЭМОЦИЯМИ / БЕЗ ЭМОЦИЙ)
// + АВТО-СКРЫТИЕ КНОПОК ЭМОЦИЙ ДЛЯ ОДИНОЧНЫХ ПОРТРЕТОВ (vn_portrait_maker.js)
// ================================================================
(function INIT_VN_ASSET_LIBRARY_V2() {
    const EMOTIONS = [
        { id: 'neutral',   icon: '😐', label: 'Спокойный' },
        { id: 'happy',     icon: '😊', label: 'Радостный' },
        { id: 'angry',     icon: '😠', label: 'Злой' },
        { id: 'surprised', icon: '😮', label: 'Удивлённый' },
        { id: 'sad',       icon: '😢', label: 'Грустный' },
        { id: 'smug',      icon: '😏', label: 'Хитрый' }
    ];

    const PAGE_SIZE = 24;

    window._vnlState = {
        mode: 'library',        // 'library' | 'upload'
        mainCat: 'sets',        // 'sets' (С эмоциями) | 'single' (Без эмоций)
        singleSub: 'avatars',   // 'avatars' | 'elves' | 'humans' | 'sprites'
        page: 0,
        selectedSetId: null,
        notice: ''
    };

    const ESC = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const ESC_JS = s => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const CUR_ROOM = () => { const s = (typeof GET_SESSION === 'function') ? GET_SESSION() : null; return (s && s.roomCode) ? String(s.roomCode) : null; };

    function GET_ASSETS() {
        const raw = window.NPC_ASSETS || {};
        const arr = v => Array.isArray(v) ? v : (v ? [v] : []);
        return {
            sets:    arr(raw.sets).filter(s => s && Array.isArray(s.sprites) && s.sprites.length >= 2),
            avatars: arr(raw.avatars),
            elves:   arr(raw.elves),
            humans:  arr(raw.humans),
            sprites: arr(raw.sprites)
        };
    }

    // Определяет, какие эмоции реально есть у NPC (и есть ли >= 2 разных картинок)
    function GET_NPC_REAL_EMOTIONS(npc) {
        if (!npc || !npc.emotions || typeof npc.emotions !== 'object') {
            return { hasEmotions: false, validIds: [], uniqueCount: npc && npc.avatar ? 1 : 0 };
        }
        const validIds = [];
        const uniqueUrls = new Set();
        EMOTIONS.forEach(em => {
            const url = npc.emotions[em.id];
            if (url) {
                validIds.push(em.id);
                uniqueUrls.add(url);
            }
        });
        return {
            hasEmotions: uniqueUrls.size >= 2,
            validIds,
            uniqueCount: uniqueUrls.size
        };
    }

    function ENSURE_LIB_CSS() {
        if (document.getElementById('vnl-gallery-css')) return;
        const st = document.createElement('style');
        st.id = 'vnl-gallery-css';
        st.textContent = `
            .vnl-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
                gap: 8px;
                max-height: 330px;
                overflow-y: auto;
                padding: 4px 2px;
            }
            .vnl-card {
                background: var(--ui-panel, #221f1c);
                border: 1px solid var(--ui-border, #3e372f);
                border-radius: 8px;
                padding: 4px;
                cursor: pointer;
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 4px;
                position: relative;
                transition: border-color 0.14s, transform 0.14s;
            }
            .vnl-card:hover { border-color: var(--ui-accent, #d2b278); transform: translateY(-1px); }
            .vnl-card.is-picked { border: 2px solid #6cb878; box-shadow: 0 0 0 1px #6cb878; }
            .vnl-card img {
                width: 100%; height: 96px; object-fit: contain;
                border-radius: 6px; background: var(--ui-panel2, #161412);
                display: block;
            }
            .vnl-card.is-cover img { object-fit: cover; }
            .vnl-badge {
                position: absolute; top: 6px; right: 6px;
                background: rgba(16,14,12,0.88); color: #e6c88c;
                border: 1px solid rgba(201,169,110,0.5);
                border-radius: 10px; padding: 1px 6px;
                font-size: 0.68rem; font-weight: 700;
            }
        `;
        document.head.appendChild(st);
    }

    // --- ОБРАБОТЧИКИ ГАЛЕРЕИ (НА WINDOW) ---
    window.VNL_SET_MODE = function(mode) {
        window._vnlState.mode = mode;
        window._vnlState.notice = '';
        if (typeof window.RENDER_NPC_STUDIO_MODAL === 'function') window.RENDER_NPC_STUDIO_MODAL();
    };

    window.VNL_SET_MAIN_CAT = function(cat) {
        window._vnlState.mainCat = cat;
        window._vnlState.page = 0;
        window._vnlState.selectedSetId = null;
        window._vnlState.notice = '';
        if (typeof window.RENDER_NPC_STUDIO_MODAL === 'function') window.RENDER_NPC_STUDIO_MODAL();
    };

    window.VNL_SET_SINGLE_SUB = function(sub) {
        window._vnlState.singleSub = sub;
        window._vnlState.page = 0;
        window._vnlState.notice = '';
        if (typeof window.RENDER_NPC_STUDIO_MODAL === 'function') window.RENDER_NPC_STUDIO_MODAL();
    };

    window.VNL_SET_PAGE = function(p) {
        window._vnlState.page = Math.max(0, p);
        if (typeof window.RENDER_NPC_STUDIO_MODAL === 'function') window.RENDER_NPC_STUDIO_MODAL();
    };

    window.VNL_OPEN_SET = function(setId) {
        window._vnlState.selectedSetId = setId;
        window._vnlState.notice = '';
        if (typeof window.RENDER_NPC_STUDIO_MODAL === 'function') window.RENDER_NPC_STUDIO_MODAL();
    };

    // Выбор персонажа С ЭМОЦИЯМИ — полностью заменяет старую внешность
    window.VNL_APPLY_FULL_SET = function(setId) {
        const draft = window._vnUi && window._vnUi.draft;
        const set = GET_ASSETS().sets.find(s => s.id === setId);
        if (!draft || !set) return;

        draft.emotions = Object.assign({}, set.emotions || {});
        draft.avatar = draft.emotions.neutral || set.preview || set.sprites[0] || '';
        const info = GET_NPC_REAL_EMOTIONS(draft);
        window._vnlState.notice = `✅ Выбран персонаж с эмоциями (${info.uniqueCount} поз). Нажмите «💾 Сохранить NPC» внизу.`;
        if (typeof window.RENDER_NPC_STUDIO_MODAL === 'function') window.RENDER_NPC_STUDIO_MODAL();
    };

    // Выбор одиночного портрета БЕЗ ЭМОЦИЙ — полностью очищает старые эмоции прошлого персонажа!
    window.VNL_PICK_SINGLE_PORTRAIT = function(url) {
        const draft = window._vnUi && window._vnUi.draft;
        if (!draft || !url) return;

        draft.emotions = { neutral: url };
        draft.avatar = url;
        window._vnlState.notice = '✅ Выбран одиночный портрет (без эмоций — кнопки эмоций в сцене будут отключены).';
        if (typeof window.RENDER_NPC_STUDIO_MODAL === 'function') window.RENDER_NPC_STUDIO_MODAL();
    };

    window.VNL_CLEAR_APPEARANCE = function() {
        const draft = window._vnUi && window._vnUi.draft;
        if (!draft) return;
        draft.emotions = {};
        draft.avatar = '';
        window._vnlState.notice = 'Внешность очищена (будет показан силуэт).';
        if (typeof window.RENDER_NPC_STUDIO_MODAL === 'function') window.RENDER_NPC_STUDIO_MODAL();
    };

    window.VNL_PICK_RANDOM = function() {
        const assets = GET_ASSETS();
        if (window._vnlState.mainCat === 'sets' && assets.sets.length) {
            const rnd = assets.sets[Math.floor(Math.random() * assets.sets.length)];
            window._vnlState.selectedSetId = rnd.id;
            window.VNL_APPLY_FULL_SET(rnd.id);
            return;
        }
        const sub = window._vnlState.singleSub || 'avatars';
        const list = assets[sub] || [];
        if (list.length) {
            window.VNL_PICK_SINGLE_PORTRAIT(list[Math.floor(Math.random() * list.length)]);
        }
    };

    // --- ОТРИСОВКА ГАЛЕРЕИ ---
    function BUILD_PAGER_HTML(page, totalPages) {
        if (totalPages <= 1) return '';
        return `
            <div style="display:flex; justify-content:center; align-items:center; gap:8px; padding-top:4px;">
                <button data-custom-bg="1" class="vn-soft-btn" ${page <= 0 ? 'disabled style="opacity:0.4;"' : ''} onclick="VNL_SET_PAGE(${page - 1})">◀ Назад</button>
                <span style="font-size:0.8rem; color:var(--ui-muted,#aaa);">Страница <b>${page + 1}</b> из ${totalPages}</span>
                <button data-custom-bg="1" class="vn-soft-btn" ${page >= totalPages - 1 ? 'disabled style="opacity:0.4;"' : ''} onclick="VNL_SET_PAGE(${page + 1})">Вперёд ▶</button>
            </div>`;
    }

    function BUILD_LIBRARY_HTML() {
        ENSURE_LIB_CSS();
        const draft = window._vnUi && window._vnUi.draft;
        const assets = GET_ASSETS();
        const singleTotal = assets.avatars.length + assets.elves.length + assets.humans.length + assets.sprites.length;

        if (assets.sets.length === 0 && singleTotal === 0) {
            return `
                <div style="background:var(--ui-panel,#221f1c); border:1px dashed var(--ui-accent,#d2b278); border-radius:10px; padding:18px; text-align:center;">
                    <b style="color:var(--ui-accent,#d2b278);">📂 Библиотека ассетов пуста</b>
                    <p style="font-size:0.84rem; color:var(--ui-muted,#aaa); margin:6px 0 0 0;">Запустите <code>run_sort_npc.bat</code>, чтобы собрать <code>npc_assets.js</code>.</p>
                </div>`;
        }

        if (window._vnlState.mainCat === 'sets' && assets.sets.length === 0) window._vnlState.mainCat = 'single';
        if (window._vnlState.mainCat === 'single' && singleTotal === 0) window._vnlState.mainCat = 'sets';

        const mainCat = window._vnlState.mainCat;
        const curInfo = GET_NPC_REAL_EMOTIONS(draft);
        const curImg = draft?.avatar || (draft?.emotions && draft.emotions.neutral) || '';

        // Компактная полоска текущего выбранного портрета + переключатель «С эмоциями / Без эмоций»
        const topRow = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                <div style="display:flex; gap:5px; flex-wrap:wrap;">
                    <button data-custom-bg="1" class="vn-soft-btn ${mainCat === 'sets' ? 'is-active' : ''}" onclick="VNL_SET_MAIN_CAT('sets')">🎭 С эмоциями (${assets.sets.length})</button>
                    <button data-custom-bg="1" class="vn-soft-btn ${mainCat === 'single' ? 'is-active' : ''}" onclick="VNL_SET_MAIN_CAT('single')">🖼️ Без эмоций (${singleTotal})</button>
                </div>
                <div style="display:flex; gap:6px; align-items:center;">
                    <button data-custom-bg="1" class="vn-soft-btn" style="border-color:var(--ui-accent,#d2b278) !important;" onclick="VNL_PICK_RANDOM()">🎲 Случайный</button>
                    ${curImg ? `
                        <div style="display:flex; align-items:center; gap:6px; background:var(--ui-panel,#221f1c); border:1px solid var(--ui-border,#3e372f); border-radius:7px; padding:2px 7px 2px 3px;">
                            <img src="${curImg}" style="width:26px; height:26px; border-radius:5px; object-fit:cover;">
                            <small style="color:var(--ui-accent,#d2b278); font-size:0.74rem !important;">${curInfo.hasEmotions ? `🎭 ${curInfo.uniqueCount} поз` : '🖼️ 1 портрет'}</small>
                            <b style="cursor:pointer; color:#e07a7a; font-size:0.78rem; padding:0 2px;" title="Сбросить картинку" onclick="VNL_CLEAR_APPEARANCE()">✕</b>
                        </div>` : ''}
                </div>
            </div>`;

        const noticeHTML = window._vnlState.notice
            ? `<div style="font-size:0.8rem; color:#86efac; background:rgba(63,110,73,0.18); border:1px solid #4d7c58; border-radius:7px; padding:5px 10px;">${ESC(window._vnlState.notice)}</div>`
            : '';

        // 1. ВКЛАДКА «🎭 С ЭМОЦИЯМИ»
        if (mainCat === 'sets') {
            const selSet = window._vnlState.selectedSetId ? assets.sets.find(s => s.id === window._vnlState.selectedSetId) : null;
            if (selSet) {
                const emEntries = EMOTIONS.filter(em => selSet.emotions && selSet.emotions[em.id]);
                const fallbackSprites = emEntries.length
                    ? emEntries.map(em => ({ url: selSet.emotions[em.id], cap: `${em.icon} ${em.label}` }))
                    : selSet.sprites.map((u, i) => ({ url: u, cap: `Поза ${i + 1}` }));

                return `
                    ${topRow}
                    ${noticeHTML}
                    <div style="background:var(--ui-panel,#221f1c); border:1px solid var(--ui-accent,#d2b278); border-radius:9px; padding:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:9px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <button data-custom-bg="1" class="vn-soft-btn" onclick="VNL_OPEN_SET(null)">⬅️ Назад к списку</button>
                                <b style="color:var(--ui-accent,#d2b278); font-size:0.9rem;">${ESC(selSet.label)}</b>
                            </div>
                            <button class="btn-save" style="padding:6px 14px; font-size:0.85rem;" onclick="VNL_APPLY_FULL_SET('${ESC_JS(selSet.id)}')">✨ Выбрать персонажа (${fallbackSprites.length} эмоций)</button>
                        </div>
                        <div class="vnl-grid">
                            ${fallbackSprites.map(item => `
                                <div class="vnl-card" style="cursor:default;">
                                    <img src="${item.url}" loading="lazy" alt="${ESC(item.cap)}">
                                    <div style="font-size:0.72rem; color:var(--ui-muted,#ccc);">${ESC(item.cap)}</div>
                                </div>`).join('')}
                        </div>
                    </div>`;
            }

            const totalPages = Math.max(1, Math.ceil(assets.sets.length / PAGE_SIZE));
            const page = Math.min(window._vnlState.page, totalPages - 1);
            const slice = assets.sets.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

            return `
                ${topRow}
                ${noticeHTML}
                <div class="vnl-grid">
                    ${slice.map(s => {
                        const picked = curImg === s.preview;
                        return `
                            <div class="vnl-card ${picked ? 'is-picked' : ''}" onclick="VNL_OPEN_SET('${ESC_JS(s.id)}')">
                                <span class="vnl-badge">${s.sprites.length} поз</span>
                                <img src="${s.preview}" loading="lazy" alt="${ESC(s.label)}">
                                <div style="font-size:0.7rem; color:var(--ui-muted,#ccc); width:100%; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ESC(s.label)}</div>
                            </div>`;
                    }).join('')}
                </div>
                ${BUILD_PAGER_HTML(page, totalPages)}`;
        }

        // 2. ВКЛАДКА «🖼️ БЕЗ ЭМОЦИЙ» (ОДИНОЧНЫЕ ПОРТРЕТЫ)
        const subs = [
            { id: 'avatars', lbl: `Портреты (${assets.avatars.length})`, cnt: assets.avatars.length },
            { id: 'elves',   lbl: `Эльфы (${assets.elves.length})`,      cnt: assets.elves.length },
            { id: 'humans',  lbl: `Люди (${assets.humans.length})`,      cnt: assets.humans.length },
            { id: 'sprites', lbl: `Позы (${assets.sprites.length})`,     cnt: assets.sprites.length }
        ].filter(s => s.cnt > 0);

        if (!subs.some(s => s.id === window._vnlState.singleSub)) {
            window._vnlState.singleSub = subs[0].id;
            window._vnlState.page = 0;
        }
        const curSub = window._vnlState.singleSub;
        const list = assets[curSub] || [];
        const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
        const page = Math.min(window._vnlState.page, totalPages - 1);
        const slice = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        const isCover = (curSub === 'elves' || curSub === 'humans');

        return `
            ${topRow}
            <div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center;">
                ${subs.map(s => `<button data-custom-bg="1" class="vn-soft-btn ${curSub === s.id ? 'is-active' : ''}" style="padding:3px 9px !important; font-size:0.76rem !important;" onclick="VNL_SET_SINGLE_SUB('${s.id}')">${s.lbl}</button>`).join('')}
                <small style="color:var(--ui-muted,#888); margin-left:4px;">• без переключения эмоций</small>
            </div>
            ${noticeHTML}
            <div class="vnl-grid">
                ${slice.map(url => `
                    <div class="vnl-card ${isCover ? 'is-cover' : ''} ${curImg === url && !curInfo.hasEmotions ? 'is-picked' : ''}" onclick="VNL_PICK_SINGLE_PORTRAIT('${ESC_JS(url)}')">
                        <img src="${url}" loading="lazy" alt="Портрет">
                    </div>`).join('')}
            </div>
            ${BUILD_PAGER_HTML(page, totalPages)}`;
    }

    // --- ПОЛИРОВКА КАРТОЧКИ NPC И СЦЕНЫ НОВЕЛЛЫ (ОТКЛЮЧАЕМ ЭМОЦИИ У ОДИНОЧНЫХ ПОРТРЕТОВ) ---
    function CLEAN_DOSSIER_EMOTION_BUTTONS() {
        if (!window._vnUi || window._vnUi.editMode) return;
        const rc = CUR_ROOM();
        const npcs = (window._vnNpcsCache && rc && window._vnNpcsCache[rc]) ? window._vnNpcsCache[rc] : [];
        const npc = npcs.find(n => n.id === window._vnUi.selectedId);
        if (!npc) return;

        const mainCol = document.querySelector('#gm-tool-modal-content .vns-main');
        if (!mainCol) return;

        const info = GET_NPC_REAL_EMOTIONS(npc);
        const emoBtns = Array.from(mainCol.querySelectorAll('button[onclick*="window._vnUi.previewEmo="]'));
        if (!emoBtns.length) return;
        const emoRow = emoBtns[0].parentElement;
        const countSmall = emoRow ? emoRow.nextElementSibling : null;

        if (!info.hasEmotions) {
            if (emoRow) emoRow.style.display = 'none';
            if (countSmall) countSmall.textContent = npc.avatar ? '🖼️ Одиночный портрет (без эмоций)' : 'Портрет не выбран';
        } else {
            emoBtns.forEach(btn => {
                const m = (btn.getAttribute('onclick') || '').match(/previewEmo='([^']+)'/);
                if (m && !info.validIds.includes(m[1])) btn.style.display = 'none';
            });
            if (countSmall) countSmall.textContent = `🎭 Эмоций: ${info.uniqueCount}`;
        }
    }

    function CLEAN_STAGE_EMOTION_BUTTONS() {
        const rc = CUR_ROOM();
        const scene = (window._vnSceneCache && rc) ? window._vnSceneCache[rc] : null;
        if (!scene || !scene.active) return;

        const npcs = (window._vnNpcsCache && window._vnNpcsCache[rc]) ? window._vnNpcsCache[rc] : [];
        const activeSlotObj = (scene.activeSlot === 'right' && scene.rightSlot) ? scene.rightSlot : scene.leftSlot;
        const activeNpc = activeSlotObj ? npcs.find(n => n.id === activeSlotObj.npcId) : null;
        if (!activeNpc) return;

        const info = GET_NPC_REAL_EMOTIONS(activeNpc);
        const dock = document.getElementById('vn-dock-panel');
        if (!dock) return;

        const emoBtns = Array.from(dock.querySelectorAll('button[onclick^="VN_GM_SET_EMOTION("]'));
        if (!emoBtns.length) return;
        const emoWrap = emoBtns[0].parentElement;

        if (!info.hasEmotions) {
            // У одиночного портрета полностью убираем блок кнопок эмоций!
            if (emoWrap) emoWrap.style.display = 'none';
        } else {
            // У персонажа с эмоциями оставляем только те кнопки, для которых реально загружены спрайты
            emoBtns.forEach(btn => {
                const m = (btn.getAttribute('onclick') || '').match(/'([^']+)'/);
                if (m && !info.validIds.includes(m[1])) btn.style.display = 'none';
            });
        }
    }

    function INJECT_LIBRARY_INTO_STUDIO() {
        if (!window._vnUi || !window._vnUi.editMode || window._vnUi.editTab !== 'art') return;
        const mainCol = document.querySelector('#gm-tool-modal-content .vns-main');
        if (!mainCol || mainCol.querySelector('[data-vnl-mode-bar]')) return;

        const bodyDiv = mainCol.children[2];
        if (!bodyDiv) return;

        const mode = window._vnlState.mode || 'library';
        const bar = document.createElement('div');
        bar.setAttribute('data-vnl-mode-bar', '1');
        bar.style.cssText = 'display:flex; gap:6px; align-items:center; flex-wrap:wrap;';
        bar.innerHTML = `
            <button data-custom-bg="1" class="vn-soft-btn ${mode === 'library' ? 'is-active' : ''}" onclick="VNL_SET_MODE('library')">📚 Библиотека ассетов</button>
            <button data-custom-bg="1" class="vn-soft-btn ${mode === 'upload' ? 'is-active' : ''}" onclick="VNL_SET_MODE('upload')">📷 Свои картинки / URL</button>
        `;
        bodyDiv.before(bar);

        if (mode === 'library') {
            bodyDiv.innerHTML = BUILD_LIBRARY_HTML();
        }
    }

    const _ORIG_STUDIO = window.RENDER_NPC_STUDIO_MODAL;
    if (typeof _ORIG_STUDIO === 'function') {
        window.RENDER_NPC_STUDIO_MODAL = function() {
            _ORIG_STUDIO();
            INJECT_LIBRARY_INTO_STUDIO();
            CLEAN_DOSSIER_EMOTION_BUTTONS();
        };
    }

    const _ORIG_STAGE = window.RENDER_VN_STAGE_AND_DOCK;
    if (typeof _ORIG_STAGE === 'function') {
        window.RENDER_VN_STAGE_AND_DOCK = function() {
            _ORIG_STAGE();
            CLEAN_STAGE_EMOTION_BUTTONS();
        };
    }

    CLEAN_STAGE_EMOTION_BUTTONS();
})();