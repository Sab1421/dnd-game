// ================================================================
// 🎨 ЭТАП 1: УДОБНЫЙ 2-КОЛОНОЧНЫЙ ИНТЕРФЕЙС + УЛУЧШЕННЫЙ HD-РЕНДЕР
// ================================================================
window._mbSideTab = window._mbSideTab || 'tiles'; // 'tiles' | 'stamps'
window._mbBrokenTileKeys = window._mbBrokenTileKeys || {};

// Автопроверка всех полов: удалённые файлы (вроде кирпича) сами скрываются из меню и генератора
function MB_PRELOAD_ALL_TILES() {
    const tiles = GET_MB_TILES();
    for (const [key, cfg] of Object.entries(tiles)) {
        if (!cfg || !cfg.img) continue;
        if (window._mbImgCache[cfg.img]) {
            if (window._mbImgCache[cfg.img].status === 'error') window._mbBrokenTileKeys[key] = true;
            continue;
        }
        const img = new Image();
        window._mbImgCache[cfg.img] = { status: 'loading', img };
        img.onload = function() {
            window._mbImgCache[cfg.img].status = 'ok';
            for (const k of Object.keys(window._mbPatternCache)) {
                if (k.includes(cfg.img)) delete window._mbPatternCache[k];
            }
            if (document.getElementById('mb-editor-canvas') && !window._mbRedrawTimer) {
                window._mbRedrawTimer = setTimeout(() => { window._mbRedrawTimer = null; DRAW_MB_CANVAS(); }, 40);
            }
        };
        img.onerror = function() {
            window._mbImgCache[cfg.img].status = 'error';
            window._mbBrokenTileKeys[key] = true;
            const btn = document.querySelector(`[data-mb-tile-key="${key}"]`);
            if (btn) btn.style.display = 'none';
        };
        img.src = cfg.img;
    }
}

// Генератор больше никогда не выберет удалённый файл текстуры
MB_PICK_TILE_FAMILY = function(prefix, fallback = 'grass') {
    const tiles = GET_MB_TILES();
    const rx = new RegExp(`^${prefix}(_\\d+)?$`);
    const isOk = (k) => {
        if (!tiles[k] || window._mbBrokenTileKeys[k]) return false;
        const src = tiles[k].img;
        if (src && window._mbImgCache[src] && window._mbImgCache[src].status === 'error') return false;
        return true;
    };
    const keys = Object.keys(tiles).filter(k => rx.test(k) && isOk(k));
    if (keys.length) return MB_PICK(keys);
    if (isOk(fallback)) return fallback;
    const anyValid = Object.keys(tiles).find(k => isOk(k));
    return anyValid || 'grass';
};

// Масштаб и цветокоррекция текстур пола (убираем гигантские кирпичи и сглаживаем фото-контраст под D&D-спрайты)
MB_GET_TILE_PATTERN = function(ctx, tileKey, tileImg, src, cellPx) {
    const cacheKey = `v5_${tileKey}_${src}_${Math.round(cellPx)}`;
    if (window._mbPatternCache[cacheKey]) return window._mbPatternCache[cacheKey];

    let repeatCells = 2.6;
    if (/^wall/.test(tileKey)) repeatCells = 1.65;
    else if (/^(wood|flagstone|cobble|stone|floor|marble)/.test(tileKey)) repeatCells = 2.15;
    else if (/^(water|lava)/.test(tileKey)) repeatCells = 2.8;
    else repeatCells = 2.85;

    const targetPx = Math.max(76, Math.min(240, Math.round(cellPx * repeatCells)));
    const off = document.createElement('canvas');
    off.width = targetPx;
    off.height = targetPx;
    const octx = off.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';

    // Гармонизация фото-текстур под стиль рисованных спрайтов
    if (/^wall/.test(tileKey)) {
        octx.filter = 'saturate(0.68) contrast(0.95) brightness(0.70)';
    } else if (/^(water|lava)/.test(tileKey)) {
        octx.filter = 'saturate(0.92) contrast(0.94) brightness(0.95)';
    } else if (/^(snow|ice)/.test(tileKey)) {
        octx.filter = 'saturate(0.82) contrast(0.88) brightness(0.93)';
    } else {
        octx.filter = 'saturate(0.76) contrast(0.88) brightness(0.91)';
    }

    octx.drawImage(tileImg, 0, 0, targetPx, targetPx);
    octx.filter = 'none';

    const pat = ctx.createPattern(off, 'repeat');
    window._mbPatternCache[cacheKey] = pat;
    return pat;
};

MB_SELECT_TILE = function(tileKey) {
    window._mbSelectedTile = tileKey;
    window._mbSideTab = 'tiles';
    if (window._mbTool !== 'tile' && window._mbTool !== 'brush3') window._mbTool = 'tile';
    RENDER_GM_MAP_BUILDER_UI();
};

MB_SELECT_STAMP = function(stampId) {
    window._mbSelectedStamp = stampId;
    window._mbTool = 'stamp';
    window._mbSideTab = 'stamps';
    const stObj = MB_FIND_STAMP_OBJ(stampId);
    if (stObj && stObj.img) MB_GET_LOADED_IMG(stObj.img);
    RENDER_GM_MAP_BUILDER_UI();
};

OPEN_GM_MAP_BUILDER = function() {
    window._mbUniqueStampsCache = null;
    window._mbPatternCache = {};
    MB_PRELOAD_ALL_TILES();
    window._mbData = GET_MB_DATA();
    const uniqueStamps = GET_UNIQUE_MB_STAMPS();
    if (!window._mbSelectedStamp && uniqueStamps.length) {
        window._mbSelectedStamp = uniqueStamps[0].id;
    }
    const cont = document.getElementById('gm-tool-modal-content');
    cont.style.maxWidth = '96vw';
    cont.style.width = '1560px';
    cont.style.padding = '12px 16px';
    RENDER_GM_MAP_BUILDER_UI();
    OM('gm-tool-modal');
};

