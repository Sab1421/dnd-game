// ================================================================
// 🎨 ВСТРОЕННЫЙ КОНСТРУКТОР КАРТ ДЛЯ ГЕЙМ-МАСТЕРА (MAP BUILDER STUDIO)
// ================================================================
window._mbCols = 20;
window._mbRows = 12;
window._mbTool = 'tile';        // 'tile' | 'brush3' | 'stamp' | 'eraser'
window._mbSelectedTile = 'wall';
window._mbSelectedStamp = '🌲';
window._mbIsDrawing = false;

const MB_TILES = {
    grass:  { name: '🌿 Трава',       bg: '#2d4c2b', border: '#243e22', pattern: 'grass' },
    dirt:   { name: '🛤️ Земля/Тропа', bg: '#5c4632', border: '#4a3727', pattern: 'dirt' },
    stone:  { name: '🪨 Каменный пол', bg: '#474a4f', border: '#33363a', pattern: 'stone' },
    wood:   { name: '🪵 Доски (Пол)',  bg: '#69462b', border: '#4f331e', pattern: 'wood' },
    wall:   { name: '🧱 Стена',        bg: '#1c1b1a', border: '#78716c', pattern: 'wall' },
    water:  { name: '🌊 Вода',         bg: '#1e4e79', border: '#163b5c', pattern: 'water' },
    lava:   { name: '🔥 Лава',         bg: '#b91c1c', border: '#f97316', pattern: 'lava' },
    snow:   { name: '❄️ Снег/Лёд',     bg: '#cbd5e1', border: '#94a3b8', pattern: 'snow' },
    abyss:  { name: '🕳️ Пропасть',     bg: '#09090b', border: '#18181b', pattern: 'abyss' }
};

const MB_STAMPS = [
    { icon: '🌲', label: 'Дерево' },
    { icon: '🌳', label: 'Дуб' },
    { icon: '🪨', label: 'Валун' },
    { icon: '🚪', label: 'Дверь' },
    { icon: '🪑', label: 'Стол/Стул' },
    { icon: '🍺', label: 'Бочка/Бар' },
    { icon: '📦', label: 'Ящик' },
    { icon: '💰', label: 'Сундук' },
    { icon: '🔥', label: 'Костёр' },
    { icon: '🕯️', label: 'Факел' },
    { icon: '🛏️', label: 'Кровать' },
    { icon: '⛩️', label: 'Алтарь' },
    { icon: '⛲', label: 'Фонтан' },
    { icon: '🌉', label: 'Мост' },
    { icon: '🕸️', label: 'Паутина' },
    { icon: '💀', label: 'Кости' }
];

function GET_MB_DATA() {
    const raw = localStorage.getItem('dnd_map_builder_grid');
    if (raw) {
        try {
            const parsed = JSON.parse(raw);
            if (parsed.cells && parsed.cells.length === window._mbRows * window._mbCols) return parsed;
        } catch (e) {}
    }
    return CREATE_EMPTY_MB_DATA('grass');
}

function CREATE_EMPTY_MB_DATA(baseTile = 'grass') {
    const cells = [];
    for (let i = 0; i < window._mbRows * window._mbCols; i++) {
        cells.push({ t: baseTile, s: '' });
    }
    return { cols: window._mbCols, rows: window._mbRows, cells };
}

function SAVE_MB_DATA(data) {
    localStorage.setItem('dnd_map_builder_grid', JSON.stringify(data));
}

function OPEN_GM_MAP_BUILDER() {
    window._mbData = GET_MB_DATA();
    const cont = document.getElementById('gm-tool-modal-content');
    cont.style.maxWidth = '1120px';

    RENDER_GM_MAP_BUILDER_UI();
    OM('gm-tool-modal');
}

