// ================================================================
// 🔐 СИСТЕМА УЧЁТНЫХ ЗАПИСЕЙ, ПОШАГОВОГО ВХОДА ИГРОКА, ШАБЛОНОВ ГЕРОЕВ
// И ПРИВЯЗКИ ПРОГРЕССА К КОНКРЕТНОЙ КОМНАТЕ (АНТИ-ЧИТ) (auth.js)
// ================================================================
window._authMode = 'login';           // 'login' | 'register'
window._lobbyStep = 'role';           // 'role' | 'gm_rooms' | 'player_chars' | 'player_rooms'
window._charCreateTab = 'my';         // 'my' | 'templates' | 'create'
window._selectedBaseHeroId = null;    // ID выбранного персонажа перед входом в комнату
window._openSheetAfterJoin = false;   // Открыть ли сразу Лист персонажа для ручной настройки

// --- 1. ХЭШИРОВАНИЕ И ХРАНЕНИЕ АККАУНТОВ ---
function HASH_PASSWORD(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return 'h_' + (h >>> 0).toString(16);
}

function GET_ACCOUNTS() {
    const raw = localStorage.getItem('dnd_users_accounts');
    if (!raw) return {};
    try { return JSON.parse(raw); } catch (e) { return {}; }
}
function SAVE_ACCOUNTS(accObj) {
    localStorage.setItem('dnd_users_accounts', JSON.stringify(accObj));
}

function GET_CURRENT_USER() {
    const raw = localStorage.getItem('dnd_active_auth_user');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; } // { login, displayName }
}
function SAVE_CURRENT_USER(userObj) {
    if (!userObj) localStorage.removeItem('dnd_active_auth_user');
    else localStorage.setItem('dnd_active_auth_user', JSON.stringify(userObj));
}

function SET_AUTH_MODE(mode) {
    window._authMode = mode;
    RENDER_AUTH_SCREEN();
}

function LOGOUT_ACCOUNT() {
    if (!confirm('Выйти из текущей учётной записи?')) return;
    SAVE_SESSION(null);
    SAVE_CURRENT_USER(null);
    window._lobbyStep = 'role';
    APPLY_ROLE_VIEW();
}

function SUBMIT_AUTH_FORM() {
    const loginInp = document.getElementById('auth-login-inp');
    const passInp = document.getElementById('auth-pass-inp');
    const nameInp = document.getElementById('auth-name-inp');
    const errBox = document.getElementById('auth-error-box');

    const rawLogin = (loginInp?.value || '').trim();
    const loginKey = rawLogin.toLowerCase();
    const pass = (passInp?.value || '').trim();
    const displayName = (nameInp?.value || '').trim() || rawLogin;

    const showErr = (msg) => {
        if (errBox) {
            errBox.style.display = 'block';
            errBox.textContent = '⚠️ ' + msg;
        }
    };

    if (loginKey.length < 3) { showErr('Логин должен содержать минимум 3 символа.'); return; }
    if (pass.length < 4) { showErr('Пароль должен содержать минимум 4 символа.'); return; }

    const accounts = GET_ACCOUNTS();
    const passHash = HASH_PASSWORD(loginKey + ':' + pass);

    if (window._authMode === 'register') {
        if (accounts[loginKey]) {
            showErr('Этот логин уже занят! Переключитесь на вкладку «Вход» или выберите другой.');
            return;
        }
        accounts[loginKey] = {
            login: rawLogin,
            displayName: displayName,
            passHash: passHash,
            createdAt: new Date().toLocaleDateString()
        };
        SAVE_ACCOUNTS(accounts);
        SAVE_CURRENT_USER({ login: loginKey, displayName: displayName });
        SAVE_GM_NAME(displayName);
        window._lobbyStep = 'role';
        APPLY_ROLE_VIEW();
    } else {
        const acc = accounts[loginKey];
        if (!acc) { showErr('Аккаунт с таким логином не найден.'); return; }
        if (acc.passHash !== passHash) { showErr('Неверный пароль!'); return; }
        SAVE_CURRENT_USER({ login: loginKey, displayName: acc.displayName || acc.login });
        SAVE_GM_NAME(acc.displayName || acc.login);
        window._lobbyStep = 'role';
        APPLY_ROLE_VIEW();
    }
}

function RENDER_AUTH_SCREEN() {
    let authOverlay = document.getElementById('auth-overlay-screen');
    const user = GET_CURRENT_USER();

    if (user) {
        if (authOverlay) authOverlay.style.display = 'none';
        return;
    }

    if (!authOverlay) {
        authOverlay = document.createElement('div');
        authOverlay.id = 'auth-overlay-screen';
        authOverlay.style.cssText = 'position:fixed; inset:0; background:radial-gradient(circle at top, #25211d 0%, #0e0d0c 100%); z-index:90000; display:flex; align-items:center; justify-content:center; padding:20px;';
        document.body.appendChild(authOverlay);
    }
    authOverlay.style.display = 'flex';
    const isReg = (window._authMode === 'register');

    authOverlay.innerHTML = `
        <div class="panel" style="width:460px; max-width:96vw; padding:28px 30px; border:2px solid #c9a96e; box-shadow:0 16px 50px rgba(0,0,0,0.95); text-align:center;">
            <div style="font-size:2.8rem; margin-bottom:6px;">🐉</div>
            <h2 style="font-size:1.5rem; margin-bottom:6px; border:none;">D&D: Притишье</h2>
            <p style="color:#aba498; font-size:0.92rem; margin-bottom:20px;">
                Войдите в свою учётную запись, чтобы управлять своими героями и комнатами кампаний
            </p>

            <div style="display:flex; gap:8px; margin-bottom:18px;">
                <button class="btn-small" style="flex:1; padding:10px; background:${!isReg ? '#c9a96e' : '#181715'}; color:${!isReg ? '#181510' : '#ccc'}; border-color:${!isReg ? '#e0c58e' : '#3d3830'};" onclick="SET_AUTH_MODE('login')">
                    🔑 Вход
                </button>
                <button class="btn-small" style="flex:1; padding:10px; background:${isReg ? '#c9a96e' : '#181715'}; color:${isReg ? '#181510' : '#ccc'}; border-color:${isReg ? '#e0c58e' : '#3d3830'};" onclick="SET_AUTH_MODE('register')">
                    ✨ Регистрация
                </button>
            </div>

            <div id="auth-error-box" style="display:none; background:#3a1818; border:1px solid #ef4444; color:#fca5a5; padding:10px; border-radius:8px; font-size:0.88rem; margin-bottom:14px; text-align:left;"></div>

            <div style="display:flex; flex-direction:column; gap:12px; text-align:left;">
                <div>
                    <label style="color:#e6c88c; font-size:0.9rem; font-weight:bold;">Логин:</label>
                    <input type="text" id="auth-login-inp" placeholder="Введите ваш логин..."
                           onkeypress="if(event.key==='Enter') SUBMIT_AUTH_FORM();"
                           style="width:100%; margin-top:4px; padding:11px 14px; background:#141312; color:#fff; border:1px solid #524a3d; border-radius:8px; font-size:1rem; text-align:left;">
                </div>

                ${isReg ? `
                <div>
                    <label style="color:#e6c88c; font-size:0.9rem; font-weight:bold;">Отображаемое имя (Никнейм):</label>
                    <input type="text" id="auth-name-inp" placeholder="Как вас называть в игре..."
                           onkeypress="if(event.key==='Enter') SUBMIT_AUTH_FORM();"
                           style="width:100%; margin-top:4px; padding:11px 14px; background:#141312; color:#fff; border:1px solid #524a3d; border-radius:8px; font-size:1rem; text-align:left;">
                </div>` : ''}

                <div>
                    <label style="color:#e6c88c; font-size:0.9rem; font-weight:bold;">Пароль:</label>
                    <input type="password" id="auth-pass-inp" placeholder="••••••••"
                           onkeypress="if(event.key==='Enter') SUBMIT_AUTH_FORM();"
                           style="width:100%; margin-top:4px; padding:11px 14px; background:#141312; color:#fff; border:1px solid #524a3d; border-radius:8px; font-size:1rem; text-align:left;">
                </div>

                <button class="btn-save" style="width:100%; padding:14px; font-size:1.08rem; margin-top:6px;" onclick="SUBMIT_AUTH_FORM()">
                    ${isReg ? '✅ Создать аккаунт и войти' : '🚪 Войти в аккаунт'}
                </button>
            </div>
        </div>
    `;
}

