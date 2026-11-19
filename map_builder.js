// ================================================================
// 🎨 СТУДИЯ КАРТ HD V4 (ПЛАВНЫЕ БИОМЫ, СВЕТ, АНТИ-ПОВТОР, 35+ ПЛАНИРОВОК)
// ================================================================
window._mbStampCat = window._mbStampCat || 'nature';
window._mbTileCat = window._mbTileCat || 'all';
window._mbStampSearch = window._mbStampSearch || '';
window._mbCols = window._mbCols || 24;
window._mbRows = window._mbRows || 15;
window._mbTool = window._mbTool || 'tile';          // 'tile' | 'brush3' | 'stamp' | 'eraser'
window._mbSelectedTile = window._mbSelectedTile || 'wall';
window._mbSelectedStamp = window._mbSelectedStamp || '';
window._mbShowGrid = (window._mbShowGrid !== undefined) ? window._mbShowGrid : true;
window._mbRandBiome = window._mbRandBiome || 'random';
window._mbLighting = window._mbLighting || 'day';
window._mbPostFx = (window._mbPostFx !== undefined) ? window._mbPostFx : true;
window._mbStampScale = window._mbStampScale || 1.0;
window._mbStampRot = window._mbStampRot || 0;
window._mbRandRot = (window._mbRandRot !== undefined) ? window._mbRandRot : false;
window._mbSnapGrid = (window._mbSnapGrid !== undefined) ? window._mbSnapGrid : false;
window._mbIsDrawing = false;
window._mbHoverPos = null;
window._mbUndoStack = window._mbUndoStack || [];
window._mbLastVariant = window._mbLastVariant || {};

const MB_SIZE_PRESETS = [
    { label: '🍺 Малая', cols: 16, rows: 11 },
    { label: '🌲 Средняя', cols: 24, rows: 15 },
    { label: '🏘️ Большая', cols: 32, rows: 20 },
    { label: '👑 Огромная', cols: 42, rows: 26 }
];

const MB_LIGHTING_MODES = {
    day:     { label: '☀️ Ясный день',         ambient: [252, 249, 242], bloom: 0.22, vignette: 0.22 },
    sunset:  { label: '🌅 Золотой закат',      ambient: [236, 188, 144], bloom: 0.36, vignette: 0.35 },
    tavern:  { label: '🕯️ Уютный полумрак',    ambient: [158, 138, 122], bloom: 0.48, vignette: 0.46 },
    night:   { label: '🌙 Лунная ночь',        ambient: [92,  114, 166], bloom: 0.56, vignette: 0.52 },
    dungeon: { label: '🏰 Глубокое подземелье', ambient: [106, 102, 120], bloom: 0.52, vignette: 0.62 }
};

function GET_MB_TILES() {
    const src = (window.SITE_ASSETS && window.SITE_ASSETS.builderTiles) ? Object.assign({}, window.SITE_ASSETS.builderTiles) : {};
    const defaults = {
        grass:        { name: 'Трава',         icon: '🌿', bg: '#34592e', border: '#233d1f', img: 'assets/tiles/grass.jpg' },
        dirt:         { name: 'Земля',         icon: '🛤️', bg: '#6b5138', border: '#4f3a27', img: 'assets/tiles/dirt.jpg' },
        leaves_green: { name: 'Листва',        icon: '🍃', bg: '#3f6230', border: '#2a4220', img: 'assets/tiles/leaves_green.jpg' },
        leaves_red:   { name: 'Осень',         icon: '🍁', bg: '#7c4328', border: '#542c1a', img: 'assets/stamps/other/texture_leaf_litter_red.png' },
        sand:         { name: 'Песок',         icon: '🏜️', bg: '#c7ad7c', border: '#9e8559', img: 'assets/tiles/sand.jpg' },
        snow:         { name: 'Снег',          icon: '❄️', bg: '#d7e2ec', border: '#9eb1c4', img: 'assets/tiles/snow.jpg' },
        cobble:       { name: 'Брусчатка',     icon: '🏛️', bg: '#65686e', border: '#484a4f', img: 'assets/tiles/cobble.jpg' },
        flagstone:    { name: 'Плиты',         icon: '⬜', bg: '#5d6066', border: '#3f4247', img: 'assets/tiles/flagstone.jpg' },
        stone:        { name: 'Камень',        icon: '🪨', bg: '#4b4e54', border: '#35383d', img: 'assets/tiles/stone.jpg' },
        wood:         { name: 'Доски',         icon: '🪵', bg: '#734b2c', border: '#54351d', img: 'assets/tiles/wood.jpg' },
        water:        { name: 'Вода',          icon: '🌊', bg: '#1e527d', border: '#153c5c', img: 'assets/tiles/water.jpg' },
        lava:         { name: 'Лава',          icon: '🔥', bg: '#b91c1c', border: '#f97316', img: 'assets/tiles/lava.jpg' },
        abyss:        { name: 'Пропасть',      icon: '🕳️', bg: '#0c0c10', border: '#1d1d24', img: '' },
        wall:         { name: 'Стена',         icon: '🧱', bg: '#282523', border: '#57534e', img: 'assets/tiles/wall.jpg' }
    };
    const merged = {};
    for (const [k, v] of Object.entries(src)) {
        merged[k] = Object.assign({ name: k, icon: '🎨', bg: '#555', border: '#333', img: '' }, defaults[k] || {}, v);
    }
    for (const [k, v] of Object.entries(defaults)) {
        if (!merged[k]) merged[k] = v;
    }
    return merged;
}

function MB_TILE_GROUP(key) {
    if (/^wall/.test(key)) return 'wall';
    if (/^(wood|floor)/.test(key)) return 'wood';
    if (/^(stone|flagstone|cobble|marble)/.test(key)) return 'stone';
    if (/^(water|lava|ice|abyss)/.test(key)) return 'liquid';
    return 'nature';
}

function MB_IS_STRUCTURAL_TILE(key) {
    return /^(wall|wood|stone|flagstone|cobble|marble|floor|carpet)/.test(key || '');
}

function MB_TILE_PRIORITY(key) {
    if (/^abyss/.test(key)) return 1;
    if (/^water/.test(key)) return 2;
    if (/^lava/.test(key)) return 3;
    if (/^ice/.test(key)) return 4;
    if (/^sand/.test(key)) return 5;
    if (/^(dirt|mud)/.test(key)) return 6;
    if (/^(grass|moss)/.test(key)) return 7;
    if (/^leaves/.test(key)) return 8;
    if (/^snow/.test(key)) return 9;
    if (/^(cobble|flagstone|stone|marble)/.test(key)) return 10;
    if (/^(wood|floor|carpet)/.test(key)) return 11;
    if (/^wall/.test(key)) return 99;
    return 10;
}

// ВАЖНО: Отсеиваем битые macOS-файлы (label начинается с ". "), из-за которых в проёмах вылезал эмодзи 🏰!
function MB_IS_BROKEN_MACOS_ENTRY(s) {
    if (!s) return true;
    const lbl = (s.label || '').trim();
    return lbl.startsWith('.') || lbl.startsWith('._');
}

function GET_MB_STAMPS() {
    if (window.SITE_ASSETS && Array.isArray(window.SITE_ASSETS.builderStamps) && window.SITE_ASSETS.builderStamps.length) {
        return window.SITE_ASSETS.builderStamps.filter(s => !MB_IS_BROKEN_MACOS_ENTRY(s));
    }
    return [];
}

function GET_UNIQUE_MB_STAMPS() {
    if (window._mbUniqueStampsCache) return window._mbUniqueStampsCache;
    const all = GET_MB_STAMPS();
    const seen = new Set();
    const out = [];
    for (const s of all) {
        const normKey = (s.cat || 'other') + '|' + (s.label || s.id).toLowerCase().replace(/\s+/g, ' ').trim();
        if (seen.has(normKey)) continue;
        seen.add(normKey);
        out.push(s);
    }
    window._mbUniqueStampsCache = out;
    return out;
}

// --- КЭШ ИЗОБРАЖЕНИЙ И БЕСШОВНЫХ ПАТТЕРНОВ ---
window._mbImgCache = window._mbImgCache || {};
window._mbPatternCache = window._mbPatternCache || {};
window._mbNoisePattern = window._mbNoisePattern || null;

function MB_GET_LOADED_IMG(src) {
    if (!src) return null;
    const entry = window._mbImgCache[src];
    if (entry) return entry.status === 'ok' ? entry.img : null;

    const img = new Image();
    window._mbImgCache[src] = { status: 'loading', img };
    img.onload = function() {
        window._mbImgCache[src].status = 'ok';
        for (const k of Object.keys(window._mbPatternCache)) {
            if (k.includes(src)) delete window._mbPatternCache[k];
        }
        if (document.getElementById('mb-editor-canvas') && !window._mbRedrawTimer) {
            window._mbRedrawTimer = setTimeout(() => {
                window._mbRedrawTimer = null;
                DRAW_MB_CANVAS();
            }, 35);
        }
    };
    img.onerror = function() {
        window._mbImgCache[src].status = 'error';
    };
    img.src = src;
    return null;
}

function MB_BUILD_PROCEDURAL_PATTERN(ctx, tileKey, cfg, cellPx) {
    const cacheKey = `proc_${tileKey}_${Math.round(cellPx)}`;
    if (window._mbPatternCache[cacheKey]) return window._mbPatternCache[cacheKey];

    const size = 192;
    const off = document.createElement('canvas');
    off.width = size; off.height = size;
    const o = off.getContext('2d');
    o.fillStyle = cfg.bg || '#444';
    o.fillRect(0, 0, size, size);

    let seed = 1337 + tileKey.split('').reduce((a, ch) => a + ch.charCodeAt(0) * 31, 0);
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    if (/^abyss/.test(tileKey)) {
        o.fillStyle = '#07070b'; o.fillRect(0, 0, size, size);
        for (let i = 0; i < 36; i++) {
            o.fillStyle = 'rgba(42, 34, 72, 0.18)';
            o.beginPath(); o.arc(rnd() * size, rnd() * size, 8 + rnd() * 24, 0, Math.PI * 2); o.fill();
        }
    } else {
        for (let i = 0; i < 85; i++) {
            o.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
            o.beginPath(); o.arc(rnd() * size, rnd() * size, 3 + rnd() * 13, 0, Math.PI * 2); o.fill();
        }
    }
    const pat = ctx.createPattern(off, 'repeat');
    window._mbPatternCache[cacheKey] = pat;
    return pat;
}

function MB_GET_TILE_PATTERN(ctx, tileKey, tileImg, src, cellPx) {
    const cacheKey = `img_${src}_${Math.round(cellPx)}`;
    if (window._mbPatternCache[cacheKey]) return window._mbPatternCache[cacheKey];

    const repeatCells = /^(wood|flagstone|cobble|stone)/.test(tileKey) ? 3.8 : (/^wall/.test(tileKey) ? 2.6 : 4.8);
    const targetPx = Math.max(120, Math.min(380, Math.round(cellPx * repeatCells)));
    const off = document.createElement('canvas');
    off.width = targetPx; off.height = targetPx;
    const octx = off.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(tileImg, 0, 0, targetPx, targetPx);

    const pat = ctx.createPattern(off, 'repeat');
    window._mbPatternCache[cacheKey] = pat;
    return pat;
}

function MB_GET_ORGANIC_NOISE_PATTERN(ctx) {
    if (window._mbNoisePattern) return window._mbNoisePattern;
    const s = 340;
    const off = document.createElement('canvas');
    off.width = s; off.height = s;
    const o = off.getContext('2d');
    let seed = 918273;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    for (let i = 0; i < 46; i++) {
        const x = rnd() * s, y = rnd() * s, r = 24 + rnd() * 62;
        const isLight = rnd() > 0.48;
        const col = isLight ? '255, 248, 224' : '10, 16, 22';
        const alpha = isLight ? 0.055 : 0.078;
        for (const dx of [-s, 0, s]) {
            for (const dy of [-s, 0, s]) {
                if (x + dx + r < 0 || x + dx - r > s || y + dy + r < 0 || y + dy - r > s) continue;
                const g = o.createRadialGradient(x + dx, y + dy, r * 0.1, x + dx, y + dy, r);
                g.addColorStop(0, `rgba(${col}, ${alpha})`);
                g.addColorStop(1, `rgba(${col}, 0)`);
                o.fillStyle = g;
                o.beginPath(); o.arc(x + dx, y + dy, r, 0, Math.PI * 2); o.fill();
            }
        }
    }
    window._mbNoisePattern = ctx.createPattern(off, 'repeat');
    return window._mbNoisePattern;
}

function MB_PRELOAD_CORE_TILES() {
    const tiles = GET_MB_TILES();
    ['grass', 'dirt', 'stone', 'flagstone', 'cobble', 'wood', 'wall', 'water', 'sand', 'snow', 'lava'].forEach(k => {
        if (tiles[k] && tiles[k].img) MB_GET_LOADED_IMG(tiles[k].img);
    });
}

// --- СЛОИ, ПРОПОРЦИИ И СВЕЧЕНИЕ СПРАЙТОВ ---
function MB_ANALYZE_STAMP_META(stObj) {
    const id = ((stObj?.id || '') + ' ' + (stObj?.label || '')).toLowerCase();

    let layer = 1;
    if (/(rug|carpet|mat|tatami|puddle|leaf_litter|duff|clover|soil_patch|dirt_patch|paving_stone|blood|webs|lily|submerged|current|rapids|river_edge|road_edge|path_edge|bridge|floor|ruin|shadow|shade|embers|fiery_area|oasis|watertransparent|spore)/i.test(id)) {
        layer = 0;
    } else if (/(chimney|weather_vane)/i.test(id)) {
        layer = 3; // Дымоходы поверх крыш
    } else if (/(roof|tree|palm|canopy|balloon|wing|tower|watchpost|chandelier|lightning|fireball|burning_hands|breath_weapon|wall_of_fire)/i.test(id) && !/(stump|fallen|branch|root|log|trunk)/i.test(id)) {
        layer = 2;
    }

    let baseCells = 1.15;
    const dimMatch = id.match(/(\d+)\s*x\s*(\d+)/i);
    if (/(roof_premade|roof_tiled|roof_thatch)/i.test(id)) {
        baseCells = 5.0;
    } else if (/(bridge_section)/i.test(id)) {
        baseCells = 3.8;
    } else if (/(door_narrow|door_1_base|door_2_base)/i.test(id)) {
        baseCells = 1.25;
    } else if (/(door_wide|double_door)/i.test(id)) {
        baseCells = 1.85;
    } else if (/(window_wide|window_narrow)/i.test(id)) {
        baseCells = 1.15;
    } else if (dimMatch) {
        const wC = parseInt(dimMatch[1]) || 1;
        const hC = parseInt(dimMatch[2]) || 1;
        baseCells = Math.max(0.85, Math.min(5.6, Math.max(wC, hC) * 0.72));
    } else if (/(tent_large|tent_round_large|pavillion|balloon|city_roof$)/i.test(id)) {
        baseCells = 3.5;
    } else if (/(tree_bigger|tree_large|tree_big|palmtree|fountain|wagon|catapult|shelter|watchpost|oasis|bigstatue|large_statue|tatami_mat_large)/i.test(id)) {
        baseCells = 2.4;
    } else if (/(tree|palm|tent|ballista|cannon$|table_long|tabledinning|tableroundlarge|carpet|rug_6|bed_pattern|bedframeddouble|billiards_table|piano|sofa|forge|altar|tomb|bridge|rock_formation|fallen_tree|boulder|cart|thicket|casting_table|chandelier|orrery_huge|barricade|woodenstakes)/i.test(id)) {
        baseCells = 1.72;
    } else if (/(table_modular)/i.test(id)) {
        baseCells = 1.15;
    } else if (/(table|bed|desk|bench|bookshelf|dresser|cupboard|statue|well|barrel|crate|chest|campfire|brazier|cauldron|oven|stove|throne|bush|shrub|cactus|fungi|mushroom|rock|stump|log|pillar|door|grave|bonepile|crystal|flytrap|anvil|melting_pot|shrine|samurai_armor|taiko|bonsai|totem|meatrack|tanningrack|shipswheel|anchor|stairs)/i.test(id)) {
        baseCells = 1.18;
    } else if (/(candle|lantern|torch|flower|apple|egg|pie|plate|meat|tankard|card|scroll|skull|bone|coin|shell|starfish|crab|parrot|seagull|cat_|bottle|chair|stool|cushion|sack|bucket|hammer|axe|sword|shield|ingot|tongs|spyglass|parchment|chimney)/i.test(id)) {
        baseCells = 0.72;
    }

    let glow = null;
    if (/(campfire|fireball|fiery|burning|flaming|flame|embers|forge|oven_fireplace|melting_pot|wall_of_fire)/i.test(id) && !/unlit|empty|wood$|ring$|smoke/i.test(id)) {
        glow = { color: [255, 148, 56], radius: 3.4, intensity: 0.92 };
    } else if (/(brazier|torch|lantern|lamp|candle|chandelier|stand_lit|jack_o_lantern|hole_roof_glow)/i.test(id) && !/unlit/i.test(id)) {
        glow = { color: [255, 200, 108], radius: 2.5, intensity: 0.80 };
    } else if (/(lightning|crystalblue|crystal_vertical|crystal_horizontal|arcane|magic|rootsorb)/i.test(id)) {
        glow = { color: [92, 200, 255], radius: 2.7, intensity: 0.76 };
    } else if (/(crystalred|acid|spore)/i.test(id)) {
        glow = { color: [175, 255, 105], radius: 2.2, intensity: 0.62 };
    }

    return { layer, baseCells, glow };
}

function MB_FIND_STAMP_OBJ(stampVal) {
    if (!stampVal) return null;
    const list = GET_MB_STAMPS();
    return list.find(s => s.id === stampVal) || null;
}

// --- ХРАНИЛИЩЕ И UNDO ---
function CREATE_EMPTY_MB_DATA(baseTile = 'grass', cols = window._mbCols, rows = window._mbRows) {
    const cells = [];
    for (let i = 0; i < rows * cols; i++) cells.push({ t: baseTile });
    return { cols, rows, lighting: window._mbLighting || 'day', cells, objects: [] };
}

function GET_MB_DATA() {
    const raw = localStorage.getItem('dnd_map_builder_grid');
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.cols && parsed.rows && Array.isArray(parsed.cells) && parsed.cells.length === parsed.cols * parsed.rows) {
                window._mbCols = parsed.cols;
                window._mbRows = parsed.rows;
                if (parsed.lighting) window._mbLighting = parsed.lighting;
                if (!Array.isArray(parsed.objects)) parsed.objects = [];
                // Авто-очистка старых битых macOS-ссылок из уже сохранённой карты
                parsed.objects = parsed.objects.filter(o => o && MB_FIND_STAMP_OBJ(o.id));
                return parsed;
            }
        } catch (e) {}
    }
    return CREATE_EMPTY_MB_DATA('grass', window._mbCols, window._mbRows);
}

