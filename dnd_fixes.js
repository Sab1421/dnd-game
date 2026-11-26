// ================================================================
// 🛠️ АУДИТ И ИСПРАВЛЕНИЯ D&D 5e (dnd_fixes.js)
// Чинит: дубли/базу заклинаний, Колдуна и все маг-классы, ап-каст,
// урон/лечение заклинаниями в бою BG3, КБ (щит+доспех), пул очков
// у рас/черт, расовые требования и эффекты черт, броски ROLL.
// ================================================================
(function INIT_DND_CORE_FIXES() {
    if (typeof gameData === 'undefined') return;

    // ================================================================
    // 1. БАЗА ЗАКЛИНАНИЙ: УБИРАЕМ ДУБЛИ, ЧИНИМ КРУГИ, ДОБАВЛЯЕМ ПРОПУСКИ
    // ================================================================
    (function PATCH_SPELLS_DATABASE() {
        const spells = gameData.spells || [];

        // Убираем известные дубликаты (оставляя каноничный круг D&D 5e)
        const dropExact = [
            { name: 'Свобода передвижения', level: 2 },
            { name: 'Массовое лечение ран', level: 6 },
            { name: 'Остановка времени', level: 8 },
            { name: 'Конус холода', level: 3 },
            { name: 'Невидимость (высшая)', level: 3 }
        ];

        const seenNames = new Set();
        const cleaned = [];
        spells.forEach(sp => {
            if (!sp || !sp.name) return;
            if (dropExact.some(d => d.name === sp.name && d.level === sp.level)) return;

            // Разрушительная волна — заклинание 5-го круга Паладина (и Жреца Бури)
            if (sp.name === 'Разрушительная волна' && sp.level === 8) {
                sp.level = 5;
                if (!sp.classes.includes('Жрец')) sp.classes.push('Жрец');
            }

            if (seenNames.has(sp.name)) return;
            seenNames.add(sp.name);
            cleaned.push(sp);
        });

        // Добавляем недостающие базовые заклинания, на которые ссылаются классы, подклассы и расы
        const missingSpells = [
            // Заговоры
            { name: "Мистический заряд", level: 0, school: "Воплощение", time: "1 д.", range: "120 фт.", duration: "Мгн.", classes: ["Колдун"], desc: "Луч энергии наносит 1к10 урона силовым полем (доп. лучи на 5, 11 и 17 ур.)." },
            { name: "Указание", level: 0, school: "Прорицание", time: "1 д.", range: "Касание", duration: "Конц,1мин.", classes: ["Жрец", "Друид"], desc: "Цель добавляет 1к4 к одной проверке характеристики." },
            { name: "Терновый кнут", level: 0, school: "Преобразование", time: "1 д.", range: "30 фт.", duration: "Мгн.", classes: ["Друид"], desc: "1к6 колющего урона и притягивает цель на 10 фт." },
            { name: "Дубинка", level: 0, school: "Преобразование", time: "1 бонус.д.", range: "Касание", duration: "1 мин.", classes: ["Друид"], desc: "Дубинка или посох бьёт 1к8 дробящего с модификатором Мудрости." },
            { name: "Свет", level: 0, school: "Воплощение", time: "1 д.", range: "Касание", duration: "1 час", classes: ["Бард", "Волшебник", "Жрец", "Чародей"], desc: "Предмет излучает яркий свет в радиусе 20 фт." },
            { name: "Фокусы", level: 0, school: "Преобразование", time: "1 д.", range: "10 фт.", duration: "1 час", classes: ["Бард", "Волшебник", "Колдун", "Чародей"], desc: "Малый магический трюк: искры, звук, запах или чистка вещей." },
            { name: "Электрошок", level: 0, school: "Воплощение", time: "1 д.", range: "Касание", duration: "Мгн.", classes: ["Волшебник", "Чародей"], desc: "1к8 урона молнией, цель теряет реакции до своего хода." },

            // 1 круг
            { name: "Сглаз", level: 1, school: "Ограждение", time: "1 бонус.д.", range: "90 фт.", duration: "Конц,1час", classes: ["Колдун"], desc: "Ваши атаки по цели наносят +1к6 некротического урона; помеха проверкам 1 хар-ки." },
            { name: "Метка охотника", level: 1, school: "Прорицание", time: "1 бонус.д.", range: "90 фт.", duration: "Конц,1час", classes: ["Следопыт"], desc: "Ваши атаки оружием по цели наносят +1к6 урона; преимущество на выслеживание." },
            { name: "Град шипов", level: 1, school: "Вызов", time: "1 бонус.д.", range: "На себя", duration: "Конц,1мин.", classes: ["Следопыт"], desc: "Следующая дальнобойная атака взрывается шипами: 1к10 колющего урона в 5 фт." },
            { name: "Опутывающий удар", level: 1, school: "Вызов", time: "1 бонус.д.", range: "На себя", duration: "Конц,1мин.", classes: ["Следопыт"], desc: "При попадании оружием лозы опутывают цель и наносят 1к6 колющего урона в ход." },
            { name: "Скороход", level: 1, school: "Преобразование", time: "1 д.", range: "Касание", duration: "1 час", classes: ["Бард", "Волшебник", "Друид", "Следопыт"], desc: "Скорость цели увеличивается на +10 фт." },
            { name: "Туманное облако", level: 1, school: "Вызов", time: "1 д.", range: "120 фт.", duration: "Конц,1час", classes: ["Волшебник", "Друид", "Следопыт", "Чародей"], desc: "Создаёт сферу густого тумана радиусом 20 фт." },
            { name: "Святилище", level: 1, school: "Абсолют", time: "1 бонус.д.", range: "30 фт.", duration: "1 мин.", classes: ["Жрец", "Паладин"], desc: "Атакующие цель враги должны пройти спасбросок Мудрости." },
            { name: "Лечащее слово", level: 1, school: "Воплощение", time: "1 бонус.д.", range: "60 фт.", duration: "Мгн.", classes: ["Бард", "Друид", "Жрец"], desc: "Восстанавливает 1к4 + мод. хар-ки ХП на расстоянии." },
            { name: "Клеймящая кара", level: 1, school: "Воплощение", time: "1 бонус.д.", range: "На себя", duration: "Конц,1мин.", classes: ["Паладин"], desc: "Следующий удар оружием наносит +1к6 урона огнём и поджигает цель." },
            { name: "Громовая кара", level: 1, school: "Воплощение", time: "1 бонус.д.", range: "На себя", duration: "Конц,1мин.", classes: ["Паладин"], desc: "Следующий удар оружием наносит +2к6 урона громом и отталкивает на 10 фт." },
            { name: "Щит веры", level: 1, school: "Абсолют", time: "1 бонус.д.", range: "60 фт.", duration: "Конц,10мин.", classes: ["Жрец", "Паладин"], desc: "Цель получает +2 к КБ." },
            { name: "Героизм", level: 1, school: "Ограждение", time: "1 д.", range: "Касание", duration: "Конц,1мин.", classes: ["Бард", "Паладин"], desc: "Иммунитет к испугу и временные ХП = мод. хар-ки каждый ход." },
            { name: "Нанесение ран", level: 1, school: "Некромантия", time: "1 д.", range: "Касание", duration: "Мгн.", classes: ["Жрец"], desc: "3к10 некротического урона при попадании заклинанием вблизи." },
            { name: "Направляющий снаряд", level: 1, school: "Воплощение", time: "1 д.", range: "120 фт.", duration: "Мгн.", classes: ["Жрец"], desc: "4к6 урона излучением; следующая атака по цели с преимуществом." },
            { name: "Опутывание", level: 1, school: "Вызов", time: "1 д.", range: "90 фт.", duration: "Конц,1мин.", classes: ["Друид"], desc: "Корни и лозы опутывают существ в квадрате 20 фт." },
            { name: "Огонь фей", level: 1, school: "Воплощение", time: "1 д.", range: "60 фт.", duration: "Конц,1мин.", classes: ["Бард", "Друид"], desc: "Подсвечивает цели в 20-фт. кубе: атаки по ним с преимуществом." },
            { name: "Обнаружение магии", level: 1, school: "Прорицание", time: "1 д.", range: "На себя", duration: "Конц,10мин.", classes: ["Бард", "Волшебник", "Друид", "Жрец", "Паладин", "Следопыт", "Чародей"], desc: "Ощущаете магию и её школы в радиусе 30 фт." },

            // 2 круг
            { name: "Бесследное передвижение", level: 2, school: "Абсолют", time: "1 д.", range: "На себя", duration: "Конц,1час", classes: ["Друид", "Следопыт"], desc: "+10 к Скрытности всем союзникам в 30 фт." },
            { name: "Шипы", level: 2, school: "Преобразование", time: "1 д.", range: "150 фт.", duration: "Конц,10мин.", classes: ["Друид", "Следопыт"], desc: "Трудная местность в 20 фт.: 2к4 колющего урона за каждые 5 фт движения." },
            { name: "Малое восстановление", level: 2, school: "Абсолют", time: "1 д.", range: "Касание", duration: "Мгн.", classes: ["Бард", "Друид", "Жрец", "Паладин", "Следопыт"], desc: "Снимает болезнь, слепоту, глухоту, паралич или отравление." },
            { name: "Духовное оружие", level: 2, school: "Воплощение", time: "1 бонус.д.", range: "60 фт.", duration: "1 мин.", classes: ["Жрец"], desc: "Призрачное оружие атакует на 1к8 + мод. Мудрости урона силовым полем." },
            { name: "Подмога", level: 2, school: "Абсолют", time: "1 д.", range: "30 фт.", duration: "8 час.", classes: ["Жрец", "Паладин"], desc: "Увеличивает макс. и текущие ХП до 3 союзников на +5." },
            { name: "Лунный луч", level: 2, school: "Воплощение", time: "1 д.", range: "120 фт.", duration: "Конц,1мин.", classes: ["Друид"], desc: "Луч лунного света наносит 2к10 урона излучением (спас Тел)." },
            { name: "Пылающий шар", level: 2, school: "Вызов", time: "1 д.", range: "60 фт.", duration: "Конц,1мин.", classes: ["Волшебник", "Друид"], desc: "Огненная сфера наносит 2к6 урона огнём в конце хода." },
            { name: "Древесная кожа", level: 2, school: "Преобразование", time: "1 д.", range: "Касание", duration: "Конц,1час", classes: ["Друид", "Следопыт"], desc: "КБ цели не может быть ниже 16." },
            { name: "Поиск скакуна", level: 2, school: "Вызов", time: "10 мин.", range: "30 фт.", duration: "Мгн.", classes: ["Паладин"], desc: "Призывает верного духовного скакуна." },

            // 3 круг
            { name: "Духовные стражи", level: 3, school: "Вызов", time: "1 д.", range: "На себя (15 фт.)", duration: "Конц,10мин.", classes: ["Жрец"], desc: "Духи замедляют врагов и наносят 3к8 урона излучением каждый ход." },
            { name: "Аура живучести", level: 3, school: "Воплощение", time: "1 д.", range: "На себя (30 фт.)", duration: "Конц,1мин.", classes: ["Паладин"], desc: "Бонусным действием лечите существо в ауре на 2к6 ХП." },
            { name: "Призыв заграждения", level: 3, school: "Вызов", time: "1 д.", range: "На себя (60 фт. конус)", duration: "Мгн.", classes: ["Следопыт"], desc: "Град снарядов наносит 3к8 урона (спас Ловк)." },
            { name: "Хождение по воде", level: 3, school: "Преобразование", time: "1 д.", range: "30 фт.", duration: "1 час", classes: ["Друид", "Жрец", "Следопыт"], desc: "До 10 существ могут идти по воде и лаве." },

            // 4 круг
            { name: "Защита от смерти", level: 4, school: "Абсолют", time: "1 д.", range: "Касание", duration: "8 час.", classes: ["Жрец", "Паладин"], desc: "При падении ХП до 0 цель остаётся с 1 ХП (однократно)." },
            { name: "Ошеломляющая кара", level: 4, school: "Воплощение", time: "1 бонус.д.", range: "На себя", duration: "Конц,1мин.", classes: ["Паладин"], desc: "Следующий удар оружием наносит +4к6 психического урона." },
            { name: "Аура жизни", level: 4, school: "Абсолют", time: "1 д.", range: "На себя (30 фт.)", duration: "Конц,1мин.", classes: ["Паладин"], desc: "Союзники в ауре с 0 ХП восстанавливают 1 ХП в начале хода." }
        ];

        missingSpells.forEach(sp => {
            if (!seenNames.has(sp.name)) {
                seenNames.add(sp.name);
                cleaned.push(sp);
            }
        });

        gameData.spells = cleaned;

        // Чиним таблицу Арканумов Колдуна на 13–20 уровнях (чтобы не терялись 6–8 круги при скачке уровней)
        const wt = gameData.knownSpellsTable && gameData.knownSpellsTable['Колдун'];
        if (wt) {
            if (wt[13]) wt[13] = { 0: 4, 1: 12, 6: 1, 7: 1 };
            if (wt[14]) wt[14] = { 0: 4, 1: 12, 6: 1, 7: 1 };
            if (wt[15]) wt[15] = { 0: 4, 1: 13, 6: 1, 7: 1, 8: 1 };
            if (wt[16]) wt[16] = { 0: 4, 1: 13, 6: 1, 7: 1, 8: 1 };
            if (wt[17]) wt[17] = { 0: 4, 1: 14, 6: 1, 7: 1, 8: 1, 9: 1 };
            if (wt[18]) wt[18] = { 0: 4, 1: 14, 6: 1, 7: 1, 8: 1, 9: 1 };
            if (wt[19]) wt[19] = { 0: 4, 1: 15, 6: 1, 7: 1, 8: 1, 9: 1 };
            if (wt[20]) wt[20] = { 0: 4, 1: 15, 6: 1, 7: 1, 8: 1, 9: 1 };
        }

        // Добавляем черту «Использование двух оружий» (на неё ссылается script.js, но её не было в gameData.feats!)
        if (Array.isArray(gameData.feats) && !gameData.feats.some(f => f.name === 'Использование двух оружий')) {
            gameData.feats.push({
                name: "Использование двух оружий",
                desc: "+1 к КБ с двумя оружиями; можно держать в обеих руках не-лёгкое одноручное оружие.",
                effect: {
                    autoAbilities: "+1 к КБ, когда в обеих руках по рукопашному оружию. Можно сражаться двумя одноручными оружиями без свойства «лёгкое»."
                }
            });
        }

        // Добавляем недостающую вторую Экспертность Барду (10 ур.) и Плуту (6 ур.)
        if (gameData.classFeatures) {
            if (Array.isArray(gameData.classFeatures['Плут']) && !gameData.classFeatures['Плут'].some(f => f.level === 6)) {
                gameData.classFeatures['Плут'].push({ level: 6, type: 'expertise', label: 'Экспертность (6 ур.)', count: 2, options: [] });
            }
            if (Array.isArray(gameData.classFeatures['Бард']) && !gameData.classFeatures['Бард'].some(f => f.level === 10)) {
                gameData.classFeatures['Бард'].push({ level: 10, type: 'expertise', label: 'Экспертность (10 ур.)', count: 2, options: [] });
            }
        }
    })();

    // ================================================================
    // 2. НАДЁЖНЫЙ ROLL (ПОДДЕРЖКА d/к И СМЕШАННЫХ + / -)
    // ================================================================
    window.ROLL = function(formula) {
        if (!formula) return 0;
        const clean = String(formula).toLowerCase().replace(/\s+/g, '').replace(/[dд]/g, 'к');
        const tokens = clean.match(/[+-]?[^+-]+/g);
        if (!tokens) return parseInt(clean, 10) || 0;
        let total = 0;
        tokens.forEach(tok => {
            const sign = tok.startsWith('-') ? -1 : 1;
            const body = tok.replace(/^[+-]/, '');
            if (body.includes('к')) {
                const [cStr, sStr] = body.split('к');
                const cnt = Math.max(1, Math.min(50, parseInt(cStr, 10) || 1));
                const sides = Math.max(2, Math.min(1000, parseInt(sStr, 10) || 6));
                for (let i = 0; i < cnt; i++) total += sign * (Math.floor(Math.random() * sides) + 1);
            } else {
                total += sign * (parseInt(body, 10) || 0);
            }
        });
        return total;
    };

    // Бросок урона заклинания с учётом черты «Стихийный адепт» (1 и 2 считаются за 3)
    function ROLL_SPELL_DAMAGE_FOR_CHAR(c, formula, spellDesc) {
        const elems = (c && Array.isArray(c.elementalAdeptTypes)) ? c.elementalAdeptTypes : [];
        const lowDesc = String(spellDesc || '').toLowerCase();
        const elemRegex = {
            'Огонь': /огн|пылающ/,
            'Холод': /холод|мороз|лед/,
            'Молния': /молн|электр/,
            'Гром': /гром/,
            'Кислота': /кислот/
        };
        const adeptActive = elems.some(el => elemRegex[el] && elemRegex[el].test(lowDesc));
        if (!adeptActive) return { total: window.ROLL(formula), adeptUsed: false };

        const clean = String(formula || '').toLowerCase().replace(/\s+/g, '').replace(/[dд]/g, 'к');
        const tokens = clean.match(/[+-]?[^+-]+/g) || [];
        let total = 0;
        tokens.forEach(tok => {
            const sign = tok.startsWith('-') ? -1 : 1;
            const body = tok.replace(/^[+-]/, '');
            if (body.includes('к')) {
                const [cStr, sStr] = body.split('к');
                const cnt = Math.max(1, Math.min(50, parseInt(cStr, 10) || 1));
                const sides = Math.max(2, Math.min(1000, parseInt(sStr, 10) || 6));
                for (let i = 0; i < cnt; i++) {
                    const r = Math.floor(Math.random() * sides) + 1;
                    total += sign * (r <= 2 ? 3 : r);
                }
            } else {
                total += sign * (parseInt(body, 10) || 0);
            }
        });
        return { total, adeptUsed: true };
    }

    // ================================================================
    // 3. ФИКС КБ (НЕ ЗАВИСИТ ОТ ПОРЯДКА ЩИТ / ДОСПЕХ + ДВА ОРУЖИЯ)
    // ================================================================
    window.CAC = function(c) {
        if (!c) return 10;
        const dm = GM(c.dex || 10), cm = GM(c.con || 10), wm = GM(c.wis || 10);
        const inv = c.inventory || [];

        let armorAc = null;
        let shieldBonus = 0;
        let ringBonus = 0;
        let meleeWeaponsEquipped = 0;
        c.hasArmorPenalty = false;

        inv.forEach(i => {
            if (!i || !i.equipped) return;
            const iName = (i.name || '').toLowerCase().replace(/ё/g, 'е');
            if (iName.includes('кольцо защиты')) ringBonus += 1;

            const isShield = !!(i.isShield || i.type === 'shield');
            if (isShield) {
                if (typeof HAS_ARMOR_PROF === 'function' && !HAS_ARMOR_PROF(c, 'щит')) c.hasArmorPenalty = true;
                shieldBonus += parseInt(i.ac, 10) || 2;
                return;
            }
            if (i.ac && i.type !== 'potion') {
                const props = (i.properties || '').toLowerCase().replace(/ё/g, 'е');
                if (typeof HAS_ARMOR_PROF === 'function' && !HAS_ARMOR_PROF(c, props)) c.hasArmorPenalty = true;
                let calc = parseInt(i.ac, 10) + dm;
                if (props.includes('тяжелый')) calc = parseInt(i.ac, 10);
                else if (props.includes('средний')) calc = parseInt(i.ac, 10) + Math.min(Math.max(dm, -5), 2);
                armorAc = armorAc === null ? calc : Math.max(armorAc, calc);
            }
            if (i.isWeapon && !i.ranged) meleeWeaponsEquipped++;
        });

        let baseAc;
        if (armorAc !== null) {
            baseAc = armorAc;
        } else {
            baseAc = 10 + dm;
            if (c.className === 'Варвар') baseAc = Math.max(baseAc, 10 + dm + cm);
            if (c.className === 'Монах' && shieldBonus === 0) baseAc = Math.max(baseAc, 10 + dm + wm);
            if (c.chosenFeats && c.chosenFeats.includes('Драконья шкура')) baseAc = Math.max(baseAc, 13 + dm);
            if (c.race === 'Локсодон') baseAc = Math.max(baseAc, 12 + cm);
        }

        const dualWieldBonus = (c.chosenFeats && c.chosenFeats.includes('Использование двух оружий') && meleeWeaponsEquipped >= 2) ? 1 : 0;
        return baseAc + shieldBonus + ringBonus + dualWieldBonus;
    };

    // ================================================================
    // 4. ФИКС ПОЛУЭЛЬФА / ЧЕЙНДЖЛИНГА / ВЫСШЕГО ЭЛЬФА В LKR()
    // ================================================================
    window.LKR = function() {
        const cs = GC();
        const c = cs[PI];
        if (!c) return;
        c.raceLocked = true;
        AB(c);
        if (!c.pendingChoices) c.pendingChoices = [];
        if (!c._completedChoices) c._completedChoices = [];

        // Вариант человека: +1 к двум разным хар-кам и 1 Черта
        if (c.race === 'Человек' && c.subrace === 'Вариант') {
            if (!c._completedChoices.includes('Черта (вариант человека)') && !c.pendingChoices.some(p => p.label === 'Черта (вариант человека)')) {
                c.pendingChoices.push({ type: 'feat', label: 'Черта (вариант человека)', count: 1, options: [] });
            }
            const statNames = ['Сила', 'Ловкость', 'Телосложение', 'Интеллект', 'Мудрость', 'Харизма'];
            const codeByRus = { 'Сила': 'baseStr', 'Ловкость': 'baseDex', 'Телосложение': 'baseCon', 'Интеллект': 'baseInt', 'Мудрость': 'baseWis', 'Харизма': 'baseCha' };
            SC(cs);
            SHOW_OPTION_CHOICE('Вариант человека: Выберите 2 характеристики (+1)', statNames, 2, function(selected) {
                const fCs = GC(); const fC = fCs[PI];
                let gained = 0;
                selected.forEach(s => {
                    const k = codeByRus[s];
                    if (k && (fC[k] || 10) < 20) { fC[k] = (fC[k] || 10) + 1; gained++; }
                });
                fC._statBudgetTotal = (fC._statBudgetTotal || 72) + gained;
                AB(fC); SC(fCs); RMC(); ROS();
            });
            return;
        }

        // Полуэльф (+1 к двум кроме Харизмы) или Чейнджлинг (+1 к одной) — теперь увеличивает _statBudgetTotal!
        if (c.race === 'Полуэльф' || c.race === 'Чейнджлинг') {
            const count = c.race === 'Полуэльф' ? 2 : 1;
            const statNames = ['Сила', 'Ловкость', 'Телосложение', 'Интеллект', 'Мудрость'];
            const codeByRus = { 'Сила': 'baseStr', 'Ловкость': 'baseDex', 'Телосложение': 'baseCon', 'Интеллект': 'baseInt', 'Мудрость': 'baseWis' };
            SC(cs);
            SHOW_OPTION_CHOICE(c.race + ': Выберите ' + count + ' хар-ки (+1)', statNames, count, function(selected) {
                const fCs = GC(); const fC = fCs[PI];
                let gained = 0;
                selected.forEach(s => {
                    const k = codeByRus[s];
                    if (k && (fC[k] || 10) < 20) { fC[k] = (fC[k] || 10) + 1; gained++; }
                });
                fC._statBudgetTotal = (fC._statBudgetTotal || 72) + gained;
                AB(fC); SC(fCs); RMC(); ROS();
            });
            return;
        }

        // Высший эльф: бесплатный заговор Волшебника (не съедает классовые заговоры!)
        if (c.race === 'Эльф' && c.subrace === 'Высший') {
            const avail = gameData.spells.filter(sp => sp.level === 0 && sp.classes.includes('Волшебник') && !(c.knownSpells || []).includes(sp.name));
            SC(cs);
            if (avail.length > 0) {
                SHOW_SPELL_CHOICE(avail, 1, 'Высший эльф: выберите 1 заговор Волшебника', function(selected) {
                    const fCs = GC(); const fC = fCs[PI];
                    if (!fC.knownSpells) fC.knownSpells = [];
                    if (!fC._featBonusSpells) fC._featBonusSpells = [];
                    selected.forEach(n => {
                        if (!fC.knownSpells.includes(n)) fC.knownSpells.push(n);
                        if (!fC._featBonusSpells.includes(n)) fC._featBonusSpells.push(n);
                    });
                    SC(fCs);
                    closeModal('spell-choice-modal');
                    RMC(); ROS();
                });
                return;
            }
        }

        SC(cs);
        RMC();
        ROS();
    };

    // ================================================================
    // 5. ВЫБОР ЗАКЛИНАНИЙ (ВСЕ МАГ-КЛАССЫ + КОЛДУН БЕЗ КОНФЛИКТОВ И ЗАВИСАНИЙ)
    // ================================================================
    window.ADD_SUBCLASS_SPELLS = function(c) {
        if (!c || !c.className || !c.subclass || !gameData.classSubSpells) return;
        const classSub = gameData.classSubSpells[c.className];
        if (!classSub || !classSub[c.subclass]) return;
        const spellsByLevel = classSub[c.subclass];
        if (!c.knownSpells) c.knownSpells = [];
        if (!c._subclassBonusSpells) c._subclassBonusSpells = [];
        const aliasMap = { 'Сон': 'Усыпление' };
        let added = false;

        for (const [lvl, spells] of Object.entries(spellsByLevel)) {
            if ((c.level || 1) >= parseInt(lvl, 10)) {
                spells.forEach(rawName => {
                    const spName = aliasMap[rawName] || rawName;
                    const existsInDb = gameData.spells.some(s => s.name === spName);
                    if (existsInDb) {
                        if (!c.knownSpells.includes(spName)) {
                            c.knownSpells.push(spName);
                            added = true;
                        }
                        if (!c._subclassBonusSpells.includes(spName)) {
                            c._subclassBonusSpells.push(spName);
                            added = true;
                        }
                    }
                });
            }
        }
        if (added) {
            const cs = GC();
            cs[PI] = c;
            SC(cs);
        }
    };

    // Бонусные заклинания (от черт, рас и подклассов) не должны «съедать» классовые слоты изучения
    function GET_CLASS_ONLY_KNOWN(c) {
        const bonusSet = new Set([].concat(c._featBonusSpells || [], c._subclassBonusSpells || []));
        return (c.knownSpells || []).filter(n => !bonusSet.has(n));
    }

    function BUILD_SPELL_SELECTION_GROUPS(char) {
        if (!char || !char.className || !gameData.knownSpellsTable || !gameData.knownSpellsTable[char.className]) {
            return { groups: [], totalNeed: 0 };
        }
        const lv = char.level || 1;
        const cfg = gameData.knownSpellsTable[char.className][lv];
        if (!cfg) return { groups: [], totalNeed: 0 };

        const allKnown = char.knownSpells || [];
        const classKnown = GET_CLASS_ONLY_KNOWN(char);
        const groups = [];
        let totalNeed = 0;

        if (char.className === 'Колдун') {
            // 1. Заговоры Колдуна
            const knownCantrips = classKnown.filter(n =>
                gameData.spells.some(s => s.name === n && s.level === 0 && s.classes.includes('Колдун'))
            ).length;
            const rawCant = Math.max(0, (cfg[0] || 0) - knownCantrips);
            if (rawCant > 0) {
                const avail = gameData.spells.filter(s => s.classes.includes('Колдун') && s.level === 0 && !allKnown.includes(s.name));
                const realNeed = Math.min(rawCant, avail.length);
                if (realNeed > 0) {
                    groups.push({ id: 'cantrips', title: `Заговоры Колдуна (выберите до ${realNeed})`, max: realNeed, spells: avail });
                    totalNeed += realNeed;
                }
            }

            // 2. Заклинания Магии Договора (1..maxPactLevel)
            const maxPactLevel = lv >= 9 ? 5 : lv >= 7 ? 4 : lv >= 5 ? 3 : lv >= 3 ? 2 : 1;
            const targetPact = cfg[1] || 0;
            const knownPact = classKnown.filter(n =>
                gameData.spells.some(s => s.name === n && s.classes.includes('Колдун') && s.level >= 1 && s.level <= 5)
            ).length;
            const rawPact = Math.max(0, targetPact - knownPact);
            if (rawPact > 0) {
                const avail = gameData.spells
                    .filter(s => s.classes.includes('Колдун') && s.level >= 1 && s.level <= maxPactLevel && !allKnown.includes(s.name))
                    .sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));
                const realNeed = Math.min(rawPact, avail.length);
                if (realNeed > 0) {
                    groups.push({ id: 'pact', title: `Заклинания Договора 1–${maxPactLevel} круга (выберите до ${realNeed})`, max: realNeed, spells: avail });
                    totalNeed += realNeed;
                }
            }

            // 3. Таинственный Арканум (6–9 круг)
            for (let arcLv = 6; arcLv <= 9; arcLv++) {
                if (!cfg[arcLv]) continue;
                const knownArc = classKnown.filter(n =>
                    gameData.spells.some(s => s.name === n && s.classes.includes('Колдун') && s.level === arcLv)
                ).length;
                const rawArc = Math.max(0, cfg[arcLv] - knownArc);
                if (rawArc > 0) {
                    const avail = gameData.spells.filter(s => s.classes.includes('Колдун') && s.level === arcLv && !allKnown.includes(s.name));
                    const realNeed = Math.min(rawArc, avail.length);
                    if (realNeed > 0) {
                        groups.push({ id: 'arc_' + arcLv, title: `Таинственный Арканум ${arcLv}-го круга (выберите ${realNeed})`, max: realNeed, spells: avail });
                        totalNeed += realNeed;
                    }
                }
            }
        } else {
            const classSpellsAll = gameData.spells.filter(sp => sp.classes.includes(char.className));
            const levelsSorted = Object.keys(cfg).map(Number).sort((a, b) => a - b);

            levelsSorted.forEach(levelInt => {
                const targetCnt = cfg[levelInt] || 0;
                if (targetCnt <= 0) return;
                const knownCnt = classKnown.filter(n =>
                    classSpellsAll.some(sp => sp.name === n && sp.level === levelInt)
                ).length;
                const rawNeed = Math.max(0, targetCnt - knownCnt);
                if (rawNeed > 0) {
                    const avail = classSpellsAll
                        .filter(sp => sp.level === levelInt && !allKnown.includes(sp.name))
                        .sort((a, b) => a.name.localeCompare(b.name));
                    const realNeed = Math.min(rawNeed, avail.length);
                    if (realNeed > 0) {
                        groups.push({
                            id: 'lvl_' + levelInt,
                            title: (levelInt === 0 ? 'Заговоры' : `${levelInt}-й круг`) + ` (выберите до ${realNeed})`,
                            max: realNeed,
                            spells: avail
                        });
                        totalNeed += realNeed;
                    }
                }
            });
        }

        return { groups, totalNeed };
    }

    window.GET_KNOWN_SPELLS_DEFICIT = function(c) {
        return BUILD_SPELL_SELECTION_GROUPS(c).totalNeed;
    };

    window.OPEN_SPELL_SELECTION = function() {
        const csList = GC();
        const char = csList[PI];
        if (!char) return;
        if (!char.classLocked) {
            showMessage('🔒 Сначала сохраните класс', 'Нажмите кнопку «🔒 Сохранить класс», прежде чем выбирать заклинания!');
            return;
        }
        const lv = char.level || 1;
        const { groups, totalNeed } = BUILD_SPELL_SELECTION_GROUPS(char);

        if (totalNeed <= 0 || groups.length === 0) {
            char._spellsOffered = true;
            SC(csList);
            showMessage('✅ Все заклинания выбраны', 'Все доступные для вашего класса и уровня заклинания уже изучены.');
            ROS();
            return;
        }

        document.getElementById('spell-choice-title').textContent = `Изучение заклинаний (${char.className}, ур. ${lv})`;
        document.getElementById('spell-choice-info').textContent = `Отметьте нужные заклинания в каждой категории (доступно всего: ${totalNeed}):`;

        let listHtml = '<div style="display:flex; flex-direction:column; gap:10px; text-align:left;">';
        groups.forEach(g => {
            listHtml += `<div style="background:var(--ui-panel2, #222); border:1px solid var(--ui-border, #444); border-radius:8px; padding:9px;">` +
                `<div style="display:flex; justify-content:space-between; align-items:center; color:var(--ui-accent, #c9a96e); font-weight:bold; margin-bottom:6px;">` +
                `<span>${g.title}</span>` +
                `<small id="sp-cnt-${g.id}" style="color:var(--ui-muted, #aaa);">0 / ${g.max}</small>` +
                `</div>` +
                `<div style="display:flex; flex-direction:column; gap:4px;">`;
            g.spells.forEach(sp => {
                listHtml += `<label style="display:flex; align-items:flex-start; padding:6px 8px; background:var(--ui-panel, #333); border-radius:6px; cursor:pointer; font-size:0.85em;">` +
                    `<input type="checkbox" class="spell-check-grouped" data-group="${g.id}" data-max="${g.max}" value="${sp.name.replace(/"/g, '&quot;')}" style="width:auto; margin-right:8px; margin-top:3px;">` +
                    `<div><b>${sp.name}</b> <span style="color:var(--ui-accent, #c9a96e);">(${sp.level === 0 ? 'заговор' : sp.level + ' круг'})</span><br><small style="color:var(--ui-muted, #aaa);">${sp.desc}</small></div>` +
                    `</label>`;
            });
            listHtml += '</div></div>';
        });
        listHtml += '</div>';
        const listEl = document.getElementById('spell-choice-list');
        listEl.innerHTML = listHtml;

        // Живой счётчик и защита от превышения лимита в группе
        listEl.querySelectorAll('.spell-check-grouped').forEach(cb => {
            cb.addEventListener('change', function() {
                const gid = this.getAttribute('data-group');
                const max = parseInt(this.getAttribute('data-max'), 10) || 1;
                const checked = listEl.querySelectorAll(`.spell-check-grouped[data-group="${gid}"]:checked`);
                if (checked.length > max) {
                    this.checked = false;
                    return;
                }
                const cntEl = document.getElementById('sp-cnt-' + gid);
                if (cntEl) cntEl.textContent = `${checked.length} / ${max}`;
            });
        });

        const confirmBtn = document.getElementById('spell-choice-confirm');
        confirmBtn.onclick = function() {
            const allChecked = listEl.querySelectorAll('.spell-check-grouped:checked');
            if (allChecked.length === 0) {
                showMessage('Ошибка', 'Выберите хотя бы одно заклинание.');
                return;
            }
            const freshCs = GC();
            const freshChar = freshCs[PI];
            if (!freshChar) return;
            if (!freshChar.knownSpells) freshChar.knownSpells = [];
            Array.from(allChecked).forEach(cb => {
                if (!freshChar.knownSpells.includes(cb.value)) freshChar.knownSpells.push(cb.value);
            });
            if (window.GET_KNOWN_SPELLS_DEFICIT(freshChar) <= 0) freshChar._spellsOffered = true;
            SC(freshCs);
            closeModal('spell-choice-modal');
            ROS();
            RMC();
        };

        OM('spell-choice-modal');
    };

    // ================================================================
    // 6. ФИКС ЧЕРТ: РАСОВЫЕ ТРЕБОВАНИЯ, ПУЛ ОЧКОВ, УМЕЛЫЙ, СТИХИЙНЫЙ АДЕПТ
    //    И АТОМАРНОЕ СОХРАНЕНИЕ БЕЗ ДЮПА ПРИ ОТМЕНЕ
    // ================================================================
    const FEAT_RACE_REQ = {
        'Эльфийская точность': ['Эльф', 'Полуэльф'],
        'Драконья шкура': ['Драконорождённый'],
        'Драконий страх': ['Драконорождённый'],
        'Дварфийская стойкость': ['Дварф'],
        'Полуросликовая удача': ['Полурослик'],
        'Вторая удача': ['Полурослик'],
        'Гномья хитрость': ['Гном'],
        'Орочья свирепость': ['Полуорк'],
        'Человеческая решимость': ['Человек']
    };

    const TOOLS_LIST = [
        'Воровские инструменты', 'Инструменты алхимика', 'Инструменты кузнеца',
        'Инструменты травничества', 'Инструменты картографа', 'Инструменты плотника',
        'Инструменты ювелира', 'Инструменты кожевника', 'Набор для грима',
        'Набор отравителя', 'Навигаторские инструменты', 'Музыкальный инструмент'
    ];

    const ELEMENTS_LIST = ['Огонь', 'Холод', 'Молния', 'Гром', 'Кислота'];

    window.SHOW_FEAT_CHOICE_FOR_CHOICE = function(csArg, cArg, choice) {
        const freshCs = GC();
        const char = freshCs[PI];
        if (!char) return;
        const allFeats = gameData.feats || [];

        const available = allFeats.filter(f => {
            if ((char.chosenFeats || []).includes(f.name)) return false;
            const reqRaces = FEAT_RACE_REQ[f.name];
            if (reqRaces && char.race && !reqRaces.includes(char.race)) return false;
            return true;
        });

        if (available.length === 0) {
            REMOVE_PENDING_CHOICE(char, choice ? choice.label : '');
            SC(freshCs); RMC(); ROS();
            return;
        }

        // Не мутируем char.chosenFeats до завершения всех шагов (защита от отмены и дюпа)
        SHOW_FEAT_CHOICE(available, function(selectedFeat) {
            window.APPLY_FEAT_EFFECTS(null, null, selectedFeat, function() {
                const commitCs = GC();
                const commitChar = commitCs[PI];
                if (!commitChar) return;
                if (!commitChar.chosenFeats) commitChar.chosenFeats = [];
                if (!commitChar.chosenFeats.includes(selectedFeat)) commitChar.chosenFeats.push(selectedFeat);
                REMOVE_PENDING_CHOICE(commitChar, choice ? choice.label : '');
                AB(commitChar);
                RHP(commitChar);
                SC(commitCs);
                RMC();
                ROS();
            });
        });
    };

    window.APPLY_FEAT_EFFECTS = function(_unusedCs, _unusedChar, featName, doneCallback) {
        const feat = (gameData.feats || []).find(f => f.name === featName);
        if (!feat || !feat.effect) {
            if (doneCallback) doneCallback();
            return;
        }

        const effect = feat.effect;
        const statNames = { str: 'Сила', dex: 'Ловкость', con: 'Телосложение', intl: 'Интеллект', wis: 'Мудрость', cha: 'Харизма' };
        const codeByRus = { 'Сила': 'str', 'Ловкость': 'dex', 'Телосложение': 'con', 'Интеллект': 'intl', 'Мудрость': 'wis', 'Харизма': 'cha' };

        const collected = {
            statCode: null,
            statBonus: 0,
            langs: [],
            skills: [],
            tools: [],
            expertise: [],
            weapons: [],
            spells: [],
            element: ''
        };

        function getCurChar() { return GC()[PI] || {}; }

        function stepStat() {
            if (effect.chooseStat && effect.chooseStat.options && effect.chooseStat.options.length > 0) {
                const opts = effect.chooseStat.options;
                const bonus = effect.chooseStat.bonus || 1;
                if (opts.length === 1) {
                    collected.statCode = opts[0];
                    collected.statBonus = bonus;
                    stepElement();
                } else {
                    const rusOptions = opts.map(code => statNames[code] || code);
                    SHOW_OPTION_CHOICE(effect.chooseStat.label || 'Выберите характеристику (+1)', rusOptions, 1, function(selected) {
                        collected.statCode = codeByRus[selected[0]] || opts[0];
                        collected.statBonus = bonus;
                        stepElement();
                    });
                }
                return;
            }
            stepElement();
        }

        function stepElement() {
            if (featName === 'Стихийный адепт') {
                const c = getCurChar();
                const avail = ELEMENTS_LIST.filter(el => !(c.elementalAdeptTypes || []).includes(el));
                if (avail.length > 0) {
                    SHOW_OPTION_CHOICE('Стихийный адепт: выберите тип стихийного урона', avail, 1, function(selected) {
                        collected.element = selected[0] || '';
                        stepLanguages();
                    });
                    return;
                }
            }
            stepLanguages();
        }

        function stepLanguages() {
            if (effect.chooseLanguages) {
                const c = getCurChar();
                const known = GAL(c);
                const avail = gameData.languages.all().filter(l => !known.includes(l));
                if (avail.length > 0) {
                    SHOW_OPTION_CHOICE('Лингвист: выберите языки', avail, Math.min(effect.chooseLanguages.count, avail.length), function(selected) {
                        collected.langs = selected;
                        stepSkills();
                    });
                    return;
                }
            }
            stepSkills();
        }

        function stepSkills() {
            const c = getCurChar();
            const alreadyKnown = (c.chosenSkills || []).concat(GAS(c));

            if (effect.chooseSkillOrTool) {
                const availSkills = gameData.allSkills.filter(s => !alreadyKnown.includes(s)).map(s => '🎯 Навык: ' + s);
                const availTools = TOOLS_LIST.filter(t => !(c.toolProficiencies || []).includes(t)).map(t => '🔧 Инструмент: ' + t);
                const combined = availSkills.concat(availTools);
                const cnt = Math.min(effect.chooseSkillOrTool.countSkills || 3, combined.length);
                if (cnt > 0) {
                    SHOW_OPTION_CHOICE('Умелый: выберите 3 любых навыка или инструмента', combined, cnt, function(selected) {
                        selected.forEach(item => {
                            if (item.startsWith('🎯 Навык: ')) collected.skills.push(item.replace('🎯 Навык: ', ''));
                            else if (item.startsWith('🔧 Инструмент: ')) collected.tools.push(item.replace('🔧 Инструмент: ', ''));
                        });
                        stepExpertise();
                    });
                    return;
                }
            } else if (effect.chooseSkills) {
                const availSkills = gameData.allSkills.filter(s => !alreadyKnown.includes(s));
                if (availSkills.length > 0) {
                    SHOW_OPTION_CHOICE(effect.chooseSkills.label || 'Выберите навык', availSkills, Math.min(effect.chooseSkills.count, availSkills.length), function(selected) {
                        collected.skills = selected;
                        stepExpertise();
                    });
                    return;
                }
            }
            stepExpertise();
        }

        function stepExpertise() {
            if (effect.chooseExpertise) {
                const c = getCurChar();
                const knownSkills = Array.from(new Set((c.chosenSkills || []).concat(GAS(c), collected.skills)));
                const availExp = knownSkills.filter(s => !(c.expertiseSkills || []).includes(s));
                if (availExp.length > 0) {
                    SHOW_OPTION_CHOICE('Выберите навык для Экспертизы', availExp, Math.min(effect.chooseExpertise.count, availExp.length), function(selected) {
                        collected.expertise = selected;
                        stepWeapons();
                    });
                    return;
                }
            }
            stepWeapons();
        }

        function stepWeapons() {
            if (effect.chooseWeapons) {
                const c = getCurChar();
                const avail = effect.chooseWeapons.options.filter(w => !(c.weaponProficiencies || []).includes(w));
                if (avail.length > 0) {
                    SHOW_OPTION_CHOICE(effect.chooseWeapons.label, avail, Math.min(effect.chooseWeapons.count, avail.length), function(selected) {
                        collected.weapons = selected;
                        stepFeatSpells();
                    });
                    return;
                }
            }
            stepFeatSpells();
        }

        function stepFeatSpells() {
            const c = getCurChar();
            const known = c.knownSpells || [];
            if (effect.chooseSpells) {
                const cfg = effect.chooseSpells;
                const avail = gameData.spells.filter(sp =>
                    sp.level === cfg.level &&
                    (!cfg.classes || sp.classes.some(cl => cfg.classes.includes(cl))) &&
                    !known.includes(sp.name)
                );
                if (avail.length > 0) {
                    SHOW_SPELL_CHOICE(avail, cfg.count || 1, cfg.label || 'Выберите заклинание', function(selected) {
                        collected.spells.push(...selected);
                        closeModal('spell-choice-modal');
                        commitAll();
                    });
                    return;
                }
            }
            if (effect.chooseSpellsModal) {
                const cantripsAvail = gameData.spells.filter(sp => sp.level === 0 && !known.includes(sp.name));
                SHOW_SPELL_CHOICE(cantripsAvail, effect.chooseSpellsModal.cantrips || 2, 'Зачинатель магии: Выберите 2 заговора', function(selCantrips) {
                    collected.spells.push(...selCantrips);
                    closeModal('spell-choice-modal');
                    const lvl1Avail = gameData.spells.filter(sp => sp.level === 1 && !known.includes(sp.name));
                    setTimeout(() => {
                        SHOW_SPELL_CHOICE(lvl1Avail, effect.chooseSpellsModal.level1 || 1, 'Зачинатель магии: Выберите 1 заклинание 1 круга', function(selLvl1) {
                            collected.spells.push(...selLvl1);
                            closeModal('spell-choice-modal');
                            commitAll();
                        });
                    }, 50);
                });
                return;
            }
            commitAll();
        }

        function commitAll() {
            const cs = GC();
            const char = cs[PI];
            if (!char) return;

            // +1 к характеристике с потолком 20 и обновлением бюджета очков (без перерасхода!)
            if (collected.statCode && collected.statBonus) {
                let capKey = 'base' + collected.statCode.charAt(0).toUpperCase() + collected.statCode.slice(1);
                if (collected.statCode === 'intl') capKey = 'baseInt';
                const before = parseInt(char[capKey], 10) || 10;
                const after = Math.min(20, before + collected.statBonus);
                const diff = after - before;
                char[capKey] = after;
                if (diff > 0) {
                    char._statBudgetTotal = (char._statBudgetTotal || 72) + diff;
                    if (char._asiMinFloor && char._asiMinFloor[capKey] !== undefined) {
                        char._asiMinFloor[capKey] += diff;
                    }
                }
            }

            if (collected.langs.length) {
                if (!char.chosenLanguages) char.chosenLanguages = {};
                collected.langs.forEach(l => { char.chosenLanguages[l] = true; });
            }

            if (collected.skills.length) {
                if (!char.chosenSkills) char.chosenSkills = [];
                let addedCnt = 0;
                collected.skills.forEach(s => {
                    if (!char.chosenSkills.includes(s)) { char.chosenSkills.push(s); addedCnt++; }
                });
                char.bonusSkillSlots = (char.bonusSkillSlots || 0) + addedCnt;
            }

            if (collected.tools.length) {
                if (!char.toolProficiencies) char.toolProficiencies = [];
                collected.tools.forEach(t => { if (!char.toolProficiencies.includes(t)) char.toolProficiencies.push(t); });
                char.abilities = (char.abilities ? char.abilities + '<br>• ' : '• ') + '<b>Владение инструментами:</b> ' + collected.tools.join(', ');
            }

            if (collected.expertise.length) {
                if (!char.expertiseSkills) char.expertiseSkills = [];
                collected.expertise.forEach(s => { if (!char.expertiseSkills.includes(s)) char.expertiseSkills.push(s); });
            }

            if (collected.weapons.length) {
                if (!char.weaponProficiencies) char.weaponProficiencies = [];
                collected.weapons.forEach(w => { if (!char.weaponProficiencies.includes(w)) char.weaponProficiencies.push(w); });
                char.abilities = (char.abilities ? char.abilities + '<br>• ' : '• ') + '<b>Владение оружием:</b> ' + collected.weapons.join(', ');
            }

            if (collected.element) {
                if (!char.elementalAdeptTypes) char.elementalAdeptTypes = [];
                if (!char.elementalAdeptTypes.includes(collected.element)) char.elementalAdeptTypes.push(collected.element);
                char.abilities = (char.abilities ? char.abilities + '<br>• ' : '• ') + `<b>Стихийный адепт (${collected.element}):</b> игнорирует сопротивление; 1 и 2 на кубах урона считаются за 3.`;
            } else if (effect.autoAbilities) {
                char.abilities = (char.abilities ? char.abilities + '<br>• ' : '• ') + '<b>' + featName + ':</b> ' + effect.autoAbilities;
            }

            if (collected.spells.length) {
                if (!char.knownSpells) char.knownSpells = [];
                if (!char._featBonusSpells) char._featBonusSpells = [];
                collected.spells.forEach(spName => {
                    if (!char.knownSpells.includes(spName)) char.knownSpells.push(spName);
                    if (!char._featBonusSpells.includes(spName)) char._featBonusSpells.push(spName);
                });
            }

            if (effect.initiativeBonus) char.initiativeBonus = (char.initiativeBonus || 0) + effect.initiativeBonus;
            if (effect.speedBonus) char.featSpeedBonus = (char.featSpeedBonus || 0) + effect.speedBonus;

            AB(char);
            RHP(char);
            SC(cs);
            if (doneCallback) doneCallback();
        }

        stepStat();
    };

    // ================================================================
    // 7. ФИКС CAST_SPELL (АП-КАСТ ДЛЯ ВСЕХ МАГОВ + ФЛАГ УСПЕХА)
    //    И BG3_PLAYER_CAST_SPELL (РЕАЛЬНЫЙ УРОН/ЛЕЧЕНИЕ ПО ЦЕЛИ НА КАРТЕ!)
    // ================================================================
    window.CAST_SPELL = function(spellName) {
        window._lastCastSucceeded = false;
        window._lastCastMeta = null;

        const cs = GC();
        const c = cs[PI];
        if (!c) return false;
        NORMALIZE_WARLOCK_SLOTS(c);
        const spell = gameData.spells.find(s => s.name === spellName);
        if (!spell) return false;
        const level = spell.level || 0;

        const isPeacefulAllowed = /леч|восстановлен|починк|маскировк|дружб|сообщен|тауматург|чудотворств|доспех|тёмное зрение|обнаружен|невидимост|пол[её]т|свет|указан|фокус|поиск|хожден|подмог|защита от смерти|скороход|бесследн|святилищ|благословен/i.test(spellName);
        if (!c.inCombat && !isPeacefulAllowed) {
            SET_COMBAT_BANNER('⚠️ Вы сейчас вне боя', `Боевое заклинание «<b>${spellName}</b>» требует режима боя.`, '#c97e2e');
            if (document.getElementById('attacks-modal')?.classList.contains('active')) OAT();
            return false;
        }

        const pb = GPB(c.level || 1);
        const castStatMap = { 'Волшебник': 'intl', 'Жрец': 'wis', 'Друид': 'wis', 'Следопыт': 'wis', 'Бард': 'cha', 'Паладин': 'cha', 'Колдун': 'cha', 'Чародей': 'cha' };
        const statKey = castStatMap[c.className] || 'intl';
        const mod = GM(c[statKey] || 10);
        const spellDC = 8 + pb + mod;
        const spellAtkRoll = Math.floor(Math.random() * 20) + 1;
        const spellAtkTotal = spellAtkRoll + pb + mod;
        const targetName = GET_TARGET_LABEL();

        let usedSlotLevel = level;
        let usedFeatFreeCast = false;

        if (level > 0) {
            const maxSlots = GET_SPELL_SLOTS(c);
            if (!c.usedSpellSlots) c.usedSpellSlots = { 1:0, 2:0, 3:0, 4:0, 5:0, 6:0, 7:0, 8:0, 9:0 };
            const usedSlots = c.usedSpellSlots;

            let chosenSlot = 0;
            if (c.className === 'Колдун' && level <= 5) {
                for (let i = 5; i >= 1; i--) {
                    if ((maxSlots[i] || 0) - (usedSlots[i] || 0) > 0) {
                        chosenSlot = i;
                        break;
                    }
                }
            } else {
                // Ищем свободную ячейку своего круга или выше (ап-каст D&D 5e!)
                for (let i = level; i <= 9; i++) {
                    if ((maxSlots[i] || 0) - (usedSlots[i] || 0) > 0) {
                        chosenSlot = i;
                        break;
                    }
                }
            }

            if (chosenSlot <= 0) {
                // Проверка бесплатного 1/день от черты «Зачинатель магии»
                if (level === 1 && c.chosenFeats && c.chosenFeats.includes('Зачинатель магии')) {
                    if (!c.usedSpells) c.usedSpells = {};
                    if (!c.usedSpells[spellName]) {
                        c.usedSpells[spellName] = true;
                        usedFeatFreeCast = true;
                        usedSlotLevel = 1;
                    }
                }
                if (!usedFeatFreeCast) {
                    const msg = `Нет свободных ячеек ${level}-го круга или выше! Проведите Короткий отдых (для Колдуна/Волшебника) или Длинный отдых.`;
                    SET_COMBAT_BANNER('❌ Недостаточно ячеек', msg, '#e06060');
                    window._bg3CombatLogBanner = `<div style="background:#3a1818; border-left:4px solid #d66565; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#fecaca;">❌ <b>${spellName}:</b> ${msg}</div>`;
                    if (document.getElementById('attacks-modal')?.classList.contains('active')) OAT();
                    return false;
                }
            } else {
                usedSlots[chosenSlot] = (usedSlots[chosenSlot] || 0) + 1;
                usedSlotLevel = chosenSlot;
            }
        }

        window._lastCastSucceeded = true;
        window._lastCastMeta = {
            spell, level, usedSlotLevel, usedFeatFreeCast,
            spellDC, spellAtkRoll, spellAtkTotal, mod
        };

        // Если вызвано НЕ из BG3-боя, применяем старый эффект (для мирного лечения из окна OAT)
        let effectHtml = '';
        if (!window._castingFromBg3Hud) {
            effectHtml = TRY_APPLY_SPELL_EFFECT_ON_CHAR(cs, c, spellName, usedSlotLevel, spell.desc);
        }

        SC(cs);
        RMC();

        const castText = level === 0
            ? 'заговор'
            : (usedFeatFreeCast
                ? '1/день от черты'
                : (usedSlotLevel !== level ? `${level}-й круг (ячейкой ${usedSlotLevel}-го круга)` : `${level}-й круг`));

        if (!window._castingFromBg3Hud) {
            LOG_COMBAT_TO_CHAT(`колдует «${spellName}» (${castText}) -> ${targetName} (Атака: ${spellAtkTotal}, Сл: ${spellDC})`);
            SET_COMBAT_BANNER(`✨ ${spellName} — ${castText}`, `🎯 Цель: <b>${targetName}</b> | 🎲 Атака: <b>${spellAtkTotal}</b> | 🛡️ Сл спасброска: <b>${spellDC}</b>${effectHtml}<br><small style="color:#aaa;">${spell.desc || ''}</small>`, '#c084fc');
            if (document.getElementById('attacks-modal')?.classList.contains('active')) OAT();
        }
        return true;
    };

    window.BG3_PLAYER_CAST_SPELL = function(spellName) {
        const cs = GC();
        const c = cs[PI];
        const sp = gameData.spells.find(s => s.name === spellName);
        if (!c || !sp) return;

        const st = GET_MAP_STATE();
        const to = ENSURE_TURN_STATE(st);
        const isBonus = (sp.time || '').toLowerCase().includes('бонус');
        if (isBonus && to.bonusLeft <= 0) return;
        if (!isBonus && to.actionsLeft <= 0) return;

        window._castingFromBg3Hud = true;
        CAST_SPELL(spellName);
        window._castingFromBg3Hud = false;

        // Если не хватило ячеек — действие НЕ списываем!
        if (!window._lastCastSucceeded || !window._lastCastMeta) {
            RENDER_MAP_AREA();
            return;
        }

        const meta = window._lastCastMeta;
        const freshCs = GC();
        const caster = freshCs[PI];
        const freshSt = GET_MAP_STATE();
        SYNC_PLAYER_TOKENS_WITH_CHARS(freshSt);
        const tokens = freshSt.tokens || [];
        const targetTok = tokens[window._bg3SelectedTargetIdx] || null;
        const freshTo = ENSURE_TURN_STATE(freshSt);

        // Списываем действие только после успешного сотворения
        if (isBonus) freshTo.bonusLeft = Math.max(0, freshTo.bonusLeft - 1);
        else { freshTo.actionsLeft = 0; freshTo.attacksLeft = 0; }

        const desc = sp.desc || '';
        const slotNote = meta.level === 0
            ? 'заговор'
            : (meta.usedFeatFreeCast
                ? 'черта 1/день'
                : (meta.usedSlotLevel !== meta.level ? `${meta.level} кр. → ячейка ${meta.usedSlotLevel} кр.` : `${meta.level} круг`));

        // 1. Лечение / временные ХП
        if (/лечение ран|лечащее слово|массовое лечение ран|полное восстановление|массовое исцеление/i.test(spellName)) {
            const healTok = (targetTok && targetTok.isPlayer) ? targetTok : tokens.find(t => t.isPlayer && t.charIdx === PI);
            const healChar = (healTok && freshCs[healTok.charIdx]) ? freshCs[healTok.charIdx] : caster;
            let healed = 0;
            if (/полное восстановление|массовое исцеление/i.test(spellName)) {
                healed = Math.max(0, (healChar.maxHp || 10) - (healChar.hp || 0));
                healChar.hp = healChar.maxHp || 10;
            } else {
                const dieSides = /лечащее слово/i.test(spellName) ? 4 : 8;
                const diceCnt = /массовое/i.test(spellName) ? 3 : Math.max(1, meta.usedSlotLevel || 1);
                healed = Math.max(1, window.ROLL(`${diceCnt}к${dieSides}`) + meta.mod);
                healChar.hp = Math.min(healChar.maxHp || 10, (healChar.hp || 0) + healed);
            }
            if (healTok) healTok.hp = healChar.hp;
            SC(freshCs);
            SAVE_MAP_STATE(freshSt);
            window._bg3CombatLogBanner = `<div style="background:#192e1e; border-left:4px solid #6cb878; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#d8f3dc;">💚 <b>${spellName}</b> (${slotNote}) → <b>${healChar.name}</b>: восстановлено <b>+${healed} ХП</b> (${healChar.hp}/${healChar.maxHp}).</div>`;
            LOG_COMBAT_TO_CHAT(`💚 колдует «${spellName}» (${slotNote}) на «${healChar.name}»: +${healed} ХП (${healChar.hp}/${healChar.maxHp}).`);
            RMC();
            RENDER_MAP_AREA();
            return;
        }

        if (spellName === 'Доспех Агатиса') {
            const gain = 5 * Math.max(1, meta.usedSlotLevel || 1);
            caster.tempHP = Math.max(caster.tempHP || 0, gain);
            SC(freshCs);
            SAVE_MAP_STATE(freshSt);
            window._bg3CombatLogBanner = `<div style="background:#1e2636; border-left:4px solid #5b8fb8; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#e0f2fe;">🛡️ <b>Доспех Агатиса</b> (${slotNote}): получено <b>+${gain} врем. ХП</b>.</div>`;
            LOG_COMBAT_TO_CHAT(`🛡️ колдует «Доспех Агатиса» (${slotNote}): +${gain} врем. ХП.`);
            RMC();
            RENDER_MAP_AREA();
            return;
        }

        // 2. Боевой урон по выбранной фишке на карте
        const dmgFormula = (typeof PARSE_SPELL_DICE_FROM_DESC === 'function') ? PARSE_SPELL_DICE_FROM_DESC(desc) : null;
        const isDamageSpell = dmgFormula && /урон|некротик|огн|холод|молн|кислот|излучен|псих|гром|яд|силов|стрел|колющ|дробящ/i.test(desc);

        if (isDamageSpell && targetTok) {
            const isAutoHitOrSave = /спас|стрел|авто|волшебная стрела|огненный шар|конус холода|огненные ладони|волна грома|молния/i.test(spellName + ' ' + desc);
            let dmgRes = ROLL_SPELL_DAMAGE_FOR_CHAR(caster, dmgFormula, desc);
            let dmg = Math.max(1, dmgRes.total);
            if (/волшебная стрела/i.test(spellName)) {
                const darts = 2 + Math.max(1, meta.usedSlotLevel || 1);
                dmg = 0;
                for (let d = 0; d < darts; d++) dmg += window.ROLL('1к4+1');
            }

            const isCrit = !isAutoHitOrSave && meta.spellAtkRoll === 20;
            if (isCrit) dmg += Math.max(1, ROLL_SPELL_DAMAGE_FOR_CHAR(caster, dmgFormula, desc).total);

            const targetAC = targetTok.ac || 12;
            const isHit = isAutoHitOrSave || isCrit || (meta.spellAtkRoll !== 1 && meta.spellAtkTotal >= targetAC);

            if (isHit) {
                targetTok.hp = Math.max(0, (targetTok.hp || 0) - dmg);
                if (targetTok.isPlayer && freshCs[targetTok.charIdx]) {
                    freshCs[targetTok.charIdx].hp = targetTok.hp;
                    SC(freshCs);
                }
                SAVE_MAP_STATE(freshSt);
                const deadNote = targetTok.hp <= 0 ? ' 💀 <b>ЦЕЛЬ ПОВЕРЖЕНА!</b>' : ` (Осталось ${targetTok.hp}/${targetTok.maxHp} ХП)`;
                const hitInfo = isAutoHitOrSave ? `Сл спасброска: <b>${meta.spellDC}</b>` : `Маг. атака: <b>${meta.spellAtkTotal}</b> против КБ ${targetAC}${isCrit ? ' 💥 <b>КРИТ!</b>' : ''}`;
                const adeptTag = dmgRes.adeptUsed ? ' <i>(Стихийный адепт)</i>' : '';
                window._bg3CombatLogBanner = `<div style="background:#241936; border-left:4px solid #a855f7; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#f3e8ff;">✨ <b>${spellName}</b> (${slotNote}) по «<b>${targetTok.name}</b>»: ${hitInfo} → Урон <b>${dmg}</b>${adeptTag}!${deadNote}</div>`;
                LOG_COMBAT_TO_CHAT(`✨ «${caster.name}» колдует «${spellName}» (${slotNote}) по «${targetTok.name}»: урон ${dmg}!${targetTok.hp <= 0 ? ' [ПОВЕРЖЕН]' : ''}`);
            } else {
                SAVE_MAP_STATE(freshSt);
                window._bg3CombatLogBanner = `<div style="background:#2d2118; border-left:4px solid #f59e0b; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#fde68a;">🛡️ <b>${spellName}</b> (${slotNote}) по «<b>${targetTok.name}</b>»: <b>ПРОМАХ!</b> (Бросок ${meta.spellAtkTotal} против КБ ${targetAC})</div>`;
                LOG_COMBAT_TO_CHAT(`🛡️ «${caster.name}» промахивается заклинанием «${spellName}» по «${targetTok.name}» (${meta.spellAtkTotal} против КБ ${targetAC}).`);
            }
            RMC();
            RENDER_MAP_AREA();
            return;
        }

        // 3. Баффы / контроль / утилитарные заклинания
        SAVE_MAP_STATE(freshSt);
        window._bg3CombatLogBanner = `<div style="background:#241936; border-left:4px solid #a855f7; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#f3e8ff;">✨ <b>${spellName}</b> (${slotNote}) • Сл спасброска: <b>${meta.spellDC}</b><br><small style="color:#d8b4fe;">${desc}</small></div>`;
        LOG_COMBAT_TO_CHAT(`✨ «${caster.name}» колдует «${spellName}» (${slotNote}, Сл ${meta.spellDC})${targetTok ? ` -> ${targetTok.name}` : ''}.`);
        RMC();
        RENDER_MAP_AREA();
    };

    // ================================================================
    // 8. ФИКС ОРУЖИЯ В БОЮ BG3 (УНИВЕРСАЛЬНОЕ + БОЕПРИПАСЫ + МОНАХ)
    // ================================================================
    window.BG3_PLAYER_USE_WEAPON = function(invIdx) {
        const cs = GC();
        const c = cs[PI];
        const inv = c && c.inventory;
        const item = inv && inv[invIdx];
        if (!item) return;

        const st = GET_MAP_STATE();
        const to = ENSURE_TURN_STATE(st);
        if (to.attacksLeft <= 0) return;

        const pb = GPB(c.level || 1);
        const sm = GM(c.str || 10), dm = GM(c.dex || 10);
        const am = item.finesse ? Math.max(sm, dm) : (item.ranged ? dm : sm);

        // Свойство «универсальное» (двуручный урон, если вторая рука свободна)
        let dmgFormula = item.damage || '1к4';
        const handsItems = inv.filter(x => x.equipped && (x.isWeapon || x.isShield)).length;
        if (item.properties && item.properties.includes('универсальное') && handsItems <= 1) {
            const m = item.properties.match(/универсальное\s*\(([^)]+)\)/i);
            if (m && m[1]) dmgFormula = m[1];
        }

        // Расход боеприпасов (стрелы/болты), если они лежат в рюкзаке
        if (item.properties && item.properties.includes('боеприпасы')) {
            const ammoIdx = inv.findIndex(x => {
                const n = (x.name || '').toLowerCase();
                return (n.includes('стрел') || n.includes('болт') || n.includes('снаряд')) && (parseInt(x.qty, 10) || 0) > 0;
            });
            if (ammoIdx !== -1) {
                const ammo = inv[ammoIdx];
                if (parseInt(ammo.qty, 10) > 1) ammo.qty = String(parseInt(ammo.qty, 10) - 1);
                else inv.splice(ammoIdx, 1);
                SC(cs);
            }
        }

        const d20 = Math.floor(Math.random() * 20) + 1;
        const atkTotal = d20 + am + pb;
        const isCrit = (d20 === 20);
        let dmg = Math.max(1, window.ROLL(dmgFormula) + am);
        if (isCrit) dmg += Math.max(1, window.ROLL(dmgFormula));

        to.attacksLeft = Math.max(0, to.attacksLeft - 1);
        if (to.attacksLeft === 0) to.actionsLeft = 0;
        SAVE_MAP_STATE(st);

        BG3_APPLY_DAMAGE_TO_SELECTED_TOKEN(dmg, d20 === 1 ? 1 : atkTotal, isCrit, item.name);
        RMC();
        RENDER_MAP_AREA();
    };

    window.BG3_PLAYER_UNARMED = function() {
        const cs = GC();
        const c = cs[PI];
        if (!c) return;
        const st = GET_MAP_STATE();
        const to = ENSURE_TURN_STATE(st);
        if (to.attacksLeft <= 0) return;

        const pb = GPB(c.level || 1);
        const sm = GM(c.str || 10), dm = GM(c.dex || 10);
        const isMonk = c.className === 'Монах';
        const lv = c.level || 1;
        const am = isMonk ? Math.max(sm, dm) : sm;

        let dmgDice = '';
        if (isMonk) {
            dmgDice = lv >= 17 ? '1к10' : (lv >= 11 ? '1к8' : (lv >= 5 ? '1к6' : '1к4'));
        } else if (c.chosenFeats && c.chosenFeats.includes('Драчун')) {
            dmgDice = '1к4';
        }

        const d20 = Math.floor(Math.random() * 20) + 1;
        const atkTotal = d20 + am + pb;
        const isCrit = (d20 === 20);
        let dmg = dmgDice ? Math.max(1, window.ROLL(dmgDice) + am) : Math.max(1, 1 + am);
        if (isCrit) dmg += dmgDice ? Math.max(1, window.ROLL(dmgDice)) : 1;

        to.attacksLeft = Math.max(0, to.attacksLeft - 1);
        if (to.attacksLeft === 0) to.actionsLeft = 0;
        SAVE_MAP_STATE(st);

        BG3_APPLY_DAMAGE_TO_SELECTED_TOKEN(dmg, d20 === 1 ? 1 : atkTotal, isCrit, isMonk ? `Боевые искусства (${dmgDice})` : 'Безоружный удар');
        RMC();
        RENDER_MAP_AREA();
    };
})();