// ================================================================
// 🛡️ 2. СИСТЕМА ИЗОЛЯЦИИ ПРОГРЕССА ПО КОМНАТАМ (АНТИ-ЧИТ)
// ================================================================
// Поля прогресса, которые привязываются строго к конкретной комнате (уровень, опыт, лут, золото, ХП, баффы):
const ROOM_PROGRESS_FIELDS = [
    'level', 'xp', 'hp', 'maxHp', 'tempHP', 'spentHitDice', 'shortRestsUsed',
    'arcaneRecoveryUsed', 'inventory', 'money', 'usedSpellSlots', 'usedSpells',
    'knownSpells', 'pendingChoices', '_completedChoices', 'chosenFeats',
    'expertiseSkills', 'weaponProficiencies', 'initiativeBonus', 'toughPerLevel',
    'featSpeedBonus', '_hpRolls', '_hpInitialized', 'inCombat', 'inspiration',
    'baseStr', 'baseDex', 'baseCon', 'baseInt', 'baseWis', 'baseCha',
    'race', 'subrace', 'className', 'subclass', 'background', 'chosenSkills',
    'chosenLanguages', 'raceLocked', 'classLocked', 'subclassLocked', 'bgLocked',
    'statsLocked', 'skillsLocked', 'languagesLocked'
];

// Снимает слепок текущего состояния персонажа (для сохранения в комнату или в базовый шаблон 0-го прогресса)
function EXTRACT_PROGRESS_SNAPSHOT(c) {
    const snap = {};
    ROOM_PROGRESS_FIELDS.forEach(k => {
        if (c[k] !== undefined) {
            snap[k] = JSON.parse(JSON.stringify(c[k]));
        }
    });
    return snap;
}

// Применяет слепок состояния к персонажу
function APPLY_PROGRESS_SNAPSHOT(c, snap) {
    if (!snap) return;
    ROOM_PROGRESS_FIELDS.forEach(k => {
        if (snap[k] !== undefined) {
            c[k] = JSON.parse(JSON.stringify(snap[k]));
        }
    });
    AB(c);
}

// Автоматически сохраняет текущий прогресс героя в текущую активную комнату при каждом вызове SC(cs)
const _ORIG_SC_ROOM_ISOLATION = SC;
SC = function(cs) {
    const sess = GET_SESSION();
    if (sess && sess.roomCode && Array.isArray(cs)) {
        const rCode = String(sess.roomCode);
        cs.forEach(c => {
            if (!c) return;
            // Если у героя ещё нет чистой копии 1-го уровня (_baseSnapshot), создаём её
            if (!c._baseSnapshot) {
                const fresh1 = CREATE_CLEAN_LEVEL1_SNAPSHOT(c);
                c._baseSnapshot = fresh1;
            }
            if (!c.roomProgress) c.roomProgress = {};
            // Если этот персонаж сейчас активно играет в этой комнате — записываем его прогресс в слот этой комнаты
            if (c._activeRoomCode === rCode) {
                c.roomProgress[rCode] = EXTRACT_PROGRESS_SNAPSHOT(c);
            }
        });
    }
    _ORIG_SC_ROOM_ISOLATION(cs);
};

// Создаёт гарантированно «нулевой» (1 уровень) базовый слепок персонажа для входа в новые комнаты без читерства
function CREATE_CLEAN_LEVEL1_SNAPSHOT(c) {
    const temp = CREATE_DEFAULT_CHAR();
    temp.name = c.name || 'Герой';
    temp.race = c.race || '';
    temp.subrace = c.subrace || '';
    temp.className = c.className || '';
    temp.background = c.background || '';
    temp.alignment = c.alignment || '';
    temp.baseStr = c._initStats ? c._initStats[0] : (c.baseStr || 10);
    temp.baseDex = c._initStats ? c._initStats[1] : (c.baseDex || 10);
    temp.baseCon = c._initStats ? c._initStats[2] : (c.baseCon || 10);
    temp.baseInt = c._initStats ? c._initStats[3] : (c.baseInt || 10);
    temp.baseWis = c._initStats ? c._initStats[4] : (c.baseWis || 10);
    temp.baseCha = c._initStats ? c._initStats[5] : (c.baseCha || 10);
    temp.chosenSkills = c._initSkills ? [...c._initSkills] : [...(c.chosenSkills || []).slice(0, 4)];
    temp.knownSpells = c._initSpells ? [...c._initSpells] : [...(c.knownSpells || []).filter(s => {
        const sp = gameData.spells.find(x => x.name === s);
        return sp && sp.level <= 1;
    })];
    temp.inventory = c._initInventory ? JSON.parse(JSON.stringify(c._initInventory)) : [];
    temp.money = { gp: 15, sp: 0, cp: 0 };
    temp.raceLocked = !!temp.race;
    temp.classLocked = !!temp.className;
    temp.bgLocked = !!temp.background;
    temp.statsLocked = !!c.statsLocked;
    temp.skillsLocked = !!c.skillsLocked;
    temp.level = 1;
    temp.xp = 0;
    AB(temp);
    temp.hp = temp.maxHp || 10;
    return EXTRACT_PROGRESS_SNAPSHOT(temp);
}

