// ================================================================
// 🧱 НЕПРОХОДИМОСТЬ СТЕН, БЫСТРЫЙ ОБХОД ПРОЁМОВ (0 ЛАГОВ),
// ЛИМИТ ДВИЖЕНИЯ В БОЮ (ФТ), ДАЛЬНОСТЬ АТАК И ВЫХОД ИЗ БОЯ (combat_rules.js)
// ================================================================
(function INIT_COMBAT_PHYSICS_AND_WALLS() {
    window._gmWallBrushMode = false;
    window._gmWallBrushAction = 'block'; // 'block' | 'erase'
    window._gmWallOverlayVisible = false;

    let isPaintingWalls = false;
    let wallPaintCache = null; // Локальный кэш при рисовании стен ГМ (сохраняем на mouseup)
    let dragInfo = null;       // Кэш текущего перетаскивания фишки (0 вызовов localStorage в mousemove)
    let pendingMoveEvt = null;
    let dragRafId = null;
    let wallWarningTimer = null;
    let lastHintText = '';

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

    function MASK_TO_UINT8(mask, cols, rows) {
        const arr = new Uint8Array(cols * rows);
        if (!mask) return arr;
        const len = Math.min(arr.length, mask.length);
        for (let i = 0; i < len; i++) {
            if (mask.charCodeAt(i) === 49) arr[i] = 1;
        }
        return arr;
    }

    function PCT_TO_CELL_DIMS(cols, rows, xPct, yPct) {
        return {
            c: Math.max(0, Math.min(cols - 1, Math.floor((xPct / 100) * cols))),
            r: Math.max(0, Math.min(rows - 1, Math.floor((yPct / 100) * rows)))
        };
    }

    function CLAMP_IN_CELL_DIMS(cols, rows, c, r, xPct, yPct) {
        const cw = 100 / cols;
        const ch = 100 / rows;
        const padX = cw * 0.16;
        const padY = ch * 0.16;
        return {
            x: Math.round(Math.max(c * cw + padX, Math.min((c + 1) * cw - padX, xPct)) * 10) / 10,
            y: Math.round(Math.max(r * ch + padY, Math.min((r + 1) * ch - padY, yPct)) * 10) / 10
        };
    }

    function DIST_FT_DIMS(cols, rows, x1, y1, x2, y2) {
        return Math.hypot(((x2 - x1) / 100) * cols, ((y2 - y1) / 100) * rows) * 5;
    }

    window.CALC_MAP_DISTANCE_FT = function(st, x1Pct, y1Pct, x2Pct, y2Pct) {
        const { cols, rows } = GET_MAP_GRID_DIMS(st);
        return Math.round(DIST_FT_DIMS(cols, rows, x1Pct, y1Pct, x2Pct, y2Pct));
    };

    // Быстрая проверка отрезка по Uint8Array (без выделения объектов)
    function IS_SEG_CLEAR_FAST(blocked, cols, rows, x0, y0, x1, y1) {
        const sc = Math.max(0, Math.min(cols - 1, Math.floor((x0 / 100) * cols)));
        const sr = Math.max(0, Math.min(rows - 1, Math.floor((y0 / 100) * rows)));
        const startBlocked = blocked[sr * cols + sc] === 1;

        const gx0 = (x0 / 100) * cols, gy0 = (y0 / 100) * rows;
        const gx1 = (x1 / 100) * cols, gy1 = (y1 / 100) * rows;
        const steps = Math.max(4, Math.ceil(Math.hypot(gx1 - gx0, gy1 - gy0) * 4));
        let prevC = sc, prevR = sr;

        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const c = Math.max(0, Math.min(cols - 1, Math.floor(gx0 + (gx1 - gx0) * t)));
            const r = Math.max(0, Math.min(rows - 1, Math.floor(gy0 + (gy1 - gy0) * t)));
            if (c === prevC && r === prevR) continue;
            if (blocked[r * cols + c] === 1 && !(startBlocked && c === sc && r === sr)) {
                return false;
            }
            if (c !== prevC && r !== prevR) {
                if (blocked[prevR * cols + c] === 1 || blocked[r * cols + prevC] === 1) {
                    return false;
                }
            }
            prevC = c;
            prevR = r;
        }
        return true;
    }

    // Поиск кратчайших путей от стартовой клетки (строится лениво 1 раз при встрече со стеной)
    function BUILD_NAV_FIELD(blocked, cols, rows, startC, startR) {
        const total = cols * rows;
        const dist = new Float32Array(total);
        const parent = new Int32Array(total);
        dist.fill(Infinity);
        parent.fill(-1);

        const sIdx = startR * cols + startC;
        dist[sIdx] = 0;

        const heapIdx = [sIdx];
        const heapCost = [0];
        const push = (idx, cost) => {
            heapIdx.push(idx);
            heapCost.push(cost);
            let i = heapIdx.length - 1;
            while (i > 0) {
                const p = (i - 1) >> 1;
                if (heapCost[p] <= heapCost[i]) break;
                const ti = heapIdx[p]; heapIdx[p] = heapIdx[i]; heapIdx[i] = ti;
                const tc = heapCost[p]; heapCost[p] = heapCost[i]; heapCost[i] = tc;
                i = p;
            }
        };
        const pop = () => {
            const topIdx = heapIdx[0], topCost = heapCost[0];
            const lastIdx = heapIdx.pop(), lastCost = heapCost.pop();
            const len = heapIdx.length;
            if (len > 0) {
                heapIdx[0] = lastIdx;
                heapCost[0] = lastCost;
                let i = 0;
                while (true) {
                    let l = (i << 1) + 1, r = l + 1, best = i;
                    if (l < len && heapCost[l] < heapCost[best]) best = l;
                    if (r < len && heapCost[r] < heapCost[best]) best = r;
                    if (best === i) break;
                    const ti = heapIdx[i]; heapIdx[i] = heapIdx[best]; heapIdx[best] = ti;
                    const tc = heapCost[i]; heapCost[i] = heapCost[best]; heapCost[best] = tc;
                    i = best;
                }
            }
            return [topIdx, topCost];
        };

        const DIRS = [
            [1, 0, 5], [-1, 0, 5], [0, 1, 5], [0, -1, 5],
            [1, 1, 7.071], [1, -1, 7.071], [-1, 1, 7.071], [-1, -1, 7.071]
        ];

        while (heapIdx.length > 0) {
            const [u, d] = pop();
            if (d > dist[u]) continue;
            const uc = u % cols;
            const ur = (u - uc) / cols;

            for (let k = 0; k < 8; k++) {
                const dc = DIRS[k][0], dr = DIRS[k][1], cost = DIRS[k][2];
                const nc = uc + dc, nr = ur + dr;
                if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
                const v = nr * cols + nc;
                if (blocked[v] === 1) continue;
                if (dc !== 0 && dr !== 0) {
                    if (blocked[ur * cols + (uc + dc)] === 1 || blocked[(ur + dr) * cols + uc] === 1) continue;
                }
                const nd = d + cost;
                if (nd < dist[v]) {
                    dist[v] = nd;
                    parent[v] = u;
                    push(v, nd);
                }
            }
        }
        return { dist, parent, sIdx };
    }

    function SMOOTH_PATH_FAST(blocked, cols, rows, rawPts) {
        if (rawPts.length <= 2) return rawPts;
        const out = [rawPts[0]];
        let i = 0;
        while (i < rawPts.length - 1) {
            let best = i + 1;
            for (let j = rawPts.length - 1; j > i + 1; j--) {
                if (IS_SEG_CLEAR_FAST(blocked, cols, rows, rawPts[i].x, rawPts[i].y, rawPts[j].x, rawPts[j].y)) {
                    best = j;
                    break;
                }
            }
            out.push(rawPts[best]);
            i = best;
        }
        return out;
    }

    function CLIP_PATH_FAST(blocked, cols, rows, pts, maxFt) {
        if (!pts.length) return { pts: [], totalFt: 0, clamped: false };
        const res = [pts[0]];
        let acc = 0;
        for (let i = 1; i < pts.length; i++) {
            const a = pts[i - 1], b = pts[i];
            const segFt = DIST_FT_DIMS(cols, rows, a.x, a.y, b.x, b.y);
            if (acc + segFt <= maxFt + 0.01) {
                res.push(b);
                acc += segFt;
            } else {
                const rem = Math.max(0, maxFt - acc);
                if (segFt > 0.01 && rem > 0.1) {
                    const ratio = rem / segFt;
                    const cx = Math.round((a.x + (b.x - a.x) * ratio) * 10) / 10;
                    const cy = Math.round((a.y + (b.y - a.y) * ratio) * 10) / 10;
                    const cell = PCT_TO_CELL_DIMS(cols, rows, cx, cy);
                    if (!blocked || blocked[cell.r * cols + cell.c] !== 1) {
                        res.push({ x: cx, y: cy });
                        acc = maxFt;
                    }
                }
                return { pts: res, totalFt: Math.round(acc), clamped: true };
            }
        }
        return { pts: res, totalFt: Math.round(acc), clamped: false };
    }

    // Расчёт позиции фишки целиком в памяти (0 localStorage, < 0.1 мс)
    function RESOLVE_DRAG_FAST(info, rawX, rawY) {
        const { cols, rows, blocked, hasWalls, moveLeft } = info;
        if (!hasWalls) {
            const clipped = CLIP_PATH_FAST(null, cols, rows, [{ x: info.x, y: info.y }, { x: rawX, y: rawY }], moveLeft);
            const end = clipped.pts[clipped.pts.length - 1];
            return { x: end.x, y: end.y, pts: clipped.pts, totalFt: clipped.totalFt, clamped: clipped.clamped, hitWall: false };
        }

        const curCell = PCT_TO_CELL_DIMS(cols, rows, rawX, rawY);
        const curBlocked = blocked[curCell.r * cols + curCell.c] === 1;

        // Быстрый путь: курсор на полу и прямая линия свободна — поиск пути даже не нужен!
        if (!curBlocked) {
            const endPt = CLAMP_IN_CELL_DIMS(cols, rows, curCell.c, curCell.r, rawX, rawY);
            if (IS_SEG_CLEAR_FAST(blocked, cols, rows, info.x, info.y, endPt.x, endPt.y)) {
                const clipped = CLIP_PATH_FAST(blocked, cols, rows, [{ x: info.x, y: info.y }, endPt], moveLeft);
                const end = clipped.pts[clipped.pts.length - 1];
                return { x: end.x, y: end.y, pts: clipped.pts, totalFt: clipped.totalFt, clamped: clipped.clamped, hitWall: false };
            }
        }

        // Стена на пути — лениво строим навигационную карту 1 раз за перетаскивание
        if (!info.nav) {
            info.nav = BUILD_NAV_FIELD(blocked, cols, rows, info.startC, info.startR);
        }
        const nav = info.nav;
        const curIdx = curCell.r * cols + curCell.c;

        let goalC = curCell.c, goalR = curCell.r;
        let endPt = null;
        let hitWall = false;

        if (curBlocked || !isFinite(nav.dist[curIdx])) {
            hitWall = true;
            let best = null;
            for (let rad = 1; rad <= 3 && !best; rad++) {
                for (let dr = -rad; dr <= rad; dr++) {
                    for (let dc = -rad; dc <= rad; dc++) {
                        const nc = curCell.c + dc, nr = curCell.r + dr;
                        if (nc < 0 || nc >= cols || nr < 0 || nr >= rows) continue;
                        const nIdx = nr * cols + nc;
                        if (blocked[nIdx] === 1 || !isFinite(nav.dist[nIdx])) continue;

                        const clampedPt = CLAMP_IN_CELL_DIMS(cols, rows, nc, nr, rawX, rawY);
                        const dCursor = DIST_FT_DIMS(cols, rows, clampedPt.x, clampedPt.y, rawX, rawY);
                        const overPen = (nav.dist[nIdx] > moveLeft + 3) ? 12 : 0;
                        const score = dCursor + overPen;
                        if (!best || score < best.score) best = { c: nc, r: nr, pt: clampedPt, score };
                    }
                }
            }
            if (best) {
                goalC = best.c;
                goalR = best.r;
                endPt = best.pt;
            } else {
                return {
                    x: info.lastValidX, y: info.lastValidY,
                    pts: info.lastValidPts, totalFt: info.lastValidFt,
                    clamped: false, hitWall: true
                };
            }
        } else {
            endPt = CLAMP_IN_CELL_DIMS(cols, rows, goalC, goalR, rawX, rawY);
        }

        let pathPts;
        if (IS_SEG_CLEAR_FAST(blocked, cols, rows, info.x, info.y, endPt.x, endPt.y)) {
            pathPts = [{ x: info.x, y: info.y }, endPt];
        } else {
            const chain = [];
            let cur = goalR * cols + goalC;
            let guard = 0;
            while (cur !== -1 && cur !== nav.sIdx && guard++ < cols * rows) {
                const c = cur % cols;
                const r = (cur - c) / cols;
                chain.push({ x: ((c + 0.5) / cols) * 100, y: ((r + 0.5) / rows) * 100 });
                cur = nav.parent[cur];
            }
            chain.reverse();
            const rawPts = [{ x: info.x, y: info.y }].concat(chain);
            rawPts[rawPts.length - 1] = endPt;
            pathPts = SMOOTH_PATH_FAST(blocked, cols, rows, rawPts);
        }

        const clipped = CLIP_PATH_FAST(blocked, cols, rows, pathPts, moveLeft);
        const finalPt = clipped.pts[clipped.pts.length - 1] || { x: info.x, y: info.y };
        return {
            x: Math.round(finalPt.x * 10) / 10,
            y: Math.round(finalPt.y * 10) / 10,
            pts: clipped.pts,
            totalFt: clipped.totalFt,
            clamped: clipped.clamped,
            hitWall
        };
    }

    function HAS_LINE_OF_SIGHT(st, x0, y0, x1, y1) {
        if (!st || !st.collisionMask || !st.collisionMask.includes('1')) return true;
        const { cols, rows } = GET_MAP_GRID_DIMS(st);
        const c0 = PCT_TO_CELL_DIMS(cols, rows, x0, y0);
        const c1 = PCT_TO_CELL_DIMS(cols, rows, x1, y1);
        const steps = Math.max(8, Math.ceil(Math.hypot(((x1 - x0) / 100) * cols, ((y1 - y0) / 100) * rows) * 5));

        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const cell = PCT_TO_CELL_DIMS(cols, rows, x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
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
        if (lastHintText !== text) {
            lastHintText = text;
            box.style.background = isError ? 'rgba(92, 28, 28, 0.94)' : 'rgba(22, 20, 18, 0.94)';
            box.style.color = isError ? '#fecaca' : '#e6c88c';
            box.style.border = `1px solid ${isError ? '#c96060' : '#c9a96e'}`;
            box.textContent = text;
        }
        box.style.display = 'block';
        if (wallWarningTimer) clearTimeout(wallWarningTimer);
        wallWarningTimer = setTimeout(() => {
            if (box) box.style.display = 'none';
            lastHintText = '';
        }, 2200);
    }

    // Быстрое обновление только линии маршрута в SVG (без пересборки всего SVG и без localStorage!)
    function UPDATE_DRAG_PATH_SVG(pts, vpW, vpH) {
        const line = document.getElementById('cr-drag-line');
        const dot = document.getElementById('cr-drag-start');
        if (!line || !dot) return;
        if (!pts || pts.length < 2) {
            line.style.display = 'none';
            dot.style.display = 'none';
            return;
        }
        const str = pts.map(p => `${((p.x / 100) * vpW).toFixed(1)},${((p.y / 100) * vpH).toFixed(1)}`).join(' ');
        line.setAttribute('points', str);
        line.style.display = 'block';
        dot.setAttribute('cx', ((pts[0].x / 100) * vpW).toFixed(1));
        dot.setAttribute('cy', ((pts[0].y / 100) * vpH).toFixed(1));
        dot.style.display = 'block';
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
        if (!wallPaintCache) return;
        const { st, rect } = wallPaintCache;
        const xPct = Math.max(0, Math.min(99.9, ((e.clientX - rect.left) / Math.max(1, rect.width)) * 100));
        const yPct = Math.max(0, Math.min(99.9, ((e.clientY - rect.top) / Math.max(1, rect.height)) * 100));

        const { c, r } = PCT_TO_CELL_DIMS(st.mapCols, st.mapRows, xPct, yPct);
        const idx = r * st.mapCols + c;
        const ch = (forceAction || window._gmWallBrushAction) === 'erase' ? '0' : '1';
        if (st.collisionMask[idx] === ch) return;

        st.collisionMask = st.collisionMask.slice(0, idx) + ch + st.collisionMask.slice(idx + 1);
        wallPaintCache.dirty = true;
        DRAW_WALL_OVERLAY_AND_MOVE_RING(st);
    }

    function DRAW_WALL_OVERLAY_AND_MOVE_RING(passedSt) {
        const vp = document.getElementById('map-viewport');
        if (!vp) return;
        const st = passedSt || GET_MAP_STATE();
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

        // Постоянные элементы для быстрой отрисовки маршрута перетаскивания
        parts.push(`<polyline id="cr-drag-line" points="" fill="none" stroke="#86efac" stroke-width="2.6" stroke-dasharray="6 4" stroke-linecap="round" stroke-linejoin="round" opacity="0.9" style="display:none;"/>`);
        parts.push(`<circle id="cr-drag-start" cx="0" cy="0" r="4" fill="#86efac" opacity="0.85" style="display:none;"/>`);

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

    // --- 7. БЫСТРОЕ ПЕРЕТАСКИВАНИЕ ФИШЕК (КЭШ НА MOUSEDOWN + rAF, 0 localStorage В MOUSEMOVE) ---
    const _ORIG_START_DRAG_CR = window.START_DRAG_MAP_OBJ;
    if (typeof _ORIG_START_DRAG_CR === 'function') {
        window.START_DRAG_MAP_OBJ = function(type, index, domId) {
            const sess = GET_SESSION();
            const isPlayer = sess && sess.role === 'player';

            dragInfo = null;
            if (isPlayer && type === 'token') {
                const st = GET_MAP_STATE();
                const cs = GC();
                const tok = st.tokens && st.tokens[index];
                const c = cs[PI];
                const inCombat = !!(c && c.inCombat && st.turnOrder && st.turnOrder.active && st.tokens && st.tokens.length);
                let moveLeft = 9999;

                if (inCombat) {
                    const to = window.ENSURE_TURN_STATE(st);
                    const curTok = st.tokens[(to.currentIdx || 0) % st.tokens.length];
                    if (!curTok || !curTok.isPlayer || curTok.charIdx !== PI) {
                        SHOW_MAP_RULE_HINT('⏳ В бою двигать фишку можно только в свой ход!', true);
                        return;
                    }
                    moveLeft = Math.max(0, to.moveLeft ?? 0);
                    if (moveLeft <= 0) {
                        SHOW_MAP_RULE_HINT('👣 Запас движения на этот ход исчерпан (используйте Рывок)!', true);
                        return;
                    }
                }

                if (tok) {
                    const { cols, rows } = GET_MAP_GRID_DIMS(st);
                    const hasWalls = !!(st.collisionMask && st.collisionMask.includes('1'));
                    const sCell = PCT_TO_CELL_DIMS(cols, rows, tok.x, tok.y);
                    const vp = document.getElementById('map-viewport') || document.getElementById('map-area');
                    const rect = vp ? vp.getBoundingClientRect() : { left: 0, top: 0, width: 800, height: 500 };

                    dragInfo = {
                        x: tok.x,
                        y: tok.y,
                        index,
                        cols,
                        rows,
                        hasWalls,
                        blocked: hasWalls ? MASK_TO_UINT8(st.collisionMask, cols, rows) : null,
                        startC: sCell.c,
                        startR: sCell.r,
                        nav: null, // Построится лениво только при встрече со стеной
                        inCombat,
                        moveLeft,
                        rect,
                        vpW: Math.max(100, (vp && vp.clientWidth) || 800),
                        vpH: Math.max(100, (vp && vp.clientHeight) || 500),
                        el: document.getElementById(domId),
                        lastValidX: tok.x,
                        lastValidY: tok.y,
                        lastValidPts: [{ x: tok.x, y: tok.y }],
                        lastValidFt: 0
                    };
                }
            }

            const res = _ORIG_START_DRAG_CR(type, index, domId);
            if (!window._draggingMapObj) dragInfo = null;
            return res;
        };
    }

    function PROCESS_PLAYER_DRAG_FRAME() {
        dragRafId = null;
        if (!pendingMoveEvt || !dragInfo || !window._draggingMapObj || window._draggingMapObj.type !== 'token') return;

        const { clientX, clientY } = pendingMoveEvt;
        pendingMoveEvt = null;

        const r = dragInfo.rect;
        const rawX = Math.max(2, Math.min(98, ((clientX - r.left) / Math.max(1, r.width)) * 100));
        const rawY = Math.max(2, Math.min(98, ((clientY - r.top) / Math.max(1, r.height)) * 100));

        const resolved = RESOLVE_DRAG_FAST(dragInfo, rawX, rawY);

        dragInfo.lastValidX = resolved.x;
        dragInfo.lastValidY = resolved.y;
        dragInfo.lastValidPts = resolved.pts;
        dragInfo.lastValidFt = resolved.totalFt;

        if (dragInfo.el) {
            dragInfo.el.style.left = resolved.x + '%';
            dragInfo.el.style.top = resolved.y + '%';
        }
        window._draggingMapObj.lastX = resolved.x;
        window._draggingMapObj.lastY = resolved.y;
        window._draggingMapObj.walkedFt = resolved.totalFt;
        window._draggingMapObj.moved = true;

        UPDATE_DRAG_PATH_SVG(resolved.pts, dragInfo.vpW, dragInfo.vpH);

        if (dragInfo.inCombat) {
            const rem = Math.max(0, dragInfo.moveLeft - resolved.totalFt);
            SHOW_MAP_RULE_HINT(`👣 Путь: ${resolved.totalFt} фт | Останется: ${rem} фт${resolved.clamped ? ' (предел хода)' : ''}`);
        } else if (resolved.hitWall && resolved.totalFt === 0) {
            SHOW_MAP_RULE_HINT('🧱 Непроходимая стена', true);
        }
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
                const vp = document.getElementById('map-viewport');
                if (!vp) return;
                isPaintingWalls = true;
                wallPaintCache = {
                    st: ENSURE_COLLISION_MASK(GET_MAP_STATE()),
                    rect: vp.getBoundingClientRect(),
                    dirty: false
                };
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

            if (isPlayer && window._draggingMapObj && window._draggingMapObj.type === 'token' && dragInfo) {
                pendingMoveEvt = { clientX: e.clientX, clientY: e.clientY };
                if (!dragRafId) {
                    dragRafId = requestAnimationFrame(PROCESS_PLAYER_DRAG_FRAME);
                }
                return;
            }

            if (origMove) return origMove.call(this, e);
        };

        const origUp = mapArea.onmouseup;
        mapArea.onmouseup = function(e) {
            if (isPaintingWalls) {
                isPaintingWalls = false;
                if (wallPaintCache && wallPaintCache.dirty) {
                    SAVE_MAP_STATE(wallPaintCache.st);
                }
                wallPaintCache = null;
                return;
            }

            if (dragRafId) {
                cancelAnimationFrame(dragRafId);
                dragRafId = null;
                if (pendingMoveEvt) PROCESS_PLAYER_DRAG_FRAME();
            }

            const wasPlayerTokDrag = isPlayer && window._draggingMapObj && window._draggingMapObj.type === 'token' && window._draggingMapObj.moved && dragInfo;
            const snapDrag = wasPlayerTokDrag ? Object.assign({}, window._draggingMapObj) : null;
            const snapInCombat = !!(dragInfo && dragInfo.inCombat);
            dragInfo = null;
            pendingMoveEvt = null;
            UPDATE_DRAG_PATH_SVG(null, 0, 0);

            if (origUp) origUp.call(this, e);

            if (wasPlayerTokDrag && snapDrag && snapInCombat) {
                const st = GET_MAP_STATE();
                const to = window.ENSURE_TURN_STATE(st);
                const movedFt = snapDrag.walkedFt || 0;
                to.moveLeft = Math.max(0, (to.moveLeft ?? 0) - movedFt);
                SAVE_MAP_STATE(st);
                RENDER_MAP_AREA();
            }
        };
    }

    window.addEventListener('mouseup', () => {
        if (isPaintingWalls) {
            isPaintingWalls = false;
            if (wallPaintCache && wallPaintCache.dirty) {
                SAVE_MAP_STATE(wallPaintCache.st);
            }
            wallPaintCache = null;
        }
        if (dragRafId) {
            cancelAnimationFrame(dragRafId);
            dragRafId = null;
        }
        pendingMoveEvt = null;
        UPDATE_DRAG_PATH_SVG(null, 0, 0);
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