// ================================================================
// 🧱 НЕПРОХОДИМОСТЬ СТЕН, УМНЫЙ ОБХОД ПРОЁМОВ (ПОИСК ПУТИ),
// ЛИМИТ ДВИЖЕНИЯ В БОЮ (ФТ), ДАЛЬНОСТЬ АТАК И ВЫХОД ИЗ БОЯ (combat_rules.js)
// ================================================================
(function INIT_COMBAT_PHYSICS_AND_WALLS() {
    window._gmWallBrushMode = false;
    window._gmWallBrushAction = 'block'; // 'block' | 'erase'
    window._gmWallOverlayVisible = false;
    window._crDragPath = null;           // { pts: [{x, y}], totalFt } — пунктирный маршрут при перетаскивании

    let isPaintingWalls = false;
    let dragStartInfo = null;
    let wallWarningTimer = null;

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

    function CLAMP_INSIDE_CELL(st, c, r, xPct, yPct) {
        const { cols, rows } = GET_MAP_GRID_DIMS(st);
        const cellW = 100 / cols;
        const cellH = 100 / rows;
        const padX = cellW * 0.16;
        const padY = cellH * 0.16;
        const x = Math.max(c * cellW + padX, Math.min((c + 1) * cellW - padX, xPct));
        const y = Math.max(r * cellH + padY, Math.min((r + 1) * cellH - padY, yPct));
        return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    }

    function CALC_EXACT_DIST_FT(st, x1Pct, y1Pct, x2Pct, y2Pct) {
        const { cols, rows } = GET_MAP_GRID_DIMS(st);
        const dx = ((x2Pct - x1Pct) / 100) * cols;
        const dy = ((y2Pct - y1Pct) / 100) * rows;
        return Math.hypot(dx, dy) * 5;
    }

    // Расстояние между двумя точками карты (в футах, 1 клетка = 5 фт)
    window.CALC_MAP_DISTANCE_FT = function(st, x1Pct, y1Pct, x2Pct, y2Pct) {
        return Math.round(CALC_EXACT_DIST_FT(st, x1Pct, y1Pct, x2Pct, y2Pct));
    };

    // Проверка, свободен ли отрезок пути от стен (без срезания углов)
    function IS_MOVE_SEGMENT_CLEAR(st, x0, y0, x1, y1) {
        if (!st || !st.collisionMask || !st.collisionMask.includes('1')) return true;
        const { cols, rows } = GET_MAP_GRID_DIMS(st);
        const startCell = PCT_TO_CELL(st, x0, y0);
        const startBlocked = IS_CELL_BLOCKED(st, startCell.c, startCell.r);
        const distCells = Math.hypot(((x1 - x0) / 100) * cols, ((y1 - y0) / 100) * rows);
        const steps = Math.max(10, Math.ceil(distCells * 8));
        let prev = startCell;

        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const cur = PCT_TO_CELL(st, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
            const curBlocked = IS_CELL_BLOCKED(st, cur.c, cur.r);
            if (curBlocked && !(startBlocked && cur.c === startCell.c && cur.r === startCell.r)) {
                return false;
            }
            if (cur.c !== prev.c && cur.r !== prev.r) {
                if (IS_CELL_BLOCKED(st, cur.c, prev.r) || IS_CELL_BLOCKED(st, prev.c, cur.r)) {
                    return false;
                }
            }
            prev = cur;
        }
        return true;
    }

    // Поиск кратчайших путей от стартовой клетки (Дейкстра по 8 направлениям без срезания углов)
    function BUILD_NAV_FIELD(st, startC, startR) {
        const { cols, rows } = GET_MAP_GRID_DIMS(st);
        const total = cols * rows;
        const dist = new Float32Array(total);
        const parent = new Int32Array(total);
        dist.fill(Infinity);
        parent.fill(-1);

        const sIdx = startR * cols + startC;
        dist[sIdx] = 0;

        // Бинарная куча [idx, cost]
        const heap = [[sIdx, 0]];
        const push = (item) => {
            heap.push(item);
            let i = heap.length - 1;
            while (i > 0) {
                const p = (i - 1) >> 1;
                if (heap[p][1] <= heap[i][1]) break;
                const tmp = heap[p]; heap[p] = heap[i]; heap[i] = tmp;
                i = p;
            }
        };
        const pop = () => {
            const top = heap[0];
            const last = heap.pop();
            if (heap.length > 0) {
                heap[0] = last;
                let i = 0;
                const len = heap.length;
                while (true) {
                    let l = (i << 1) + 1, r = l + 1, best = i;
                    if (l < len && heap[l][1] < heap[best][1]) best = l;
                    if (r < len && heap[r][1] < heap[best][1]) best = r;
                    if (best === i) break;
                    const tmp = heap[i]; heap[i] = heap[best]; heap[best] = tmp;
                    i = best;
                }
            }
            return top;
        };

        const DIRS = [
            [1, 0, 5], [-1, 0, 5], [0, 1, 5], [0, -1, 5],
            [1, 1, 7.071], [1, -1, 7.071], [-1, 1, 7.071], [-1, -1, 7.071]
        ];

        while (heap.length > 0) {
            const [u, d] = pop();
            if (d > dist[u]) continue;
            const uc = u % cols;
            const ur = (u - uc) / cols;

            for (let k = 0; k < DIRS.length; k++) {
                const dc = DIRS[k][0], dr = DIRS[k][1], cost = DIRS[k][2];
                const nc = uc + dc, nr = ur + dr;
                if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
                if (IS_CELL_BLOCKED(st, nc, nr)) continue;

                // По диагонали проходим, только если оба соседних угла свободны (не режем косяки дверей)
                if (dc !== 0 && dr !== 0) {
                    if (IS_CELL_BLOCKED(st, uc + dc, ur) || IS_CELL_BLOCKED(st, uc, ur + dr)) continue;
                }

                const v = nr * cols + nc;
                const nd = d + cost;
                if (nd < dist[v]) {
                    dist[v] = nd;
                    parent[v] = u;
                    push([v, nd]);
                }
            }
        }

        return { cols, rows, startC, startR, dist, parent };
    }

    // Сглаживание маршрута (убирает лишние зигзаги, оставляя чистые повороты в проёмах)
    function SMOOTH_PATH(st, rawPts) {
        if (rawPts.length <= 2) return rawPts;
        const out = [rawPts[0]];
        let i = 0;
        while (i < rawPts.length - 1) {
            let best = i + 1;
            for (let j = rawPts.length - 1; j > i + 1; j--) {
                if (IS_MOVE_SEGMENT_CLEAR(st, rawPts[i].x, rawPts[i].y, rawPts[j].x, rawPts[j].y)) {
                    best = j;
                    break;
                }
            }
            out.push(rawPts[best]);
            i = best;
        }
        return out;
    }

    // Обрезка маршрута по остатку движения в бою (в футах)
    function CLIP_PATH_BY_FT(st, pts, maxFt) {
        if (!pts.length) return { pts: [], totalFt: 0, clamped: false };
        const res = [pts[0]];
        let acc = 0;

        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i];
            const segFt = CALC_EXACT_DIST_FT(st, a.x, a.y, b.x, b.y);
            if (acc + segFt <= maxFt + 0.01) {
                res.push(b);
                acc += segFt;
            } else {
                const rem = Math.max(0, maxFt - acc);
                if (segFt > 0.01 && rem > 0.1) {
                    const ratio = rem / segFt;
                    const cx = Math.round((a.x + (b.x - a.x) * ratio) * 10) / 10;
                    const cy = Math.round((a.y + (b.y - a.y) * ratio) * 10) / 10;
                    const cell = PCT_TO_CELL(st, cx, cy);
                    if (!IS_CELL_BLOCKED(st, cell.c, cell.r)) {
                        res.push({ x: cx, y: cy });
                        acc = maxFt;
                    }
                }
                return { pts: res, totalFt: Math.round(acc), clamped: true };
            }
        }
        return { pts: res, totalFt: Math.round(acc), clamped: false };
    }

    // Главный расчёт позиции фишки при перетаскивании (с обходом проёмов и скольжением по стене)
    function RESOLVE_TOKEN_DRAG(st, startInfo, rawX, rawY, maxFt) {
        const hasWalls = !!(st && st.collisionMask && st.collisionMask.includes('1'));
        if (!hasWalls) {
            const clipped = CLIP_PATH_BY_FT(st, [{ x: startInfo.x, y: startInfo.y }, { x: rawX, y: rawY }], maxFt);
            const end = clipped.pts[clipped.pts.length - 1];
            return { x: end.x, y: end.y, pts: clipped.pts, totalFt: clipped.totalFt, clamped: clipped.clamped, hitWall: false };
        }

        const nav = startInfo.nav;
        const { cols, rows } = nav;
        const curCell = PCT_TO_CELL(st, rawX, rawY);
        const curIdx = curCell.r * cols + curCell.c;

        let goalC = curCell.c, goalR = curCell.r;
        let endPt = { x: rawX, y: rawY };
        let hitWall = false;

        // Если курсор попал на стену или недостижимую клетку — мягко притягиваем к ближайшей доступной клетке пола
        if (IS_CELL_BLOCKED(st, curCell.c, curCell.r) || !isFinite(nav.dist[curIdx])) {
            hitWall = true;
            let best = null;
            for (let rad = 1; rad <= 3 && !best; rad++) {
                for (let dr = -rad; dr <= rad; dr++) {
                    for (let dc = -rad; dc <= rad; dc++) {
                        const nc = curCell.c + dc, nr = curCell.r + dr;
                        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
                        const nIdx = nr * cols + nc;
                        if (IS_CELL_BLOCKED(st, nc, nr) || !isFinite(nav.dist[nIdx])) continue;

                        const clampedPt = CLAMP_INSIDE_CELL(st, nc, nr, rawX, rawY);
                        const dCursor = CALC_EXACT_DIST_FT(st, clampedPt.x, clampedPt.y, rawX, rawY);
                        // Предпочитаем клетки в пределах хода, ближайшие к курсору
                        const overPenalty = (nav.dist[nIdx] > maxFt + 3) ? 12 : 0;
                        const score = dCursor + overPenalty;
                        if (!best || score < best.score) {
                            best = { c: nc, r: nr, pt: clampedPt, score };
                        }
                    }
                }
            }

            if (best) {
                goalC = best.c;
                goalR = best.r;
                endPt = best.pt;
            } else {
                // Глухая стена без проходов рядом — оставляем в последней валидной точке
                const fx = startInfo.lastValidX !== undefined ? startInfo.lastValidX : startInfo.x;
                const fy = startInfo.lastValidY !== undefined ? startInfo.lastValidY : startInfo.y;
                return {
                    x: fx, y: fy,
                    pts: startInfo.lastValidPts || [{ x: startInfo.x, y: startInfo.y }, { x: fx, y: fy }],
                    totalFt: startInfo.lastValidFt || 0,
                    clamped: false,
                    hitWall: true
                };
            }
        } else {
            // Аккуратно держим точку внутри свободной клетки, чтобы округление не закинуло фишку в соседнюю стену
            endPt = CLAMP_INSIDE_CELL(st, goalC, goalR, rawX, rawY);
        }

        // Если прямая линия до целевой точки свободна — идём напрямую
        let pathPts;
        if (IS_MOVE_SEGMENT_CLEAR(st, startInfo.x, startInfo.y, endPt.x, endPt.y)) {
            pathPts = [{ x: startInfo.x, y: startInfo.y }, endPt];
        } else {
            // Иначе восстанавливаем маршрут по клеткам через проём и сглаживаем
            const chain = [];
            let cur = goalR * cols + goalC;
            const sIdx = nav.startR * cols + nav.startC;
            let guard = 0;
            while (cur !== -1 && cur !== sIdx && guard++ < cols * rows) {
                const c = cur % cols;
                const r = (cur - c) / cols;
                chain.push({ x: ((c + 0.5) / cols) * 100, y: ((r + 0.5) / rows) * 100 });
                cur = nav.parent[cur];
            }
            chain.reverse();
            const rawPts = [{ x: startInfo.x, y: startInfo.y }].concat(chain);
            rawPts[rawPts.length - 1] = endPt;
            pathPts = SMOOTH_PATH(st, rawPts);
        }

        const clipped = CLIP_PATH_BY_FT(st, pathPts, maxFt);
        const finalPt = clipped.pts[clipped.pts.length - 1] || { x: startInfo.x, y: startInfo.y };
        return {
            x: Math.round(finalPt.x * 10) / 10,
            y: Math.round(finalPt.y * 10) / 10,
            pts: clipped.pts,
            totalFt: clipped.totalFt,
            clamped: clipped.clamped,
            hitWall
        };
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

        // В) Пунктирный маршрут движения через проёмы во время перетаскивания фишки
        if (window._crDragPath && window._crDragPath.pts && window._crDragPath.pts.length >= 2) {
            const ptsStr = window._crDragPath.pts
                .map(p => `${(p.x / 100) * w},${(p.y / 100) * h}`)
                .join(' ');
            const p0 = window._crDragPath.pts[0];
            parts.push(`<polyline points="${ptsStr}" fill="none" stroke="#86efac" stroke-width="2.6" stroke-dasharray="6 4" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>`);
            parts.push(`<circle cx="${(p0.x / 100) * w}" cy="${(p0.y / 100) * h}" r="4" fill="#86efac" opacity="0.85"/>`);
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

    // --- 7. ПЕРЕХВАТ ПЕРЕТАСКИВАНИЯ ФИШЕК (УМНЫЙ ОБХОД ПРОЁМОВ + ЛИМИТ ДВИЖЕНИЯ) ---
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
                    const sCell = PCT_TO_CELL(st, tok.x, tok.y);
                    const nav = (st.collisionMask && st.collisionMask.includes('1'))
                        ? BUILD_NAV_FIELD(st, sCell.c, sCell.r)
                        : null;
                    dragStartInfo = {
                        x: tok.x,
                        y: tok.y,
                        index,
                        nav,
                        lastValidX: tok.x,
                        lastValidY: tok.y,
                        lastValidPts: [{ x: tok.x, y: tok.y }],
                        lastValidFt: 0
                    };
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

        const origMove = mapArea.onmousemove;
        mapArea.onmousemove = function(e) {
            if (isGM && window._gmWallBrushMode && isPaintingWalls) {
                PAINT_WALL_AT_EVENT(e);
                return;
            }

            if (isPlayer && window._draggingMapObj && window._draggingMapObj.type === 'token' && dragStartInfo) {
                const vp = document.getElementById('map-viewport') || mapArea;
                const rect = vp.getBoundingClientRect();
                const rawX = Math.max(2, Math.min(98, ((e.clientX - rect.left) / Math.max(1, rect.width)) * 100));
                const rawY = Math.max(2, Math.min(98, ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100));

                const st = GET_MAP_STATE();
                const cs = GC();
                const inCombat = !!(cs[PI] && cs[PI].inCombat && st.turnOrder && st.turnOrder.active);
                const to = inCombat ? window.ENSURE_TURN_STATE(st) : null;
                const moveLeft = inCombat ? Math.max(0, to.moveLeft ?? 0) : 9999;

                const resolved = RESOLVE_TOKEN_DRAG(st, dragStartInfo, rawX, rawY, moveLeft);

                dragStartInfo.lastValidX = resolved.x;
                dragStartInfo.lastValidY = resolved.y;
                dragStartInfo.lastValidPts = resolved.pts;
                dragStartInfo.lastValidFt = resolved.totalFt;

                const el = document.getElementById(window._draggingMapObj.domId);
                if (el) {
                    el.style.left = resolved.x + '%';
                    el.style.top = resolved.y + '%';
                }
                window._draggingMapObj.lastX = resolved.x;
                window._draggingMapObj.lastY = resolved.y;
                window._draggingMapObj.walkedFt = resolved.totalFt;
                window._draggingMapObj.moved = true;

                window._crDragPath = { pts: resolved.pts, totalFt: resolved.totalFt };
                DRAW_WALL_OVERLAY_AND_MOVE_RING();

                if (inCombat) {
                    const rem = Math.max(0, moveLeft - resolved.totalFt);
                    SHOW_MAP_RULE_HINT(`👣 Путь: ${resolved.totalFt} фт | Останется: ${rem} фт${resolved.clamped ? ' (предел хода)' : ''}`);
                } else if (resolved.hitWall && resolved.totalFt === 0) {
                    SHOW_MAP_RULE_HINT('🧱 Непроходимая стена', true);
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
            window._crDragPath = null;

            if (origUp) origUp.call(this, e);
            DRAW_WALL_OVERLAY_AND_MOVE_RING();

            if (wasPlayerTokDrag && snapDrag && snapStart) {
                const st = GET_MAP_STATE();
                const cs = GC();
                if (cs[PI] && cs[PI].inCombat && st.turnOrder && st.turnOrder.active) {
                    const to = window.ENSURE_TURN_STATE(st);
                    const movedFt = (snapDrag.walkedFt !== undefined)
                        ? snapDrag.walkedFt
                        : window.CALC_MAP_DISTANCE_FT(st, snapStart.x, snapStart.y, snapDrag.lastX, snapDrag.lastY);
                    to.moveLeft = Math.max(0, (to.moveLeft ?? 0) - movedFt);
                    SAVE_MAP_STATE(st);
                    RENDER_MAP_AREA();
                }
            }
        };
    }

    window.addEventListener('mouseup', () => {
        isPaintingWalls = false;
        if (window._crDragPath) {
            window._crDragPath = null;
            DRAW_WALL_OVERLAY_AND_MOVE_RING();
        }
    });

    // --- 8. ХУКИ В RENDER_MAP_AREA И БОЕВОЙ HUD ---
    const _ORIG_RENDER_MAP_CR = window.RENDER_MAP_AREA;
    window.RENDER_MAP_AREA = function() {
        _ORIG_RENDER_MAP_CR();
        WRAP_MAP_DRAG_AND_WALL_EVENTS();
        DRAW_WALL_OVERLAY_AND_MOVE_RING();

        const sess = GET_SESSION();
        const isGM = sess && sess.role === 'gm';

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