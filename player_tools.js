// ================================================================
// 🎲 ПЛАВАЮЩАЯ ПАНЕЛЬ БРОСКОВ (НАВЫКИ, СПАСЫ, КУБЫ), ОБМЕН ПРЕДМЕТАМИ/ЗОЛОТОМ
// И ЛИЧНЫЙ БЛОКНОТ ИГРОКА (player_tools.js)
// ================================================================
(function INIT_PLAYER_TOOLS_V2() {
    const FB_ROOMS_URL = "https://dnds-23b7d-default-rtdb.firebaseio.com/campaign_v2/rooms";

    const STATS_META = [
        { name: 'Сила',         short: 'Сил', field: 'str',  saveKey: 'strength' },
        { name: 'Ловкость',     short: 'Лов', field: 'dex',  saveKey: 'dexterity' },
        { name: 'Телосложение', short: 'Тел', field: 'con',  saveKey: 'constitution' },
        { name: 'Интеллект',    short: 'Инт', field: 'intl', saveKey: 'intelligence' },
        { name: 'Мудрость',     short: 'Муд', field: 'wis',  saveKey: 'wisdom' },
        { name: 'Харизма',      short: 'Хар', field: 'cha',  saveKey: 'charisma' }
    ];

    const SKILL_STAT_HINT = {
        'Атлетика': 'Сил',
        'Акробатика': 'Лов', 'Ловкость рук': 'Лов', 'Скрытность': 'Лов',
        'Магия': 'Инт', 'История': 'Инт', 'Расследование': 'Инт', 'Природа': 'Инт', 'Религия': 'Инт',
        'Обращение с животными': 'Муд', 'Проницательность': 'Муд', 'Медицина': 'Муд', 'Восприятие': 'Муд', 'Выживание': 'Муд',
        'Обман': 'Хар', 'Запугивание': 'Хар', 'Выступление': 'Хар', 'Убеждение': 'Хар'
    };

    window._ptRollDrawerOpen = false;
    window._ptRollTab = 'skills';     // 'skills' | 'stats' | 'dice'
    window._ptRollMode = 'normal';    // 'normal' | 'adv' | 'dis'
    window._ptRollSecret = false;
    window._ptSkillQuery = '';
    window._ptLastRoll = null;        // { title, total, detail, color }
    window._playerDiceHistory = [];
    window._playerNoteTab = 'general';
    window._playerNotesCache = {};

    let noteSaveTimer = null;

    function ESC(s) {
        return String(s || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function ESC_JS(s) {
        return String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    }

    function CUR_ROOM() {
        const s = (typeof GET_SESSION === 'function') ? GET_SESSION() : null;
        return (s && s.roomCode) ? String(s.roomCode) : null;
    }

    function FORMAT_MOD(n) {
        return (typeof MS === 'function') ? MS(n) : ((n >= 0 ? '+' : '') + n);
    }

    function ENSURE_TOOLS_CSS() {
        if (document.getElementById('player-tools-css-v2')) return;
        const st = document.createElement('style');
        st.id = 'player-tools-css-v2';
        st.textContent = `
            #pt-roll-drawer {
                position: fixed;
                top: 94px;
                left: 14px;
                width: 344px;
                max-width: calc(100vw - 28px);
                max-height: calc(100vh - 110px);
                background: var(--ui-panel, #221f1c);
                border: 2px solid var(--ui-border-strong, #695c4c);
                border-radius: 12px;
                box-shadow: 0 14px 38px rgba(0, 0, 0, 0.72);
                z-index: 93500;
                display: none;
                flex-direction: column;
                overflow: hidden;
                color: var(--ui-text, #e5e0d7);
            }
            .pt-skill-row {
                width: 100%;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
                padding: 7px 10px;
                margin-bottom: 5px;
                border-radius: 8px;
                background: var(--ui-panel2, #161412);
                color: var(--ui-text, #e5e0d7);
                border: 1px solid var(--ui-border, #3e372f);
                cursor: pointer;
                text-align: left;
                font-size: 0.88rem;
                font-weight: 500;
                box-shadow: none;
                transition: border-color 0.14s, background 0.14s;
            }
            .pt-skill-row:hover {
                border-color: var(--ui-accent, #d2b278);
                filter: brightness(1.06);
            }
            .pt-skill-row.is-prof {
                border-color: var(--ui-border-strong, #695c4c);
            }
            .pt-mod-pill {
                min-width: 38px;
                text-align: center;
                padding: 2px 7px;
                border-radius: 6px;
                font-weight: 700;
                font-size: 0.86rem;
                background: var(--ui-panel, #221f1c);
                color: var(--ui-accent, #d2b278);
                border: 1px solid var(--ui-border, #3e372f);
                flex-shrink: 0;
            }
            @media (max-width: 980px) {
                #pt-roll-drawer {
                    top: auto;
                    left: 8px;
                    right: 8px;
                    bottom: 66px;
                    width: auto;
                    max-width: none;
                    max-height: 76vh;
                }
            }
        `;
        document.head.appendChild(st);
    }

    function ROLL_DETAILED_FORMULA(rawFormula) {
        const clean = String(rawFormula || '1к20')
            .toLowerCase()
            .replace(/\s+/g, '')
            .replace(/[dд]/g, 'к');
        const m = clean.match(/^(\d*)к(\d+)([+-]\d+)?$/);
        if (!m) {
            const fallback = (typeof ROLL === 'function') ? ROLL(clean) : (Math.floor(Math.random() * 20) + 1);
            return { formula: clean, rolls: [fallback], mod: 0, total: fallback, sides: 20, count: 1 };
        }
        const count = Math.max(1, Math.min(30, parseInt(m[1] || '1', 10)));
        const sides = Math.max(2, Math.min(1000, parseInt(m[2], 10)));
        const mod = m[3] ? parseInt(m[3], 10) : 0;
        const rolls = [];
        let sum = 0;
        for (let i = 0; i < count; i++) {
            const r = Math.floor(Math.random() * sides) + 1;
            rolls.push(r);
            sum += r;
        }
        return { formula: `${count}к${sides}${mod ? (mod > 0 ? '+' + mod : mod) : ''}`, rolls, mod, total: sum + mod, sides, count };
    }

    // ================================================================
    // 1. ПЛАВАЮЩАЯ ПАНЕЛЬ БРОСКОВ (НЕ ПЕРЕКРЫВАЕТ КАРТУ И ЧАТ!)
    // ================================================================
    function ENSURE_ROLL_DRAWER() {
        ENSURE_TOOLS_CSS();
        let el = document.getElementById('pt-roll-drawer');
        if (!el) {
            el = document.createElement('div');
            el.id = 'pt-roll-drawer';
            document.body.appendChild(el);
        }
        return el;
    }

    window.TOGGLE_PLAYER_ROLL_DRAWER = function(tab) {
        const sess = GET_SESSION();
        if (!sess || sess.role !== 'player') return;
        if (tab) {
            window._ptRollTab = tab;
            window._ptRollDrawerOpen = true;
        } else {
            window._ptRollDrawerOpen = !window._ptRollDrawerOpen;
        }
        RENDER_ROLL_DRAWER();
    };

    window.CLOSE_PLAYER_ROLL_DRAWER = function() {
        window._ptRollDrawerOpen = false;
        const el = document.getElementById('pt-roll-drawer');
        if (el) el.style.display = 'none';
    };

    // Обратная совместимость, если что-то вызовет старое имя функции
    window.OPEN_PLAYER_DICE_MODAL = function() {
        window.TOGGLE_PLAYER_ROLL_DRAWER('dice');
    };

    window.SET_PT_ROLL_TAB = function(tab) {
        window._ptRollTab = tab;
        RENDER_ROLL_DRAWER();
    };

    window.SET_PT_ROLL_MODE = function(mode) {
        window._ptRollMode = mode;
        RENDER_ROLL_DRAWER();
    };

    window.EXECUTE_QUICK_CHECK = function(kind, name) {
        const cs = GC();
        const c = cs[PI];
        if (!c) return;

        let bonus = 0;
        let label = name;

        if (kind === 'skill') {
            bonus = (typeof GET_CHAR_CHECK_BONUS === 'function') ? GET_CHAR_CHECK_BONUS(c, name) : 0;
            label = name;
        } else if (kind === 'save') {
            bonus = (typeof GET_CHAR_CHECK_BONUS === 'function')
                ? GET_CHAR_CHECK_BONUS(c, 'Спасбросок: ' + name)
                : GM(c[STATS_META.find(x => x.name === name)?.field || 'str'] || 10);
            label = `Спас: ${name}`;
        } else if (kind === 'init') {
            bonus = GM(c.dex || 10) + (parseInt(c.initiativeBonus) || 0);
            label = 'Инициатива';
        } else {
            const field = STATS_META.find(x => x.name === name)?.field || 'str';
            bonus = GM(c[field] || 10);
            label = `Проверка: ${name}`;
        }

        // Проверяем заряженное Вдохновение (session.js)
        let mode = window._ptRollMode || 'normal';
        let usedInsp = false;
        if (window._inspArmed && typeof GET_INSPIRATION_COUNT === 'function' && GET_INSPIRATION_COUNT(c) > 0) {
            c.inspiration = GET_INSPIRATION_COUNT(c) - 1;
            window._inspArmed = false;
            SC(cs);
            RMC();
            mode = 'adv';
            usedInsp = true;
        }

        const r1 = Math.floor(Math.random() * 20) + 1;
        const r2 = (mode === 'adv' || mode === 'dis') ? (Math.floor(Math.random() * 20) + 1) : r1;
        const d20 = mode === 'adv' ? Math.max(r1, r2) : (mode === 'dis' ? Math.min(r1, r2) : r1);
        const total = d20 + bonus;

        const modStr = FORMAT_MOD(bonus);
        const rollPart = (mode === 'normal')
            ? `${d20}`
            : `${mode === 'adv' ? 'Преим.' : 'Помеха'} [${r1}, ${r2}] → ${d20}`;
        const inspPrefix = usedInsp ? '⭐ ' : '';
        const critTag = d20 === 20 ? ' • 🌟 Нат. 20!' : (d20 === 1 ? ' • 💀 Нат. 1!' : '');
        const color = d20 === 20 ? '#6cb878' : (d20 === 1 ? '#d66565' : 'var(--ui-accent, #d2b278)');
        const detail = `${rollPart} ${modStr} = ${total}${critTag}`;

        window._ptLastRoll = {
            title: `${inspPrefix}${label}`,
            total,
            detail: `${detail}${window._ptRollSecret ? ' (скрыто)' : ''}`,
            color
        };

        window._playerDiceHistory.unshift({ label: `${inspPrefix}${label}`, res: detail, secret: !!window._ptRollSecret });
        if (window._playerDiceHistory.length > 15) window._playerDiceHistory.pop();

        if (!window._ptRollSecret && CUR_ROOM()) {
            LOG_COMBAT_TO_CHAT(`${inspPrefix}🎲 ${label}: ${rollPart} ${modStr} = ${total}${critTag}`);
        }

        RENDER_ROLL_DRAWER();
    };

    window.PLAYER_ROLL_DICE = function(formula, mode = 'normal') {
        const clean = String(formula || '').trim();
        if (!clean) return;

        let total = 0, detail = '', label = clean;
        if (mode === 'adv' || mode === 'dis') {
            const r1 = Math.floor(Math.random() * 20) + 1;
            const r2 = Math.floor(Math.random() * 20) + 1;
            total = mode === 'adv' ? Math.max(r1, r2) : Math.min(r1, r2);
            label = mode === 'adv' ? '1к20 (Преим.)' : '1к20 (Помеха)';
            detail = `[${r1}, ${r2}] → ${total}`;
        } else {
            const res = ROLL_DETAILED_FORMULA(clean);
            total = res.total;
            label = res.formula;
            const diceStr = res.rolls.length > 1 ? `[${res.rolls.join(' + ')}]` : `${res.rolls[0]}`;
            const modStr = res.mod ? (res.mod > 0 ? ` + ${res.mod}` : ` − ${Math.abs(res.mod)}`) : '';
            detail = `${diceStr}${modStr} = ${total}`;
        }

        window._ptLastRoll = {
            title: `🎲 ${label}`,
            total,
            detail: `${detail}${window._ptRollSecret ? ' (скрыто)' : ''}`,
            color: 'var(--ui-accent, #d2b278)'
        };

        window._playerDiceHistory.unshift({ label, res: detail, secret: !!window._ptRollSecret });
        if (window._playerDiceHistory.length > 15) window._playerDiceHistory.pop();

        if (!window._ptRollSecret && CUR_ROOM()) {
            LOG_COMBAT_TO_CHAT(`🎲 Бросок ${label}: ${detail}`);
        }

        RENDER_ROLL_DRAWER();
    };

    function BUILD_SKILLS_LIST_HTML(c) {
        const allSkills = (typeof gameData !== 'undefined' && Array.isArray(gameData.allSkills))
            ? gameData.allSkills
            : Object.keys(SKILL_STAT_HINT);
        const autoSkills = (typeof GAS === 'function') ? GAS(c) : [];
        const chosenSkills = c.chosenSkills || [];
        const expSkills = c.expertiseSkills || [];
        const q = (window._ptSkillQuery || '').toLowerCase().trim();

        const enriched = allSkills.map(name => {
            const isProf = autoSkills.includes(name) || chosenSkills.includes(name);
            const isExp = expSkills.includes(name);
            const bonus = (typeof GET_CHAR_CHECK_BONUS === 'function') ? GET_CHAR_CHECK_BONUS(c, name) : 0;
            return { name, isProf, isExp, bonus, stat: SKILL_STAT_HINT[name] || '' };
        });

        const renderRow = (sk) => {
            const star = sk.isExp ? '★★ ' : (sk.isProf ? '★ ' : '');
            return `
                <button data-custom-bg="1" class="pt-skill-row ${sk.isProf ? 'is-prof' : ''}" onclick="EXECUTE_QUICK_CHECK('skill', '${ESC_JS(sk.name)}')">
                    <span>
                        <span style="color:var(--ui-accent, #d2b278);">${star}</span>${ESC(sk.name)}
                        <small style="color:var(--ui-muted, #9a9286); font-size:0.76rem !important;">(${sk.stat})</small>
                    </span>
                    <span class="pt-mod-pill">${FORMAT_MOD(sk.bonus)}</span>
                </button>`;
        };

        if (q) {
            const found = enriched.filter(sk => sk.name.toLowerCase().includes(q) || sk.stat.toLowerCase().includes(q));
            if (!found.length) return `<div style="text-align:center; padding:18px; color:var(--ui-muted, #888); font-size:0.86rem;">Навык не найден</div>`;
            return found.map(renderRow).join('');
        }

        const profList = enriched.filter(sk => sk.isProf);
        const otherList = enriched.filter(sk => !sk.isProf);

        let html = '';
        if (profList.length) {
            html += `<div style="font-size:0.76rem; color:var(--ui-accent, #d2b278); font-weight:700; margin:4px 0 5px 2px;">★ Владение (сильные навыки)</div>`;
            html += profList.map(renderRow).join('');
            html += `<div style="font-size:0.76rem; color:var(--ui-muted, #888); font-weight:600; margin:10px 0 5px 2px;">Остальные навыки</div>`;
        }
        html += otherList.map(renderRow).join('');
        return html;
    }

    window.PT_FILTER_SKILLS_ONLY = function(val) {
        window._ptSkillQuery = val || '';
        const box = document.getElementById('pt-skills-list-body');
        const cs = GC();
        const c = cs[PI];
        if (box && c) box.innerHTML = BUILD_SKILLS_LIST_HTML(c);
    };

    function RENDER_ROLL_DRAWER() {
        const el = ENSURE_ROLL_DRAWER();
        const sess = GET_SESSION();
        if (!window._ptRollDrawerOpen || !sess || sess.role !== 'player') {
            el.style.display = 'none';
            return;
        }

        const cs = GC();
        const c = cs[PI];
        if (!c) { el.style.display = 'none'; return; }

        el.style.display = 'flex';
        const tab = window._ptRollTab || 'skills';
        const mode = window._ptRollMode || 'normal';
        const initBon = GM(c.dex || 10) + (parseInt(c.initiativeBonus) || 0);
        const inspCnt = (typeof GET_INSPIRATION_COUNT === 'function') ? GET_INSPIRATION_COUNT(c) : 0;

        // Вкладки
        const tabBtn = (id, label) => {
            const act = (tab === id);
            return `
                <button data-custom-bg="1" onclick="SET_PT_ROLL_TAB('${id}')"
                    style="flex:1; padding:7px 4px; font-size:0.82rem; font-weight:600; border-radius:7px; cursor:pointer; box-shadow:none; background:${act ? 'var(--ui-panel, #221f1c)' : 'transparent'}; color:${act ? 'var(--ui-accent, #d2b278)' : 'var(--ui-muted, #9a9286)'}; border:1px solid ${act ? 'var(--ui-border-strong, #695c4c)' : 'transparent'};">
                    ${label}
                </button>`;
        };

        // Полоска режима 1к20 / Преимущество / Помеха
        const modeBtn = (m, label) => {
            const act = (mode === m);
            return `
                <button data-custom-bg="1" onclick="SET_PT_ROLL_MODE('${m}')"
                    style="flex:1; padding:5px 4px; font-size:0.78rem; font-weight:600; border-radius:6px; cursor:pointer; box-shadow:none; background:${act ? 'var(--ui-btn-bg, #c8a66a)' : 'var(--ui-panel2, #161412)'}; color:${act ? 'var(--ui-btn-text, #1a150f)' : 'var(--ui-text, #e5e0d7)'}; border:1px solid ${act ? 'var(--ui-accent, #d2b278)' : 'var(--ui-border, #3e372f)'};">
                    ${label}
                </button>`;
        };

        // Последний результат броска (живой, прямо перед глазами)
        const last = window._ptLastRoll;
        const resultStripHTML = last ? `
            <div style="margin:0 10px 8px 10px; padding:8px 11px; background:var(--ui-panel2, #161412); border:1px solid var(--ui-border-strong, #695c4c); border-left:4px solid ${last.color}; border-radius:8px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
                <div style="min-width:0;">
                    <div style="font-size:0.84rem; font-weight:700; color:var(--ui-accent, #d2b278); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ESC(last.title)}</div>
                    <div style="font-size:0.76rem; color:var(--ui-muted, #aaa);">${ESC(last.detail)}</div>
                </div>
                <div style="font-size:1.5rem; font-weight:800; color:${last.color}; flex-shrink:0;">${last.total}</div>
            </div>
        ` : '';

        let bodyHTML = '';

        if (tab === 'skills') {
            bodyHTML = `
                <button class="btn-cast" style="width:100%; padding:8px 10px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;" onclick="EXECUTE_QUICK_CHECK('init', 'Инициатива')">
                    <span>⚡ Бросить Инициативу</span>
                    <span style="font-weight:bold;">${FORMAT_MOD(initBon)}</span>
                </button>
                <input type="text" id="pt-skill-search" value="${ESC(window._ptSkillQuery || '')}"
                    oninput="PT_FILTER_SKILLS_ONLY(this.value)"
                    placeholder="🔍 Поиск навыка (напр. восприятие)..."
                    style="width:100%; padding:7px 10px; margin-bottom:8px; text-align:left; font-size:0.84rem; border-radius:7px; background:var(--ui-input-bg, #131110); color:var(--ui-text, #e5e0d7); border:1px solid var(--ui-border, #3e372f);">
                <div id="pt-skills-list-body">
                    ${BUILD_SKILLS_LIST_HTML(c)}
                </div>
            `;
        } else if (tab === 'stats') {
            const cst = (typeof GCST === 'function') ? GCST(c) : {};
            const rowsHTML = STATS_META.map(sm => {
                const score = c[sm.field] || 10;
                const checkBon = GM(score);
                const saveBon = (typeof GET_CHAR_CHECK_BONUS === 'function') ? GET_CHAR_CHECK_BONUS(c, 'Спасбросок: ' + sm.name) : checkBon;
                const saveProf = !!cst[sm.saveKey];
                return `
                    <div style="display:flex; align-items:center; justify-content:space-between; gap:6px; padding:7px 9px; margin-bottom:6px; background:var(--ui-panel2, #161412); border:1px solid var(--ui-border, #3e372f); border-radius:8px;">
                        <div style="min-width:110px;">
                            <div style="font-weight:700; font-size:0.88rem;">${sm.name}</div>
                            <small style="color:var(--ui-muted, #9a9286); font-size:0.75rem !important;">Значение: ${score}</small>
                        </div>
                        <div style="display:flex; gap:5px;">
                            <button data-custom-bg="1" class="btn-small" onclick="EXECUTE_QUICK_CHECK('stat', '${sm.name}')"
                                style="padding:5px 8px; font-size:0.78rem; background:var(--ui-panel, #221f1c); color:var(--ui-text, #e5e0d7); border:1px solid var(--ui-border, #3e372f); box-shadow:none;">
                                Проверка <b style="color:var(--ui-accent, #d2b278);">${FORMAT_MOD(checkBon)}</b>
                            </button>
                            <button data-custom-bg="1" class="btn-small" onclick="EXECUTE_QUICK_CHECK('save', '${sm.name}')"
                                style="padding:5px 8px; font-size:0.78rem; background:var(--ui-panel, #221f1c); color:var(--ui-text, #e5e0d7); border:1px solid ${saveProf ? 'var(--ui-accent, #d2b278)' : 'var(--ui-border, #3e372f)'}; box-shadow:none;">
                                ${saveProf ? '★ ' : ''}Спас <b style="color:var(--ui-accent, #d2b278);">${FORMAT_MOD(saveBon)}</b>
                            </button>
                        </div>
                    </div>`;
            }).join('');

            bodyHTML = `
                <button class="btn-cast" style="width:100%; padding:8px 10px; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;" onclick="EXECUTE_QUICK_CHECK('init', 'Инициатива')">
                    <span>⚡ Бросить Инициативу</span>
                    <span style="font-weight:bold;">${FORMAT_MOD(initBon)}</span>
                </button>
                ${rowsHTML}
            `;
        } else {
            const diceList = ['1к4', '1к6', '1к8', '1к10', '1к12', '1к20', '2к6', '1к100'];
            const diceGrid = diceList.map(d =>
                `<button class="btn-small" style="padding:8px 4px; font-size:0.86rem;" onclick="PLAYER_ROLL_DICE('${d}', 'normal')">🎲 ${d}</button>`
            ).join('');

            const histHtml = (window._playerDiceHistory || []).slice(0, 6).map(h =>
                `<div style="display:flex; justify-content:space-between; gap:6px; padding:4px 6px; border-bottom:1px dashed var(--ui-border, #333); font-size:0.78rem;">
                    <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${ESC(h.label)}${h.secret ? ' 🤫' : ''}</span>
                    <b style="color:var(--ui-accent, #d2b278); flex-shrink:0;">${ESC(h.res)}</b>
                </div>`
            ).join('');

            bodyHTML = `
                <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:6px; margin-bottom:10px;">
                    ${diceGrid}
                </div>
                <div style="display:flex; gap:6px; margin-bottom:10px;">
                    <input type="text" id="pt-custom-dice-inp" placeholder="Формула: 3к6+4..."
                        onkeypress="if(event.key==='Enter') PLAYER_ROLL_DICE(this.value, 'normal');"
                        style="flex:1; padding:7px 9px; font-size:0.84rem; text-align:left; border-radius:7px; background:var(--ui-input-bg, #131110); color:var(--ui-text, #e5e0d7); border:1px solid var(--ui-border, #3e372f);">
                    <button class="btn-small btn-save" onclick="PLAYER_ROLL_DICE(document.getElementById('pt-custom-dice-inp').value, 'normal')">Бросить</button>
                </div>
                <div style="font-size:0.76rem; color:var(--ui-muted, #888); margin-bottom:4px;">Последние броски:</div>
                <div style="background:var(--ui-panel2, #161412); border:1px solid var(--ui-border, #3e372f); border-radius:8px; padding:6px;">
                    ${histHtml || '<div style="text-align:center; padding:8px; color:var(--ui-muted, #777); font-size:0.8rem;">Пока пусто</div>'}
                </div>
            `;
        }

        const inspStrip = inspCnt > 0 ? `
            <button class="btn-small ${window._inspArmed ? 'btn-save' : ''}" style="width:100%; margin-top:6px; padding:5px 8px; font-size:0.78rem;"
                onclick="if(typeof TOGGLE_ARM_INSPIRATION==='function') TOGGLE_ARM_INSPIRATION(); RENDER_ROLL_DRAWER();">
                ${window._inspArmed ? '⭐ Вдохновение АКТИВНО (2к20) — отменить' : `⭐ Потратить Вдохновение (${inspCnt}) для 2к20`}
            </button>` : '';

        el.innerHTML = `
            <!-- Шапка -->
            <div style="display:flex; justify-content:space-between; align-items:center; padding:9px 12px; background:var(--ui-panel2, #161412); border-bottom:1px solid var(--ui-border, #3e372f);">
                <b style="color:var(--ui-accent, #d2b278); font-size:0.96rem;">🎲 Броски • ${ESC(c.name || 'Герой')}</b>
                <button data-custom-bg="1" onclick="CLOSE_PLAYER_ROLL_DRAWER()"
                    style="background:transparent; color:var(--ui-muted, #aaa); border:1px solid var(--ui-border, #3e372f); padding:2px 9px; border-radius:6px; font-size:0.84rem; box-shadow:none;">✕</button>
            </div>

            <!-- Вкладки -->
            <div style="display:flex; gap:4px; padding:6px 10px; background:var(--ui-panel2, #161412); border-bottom:1px solid var(--ui-border, #3e372f);">
                ${tabBtn('skills', '🎯 Навыки')}
                ${tabBtn('stats', '🛡️ Статы / Спасы')}
                ${tabBtn('dice', '🎲 Кубы')}
            </div>

            <!-- Режим 1к20 / Преимущество / Помеха -->
            ${tab !== 'dice' ? `
                <div style="padding:8px 10px 6px 10px;">
                    <div style="display:flex; gap:4px;">
                        ${modeBtn('normal', '1к20')}
                        ${modeBtn('adv', '⬆️ Преим.')}
                        ${modeBtn('dis', '⬇️ Помеха')}
                    </div>
                    ${inspStrip}
                </div>
            ` : '<div style="height:8px;"></div>'}

            ${resultStripHTML}

            <!-- Прокручиваемый список -->
            <div style="flex:1; overflow-y:auto; padding:0 10px 10px 10px;">
                ${bodyHTML}
            </div>

            <!-- Подвал с переключателем скрытого броска -->
            <div style="padding:7px 12px; background:var(--ui-panel2, #161412); border-top:1px solid var(--ui-border, #3e372f); display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:var(--ui-muted, #aaa);">
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer;">
                    <input type="checkbox" ${window._ptRollSecret ? 'checked' : ''} onchange="window._ptRollSecret = this.checked;">
                    <span>🤫 Только себе (не писать в лог)</span>
                </label>
            </div>
        `;
    }

    // Закрытие панели бросков по Esc
    if (!window._ptEscBound) {
        window._ptEscBound = true;
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && window._ptRollDrawerOpen) {
                window.CLOSE_PLAYER_ROLL_DRAWER();
            }
        });
    }

    // ================================================================
    // 2. ОБМЕН ПРЕДМЕТАМИ И ЗОЛОТОМ МЕЖДУ ИГРОКАМИ ВНУТРИ КОМНАТЫ
    // ================================================================
    function GET_ROOM_ALLIES() {
        const rc = CUR_ROOM();
        if (!rc) return [];
        const cs = GC();
        const idxs = (typeof GET_ROOM_PARTY_INDICES === 'function')
            ? GET_ROOM_PARTY_INDICES(rc)
            : cs.map((_, i) => i);
        return idxs
            .filter(idx => idx !== PI && cs[idx])
            .map(idx => {
                const ch = (typeof GET_CHAR_FOR_ROOM === 'function') ? GET_CHAR_FOR_ROOM(cs[idx], rc) : cs[idx];
                const st = (typeof GET_HERO_STATUS_INFO === 'function') ? GET_HERO_STATUS_INFO(idx, rc) : { icon: '🟢', label: 'В игре', interactive: true };
                return { idx, name: ch.name || ('Герой ' + (idx + 1)), status: st };
            });
    }

    function CAN_TRADE_NOW() {
        if (typeof IS_ROOM_PAUSED === 'function' && IS_ROOM_PAUSED()) {
            showMessage('⏸️ Игра на паузе', 'Передача предметов и золота недоступна во время паузы.');
            return false;
        }
        if (typeof IS_HERO_INACTIVE_IN_ROOM === 'function' && IS_HERO_INACTIVE_IN_ROOM(PI)) {
            showMessage('🟠 Вы в статусе Офф', 'Сначала нажмите «🟢 Вернуться в игру».');
            return false;
        }
        return true;
    }

    window.OPEN_TRADE_MODAL = function(preselectedItemIdx = -1) {
        if (!CAN_TRADE_NOW()) return;
        const allies = GET_ROOM_ALLIES();
        if (!allies.length) {
            showMessage('🤝 Некому передать', 'В этой комнате пока нет других союзников.');
            return;
        }

        const cs = GC();
        const me = cs[PI];
        if (!me) return;
        const inv = me.inventory || [];
        const money = me.money || { gp: 0, sp: 0, cp: 0 };
        const tradable = inv
            .map((it, idx) => ({ it, idx }))
            .filter(({ it }) => it && !it.equipped);

        const allyOpts = allies.map(a =>
            `<option value="${a.idx}">${a.status.icon} ${ESC(a.name)} (${a.status.label})</option>`
        ).join('');

        const itemOpts = tradable.length
            ? tradable.map(({ it, idx }) => {
                const q = parseInt(it.qty) || 1;
                const sel = (idx === preselectedItemIdx) ? 'selected' : '';
                return `<option value="${idx}" data-max="${q}" ${sel}>${it.icon || '📦'} ${ESC(it.name)} (у вас: ${q} шт.)</option>`;
            }).join('')
            : '<option value="-1">Нет снятых предметов для передачи</option>';

        const initItem = tradable.find(x => x.idx === preselectedItemIdx) || tradable[0];
        const initMax = initItem ? (parseInt(initItem.it.qty) || 1) : 1;

        const cont = document.getElementById('gm-tool-modal-content');
        if (!cont) return;
        cont.style.maxWidth = '600px';

        cont.innerHTML = `
            <h2>🤝 Передать союзнику</h2>
            <div style="background:var(--ui-panel2, #181715); border:1px solid var(--ui-border, #423c33); border-radius:10px; padding:12px 14px; margin-bottom:14px; text-align:left;">
                <label style="color:var(--ui-accent, #c9a96e); font-weight:bold; font-size:0.9rem;">Кому передать (комната #${CUR_ROOM()}):</label>
                <select id="pt-trade-target" style="margin-top:6px; text-align:left;">${allyOpts}</select>
            </div>

            <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; text-align:left;">
                <div style="background:var(--ui-panel2, #181715); border:1px solid var(--ui-border, #423c33); border-radius:10px; padding:12px 14px; display:flex; flex-direction:column; justify-content:space-between; gap:10px;">
                    <div>
                        <h3 style="margin-top:0;">🎒 Предмет</h3>
                        <select id="pt-trade-item-sel" onchange="PT_SYNC_TRADE_ITEM_MAX()" style="text-align:left; margin-bottom:8px;">${itemOpts}</select>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <span style="font-size:0.86rem; color:var(--ui-muted, #aaa);">Кол-во:</span>
                            <input type="number" id="pt-trade-item-qty" min="1" max="${initMax}" value="1" style="width:82px;">
                            <small id="pt-trade-item-max-lbl" style="color:var(--ui-muted, #888);">из ${initMax}</small>
                        </div>
                        <small style="color:var(--ui-muted, #888); display:block; margin-top:6px;">Надетую экипировку нужно сначала снять в Рюкзаке.</small>
                    </div>
                    <button class="btn-save" ${!tradable.length ? 'disabled' : ''} onclick="CONFIRM_TRADE_ITEM()">📦 Передать предмет</button>
                </div>

                <div style="background:var(--ui-panel2, #181715); border:1px solid var(--ui-border, #423c33); border-radius:10px; padding:12px 14px; display:flex; flex-direction:column; justify-content:space-between; gap:10px;">
                    <div>
                        <h3 style="margin-top:0;">🪙 Монеты</h3>
                        <div style="display:flex; flex-direction:column; gap:6px; font-size:0.86rem;">
                            <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
                                <span>🪙 Золото (есть ${money.gp || 0}):</span>
                                <input type="number" id="pt-trade-gp" min="0" max="${money.gp || 0}" value="0" style="width:76px;">
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
                                <span>🥈 Серебро (есть ${money.sp || 0}):</span>
                                <input type="number" id="pt-trade-sp" min="0" max="${money.sp || 0}" value="0" style="width:76px;">
                            </div>
                            <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
                                <span>🥉 Медь (есть ${money.cp || 0}):</span>
                                <input type="number" id="pt-trade-cp" min="0" max="${money.cp || 0}" value="0" style="width:76px;">
                            </div>
                        </div>
                    </div>
                    <button class="btn-save" onclick="CONFIRM_TRADE_COINS()">🪙 Передать монеты</button>
                </div>
            </div>

            <div style="margin-top:14px; text-align:right;"><button onclick="CM('gm-tool-modal')">Закрыть</button></div>
        `;
        OM('gm-tool-modal');
    };

    window.PT_SYNC_TRADE_ITEM_MAX = function() {
        const sel = document.getElementById('pt-trade-item-sel');
        const qtyInp = document.getElementById('pt-trade-item-qty');
        const lbl = document.getElementById('pt-trade-item-max-lbl');
        if (!sel || !qtyInp) return;
        const opt = sel.options[sel.selectedIndex];
        const maxQ = parseInt(opt?.getAttribute('data-max') || '1', 10) || 1;
        qtyInp.max = String(maxQ);
        if (parseInt(qtyInp.value, 10) > maxQ) qtyInp.value = String(maxQ);
        if (lbl) lbl.textContent = `из ${maxQ}`;
    };

    window.CONFIRM_TRADE_ITEM = function() {
        if (!CAN_TRADE_NOW()) return;
        const rc = CUR_ROOM();
        const targetIdx = parseInt(document.getElementById('pt-trade-target')?.value, 10);
        const itemIdx = parseInt(document.getElementById('pt-trade-item-sel')?.value, 10);
        const reqQty = Math.max(1, parseInt(document.getElementById('pt-trade-item-qty')?.value, 10) || 1);

        const cs = GC();
        const me = cs[PI];
        const target = cs[targetIdx];
        if (!me || !target || isNaN(itemIdx) || itemIdx < 0 || !me.inventory || !me.inventory[itemIdx]) return;

        const srcItem = me.inventory[itemIdx];
        if (srcItem.equipped) {
            showMessage('⚠️ Предмет надет', 'Сначала снимите экипировку, чтобы передать её союзнику.');
            return;
        }
        const haveQty = parseInt(srcItem.qty, 10) || 1;
        const sendQty = Math.min(haveQty, reqQty);
        const cloned = JSON.parse(JSON.stringify(srcItem));
        cloned.equipped = false;
        cloned.qty = String(sendQty);

        if (sendQty >= haveQty) me.inventory.splice(itemIdx, 1);
        else srcItem.qty = String(haveQty - sendQty);
        AB(me);

        const norm = (s) => (s || '').toLowerCase().replace(/ё/g, 'е').trim();
        const giveFn = (ch) => {
            if (!ch.inventory) ch.inventory = [];
            const ex = ch.inventory.find(it => !it.equipped && norm(it.name) === norm(cloned.name));
            if (ex) ex.qty = String((parseInt(ex.qty, 10) || 1) + sendQty);
            else ch.inventory.push(cloned);
        };
        if (typeof MUTATE_HERO_IN_ROOM === 'function') MUTATE_HERO_IN_ROOM(target, rc, giveFn);
        else giveFn(target);

        SC(cs);
        RMC();
        RPL();
        if (document.getElementById('inventory-modal')?.classList.contains('active')) OINV();

        const targetName = target.name || 'Союзник';
        const myName = me.name || 'Союзник';
        LOG_COMBAT_TO_CHAT(`🤝 передаёт «${cloned.name} (×${sendQty})» герою «${targetName}»!`);
        localStorage.setItem('dnd_gm_event', JSON.stringify({
            id: Date.now(),
            target: String(targetIdx),
            title: '🤝 Предмет от союзника',
            text: `Герой <b>${ESC(myName)}</b> передал вам в рюкзак:<br><br>📦 <b>${ESC(cloned.name)} (×${sendQty})</b>`
        }));

        CM('gm-tool-modal');
        showMessage('✅ Передано!', `Вы передали <b>${ESC(cloned.name)} (×${sendQty})</b> герою <b>${ESC(targetName)}</b>.`);
    };

    window.CONFIRM_TRADE_COINS = function() {
        if (!CAN_TRADE_NOW()) return;
        const rc = CUR_ROOM();
        const targetIdx = parseInt(document.getElementById('pt-trade-target')?.value, 10);
        const gp = Math.max(0, parseInt(document.getElementById('pt-trade-gp')?.value, 10) || 0);
        const sp = Math.max(0, parseInt(document.getElementById('pt-trade-sp')?.value, 10) || 0);
        const cp = Math.max(0, parseInt(document.getElementById('pt-trade-cp')?.value, 10) || 0);

        if (gp + sp + cp <= 0) {
            showMessage('⚠️ Укажите сумму', 'Введите количество монет для передачи.');
            return;
        }

        const cs = GC();
        const me = cs[PI];
        const target = cs[targetIdx];
        if (!me || !target) return;
        if (!me.money) me.money = { gp: 0, sp: 0, cp: 0 };

        if (gp > (me.money.gp || 0) || sp > (me.money.sp || 0) || cp > (me.money.cp || 0)) {
            showMessage('⚠️ Недостаточно монет', 'В кошельке не хватает указанного количества монет.');
            return;
        }

        me.money.gp = (me.money.gp || 0) - gp;
        me.money.sp = (me.money.sp || 0) - sp;
        me.money.cp = (me.money.cp || 0) - cp;

        const addCoins = (ch) => {
            if (!ch.money) ch.money = { gp: 0, sp: 0, cp: 0 };
            ch.money.gp = (parseInt(ch.money.gp, 10) || 0) + gp;
            ch.money.sp = (parseInt(ch.money.sp, 10) || 0) + sp;
            ch.money.cp = (parseInt(ch.money.cp, 10) || 0) + cp;
        };
        if (typeof MUTATE_HERO_IN_ROOM === 'function') MUTATE_HERO_IN_ROOM(target, rc, addCoins);
        else addCoins(target);

        SC(cs);
        if (document.getElementById('inventory-modal')?.classList.contains('active')) OINV();

        const parts = [];
        if (gp) parts.push(`${gp} зм`);
        if (sp) parts.push(`${sp} см`);
        if (cp) parts.push(`${cp} мм`);
        const sumTxt = parts.join(', ');
        const targetName = target.name || 'Союзник';
        const myName = me.name || 'Союзник';

        LOG_COMBAT_TO_CHAT(`🪙 передаёт ${sumTxt} герою «${targetName}»!`);
        localStorage.setItem('dnd_gm_event', JSON.stringify({
            id: Date.now(),
            target: String(targetIdx),
            title: '🪙 Монеты от союзника',
            text: `Герой <b>${ESC(myName)}</b> передал вам:<br><br>🪙 <b>${sumTxt}</b>`
        }));

        CM('gm-tool-modal');
        showMessage('✅ Передано!', `Вы передали <b>${sumTxt}</b> герою <b>${ESC(targetName)}</b>.`);
    };

    // ================================================================
    // 3. ЛИЧНЫЙ БЛОКНОТ ИГРОКА (ПО КОМНАТАМ + ОБЛАКО)
    // ================================================================
    function GET_MY_NOTE_META() {
        const rc = CUR_ROOM();
        const cs = GC();
        const c = cs[PI];
        if (!rc || !c) return null;
        const heroKey = String(c.id || ('idx_' + PI)).replace(/[^a-zA-Z0-9_-]/g, '_');
        return { rc, heroKey, lsKey: `dnd_pnote_v1_${rc}_${heroKey}`, heroName: c.name || 'Герой' };
    }

    function GET_MY_NOTES_OBJ() {
        const meta = GET_MY_NOTE_META();
        if (!meta) return { general: '', npcs: '', clues: '' };
        if (window._playerNotesCache[meta.lsKey]) return window._playerNotesCache[meta.lsKey];
        try {
            const raw = localStorage.getItem(meta.lsKey);
            if (raw) {
                const obj = Object.assign({ general: '', npcs: '', clues: '' }, JSON.parse(raw));
                window._playerNotesCache[meta.lsKey] = obj;
                return obj;
            }
        } catch (e) {}
        return { general: '', npcs: '', clues: '' };
    }

    function SAVE_MY_NOTES_OBJ(obj) {
        const meta = GET_MY_NOTE_META();
        if (!meta) return;
        const clean = {
            general: String(obj.general || ''),
            npcs: String(obj.npcs || ''),
            clues: String(obj.clues || ''),
            updatedAt: Date.now()
        };
        window._playerNotesCache[meta.lsKey] = clean;
        try { localStorage.setItem(meta.lsKey, JSON.stringify(clean)); } catch (e) {}

        if (noteSaveTimer) clearTimeout(noteSaveTimer);
        noteSaveTimer = setTimeout(() => {
            if (window.firebase && firebase.apps && firebase.apps.length) {
                firebase.database().ref(`campaign_v2/rooms/${meta.rc}/player_notes/${meta.heroKey}`).set(clean).catch(() => {});
            } else {
                fetch(`${FB_ROOMS_URL}/${encodeURIComponent(meta.rc)}/player_notes/${encodeURIComponent(meta.heroKey)}.json`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(clean)
                }).catch(() => {});
            }
            const statusEl = document.getElementById('pt-note-save-status');
            if (statusEl) statusEl.textContent = '✅ Сохранено в облако';
        }, 450);
    }

    window.OPEN_PLAYER_NOTEBOOK = function() {
        const meta = GET_MY_NOTE_META();
        if (!meta) return;

        fetch(`${FB_ROOMS_URL}/${encodeURIComponent(meta.rc)}/player_notes/${encodeURIComponent(meta.heroKey)}.json`)
            .then(r => r.ok ? r.json() : null)
            .then(rem => {
                if (!rem || typeof rem !== 'object') return;
                const local = GET_MY_NOTES_OBJ();
                if ((rem.updatedAt || 0) > (local.updatedAt || 0)) {
                    const merged = Object.assign({ general: '', npcs: '', clues: '' }, rem);
                    window._playerNotesCache[meta.lsKey] = merged;
                    try { localStorage.setItem(meta.lsKey, JSON.stringify(merged)); } catch (e) {}
                    const ta = document.getElementById('pt-player-note-area');
                    if (ta) ta.value = merged[window._playerNoteTab || 'general'] || '';
                }
            })
            .catch(() => {});

        RENDER_PLAYER_NOTEBOOK_MODAL();
        OM('gm-tool-modal');
    };

    window.SET_PLAYER_NOTE_TAB = function(tab) {
        const ta = document.getElementById('pt-player-note-area');
        if (ta) {
            const notes = GET_MY_NOTES_OBJ();
            notes[window._playerNoteTab || 'general'] = ta.value;
            SAVE_MY_NOTES_OBJ(notes);
        }
        window._playerNoteTab = tab;
        RENDER_PLAYER_NOTEBOOK_MODAL();
    };

    window.ON_PLAYER_NOTE_INPUT = function(val) {
        const notes = GET_MY_NOTES_OBJ();
        notes[window._playerNoteTab || 'general'] = val;
        const statusEl = document.getElementById('pt-note-save-status');
        if (statusEl) statusEl.textContent = '⏳ Сохранение...';
        SAVE_MY_NOTES_OBJ(notes);
    };

    function RENDER_PLAYER_NOTEBOOK_MODAL() {
        const meta = GET_MY_NOTE_META();
        const cont = document.getElementById('gm-tool-modal-content');
        if (!meta || !cont) return;
        cont.style.maxWidth = '720px';

        const notes = GET_MY_NOTES_OBJ();
        const tab = window._playerNoteTab || 'general';
        const placeholders = {
            general: 'Ваши личные заметки по сюжету, планы, обещания, маршруты...',
            npcs: 'Имена встреченных NPC, их должности, кто друг, а кто подозрителен...',
            clues: 'Найденные улики, шифры, загадки, слухи и тайны кампании...'
        };
        const tBtn = (id, label) => `
            <button class="btn-small ${tab===id ? 'btn-save' : ''}" style="flex:1;" onclick="SET_PLAYER_NOTE_TAB('${id}')">${label}</button>`;

        cont.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap; border-bottom:1px solid var(--ui-border, #3e3830); padding-bottom:8px; margin-bottom:12px;">
                <h2 style="margin:0; border:none; padding:0;">📓 Личный блокнот: ${ESC(meta.heroName)}</h2>
                <small id="pt-note-save-status" style="color:var(--ui-muted, #888);">🔒 Видите только вы • Комната #${meta.rc}</small>
            </div>
            <div style="display:flex; gap:6px; margin-bottom:10px; flex-wrap:wrap;">
                ${tBtn('general', '📝 Заметки')}
                ${tBtn('npcs', '🎭 NPC и имена')}
                ${tBtn('clues', '🗝️ Улики и тайны')}
            </div>
            <textarea id="pt-player-note-area" oninput="ON_PLAYER_NOTE_INPUT(this.value)"
                style="min-height:260px; line-height:1.5;"
                placeholder="${placeholders[tab]}">${ESC(notes[tab] || '')}</textarea>
            <div style="margin-top:12px; text-align:right;">
                <button class="btn-save" onclick="CM('gm-tool-modal')">✅ Готово</button>
            </div>
        `;
    }

    // ================================================================
    // 4. ХУКИ В ИНТЕРФЕЙС (ЛЕВАЯ КОЛОНКА, РЮКЗАК, ПКМ-МЕНЮ)
    // ================================================================
    function INJECT_LEFT_COLUMN_TOOLS() {
        const sess = GET_SESSION();
        const leftCol = document.getElementById('left-column');
        if (!leftCol) return;

        let row = document.getElementById('pt-player-tools-row');
        if (!sess || sess.role !== 'player') {
            if (row) row.remove();
            window.CLOSE_PLAYER_ROLL_DRAWER();
            return;
        }
        if (!row) {
            row = document.createElement('div');
            row.id = 'pt-player-tools-row';
            row.style.cssText = 'display:flex; gap:6px;';
            row.innerHTML = `
                <button style="flex:1; padding:8px 6px;" title="Проверки навыков, спасброски, инициатива и кубики" onclick="TOGGLE_PLAYER_ROLL_DRAWER()">🎲 Броски</button>
                <button style="flex:1; padding:8px 6px;" title="Личные заметки игрока" onclick="OPEN_PLAYER_NOTEBOOK()">📓 Блокнот</button>
            `;
            const invBtn = Array.from(leftCol.querySelectorAll('button')).find(b => b.textContent.includes('Рюкзак'));
            if (invBtn) invBtn.after(row);
            else leftCol.appendChild(row);
        }
    }

    const _ORIG_OINV_PT = window.OINV;
    window.OINV = function() {
        _ORIG_OINV_PT();
        const sess = GET_SESSION();
        if (!sess || sess.role !== 'player') return;
        const cont = document.getElementById('inventory-content');
        if (!cont || cont.querySelector('#pt-inv-trade-btn')) return;

        const moneyRow = cont.querySelector('.money-row');
        if (moneyRow) {
            const wrap = document.createElement('div');
            wrap.style.cssText = 'margin:10px 0 12px 0; display:flex; justify-content:flex-end;';
            wrap.innerHTML = `<button id="pt-inv-trade-btn" class="btn-small btn-save" onclick="OPEN_TRADE_MODAL()">🤝 Передать предмет или монеты союзнику</button>`;
            moneyRow.after(wrap);
        }
    };

    const _ORIG_SCM_PT = window.SCM;
    window.SCM = function(e, idx) {
        _ORIG_SCM_PT(e, idx);
        const sess = GET_SESSION();
        if (!sess || sess.role !== 'player') return;
        const menu = document.getElementById('context-menu');
        if (!menu) return;
        const cs = GC();
        const item = cs[PI]?.inventory?.[idx];
        if (!item || item.equipped) return;

        const btn = document.createElement('button');
        btn.textContent = '🤝 Передать союзнику';
        btn.onclick = () => {
            HCM();
            window.OPEN_TRADE_MODAL(idx);
        };
        menu.appendChild(btn);
    };

    const _ORIG_RMC_PT = window.RMC;
    window.RMC = function() {
        _ORIG_RMC_PT();
        if (window._ptRollDrawerOpen) RENDER_ROLL_DRAWER();
    };

    if (typeof window.SWITCH_FIREBASE_ROOM === 'function') {
        const _ORIG_SW_PT = window.SWITCH_FIREBASE_ROOM;
        window.SWITCH_FIREBASE_ROOM = function(rc) {
            window._ptLastRoll = null;
            window.CLOSE_PLAYER_ROLL_DRAWER();
            return _ORIG_SW_PT(rc);
        };
    }

    const _ORIG_APPLY_PT = window.APPLY_ROLE_VIEW;
    window.APPLY_ROLE_VIEW = function() {
        _ORIG_APPLY_PT();
        INJECT_LEFT_COLUMN_TOOLS();
    };

    ENSURE_TOOLS_CSS();
    INJECT_LEFT_COLUMN_TOOLS();
})();