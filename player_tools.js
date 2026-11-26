// ================================================================
// 🎲 БРОСКИ ИЗ ЛИСТА, КУБИКИ ИГРОКА, ОБМЕН ПРЕДМЕТАМИ/ЗОЛОТОМ
// И ЛИЧНЫЙ БЛОКНОТ ИГРОКА (player_tools.js)
// ================================================================
(function INIT_PLAYER_TOOLS_MODULE() {
    const FB_ROOMS_URL = "https://dnds-23b7d-default-rtdb.firebaseio.com/campaign_v2/rooms";
    const STAT_NAMES = ['Сила', 'Ловкость', 'Телосложение', 'Интеллект', 'Мудрость', 'Харизма'];
    const STAT_FIELDS = {
        'Сила': 'str',
        'Ловкость': 'dex',
        'Телосложение': 'con',
        'Интеллект': 'intl',
        'Мудрость': 'wis',
        'Харизма': 'cha'
    };

    window._sheetRollMode = 'normal'; // 'normal' | 'adv' | 'dis'
    window._playerDiceSecret = false;
    window._playerDiceHistory = [];
    window._playerNoteTab = 'general'; // 'general' | 'npcs' | 'clues'
    window._playerNotesCache = {};     // { [key]: { general, npcs, clues } }

    let rollToastTimer = null;
    let noteSaveTimer = null;

    function ESC(s) {
        return String(s || '')
            .replace(/&/g, '&amp;').replace(/</g, '&lt;')
            .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function CUR_ROOM() {
        const s = (typeof GET_SESSION === 'function') ? GET_SESSION() : null;
        return (s && s.roomCode) ? String(s.roomCode) : null;
    }

    function ENSURE_TOOLS_CSS() {
        if (document.getElementById('player-tools-css')) return;
        const st = document.createElement('style');
        st.id = 'player-tools-css';
        st.textContent = `
            .sheet-roll-clickable {
                cursor: pointer !important;
                border-radius: 5px;
                transition: background 0.14s, color 0.14s;
            }
            .sheet-roll-clickable:hover {
                background: rgba(210, 178, 120, 0.18) !important;
                color: var(--ui-accent, #e6c88c) !important;
                text-decoration: underline;
            }
        `;
        document.head.appendChild(st);
    }

    // Ненавязчивое всплывающее уведомление с результатом броска (поверх Листа персонажа)
    function SHOW_ROLL_TOAST(title, mainVal, detailsHtml, accentColor) {
        let box = document.getElementById('pt-roll-toast');
        if (!box) {
            box = document.createElement('div');
            box.id = 'pt-roll-toast';
            box.style.cssText = 'position:fixed; bottom:20px; right:20px; min-width:250px; max-width:360px; background:var(--ui-panel, #221f1c); border:2px solid var(--ui-accent, #c9a96e); border-radius:12px; padding:12px 16px; box-shadow:0 12px 32px rgba(0,0,0,0.88); z-index:97000; color:var(--ui-text, #ebe8e2); cursor:pointer;';
            box.onclick = () => { box.style.display = 'none'; };
            document.body.appendChild(box);
        }
        box.style.borderColor = accentColor || 'var(--ui-accent, #c9a96e)';
        box.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:4px;">
                <b style="color:var(--ui-accent, #e6c88c); font-size:0.92rem;">${title}</b>
                <span style="font-size:1.45rem; font-weight:bold; color:${accentColor || 'var(--ui-text, #fff)'};">${mainVal}</span>
            </div>
            <div style="font-size:0.82rem; color:var(--ui-muted, #aaa); line-height:1.35;">${detailsHtml}</div>
        `;
        box.style.display = 'block';
        if (rollToastTimer) clearTimeout(rollToastTimer);
        rollToastTimer = setTimeout(() => {
            if (box) box.style.display = 'none';
        }, 5500);
    }

    // Универсальный парсер формул кубов (показывает каждую грань: 2к6+3 -> [4, 6] + 3 = 13)
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
    // 1. КЛИКАБЕЛЬНЫЕ БРОСКИ ИЗ ЛИСТА ПЕРСОНАЖА (НАВЫКИ / ХАРАКТЕРИСТИКИ / СПАСБРОСКИ)
    // ================================================================
    window.SET_SHEET_ROLL_MODE = function(mode) {
        window._sheetRollMode = mode;
        const bar = document.getElementById('pt-sheet-roll-bar');
        if (!bar) return;
        bar.querySelectorAll('[data-roll-mode]').forEach(btn => {
            const isAct = btn.getAttribute('data-roll-mode') === mode;
            btn.className = 'btn-small ' + (isAct ? 'btn-save' : '');
        });
    };

    window.ROLL_FROM_CHAR_SHEET = function(kind, name) {
        const cs = GC();
        const c = cs[PI];
        if (!c) return;

        let bonus = 0;
        let label = name;

        if (kind === 'skill') {
            bonus = (typeof GET_CHAR_CHECK_BONUS === 'function') ? GET_CHAR_CHECK_BONUS(c, name) : 0;
            label = `Навык: ${name}`;
        } else if (kind === 'save') {
            bonus = (typeof GET_CHAR_CHECK_BONUS === 'function') ? GET_CHAR_CHECK_BONUS(c, 'Спасбросок: ' + name) : GM(c[STAT_FIELDS[name]] || 10);
            label = `Спасбросок: ${name}`;
        } else if (kind === 'init') {
            bonus = GM(c.dex || 10) + (parseInt(c.initiativeBonus) || 0);
            label = 'Инициатива';
        } else {
            bonus = GM(c[STAT_FIELDS[name]] || 10);
            label = `Проверка: ${name}`;
        }

        // Проверка заряженного Вдохновения (работает вместе с session.js)
        let mode = window._sheetRollMode || 'normal';
        let usedInsp = false;
        const sess = GET_SESSION();
        if (sess && sess.role === 'player' && window._inspArmed && typeof GET_INSPIRATION_COUNT === 'function' && GET_INSPIRATION_COUNT(c) > 0) {
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

        const modStr = (typeof MS === 'function') ? MS(bonus) : ((bonus >= 0 ? '+' : '') + bonus);
        const rollPart = (mode === 'normal')
            ? `${d20}`
            : `${mode === 'adv' ? 'Преим.' : 'Помеха'} (${r1}, ${r2} → ${d20})`;
        const inspPrefix = usedInsp ? '⭐ [Вдохновение] ' : '';
        const critNote = d20 === 20 ? ' 🌟 НАТ. 20!' : (d20 === 1 ? ' 💀 НАТ. 1!' : '');
        const accent = d20 === 20 ? '#6cb878' : (d20 === 1 ? '#d66565' : 'var(--ui-accent, #e6c88c)');

        if (CUR_ROOM()) {
            LOG_COMBAT_TO_CHAT(`${inspPrefix}🎲 ${label}: ${rollPart} ${modStr} = ${total}${critNote}`);
        }

        SHOW_ROLL_TOAST(
            `${inspPrefix}🎲 ${ESC(label)}`,
            total,
            `Кубик: <b>${ESC(rollPart)}</b> | Модификатор: <b>${modStr}</b>${critNote}${!CUR_ROOM() ? '<br><i>(Пробный бросок в Лобби)</i>' : ''}`,
            accent
        );
    };

    function ENHANCE_CHAR_SHEET_FOR_ROLLS() {
        ENSURE_TOOLS_CSS();
        const cont = document.getElementById('char-sheet-content');
        if (!cont) return;

        // 1. Панель режима бросков сверху Листа персонажа
        if (!cont.querySelector('#pt-sheet-roll-bar')) {
            const bar = document.createElement('div');
            bar.id = 'pt-sheet-roll-bar';
            bar.style.cssText = 'background:var(--ui-panel2, #161513); border:1px solid var(--ui-border, #3e3830); border-radius:9px; padding:8px 12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; font-size:0.86rem;';
            const m = window._sheetRollMode || 'normal';
            bar.innerHTML = `
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <span style="color:var(--ui-muted, #aaa);">🎲 Кликните по характеристике, спасу или навыку:</span>
                </div>
                <div style="display:flex; gap:5px; flex-wrap:wrap;">
                    <button class="btn-small ${m==='normal'?'btn-save':''}" data-roll-mode="normal" onclick="SET_SHEET_ROLL_MODE('normal')">1к20</button>
                    <button class="btn-small ${m==='adv'?'btn-save':''}" data-roll-mode="adv" onclick="SET_SHEET_ROLL_MODE('adv')">⬆️ Преим.</button>
                    <button class="btn-small ${m==='dis'?'btn-save':''}" data-roll-mode="dis" onclick="SET_SHEET_ROLL_MODE('dis')">⬇️ Помеха</button>
                    <button class="btn-small btn-cast" onclick="ROLL_FROM_CHAR_SHEET('init', 'Инициатива')">⚡ Инициатива</button>
                </div>
            `;
            const h2 = cont.querySelector('h2');
            if (h2) h2.after(bar);
            else cont.prepend(bar);
        }

        // 2. Делаем кликабельными навыки, характеристики и спасброски в таблицах Листа
        const allSkills = (typeof gameData !== 'undefined' && Array.isArray(gameData.allSkills)) ? gameData.allSkills : [];
        const tables = cont.querySelectorAll('table');

        tables.forEach(tbl => {
            // Определяем, не является ли таблица блоком спасбросков
            const prevH3 = tbl.previousElementSibling;
            const prevTxt = prevH3 ? (prevH3.textContent || '').toLowerCase() : '';
            const headTxt = (tbl.querySelector('th')?.parentElement?.textContent || '').toLowerCase();
            const isSaveTable = prevTxt.includes('спасброс') || headTxt.includes('спасброс');

            tbl.querySelectorAll('tr').forEach(tr => {
                const tds = tr.querySelectorAll('td');
                if (tds.length < 2) return;

                const firstText = (tds[0].textContent || '').replace(/[●○⭐★✓✔✦•]/g, '').trim();

                // А) Навык
                const matchedSkill = allSkills.find(sk => firstText === sk || firstText.startsWith(sk + ' ('));
                if (matchedSkill) {
                    const bonusTd = tr.querySelector('.skill-bonus') || tds[tds.length - 1];
                    [tds[0], bonusTd].forEach(cell => {
                        if (!cell || cell.querySelector('input, select, button')) return;
                        cell.classList.add('sheet-roll-clickable');
                        cell.title = `Нажмите, чтобы бросить проверку «${matchedSkill}»`;
                        cell.onclick = () => window.ROLL_FROM_CHAR_SHEET('skill', matchedSkill);
                    });
                    return;
                }

                // Б) Характеристика или Спасбросок
                const matchedStat = STAT_NAMES.find(st => firstText === st || firstText.startsWith(st + ' '));
                if (matchedStat) {
                    const modCell = tr.querySelector('.stat-mod');
                    const bonusCell = modCell || tds[tds.length - 1];
                    const kind = (isSaveTable || !modCell) ? 'save' : 'stat';
                    const targets = [bonusCell];
                    if (!tds[0].querySelector('input, select, button')) targets.push(tds[0]);

                    targets.forEach(cell => {
                        if (!cell || cell.querySelector('input, select, button')) return;
                        cell.classList.add('sheet-roll-clickable');
                        cell.title = kind === 'save'
                            ? `Нажмите, чтобы бросить Спасбросок: ${matchedStat}`
                            : `Нажмите, чтобы бросить проверку характеристики: ${matchedStat}`;
                        cell.onclick = () => window.ROLL_FROM_CHAR_SHEET(kind, matchedStat);
                    });
                }
            });
        });
    }

    // ================================================================
    // 2. СВОБОДНЫЕ КУБИКИ ИГРОКА (к4 — к100, ФОРМУЛЫ, ПРЕИМ./ПОМЕХА)
    // ================================================================
    window.OPEN_PLAYER_DICE_MODAL = function() {
        const cont = document.getElementById('gm-tool-modal-content');
        if (!cont) return;
        cont.style.maxWidth = '660px';

        const diceList = ['1к4', '1к6', '1к8', '1к10', '1к12', '1к20', '2к6', '1к100'];
        const diceBtns = diceList.map(d =>
            `<button class="btn-small" style="min-width:80px; padding:8px 10px;" onclick="PLAYER_ROLL_DICE('${d}', 'normal')">🎲 ${d}</button>`
        ).join('');

        const histHtml = (window._playerDiceHistory || []).slice(0, 8).map(h =>
            `<div style="display:flex; justify-content:space-between; gap:8px; padding:5px 8px; border-bottom:1px dashed var(--ui-border, #333); font-size:0.86rem;">
                <span>${ESC(h.label)} ${h.secret ? '<small style="color:var(--ui-muted, #888);">(скрыто)</small>' : ''}</span>
                <b style="color:var(--ui-accent, #e6c88c);">${ESC(h.res)}</b>
            </div>`
        ).join('');

        cont.innerHTML = `
            <h2>🎲 Кубики игрока</h2>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">
                <button class="btn-save" style="flex:1;" onclick="PLAYER_ROLL_DICE('1к20', 'adv')">⬆️ 1к20 с Преимуществом</button>
                <button class="btn-warn" style="flex:1;" onclick="PLAYER_ROLL_DICE('1к20', 'dis')">⬇️ 1к20 с Помехой</button>
            </div>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:12px;">${diceBtns}</div>
            <div style="display:flex; gap:8px; margin-bottom:12px;">
                <input type="text" id="pt-custom-dice-inp" placeholder="Своя формула (напр. 3к6+4 или 2d8+2)..."
                       onkeypress="if(event.key==='Enter') PLAYER_ROLL_DICE(this.value, 'normal');"
                       style="flex:1; text-align:left;">
                <button class="btn-save" onclick="PLAYER_ROLL_DICE(document.getElementById('pt-custom-dice-inp').value, 'normal')">Бросить</button>
            </div>
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; margin-bottom:12px; font-size:0.88rem; color:var(--ui-muted, #aaa);">
                <input type="checkbox" ${window._playerDiceSecret ? 'checked' : ''} onchange="window._playerDiceSecret = this.checked;">
                <span>🤫 Пробный бросок только для себя (не писать в системный лог комнаты)</span>
            </label>
            <div id="pt-dice-history-box" style="background:var(--ui-panel2, #141312); border:1px solid var(--ui-border, #3e3830); border-radius:8px; padding:8px; max-height:190px; overflow-y:auto;">
                ${histHtml || '<div style="color:var(--ui-muted, #777); text-align:center; padding:12px;">Нажмите на любой кубик выше</div>'}
            </div>
            <div style="margin-top:14px; text-align:right;"><button onclick="CM('gm-tool-modal')">Закрыть</button></div>
        `;
        OM('gm-tool-modal');
    };

    window.PLAYER_ROLL_DICE = function(formula, mode = 'normal') {
        const clean = String(formula || '').trim();
        if (!clean) return;

        let total = 0, detail = '', label = clean;

        if (mode === 'adv' || mode === 'dis') {
            const r1 = Math.floor(Math.random() * 20) + 1;
            const r2 = Math.floor(Math.random() * 20) + 1;
            total = mode === 'adv' ? Math.max(r1, r2) : Math.min(r1, r2);
            label = mode === 'adv' ? '1к20 (Преимущество)' : '1к20 (Помеха)';
            detail = `[${r1}, ${r2}] → ${total}`;
        } else {
            const res = ROLL_DETAILED_FORMULA(clean);
            total = res.total;
            label = res.formula;
            const diceStr = res.rolls.length > 1 ? `[${res.rolls.join(' + ')}]` : `${res.rolls[0]}`;
            const modStr = res.mod ? (res.mod > 0 ? ` + ${res.mod}` : ` − ${Math.abs(res.mod)}`) : '';
            detail = `${diceStr}${modStr} = ${total}`;
        }

        window._playerDiceHistory.unshift({ label, res: detail, secret: !!window._playerDiceSecret });
        if (window._playerDiceHistory.length > 15) window._playerDiceHistory.pop();

        if (!window._playerDiceSecret && CUR_ROOM()) {
            LOG_COMBAT_TO_CHAT(`🎲 Бросок ${label}: ${detail}`);
        }

        SHOW_ROLL_TOAST(`🎲 ${ESC(label)}`, total, ESC(detail));

        if (document.getElementById('pt-dice-history-box')) {
            window.OPEN_PLAYER_DICE_MODAL();
        }
    };

    // ================================================================
    // 3. ОБМЕН ПРЕДМЕТАМИ И ЗОЛОТОМ МЕЖДУ ИГРОКАМИ ВНУТРИ КОМНАТЫ
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
                <!-- Передача предмета -->
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

                <!-- Передача монет -->
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

        // Списываем у отправителя
        if (sendQty >= haveQty) me.inventory.splice(itemIdx, 1);
        else srcItem.qty = String(haveQty - sendQty);
        AB(me);

        // Добавляем получателю строго в прогресс текущей комнаты
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
    // 4. ЛИЧНЫЙ БЛОКНОТ ИГРОКА (ПО КОМНАТАМ + ОБЛАЧНАЯ СИНХРОНИЗАЦИЯ)
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

        // Подтягиваем актуальную версию из Firebase (на случай если игрок писал с другого устройства)
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
    // 5. ХУКИ В ИНТЕРФЕЙС (ЛЕВАЯ КОЛОНКА, ЛИСТ, РЮКЗАК, ПКМ-МЕНЮ)
    // ================================================================
    function INJECT_LEFT_COLUMN_TOOLS() {
        const sess = GET_SESSION();
        const leftCol = document.getElementById('left-column');
        if (!leftCol) return;

        let row = document.getElementById('pt-player-tools-row');
        if (!sess || sess.role !== 'player') {
            if (row) row.remove();
            return;
        }
        if (!row) {
            row = document.createElement('div');
            row.id = 'pt-player-tools-row';
            row.style.cssText = 'display:flex; gap:6px;';
            row.innerHTML = `
                <button style="flex:1; padding:8px 6px;" onclick="OPEN_PLAYER_DICE_MODAL()">🎲 Кубики</button>
                <button style="flex:1; padding:8px 6px;" onclick="OPEN_PLAYER_NOTEBOOK()">📓 Блокнот</button>
            `;
            const invBtn = Array.from(leftCol.querySelectorAll('button')).find(b => b.textContent.includes('Рюкзак'));
            if (invBtn) invBtn.after(row);
            else leftCol.appendChild(row);
        }
    }

    const _ORIG_OCS_PT = window.OCS;
    window.OCS = function() {
        _ORIG_OCS_PT();
        ENHANCE_CHAR_SHEET_FOR_ROLLS();
    };

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

    const _ORIG_APPLY_PT = window.APPLY_ROLE_VIEW;
    window.APPLY_ROLE_VIEW = function() {
        _ORIG_APPLY_PT();
        INJECT_LEFT_COLUMN_TOOLS();
    };

    ENSURE_TOOLS_CSS();
    INJECT_LEFT_COLUMN_TOOLS();
})();