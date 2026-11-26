// ================================================================
// ⚙️ НАСТРОЙКИ ВИДА, 12 ЩАДЯЩИХ ПАЛИТР, КОМФОРТ ДЛЯ ГЛАЗ И МОБИЛЬНАЯ ВЁРСТКА (ui_settings.js)
// Настройки хранятся локально у каждого пользователя
// ================================================================
(function INIT_UI_SETTINGS_V2() {
    const PREFS_KEY = 'dnd_user_ui_prefs_v2';
    const OLD_PREFS_KEY = 'dnd_user_ui_prefs_v1';

    const DEFAULT_PREFS = {
        theme: 'tavern',
        font: 'sans',
        scale: 100,            // 85 .. 135 (%)
        spacious: true,        // Просторные отступы
        comfortEyes: false,    // Мягкий крупный режим для уставших/слабых глаз (без жёлтых рамок!)
        warmFilter: 0          // 0 | 1 | 2 | 3 (тёплый анти-синий фильтр для долгих сессий)
    };

    // 12 матовых палитр без чистого #000/#fff и без вырвиглазного неона
    const THEMES = {
        // --- ТЁМНЫЕ (МЯГКИЕ, МАТОВЫЕ) ---
        tavern: {
            group: 'dark', label: 'Тёплая таверна', icon: '🕯️', isLight: false,
            bg: '#191715', panel: '#221f1c', panel2: '#161412',
            border: '#3e372f', borderStrong: '#695c4c',
            accent: '#d2b278', text: '#e5e0d7', muted: '#a69e92',
            inputBg: '#131110', chatBg: '#24211d', sysBg: '#1e222a',
            btnBg: '#c8a66a', btnText: '#1a150f'
        },
        espresso: {
            group: 'dark', label: 'Тёмный какао', icon: '☕', isLight: false,
            bg: '#1b1614', panel: '#241d1a', panel2: '#171210',
            border: '#44362f', borderStrong: '#6e574c',
            accent: '#d8a675', text: '#ebe1d6', muted: '#b09d90',
            inputBg: '#140f0e', chatBg: '#271f1c', sysBg: '#231e22',
            btnBg: '#c79361', btnText: '#1b130e'
        },
        slate: {
            group: 'dark', label: 'Ночной сланец', icon: '🌙', isLight: false,
            bg: '#151a22', panel: '#1c232e', panel2: '#12171f',
            border: '#2f3b4f', borderStrong: '#4e6282',
            accent: '#8cb8e6', text: '#dde5f0', muted: '#94a4bc',
            inputBg: '#10141c', chatBg: '#1e2634', sysBg: '#1a2436',
            btnBg: '#7aa5d4', btnText: '#0f141e'
        },
        moss: {
            group: 'dark', label: 'Хвойный мох', icon: '🌲', isLight: false,
            bg: '#151b17', panel: '#1c241f', panel2: '#111613',
            border: '#2e3d34', borderStrong: '#4f6b5a',
            accent: '#9cc49b', text: '#dfe9e1', muted: '#95aa9a',
            inputBg: '#0f1411', chatBg: '#1e2822', sysBg: '#1b2625',
            btnBg: '#85b084', btnText: '#101913'
        },
        plum: {
            group: 'dark', label: 'Сумеречный аметист', icon: '🔮', isLight: false,
            bg: '#19161f', panel: '#221e2a', panel2: '#15121a',
            border: '#3a324a', borderStrong: '#60537a',
            accent: '#c2a6df', text: '#e6e1ed', muted: '#a59ab5',
            inputBg: '#120f17', chatBg: '#252030', sysBg: '#1f2233',
            btnBg: '#ae8fd1', btnText: '#16111f'
        },
        burgundy: {
            group: 'dark', label: 'Старый бархат', icon: '🍷', isLight: false,
            bg: '#1c1517', panel: '#261c1f', panel2: '#171113',
            border: '#463238', borderStrong: '#705059',
            accent: '#d6a0a8', text: '#ece2e4', muted: '#b09a9e',
            inputBg: '#140f11', chatBg: '#291e22', sysBg: '#221f28',
            btnBg: '#c28a93', btnText: '#1c1215'
        },
        abyss: {
            group: 'dark', label: 'Глубокий фьорд', icon: '🌊', isLight: false,
            bg: '#131b1e', panel: '#1a2529', panel2: '#101619',
            border: '#2b3d45', borderStrong: '#496673',
            accent: '#82c2c2', text: '#deeaea', muted: '#8fa7aa',
            inputBg: '#0e1417', chatBg: '#1c282d', sysBg: '#182530',
            btnBg: '#6eb0b0', btnText: '#0d1719'
        },
        graphite: {
            group: 'dark', label: 'Матовый графит', icon: '🪨', isLight: false,
            bg: '#18191b', panel: '#212226', panel2: '#141517',
            border: '#383b42', borderStrong: '#5b606b',
            accent: '#c9ba9e', text: '#e3e4e8', muted: '#9ea2ac',
            inputBg: '#121315', chatBg: '#24262b', sysBg: '#1f232c',
            btnBg: '#b8a98e', btnText: '#151619'
        },

        // --- СВЕТЛЫЕ (МАТОВЫЕ, БЕЗ СЛЕПЯЩЕГО БЕЛОГО) ---
        parchment: {
            group: 'light', label: 'Тёплый пергамент', icon: '📜', isLight: true,
            bg: '#e5dac6', panel: '#f1e9d8', panel2: '#e4d9c3',
            border: '#c2b08f', borderStrong: '#8e7855',
            accent: '#7a4b19', text: '#2a2015', muted: '#5d4e3c',
            inputBg: '#f9f4e8', chatBg: '#ebe1cc', sysBg: '#e1e8ee',
            btnBg: '#d7c097', btnText: '#23190e'
        },
        sage_light: {
            group: 'light', label: 'Спокойный шалфей', icon: '🍃', isLight: true,
            bg: '#d9e1da', panel: '#e8eee8', panel2: '#d8e0d8',
            border: '#aabaa9', borderStrong: '#6f8772',
            accent: '#2c5838', text: '#1b251e', muted: '#4a5c4f',
            inputBg: '#f2f6f2', chatBg: '#e0e8e0', sysBg: '#dce5eb',
            btnBg: '#b7cbb8', btnText: '#142017'
        },
        mist_light: {
            group: 'light', label: 'Утренний туман', icon: '☁️', isLight: true,
            bg: '#dbe0e6', panel: '#eaedf1', panel2: '#dae0e6',
            border: '#b1bcc9', borderStrong: '#76899e',
            accent: '#2c517a', text: '#1c232d', muted: '#4e5c6d',
            inputBg: '#f4f6f9', chatBg: '#e2e7ed', sysBg: '#dae3ed',
            btnBg: '#bccfe2', btnText: '#141d28'
        },
        sand_light: {
            group: 'light', label: 'Лён и глина', icon: '🏜️', isLight: true,
            bg: '#e5ddd4', panel: '#f0e9e1', panel2: '#e2d8cd',
            border: '#c2b2a3', borderStrong: '#8f7b6a',
            accent: '#804734', text: '#2b211c', muted: '#5f5048',
            inputBg: '#f8f4ef', chatBg: '#eae1d7', sysBg: '#e1e5eb',
            btnBg: '#d8c3b1', btnText: '#231914'
        }
    };

    const FONTS = {
        sans:  { label: 'Стандартный (Segoe / Sans)',   sample: 'Чистый и ровный',      family: "'Segoe UI', Roboto, -apple-system, BlinkMacSystemFont, sans-serif" },
        wide:  { label: 'Широкий (Verdana)',            sample: 'Буквы не сливаются',   family: "Verdana, Geneva, Tahoma, sans-serif" },
        soft:  { label: 'Мягкий (Trebuchet)',           sample: 'Лёгкий для чтения',    family: "'Trebuchet MS', 'Lucida Sans Unicode', sans-serif" },
        serif: { label: 'Книжный (Georgia)',            sample: 'Атмосфера хроник',     family: "Georgia, 'Times New Roman', serif" }
    };

    const WARM_LEVELS = [
        { val: 0, label: 'Выкл',     alpha: 0 },
        { val: 1, label: 'Лёгкий',   alpha: 0.06 },
        { val: 2, label: 'Средний',  alpha: 0.12 },
        { val: 3, label: 'Ночной',   alpha: 0.18 }
    ];

    window._uiSettingsTab = 'themes'; // 'themes' | 'eyes'
    window._mobRoomTab = window._mobRoomTab || 'center';

    function GET_PREFS() {
        try {
            const raw = localStorage.getItem(PREFS_KEY);
            if (raw) {
                const p = Object.assign({}, DEFAULT_PREFS, JSON.parse(raw));
                if (!THEMES[p.theme]) p.theme = 'tavern';
                if (!FONTS[p.font]) p.font = 'sans';
                return p;
            }
            // Мягкая миграция со старой версии v1 (чтобы highcontrast не остался)
            const oldRaw = localStorage.getItem(OLD_PREFS_KEY);
            if (oldRaw) {
                const o = JSON.parse(oldRaw);
                const mapT = { classic: 'tavern', midnight: 'slate', forest: 'moss', parchment: 'parchment', highcontrast: 'graphite' };
                const migrated = Object.assign({}, DEFAULT_PREFS, {
                    theme: mapT[o.theme] || 'tavern',
                    font: FONTS[o.font] ? o.font : 'sans',
                    scale: Math.max(85, Math.min(135, o.scale || 100)),
                    spacious: o.spacious !== undefined ? !!o.spacious : true,
                    comfortEyes: !!o.lowVision
                });
                SAVE_PREFS(migrated);
                return migrated;
            }
        } catch (e) {}
        return Object.assign({}, DEFAULT_PREFS);
    }

    function SAVE_PREFS(p) {
        try { localStorage.setItem(PREFS_KEY, JSON.stringify(p)); } catch (e) {}
    }

    // --- 1. СТИЛИ И ПРИМЕНЕНИЕ ---
    function ENSURE_MASTER_CSS() {
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
                font-size: calc(16px * var(--ui-scale, 1)) !important;
                line-height: var(--ui-lh, 1.48) !important;
                letter-spacing: var(--ui-ls, 0em) !important;
            }
            h1 {
                color: var(--ui-accent) !important;
            }
            .panel, .modal-content {
                background: var(--ui-panel) !important;
                border: var(--ui-bw, 1px) solid var(--ui-border) !important;
                color: var(--ui-text) !important;
                padding: var(--ui-panel-pad, 14px 16px) !important;
                box-shadow: var(--ui-shadow) !important;
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
                border: var(--ui-bw, 1px) solid var(--ui-border) !important;
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
                border: var(--ui-bw, 1px) solid var(--ui-border) !important;
                color: var(--ui-text) !important;
            }

            /* Базовые кнопки в тон выбранной палитры (чистая матовость без глянца) */
            button:not(.btn-save):not(.btn-danger):not(.btn-reset):not(.btn-cast):not(.btn-warn):not(.btn-rest):not([data-custom-bg]) {
                background: var(--ui-btn-bg);
                color: var(--ui-btn-text);
                border-color: var(--ui-border-strong);
            }
            button:hover {
                filter: brightness(1.06) !important;
            }

            /* Матовые приглушённые оттенки для всех цветных кнопок (зелёные, красные, синие, фиолетовые, оранжевые) */
            button.btn-save {
                background: #3f6e49 !important;
                border-color: #588a62 !important;
                color: #eef5ef !important;
                box-shadow: none !important;
            }
            button.btn-danger, button.btn-reset,
            button[data-admin-ui="admin"]:not(.btn-warn),
            button[style*="#dc2626"] {
                background: #7e3d3d !important;
                border-color: #9e5858 !important;
                color: #f6ebeb !important;
                box-shadow: none !important;
            }
            button.btn-cast {
                background: #3b5f82 !important;
                border-color: #577da1 !important;
                color: #ebf2f8 !important;
                box-shadow: none !important;
            }
            button.btn-warn {
                background: #966638 !important;
                border-color: #b58454 !important;
                color: #faf3eb !important;
                box-shadow: none !important;
            }
            button.btn-rest {
                background: #463c59 !important;
                border-color: #6a5e82 !important;
                color: #ece8f5 !important;
                box-shadow: none !important;
            }
            button[style*="#8b5cf6"]:not([data-custom-bg]),
            button[style*="#7c3aed"]:not([data-custom-bg]),
            button[style*="#6d28d9"]:not([data-custom-bg]),
            button[style*="#9b59b6"]:not([data-custom-bg]),
            #dm-widget-send-btn {
                background: #614e82 !important;
                border-color: #826ea6 !important;
                color: #f2eef9 !important;
                box-shadow: none !important;
            }

            /* Приглушаем яркие неоновые акценты: ХП-бар, ячейки магии, рамки карточек, бейджи и Личку */
            .hp-fill {
                background: #4f8558 !important;
            }
            .rpg-slot-pill.pact {
                background: #9174b8 !important;
                border-color: #b49bd6 !important;
                box-shadow: none !important;
            }
            .rpg-slot-pill.regular, .rpg-slot-pill.arcanum {
                background: #5b8fb8 !important;
                border-color: #84b3d6 !important;
                box-shadow: none !important;
            }
            span[style*="#ef4444"] {
                background: #a84848 !important;
            }
            #lobby-screen .panel[style*="#439c47"] {
                border-color: #4f7856 !important;
            }
            #lobby-screen .panel[style*="#9b59b6"] {
                border-color: #6b588c !important;
            }
            #dm-floating-widget, #dm-whisper-toast {
                border-color: #6b588c !important;
            }
            #dm-widget-header {
                background: #272133 !important;
                border-bottom-color: #453a59 !important;
            }
            #role-status-bar span[style*="#7c3aed"] {
                background: #5b487d !important;
            }
            #role-status-bar span[style*="#2e5a2e"] {
                background: #3d6344 !important;
            }

            /* Спокойная просторная вёрстка */
            body.ui-spacious .main-layout { gap: 18px !important; }
            body.ui-spacious #left-column,
            body.ui-spacious #gm-left-menu { gap: 10px !important; }
            body.ui-spacious #center-column { gap: 16px !important; }
            body.ui-spacious .party-member { padding: 12px 14px !important; margin-bottom: 10px !important; }
            body.ui-spacious .panel { border-radius: 12px !important; }
            body.ui-spacious button { box-shadow: 0 1px 3px rgba(0, 0, 0, 0.22) !important; }

            /* 👁️ Мягкий комфортный режим для уставших и слабых глаз (БЕЗ кислотных рамок!) */
            body.ui-comfort-eyes small {
                font-size: 0.94rem !important;
                color: var(--ui-muted) !important;
                opacity: 1 !important;
            }
            body.ui-comfort-eyes button {
                min-height: 38px;
            }
            body.ui-comfort-eyes .panel,
            body.ui-comfort-eyes .modal-content,
            body.ui-comfort-eyes .party-member,
            body.ui-comfort-eyes .char-stats,
            body.ui-comfort-eyes #chat-messages,
            body.ui-comfort-eyes #tasks-content {
                border-color: var(--ui-border-strong) !important;
            }
            body.ui-comfort-eyes button:focus-visible,
            body.ui-comfort-eyes input:focus-visible,
            body.ui-comfort-eyes select:focus-visible,
            body.ui-comfort-eyes textarea:focus-visible {
                outline: 2px solid var(--ui-accent) !important;
                outline-offset: 2px;
            }
            body.ui-comfort-eyes h1 {
                text-shadow: none !important;
            }

            /* Адаптация инлайновых блоков под светлые матовые палитры */
            body.ui-theme-light h1 { text-shadow: none !important; }
            body.ui-theme-light [style*="background:#181715"],
            body.ui-theme-light [style*="background: #181715"],
            body.ui-theme-light [style*="background:#161513"],
            body.ui-theme-light [style*="background:#161514"],
            body.ui-theme-light [style*="background:#151413"],
            body.ui-theme-light [style*="background:#141312"],
            body.ui-theme-light [style*="background:#121110"],
            body.ui-theme-light [style*="background:#11100f"],
            body.ui-theme-light [style*="background:#1a1a1a"],
            body.ui-theme-light [style*="background:#1f1f1f"],
            body.ui-theme-light [style*="background:#22201d"],
            body.ui-theme-light [style*="background:#25221e"],
            body.ui-theme-light [style*="background:#26231e"] {
                background: var(--ui-panel2) !important;
                color: var(--ui-text) !important;
                border-color: var(--ui-border) !important;
            }
            body.ui-theme-light [style*="color:#ccc"],
            body.ui-theme-light [style*="color: #ccc"],
            body.ui-theme-light [style*="color:#ddd"],
            body.ui-theme-light [style*="color:#d8d4cc"],
            body.ui-theme-light [style*="color:#ebe8e2"],
            body.ui-theme-light [style*="color:#f5f3ef"],
            body.ui-theme-light [style*="color:#fff"] {
                color: var(--ui-text) !important;
            }
            body.ui-theme-light button.btn-save,
            body.ui-theme-light button.btn-danger,
            body.ui-theme-light button.btn-cast,
            body.ui-theme-light button.btn-warn,
            body.ui-theme-light button.btn-rest {
                color: #ffffff !important;
            }
            body.ui-theme-light [style*="color:#e6c88c"],
            body.ui-theme-light [style*="color:#c9a96e"] {
                color: var(--ui-accent) !important;
            }
            body.ui-theme-light [style*="color:#aba498"],
            body.ui-theme-light [style*="color:#9e988e"],
            body.ui-theme-light [style*="color:#aaa"],
            body.ui-theme-light [style*="color:#888"] {
                color: var(--ui-muted) !important;
            }
            body.ui-theme-light #chat-messages > div {
                background: var(--ui-chat-msg) !important;
                color: var(--ui-text) !important;
            }
            body.ui-theme-light #auth-overlay-screen {
                background: var(--ui-bg) !important;
            }
            body.ui-theme-light #cloud-sync-badge {
                background: var(--ui-panel) !important;
                color: var(--ui-text) !important;
            }
            body.ui-theme-light .context-menu {
                background: var(--ui-panel) !important;
                border-color: var(--ui-border-strong) !important;
            }
            body.ui-theme-light .context-menu button {
                background: transparent !important;
                color: var(--ui-text) !important;
            }
            body.ui-theme-light .context-menu button:hover {
                background: var(--ui-panel2) !important;
            }

            /* Красивый переключатель (тумблер) для окна настроек */
            .ui-switch {
                position: relative;
                display: inline-block;
                width: 44px;
                height: 24px;
                flex-shrink: 0;
            }
            .ui-switch input {
                opacity: 0;
                width: 0;
                height: 0;
            }
            .ui-switch-slider {
                position: absolute;
                cursor: pointer;
                inset: 0;
                background: var(--ui-border);
                border-radius: 24px;
                transition: background 0.2s;
            }
            .ui-switch-slider:before {
                content: "";
                position: absolute;
                height: 18px;
                width: 18px;
                left: 3px;
                bottom: 3px;
                background: var(--ui-text);
                border-radius: 50%;
                transition: transform 0.2s;
            }
            .ui-switch input:checked + .ui-switch-slider {
                background: var(--ui-accent);
            }
            .ui-switch input:checked + .ui-switch-slider:before {
                transform: translateX(20px);
                background: var(--ui-panel2);
            }

            /* 🔒 СТАБИЛЬНАЯ ВЁРСТКА ШАПКИ И КАРТОЧКИ ПЕРСОНАЖА (НИЧЕГО НЕ СЪЕЗЖАЕТ) */
            #role-status-bar, #room-session-bar {
                max-width: 1740px !important;
                width: 100%;
                box-sizing: border-box !important;
                justify-content: space-between !important;
                align-items: center !important;
                gap: 8px 14px !important;
                padding: 8px 14px !important;
                letter-spacing: 0 !important;
                line-height: 1.3 !important;
            }
            #role-status-bar > div:first-child,
            #room-session-bar > div:first-child {
                flex: 1 1 auto;
                min-width: 0;
            }
            #role-status-bar > div:last-child,
            #room-session-bar > div:last-child {
                margin-left: auto !important;
                flex: 0 1 auto;
                align-items: flex-end !important;
                justify-content: flex-end !important;
            }
            #role-status-bar [data-admin-topbar-row] {
                justify-content: flex-end !important;
            }
            #role-status-bar button,
            #room-session-bar button,
            #role-status-bar span,
            #role-status-bar label,
            #room-session-bar span {
                font-size: clamp(12px, 0.84rem, 15px) !important;
                min-height: 0 !important;
            }
            #role-status-bar button,
            #room-session-bar button {
                padding: 5px 9px !important;
                white-space: nowrap;
            }

            /* Возвращаем привычный компактный вид карточки персонажа и тёмной полоски ХП/КБ/Ячейки */
            #left-column {
                flex: 0 0 325px !important;
                width: 325px !important;
                max-width: 325px !important;
                box-sizing: border-box !important;
            }
            .char-card {
                padding: 10px 14px !important;
                overflow: hidden;
            }
            .char-stats {
                padding: 6px 8px !important;
                margin-top: 6px !important;
                width: 100% !important;
                max-width: 100% !important;
                box-sizing: border-box !important;
                gap: 4px !important;
                line-height: 1.2 !important;
                letter-spacing: 0 !important;
            }
            .char-stats .stat-item {
                flex: 1 1 0 !important;
                min-width: 0 !important;
            }
            .char-stats .stat-value {
                font-size: clamp(16px, 1.12rem, 20px) !important;
                line-height: 1.2 !important;
            }
            .char-stats .stat-label {
                font-size: clamp(11px, 0.74rem, 13px) !important;
                line-height: 1.2 !important;
                letter-spacing: 0 !important;
                white-space: nowrap;
            }
            body.ui-comfort-eyes .btn-small,
            body.ui-comfort-eyes .char-card button {
                min-height: 0 !important;
            }

            /* 📱 МОБИЛЬНАЯ АДАПТАЦИЯ (<= 980px) */
            #mobile-room-nav { display: none; }
            @media (max-width: 980px) {
                body { padding: 6px 8px 74px 8px !important; }
                h1 { font-size: 1.2rem !important; margin-bottom: 6px !important; }
                #role-status-bar { padding: 8px 10px !important; gap: 8px !important; font-size: 0.86rem !important; }
                .main-layout { flex-direction: column !important; flex-wrap: nowrap !important; width: 100% !important; max-width: 100% !important; gap: 10px !important; }
                #left-column, #gm-left-menu, #center-column, #right-column {
                    width: 100% !important; max-width: 100% !important; min-width: 0 !important; flex: none !important; position: static !important;
                }
                body.in-room-mobile.mob-tab-left #center-column,
                body.in-room-mobile.mob-tab-left #right-column,
                body.in-room-mobile.mob-tab-center #left-column,
                body.in-room-mobile.mob-tab-center #gm-left-menu,
                body.in-room-mobile.mob-tab-center #right-column,
                body.in-room-mobile.mob-tab-right #left-column,
                body.in-room-mobile.mob-tab-right #gm-left-menu,
                body.in-room-mobile.mob-tab-right #center-column {
                    display: none !important;
                }
                #map-area { height: 54vh !important; min-height: 290px !important; max-height: 460px !important; }
                #chat-messages { height: 56vh !important; max-height: 56vh !important; }
                .party-member { flex-wrap: wrap !important; }
                .modal { padding: 6px !important; }
                .modal-content { padding: 14px 12px !important; max-height: 94vh !important; }
                .modal-content [style*="grid-template-columns"],
                #lobby-screen [style*="grid-template-columns"] { grid-template-columns: 1fr !important; }

                body.in-room-mobile #mobile-room-nav {
                    display: flex !important;
                    position: fixed; left: 0; right: 0; bottom: 0; z-index: 92000;
                    background: var(--ui-panel); border-top: 1px solid var(--ui-border-strong);
                    padding: 6px 8px; gap: 6px; box-shadow: 0 -6px 20px rgba(0, 0, 0, 0.55);
                }
                #mobile-room-nav button { flex: 1; padding: 9px 4px; font-size: 0.84rem; border-radius: 8px; white-space: nowrap; }
                #dm-floating-widget { left: 8px !important; right: 8px !important; width: auto !important; max-width: none !important; bottom: 66px !important; }
                #dm-whisper-toast { left: 8px !important; right: 8px !important; max-width: none !important; bottom: 68px !important; }
            }
        `;
    }

    function UPDATE_WARM_OVERLAY(level) {
        let ov = document.getElementById('ui-warm-eye-overlay');
        const cfg = WARM_LEVELS.find(w => w.val === level) || WARM_LEVELS[0];
        if (!cfg || cfg.alpha <= 0) {
            if (ov) ov.style.display = 'none';
            return;
        }
        if (!ov) {
            ov = document.createElement('div');
            ov.id = 'ui-warm-eye-overlay';
            ov.style.cssText = 'position:fixed; inset:0; pointer-events:none; z-index:999999; mix-blend-mode:multiply; transition:background 0.25s ease;';
            document.body.appendChild(ov);
        }
        ov.style.display = 'block';
        ov.style.background = `rgba(255, 168, 76, ${cfg.alpha})`;
    }

    function APPLY_UI_PREFS() {
        ENSURE_MASTER_CSS();
        const p = GET_PREFS();
        const theme = THEMES[p.theme] || THEMES.tavern;
        const font = FONTS[p.font] || FONTS.sans;
        const scaleVal = p.comfortEyes ? Math.max(115, p.scale || 115) : Math.max(85, Math.min(135, p.scale || 100));

        const root = document.documentElement;
        root.style.setProperty('--ui-bg', theme.bg);
        root.style.setProperty('--ui-panel', theme.panel);
        root.style.setProperty('--ui-panel2', theme.panel2);
        root.style.setProperty('--ui-border', theme.border);
        root.style.setProperty('--ui-border-strong', theme.borderStrong);
        root.style.setProperty('--ui-accent', theme.accent);
        root.style.setProperty('--ui-text', theme.text);
        root.style.setProperty('--ui-muted', p.comfortEyes ? theme.text : theme.muted);
        root.style.setProperty('--ui-input-bg', theme.inputBg);
        root.style.setProperty('--ui-chat-msg', theme.chatBg);
        root.style.setProperty('--ui-sys-msg', theme.sysBg);
        root.style.setProperty('--ui-btn-bg', theme.btnBg);
        root.style.setProperty('--ui-btn-text', theme.btnText);
        root.style.setProperty('--ui-font', font.family);
        root.style.setProperty('--ui-scale', String(scaleVal / 100));
        root.style.setProperty('--ui-lh', p.comfortEyes ? '1.62' : (p.spacious ? '1.52' : '1.38'));
        root.style.setProperty('--ui-ls', p.comfortEyes ? '0.02em' : '0em');
        root.style.setProperty('--ui-bw', p.comfortEyes ? '1.5px' : '1px');
        root.style.setProperty('--ui-panel-pad', (p.spacious || p.comfortEyes) ? '14px 16px' : '10px 12px');
        root.style.setProperty('--ui-shadow', theme.isLight ? '0 3px 12px rgba(45, 35, 20, 0.12)' : '0 4px 16px rgba(0, 0, 0, 0.34)');

        document.body.classList.toggle('ui-theme-light', !!theme.isLight);
        document.body.classList.toggle('ui-spacious', !!(p.spacious || p.comfortEyes));
        document.body.classList.toggle('ui-comfort-eyes', !!p.comfortEyes);

        UPDATE_WARM_OVERLAY(p.warmFilter || 0);
    }

    // --- 2. ОБНОВЛЁННОЕ СПОКОЙНОЕ ОКНО НАСТРОЕК ---
    function ENSURE_SETTINGS_MODAL() {
        let m = document.getElementById('ui-settings-modal');
        if (m) return m;
        m = document.createElement('div');
        m.className = 'modal';
        m.id = 'ui-settings-modal';
        m.style.zIndex = '95500';
        m.innerHTML = `<div class="modal-content" id="ui-settings-content" style="max-width:740px; width:95%;"></div>`;
        m.addEventListener('click', (e) => { if (e.target === m) m.classList.remove('active'); });
        document.body.appendChild(m);
        return m;
    }

    window.OPEN_UI_SETTINGS_MODAL = function() {
        ENSURE_SETTINGS_MODAL();
        window.RENDER_UI_SETTINGS_MODAL();
        OM('ui-settings-modal');
    };

    window.SET_UI_SETTINGS_TAB = function(tab) {
        window._uiSettingsTab = tab;
        window.RENDER_UI_SETTINGS_MODAL();
    };

    window.SET_UI_PREF = function(key, val) {
        const p = GET_PREFS();
        p[key] = val;
        SAVE_PREFS(p);
        APPLY_UI_PREFS();
        window.RENDER_UI_SETTINGS_MODAL();
    };

    window.TOGGLE_COMFORT_EYES = function(enabled) {
        const p = GET_PREFS();
        p.comfortEyes = !!enabled;
        if (p.comfortEyes) {
            if (p.scale < 115) p.scale = 115;
            p.spacious = true;
            if (p.font === 'serif') p.font = 'wide';
        }
        SAVE_PREFS(p);
        APPLY_UI_PREFS();
        window.RENDER_UI_SETTINGS_MODAL();
    };

    window.RESET_UI_PREFS = function() {
        SAVE_PREFS(DEFAULT_PREFS);
        APPLY_UI_PREFS();
        window.RENDER_UI_SETTINGS_MODAL();
    };

    function BUILD_THEME_CARD(key, t, isSelected) {
        return `
            <button data-custom-bg="1" onclick="SET_UI_PREF('theme', '${key}')"
                style="background:${t.panel}; color:${t.text}; border:2px solid ${isSelected ? t.accent : t.border}; border-radius:10px; padding:9px 10px; text-align:left; display:flex; flex-direction:column; gap:7px; cursor:pointer; box-shadow:${isSelected ? '0 0 0 2px ' + t.accent + '44' : 'none'}; transition:transform 0.12s;">
                <!-- Мини-превью интерфейса -->
                <div style="background:${t.bg}; border:1px solid ${t.border}; border-radius:6px; padding:6px 8px; display:flex; justify-content:space-between; align-items:center; gap:6px;">
                    <div style="display:flex; flex-direction:column; gap:3px; flex:1;">
                        <div style="height:6px; width:72%; border-radius:3px; background:${t.accent}; opacity:0.9;"></div>
                        <div style="height:4px; width:92%; border-radius:2px; background:${t.text}; opacity:0.55;"></div>
                    </div>
                    <span style="background:${t.panel2}; color:${t.text}; border:1px solid ${t.border}; border-radius:4px; padding:1px 6px; font-size:0.74rem; font-weight:bold;">Аа</span>
                </div>
                <div style="display:flex; justify-content:space-between; align-items:center; gap:6px;">
                    <span style="font-size:0.84rem; font-weight:${isSelected ? '700' : '600'}; color:${t.text};">${t.icon} ${t.label}</span>
                    ${isSelected ? `<span style="color:${t.accent}; font-size:0.8rem;">●</span>` : ''}
                </div>
            </button>`;
    }

    window.RENDER_UI_SETTINGS_MODAL = function() {
        const cont = document.getElementById('ui-settings-content');
        if (!cont) return;
        const p = GET_PREFS();
        const curTheme = THEMES[p.theme] || THEMES.tavern;
        const tab = window._uiSettingsTab || 'themes';

        const tabBtn = (id, label) => {
            const act = (tab === id);
            return `
                <button data-custom-bg="1" onclick="SET_UI_SETTINGS_TAB('${id}')"
                    style="flex:1; padding:9px 12px; border-radius:8px; font-size:0.92rem; font-weight:600; cursor:pointer; background:${act ? 'var(--ui-panel2)' : 'transparent'}; color:${act ? 'var(--ui-accent)' : 'var(--ui-muted)'}; border:1px solid ${act ? 'var(--ui-border-strong)' : 'transparent'}; box-shadow:none;">
                    ${label}
                </button>`;
        };

        let bodyHTML = '';

        if (tab === 'themes') {
            const darkCards = Object.entries(THEMES)
                .filter(([, t]) => t.group === 'dark')
                .map(([k, t]) => BUILD_THEME_CARD(k, t, p.theme === k)).join('');
            const lightCards = Object.entries(THEMES)
                .filter(([, t]) => t.group === 'light')
                .map(([k, t]) => BUILD_THEME_CARD(k, t, p.theme === k)).join('');

            bodyHTML = `
                <div style="margin-bottom:14px;">
                    <div style="font-size:0.86rem; font-weight:600; color:var(--ui-muted); margin-bottom:8px;">
                        🌙 Тёмные матовые (для вечерних и долгих партий)
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(156px, 1fr)); gap:8px;">
                        ${darkCards}
                    </div>
                </div>
                <div>
                    <div style="font-size:0.86rem; font-weight:600; color:var(--ui-muted); margin-bottom:8px;">
                        ☀️ Светлые мягкие (без слепящего белого фона)
                    </div>
                    <div style="display:grid; grid-template-columns:repeat(auto-fill, minmax(156px, 1fr)); gap:8px;">
                        ${lightCards}
                    </div>
                </div>
            `;
        } else {
            const fontCards = Object.entries(FONTS).map(([k, f]) => {
                const act = (p.font === k);
                return `
                    <button data-custom-bg="1" onclick="SET_UI_PREF('font', '${k}')"
                        style="background:var(--ui-panel2); color:var(--ui-text); border:2px solid ${act ? 'var(--ui-accent)' : 'var(--ui-border)'}; border-radius:9px; padding:10px 12px; text-align:left; cursor:pointer; box-shadow:none; font-family:${f.family};">
                        <div style="font-weight:700; font-size:0.9rem; color:${act ? 'var(--ui-accent)' : 'var(--ui-text)'};">${f.label}</div>
                        <div style="font-size:0.8rem; color:var(--ui-muted); margin-top:2px;">${f.sample}</div>
                    </button>`;
            }).join('');

            const warmBtns = WARM_LEVELS.map(w => {
                const act = (p.warmFilter || 0) === w.val;
                return `
                    <button data-custom-bg="1" onclick="SET_UI_PREF('warmFilter', ${w.val})"
                        style="flex:1; padding:7px 6px; border-radius:7px; font-size:0.84rem; cursor:pointer; box-shadow:none; background:${act ? 'var(--ui-btn-bg)' : 'var(--ui-panel)'}; color:${act ? 'var(--ui-btn-text)' : 'var(--ui-text)'}; border:1px solid ${act ? 'var(--ui-accent)' : 'var(--ui-border)'};">
                        ${w.label}
                    </button>`;
            }).join('');

            bodyHTML = `
                <div style="display:flex; flex-direction:column; gap:12px;">
                    <!-- Мягкий комфортный режим -->
                    <div style="background:var(--ui-panel2); border:1px solid var(--ui-border); border-radius:10px; padding:12px 14px; display:flex; justify-content:space-between; align-items:center; gap:14px;">
                        <div>
                            <div style="font-weight:700; color:var(--ui-text);">👁️ Крупный комфортный режим</div>
                            <div style="font-size:0.83rem; color:var(--ui-muted); margin-top:2px;">
                                Увеличивает текст, добавляет воздух между буквами и строками, делает мелкие подписи чётче — сохраняя вашу спокойную палитру.
                            </div>
                        </div>
                        <label class="ui-switch">
                            <input type="checkbox" ${p.comfortEyes ? 'checked' : ''} onchange="TOGGLE_COMFORT_EYES(this.checked)">
                            <span class="ui-switch-slider"></span>
                        </label>
                    </div>

                    <!-- Тёплый фильтр (анти-синий) -->
                    <div style="background:var(--ui-panel2); border:1px solid var(--ui-border); border-radius:10px; padding:12px 14px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; gap:8px; flex-wrap:wrap;">
                            <span style="font-weight:700;">🌡️ Тёплый фильтр (снимает усталость глаз)</span>
                            <span style="font-size:0.8rem; color:var(--ui-muted);">Приглушает холодный синий свет экрана</span>
                        </div>
                        <div style="display:flex; gap:6px;">${warmBtns}</div>
                    </div>

                    <!-- Масштаб текста -->
                    <div style="background:var(--ui-panel2); border:1px solid var(--ui-border); border-radius:10px; padding:12px 14px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; margin-bottom:8px;">
                            <span style="font-weight:700;">🔍 Масштаб текста</span>
                            <span style="color:var(--ui-accent); font-weight:700;">${p.scale}%</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <button class="btn-small" style="padding:4px 11px;" onclick="SET_UI_PREF('scale', Math.max(85, ${p.scale} - 5))">A−</button>
                            <input type="range" min="85" max="135" step="5" value="${p.scale}"
                                oninput="SET_UI_PREF('scale', parseInt(this.value))" style="flex:1;">
                            <button class="btn-small" style="padding:4px 11px;" onclick="SET_UI_PREF('scale', Math.min(135, ${p.scale} + 5))">A+</button>
                        </div>
                    </div>

                    <!-- Шрифт -->
                    <div>
                        <div style="font-size:0.86rem; font-weight:600; color:var(--ui-muted); margin-bottom:7px;">🔤 Шрифт</div>
                        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:8px;">
                            ${fontCards}
                        </div>
                    </div>

                    <!-- Просторная вёрстка -->
                    <div style="background:var(--ui-panel2); border:1px solid var(--ui-border); border-radius:10px; padding:11px 14px; display:flex; justify-content:space-between; align-items:center; gap:14px;">
                        <div>
                            <div style="font-weight:600;">🌿 Просторные отступы</div>
                            <div style="font-size:0.82rem; color:var(--ui-muted);">Больше свободного места между панелями и строками</div>
                        </div>
                        <label class="ui-switch">
                            <input type="checkbox" ${p.spacious ? 'checked' : ''} onchange="SET_UI_PREF('spacious', this.checked)">
                            <span class="ui-switch-slider"></span>
                        </label>
                    </div>
                </div>
            `;
        }

        // Живой мини-предпросмотр внизу окна настроек
        const livePreviewHTML = `
            <div style="margin-top:14px; background:var(--ui-panel2); border:1px solid var(--ui-border); border-radius:10px; padding:10px 13px; text-align:left;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">
                    <b style="color:var(--ui-accent); font-size:0.92rem;">⚔️ Предпросмотр: ${curTheme.icon} ${curTheme.label}</b>
                    <span style="font-size:0.78rem; color:var(--ui-muted);">ХП 24/24 • КБ 15</span>
                </div>
                <div style="font-size:0.88rem; color:var(--ui-text);">
                    «В таверне тихо потрескивает очаг, а на карте отмечена новая тропа через лес.»
                </div>
            </div>
        `;

        cont.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; margin-bottom:12px;">
                <h2 style="margin:0; border:none; padding:0; font-size:1.25rem;">⚙️ Настройки вида</h2>
                <button data-custom-bg="1" onclick="CM('ui-settings-modal')"
                    style="background:transparent; color:var(--ui-muted); border:1px solid var(--ui-border); padding:4px 10px; border-radius:7px; box-shadow:none;">✕</button>
            </div>

            <!-- Переключатель вкладок -->
            <div style="display:flex; gap:6px; background:var(--ui-bg); border:1px solid var(--ui-border); border-radius:10px; padding:4px; margin-bottom:14px;">
                ${tabBtn('themes', '🎨 Палитры (12)')}
                ${tabBtn('eyes', '👁️ Текст и комфорт глаз')}
            </div>

            <div style="max-height:54vh; overflow-y:auto; padding-right:2px; text-align:left;">
                ${bodyHTML}
            </div>

            ${livePreviewHTML}

            <div style="display:flex; justify-content:space-between; align-items:center; margin-top:14px; gap:10px;">
                <button data-custom-bg="1" class="btn-small" onclick="RESET_UI_PREFS()"
                    style="background:transparent; color:var(--ui-muted); border:1px solid var(--ui-border); box-shadow:none;">
                    🔄 Сбросить по умолчанию
                </button>
                <button class="btn-save" onclick="CM('ui-settings-modal')">✅ Готово</button>
            </div>
        `;
    };

    // --- 3. КНОПКА «⚙️» В ПРАВОМ ВЕРХНЕМ УГЛУ ---
    function CREATE_GEAR_BTN(label = '⚙️') {
        const b = document.createElement('button');
        b.className = 'btn-small';
        b.setAttribute('data-ui-settings-btn', '1');
        b.title = 'Настройки палитры, шрифта и комфорта для глаз';
        b.textContent = label;
        b.onclick = () => window.OPEN_UI_SETTINGS_MODAL();
        return b;
    }

    function INJECT_SETTINGS_BUTTONS() {
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

        const lobby = document.getElementById('lobby-screen');
        if (lobby && lobby.style.display !== 'none') {
            const logoutBtn = lobby.querySelector('button[onclick="LOGOUT_ACCOUNT()"]');
            if (logoutBtn && logoutBtn.parentElement) {
                logoutBtn.parentElement.querySelectorAll('[data-ui-settings-btn]').forEach(el => el.remove());
                logoutBtn.parentElement.appendChild(CREATE_GEAR_BTN('⚙️ Вид'));
            }
        }

        const authPanel = document.querySelector('#auth-overlay-screen .panel');
        if (authPanel && !authPanel.querySelector('[data-ui-settings-btn]')) {
            const b = CREATE_GEAR_BTN('⚙️ Настройки вида и шрифта');
            b.style.cssText = 'width:100%; margin-top:8px; padding:8px;';
            authPanel.appendChild(b);
        }
    }

    // --- 4. МОБИЛЬНАЯ ПАНЕЛЬ ВКЛАДОК ---
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
        if (inRoom) document.body.classList.add('mob-tab-' + (window._mobRoomTab || 'center'));

        let nav = document.getElementById('mobile-room-nav');
        if (!inRoom) { if (nav) nav.remove(); return; }
        if (!nav) {
            nav = document.createElement('div');
            nav.id = 'mobile-room-nav';
            document.body.appendChild(nav);
        }

        const isGM = sess.role === 'gm';
        const cur = window._mobRoomTab || 'center';
        const btnStyle = (act) => act
            ? 'background:var(--ui-btn-bg); color:var(--ui-btn-text); border:1px solid var(--ui-accent);'
            : 'background:var(--ui-panel2); color:var(--ui-text); border:1px solid var(--ui-border);';

        nav.innerHTML = `
            <button data-custom-bg="1" style="${btnStyle(cur==='left')}" onclick="SET_MOBILE_ROOM_TAB('left')">${isGM ? '👑 Пульт' : '⚔️ Герой'}</button>
            <button data-custom-bg="1" style="${btnStyle(cur==='center')}" onclick="SET_MOBILE_ROOM_TAB('center')">🗺️ Карта</button>
            <button data-custom-bg="1" style="${btnStyle(cur==='right')}" onclick="SET_MOBILE_ROOM_TAB('right')">💬 Чат</button>
            <button data-custom-bg="1" style="background:var(--ui-panel2); color:var(--ui-accent); border:1px solid var(--ui-border-strong);" onclick="if(window.TOGGLE_DM_WIDGET) TOGGLE_DM_WIDGET();">✉️ Личка</button>
        `;
    }

    // --- 5. ХУКИ ---
    const _ORIG_AUTH_UI = window.RENDER_AUTH_SCREEN;
    if (typeof _ORIG_AUTH_UI === 'function') {
        window.RENDER_AUTH_SCREEN = function() { _ORIG_AUTH_UI(); INJECT_SETTINGS_BUTTONS(); };
    }

    const _ORIG_LOBBY_UI = window.RENDER_LOBBY_HTML;
    if (typeof _ORIG_LOBBY_UI === 'function') {
        window.RENDER_LOBBY_HTML = function() { _ORIG_LOBBY_UI(); INJECT_SETTINGS_BUTTONS(); };
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