// Переключает персонажа на его прогресс в выбранной комнате (или сбрасывает на 1 ур. для новой комнаты!)
function LOAD_HERO_STATE_FOR_ROOM(c, roomCode) {
    if (!c) return;
    const rCode = String(roomCode);
    if (!c._baseSnapshot) {
        c._baseSnapshot = CREATE_CLEAN_LEVEL1_SNAPSHOT(c);
    }
    if (!c.roomProgress) c.roomProgress = {};

    // Если персонаж раньше был в другой комнате — сохраним его старый прогресс туда перед переключением
    if (c._activeRoomCode && c._activeRoomCode !== rCode) {
        c.roomProgress[c._activeRoomCode] = EXTRACT_PROGRESS_SNAPSHOT(c);
    }

    if (c.roomProgress[rCode]) {
        // В этой комнате герой уже играл — загружаем его честный прогресс именно из этой комнаты!
        APPLY_PROGRESS_SNAPSHOT(c, c.roomProgress[rCode]);
    } else {
        // В этой комнате герой впервые — загружаем нулевой прогресс (1 уровень, без чужого лута и прокачки)!
        APPLY_PROGRESS_SNAPSHOT(c, c._baseSnapshot);
        c.roomProgress[rCode] = EXTRACT_PROGRESS_SNAPSHOT(c);
    }
    c._activeRoomCode = rCode;
}

// ================================================================
// 📜 3. ГОТОВЫЕ ШАБЛОНЫ ГЕРОЕВ И АВТО-ГЕНЕРАТОР
// ================================================================
const HERO_TEMPLATES = [
    {
        title: '⚔️ Торгрим Железнобород',
        subtitle: 'Дварф (Горный) • Воин 1 ур.',
        desc: 'Крепкий танк в кольчуге со щитом и боевым молотом. Отлично держит удар в первых рядах.',
        name: 'Торгрим', race: 'Дварф', subrace: 'Горный', className: 'Воин', background: 'Солдат',
        alignment: 'Законно-добрый', stats: [15, 12, 14, 8, 13, 10],
        skills: ['Атлетика', 'Запугивание', 'Восприятие', 'Выживание'],
        spells: [],
        items: [
            { name: 'Боевой молот', qty: 1, eq: true },
            { name: 'Кольчуга', qty: 1, eq: true },
            { name: 'Щит', qty: 1, eq: true },
            { name: 'Зелье лечения', qty: 2, eq: false }
        ]
    },
    {
        title: '🏹 Лираэль Звёздный Ветер',
        subtitle: 'Эльф (Лесной) • Следопыт 1 ур.',
        desc: 'Стремительная лучница из лесной чащи. Высокая скорость, меткий длинный лук и навыки следопыта.',
        name: 'Лираэль', race: 'Эльф', subrace: 'Лесной', className: 'Следопыт', background: 'Чужеземец',
        alignment: 'Нейтрально-добрый', stats: [12, 15, 13, 10, 14, 8],
        skills: ['Скрытность', 'Выживание', 'Природа', 'Акробатика'],
        spells: [],
        items: [
            { name: 'Длинный лук', qty: 1, eq: true },
            { name: 'Короткий меч', qty: 1, eq: false },
            { name: 'Кожаный доспех', qty: 1, eq: true },
            { name: 'Стрелы', qty: 20, eq: false },
            { name: 'Зелье лечения', qty: 1, eq: false }
        ]
    },
    {
        title: '🔮 Малакор Пепельный',
        subtitle: 'Тифлинг (Асмодей) • Колдун 1 ур.',
        desc: 'Маг потустороннего договора. Обрушивает на врагов огненные заговоры и Адское возмездие.',
        name: 'Малакор', race: 'Тифлинг', subrace: 'Асмодей', className: 'Колдун', background: 'Мудрец',
        alignment: 'Хаотично-нейтральный', stats: [8, 14, 13, 12, 10, 15],
        skills: ['Магия', 'Обман', 'История', 'Запугивание'],
        spells: ['Леденящее прикосновение', 'Малая иллюзия', 'Адское возмездие', 'Доспех Агатиса'],
        items: [
            { name: 'Кинжал', qty: 1, eq: true },
            { name: 'Кожаный доспех', qty: 1, eq: true },
            { name: 'Зелье лечения', qty: 2, eq: false }
        ]
    },
    {
        title: '✨ Серафина Светлая',
        subtitle: 'Аасимар (Защитник) • Жрец (Жизнь) 1 ур.',
        desc: 'Целительница и защитница отряда. Благословляет союзников, лечит раны и выжигает врагов Священным пламенем.',
        name: 'Серафина', race: 'Аасимар', subrace: 'Защитник', className: 'Жрец', subclass: 'Жизнь', background: 'Прислужник',
        alignment: 'Законно-добрый', stats: [13, 10, 14, 8, 15, 12],
        skills: ['Медицина', 'Религия', 'Проницательность', 'Убеждение'],
        spells: ['Священное пламя', 'Чудотворство', 'Починка', 'Лечение ран', 'Благословение', 'Приказ'],
        items: [
            { name: 'Булава', qty: 1, eq: true },
            { name: 'Кольчужная рубаха', qty: 1, eq: true },
            { name: 'Щит', qty: 1, eq: true },
            { name: 'Зелье лечения', qty: 2, eq: false }
        ]
    },
    {
        title: '🗡️ Финн Быстрая Тень',
        subtitle: 'Полурослик (Легконогий) • Плут 1 ур.',
        desc: 'Мастер скрытности, взлома замков и парных клинков. Наносит точные удары из тени.',
        name: 'Финн', race: 'Полурослик', subrace: 'Легконогий', className: 'Плут', background: 'Преступник',
        alignment: 'Хаотично-добрый', stats: [8, 15, 13, 12, 10, 14],
        skills: ['Скрытность', 'Ловкость рук', 'Акробатика', 'Восприятие', 'Обман', 'Расследование'],
        spells: [],
        items: [
            { name: 'Короткий меч', qty: 1, eq: true },
            { name: 'Кинжал', qty: 1, eq: true },
            { name: 'Проклёпанный кожаный доспех', qty: 1, eq: true },
            { name: 'Воровские инструменты', qty: 1, eq: false },
            { name: 'Зелье лечения', qty: 1, eq: false }
        ]
    },
    {
        title: '🪓 Громмаш Крушитель',
        subtitle: 'Полуорк • Варвар 1 ур.',
        desc: 'Свирепый воин с огромной двуручной секирой (1к12). Неумолимая стойкость не даёт ему пасть в бою.',
        name: 'Громмаш', race: 'Полуорк', subrace: '', className: 'Варвар', background: 'Народный герой',
        alignment: 'Хаотично-добрый', stats: [15, 13, 14, 8, 12, 10],
        skills: ['Атлетика', 'Выживание', 'Восприятие'],
        spells: [],
        items: [
            { name: 'Секира', qty: 1, eq: true },
            { name: 'Топорик', qty: 2, eq: false },
            { name: 'Зелье лечения', qty: 2, eq: false }
        ]
    }
];