function RENDER_GM_MAP_BUILDER_UI() {
    const cont = document.getElementById('gm-tool-modal-content');
    if (!cont) return;
    const data = window._mbData || GET_MB_DATA();

    // Кнопки выбора кисти ландшафта
    let tileBtnsHTML = '';
    for (const [key, cfg] of Object.entries(MB_TILES)) {
        const isSel = (window._mbTool === 'tile' || window._mbTool === 'brush3') && window._mbSelectedTile === key;
        tileBtnsHTML += `
            <button class="btn-small" onclick="MB_SELECT_TILE('${key}')"
                style="background:${isSel ? '#c9a96e' : '#181715'}; color:${isSel ? '#141210' : '#ebe8e2'}; border:2px solid ${isSel ? '#fff' : cfg.bg}; padding:6px 10px; display:inline-flex; align-items:center; gap:6px;">
                <span style="display:inline-block; width:14px; height:14px; border-radius:3px; background:${cfg.bg}; border:1px solid ${cfg.border};"></span>
                <span>${cfg.name}</span>
            </button>
        `;
    }

    // Кнопки выбора штампов (объектов декора)
    let stampBtnsHTML = MB_STAMPS.map(st => {
        const isSel = (window._mbTool === 'stamp' && window._mbSelectedStamp === st.icon);
        return `
            <button class="btn-small" title="${st.label}" onclick="MB_SELECT_STAMP('${st.icon}')"
                style="background:${isSel ? '#c9a96e' : '#181715'}; color:${isSel ? '#141210' : '#fff'}; border:1px solid ${isSel ? '#fff' : '#3d3830'}; padding:5px 9px; font-size:1.1rem;">
                ${st.icon} <small style="font-size:0.72rem;">${st.label}</small>
            </button>
        `;
    }).join('');

    const tModeBtn = (mode, label) => `
        <button class="btn-small" onclick="window._mbTool='${mode}'; RENDER_GM_MAP_BUILDER_UI();"
            style="background:${window._mbTool===mode ? '#7c3aed' : '#22201d'}; color:#fff; border:1px solid ${window._mbTool===mode ? '#e9d5ff' : '#423c33'};">
            ${label}
        </button>
    `;

    cont.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #3d3830; padding-bottom:10px; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
            <h2 style="margin:0; border:none; padding:0;">🎨 Конструктор Карты (20×12 клеток)</h2>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button class="btn-small" onclick="MB_LOAD_TEMPLATE('tavern')">🍺 Шаблон: Таверна</button>
                <button class="btn-small" onclick="MB_LOAD_TEMPLATE('forest')">🌲 Шаблон: Лес с рекой</button>
                <button class="btn-small" onclick="MB_LOAD_TEMPLATE('dungeon')">🏰 Шаблон: Подземелье</button>
                <button class="btn-small btn-danger" onclick="MB_FILL_ALL('grass')">🗑️ Очистить (Трава)</button>
                <button class="btn-small btn-danger" onclick="MB_FILL_ALL('stone')">🗑️ Очистить (Камень)</button>
            </div>
        </div>

        <!-- Панель инструментов: Режим кисти + Текстуры + Объекты -->
        <div style="background:#181715; border:1px solid #423c33; border-radius:10px; padding:12px; margin-bottom:12px; display:flex; flex-direction:column; gap:10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;">
                <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
                    <b style="color:#c9a96e; font-size:0.88rem;">1. Режим кисти:</b>
                    ${tModeBtn('tile', '🖌️ Кисть (1 кл.)')}
                    ${tModeBtn('brush3', '⬛ Широкая кисть (3×3)')}
                    ${tModeBtn('stamp', '🌲 Ставить объекты')}
                    ${tModeBtn('eraser', '🧽 Ластик объектов')}
                </div>
                <small style="color:#9e988e;">💡 Зажмите ЛКМ и водите по сетке для быстрого рисования!</small>
            </div>

            <div>
                <b style="color:#c9a96e; font-size:0.85rem; display:block; margin-bottom:5px;">2. Покрытие клетки (Пол / Стены / Вода):</b>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">${tileBtnsHTML}</div>
            </div>

            <div>
                <b style="color:#c9a96e; font-size:0.85rem; display:block; margin-bottom:5px;">3. Объекты и мебель поверх клеток:</b>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">${stampBtnsHTML}</div>
            </div>
        </div>

        <!-- Интерактивный холст для рисования и предпросмотра -->
        <div style="display:flex; justify-content:center; background:#0d0c0b; padding:10px; border-radius:10px; border:2px solid #524a3d; overflow:auto;">
            <canvas id="mb-editor-canvas" width="900" height="540"
                style="cursor:crosshair; border-radius:6px; max-width:100%; height:auto; box-shadow:0 8px 28px rgba(0,0,0,0.9);">
            </canvas>
        </div>

        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:8px; flex:1; min-width:260px;">
                <span style="color:#c9a96e; white-space:nowrap;">📍 Название локации:</span>
                <input type="text" id="mb-map-title-inp" value="${(GET_MAP_STATE().title || 'Новая локация').replace(/"/g, '&quot;')}" style="flex:1; text-align:left;">
            </div>
            <div style="display:flex; gap:10px;">
                <button class="btn-save" style="padding:12px 22px; font-size:1.05rem;" onclick="MB_APPLY_TO_GAME_MAP()">
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
    if (window._mbTool !== 'tile' && window._mbTool !== 'brush3') {
        window._mbTool = 'tile';
    }
    RENDER_GM_MAP_BUILDER_UI();
}

function MB_SELECT_STAMP(icon) {
    window._mbSelectedStamp = icon;
    window._mbTool = 'stamp';
    RENDER_GM_MAP_BUILDER_UI();
}