// Крупные и наглядные карточки объектов (3 в ряд)
MB_BUILD_STAMP_BUTTONS_HTML = function() {
    const stamps = GET_UNIQUE_MB_STAMPS();
    const curCat = window._mbStampCat || 'nature';
    const q = (window._mbStampSearch || '').toLowerCase().trim();
    const filtered = stamps.filter(st => {
        const stCat = st.cat || 'other';
        const catOk = (curCat === 'all') || (stCat === curCat);
        const qOk = !q || (st.label || '').toLowerCase().includes(q) || (st.id || '').toLowerCase().includes(q);
        return catOk && qOk;
    });

    if (!filtered.length) return '<div style="grid-column:1/-1; color:#777; font-size:0.82rem; padding:14px; text-align:center;">Ничего не найдено</div>';

    let html = filtered.slice(0, 150).map(st => {
        const isSel = (window._mbTool === 'stamp' && window._mbSelectedStamp === st.id);
        const previewHTML = st.img
            ? `<img src="${st.img}" loading="lazy" onerror="this.closest('button').style.display='none';" style="width:44px; height:44px; object-fit:contain; filter:drop-shadow(0 2px 3px rgba(0,0,0,0.8));">`
            : `<span style="font-size:1.4rem;">${st.icon}</span>`;
        return `
            <button title="${st.label}" onclick="MB_SELECT_STAMP('${st.id}')"
                style="background:${isSel ? '#3a301e' : '#191816'}; color:${isSel ? '#f6d899' : '#d6d2c9'}; border:2px solid ${isSel ? '#c9a96e' : '#2f2b25'}; border-radius:8px; padding:5px 4px; display:flex; flex-direction:column; align-items:center; justify-content:space-between; gap:3px; min-height:74px; cursor:pointer; box-shadow:none;">
                ${previewHTML}
                <span style="font-size:0.68rem; font-weight:normal; line-height:1.1; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${st.label}</span>
            </button>`;
    }).join('');

    if (filtered.length > 150) {
        html += `<div style="grid-column:1/-1; color:#999; font-size:0.74rem; padding:6px; text-align:center;">Показано 150 из ${filtered.length} — введите слово в поиск.</div>`;
    }
    return html;
};

