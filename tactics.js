// ================================================================
// ⚔️ ТАКТИКА НА КАРТЕ, СОСТОЯНИЯ, КОНЦЕНТРАЦИЯ, СПАСЫ ОТ СМЕРТИ
// И КЛАССОВЫЕ РЕСУРСЫ В БОЮ (tactics.js)
// ================================================================
(function INIT_TACTICS_AND_COMBAT_PLUS() {
    const FB_ROOMS_URL = "https://dnds-23b7d-default-rtdb.firebaseio.com/campaign_v2/rooms";

    // Добавляем новые поля в изоляцию прогресса по комнатам (auth.js)
    if (typeof ROOM_PROGRESS_FIELDS !== 'undefined' && Array.isArray(ROOM_PROGRESS_FIELDS)) {
        ['deathSaves', 'concentratingSpell', 'classResUsed'].forEach(f => {
            if (!ROOM_PROGRESS_FIELDS.includes(f)) ROOM_PROGRESS_FIELDS.push(f);
        });
    }

    // --- СПРАВОЧНИК СОСТОЯНИЙ D&D 5e ---
    const CONDITIONS = [
        { id: 'conc',        icon: '🔮', name: 'Концентрация',  desc: 'Удержание заклинания (при уроне — спас Тел Сл ≥ 10)' },
        { id: 'dodge',       icon: '🛡️', name: 'Уклонение',     desc: 'Помеха атакам по вам и преимущество на спасы Ловк до вашего хода' },
        { id: 'rage',        icon: '🔥', name: 'Ярость',        desc: 'Сопротивление физ. урону и бонус к рукопашному урону' },
        { id: 'prone',       icon: '⬇️', name: 'Сбит с ног',    desc: 'Помеха своим атакам; атаки вблизи по вам с преимуществом' },
        { id: 'poisoned',    icon: '🧪', name: 'Отравлен',      desc: 'Помеха на броски атак и проверки характеристик' },
        { id: 'stunned',     icon: '💫', name: 'Оглушён',       desc: 'Недееспособен, автопровал спасов Сил/Ловк, атаки по вам с преимуществом' },
        { id: 'paralyzed',   icon: '⚡', name: 'Парализован',   desc: 'Недееспособен, попадания в пределах 5 фт — критические' },
        { id: 'blinded',     icon: '🙈', name: 'Ослеплён',      desc: 'Помеха вашим атакам, атаки по вам с преимуществом' },
        { id: 'frightened',  icon: '😱', name: 'Испуган',       desc: 'Помеха атакам и проверкам, пока виден источник страха' },
        { id: 'charmed',     icon: '💜', name: 'Очарован',      desc: 'Не может атаковать очаровавшего' },
        { id: 'restrained',  icon: '🕸️', name: 'Опутан',        desc: 'Скорость 0, помеха атакам и спасам Ловк' },
        { id: 'invisible',   icon: '👻', name: 'Невидим',       desc: 'Преимущество на ваши атаки, помеха атакам по вам' }
    ];

    window._tacTool = 'none';        // 'none' | 'ruler' | 'ping' | 'aoe'
    window._tacAoeShape = 'circle';  // 'circle' | 'cone' | 'line'
    window._tacAoeFeet = 20;
    window._tacRuler = null;         // { x1, y1, x2, y2 } (в долях 0..1)
    window._tacDraftAoe = null;      // Локальный предпросмотр AoE при перетаскивании
    window._tacRemoteAoe = null;     // Синхронизированный AoE комнаты
    window._tacPings = [];           // Активные кольца пингов
    window._tacLastHpByHero = {};    // Отслеживание потери ХП для проверки Концентрации
    window._tacConcCheck = null;     // Активное всплывающее окно проверки Концентрации

    let activeTacRoom = null;
    let activePingRef = null;
    let activeAoeRef = null;
    let seenPingIds = new Set();
    let draggingTac = false;

    function ESC(s) {
        return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function CUR_ROOM() {
        const sess = (typeof GET_SESSION === 'function') ? GET_SESSION() : null;
        return (sess && sess.roomCode) ? String(sess.roomCode) : null;
    }

    function MY_LABEL() {
        return (typeof GET_CURRENT_SPEAKER_NAME === 'function') ? GET_CURRENT_SPEAKER_NAME() : 'Участник';
    }

    // ================================================================
    // 1. СИНХРОНИЗАЦИЯ ПИНГОВ И ШАБЛОНОВ AoE ПО КОМНАТАМ (FIREBASE)
    // ================================================================
    function PUSH_ROOM_NODE(subpath, payload) {
        const rc = CUR_ROOM();
        if (!rc) return;
        if (window.firebase && firebase.apps && firebase.apps.length) {
            const ref = firebase.database().ref(`campaign_v2/rooms/${rc}/${subpath}`);
            if (payload === null) ref.remove().catch(() => {});
            else ref.set(payload).catch(() => {});
        } else {
            fetch(`${FB_ROOMS_URL}/${encodeURIComponent(rc)}/${subpath}.json`, {
                method: payload === null ? 'DELETE' : 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: payload === null ? undefined : JSON.stringify(payload)
            }).catch(() => {});
        }
    }

    function TRIGGER_LOCAL_PING(pingObj) {
        if (!pingObj || !pingObj.id || seenPingIds.has(pingObj.id)) return;
        if (pingObj.ts && Date.now() - pingObj.ts > 8000) return;
        seenPingIds.add(pingObj.id);
        if (seenPingIds.size > 60) {
            seenPingIds = new Set(Array.from(seenPingIds).slice(-30));
        }
        window._tacPings.push(Object.assign({ created: Date.now() }, pingObj));
        DRAW_TACTICS_SVG();
        setTimeout(() => {
            window._tacPings = window._tacPings.filter(p => p.id !== pingObj.id);
            DRAW_TACTICS_SVG();
        }, 2800);
    }

    window.SEND_MAP_PING = function(xFrac, yFrac) {
        const sess = (typeof GET_SESSION === 'function') ? GET_SESSION() : null;
        const isGM = sess && sess.role === 'gm';
        const ping = {
            id: 'ping_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
            x: Math.round(xFrac * 1000) / 1000,
            y: Math.round(yFrac * 1000) / 1000,
            by: MY_LABEL(),
            color: isGM ? '#c084fc' : '#facc15',
            ts: Date.now()
        };
        TRIGGER_LOCAL_PING(ping);
        PUSH_ROOM_NODE('tactics_ping', ping);
    };

    window.CLEAR_ROOM_AOE = function() {
        window._tacDraftAoe = null;
        window._tacRemoteAoe = null;
        PUSH_ROOM_NODE('tactics_aoe', null);
        DRAW_TACTICS_SVG();
        UPDATE_TACTICS_TOOLBAR();
    };

    function SYNC_TACTICS_FOR_ROOM(roomCode) {
        const nextRc = roomCode ? String(roomCode) : null;
        if (nextRc === activeTacRoom && (nextRc === null || activePingRef)) return;

        if (activePingRef) { activePingRef.off(); activePingRef = null; }
        if (activeAoeRef) { activeAoeRef.off(); activeAoeRef = null; }

        activeTacRoom = nextRc;
        window._tacTool = 'none';
        window._tacRuler = null;
        window._tacDraftAoe = null;
        window._tacRemoteAoe = null;
        window._tacPings = [];
        window._tacConcCheck = null;
        RENDER_CONCENTRATION_POPUP();

        if (!nextRc) return;

        const attach = () => {
            if (activeTacRoom !== nextRc) return true;
            if (window.firebase && firebase.apps && firebase.apps.length) {
                const base = firebase.database().ref(`campaign_v2/rooms/${nextRc}`);
                activePingRef = base.child('tactics_ping');
                activeAoeRef = base.child('tactics_aoe');

                activePingRef.on('value', (snap) => {
                    if (activeTacRoom !== nextRc) return;
                    const p = snap.val();
                    if (p) TRIGGER_LOCAL_PING(p);
                });
                activeAoeRef.on('value', (snap) => {
                    if (activeTacRoom !== nextRc) return;
                    window._tacRemoteAoe = snap.val() || null;
                    DRAW_TACTICS_SVG();
                    UPDATE_TACTICS_TOOLBAR();
                });
                return true;
            }
            return false;
        };

        if (!attach()) {
            const t = setInterval(() => { if (attach()) clearInterval(t); }, 650);
            setTimeout(() => clearInterval(t), 20000);
        }
    }

    // ================================================================
    // 2. SVG-СЛОЙ НА КАРТЕ: ЛИНЕЙКА, AoE-ШАБЛОНЫ И ПИНГИ
    // ================================================================
    function ENSURE_TACTICS_CSS() {
        if (document.getElementById('tactics-inline-style')) return;
        const st = document.createElement('style');
        st.id = 'tactics-inline-style';
        st.textContent = `
            @keyframes tacPingExpand {
                0%   { r: 6; opacity: 1; stroke-width: 4; }
                100% { r: 44; opacity: 0; stroke-width: 1; }
            }
            .tac-ping-ring { animation: tacPingExpand 1.35s ease-out infinite; }
            .tac-ping-ring-delay { animation: tacPingExpand 1.35s ease-out 0.45s infinite; }
        `;
        document.head.appendChild(st);
    }

    function DRAW_TACTICS_SVG() {
        const vp = document.getElementById('map-viewport');
        if (!vp) return;

        let svg = document.getElementById('tactics-svg-overlay');
        if (!svg) {
            svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.id = 'tactics-svg-overlay';
            svg.style.cssText = 'position:absolute; inset:0; width:100%; height:100%; pointer-events:none; z-index:8; overflow:visible;';
            vp.appendChild(svg);
        }

        const w = Math.max(100, vp.clientWidth || 800);
        const h = Math.max(100, vp.clientHeight || 500);
        svg.setAttribute('viewBox', `0 0 ${w} ${h}`);

        const mapSt = GET_MAP_STATE();
        const pxPerCell = Math.max(20, mapSt.gridSize || 48);
        const pxPerFt = pxPerCell / 5;

        let parts = [];

        // А) AoE-шаблон (черновик при перетаскивании или синхронизированный)
        const aoe = window._tacDraftAoe || window._tacRemoteAoe;
        if (aoe) {
            const ox = aoe.x * w, oy = aoe.y * h;
            const tx = (aoe.tx !== undefined ? aoe.tx : aoe.x) * w;
            const ty = (aoe.ty !== undefined ? aoe.ty : aoe.y) * h;
            const ang = Math.atan2(ty - oy, tx - ox);
            const lenPx = Math.max(pxPerCell, (aoe.feet || 20) * pxPerFt);
            const col = aoe.color || '#f97316';

            if (aoe.shape === 'circle') {
                const dragged = Math.hypot(tx - ox, ty - oy);
                const rPx = (aoe.dragRadius && dragged > 14) ? dragged : lenPx;
                const ftShown = Math.max(5, Math.round((rPx / pxPerFt) / 5) * 5);
                parts.push(`
                    <circle cx="${ox}" cy="${oy}" r="${rPx}" fill="${col}" fill-opacity="0.24" stroke="${col}" stroke-width="2.5" stroke-dasharray="8 5"/>
                    <circle cx="${ox}" cy="${oy}" r="4" fill="${col}"/>
                    <rect x="${ox - 46}" y="${oy - 13}" width="92" height="22" rx="6" fill="rgba(12,11,10,0.88)" stroke="${col}" stroke-width="1"/>
                    <text x="${ox}" y="${oy + 2}" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">🔥 R ${ftShown} фт</text>
                `);
            } else if (aoe.shape === 'cone') {
                // По D&D 5e ширина конуса на конце равна его длине (полуугол = atan(0.5))
                const half = Math.atan(0.5);
                const x1 = ox + Math.cos(ang - half) * lenPx, y1 = oy + Math.sin(ang - half) * lenPx;
                const x2 = ox + Math.cos(ang + half) * lenPx, y2 = oy + Math.sin(ang + half) * lenPx;
                const mx = ox + Math.cos(ang) * (lenPx * 0.58), my = oy + Math.sin(ang) * (lenPx * 0.58);
                parts.push(`
                    <polygon points="${ox},${oy} ${x1},${y1} ${x2},${y2}" fill="${col}" fill-opacity="0.25" stroke="${col}" stroke-width="2.5" stroke-linejoin="round"/>
                    <rect x="${mx - 48}" y="${my - 11}" width="96" height="22" rx="6" fill="rgba(12,11,10,0.88)" stroke="${col}" stroke-width="1"/>
                    <text x="${mx}" y="${my + 4}" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">📐 Конус ${aoe.feet} фт</text>
                `);
            } else if (aoe.shape === 'line') {
                const halfW = pxPerCell * 0.5;
                const nx = -Math.sin(ang) * halfW, ny = Math.cos(ang) * halfW;
                const ex = ox + Math.cos(ang) * lenPx, ey = oy + Math.sin(ang) * lenPx;
                const pts = `${ox + nx},${oy + ny} ${ex + nx},${ey + ny} ${ex - nx},${ey - ny} ${ox - nx},${oy - ny}`;
                const mx = (ox + ex) / 2, my = (oy + ey) / 2;
                parts.push(`
                    <polygon points="${pts}" fill="${col}" fill-opacity="0.26" stroke="${col}" stroke-width="2.5"/>
                    <rect x="${mx - 50}" y="${my - 11}" width="100" height="22" rx="6" fill="rgba(12,11,10,0.88)" stroke="${col}" stroke-width="1"/>
                    <text x="${mx}" y="${my + 4}" text-anchor="middle" fill="#fff" font-size="12" font-weight="bold">⚡ Линия ${aoe.feet} фт</text>
                `);
            }
        }

        // Б) Линейка дистанции
        if (window._tacRuler) {
            const rl = window._tacRuler;
            const x1 = rl.x1 * w, y1 = rl.y1 * h, x2 = rl.x2 * w, y2 = rl.y2 * h;
            const distPx = Math.hypot(x2 - x1, y2 - y1);
            const cells = Math.round((distPx / pxPerCell) * 10) / 10;
            const feet = Math.round((distPx / pxPerCell) * 5);
            const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
            parts.push(`
                <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#38bdf8" stroke-width="3" stroke-dasharray="8 4"/>
                <circle cx="${x1}" cy="${y1}" r="5" fill="#38bdf8" stroke="#0c0b0a" stroke-width="1.5"/>
                <circle cx="${x2}" cy="${x2 ? y2 : y1}" r="5" fill="#facc15" stroke="#0c0b0a" stroke-width="1.5"/>
                <rect x="${mx - 62}" y="${my - 26}" width="124" height="22" rx="6" fill="rgba(10,14,22,0.92)" stroke="#38bdf8" stroke-width="1.2"/>
                <text x="${mx}" y="${my - 11}" text-anchor="middle" fill="#e0f2fe" font-size="12" font-weight="bold">📏 ${feet} фт (${cells} кл.)</text>
            `);
        }

        // В) Живые пинги
        (window._tacPings || []).forEach(p => {
            const px = p.x * w, py = p.y * h;
            const col = p.color || '#facc15';
            parts.push(`
                <circle class="tac-ping-ring" cx="${px}" cy="${py}" r="10" fill="none" stroke="${col}"/>
                <circle class="tac-ping-ring-delay" cx="${px}" cy="${py}" r="10" fill="none" stroke="${col}"/>
                <circle cx="${px}" cy="${py}" r="5" fill="${col}" stroke="#121110" stroke-width="1.5"/>
                <rect x="${px - 58}" y="${py + 10}" width="116" height="20" rx="5" fill="rgba(12,11,10,0.9)" stroke="${col}" stroke-width="1"/>
                <text x="${px}" y="${py + 24}" text-anchor="middle" fill="#fff" font-size="11" font-weight="bold">${ESC(String(p.by || '').slice(0, 16))}</text>
            `);
        });

        svg.innerHTML = parts.join('');
    }

    // --- ПАНЕЛЬ ИНСТРУМЕНТОВ ТАКТИКИ НА КАРТЕ ---
    window.SET_TACTICS_TOOL = function(tool) {
        window._tacTool = (window._tacTool === tool) ? 'none' : tool;
        window._tacRuler = null;
        window._tacDraftAoe = null;
        if (window._tacTool !== 'none') {
            window._gmPinPlacementMode = false;
            window._gmFogEraserMode = false;
            if (typeof STOP_MAP_PAN_MODE === 'function') STOP_MAP_PAN_MODE();
        }
        const mapArea = document.getElementById('map-area');
        if (mapArea) mapArea.style.cursor = window._tacTool !== 'none' ? 'crosshair' : 'default';
        DRAW_TACTICS_SVG();
        UPDATE_TACTICS_TOOLBAR();
    };

    function UPDATE_TACTICS_TOOLBAR() {
        const bar = document.getElementById('tactics-map-toolbar');
        if (!bar) return;
        const t = window._tacTool;
        const btn = (active, bg, label, title, oc) => `
            <button class="btn-small" title="${title}" onclick="event.stopPropagation(); ${oc}"
                style="padding:4px 8px; font-size:0.76rem; background:${active ? bg : 'rgba(24,23,21,0.92)'}; color:${active ? '#fff' : '#e6c88c'}; border:1px solid ${active ? '#fff' : '#524a3d'}; box-shadow:none;">
                ${label}
            </button>`;

        let aoeSub = '';
        if (t === 'aoe') {
            const sh = window._tacAoeShape;
            const ft = window._tacAoeFeet;
            aoeSub = `
                <div style="display:flex; gap:3px; flex-wrap:wrap; align-items:center; border-top:1px dashed #3d3830; padding-top:4px; margin-top:2px;">
                    ${btn(sh==='circle', '#c2410c', '⭕ Круг', 'Радиус (напр. Огненный шар)', "window._tacAoeShape='circle'; UPDATE_TACTICS_TOOLBAR();")}
                    ${btn(sh==='cone',   '#c2410c', '📐 Конус', 'Конус (напр. Огненные ладони)', "window._tacAoeShape='cone'; UPDATE_TACTICS_TOOLBAR();")}
                    ${btn(sh==='line',   '#c2410c', '⚡ Линия', 'Линия (напр. Молния)', "window._tacAoeShape='line'; UPDATE_TACTICS_TOOLBAR();")}
                    <select onchange="event.stopPropagation(); window._tacAoeFeet=parseInt(this.value)||20;" onclick="event.stopPropagation();"
                        style="width:74px; padding:2px 4px; font-size:0.75rem; background:#141312; color:#fed7aa; border:1px solid #9a3412; border-radius:5px;">
                        ${[10, 15, 20, 30, 60, 100].map(v => `<option value="${v}" ${ft===v?'selected':''}>${v} фт</option>`).join('')}
                    </select>
                </div>`;
        }

        bar.innerHTML = `
            <div style="display:flex; gap:4px; align-items:center; flex-wrap:wrap;">
                ${btn(t==='ruler', '#0284c7', '📏 Линейка', 'Измерить дистанцию на карте (в футах и клетках)', "SET_TACTICS_TOOL('ruler')")}
                ${btn(t==='ping',  '#a16207', '🎯 Пинг', 'Указать точку всем игрокам (также работает Alt+клик)', "SET_TACTICS_TOOL('ping')")}
                ${btn(t==='aoe',   '#c2410c', '🔥 AoE', 'Показать зону заклинания на карте', "SET_TACTICS_TOOL('aoe')")}
                ${window._tacRemoteAoe ? `<button class="btn-small btn-danger" style="padding:4px 7px; font-size:0.74rem;" title="Убрать шаблон зоны с карты" onclick="event.stopPropagation(); CLEAR_ROOM_AOE();">✕ AoE</button>` : ''}
                ${btn(false, '#6d28d9', '💫 Состояния', 'Статусы и эффекты на фишках', "OPEN_CONDITIONS_MODAL()")}
            </div>
            ${aoeSub}
        `;
    }

    function BIND_MAP_TACTICS_EVENTS() {
        const mapArea = document.getElementById('map-area');
        if (!mapArea || mapArea.dataset.tacticsBound === '1') return;
        mapArea.dataset.tacticsBound = '1';

        const getFrac = (e) => {
            const vp = document.getElementById('map-viewport') || mapArea;
            const rect = vp.getBoundingClientRect();
            return {
                x: Math.max(0, Math.min(1, (e.clientX - rect.left) / Math.max(1, rect.width))),
                y: Math.max(0, Math.min(1, (e.clientY - rect.top) / Math.max(1, rect.height)))
            };
        };

        mapArea.addEventListener('mousedown', function(e) {
            if (e.button !== 0) return;
            if (e.target.closest('[data-tactics-ui], button, input, select, #bg3-initiative-ribbon')) return;

            // Быстрый Пинг по Alt + клик в любой момент
            if (e.altKey || window._tacTool === 'ping') {
                e.stopPropagation();
                e.preventDefault();
                const pt = getFrac(e);
                window.SEND_MAP_PING(pt.x, pt.y);
                return;
            }

            if (window._tacTool === 'ruler') {
                e.stopPropagation();
                e.preventDefault();
                const pt = getFrac(e);
                draggingTac = true;
                window._tacRuler = { x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y };
                DRAW_TACTICS_SVG();
                return;
            }

            if (window._tacTool === 'aoe') {
                e.stopPropagation();
                e.preventDefault();
                const pt = getFrac(e);
                draggingTac = true;
                const colors = { circle: '#f97316', cone: '#ef4444', line: '#38bdf8' };
                window._tacDraftAoe = {
                    id: 'aoe_' + Date.now(),
                    shape: window._tacAoeShape,
                    feet: window._tacAoeFeet,
                    x: pt.x, y: pt.y, tx: pt.x, ty: pt.y,
                    dragRadius: window._tacAoeShape === 'circle',
                    color: colors[window._tacAoeShape] || '#f97316',
                    by: MY_LABEL()
                };
                DRAW_TACTICS_SVG();
            }
        }, true);

        window.addEventListener('mousemove', function(e) {
            if (!draggingTac) return;
            const pt = getFrac(e);
            if (window._tacTool === 'ruler' && window._tacRuler) {
                window._tacRuler.x2 = pt.x;
                window._tacRuler.y2 = pt.y;
                DRAW_TACTICS_SVG();
            } else if (window._tacTool === 'aoe' && window._tacDraftAoe) {
                window._tacDraftAoe.tx = pt.x;
                window._tacDraftAoe.ty = pt.y;
                DRAW_TACTICS_SVG();
            }
        });

        window.addEventListener('mouseup', function() {
            if (!draggingTac) return;
            draggingTac = false;
            if (window._tacTool === 'aoe' && window._tacDraftAoe) {
                const fin = Object.assign({}, window._tacDraftAoe);
                window._tacRemoteAoe = fin;
                window._tacDraftAoe = null;
                PUSH_ROOM_NODE('tactics_aoe', fin);
                DRAW_TACTICS_SVG();
                UPDATE_TACTICS_TOOLBAR();
            }
        });
    }

    // ================================================================
    // 3. СОСТОЯНИЯ НА ФИШКАХ (ОТОБРАЖЕНИЕ + ОКНО УПРАВЛЕНИЯ)
    // ================================================================
    function INJECT_TOKEN_CONDITION_BADGES() {
        const st = GET_MAP_STATE();
        if (!st || !st.tokens) return;
        const cs = GC();
        const rc = CUR_ROOM();

        st.tokens.forEach((tok, tIdx) => {
            const el = document.getElementById('map-tok-' + tIdx);
            if (!el) return;
            el.querySelectorAll('[data-cond-strip]').forEach(n => n.remove());

            const condIds = new Set(Array.isArray(tok.conditions) ? tok.conditions : []);
            if (tok.isPlayer && cs[tok.charIdx]) {
                const ch = (typeof GET_CHAR_FOR_ROOM === 'function') ? GET_CHAR_FOR_ROOM(cs[tok.charIdx], rc) : cs[tok.charIdx];
                if (ch && ch.concentratingSpell) condIds.add('conc');
            }
            if (!condIds.size) return;

            const strip = document.createElement('div');
            strip.setAttribute('data-cond-strip', '1');
            strip.style.cssText = 'position:absolute; top:-16px; left:50%; transform:translateX(-50%); display:flex; gap:2px; background:rgba(12,11,10,0.88); border:1px solid #524a3d; border-radius:10px; padding:1px 4px; pointer-events:auto; white-space:nowrap;';
            condIds.forEach(cid => {
                const def = CONDITIONS.find(x => x.id === cid);
                if (!def) return;
                const sp = document.createElement('span');
                sp.textContent = def.icon;
                sp.title = `${def.name}: ${def.desc}`;
                sp.style.cssText = 'font-size:0.76rem; line-height:1;';
                strip.appendChild(sp);
            });
            el.appendChild(strip);
        });
    }

    window.TOGGLE_TOKEN_CONDITION = function(tIdx, condId) {
        const st = GET_MAP_STATE();
        const tok = st.tokens && st.tokens[tIdx];
        if (!tok) return;
        if (!Array.isArray(tok.conditions)) tok.conditions = [];
        const has = tok.conditions.includes(condId);
        if (has) tok.conditions = tok.conditions.filter(x => x !== condId);
        else tok.conditions.push(condId);

        // Если сняли Концентрацию с фишки игрока — сбрасываем и поле в листе
        if (condId === 'conc' && has && tok.isPlayer) {
            const cs = GC();
            if (cs[tok.charIdx]) {
                cs[tok.charIdx].concentratingSpell = '';
                SC(cs);
            }
        }
        SAVE_MAP_STATE(st);
        const def = CONDITIONS.find(x => x.id === condId);
        if (def) {
            LOG_COMBAT_TO_CHAT(`${has ? '🔽 снято состояние' : '💫 наложено состояние'} «${def.icon} ${def.name}» (${tok.name})`);
        }
        RENDER_MAP_AREA();
        if (document.getElementById('gm-tool-modal')?.classList.contains('active')) {
            OPEN_CONDITIONS_MODAL();
        }
    };

    window.OPEN_CONDITIONS_MODAL = function() {
        const st = GET_MAP_STATE();
        const sess = GET_SESSION();
        const isGM = sess && sess.role === 'gm';
        const isAdmin = (typeof window.IS_ADMIN === 'function') && window.IS_ADMIN();
        const tokens = st.tokens || [];
        const cont = document.getElementById('gm-tool-modal-content');
        if (!cont) return;
        cont.style.maxWidth = '820px';

        const editable = tokens
            .map((tok, idx) => ({ tok, idx }))
            .filter(({ tok }) => isGM || isAdmin || (tok.isPlayer && tok.charIdx === PI));

        if (!editable.length) {
            cont.innerHTML = `
                <h2>💫 Состояния на фишках</h2>
                <p style="color:#aba498; padding:18px 0; text-align:center;">
                    На карте пока нет фишек, которыми вы можете управлять.<br>
                    <small style="color:#888;">Мастер может выставить фишки через «♟️ Фишки и Бестиарий».</small>
                </p>
                <div style="text-align:right;"><button onclick="CM('gm-tool-modal')">Закрыть</button></div>
            `;
            OM('gm-tool-modal');
            return;
        }

        const cards = editable.map(({ tok, idx }) => {
            const activeSet = new Set(tok.conditions || []);
            const pills = CONDITIONS.map(cd => {
                const on = activeSet.has(cd.id);
                return `
                    <button class="btn-small" title="${ESC(cd.desc)}" onclick="TOGGLE_TOKEN_CONDITION(${idx}, '${cd.id}')"
                        style="padding:4px 8px; font-size:0.78rem; background:${on ? '#6d28d9' : '#1b1917'}; color:${on ? '#fff' : '#ccc'}; border:1px solid ${on ? '#e9d5ff' : '#3d3830'};">
                        ${cd.icon} ${cd.name}
                    </button>`;
            }).join('');
            return `
                <div style="background:#181715; border:1px solid #423c33; border-radius:10px; padding:12px; margin-bottom:10px; text-align:left;">
                    <div style="font-weight:bold; color:${tok.isPlayer ? '#86efac' : '#fca5a5'}; margin-bottom:8px;">
                        ${tok.icon || (tok.isPlayer ? '🛡️' : '👹')} ${ESC(tok.name)}
                        <small style="color:#888; font-weight:normal;">(ХП: ${tok.hp}/${tok.maxHp})</small>
                    </div>
                    <div style="display:flex; gap:5px; flex-wrap:wrap;">${pills}</div>
                </div>`;
        }).join('');

        cont.innerHTML = `
            <h2>💫 Состояния и эффекты бойцов</h2>
            <p style="color:#aba498; font-size:0.88rem; margin-bottom:12px;">
                Нажмите на состояние, чтобы повесить или снять его с фишки на карте. При наведении на иконку над фишкой видна подсказка по правилам D&D 5e.
            </p>
            <div style="max-height:58vh; overflow-y:auto;">${cards}</div>
            <div style="margin-top:14px; text-align:right;"><button onclick="CM('gm-tool-modal')">Закрыть</button></div>
        `;
        OM('gm-tool-modal');
    };

    // ================================================================
    // 4. КОНЦЕНТРАЦИЯ: АВТО-ЗАПУСК И ПРОВЕРКА ПРИ ПОЛУЧЕНИИ УРОНА
    // ================================================================
    const _ORIG_CAST_SPELL_TAC = window.CAST_SPELL;
    window.CAST_SPELL = function(spellName) {
        const sp = gameData.spells.find(s => s.name === spellName);
        const beforeCs = GC();
        const beforeChar = beforeCs[PI];
        const prevConc = beforeChar ? beforeChar.concentratingSpell : '';

        _ORIG_CAST_SPELL_TAC(spellName);

        if (sp && /конц/i.test(sp.duration || '')) {
            const cs = GC();
            const c = cs[PI];
            if (c) {
                c.concentratingSpell = spellName;
                SC(cs);
                if (prevConc && prevConc !== spellName) {
                    LOG_COMBAT_TO_CHAT(`🔮 прерывает концентрацию на «${prevConc}» и концентрируется на «${spellName}»`);
                }
                RENDER_MAP_AREA();
            }
        }
    };

    window.DROP_MY_CONCENTRATION = function() {
        const cs = GC();
        const c = cs[PI];
        if (!c || !c.concentratingSpell) return;
        const old = c.concentratingSpell;
        c.concentratingSpell = '';
        SC(cs);
        window._tacConcCheck = null;
        RENDER_CONCENTRATION_POPUP();
        LOG_COMBAT_TO_CHAT(`🔮 прекращает концентрацию на «${old}».`);
        RENDER_MAP_AREA();
    };

    function RENDER_CONCENTRATION_POPUP() {
        let box = document.getElementById('tac-conc-popup');
        const chk = window._tacConcCheck;
        const sess = GET_SESSION();
        if (!chk || !sess || sess.role !== 'player') {
            if (box) box.remove();
            return;
        }
        if (!box) {
            box = document.createElement('div');
            box.id = 'tac-conc-popup';
            box.style.cssText = 'position:fixed; top:76px; left:50%; transform:translateX(-50%); width:420px; max-width:94vw; background:linear-gradient(180deg, #271b3b 0%, #16111f 100%); border:2px solid #a855f7; border-radius:12px; padding:16px 20px; box-shadow:0 14px 40px rgba(0,0,0,0.95); z-index:94500; color:#f3e8ff; text-align:center;';
            document.body.appendChild(box);
        }
        const cs = GC();
        const c = cs[PI];
        const hasWarCaster = !!(c && c.chosenFeats && c.chosenFeats.includes('Боевой заклинатель'));
        const conBonus = GET_CHAR_CHECK_BONUS(c, 'Спасбросок: Телосложение');

        box.innerHTML = `
            <div style="font-weight:bold; font-size:1.08rem; color:#e9d5ff; margin-bottom:6px;">
                🔮 Проверка Концентрации!
            </div>
            <div style="font-size:0.94rem; color:#ddd; margin-bottom:10px;">
                Получен урон <b>${chk.dmg}</b>. Удержите заклинание <b style="color:#facc15;">«${ESC(chk.spell)}»</b><br>
                Сложность (Сл Телосложения): <b style="color:#4cd964;">${chk.dc}</b> ${hasWarCaster ? '<span style="color:#38bdf8;">(Преимущество: Боевой заклинатель)</span>' : ''}
            </div>
            <div style="display:flex; gap:8px;">
                <button class="btn-save" style="flex:2; padding:10px;" onclick="ROLL_MY_CONCENTRATION_SAVE()">
                    🎲 Бросить спасбросок Тел (${MS(conBonus)})
                </button>
                <button class="btn-danger" style="flex:1; padding:10px;" onclick="DROP_MY_CONCENTRATION()">Сбросить</button>
            </div>
        `;
    }

    window.ROLL_MY_CONCENTRATION_SAVE = function() {
        const chk = window._tacConcCheck;
        if (!chk) return;
        const cs = GC();
        const c = cs[PI];
        if (!c) return;

        const hasWarCaster = !!(c.chosenFeats && c.chosenFeats.includes('Боевой заклинатель'));
        const bonus = GET_CHAR_CHECK_BONUS(c, 'Спасбросок: Телосложение');
        const r1 = Math.floor(Math.random() * 20) + 1;
        const r2 = hasWarCaster ? (Math.floor(Math.random() * 20) + 1) : r1;
        const best = Math.max(r1, r2);
        const total = best + bonus;
        const ok = total >= chk.dc;

        window._tacConcCheck = null;
        RENDER_CONCENTRATION_POPUP();

        const rollStr = hasWarCaster ? `макс(${r1}, ${r2})=${best}` : `${best}`;
        if (ok) {
            LOG_COMBAT_TO_CHAT(`🔮 Концентрация на «${chk.spell}» УДЕРЖАНА! (${rollStr}${MS(bonus)} = ${total} против Сл ${chk.dc})`);
            showMessage('🔮 Концентрация удержана!', `Бросок Телосложения: <b>${rollStr}${MS(bonus)} = ${total}</b> (нужно ${chk.dc}).<br>Заклинание «<b>${ESC(chk.spell)}</b>» продолжает действовать!`);
        } else {
            c.concentratingSpell = '';
            SC(cs);
            RENDER_MAP_AREA();
            LOG_COMBAT_TO_CHAT(`💥 Концентрация на «${chk.spell}» ПОТЕРЯНА! (${rollStr}${MS(bonus)} = ${total} против Сл ${chk.dc})`);
            showMessage('💥 Концентрация потеряна', `Бросок Телосложения: <b>${rollStr}${MS(bonus)} = ${total}</b> (нужно ${chk.dc}).<br>Заклинание «<b>${ESC(chk.spell)}</b>» рассеялось.`);
        }
    };

    // Отслеживаем получение урона и падение ХП до 0 в реальном времени
    function WATCH_PLAYER_HP_AND_DEATH_SAVES() {
        const sess = GET_SESSION();
        const rc = CUR_ROOM();
        if (!sess || sess.role !== 'player' || !rc) return;
        const cs = GC();
        const c = cs[PI];
        if (!c) return;

        const curHp = c.hp ?? 10;
        const key = `${rc}_${c.id || PI}`;
        const prevHp = window._tacLastHpByHero[key];
        window._tacLastHpByHero[key] = curHp;

        // Автосброс спасбросков от смерти, как только ХП поднялись выше 0
        if (curHp > 0 && c.deathSaves && (c.deathSaves.ok > 0 || c.deathSaves.fail > 0 || c.deathSaves.stable)) {
            c.deathSaves = { ok: 0, fail: 0, stable: false };
            SC(cs);
        }

        if (prevHp !== undefined && curHp < prevHp) {
            const dmg = prevHp - curHp;
            if (curHp <= 0 && c.concentratingSpell) {
                const lost = c.concentratingSpell;
                c.concentratingSpell = '';
                SC(cs);
                window._tacConcCheck = null;
                RENDER_CONCENTRATION_POPUP();
                LOG_COMBAT_TO_CHAT(`💀 теряет сознание — концентрация на «${lost}» прервана.`);
            } else if (curHp > 0 && c.concentratingSpell) {
                window._tacConcCheck = {
                    spell: c.concentratingSpell,
                    dmg,
                    dc: Math.max(10, Math.floor(dmg / 2))
                };
                RENDER_CONCENTRATION_POPUP();
            }
        }
    }

    // ================================================================
    // 5. СПАСБРОСКИ ОТ СМЕРТИ (ПРИ 0 ХП)
    // ================================================================
    window.ROLL_MY_DEATH_SAVE = function() {
        const cs = GC();
        const c = cs[PI];
        if (!c || (c.hp ?? 10) > 0) return;
        if (!c.deathSaves) c.deathSaves = { ok: 0, fail: 0, stable: false };
        if (c.deathSaves.stable || c.deathSaves.fail >= 3) return;

        const d20 = Math.floor(Math.random() * 20) + 1;
        let banner = '';

        if (d20 === 20) {
            c.hp = 1;
            c.deathSaves = { ok: 0, fail: 0, stable: false };
            banner = `🌟 <b>КРИТИЧЕСКИЙ УСПЕХ (20)!</b> Вы приходите в сознание с <b>1 ХП</b>!`;
            LOG_COMBAT_TO_CHAT(`🌟 Спасбросок от смерти: 20! Герой приходит в сознание с 1 ХП!`);
        } else if (d20 === 1) {
            c.deathSaves.fail = Math.min(3, (c.deathSaves.fail || 0) + 2);
            banner = `💀 <b>КРИТИЧЕСКИЙ ПРОВАЛ (1)!</b> +2 провала (всего провалов: ${c.deathSaves.fail}/3).`;
            LOG_COMBAT_TO_CHAT(`💀 Спасбросок от смерти: 1 (Крит. провал! Провалов: ${c.deathSaves.fail}/3)`);
        } else if (d20 >= 10) {
            c.deathSaves.ok = Math.min(3, (c.deathSaves.ok || 0) + 1);
            if (c.deathSaves.ok >= 3) c.deathSaves.stable = true;
            banner = `✅ Выпало <b>${d20}</b> — Успех! (${c.deathSaves.ok}/3)${c.deathSaves.stable ? ' 💚 <b>Вы стабилизированы!</b>' : ''}`;
            LOG_COMBAT_TO_CHAT(`✅ Спасбросок от смерти: ${d20} (Успехов: ${c.deathSaves.ok}/3${c.deathSaves.stable ? ' — СТАБИЛИЗИРОВАН' : ''})`);
        } else {
            c.deathSaves.fail = Math.min(3, (c.deathSaves.fail || 0) + 1);
            banner = `❌ Выпало <b>${d20}</b> — Провал! (${c.deathSaves.fail}/3)${c.deathSaves.fail >= 3 ? ' 💀 <b>Персонаж погиб...</b>' : ''}`;
            LOG_COMBAT_TO_CHAT(`❌ Спасбросок от смерти: ${d20} (Провалов: ${c.deathSaves.fail}/3${c.deathSaves.fail >= 3 ? ' — ПОГИБ' : ''})`);
        }

        SC(cs);
        window._bg3CombatLogBanner = `
            <div style="background:#26181c; border-left:4px solid ${d20>=10 ? '#4cd964' : '#ef4444'}; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#f5e6e8;">
                ${banner}
            </div>`;
        RMC();
        RENDER_MAP_AREA();
    };

    function BUILD_DEATH_SAVES_HTML(c) {
        const ds = c.deathSaves || { ok: 0, fail: 0, stable: false };
        const dots = (cnt, col) => [1, 2, 3].map(n =>
            `<span style="display:inline-block; width:14px; height:14px; border-radius:50%; margin:0 3px; border:2px solid ${col}; background:${n <= cnt ? col : 'transparent'};"></span>`
        ).join('');

        let statusBtn = '';
        if (ds.fail >= 3) {
            statusBtn = `<div style="color:#ef4444; font-weight:bold; font-size:1.05rem;">💀 Персонаж погиб (требуется Возрождение / помощь Мастера)</div>`;
        } else if (ds.stable) {
            statusBtn = `<div style="color:#4cd964; font-weight:bold; font-size:1rem;">💚 Вы стабилизированы (0 ХП, вне опасности)</div>`;
        } else {
            statusBtn = `<button class="btn-danger" style="padding:10px 20px; font-size:1rem;" onclick="ROLL_MY_DEATH_SAVE()">🎲 Бросить спасбросок от смерти (1к20)</button>`;
        }

        return `
            <div style="background:linear-gradient(180deg, #2b1418 0%, #170d10 100%); border:2px solid #ef4444; border-radius:10px; padding:14px; text-align:center;">
                <div style="color:#fca5a5; font-weight:bold; font-size:1.1rem; margin-bottom:10px;">💀 Вы без сознания (0 ХП) — Спасброски от смерти</div>
                <div style="display:flex; justify-content:center; gap:24px; margin-bottom:12px; flex-wrap:wrap; font-size:0.92rem;">
                    <div style="display:flex; align-items:center; gap:6px;"><span style="color:#86efac;">Успехи:</span> ${dots(ds.ok || 0, '#4cd964')}</div>
                    <div style="display:flex; align-items:center; gap:6px;"><span style="color:#fca5a5;">Провалы:</span> ${dots(ds.fail || 0, '#ef4444')}</div>
                </div>
                ${statusBtn}
            </div>
        `;
    }

    // ================================================================
    // 6. КЛАССОВЫЕ РЕСУРСЫ И БАЗОВЫЕ ДЕЙСТВИЯ В БОЕВОМ HUD
    // ================================================================
    function GET_CLASS_ABILITIES_LIST(c) {
        if (!c || !c.className) return [];
        const lv = c.level || 1;
        const cls = c.className;
        const chaM = Math.max(1, GM(c.cha || 10));
        const used = c.classResUsed || {};
        const out = [];

        if (cls === 'Варвар') {
            const max = lv >= 20 ? 99 : (lv >= 17 ? 6 : (lv >= 12 ? 5 : (lv >= 6 ? 4 : (lv >= 3 ? 3 : 2))));
            const dmgB = lv >= 16 ? 4 : (lv >= 9 ? 3 : 2);
            out.push({ key: 'rage', icon: '🔥', name: 'Ярость', max, used: used.rage || 0, cost: 'bonus', rest: 'long', desc: `Сопротивление физ. урону, +${dmgB} к урону вблизи`, cond: 'rage' });
        }
        if (cls === 'Воин') {
            out.push({ key: 'second_wind', icon: '💚', name: 'Второе дыхание', max: 1, used: used.second_wind || 0, cost: 'bonus', rest: 'short', desc: `Лечит 1к10 + ${lv} ХП`, healFormula: `1к10+${lv}` });
            if (lv >= 2) {
                const max = lv >= 17 ? 2 : 1;
                out.push({ key: 'action_surge', icon: '⚡', name: 'Всплеск действий', max, used: used.action_surge || 0, cost: 'free', rest: 'short', desc: '+1 дополнительное Действие прямо сейчас', extraAction: true });
            }
        }
        if (cls === 'Паладин') {
            out.push({ key: 'lay_on_hands', icon: '✨', name: 'Наложение рук (5 ХП)', max: lv * 5, used: used.lay_on_hands || 0, step: 5, cost: 'action', rest: 'long', desc: `Пул ${lv * 5} ХП (исцеляет 5 ХП себе)`, healFixed: 5 });
            if (lv >= 2) {
                out.push({ key: 'smite', icon: '☀️', name: 'Божественная кара', max: 99, used: 0, cost: 'free', rest: 'none', desc: 'Доп. 2к8 излучением по цели (тратит ячейку)', dmgFormula: '2к8' });
            }
        }
        if (cls === 'Плут') {
            const dice = Math.ceil(lv / 2);
            out.push({ key: 'sneak', icon: '🗡️', name: `Скрытая атака (${dice}к6)`, max: 99, used: 0, cost: 'free', rest: 'none', desc: '1/ход при преимуществе или союзнике рядом с целью', dmgFormula: `${dice}к6` });
        }
        if (cls === 'Бард') {
            const die = lv >= 15 ? '1к12' : (lv >= 10 ? '1к10' : (lv >= 5 ? '1к8' : '1к6'));
            out.push({ key: 'bard_insp', icon: '🎵', name: `Вдохновение (${die})`, max: chaM, used: used.bard_insp || 0, cost: 'bonus', rest: lv >= 5 ? 'short' : 'long', desc: `Даёт союзнику +${die} на атаку, проверку или спас` });
        }
        if (cls === 'Монах' && lv >= 2) {
            out.push({ key: 'ki_flurry', icon: '👊', name: 'Шквал ударов (1 Ци)', resKey: 'ki', max: lv, used: used.ki || 0, cost: 'bonus', rest: 'short', desc: '2 безоружных удара бонусным действием' });
            out.push({ key: 'ki_dodge', icon: '☯️', name: 'Терпеливая оборона (1 Ци)', resKey: 'ki', max: lv, used: used.ki || 0, cost: 'bonus', rest: 'short', desc: 'Уклонение бонусным действием', cond: 'dodge' });
        }
        if (cls === 'Жрец' && lv >= 2) {
            const max = lv >= 18 ? 3 : (lv >= 6 ? 2 : 1);
            out.push({ key: 'channel_div', icon: '☀️', name: 'Божественный канал', max, used: used.channel_div || 0, cost: 'action', rest: 'short', desc: 'Изгнание нежити или умение домена' });
        }
        if (cls === 'Друид' && lv >= 2) {
            out.push({ key: 'wild_shape', icon: '🐻', name: 'Дикий облик', max: 2, used: used.wild_shape || 0, cost: 'action', rest: 'short', desc: 'Превращение в зверя' });
        }
        if (cls === 'Чародей' && lv >= 2) {
            out.push({ key: 'sorc_pts', icon: '🔮', name: 'Очки чародейства (Метамагия)', max: lv, used: used.sorc_pts || 0, cost: 'free', rest: 'long', desc: 'Усиление или ускорение заклинаний' });
        }
        if (cls === 'Следопыт') {
            out.push({ key: 'hunter_mark', icon: '🏹', name: 'Урон метки (+1к6)', max: 99, used: 0, cost: 'free', rest: 'none', desc: 'Доп. 1к6 урона по отмеченной цели', dmgFormula: '1к6' });
        }
        return out;
    }

    function ADD_COND_TO_MY_TOKEN(condId) {
        const st = GET_MAP_STATE();
        if (!st || !st.tokens) return;
        const tok = st.tokens.find(t => t.isPlayer && t.charIdx === PI);
        if (!tok) return;
        if (!Array.isArray(tok.conditions)) tok.conditions = [];
        if (!tok.conditions.includes(condId)) {
            tok.conditions.push(condId);
            SAVE_MAP_STATE(st);
        }
    }

    window.TAC_USE_BASIC_ACTION = function(actId) {
        const cs = GC();
        const c = cs[PI];
        if (!c) return;
        const st = GET_MAP_STATE();
        const to = ENSURE_TURN_STATE(st);
        const isCunning = (c.className === 'Плут' && (c.level || 1) >= 2) && ['dash', 'disengage', 'hide'].includes(actId);

        if (isCunning && to.bonusLeft > 0) {
            to.bonusLeft = Math.max(0, to.bonusLeft - 1);
        } else if (to.actionsLeft > 0) {
            to.actionsLeft = 0;
            to.attacksLeft = 0;
        } else {
            return;
        }
        SAVE_MAP_STATE(st);

        const speed = parseInt(c.speed) || 30;
        let msg = '';
        if (actId === 'dash') {
            msg = `🏃 <b>Рывок</b>: скорость в этом ходу увеличена до <b>${speed * 2} фт</b>!`;
            LOG_COMBAT_TO_CHAT(`🏃 использует Рывок (перемещение до ${speed * 2} фт).`);
        } else if (actId === 'dodge') {
            ADD_COND_TO_MY_TOKEN('dodge');
            msg = `🛡️ <b>Уклонение</b>: атаки по вам совершаются с помехой до начала вашего следующего хода.`;
            LOG_COMBAT_TO_CHAT(`🛡️ занимает защитную стойку (Уклонение).`);
        } else if (actId === 'disengage') {
            msg = `💨 <b>Отход</b>: ваше движение в этом ходу не провоцирует атаки.`;
            LOG_COMBAT_TO_CHAT(`💨 совершает Отход (выходит из ближнего боя без провоцированных атак).`);
        } else if (actId === 'help') {
            msg = `🤝 <b>Помощь</b>: вы даёте преимущество союзнику на следующую атаку или проверку.`;
            LOG_COMBAT_TO_CHAT(`🤝 использует действие Помощь для союзника.`);
        } else if (actId === 'hide') {
            const bon = GET_CHAR_CHECK_BONUS(c, 'Скрытность');
            const d20 = Math.floor(Math.random() * 20) + 1;
            const tot = d20 + bon;
            msg = `👤 <b>Засада (Скрытность)</b>: <b>${d20}${MS(bon)} = ${tot}</b>!`;
            LOG_COMBAT_TO_CHAT(`👤 прячется (Скрытность: ${d20}${MS(bon)} = ${tot}).`);
        }

        window._bg3CombatLogBanner = `
            <div style="background:#1c2430; border-left:4px solid #38bdf8; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#e0f2fe;">
                ${msg}
            </div>`;
        RENDER_MAP_AREA();
    };

    window.TAC_USE_CLASS_ABILITY = function(abKey) {
        const cs = GC();
        const c = cs[PI];
        if (!c) return;
        const list = GET_CLASS_ABILITIES_LIST(c);
        const ab = list.find(x => x.key === abKey);
        if (!ab) return;

        const st = GET_MAP_STATE();
        const to = ENSURE_TURN_STATE(st);
        if (ab.cost === 'action' && to.actionsLeft <= 0) return;
        if (ab.cost === 'bonus' && to.bonusLeft <= 0) return;

        const rKey = ab.resKey || ab.key;
        const step = ab.step || 1;
        if (!c.classResUsed) c.classResUsed = {};
        if (ab.max < 99 && ((c.classResUsed[rKey] || 0) + step) > ab.max) return;

        if (ab.cost === 'action') { to.actionsLeft = 0; to.attacksLeft = 0; }
        if (ab.cost === 'bonus') to.bonusLeft = Math.max(0, to.bonusLeft - 1);
        if (ab.extraAction) {
            to.actionsLeft = (to.actionsLeft || 0) + 1;
            to.attacksLeft = (to.attacksLeft || 0) + (typeof GET_MAX_ATTACKS_PER_ACTION === 'function' ? GET_MAX_ATTACKS_PER_ACTION(c) : 1);
        }
        if (ab.max < 99) c.classResUsed[rKey] = (c.classResUsed[rKey] || 0) + step;

        let info = `${ab.icon} <b>${ab.name}</b> — ${ab.desc}`;
        if (ab.healFormula || ab.healFixed) {
            const heal = ab.healFixed || Math.max(1, ROLL(ab.healFormula));
            c.hp = Math.min(c.maxHp || 10, (c.hp ?? 10) + heal);
            info = `${ab.icon} <b>${ab.name}</b>: восстановлено <b style="color:#4cd964;">+${heal} ХП</b> (теперь ${c.hp}/${c.maxHp}).`;
        } else if (ab.dmgFormula) {
            const dmg = Math.max(1, ROLL(ab.dmgFormula));
            const targetTok = st.tokens && st.tokens[window._bg3SelectedTargetIdx];
            if (targetTok && targetTok.hp > 0) {
                targetTok.hp = Math.max(0, targetTok.hp - dmg);
                if (targetTok.isPlayer && cs[targetTok.charIdx]) cs[targetTok.charIdx].hp = targetTok.hp;
                info = `${ab.icon} <b>${ab.name}</b> по «<b>${ESC(targetTok.name)}</b>»: доп. урон <b style="color:#facc15;">+${dmg}</b> (осталось ${targetTok.hp}/${targetTok.maxHp} ХП).`;
            } else {
                info = `${ab.icon} <b>${ab.name}</b>: бросок доп. урона <b style="color:#facc15;">+${dmg}</b> (${ab.dmgFormula}).`;
            }
        }

        if (ab.cond) ADD_COND_TO_MY_TOKEN(ab.cond);

        SC(cs);
        SAVE_MAP_STATE(st);
        LOG_COMBAT_TO_CHAT(info.replace(/<[^>]+>/g, ''));
        window._bg3CombatLogBanner = `
            <div style="background:#231b33; border-left:4px solid #c084fc; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#f3e8ff;">
                ${info}
            </div>`;
        RMC();
        RENDER_MAP_AREA();
    };

    // Сброс классовых ресурсов и спасбросков от смерти на Коротком / Длинном отдыхе
    const _ORIG_DSR_TAC = window.DSR;
    if (typeof _ORIG_DSR_TAC === 'function') {
        window.DSR = function() {
            _ORIG_DSR_TAC();
            const cs = GC();
            const c = cs[PI];
            if (!c || !c.classResUsed) return;
            GET_CLASS_ABILITIES_LIST(c).forEach(ab => {
                if (ab.rest === 'short') c.classResUsed[ab.resKey || ab.key] = 0;
            });
            SC(cs);
        };
    }

    const _ORIG_LONG_REST_TAC = window.EXECUTE_LONG_REST_FOR_PARTY;
    if (typeof _ORIG_LONG_REST_TAC === 'function') {
        window.EXECUTE_LONG_REST_FOR_PARTY = function() {
            _ORIG_LONG_REST_TAC();
            const rc = CUR_ROOM();
            const cs = GC();
            const idxs = (typeof GET_ROOM_PARTY_INDICES === 'function') ? GET_ROOM_PARTY_INDICES(rc) : cs.map((_, i) => i);
            idxs.forEach(i => {
                if (!cs[i]) return;
                const clearFn = (ch) => {
                    ch.classResUsed = {};
                    ch.deathSaves = { ok: 0, fail: 0, stable: false };
                    ch.concentratingSpell = '';
                };
                if (typeof MUTATE_HERO_IN_ROOM === 'function') MUTATE_HERO_IN_ROOM(cs[i], rc, clearFn);
                else clearFn(cs[i]);
            });
            SC(cs);
        };
    }

    // ================================================================
    // 7. ХУКИ В RENDER_MAP_AREA, RENDER_BG3_COMBAT_HUD И RMC
    // ================================================================
    const _ORIG_RMC_TAC = window.RMC;
    window.RMC = function() {
        _ORIG_RMC_TAC();
        WATCH_PLAYER_HP_AND_DEATH_SAVES();
    };

    const _ORIG_RENDER_MAP_TAC = window.RENDER_MAP_AREA;
    window.RENDER_MAP_AREA = function() {
        _ORIG_RENDER_MAP_TAC();
        ENSURE_TACTICS_CSS();
        BIND_MAP_TACTICS_EVENTS();
        INJECT_TOKEN_CONDITION_BADGES();
        DRAW_TACTICS_SVG();

        const mapArea = document.getElementById('map-area');
        const sess = GET_SESSION();
        const st = GET_MAP_STATE();
        const vn = (typeof GET_ACTIVE_VN_DIALOG === 'function') ? GET_ACTIVE_VN_DIALOG() : null;
        const isGM = sess && sess.role === 'gm';
        const isFullFog = (st.fogMode === 'full' && !isGM);
        const myIdx = (sess && sess.role === 'player') ? (sess.playerIdx || 0) : -1;
        const showVN = !!(vn && vn.active && (isGM || !(vn.leftPlayers || []).includes(myIdx)));

        if (mapArea && sess && !isFullFog && !showVN) {
            let bar = document.getElementById('tactics-map-toolbar');
            if (!bar) {
                bar = document.createElement('div');
                bar.id = 'tactics-map-toolbar';
                bar.setAttribute('data-tactics-ui', '1');
                bar.style.cssText = 'position:absolute; bottom:8px; left:8px; z-index:12; background:rgba(15,14,13,0.92); border:1px solid #423c33; border-radius:10px; padding:5px 7px; box-shadow:0 4px 14px rgba(0,0,0,0.85);';
                bar.addEventListener('mousedown', e => e.stopPropagation());
                bar.addEventListener('click', e => e.stopPropagation());
                bar.addEventListener('dblclick', e => e.stopPropagation());
                mapArea.appendChild(bar);
            }
            UPDATE_TACTICS_TOOLBAR();
            if (window._tacTool !== 'none') mapArea.style.cursor = 'crosshair';
        }
    };

    const _ORIG_BG3_HUD_TAC = window.RENDER_BG3_COMBAT_HUD;
    if (typeof _ORIG_BG3_HUD_TAC === 'function') {
        window.RENDER_BG3_COMBAT_HUD = function() {
            _ORIG_BG3_HUD_TAC();
            const sess = GET_SESSION();
            if (!sess || sess.role !== 'player') return;
            const hud = document.getElementById('bg3-player-combat-hud');
            if (!hud) return;

            const cs = GC();
            const c = cs[PI];
            if (!c) return;

            // 1. Если ХП = 0, показываем панель Спасбросков от смерти
            if ((c.hp ?? 10) <= 0) {
                hud.innerHTML = `<div style="margin-top:12px;">${window._bg3CombatLogBanner || ''}${BUILD_DEATH_SAVES_HTML(c)}</div>`;
                return;
            }

            if (!c.inCombat) return;

            // 2. Индикатор активной Концентрации в шапке HUD
            if (c.concentratingSpell) {
                const topRow = hud.querySelector('div > div');
                if (topRow) {
                    const concBadge = document.createElement('div');
                    concBadge.style.cssText = 'margin-top:6px; padding:4px 9px; background:#241936; border:1px solid #a855f7; border-radius:6px; display:inline-flex; align-items:center; gap:8px; font-size:0.82rem; color:#e9d5ff;';
                    concBadge.innerHTML = `<span>🔮 Концентрация: <b>${ESC(c.concentratingSpell)}</b></span><button class="btn-small btn-danger" style="padding:1px 6px; font-size:0.74rem;" onclick="DROP_MY_CONCENTRATION()">✕</button>`;
                    topRow.after(concBadge);
                }
            }

            // 3. Добавляем вкладки «🏃 Действия» и «⚡ Класс» в боевой хотбар
            const wepBtn = hud.querySelector("button[onclick*=\"'weapons'\"]");
            if (!wepBtn || !wepBtn.parentElement) return;
            const tabRow = wepBtn.parentElement;
            const hotbar = tabRow.nextElementSibling;
            if (!hotbar) return;

            const cat = window._bg3HotbarCategory || 'weapons';
            const mkTab = (code, label) => {
                const b = document.createElement('button');
                b.className = 'btn-small';
                b.style.cssText = `background:${cat===code ? '#c9a96e' : '#26231f'}; color:${cat===code ? '#141210' : '#ccc'};`;
                b.textContent = label;
                b.onclick = () => { window._bg3HotbarCategory = code; RENDER_BG3_COMBAT_HUD(); };
                tabRow.appendChild(b);
            };
            mkTab('actions', '🏃 Действия');
            mkTab('class', '⚡ Класс');

            const st = GET_MAP_STATE();
            const to = ENSURE_TURN_STATE(st);
            const tokens = st.tokens || [];
            const activeTok = tokens.length ? tokens[(to.currentIdx || 0) % tokens.length] : null;
            const isMyTurn = !tokens.length || (activeTok && activeTok.isPlayer && activeTok.charIdx === PI);

            if (cat === 'actions') {
                const isCunning = (c.className === 'Плут' && (c.level || 1) >= 2);
                const acts = [
                    { id: 'dash',      icon: '🏃', name: 'Рывок',     sub: isCunning ? '🔶 Бонус / 🟢 Действ.' : '🟢 Действие', cunning: true },
                    { id: 'dodge',     icon: '🛡️', name: 'Уклонение', sub: '🟢 Действие (помеха врагам)', cunning: false },
                    { id: 'disengage', icon: '💨', name: 'Отход',     sub: isCunning ? '🔶 Бонус / 🟢 Действ.' : '🟢 Действие', cunning: true },
                    { id: 'help',      icon: '🤝', name: 'Помощь',    sub: '🟢 Действие (преим. союзнику)', cunning: false },
                    { id: 'hide',      icon: '👤', name: 'Засада',    sub: isCunning ? '🔶 Бонус (бросок Скрытности)' : '🟢 Действие (Скрытность)', cunning: true }
                ];
                hotbar.innerHTML = acts.map(a => {
                    const ok = isMyTurn && ((isCunning && a.cunning && to.bonusLeft > 0) || to.actionsLeft > 0);
                    return `
                        <button class="btn-cast" ${!ok ? 'disabled style="opacity:0.45;"' : ''} onclick="TAC_USE_BASIC_ACTION('${a.id}')"
                            style="padding:7px 11px; display:flex; flex-direction:column; align-items:flex-start; gap:2px; min-width:130px; background:#1c2430; border:1px solid #38bdf8;">
                            <span style="font-weight:bold; color:#e0f2fe;">${a.icon} ${a.name}</span>
                            <small style="color:#93c5fd;">${a.sub}</small>
                        </button>`;
                }).join('');
            } else if (cat === 'class') {
                const abs = GET_CLASS_ABILITIES_LIST(c);
                if (!abs.length) {
                    hotbar.innerHTML = '<span style="color:#777; font-size:0.85rem;">Для этого класса/уровня пока нет активных ресурсов</span>';
                } else {
                    hotbar.innerHTML = abs.map(ab => {
                        const left = ab.max < 99 ? Math.max(0, ab.max - ab.used) : '∞';
                        const hasRes = ab.max >= 99 || left >= (ab.step || 1);
                        const costOk = ab.cost === 'free' || (ab.cost === 'bonus' ? to.bonusLeft > 0 : to.actionsLeft > 0);
                        const canUse = isMyTurn && hasRes && costOk;
                        const costTag = ab.cost === 'free' ? '⚪ Свободное' : (ab.cost === 'bonus' ? '🔶 Бонус' : '🟢 Действие');
                        return `
                            <button class="btn-cast" ${!canUse ? 'disabled style="opacity:0.45;"' : ''} title="${ESC(ab.desc)}" onclick="TAC_USE_CLASS_ABILITY('${ab.key}')"
                                style="padding:7px 11px; display:flex; flex-direction:column; align-items:flex-start; gap:2px; min-width:145px; background:#241936; border:1px solid #a855f7;">
                                <span style="font-weight:bold; color:#f3e8ff;">${ab.icon} ${ESC(ab.name)} ${ab.max < 99 ? `(${left}/${ab.max})` : ''}</span>
                                <small style="color:#c4b5fd;">${costTag}</small>
                            </button>`;
                    }).join('');
                }
            }
        };
    }

    // Привязка к смене комнаты и роли
    if (typeof window.SWITCH_FIREBASE_ROOM === 'function') {
        const _ORIG_SW_TAC = window.SWITCH_FIREBASE_ROOM;
        window.SWITCH_FIREBASE_ROOM = function(rc) {
            const r = _ORIG_SW_TAC(rc);
            SYNC_TACTICS_FOR_ROOM(rc);
            return r;
        };
    }

    const _ORIG_APPLY_TAC = window.APPLY_ROLE_VIEW;
    window.APPLY_ROLE_VIEW = function() {
        _ORIG_APPLY_TAC();
        SYNC_TACTICS_FOR_ROOM(CUR_ROOM());
    };

    SYNC_TACTICS_FOR_ROOM(CUR_ROOM());
    if (CUR_ROOM()) RENDER_MAP_AREA();
})();