// ================================================================
// 📚 ГАЛЕРЕЯ И НАБОРЫ PNG-АССЕТОВ NPC (vn_portrait_maker.js)
// Работает с window.NPC_ASSETS (создаётся скриптом sort_npc_assets.ps1)
// Наборы с эмоциями в 1 клик • Эльфы • Люди • Портреты • Позы • Свои файлы
// ================================================================
(function INIT_VN_ASSET_LIBRARY() {
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
        cat: 'sets',            // 'sets' | 'avatars' | 'elves' | 'humans' | 'sprites'
        page: 0,
        targetSlot: 'neutral',  // В какую эмоцию ставить одиночный портрет
        selectedSetId: null,    // Выбранный набор эмоций для подробного просмотра
        notice: ''
    };

    const ESC = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const ESC_JS = s => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");

    function GET_ASSETS() {
        const raw = window.NPC_ASSETS || {};
        const arr = v => Array.isArray(v) ? v : (v ? [v] : []);
        return {
            sets:    arr(raw.sets),
            avatars: arr(raw.avatars),
            elves:   arr(raw.elves),
            humans:  arr(raw.humans),
            sprites: arr(raw.sprites)
        };
    }

    function ENSURE_LIB_CSS() {
        if (document.getElementById('vnl-gallery-css')) return;
        const st = document.createElement('style');
        st.id = 'vnl-gallery-css';
        st.textContent = `
            .vnl-grid {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
                gap: 8px;
                max-height: 310px;
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
                width: 100%; height: 92px; object-fit: contain;
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

    // --- ОБРАБОТЧИКИ (НА WINDOW) ---
    window.VNL_SET_MODE = function(mode) {
        window._vnlState.mode = mode;
        window._vnlState.notice = '';
        if (typeof window.RENDER_NPC_STUDIO_MODAL === 'function') window.RENDER_NPC_STUDIO_MODAL();
    };

    window.VNL_SET_CAT = function(cat) {
        window._vnlState.cat = cat;
        window._vnlState.page = 0;
        window._vnlState.selectedSetId = null;
        window._vnlState.notice = '';
        if (typeof window.RENDER_NPC_STUDIO_MODAL === 'function') window.RENDER_NPC_STUDIO_MODAL();
    };

    window.VNL_SET_PAGE = function(p) {
        window._vnlState.page = Math.max(0, p);
        if (typeof window.RENDER_NPC_STUDIO_MODAL === 'function') window.RENDER_NPC_STUDIO_MODAL();
    };

    window.VNL_SET_TARGET_SLOT = function(slot) {
        window._vnlState.targetSlot = slot;
        if (typeof window.RENDER_NPC_STUDIO_MODAL === 'function') window.RENDER_NPC_STUDIO_MODAL();
    };

    window.VNL_OPEN_SET = function(setId) {
        window._vnlState.selectedSetId = setId;
        window._vnlState.notice = '';
        if (typeof window.RENDER_NPC_STUDIO_MODAL === 'function') window.RENDER_NPC_STUDIO_MODAL();
    };

    window.VNL_APPLY_FULL_SET = function(setId) {
        const draft = window._vnUi && window._vnUi.draft;
        const set = GET_ASSETS().sets.find(s => s.id === setId);
        if (!draft || !set) return;

        draft.emotions = Object.assign({}, set.emotions || {});
        draft.avatar = draft.emotions.neutral || set.preview || (set.sprites && set.sprites[0]) || '';
        const cnt = Object.keys(draft.emotions).filter(k => draft.emotions[k]).length;
        window._vnlState.notice = `✅ Применён весь набор (${cnt} эмоций)! Нажмите «💾 Сохранить NPC» внизу.`;
        if (typeof window.RENDER_NPC_STUDIO_MODAL === 'function') window.RENDER_NPC_STUDIO_MODAL();
    };

    window.VNL_PICK_SINGLE_IMG = function(url) {
        const draft = window._vnUi && window._vnUi.draft;
        if (!draft || !url) return;
        const slot = window._vnlState.targetSlot || 'neutral';
        if (!draft.emotions) draft.emotions = {};

        if (slot === 'all') {
            draft.emotions = { neutral: url };
            draft.avatar = url;
            window._vnlState.notice = '✅ Установлен как основной портрет NPC.';
        } else {
            draft.emotions[slot] = url;
            if (slot === 'neutral' || !draft.avatar) draft.avatar = url;
            const lbl = (EMOTIONS.find(e => e.id === slot) || EMOTIONS[0]).label;
            window._vnlState.notice = `✅ Картинка назначена на эмоцию «${lbl}».`;
        }
        if (typeof window.RENDER_NPC_STUDIO_MODAL === 'function') window.RENDER_NPC_STUDIO_MODAL();
    };

    window.VNL_PICK_RANDOM = function() {
        const assets = GET_ASSETS();
        const cat = window._vnlState.cat || 'sets';
        if (cat === 'sets' && assets.sets.length) {
            const rnd = assets.sets[Math.floor(Math.random() * assets.sets.length)];
            window._vnlState.selectedSetId = rnd.id;
            window.VNL_APPLY_FULL_SET(rnd.id);
            return;
        }
        const arr = assets[cat] || [];
        if (!arr.length) return;
        const url = arr[Math.floor(Math.random() * arr.length)];
        window.VNL_PICK_SINGLE_IMG(url);
    };

    // --- ОТРИСОВКА БИБЛИОТЕКИ ---
    function BUILD_LIBRARY_HTML() {
        ENSURE_LIB_CSS();
        const draft = window._vnUi && window._vnUi.draft;
        const assets = GET_ASSETS();
        const total = assets.sets.length + assets.avatars.length + assets.elves.length + assets.humans.length + assets.sprites.length;

        if (total === 0) {
            return `
                <div style="background:var(--ui-panel,#221f1c); border:1px dashed var(--ui-accent,#d2b278); border-radius:10px; padding:18px; text-align:center;">
                    <div style="font-size:1.5rem; margin-bottom:6px;">📂</div>
                    <b style="color:var(--ui-accent,#d2b278);">Библиотека ассетов ещё не подключена</b>
                    <p style="font-size:0.85rem; color:var(--ui-muted,#aaa); margin:8px 0 0 0; line-height:1.45;">
                        Запустите скрипт <code>sort_npc_assets.ps1</code> в папке сайта и подключите созданный файл <code>npc_assets.js</code> в <code>index.html</code> — здесь сразу появятся все ваши портреты и наборы эмоций.
                    </p>
                </div>`;
        }

        // Если выбранная категория пуста, переключаемся на первую непустую
        const cats = [
            { id: 'sets',    lbl: `🎭 С эмоциями (${assets.sets.length})`,   cnt: assets.sets.length },
            { id: 'avatars', lbl: `🖼️ Портреты (${assets.avatars.length})`,  cnt: assets.avatars.length },
            { id: 'elves',   lbl: `🧝 Эльфы (${assets.elves.length})`,       cnt: assets.elves.length },
            { id: 'humans',  lbl: `👤 Люди (${assets.humans.length})`,       cnt: assets.humans.length },
            { id: 'sprites', lbl: `🧍 Позы (${assets.sprites.length})`,      cnt: assets.sprites.length }
        ].filter(c => c.cnt > 0);

        if (!cats.some(c => c.id === window._vnlState.cat)) {
            window._vnlState.cat = cats[0].id;
            window._vnlState.page = 0;
        }

        const curCat = window._vnlState.cat;
        const curSlot = window._vnlState.targetSlot || 'neutral';
        const curSlotImg = (draft?.emotions && draft.emotions[curSlot === 'all' ? 'neutral' : curSlot]) || draft?.avatar || '';

        // Полоска категорий + кнопка случайного выбора
        const catBar = `
            <div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center; justify-content:space-between;">
                <div style="display:flex; gap:5px; flex-wrap:wrap;">
                    ${cats.map(c => `<button data-custom-bg="1" class="vn-soft-btn ${curCat === c.id ? 'is-active' : ''}" style="padding:4px 9px !important; font-size:0.78rem !important;" onclick="VNL_SET_CAT('${c.id}')">${c.lbl}</button>`).join('')}
                </div>
                <button data-custom-bg="1" class="vn-soft-btn" style="padding:4px 9px !important; font-size:0.78rem !important; border-color:var(--ui-accent,#d2b278) !important;" onclick="VNL_PICK_RANDOM()">🎲 Случайный</button>
            </div>`;

        // Полоска выбора целевой эмоции + текущее превью
        const slotBar = `
            <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; background:var(--ui-panel,#221f1c); border:1px solid var(--ui-border,#3e372f); border-radius:9px; padding:8px 10px;">
                <div style="width:52px; height:52px; border-radius:8px; background:var(--ui-panel2,#161412); border:1px solid var(--ui-border-strong,#695c4c); display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0;">
                    ${curSlotImg ? `<img src="${curSlotImg}" style="width:100%; height:100%; object-fit:contain;">` : '<span style="opacity:0.45;">🎭</span>'}
                </div>
                <div style="flex:1; min-width:200px;">
                    <div style="font-size:0.75rem; color:var(--ui-muted,#aaa); margin-bottom:4px;">На какую эмоцию назначать выбранную картинку:</div>
                    <div style="display:flex; gap:4px; flex-wrap:wrap;">
                        <button data-custom-bg="1" class="vn-soft-btn ${curSlot === 'all' ? 'is-active' : ''}" style="padding:2px 7px !important; font-size:0.74rem !important;" onclick="VNL_SET_TARGET_SLOT('all')">Основной (для всех)</button>
                        ${EMOTIONS.map(em => {
                            const has = !!(draft?.emotions && draft.emotions[em.id]);
                            return `<button data-custom-bg="1" class="vn-soft-btn ${curSlot === em.id ? 'is-active' : ''}" style="padding:2px 7px !important; font-size:0.74rem !important; ${has && curSlot !== em.id ? 'border-color:#588a62 !important;' : ''}" title="${em.label}" onclick="VNL_SET_TARGET_SLOT('${em.id}')">${em.icon} ${em.label}</button>`;
                        }).join('')}
                    </div>
                </div>
            </div>`;

        const noticeHTML = window._vnlState.notice
            ? `<div style="font-size:0.82rem; color:#86efac; background:rgba(63,110,73,0.18); border:1px solid #4d7c58; border-radius:7px; padding:6px 10px;">${ESC(window._vnlState.notice)}</div>`
            : '';

        // 1. Вкладка «Наборы с эмоциями»
        if (curCat === 'sets') {
            const selSet = window._vnlState.selectedSetId ? assets.sets.find(s => s.id === window._vnlState.selectedSetId) : null;
            if (selSet) {
                const sprites = Array.isArray(selSet.sprites) ? selSet.sprites : [];
                return `
                    ${catBar}
                    ${slotBar}
                    ${noticeHTML}
                    <div style="background:var(--ui-panel,#221f1c); border:1px solid var(--ui-accent,#d2b278); border-radius:9px; padding:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:9px;">
                            <div style="display:flex; align-items:center; gap:8px;">
                                <button data-custom-bg="1" class="vn-soft-btn" onclick="VNL_OPEN_SET(null)">⬅️ Все наборы</button>
                                <b style="color:var(--ui-accent,#d2b278); font-size:0.9rem;">${ESC(selSet.label)} (${sprites.length} шт.)</b>
                            </div>
                            <button class="btn-save" style="padding:6px 12px; font-size:0.84rem;" onclick="VNL_APPLY_FULL_SET('${ESC_JS(selSet.id)}')">✨ Применить все эмоции сразу</button>
                        </div>
                        <div style="font-size:0.78rem; color:var(--ui-muted,#aaa); margin-bottom:6px;">Или кликните по отдельному спрайту, чтобы поставить его на выбранную выше эмоцию:</div>
                        <div class="vnl-grid">
                            ${sprites.map(u => `
                                <div class="vnl-card ${curSlotImg === u ? 'is-picked' : ''}" onclick="VNL_PICK_SINGLE_IMG('${ESC_JS(u)}')">
                                    <img src="${u}" loading="lazy" alt="Спрайт">
                                </div>`).join('')}
                        </div>
                    </div>`;
            }

            const totalPages = Math.max(1, Math.ceil(assets.sets.length / PAGE_SIZE));
            const page = Math.min(window._vnlState.page, totalPages - 1);
            const slice = assets.sets.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

            return `
                ${catBar}
                ${noticeHTML}
                <div style="font-size:0.78rem; color:var(--ui-muted,#aaa);">Нажмите на персонажа, чтобы посмотреть все его эмоции или применить набор целиком:</div>
                <div class="vnl-grid">
                    ${slice.map(s => `
                        <div class="vnl-card" onclick="VNL_OPEN_SET('${ESC_JS(s.id)}')">
                            <span class="vnl-badge">${(s.sprites || []).length} поз</span>
                            <img src="${s.preview}" loading="lazy" alt="${ESC(s.label)}">
                            <div style="font-size:0.7rem; color:var(--ui-muted,#ccc); width:100%; text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ESC(s.label)}</div>
                        </div>`).join('')}
                </div>
                ${BUILD_PAGER_HTML(page, totalPages)}`;
        }

        // 2. Вкладки одиночных картинок (Эльфы, Люди, Портреты, Позы)
        const list = assets[curCat] || [];
        const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
        const page = Math.min(window._vnlState.page, totalPages - 1);
        const slice = list.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
        const isCover = (curCat === 'elves' || curCat === 'humans');

        return `
            ${catBar}
            ${slotBar}
            ${noticeHTML}
            <div class="vnl-grid">
                ${slice.map(url => `
                    <div class="vnl-card ${isCover ? 'is-cover' : ''} ${curSlotImg === url ? 'is-picked' : ''}" onclick="VNL_PICK_SINGLE_IMG('${ESC_JS(url)}')">
                        <img src="${url}" loading="lazy" alt="Портрет">
                    </div>`).join('')}
            </div>
            ${BUILD_PAGER_HTML(page, totalPages)}`;
    }

    function BUILD_PAGER_HTML(page, totalPages) {
        if (totalPages <= 1) return '';
        return `
            <div style="display:flex; justify-content:center; align-items:center; gap:8px; padding-top:4px;">
                <button data-custom-bg="1" class="vn-soft-btn" ${page <= 0 ? 'disabled style="opacity:0.4;"' : ''} onclick="VNL_SET_PAGE(${page - 1})">◀ Назад</button>
                <span style="font-size:0.8rem; color:var(--ui-muted,#aaa);">Страница <b>${page + 1}</b> из ${totalPages}</span>
                <button data-custom-bg="1" class="vn-soft-btn" ${page >= totalPages - 1 ? 'disabled style="opacity:0.4;"' : ''} onclick="VNL_SET_PAGE(${page + 1})">Вперёд ▶</button>
            </div>`;
    }

    // --- ВСТРАИВАНИЕ ВО ВКЛАДКУ «🎨 ВНЕШНОСТЬ И ЭМОЦИИ» ---
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
        };
    }
})();