// Новый просторный 2-колоночный интерфейс Студии Карт
RENDER_GM_MAP_BUILDER_UI = function() {
    const cont = document.getElementById('gm-tool-modal-content');
    if (!cont) return;
    cont.style.maxWidth = '96vw';
    cont.style.width = '1560px';

    const data = window._mbData || GET_MB_DATA();
    const cols = data.cols, rows = data.rows;
    window._mbCols = cols;
    window._mbRows = rows;

    const tiles = GET_MB_TILES();
    const stamps = GET_UNIQUE_MB_STAMPS();
    const cellPx = Math.max(38, Math.min(68, Math.floor(1680 / Math.max(cols, rows * 1.45))));
    const canvasW = cols * cellPx;
    const canvasH = rows * cellPx;

    const curSide = window._mbSideTab || 'tiles';

    // Крупные визуальные карточки для полов (3 в ряд)
    const TILE_CATS = [
        { id: 'all',    label: 'Все' },
        { id: 'nature', label: '🌿 Природа' },
        { id: 'stone',  label: '🪨 Камень' },
        { id: 'wood',   label: '🪵 Дерево' },
        { id: 'liquid', label: '🌊 Вода/Лава' },
        { id: 'wall',   label: '🧱 Стены' }
    ];
    const curTileCat = window._mbTileCat || 'all';
    const tileCatHTML = TILE_CATS.map(tc => {
        const act = curTileCat === tc.id;
        return `<button class="btn-small" style="padding:3px 7px; font-size:0.72rem; background:${act ? '#c9a96e' : '#22201d'}; color:${act ? '#141210' : '#ccc'};" onclick="window._mbTileCat='${tc.id}'; RENDER_GM_MAP_BUILDER_UI();">${tc.label}</button>`;
    }).join('');

    let tileCardsHTML = '';
    for (const [key, cfg] of Object.entries(tiles)) {
        if (window._mbBrokenTileKeys[key]) continue;
        if (curTileCat !== 'all' && MB_TILE_GROUP(key) !== curTileCat) continue;
        const isSel = (window._mbTool === 'tile' || window._mbTool === 'brush3') && window._mbSelectedTile === key;
        const preview = cfg.img
            ? `<img src="${cfg.img}" loading="lazy" onerror="window._mbBrokenTileKeys['${key}']=true; this.closest('button').style.display='none';" style="width:100%; height:44px; object-fit:cover; border-radius:5px; display:block;">`
            : `<div style="width:100%; height:44px; background:${cfg.bg}; border-radius:5px;"></div>`;

        tileCardsHTML += `
            <button data-mb-tile-key="${key}" title="${cfg.name}" onclick="MB_SELECT_TILE('${key}')"
                style="background:${isSel ? '#3a301e' : '#191816'}; color:${isSel ? '#f6d899' : '#d6d2c9'}; border:2px solid ${isSel ? '#c9a96e' : '#2f2b25'}; border-radius:8px; padding:4px; display:flex; flex-direction:column; align-items:center; gap:3px; cursor:pointer; box-shadow:none;">
                ${preview}
                <span style="font-size:0.7rem; font-weight:normal; line-height:1.1; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${cfg.name}</span>
            </button>`;
    }

    const STAMP_CATS = [
        { id: 'all',       label: 'Все' },
        { id: 'nature',    label: '🌲 Природа' },
        { id: 'city',      label: '🏠 Город' },
        { id: 'furniture', label: '🪑 Мебель' },
        { id: 'dungeon',   label: '🏰 Данж' },
        { id: 'camp',      label: '⛺ Лагерь' },
        { id: 'effects',   label: '✨ Магия' },
        { id: 'other',     label: '🔹 Прочее' }
    ];
    const curCat = window._mbStampCat || 'nature';
    const stampCatHTML = STAMP_CATS.map(c => {
        const cnt = c.id === 'all' ? stamps.length : stamps.filter(s => (s.cat || 'other') === c.id).length;
        if (c.id !== 'all' && cnt === 0) return '';
        const act = curCat === c.id;
        return `<button class="btn-small" style="padding:3px 7px; font-size:0.71rem; background:${act ? '#c9a96e' : '#22201d'}; color:${act ? '#141210' : '#ccc'};" onclick="window._mbStampCat='${c.id}'; RENDER_GM_MAP_BUILDER_UI();">${c.label}</button>`;
    }).join('');

    const lightOpts = Object.entries(MB_LIGHTING_MODES).map(([k, m]) =>
        `<option value="${k}" ${window._mbLighting === k ? 'selected' : ''}>${m.label}</option>`
    ).join('');

    const sizeBtns = MB_SIZE_PRESETS.map(p => {
        const isAct = (cols === p.cols && rows === p.rows);
        return `<button class="btn-small" style="padding:3px 7px; font-size:0.73rem; background:${isAct ? '#c9a96e' : '#22201d'}; color:${isAct ? '#141210' : '#ddd'};" onclick="MB_RESIZE_GRID(${p.cols}, ${p.rows})">${p.cols}×${p.rows}</button>`;
    }).join('');

    const toolBtn = (mode, label, targetTab) => `
        <button class="btn-small" onclick="window._mbTool='${mode}'; ${targetTab ? `window._mbSideTab='${targetTab}';` : ''} RENDER_GM_MAP_BUILDER_UI();"
            style="flex:1; padding:6px 4px; font-size:0.75rem; background:${window._mbTool===mode ? '#7c3aed' : '#22201d'}; color:#fff; border:1px solid ${window._mbTool===mode ? '#e9d5ff' : '#423c33'};">
            ${label}
        </button>`;

    const curTitleVal = document.getElementById('mb-map-title-inp')?.value ?? (GET_MAP_STATE().title || 'Новая локация');

    const sidebarBodyHTML = (curSide === 'tiles') ? `
        <div style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:6px;">${tileCatHTML}</div>
        <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; overflow-y:auto; padding:4px; background:#11100f; border-radius:8px; border:1px solid #2e2a24; flex:1; align-content:start;">
            ${tileCardsHTML}
        </div>
    ` : `
        <div style="display:flex; flex-direction:column; gap:6px; margin-bottom:6px; background:#141311; padding:7px; border-radius:7px; border:1px solid #2f2b25; font-size:0.76rem;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:6px;">
                <span>🔍 Масштаб: <b id="mb-scale-lbl">${window._mbStampScale.toFixed(1)}×</b></span>
                <input type="range" min="0.5" max="3.0" step="0.1" value="${window._mbStampScale}" oninput="window._mbStampScale=parseFloat(this.value); document.getElementById('mb-scale-lbl').textContent=this.value+'×'; DRAW_MB_CANVAS();" style="width:120px;">
                <button class="btn-small" style="padding:2px 7px; font-size:0.73rem;" title="Клавиша R" onclick="window._mbStampRot=(window._mbStampRot+45)%360; document.getElementById('mb-rot-lbl').textContent=window._mbStampRot+'°'; DRAW_MB_CANVAS();">
                    🔄 <span id="mb-rot-lbl">${window._mbStampRot}°</span>
                </button>
            </div>
            <div style="display:flex; gap:12px; color:#ccc;">
                <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" ${window._mbRandRot ? 'checked' : ''} onchange="window._mbRandRot=this.checked;"> 🎲 Случ. поворот</label>
                <label style="display:flex; align-items:center; gap:4px; cursor:pointer;"><input type="checkbox" ${window._mbSnapGrid ? 'checked' : ''} onchange="window._mbSnapGrid=this.checked;"> 🧲 По сетке</label>
            </div>
        </div>
        <div style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:5px;">${stampCatHTML}</div>
        <input type="text" id="mb-stamp-search-inp" value="${(window._mbStampSearch || '').replace(/"/g, '&quot;')}"
               placeholder="🔍 Поиск объекта по названию..."
               oninput="window._mbStampSearch=this.value; MB_RENDER_STAMP_GRID_ONLY();"
               style="width:100%; padding:5px 8px; font-size:0.78rem; text-align:left; margin-bottom:6px;">
        <div id="mb-stamps-grid-wrap" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; overflow-y:auto; padding:4px; background:#11100f; border-radius:8px; border:1px solid #2e2a24; flex:1; align-content:start;">
            ${MB_BUILD_STAMP_BUTTONS_HTML()}
        </div>
    `;

    cont.innerHTML = `
        <!-- ВЕРХНЯЯ ПАНЕЛЬ (1 КОМПАКТНАЯ СТРОКА) -->
        <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; flex-wrap:wrap; background:#181715; border:1px solid #423c33; border-radius:10px; padding:7px 10px; margin-bottom:9px;">
            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <b style="color:#e6c88c; font-size:0.96rem;">🎨 Студия Карт</b>
                <div style="display:flex; gap:3px; align-items:center;">${sizeBtns}</div>
                <div style="display:flex; align-items:center; gap:3px;">
                    <input type="number" id="mb-cols-inp" min="8" max="50" value="${cols}" style="width:44px; padding:2px 3px; font-size:0.76rem;">
                    <span style="font-size:0.78rem;">×</span>
                    <input type="number" id="mb-rows-inp" min="6" max="40" value="${rows}" style="width:44px; padding:2px 3px; font-size:0.76rem;">
                    <button class="btn-small btn-save" style="padding:2px 6px; font-size:0.72rem;" onclick="MB_RESIZE_GRID(document.getElementById('mb-cols-inp').value, document.getElementById('mb-rows-inp').value)">Ок</button>
                </div>
            </div>

            <div style="display:flex; align-items:center; gap:6px; flex:1; min-width:260px; max-width:440px;">
                <select id="mb-rand-biome" onchange="window._mbRandBiome=this.value;" style="flex:1; padding:4px 7px; font-size:0.79rem; text-align:left; border-color:#7c3aed;">
                    <option value="random" ${window._mbRandBiome==='random'?'selected':''}>🎲 Любая случайная локация</option>
                    <option value="tavern" ${window._mbRandBiome==='tavern'?'selected':''}>🍺 Таверна / Постоялый двор</option>
                    <option value="city" ${window._mbRandBiome==='city'?'selected':''}>👑 Город / Столица / Квартал</option>
                    <option value="battlefield" ${window._mbRandBiome==='battlefield'?'selected':''}>⚔️ Поле битвы / Осада</option>
                    <option value="forest" ${window._mbRandBiome==='forest'?'selected':''}>🌲 Дикий лес / Река / Руины</option>
                    <option value="dungeon" ${window._mbRandBiome==='dungeon'?'selected':''}>🏰 Подземелье / Склеп</option>
                    <option value="mansion" ${window._mbRandBiome==='mansion'?'selected':''}>🏛️ Богатый особняк</option>
                    <option value="dwarven" ${window._mbRandBiome==='dwarven'?'selected':''}>⚒️ Кузница дварфов</option>
                    <option value="pirate" ${window._mbRandBiome==='pirate'?'selected':''}>🏴‍☠️ Пиратская бухта</option>
                    <option value="desert" ${window._mbRandBiome==='desert'?'selected':''}>🏜️ Пустынный оазис</option>
                    <option value="fey" ${window._mbRandBiome==='fey'?'selected':''}>🍄 Фейский лес</option>
                    <option value="eastern" ${window._mbRandBiome==='eastern'?'selected':''}>⛩️ Восточный храм / Додзё</option>
                    <option value="warcamp" ${window._mbRandBiome==='warcamp'?'selected':''}>⛺ Лагерь охотников / орков</option>
                    <option value="snow" ${window._mbRandBiome==='snow'?'selected':''}>❄️ Снежный перевал</option>
                </select>
                <button class="btn-small" style="background:linear-gradient(180deg,#8b5cf6 0%,#5b21b6 100%); color:#fff; border-color:#c084fc; padding:5px 12px; font-size:0.8rem; white-space:nowrap;" onclick="MB_GENERATE_RANDOM(document.getElementById('mb-rand-biome').value)">
                    🎲 Собрать!
                </button>
            </div>

            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                <select id="mb-lighting-sel" onchange="window._mbLighting=this.value; if(window._mbData){window._mbData.lighting=this.value; SAVE_MB_DATA(window._mbData);} DRAW_MB_CANVAS();" style="width:155px; padding:4px 6px; font-size:0.78rem; text-align:left;">
                    ${lightOpts}
                </select>
                <label style="display:flex; align-items:center; gap:3px; cursor:pointer; font-size:0.74rem; color:#ccc;"><input type="checkbox" ${window._mbShowGrid ? 'checked' : ''} onchange="window._mbShowGrid=this.checked; DRAW_MB_CANVAS();"> Сетка</label>
                <label style="display:flex; align-items:center; gap:3px; cursor:pointer; font-size:0.74rem; color:#ccc;"><input type="checkbox" ${window._mbPostFx ? 'checked' : ''} onchange="window._mbPostFx=this.checked; DRAW_MB_CANVAS();"> ✨ Свет</label>
                <button class="btn-small" title="Отменить (Ctrl+Z)" style="padding:4px 7px; font-size:0.75rem;" onclick="MB_UNDO()" ${!window._mbUndoStack.length ? 'disabled' : ''}>↩️</button>
                <button class="btn-small btn-danger" title="Убрать все объекты" style="padding:4px 7px; font-size:0.75rem;" onclick="MB_CLEAR_OBJECTS()">🧹</button>
                <button class="btn-small btn-danger" title="Залить всю карту текущим полом" style="padding:4px 7px; font-size:0.75rem;" onclick="MB_FILL_ALL(window._mbSelectedTile || 'grass')">🗑️</button>
            </div>
        </div>

        <!-- РАБОЧАЯ ОБЛАСТЬ В 2 КОЛОНКИ: СЛЕВА ПАНЕЛЬ, СПРАВА ОГРОМНЫЙ ХОЛСТ -->
        <div style="display:grid; grid-template-columns: 330px 1fr; gap:10px; height:67vh; min-height:470px;">
            <!-- ЛЕВАЯ КОЛОНКА -->
            <div style="background:#181715; border:1px solid #423c33; border-radius:10px; padding:8px; display:flex; flex-direction:column; min-height:0;">
                <div style="display:flex; gap:4px; margin-bottom:7px;">
                    ${toolBtn('tile', '🖌️ 1×1', 'tiles')}
                    ${toolBtn('brush3', '⬛ 3×3', 'tiles')}
                    ${toolBtn('stamp', '🌲 Объект', 'stamps')}
                    ${toolBtn('eraser', '🧽 Ластик', '')}
                </div>
                <div style="display:flex; gap:5px; margin-bottom:7px;">
                    <button class="btn-small" style="flex:1; padding:6px; font-size:0.8rem; background:${curSide==='tiles' ? '#c9a96e' : '#24211d'}; color:${curSide==='tiles' ? '#141210' : '#ccc'};" onclick="window._mbSideTab='tiles'; RENDER_GM_MAP_BUILDER_UI();">🧱 Полы / Земля</button>
                    <button class="btn-small" style="flex:1; padding:6px; font-size:0.8rem; background:${curSide==='stamps' ? '#c9a96e' : '#24211d'}; color:${curSide==='stamps' ? '#141210' : '#ccc'};" onclick="window._mbSideTab='stamps'; RENDER_GM_MAP_BUILDER_UI();">🌲 Объекты (${stamps.length})</button>
                </div>
                ${sidebarBodyHTML}
            </div>

            <!-- ПРАВАЯ КОЛОНКА: ХОЛСТ ВО ВСЮ ВЫСОТУ -->
            <div style="background:#0c0b0a; border:2px solid #524a3d; border-radius:10px; padding:8px; display:flex; align-items:center; justify-content:center; min-height:0; min-width:0; overflow:hidden;">
                <canvas id="mb-editor-canvas" width="${canvasW}" height="${canvasH}"
                    style="cursor:crosshair; border-radius:5px; max-width:100%; max-height:100%; width:auto; height:auto; aspect-ratio:${canvasW} / ${canvasH}; display:block; box-shadow:0 10px 36px rgba(0,0,0,0.95);">
                </canvas>
            </div>
        </div>

        <!-- НИЖНЯЯ СТРОКА -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:9px; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:220px;">
                <span style="color:#c9a96e; white-space:nowrap; font-size:0.9rem;">📍 Локация:</span>
                <input type="text" id="mb-map-title-inp" value="${curTitleVal.replace(/"/g, '&quot;')}" style="flex:1; text-align:left; padding:6px 10px; font-size:0.9rem;">
            </div>
            <small style="color:#9e988e; font-size:0.78rem !important;">💡 ЛКМ — ставить/рисовать • ПКМ — удалить объект • R — поворот • Ctrl+Z — отмена</small>
            <div style="display:flex; gap:8px;">
                <button class="btn-save" style="padding:8px 18px; font-size:0.94rem;" onclick="MB_APPLY_TO_GAME_MAP()">
                    ✅ Выложить карту игрокам!
                </button>
                <button style="padding:8px 14px; font-size:0.92rem;" onclick="CM('gm-tool-modal')">Закрыть</button>
            </div>
        </div>
    `;

    INIT_MB_CANVAS_EVENTS();
    DRAW_MB_CANVAS();
};

