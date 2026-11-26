// ================================================================
// 🎨 БЫСТРЫЙ СБАЛАНСИРОВАННЫЙ РЕНДЕР V6 (0 ctx.filter, ГЛАДКИЙ КАМЕНЬ, МЯГКИЙ СВЕТ)
// ================================================================
window._mbSideTab = window._mbSideTab || 'tiles';
window._mbTileCat = 'nature';
window._mbStampPageLimit = 36;
window._mbBrokenTileKeys = window._mbBrokenTileKeys || {};
window._mbStampMapCache = null;
window._mbTileLoadVer = 0;
window._mbStampLoadVer = 0;

// Общий генератор плавного 2D-шума (для бесконечного рельефа без шаблонов)
window.MB_MAKE_NOISE = function(seed = Math.random() * 999999) {
    const s = (Math.floor(seed) || 1337) >>> 0;
    const hash2 = (ix, iy) => {
        let n = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(s, 1442695041);
        n = (n ^ (n >>> 13)) >>> 0;
        n = Math.imul(n, 1274126177) >>> 0;
        return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
    };
    const val = (x, y) => {
        const ix = Math.floor(x), iy = Math.floor(y);
        const fx = x - ix, fy = y - iy;
        const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
        const a = hash2(ix, iy), b = hash2(ix + 1, iy);
        const c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
        return (a + (b - a) * u) + ((c + (d - c) * u) - (a + (b - a) * u)) * v;
    };
    return (x, y, freq = 0.14) => (
        val(x * freq, y * freq) * 0.62 +
        val(x * freq * 2.1 + 17.3, y * freq * 2.1 + 9.1) * 0.27 +
        val(x * freq * 4.3 + 41.7, y * freq * 4.3 + 23.4) * 0.11
    );
};

// Переводим природный stone в органические слои (убирает уродливые квадраты вокруг руин и пещер!)
MB_IS_STRUCTURAL_TILE = function(key) {
    return /^(wall|wood|flagstone|cobble|marble|floor|carpet)/.test(key || '');
};

// Калиброванные масштабы, слои и мягкое свечение без пересвета
MB_ANALYZE_STAMP_META = function(stObj) {
    const id = ((stObj?.id || '') + ' ' + (stObj?.label || '')).toLowerCase();

    let layer = 1;
    if (/(rug|carpet|mat|tatami|puddle|leaf_litter|duff|clover|soil_patch|dirt_patch|paving_stone|blood|webs|lily|submerged|current|rapids|river_edge|road_edge|path_edge|bridge|floor|ruin|shadow|shade|embers|fiery_area|oasis|watertransparent)/i.test(id)) {
        layer = 0;
    } else if (/(chimney|weather_vane)/i.test(id)) {
        layer = 3;
    } else if (/(roof|tree|palm|canopy|balloon|wing|tower|watchpost|chandelier|lightning|fireball|burning_hands|breath_weapon|wall_of_fire)/i.test(id) && !/(stump|fallen|branch|root|log|trunk)/i.test(id)) {
        layer = 2;
    }

    let baseCells = 1.15;
    const dimMatch = id.match(/(\d+)\s*x\s*(\d+)/i);
    if (/(roof_tiled_6x4|roof_thatch_6x4)/i.test(id)) {
        baseCells = 4.8;
    } else if (/(roof_premade)/i.test(id)) {
        baseCells = 5.2;
    } else if (/(bridge_section)/i.test(id)) {
        baseCells = 3.8;
    } else if (/(door_narrow|door_shoji|door_tatami)/i.test(id)) {
        baseCells = 1.22;
    } else if (/(door_wide|double_door)/i.test(id)) {
        baseCells = 1.85;
    } else if (/(window_wide|window_narrow)/i.test(id)) {
        baseCells = 1.12;
    } else if (dimMatch) {
        const wC = parseInt(dimMatch[1]) || 1;
        const hC = parseInt(dimMatch[2]) || 1;
        baseCells = Math.max(0.85, Math.min(5.0, Math.max(wC, hC) * 0.68));
    } else if (/(tent_large|tent_round_large|pavillion|balloon|city_roof$)/i.test(id)) {
        baseCells = 3.35;
    } else if (/(tree_large|palmtree|fountain|wagon|catapult|shelter|watchpost|oasis|bigstatue|large_statue|tatami_mat_large)/i.test(id)) {
        baseCells = 2.3;
    } else if (/(tree|palm|tent|ballista|cannon$|table_long|tabledinning|tableroundlarge|carpet|rug_6|bed_pattern|bedframeddouble|billiards_table|piano|sofa|forge|altar|tomb|bridge|rock_formation|fallen_tree|boulder|cart|thicket|casting_table|chandelier|orrery_huge|barricade|woodenstakes)/i.test(id)) {
        baseCells = 1.68;
    } else if (/(table_modular)/i.test(id)) {
        baseCells = 1.12;
    } else if (/(table|bed|desk|bench|bookshelf|dresser|cupboard|statue|well|barrel|crate|chest|campfire|brazier|cauldron|oven|stove|throne|bush|shrub|cactus|fungi|mushroom|rock|stump|log|pillar|door|grave|bonepile|crystal|flytrap|anvil|melting_pot|shrine|samurai_armor|taiko|bonsai|totem|meatrack|tanningrack|shipswheel|anchor|stairs)/i.test(id)) {
        baseCells = 1.15;
    } else if (/(candle|lantern|torch|flower|apple|egg|pie|plate|meat|tankard|card|scroll|skull|bone|coin|shell|starfish|crab|parrot|seagull|cat_|bottle|chair|stool|cushion|sack|bucket|hammer|axe|sword|shield|ingot|tongs|spyglass|parchment|chimney|kettle|slippers|vase|kimono)/i.test(id)) {
        baseCells = 0.72;
    }

    // Мягкое, реалистичное свечение (без слепящих кругов)
    let glow = null;
    if (/(campfire|forge|oven_fireplace|melting_pot|embers|fiery_area)/i.test(id) && !/unlit|empty|wood$|ring$|smoke/i.test(id)) {
        glow = { color: [255, 152, 68], radius: 2.6, intensity: 0.68 };
    } else if (/(brazier|torch|lantern|lamp|candle|chandelier|stand_lit|cooking_pit)/i.test(id) && !/unlit/i.test(id)) {
        glow = { color: [255, 204, 122], radius: 1.9, intensity: 0.54 };
    } else if (/(crystalblue|crystal_vertical|crystal_horizontal|rootsorb)/i.test(id)) {
        glow = { color: [105, 198, 255], radius: 1.85, intensity: 0.46 };
    }

    return { layer, baseCells, glow };
};

