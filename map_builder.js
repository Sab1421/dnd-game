// ================================================================
// 🎨 СТУДИЯ КАРТ HD V3 (LIGHTMAP-СВЕТ, ГЛУБИНА, 13 БИОМОВ, СТРОГАЯ ЛОГИКА)
// ================================================================
window._mbStampCat = window._mbStampCat || 'nature';
window._mbStampSearch = window._mbStampSearch || '';
window._mbCols = window._mbCols || 22;
window._mbRows = window._mbRows || 14;
window._mbTool = window._mbTool || 'tile';          // 'tile' | 'brush3' | 'stamp' | 'eraser'
window._mbSelectedTile = window._mbSelectedTile || 'wall';
window._mbSelectedStamp = window._mbSelectedStamp || '';
window._mbShowGrid = (window._mbShowGrid !== undefined) ? window._mbShowGrid : true;
window._mbRandBiome = window._mbRandBiome || 'random';
window._mbLighting = window._mbLighting || 'day';   // 'day' | 'sunset' | 'tavern' | 'night' | 'dungeon'
window._mbPostFx = (window._mbPostFx !== undefined) ? window._mbPostFx : true;
window._mbStampScale = window._mbStampScale || 1.0;
window._mbStampRot = window._mbStampRot || 0;
window._mbRandRot = (window._mbRandRot !== undefined) ? window._mbRandRot : false;
window._mbSnapGrid = (window._mbSnapGrid !== undefined) ? window._mbSnapGrid : false;
window._mbIsDrawing = false;
window._mbHoverPos = null;
window._mbUndoStack = window._mbUndoStack || [];

const MB_SIZE_PRESETS = [
    { label: '🍺 Таверна', cols: 14, rows: 10 },
    { label: '🌲 Средняя', cols: 22, rows: 14 },
    { label: '🏘️ Деревня', cols: 30, rows: 18 },
    { label: '👑 Столица', cols: 42, rows: 26 }
];

const MB_LIGHTING_MODES = {
    day:     { label: '☀️ Ясный день',         ambient: [252, 249, 242], bloom: 0.20, vignette: 0.22 },
    sunset:  { label: '🌅 Золотой закат',      ambient: [238, 192, 148], bloom: 0.34, vignette: 0.34 },
    tavern:  { label: '🕯️ Уютный полумрак',    ambient: [162, 142, 126], bloom: 0.44, vignette: 0.46 },
    night:   { label: '🌙 Лунная ночь',        ambient: [94,  116, 168], bloom: 0.52, vignette: 0.52 },
    dungeon: { label: '🏰 Глубокое подземелье', ambient: [108, 104, 122], bloom: 0.50, vignette: 0.62 }
};

// Базовый порядок слоёв (любые новые кастомные текстуры из assets.js автоматически добавляются перед стенами)
const MB_BASE_TILE_ORDER = ['abyss', 'water', 'lava', 'sand', 'dirt', 'grass', 'leaves_green', 'leaves_red', 'snow', 'cobble', 'flagstone', 'stone', 'wood'];

function GET_MB_TILES() {
    const src = (window.SITE_ASSETS && window.SITE_ASSETS.builderTiles) ? Object.assign({}, window.SITE_ASSETS.builderTiles) : {};
    const defaults = {
        grass:        { name: 'Трава',         icon: '🌿', bg: '#34592e', border: '#233d1f', img: 'assets/tiles/grass.jpg' },
        dirt:         { name: 'Тропа/Земля',   icon: '🛤️', bg: '#6b5138', border: '#4f3a27', img: 'assets/tiles/dirt.jpg' },
        leaves_green: { name: 'Лесная листва', icon: '🍃', bg: '#3f6230', border: '#2a4220', img: 'assets/stamps/other/texture_leaf_litter_green_1.png' },
        leaves_red:   { name: 'Осенний лист',  icon: '🍁', bg: '#7c4328', border: '#542c1a', img: 'assets/stamps/other/texture_leaf_litter_red.png' },
        sand:         { name: 'Песок',         icon: '🏜️', bg: '#c7ad7c', border: '#9e8559', img: 'assets/tiles/sand.jpg' },
        snow:         { name: 'Снег/Лёд',      icon: '❄️', bg: '#d7e2ec', border: '#9eb1c4', img: 'assets/tiles/snow.jpg' },
        cobble:       { name: 'Брусчатка',     icon: '🏛️', bg: '#65686e', border: '#484a4f', img: 'assets/tiles/cobble.jpg' },
        flagstone:    { name: 'Плиты зала',    icon: '⬜', bg: '#5d6066', border: '#3f4247', img: 'assets/stamps/other/floor_flagstone_tiling_6x6.png' },
        stone:        { name: 'Каменный пол',  icon: '🪨', bg: '#4b4e54', border: '#35383d', img: 'assets/tiles/stone.jpg' },
        wood:         { name: 'Доски (Пол)',   icon: '🪵', bg: '#734b2c', border: '#54351d', img: 'assets/stamps/other/floor_floorboards_tiling_8x8.png' },
        water:        { name: 'Вода',          icon: '🌊', bg: '#1e527d', border: '#153c5c', img: 'assets/tiles/water.jpg' },
        lava:         { name: 'Лава',          icon: '🔥', bg: '#b91c1c', border: '#f97316', img: 'assets/tiles/lava.jpg' },
        abyss:        { name: 'Пропасть',      icon: '🕳️', bg: '#0c0c10', border: '#1d1d24', img: 'assets/tiles/abyss.jpg' },
        wall:         { name: 'Стена',         icon: '🧱', bg: '#282523', border: '#57534e', img: 'assets/tiles/wall.jpg' }
    };

    const merged = {};
    for (const key of Object.keys(defaults)) {
        merged[key] = src[key] ? Object.assign({}, defaults[key], src[key]) : defaults[key];
    }
    // Автоматически подхватываем ЛЮБЫЕ новые текстуры, которые ты сама добавишь в assets.js -> builderTiles!
    for (const [k, v] of Object.entries(src)) {
        if (!merged[k]) merged[k] = Object.assign({ name: k, icon: '🎨', bg: '#555', border: '#333', img: '' }, v);
    }
    return merged;
}

function GET_MB_STAMPS() {
    if (window.SITE_ASSETS && Array.isArray(window.SITE_ASSETS.builderStamps) && window.SITE_ASSETS.builderStamps.length) {
        return window.SITE_ASSETS.builderStamps;
    }
    return [
        { id: 'pine', cat: 'nature', icon: '🌲', label: 'Ель', img: '' },
        { id: 'rock', cat: 'nature', icon: '🪨', label: 'Валун', img: '' },
        { id: 'table', cat: 'furniture', icon: '🪑', label: 'Стол', img: '' },
        { id: 'campfire', cat: 'camp', icon: '🔥', label: 'Костёр', img: '' }
    ];
}

function GET_UNIQUE_MB_STAMPS() {
    if (window._mbUniqueStampsCache) return window._mbUniqueStampsCache;
    const all = GET_MB_STAMPS();
    const seen = new Set();
    const out = [];
    for (const s of all) {
        const normKey = (s.cat || 'other') + '|' + (s.label || s.id).toLowerCase().replace(/\s+/g, ' ').trim();
        if (/_[234]$/.test(s.id || '') && seen.has(normKey)) continue;
        seen.add(normKey);
        out.push(s);
    }
    window._mbUniqueStampsCache = out;
    return out;
}

// --- КЭШ ИЗОБРАЖЕНИЙ, БЕСШОВНЫХ ПАТТЕРНОВ И ПРОЦЕДУРНЫХ ТЕКСТУР ---
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

// Процедурный качественный паттерн (используется если файл в assets/tiles/ не найден, например snow или abyss)
function MB_BUILD_PROCEDURAL_PATTERN(ctx, tileKey, cfg, cellPx) {
    const cacheKey = `proc_${tileKey}_${Math.round(cellPx)}`;
    if (window._mbPatternCache[cacheKey]) return window._mbPatternCache[cacheKey];

    const size = 192;
    const off = document.createElement('canvas');
    off.width = size; off.height = size;
    const o = off.getContext('2d');
    o.fillStyle = cfg.bg || '#444';
    o.fillRect(0, 0, size, size);

    // Псевдослучайный генератор (детерминированный)
    let seed = 1337 + tileKey.split('').reduce((a, ch) => a + ch.charCodeAt(0) * 31, 0);
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    if (tileKey === 'snow') {
        const g = o.createLinearGradient(0, 0, size, size);
        g.addColorStop(0, '#dde7f0'); g.addColorStop(0.5, '#cfdce8'); g.addColorStop(1, '#dde7f0');
        o.fillStyle = g; o.fillRect(0, 0, size, size);
        for (let i = 0; i < 65; i++) {
            o.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.45)' : 'rgba(130,160,190,0.18)';
            o.beginPath(); o.arc(rnd() * size, rnd() * size, 3 + rnd() * 14, 0, Math.PI * 2); o.fill();
        }
        for (let i = 0; i < 90; i++) {
            o.fillStyle = 'rgba(255,255,255,0.75)';
            o.fillRect(rnd() * size, rnd() * size, 2, 2);
        }
    } else if (tileKey === 'abyss') {
        o.fillStyle = '#09090d'; o.fillRect(0, 0, size, size);
        for (let i = 0; i < 35; i++) {
            o.fillStyle = 'rgba(42, 34, 66, 0.16)';
            o.beginPath(); o.arc(rnd() * size, rnd() * size, 8 + rnd() * 22, 0, Math.PI * 2); o.fill();
        }
    } else if (tileKey === 'wood') {
        const planks = 6, ph = size / planks;
        for (let p = 0; p < planks; p++) {
            o.fillStyle = p % 2 === 0 ? '#744c2d' : '#6b4527';
            o.fillRect(0, p * ph, size, ph);
            o.strokeStyle = 'rgba(28, 14, 5, 0.45)';
            o.lineWidth = 1.5;
            o.strokeRect(0, p * ph, size, ph);
            const splitX = Math.floor(rnd() * size);
            o.beginPath(); o.moveTo(splitX, p * ph); o.lineTo(splitX, (p + 1) * ph); o.stroke();
        }
    } else {
        for (let i = 0; i < 90; i++) {
            o.fillStyle = rnd() > 0.5 ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
            o.beginPath(); o.arc(rnd() * size, rnd() * size, 3 + rnd() * 12, 0, Math.PI * 2); o.fill();
        }
    }

    const pat = ctx.createPattern(off, 'repeat');
    window._mbPatternCache[cacheKey] = pat;
    return pat;
}

function MB_GET_TILE_PATTERN(ctx, tileKey, tileImg, src, cellPx) {
    const cacheKey = `img_${src}_${Math.round(cellPx)}`;
    if (window._mbPatternCache[cacheKey]) return window._mbPatternCache[cacheKey];

    const repeatCells = (tileKey === 'wood' || tileKey === 'flagstone' || tileKey === 'cobble') ? 3.8 : (tileKey === 'wall' ? 2.4 : 4.8);
    const targetPx = Math.max(110, Math.min(380, Math.round(cellPx * repeatCells)));
    const off = document.createElement('canvas');
    off.width = targetPx;
    off.height = targetPx;
    const octx = off.getContext('2d');
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    octx.drawImage(tileImg, 0, 0, targetPx, targetPx);

    const pat = ctx.createPattern(off, 'repeat');
    window._mbPatternCache[cacheKey] = pat;
    return pat;
}