function BUILD_HERO_FROM_CONFIG(cfg) {
    const user = GET_CURRENT_USER();
    const c = CREATE_DEFAULT_CHAR();
    c.id = 'hero_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    c.owner = user ? user.login : '';
    c.ownerName = user ? user.displayName : '';
    c.name = cfg.name || 'Герой';
    c.race = cfg.race || '';
    c.subrace = cfg.subrace || '';
    c.className = cfg.className || '';
    c.subclass = cfg.subclass || '';
    c.background = cfg.background || '';
    c.alignment = cfg.alignment || 'Нейтральный';

    const st = cfg.stats || [15, 14, 13, 12, 10, 8];
    c.baseStr = st[0]; c.baseDex = st[1]; c.baseCon = st[2];
    c.baseInt = st[3]; c.baseWis = st[4]; c.baseCha = st[5];
    c._initStats = [...st];

    c.chosenSkills = [...(cfg.skills || [])];
    c._initSkills = [...c.chosenSkills];
    c.knownSpells = [...(cfg.spells || [])];
    c._initSpells = [...c.knownSpells];

    c.inventory = [];
    (cfg.items || []).forEach(it => {
        const obj = CREATE_ITEM_OBJECT(it.name, String(it.qty || 1), '', '');
        obj.equipped = !!it.eq;
        c.inventory.push(obj);
    });
    c._initInventory = JSON.parse(JSON.stringify(c.inventory));
    c.money = { gp: 15, sp: 0, cp: 0 };

    if (c.race) c.raceLocked = true;
    if (c.className) c.classLocked = true;
    if (c.background) c.bgLocked = true;
    if (cfg.lockAll) {
        c.statsLocked = true;
        c.skillsLocked = true;
        c.alignmentLocked = true;
    }

    AB(c);
    c.hp = c.maxHp || 10;
    c._baseSnapshot = EXTRACT_PROGRESS_SNAPSHOT(c);
    c.roomProgress = {};
    return c;
}

// 1. Создание с нуля (Самостоятельно)
function PLAYER_CREATE_MANUAL_HERO() {
    const nameInp = document.getElementById('manual-hero-name-inp');
    const name = (nameInp?.value || '').trim() || 'Новый герой';
    const user = GET_CURRENT_USER();

    const c = CREATE_DEFAULT_CHAR();
    c.id = 'hero_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    c.owner = user ? user.login : '';
    c.ownerName = user ? user.displayName : '';
    c.name = name;
    c.money = { gp: 15, sp: 0, cp: 0 };
    AB(c);
    c._baseSnapshot = EXTRACT_PROGRESS_SNAPSHOT(c);
    c.roomProgress = {};

    const cs = GC();
    cs.push(c);
    SC(cs);

    window._selectedBaseHeroId = c.id;
    window._openSheetAfterJoin = true; // После выбора комнаты сразу откроем Лист Персонажа для ручного заполнения!
    window._lobbyStep = 'player_rooms';
    RENDER_LOBBY_HTML();
}

// 2. Авто-создание (Случайный сбалансированный герой в 1 клик)
function PLAYER_CREATE_AUTO_HERO() {
    const customName = document.getElementById('auto-hero-name-inp')?.value.trim();
    const randomNames = ['Аларик', 'Каэлин', 'Бранн', 'Эльдар', 'Моргана', 'Рейгар', 'Сильвия', 'Дориан', 'Валькор', 'Изольда'];
    const races = Object.keys(gameData.races);
    const classes = Object.keys(gameData.classes);
    const bgs = Object.keys(gameData.backgrounds);

    const rName = races[Math.floor(Math.random() * races.length)];
    const rData = gameData.races[rName];
    const subKeys = rData.sub ? Object.keys(rData.sub) : [];
    const subName = subKeys.length > 0 ? subKeys[Math.floor(Math.random() * subKeys.length)] : '';
    const cName = classes[Math.floor(Math.random() * classes.length)];
    const bgName = bgs[Math.floor(Math.random() * bgs.length)];

    const statPresets = {
        'Варвар':[15,13,14,8,12,10], 'Воин':[15,13,14,8,12,10], 'Паладин':[15,10,13,8,12,14],
        'Монах':[12,15,13,8,14,10], 'Плут':[8,15,14,13,12,10], 'Следопыт':[12,15,13,8,14,10],
        'Волшебник':[8,14,13,15,12,10], 'Жрец':[13,10,14,8,15,12], 'Друид':[8,14,13,12,15,10],
        'Бард':[8,14,13,10,12,15], 'Колдун':[8,14,13,10,12,15], 'Чародей':[8,13,14,10,12,15]
    };

    const starterWeapons = {
        'Варвар': [{name:'Секира',qty:1,eq:true}],
        'Воин': [{name:'Длинный меч',qty:1,eq:true},{name:'Кольчуга',qty:1,eq:true},{name:'Щит',qty:1,eq:true}],
        'Паладин': [{name:'Боевой молот',qty:1,eq:true},{name:'Кольчуга',qty:1,eq:true},{name:'Щит',qty:1,eq:true}],
        'Плут': [{name:'Короткий меч',qty:1,eq:true},{name:'Кинжал',qty:1,eq:true},{name:'Кожаный доспех',qty:1,eq:true}],
        'Следопыт': [{name:'Длинный лук',qty:1,eq:true},{name:'Стрелы',qty:20,eq:false},{name:'Кожаный доспех',qty:1,eq:true}],
        'Монах': [{name:'Боевой посох',qty:1,eq:true}],
        'Жрец': [{name:'Булава',qty:1,eq:true},{name:'Кольчужная рубаха',qty:1,eq:true},{name:'Щит',qty:1,eq:true}],
        'Друид': [{name:'Боевой посох',qty:1,eq:true},{name:'Кожаный доспех',qty:1,eq:true}]
    };

    const classSpells = gameData.spells.filter(s => s.classes.includes(cName) && s.level <= 1).slice(0, 4).map(s => s.name);
    const items = (starterWeapons[cName] || [{name:'Кинжал',qty:1,eq:true}]).concat([{name:'Зелье лечения',qty:2,eq:false}]);

    const newHero = BUILD_HERO_FROM_CONFIG({
        name: customName || randomNames[Math.floor(Math.random() * randomNames.length)],
        race: rName, subrace: subName, className: cName, background: bgName,
        stats: statPresets[cName] || [15,14,13,12,10,8],
        skills: ['Восприятие', 'Атлетика'],
        spells: classSpells,
        items: items,
        lockAll: true
    });

    const cs = GC();
    cs.push(newHero);
    SC(cs);

    window._selectedBaseHeroId = newHero.id;
    window._openSheetAfterJoin = false;
    window._lobbyStep = 'player_rooms';
    RENDER_LOBBY_HTML();
}

