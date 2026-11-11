// ================================================================
// 👑 ОТДЕЛЬНЫЙ МОДУЛЬ ГЕЙМ-МАСТЕРА, ЛОББИ, ЖИВЫХ ДИАЛОГОВ НОВЕЛЛЫ,
// ТАКТИЧЕСКОЙ КАРТЫ, МАГАЗИНА, ПОГОДЫ И РАЗРЕШЕНИЙ (gm.js)
// ================================================================
window._gmSecretRoll = false;
window._gmLastDiceResult = 'Нажмите на кубик для броска';
window._gmPinPlacementMode = false;
window._draggingMapObj = null;

// --- 1. ХРАНИЛИЩА ДАННЫХ КАМПАНИИ ---
function GET_ROOMS() {
    const d = localStorage.getItem('dnd_rooms');
    if (d) return JSON.parse(d);
    const defaultRooms = [{ code: '1001', name: 'Кампания: Притишье', createdAt: 'Основная комната' }];
    localStorage.setItem('dnd_rooms', JSON.stringify(defaultRooms));
    return defaultRooms;
}
function SAVE_ROOMS(rooms) { localStorage.setItem('dnd_rooms', JSON.stringify(rooms)); }

function GET_SESSION() {
    const s = sessionStorage.getItem('dnd_current_session');
    return s ? JSON.parse(s) : null; // { role: 'gm' | 'player', roomCode: '1001', playerIdx: 0 }
}
function SAVE_SESSION(sess) {
    if (!sess) sessionStorage.removeItem('dnd_current_session');
    else sessionStorage.setItem('dnd_current_session', JSON.stringify(sess));
}

function GET_MAP_STATE() {
    const d = localStorage.getItem('dnd_map_state');
    const def = {
        title: 'Окрестности Притишья',
        desc: 'Маленькая деревня на границе цивилизации.',
        img: '',
        fog: false,
        weather: 'none', // 'none' | 'rain' | 'snow' | 'ash' | 'night'
        grid: true,
        gridSize: 48,
        gridColor: 'rgba(201, 169, 110, 0.25)',
        pins: [],
        tokens: [],
        turnOrder: { active: false, round: 1, currentIdx: 0 }
    };
    if (!d) return def;
    const parsed = JSON.parse(d);
    if (!parsed.pins) parsed.pins = [];
    if (!parsed.tokens) parsed.tokens = [];
    if (!parsed.turnOrder) parsed.turnOrder = { active: false, round: 1, currentIdx: 0 };
    if (parsed.grid === undefined) parsed.grid = true;
    if (!parsed.gridSize) parsed.gridSize = 48;
    if (!parsed.weather) parsed.weather = 'none';
    return parsed;
}
function SAVE_MAP_STATE(st) { localStorage.setItem('dnd_map_state', JSON.stringify(st)); }

// Хранилище Магазина / Торговца
function GET_SHOP_STATE() {
    const d = localStorage.getItem('dnd_gm_shop');
    if (d) return JSON.parse(d);
    const def = {
        active: false,
        title: 'Лавка бронника и алхимика Притишья',
        keeper: 'Старый кузнец Торвальд',
        items: [
            { name: 'Зелье лечения', priceGp: 50, stock: 5 },
            { name: 'Сильное зелье лечения', priceGp: 180, stock: 2 },
            { name: 'Противоядие', priceGp: 45, stock: 4 },
            { name: 'Стрелы', priceGp: 1, stock: 20 },
            { name: 'Длинный меч', priceGp: 15, stock: 2 },
            { name: 'Кинжал', priceGp: 2, stock: 5 },
            { name: 'Проклёпанный кожаный доспех', priceGp: 45, stock: 2 },
            { name: 'Щит', priceGp: 10, stock: 3 }
        ]
    };
    localStorage.setItem('dnd_gm_shop', JSON.stringify(def));
    return def;
}
function SAVE_SHOP_STATE(sh) { localStorage.setItem('dnd_gm_shop', JSON.stringify(sh)); }

function GET_BESTIARY() {
    const d = localStorage.getItem('dnd_bestiary');
    if (d) return JSON.parse(d);
    const def = [
        { name: 'Гоблин-разведчик', icon: '👺', hp: 12, maxHp: 12, ac: 13, atkBonus: 4, dmgFormula: '1к6+2', desc: 'Мелкий и юркий разведчик из чащи.' },
        { name: 'Гончая Псов Империи', icon: '🐺', hp: 18, maxHp: 18, ac: 13, atkBonus: 5, dmgFormula: '2к4+3', desc: 'Боевой пёс имперского гарнизона.' },
        { name: 'Солдат Псов Империи', icon: '💂', hp: 26, maxHp: 26, ac: 16, atkBonus: 5, dmgFormula: '1к8+3', desc: 'Вооружённый мечом и щитом сборщик податей.' },
        { name: 'Порождение Ошибки', icon: '👾', hp: 38, maxHp: 38, ac: 14, atkBonus: 6, dmgFormula: '2к6+4', desc: 'Искажённый монстр, сочащийся тьмой.' },
        { name: 'Древний Страж Древа', icon: '🌳', hp: 65, maxHp: 65, ac: 17, atkBonus: 7, dmgFormula: '2к8+4', desc: 'Оживший переплетённый корнями исполин.' }
    ];
    localStorage.setItem('dnd_bestiary', JSON.stringify(def));
    return def;
}
function SAVE_BESTIARY(list) { localStorage.setItem('dnd_bestiary', JSON.stringify(list)); }

function GET_NPCS() {
    const d = localStorage.getItem('dnd_npcs');
    if (d) return JSON.parse(d);
    const def = [
        { name: 'Смотритель деревни', role: 'Старый воин Притишья', avatar: '', defaultText: 'Монстры подходят всё ближе к частоколу. Вы готовы выйти за ворота?', choices: 'Согласиться защитить деревню | Спросить про награду | Уйти' },
        { name: 'Генерал Псов', role: 'Командующий Империи', avatar: '', defaultText: 'Империя не прощает должников. Платите дань или пеняйте на себя.', choices: 'Мы заплатим золотом | Приготовиться к бою! | Уйти' }
    ];
    localStorage.setItem('dnd_npcs', JSON.stringify(def));
    return def;
}
function SAVE_NPCS(list) { localStorage.setItem('dnd_npcs', JSON.stringify(list)); }

// Хранилище активного диалога Новеллы: поддерживает историю реплик и список вышедших игроков (leftPlayers)
function GET_ACTIVE_VN_DIALOG() {
    const d = localStorage.getItem('dnd_vn_dialog');
    if (!d) return null;
    const parsed = JSON.parse(d);
    if (!parsed.leftPlayers) parsed.leftPlayers = [];
    if (!parsed.history) parsed.history = [];
    return parsed;
}
function SAVE_ACTIVE_VN_DIALOG(vn) {
    if (!vn) localStorage.removeItem('dnd_vn_dialog');
    else localStorage.setItem('dnd_vn_dialog', JSON.stringify(vn));
}

function GET_PREPARED_EVENTS() {
    const d = localStorage.getItem('dnd_prepared_events');
    if (d) return JSON.parse(d);
    const def = [
        { title: '🐺 Засада в чаще!', text: 'Из густого тумана на тропу выскакивают гоблины-разведчики! Всем приготовить оружие и включить режим боя!' },
        { title: '🌳 Шёпот Древа', text: 'Земля под ногами слегка вздрагивает, и в вашем сознании раздаётся глухой гул древнего Древа...' },
        { title: '🌧️ Кислотный ливень', text: 'Небо затягивают свинцовые тучи. Начинается тяжёлый ливень, видимость падает до 30 футов.' }
    ];
    localStorage.setItem('dnd_prepared_events', JSON.stringify(def));
    return def;
}
function SAVE_PREPARED_EVENTS(list) { localStorage.setItem('dnd_prepared_events', JSON.stringify(list)); }

function GET_CUSTOM_LORE() {
    const d = localStorage.getItem('dnd_custom_lore');
    return d ? JSON.parse(d) : [];
}
function SAVE_CUSTOM_LORE(list) { localStorage.setItem('dnd_custom_lore', JSON.stringify(list)); }

// --- 2. ВСПЛЫВАЮЩИЕ СОБЫТИЯ И ПРОВЕРКИ НАВЫКОВ У ИГРОКОВ ---
function CHECK_UNSEEN_GM_EVENT() {
    const sess = GET_SESSION();
    if (!sess || sess.role !== 'player') return;
    const raw = localStorage.getItem('dnd_gm_event');
    if (!raw) return;
    const ev = JSON.parse(raw);
    if (!ev || !ev.id) return;

    const myIdx = sess.playerIdx || 0;
    if (ev.target !== undefined && ev.target !== 'all' && parseInt(ev.target) !== myIdx) return;

    const seenKey = 'dnd_seen_event_' + myIdx;
    const lastSeenId = localStorage.getItem(seenKey);
    if (String(lastSeenId) !== String(ev.id)) {
        localStorage.setItem(seenKey, String(ev.id));
        showMessage(ev.title, `<div style="font-size:1.12rem; line-height:1.55; color:#ebe8e2; padding:6px 0;">${ev.text}</div>`);
    }
}

function GET_SKILL_CHECK_REQ() {
    const d = localStorage.getItem('dnd_gm_skill_check');
    return d ? JSON.parse(d) : null;
}
function SAVE_SKILL_CHECK_REQ(req) {
    if (!req) localStorage.removeItem('dnd_gm_skill_check');
    else localStorage.setItem('dnd_gm_skill_check', JSON.stringify(req));
}

function GET_CHAR_CHECK_BONUS(c, checkName) {
    if (!c) return 0;
    const pb = GPB(c.level || 1);
    const sm = GM(c.str || 10), dm = GM(c.dex || 10), cm = GM(c.con || 10);
    const im = GM(c.intl || 10), wm = GM(c.wis || 10), hm = GM(c.cha || 10);

    if (checkName.startsWith('Спасбросок:')) {
        const cst = GCST(c);
        const hasRing = c.inventory && c.inventory.some(i => i.equipped && (i.name || '').toLowerCase().includes('кольцо защиты'));
        const rb = hasRing ? 1 : 0;
        if (checkName.includes('Сила')) return (cst.strength ? sm + pb : sm) + rb;
        if (checkName.includes('Ловкость')) return (cst.dexterity ? dm + pb : dm) + rb;
        if (checkName.includes('Телосложение')) return (cst.constitution ? cm + pb : cm) + rb;
        if (checkName.includes('Интеллект')) return (cst.intelligence ? im + pb : im) + rb;
        if (checkName.includes('Мудрость')) return (cst.wisdom ? wm + pb : wm) + rb;
        if (checkName.includes('Харизма')) return (cst.charisma ? hm + pb : hm) + rb;
    }

    const smods = {'Атлетика':sm,'Акробатика':dm,'Ловкость рук':dm,'Скрытность':dm,'Магия':im,'История':im,'Расследование':im,'Природа':im,'Религия':im,'Обращение с животными':wm,'Проницательность':wm,'Медицина':wm,'Восприятие':wm,'Выживание':wm,'Обман':hm,'Запугивание':hm,'Выступление':hm,'Убеждение':hm};
    const baseMod = smods[checkName] !== undefined ? smods[checkName] : 0;
    const as = GAS(c), chs = c.chosenSkills || [];
    const isProf = as.includes(checkName) || chs.includes(checkName);
    const isExp = c.expertiseSkills && c.expertiseSkills.includes(checkName);
    return isProf ? (isExp ? baseMod + pb * 2 : baseMod + pb) : baseMod;
}

function CHECK_AND_RENDER_SKILL_ROLL_POPUP() {
    let popup = document.getElementById('player-skill-check-popup');
    const sess = GET_SESSION();
    const req = GET_SKILL_CHECK_REQ();

    if (!sess || sess.role !== 'player' || !req) {
        if (popup) popup.remove();
        return;
    }
    const myIdx = sess.playerIdx || 0;
    const isForMe = (req.target === 'all' || parseInt(req.target) === myIdx);
    const alreadyRolled = req.rolledBy && req.rolledBy[myIdx];

    if (!isForMe || alreadyRolled) {
        if (popup) popup.remove();
        return;
    }

    const cs = GC();
    const c = cs[myIdx];
    const bonus = GET_CHAR_CHECK_BONUS(c, req.checkName);

    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'player-skill-check-popup';
        popup.style.cssText = 'position:fixed; bottom:24px; left:50%; transform:translateX(-50%); width:440px; max-width:95vw; background:linear-gradient(180deg, #282218 0%, #161412 100%); border:2px solid #c9a96e; border-radius:14px; padding:18px 22px; box-shadow:0 14px 40px rgba(0,0,0,0.95); z-index:9998; color:#ebe8e2; text-align:center;';
        document.body.appendChild(popup);
    }

    popup.innerHTML = `
        <div style="color:#e6c88c; font-weight:bold; font-size:1.15rem; margin-bottom:6px;">
            🎯 Гейм-Мастер запрашивает проверку!
        </div>
        <div style="font-size:1.05rem; color:#fff; margin-bottom:6px;">
            Проверка: <b style="color:#4cd964;">${req.checkName}</b> (Сложность Сл: <b>${req.dc}</b>)
        </div>
        ${req.reason ? `<div style="color:#aba498; font-size:0.9rem; margin-bottom:12px;">«${req.reason}»</div>` : ''}
        <button class="btn-save" style="width:100%; padding:12px; font-size:1.08rem;" onclick="PLAYER_EXECUTE_SKILL_ROLL()">
            🎲 Бросить 1к20 ${MS(bonus)} (Ваш бонус: ${MS(bonus)})
        </button>
    `;
}

function PLAYER_EXECUTE_SKILL_ROLL() {
    const sess = GET_SESSION();
    const req = GET_SKILL_CHECK_REQ();
    if (!sess || !req) return;
    const myIdx = sess.playerIdx || 0;
    const cs = GC();
    const c = cs[myIdx];
    const bonus = GET_CHAR_CHECK_BONUS(c, req.checkName);
    const d20 = Math.floor(Math.random() * 20) + 1;
    const total = d20 + bonus;
    const success = (d20 === 20) || (d20 !== 1 && total >= req.dc);

    if (!req.rolledBy) req.rolledBy = {};
    req.rolledBy[myIdx] = { d20, bonus, total, success };
    SAVE_SKILL_CHECK_REQ(req);
    CHECK_AND_RENDER_SKILL_ROLL_POPUP();

    const statusBadge = d20 === 20 ? '🌟 КРИТИЧЕСКИЙ УСПЕХ (20)!' : (d20 === 1 ? '💀 КРИТИЧЕСКИЙ ПРОВАЛ (1)!' : (success ? '✅ УСПЕХ!' : '❌ ПРОВАЛ!'));
    LOG_COMBAT_TO_CHAT(`🎲 Проверка «${req.checkName}» (Сл ${req.dc}): бросок ${d20}${MS(bonus)} = ${total} — ${statusBadge}`);
    showMessage(`🎲 Результат: ${req.checkName}`, `
        <div style="text-align:center; padding:10px 0;">
            <div style="font-size:2.4rem; font-weight:bold; color:${success ? '#52b758' : '#e06060'}; margin-bottom:8px;">
                ${total}
            </div>
            <div style="color:#ccc; margin-bottom:10px;">Кубик к20: <b>${d20}</b> | Модификатор: <b>${MS(bonus)}</b> | Сложность: <b>${req.dc}</b></div>
            <div style="font-size:1.2rem; font-weight:bold; color:${success ? '#52b758' : '#e06060'};">${statusBadge}</div>
        </div>
    `);
}

// --- 3. СИСТЕМА РАЗРЕШЕНИЙ НА РЕДАКТИРОВАНИЕ ЛИСТА И РЮКЗАКА ---
function GET_EDIT_PERMISSION_REQ() {
    const d = localStorage.getItem('dnd_gm_edit_request');
    return d ? JSON.parse(d) : null;
}
function SAVE_EDIT_PERMISSION_REQ(req) {
    if (!req) localStorage.removeItem('dnd_gm_edit_request');
    else localStorage.setItem('dnd_gm_edit_request', JSON.stringify(req));
}

function TOGGLE_AUTO_APPROVE_GM(checked) {
    const cs = GC();
    if (!cs[PI]) return;
    cs[PI].autoApproveGM = !!checked;
    SC(cs);
    APPLY_ROLE_VIEW();
}

function GM_REQUEST_ACCESS(charIdx, targetType) {
    const cs = GC();
    const targetChar = cs[charIdx];
    if (!targetChar) return;

    if (targetChar.autoApproveGM) {
        EXECUTE_GM_OPEN_TARGET(charIdx, targetType);
        return;
    }

    const req = {
        id: Date.now(),
        charIdx: charIdx,
        charName: targetChar.name || ('Игрок ' + (charIdx + 1)),
        targetType: targetType,
        status: 'pending'
    };
    SAVE_EDIT_PERMISSION_REQ(req);
    RENDER_PERMISSION_WAITING_MODAL(req);
}

function EXECUTE_GM_OPEN_TARGET(charIdx, targetType) {
    PI = charIdx;
    CM('gm-tool-modal');
    if (targetType === 'inventory') {
        CM('char-sheet-modal');
        OINV();
    } else {
        OCS();
    }
}

function RENDER_PERMISSION_WAITING_MODAL(req) {
    const cont = document.getElementById('gm-tool-modal-content');
    if (!cont) return;
    cont.style.maxWidth = '560px';
    const typeLabel = req.targetType === 'inventory' ? '🎒 Рюкзаку (Инвентарю)' : '📋 Листу персонажа';
    cont.innerHTML = `
        <div style="text-align:center; padding:20px 10px;">
            <div style="font-size:3rem; margin-bottom:10px;">⏳</div>
            <h2>Ожидание разрешения от игрока «${req.charName}»</h2>
            <p style="color:#ccc; font-size:1.05rem; margin-bottom:18px;">
                Игроку отправлен запрос на доступ к <b>${typeLabel}</b>.<br>
                <small style="color:#9e988e;">(У игрока на экране всплыло окно с кнопками «Разрешить» и «Доверять Мастеру всегда»).</small>
            </p>
            <div style="display:flex; justify-content:center; gap:12px; flex-wrap:wrap;">
                <button class="btn-danger" onclick="SAVE_EDIT_PERMISSION_REQ(null); CM('gm-tool-modal');">✕ Отменить запрос</button>
            </div>
        </div>
    `;
    OM('gm-tool-modal');
}

// Всплывающее окно разрешения у Игрока — теперь СВЕРХУ ПОСЕРЕДИНЕ!
function CHECK_AND_RENDER_PERMISSION_POPUP() {
    let popup = document.getElementById('player-gm-perm-popup');
    const sess = GET_SESSION();
    const req = GET_EDIT_PERMISSION_REQ();

    if (!sess || sess.role !== 'player' || !req || req.status !== 'pending' || req.charIdx !== (sess.playerIdx || 0)) {
        if (popup) popup.remove();
        return;
    }

    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'player-gm-perm-popup';
        popup.style.cssText = 'position:fixed; top:18px; left:50%; transform:translateX(-50%); width:440px; max-width:94vw; background:#1e1926; border:2px solid #c084fc; border-radius:12px; padding:18px 22px; box-shadow:0 14px 40px rgba(0,0,0,0.95); z-index:9999; color:#ebe8e2; text-align:center;';
        document.body.appendChild(popup);
    }

    const targetLabel = req.targetType === 'inventory' ? '🎒 вашему Рюкзаку (выдача/редактирование предметов)' : '📋 вашему Листу персонажа';

    popup.innerHTML = `
        <div style="display:flex; align-items:center; justify-content:center; gap:10px; margin-bottom:8px;">
            <span style="font-size:1.5rem;">👑</span>
            <b style="color:#e9d5ff; font-size:1.1rem;">Запрос от Гейм-Мастера</b>
        </div>
        <p style="font-size:0.95rem; color:#ddd; margin-bottom:14px; line-height:1.45;">
            Мастер просит доступ к <b>${targetLabel}</b> героя <b style="color:#e6c88c;">${req.charName}</b>.
        </p>
        <div style="display:flex; flex-direction:column; gap:8px;">
            <div style="display:flex; gap:8px;">
                <button class="btn-save" style="flex:1; padding:10px;" onclick="PLAYER_RESPOND_GM_REQ('approved', false)">✅ Разрешить (1 раз)</button>
                <button class="btn-danger" style="flex:1; padding:10px;" onclick="PLAYER_RESPOND_GM_REQ('denied', false)">❌ Отклонить</button>
            </div>
            <button class="btn-small" style="background:#4c1d95; color:#fff; border-color:#c084fc; padding:9px;" onclick="PLAYER_RESPOND_GM_REQ('approved', true)">
                🤝 Разрешить и включить «Авто-подтверждение»
            </button>
        </div>
    `;
}

function PLAYER_RESPOND_GM_REQ(status, enableAlways) {
    const req = GET_EDIT_PERMISSION_REQ();
    if (!req) return;
    if (enableAlways) {
        const cs = GC();
        if (cs[req.charIdx]) {
            cs[req.charIdx].autoApproveGM = true;
            SC(cs);
            APPLY_ROLE_VIEW();
        }
    }
    req.status = status;
    SAVE_EDIT_PERMISSION_REQ(req);
    CHECK_AND_RENDER_PERMISSION_POPUP();
}

function CHECK_GM_PERMISSION_RESPONSE() {
    const sess = GET_SESSION();
    if (!sess || sess.role !== 'gm') return;
    const req = GET_EDIT_PERMISSION_REQ();
    if (!req || req.status === 'pending') return;

    const charIdx = req.charIdx;
    const targetType = req.targetType;
    const status = req.status;
    const charName = req.charName;
    SAVE_EDIT_PERMISSION_REQ(null);

    if (status === 'approved') {
        EXECUTE_GM_OPEN_TARGET(charIdx, targetType);
    } else if (status === 'denied') {
        CM('gm-tool-modal');
        showMessage('❌ Доступ отклонён', `Игрок «<b>${charName}</b>» отклонил запрос на редактирование.`);
    }
}

// Отдельный журнал истории диалогов с NPC (чтобы НЕ засорять чат игроков!)
function GET_NPC_LOG() {
    const d = localStorage.getItem('dnd_npc_dialog_log');
    return d ? JSON.parse(d) : [];
}
function ADD_TO_NPC_LOG(speaker, text) {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const list = GET_NPC_LOG();
    list.push(`[${time}] ${speaker}: ${text}`);
    if (list.length > 100) list.shift();
    localStorage.setItem('dnd_npc_dialog_log', JSON.stringify(list));
}

// ================================================================
// 4. КАРТА, ПОГОДНЫЕ ЭФФЕКТЫ, ФИШКИ И ЖИВАЯ НОВЕЛЛА
// ================================================================
function GENERATE_WEATHER_OVERLAY_HTML(weather) {
    if (!weather || weather === 'none') return '';
    if (weather === 'night') {
        return `<div style="position:absolute; inset:0; background:radial-gradient(circle, rgba(10,15,40,0.35) 0%, rgba(4,6,20,0.75) 100%); pointer-events:none; z-index:4;"></div>`;
    }
    if (weather === 'rain') {
        return `<div style="position:absolute; inset:0; pointer-events:none; z-index:4; background:repeating-linear-gradient(105deg, transparent 0px, transparent 18px, rgba(120,180,255,0.18) 18px, rgba(120,180,255,0.18) 20px); box-shadow:inset 0 0 60px rgba(10,25,50,0.6);"></div>`;
    }
    if (weather === 'snow') {
        return `<div style="position:absolute; inset:0; pointer-events:none; z-index:4; background:radial-gradient(circle, rgba(255,255,255,0.12) 1px, transparent 2px); background-size:28px 28px; box-shadow:inset 0 0 70px rgba(200,230,255,0.28);"></div>`;
    }
    if (weather === 'ash') {
        return `<div style="position:absolute; inset:0; pointer-events:none; z-index:4; background:radial-gradient(circle, rgba(255,110,40,0.22) 1.5px, transparent 2.5px); background-size:34px 34px; box-shadow:inset 0 0 80px rgba(120,25,0,0.45);"></div>`;
    }
    return '';
}