// Прокачанный рендер V5: мягкая пена у воды, объёмные тёмные стены, цельная атмосфера
DRAW_MB_CANVAS = function(isExport = false) {
    const canvas = document.getElementById('mb-editor-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    const data = window._mbData || GET_MB_DATA();
    const tiles = GET_MB_TILES();
    const cols = data.cols, rows = data.rows;
    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;
    const lightCfg = MB_LIGHTING_MODES[data.lighting || window._mbLighting || 'day'] || MB_LIGHTING_MODES.day;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const counts = {};
    for (const cell of data.cells) counts[cell.t] = (counts[cell.t] || 0) + 1;
    let baseTileKey = 'grass', maxC = -1;
    for (const [k, v] of Object.entries(counts)) {
        if (!/^wall/.test(k) && v > maxC) { maxC = v; baseTileKey = k; }
    }

    const fillStyleForTile = (targetCtx, tileKey) => {
        const cfg = tiles[tileKey] || tiles.grass || { bg: '#34592e' };
        const img = (cfg.img && !window._mbBrokenTileKeys[tileKey]) ? MB_GET_LOADED_IMG(cfg.img) : null;
        if (img) return MB_GET_TILE_PATTERN(targetCtx, tileKey, img, cfg.img, cellW);
        return MB_BUILD_PROCEDURAL_PATTERN(targetCtx, tileKey, cfg, cellW);
    };

    // СЛОЙ 1: Базовый фон
    ctx.fillStyle = fillStyleForTile(ctx, baseTileKey);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // СЛОЙ 2: Все остальные покрытия
    if (!window._mbLayerCanvas) window._mbLayerCanvas = document.createElement('canvas');
    const layerCanvas = window._mbLayerCanvas;
    if (layerCanvas.width !== canvas.width || layerCanvas.height !== canvas.height) {
        layerCanvas.width = canvas.width;
        layerCanvas.height = canvas.height;
    }
    const lyr = layerCanvas.getContext('2d');

    const presentTiles = Array.from(new Set(data.cells.map(c => c.t)))
        .filter(k => k !== baseTileKey && !/^wall/.test(k))
        .sort((a, b) => MB_TILE_PRIORITY(a) - MB_TILE_PRIORITY(b));

    for (const tKey of presentTiles) {
        const isStruct = MB_IS_STRUCTURAL_TILE(tKey);
        const isLiquid = /^(water|lava|abyss)/.test(tKey);

        if (isStruct) {
            ctx.save();
            ctx.fillStyle = fillStyleForTile(ctx, tKey);
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                if (data.cells[r * cols + c].t === tKey) {
                    ctx.fillRect(c * cellW - 0.5, r * cellH - 0.5, cellW + 1, cellH + 1);
                }
            }
            // Мягкая тёмная кайма по границе каменных/деревянных полов с землёй
            ctx.strokeStyle = 'rgba(0, 0, 0, 0.28)';
            ctx.lineWidth = Math.max(1.5, cellW * 0.05);
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                if (data.cells[r * cols + c].t !== tKey) continue;
                const x = c * cellW, y = r * cellH;
                if (r > 0 && data.cells[(r - 1) * cols + c].t !== tKey && !/^wall/.test(data.cells[(r - 1) * cols + c].t)) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + cellW, y); ctx.stroke(); }
                if (r < rows - 1 && data.cells[(r + 1) * cols + c].t !== tKey && !/^wall/.test(data.cells[(r + 1) * cols + c].t)) { ctx.beginPath(); ctx.moveTo(x, y + cellH); ctx.lineTo(x + cellW, y + cellH); ctx.stroke(); }
                if (c > 0 && data.cells[r * cols + c - 1].t !== tKey && !/^wall/.test(data.cells[r * cols + c - 1].t)) { ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + cellH); ctx.stroke(); }
                if (c < cols - 1 && data.cells[r * cols + c + 1].t !== tKey && !/^wall/.test(data.cells[r * cols + c + 1].t)) { ctx.beginPath(); ctx.moveTo(x + cellW, y); ctx.lineTo(x + cellW, y + cellH); ctx.stroke(); }
            }
            ctx.restore();
            continue;
        }

        // Влажный/обгорелый берег вокруг воды/лавы
        if (isLiquid) {
            ctx.save();
            ctx.filter = `blur(${Math.max(4, Math.round(cellW * 0.16))}px)`;
            ctx.fillStyle = /^lava/.test(tKey) ? 'rgba(28, 10, 4, 0.88)' : (/^water/.test(tKey) ? 'rgba(24, 20, 12, 0.48)' : 'rgba(0,0,0,0.85)');
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                if (data.cells[r * cols + c].t !== tKey) continue;
                ctx.beginPath();
                ctx.arc((c + 0.5) * cellW, (r + 0.5) * cellH, cellW * 0.80, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.filter = 'none';
            ctx.restore();
        }

        // Растушёванный органический слой
        lyr.clearRect(0, 0, canvas.width, canvas.height);
        lyr.save();
        lyr.globalCompositeOperation = 'source-over';
        lyr.filter = `blur(${Math.max(3, Math.round(cellW * (isLiquid ? 0.10 : 0.20)))}px)`;
        lyr.fillStyle = '#000';
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            if (data.cells[r * cols + c].t !== tKey) continue;
            const x = c * cellW, y = r * cellH;
            lyr.fillRect(x + cellW * 0.05, y + cellH * 0.05, cellW * 0.90, cellH * 0.90);
            lyr.beginPath();
            lyr.arc(x + cellW * 0.5, y + cellH * 0.5, cellW * 0.65, 0, Math.PI * 2);
            lyr.fill();
        }
        lyr.filter = 'none';
        lyr.globalCompositeOperation = 'source-in';
        lyr.fillStyle = fillStyleForTile(lyr, tKey);
        lyr.fillRect(0, 0, canvas.width, canvas.height);
        lyr.restore();

        ctx.drawImage(layerCanvas, 0, 0);

        // Светлая кромка мелководья + тёмная глубина по центру воды
        if (/^water/.test(tKey) && window._mbPostFx) {
            ctx.save();
            ctx.filter = `blur(${Math.max(4, Math.round(cellW * 0.18))}px)`;
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                if (data.cells[r * cols + c].t !== tKey) continue;
                const deep = (r > 0 && data.cells[(r - 1) * cols + c].t === tKey) &&
                             (r < rows - 1 && data.cells[(r + 1) * cols + c].t === tKey) &&
                             (c > 0 && data.cells[r * cols + c - 1].t === tKey) &&
                             (c < cols - 1 && data.cells[r * cols + c + 1].t === tKey);
                ctx.fillStyle = deep ? 'rgba(4, 22, 48, 0.36)' : 'rgba(185, 238, 255, 0.18)';
                ctx.beginPath();
                ctx.arc((c + 0.5) * cellW, (r + 0.5) * cellH, cellW * 0.56, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.filter = 'none';
            ctx.restore();
        }
    }

    // Органический рельефный светотеневой шум
    if (window._mbPostFx) {
        ctx.save();
        ctx.fillStyle = MB_GET_ORGANIC_NOISE_PATTERN(ctx);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    // СЛОЙ 3: Глубокие падающие тени от стен
    const isWallAt = (c, r) => (r >= 0 && r < rows && c >= 0 && c < cols && /^wall/.test(data.cells[r * cols + c].t));
    ctx.save();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (isWallAt(c, r)) continue;
        const x = c * cellW, y = r * cellH;
        if (isWallAt(c, r - 1)) {
            const g = ctx.createLinearGradient(x, y, x, y + cellH * 0.72);
            g.addColorStop(0, 'rgba(0,0,0,0.68)'); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g; ctx.fillRect(x, y, cellW, cellH * 0.72);
        }
        if (isWallAt(c - 1, r)) {
            const g = ctx.createLinearGradient(x, y, x + cellW * 0.58, y);
            g.addColorStop(0, 'rgba(0,0,0,0.56)'); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g; ctx.fillRect(x, y, cellW * 0.58, cellH);
        }
        if (isWallAt(c, r + 1)) {
            const g = ctx.createLinearGradient(x, y + cellH, x, y + cellH * 0.70);
            g.addColorStop(0, 'rgba(0,0,0,0.34)'); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g; ctx.fillRect(x, y + cellH * 0.70, cellW, cellH * 0.30);
        }
        if (isWallAt(c + 1, r)) {
            const g = ctx.createLinearGradient(x + cellW, y, x + cellW * 0.72, y);
            g.addColorStop(0, 'rgba(0,0,0,0.30)'); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g; ctx.fillRect(x + cellW * 0.72, y, cellW * 0.28, cellH);
        }
    }
    ctx.restore();

    // СЛОЙ 4: Деликатная тактическая сетка
    if (window._mbShowGrid) {
        ctx.save();
        ctx.strokeStyle = 'rgba(240, 215, 165, 0.11)';
        ctx.lineWidth = 1;
        for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(c * cellW + 0.5, 0); ctx.lineTo(c * cellW + 0.5, canvas.height); ctx.stroke(); }
        for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * cellH + 0.5); ctx.lineTo(canvas.width, r * cellH + 0.5); ctx.stroke(); }
        ctx.restore();
    }

    // СЛОЙ 5: Сортировка и отрисовка объектов
    const lightSources = [];
    const objs = [];
    for (const o of (data.objects || [])) {
        const stObj = MB_FIND_STAMP_OBJ(o.id);
        if (!stObj) continue;
        objs.push({ o, stObj, meta: MB_ANALYZE_STAMP_META(stObj) });
    }

    const drawObjItem = (item, ghostAlpha = 1.0) => {
        const { o, stObj, meta } = item;
        const img = stObj.img ? MB_GET_LOADED_IMG(stObj.img) : null;
        if (!img || img.naturalWidth <= 0) return;

        const cx = o.x * cellW, cy = o.y * cellH;
        const targetMaxPx = cellW * meta.baseCells * (o.scale || 1.0);

        if (meta.glow && ghostAlpha === 1.0) {
            lightSources.push({
                x: cx, y: cy,
                color: meta.glow.color,
                r: cellW * meta.glow.radius * (o.scale || 1.0),
                intensity: meta.glow.intensity
            });
        }

        if (window._mbPostFx && ghostAlpha === 1.0 && meta.layer >= 1 && meta.layer <= 2) {
            const sr = targetMaxPx * (meta.layer === 2 ? 0.46 : 0.36);
            const sx = cx + (meta.layer === 2 ? cellW * 0.18 : cellW * 0.07);
            const sy = cy + (meta.layer === 2 ? cellH * 0.20 : cellH * 0.08);
            const g = ctx.createRadialGradient(sx, sy, sr * 0.12, sx, sy, sr);
            g.addColorStop(0, meta.layer === 2 ? 'rgba(0,0,0,0.44)' : 'rgba(0,0,0,0.34)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
        }

        ctx.save();
        ctx.globalAlpha = ghostAlpha;
        ctx.translate(cx, cy);
        if (o.rot) ctx.rotate((o.rot * Math.PI) / 180);

        if (meta.layer === 1) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.52)';
            ctx.shadowBlur = Math.max(4, cellW * 0.14);
            ctx.shadowOffsetX = cellW * 0.06;
            ctx.shadowOffsetY = cellH * 0.08;
        } else if (meta.layer === 2) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.58)';
            ctx.shadowBlur = Math.max(10, cellW * 0.30);
            ctx.shadowOffsetX = cellW * 0.16;
            ctx.shadowOffsetY = cellH * 0.20;
        }

        const aspect = img.naturalWidth / img.naturalHeight;
        let drawW = targetMaxPx, drawH = targetMaxPx;
        if (aspect >= 1) drawH = targetMaxPx / aspect;
        else drawW = targetMaxPx * aspect;
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        ctx.restore();
    };

    objs.filter(i => i.meta.layer === 0).forEach(i => drawObjItem(i));

    // СЛОЙ 6: Чёткие объёмные 3D-стены с тёмной окантовкой
    ctx.save();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const wKey = data.cells[r * cols + c].t;
        if (!/^wall/.test(wKey)) continue;
        const x = c * cellW, y = r * cellH;
        ctx.fillStyle = fillStyleForTile(ctx, wKey);
        ctx.fillRect(x, y, cellW + 0.5, cellH + 0.5);
        ctx.fillStyle = 'rgba(10, 8, 6, 0.32)';
        ctx.fillRect(x, y, cellW, cellH);

        ctx.strokeStyle = 'rgba(245, 226, 196, 0.36)';
        ctx.lineWidth = 2;
        if (!isWallAt(c, r - 1)) { ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.lineTo(x + cellW, y + 1); ctx.stroke(); }
        if (!isWallAt(c - 1, r)) { ctx.beginPath(); ctx.moveTo(x + 1, y); ctx.lineTo(x + 1, y + cellH); ctx.stroke(); }

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.88)';
        ctx.lineWidth = 3;
        if (!isWallAt(c, r + 1)) { ctx.beginPath(); ctx.moveTo(x, y + cellH - 1); ctx.lineTo(x + cellW, y + cellH - 1); ctx.stroke(); }
        if (!isWallAt(c + 1, r)) { ctx.beginPath(); ctx.moveTo(x + cellW - 1, y); ctx.lineTo(x + cellW - 1, y + cellH); ctx.stroke(); }
    }
    ctx.restore();

    objs.filter(i => i.meta.layer === 1).forEach(i => drawObjItem(i));
    objs.filter(i => i.meta.layer === 2).forEach(i => drawObjItem(i));
    objs.filter(i => i.meta.layer === 3).forEach(i => drawObjItem(i));

    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (/^lava/.test(data.cells[r * cols + c].t) && (r + c) % 2 === 0) {
            lightSources.push({ x: (c + 0.5) * cellW, y: (r + 0.5) * cellH, color: [255, 118, 36], r: cellW * 2.8, intensity: 0.78 });
        }
    }

    // СЛОЙ 7: LIGHTMAP + BLOOM + ВИНЬЕТКА
    if (window._mbPostFx) {
        const lw = Math.max(120, Math.round(canvas.width / 2));
        const lh = Math.max(80, Math.round(canvas.height / 2));
        if (!window._mbLightCanvas) window._mbLightCanvas = document.createElement('canvas');
        const lc = window._mbLightCanvas;
        if (lc.width !== lw || lc.height !== lh) { lc.width = lw; lc.height = lh; }
        const lctx = lc.getContext('2d');

        const [ar, ag, ab] = lightCfg.ambient;
        lctx.globalCompositeOperation = 'source-over';
        lctx.fillStyle = `rgb(${ar}, ${ag}, ${ab})`;
        lctx.fillRect(0, 0, lw, lh);

        if (lightSources.length > 0) {
            lctx.globalCompositeOperation = 'lighter';
            for (const ls of lightSources) {
                const lx = ls.x * 0.5, ly = ls.y * 0.5, lr = ls.r * 0.5;
                const [cr, cg, cb] = ls.color;
                const g = lctx.createRadialGradient(lx, ly, lr * 0.05, lx, ly, lr);
                g.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${Math.min(1, ls.intensity)})`);
                g.addColorStop(0.48, `rgba(${cr}, ${cg}, ${cb}, ${ls.intensity * 0.45})`);
                g.addColorStop(1, 'rgba(0,0,0,0)');
                lctx.fillStyle = g;
                lctx.beginPath(); lctx.arc(lx, ly, lr, 0, Math.PI * 2); lctx.fill();
            }
        }

        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(lc, 0, 0, canvas.width, canvas.height);

        if (lightSources.length > 0 && lightCfg.bloom > 0) {
            ctx.globalCompositeOperation = 'screen';
            for (const ls of lightSources) {
                const [cr, cg, cb] = ls.color;
                const br = ls.r * 0.65;
                const g = ctx.createRadialGradient(ls.x, ls.y, br * 0.04, ls.x, ls.y, br);
                g.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${lightCfg.bloom * ls.intensity})`);
                g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g;
                ctx.beginPath(); ctx.arc(ls.x, ls.y, br, 0, Math.PI * 2); ctx.fill();
            }
        }

        ctx.globalCompositeOperation = 'source-over';
        const vig = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.35,
            canvas.width / 2, canvas.height / 2, Math.hypot(canvas.width, canvas.height) * 0.56
        );
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, `rgba(0,0,0,${lightCfg.vignette})`);
        ctx.fillStyle = vig;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    if (!isExport && window._mbTool === 'stamp' && window._mbHoverPos && window._mbSelectedStamp) {
        const stObj = MB_FIND_STAMP_OBJ(window._mbSelectedStamp);
        if (stObj) {
            const meta = MB_ANALYZE_STAMP_META(stObj);
            const gx = window._mbSnapGrid ? (window._mbHoverPos.col + 0.5) : window._mbHoverPos.gx;
            const gy = window._mbSnapGrid ? (window._mbHoverPos.row + 0.5) : window._mbHoverPos.gy;
            drawObjItem({ o: { id: window._mbSelectedStamp, x: gx, y: gy, scale: window._mbStampScale || 1, rot: window._mbStampRot || 0 }, stObj, meta }, 0.62);
        }
    }
};