// 3. Создание из готового шаблона
function PLAYER_CREATE_FROM_TEMPLATE(tplIdx) {
    const tpl = HERO_TEMPLATES[tplIdx];
    if (!tpl) return;
    const newHero = BUILD_HERO_FROM_CONFIG({ ...tpl, lockAll: true });

    const cs = GC();
    cs.push(newHero);
    SC(cs);

    window._selectedBaseHeroId = newHero.id;
    window._openSheetAfterJoin = false;
    window._lobbyStep = 'player_rooms';
    RENDER_LOBBY_HTML();
}

// Выбор уже существующего героя игрока -> Переход к выбору комнаты
function PLAYER_SELECT_EXISTING_HERO(heroId) {
    window._selectedBaseHeroId = heroId;
    window._openSheetAfterJoin = false;
    window._lobbyStep = 'player_rooms';
    RENDER_LOBBY_HTML();
}

// Удаление своего персонажа из казармы
function PLAYER_DELETE_MY_HERO(heroId) {
    if (!confirm('Удалить этого персонажа навсегда?')) return;
    const cs = GC();
    const idx = cs.findIndex(c => c && c.id === heroId);
    if (idx !== -1) {
        cs.splice(idx, 1);
        SC(cs);
    }
    RENDER_LOBBY_HTML();
}

// Финальный вход выбранным персонажем в выбранную комнату (с загрузкой прогресса именно этой комнаты!)
function PLAYER_JOIN_SELECTED_ROOM(roomCode) {
    const rCode = roomCode || document.getElementById('player-step3-room-select')?.value || '1001';
    const cs = GC();
    const idx = cs.findIndex(c => c && c.id === window._selectedBaseHeroId);
    if (idx === -1) {
        showMessage('Ошибка', 'Персонаж не найден. Пожалуйста, выберите героя заново.');
        window._lobbyStep = 'player_chars';
        RENDER_LOBBY_HTML();
        return;
    }

    const hero = cs[idx];
    // Загружаем прогресс этого героя ТОЛЬКО для выбранной комнаты rCode (или чистый 1 ур., если он тут впервые!)
    LOAD_HERO_STATE_FOR_ROOM(hero, rCode);
    PI = idx;
    SC(cs);

    SAVE_SESSION({ role: 'player', roomCode: rCode, playerIdx: idx, heroId: hero.id });
    APPLY_ROLE_VIEW();

    if (window._openSheetAfterJoin) {
        window._openSheetAfterJoin = false;
        setTimeout(() => { OCS(); }, 150);
    }
}

