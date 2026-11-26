// ================================================================
// ⚙️ НАСТРОЙКИ ВИДА, ТЕМЫ, ШРИФТЫ, РЕЖИМ ДЛЯ СЛАБОВИДЯЩИХ И МОБИЛЬНАЯ ВЁРСТКА (ui_settings.js)
// Настройки хранятся локально для каждого пользователя (не перезаписывают вид другим игрокам)
// ================================================================
(function INIT_UI_SETTINGS_AND_MOBILE() {
    const PREFS_KEY = 'dnd_user_ui_prefs_v1';

    const DEFAULT_PREFS = {
        theme: 'classic',      // 'classic' | 'midnight' | 'forest' | 'parchment' | 'highcontrast'
        font: 'sans',          // 'sans' | 'wide' | 'serif' | 'mono'
        scale: 100,            // 90 .. 140 (%)
        spacious: true,        // Более свободные отступы и меньше визуального шума
        lowVision: false       // Режим для людей с плохим зрением
    };

    const THEMES = {
        classic: {
            label: '🕯️ Таверна (Классика)',
            isLight: false,
            bg: 'radial-gradient(circle at top, #201e1c 0%, #11100f 100%)',
            panel: '#1d1c1a',
            panel2: '#151413',
            border: '#3e3830',
            accent: '#d4b476',
            text: '#ece9e3',
            muted: '#a8a296',
            inputBg: '#121110',
            chatMsgBg: '#232220',
            sysMsgBg: '#1e222b'
        },
        midnight: {
            label: '🌙 Полуночный шифер',
            isLight: false,
            bg: 'radial-gradient(circle at top, #182132 0%, #0d121c 100%)',
            panel: '#161e2c',
            panel2: '#101622',
            border: '#31415c',
            accent: '#7dd3fc',
            text: '#e6edf7',
            muted: '#94a3b8',
            inputBg: '#0c111b',
            chatMsgBg: '#1b2638',
            sysMsgBg: '#182236'
        },
        forest: {
            label: '🌲 Сумеречный лес',
            isLight: false,
            bg: 'radial-gradient(circle at top, #1a241e 0%, #0e1410 100%)',
            panel: '#18211b',
            panel2: '#111813',
            border: '#324739',
            accent: '#a7d79c',
            text: '#e8efe9',
            muted: '#9ab09f',
            inputBg: '#0d130f',
            chatMsgBg: '#1d2921',
            sysMsgBg: '#1b2624'
        },
        parchment: {
            label: '📜 Пергамент (Светлая)',
            isLight: true,
            bg: 'linear-gradient(180deg, #ece3d0 0%, #e0d4bc 100%)',
            panel: '#f7f1e3',
            panel2: '#ede4d1',
            border: '#bfa984',
            accent: '#7c4a12',
            text: '#231b12',
            muted: '#5c4d3c',
            inputBg: '#fffdf7',
            chatMsgBg: '#efe6d4',
            sysMsgBg: '#e5ecf2'
        },
        highcontrast: {
            label: '👁️ Высокий контраст',
            isLight: false,
            bg: '#050505',
            panel: '#0e0e0e',
            panel2: '#000000',
            border: '#facc15',
            accent: '#fde047',
            text: '#ffffff',
            muted: '#e5e5e5',
            inputBg: '#000000',
            chatMsgBg: '#141414',
            sysMsgBg: '#101828'
        }
    };

    const FONTS = {
        sans:  { label: 'Системный (Чёткий)',      family: "'Segoe UI', Roboto, -apple-system, BlinkMacSystemFont, sans-serif" },
        wide:  { label: 'Широкий (Verdana — лёгкий)', family: "Verdana, Geneva, Tahoma, sans-serif" },
        serif: { label: 'Книжный (Georgia)',       family: "Georgia, 'Times New Roman', serif" },
        mono:  { label: 'Чёткие цифры (Consolas)', family: "'Cascadia Code', Consolas, 'Courier New', monospace" }
    };

    window._mobRoomTab = window._mobRoomTab || 'center'; // 'left' | 'center' | 'right'

    function GET_PREFS() {
        try {
            const raw = localStorage.getItem(PREFS_KEY);
            if (!raw) return Object.assign({}, DEFAULT_PREFS);
            return Object.assign({}, DEFAULT_PREFS, JSON.parse(raw));
        } catch (e) {
            return Object.assign({}, DEFAULT_PREFS);
        }
    }

    function SAVE_PREFS(p) {
        try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch (e) {}
    }

    // --- 1. ДИНАМИЧЕСКИЕ СТИЛИ (ТЕМЫ, ТИПОГРАФИКА, СЛАБОВИДЯЩИЕ, МОБИЛЬНАЯ ВЁРСТКА) ---
    function ENSURE_BASE_STYLE_SHEET() {
        let st = document.getElementById('ui-settings-master-css');
        if (!st) {
            st = document.createElement('style');
            st.id = 'ui-settings-master-css';
            document.head.appendChild(st);
        }

        st.textContent = `
            html {
                font-size: calc(16px * var(--ui-scale, 1));
            }
            body {
                background: var(--ui-bg) !important;
                color: var(--ui-text) !important;
                font-family: var(--ui-font) !important;
                font-size: calc(16.5px * var(--ui-scale, 1)) !important;
                line-height: var(--ui-lh, 1.48) !important;
            }
            h1 {
                color: var(--ui-accent) !important;
            }
            .panel, .modal-content {
                background: var(--ui-panel) !important;
                border-color: var(--ui-border) !important;
                color: var(--ui-text) !important;
                padding: var(--ui-panel-pad, 14px 16px) !important;
                box-shadow: var(--ui-shadow, 0 4px 14px rgba(0, 0, 0, 0.35)) !important;
            }
            .panel h2, .modal-content h2, .modal-content h3 {
                color: var(--ui-accent) !important;
                border-bottom-color: var(--ui-border) !important;
            }
            .char-stats, .party-member, .spell-item, .carry-info, .money-row, .skill-choice,
            #tasks-content, #chat-messages, .inv-slot, .modal-content table {
                background: var(--ui-panel2) !important;
                border-color: var(--ui-border) !important;
                color: var(--ui-text) !important;
            }
            .party-stats {
                background: var(--ui-panel) !important;
                border-color: var(--ui-border) !important;
            }
            .char-name, .party-name {
                color: var(--ui-accent) !important;
            }
            .char-subtitle, .party-detail, .stat-label, .party-stat-lbl {
                color: var(--ui-muted) !important;
            }
            .stat-value, .party-stat-val {
                color: var(--ui-text) !important;
            }
            #chat-input, #tasks-edit,
            .modal-content input:not([type="checkbox"]):not([type="radio"]):not([type="range"]),
            .modal-content select, .modal-content textarea {
                background: var(--ui-input-bg) !important;
                color: var(--ui-text) !important;
                border-color: var(--ui-border) !important;
                font-family: var(--ui-font) !important;
            }
            .modal-content th {
                background: var(--ui-panel) !important;
                color: var(--ui-accent) !important;
                border-color: var(--ui-border) !important;
            }
            .modal-content td {
                border-color: var(--ui-border) !important;
            }
            #role-status-bar {
                background: var(--ui-panel) !important;
                border-color: var(--ui-border) !important;
                color: var(--ui-text) !important;
            }

            /* Спокойная просторная вёрстка (меньше визуальной каши) */
            body.ui-spacious .main-layout {
                gap: 18px !important;
            }
            body.ui-spacious #left-column,
            body.ui-spacious #gm-left-menu {
                gap: 10px !important;
            }
            body.ui-spacious #center-column {
                gap: 16px !important;
            }
            body.ui-spacious .party-member {
                padding: 12px 14px !important;
                margin-bottom: 10px !important;
            }
            body.ui-spacious button {
                letter-spacing: 0.2px;
                box-shadow: 0 1px 4px rgba(0, 0, 0, 0.28) !important;
            }
            body.ui-spacious .panel {
                border-radius: 12px !important;
            }

            /* Светлая тема Пергамент: аккуратно адаптируем инлайновые тёмные карточки и светлый текст */
            body.theme-parchment h1 {
                text-shadow: none !important;
            }
            body.theme-parchment [style*="background:#181715"],
            body.theme-parchment [style*="background: #181715"],
            body.theme-parchment [style*="background:#161513"],
            body.theme-parchment [style*="background:#161514"],
            body.theme-parchment [style*="background:#151413"],
            body.theme-parchment [style*="background:#141312"],
            body.theme-parchment [style*="background:#121110"],
            body.theme-parchment [style*="background:#1a1a1a"],
            body.theme-parchment [style*="background:#22201d"],
            body.theme-parchment [style*="background:#25221e"] {
                background: var(--ui-panel2) !important;
                color: var(--ui-text) !important;
                border-color: var(--ui-border) !important;
            }
            body.theme-parchment [style*="color:#ccc"],
            body.theme-parchment [style*="color: #ccc"],
            body.theme-parchment [style*="color:#ddd"],
            body.theme-parchment [style*="color:#d8d4cc"],
            body.theme-parchment [style*="color:#ebe8e2"],
            body.theme-parchment [style*="color:#f5f3ef"] {
                color: #2c2216 !important;
            }
            body.theme-parchment [style*="color:#e6c88c"],
            body.theme-parchment [style*="color:#c9a96e"] {
                color: #7c4a12 !important;
            }
            body.theme-parchment [style*="color:#aba498"],
            body.theme-parchment [style*="color:#9e988e"],
            body.theme-parchment [style*="color:#aaa"],
            body.theme-parchment [style*="color:#888"] {
                color: #5c4d3c !important;
            }
            body.theme-parchment #chat-messages > div {
                background: var(--ui-chat-msg) !important;
                color: #231b12 !important;
            }
            body.theme-parchment #auth-overlay-screen {
                background: linear-gradient(180deg, #e7dcc5 0%, #d5c5a5 100%) !important;
            }
            body.theme-parchment button:not(.btn-save):not(.btn-danger):not(.btn-reset):not(.btn-cast):not(.btn-warn):not(.btn-rest) {
                background: linear-gradient(180deg, #e6d3ad 0%, #d3b884 100%);
                color: #1f160b;
                border-color: #9e7c47;
            }
            body.theme-parchment input, body.theme-parchment select, body.theme-parchment textarea {
                background: #fffdf7 !important;
                color: #231b12 !important;
                border-color: #b59d76 !important;
            }
            body.theme-parchment #cloud-sync-badge {
                background: #f7f1e3 !important;
                color: #231b12 !important;
            }
            body.theme-parchment .context-menu {
                background: #f7f1e3 !important;
                border-color: #8f6b36 !important;
            }
            body.theme-parchment .context-menu button {
                background: transparent !important;
                color: #231b12 !important;
            }
            body.theme-parchment .context-menu button:hover {
                background: #e5d7bd !important;
            }

            /* 👁️ РЕЖИМ ДЛЯ СЛАБОВИДЯЩИХ */
            body.ui-low-vision small {
                font-size: 0.96rem !important;
                color: var(--ui-text) !important;
                opacity: 1 !important;
            }
            body.ui-low-vision button {
                min-height: 42px;
                border-width: 2px !important;
                font-weight: 700 !important;
            }
            body.ui-low-vision .panel,
            body.ui-low-vision .modal-content,
            body.ui-low-vision .party-member,
            body.ui-low-vision input,
            body.ui-low-vision select,
            body.ui-low-vision textarea {
                border-width: 2px !important;
            }
            body.ui-low-vision button:focus-visible,
            body.ui-low-vision input:focus-visible,
            body.ui-low-vision select:focus-visible,
            body.ui-low-vision textarea:focus-visible {
                outline: 3px solid #facc15 !important;
                outline-offset: 2px;
            }
            body.ui-low-vision * {
                text-shadow: none !important;
            }

            /* 📱 МОБИЛЬНАЯ АДАПТАЦИЯ (ЭКРАНЫ <= 980px) */
            #mobile-room-nav {
                display: none;
            }
            @media (max-width: 980px) {
                body {
                    padding: 6px 8px 74px 8px !important;
                }
                h1 {
                    font-size: 1.2rem !important;
                    margin-bottom: 6px !important;
                }
                #role-status-bar {
                    padding: 8px 10px !important;
                    gap: 8px !important;
                    font-size: 0.86rem !important;
                }
                .main-layout {
                    flex-direction: column !important;
                    flex-wrap: nowrap !important;
                    width: 100% !important;
                    max-width: 100% !important;
                    gap: 10px !important;
                }
                #left-column, #gm-left-menu, #center-column, #right-column {
                    width: 100% !important;
                    max-width: 100% !important;
                    min-width: 0 !important;
                    flex: none !important;
                    position: static !important;
                }

                /* Показываем только выбранную мобильную вкладку внутри комнаты */
                body.in-room-mobile.mob-tab-left #center-column,
                body.in-room-mobile.mob-tab-left #right-column {
                    display: none !important;
                }
                body.in-room-mobile.mob-tab-center #left-column,
                body.in-room-mobile.mob-tab-center #gm-left-menu,
                body.in-room-mobile.mob-tab-center #right-column {
                    display: none !important;
                }
                body.in-room-mobile.mob-tab-right #left-column,
                body.in-room-mobile.mob-tab-right #gm-left-menu,
                body.in-room-mobile.mob-tab-right #center-column {
                    display: none !important;
                }

                #map-area {
                    height: 54vh !important;
                    min-height: 290px !important;
                    max-height: 460px !important;
                }
                #chat-messages {
                    height: 56vh !important;
                    max-height: 56vh !important;
                }
                .party-member {
                    flex-wrap: wrap !important;
                }
                .modal {
                    padding: 6px !important;
                }
                .modal-content {
                    padding: 14px 12px !important;
                    max-height: 94vh !important;
                }
                .modal-content [style*="grid-template-columns"] {
                    grid-template-columns: 1fr !important;
                }
                #lobby-screen [style*="grid-template-columns"] {
                    grid-template-columns: 1fr !important;
                }

                /* Нижняя мобильная навигация в комнате */
                body.in-room-mobile #mobile-room-nav {
                    display: flex !important;
                    position: fixed;
                    left: 0; right: 0; bottom: 0;
                    z-index: 92000;
                    background: var(--ui-panel, #181715);
                    border-top: 2px solid var(--ui-border, #423c33);
                    padding: 6px 8px;
                    gap: 6px;
                    box-shadow: 0 -6px 20px rgba(0, 0, 0, 0.75);
                }
                #mobile-room-nav button {
                    flex: 1;
                    padding: 9px 4px;
                    font-size: 0.84rem;
                    border-radius: 8px;
                    white-space: nowrap;
                }

                /* Плавающая личка на телефоне садится над нижней панелью */
                #dm-floating-widget {
                    left: 8px !important;
                    right: 8px !important;
                    width: auto !important;
                    max-width: none !important;
                    bottom: 66px !important;
                }
                #dm-whisper-toast {
                    left: 8px !important;
                    right: 8px !important;
                    max-width: none !important;
                    bottom: 68px !important;
                }
            }
        `;
    }

    function APPLY_UI_PREFS() {
        ENSURE_BASE_STYLE_SHEET();
        const p = GET_PREFS();
        const themeKey = (p.lowVision && p.theme === 'classic') ? 'highcontrast' : (THEMES[p.theme] ? p.theme : 'classic');
        const theme = THEMES[themeKey] || THEMES.classic;
        const fontKey = p.lowVision ? 'wide' : (FONTS[p.font] ? p.font : 'sans');
        const font = FONTS[fontKey] || FONTS.sans;
        const scaleVal = p.lowVision ? Math.max(120, p.scale || 120) : Math.max(85, Math.min(145, p.scale || 100));

        const root = document.documentElement;
        root.style.setProperty('--ui-bg', theme.bg);
        root.style.setProperty('--ui-panel', theme.panel);
        root.style.setProperty('--ui-panel2', theme.panel2);
        root.style.setProperty('--ui-border', theme.border);
        root.style.setProperty('--ui-accent', theme.accent);
        root.style.setProperty('--ui-text', theme.text);
        root.style.setProperty('--ui-muted', theme.muted);
        root.style.setProperty('--ui-input-bg', theme.inputBg);
        root.style.setProperty('--ui-chat-msg', theme.chatMsgBg);
        root.style.setProperty('--ui-sys-msg', theme.sysMsgBg);
        root.style.setProperty('--ui-font', font.family);
        root.style.setProperty('--ui-scale', String(scaleVal / 100));
        root.style.setProperty('--ui-lh', (p.spacious || p.lowVision) ? '1.55' : '1.38');
        root.style.setProperty('--ui-panel-pad', (p.spacious || p.lowVision) ? '14px 16px' : '10px 12px');
        root.style.setProperty('--ui-shadow', theme.isLight ? '0 3px 12px rgba(60, 42, 18, 0.14)' : '0 4px 16px rgba(0, 0, 0, 0.38)');

        document.body.classList.remove('theme-classic', 'theme-midnight', 'theme-forest', 'theme-parchment', 'theme-highcontrast');
        document.body.classList.add('theme-' + themeKey);
        document.body.classList.toggle('ui-spacious', !!(p.spacious || p.lowVision));
        document.body.classList.toggle('ui-low-vision', !!p.lowVision);
    }

    // --- 2. ОКНО НАСТРОЕК ---
    function ENSURE_SETTINGS_MODAL() {
        let m = document.getElementById('ui-settings-modal');
        if (m) return m;
        m = document.createElement('div');
        m.className = 'modal';
        m.id = 'ui-settings-modal';
        m.style.zIndex = '95500';
        m.innerHTML = `<div class="modal-content" id="ui-settings-content" style="max-width:640px; width:95%;"></div>`;
        m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('active'); });
        document.body.appendChild(m);
        return m;
    }

    window.OPEN_UI_SETTINGS_MODAL = function() {
        ENSURE_SETTINGS_MODAL();
        RENDER_UI_SETTINGS_MODAL();
        OM('ui-settings-modal');
    };

    window.SET_UI_PREF = function(key, val) {
        const p = GET_PREFS();
        p[key] = val;
        SAVE_PREFS(p);
        APPLY_UI_PREFS();
        RENDER_UI_SETTINGS_MODAL();
    };

    window.TOGGLE_LOW_VISION_MODE = function(enabled) {
        const p = GET_PREFS();
        p.lowVision = !!enabled;
        if (p.lowVision) {
            if (p.scale < 120) p.scale = 125;
            p.spacious = true;
        }
        SAVE_PREFS(p);
        APPLY_UI_PREFS();
        RENDER_UI_SETTINGS_MODAL();
    };

    window.RESET_UI_PREFS = function() {
        SAVE_PREFS(DEFAULT_PREFS);
        APPLY_UI_PREFS();
        RENDER_UI_SETTINGS_MODAL();
    };

    function RENDER_UI_SETTINGS_MODAL() {
        const cont = document.getElementById('ui-settings-content');
        if (!cont) return;
        const p = GET_PREFS();

        const themeCards = Object.entries(THEMES).map(([k, t]) => {
            const act = (p.theme === k);
            return `
                <button class="btn-small" onclick="SET_UI_PREF('theme', '${k}')"
                    style="padding:9px 10px; text-align:left; display:flex; align-items:center; gap:8px; background:${t.panel}; color:${t.text}; border:2px solid ${act ? '#facc15' : t.border}; box-shadow:none;">
                    <span style="width:16px; height:16px; border-radius:50%; background:${t.accent}; border:1px solid ${t.border}; flex-shrink:0;"></span>
                    <span style="font-size:0.86rem;">${t.label}</span>
                </button>`;
        }).join('');

        const fontBtns = Object.entries(FONTS).map(([k, f]) => {
            const act = (p.font === k);
            return `
                <button class="btn-small" onclick="SET_UI_PREF('font', '${k}')"
                    style="padding:8px 10px; font-family:${f.family}; font-size:0.86rem; background:${act ? 'var(--ui-accent)' : 'var(--ui-panel2)'}; color:${act ? '#141210' : 'var(--ui-text)'}; border:2px solid ${act ? 'var(--ui-accent)' : 'var(--ui-border)'};">
                    ${f.label}
                </button>`;
        }).join('');

        cont.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--ui-border); padding-bottom:10px; margin-bottom:14px;">
                <h2 style="margin:0; border:none; padding:0;">⚙️ Настройки вида и удобства</h2>
                <button class="btn-small" onclick="RESET_UI_PREFS()">🔄 По умолчанию</button>
            </div>

            <div style="display:flex; flex-direction:column; gap:14px; text-align:left;">
                <!-- Режим для слабовидящих -->
                <div style="background:var(--ui-panel2); border:2px solid ${p.lowVision ? '#facc15' : 'var(--ui-border)'}; border-radius:10px; padding:12px 14px;">
                    <label style="display:flex; align-items:center; gap:10px; cursor:pointer; font-weight:bold;">
                        <input type="checkbox" ${p.lowVision ? 'checked' : ''} onchange="TOGGLE_LOW_VISION_MODE(this.checked)">
                        <span>👁️ Режим для людей с плохим зрением</span>
                    </label>
                    <div style="color:var(--ui-muted); font-size:0.84rem; margin-top:4px; padding-left:28px;">
                        Увеличивает шрифт, включает чёткий широкий шрифт Verdana, усиливает контраст границ и убирает мелкие бледные подписи.
                    </div>
                </div>

                <!-- Темы -->
                <div>
                    <div style="font-weight:bold; color:var(--ui-accent); margin-bottom:7px;">🎨 Цветовая тема (палитра):</div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(195px, 1fr)); gap:8px;">
                        ${themeCards}
                    </div>
                </div>

                <!-- Шрифт -->
                <div>
                    <div style="font-weight:bold; color:var(--ui-accent); margin-bottom:7px;">🔤 Шрифт текста:</div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(210px, 1fr)); gap:8px;">
                        ${fontBtns}
                    </div>
                </div>

                <!-- Размер шрифта и отступы -->
                <div style="background:var(--ui-panel2); border:1px solid var(--ui-border); border-radius:10px; padding:12px 14px; display:flex; flex-direction:column; gap:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
                        <span>🔍 <b>Размер текста:</b> <b style="color:var(--ui-accent);">${p.scale}%</b></span>
                        <div style="display:flex; align-items:center; gap:8px; flex:1; max-width:290px;">
                            <button class="btn-small" style="padding:3px 10px;" onclick="SET_UI_PREF('scale', Math.max(85, ${p.scale} - 5))">A−</button>
                            <input type="range" min="85" max="140" step="5" value="${p.scale}"
                                oninput="SET_UI_PREF('scale', parseInt(this.value))" style="flex:1;">
                            <button class="btn-small" style="padding:3px 10px;" onclick="SET_UI_PREF('scale', Math.min(140, ${p.scale} + 5))">A+</button>
                        </div>
                    </div>

                    <label style="display:flex; align-items:center; gap:10px; cursor:pointer;">
                        <input type="checkbox" ${p.spacious ? 'checked' : ''} onchange="SET_UI_PREF('spacious', this.checked)">
                        <span>🌿 <b>Просторная вёрстка</b> (больше воздуха между блоками, глаза меньше устают)</span>
                    </label>
                </div>
            </div>

            <div style="margin-top:16px; text-align:right;">
                <button class="btn-save" onclick="CM('ui-settings-modal')">✅ Готово</button>
            </div>
        `;
    }

    // --- 3. ВСТАВКА КНОПКИ «⚙️» В ПРАВЫЙ ВЕРХНИЙ УГОЛ (КОМНАТА, ЛОББИ, ЭКРАН ВХОДА) ---
    function CREATE_GEAR_BTN(label = '⚙️') {
        const b = document.createElement('button');
        b.className = 'btn-small';
        b.setAttribute('data-ui-settings-btn', '1');
        b.title = 'Настройки темы, шрифта и вида сайта';
        b.textContent = label;
        b.onclick = () => window.OPEN_UI_SETTINGS_MODAL();
        return b;
    }

    function INJECT_SETTINGS_BUTTONS() {
        // 1. Внутри комнаты — в правом верхнем блоке шапки
        const bar = document.getElementById('role-status-bar');
        if (bar && bar.style.display !== 'none') {
            bar.querySelectorAll('[data-ui-settings-btn]').forEach(el => el.remove());
            const exitBtn = bar.querySelector('button[onclick="SHOW_LOBBY_SCREEN()"]');
            if (exitBtn) {
                let row = exitBtn.closest('[data-admin-topbar-row]');
                if (!row) {
                    row = document.createElement('div');
                    row.setAttribute('data-admin-topbar-row', '1');
                    row.style.cssText = 'display:flex; align-items:center; gap:6px; flex-wrap:wrap; justify-content:flex-end;';
                    exitBtn.before(row);
                    row.appendChild(exitBtn);
                }
                row.appendChild(CREATE_GEAR_BTN('⚙️'));
            }
        }

        // 2. В Лобби — в верхнем правом углу полосы профиля
        const lobby = document.getElementById('lobby-screen');
        if (lobby && lobby.style.display !== 'none') {
            const logoutBtn = lobby.querySelector('button[onclick="LOGOUT_ACCOUNT()"]');
            if (logoutBtn && logoutBtn.parentElement) {
                logoutBtn.parentElement.querySelectorAll('[data-ui-settings-btn]').forEach(el => el.remove());
                logoutBtn.parentElement.appendChild(CREATE_GEAR_BTN('⚙️ Вид'));
            }
        }

        // 3. На экране входа
        const authPanel = document.querySelector('#auth-overlay-screen .panel');
        if (authPanel && !authPanel.querySelector('[data-ui-settings-btn]')) {
            const b = CREATE_GEAR_BTN('⚙️ Настройки вида и шрифта');
            b.style.cssText = 'width:100%; margin-top:8px; padding:8px;';
            authPanel.appendChild(b);
        }
    }

    // --- 4. МОБИЛЬНАЯ ПАНЕЛЬ ВКЛАДОК ВНУТРИ КОМНАТЫ ---
    window.SET_MOBILE_ROOM_TAB = function(tab) {
        window._mobRoomTab = tab;
        SYNC_MOBILE_NAV();
        if (tab === 'center' && typeof RENDER_MAP_AREA === 'function') {
            setTimeout(() => RENDER_MAP_AREA(), 40);
        }
    };

    function SYNC_MOBILE_NAV() {
        const sess = (typeof GET_SESSION === 'function') ? GET_SESSION() : null;
        const inRoom = !!(sess && sess.roomCode);

        document.body.classList.toggle('in-room-mobile', inRoom);
        document.body.classList.remove('mob-tab-left', 'mob-tab-center', 'mob-tab-right');
        if (inRoom) {
            document.body.classList.add('mob-tab-' + (window._mobRoomTab || 'center'));
        }

        let nav = document.getElementById('mobile-room-nav');
        if (!inRoom) {
            if (nav) nav.remove();
            return;
        }
        if (!nav) {
            nav = document.createElement('div');
            nav.id = 'mobile-room-nav';
            document.body.appendChild(nav);
        }

        const isGM = sess.role === 'gm';
        const cur = window._mobRoomTab || 'center';
        const btnStyle = (act) => act
            ? 'background:var(--ui-accent); color:#141210; border:1px solid var(--ui-accent);'
            : 'background:var(--ui-panel2); color:var(--ui-text); border:1px solid var(--ui-border);';

        nav.innerHTML = `
            <button style="${btnStyle(cur==='left')}" onclick="SET_MOBILE_ROOM_TAB('left')">${isGM ? '👑 Пульт' : '⚔️ Герой'}</button>
            <button style="${btnStyle(cur==='center')}" onclick="SET_MOBILE_ROOM_TAB('center')">🗺️ Карта</button>
            <button style="${btnStyle(cur==='right')}" onclick="SET_MOBILE_ROOM_TAB('right')">💬 Чат</button>
            <button style="background:#2d1f42; color:#f3e8ff; border:1px solid #9b59b6;" onclick="if(window.TOGGLE_DM_WIDGET) TOGGLE_DM_WIDGET();">✉️ Личка</button>
        `;
    }

    // --- 5. ХУКИ В ОТРИСОВКУ ЭКРАНОВ ---
    const _ORIG_AUTH_UI = window.RENDER_AUTH_SCREEN;
    if (typeof _ORIG_AUTH_UI === 'function') {
        window.RENDER_AUTH_SCREEN = function() {
            _ORIG_AUTH_UI();
            INJECT_SETTINGS_BUTTONS();
        };
    }

    const _ORIG_LOBBY_UI = window.RENDER_LOBBY_HTML;
    if (typeof _ORIG_LOBBY_UI === 'function') {
        window.RENDER_LOBBY_HTML = function() {
            _ORIG_LOBBY_UI();
            INJECT_SETTINGS_BUTTONS();
        };
    }

    const _ORIG_APPLY_UI = window.APPLY_ROLE_VIEW;
    if (typeof _ORIG_APPLY_UI === 'function') {
        window.APPLY_ROLE_VIEW = function() {
            _ORIG_APPLY_UI();
            APPLY_UI_PREFS();
            INJECT_SETTINGS_BUTTONS();
            SYNC_MOBILE_NAV();
        };
    }

    APPLY_UI_PREFS();
    INJECT_SETTINGS_BUTTONS();
    SYNC_MOBILE_NAV();
})();