// Бесшовный мягкий органический шум поверх ландшафта (убирает эффект «повторяющейся плитки»)
function MB_GET_ORGANIC_NOISE_PATTERN(ctx) {
    if (window._mbNoisePattern) return window._mbNoisePattern;
    const s = 320;
    const off = document.createElement('canvas');
    off.width = s; off.height = s;
    const o = off.getContext('2d');
    let seed = 918273;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

    for (let i = 0; i < 42; i++) {
        const x = rnd() * s, y = rnd() * s, r = 24 + rnd() * 58;
        const isLight = rnd() > 0.48;
        const col = isLight ? '255, 248, 224' : '12, 18, 24';
        const alpha = isLight ? 0.055 : 0.075;
        // Рисуем с бесшовным переносом через края
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

function MB_PRELOAD_TILES() {
    const tiles = GET_MB_TILES();
    Object.values(tiles).forEach(t => { if (t.img) MB_GET_LOADED_IMG(t.img); });
}

// --- СЛОИ, ПРОПОРЦИИ И СВЕЧЕНИЕ СПРАЙТОВ ---
function MB_ANALYZE_STAMP_META(stObj) {
    const id = ((stObj?.id || '') + ' ' + (stObj?.label || '')).toLowerCase();

    let layer = 1;
    if (/(rug|carpet|mat|tatami|puddle|leaf_litter|duff|clover|soil_patch|dirt_patch|paving_stone|blood|webs|lily|submerged|current|rapids|river_edge|road_edge|path_edge|bridge|floor|ruin|shadow|shade|embers|fiery_area|oasis|watertransparent|spore)/i.test(id)) {
        layer = 0;
    } else if (/(roof|tree|palm|canopy|balloon|wing|tower|watchpost|chandelier|lightning|fireball|burning_hands|breath_weapon|wall_of_fire)/i.test(id) && !/(stump|fallen|branch|root|log|trunk)/i.test(id)) {
        layer = 2;
    }

    let baseCells = 1.15;
    const dimMatch = id.match(/(\d+)\s*x\s*(\d+)/i);
    if (dimMatch) {
        const wC = parseInt(dimMatch[1]) || 1;
        const hC = parseInt(dimMatch[2]) || 1;
        baseCells = Math.max(0.8, Math.min(6.2, Math.max(wC, hC) * 0.72));
    } else if (/(roof|tent_large|tent_round_large|pavillion|balloon)/i.test(id)) {
        baseCells = 3.6;
    } else if (/(tree_bigger|tree_large|tree_big|palmtree|fountain|wagon|catapult|shelter|watchpost|oasis|bigstatue|large_statue|tatami_mat_large)/i.test(id)) {
        baseCells = 2.35;
    } else if (/(tree|palm|tent|ballista|cannon$|table_long|tabledinning|tableroundlarge|carpet|rug_6|bed_pattern|bedframeddouble|billiards_table|piano|sofa|forge|altar|tomb|bridge|rock_formation|fallen_tree|boulder|cart|thicket|casting_table|chandelier|orrery_huge)/i.test(id)) {
        baseCells = 1.72;
    } else if (/(table|bed|desk|bench|bookshelf|dresser|cupboard|statue|well|barrel|crate|chest|campfire|brazier|cauldron|oven|stove|throne|bush|shrub|cactus|fungi|mushroom|rock|stump|log|pillar|door|grave|bonepile|crystal|flytrap|anvil|melting_pot|shrine|samurai_armor|taiko|bonsai|totem|meatrack|tanningrack|barricade|woodenstakes|shipswheel|anchor)/i.test(id)) {
        baseCells = 1.15;
    } else if (/(candle|lantern|torch|flower|apple|egg|pie|plate|meat|tankard|card|scroll|skull|bone|coin|shell|starfish|crab|parrot|seagull|cat_|bottle|chair|stool|cushion|sack|bucket|hammer|axe|sword|shield|ingot|tongs|spyglass|parchment)/i.test(id)) {
        baseCells = 0.72;
    }

    let glow = null;
    if (/(campfire|fireball|fiery|burning|flaming|flame|embers|forge|oven_fireplace|melting_pot|wall_of_fire)/i.test(id) && !/unlit|empty|wood$|ring$|smoke/i.test(id)) {
        glow = { color: [255, 148, 56], radius: 3.4, intensity: 0.92 };
    } else if (/(brazier|torch|lantern|lamp|candle|chandelier|stand_lit|jack_o_lantern|hole_roof_glow)/i.test(id) && !/unlit/i.test(id)) {
        glow = { color: [255, 198, 104], radius: 2.5, intensity: 0.78 };
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
    const exact = list.find(s => s.id === stampVal || s.icon === stampVal);
    if (exact) return exact;
    return { id: stampVal, icon: '📦', label: stampVal, img: '' };
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
                if (!Array.isArray(parsed.objects)) {
                    parsed.objects = [];
                    for (let r = 0; r < parsed.rows; r++) {
                        for (let c = 0; c < parsed.cols; c++) {
                            const cell = parsed.cells[r * parsed.cols + c];
                            if (cell && cell.s) {
                                parsed.objects.push({ id: cell.s, x: c + 0.5, y: r + 0.5, scale: 1, rot: 0 });
                                delete cell.s;
                            }
                        }
                    }
                }
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
    const cols = Math.max(8, Math.min(50, parseInt(newCols) || 22));
    const rows = Math.max(6, Math.min(40, parseInt(newRows) || 14));
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
    MB_PRELOAD_TILES();
    window._mbData = GET_MB_DATA();
    const uniqueStamps = GET_UNIQUE_MB_STAMPS();
    if (!window._mbSelectedStamp && uniqueStamps.length) {
        window._mbSelectedStamp = uniqueStamps[0].id;
    }
    const cont = document.getElementById('gm-tool-modal-content');
    cont.style.maxWidth = '1220px';
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
// 🖥️ ИНТЕРФЕЙС КОНСТРУКТОРА КАРТ
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

    let tileBtnsHTML = '';
    for (const [key, cfg] of Object.entries(tiles)) {
        const isSel = (window._mbTool === 'tile' || window._mbTool === 'brush3') && window._mbSelectedTile === key;
        const imgOk = cfg.img && window._mbImgCache[cfg.img]?.status !== 'error';
        const thumbStyle = imgOk
            ? `background-image:url('${cfg.img}'); background-size:cover; background-color:${cfg.bg};`
            : `background:${cfg.bg}; border:1px solid ${cfg.border};`;

        tileBtnsHTML += `
            <button class="btn-small" onclick="MB_SELECT_TILE('${key}')"
                style="background:${isSel ? '#c9a96e' : '#181715'}; color:${isSel ? '#141210' : '#ebe8e2'}; border:2px solid ${isSel ? '#fff' : cfg.bg}; padding:4px 8px; display:inline-flex; align-items:center; gap:5px; font-size:0.8rem;">
                <span style="display:inline-block; width:16px; height:16px; border-radius:3px; ${thumbStyle}"></span>
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
        return `<button class="btn-small" style="padding:3px 8px; font-size:0.76rem; background:${active ? '#c9a96e' : '#22201d'}; color:${active ? '#141210' : '#ccc'};" onclick="window._mbStampCat='${c.id}'; RENDER_GM_MAP_BUILDER_UI();">${c.label} (${cnt})</button>`;
    }).join('');

    const lightOpts = Object.entries(MB_LIGHTING_MODES).map(([k, m]) =>
        `<option value="${k}" ${window._mbLighting === k ? 'selected' : ''}>${m.label}</option>`
    ).join('');

    const tModeBtn = (mode, label) => `
        <button class="btn-small" onclick="window._mbTool='${mode}'; RENDER_GM_MAP_BUILDER_UI();"
            style="background:${window._mbTool===mode ? '#7c3aed' : '#22201d'}; color:#fff; border:1px solid ${window._mbTool===mode ? '#e9d5ff' : '#423c33'}; font-size:0.8rem; padding:5px 9px;">
            ${label}
        </button>
    `;

    const sizePresetBtns = MB_SIZE_PRESETS.map(p => {
        const isAct = (cols === p.cols && rows === p.rows);
        return `<button class="btn-small" style="padding:3px 7px; font-size:0.75rem; background:${isAct ? '#c9a96e' : '#22201d'}; color:${isAct ? '#141210' : '#ddd'};" onclick="MB_RESIZE_GRID(${p.cols}, ${p.rows})">${p.label} ${p.cols}×${p.rows}</button>`;
    }).join('');

    const curTitleVal = document.getElementById('mb-map-title-inp')?.value ?? (GET_MAP_STATE().title || 'Новая локация');

    cont.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #3d3830; padding-bottom:8px; margin-bottom:9px; flex-wrap:wrap; gap:8px;">
            <h2 style="margin:0; border:none; padding:0; font-size:1.22rem;">🎨 Студия Карт HD (${cols}×${rows} кл. • объектов: ${(data.objects||[]).length})</h2>
            <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                <button class="btn-small" style="font-size:0.78rem;" onclick="MB_UNDO()" ${!window._mbUndoStack.length ? 'disabled' : ''}>↩️ Отменить (Ctrl+Z)</button>
                <button class="btn-small btn-danger" style="font-size:0.78rem;" onclick="MB_CLEAR_OBJECTS()">🧹 Убрать объекты</button>
                <button class="btn-small btn-danger" style="font-size:0.78rem;" onclick="MB_FILL_ALL(window._mbSelectedTile || 'grass')">🗑️ Очистить всё</button>
            </div>
        </div>

        <!-- Размер + Генератор (13 биомов) + Свет -->
        <div style="display:grid; grid-template-columns: 1.02fr 1.28fr 0.85fr; gap:8px; margin-bottom:8px;">
            <div style="background:#181715; border:1px solid #423c33; border-radius:9px; padding:8px 10px; display:flex; flex-direction:column; gap:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:4px; flex-wrap:wrap;">
                    <b style="color:#c9a96e; font-size:0.81rem;">📏 Размер:</b>
                    <div style="display:flex; align-items:center; gap:4px;">
                        <input type="number" id="mb-cols-inp" min="8" max="50" value="${cols}" style="width:50px; padding:2px 4px; font-size:0.8rem;">
                        <span>×</span>
                        <input type="number" id="mb-rows-inp" min="6" max="40" value="${rows}" style="width:50px; padding:2px 4px; font-size:0.8rem;">
                        <button class="btn-small btn-save" style="padding:3px 7px; font-size:0.75rem;" onclick="MB_RESIZE_GRID(document.getElementById('mb-cols-inp').value, document.getElementById('mb-rows-inp').value)">Ок</button>
                    </div>
                </div>
                <div style="display:flex; gap:4px; flex-wrap:wrap;">${sizePresetBtns}</div>
            </div>

            <div style="background:#1b1824; border:1px solid #7c3aed; border-radius:9px; padding:8px 10px; display:flex; flex-direction:column; justify-content:space-between; gap:6px;">
                <b style="color:#d8b4fe; font-size:0.81rem;">🎲 Генератор локаций (13 биомов + случайные планировки):</b>
                <div style="display:flex; gap:6px; align-items:center;">
                    <select id="mb-rand-biome" onchange="window._mbRandBiome=this.value;" style="flex:1; padding:4px 7px; font-size:0.81rem; text-align:left;">
                        <option value="random" ${window._mbRandBiome==='random'?'selected':''}>🎲 Любая случайная локация</option>
                        <option value="forest" ${window._mbRandBiome==='forest'?'selected':''}>🌲 Дикий лес (река / перекрёсток / руины)</option>
                        <option value="tavern" ${window._mbRandBiome==='tavern'?'selected':''}>🍺 Уютная таверна / постоялый двор</option>
                        <option value="dungeon" ${window._mbRandBiome==='dungeon'?'selected':''}>🏰 Подземелье / катакомбы</option>
                        <option value="city" ${window._mbRandBiome==='city'?'selected':''}>👑 Город / Столица / Рынок</option>
                        <option value="mansion" ${window._mbRandBiome==='mansion'?'selected':''}>🏛️ Богатый особняк / тронный зал</option>
                        <option value="dwarven" ${window._mbRandBiome==='dwarven'?'selected':''}>⚒️ Кузница и залы дварфов</option>
                        <option value="pirate" ${window._mbRandBiome==='pirate'?'selected':''}>🏴‍☠️ Пиратская бухта и побережье</option>
                        <option value="desert" ${window._mbRandBiome==='desert'?'selected':''}>🏜️ Пустынный оазис и караван</option>
                        <option value="fey" ${window._mbRandBiome==='fey'?'selected':''}>🍄 Фейский лес (магическая роща)</option>
                        <option value="eastern" ${window._mbRandBiome==='eastern'?'selected':''}>⛩️ Восточный храм / додзё</option>
                        <option value="warcamp" ${window._mbRandBiome==='warcamp'?'selected':''}>⛺ Лагерь охотников / орков</option>
                        <option value="battlefield" ${window._mbRandBiome==='battlefield'?'selected':''}>⚔️ Поле битвы / осада</option>
                        <option value="snow" ${window._mbRandBiome==='snow'?'selected':''}>❄️ Снежный перевал и привал</option>
                    </select>
                    <button class="btn-small" style="background:linear-gradient(180deg,#8b5cf6 0%,#5b21b6 100%); color:#fff; border-color:#c084fc; padding:5px 11px; font-size:0.81rem; white-space:nowrap;" onclick="MB_GENERATE_RANDOM(document.getElementById('mb-rand-biome').value)">
                        🎲 Собрать!
                    </button>
                </div>
            </div>

            <div style="background:#181715; border:1px solid #c9a96e; border-radius:9px; padding:8px 10px; display:flex; flex-direction:column; justify-content:space-between; gap:5px;">
                <b style="color:#e6c88c; font-size:0.81rem;">💡 Освещение и детали:</b>
                <select id="mb-lighting-sel" onchange="window._mbLighting=this.value; if(window._mbData){window._mbData.lighting=this.value; SAVE_MB_DATA(window._mbData);} DRAW_MB_CANVAS();" style="padding:3px 7px; font-size:0.8rem; text-align:left;">
                    ${lightOpts}
                </select>
                <div style="display:flex; gap:10px; flex-wrap:wrap; font-size:0.76rem; color:#ccc;">
                    <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                        <input type="checkbox" ${window._mbShowGrid ? 'checked' : ''} onchange="window._mbShowGrid=this.checked; DRAW_MB_CANVAS();">
                        <span>📏 Сетка</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:4px; cursor:pointer;" title="Динамические световые пятна, глубина воды и рельефный шум">
                        <input type="checkbox" ${window._mbPostFx ? 'checked' : ''} onchange="window._mbPostFx=this.checked; DRAW_MB_CANVAS();">
                        <span>✨ HD-Свет</span>
                    </label>
                </div>
            </div>
        </div>

        <!-- Инструменты + Покрытия + Объекты -->
        <div style="background:#181715; border:1px solid #423c33; border-radius:9px; padding:8px 11px; margin-bottom:8px; display:flex; flex-direction:column; gap:7px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div style="display:flex; gap:5px; align-items:center; flex-wrap:wrap;">
                    ${tModeBtn('tile', '🖌️ Пол 1×1')}
                    ${tModeBtn('brush3', '⬛ Пол 3×3')}
                    ${tModeBtn('stamp', '🌲 Объект')}
                    ${tModeBtn('eraser', '🧽 Удалить объект')}
                </div>
                <div style="display:flex; gap:9px; align-items:center; flex-wrap:wrap; font-size:0.79rem; color:#d8d4cc;">
                    <label style="display:flex; align-items:center; gap:5px;">
                        <span>🔍 Масштаб: <b id="mb-scale-lbl">${window._mbStampScale.toFixed(1)}×</b></span>
                        <input type="range" min="0.5" max="3.0" step="0.1" value="${window._mbStampScale}" oninput="window._mbStampScale=parseFloat(this.value); document.getElementById('mb-scale-lbl').textContent=this.value+'×'; DRAW_MB_CANVAS();" style="width:74px;">
                    </label>
                    <button class="btn-small" style="padding:3px 7px; font-size:0.75rem;" title="Повернуть объект (клавиша R)" onclick="window._mbStampRot=(window._mbStampRot+45)%360; document.getElementById('mb-rot-lbl').textContent=window._mbStampRot+'°'; DRAW_MB_CANVAS();">
                        🔄 <span id="mb-rot-lbl">${window._mbStampRot}°</span>
                    </button>
                    <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                        <input type="checkbox" ${window._mbRandRot ? 'checked' : ''} onchange="window._mbRandRot=this.checked;">
                        <span>🎲 Поворот</span>
                    </label>
                    <label style="display:flex; align-items:center; gap:4px; cursor:pointer;">
                        <input type="checkbox" ${window._mbSnapGrid ? 'checked' : ''} onchange="window._mbSnapGrid=this.checked;">
                        <span>🧲 По сетке</span>
                    </label>
                </div>
            </div>

            <div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center;">
                <b style="color:#c9a96e; font-size:0.78rem; margin-right:2px;">Пол/Земля:</b>
                ${tileBtnsHTML}
            </div>

            <div>
                <div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center; margin-bottom:5px;">
                    ${catTabsHTML}
                    <input type="text" id="mb-stamp-search-inp" value="${(window._mbStampSearch || '').replace(/"/g, '&quot;')}"
                           placeholder="🔍 Поиск объекта..."
                           oninput="window._mbStampSearch=this.value; MB_RENDER_STAMP_GRID_ONLY();"
                           style="width:170px; padding:3px 8px; font-size:0.78rem; text-align:left; margin-left:auto;">
                </div>
                <div id="mb-stamps-grid-wrap" style="display:flex; gap:5px; flex-wrap:wrap; max-height:110px; overflow-y:auto; padding:5px; background:#121110; border-radius:6px; border:1px solid #302c26;">
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

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:240px;">
                <span style="color:#c9a96e; white-space:nowrap;">📍 Локация:</span>
                <input type="text" id="mb-map-title-inp" value="${curTitleVal.replace(/"/g, '&quot;')}" style="flex:1; text-align:left;">
            </div>
            <small style="color:#9e988e;">💡 ЛКМ — ставить • ПКМ — удалить • R — поворот • Ctrl+Z — отмена</small>
            <div style="display:flex; gap:8px;">
                <button class="btn-save" style="padding:10px 18px; font-size:0.96rem;" onclick="MB_APPLY_TO_GAME_MAP()">
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

    if (!filtered.length) return '<span style="color:#777; font-size:0.82rem; padding:6px;">Ничего не найдено</span>';

    let html = filtered.slice(0, 140).map(st => {
        const isSel = (window._mbTool === 'stamp' && window._mbSelectedStamp === st.id);
        const previewHTML = st.img
            ? `<img src="${st.img}" loading="lazy" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline';" style="width:22px; height:22px; object-fit:contain;"><span style="display:none; font-size:1rem;">${st.icon}</span>`
            : `<span style="font-size:1rem;">${st.icon}</span>`;
        return `
            <button class="btn-small" title="${st.label}" onclick="MB_SELECT_STAMP('${st.id}')"
                style="background:${isSel ? '#c9a96e' : '#1b1917'}; color:${isSel ? '#141210' : '#fff'}; border:1px solid ${isSel ? '#fff' : '#3d3830'}; padding:3px 7px; display:inline-flex; align-items:center; gap:5px; font-size:0.76rem;">
                ${previewHTML} <span>${st.label}</span>
            </button>`;
    }).join('');

    if (filtered.length > 140) {
        html += `<div style="width:100%; color:#aaa; font-size:0.76rem; padding:4px;">Показаны первые 140 из ${filtered.length} — введите слово в поиск.</div>`;
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
// 🎲 СТРОГО ЛОГИЧНЫЙ РАНДОМНЫЙ ГЕНЕРАТОР (13 БИОМОВ + ЗАЩИТА ОТ НАЛОЖЕНИЙ)
// ================================================================
function MB_RAND_INT(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function MB_RAND_FLOAT(min, max) { return min + Math.random() * (max - min); }
function MB_PICK(arr) { return (arr && arr.length) ? arr[Math.floor(Math.random() * arr.length)] : null; }

function MB_GET_POOL(includeRx, excludeRx = null) {
    const list = GET_UNIQUE_MB_STAMPS();
    return list.filter(s => {
        const txt = (s.id || '').toLowerCase();
        if (!includeRx.test(txt)) return false;
        if (excludeRx && excludeRx.test(txt)) return false;
        return true;
    }).map(s => s.id);
}

function MB_GENERATE_RANDOM(biome) {
    MB_PUSH_UNDO();
    const allBiomes = ['forest', 'tavern', 'dungeon', 'city', 'mansion', 'dwarven', 'pirate', 'desert', 'fey', 'eastern', 'warcamp', 'battlefield', 'snow'];
    const picked = (biome === 'random' || !biome) ? MB_PICK(allBiomes) : biome;

    const cols = window._mbCols, rows = window._mbRows;
    const baseByBiome = {
        forest: 'grass', tavern: 'grass', dungeon: 'wall', city: 'grass',
        mansion: 'wall', dwarven: 'wall', pirate: 'sand', desert: 'sand',
        fey: 'grass', eastern: 'grass', warcamp: 'grass', battlefield: 'grass', snow: 'snow'
    };
    const lightByBiome = {
        forest: MB_PICK(['day', 'day', 'sunset']),
        tavern: 'tavern',
        dungeon: 'dungeon',
        city: MB_PICK(['day', 'day', 'sunset']),
        mansion: 'tavern',
        dwarven: 'dungeon',
        pirate: MB_PICK(['day', 'sunset']),
        desert: 'day',
        fey: 'night',
        eastern: MB_PICK(['day', 'sunset']),
        warcamp: 'sunset',
        battlefield: 'sunset',
        snow: MB_PICK(['day', 'night'])
    };

    window._mbLighting = lightByBiome[picked] || 'day';
    const data = CREATE_EMPTY_MB_DATA(baseByBiome[picked] || 'grass', cols, rows);
    data.lighting = window._mbLighting;

    const inBounds = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows;
    const getTile = (c, r) => inBounds(c, r) ? data.cells[r * cols + c].t : null;
    const setTile = (c, r, t) => { if (inBounds(c, r)) data.cells[r * cols + c].t = t; };

    // Проверка дистанции, чтобы деревья, дома и мебель не склеивались в кашу!
    const placedZones = [];
    const canPlace = (x, y, minDist = 1.1) => !placedZones.some(z => Math.hypot(z.x - x, z.y - y) < Math.max(minDist, z.r));
    const addObj = (poolOrId, x, y, scale = 1.0, rot = 0, reserveRadius = 0) => {
        const id = Array.isArray(poolOrId) ? MB_PICK(poolOrId) : poolOrId;
        if (!id) return false;
        const stObj = MB_FIND_STAMP_OBJ(id);
        if (stObj && stObj.img) MB_GET_LOADED_IMG(stObj.img);
        data.objects.push({ id, x, y, scale, rot });
        if (reserveRadius > 0) placedZones.push({ x, y, r: reserveRadius });
        return true;
    };

    // --- СТРОГО ОТФИЛЬТРОВАННЫЕ ТЕМАТИЧЕСКИЕ ПУЛЫ (БЕЗ «СИНИХ ДЕРЕВЬЕВ У ТАВЕРНЫ»!) ---
    const P = {
        // Обычный зелёный лес (ТОЛЬКО классические зелёные деревья, без фейских tree2/3/4 и пальм!)
        greenTrees:   MB_GET_POOL(/^nature_tree_(large|small|big|bigger|[123])$|^nature_tree_(large|small)_[12]$/),
        greenBushes:  MB_GET_POOL(/^nature_bush_(2|3|4|5|6|7|8)_green|^nature_bush_shrub_|^nature_bush_[12]$|^nature_thick_foliage_|^nature_foliage_|^other_fern_/),
        autumnBushes: MB_GET_POOL(/^nature_bush_1_red$|^nature_bush_9_yellow$|^other_leaf_litter_/),
        forestFlower: MB_GET_POOL(/^nature_flower_|^nature_flowers_|^other_clovers_/),
        forestRocks:  MB_GET_POOL(/^nature_mossy_boulder_|^nature_rock(_small)?_[123]$|^nature_rocks_[1-8]$/),
        forestLogs:   MB_GET_POOL(/^nature_fallen_tree_|^nature_stump_|^nature_tree_stump_[1-5]_cut$|^nature_log_/),
        forestFungi:  MB_GET_POOL(/^nature_mushrooms_[123]$|^nature_fungi_(1|3|5|14)_brown$|^nature_mushroom_(6|7)_brown$|^nature_mushroom_11_red$/),
        waterDec:     MB_GET_POOL(/^other_lily_pad|^nature_submerged_rocks_|^nature_river_rock_|^other_current_/),
        bridges:      MB_GET_POOL(/^nature_wooden_bridge_|^nature_stone_bridge_/),
        campfires:    MB_GET_POOL(/^camp_campfire(_fire|_pot_cooking)?$|^camp_campfire_3$/),
        campTents:    MB_GET_POOL(/^camp_tent_(round_small|square_[123]|narrow_[12])$/),
        campGear:     MB_GET_POOL(/^furniture_bedroll_[123]$|^camp_backpack_|^other_firewood_pile$/),

        // Таверна / Интерьер (строго деревянный средневековый стиль)
        tavTables:    MB_GET_POOL(/^furniture_table_(round|rectangle)_[1-4]_dark$|^furniture_table_long_1$|^furniture_tabledinning2$|^furniture_tableround(large|small)2$/),
        tavChairs:    MB_GET_POOL(/^furniture_chair_(simple_[1-5]|stool_[12]|bench_[12])_dark$|^furniture_bench3$|^furniture_chair3$/),
        tavRugs:      MB_GET_POOL(/^furniture_rug_(6_[a-g]|bear_1|animal_skin)$/),
        tavBeds:      MB_GET_POOL(/^furniture_bed_pattern_1_[a-f]$|^furniture_bedframed(single|double)2$/),
        tavBarrels:   MB_GET_POOL(/^furniture_storage_barrel_[1-5](_a)?_dark$|^other_keg(5tapped|6)$/),
        tavCrates:    MB_GET_POOL(/^furniture_storage_crate_[1-4]_dark$|^other_clutter_sacks_[12]$|^furniture_crate_[12]$/),
        tavShelves:   MB_GET_POOL(/^furniture_storage_(bookshelf_[1-3]|shelf_[12])|^other_storage_dresser_[12]_dark$|^other_cupboard2$/),
        tavFood:      MB_GET_POOL(/^other_clutter_tankards_full$|^furniture_clutter_food_[12]$|^other_clutter_playing_cards$|^other_pie$|^other_hamroast$|^other_stewpot$/),
        tavCandles:   MB_GET_POOL(/^other_light_candle_(small|cluster)_lit$|^other_light_lantern_lit$|^other_candles2?$/),
        tavFireplace: MB_GET_POOL(/^other_cooking_oven_fireplace_[34]$|^other_cooking_stove$/),
        tavTrophies:  MB_GET_POOL(/^other_trophy_(antlers|deer|wolf_1|bear_1)$/),
        doors:        MB_GET_POOL(/^dungeon_door_(narrow|wide)_|^dungeon_door_[12]_base$/),

        // Подземелье (строго мрачный камень, без пиратов и японщины)
        dungBraziers: MB_GET_POOL(/^dungeon_light_brazier_|^other_light_stand_lit_iron$/),
        dungChests:   MB_GET_POOL(/^dungeon_chest_[12]_(steel|gold)$|^dungeon_chest2$|^furniture_chest_lockbox_1_iron$/),
        dungBones:    MB_GET_POOL(/^dungeon_bones_(adventurer|human_skull|misc)|^dungeon_bonepile$|^dungeon_clutter_skull_human$/),
        dungWebs:     MB_GET_POOL(/^dungeon_clutter_webs_/),
        dungPillars:  MB_GET_POOL(/^dungeon_pillar_(round|square)_1x1$|^dungeon_stone_pillar_[12]$|^dungeon_pillar_base$/),
        dungAltars:   MB_GET_POOL(/^dungeon_feature_altar_gold$|^dungeon_tomb_(1|open)$|^dungeon_feature_metal_cage_gold$/),
        dungRubble:   MB_GET_POOL(/^other_rubble_(small|medium|stone_pile)|^dungeon_blood_[1-5]$|^other_ruin_[1-6]$/),

        // Город / Столица
        cityRoofs:    MB_GET_POOL(/^city_roof_(tiled|thatch)_6x4_shaded$|^city_roof_premade_8x6$/),
        cityCenter:   MB_GET_POOL(/^city_fountain$|^city_well$|^city_feature_statue_[1-3]_stone$|^city_statue[1-3]$/),
        cityCarts:    MB_GET_POOL(/^city_cart_|^city_wagon$|^other_horse2?$/),
        cityLamps:    MB_GET_POOL(/^city_woodlamp$|^other_light_stand_lit_iron$/),
        cityMarket:   MB_GET_POOL(/^other_apples$|^other_baskets$|^other_clutter_sacks_[12]$|^furniture_storage_crate_[12]_dark$|^furniture_storage_barrel_[12]_dark$/),

        // Богатый особняк
        manChairs:    MB_GET_POOL(/^furniture_chair_(sofa_1_[abc]|armchair_1_[a-d]|throne_stone)$/),
        manFeatures:  MB_GET_POOL(/^furniture_feature_(piano_|billiards_table)|^other_feature_(orrery_|armillary_|telescope_medium|suit_of_armor_)/),
        manLights:    MB_GET_POOL(/^other_light_chandelier_[1-4]_lit_/),
        manBooks:     MB_GET_POOL(/^furniture_storage_bookshelf_|^furniture_table_writing_desk_dark$|^other_clutter_globe$|^furniture_clutter_book_pile_/),
        manCats:      MB_GET_POOL(/^other_cat_/),

        // Дварфийская кузница
        dwForge:      MB_GET_POOL(/^dungeon_forge$|^dungeon_forge_anvil$|^dungeon_anvil$|^dungeon_melting_pot/),
        dwLoot:       MB_GET_POOL(/^dungeon_(gold|iron|bronze)_ingot$|^furniture_casting_table_axes$|^dungeon_axe_[12]$|^dungeon_hammer_1$|^dungeon_small_keg$/),
        dwStatues:    MB_GET_POOL(/^city_large_statue$|^dungeon_gold_wall_decoration$|^dungeon_pillar$/),

        // Пиратская бухта
        palms:        MB_GET_POOL(/^nature_palmtree2?$|^nature_tree_(large|small)_palm_/),
        pirateLoot:   MB_GET_POOL(/^dungeon_chestoctopus$|^other_coinbag$|^other_coinlarge4$|^camp_pirateflag$|^other_anchor2$|^city_shipswheel$|^furniture_messagebottle$|^other_largerope$/),
        beachLife:    MB_GET_POOL(/^other_(crab|coconutcrab2?|shell|shell8|starfish4?|sharkjaw|parrot|seagull)$/),
        boats:        MB_GET_POOL(/^other_canoe$/),

        // Пустыня
        desertCacti:  MB_GET_POOL(/^nature_cactus_(ball|flowering|large|saguaro|small)_|^nature_desert_(shrubs|grass)_|^other_aeonium_/),
        desertRocks:  MB_GET_POOL(/^nature_rocks[678]$|^nature_rock_formation_[2-6]$/),
        desertTents:  MB_GET_POOL(/^camp_tent_(large_9x5|small_5x4)$|^camp_tentlarge$/),
        desertProps:  MB_GET_POOL(/^other_pot5?$|^other_deadwood3$|^furniture_carpet_[123]_3x2$|^dungeon_bones_cow_skull_1x1$|^other_snake3?$/),

        // Фейский лес (ТОЛЬКО здесь сине-фиолетовые деревья и светящиеся грибы!)
        feyTrees:     MB_GET_POOL(/^nature_tree[234]$|^other_giantleafpurple/),
        feyFungi:     MB_GET_POOL(/^nature_fungi_(10_purple|2[678]_blue|[89]_orange|1[123]_yellow)$|^nature_mushroom_(5|2[123])_blue$|^other_spore_cloud_/),
        feyDecor:     MB_GET_POOL(/^nature_rootsorb2$|^nature_roots[246]$|^nature_giantroots5$|^nature_trumpetflower$|^dungeon_flytrap2?$|^other_lily[23]?$/),
        feyCrystals:  MB_GET_POOL(/^dungeon_crystal(blue|red)$|^dungeon_crystal_(horizontal|vertical)_/),

        // Восточный храм / додзё
        eastMats:     MB_GET_POOL(/^furniture_tatami_mat_(large|small|round_[12])$/),
        eastTables:   MB_GET_POOL(/^furniture_table_(kotatsu|game|[1-6])$/),
        eastDecor:    MB_GET_POOL(/^other_bonsai_|^other_paper_screen_|^other_shrine_|^other_samurai_armor_|^camp_weapons_(katanas|daisho|sword_rack)$|^other_taiko_drum$|^other_cushion_/),
        eastLights:   MB_GET_POOL(/^city_paper_lamp$|^other_paper_lantern_/),
        eastDoors:    MB_GET_POOL(/^dungeon_door_shoji_[12]$/),

        // Лагерь охотников / орков
        orcTents:     MB_GET_POOL(/^other_shelter$|^camp_tentsmallround$|^camp_tent_square_[123]$/),
        orcProps:     MB_GET_POOL(/^camp_totemlarge$|^dungeon_giantskull$|^dungeon_skullstake$|^other_meatrack$|^other_tanningrack2$|^camp_weaponrack$|^other_warhorn$|^camp_(beaver|wolf|small)pelt$|^camp_campfire_hog$|^dungeon_campfire_cooking_spit$/),

        // Поле битвы
        siege:        MB_GET_POOL(/^camp_ballista$|^camp_cannon$|^other_catapult$|^camp_batteringrambroken$|^effects_acidcauldron$|^dungeon_pitchcauldron$/),
        barricades:   MB_GET_POOL(/^furniture_barricade$|^other_woodenstakes$|^other_largeflag$/),
        battleLoot:   MB_GET_POOL(/^camp_(greatsword|longsword|weapon_sword|weapon_axe|weapon_shield)|^camp_cannonballs2?$|^effects_ballistabolts$/),
        battleFire:   MB_GET_POOL(/^other_embers_5x5$|^other_fiery_area_1_4x4$|^other_flaming_sphere_/),

        // Зима
        snowRocks:    MB_GET_POOL(/^nature_rock_[123]$|^nature_boulder$|^nature_rocks_[1-5]$/),
        snowPelts:    MB_GET_POOL(/^camp_(wolf|beaver)pelt$|^camp_peltwolf$|^furniture_bedroll_[12]$/)
    };

    let genTitle = 'Случайная локация';

    // ============================================================
    // 1. ДИКИЙ ЛЕС (3 разных сценария: Река и мост / Перекрёсток / Заросшие руины)
    // ============================================================
    if (picked === 'forest') {
        const variant = MB_PICK(['river', 'crossroads', 'ruins']);
        const isAutumn = Math.random() < 0.25;
        const leafTile = isAutumn ? 'leaves_red' : 'leaves_green';
        if (isAutumn) { window._mbLighting = 'sunset'; data.lighting = 'sunset'; }

        // Пятна лесной листвы на траве для живописности
        for (let i = 0; i < Math.floor((cols * rows) / 14); i++) {
            const lx = MB_RAND_INT(1, cols - 2), ly = MB_RAND_INT(1, rows - 2);
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
                if (Math.random() < 0.55) setTile(lx + dc, ly + dr, leafTile);
            }
        }

        if (variant === 'river') {
            genTitle = isAutumn ? 'Осенняя переправа' : MB_PICK(['Лесная переправа', 'Тропа через реку', 'Чаща у брода']);
            let rx = MB_RAND_INT(Math.floor(cols * 0.32), Math.floor(cols * 0.68));
            const rW = cols >= 26 ? 3 : 2;
            for (let r = 0; r < rows; r++) {
                if (Math.random() < 0.45) rx = Math.max(3, Math.min(cols - rW - 3, rx + MB_RAND_INT(-1, 1)));
                for (let w = 0; w < rW; w++) setTile(rx + w, r, 'water');
            }
            let py = MB_RAND_INT(Math.floor(rows * 0.3), Math.floor(rows * 0.68));
            let bridgePos = null;
            for (let c = 0; c < cols; c++) {
                if (Math.random() < 0.22) py = Math.max(2, Math.min(rows - 3, py + MB_RAND_INT(-1, 1)));
                for (let dy = 0; dy <= 1; dy++) {
                    if (getTile(c, py + dy) === 'water') {
                        if (!bridgePos) bridgePos = { x: c + rW * 0.5, y: py + 0.9 };
                    } else {
                        setTile(c, py + dy, 'dirt');
                    }
                }
            }
            if (bridgePos) addObj(P.bridges, bridgePos.x, bridgePos.y, rW >= 3 ? 1.25 : 1.0, 0, 2.2);

            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                if (getTile(c, r) === 'water' && canPlace(c + 0.5, r + 0.5, 1.3) && Math.random() < 0.14) {
                    addObj(P.waterDec, c + MB_RAND_FLOAT(0.25, 0.75), r + MB_RAND_FLOAT(0.25, 0.75), MB_RAND_FLOAT(0.75, 1.1), MB_RAND_INT(0, 359), 0.8);
                }
            }
        } else if (variant === 'crossroads') {
            genTitle = isAutumn ? 'Осенний тракт' : 'Лесной перекрёсток и привал';
            const mx = Math.floor(cols / 2), my = Math.floor(rows / 2);
            for (let c = 0; c < cols; c++) { setTile(c, my, 'dirt'); setTile(c, my - 1, 'dirt'); }
            for (let r = 0; r < rows; r++) { setTile(mx, r, 'dirt'); setTile(mx - 1, r, 'dirt'); }
            // Лагерь у перекрёстка
            const cx = mx + 3.2, cy = my - 3.2;
            if (inBounds(Math.floor(cx), Math.floor(cy))) {
                for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) setTile(Math.floor(cx) + dc, Math.floor(cy) + dr, 'dirt');
                addObj(P.campfires, cx, cy, 1.0, 0, 1.5);
                addObj(P.campTents, cx + 1.8, cy - 0.8, 0.95, -20, 1.8);
                addObj(P.campGear, cx - 1.3, cy + 0.9, 0.85, 45, 1.0);
                addObj(P.forestLogs, cx + 0.3, cy + 1.5, 0.85, 10, 1.0);
            }
        } else {
            genTitle = 'Заросшие руины в чаще';
            const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
            for (let r = cy - 2; r <= cy + 2; r++) for (let c = cx - 3; c <= cx + 3; c++) {
                if (Math.random() < 0.75) setTile(c, r, 'stone');
            }
            addObj(P.dungRubble, cx - 2.2, cy - 1.5, 1.1, 0, 1.3);
            addObj(P.dungRubble, cx + 2.2, cy + 1.5, 1.1, 90, 1.3);
            addObj(P.dungPillars, cx - 2.0, cy + 1.5, 0.95, 0, 1.0);
            addObj(P.dungPillars, cx + 2.0, cy - 1.5, 0.95, 0, 1.0);
            addObj(P.campfires, cx + 0.5, cy + 0.5, 1.0, 0, 1.4);
            addObj(P.dungChests, cx + 1.6, cy + 0.2, 0.85, 0, 1.0);
        }

        // Расставляем естественный лес без перекрытий и без заезда на дорогу/воду
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const t = getTile(c, r);
                if (t !== 'grass' && t !== leafTile) continue;
                const ox = c + MB_RAND_FLOAT(0.2, 0.8), oy = r + MB_RAND_FLOAT(0.2, 0.8);
                if (!canPlace(ox, oy, 1.35)) continue;
                const rnd = Math.random();
                if (rnd < 0.14) addObj(P.greenTrees, ox, oy, MB_RAND_FLOAT(0.85, 1.28), MB_RAND_INT(0, 359), 1.6);
                else if (rnd < 0.24) addObj(isAutumn && Math.random() < 0.5 ? P.autumnBushes : P.greenBushes, ox, oy, MB_RAND_FLOAT(0.75, 1.15), MB_RAND_INT(0, 359), 0.95);
                else if (rnd < 0.29) addObj(P.forestFlower, ox, oy, MB_RAND_FLOAT(0.7, 1.05), MB_RAND_INT(0, 359), 0.7);
                else if (rnd < 0.33) addObj(P.forestRocks, ox, oy, MB_RAND_FLOAT(0.75, 1.1), MB_RAND_INT(0, 359), 1.0);
                else if (rnd < 0.355) addObj(P.forestLogs, ox, oy, MB_RAND_FLOAT(0.8, 1.05), MB_RAND_INT(0, 359), 1.1);
                else if (rnd < 0.37) addObj(P.forestFungi, ox, oy, MB_RAND_FLOAT(0.65, 0.9), MB_RAND_INT(0, 359), 0.6);
            }
        }
    }

    // ============================================================
    // 2. УЮТНАЯ ТАВЕРНА (строго зелёный двор снаружи + логичный интерьер)
    // ============================================================
    else if (picked === 'tavern') {
        genTitle = MB_PICK(['Таверна «Золотой Гоблин»', 'Постоялый двор «У Древа»', 'Трактир «Старый Очаг»']);
        const mX = Math.max(1, Math.floor(cols * 0.12));
        const mY = Math.max(1, Math.floor(rows * 0.12));
        const x1 = mX, x2 = cols - 1 - mX, y1 = mY, y2 = rows - 1 - mY;

        for (let r = y1; r <= y2; r++) {
            for (let c = x1; c <= x2; c++) {
                const isWall = (r === y1 || r === y2 || c === x1 || c === x2);
                setTile(c, r, isWall ? 'wall' : 'wood');
            }
        }

        // Отдельная комната/кладовая, если есть место
        const splitX = (x2 - x1 >= 10) ? (x2 - 4) : -1;
        const midY = Math.floor((y1 + y2) / 2);
        if (splitX > 0) {
            for (let r = y1 + 1; r < y2; r++) if (r !== midY) setTile(splitX, r, 'wall');
            addObj(P.doors, splitX + 0.5, midY + 0.5, 0.78, 90, 1.1);
        }

        // Главный вход + мощёная/земляная дорожка снаружи
        setTile(x1, midY, 'wood');
        addObj(P.doors, x1 + 0.5, midY + 0.5, 0.82, 90, 1.2);
        for (let c = 0; c < x1; c++) { setTile(c, midY, 'dirt'); if (midY + 1 < rows) setTile(c, midY + 1, 'dirt'); }

        const hallRight = splitX > 0 ? splitX - 1 : x2 - 1;
        // Камин + ковёр у северной стены
        const hearthX = Math.floor((x1 + hallRight) / 2);
        setTile(hearthX, y1 + 1, 'stone');
        addObj(P.tavFireplace, hearthX + 0.5, y1 + 1.3, 1.05, 0, 1.4);
        addObj(P.tavRugs, hearthX + 0.5, y1 + 2.8, 1.1, 0, 0);

        // Барная зона вдоль восточной стены зала
        const barX = hallRight - 0.6;
        for (let r = y1 + 2; r <= Math.min(y2 - 2, y1 + 5); r += 1.2) {
            addObj(P.tavBarrels, barX, r, 0.82, MB_RAND_INT(0, 359), 0.75);
        }
        addObj(P.tavCandles, barX - 0.8, y1 + 2.2, 0.8, 0, 0.4);

        // Аккуратные столики со стульями, едой и свечами (без наложения на стены!)
        for (let r = y1 + 2.5; r <= y2 - 1.8; r += 2.8) {
            for (let c = x1 + 2.2; c <= hallRight - 2.3; c += 3.0) {
                if (!canPlace(c, r, 1.9)) continue;
                addObj(P.tavTables, c, r, MB_RAND_FLOAT(0.85, 1.0), MB_PICK([0, 90]), 1.6);
                addObj(P.tavChairs, c, r - 0.78, 0.78, 180, 0);
                addObj(P.tavChairs, c, r + 0.78, 0.78, 0, 0);
                if (Math.random() < 0.75) addObj(P.tavFood, c - 0.15, r, 0.62, MB_RAND_INT(0, 359), 0);
                if (Math.random() < 0.65) addObj(P.tavCandles, c + 0.28, r - 0.1, 0.62, 0, 0);
            }
        }

        // Спальня / подсобка за перегородкой
        if (splitX > 0) {
            addObj(P.tavBeds, x2 - 1.3, y1 + 1.9, 0.95, 0, 1.3);
            if (y2 - y1 >= 7) addObj(P.tavBeds, x2 - 1.3, y2 - 1.7, 0.95, 0, 1.3);
            addObj(P.tavShelves, splitX + 1.2, y1 + 1.35, 0.9, 0, 1.0);
            addObj(P.tavCrates, splitX + 1.2, y2 - 1.35, 0.85, 15, 0.9);
            addObj(P.tavCandles, x2 - 2.2, y1 + 1.8, 0.65, 0, 0);
        }

        // Двор снаружи таверны: ТОЛЬКО нормальные зелёные деревья/кусты и тележка/дрова!
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (getTile(c, r) !== 'grass') continue;
                // Не ставим деревья прямо впритык к стене здания
                if (c >= x1 - 1 && c <= x2 + 1 && r >= y1 - 1 && r <= y2 + 1) {
                    if (Math.random() < 0.12 && canPlace(c + 0.5, r + 0.5, 1.4)) {
                        addObj(P.greenBushes, c + 0.5, r + 0.5, 0.8, MB_RAND_INT(0, 359), 1.0);
                    }
                    continue;
                }
                if (canPlace(c + 0.5, r + 0.5, 1.8) && Math.random() < 0.35) {
                    addObj(Math.random() < 0.65 ? P.greenTrees : P.greenBushes, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.8, 1.15), MB_RAND_INT(0, 359), 1.6);
                }
            }
        }
    }

    // ============================================================
    // 3. ПОДЗЕМЕЛЬЕ / КАТАКОМБЫ
    // ============================================================
    else if (picked === 'dungeon') {
        genTitle = MB_PICK(['Забытые катакомбы', 'Подземелье Ошибки', 'Гробница Древних', 'Сырые казематы']);
        const floorType = Math.random() < 0.5 ? 'stone' : 'flagstone';
        const rooms = [];
        const attempts = Math.max(8, Math.floor((cols * rows) / 20));
        for (let a = 0; a < attempts; a++) {
            const rw = MB_RAND_INT(4, Math.min(9, Math.max(5, Math.floor(cols / 2.7))));
            const rh = MB_RAND_INT(4, Math.min(8, Math.max(5, Math.floor(rows / 2.5))));
            const rx = MB_RAND_INT(1, Math.max(1, cols - rw - 2));
            const ry = MB_RAND_INT(1, Math.max(1, rows - rh - 2));
            const overlaps = rooms.some(rm => rx <= rm.x + rm.w + 1 && rx + rw + 1 >= rm.x && ry <= rm.y + rm.h + 1 && ry + rh + 1 >= rm.y);
            if (!overlaps) {
                rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: rx + rw / 2, cy: ry + rh / 2 });
                for (let r = ry; r < ry + rh; r++) for (let c = rx; c < rx + rw; c++) setTile(c, r, floorType);
            }
        }

        const corrW = cols >= 26 ? 2 : 1;
        for (let i = 1; i < rooms.length; i++) {
            const p = rooms[i - 1], n = rooms[i];
            let x = Math.floor(p.cx), y = Math.floor(p.cy);
            const tx = Math.floor(n.cx), ty = Math.floor(n.cy);
            while (x !== tx) { for (let d = 0; d < corrW; d++) setTile(x, y + d, floorType); x += (tx > x ? 1 : -1); }
            while (y !== ty) { for (let d = 0; d < corrW; d++) setTile(x + d, y, floorType); y += (ty > y ? 1 : -1); }
        }

        const hazard = MB_PICK(['lava', 'water', 'abyss']);
        rooms.forEach((rm, idx) => {
            addObj(P.dungBraziers, rm.x + 0.75, rm.y + 0.75, 0.85, 0, 0.9);
            if (rm.w >= 5) addObj(P.dungBraziers, rm.x + rm.w - 0.75, rm.y + rm.h - 0.75, 0.85, 0, 0.9);
            if (Math.random() < 0.75) addObj(P.dungWebs, rm.x + rm.w - 0.55, rm.y + 0.55, 0.9, MB_RAND_INT(0, 359), 0);
            if (Math.random() < 0.55) addObj(P.dungRubble, rm.x + 0.85, rm.y + rm.h - 0.85, 0.85, MB_RAND_INT(0, 359), 0.8);

            if (idx === rooms.length - 1) {
                addObj(P.tavRugs, rm.cx, rm.cy, 1.25, 0, 0);
                addObj(P.dungAltars, rm.cx, rm.cy, 1.15, 0, 1.4);
                addObj(P.dungChests, rm.cx + 1.5, rm.cy - 0.4, 0.9, 0, 0.9);
            } else {
                const theme = Math.random();
                if (theme < 0.32 && rm.w >= 5 && rm.h >= 5) {
                    for (let r = Math.floor(rm.cy) - 1; r <= Math.floor(rm.cy); r++) {
                        for (let c = Math.floor(rm.cx) - 1; c <= Math.floor(rm.cx); c++) setTile(c, r, hazard);
                    }
                    addObj(P.dungPillars, rm.x + 1.2, rm.y + 1.2, 0.9, 0, 0.8);
                    addObj(P.dungPillars, rm.x + rm.w - 1.2, rm.y + 1.2, 0.9, 0, 0.8);
                } else if (theme < 0.65) {
                    addObj(P.dungBones, rm.cx, rm.cy, 0.95, MB_RAND_INT(0, 359), 0.9);
                    addObj(P.dungChests, rm.x + rm.w - 1.1, rm.cy, 0.85, MB_PICK([0, 90, 180]), 0.9);
                } else {
                    addObj(P.tavCrates, rm.cx - 0.8, rm.cy, 0.85, MB_RAND_INT(0, 359), 0.8);
                    addObj(P.tavBarrels, rm.cx + 0.7, rm.cy + 0.4, 0.85, MB_RAND_INT(0, 359), 0.8);
                }
            }
        });
    }

    // ============================================================
    // 4. ГОРОД / СТОЛИЦА / РЫНОК
    // ============================================================
    else if (picked === 'city') {
        const isCapital = cols >= 26;
        genTitle = isCapital ? MB_PICK(['Столица Империи', 'Центральная площадь', 'Торговый квартал']) : MB_PICK(['Деревня Притишье', 'Ярмарочная площадь', 'Городская застава']);
        const street = isCapital ? 'cobble' : 'dirt';
        const midX = Math.floor(cols / 2), midY = Math.floor(rows / 2);
        const roadW = isCapital ? 3 : 2;

        for (let c = 0; c < cols; c++) for (let d = 0; d < roadW; d++) setTile(c, Math.min(rows - 1, midY - 1 + d), street);
        for (let r = 0; r < rows; r++) for (let d = 0; d < roadW; d++) setTile(Math.min(cols - 1, midX - 1 + d), r, street);

        const pRad = isCapital ? 3 : 2;
        for (let r = midY - pRad; r <= midY + pRad; r++) for (let c = midX - pRad; c <= midX + pRad; c++) setTile(c, r, 'cobble');
        addObj(P.cityCenter, midX + 0.5, midY + 0.5, 1.2, 0, 1.8);
        [[midX - pRad, midY - pRad], [midX + pRad, midY - pRad], [midX - pRad, midY + pRad], [midX + pRad, midY + pRad]].forEach(([lx, ly]) => {
            addObj(P.cityLamps, lx + 0.5, ly + 0.5, 0.85, 0, 0.8);
        });
        addObj(P.cityCarts, midX - pRad - 1.8, midY + 0.5, 0.95, 0, 1.5);
        addObj(P.cityCarts, midX + pRad + 2.0, midY + 0.4, 0.95, 180, 1.5);

        if (isCapital) {
            for (let c = 0; c < cols; c++) if (Math.abs(c - midX) > 1) { setTile(c, 0, 'wall'); setTile(c, rows - 1, 'wall'); }
            for (let r = 0; r < rows; r++) if (Math.abs(r - midY) > 1) { setTile(0, r, 'wall'); setTile(cols - 1, r, 'wall'); }
        }

        for (let r = 2.5; r < rows - 2; r += 4.2) {
            for (let c = 2.5; c < cols - 2; c += 5.2) {
                if (Math.abs(c - midX) <= pRad + 1.8 || Math.abs(r - midY) <= pRad + 1.6) continue;
                if (!canPlace(c, r, 3.2)) continue;
                if (Math.random() < 0.72) {
                    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (getTile(Math.floor(c) + dc, Math.floor(r) + dr) === 'grass') setTile(Math.floor(c) + dc, Math.floor(r) + dr, 'cobble');
                    addObj(P.cityRoofs, c, r, MB_RAND_FLOAT(0.88, 1.08), MB_PICK([0, 90, 180, 270]), 2.8);
                    addObj(P.cityMarket, c + 1.9, r + 1.3, 0.78, MB_RAND_INT(0, 90), 0.7);
                } else {
                    addObj(P.greenTrees, c, r, 1.05, MB_RAND_INT(0, 359), 1.6);
                    addObj(P.forestFlower, c + 1.2, r + 0.8, 0.85, MB_RAND_INT(0, 359), 0.7);
                }
            }
        }
    }

    // ============================================================
    // 5. БОГАТЫЙ ОСОБНЯК / ТРОННЫЙ ЗАЛ
    // ============================================================
    else if (picked === 'mansion') {
        genTitle = MB_PICK(['Тронный зал Министра', 'Особняк аристократа', 'Библиотека и галерея']);
        for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
            setTile(c, r, (r >= 3 && r <= rows - 4 && c >= 3 && c <= cols - 4) ? 'wood' : 'flagstone');
        }
        const midY = Math.floor(rows / 2);
        setTile(0, midY, 'flagstone');
        addObj(P.doors, 0.5, midY + 0.5, 0.9, 90, 1.2);

        // Ковровая дорожка к трону / роялю
        for (let c = 3; c <= cols - 4; c += 2.6) addObj(P.tavRugs, c, midY + 0.5, 1.15, 0, 0);
        // Трон или парадный стол в восточной части
        addObj('furniture_chair_throne_stone', cols - 2.4, midY + 0.5, 1.15, 270, 1.6);
        // Люстры по центру зала (дают мягкий золотой свет!)
        for (let c = 4; c < cols - 3; c += 5) addObj(P.manLights, c, midY + 0.5, 1.05, 0, 0);
        // Шкафы, камины, рояль, телескоп, доспехи вдоль стен
        for (let c = 2.5; c <= cols - 3; c += 3.2) {
            addObj(Math.random() < 0.5 ? P.manBooks : P.manFeatures, c, 1.7, 0.92, 0, 1.3);
            addObj(Math.random() < 0.5 ? P.manChairs : P.manFeatures, c, rows - 1.7, 0.92, 180, 1.3);
        }
        if (Math.random() < 0.7) addObj(P.manCats, cols / 2, midY + 1.8, 0.8, MB_RAND_INT(0, 359), 0);
    }

    // ============================================================
    // 6. КУЗНИЦА И ЗАЛЫ ДВАРФОВ
    // ============================================================
    else if (picked === 'dwarven') {
        genTitle = MB_PICK(['Великая Кузница Дварфов', 'Плавильный зал', 'Подгорный бастион']);
        for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) setTile(c, r, 'flagstone');
        // Каналы с расплавленной лавой вдоль северной и южной стен
        for (let c = 2; c < cols - 2; c++) {
            setTile(c, 1, 'lava'); setTile(c, rows - 2, 'lava');
        }
        const midY = Math.floor(rows / 2);
        // Центральные горны, чаны с металлом, наковальни
        for (let c = 4; c < cols - 3; c += 4.5) {
            addObj(P.dwForge, c, midY - 1.2, 1.1, 0, 1.5);
            addObj(P.dwLoot, c + 1.2, midY + 1.2, 0.95, MB_RAND_INT(0, 359), 1.1);
            addObj(P.dungPillars, c, 2.8, 0.95, 0, 1.0);
            addObj(P.dungPillars, c, rows - 2.8, 0.95, 0, 1.0);
        }
        addObj(P.dwStatues, cols - 2.4, midY + 0.5, 1.25, 270, 1.6);
        addObj(P.dungBraziers, 2.2, midY - 1.2, 0.9, 0, 0.8);
        addObj(P.dungBraziers, 2.2, midY + 1.8, 0.9, 0, 0.8);
        addObj(P.dungChests, cols - 3.6, midY + 1.5, 0.9, 0, 0.9);
    }

    // ============================================================
    // 7. ПИРАТСКАЯ БУХТА И ПОБЕРЕЖЬЕ
    // ============================================================
    else if (picked === 'pirate') {
        genTitle = MB_PICK(['Бухта Контрабандистов', 'Пиратский берег', 'Остров Сокровищ']);
        // Вода с одной стороны (береговая линия)
        let shore = Math.floor(cols * 0.48);
        for (let r = 0; r < rows; r++) {
            if (Math.random() < 0.5) shore = Math.max(4, Math.min(cols - 5, shore + MB_RAND_INT(-1, 1)));
            for (let c = 0; c < shore; c++) setTile(c, r, 'water');
            for (let c = shore + 4; c < cols; c++) if (Math.random() < 0.65) setTile(c, r, 'grass');
        }
        // Пирс и лодка на воде
        const pierY = Math.floor(rows / 2);
        addObj(P.bridges, shore - 0.5, pierY + 0.5, 1.1, 0, 2.0);
        addObj(P.boats, Math.max(2, shore - 3.2), pierY + 2.2, 1.15, MB_RAND_INT(-30, 30), 1.6);
        // Пиратский лагерь с сокровищами на пляже
        const cx = Math.min(cols - 3, shore + 2.5), cy = Math.max(2.5, pierY - 1.5);
        addObj(P.campfires, cx, cy, 1.0, 0, 1.4);
        addObj(P.pirateLoot, cx + 1.6, cy + 0.8, 1.0, MB_RAND_INT(0, 359), 1.0);
        addObj(P.pirateLoot, cx - 0.4, cy + 1.8, 0.9, MB_RAND_INT(0, 359), 1.0);
        addObj(P.tavBarrels, cx + 1.5, cy - 1.1, 0.85, 0, 0.8);

        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const t = getTile(c, r);
            if (!canPlace(c + 0.5, r + 0.5, 1.4)) continue;
            if (t === 'grass' && Math.random() < 0.22) addObj(P.palms, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.85, 1.2), MB_RAND_INT(0, 359), 1.8);
            else if (t === 'sand' && Math.random() < 0.14) addObj(Math.random() < 0.7 ? P.beachLife : P.pirateLoot, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.75, 1.05), MB_RAND_INT(0, 359), 1.0);
        }
    }

    // ============================================================
    // 8. ПУСТЫННЫЙ ОАЗИС И КАРАВАН
    // ============================================================
    else if (picked === 'desert') {
        genTitle = MB_PICK(['Оазис Забытых Песков', 'Стоянка каравана', 'Дюны у источника']);
        const ox = MB_RAND_INT(Math.floor(cols * 0.38), Math.floor(cols * 0.62));
        const oy = MB_RAND_INT(Math.floor(rows * 0.35), Math.floor(rows * 0.65));
        const rad = Math.max(2.0, Math.min(cols, rows) * 0.21);

        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const dist = Math.hypot(c - ox, r - oy);
            if (dist < rad) setTile(c, r, 'water');
            else if (dist < rad + 1.5) setTile(c, r, 'grass');
        }
        for (let a = 0; a < 7; a++) {
            const ang = (a / 7) * Math.PI * 2 + MB_RAND_FLOAT(-0.2, 0.2);
            const px = ox + Math.cos(ang) * (rad + 1.25), py = oy + Math.sin(ang) * (rad + 1.25);
            if (inBounds(Math.floor(px), Math.floor(py)) && canPlace(px, py, 1.6)) addObj(P.palms, px, py, MB_RAND_FLOAT(0.85, 1.15), MB_RAND_INT(0, 359), 1.5);
        }
        const tx = ox > cols / 2 ? 3.5 : cols - 3.5, ty = oy > rows / 2 ? 3.5 : rows - 3.5;
        addObj(P.desertTents, tx, ty, 0.9, MB_RAND_INT(-25, 25), 2.4);
        addObj('camp_desert_campfire_1x1', tx + (ox > tx ? 2.4 : -2.4), ty + 0.6, 1.0, 0, 1.3);
        addObj(P.desertProps, tx, ty + 2.0, 0.9, MB_RAND_INT(0, 359), 1.0);

        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            if (getTile(c, r) !== 'sand' || !canPlace(c + 0.5, r + 0.5, 1.5)) continue;
            const rnd = Math.random();
            if (rnd < 0.09) addObj(P.desertCacti, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.8, 1.1), MB_RAND_INT(0, 359), 1.2);
            else if (rnd < 0.14) addObj(P.desertRocks, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.8, 1.15), MB_RAND_INT(0, 359), 1.3);
            else if (rnd < 0.16) addObj(P.desertProps, c + 0.5, r + 0.5, 0.9, MB_RAND_INT(0, 359), 1.0);
        }
    }

    // ============================================================
    // 9. ФЕЙСКИЙ ЛЕС (МАГИЧЕСКАЯ РОЩА — ТОЛЬКО ЗДЕСЬ СИНЕ-ФИОЛЕТОВАЯ ФЛОРА!)
    // ============================================================
    else if (picked === 'fey') {
        genTitle = MB_PICK(['Фейская роща', 'Светящийся лес Древа', 'Грибное святилище']);
        const cx = cols / 2, cy = rows / 2;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const d = Math.hypot((c - cx) * 0.85, r - cy);
            if (d < 2.2) setTile(c, r, 'water');
            else if (d < 4.5 && Math.random() < 0.45) setTile(c, r, 'leaves_green');
        }
        addObj('furniture_feythrone', cx, cy - 2.6, 1.15, 0, 1.6);
        addObj(P.feyCrystals, cx - 2.4, cy - 1.3, 1.0, 0, 1.1);
        addObj(P.feyCrystals, cx + 2.4, cy - 1.3, 1.0, 0, 1.1);
        addObj(P.feyCrystals, cx, cy + 2.7, 1.0, 0, 1.1);

        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const t = getTile(c, r);
            if (t === 'water') {
                if (Math.random() < 0.25 && canPlace(c + 0.5, r + 0.5, 1.0)) addObj(P.waterDec, c + 0.5, r + 0.5, 0.9, MB_RAND_INT(0, 359), 0.8);
                continue;
            }
            const ox = c + MB_RAND_FLOAT(0.2, 0.8), oy = r + MB_RAND_FLOAT(0.2, 0.8);
            if (!canPlace(ox, oy, 1.4)) continue;
            const rnd = Math.random();
            if (rnd < 0.16) addObj(P.feyTrees, ox, oy, MB_RAND_FLOAT(0.85, 1.25), MB_RAND_INT(0, 359), 1.7);
            else if (rnd < 0.30) addObj(P.feyFungi, ox, oy, MB_RAND_FLOAT(0.75, 1.25), MB_RAND_INT(0, 359), 0.95);
            else if (rnd < 0.37) addObj(P.feyDecor, ox, oy, MB_RAND_FLOAT(0.8, 1.15), MB_RAND_INT(0, 359), 1.0);
            else if (rnd < 0.40) addObj(P.feyCrystals, ox, oy, MB_RAND_FLOAT(0.75, 1.0), MB_RAND_INT(0, 359), 1.0);
        }
    }

    // ============================================================
    // 10. ВОСТОЧНЫЙ ХРАМ / ДОДЗЁ
    // ============================================================
    else if (picked === 'eastern') {
        genTitle = MB_PICK(['Восточное додзё', 'Храм Тихого Лотоса', 'Чайный дом']);
        const x1 = 2, x2 = cols - 3, y1 = 2, y2 = rows - 3;
        for (let r = y1; r <= y2; r++) for (let c = x1; c <= x2; c++) {
            const isW = (r === y1 || r === y2 || c === x1 || c === x2);
            setTile(c, r, isW ? 'wall' : 'wood');
        }
        const midX = Math.floor(cols / 2), midY = Math.floor(rows / 2);
        setTile(x1, midY, 'wood');
        addObj(P.eastDoors, x1 + 0.5, midY + 0.5, 0.85, 90, 1.2);
        // Татами по центру зала
        for (let c = x1 + 3; c <= x2 - 3; c += 2.6) addObj(P.eastMats, c, midY + 0.5, 1.05, 0, 0);
        // Алтарь и доспехи у восточной стены
        addObj('other_shrine_1', x2 - 1.4, midY + 0.5, 1.1, 270, 1.4);
        addObj(P.eastLights, x2 - 1.4, y1 + 1.5, 0.85, 0, 0.8);
        addObj(P.eastLights, x2 - 1.4, y2 - 1.5, 0.85, 0, 0.8);
        addObj(P.eastLights, x1 + 1.5, midY - 1.5, 0.85, 0, 0.8);
        addObj(P.eastLights, x1 + 1.5, midY + 2.2, 0.85, 0, 0.8);
        // Столики котацу, стойки с катанами, бонсай
        for (let c = x1 + 2.5; c <= x2 - 3; c += 3.5) {
            addObj(P.eastTables, c, y1 + 1.8, 0.9, 0, 1.3);
            addObj(P.eastDecor, c, y2 - 1.6, 0.9, 180, 1.3);
        }
        // Сад с прудом снаружи
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            if (getTile(c, r) === 'grass' && canPlace(c + 0.5, r + 0.5, 1.5) && Math.random() < 0.25) {
                addObj(Math.random() < 0.6 ? P.greenTrees : P.forestRocks, c + 0.5, r + 0.5, 0.85, MB_RAND_INT(0, 359), 1.4);
            }
        }
    }

    // ============================================================
    // 11. ЛАГЕРЬ ОХОТНИКОВ / ОРКОВ
    // ============================================================
    else if (picked === 'warcamp') {
        genTitle = MB_PICK(['Стойбище охотников', 'Военный лагерь орков', 'Разбойничья застава']);
        const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
        const radX = cols * 0.34, radY = rows * 0.34;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            const d = Math.hypot((c - cx) / radX, (r - cy) / radY);
            if (d < 1.0) setTile(c, r, 'dirt');
        }
        // Центральный костёр с кабаном + тотем
        addObj(P.campfires, cx + 0.5, cy + 0.5, 1.15, 0, 1.6);
        addObj('camp_totemlarge', cx - 1.8, cy - 1.2, 1.05, 0, 1.3);
        // Шатры по кругу
        for (let a = 0; a < 5; a++) {
            const ang = (a / 5) * Math.PI * 2 + 0.3;
            const tx = cx + Math.cos(ang) * (radX * 0.72), ty = cy + Math.sin(ang) * (radY * 0.72);
            if (inBounds(Math.floor(tx), Math.floor(ty)) && canPlace(tx, ty, 2.2)) {
                addObj(P.orcTents, tx, ty, 0.95, Math.round((ang * 180) / Math.PI) + 90, 2.0);
            }
        }
        // Племенной декор, стойки оружия, колья по периметру
        for (let i = 0; i < Math.floor((cols * rows) / 20); i++) {
            const rx = MB_RAND_FLOAT(2, cols - 2), ry = MB_RAND_FLOAT(2, rows - 2);
            if (!canPlace(rx, ry, 1.35)) continue;
            if (getTile(Math.floor(rx), Math.floor(ry)) === 'dirt') {
                addObj(P.orcProps, rx, ry, MB_RAND_FLOAT(0.82, 1.05), MB_RAND_INT(0, 359), 1.15);
            } else {
                addObj(Math.random() < 0.65 ? P.greenTrees : P.barricades, rx, ry, MB_RAND_FLOAT(0.85, 1.15), MB_RAND_INT(0, 359), 1.5);
            }
        }
    }

    // ============================================================
    // 12. ПОЛЕ БИТВЫ / ОСАДА
    // ============================================================
    else if (picked === 'battlefield') {
        genTitle = MB_PICK(['Осадный рубеж', 'Поле битвы Псов Империи', 'Штурм укреплений']);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            if (Math.abs(c - cols / 2) < cols * 0.30 + (Math.random() - 0.5) * 3) setTile(c, r, 'dirt');
        }
        const leftL = Math.floor(cols * 0.3), rightL = Math.floor(cols * 0.7);
        for (let r = 2; r < rows - 2; r += 2.8) {
            addObj(P.barricades, leftL + 0.5, r + 0.5, 1.0, 90, 1.4);
            addObj(P.barricades, rightL + 0.5, r + 0.5, 1.0, 270, 1.4);
        }
        addObj(P.siege, leftL - 2.3, rows * 0.32, 1.05, 0, 2.0);
        addObj(P.siege, leftL - 2.3, rows * 0.68, 1.05, 0, 2.0);
        addObj(P.siege, rightL + 2.3, rows * 0.5, 1.05, 180, 2.0);
        addObj(P.campTents, 2.4, rows * 0.25, 1.0, 0, 2.0);
        addObj(P.campTents, cols - 2.4, rows * 0.75, 1.0, 180, 2.0);

        for (let i = 0; i < Math.floor((cols * rows) / 18); i++) {
            const fx = MB_RAND_FLOAT(2, cols - 2), fy = MB_RAND_FLOAT(1.5, rows - 1.5);
            if (!canPlace(fx, fy, 1.4)) continue;
            const r = Math.random();
            if (r < 0.25) addObj(P.battleFire, fx, fy, MB_RAND_FLOAT(0.6, 0.95), MB_RAND_INT(0, 359), 1.3);
            else if (r < 0.55) addObj(P.battleLoot, fx, fy, 0.85, MB_RAND_INT(0, 359), 0.9);
            else if (r < 0.8) addObj(P.dungRubble, fx, fy, 0.9, MB_RAND_INT(0, 359), 1.0);
            else addObj(P.forestRocks, fx, fy, 0.9, MB_RAND_INT(0, 359), 1.1);
        }
    }

    // ============================================================
    // 13. СНЕЖНЫЙ ПЕРЕВАЛ И ПРИВАЛ
    // ============================================================
    else if (picked === 'snow') {
        genTitle = MB_PICK(['Ледяной перевал', 'Замёрзшее озеро', 'Привал в горах']);
        const pit = Math.random() < 0.6 ? 'water' : 'abyss';
        const px = cols * MB_RAND_FLOAT(0.38, 0.62), py = rows * MB_RAND_FLOAT(0.35, 0.65);
        const rad = Math.max(2.2, Math.min(cols, rows) * 0.22);
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            if (Math.hypot(c - px, r - py) < rad + (Math.random() - 0.5) * 0.8) setTile(c, r, pit);
        }
        let ty = Math.floor(rows / 2), br = null;
        for (let c = 0; c < cols; c++) {
            if (Math.random() < 0.28) ty = Math.max(2, Math.min(rows - 3, ty + MB_RAND_INT(-1, 1)));
            if (getTile(c, ty) === pit) { if (!br) br = { x: c + 1.5, y: ty + 0.5 }; }
            else setTile(c, ty, 'stone');
        }
        if (br) addObj(P.bridges, br.x, br.y, 1.15, 0, 2.0);

        const cx = Math.max(2.6, cols * 0.2), cy = Math.max(2.6, rows * 0.26);
        addObj(P.campfires, cx, cy, 1.1, 0, 1.5);
        addObj(P.campTents, cx - 1.3, cy + 1.2, 0.95, 20, 1.8);
        addObj(P.snowPelts, cx + 1.3, cy + 0.4, 0.95, 90, 1.0);

        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            if (getTile(c, r) !== 'snow' || !canPlace(c + 0.5, r + 0.5, 1.55)) continue;
            const rnd = Math.random();
            if (rnd < 0.13) addObj(P.greenTrees, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.8, 1.15), MB_RAND_INT(0, 359), 1.6);
            else if (rnd < 0.22) addObj(P.snowRocks, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.8, 1.18), MB_RAND_INT(0, 359), 1.2);
        }
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
                if (nr >= 0 && nr < data.rows && nc >= 0 && nc < data.cols) {
                    data.cells[nr * data.cols + nc].t = window._mbSelectedTile;
                }
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
// ✨ HD-РЕНДЕР V3: ГЛУБИНА ВОДЫ, ОРГАНИЧЕСКИЙ РЕЛЬЕФ, 3D-СТЕНЫ И LIGHTMAP
// ================================================================
function DRAW_ROUNDED_RECT(ctx, x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
}

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
        if (k !== 'wall' && v > maxC) { maxC = v; baseTileKey = k; }
    }

    const fillStyleForTile = (tileKey) => {
        const cfg = tiles[tileKey] || tiles.grass;
        const img = cfg.img ? MB_GET_LOADED_IMG(cfg.img) : null;
        if (img) return MB_GET_TILE_PATTERN(ctx, tileKey, img, cfg.img, cellW);
        return MB_BUILD_PROCEDURAL_PATTERN(ctx, tileKey, cfg, cellW);
    };

    // СЛОЙ 1: Непрерывная подложка основного биома
    ctx.fillStyle = fillStyleForTile(baseTileKey);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // СЛОЙ 2: Все остальные покрытия (включая любые кастомные из assets.js!) с мягкими берегами и переходами
    const presentTiles = new Set(data.cells.map(c => c.t));
    const renderOrder = [...MB_BASE_TILE_ORDER];
    for (const k of presentTiles) if (k !== 'wall' && !renderOrder.includes(k)) renderOrder.push(k);

    for (const tKey of renderOrder) {
        if (tKey === baseTileKey || tKey === 'wall' || !presentTiles.has(tKey)) continue;
        const style = fillStyleForTile(tKey);
        const isOrganic = !['cobble', 'flagstone', 'stone', 'wood'].includes(tKey);
        const bleed = isOrganic ? cellW * 0.16 : 0.6;
        const cornerR = isOrganic ? cellW * 0.42 : cellW * 0.05;

        // 1. Внешний мягкий кант / влажный берег / обгорелая корка
        if (tKey === 'water' || tKey === 'lava' || tKey === 'abyss') {
            ctx.save();
            ctx.fillStyle = tKey === 'lava' ? 'rgba(34, 14, 8, 0.78)' : (tKey === 'water' ? 'rgba(30, 26, 18, 0.38)' : 'rgba(0,0,0,0.72)');
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                if (data.cells[r * cols + c].t !== tKey) continue;
                DRAW_ROUNDED_RECT(ctx, c * cellW - bleed * 1.55, r * cellH - bleed * 1.55, cellW + bleed * 3.1, cellH + bleed * 3.1, cornerR * 1.2);
                ctx.fill();
            }
            ctx.restore();
        } else if (isOrganic) {
            // Мягкое растушёвывание краёв земли/травы/снега/песка
            ctx.save();
            ctx.globalAlpha = 0.42;
            ctx.fillStyle = style;
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                if (data.cells[r * cols + c].t !== tKey) continue;
                DRAW_ROUNDED_RECT(ctx, c * cellW - bleed * 1.35, r * cellH - bleed * 1.35, cellW + bleed * 2.7, cellH + bleed * 2.7, cornerR * 1.25);
                ctx.fill();
            }
            ctx.restore();
        }

        // 2. Основной слой текстуры
        ctx.save();
        ctx.fillStyle = style;
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            if (data.cells[r * cols + c].t !== tKey) continue;
            if (isOrganic) {
                DRAW_ROUNDED_RECT(ctx, c * cellW - bleed, r * cellH - bleed, cellW + bleed * 2, cellH + bleed * 2, cornerR);
                ctx.fill();
            } else {
                ctx.fillRect(c * cellW - 0.5, r * cellH - 0.5, cellW + 1, cellH + 1);
            }
        }
        ctx.restore();

        // 3. Глубина воды и мелководный блик у берега
        if (tKey === 'water' && window._mbPostFx) {
            ctx.save();
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                if (data.cells[r * cols + c].t !== 'water') continue;
                const x = c * cellW, y = r * cellH;
                const allW = (r > 0 && data.cells[(r - 1) * cols + c].t === 'water') &&
                             (r < rows - 1 && data.cells[(r + 1) * cols + c].t === 'water') &&
                             (c > 0 && data.cells[r * cols + c - 1].t === 'water') &&
                             (c < cols - 1 && data.cells[r * cols + c + 1].t === 'water');
                if (allW) {
                    ctx.fillStyle = 'rgba(6, 28, 54, 0.28)';
                    DRAW_ROUNDED_RECT(ctx, x - 3, y - 3, cellW + 6, cellH + 6, cellW * 0.35);
                    ctx.fill();
                } else {
                    ctx.fillStyle = 'rgba(180, 236, 255, 0.14)';
                    ctx.fillRect(x, y, cellW, cellH);
                }
            }
            ctx.restore();
        }
    }

    // СЛОЙ 2.5: Органический светотеневой шум поверх ландшафта (убирает искусственную повторяемость тайлов)
    if (window._mbPostFx) {
        ctx.save();
        ctx.fillStyle = MB_GET_ORGANIC_NOISE_PATTERN(ctx);
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();
    }

    // СЛОЙ 3: Мягкие 3D-тени от стен на пол (Ambient Occlusion + направленная тень)
    ctx.save();
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            if (data.cells[r * cols + c].t === 'wall') continue;
            const x = c * cellW, y = r * cellH;
            const topW = r > 0 && data.cells[(r - 1) * cols + c].t === 'wall';
            const leftW = c > 0 && data.cells[r * cols + c - 1].t === 'wall';
            const botW = r < rows - 1 && data.cells[(r + 1) * cols + c].t === 'wall';
            const rightW = c < cols - 1 && data.cells[r * cols + c + 1].t === 'wall';

            if (topW) {
                const g = ctx.createLinearGradient(x, y, x, y + cellH * 0.58);
                g.addColorStop(0, 'rgba(0,0,0,0.58)'); g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g; ctx.fillRect(x, y, cellW, cellH * 0.58);
            }
            if (leftW) {
                const g = ctx.createLinearGradient(x, y, x + cellW * 0.48, y);
                g.addColorStop(0, 'rgba(0,0,0,0.48)'); g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g; ctx.fillRect(x, y, cellW * 0.48, cellH);
            }
            if (botW) {
                const g = ctx.createLinearGradient(x, y + cellH, x, y + cellH * 0.72);
                g.addColorStop(0, 'rgba(0,0,0,0.30)'); g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g; ctx.fillRect(x, y + cellH * 0.72, cellW, cellH * 0.28);
            }
            if (rightW) {
                const g = ctx.createLinearGradient(x + cellW, y, x + cellW * 0.74, y);
                g.addColorStop(0, 'rgba(0,0,0,0.26)'); g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g; ctx.fillRect(x + cellW * 0.74, y, cellW * 0.26, cellH);
            }
        }
    }
    ctx.restore();

    // СЛОЙ 4: Аккуратная тактическая сетка
    if (window._mbShowGrid) {
        ctx.save();
        ctx.strokeStyle = 'rgba(235, 205, 145, 0.13)';
        ctx.lineWidth = 1;
        for (let c = 0; c <= cols; c++) { ctx.beginPath(); ctx.moveTo(c * cellW + 0.5, 0); ctx.lineTo(c * cellW + 0.5, canvas.height); ctx.stroke(); }
        for (let r = 0; r <= rows; r++) { ctx.beginPath(); ctx.moveTo(0, r * cellH + 0.5); ctx.lineTo(canvas.width, r * cellH + 0.5); ctx.stroke(); }
        ctx.restore();
    }

    // СЛОЙ 5: Отрисовка объектов в 3 Z-слоях + сбор источников света
    const lightSources = [];
    const objs = (data.objects || []).map(o => {
        const stObj = MB_FIND_STAMP_OBJ(o.id);
        const meta = MB_ANALYZE_STAMP_META(stObj);
        return { o, stObj, meta };
    });

    const drawObjItem = (item, ghostAlpha = 1.0) => {
        const { o, stObj, meta } = item;
        const cx = o.x * cellW, cy = o.y * cellH;
        const img = stObj && stObj.img ? MB_GET_LOADED_IMG(stObj.img) : null;
        const targetMaxPx = cellW * meta.baseCells * (o.scale || 1.0);

        if (meta.glow && ghostAlpha === 1.0) {
            lightSources.push({
                x: cx, y: cy,
                color: meta.glow.color,
                r: cellW * meta.glow.radius * (o.scale || 1.0),
                intensity: meta.glow.intensity
            });
        }

        // Контактная мягкая тень под основанием (убирает эффект «наклейки»)
        if (window._mbPostFx && ghostAlpha === 1.0 && meta.layer >= 1) {
            const sr = targetMaxPx * (meta.layer === 2 ? 0.44 : 0.36);
            const sx = cx + (meta.layer === 2 ? cellW * 0.16 : cellW * 0.06);
            const sy = cy + (meta.layer === 2 ? cellH * 0.18 : cellH * 0.07);
            const g = ctx.createRadialGradient(sx, sy, sr * 0.15, sx, sy, sr);
            g.addColorStop(0, meta.layer === 2 ? 'rgba(0,0,0,0.42)' : 'rgba(0,0,0,0.34)');
            g.addColorStop(1, 'rgba(0,0,0,0)');
            ctx.fillStyle = g;
            ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
        }

        ctx.save();
        ctx.globalAlpha = ghostAlpha;
        ctx.translate(cx, cy);
        if (o.rot) ctx.rotate((o.rot * Math.PI) / 180);

        if (meta.layer === 1) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.50)';
            ctx.shadowBlur = Math.max(4, cellW * 0.14);
            ctx.shadowOffsetX = cellW * 0.06;
            ctx.shadowOffsetY = cellH * 0.08;
        } else if (meta.layer === 2) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.54)';
            ctx.shadowBlur = Math.max(10, cellW * 0.30);
            ctx.shadowOffsetX = cellW * 0.16;
            ctx.shadowOffsetY = cellH * 0.20;
        }

        if (img && img.naturalWidth > 0) {
            const aspect = img.naturalWidth / img.naturalHeight;
            let drawW = targetMaxPx, drawH = targetMaxPx;
            if (aspect >= 1) drawH = targetMaxPx / aspect;
            else drawW = targetMaxPx * aspect;
            ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
        } else {
            ctx.font = `${Math.floor(cellH * 0.68)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(stObj ? stObj.icon : '📦', 0, 0);
        }
        ctx.restore();
    };

    objs.filter(i => i.meta.layer === 0).forEach(i => drawObjItem(i));

    // СЛОЙ 6: Объёмные 3D-стены
    if (presentTiles.has('wall')) {
        const wallStyle = fillStyleForTile('wall');
        ctx.save();
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            if (data.cells[r * cols + c].t !== 'wall') continue;
            const x = c * cellW, y = r * cellH;
            ctx.fillStyle = wallStyle;
            ctx.fillRect(x, y, cellW + 0.5, cellH + 0.5);
            ctx.fillStyle = 'rgba(0, 0, 0, 0.26)';
            ctx.fillRect(x, y, cellW, cellH);

            ctx.strokeStyle = 'rgba(230, 212, 184, 0.34)';
            ctx.lineWidth = 2;
            if (r > 0 && data.cells[(r - 1) * cols + c].t !== 'wall') { ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.lineTo(x + cellW, y + 1); ctx.stroke(); }
            if (c > 0 && data.cells[r * cols + c - 1].t !== 'wall') { ctx.beginPath(); ctx.moveTo(x + 1, y); ctx.lineTo(x + 1, y + cellH); ctx.stroke(); }

            ctx.strokeStyle = 'rgba(0, 0, 0, 0.78)';
            ctx.lineWidth = 2.5;
            if (r < rows - 1 && data.cells[(r + 1) * cols + c].t !== 'wall') { ctx.beginPath(); ctx.moveTo(x, y + cellH - 1); ctx.lineTo(x + cellW, y + cellH - 1); ctx.stroke(); }
            if (c < cols - 1 && data.cells[r * cols + c + 1].t !== 'wall') { ctx.beginPath(); ctx.moveTo(x + cellW - 1, y); ctx.lineTo(x + cellW - 1, y + cellH); ctx.stroke(); }
        }
        ctx.restore();
    }

    objs.filter(i => i.meta.layer === 1).forEach(i => drawObjItem(i));
    objs.filter(i => i.meta.layer === 2).forEach(i => drawObjItem(i));

    if (presentTiles.has('lava')) {
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
            if (data.cells[r * cols + c].t === 'lava' && (r + c) % 2 === 0) {
                lightSources.push({ x: (c + 0.5) * cellW, y: (r + 0.5) * cellH, color: [255, 118, 36], r: cellW * 2.6, intensity: 0.72 });
            }
        }
    }

    // СЛОЙ 7: НАСТОЯЩИЙ ДВИЖОК ОСВЕЩЕНИЯ (MULTIPLY LIGHTMAP + BLOOM + ВИНЬЕТКА)
    if (window._mbPostFx) {
        const lw = Math.max(120, Math.round(canvas.width / 2));
        const lh = Math.max(80, Math.round(canvas.height / 2));
        if (!window._mbLightCanvas) window._mbLightCanvas = document.createElement('canvas');
        const lc = window._mbLightCanvas;
        if (lc.width !== lw || lc.height !== lh) { lc.width = lw; lc.height = lh; }
        const lctx = lc.getContext('2d');

        // 1. Базовая освещённость сцены (умножается на карту — в темноте сохраняется глубина теней)
        const [ar, ag, ab] = lightCfg.ambient;
        lctx.globalCompositeOperation = 'source-over';
        lctx.fillStyle = `rgb(${ar}, ${ag}, ${ab})`;
        lctx.fillRect(0, 0, lw, lh);

        // 2. Пробиваем яркие пятна света вокруг костров, свечей, фонарей, лавы и кристаллов
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

        // 3. Накладываем карту света в режиме MULTIPLY
        ctx.save();
        ctx.globalCompositeOperation = 'multiply';
        ctx.drawImage(lc, 0, 0, canvas.width, canvas.height);

        // 4. Деликатный мягкий ореол (Bloom) в самом центре огней и кристаллов
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

        // 5. Художественная виньетка по краям
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

    // Полупрозрачный предпросмотр объекта под курсором (при редактировании)
    if (!isExport && window._mbTool === 'stamp' && window._mbHoverPos && window._mbSelectedStamp) {
        const stObj = MB_FIND_STAMP_OBJ(window._mbSelectedStamp);
        const meta = MB_ANALYZE_STAMP_META(stObj);
        const gx = window._mbSnapGrid ? (window._mbHoverPos.col + 0.5) : window._mbHoverPos.gx;
        const gy = window._mbSnapGrid ? (window._mbHoverPos.row + 0.5) : window._mbHoverPos.gy;
        drawObjItem({ o: { id: window._mbSelectedStamp, x: gx, y: gy, scale: window._mbStampScale || 1, rot: window._mbStampRot || 0 }, stObj, meta }, 0.62);
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