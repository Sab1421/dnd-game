// ================================================================
// 🎨 ПРОДВИНУТЫЙ КОНСТРУКТОР КАРТ V2 (HD-РЕНДЕР, СВЕТ, СЛОИ И ГЕНЕРАТОР)
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
window._mbStampScale = window._mbStampScale || 1.0; // Множитель размера кисти объектов
window._mbStampRot = window._mbStampRot || 0;       // Угол поворота в градусах
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
    day:     { label: '☀️ Дневной свет',       tint: 'rgba(255, 246, 224, 0.06)', ambientDark: 0.0,  vignette: 0.22, glowPower: 0.45 },
    sunset:  { label: '🌅 Золотой закат',      tint: 'rgba(255, 132, 48, 0.16)',  ambientDark: 0.12, vignette: 0.36, glowPower: 0.72 },
    tavern:  { label: '🕯️ Уютная таверна',     tint: 'rgba(255, 168, 76, 0.10)',  ambientDark: 0.26, vignette: 0.44, glowPower: 0.95 },
    night:   { label: '🌙 Лунная ночь',        tint: 'rgba(18, 36, 86, 0.46)',    ambientDark: 0.44, vignette: 0.52, glowPower: 1.15 },
    dungeon: { label: '🏰 Мрачное подземелье', tint: 'rgba(14, 12, 22, 0.38)',    ambientDark: 0.38, vignette: 0.62, glowPower: 1.05 }
};

// Порядок наслоения покрытий для мягких органических переходов
const MB_TILE_ORDER = ['abyss', 'water', 'lava', 'sand', 'dirt', 'grass', 'snow', 'cobble', 'flagstone', 'stone', 'wood', 'wall'];