function SAVE_MB_DATA(data) {
    try { localStorage.setItem('dnd_map_builder_grid', JSON.stringify(data)); } catch (e) {}
}

function MB_PUSH_UNDO() {
    if (!window._mbData) return;
    window._mbUndoStack.push(JSON.stringify(window._mbData));
    if (window._mbUndoStack.length > 25) window._mbUndoStack.shift();
}

function MB_UNDO() {
    if (!window._mbUndoStack || !window._mbUndoStack.length) return;
    try {
        window._mbData = JSON.parse(window._mbUndoStack.pop());
        window._mbCols = window._mbData.cols;
        window._mbRows = window._mbData.rows;
        window._mbLighting = window._mbData.lighting || 'day';
        SAVE_MB_DATA(window._mbData);
        RENDER_GM_MAP_BUILDER_UI();
    } catch (e) {}
}

function MB_RESIZE_GRID(newCols, newRows, clearWithTile = null) {
    MB_PUSH_UNDO();
    const cols = Math.max(8, Math.min(50, parseInt(newCols) || 24));
    const rows = Math.max(6, Math.min(40, parseInt(newRows) || 15));
    const oldData = window._mbData || GET_MB_DATA();

    let nextData;
    if (clearWithTile) {
        nextData = CREATE_EMPTY_MB_DATA(clearWithTile, cols, rows);
    } else {
        const baseTile = (oldData.cells && oldData.cells[0]) ? oldData.cells[0].t : 'grass';
        nextData = CREATE_EMPTY_MB_DATA(baseTile, cols, rows);
        nextData.lighting = oldData.lighting || window._mbLighting || 'day';
        for (let r = 0; r < Math.min(rows, oldData.rows); r++) {
            for (let c = 0; c < Math.min(cols, oldData.cols); c++) {
                nextData.cells[r * cols + c] = { t: oldData.cells[r * oldData.cols + c].t };
            }
        }
        nextData.objects = (oldData.objects || []).filter(o => o.x >= 0 && o.x <= cols && o.y >= 0 && o.y <= rows);
    }

    window._mbCols = cols;
    window._mbRows = rows;
    window._mbData = nextData;
    SAVE_MB_DATA(nextData);
    RENDER_GM_MAP_BUILDER_UI();
}

function OPEN_GM_MAP_BUILDER() {
    window._mbUniqueStampsCache = null;
    MB_PRELOAD_CORE_TILES();
    window._mbData = GET_MB_DATA();
    const uniqueStamps = GET_UNIQUE_MB_STAMPS();
    if (!window._mbSelectedStamp && uniqueStamps.length) {
        window._mbSelectedStamp = uniqueStamps[0].id;
    }
    const cont = document.getElementById('gm-tool-modal-content');
    cont.style.maxWidth = '1240px';
    RENDER_GM_MAP_BUILDER_UI();
    OM('gm-tool-modal');
}

if (!window._mbKeyBound) {
    window._mbKeyBound = true;
    window.addEventListener('keydown', function(e) {
        const canvas = document.getElementById('mb-editor-canvas');
        if (!canvas || !document.getElementById('gm-tool-modal')?.classList.contains('active')) return;
        const tag = document.activeElement ? document.activeElement.tagName : '';
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            MB_UNDO();
        } else if (e.key.toLowerCase() === 'r' || e.key.toLowerCase() === 'к') {
            e.preventDefault();
            window._mbStampRot = ((window._mbStampRot || 0) + 45) % 360;
            const lbl = document.getElementById('mb-rot-lbl');
            if (lbl) lbl.textContent = window._mbStampRot + '°';
            DRAW_MB_CANVAS();
        }
    });
}