// ================================================================
// ⚡ ОПТИМИЗАЦИЯ ПРОГРУЗКИ (ЛЕНИВАЯ ЗАГРУЗКА ДЛЯ ТЕЛЕФОНОВ И WI-FI)
// ================================================================
window._mbTileCat = 'nature'; // Не открываем все 64 пола сразу при входе
window._mbStampPageLimit = 36; // Показываем по 36 объектов вместо 150 за раз

// Загружаем только те полы, которые РЕАЛЬНО есть на текущей карте
MB_PRELOAD_ALL_TILES = function() {
    const tiles = GET_MB_TILES();
    const data = window._mbData || GET_MB_DATA();
    const usedKeys = new Set((data.cells || []).map(c => c.t));
    usedKeys.forEach(k => {
        if (tiles[k] && tiles[k].img && !window._mbBrokenTileKeys[k]) {
            MB_GET_LOADED_IMG(tiles[k].img);
        }
    });
};

const _ORIG_STAMP_BTNS_FAST = MB_BUILD_STAMP_BUTTONS_HTML;
MB_BUILD_STAMP_BUTTONS_HTML = function() {
    const stamps = GET_UNIQUE_MB_STAMPS();
    const curCat = window._mbStampCat || 'nature';
    const q = (window._mbStampSearch || '').toLowerCase().trim();
    const filtered = stamps.filter(st => {
        const catOk = (curCat === 'all') || ((st.cat || 'other') === curCat);
        const qOk = !q || (st.label || '').toLowerCase().includes(q) || (st.id || '').toLowerCase().includes(q);
        return catOk && qOk;
    });

    if (!filtered.length) return '<div style="grid-column:1/-1; color:#777; font-size:0.82rem; padding:14px; text-align:center;">Ничего не найдено</div>';

    const limit = window._mbStampPageLimit || 36;
    let html = filtered.slice(0, limit).map(st => {
        const isSel = (window._mbTool === 'stamp' && window._mbSelectedStamp === st.id);
        const previewHTML = st.img
            ? `<img src="${st.img}" loading="lazy" decoding="async" onerror="this.closest('button').style.display='none';" style="width:44px; height:44px; object-fit:contain; filter:drop-shadow(0 2px 3px rgba(0,0,0,0.8));">`
            : `<span style="font-size:1.4rem;">${st.icon}</span>`;
        return `
            <button title="${st.label}" onclick="MB_SELECT_STAMP('${st.id}')"
                style="background:${isSel ? '#3a301e' : '#191816'}; color:${isSel ? '#f6d899' : '#d6d2c9'}; border:2px solid ${isSel ? '#c9a96e' : '#2f2b25'}; border-radius:8px; padding:5px 4px; display:flex; flex-direction:column; align-items:center; justify-content:space-between; gap:3px; min-height:74px; cursor:pointer; box-shadow:none;">
                ${previewHTML}
                <span style="font-size:0.68rem; font-weight:normal; line-height:1.1; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${st.label}</span>
            </button>`;
    }).join('');

    if (filtered.length > limit) {
        html += `<button class="btn-small" style="grid-column:1/-1; padding:7px; font-size:0.78rem; background:#2b251c; color:#e6c88c; border:1px solid #c9a96e;" onclick="window._mbStampPageLimit+=36; MB_RENDER_STAMP_GRID_ONLY();">⬇️ Показать ещё (${filtered.length - limit} осталось)</button>`;
    }
    return html;
};