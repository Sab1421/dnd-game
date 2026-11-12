// ================================================================
// 🔐 СИСТЕМА УЧЁТНЫХ ЗАПИСЕЙ (С ОБЛАЧНОЙ СИНХРОНИЗАЦИЕЙ НА ЛЮБОМ УСТРОЙСТВЕ),
// СВОБОДНОГО СОЗДАНИЯ ПЕРСОНАЖА, ОБМЕНА ШАБЛОНАМИ И АНТИ-ЧИТА ПО КОМНАТАМ (auth.js)
// ================================================================
window._authMode = 'login';           // 'login' | 'register'
window._lobbyStep = 'role';           // 'role' | 'gm_rooms' | 'player_chars' | 'player_rooms'
window._charCreateTab = 'my';         // 'my' | 'user_templates' | 'templates' | 'create'
window._selectedBaseHeroId = null;    // ID выбранного персонажа перед входом в комнату
window._openSheetAfterJoin = false;   // Открыть ли сразу Лист персонажа после входа в комнату
window._editingHeroInLobby = false;   // Флаг настройки Листа персонажа прямо в Лобби

const AUTH_FIREBASE_URL = "https://dnds-23b7d-default-rtdb.firebaseio.com/campaign_v2";

// --- 1. ХЭШИРОВАНИЕ И ОБЛАЧНОЕ ХРАНЕНИЕ АККАУНТОВ ---
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
    const str = JSON.stringify(accObj);
    localStorage.setItem('dnd_users_accounts', str);
    // Дублируем напрямую в Firebase, чтобы телефон/другой ПК мгновенно видел аккаунт!
    fetch(`${AUTH_FIREBASE_URL}/users_accounts.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: str
    }).catch(() => {});
}

// Подгружаем аккаунты с сервера при открытии страницы
// Поддержка старого хэша пароля (для самых первых созданных аккаунтов)
function LEGACY_SIMPLE_HASH(str) {
    let h = 0;
    const s = String(str || '').trim();
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h) + s.charCodeAt(i);
        h |= 0;
    }
    return 'h_' + Math.abs(h).toString(36);
}

// Автоматическая синхронизация всех старых и новых аккаунтов с этого ПК в Firebase при загрузке
(async function SYNC_ALL_LOCAL_AND_CLOUD_ACCOUNTS() {
    try {
        let merged = Object.assign({}, GET_ACCOUNTS());

        // 1. Подхватываем старые аккаунты из dnd_accounts_db (если создавались в первой версии)
        const oldDbRaw = localStorage.getItem('dnd_accounts_db');
        if (oldDbRaw) {
            try {
                const oldDb = JSON.parse(oldDbRaw);
                Object.values(oldDb).forEach(acc => {
                    if (acc && acc.login) {
                        const k = acc.login.toLowerCase().trim();
                        if (!merged[k]) merged[k] = acc;
                    }
                });
            } catch (e) {}
        }

        // 2. Если на этом ПК уже выполнен вход в аккаунт — гарантируем, что он есть в общей базе!
        const activeUser = GET_CURRENT_USER();
        if (activeUser && activeUser.login) {
            const k = activeUser.login.toLowerCase().trim();
            if (!merged[k]) {
                merged[k] = {
                    login: activeUser.login,
                    displayName: activeUser.displayName || activeUser.login,
                    passHash: activeUser.passHash || '',
                    createdAt: 'Восстановлен'
                };
            }
        }

        // 3. Скачиваем аккаунты из Firebase, объединяем с локальными и отправляем полный список обратно в облако!
        const res = await fetch(`${AUTH_FIREBASE_URL}/users_accounts.json`);
        if (res.ok) {
            const remote = await res.json();
            if (remote && typeof remote === 'object') {
                merged = Object.assign({}, remote, merged);
            }
        }

        if (Object.keys(merged).length > 0) {
            SAVE_ACCOUNTS(merged);
        }
    } catch (e) {}
})();

async function SUBMIT_AUTH_FORM() {
    const loginInp = document.getElementById('auth-login-inp');
    const passInp = document.getElementById('auth-pass-inp');
    const nameInp = document.getElementById('auth-name-inp');
    const errBox = document.getElementById('auth-error-box');
    const submitBtn = document.getElementById('auth-submit-btn');

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

    if (loginKey.length < 2) { showErr('Логин должен содержать минимум 2 символа.'); return; }
    if (pass.length < 2) { showErr('Введите пароль.'); return; }

    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = '⏳ Связь с облаком...';
    }

    let accounts = GET_ACCOUNTS();
    try {
        const [accRes, oldAccRes, charRes] = await Promise.all([
            fetch(`${AUTH_FIREBASE_URL}/users_accounts.json`),
            fetch(`${AUTH_FIREBASE_URL}/accounts.json`),
            fetch(`${AUTH_FIREBASE_URL}/state/dnd_characters.json`)
        ]);
        if (accRes.ok) {
            const rem1 = await accRes.json();
            if (rem1 && typeof rem1 === 'object') accounts = Object.assign({}, accounts, rem1);
        }
        if (oldAccRes.ok) {
            const remOld = await oldAccRes.json();
            if (remOld && typeof remOld === 'object') {
                Object.values(remOld).forEach(a => {
                    if (a && a.login) accounts[a.login.toLowerCase().trim()] = a;
                });
            }
        }
        if (charRes.ok) {
            const remChars = await charRes.json();
            if (remChars && remChars.v) localStorage.setItem('dnd_characters', remChars.v);
        }
    } catch (e) {}

    const newHash = HASH_PASSWORD(loginKey + ':' + pass);
    const oldHash = LEGACY_SIMPLE_HASH(pass);

    if (window._authMode === 'register') {
        if (accounts[loginKey]) {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '✅ Создать аккаунт и войти'; }
            showErr('Этот логин уже занят! Переключитесь на вкладку «🔑 Вход» сверху.');
            return;
        }
        accounts[loginKey] = {
            login: rawLogin,
            displayName: displayName,
            passHash: newHash,
            createdAt: new Date().toLocaleDateString()
        };
        SAVE_ACCOUNTS(accounts);
        SAVE_CURRENT_USER({ login: loginKey, displayName: displayName, passHash: newHash });
        SAVE_GM_NAME(displayName);
        window._lobbyStep = 'role';
        APPLY_ROLE_VIEW();
    } else {
        const acc = accounts[loginKey] || accounts['user_' + loginKey];
        if (!acc) {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '🚪 Войти в аккаунт'; }
            showErr('Аккаунт ещё не выгружен в облако с вашего первого устройства. Откройте сайт на ПК, где создавали аккаунт (он автоматически выгрузится), или нажмите «✨ Регистрация» с тем же логином!');
            return;
        }
        // Проверяем и новый хэш, и старый хэш первой версии (или пустой хэш после авто-восстановления)
        if (acc.passHash && acc.passHash !== newHash && acc.passHash !== oldHash) {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = '🚪 Войти в аккаунт'; }
            showErr('Неверный пароль!');
            return;
        }
        acc.passHash = newHash;
        accounts[loginKey] = acc;
        SAVE_ACCOUNTS(accounts);
        SAVE_CURRENT_USER({ login: loginKey, displayName: acc.displayName || acc.login, passHash: newHash });
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
                Единый облачный аккаунт: входите со своего ПК или телефона под одним логином и паролем!
            </p>

            <div style="display:flex; gap:8px; margin-bottom:18px;">
                <button class="btn-small" style="flex:1; padding:10px; background:${!isReg ? '#c9a96e' : '#181715'}; color:${!isReg ? '#181510' : '#ccc'}; border-color:${!isReg ? '#e0c58e' : '#3d3830'};" onclick="SET_AUTH_MODE('login')">
                    🔑 Вход
                </button>
                <button class="btn-small" style="flex:1; padding:10px; background:${isReg ? '#c9a96e' : '#181715'}; color:${isReg ? '#181510' : '#ccc'}; border-color:${!isReg ? '#e0c58e' : '#3d3830'};" onclick="SET_AUTH_MODE('register')">
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
                    <input type="text" id="auth-name-inp" placeholder="Как вас подписывать в игре..."
                           onkeypress="if(event.key==='Enter') SUBMIT_AUTH_FORM();"
                           style="width:100%; margin-top:4px; padding:11px 14px; background:#141312; color:#fff; border:1px solid #524a3d; border-radius:8px; font-size:1rem; text-align:left;">
                </div>` : ''}

                <div>
                    <label style="color:#e6c88c; font-size:0.9rem; font-weight:bold;">Пароль (мин. 3 символа):</label>
                    <input type="password" id="auth-pass-inp" placeholder="••••••••"
                           onkeypress="if(event.key==='Enter') SUBMIT_AUTH_FORM();"
                           style="width:100%; margin-top:4px; padding:11px 14px; background:#141312; color:#fff; border:1px solid #524a3d; border-radius:8px; font-size:1rem; text-align:left;">
                </div>

                <button id="auth-submit-btn" class="btn-save" style="width:100%; padding:14px; font-size:1.08rem; margin-top:6px;" onclick="SUBMIT_AUTH_FORM()">
                    ${isReg ? '✅ Создать аккаунт и войти' : '🚪 Войти в аккаунт'}
                </button>
            </div>
        </div>
    `;
}

// ================================================================
// 🛡️ 2. СИСТЕМА ИЗОЛЯЦИИ ПРОГРЕССА ПО КОМНАТАМ (АНТИ-ЧИТ)
// ================================================================
const ROOM_PROGRESS_FIELDS = [
    'level', 'xp', 'hp', 'maxHp', 'tempHP', 'spentHitDice', 'shortRestsUsed',
    'arcaneRecoveryUsed', 'inventory', 'money', 'usedSpellSlots', 'usedSpells',
    'knownSpells', 'pendingChoices', '_completedChoices', 'chosenFeats',
    'expertiseSkills', 'weaponProficiencies', 'initiativeBonus', 'toughPerLevel',
    'featSpeedBonus', '_hpRolls', '_hpInitialized', 'inCombat', 'inspiration',
    'baseStr', 'baseDex', 'baseCon', 'baseInt', 'baseWis', 'baseCha',
    'race', 'subrace', 'className', 'subclass', 'background', 'chosenSkills',
    'chosenLanguages', 'raceLocked', 'classLocked', 'subclassLocked', 'bgLocked',
    'statsLocked', 'skillsLocked', 'languagesLocked', 'traits', 'ideals', 'bonds', 'flaws', 'story',
    'traitsLocked', 'idealsLocked', 'bondsLocked', 'flawsLocked', 'storyLocked', 'alignment', 'alignmentLocked'
];

function EXTRACT_PROGRESS_SNAPSHOT(c) {
    const snap = {};
    ROOM_PROGRESS_FIELDS.forEach(k => {
        if (c[k] !== undefined) {
            snap[k] = JSON.parse(JSON.stringify(c[k]));
        }
    });
    return snap;
}

function APPLY_PROGRESS_SNAPSHOT(c, snap) {
    if (!snap) return;
    ROOM_PROGRESS_FIELDS.forEach(k => {
        if (snap[k] !== undefined) {
            c[k] = JSON.parse(JSON.stringify(snap[k]));
        }
    });
    AB(c);
}

const _ORIG_SC_ROOM_ISOLATION = SC;
SC = function(cs) {
    const sess = GET_SESSION();
    if (Array.isArray(cs)) {
        cs.forEach(c => {
            if (!c) return;
            // Если игрок сейчас редактирует своего героя в Лобби (до входа в комнату) — обновляем его базовый слепок 1-го уровня!
            if (!sess && window._editingHeroInLobby && c.id === window._selectedBaseHeroId) {
                c._baseSnapshot = CREATE_CLEAN_LEVEL1_SNAPSHOT(c);
            }
            if (!c._baseSnapshot) {
                c._baseSnapshot = CREATE_CLEAN_LEVEL1_SNAPSHOT(c);
            }
            if (!c.roomProgress) c.roomProgress = {};
            if (sess && sess.roomCode && c._activeRoomCode === String(sess.roomCode)) {
                c.roomProgress[String(sess.roomCode)] = EXTRACT_PROGRESS_SNAPSHOT(c);
            }
        });
    }
    _ORIG_SC_ROOM_ISOLATION(cs);
};

function CREATE_CLEAN_LEVEL1_SNAPSHOT(c) {
    const temp = CREATE_DEFAULT_CHAR();
    temp.name = c.name || 'Герой';
    temp.race = c.race || '';
    temp.subrace = c.subrace || '';
    temp.className = c.className || '';
    temp.subclass = '';
    temp.background = c.background || '';
    temp.alignment = c.alignment || '';
    temp.traits = c.traits || '';
    temp.ideals = c.ideals || '';
    temp.bonds = c.bonds || '';
    temp.flaws = c.flaws || '';
    temp.story = c.story || '';

    temp.baseStr = Math.min(15, c._initStats ? c._initStats[0] : (c.baseStr || 10));
    temp.baseDex = Math.min(15, c._initStats ? c._initStats[1] : (c.baseDex || 10));
    temp.baseCon = Math.min(15, c._initStats ? c._initStats[2] : (c.baseCon || 10));
    temp.baseInt = Math.min(15, c._initStats ? c._initStats[3] : (c.baseInt || 10));
    temp.baseWis = Math.min(15, c._initStats ? c._initStats[4] : (c.baseWis || 10));
    temp.baseCha = Math.min(15, c._initStats ? c._initStats[5] : (c.baseCha || 10));

    temp.chosenSkills = c._initSkills ? [...c._initSkills] : [...(c.chosenSkills || []).slice(0, 4)];
    temp.chosenLanguages = c.chosenLanguages ? JSON.parse(JSON.stringify(c.chosenLanguages)) : {};
    temp.knownSpells = c._initSpells ? [...c._initSpells] : [...(c.knownSpells || []).filter(s => {
        const sp = gameData.spells.find(x => x.name === s);
        return sp && sp.level <= 1;
    })];
    temp.inventory = c._initInventory ? JSON.parse(JSON.stringify(c._initInventory)) : (c.inventory || []).filter(it => !(it.desc || '').includes('Награда'));
    temp.money = { gp: 15, sp: 0, cp: 0 };

    temp.raceLocked = !!c.raceLocked;
    temp.classLocked = !!c.classLocked;
    temp.bgLocked = !!c.bgLocked;
    temp.statsLocked = !!c.statsLocked;
    temp.skillsLocked = !!c.skillsLocked;
    temp.languagesLocked = !!c.languagesLocked;
    temp.alignmentLocked = !!c.alignmentLocked;
    temp.traitsLocked = !!c.traitsLocked;
    temp.idealsLocked = !!c.idealsLocked;
    temp.bondsLocked = !!c.bondsLocked;
    temp.flawsLocked = !!c.flawsLocked;
    temp.storyLocked = !!c.storyLocked;

    temp.level = 1;
    temp.xp = 0;
    AB(temp);
    temp.hp = temp.maxHp || 10;
    return EXTRACT_PROGRESS_SNAPSHOT(temp);
}

function LOAD_HERO_STATE_FOR_ROOM(c, roomCode) {
    if (!c) return;
    const rCode = String(roomCode);
    if (!c._baseSnapshot) {
        c._baseSnapshot = CREATE_CLEAN_LEVEL1_SNAPSHOT(c);
    }
    if (!c.roomProgress) c.roomProgress = {};

    if (c._activeRoomCode && c._activeRoomCode !== rCode) {
        c.roomProgress[c._activeRoomCode] = EXTRACT_PROGRESS_SNAPSHOT(c);
    }

    if (c.roomProgress[rCode]) {
        APPLY_PROGRESS_SNAPSHOT(c, c.roomProgress[rCode]);
    } else {
        APPLY_PROGRESS_SNAPSHOT(c, c._baseSnapshot);
        c.roomProgress[rCode] = EXTRACT_PROGRESS_SNAPSHOT(c);
    }
    c._activeRoomCode = rCode;
}

// ================================================================
// 📤 3. ПУБЛИКАЦИЯ И КОПИРОВАНИЕ ПОЛЬЗОВАТЕЛЬСКИХ ШАБЛОНОВ (С СОКРЫТИЕМ АВТОРСТВА)
// ================================================================
function IS_MY_HERO(c, user) {
    if (!c || !user) return false;
    const uLogin = (user.login || '').toLowerCase();
    return (c.owner && c.owner.toLowerCase() === uLogin) ||
           (c.ownerId && c.ownerId.toLowerCase() === uLogin) ||
           (c.ownerId && c.ownerId.toLowerCase() === 'user_' + uLogin);
}

// Открыть окно «Поделиться шаблоном» (из Лобби или из игры)
window.OPEN_SHARE_CHAR_MODAL = function(charIdxOrId) {
    const cs = GC();
    let c = null;
    let idx = -1;
    if (typeof charIdxOrId === 'string') {
        idx = cs.findIndex(x => x && x.id === charIdxOrId);
        c = cs[idx];
    } else {
        idx = (charIdxOrId !== undefined && !isNaN(charIdxOrId)) ? charIdxOrId : PI;
        c = cs[idx];
    }
    if (!c) return;

    const user = GET_CURRENT_USER();
    const cont = document.getElementById('gm-tool-modal-content');
    cont.style.maxWidth = '580px';
    cont.innerHTML = `
        <h2>📤 Поделиться шаблоном персонажа «${c.name || 'Герой'}»</h2>
        <div style="background:#181715; border:1px solid #423c33; padding:16px; border-radius:10px; text-align:left; font-size:0.92rem; color:#ccc; line-height:1.5; margin-bottom:14px;">
            <b style="color:#e6c88c;">Как работает публикация шаблона:</b><br>
            • Другие игроки увидят ваш билд во вкладке <b>«🌟 Шаблоны от игроков»</b> и смогут создать себе <b>такого же персонажа 1-го уровня</b>.<br>
            • <b>Ваш личный персонаж остаётся только у вас</b> — никто не сможет управлять им.<br>
            • Весь ваш прогресс в комнатах (опыт, уровень, золото, квестовый лут) <b>не передаётся</b>!
        </div>

        <div style="background:#22201d; border:1px solid #3d3830; padding:14px; border-radius:8px; text-align:left; margin-bottom:16px;">
            <div style="margin-bottom:10px; color:#ccc;">
                Ваше имя автора: <b style="color:#e6c88c;">${user ? user.displayName : 'Игрок'}</b>
            </div>
            <label style="display:flex; align-items:center; gap:8px; cursor:pointer; color:#e6c88c;">
                <input type="checkbox" id="share-tpl-hide-author" style="width:18px; height:18px; accent-color:#c9a96e;">
                <span>🕵️ <b>Скрыть моё авторство</b> (будет подписано как «Анонимный автор»)</span>
            </label>
        </div>

        <div style="display:flex; justify-content:flex-end; gap:10px;">
            <button class="btn-save" onclick="CONFIRM_SHARE_CHAR_TEMPLATE(${idx})">📤 Опубликовать в шаблоны</button>
            <button onclick="CM('gm-tool-modal')">Отмена</button>
        </div>
    `;
    OM('gm-tool-modal');
};

window.CONFIRM_SHARE_CHAR_TEMPLATE = function(charIdx) {
    const cs = GC();
    const c = cs[charIdx];
    if (!c) return;
    const user = GET_CURRENT_USER();
    const hideAuthor = !!document.getElementById('share-tpl-hide-author')?.checked;

    const cleanSnap = CREATE_CLEAN_LEVEL1_SNAPSHOT(c);
    cleanSnap.name = c.name || 'Герой';
    cleanSnap.avatar = c.avatar || '';

    const tplObj = {
        templateId: 'tpl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        authorLogin: user ? user.login : '',
        authorName: hideAuthor ? 'Анонимный автор' : (user ? user.displayName : 'Игрок'),
        hideAuthor: !!hideAuthor,
        createdAt: new Date().toLocaleDateString(),
        charSnapshot: cleanSnap
    };

    const list = GET_SHARED_TEMPLATES();
    list.push(tplObj);
    SAVE_SHARED_TEMPLATES(list);

    CM('gm-tool-modal');
    if (!GET_SESSION()) {
        window._charCreateTab = 'user_templates';
        RENDER_LOBBY_HTML();
    }
    showMessage('✅ Шаблон опубликован!', `Шаблон героя «<b>${c.name}</b>» добавлен во вкладку «🌟 Шаблоны от игроков»!<br><small style="color:#aaa;">Автор: <b>${tplObj.authorName}</b> (прогресс в комнатах сброшен до 1 уровня).</small>`);
};

window.PLAYER_USE_SHARED_USER_TEMPLATE = function(tplId, openSheetInLobbyNow) {
    const list = GET_SHARED_TEMPLATES();
    const tpl = list.find(t => t.templateId === tplId);
    if (!tpl || !tpl.charSnapshot) return;

    const user = GET_CURRENT_USER();
    const customName = prompt(`Создание героя по шаблону «${tpl.charSnapshot.name}» (Автор: ${tpl.authorName}).\nВведите имя для вашего персонажа:`, tpl.charSnapshot.name);
    if (customName === null) return;

    const newHero = CREATE_DEFAULT_CHAR();
    APPLY_PROGRESS_SNAPSHOT(newHero, tpl.charSnapshot);
    newHero.id = 'hero_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    newHero.owner = user ? user.login : '';
    newHero.ownerId = user ? user.login : '';
    newHero.ownerName = user ? user.displayName : '';
    newHero.name = customName.trim() || tpl.charSnapshot.name;
    newHero.avatar = tpl.charSnapshot.avatar || '';
    newHero.level = 1;
    newHero.xp = 0;
    newHero.roomProgress = {};
    AB(newHero);
    newHero.hp = newHero.maxHp || 10;
    newHero._baseSnapshot = EXTRACT_PROGRESS_SNAPSHOT(newHero);

    const cs = GC();
    cs.push(newHero);
    PI = cs.length - 1;
    SC(cs);

    window._selectedBaseHeroId = newHero.id;
    if (openSheetInLobbyNow) {
        window._editingHeroInLobby = true;
        window._charCreateTab = 'my';
        RENDER_LOBBY_HTML();
        OCS();
    } else {
        window._openSheetAfterJoin = false;
        window._lobbyStep = 'player_rooms';
        RENDER_LOBBY_HTML();
    }
};

window.DELETE_USER_SHARED_TEMPLATE = function(tplId) {
    if (!confirm('Удалить этот шаблон из общей витрины?')) return;
    const list = GET_SHARED_TEMPLATES().filter(t => t.templateId !== tplId);
    SAVE_SHARED_TEMPLATES(list);
    RENDER_LOBBY_HTML();
};

// ================================================================
// 📜 4. БАЗОВЫЕ КЛАССОВЫЕ ШАБЛОНЫ И СОЗДАНИЕ ПЕРСОНАЖА (ДО ИЛИ ПОСЛЕ ВЫБОРА КОМНАТЫ!)
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
    c.ownerId = user ? user.login : '';
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

// ВАРИАНТ А: Создать персонажа и ЗАПОЛНИТЬ ЛИСТ СЕЙЧАС ПРЯМО В ЛОББИ (до выбора комнаты!)
function PLAYER_CREATE_AND_FILL_NOW_IN_LOBBY() {
    const nameInp = document.getElementById('manual-hero-name-inp');
    const name = (nameInp?.value || '').trim() || 'Новый герой';
    const user = GET_CURRENT_USER();

    const c = CREATE_DEFAULT_CHAR();
    c.id = 'hero_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    c.owner = user ? user.login : '';
    c.ownerId = user ? user.login : '';
    c.ownerName = user ? user.displayName : '';
    c.name = name;
    c.money = { gp: 15, sp: 0, cp: 0 };
    AB(c);
    c._baseSnapshot = EXTRACT_PROGRESS_SNAPSHOT(c);
    c.roomProgress = {};

    const cs = GC();
    cs.push(c);
    PI = cs.length - 1;
    SC(cs);

    window._selectedBaseHeroId = c.id;
    window._editingHeroInLobby = true;
    window._charCreateTab = 'my';
    RENDER_LOBBY_HTML();
    OCS(); // Сразу открываем Лист Персонажа поверх Лобби!
}

// Открыть и настроить Лист существующего героя прямо в Лобби (до входа в комнату)
function PLAYER_EDIT_HERO_SHEET_IN_LOBBY(heroId) {
    const cs = GC();
    const idx = cs.findIndex(c => c && c.id === heroId);
    if (idx === -1) return;
    PI = idx;
    window._selectedBaseHeroId = heroId;
    window._editingHeroInLobby = true;
    OCS();
}

// Когда закрываем Лист Персонажа в Лобби — сохраняем обновлённый слепок и возвращаем игрока к выбору комнаты или списку!
const _ORIG_CCS_AUTH = CCS;
CCS = function() {
    if (window._editingHeroInLobby && !GET_SESSION()) {
        const cs = GC();
        if (cs[PI]) {
            cs[PI]._baseSnapshot = CREATE_CLEAN_LEVEL1_SNAPSHOT(cs[PI]);
            SC(cs);
        }
        window._editingHeroInLobby = false;
        _ORIG_CCS_AUTH();
        RENDER_LOBBY_HTML();
        return;
    }
    _ORIG_CCS_AUTH();
};

// ВАРИАНТ Б: Сначала выбрать комнату, зайти и осмотреться, а Лист заполнить уже внутри комнаты!
function PLAYER_CREATE_MANUAL_HERO() {
    const nameInp = document.getElementById('manual-hero-name-inp');
    const name = (nameInp?.value || '').trim() || 'Новый герой';
    const user = GET_CURRENT_USER();

    const c = CREATE_DEFAULT_CHAR();
    c.id = 'hero_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    c.owner = user ? user.login : '';
    c.ownerId = user ? user.login : '';
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
    window._openSheetAfterJoin = false; // Игрок сначала осмотрится в комнате и сам откроет Лист когда захочет
    window._lobbyStep = 'player_rooms';
    RENDER_LOBBY_HTML();
}

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

function PLAYER_SELECT_EXISTING_HERO(heroId) {
    window._selectedBaseHeroId = heroId;
    window._openSheetAfterJoin = false;
    window._lobbyStep = 'player_rooms';
    RENDER_LOBBY_HTML();
}

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
    LOAD_HERO_STATE_FOR_ROOM(hero, rCode);
    PI = idx;
    SC(cs);

    // Если на карте уже стоят фишки — добавляем фишку этого героя
    const st = GET_MAP_STATE();
    if (st.tokens && st.tokens.length > 0 && !st.tokens.some(t => t.isPlayer && t.charIdx === idx)) {
        st.tokens.push({
            id: Date.now(),
            isPlayer: true,
            charIdx: idx,
            name: hero.name || 'Герой',
            icon: '🛡️',
            avatar: '',
            x: 25 + (idx * 12) % 55,
            y: 72,
            hp: hero.hp ?? 10,
            maxHp: hero.maxHp || 10,
            ac: CAC(hero),
            init: 10
        });
        SAVE_MAP_STATE(st);
    }

    SAVE_SESSION({ role: 'player', roomCode: rCode, playerIdx: idx, heroId: hero.id });
    APPLY_ROLE_VIEW();

    if (window._openSheetAfterJoin) {
        window._openSheetAfterJoin = false;
        setTimeout(() => { OCS(); }, 150);
    }
}

// Привязка старого персонажа (созданного до входа в аккаунт) к текущему аккаунту
window.CLAIM_OLD_HERO_TO_MY_ACC = function(heroId) {
    const user = GET_CURRENT_USER();
    if (!user) return;
    const cs = GC();
    const h = cs.find(c => c && c.id === heroId);
    if (!h) return;
    h.owner = user.login;
    h.ownerId = user.login;
    h.ownerName = user.displayName;
    SC(cs);
    RENDER_LOBBY_HTML();
};

// ================================================================
// 🏛️ 5. НОВОЕ ПОШАГОВОЕ ЛОББИ (С ШАБЛОНАМИ ИГРОКОВ И ВЫБОРОМ ПОРЯДКА СОЗДАНИЯ)
// ================================================================
RENDER_LOBBY_HTML = function() {
    const lobby = document.getElementById('lobby-screen');
    if (!lobby) return;
    const user = GET_CURRENT_USER();
    if (!user) return;

    const rooms = GET_ROOMS();
    const cs = GC();
    const sharedTemplates = GET_SHARED_TEMPLATES();

    const userHeroes = cs.filter(c => IS_MY_HERO(c, user));
    const unclaimedHeroes = cs.filter(c => c && !IS_MY_HERO(c, user) && (!c.owner || c.owner.startsWith('guest_') || c.owner.startsWith('acc_')));

    const profileBarHTML = `
        <div style="max-width:1040px; margin:16px auto 24px auto; background:#181715; border:1px solid #c9a96e; padding:12px 20px; border-radius:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <div style="display:flex; align-items:center; gap:10px;">
                <span style="background:#c9a96e; color:#181510; font-weight:bold; padding:4px 10px; border-radius:6px; font-size:0.9rem;">👤 Облачный аккаунт</span>
                <b style="color:#e6c88c; font-size:1.08rem;">${user.displayName}</b>
                <small style="color:#86efac;">(Логин: <b>${user.login}</b> — доступен с любого устройства)</small>
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
            <div style="max-width:980px; margin:20px auto; text-align:center;">
                <h1 style="font-size:2.2rem; margin-bottom:8px;">🐉 Выберите вашу роль</h1>
                <p style="color:#aba498; font-size:1.05rem; margin-bottom:28px;">Личные персонажи привязаны к вашему аккаунту <b>${user.login}</b>. Вы также можете делиться шаблонами билдов!</p>

                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(380px, 1fr)); gap:24px; text-align:left;">
                    <div class="panel" style="border:2px solid #439c47; padding:28px; display:flex; flex-direction:column; justify-content:space-between; cursor:pointer;" onclick="window._lobbyStep='player_chars'; RENDER_LOBBY_HTML();">
                        <div>
                            <div style="font-size:2.8rem; margin-bottom:10px;">⚔️</div>
                            <h2 style="font-size:1.5rem; color:#52b758; border-bottom-color:#334d33;">Войти как Игрок</h2>
                            <p style="color:#ccc; font-size:0.98rem; line-height:1.5; margin-bottom:20px;">
                                Создайте и заполните героя заранее прямо в Лобби, либо сначала зайдите в комнату осмотреться и заполните Лист внутри, либо возьмите шаблон другого игрока!
                            </p>
                            <div style="background:#161513; padding:10px 14px; border-radius:8px; border:1px solid #38332c; color:#e6c88c; font-size:0.9rem; margin-bottom:18px;">
                                👤 Ваших личных персонажей: <b>${userHeroes.length}</b><br>
                                🌟 Общественных шаблонов от игроков: <b>${sharedTemplates.length}</b>
                            </div>
                        </div>
                        <button class="btn-save" style="width:100%; padding:14px; font-size:1.1rem;">⚔️ Перейти к персонажам и шаблонам ➡️</button>
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

    // ШАГ 2 (ДЛЯ ИГРОКА): МОИ ГЕРОИ / ШАБЛОНЫ ИГРОКОВ / БАЗОВЫЕ ШАБЛОНЫ / СОЗДАТЬ С НУЛЯ (ДО ИЛИ ПОСЛЕ ВХОДА!)
    if (window._lobbyStep === 'player_chars') {
        const tab = window._charCreateTab || (userHeroes.length > 0 ? 'my' : 'create');
        const tabBtn = (code, label) => `
            <button class="btn-small" onclick="window._charCreateTab='${code}'; RENDER_LOBBY_HTML();"
                style="flex:1; padding:11px; font-size:0.94rem; background:${tab===code ? '#c9a96e' : '#181715'}; color:${tab===code ? '#181510' : '#ccc'}; border:1px solid ${tab===code ? '#e0c58e' : '#423c33'};">
                ${label}
            </button>`;

        let contentHTML = '';

        // Вкладка 1: Мои личные персонажи (с кнопками «📋 Настроить Лист в Лобби» и «📤 Поделиться шаблоном»)
        if (tab === 'my') {
            let claimSection = '';
            if (unclaimedHeroes.length > 0) {
                claimSection = `
                    <div style="background:#201d18; border:1px dashed #c9a96e; padding:10px 14px; border-radius:8px; margin-bottom:14px; font-size:0.86rem;">
                        <div style="color:#e6c88c; margin-bottom:6px;">🔗 Найдены персонажи, созданные до входа в аккаунт. Нажмите на своего, чтобы привязать к аккаунту <b>${user.login}</b>:</div>
                        <div style="display:flex; gap:6px; flex-wrap:wrap;">
                            ${unclaimedHeroes.map(uh => `<button class="btn-small" onclick="CLAIM_OLD_HERO_TO_MY_ACC('${uh.id}')">🔗 Забрать «${uh.name || 'Герой'}»</button>`).join('')}
                        </div>
                    </div>
                `;
            }

            if (userHeroes.length === 0) {
                contentHTML = `
                    ${claimSection}
                    <div style="padding:30px; text-align:center; background:#181715; border:1px dashed #423c33; border-radius:10px;">
                        <div style="font-size:2.4rem; margin-bottom:8px;">🛡️</div>
                        <div style="color:#e6c88c; font-weight:bold; font-size:1.1rem; margin-bottom:6px;">На вашем аккаунте пока нет созданных персонажей</div>
                        <p style="color:#9e988e; margin-bottom:16px;">Создайте своего героя (заполнив лист прямо сейчас или уже внутри комнаты) или возьмите шаблон!</p>
                        <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
                            <button class="btn-save" onclick="window._charCreateTab='create'; RENDER_LOBBY_HTML();">🛠️ Создать персонажа</button>
                            <button onclick="window._charCreateTab='user_templates'; RENDER_LOBBY_HTML();">🌟 Шаблоны от игроков (${sharedTemplates.length})</button>
                            <button onclick="window._charCreateTab='templates'; RENDER_LOBBY_HTML();">📜 Готовые классы D&D</button>
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
                        : `<span style="color:#888; font-size:0.8rem;">Стартовый 1 уровень</span>`;

                    return `
                        <div style="background:#181715; border:1px solid #423c33; border-radius:12px; padding:16px; display:flex; justify-content:space-between; align-items:center; gap:14px; margin-bottom:10px; flex-wrap:wrap;">
                            <div style="display:flex; align-items:center; gap:14px; flex:1; min-width:240px;">
                                ${h.avatar ? `<img src="${h.avatar}" style="width:60px; height:60px; border-radius:50%; object-fit:cover; border:2px solid #c9a96e;">` : `<div style="width:60px; height:60px; border-radius:50%; background:#24221f; border:2px dashed #666; display:flex; align-items:center; justify-content:center; font-size:1.6rem;">👤</div>`}
                                <div>
                                    <div style="color:#e6c88c; font-weight:bold; font-size:1.15rem;">${h.name || 'Безымянный'} <small style="color:#52b758; font-size:0.75rem;">🔒 Ваш герой</small></div>
                                    <div style="color:#aba498; font-size:0.9rem; margin-bottom:6px;">
                                        ${h.race || 'Раса не выбрана'}${h.subrace ? ' (' + h.subrace + ')' : ''} • ${h.className || 'Класс не выбран'}
                                    </div>
                                    <div style="display:flex; gap:6px; flex-wrap:wrap;">${progressBadges}</div>
                                </div>
                            </div>
                            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
                                <button class="btn-small" title="Открыть и заполнить Лист персонажа прямо сейчас в Лобби" onclick="PLAYER_EDIT_HERO_SHEET_IN_LOBBY('${h.id}')">📋 Настроить Лист</button>
                                <button class="btn-small" style="background:#2b251c; border-color:#c9a96e; color:#e6c88c;" title="Выложить билд этого героя как шаблон 1-го уровня для других игроков" onclick="OPEN_SHARE_CHAR_MODAL('${h.id}')">📤 Поделиться шаблоном</button>
                                <button class="btn-save" style="padding:10px 18px;" onclick="PLAYER_SELECT_EXISTING_HERO('${h.id}')">⚔️ Выбрать комнату ➡️</button>
                                <button class="btn-small btn-danger" title="Удалить персонажа" onclick="PLAYER_DELETE_MY_HERO('${h.id}')">🗑️</button>
                            </div>
                        </div>
                    `;
                }).join('');
                contentHTML = `${claimSection}<div>${cards}</div>`;
            }
        }

        // Вкладка 2: Шаблоны от других игроков (с автором или анонимно, без чужого прогресса!)
        else if (tab === 'user_templates') {
            if (sharedTemplates.length === 0) {
                contentHTML = `
                    <div style="padding:30px; text-align:center; background:#181715; border:1px dashed #423c33; border-radius:10px;">
                        <div style="font-size:2.4rem; margin-bottom:8px;">🌟</div>
                        <div style="color:#e6c88c; font-weight:bold; font-size:1.1rem; margin-bottom:6px;">Пока никто из игроков не выложил свой шаблон</div>
                        <p style="color:#9e988e;">Во вкладке «👤 Мои персонажи» нажмите кнопку <b>«📤 Поделиться шаблоном»</b> рядом со своим героем, чтобы поделиться его настройками!</p>
                    </div>`;
            } else {
                const uCards = sharedTemplates.map(tpl => {
                    const snap = tpl.charSnapshot || {};
                    const isMine = (tpl.authorLogin && tpl.authorLogin.toLowerCase() === user.login.toLowerCase());
                    const authorLabel = tpl.hideAuthor
                        ? `<span style="color:#888;">🕵️ Анонимный автор</span>`
                        : `<span style="color:#c9a96e;">✍️ Автор билда: <b>${tpl.authorName || 'Игрок'}</b></span>`;

                    return `
                        <div style="background:#181715; border:1px solid #c9a96e; border-radius:10px; padding:16px; display:flex; justify-content:space-between; align-items:center; gap:14px; margin-bottom:10px; flex-wrap:wrap;">
                            <div style="text-align:left; flex:1; min-width:240px;">
                                <div style="color:#e6c88c; font-weight:bold; font-size:1.12rem;">📋 ${snap.name || 'Шаблон героя'} <span style="color:#86efac; font-size:0.85rem;">(${snap.race || 'Раса'} • ${snap.className || 'Класс'}, 1 ур.)</span></div>
                                <div style="font-size:0.86rem; color:#ccc; margin:4px 0;">
                                    Сила ${snap.baseStr||10}, Лов ${snap.baseDex||10}, Тел ${snap.baseCon||10}, Инт ${snap.baseInt||10}, Мдр ${snap.baseWis||10}, Хар ${snap.baseCha||10}
                                    ${snap.chosenSkills && snap.chosenSkills.length ? ` | Навыки: ${snap.chosenSkills.join(', ')}` : ''}
                                </div>
                                <div style="font-size:0.82rem;">${authorLabel} • <span style="color:#9e988e;">Копия создаётся с 1-го уровня без чужого прогресса</span></div>
                            </div>
                            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                                <button class="btn-small" onclick="PLAYER_USE_SHARED_USER_TEMPLATE('${tpl.templateId}', true)">🛠️ Взять и настроить в Лобби</button>
                                <button class="btn-save" style="padding:9px 14px;" onclick="PLAYER_USE_SHARED_USER_TEMPLATE('${tpl.templateId}', false)">📥 Взять шаблон и выбрать комнату ➡️</button>
                                ${isMine ? `<button class="btn-small btn-danger" onclick="DELETE_USER_SHARED_TEMPLATE('${tpl.templateId}')">🗑️</button>` : ''}
                            </div>
                        </div>
                    `;
                }).join('');
                contentHTML = `<div>${uCards}</div>`;
            }
        }

        // Вкладка 3: Базовые шаблоны классов D&D
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

        // Вкладка 4: Создать с нуля (ДВА ВАРИАНТА НА ВЫБОР ИГРОКА: заполнить лист сейчас в Лобби ИЛИ сначала зайти в комнату!)
        else if (tab === 'create') {
            contentHTML = `
                <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap:20px;">
                    <div style="background:#181715; border:1px solid #c9a96e; border-radius:12px; padding:20px; display:flex; flex-direction:column; justify-content:space-between;">
                        <div>
                            <h3 style="margin-top:0; color:#e6c88c;">🛠️ Создать самостоятельно (2 способа на выбор)</h3>
                            <p style="color:#ccc; font-size:0.9rem; line-height:1.45; margin-bottom:14px;">
                                Введите имя героя и выберите, как вам удобнее: <b>сначала полностью заполнить Лист персонажа прямо здесь в Лобби</b> или <b>сначала войти в комнату осмотреться</b> и заполнить Лист уже внутри!
                            </p>
                            <label style="color:#c9a96e; font-size:0.9rem; font-weight:bold;">Имя вашего нового героя:</label>
                            <input type="text" id="manual-hero-name-inp" placeholder="Введите имя персонажа..." style="width:100%; margin-top:6px; margin-bottom:14px; padding:10px; background:#121110; color:#fff; border:1px solid #524a3d; border-radius:6px; text-align:left;">
                        </div>
                        <div style="display:flex; flex-direction:column; gap:8px;">
                            <button class="btn-save" style="width:100%; padding:12px;" onclick="PLAYER_CREATE_AND_FILL_NOW_IN_LOBBY()">
                                📋 Вариант 1: Заполнить Лист персонажа СЕЙЧАС (в Лобби до комнаты)
                            </button>
                            <button class="btn-small" style="width:100%; padding:11px; background:#2b251c; border-color:#c9a96e; color:#e6c88c;" onclick="PLAYER_CREATE_MANUAL_HERO()">
                                👁️ Вариант 2: Сначала выбрать комнату и осмотреться (заполнить внутри) ➡️
                            </button>
                        </div>
                    </div>

                    <div style="background:#181715; border:1px solid #38bdf8; border-radius:12px; padding:20px; display:flex; flex-direction:column; justify-content:space-between;">
                        <div>
                            <h3 style="margin-top:0; color:#38bdf8;">🎲 Авто-создание (Случайный герой в 1 клик)</h3>
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
            <div class="panel" style="max-width:1040px; margin:0 auto;">
                <h2>⚔️ Управление персонажами и шаблонами</h2>
                <div style="display:flex; gap:8px; margin-bottom:18px; flex-wrap:wrap;">
                    ${tabBtn('my', `👤 Мои персонажи (${userHeroes.length})`)}
                    ${tabBtn('user_templates', `🌟 Шаблоны от игроков (${sharedTemplates.length})`)}
                    ${tabBtn('templates', '📜 Классовые шаблоны (6)')}
                    ${tabBtn('create', '🛠️ Создать с нуля / 🎲 Авто')}
                </div>
                ${contentHTML}
            </div>
        `;
        return;
    }

    // ШАГ 3 (ДЛЯ ИГРОКА): ВЫБОР КОМНАТЫ
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
                : `<div style="color:#c9a96e; font-size:0.88rem; margin-top:4px;">🆕 <b>Новая комната для этого героя:</b> Начнёт с честного 1-го уровня (без чужого прогресса)</div>`;

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
                    <h2 style="margin:0; border:none; padding:0;">🏰 Выберите комнату для входа</h2>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-small" onclick="PLAYER_EDIT_HERO_SHEET_IN_LOBBY('${hero.id}')">📋 Настроить Лист перед входом</button>
                        <button class="btn-small" onclick="window._lobbyStep='player_chars'; RENDER_LOBBY_HTML();">⬅️ Сменить персонажа</button>
                    </div>
                </div>

                <div style="background:#161513; border:1px solid #c9a96e; border-radius:10px; padding:12px 16px; margin-bottom:18px; display:flex; align-items:center; gap:12px;">
                    <span style="font-size:1.8rem;">🛡️</span>
                    <div>
                        <div style="color:#e6c88c; font-weight:bold;">Выбранный герой: ${hero.name} (${hero.race || 'Раса не выбрана'} • ${hero.className || 'Класс не выбран'})</div>
                        <small style="color:#9e988e;">Вы можете заполнить Лист персонажа прямо сейчас кнопкой сверху или уже внутри комнаты!</small>
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