function RENDER_MAP_AREA() {
    const mapArea = document.getElementById('map-area');
    if (!mapArea) return;
    const st = GET_MAP_STATE();
    const vn = GET_ACTIVE_VN_DIALOG();
    const shop = GET_SHOP_STATE();
    const sess = GET_SESSION();
    const isGM = sess && sess.role === 'gm';
    const myPlayerIdx = (sess && sess.role === 'player') ? (sess.playerIdx || 0) : -1;
    const cs = GC();

    // 1. Шапка над картой: только «🗺️ Карта» и название локации посередине (без лишней кнопки лавки!)
    const mapPanel = mapArea.parentElement;
    if (mapPanel) {
        const h2 = mapPanel.querySelector('h2');
        if (h2) {
            const locTitle = (st.fog && !isGM) ? '🌫️ Неизвестная область (Туман войны)' : `📍 ${st.title || 'Окрестности Притишья'}`;
            const fogTag = (st.fog && isGM) ? ' <small style="color:#c084fc;">(Скрыто туманом)</small>' : '';

            h2.style.cssText = 'display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;';
            h2.innerHTML = `
                <span>🗺️ Карта</span>
                <span style="color:#c9a96e; font-size:1.05rem; font-weight:bold; text-align:center; flex:1;">
                    ${locTitle}${fogTag}
                    ${st.desc && (!st.fog || isGM) ? `<div style="color:#9e988e; font-size:0.8rem; font-weight:normal; margin-top:2px;">${st.desc}</div>` : ''}
                </span>
            `;
        }
    }

    // Единственная аккуратная кнопка Лавки у Игрока — под кнопкой «🎒 Рюкзак» слева
    let leftShopBtn = document.getElementById('player-left-shop-btn');
    const leftCol = document.getElementById('left-column');
    if (leftCol && !isGM) {
        if (shop && shop.active) {
            if (!leftShopBtn) {
                leftShopBtn = document.createElement('button');
                leftShopBtn.id = 'player-left-shop-btn';
                leftShopBtn.className = 'btn-save';
                const invBtn = Array.from(leftCol.querySelectorAll('button')).find(b => b.textContent.includes('Рюкзак'));
                if (invBtn) invBtn.after(leftShopBtn);
                else leftCol.prepend(leftShopBtn);
            }
            leftShopBtn.style.display = 'block';
            leftShopBtn.innerHTML = `🏪 Лавка: ${shop.title}`;
            leftShopBtn.onclick = OPEN_PLAYER_SHOP_MODAL;
        } else if (leftShopBtn) {
            leftShopBtn.style.display = 'none';
        }
    }

    const playerLeftVN = (!isGM && vn && vn.active && vn.leftPlayers && vn.leftPlayers.includes(myPlayerIdx));
    const showVN = (vn && vn.active && !playerLeftVN);

    mapArea.style.position = 'relative';
    mapArea.style.overflow = 'hidden';
    mapArea.style.padding = '0';
    mapArea.style.userSelect = 'none';
    mapArea.style.cursor = (isGM && window._gmPinPlacementMode) ? 'crosshair' : 'default';

    mapArea.onclick = function(e) {
        if (!isGM || !window._gmPinPlacementMode) return;
        const rect = mapArea.getBoundingClientRect();
        const xPct = Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10;
        const yPct = Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10;
        window._gmPinPlacementMode = false;
        OPEN_GM_CREATE_PIN_MODAL(xPct, yPct);
    };

    mapArea.onmousemove = function(e) {
        if (!window._draggingMapObj) return;
        const rect = mapArea.getBoundingClientRect();
        const xPct = Math.max(4, Math.min(96, Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10));
        const yPct = Math.max(6, Math.min(94, Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10));
        const el = document.getElementById(window._draggingMapObj.domId);
        if (el) {
            el.style.left = xPct + '%';
            el.style.top = yPct + '%';
        }
        window._draggingMapObj.lastX = xPct;
        window._draggingMapObj.lastY = yPct;
        window._draggingMapObj.moved = true;
    };

    mapArea.onmouseup = function() {
        if (!window._draggingMapObj) return;
        const drag = window._draggingMapObj;
        window._draggingMapObj = null;
        if (!drag.moved) return;
        const curSt = GET_MAP_STATE();
        if (drag.type === 'token' && curSt.tokens[drag.index]) {
            curSt.tokens[drag.index].x = drag.lastX;
            curSt.tokens[drag.index].y = drag.lastY;
            SAVE_MAP_STATE(curSt);
        } else if (drag.type === 'pin' && curSt.pins[drag.index]) {
            curSt.pins[drag.index].x = drag.lastX;
            curSt.pins[drag.index].y = drag.lastY;
            SAVE_MAP_STATE(curSt);
        }
        RENDER_MAP_AREA();
    };

    let baseMapHTML = '';

    if (st.fog && !isGM) {
        mapArea.style.background = '#0d0d0d';
        baseMapHTML = `
            <div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:30px; color:#888;">
                <div style="font-size:3rem; margin-bottom:10px;">🌫️</div>
                <div style="font-size:1.15rem; color:#c9a96e; font-weight:bold;">Скрыто туманом войны</div>
            </div>`;
    } else if (st.img) {
        baseMapHTML = `<img src="${st.img}" alt="Карта" style="width:100%; height:100%; object-fit:cover; display:block; pointer-events:none; ${st.fog && isGM ? 'opacity:0.45;' : ''}">`;
    } else {
        mapArea.style.background = 'radial-gradient(circle, #25221e 0%, #141312 100%)';
        baseMapHTML = `
            <div style="width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:25px; text-align:center; pointer-events:none;">
                <div style="font-size:2.4rem; margin-bottom:8px;">🗺️</div>
                <div style="font-size:1.25rem; color:#e6c88c; font-weight:bold;">📍 ${st.title || 'Карта кампании'}</div>
                <div style="font-size:0.95rem; color:#aba498; margin-top:6px; max-width:85%;">${st.desc || ''}</div>
            </div>`;
    }

    let gridOverlayHTML = '';
    if (st.grid && (!st.fog || isGM)) {
        const gs = st.gridSize || 48;
        const gc = st.gridColor || 'rgba(201, 169, 110, 0.22)';
        gridOverlayHTML = `
            <div style="position:absolute; inset:0; pointer-events:none; z-index:2;
                background-size: ${gs}px ${gs}px;
                background-image: linear-gradient(to right, ${gc} 1px, transparent 1px), linear-gradient(to bottom, ${gc} 1px, transparent 1px);">
            </div>`;
    }
    const weatherOverlayHTML = (!st.fog || isGM) ? GENERATE_WEATHER_OVERLAY_HTML(st.weather) : '';

    let topFloatingButtonsHTML = '';
    if (playerLeftVN && vn && vn.active && !showVN) {
        topFloatingButtonsHTML = `
            <div style="position:absolute; top:10px; left:50%; transform:translateX(-50%); z-index:9;">
                <button class="btn-small" style="background:#7c3aed; color:#fff; border-color:#c084fc;" onclick="event.stopPropagation(); PLAYER_REJOIN_VN_DIALOG();">
                    🎭 Вернуться в диалог с «${vn.name}»
                </button>
            </div>`;
    }

    let turnBarHTML = '';
    if ((!st.fog || isGM) && st.tokens && st.tokens.length > 0 && st.turnOrder && st.turnOrder.active && !showVN) {
        const curTurnIdx = (st.turnOrder.currentIdx || 0) % st.tokens.length;
        const activeTok = st.tokens[curTurnIdx];
        turnBarHTML = `
            <div style="position:absolute; top:8px; left:10px; right:10px; background:rgba(18,17,16,0.92); border:1px solid #c9a96e; border-radius:8px; padding:6px 12px; z-index:8; display:flex; justify-content:space-between; align-items:center; gap:8px; box-shadow:0 4px 14px rgba(0,0,0,0.8);">
                <div style="font-size:0.88rem; color:#e6c88c;">
                    ⚔️ <b>Раунд ${st.turnOrder.round || 1}</b> • Сейчас ходит: <b style="color:#4cd964; font-size:0.98rem;">${activeTok ? activeTok.name : '—'}</b>
                </div>
                ${isGM ? `
                    <div style="display:flex; gap:6px;">
                        <button class="btn-small btn-save" style="padding:3px 10px; font-size:0.8rem;" onclick="event.stopPropagation(); GM_NEXT_TURN();">⏭️ След. ход</button>
                        <button class="btn-small btn-danger" style="padding:3px 8px; font-size:0.8rem;" onclick="event.stopPropagation(); GM_STOP_INITIATIVE();">✕</button>
                    </div>` : `<span style="font-size:0.78rem; color:#aaa;">Перетащите свою фишку мышкой</span>`
                }
            </div>`;
    }

    let pinsOverlayHTML = '';
    if ((!st.fog || isGM) && st.pins && st.pins.length > 0 && !showVN) {
        st.pins.forEach((pin, pIdx) => {
            if (pin.hidden && !isGM) return;
            pinsOverlayHTML += `
                <div id="map-pin-${pIdx}"
                     onmousedown="event.stopPropagation(); ${isGM ? `START_DRAG_MAP_OBJ('pin', ${pIdx}, 'map-pin-${pIdx}')` : ''}"
                     onclick="event.stopPropagation(); INTERACT_WITH_MAP_PIN(${pIdx});"
                     oncontextmenu="event.preventDefault(); event.stopPropagation(); ${isGM ? `GM_DELETE_MAP_PIN(${pIdx})` : ''};"
                     title="${pin.label}${isGM ? ' (ЛКМ — тест/перетаскивание, ПКМ — удалить)' : ' (Нажмите для взаимодействия)'}"
                     style="position:absolute; left:${pin.x}%; top:${pin.y}%; transform:translate(-50%, -50%); z-index:5; cursor:pointer; display:flex; flex-direction:column; align-items:center;">
                    <div style="width:38px; height:38px; border-radius:50%; background:rgba(20,18,16,0.92); border:2px solid ${pin.color || '#c9a96e'}; box-shadow:0 4px 12px rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:center; font-size:1.3rem;">
                        ${pin.icon || '📍'}
                    </div>
                    <span style="background:rgba(15,14,13,0.9); color:#e6c88c; font-size:0.74rem; font-weight:bold; padding:1px 6px; border-radius:4px; border:1px solid #423c33; margin-top:2px; white-space:nowrap;">
                        ${pin.label}
                    </span>
                </div>`;
        });
    }

    let tokensOverlayHTML = '';
    if ((!st.fog || isGM) && st.tokens && st.tokens.length > 0 && !showVN) {
        const curTurnIdx = (st.turnOrder && st.turnOrder.active) ? ((st.turnOrder.currentIdx || 0) % st.tokens.length) : -1;
        st.tokens.forEach((tok, tIdx) => {
            let hp = tok.hp ?? 10, maxHp = tok.maxHp || 10, avatar = tok.avatar || '', name = tok.name;
            if (tok.isPlayer && cs[tok.charIdx]) {
                const ch = cs[tok.charIdx];
                hp = ch.hp ?? 10;
                maxHp = ch.maxHp || 10;
                avatar = ch.avatar || '';
                name = ch.name || name;
            }
            const isMyToken = (!isGM && tok.isPlayer && tok.charIdx === myPlayerIdx);
            const canDrag = isGM || isMyToken;
            const isCurrentTurn = (tIdx === curTurnIdx);
            const borderCol = isCurrentTurn ? '#facc15' : (tok.isPlayer ? '#4cd964' : '#ef4444');
            const hpPct = Math.max(0, Math.min(100, Math.round((hp / Math.max(1, maxHp)) * 100)));

            tokensOverlayHTML += `
                <div id="map-tok-${tIdx}"
                     onmousedown="event.stopPropagation(); ${canDrag ? `START_DRAG_MAP_OBJ('token', ${tIdx}, 'map-tok-${tIdx}')` : ''}"
                     onclick="event.stopPropagation(); CLICK_MAP_TOKEN(${tIdx});"
                     oncontextmenu="event.preventDefault(); event.stopPropagation(); ${isGM ? `GM_REMOVE_TOKEN(${tIdx})` : ''};"
                     title="${name} (ХП: ${hp}/${maxHp})${canDrag ? ' — Зажмите мышкой, чтобы передвинуть!' : ''}"
                     style="position:absolute; left:${tok.x}%; top:${tok.y}%; transform:translate(-50%, -50%); z-index:6; cursor:${canDrag ? 'grab' : 'pointer'}; display:flex; flex-direction:column; align-items:center;">
                    <div style="width:46px; height:46px; border-radius:50%; background:#181715; border:3px solid ${borderCol}; box-shadow:${isCurrentTurn ? '0 0 16px #facc15' : '0 4px 12px rgba(0,0,0,0.9)'}; overflow:hidden; display:flex; align-items:center; justify-content:center; font-size:1.45rem;">
                        ${avatar ? `<img src="${avatar}" style="width:100%; height:100%; object-fit:cover; pointer-events:none;">` : (tok.icon || (tok.isPlayer ? '🛡️' : '👹'))}
                    </div>
                    <div style="width:44px; height:5px; background:#111; border:1px solid #000; border-radius:3px; margin-top:3px; overflow:hidden;">
                        <div style="width:${hpPct}%; height:100%; background:${tok.isPlayer ? '#4cd964' : '#ef4444'};"></div>
                    </div>
                    <span style="background:rgba(12,11,10,0.92); color:${tok.isPlayer ? '#a7f3d0' : '#fca5a5'}; font-size:0.72rem; font-weight:bold; padding:1px 6px; border-radius:4px; margin-top:2px; white-space:nowrap;">
                        ${name} (${hp})
                    </span>
                </div>`;
        });
    }

    let placementBanner = '';
    if (isGM && window._gmPinPlacementMode) {
        placementBanner = `
            <div style="position:absolute; top:10px; left:50%; transform:translateX(-50%); background:#c9a96e; color:#181510; font-weight:bold; padding:6px 16px; border-radius:20px; z-index:15; box-shadow:0 4px 15px rgba(0,0,0,0.8);">
                🎯 Кликните в любое место на карте, чтобы поставить интерактивный значок!
            </div>`;
    }

    // 5. РЕЖИМ ВИЗУАЛЬНОЙ НОВЕЛЛЫ:
    // СВЕРХУ — Реплика NPC, а НИЖЕ НЕЁ в нижней части карты — ответы игроков (и собственные, и выбранные)!
    let vnOverlayHTML = '';
    if (showVN) {
        const portraitHTML = vn.avatar
            ? `<img src="${vn.avatar}" alt="${vn.name}" style="max-height:190px; max-width:210px; object-fit:contain; filter:drop-shadow(0 6px 18px rgba(0,0,0,0.95)); border-radius:10px; border:2px solid #c9a96e; background:#181715;">`
            : `<div style="width:96px; height:96px; border-radius:50%; background:radial-gradient(circle, #3a3222 0%, #181715 100%); border:3px solid #c9a96e; display:flex; align-items:center; justify-content:center; font-size:2.6rem; box-shadow:0 8px 25px rgba(0,0,0,0.9);">🎭</div>`;

        const replies = vn.playerReplies || (vn.lastPlayerReply ? [vn.lastPlayerReply] : []);
        let playerRepliesBelowHTML = '';
        if (replies.length > 0) {
            playerRepliesBelowHTML = `
                <div style="margin-top:8px; padding-top:6px; border-top:1px dashed #3d3830; max-height:68px; overflow-y:auto; display:flex; flex-direction:column; gap:4px;">
                    ${replies.slice(-3).map(r => `
                        <div style="background:rgba(46,90,46,0.28); border-left:3px solid #52b758; padding:4px 10px; border-radius:4px; font-size:0.86rem; color:#d8f3dc;">
                            🗣️ <b style="color:#86efac;">${r.sender}:</b> «${r.text}»
                        </div>
                    `).join('')}
                </div>
            `;
        }

        let leftInfoForGM = '';
        if (isGM && vn.leftPlayers && vn.leftPlayers.length > 0) {
            const leftNames = vn.leftPlayers.map(idx => cs[idx]?.name || ('Игрок ' + (idx + 1))).join(', ');
            leftInfoForGM = `<span style="color:#e06060; font-size:0.78rem; margin-left:10px;">(🚪 Отошли: ${leftNames})</span>`;
        }

        let playerControlsHTML = '';
        if (!isGM) {
            let choicesBtns = '';
            if (vn.choices && vn.choices.length > 0) {
                choicesBtns = vn.choices.map((chText, cIdx) => {
                    const isLeaveOpt = /^(уйти|отойти|покинуть|закончить разговор)/i.test(chText.trim());
                    return `<button class="btn-small" style="background:${isLeaveOpt ? '#4a1d1d' : '#2b251c'}; color:${isLeaveOpt ? '#fca5a5' : '#e6c88c'}; border:1px solid ${isLeaveOpt ? '#a84a4a' : '#c9a96e'}; padding:5px 11px; font-size:0.83rem;" onclick="PLAYER_CHOOSE_VN_OPTION(${cIdx})">
                        ${isLeaveOpt ? '🚪 ' : '💬 '}${chText}
                    </button>`;
                }).join('');
            }
            choicesBtns += `<button class="btn-small btn-danger" style="padding:5px 11px; font-size:0.82rem;" onclick="PLAYER_LEAVE_VN_DIALOG()">🚪 Отойти от NPC</button>`;

            playerControlsHTML = `
                <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:8px;">${choicesBtns}</div>
                <div style="display:flex; gap:6px; margin-top:7px;">
                    <input type="text" id="vn-player-free-input" placeholder="💬 Написать свой ответ этому NPC..."
                           onkeypress="if(event.key==='Enter') PLAYER_SEND_CUSTOM_VN_REPLY();"
                           style="flex:1; background:#141312; color:#fff; border:1px solid #5c503e; padding:6px 10px; border-radius:6px; font-size:0.88rem; text-align:left;">
                    <button class="btn-small btn-save" style="padding:6px 14px;" onclick="PLAYER_SEND_CUSTOM_VN_REPLY()">Ответить</button>
                </div>
            `;
        } else {
            playerControlsHTML = `
                <div style="display:flex; gap:6px; margin-top:8px; align-items:center;">
                    <input type="text" id="vn-gm-quick-reply" placeholder="👑 Напишите новую фразу от лица «${vn.name}» и нажмите Enter..."
                           onkeypress="if(event.key==='Enter') GM_QUICK_UPDATE_VN_TEXT();"
                           style="flex:1; background:#141312; color:#e6c88c; border:1px solid #9b59b6; padding:6px 10px; border-radius:6px; font-size:0.88rem; text-align:left;">
                    <button class="btn-small btn-save" style="padding:6px 12px;" onclick="GM_QUICK_UPDATE_VN_TEXT()">Сказать за NPC</button>
                    <button class="btn-small" style="padding:6px 10px;" onclick="OPEN_GM_NPC_MODAL()">⚙️ Сменить NPC / Варианты</button>
                </div>
            `;
        }

        vnOverlayHTML = `
            <div style="position:absolute; inset:0; background:rgba(0,0,0,0.4); display:flex; flex-direction:column; justify-content:flex-end; z-index:10;" onclick="event.stopPropagation();">
                <div style="flex:1; display:flex; align-items:flex-end; justify-content:center; padding-bottom:4px; overflow:hidden; pointer-events:none;">
                    ${portraitHTML}
                </div>
                <div style="min-height:48%; max-height:66%; background:linear-gradient(180deg, rgba(20,18,16,0.97) 0%, rgba(12,11,10,0.99) 100%); border-top:2px solid #c9a96e; padding:12px 18px; text-align:left; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 -8px 24px rgba(0,0,0,0.9);">
                    <div>
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px; flex-wrap:wrap; gap:6px;">
                            <div>
                                <span style="background:#c9a96e; color:#181510; font-weight:bold; padding:2px 11px; border-radius:4px; font-size:0.98rem;">
                                    🎭 ${vn.name || 'NPC'}
                                </span>
                                ${vn.role ? `<span style="color:#a39c90; font-size:0.84rem; margin-left:8px;">— ${vn.role}</span>` : ''}
                                ${leftInfoForGM}
                            </div>
                            ${isGM ? `<button class="btn-small btn-danger" style="padding:3px 9px; font-size:0.78rem;" onclick="GM_HIDE_VN_DIALOG()">✕ Завершить диалог</button>` : ''}
                        </div>

                        <!-- 1. Реплика NPC сверху -->
                        <div style="color:#f5f3ef; font-size:1.02rem; line-height:1.45; overflow-y:auto; max-height:70px; padding-right:6px; font-family:Georgia, serif;">
                            «${vn.text || '...'}»
                        </div>

                        <!-- 2. Ответы игроков (собственные или выбранные) — ПРЯМО ПОД РЕПЛИКОЙ NPC! -->
                        ${playerRepliesBelowHTML}

                        <!-- 3. Кнопки выбора и строка ввода -->
                        ${playerControlsHTML}
                    </div>
                </div>
            </div>`;
    }

    mapArea.innerHTML = baseMapHTML + gridOverlayHTML + weatherOverlayHTML + topFloatingButtonsHTML + turnBarHTML + pinsOverlayHTML + tokensOverlayHTML + placementBanner + vnOverlayHTML;
}

function START_DRAG_MAP_OBJ(type, index, domId) {
    window._draggingMapObj = { type, index, domId, moved: false };
}

// Свободный ответ игрока (показывается под репликой NPC в новелле и НЕ засоряет чат игроков!)
function PLAYER_SEND_CUSTOM_VN_REPLY() {
    const inp = document.getElementById('vn-player-free-input');
    const text = inp ? inp.value.trim() : '';
    if (!text) return;

    const vn = GET_ACTIVE_VN_DIALOG();
    if (!vn) return;
    const cs = GC();
    const sess = GET_SESSION();
    const myIdx = sess ? (sess.playerIdx || 0) : 0;
    const heroName = (cs[myIdx] && cs[myIdx].name) ? cs[myIdx].name : 'Игрок';

    if (/^(ухожу|уйти|я ухожу)$/i.test(text)) {
        PLAYER_LEAVE_VN_DIALOG();
        return;
    }

    if (!vn.playerReplies) vn.playerReplies = [];
    vn.playerReplies.push({ sender: heroName, text: text, time: Date.now() });
    SAVE_ACTIVE_VN_DIALOG(vn);
    ADD_TO_NPC_LOG(`🗣️ ${heroName} (к ${vn.name})`, `«${text}»`);
    RENDER_MAP_AREA();
}

// Выбор готового варианта ответа (показывается под репликой NPC в новелле и НЕ засоряет чат игроков!)
function PLAYER_CHOOSE_VN_OPTION(choiceIdx) {
    const vn = GET_ACTIVE_VN_DIALOG();
    if (!vn || !vn.choices || !vn.choices[choiceIdx]) return;
    const chosenText = vn.choices[choiceIdx];

    const isLeaveOpt = /^(уйти|отойти|покинуть|закончить разговор)/i.test(chosenText.trim());
    if (isLeaveOpt) {
        PLAYER_LEAVE_VN_DIALOG();
        return;
    }

    const cs = GC();
    const sess = GET_SESSION();
    const myIdx = sess ? (sess.playerIdx || 0) : 0;
    const heroName = (cs[myIdx] && cs[myIdx].name) ? cs[myIdx].name : 'Игрок';

    if (!vn.playerReplies) vn.playerReplies = [];
    vn.playerReplies.push({ sender: heroName, text: chosenText, time: Date.now() });
    SAVE_ACTIVE_VN_DIALOG(vn);
    ADD_TO_NPC_LOG(`🗣️ ${heroName} (выбор к ${vn.name})`, `«${chosenText}»`);
    RENDER_MAP_AREA();
}

function PLAYER_LEAVE_VN_DIALOG() {
    const vn = GET_ACTIVE_VN_DIALOG();
    if (!vn) return;
    const sess = GET_SESSION();
    const myIdx = sess ? (sess.playerIdx || 0) : 0;
    const cs = GC();
    const heroName = (cs[myIdx] && cs[myIdx].name) ? cs[myIdx].name : 'Игрок';

    if (!vn.leftPlayers) vn.leftPlayers = [];
    if (!vn.leftPlayers.includes(myIdx)) {
        vn.leftPlayers.push(myIdx);
    }
    SAVE_ACTIVE_VN_DIALOG(vn);
    ADD_TO_NPC_LOG(`🚪 ${heroName}`, `отошёл от разговора с «${vn.name}»`);
    RENDER_MAP_AREA();
}

function PLAYER_REJOIN_VN_DIALOG() {
    const vn = GET_ACTIVE_VN_DIALOG();
    if (!vn || !vn.leftPlayers) return;
    const sess = GET_SESSION();
    const myIdx = sess ? (sess.playerIdx || 0) : 0;
    vn.leftPlayers = vn.leftPlayers.filter(id => id !== myIdx);
    SAVE_ACTIVE_VN_DIALOG(vn);
    RENDER_MAP_AREA();
}

// Когда Мастер пишет новую фразу за NPC — очищаем старые ответы на предыдущую фразу и показываем новую речь NPC
function GM_QUICK_UPDATE_VN_TEXT() {
    const inp = document.getElementById('vn-gm-quick-reply');
    const newText = inp ? inp.value.trim() : '';
    if (!newText) return;
    const vn = GET_ACTIVE_VN_DIALOG();
    if (!vn) return;

    vn.text = newText;
    vn.playerReplies = []; // Очищаем ответы на прошлую реплику, чтобы под новой фразой NPC появлялись свежие ответы
    vn.time = Date.now();
    SAVE_ACTIVE_VN_DIALOG(vn);
    ADD_TO_NPC_LOG(`🎭 ${vn.name}`, `«${newText}»`);
    RENDER_MAP_AREA();
}

// ================================================================
// 5. МАГАЗИН / ЛАВКА ТОРГОВЦА И БЫСТРАЯ РАЗДАЧА НАГРАД (ЛУТА И XP)
// ================================================================
function OPEN_GM_SHOP_MODAL() {
    const shop = GET_SHOP_STATE();
    const cont = document.getElementById('gm-tool-modal-content');
    cont.style.maxWidth = '920px';

    let datalistOptions = '';
    if (gameData.items && gameData.items.catalog) {
        gameData.items.catalog.forEach(item => { datalistOptions += `<option value="${item.name}">${item.name} (${item.price || ''})</option>`; });
    }

    const rowsHTML = (shop.items || []).map((it, idx) => `
        <tr>
            <td><b>${it.name}</b></td>
            <td><input type="number" min="0" value="${it.priceGp}" onchange="GM_UPDATE_SHOP_ITEM(${idx}, 'priceGp', parseInt(this.value))" style="width:80px;"> зм</td>
            <td><input type="number" min="0" value="${it.stock}" onchange="GM_UPDATE_SHOP_ITEM(${idx}, 'stock', parseInt(this.value))" style="width:75px;"> шт.</td>
            <td><button class="btn-small btn-danger" onclick="GM_REMOVE_SHOP_ITEM(${idx})">🗑️</button></td>
        </tr>
    `).join('');

    cont.innerHTML = `
        <h2>🏪 Управление Лавкой Торговца</h2>
        <p style="color:#aba498; font-size:0.92rem; margin-bottom:14px;">
            Когда лавка открыта, у игроков на карте появляется кнопка <b>«🏪 Открыть лавку»</b>, и они сами могут покупать предметы за своё золото!
        </p>

        <div style="display:flex; justify-content:space-between; align-items:center; background:#181715; padding:12px 16px; border-radius:10px; border:1px solid #423c33; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; gap:10px; flex:1; min-width:280px;">
                <input type="text" id="gm-shop-title" value="${shop.title}" placeholder="Название лавки..." style="flex:1; text-align:left;">
                <input type="text" id="gm-shop-keeper" value="${shop.keeper}" placeholder="Имя торговца..." style="flex:1; text-align:left;">
            </div>
            <button class="${shop.active ? 'btn-danger' : 'btn-save'}" onclick="GM_TOGGLE_SHOP_ACTIVE()">
                ${shop.active ? '🔒 Закрыть лавку для игроков' : '🔓 Открыть лавку для игроков'}
            </button>
        </div>

        <table>
            <tr><th>Товар</th><th>Цена (Золото)</th><th>В наличии</th><th>Удалить</th></tr>
            ${rowsHTML || '<tr><td colspan="4" style="color:#777;">Товаров нет</td></tr>'}
        </table>

        <datalist id="gm-shop-datalist">${datalistOptions}</datalist>
        <div style="background:#181715; padding:12px; border-radius:8px; border:1px solid #423c33; display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
            <input type="text" id="new-shop-item-name" list="gm-shop-datalist" placeholder="Название предмета из базы или свой..." style="flex:2; text-align:left;">
            <input type="number" id="new-shop-item-price" placeholder="Цена (зм)" value="25" min="0" style="width:110px;">
            <input type="number" id="new-shop-item-stock" placeholder="Кол-во" value="3" min="1" style="width:90px;">
            <button class="btn-save" onclick="GM_ADD_SHOP_ITEM()">+ Добавить на витрину</button>
        </div>
        <div style="margin-top:16px; text-align:right;"><button onclick="CM('gm-tool-modal')">Закрыть</button></div>
    `;
    OM('gm-tool-modal');
}

function GM_TOGGLE_SHOP_ACTIVE() {
    const shop = GET_SHOP_STATE();
    shop.title = document.getElementById('gm-shop-title')?.value.trim() || shop.title;
    shop.keeper = document.getElementById('gm-shop-keeper')?.value.trim() || shop.keeper;
    shop.active = !shop.active;
    if (shop.active) shop.openedId = Date.now();
    SAVE_SHOP_STATE(shop);
    RENDER_MAP_AREA();
    RENDER_GM_LEFT_COLUMN();
    LOG_COMBAT_TO_CHAT(shop.active ? `🏪 Гейм-Мастер открыл лавку «${shop.title}» (${shop.keeper})!` : `🏪 Лавка «${shop.title}» закрылась.`);
    OPEN_GM_SHOP_MODAL();
}

function CHECK_UNSEEN_SHOP_OPEN() {
    const sess = GET_SESSION();
    if (!sess || sess.role !== 'player') return;
    const shop = GET_SHOP_STATE();
    if (!shop || !shop.active || !shop.openedId) return;
    const seenKey = 'dnd_seen_shop_' + (sess.playerIdx || 0);
    if (String(localStorage.getItem(seenKey)) !== String(shop.openedId)) {
        localStorage.setItem(seenKey, String(shop.openedId));
        OPEN_PLAYER_SHOP_MODAL();
    }
}

function GM_UPDATE_SHOP_ITEM(idx, field, val) {
    const shop = GET_SHOP_STATE();
    if (shop.items[idx]) {
        shop.items[idx][field] = Math.max(0, val || 0);
        SAVE_SHOP_STATE(shop);
    }
}

function GM_REMOVE_SHOP_ITEM(idx) {
    const shop = GET_SHOP_STATE();
    shop.items.splice(idx, 1);
    SAVE_SHOP_STATE(shop);
    OPEN_GM_SHOP_MODAL();
}

function GM_ADD_SHOP_ITEM() {
    const name = document.getElementById('new-shop-item-name')?.value.trim();
    if (!name) return;
    const priceGp = Math.max(0, parseInt(document.getElementById('new-shop-item-price')?.value) || 10);
    const stock = Math.max(1, parseInt(document.getElementById('new-shop-item-stock')?.value) || 1);
    const shop = GET_SHOP_STATE();
    shop.items.push({ name, priceGp, stock });
    SAVE_SHOP_STATE(shop);
    OPEN_GM_SHOP_MODAL();
}