// ================================================================
// 🏛️ 4. НОВОЕ ПОШАГОВОЕ ЛОББИ (РОЛЬ -> ПЕРСОНАЖ -> КОМНАТА)
// ================================================================
RENDER_LOBBY_HTML = function() {
    const lobby = document.getElementById('lobby-screen');
    if (!lobby) return;
    const user = GET_CURRENT_USER();
    if (!user) return;

    const rooms = GET_ROOMS();
    const cs = GC();

    // Привязываем старых ничейных персонажей к первому зашедшему пользователю, если у него ещё нет героев
    const myHeroes = cs.filter(c => c && c.owner === user.login);
    if (myHeroes.length === 0) {
        cs.forEach(c => {
            if (c && !c.owner) {
                c.owner = user.login;
                c.ownerName = user.displayName;
            }
        });
    }
    const userHeroes = cs.filter(c => c && c.owner === user.login);

    const profileBarHTML = `
        <div style="max-width:1020px; margin:16px auto 24px auto; background:#181715; border:1px solid #c9a96e; padding:12px 20px; border-radius:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="background:#c9a96e; color:#181510; font-weight:bold; padding:4px 10px; border-radius:6px; font-size:0.9rem;">👤 Учётная запись</span>
                <b style="color:#e6c88c; font-size:1.08rem;">${user.displayName}</b>
                <small style="color:#888;">(@${user.login})</small>
            </div>
            <div style="display:flex; gap:8px;">
                ${window._lobbyStep !== 'role' ? `<button class="btn-small" onclick="window._lobbyStep='role'; RENDER_LOBBY_HTML();">⬅️ Назад к выбору роли</button>` : ''}
                <button class="btn-small btn-danger" onclick="LOGOUT_ACCOUNT()">🚪 Выйти из аккаунта</button>
            </div>
        </div>
    `;

    // ШАГ 1: ВЫБОР РОЛИ (ИГРОК ИЛИ ГЕЙМ-МАСТЕР)
    if (window._lobbyStep === 'role') {
        lobby.innerHTML = `
            ${profileBarHTML}
            <div style="max-width:960px; margin:20px auto; text-align:center;">
                <h1 style="font-size:2.2rem; margin-bottom:8px;">🐉 Выберите вашу роль</h1>
                <p style="color:#aba498; font-size:1.05rem; margin-bottom:28px;">Кем вы хотите войти сегодня?</p>

                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap:24px; text-align:left;">
                    <div class="panel" style="border:2px solid #439c47; padding:28px; display:flex; flex-direction:column; justify-content:space-between; cursor:pointer;" onclick="window._lobbyStep='player_chars'; RENDER_LOBBY_HTML();">
                        <div>
                            <div style="font-size:2.8rem; margin-bottom:10px;">⚔️</div>
                            <h2 style="font-size:1.5rem; color:#52b758; border-bottom-color:#334d33;">Войти как Игрок</h2>
                            <p style="color:#ccc; font-size:0.98rem; line-height:1.5; margin-bottom:20px;">
                                Выберите одного из своих персонажей или создайте нового (вручную, автоматически или из готовых шаблонов D&D), а затем подключитесь к комнате кампании.
                            </p>
                            <div style="background:#161513; padding:10px 14px; border-radius:8px; border:1px solid #38332c; color:#e6c88c; font-size:0.9rem; margin-bottom:18px;">
                                👤 Ваших персонажей в казарме: <b>${userHeroes.length}</b><br>
                                🛡️ <small style="color:#9e988e;">Прогресс каждого героя сохраняется отдельно для каждой комнаты!</small>
                            </div>
                        </div>
                        <button class="btn-save" style="width:100%; padding:14px; font-size:1.1rem;">⚔️ Перейти к выбору персонажа ➡️</button>
                    </div>

                    <div class="panel" style="border:2px solid #9b59b6; padding:28px; display:flex; flex-direction:column; justify-content:space-between; cursor:pointer;" onclick="window._lobbyStep='gm_rooms'; RENDER_LOBBY_HTML();">
                        <div>
                            <div style="font-size:2.8rem; margin-bottom:10px;">👑</div>
                            <h2 style="font-size:1.5rem; color:#c084fc; border-bottom-color:#443054;">Войти как Гейм-Мастер</h2>
                            <p style="color:#ccc; font-size:0.98rem; line-height:1.5; margin-bottom:20px;">
                                Управляйте миром, рисуйте тактические карты во встроенном конструкторе, ведите диалоги от лица NPC, открывайте лавки и проводите бои.
                            </p>
                            <div style="background:#161513; padding:10px 14px; border-radius:8px; border:1px solid #38332c; color:#c084fc; font-size:0.9rem; margin-bottom:18px;">
                                🏰 Доступно комнат кампаний: <b>${rooms.length}</b>
                            </div>
                        </div>
                        <button style="width:100%; padding:14px; font-size:1.1rem; background:linear-gradient(180deg, #8b5cf6 0%, #5b21b6 100%); color:#fff; border-color:#c084fc;">👑 Выбрать или создать комнату ➡️</button>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // ШАГ 2 (ДЛЯ МАСТЕРА): ВЫБОР ИЛИ СОЗДАНИЕ КОМНАТЫ КАМПАНИИ
    if (window._lobbyStep === 'gm_rooms') {
        const roomOpts = rooms.map(r => `<option value="${r.code}">Комната #${r.code} — ${r.name}</option>`).join('');
        lobby.innerHTML = `
            ${profileBarHTML}
            <div class="panel" style="max-width:620px; margin:20px auto; border:2px solid #9b59b6; padding:28px;">
                <h2 style="color:#c084fc;">👑 Вход для Гейм-Мастера</h2>
                <div style="margin-bottom:14px;">
                    <label style="color:#c084fc; font-weight:bold; font-size:0.95rem;">Ваш никнейм Гейм-Мастера:</label>
                    <input type="text" id="lobby-gm-name" value="${GET_GM_NAME().replace(/"/g, '&quot;')}" oninput="SAVE_GM_NAME(this.value)" style="width:100%; margin-top:6px; padding:10px; background:#141312; color:#fff; border:1px solid #524a3d; border-radius:6px; text-align:left;">
                </div>
                <div style="margin-bottom:18px;">
                    <label style="color:#e6c88c; font-weight:bold; font-size:0.95rem;">Выберите существующую комнату:</label>
                    <select id="lobby-gm-room" style="width:100%; margin-top:6px; padding:10px; background:#141312; color:#fff; border:1px solid #524a3d; border-radius:6px;">${roomOpts}</select>
                </div>
                <button style="width:100%; padding:14px; font-size:1.1rem; background:linear-gradient(180deg, #8b5cf6 0%, #5b21b6 100%); color:#fff; border-color:#c084fc; margin-bottom:20px;" onclick="ENTER_ROOM_AS_GM(document.getElementById('lobby-gm-room').value)">
                    👑 Открыть Стол Гейм-Мастера
                </button>

                <div style="border-top:1px dashed #423c33; padding-top:16px;">
                    <label style="color:#aaa; font-size:0.9rem;">Или создайте новую комнату кампании:</label>
                    <div style="display:flex; gap:8px; margin-top:8px;">
                        <input type="text" id="lobby-new-room-name" placeholder="Название новой кампании..." style="flex:1; padding:10px; background:#141312; color:#fff; border:1px solid #524a3d; border-radius:6px; text-align:left;">
                        <button class="btn-save" onclick="CREATE_NEW_ROOM_AS_GM()">+ Создать и войти</button>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    // ШАГ 2 (ДЛЯ ИГРОКА): ВЫБОР СВОЕГО ПЕРСОНАЖА ИЛИ СОЗДАНИЕ НОВОГО (САМОСТОЯТЕЛЬНО / АВТО / ШАБЛОНЫ)
    if (window._lobbyStep === 'player_chars') {
        const tab = window._charCreateTab || (userHeroes.length > 0 ? 'my' : 'templates');
        const tabBtn = (code, label) => `
            <button class="btn-small" onclick="window._charCreateTab='${code}'; RENDER_LOBBY_HTML();"
                style="flex:1; padding:11px; font-size:0.98rem; background:${tab===code ? '#c9a96e' : '#181715'}; color:${tab===code ? '#181510' : '#ccc'}; border:1px solid ${tab===code ? '#e0c58e' : '#423c33'};">
                ${label}
            </button>`;

        let contentHTML = '';

        // Вкладка 1: Уже созданные персонажи игрока
        if (tab === 'my') {
            if (userHeroes.length === 0) {
                contentHTML = `
                    <div style="padding:30px; text-align:center; background:#181715; border:1px dashed #423c33; border-radius:10px;">
                        <div style="font-size:2.4rem; margin-bottom:8px;">🛡️</div>
                        <div style="color:#e6c88c; font-weight:bold; font-size:1.1rem; margin-bottom:6px;">У вас пока нет созданных персонажей</div>
                        <p style="color:#9e988e; margin-bottom:16px;">Выберите готового героя из шаблонов или создайте своего с нуля!</p>
                        <div style="display:flex; gap:10px; justify-content:center;">
                            <button class="btn-save" onclick="window._charCreateTab='templates'; RENDER_LOBBY_HTML();">📜 Готовые шаблоны</button>
                            <button onclick="window._charCreateTab='create'; RENDER_LOBBY_HTML();">🛠️ Создать самостоятельно / Авто</button>
                        </div>
                    </div>`;
            } else {
                const cards = userHeroes.map(h => {
                    const roomKeys = h.roomProgress ? Object.keys(h.roomProgress) : [];
                    const progressBadges = roomKeys.length > 0
                        ? roomKeys.map(rk => {
                            const rp = h.roomProgress[rk];
                            return `<span style="background:#25221e; border:1px solid #524a3d; color:#e6c88c; padding:2px 8px; border-radius:6px; font-size:0.78rem;">Комната #${rk}: <b>${rp.level || 1} ур.</b> (🪙 ${rp.money?.gp || 0} зм)</span>`;
                        }).join(' ')
                        : `<span style="color:#888; font-size:0.8rem;">Стартовый 1 уровень (нет сохранений в комнатах)</span>`;

                    return `
                        <div style="background:#181715; border:1px solid #423c33; border-radius:12px; padding:16px; display:flex; justify-content:space-between; align-items:center; gap:14px; margin-bottom:10px; flex-wrap:wrap;">
                            <div style="display:flex; align-items:center; gap:14px; flex:1; min-width:240px;">
                                ${h.avatar ? `<img src="${h.avatar}" style="width:60px; height:60px; border-radius:50%; object-fit:cover; border:2px solid #c9a96e;">` : `<div style="width:60px; height:60px; border-radius:50%; background:#24221f; border:2px dashed #666; display:flex; align-items:center; justify-content:center; font-size:1.6rem;">👤</div>`}
                                <div>
                                    <div style="color:#e6c88c; font-weight:bold; font-size:1.15rem;">${h.name || 'Безымянный'}</div>
                                    <div style="color:#aba498; font-size:0.9rem; margin-bottom:6px;">
                                        ${h.race || 'Раса не выбрана'}${h.subrace ? ' (' + h.subrace + ')' : ''} • ${h.className || 'Класс не выбран'}
                                    </div>
                                    <div style="display:flex; gap:6px; flex-wrap:wrap;">${progressBadges}</div>
                                </div>
                            </div>
                            <div style="display:flex; gap:8px;">
                                <button class="btn-save" style="padding:10px 18px;" onclick="PLAYER_SELECT_EXISTING_HERO('${h.id}')">⚔️ Выбрать героя ➡️</button>
                                <button class="btn-small btn-danger" title="Удалить персонажа" onclick="PLAYER_DELETE_MY_HERO('${h.id}')">🗑️</button>
                            </div>
                        </div>
                    `;
                }).join('');
                contentHTML = `<div>${cards}</div>`;
            }
        }

        // Вкладка 2: Готовые шаблоны D&D 5e
        else if (tab === 'templates') {
            const tplGrid = HERO_TEMPLATES.map((t, idx) => `
                <div style="background:#181715; border:1px solid #423c33; border-radius:10px; padding:16px; display:flex; flex-direction:column; justify-content:space-between; gap:10px;">
                    <div>
                        <div style="color:#e6c88c; font-weight:bold; font-size:1.1rem;">${t.title}</div>
                        <div style="color:#4cd964; font-size:0.86rem; font-weight:bold; margin-bottom:6px;">${t.subtitle}</div>
                        <p style="color:#ccc; font-size:0.88rem; line-height:1.4; margin-bottom:8px;">${t.desc}</p>
                        <div style="font-size:0.8rem; color:#9e988e;">
                            🎒 <b>Снаряжение:</b> ${t.items.map(i => i.name).join(', ')}
                        </div>
                    </div>
                    <button class="btn-save" style="width:100%; padding:10px;" onclick="PLAYER_CREATE_FROM_TEMPLATE(${idx})">
                        ✨ Взять этот шаблон и выбрать комнату ➡️
                    </button>
                </div>
            `).join('');
            contentHTML = `<div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:14px;">${tplGrid}</div>`;
        }

        // Вкладка 3: Создать с нуля (Самостоятельно) или Авто-генерация
        else if (tab === 'create') {
            contentHTML = `
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap:20px;">
                    <div style="background:#181715; border:1px solid #c9a96e; border-radius:12px; padding:20px; display:flex; flex-direction:column; justify-content:space-between;">
                        <div>
                            <h3 style="margin-top:0; color:#e6c88c;">🛠️ Создать самостоятельно (С нуля)</h3>
                            <p style="color:#ccc; font-size:0.92rem; line-height:1.45; margin-bottom:14px;">
                                Создаёт чистый лист персонажа 1-го уровня. Сразу после входа в комнату у вас откроется Лист Персонажа, где вы сами выберете расу, класс, предысторию, характеристики и заклинания.
                            </p>
                            <label style="color:#c9a96e; font-size:0.9rem; font-weight:bold;">Имя вашего нового героя:</label>
                            <input type="text" id="manual-hero-name-inp" placeholder="Введите имя персонажа..." style="width:100%; margin-top:6px; margin-bottom:16px; padding:10px; background:#121110; color:#fff; border:1px solid #524a3d; border-radius:6px; text-align:left;">
                        </div>
                        <button class="btn-save" style="width:100%; padding:12px;" onclick="PLAYER_CREATE_MANUAL_HERO()">
                            🛠️ Создать и перейти к выбору комнаты ➡️
                        </button>
                    </div>

                    <div style="background:#181715; border:1px solid #38bdf8; border-radius:12px; padding:20px; display:flex; flex-direction:column; justify-content:space-between;">
                        <div>
                            <h3 style="margin-top:0; color:#38bdf8;">🎲 Авто-создание (Случайный герой)</h3>
                            <p style="color:#ccc; font-size:0.92rem; line-height:1.45; margin-bottom:14px;">
                                Система мгновенно сгенерирует готового к бою персонажа 1-го уровня: случайно выберет расу, класс, распределит лучшие характеристики под класс и выдаст стартовую экипировку в рюкзак!
                            </p>
                            <label style="color:#38bdf8; font-size:0.9rem; font-weight:bold;">Имя героя (или оставьте пустым для случайного):</label>
                            <input type="text" id="auto-hero-name-inp" placeholder="Напр.: Аларик (или пусто)..." style="width:100%; margin-top:6px; margin-bottom:16px; padding:10px; background:#121110; color:#fff; border:1px solid #524a3d; border-radius:6px; text-align:left;">
                        </div>
                        <button class="btn-cast" style="width:100%; padding:12px; font-size:1rem;" onclick="PLAYER_CREATE_AUTO_HERO()">
                            🎲 Сгенерировать героя автоматически ➡️
                        </button>
                    </div>
                </div>
            `;
        }

        lobby.innerHTML = `
            ${profileBarHTML}
            <div class="panel" style="max-width:1020px; margin:0 auto;">
                <h2>⚔️ Шаг 1 из 2: Выбор или Создание Персонажа</h2>
                <div style="display:flex; gap:8px; margin-bottom:18px; flex-wrap:wrap;">
                    ${tabBtn('my', `👤 Мои персонажи (${userHeroes.length})`)}
                    ${tabBtn('templates', '📜 Готовые шаблоны (6 классов)')}
                    ${tabBtn('create', '🛠️ Создать с нуля / 🎲 Авто-подбор')}
                </div>
                ${contentHTML}
            </div>
        `;
        return;
    }

    // ШАГ 3 (ДЛЯ ИГРОКА): ВЫБОР КОМНАТЫ (С ПРОВЕРКОЙ ПРОГРЕССА В ЭТОЙ КОМНАТЕ!)
    if (window._lobbyStep === 'player_rooms') {
        const hero = cs.find(c => c && c.id === window._selectedBaseHeroId);
        if (!hero) {
            window._lobbyStep = 'player_chars';
            RENDER_LOBBY_HTML();
            return;
        }

        const roomCardsHTML = rooms.map(r => {
            const savedProg = hero.roomProgress && hero.roomProgress[r.code];
            const progBadge = savedProg
                ? `<div style="color:#4cd964; font-size:0.88rem; margin-top:4px;">✅ <b>Есть сохранение в этой комнате:</b> Уровень ${savedProg.level || 1}, ХП ${savedProg.hp ?? 10}/${savedProg.maxHp || 10}, Золото: ${savedProg.money?.gp || 0} зм</div>`
                : `<div style="color:#c9a96e; font-size:0.88rem; margin-top:4px;">🆕 <b>Новая комната для этого героя:</b> Начнёт с честного 1-го уровня (базовый прогресс без чужого лута)</div>`;

            return `
                <div style="background:#181715; border:1px solid #423c33; border-radius:10px; padding:16px; display:flex; justify-content:space-between; align-items:center; gap:14px; margin-bottom:10px; flex-wrap:wrap;">
                    <div>
                        <div style="color:#e6c88c; font-weight:bold; font-size:1.15rem;">🏰 Комната #${r.code} — ${r.name}</div>
                        ${progBadge}
                    </div>
                    <button class="btn-save" style="padding:12px 22px; font-size:1.05rem;" onclick="PLAYER_JOIN_SELECTED_ROOM('${r.code}')">
                        🚪 Войти в комнату #${r.code}
                    </button>
                </div>
            `;
        }).join('');

        lobby.innerHTML = `
            ${profileBarHTML}
            <div class="panel" style="max-width:860px; margin:0 auto; border:2px solid #439c47;">
                <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #3d3830; padding-bottom:10px; margin-bottom:16px; flex-wrap:wrap; gap:10px;">
                    <h2 style="margin:0; border:none; padding:0;">🏰 Шаг 2 из 2: Выберите комнату для входа</h2>
                    <button class="btn-small" onclick="window._lobbyStep='player_chars'; RENDER_LOBBY_HTML();">⬅️ Сменить персонажа</button>
                </div>

                <div style="background:#161513; border:1px solid #c9a96e; border-radius:10px; padding:12px 16px; margin-bottom:18px; display:flex; align-items:center; gap:12px;">
                    <span style="font-size:1.8rem;">🛡️</span>
                    <div>
                        <div style="color:#e6c88c; font-weight:bold;">Выбранный герой: ${hero.name} (${hero.race || 'Раса не выбрана'} • ${hero.className || 'Класс не выбран'})</div>
                        <small style="color:#9e988e;">Система Анти-Чит активна: прогресс, уровни и предметы привязаны индивидуально к каждой комнате.</small>
                    </div>
                </div>

                ${roomCardsHTML}
            </div>
        `;
    }
};