function MB_FILL_ALL(tileKey) {
    window._mbData = CREATE_EMPTY_MB_DATA(tileKey);
    SAVE_MB_DATA(window._mbData);
    DRAW_MB_CANVAS();
}

// Генератор готовых красивых шаблонов (Таверна, Лесная чаща с рекой, Подземелье)
function MB_LOAD_TEMPLATE(type) {
    const cols = window._mbCols, rows = window._mbRows;
    const data = CREATE_EMPTY_MB_DATA('grass');
    const setCell = (c, r, t, s = '') => {
        if (c >= 0 && c < cols && r >= 0 && r < rows) {
            data.cells[r * cols + c] = { t, s };
        }
    };

    if (type === 'tavern') {
        // Вокруг трава, внутри деревянный зал таверны со стенами, столами, камином и стойкой бара
        for (let r = 1; r < rows - 1; r++) {
            for (let c = 2; c < cols - 2; c++) {
                const isWall = (r === 1 || r === rows - 2 || c === 2 || c === cols - 3);
                setCell(c, r, isWall ? 'wall' : 'wood');
            }
        }
        setCell(2, Math.floor(rows / 2), 'wood', '🚪'); // Входная дверь
        setCell(cols - 3, 4, 'wood', '🚪'); // Задняя дверь
        // Барная стойка
        for (let r = 2; r <= 6; r++) setCell(cols - 6, r, 'wood', '🍺');
        // Камин у северной стены
        setCell(9, 2, 'stone', '🔥');
        setCell(10, 2, 'stone', '🔥');
        // Столы в зале
        [[6, 4], [6, 8], [10, 5], [10, 8]].forEach(([c, r]) => setCell(c, r, 'wood', '🪑'));
        setCell(cols - 4, 2, 'wood', '📦');
        setCell(cols - 4, 9, 'wood', '🛏️');
        const titleInp = document.getElementById('mb-map-title-inp');
        if (titleInp) titleInp.value = 'Таверна «Притишье»';
    } else if (type === 'forest') {
        // Лесная тропа через реку с мостом и лагерем
        for (let r = 0; r < rows; r++) {
            setCell(9, r, 'water');
            setCell(10, r, 'water');
        }
        for (let c = 0; c < cols; c++) {
            setCell(c, 5, 'dirt');
            setCell(c, 6, 'dirt');
        }
        setCell(9, 5, 'wood', '🌉'); setCell(10, 5, 'wood', '🌉');
        setCell(9, 6, 'wood', '🌉'); setCell(10, 6, 'wood', '🌉');
        [[2,2],[4,1],[6,3],[3,9],[6,10],[14,2],[17,3],[15,9],[18,8],[13,10]].forEach(([c,r]) => setCell(c, r, 'grass', '🌲'));
        [[7,2],[12,8],[16,4]].forEach(([c,r]) => setCell(c, r, 'grass', '🪨'));
        setCell(14, 5, 'dirt', '🔥');
        const titleInp = document.getElementById('mb-map-title-inp');
        if (titleInp) titleInp.value = 'Лесная переправа';
    } else if (type === 'dungeon') {
        // Каменное подземелье с коридором, залом алтаря и лавой
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) setCell(c, r, 'wall');
        }
        // Входной зал и коридор
        for (let r = 3; r <= 8; r++) for (let c = 1; c <= 5; c++) setCell(c, r, 'stone');
        for (let c = 6; c <= 10; c++) { setCell(c, 5, 'stone'); setCell(c, 6, 'stone'); }
        setCell(6, 5, 'stone', '🚪');
        // Главный зал с лавой по краям и алтарём
        for (let r = 1; r <= 10; r++) for (let c = 11; c <= 18; c++) setCell(c, r, 'stone');
        for (let r = 1; r <= 2; r++) for (let c = 12; c <= 17; c++) setCell(c, r, 'lava');
        for (let r = 9; r <= 10; r++) for (let c = 12; c <= 17; c++) setCell(c, r, 'lava');
        setCell(16, 5, 'stone', '⛩️');
        setCell(17, 5, 'stone', '💰');
        setCell(12, 3, 'stone', '🕯️'); setCell(12, 8, 'stone', '🕯️');
        setCell(3, 4, 'stone', '💀');
        const titleInp = document.getElementById('mb-map-title-inp');
        if (titleInp) titleInp.value = 'Древнее святилище';
    }

    window._mbData = data;
    SAVE_MB_DATA(data);
    DRAW_MB_CANVAS();
}