// Витрина магазина для Игрока
function OPEN_PLAYER_SHOP_MODAL() {
    const shop = GET_SHOP_STATE();
    const cs = GC();
    const c = cs[PI];
    if (!c.money) c.money = { gp: 0, sp: 0, cp: 0 };
    const cont = document.getElementById('gm-tool-modal-content');
    cont.style.maxWidth = '780px';

    const itemsHTML = (shop.items || []).map((it, idx) => {
        const tpl = FIND_CATALOG_ITEM(it.name);
        const desc = tpl ? tpl.description : 'Товар торговца';
        const icon = tpl ? tpl.icon : '📦';
        const canBuy = (c.money.gp >= it.priceGp) && (it.stock > 0);
        return `
            <div style="background:#181715; border:1px solid #38332c; padding:10px 14px; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:12px;">
                <div style="text-align:left;">
                    <b>${icon} ${it.name}</b> <small style="color:#aaa;">(Осталось: ${it.stock} шт.)</small><br>
                    <small style="color:#888;">${desc}</small>
                </div>
                <div style="display:flex; align-items:center; gap:10px; flex-shrink:0;">
                    <b style="color:#e6c88c;">🪙 ${it.priceGp} зм</b>
                    <button class="btn-small btn-save" ${!canBuy ? 'disabled' : ''} onclick="PLAYER_BUY_SHOP_ITEM(${idx})">Купить</button>
                </div>
            </div>
        `;
    }).join('');

    cont.innerHTML = `
        <h2>🏪 ${shop.title}</h2>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px; background:#181715; padding:10px 14px; border-radius:8px; border:1px solid #423c33;">
            <span>Торговец: <b style="color:#e6c88c;">${shop.keeper}</b></span>
            <span>Ваш кошелёк: <b style="color:#4cd964;">🪙 ${c.money.gp || 0} зм</b> (${c.money.sp || 0} см, ${c.money.cp || 0} мм)</span>
        </div>
        <div style="max-height:420px; overflow-y:auto;">
            ${itemsHTML || '<p style="color:#777;">Прилавок пуст</p>'}
        </div>
        <div style="margin-top:16px; text-align:right;"><button onclick="CM('gm-tool-modal')">Уйти из лавки</button></div>
    `;
    OM('gm-tool-modal');
}

function PLAYER_BUY_SHOP_ITEM(idx) {
    const shop = GET_SHOP_STATE();
    const it = shop.items[idx];
    if (!it || it.stock <= 0) return;

    const cs = GC();
    const c = cs[PI];
    if (!c.money) c.money = { gp: 0, sp: 0, cp: 0 };
    if ((c.money.gp || 0) < it.priceGp) {
        showMessage('Недостаточно золота', 'У вас не хватает золотых монет (зм) для этой покупки.');
        return;
    }

    c.money.gp -= it.priceGp;
    it.stock -= 1;

    if (!c.inventory) c.inventory = [];
    const norm = (s) => (s || '').toLowerCase().replace(/ё/g, 'е').trim();
    const existing = c.inventory.find(item => !item.equipped && norm(item.name) === norm(it.name));
    if (existing) {
        existing.qty = String((parseInt(existing.qty) || 1) + 1);
    } else {
        c.inventory.push(CREATE_ITEM_OBJECT(it.name, '1', '', 'Куплено в лавке: ' + shop.title));
    }

    SAVE_SHOP_STATE(shop);
    SC(cs);
    RMC();
    LOG_COMBAT_TO_CHAT(`🛒 покупает «${it.name}» за ${it.priceGp} зм в лавке «${shop.title}»!`);
    OPEN_PLAYER_SHOP_MODAL();
}

// Окно быстрой выдачи Награды / Лута / Золота / Опыта (без входа в чужой рюкзак!)
function OPEN_GM_REWARD_MODAL() {
    const cs = GC();
    const cont = document.getElementById('gm-tool-modal-content');
    cont.style.maxWidth = '720px';

    let targetOpts = `<option value="all">👥 Всему отряду сразу (${cs.length} чел.)</option>`;
    cs.forEach((c, idx) => { targetOpts += `<option value="${idx}">👤 Только игроку: ${c.name || 'Герой ' + (idx + 1)}</option>`; });

    let datalistOptions = '';
    if (gameData.items && gameData.items.catalog) {
        gameData.items.catalog.forEach(item => { datalistOptions += `<option value="${item.name}">${item.name}</option>`; });
    }

    cont.innerHTML = `
        <h2>🎁 Выдать Награду (Предмет, Золото или Опыт)</h2>
        <p style="color:#aba498; font-size:0.9rem; margin-bottom:14px;">
            Позволяет мгновенно отправить награду за квест или бой игрокам с красивым всплывающим уведомлением!
        </p>
        <datalist id="gm-reward-items">${datalistOptions}</datalist>
        <div style="background:#181715; border:1px solid #423c33; padding:18px; border-radius:10px; display:flex; flex-direction:column; gap:12px;">
            <div>
                <label style="color:#c9a96e;">Кому вручить награду:</label>
                <select id="gm-rew-target" style="margin-top:4px; text-align:left;">${targetOpts}</select>
            </div>
            <div style="display:flex; gap:10px;">
                <div style="flex:2;">
                    <label style="color:#c9a96e;">Предмет (из базы D&D или свой):</label>
                    <input type="text" id="gm-rew-item" list="gm-reward-items" placeholder="Напр.: Зелье лечения, Старинный ключ..." style="margin-top:4px; text-align:left;">
                </div>
                <div style="flex:1;">
                    <label style="color:#c9a96e;">Кол-во шт.:</label>
                    <input type="number" id="gm-rew-qty" value="1" min="1" style="margin-top:4px;">
                </div>
            </div>
            <div style="display:flex; gap:10px;">
                <div style="flex:1;">
                    <label style="color:#c9a96e;">🪙 Золото (+зм):</label>
                    <input type="number" id="gm-rew-gold" value="0" min="0" style="margin-top:4px;">
                </div>
                <div style="flex:1;">
                    <label style="color:#c9a96e;">✨ Опыт (+XP):</label>
                    <input type="number" id="gm-rew-xp" value="0" min="0" step="50" style="margin-top:4px;">
                </div>
            </div>
            <button class="btn-save" style="padding:12px;" onclick="GM_SEND_REWARD()">🎁 Вручить награду</button>
        </div>
        <div style="margin-top:16px; text-align:right;"><button onclick="CM('gm-tool-modal')">Закрыть</button></div>
    `;
    OM('gm-tool-modal');
}

function GM_SEND_REWARD() {
    const target = document.getElementById('gm-rew-target')?.value || 'all';
    const itemName = document.getElementById('gm-rew-item')?.value.trim() || '';
    const qty = Math.max(1, parseInt(document.getElementById('gm-rew-qty')?.value) || 1);
    const gold = Math.max(0, parseInt(document.getElementById('gm-rew-gold')?.value) || 0);
    const xp = Math.max(0, parseInt(document.getElementById('gm-rew-xp')?.value) || 0);

    if (!itemName && !gold && !xp) {
        showMessage('Ошибка', 'Укажите хотя бы предмет, золото или опыт.');
        return;
    }

    const cs = GC();
    const indices = target === 'all' ? cs.map((_, i) => i) : [parseInt(target)];
    const norm = (s) => (s || '').toLowerCase().replace(/ё/g, 'е').trim();

    indices.forEach(i => {
        const ch = cs[i];
        if (!ch) return;
        if (itemName) {
            if (!ch.inventory) ch.inventory = [];
            const existing = ch.inventory.find(it => !it.equipped && norm(it.name) === norm(itemName));
            if (existing) existing.qty = String((parseInt(existing.qty) || 1) + qty);
            else ch.inventory.push(CREATE_ITEM_OBJECT(itemName, String(qty), '', 'Награда от Гейм-Мастера'));
        }
        if (gold > 0) {
            if (!ch.money) ch.money = { gp: 0, sp: 0, cp: 0 };
            ch.money.gp = (parseInt(ch.money.gp) || 0) + gold;
        }
        if (xp > 0) {
            ch.xp = (parseInt(ch.xp) || 0) + xp;
        }
    });

    SC(cs);
    RPL();

    let parts = [];
    if (itemName) parts.push(`📦 Предмет: <b>${itemName} (×${qty})</b>`);
    if (gold > 0) parts.push(`🪙 Золото: <b>+${gold} зм</b>`);
    if (xp > 0) parts.push(`✨ Опыт: <b>+${xp} XP</b>`);

    const evObj = { id: Date.now(), target, title: '🎁 Получена награда!', text: parts.join('<br>') };
    localStorage.setItem('dnd_gm_event', JSON.stringify(evObj));
    LOG_COMBAT_TO_CHAT(`🎁 Гейм-Мастер выдал награду (${parts.join(', ').replace(/<\/?b>/g, '')})!`);
    CM('gm-tool-modal');
    showMessage('✅ Награда вручена', parts.join('<br>'));
}

// ================================================================
// 6. ФИШКИ НА КАРТЕ, БЕСТИАРИЙ И АТАКИ МОНСТРОВ
// ================================================================
function CLICK_MAP_TOKEN(tIdx) {
    const st = GET_MAP_STATE();
    const tok = st.tokens && st.tokens[tIdx];
    if (!tok) return;
    const sess = GET_SESSION();
    const isGM = sess && sess.role === 'gm';

    if (!isGM) {
        showMessage(`${tok.icon || '♟️'} ${tok.name}`, `Здоровье: <b>${tok.hp}/${tok.maxHp} ХП</b> | Защита (КБ): <b>${tok.ac || 12}</b>`);
        return;
    }

    if (!tok.isPlayer) {
        OPEN_GM_BESTIARY_MODAL(tIdx);
    } else {
        GM_REQUEST_ACCESS(tok.charIdx, 'sheet');
    }
}

function GM_SPAWN_PARTY_TOKENS() {
    const st = GET_MAP_STATE();
    const cs = GC();
    if (!st.tokens) st.tokens = [];
    st.tokens = st.tokens.filter(t => !t.isPlayer);
    cs.forEach((c, idx) => {
        st.tokens.push({
            id: Date.now() + idx,
            isPlayer: true,
            charIdx: idx,
            name: c.name || ('Герой ' + (idx + 1)),
            icon: '🛡️',
            avatar: c.avatar || '',
            x: 25 + (idx * 12) % 55,
            y: 72,
            hp: c.hp ?? 10,
            maxHp: c.maxHp || 10,
            ac: CAC(c),
            init: Math.floor(Math.random() * 20) + 1 + GM(c.dex || 10)
        });
    });
    SAVE_MAP_STATE(st);
    RENDER_MAP_AREA();
    if (document.getElementById('gm-tool-modal')?.classList.contains('active')) {
        OPEN_GM_BESTIARY_MODAL();
    }
}

function GM_SPAWN_MONSTER_FROM_BESTIARY(bIdx) {
    const bestiary = GET_BESTIARY();
    const m = bestiary[bIdx];
    if (!m) return;
    const st = GET_MAP_STATE();
    if (!st.tokens) st.tokens = [];
    const countSame = st.tokens.filter(t => !t.isPlayer && t.name.startsWith(m.name)).length;
    const finalName = countSame > 0 ? `${m.name} #${countSame + 1}` : m.name;

    st.tokens.push({
        id: Date.now(),
        isPlayer: false,
        name: finalName,
        icon: m.icon || '👹',
        x: 30 + Math.floor(Math.random() * 40),
        y: 28 + Math.floor(Math.random() * 20),
        hp: m.hp || 15,
        maxHp: m.maxHp || 15,
        ac: m.ac || 13,
        atkBonus: m.atkBonus ?? 4,
        dmgFormula: m.dmgFormula || '1к6+2',
        init: Math.floor(Math.random() * 20) + 1
    });
    SAVE_MAP_STATE(st);
    RENDER_MAP_AREA();
    LOG_COMBAT_TO_CHAT(`👹 На карте появляется «${m.icon} ${finalName}» (ХП: ${m.hp}/${m.maxHp}, КБ: ${m.ac})!`);
    OPEN_GM_BESTIARY_MODAL();
}

function GM_REMOVE_TOKEN(tIdx) {
    const st = GET_MAP_STATE();
    if (!st.tokens || !st.tokens[tIdx]) return;
    st.tokens.splice(tIdx, 1);
    SAVE_MAP_STATE(st);
    RENDER_MAP_AREA();
    if (document.getElementById('gm-tool-modal')?.classList.contains('active')) {
        OPEN_GM_BESTIARY_MODAL();
    }
}

function GM_CHANGE_TOKEN_HP(tIdx, delta) {
    const st = GET_MAP_STATE();
    const tok = st.tokens && st.tokens[tIdx];
    if (!tok) return;
    tok.hp = Math.max(0, Math.min(tok.maxHp || 100, (tok.hp || 0) + delta));
    SAVE_MAP_STATE(st);
    RENDER_MAP_AREA();
    OPEN_GM_BESTIARY_MODAL(tIdx);
}

function GM_MONSTER_ATTACK_PLAYER(tIdx) {
    const st = GET_MAP_STATE();
    const tok = st.tokens && st.tokens[tIdx];
    if (!tok) return;

    const targetSelect = document.getElementById('gm-monster-target-' + tIdx);
    const charIdx = parseInt(targetSelect?.value) || 0;
    const cs = GC();
    const targetChar = cs[charIdx];
    if (!targetChar) return;

    const targetAC = CAC(targetChar);
    const d20 = Math.floor(Math.random() * 20) + 1;
    const atkBonus = parseInt(tok.atkBonus) || 0;
    const totalAtk = d20 + atkBonus;
    const isCrit = (d20 === 20);
    const isHit = isCrit || (d20 !== 1 && totalAtk >= targetAC);

    if (isHit) {
        let dmg = Math.max(1, ROLL(tok.dmgFormula || '1к6+2'));
        if (isCrit) dmg += Math.max(1, ROLL(tok.dmgFormula || '1к6'));
        targetChar.hp = Math.max(0, (targetChar.hp ?? 10) - dmg);
        SC(cs);
        RPL();
        RENDER_MAP_AREA();
        const critTxt = isCrit ? ' 💥 КРИТ 20!' : '';
        LOG_COMBAT_TO_CHAT(`👹 «${tok.name}» атакует «${targetChar.name}»! Попадание: ${d20}${MS(atkBonus)} = ${totalAtk} (против КБ ${targetAC})${critTxt} -> Нанесено ${dmg} урона! (У ${targetChar.name} осталось ${targetChar.hp}/${targetChar.maxHp} ХП)`);
    } else {
        LOG_COMBAT_TO_CHAT(`👹 «${tok.name}» атакует «${targetChar.name}», но ПРОМАХИВАЕТСЯ! Бросок: ${d20}${MS(atkBonus)} = ${totalAtk} (нужен КБ ${targetAC}).`);
    }
    OPEN_GM_BESTIARY_MODAL(tIdx);
}

function GM_START_INITIATIVE() {
    const st = GET_MAP_STATE();
    if (!st.tokens || st.tokens.length === 0) {
        GM_SPAWN_PARTY_TOKENS();
    }
    const freshSt = GET_MAP_STATE();
    freshSt.tokens.sort((a, b) => (b.init || 10) - (a.init || 10));
    freshSt.turnOrder = { active: true, round: 1, currentIdx: 0 };
    SAVE_MAP_STATE(freshSt);
    RENDER_MAP_AREA();
    const first = freshSt.tokens[0];
    LOG_COMBAT_TO_CHAT(`⚔️ Инициатива брошена! Начинается Раунд 1. Первым ходит: «${first ? first.name : 'Герой'}»!`);
    if (document.getElementById('gm-tool-modal')?.classList.contains('active')) {
        OPEN_GM_BESTIARY_MODAL();
    }
}

function GM_NEXT_TURN() {
    const st = GET_MAP_STATE();
    if (!st.tokens || !st.tokens.length) return;
    if (!st.turnOrder) st.turnOrder = { active: true, round: 1, currentIdx: 0 };
    st.turnOrder.currentIdx = (st.turnOrder.currentIdx + 1);
    if (st.turnOrder.currentIdx >= st.tokens.length) {
        st.turnOrder.currentIdx = 0;
        st.turnOrder.round = (st.turnOrder.round || 1) + 1;
    }
    const curTok = st.tokens[st.turnOrder.currentIdx];
    SAVE_MAP_STATE(st);
    RENDER_MAP_AREA();
    LOG_COMBAT_TO_CHAT(`⏭️ [Раунд ${st.turnOrder.round}] Переход хода -> Теперь ходит «${curTok.name}»!`);
}

function GM_STOP_INITIATIVE() {
    const st = GET_MAP_STATE();
    if (st.turnOrder) st.turnOrder.active = false;
    SAVE_MAP_STATE(st);
    RENDER_MAP_AREA();
}