// Мгновенный поиск спрайта O(1)
MB_FIND_STAMP_OBJ = function(stampVal) {
    if (!stampVal) return null;
    if (!window._mbStampMapCache) {
        const m = new Map();
        const raw = (window.SITE_ASSETS && Array.isArray(window.SITE_ASSETS.builderStamps)) ? window.SITE_ASSETS.builderStamps : [];
        for (let i = 0; i < raw.length; i++) {
            const s = raw[i];
            if (s && !MB_IS_BROKEN_MACOS_ENTRY(s)) m.set(s.id, s);
        }
        window._mbStampMapCache = m;
    }
    return window._mbStampMapCache.get(stampVal) || null;
};

// Ленивая загрузка + однократное сжатие тяжёлых PNG
MB_GET_LOADED_IMG = function(src, isTile = false) {
    if (!src) return null;
    const entry = window._mbImgCache[src];
    if (entry) return entry.status === 'ok' ? entry.img : null;

    const rawImg = new Image();
    rawImg.decoding = 'async';
    window._mbImgCache[src] = { status: 'loading', img: rawImg };

    rawImg.onload = function() {
        const maxSide = isTile ? 512 : 320;
        const nw = rawImg.naturalWidth || rawImg.width;
        const nh = rawImg.naturalHeight || rawImg.height;
        let finalImg = rawImg;

        if (nw > maxSide || nh > maxSide) {
            const k = maxSide / Math.max(nw, nh);
            const off = document.createElement('canvas');
            off.width = Math.max(1, Math.round(nw * k));
            off.height = Math.max(1, Math.round(nh * k));
            const octx = off.getContext('2d');
            octx.imageSmoothingEnabled = true;
            octx.imageSmoothingQuality = 'medium';
            octx.drawImage(rawImg, 0, 0, off.width, off.height);
            finalImg = off;
        }

        window._mbImgCache[src] = { status: 'ok', img: finalImg };
        if (isTile) {
            window._mbTileLoadVer++;
            for (const key of Object.keys(window._mbPatternCache)) {
                if (key.includes(src)) delete window._mbPatternCache[key];
            }
        } else {
            window._mbStampLoadVer++;
        }

        if (document.getElementById('mb-editor-canvas') && !window._mbRedrawTimer) {
            window._mbRedrawTimer = setTimeout(() => {
                window._mbRedrawTimer = null;
                requestAnimationFrame(() => DRAW_MB_CANVAS());
            }, 140);
        }
    };

    rawImg.onerror = function() {
        window._mbImgCache[src] = { status: 'error', img: null };
    };

    rawImg.src = src;
    return null;
};