function INIT_MB_CANVAS_EVENTS() {
    const canvas = document.getElementById('mb-editor-canvas');
    if (!canvas) return;

    const applyAtEvent = (e, isRightClick = false) => {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const cellW = canvas.width / window._mbCols;
        const cellH = canvas.height / window._mbRows;
        const col = Math.floor(x / cellW);
        const row = Math.floor(y / cellH);
        if (col < 0 || col >= window._mbCols || row < 0 || row >= window._mbRows) return;

        const data = window._mbData;
        const idx = row * window._mbCols + col;

        if (isRightClick || window._mbTool === 'eraser') {
            data.cells[idx].s = '';
        } else if (window._mbTool === 'tile') {
            data.cells[idx].t = window._mbSelectedTile;
        } else if (window._mbTool === 'brush3') {
            for (let dr = -1; dr <= 1; dr++) {
                for (let dc = -1; dc <= 1; dc++) {
                    const nr = row + dr, nc = col + dc;
                    if (nr >= 0 && nr < window._mbRows && nc >= 0 && nc < window._mbCols) {
                        data.cells[nr * window._mbCols + nc].t = window._mbSelectedTile;
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
        if (e.button === 2) {
            applyAtEvent(e, true);
            return;
        }
        window._mbIsDrawing = true;
        applyAtEvent(e, false);
    };
    canvas.onmousemove = function(e) {
        if (!window._mbIsDrawing) return;
        applyAtEvent(e, false);
    };
    window.addEventListener('mouseup', () => { window._mbIsDrawing = false; });
    canvas.oncontextmenu = function(e) { e.preventDefault(); applyAtEvent(e, true); };
}

// Отрисовка клеток с текстурами и объектами на HTML5 Canvas
function DRAW_MB_CANVAS() {
    const canvas = document.getElementById('mb-editor-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const data = window._mbData || GET_MB_DATA();
    const cols = window._mbCols, rows = window._mbRows;
    const cellW = canvas.width / cols;
    const cellH = canvas.height / rows;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
            const cell = data.cells[r * cols + c] || { t: 'grass', s: '' };
            const cfg = MB_TILES[cell.t] || MB_TILES.grass;
            const x = c * cellW, y = r * cellH;

            // Базовый цвет тайла
            ctx.fillStyle = cfg.bg;
            ctx.fillRect(x, y, cellW, cellH);

            // Декоративные узоры в зависимости от типа материала
            if (cell.t === 'wall') {
                ctx.fillStyle = '#2e2c29';
                ctx.fillRect(x + 3, y + 3, cellW - 6, cellH - 6);
                ctx.strokeStyle = '#57534e';
                ctx.lineWidth = 2;
                ctx.strokeRect(x + 2, y + 2, cellW - 4, cellH - 4);
            } else if (cell.t === 'wood') {
                ctx.strokeStyle = 'rgba(0,0,0,0.22)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.moveTo(x, y + cellH / 2);
                ctx.lineTo(x + cellW, y + cellH / 2);
                ctx.stroke();
            } else if (cell.t === 'water') {
                ctx.fillStyle = 'rgba(125, 211, 252, 0.14)';
                ctx.fillRect(x + 6, y + cellH * 0.4, cellW - 12, 3);
            } else if (cell.t === 'lava') {
                ctx.fillStyle = 'rgba(253, 224, 71, 0.28)';
                ctx.beginPath();
                ctx.arc(x + cellW / 2, y + cellH / 2, 6, 0, Math.PI * 2);
                ctx.fill();
            } else if (cell.t === 'grass') {
                ctx.fillStyle = 'rgba(134, 239, 172, 0.08)';
                if ((r + c) % 2 === 0) ctx.fillRect(x, y, cellW, cellH);
            }

            // Рамка тактической клетки
            ctx.strokeStyle = 'rgba(201, 169, 110, 0.22)';
            ctx.lineWidth = 1;
            ctx.strokeRect(x, y, cellW, cellH);

            // Штамп (объект) поверх клетки
            if (cell.s) {
                ctx.font = `${Math.floor(cellH * 0.62)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.shadowColor = 'rgba(0,0,0,0.85)';
                ctx.shadowBlur = 6;
                ctx.fillText(cell.s, x + cellW / 2, y + cellH / 2 + 2);
                ctx.shadowBlur = 0;
            }
        }
    }
}

// Запекает нарисованную карту в DataURL и отправляет её на стол всем игрокам!
function MB_APPLY_TO_GAME_MAP() {
    const canvas = document.getElementById('mb-editor-canvas');
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const newTitle = document.getElementById('mb-map-title-inp')?.value.trim() || 'Нарисованная локация';

    const st = GET_MAP_STATE();
    st.img = dataUrl;
    st.title = newTitle;
    st.grid = false; // Сетка уже красиво прорисована на самом холсте конструктора!
    st.fog = false;
    SAVE_MAP_STATE(st);

    RENDER_MAP_AREA();
    CM('gm-tool-modal');
    LOG_COMBAT_TO_CHAT(`🗺️ Гейм-Мастер создал и выложил новую тактическую карту: «${newTitle}»!`);
}