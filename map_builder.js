// ================================================================
// 🎨 ПРОДВИНУТЫЙ КОНСТРУКТОР КАРТ ДЛЯ ГЕЙМ-МАСТЕРА (map_builder.js)
// Поддержка реальных PNG-текстур из assets/, произвольных размеров
// локации (от таверны до столицы) и процедурной рандомной генерации!
// ================================================================
window._mbCols = window._mbCols || 20;
window._mbRows = window._mbRows || 12;
window._mbTool = window._mbTool || 'tile';          // 'tile' | 'brush3' | 'stamp' | 'eraser'
window._mbSelectedTile = window._mbSelectedTile || 'wall';
window._mbSelectedStamp = window._mbSelectedStamp || 'pine';
window._mbShowGrid = (window._mbShowGrid !== undefined) ? window._mbShowGrid : true;
window._mbRandBiome = window._mbRandBiome || 'random';
window._mbIsDrawing = false;

const MB_SIZE_PRESETS = [
    { label: '🍺 Маленькая (Таверна)', cols: 14, rows: 10 },
    { label: '🌲 Средняя (Поляна/Зал)', cols: 22, rows: 14 },
    { label: '🏘️ Большая (Деревня/Форт)', cols: 32, rows: 20 },
    { label: '👑 Огромная (Столица)', cols: 44, rows: 28 }
];

function GET_MB_TILES() {
    if (window.SITE_ASSETS && window.SITE_ASSETS.builderTiles) return window.SITE_ASSETS.builderTiles;
    return {
        grass:  { name: 'Трава',       icon: '🌿', bg: '#31542c', border: '#233d1f', img: '' },
        dirt:   { name: 'Тропа',       icon: '🛤️', bg: '#694f37', border: '#4f3a27', img: '' },
        cobble: { name: 'Брусчатка',   icon: '🏛️', bg: '#64666b', border: '#484a4f', img: '' },
        stone:  { name: 'Камень',      icon: '🪨', bg: '#4b4e54', border: '#35383d', img: '' },
        wood:   { name: 'Доски',       icon: '🪵', bg: '#734b2c', border: '#54351d', img: '' },
        wall:   { name: 'Стена',       icon: '🧱', bg: '#262422', border: '#57534e', img: '' },
        water:  { name: 'Вода',        icon: '🌊', bg: '#1e527d', border: '#153c5c', img: '' },
        lava:   { name: 'Лава',        icon: '🔥', bg: '#b91c1c', border: '#f97316', img: '' },
        snow:   { name: 'Снег',        icon: '❄️', bg: '#cbd5e1', border: '#94a3b8', img: '' },
        sand:   { name: 'Песок',       icon: '🏜️', bg: '#c2a878', border: '#9e8559', img: '' },
        abyss:  { name: 'Пропасть',    icon: '🕳️', bg: '#0c0c0e', border: '#1d1d21', img: '' }
    };
}

function GET_MB_STAMPS() {
    if (window.SITE_ASSETS && window.SITE_ASSETS.builderStamps) return window.SITE_ASSETS.builderStamps;
    return [
        { id: 'pine', icon: '🌲', label: 'Ель', img: '' },
        { id: 'oak', icon: '🌳', label: 'Дуб', img: '' },
        { id: 'rock', icon: '🪨', label: 'Валун', img: '' },
        { id: 'house', icon: '🏠', label: 'Дом', img: '' },
        { id: 'tower', icon: '🏰', label: 'Башня', img: '' },
        { id: 'door', icon: '🚪', label: 'Дверь', img: '' },
        { id: 'table', icon: '🪑', label: 'Стол', img: '' },
        { id: 'barrel', icon: '🍺', label: 'Бар', img: '' },
        { id: 'chest', icon: '💰', label: 'Сундук', img: '' },
        { id: 'campfire', icon: '🔥', label: 'Костёр', img: '' }
    ];
}

// --- КЭШ КАРТИНОК ИЗ ПАПКИ assets/tiles И assets/stamps ---
window._mbImgCache = window._mbImgCache || {};

function MB_GET_LOADED_IMG(src) {
    if (!src) return null;
    const entry = window._mbImgCache[src];
    if (entry) {
        return entry.status === 'ok' ? entry.img : null;
    }
    const img = new Image();
    window._mbImgCache[src] = { status: 'loading', img };
    img.onload = function() {
        window._mbImgCache[src].status = 'ok';
        // Перерисовываем холст (и кнопки, если открыт конструктор)
        if (document.getElementById('mb-editor-canvas')) {
            DRAW_MB_CANVAS();
        }
    };
    img.onerror = function() {
        window._mbImgCache[src].status = 'error';
    };
    img.src = src;
    return null;
}

function MB_PRELOAD_ALL_ASSETS() {
    const tiles = GET_MB_TILES();
    Object.values(tiles).forEach(t => { if (t.img) MB_GET_LOADED_IMG(t.img); });
    GET_MB_STAMPS().forEach(s => { if (s.img) MB_GET_LOADED_IMG(s.img); });
}

// Преобразует старые сохранённые эмодзи-штампы в новые id штампов (для обратной совместимости)
function MB_FIND_STAMP_OBJ(stampVal) {
    if (!stampVal) return null;
    const list = GET_MB_STAMPS();
    return list.find(s => s.id === stampVal || s.icon === stampVal) || { id: stampVal, icon: stampVal, label: '', img: '' };
}

// --- ХРАНИЛИЩЕ И ИЗМЕНЕНИЕ РАЗМЕРА СЕТКИ ---
function CREATE_EMPTY_MB_DATA(baseTile = 'grass', cols = window._mbCols, rows = window._mbRows) {
    const cells = [];
    for (let i = 0; i < rows * cols; i++) {
        cells.push({ t: baseTile, s: '' });
    }
    return { cols, rows, cells };
}