function OPEN_GM_BESTIARY_MODAL(highlightTokIdx = -1) {
    const st = GET_MAP_STATE();
    const bestiary = GET_BESTIARY();
    const cs = GC();
    const cont = document.getElementById('gm-tool-modal-content');
    cont.style.maxWidth = '1040px';

    let playerOpts = cs.map((c, i) => `<option value="${i}">🎯 ${c.name || 'Герой'} (ХП: ${c.hp ?? 10}/${c.maxHp || 10}, КБ: ${CAC(c)})</option>`).join('');

    const activeTokensHTML = (st.tokens || []).map((tok, tIdx) => {
        const isHl = (tIdx === highlightTokIdx);
        return `
            <div style="background:${isHl ? '#2d2320' : '#22201d'}; border:1px solid ${isHl ? '#ef4444' : '#423c33'}; padding:10px 12px; border-radius:8px; margin-bottom:8px;">
                <div style="display:flex; justify-content:space-between; align-items:center; gap:8px; flex-wrap:wrap;">
                    <div>
                        <b>${tok.icon || '♟️'} ${tok.name}</b>
                        <span style="color:#aaa; font-size:0.85rem;">(КБ ${tok.ac || 12} | Иниц: ${tok.init || 10})</span>
                    </div>
                    <div style="display:flex; align-items:center; gap:6px;">
                        <button class="btn-small btn-danger" style="padding:2px 8px;" onclick="GM_CHANGE_TOKEN_HP(${tIdx}, -3)">-3 ХП</button>
                        <b style="color:#4cd964;">❤️ ${tok.hp}/${tok.maxHp}</b>
                        <button class="btn-small btn-save" style="padding:2px 8px;" onclick="GM_CHANGE_TOKEN_HP(${tIdx}, 3)">+3 ХП</button>
                        <button class="btn-small btn-danger" style="padding:2px 7px;" onclick="GM_REMOVE_TOKEN(${tIdx})">🗑️</button>
                    </div>
                </div>
                ${!tok.isPlayer ? `
                    <div style="display:flex; gap:8px; align-items:center; margin-top:8px; padding-top:8px; border-top:1px dashed #38332c; flex-wrap:wrap;">
                        <small style="color:#e6c88c;">Атака (${MS(tok.atkBonus||0)}, урон ${tok.dmgFormula||'1к6'}):</small>
                        <select id="gm-monster-target-${tIdx}" style="flex:1; min-width:170px; padding:4px 8px; text-align:left;">${playerOpts}</select>
                        <button class="btn-small btn-danger" onclick="GM_MONSTER_ATTACK_PLAYER(${tIdx})">⚔️ Ударить игрока</button>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');

    const bestiaryCards = bestiary.map((m, bIdx) => `
        <div style="background:#22201d; border:1px solid #423c33; padding:10px 12px; border-radius:8px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center; gap:10px;">
            <div style="text-align:left;">
                <b style="color:#e6c88c;">${m.icon} ${m.name}</b> <small style="color:#aaa;">(ХП ${m.hp}, КБ ${m.ac}, Атака +${m.atkBonus}, Урон ${m.dmgFormula})</small><br>
                <small style="color:#888;">${m.desc || ''}</small>
            </div>
            <div style="display:flex; gap:6px; flex-shrink:0;">
                <button class="btn-small btn-save" onclick="GM_SPAWN_MONSTER_FROM_BESTIARY(${bIdx})">➕ На карту</button>
                <button class="btn-small btn-danger" onclick="GM_DELETE_BESTIARY_ITEM(${bIdx})">✕</button>
            </div>
        </div>
    `).join('');

    cont.innerHTML = `
        <h2>👹 Бестиарий, Фишки на карте и Очередь Ходов</h2>
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:16px; background:#181715; padding:12px; border-radius:10px; border:1px solid #423c33;">
            <button class="btn-save" onclick="GM_SPAWN_PARTY_TOKENS()">👥 Выставить фишки всех игроков на карту</button>
            <button onclick="GM_START_INITIATIVE()">⚡ Бросить Инициативу и включить Очередь Ходов</button>
            ${st.turnOrder && st.turnOrder.active ? `<button class="btn-small" onclick="GM_NEXT_TURN()">⏭️ Следующий ход</button>` : ''}
            <button class="btn-small btn-danger" onclick="GM_CLEAR_ALL_TOKENS()">🗑️ Убрать все фишки с карты</button>
        </div>

        <div style="display:grid; grid-template-columns: 1.15fr 1fr; gap:20px; align-items:start;">
            <div>
                <h3 style="margin-top:0;">♟️ Активные фишки на карте (${(st.tokens||[]).length})</h3>
                <div style="max-height:380px; overflow-y:auto;">
                    ${activeTokensHTML || '<p style="color:#777;">На карте пока нет фишек. Нажмите «Выставить фишки игроков» или добавьте врага справа.</p>'}
                </div>
            </div>

            <div>
                <h3 style="margin-top:0;">📚 Бестиарий Мастера (Заготовки врагов)</h3>
                <div style="max-height:240px; overflow-y:auto; margin-bottom:12px;">
                    ${bestiaryCards}
                </div>

                <div style="background:#181715; border:1px solid #423c33; padding:12px; border-radius:8px;">
                    <div style="color:#c9a96e; font-weight:bold; font-size:0.9rem; margin-bottom:8px;">➕ Добавить своего врага в Бестиарий:</div>
                    <div style="display:flex; gap:6px; margin-bottom:6px;">
                        <input type="text" id="bestiary-icon" value="👹" style="width:55px;" placeholder="Иконка">
                        <input type="text" id="bestiary-name" placeholder="Имя врага (напр. Тролль)" style="flex:1; text-align:left;">
                    </div>
                    <div style="display:flex; gap:6px; margin-bottom:6px;">
                        <input type="number" id="bestiary-hp" placeholder="ХП (30)" value="25" style="flex:1;" title="ХП врага">
                        <input type="number" id="bestiary-ac" placeholder="КБ (14)" value="14" style="flex:1;" title="Класс Брони">
                        <input type="number" id="bestiary-atk" placeholder="Бонус атк (+5)" value="5" style="flex:1;" title="Бонус к попаданию">
                        <input type="text" id="bestiary-dmg" placeholder="Урон (2к6+3)" value="1к8+3" style="flex:1;" title="Формула урона">
                    </div>
                    <button class="btn-small btn-save" style="width:100%;" onclick="GM_ADD_TO_BESTIARY()">💾 Сохранить в Бестиарий</button>
                </div>
            </div>
        </div>
        <div style="margin-top:16px; text-align:right;"><button onclick="CM('gm-tool-modal')">Закрыть</button></div>
    `;
    OM('gm-tool-modal');
}

function GM_ADD_TO_BESTIARY() {
    const name = document.getElementById('bestiary-name')?.value.trim();
    if (!name) return;
    const list = GET_BESTIARY();
    list.push({
        name,
        icon: document.getElementById('bestiary-icon')?.value.trim() || '👹',
        hp: parseInt(document.getElementById('bestiary-hp')?.value) || 20,
        maxHp: parseInt(document.getElementById('bestiary-hp')?.value) || 20,
        ac: parseInt(document.getElementById('bestiary-ac')?.value) || 13,
        atkBonus: parseInt(document.getElementById('bestiary-atk')?.value) || 4,
        dmgFormula: document.getElementById('bestiary-dmg')?.value.trim() || '1к6+2',
        desc: 'Созданный противник'
    });
    SAVE_BESTIARY(list);
    OPEN_GM_BESTIARY_MODAL();
}

function GM_DELETE_BESTIARY_ITEM(bIdx) {
    const list = GET_BESTIARY();
    list.splice(bIdx, 1);
    SAVE_BESTIARY(list);
    OPEN_GM_BESTIARY_MODAL();
}

function GM_CLEAR_ALL_TOKENS() {
    const st = GET_MAP_STATE();
    st.tokens = [];
    if (st.turnOrder) st.turnOrder.active = false;
    SAVE_MAP_STATE(st);
    RENDER_MAP_AREA();
    OPEN_GM_BESTIARY_MODAL();
}

function OPEN_GM_SKILL_CHECK_MODAL() {
    const cs = GC();
    const cont = document.getElementById('gm-tool-modal-content');
    cont.style.maxWidth = '680px';

    let targetOpts = `<option value="all">👥 Всему отряду сразу</option>`;
    cs.forEach((c, idx) => { targetOpts += `<option value="${idx}">👤 Только: ${c.name || 'Игрок ' + (idx + 1)}</option>`; });

    const saves = ['Спасбросок: Сила', 'Спасбросок: Ловкость', 'Спасбросок: Телосложение', 'Спасбросок: Интеллект', 'Спасбросок: Мудрость', 'Спасбросок: Харизма'];
    const allChecks = saves.concat(gameData.allSkills || []);
    const checkOpts = allChecks.map(s => `<option value="${s}">${s}</option>`).join('');

    cont.innerHTML = `
        <h2>🎯 Запросить проверку навыка или спасбросок у игроков</h2>
        <div style="background:#181715; border:1px solid #423c33; padding:18px; border-radius:10px; display:flex; flex-direction:column; gap:12px;">
            <div>
                <label style="color:#c9a96e;">Кому отправить проверку:</label>
                <select id="gm-check-target" style="margin-top:4px; text-align:left;">${targetOpts}</select>
            </div>
            <div style="display:flex; gap:12px;">
                <div style="flex:2;">
                    <label style="color:#c9a96e;">Навык или Спасбросок:</label>
                    <select id="gm-check-name" style="margin-top:4px; text-align:left;">${checkOpts}</select>
                </div>
                <div style="flex:1;">
                    <label style="color:#c9a96e;">Сложность (Сл / DC):</label>
                    <input type="number" id="gm-check-dc" value="14" min="5" max="30" style="margin-top:4px;">
                </div>
            </div>
            <div>
                <label style="color:#c9a96e;">Причина / Описание ситуации (необязательно):</label>
                <input type="text" id="gm-check-reason" placeholder="Напр.: Попытка заметить засаду в кустах..." style="margin-top:4px; text-align:left;">
            </div>
            <button class="btn-save" style="padding:12px;" onclick="GM_SEND_SKILL_CHECK_REQ()">📣 Отправить запрос броска на экраны игроков</button>
        </div>
        <div style="margin-top:16px; text-align:right;"><button onclick="CM('gm-tool-modal')">Закрыть</button></div>
    `;
    OM('gm-tool-modal');
}

function GM_SEND_SKILL_CHECK_REQ() {
    const target = document.getElementById('gm-check-target')?.value || 'all';
    const checkName = document.getElementById('gm-check-name')?.value || 'Восприятие';
    const dc = parseInt(document.getElementById('gm-check-dc')?.value) || 12;
    const reason = document.getElementById('gm-check-reason')?.value.trim() || '';

    SAVE_SKILL_CHECK_REQ({ id: Date.now(), target, checkName, dc, reason, rolledBy: {} });
    LOG_COMBAT_TO_CHAT(`🎯 Гейм-Мастер запрашивает проверку «${checkName}» (Сложность ${dc})${reason ? ' — ' + reason : ''}!`);
    CM('gm-tool-modal');
}

function OPEN_GM_NOTES_MODAL() {
    const notes = localStorage.getItem('dnd_gm_secret_notes') || '';
    const cont = document.getElementById('gm-tool-modal-content');
    cont.style.maxWidth = '780px';
    cont.innerHTML = `
        <h2>📓 Секретный блокнот Мастера и Управление сохранением</h2>
        <textarea id="gm-secret-notes-area" style="min-height:200px;" placeholder="Секреты сюжета, имена случайных NPC, загадки, лут в тайниках...">${notes}</textarea>
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; gap:8px;">
                <button class="btn-small" onclick="GM_EXPORT_CAMPAIGN()">💾 Скачать бэкап кампании (.json)</button>
                <button class="btn-small" onclick="GM_IMPORT_CAMPAIGN()">📂 Загрузить бэкап (.json)</button>
            </div>
            <div style="display:flex; gap:8px;">
                <button class="btn-save" onclick="localStorage.setItem('dnd_gm_secret_notes', document.getElementById('gm-secret-notes-area').value); CM('gm-tool-modal');">💾 Сохранить заметки</button>
                <button onclick="CM('gm-tool-modal')">Закрыть</button>
            </div>
        </div>
    `;
    OM('gm-tool-modal');
}

function GM_EXPORT_CAMPAIGN() {
    const data = {
        characters: GC(),
        mapState: GET_MAP_STATE(),
        npcs: GET_NPCS(),
        events: GET_PREPARED_EVENTS(),
        bestiary: GET_BESTIARY(),
        shop: GET_SHOP_STATE(),
        lore: GET_CUSTOM_LORE(),
        tasks: localStorage.getItem('dnd_tasks') || '',
        gmNotes: localStorage.getItem('dnd_gm_secret_notes') || ''
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dnd_campaign_backup.json';
    a.click();
}

function GM_IMPORT_CAMPAIGN() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.onchange = function(e) {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = function(ev) {
            try {
                const d = JSON.parse(ev.target.result);
                if (d.characters) SC(d.characters);
                if (d.mapState) SAVE_MAP_STATE(d.mapState);
                if (d.npcs) SAVE_NPCS(d.npcs);
                if (d.events) SAVE_PREPARED_EVENTS(d.events);
                if (d.bestiary) SAVE_BESTIARY(d.bestiary);
                if (d.shop) SAVE_SHOP_STATE(d.shop);
                if (d.lore) SAVE_CUSTOM_LORE(d.lore);
                if (d.tasks !== undefined) localStorage.setItem('dnd_tasks', d.tasks);
                if (d.gmNotes !== undefined) localStorage.setItem('dnd_gm_secret_notes', d.gmNotes);
                APPLY_ROLE_VIEW();
                CM('gm-tool-modal');
                showMessage('✅ Кампания загружена', 'Все персонажи, карты, NPC и заготовки успешно восстановлены из файла!');
            } catch (err) {
                showMessage('Ошибка', 'Не удалось прочитать файл сохранения.');
            }
        };
        r.readAsText(f);
    };
    inp.click();
}

// ================================================================
// 7. ИНТЕРАКТИВНЫЕ ЗНАЧКИ НА КАРТЕ, КАРТА И ВИЗУАЛЬНАЯ НОВЕЛЛА
// ================================================================
function INTERACT_WITH_MAP_PIN(pinIdx) {
    const st = GET_MAP_STATE();
    const pin = st.pins && st.pins[pinIdx];
    if (!pin) return;

    const cs = GC();
    const c = cs[PI];

    if (pin.oneTime && pin.used) {
        showMessage(`${pin.icon} ${pin.label}`, 'Здесь уже ничего не осталось (объект был использован ранее).');
        return;
    }

    let extraEffectHTML = '';

    if (pin.itemReward && c) {
        if (!c.inventory) c.inventory = [];
        const norm = (s) => (s || '').toLowerCase().replace(/ё/g, 'е').trim();
        const existing = c.inventory.find(item => !item.equipped && norm(item.name) === norm(pin.itemReward));
        if (existing) {
            existing.qty = String((parseInt(existing.qty) || 1) + 1);
        } else {
            c.inventory.push(CREATE_ITEM_OBJECT(pin.itemReward, '1', '', 'Найдено на карте: ' + pin.label));
        }
        extraEffectHTML += `<br><br>🎁 <b>Получен предмет в рюкзак:</b> <span style="color:#e6c88c;">${pin.itemReward}</span>`;
    }

    if (pin.goldReward && parseInt(pin.goldReward) > 0 && c) {
        if (!c.money) c.money = { gp: 0, sp: 0, cp: 0 };
        c.money.gp = (parseInt(c.money.gp) || 0) + parseInt(pin.goldReward);
        extraEffectHTML += `<br>🪙 <b>Найдено золото:</b> <span style="color:#e6c88c;">+${pin.goldReward} зм</span>`;
    }

    if (pin.hpEffect && parseInt(pin.hpEffect) !== 0 && c) {
        const val = parseInt(pin.hpEffect);
        if (val < 0) {
            c.hp = Math.max(0, (c.hp ?? 10) + val);
            extraEffectHTML += `<br>🩸 <b>Урон от объекта:</b> <span style="color:#e06060;">${val} ХП</span> (осталось ${c.hp}/${c.maxHp} ХП)`;
        } else {
            c.hp = Math.min(c.maxHp || 10, (c.hp ?? 10) + val);
            extraEffectHTML += `<br>💚 <b>Исцеление:</b> <span style="color:#52b758;">+${val} ХП</span> (теперь ${c.hp}/${c.maxHp} ХП)`;
        }
    }

    if (pin.oneTime) {
        pin.used = true;
        SAVE_MAP_STATE(st);
    }

    SC(cs);
    RMC();
    RENDER_MAP_AREA();
    LOG_COMBAT_TO_CHAT(`📍 взаимодействует с «${pin.icon} ${pin.label}» на карте!`);
    showMessage(`${pin.icon} ${pin.label}`, `<div style="font-size:1.05rem; line-height:1.5;">${pin.actionText || 'Вы осмотрели это место.'}${extraEffectHTML}</div>`);
}

function GM_DELETE_MAP_PIN(pinIdx) {
    if (!confirm('Удалить этот значок с карты?')) return;
    const st = GET_MAP_STATE();
    if (st.pins) st.pins.splice(pinIdx, 1);
    SAVE_MAP_STATE(st);
    RENDER_MAP_AREA();
}

function START_MAP_PIN_PLACEMENT() {
    CM('gm-tool-modal');
    window._gmPinPlacementMode = true;
    RENDER_MAP_AREA();
}

function OPEN_GM_CREATE_PIN_MODAL(xPct = 50, yPct = 50) {
    const cont = document.getElementById('gm-tool-modal-content');
    cont.style.maxWidth = '920px';

    let datalistOptions = '';
    if (gameData.items && gameData.items.catalog) {
        gameData.items.catalog.forEach(item => { datalistOptions += `<option value="${item.name}">${item.name}</option>`; });
    }

    cont.innerHTML = `
        <h2>📍 Создание интерактивного значка на карте (Координаты: ${xPct}%, ${yPct}%)</h2>
        <div style="margin-bottom:14px; display:flex; gap:8px; flex-wrap:wrap;">
            <span style="color:#c9a96e; font-weight:bold; align-self:center;">⚡ Быстрые шаблоны:</span>
            <button class="btn-small" onclick="FILL_PIN_PRESET('💰', 'Сундук с сокровищем', '#eab308', 'Вы открываете тяжёлый окованный сундук!', 'Зелье лечения', 25, 0, true)">💰 Сундук с лутом</button>
            <button class="btn-small" onclick="FILL_PIN_PRESET('⚠️', 'Скрытая ловушка', '#ef4444', 'Под ногой щёлкает нажимная плита и из стены вылетают дротики!', '', 0, -5, true)">⚠️ Ловушка (-5 ХП)</button>
            <button class="btn-small" onclick="FILL_PIN_PRESET('⛲', 'Целебный источник', '#22c55e', 'Чистая ключевая вода наполняет вас жизненной силой.', '', 0, 8, true)">⛲ Источник (+8 ХП)</button>
            <button class="btn-small" onclick="FILL_PIN_PRESET('📜', 'Древний алтарь', '#38bdf8', 'На каменном постаменте высечены руны древней Империи...', '', 0, 0, false)">📜 Записка / Осмотр</button>
            <button class="btn-small" onclick="FILL_PIN_PRESET('🚪', 'Запертая дверь', '#a855f7', 'Массивная дубовая дверь заперта на сложный замок (Сл 15 Воровских инструментов).', '', 0, 0, false)">🚪 Дверь / Проход</button>
        </div>

        <datalist id="gm-pin-items-list">${datalistOptions}</datalist>
        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:18px; align-items:start;">
            <div style="background:#181715; border:1px solid #423c33; padding:16px; border-radius:10px; display:flex; flex-direction:column; gap:10px;">
                <h3 style="margin-top:0;">Внешний вид значка</h3>
                <div style="display:flex; gap:10px;">
                    <div style="width:90px;">
                        <label style="color:#c9a96e; font-size:0.88rem;">Иконка:</label>
                        <input type="text" id="pin-icon" value="📍" style="margin-top:4px; font-size:1.3rem;">
                    </div>
                    <div style="flex:1;">
                        <label style="color:#c9a96e; font-size:0.88rem;">Подпись на карте:</label>
                        <input type="text" id="pin-label" value="Интересное место" style="margin-top:4px; text-align:left;">
                    </div>
                </div>
                <div>
                    <label style="color:#c9a96e; font-size:0.88rem;">Текст при нажатии игрока на значок:</label>
                    <textarea id="pin-text">Вы внимательно осматриваете это место...</textarea>
                </div>
            </div>

            <div style="background:#181715; border:1px solid #423c33; padding:16px; border-radius:10px; display:flex; flex-direction:column; gap:10px;">
                <h3 style="margin-top:0;">Автоматический интерактив (необязательно)</h3>
                <div>
                    <label style="color:#c9a96e; font-size:0.88rem;">🎁 Выдать предмет кликнувшему игроку:</label>
                    <input type="text" id="pin-item" list="gm-pin-items-list" placeholder="Напр.: Зелье лечения, Старый ключ..." style="margin-top:4px; text-align:left;">
                </div>
                <div style="display:flex; gap:10px;">
                    <div style="flex:1;">
                        <label style="color:#c9a96e; font-size:0.88rem;">🪙 Золото (+зм):</label>
                        <input type="number" id="pin-gold" value="0" min="0" style="margin-top:4px;">
                    </div>
                    <div style="flex:1;">
                        <label style="color:#c9a96e; font-size:0.88rem;">❤️ Эффект ХП (-урон / +хил):</label>
                        <input type="number" id="pin-hp" value="0" style="margin-top:4px;">
                    </div>
                </div>
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; margin-top:4px;">
                    <input type="checkbox" id="pin-onetime">
                    <span>Одноразовый объект (сундук/ловушка срабатывает только 1 раз)</span>
                </label>
            </div>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:16px;">
            <button class="btn-save" onclick="CONFIRM_CREATE_MAP_PIN(${xPct}, ${yPct})">✅ Поставить значок на карту</button>
            <button onclick="CM('gm-tool-modal')">Отмена</button>
        </div>
    `;
    OM('gm-tool-modal');
}

function FILL_PIN_PRESET(icon, label, color, text, item, gold, hp, oneTime) {
    document.getElementById('pin-icon').value = icon;
    document.getElementById('pin-label').value = label;
    document.getElementById('pin-text').value = text;
    document.getElementById('pin-item').value = item;
    document.getElementById('pin-gold').value = gold;
    document.getElementById('pin-hp').value = hp;
    document.getElementById('pin-onetime').checked = !!oneTime;
}

function CONFIRM_CREATE_MAP_PIN(xPct, yPct) {
    const st = GET_MAP_STATE();
    if (!st.pins) st.pins = [];
    st.pins.push({
        id: Date.now(),
        x: xPct,
        y: yPct,
        icon: document.getElementById('pin-icon')?.value.trim() || '📍',
        label: document.getElementById('pin-label')?.value.trim() || 'Точка',
        actionText: document.getElementById('pin-text')?.value.trim() || '',
        itemReward: document.getElementById('pin-item')?.value.trim() || '',
        goldReward: parseInt(document.getElementById('pin-gold')?.value) || 0,
        hpEffect: parseInt(document.getElementById('pin-hp')?.value) || 0,
        oneTime: !!document.getElementById('pin-onetime')?.checked,
        used: false
    });
    SAVE_MAP_STATE(st);
    CM('gm-tool-modal');
    RENDER_MAP_AREA();
}

// ================================================================
// 8. РОЛИ, ЛОББИ И СТОЛ ГЕЙМ-МАСТЕРА
// ================================================================
function SHOW_LOBBY_SCREEN() {
    SAVE_SESSION(null);
    APPLY_ROLE_VIEW();
}

function CREATE_NEW_ROOM_AS_GM() {
    const nameInp = document.getElementById('lobby-new-room-name')?.value.trim() || 'Новая кампания';
    const rooms = GET_ROOMS();
    const code = String(Math.floor(1000 + Math.random() * 9000));
    rooms.push({ code, name: nameInp, createdAt: new Date().toLocaleDateString() });
    SAVE_ROOMS(rooms);
    ENTER_ROOM_AS_GM(code);
}

function ENTER_ROOM_AS_GM(roomCode) {
    SAVE_SESSION({ role: 'gm', roomCode: roomCode || '1001', playerIdx: 0 });
    APPLY_ROLE_VIEW();
}

function ENTER_ROOM_AS_PLAYER(roomCode, charIdx) {
    const cs = GC();
    let targetIdx = parseInt(charIdx);
    if (isNaN(targetIdx) || targetIdx < 0 || targetIdx >= cs.length) targetIdx = 0;
    PI = targetIdx;
    SAVE_SESSION({ role: 'player', roomCode: roomCode || '1001', playerIdx: targetIdx });
    APPLY_ROLE_VIEW();
}

function CREATE_NEW_HERO_AND_JOIN(roomCode) {
    const name = prompt('Введите имя вашего нового персонажа:', 'Новый герой');
    if (name === null) return;
    const cs = GC();
    const newChar = CREATE_DEFAULT_CHAR();
    newChar.name = name.trim() || ('Герой ' + (cs.length + 1));
    cs.push(newChar);
    SC(cs);
    ENTER_ROOM_AS_PLAYER(roomCode, cs.length - 1);
}

function APPLY_ROLE_VIEW() {
    const sess = GET_SESSION();
    const mainLayout = document.querySelector('.main-layout');
    const leftCol = document.getElementById('left-column');
    const centerCol = document.getElementById('center-column');
    const h1 = document.querySelector('h1');

    let lobbyScreen = document.getElementById('lobby-screen');
    if (!lobbyScreen) {
        lobbyScreen = document.createElement('div');
        lobbyScreen.id = 'lobby-screen';
        document.body.prepend(lobbyScreen);
    }

    let gmLeftMenu = document.getElementById('gm-left-menu');
    if (!gmLeftMenu && leftCol) {
        gmLeftMenu = document.createElement('div');
        gmLeftMenu.id = 'gm-left-menu';
        gmLeftMenu.style.display = 'none';
        gmLeftMenu.style.flexDirection = 'column';
        gmLeftMenu.style.gap = '12px';
        leftCol.before(gmLeftMenu);
    }

    let mapEditBtnWrap = document.getElementById('gm-map-edit-btn-wrap');
    if (!mapEditBtnWrap && centerCol) {
        const mapPanel = centerCol.querySelector('.panel');
        if (mapPanel) {
            mapEditBtnWrap = document.createElement('div');
            mapEditBtnWrap.id = 'gm-map-edit-btn-wrap';
            mapEditBtnWrap.style.marginTop = '12px';
            mapEditBtnWrap.style.display = 'none';
            mapEditBtnWrap.innerHTML = `
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button style="flex:1;" onclick="OPEN_GM_MAP_MODAL()">🗺️ Редактор Карты и Погоды</button>
                    <button class="btn-save" style="flex:1;" onclick="START_MAP_PIN_PLACEMENT()">📍 + Значок на карту</button>
                    <button style="flex:1;" onclick="OPEN_GM_BESTIARY_MODAL()">♟️ Фишки и Бестиарий</button>
                    <button class="btn-rest" style="flex:1;" onclick="OPEN_GM_NPC_MODAL()">🎭 Диалог NPC (Новелла)</button>
                </div>
            `;
            mapPanel.appendChild(mapEditBtnWrap);
        }
    }

    let topStatusBar = document.getElementById('role-status-bar');
    if (!topStatusBar) {
        topStatusBar = document.createElement('div');
        topStatusBar.id = 'role-status-bar';
        topStatusBar.style.cssText = 'max-width:1780px; margin:0 auto 14px auto; display:none; justify-content:space-between; align-items:center; background:#181715; border:1px solid #423c33; padding:10px 18px; border-radius:10px; flex-wrap:wrap; gap:10px;';
        h1.before(topStatusBar);
    }

    if (!document.getElementById('gm-tool-modal')) {
        const m = document.createElement('div');
        m.className = 'modal';
        m.id = 'gm-tool-modal';
        m.innerHTML = `<div class="modal-content" id="gm-tool-modal-content" style="max-width:1020px; width:96%;"></div>`;
        m.addEventListener('click', function(e) { if (e.target === this) this.classList.remove('active'); });
        document.body.appendChild(m);
    }

    if (!sess) {
        lobbyScreen.style.display = 'block';
        mainLayout.style.display = 'none';
        topStatusBar.style.display = 'none';
        h1.style.display = 'none';
        RENDER_LOBBY_HTML();
        return;
    }

    const rooms = GET_ROOMS();
    const curRoom = rooms.find(r => r.code === sess.roomCode) || rooms[0];
    lobbyScreen.style.display = 'none';
    mainLayout.style.display = 'flex';
    topStatusBar.style.display = 'flex';
    h1.style.display = 'block';
    h1.innerHTML = `⚔️ ${curRoom.name} <small style="font-size:0.6em; color:#888;">(Комната #${curRoom.code})</small> ⚔️`;

    if (sess.role === 'player') {
        PI = sess.playerIdx || 0;
        const cs = GC();
        if (PI >= cs.length) PI = 0;
        const curChar = cs[PI] || {};

        leftCol.style.display = 'flex';
        gmLeftMenu.style.display = 'none';
        if (mapEditBtnWrap) mapEditBtnWrap.style.display = 'none';

        topStatusBar.innerHTML = `
            <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
                <span style="background:#2e5a2e; color:#fff; padding:4px 10px; border-radius:6px; font-weight:bold; font-size:0.9rem;">⚔️ Режим Игрока</span>
                <span>Герой: <b style="color:#c9a96e;">${curChar.name || 'Безымянный'}</b></span>
                <label style="display:flex; align-items:center; gap:6px; cursor:pointer; background:#25221e; padding:4px 10px; border-radius:6px; border:1px solid #423c33; font-size:0.88rem; color:#e6c88c;">
                    <input type="checkbox" ${curChar.autoApproveGM ? 'checked' : ''} onchange="TOGGLE_AUTO_APPROVE_GM(this.checked)" style="width:16px; height:16px; accent-color:#c9a96e;">
                    <span>🤝 Авто-подтверждение правок Мастера</span>
                </label>
            </div>
            <button class="btn-small" onclick="SHOW_LOBBY_SCREEN()">🚪 Сменить роль / Выйти в Лобби</button>
        `;

        RMC(); LDT(); RCH(); RENDER_MAP_AREA(); RENDER_CUSTOM_LORE();
        CHECK_AND_RENDER_REST_POPUP();
        CHECK_AND_RENDER_PERMISSION_POPUP();
        CHECK_AND_RENDER_SKILL_ROLL_POPUP();
        CHECK_UNSEEN_GM_EVENT();
        CHECK_UNSEEN_SHOP_OPEN();
    } else if (sess.role === 'gm') {
        leftCol.style.display = 'none';
        gmLeftMenu.style.display = 'flex';
        if (mapEditBtnWrap) mapEditBtnWrap.style.display = 'block';

        topStatusBar.innerHTML = `
            <div style="display:flex; align-items:center; gap:14px; flex-wrap:wrap;">
                <span style="background:#7c3aed; color:#fff; padding:4px 12px; border-radius:6px; font-weight:bold; font-size:0.9rem;">👑 Режим Гейм-Мастера</span>
                <span>Комната: <b style="color:#e6c88c;">#${curRoom.code} — ${curRoom.name}</b></span>
                <span style="color:#aaa; font-size:0.88rem;">(Фишки и значки на карте можно перетаскивать мышкой!)</span>
            </div>
            <button class="btn-small" onclick="SHOW_LOBBY_SCREEN()">🚪 Выйти в Лобби</button>
        `;

        RENDER_GM_LEFT_COLUMN();
        RPL();
        LDT(); RCH(); RENDER_MAP_AREA(); RENDER_CUSTOM_LORE();
    }
}

function RENDER_GM_LEFT_COLUMN() {
    const gmLeftMenu = document.getElementById('gm-left-menu');
    if (!gmLeftMenu) return;
    gmLeftMenu.style.flex = '0 0 340px';
    gmLeftMenu.style.width = '340px';

    const cs = GC();
    const anyInCombat = cs.some(m => m.inCombat);
    const curTasks = localStorage.getItem('dnd_tasks') || 'Задачи не добавлены.';
    const shop = GET_SHOP_STATE();

    gmLeftMenu.innerHTML = `
        <div class="panel" style="text-align:center;">
            <h2>👑 Пульт Мастера</h2>
            <div style="display:flex; flex-direction:column; gap:8px; margin-top:10px;">
                <button onclick="OPEN_GM_EVENTS_MODAL()">⚡ События (Заготовки / На ходу)</button>
                <button onclick="OPEN_GM_SKILL_CHECK_MODAL()">🎯 Запросить проверку (Бросок)</button>
                <button onclick="OPEN_GM_REWARD_MODAL()">🎁 Выдать Награду (Лут / XP)</button>
                <button onclick="OPEN_GM_SHOP_MODAL()">🏪 Лавка Торговца ${shop.active ? '🟢' : ''}</button>
                <button onclick="OPEN_GM_DICE_MODAL()">🎲 Кубики Мастера</button>
                <button class="btn-rest" onclick="OPEN_GM_NOTES_MODAL()">📓 Блокнот Мастера и Бэкап</button>
            </div>
        </div>

        <div class="panel">
            <h2>📋 Задачи отряда</h2>
            <div onclick="OPEN_GM_TASKS_MODAL()" style="background:#161514; border:1px solid #38332c; padding:12px; border-radius:8px; min-height:70px; font-size:0.92rem; white-space:pre-wrap; cursor:pointer; color:#d8d4cc;">${curTasks}</div>
            <button class="btn-small" style="width:100%; margin-top:8px;" onclick="OPEN_GM_TASKS_MODAL()">✏️ Изменить задачи</button>
        </div>

        <button onclick="OPEN_GM_LORE_MODAL()">📖 Лорбук (Редактор Мастера)</button>
        <button class="${anyInCombat ? 'btn-danger' : 'btn-save'}" onclick="GM_TOGGLE_PARTY_COMBAT()">
            ${anyInCombat ? '🏳️ Завершить БОЙ у отряда' : '⚔️ Начать БОЙ для отряда'}
        </button>
        <button class="btn-rest" onclick="EXECUTE_LONG_REST_FOR_PARTY()">🌙 Провести Длинный отдых отряду</button>
    `;
}

function RENDER_CUSTOM_LORE() {
    const loreModal = document.getElementById('lorebook-modal');
    if (!loreModal) return;
    const container = loreModal.querySelector('.modal-content > div');
    if (!container) return;

    let customBox = document.getElementById('gm-custom-lore-box');
    if (!customBox) {
        customBox = document.createElement('div');
        customBox.id = 'gm-custom-lore-box';
        container.appendChild(customBox);
    }
    const list = GET_CUSTOM_LORE();
    customBox.innerHTML = list.map((entry, idx) => {
        const sess = GET_SESSION();
        const delBtn = (sess && sess.role === 'gm') ? ` <button class="btn-small btn-danger" style="padding:2px 6px; font-size:0.75rem;" onclick="GM_DELETE_LORE(${idx})">Удалить</button>` : '';
        return `<hr><p><strong>${entry.title}</strong> — ${entry.text}${delBtn}</p>`;
    }).join('');
}

const _ORIG_RPL = RPL;
RPL = function() {
    const sess = GET_SESSION();
    const isGM = sess && sess.role === 'gm';
    if (!isGM) {
        _ORIG_RPL();
        return;
    }

    const cs = GC();
    const con = document.getElementById('party-list');
    if (!con) return;
    con.innerHTML = '';

    const hint = document.createElement('div');
    hint.style.cssText = 'color:#c9a96e; font-size:0.9rem; margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px;';
    hint.innerHTML = `
        <span>👆 <b>Нажмите на игрока</b>, чтобы запросить доступ к его Листу Персонажа или Рюкзаку:</span>
        <div style="display:flex; gap:6px;">
            <button class="btn-small" onclick="ADD_TEST_PARTY_MEMBER(); RPL();">+ Игрок</button>
            ${cs.length > 1 ? '<button class="btn-small btn-danger" onclick="REMOVE_LAST_PARTY_MEMBER(); RPL();">− Убрать</button>' : ''}
        </div>
    `;
    con.appendChild(hint);

    cs.forEach((c, idx) => {
        const maxS = GET_SPELL_SLOTS(c);
        const usedS = c.usedSpellSlots || {};
        let totM = 0, totU = 0;
        for (let k = 1; k <= 9; k++) { if (maxS[k] > 0) { totM += maxS[k]; totU += (usedS[k] || 0); } }
        const slotsTxt = totM > 0 ? `${totM - totU}/${totM}` : '—';

        const d = document.createElement('div');
        d.className = 'party-member';
        d.style.cursor = 'pointer';
        d.onclick = function() { GM_REQUEST_ACCESS(idx, 'sheet'); };

        const ah = c.avatar ? '<img class="party-avatar" src="' + c.avatar + '" alt="">' : '<div class="party-avatar-placeholder">👤</div>';
        const combatBadge = c.inCombat ? ' <span style="color:#e06060;font-size:0.85em;">⚔️ В бою</span>' : '';
        const trustBadge = c.autoApproveGM
            ? ' <span style="color:#52b758; font-size:0.78em;">🤝 Доверяет</span>'
            : ' <span style="color:#c9a96e; font-size:0.78em;">🔒 По запросу</span>';

        d.innerHTML = ah +
            '<div class="party-info">' +
                '<div class="party-name">' + (c.name || 'Безымянный') + combatBadge + trustBadge + '</div>' +
                '<div class="party-detail">' + (c.race || 'Раса не выбрана') + ' | ' + (c.className || 'Класс не выбран') + ' (Ур. ' + (c.level || 1) + ')</div>' +
            '</div>' +
            '<div class="party-stats">' +
                '<div><div class="party-stat-val">' + (c.hp ?? 10) + '/' + (c.maxHp || 10) + '</div><div class="party-stat-lbl">ХП</div></div>' +
                '<div><div class="party-stat-val">' + CAC(c) + '</div><div class="party-stat-lbl">КБ</div></div>' +
                '<div><div class="party-stat-val">' + slotsTxt + '</div><div class="party-stat-lbl">Ячейки</div></div>' +
            '</div>' +
            '<div style="display:flex; gap:6px; margin-left:10px;" onclick="event.stopPropagation();">' +
                `<button class="btn-small" onclick="GM_REQUEST_ACCESS(${idx}, 'sheet')">📋 Лист</button>` +
                `<button class="btn-small btn-save" onclick="GM_REQUEST_ACCESS(${idx}, 'inventory')">🎒 Рюкзак</button>` +
            '</div>';
        con.appendChild(d);
    });
};

const _ORIG_OCS = OCS;
OCS = function() {
    _ORIG_OCS();
    const sess = GET_SESSION();
    if (!sess || sess.role !== 'gm') return;

    const cont = document.getElementById('char-sheet-content');
    if (!cont) return;
    const cs = GC();
    const c = cs[PI];
    if (!c) return;

    const gmToolbar = document.createElement('div');
    gmToolbar.style.cssText = 'background:#281e36; border:2px solid #a855f7; border-radius:10px; padding:12px 16px; margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;';
    gmToolbar.innerHTML = `
        <div>
            <b style="color:#e9d5ff; font-size:1.02rem;">👑 Режим Мастера: Редактирование «${c.name || 'Герой'}»</b><br>
            <small style="color:#c4b5fd;">Доступ подтверждён игроком. Вы можете изменить параметры, снять замки или перейти в Рюкзак.</small>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="btn-save" onclick="GM_REQUEST_ACCESS(${PI}, 'inventory')">🎒 Открыть Рюкзак игрока</button>
            <button class="btn-small btn-warn" onclick="GM_UNLOCK_ALL(${PI}); OCS();">🔓 Снять все замки</button>
            <button class="btn-small" onclick="GM_FULL_RESTORE_CHAR(${PI}); OCS();">💚 Полный хил</button>
        </div>
    `;
    const h2 = cont.querySelector('h2');
    if (h2) h2.after(gmToolbar);
};

// Переопределяем Рюкзак (OINV) специально для режима Гейм-Мастера (в виде удобного списка с кнопками справа!)
const _ORIG_OINV = OINV;
OINV = function() {
    const sess = GET_SESSION();
    if (!sess || sess.role !== 'gm') {
        _ORIG_OINV();
        return;
    }

    const cs = GC();
    const c = cs[PI];
    if (!c.inventory) c.inventory = [];
    if (!c.money) c.money = { gp: 0, sp: 0, cp: 0 };
    const inv = c.inventory;
    const cont = document.getElementById('inventory-content');

    const gp = parseInt(c.money.gp) || 0;
    const sp = parseInt(c.money.sp) || 0;
    const cp = parseInt(c.money.cp) || 0;
    const totalInGold = Math.round((gp + sp / 10 + cp / 100) * 100) / 100;
    const cap = CC(c), iw = IW(c);

    let datalistOptions = '';
    if (gameData.items && gameData.items.catalog) {
        gameData.items.catalog.forEach(item => {
            const extra = item.damage ? ` (${item.damage})` : (item.ac ? ` (КБ ${item.ac})` : (item.heal ? ` (${item.heal})` : ''));
            datalistOptions += `<option value="${item.name}">${item.name}${extra} — ${item.price || ''}</option>`;
        });
    }

    let listHTML = '';
    if (inv.length === 0) {
        listHTML = `<div style="padding:20px; text-align:center; color:#777; background:#181715; border-radius:8px; border:1px dashed #3d3830;">Рюкзак персонажа пуст</div>`;
    } else {
        listHTML = inv.map((item, idx) => {
            const itemType = GET_ITEM_TYPE(item);
            const canEquip = ['weapon', 'armor', 'shield', 'accessory'].includes(itemType);
            const qty = parseInt(item.qty) || 1;
            const eqBadge = item.equipped ? `<span style="background:#2e5a2e; color:#fff; padding:2px 7px; border-radius:4px; font-size:0.78rem; margin-left:6px;">⚔️ Надето</span>` : '';

            return `
                <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; background:#181715; border:1px solid ${item.equipped ? '#c9a96e' : '#38332c'}; padding:10px 14px; border-radius:8px; margin-bottom:8px; flex-wrap:wrap;">
                    <div style="text-align:left; flex:1; min-width:220px;">
                        <b style="color:#e6c88c; font-size:1rem;">${item.icon || '📦'} ${item.name}</b> ${eqBadge}
                        <span style="color:#aaa; font-size:0.88rem; margin-left:6px;">(Вес: ${item.weight || 0} фнт)</span>
                        ${item.desc ? `<div style="color:#888; font-size:0.82rem; margin-top:2px;">${item.desc}</div>` : ''}
                    </div>
                    <div style="display:flex; align-items:center; gap:6px; flex-shrink:0;">
                        <button class="btn-small" style="padding:4px 9px;" title="Убавить 1 шт." onclick="GM_INV_CHANGE_QTY(${idx}, -1)">−1</button>
                        <span style="min-width:44px; text-align:center; font-weight:bold; color:#fff; background:#121110; padding:4px 8px; border-radius:6px; border:1px solid #38332c;">×${qty}</span>
                        <button class="btn-small btn-save" style="padding:4px 9px;" title="Добавить 1 шт." onclick="GM_INV_CHANGE_QTY(${idx}, 1)">+1</button>
                        ${canEquip ? `<button class="btn-small" style="padding:4px 10px;" onclick="ctxItem=${idx}; CA('equip');">${item.equipped ? '🔽 Снять' : '⚔️ Надеть'}</button>` : ''}
                        <button class="btn-small" style="padding:4px 9px;" title="Изменить название/описание" onclick="ctxItem=${idx}; CA('edit');">✏️</button>
                        <button class="btn-small btn-danger" style="padding:4px 10px;" title="Удалить предмет" onclick="GM_INV_DELETE_ITEM(${idx})">🗑️ Удалить</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    cont.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #3d3830; padding-bottom:10px; margin-bottom:14px; flex-wrap:wrap; gap:10px;">
            <h2 style="margin:0; border:none; padding:0;">👑 Рюкзак игрока: ${c.name || 'Герой'} (Режим Мастера)</h2>
            <button class="btn-small" onclick="CM('inventory-modal'); OCS();">📋 Перейти к Листу персонажа</button>
        </div>

        <!-- Кошелёк и монеты (оставлены как сейчас) -->
        <div class="money-row" style="align-items:center; margin-bottom:14px;">
            <div class="money-item"><div class="coin-icon">🪙</div><div>Золотые (зм)</div><input type="number" min="0" value="${gp}" onchange="UMY('gp',parseInt(this.value))"></div>
            <div class="money-item"><div class="coin-icon">🥈</div><div>Серебряные (см)</div><input type="number" min="0" value="${sp}" onchange="UMY('sp',parseInt(this.value))"></div>
            <div class="money-item"><div class="coin-icon">🥉</div><div>Медные (мм)</div><input type="number" min="0" value="${cp}" onchange="UMY('cp',parseInt(this.value))"></div>
            <div style="font-size:0.85em; color:#c9a96e; padding:4px 8px;">Всего в золоте:<br><b style="font-size:1.15em;">≈ ${totalInGold} зм</b><br><small style="color:#888;">Вес: ${iw}/${cap} фнт</small></div>
        </div>

        <!-- Блок быстрого добавления ресурсов и предметов от Мастера -->
        <div style="background:#201c29; padding:14px; border-radius:10px; border:1px solid #9b59b6; margin-bottom:16px;">
            <div style="color:#e9d5ff; font-size:0.92rem; font-weight:bold; margin-bottom:8px;">➕ Выдать предмет или ресурс в рюкзак:</div>
            <datalist id="dnd-items-datalist">${datalistOptions}</datalist>
            <div style="display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px;">
                <input type="text" id="new-item-name" list="dnd-items-datalist" oninput="AUTOFILL_ITEM_FROM_DB(this.value)" placeholder="Название предмета или ресурса..." style="flex:2; min-width:200px; text-align:left;">
                <input type="number" id="new-item-qty" min="1" value="1" placeholder="Кол-во" style="width:75px;">
                <input type="number" step="0.1" id="new-item-weight" placeholder="Вес(фнт)" style="width:90px;">
                <input type="text" id="new-item-desc" placeholder="Описание / свойство..." style="flex:2; min-width:160px; text-align:left;">
                <button class="btn-save" onclick="ADDITEM()">+ Добавить</button>
            </div>
            <div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center;">
                <small style="color:#c4b5fd;">⚡ Быстрые ресурсы:</small>
                <button class="btn-small" style="padding:3px 9px; font-size:0.8rem;" onclick="GM_QUICK_ADD_RESOURCE('Походный рацион (1 день)', 1, 2, 'Сухой паёк и вода для путешествий')">🍖 Рацион (+1)</button>
                <button class="btn-small" style="padding:3px 9px; font-size:0.8rem;" onclick="GM_QUICK_ADD_RESOURCE('Факел', 1, 1, 'Горит 1 час, освещая 20 футов')">🔥 Факел (+1)</button>
                <button class="btn-small" style="padding:3px 9px; font-size:0.8rem;" onclick="GM_QUICK_ADD_RESOURCE('Зелье лечения', 1, 0.5, 'Восстанавливает 2к4+2 ХП')">🧪 Зелье лечения (+1)</button>
                <button class="btn-small" style="padding:3px 9px; font-size:0.8rem;" onclick="GM_QUICK_ADD_RESOURCE('Стрелы', 10, 0.05, 'Боеприпасы для лука')">🏹 Стрелы (+10)</button>
                <button class="btn-small" style="padding:3px 9px; font-size:0.8rem;" onclick="GM_QUICK_ADD_RESOURCE('Воровские инструменты', 1, 1, 'Отмычки для взлома замков')">🔧 Отмычки (+1)</button>
            </div>
        </div>

        <!-- Список содержимого рюкзака -->
        <h3 style="margin-top:0;">📦 Список содержимого (${inv.length} поз.)</h3>
        <div style="max-height:380px; overflow-y:auto; padding-right:4px;">
            ${listHTML}
        </div>

        <div style="margin-top:16px; text-align:right;">
            <button onclick="CM('inventory-modal')">Закрыть рюкзак</button>
        </div>
    `;

    OM('inventory-modal');
};

function GM_INV_CHANGE_QTY(itemIdx, delta) {
    const cs = GC();
    const c = cs[PI];
    if (!c || !c.inventory || !c.inventory[itemIdx]) return;
    const item = c.inventory[itemIdx];
    const newQty = (parseInt(item.qty) || 1) + delta;
    if (newQty <= 0) {
        c.inventory.splice(itemIdx, 1);
    } else {
        item.qty = String(newQty);
    }
    AB(c);
    SC(cs);
    RMC();
    OINV();
}

function GM_INV_DELETE_ITEM(itemIdx) {
    const cs = GC();
    const c = cs[PI];
    if (!c || !c.inventory || !c.inventory[itemIdx]) return;
    c.inventory.splice(itemIdx, 1);
    AB(c);
    SC(cs);
    RMC();
    OINV();
}

function GM_QUICK_ADD_RESOURCE(name, qty, weight, desc) {
    document.getElementById('new-item-name').value = name;
    document.getElementById('new-item-qty').value = qty;
    document.getElementById('new-item-weight').value = weight;
    document.getElementById('new-item-desc').value = desc;
    ADDITEM();
}

// ================================================================
// 9. ПРОСТОРНЫЕ ОКНА КАРТЫ (С ПОГОДОЙ), NPC-НОВЕЛЛЫ И СОБЫТИЙ
// ================================================================
function OPEN_GM_MAP_MODAL() {
    const st = GET_MAP_STATE();
    const cont = document.getElementById('gm-tool-modal-content');
    cont.style.maxWidth = '1020px';

    const pinsListHTML = (st.pins || []).map((p, idx) => `
        <div style="display:flex; justify-content:space-between; align-items:center; background:#22201d; padding:8px 10px; border-radius:6px; border:1px solid #3d3830; margin-bottom:6px;">
            <div>
                <b>${p.icon} ${p.label}</b> <small style="color:#888;">(${p.x}%, ${p.y}%)</small>
                ${p.oneTime && p.used ? '<span style="color:#e06060; font-size:0.8em;"> [Использовано]</span>' : ''}
            </div>
            <button class="btn-small btn-danger" style="padding:3px 8px;" onclick="GM_DELETE_MAP_PIN(${idx}); OPEN_GM_MAP_MODAL();">🗑️</button>
        </div>
    `).join('');

    cont.innerHTML = `
        <h2>🗺️ Редактор Карты, Погоды, Сетки и Значков</h2>
        <div style="display:grid; grid-template-columns: 1.15fr 1fr; gap:20px; align-items:start;">
            <div style="background:#181715; border:1px solid #423c33; padding:18px; border-radius:10px; display:flex; flex-direction:column; gap:12px;">
                <h3 style="margin-top:0;">1. Изображение и описание локации</h3>

                <div onclick="GM_UPLOAD_MAP_FILE()" style="cursor:pointer; border:2px dashed #c9a96e; border-radius:10px; background:#121110; min-height:155px; display:flex; flex-direction:column; align-items:center; justify-content:center; padding:14px; position:relative; overflow:hidden;">
                    ${st.img
                        ? `<img id="gm-map-preview-img" src="${st.img}" style="max-height:140px; max-width:100%; object-fit:contain; border-radius:6px; margin-bottom:8px;">
                           <span style="color:#e6c88c; font-size:0.88rem; font-weight:bold;">🔄 Нажмите сюда, чтобы выбрать другой файл карты с ПК</span>`
                        : `<div style="font-size:2.4rem; margin-bottom:6px;">🖼️</div>
                           <div style="color:#e6c88c; font-weight:bold;">Нажмите сюда, чтобы загрузить картинку карты с компьютера</div>
                           <small style="color:#888; margin-top:4px;">Поддерживаются JPG, PNG, WEBP</small>`
                    }
                </div>

                <div style="display:flex; gap:8px; align-items:center;">
                    <input type="text" id="gm-map-url" value="${(st.img && !st.img.startsWith('data:')) ? st.img : ''}" placeholder="Или вставьте прямую ссылку (URL) на картинку карты..." style="flex:1; text-align:left;">
                    ${st.img ? `<button class="btn-small btn-danger" onclick="GM_CLEAR_MAP_IMG()">🗑️ Сбросить фото</button>` : ''}
                </div>

                <div>
                    <label style="color:#c9a96e; font-size:0.9rem;">Название локации:</label>
                    <input type="text" id="gm-map-title" value="${(st.title||'').replace(/"/g,'&quot;')}" style="margin-top:4px; text-align:left;">
                </div>
                <div>
                    <label style="color:#c9a96e; font-size:0.9rem;">Описание локации:</label>
                    <textarea id="gm-map-desc" style="min-height:60px;">${st.desc||''}</textarea>
                </div>

                <div style="background:#22201d; padding:12px; border-radius:8px; border:1px solid #38332c; display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:10px;">
                        <label style="color:#c9a96e; font-size:0.9rem;">🌦️ Погода / Атмосфера на карте:</label>
                        <select id="gm-map-weather" style="width:220px; text-align:left;">
                            <option value="none" ${st.weather==='none'?'selected':''}>☀️ Ясно (Без эффектов)</option>
                            <option value="rain" ${st.weather==='rain'?'selected':''}>🌧️ Ливень и шторм</option>
                            <option value="snow" ${st.weather==='snow'?'selected':''}>❄️ Снегопад / Метель</option>
                            <option value="ash" ${st.weather==='ash'?'selected':''}>🔥 Пепел и искры</option>
                            <option value="night" ${st.weather==='night'?'selected':''}>🌙 Глубокая ночь</option>
                        </select>
                    </div>
                    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
                        <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                            <input type="checkbox" id="gm-map-grid" ${st.grid ? 'checked' : ''}>
                            <span>📏 <b>Показать тактическую сетку (Grid)</b></span>
                        </label>
                        <div style="display:flex; align-items:center; gap:6px;">
                            <small style="color:#aaa;">Клетка:</small>
                            <input type="number" id="gm-map-grid-size" min="20" max="120" value="${st.gridSize || 48}" style="width:70px;"> <small>px</small>
                        </div>
                    </div>
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer;">
                        <input type="checkbox" id="gm-map-fog" ${st.fog ? 'checked' : ''}>
                        <span>🌫️ <b>Туман войны</b> (скрыть карту от игроков)</span>
                    </label>
                </div>

                <button class="btn-save" style="padding:12px;" onclick="GM_SAVE_MAP()">✅ Применить настройки карты</button>
            </div>

            <div style="display:flex; flex-direction:column; gap:14px;">
                <div style="background:#181715; border:1px solid #423c33; padding:18px; border-radius:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <h3 style="margin:0; border:none;">2. Значки на карте (${(st.pins||[]).length})</h3>
                        <button class="btn-small btn-save" onclick="START_MAP_PIN_PLACEMENT()">📍 + Поставить кликом по карте</button>
                    </div>
                    <div style="max-height:190px; overflow-y:auto;">
                        ${pinsListHTML || '<p style="color:#666; font-size:0.9rem;">На карте пока нет интерактивных значков.</p>'}
                    </div>
                </div>

                <div style="background:#181715; border:1px solid #423c33; padding:18px; border-radius:10px;">
                    <h3 style="margin-top:0;">3. Быстрые сцены кампании</h3>
                    <div style="display:flex; flex-direction:column; gap:8px;">
                        <button class="btn-small" style="text-align:left; padding:10px;" onclick="GM_SET_PRESET_SCENE('Деревня Притишье', 'Маленькая деревня на границе цивилизации. Старый Смотритель встречает отряд.')">🏘️ Деревня Притишье</button>
                        <button class="btn-small" style="text-align:left; padding:10px;" onclick="GM_SET_PRESET_SCENE('Тёмная чаща у Древа', 'Искажённый лес, где бродят порождения Ошибки.')">🌲 Тёмная чаща у Древа</button>
                        <button class="btn-small" style="text-align:left; padding:10px;" onclick="GM_SET_PRESET_SCENE('Застава Псов Империи', 'Укреплённый гарнизон Генерала Псов.')">🏰 Застава Псов Империи</button>
                        <button class="btn-small" style="text-align:left; padding:10px;" onclick="GM_SET_PRESET_SCENE('Лагерь у костра', 'Безопасная поляна для ночного привала.')">🔥 Лагерь у костра</button>
                    </div>
                </div>
            </div>
        </div>
        <div style="margin-top:16px; text-align:right;"><button onclick="CM('gm-tool-modal')">Закрыть</button></div>
    `;
    OM('gm-tool-modal');
}

window._gmTempChoices = ['Согласиться помочь', 'Спросить о награде', 'Уйти'];

function RENDER_GM_CHOICES_PILLS() {
    const box = document.getElementById('gm-vn-choices-pills');
    if (!box) return;
    if (!window._gmTempChoices || window._gmTempChoices.length === 0) {
        box.innerHTML = `<span style="color:#777; font-size:0.85rem;">Нет готовых кнопок (игроки смогут написать свой ответ вручную)</span>`;
        return;
    }
    box.innerHTML = window._gmTempChoices.map((ch, i) => `
        <span style="display:inline-flex; align-items:center; gap:6px; background:#2b251c; color:#e6c88c; border:1px solid #c9a96e; padding:4px 10px; border-radius:6px; font-size:0.88rem;">
            💬 ${ch}
            <b style="cursor:pointer; color:#e06060;" onclick="GM_REMOVE_CHOICE_PILL(${i})">✕</b>
        </span>
    `).join('');
}

function GM_ADD_CHOICE_PILL() {
    const inp = document.getElementById('gm-vn-new-choice-inp');
    const val = inp ? inp.value.trim() : '';
    if (!val) return;
    if (!window._gmTempChoices) window._gmTempChoices = [];
    window._gmTempChoices.push(val);
    inp.value = '';
    RENDER_GM_CHOICES_PILLS();
}

function GM_REMOVE_CHOICE_PILL(idx) {
    if (!window._gmTempChoices) return;
    window._gmTempChoices.splice(idx, 1);
    RENDER_GM_CHOICES_PILLS();
}

function OPEN_GM_NPC_MODAL() {
    const npcs = GET_NPCS();
    const activeVN = GET_ACTIVE_VN_DIALOG();
    const cont = document.getElementById('gm-tool-modal-content');
    cont.style.maxWidth = '960px';

    const curAvatar = activeVN?.avatar || '';
    if (activeVN && activeVN.choices) {
        window._gmTempChoices = [...activeVN.choices];
    }

    const npcCards = npcs.map((n, idx) => `
        <div onclick="GM_SELECT_NPC_TO_FORM(${idx})" style="cursor:pointer; background:#22201d; border:1px solid #423c33; padding:8px 12px; border-radius:8px; display:flex; align-items:center; gap:10px; min-width:210px; flex:1;" onmouseover="this.style.borderColor='#c9a96e'" onmouseout="this.style.borderColor='#423c33'">
            ${n.avatar ? `<img src="${n.avatar}" style="width:42px; height:42px; border-radius:50%; object-fit:cover; border:2px solid #c9a96e; flex-shrink:0;">` : `<div style="width:42px; height:42px; border-radius:50%; background:#141312; border:1px dashed #777; display:flex; align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0;">🎭</div>`}
            <div style="text-align:left; flex:1; overflow:hidden;">
                <b style="color:#e6c88c; font-size:0.95rem;">${n.name}</b><br>
                <small style="color:#999;">${n.role || 'NPC'}</small>
            </div>
            <button class="btn-small btn-danger" style="padding:2px 7px;" onclick="event.stopPropagation(); GM_DELETE_NPC(${idx})">✕</button>
        </div>
    `).join('');

    const npcLog = GET_NPC_LOG();
    const logHTML = npcLog.slice(-15).map(line => `<div style="padding:4px 0; border-bottom:1px dashed #2c2823; font-size:0.86rem; color:#d8d4cc;">${line}</div>`).join('');

    cont.innerHTML = `
        <h2>🎭 Пульт Диалогов с NPC</h2>

        <!-- Шаг 1: Быстрый выбор заготовленного NPC сверху -->
        <div style="margin-bottom:16px;">
            <div style="color:#c9a96e; font-size:0.9rem; font-weight:bold; margin-bottom:6px;">1. Выберите готового персонажа (кликните по карточке) или впишите нового ниже:</div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                ${npcCards || '<span style="color:#777;">Нет сохранённых NPC</span>'}
            </div>
        </div>

        <div style="display:grid; grid-template-columns: 1.3fr 1fr; gap:18px; align-items:start;">
            <!-- Левая часть: Кто говорит и что говорит -->
            <div style="background:#181715; border:1px solid #423c33; padding:16px; border-radius:10px;">
                <div style="display:flex; gap:14px; align-items:center; margin-bottom:12px;">
                    <div id="gm-vn-avatar-box" onclick="GM_UPLOAD_NPC_AVATAR()" title="Нажмите, чтобы выбрать картинку с ПК" style="width:92px; height:92px; border-radius:12px; border:2px dashed #c9a96e; background:#121110; display:flex; flex-direction:column; align-items:center; justify-content:center; cursor:pointer; overflow:hidden; flex-shrink:0;">
                        ${curAvatar
                            ? `<img src="${curAvatar}" style="width:100%; height:100%; object-fit:cover;">`
                            : `<span style="font-size:1.8rem;">📷</span><small style="color:#c9a96e; font-size:0.7rem;">Портрет</small>`
                        }
                    </div>
                    <div style="flex:1; display:flex; flex-direction:column; gap:8px;">
                        <input type="text" id="gm-vn-name" value="${activeVN?.name || 'Смотритель деревни'}" placeholder="Имя NPC..." style="text-align:left; font-weight:bold; color:#e6c88c;">
                        <input type="text" id="gm-vn-role" value="${activeVN?.role || 'Старый воин Притишья'}" placeholder="Кто это / Титул..." style="text-align:left; font-size:0.9rem;">
                        <input type="hidden" id="gm-vn-avatar" value="${curAvatar}">
                    </div>
                </div>

                <label style="color:#c9a96e; font-size:0.9rem; font-weight:bold;">2. Что говорит NPC игрокам:</label>
                <textarea id="gm-vn-text" style="min-height:75px; margin-top:4px; margin-bottom:12px;" placeholder="Напишите фразу NPC...">${activeVN?.text || 'Монстры подходят всё ближе к частоколу. Вы готовы выйти за ворота?'}</textarea>

                <!-- Наглядный конструктор кнопок ответа (без палочек "|") -->
                <label style="color:#c9a96e; font-size:0.9rem; font-weight:bold;">3. Кнопки быстрых ответов для игроков (необязательно):</label>
                <div id="gm-vn-choices-pills" style="display:flex; gap:6px; flex-wrap:wrap; margin:8px 0; min-height:32px; padding:8px; background:#121110; border-radius:8px; border:1px solid #38332c;"></div>
                <div style="display:flex; gap:6px; margin-bottom:14px;">
                    <input type="text" id="gm-vn-new-choice-inp" placeholder="Добавить вариант ответа (напр. Потребовать награду)..." onkeypress="if(event.key==='Enter') GM_ADD_CHOICE_PILL();" style="flex:1; text-align:left;">
                    <button class="btn-small" onclick="GM_ADD_CHOICE_PILL()">+ Добавить кнопку</button>
                </div>

                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="btn-save" style="flex:2; padding:12px;" onclick="GM_SHOW_VN_DIALOG()">🎭 Вывести диалог на карту</button>
                    <button class="btn-small" style="flex:1;" onclick="GM_SAVE_NPC_PRESET()">💾 Сохранить шаблон NPC</button>
                </div>
                ${activeVN && activeVN.active ? `<button class="btn-danger" style="width:100%; margin-top:8px;" onclick="GM_HIDE_VN_DIALOG()">✕ Убрать NPC с карты</button>` : ''}
            </div>

            <!-- Правая часть: Отдельная история всех разговоров с NPC (чтобы не засорять чат!) -->
            <div style="background:#181715; border:1px solid #423c33; padding:16px; border-radius:10px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                    <h3 style="margin:0; border:none;">📜 История бесед с NPC</h3>
                    <button class="btn-small" style="padding:2px 8px; font-size:0.75rem;" onclick="localStorage.removeItem('dnd_npc_dialog_log'); OPEN_GM_NPC_MODAL();">Очистить</button>
                </div>
                <p style="color:#888; font-size:0.8rem; margin-bottom:8px;">Все реплики NPC и ответы игроков сохраняются здесь (и прямо на карте), не мешая чату игроков:</p>
                <div style="max-height:310px; overflow-y:auto; background:#121110; padding:10px; border-radius:8px; border:1px solid #2c2823;">
                    ${logHTML || '<div style="color:#666; text-align:center; padding:20px 0;">История диалогов пуста</div>'}
                </div>
            </div>
        </div>
        <div style="margin-top:16px; text-align:right;"><button onclick="CM('gm-tool-modal')">Закрыть</button></div>
    `;
    RENDER_GM_CHOICES_PILLS();
    OM('gm-tool-modal');
}

function GM_UPDATE_VN_AVATAR_PREVIEW(src) {
    const box = document.getElementById('gm-vn-avatar-box');
    if (!box) return;
    if (src) {
        box.innerHTML = `<img src="${src}" style="width:100%; height:100%; object-fit:cover;">`;
    } else {
        box.innerHTML = `<span style="font-size:1.8rem;">📷</span><small style="color:#c9a96e; font-size:0.7rem;">Портрет</small>`;
    }
}

function GM_SELECT_NPC_TO_FORM(idx) {
    const n = GET_NPCS()[idx];
    if (!n) return;
    document.getElementById('gm-vn-name').value = n.name || '';
    document.getElementById('gm-vn-role').value = n.role || '';
    document.getElementById('gm-vn-avatar').value = n.avatar || '';
    document.getElementById('gm-vn-text').value = n.defaultText || '';
    window._gmTempChoices = (n.choices || '').split('|').map(s => s.trim()).filter(Boolean);
    GM_UPDATE_VN_AVATAR_PREVIEW(n.avatar || '');
    RENDER_GM_CHOICES_PILLS();
}

function GM_UPLOAD_NPC_AVATAR() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = function(e) {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = function(ev) {
            const avInp = document.getElementById('gm-vn-avatar');
            if (avInp) avInp.value = ev.target.result;
            GM_UPDATE_VN_AVATAR_PREVIEW(ev.target.result);
        };
        r.readAsDataURL(f);
    };
    inp.click();
}

function GM_SAVE_NPC_PRESET() {
    const name = document.getElementById('gm-vn-name')?.value.trim();
    if (!name) return;
    const role = document.getElementById('gm-vn-role')?.value.trim() || '';
    const avatar = document.getElementById('gm-vn-avatar')?.value.trim() || '';
    const defaultText = document.getElementById('gm-vn-text')?.value.trim() || '';
    const choices = (window._gmTempChoices || []).join(' | ');
    const list = GET_NPCS();
    list.push({ name, role, avatar, defaultText, choices });
    SAVE_NPCS(list);
    OPEN_GM_NPC_MODAL();
}

function GM_DELETE_NPC(idx) {
    const list = GET_NPCS();
    list.splice(idx, 1);
    SAVE_NPCS(list);
    OPEN_GM_NPC_MODAL();
}

function GM_SHOW_VN_DIALOG() {
    const name = document.getElementById('gm-vn-name')?.value.trim() || 'NPC';
    const role = document.getElementById('gm-vn-role')?.value.trim() || '';
    const avatar = document.getElementById('gm-vn-avatar')?.value.trim() || '';
    const text = document.getElementById('gm-vn-text')?.value.trim() || '...';
    const choices = [...(window._gmTempChoices || [])];

    SAVE_ACTIVE_VN_DIALOG({ active: true, name, role, avatar, text, choices, leftPlayers: [], playerReplies: [], time: Date.now() });
    ADD_TO_NPC_LOG(`🎭 ${name}`, `«${text}»`);
    RENDER_MAP_AREA();
    CM('gm-tool-modal');
}

function GM_HIDE_VN_DIALOG() {
    SAVE_ACTIVE_VN_DIALOG(null);
    RENDER_MAP_AREA();
    if (document.getElementById('gm-tool-modal')?.classList.contains('active')) {
        OPEN_GM_NPC_MODAL();
    }
}

// --- СОБЫТИЯ, ЗАДАЧИ, ЛОРБУК И КУБИКИ ---
function OPEN_GM_EVENTS_MODAL() {
    const list = GET_PREPARED_EVENTS();
    const cont = document.getElementById('gm-tool-modal-content');
    cont.style.maxWidth = '960px';

    const preparedHTML = list.map((ev, idx) => `
        <div style="background:#22201d; border:1px solid #423c33; padding:12px; border-radius:8px; margin-bottom:8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <b style="color:#e6c88c;">${ev.title}</b>
                <div style="display:flex; gap:6px;">
                    <button class="btn-small btn-save" onclick="GM_FIRE_PREPARED_EVENT(${idx})">📣 Отправить игрокам</button>
                    <button class="btn-small btn-danger" onclick="GM_DELETE_PREPARED_EVENT(${idx})">✕</button>
                </div>
            </div>
            <div style="font-size:0.88rem; color:#ccc;">${ev.text}</div>
        </div>
    `).join('');

    cont.innerHTML = `
        <h2>⚡ События Кампании (Всплывающее окно у игроков)</h2>
        <div style="display:grid; grid-template-columns: 1fr 1.1fr; gap:18px; align-items:start;">
            <div style="background:#181715; border:1px solid #423c33; padding:16px; border-radius:10px;">
                <h3 style="margin-top:0;">🔥 Создать событие на ходу</h3>
                <input type="text" id="gm-event-title" placeholder="Заголовок (напр.: ⚡ Ловушка сработала!)" style="margin-bottom:10px; text-align:left;">
                <textarea id="gm-event-text" placeholder="Текст события, который всплывёт на экране у всех игроков..."></textarea>
                <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
                    <button class="btn-save" style="flex:2;" onclick="GM_TRIGGER_EVENT()">📣 Запустить сейчас</button>
                    <button class="btn-small" style="flex:1;" onclick="GM_SAVE_EVENT_TO_PREPARED()">💾 В заготовки</button>
                </div>
            </div>

            <div>
                <h3 style="margin-top:0;">📌 Заготовленные события (в 1 клик)</h3>
                <div style="max-height:360px; overflow-y:auto;">
                    ${preparedHTML || '<p style="color:#777;">Нет заготовленных событий</p>'}
                </div>
            </div>
        </div>
        <div style="margin-top:16px; text-align:right;"><button onclick="CM('gm-tool-modal')">Закрыть</button></div>
    `;
    OM('gm-tool-modal');
}

function GM_SAVE_EVENT_TO_PREPARED() {
    const title = document.getElementById('gm-event-title')?.value.trim();
    const text = document.getElementById('gm-event-text')?.value.trim();
    if (!title || !text) { showMessage('Ошибка', 'Введите заголовок и текст события.'); return; }
    const list = GET_PREPARED_EVENTS();
    list.push({ title, text });
    SAVE_PREPARED_EVENTS(list);
    OPEN_GM_EVENTS_MODAL();
}

function GM_DELETE_PREPARED_EVENT(idx) {
    const list = GET_PREPARED_EVENTS();
    list.splice(idx, 1);
    SAVE_PREPARED_EVENTS(list);
    OPEN_GM_EVENTS_MODAL();
}

function BROADCAST_GM_EVENT(title, text) {
    const evObj = { id: Date.now(), target: 'all', title, text };
    localStorage.setItem('dnd_gm_event', JSON.stringify(evObj));
    LOG_COMBAT_TO_CHAT(`⚡ [СОБЫТИЕ] ${title}: ${text}`);
    CM('gm-tool-modal');
    showMessage('📣 Событие запущено!', `<div style="font-size:1.05rem; line-height:1.5;"><b>${title}</b><br>${text}<br><br><small style="color:#52b758;">✅ Всплывающее окно отправлено всем игрокам!</small></div>`);
}

function GM_FIRE_PREPARED_EVENT(idx) {
    const ev = GET_PREPARED_EVENTS()[idx];
    if (!ev) return;
    BROADCAST_GM_EVENT(ev.title, ev.text);
}

function GM_TRIGGER_EVENT() {
    const title = document.getElementById('gm-event-title')?.value.trim() || '⚡ Событие кампании!';
    const text = document.getElementById('gm-event-text')?.value.trim();
    if (!text) { showMessage('Ошибка', 'Введите текст описания события.'); return; }
    BROADCAST_GM_EVENT(title, text);
}

function OPEN_GM_TASKS_MODAL() {
    const curTasks = localStorage.getItem('dnd_tasks') || '';
    const cont = document.getElementById('gm-tool-modal-content');
    cont.style.maxWidth = '650px';
    cont.innerHTML = `
        <h2>📋 Редактор Задач отряда</h2>
        <textarea id="gm-tasks-box" style="min-height:150px;" placeholder="Введите текущие квесты и задачи для игроков...">${curTasks}</textarea>
        <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:14px;">
            <button class="btn-save" onclick="GM_UPDATE_TASKS()">💾 Сохранить задачи</button>
            <button onclick="CM('gm-tool-modal')">Отмена</button>
        </div>
    `;
    OM('gm-tool-modal');
}

function OPEN_GM_LORE_MODAL() {
    RENDER_CUSTOM_LORE();
    const loreModal = document.getElementById('lorebook-modal');
    const modalContent = loreModal.querySelector('.modal-content');
    let gmAddBox = document.getElementById('gm-lore-editor-form');
    if (!gmAddBox) {
        gmAddBox = document.createElement('div');
        gmAddBox.id = 'gm-lore-editor-form';
        gmAddBox.style.cssText = 'background:#181715; border:1px solid #c9a96e; padding:14px; border-radius:8px; margin-top:16px;';
        modalContent.insertBefore(gmAddBox, modalContent.lastElementChild);
    }
    const sess = GET_SESSION();
    if (sess && sess.role === 'gm') {
        gmAddBox.style.display = 'block';
        gmAddBox.innerHTML = `
            <h3 style="margin-top:0;">👑 Добавить новую запись в Лорбук</h3>
            <input type="text" id="gm-lore-title" placeholder="Заголовок статьи..." style="margin-bottom:8px; text-align:left;">
            <textarea id="gm-lore-text" placeholder="Описание лора..."></textarea>
            <button class="btn-save" style="margin-top:8px;" onclick="GM_ADD_LORE()">➕ Добавить запись</button>
        `;
    } else {
        gmAddBox.style.display = 'none';
    }
    OM('lorebook-modal');
}

function OPEN_GM_DICE_MODAL() {
    const diceList = ['1к4', '1к6', '1к8', '1к10', '1к12', '1к20', '2к6', '1к100'];
    const diceBtns = diceList.map(d => `<button style="min-width:90px;" onclick="GM_ROLL_DICE('${d}')">🎲 ${d}</button>`).join('');
    const cont = document.getElementById('gm-tool-modal-content');
    cont.style.maxWidth = '720px';
    cont.innerHTML = `
        <h2>🎲 Кубики Гейм-Мастера</h2>
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; margin-bottom:14px;">
            <input type="checkbox" ${window._gmSecretRoll ? 'checked' : ''} onchange="window._gmSecretRoll = this.checked;">
            <span>🕵️ <b>Скрытый бросок Мастера</b> (не отправлять в общий лог игроков)</span>
        </label>
        <div style="display:flex; gap:10px; flex-wrap:wrap; margin-bottom:14px;">${diceBtns}</div>
        <div style="display:flex; gap:10px; margin-bottom:14px;">
            <input type="text" id="gm-custom-dice" placeholder="Своя формула (напр. 3к8+5)" style="flex:1; text-align:left;">
            <button class="btn-save" onclick="GM_ROLL_DICE(document.getElementById('gm-custom-dice').value)">Бросить</button>
        </div>
        <div id="gm-dice-result-box" style="background:#141312; border:1px solid #c9a96e; padding:18px; border-radius:8px; text-align:center; font-size:1.25rem; color:#e6c88c; font-weight:bold;">
            ${window._gmLastDiceResult}
        </div>
        <div style="margin-top:16px; text-align:right;"><button onclick="CM('gm-tool-modal')">Закрыть</button></div>
    `;
    OM('gm-tool-modal');
}

function GM_UNLOCK_ALL(charIdx) {
    const cs = GC();
    const c = cs[charIdx];
    if (!c) return;
    c.raceLocked = false; c.classLocked = false; c.subclassLocked = false;
    c.bgLocked = false; c.statsLocked = false; c.skillsLocked = false;
    c.languagesLocked = false; c.alignmentLocked = false;
    c.traitsLocked = false; c.idealsLocked = false; c.bondsLocked = false; c.flawsLocked = false; c.storyLocked = false;
    SC(cs);
    RPL();
    showMessage('🔓 Замки сняты', `Все поля в Листе персонажа «<b>${c.name}</b>» снова открыты для выбора и редактирования.`);
}

function GM_FULL_RESTORE_CHAR(charIdx) {
    const cs = GC();
    const c = cs[charIdx];
    if (!c) return;
    c.hp = c.maxHp || 10;
    c.tempHP = 0;
    c.usedSpellSlots = {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0};
    c.usedSpells = {};
    c.spentHitDice = 0;
    c.shortRestsUsed = 0;
    SC(cs);
    RPL();
    RENDER_MAP_AREA();
    LOG_COMBAT_TO_CHAT(`👑 Мастер полностью восстановил ХП и ячейки персонажу «${c.name}»!`);
}

function GM_TOGGLE_PARTY_COMBAT() {
    const cs = GC();
    const targetState = !cs.some(m => m.inCombat);
    cs.forEach(m => { m.inCombat = targetState; });
    SC(cs);
    if (targetState) {
        CANCEL_REST_POLL_IF_COMBAT('Гейм-Мастер');
        LOG_COMBAT_TO_CHAT('⚔️ Гейм-Мастер объявил начало БОЯ для всего отряда!');
    } else {
        LOG_COMBAT_TO_CHAT('🕊️ Гейм-Мастер завершил бой. Отряд переходит в мирный режим.');
    }
    RENDER_GM_LEFT_COLUMN();
    RPL();
}

function GM_UPLOAD_MAP_FILE() {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = function(e) {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = function(ev) {
            const st = GET_MAP_STATE();
            st.img = ev.target.result;
            SAVE_MAP_STATE(st);
            RENDER_MAP_AREA();
            OPEN_GM_MAP_MODAL();
        };
        r.readAsDataURL(f);
    };
    inp.click();
}

function GM_CLEAR_MAP_IMG() {
    const st = GET_MAP_STATE();
    localStorage.removeItem('dnd_map_bg_img');
    st.img = '';
    SAVE_MAP_STATE(st);
    RENDER_MAP_AREA();
    OPEN_GM_MAP_MODAL();
}

function GM_SAVE_MAP() {
    const st = GET_MAP_STATE();
    st.title = document.getElementById('gm-map-title')?.value.trim() || 'Неизвестная область';
    st.desc = document.getElementById('gm-map-desc')?.value.trim() || '';
    const urlVal = document.getElementById('gm-map-url')?.value.trim();
    if (urlVal) st.img = urlVal;
    st.weather = document.getElementById('gm-map-weather')?.value || 'none';
    st.fog = !!document.getElementById('gm-map-fog')?.checked;
    st.grid = !!document.getElementById('gm-map-grid')?.checked;
    st.gridSize = Math.max(20, Math.min(120, parseInt(document.getElementById('gm-map-grid-size')?.value) || 48));
    SAVE_MAP_STATE(st);
    RENDER_MAP_AREA();
    CM('gm-tool-modal');
    LOG_COMBAT_TO_CHAT(`🗺️ Гейм-Мастер обновил локацию отряда: «${st.title}».`);
}

function GM_SET_PRESET_SCENE(title, desc) {
    const st = GET_MAP_STATE();
    st.title = title;
    st.desc = desc;
    st.fog = false;
    SAVE_MAP_STATE(st);
    RENDER_MAP_AREA();
    CM('gm-tool-modal');
    LOG_COMBAT_TO_CHAT(`🗺️ Отряд переместился в локацию: «${title}».`);
}

function GM_UPDATE_TASKS() {
    const t = document.getElementById('gm-tasks-box')?.value.trim() || '';
    localStorage.setItem('dnd_tasks', t);
    LDT();
    RENDER_GM_LEFT_COLUMN();
    CM('gm-tool-modal');
    LOG_COMBAT_TO_CHAT('📋 Гейм-Мастер обновил список текущих Задач отряда!');
}

function GM_ADD_LORE() {
    const title = document.getElementById('gm-lore-title')?.value.trim();
    const text = document.getElementById('gm-lore-text')?.value.trim();
    if (!title || !text) { showMessage('Ошибка', 'Заполните заголовок и текст статьи лора.'); return; }
    const list = GET_CUSTOM_LORE();
    list.push({ title, text });
    SAVE_CUSTOM_LORE(list);
    RENDER_CUSTOM_LORE();
    document.getElementById('gm-lore-title').value = '';
    document.getElementById('gm-lore-text').value = '';
    LOG_COMBAT_TO_CHAT(`📖 В Лорбук добавлена новая запись: «${title}»!`);
}

function GM_DELETE_LORE(lIdx) {
    const list = GET_CUSTOM_LORE();
    list.splice(lIdx, 1);
    SAVE_CUSTOM_LORE(list);
    RENDER_CUSTOM_LORE();
}

function GM_ROLL_DICE(formula) {
    if (!formula) return;
    const res = ROLL(formula);
    window._gmLastDiceResult = `🎲 Бросок ${formula}: выпало <b>${res}</b> ${window._gmSecretRoll ? '(Скрыто от игроков)' : '(Отправлено в лог)'}`;
    if (!window._gmSecretRoll) {
        LOG_COMBAT_TO_CHAT(`👑 Бросок Мастера (${formula}): выпало ${res}`);
    }
    const box = document.getElementById('gm-dice-result-box');
    if (box) box.innerHTML = window._gmLastDiceResult;
}

// Синхронизация между вкладками браузера в реальном времени
window.addEventListener('storage', function(e) {
    const sess = GET_SESSION();
    if (e.key === 'dnd_map_state' || e.key === 'dnd_vn_dialog' || e.key === 'dnd_gm_shop') {
        RENDER_MAP_AREA();
        CHECK_UNSEEN_SHOP_OPEN();
        if (sess && sess.role === 'gm') RENDER_GM_LEFT_COLUMN();
    }
    if (e.key === 'dnd_custom_lore') RENDER_CUSTOM_LORE();
    if (e.key === 'dnd_tasks') { LDT(); if (sess && sess.role === 'gm') RENDER_GM_LEFT_COLUMN(); }
    if (e.key === 'dnd_characters') { RMC(); RPL(); RENDER_MAP_AREA(); }
    if (e.key === 'dnd_gm_event') CHECK_UNSEEN_GM_EVENT();
    if (e.key === 'dnd_gm_skill_check') CHECK_AND_RENDER_SKILL_ROLL_POPUP();
    if (e.key === 'dnd_gm_edit_request') {
        CHECK_AND_RENDER_PERMISSION_POPUP();
        CHECK_GM_PERMISSION_RESPONSE();
    }
});

// Отрисовка Стартового Лобби
function RENDER_LOBBY_HTML() {
    const lobby = document.getElementById('lobby-screen');
    if (!lobby) return;
    const rooms = GET_ROOMS();
    const cs = GC();

    const roomOpts = rooms.map(r => `<option value="${r.code}">Комната #${r.code} — ${r.name}</option>`).join('');
    const charOpts = cs.map((c, idx) => `<option value="${idx}">👤 ${c.name || 'Безымянный'} (${c.race || 'Раса'} • ${c.className || 'Класс'} ${c.level || 1} ур.)</option>`).join('');

    lobby.innerHTML = `
        <div style="max-width:980px; margin:40px auto; text-align:center;">
            <h1 style="font-size:2.2rem; margin-bottom:10px;">🐉 D&D Virtual Tabletop</h1>
            <p style="color:#aba498; font-size:1.1rem; margin-bottom:32px;">Выберите свою роль за игровым столом, чтобы войти в комнату кампании</p>

            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap:24px; text-align:left;">
                <div class="panel" style="border:2px solid #439c47; padding:26px; display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <div style="font-size:2.4rem; margin-bottom:8px;">⚔️</div>
                        <h2 style="font-size:1.5rem; color:#52b758; border-bottom-color:#334d33;">Я — Игрок</h2>
                        <p style="color:#ccc; margin-bottom:18px; font-size:0.98rem;">
                            Подключитесь к комнате Мастера, двигайте свою фишку по карте, общайтесь с NPC в режиме новеллы и покупайте снаряжение в лавках.
                        </p>
                        <div style="margin-bottom:14px;">
                            <label style="color:#e6c88c; font-weight:bold; font-size:0.95rem;">1. Выберите комнату кампании:</label>
                            <select id="lobby-player-room" style="width:100%; margin-top:6px; padding:10px; background:#141312; color:#fff; border:1px solid #524a3d; border-radius:6px; font-size:1rem;">${roomOpts}</select>
                        </div>
                        <div style="margin-bottom:20px;">
                            <label style="color:#e6c88c; font-weight:bold; font-size:0.95rem;">2. Выберите своего персонажа:</label>
                            <select id="lobby-player-char" style="width:100%; margin-top:6px; padding:10px; background:#141312; color:#fff; border:1px solid #524a3d; border-radius:6px; font-size:1rem;">${charOpts}</select>
                        </div>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:10px;">
                        <button class="btn-save" style="width:100%; padding:14px; font-size:1.1rem;" onclick="ENTER_ROOM_AS_PLAYER(document.getElementById('lobby-player-room').value, document.getElementById('lobby-player-char').value)">⚔️ Войти в игру как Игрок</button>
                        <button class="btn-small" style="width:100%; padding:10px;" onclick="CREATE_NEW_HERO_AND_JOIN(document.getElementById('lobby-player-room').value)">➕ Создать нового персонажа</button>
                    </div>
                </div>

                <div class="panel" style="border:2px solid #9b59b6; padding:26px; display:flex; flex-direction:column; justify-content:space-between;">
                    <div>
                        <div style="font-size:2.4rem; margin-bottom:8px;">👑</div>
                        <h2 style="font-size:1.5rem; color:#c084fc; border-bottom-color:#443054;">Я — Гейм-Мастер</h2>
                        <p style="color:#ccc; margin-bottom:18px; font-size:0.98rem;">
                            Тактическая карта с погодой и фишками, живые диалоги с NPC, лавка торговца, запросы проверок к20 и управление партией.
                        </p>
                        <div style="margin-bottom:16px;">
                            <label style="color:#e6c88c; font-weight:bold; font-size:0.95rem;">Войти в существующую комнату:</label>
                            <select id="lobby-gm-room" style="width:100%; margin-top:6px; padding:10px; background:#141312; color:#fff; border:1px solid #524a3d; border-radius:6px; font-size:1rem;">${roomOpts}</select>
                        </div>
                        <div style="border-top:1px dashed #423c33; padding-top:14px; margin-bottom:18px;">
                            <label style="color:#aaa; font-size:0.9rem;">Или создать новую комнату:</label>
                            <div style="display:flex; gap:8px; margin-top:6px;">
                                <input type="text" id="lobby-new-room-name" placeholder="Название кампании..." style="flex:1; padding:10px; background:#141312; color:#fff; border:1px solid #524a3d; border-radius:6px;">
                                <button class="btn-small" onclick="CREATE_NEW_ROOM_AS_GM()">+ Создать</button>
                            </div>
                        </div>
                    </div>
                    <button style="width:100%; padding:14px; font-size:1.1rem; background:linear-gradient(180deg, #8b5cf6 0%, #5b21b6 100%); color:#fff; border-color:#c084fc;" onclick="ENTER_ROOM_AS_GM(document.getElementById('lobby-gm-room').value)">👑 Открыть Стол Гейм-Мастера</button>
                </div>
            </div>
        </div>
    `;
}

// ================================================================
// ⚔️ ПОШАГОВАЯ БОЕВАЯ СИСТЕМА В СТИЛЕ BALDUR'S GATE 3 (gm.js)
// (Строгая очередь ходов, Очки Действия 🟢 и Бонусного Действия 🔶, ИИ врагов)
// ================================================================
window._bg3SelectedTargetIdx = 0;
window._bg3HotbarCategory = 'weapons'; // 'weapons' | 'cantrips' | 'spells' | 'items'
window._bg3CombatLogBanner = '';

// Сколько атак за 1 Основное действие есть у персонажа (Начиная с 5 ур. боевые классы бьют 2 раза, Воин с 11 ур. — 3 раза!)
function GET_MAX_ATTACKS_PER_ACTION(c) {
    if (!c) return 1;
    const lv = c.level || 1;
    const cls = c.className || '';
    if (cls === 'Воин') return lv >= 20 ? 4 : (lv >= 11 ? 3 : (lv >= 5 ? 2 : 1));
    if (['Варвар', 'Паладин', 'Следопыт', 'Монах'].includes(cls) && lv >= 5) return 2;
    return 1;
}

// Гарантирует, что у структуры очереди боя есть счётчики действий текущего хода
function ENSURE_TURN_STATE(st) {
    if (!st.turnOrder) {
        st.turnOrder = { active: false, round: 1, currentIdx: 0, actionsLeft: 1, attacksLeft: 1, bonusLeft: 1 };
    }
    if (st.turnOrder.actionsLeft === undefined) st.turnOrder.actionsLeft = 1;
    if (st.turnOrder.attacksLeft === undefined) st.turnOrder.attacksLeft = 1;
    if (st.turnOrder.bonusLeft === undefined) st.turnOrder.bonusLeft = 1;
    return st.turnOrder;
}

// Сброс очков действий для нового активного бойца при переходе хода
function RESET_ACTIONS_FOR_CURRENT_FIGHTER(st) {
    const to = ENSURE_TURN_STATE(st);
    const tokens = st.tokens || [];
    if (!tokens.length) return;
    if (to.currentIdx >= tokens.length) to.currentIdx = 0;
    const activeTok = tokens[to.currentIdx];
    const cs = GC();

    if (activeTok && activeTok.isPlayer && cs[activeTok.charIdx]) {
        const ch = cs[activeTok.charIdx];
        to.actionsLeft = 1;
        to.attacksLeft = GET_MAX_ATTACKS_PER_ACTION(ch);
        to.bonusLeft = 1;
    } else {
        to.actionsLeft = 1;
        to.attacksLeft = 1;
        to.bonusLeft = 1;
    }
}

// Синхронизация ХП и статов между карточками игроков (dnd_characters) и их фишками на карте
function SYNC_PLAYER_TOKENS_WITH_CHARS(st) {
    const cs = GC();
    if (!st || !st.tokens) return;
    st.tokens.forEach(tok => {
        if (tok.isPlayer && cs[tok.charIdx]) {
            const ch = cs[tok.charIdx];
            tok.name = ch.name || tok.name;
            tok.hp = ch.hp ?? 10;
            tok.maxHp = ch.maxHp || 10;
            tok.ac = CAC(ch);
            tok.avatar = ch.avatar || '';
        }
    });
}

// Перехватываем клик по фишке на карте: в бою клик по любой фишке выбирает её целью прицела 🎯!
const _ORIG_CLICK_MAP_TOKEN = CLICK_MAP_TOKEN;
CLICK_MAP_TOKEN = function(tIdx) {
    const sess = GET_SESSION();
    const cs = GC();
    const anyInCombat = cs.some(m => m.inCombat);
    if (anyInCombat) {
        window._bg3SelectedTargetIdx = tIdx;
        RENDER_MAP_AREA();
        return;
    }
    _ORIG_CLICK_MAP_TOKEN(tIdx);
};

// Переопределяем переход хода (GM_NEXT_TURN), чтобы он пропускал павших (0 ХП) и восстанавливал очки действий 🟢/🔶!
GM_NEXT_TURN = function() {
    const st = GET_MAP_STATE();
    SYNC_PLAYER_TOKENS_WITH_CHARS(st);
    if (!st.tokens || !st.tokens.length) return;
    const to = ENSURE_TURN_STATE(st);
    to.active = true;

    let loops = 0;
    do {
        to.currentIdx = (to.currentIdx + 1);
        if (to.currentIdx >= st.tokens.length) {
            to.currentIdx = 0;
            to.round = (to.round || 1) + 1;
        }
        loops++;
    } while (st.tokens[to.currentIdx].hp <= 0 && loops < st.tokens.length);

    RESET_ACTIONS_FOR_CURRENT_FIGHTER(st);
    SAVE_MAP_STATE(st);

    const curTok = st.tokens[to.currentIdx];
    LOG_COMBAT_TO_CHAT(`⏭️ [Раунд ${to.round}] Очередь хода переходит к «${curTok ? curTok.name : 'Бойцу'}»!`);
    RENDER_MAP_AREA();
};

// Авто-ход Врага (ИИ монстра), чтобы игроки могли провести ход противника прямо с карты, если он стоит в очереди!
function BG3_EXECUTE_ENEMY_AI_TURN() {
    const st = GET_MAP_STATE();
    SYNC_PLAYER_TOKENS_WITH_CHARS(st);
    const to = ENSURE_TURN_STATE(st);
    const enemyTok = st.tokens && st.tokens[to.currentIdx];
    if (!enemyTok || enemyTok.isPlayer || enemyTok.hp <= 0) {
        GM_NEXT_TURN();
        return;
    }

    const cs = GC();
    // Ищем живых игроков для атаки врага
    const alivePlayers = st.tokens.filter(t => t.isPlayer && cs[t.charIdx] && (cs[t.charIdx].hp ?? 10) > 0);
    if (alivePlayers.length === 0) {
        GM_NEXT_TURN();
        return;
    }

    const targetTok = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    const targetChar = cs[targetTok.charIdx];
    const targetAC = CAC(targetChar);

    const d20 = Math.floor(Math.random() * 20) + 1;
    const atkBonus = parseInt(enemyTok.atkBonus) || 4;
    const totalAtk = d20 + atkBonus;
    const isCrit = (d20 === 20);
    const isHit = isCrit || (d20 !== 1 && totalAtk >= targetAC);

    if (isHit) {
        let dmg = Math.max(1, ROLL(enemyTok.dmgFormula || '1к6+2'));
        if (isCrit) dmg *= 2;
        targetChar.hp = Math.max(0, (targetChar.hp ?? 10) - dmg);
        targetTok.hp = targetChar.hp;
        SC(cs);
        SAVE_MAP_STATE(st);

        window._bg3CombatLogBanner = `
            <div style="background:#3a1818; border-left:4px solid #ef4444; padding:10px 14px; border-radius:8px; margin-bottom:10px; font-size:0.92rem; color:#fca5a5; display:flex; justify-content:space-between; align-items:center;">
                <span>👹 Ход врага: «<b>${enemyTok.name}</b>» атакует «<b>${targetChar.name}</b>»! Попадание: <b>${totalAtk}</b> (против КБ ${targetAC}) ${isCrit ? '<b>[КРИТ!]</b>' : ''} -> Нанесено <b style="color:#fff;">${dmg} урона</b>! (У ${targetChar.name} осталось ${targetChar.hp}/${targetChar.maxHp} ХП)</span>
                <button class="btn-small" style="padding:2px 6px;" onclick="window._bg3CombatLogBanner=''; RENDER_BG3_COMBAT_HUD();">✕</button>
            </div>`;
        LOG_COMBAT_TO_CHAT(`👹 «${enemyTok.name}» атакует «${targetChar.name}»! Попадание: ${totalAtk} (КБ ${targetAC}) -> Урон: ${dmg} (ХП ${targetChar.name}: ${targetChar.hp}/${targetChar.maxHp})`);
    } else {
        window._bg3CombatLogBanner = `
            <div style="background:#22201d; border-left:4px solid #eab308; padding:10px 14px; border-radius:8px; margin-bottom:10px; font-size:0.92rem; color:#fde047; display:flex; justify-content:space-between; align-items:center;">
                <span>🛡️ Ход врага: «<b>${enemyTok.name}</b>» атакует «<b>${targetChar.name}</b>», но <b>ПРОМАХИВАЕТСЯ</b>! (Бросок ${totalAtk} против КБ ${targetAC})</span>
                <button class="btn-small" style="padding:2px 6px;" onclick="window._bg3CombatLogBanner=''; RENDER_BG3_COMBAT_HUD();">✕</button>
            </div>`;
        LOG_COMBAT_TO_CHAT(`👹 «${enemyTok.name}» атакует «${targetChar.name}», но промахивается (${totalAtk} против КБ ${targetAC}).`);
    }

    RMC();
    // Сразу передаём ход следующему по очереди!
    GM_NEXT_TURN();
}

// Дополняем RENDER_MAP_AREA красивой лентой портретов Инициативы сверху карты (как в BG3) и прицелом на выбранной цели
const _ORIG_RENDER_MAP_AREA_BG3 = RENDER_MAP_AREA;
RENDER_MAP_AREA = function() {
    const st = GET_MAP_STATE();
    SYNC_PLAYER_TOKENS_WITH_CHARS(st);
    SAVE_MAP_STATE(st);
    _ORIG_RENDER_MAP_AREA_BG3();

    // Подсвечиваем выбранную цель на карте красным прицелом и рисуем Портретную Ленту Инициативы BG3
    const mapArea = document.getElementById('map-area');
    if (mapArea && st.tokens && st.tokens.length > 0 && st.turnOrder && st.turnOrder.active) {
        const curTurnIdx = (st.turnOrder.currentIdx || 0) % st.tokens.length;
        const selectedEl = document.getElementById('map-tok-' + window._bg3SelectedTargetIdx);
        if (selectedEl) {
            const circle = selectedEl.querySelector('div');
            if (circle) circle.style.outline = '3px dashed #ef4444';
            if (circle) circle.style.outlineOffset = '3px';
        }

        // Заменяем стандартную полоску хода на Портретную Ленту Инициативы в стиле Baldur's Gate 3!
        let bg3TurnRibbon = document.getElementById('bg3-initiative-ribbon');
        if (!bg3TurnRibbon) {
            bg3TurnRibbon = document.createElement('div');
            bg3TurnRibbon.id = 'bg3-initiative-ribbon';
            mapArea.appendChild(bg3TurnRibbon);
        }
        bg3TurnRibbon.style.cssText = 'position:absolute; top:8px; left:50%; transform:translateX(-50%); z-index:9; display:flex; align-items:center; gap:6px; background:rgba(15,14,13,0.94); border:1px solid #c9a96e; padding:6px 12px; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,0.9); max-width:96%; overflow-x:auto;';

        let cardsHTML = `<div style="color:#c9a96e; font-weight:bold; font-size:0.8rem; margin-right:4px; white-space:nowrap;">Раунд ${st.turnOrder.round || 1}</div>`;
        st.tokens.forEach((tok, idx) => {
            const isCur = (idx === curTurnIdx);
            const isDead = (tok.hp <= 0);
            const borderCol = isCur ? '#facc15' : (tok.isPlayer ? '#4cd964' : '#ef4444');
            cardsHTML += `
                <div onclick="event.stopPropagation(); window._bg3SelectedTargetIdx=${idx}; RENDER_MAP_AREA();"
                     title="Кликните, чтобы выбрать «${tok.name}» целью атаки"
                     style="cursor:pointer; display:flex; align-items:center; gap:6px; padding:4px 8px; border-radius:8px; background:${isCur ? '#332b17' : '#1c1a17'}; border:2px solid ${borderCol}; opacity:${isDead ? '0.35' : '1'}; transform:${isCur ? 'scale(1.06)' : 'none'}; transition:all 0.15s; flex-shrink:0;">
                    <span style="font-size:1.1rem;">${tok.icon || (tok.isPlayer ? '🛡️' : '👹')}</span>
                    <div style="text-align:left; line-height:1.1;">
                        <div style="font-size:0.76rem; font-weight:bold; color:${isCur ? '#fef08a' : '#ebe8e2'}; white-space:nowrap;">${tok.name}</div>
                        <div style="font-size:0.68rem; color:${tok.isPlayer ? '#86efac' : '#fca5a5'};">❤️ ${tok.hp}/${tok.maxHp}</div>
                    </div>
                </div>
            `;
        });
        bg3TurnRibbon.innerHTML = cardsHTML;
    }

    RENDER_BG3_COMBAT_HUD();
};

// ================================================================
// 🎮 БОЕВОЙ ХОТБАР В СТИЛЕ BALDUR'S GATE 3 ПОД КАРТОЙ
// ================================================================
function RENDER_BG3_COMBAT_HUD() {
    const sess = GET_SESSION();
    const centerCol = document.getElementById('center-column');
    if (!centerCol) return;

    let hudBox = document.getElementById('bg3-player-combat-hud');
    if (!hudBox) {
        hudBox = document.createElement('div');
        hudBox.id = 'bg3-player-combat-hud';
        const mapPanel = centerCol.querySelector('.panel');
        if (mapPanel) mapPanel.appendChild(hudBox);
    }

    if (!sess || sess.role !== 'player') {
        hudBox.style.display = 'none';
        return;
    }
    hudBox.style.display = 'block';

    const cs = GC();
    const c = cs[PI];
    if (!c) return;
    const st = GET_MAP_STATE();

    // 1. МИРНЫЙ РЕЖИМ
    if (!c.inCombat) {
        hudBox.innerHTML = `
            <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center; background:#181715; border:1px solid #423c33; padding:10px 16px; border-radius:10px; gap:10px; flex-wrap:wrap;">
                <span style="color:#aba498; font-size:0.92rem;">🕊️ Вы вне боя. Хотите внезапно ударить кого-то в сцене и начать сражение?</span>
                <button class="btn-danger" style="padding:9px 18px;" onclick="OPEN_AMBUSH_MODAL()">
                    🗡️ Внезапная атака / Начать бой
                </button>
            </div>
        `;
        return;
    }

    // 2. БОЕВОЙ РЕЖИМ (ПРОВЕРКА ОЧЕРЕДИ ХОДА И ОЧКОВ ДЕЙСТВИЙ 🟢/🔶)
    const tokens = st.tokens || [];
    const to = ENSURE_TURN_STATE(st);
    const curTurnIdx = tokens.length > 0 ? (to.currentIdx % tokens.length) : 0;
    const activeTurnTok = tokens[curTurnIdx] || null;

    // Проверяем: сейчас ход ЭТОГО игрока, другого игрока или врага?
    const isMyTurn = activeTurnTok && activeTurnTok.isPlayer && activeTurnTok.charIdx === PI;
    const isEnemyTurn = activeTurnTok && !activeTurnTok.isPlayer;

    // Если выбранная цель указывает на самого себя, автоматически переключаем прицел на первого живого противника
    if (!tokens[window._bg3SelectedTargetIdx] || (tokens[window._bg3SelectedTargetIdx].isPlayer && tokens[window._bg3SelectedTargetIdx].charIdx === PI)) {
        const firstEnemyIdx = tokens.findIndex((t, i) => (!t.isPlayer || t.charIdx !== PI) && t.hp > 0);
        if (firstEnemyIdx !== -1) window._bg3SelectedTargetIdx = firstEnemyIdx;
    }

    const selectedTok = tokens[window._bg3SelectedTargetIdx] || null;

    // Плашки выбора цели
    let targetsPillsHTML = '';
    tokens.forEach((tok, idx) => {
        if (tok.isPlayer && tok.charIdx === PI) return; // Себя в список целей удара не выводим
        if (tok.hp <= 0) return;
        const isSel = (idx === window._bg3SelectedTargetIdx);
        const isEnemy = !tok.isPlayer;
        targetsPillsHTML += `
            <button class="btn-small" onclick="window._bg3SelectedTargetIdx=${idx}; RENDER_MAP_AREA();"
                style="background:${isSel ? '#7f1d1d' : '#181715'}; color:#fff; border:2px solid ${isSel ? '#facc15' : (isEnemy ? '#ef4444' : '#38bdf8')}; padding:4px 10px; border-radius:8px; font-size:0.82rem; display:inline-flex; align-items:center; gap:5px;">
                <span>${isSel ? '🎯' : (tok.icon || (isEnemy ? '👹' : '🛡️'))}</span>
                <b>${tok.name}</b>
                <small style="color:#fca5a5;">(${tok.hp}/${tok.maxHp} ХП • КБ ${tok.ac || 12})</small>
            </button>
        `;
    });

    // Индикаторы Очков Действия (🟢 Основное действие / 🔶 Бонусное действие) как в BG3
    const hasAction = (to.actionsLeft > 0 && to.attacksLeft > 0);
    const hasBonus = (to.bonusLeft > 0);

    const actionDotsHTML = `
        <div style="display:flex; flex-direction:column; gap:6px; background:#141312; border:1px solid #3d3830; padding:10px 12px; border-radius:10px; min-width:170px; justify-content:center;">
            <div style="display:flex; align-items:center; gap:8px; font-size:0.84rem;">
                <span style="display:inline-block; width:14px; height:14px; border-radius:50%; background:${hasAction && isMyTurn ? '#22c55e' : '#333'}; box-shadow:${hasAction && isMyTurn ? '0 0 8px #22c55e' : 'none'}; border:1px solid #86efac;"></span>
                <span style="color:${hasAction && isMyTurn ? '#ebe8e2' : '#666'};">Действие: <b>${isMyTurn ? to.attacksLeft : 0}</b></span>
            </div>
            <div style="display:flex; align-items:center; gap:8px; font-size:0.84rem;">
                <span style="display:inline-block; width:14px; height:14px; border-radius:3px; transform:rotate(45deg); background:${hasBonus && isMyTurn ? '#f97316' : '#333'}; box-shadow:${hasBonus && isMyTurn ? '0 0 8px #f97316' : 'none'}; border:1px solid #fdba74;"></span>
                <span style="color:${hasBonus && isMyTurn ? '#ebe8e2' : '#666'};">Бонусное: <b>${isMyTurn ? to.bonusLeft : 0}</b></span>
            </div>
        </div>
    `;

    // Сборка плиток способностей центральной части хотбара
    const cat = window._bg3HotbarCategory || 'weapons';
    const pb = GPB(c.level || 1);
    const sm = GM(c.str || 10), dm = GM(c.dex || 10);
    let actionTilesHTML = '';

    if (!isMyTurn) {
        // Если сейчас НЕ ход этого игрока — показываем красивый экран ожидания очереди (или кнопку хода ИИ врага!)
        actionTilesHTML = `
            <div style="flex:1; background:#161514; border:1px dashed #524a3d; border-radius:10px; padding:16px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
                <div>
                    <div style="color:#facc15; font-weight:bold; font-size:1rem;">⏳ Сейчас ход: «${activeTurnTok ? activeTurnTok.name : 'Ожидание'}»</div>
                    <small style="color:#9e988e;">Вы сможете атаковать, как только очередь хода дойдёт до вашего героя.</small>
                </div>
                ${isEnemyTurn
                    ? `<button class="btn-danger" onclick="BG3_EXECUTE_ENEMY_AI_TURN()">👹 Выполнить ход врага (${activeTurnTok.name})</button>`
                    : `<button class="btn-small" onclick="GM_NEXT_TURN()">⏭️ Пропустить / Передать ход</button>`
                }
            </div>
        `;
    } else {
        // СЕЙЧАС ХОД ЭТОГО ИГРОКА! Рисуем активные плитки ударов и заклинаний:
        if (cat === 'weapons') {
            const eqWeapons = (c.inventory || []).map((item, idx) => ({ item, idx })).filter(x => x.item.isWeapon && x.item.equipped);
            eqWeapons.forEach(({ item, idx }, wOrder) => {
                const am = item.finesse ? Math.max(sm, dm) : (item.ranged ? dm : sm);
                // Если это второе лёгкое оружие в левой руке — оно бьёт за 🔶 Бонусное действие!
                const isOffhand = (wOrder > 0);
                const canUse = isOffhand ? hasBonus : hasAction;
                const costBadge = isOffhand ? '<span style="color:#fb923c;">🔶 Бонусное</span>' : '<span style="color:#4ade80;">🟢 Действие</span>';

                actionTilesHTML += `
                    <div onclick="${canUse ? `BG3_EXECUTE_WEAPON_ATTACK(${idx}, ${isOffhand})` : ''}"
                         style="cursor:${canUse ? 'pointer' : 'not-allowed'}; opacity:${canUse ? '1' : '0.4'}; width:136px; height:92px; background:linear-gradient(180deg, #2b241d 0%, #171411 100%); border:2px solid ${canUse ? '#c9a96e' : '#3d3830'}; border-radius:10px; padding:8px; display:flex; flex-direction:column; justify-content:space-between; text-align:center; transition:transform 0.12s;"
                         onmouseover="if(${canUse}) this.style.transform='translateY(-2px)'" onmouseout="this.style.transform='none'">
                        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.7rem;">
                            ${costBadge}
                            <b style="color:#52b758;">${MS(am + pb)}</b>
                        </div>
                        <div style="font-size:1.35rem; line-height:1;">${item.icon || '⚔️'}</div>
                        <div style="font-weight:bold; color:#e6c88c; font-size:0.8rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.name}</div>
                        <div style="color:#ccc; font-size:0.74rem;">Урон: <b>${item.damage}${MS(am)}</b></div>
                    </div>
                `;
            });

            const unarmedDmg = (c.chosenFeats && c.chosenFeats.includes('Драчун')) ? `1к4${MS(sm)}` : `${Math.max(1, 1 + sm)}`;
            actionTilesHTML += `
                <div onclick="${hasAction ? 'BG3_EXECUTE_UNARMED_ATTACK()' : ''}"
                     style="cursor:${hasAction ? 'pointer' : 'not-allowed'}; opacity:${hasAction ? '1' : '0.4'}; width:136px; height:92px; background:linear-gradient(180deg, #25221f 0%, #151412 100%); border:1px solid ${hasAction ? '#8c7853' : '#3d3830'}; border-radius:10px; padding:8px; display:flex; flex-direction:column; justify-content:space-between; text-align:center;">
                    <div style="display:flex; justify-content:space-between; font-size:0.7rem;">
                        <span style="color:#4ade80;">🟢 Действие</span>
                        <b style="color:#52b758;">${MS(sm + pb)}</b>
                    </div>
                    <div style="font-size:1.35rem; line-height:1;">👊</div>
                    <div style="font-weight:bold; color:#ddd; font-size:0.8rem;">Рукопашная</div>
                    <div style="color:#aaa; font-size:0.74rem;">Урон: <b>${unarmedDmg}</b></div>
                </div>
            `;
        } else if (cat === 'cantrips') {
            const known = c.knownSpells || [];
            const cantrips = gameData.spells.filter(sp => sp.level === 0 && known.includes(sp.name));
            cantrips.forEach(sp => {
                const isBonus = sp.time && sp.time.includes('бонус');
                const canUse = isBonus ? hasBonus : hasAction;
                actionTilesHTML += `
                    <div onclick="${canUse ? `BG3_EXECUTE_SPELL('${sp.name}')` : ''}" title="${sp.desc}"
                         style="cursor:${canUse ? 'pointer' : 'not-allowed'}; opacity:${canUse ? '1' : '0.4'}; width:140px; height:92px; background:linear-gradient(180deg, #172536 0%, #101720 100%); border:2px solid ${canUse ? '#38bdf8' : '#334155'}; border-radius:10px; padding:8px; display:flex; flex-direction:column; justify-content:space-between; text-align:center;">
                        <div style="font-size:0.7rem; color:${isBonus ? '#fb923c' : '#4ade80'};">${isBonus ? '🔶 Бонусное' : '🟢 Действие'}</div>
                        <div style="font-size:1.3rem; line-height:1;">✨</div>
                        <div style="font-weight:bold; color:#bae6fd; font-size:0.8rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${sp.name}</div>
                        <div style="color:#38bdf8; font-size:0.72rem;">${sp.range}</div>
                    </div>
                `;
            });
            if (!actionTilesHTML) actionTilesHTML = `<div style="color:#777; padding:20px;">Нет изученных заговоров</div>`;
        } else if (cat === 'spells') {
            NORMALIZE_WARLOCK_SLOTS(c);
            const maxSlots = GET_SPELL_SLOTS(c);
            const usedSlots = c.usedSpellSlots || {};
            const known = c.knownSpells || [];
            const leveledSpells = gameData.spells.filter(sp => sp.level >= 1 && known.includes(sp.name));

            leveledSpells.forEach(sp => {
                let slotLv = sp.level;
                if (c.className === 'Колдун' && sp.level <= 5) {
                    for (let i = 5; i >= 1; i--) { if (maxSlots[i] > 0) { slotLv = i; break; } }
                }
                const avail = (maxSlots[slotLv] || 0) - (usedSlots[slotLv] || 0);
                const isBonus = sp.time && sp.time.includes('бонус');
                const canUse = avail > 0 && (isBonus ? hasBonus : hasAction);

                actionTilesHTML += `
                    <div onclick="${canUse ? `BG3_EXECUTE_SPELL('${sp.name}')` : ''}" title="${sp.desc}"
                         style="cursor:${canUse ? 'pointer' : 'not-allowed'}; opacity:${canUse ? '1' : '0.4'}; width:142px; height:92px; background:linear-gradient(180deg, #2a1b38 0%, #16101e 100%); border:2px solid ${canUse ? '#c084fc' : '#3b284d'}; border-radius:10px; padding:8px; display:flex; flex-direction:column; justify-content:space-between; text-align:center;">
                        <div style="display:flex; justify-content:space-between; font-size:0.68rem;">
                            <span style="color:${isBonus ? '#fb923c' : '#4ade80'};">${isBonus ? '🔶 Бон.' : '🟢 Действ.'}</span>
                            <span style="color:#e9d5ff;">${sp.level} круг</span>
                        </div>
                        <div style="font-size:1.25rem; line-height:1;">🔮</div>
                        <div style="font-weight:bold; color:#f3e8ff; font-size:0.8rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${sp.name}</div>
                        <div style="color:${avail > 0 ? '#c084fc' : '#ef4444'}; font-size:0.72rem;">Ячеек: ${Math.max(0, avail)}/${maxSlots[slotLv] || 0}</div>
                    </div>
                `;
            });
            if (!actionTilesHTML) actionTilesHTML = `<div style="color:#777; padding:20px;">Нет изученных заклинаний 1+ круга</div>`;
        } else if (cat === 'items') {
            const potions = (c.inventory || []).map((item, idx) => ({ item, idx })).filter(x => GET_ITEM_TYPE(x.item) === 'potion');
            potions.forEach(({ item, idx }) => {
                actionTilesHTML += `
                    <div onclick="${hasBonus ? `BG3_USE_COMBAT_POTION(${idx})` : ''}"
                         style="cursor:${hasBonus ? 'pointer' : 'not-allowed'}; opacity:${hasBonus ? '1' : '0.4'}; width:136px; height:92px; background:linear-gradient(180deg, #192e20 0%, #101c14 100%); border:2px solid ${hasBonus ? '#4cd964' : '#2a4733'}; border-radius:10px; padding:8px; display:flex; flex-direction:column; justify-content:space-between; text-align:center;">
                        <div style="font-size:0.7rem; color:#fb923c;">🔶 Бонусное</div>
                        <div style="font-size:1.35rem; line-height:1;">🧪 ×${item.qty || 1}</div>
                        <div style="font-weight:bold; color:#bbf7d0; font-size:0.8rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.name}</div>
                        <div style="color:#4cd964; font-size:0.72rem;">Выпить</div>
                    </div>
                `;
            });
            if (!actionTilesHTML) actionTilesHTML = `<div style="color:#777; padding:20px;">В рюкзаке нет зелий</div>`;
        }
    }

    const catBtn = (code, label) => `
        <button class="btn-small" onclick="window._bg3HotbarCategory='${code}'; RENDER_BG3_COMBAT_HUD();"
            style="background:${cat===code ? '#c9a96e' : '#161514'}; color:${cat===code ? '#181510' : '#ccc'}; border:1px solid ${cat===code ? '#e0c58e' : '#3d3830'}; padding:5px 12px; font-size:0.84rem;">
            ${label}
        </button>`;

    hudBox.innerHTML = `
        <div style="margin-top:12px; background:linear-gradient(180deg, #221d18 0%, #141210 100%); border:2px solid #c9a96e; border-radius:14px; padding:14px 16px; box-shadow:0 10px 30px rgba(0,0,0,0.88);">
            ${window._bg3CombatLogBanner || ''}

            <!-- Верхняя строка: Выбор Цели + Кнопки вкладок -->
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid #38332c;">
                <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap;">
                    <span style="color:#c9a96e; font-size:0.86rem; font-weight:bold;">🎯 Цель:</span>
                    ${targetsPillsHTML || `<span style="color:#777; font-size:0.84rem;">Нет целей</span>`}
                    <button class="btn-small" style="padding:3px 8px; font-size:0.76rem;" onclick="OPEN_AMBUSH_MODAL()">+ Цель</button>
                </div>
                <div style="display:flex; gap:5px; flex-wrap:wrap;">
                    ${catBtn('weapons', '⚔️ Оружие')}
                    ${catBtn('cantrips', '✨ Заговоры')}
                    ${catBtn('spells', '🔮 Заклинания')}
                    ${catBtn('items', '🧪 Зелья')}
                </div>
            </div>

            <!-- Основное тело Хотбара BG3: Слева Очки Действий, по центру Плитки Способностей, справа Кнопка Конца Хода -->
            <div style="display:flex; gap:12px; align-items:stretch; justify-content:space-between; flex-wrap:wrap;">
                ${actionDotsHTML}

                <div style="flex:1; display:flex; gap:8px; flex-wrap:wrap; align-items:center; min-height:94px;">
                    ${actionTilesHTML}
                </div>

                <!-- Правая колонка управления ходом (как круглая кнопка конца хода в BG3) -->
                <div style="display:flex; flex-direction:column; gap:6px; justify-content:center; min-width:145px;">
                    <button class="${!hasAction && isMyTurn ? 'btn-save' : ''}" onclick="GM_NEXT_TURN()"
                            style="height:56px; font-size:0.95rem; border-radius:10px; ${!hasAction && isMyTurn ? 'box-shadow:0 0 14px rgba(76,217,100,0.6);' : ''}">
                        ⏳ Завершить ход
                    </button>
                    <button class="btn-small btn-danger" style="padding:4px 8px; font-size:0.76rem;" onclick="PLAYER_LEAVE_COMBAT()">
                        🏳️ Завершить бой
                    </button>
                </div>
            </div>
        </div>
    `;
}

// ================================================================
// 🗡️ ОКНО ВНЕЗАПНОЙ АТАКИ («НАПАСТЬ В БАРЕ И ЗАВЯЗАТЬ БОЙ»)
// ================================================================
function OPEN_AMBUSH_MODAL() {
    const cs = GC();
    const c = cs[PI];
    if (!c) return;
    const st = GET_MAP_STATE();
    const vn = GET_ACTIVE_VN_DIALOG();
    const npcs = GET_NPCS();

    const cont = document.getElementById('gm-tool-modal-content');
    cont.style.maxWidth = '680px';

    let targetOptions = '';
    if (vn && vn.active && vn.name) {
        targetOptions += `<option value="vn_npc:${vn.name}">🎭 Собеседник перед вами: ${vn.name} (${vn.role || 'NPC'})</option>`;
    }
    if (st.tokens && st.tokens.length > 0) {
        st.tokens.forEach((t, idx) => {
            if (!t.isPlayer || t.charIdx !== PI) {
                targetOptions += `<option value="map_tok:${idx}">♟️ На карте: ${t.name} (ХП ${t.hp}/${t.maxHp})</option>`;
            }
        });
    }
    npcs.forEach((n) => {
        if (!vn || vn.name !== n.name) {
            targetOptions += `<option value="saved_npc:${n.name}">👤 Персонаж мира: ${n.name} (${n.role || 'NPC'})</option>`;
        }
    });
    cs.forEach((m, idx) => {
        if (idx !== PI) {
            targetOptions += `<option value="party:${idx}">🤝 Союзник в отряде: ${m.name} (ХП ${m.hp ?? 10}/${m.maxHp || 10})</option>`;
        }
    });
    targetOptions += `<option value="custom">✏️ Вписать свою цель (напр. Вышибала в баре, Стражник)...</option>`;

    let weaponOptions = '';
    (c.inventory || []).forEach((item, idx) => {
        if (item.isWeapon && item.equipped) {
            weaponOptions += `<option value="wep:${idx}">⚔️ Оружие: ${item.name} (${item.damage})</option>`;
        }
    });
    weaponOptions += `<option value="unarmed">👊 Безоружный удар (Кулаком / Кружкой)</option>`;
    (c.knownSpells || []).forEach(spName => {
        const sp = gameData.spells.find(s => s.name === spName);
        if (sp) weaponOptions += `<option value="spell:${sp.name}">✨ Заклинание: ${sp.name} (${sp.level === 0 ? 'Заговор' : sp.level + ' круг'})</option>`;
    });

    cont.innerHTML = `
        <h2>🗡️ Внезапная атака / Завязать бой</h2>
        <p style="color:#aba498; font-size:0.92rem; margin-bottom:14px;">
            Выберите, кого вы хотите атаковать! Цель появится на тактической карте, ваш герой нанесёт внезапный первый удар и начнётся пошаговый бой!
        </p>

        <div style="background:#181715; border:1px solid #423c33; padding:18px; border-radius:10px; display:flex; flex-direction:column; gap:12px;">
            <div>
                <label style="color:#c9a96e; font-weight:bold;">1. Кого вы хотите ударить?</label>
                <select id="ambush-target-select" onchange="document.getElementById('ambush-custom-box').style.display = (this.value==='custom' ? 'flex' : 'none');" style="margin-top:6px; text-align:left;">
                    ${targetOptions}
                </select>
            </div>

            <div id="ambush-custom-box" style="display:none; gap:10px; background:#121110; padding:10px; border-radius:8px; border:1px dashed #635a4a;">
                <div style="flex:2;">
                    <label style="color:#aaa; font-size:0.85rem;">Имя цели:</label>
                    <input type="text" id="ambush-custom-name" placeholder="Напр.: Трактирщик" style="margin-top:4px; text-align:left;">
                </div>
                <div style="flex:1;">
                    <label style="color:#aaa; font-size:0.85rem;">ХП цели:</label>
                    <input type="number" id="ambush-custom-hp" value="20" min="1" style="margin-top:4px;">
                </div>
                <div style="flex:1;">
                    <label style="color:#aaa; font-size:0.85rem;">КБ цели:</label>
                    <input type="number" id="ambush-custom-ac" value="13" min="8" style="margin-top:4px;">
                </div>
            </div>

            <div>
                <label style="color:#c9a96e; font-weight:bold;">2. Чем нанести внезапный удар?</label>
                <select id="ambush-attack-select" style="margin-top:6px; text-align:left;">
                    ${weaponOptions}
                </select>
            </div>

            <button class="btn-danger" style="padding:14px; font-size:1.08rem; margin-top:6px;" onclick="EXECUTE_AMBUSH_START_COMBAT()">
                💥 Нанести удар и начать БОЙ!
            </button>
        </div>
        <div style="margin-top:14px; text-align:right;"><button onclick="CM('gm-tool-modal')">Отмена</button></div>
    `;
    OM('gm-tool-modal');
}

function EXECUTE_AMBUSH_START_COMBAT() {
    const targetVal = document.getElementById('ambush-target-select')?.value || 'custom';
    const attackVal = document.getElementById('ambush-attack-select')?.value || 'unarmed';
    const cs = GC();
    const c = cs[PI];
    const st = GET_MAP_STATE();
    if (!st.tokens) st.tokens = [];

    // 1. Выставляем фишки всех игроков пачки на карту, если их ещё нет
    cs.forEach((m, idx) => {
        if (!st.tokens.some(t => t.isPlayer && t.charIdx === idx)) {
            st.tokens.push({
                id: Date.now() + idx,
                isPlayer: true,
                charIdx: idx,
                name: m.name || ('Герой ' + (idx + 1)),
                icon: '🛡️',
                avatar: m.avatar || '',
                x: 25 + (idx * 14) % 55,
                y: 74,
                hp: m.hp ?? 10,
                maxHp: m.maxHp || 10,
                ac: CAC(m),
                init: Math.floor(Math.random() * 20) + 1 + GM(m.dex || 10)
            });
        }
    });

    // 2. Находим или создаём фишку цели на карте
    let targetNameForLookup = '';
    if (targetVal.startsWith('map_tok:')) {
        const tIdx = parseInt(targetVal.split(':')[1]);
        targetNameForLookup = st.tokens[tIdx]?.name || '';
    } else if (targetVal.startsWith('party:')) {
        const pIdx = parseInt(targetVal.split(':')[1]);
        const pTok = st.tokens.find(t => t.isPlayer && t.charIdx === pIdx);
        targetNameForLookup = pTok ? pTok.name : '';
    } else {
        let newTargetName = 'Противник';
        let newTargetHp = 22;
        let newTargetAc = 13;
        let newTargetAvatar = '';

        if (targetVal.startsWith('vn_npc:') || targetVal.startsWith('saved_npc:')) {
            const npcName = targetVal.split(':')[1];
            const vn = GET_ACTIVE_VN_DIALOG();
            const foundNpc = GET_NPCS().find(n => n.name === npcName);
            newTargetName = npcName;
            newTargetAvatar = (vn && vn.name === npcName && vn.avatar) ? vn.avatar : (foundNpc?.avatar || '');
            if (vn && vn.active) SAVE_ACTIVE_VN_DIALOG(null);
        } else if (targetVal === 'custom') {
            newTargetName = document.getElementById('ambush-custom-name')?.value.trim() || 'Завсегдатай таверны';
            newTargetHp = Math.max(1, parseInt(document.getElementById('ambush-custom-hp')?.value) || 20);
            newTargetAc = Math.max(8, parseInt(document.getElementById('ambush-custom-ac')?.value) || 13);
        }

        targetNameForLookup = newTargetName;
        if (!st.tokens.some(t => !t.isPlayer && t.name === newTargetName)) {
            st.tokens.push({
                id: Date.now() + 99,
                isPlayer: false,
                name: newTargetName,
                icon: '😠',
                avatar: newTargetAvatar,
                x: 50,
                y: 32,
                hp: newTargetHp,
                maxHp: newTargetHp,
                ac: newTargetAc,
                atkBonus: 4,
                dmgFormula: '1к6+2',
                init: Math.floor(Math.random() * 20) + 1
            });
        }
    }

    // 3. Тот, кто начал внезапную атаку, получает первый ход в Раунде 1 (эффект Внезапности!), остальные сортируются следом
    const myTok = st.tokens.find(t => t.isPlayer && t.charIdx === PI);
    if (myTok) myTok.init = 99;
    st.tokens.sort((a, b) => (b.init || 10) - (a.init || 10));

    const newTargetIdx = st.tokens.findIndex(t => t.name === targetNameForLookup && (!t.isPlayer || t.charIdx !== PI));
    window._bg3SelectedTargetIdx = newTargetIdx !== -1 ? newTargetIdx : 0;

    cs.forEach(m => { m.inCombat = true; });
    SC(cs);
    CANCEL_REST_POLL_IF_COMBAT(c.name || 'Игрок');

    st.turnOrder = {
        active: true,
        round: 1,
        currentIdx: 0,
        actionsLeft: 1,
        attacksLeft: GET_MAX_ATTACKS_PER_ACTION(c),
        bonusLeft: 1
    };
    SAVE_MAP_STATE(st);

    CM('gm-tool-modal');
    LOG_COMBAT_TO_CHAT(`💥 ВНЕЗАПНАЯ АТАКА! «${c.name}» атакует «${st.tokens[window._bg3SelectedTargetIdx]?.name || 'цель'}» — начинается пошаговый БОЙ!`);

    if (attackVal.startsWith('wep:')) {
        BG3_EXECUTE_WEAPON_ATTACK(parseInt(attackVal.split(':')[1]), false);
    } else if (attackVal.startsWith('spell:')) {
        BG3_EXECUTE_SPELL(attackVal.split(':')[1]);
    } else {
        BG3_EXECUTE_UNARMED_ATTACK();
    }
}

// === НАНЕСЕНИЕ УРОНА С УЧЁТОМ ОЧЕРЕДИ ХОДА И ТРАТЫ ДЕЙСТВИЙ (БЕЗ БАГА РЕГЕНА ХП!) ===
function BG3_APPLY_DAMAGE_TO_MAP_TARGET(dmg, atkRoll, totalAtk, weaponLabel, isBonusAction = false) {
    const st = GET_MAP_STATE();
    const cs = GC();
    const to = ENSURE_TURN_STATE(st);
    const curTurnTok = st.tokens && st.tokens[to.currentIdx % st.tokens.length];

    // 1. Строгая проверка: сейчас ли ход этого игрока?
    if (!curTurnTok || !curTurnTok.isPlayer || curTurnTok.charIdx !== PI) {
        showMessage('⏳ Сейчас не ваш ход!', `По очереди инициативы сейчас ходит «<b>${curTurnTok ? curTurnTok.name : 'другой персонаж'}</b>». Дождитесь своего хода!`);
        return;
    }

    // 2. Проверка наличия Очков Действия (🟢 или 🔶)
    if (isBonusAction) {
        if (to.bonusLeft <= 0) {
            showMessage('🔶 Бонусное действие потрачено', 'У вас больше нет Бонусных действий в этом ходу. Завершите ход!');
            return;
        }
    } else {
        if (to.actionsLeft <= 0 || to.attacksLeft <= 0) {
            showMessage('🟢 Основное действие потрачено', 'Вы уже использовали все свои атаки в этом ходу. Нажмите «⏳ Завершить ход»!');
            return;
        }
    }

    const tok = st.tokens && st.tokens[window._bg3SelectedTargetIdx];
    if (!tok) {
        showMessage('🎯 Выберите цель', 'Сначала кликните по фишке противника на карте или выберите цель над хотбаром!');
        return;
    }

    // Списываем очко действия
    if (isBonusAction) {
        to.bonusLeft = Math.max(0, to.bonusLeft - 1);
    } else {
        to.attacksLeft = Math.max(0, to.attacksLeft - 1);
        if (to.attacksLeft <= 0) to.actionsLeft = 0;
    }

    const targetAC = (tok.isPlayer && cs[tok.charIdx]) ? CAC(cs[tok.charIdx]) : (tok.ac || 12);
    const isCrit = (atkRoll === 20);
    const isMiss = (atkRoll === 1) || (!isCrit && totalAtk < targetAC);

    if (isMiss) {
        SAVE_MAP_STATE(st);
        window._bg3CombatLogBanner = `
            <div style="background:#26221e; border-left:4px solid #e06060; padding:8px 12px; border-radius:6px; margin-bottom:10px; font-size:0.9rem; display:flex; justify-content:space-between; align-items:center;">
                <span>💨 <b>${weaponLabel}</b> по «<b>${tok.name}</b>»: бросок <b>${totalAtk}</b> (к20=${atkRoll}) против КБ ${targetAC} — <b style="color:#e06060;">ПРОМАХ!</b></span>
                <button class="btn-small" style="padding:2px 6px;" onclick="window._bg3CombatLogBanner=''; RENDER_BG3_COMBAT_HUD();">✕</button>
            </div>`;
        LOG_COMBAT_TO_CHAT(`⚔️ атакует («${weaponLabel}») -> «${tok.name}»: попадание ${totalAtk} против КБ ${targetAC} — ПРОМАХ!`);
        RENDER_MAP_AREA();
        return;
    }

    const finalDmg = isCrit ? dmg * 2 : dmg;
    let remainingHp = 0;

    // Если цель — другой игрок в отряде, списываем ХП и в карточке персонажа, и на его фишке (без перезаписи старыми данными!)
    if (tok.isPlayer && cs[tok.charIdx]) {
        const targetChar = cs[tok.charIdx];
        targetChar.hp = Math.max(0, (targetChar.hp ?? 10) - finalDmg);
        remainingHp = targetChar.hp;
        tok.hp = remainingHp;
        SC(cs);
    } else {
        tok.hp = Math.max(0, (tok.hp ?? 10) - finalDmg);
        remainingHp = tok.hp;
    }

    SAVE_MAP_STATE(st);
    const critBadge = isCrit ? ' <b style="color:#facc15;">[КРИТИЧЕСКИЙ УДАР ×2!]</b>' : '';
    const deadBadge = remainingHp <= 0 ? ' 💀 <b style="color:#ef4444;">ЦЕЛЬ ПОВЕРЖЕНА!</b>' : ` (Осталось ХП: ${remainingHp}/${tok.maxHp})`;

    window._bg3CombatLogBanner = `
        <div style="background:#16241a; border-left:4px solid #4cd964; padding:8px 12px; border-radius:6px; margin-bottom:10px; font-size:0.9rem; display:flex; justify-content:space-between; align-items:center;">
            <span>💥 <b>${weaponLabel}</b> по «<b>${tok.name}</b>»: попадание <b>${totalAtk}</b> (против КБ ${targetAC})${critBadge} -> Урон: <b style="color:#4cd964;">${finalDmg}</b>!${deadBadge}</span>
            <button class="btn-small" style="padding:2px 6px;" onclick="window._bg3CombatLogBanner=''; RENDER_BG3_COMBAT_HUD();">✕</button>
        </div>`;

    LOG_COMBAT_TO_CHAT(`⚔️ атакует («${weaponLabel}») -> «${tok.name}» | Попадание: ${totalAtk} (КБ ${targetAC}) | Урон: ${finalDmg}${remainingHp <= 0 ? ' (ПОВЕРЖЕН!)' : ''}`);
    RMC();
    RENDER_MAP_AREA();
}

function BG3_EXECUTE_WEAPON_ATTACK(invIdx, isOffhand = false) {
    const cs = GC();
    const c = cs[PI];
    const item = c.inventory && c.inventory[invIdx];
    if (!item) return;

    const pb = GPB(c.level || 1);
    const sm = GM(c.str || 10), dm = GM(c.dex || 10);
    const am = item.finesse ? Math.max(sm, dm) : (item.ranged ? dm : sm);
    const atkRoll = Math.floor(Math.random() * 20) + 1;
    const totalAtk = atkRoll + am + pb;

    let dmgFormula = item.damage || '1к4';
    const hasShieldOrSecondWeapon = (c.inventory || []).filter(x => x.equipped && (x.isWeapon || x.isShield)).length > 1;
    if (item.properties && item.properties.includes('универсальное') && !hasShieldOrSecondWeapon) {
        const m = item.properties.match(/универсальное\s*\(([^)]+)\)/i);
        if (m && m[1]) dmgFormula = m[1];
    }
    const dmg = Math.max(1, ROLL(dmgFormula) + (isOffhand ? 0 : am));
    BG3_APPLY_DAMAGE_TO_MAP_TARGET(dmg, atkRoll, totalAtk, item.name, isOffhand);
}

function BG3_EXECUTE_UNARMED_ATTACK() {
    const cs = GC();
    const c = cs[PI];
    const pb = GPB(c.level || 1);
    const sm = GM(c.str || 10);
    const atkRoll = Math.floor(Math.random() * 20) + 1;
    const totalAtk = atkRoll + sm + pb;
    const dmg = (c.chosenFeats && c.chosenFeats.includes('Драчун')) ? Math.max(1, Math.floor(Math.random() * 4) + 1 + sm) : Math.max(1, 1 + sm);
    BG3_APPLY_DAMAGE_TO_MAP_TARGET(dmg, atkRoll, totalAtk, 'Безоружный удар', false);
}

// Сотворение заклинания с хотбара BG3 (с тратой ячейки, проверкой очереди хода и честным списанием ХП цели!)
function BG3_EXECUTE_SPELL(spellName) {
    const st = GET_MAP_STATE();
    const to = ENSURE_TURN_STATE(st);
    const curTurnTok = st.tokens && st.tokens[to.currentIdx % st.tokens.length];

    if (!curTurnTok || !curTurnTok.isPlayer || curTurnTok.charIdx !== PI) {
        showMessage('⏳ Сейчас не ваш ход!', `Дождитесь очереди хода вашего персонажа.`);
        return;
    }

    const sp = gameData.spells.find(s => s.name === spellName);
    if (!sp) return;
    const isBonus = sp.time && sp.time.includes('бонус');

    if (isBonus && to.bonusLeft <= 0) {
        showMessage('🔶 Нет Бонусного действия', 'Вы уже потратили Бонусное действие в этом ходу.');
        return;
    }
    if (!isBonus && to.actionsLeft <= 0) {
        showMessage('🟢 Нет Основного действия', 'Вы уже потратили Основное действие в этом ходу.');
        return;
    }

    const cs = GC();
    const caster = cs[PI];
    NORMALIZE_WARLOCK_SLOTS(caster);

    // Списываем ячейку заклинания, если это не заговор
    if (sp.level > 0) {
        const maxSlots = GET_SPELL_SLOTS(caster);
        if (!caster.usedSpellSlots) caster.usedSpellSlots = {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0};
        let slotLv = sp.level;
        if (caster.className === 'Колдун' && sp.level <= 5) {
            for (let i = 5; i >= 1; i--) { if (maxSlots[i] > 0) { slotLv = i; break; } }
        }
        const avail = (maxSlots[slotLv] || 0) - (caster.usedSpellSlots[slotLv] || 0);
        if (avail <= 0) {
            showMessage('❌ Нет ячеек магии', `Все ячейки ${slotLv}-го круга потрачены!`);
            return;
        }
        caster.usedSpellSlots[slotLv] = (caster.usedSpellSlots[slotLv] || 0) + 1;
    }

    // Тратим действие или бонусное действие
    if (isBonus) {
        to.bonusLeft = 0;
    } else {
        to.actionsLeft = 0;
        to.attacksLeft = 0;
    }

    const tok = st.tokens && st.tokens[window._bg3SelectedTargetIdx];
    const castStatMap = {'Волшебник':'intl', 'Жрец':'wis', 'Друид':'wis', 'Следопыт':'wis', 'Бард':'cha', 'Паладин':'cha', 'Колдун':'cha', 'Чародей':'cha'};
    const mod = GM(caster[castStatMap[caster.className] || 'wis'] || 10);

    // Если заклинание лечащее
    if (spellName.includes('Леч') || spellName.includes('Восстановление')) {
        const healTargetChar = (tok && tok.isPlayer && cs[tok.charIdx]) ? cs[tok.charIdx] : caster;
        const healed = Math.max(1, ROLL('1к8') + mod);
        healTargetChar.hp = Math.min(healTargetChar.maxHp || 10, (healTargetChar.hp ?? 10) + healed);
        SC(cs);
        SYNC_PLAYER_TOKENS_WITH_CHARS(st);
        SAVE_MAP_STATE(st);
        window._bg3CombatLogBanner = `<div style="background:#16241a; border-left:4px solid #4cd964; padding:8px 12px; border-radius:6px; margin-bottom:10px;">💚 Заклинание «<b>${spellName}</b>» исцеляет «<b>${healTargetChar.name}</b>» на <b>+${healed} ХП</b>!</div>`;
        LOG_COMBAT_TO_CHAT(`✨ колдует «${spellName}» и исцеляет «${healTargetChar.name}» на +${healed} ХП!`);
        RMC();
        RENDER_MAP_AREA();
        return;
    }

    // Если заклинание боевое
    const dmgFormula = PARSE_SPELL_DICE_FROM_DESC(sp.desc || '') || '1к8';
    const rolledDmg = Math.max(1, ROLL(dmgFormula));

    if (tok) {
        if (tok.isPlayer && cs[tok.charIdx]) {
            cs[tok.charIdx].hp = Math.max(0, (cs[tok.charIdx].hp ?? 10) - rolledDmg);
            tok.hp = cs[tok.charIdx].hp;
        } else {
            tok.hp = Math.max(0, (tok.hp ?? 10) - rolledDmg);
        }
    }

    SC(cs);
    SAVE_MAP_STATE(st);
    window._bg3CombatLogBanner = `
        <div style="background:#241830; border-left:4px solid #c084fc; padding:8px 12px; border-radius:6px; margin-bottom:10px; font-size:0.9rem; display:flex; justify-content:space-between; align-items:center;">
            <span>🔮 Заклинание «<b>${spellName}</b>» поражает «<b>${tok ? tok.name : 'цель'}</b>» на <b style="color:#c084fc;">${rolledDmg} урона</b>! ${tok ? `(ХП: ${tok.hp}/${tok.maxHp})` : ''}</span>
            <button class="btn-small" style="padding:2px 6px;" onclick="window._bg3CombatLogBanner=''; RENDER_BG3_COMBAT_HUD();">✕</button>
        </div>`;
    LOG_COMBAT_TO_CHAT(`🔮 колдует «${spellName}» -> «${tok ? tok.name : 'цель'}» | Урон: ${rolledDmg}`);
    RMC();
    RENDER_MAP_AREA();
}

function BG3_USE_COMBAT_POTION(invIdx) {
    const st = GET_MAP_STATE();
    const to = ENSURE_TURN_STATE(st);
    const curTurnTok = st.tokens && st.tokens[to.currentIdx % st.tokens.length];

    if (!curTurnTok || !curTurnTok.isPlayer || curTurnTok.charIdx !== PI) {
        showMessage('⏳ Сейчас не ваш ход!', 'Выпить зелье можно только в свой ход.');
        return;
    }
    if (to.bonusLeft <= 0) {
        showMessage('🔶 Нет Бонусного действия', 'Вы уже потратили Бонусное действие в этом ходу.');
        return;
    }
    to.bonusLeft = 0;
    SAVE_MAP_STATE(st);
    ctxItem = invIdx;
    CA('use');
    CM('inventory-modal');
    RENDER_MAP_AREA();
}

function PLAYER_LEAVE_COMBAT() {
    const cs = GC();
    cs.forEach(m => { m.inCombat = false; });
    SC(cs);
    const st = GET_MAP_STATE();
    if (st.turnOrder) st.turnOrder.active = false;
    SAVE_MAP_STATE(st);
    window._bg3CombatLogBanner = '';
    RMC();
    RENDER_MAP_AREA();
}

APPLY_ROLE_VIEW();
// ================================================================
// 🚀 WEBSOCKET-СИНХРОНИЗАЦИЯ БЕЗ ПРЫЖКОВ ФИШЕК И ЭХА
// ================================================================
(function INIT_FAST_WEBSOCKET_MULTIPLAYER() {
    const FIREBASE_DB_URL = "https://dnds-23b7d-default-rtdb.firebaseio.com";

    const statusBadge = document.createElement('div');
    statusBadge.id = 'cloud-sync-badge';
    statusBadge.style.cssText = 'position:fixed; bottom:8px; left:8px; background:#1a1a1a; border:1px solid #444; color:#aaa; padding:4px 10px; border-radius:12px; font-size:0.75em; z-index:99999; pointer-events:none;';
    statusBadge.textContent = '⏳ Подключение WebSocket...';
    document.body.appendChild(statusBadge);

    // 1. Защита от сбоя перетаскивания, если курсор ушёл за пределы карты
    window.addEventListener('mouseup', function() {
        if (window._draggingMapObj) {
            const mapArea = document.getElementById('map-area');
            if (mapArea && mapArea.onmouseup) mapArea.onmouseup();
        }
    });

    let isApplyingRemote = false;
    let lastLocalWriteTime = {}; // Защита от «эха» при быстром перемещении подряд
    let cachedMapImg = '';       // Храним тяжёлую картинку отдельно от лёгких координат фишек!

    const SYNC_KEYS = [
        'dnd_characters', 'dnd_rooms', 'dnd_map_state', 'dnd_map_bg_img', 'dnd_gm_shop',
        'dnd_bestiary', 'dnd_npcs', 'dnd_vn_dialog', 'dnd_prepared_events',
        'dnd_custom_lore', 'dnd_gm_event', 'dnd_gm_skill_check',
        'dnd_gm_edit_request', 'dnd_rest_poll', 'dnd_tasks',
        'dnd_chat', 'dnd_sys_log', 'dnd_npc_dialog_log'
    ];

    const origSetItem = localStorage.setItem.bind(localStorage);
    const origGetItem = localStorage.getItem.bind(localStorage);
    const origRemoveItem = localStorage.removeItem.bind(localStorage);

    // Перехватываем чтение dnd_map_state, чтобы подставлять закэшированную картинку карты
    localStorage.getItem = function(key) {
        const val = origGetItem(key);
        if (key === 'dnd_map_state' && val) {
            try {
                const parsed = JSON.parse(val);
                if (!parsed.img && cachedMapImg) {
                    parsed.img = cachedMapImg;
                    return JSON.stringify(parsed);
                }
            } catch (e) {}
        }
        return val;
    };

    // Подгружаем официальный WebSocket-клиент Firebase
    const script = document.createElement('script');
    script.src = "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js";
    script.onload = function() {
        const dbScript = document.createElement('script');
        dbScript.src = "https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js";
        dbScript.onload = startWebSocketEngine;
        document.head.appendChild(dbScript);
    };
    document.head.appendChild(script);

    function startWebSocketEngine() {
        firebase.initializeApp({ databaseURL: FIREBASE_DB_URL });
        const dbRef = firebase.database().ref('campaign');

        statusBadge.textContent = '🟢 WebSocket: 0 мс (Без лагов)';
        statusBadge.style.borderColor = '#4caf50';

        // Отправка изменений по открытому WebSocket-каналу
        localStorage.setItem = function(key, val) {
            // Если сохраняется состояние карты — вырезаем из него тяжёлую картинку в отдельный ключ,
            // чтобы при перетаскивании фишек улетали только лёгкие координаты (300 байт вместо 2 МБ!)
            if (key === 'dnd_map_state' && val && !isApplyingRemote) {
                try {
                    const st = JSON.parse(val);
                    if (st.img && st.img.length > 500) {
                        if (st.img !== cachedMapImg) {
                            cachedMapImg = st.img;
                            origSetItem('dnd_map_bg_img', cachedMapImg);
                            dbRef.child('dnd_map_bg_img').set(cachedMapImg);
                        }
                        st.img = ''; // В основном пакете фишек картинку не гоняем!
                        val = JSON.stringify(st);
                    } else if (st.img === '' && cachedMapImg && !window._clearingMapImg) {
                        // Сохраняем кэш, если это просто передвижение фишки
                    }
                } catch (e) {}
            }

            try { origSetItem(key, val); } catch (e) { return; }

            if (!isApplyingRemote && SYNC_KEYS.includes(key)) {
                lastLocalWriteTime[key] = Date.now();
                dbRef.child(key).set(val);
            }
        };

        localStorage.removeItem = function(key) {
            origRemoveItem(key);
            if (!isApplyingRemote && SYNC_KEYS.includes(key)) {
                lastLocalWriteTime[key] = Date.now();
                dbRef.child(key).set("");
            }
        };

        // Первичная проверка: если облако пустое, выгружаем локальные данные
        dbRef.once('value', (snap) => {
            if (!snap.exists() && (origGetItem('dnd_rooms') || origGetItem('dnd_characters'))) {
                const dump = {};
                SYNC_KEYS.forEach(k => {
                    const v = origGetItem(k);
                    if (v !== null) dump[k] = v;
                });
                dbRef.update(dump);
            }
        });

        // Слушаем каждый ключ отдельно по WebSocket
        SYNC_KEYS.forEach(key => {
            dbRef.child(key).on('value', (snap) => {
                const remoteVal = snap.val();
                if (remoteVal === null || remoteVal === undefined) return;

                // ЗАЩИТА ОТ ПРЫЖКОВ ФИШЕК:
                // 1) Если мы сами только что (менее 650 мс назад) отправили этот ключ — игнорируем обратное эхо!
                if (lastLocalWriteTime[key] && (Date.now() - lastLocalWriteTime[key] < 650)) {
                    return;
                }
                // 2) Если прямо сейчас мышка зажата и тащит фишку — не даём серверу сбить курсор!
                if (key === 'dnd_map_state' && window._draggingMapObj) {
                    return;
                }

                if (key === 'dnd_map_bg_img') {
                    cachedMapImg = remoteVal || '';
                    origSetItem('dnd_map_bg_img', cachedMapImg);
                    RENDER_MAP_AREA();
                    return;
                }

                const currentLocal = origGetItem(key);
                if (currentLocal === remoteVal) return;

                isApplyingRemote = true;
                if (remoteVal === "") origRemoveItem(key);
                else { try { origSetItem(key, remoteVal); } catch (e) {} }
                isApplyingRemote = false;

                // Точечно обновляем только нужный кусок интерфейса, не перерисовывая весь сайт!
                const activeTag = document.activeElement ? document.activeElement.tagName : '';
                const isTyping = (activeTag === 'INPUT' || activeTag === 'TEXTAREA' || activeTag === 'SELECT');

                if (key === 'dnd_map_state' || key === 'dnd_vn_dialog') {
                    RENDER_MAP_AREA();
                } else if (key === 'dnd_chat' || key === 'dnd_sys_log') {
                    RCH();
                } else if (key === 'dnd_rest_poll') {
                    CHECK_AND_RENDER_REST_POPUP();
                } else if (key === 'dnd_gm_skill_check') {
                    CHECK_AND_RENDER_SKILL_ROLL_POPUP();
                } else if (key === 'dnd_gm_edit_request') {
                    CHECK_AND_RENDER_PERMISSION_POPUP();
                    CHECK_GM_PERMISSION_RESPONSE();
                } else if (key === 'dnd_gm_event') {
                    CHECK_UNSEEN_GM_EVENT();
                } else if (!isTyping) {
                    RMC(); RPL(); LDT(); RENDER_MAP_AREA();
                    const sess = GET_SESSION();
                    if (sess && sess.role === 'gm') RENDER_GM_LEFT_COLUMN();
                    else if (!sess) RENDER_LOBBY_HTML();
                }
            });
        });
    }
})();