// ================================================================
// 🌟 НАТИВНЫЙ ДВИЖОК ВСЕХ ЧЕРТ D&D 5e (feats_engine.js)
// Ноль лишних кнопок и вкладок: все эффекты работают автоматически
// или встроены в Оружие, Заклинания, Действия, Броски, Отдых и Лист.
// ================================================================
(function INIT_NATIVE_FEATS_ENGINE() {
    if (typeof gameData === 'undefined') return;

    // --- 1. СОХРАНЕНИЕ ПОЛЕЙ ЧЕРТ ПО КОМНАТАМ И В СЛЕПКЕ ЛОББИ ---
    const EXTRA_FEAT_FIELDS = [
        'abilities', 'toolProficiencies', 'elementalAdeptTypes', 'metamagicChoices',
        'ritualSpells', 'bonusSkillSlots', '_featBonusSpells', '_subclassBonusSpells',
        '_magicInitiateLvl1', '_magicInitiateStat', 'featResUsed', '_statBudgetTotal'
    ];
    if (typeof ROOM_PROGRESS_FIELDS !== 'undefined' && Array.isArray(ROOM_PROGRESS_FIELDS)) {
        EXTRA_FEAT_FIELDS.forEach(f => {
            if (!ROOM_PROGRESS_FIELDS.includes(f)) ROOM_PROGRESS_FIELDS.push(f);
        });
    }

    if (typeof window.CREATE_CLEAN_LEVEL1_SNAPSHOT === 'function') {
        const _ORIG_SNAP = window.CREATE_CLEAN_LEVEL1_SNAPSHOT;
        window.CREATE_CLEAN_LEVEL1_SNAPSHOT = function(c) {
            const snap = _ORIG_SNAP(c);
            if (!c) return snap;
            const keep = [
                'chosenFeats', 'toolProficiencies', 'weaponProficiencies',
                'elementalAdeptTypes', 'metamagicChoices', 'ritualSpells',
                'expertiseSkills', 'bonusSkillSlots', 'initiativeBonus',
                'featSpeedBonus', 'toughPerLevel', '_featBonusSpells',
                '_magicInitiateLvl1', '_magicInitiateStat', 'abilities',
                'pendingChoices', '_completedChoices', '_statBudgetTotal'
            ];
            keep.forEach(k => {
                if (c[k] !== undefined) snap[k] = JSON.parse(JSON.stringify(c[k]));
            });
            ['baseStr', 'baseDex', 'baseCon', 'baseInt', 'baseWis', 'baseCha'].forEach(sk => {
                if (c[sk] !== undefined && (c.level || 1) === 1) snap[sk] = Math.min(20, c[sk]);
            });
            return snap;
        };
    }

    // --- 2. РИТУАЛЫ 1-ГО КРУГА И СПРАВОЧНИКИ ---
    const RITUAL_SPELLS_1 = [
        { name: "Обнаружение магии", level: 1, school: "Прорицание", time: "1 д. (Ритуал)", range: "На себя", duration: "Конц,10мин.", classes: ["Бард","Волшебник","Друид","Жрец","Паладин","Следопыт","Чародей"], desc: "Ощущаете магию и её школы в радиусе 30 фт." },
        { name: "Опознание", level: 1, school: "Прорицание", time: "1 мин. (Ритуал)", range: "Касание", duration: "Мгн.", classes: ["Бард","Волшебник"], desc: "Узнаёте магические свойства предмета или действующие на существо заклинания." },
        { name: "Поиск фамильяра", level: 1, school: "Вызов", time: "1 час (Ритуал)", range: "10 фт.", duration: "Мгн.", classes: ["Волшебник"], desc: "Призывает духа-фамильяра (сова, ворон, кот, жаба и др.) для разведки и помощи." },
        { name: "Понимание языков", level: 1, school: "Прорицание", time: "1 д. (Ритуал)", range: "На себя", duration: "1 час", classes: ["Бард","Волшебник","Колдун","Чародей"], desc: "Понимаете буквальный смысл любой устной и письменной речи." },
        { name: "Тревога", level: 1, school: "Ограждение", time: "1 мин. (Ритуал)", range: "30 фт.", duration: "8 час.", classes: ["Волшебник","Следопыт"], desc: "Охранный контур 20 фт.: предупреждает звоном или мысленным сигналом о вторжении." },
        { name: "Парящий диск", level: 1, school: "Вызов", time: "1 д. (Ритуал)", range: "30 фт.", duration: "1 час", classes: ["Волшебник"], desc: "Силовой диск следует за вами и несёт до 500 фунтов груза." },
        { name: "Разговор с животными", level: 1, school: "Прорицание", time: "1 д. (Ритуал)", range: "На себя", duration: "10 мин.", classes: ["Бард","Друид","Следопыт"], desc: "Позволяет общаться со зверями и узнавать у них сведения." },
        { name: "Незримый слуга", level: 1, school: "Вызов", time: "1 д. (Ритуал)", range: "60 фт.", duration: "1 час", classes: ["Бард","Волшебник","Колдун"], desc: "Невидимая сила выполняет простые поручения." }
    ];
    if (Array.isArray(gameData.spells)) {
        RITUAL_SPELLS_1.forEach(sp => {
            if (!gameData.spells.some(x => x.name === sp.name)) gameData.spells.push(sp);
        });
    }

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

    const METAMAGIC_OPTIONS = [
        { id: 'quickened', name: 'Ускоренное', cost: 2, desc: 'Сотворение заклинания (1 д.) за Бонусное действие' },
        { id: 'empowered', name: 'Усиленное',  cost: 1, desc: 'Переброс слабых кубов урона' },
        { id: 'distant',   name: 'Далёкое',    cost: 1, desc: 'Удваивает дистанцию заклинания (Касание -> 30 фт)' },
        { id: 'twinned',   name: 'Удвоенное',  cost: 1, desc: '+50% урона / дополнительный снаряд' },
        { id: 'subtle',    name: 'Скрытное',   cost: 1, desc: 'Колдовство без слов и жестов' },
        { id: 'careful',   name: 'Осторожное', cost: 1, desc: 'Союзники автоматически проходят спасбросок' }
    ];

    const POLEARM_RE = /алебард|глеф|боевой посох|копь[ёе]|длинное копь|кавалерийская пика/i;
    const HEAVY_MELEE_RE = /тяж[ёе]л/i;

    // Временные состояния текущего боя/хода
    window._featPowerAtkGwm = false;
    window._featPowerAtkSharp = false;
    window._featHumanDetArmed = false;
    window._featMageSlayerSave = false;
    window._featActiveMetamagic = '';
    window._featGwmBonusReady = false;
    window._featOrcReactionReady = false;
    window._featLastAttackCtx = null;
    window._featLastRollCtx = null;
    window._featLastEnemyHit = null;
    window._featReactionUsedRound = -1;
    window._featForceAdvFromInsp = false;

    const ESC = s => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const ESC_JS = s => String(s || '').replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    const CUR_ROOM = () => { const s = (typeof GET_SESSION === 'function') ? GET_SESSION() : null; return (s && s.roomCode) ? String(s.roomCode) : null; };
    const HAS_FEAT = (c, name) => !!(c && Array.isArray(c.chosenFeats) && c.chosenFeats.includes(name));

    function GET_SHIELD_BONUS(c) {
        if (!c || !Array.isArray(c.inventory)) return 0;
        let b = 0;
        c.inventory.forEach(i => { if (i && i.equipped && (i.isShield || i.type === 'shield')) b = Math.max(b, parseInt(i.ac, 10) || 2); });
        return b;
    }

    function GET_RES_LEFT(c, key, maxVal) {
        const used = (c && c.featResUsed && c.featResUsed[key]) ? Number(c.featResUsed[key]) : 0;
        return Math.max(0, maxVal - used);
    }

    function SPEND_RES(c, key, amount = 1) {
        if (!c.featResUsed) c.featResUsed = {};
        c.featResUsed[key] = (Number(c.featResUsed[key]) || 0) + amount;
    }

    function GET_SORC_POINTS(c) {
        const base = (c && c.className === 'Чародей' && (c.level || 1) >= 2) ? (c.level || 2) : 0;
        const featPts = HAS_FEAT(c, 'Двойник-заклинатель') ? 2 : 0;
        const max = base + featPts;
        const used = (c && c.classResUsed && c.classResUsed.sorc_pts) ? Number(c.classResUsed.sorc_pts) : 0;
        return { max, used, left: Math.max(0, max - used) };
    }

    function HAS_REACTION(st) {
        const r = (st && st.turnOrder && st.turnOrder.round) ? st.turnOrder.round : 1;
        return window._featReactionUsedRound !== r;
    }

    function USE_REACTION(st) {
        const r = (st && st.turnOrder && st.turnOrder.round) ? st.turnOrder.round : 1;
        window._featReactionUsedRound = r;
    }

    function GET_AVAIL_HIT_DICE(c) {
        return Math.max(0, (c?.level || 1) - (c?.spentHitDice || 0));
    }

    function HAS_DISADV_COND_ON_ME(st) {
        const myTok = st && st.tokens && st.tokens.find(t => t.isPlayer && t.charIdx === PI);
        if (!myTok || !Array.isArray(myTok.conditions)) return false;
        return ['prone', 'poisoned', 'blinded', 'frightened', 'restrained'].some(cd => myTok.conditions.includes(cd));
    }

    function ADD_TOKEN_COND(tIdx, condId) {
        const st = GET_MAP_STATE();
        const tok = st && st.tokens && st.tokens[tIdx];
        if (!tok) return;
        if (!Array.isArray(tok.conditions)) tok.conditions = [];
        if (!tok.conditions.includes(condId)) tok.conditions.push(condId);
        SAVE_MAP_STATE(st);
    }

    function BREAK_MY_INVIS() {
        const st = GET_MAP_STATE();
        const tok = st && st.tokens && st.tokens.find(t => t.isPlayer && t.charIdx === PI);
        if (tok && Array.isArray(tok.conditions) && tok.conditions.includes('invisible')) {
            tok.conditions = tok.conditions.filter(x => x !== 'invisible');
            SAVE_MAP_STATE(st);
        }
    }

    function GET_CAST_STAT_KEY(c) {
        const map = { 'Волшебник': 'intl', 'Жрец': 'wis', 'Друид': 'wis', 'Следопыт': 'wis', 'Бард': 'cha', 'Паладин': 'cha', 'Колдун': 'cha', 'Чародей': 'cha' };
        if (c && map[c.className]) return map[c.className];
        if (c && c._magicInitiateStat) return c._magicInitiateStat;
        return [{ k: 'intl', v: c?.intl || 10 }, { k: 'wis', v: c?.wis || 10 }, { k: 'cha', v: c?.cha || 10 }].sort((a, b) => b.v - a.v)[0].k;
    }

    // ================================================================
    // 3. ЧИСТЫЙ ВЫБОР ЧЕРТ (РАСОВЫЕ ТРЕБОВАНИЯ, УМЕЛЫЙ, СТИХИЯ, МЕТАМАГИЯ, РИТУАЛЫ)
    // ================================================================
    function OPEN_SKILLED_MIXED_PICKER(availSkills, availTools, maxCount, onConfirm) {
        document.getElementById('option-choice-title').textContent = 'Умелый: Навыки и Инструменты';
        const infoEl = document.getElementById('option-choice-info');
        const listDiv = document.getElementById('option-choice-list');

        const updateCounter = () => {
            const sk = listDiv.querySelectorAll('.sk-mix-cb[data-kind="skill"]:checked').length;
            const tl = listDiv.querySelectorAll('.sk-mix-cb[data-kind="tool"]:checked').length;
            const total = sk + tl;
            if (infoEl) {
                infoEl.innerHTML = `Выберите любые <b>${maxCount}</b> (можно смешивать навыки и инструменты).<br>Выбрано: <b>${sk}</b> навык(а) + <b>${tl}</b> инструмент(а) = <b style="color:${total === maxCount ? '#6cb878' : '#e6c88c'};">${total} / ${maxCount}</b>`;
            }
            listDiv.querySelectorAll('.sk-mix-cb').forEach(cb => { if (!cb.checked) cb.disabled = (total >= maxCount); });
        };

        const renderGroup = (title, items, kind) => {
            if (!items.length) return '';
            const rows = items.map(name => `
                <label style="display:flex; align-items:center; gap:8px; padding:6px 8px; background:var(--ui-panel2, #25221e); border:1px solid var(--ui-border, #3e372f); border-radius:6px; cursor:pointer; font-size:0.88rem;">
                    <input type="checkbox" class="sk-mix-cb" data-kind="${kind}" data-val="${ESC(name)}" style="width:auto;">
                    <span>${ESC(name)}</span>
                </label>`).join('');
            return `<div style="margin-bottom:10px; text-align:left;"><div style="font-weight:bold; color:var(--ui-accent, #d2b278); margin-bottom:6px; font-size:0.9rem;">${title}</div><div style="display:grid; grid-template-columns:1fr 1fr; gap:5px;">${rows}</div></div>`;
        };

        listDiv.innerHTML = renderGroup('🎯 Навыки', availSkills, 'skill') + renderGroup('🔧 Инструменты', availTools, 'tool');
        listDiv.querySelectorAll('.sk-mix-cb').forEach(cb => cb.addEventListener('change', updateCounter));
        updateCounter();

        document.getElementById('option-choice-confirm').onclick = function() {
            const checked = Array.from(listDiv.querySelectorAll('.sk-mix-cb:checked'));
            if (checked.length !== maxCount) {
                showMessage('⚠️ Выберите ровно ' + maxCount, `Сейчас выбрано ${checked.length} из ${maxCount}.`);
                return;
            }
            const skills = [], tools = [];
            checked.forEach(cb => {
                if (cb.getAttribute('data-kind') === 'skill') skills.push(cb.getAttribute('data-val'));
                else tools.push(cb.getAttribute('data-val'));
            });
            closeModal('option-choice-modal');
            setTimeout(() => onConfirm({ skills, tools }), 20);
        };
        OM('option-choice-modal');
    }

    window.SHOW_FEAT_CHOICE_FOR_CHOICE = function(_cs, _c, choice) {
        const freshCs = GC();
        const char = freshCs[PI];
        if (!char) return;
        const available = (gameData.feats || []).filter(f => {
            if (f.name === 'Стихийный адепт') return (char.elementalAdeptTypes || []).length < ELEMENTS_LIST.length;
            if ((char.chosenFeats || []).includes(f.name)) return false;
            const req = FEAT_RACE_REQ[f.name];
            if (req && char.race && !req.includes(char.race)) return false;
            return true;
        });

        if (!available.length) {
            REMOVE_PENDING_CHOICE(char, choice ? choice.label : '');
            SC(freshCs); RMC(); ROS();
            return;
        }

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

    window.APPLY_FEAT_EFFECTS = function(_u1, _u2, featName, doneCallback) {
        const feat = (gameData.feats || []).find(f => f.name === featName);
        if (!feat || !feat.effect) { if (doneCallback) doneCallback(); return; }

        const effect = feat.effect;
        const statNames = { str: 'Сила', dex: 'Ловкость', con: 'Телосложение', intl: 'Интеллект', wis: 'Мудрость', cha: 'Харизма' };
        const codeByRus = { 'Сила': 'str', 'Ловкость': 'dex', 'Телосложение': 'con', 'Интеллект': 'intl', 'Мудрость': 'wis', 'Харизма': 'cha' };
        const collected = { statCode: null, statBonus: 0, langs: [], skills: [], tools: [], expertise: [], weapons: [], spells: [], magicInitLvl1: '', ritualSpells: [], metamagics: [], element: '' };
        const curC = () => GC()[PI] || {};

        function stepStat() {
            if (effect.chooseStat && effect.chooseStat.options && effect.chooseStat.options.length > 0) {
                const opts = effect.chooseStat.options;
                const bonus = effect.chooseStat.bonus || 1;
                if (opts.length === 1) {
                    collected.statCode = opts[0];
                    collected.statBonus = bonus;
                    stepSpecial();
                } else {
                    SHOW_OPTION_CHOICE(effect.chooseStat.label || 'Выберите характеристику (+1)', opts.map(c => statNames[c] || c), 1, sel => {
                        collected.statCode = codeByRus[sel[0]] || opts[0];
                        collected.statBonus = bonus;
                        stepSpecial();
                    });
                }
                return;
            }
            stepSpecial();
        }

        function stepSpecial() {
            const c = curC();
            if (featName === 'Стихийный адепт') {
                const avail = ELEMENTS_LIST.filter(el => !(c.elementalAdeptTypes || []).includes(el));
                if (avail.length) {
                    SHOW_OPTION_CHOICE('Стихийный адепт: выберите тип урона', avail, 1, sel => { collected.element = sel[0] || ''; stepLang(); });
                    return;
                }
            }
            if (featName === 'Двойник-заклинатель') {
                const avail = METAMAGIC_OPTIONS.filter(m => !(c.metamagicChoices || []).includes(m.id));
                const labels = avail.map(m => `${m.name} (${m.cost} очк.) — ${m.desc}`);
                if (labels.length) {
                    SHOW_OPTION_CHOICE('Двойник-заклинатель: выберите 2 Метамагии', labels, Math.min(2, labels.length), sel => {
                        sel.forEach(lbl => { const f = avail.find(m => lbl.startsWith(m.name)); if (f) collected.metamagics.push(f.id); });
                        stepLang();
                    });
                    return;
                }
            }
            if (featName === 'Ритуальный заклинатель') {
                const avail = RITUAL_SPELLS_1.filter(r => !(c.ritualSpells || []).includes(r.name));
                if (avail.length) {
                    SHOW_SPELL_CHOICE(avail, Math.min(2, avail.length), 'Ритуальный заклинатель: выберите 2 ритуала 1-го круга', sel => {
                        collected.ritualSpells = sel;
                        closeModal('spell-choice-modal');
                        stepLang();
                    });
                    return;
                }
            }
            stepLang();
        }

        function stepLang() {
            if (effect.chooseLanguages) {
                const avail = gameData.languages.all().filter(l => !GAL(curC()).includes(l));
                if (avail.length) {
                    SHOW_OPTION_CHOICE('Лингвист: выберите языки', avail, Math.min(effect.chooseLanguages.count, avail.length), sel => { collected.langs = sel; stepSkills(); });
                    return;
                }
            }
            stepSkills();
        }

        function stepSkills() {
            const c = curC();
            const known = (c.chosenSkills || []).concat(GAS(c));
            if (effect.chooseSkillOrTool) {
                const availSk = gameData.allSkills.filter(s => !known.includes(s));
                const availTl = TOOLS_LIST.filter(t => !(c.toolProficiencies || []).includes(t));
                const maxC = Math.min(effect.chooseSkillOrTool.countSkills || 3, availSk.length + availTl.length);
                if (maxC > 0) {
                    OPEN_SKILLED_MIXED_PICKER(availSk, availTl, maxC, ({ skills, tools }) => {
                        collected.skills = skills;
                        collected.tools = tools;
                        stepExp();
                    });
                    return;
                }
            } else if (effect.chooseSkills) {
                const availSk = gameData.allSkills.filter(s => !known.includes(s));
                if (availSk.length) {
                    SHOW_OPTION_CHOICE(effect.chooseSkills.label || 'Выберите навык', availSk, Math.min(effect.chooseSkills.count, availSk.length), sel => { collected.skills = sel; stepExp(); });
                    return;
                }
            }
            stepExp();
        }

        function stepExp() {
            if (effect.chooseExpertise) {
                const c = curC();
                const pool = Array.from(new Set((c.chosenSkills || []).concat(GAS(c), collected.skills)));
                const avail = pool.filter(s => !(c.expertiseSkills || []).includes(s));
                if (avail.length) {
                    SHOW_OPTION_CHOICE('Выберите навык для Экспертности', avail, Math.min(effect.chooseExpertise.count, avail.length), sel => { collected.expertise = sel; stepWep(); });
                    return;
                }
            }
            stepWep();
        }

        function stepWep() {
            if (effect.chooseWeapons) {
                const avail = effect.chooseWeapons.options.filter(w => !(curC().weaponProficiencies || []).includes(w));
                if (avail.length) {
                    SHOW_OPTION_CHOICE(effect.chooseWeapons.label, avail, Math.min(effect.chooseWeapons.count, avail.length), sel => { collected.weapons = sel; stepSpells(); });
                    return;
                }
            }
            stepSpells();
        }

        function stepSpells() {
            const known = curC().knownSpells || [];
            if (effect.chooseSpells) {
                const cfg = effect.chooseSpells;
                const avail = gameData.spells.filter(sp => sp.level === cfg.level && (!cfg.classes || sp.classes.some(cl => cfg.classes.includes(cl))) && !known.includes(sp.name));
                if (avail.length) {
                    SHOW_SPELL_CHOICE(avail, cfg.count || 1, cfg.label || 'Выберите заклинание', sel => {
                        collected.spells.push(...sel);
                        closeModal('spell-choice-modal');
                        commit();
                    });
                    return;
                }
            }
            if (effect.chooseSpellsModal) {
                const cantrips = gameData.spells.filter(sp => sp.level === 0 && !known.includes(sp.name));
                SHOW_SPELL_CHOICE(cantrips, effect.chooseSpellsModal.cantrips || 2, 'Зачинатель магии: Выберите 2 заговора', selC => {
                    collected.spells.push(...selC);
                    closeModal('spell-choice-modal');
                    const lvl1 = gameData.spells.filter(sp => sp.level === 1 && !known.includes(sp.name));
                    setTimeout(() => {
                        SHOW_SPELL_CHOICE(lvl1, effect.chooseSpellsModal.level1 || 1, 'Зачинатель магии: Выберите 1 заклинание 1 круга (1/день бесплатно)', sel1 => {
                            collected.spells.push(...sel1);
                            collected.magicInitLvl1 = sel1[0] || '';
                            closeModal('spell-choice-modal');
                            commit();
                        });
                    }, 50);
                });
                return;
            }
            commit();
        }

        function commit() {
            const cs = GC();
            const ch = cs[PI];
            if (!ch) return;

            if (collected.statCode && collected.statBonus) {
                const capKey = collected.statCode === 'intl' ? 'baseInt' : ('base' + collected.statCode.charAt(0).toUpperCase() + collected.statCode.slice(1));
                const before = parseInt(ch[capKey], 10) || 10;
                const after = Math.min(20, before + collected.statBonus);
                const diff = after - before;
                ch[capKey] = after;
                if (diff > 0) {
                    ch._statBudgetTotal = (ch._statBudgetTotal || 72) + diff;
                    if (ch._asiMinFloor && ch._asiMinFloor[capKey] !== undefined) ch._asiMinFloor[capKey] += diff;
                }
            }

            if (collected.langs.length) {
                if (!ch.chosenLanguages) ch.chosenLanguages = {};
                collected.langs.forEach(l => { ch.chosenLanguages[l] = true; });
            }
            if (collected.skills.length) {
                if (!ch.chosenSkills) ch.chosenSkills = [];
                let add = 0;
                collected.skills.forEach(s => { if (!ch.chosenSkills.includes(s)) { ch.chosenSkills.push(s); add++; } });
                ch.bonusSkillSlots = (ch.bonusSkillSlots || 0) + add;
            }
            if (collected.tools.length) {
                if (!ch.toolProficiencies) ch.toolProficiencies = [];
                collected.tools.forEach(t => { if (!ch.toolProficiencies.includes(t)) ch.toolProficiencies.push(t); });
                ch.abilities = (ch.abilities ? ch.abilities + '<br>• ' : '• ') + '<b>Владение инструментами:</b> ' + collected.tools.join(', ');
            }
            if (collected.expertise.length) {
                if (!ch.expertiseSkills) ch.expertiseSkills = [];
                collected.expertise.forEach(s => { if (!ch.expertiseSkills.includes(s)) ch.expertiseSkills.push(s); });
            }
            if (collected.weapons.length) {
                if (!ch.weaponProficiencies) ch.weaponProficiencies = [];
                collected.weapons.forEach(w => { if (!ch.weaponProficiencies.includes(w)) ch.weaponProficiencies.push(w); });
                ch.abilities = (ch.abilities ? ch.abilities + '<br>• ' : '• ') + '<b>Владение оружием:</b> ' + collected.weapons.join(', ');
            }
            if (collected.metamagics.length) {
                if (!ch.metamagicChoices) ch.metamagicChoices = [];
                collected.metamagics.forEach(m => { if (!ch.metamagicChoices.includes(m)) ch.metamagicChoices.push(m); });
                const names = collected.metamagics.map(id => METAMAGIC_OPTIONS.find(x => x.id === id)?.name || id);
                ch.abilities = (ch.abilities ? ch.abilities + '<br>• ' : '• ') + `<b>Двойник-заклинатель (2 очк. чародейства):</b> ${names.join(', ')}`;
            }
            if (collected.ritualSpells.length) {
                if (!ch.ritualSpells) ch.ritualSpells = [];
                collected.ritualSpells.forEach(r => { if (!ch.ritualSpells.includes(r)) ch.ritualSpells.push(r); });
                ch.abilities = (ch.abilities ? ch.abilities + '<br>• ' : '• ') + `<b>Ритуальная книга (0 ячеек вне боя):</b> ${collected.ritualSpells.join(', ')}`;
            }
            if (collected.element) {
                if (!ch.elementalAdeptTypes) ch.elementalAdeptTypes = [];
                if (!ch.elementalAdeptTypes.includes(collected.element)) ch.elementalAdeptTypes.push(collected.element);
                ch.abilities = (ch.abilities ? ch.abilities + '<br>• ' : '• ') + `<b>Стихийный адепт (${collected.element}):</b> игнорирует сопротивление; 1 и 2 на кубах урона = 3.`;
            } else if (effect.autoAbilities && !collected.metamagics.length && !collected.ritualSpells.length) {
                ch.abilities = (ch.abilities ? ch.abilities + '<br>• ' : '• ') + '<b>' + featName + ':</b> ' + effect.autoAbilities;
            }
            if (collected.spells.length) {
                if (!ch.knownSpells) ch.knownSpells = [];
                if (!ch._featBonusSpells) ch._featBonusSpells = [];
                collected.spells.forEach(sp => {
                    if (!ch.knownSpells.includes(sp)) ch.knownSpells.push(sp);
                    if (!ch._featBonusSpells.includes(sp)) ch._featBonusSpells.push(sp);
                });
            }
            if (collected.magicInitLvl1) {
                ch._magicInitiateLvl1 = collected.magicInitLvl1;
                ch._magicInitiateStat = GET_CAST_STAT_KEY(ch);
            }
            if (effect.initiativeBonus) ch.initiativeBonus = (ch.initiativeBonus || 0) + effect.initiativeBonus;
            if (effect.speedBonus) ch.featSpeedBonus = (ch.featSpeedBonus || 0) + effect.speedBonus;
            if (effect.toughBonus) ch.toughPerLevel = (ch.toughPerLevel || 0) + effect.toughBonus;

            AB(ch); RHP(ch); SC(cs);
            if (doneCallback) doneCallback();
        }

        stepStat();
    };

    // ================================================================
    // 4. БОЕВОЙ ДВИЖОК С АВТОМАТИЧЕСКИМ УЧЁТОМ ЧЕРТ
    // ================================================================
    function ROLL_ATTACK_D20(c, statUsed, forceAdv = false, forceDis = false) {
        let adv = !!forceAdv, dis = !!forceDis;
        const notes = [];
        const st = GET_MAP_STATE();
        const myTok = st && st.tokens && st.tokens.find(t => t.isPlayer && t.charIdx === PI);
        const targetTok = st && st.tokens && st.tokens[window._bg3SelectedTargetIdx];

        if (myTok && Array.isArray(myTok.conditions)) {
            if (myTok.conditions.includes('invisible')) { adv = true; notes.push('👻 Невидимость'); }
            if (['prone', 'poisoned', 'blinded', 'frightened', 'restrained'].some(cd => myTok.conditions.includes(cd))) dis = true;
        }
        if (targetTok && Array.isArray(targetTok.conditions)) {
            if (['prone', 'stunned', 'paralyzed', 'blinded', 'restrained'].some(cd => targetTok.conditions.includes(cd))) adv = true;
        }

        // Человеческая решимость: превращает помеху в преимущество
        if (window._featHumanDetArmed && HAS_FEAT(c, 'Человеческая решимость') && GET_RES_LEFT(c, 'human_det', 1) > 0) {
            SPEND_RES(c, 'human_det', 1);
            window._featHumanDetArmed = false;
            dis = false; adv = true;
            notes.push('🔥 Решимость');
        }

        if (adv && dis) { adv = false; dis = false; }

        // Автоматическая Эльфийская точность (3к20 при преимуществе на Ловк/Инт/Муд/Хар)
        if (adv && HAS_FEAT(c, 'Эльфийская точность') && ['dex', 'intl', 'wis', 'cha'].includes(statUsed)) {
            const rolls = [1, 2, 3].map(() => Math.floor(Math.random() * 20) + 1);
            const best = Math.max(...rolls);
            notes.push(`🎯 Эльф. точность [${rolls.join(',')}]→${best}`);
            return { d20: best, note: notes.join(' • ') };
        }
        if (adv) {
            const r1 = Math.floor(Math.random() * 20) + 1, r2 = Math.floor(Math.random() * 20) + 1;
            const best = Math.max(r1, r2);
            notes.push(`Преим. [${r1},${r2}]→${best}`);
            return { d20: best, note: notes.join(' • ') };
        }
        if (dis) {
            const r1 = Math.floor(Math.random() * 20) + 1, r2 = Math.floor(Math.random() * 20) + 1;
            const worst = Math.min(r1, r2);
            notes.push(`Помеха [${r1},${r2}]→${worst}`);
            return { d20: worst, note: notes.join(' • ') };
        }
        return { d20: Math.floor(Math.random() * 20) + 1, note: notes.join(' • ') };
    }

    // Прикрепляет реактивные кнопки (Удачливый при промахе / Орочья свирепость при попадании) прямо в боевой баннер
    function APPEND_REACTIVE_ATTACK_BANNERS(c, isHit, isWeaponHit, dmgFormula) {
        const extra = [];
        if (!isHit && HAS_FEAT(c, 'Удачливый')) {
            const left = GET_RES_LEFT(c, 'lucky', 3);
            if (left > 0) {
                extra.push(`<button class="btn-small btn-save" onclick="FEAT_USE_LUCKY_ON_ATTACK()">🍀 Перебросить промах (Удачливый: ${left}/3)</button>`);
            }
        }
        if (isHit && isWeaponHit && HAS_FEAT(c, 'Орочья свирепость') && GET_RES_LEFT(c, 'orc_fury', 1) > 0) {
            extra.push(`<button class="btn-small btn-warn" onclick="FEAT_APPLY_ORC_FURY_BONUS_DIE()">💢 Добавить +${ESC(dmgFormula)} урона (Орочья свирепость)</button>`);
        }
        if (extra.length) {
            window._bg3CombatLogBanner = (window._bg3CombatLogBanner || '') +
                `<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">${extra.join('')}</div>`;
        }
    }

    window._FEATS_EXEC_WEAPON_ATTACK = function(invIdx, opts = {}) {
        const cs = GC();
        const c = cs[PI];
        const inv = c && c.inventory;
        const item = inv && inv[invIdx];
        if (!item) return;

        const st = GET_MAP_STATE();
        const to = ENSURE_TURN_STATE(st);
        const costMode = opts.cost || 'action';
        if (costMode === 'action' && to.attacksLeft <= 0) return;
        if (costMode === 'bonus' && to.bonusLeft <= 0) return;
        if (costMode === 'reaction' && !HAS_REACTION(st)) return;

        let forceAdv = !!opts.forceAdv;
        if (window._featForceAdvFromInsp && typeof GET_INSPIRATION_COUNT === 'function' && GET_INSPIRATION_COUNT(c) > 0) {
            c.inspiration = GET_INSPIRATION_COUNT(c) - 1;
            window._featForceAdvFromInsp = false;
            window._inspArmed = false;
            forceAdv = true;
        }

        const pb = GPB(c.level || 1);
        const sm = GM(c.str || 10), dm = GM(c.dex || 10);
        let statUsed = 'str', am = sm;
        if (item.finesse && dm >= sm) { am = dm; statUsed = 'dex'; }
        else if (item.ranged) { am = dm; statUsed = 'dex'; }

        const propsLow = (item.properties || '').toLowerCase().replace(/ё/g, 'е');
        const isHeavyMelee = !item.ranged && HEAVY_MELEE_RE.test(propsLow);
        const isRanged = !!(item.ranged || propsLow.includes('боеприпасы'));

        let atkPenalty = 0, dmgBonus = 0;
        const tags = [];
        if (isHeavyMelee && HAS_FEAT(c, 'Великий мастер оружия') && window._featPowerAtkGwm && !opts.overrideDamage) {
            atkPenalty -= 5; dmgBonus += 10; tags.push('ВМО −5/+10');
        }
        if (isRanged && HAS_FEAT(c, 'Меткий стрелок') && window._featPowerAtkSharp) {
            atkPenalty -= 5; dmgBonus += 10; tags.push('Меткий стрелок −5/+10');
        }

        let dmgFormula = opts.overrideDamage || item.damage || '1к4';
        const handsItems = inv.filter(x => x.equipped && (x.isWeapon || x.isShield)).length;
        if (!opts.overrideDamage && propsLow.includes('универсальное') && handsItems <= 1) {
            const m = (item.properties || '').match(/универсальное\s*\(([^)]+)\)/i);
            if (m && m[1]) dmgFormula = m[1];
        }

        if (!opts.overrideDamage && propsLow.includes('боеприпасы')) {
            const aIdx = inv.findIndex(x => /стрел|болт|снаряд/i.test(x.name || '') && (parseInt(x.qty, 10) || 0) > 0);
            if (aIdx !== -1) {
                if (parseInt(inv[aIdx].qty, 10) > 1) inv[aIdx].qty = String(parseInt(inv[aIdx].qty, 10) - 1);
                else inv.splice(aIdx, 1);
            }
        }

        const rollObj = ROLL_ATTACK_D20(c, statUsed, forceAdv, false);
        const d20 = rollObj.d20;
        const atkBonusTotal = am + pb + atkPenalty;
        const atkTotal = d20 + atkBonusTotal;
        const isCrit = d20 === 20;
        const modForDmg = opts.offhand ? Math.min(0, am) : am;

        let dmg = Math.max(1, window.ROLL(dmgFormula) + modForDmg + dmgBonus);
        if (isCrit) dmg += Math.max(1, window.ROLL(dmgFormula));

        if (costMode === 'action') {
            to.attacksLeft = Math.max(0, to.attacksLeft - 1);
            if (to.attacksLeft === 0) to.actionsLeft = 0;
        } else if (costMode === 'bonus') {
            to.bonusLeft = Math.max(0, to.bonusLeft - 1);
            if (opts.consumeGwmBonus) window._featGwmBonusReady = false;
        } else if (costMode === 'reaction') {
            USE_REACTION(st);
            if (opts.consumeOrcReaction) window._featOrcReactionReady = false;
        }

        SC(cs); SAVE_MAP_STATE(st); BREAK_MY_INVIS();

        const targetTok = st.tokens && st.tokens[window._bg3SelectedTargetIdx];
        const prevHp = targetTok ? (targetTok.hp || 0) : 0;
        const isHit = isCrit || (d20 !== 1 && atkTotal >= (targetTok?.ac || 12));

        window._featLastAttackCtx = {
            targetIdx: window._bg3SelectedTargetIdx, prevTargetHp: prevHp,
            atkBonusTotal, dmg, dmgFormula, wasHit: isHit, isWeapon: true,
            actionTitle: opts.label || item.name
        };

        const titleParts = [opts.label || item.name];
        if (tags.length) titleParts.push(`[${tags.join(', ')}]`);
        if (rollObj.note) titleParts.push(`(${rollObj.note})`);
        BG3_APPLY_DAMAGE_TO_SELECTED_TOKEN(dmg, d20 === 1 ? 1 : atkTotal, isCrit, titleParts.join(' '));

        const afterTok = GET_MAP_STATE().tokens?.[window._bg3SelectedTargetIdx];
        const killed = isHit && afterTok && prevHp > 0 && (afterTok.hp || 0) <= 0;
        const notes = [];
        if (!isRanged && HAS_FEAT(c, 'Великий мастер оружия') && (isCrit || killed)) {
            window._featGwmBonusReady = true;
            notes.push('💥 <b>ВМО:</b> открыта бонусная атака (во вкладке «⚔️ Оружие»)!');
        }
        if (!isRanged && HAS_FEAT(c, 'Подвижный')) {
            notes.push('💨 <b>Подвижный:</b> цель не провоцирует по вам атаку до конца хода.');
        }
        if (isHit && HAS_FEAT(c, 'Убийца магов')) {
            notes.push('🧙 <b>Убийца магов:</b> проверка Концентрации цели идёт с <b>помехой</b>.');
        }
        if (notes.length) {
            window._bg3CombatLogBanner = (window._bg3CombatLogBanner || '') +
                `<div style="background:var(--ui-panel2, #181715); border-left:3px solid var(--ui-accent, #d2b278); padding:5px 10px; border-radius:6px; margin-bottom:8px; font-size:0.82rem; color:var(--ui-accent, #e6c88c);">${notes.join('<br>')}</div>`;
        }
        APPEND_REACTIVE_ATTACK_BANNERS(c, isHit, true, dmgFormula);
        RMC(); RENDER_MAP_AREA();
    };

    window._FEATS_EXEC_UNARMED = function() {
        const cs = GC();
        const c = cs[PI];
        if (!c) return;
        const st = GET_MAP_STATE();
        const to = ENSURE_TURN_STATE(st);
        if (to.attacksLeft <= 0) return;

        let forceAdv = false;
        if (window._featForceAdvFromInsp && typeof GET_INSPIRATION_COUNT === 'function' && GET_INSPIRATION_COUNT(c) > 0) {
            c.inspiration = GET_INSPIRATION_COUNT(c) - 1;
            window._featForceAdvFromInsp = false;
            window._inspArmed = false;
            forceAdv = true;
        }

        const pb = GPB(c.level || 1);
        const sm = GM(c.str || 10), dm = GM(c.dex || 10);
        const isMonk = c.className === 'Монах', lv = c.level || 1;
        const statUsed = (isMonk && dm >= sm) ? 'dex' : 'str';
        const am = statUsed === 'dex' ? dm : sm;

        let dmgDice = '', label = 'Безоружный удар';
        if (isMonk) { dmgDice = lv >= 17 ? '1к10' : (lv >= 11 ? '1к8' : (lv >= 5 ? '1к6' : '1к4')); label = `Боевые искусства (${dmgDice})`; }
        else if (HAS_FEAT(c, 'Драконья шкура')) { dmgDice = '1к4'; label = '🐉 Когти (1к4 рубящ.)'; }
        else if (HAS_FEAT(c, 'Драчун')) { dmgDice = '1к4'; label = '👊 Удар (Драчун • 1к4)'; }

        const rollObj = ROLL_ATTACK_D20(c, statUsed, forceAdv, false);
        const d20 = rollObj.d20, atkTotal = d20 + am + pb, isCrit = d20 === 20;
        let dmg = dmgDice ? Math.max(1, window.ROLL(dmgDice) + am) : Math.max(1, 1 + am);
        if (isCrit) dmg += dmgDice ? Math.max(1, window.ROLL(dmgDice)) : 1;

        to.attacksLeft = Math.max(0, to.attacksLeft - 1);
        if (to.attacksLeft === 0) to.actionsLeft = 0;
        SC(cs); SAVE_MAP_STATE(st); BREAK_MY_INVIS();

        const targetTok = st.tokens && st.tokens[window._bg3SelectedTargetIdx];
        const isHit = isCrit || (d20 !== 1 && atkTotal >= (targetTok?.ac || 12));
        window._featLastAttackCtx = {
            targetIdx: window._bg3SelectedTargetIdx, prevTargetHp: targetTok?.hp || 0,
            atkBonusTotal: am + pb, dmg, dmgFormula: dmgDice || '1', wasHit: isHit, isWeapon: false, actionTitle: label
        };

        BG3_APPLY_DAMAGE_TO_SELECTED_TOKEN(dmg, d20 === 1 ? 1 : atkTotal, isCrit, rollObj.note ? `${label} (${rollObj.note})` : label);
        APPEND_REACTIVE_ATTACK_BANNERS(c, isHit, false, dmgDice || '1');
        RMC(); RENDER_MAP_AREA();
    };

    window._FEATS_EXEC_CAST_SPELL = function(spellName, opts = {}) {
        const cs = GC();
        const c = cs[PI];
        const sp = gameData.spells.find(s => s.name === spellName);
        if (!c || !sp) return;

        const st = GET_MAP_STATE();
        const to = ENSURE_TURN_STATE(st);
        const metaId = window._featActiveMetamagic || '';
        const metaDef = METAMAGIC_OPTIONS.find(m => m.id === metaId) || null;
        const useMeta = !!(metaDef && GET_SORC_POINTS(c).left >= metaDef.cost);

        const isReaction = !!opts.asReaction;
        const isBonus = !isReaction && ((sp.time || '').toLowerCase().includes('бонус') || (useMeta && metaId === 'quickened'));
        if (isReaction && !HAS_REACTION(st)) return;
        if (isBonus && to.bonusLeft <= 0) return;
        if (!isReaction && !isBonus && to.actionsLeft <= 0) return;

        const prevConc = c.concentratingSpell || '';
        window._castingFromBg3Hud = true;
        CAST_SPELL(spellName);
        window._castingFromBg3Hud = false;

        if (!window._lastCastSucceeded || !window._lastCastMeta) {
            const fixCs = GC();
            if (fixCs[PI]) { fixCs[PI].concentratingSpell = prevConc; SC(fixCs); }
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

        if (isReaction) USE_REACTION(freshSt);
        else if (isBonus) freshTo.bonusLeft = Math.max(0, freshTo.bonusLeft - 1);
        else { freshTo.actionsLeft = 0; freshTo.attacksLeft = 0; }

        let metaBadge = '';
        if (useMeta) {
            if (!caster.classResUsed) caster.classResUsed = {};
            caster.classResUsed.sorc_pts = (Number(caster.classResUsed.sorc_pts) || 0) + metaDef.cost;
            window._featActiveMetamagic = '';
            metaBadge = ` • 🔮 ${metaDef.name}`;
        }

        const castStat = GET_CAST_STAT_KEY(caster);
        const rollObj = ROLL_ATTACK_D20(caster, castStat, !!window._featForceAdvFromInsp, false);
        if (window._featForceAdvFromInsp && typeof GET_INSPIRATION_COUNT === 'function' && GET_INSPIRATION_COUNT(caster) > 0) {
            caster.inspiration = GET_INSPIRATION_COUNT(caster) - 1;
            window._featForceAdvFromInsp = false;
            window._inspArmed = false;
        }
        const spellAtkRoll = rollObj.d20;
        const spellAtkTotal = spellAtkRoll + GPB(caster.level || 1) + GM(caster[castStat] || 10);

        SC(freshCs); BREAK_MY_INVIS();

        const desc = sp.desc || '';
        const slotNote = (meta.level === 0 ? 'заговор' : (meta.usedFeatFreeCast ? '1/день от черты' : (meta.usedSlotLevel !== meta.level ? `${meta.level} кр. → ячейка ${meta.usedSlotLevel} кр.` : `${meta.level} круг`))) + metaBadge;

        if (/лечение ран|лечащее слово|массовое лечение ран|полное восстановление|массовое исцеление/i.test(spellName)) {
            const healTok = (targetTok && targetTok.isPlayer) ? targetTok : tokens.find(t => t.isPlayer && t.charIdx === PI);
            const healChar = (healTok && freshCs[healTok.charIdx]) ? freshCs[healTok.charIdx] : caster;
            let healed = 0;
            if (/полное восстановление|массовое исцеление/i.test(spellName)) {
                healed = Math.max(0, (healChar.maxHp || 10) - (healChar.hp || 0));
                healChar.hp = healChar.maxHp || 10;
            } else {
                const sides = /лечащее слово/i.test(spellName) ? 4 : 8;
                const cnt = /массовое/i.test(spellName) ? 3 : Math.max(1, meta.usedSlotLevel || 1);
                healed = Math.max(1, window.ROLL(`${cnt}к${sides}`) + meta.mod);
                healChar.hp = Math.min(healChar.maxHp || 10, (healChar.hp || 0) + healed);
            }
            if (healTok) healTok.hp = healChar.hp;
            SC(freshCs); SAVE_MAP_STATE(freshSt);
            window._bg3CombatLogBanner = `<div style="background:#192e1e; border-left:4px solid #6cb878; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#d8f3dc;">💚 <b>${spellName}</b> (${slotNote}) → <b>${healChar.name}</b>: <b>+${healed} ХП</b> (${healChar.hp}/${healChar.maxHp}).</div>`;
            LOG_COMBAT_TO_CHAT(`💚 колдует «${spellName}» (${slotNote}) на «${healChar.name}»: +${healed} ХП (${healChar.hp}/${healChar.maxHp}).`);
            RMC(); RENDER_MAP_AREA();
            return;
        }

        if (spellName === 'Доспех Агатиса') {
            const gain = 5 * Math.max(1, meta.usedSlotLevel || 1);
            caster.tempHP = Math.max(caster.tempHP || 0, gain);
            SC(freshCs); SAVE_MAP_STATE(freshSt);
            window._bg3CombatLogBanner = `<div style="background:#1e2636; border-left:4px solid #5b8fb8; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#e0f2fe;">🛡️ <b>Доспех Агатиса</b> (${slotNote}): <b>+${gain} врем. ХП</b>.</div>`;
            LOG_COMBAT_TO_CHAT(`🛡️ колдует «Доспех Агатиса» (${slotNote}): +${gain} врем. ХП.`);
            RMC(); RENDER_MAP_AREA();
            return;
        }

        const dmgFormula = (typeof PARSE_SPELL_DICE_FROM_DESC === 'function') ? PARSE_SPELL_DICE_FROM_DESC(desc) : null;
        const isDamageSpell = dmgFormula && /урон|некротик|огн|холод|молн|кислот|излучен|псих|гром|яд|силов|стрел|колющ|дробящ/i.test(desc);

        if (isDamageSpell && targetTok) {
            const isAutoOrSave = /спас|стрел|авто|волшебная стрела|огненный шар|конус холода|огненные ладони|волна грома|молния/i.test(spellName + ' ' + desc);
            const rollSpellDmg = (form) => {
                const elems = caster.elementalAdeptTypes || [];
                const elemRe = { 'Огонь': /огн|пылающ/, 'Холод': /холод|мороз|лед/, 'Молния': /молн|электр/, 'Гром': /гром/, 'Кислота': /кислот/ };
                const adeptOn = elems.some(el => elemRe[el] && elemRe[el].test(desc.toLowerCase()));
                const empowOn = useMeta && metaId === 'empowered';
                const tokensF = String(form).toLowerCase().replace(/\s+/g, '').replace(/[dд]/g, 'к').match(/[+-]?[^+-]+/g) || [];
                let sum = 0;
                tokensF.forEach(tk => {
                    const sgn = tk.startsWith('-') ? -1 : 1;
                    const bd = tk.replace(/^[+-]/, '');
                    if (bd.includes('к')) {
                        const [cS, sS] = bd.split('к');
                        const cnt = Math.max(1, parseInt(cS, 10) || 1), sides = Math.max(2, parseInt(sS, 10) || 6);
                        for (let i = 0; i < cnt; i++) {
                            let r = Math.floor(Math.random() * sides) + 1;
                            if (empowOn && r < Math.ceil(sides / 2)) r = Math.floor(Math.random() * sides) + 1;
                            if (adeptOn && r <= 2) r = 3;
                            sum += sgn * r;
                        }
                    } else sum += sgn * (parseInt(bd, 10) || 0);
                });
                return { total: Math.max(1, sum), adeptOn };
            };

            let rRes = rollSpellDmg(dmgFormula);
            let dmg = rRes.total;
            if (/волшебная стрела/i.test(spellName)) {
                dmg = 0;
                for (let d = 0; d < 2 + Math.max(1, meta.usedSlotLevel || 1); d++) dmg += window.ROLL('1к4+1');
            }
            if (useMeta && metaId === 'twinned') dmg = Math.round(dmg * 1.5);

            const isCrit = !isAutoOrSave && spellAtkRoll === 20;
            if (isCrit) dmg += rollSpellDmg(dmgFormula).total;

            const targetAC = targetTok.ac || 12, prevHp = targetTok.hp || 0;
            const isHit = isAutoOrSave || isCrit || (spellAtkRoll !== 1 && spellAtkTotal >= targetAC);

            window._featLastAttackCtx = {
                targetIdx: window._bg3SelectedTargetIdx, prevTargetHp: prevHp,
                atkBonusTotal: GPB(caster.level || 1) + GM(caster[castStat] || 10),
                dmg, dmgFormula, wasHit: isHit, isWeapon: false, actionTitle: `✨ ${spellName}`
            };

            if (isHit) {
                targetTok.hp = Math.max(0, prevHp - dmg);
                if (targetTok.isPlayer && freshCs[targetTok.charIdx]) { freshCs[targetTok.charIdx].hp = targetTok.hp; SC(freshCs); }
                SAVE_MAP_STATE(freshSt);
                const deadNote = targetTok.hp <= 0 ? ' 💀 <b>ЦЕЛЬ ПОВЕРЖЕНА!</b>' : ` (Осталось ${targetTok.hp}/${targetTok.maxHp} ХП)`;
                const hitInfo = isAutoOrSave ? `Сл: <b>${meta.spellDC}</b>` : `Атака: <b>${spellAtkTotal}</b>${rollObj.note ? ` (${rollObj.note})` : ''} vs КБ ${targetAC}${isCrit ? ' 💥 <b>КРИТ!</b>' : ''}`;
                window._bg3CombatLogBanner = `<div style="background:#241936; border-left:4px solid #a855f7; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#f3e8ff;">✨ <b>${spellName}</b> (${slotNote}) → «<b>${targetTok.name}</b>»: ${hitInfo} | Урон <b>${dmg}</b>${rRes.adeptOn ? ' <i>(Стихийный адепт)</i>' : ''}!${deadNote}</div>`;
                LOG_COMBAT_TO_CHAT(`✨ «${caster.name}» колдует «${spellName}» (${slotNote}) → «${targetTok.name}»: урон ${dmg}!${targetTok.hp <= 0 ? ' [ПОВЕРЖЕН]' : ''}`);
            } else {
                SAVE_MAP_STATE(freshSt);
                window._bg3CombatLogBanner = `<div style="background:#2d2118; border-left:4px solid #f59e0b; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#fde68a;">🛡️ <b>${spellName}</b> (${slotNote}) → «<b>${targetTok.name}</b>»: <b>ПРОМАХ!</b> (${spellAtkTotal} против КБ ${targetAC})</div>`;
                LOG_COMBAT_TO_CHAT(`🛡️ «${caster.name}» промахивается «${spellName}» по «${targetTok.name}» (${spellAtkTotal} vs КБ ${targetAC}).`);
                APPEND_REACTIVE_ATTACK_BANNERS(caster, false, false, dmgFormula);
            }
            RMC(); RENDER_MAP_AREA();
            return;
        }

        SAVE_MAP_STATE(freshSt);
        window._bg3CombatLogBanner = `<div style="background:#241936; border-left:4px solid #a855f7; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#f3e8ff;">✨ <b>${spellName}</b> (${slotNote}) • Сл: <b>${meta.spellDC}</b><br><small style="color:#d8b4fe;">${desc}</small></div>`;
        LOG_COMBAT_TO_CHAT(`✨ «${caster.name}» колдует «${spellName}» (${slotNote}, Сл ${meta.spellDC})${targetTok ? ` -> ${targetTok.name}` : ''}.`);
        RMC(); RENDER_MAP_AREA();
    };

    // Обёртки для удвоения дальности заклинаний и передачи Вдохновения в Эльфийскую точность
    const _ORIG_WEP_OUTER = window.BG3_PLAYER_USE_WEAPON;
    if (typeof _ORIG_WEP_OUTER === 'function') {
        window.BG3_PLAYER_USE_WEAPON = function(invIdx) {
            const hadInsp = !!window._inspArmed;
            if (hadInsp) { window._featForceAdvFromInsp = true; window._inspArmed = false; }
            try { return _ORIG_WEP_OUTER(invIdx); }
            finally { if (window._featForceAdvFromInsp) { window._featForceAdvFromInsp = false; if (hadInsp) window._inspArmed = true; } }
        };
    }

    const _ORIG_CAST_OUTER = window.BG3_PLAYER_CAST_SPELL;
    if (typeof _ORIG_CAST_OUTER === 'function') {
        window.BG3_PLAYER_CAST_SPELL = function(spellName) {
            const c = GC()[PI];
            const sp = gameData.spells.find(s => s.name === spellName);
            const origRange = sp ? sp.range : null;
            if (sp && c) {
                let mult = 1;
                if (HAS_FEAT(c, 'Меткий заклинатель')) mult *= 2;
                if (window._featActiveMetamagic === 'distant' && GET_SORC_POINTS(c).left >= 1) mult *= 2;
                if (mult > 1) {
                    const m = String(sp.range || '').match(/(\d+)\s*фт/i);
                    if (m) sp.range = `${parseInt(m[1], 10) * mult} фт.`;
                    else if (/касан/i.test(sp.range || '') && window._featActiveMetamagic === 'distant') sp.range = '30 фт.';
                }
            }
            const hadInsp = !!window._inspArmed;
            if (hadInsp) { window._featForceAdvFromInsp = true; window._inspArmed = false; }
            try { return _ORIG_CAST_OUTER(spellName); }
            finally {
                if (sp && origRange !== null) sp.range = origRange;
                if (window._featForceAdvFromInsp) { window._featForceAdvFromInsp = false; if (hadInsp) window._inspArmed = true; }
            }
        };
    }

    // Бесплатный каст 1/день от «Зачинателя магии» только для выбранного им заклинания
    const _ORIG_CAST_SP = window.CAST_SPELL;
    if (typeof _ORIG_CAST_SP === 'function') {
        window.CAST_SPELL = function(spellName) {
            const c = GC()[PI];
            const sp = gameData.spells.find(s => s.name === spellName);
            if (c && sp && sp.level === 1 && HAS_FEAT(c, 'Зачинатель магии') && c._magicInitiateLvl1 && c._magicInitiateLvl1 !== spellName) {
                const maxS = GET_SPELL_SLOTS(c), usedS = c.usedSpellSlots || {};
                let hasSlot = false;
                for (let i = 1; i <= 9; i++) if ((maxS[i] || 0) - (usedS[i] || 0) > 0) hasSlot = true;
                if (!hasSlot) {
                    window._lastCastSucceeded = false;
                    window._lastCastMeta = null;
                    window._bg3CombatLogBanner = `<div style="background:#3a1818; border-left:4px solid #d66565; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#fecaca;">❌ Нет свободных ячеек! Бесплатный каст 1/день от «Зачинателя магии» доступен только для «${ESC(c._magicInitiateLvl1)}».</div>`;
                    return false;
                }
            }
            return _ORIG_CAST_SP(spellName);
        };
    }

    // ================================================================
    // 5. КОНТЕКСТНЫЕ ДЕЙСТВИЯ ЧЕРТ (ВЫЗЫВАЮТСЯ ИЗ ОРУЖИЯ / ДЕЙСТВИЙ / ОТДЫХА / БАННЕРОВ)
    // ================================================================
    window.FEAT_GWM_BONUS_ATTACK = function() {
        const c = GC()[PI];
        if (!c || !window._featGwmBonusReady) return;
        const wIdx = (c.inventory || []).findIndex(i => i && i.equipped && i.isWeapon && !i.ranged);
        if (wIdx !== -1) window._FEATS_EXEC_WEAPON_ATTACK(wIdx, { cost: 'bonus', consumeGwmBonus: true, label: '💥 Бонусная атака (ВМО)' });
    };

    window.FEAT_POLEARM_BUTT_ATTACK = function() {
        const c = GC()[PI];
        const wIdx = (c?.inventory || []).findIndex(i => i && i.equipped && i.isWeapon && POLEARM_RE.test(i.name || ''));
        if (wIdx !== -1) window._FEATS_EXEC_WEAPON_ATTACK(wIdx, { cost: 'bonus', overrideDamage: '1к4', label: '🔱 Удар древком (1к4)' });
    };

    window.FEAT_OFFHAND_ATTACK = function() {
        const c = GC()[PI];
        const melee = [];
        (c?.inventory || []).forEach((i, idx) => { if (i && i.equipped && i.isWeapon && !i.ranged) melee.push(idx); });
        if (melee.length >= 2) window._FEATS_EXEC_WEAPON_ATTACK(melee[1], { cost: 'bonus', offhand: true, label: `⚔️ Вторая рука (${c.inventory[melee[1]].name})` });
    };

    window.FEAT_ORC_REACTION_ATTACK = function() {
        const c = GC()[PI];
        const wIdx = (c?.inventory || []).findIndex(i => i && i.equipped && i.isWeapon && !i.ranged);
        if (wIdx !== -1) window._FEATS_EXEC_WEAPON_ATTACK(wIdx, { cost: 'reaction', consumeOrcReaction: true, label: '💢 Контратака (Орочья свирепость)' });
    };

    window.FEAT_APPLY_ORC_FURY_BONUS_DIE = function() {
        const cs = GC(), c = cs[PI], ctx = window._featLastAttackCtx;
        if (!c || !ctx || !ctx.wasHit || GET_RES_LEFT(c, 'orc_fury', 1) <= 0) return;
        const st = GET_MAP_STATE(), tok = st.tokens && st.tokens[ctx.targetIdx];
        if (!tok) return;
        const extra = Math.max(1, window.ROLL(ctx.dmgFormula || '1к8'));
        tok.hp = Math.max(0, (tok.hp || 0) - extra);
        if (tok.isPlayer && cs[tok.charIdx]) cs[tok.charIdx].hp = tok.hp;
        SPEND_RES(c, 'orc_fury', 1);
        SC(cs); SAVE_MAP_STATE(st);
        const msg = `💢 <b>Орочья свирепость!</b> Доп. куб (${ctx.dmgFormula}): <b>+${extra} урона</b> по «${ESC(tok.name)}» (осталось ${tok.hp}/${tok.maxHp} ХП).`;
        window._bg3CombatLogBanner = `<div style="background:#2d1a1a; border-left:4px solid #ef4444; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#fecaca;">${msg}</div>`;
        LOG_COMBAT_TO_CHAT(msg.replace(/<[^>]+>/g, ''));
        RMC(); RENDER_MAP_AREA();
    };

    window.FEAT_ATHLETICS_MANEUVER = function(kind) {
        const c = GC()[PI], st = GET_MAP_STATE(), to = ENSURE_TURN_STATE(st);
        if (!c || to.bonusLeft <= 0) return;
        const tIdx = window._bg3SelectedTargetIdx, tok = st.tokens && st.tokens[tIdx];
        if (!tok) { showMessage('⚠️ Нет цели', 'Выберите цель на карте.'); return; }
        const bon = (typeof GET_CHAR_CHECK_BONUS === 'function') ? GET_CHAR_CHECK_BONUS(c, 'Атлетика') : GM(c.str || 10);
        const myR = Math.floor(Math.random() * 20) + 1 + bon, enR = Math.floor(Math.random() * 20) + 1 + 2;
        const ok = myR >= enR;
        to.bonusLeft = Math.max(0, to.bonusLeft - 1);
        SAVE_MAP_STATE(st);

        if (kind === 'grapple') {
            if (ok) ADD_TOKEN_COND(tIdx, 'restrained');
            const msg = ok ? `🤼 <b>Захват (Драчун)</b> удался (${myR} vs ${enR}) — «${ESC(tok.name)}» схвачен (🕸️ Опутан).` : `🤼 <b>Захват (Драчун)</b> сорвался (${myR} vs ${enR}).`;
            window._bg3CombatLogBanner = `<div style="background:#1c2430; border-left:4px solid ${ok ? '#6cb878' : '#d99a4e'}; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#e0f2fe;">${msg}</div>`;
            LOG_COMBAT_TO_CHAT(msg.replace(/<[^>]+>/g, ''));
        } else {
            if (ok) ADD_TOKEN_COND(tIdx, 'prone');
            const msg = ok ? `🛡️ <b>Толчок щитом</b> удался (${myR} vs ${enR}) — «${ESC(tok.name)}» сбит с ног (⬇️).` : `🛡️ <b>Толчок щитом</b> не прошёл (${myR} vs ${enR}).`;
            window._bg3CombatLogBanner = `<div style="background:#1c2430; border-left:4px solid ${ok ? '#6cb878' : '#d99a4e'}; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#e0f2fe;">${msg}</div>`;
            LOG_COMBAT_TO_CHAT(msg.replace(/<[^>]+>/g, ''));
        }
        RENDER_MAP_AREA();
    };

    window.FEAT_DRAGON_FEAR = function() {
        const cs = GC(), c = cs[PI];
        if (!c || !HAS_FEAT(c, 'Драконий страх') || GET_RES_LEFT(c, 'dragon_fear', 1) <= 0) return;
        const st = GET_MAP_STATE(), to = ENSURE_TURN_STATE(st);
        if (c.inCombat && to.actionsLeft <= 0) return;

        const dc = 8 + GPB(c.level || 1) + GM(c.cha || 10);
        const myTok = (st.tokens || []).find(t => t.isPlayer && t.charIdx === PI);
        const scared = [], saved = [];
        (st.tokens || []).forEach(tok => {
            if (tok.isPlayer || (tok.hp || 0) <= 0) return;
            if (myTok && typeof CALC_MAP_DISTANCE_FT === 'function' && CALC_MAP_DISTANCE_FT(st, myTok.x, myTok.y, tok.x, tok.y) > 32.5) return;
            const r = Math.floor(Math.random() * 20) + 1;
            if (r < dc) {
                if (!Array.isArray(tok.conditions)) tok.conditions = [];
                if (!tok.conditions.includes('frightened')) tok.conditions.push('frightened');
                scared.push(`${tok.name} (${r})`);
            } else saved.push(`${tok.name} (${r})`);
        });
        SPEND_RES(c, 'dragon_fear', 1);
        if (c.inCombat) { to.actionsLeft = 0; to.attacksLeft = 0; }
        SC(cs); SAVE_MAP_STATE(st);
        const msg = `🐉 <b>Драконий страх</b> (Сл Мудр ${dc}): ${scared.length ? '😱 испуганы — ' + scared.join(', ') : 'никто не испугался'}${saved.length ? ' | устояли: ' + saved.join(', ') : ''}.`;
        window._bg3CombatLogBanner = `<div style="background:#2b1b29; border-left:4px solid #c084fc; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#f3e8ff;">${msg}</div>`;
        LOG_COMBAT_TO_CHAT(msg.replace(/<[^>]+>/g, ''));
        RMC(); RENDER_MAP_AREA();
    };

    window.FEAT_DWARVEN_FORTITUDE_HEAL = function() {
        const cs = GC(), c = cs[PI];
        if (!c || !HAS_FEAT(c, 'Дварфийская стойкость')) return;
        const avail = GET_AVAIL_HIT_DICE(c);
        if (avail <= 0) { showMessage('🪓 Нет Костей Хитов', 'Все Кости Хитов потрачены.'); return; }
        const hdSides = parseInt((c.hitDice || '1к8').replace('1к', ''), 10) || 8;
        const cm = GM(c.con || 10);
        let heal = Math.floor(Math.random() * hdSides) + 1 + cm;
        heal = HAS_FEAT(c, 'Крепкий') ? Math.max(heal, Math.max(2, cm * 2)) : Math.max(1, heal);
        c.spentHitDice = (c.spentHitDice || 0) + 1;
        c.hp = Math.min(c.maxHp || 10, (c.hp || 0) + heal);
        SC(cs);
        const st = GET_MAP_STATE(), myTok = (st.tokens || []).find(t => t.isPlayer && t.charIdx === PI);
        if (myTok) { myTok.hp = c.hp; SAVE_MAP_STATE(st); }
        const msg = `🪓 <b>Дварфийская стойкость:</b> потрачена Кость Хитов → <b style="color:#6cb878;">+${heal} ХП</b> (${c.hp}/${c.maxHp}, осталось КХ: ${avail - 1}).`;
        window._bg3CombatLogBanner = `<div style="background:#192e1e; border-left:4px solid #6cb878; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#d8f3dc;">${msg}</div>`;
        LOG_COMBAT_TO_CHAT(msg.replace(/<[^>]+>/g, ''));
        RMC(); RENDER_MAP_AREA();
    };

    window.FEAT_INSPIRING_LEADER = function() {
        const cs = GC(), c = cs[PI];
        if (!c || !HAS_FEAT(c, 'Воодушевляющий лидер') || GET_RES_LEFT(c, 'insp_leader', 1) <= 0) return;
        const gain = (c.level || 1) + Math.max(0, GM(c.cha || 10));
        const rc = CUR_ROOM();
        const idxs = (typeof GET_ROOM_PARTY_INDICES === 'function' ? GET_ROOM_PARTY_INDICES(rc) : cs.map((_, i) => i)).slice(0, 6);
        const names = [];
        idxs.forEach(i => {
            if (!cs[i]) return;
            const fn = ch => { ch.tempHP = Math.max(ch.tempHP || 0, gain); names.push(ch.name || 'Герой'); };
            if (typeof MUTATE_HERO_IN_ROOM === 'function') MUTATE_HERO_IN_ROOM(cs[i], rc, fn);
            else fn(cs[i]);
        });
        SPEND_RES(c, 'insp_leader', 1);
        SC(cs); RMC(); RPL();
        LOG_COMBAT_TO_CHAT(`📣 Воодушевляющий лидер: отряд (${names.join(', ')}) получает +${gain} врем. ХП!`);
        if (document.getElementById('rest-modal')?.classList.contains('active')) SSR();
        showMessage('📣 Воодушевляющий лидер', `Отряд (<b>${ESC(names.join(', '))}</b>) получил <b style="color:#6cb878;">+${gain} временных ХП</b>!`);
    };

    window.FEAT_USE_LUCKY_ON_ATTACK = function() {
        const cs = GC(), c = cs[PI], ctx = window._featLastAttackCtx;
        if (!c || !ctx || GET_RES_LEFT(c, 'lucky', 3) <= 0) return;
        const left = GET_RES_LEFT(c, 'lucky', 3);
        SPEND_RES(c, 'lucky', 1); SC(cs);

        const st = GET_MAP_STATE(), tok = st.tokens && st.tokens[ctx.targetIdx];
        const d20 = Math.floor(Math.random() * 20) + 1;
        const total = d20 + (ctx.atkBonusTotal || 0);
        const isCrit = d20 === 20, ac = tok ? (tok.ac || 12) : 12;
        const hit = isCrit || (d20 !== 1 && total >= ac);

        if (hit && !ctx.wasHit && tok) {
            const finalDmg = isCrit ? ctx.dmg + Math.max(1, window.ROLL(ctx.dmgFormula || '1к4')) : ctx.dmg;
            tok.hp = Math.max(0, (tok.hp || 0) - finalDmg);
            if (tok.isPlayer && cs[tok.charIdx]) { cs[tok.charIdx].hp = tok.hp; SC(cs); }
            SAVE_MAP_STATE(st); ctx.wasHit = true;
            const msg = `🍀 <b>Удачливый</b> (${left - 1}/3): переброс «${ESC(ctx.actionTitle)}» → <b>${total}</b> vs КБ ${ac}${isCrit ? ' 💥 <b>КРИТ!</b>' : ''} — <b>ПОПАДАНИЕ на ${finalDmg} урона!</b>`;
            window._bg3CombatLogBanner = `<div style="background:#192e1e; border-left:4px solid #6cb878; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#d8f3dc;">${msg}</div>`;
            LOG_COMBAT_TO_CHAT(msg.replace(/<[^>]+>/g, ''));
            APPEND_REACTIVE_ATTACK_BANNERS(c, true, ctx.isWeapon, ctx.dmgFormula);
        } else {
            const msg = `🍀 <b>Удачливый</b> (${left - 1}/3): переброс «${ESC(ctx.actionTitle)}» дал <b>${total}</b> против КБ ${ac} — всё ещё промах.`;
            window._bg3CombatLogBanner = `<div style="background:#2d2118; border-left:4px solid #f59e0b; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#fde68a;">${msg}</div>`;
            LOG_COMBAT_TO_CHAT(msg.replace(/<[^>]+>/g, ''));
            if (left - 1 > 0) APPEND_REACTIVE_ATTACK_BANNERS(c, false, ctx.isWeapon, ctx.dmgFormula);
        }
        RMC(); RENDER_MAP_AREA();
    };

    window.FEAT_USE_LUCKY_ON_ROLL = function() {
        const cs = GC(), c = cs[PI], ctx = window._featLastRollCtx;
        if (!c || !ctx || GET_RES_LEFT(c, 'lucky', 3) <= 0) return;
        const left = GET_RES_LEFT(c, 'lucky', 3);
        SPEND_RES(c, 'lucky', 1); SC(cs);

        const newD20 = Math.floor(Math.random() * 20) + 1;
        const best = Math.max(ctx.d20 || 1, newD20);
        const total = best + (ctx.bonus || 0);
        const modStr = (typeof MS === 'function') ? MS(ctx.bonus || 0) : ((ctx.bonus >= 0 ? '+' : '') + ctx.bonus);
        ctx.d20 = best; ctx.total = total;

        if (ctx.type === 'gm_skill') {
            const req = GET_SKILL_CHECK_REQ();
            const ok = (best === 20) || (best !== 1 && total >= ctx.dc);
            if (req && req.id === ctx.reqId) {
                if (!req.rolledBy) req.rolledBy = {};
                req.rolledBy[ctx.playerIdx] = { d20: best, bonus: ctx.bonus, total, success: ok };
                SAVE_SKILL_CHECK_REQ(req);
                if (typeof CHECK_AND_RENDER_SKILL_ROLL_POPUP === 'function') CHECK_AND_RENDER_SKILL_ROLL_POPUP();
            }
            LOG_COMBAT_TO_CHAT(`🍀 [Удачливый ${left - 1}/3] «${ctx.label}»: доп. к20=${newD20} → лучший ${best}${modStr} = ${total} (Сл ${ctx.dc}) — ${ok ? '✅ УСПЕХ!' : '❌ ПРОВАЛ'}`);
            showMessage(`🍀 Удачливый: ${ctx.label}`, `<div style="text-align:center; padding:8px 0;"><div style="font-size:2.3rem; font-weight:bold; color:${ok ? '#6cb878' : '#d66565'};">${total}</div><div style="color:var(--ui-muted,#aaa); margin:6px 0;">Новый к20: <b>${newD20}</b> → Лучший: <b>${best}</b> | Мод: <b>${modStr}</b> | Сл: <b>${ctx.dc}</b></div><div style="font-weight:bold; color:${ok ? '#6cb878' : '#d66565'};">${ok ? '✅ УСПЕХ!' : '❌ ПРОВАЛ'}</div><small style="color:var(--ui-muted,#888);">Осталось удачи: ${left - 1}/3</small></div>`);
            return;
        }

        const detail = `Удачливый: к20=${newD20} → лучший ${best} ${modStr} = ${total}`;
        window._ptLastRoll = { title: `🍀 ${ctx.label}`, total, detail, color: '#6cb878' };
        if (!ctx.secret && CUR_ROOM()) LOG_COMBAT_TO_CHAT(`🍀 [Удачливый ${left - 1}/3] «${ctx.label}»: ${detail}`);
        if (window._ptRollDrawerOpen && typeof SET_PT_ROLL_TAB === 'function') SET_PT_ROLL_TAB(window._ptRollTab || 'skills');
    };

    window.FEAT_USE_SECOND_CHANCE = function() {
        const cs = GC(), c = cs[PI], hit = window._featLastEnemyHit, st = GET_MAP_STATE();
        if (!c || !hit || GET_RES_LEFT(c, 'second_chance', 1) <= 0 || !HAS_REACTION(st)) return;
        SPEND_RES(c, 'second_chance', 1); USE_REACTION(st);

        const myAC = CAC(c), reroll = Math.floor(Math.random() * 20) + 1 + 4;
        const dodged = reroll < myAC;
        if (dodged) {
            c.hp = Math.min(c.maxHp || 10, (c.hp || 0) + hit.dmg);
            const myTok = (st.tokens || []).find(t => t.isPlayer && t.charIdx === PI);
            if (myTok) myTok.hp = c.hp;
        }
        window._featLastEnemyHit = null;
        SC(cs); SAVE_MAP_STATE(st);
        const msg = dodged
            ? `🎲 <b>Вторая удача!</b> «${ESC(hit.enemyName)}» перебросил атаку (${reroll} vs КБ ${myAC}) и <b>ПРОМАХНУЛСЯ</b> (+${hit.dmg} ХП).`
            : `🎲 <b>Вторая удача:</b> «${ESC(hit.enemyName)}» перебросил атаку (${reroll} vs КБ ${myAC}) — удар всё равно прошёл.`;
        window._bg3CombatLogBanner = `<div style="background:${dodged ? '#192e1e' : '#2d2118'}; border-left:4px solid ${dodged ? '#6cb878' : '#f59e0b'}; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem;">${msg}</div>`;
        LOG_COMBAT_TO_CHAT(msg.replace(/<[^>]+>/g, ''));
        RMC(); RENDER_MAP_AREA();
    };

    window.FEAT_USE_GNOME_FADE_AWAY = function() {
        const cs = GC(), c = cs[PI], st = GET_MAP_STATE();
        if (!c || !HAS_FEAT(c, 'Гномья хитрость') || GET_RES_LEFT(c, 'gnome_fade', 1) <= 0 || !HAS_REACTION(st)) return;
        const myIdx = (st.tokens || []).findIndex(t => t.isPlayer && t.charIdx === PI);
        if (myIdx === -1) return;
        SPEND_RES(c, 'gnome_fade', 1); USE_REACTION(st);
        SC(cs); ADD_TOKEN_COND(myIdx, 'invisible');
        const msg = '👻 <b>Гномья хитрость (Реакция):</b> вы исчезаете из виду (<b>Невидимость</b> до вашего хода или атаки)!';
        window._bg3CombatLogBanner = `<div style="background:#241936; border-left:4px solid #c084fc; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#f3e8ff;">${msg}</div>`;
        LOG_COMBAT_TO_CHAT(msg.replace(/<[^>]+>/g, ''));
        RMC(); RENDER_MAP_AREA();
    };

    window.FEAT_BOUNTIFUL_LUCK = function() {
        const st = GET_MAP_STATE();
        if (!HAS_REACTION(st)) { showMessage('⚡ Реакция потрачена', 'Вы уже использовали Реакцию в этом раунде.'); return; }
        USE_REACTION(st);
        const d20 = Math.floor(Math.random() * 20) + 1;
        LOG_COMBAT_TO_CHAT(`🍀 Полуросликовая удача (Реакция): переброс «1» для союзника → ${d20}!`);
        window._bg3CombatLogBanner = `<div style="background:#192e1e; border-left:4px solid #6cb878; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#d8f3dc;">🍀 <b>Полуросликовая удача:</b> союзник перебрасывает 1 → выпало <b>${d20}</b>!</div>`;
        RENDER_MAP_AREA();
    };

    window.FEAT_CAST_RITUAL = function(spellName) {
        const c = GC()[PI];
        if (!c) return;
        if (c.inCombat) { showMessage('⚔️ Только вне боя', 'Ритуал занимает +10 минут и проводится вне боя (зато не тратит ячейки).'); return; }
        const sp = gameData.spells.find(s => s.name === spellName);
        if (!sp) return;
        LOG_COMBAT_TO_CHAT(`📖 проводит ритуал «${sp.name}» (0 ячеек): ${sp.desc}`);
        if (typeof SET_COMBAT_BANNER === 'function') {
            SET_COMBAT_BANNER(`📖 Ритуал: ${sp.name} (0 ячеек)`, sp.desc, '#6cb878');
            if (document.getElementById('attacks-modal')?.classList.contains('active')) OAT();
        } else {
            showMessage(`📖 Ритуал: ${sp.name}`, sp.desc);
        }
    };

    // ================================================================
    // 6. АВТОМАТИЧЕСКИЕ ПАССИВНЫЕ И РЕАКТИВНЫЕ ХУКИ
    // ================================================================

    // Мастер щита: +КБ щита к спасброскам Ловкости везде
    const _ORIG_CHK_BON = window.GET_CHAR_CHECK_BONUS;
    if (typeof _ORIG_CHK_BON === 'function') {
        window.GET_CHAR_CHECK_BONUS = function(c, checkName) {
            let bon = _ORIG_CHK_BON(c, checkName);
            if (c && checkName === 'Спасбросок: Ловкость' && HAS_FEAT(c, 'Мастер щита')) bon += GET_SHIELD_BONUS(c);
            return bon;
        };
    }

    // Дварфийская стойкость: после Уклонения или Засады сразу предлагает лечение Костью Хитов
    const _ORIG_BASIC_ACT = window.TAC_USE_BASIC_ACTION;
    if (typeof _ORIG_BASIC_ACT === 'function') {
        window.TAC_USE_BASIC_ACTION = function(actId) {
            _ORIG_BASIC_ACT(actId);
            const c = GC()[PI];
            if ((actId === 'dodge' || actId === 'hide') && HAS_FEAT(c, 'Дварфийская стойкость')) {
                const avail = GET_AVAIL_HIT_DICE(c);
                if (avail > 0) {
                    window._bg3CombatLogBanner = (window._bg3CombatLogBanner || '') +
                        `<div style="background:#192e1e; border-left:4px solid #6cb878; padding:6px 10px; border-radius:6px; margin-bottom:8px; font-size:0.86rem; display:flex; justify-content:space-between; align-items:center; gap:8px;">
                            <span>🪓 <b>Дварфийская стойкость:</b> можете полечиться Костью Хитов!</span>
                            <button class="btn-small btn-save" onclick="FEAT_DWARVEN_FORTITUDE_HEAL()">💚 Потратить КХ (${avail})</button>
                        </div>`;
                    RENDER_MAP_AREA();
                }
            }
        };
    }

    // Защитные и реактивные черты при ударе врага: Орочья свирепость (1 ХП), Вторая удача, Гномья хитрость
    const _ORIG_ENEMY_AI = window.BG3_EXECUTE_ENEMY_AI_TURN;
    if (typeof _ORIG_ENEMY_AI === 'function') {
        window.BG3_EXECUTE_ENEMY_AI_TURN = function() {
            const sess = GET_SESSION(), isPl = sess && sess.role === 'player';
            const stBefore = GET_MAP_STATE(), toBefore = ENSURE_TURN_STATE(stBefore);
            const curEn = stBefore.tokens && stBefore.tokens[(toBefore.currentIdx || 0) % (stBefore.tokens.length || 1)];
            const beforeHp = isPl ? (GC()[PI]?.hp ?? 10) : 0;

            _ORIG_ENEMY_AI();
            if (!isPl) return;

            const cs = GC(), c = cs[PI];
            if (!c) return;
            const taken = beforeHp - (c.hp ?? 10);
            if (taken <= 0) return;

            const st = GET_MAP_STATE();
            const btns = [];
            const notes = [];

            if (c.hp <= 0 && beforeHp > 0 && HAS_FEAT(c, 'Орочья свирепость') && GET_RES_LEFT(c, 'orc_endure', 1) > 0) {
                c.hp = 1;
                SPEND_RES(c, 'orc_endure', 1);
                window._featOrcReactionReady = true;
                SC(cs);
                const myTok = (st.tokens || []).find(t => t.isPlayer && t.charIdx === PI);
                if (myTok) { myTok.hp = 1; SAVE_MAP_STATE(st); }
                notes.push('💢 <b>Орочья свирепость (Неумолимая стойкость):</b> вы устояли с <b>1 ХП</b>! Во вкладке «⚔️ Оружие» открыта контратака Реакцией.');
                LOG_COMBAT_TO_CHAT('💢 Неумолимая стойкость (Орочья свирепость): устоял с 1 ХП!');
            }

            if (HAS_FEAT(c, 'Вторая удача') && GET_RES_LEFT(c, 'second_chance', 1) > 0 && HAS_REACTION(st)) {
                window._featLastEnemyHit = { enemyName: curEn ? curEn.name : 'Противник', dmg: taken };
                btns.push(`<button class="btn-small btn-warn" onclick="FEAT_USE_SECOND_CHANCE()">🎲 Вторая удача: заставить врага перебросить удар</button>`);
            }
            if (HAS_FEAT(c, 'Гномья хитрость') && GET_RES_LEFT(c, 'gnome_fade', 1) > 0 && HAS_REACTION(st)) {
                btns.push(`<button class="btn-small btn-cast" onclick="FEAT_USE_GNOME_FADE_AWAY()">👻 Гномья хитрость: стать невидимым (Реакция)</button>`);
            }

            if (notes.length || btns.length) {
                window._bg3CombatLogBanner = (window._bg3CombatLogBanner || '') +
                    (notes.length ? `<div style="background:#261a1a; border-left:4px solid #c9a96e; padding:6px 10px; border-radius:6px; margin-bottom:6px; font-size:0.86rem;">${notes.join('<br>')}</div>` : '') +
                    (btns.length ? `<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">${btns.join('')}</div>` : '');
                RMC(); RENDER_MAP_AREA();
            }
        };
    }

    // Броски в панели «🎲 Броски» (Убийца магов, Человеческая решимость, Удачливый, Актёр)
    const _ORIG_QUICK = window.EXECUTE_QUICK_CHECK;
    if (typeof _ORIG_QUICK === 'function') {
        window.EXECUTE_QUICK_CHECK = function(kind, name) {
            const cs = GC(), c = cs[PI];
            const prevMode = window._ptRollMode || 'normal';
            if (c) {
                if (kind === 'save' && HAS_FEAT(c, 'Убийца магов') && window._featMageSlayerSave && window._ptRollMode !== 'dis') {
                    window._ptRollMode = 'adv';
                }
                if (window._featHumanDetArmed && HAS_FEAT(c, 'Человеческая решимость') && GET_RES_LEFT(c, 'human_det', 1) > 0) {
                    SPEND_RES(c, 'human_det', 1);
                    window._featHumanDetArmed = false;
                    SC(cs);
                    window._ptRollMode = 'adv';
                }
            }
            _ORIG_QUICK(kind, name);
            window._ptRollMode = prevMode;

            if (c && HAS_FEAT(c, 'Удачливый') && window._ptLastRoll) {
                let bon = 0;
                if (kind === 'skill') bon = GET_CHAR_CHECK_BONUS(c, name);
                else if (kind === 'save') bon = GET_CHAR_CHECK_BONUS(c, 'Спасбросок: ' + name);
                else if (kind === 'init') bon = GM(c.dex || 10) + (parseInt(c.initiativeBonus) || 0);
                else {
                    const m = { 'Сила': 'str', 'Ловкость': 'dex', 'Телосложение': 'con', 'Интеллект': 'intl', 'Мудрость': 'wis', 'Харизма': 'cha' };
                    bon = GM(c[m[name] || 'str'] || 10);
                }
                window._featLastRollCtx = {
                    type: 'quick', label: window._ptLastRoll.title, bonus: bon,
                    d20: Math.max(1, Math.min(20, (window._ptLastRoll.total || 10) - bon)),
                    total: window._ptLastRoll.total, secret: !!window._ptRollSecret
                };
            }
            ENHANCE_ROLL_DRAWER_NATIVE();
        };
    }

    function ENHANCE_ROLL_DRAWER_NATIVE() {
        const drawer = document.getElementById('pt-roll-drawer');
        if (!drawer || drawer.style.display === 'none') return;
        const c = GC()[PI];
        if (!c) return;

        drawer.querySelectorAll('[data-feat-drawer-ui]').forEach(n => n.remove());
        const scrollBody = drawer.querySelector('div[style*="overflow-y:auto"]');
        if (!scrollBody) return;

        const tab = window._ptRollTab || 'skills';

        // 1. Человеческая решимость — появляется ТОЛЬКО когда включён режим «⬇️ Помеха»
        if (tab !== 'dice' && window._ptRollMode === 'dis' && HAS_FEAT(c, 'Человеческая решимость') && GET_RES_LEFT(c, 'human_det', 1) > 0) {
            const b = document.createElement('button');
            b.className = 'btn-small ' + (window._featHumanDetArmed ? 'btn-save' : 'btn-warn');
            b.setAttribute('data-feat-drawer-ui', '1');
            b.style.cssText = 'margin:0 10px 7px 10px; padding:5px 8px; font-size:0.78rem;';
            b.textContent = window._featHumanDetArmed ? '🔥 Решимость: Помеха → Преимущество (ВКЛ)' : '🔥 Решимость: превратить помеху в преимущество (1/1)';
            b.onclick = () => { window._featHumanDetArmed = !window._featHumanDetArmed; ENHANCE_ROLL_DRAWER_NATIVE(); };
            scrollBody.before(b);
        }

        // 2. Удачливый — появляется ТОЛЬКО после броска
        if (window._featLastRollCtx && HAS_FEAT(c, 'Удачливый') && GET_RES_LEFT(c, 'lucky', 3) > 0) {
            const left = GET_RES_LEFT(c, 'lucky', 3);
            const b = document.createElement('button');
            b.className = 'btn-small btn-save';
            b.setAttribute('data-feat-drawer-ui', '1');
            b.style.cssText = 'margin:0 10px 7px 10px; padding:5px 8px; font-size:0.78rem;';
            b.textContent = `🍀 Перебросить последний бросок (Удачливый: ${left}/3)`;
            b.onclick = () => window.FEAT_USE_LUCKY_ON_ROLL();
            scrollBody.before(b);
        }

        // 3. Актёр — прямо на строках «Обман» и «Выступление» кнопка 🎭 2к20
        if (tab === 'skills' && HAS_FEAT(c, 'Актёр')) {
            scrollBody.querySelectorAll('.pt-skill-row').forEach(btn => {
                const oc = btn.getAttribute('onclick') || '';
                if (!oc.includes("'Обман'") && !oc.includes("'Выступление'")) return;
                const skName = oc.includes("'Обман'") ? 'Обман' : 'Выступление';
                const pill = btn.querySelector('.pt-mod-pill');
                if (pill && !btn.querySelector('[data-feat-actor-chip]')) {
                    const chip = document.createElement('span');
                    chip.setAttribute('data-feat-actor-chip', '1');
                    chip.title = 'Актёр: бросить с Преимуществом (выдавая себя за другого)';
                    chip.style.cssText = 'margin-left:auto; margin-right:6px; padding:2px 6px; border-radius:5px; font-size:0.74rem; background:var(--ui-panel, #221f1c); border:1px solid var(--ui-accent, #d2b278); color:var(--ui-accent, #d2b278);';
                    chip.textContent = '🎭 2к20';
                    chip.onclick = (e) => {
                        e.stopPropagation();
                        const prev = window._ptRollMode;
                        window._ptRollMode = 'adv';
                        window.EXECUTE_QUICK_CHECK('skill', skName);
                        window._ptRollMode = prev;
                    };
                    pill.before(chip);
                }
            });
        }

        // 4. Убийца магов — во вкладке «🛡️ Статы / Спасы» компактный чекбокс для спасов в 5 фт
        if (tab === 'stats' && HAS_FEAT(c, 'Убийца магов')) {
            const lbl = document.createElement('label');
            lbl.setAttribute('data-feat-drawer-ui', '1');
            lbl.style.cssText = 'display:flex; align-items:center; gap:7px; margin:0 10px 7px 10px; padding:5px 8px; border-radius:7px; background:var(--ui-panel2, #161412); border:1px solid var(--ui-border, #3e372f); font-size:0.78rem; cursor:pointer;';
            lbl.innerHTML = `<input type="checkbox" ${window._featMageSlayerSave ? 'checked' : ''} style="width:auto;" onchange="window._featMageSlayerSave=this.checked;"> <span>🧙 Убийца магов: спас от магии в 5 фт (2к20)</span>`;
            scrollBody.before(lbl);
        }
    }

    ['TOGGLE_PLAYER_ROLL_DRAWER', 'SET_PT_ROLL_TAB', 'SET_PT_ROLL_MODE'].forEach(fn => {
        const orig = window[fn];
        if (typeof orig === 'function') {
            window[fn] = function(...args) { const r = orig.apply(this, args); ENHANCE_ROLL_DRAWER_NATIVE(); return r; };
        }
    });

    // Удачливый в окне проверки по запросу от Мастера
    const _ORIG_SKILL_ROLL = window.PLAYER_EXECUTE_SKILL_ROLL;
    if (typeof _ORIG_SKILL_ROLL === 'function') {
        window.PLAYER_EXECUTE_SKILL_ROLL = function() {
            const sess = GET_SESSION(), reqBefore = GET_SKILL_CHECK_REQ(), c = GC()[PI];
            const bon = (c && reqBefore && typeof GET_CHAR_CHECK_BONUS === 'function') ? GET_CHAR_CHECK_BONUS(c, reqBefore.checkName) : 0;
            _ORIG_SKILL_ROLL();
            if (sess && reqBefore && c && HAS_FEAT(c, 'Удачливый')) {
                const reqAfter = GET_SKILL_CHECK_REQ();
                const res = reqAfter?.rolledBy?.[sess.playerIdx || 0];
                if (res && !res.success && GET_RES_LEFT(c, 'lucky', 3) > 0) {
                    window._featLastRollCtx = { type: 'gm_skill', reqId: reqAfter.id, playerIdx: sess.playerIdx || 0, label: reqAfter.checkName, dc: reqAfter.dc, bonus: bon, d20: res.d20, total: res.total };
                    const body = document.getElementById('message-body');
                    if (body && !body.querySelector('[data-feat-lucky-gm]')) {
                        const d = document.createElement('div');
                        d.setAttribute('data-feat-lucky-gm', '1');
                        d.style.cssText = 'margin-top:10px;';
                        d.innerHTML = `<button class="btn-save" style="width:100%;" onclick="FEAT_USE_LUCKY_ON_ROLL()">🍀 Перебросить (Удачливый: ${GET_RES_LEFT(c, 'lucky', 3)}/3)</button>`;
                        body.appendChild(d);
                    }
                }
            }
        };
    }

    // Сброс флагов при смене хода и восстановление ресурсов на Отдыхе
    const _ORIG_NEXT_TURN = window.GM_NEXT_TURN;
    if (typeof _ORIG_NEXT_TURN === 'function') {
        window.GM_NEXT_TURN = function() {
            window._featGwmBonusReady = false;
            return _ORIG_NEXT_TURN();
        };
    }

    const _ORIG_DSR = window.DSR;
    if (typeof _ORIG_DSR === 'function') {
        window.DSR = function() {
            _ORIG_DSR();
            const cs = GC(), c = cs[PI];
            if (!c || !c.featResUsed) return;
            ['insp_leader', 'orc_fury', 'human_det', 'dragon_fear', 'second_chance', 'gnome_fade'].forEach(k => { c.featResUsed[k] = 0; });
            SC(cs);
        };
    }

    const _ORIG_LR = window.EXECUTE_LONG_REST_FOR_PARTY;
    if (typeof _ORIG_LR === 'function') {
        window.EXECUTE_LONG_REST_FOR_PARTY = function() {
            _ORIG_LR();
            const rc = CUR_ROOM(), cs = GC();
            const idxs = (typeof GET_ROOM_PARTY_INDICES === 'function') ? GET_ROOM_PARTY_INDICES(rc) : cs.map((_, i) => i);
            idxs.forEach(i => {
                if (!cs[i]) return;
                const fn = ch => { ch.featResUsed = {}; ch.usedSpells = {}; if (ch.classResUsed) ch.classResUsed.sorc_pts = 0; };
                if (typeof MUTATE_HERO_IN_ROOM === 'function') MUTATE_HERO_IN_ROOM(cs[i], rc, fn);
                else fn(cs[i]);
            });
            SC(cs);
        };
    }

    // ================================================================
    // 7. НАТИВНАЯ ИНТЕГРАЦИЯ В СУЩЕСТВУЮЩИЕ ОКНА (0 НОВЫХ КНОПОК/ВКЛАДОК)
    // ================================================================

    // А) В существующие вкладки боевого HUD («⚔️ Оружие», «✨ Заклинания», «🏃 Действия»)
    const _ORIG_HUD = window.RENDER_BG3_COMBAT_HUD;
    if (typeof _ORIG_HUD === 'function') {
        window.RENDER_BG3_COMBAT_HUD = function() {
            _ORIG_HUD();
            const sess = GET_SESSION();
            if (!sess || sess.role !== 'player') return;
            const hud = document.getElementById('bg3-player-combat-hud');
            if (!hud) return;
            const c = GC()[PI];
            if (!c || !c.inCombat || (c.hp ?? 10) <= 0) return;

            const wepBtn = hud.querySelector("button[onclick*=\"'weapons'\"]");
            if (!wepBtn || !wepBtn.parentElement) return;
            const tabRow = wepBtn.parentElement;
            const hotbar = tabRow.nextElementSibling;
            if (!hotbar) return;

            const cat = window._bg3HotbarCategory || 'weapons';
            const st = GET_MAP_STATE(), to = ENSURE_TURN_STATE(st);
            const tokens = st.tokens || [];
            const activeTok = tokens.length ? tokens[(to.currentIdx || 0) % tokens.length] : null;
            const isMyTurn = !tokens.length || (activeTok && activeTok.isPlayer && activeTok.charIdx === PI);
            const hasReac = HAS_REACTION(st);

            // 1. Вкладка «⚔️ Оружие»: тумблеры ВМО/Меткий стрелок, Когти, Вторая рука, Древко, Бонусная атака ВМО
            if (cat === 'weapons') {
                const inv = c.inventory || [];
                const eqMelees = inv.filter(i => i && i.equipped && i.isWeapon && !i.ranged);
                const hasHeavy = eqMelees.some(i => HEAVY_MELEE_RE.test((i.properties || '').toLowerCase()));
                const hasRanged = inv.some(i => i && i.equipped && i.isWeapon && (i.ranged || /боеприпасы/i.test(i.properties || '')));
                const hasPolearm = eqMelees.some(i => POLEARM_RE.test(i.name || ''));

                // Когти (Драконья шкура) прямо на кнопке безоружного удара
                if (HAS_FEAT(c, 'Драконья шкура')) {
                    const uBtn = hotbar.querySelector('button[onclick="BG3_PLAYER_UNARMED()"]');
                    if (uBtn) uBtn.innerHTML = `<span style="font-weight:bold; color:#f3e8ff;">🐉 Когти (Драконья шкура)</span><small style="color:#d8b4fe;">1к4 рубящ. • 🟢 Атака</small>`;
                }

                // Компактные переключатели прямо над оружием (только если реально применимы!)
                const toggles = [];
                if (HAS_FEAT(c, 'Великий мастер оружия') && hasHeavy) {
                    toggles.push(`<button class="btn-small ${window._featPowerAtkGwm ? 'btn-save' : ''}" onclick="window._featPowerAtkGwm=!window._featPowerAtkGwm; RENDER_BG3_COMBAT_HUD();">⚔️ ВМО (−5/+10): ${window._featPowerAtkGwm ? 'ВКЛ' : 'ВЫКЛ'}</button>`);
                }
                if (HAS_FEAT(c, 'Меткий стрелок') && hasRanged) {
                    toggles.push(`<button class="btn-small ${window._featPowerAtkSharp ? 'btn-save' : ''}" onclick="window._featPowerAtkSharp=!window._featPowerAtkSharp; RENDER_BG3_COMBAT_HUD();">🏹 Меткий стрелок (−5/+10): ${window._featPowerAtkSharp ? 'ВКЛ' : 'ВЫКЛ'}</button>`);
                }
                if (HAS_FEAT(c, 'Человеческая решимость') && HAS_DISADV_COND_ON_ME(st) && GET_RES_LEFT(c, 'human_det', 1) > 0) {
                    toggles.push(`<button class="btn-small ${window._featHumanDetArmed ? 'btn-save' : 'btn-warn'}" onclick="window._featHumanDetArmed=!window._featHumanDetArmed; RENDER_BG3_COMBAT_HUD();">🔥 Решимость (помеха → 2к20): ${window._featHumanDetArmed ? 'ВКЛ' : '1/1'}</button>`);
                }
                if (toggles.length) {
                    const strip = document.createElement('div');
                    strip.style.cssText = 'display:flex; gap:6px; flex-wrap:wrap; margin-bottom:7px;';
                    strip.innerHTML = toggles.join('');
                    hotbar.before(strip);
                }

                // Дополнительные бонусные/реакционные удары прямо рядом с оружием
                const extraBtns = [];
                if (eqMelees.length >= 2) {
                    const ok = isMyTurn && to.bonusLeft > 0;
                    extraBtns.push(`<button class="btn-cast" ${!ok ? 'disabled style="opacity:0.45;"' : ''} onclick="FEAT_OFFHAND_ATTACK()" style="padding:7px 11px; display:flex; flex-direction:column; align-items:flex-start; gap:2px; min-width:130px; background:#231c2e; border:1px solid #9174b8;"><span style="font-weight:bold; color:#f3e8ff;">⚔️ ${ESC(eqMelees[1].name)}</span><small style="color:#d8b4fe;">🔶 Бонус (2-я рука)</small></button>`);
                }
                if (HAS_FEAT(c, 'Мастер большого оружия') && hasPolearm) {
                    const ok = isMyTurn && to.bonusLeft > 0;
                    extraBtns.push(`<button class="btn-cast" ${!ok ? 'disabled style="opacity:0.45;"' : ''} onclick="FEAT_POLEARM_BUTT_ATTACK()" style="padding:7px 11px; display:flex; flex-direction:column; align-items:flex-start; gap:2px; min-width:130px; background:#231c2e; border:1px solid #9174b8;"><span style="font-weight:bold; color:#f3e8ff;">🔱 Удар древком</span><small style="color:#d8b4fe;">1к4 • 🔶 Бонус</small></button>`);
                }
                if (HAS_FEAT(c, 'Великий мастер оружия') && window._featGwmBonusReady) {
                    const ok = isMyTurn && to.bonusLeft > 0;
                    extraBtns.push(`<button class="btn-save" ${!ok ? 'disabled style="opacity:0.45;"' : ''} onclick="FEAT_GWM_BONUS_ATTACK()" style="padding:7px 11px; display:flex; flex-direction:column; align-items:flex-start; gap:2px; min-width:135px;"><span style="font-weight:bold;">💥 Бонус-атака ВМО</span><small>🔶 Бонус (крит/убийство)</small></button>`);
                }
                if (HAS_FEAT(c, 'Орочья свирепость') && window._featOrcReactionReady) {
                    extraBtns.push(`<button class="btn-warn" ${!hasReac ? 'disabled style="opacity:0.45;"' : ''} onclick="FEAT_ORC_REACTION_ATTACK()" style="padding:7px 11px; display:flex; flex-direction:column; align-items:flex-start; gap:2px; min-width:135px;"><span style="font-weight:bold;">💢 Контратака (1 ХП)</span><small>⚡ Реакция</small></button>`);
                }
                if (extraBtns.length) hotbar.insertAdjacentHTML('beforeend', extraBtns.join(''));
            }

            // 2. Вкладка «✨ Заклинания»: Метамагия (Двойник-заклинатель / Чародей) прямо над заклинаниями
            if (cat === 'spells') {
                const sorc = GET_SORC_POINTS(c);
                const metas = c.metamagicChoices || [];
                if (sorc.max > 0 && metas.length) {
                    const chips = metas.map(mid => {
                        const md = METAMAGIC_OPTIONS.find(x => x.id === mid);
                        if (!md) return '';
                        const act = window._featActiveMetamagic === mid;
                        const can = act || sorc.left >= md.cost;
                        return `<button class="btn-small ${act ? 'btn-save' : ''}" ${!can ? 'disabled' : ''} title="${ESC(md.desc)}" onclick="window._featActiveMetamagic=(window._featActiveMetamagic==='${mid}'?'':'${mid}'); RENDER_BG3_COMBAT_HUD();">🔮 ${md.name} (${md.cost})</button>`;
                    }).join('');
                    const strip = document.createElement('div');
                    strip.style.cssText = 'display:flex; gap:5px; flex-wrap:wrap; align-items:center; margin-bottom:7px; font-size:0.8rem;';
                    strip.innerHTML = `<span style="color:var(--ui-muted,#aaa);">Очки чародейства: <b style="color:var(--ui-accent,#d2b278);">${sorc.left}/${sorc.max}</b></span>${chips}`;
                    hotbar.before(strip);
                }
            }

            // 3. Вкладка «🏃 Действия»: Толчок щитом, Захват (Драчун), Драконий страх, Полуросликовая удача
            if (cat === 'actions') {
                const extras = [];
                if (HAS_FEAT(c, 'Мастер щита') && GET_SHIELD_BONUS(c) > 0) {
                    const ok = isMyTurn && to.bonusLeft > 0;
                    extras.push(`<button class="btn-cast" ${!ok ? 'disabled style="opacity:0.45;"' : ''} onclick="FEAT_ATHLETICS_MANEUVER('shove')" style="padding:7px 11px; display:flex; flex-direction:column; align-items:flex-start; gap:2px; min-width:130px; background:#1c2430; border:1px solid #38bdf8;"><span style="font-weight:bold; color:#e0f2fe;">🛡️ Толчок щитом</span><small style="color:#93c5fd;">🔶 Бонус (сбить с ног)</small></button>`);
                }
                if (HAS_FEAT(c, 'Драчун')) {
                    const ok = isMyTurn && to.bonusLeft > 0;
                    extras.push(`<button class="btn-cast" ${!ok ? 'disabled style="opacity:0.45;"' : ''} onclick="FEAT_ATHLETICS_MANEUVER('grapple')" style="padding:7px 11px; display:flex; flex-direction:column; align-items:flex-start; gap:2px; min-width:130px; background:#1c2430; border:1px solid #38bdf8;"><span style="font-weight:bold; color:#e0f2fe;">🤼 Захват (Драчун)</span><small style="color:#93c5fd;">🔶 Бонус (Атлетика)</small></button>`);
                }
                if (HAS_FEAT(c, 'Драконий страх')) {
                    const left = GET_RES_LEFT(c, 'dragon_fear', 1);
                    const ok = isMyTurn && to.actionsLeft > 0 && left > 0;
                    extras.push(`<button class="btn-cast" ${!ok ? 'disabled style="opacity:0.45;"' : ''} onclick="FEAT_DRAGON_FEAR()" style="padding:7px 11px; display:flex; flex-direction:column; align-items:flex-start; gap:2px; min-width:135px; background:#241936; border:1px solid #a855f7;"><span style="font-weight:bold; color:#f3e8ff;">🐉 Драконий страх (${left}/1)</span><small style="color:#c4b5fd;">🟢 Действие (30 фт)</small></button>`);
                }
                if (HAS_FEAT(c, 'Полуросликовая удача')) {
                    extras.push(`<button class="btn-cast" ${!hasReac ? 'disabled style="opacity:0.45;"' : ''} onclick="FEAT_BOUNTIFUL_LUCK()" style="padding:7px 11px; display:flex; flex-direction:column; align-items:flex-start; gap:2px; min-width:135px; background:#192e1e; border:1px solid #6cb878;"><span style="font-weight:bold; color:#d8f3dc;">🍀 Переброс «1» союзнику</span><small style="color:#86efac;">⚡ Реакция (30 фт)</small></button>`);
                }
                if (extras.length) hotbar.insertAdjacentHTML('beforeend', extras.join(''));
            }
        };
    }

// Б) Ритуалы прямо внутри «📖 Справочник атак и заклинаний» (OAT)
    const _ORIG_OAT = window.OAT;
    if (typeof _ORIG_OAT === 'function') {
        window.OAT = function() {
            _ORIG_OAT();
            const c = GC()[PI];
            if (!c || !HAS_FEAT(c, 'Ритуальный заклинатель') || !(c.ritualSpells || []).length) return;
            const tab = window._oatTab || 'all';
            if (tab !== 'all' && tab !== 'spells') return;
            const cont = document.getElementById('attacks-content');
            if (!cont || cont.querySelector('[data-feat-rituals-block]')) return;

            const rows = c.ritualSpells.map(rn => {
                const sp = gameData.spells.find(x => x.name === rn);
                return `
                    <div class="spell-item" style="display:flex; justify-content:space-between; align-items:center; gap:8px; padding:7px 10px;">
                        <div style="text-align:left;"><b>📖 ${ESC(rn)}</b> <small style="color:var(--ui-muted,#888);">(Ритуал • 0 ячеек)</small><br><small style="color:var(--ui-muted,#aaa);">${ESC(sp ? sp.desc : '')}</small></div>
                        <button class="btn-small btn-save" onclick="FEAT_CAST_RITUAL('${ESC_JS(rn)}')">Провести</button>
                    </div>`;
            }).join('');

            const wrap = document.createElement('div');
            wrap.setAttribute('data-feat-rituals-block', '1');
            wrap.style.cssText = 'margin:10px 0;';
            wrap.innerHTML = `<div style="color:var(--ui-accent,#c9a96e); font-size:0.86em; font-weight:bold; margin-bottom:5px; text-align:left;">📖 Ритуальная книга (вне боя, 0 ячеек):</div>${rows}`;
            const closeBtn = cont.querySelector('button[onclick*="attacks-modal"]');
            if (closeBtn) closeBtn.before(wrap);
            else cont.appendChild(wrap);
        };
    }

    // В) Воодушевляющий лидер прямо в окне «☕ Короткий отдых» (SSR)
    const _ORIG_SSR = window.SSR;
    if (typeof _ORIG_SSR === 'function') {
        window.SSR = function() {
            _ORIG_SSR();
            const c = GC()[PI];
            if (!c || !HAS_FEAT(c, 'Воодушевляющий лидер')) return;
            const cont = document.getElementById('rest-content');
            if (!cont || cont.querySelector('[data-feat-leader-box]')) return;

            const left = GET_RES_LEFT(c, 'insp_leader', 1);
            const gain = (c.level || 1) + Math.max(0, GM(c.cha || 10));
            const box = document.createElement('div');
            box.setAttribute('data-feat-leader-box', '1');
            box.style.cssText = 'background:var(--ui-panel2,#181715); border:1px solid var(--ui-accent,#c9a96e); border-radius:8px; padding:9px 12px; margin-bottom:12px; display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; text-align:left; font-size:0.86em;';
            box.innerHTML = `
                <div><b>📣 Воодушевляющий лидер</b><br><small style="color:var(--ui-muted,#aaa);">Даёт до 6 союзникам <b>+${gain} временных ХП</b> (не тратит привал)</small></div>
                <button class="btn-small btn-save" ${left <= 0 ? 'disabled' : ''} onclick="FEAT_INSPIRING_LEADER()">${left > 0 ? '📣 Воодушевить' : '✅ Использовано'}</button>
            `;
            const btnRow = cont.querySelector('button[onclick="DSR()"]')?.parentElement;
            if (btnRow) btnRow.before(box);
            else cont.appendChild(box);
        };
    }

    // Г) Расшифровка черт и их зарядов прямо внутри Листа персонажа (OCS)
    const _ORIG_OCS = window.OCS;
    if (typeof _ORIG_OCS === 'function') {
        window.OCS = function() {
            _ORIG_OCS();
            const c = GC()[PI];
            const cont = document.getElementById('char-sheet-content');
            if (!c || !cont) return;

            if (HAS_FEAT(c, 'Наблюдатель')) {
                const td = Array.from(cont.querySelectorAll('td')).find(el => el.textContent.trim() === 'Пассивная Внимательность');
                if (td && td.nextElementSibling && !td.nextElementSibling.dataset.obsAdded) {
                    const invBon = (typeof GET_CHAR_CHECK_BONUS === 'function') ? GET_CHAR_CHECK_BONUS(c, 'Расследование') : GM(c.intl || 10);
                    td.nextElementSibling.dataset.obsAdded = '1';
                    td.nextElementSibling.innerHTML += ` &nbsp;|&nbsp; Расследование: <b>${10 + invBon + 5}</b>`;
                }
            }

            const feats = c.chosenFeats || [];
            if (!feats.length) return;
            const h3 = Array.from(cont.querySelectorAll('h3')).find(el => el.textContent.includes('Выбранные черты'));
            const box = h3 ? h3.nextElementSibling : null;
            if (!box) return;

            box.innerHTML = feats.map(fn => {
                const fd = (gameData.feats || []).find(x => x.name === fn);
                let extra = '';
                if (fn === 'Удачливый') extra = ` • заряды: <b>${GET_RES_LEFT(c, 'lucky', 3)}/3</b>`;
                else if (fn === 'Стихийный адепт' && (c.elementalAdeptTypes || []).length) extra = ` • стихия: <b>${ESC(c.elementalAdeptTypes.join(', '))}</b>`;
                else if (fn === 'Двойник-заклинатель') extra = ` • очки чародейства: <b>${GET_SORC_POINTS(c).left}/${GET_SORC_POINTS(c).max}</b>`;
                else if (fn === 'Ритуальный заклинатель' && (c.ritualSpells || []).length) extra = ` • ритуалы: <b>${ESC(c.ritualSpells.join(', '))}</b>`;
                else if (fn === 'Зачинатель магии' && c._magicInitiateLvl1) extra = ` • 1/день: <b>${ESC(c._magicInitiateLvl1)}</b>`;
                else if (fn === 'Воодушевляющий лидер') extra = ` • ${GET_RES_LEFT(c, 'insp_leader', 1) > 0 ? 'готово' : 'использовано'}`;
                else if (fn === 'Вторая удача') extra = ` • ${GET_RES_LEFT(c, 'second_chance', 1) > 0 ? 'готово' : 'использовано'}`;
                else if (fn === 'Гномья хитрость') extra = ` • ${GET_RES_LEFT(c, 'gnome_fade', 1) > 0 ? 'готово' : 'использовано'}`;
                else if (fn === 'Драконий страх') extra = ` • ${GET_RES_LEFT(c, 'dragon_fear', 1) > 0 ? 'готово' : 'использовано'}`;
                else if (fn === 'Орочья свирепость') extra = ` • куб урона: ${GET_RES_LEFT(c, 'orc_fury', 1) > 0 ? 'готово' : 'использовано'}`;
                else if (fn === 'Человеческая решимость') extra = ` • ${GET_RES_LEFT(c, 'human_det', 1) > 0 ? 'готово' : 'использовано'}`;

                return `
                    <div style="padding:7px 9px; margin-bottom:6px; border-radius:7px; background:var(--ui-panel, #221f1c); border:1px solid var(--ui-border, #3e372f); text-align:left;">
                        <div><b style="color:var(--ui-accent, #d2b278);">🌟 ${ESC(fn)}</b><small style="color:var(--ui-muted, #aaa);">${extra}</small></div>
                        <div style="font-size:0.84rem; color:var(--ui-muted, #aaa); margin-top:2px;">${ESC(fd ? fd.desc : '')}</div>
                    </div>`;
            }).join('');
        };
    }

    const oldBtn = document.getElementById('feats-utility-left-btn');
    if (oldBtn) oldBtn.remove();
})();