// Перехватываем APPLY_ROLE_VIEW для проверки авторизации и загрузки комнатного прогресса
const _ORIG_APPLY_ROLE_VIEW_AUTH = APPLY_ROLE_VIEW;
APPLY_ROLE_VIEW = function() {
    const user = GET_CURRENT_USER();
    if (!user) {
        RENDER_AUTH_SCREEN();
        return;
    }
    RENDER_AUTH_SCREEN();

    // Если игрок уже находится внутри комнаты — убеждаемся, что у его героя загружен прогресс именно этой комнаты
    const sess = GET_SESSION();
    if (sess && sess.role === 'player' && sess.roomCode) {
        SYNC_MY_PLAYER_INDEX();
        const cs = GC();
        if (cs[PI] && cs[PI]._activeRoomCode !== String(sess.roomCode)) {
            LOAD_HERO_STATE_FOR_ROOM(cs[PI], sess.roomCode);
            SC(cs);
        }
    }

    _ORIG_APPLY_ROLE_VIEW_AUTH();

    const topStatusBar = document.getElementById('role-status-bar');
    if (topStatusBar && topStatusBar.firstElementChild) {
        const badge = document.createElement('span');
        badge.style.cssText = 'color:#9e988e; font-size:0.85rem; background:#121110; padding:3px 8px; border-radius:5px; border:1px solid #38332c;';
        badge.innerHTML = `👤 <b>${user.displayName}</b>`;
        topStatusBar.firstElementChild.prepend(badge);
    }
};

APPLY_ROLE_VIEW();