function MB_PRELOAD_ALL_TILES() {
    const tiles = GET_MB_TILES();
    const data = window._mbData || GET_MB_DATA();
    const usedKeys = new Set((data.cells || []).map(c => c.t));
    usedKeys.forEach(k => {
        if (tiles[k] && tiles[k].img && !window._mbBrokenTileKeys[k]) {
            MB_GET_LOADED_IMG(tiles[k].img, true);
        }
    });
}

// Гармоничный подбор текстур (отсекает дико выбивающиеся варианты из 14+ текстур)
MB_PICK_TILE_FAMILY = function(prefix, fallback = 'grass') {
    const tiles = GET_MB_TILES();
    const CURATED = {
        dirt:      ['dirt', 'dirt_2', 'dirt_3', 'dirt_4', 'dirt_5'],
        flagstone: ['flagstone', 'flagstone_2', 'flagstone_3', 'flagstone_4', 'flagstone_5', 'flagstone_6'],
        wood:      ['wood', 'wood_2', 'wood_3', 'wood_4', 'wood_5'],
        wall:      ['wall', 'wall_2', 'wall_3', 'wall_4'],
        stone:     ['stone', 'stone_2', 'stone_3', 'stone_4'],
        grass:     ['grass', 'grass_2'],
        snow:      ['snow', 'snow_2', 'snow_3'],
        ice:       ['ice', 'ice_2']
    };
    const isOk = (k) => {
        if (!tiles[k] || window._mbBrokenTileKeys[k]) return false;
        const src = tiles[k].img;
        if (src && window._mbImgCache[src] && window._mbImgCache[src].status === 'error') return false;
        return true;
    };
    if (CURATED[prefix]) {
        const pref = CURATED[prefix].filter(isOk);
        if (pref.length) return MB_PICK(pref);
    }
    const rx = new RegExp(`^${prefix}(_\\d+)?$`);
    const keys = Object.keys(tiles).filter(k => rx.test(k) && isOk(k));
    if (keys.length) return MB_PICK(keys);
    if (isOk(fallback)) return fallback;
    return Object.keys(tiles).find(k => isOk(k)) || 'grass';
};

// Единая цветокоррекция тайлов БЕЗ ctx.filter (убирает слепящий снег и кислотную листву)
MB_GET_TILE_PATTERN = function(ctx, tileKey, tileImg, src, cellPx) {
    const cacheKey = `v7_${tileKey}_${src}_${Math.round(cellPx)}`;
    if (window._mbPatternCache[cacheKey]) return window._mbPatternCache[cacheKey];

    let repeatCells = 2.6;
    if (/^wall/.test(tileKey)) repeatCells = 1.65;
    else if (/^(wood|flagstone|cobble|stone|floor|marble)/.test(tileKey)) repeatCells = 2.15;
    else if (/^(water|lava)/.test(tileKey)) repeatCells = 2.8;
    else repeatCells = 2.85;

    const targetPx = Math.max(72, Math.min(220, Math.round(cellPx * repeatCells)));
    const off = document.createElement('canvas');
    off.width = targetPx;
    off.height = targetPx;
    const octx = off.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.drawImage(tileImg, 0, 0, targetPx, targetPx);

    if (/^wall/.test(tileKey)) {
        octx.fillStyle = 'rgba(14, 12, 10, 0.30)';
        octx.fillRect(0, 0, targetPx, targetPx);
    } else if (/^snow/.test(tileKey)) {
        // Матируем яркий белый снег, чтобы глаза не уставали
        octx.fillStyle = 'rgba(42, 60, 82, 0.24)';
        octx.fillRect(0, 0, targetPx, targetPx);
    } else if (/^ice/.test(tileKey)) {
        octx.fillStyle = 'rgba(24, 52, 78, 0.20)';
        octx.fillRect(0, 0, targetPx, targetPx);
    } else if (/^leaves_red/.test(tileKey)) {
        octx.fillStyle = 'rgba(38, 28, 18, 0.34)';
        octx.fillRect(0, 0, targetPx, targetPx);
    } else if (/^lava/.test(tileKey)) {
        octx.fillStyle = 'rgba(24, 8, 4, 0.20)';
        octx.fillRect(0, 0, targetPx, targetPx);
    } else if (!/^water/.test(tileKey)) {
        octx.fillStyle = 'rgba(18, 16, 13, 0.14)';
        octx.fillRect(0, 0, targetPx, targetPx);
    }

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
    if (stObj && stObj.img) MB_GET_LOADED_IMG(stObj.img, false);
    RENDER_GM_MAP_BUILDER_UI();
};