function GET_MB_DATA() {
    const raw = localStorage.getItem('dnd_map_builder_grid');
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.cols && parsed.rows && Array.isArray(parsed.cells) && parsed.cells.length === parsed.cols * parsed.rows) {
                window._mbCols = parsed.cols;
                window._mbRows = parsed.rows;
                return parsed;
            }
        } catch (e) {}
    }
    return CREATE_EMPTY_MB_DATA('grass', window._mbCols, window._mbRows);
}

function SAVE_MB_DATA(data) {
    try { localStorage.setItem('dnd_map_builder_grid', JSON.stringify(data)); } catch (e) {}
}

// Изменяет размер карты, аккуратно сохраняя уже нарисованные клетки
function MB_RESIZE_GRID(newCols, newRows, clearWithTile = null) {
    const cols = Math.max(8, Math.min(50, parseInt(newCols) || 20));
    const rows = Math.max(6, Math.min(40, parseInt(newRows) || 12));
    const oldData = window._mbData || GET_MB_DATA();

    let nextData;
    if (clearWithTile) {
        nextData = CREATE_EMPTY_MB_DATA(clearWithTile, cols, rows);
    } else {
        const baseTile = (oldData.cells && oldData.cells[0]) ? oldData.cells[0].t : 'grass';
        nextData = CREATE_EMPTY_MB_DATA(baseTile, cols, rows);
        for (let r = 0; r < Math.min(rows, oldData.rows); r++) {
            for (let c = 0; c < Math.min(cols, oldData.cols); c++) {
                nextData.cells[r * cols + c] = Object.assign({}, oldData.cells[r * oldData.cols + c]);
            }
        }
    }

    window._mbCols = cols;
    window._mbRows = rows;
    window._mbData = nextData;
    SAVE_MB_DATA(nextData);
    RENDER_GM_MAP_BUILDER_UI();
}

function OPEN_GM_MAP_BUILDER() {
    MB_PRELOAD_ALL_ASSETS();
    window._mbData = GET_MB_DATA();
    const cont = document.getElementById('gm-tool-modal-content');
    cont.style.maxWidth = '1180px';

    RENDER_GM_MAP_BUILDER_UI();
    OM('gm-tool-modal');
}

