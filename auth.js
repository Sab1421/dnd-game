// ================================================================
// 🔐 СИСТЕМА УЧЁТНЫХ ЗАПИСЕЙ (ЛОГИН / ПАРОЛЬ) И ПРИВЯЗКИ ГЕРОЕВ (auth.js)
// ================================================================
window._authMode = 'login'; // 'login' | 'register'

// Хэширование пароля (чтобы пароли не лежали открытым текстом)
function HASH_PASSWORD(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 16777619);
    }
    return 'h_' + (h >>> 0).toString(16);
}

// База всех зарегистрированных пользователей (синхронизируется через Firebase)
function GET_ACCOUNTS() {
    const raw = localStorage.getItem('dnd_users_accounts');
    if (!raw) return {};
    try { return JSON.parse(raw); } catch (e) { return {}; }
}
function SAVE_ACCOUNTS(accObj) {
    localStorage.setItem('dnd_users_accounts', JSON.stringify(accObj));
}

// Текущий авторизованный пользователь на этом устройстве
function GET_CURRENT_USER() {
    const raw = localStorage.getItem('dnd_active_auth_user');
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; } // { login, displayName }
}
function SAVE_CURRENT_USER(userObj) {
    if (!userObj) localStorage.removeItem('dnd_active_auth_user');
    else localStorage.setItem('dnd_active_auth_user', JSON.stringify(userObj));
}

// Переключатель вкладок Вход / Регистрация
function SET_AUTH_MODE(mode) {
    window._authMode = mode;
    RENDER_AUTH_SCREEN();
}

// Выход из аккаунта
function LOGOUT_ACCOUNT() {
    if (!confirm('Выйти из текущей учётной записи?')) return;
    SAVE_SESSION(null);
    SAVE_CURRENT_USER(null);
    APPLY_ROLE_VIEW();
}

// Обработка Входа или Регистрации
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

    if (loginKey.length < 3) {
        showErr('Логин должен содержать минимум 3 символа.');
        return;
    }
    if (pass.length < 4) {
        showErr('Пароль должен содержать минимум 4 символа.');
        return;
    }

    const accounts = GET_ACCOUNTS();
    const passHash = HASH_PASSWORD(loginKey + ':' + pass);

    if (window._authMode === 'register') {
        if (accounts[loginKey]) {
            showErr('Этот логин уже занят! Переключитесь на вкладку «Вход» или выберите другой логин.');
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
        APPLY_ROLE_VIEW();
    } else {
        const acc = accounts[loginKey];
        if (!acc) {
            showErr('Аккаунт с таким логином не найден. Проверьте логин или зарегистрируйтесь.');
            return;
        }
        if (acc.passHash !== passHash) {
            showErr('Неверный пароль!');
            return;
        }
        SAVE_CURRENT_USER({ login: loginKey, displayName: acc.displayName || acc.login });
        SAVE_GM_NAME(acc.displayName || acc.login);
        APPLY_ROLE_VIEW();
    }
}

// Отрисовка окна Входа / Регистрации
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
                Войдите в свою учётную запись, чтобы получить доступ к своим персонажам и комнатам кампаний
            </p>

            <!-- Переключатель Вход / Регистрация -->
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

// Привязываем создаваемых персонажей к текущему аккаунту игрока!
const _ORIG_CREATE_NEW_HERO_AUTH = CREATE_NEW_HERO_AND_JOIN;
CREATE_NEW_HERO_AND_JOIN = function(roomCode) {
    const user = GET_CURRENT_USER();
    _ORIG_CREATE_NEW_HERO_AUTH(roomCode);
    if (user) {
        const cs = GC();
        const sess = GET_SESSION();
        const idx = sess ? sess.playerIdx : (cs.length - 1);
        if (cs[idx]) {
            cs[idx].owner = user.login;
            cs[idx].ownerName = user.displayName;
            SC(cs);
        }
    }
};