function GET_MB_TILES() {
    const src = (window.SITE_ASSETS && window.SITE_ASSETS.builderTiles) ? Object.assign({}, window.SITE_ASSETS.builderTiles) : {};
    const defaults = {
        grass:     { name: 'Трава',       icon: '🌿', bg: '#31542c', border: '#233d1f', img: 'assets/tiles/grass.jpg' },
        dirt:      { name: 'Тропа/Земля', icon: '🛤️', bg: '#694f37', border: '#4f3a27', img: 'assets/tiles/dirt.jpg' },
        cobble:    { name: 'Брусчатка',   icon: '🏛️', bg: '#64666b', border: '#484a4f', img: 'assets/tiles/cobble.jpg' },
        stone:     { name: 'Каменный пол',icon: '🪨', bg: '#4b4e54', border: '#35383d', img: 'assets/tiles/stone.jpg' },
        flagstone: { name: 'Плитка зала', icon: '⬜', bg: '#5a5d63', border: '#3f4247', img: 'assets/stamps/other/floor_flagstone_tiling_6x6.png' },
        wood:      { name: 'Доски (Пол)', icon: '🪵', bg: '#734b2c', border: '#54351d', img: 'assets/stamps/other/floor_floorboards_tiling_8x8.png' },
        wall:      { name: 'Стена',       icon: '🧱', bg: '#262422', border: '#57534e', img: 'assets/tiles/wall.jpg' },
        water:     { name: 'Вода',        icon: '🌊', bg: '#1e527d', border: '#153c5c', img: 'assets/tiles/water.jpg' },
        lava:      { name: 'Лава',        icon: '🔥', bg: '#b91c1c', border: '#f97316', img: 'assets/tiles/lava.jpg' },
        snow:      { name: 'Снег/Лёд',    icon: '❄️', bg: '#cbd5e1', border: '#94a3b8', img: 'assets/tiles/snow.png' },
        sand:      { name: 'Песок',       icon: '🏜️', bg: '#c2a878', border: '#9e8559', img: 'assets/tiles/sand.jpg' },
        abyss:     { name: 'Пропасть',    icon: '🕳️', bg: '#0c0c0e', border: '#1d1d21', img: 'assets/tiles/abyss.png' }
    };
    const merged = {};
    for (const key of Object.keys(defaults)) {
        merged[key] = src[key] ? Object.assign({}, defaults[key], src[key]) : defaults[key];
    }
    for (const [k, v] of Object.entries(src)) {
        if (!merged[k]) merged[k] = v;
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

// Убирает дубли _2 / _3 при показе в каталоге кнопок, чтобы список был чистым
function GET_UNIQUE_MB_STAMPS() {
    if (window._mbUniqueStampsCache) return window._mbUniqueStampsCache;
    const all = GET_MB_STAMPS();
    const seen = new Set();
    const out = [];
    for (const s of all) {
        const normKey = (s.cat || 'other') + '|' + (s.label || s.id).toLowerCase().replace(/\s+/g, ' ').trim();
        const isNumericDup = /_[234]$/.test(s.id || '') && seen.has(normKey);
        if (isNumericDup) continue;
        seen.add(normKey);
        out.push(s);
    }
    window._mbUniqueStampsCache = out;
    return out;
}

// --- КЭШ ИЗОБРАЖЕНИЙ И БЕСШОВНЫХ ПАТТЕРНОВ ---
window._mbImgCache = window._mbImgCache || {};
window._mbPatternCache = window._mbPatternCache || {};

function MB_GET_LOADED_IMG(src) {
    if (!src) return null;
    const entry = window._mbImgCache[src];
    if (entry) return entry.status === 'ok' ? entry.img : null;

    const img = new Image();
    window._mbImgCache[src] = { status: 'loading', img };
    img.onload = function() {
        window._mbImgCache[src].status = 'ok';
        delete window._mbPatternCache[src];
        if (document.getElementById('mb-editor-canvas')) {
            if (!window._mbRedrawTimer) {
                window._mbRedrawTimer = setTimeout(() => {
                    window._mbRedrawTimer = null;
                    DRAW_MB_CANVAS();
                }, 40);
            }
        }
    };
    img.onerror = function() {
        window._mbImgCache[src].status = 'error';
    };
    img.src = src;
    return null;
}

function MB_GET_TILE_PATTERN(ctx, tileKey, tileImg, cellPx) {
    const cacheKey = `${tileKey}_${Math.round(cellPx)}`;
    if (window._mbPatternCache[cacheKey]) return window._mbPatternCache[cacheKey];

    // Масштабируем текстуру на 4–5 клеток, чтобы не было уродливой мелкой «плитки»
    const repeatCells = (tileKey === 'wood' || tileKey === 'flagstone' || tileKey === 'cobble') ? 3.5 : (tileKey === 'wall' ? 2.2 : 4.5);
    const targetPx = Math.max(96, Math.min(360, Math.round(cellPx * repeatCells)));
    const off = document.createElement('canvas');
    off.width = targetPx;
    off.height = targetPx;
    const octx = off.getContext('2d');
    octx.drawImage(tileImg, 0, 0, targetPx, targetPx);

    const pat = ctx.createPattern(off, 'repeat');
    window._mbPatternCache[cacheKey] = pat;
    return pat;
}

function MB_PRELOAD_TILES() {
    const tiles = GET_MB_TILES();
    Object.values(tiles).forEach(t => { if (t.img) MB_GET_LOADED_IMG(t.img); });
}

// --- ОПРЕДЕЛЕНИЕ НАТУРАЛЬНОГО РАЗМЕРА, СЛОЯ И СВЕЧЕНИЯ ОБЪЕКТА ---
function MB_ANALYZE_STAMP_META(stObj) {
    const id = ((stObj?.id || '') + ' ' + (stObj?.label || '')).toLowerCase();

    // 1. Определяем слой Z (0 = подложка, 1 = обычный объект, 2 = высокий/крыша/крона)
    let layer = 1;
    if (/(rug|carpet|mat|tatami|puddle|leaf_litter|duff|clover|soil_patch|dirt_patch|paving_stone|blood|webs|lily|submerged|current|rapids|river_edge|road_edge|path_edge|bridge|floor|ruin|shadow|shade|embers|fiery_area|oasis|watertransparent|spore)/i.test(id)) {
        layer = 0;
    } else if (/(roof|tree|palm|canopy|balloon|wing|tower|watchpost|chandelier|lightning|fireball|burning_hands|breath_weapon|wall_of_fire)/i.test(id) && !/(stump|fallen|branch|root|log)/i.test(id)) {
        layer = 2;
    }

    // 2. Определяем базовый размер в клетках (учитывая пометки вроде 6x4, 3x2 в имени файла!)
    let baseCells = 1.15;
    const dimMatch = id.match(/(\d+)\s*x\s*(\d+)/i);
    if (dimMatch) {
        const wC = parseInt(dimMatch[1]) || 1;
        const hC = parseInt(dimMatch[2]) || 1;
        baseCells = Math.max(0.8, Math.min(6.5, Math.max(wC, hC) * 0.72));
    } else if (/(roof|tent_large|tent_round_large|pavillion|balloon)/i.test(id)) {
        baseCells = 3.6;
    } else if (/(tree_bigger|tree_large|tree_big|palmtree|fountain|wagon|catapult|shelter|watchpost|oasis|bigstatue|large_statue|pool)/i.test(id)) {
        baseCells = 2.4;
    } else if (/(tree|palm|tent|ballista|cannon|table_long|tabledinning|tableroundlarge|carpet|rug_6|bed_pattern|bedframeddouble|billiards_table|piano|sofa|forge|altar|tomb|bridge|rock_formation|fallen_tree|boulder|cart|thicket)/i.test(id)) {
        baseCells = 1.75;
    } else if (/(table|bed|desk|bench|bookshelf|dresser|statue|well|barrel|crate|chest|campfire|brazier|cauldron|oven|stove|throne|bush|shrub|cactus|fungi|mushroom|rock|stump|log|pillar|door|grave|bonepile|crystal|flytrap)/i.test(id)) {
        baseCells = 1.15;
    } else if (/(candle|lantern|torch|flower|apple|egg|pie|plate|meat|tankard|card|scroll|skull|bone|coin|shell|starfish|crab|parrot|cat_|bottle|chair|stool|cushion|sack|bucket|hammer|axe|sword|shield)/i.test(id)) {
        baseCells = 0.72;
    }

    // 3. Автоматическое свечение для огня, свечей, фонарей, жаровен, кристаллов и магии
    let glow = null;
    if (/(campfire|fireball|fiery|burning|flaming|flame|embers|forge|oven_fireplace|melting_pot|wall_of_fire)/i.test(id) && !/unlit|empty|wood$|ring$/i.test(id)) {
        glow = { color: '255, 142, 52', radius: 3.2, intensity: 0.58 };
    } else if (/(brazier|torch|lantern|lamp|candle|chandelier|stand_lit|jack_o_lantern|hole_roof_glow)/i.test(id) && !/unlit/i.test(id)) {
        glow = { color: '255, 192, 96', radius: 2.3, intensity: 0.46 };
    } else if (/(lightning|crystalblue|crystal_vertical|crystal_horizontal|arcane|magic)/i.test(id)) {
        glow = { color: '96, 195, 255', radius: 2.5, intensity: 0.44 };
    } else if (/(crystalred|acid|spore)/i.test(id)) {
        glow = { color: '180, 255, 110', radius: 2.1, intensity: 0.36 };
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

// --- ХРАНИЛИЩЕ, МИГРАЦИЯ СТАРЫХ КАРТ И UNDO ---
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
                // Авто-миграция старых cell.s в новый слой свободных объектов
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

// Клавиши R (поворот объекта) и Ctrl+Z (отмена) внутри конструктора
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

    // Высокое разрешение холста для чёткой графики (до 1560px)
    const cellPx = Math.max(34, Math.min(64, Math.floor(1560 / Math.max(cols, rows * 1.45))));
    const canvasW = cols * cellPx;
    const canvasH = rows * cellPx;

    let tileBtnsHTML = '';
    for (const [key, cfg] of Object.entries(tiles)) {
        const isSel = (window._mbTool === 'tile' || window._mbTool === 'brush3') && window._mbSelectedTile === key;
        const thumbStyle = cfg.img
            ? `background-image:url('${cfg.img}'); background-size:cover; background-color:${cfg.bg};`
            : `background:${cfg.bg}; border:1px solid ${cfg.border};`;

        tileBtnsHTML += `
            <button class="btn-small" onclick="MB_SELECT_TILE('${key}')"
                style="background:${isSel ? '#c9a96e' : '#181715'}; color:${isSel ? '#141210' : '#ebe8e2'}; border:2px solid ${isSel ? '#fff' : cfg.bg}; padding:4px 8px; display:inline-flex; align-items:center; gap:5px; font-size:0.81rem;">
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
            style="background:${window._mbTool===mode ? '#7c3aed' : '#22201d'}; color:#fff; border:1px solid ${window._mbTool===mode ? '#e9d5ff' : '#423c33'}; font-size:0.81rem; padding:5px 9px;">
            ${label}
        </button>
    `;

    const sizePresetBtns = MB_SIZE_PRESETS.map(p => {
        const isAct = (cols === p.cols && rows === p.rows);
        return `<button class="btn-small" style="padding:3px 7px; font-size:0.76rem; background:${isAct ? '#c9a96e' : '#22201d'}; color:${isAct ? '#141210' : '#ddd'};" onclick="MB_RESIZE_GRID(${p.cols}, ${p.rows})">${p.label} ${p.cols}×${p.rows}</button>`;
    }).join('');

    const curTitleVal = document.getElementById('mb-map-title-inp')?.value ?? (GET_MAP_STATE().title || 'Новая локация');

    cont.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #3d3830; padding-bottom:8px; margin-bottom:9px; flex-wrap:wrap; gap:8px;">
            <h2 style="margin:0; border:none; padding:0; font-size:1.25rem;">🎨 Студия Карт HD (${cols}×${rows} кл. • объектов: ${(data.objects||[]).length})</h2>
            <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                <button class="btn-small" style="font-size:0.8rem;" onclick="MB_UNDO()" ${!window._mbUndoStack.length ? 'disabled' : ''}>↩️ Отменить (Ctrl+Z)</button>
                <button class="btn-small btn-danger" style="font-size:0.8rem;" onclick="MB_CLEAR_OBJECTS()">🧹 Убрать объекты</button>
                <button class="btn-small btn-danger" style="font-size:0.8rem;" onclick="MB_FILL_ALL(window._mbSelectedTile || 'grass')">🗑️ Очистить всё</button>
            </div>
        </div>

        <!-- Размер + Рандомный генератор + Атмосфера/Свет -->
        <div style="display:grid; grid-template-columns: 1.05fr 1.25fr 0.8fr; gap:8px; margin-bottom:8px;">
            <div style="background:#181715; border:1px solid #423c33; border-radius:9px; padding:8px 10px; display:flex; flex-direction:column; gap:6px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:4px; flex-wrap:wrap;">
                    <b style="color:#c9a96e; font-size:0.82rem;">📏 Размер:</b>
                    <div style="display:flex; align-items:center; gap:4px;">
                        <input type="number" id="mb-cols-inp" min="8" max="50" value="${cols}" style="width:52px; padding:2px 4px; font-size:0.8rem;">
                        <span>×</span>
                        <input type="number" id="mb-rows-inp" min="6" max="40" value="${rows}" style="width:52px; padding:2px 4px; font-size:0.8rem;">
                        <button class="btn-small btn-save" style="padding:3px 7px; font-size:0.76rem;" onclick="MB_RESIZE_GRID(document.getElementById('mb-cols-inp').value, document.getElementById('mb-rows-inp').value)">Ок</button>
                    </div>
                </div>
                <div style="display:flex; gap:4px; flex-wrap:wrap;">${sizePresetBtns}</div>
            </div>

            <div style="background:#1b1824; border:1px solid #7c3aed; border-radius:9px; padding:8px 10px; display:flex; flex-direction:column; justify-content:space-between; gap:6px;">
                <b style="color:#d8b4fe; font-size:0.82rem;">🎲 Умная рандомная генерация (8 биомов, живой декор):</b>
                <div style="display:flex; gap:6px; align-items:center;">
                    <select id="mb-rand-biome" onchange="window._mbRandBiome=this.value;" style="flex:1; padding:4px 7px; font-size:0.82rem; text-align:left;">
                        <option value="random" ${window._mbRandBiome==='random'?'selected':''}>🎲 Любая случайная локация</option>
                        <option value="forest" ${window._mbRandBiome==='forest'?'selected':''}>🌲 Дикий лес / река / лагерь</option>
                        <option value="tavern" ${window._mbRandBiome==='tavern'?'selected':''}>🍺 Уютная таверна / постоялый двор</option>
                        <option value="dungeon" ${window._mbRandBiome==='dungeon'?'selected':''}>🏰 Подземелье / катакомбы</option>
                        <option value="city" ${window._mbRandBiome==='city'?'selected':''}>👑 Город / Столица / Рынок</option>
                        <option value="desert" ${window._mbRandBiome==='desert'?'selected':''}>🏜️ Пустынный оазис и караван</option>
                        <option value="fey" ${window._mbRandBiome==='fey'?'selected':''}>🍄 Волшебный лес / грибная роща</option>
                        <option value="battlefield" ${window._mbRandBiome==='battlefield'?'selected':''}>⚔️ Поле битвы / осадный лагерь</option>
                        <option value="snow" ${window._mbRandBiome==='snow'?'selected':''}>❄️ Снежный перевал / привал</option>
                    </select>
                    <button class="btn-small" style="background:linear-gradient(180deg,#8b5cf6 0%,#5b21b6 100%); color:#fff; border-color:#c084fc; padding:5px 11px; font-size:0.82rem; white-space:nowrap;" onclick="MB_GENERATE_RANDOM(document.getElementById('mb-rand-biome').value)">
                        🎲 Собрать!
                    </button>
                </div>
            </div>

            <div style="background:#181715; border:1px solid #c9a96e; border-radius:9px; padding:8px 10px; display:flex; flex-direction:column; justify-content:space-between; gap:6px;">
                <b style="color:#e6c88c; font-size:0.82rem;">💡 Освещение и атмосфера:</b>
                <select id="mb-lighting-sel" onchange="window._mbLighting=this.value; if(window._mbData){window._mbData.lighting=this.value; SAVE_MB_DATA(window._mbData);} DRAW_MB_CANVAS();" style="padding:4px 7px; font-size:0.82rem; text-align:left;">
                    ${lightOpts}
                </select>
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:0.78rem; color:#ccc;">
                    <input type="checkbox" ${window._mbShowGrid ? 'checked' : ''} onchange="window._mbShowGrid=this.checked; DRAW_MB_CANVAS();">
                    <span>📏 Тактическая сетка</span>
                </label>
            </div>
        </div>

        <!-- Инструменты + Покрытия + Объекты -->
        <div style="background:#181715; border:1px solid #423c33; border-radius:9px; padding:9px 11px; margin-bottom:9px; display:flex; flex-direction:column; gap:7px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div style="display:flex; gap:5px; align-items:center; flex-wrap:wrap;">
                    ${tModeBtn('tile', '🖌️ Пол 1×1')}
                    ${tModeBtn('brush3', '⬛ Пол 3×3')}
                    ${tModeBtn('stamp', '🌲 Ставить объект')}
                    ${tModeBtn('eraser', '🧽 Удалить объект')}
                </div>
                <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; font-size:0.8rem; color:#d8d4cc;">
                    <label style="display:flex; align-items:center; gap:5px;">
                        <span>🔍 Масштаб: <b id="mb-scale-lbl">${window._mbStampScale.toFixed(1)}×</b></span>
                        <input type="range" min="0.5" max="3.0" step="0.1" value="${window._mbStampScale}" oninput="window._mbStampScale=parseFloat(this.value); document.getElementById('mb-scale-lbl').textContent=this.value+'×'; DRAW_MB_CANVAS();" style="width:76px;">
                    </label>
                    <button class="btn-small" style="padding:3px 7px; font-size:0.76rem;" title="Повернуть объект на 45° (клавиша R)" onclick="window._mbStampRot=(window._mbStampRot+45)%360; document.getElementById('mb-rot-lbl').textContent=window._mbStampRot+'°'; DRAW_MB_CANVAS();">
                        🔄 <span id="mb-rot-lbl">${window._mbStampRot}°</span>
                    </button>
                    <label style="display:flex; align-items:center; gap:4px; cursor:pointer;" title="Случайный поворот при каждом клике (удобно для леса и камней)">
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
                <div id="mb-stamps-grid-wrap" style="display:flex; gap:5px; flex-wrap:wrap; max-height:112px; overflow-y:auto; padding:5px; background:#121110; border-radius:6px; border:1px solid #302c26;">
                    ${MB_BUILD_STAMP_BUTTONS_HTML()}
                </div>
            </div>
        </div>

        <!-- Холст высокого разрешения -->
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
            <small style="color:#9e988e;">💡 ЛКМ — рисовать/ставить • ПКМ — удалить объект • Клавиша R — поворот</small>
            <div style="display:flex; gap:8px;">
                <button class="btn-save" style="padding:10px 18px; font-size:0.98rem;" onclick="MB_APPLY_TO_GAME_MAP()">
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
// 🎲 УМНЫЙ РАНДОМНЫЙ ГЕНЕРАТОР (8 БИОМОВ + ПУЛЫ РЕАЛЬНЫХ ВАРИАНТОВ)
// ================================================================
function MB_RAND_INT(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function MB_RAND_FLOAT(min, max) { return min + Math.random() * (max - min); }
function MB_PICK(arr) { return (arr && arr.length) ? arr[Math.floor(Math.random() * arr.length)] : null; }

// Подбирает пул уникальных подходящих PNG-спрайтов из assets.js с фильтром мусора
function MB_GET_POOL(includeRx, excludeRx = null) {
    const list = GET_UNIQUE_MB_STAMPS();
    return list.filter(s => {
        const txt = (s.id + ' ' + (s.label || '')).toLowerCase();
        if (!includeRx.test(txt)) return false;
        if (excludeRx && excludeRx.test(txt)) return false;
        return true;
    }).map(s => s.id);
}

function MB_GENERATE_RANDOM(biome) {
    MB_PUSH_UNDO();
    const allBiomes = ['forest', 'tavern', 'dungeon', 'city', 'desert', 'fey', 'battlefield', 'snow'];
    const picked = (biome === 'random' || !biome) ? MB_PICK(allBiomes) : biome;

    const cols = window._mbCols, rows = window._mbRows;
    const baseByBiome = {
        forest: 'grass', tavern: 'grass', dungeon: 'wall', city: 'grass',
        desert: 'sand', fey: 'grass', battlefield: 'grass', snow: 'snow'
    };
    const lightByBiome = {
        forest: Math.random() < 0.35 ? 'sunset' : 'day',
        tavern: 'tavern',
        dungeon: 'dungeon',
        city: Math.random() < 0.3 ? 'sunset' : 'day',
        desert: 'day',
        fey: 'night',
        battlefield: 'sunset',
        snow: Math.random() < 0.4 ? 'night' : 'day'
    };

    window._mbLighting = lightByBiome[picked] || 'day';
    const data = CREATE_EMPTY_MB_DATA(baseByBiome[picked] || 'grass', cols, rows);
    data.lighting = window._mbLighting;

    const inBounds = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows;
    const getTile = (c, r) => inBounds(c, r) ? data.cells[r * cols + c].t : null;
    const setTile = (c, r, t) => { if (inBounds(c, r)) data.cells[r * cols + c].t = t; };
    const addObj = (poolOrId, x, y, scale = 1.0, rot = 0) => {
        const id = Array.isArray(poolOrId) ? MB_PICK(poolOrId) : poolOrId;
        if (!id) return;
        const stObj = MB_FIND_STAMP_OBJ(id);
        if (stObj && stObj.img) MB_GET_LOADED_IMG(stObj.img);
        data.objects.push({ id, x, y, scale, rot });
    };

    // Живые пулы объектов из реального assets.js
    const P = {
        trees:      MB_GET_POOL(/nature_tree(_large|_small|_1|_2|_3|_big|2|3|4|e)/, /stump|fallen|branch|root|shade|desert|palm|christmas/),
        bushes:     MB_GET_POOL(/(bush|foliage|fern|thicket|clover|leaf_litter)/, /desert|texture/),
        flowers:    MB_GET_POOL(/(flower)/, /no_flowers|trumpet/),
        rocks:      MB_GET_POOL(/(rock|boulder)/, /river|submerged|formation|slope/),
        logs:       MB_GET_POOL(/(fallen_tree|stump|log_)/, /tree_big_tree|tree_bigger_tree/),
        waterDec:   MB_GET_POOL(/(lily_pad|submerged_rocks|river_rock|current)/),
        bridges:    MB_GET_POOL(/(wooden_bridge|stone_bridge|nature_bridge|floatingbridge)/),
        campfires:  MB_GET_POOL(/(campfire_fire|campfire$|campfire_pot|campfire_3|desert_campfire)/, /ring|wood$/),
        tents:      MB_GET_POOL(/(tent_round|tent_square|tent_narrow|tentsmallround|tentlarge|camp_tent$)/, /packed|tarp/),
        bedrolls:   MB_GET_POOL(/(bedroll_|backpack_|firewood_pile|pelt)/, /packed/),
        mushrooms:  MB_GET_POOL(/(mushroom|fungi|spore_cloud|giantleafpurple|roots|trumpetflower|flytrap)/),
        crystals:   MB_GET_POOL(/(crystal)/, /ball/),
        // Интерьер / Таверна
        tables:     MB_GET_POOL(/(table_round|table_rectangle|table_long|tabledinning|tableround|furniture_table$)/, /broken|ruined|end|modular|billiards|casting|kotatsu|game/),
        chairs:     MB_GET_POOL(/(chair_simple|chair_stool|chair_bench|chair_armchair|bench3|chair3|chair_2)/, /broken|ruined|latrine|sofa/),
        rugs:       MB_GET_POOL(/(rug_6|rug_bear|rug_animal|carpet_1|carpet_2|carpet_3|carpet1|carpet2)/, /wrinkled|doormat/),
        beds:       MB_GET_POOL(/(bed_pattern_1|bedframed|1bed|2bed|furniture_bed$)/, /discarded|cot/),
        barrels:    MB_GET_POOL(/(barrel_|storage_barrel_|keg|barrels_)/, /broken|ruined|acid|pitch/),
        crates:     MB_GET_POOL(/(crate_|storage_crate|sack|box_)/, /broken|ruined|lockbox/),
        shelves:    MB_GET_POOL(/(bookshelf|dresser|cupboard|shelf)/, /modular/),
        food:       MB_GET_POOL(/(food_|tankards_full|pie$|chicken|hamroast|apples|playing_cards|book_pile)/),
        candles:    MB_GET_POOL(/(candle.*_lit|candles|lantern_lit|stand_lit)/, /unlit/),
        fireplaces: MB_GET_POOL(/(oven_fireplace|cooking_stove|stovesmall)/),
        // Подземелье
        braziers:   MB_GET_POOL(/(light_brazier|stand_lit_iron)/, /unlit/),
        chests:     MB_GET_POOL(/(chest_1|chest_2|chest2$|dungeon_chest$)/, /open|octopus/),
        bones:      MB_GET_POOL(/(bones_|bonepile|skull|dungeon_bone$)/, /enormous|large_spine|pirate/),
        webs:       MB_GET_POOL(/(clutter_webs_)/),
        pillars:    MB_GET_POOL(/(pillar_round|pillar_square|stone_pillar|pillar_base)/),
        altars:     MB_GET_POOL(/(feature_altar|tomb_1|tomb_open|shrine|metal_cage|feythrone)/),
        doors:      MB_GET_POOL(/(door_narrow|door_1_base|door_2_base|double_door)/, /collapsed|shoji/),
        rubble:     MB_GET_POOL(/(rubble_small|rubble_medium|ruin_|blood_)/, /planks|wood/),
        // Город
        roofs:      MB_GET_POOL(/(roof_tiled|roof_thatch|roof_premade|city_roof$)/, /hole/),
        statues:    MB_GET_POOL(/(fountain|city_well$|statue1|statue2|statue3|feature_statue|large_statue)/, /platform/),
        carts:      MB_GET_POOL(/(wagon|cart|horse)/),
        lamps:      MB_GET_POOL(/(woodlamp|paperlamp|city_lamp$|lantern_lit)/),
        gardens:    MB_GET_POOL(/(garden|flower1|flower2|flower3|plant)/),
        // Пустыня
        palms:      MB_GET_POOL(/(palm|tree_desert)/, /trunk/),
        cacti:      MB_GET_POOL(/(cactus|desert_shrubs|desert_grass|aeonium|succulents)/, /mimic/),
        pots:       MB_GET_POOL(/(pot$|pot5|vase_medium|vase_large|deadwood|oasis|magiccarpet)/),
        // Поле битвы
        siege:      MB_GET_POOL(/(ballista|cannon$|catapult|batteringram|acidcauldron|pitchcauldron)/, /bolt|balls/),
        barricades: MB_GET_POOL(/(barricade|woodenstakes|weaponrack|weapon_rack|largeflag)/),
        weapons:    MB_GET_POOL(/(greatsword|longsword|weapon_sword|weapon_axe|weapon_shield)/),
        fireFx:     MB_GET_POOL(/(embers|fiery_area|flaming_sphere)/),
        // Зима
        snowProps:  MB_GET_POOL(/(christmas_tree|snowman|wolfpelt|peltwolf)/)
    };

    let genTitle = 'Случайная локация';

    // 1. ДИКИЙ ЛЕС И РЕКА
    if (picked === 'forest') {
        genTitle = MB_PICK(['Изумрудная чаща', 'Переправа у Древа', 'Тропа охотников', 'Лагерь в чаще']);
        // Извилистая река
        let rx = MB_RAND_INT(Math.floor(cols * 0.28), Math.floor(cols * 0.72));
        const rWidth = cols >= 26 ? 3 : 2;
        for (let r = 0; r < rows; r++) {
            if (Math.random() < 0.5) rx = Math.max(2, Math.min(cols - rWidth - 2, rx + MB_RAND_INT(-1, 1)));
            for (let w = 0; w < rWidth; w++) setTile(rx + w, r, 'water');
            // Песчаный/земляной берег местами
            if (Math.random() < 0.45) setTile(rx - 1, r, 'dirt');
            if (Math.random() < 0.45) setTile(rx + rWidth, r, 'dirt');
        }

        // Извилистая дорога поперёк + мост через реку
        let py = MB_RAND_INT(Math.floor(rows * 0.28), Math.floor(rows * 0.70));
        let bridgeCenter = null;
        for (let c = 0; c < cols; c++) {
            if (Math.random() < 0.25) py = Math.max(2, Math.min(rows - 3, py + MB_RAND_INT(-1, 1)));
            for (let dy = 0; dy <= 1; dy++) {
                if (getTile(c, py + dy) === 'water') {
                    if (!bridgeCenter) bridgeCenter = { x: c + rWidth * 0.5, y: py + 0.9 };
                } else {
                    setTile(c, py + dy, 'dirt');
                }
            }
        }
        if (bridgeCenter) {
            addObj(P.bridges, bridgeCenter.x, bridgeCenter.y, rWidth >= 3 ? 1.35 : 1.05, 0);
        }

        // Детали в воде (кувшинки, камни)
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (getTile(c, r) === 'water' && Math.random() < 0.14) {
                    if (!bridgeCenter || Math.hypot(c - bridgeCenter.x, r - bridgeCenter.y) > 2.2) {
                        addObj(P.waterDec, c + MB_RAND_FLOAT(0.2, 0.8), r + MB_RAND_FLOAT(0.2, 0.8), MB_RAND_FLOAT(0.7, 1.15), MB_RAND_INT(0, 359));
                    }
                }
            }
        }

        // Поляна-лагерь на берегу
        const campX = rx > cols / 2 ? MB_RAND_INT(3, Math.max(4, rx - 3)) : MB_RAND_INT(Math.min(cols - 4, rx + rWidth + 2), cols - 3);
        const campY = py > rows / 2 ? MB_RAND_INT(2, Math.max(3, py - 3)) : MB_RAND_INT(Math.min(rows - 3, py + 3), rows - 3);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (getTile(campX + dx, campY + dy) === 'grass') setTile(campX + dx, campY + dy, 'dirt');
        addObj(P.campfires, campX + 0.5, campY + 0.5, 1.0, 0);
        addObj(P.tents, campX - 1.3, campY - 0.6, 0.95, MB_RAND_INT(-25, 25));
        addObj(P.bedrolls, campX + 1.4, campY + 0.3, 0.9, MB_RAND_INT(0, 359));
        addObj(P.crates, campX + 0.6, campY + 1.4, 0.85, MB_RAND_INT(0, 359));
        if (Math.random() < 0.7) addObj(P.logs, campX - 0.8, campY + 1.3, 0.9, MB_RAND_INT(0, 180));

        // Многослойный лес (цветы/кусты/грибы -> камни/пни -> кроны деревьев разных размеров)
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (getTile(c, r) !== 'grass') continue;
                if (Math.hypot(c - campX, r - campY) < 2.6) continue;
                const rnd = Math.random();
                const ox = c + MB_RAND_FLOAT(0.15, 0.85), oy = r + MB_RAND_FLOAT(0.15, 0.85);
                if (rnd < 0.14) addObj(P.trees, ox, oy, MB_RAND_FLOAT(0.85, 1.35), MB_RAND_INT(0, 359));
                else if (rnd < 0.25) addObj(P.bushes, ox, oy, MB_RAND_FLOAT(0.7, 1.2), MB_RAND_INT(0, 359));
                else if (rnd < 0.31) addObj(P.flowers, ox, oy, MB_RAND_FLOAT(0.7, 1.1), MB_RAND_INT(0, 359));
                else if (rnd < 0.35) addObj(P.rocks, ox, oy, MB_RAND_FLOAT(0.7, 1.15), MB_RAND_INT(0, 359));
                else if (rnd < 0.37) addObj(P.logs, ox, oy, MB_RAND_FLOAT(0.8, 1.1), MB_RAND_INT(0, 359));
            }
        }
    }

    // 2. УЮТНАЯ ТАВЕРНА / ПОСТОЯЛЫЙ ДВОР
    else if (picked === 'tavern') {
        genTitle = MB_PICK(['Таверна «Золотой Гоблин»', 'Постоялый двор «У Древа»', 'Трактир «Старый Очаг»']);
        const mX = Math.max(1, Math.floor(cols * 0.1));
        const mY = Math.max(1, Math.floor(rows * 0.1));
        const x1 = mX, x2 = cols - 1 - mX, y1 = mY, y2 = rows - 1 - mY;

        for (let r = y1; r <= y2; r++) {
            for (let c = x1; c <= x2; c++) {
                const isWall = (r === y1 || r === y2 || c === x1 || c === x2);
                setTile(c, r, isWall ? 'wall' : 'wood');
            }
        }

        // Разделительная перегородка для задней спальни/кладовой, если таверна просторная
        const splitX = (x2 - x1 >= 10) ? (x2 - 4) : -1;
        if (splitX > 0) {
            for (let r = y1 + 1; r < y2; r++) {
                if (r !== Math.floor((y1 + y2) / 2)) setTile(splitX, r, 'wall');
            }
            addObj(P.doors, splitX + 0.5, Math.floor((y1 + y2) / 2) + 0.5, 0.8, 90);
        }

        // Входная дверь и тропинка снаружи
        const doorY = Math.floor((y1 + y2) / 2);
        setTile(x1, doorY, 'wood');
        addObj(P.doors, x1 + 0.5, doorY + 0.5, 0.85, 90);
        for (let c = 0; c < x1; c++) { setTile(c, doorY, 'dirt'); setTile(c, Math.max(0, doorY - 1), 'dirt'); }

        const hallRight = splitX > 0 ? splitX - 1 : x2 - 1;
        // Камин у северной стены
        const hearthX = Math.floor((x1 + hallRight) / 2);
        setTile(hearthX, y1 + 1, 'stone');
        addObj(P.fireplaces.length ? P.fireplaces : P.campfires, hearthX + 0.5, y1 + 1.35, 1.15, 0);
        addObj(P.rugs, hearthX + 0.5, y1 + 2.9, 1.15, 0);

        // Барная стойка с бочками
        const barX = hallRight - 1;
        for (let r = y1 + 2; r <= Math.min(y2 - 2, y1 + 5); r++) {
            addObj(P.barrels, barX + 0.6, r + 0.3, 0.85, MB_RAND_INT(0, 359));
        }
        addObj(P.candles, barX - 0.3, y1 + 2.5, 0.9, 0);

        // Столы со стульями, едой и свечами в зале
        for (let r = y1 + 2; r <= y2 - 2; r += 3) {
            for (let c = x1 + 2; c <= barX - 2; c += 3) {
                if (Math.hypot(c - hearthX, r - (y1 + 1)) < 2.2) continue;
                addObj(P.tables, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.85, 1.05), MB_PICK([0, 90]));
                addObj(P.chairs, c + 0.5, r - 0.3, 0.8, 180);
                addObj(P.chairs, c + 0.5, r + 1.3, 0.8, 0);
                if (Math.random() < 0.7) addObj(P.food, c + 0.45, r + 0.45, 0.65, MB_RAND_INT(0, 359));
                if (Math.random() < 0.65) addObj(P.candles, c + 0.75, r + 0.45, 0.65, 0);
            }
        }

        // Задняя комната: кровати, шкафы, ковёр, ящики
        if (splitX > 0) {
            addObj(P.beds, x2 - 1.4, y1 + 1.8, 1.0, 0);
            if (y2 - y1 >= 7) addObj(P.beds, x2 - 1.4, y2 - 1.8, 1.0, 0);
            addObj(P.shelves, splitX + 1.3, y1 + 1.3, 0.95, 0);
            addObj(P.crates, splitX + 1.3, y2 - 1.3, 0.9, 15);
            addObj(P.candles, x2 - 2.3, y1 + 1.8, 0.7, 0);
        }

        // Деревья и кусты снаружи здания
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (getTile(c, r) === 'grass' && Math.random() < 0.25) {
                    addObj(Math.random() < 0.6 ? P.trees : P.bushes, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.8, 1.25), MB_RAND_INT(0, 359));
                }
            }
        }
    }

    // 3. ПОДЗЕМЕЛЬЕ / КАТАКОМБЫ
    else if (picked === 'dungeon') {
        genTitle = MB_PICK(['Забытые катакомбы', 'Подземелье Ошибки', 'Гробница Древних', 'Казематы Империи']);
        const floorType = Math.random() < 0.5 ? 'stone' : 'flagstone';
        const rooms = [];
        const attempts = Math.max(8, Math.floor((cols * rows) / 22));
        for (let a = 0; a < attempts; a++) {
            const rw = MB_RAND_INT(4, Math.min(9, Math.max(5, Math.floor(cols / 2.8))));
            const rh = MB_RAND_INT(4, Math.min(8, Math.max(5, Math.floor(rows / 2.6))));
            const rx = MB_RAND_INT(1, Math.max(1, cols - rw - 2));
            const ry = MB_RAND_INT(1, Math.max(1, rows - rh - 2));

            const overlaps = rooms.some(rm => rx <= rm.x + rm.w + 1 && rx + rw + 1 >= rm.x && ry <= rm.y + rm.h + 1 && ry + rh + 1 >= rm.y);
            if (!overlaps) {
                rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: rx + rw / 2, cy: ry + rh / 2 });
                for (let r = ry; r < ry + rh; r++) for (let c = rx; c < rx + rw; c++) setTile(c, r, floorType);
            }
        }

        // Соединяем комнаты широкими коридорами (2 клетки для больших карт)
        const corrW = cols >= 26 ? 2 : 1;
        for (let i = 1; i < rooms.length; i++) {
            const p = rooms[i - 1], n = rooms[i];
            let x = Math.floor(p.cx), y = Math.floor(p.cy);
            const tx = Math.floor(n.cx), ty = Math.floor(n.cy);
            while (x !== tx) {
                for (let d = 0; d < corrW; d++) setTile(x, y + d, floorType);
                x += (tx > x ? 1 : -1);
            }
            while (y !== ty) {
                for (let d = 0; d < corrW; d++) setTile(x + d, y, floorType);
                y += (ty > y ? 1 : -1);
            }
        }

        const hazard = MB_PICK(['lava', 'water', 'abyss']);
        rooms.forEach((rm, idx) => {
            // Светящиеся жаровни в углах
            addObj(P.braziers, rm.x + 0.7, rm.y + 0.7, 0.85, 0);
            if (rm.w >= 5) addObj(P.braziers, rm.x + rm.w - 0.7, rm.y + rm.h - 0.7, 0.85, 0);
            // Паутина и завалы по углам
            if (Math.random() < 0.75) addObj(P.webs, rm.x + rm.w - 0.6, rm.y + 0.6, 0.9, MB_RAND_INT(0, 359));
            if (Math.random() < 0.6) addObj(P.rubble, rm.x + 0.8, rm.y + rm.h - 0.8, 0.85, MB_RAND_INT(0, 359));

            if (idx === rooms.length - 1) {
                // Зал босса / алтаря
                addObj(P.rugs, rm.cx, rm.cy, 1.3, 0);
                addObj(P.altars, rm.cx, rm.cy, 1.15, 0);
                addObj(P.chests, rm.cx + 1.4, rm.cy - 0.4, 0.95, 0);
                addObj(P.crystals, rm.x + 1.0, rm.cy, 0.9, 0);
            } else {
                const theme = Math.random();
                if (theme < 0.32 && rm.w >= 5 && rm.h >= 5) {
                    // Яма с лавой/водой + колонны
                    for (let r = Math.floor(rm.cy) - 1; r <= Math.floor(rm.cy); r++) {
                        for (let c = Math.floor(rm.cx) - 1; c <= Math.floor(rm.cx); c++) setTile(c, r, hazard);
                    }
                    addObj(P.pillars, rm.x + 1.2, rm.y + 1.2, 0.9, 0);
                    addObj(P.pillars, rm.x + rm.w - 1.2, rm.y + 1.2, 0.9, 0);
                } else if (theme < 0.65) {
                    addObj(P.bones, rm.cx + MB_RAND_FLOAT(-0.7, 0.7), rm.cy + MB_RAND_FLOAT(-0.7, 0.7), 1.0, MB_RAND_INT(0, 359));
                    addObj(P.chests, rm.x + rm.w - 1.1, rm.cy, 0.9, MB_PICK([0, 90, 180]));
                } else {
                    addObj(P.crates, rm.cx - 0.8, rm.cy, 0.9, MB_RAND_INT(0, 359));
                    addObj(P.barrels, rm.cx + 0.7, rm.cy + 0.4, 0.9, MB_RAND_INT(0, 359));
                    addObj(P.crystals, rm.cx, rm.cy - 0.8, 0.85, MB_RAND_INT(0, 359));
                }
            }
        });
    }

    // 4. ГОРОД / СТОЛИЦА / РЫНОК
    else if (picked === 'city') {
        genTitle = cols >= 28 ? MB_PICK(['Столица Империи', 'Центральная площадь', 'Торговый квартал']) : MB_PICK(['Деревня Притишье', 'Ярмарочная слобода', 'Городская застава']);
        const isCapital = cols >= 26;
        const street = isCapital ? 'cobble' : 'dirt';
        const midX = Math.floor(cols / 2), midY = Math.floor(rows / 2);

        // Проспекты и улочки
        const roadW = isCapital ? 3 : 2;
        for (let c = 0; c < cols; c++) for (let d = 0; d < roadW; d++) setTile(c, Math.min(rows - 1, midY - 1 + d), street);
        for (let r = 0; r < rows; r++) for (let d = 0; d < roadW; d++) setTile(Math.min(cols - 1, midX - 1 + d), r, street);

        // Центральная мощёная площадь
        const pRad = isCapital ? 3 : 2;
        for (let r = midY - pRad; r <= midY + pRad; r++) {
            for (let c = midX - pRad; c <= midX + pRad; c++) setTile(c, r, 'cobble');
        }
        addObj(P.statues, midX + 0.5, midY + 0.5, 1.25, 0);
        // Фонари вокруг площади
        [[midX - pRad, midY - pRad], [midX + pRad, midY - pRad], [midX - pRad, midY + pRad], [midX + pRad, midY + pRad]].forEach(([lx, ly]) => {
            addObj(P.lamps, lx + 0.5, ly + 0.5, 0.9, 0);
        });

        // Повозки и рыночные ящики вдоль улиц
        addObj(P.carts, midX - pRad - 1.8, midY + 0.5, 1.0, 0);
        addObj(P.carts, midX + pRad + 2.0, midY + 0.4, 1.0, 180);

        // Крепостные стены для крупного города
        if (isCapital) {
            for (let c = 0; c < cols; c++) if (Math.abs(c - midX) > 1) { setTile(c, 0, 'wall'); setTile(c, rows - 1, 'wall'); }
            for (let r = 0; r < rows; r++) if (Math.abs(r - midY) > 1) { setTile(0, r, 'wall'); setTile(cols - 1, r, 'wall'); }
        }

        // Расставляем крупные крыши зданий по кварталам (не наезжая на дороги!)
        const stepX = 5, stepY = 4;
        for (let r = 2; r < rows - 2; r += stepY) {
            for (let c = 2; c < cols - 2; c += stepX) {
                if (Math.abs(c - midX) <= pRad + 1 || Math.abs(r - midY) <= pRad + 1) continue;
                if (getTile(c, r) === 'grass') {
                    if (Math.random() < 0.72) {
                        for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (getTile(c + dc, r + dr) === 'grass') setTile(c + dc, r + dr, 'cobble');
                        addObj(P.roofs, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.85, 1.15), MB_PICK([0, 90, 180, 270]));
                        addObj(P.crates, c + 2.0, r + 1.2, 0.8, MB_RAND_INT(0, 90));
                    } else {
                        // Зелёный скверик
                        addObj(P.trees, c + 0.5, r + 0.5, 1.05, MB_RAND_INT(0, 359));
                        addObj(P.gardens, c + 1.4, r + 0.8, 0.9, MB_RAND_INT(0, 359));
                        addObj(P.flowers, c - 0.6, r + 0.9, 0.9, MB_RAND_INT(0, 359));
                    }
                }
            }
        }
    }

    // 5. ПУСТЫННЫЙ ОАЗИС И КАРАВАН
    else if (picked === 'desert') {
        genTitle = MB_PICK(['Оазис Забытых Песков', 'Стоянка каравана', 'Руины в дюнах']);
        const ox = MB_RAND_INT(Math.floor(cols * 0.35), Math.floor(cols * 0.65));
        const oy = MB_RAND_INT(Math.floor(rows * 0.35), Math.floor(rows * 0.65));
        const rad = Math.max(2.2, Math.min(cols, rows) * 0.22);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const dist = Math.hypot(c - ox, r - oy);
                if (dist < rad) setTile(c, r, 'water');
                else if (dist < rad + 1.6) setTile(c, r, 'grass');
            }
        }
        // Пальмы вокруг оазиса
        for (let a = 0; a < 8; a++) {
            const ang = (a / 8) * Math.PI * 2 + MB_RAND_FLOAT(-0.2, 0.2);
            const px = ox + Math.cos(ang) * (rad + 1.2);
            const py = oy + Math.sin(ang) * (rad + 1.2);
            if (inBounds(Math.floor(px), Math.floor(py))) addObj(P.palms, px, py, MB_RAND_FLOAT(0.85, 1.2), MB_RAND_INT(0, 359));
        }
        // Лагерь каравана
        const tx = ox > cols / 2 ? 3.5 : cols - 3.5;
        const ty = oy > rows / 2 ? 3.5 : rows - 3.5;
        addObj(P.tents, tx, ty, 1.0, MB_RAND_INT(-30, 30));
        addObj(P.campfires, tx + (ox > tx ? 2.0 : -2.0), ty + 0.5, 1.0, 0);
        addObj(P.pots, tx, ty + 1.8, 0.9, MB_RAND_INT(0, 359));
        // Кактусы, скалы, черепа по пустыне
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (getTile(c, r) !== 'sand') continue;
                if (Math.hypot(c - tx, r - ty) < 2.8) continue;
                const rnd = Math.random();
                if (rnd < 0.08) addObj(P.cacti, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.8, 1.15), MB_RAND_INT(0, 359));
                else if (rnd < 0.13) addObj(P.rocks, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.8, 1.2), MB_RAND_INT(0, 359));
                else if (rnd < 0.15) addObj(P.bones, c + 0.5, r + 0.5, 1.0, MB_RAND_INT(0, 359));
            }
        }
    }

    // 6. ВОЛШЕБНЫЙ ФЕЙСКИЙ ЛЕС / ГРИБНАЯ РОЩА
    else if (picked === 'fey') {
        genTitle = MB_PICK(['Фейская роща', 'Светящийся лес Древа', 'Грибное святилище']);
        const cx = cols / 2, cy = rows / 2;
        // Магический пруд или ручей
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const d = Math.hypot((c - cx) * 0.8, r - cy);
                if (d < 2.2) setTile(c, r, 'water');
                else if (d < 4.0 && Math.random() < 0.3) setTile(c, r, 'dirt');
            }
        }
        addObj(P.altars, cx, cy - 2.6, 1.15, 0);
        addObj(P.crystals, cx - 2.3, cy - 1.5, 1.05, 0);
        addObj(P.crystals, cx + 2.3, cy - 1.5, 1.05, 0);
        addObj(P.crystals, cx, cy + 2.7, 1.0, 0);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const t = getTile(c, r);
                if (t === 'water') {
                    if (Math.random() < 0.25) addObj(P.waterDec, c + 0.5, r + 0.5, 0.9, MB_RAND_INT(0, 359));
                    continue;
                }
                const rnd = Math.random();
                const ox = c + MB_RAND_FLOAT(0.15, 0.85), oy = r + MB_RAND_FLOAT(0.15, 0.85);
                if (rnd < 0.20) addObj(P.mushrooms, ox, oy, MB_RAND_FLOAT(0.8, 1.35), MB_RAND_INT(0, 359));
                else if (rnd < 0.28) addObj(P.trees, ox, oy, MB_RAND_FLOAT(0.85, 1.2), MB_RAND_INT(0, 359));
                else if (rnd < 0.34) addObj(P.flowers, ox, oy, MB_RAND_FLOAT(0.8, 1.15), MB_RAND_INT(0, 359));
                else if (rnd < 0.37) addObj(P.crystals, ox, oy, MB_RAND_FLOAT(0.75, 1.05), MB_RAND_INT(0, 359));
            }
        }
    }

    // 7. ПОЛЕ БИТВЫ / ОСАДНЫЙ ЛАГЕРЬ
    else if (picked === 'battlefield') {
        genTitle = MB_PICK(['Осадный рубеж', 'Поле битвы Псов Империи', 'Укреплённый лагерь']);
        // Изрытая землёй центральная полоса боя
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (Math.abs(c - cols / 2) < cols * 0.28 + (Math.random() - 0.5) * 3) setTile(c, r, 'dirt');
            }
        }
        // Линии баррикад и осадных орудий
        const leftLine = Math.floor(cols * 0.3);
        const rightLine = Math.floor(cols * 0.7);
        for (let r = 2; r < rows - 2; r += 3) {
            addObj(P.barricades, leftLine + 0.5, r + 0.5, 1.05, 90);
            addObj(P.barricades, rightLine + 0.5, r + 0.5, 1.05, 270);
        }
        addObj(P.siege, leftLine - 2.2, rows * 0.33, 1.1, 0);
        addObj(P.siege, leftLine - 2.2, rows * 0.67, 1.1, 0);
        addObj(P.siege, rightLine + 2.2, rows * 0.5, 1.1, 180);
        // Шатры в тылу
        addObj(P.tents, 2.5, rows * 0.25, 1.0, 0);
        addObj(P.tents, cols - 2.5, rows * 0.75, 1.0, 180);
        // Очаги огня, камни, оружие на поле
        for (let i = 0; i < Math.floor((cols * rows) / 18); i++) {
            const fx = MB_RAND_FLOAT(2, cols - 2), fy = MB_RAND_FLOAT(1.5, rows - 1.5);
            const r = Math.random();
            if (r < 0.28) addObj(P.fireFx.length ? P.fireFx : P.campfires, fx, fy, MB_RAND_FLOAT(0.7, 1.1), MB_RAND_INT(0, 359));
            else if (r < 0.55) addObj(P.weapons, fx, fy, 0.85, MB_RAND_INT(0, 359));
            else if (r < 0.8) addObj(P.rubble, fx, fy, 0.9, MB_RAND_INT(0, 359));
            else addObj(P.rocks, fx, fy, 0.9, MB_RAND_INT(0, 359));
        }
    }

    // 8. СНЕЖНЫЙ ПЕРЕВАЛ
    else if (picked === 'snow') {
        genTitle = MB_PICK(['Ледяной перевал', 'Замёрзшее озеро', 'Привал в метели']);
        const pit = Math.random() < 0.55 ? 'water' : 'abyss';
        const px = cols * MB_RAND_FLOAT(0.35, 0.65), py = rows * MB_RAND_FLOAT(0.35, 0.65);
        const rad = Math.max(2.2, Math.min(cols, rows) * 0.22);
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (Math.hypot(c - px, r - py) < rad + (Math.random() - 0.5) * 0.9) setTile(c, r, pit);
            }
        }
        // Каменная тропа через перевал + мост
        let ty = Math.floor(rows / 2);
        let br = null;
        for (let c = 0; c < cols; c++) {
            if (Math.random() < 0.3) ty = Math.max(1, Math.min(rows - 2, ty + MB_RAND_INT(-1, 1)));
            if (getTile(c, ty) === pit) { if (!br) br = { x: c + 1.5, y: ty + 0.5 }; }
            else setTile(c, ty, 'stone');
        }
        if (br) addObj(P.bridges, br.x, br.y, 1.15, 0);

        // Тёплый лагерь со шкурами
        const cx = Math.max(2.5, cols * 0.2), cy = Math.max(2.5, rows * 0.26);
        addObj(P.campfires, cx, cy, 1.1, 0);
        addObj(P.tents, cx - 1.2, cy + 1.0, 0.95, 25);
        addObj(P.bedrolls, cx + 1.2, cy + 0.3, 0.95, 90);

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (getTile(c, r) !== 'snow') continue;
                if (Math.hypot(c - cx, r - cy) < 2.6) continue;
                const rnd = Math.random();
                if (rnd < 0.14) addObj(P.snowProps.length && Math.random() < 0.35 ? P.snowProps : P.trees, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.8, 1.2), MB_RAND_INT(0, 359));
                else if (rnd < 0.22) addObj(P.rocks, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.8, 1.2), MB_RAND_INT(0, 359));
            }
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
// 🖌️ СОБЫТИЯ ХОЛСТА (СВОБОДНАЯ РАССТАНОВКА + ПРЕДПРОСМОТР + ЛАСТИК)
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
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = row + dr, nc = col + dc;
                    if (nr >= 0 && nr < data.rows && nc >= 0 && nc < data.cols) {
                        data.cells[nr * data.cols + nc].t = window._mbSelectedTile;
                    }
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
// ✨ HD-РЕНДЕР КАРТЫ: БЕСШОВНЫЕ ТЕКСТУРЫ, МЯГКИЕ БЕРЕГА, 3D-СТЕНЫ И СВЕТ
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
    const data = window._mbData || GET_MB_DATA();
    const tiles = GET_MB_TILES();
    const cols = data.cols, rows = data.rows;
    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;
    const lightCfg = MB_LIGHTING_MODES[data.lighting || window._mbLighting || 'day'] || MB_LIGHTING_MODES.day;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Определяем базовый (самый частый) тип покрытия для подложки
    const counts = {};
    for (const cell of data.cells) counts[cell.t] = (counts[cell.t] || 0) + 1;
    let baseTileKey = 'grass', maxC = -1;
    for (const [k, v] of Object.entries(counts)) {
        if (k !== 'wall' && v > maxC) { maxC = v; baseTileKey = k; }
    }

    const fillStyleForTile = (tileKey) => {
        const cfg = tiles[tileKey] || tiles.grass;
        const img = cfg.img ? MB_GET_LOADED_IMG(cfg.img) : null;
        if (img) return MB_GET_TILE_PATTERN(ctx, tileKey, img, cellW);
        return cfg.bg;
    };

    // СЛОЙ 1: Непрерывная подложка основного биома
    ctx.fillStyle = fillStyleForTile(baseTileKey);
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // СЛОЙ 2: Органические скруглённые слои остальных покрытий (мягкие берега и переходы!)
    const presentTiles = new Set(data.cells.map(c => c.t));
    for (const tKey of MB_TILE_ORDER) {
        if (tKey === baseTileKey || tKey === 'wall' || !presentTiles.has(tKey)) continue;
        const style = fillStyleForTile(tKey);
        const isOrganic = ['water', 'lava', 'dirt', 'sand', 'grass', 'snow', 'abyss'].includes(tKey);
        const bleed = isOrganic ? cellW * 0.14 : 0.6;
        const cornerR = isOrganic ? cellW * 0.36 : cellW * 0.06;

        // Для воды и лавы рисуем мягкий влажный/тёмный берег
        if (tKey === 'water' || tKey === 'lava' || tKey === 'abyss') {
            ctx.save();
            ctx.fillStyle = tKey === 'lava' ? 'rgba(42, 16, 8, 0.72)' : (tKey === 'water' ? 'rgba(34, 28, 18, 0.34)' : 'rgba(0,0,0,0.65)');
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (data.cells[r * cols + c].t !== tKey) continue;
                    DRAW_ROUNDED_RECT(ctx, c * cellW - bleed * 1.45, r * cellH - bleed * 1.45, cellW + bleed * 2.9, cellH + bleed * 2.9, cornerR * 1.25);
                    ctx.fill();
                }
            }
            ctx.restore();
        }

        // Само покрытие из бесшовного паттерна
        ctx.save();
        ctx.fillStyle = style;
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (data.cells[r * cols + c].t !== tKey) continue;
                if (isOrganic) {
                    DRAW_ROUNDED_RECT(ctx, c * cellW - bleed, r * cellH - bleed, cellW + bleed * 2, cellH + bleed * 2, cornerR);
                    ctx.fill();
                } else {
                    ctx.fillRect(c * cellW - 0.5, r * cellH - 0.5, cellW + 1, cellH + 1);
                }
            }
        }
        ctx.restore();

        // Подсветка мелководья/пены у кромки воды
        if (tKey === 'water') {
            ctx.save();
            ctx.strokeStyle = 'rgba(210, 240, 255, 0.26)';
            ctx.lineWidth = Math.max(2, cellW * 0.08);
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (data.cells[r * cols + c].t !== 'water') continue;
                    const x = c * cellW, y = r * cellH;
                    if (r > 0 && data.cells[(r - 1) * cols + c].t !== 'water') { ctx.beginPath(); ctx.moveTo(x, y + 2); ctx.lineTo(x + cellW, y + 2); ctx.stroke(); }
                    if (r < rows - 1 && data.cells[(r + 1) * cols + c].t !== 'water') { ctx.beginPath(); ctx.moveTo(x, y + cellH - 2); ctx.lineTo(x + cellW, y + cellH - 2); ctx.stroke(); }
                    if (c > 0 && data.cells[r * cols + c - 1].t !== 'water') { ctx.beginPath(); ctx.moveTo(x + 2, y); ctx.lineTo(x + 2, y + cellH); ctx.stroke(); }
                    if (c < cols - 1 && data.cells[r * cols + c + 1].t !== 'water') { ctx.beginPath(); ctx.moveTo(x + cellW - 2, y); ctx.lineTo(x + cellW - 2, y + cellH); ctx.stroke(); }
                }
            }
            ctx.restore();
        }
    }

    // СЛОЙ 3: Мягкие 3D-тени, отбрасываемые стенами на пол (Ambient Occlusion)
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
                const g = ctx.createLinearGradient(x, y, x, y + cellH * 0.52);
                g.addColorStop(0, 'rgba(0,0,0,0.52)');
                g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g;
                ctx.fillRect(x, y, cellW, cellH * 0.52);
            }
            if (leftW) {
                const g = ctx.createLinearGradient(x, y, x + cellW * 0.44, y);
                g.addColorStop(0, 'rgba(0,0,0,0.44)');
                g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g;
                ctx.fillRect(x, y, cellW * 0.44, cellH);
            }
            if (botW) {
                const g = ctx.createLinearGradient(x, y + cellH, x, y + cellH * 0.72);
                g.addColorStop(0, 'rgba(0,0,0,0.28)');
                g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g;
                ctx.fillRect(x, y + cellH * 0.72, cellW, cellH * 0.28);
            }
            if (rightW) {
                const g = ctx.createLinearGradient(x + cellW, y, x + cellW * 0.76, y);
                g.addColorStop(0, 'rgba(0,0,0,0.24)');
                g.addColorStop(1, 'rgba(0,0,0,0)');
                ctx.fillStyle = g;
                ctx.fillRect(x + cellW * 0.76, y, cellW * 0.24, cellH);
            }
        }
    }
    ctx.restore();

    // СЛОЙ 4: Тактическая сетка (аккуратная, не перебивает текстуру)
    if (window._mbShowGrid) {
        ctx.save();
        ctx.strokeStyle = 'rgba(230, 200, 140, 0.14)';
        ctx.lineWidth = 1;
        for (let c = 0; c <= cols; c++) {
            ctx.beginPath(); ctx.moveTo(c * cellW + 0.5, 0); ctx.lineTo(c * cellW + 0.5, canvas.height); ctx.stroke();
        }
        for (let r = 0; r <= rows; r++) {
            ctx.beginPath(); ctx.moveTo(0, r * cellH + 0.5); ctx.lineTo(canvas.width, r * cellH + 0.5); ctx.stroke();
        }
        ctx.restore();
    }

    // СЛОЙ 5: Сортировка объектов по 3 Z-слоям и отрисовка слоёв 0 (подложка) и 1 (мебель/декор)
    const lightSources = [];
    const objs = (data.objects || []).map(o => {
        const stObj = MB_FIND_STAMP_OBJ(o.id);
        const meta = MB_ANALYZE_STAMP_META(stObj);
        return { o, stObj, meta };
    });

    const drawObjItem = (item, ghostAlpha = 1.0) => {
        const { o, stObj, meta } = item;
        const cx = o.x * cellW;
        const cy = o.y * cellH;
        const img = stObj && stObj.img ? MB_GET_LOADED_IMG(stObj.img) : null;
        const targetMaxPx = cellW * meta.baseCells * (o.scale || 1.0);

        if (meta.glow && ghostAlpha === 1.0) {
            lightSources.push({ x: cx, y: cy, color: meta.glow.color, r: cellW * meta.glow.radius * (o.scale || 1.0), intensity: meta.glow.intensity });
        }

        ctx.save();
        ctx.globalAlpha = ghostAlpha;
        ctx.translate(cx, cy);
        if (o.rot) ctx.rotate((o.rot * Math.PI) / 180);

        // Тени зависят от высоты слоя (ковры без тени, мебель с плотной тенью, крыши/деревья с широкой мягкой тенью)
        if (meta.layer === 1) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.58)';
            ctx.shadowBlur = Math.max(5, cellW * 0.16);
            ctx.shadowOffsetX = cellW * 0.08;
            ctx.shadowOffsetY = cellH * 0.10;
        } else if (meta.layer === 2) {
            ctx.shadowColor = 'rgba(0, 0, 0, 0.62)';
            ctx.shadowBlur = Math.max(10, cellW * 0.34);
            ctx.shadowOffsetX = cellW * 0.18;
            ctx.shadowOffsetY = cellH * 0.22;
        }

        if (img && img.naturalWidth > 0) {
            // СТРОГО СОХРАНЯЕМ ПРОПОРЦИИ СПРАЙТА!
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

    // СЛОЙ 6: 3D-стены с текстурой и объёмной кромкой
    if (presentTiles.has('wall')) {
        const wallStyle = fillStyleForTile('wall');
        ctx.save();
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (data.cells[r * cols + c].t !== 'wall') continue;
                const x = c * cellW, y = r * cellH;
                ctx.fillStyle = wallStyle;
                ctx.fillRect(x, y, cellW + 0.5, cellH + 0.5);
                // Слегка затемняем верх стен для глубины + светлая грань там, где стена граничит с полом
                ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
                ctx.fillRect(x, y, cellW, cellH);

                ctx.strokeStyle = 'rgba(220, 200, 170, 0.28)';
                ctx.lineWidth = 2;
                if (r > 0 && data.cells[(r - 1) * cols + c].t !== 'wall') { ctx.beginPath(); ctx.moveTo(x, y + 1); ctx.lineTo(x + cellW, y + 1); ctx.stroke(); }
                if (c > 0 && data.cells[r * cols + c - 1].t !== 'wall') { ctx.beginPath(); ctx.moveTo(x + 1, y); ctx.lineTo(x + 1, y + cellH); ctx.stroke(); }

                ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
                ctx.lineWidth = 2.5;
                if (r < rows - 1 && data.cells[(r + 1) * cols + c].t !== 'wall') { ctx.beginPath(); ctx.moveTo(x, y + cellH - 1); ctx.lineTo(x + cellW, y + cellH - 1); ctx.stroke(); }
                if (c < cols - 1 && data.cells[r * cols + c + 1].t !== 'wall') { ctx.beginPath(); ctx.moveTo(x + cellW - 1, y); ctx.lineTo(x + cellW - 1, y + cellH); ctx.stroke(); }
            }
        }
        ctx.restore();
    }

    // СЛОЙ 7: Мебель/декор (слой 1) и высокие кроны/крыши (слой 2)
    objs.filter(i => i.meta.layer === 1).forEach(i => drawObjItem(i));
    objs.filter(i => i.meta.layer === 2).forEach(i => drawObjItem(i));

    // Добавляем лаву в список источников свечения
    if (presentTiles.has('lava')) {
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (data.cells[r * cols + c].t === 'lava' && (r + c) % 2 === 0) {
                    lightSources.push({ x: (c + 0.5) * cellW, y: (r + 0.5) * cellH, color: '255, 110, 32', r: cellW * 2.2, intensity: 0.42 });
                }
            }
        }
    }

    // СЛОЙ 8: Атмосферная цветокоррекция, виньетка и динамическое свечение огней/кристаллов!
    ctx.save();
    if (lightCfg.ambientDark > 0) {
        ctx.fillStyle = `rgba(8, 10, 18, ${lightCfg.ambientDark})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    if (lightCfg.tint) {
        ctx.fillStyle = lightCfg.tint;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    // Мягкие ореолы света поверх затемнения
    if (lightSources.length > 0) {
        ctx.globalCompositeOperation = 'lighter';
        for (const ls of lightSources) {
            const p = Math.min(0.85, ls.intensity * lightCfg.glowPower);
            const grad = ctx.createRadialGradient(ls.x, ls.y, ls.r * 0.06, ls.x, ls.y, ls.r);
            grad.addColorStop(0, `rgba(${ls.color}, ${p})`);
            grad.addColorStop(0.45, `rgba(${ls.color}, ${p * 0.42})`);
            grad.addColorStop(1, `rgba(${ls.color}, 0)`);
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(ls.x, ls.y, ls.r, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalCompositeOperation = 'source-over';
    }

    // Художественная виньетка по краям карты (даёт глубину как в Inkarnate)
    const vig = ctx.createRadialGradient(
        canvas.width / 2, canvas.height / 2, Math.min(canvas.width, canvas.height) * 0.34,
        canvas.width / 2, canvas.height / 2, Math.hypot(canvas.width, canvas.height) * 0.56
    );
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, `rgba(0,0,0,${lightCfg.vignette})`);
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    // Полупрозрачный предпросмотр объекта под курсором (только при редактировании, не при экспорте!)
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
    // Перерисовываем начисто без предпросмотра курсора
    DRAW_MB_CANVAS(true);

    let dataUrl = '';
    try {
        dataUrl = canvas.toDataURL('image/jpeg', 0.87);
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