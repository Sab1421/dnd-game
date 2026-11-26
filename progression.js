// ================================================================
// 🎒 СТАРТОВОЕ СНАРЯЖЕНИЕ И СИСТЕМА ОПЫТА / ПОВЫШЕНИЯ УРОВНЯ (progression.js)
// Автоматизация D&D 5e с сохранением возможности ручной сборки.
// ================================================================
(function INIT_STARTING_GEAR_AND_PROGRESSION() {
    if (typeof gameData === 'undefined') return;

    // 1. Сохраняем прогресс стартового снаряжения и бросков ХП по комнатам
    const EXTRA_PROG_FIELDS = ['_startingGearDone', '_hpRolls', '_hpClass', '_hpInitialized'];
    if (typeof ROOM_PROGRESS_FIELDS !== 'undefined' && Array.isArray(ROOM_PROGRESS_FIELDS)) {
        EXTRA_PROG_FIELDS.forEach(f => {
            if (!ROOM_PROGRESS_FIELDS.includes(f)) ROOM_PROGRESS_FIELDS.push(f);
        });
    }

    if (typeof window.CREATE_CLEAN_LEVEL1_SNAPSHOT === 'function') {
        const _ORIG_SNAP_PR = window.CREATE_CLEAN_LEVEL1_SNAPSHOT;
        window.CREATE_CLEAN_LEVEL1_SNAPSHOT = function(c) {
            const snap = _ORIG_SNAP_PR(c);
            if (c && c._startingGearDone) snap._startingGearDone = true;
            return snap;
        };
    }

    const ESC = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    let lastLevelUpNotifiedKey = '';
    let lvlToastTimer = null;

    // ================================================================
    // 2. БАЗА СТАРТОВОГО СНАРЯЖЕНИЯ ПО КЛАССАМ И ПРЕДЫСТОРИЯМ (D&D 5e)
    // ================================================================
    const FALLBACK_STATS = {
        'Секира':              { type: 'weapon', isWeapon: true, damage: '1к12', damageType: 'рубящий', properties: 'тяжёлое, двуручное', weight: 7, icon: '🪓' },
        'Двуручный меч':       { type: 'weapon', isWeapon: true, damage: '2к6',  damageType: 'рубящий', properties: 'тяжёлое, двуручное', weight: 6, icon: '⚔️' },
        'Длинный меч':         { type: 'weapon', isWeapon: true, damage: '1к8',  damageType: 'рубящий', properties: 'универсальное (1к10)', weight: 3, icon: '⚔️' },
        'Короткий меч':        { type: 'weapon', isWeapon: true, damage: '1к6',  damageType: 'колющий', properties: 'лёгкое, фехтовальное', finesse: true, weight: 2, icon: '🗡️' },
        'Рапира':              { type: 'weapon', isWeapon: true, damage: '1к8',  damageType: 'колющий', properties: 'фехтовальное', finesse: true, weight: 2, icon: '🤺' },
        'Скимитар':            { type: 'weapon', isWeapon: true, damage: '1к6',  damageType: 'рубящий', properties: 'лёгкое, фехтовальное', finesse: true, weight: 3, icon: '⚔️' },
        'Боевой топор':        { type: 'weapon', isWeapon: true, damage: '1к8',  damageType: 'рубящий', properties: 'универсальное (1к10)', weight: 4, icon: '🪓' },
        'Ручной топор':        { type: 'weapon', isWeapon: true, damage: '1к6',  damageType: 'рубящий', properties: 'лёгкое, метательное (20/60)', weight: 2, icon: '🪓' },
        'Боевой молот':        { type: 'weapon', isWeapon: true, damage: '1к8',  damageType: 'дробящий', properties: 'универсальное (1к10)', weight: 2, icon: '🔨' },
        'Булава':              { type: 'weapon', isWeapon: true, damage: '1к6',  damageType: 'дробящий', properties: 'одноручное', weight: 4, icon: '🔨' },
        'Боевой посох':        { type: 'weapon', isWeapon: true, damage: '1к6',  damageType: 'дробящий', properties: 'универсальное (1к8)', weight: 4, icon: '🪄' },
        'Копьё':               { type: 'weapon', isWeapon: true, damage: '1к6',  damageType: 'колющий', properties: 'метательное (20/60), универсальное (1к8)', weight: 3, icon: '🔱' },
        'Метательное копьё':   { type: 'weapon', isWeapon: true, damage: '1к6',  damageType: 'колющий', properties: 'метательное (30/120)', weight: 2, icon: '🔱' },
        'Кинжал':              { type: 'weapon', isWeapon: true, damage: '1к4',  damageType: 'колющий', properties: 'лёгкое, фехтовальное, метательное (20/60)', finesse: true, weight: 1, icon: '🗡️' },
        'Дротик':              { type: 'weapon', isWeapon: true, damage: '1к4',  damageType: 'колющий', properties: 'фехтовальное, метательное (20/60)', finesse: true, ranged: true, weight: 0.25, icon: '🎯' },
        'Длинный лук':         { type: 'weapon', isWeapon: true, damage: '1к8',  damageType: 'колющий', properties: 'боеприпасы (150/600), тяжёлое, двуручное', ranged: true, weight: 2, icon: '🏹' },
        'Короткий лук':        { type: 'weapon', isWeapon: true, damage: '1к6',  damageType: 'колющий', properties: 'боеприпасы (80/320), двуручное', ranged: true, weight: 2, icon: '🏹' },
        'Лёгкий арбалет':      { type: 'weapon', isWeapon: true, damage: '1к8',  damageType: 'колющий', properties: 'боеприпасы (80/320), двуручное', ranged: true, weight: 5, icon: '🏹' },
        'Кожаный доспех':      { type: 'armor',  ac: 11, properties: 'лёгкий', weight: 10, icon: '🛡️' },
        'Чешуйчатый доспех':   { type: 'armor',  ac: 14, properties: 'средний', weight: 45, icon: '🛡️' },
        'Кольчуга':            { type: 'armor',  ac: 16, properties: 'тяжёлый', weight: 55, icon: '🛡️' },
        'Щит':                 { type: 'shield', isShield: true, ac: 2, properties: 'щит', weight: 6, icon: '🛡️' },
        'Стрелы':              { type: 'misc',   weight: 0.05, icon: '🏹', desc: 'Боеприпасы для лука' },
        'Арбалетные болты':    { type: 'misc',   weight: 0.07, icon: '🏹', desc: 'Боеприпасы для арбалета' },
        'Воровские инструменты': { type: 'tool', weight: 1, icon: '🔧', desc: 'Отмычки и инструменты для взлома замков и ловушек' },
        'Книга заклинаний':    { type: 'scroll', weight: 3, icon: '📘', desc: 'Личный гримуар волшебника' },
        'Магическая фокусировка': { type: 'misc', weight: 1, icon: '🔮', desc: 'Жезл, кристалл или амулет для сотворения заклинаний' },
        'Священный символ':    { type: 'misc',   weight: 1, icon: '☀️', desc: 'Амулет или эмблема божества' },
        'Фокус друида':        { type: 'misc',   weight: 1, icon: '🌿', desc: 'Веточка омелы или тотем природы' },
        'Музыкальный инструмент': { type: 'tool', weight: 2, icon: '🪕', desc: 'Лютня, флейта или лира (фокус для барда)' },
        'Походный рацион (1 день)': { type: 'misc', weight: 2, icon: '🍖', desc: 'Сухой паёк и вода на 1 день пути' },
        'Факел':               { type: 'misc',   weight: 1, icon: '🔥', desc: 'Горит 1 час, освещая 20 фт ярким светом' },
        'Верёвка (50 фт)':     { type: 'misc',   weight: 10, icon: '🪢', desc: 'Прочная пеньковая верёвка' }
    };

    const CLASS_GEAR = {
        'Варвар': {
            goldDice: '2к4', goldMult: 10,
            choices: [
                { label: 'Основное оружие', options: [ { title: '🪓 Секира (1к12)', items: [['Секира', 1]] }, { title: '🪓 Боевой топор (1к8)', items: [['Боевой топор', 1]] } ] },
                { label: 'Запасное оружие', options: [ { title: '🪓 2 Ручных топора', items: [['Ручной топор', 2]] }, { title: '🔱 Копьё (1к6)', items: [['Копьё', 1]] } ] }
            ],
            base: [['Метательное копьё', 4], ['Походный рацион (1 день)', 5], ['Факел', 5], ['Верёвка (50 фт)', 1]]
        },
        'Бард': {
            goldDice: '5к4', goldMult: 10,
            choices: [
                { label: 'Оружие', options: [ { title: '🤺 Рапира (1к8)', items: [['Рапира', 1]] }, { title: '⚔️ Длинный меч (1к8)', items: [['Длинный меч', 1]] } ] }
            ],
            base: [['Кожаный доспех', 1], ['Кинжал', 1], ['Музыкальный инструмент', 1], ['Походный рацион (1 день)', 3]]
        },
        'Воин': {
            goldDice: '5к4', goldMult: 10,
            choices: [
                { label: 'Броня', options: [ { title: '🛡️ Кольчуга (КБ 16, тяжёлый)', items: [['Кольчуга', 1]] }, { title: '🛡️ Кожаный доспех + 🏹 Длинный лук (20 стрел)', items: [['Кожаный доспех', 1], ['Длинный лук', 1], ['Стрелы', 20]] } ] },
                { label: 'Оружие ближнего боя', options: [ { title: '⚔️ Длинный меч + 🛡️ Щит', items: [['Длинный меч', 1], ['Щит', 1]] }, { title: '⚔️ Двуручный меч (2к6)', items: [['Двуручный меч', 1]] } ] },
                { label: 'Дальний бой', options: [ { title: '🏹 Лёгкий арбалет + 20 болтов', items: [['Лёгкий арбалет', 1], ['Арбалетные болты', 20]] }, { title: '🪓 2 Ручных топора', items: [['Ручной топор', 2]] } ] }
            ],
            base: [['Походный рацион (1 день)', 5], ['Факел', 5], ['Верёвка (50 фт)', 1]]
        },
        'Волшебник': {
            goldDice: '4к4', goldMult: 10,
            choices: [
                { label: 'Оружие', options: [ { title: '🪄 Боевой посох (1к6)', items: [['Боевой посох', 1]] }, { title: '🗡️ Кинжал (1к4)', items: [['Кинжал', 1]] } ] }
            ],
            base: [['Книга заклинаний', 1], ['Магическая фокусировка', 1], ['Походный рацион (1 день)', 3], ['Факел', 3]]
        },
        'Друид': {
            goldDice: '2к4', goldMult: 10,
            choices: [
                { label: 'Вторая рука', options: [ { title: '🛡️ Щит (+2 КБ)', items: [['Щит', 1]] }, { title: '🔱 Копьё (1к6)', items: [['Копьё', 1]] } ] },
                { label: 'Основное оружие', options: [ { title: '⚔️ Скимитар (1к6)', items: [['Скимитар', 1]] }, { title: '🪄 Боевой посох (1к6)', items: [['Боевой посох', 1]] } ] }
            ],
            base: [['Кожаный доспех', 1], ['Фокус друида', 1], ['Походный рацион (1 день)', 5], ['Факел', 5]]
        },
        'Жрец': {
            goldDice: '5к4', goldMult: 10,
            choices: [
                { label: 'Оружие', options: [ { title: '🔨 Булава (1к6)', items: [['Булава', 1]] }, { title: '🔨 Боевой молот (1к8)', items: [['Боевой молот', 1]] } ] },
                { label: 'Доспех', options: [ { title: '🛡️ Чешуйчатый доспех (КБ 14, сред.)', items: [['Чешуйчатый доспех', 1]] }, { title: '🛡️ Кожаный доспех (КБ 11, лёгк.)', items: [['Кожаный доспех', 1]] }, { title: '🛡️ Кольчуга (КБ 16, тяж.)', items: [['Кольчуга', 1]] } ] },
                { label: 'Доп. оружие', options: [ { title: '🏹 Лёгкий арбалет + 20 болтов', items: [['Лёгкий арбалет', 1], ['Арбалетные болты', 20]] }, { title: '🔱 Копьё (1к6)', items: [['Копьё', 1]] } ] }
            ],
            base: [['Щит', 1], ['Священный символ', 1], ['Походный рацион (1 день)', 4], ['Факел', 4]]
        },
        'Колдун': {
            goldDice: '4к4', goldMult: 10,
            choices: [
                { label: 'Оружие', options: [ { title: '🏹 Лёгкий арбалет + 20 болтов', items: [['Лёгкий арбалет', 1], ['Арбалетные болты', 20]] }, { title: '🪄 Боевой посох (1к6)', items: [['Боевой посох', 1]] } ] }
            ],
            base: [['Кожаный доспех', 1], ['Кинжал', 2], ['Магическая фокусировка', 1], ['Походный рацион (1 день)', 3]]
        },
        'Монах': {
            goldDice: '5к4', goldMult: 1,
            choices: [
                { label: 'Оружие', options: [ { title: '🗡️ Короткий меч (1к6)', items: [['Короткий меч', 1]] }, { title: '🪄 Боевой посох (1к6)', items: [['Боевой посох', 1]] } ] }
            ],
            base: [['Дротик', 10], ['Походный рацион (1 день)', 5], ['Факел', 5], ['Верёвка (50 фт)', 1]]
        },
        'Паладин': {
            goldDice: '5к4', goldMult: 10,
            choices: [
                { label: 'Основное оружие', options: [ { title: '⚔️ Длинный меч + 🛡️ Щит', items: [['Длинный меч', 1], ['Щит', 1]] }, { title: '⚔️ Двуручный меч (2к6)', items: [['Двуручный меч', 1]] } ] },
                { label: 'Доп. оружие', options: [ { title: '🔱 5 Метательных копий', items: [['Метательное копьё', 5]] }, { title: '🔨 Боевой молот (1к8)', items: [['Боевой молот', 1]] } ] }
            ],
            base: [['Кольчуга', 1], ['Священный символ', 1], ['Походный рацион (1 день)', 5], ['Факел', 5]]
        },
        'Плут': {
            goldDice: '4к4', goldMult: 10,
            choices: [
                { label: 'Основное оружие', options: [ { title: '🤺 Рапира (1к8)', items: [['Рапира', 1]] }, { title: '🗡️ Короткий меч (1к6)', items: [['Короткий меч', 1]] } ] },
                { label: 'Второе оружие', options: [ { title: '🏹 Короткий лук + 20 стрел', items: [['Короткий лук', 1], ['Стрелы', 20]] }, { title: '🗡️ Короткий меч (1к6)', items: [['Короткий меч', 1]] } ] }
            ],
            base: [['Кожаный доспех', 1], ['Кинжал', 2], ['Воровские инструменты', 1], ['Верёвка (50 фт)', 1], ['Походный рацион (1 день)', 3]]
        },
        'Следопыт': {
            goldDice: '5к4', goldMult: 10,
            choices: [
                { label: 'Доспех', options: [ { title: '🛡️ Чешуйчатый доспех (КБ 14, сред.)', items: [['Чешуйчатый доспех', 1]] }, { title: '🛡️ Кожаный доспех (КБ 11, лёгк.)', items: [['Кожаный доспех', 1]] } ] },
                { label: 'Ближний бой', options: [ { title: '🗡️ 2 Коротких меча', items: [['Короткий меч', 2]] }, { title: '⚔️ Длинный меч (1к8)', items: [['Длинный меч', 1]] } ] }
            ],
            base: [['Длинный лук', 1], ['Стрелы', 20], ['Походный рацион (1 день)', 5], ['Факел', 5], ['Верёвка (50 фт)', 1]]
        },
        'Чародей': {
            goldDice: '3к4', goldMult: 10,
            choices: [
                { label: 'Оружие', options: [ { title: '🏹 Лёгкий арбалет + 20 болтов', items: [['Лёгкий арбалет', 1], ['Арбалетные болты', 20]] }, { title: '🪄 Боевой посох (1к6)', items: [['Боевой посох', 1]] } ] }
            ],
            base: [['Кинжал', 2], ['Магическая фокусировка', 1], ['Походный рацион (1 день)', 3], ['Факел', 3]]
        }
    };

    function GET_BG_START_BONUS(bgName) {
        const bg = String(bgName || '').toLowerCase();
        if (bg.includes('благород')) return { gp: 25, item: 'Перстень с печаткой' };
        if (bg.includes('преступ') || bg.includes('вор')) return { gp: 15, item: 'Воровские инструменты' };
        if (bg.includes('гильд') || bg.includes('ремесл') || bg.includes('шарлатан')) return { gp: 15, item: null };
        if (bg.includes('артист')) return { gp: 15, item: 'Музыкальный инструмент' };
        if (bg.includes('прислуж')) return { gp: 15, item: 'Священный символ' };
        if (bg.includes('отшельн')) return { gp: 5, item: null };
        return { gp: 10, item: null };
    }

    function MAKE_GEAR_ITEM(name, qty) {
        const tpl = (typeof FIND_CATALOG_ITEM === 'function') ? FIND_CATALOG_ITEM(name) : null;
        if (tpl && typeof CREATE_ITEM_OBJECT === 'function') {
            return CREATE_ITEM_OBJECT(tpl.name, String(qty || 1), '', '');
        }
        const fb = FALLBACK_STATS[name] || {};
        return Object.assign({
            name,
            qty: String(Math.max(1, parseInt(qty, 10) || 1)),
            weight: fb.weight || 0,
            desc: fb.desc || 'Стартовое снаряжение',
            icon: fb.icon || '📦',
            equipped: false,
            isWeapon: !!fb.isWeapon,
            isShield: !!fb.isShield,
            damage: fb.damage || '',
            damageType: fb.damageType || '',
            finesse: !!fb.finesse,
            ranged: !!fb.ranged,
            properties: fb.properties || '',
            ac: fb.ac || 0,
            price: '',
            type: fb.type || 'misc',
            consumable: false
        }, fb, { qty: String(Math.max(1, parseInt(qty, 10) || 1)), equipped: false });
    }

    function ADD_OR_STACK_ITEM(inv, itemObj) {
        const norm = s => String(s || '').toLowerCase().replace(/ё/g, 'е').trim();
        const ex = inv.find(x => !x.equipped && norm(x.name) === norm(itemObj.name));
        if (ex) ex.qty = String((parseInt(ex.qty, 10) || 1) + (parseInt(itemObj.qty, 10) || 1));
        else inv.push(itemObj);
    }

    function AUTO_EQUIP_STARTING_LOADOUT(c) {
        if (!c || !Array.isArray(c.inventory)) return;
        const inv = c.inventory;

        // 1. Лучший доспех с владением
        const armors = inv.filter(i => i.ac && !i.isShield && !i.equipped && (typeof HAS_ARMOR_PROF !== 'function' || HAS_ARMOR_PROF(c, i.properties || '')));
        if (armors.length) {
            armors.sort((a, b) => (parseInt(b.ac, 10) || 0) - (parseInt(a.ac, 10) || 0));
            armors[0].equipped = true;
        }

        // 2. Основное оружие и щит/второе лёгкое оружие (не превышая 2 рук)
        const weapons = inv.filter(i => i.isWeapon && !i.equipped);
        const shield = inv.find(i => i.isShield && !i.equipped && (typeof HAS_ARMOR_PROF !== 'function' || HAS_ARMOR_PROF(c, 'щит')));

        let hands = 0;
        const mainWep = weapons.find(w => !w.ranged) || weapons[0];
        if (mainWep) {
            const p = (mainWep.properties || '').toLowerCase().replace(/ё/g, 'е');
            const is2H = p.includes('двуручное') || (p.includes('тяжелое') && !p.includes('универсальное'));
            const need = is2H ? 2 : 1;
            const idx = inv.indexOf(mainWep);
            if (idx !== -1) {
                if (typeof EQUIP_SINGLE_FROM_STACK === 'function') EQUIP_SINGLE_FROM_STACK(c, idx);
                else mainWep.equipped = true;
                hands += need;
            }
        }
        if (hands <= 1 && shield) {
            shield.equipped = true;
            hands += 1;
        } else if (hands <= 1 && mainWep && (mainWep.properties || '').toLowerCase().replace(/ё/g, 'е').includes('легкое')) {
            const secondLight = inv.find(i => i.isWeapon && !i.equipped && !i.ranged && (i.properties || '').toLowerCase().replace(/ё/g, 'е').includes('легкое'));
            if (secondLight) {
                const sIdx = inv.indexOf(secondLight);
                if (typeof EQUIP_SINGLE_FROM_STACK === 'function') EQUIP_SINGLE_FROM_STACK(c, sIdx);
                else secondLight.equipped = true;
            }
        }
    }

    // --- ОКНО ВЫБОРА СТАРТОВОГО СНАРЯЖЕНИЯ ---
    function ENSURE_PROG_MODAL() {
        let m = document.getElementById('progression-modal');
        if (m) return m;
        m = document.createElement('div');
        m.className = 'modal';
        m.id = 'progression-modal';
        m.style.zIndex = '96300';
        m.innerHTML = `<div class="modal-content" id="progression-modal-content" style="max-width:650px; width:95%;"></div>`;
        m.addEventListener('click', e => { if (e.target === m) m.classList.remove('active'); });
        document.body.appendChild(m);
        return m;
    }

    window.OPEN_STARTING_GEAR_MODAL = function() {
        const cs = GC();
        const c = cs[PI];
        if (!c || !c.className || !CLASS_GEAR[c.className]) return;

        const cfg = CLASS_GEAR[c.className];
        const bgBonus = GET_BG_START_BONUS(c.background);
        const modal = ENSURE_PROG_MODAL();
        const cont = document.getElementById('progression-modal-content');

        const choicesHTML = cfg.choices.map((ch, cIdx) => {
            const opts = ch.options.map((o, oIdx) => `
                <label style="display:flex; align-items:center; gap:8px; padding:7px 10px; background:var(--ui-panel, #221f1c); border:1px solid var(--ui-border, #3e372f); border-radius:7px; cursor:pointer; font-size:0.88rem;">
                    <input type="radio" name="sg-choice-${cIdx}" value="${oIdx}" ${oIdx === 0 ? 'checked' : ''} style="width:auto;">
                    <span>${ESC(o.title)}</span>
                </label>`).join('');
            return `
                <div style="background:var(--ui-panel2, #161412); border:1px solid var(--ui-border, #3e372f); border-radius:9px; padding:10px 12px; margin-bottom:8px;">
                    <div style="font-weight:700; color:var(--ui-accent, #d2b278); font-size:0.86rem; margin-bottom:6px;">${ESC(ch.label)}:</div>
                    <div style="display:flex; flex-direction:column; gap:5px;">${opts}</div>
                </div>`;
        }).join('');

        const basePreview = cfg.base.map(([n, q]) => `${n}${q > 1 ? ' ×' + q : ''}`).join(', ');
        const goldLabel = cfg.goldMult > 1 ? `${cfg.goldDice} × ${cfg.goldMult} зм` : `${cfg.goldDice} зм`;

        cont.innerHTML = `
            <h2 style="margin-top:0;">🎒 Стартовое снаряжение: ${ESC(c.className)}</h2>
            <p style="color:var(--ui-muted, #aaa); font-size:0.88rem; margin-bottom:12px;">
                Выберите готовый набор класса по правилам D&D 5e, бросьте стартовое золото для самостоятельной закупки или пропустите, если хотите собрать рюкзак вручную.
            </p>
            <div style="text-align:left;">
                ${choicesHTML}
                <div style="background:var(--ui-panel2, #161412); border:1px dashed var(--ui-border, #3e372f); border-radius:8px; padding:9px 12px; font-size:0.84rem; color:var(--ui-muted, #aaa); margin-bottom:10px;">
                    <b style="color:var(--ui-text, #e5e0d7);">Также в комплекте:</b> ${ESC(basePreview)}<br>
                    <b style="color:var(--ui-accent, #d2b278);">От предыстории (${ESC(c.background || 'базовая')}):</b> +${bgBonus.gp} зм${bgBonus.item ? ` и ${ESC(bgBonus.item)}` : ''}
                </div>
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:0.88rem; margin-bottom:14px;">
                    <input type="checkbox" id="sg-auto-equip" checked style="width:auto;">
                    <span>⚔️ Сразу экипировать подходящий доспех, щит и основное оружие</span>
                </label>
            </div>
            <div style="display:flex; flex-direction:column; gap:8px;">
                <button class="btn-save" style="padding:10px;" onclick="APPLY_STARTING_GEAR_PACK()">🎒 Взять выбранный набор снаряжения</button>
                <div style="display:flex; gap:8px; flex-wrap:wrap;">
                    <button class="btn-small" style="flex:1; padding:8px;" onclick="APPLY_STARTING_GOLD_ROLL()">🪙 Взять золотом вместо набора (${goldLabel})</button>
                    <button class="btn-small" style="flex:1; padding:8px;" onclick="SKIP_STARTING_GEAR()">✋ Пропустить (соберу вручную)</button>
                </div>
            </div>
        `;
        modal.classList.add('active');
    };

    window.APPLY_STARTING_GEAR_PACK = function() {
        const cs = GC();
        const c = cs[PI];
        if (!c || !CLASS_GEAR[c.className]) return;
        const cfg = CLASS_GEAR[c.className];
        const bgBonus = GET_BG_START_BONUS(c.background);
        const autoEquip = !!document.getElementById('sg-auto-equip')?.checked;

        if (!c.inventory) c.inventory = [];
        if (!c.money) c.money = { gp: 0, sp: 0, cp: 0 };

        cfg.choices.forEach((ch, cIdx) => {
            const sel = document.querySelector(`input[name="sg-choice-${cIdx}"]:checked`);
            const optIdx = sel ? parseInt(sel.value, 10) : 0;
            const opt = ch.options[optIdx] || ch.options[0];
            (opt.items || []).forEach(([n, q]) => ADD_OR_STACK_ITEM(c.inventory, MAKE_GEAR_ITEM(n, q)));
        });
        cfg.base.forEach(([n, q]) => ADD_OR_STACK_ITEM(c.inventory, MAKE_GEAR_ITEM(n, q)));
        if (bgBonus.item) ADD_OR_STACK_ITEM(c.inventory, MAKE_GEAR_ITEM(bgBonus.item, 1));
        c.money.gp = (parseInt(c.money.gp, 10) || 0) + bgBonus.gp;

        if (autoEquip) AUTO_EQUIP_STARTING_LOADOUT(c);

        c._startingGearDone = true;
        AB(c);
        SC(cs);
        document.getElementById('progression-modal')?.classList.remove('active');
        RMC();
        if (document.getElementById('char-sheet-modal')?.classList.contains('active')) ROS();
        showMessage('🎒 Снаряжение получено!', `Стартовый комплект класса <b>${ESC(c.className)}</b> и <b>${bgBonus.gp} зм</b> добавлены в Рюкзак.${autoEquip ? '<br>Броня и основное оружие уже экипированы.' : ''}`);
    };

    window.APPLY_STARTING_GOLD_ROLL = function() {
        const cs = GC();
        const c = cs[PI];
        if (!c || !CLASS_GEAR[c.className]) return;
        const cfg = CLASS_GEAR[c.className];
        const rolled = Math.max(2, window.ROLL(cfg.goldDice));
        const gold = rolled * cfg.goldMult;
        if (!c.money) c.money = { gp: 0, sp: 0, cp: 0 };
        c.money.gp = (parseInt(c.money.gp, 10) || 0) + gold;
        c._startingGearDone = true;
        SC(cs);
        document.getElementById('progression-modal')?.classList.remove('active');
        RMC();
        if (document.getElementById('char-sheet-modal')?.classList.contains('active')) ROS();
        showMessage('🪙 Стартовое золото', `Бросок <b>${cfg.goldDice}${cfg.goldMult > 1 ? ' × ' + cfg.goldMult : ''}</b>: вы получили <b style="color:var(--ui-accent,#e6c88c);">${gold} зм</b>!<br><small>Теперь вы можете вручную купить или добавить нужную экипировку в Рюкзаке.</small>`);
    };

    window.SKIP_STARTING_GEAR = function() {
        const cs = GC();
        if (cs[PI]) {
            cs[PI]._startingGearDone = true;
            SC(cs);
        }
        document.getElementById('progression-modal')?.classList.remove('active');
        if (document.getElementById('char-sheet-modal')?.classList.contains('active')) ROS();
    };

    // Автоматически предлагаем стартовое снаряжение сразу после сохранения класса на 1 уровне
    const _ORIG_LKC_PR = window.LKC;
    if (typeof _ORIG_LKC_PR === 'function') {
        window.LKC = function() {
            _ORIG_LKC_PR();
            const c = GC()[PI];
            if (c && c.classLocked && !c._startingGearDone && (c.level || 1) === 1 && CLASS_GEAR[c.className]) {
                setTimeout(() => window.OPEN_STARTING_GEAR_MODAL(), 120);
            }
        };
    }

    // ================================================================
    // 3. СИСТЕМА ОПЫТА И АВТОМАТИЧЕСКОЕ ПОВЫШЕНИЕ УРОВНЯ (XP → LEVEL UP)
    // ================================================================
    window.CAN_HERO_LEVEL_UP = function(c) {
        if (!c || !c.className) return false;
        const lv = Math.max(1, parseInt(c.level, 10) || 1);
        if (lv >= 20) return false;
        return (parseInt(c.xp, 10) || 0) >= XPL(lv + 1);
    };

    function GET_HIT_DIE_SIDES(c) {
        const hdStr = (c && c.className && gameData.classes[c.className]?.hd) || c?.hitDice || '1к8';
        return parseInt(String(hdStr).replace(/\D/g, ''), 10) || 8;
    }

    function GET_LEVEL_UNLOCKS_PREVIEW(c, nextLv) {
        const items = [];
        const oldPb = GPB(nextLv - 1), newPb = GPB(nextLv);
        if (newPb > oldPb) items.push(`📈 Бонус мастерства вырастет: <b>+${oldPb} → +${newPb}</b>`);

        if (nextLv === 3 && !c.subclass) items.push('🎭 Откроется выбор <b>Подкласса</b>');

        let featLevels = [4, 8, 12, 16, 19];
        if (c.className === 'Воин') featLevels = [4, 6, 8, 12, 14, 16, 19];
        if (c.className === 'Плут') featLevels = [4, 8, 10, 12, 16, 19];
        if (featLevels.includes(nextLv)) items.push('🌟 Откроется <b>Повышение характеристик (+2) или Черта</b>');

        if (gameData.classFeatures && gameData.classFeatures[c.className]) {
            gameData.classFeatures[c.className]
                .filter(f => f.level === nextLv)
                .forEach(f => items.push(`⚡ Классовое умение: <b>${ESC(f.label)}</b>`));
        }

        const oldSlots = GET_SPELL_SLOTS(Object.assign({}, c, { level: nextLv - 1 }));
        const newSlots = GET_SPELL_SLOTS(Object.assign({}, c, { level: nextLv }));
        const slotDiffs = [];
        for (let i = 1; i <= 9; i++) {
            if ((newSlots[i] || 0) > (oldSlots[i] || 0)) {
                slotDiffs.push(`${i} кр.: ${oldSlots[i] || 0}→${newSlots[i]}`);
            }
        }
        if (slotDiffs.length) items.push(`💎 Новые ячейки магии: <b>${slotDiffs.join(', ')}</b>`);

        const testChar = Object.assign({}, c, { level: nextLv });
        const spellDef = (typeof GET_KNOWN_SPELLS_DEFICIT === 'function') ? GET_KNOWN_SPELLS_DEFICIT(testChar) : 0;
        if (spellDef > 0) items.push(`✨ Можно изучить новые заклинания: <b>${spellDef}</b>`);

        if (nextLv === 5 && ['Варвар', 'Воин', 'Монах', 'Паладин', 'Следопыт'].includes(c.className)) {
            items.push('⚔️ <b>Дополнительная атака</b> (2 атаки за Действие в бою)');
        }
        return items;
    }

    function SHOW_LEVEL_UP_TOAST(c) {
        const nextLv = (c.level || 1) + 1;
        let box = document.getElementById('prog-lvlup-toast');
        if (!box) {
            box = document.createElement('div');
            box.id = 'prog-lvlup-toast';
            box.style.cssText = 'position:fixed; bottom:20px; left:20px; max-width:340px; background:var(--ui-panel, #221f1c); border:2px solid var(--ui-accent, #d2b278); border-radius:12px; padding:12px 15px; color:var(--ui-text, #e5e0d7); box-shadow:0 12px 32px rgba(0,0,0,0.88); z-index:94900; cursor:pointer;';
            document.body.appendChild(box);
        }
        box.innerHTML = `
            <div style="font-weight:bold; color:var(--ui-accent, #d2b278); font-size:0.98rem;">🎉 Доступен Уровень ${nextLv}!</div>
            <div style="font-size:0.84rem; color:var(--ui-muted, #aaa); margin-top:3px;">
                Набрано <b>${c.xp || 0} / ${XPL(nextLv)} XP</b>. Нажмите, чтобы повысить уровень и рассчитать ХП.
            </div>
        `;
        box.style.display = 'block';
        box.onclick = () => { box.style.display = 'none'; window.OPEN_LEVEL_UP_MODAL(); };
        if (lvlToastTimer) clearTimeout(lvlToastTimer);
        lvlToastTimer = setTimeout(() => { if (box) box.style.display = 'none'; }, 8000);
    }

    window.OPEN_LEVEL_UP_MODAL = function() {
        const cs = GC();
        const c = cs[PI];
        if (!c || !window.CAN_HERO_LEVEL_UP(c)) return;

        const curLv = Math.max(1, parseInt(c.level, 10) || 1);
        const nextLv = curLv + 1;
        const hd = GET_HIT_DIE_SIDES(c);
        const avgRoll = Math.floor(hd / 2) + 1;
        const cm = GM(c.con || 10);
        const hillBonus = (c.race === 'Дварф' && c.subrace === 'Холмовой') ? 1 : 0;
        const toughBonus = (c.chosenFeats && c.chosenFeats.includes('Стойкий')) ? 2 : 0;
        const extraFlat = hillBonus + toughBonus;

        const avgGain = Math.max(1, avgRoll + cm) + extraFlat;
        const rolledDie = (c._pendingHpRollFor === nextLv && c._pendingHpRollVal) ? c._pendingHpRollVal : null;
        const rolledGain = rolledDie ? (Math.max(1, rolledDie + cm) + extraFlat) : null;

        const unlocks = GET_LEVEL_UNLOCKS_PREVIEW(c, nextLv);
        const modal = ENSURE_PROG_MODAL();
        const cont = document.getElementById('progression-modal-content');

        const bonusBreakdown = [
            cm !== 0 ? `Тел ${MS(cm)}` : null,
            hillBonus ? 'Холм. дварф +1' : null,
            toughBonus ? 'Стойкий +2' : null
        ].filter(Boolean).join(', ');

        cont.innerHTML = `
            <h2 style="margin-top:0;">🎉 Повышение уровня: ${curLv} → ${nextLv}</h2>
            <div style="background:var(--ui-panel2, #161412); border:1px solid var(--ui-border, #3e372f); border-radius:9px; padding:12px 14px; margin-bottom:12px; text-align:left; font-size:0.9rem;">
                <div style="font-weight:700; color:var(--ui-accent, #d2b278); margin-bottom:6px;">Что откроется на ${nextLv}-м уровне (${ESC(c.className)}):</div>
                ${unlocks.length
                    ? unlocks.map(u => `<div style="margin:3px 0;">• ${u}</div>`).join('')
                    : `<div style="color:var(--ui-muted, #aaa);">• Увеличение максимума ХП и +1 Кость Хитов (1к${hd})</div>`}
            </div>

            <div style="background:var(--ui-panel2, #161412); border:1px solid var(--ui-border-strong, #695c4c); border-radius:9px; padding:12px 14px; margin-bottom:14px; text-align:left;">
                <div style="font-weight:700; color:var(--ui-accent, #d2b278); margin-bottom:6px;">❤️ Прирост максимума ХП (кость 1к${hd}${bonusBreakdown ? ' • ' + bonusBreakdown : ''}):</div>
                <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:8px;">
                    <button class="btn-save" style="padding:10px;" onclick="CONFIRM_HERO_LEVEL_UP('avg')">
                        📊 Среднее (D&D 5e)<br><small>+${avgGain} ХП (кость: ${avgRoll})</small>
                    </button>
                    ${rolledDie
                        ? `<button class="btn-cast" style="padding:10px;" onclick="CONFIRM_HERO_LEVEL_UP('roll')">
                            ✅ Взять бросок: +${rolledGain} ХП<br><small>Выпало ${rolledDie} на 1к${hd}</small>
                           </button>`
                        : `<button class="btn-cast" style="padding:10px;" onclick="ROLL_LEVEL_UP_HP_DIE()">
                            🎲 Бросить 1к${hd}<br><small>Рискнуть ради макс. ХП</small>
                           </button>`}
                </div>
            </div>

            <div style="text-align:right;">
                <button onclick="document.getElementById('progression-modal').classList.remove('active')">Позже</button>
            </div>
        `;
        modal.classList.add('active');
    };

    window.ROLL_LEVEL_UP_HP_DIE = function() {
        const cs = GC();
        const c = cs[PI];
        if (!c || !window.CAN_HERO_LEVEL_UP(c)) return;
        const nextLv = (c.level || 1) + 1;
        const hd = GET_HIT_DIE_SIDES(c);
        c._pendingHpRollFor = nextLv;
        c._pendingHpRollVal = Math.floor(Math.random() * hd) + 1;
        SC(cs);
        window.OPEN_LEVEL_UP_MODAL();
    };

    window.CONFIRM_HERO_LEVEL_UP = function(mode) {
        const cs = GC();
        const c = cs[PI];
        if (!c || !window.CAN_HERO_LEVEL_UP(c)) return;

        const curLv = Math.max(1, parseInt(c.level, 10) || 1);
        const nextLv = curLv + 1;
        const hd = GET_HIT_DIE_SIDES(c);
        const chosenDie = (mode === 'roll' && c._pendingHpRollFor === nextLv && c._pendingHpRollVal)
            ? c._pendingHpRollVal
            : (Math.floor(hd / 2) + 1);

        if (!c._hpRolls || c._hpClass !== c.className) {
            c._hpRolls = { 1: hd };
            c._hpClass = c.className;
        }
        c._hpRolls[nextLv] = chosenDie;
        delete c._pendingHpRollFor;
        delete c._pendingHpRollVal;

        const oldMaxHp = c.maxHp || 10;
        c.level = nextLv;
        c._spellsOffered = false;
        AB(c);
        ADD_SUBCLASS_SPELLS(c);
        CHECK_CLASS_FEATURES(c);

        const hpGained = Math.max(1, (c.maxHp || oldMaxHp) - oldMaxHp);
        SC(cs);

        // Обновляем фишку героя на карте (если он уже выставлен)
        const st = GET_MAP_STATE();
        const myTok = st && st.tokens && st.tokens.find(t => t.isPlayer && t.charIdx === PI);
        if (myTok) {
            myTok.hp = c.hp;
            myTok.maxHp = c.maxHp;
            myTok.ac = CAC(c);
            SAVE_MAP_STATE(st);
        }

        document.getElementById('progression-modal')?.classList.remove('active');
        LOG_COMBAT_TO_CHAT(`🎉 повышает уровень до ${nextLv}-го! (+${hpGained} макс. ХП, теперь ${c.maxHp} ХП)`);
        RMC();
        RPL();
        if (typeof RENDER_MAP_AREA === 'function') RENDER_MAP_AREA();

        // Если на новом уровне открылись выборы (подкласс, черта/ASI, заклинания) — открываем Лист прямо на них
        const hasPending = (c.pendingChoices || []).some(p => ['asi_or_feat', 'feat', 'expertise'].includes(p.type))
            || (nextLv >= 3 && !c.subclass)
            || ((typeof GET_KNOWN_SPELLS_DEFICIT === 'function') && GET_KNOWN_SPELLS_DEFICIT(c) > 0);

        if (window.CAN_HERO_LEVEL_UP(c)) {
            window.OPEN_LEVEL_UP_MODAL();
        } else if (hasPending) {
            window._sheetTab = 'main';
            OCS();
        } else {
            showMessage(`🎉 Уровень ${nextLv}!`, `Поздравляем! Ваш персонаж достиг <b>${nextLv}-го уровня</b> (+${hpGained} макс. ХП).`);
        }
    };

    // ================================================================
    // 4. ИНТЕГРАЦИЯ В КАРТОЧКУ ГЕРОЯ, ЛИСТ ПЕРСОНАЖА И ОКНО НАГРАД ГМ
    // ================================================================
    const _ORIG_RMC_PR = window.RMC;
    if (typeof _ORIG_RMC_PR === 'function') {
        window.RMC = function() {
            _ORIG_RMC_PR();
            const sess = (typeof GET_SESSION === 'function') ? GET_SESSION() : null;
            if (!sess || sess.role !== 'player') return;
            const card = document.querySelector('#left-column .char-card');
            if (!card) return;
            card.querySelectorAll('[data-prog-xp-bar]').forEach(el => el.remove());

            const c = GC()[PI];
            if (!c) return;
            const lv = Math.max(1, parseInt(c.level, 10) || 1);
            const curXp = Math.max(0, parseInt(c.xp, 10) || 0);
            const canUp = window.CAN_HERO_LEVEL_UP(c);
            const prevThresh = XPL(lv);
            const nextThresh = lv >= 20 ? prevThresh : XPL(lv + 1);
            const pct = lv >= 20 ? 100 : Math.max(0, Math.min(100, Math.round(((curXp - prevThresh) / Math.max(1, nextThresh - prevThresh)) * 100)));

            const wrap = document.createElement('div');
            wrap.setAttribute('data-prog-xp-bar', '1');
            wrap.style.cssText = 'margin:6px 0 2px 0;';

            if (canUp) {
                wrap.innerHTML = `<button class="btn-save" style="width:100%; padding:6px 8px; font-size:0.84rem;" onclick="OPEN_LEVEL_UP_MODAL()">⬆️ Доступен Ур. ${lv + 1}! Повысить уровень</button>`;
                const nKey = `${c.id || PI}_${lv + 1}`;
                if (lastLevelUpNotifiedKey !== nKey) {
                    lastLevelUpNotifiedKey = nKey;
                    SHOW_LEVEL_UP_TOAST(c);
                }
            } else {
                wrap.innerHTML = `
                    <div style="display:flex; justify-content:space-between; font-size:0.74rem; color:var(--ui-muted, #9a9286); margin-bottom:2px;">
                        <span>✨ Опыт (Ур. ${lv})</span>
                        <span>${lv >= 20 ? 'МАКС' : `${curXp} / ${nextThresh} XP`}</span>
                    </div>
                    <div style="width:100%; height:5px; background:var(--ui-panel2, #141312); border-radius:4px; overflow:hidden; border:1px solid var(--ui-border, #3e372f);">
                        <div style="width:${pct}%; height:100%; background:var(--ui-accent, #d2b278); transition:width 0.25s;"></div>
                    </div>`;
            }

            const hpBar = card.querySelector('.hp-bar');
            if (hpBar) hpBar.after(wrap);
            else card.appendChild(wrap);
        };
    }

    // Кнопки «⬆️ Повысить уровень» и «🎒 Стартовое снаряжение» в верхней полосе алертов Листа персонажа
    const _ORIG_OCS_PR = window.OCS;
    if (typeof _ORIG_OCS_PR === 'function') {
        window.OCS = function() {
            _ORIG_OCS_PR();
            const cont = document.getElementById('char-sheet-content');
            const c = GC()[PI];
            if (!cont || !c) return;
            const h2 = cont.querySelector('h2');
            if (!h2) return;

            if (window.CAN_HERO_LEVEL_UP(c) && !cont.querySelector('[data-prog-sheet-lvl]')) {
                const btn = document.createElement('button');
                btn.className = 'btn-save';
                btn.setAttribute('data-prog-sheet-lvl', '1');
                btn.style.cssText = 'margin-right:8px; margin-bottom:10px;';
                btn.textContent = `⬆️ Повысить уровень (${c.level || 1} → ${(c.level || 1) + 1})`;
                btn.onclick = () => window.OPEN_LEVEL_UP_MODAL();
                h2.after(btn);
            }

            if (c.classLocked && !c._startingGearDone && (c.level || 1) === 1 && CLASS_GEAR[c.className] && !cont.querySelector('[data-prog-sheet-gear]')) {
                const btn = document.createElement('button');
                btn.className = 'btn-save';
                btn.setAttribute('data-prog-sheet-gear', '1');
                btn.style.cssText = 'margin-right:8px; margin-bottom:10px;';
                btn.textContent = '🎒 Выбрать стартовое снаряжение';
                btn.onclick = () => window.OPEN_STARTING_GEAR_MODAL();
                h2.after(btn);
            }
        };
    }

    // Автоподсчёт XP за поверженных врагов + опция «Веха (+1 ур.)» в окне Наград Гейм-Мастера
    function ESTIMATE_TOKEN_XP(tok) {
        if (tok.xp && parseInt(tok.xp, 10) > 0) return parseInt(tok.xp, 10);
        const hp = parseInt(tok.maxHp, 10) || 15;
        if (hp <= 15) return 50;
        if (hp <= 30) return 100;
        if (hp <= 50) return 200;
        if (hp <= 85) return 450;
        if (hp <= 130) return 700;
        return 1100;
    }

    const _ORIG_OPEN_REW = window.OPEN_GM_REWARD_MODAL;
    if (typeof _ORIG_OPEN_REW === 'function') {
        window.OPEN_GM_REWARD_MODAL = function() {
            _ORIG_OPEN_REW();
            const cont = document.getElementById('gm-tool-modal-content');
            const xpInp = document.getElementById('gm-rew-xp');
            if (!cont || !xpInp) return;

            const rc = (typeof GET_ACTIVE_ROOM_CODE === 'function') ? GET_ACTIVE_ROOM_CODE() : null;
            const partyCnt = Math.max(1, (typeof GET_ROOM_PARTY_INDICES === 'function' ? GET_ROOM_PARTY_INDICES(rc).length : GC().length));
            const deadEnemies = (GET_MAP_STATE().tokens || []).filter(t => !t.isPlayer && (t.hp ?? 0) <= 0);
            const totalDeadXp = deadEnemies.reduce((sum, t) => sum + ESTIMATE_TOKEN_XP(t), 0);
            const perHeroXp = Math.round(totalDeadXp / partyCnt);

            const sendBtn = cont.querySelector('button[onclick="GM_SEND_REWARD()"]');
            if (!sendBtn || cont.querySelector('#gm-rew-prog-extras')) return;

            const extras = document.createElement('div');
            extras.id = 'gm-rew-prog-extras';
            extras.style.cssText = 'display:flex; flex-direction:column; gap:8px; text-align:left;';
            extras.innerHTML = `
                ${deadEnemies.length > 0 ? `
                    <button class="btn-small" style="text-align:left; padding:7px 10px;" onclick="document.getElementById('gm-rew-xp').value=${perHeroXp};">
                        💀 Подставить XP за поверженных врагов на карте (${deadEnemies.length} шт. = ${totalDeadXp} XP → по <b>+${perHeroXp} XP</b> каждому)
                    </button>` : ''}
                <label style="display:flex; align-items:center; gap:8px; cursor:pointer; background:var(--ui-panel, #221f1c); border:1px solid var(--ui-border, #3e372f); padding:8px 10px; border-radius:7px; font-size:0.88rem;">
                    <input type="checkbox" id="gm-rew-milestone-lvl" style="width:auto;">
                    <span>⬆️ <b>Повышение по Вехе (+1 уровень):</b> дотянуть опыт до следующего уровня (игрокам откроется Level Up)</span>
                </label>
            `;
            sendBtn.before(extras);
        };
    }

    const _ORIG_SEND_REW = window.GM_SEND_REWARD;
    if (typeof _ORIG_SEND_REW === 'function') {
        window.GM_SEND_REWARD = function() {
            const isMilestone = !!document.getElementById('gm-rew-milestone-lvl')?.checked;
            if (!isMilestone) return _ORIG_SEND_REW();

            const target = document.getElementById('gm-rew-target')?.value || 'all';
            const rc = (typeof GET_ACTIVE_ROOM_CODE === 'function') ? GET_ACTIVE_ROOM_CODE() : null;
            const cs = GC();
            const indices = target === 'all'
                ? (typeof GET_ROOM_PARTY_INDICES === 'function' ? GET_ROOM_PARTY_INDICES(rc) : cs.map((_, i) => i))
                : [parseInt(target, 10)];

            indices.forEach(i => {
                if (!cs[i]) return;
                const fn = ch => {
                    const lv = Math.max(1, parseInt(ch.level, 10) || 1);
                    if (lv < 20) ch.xp = Math.max(parseInt(ch.xp, 10) || 0, XPL(lv + 1));
                };
                if (typeof MUTATE_HERO_IN_ROOM === 'function') MUTATE_HERO_IN_ROOM(cs[i], rc, fn);
                else fn(cs[i]);
            });
            SC(cs);

            const hasOther = !!(document.getElementById('gm-rew-item')?.value.trim()
                || parseInt(document.getElementById('gm-rew-gold')?.value, 10) > 0
                || parseInt(document.getElementById('gm-rew-xp')?.value, 10) > 0);
            if (hasOther) {
                _ORIG_SEND_REW();
            } else {
                RPL();
                localStorage.setItem('dnd_gm_event', JSON.stringify({
                    id: Date.now(), target,
                    title: '🎉 Новая Веха (Level Up)!',
                    text: 'Гейм-Мастер открыл вам переход на <b>следующий уровень</b>! Нажмите кнопку <b>«⬆️ Повысить уровень»</b> в карточке героя.'
                }));
                LOG_COMBAT_TO_CHAT('🎉 Гейм-Мастер выдал повышение уровня по Вехе!');
                CM('gm-tool-modal');
                showMessage('✅ Веха выдана', 'У выбранных игроков открылось повышение уровня!');
            }
        };
    }

    if (typeof RMC === 'function') RMC();
})();