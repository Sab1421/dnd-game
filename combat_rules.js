// ================================================================
// 🧱 НЕПРОХОДИМОСТЬ СТЕН, ЛИМИТ ДВИЖЕНИЯ В БОЮ (ФТ),
// ДАЛЬНОСТЬ АТАК/ЗАКЛИНАНИЙ И ВЫХОД ИЗ БОЯ (combat_rules.js)
// ================================================================
(function INIT_COMBAT_PHYSICS_AND_WALLS() {
    window._gmWallBrushMode = false;
    window._gmWallBrushAction = 'block'; // 'block' | 'erase'
    window._gmWallOverlayVisible = false;

    let isPaintingWalls = false;
    let dragStartInfo = null;
    let wallWarningTimer = null;

    function ESC(s) {
        return String(s || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    // --- 1. СЕТКА МАСШТАБА И МАСКА ПРЕПЯТСТВИЙ ---
    function GET_MAP_GRID_DIMS(st) {
        if (st && st.mapCols && st.mapRows) {
            return { cols: st.mapCols, rows: st.mapRows };
        }
        const vp = document.getElementById('map-viewport');
        const gs = Math.max(20, (st && st.gridSize) || 48);
        const w = (vp && vp.clientWidth) ? vp.clientWidth : 800;
        const h = (vp && vp.clientHeight) ? vp.clientHeight : 500;
        return {
            cols: Math.max(8, Math.min(50, Math.round(w / gs))),
            rows: Math.max(6, Math.min(40, Math.round(h / gs)))
        };
    }

    function ENSURE_COLLISION_MASK(st) {
        const { cols, rows } = GET_MAP_GRID_DIMS(st);
        const needLen = cols * rows;
        if (!st.collisionMask || st.collisionMask.length !== needLen || st.mapCols !== cols || st.mapRows !== rows) {
            st.mapCols = cols;
            st.mapRows = rows;
            st.collisionMask = '0'.repeat(needLen);
        }
        return st;
    }

    function IS_CELL_BLOCKED(st, c, r) {
        if (!st || !st.collisionMask || !st.mapCols || !st.mapRows) return false;
        if (c < 0 || c >= st.mapCols || r < 0 || r >= st.mapRows) return true;
        return st.collisionMask.charCodeAt(r * st.mapCols + c) === 49; // '1'
    }

    function PCT_TO_CELL(st, xPct, yPct) {
        const { cols, rows } = GET_MAP_GRID_DIMS(st);
        return {
            c: Math.max(0, Math.min(cols - 1, Math.floor((xPct / 100) * cols))),
            r: Math.max(0, Math.min(rows - 1, Math.floor((yPct / 100) * rows)))
        };
    }

    // Расстояние между двумя точками карты (в футах, 1 клетка = 5 фт)
    window.CALC_MAP_DISTANCE_FT = function(st, x1Pct, y1Pct, x2Pct, y2Pct) {
        const { cols, rows } = GET_MAP_GRID_DIMS(st);
        const dx = ((x2Pct - x1Pct) / 100) * cols;
        const dy = ((y2Pct - y1Pct) / 100) * rows;
        return Math.round(Math.hypot(dx, dy) * 5);
    };

    // Проверка отрезка на пересечение со стеной (возвращает последнюю свободную точку)
    function TRACE_PATH_AGAINST_WALLS(st, x0, y0, x1, y1) {
        if (!st || !st.collisionMask || !st.collisionMask.includes('1')) {
            return { blocked: false, x: x1, y: y1 };
        }
        const { cols, rows } = GET_MAP_GRID_DIMS(st);
        const startCell = PCT_TO_CELL(st, x0, y0);
        const startInsideWall = IS_CELL_BLOCKED(st, startCell.c, startCell.r);

        const distCells = Math.hypot(((x1 - x0) / 100) * cols, ((y1 - y0) / 100) * rows);
        const steps = Math.max(10, Math.ceil(distCells * 6));
        let lastX = x0, lastY = y0;

        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const px = x0 + (x1 - x0) * t;
            const py = y0 + (y1 - y0) * t;
            const cell = PCT_TO_CELL(st, px, py);
            const blocked = IS_CELL_BLOCKED(st, cell.c, cell.r);

            // Если фишка случайно оказалась внутри стены — позволяем ей выйти наружу
            if (blocked && !(startInsideWall && cell.c === startCell.c && cell.r === startCell.r)) {
                return { blocked: true, x: lastX, y: lastY };
            }
            lastX = px;
            lastY = py;
        }
        return { blocked: false, x: x1, y: y1 };
    }

    // Проверка линии видимости между двумя точками (игнорируем стартовую и конечную клетки)
    function HAS_LINE_OF_SIGHT(st, x0, y0, x1, y1) {
        if (!st || !st.collisionMask || !st.collisionMask.includes('1')) return true;
        const { cols, rows } = GET_MAP_GRID_DIMS(st);
        const c0 = PCT_TO_CELL(st, x0, y0);
        const c1 = PCT_TO_CELL(st, x1, y1);
        const distCells = Math.hypot(((x1 - x0) / 100) * cols, ((y1 - y0) / 100) * rows);
        const steps = Math.max(8, Math.ceil(distCells * 5));

        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const cell = PCT_TO_CELL(st, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
            if ((cell.c === c0.c && cell.r === c0.r) || (cell.c === c1.c && cell.r === c1.r)) continue;
            if (IS_CELL_BLOCKED(st, cell.c, cell.r)) return false;
        }
        return true;
    }

    // Ограничение точки по радиусу оставшегося движения (в футах)
    function CLAMP_TO_MOVEMENT_FT(st, x0, y0, x1, y1, maxFt) {
        const { cols, rows } = GET_MAP_GRID_DIMS(st);
        const dxC = ((x1 - x0) / 100) * cols;
        const dyC = ((y1 - y0) / 100) * rows;
        const distFt = Math.hypot(dxC, dyC) * 5;
        if (distFt <= maxFt || distFt < 0.01) {
            return { clamped: false, x: x1, y: y1, usedFt: Math.round(distFt) };
        }
        const ratio = Math.max(0, maxFt) / distFt;
        return {
            clamped: true,
            x: Math.max(2, Math.min(98, x0 + (x1 - x0) * ratio)),
            y: Math.max(2, Math.min(98, y0 + (y1 - y0) * ratio)),
            usedFt: Math.round(Math.max(0, maxFt))
        };
    }

    function SHOW_MAP_RULE_HINT(text, isError = false) {
        const mapArea = document.getElementById('map-area');
        if (!mapArea) return;
        let box = document.getElementById('cr-map-hint-pill');
        if (!box) {
            box = document.createElement('div');
            box.id = 'cr-map-hint-pill';
            box.style.cssText = 'position:absolute; top:54px; left:50%; transform:translateX(-50%); z-index:18; padding:6px 14px; border-radius:20px; font-size:0.84rem; font-weight:bold; pointer-events:none; box-shadow:0 6px 18px rgba(0,0,0,0.85); white-space:nowrap;';
            mapArea.appendChild(box);
        }
        box.style.background = isError ? 'rgba(92, 28, 28, 0.94)' : 'rgba(22, 20, 18, 0.94)';
        box.style.color = isError ? '#fecaca' : '#e6c88c';
        box.style.border = `1px solid ${isError ? '#c96060' : '#c9a96e'}`;
        box.textContent = text;
        box.style.display = 'block';
        if (wallWarningTimer) clearTimeout(wallWarningTimer);
        wallWarningTimer = setTimeout(() => { if (box) box.style.display = 'none'; }, 2400);
    }

    // --- 2. АВТО-ЭКСПОРТ СТЕН ИЗ СТУДИИ КАРТ ---
    const _ORIG_MB_APPLY = window.MB_APPLY_TO_GAME_MAP;
    if (typeof _ORIG_MB_APPLY === 'function') {
        window.MB_APPLY_TO_GAME_MAP = function() {
            const mb = window._mbData || (typeof GET_MB_DATA === 'function' ? GET_MB_DATA() : null);
            _ORIG_MB_APPLY();
            if (!mb || !mb.cols || !mb.rows || !Array.isArray(mb.cells)) return;

            const st = GET_MAP_STATE();
            st.mapCols = mb.cols;
            st.mapRows = mb.rows;
            // Стены, лава и пропасть — непроходимы; полы, мебель (столы/кровати) и двери — проходимы
            let mask = '';
            for (let i = 0; i < mb.cells.length; i++) {
                const t = (mb.cells[i] && mb.cells[i].t) ? mb.cells[i].t : '';
                mask += /^(wall|abyss|lava)/.test(t) ? '1' : '0';
            }
            st.collisionMask = mask;
            SAVE_MAP_STATE(st);
            RENDER_MAP_AREA();
        };
    }

    // --- 3. КИСТЬ СТЕН И КАЛИБРОВКА ДЛЯ ЗАГРУЖЕННЫХ КАРТ (ТОЛЬКО МАСТЕР) ---
    window.TOGGLE_GM_WALL_BRUSH = function() {
        const sess = GET_SESSION();
        if (!sess || sess.role !== 'gm') return;
        window._gmWallBrushMode = !window._gmWallBrushMode;
        window._gmWallOverlayVisible = window._gmWallBrushMode;
        if (window._gmWallBrushMode) {
            window._gmPinPlacementMode = false;
            window._gmFogEraserMode = false;
            if (typeof SET_TACTICS_TOOL === 'function' && window._tacTool !== 'none') SET_TACTICS_TOOL('none');
            if (typeof STOP_MAP_PAN_MODE === 'function') STOP_MAP_PAN_MODE();
        }
        RENDER_MAP_AREA();
    };

    window.SET_MAP_SCALE_PRESET = function(cols, rows) {
        const st = GET_MAP_STATE();
        st.mapCols = cols;
        st.mapRows = rows;
        st.collisionMask = '0'.repeat(cols * rows);
        SAVE_MAP_STATE(st);
        SHOW_MAP_RULE_HINT(`📏 Масштаб карты: ${cols}×${rows} клеток (${cols * 5}×${rows * 5} фт)`);
        RENDER_MAP_AREA();
    };

    window.CLEAR_MAP_WALLS = function() {
        if (!confirm('Очистить все отмеченные непроходимые стены на этой карте?')) return;
        const st = ENSURE_COLLISION_MASK(GET_MAP_STATE());
        st.collisionMask = '0'.repeat(st.mapCols * st.mapRows);
        SAVE_MAP_STATE(st);
        RENDER_MAP_AREA();
    };

    function PAINT_WALL_AT_EVENT(e, forceAction) {
        const vp = document.getElementById('map-viewport');
        if (!vp) return;
        const rect = vp.getBoundingClientRect();
        const xPct = Math.max(0, Math.min(99.9, ((e.clientX - rect.left) / Math.max(1, rect.width)) * 100));
        const yPct = Math.max(0, Math.min(99.9, ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100));

        const st = ENSURE_COLLISION_MASK(GET_MAP_STATE());
        const { c, r } = PCT_TO_CELL(st, xPct, yPct);
        const idx = r * st.mapCols + c;
        const ch = (forceAction || window._gmWallBrushAction) === 'erase' ? '0' : '1';
        if (st.collisionMask[idx] === ch) return;

        st.collisionMask = st.collisionMask.slice(0, idx) + ch + st.collisionMask.slice(idx + 1);
        SAVE_MAP_STATE(st);
        DRAW_WALL_OVERLAY_AND_MOVE_RING();
    }

    function DRAW_WALL_OVERLAY_AND_MOVE_RING() {
        const vp = document.getElementById('map-viewport');
        if (!vp) return;
        const st = GET_MAP_STATE();
        const sess = GET_SESSION();
        const isGM = sess && sess.role === 'gm';

        let svg = document.getElementById('cr-physics-svg');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.id = 'cr-physics-svg';
            svg.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:4; overflow:visible;';
            vp.appendChild(svg);
        }

        const w = Math.max(100, vp.clientWidth || 800);
        const h = Math.max(100, vp.clientHeight || 500);
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

        const parts = [];

        // А) Сетка непроходимых стен (видна ТОЛЬКО Мастеру в режиме кисти)
        if (isGM && window._gmWallOverlayVisible && st.mapCols && st.mapRows) {
            const cw = w / st.mapCols;
            const ch = h / st.mapRows;
            for (let c = 0; c <= st.mapCols; c++) {
                parts.push(`<line x1="${c * cw}" y1="0" x2="${c * cw}" y2="${h}" stroke="rgba(230,200,140,0.22)" stroke-width="1"/>`);
            }
            for (let r = 0; r <= st.mapRows; r++) {
                parts.push(`<line x1="0" y1="${r * ch}" x2="${w}" y2="${r * ch}" stroke="rgba(230,200,140,0.22)" stroke-width="1"/>`);
            }
            if (st.collisionMask) {
                for (let r = 0; r < st.mapRows; r++) {
                    for (let c = 0; c < st.mapCols; c++) {
                        if (IS_CELL_BLOCKED(st, c, r)) {
                            parts.push(`<rect x="${c * cw + 1}" y="${r * ch + 1}" width="${Math.max(1, cw - 2)}" height="${Math.max(1, ch - 2)}" fill="rgba(200, 62, 62, 0.44)" stroke="rgba(248, 113, 113, 0.72)" stroke-width="1"/>`);
                        }
                    }
                }
            }
        }

        // Б) Мягкий круг доступного движения вокруг активного игрока в его ход
        if (sess && sess.role === 'player' && st.turnOrder && st.turnOrder.active && st.tokens && st.tokens.length) {
            const to = ENSURE_TURN_STATE(st);
            const activeTok = st.tokens[(to.currentIdx || 0) % st.tokens.length];
            const cs = GC();
            const c = cs[PI];
            if (c && c.inCombat && activeTok && activeTok.isPlayer && activeTok.charIdx === PI && (to.moveLeft ?? 0) > 0) {
                const { cols, rows } = GET_MAP_GRID_DIMS(st);
                const cx = (activeTok.x / 100) * w;
                const cy = (activeTok.y / 100) * h;
                const rx = ((to.moveLeft / 5) / cols) * w;
                const ry = ((to.moveLeft / 5) / rows) * h;
                parts.push(`<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="rgba(108, 184, 120, 0.08)" stroke="rgba(108, 184, 120, 0.55)" stroke-width="1.8" stroke-dasharray="7 5"/>`);
            }
        }

        svg.innerHTML = parts.join('');
    }

    // --- 4. ЗАПАС ДВИЖЕНИЯ В ХОДУ И КНОПКА «↩️ ОТМЕНИТЬ ШАГ» ---
    const _ORIG_ENSURE_TURN = window.ENSURE_TURN_STATE;
    window.ENSURE_TURN_STATE = function(st) {
        const to = _ORIG_ENSURE_TURN(st);
        if (to.moveMax === undefined) {
            const tokens = st.tokens || [];
            const activeTok = tokens.length ? tokens[(to.currentIdx || 0) % tokens.length] : null;
            const cs = GC();
            const speed = (activeTok && activeTok.isPlayer && cs[activeTok.charIdx])
                ? (parseInt(cs[activeTok.charIdx].speed, 10) || 30)
                : 30;
            to.moveMax = speed;
            to.moveLeft = speed;
        }
        if (to.moveLeft === undefined) to.moveLeft = to.moveMax || 30;
        return to;
    };

    const _ORIG_RESET_ACTIONS = window.RESET_ACTIONS_FOR_CURRENT_FIGHTER;
    window.RESET_ACTIONS_FOR_CURRENT_FIGHTER = function(st) {
        _ORIG_RESET_ACTIONS(st);
        const to = window.ENSURE_TURN_STATE(st);
        const tokens = st.tokens || [];
        const activeTok = tokens.length ? tokens[(to.currentIdx || 0) % tokens.length] : null;
        const cs = GC();
        let speed = 30;
        if (activeTok && activeTok.isPlayer && cs[activeTok.charIdx]) {
            speed = parseInt(cs[activeTok.charIdx].speed, 10) || 30;
        }
        to.moveMax = speed;
        to.moveLeft = speed;
        to.hasActed = false;
        to.turnStartPos = activeTok ? { x: activeTok.x, y: activeTok.y } : null;
    };

    // Если игрок нажал «🏃 Рывок» из tactics.js — реально добавляем его скорость к запасу движения!
    const _ORIG_BASIC_ACT = window.TAC_USE_BASIC_ACTION;
    if (typeof _ORIG_BASIC_ACT === 'function') {
        window.TAC_USE_BASIC_ACTION = function(actId) {
            _ORIG_BASIC_ACT(actId);
            const st = GET_MAP_STATE();
            const to = window.ENSURE_TURN_STATE(st);
            if (actId === 'dash') {
                const cs = GC();
                const spd = parseInt(cs[PI]?.speed, 10) || 30;
                to.moveMax = (to.moveMax || spd) + spd;
                to.moveLeft = (to.moveLeft || 0) + spd;
            }
            to.hasActed = true;
            SAVE_MAP_STATE(st);
            RENDER_MAP_AREA();
        };
    }

    window.UNDO_COMBAT_MOVEMENT = function() {
        const st = GET_MAP_STATE();
        const to = window.ENSURE_TURN_STATE(st);
        if (!to.turnStartPos || to.hasActed) return;
        const tok = st.tokens && st.tokens[(to.currentIdx || 0) % st.tokens.length];
        if (!tok || !tok.isPlayer || tok.charIdx !== PI) return;

        tok.x = to.turnStartPos.x;
        tok.y = to.turnStartPos.y;
        to.moveLeft = to.moveMax || 30;
        SAVE_MAP_STATE(st);
        SHOW_MAP_RULE_HINT('↩️ Шаг отменён — движение восстановлено');
        RENDER_MAP_AREA();
    };

    // --- 5. РАСЧЁТ ДАЛЬНОСТИ ОРУЖИЯ И ЗАКЛИНАНИЙ ---
    function GET_WEAPON_RANGE_FT(item) {
        if (!item) return { min: 5, max: 5, label: '5 фт', isMelee: true };
        const txt = `${item.name || ''} ${item.properties || ''} ${item.desc || ''}`.toLowerCase();

        // Прямое указание дистанции в свойствах (напр. 80/320 или 20/60)
        const mRange = txt.match(/(\d+)\s*\/\s*(\d+)/);
        if (mRange) {
            const norm = parseInt(mRange[1], 10);
            const longR = parseInt(mRange[2], 10);
            return { min: norm, max: longR, label: `${norm}/${longR} фт`, isMelee: false };
        }
        if (item.ranged || /лук|арбалет|праща|мушкет|пистолет/i.test(txt)) {
            return { min: 80, max: 150, label: '80 фт', isMelee: false };
        }
        if (/метательн|кинжал|топорик|дротик/i.test(txt)) {
            return { min: 20, max: 60, label: '5 фт / бросок 20 фт', isMelee: false };
        }
        if (/досягаем|алебард|глеф|пика|кнут/i.test(txt)) {
            return { min: 10, max: 10, label: '10 фт', isMelee: true };
        }
        return { min: 5, max: 5, label: '5 фт', isMelee: true };
    }

    function GET_SPELL_RANGE_FT(sp) {
        if (!sp) return { max: 60, selfOnly: false, label: '60 фт' };
        const r = String(sp.range || '').toLowerCase();
        if (r.includes('на себя')) return { max: 999, selfOnly: true, label: 'На себя' };
        if (r.includes('касан')) return { max: 5, selfOnly: false, label: '5 фт (Касание)' };
        const m = r.match(/(\d+)\s*фт/);
        if (m) {
            const ft = parseInt(m[1], 10);
            return { max: ft, selfOnly: false, label: `${ft} фт` };
        }
        return { max: 60, selfOnly: false, label: sp.range || '60 фт' };
    }

    function CHECK_ATTACK_REACH(rangeFt, labelName, isSelfOnly = false) {
        if (isSelfOnly) return { ok: true, distFt: 0 };
        const st = GET_MAP_STATE();
        const tokens = st.tokens || [];
        const myTok = tokens.find(t => t.isPlayer && t.charIdx === PI);
        const targetTok = tokens[window._bg3SelectedTargetIdx];
        if (!myTok || !targetTok || myTok === targetTok) return { ok: true, distFt: 0 };

        const distFt = window.CALC_MAP_DISTANCE_FT(st, myTok.x, myTok.y, targetTok.x, targetTok.y);
        // +2.5 фт допуска на диагонали и центры фишек (соседняя клетка по диагонали = 7.07 фт -> считается в пределах 5 фт)
        if (distFt > rangeFt + 2.5) {
            return {
                ok: false,
                distFt,
                reason: `📏 Слишком далеко! До «${targetTok.name}» ${distFt} фт, а дальность «${labelName}» — ${rangeFt} фт. Подойдите ближе или выберите другое оружие.`
            };
        }
        if (!HAS_LINE_OF_SIGHT(st, myTok.x, myTok.y, targetTok.x, targetTok.y)) {
            return {
                ok: false,
                distFt,
                reason: `🧱 Цель «${targetTok.name}» скрыта за стеной! Переместитесь так, чтобы открыть линию видимости.`
            };
        }
        return { ok: true, distFt };
    }

    // Оборачиваем боевые атаки с проверкой дистанции и стен
    const _ORIG_USE_WEP = window.BG3_PLAYER_USE_WEAPON;
    if (typeof _ORIG_USE_WEP === 'function') {
        window.BG3_PLAYER_USE_WEAPON = function(invIdx) {
            const cs = GC();
            const item = cs[PI]?.inventory?.[invIdx];
            if (item) {
                const rng = GET_WEAPON_RANGE_FT(item);
                const chk = CHECK_ATTACK_REACH(rng.max, item.name);
                if (!chk.ok) {
                    SHOW_MAP_RULE_HINT(chk.reason, true);
                    showMessage('📏 Цель вне досягаемости', chk.reason);
                    return;
                }
            }
            const res = _ORIG_USE_WEP(invIdx);
            const st = GET_MAP_STATE();
            const to = window.ENSURE_TURN_STATE(st);
            to.hasActed = true;
            SAVE_MAP_STATE(st);
            return res;
        };
    }

    const _ORIG_UNARMED = window.BG3_PLAYER_UNARMED;
    if (typeof _ORIG_UNARMED === 'function') {
        window.BG3_PLAYER_UNARMED = function() {
            const chk = CHECK_ATTACK_REACH(5, 'Рукопашная');
            if (!chk.ok) {
                SHOW_MAP_RULE_HINT(chk.reason, true);
                showMessage('📏 Цель вне досягаемости', chk.reason);
                return;
            }
            const res = _ORIG_UNARMED();
            const st = GET_MAP_STATE();
            const to = window.ENSURE_TURN_STATE(st);
            to.hasActed = true;
            SAVE_MAP_STATE(st);
            return res;
        };
    }

    const _ORIG_CAST_BG3 = window.BG3_PLAYER_CAST_SPELL;
    if (typeof _ORIG_CAST_BG3 === 'function') {
        window.BG3_PLAYER_CAST_SPELL = function(spellName) {
            const sp = gameData.spells.find(s => s.name === spellName);
            if (sp) {
                const rng = GET_SPELL_RANGE_FT(sp);
                const chk = CHECK_ATTACK_REACH(rng.max, sp.name, rng.selfOnly);
                if (!chk.ok) {
                    SHOW_MAP_RULE_HINT(chk.reason, true);
                    showMessage('📏 Цель вне дистанции заклинания', chk.reason);
                    return;
                }
            }
            const res = _ORIG_CAST_BG3(spellName);
            const st = GET_MAP_STATE();
            const to = window.ENSURE_TURN_STATE(st);
            to.hasActed = true;
            SAVE_MAP_STATE(st);
            return res;
        };
    }

    // --- 6. ВЫХОД ИЗ БОЯ (ИГРОК) И ЗАВЕРШЕНИЕ БОЯ В 1 КЛИК (МАСТЕР) ---
    window.PLAYER_LEAVE_COMBAT = function() {
        const cs = GC();
        const c = cs[PI];
        if (!c || !c.inCombat) return;

        const st = GET_MAP_STATE();
        const aliveEnemies = (st.tokens || []).filter(t => !t.isPlayer && (t.hp ?? 0) > 0);
        const promptMsg = aliveEnemies.length > 0
            ? `На карте ещё есть активные противники (${aliveEnemies.length}). Вы уверены, что ваш персонаж отступает и выходит из боя?`
            : `Все противники повержены! Выйти из режима боя?`;

        if (!confirm(promptMsg)) return;

        c.inCombat = false;
        SC(cs);

        // Если никто в комнате больше не в бою — выключаем ленту инициативы
        const rc = (typeof GET_ACTIVE_ROOM_CODE === 'function') ? GET_ACTIVE_ROOM_CODE() : null;
        const partyIdx = (typeof GET_ROOM_PARTY_INDICES === 'function') ? GET_ROOM_PARTY_INDICES(rc) : cs.map((_, i) => i);
        const anyoneFighting = partyIdx.some(i => {
            const ch = (typeof GET_CHAR_FOR_ROOM === 'function') ? GET_CHAR_FOR_ROOM(cs[i], rc) : cs[i];
            return ch && ch.inCombat;
        });

        if (!anyoneFighting && st.turnOrder) {
            st.turnOrder.active = false;
            SAVE_MAP_STATE(st);
        } else if (st.turnOrder && st.turnOrder.active && st.tokens && st.tokens.length) {
            const cur = st.tokens[(st.turnOrder.currentIdx || 0) % st.tokens.length];
            if (cur && cur.isPlayer && cur.charIdx === PI) {
                GM_NEXT_TURN();
            }
        }

        LOG_COMBAT_TO_CHAT(aliveEnemies.length > 0
            ? `🏃 отступает и выходит из боя!`
            : `🕊️ выходит из режима боя.`);
        RMC();
        RPL();
        RENDER_MAP_AREA();
    };

    window.GM_END_ALL_COMBAT_IN_ROOM = function() {
        const sess = GET_SESSION();
        if (!sess || sess.role !== 'gm') return;
        const rc = (typeof GET_ACTIVE_ROOM_CODE === 'function') ? GET_ACTIVE_ROOM_CODE() : null;
        const cs = GC();
        const partyIdx = (typeof GET_ROOM_PARTY_INDICES === 'function') ? GET_ROOM_PARTY_INDICES(rc) : cs.map((_, i) => i);
        partyIdx.forEach(i => {
            if (!cs[i]) return;
            if (typeof MUTATE_HERO_IN_ROOM === 'function') MUTATE_HERO_IN_ROOM(cs[i], rc, ch => { ch.inCombat = false; });
            else cs[i].inCombat = false;
        });
        SC(cs);

        const st = GET_MAP_STATE();
        if (st.turnOrder) st.turnOrder.active = false;
        SAVE_MAP_STATE(st);

        LOG_COMBAT_TO_CHAT('🕊️ Гейм-Мастер завершил бой. Все участники возвращаются в мирный режим.');
        RENDER_GM_LEFT_COLUMN();
        RPL();
        RENDER_MAP_AREA();
    };

    // Показываем дистанцию в окне Внезапной атаки
    const _ORIG_OPEN_AMBUSH_CR = window.OPEN_AMBUSH_MODAL;
    if (typeof _ORIG_OPEN_AMBUSH_CR === 'function') {
        window.OPEN_AMBUSH_MODAL = function() {
            _ORIG_OPEN_AMBUSH_CR();
            const st = GET_MAP_STATE();
            const tokens = st.tokens || [];
            const myTok = tokens.find(t => t.isPlayer && t.charIdx === PI);
            if (!myTok) return;

            const cont = document.getElementById('gm-tool-modal-content');
            if (!cont) return;
            cont.querySelectorAll('button[onclick^="START_PLAYER_AMBUSH_TOKEN("]').forEach(btn => {
                const m = (btn.getAttribute('onclick') || '').match(/\((\d+)\)/);
                if (!m) return;
                const tIdx = parseInt(m[1], 10);
                const tok = tokens[tIdx];
                if (!tok) return;
                const dFt = window.CALC_MAP_DISTANCE_FT(st, myTok.x, myTok.y, tok.x, tok.y);
                const los = HAS_LINE_OF_SIGHT(st, myTok.x, myTok.y, tok.x, tok.y);
                const firstSpan = btn.querySelector('span');
                if (firstSpan) {
                    const tag = document.createElement('small');
                    tag.style.cssText = `margin-left:8px; color:${!los ? '#d66565' : (dFt <= 7 ? '#6cb878' : '#d99a4e')};`;
                    tag.textContent = !los ? `🧱 за стеной (${dFt} фт)` : `📏 ${dFt} фт`;
                    firstSpan.appendChild(tag);
                }
            });
        };
    }

    // Инициализируем движение при старте внезапной атаки
    ['START_PLAYER_AMBUSH_TOKEN', 'START_PLAYER_AMBUSH'].forEach(fnName => {
        const orig = window[fnName];
        if (typeof orig !== 'function') return;
        window[fnName] = function(...args) {
            const r = orig.apply(this, args);
            const st = GET_MAP_STATE();
            const cs = GC();
            const spd = parseInt(cs[PI]?.speed, 10) || 30;
            const to = window.ENSURE_TURN_STATE(st);
            const myTok = (st.tokens || []).find(t => t.isPlayer && t.charIdx === PI);
            to.moveMax = spd;
            to.moveLeft = spd;
            to.hasActed = false;
            to.turnStartPos = myTok ? { x: myTok.x, y: myTok.y } : null;
            SAVE_MAP_STATE(st);
            RENDER_MAP_AREA();
            return r;
        };
    });

    // --- 7. ПЕРЕХВАТ ПЕРЕТАСКИВАНИЯ ФИШЕК (СТЕНЫ + ЛИМИТ ДВИЖЕНИЯ В БОЮ) ---
    const _ORIG_START_DRAG_CR = window.START_DRAG_MAP_OBJ;
    if (typeof _ORIG_START_DRAG_CR === 'function') {
        window.START_DRAG_MAP_OBJ = function(type, index, domId) {
            const sess = GET_SESSION();
            const st = GET_MAP_STATE();
            const cs = GC();
            const isPlayer = sess && sess.role === 'player';

            if (isPlayer && type === 'token') {
                const tok = st.tokens && st.tokens[index];
                const c = cs[PI];
                if (c && c.inCombat && st.turnOrder && st.turnOrder.active && st.tokens && st.tokens.length) {
                    const to = window.ENSURE_TURN_STATE(st);
                    const curTok = st.tokens[(to.currentIdx || 0) % st.tokens.length];
                    if (!curTok || !curTok.isPlayer || curTok.charIdx !== PI) {
                        SHOW_MAP_RULE_HINT('⏳ В бою двигать фишку можно только в свой ход!', true);
                        return;
                    }
                    if ((to.moveLeft ?? 0) <= 0) {
                        SHOW_MAP_RULE_HINT('👣 Запас движения на этот ход исчерпан (используйте Рывок)!', true);
                        return;
                    }
                }
                if (tok) {
                    dragStartInfo = { x: tok.x, y: tok.y, index };
                }
            } else {
                dragStartInfo = null;
            }
            return _ORIG_START_DRAG_CR(type, index, domId);
        };
    }

    function WRAP_MAP_DRAG_AND_WALL_EVENTS() {
        const mapArea = document.getElementById('map-area');
        if (!mapArea) return;
        const sess = GET_SESSION();
        const isGM = sess && sess.role === 'gm';
        const isPlayer = sess && sess.role === 'player';

        // 1. Кисть стен для ГМ
        const origDown = mapArea.onmousedown;
        mapArea.onmousedown = function(e) {
            if (isGM && window._gmWallBrushMode) {
                if (e.target.closest('[data-tactics-ui], #bg3-initiative-ribbon, button, select')) return;
                e.preventDefault();
                isPaintingWalls = true;
                const act = (e.button === 2) ? 'erase' : window._gmWallBrushAction;
                PAINT_WALL_AT_EVENT(e, act);
                return;
            }
            if (origDown) return origDown.call(this, e);
        };

        // 2. Перетаскивание фишки с учётом стен и запаса движения
        const origMove = mapArea.onmousemove;
        mapArea.onmousemove = function(e) {
            if (isGM && window._gmWallBrushMode && isPaintingWalls) {
                PAINT_WALL_AT_EVENT(e);
                return;
            }

            if (isPlayer && window._draggingMapObj && window._draggingMapObj.type === 'token' && dragStartInfo) {
                const vp = document.getElementById('map-viewport') || mapArea;
                const rect = vp.getBoundingClientRect();
                let xPct = Math.max(2, Math.min(98, Math.round(((e.clientX - rect.left) / Math.max(1, rect.width)) * 1000) / 10));
                let yPct = Math.max(2, Math.min(98, Math.round(((e.clientY - rect.top) / Math.max(1, rect.height)) * 1000) / 10));

                const st = GET_MAP_STATE();
                const cs = GC();
                const inCombat = !!(cs[PI] && cs[PI].inCombat && st.turnOrder && st.turnOrder.active);
                let moveLeft = 9999;
                if (inCombat) {
                    const to = window.ENSURE_TURN_STATE(st);
                    moveLeft = Math.max(0, to.moveLeft ?? 0);
                    const cl = CLAMP_TO_MOVEMENT_FT(st, dragStartInfo.x, dragStartInfo.y, xPct, yPct, moveLeft);
                    xPct = cl.x;
                    yPct = cl.y;
                }

                const traced = TRACE_PATH_AGAINST_WALLS(st, dragStartInfo.x, dragStartInfo.y, xPct, yPct);
                xPct = Math.round(traced.x * 10) / 10;
                yPct = Math.round(traced.y * 10) / 10;

                const el = document.getElementById(window._draggingMapObj.domId);
                if (el) {
                    el.style.left = xPct + '%';
                    el.style.top = yPct + '%';
                }
                window._draggingMapObj.lastX = xPct;
                window._draggingMapObj.lastY = yPct;
                window._draggingMapObj.moved = true;

                const stepFt = window.CALC_MAP_DISTANCE_FT(st, dragStartInfo.x, dragStartInfo.y, xPct, yPct);
                if (traced.blocked) {
                    SHOW_MAP_RULE_HINT('🧱 Непроходимая стена!', true);
                } else if (inCombat) {
                    const rem = Math.max(0, moveLeft - stepFt);
                    SHOW_MAP_RULE_HINT(`👣 Шаг: −${stepFt} фт | Останется: ${rem} фт`);
                }
                return;
            }

            if (origMove) return origMove.call(this, e);
        };

        const origUp = mapArea.onmouseup;
        mapArea.onmouseup = function(e) {
            if (isPaintingWalls) {
                isPaintingWalls = false;
                return;
            }

            const wasPlayerTokDrag = isPlayer && window._draggingMapObj && window._draggingMapObj.type === 'token' && window._draggingMapObj.moved && dragStartInfo;
            const snapDrag = wasPlayerTokDrag ? Object.assign({}, window._draggingMapObj) : null;
            const snapStart = dragStartInfo ? Object.assign({}, dragStartInfo) : null;
            dragStartInfo = null;

            if (origUp) origUp.call(this, e);

            if (wasPlayerTokDrag && snapDrag && snapStart) {
                const st = GET_MAP_STATE();
                const cs = GC();
                if (cs[PI] && cs[PI].inCombat && st.turnOrder && st.turnOrder.active) {
                    const to = window.ENSURE_TURN_STATE(st);
                    const movedFt = window.CALC_MAP_DISTANCE_FT(st, snapStart.x, snapStart.y, snapDrag.lastX, snapDrag.lastY);
                    to.moveLeft = Math.max(0, (to.moveLeft ?? 0) - movedFt);
                    SAVE_MAP_STATE(st);
                    RENDER_MAP_AREA();
                }
            }
        };
    }

    window.addEventListener('mouseup', () => { isPaintingWalls = false; });

    // --- 8. ХУКИ В RENDER_MAP_AREA И БОЕВОЙ HUD ---
    const _ORIG_RENDER_MAP_CR = window.RENDER_MAP_AREA;
    window.RENDER_MAP_AREA = function() {
        _ORIG_RENDER_MAP_CR();
        WRAP_MAP_DRAG_AND_WALL_EVENTS();
        DRAW_WALL_OVERLAY_AND_MOVE_RING();

        const sess = GET_SESSION();
        const isGM = sess && sess.role === 'gm';

        // Кнопка «🧱 Стены» и пресеты масштаба в нижней панели тактики для Мастера
        const tacBar = document.getElementById('tactics-map-toolbar');
        if (tacBar && isGM) {
            const firstRow = tacBar.firstElementChild;
            if (firstRow && !firstRow.querySelector('[data-cr-wall-btn]')) {
                const b = document.createElement('button');
                b.className = 'btn-small';
                b.setAttribute('data-cr-wall-btn', '1');
                b.title = 'Рисовать непроходимые стены поверх карты и настраивать масштаб';
                b.style.cssText = `padding:4px 8px; font-size:0.76rem; background:${window._gmWallBrushMode ? '#7e3d3d' : 'rgba(24,23,21,0.92)'}; color:${window._gmWallBrushMode ? '#fff' : '#e6c88c'}; border:1px solid ${window._gmWallBrushMode ? '#f87171' : '#524a3d'}; box-shadow:none;`;
                b.textContent = window._gmWallBrushMode ? '🧱 Стены (Вкл)' : '🧱 Стены';
                b.onclick = (e) => { e.stopPropagation(); window.TOGGLE_GM_WALL_BRUSH(); };
                firstRow.appendChild(b);
            }

            tacBar.querySelectorAll('[data-cr-wall-sub]').forEach(n => n.remove());
            if (window._gmWallBrushMode) {
                const st = GET_MAP_STATE();
                const { cols, rows } = GET_MAP_GRID_DIMS(st);
                const sub = document.createElement('div');
                sub.setAttribute('data-cr-wall-sub', '1');
                sub.style.cssText = 'display:flex; gap:4px; flex-wrap:wrap; align-items:center; border-top:1px dashed #3d3830; padding-top:4px; margin-top:4px; font-size:0.74rem;';
                const a = window._gmWallBrushAction;
                sub.innerHTML = `
                    <button class="btn-small" style="padding:3px 7px; font-size:0.74rem; background:${a==='block'?'#7e3d3d':'#1a1816'}; color:#fff;" onclick="event.stopPropagation(); window._gmWallBrushAction='block'; RENDER_MAP_AREA();">🧱 Поставить</button>
                    <button class="btn-small" style="padding:3px 7px; font-size:0.74rem; background:${a==='erase'?'#3f6e49':'#1a1816'}; color:#fff;" onclick="event.stopPropagation(); window._gmWallBrushAction='erase'; RENDER_MAP_AREA();">🧹 Стереть</button>
                    <button class="btn-small" style="padding:3px 7px; font-size:0.74rem;" onclick="event.stopPropagation(); SET_MAP_SCALE_PRESET(16,11)">16×11</button>
                    <button class="btn-small" style="padding:3px 7px; font-size:0.74rem;" onclick="event.stopPropagation(); SET_MAP_SCALE_PRESET(24,15)">24×15</button>
                    <button class="btn-small" style="padding:3px 7px; font-size:0.74rem;" onclick="event.stopPropagation(); SET_MAP_SCALE_PRESET(32,20)">32×20</button>
                    <span style="color:#aaa;">(${cols}×${rows})</span>
                    <button class="btn-small btn-danger" style="padding:3px 7px; font-size:0.74rem;" onclick="event.stopPropagation(); CLEAR_MAP_WALLS();">🗑️</button>
                `;
                tacBar.appendChild(sub);
            }
        }

        // Быстрая кнопка «🕊️ Завершить бой» для Мастера на ленте инициативы
        const ribbon = document.getElementById('bg3-initiative-ribbon');
        if (ribbon && isGM && !ribbon.querySelector('[data-cr-gm-end]')) {
            const endBtn = document.createElement('button');
            endBtn.className = 'btn-small btn-danger';
            endBtn.setAttribute('data-cr-gm-end', '1');
            endBtn.style.cssText = 'padding:4px 9px; font-size:0.76rem; flex-shrink:0; margin-left:4px;';
            endBtn.textContent = '🕊️ Завершить бой';
            endBtn.title = 'Завершить бой для всех участников комнаты (включая бой между игроками)';
            endBtn.onclick = (e) => { e.stopPropagation(); window.GM_END_ALL_COMBAT_IN_ROOM(); };
            ribbon.appendChild(endBtn);
        }
    };

    const _ORIG_HUD_CR = window.RENDER_BG3_COMBAT_HUD;
    if (typeof _ORIG_HUD_CR === 'function') {
        window.RENDER_BG3_COMBAT_HUD = function() {
            _ORIG_HUD_CR();
            const sess = GET_SESSION();
            if (!sess || sess.role !== 'player') return;
            const hud = document.getElementById('bg3-player-combat-hud');
            if (!hud) return;

            const cs = GC();
            const c = cs[PI];
            if (!c || !c.inCombat || (c.hp ?? 10) <= 0) return;

            const st = GET_MAP_STATE();
            const to = window.ENSURE_TURN_STATE(st);
            const tokens = st.tokens || [];
            const myTok = tokens.find(t => t.isPlayer && t.charIdx === PI);
            const activeTok = tokens.length ? tokens[(to.currentIdx || 0) % tokens.length] : null;
            const isMyTurn = !tokens.length || (activeTok && activeTok.isPlayer && activeTok.charIdx === PI);

            // 1. Защита чужого хода + кнопка «↩️ Отменить шаг» + «🏃 Выйти из боя»
            const nextBtn = hud.querySelector('button[onclick="GM_NEXT_TURN()"]');
            if (nextBtn) {
                if (!isMyTurn) {
                    nextBtn.disabled = true;
                    nextBtn.style.opacity = '0.4';
                    nextBtn.title = 'Вы не можете завершать ход за другого игрока';
                }
                const btnWrap = nextBtn.parentElement;
                if (btnWrap) {
                    if (isMyTurn && to.turnStartPos && !to.hasActed && (to.moveLeft < to.moveMax) && !btnWrap.querySelector('[data-cr-undo-step]')) {
                        const uBtn = document.createElement('button');
                        uBtn.className = 'btn-small';
                        uBtn.setAttribute('data-cr-undo-step', '1');
                        uBtn.textContent = '↩️ Отменить шаг';
                        uBtn.onclick = () => window.UNDO_COMBAT_MOVEMENT();
                        btnWrap.insertBefore(uBtn, nextBtn);
                    }
                    if (!btnWrap.querySelector('[data-cr-leave-combat]')) {
                        const lBtn = document.createElement('button');
                        lBtn.className = 'btn-small btn-danger';
                        lBtn.setAttribute('data-cr-leave-combat', '1');
                        lBtn.textContent = '🏃 Выйти из боя';
                        lBtn.onclick = () => window.PLAYER_LEAVE_COMBAT();
                        btnWrap.appendChild(lBtn);
                    }
                }
            }

            // 2. Показываем счётчик движения «👣 30 / 30 фт» в строке статуса хода
            if (isMyTurn) {
                const statusRow = hud.querySelector('span[style*="#4cd964"]')?.parentElement;
                if (statusRow && !statusRow.querySelector('[data-cr-move-pill]')) {
                    const mv = document.createElement('span');
                    mv.setAttribute('data-cr-move-pill', '1');
                    mv.style.cssText = 'margin-left:8px; padding:2px 8px; border-radius:6px; background:var(--ui-panel2, #1a1a1a); border:1px solid var(--ui-border, #444); color:var(--ui-accent, #e6c88c); font-size:0.82rem; font-weight:bold;';
                    mv.textContent = `👣 Движение: ${to.moveLeft ?? 0} / ${to.moveMax ?? 30} фт`;
                    statusRow.appendChild(mv);
                }
            }

            // 3. Добавляем расстояние в футах на каждую кнопку цели
            if (myTok) {
                hud.querySelectorAll('button[onclick*="window._bg3SelectedTargetIdx="]').forEach(btn => {
                    const m = (btn.getAttribute('onclick') || '').match(/_bg3SelectedTargetIdx=(\d+)/);
                    if (!m) return;
                    const tIdx = parseInt(m[1], 10);
                    const tok = tokens[tIdx];
                    if (!tok) return;
                    const distFt = window.CALC_MAP_DISTANCE_FT(st, myTok.x, myTok.y, tok.x, tok.y);
                    const los = HAS_LINE_OF_SIGHT(st, myTok.x, myTok.y, tok.x, tok.y);
                    const tag = document.createElement('small');
                    tag.style.cssText = `margin-left:4px; color:${!los ? '#f87171' : (distFt <= 7 ? '#86efac' : '#fde68a')};`;
                    tag.textContent = !los ? `🧱 ${distFt} фт` : `📏 ${distFt} фт`;
                    btn.appendChild(tag);
                });

                // 4. Помечаем на кнопках оружия/заклинаний, если выбранная цель вне дальности
                const targetTok = tokens[window._bg3SelectedTargetIdx];
                if (targetTok && targetTok !== myTok) {
                    const distFt = window.CALC_MAP_DISTANCE_FT(st, myTok.x, myTok.y, targetTok.x, targetTok.y);
                    const los = HAS_LINE_OF_SIGHT(st, myTok.x, myTok.y, targetTok.x, targetTok.y);

                    hud.querySelectorAll('button[onclick^="BG3_PLAYER_USE_WEAPON("]').forEach(btn => {
                        const m = (btn.getAttribute('onclick') || '').match(/\((\d+)\)/);
                        const item = m && c.inventory && c.inventory[parseInt(m[1], 10)];
                        if (!item) return;
                        const rng = GET_WEAPON_RANGE_FT(item);
                        const sm = btn.querySelector('small');
                        if (sm) {
                            if (!los) sm.innerHTML += ` • <span style="color:#f87171;">🧱 за стеной</span>`;
                            else if (distFt > rng.max + 2.5) sm.innerHTML += ` • <span style="color:#f87171;">вне дальности (${rng.label})</span>`;
                            else sm.innerHTML += ` • ${rng.label}`;
                        }
                    });

                    hud.querySelectorAll('button[onclick="BG3_PLAYER_UNARMED()"]').forEach(btn => {
                        const sm = btn.querySelector('small');
                        if (sm && (!los || distFt > 7.5)) {
                            sm.innerHTML += ` • <span style="color:#f87171;">${!los ? '🧱 за стеной' : 'далеко (>5 фт)'}</span>`;
                        }
                    });

                    hud.querySelectorAll('button[onclick^="BG3_PLAYER_CAST_SPELL("]').forEach(btn => {
                        const m = (btn.getAttribute('onclick') || '').match(/\('([^']+)'\)/);
                        const sp = m && gameData.spells.find(s => s.name === m[1]);
                        if (!sp) return;
                        const rng = GET_SPELL_RANGE_FT(sp);
                        const sm = btn.querySelector('small');
                        if (sm && !rng.selfOnly) {
                            if (!los) sm.innerHTML += ` • <span style="color:#f87171;">🧱 за стеной</span>`;
                            else if (distFt > rng.max + 2.5) sm.innerHTML += ` • <span style="color:#f87171;">>${rng.label}</span>`;
                        }
                    });
                }
            }
        };
    }

    if (typeof RENDER_MAP_AREA === 'function') RENDER_MAP_AREA();
})();