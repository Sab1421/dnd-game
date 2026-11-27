// ================================================================
// 🎨 ВСТРОЕННЫЙ КОНСТРУКТОР ПОРТРЕТОВ NPC (vn_portrait_maker.js)
// Встроенные слои/ассеты • 8 архетипов • Автогенерация всех 6 эмоций
// Прозрачный фон для Визуальной Новеллы • Сохранение рецепта в Firebase
// ================================================================
(function INIT_VN_PORTRAIT_MAKER() {
    const FB_ROOMS_URL = "https://dnds-23b7d-default-rtdb.firebaseio.com/campaign_v2/rooms";

    const EMOTIONS = [
        { id: 'neutral',   icon: '😐', label: 'Спокойный' },
        { id: 'happy',     icon: '😊', label: 'Радостный' },
        { id: 'angry',     icon: '😠', label: 'Злой' },
        { id: 'surprised', icon: '😮', label: 'Удивлённый' },
        { id: 'sad',       icon: '😢', label: 'Грустный' },
        { id: 'smug',      icon: '😏', label: 'Хитрый' }
    ];

    const RACES = [
        { id: 'human',    label: 'Человек' },
        { id: 'elf',      label: 'Эльф' },
        { id: 'dwarf',    label: 'Дварф' },
        { id: 'orc',      label: 'Орк' },
        { id: 'tiefling', label: 'Тифлинг' },
        { id: 'undead',   label: 'Нежить' }
    ];

    const SKIN_TONES = [
        { id: 'fair',   hex: '#f1d3bd', shade: '#d4ab8e', label: 'Светлая' },
        { id: 'warm',   hex: '#dfb08c', shade: '#bd8761', label: 'Тёплая' },
        { id: 'tan',    hex: '#c38b63', shade: '#9b6440', label: 'Смуглая' },
        { id: 'deep',   hex: '#7d523a', shade: '#593724', label: 'Тёмная' },
        { id: 'pale',   hex: '#e7e1dc', shade: '#c2b9b2', label: 'Бледная' },
        { id: 'orc',    hex: '#7d9868', shade: '#597248', label: 'Оливковая' },
        { id: 'crimson',hex: '#b85353', shade: '#8a3535', label: 'Багровая' },
        { id: 'dusk',   hex: '#897499', shade: '#635073', label: 'Лиловая' },
        { id: 'ash',    hex: '#8e8b88', shade: '#686562', label: 'Пепельная' },
        { id: 'ghost',  hex: '#b8cdd0', shade: '#87a1a6', label: 'Призрачная' }
    ];

    const HAIR_COLORS = [
        { id: 'black',   hex: '#221f21', hi: '#443e42' },
        { id: 'brown',   hex: '#573b27', hi: '#7c573c' },
        { id: 'chestnut',hex: '#7c4328', hi: '#a6603e' },
        { id: 'blonde',  hex: '#d2ae66', hi: '#edd295' },
        { id: 'ginger',  hex: '#b54d24', hi: '#de7345' },
        { id: 'silver',  hex: '#cfd3da', hi: '#eff2f7' },
        { id: 'white',   hex: '#e9e6df', hi: '#ffffff' },
        { id: 'crimson', hex: '#7a252d', hi: '#a83b45' },
        { id: 'navy',    hex: '#243552', hi: '#3f5a87' },
        { id: 'emerald', hex: '#265341', hi: '#3d7d63' }
    ];

    const EYE_COLORS = [
        { id: 'brown',  hex: '#634128' },
        { id: 'green',  hex: '#4e8a52' },
        { id: 'blue',   hex: '#467cb0' },
        { id: 'gray',   hex: '#7f8c94' },
        { id: 'amber',  hex: '#c98a2c' },
        { id: 'red',    hex: '#c43b3b' },
        { id: 'violet', hex: '#8856b8' },
        { id: 'gold',   hex: '#f2c94c', glow: true },
        { id: 'cyan',   hex: '#5ce1e6', glow: true },
        { id: 'white',  hex: '#edf2f4', glow: true }
    ];

    const OUTFIT_COLORS = [
        { id: 'charcoal', hex: '#383431', trim: '#b8985f' },
        { id: 'crimson',  hex: '#6e2629', trim: '#d2b278' },
        { id: 'forest',   hex: '#2c4c34', trim: '#a68b5b' },
        { id: 'navy',     hex: '#253754', trim: '#c7b07b' },
        { id: 'purple',   hex: '#472c59', trim: '#d2b278' },
        { id: 'leather',  hex: '#664329', trim: '#c4a168' },
        { id: 'steel',    hex: '#596169', trim: '#cfd6dc' },
        { id: 'ivory',    hex: '#cfc6b6', trim: '#a88446' }
    ];

    const HAIRSTYLES = [
        { id: 'short',   label: 'Короткая' },
        { id: 'long',    label: 'Длинные' },
        { id: 'wavy',    label: 'Волнистые' },
        { id: 'bob',     label: 'Каре' },
        { id: 'bun',     label: 'Пучок' },
        { id: 'messy',   label: 'Растрёпанная' },
        { id: 'braids',  label: 'Косы' },
        { id: 'mohawk',  label: 'Боевая' },
        { id: 'side',    label: 'На бок' },
        { id: 'bald',    label: 'Лысый' }
    ];

    const BEARDS = [
        { id: 'none',    label: 'Нет' },
        { id: 'stubble', label: 'Щетина' },
        { id: 'short',   label: 'Короткая' },
        { id: 'dwarf',   label: 'Пышная' },
        { id: 'goatee',  label: 'Эспаньолка' },
        { id: 'stache',  label: 'Усы' }
    ];

    const OUTFITS = [
        { id: 'tunic',   label: 'Туника' },
        { id: 'cloak',   label: 'Плащ' },
        { id: 'leather', label: 'Кож. броня' },
        { id: 'plate',   label: 'Латы' },
        { id: 'mage',    label: 'Мантия мага' },
        { id: 'noble',   label: 'Камзол' },
        { id: 'apron',   label: 'Фартук' },
        { id: 'cult',    label: 'Балахон' }
    ];

    const HATS = [
        { id: 'none',    label: 'Нет' },
        { id: 'hood',    label: 'Капюшон' },
        { id: 'wizard',  label: 'Шляпа мага' },
        { id: 'helmet',  label: 'Шлем' },
        { id: 'crown',   label: 'Корона' },
        { id: 'bandana', label: 'Повязка' },
        { id: 'ranger',  label: 'Шляпа' }
    ];

    const DETAILS = [
        { id: 'none',     label: 'Нет' },
        { id: 'scar',     label: 'Шрам' },
        { id: 'eyepatch', label: 'Повязка на глаз' },
        { id: 'glasses',  label: 'Очки' },
        { id: 'freckles', label: 'Веснушки' },
        { id: 'warpaint', label: 'Раскраска' },
        { id: 'runes',    label: 'Руны' }
    ];

    const BACKDROPS = [
        { id: 'none',    label: 'Прозрачный' },
        { id: 'tavern',  label: '🍺 Таверна',    c1: '#4d2f1a', c2: '#1a110b' },
        { id: 'forest',  label: '🌲 Лес',        c1: '#1e3a28', c2: '#0d1812' },
        { id: 'castle',  label: '🏰 Замок',      c1: '#303440', c2: '#14161c' },
        { id: 'arcane',  label: '✨ Магия',      c1: '#3b2454', c2: '#140c1f' },
        { id: 'crimson', label: '⚔️ Битва',      c1: '#4f1e1e', c2: '#1a0c0c' }
    ];

    const PRESETS = [
        { label: '🍺 Трактирщик',  r: { race: 'dwarf', build: 'masc', skin: 'warm', hair: 'short', hairCol: 'chestnut', beard: 'dwarf', eyeCol: 'brown', outfit: 'apron', outfitCol: 'leather', hat: 'none', detail: 'freckles', bg: 'none' } },
        { label: '⚔️ Рыцарь',      r: { race: 'human', build: 'masc', skin: 'fair', hair: 'side', hairCol: 'brown', beard: 'stubble', eyeCol: 'gray', outfit: 'plate', outfitCol: 'steel', hat: 'none', detail: 'scar', bg: 'none' } },
        { label: '🧙 Архимаг',     r: { race: 'human', build: 'masc', skin: 'pale', hair: 'long', hairCol: 'silver', beard: 'dwarf', eyeCol: 'cyan', outfit: 'mage', outfitCol: 'navy', hat: 'wizard', detail: 'runes', bg: 'none' } },
        { label: '🧝 Следопыт',    r: { race: 'elf', build: 'fem', skin: 'fair', hair: 'braids', hairCol: 'blonde', beard: 'none', eyeCol: 'green', outfit: 'cloak', outfitCol: 'forest', hat: 'hood', detail: 'freckles', bg: 'none' } },
        { label: '😈 Тифлинг-плут',r: { race: 'tiefling', build: 'fem', skin: 'crimson', hair: 'bob', hairCol: 'black', beard: 'none', eyeCol: 'gold', outfit: 'leather', outfitCol: 'charcoal', hat: 'none', detail: 'scar', bg: 'none' } },
        { label: '👹 Орк-воин',    r: { race: 'orc', build: 'masc', skin: 'orc', hair: 'mohawk', hairCol: 'black', beard: 'short', eyeCol: 'amber', outfit: 'plate', outfitCol: 'crimson', hat: 'none', detail: 'warpaint', bg: 'none' } },
        { label: '👑 Аристократ',  r: { race: 'elf', build: 'fem', skin: 'pale', hair: 'bun', hairCol: 'white', beard: 'none', eyeCol: 'violet', outfit: 'noble', outfitCol: 'purple', hat: 'crown', detail: 'none', bg: 'none' } },
        { label: '🕯️ Незнакомец',  r: { race: 'undead', build: 'masc', skin: 'ash', hair: 'bald', hairCol: 'black', beard: 'none', eyeCol: 'cyan', outfit: 'cult', outfitCol: 'charcoal', hat: 'hood', detail: 'runes', bg: 'none' } }
    ];

    window._vnpState = {
        artMode: 'builder',   // 'builder' | 'upload'
        catTab: 'face',       // 'face' | 'hair' | 'outfit' | 'details'
        previewEmo: 'neutral',
        dirty: false,
        recipe: null,
        boundDraftRef: null
    };

    const ESC = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const CUR_ROOM = () => { const s = (typeof GET_SESSION === 'function') ? GET_SESSION() : null; return (s && s.roomCode) ? String(s.roomCode) : null; };

    function DEFAULT_RECIPE() {
        return {
            race: 'human', build: 'masc', skin: 'warm',
            hair: 'short', hairCol: 'brown', beard: 'none',
            eyeCol: 'brown', outfit: 'cloak', outfitCol: 'charcoal',
            hat: 'none', detail: 'none', bg: 'none'
        };
    }

    function ENSURE_RECIPE_FOR_DRAFT() {
        const draft = window._vnUi && window._vnUi.draft;
        if (!draft) return DEFAULT_RECIPE();
        if (window._vnpState.boundDraftRef !== draft) {
            window._vnpState.boundDraftRef = draft;
            window._vnpState.dirty = false;
            window._vnpState.previewEmo = 'neutral';
            window._vnpState.recipe = draft.portraitRecipe
                ? Object.assign(DEFAULT_RECIPE(), JSON.parse(JSON.stringify(draft.portraitRecipe)))
                : DEFAULT_RECIPE();
            // Если у NPC уже загружены свои фото без рецепта конструктора — открываем режим фото, иначе конструктор
            const hasManualArt = !!(draft.avatar && !draft.portraitRecipe);
            window._vnpState.artMode = hasManualArt ? 'upload' : 'builder';
        }
        return window._vnpState.recipe;
    }

    // --- 1. ГЕНЕРАТОР СТИЛИЗОВАННОГО ФЭНТЕЗИ-ПОРТРЕТА (SVG) ---
    function BUILD_PORTRAIT_SVG(rec, emotionId = 'neutral') {
        const skin = SKIN_TONES.find(x => x.id === rec.skin) || SKIN_TONES[1];
        const hair = HAIR_COLORS.find(x => x.id === rec.hairCol) || HAIR_COLORS[1];
        const eye  = EYE_COLORS.find(x => x.id === rec.eyeCol) || EYE_COLORS[0];
        const outf = OUTFIT_COLORS.find(x => x.id === rec.outfitCol) || OUTFIT_COLORS[0];
        const bg   = BACKDROPS.find(x => x.id === rec.bg) || BACKDROPS[0];

        const isFem = rec.build === 'fem';
        const isDwarf = rec.race === 'dwarf';
        const isOrc = rec.race === 'orc';
        const isElf = rec.race === 'elf';
        const isTief = rec.race === 'tiefling';
        const isUndead = rec.race === 'undead';

        const uid = 'p' + Math.abs((rec.race + rec.skin + rec.outfit + emotionId).split('').reduce((a, c) => ((a << 5) - a) + c.charCodeAt(0), 0) % 99999);
        const sW = isDwarf ? 124 : (isFem ? 92 : 112);

        // Фон-медальон (если не прозрачный)
        const bgLayer = (bg.id !== 'none')
            ? `<defs><radialGradient id="bg_${uid}" cx="50%" cy="42%" r="55%"><stop offset="0%" stop-color="${bg.c1}"/><stop offset="100%" stop-color="${bg.c2}"/></radialGradient></defs>
               <rect x="8" y="8" width="304" height="344" rx="26" fill="url(#bg_${uid})" stroke="#c9a96e" stroke-width="3" stroke-opacity="0.65"/>`
            : '';

        // Задний слой капюшона / шляпы
        let hatBack = '';
        if (rec.hat === 'hood') {
            hatBack = `<path d="M72 195 Q68 85 160 66 Q252 85 248 195 L234 252 L86 252 Z" fill="${outf.hex}" stroke="#120f0d" stroke-width="2.5"/>
                       <path d="M84 196 Q84 96 160 80 Q236 96 236 196 Z" fill="#120f0d" opacity="0.58"/>`;
        } else if (rec.hat === 'wizard') {
            hatBack = `<ellipse cx="160" cy="112" rx="112" ry="26" fill="${outf.hex}" stroke="#120f0d" stroke-width="2.5"/>`;
        } else if (rec.hat === 'ranger') {
            hatBack = `<ellipse cx="160" cy="108" rx="102" ry="22" fill="${outf.hex}" stroke="#120f0d" stroke-width="2.5"/>`;
        }

        // Задний слой волос (за шеей и плечами)
        let hairBack = '';
        if (rec.hat !== 'helmet') {
            if (rec.hair === 'long') {
                hairBack = `<path d="M92 145 Q84 220 90 292 L230 292 Q236 220 228 145 Q222 86 160 84 Q98 86 92 145 Z" fill="${hair.hex}" stroke="#120f0d" stroke-width="2.2"/>`;
            } else if (rec.hair === 'wavy') {
                hairBack = `<path d="M90 140 Q74 185 88 232 Q76 268 96 294 L224 294 Q244 268 232 232 Q246 185 230 140 Q222 84 160 82 Q98 84 90 140 Z" fill="${hair.hex}" stroke="#120f0d" stroke-width="2.2"/>`;
            } else if (rec.hair === 'bob') {
                hairBack = `<path d="M93 142 Q86 198 100 228 L220 228 Q234 198 227 142 Q220 88 160 86 Q100 88 93 142 Z" fill="${hair.hex}" stroke="#120f0d" stroke-width="2.2"/>`;
            } else if (rec.hair === 'bun') {
                hairBack = `<circle cx="160" cy="70" r="30" fill="${hair.hex}" stroke="#120f0d" stroke-width="2.2"/>
                            <path d="M138 74 Q160 62 182 74" fill="none" stroke="${outf.trim}" stroke-width="4" stroke-linecap="round"/>`;
            } else if (rec.hair === 'braids') {
                hairBack = `<path d="M96 150 Q86 220 96 290 L118 290 Q114 220 116 150 Z" fill="${hair.hex}" stroke="#120f0d" stroke-width="2"/>
                            <path d="M224 150 Q234 220 224 290 L202 290 Q206 220 204 150 Z" fill="${hair.hex}" stroke="#120f0d" stroke-width="2"/>
                            <circle cx="106" cy="272" r="5" fill="${outf.trim}"/><circle cx="214" cy="272" r="5" fill="${outf.trim}"/>`;
            }
        }

        // Рога Тифлинга (позади передних волос, но поверх капюшона)
        let hornsLayer = '';
        if (isTief) {
            hornsLayer = `
                <path d="M116 112 Q88 90 78 52 Q96 74 114 86 Q122 92 126 104 Z" fill="#3a2c2b" stroke="#120f0d" stroke-width="2.2"/>
                <path d="M204 112 Q232 90 242 52 Q224 74 206 86 Q198 92 194 104 Z" fill="#3a2c2b" stroke="#120f0d" stroke-width="2.2"/>
                <path d="M92 75 Q102 82 110 88 M228 75 Q218 82 210 88" stroke="#66504e" stroke-width="2" fill="none"/>`;
        }

        // Шея и плечи / одежда
        const neckW = isFem ? 20 : (isDwarf ? 29 : 25);
        let bodyLayer = `
            <path d="M${160 - neckW} 214 L${160 - neckW - 4} 266 L${160 + neckW + 4} 266 L${160 + neckW} 214 Z" fill="${skin.shade}" stroke="#120f0d" stroke-width="2"/>
            <path d="M${160 - sW} 352 C${160 - sW} 282 ${160 - sW + 24} 254 ${160 - neckW - 6} 248 L${160 + neckW + 6} 248 C${160 + sW - 24} 254 ${160 + sW} 282 ${160 + sW} 352 Z"
                  fill="${outf.hex}" stroke="#120f0d" stroke-width="2.5"/>`;

        if (rec.outfit === 'cloak') {
            bodyLayer += `
                <path d="M${160 - sW - 4} 352 C${160 - sW} 286 108 256 128 244 L160 274 L192 244 C212 256 ${160 + sW} 286 ${160 + sW + 4} 352 Z" fill="${outf.hex}" stroke="#120f0d" stroke-width="2.4"/>
                <path d="M124 252 Q160 286 196 252" fill="none" stroke="${outf.trim}" stroke-width="4"/>
                <circle cx="160" cy="272" r="9" fill="${outf.trim}" stroke="#120f0d" stroke-width="2"/>`;
        } else if (rec.outfit === 'plate') {
            bodyLayer += `
                <path d="M${160 - sW - 6} 296 Q${160 - sW + 14} 246 122 250 L118 296 Z" fill="#7c858f" stroke="#120f0d" stroke-width="2.4"/>
                <path d="M${160 + sW + 6} 296 Q${160 + sW - 14} 246 198 250 L202 296 Z" fill="#7c858f" stroke="#120f0d" stroke-width="2.4"/>
                <path d="M116 254 L160 284 L204 254 L214 352 L106 352 Z" fill="#6b747e" stroke="#120f0d" stroke-width="2.2"/>
                <path d="M160 284 L160 352 M122 260 L160 286 L198 260" stroke="${outf.trim}" stroke-width="3" fill="none"/>`;
        } else if (rec.outfit === 'leather') {
            bodyLayer += `
                <path d="M126 248 L160 292 L194 248" fill="#1e1916" stroke="#120f0d" stroke-width="2"/>
                <path d="M118 258 L208 352" stroke="#362417" stroke-width="14"/>
                <path d="M118 258 L208 352" stroke="${outf.trim}" stroke-width="2" stroke-dasharray="6 10"/>`;
        } else if (rec.outfit === 'mage') {
            bodyLayer += `
                <path d="M124 246 L160 300 L196 246 L216 254 L172 352 L148 352 L104 254 Z" fill="${outf.trim}" opacity="0.88" stroke="#120f0d" stroke-width="2"/>
                <path d="M132 248 L160 290 L188 248" fill="#1b1822" stroke="#120f0d" stroke-width="2"/>
                <circle cx="160" cy="316" r="7" fill="#5ce1e6" stroke="#120f0d" stroke-width="1.6"/>`;
        } else if (rec.outfit === 'noble') {
            bodyLayer += `
                <path d="M126 246 L160 296 L194 246 Z" fill="#ede7dc" stroke="#120f0d" stroke-width="2"/>
                <path d="M118 248 L152 294 L142 352 M202 248 L168 294 L178 352" stroke="${outf.trim}" stroke-width="4" fill="none"/>
                <circle cx="160" cy="276" r="6" fill="#a83232" stroke="${outf.trim}" stroke-width="2"/>`;
        } else if (rec.outfit === 'apron') {
            bodyLayer += `
                <path d="M132 248 L160 282 L188 248 Z" fill="#ded6c8"/>
                <path d="M118 260 L124 352 L196 352 L202 260 L184 260 L180 288 L140 288 L136 260 Z" fill="#cbbda6" stroke="#120f0d" stroke-width="2.2"/>`;
        } else if (rec.outfit === 'cult') {
            bodyLayer += `
                <path d="M110 250 L160 320 L210 250" fill="none" stroke="${outf.trim}" stroke-width="3.5"/>
                <polygon points="160,280 172,306 148,306" fill="none" stroke="${outf.trim}" stroke-width="2.4"/>`;
        } else {
            bodyLayer += `<path d="M134 248 L160 286 L186 248" fill="${skin.shade}" stroke="#120f0d" stroke-width="2"/>`;
        }

        // Уши (обычные / острые эльфийские / орочьи)
        let earsLayer = '';
        if (isElf || isTief) {
            earsLayer = `
                <path d="M106 164 Q76 154 68 140 Q84 168 106 184 Z" fill="${skin.hex}" stroke="#120f0d" stroke-width="2"/>
                <path d="M214 164 Q244 154 252 140 Q236 168 214 184 Z" fill="${skin.hex}" stroke="#120f0d" stroke-width="2"/>`;
        } else if (isOrc) {
            earsLayer = `
                <path d="M104 164 Q82 158 78 148 Q88 172 106 184 Z" fill="${skin.hex}" stroke="#120f0d" stroke-width="2"/>
                <path d="M216 164 Q238 158 242 148 Q232 172 214 184 Z" fill="${skin.hex}" stroke="#120f0d" stroke-width="2"/>`;
        } else {
            earsLayer = `
                <ellipse cx="104" cy="174" rx="10" ry="16" fill="${skin.hex}" stroke="#120f0d" stroke-width="2"/>
                <ellipse cx="216" cy="174" rx="10" ry="16" fill="${skin.hex}" stroke="#120f0d" stroke-width="2"/>`;
        }

        // Голова с мягким объёмом
        const headPath = isFem
            ? 'M105 152 C105 104 128 88 160 88 C192 88 215 104 215 152 C215 198 188 232 160 236 C132 232 105 198 105 152 Z'
            : (isDwarf || isOrc
                ? 'M102 152 C102 104 126 88 160 88 C194 88 218 104 218 152 C218 198 202 234 160 238 C118 234 102 198 102 152 Z'
                : 'M104 152 C104 104 127 88 160 88 C193 88 216 104 216 152 C216 198 194 233 160 237 C126 233 104 198 104 152 Z');

        const headLayer = `
            <defs>
                <radialGradient id="sk_${uid}" cx="42%" cy="38%" r="62%">
                    <stop offset="0%" stop-color="${skin.hex}"/>
                    <stop offset="100%" stop-color="${skin.shade}"/>
                </radialGradient>
            </defs>
            <path d="${headPath}" fill="url(#sk_${uid})" stroke="#120f0d" stroke-width="2.4"/>
            ${isUndead ? `<ellipse cx="136" cy="166" rx="16" ry="12" fill="#17141a" opacity="0.62"/><ellipse cx="184" cy="166" rx="16" ry="12" fill="#17141a" opacity="0.62"/>` : ''}
            ${emotionId === 'happy' ? `<ellipse cx="124" cy="186" rx="12" ry="6" fill="#d96b6b" opacity="0.22"/><ellipse cx="196" cy="186" rx="12" ry="6" fill="#d96b6b" opacity="0.22"/>` : ''}
            ${emotionId === 'angry' ? `<path d="M108 118 Q160 132 212 118 L212 156 L108 156 Z" fill="#3a1010" opacity="0.22"/>` : ''}`;

        // Нос
        const noseLayer = `<path d="M160 162 L156 184 Q160 189 166 184" fill="none" stroke="${skin.shade}" stroke-width="2.6" stroke-linecap="round"/>
                           <path d="M155 186 Q160 190 165 186" fill="none" stroke="#120f0d" stroke-width="1.4" opacity="0.45"/>`;

        // Глаза и брови (меняются под каждую из 6 эмоций!)
        const eyeH = emotionId === 'surprised' ? 11.5 : (emotionId === 'angry' ? 7 : (emotionId === 'smug' ? 7.5 : (emotionId === 'happy' ? 8 : 9.5)));
        const pupilR = emotionId === 'surprised' ? 3.2 : 4.2;
        const irisR = emotionId === 'surprised' ? 6.5 : 7.4;
        const scleraFill = isUndead ? '#1c1821' : '#f4f0e8';

        const drawEye = (cx) => {
            if (emotionId === 'happy' && isFem) {
                return `<path d="M${cx - 12} 167 Q${cx} 157 ${cx + 12} 167" fill="none" stroke="#171412" stroke-width="3.2" stroke-linecap="round"/>`;
            }
            const clip = emotionId === 'angry' || emotionId === 'smug'
                ? `<rect x="${cx - 15}" y="152" width="30" height="${emotionId === 'angry' ? 11 : 10}" fill="${skin.hex}"/>`
                : '';
            return `
                <ellipse cx="${cx}" cy="166" rx="12.5" ry="${eyeH}" fill="${scleraFill}" stroke="#171412" stroke-width="1.8"/>
                <circle cx="${cx}" cy="166" r="${irisR}" fill="${eye.hex}"/>
                <circle cx="${cx}" cy="166" r="${pupilR}" fill="${eye.glow ? '#ffffff' : '#121010'}"/>
                <circle cx="${cx - 3}" cy="163" r="2.2" fill="#ffffff" opacity="0.9"/>
                ${clip}
                <path d="M${cx - 13} ${166 - eyeH * 0.4} Q${cx} ${166 - eyeH - 2} ${cx + 13} ${166 - eyeH * 0.4}" fill="none" stroke="#141110" stroke-width="${isFem ? 3 : 2.3}" stroke-linecap="round"/>`;
        };

        let brows = '';
        if (emotionId === 'angry') {
            brows = `<path d="M121 151 L149 159 M199 151 L171 159" stroke="${hair.hex}" stroke-width="4.4" stroke-linecap="round"/>`;
        } else if (emotionId === 'surprised') {
            brows = `<path d="M122 146 Q136 138 149 145 M171 145 Q184 138 198 146" fill="none" stroke="${hair.hex}" stroke-width="3.6" stroke-linecap="round"/>`;
        } else if (emotionId === 'sad') {
            brows = `<path d="M122 156 Q136 151 149 147 M171 147 Q184 151 198 156" fill="none" stroke="${hair.hex}" stroke-width="3.6" stroke-linecap="round"/>
                     <circle cx="127" cy="175" r="2.6" fill="#7dd3fc" opacity="0.82"/>`;
        } else if (emotionId === 'smug') {
            brows = `<path d="M122 154 Q136 151 149 154 M171 152 Q185 142 199 149" fill="none" stroke="${hair.hex}" stroke-width="3.8" stroke-linecap="round"/>`;
        } else if (emotionId === 'happy') {
            brows = `<path d="M122 150 Q136 144 149 149 M171 149 Q184 144 198 150" fill="none" stroke="${hair.hex}" stroke-width="3.6" stroke-linecap="round"/>`;
        } else {
            brows = `<path d="M122 153 Q136 149 149 152 M171 152 Q184 149 198 153" fill="none" stroke="${hair.hex}" stroke-width="3.8" stroke-linecap="round"/>`;
        }

        // Особые приметы на лице (под волосами)
        let detailLayer = '';
        if (rec.detail === 'scar') {
            detailLayer = `<path d="M130 144 L142 194" stroke="#8c3b3b" stroke-width="2.6" stroke-linecap="round" opacity="0.82"/>
                           <path d="M132 154 L138 152 M135 178 L141 176" stroke="#8c3b3b" stroke-width="1.4" opacity="0.7"/>`;
        } else if (rec.detail === 'freckles') {
            detailLayer = `<g fill="#8c5838" opacity="0.5"><circle cx="126" cy="182" r="1.4"/><circle cx="132" cy="185" r="1.4"/><circle cx="138" cy="181" r="1.3"/><circle cx="182" cy="181" r="1.3"/><circle cx="188" cy="185" r="1.4"/><circle cx="194" cy="182" r="1.4"/></g>`;
        } else if (rec.detail === 'warpaint') {
            detailLayer = `<path d="M112 178 L146 184 L112 188 Z M208 178 L174 184 L208 188 Z" fill="#9c2b2b" opacity="0.72"/>`;
        } else if (rec.detail === 'runes') {
            detailLayer = `<path d="M120 182 L126 194 L132 182 M188 182 L194 194 L200 182 M160 120 L155 132 L165 132 Z" fill="none" stroke="#5ce1e6" stroke-width="2" opacity="0.88"/>`;
        } else if (rec.detail === 'glasses') {
            detailLayer = `<g fill="rgba(210,235,255,0.14)" stroke="#c9a96e" stroke-width="2.4"><circle cx="136" cy="166" r="16"/><circle cx="184" cy="166" r="16"/><line x1="152" y1="166" x2="168" y2="166"/></g>`;
        } else if (rec.detail === 'eyepatch') {
            detailLayer = `<line x1="112" y1="138" x2="212" y2="178" stroke="#181412" stroke-width="4.5"/>
                           <path d="M120 156 Q136 150 151 158 Q151 178 135 178 Q120 176 120 156 Z" fill="#211c19" stroke="#c9a96e" stroke-width="1.6"/>`;
        }

        // Борода и рот
        let beardLayer = '';
        if (rec.beard === 'stubble') {
            beardLayer = `<path d="M108 184 C112 218 134 236 160 238 C186 236 208 218 212 184 C202 206 182 214 160 214 C138 214 118 206 108 184 Z" fill="${hair.hex}" opacity="0.28"/>`;
        } else if (rec.beard === 'short') {
            beardLayer = `<path d="M108 182 C110 222 132 242 160 245 C188 242 210 222 212 182 C202 198 186 202 160 202 C134 202 118 198 108 182 Z" fill="${hair.hex}" stroke="#120f0d" stroke-width="2"/>`;
        } else if (rec.beard === 'dwarf') {
            beardLayer = `<path d="M105 178 C100 236 116 286 160 302 C204 286 220 236 215 178 C202 196 184 202 160 202 C136 202 118 196 105 178 Z" fill="${hair.hex}" stroke="#120f0d" stroke-width="2.4"/>
                          <path d="M142 270 L178 270 M146 282 L174 282" stroke="${outf.trim}" stroke-width="3.5" stroke-linecap="round"/>`;
        } else if (rec.beard === 'goatee') {
            beardLayer = `<path d="M142 204 Q160 198 178 204 L172 242 Q160 248 148 242 Z" fill="${hair.hex}" stroke="#120f0d" stroke-width="1.8"/>`;
        } else if (rec.beard === 'stache') {
            beardLayer = `<path d="M160 198 Q144 190 128 204 Q142 208 160 203 Q178 208 192 204 Q176 190 160 198 Z" fill="${hair.hex}" stroke="#120f0d" stroke-width="1.6"/>`;
        }

        let mouthLayer = '';
        if (emotionId === 'happy') {
            mouthLayer = `<path d="M143 204 Q160 218 177 204" fill="#4f2222" stroke="#181210" stroke-width="2.2" stroke-linecap="round"/>
                          <path d="M147 205 Q160 211 173 205" fill="#f2ede4"/>`;
        } else if (emotionId === 'angry') {
            mouthLayer = `<path d="M144 212 Q160 202 176 212" fill="none" stroke="#181210" stroke-width="2.8" stroke-linecap="round"/>`;
        } else if (emotionId === 'surprised') {
            mouthLayer = `<ellipse cx="160" cy="209" rx="8" ry="10" fill="#4a2020" stroke="#181210" stroke-width="2.2"/>`;
        } else if (emotionId === 'sad') {
            mouthLayer = `<path d="M145 213 Q160 205 175 213" fill="none" stroke="#181210" stroke-width="2.4" stroke-linecap="round"/>`;
        } else if (emotionId === 'smug') {
            mouthLayer = `<path d="M146 208 Q163 212 178 201" fill="none" stroke="#181210" stroke-width="2.6" stroke-linecap="round"/>`;
        } else {
            mouthLayer = `<path d="M147 207 Q160 210 173 207" fill="none" stroke="#181210" stroke-width="2.3" stroke-linecap="round"/>`;
        }
        if (isOrc) {
            mouthLayer += `<polygon points="145,209 149,197 153,209" fill="#f0ead8" stroke="#120f0d" stroke-width="1.3"/>
                           <polygon points="167,209 171,197 175,209" fill="#f0ead8" stroke="#120f0d" stroke-width="1.3"/>`;
        }

        // Передний слой волос (чёлка и верх головы)
        let hairFront = '';
        if (rec.hair !== 'bald' && rec.hat !== 'helmet') {
            if (rec.hair === 'short' || rec.hair === 'bun') {
                hairFront = `<path d="M102 150 C100 94 128 76 160 76 C192 76 220 94 218 150 C210 120 192 108 160 110 C128 108 110 120 102 150 Z" fill="${hair.hex}" stroke="#120f0d" stroke-width="2.2"/>`;
            } else if (rec.hair === 'side') {
                hairFront = `<path d="M102 152 C100 92 128 76 162 76 C196 76 220 96 218 152 C206 116 178 106 132 126 C118 132 108 140 102 152 Z" fill="${hair.hex}" stroke="#120f0d" stroke-width="2.2"/>`;
            } else if (rec.hair === 'messy') {
                hairFront = `<path d="M100 152 C96 92 126 74 160 74 C194 74 224 92 220 152 L206 122 L192 136 L176 114 L158 138 L142 114 L124 136 L112 122 Z" fill="${hair.hex}" stroke="#120f0d" stroke-width="2.2"/>`;
            } else if (rec.hair === 'mohawk') {
                hairFront = `<path d="M142 118 L140 58 Q160 44 180 58 L178 118 Q160 108 142 118 Z" fill="${hair.hex}" stroke="#120f0d" stroke-width="2.2"/>`;
            } else {
                hairFront = `<path d="M101 154 C98 92 126 76 160 76 C194 76 222 92 219 154 C208 122 186 108 160 116 C134 108 112 122 101 154 Z" fill="${hair.hex}" stroke="#120f0d" stroke-width="2.2"/>`;
            }
            hairFront += `<path d="M126 96 Q160 84 194 96" fill="none" stroke="${hair.hi}" stroke-width="3" opacity="0.45" stroke-linecap="round"/>`;
        }

        // Передний слой головных уборов
        let hatFront = '';
        if (rec.hat === 'hood') {
            hatFront = `<path d="M80 182 Q78 82 160 66 Q242 82 240 182 Q226 112 160 96 Q94 112 80 182 Z" fill="${outf.hex}" stroke="#120f0d" stroke-width="2.4"/>`;
        } else if (rec.hat === 'wizard') {
            hatFront = `<path d="M98 110 L146 22 L198 48 L184 54 L222 110 Q160 124 98 110 Z" fill="${outf.hex}" stroke="#120f0d" stroke-width="2.4"/>
                        <path d="M104 108 Q160 120 216 108" fill="none" stroke="${outf.trim}" stroke-width="5"/>`;
        } else if (rec.hat === 'helmet') {
            hatFront = `<path d="M98 158 C96 86 126 68 160 68 C194 68 224 86 222 158 L208 134 L160 124 L112 134 Z" fill="#707882" stroke="#120f0d" stroke-width="2.5"/>
                        <path d="M160 68 L160 146" stroke="${outf.trim}" stroke-width="4"/>`;
        } else if (rec.hat === 'crown') {
            hatFront = `<path d="M112 106 L120 70 L142 92 L160 62 L178 92 L200 70 L208 106 Q160 116 112 106 Z" fill="#d9b25f" stroke="#120f0d" stroke-width="2.2"/>
                        <circle cx="160" cy="94" r="5" fill="#b83232"/>`;
        } else if (rec.hat === 'bandana') {
            hatFront = `<path d="M102 128 Q160 114 218 128 L216 110 Q160 96 104 110 Z" fill="${outf.hex}" stroke="#120f0d" stroke-width="2.2"/>`;
        } else if (rec.hat === 'ranger') {
            hatFront = `<path d="M106 106 L122 64 Q160 56 198 64 L214 106 Q160 118 106 106 Z" fill="${outf.hex}" stroke="#120f0d" stroke-width="2.4"/>
                        <path d="M108 104 Q160 116 212 104" fill="none" stroke="${outf.trim}" stroke-width="4.5"/>`;
        }

        return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 360" width="320" height="360">
            ${bgLayer}${hatBack}${hairBack}${hornsLayer}${bodyLayer}${earsLayer}${headLayer}${detailLayer}${noseLayer}${drawEye(136)}${drawEye(184)}${brows}${beardLayer}${mouthLayer}${hairFront}${hatFront}
        </svg>`;
    }

    function SVG_TO_DATA_URL(svgStr) {
        const bytes = unescape(encodeURIComponent(svgStr.replace(/\s+/g, ' ').trim()));
        return 'data:image/svg+xml;base64,' + btoa(bytes);
    }

    // --- 2. ОБРАБОТЧИКИ КОНСТРУКТОРА (ВСЕ НА WINDOW) ---
    window.VNP_SET_ART_MODE = function(mode) {
        window._vnpState.artMode = mode;
        if (typeof window.RENDER_NPC_STUDIO_MODAL === 'function') window.RENDER_NPC_STUDIO_MODAL();
    };

    window.VNP_SET_CAT_TAB = function(tab) {
        window._vnpState.catTab = tab;
        if (typeof window.RENDER_NPC_STUDIO_MODAL === 'function') window.RENDER_NPC_STUDIO_MODAL();
    };

    window.VNP_SET_PREVIEW_EMO = function(emoId) {
        window._vnpState.previewEmo = emoId;
        UPDATE_LIVE_PREVIEW_ONLY();
        document.querySelectorAll('[data-vnp-emo-btn]').forEach(b => {
            b.classList.toggle('is-active', b.getAttribute('data-vnp-emo-btn') === emoId);
        });
    };

    window.VNP_SET_OPT = function(field, val) {
        const rec = ENSURE_RECIPE_FOR_DRAFT();
        rec[field] = val;
        window._vnpState.dirty = true;
        if (window._vnUi && window._vnUi.draft) {
            window._vnUi.draft.portraitRecipe = JSON.parse(JSON.stringify(rec));
        }
        if (typeof window.RENDER_NPC_STUDIO_MODAL === 'function') window.RENDER_NPC_STUDIO_MODAL();
    };

    window.VNP_APPLY_PRESET = function(idx) {
        const p = PRESETS[idx];
        if (!p) return;
        window._vnpState.recipe = Object.assign(DEFAULT_RECIPE(), JSON.parse(JSON.stringify(p.r)));
        window._vnpState.dirty = true;
        if (window._vnUi && window._vnUi.draft) {
            window._vnUi.draft.portraitRecipe = JSON.parse(JSON.stringify(window._vnpState.recipe));
        }
        if (typeof window.RENDER_NPC_STUDIO_MODAL === 'function') window.RENDER_NPC_STUDIO_MODAL();
    };

    window.VNP_RANDOMIZE = function() {
        const pick = arr => arr[Math.floor(Math.random() * arr.length)].id;
        const build = Math.random() > 0.5 ? 'masc' : 'fem';
        const race = pick(RACES);
        const skin = race === 'orc' ? 'orc' : (race === 'tiefling' ? (Math.random() > 0.5 ? 'crimson' : 'dusk') : (race === 'undead' ? 'ghost' : pick(SKIN_TONES.slice(0, 5))));
        window._vnpState.recipe = {
            race, build, skin,
            hair: pick(HAIRSTYLES),
            hairCol: pick(HAIR_COLORS),
            beard: build === 'fem' ? 'none' : (race === 'dwarf' ? 'dwarf' : pick(BEARDS)),
            eyeCol: pick(EYE_COLORS),
            outfit: pick(OUTFITS),
            outfitCol: pick(OUTFIT_COLORS),
            hat: Math.random() > 0.55 ? pick(HATS) : 'none',
            detail: Math.random() > 0.5 ? pick(DETAILS) : 'none',
            bg: 'none'
        };
        window._vnpState.dirty = true;
        if (window._vnUi && window._vnUi.draft) {
            window._vnUi.draft.portraitRecipe = JSON.parse(JSON.stringify(window._vnpState.recipe));
        }
        if (typeof window.RENDER_NPC_STUDIO_MODAL === 'function') window.RENDER_NPC_STUDIO_MODAL();
    };

    window.VNP_GENERATE_ALL_EMOTIONS = function(silent = false) {
        const draft = window._vnUi && window._vnUi.draft;
        if (!draft) return;
        const rec = ENSURE_RECIPE_FOR_DRAFT();
        if (!draft.emotions) draft.emotions = {};
        EMOTIONS.forEach(em => {
            draft.emotions[em.id] = SVG_TO_DATA_URL(BUILD_PORTRAIT_SVG(rec, em.id));
        });
        draft.avatar = draft.emotions.neutral;
        draft.portraitRecipe = JSON.parse(JSON.stringify(rec));
        window._vnpState.dirty = false;
        if (!silent) {
            if (typeof window.RENDER_NPC_STUDIO_MODAL === 'function') window.RENDER_NPC_STUDIO_MODAL();
            const badge = document.getElementById('vnp-applied-badge');
            if (badge) {
                badge.textContent = '✅ Все 6 эмоций созданы! Нажмите «💾 Сохранить NPC» внизу.';
                badge.style.display = 'block';
            }
        }
    };

    window.VNP_GENERATE_SINGLE_EMOTION = function() {
        const draft = window._vnUi && window._vnUi.draft;
        if (!draft) return;
        const rec = ENSURE_RECIPE_FOR_DRAFT();
        const emo = window._vnpState.previewEmo || 'neutral';
        if (!draft.emotions) draft.emotions = {};
        draft.emotions[emo] = SVG_TO_DATA_URL(BUILD_PORTRAIT_SVG(rec, emo));
        if (emo === 'neutral' || !draft.avatar) draft.avatar = draft.emotions[emo];
        draft.portraitRecipe = JSON.parse(JSON.stringify(rec));
        window._vnpState.dirty = false;
        const badge = document.getElementById('vnp-applied-badge');
        if (badge) {
            const lbl = (EMOTIONS.find(e => e.id === emo) || EMOTIONS[0]).label;
            badge.textContent = `✅ Эмоция «${lbl}» обновлена!`;
            badge.style.display = 'block';
        }
    };

    function UPDATE_LIVE_PREVIEW_ONLY() {
        const box = document.getElementById('vnp-live-svg-box');
        if (!box) return;
        const rec = ENSURE_RECIPE_FOR_DRAFT();
        box.innerHTML = BUILD_PORTRAIT_SVG(rec, window._vnpState.previewEmo || 'neutral');
    }

    // --- 3. ВСТРАИВАНИЕ КОНСТРУКТОРА ВО ВКЛАДКУ «🎨 ВНЕШНОСТЬ И ЭМОЦИИ» ---
    function BUILD_CONSTRUCTOR_HTML() {
        const rec = ENSURE_RECIPE_FOR_DRAFT();
        const tab = window._vnpState.catTab || 'face';
        const pEmo = window._vnpState.previewEmo || 'neutral';

        const chipBtn = (field, opt) => `
            <button data-custom-bg="1" class="vn-soft-btn ${rec[field] === opt.id ? 'is-active' : ''}"
                style="padding:4px 9px !important; font-size:0.78rem !important;"
                onclick="VNP_SET_OPT('${field}','${opt.id}')">${ESC(opt.label)}</button>`;

        const swatchBtn = (field, c) => `
            <button data-custom-bg="1" title="${ESC(c.label || c.id)}" onclick="VNP_SET_OPT('${field}','${c.id}')"
                style="width:26px; height:26px; border-radius:50%; padding:0; cursor:pointer; background:${c.hex} !important; border:${rec[field] === c.id ? '3px solid #f5e6c8' : '2px solid #2b2620'} !important; box-shadow:${rec[field] === c.id ? '0 0 0 2px #c9a96e' : 'none'} !important;"></button>`;

        const tabBtn = (id, lbl) => `
            <button data-custom-bg="1" class="vn-soft-btn ${tab === id ? 'is-active' : ''}"
                style="flex:1; padding:5px 6px !important; font-size:0.78rem !important;"
                onclick="VNP_SET_CAT_TAB('${id}')">${lbl}</button>`;

        let controls = '';
        if (tab === 'face') {
            controls = `
                <div><small style="color:var(--ui-muted,#aaa); display:block; margin-bottom:4px;">Раса:</small>
                    <div style="display:flex; gap:5px; flex-wrap:wrap;">${RACES.map(o => chipBtn('race', o)).join('')}</div></div>
                <div><small style="color:var(--ui-muted,#aaa); display:block; margin-bottom:4px;">Черты лица и плеч:</small>
                    <div style="display:flex; gap:5px;">
                        ${chipBtn('build', { id: 'masc', label: 'Мужественные' })}
                        ${chipBtn('build', { id: 'fem', label: 'Женственные' })}
                    </div></div>
                <div><small style="color:var(--ui-muted,#aaa); display:block; margin-bottom:5px;">Оттенок кожи:</small>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">${SKIN_TONES.map(c => swatchBtn('skin', c)).join('')}</div></div>
                <div><small style="color:var(--ui-muted,#aaa); display:block; margin-bottom:5px;">Цвет глаз:</small>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">${EYE_COLORS.map(c => swatchBtn('eyeCol', c)).join('')}</div></div>`;
        } else if (tab === 'hair') {
            controls = `
                <div><small style="color:var(--ui-muted,#aaa); display:block; margin-bottom:4px;">Причёска:</small>
                    <div style="display:flex; gap:5px; flex-wrap:wrap;">${HAIRSTYLES.map(o => chipBtn('hair', o)).join('')}</div></div>
                <div><small style="color:var(--ui-muted,#aaa); display:block; margin-bottom:4px;">Борода / Усы:</small>
                    <div style="display:flex; gap:5px; flex-wrap:wrap;">${BEARDS.map(o => chipBtn('beard', o)).join('')}</div></div>
                <div><small style="color:var(--ui-muted,#aaa); display:block; margin-bottom:5px;">Цвет волос и бороды:</small>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">${HAIR_COLORS.map(c => swatchBtn('hairCol', c)).join('')}</div></div>`;
        } else if (tab === 'outfit') {
            controls = `
                <div><small style="color:var(--ui-muted,#aaa); display:block; margin-bottom:4px;">Одежда / Броня:</small>
                    <div style="display:flex; gap:5px; flex-wrap:wrap;">${OUTFITS.map(o => chipBtn('outfit', o)).join('')}</div></div>
                <div><small style="color:var(--ui-muted,#aaa); display:block; margin-bottom:5px;">Цвет ткани / отделки:</small>
                    <div style="display:flex; gap:6px; flex-wrap:wrap;">${OUTFIT_COLORS.map(c => swatchBtn('outfitCol', c)).join('')}</div></div>
                <div><small style="color:var(--ui-muted,#aaa); display:block; margin-bottom:4px;">Головной убор:</small>
                    <div style="display:flex; gap:5px; flex-wrap:wrap;">${HATS.map(o => chipBtn('hat', o)).join('')}</div></div>`;
        } else {
            controls = `
                <div><small style="color:var(--ui-muted,#aaa); display:block; margin-bottom:4px;">Особые приметы:</small>
                    <div style="display:flex; gap:5px; flex-wrap:wrap;">${DETAILS.map(o => chipBtn('detail', o)).join('')}</div></div>
                <div><small style="color:var(--ui-muted,#aaa); display:block; margin-bottom:4px;">Фон портрета (для Новеллы лучше «Прозрачный»):</small>
                    <div style="display:flex; gap:5px; flex-wrap:wrap;">${BACKDROPS.map(o => chipBtn('bg', o)).join('')}</div></div>`;
        }

        return `
            <div style="display:flex; gap:5px; flex-wrap:wrap; align-items:center;">
                <small style="color:var(--ui-muted,#888);">Шаблоны:</small>
                ${PRESETS.map((p, i) => `<button data-custom-bg="1" class="vn-soft-btn" style="padding:3px 7px !important; font-size:0.74rem !important;" onclick="VNP_APPLY_PRESET(${i})">${p.label}</button>`).join('')}
                <button data-custom-bg="1" class="vn-soft-btn" style="padding:3px 8px !important; font-size:0.74rem !important; border-color:var(--ui-accent,#d2b278) !important;" onclick="VNP_RANDOMIZE()">🎲 Случайный</button>
            </div>

            <div style="display:grid; grid-template-columns:205px 1fr; gap:14px; align-items:start;">
                <!-- Живой предпросмотр -->
                <div style="display:flex; flex-direction:column; align-items:center; gap:7px;">
                    <div id="vnp-live-svg-box" style="width:198px; height:222px; border-radius:10px; background:radial-gradient(circle at 50% 45%, #2a2520 0%, #141210 100%); border:1px solid var(--ui-border-strong,#695c4c); display:flex; align-items:flex-end; justify-content:center; overflow:hidden;">
                        ${BUILD_PORTRAIT_SVG(rec, pEmo)}
                    </div>
                    <div style="display:flex; gap:4px; flex-wrap:wrap; justify-content:center;">
                        ${EMOTIONS.map(em => `<button data-custom-bg="1" data-vnp-emo-btn="${em.id}" class="vn-soft-btn ${pEmo === em.id ? 'is-active' : ''}" style="padding:3px 6px !important; font-size:0.78rem !important;" title="Проверить эмоцию: ${em.label}" onclick="VNP_SET_PREVIEW_EMO('${em.id}')">${em.icon}</button>`).join('')}
                    </div>
                </div>

                <!-- Категории ассетов -->
                <div style="display:flex; flex-direction:column; gap:10px; min-width:0;">
                    <div style="display:flex; gap:4px; background:var(--ui-panel,#221f1c); padding:3px; border-radius:8px; border:1px solid var(--ui-border,#3e372f);">
                        ${tabBtn('face', '👤 Лицо')}
                        ${tabBtn('hair', '💇 Волосы')}
                        ${tabBtn('outfit', '🧥 Одежда')}
                        ${tabBtn('details', '✨ Детали')}
                    </div>
                    <div style="display:flex; flex-direction:column; gap:10px;">${controls}</div>
                </div>
            </div>

            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; padding-top:6px; border-top:1px dashed var(--ui-border,#3e372f);">
                <button class="btn-save" style="padding:7px 14px; font-size:0.86rem;" onclick="VNP_GENERATE_ALL_EMOTIONS(false)">✨ Сгенерировать все 6 эмоций</button>
                <button data-custom-bg="1" class="vn-soft-btn" onclick="VNP_GENERATE_SINGLE_EMOTION()">💾 Только для текущей эмоции</button>
                <small id="vnp-applied-badge" style="display:none; color:#6cb878; font-weight:600;"></small>
            </div>
        `;
    }

    function INJECT_CONSTRUCTOR_INTO_STUDIO() {
        if (!window._vnUi || !window._vnUi.editMode || window._vnUi.editTab !== 'art') return;
        const mainCol = document.querySelector('#gm-tool-modal-content .vns-main');
        if (!mainCol || mainCol.querySelector('[data-vnp-mode-bar]')) return;

        // Тело вкладки — это 3-й дочерний элемент внутри .vns-main (после заголовка и полоски из 3 вкладок)
        const bodyDiv = mainCol.children[2];
        if (!bodyDiv) return;

        ENSURE_RECIPE_FOR_DRAFT();
        const mode = window._vnpState.artMode || 'builder';

        const bar = document.createElement('div');
        bar.setAttribute('data-vnp-mode-bar', '1');
        bar.style.cssText = 'display:flex; gap:6px; align-items:center; flex-wrap:wrap;';
        bar.innerHTML = `
            <button data-custom-bg="1" class="vn-soft-btn ${mode === 'builder' ? 'is-active' : ''}" onclick="VNP_SET_ART_MODE('builder')">🎨 Конструктор NPC (ассеты)</button>
            <button data-custom-bg="1" class="vn-soft-btn ${mode === 'upload' ? 'is-active' : ''}" onclick="VNP_SET_ART_MODE('upload')">📷 Свои картинки / URL</button>
        `;
        bodyDiv.before(bar);

        if (mode === 'builder') {
            bodyDiv.innerHTML = BUILD_CONSTRUCTOR_HTML();
        }
    }

    // Хук в отрисовку Мастерской NPC
    const _ORIG_RENDER_STUDIO = window.RENDER_NPC_STUDIO_MODAL;
    if (typeof _ORIG_RENDER_STUDIO === 'function') {
        window.RENDER_NPC_STUDIO_MODAL = function() {
            _ORIG_RENDER_STUDIO();
            INJECT_CONSTRUCTOR_INTO_STUDIO();
        };
    }

    // Хук в сохранение NPC: автоматически применяем несохранённый конструктор и сохраняем рецепт в Firebase
    const _ORIG_SAVE_DRAFT = window.VNS_SAVE_DRAFT;
    if (typeof _ORIG_SAVE_DRAFT === 'function') {
        window.VNS_SAVE_DRAFT = function() {
            const draft = window._vnUi && window._vnUi.draft;
            if (draft && window._vnpState.artMode === 'builder' && (window._vnpState.dirty || !draft.avatar)) {
                window.VNP_GENERATE_ALL_EMOTIONS(true);
            }
            const recipeSnap = (draft && draft.portraitRecipe) ? JSON.parse(JSON.stringify(draft.portraitRecipe)) : null;

            _ORIG_SAVE_DRAFT();

            const savedId = window._vnUi && window._vnUi.selectedId;
            const rc = CUR_ROOM();
            if (recipeSnap && savedId && rc && window._vnNpcsCache && Array.isArray(window._vnNpcsCache[rc])) {
                const target = window._vnNpcsCache[rc].find(x => x.id === savedId);
                if (target) {
                    target.portraitRecipe = recipeSnap;
                    if (window.firebase && firebase.apps && firebase.apps.length) {
                        firebase.database().ref(`campaign_v2/rooms/${rc}/vn_studio/npcs/${savedId}/portraitRecipe`).set(recipeSnap).catch(() => {});
                    } else {
                        fetch(`${FB_ROOMS_URL}/${encodeURIComponent(rc)}/vn_studio/npcs/${encodeURIComponent(savedId)}/portraitRecipe.json`, {
                            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(recipeSnap)
                        }).catch(() => {});
                    }
                }
            }
        };
    }
})();