// ================================================================
// 🖥️ ИНТЕРФЕЙС СТУДИИ КАРТ
// ================================================================
function RENDER_GM_MAP_BUILDER_UI() {
    const cont = document.getElementById('gm-tool-modal-content');
    if (!cont) return;
    const data = window._mbData || GET_MB_DATA();
    const cols = data.cols, rows = data.rows;
    window._mbCols = cols;
    window._mbRows = rows;

    const tiles = GET_MB_TILES();
    const stamps = GET_UNIQUE_MB_STAMPS();

    const cellPx = Math.max(36, Math.min(68, Math.floor(1640 / Math.max(cols, rows * 1.45))));
    const canvasW = cols * cellPx;
    const canvasH = rows * cellPx;

    // Вкладки для компактного отображения 60+ текстур пола
    const TILE_CATS = [
        { id: 'all',    label: '🎨 Все' },
        { id: 'nature', label: '🌿 Природа' },
        { id: 'stone',  label: '🪨 Камень' },
        { id: 'wood',   label: '🪵 Дерево' },
        { id: 'liquid', label: '🌊 Вода/Лава' },
        { id: 'wall',   label: '🧱 Стены' }
    ];
    const curTileCat = window._mbTileCat || 'all';
    const tileCatTabsHTML = TILE_CATS.map(tc => {
        const act = curTileCat === tc.id;
        return `<button class="btn-small" style="padding:2px 7px; font-size:0.74rem; background:${act ? '#c9a96e' : '#22201d'}; color:${act ? '#141210' : '#ccc'};" onclick="window._mbTileCat='${tc.id}'; RENDER_GM_MAP_BUILDER_UI();">${tc.label}</button>`;
    }).join('');

    let tileBtnsHTML = '';
    for (const [key, cfg] of Object.entries(tiles)) {
        if (curTileCat !== 'all' && MB_TILE_GROUP(key) !== curTileCat) continue;
        const isSel = (window._mbTool === 'tile' || window._mbTool === 'brush3') && window._mbSelectedTile === key;
        const imgOk = cfg.img && window._mbImgCache[cfg.img]?.status !== 'error';
        const thumbStyle = imgOk
            ? `background-image:url('${cfg.img}'); background-size:cover; background-color:${cfg.bg};`
            : `background:${cfg.bg}; border:1px solid ${cfg.border};`;

        tileBtnsHTML += `
            <button class="btn-small" onclick="MB_SELECT_TILE('${key}')"
                style="background:${isSel ? '#c9a96e' : '#181715'}; color:${isSel ? '#141210' : '#ebe8e2'}; border:2px solid ${isSel ? '#fff' : cfg.bg}; padding:3px 7px; display:inline-flex; align-items:center; gap:5px; font-size:0.76rem;">
                <span style="display:inline-block; width:15px; height:15px; border-radius:3px; ${thumbStyle}"></span>
                <span>${cfg.name}</span>
            </button>
        `;
    }

    const STAMP_CATS = [
        { id: 'all',       label: '📦 Все' },
        { id: 'nature',    label: '🌲 Природа' },
        { id: 'city',      label: '🏠 Город' },
        { id: 'furniture', label: '🪑 Мебель' },
        { id: 'dungeon',   label: '🏰 Подземелье' },
        { id: 'camp',      label: '⛺ Лагерь' },
        { id: 'effects',   label: '✨ Эффекты' },
        { id: 'other',     label: '🔹 Прочее' }
    ];

    const curCat = window._mbStampCat || 'nature';
    const catTabsHTML = STAMP_CATS.map(c => {
        const cnt = c.id === 'all' ? stamps.length : stamps.filter(s => (s.cat || 'other') === c.id).length;
        if (c.id !== 'all' && cnt === 0) return '';
        const active = curCat === c.id;
        return `<button class="btn-small" style="padding:3px 8px; font-size:0.75rem; background:${active ? '#c9a96e' : '#22201d'}; color:${active ? '#141210' : '#ccc'};" onclick="window._mbStampCat='${c.id}'; RENDER_GM_MAP_BUILDER_UI();">${c.label} (${cnt})</button>`;
    }).join('');

    const lightOpts = Object.entries(MB_LIGHTING_MODES).map(([k, m]) =>
        `<option value="${k}" ${window._mbLighting === k ? 'selected' : ''}>${m.label}</option>`
    ).join('');

    const tModeBtn = (mode, label) => `
        <button class="btn-small" onclick="window._mbTool='${mode}'; RENDER_GM_MAP_BUILDER_UI();"
            style="background:${window._mbTool===mode ? '#7c3aed' : '#22201d'}; color:#fff; border:1px solid ${window._mbTool===mode ? '#e9d5ff' : '#423c33'}; font-size:0.79rem; padding:4px 9px;">
            ${label}
        </button>
    `;

    const sizePresetBtns = MB_SIZE_PRESETS.map(p => {
        const isAct = (cols === p.cols && rows === p.rows);
        return `<button class="btn-small" style="padding:3px 7px; font-size:0.74rem; background:${isAct ? '#c9a96e' : '#22201d'}; color:${isAct ? '#141210' : '#ddd'};" onclick="MB_RESIZE_GRID(${p.cols}, ${p.rows})">${p.label} ${p.cols}×${p.rows}</button>`;
    }).join('');

    const curTitleVal = document.getElementById('mb-map-title-inp')?.value ?? (GET_MAP_STATE().title || 'Новая локация');

    cont.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #3d3830; padding-bottom:7px; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
            <h2 style="margin:0; border:none; padding:0; font-size:1.2rem;">🎨 Студия Карт HD (${cols}×${rows} кл. • объектов: ${(data.objects||[]).length})</h2>
            <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                <button class="btn-small" style="font-size:0.76rem;" onclick="MB_UNDO()" ${!window._mbUndoStack.length ? 'disabled' : ''}>↩️ Отменить (Ctrl+Z)</button>
                <button class="btn-small btn-danger" style="font-size:0.76rem;" onclick="MB_CLEAR_OBJECTS()">🧹 Убрать объекты</button>
                <button class="btn-small btn-danger" style="font-size:0.76rem;" onclick="MB_FILL_ALL(window._mbSelectedTile || 'grass')">🗑️ Очистить всё</button>
            </div>
        </div>

        <!-- Размер + Генератор (35+ планировок) + Свет -->
        <div style="display:grid; grid-template-columns: 1fr 1.32fr 0.84fr; gap:8px; margin-bottom:8px;">
            <div style="background:#181715; border:1px solid #423c33; border-radius:9px; padding:7px 9px; display:flex; flex-direction:column; gap:5px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:4px; flex-wrap:wrap;">
                    <b style="color:#c9a96e; font-size:0.8rem;">📏 Размер:</b>
                    <div style="display:flex; align-items:center; gap:4px;">
                        <input type="number" id="mb-cols-inp" min="8" max="50" value="${cols}" style="width:48px; padding:2px 4px; font-size:0.78rem;">
                        <span>×</span>
                        <input type="number" id="mb-rows-inp" min="6" max="40" value="${rows}" style="width:48px; padding:2px 4px; font-size:0.78rem;">
                        <button class="btn-small btn-save" style="padding:2px 7px; font-size:0.74rem;" onclick="MB_RESIZE_GRID(document.getElementById('mb-cols-inp').value, document.getElementById('mb-rows-inp').value)">Ок</button>
                    </div>
                </div>
                <div style="display:flex; gap:4px; flex-wrap:wrap;">${sizePresetBtns}</div>
            </div>

            <div style="background:#1b1824; border:1px solid #7c3aed; border-radius:9px; padding:7px 10px; display:flex; flex-direction:column; justify-content:space-between; gap:5px;">
                <b style="color:#d8b4fe; font-size:0.8rem;">🎲 Генератор локаций (каждый клик — новая планировка и стиль!):</b>
                <div style="display:flex; gap:6px; align-items:center;">
                    <select id="mb-rand-biome" onchange="window._mbRandBiome=this.value;" style="flex:1; padding:4px 7px; font-size:0.8rem; text-align:left;">
                        <option value="random" ${window._mbRandBiome==='random'?'selected':''}>🎲 Любая случайная локация</option>
                        <option value="tavern" ${window._mbRandBiome==='tavern'?'selected':''}>🍺 Таверна / Постоялый двор (4 схемы)</option>
                        <option value="city" ${window._mbRandBiome==='city'?'selected':''}>👑 Город / Столица / Квартал (4 схемы)</option>
                        <option value="battlefield" ${window._mbRandBiome==='battlefield'?'selected':''}>⚔️ Поле битвы / Осада / Засада (4 схемы)</option>
                        <option value="forest" ${window._mbRandBiome==='forest'?'selected':''}>🌲 Дикий лес / Река / Руины (4 схемы)</option>
                        <option value="dungeon" ${window._mbRandBiome==='dungeon'?'selected':''}>🏰 Подземелье / Склеп / Разлом (3 схемы)</option>
                        <option value="mansion" ${window._mbRandBiome==='mansion'?'selected':''}>🏛️ Богатый особняк / Залы (3 схемы)</option>
                        <option value="dwarven" ${window._mbRandBiome==='dwarven'?'selected':''}>⚒️ Кузница и чертоги дварфов (2 схемы)</option>
                        <option value="pirate" ${window._mbRandBiome==='pirate'?'selected':''}>🏴‍☠️ Пиратская бухта / Остров (2 схемы)</option>
                        <option value="desert" ${window._mbRandBiome==='desert'?'selected':''}>🏜️ Пустыня / Оазис / Руины (2 схемы)</option>
                        <option value="fey" ${window._mbRandBiome==='fey'?'selected':''}>🍄 Фейский лес / Роща (2 схемы)</option>
                        <option value="eastern" ${window._mbRandBiome==='eastern'?'selected':''}>⛩️ Восточный храм / Додзё (2 схемы)</option>
                        <option value="warcamp" ${window._mbRandBiome==='warcamp'?'selected':''}>⛺ Лагерь охотников / орков (2 схемы)</option>
                        <option value="snow" ${window._mbRandBiome==='snow'?'selected':''}>❄️ Снежный перевал / Привал (2 схемы)</option>
                    </select>
                    <button class="btn-small" style="background:linear-gradient(180deg,#8b5cf6 0%,#5b21b6 100%); color:#fff; border-color:#c084fc; padding:5px 11px; font-size:0.8rem; white-space:nowrap;" onclick="MB_GENERATE_RANDOM(document.getElementById('mb-rand-biome').value)">
                        🎲 Собрать!
                    </button>
                </div>
            </div>

            <div style="background:#181715; border:1px solid #c9a96e; border-radius:9px; padding:7px 9px; display:flex; flex-direction:column; justify-content:space-between; gap:4px;">
                <b style="color:#e6c88c; font-size:0.8rem;">💡 Свет и графика:</b>
                <select id="mb-lighting-sel" onchange="window._mbLighting=this.value; if(window._mbData){window._mbData.lighting=this.value; SAVE_MB_DATA(window._mbData);} DRAW_MB_CANVAS();" style="padding:3px 6px; font-size:0.79rem; text-align:left;">
                    ${lightOpts}
                </select>
                <div style="display:flex; gap:10px; flex-wrap:wrap; font-size:0.75rem; color:#ccc;">
                    <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                        <input type="checkbox" ${window._mbShowGrid ? 'checked' : ''} onchange="window._mbShowGrid=this.checked; DRAW_MB_CANVAS();">
                        <span>📏 Сетка</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                        <input type="checkbox" ${window._mbPostFx ? 'checked' : ''} onchange="window._mbPostFx=this.checked; DRAW_MB_CANVAS();">
                        <span>✨ HD-Свет</span>
                    </label>
                </div>
            </div>
        </div>

        <!-- Инструменты + Компактные полы + Объекты -->
        <div style="background:#181715; border:1px solid #423c33; border-radius:9px; padding:7px 10px; margin-bottom:8px; display:flex; flex-direction:column; gap:6px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:7px;">
                <div style="display:flex; gap:5px; align-items:center; flex-wrap:wrap;">
                    ${tModeBtn('tile', '🖌️ Пол 1×1')}
                    ${tModeBtn('brush3', '⬛ Пол 3×3')}
                    ${tModeBtn('stamp', '🌲 Объект')}
                    ${tModeBtn('eraser', '🧽 Удалить')}
                </div>
                <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap; font-size:0.78rem; color:#d8d4cc;">
                    <label style="display:flex; align-items:center; gap:4px;">
                        <span>🔍 <b id="mb-scale-lbl">${window._mbStampScale.toFixed(1)}×</b></span>
                        <input type="range" min="0.5" max="3.0" step="0.1" value="${window._mbStampScale}" oninput="window._mbStampScale=parseFloat(this.value); document.getElementById('mb-scale-lbl').textContent=this.value+'×'; DRAW_MB_CANVAS();" style="width:70px;">
                    </label>
                    <button class="btn-small" style="padding:2px 7px; font-size:0.74rem;" title="Повернуть (R)" onclick="window._mbStampRot=(window._mbStampRot+45)%360; document.getElementById('mb-rot-lbl').textContent=window._mbStampRot+'°'; DRAW_MB_CANVAS();">
                        🔄 <span id="mb-rot-lbl">${window._mbStampRot}°</span>
                    </button>
                    <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                        <input type="checkbox" ${window._mbRandRot ? 'checked' : ''} onchange="window._mbRandRot=this.checked;">
                        <span>🎲 Поворот</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                        <input type="checkbox" ${window._mbSnapGrid ? 'checked' : ''} onchange="window._mbSnapGrid=this.checked;">
                        <span>🧲 Сетка</span>
                    </label>
                </div>
            </div>

            <div>
                <div style="display:flex; gap:4px; flex-wrap:wrap; align-items:center; margin-bottom:4px;">
                    <b style="color:#c9a96e; font-size:0.76rem; margin-right:3px;">Пол/Земля:</b>
                    ${tileCatTabsHTML}
                </div>
                <div style="display:flex; gap:4px; flex-wrap:wrap; max-height:68px; overflow-y:auto; padding:4px; background:#121110; border-radius:6px; border:1px solid #302c26;">
                    ${tileBtnsHTML}
                </div>
            </div>

            <div>
                <div style="display:flex; gap:4px; flex-wrap:wrap; align-items:center; margin-bottom:4px;">
                    ${catTabsHTML}
                    <input type="text" id="mb-stamp-search-inp" value="${(window._mbStampSearch || '').replace(/"/g, '&quot;')}"
                           placeholder="🔍 Поиск объекта..."
                           oninput="window._mbStampSearch=this.value; MB_RENDER_STAMP_GRID_ONLY();"
                           style="width:165px; padding:2px 7px; font-size:0.76rem; text-align:left; margin-left:auto;">
                </div>
                <div id="mb-stamps-grid-wrap" style="display:flex; gap:4px; flex-wrap:wrap; max-height:92px; overflow-y:auto; padding:4px; background:#121110; border-radius:6px; border:1px solid #302c26;">
                    ${MB_BUILD_STAMP_BUTTONS_HTML()}
                </div>
            </div>
        </div>

        <!-- Холст HD -->
        <div style="display:flex; justify-content:center; align-items:flex-start; background:#0b0a09; padding:8px; border-radius:10px; border:2px solid #524a3d; overflow:auto; max-height:470px;">
            <canvas id="mb-editor-canvas" width="${canvasW}" height="${canvasH}"
                style="cursor:crosshair; border-radius:6px; max-width:100%; height:auto; box-shadow:0 10px 34px rgba(0,0,0,0.95);">
            </canvas>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:9px; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:220px;">
                <span style="color:#c9a96e; white-space:nowrap;">📍 Локация:</span>
                <input type="text" id="mb-map-title-inp" value="${curTitleVal.replace(/"/g, '&quot;')}" style="flex:1; text-align:left;">
            </div>
            <small style="color:#9e988e;">💡 ЛКМ — ставить • ПКМ — удалить • R — поворот • Ctrl+Z — отмена</small>
            <div style="display:flex; gap:8px;">
                <button class="btn-save" style="padding:9px 17px; font-size:0.95rem;" onclick="MB_APPLY_TO_GAME_MAP()">
                    ✅ Выложить карту игрокам!
                </button>
                <button onclick="CM('gm-tool-modal')">Закрыть</button>
            </div>
        </div>
    `;

    INIT_MB_CANVAS_EVENTS();
    DRAW_MB_CANVAS();
}

function MB_BUILD_STAMP_BUTTONS_HTML() {
    const stamps = GET_UNIQUE_MB_STAMPS();
    const curCat = window._mbStampCat || 'nature';
    const q = (window._mbStampSearch || '').toLowerCase().trim();
    const filtered = stamps.filter(st => {
        const stCat = st.cat || 'other';
        const catOk = (curCat === 'all') || (stCat === curCat);
        const qOk = !q || (st.label || '').toLowerCase().includes(q) || (st.id || '').toLowerCase().includes(q);
        return catOk && qOk;
    });

    if (!filtered.length) return '<span style="color:#777; font-size:0.8rem; padding:6px;">Ничего не найдено</span>';

    let html = filtered.slice(0, 140).map(st => {
        const isSel = (window._mbTool === 'stamp' && window._mbSelectedStamp === st.id);
        const previewHTML = st.img
            ? `<img src="${st.img}" loading="lazy" onerror="this.style.display='none';" style="width:20px; height:20px; object-fit:contain;">`
            : '';
        return `
            <button class="btn-small" title="${st.label}" onclick="MB_SELECT_STAMP('${st.id}')"
                style="background:${isSel ? '#c9a96e' : '#1b1917'}; color:${isSel ? '#141210' : '#fff'}; border:1px solid ${isSel ? '#fff' : '#3d3830'}; padding:3px 6px; display:inline-flex; align-items:center; gap:5px; font-size:0.75rem;">
                ${previewHTML} <span>${st.label}</span>
            </button>`;
    }).join('');

    if (filtered.length > 140) {
        html += `<div style="width:100%; color:#aaa; font-size:0.75rem; padding:4px;">Показаны первые 140 из ${filtered.length} — уточните поиск.</div>`;
    }
    return html;
}

function MB_RENDER_STAMP_GRID_ONLY() {
    const box = document.getElementById('mb-stamps-grid-wrap');
    if (box) box.innerHTML = MB_BUILD_STAMP_BUTTONS_HTML();
}

function MB_SELECT_TILE(tileKey) {
    window._mbSelectedTile = tileKey;
    if (window._mbTool !== 'tile' && window._mbTool !== 'brush3') window._mbTool = 'tile';
    RENDER_GM_MAP_BUILDER_UI();
}

function MB_SELECT_STAMP(stampId) {
    window._mbSelectedStamp = stampId;
    window._mbTool = 'stamp';
    const stObj = MB_FIND_STAMP_OBJ(stampId);
    if (stObj && stObj.img) MB_GET_LOADED_IMG(stObj.img);
    RENDER_GM_MAP_BUILDER_UI();
}

function MB_FILL_ALL(tileKey) {
    MB_PUSH_UNDO();
    window._mbData = CREATE_EMPTY_MB_DATA(tileKey, window._mbCols, window._mbRows);
    SAVE_MB_DATA(window._mbData);
    RENDER_GM_MAP_BUILDER_UI();
}

function MB_CLEAR_OBJECTS() {
    if (!window._mbData) return;
    MB_PUSH_UNDO();
    window._mbData.objects = [];
    SAVE_MB_DATA(window._mbData);
    RENDER_GM_MAP_BUILDER_UI();
}

// ================================================================
// 🎲 ГЕНЕРАТОР ЛОКАЦИЙ V4 (АНТИ-ПОВТОР, 35+ АРХИТЕКТУР, ВСЕ 64 ПОЛА)
// ================================================================
function MB_RAND_INT(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function MB_RAND_FLOAT(min, max) { return min + Math.random() * (max - min); }
function MB_PICK(arr) { return (arr && arr.length) ? arr[Math.floor(Math.random() * arr.length)] : null; }

// Гарантирует, что при повторном нажатии «Собрать!» выпадет ДРУГАЯ планировка
function MB_PICK_NEXT_VARIANT(biomeKey, variants) {
    const prev = window._mbLastVariant[biomeKey];
    const pool = variants.length > 1 ? variants.filter(v => v !== prev) : variants;
    const chosen = MB_PICK(pool);
    window._mbLastVariant[biomeKey] = chosen;
    return chosen;
}

// Выбирает случайную текстуру из нужного семейства (например 'wood' -> wood..wood_7, 'wall' -> wall..wall_5)
function MB_PICK_TILE_FAMILY(prefix, fallback = 'grass') {
    const tiles = GET_MB_TILES();
    const rx = new RegExp(`^${prefix}(_\\d+)?$`);
    const keys = Object.keys(tiles).filter(k => rx.test(k));
    if (keys.length) return MB_PICK(keys);
    return tiles[fallback] ? fallback : Object.keys(tiles)[0];
}

function MB_GET_POOL(includeRx, excludeRx = null) {
    const list = GET_UNIQUE_MB_STAMPS();
    return list.filter(s => {
        const txt = (s.id || '').toLowerCase();
        if (!includeRx.test(txt)) return false;
        if (excludeRx && excludeRx.test(txt)) return false;
        return true;
    }).map(s => s.id);
}

// Случайное зеркалирование готовой карты (удваивает/учетверяет визуальное разнообразие планировок!)
function MB_APPLY_RANDOM_MIRROR(data, allowX = true, allowY = true) {
    const flipX = allowX && Math.random() < 0.5;
    const flipY = allowY && Math.random() < 0.5;
    if (!flipX && !flipY) return;
    const { cols, rows } = data;
    const nextCells = new Array(cols * rows);
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const nc = flipX ? (cols - 1 - c) : c;
            const nr = flipY ? (rows - 1 - r) : r;
            nextCells[nr * cols + nc] = data.cells[r * cols + c];
        }
    }
    data.cells = nextCells;
    data.objects.forEach(o => {
        if (flipX) {
            o.x = Math.round((cols - o.x) * 100) / 100;
            o.rot = (360 - (o.rot || 0)) % 360;
        }
        if (flipY) {
            o.y = Math.round((rows - o.y) * 100) / 100;
            o.rot = (180 - (o.rot || 0) + 360) % 360;
        }
    });
}

function MB_GENERATE_RANDOM(biome) {
    MB_PUSH_UNDO();
    const allBiomes = ['tavern', 'city', 'battlefield', 'forest', 'dungeon', 'mansion', 'dwarven', 'pirate', 'desert', 'fey', 'eastern', 'warcamp', 'snow'];
    const picked = (biome === 'random' || !biome) ? MB_PICK_NEXT_VARIANT('_global', allBiomes) : biome;

    const cols = window._mbCols, rows = window._mbRows;

    // Разнообразные наборы текстур пола/стен для этого клика из твоих 64 текстур
    const T = {
        grass:     Math.random() < 0.25 ? MB_PICK_TILE_FAMILY('moss', 'grass') : MB_PICK_TILE_FAMILY('grass', 'grass'),
        dirt:      MB_PICK_TILE_FAMILY('dirt', 'dirt'),
        stone:     MB_PICK_TILE_FAMILY('stone', 'stone'),
        flagstone: MB_PICK_TILE_FAMILY('flagstone', 'stone'),
        cobble:    Math.random() < 0.55 ? 'cobble' : MB_PICK_TILE_FAMILY('flagstone', 'cobble'),
        wood:      MB_PICK_TILE_FAMILY('wood', 'wood'),
        wall:      MB_PICK_TILE_FAMILY('wall', 'wall'),
        snow:      MB_PICK_TILE_FAMILY('snow', 'snow'),
        ice:       MB_PICK_TILE_FAMILY('ice', 'snow'),
        lava:      MB_PICK_TILE_FAMILY('lava', 'lava'),
        water:     'water',
        sand:      'sand',
        abyss:     'abyss',
        leafG:     'leaves_green',
        leafR:     'leaves_red'
    };

    const baseByBiome = {
        forest: T.grass, tavern: T.grass, dungeon: T.wall, city: T.grass,
        mansion: T.wall, dwarven: T.wall, pirate: T.sand, desert: T.sand,
        fey: T.grass, eastern: T.grass, warcamp: T.grass, battlefield: T.grass, snow: T.snow
    };
    const lightByBiome = {
        forest:      MB_PICK(['day', 'day', 'sunset']),
        tavern:      MB_PICK(['tavern', 'tavern', 'sunset']),
        dungeon:     MB_PICK(['dungeon', 'night']),
        city:        MB_PICK(['day', 'day', 'sunset', 'night']),
        mansion:     MB_PICK(['tavern', 'day']),
        dwarven:     'dungeon',
        pirate:      MB_PICK(['day', 'sunset']),
        desert:      MB_PICK(['day', 'sunset']),
        fey:         'night',
        eastern:     MB_PICK(['day', 'sunset']),
        warcamp:     MB_PICK(['sunset', 'night']),
        battlefield: MB_PICK(['sunset', 'day']),
        snow:        MB_PICK(['day', 'night'])
    };

    window._mbLighting = lightByBiome[picked] || 'day';
    const data = CREATE_EMPTY_MB_DATA(baseByBiome[picked] || T.grass, cols, rows);
    data.lighting = window._mbLighting;

    const inBounds = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows;
    const getTile = (c, r) => inBounds(c, r) ? data.cells[r * cols + c].t : null;
    const setTile = (c, r, t) => { if (inBounds(c, r)) data.cells[r * cols + c].t = t; };
    const fillRect = (x1, y1, x2, y2, t) => {
        for (let r = Math.max(0, y1); r <= Math.min(rows - 1, y2); r++)
            for (let c = Math.max(0, x1); c <= Math.min(cols - 1, x2); c++) setTile(c, r, t);
    };
    const boxRoom = (x1, y1, x2, y2, floorT, wallT = T.wall) => {
        for (let r = y1; r <= y2; r++) for (let c = x1; c <= x2; c++) {
            const isW = (r === y1 || r === y2 || c === x1 || c === x2);
            setTile(c, r, isW ? wallT : floorT);
        }
    };

    const placedZones = [];
    const canPlace = (x, y, minDist = 1.1) => !placedZones.some(z => Math.hypot(z.x - x, z.y - y) < Math.max(minDist, z.r));
    const addObj = (poolOrId, x, y, scale = 1.0, rot = 0, reserveRadius = 0) => {
        const id = Array.isArray(poolOrId) ? MB_PICK(poolOrId) : poolOrId;
        if (!id) return false;
        const stObj = MB_FIND_STAMP_OBJ(id);
        if (!stObj) return false;
        if (stObj.img) MB_GET_LOADED_IMG(stObj.img);
        data.objects.push({ id, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, scale, rot });
        if (reserveRadius > 0) placedZones.push({ x, y, r: reserveRadius });
        return true;
    };

    // --- ЧИСТЫЕ ПУЛЫ РАБОЧИХ СПРАЙТОВ (100% БЕЗ БИТЫХ MACOS-ФАЙЛОВ И ЭМОДЗИ-ЗАМКОВ!) ---
    const P = {
        greenTrees:   MB_GET_POOL(/^nature_tree_(large|small|big|bigger|[123])$|^nature_tree_(large|small)_[12]$/),
        greenBushes:  MB_GET_POOL(/^nature_bush_(2|3|4|5|6|7|8)_green|^nature_bush_shrub_|^nature_bush_[12]$|^nature_thick_foliage_|^nature_foliage_|^other_fern_/),
        autumnBushes: MB_GET_POOL(/^nature_bush_1_red$|^nature_bush_9_yellow$|^other_leaf_litter_/),
        forestFlower: MB_GET_POOL(/^nature_flower_|^nature_flowers_|^other_clovers_/),
        forestRocks:  MB_GET_POOL(/^nature_mossy_boulder_|^nature_rock(_small)?_[123]$|^nature_rocks_[1-8]$/),
        forestLogs:   MB_GET_POOL(/^nature_fallen_tree_|^nature_stump_|^nature_tree_stump_[1-5]_cut$|^nature_log_/),
        forestFungi:  MB_GET_POOL(/^nature_mushrooms_[123]$|^nature_fungi_(1|3|5|14)_brown$|^nature_mushroom_(6|7)_brown$|^nature_mushroom_11_red$/),
        waterDec:     MB_GET_POOL(/^other_lily_pad|^nature_submerged_rocks_|^nature_river_rock_|^other_current_/),
        woodBridges:  MB_GET_POOL(/^nature_wooden_bridge_|^nature_bridge$/),
        stoneBridges: MB_GET_POOL(/^nature_stone_bridge_/),
        campfires:    MB_GET_POOL(/^camp_campfire(_fire|_pot_cooking)?$/),
        campTents:    MB_GET_POOL(/^camp_tent_(round_small|square_[123]|narrow_[12])$/),
        campGear:     MB_GET_POOL(/^furniture_bedroll_[123]$|^camp_backpack_|^other_firewood_pile$/),

        // Таверна / Интерьер
        doors:        MB_GET_POOL(/^dungeon_door_(narrow|wide)_|^dungeon_door_[12]_base_2$/),
        doubleDoors:  MB_GET_POOL(/^dungeon_door_wide_3x2$|^dungeon_double_door_[12]_base_2$/),
        windows:      MB_GET_POOL(/^other_window_(wide|narrow)_1x2$/),
        woodStairs:   MB_GET_POOL(/^other_stairs_wood_(up|down)$/),
        stoneStairs:  MB_GET_POOL(/^other_stairs_stone_(up|down)$|^other_stairs_[12]_base_2$/),
        barStraight:  MB_GET_POOL(/^furniture_table_modular_straight_dark$/),
        barCorner:    MB_GET_POOL(/^furniture_table_modular_corner_dark$/),
        tavTables:    MB_GET_POOL(/^furniture_table_(round|rectangle)_[1-4]_dark$|^furniture_table_long_1$|^furniture_tabledinning2$|^furniture_tableround(large|small)2$/),
        tavLongTbl:   MB_GET_POOL(/^furniture_table_long_1$|^furniture_table_rectangle_[1-4]_dark$|^furniture_tabledinning2$/),
        tavChairs:    MB_GET_POOL(/^furniture_chair_(simple_[1-5]|stool_[12]|bench_[12])_dark$|^furniture_bench3$|^furniture_chair3$/),
        tavStools:    MB_GET_POOL(/^furniture_chair_stool_[12]_dark$|^furniture_chair_stool_cushioned_1$/),
        tavRugs:      MB_GET_POOL(/^furniture_rug_(6_[a-g]|bear_1|animal_skin)$/),
        tavBeds:      MB_GET_POOL(/^furniture_bed_pattern_1_[a-f]$|^furniture_bedframed(single|double)2$/),
        tavBarrels:   MB_GET_POOL(/^furniture_storage_barrel_[1-5](_a)?_dark$|^other_keg(5tapped|6)$/),
        tavCrates:    MB_GET_POOL(/^furniture_storage_crate_[1-4]_dark$|^other_clutter_sacks_[12]$|^furniture_crate_[12]$/),
        tavShelves:   MB_GET_POOL(/^furniture_storage_(bookshelf_[1-3]|shelf_[12])|^other_storage_dresser_[12]_dark$|^other_cupboard2$/),
        tavFood:      MB_GET_POOL(/^other_clutter_tankards_full$|^furniture_clutter_food_[12]$|^other_clutter_playing_cards$|^other_pie$|^other_hamroast$|^other_stewpot$/),
        tavCandles:   MB_GET_POOL(/^other_light_candle_(small|cluster)_lit$|^other_light_lantern_lit$|^other_candles2?$/),
        tavFireplace: MB_GET_POOL(/^other_cooking_oven_fireplace_3$|^other_cooking_stove$|^other_cooking_oven_[12]$/),
        tavGames:     MB_GET_POOL(/^furniture_feature_(piano_1_a|billiards_table)$/),

        // Подземелье (ТОЛЬКО валидные спрайты!)
        dungBraziers: MB_GET_POOL(/^dungeon_light_brazier_|^other_light_stand_lit_iron$/),
        dungChests:   MB_GET_POOL(/^dungeon_chest_[12]_(steel|gold)$|^dungeon_chest2$|^furniture_chest_lockbox_1_iron$/),
        dungBones:    MB_GET_POOL(/^dungeon_bones_(adventurer|human_skull|misc)|^dungeon_bonepile$|^dungeon_clutter_skull_human$/),
        dungWebs:     MB_GET_POOL(/^dungeon_clutter_webs_/),
        dungPillars:  MB_GET_POOL(/^dungeon_pillar_(round|square)_1x1$|^dungeon_stone_pillar_[12]$|^dungeon_pillar_base_2$/),
        dungAltars:   MB_GET_POOL(/^dungeon_feature_altar_gold$|^dungeon_tomb_(1|open)$|^dungeon_feature_metal_cage_gold$/),
        dungRubble:   MB_GET_POOL(/^other_rubble_(small|medium|stone_pile|mixed_3x2)|^dungeon_blood_[1-5]$|^other_ruin_[1-6]$/),
        dungCollapsed:MB_GET_POOL(/^other_rubble_collapsed_wall_3x2$|^other_rubble_stone_pile_4x3$/),

        // Город / Столица
        cityRoofsTile:MB_GET_POOL(/^city_roof_tiled_6x4_shaded$|^city_roof_premade_8x6$/),
        cityRoofsThch:MB_GET_POOL(/^city_roof_thatch_6x4_shaded$|^city_roof_thatch_6x4$/),
        cityRoofsAll: MB_GET_POOL(/^city_roof_(tiled|thatch)_6x4_shaded$|^city_roof_premade_8x6$/),
        cityCenter:   MB_GET_POOL(/^city_fountain$|^city_well$|^city_feature_statue_[1-3]_stone$|^city_statue[1-3]$/),
        cityCarts:    MB_GET_POOL(/^city_cart_|^city_wagon$/),
        cityHorses:   MB_GET_POOL(/^other_horse2?$/),
        cityLamps:    MB_GET_POOL(/^city_woodlamp$|^other_light_stand_lit_iron$/),
        cityMarket:   MB_GET_POOL(/^other_apples$|^other_baskets$|^other_clutter_sacks_[12]$|^furniture_storage_crate_[12]_dark$|^furniture_storage_barrel_[12]_dark$|^other_cabbage$/),
        cityWatch:    MB_GET_POOL(/^other_watchpost$/),

        // Особняк
        manChairs:    MB_GET_POOL(/^furniture_chair_(sofa_1_[abc]|armchair_1_[a-d]|throne_stone)$/),
        manFeatures:  MB_GET_POOL(/^furniture_feature_(piano_|billiards_table)|^other_feature_(orrery_|armillary_|telescope_medium|suit_of_armor_)/),
        manLights:    MB_GET_POOL(/^other_light_chandelier_[1-4]_lit_/),
        manBooks:     MB_GET_POOL(/^furniture_storage_bookshelf_|^furniture_table_writing_desk_dark$|^other_clutter_globe$|^furniture_clutter_book_pile_/),
        manCats:      MB_GET_POOL(/^other_cat_/),

        // Дварфы
        dwForge:      MB_GET_POOL(/^dungeon_forge$|^dungeon_forge_anvil$|^dungeon_anvil$|^dungeon_melting_pot/),
        dwLoot:       MB_GET_POOL(/^dungeon_(gold|iron|bronze)_ingot$|^furniture_casting_table_axes$|^dungeon_axe_[12]$|^dungeon_hammer_1$|^dungeon_small_keg$/),
        dwStatues:    MB_GET_POOL(/^city_large_statue$|^dungeon_gold_wall_decoration$|^dungeon_pillar$/),

        // Пираты
        palms:        MB_GET_POOL(/^nature_palmtree2?$|^nature_tree_(large|small)_palm_/),
        pirateLoot:   MB_GET_POOL(/^dungeon_chestoctopus$|^other_coinbag$|^other_coinlarge4$|^camp_pirateflag$|^other_anchor2$|^city_shipswheel$|^furniture_messagebottle$|^other_largerope$/),
        beachLife:    MB_GET_POOL(/^other_(crab|coconutcrab2?|shell|shell8|starfish4?|sharkjaw|parrot|seagull)$/),
        boats:        MB_GET_POOL(/^other_canoe$/),

        // Пустыня
        desertCacti:  MB_GET_POOL(/^nature_cactus_(ball|flowering|large|saguaro|small)_|^nature_desert_(shrubs|grass)_|^other_aeonium_/),
        desertRocks:  MB_GET_POOL(/^nature_rocks[678]$|^nature_rock_formation_[2-6]$/),
        desertTents:  MB_GET_POOL(/^camp_tent_(large_9x5|small_5x4)$|^camp_tentlarge$/),
        desertProps:  MB_GET_POOL(/^other_pot5?$|^other_deadwood3$|^furniture_carpet_[123]_3x2$|^dungeon_bones_cow_skull_1x1$|^other_snake3?$/),

        // Фейский лес
        feyTrees:     MB_GET_POOL(/^nature_tree[234]$|^other_giantleafpurple/),
        feyFungi:     MB_GET_POOL(/^nature_fungi_(10_purple|2[678]_blue|[89]_orange|1[123]_yellow)$|^nature_mushroom_(5|2[123])_blue$|^other_spore_cloud_/),
        feyDecor:     MB_GET_POOL(/^nature_rootsorb2$|^nature_roots[246]$|^nature_giantroots5$|^nature_trumpetflower$|^dungeon_flytrap2?$|^other_lily[23]?$/),
        feyCrystals:  MB_GET_POOL(/^dungeon_crystal(blue|red)$|^dungeon_crystal_(horizontal|vertical)_/),

        // Восточный храм
        eastMats:     MB_GET_POOL(/^furniture_tatami_mat_(large|small|round_[12])$/),
        eastTables:   MB_GET_POOL(/^furniture_table_(kotatsu|game|[1-6])$/),
        eastDecor:    MB_GET_POOL(/^other_bonsai_|^other_paper_screen_|^other_shrine_|^other_samurai_armor_|^camp_weapons_(katanas|daisho|sword_rack)$|^other_taiko_drum$|^other_cushion_/),
        eastLights:   MB_GET_POOL(/^city_paper_lamp$|^other_paper_lantern_/),
        eastDoors:    MB_GET_POOL(/^dungeon_door_shoji_[12]$/),

        // Орки / Охотники
        orcTents:     MB_GET_POOL(/^other_shelter$|^camp_tentsmallround$|^camp_tent_square_[123]$/),
        orcProps:     MB_GET_POOL(/^camp_totemlarge$|^dungeon_giantskull$|^dungeon_skullstake$|^other_meatrack$|^other_tanningrack2$|^camp_weaponrack$|^other_warhorn$|^camp_(beaver|wolf|small)pelt$|^camp_campfire_hog$|^dungeon_campfire_cooking_spit$/),

        // Поле битвы
        siege:        MB_GET_POOL(/^camp_ballista$|^camp_cannon$|^other_catapult$|^effects_acidcauldron$|^dungeon_pitchcauldron$/),
        barricades:   MB_GET_POOL(/^furniture_barricade$|^other_woodenstakes$/),
        flags:        MB_GET_POOL(/^other_largeflag$/),
        battleLoot:   MB_GET_POOL(/^camp_(greatsword|longsword|weapon_sword|weapon_axe|weapon_shield)|^camp_cannonballs2?$|^effects_ballistabolts$/),
        battleFire:   MB_GET_POOL(/^other_embers_5x5$|^other_fiery_area_1_4x4$|^other_flaming_sphere_/),

        // Зима
        snowRocks:    MB_GET_POOL(/^nature_rock_[123]$|^nature_boulder$|^nature_rocks_[1-5]$/),
        snowPelts:    MB_GET_POOL(/^camp_(wolf|beaver)pelt$|^camp_peltwolf$|^furniture_bedroll_[12]$/)
    };

    // Удобная функция-помощник: ставит стол со стульями, едой и свечой (аккуратно, в масштабе)
    const placeTavernTableSet = (cx, cy, isLong = false) => {
        if (!canPlace(cx, cy, isLong ? 2.1 : 1.75)) return;
        const rot = isLong ? 0 : MB_PICK([0, 90]);
        addObj(isLong ? P.tavLongTbl : P.tavTables, cx, cy, isLong ? 1.0 : MB_RAND_FLOAT(0.84, 0.96), rot, isLong ? 1.85 : 1.5);
        addObj(P.tavChairs, cx, cy - 0.82, 0.78, 180, 0);
        addObj(P.tavChairs, cx, cy + 0.82, 0.78, 0, 0);
        if (isLong) {
            addObj(P.tavChairs, cx - 0.85, cy - 0.82, 0.78, 180, 0);
            addObj(P.tavChairs, cx + 0.85, cy + 0.82, 0.78, 0, 0);
        } else if (Math.random() < 0.6) {
            addObj(P.tavChairs, cx - 0.82, cy, 0.78, 90, 0);
            addObj(P.tavChairs, cx + 0.82, cy, 0.78, 270, 0);
        }
        if (Math.random() < 0.85) addObj(P.tavFood, cx - 0.18, cy + 0.05, 0.62, MB_RAND_INT(0, 359), 0);
        if (Math.random() < 0.72) addObj(P.tavCandles, cx + 0.28, cy - 0.08, 0.60, 0, 0);
    };

    // Помощник: строит настоящую угловую барную стойку с табуретами и бочками позади
    const placeBarCounter = (bx, byStart, byEnd, faceDir = 'left') => {
        const step = 1.05;
        for (let y = byStart; y <= byEnd; y += step) {
            addObj(P.barStraight, bx, y, 0.92, 90, 0.85);
            const stoolX = faceDir === 'left' ? (bx - 0.95) : (bx + 0.95);
            const barrelX = faceDir === 'left' ? (bx + 0.95) : (bx - 0.95);
            if (Math.random() < 0.85) addObj(P.tavStools, stoolX, y, 0.75, 0, 0.4);
            if (Math.random() < 0.75) addObj(P.tavBarrels, barrelX, y, 0.78, MB_RAND_INT(0, 359), 0.5);
        }
        addObj(P.tavCandles, bx, byStart + 0.3, 0.62, 0, 0);
        addObj(P.tavFood, bx, (byStart + byEnd) / 2, 0.60, 0, 0);
    };

    // Помощник: строит аккуратный дом (крыша + мощёная отмостка + дымоход + декор рядом)
    const placeCityHouse = (cx, cy, rotDeg, useThatch = false, scale = 1.0) => {
        const pool = useThatch ? P.cityRoofsThch : P.cityRoofsTile;
        const wSpan = (rotDeg % 180 === 0) ? 2 : 1;
        const hSpan = (rotDeg % 180 === 0) ? 1 : 2;
        fillRect(Math.floor(cx) - wSpan, Math.floor(cy) - hSpan, Math.floor(cx) + wSpan, Math.floor(cy) + hSpan, T.cobble);
        addObj(pool, cx, cy, scale, rotDeg, 2.7 * scale);
        if (Math.random() < 0.75) {
            addObj('other_misc_chimney_1x1', cx + (rotDeg % 180 === 0 ? 0.9 : 0.3), cy - 0.45, 0.85, 0, 0);
        }
    };

    let genTitle = 'Новая локация';

    // ============================================================
    // 1. 🍺 ТАВЕРНА / ПОСТОЯЛЫЙ ДВОР (4 СИЛЬНО РАЗНЫЕ ПЛАНИРОВКИ!)
    // ============================================================
    if (picked === 'tavern') {
        const variant = MB_PICK_NEXT_VARIANT('tavern', ['l_inn', 'courtyard', 'city_pub', 'creek_lodge']);

        if (variant === 'l_inn') {
            genTitle = MB_PICK(['Трактир «Золотой Гоблин»', 'Таверна «У Старого Очага»', 'Постоялый двор «Притишье»']);
            const x1 = 2, x2 = cols - 3, y1 = 2, y2 = rows - 3;
            boxRoom(x1, y1, x2, y2, T.wood, T.wall);

            // Отделяем 2 комнаты в правом крыле (спальня + кладовая)
            const wingX = Math.max(x1 + 6, x2 - Math.max(4, Math.floor((x2 - x1) * 0.32)));
            const midWingY = Math.floor((y1 + y2) / 2);
            for (let r = y1 + 1; r < y2; r++) setTile(wingX, r, T.wall);
            for (let c = wingX + 1; c < x2; c++) setTile(c, midWingY, T.wall);
            // Двери в комнаты (рабочие PNG!)
            setTile(wingX, Math.max(y1 + 2, midWingY - 2), T.wood);
            addObj(P.doors, wingX + 0.5, Math.max(y1 + 2, midWingY - 2) + 0.5, 0.9, 90, 1.0);
            setTile(wingX, Math.min(y2 - 2, midWingY + 2), T.wood);
            addObj(P.doors, wingX + 0.5, Math.min(y2 - 2, midWingY + 2) + 0.5, 0.9, 90, 1.0);

            // Главный вход снизу + дорожка + окна в стенах
            const doorX = Math.floor((x1 + wingX) / 2);
            setTile(doorX, y2, T.wood);
            addObj(P.doubleDoors, doorX + 0.5, y2 + 0.5, 0.85, 0, 1.3);
            fillRect(doorX - 1, y2 + 1, doorX + 1, rows - 1, T.dirt);
            addObj(P.windows, x1 + 2.5, y1 + 0.5, 0.95, 0, 0);
            addObj(P.windows, x1 + 0.5, Math.floor((y1 + y2) / 2) + 0.5, 0.95, 90, 0);

            // Камин у северной стены + ковёр + лестница на 2 этаж
            const hx = Math.floor((x1 + wingX) / 2);
            setTile(hx, y1 + 1, T.stone);
            addObj(P.tavFireplace, hx + 0.5, y1 + 1.25, 1.05, 0, 1.4);
            addObj(P.tavRugs, hx + 0.5, y1 + 2.8, 1.15, 0, 0);
            addObj(P.woodStairs, x1 + 1.8, y1 + 1.8, 0.85, 0, 1.6);

            // Настоящая барная стойка
            placeBarCounter(wingX - 1.5, y1 + 2.2, Math.min(y2 - 2.2, y1 + 5.6), 'left');

            // Столики в зале (разные — круглые и длинные)
            for (let r = y1 + 3.0; r <= y2 - 2.0; r += 3.0) {
                for (let c = x1 + 2.5; c <= wingX - 3.6; c += 3.3) {
                    placeTavernTableSet(c, r, Math.random() < 0.35);
                }
            }

            // Комнаты: спальня сверху, кладовая/кухня снизу
            addObj(P.tavBeds, x2 - 1.4, y1 + 2.0, 0.95, 0, 1.3);
            addObj(P.tavShelves, wingX + 1.4, y1 + 1.5, 0.85, 0, 0.9);
            addObj(P.tavCandles, x2 - 2.3, y1 + 1.6, 0.6, 0, 0);
            addObj(P.tavCrates, x2 - 1.5, y2 - 1.6, 0.9, 12, 0.9);
            addObj(P.tavBarrels, wingX + 1.5, y2 - 1.6, 0.88, 45, 0.9);
            if (x2 - wingX >= 4) addObj(P.tavBeds, x2 - 1.5, midWingY + 1.8, 0.9, 270, 1.2);
        }
        else if (variant === 'courtyard') {
            genTitle = MB_PICK(['Постоялый двор с конюшней', 'Подворье «Вольный Тракт»', 'Застава-корчма']);
            // Мощёный внутренний двор в центре/снизу, П-образное здание вокруг
            const x1 = 1, x2 = cols - 2, y1 = 1, y2 = rows - 2;
            const splitY = Math.max(y1 + 5, Math.floor(rows * 0.56));
            boxRoom(x1, y1, x2, splitY, T.wood, T.wall);
            // Правое крыло (конюшня/склад)
            const stabX = Math.max(x1 + 7, x2 - 5);
            boxRoom(stabX, splitY, x2, y2, T.dirt, T.wall);
            // Двор перед таверной
            fillRect(x1 + 1, splitY + 1, stabX - 1, y2, T.cobble);

            // Входы и окна
            const mainDoorX = Math.floor((x1 + stabX) / 2);
            setTile(mainDoorX, splitY, T.wood);
            addObj(P.doubleDoors, mainDoorX + 0.5, splitY + 0.5, 0.85, 0, 1.3);
            setTile(stabX, Math.floor((splitY + y2) / 2), T.dirt);
            addObj(P.doors, stabX + 0.5, Math.floor((splitY + y2) / 2) + 0.5, 0.9, 90, 1.0);
            addObj(P.windows, x1 + 3.5, splitY + 0.5, 0.95, 0, 0);
            addObj(P.windows, x2 - 3.5, y1 + 0.5, 0.95, 0, 0);

            // Внутренний двор: колодец, повозка, лошади, фонарь
            addObj('city_well', x1 + 2.6, y2 - 1.6, 1.05, 0, 1.4);
            addObj(P.cityCarts, mainDoorX - 1.5, y2 - 1.5, 0.95, 10, 1.6);
            addObj(P.cityLamps, mainDoorX + 1.8, splitY + 1.3, 0.82, 0, 0.7);
            // Конюшня: лошади, ящики, сено/бочки
            addObj(P.cityHorses, x2 - 1.6, splitY + 1.8, 0.95, 270, 1.2);
            if (y2 - splitY >= 4) addObj(P.cityHorses, x2 - 1.6, y2 - 1.4, 0.95, 270, 1.2);
            addObj(P.tavCrates, stabX + 1.5, y2 - 1.3, 0.85, 0, 0.8);

            // Зал таверны сверху: очаг, барная стойка слева, длинные столы
            addObj(P.tavFireplace, mainDoorX + 0.5, y1 + 1.2, 1.05, 0, 1.4);
            addObj(P.tavRugs, mainDoorX + 0.5, y1 + 2.7, 1.15, 0, 0);
            placeBarCounter(x1 + 2.4, y1 + 1.8, Math.min(splitY - 1.6, y1 + 4.5), 'right');
            for (let c = x1 + 5.2; c <= x2 - 2.2; c += 3.3) {
                placeTavernTableSet(c, Math.floor((y1 + splitY) / 2) + 0.5, true);
            }
        }
        else if (variant === 'city_pub') {
            genTitle = MB_PICK(['Городской трактир «Серебряный Кубок»', 'Игорный дом и таверна', 'Таверна у Площади']);
            fillRect(0, 0, cols - 1, rows - 1, T.cobble);
            const x1 = 1, x2 = cols - 2, y1 = 1, y2 = rows - 4;
            boxRoom(x1, y1, x2, y2, T.wood, T.wall);
            // Городская улица снизу с фонарями и бочками
            addObj(P.cityLamps, 3.0, rows - 1.8, 0.85, 0, 0.8);
            addObj(P.cityLamps, cols - 3.0, rows - 1.8, 0.85, 0, 0.8);
            addObj(P.cityCarts, cols - 5.5, rows - 1.6, 0.9, 180, 1.5);

            const doorX = Math.floor(cols / 2);
            setTile(doorX, y2, T.wood);
            addObj(P.doubleDoors, doorX + 0.5, y2 + 0.5, 0.9, 0, 1.3);
            addObj(P.windows, x1 + 3.5, y2 + 0.5, 0.95, 0, 0);
            addObj(P.windows, x2 - 3.5, y2 + 0.5, 0.95, 0, 0);

            // Богатый зал: люстры, ковёр по центру, музыкально-игровая зона, бар справа
            addObj(P.tavRugs, doorX + 0.5, Math.floor((y1 + y2) / 2) + 0.5, 1.35, 0, 0);
            addObj(P.manLights, doorX + 0.5, Math.floor((y1 + y2) / 2) + 0.5, 1.0, 0, 0);
            addObj(P.tavFireplace, x1 + 1.4, Math.floor((y1 + y2) / 2) + 0.5, 1.05, 90, 1.4);
            addObj(P.tavGames, x1 + 2.6, y1 + 2.2, 0.95, 0, 1.8);
            placeBarCounter(x2 - 2.3, y1 + 2.0, y2 - 2.0, 'left');

            for (let r = y1 + 2.3; r <= y2 - 1.8; r += 2.9) {
                for (let c = x1 + 4.8; c <= x2 - 4.4; c += 3.3) {
                    placeTavernTableSet(c, r, false);
                }
            }
        }
        else {
            genTitle = MB_PICK(['Лесная корчма у ручья', 'Хижина охотников и трактир', 'Таверна «У Брода»']);
            // Ручей вдоль правого края + мостик
            let rx = cols - 4;
            for (let r = 0; r < rows; r++) {
                if (Math.random() < 0.4) rx = Math.max(cols - 5, Math.min(cols - 3, rx + MB_RAND_INT(-1, 1)));
                setTile(rx, r, T.water); setTile(rx + 1, r, T.water);
            }
            const x1 = 2, x2 = Math.max(10, cols - 7), y1 = 2, y2 = rows - 3;
            boxRoom(x1, y1, x2, y2, T.wood, T.wall);
            const midY = Math.floor((y1 + y2) / 2);
            setTile(x2, midY, T.wood);
            addObj(P.doors, x2 + 0.5, midY + 0.5, 0.9, 90, 1.2);
            fillRect(x2 + 1, midY, cols - 1, midY, T.dirt);
            addObj(P.woodBridges, rx + 0.8, midY + 0.5, 0.95, 0, 1.8);

            // Внутри: уютный очаг, шкуры, барная стойка слева, столики
            addObj(P.tavFireplace, Math.floor((x1 + x2) / 2) + 0.5, y1 + 1.25, 1.05, 0, 1.4);
            addObj(P.tavRugs, Math.floor((x1 + x2) / 2) + 0.5, midY + 0.5, 1.1, 0, 0);
            placeBarCounter(x1 + 2.2, y1 + 2.0, Math.min(y2 - 2.0, y1 + 5.2), 'right');
            for (let r = y1 + 2.6; r <= y2 - 1.8; r += 2.8) {
                for (let c = x1 + 4.8; c <= x2 - 1.8; c += 3.0) placeTavernTableSet(c, r, false);
            }
            // Снаружи: дрова, столик на свежем воздухе, зелёные деревья
            addObj(P.campGear, x2 + 1.4, y1 + 1.5, 0.9, 25, 1.0);
        }

        // Зелёный двор для всех загородных таверн (без наезда на стены и без синих деревьев!)
        if (variant !== 'city_pub') {
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                if (getTile(c, r) !== T.grass) continue;
                const nearWall = [-1, 0, 1].some(dr => [-1, 0, 1].some(dc => getTile(c + dc, r + dr) === T.wall));
                if (nearWall || !canPlace(c + 0.5, r + 0.5, 1.7)) continue;
                const rnd = Math.random();
                if (rnd < 0.24) addObj(P.greenTrees, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.85, 1.15), MB_RAND_INT(0, 359), 1.6);
                else if (rnd < 0.36) addObj(P.greenBushes, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.7, 1.0), MB_RAND_INT(0, 359), 1.0);
            }
        }
        MB_APPLY_RANDOM_MIRROR(data, true, false);
    }

    // ============================================================
    // 2. 👑 ГОРОД / СТОЛИЦА (4 РАЗНЫЕ ЖИВЫЕ ПЛАНИРОВКИ!)
    // ============================================================
    else if (picked === 'city') {
        const variant = MB_PICK_NEXT_VARIANT('city', ['market_plaza', 'canal_district', 'city_gate', 'old_town']);
        const isBig = cols >= 26;

        if (variant === 'market_plaza') {
            genTitle = isBig ? 'Центральная ярмарочная площадь' : 'Торговая площадь Притишья';
            const mx = Math.floor(cols / 2), my = Math.floor(rows / 2);
            const pW = Math.max(4, Math.floor(cols * 0.24)), pH = Math.max(3, Math.floor(rows * 0.26));
            // Широкие улицы-лучи + центральная площадь из плит/брусчатки
            fillRect(0, my - 1, cols - 1, my + 1, T.cobble);
            fillRect(mx - 1, 0, mx + 1, rows - 1, T.cobble);
            fillRect(mx - pW, my - pH, mx + pW, my + pH, T.flagstone);

            // Фонтан/статуя + 4 фонаря
            addObj(P.cityCenter, mx + 0.5, my + 0.5, 1.25, 0, 1.9);
            [[-pW + 1, -pH + 1], [pW - 1, -pH + 1], [-pW + 1, pH - 1], [pW - 1, pH - 1]].forEach(([dx, dy]) => {
                addObj(P.cityLamps, mx + dx + 0.5, my + dy + 0.5, 0.85, 0, 0.8);
            });

            // Торговые ряды на площади (коврики/шатры + столы + товары + тележки)
            const stallOffsets = [[-pW + 2, -2], [pW - 2, -2], [-pW + 2, 2], [pW - 2, 2]];
            stallOffsets.forEach(([dx, dy]) => {
                const sx = mx + dx + 0.5, sy = my + dy + 0.5;
                if (canPlace(sx, sy, 1.6)) {
                    addObj(P.tavTables, sx, sy, 0.9, dy < 0 ? 0 : 180, 1.2);
                    addObj(P.cityMarket, sx - 0.5, sy + (dy < 0 ? -0.6 : 0.6), 0.72, MB_RAND_INT(0, 359), 0);
                    addObj(P.cityMarket, sx + 0.5, sy + (dy < 0 ? -0.6 : 0.6), 0.72, MB_RAND_INT(0, 359), 0);
                }
            });
            addObj(P.cityCarts, mx - pW - 1.5, my + 0.4, 0.95, 0, 1.6);
            addObj(P.cityCarts, mx + pW + 1.5, my + 0.4, 0.95, 180, 1.6);

            // Дома по 4 углам вокруг площади, выровненные к улицам
            const cornerSlots = [
                { x: 3.2, y: 2.8, r: 0 }, { x: cols - 3.2, y: 2.8, r: 180 },
                { x: 3.2, y: rows - 2.8, r: 0 }, { x: cols - 3.2, y: rows - 2.8, r: 180 },
                { x: mx - pW - 3.0, y: 2.8, r: 90 }, { x: mx + pW + 3.0, y: 2.8, r: 270 },
                { x: mx - pW - 3.0, y: rows - 2.8, r: 90 }, { x: mx + pW + 3.0, y: rows - 2.8, r: 270 }
            ];
            cornerSlots.forEach(s => {
                if (s.x > 2 && s.x < cols - 2 && s.y > 2 && s.y < rows - 2 && canPlace(s.x, s.y, 3.3)) {
                    placeCityHouse(s.x, s.y, s.r, !isBig && Math.random() < 0.45, MB_RAND_FLOAT(0.92, 1.08));
                }
            });
        }
        else if (variant === 'canal_district') {
            genTitle = MB_PICK(['Речной квартал и набережная', 'Канал Старого города', 'Мост Купцов']);
            fillRect(0, 0, cols - 1, rows - 1, T.cobble);
            const cy = Math.floor(rows / 2);
            // Городской канал по центру с каменными берегами
            fillRect(0, cy - 1, cols - 1, cy + 1, T.water);
            fillRect(0, cy - 3, cols - 1, cy - 2, T.flagstone);
            fillRect(0, cy + 2, cols - 1, cy + 3, T.flagstone);

            // 1 или 2 каменных моста через канал
            const bridgeXs = cols >= 26 ? [Math.floor(cols * 0.3), Math.floor(cols * 0.7)] : [Math.floor(cols * 0.5)];
            bridgeXs.forEach(bx => {
                fillRect(bx - 1, 0, bx + 1, rows - 1, T.flagstone);
                fillRect(bx - 1, cy - 1, bx + 1, cy + 1, T.water);
                addObj(P.stoneBridges, bx + 0.5, cy + 0.5, 1.15, 90, 2.4);
                addObj(P.cityLamps, bx - 1.5, cy - 2.1, 0.85, 0, 0.7);
                addObj(P.cityLamps, bx + 2.5, cy + 2.8, 0.85, 0, 0.7);
            });
            addObj(P.boats, Math.floor(cols * 0.5), cy + 0.5, 0.95, 0, 1.4);

            // Набережные кварталы с домами и товарами
            for (let x = 3.2; x <= cols - 3.2; x += 5.4) {
                if (canPlace(x, 2.4, 3.0) && !bridgeXs.some(bx => Math.abs(bx - x) < 3.4)) {
                    placeCityHouse(x, 2.3, 0, false, MB_RAND_FLOAT(0.9, 1.05));
                    addObj(P.cityMarket, x + 2.1, cy - 2.2, 0.75, 0, 0.6);
                }
                if (canPlace(x, rows - 2.4, 3.0) && !bridgeXs.some(bx => Math.abs(bx - x) < 3.4)) {
                    placeCityHouse(x, rows - 2.3, 180, false, MB_RAND_FLOAT(0.9, 1.05));
                    addObj(P.cityCarts, x - 2.0, cy + 2.5, 0.85, 0, 1.3);
                }
            }
        }
        else if (variant === 'city_gate') {
            genTitle = MB_PICK(['Городские ворота и застава', 'Въезд в Столицу', 'Гарнизонный пропускной пункт']);
            const wallX = Math.floor(cols * 0.48);
            const midY = Math.floor(rows / 2);
            // Справа — мощёный город, слева — зелёный пригород и тракт
            fillRect(wallX, 0, cols - 1, rows - 1, T.cobble);
            fillRect(0, midY - 1, cols - 1, midY + 1, T.flagstone);
            // Крепостная стена толщиной в 2 клетки с широкими воротами по центру
            for (let r = 0; r < rows; r++) {
                if (Math.abs(r - midY) > 1) {
                    setTile(wallX, r, T.wall);
                    setTile(wallX + 1, r, T.wall);
                }
            }
            // Сторожевые башни у ворот
            addObj(P.cityWatch, wallX + 1.0, midY - 3.2, 1.1, 0, 2.0);
            addObj(P.cityWatch, wallX + 1.0, midY + 3.8, 1.1, 0, 2.0);
            addObj(P.cityLamps, wallX - 0.6, midY - 1.6, 0.85, 0, 0.6);
            addObj(P.cityLamps, wallX - 0.6, midY + 2.2, 0.85, 0, 0.6);
            // Караван на въезде
            addObj(P.cityCarts, wallX - 3.5, midY + 0.4, 1.0, 0, 1.7);
            addObj(P.cityHorses, wallX - 5.5, midY + 0.4, 0.9, 0, 1.0);
            // Внутри города — каменные дома, снаружи — пригородные домики с соломенной крышей и деревья
            for (let y of [2.8, rows - 2.8]) {
                for (let x = wallX + 4.8; x <= cols - 2.8; x += 5.5) {
                    if (canPlace(x, y, 3.0)) placeCityHouse(x, y, y < midY ? 0 : 180, false, 0.95);
                }
                if (wallX >= 7 && canPlace(3.3, y, 3.0)) {
                    placeCityHouse(3.3, y, 0, true, 0.9);
                }
            }
            for (let r = 1; r < rows - 1; r++) for (let c = 1; c < wallX - 1; c++) {
                if (getTile(c, r) === T.grass && canPlace(c + 0.5, r + 0.5, 1.9) && Math.random() < 0.16) {
                    addObj(P.greenTrees, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.85, 1.1), MB_RAND_INT(0, 359), 1.6);
                }
            }
        }
        else {
            genTitle = MB_PICK(['Старый квартал и сквер', 'Переулки Верхнего города', 'Уютная слобода']);
            fillRect(0, 0, cols - 1, rows - 1, T.cobble);
            // Извилистая главная улица из плит
            let sy = Math.floor(rows * 0.48);
            for (let c = 0; c < cols; c++) {
                if (c % 4 === 0 && Math.random() < 0.65) sy = Math.max(3, Math.min(rows - 4, sy + MB_RAND_INT(-1, 1)));
                fillRect(c, sy - 1, c, sy + 1, T.flagstone);
            }
            // Зелёный городской сквер в одной из частей карты
            const parkX = MB_RAND_INT(Math.floor(cols * 0.25), Math.floor(cols * 0.72));
            const parkY = Math.random() < 0.5 ? 2 : rows - 4;
            fillRect(parkX - 2, parkY, parkX + 2, parkY + 2, T.grass);
            addObj(P.cityCenter, parkX + 0.5, parkY + 1.5, 1.0, 0, 1.5);
            addObj(P.greenTrees, parkX - 1.7, parkY + 0.7, 0.95, 30, 1.3);
            addObj(P.greenTrees, parkX + 2.3, parkY + 2.1, 0.95, 140, 1.3);
            addObj(P.forestFlower, parkX - 0.8, parkY + 2.2, 0.85, 0, 0.6);
            addObj(P.cityLamps, parkX + 0.5, sy - 1.5, 0.85, 0, 0.7);

            // Разнообразные дома вдоль улицы (без жёсткой сетки клонов)
            for (let c = 3.0; c <= cols - 3.0; c += 5.2) {
                for (let r of [2.5, rows - 2.5]) {
                    const jitterX = c + MB_RAND_FLOAT(-0.5, 0.5);
                    if (getTile(Math.floor(jitterX), Math.floor(r)) === T.cobble && canPlace(jitterX, r, 3.2)) {
                        placeCityHouse(jitterX, r, MB_PICK([0, 90, 180]), Math.random() < 0.35, MB_RAND_FLOAT(0.88, 1.05));
                        if (Math.random() < 0.6) addObj(P.cityMarket, jitterX + 1.8, r + (r < rows / 2 ? 1.8 : -1.8), 0.75, 0, 0.6);
                    }
                }
            }
        }
        MB_APPLY_RANDOM_MIRROR(data, true, true);
    }

    // ============================================================
    // 3. ⚔️ ПОЛЕ БИТВЫ / ОСАДА (4 ДРАМАТИЧНЫЕ ТАКТИЧЕСКИЕ СХЕМЫ!)
    // ============================================================
    else if (picked === 'battlefield') {
        const variant = MB_PICK_NEXT_VARIANT('battlefield', ['redoubt', 'river_assault', 'wall_breach', 'convoy_ambush']);

        if (variant === 'redoubt') {
            genTitle = MB_PICK(['Штурм укреплённого редута', 'Позиции Псов Империи', 'Осадный рубеж']);
            // Изрытая землёй полоса наступления + полукруглый редут справа
            const rx = cols - 3, ry = rows / 2;
            const rad = Math.min(cols * 0.42, rows * 0.58);
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                const d = Math.hypot(c - rx, r - ry);
                if (d < rad + 2.5 && d > rad - 2.2) setTile(c, r, T.dirt);
                else if (d < rad - 2.2) setTile(c, r, Math.random() < 0.35 ? T.dirt : T.grass);
                else if (Math.random() < 0.25) setTile(c, r, T.dirt);
            }
            // Плотная дуга баррикад и кольев (с тактическими проходами для штурма!)
            const steps = Math.max(7, Math.floor(rad * 1.45));
            for (let i = 0; i <= steps; i++) {
                if (i === Math.floor(steps / 2)) continue; // Центральный пролом
                const ang = Math.PI * 0.62 + (i / steps) * (Math.PI * 0.76);
                const bx = rx + Math.cos(ang) * rad, by = ry + Math.sin(ang) * rad;
                if (inBounds(Math.floor(bx), Math.floor(by))) {
                    const deg = Math.round((ang * 180) / Math.PI) + 90;
                    addObj(P.barricades, bx, by, 1.0, deg, 1.25);
                }
            }
            // Внутри редута: шатёр командира, флаг, осадные баллисты/пушки, костёр
            addObj(P.campTents, cols - 3.2, ry, 1.1, 270, 2.0);
            addObj(P.flags, cols - 4.8, ry - 1.5, 1.0, 0, 0.8);
            addObj(P.siege, rx - rad * 0.55, ry - 2.4, 1.05, 180, 1.7);
            addObj(P.siege, rx - rad * 0.55, ry + 2.4, 1.05, 180, 1.7);
            // Со стороны атакующих: сломанный таран, воронки с огнём, щиты, мечи
            addObj('camp_batteringrambroken', Math.max(3.5, rx - rad - 2.5), ry, 1.15, 0, 1.8);
            addObj(P.battleFire, Math.max(3.0, rx - rad - 1.5), ry - 2.8, 0.85, 0, 1.2);
            addObj(P.battleFire, Math.max(3.0, rx - rad - 1.8), ry + 2.8, 0.85, 0, 1.2);
            addObj(P.campTents, 2.8, 2.8, 0.95, 20, 1.8);
        }
        else if (variant === 'river_assault') {
            genTitle = MB_PICK(['Битва за переправу', 'Штурм речного моста', 'Кровавый брод']);
            const midX = Math.floor(cols / 2), midY = Math.floor(rows / 2);
            fillRect(midX - 1, 0, midX + 1, rows - 1, T.water);
            fillRect(0, midY - 1, cols - 1, midY + 1, T.dirt);
            fillRect(midX - 1, midY - 1, midX + 1, midY + 1, T.water);
            addObj(P.stoneBridges, midX + 0.5, midY + 0.5, 1.25, 0, 2.2);

            // Правый берег — укрепления, левый — осадная батарея
            for (let r = 2; r < rows - 2; r += 2.3) {
                if (Math.abs(r - midY) < 1.5) continue;
                addObj(P.barricades, midX + 3.0, r + 0.5, 0.98, 270, 1.2);
            }
            addObj(P.siege, midX + 5.2, midY - 2.8, 1.05, 180, 1.8);
            addObj(P.siege, midX + 5.2, midY + 2.8, 1.05, 180, 1.8);
            addObj(P.flags, midX + 4.4, midY + 0.5, 1.0, 0, 0.8);

            addObj(P.siege, Math.max(2.5, midX - 4.8), midY - 2.2, 1.05, 0, 1.8);
            addObj(P.campTents, 2.5, rows - 2.6, 1.0, 10, 1.8);
            addObj(P.battleFire, midX - 2.2, midY + 1.8, 0.8, 0, 1.1);
            addObj(P.battleFire, midX + 2.6, midY - 1.6, 0.8, 0, 1.1);
        }
        else if (variant === 'wall_breach') {
            genTitle = MB_PICK(['Пролом в крепостной стене', 'Осада цитадели', 'Штурм бастиона']);
            const wx = Math.floor(cols * 0.58), midY = Math.floor(rows / 2);
            // Справа — мощёный двор крепости, слева — изрытое поле осады
            fillRect(wx, 0, cols - 1, rows - 1, T.flagstone);
            fillRect(0, 0, wx - 1, rows - 1, T.dirt);
            for (let r = 0; r < rows; r++) {
                if (Math.abs(r - midY) > 2) { setTile(wx, r, T.wall); setTile(wx + 1, r, T.wall); }
            }
            // Завалы и горящие обломки в самом проломе
            addObj(P.dungCollapsed, wx + 0.8, midY - 1.8, 1.05, 90, 1.4);
            addObj(P.dungCollapsed, wx + 0.8, midY + 2.1, 1.05, 270, 1.4);
            addObj(P.battleFire, wx - 0.8, midY + 0.2, 0.85, 0, 1.1);
            // За проломом — спешные баррикады защитников
            addObj(P.barricades, wx + 3.8, midY - 1.5, 1.0, 270, 1.3);
            addObj(P.barricades, wx + 3.8, midY + 1.5, 1.0, 270, 1.3);
            addObj(P.siege, Math.min(cols - 2.5, wx + 5.6), midY, 1.0, 180, 1.6);
            // Снаружи — катапульты и пушки штурмующих
            addObj(P.siege, 3.4, midY - 3.0, 1.1, 0, 1.9);
            addObj(P.siege, 3.4, midY + 3.0, 1.1, 0, 1.9);
            addObj('camp_batteringrambroken', wx - 3.6, midY + 0.4, 1.1, 12, 1.6);
        }
        else {
            genTitle = MB_PICK(['Засада на обоз в лесу', 'Разгромленный караван', 'Бой на лесной дороге']);
            let py = Math.floor(rows / 2);
            for (let c = 0; c < cols; c++) {
                if (c % 5 === 0 && Math.random() < 0.6) py = Math.max(3, Math.min(rows - 4, py + MB_RAND_INT(-1, 1)));
                fillRect(c, py - 1, c, py + 1, T.dirt);
            }
            const cx = Math.floor(cols / 2);
            // Остановленные повозки + рассыпанные ящики/бочки + очаги огня
            addObj(P.cityCarts, cx - 2.2, py, 1.05, 15, 1.7);
            addObj(P.cityCarts, cx + 2.4, py + 0.4, 1.05, -22, 1.7);
            addObj(P.battleFire, cx + 0.2, py - 0.5, 0.78, 0, 1.0);
            addObj(P.tavCrates, cx - 0.5, py + 1.3, 0.85, 35, 0.8);
            addObj(P.tavBarrels, cx + 1.2, py - 1.3, 0.85, 12, 0.8);
            addObj(P.barricades, cx - 5.2, py, 1.0, 90, 1.3);
            // Деревья и камни укрытий по обе стороны дороги
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                if (getTile(c, r) !== T.grass || !canPlace(c + 0.5, r + 0.5, 1.7)) continue;
                const rnd = Math.random();
                if (rnd < 0.17) addObj(P.greenTrees, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.85, 1.2), MB_RAND_INT(0, 359), 1.6);
                else if (rnd < 0.26) addObj(P.forestRocks, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.8, 1.15), MB_RAND_INT(0, 359), 1.1);
                else if (rnd < 0.34) addObj(P.greenBushes, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.75, 1.05), MB_RAND_INT(0, 359), 0.9);
            }
        }

        // Разбросанное оружие, щиты и воронки на всех боевых картах
        for (let i = 0; i < Math.floor((cols * rows) / 26); i++) {
            const fx = MB_RAND_FLOAT(2, cols - 2), fy = MB_RAND_FLOAT(1.5, rows - 1.5);
            if (getTile(Math.floor(fx), Math.floor(fy)) === T.wall || getTile(Math.floor(fx), Math.floor(fy)) === T.water) continue;
            if (!canPlace(fx, fy, 1.25)) continue;
            addObj(Math.random() < 0.65 ? P.battleLoot : P.dungRubble, fx, fy, 0.82, MB_RAND_INT(0, 359), 0.85);
        }
        MB_APPLY_RANDOM_MIRROR(data, true, true);
    }

    // ============================================================
    // 4. 🌲 ДИКИЙ ЛЕС (4 ПЛАНИРОВКИ + РАЗНЫЕ СЕЗОНЫ)
    // ============================================================
    else if (picked === 'forest') {
        const variant = MB_PICK_NEXT_VARIANT('forest', ['river', 'crossroads', 'ruins', 'lake_island']);
        const isAutumn = Math.random() < 0.28;
        const leafTile = isAutumn ? T.leafR : T.leafG;
        if (isAutumn) { window._mbLighting = 'sunset'; data.lighting = 'sunset'; }

        for (let i = 0; i < Math.floor((cols * rows) / 14); i++) {
            const lx = MB_RAND_INT(1, cols - 2), ly = MB_RAND_INT(1, rows - 2);
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (Math.random() < 0.55) setTile(lx + dc, ly + dr, leafTile);
        }

        if (variant === 'river') {
            genTitle = isAutumn ? 'Осенняя переправа' : MB_PICK(['Лесная переправа', 'Тропа через реку', 'Чаща у брода']);
            let rx = MB_RAND_INT(Math.floor(cols * 0.32), Math.floor(cols * 0.68));
            const rW = cols >= 26 ? 3 : 2;
            for (let r = 0; r < rows; r++) {
                if (Math.random() < 0.45) rx = Math.max(3, Math.min(cols - rW - 3, rx + MB_RAND_INT(-1, 1)));
                for (let w = 0; w < rW; w++) setTile(rx + w, r, T.water);
            }
            let py = MB_RAND_INT(Math.floor(rows * 0.3), Math.floor(rows * 0.68)), br = null;
            for (let c = 0; c < cols; c++) {
                if (Math.random() < 0.22) py = Math.max(2, Math.min(rows - 3, py + MB_RAND_INT(-1, 1)));
                for (let dy = 0; dy <= 1; dy++) {
                    if (getTile(c, py + dy) === T.water) { if (!br) br = { x: c + rW * 0.5, y: py + 0.9 }; }
                    else setTile(c, py + dy, T.dirt);
                }
            }
            if (br) addObj(Math.random() < 0.5 ? P.woodBridges : P.stoneBridges, br.x, br.y, rW >= 3 ? 1.2 : 1.0, 0, 2.2);
        } else if (variant === 'crossroads') {
            genTitle = isAutumn ? 'Осенний перекрёсток' : 'Лесной тракт и лагерь';
            const mx = Math.floor(cols / 2), my = Math.floor(rows / 2);
            fillRect(0, my - 1, cols - 1, my, T.dirt);
            fillRect(mx - 1, 0, mx, rows - 1, T.dirt);
            const cx = mx + 3.4, cy = my - 3.2;
            if (inBounds(Math.floor(cx), Math.floor(cy))) {
                fillRect(Math.floor(cx) - 1, Math.floor(cy) - 1, Math.floor(cx) + 1, Math.floor(cy) + 1, T.dirt);
                addObj(P.campfires, cx, cy, 1.0, 0, 1.5);
                addObj(P.campTents, cx + 1.9, cy - 0.7, 0.95, -20, 1.8);
                addObj(P.campGear, cx - 1.3, cy + 0.9, 0.85, 45, 1.0);
            }
        } else if (variant === 'ruins') {
            genTitle = 'Заросшие руины в чаще';
            const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
            for (let r = cy - 3; r <= cy + 3; r++) for (let c = cx - 4; c <= cx + 4; c++) if (Math.random() < 0.72) setTile(c, r, T.stone);
            addObj(P.dungRubble, cx - 2.6, cy - 1.8, 1.1, 0, 1.3);
            addObj(P.dungRubble, cx + 2.6, cy + 1.8, 1.1, 90, 1.3);
            addObj(P.dungPillars, cx - 2.2, cy + 1.8, 0.95, 0, 1.0);
            addObj(P.dungPillars, cx + 2.2, cy - 1.8, 0.95, 0, 1.0);
            addObj(P.campfires, cx + 0.5, cy + 0.5, 1.0, 0, 1.4);
            addObj(P.dungChests, cx + 1.8, cy + 0.2, 0.85, 0, 1.0);
        } else {
            genTitle = 'Лесное озеро с островком';
            const cx = cols / 2, cy = rows / 2;
            const rad = Math.min(cols, rows) * 0.34;
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                const d = Math.hypot((c - cx) * 0.82, r - cy);
                if (d < rad && d > rad * 0.42) setTile(c, r, T.water);
                else if (d <= rad * 0.42) setTile(c, r, T.grass);
            }
            addObj(P.woodBridges, cx - rad * 0.72, cy, 0.95, 0, 1.8);
            addObj(P.campfires, cx, cy, 1.0, 0, 1.4);
            addObj(P.dungChests, cx + 1.2, cy - 0.8, 0.85, 0, 0.9);
        }

        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const t = getTile(c, r);
            if (t === T.water) {
                if (canPlace(c + 0.5, r + 0.5, 1.2) && Math.random() < 0.14) addObj(P.waterDec, c + 0.5, r + 0.5, 0.9, MB_RAND_INT(0, 359), 0.8);
                continue;
            }
            if (t !== T.grass && t !== leafTile) continue;
            const ox = c + MB_RAND_FLOAT(0.2, 0.8), oy = r + MB_RAND_FLOAT(0.2, 0.8);
            if (!canPlace(ox, oy, 1.4)) continue;
            const rnd = Math.random();
            if (rnd < 0.15) addObj(P.greenTrees, ox, oy, MB_RAND_FLOAT(0.85, 1.28), MB_RAND_INT(0, 359), 1.65);
            else if (rnd < 0.25) addObj(isAutumn && Math.random() < 0.5 ? P.autumnBushes : P.greenBushes, ox, oy, MB_RAND_FLOAT(0.75, 1.12), MB_RAND_INT(0, 359), 0.95);
            else if (rnd < 0.30) addObj(P.forestFlower, ox, oy, MB_RAND_FLOAT(0.7, 1.0), MB_RAND_INT(0, 359), 0.7);
            else if (rnd < 0.34) addObj(P.forestRocks, ox, oy, MB_RAND_FLOAT(0.75, 1.1), MB_RAND_INT(0, 359), 1.05);
            else if (rnd < 0.365) addObj(P.forestLogs, ox, oy, MB_RAND_FLOAT(0.8, 1.05), MB_RAND_INT(0, 359), 1.1);
            else if (rnd < 0.38) addObj(P.forestFungi, ox, oy, 0.75, MB_RAND_INT(0, 359), 0.6);
        }
        MB_APPLY_RANDOM_MIRROR(data, true, true);
    }

    // ============================================================
    // 5. 🏰 ПОДЗЕМЕЛЬЕ (3 ПРИНЦИПИАЛЬНО РАЗНЫХ ТИПА!)
    // ============================================================
    else if (picked === 'dungeon') {
        const variant = MB_PICK_NEXT_VARIANT('dungeon', ['rooms', 'crypt_hall', 'chasm_bridge']);
        const floorT = Math.random() < 0.5 ? T.stone : T.flagstone;

        if (variant === 'rooms') {
            genTitle = MB_PICK(['Забытые катакомбы', 'Тайные казематы', 'Подземелье Ошибки']);
            const rooms = [];
            const attempts = Math.max(10, Math.floor((cols * rows) / 18));
            for (let a = 0; a < attempts; a++) {
                const rw = MB_RAND_INT(4, Math.min(9, Math.max(5, Math.floor(cols / 2.6))));
                const rh = MB_RAND_INT(4, Math.min(8, Math.max(5, Math.floor(rows / 2.4))));
                const rx = MB_RAND_INT(1, Math.max(1, cols - rw - 2));
                const ry = MB_RAND_INT(1, Math.max(1, rows - rh - 2));
                const overlaps = rooms.some(rm => rx <= rm.x + rm.w + 1 && rx + rw + 1 >= rm.x && ry <= rm.y + rm.h + 1 && ry + rh + 1 >= rm.y);
                if (!overlaps) {
                    rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: rx + rw / 2, cy: ry + rh / 2 });
                    fillRect(rx, ry, rx + rw - 1, ry + rh - 1, floorT);
                }
            }
            const corrW = cols >= 26 ? 2 : 1;
            for (let i = 1; i < rooms.length; i++) {
                const p = rooms[i - 1], n = rooms[i];
                let x = Math.floor(p.cx), y = Math.floor(p.cy), tx = Math.floor(n.cx), ty = Math.floor(n.cy);
                while (x !== tx) { for (let d = 0; d < corrW; d++) setTile(x, y + d, floorT); x += (tx > x ? 1 : -1); }
                while (y !== ty) { for (let d = 0; d < corrW; d++) setTile(x + d, y, floorT); y += (ty > y ? 1 : -1); }
            }
            const hazard = MB_PICK([T.lava, T.water, T.abyss]);
            rooms.forEach((rm, idx) => {
                addObj(P.dungBraziers, rm.x + 0.8, rm.y + 0.8, 0.85, 0, 0.8);
                if (rm.w >= 5) addObj(P.dungBraziers, rm.x + rm.w - 0.8, rm.y + rm.h - 0.8, 0.85, 0, 0.8);
                if (Math.random() < 0.7) addObj(P.dungWebs, rm.x + rm.w - 0.55, rm.y + 0.55, 0.9, MB_RAND_INT(0, 359), 0);
                if (idx === 0) addObj(P.stoneStairs, rm.cx, rm.cy, 0.85, 0, 1.2);
                else if (idx === rooms.length - 1) {
                    addObj(P.tavRugs, rm.cx, rm.cy, 1.2, 0, 0);
                    addObj(P.dungAltars, rm.cx, rm.cy, 1.1, 0, 1.3);
                    addObj(P.dungChests, rm.cx + 1.4, rm.cy - 0.4, 0.85, 0, 0.9);
                } else {
                    const th = Math.random();
                    if (th < 0.32 && rm.w >= 5 && rm.h >= 5) {
                        fillRect(Math.floor(rm.cx) - 1, Math.floor(rm.cy) - 1, Math.floor(rm.cx), Math.floor(rm.cy), hazard);
                        addObj(P.dungPillars, rm.x + 1.2, rm.y + 1.2, 0.9, 0, 0.8);
                        addObj(P.dungPillars, rm.x + rm.w - 1.2, rm.y + 1.2, 0.9, 0, 0.8);
                    } else if (th < 0.65) {
                        addObj(P.dungBones, rm.cx, rm.cy, 0.95, MB_RAND_INT(0, 359), 0.9);
                        addObj(P.dungChests, rm.x + rm.w - 1.1, rm.cy, 0.85, MB_PICK([0, 90, 180]), 0.9);
                    } else {
                        addObj(P.tavCrates, rm.cx - 0.8, rm.cy, 0.85, 20, 0.8);
                        addObj(P.dungRubble, rm.cx + 0.8, rm.cy + 0.4, 0.85, 0, 0.8);
                    }
                }
            });
        }
        else if (variant === 'crypt_hall') {
            genTitle = MB_PICK(['Зал Саркофагов', 'Древняя усыпальница', 'Колонный склеп']);
            fillRect(2, 2, cols - 3, rows - 3, floorT);
            const midY = Math.floor(rows / 2);
            // Вход с лестницей слева и алтарь справа
            fillRect(0, midY - 1, 2, midY + 1, floorT);
            addObj(P.stoneStairs, 1.5, midY + 0.5, 0.9, 90, 1.4);
            addObj(P.dungAltars, cols - 3.6, midY + 0.5, 1.2, 270, 1.6);
            addObj(P.dungChests, cols - 4.8, midY - 1.5, 0.85, 0, 0.9);
            // Симметричные колонны, жаровни и ниши с гробницами
            for (let c = 5; c <= cols - 6; c += 4) {
                addObj(P.dungPillars, c, 4.2, 1.0, 0, 1.0);
                addObj(P.dungPillars, c, rows - 4.2, 1.0, 0, 1.0);
                addObj(P.dungBraziers, c, 2.8, 0.8, 0, 0.7);
                addObj(P.dungBraziers, c, rows - 2.8, 0.8, 0, 0.7);
                addObj(P.dungAltars, c + 2, 2.9, 0.9, 0, 1.1);
                addObj(P.dungAltars, c + 2, rows - 2.9, 0.9, 180, 1.1);
            }
            addObj(P.dungBones, cols / 2, midY + 0.5, 1.0, 35, 0.9);
            addObj(P.dungWebs, 2.7, 2.7, 1.0, 0, 0);
            addObj(P.dungWebs, cols - 2.7, rows - 2.7, 1.0, 180, 0);
        }
        else {
            genTitle = MB_PICK(['Разлом над бездной', 'Огненная переправа', 'Подземный провал']);
            const pit = Math.random() < 0.55 ? T.lava : T.abyss;
            fillRect(1, 1, cols - 2, rows - 2, floorT);
            const midX = Math.floor(cols / 2), midY = Math.floor(rows / 2);
            for (let r = 1; r < rows - 1; r++) {
                const shift = Math.round(Math.sin(r * 0.5) * 1.5);
                fillRect(midX - 2 + shift, r, midX + 2 + shift, r, pit);
            }
            addObj(P.stoneBridges, midX + 0.5, midY + 0.5, 1.35, 0, 2.4);
            addObj(P.dungBraziers, midX - 3.0, midY - 1.5, 0.9, 0, 0.8);
            addObj(P.dungBraziers, midX - 3.0, midY + 2.0, 0.9, 0, 0.8);
            addObj(P.dungBraziers, midX + 3.8, midY - 1.5, 0.9, 0, 0.8);
            addObj(P.dungBraziers, midX + 3.8, midY + 2.0, 0.9, 0, 0.8);
            addObj(P.dungAltars, cols - 3.2, midY + 0.5, 1.15, 270, 1.5);
            addObj(P.dungChests, cols - 3.2, 2.8, 0.9, 0, 0.9);
            addObj(P.dungRubble, 3.0, 2.8, 1.0, 20, 1.0);
            addObj(P.dungBones, 3.5, rows - 3.0, 1.0, 120, 1.0);
        }
        MB_APPLY_RANDOM_MIRROR(data, true, true);
    }

    // ============================================================
    // 6. 🏛️ ОСОБНЯК (3 ПЛАНИРОВКИ)
    // ============================================================
    else if (picked === 'mansion') {
        const variant = MB_PICK_NEXT_VARIANT('mansion', ['throne', 'library', 'suites']);
        const midY = Math.floor(rows / 2);
        fillRect(1, 1, cols - 2, rows - 2, T.flagstone);
        fillRect(3, 3, cols - 4, rows - 4, T.wood);
        setTile(0, midY, T.flagstone);
        addObj(P.doubleDoors, 0.5, midY + 0.5, 0.9, 90, 1.3);

        if (variant === 'throne') {
            genTitle = 'Тронный зал Министра';
            for (let c = 3; c <= cols - 4; c += 2.6) addObj(P.tavRugs, c, midY + 0.5, 1.15, 0, 0);
            addObj('furniture_chair_throne_stone', cols - 2.4, midY + 0.5, 1.15, 270, 1.6);
            for (let c = 4; c < cols - 3; c += 5) addObj(P.manLights, c, midY + 0.5, 1.05, 0, 0);
            for (let c = 2.6; c <= cols - 3.2; c += 3.4) {
                addObj(P.dungPillars, c, 2.4, 0.9, 0, 0.9);
                addObj(P.dungPillars, c, rows - 2.4, 0.9, 0, 0.9);
                addObj(P.manFeatures, c + 1.5, 1.6, 0.85, 0, 1.1);
                addObj(P.manChairs, c + 1.5, rows - 1.6, 0.85, 180, 1.1);
            }
        } else if (variant === 'library') {
            genTitle = 'Великая библиотека и обсерватория';
            addObj(P.manLights, cols / 2, midY + 0.5, 1.15, 0, 0);
            addObj(P.tavRugs, cols / 2, midY + 0.5, 1.35, 0, 0);
            addObj('other_feature_orrery_huge_gold', cols - 3.8, midY + 0.5, 1.05, 0, 1.8);
            for (let c = 3; c <= cols - 7; c += 3.4) {
                addObj(P.manBooks, c, 2.1, 0.95, 0, 1.2);
                addObj(P.manBooks, c, rows - 2.1, 0.95, 180, 1.2);
            }
            addObj('furniture_table_writing_desk_dark', cols / 2 - 2.0, midY + 0.5, 1.0, 0, 1.4);
            addObj(P.manChairs, cols / 2 - 2.0, midY + 1.5, 0.85, 0, 0.8);
            addObj(P.manCats, cols / 2 + 1.2, midY + 1.5, 0.78, 45, 0);
        } else {
            genTitle = 'Апартаменты аристократа';
            const splitX = Math.floor(cols * 0.52);
            for (let r = 1; r < rows - 1; r++) if (r !== midY) setTile(splitX, r, T.wall);
            addObj(P.doors, splitX + 0.5, midY + 0.5, 0.9, 90, 1.1);
            // Гостиная слева, спальня и кабинет справа
            addObj(P.tavRugs, splitX / 2, midY + 0.5, 1.2, 0, 0);
            addObj(P.manLights, splitX / 2, midY + 0.5, 1.0, 0, 0);
            placeTavernTableSet(splitX / 2, midY + 0.5, true);
            addObj(P.tavFireplace, splitX / 2, 1.6, 1.0, 0, 1.3);
            addObj(P.tavBeds, cols - 2.6, 2.6, 1.05, 270, 1.5);
            addObj(P.manFeatures, cols - 3.0, rows - 2.6, 0.95, 0, 1.5);
            addObj(P.manBooks, splitX + 2.0, 2.0, 0.9, 0, 1.1);
            addObj(P.manLights, (splitX + cols) / 2, midY + 0.5, 0.95, 0, 0);
        }
        MB_APPLY_RANDOM_MIRROR(data, true, false);
    }

    // ============================================================
    // 7. ⚒️ КУЗНИЦА ДВАРФОВ (2 ПЛАНИРОВКИ)
    // ============================================================
    else if (picked === 'dwarven') {
        const variant = MB_PICK_NEXT_VARIANT('dwarven', ['lava_forge', 'vault']);
        fillRect(1, 1, cols - 2, rows - 2, T.flagstone);
        const midY = Math.floor(rows / 2);

        if (variant === 'lava_forge') {
            genTitle = 'Великая Кузница Дварфов';
            for (let c = 2; c < cols - 2; c++) { setTile(c, 1, T.lava); setTile(c, rows - 2, T.lava); }
            for (let c = 4; c < cols - 3; c += 4.5) {
                addObj(P.dwForge, c, midY - 1.2, 1.1, 0, 1.5);
                addObj(P.dwLoot, c + 1.2, midY + 1.2, 0.95, MB_RAND_INT(0, 359), 1.1);
                addObj(P.dungPillars, c, 2.9, 0.95, 0, 0.9);
                addObj(P.dungPillars, c, rows - 2.9, 0.95, 0, 0.9);
            }
            addObj(P.dwStatues, cols - 2.5, midY + 0.5, 1.25, 270, 1.6);
        } else {
            genTitle = 'Подгорная сокровищница и оружейная';
            fillRect(Math.floor(cols / 2) - 2, midY - 2, Math.floor(cols / 2) + 2, midY + 2, T.lava);
            addObj(P.dwStatues, cols / 2, midY + 0.5, 1.3, 0, 1.8);
            for (let c = 3; c < cols - 3; c += 4) {
                addObj(P.dungChests, c, 2.2, 0.9, 0, 1.0);
                addObj(P.dwLoot, c, rows - 2.2, 0.95, MB_RAND_INT(0, 359), 1.0);
                addObj(P.dungBraziers, c + 1.8, 2.2, 0.8, 0, 0.7);
                addObj(P.dungBraziers, c + 1.8, rows - 2.2, 0.8, 0, 0.7);
            }
        }
        MB_APPLY_RANDOM_MIRROR(data, true, false);
    }

    // ============================================================
    // 8. 🏴‍☠️ ПИРАТСКАЯ БУХТА (2 ПЛАНИРОВКИ)
    // ============================================================
    else if (picked === 'pirate') {
        const variant = MB_PICK_NEXT_VARIANT('pirate', ['coast', 'lagoon']);
        if (variant === 'coast') {
            genTitle = 'Бухта Контрабандистов';
            let shore = Math.floor(cols * 0.46);
            for (let r = 0; r < rows; r++) {
                if (Math.random() < 0.5) shore = Math.max(4, Math.min(cols - 5, shore + MB_RAND_INT(-1, 1)));
                for (let c = 0; c < shore; c++) setTile(c, r, T.water);
                for (let c = shore + 4; c < cols; c++) if (Math.random() < 0.7) setTile(c, r, T.grass);
            }
            const pierY = Math.floor(rows / 2);
            addObj(P.woodBridges, shore - 0.5, pierY + 0.5, 1.1, 0, 2.0);
            addObj(P.boats, Math.max(2, shore - 3.2), pierY + 2.2, 1.1, -20, 1.5);
            addObj(P.campfires, shore + 2.5, pierY - 1.5, 1.0, 0, 1.4);
            addObj(P.pirateLoot, shore + 3.8, pierY + 0.8, 1.0, 30, 1.0);
            addObj(P.tavBarrels, shore + 2.2, pierY + 1.8, 0.85, 0, 0.8);
        } else {
            genTitle = 'Остров Сокровищ';
            fillRect(0, 0, cols - 1, rows - 1, T.water);
            const cx = cols / 2, cy = rows / 2, rx = cols * 0.36, ry = rows * 0.36;
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                const d = Math.hypot((c - cx) / rx, (r - cy) / ry);
                if (d < 0.58) setTile(c, r, T.grass);
                else if (d < 1.0) setTile(c, r, T.sand);
            }
            addObj(P.boats, 2.5, cy, 1.1, 15, 1.5);
            addObj(P.campfires, cx, cy, 1.05, 0, 1.5);
            addObj(P.pirateLoot, cx + 1.6, cy - 0.8, 1.0, 20, 1.0);
            addObj(P.pirateLoot, cx - 1.6, cy + 1.0, 0.95, 140, 1.0);
        }
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const t = getTile(c, r);
            if (!canPlace(c + 0.5, r + 0.5, 1.5)) continue;
            if (t === T.grass && Math.random() < 0.24) addObj(P.palms, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.85, 1.2), MB_RAND_INT(0, 359), 1.7);
            else if (t === T.sand && Math.random() < 0.14) addObj(Math.random() < 0.7 ? P.beachLife : P.pirateLoot, c + 0.5, r + 0.5, 0.9, MB_RAND_INT(0, 359), 1.0);
        }
        MB_APPLY_RANDOM_MIRROR(data, true, true);
    }

    // ============================================================
    // 9. 🏜️ ПУСТЫНЯ (2 ПЛАНИРОВКИ)
    // ============================================================
    else if (picked === 'desert') {
        const variant = MB_PICK_NEXT_VARIANT('desert', ['oasis', 'ruins']);
        if (variant === 'oasis') {
            genTitle = 'Оазис и стоянка каравана';
            const ox = MB_RAND_INT(Math.floor(cols * 0.36), Math.floor(cols * 0.64));
            const oy = MB_RAND_INT(Math.floor(rows * 0.35), Math.floor(rows * 0.65));
            const rad = Math.max(2.0, Math.min(cols, rows) * 0.22);
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                const d = Math.hypot(c - ox, r - oy);
                if (d < rad) setTile(c, r, T.water);
                else if (d < rad + 1.5) setTile(c, r, T.grass);
            }
            for (let a = 0; a < 7; a++) {
                const ang = (a / 7) * Math.PI * 2 + 0.2;
                const px = ox + Math.cos(ang) * (rad + 1.3), py = oy + Math.sin(ang) * (rad + 1.3);
                if (inBounds(Math.floor(px), Math.floor(py)) && canPlace(px, py, 1.6)) addObj(P.palms, px, py, MB_RAND_FLOAT(0.85, 1.15), MB_RAND_INT(0, 359), 1.5);
            }
            const tx = ox > cols / 2 ? 3.5 : cols - 3.5, ty = oy > rows / 2 ? 3.5 : rows - 3.5;
            addObj(P.desertTents, tx, ty, 0.9, -20, 2.4);
            addObj('camp_desert_campfire_1x1', tx + (ox > tx ? 2.4 : -2.4), ty + 0.5, 1.0, 0, 1.3);
        } else {
            genTitle = 'Занесённые песком руины';
            const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
            for (let r = cy - 3; r <= cy + 3; r++) for (let c = cx - 4; c <= cx + 4; c++) if (Math.random() < 0.65) setTile(c, r, T.flagstone);
            addObj(P.dungAltars, cx + 0.5, cy + 0.5, 1.2, 0, 1.6);
            addObj(P.dungPillars, cx - 3, cy - 2, 1.0, 0, 1.1);
            addObj(P.dungPillars, cx + 3, cy - 2, 1.0, 0, 1.1);
            addObj(P.dungPillars, cx - 3, cy + 2, 1.0, 0, 1.1);
            addObj(P.dungPillars, cx + 3, cy + 2, 1.0, 0, 1.1);
            addObj(P.dungChests, cx + 1.8, cy + 0.5, 0.85, 0, 0.9);
            addObj('camp_desert_campfire_1x1', cx - 2.0, cy + 0.5, 1.0, 0, 1.2);
        }
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            if (getTile(c, r) !== T.sand || !canPlace(c + 0.5, r + 0.5, 1.5)) continue;
            const rnd = Math.random();
            if (rnd < 0.09) addObj(P.desertCacti, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.8, 1.1), MB_RAND_INT(0, 359), 1.2);
            else if (rnd < 0.14) addObj(P.desertRocks, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.8, 1.15), MB_RAND_INT(0, 359), 1.3);
            else if (rnd < 0.16) addObj(P.desertProps, c + 0.5, r + 0.5, 0.9, MB_RAND_INT(0, 359), 1.0);
        }
        MB_APPLY_RANDOM_MIRROR(data, true, true);
    }

    // ============================================================
    // 10. 🍄 ФЕЙСКИЙ ЛЕС (2 ПЛАНИРОВКИ)
    // ============================================================
    else if (picked === 'fey') {
        const variant = MB_PICK_NEXT_VARIANT('fey', ['pond', 'circle']);
        const cx = cols / 2, cy = rows / 2;
        if (variant === 'pond') {
            genTitle = 'Фейское озеро и трон';
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                const d = Math.hypot((c - cx) * 0.85, r - cy);
                if (d < 2.4) setTile(c, r, T.water);
                else if (d < 4.8 && Math.random() < 0.5) setTile(c, r, T.leafG);
            }
            addObj('furniture_feythrone', cx, cy - 2.8, 1.15, 0, 1.6);
        } else {
            genTitle = 'Кристальный круг грибной рощи';
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                if (Math.hypot(c - cx, r - cy) < 4.5 && Math.random() < 0.6) setTile(c, r, T.leafG);
            }
            for (let a = 0; a < 6; a++) {
                const ang = (a / 6) * Math.PI * 2;
                addObj(P.feyCrystals, cx + Math.cos(ang) * 3.2, cy + Math.sin(ang) * 2.6, 1.0, 0, 1.2);
            }
            addObj('furniture_feythrone', cx, cy, 1.15, 0, 1.6);
        }
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const t = getTile(c, r);
            if (t === T.water) { if (Math.random() < 0.25 && canPlace(c + 0.5, r + 0.5, 1.0)) addObj(P.waterDec, c + 0.5, r + 0.5, 0.9, MB_RAND_INT(0, 359), 0.8); continue; }
            const ox = c + MB_RAND_FLOAT(0.2, 0.8), oy = r + MB_RAND_FLOAT(0.2, 0.8);
            if (!canPlace(ox, oy, 1.45)) continue;
            const rnd = Math.random();
            if (rnd < 0.16) addObj(P.feyTrees, ox, oy, MB_RAND_FLOAT(0.85, 1.25), MB_RAND_INT(0, 359), 1.7);
            else if (rnd < 0.30) addObj(P.feyFungi, ox, oy, MB_RAND_FLOAT(0.75, 1.25), MB_RAND_INT(0, 359), 0.95);
            else if (rnd < 0.37) addObj(P.feyDecor, ox, oy, MB_RAND_FLOAT(0.8, 1.15), MB_RAND_INT(0, 359), 1.0);
            else if (rnd < 0.40) addObj(P.feyCrystals, ox, oy, 0.85, MB_RAND_INT(0, 359), 1.0);
        }
    }

    // ============================================================
    // 11. ⛩️ ВОСТОЧНЫЙ ХРАМ / ДОДЗЁ (2 ПЛАНИРОВКИ)
    // ============================================================
    else if (picked === 'eastern') {
        const variant = MB_PICK_NEXT_VARIANT('eastern', ['dojo', 'garden_shrine']);
        const midY = Math.floor(rows / 2);
        if (variant === 'dojo') {
            genTitle = 'Восточное додзё';
            const x1 = 2, x2 = cols - 3, y1 = 2, y2 = rows - 3;
            boxRoom(x1, y1, x2, y2, T.wood, T.wall);
            setTile(x1, midY, T.wood);
            addObj(P.eastDoors, x1 + 0.5, midY + 0.5, 0.9, 90, 1.2);
            for (let c = x1 + 3; c <= x2 - 3; c += 2.6) addObj(P.eastMats, c, midY + 0.5, 1.05, 0, 0);
            addObj('other_shrine_1', x2 - 1.4, midY + 0.5, 1.1, 270, 1.4);
            addObj(P.eastLights, x2 - 1.5, y1 + 1.5, 0.85, 0, 0.8);
            addObj(P.eastLights, x2 - 1.5, y2 - 1.5, 0.85, 0, 0.8);
            for (let c = x1 + 2.8; c <= x2 - 3; c += 3.5) {
                addObj(P.eastTables, c, y1 + 1.8, 0.9, 0, 1.3);
                addObj(P.eastDecor, c, y2 - 1.6, 0.9, 180, 1.3);
            }
        } else {
            genTitle = 'Храм Тихого Лотоса и пруд';
            const x1 = Math.floor(cols * 0.45), x2 = cols - 2, y1 = 2, y2 = rows - 3;
            boxRoom(x1, y1, x2, y2, T.wood, T.wall);
            setTile(x1, midY, T.wood);
            addObj(P.eastDoors, x1 + 0.5, midY + 0.5, 0.9, 90, 1.2);
            // Пруд с мостиком в саду слева
            fillRect(2, 2, x1 - 3, rows - 3, T.water);
            addObj(P.woodBridges, x1 - 3.0, midY + 0.5, 1.1, 0, 2.0);
            addObj(P.eastMats, (x1 + x2) / 2, midY + 0.5, 1.2, 0, 0);
            addObj('other_shrine_2', x2 - 1.5, midY + 0.5, 1.15, 270, 1.4);
            addObj(P.eastLights, x1 - 0.8, midY - 1.3, 0.85, 0, 0.8);
            addObj(P.eastLights, x1 - 0.8, midY + 1.8, 0.85, 0, 0);
            addObj(P.eastDecor, (x1 + x2) / 2, y1 + 1.8, 0.9, 0, 1.1);
            addObj(P.eastDecor, (x1 + x2) / 2, y2 - 1.8, 0.9, 180, 1.1);
        }
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            if (getTile(c, r) === T.grass && canPlace(c + 0.5, r + 0.5, 1.5) && Math.random() < 0.24) {
                addObj(Math.random() < 0.6 ? P.greenTrees : P.forestRocks, c + 0.5, r + 0.5, 0.88, MB_RAND_INT(0, 359), 1.4);
            }
        }
        MB_APPLY_RANDOM_MIRROR(data, true, false);
    }

    // ============================================================
    // 12. ⛺ ЛАГЕРЬ ОХОТНИКОВ / ОРКОВ (2 ПЛАНИРОВКИ)
    // ============================================================
    else if (picked === 'warcamp') {
        const variant = MB_PICK_NEXT_VARIANT('warcamp', ['circle', 'palisade']);
        const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
        if (variant === 'circle') {
            genTitle = 'Стойбище охотников';
            const radX = cols * 0.34, radY = rows * 0.35;
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                if (Math.hypot((c - cx) / radX, (r - cy) / radY) < 1.0) setTile(c, r, T.dirt);
            }
            addObj(P.campfires, cx + 0.5, cy + 0.5, 1.15, 0, 1.6);
            addObj('camp_totemlarge', cx - 1.8, cy - 1.2, 1.05, 0, 1.3);
            for (let a = 0; a < 5; a++) {
                const ang = (a / 5) * Math.PI * 2 + 0.3;
                const tx = cx + Math.cos(ang) * (radX * 0.72), ty = cy + Math.sin(ang) * (radY * 0.72);
                if (inBounds(Math.floor(tx), Math.floor(ty)) && canPlace(tx, ty, 2.2)) addObj(P.orcTents, tx, ty, 0.95, Math.round((ang * 180) / Math.PI) + 90, 2.0);
            }
        } else {
            genTitle = 'Укреплённый лагерь орков';
            fillRect(3, 2, cols - 4, rows - 3, T.dirt);
            for (let c = 3; c <= cols - 4; c += 2.2) {
                if (Math.abs(c - cx) > 2) addObj(P.barricades, c + 0.5, 2.0, 0.95, 0, 1.2);
                addObj(P.barricades, c + 0.5, rows - 2.0, 0.95, 180, 1.2);
            }
            addObj(P.campfires, cx + 0.5, cy + 0.5, 1.15, 0, 1.6);
            addObj(P.orcTents, 5.2, cy - 2.0, 1.0, 90, 2.0);
            addObj(P.orcTents, cols - 5.2, cy - 2.0, 1.0, 270, 2.0);
            addObj(P.orcTents, cols - 5.2, cy + 2.4, 1.0, 270, 2.0);
            addObj('camp_totemlarge', 5.2, cy + 2.2, 1.1, 0, 1.3);
        }
        for (let i = 0; i < Math.floor((cols * rows) / 20); i++) {
            const rx = MB_RAND_FLOAT(2, cols - 2), ry = MB_RAND_FLOAT(2, rows - 2);
            if (!canPlace(rx, ry, 1.4)) continue;
            if (getTile(Math.floor(rx), Math.floor(ry)) === T.dirt) addObj(P.orcProps, rx, ry, 0.92, MB_RAND_INT(0, 359), 1.15);
            else addObj(P.greenTrees, rx, ry, MB_RAND_FLOAT(0.85, 1.15), MB_RAND_INT(0, 359), 1.6);
        }
        MB_APPLY_RANDOM_MIRROR(data, true, true);
    }

    // ============================================================
    // 13. ❄️ СНЕЖНЫЙ ПЕРЕВАЛ (2 ПЛАНИРОВКИ + ЛЁД)
    // ============================================================
    else if (picked === 'snow') {
        const variant = MB_PICK_NEXT_VARIANT('snow', ['frozen_lake', 'mountain_pass']);
        if (variant === 'frozen_lake') {
            genTitle = 'Замёрзшее озеро и переправа';
            const px = cols * MB_RAND_FLOAT(0.38, 0.62), py = rows * MB_RAND_FLOAT(0.35, 0.65);
            const rad = Math.max(2.4, Math.min(cols, rows) * 0.25);
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                const d = Math.hypot(c - px, r - py);
                if (d < rad * 0.62) setTile(c, r, T.water);
                else if (d < rad) setTile(c, r, T.ice);
            }
            let ty = Math.floor(rows / 2), br = null;
            for (let c = 0; c < cols; c++) {
                if (Math.random() < 0.25) ty = Math.max(2, Math.min(rows - 3, ty + MB_RAND_INT(-1, 1)));
                if (getTile(c, ty) === T.water) { if (!br) br = { x: c + 1.2, y: ty + 0.5 }; }
                else if (getTile(c, ty) !== T.ice) setTile(c, ty, T.stone);
            }
            if (br) addObj(P.woodBridges, br.x, br.y, 1.1, 0, 2.0);
        } else {
            genTitle = 'Снежное ущелье и привал';
            const midY = Math.floor(rows / 2);
            fillRect(0, 0, cols - 1, 2, T.wall);
            fillRect(0, rows - 3, cols - 1, rows - 1, T.wall);
            fillRect(0, midY - 1, cols - 1, midY, T.stone);
        }
        const cx = Math.max(3.0, cols * 0.22), cy = Math.max(3.2, rows * 0.28);
        addObj(P.campfires, cx, cy, 1.1, 0, 1.5);
        addObj(P.campTents, cx - 1.3, cy + 1.2, 0.95, 20, 1.8);
        addObj(P.snowPelts, cx + 1.3, cy + 0.4, 0.95, 90, 1.0);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            if (getTile(c, r) !== T.snow || !canPlace(c + 0.5, r + 0.5, 1.55)) continue;
            const rnd = Math.random();
            if (rnd < 0.13) addObj(P.greenTrees, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.8, 1.15), MB_RAND_INT(0, 359), 1.6);
            else if (rnd < 0.22) addObj(P.snowRocks, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.8, 1.18), MB_RAND_INT(0, 359), 1.2);
        }
        MB_APPLY_RANDOM_MIRROR(data, true, true);
    }

    const titleInp = document.getElementById('mb-map-title-inp');
    if (titleInp) titleInp.value = genTitle;

    window._mbData = data;
    SAVE_MB_DATA(data);
    RENDER_GM_MAP_BUILDER_UI();
}

function MB_LOAD_TEMPLATE(type) { MB_GENERATE_RANDOM(type); }

// ================================================================
// 🖌️ СОБЫТИЯ ХОЛСТА
// ================================================================
function INIT_MB_CANVAS_EVENTS() {
    const canvas = document.getElementById('mb-editor-canvas');
    if (!canvas) return;

    const getCoords = (e) => {
        const rect = canvas.getBoundingClientRect();
        const px = (e.clientX - rect.left) * (canvas.width / rect.width);
        const py = (e.clientY - rect.top) * (canvas.height / rect.height);
        const data = window._mbData;
        return {
            gx: px / (canvas.width / data.cols),
            gy: py / (canvas.height / data.rows),
            col: Math.floor(px / (canvas.width / data.cols)),
            row: Math.floor(py / (canvas.height / data.rows))
        };
    };

    const deleteNearestObject = (gx, gy) => {
        const objs = window._mbData.objects || [];
        let bestIdx = -1, bestDist = 1.25;
        for (let i = objs.length - 1; i >= 0; i--) {
            const d = Math.hypot(objs[i].x - gx, objs[i].y - gy);
            if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
        if (bestIdx !== -1) {
            objs.splice(bestIdx, 1);
            SAVE_MB_DATA(window._mbData);
            DRAW_MB_CANVAS();
        }
    };

    const paintTerrain = (col, row) => {
        const data = window._mbData;
        if (col < 0 || col >= data.cols || row < 0 || row >= data.rows) return;
        if (window._mbTool === 'tile') {
            data.cells[row * data.cols + col].t = window._mbSelectedTile;
        } else if (window._mbTool === 'brush3') {
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                const nr = row + dr, nc = col + dc;
                if (nr >= 0 && nr < data.rows && nc >= 0 && nc < data.cols) data.cells[nr * data.cols + nc].t = window._mbSelectedTile;
            }
        }
        SAVE_MB_DATA(data);
        DRAW_MB_CANVAS();
    };

    canvas.onmousedown = function(e) {
        const pos = getCoords(e);
        if (e.button === 2 || window._mbTool === 'eraser') {
            MB_PUSH_UNDO();
            deleteNearestObject(pos.gx, pos.gy);
            return;
        }
        if (window._mbTool === 'stamp') {
            if (!window._mbSelectedStamp) return;
            MB_PUSH_UNDO();
            const px = window._mbSnapGrid ? (pos.col + 0.5) : pos.gx;
            const py = window._mbSnapGrid ? (pos.row + 0.5) : pos.gy;
            const rot = window._mbRandRot ? MB_RAND_INT(0, 359) : (window._mbStampRot || 0);
            window._mbData.objects.push({
                id: window._mbSelectedStamp,
                x: Math.round(px * 100) / 100,
                y: Math.round(py * 100) / 100,
                scale: window._mbStampScale || 1.0,
                rot
            });
            SAVE_MB_DATA(window._mbData);
            DRAW_MB_CANVAS();
            return;
        }
        MB_PUSH_UNDO();
        window._mbIsDrawing = true;
        paintTerrain(pos.col, pos.row);
    };

    canvas.onmousemove = function(e) {
        const pos = getCoords(e);
        window._mbHoverPos = pos;
        if (window._mbIsDrawing && (window._mbTool === 'tile' || window._mbTool === 'brush3')) {
            paintTerrain(pos.col, pos.row);
        } else if (window._mbTool === 'stamp') {
            DRAW_MB_CANVAS();
        }
    };

    canvas.onmouseleave = function() {
        window._mbHoverPos = null;
        if (window._mbTool === 'stamp') DRAW_MB_CANVAS();
    };

    if (!window._mbMouseUpBound) {
        window._mbMouseUpBound = true;
        window.addEventListener('mouseup', () => { window._mbIsDrawing = false; });
    }
    canvas.oncontextmenu = function(e) {
        e.preventDefault();
        const pos = getCoords(e);
        MB_PUSH_UNDO();
        deleteNearestObject(pos.gx, pos.gy);
    };
}

// ================================================================
// ✨ HD-РЕНДЕР V4: РАСТУШЁВАННЫЕ СТЫКИ БИОМОВ, 3D-СТЕНЫ, LIGHTMAP
// ================================================================
function DRAW_MB_CANVAS(isExport = false) {
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

    // Определяем базовое покрытие (самое частое кроме стен)
    const counts = {};
    for (const cell of data.cells) counts[cell.t] = (counts[cell.t] || 0) + 1;
    let baseTileKey = 'grass', maxC = -1;
    for (const [k, v] of Object.entries(counts)) {
        if (!/^wall/.test(k) && v > maxC) { maxC = v; baseTileKey = k; }
    }

    const fillStyleForTile = (targetCtx, tileKey) => {
        const cfg = tiles[tileKey] || tiles.grass || { bg: '#34592e' };
        const img = cfg.img ? MB_GET_LOADED_IMG(cfg.img) : null;
        if (img) return MB_GET_TILE_PATTERN(targetCtx, tileKey, img, cfg.img, cellW);
        return MB_BUILD_PROCEDURAL_PATTERN(targetCtx, tileKey, cfg, cellW);
    };

    // СЛОЙ 1: Непрерывная подложка
    ctx.fillStyle = fillStyleForTile(ctx, baseTileKey);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // СЛОЙ 2: Плавные органические слои (через offscreen-маску с мягким пером — минус «лесенка»!)
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
            // Архитектурные полы (доски, брусчатка, плиты) — чёткая геометрия без размытия
            ctx.save();
            ctx.fillStyle = fillStyleForTile(ctx, tKey);
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                if (data.cells[r * cols + c].t === tKey) {
                    ctx.fillRect(c * cellW - 0.5, r * cellH - 0.5, cellW + 1, cellH + 1);
                }
            }
            ctx.restore();
            continue;
        }

        // Природные слои (вода, лава, земля, трава, песок, снег, листва) — мягкое органическое растушёвывание!
        if (isLiquid) {
            // Влажная / обгорелая береговая кромка
            ctx.save();
            ctx.filter = `blur(${Math.max(4, Math.round(cellW * 0.14))}px)`;
            ctx.fillStyle = /^lava/.test(tKey) ? 'rgba(32, 12, 6, 0.85)' : (/^water/.test(tKey) ? 'rgba(28, 22, 14, 0.45)' : 'rgba(0,0,0,0.8)');
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                if (data.cells[r * cols + c].t !== tKey) continue;
                ctx.beginPath();
                ctx.arc((c + 0.5) * cellW, (r + 0.5) * cellH, cellW * 0.78, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.filter = 'none';
            ctx.restore();
        }

        lyr.clearRect(0, 0, canvas.width, canvas.height);
        lyr.save();
        lyr.globalCompositeOperation = 'source-over';
        lyr.filter = `blur(${Math.max(3, Math.round(cellW * (isLiquid ? 0.09 : 0.18)))}px)`;
        lyr.fillStyle = '#000';
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            if (data.cells[r * cols + c].t !== tKey) continue;
            // Рисуем квадрат + мягкие круги по центру, чтобы края были живыми и не было дырок
            const x = c * cellW, y = r * cellH;
            lyr.fillRect(x + cellW * 0.06, y + cellH * 0.06, cellW * 0.88, cellH * 0.88);
            lyr.beginPath();
            lyr.arc(x + cellW * 0.5, y + cellH * 0.5, cellW * 0.64, 0, Math.PI * 2);
            lyr.fill();
        }
        lyr.filter = 'none';
        lyr.globalCompositeOperation = 'source-in';
        lyr.fillStyle = fillStyleForTile(lyr, tKey);
        lyr.fillRect(0, 0, canvas.width, canvas.height);
        lyr.restore();

        ctx.drawImage(layerCanvas, 0, 0);

        // Глубина воды и светлая кромка мелководья
        if (/^water/.test(tKey) && window._mbPostFx) {
            ctx.save();
            ctx.filter = `blur(${Math.max(5, Math.round(cellW * 0.22))}px)`;
            ctx.fillStyle = 'rgba(5, 24, 52, 0.34)';
            for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
                if (data.cells[r * cols + c].t === tKey &&
                    data.cells[(r - 1) * cols + c].t === tKey &&
                    data.cells[(r + 1) * cols + c].t === tKey &&
                    data.cells[r * cols + c - 1].t === tKey &&
                    data.cells[r * cols + c + 1].t === tKey) {
                    ctx.beginPath();
                    ctx.arc((c + 0.5) * cellW, (r + 0.5) * cellH, cellW * 0.62, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
            ctx.filter = 'none';
            ctx.restore();
        }
    }

    // Органический светотеневой шум поверх земли (убирает однотонность)
    if (window._mbPostFx) {
        ctx.save();
        ctx.fillStyle = MB_GET_ORGANIC_NOISE_PATTERN(ctx);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    // СЛОЙ 3: Глубокие мягкие 3D-тени от стен на пол
    const isWallAt = (c, r) => (r >= 0 && r < rows && c >= 0 && c < cols && /^wall/.test(data.cells[r * cols + c].t));
    ctx.save();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (isWallAt(c, r)) continue;
        const x = c * cellW, y = r * cellH;
        if (isWallAt(c, r - 1)) {
            const g = ctx.createLinearGradient(x, y, x, y + cellH * 0.6);
            g.addColorStop(0, 'rgba(0,0,0,0.60)'); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g; ctx.fillRect(x, y, cellW, cellH * 0.6);
        }
        if (isWallAt(c - 1, r)) {
            const g = ctx.createLinearGradient(x, y, x + cellW * 0.5, y);
            g.addColorStop(0, 'rgba(0,0,0,0.50)'); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g; ctx.fillRect(x, y, cellW * 0.5, cellH);
        }
        if (isWallAt(c, r + 1)) {
            const g = ctx.createLinearGradient(x, y + cellH, x, y + cellH * 0.72);
            g.addColorStop(0, 'rgba(0,0,0,0.32)'); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g; ctx.fillRect(x, y + cellH * 0.72, cellW, cellH * 0.28);
        }
        if (isWallAt(c + 1, r)) {
            const g = ctx.createLinearGradient(x + cellW, y, x + cellW * 0.74, y);
            g.addColorStop(0, 'rgba(0,0,0,0.28)'); g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g; ctx.fillRect(x + cellW * 0.74, y, cellW * 0.26, cellH);
        }
    }
    ctx.restore();

    // СЛОЙ 4: Аккуратная сетка
    if (window._mbShowGrid) {
        ctx.save();
        ctx.strokeStyle = 'rgba(235, 205, 145, 0.13)';
        ctx.lineWidth = 1;
        for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(c * cellW + 0.5, 0); ctx.lineTo(c * cellW + 0.5, canvas.height); ctx.stroke(); }
        for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * cellH + 0.5); ctx.lineTo(canvas.width, r * cellH + 0.5); ctx.stroke(); }
        ctx.restore();
    }

    // СЛОЙ 5: Объекты в 4 Z-слоях (0=подложка -> стены -> 1=мебель/двери -> 2=крыши/кроны -> 3=дымоходы)
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
        // НИКОГДА не рисуем запасные эмодзи 🏰/📦 на карте!
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
            const sr = targetMaxPx * (meta.layer === 2 ? 0.42 : 0.34);
            const sx = cx + (meta.layer === 2 ? cellW * 0.16 : cellW * 0.06);
            const sy = cy + (meta.layer === 2 ? cellH * 0.18 : cellH * 0.07);
            const g = ctx.createRadialGradient(sx, sy, sr * 0.15, sx, sy, sr);
            g.addColorStop(0, meta.layer === 2 ? 'rgba(0,0,0,0.40)' : 'rgba(0,0,0,0.32)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
        }

        ctx.save();
        ctx.globalAlpha = ghostAlpha;
        ctx.translate(cx, cy);
        if (o.rot) ctx.rotate((o.rot * Math.PI) / 180);

        if (meta.layer === 1) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.48)';
            ctx.shadowBlur = Math.max(4, cellW * 0.14);
            ctx.shadowOffsetX = cellW * 0.06;
            ctx.shadowOffsetY = cellH * 0.08;
        } else if (meta.layer === 2) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.56)';
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

    // СЛОЙ 6: Объёмные 3D-стены (поддерживают все варианты wall..wall_5!)
    ctx.save();
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        const wKey = data.cells[r * cols + c].t;
        if (!/^wall/.test(wKey)) continue;
        const x = c * cellW, y = r * cellH;
        ctx.fillStyle = fillStyleForTile(ctx, wKey);
        ctx.fillRect(x, y, cellW + 0.5, cellH + 0.5);
        ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
        ctx.fillRect(x, y, cellW, cellH);

        ctx.strokeStyle = 'rgba(235, 218, 190, 0.36)';
        ctx.lineWidth = 2;
        if (!isWallAt(c, r - 1)) { ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.lineTo(x + cellW, y + 1); ctx.stroke(); }
        if (!isWallAt(c - 1, r)) { ctx.beginPath(); ctx.moveTo(x + 1, y); ctx.lineTo(x + 1, y + cellH); ctx.stroke(); }

        ctx.strokeStyle = 'rgba(0, 0, 0, 0.82)';
        ctx.lineWidth = 2.5;
        if (!isWallAt(c, r + 1)) { ctx.beginPath(); ctx.moveTo(x, y + cellH - 1); ctx.lineTo(x + cellW, y + cellH - 1); ctx.stroke(); }
        if (!isWallAt(c + 1, r)) { ctx.beginPath(); ctx.moveTo(x + cellW - 1, y); ctx.lineTo(x + cellW - 1, y + cellH); ctx.stroke(); }
    }
    ctx.restore();

    objs.filter(i => i.meta.layer === 1).forEach(i => drawObjItem(i));
    objs.filter(i => i.meta.layer === 2).forEach(i => drawObjItem(i));
    objs.filter(i => i.meta.layer === 3).forEach(i => drawObjItem(i));

    // Лава как источник света
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
        if (/^lava/.test(data.cells[r * cols + c].t) && (r + c) % 2 === 0) {
            lightSources.push({ x: (c + 0.5) * cellW, y: (r + 0.5) * cellH, color: [255, 118, 36], r: cellW * 2.6, intensity: 0.72 });
        }
    }

    // СЛОЙ 7: LIGHTMAP (MULTIPLY) + BLOOM + ВИНЬЕТКА
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
                g.addColorStop(0.45, `rgba(${cr}, ${cg}, ${cb}, ${ls.intensity * 0.45})`);
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

    // Полупрозрачный предпросмотр объекта под курсором
    if (!isExport && window._mbTool === 'stamp' && window._mbHoverPos && window._mbSelectedStamp) {
        const stObj = MB_FIND_STAMP_OBJ(window._mbSelectedStamp);
        if (stObj) {
            const meta = MB_ANALYZE_STAMP_META(stObj);
            const gx = window._mbSnapGrid ? (window._mbHoverPos.col + 0.5) : window._mbHoverPos.gx;
            const gy = window._mbSnapGrid ? (window._mbHoverPos.row + 0.5) : window._mbHoverPos.gy;
            drawObjItem({ o: { id: window._mbSelectedStamp, x: gx, y: gy, scale: window._mbStampScale || 1, rot: window._mbStampRot || 0 }, stObj, meta }, 0.62);
        }
    }
}

function MB_APPLY_TO_GAME_MAP() {
    const canvas = document.getElementById('mb-editor-canvas');
    if (!canvas) return;
    DRAW_MB_CANVAS(true);

    let dataUrl = '';
    try {
        dataUrl = canvas.toDataURL('image/jpeg', 0.89);
    } catch (err) {
        showMessage('⚠️ Ошибка локального запуска (CORS)',
            'Браузер заблокировал сохранение холста с локальными PNG-картинками, потому что сайт открыт напрямую как файл (<code>file://</code>).<br><br>' +
            'Открывайте сайт через <b>GitHub Pages</b> или через <b>Live Server в VS Code</b>.');
        return;
    }

    const newTitle = document.getElementById('mb-map-title-inp')?.value.trim() || 'Нарисованная локация';
    const st = GET_MAP_STATE();
    st.img = dataUrl;
    st.title = newTitle;
    st.grid = false;
    st.fog = false;
    st.revealedAreas = [];
    SAVE_MAP_STATE(st);

    RENDER_MAP_AREA();
    CM('gm-tool-modal');
    LOG_COMBAT_TO_CHAT(`🗺️ Гейм-Мастер создал и выложил новую тактическую карту (${window._mbCols}×${window._mbRows}): «${newTitle}»!`);
}