// Привязываем существующего персонажа к аккаунту, если у героя ещё не было владельца (для сохранения старых героев!)
const _ORIG_ENTER_ROOM_PLAYER_AUTH = ENTER_ROOM_AS_PLAYER;
ENTER_ROOM_AS_PLAYER = function(roomCode, charIdx) {
    const user = GET_CURRENT_USER();
    const cs = GC();
    const idx = parseInt(charIdx);
    if (user && cs[idx]) {
        if (cs[idx].owner && cs[idx].owner !== user.login) {
            showMessage('🔒 Чужой персонаж', `Этот персонаж принадлежит пользователю «<b>${cs[idx].ownerName || cs[idx].owner}</b>». Выберите своего героя или создайте нового!`);
            return;
        }
        if (!cs[idx].owner) {
            cs[idx].owner = user.login;
            cs[idx].ownerName = user.displayName;
            SC(cs);
        }
    }
    _ORIG_ENTER_ROOM_PLAYER_AUTH(roomCode, idx);
};

// Обновляем Лобби: показываем сверху плашку аккаунта и фильтруем список героев (свои + свободные)
const _ORIG_RENDER_LOBBY_AUTH = RENDER_LOBBY_HTML;
RENDER_LOBBY_HTML = function() {
    _ORIG_RENDER_LOBBY_AUTH();
    const user = GET_CURRENT_USER();
    if (!user) return;

    const lobby = document.getElementById('lobby-screen');
    if (!lobby) return;

    // 1. Добавляем красивую шапку профиля в Лобби
    const profileBar = document.createElement('div');
    profileBar.style.cssText = 'max-width:980px; margin:16px auto 0 auto; background:#181715; border:1px solid #c9a96e; padding:10px 18px; border-radius:10px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;';
    profileBar.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px;">
            <span style="background:#c9a96e; color:#181510; font-weight:bold; padding:3px 10px; border-radius:6px; font-size:0.9rem;">👤 Аккаунт</span>
            <b style="color:#e6c88c; font-size:1.05rem;">${user.displayName}</b>
            <small style="color:#888;">(@${user.login})</small>
        </div>
        <button class="btn-small btn-danger" onclick="LOGOUT_ACCOUNT()">🚪 Выйти из аккаунта</button>
    `;
    lobby.prepend(profileBar);

    // 2. Фильтруем выпадающий список персонажей в Лобби (показываем только героев этого аккаунта или ничейных)
    const charSelect = document.getElementById('lobby-player-char');
    if (charSelect) {
        const cs = GC();
        let myOpts = '';
        cs.forEach((c, idx) => {
            if (!c.owner || c.owner === user.login) {
                const tag = c.owner === user.login ? '⭐ Мой герой' : '🆓 Свободный';
                myOpts += `<option value="${idx}">👤 ${c.name || 'Безымянный'} (${c.race || 'Раса'} • ${c.className || 'Класс'} ${c.level || 1} ур.) [${tag}]</option>`;
            }
        });
        if (!myOpts) {
            myOpts = `<option value="-1" disabled selected>У вас пока нет персонажей — нажмите «+ Создать нового персонажа» ниже</option>`;
        }
        charSelect.innerHTML = myOpts;
    }
};

// Перехватываем APPLY_ROLE_VIEW, чтобы проверять авторизацию и добавлять кнопку выхода из аккаунта
const _ORIG_APPLY_ROLE_VIEW_AUTH = APPLY_ROLE_VIEW;
APPLY_ROLE_VIEW = function() {
    const user = GET_CURRENT_USER();
    if (!user) {
        RENDER_AUTH_SCREEN();
        return;
    }
    RENDER_AUTH_SCREEN();
    _ORIG_APPLY_ROLE_VIEW_AUTH();

    // Добавляем имя аккаунта в верхний статус-бар во время игры
    const topStatusBar = document.getElementById('role-status-bar');
    if (topStatusBar && topStatusBar.firstElementChild) {
        const badge = document.createElement('span');
        badge.style.cssText = 'color:#9e988e; font-size:0.85rem; background:#121110; padding:3px 8px; border-radius:5px; border:1px solid #38332c;';
        badge.innerHTML = `👤 <b>${user.displayName}</b>`;
        topStatusBar.firstElementChild.prepend(badge);
    }
};

// Запуск проверки авторизации при старте
APPLY_ROLE_VIEW();