function RENDER_GM_MAP_BUILDER_UI() {
    const cont = document.getElementById('gm-tool-modal-content');
    if (!cont) return;
    const data = window._mbData || GET_MB_DATA();
    const cols = data.cols, rows = data.rows;
    window._mbCols = cols;
    window._mbRows = rows;

    const tiles = GET_MB_TILES();
    const stamps = GET_MB_STAMPS();

    // Подбираем размер клетки на холсте (чтобы и маленькая таверна, и огромная столица были чёткими и не весили 10 МБ)
    const cellPx = Math.max(28, Math.min(48, Math.floor(1280 / Math.max(cols, rows * 1.4))));
    const canvasW = cols * cellPx;
    const canvasH = rows * cellPx;

    // Кнопки выбора покрытий
    let tileBtnsHTML = '';
    for (const [key, cfg] of Object.entries(tiles)) {
        const isSel = (window._mbTool === 'tile' || window._mbTool === 'brush3') && window._mbSelectedTile === key;
        const hasPng = cfg.img && window._mbImgCache[cfg.img]?.status === 'ok';
        const thumbStyle = hasPng
            ? `background-image:url('${cfg.img}'); background-size:cover;`
            : `background:${cfg.bg}; border:1px solid ${cfg.border};`;

        tileBtnsHTML += `
            <button class="btn-small" onclick="MB_SELECT_TILE('${key}')"
                style="background:${isSel ? '#c9a96e' : '#181715'}; color:${isSel ? '#141210' : '#ebe8e2'}; border:2px solid ${isSel ? '#fff' : cfg.bg}; padding:5px 9px; display:inline-flex; align-items:center; gap:6px; font-size:0.84rem;">
                <span style="display:inline-block; width:16px; height:16px; border-radius:3px; ${thumbStyle}"></span>
                <span>${cfg.icon} ${cfg.name}</span>
            </button>
        `;
    }

    // Кнопки выбора объектов
    let stampBtnsHTML = stamps.map(st => {
        const isSel = (window._mbTool === 'stamp' && window._mbSelectedStamp === st.id);
        const hasPng = st.img && window._mbImgCache[st.img]?.status === 'ok';
        const previewHTML = hasPng
            ? `<img src="${st.img}" style="width:20px; height:20px; object-fit:contain; vertical-align:middle;">`
            : `<span style="font-size:1.05rem;">${st.icon}</span>`;

        return `
            <button class="btn-small" title="${st.label}" onclick="MB_SELECT_STAMP('${st.id}')"
                style="background:${isSel ? '#c9a96e' : '#181715'}; color:${isSel ? '#141210' : '#fff'}; border:1px solid ${isSel ? '#fff' : '#3d3830'}; padding:4px 8px; display:inline-flex; align-items:center; gap:5px; font-size:0.82rem;">
                ${previewHTML} <span>${st.label}</span>
            </button>
        `;
    }).join('');

    const tModeBtn = (mode, label) => `
        <button class="btn-small" onclick="window._mbTool='${mode}'; RENDER_GM_MAP_BUILDER_UI();"
            style="background:${window._mbTool===mode ? '#7c3aed' : '#22201d'}; color:#fff; border:1px solid ${window._mbTool===mode ? '#e9d5ff' : '#423c33'}; font-size:0.84rem;">
            ${label}
        </button>
    `;

    const sizePresetBtns = MB_SIZE_PRESETS.map(p => {
        const isAct = (cols === p.cols && rows === p.rows);
        return `<button class="btn-small" style="padding:4px 8px; font-size:0.8rem; background:${isAct ? '#c9a96e' : '#22201d'}; color:${isAct ? '#141210' : '#ddd'};" onclick="MB_RESIZE_GRID(${p.cols}, ${p.rows})">${p.label} (${p.cols}×${p.rows})</button>`;
    }).join('');

    const curTitleVal = document.getElementById('mb-map-title-inp')?.value ?? (GET_MAP_STATE().title || 'Новая локация');

    cont.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #3d3830; padding-bottom:10px; margin-bottom:10px; flex-wrap:wrap; gap:10px;">
            <h2 style="margin:0; border:none; padding:0;">🎨 Конструктор Карты (${cols}×${rows} клеток)</h2>
            <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button class="btn-small" style="font-size:0.82rem;" onclick="MB_LOAD_TEMPLATE('tavern')">🍺 Таверна</button>
                <button class="btn-small" style="font-size:0.82rem;" onclick="MB_LOAD_TEMPLATE('forest')">🌲 Лес</button>
                <button class="btn-small" style="font-size:0.82rem;" onclick="MB_LOAD_TEMPLATE('dungeon')">🏰 Подземелье</button>
                <button class="btn-small" style="font-size:0.82rem;" onclick="MB_LOAD_TEMPLATE('city')">🏘️ Город</button>
                <button class="btn-small btn-danger" style="font-size:0.82rem;" onclick="MB_FILL_ALL(window._mbSelectedTile || 'grass')">🗑️ Залить всё выбранным</button>
            </div>
        </div>

        <!-- Размер локации + Рандомный генератор -->
        <div style="display:grid; grid-template-columns: 1.25fr 1fr; gap:10px; margin-bottom:10px;">
            <div style="background:#181715; border:1px solid #423c33; border-radius:10px; padding:10px 12px; display:flex; flex-direction:column; gap:7px;">
                <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px;">
                    <b style="color:#c9a96e; font-size:0.86rem;">📏 Размер локации (клетки):</b>
                    <div style="display:flex; align-items:center; gap:5px;">
                        <input type="number" id="mb-cols-inp" min="8" max="50" value="${cols}" style="width:62px; padding:3px 6px; font-size:0.85rem;">
                        <span>×</span>
                        <input type="number" id="mb-rows-inp" min="6" max="40" value="${rows}" style="width:62px; padding:3px 6px; font-size:0.85rem;">
                        <button class="btn-small btn-save" style="padding:4px 9px; font-size:0.8rem;" onclick="MB_RESIZE_GRID(document.getElementById('mb-cols-inp').value, document.getElementById('mb-rows-inp').value)">Применить</button>
                    </div>
                </div>
                <div style="display:flex; gap:5px; flex-wrap:wrap;">${sizePresetBtns}</div>
            </div>

            <div style="background:#1b1824; border:1px solid #7c3aed; border-radius:10px; padding:10px 12px; display:flex; flex-direction:column; justify-content:space-between; gap:7px;">
                <b style="color:#d8b4fe; font-size:0.86rem;">🎲 Рандомная генерация карты (под текущий размер ${cols}×${rows}):</b>
                <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                    <select id="mb-rand-biome" onchange="window._mbRandBiome=this.value;" style="flex:1; min-width:165px; padding:5px 8px; font-size:0.85rem; text-align:left;">
                        <option value="random" ${window._mbRandBiome==='random'?'selected':''}>🎲 Любая случайная локация</option>
                        <option value="forest" ${window._mbRandBiome==='forest'?'selected':''}>🌲 Дикий лес / река / лагерь</option>
                        <option value="dungeon" ${window._mbRandBiome==='dungeon'?'selected':''}>🏰 Подземелье (комнаты + коридоры)</option>
                        <option value="city" ${window._mbRandBiome==='city'?'selected':''}>👑 Город / Столица / Квартал</option>
                        <option value="tavern" ${window._mbRandBiome==='tavern'?'selected':''}>🍺 Случайная Таверна / Интерьер</option>
                        <option value="snow" ${window._mbRandBiome==='snow'?'selected':''}>❄️ Снежный перевал / Пустошь</option>
                    </select>
                    <button class="btn-small" style="background:linear-gradient(180deg,#8b5cf6 0%,#5b21b6 100%); color:#fff; border-color:#c084fc; padding:6px 12px; font-size:0.86rem;" onclick="MB_GENERATE_RANDOM(document.getElementById('mb-rand-biome').value)">
                        🎲 Сгенерировать!
                    </button>
                </div>
            </div>
        </div>

        <!-- Панель кистей, текстур и объектов -->
        <div style="background:#181715; border:1px solid #423c33; border-radius:10px; padding:10px 12px; margin-bottom:10px; display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                    <b style="color:#c9a96e; font-size:0.85rem;">Инструмент:</b>
                    ${tModeBtn('tile', '🖌️ Кисть 1×1')}
                    ${tModeBtn('brush3', '⬛ Кисть 3×3')}
                    ${tModeBtn('stamp', '🌲 Объекты')}
                    ${tModeBtn('eraser', '🧽 Стереть объект')}
                </div>
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:0.84rem; color:#ccc;">
                    <input type="checkbox" ${window._mbShowGrid ? 'checked' : ''} onchange="window._mbShowGrid=this.checked; DRAW_MB_CANVAS();">
                    <span>📏 Рисовать сетку на карте</span>
                </label>
            </div>

            <div>
                <b style="color:#c9a96e; font-size:0.82rem; display:block; margin-bottom:4px;">Покрытия (папка <code>assets/tiles/</code>):</b>
                <div style="display:flex; gap:5px; flex-wrap:wrap;">${tileBtnsHTML}</div>
            </div>

            <div>
                <b style="color:#c9a96e; font-size:0.82rem; display:block; margin-bottom:4px;">Объекты и декор (папка <code>assets/stamps/</code>, ПКМ по клетке — удалить объект):</b>
                <div style="display:flex; gap:5px; flex-wrap:wrap;">${stampBtnsHTML}</div>
            </div>
        </div>

        <!-- Холст -->
        <div style="display:flex; justify-content:center; align-items:flex-start; background:#0d0c0b; padding:10px; border-radius:10px; border:2px solid #524a3d; overflow:auto; max-height:460px;">
            <canvas id="mb-editor-canvas" width="${canvasW}" height="${canvasH}"
                style="cursor:crosshair; border-radius:6px; max-width:100%; height:auto; box-shadow:0 8px 28px rgba(0,0,0,0.9);">
            </canvas>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:12px; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:250px;">
                <span style="color:#c9a96e; white-space:nowrap;">📍 Название локации:</span>
                <input type="text" id="mb-map-title-inp" value="${curTitleVal.replace(/"/g, '&quot;')}" style="flex:1; text-align:left;">
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn-save" style="padding:11px 20px; font-size:1rem;" onclick="MB_APPLY_TO_GAME_MAP()">
                    ✅ Сохранить и отправить карту игрокам!
                </button>
                <button onclick="CM('gm-tool-modal')">Закрыть</button>
            </div>
        </div>
    `;

    INIT_MB_CANVAS_EVENTS();
    DRAW_MB_CANVAS();
}

function MB_SELECT_TILE(tileKey) {
    window._mbSelectedTile = tileKey;
    if (window._mbTool !== 'tile' && window._mbTool !== 'brush3') window._mbTool = 'tile';
    RENDER_GM_MAP_BUILDER_UI();
}

function MB_SELECT_STAMP(stampId) {
    window._mbSelectedStamp = stampId;
    window._mbTool = 'stamp';
    RENDER_GM_MAP_BUILDER_UI();
}

function MB_FILL_ALL(tileKey) {
    window._mbData = CREATE_EMPTY_MB_DATA(tileKey, window._mbCols, window._mbRows);
    SAVE_MB_DATA(window._mbData);
    DRAW_MB_CANVAS();
}

// ================================================================
// 🎲 ПРОЦЕДУРНЫЙ РАНДОМНЫЙ ГЕНЕРАТОР КАРТ (ПОД ЛЮБОЙ РАЗМЕР СЕТКИ!)
// ================================================================
function MB_RAND_INT(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function MB_GENERATE_RANDOM(biome) {
    const biomes = ['forest', 'dungeon', 'city', 'tavern', 'snow'];
    const picked = (biome === 'random' || !biome) ? biomes[Math.floor(Math.random() * biomes.length)] : biome;

    const cols = window._mbCols, rows = window._mbRows;
    const base = picked === 'dungeon' ? 'wall' : (picked === 'snow' ? 'snow' : (picked === 'city' ? 'grass' : 'grass'));
    const data = CREATE_EMPTY_MB_DATA(base, cols, rows);

    const inBounds = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows;
    const getCell = (c, r) => inBounds(c, r) ? data.cells[r * cols + c] : null;
    const setCell = (c, r, t, s) => {
        if (!inBounds(c, r)) return;
        const cell = data.cells[r * cols + c];
        if (t !== undefined && t !== null) cell.t = t;
        if (s !== undefined) cell.s = s;
    };

    let genTitle = 'Случайная локация';

    if (picked === 'forest') {
        genTitle = ['Лесная чаща', 'Тропа у реки', 'Заросшая переправа', 'Опушка у костра'][MB_RAND_INT(0, 3)];
        // 1. Извилистая река (вертикальная или горизонтальная)
        const verticalRiver = Math.random() > 0.35;
        if (verticalRiver) {
            let rx = MB_RAND_INT(Math.floor(cols * 0.25), Math.floor(cols * 0.72));
            const width = cols >= 26 ? 3 : 2;
            for (let r = 0; r < rows; r++) {
                if (Math.random() < 0.45) rx = Math.max(2, Math.min(cols - width - 2, rx + MB_RAND_INT(-1, 1)));
                for (let w = 0; w < width; w++) setCell(rx + w, r, 'water', '');
            }
            // Извилистая дорога поперёк с мостом
            let py = MB_RAND_INT(Math.floor(rows * 0.25), Math.floor(rows * 0.72));
            for (let c = 0; c < cols; c++) {
                if (Math.random() < 0.25) py = Math.max(1, Math.min(rows - 3, py + MB_RAND_INT(-1, 1)));
                for (let dy = 0; dy <= 1; dy++) {
                    const cell = getCell(c, py + dy);
                    if (cell && cell.t === 'water') setCell(c, py + dy, 'wood', 'bridge');
                    else setCell(c, py + dy, 'dirt', '');
                }
            }
        } else {
            let ry = MB_RAND_INT(Math.floor(rows * 0.25), Math.floor(rows * 0.7));
            for (let c = 0; c < cols; c++) {
                if (Math.random() < 0.4) ry = Math.max(2, Math.min(rows - 4, ry + MB_RAND_INT(-1, 1)));
                setCell(c, ry, 'water', ''); setCell(c, ry + 1, 'water', '');
            }
            let px = MB_RAND_INT(Math.floor(cols * 0.25), Math.floor(cols * 0.7));
            for (let r = 0; r < rows; r++) {
                if (Math.random() < 0.25) px = Math.max(1, Math.min(cols - 3, px + MB_RAND_INT(-1, 1)));
                for (let dx = 0; dx <= 1; dx++) {
                    const cell = getCell(px + dx, r);
                    if (cell && cell.t === 'water') setCell(px + dx, r, 'wood', 'bridge');
                    else setCell(px + dx, r, 'dirt', '');
                }
            }
        }

        // 2. Деревья, валуны и случайный лагерь
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const cell = getCell(c, r);
                if (cell.t === 'grass' && !cell.s) {
                    const rnd = Math.random();
                    if (rnd < 0.14) setCell(c, r, null, 'pine');
                    else if (rnd < 0.24) setCell(c, r, null, 'oak');
                    else if (rnd < 0.28) setCell(c, r, null, 'rock');
                }
            }
        }
        // Небольшая поляна-лагерь
        const cx = MB_RAND_INT(2, cols - 3), cy = MB_RAND_INT(2, rows - 3);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) setCell(cx + dx, cy + dy, 'dirt', '');
        setCell(cx, cy, 'dirt', 'campfire');
        setCell(cx + 1, cy, 'dirt', 'crate');
        if (Math.random() < 0.6) setCell(cx - 1, cy, 'dirt', 'chest');
    }
    else if (picked === 'dungeon') {
        genTitle = ['Забытые катакомбы', 'Подземелье Ошибки', 'Древняя гробница', 'Тайные казематы'][MB_RAND_INT(0, 3)];
        const rooms = [];
        const attempts = Math.max(6, Math.floor((cols * rows) / 28));
        for (let a = 0; a < attempts; a++) {
            const rw = MB_RAND_INT(3, Math.min(8, Math.max(4, Math.floor(cols / 3))));
            const rh = MB_RAND_INT(3, Math.min(7, Math.max(4, Math.floor(rows / 3))));
            const rx = MB_RAND_INT(1, Math.max(1, cols - rw - 2));
            const ry = MB_RAND_INT(1, Math.max(1, rows - rh - 2));

            const overlaps = rooms.some(rm => rx <= rm.x + rm.w + 1 && rx + rw + 1 >= rm.x && ry <= rm.y + rm.h + 1 && ry + rh + 1 >= rm.y);
            if (!overlaps) {
                rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: Math.floor(rx + rw / 2), cy: Math.floor(ry + rh / 2) });
                for (let r = ry; r < ry + rh; r++) {
                    for (let c = rx; c < rx + rw; c++) setCell(c, r, 'stone', '');
                }
            }
        }

        // Соединяем комнаты коридорами
        for (let i = 1; i < rooms.length; i++) {
            const prev = rooms[i - 1], curr = rooms[i];
            let x = prev.cx, y = prev.cy;
            while (x !== curr.cx) { setCell(x, y, 'stone', ''); x += (curr.cx > x ? 1 : -1); }
            while (y !== curr.cy) { setCell(x, y, 'stone', ''); y += (curr.cy > y ? 1 : -1); }
        }

        // Наполняем комнаты декором (факелы, сундуки, алтарь, лава/вода, паутина, кости)
        const hazard = Math.random() < 0.5 ? 'lava' : 'water';
        rooms.forEach((rm, idx) => {
            setCell(rm.x, rm.y, 'stone', 'torch');
            if (idx === rooms.length - 1) {
                setCell(rm.cx, rm.cy, 'stone', 'altar');
                setCell(rm.cx + 1, rm.cy, 'stone', 'chest');
            } else {
                const dec = Math.random();
                if (dec < 0.35) setCell(rm.cx, rm.cy, 'stone', 'chest');
                else if (dec < 0.65) setCell(rm.cx, rm.cy, 'stone', 'bones');
                else if (dec < 0.85) setCell(rm.x + rm.w - 1, rm.y + rm.h - 1, 'stone', 'web');
                else if (rm.w >= 5 && rm.h >= 5) {
                    setCell(rm.cx, rm.cy, hazard, '');
                    setCell(rm.cx - 1, rm.cy, hazard, '');
                }
            }
        });
    }
    else if (picked === 'city') {
        genTitle = cols >= 30 ? ['Столица Империи', 'Верхний квартал Столицы', 'Торговый район'][MB_RAND_INT(0, 2)] : ['Деревня Притишье', 'Торговая слобода', 'Приграничный городок'][MB_RAND_INT(0, 2)];
        const isBigCity = cols >= 28;
        const streetTile = isBigCity ? 'cobble' : 'dirt';
        const plazaTile = 'cobble';

        // Заливаем базой и прокладываем главные проспекты
        const midX = Math.floor(cols / 2), midY = Math.floor(rows / 2);
        const roadW = isBigCity ? 3 : 2;
        for (let c = 0; c < cols; c++) {
            for (let d = 0; d < roadW; d++) setCell(c, Math.min(rows - 1, midY - 1 + d), streetTile, '');
        }
        for (let r = 0; r < rows; r++) {
            for (let d = 0; d < roadW; d++) setCell(Math.min(cols - 1, midX - 1 + d), r, streetTile, '');
        }

        // Дополнительные поперечные улочки для больших городов
        if (cols >= 26) {
            const x1 = Math.floor(cols * 0.25), x2 = Math.floor(cols * 0.75);
            for (let r = 1; r < rows - 1; r++) { setCell(x1, r, streetTile, ''); setCell(x2, r, streetTile, ''); }
        }
        if (rows >= 18) {
            const y1 = Math.floor(rows * 0.25), y2 = Math.floor(rows * 0.75);
            for (let c = 1; c < cols - 1; c++) { setCell(c, y1, streetTile, ''); setCell(c, y2, streetTile, ''); }
        }

        // Центральная площадь с фонтаном
        for (let r = midY - 2; r <= midY + 2; r++) {
            for (let c = midX - 2; c <= midX + 2; c++) setCell(c, r, plazaTile, '');
        }
        setCell(midX, midY, plazaTile, 'fountain');

        // Крепостные стены по периметру для столицы
        if (isBigCity) {
            for (let c = 0; c < cols; c++) {
                if (Math.abs(c - midX) > 1) { setCell(c, 0, 'wall', ''); setCell(c, rows - 1, 'wall', ''); }
            }
            for (let r = 0; r < rows; r++) {
                if (Math.abs(r - midY) > 1) { setCell(0, r, 'wall', ''); setCell(cols - 1, r, 'wall', ''); }
            }
            setCell(1, 1, 'stone', 'tower'); setCell(cols - 2, 1, 'stone', 'tower');
            setCell(1, rows - 2, 'stone', 'tower'); setCell(cols - 2, rows - 2, 'stone', 'tower');
        }

        // Расставляем дома, лавки и зелёные скверы в кварталах
        for (let r = 1; r < rows - 1; r++) {
            for (let c = 1; c < cols - 1; c++) {
                const cell = getCell(c, r);
                if (cell.t === 'grass' && !cell.s) {
                    const rnd = Math.random();
                    if (rnd < 0.28) { setCell(c, r, 'cobble', 'house'); }
                    else if (rnd < 0.34) { setCell(c, r, 'grass', 'oak'); }
                    else if (rnd < 0.38) { setCell(c, r, 'dirt', 'crate'); }
                    else if (rnd < 0.40) { setCell(c, r, 'cobble', 'barrel'); }
                }
            }
        }
    }
    else if (picked === 'tavern') {
        genTitle = ['Таверна «Золотой Гоблин»', 'Постоялый двор «У Древа»', 'Трактир «Пьяный Тролль»'][MB_RAND_INT(0, 2)];
        const mX = Math.max(1, Math.floor(cols * 0.12));
        const mY = Math.max(1, Math.floor(rows * 0.12));
        const x1 = mX, x2 = cols - 1 - mX, y1 = mY, y2 = rows - 1 - mY;

        for (let r = y1; r <= y2; r++) {
            for (let c = x1; c <= x2; c++) {
                const isWall = (r === y1 || r === y2 || c === x1 || c === x2);
                setCell(c, r, isWall ? 'wall' : 'wood', '');
            }
        }
        // Главная дверь
        const doorY = MB_RAND_INT(y1 + 2, Math.max(y1 + 2, y2 - 2));
        setCell(x1, doorY, 'wood', 'door');
        for (let c = 0; c < x1; c++) setCell(c, doorY, 'dirt', '');

        // Барная стойка
        const barX = Math.max(x1 + 3, x2 - 3);
        for (let r = y1 + 1; r <= Math.min(y2 - 2, y1 + 5); r++) setCell(barX, r, 'wood', 'barrel');

        // Камин
        const hearthX = Math.floor((x1 + barX) / 2);
        setCell(hearthX, y1 + 1, 'stone', 'campfire');
        if (hearthX + 1 < barX) setCell(hearthX + 1, y1 + 1, 'stone', 'campfire');

        // Случайная расстановка столов и кроватей в задней комнате
        for (let r = y1 + 2; r < y2 - 1; r += 2) {
            for (let c = x1 + 2; c < barX - 1; c += 3) {
                if (Math.random() < 0.72) setCell(c, r, 'wood', 'table');
            }
        }
        setCell(x2 - 1, y1 + 1, 'wood', 'crate');
        setCell(x2 - 1, y2 - 1, 'wood', 'bed');
        if (y2 - y1 >= 8) setCell(x2 - 1, y2 - 3, 'wood', 'bed');
        // Несколько деревьев снаружи
        for (let i = 0; i < Math.floor(cols / 2); i++) {
            const tc = MB_RAND_INT(0, cols - 1), tr = MB_RAND_INT(0, rows - 1);
            if (getCell(tc, tr)?.t === 'grass') setCell(tc, tr, 'grass', Math.random() < 0.5 ? 'pine' : 'oak');
        }
    }
    else if (picked === 'snow') {
        genTitle = ['Ледяной перевал', 'Снежная пустошь', 'Замёрзшее озеро'][MB_RAND_INT(0, 2)];
        // Замёрзшее озеро или расщелина в центре
        const pitTile = Math.random() < 0.5 ? 'water' : 'abyss';
        const px = MB_RAND_INT(Math.floor(cols * 0.3), Math.floor(cols * 0.7));
        const py = MB_RAND_INT(Math.floor(rows * 0.3), Math.floor(rows * 0.7));
        const rad = Math.max(2, Math.floor(Math.min(cols, rows) / 5));
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                if (Math.hypot(c - px, r - py) <= rad + (Math.random() - 0.5)) setCell(c, r, pitTile, '');
                else if (Math.random() < 0.16) setCell(c, r, 'snow', 'pine');
                else if (Math.random() < 0.08) setCell(c, r, 'stone', 'rock');
            }
        }
        // Заснеженная каменная тропа
        let ty = Math.floor(rows / 2);
        for (let c = 0; c < cols; c++) {
            if (Math.random() < 0.3) ty = Math.max(1, Math.min(rows - 2, ty + MB_RAND_INT(-1, 1)));
            const cell = getCell(c, ty);
            if (cell && (cell.t === 'water' || cell.t === 'abyss')) setCell(c, ty, 'wood', 'bridge');
            else setCell(c, ty, 'stone', '');
        }
        setCell(Math.max(1, Math.floor(cols * 0.2)), Math.max(1, Math.floor(rows * 0.25)), 'snow', 'campfire');
    }

    const titleInp = document.getElementById('mb-map-title-inp');
    if (titleInp) titleInp.value = genTitle;

    window._mbData = data;
    SAVE_MB_DATA(data);
    DRAW_MB_CANVAS();
}

// Готовые аккуратные шаблоны (адаптируются под любой текущий размер сетки)
function MB_LOAD_TEMPLATE(type) {
    if (type === 'tavern' || type === 'forest' || type === 'dungeon' || type === 'city') {
        // Для единообразия и масштабирования под любую сетку вызываем профильный генератор с предсказуемым каркасом
        MB_GENERATE_RANDOM(type);
    }
}

// ================================================================
// 🖌️ РИСОВАНИЕ НА ХОЛСТЕ И ОТРИСОВКА ТЕКСТУР / PNG
// ================================================================
function INIT_MB_CANVAS_EVENTS() {
    const canvas = document.getElementById('mb-editor-canvas');
    if (!canvas) return;

    const applyAtEvent = (e, isRightClick = false) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const data = window._mbData;
        const cellW = canvas.width / data.cols;
        const cellH = canvas.height / data.rows;
        const col = Math.floor(x / cellW);
        const row = Math.floor(y / cellH);
        if (col < 0 || col >= data.cols || row < 0 || row >= data.rows) return;

        const idx = row * data.cols + col;

        if (isRightClick || window._mbTool === 'eraser') {
            data.cells[idx].s = '';
        } else if (window._mbTool === 'tile') {
            data.cells[idx].t = window._mbSelectedTile;
        } else if (window._mbTool === 'brush3') {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = row + dr, nc = col + dc;
                    if (nr >= 0 && nr < data.rows && nc >= 0 && nc < data.cols) {
                        data.cells[nr * data.cols + nc].t = window._mbSelectedTile;
                    }
                }
            }
        } else if (window._mbTool === 'stamp') {
            data.cells[idx].s = window._mbSelectedStamp;
        }

        SAVE_MB_DATA(data);
        DRAW_MB_CANVAS();
    };

    canvas.onmousedown = function(e) {
        if (e.button === 2) { applyAtEvent(e, true); return; }
        window._mbIsDrawing = true;
        applyAtEvent(e, false);
    };
    canvas.onmousemove = function(e) {
        if (!window._mbIsDrawing) return;
        applyAtEvent(e, false);
    };
    if (!window._mbMouseUpBound) {
        window._mbMouseUpBound = true;
        window.addEventListener('mouseup', () => { window._mbIsDrawing = false; });
    }
    canvas.oncontextmenu = function(e) { e.preventDefault(); applyAtEvent(e, true); };
}

// Улучшенная процедурная фактура (если для тайла ещё не загружен PNG в assets/tiles/)
function DRAW_MB_PROCEDURAL_TILE(ctx, tileKey, cfg, x, y, w, h, c, r) {
    ctx.fillStyle = cfg.bg;
    ctx.fillRect(x, y, w, h);

    // Детерминированный псевдослучайный сдвиг по координатам клетки (чтобы текстура не мерцала)
    const hash = ((c * 73856093) ^ (r * 19349663)) & 255;

    if (tileKey === 'grass') {
        ctx.fillStyle = (hash % 2 === 0) ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = 'rgba(134, 239, 172, 0.18)';
        ctx.fillRect(x + (hash % 17) + 4, y + ((hash * 3) % 15) + 4, 2, 5);
        ctx.fillRect(x + ((hash * 5) % 19) + 6, y + ((hash * 7) % 17) + 6, 2, 4);
    } else if (tileKey === 'wood') {
        ctx.strokeStyle = 'rgba(25, 12, 4, 0.35)';
        ctx.lineWidth = 1;
        for (let i = 1; i <= 3; i++) {
            const py = y + (h / 4) * i;
            ctx.beginPath(); ctx.moveTo(x, py); ctx.lineTo(x + w, py); ctx.stroke();
        }
        ctx.fillStyle = (hash % 3 === 0) ? 'rgba(255,220,170,0.06)' : 'rgba(0,0,0,0.06)';
        ctx.fillRect(x, y, w, h / 2);
    } else if (tileKey === 'stone' || tileKey === 'cobble') {
        ctx.strokeStyle = 'rgba(0,0,0,0.28)';
        ctx.lineWidth = 1;
        const pad = tileKey === 'cobble' ? 2 : 3;
        ctx.strokeRect(x + pad, y + pad, w / 2 - pad, h / 2 - pad);
        ctx.strokeRect(x + w / 2, y + pad, w / 2 - pad, h / 2 - pad);
        ctx.strokeRect(x + pad, y + h / 2, w / 2 - pad, h / 2 - pad);
        ctx.strokeRect(x + w / 2, y + h / 2, w / 2 - pad, h / 2 - pad);
        ctx.fillStyle = (hash % 2 === 0) ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
        ctx.fillRect(x + pad, y + pad, w - pad * 2, h / 2 - pad);
    } else if (tileKey === 'wall') {
        // Объёмный каменный блок с фаской
        ctx.fillStyle = '#383430';
        ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
        ctx.fillStyle = '#1c1917';
        ctx.fillRect(x + 4, y + h - 6, w - 6, 4);
        ctx.fillRect(x + w - 6, y + 4, 4, h - 6);
        ctx.strokeStyle = '#6b655e';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
    } else if (tileKey === 'water') {
        ctx.fillStyle = 'rgba(125, 211, 252, 0.22)';
        const wy = y + h * 0.35 + (hash % 6);
        ctx.fillRect(x + 5, wy, w - 12, 2);
        ctx.fillRect(x + 9, wy + h * 0.28, w - 16, 2);
    } else if (tileKey === 'lava') {
        ctx.fillStyle = 'rgba(251, 146, 60, 0.45)';
        ctx.beginPath();
        ctx.arc(x + w * 0.45, y + h * 0.5, w * 0.24, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(254, 240, 138, 0.5)';
        ctx.beginPath();
        ctx.arc(x + w * 0.45, y + h * 0.5, w * 0.1, 0, Math.PI * 2);
        ctx.fill();
    } else if (tileKey === 'dirt' || tileKey === 'sand') {
        ctx.fillStyle = 'rgba(0,0,0,0.12)';
        ctx.fillRect(x + (hash % 18) + 4, y + ((hash * 2) % 18) + 4, 3, 2);
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(x + ((hash * 5) % 18) + 5, y + ((hash * 3) % 18) + 5, 2, 2);
    } else if (tileKey === 'snow') {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(x + (hash % 20) + 6, y + ((hash * 3) % 20) + 6, 3, 0, Math.PI * 2);
        ctx.fill();
    }
}

function DRAW_MB_CANVAS() {
    const canvas = document.getElementById('mb-editor-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const data = window._mbData || GET_MB_DATA();
    const tiles = GET_MB_TILES();
    const cols = data.cols, rows = data.rows;
    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Слой 1: Покрытия клеток (реальный PNG из assets/tiles/ ИЛИ процедурная фактура)
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = data.cells[r * cols + c] || { t: 'grass', s: '' };
            const cfg = tiles[cell.t] || tiles.grass;
            const x = c * cellW, y = r * cellH;

            const tileImg = cfg.img ? MB_GET_LOADED_IMG(cfg.img) : null;
            if (tileImg) {
                ctx.drawImage(tileImg, x, y, cellW + 0.5, cellH + 0.5);
            } else {
                DRAW_MB_PROCEDURAL_TILE(ctx, cell.t, cfg, x, y, cellW, cellH, c, r);
            }
        }
    }

    // Слой 2: Мягкая тень от стен на соседние клетки пола (даёт крутой 3D-объём!)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = data.cells[r * cols + c];
            if (cell && cell.t !== 'wall') {
                const topIsWall = (r > 0 && data.cells[(r - 1) * cols + c]?.t === 'wall');
                const leftIsWall = (c > 0 && data.cells[r * cols + (c - 1)]?.t === 'wall');
                if (topIsWall) ctx.fillRect(c * cellW, r * cellH, cellW, cellH * 0.22);
                if (leftIsWall) ctx.fillRect(c * cellW, r * cellH, cellW * 0.18, cellH);
            }
        }
    }

    // Слой 3: Тактическая сетка (если включена)
    if (window._mbShowGrid) {
        ctx.strokeStyle = 'rgba(201, 169, 110, 0.2)';
        ctx.lineWidth = 1;
        for (let c = 0; c <= cols; c++) {
            ctx.beginPath(); ctx.moveTo(c * cellW, 0); ctx.lineTo(c * cellW, canvas.height); ctx.stroke();
        }
        for (let r = 0; r <= rows; r++) {
            ctx.beginPath(); ctx.moveTo(0, r * cellH); ctx.lineTo(canvas.width, r * cellH); ctx.stroke();
        }
    }

    // Слой 4: Объекты и мебель (реальный PNG из assets/stamps/ с тенью ИЛИ иконка)
    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = data.cells[r * cols + c];
            if (!cell || !cell.s) continue;
            const stObj = MB_FIND_STAMP_OBJ(cell.s);
            const x = c * cellW, y = r * cellH;
            const stampImg = stObj && stObj.img ? MB_GET_LOADED_IMG(stObj.img) : null;

            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
            ctx.shadowBlur = 6;
            ctx.shadowOffsetX = 2;
            ctx.shadowOffsetY = 3;

            if (stampImg) {
                const pad = cellW * 0.04;
                ctx.drawImage(stampImg, x + pad, y + pad, cellW - pad * 2, cellH - pad * 2);
            } else {
                ctx.font = `${Math.floor(cellH * 0.66)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(stObj ? stObj.icon : cell.s, x + cellW / 2, y + cellH / 2 + 1);
            }
            ctx.restore();
        }
    }
}