OPEN_GM_MAP_BUILDER = function() {
    window._mbUniqueStampsCache = null;
    window._mbStampMapCache = null;
    window._mbPatternCache = {};
    window._mbTerrainCacheKey = '';
    window._mbFullMapCacheKey = '';
    window._mbData = GET_MB_DATA();
    MB_PRELOAD_ALL_TILES();
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
            ? `<img src="${st.img}" loading="lazy" decoding="async" onerror="this.closest('button').style.display='none';" style="width:44px; height:44px; object-fit:contain;">`
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
    const cellPx = Math.max(28, Math.min(54, Math.floor(1240 / Math.max(cols, rows * 1.45))));
    const canvasW = cols * cellPx;
    const canvasH = rows * cellPx;

    const curSide = window._mbSideTab || 'tiles';
    const TILE_CATS = [
        { id: 'all',    label: 'Все' },
        { id: 'nature', label: '🌿 Природа' },
        { id: 'stone',  label: '🪨 Камень' },
        { id: 'wood',   label: '🪵 Дерево' },
        { id: 'liquid', label: '🌊 Вода/Лава' },
        { id: 'wall',   label: '🧱 Стены' }
    ];
    const curTileCat = window._mbTileCat || 'nature';
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
            ? `<img src="${cfg.img}" loading="lazy" decoding="async" onerror="window._mbBrokenTileKeys['${key}']=true; this.closest('button').style.display='none';" style="width:100%; height:44px; object-fit:cover; border-radius:5px; display:block;">`
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
        return `<button class="btn-small" style="padding:3px 7px; font-size:0.71rem; background:${act ? '#c9a96e' : '#22201d'}; color:${act ? '#141210' : '#ccc'};" onclick="window._mbStampCat='${c.id}'; window._mbStampPageLimit=36; RENDER_GM_MAP_BUILDER_UI();">${c.label}</button>`;
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
               oninput="window._mbStampSearch=this.value; window._mbStampPageLimit=36; MB_RENDER_STAMP_GRID_ONLY();"
               style="width:100%; padding:5px 8px; font-size:0.78rem; text-align:left; margin-bottom:6px;">
        <div id="mb-stamps-grid-wrap" style="display:grid; grid-template-columns:repeat(3, 1fr); gap:6px; overflow-y:auto; padding:4px; background:#11100f; border-radius:8px; border:1px solid #2e2a24; flex:1; align-content:start;">
            ${MB_BUILD_STAMP_BUTTONS_HTML()}
        </div>
    `;

    cont.innerHTML = `
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

        <div style="display:grid; grid-template-columns: 330px 1fr; gap:10px; height:67vh; min-height:470px;">
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

            <div style="background:#0c0b0a; border:2px solid #524a3d; border-radius:10px; padding:8px; display:flex; align-items:center; justify-content:center; min-height:0; min-width:0; overflow:hidden;">
                <canvas id="mb-editor-canvas" width="${canvasW}" height="${canvasH}"
                    style="cursor:crosshair; border-radius:5px; max-width:100%; max-height:100%; width:auto; height:auto; aspect-ratio:${canvasW} / ${canvasH}; display:block; box-shadow:0 10px 36px rgba(0,0,0,0.95);">
                </canvas>
            </div>
        </div>

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

function MB_GET_SOFT_BRUSH() {
    if (window._mbSoftBrushCanvas) return window._mbSoftBrushCanvas;
    const c = document.createElement('canvas');
    c.width = 64; c.height = 64;
    const gctx = c.getContext('2d');
    const g = gctx.createRadialGradient(32, 32, 17, 32, 32, 32);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(0.68, 'rgba(0,0,0,0.88)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    gctx.fillStyle = g;
    gctx.fillRect(0, 0, 64, 64);
    window._mbSoftBrushCanvas = c;
    return c;
}

function MB_HASH_CELLS(cells) {
    let h = 2166136261;
    for (let i = 0; i < cells.length; i++) {
        const t = (cells[i] && cells[i].t) ? cells[i].t : '';
        for (let j = 0; j < t.length; j++) { h ^= t.charCodeAt(j); h = Math.imul(h, 16777619); }
        h ^= 44; h = Math.imul(h, 16777619);
    }
    return h >>> 0;
}

function MB_HASH_OBJS(objs) {
    let h = 2166136261 ^ objs.length;
    for (let i = 0; i < objs.length; i++) {
        const o = objs[i];
        h ^= Math.round(o.x * 100) ^ (Math.round(o.y * 100) << 7) ^ (Math.round((o.scale || 1) * 100) << 13) ^ ((o.rot || 0) << 19);
        h = Math.imul(h, 16777619);
        const id = o.id || '';
        if (id.length) { h ^= id.charCodeAt(0) ^ (id.charCodeAt(id.length - 1) << 8); h = Math.imul(h, 16777619); }
    }
    return h >>> 0;
}

// ================================================================
// ⚡ БЫСТРЫЙ HD-РЕНДЕР V6 (mScale=8, МЯГКИЙ BLOOM, 0 ctx.filter)
// ================================================================
DRAW_MB_CANVAS = function(isExport = false) {
    const canvas = document.getElementById('mb-editor-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    const data = window._mbData || GET_MB_DATA();
    const tiles = GET_MB_TILES();
    const cols = data.cols, rows = data.rows;
    const W = canvas.width, H = canvas.height;
    const cellW = W / cols, cellH = H / rows;
    const lightKey = data.lighting || window._mbLighting || 'day';
    const lightCfg = MB_LIGHTING_MODES[lightKey] || MB_LIGHTING_MODES.day;
    const postFx = !!window._mbPostFx;
    const showGrid = !!window._mbShowGrid;

    const cHash = MB_HASH_CELLS(data.cells);
    const oHash = MB_HASH_OBJS(data.objects || []);
    const terrainKey = `${cols}x${rows}|${W}x${H}|${cHash}|${postFx?1:0}|${showGrid?1:0}|${window._mbTileLoadVer}`;
    const fullKey = `${terrainKey}|${oHash}|${lightKey}|${window._mbStampLoadVer}`;

    const drawObjItem = (targetCtx, item, lightSources, ghostAlpha = 1.0) => {
        const { o, stObj, meta } = item;
        const img = stObj.img ? MB_GET_LOADED_IMG(stObj.img, false) : null;
        if (!img) return;
        const iw = img.naturalWidth || img.width;
        const ih = img.naturalHeight || img.height;
        if (!iw || !ih) return;

        const cx = o.x * cellW, cy = o.y * cellH;
        const targetMaxPx = cellW * meta.baseCells * (o.scale || 1.0);

        if (meta.glow && ghostAlpha === 1.0 && lightSources) {
            // Не стакаем два источника света впритык, чтобы не было слепящего пятна
            const tooClose = lightSources.some(ls => Math.hypot(ls.x - cx, ls.y - cy) < cellW * 1.45);
            if (!tooClose) {
                lightSources.push({
                    x: cx, y: cy, color: meta.glow.color,
                    r: cellW * meta.glow.radius * Math.min(1.25, o.scale || 1.0),
                    intensity: meta.glow.intensity
                });
            }
        }

        if (postFx && ghostAlpha === 1.0 && meta.layer >= 1 && meta.layer <= 2) {
            const sr = targetMaxPx * (meta.layer === 2 ? 0.42 : 0.32);
            const sx = cx + (meta.layer === 2 ? cellW * 0.13 : cellW * 0.05);
            const sy = cy + (meta.layer === 2 ? cellH * 0.15 : cellH * 0.06);
            const g = targetCtx.createRadialGradient(sx, sy, sr * 0.12, sx, sy, sr);
            g.addColorStop(0, meta.layer === 2 ? 'rgba(0,0,0,0.38)' : 'rgba(0,0,0,0.28)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            targetCtx.fillStyle = g;
            targetCtx.beginPath(); targetCtx.arc(sx, sy, sr, 0, Math.PI * 2); targetCtx.fill();
        }

        targetCtx.save();
        if (ghostAlpha !== 1.0) targetCtx.globalAlpha = ghostAlpha;
        targetCtx.translate(cx, cy);
        if (o.rot) targetCtx.rotate((o.rot * Math.PI) / 180);

        const aspect = iw / ih;
        const drawW = aspect >= 1 ? targetMaxPx : targetMaxPx * aspect;
        const drawH = aspect >= 1 ? targetMaxPx / aspect : targetMaxPx;
        targetCtx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        targetCtx.restore();
    };

    if (!window._mbFullMapCache) window._mbFullMapCache = document.createElement('canvas');
    const fullCanvas = window._mbFullMapCache;

    if (window._mbFullMapCacheKey !== fullKey || fullCanvas.width !== W || fullCanvas.height !== H) {
        fullCanvas.width = W;
        fullCanvas.height = H;
        const fctx = fullCanvas.getContext('2d');
        fctx.imageSmoothingEnabled = true;

        const fillStyleForTile = (targetCtx, tileKey) => {
            const cfg = tiles[tileKey] || tiles.grass || { bg: '#34592e' };
            const img = (cfg.img && !window._mbBrokenTileKeys[tileKey]) ? MB_GET_LOADED_IMG(cfg.img, true) : null;
            if (img) return MB_GET_TILE_PATTERN(targetCtx, tileKey, img, cfg.img, cellW);
            return MB_BUILD_PROCEDURAL_PATTERN(targetCtx, tileKey, cfg, cellW);
        };
        const isWallAt = (c, r) => (r >= 0 && r < rows && c >= 0 && c < cols && /^wall/.test(data.cells[r * cols + c].t));

        if (!window._mbTerrainCache) window._mbTerrainCache = document.createElement('canvas');
        const tCanvas = window._mbTerrainCache;

        if (window._mbTerrainCacheKey !== terrainKey || tCanvas.width !== W || tCanvas.height !== H) {
            tCanvas.width = W;
            tCanvas.height = H;
            const tctx = tCanvas.getContext('2d');
            tctx.imageSmoothingEnabled = true;

            const counts = {};
            for (let i = 0; i < data.cells.length; i++) {
                const k = data.cells[i].t;
                counts[k] = (counts[k] || 0) + 1;
            }
            let baseTileKey = 'grass', maxC = -1;
            for (const [k, v] of Object.entries(counts)) {
                if (!/^wall/.test(k) && v > maxC) { maxC = v; baseTileKey = k; }
            }

            tctx.fillStyle = fillStyleForTile(tctx, baseTileKey);
            tctx.fillRect(0, 0, W, H);

            // Чёткая микро-маска 8px на клетку (0.2 мс, но аккуратные берега и тропы!)
            const mScale = 8;
            const mw = cols * mScale, mh = rows * mScale;
            if (!window._mbMaskCanvas) window._mbMaskCanvas = document.createElement('canvas');
            const maskCanvas = window._mbMaskCanvas;
            if (maskCanvas.width !== mw || maskCanvas.height !== mh) { maskCanvas.width = mw; maskCanvas.height = mh; }
            const mctx = maskCanvas.getContext('2d');

            if (!window._mbLayerCanvas) window._mbLayerCanvas = document.createElement('canvas');
            const layerCanvas = window._mbLayerCanvas;
            if (layerCanvas.width !== W || layerCanvas.height !== H) { layerCanvas.width = W; layerCanvas.height = H; }
            const lyr = layerCanvas.getContext('2d');

            const brush = MB_GET_SOFT_BRUSH();

            const paintSoftMaskTint = (color, radiusScale, cellFilterFn) => {
                mctx.clearRect(0, 0, mw, mh);
                mctx.globalCompositeOperation = 'source-over';
                const rad = mScale * radiusScale;
                const d = rad * 2;
                let any = false;
                for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                    if (!cellFilterFn(c, r)) continue;
                    any = true;
                    mctx.drawImage(brush, (c + 0.5) * mScale - rad, (r + 0.5) * mScale - rad, d, d);
                }
                if (!any) return;
                mctx.globalCompositeOperation = 'source-in';
                mctx.fillStyle = color;
                mctx.fillRect(0, 0, mw, mh);
                mctx.globalCompositeOperation = 'source-over';
                tctx.drawImage(maskCanvas, 0, 0, W, H);
            };

            const presentTiles = Object.keys(counts)
                .filter(k => k !== baseTileKey && !/^wall/.test(k))
                .sort((a, b) => MB_TILE_PRIORITY(a) - MB_TILE_PRIORITY(b));

            for (const tKey of presentTiles) {
                const isStruct = MB_IS_STRUCTURAL_TILE(tKey);
                const isLiquid = /^(water|lava|abyss)/.test(tKey);

                if (isStruct) {
                    tctx.save();
                    tctx.fillStyle = fillStyleForTile(tctx, tKey);
                    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                        if (data.cells[r * cols + c].t === tKey) {
                            tctx.fillRect(c * cellW - 0.5, r * cellH - 0.5, cellW + 1, cellH + 1);
                        }
                    }
                    tctx.strokeStyle = 'rgba(0, 0, 0, 0.16)';
                    tctx.lineWidth = Math.max(1, cellW * 0.035);
                    tctx.beginPath();
                    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                        if (data.cells[r * cols + c].t !== tKey) continue;
                        const x = c * cellW, y = r * cellH;
                        if (r > 0 && data.cells[(r - 1) * cols + c].t !== tKey && !isWallAt(c, r - 1)) { tctx.moveTo(x, y); tctx.lineTo(x + cellW, y); }
                        if (r < rows - 1 && data.cells[(r + 1) * cols + c].t !== tKey && !isWallAt(c, r + 1)) { tctx.moveTo(x, y + cellH); tctx.lineTo(x + cellW, y + cellH); }
                        if (c > 0 && data.cells[r * cols + c - 1].t !== tKey && !isWallAt(c - 1, r)) { tctx.moveTo(x, y); tctx.lineTo(x, y + cellH); }
                        if (c < cols - 1 && data.cells[r * cols + c + 1].t !== tKey && !isWallAt(c + 1, r)) { tctx.moveTo(x + cellW, y); tctx.lineTo(x + cellW, y + cellH); }
                    }
                    tctx.stroke();
                    tctx.restore();
                    continue;
                }

                if (isLiquid) {
                    const shoreCol = /^lava/.test(tKey) ? 'rgba(26, 10, 4, 0.72)' : (/^water/.test(tKey) ? 'rgba(20, 18, 12, 0.36)' : 'rgba(0,0,0,0.80)');
                    paintSoftMaskTint(shoreCol, 1.02, (c, r) => data.cells[r * cols + c].t === tKey);
                }

                mctx.clearRect(0, 0, mw, mh);
                mctx.globalCompositeOperation = 'source-over';
                const rad = mScale * (isLiquid ? 0.84 : 0.94);
                const d = rad * 2;
                for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                    if (data.cells[r * cols + c].t !== tKey) continue;
                    mctx.drawImage(brush, (c + 0.5) * mScale - rad, (r + 0.5) * mScale - rad, d, d);
                }

                lyr.clearRect(0, 0, W, H);
                lyr.globalCompositeOperation = 'source-over';
                lyr.imageSmoothingEnabled = true;
                lyr.drawImage(maskCanvas, 0, 0, W, H);
                lyr.globalCompositeOperation = 'source-in';
                lyr.fillStyle = fillStyleForTile(lyr, tKey);
                lyr.fillRect(0, 0, W, H);
                lyr.globalCompositeOperation = 'source-over';
                tctx.drawImage(layerCanvas, 0, 0);

                if (/^water/.test(tKey) && postFx) {
                    paintSoftMaskTint('rgba(4, 22, 48, 0.32)', 0.82, (c, r) =>
                        r > 0 && r < rows - 1 && c > 0 && c < cols - 1 &&
                        data.cells[r * cols + c].t === tKey &&
                        data.cells[(r - 1) * cols + c].t === tKey &&
                        data.cells[(r + 1) * cols + c].t === tKey &&
                        data.cells[r * cols + c - 1].t === tKey &&
                        data.cells[r * cols + c + 1].t === tKey
                    );
                }
            }

            if (postFx) {
                tctx.fillStyle = MB_GET_ORGANIC_NOISE_PATTERN(tctx);
                tctx.fillRect(0, 0, W, H);
            }

            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                if (isWallAt(c, r)) continue;
                const x = c * cellW, y = r * cellH;
                if (isWallAt(c, r - 1)) {
                    const g = tctx.createLinearGradient(x, y, x, y + cellH * 0.65);
                    g.addColorStop(0, 'rgba(0,0,0,0.58)'); g.addColorStop(1, 'rgba(0,0,0,0)');
                    tctx.fillStyle = g; tctx.fillRect(x, y, cellW, cellH * 0.65);
                }
                if (isWallAt(c - 1, r)) {
                    const g = tctx.createLinearGradient(x, y, x + cellW * 0.52, y);
                    g.addColorStop(0, 'rgba(0,0,0,0.48)'); g.addColorStop(1, 'rgba(0,0,0,0)');
                    tctx.fillStyle = g; tctx.fillRect(x, y, cellW * 0.52, cellH);
                }
            }

            if (showGrid) {
                tctx.strokeStyle = 'rgba(230, 205, 160, 0.10)';
                tctx.lineWidth = 1;
                tctx.beginPath();
                for (let c = 0; c <= cols; c++) { tctx.moveTo(c * cellW + 0.5, 0); tctx.lineTo(c * cellW + 0.5, H); }
                for (let r = 0; r <= rows; r++) { tctx.moveTo(0, r * cellH + 0.5); tctx.lineTo(W, r * cellH + 0.5); }
                tctx.stroke();
            }

            window._mbTerrainCacheKey = terrainKey;
        }

        fctx.drawImage(tCanvas, 0, 0);

        const lightSources = [];
        const layers = [[], [], [], []];
        for (const o of (data.objects || [])) {
            const stObj = MB_FIND_STAMP_OBJ(o.id);
            if (!stObj) continue;
            const meta = MB_ANALYZE_STAMP_META(stObj);
            layers[meta.layer].push({ o, stObj, meta });
        }

        layers[0].forEach(i => drawObjItem(fctx, i, lightSources));

        fctx.save();
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const wKey = data.cells[r * cols + c].t;
            if (!/^wall/.test(wKey)) continue;
            const x = c * cellW, y = r * cellH;
            fctx.fillStyle = fillStyleForTile(fctx, wKey);
            fctx.fillRect(x, y, cellW + 0.5, cellH + 0.5);
            fctx.fillStyle = 'rgba(10, 8, 6, 0.28)';
            fctx.fillRect(x, y, cellW, cellH);

            fctx.strokeStyle = 'rgba(245, 226, 196, 0.34)';
            fctx.lineWidth = 2;
            if (!isWallAt(c, r - 1)) { fctx.beginPath(); fctx.moveTo(x, y + 1); fctx.lineTo(x + cellW, y + 1); fctx.stroke(); }
            if (!isWallAt(c - 1, r)) { fctx.beginPath(); fctx.moveTo(x + 1, y); fctx.lineTo(x + 1, y + cellH); fctx.stroke(); }

            fctx.strokeStyle = 'rgba(0, 0, 0, 0.84)';
            fctx.lineWidth = 3;
            if (!isWallAt(c, r + 1)) { fctx.beginPath(); fctx.moveTo(x, y + cellH - 1); fctx.lineTo(x + cellW, y + cellH - 1); fctx.stroke(); }
            if (!isWallAt(c + 1, r)) { fctx.beginPath(); fctx.moveTo(x + cellW - 1, y); fctx.lineTo(x + cellW - 1, y + cellH); fctx.stroke(); }
        }
        fctx.restore();

        layers[1].forEach(i => drawObjItem(fctx, i, lightSources));
        layers[2].forEach(i => drawObjItem(fctx, i, lightSources));
        layers[3].forEach(i => drawObjItem(fctx, i, lightSources));

        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            if (/^lava/.test(data.cells[r * cols + c].t) && (r * 3 + c) % 4 === 0) {
                const lx = (c + 0.5) * cellW, ly = (r + 0.5) * cellH;
                if (!lightSources.some(ls => Math.hypot(ls.x - lx, ls.y - ly) < cellW * 2.2)) {
                    lightSources.push({ x: lx, y: ly, color: [255, 126, 48], r: cellW * 2.4, intensity: 0.48 });
                }
            }
        }

        // Свет и виньетка (деликатный bloom, без выжигания глаз!)
        if (postFx) {
            const lw = Math.max(96, Math.round(W / 4)), lh = Math.max(64, Math.round(H / 4));
            const sX = lw / W, sY = lh / H;
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
                    const lx = ls.x * sX, ly = ls.y * sY, lr = ls.r * sX;
                    const [cr, cg, cb] = ls.color;
                    const g = lctx.createRadialGradient(lx, ly, lr * 0.05, lx, ly, lr);
                    g.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${Math.min(0.82, ls.intensity)})`);
                    g.addColorStop(0.5, `rgba(${cr}, ${cg}, ${cb}, ${ls.intensity * 0.36})`);
                    g.addColorStop(1, 'rgba(0,0,0,0)');
                    lctx.fillStyle = g;
                    lctx.beginPath(); lctx.arc(lx, ly, lr, 0, Math.PI * 2); lctx.fill();
                }
            }

            fctx.save();
            fctx.globalCompositeOperation = 'multiply';
            fctx.drawImage(lc, 0, 0, W, H);

            const softBloom = Math.min(0.20, (lightCfg.bloom || 0) * 0.38);
            if (lightSources.length > 0 && softBloom > 0) {
                fctx.globalCompositeOperation = 'screen';
                for (const ls of lightSources) {
                    const [cr, cg, cb] = ls.color;
                    const br = ls.r * 0.52;
                    const g = fctx.createRadialGradient(ls.x, ls.y, br * 0.04, ls.x, ls.y, br);
                    g.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${softBloom * ls.intensity})`);
                    g.addColorStop(1, 'rgba(0,0,0,0)');
                    fctx.fillStyle = g;
                    fctx.beginPath(); fctx.arc(ls.x, ls.y, br, 0, Math.PI * 2); fctx.fill();
                }
            }

            fctx.globalCompositeOperation = 'source-over';
            const vig = fctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.38, W / 2, H / 2, Math.hypot(W, H) * 0.58);
            vig.addColorStop(0, 'rgba(0,0,0,0)');
            vig.addColorStop(1, `rgba(0,0,0,${Math.min(0.45, lightCfg.vignette)})`);
            fctx.fillStyle = vig;
            fctx.fillRect(0, 0, W, H);
            fctx.restore();
        }

        window._mbFullMapCacheKey = fullKey;
    }

    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(fullCanvas, 0, 0);

    if (!isExport && window._mbTool === 'stamp' && window._mbHoverPos && window._mbSelectedStamp) {
        const stObj = MB_FIND_STAMP_OBJ(window._mbSelectedStamp);
        if (stObj) {
            const meta = MB_ANALYZE_STAMP_META(stObj);
            const gx = window._mbSnapGrid ? (window._mbHoverPos.col + 0.5) : window._mbHoverPos.gx;
            const gy = window._mbSnapGrid ? (window._mbHoverPos.row + 0.5) : window._mbHoverPos.gy;
            drawObjItem(ctx, { o: { id: window._mbSelectedStamp, x: gx, y: gy, scale: window._mbStampScale || 1, rot: window._mbStampRot || 0 }, stObj, meta }, null, 0.62);
        }
    }
};