// Запекает готовую карту в JPEG и отправляет на стол всем игрокам
function MB_APPLY_TO_GAME_MAP() {
    const canvas = document.getElementById('mb-editor-canvas');
    if (!canvas) return;
    let dataUrl = '';
    try {
        dataUrl = canvas.toDataURL('image/jpeg', 0.84);
    } catch (err) {
        showMessage('⚠️ Ошибка локального запуска (CORS)',
            'Браузер заблокировал сохранение холста с локальными PNG-картинками, потому что сайт открыт напрямую как файл (<code>file://</code>).<br><br>' +
            'Чтобы экспорт работал с PNG-текстурами из папки <b>assets/</b>, открывайте сайт через <b>GitHub Pages</b> или через <b>Live Server в VS Code</b>.');
        return;
    }

    const newTitle = document.getElementById('mb-map-title-inp')?.value.trim() || 'Нарисованная локация';
    const st = GET_MAP_STATE();
    st.img = dataUrl;
    st.title = newTitle;
    st.grid = false; // Сетка уже учтена в конструкторе
    st.fog = false;
    st.revealedAreas = [];
    SAVE_MAP_STATE(st);

    RENDER_MAP_AREA();
    CM('gm-tool-modal');
    LOG_COMBAT_TO_CHAT(`🗺️ Гейм-Мастер создал и выложил тактическую карту (${window._mbCols}×${window._mbRows}): «${newTitle}»!`);
}