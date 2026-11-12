// ================================================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ================================================================
let PI = 0;
function GC() {
    const d = localStorage.getItem('dnd_characters');
    const arr = d ? JSON.parse(d) : [];
    if (PI < 0 || (arr.length > 0 && PI >= arr.length)) PI = 0;
    return arr;
}
function SC(c) { localStorage.setItem('dnd_characters', JSON.stringify(c)); }
function GM(s) { return Math.floor((s - 10) / 2); }
function MS(m) { return m >= 0 ? '+' + m : '' + m; }
function GPB(l) { const v = l || 1; if (v >= 17) return 6; if (v >= 13) return 5; if (v >= 9) return 4; if (v >= 5) return 3; return 2; }
function LKG(l) { return Math.round(l * 0.4536 * 10) / 10; }
function XPL(l) { if (l<=1) return 0; if (l===2) return 300; if (l===3) return 900; if (l===4) return 2700; if (l===5) return 6500; if (l===6) return 14000; if (l===7) return 23000; if (l===8) return 34000; if (l===9) return 48000; if (l===10) return 64000; if (l===11) return 85000; if (l===12) return 100000; if (l===13) return 120000; if (l===14) return 140000; if (l===15) return 165000; if (l===16) return 195000; if (l===17) return 225000; if (l===18) return 265000; if (l===19) return 305000; return 355000; }
function CC(c) {
    const baseCap = (c.str || 10) * 15;
    const hasBagOfHolding = c.inventory && c.inventory.some(i => (i.name || '').toLowerCase().includes('мешок хранения'));
    return baseCap + (hasBagOfHolding ? 500 : 0);
}
function IW(c) {
    let w = 0;
    if (c.inventory) {
        c.inventory.forEach(i => {
            w += (parseFloat(i.weight) || 0) * (parseInt(i.qty) || 1);
        });
    }
    return Math.round(w * 100) / 100;
}

function EAB(c) { let b = 0; if (c.inventory) c.inventory.forEach(i => { if (i.equipped && i.ac) b += parseInt(i.ac) || 0; }); return b; }
function ESB(c) { let b = 0; if (c.inventory) c.inventory.forEach(i => { if (i.equipped && i.isShield) b += 2; }); return b; }

function HAS_ARMOR_PROF(c, armorProp) {
    const cls = c.className || '';
    const feats = c.chosenFeats || [];
    const isMountainDwarf = (c.race === 'Дварф' && c.subrace === 'Горный');
    const propNorm = (armorProp || '').toLowerCase().replace(/ё/g, 'е');

    if (propNorm.includes('тяжелый')) {
        if (['Воин', 'Паладин'].includes(cls)) return true;
        if (cls === 'Жрец' && ['Война', 'Буря', 'Жизнь', 'Природа', 'Порядок'].includes(c.subclass)) return true;
        if (feats.includes('Знаток тяжёлых доспехов')) return true;
        return false;
    }
    if (propNorm.includes('средний')) {
        if (['Варвар', 'Воин', 'Жрец', 'Друид', 'Паладин', 'Следопыт'].includes(cls)) return true;
        if (isMountainDwarf) return true;
        if (feats.includes('Знаток средних доспехов') || feats.includes('Знаток тяжёлых доспехов')) return true;
        return false;
    }
    if (propNorm.includes('легкий')) {
        if (['Бард', 'Варвар', 'Воин', 'Жрец', 'Друид', 'Колдун', 'Паладин', 'Плут', 'Следопыт'].includes(cls)) return true;
        if (isMountainDwarf) return true;
        if (feats.includes('Знаток лёгких доспехов') || feats.includes('Знаток средних доспехов') || feats.includes('Знаток тяжёлых доспехов')) return true;
        return false;
    }
    if (propNorm.includes('щит')) {
        if (['Варвар', 'Воин', 'Жрец', 'Друид', 'Паладин', 'Следопыт'].includes(cls)) return true;
        if (feats.includes('Мастер щита') || feats.includes('Знаток средних доспехов')) return true;
        return false;
    }
    return true;
}

function CAC(c) { 
    const dm = GM(c.dex||10), cm = GM(c.con||10), wm = GM(c.wis||10); 
    let ac = 10 + dm; 
    let armorEquipped = false;
    let ringBonus = 0;
    c.hasArmorPenalty = false;
    
    if (c.inventory) {
        c.inventory.forEach(i => {
            const iName = (i.name || '').toLowerCase().replace(/ё/g, 'е');
            if (i.equipped && iName.includes('кольцо защиты')) {
                ringBonus += 1;
            }
            if (i.equipped && i.ac && !i.isShield) {
                armorEquipped = true;
                const props = (i.properties || '').toLowerCase().replace(/ё/g, 'е');
                if (!HAS_ARMOR_PROF(c, props)) c.hasArmorPenalty = true;

                if (props.includes('тяжелый')) {
                    ac = parseInt(i.ac);
                } else if (props.includes('средний')) {
                    ac = parseInt(i.ac) + Math.min(Math.max(dm, -5), 2);
                } else {
                    ac = parseInt(i.ac) + dm;
                }
            }
            if (i.equipped && i.isShield) {
                if (!HAS_ARMOR_PROF(c, 'щит')) c.hasArmorPenalty = true;
                ac += parseInt(i.ac) || 2; 
            }
        });
    }
    
    if (!armorEquipped) {
        let unarmored = 10 + dm;
        if (c.className === 'Варвар') unarmored = Math.max(unarmored, 10 + dm + cm);
        if (c.className === 'Монах') {
            const hasShield = c.inventory && c.inventory.some(i => i.equipped && i.isShield);
            if (!hasShield) unarmored = Math.max(unarmored, 10 + dm + wm);
        }
        if (c.chosenFeats && c.chosenFeats.includes('Драконья шкура')) {
            unarmored = Math.max(unarmored, 13 + dm);
        }
        if (c.race === 'Локсодон') {
            unarmored = Math.max(unarmored, 12 + cm);
        }
        const shieldBonus = (c.inventory || []).reduce((acc, i) => (i.equipped && i.isShield) ? acc + (parseInt(i.ac) || 2) : acc, 0);
        ac = unarmored + shieldBonus;
    }
    return ac + ringBonus; 
}

function GET_SPELL_SLOTS(c) {
    const slots = {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0};
    const cn = c.className || '';
    const lv = c.level || 1;

    const tables = {
        full: [
            [2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],
            [4,3,2,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],
            [4,3,3,3,1,0,0,0,0],[4,3,3,3,2,0,0,0,0],[4,3,3,3,2,1,0,0,0],[4,3,3,3,2,1,0,0,0],
            [4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,0,0],[4,3,3,3,2,1,1,1,0],[4,3,3,3,2,1,1,1,0],
            [4,3,3,3,2,1,1,1,1],[4,3,3,3,3,1,1,1,1],[4,3,3,3,3,2,1,1,1],[4,3,3,3,3,2,2,1,1]
        ],
        half: [
            [0,0,0,0,0,0,0,0,0],[2,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],[3,0,0,0,0,0,0,0,0],
            [4,2,0,0,0,0,0,0,0],[4,2,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],[4,3,0,0,0,0,0,0,0],
            [4,3,2,0,0,0,0,0,0],[4,3,2,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],[4,3,3,0,0,0,0,0,0],
            [4,3,3,1,0,0,0,0,0],[4,3,3,1,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],[4,3,3,2,0,0,0,0,0],
            [4,3,3,3,1,0,0,0,0],[4,3,3,3,1,0,0,0,0],[4,3,3,3,2,0,0,0,0],[4,3,3,3,2,0,0,0,0]
        ]
    };

    if (['Бард','Жрец','Друид','Чародей','Волшебник'].includes(cn)) {
        const row = tables.full[Math.min(20, Math.max(1, lv)) - 1];
        for (let i = 0; i < 9; i++) slots[i+1] = row[i] || 0;
    } else if (['Паладин','Следопыт'].includes(cn)) {
        const row = tables.half[Math.min(20, Math.max(1, lv)) - 1];
        for (let i = 0; i < 9; i++) slots[i+1] = row[i] || 0;
    } else if (cn === 'Колдун') {
        const pactSlotsCount = lv >= 17 ? 4 : lv >= 11 ? 3 : lv >= 2 ? 2 : 1;
        let maxPactLevel = 1;
        if (lv >= 9) maxPactLevel = 5;
        else if (lv >= 7) maxPactLevel = 4;
        else if (lv >= 5) maxPactLevel = 3;
        else if (lv >= 3) maxPactLevel = 2;
        
        slots[maxPactLevel] = pactSlotsCount;

        if (lv >= 11) slots[6] = 1;
        if (lv >= 13) slots[7] = 1;
        if (lv >= 15) slots[8] = 1;
        if (lv >= 17) slots[9] = 1;
    }

    return slots;
}

function GET_MIN_LEVEL_FOR_SPELL_SLOT(className, slotLevel) {
    if (['Бард','Жрец','Друид','Чародей','Волшебник'].includes(className)) {
        const levels = [1, 3, 5, 7, 9, 11, 13, 15, 17];
        return levels[slotLevel - 1] || 0;
    } else if (['Паладин','Следопыт'].includes(className)) {
        const levels = [2, 5, 9, 13, 17];
        return slotLevel <= 5 ? levels[slotLevel - 1] : 0;
    } else if (className === 'Колдун') {
        const levels = [1, 3, 5, 7, 9, 11, 13, 15, 17];
        return levels[slotLevel - 1] || 0;
    }
    return 0;
}

function GET_AVAILABLE_SPELL_LEVELS(c) {
    const slots = GET_SPELL_SLOTS(c);
    const levels = [];
    for (let i = 1; i <= 9; i++) {
        if (slots[i] > 0) levels.push(i);
    }
    if (c.className === 'Колдун' && gameData.knownSpellsTable && gameData.knownSpellsTable[c.className]) {
        const target = gameData.knownSpellsTable[c.className][c.level || 1];
        if (target) {
            for (let i = 6; i <= 9; i++) {
                if (target[i] && !levels.includes(i)) levels.push(i);
            }
        }
    }
    return levels;
}

function RSP(c) {
    let s = [];
    if (c.race && gameData.races[c.race]) {
        const r = gameData.races[c.race];
        if (c.subrace && r.sub && r.sub[c.subrace] && r.sub[c.subrace].spells) {
            s = s.concat(r.sub[c.subrace].spells || []);
        } else {
            s = s.concat(r.spells || []);
        }
    }
    return s;
}

// Надёжный расчёт ХП по правилам D&D 5e (с сохранением бросков по уровням и учётом Телосложения, Стойкого и Холмового Дварфа)
function RHP(c) {
    if (!c.className || !gameData.classes[c.className]) return;
    const d = gameData.classes[c.className];
    const hd = parseInt(d.hd.replace('1к','')) || 8;
    const lv = Math.max(1, c.level || 1);
    const cm = GM(c.con || 10);

    if (!c._hpRolls || c._hpClass !== c.className) {
        c._hpRolls = { 1: hd };
        c._hpClass = c.className;
    }
    c._hpRolls[1] = hd; // На 1 уровне всегда максимум кости хитов

    for (let i = 2; i <= lv; i++) {
        if (!c._hpRolls[i]) {
            c._hpRolls[i] = Math.floor(Math.random() * hd) + 1;
        }
    }

    const isHillDwarf = (c.race === 'Дварф' && c.subrace === 'Холмовой') ? 1 : 0;
    const toughPerLv = (c.chosenFeats && c.chosenFeats.includes('Стойкий')) ? 2 : 0;

    let totalMax = 0;
    for (let i = 1; i <= lv; i++) {
        const levelHp = Math.max(1, (c._hpRolls[i] || hd) + cm) + isHillDwarf + toughPerLv;
        totalMax += levelHp;
    }

    const oldMax = c.maxHp || totalMax;
    c.maxHp = totalMax;
    if (c.hp === undefined || c.hp === null || !c._hpInitialized) {
        c.hp = totalMax;
        c._hpInitialized = true;
    } else if (totalMax > oldMax) {
        c.hp += (totalMax - oldMax);
    } else if (c.hp > totalMax) {
        c.hp = totalMax;
    }
}

function AB(c) { ARB(c, c.race, c.subrace); ACB(c, c.className); }

function ARB(c, rn, sn) {
    c.strBonus=0; c.dexBonus=0; c.conBonus=0; c.intBonus=0; c.wisBonus=0; c.chaBonus=0;
    let baseSp = 30;
    if (rn && gameData.races[rn]) {
        const rd = gameData.races[rn];
        const b = rd.ab;
        if (b.any && !(rn === 'Человек' && sn === 'Вариант')) {
            c.strBonus+=b.any[0]||0; c.dexBonus+=b.any[1]||0; c.conBonus+=b.any[2]||0;
            c.intBonus+=b.any[3]||0; c.wisBonus+=b.any[4]||0; c.chaBonus+=b.any[5]||0;
        }
        if (b.strength) c.strBonus+=b.strength;
        if (b.dexterity) c.dexBonus+=b.dexterity;
        if (b.constitution) c.conBonus+=b.constitution;
        if (b.intelligence) c.intBonus+=b.intelligence;
        if (b.wisdom) c.wisBonus+=b.wisdom;
        if (b.charisma) c.chaBonus+=b.charisma;
        if (sn && rd.sub && rd.sub[sn]) {
            const sb = rd.sub[sn].ab;
            if (sb) {
                if (sb.strength) c.strBonus+=sb.strength;
                if (sb.dexterity) c.dexBonus+=sb.dexterity;
                if (sb.constitution) c.conBonus+=sb.constitution;
                if (sb.intelligence) c.intBonus+=sb.intelligence;
                if (sb.wisdom) c.wisBonus+=sb.wisdom;
                if (sb.charisma) c.chaBonus+=sb.charisma;
            }
        }
        baseSp = (rn === 'Эльф' && sn === 'Лесной') ? 35 : (parseInt(rd.sp) || 30);
    }
    c.str = (c.baseStr||10) + c.strBonus;
    c.dex = (c.baseDex||10) + c.dexBonus;
    c.con = (c.baseCon||10) + c.conBonus;
    c.intl = (c.baseInt||10) + c.intBonus;
    c.wis = (c.baseWis||10) + c.wisBonus;
    c.cha = (c.baseCha||10) + c.chaBonus;

    // Учёт надетых магических предметов (Амулет здоровья, Пояс силы гиганта)
    if (c.inventory) {
        c.inventory.forEach(i => {
            if (!i.equipped) return;
            const n = (i.name || '').toLowerCase();
            if (n.includes('амулет здоровья')) c.con = Math.max(c.con, 19);
            if (n.includes('пояс силы холмового гиганта')) c.str = Math.max(c.str, 21);
            if (n.includes('пояс силы огненного гиганта')) c.str = Math.max(c.str, 25);
        });
    }

    c.speed = baseSp + (c.featSpeedBonus || 0);
}

function ACB(c, cn) {
    if (!cn || !gameData.classes[cn]) return;
    c.hitDice = gameData.classes[cn].hd;
    RHP(c);
}

// Автоматические навыки от Расы И Предыстории
function GAS(c) {
    let s = [];
    if (c.race && gameData.races[c.race]) {
        const r = gameData.races[c.race];
        s = s.concat(r.as || []);
        if (c.subrace && r.sub && r.sub[c.subrace]) s = s.concat(r.sub[c.subrace].as || []);
    }
    if (c.background && gameData.backgrounds[c.background]) {
        const bg = gameData.backgrounds[c.background];
        if (!bg.sk && bg.sl) {
            bg.sl.forEach(sk => { if (!s.includes(sk)) s.push(sk); });
        }
    }
    return s;
}

function GSC(c) {
    let n = 0;
    if (c.race && gameData.races[c.race]) {
        const r = gameData.races[c.race];
        n += r.sk || 0;
        if (c.subrace && r.sub && r.sub[c.subrace]) n += r.sub[c.subrace].sk || 0;
    }
    if (c.className && gameData.classes[c.className]) n += gameData.classes[c.className].sk || 0;
    if (c.background && gameData.backgrounds[c.background]) n += gameData.backgrounds[c.background].sk || 0;
    if (c.bonusSkillSlots) n += c.bonusSkillSlots;
    return n;
}

function GASC(c) {
    let set = {};
    if (c.className && gameData.classes[c.className]) {
        const cs = gameData.classes[c.className].sl;
        if (cs[0]==='Все' || cs.length === 18) gameData.allSkills.forEach(s => set[s] = true);
        else cs.forEach(s => set[s] = true);
    }
    if (c.background && gameData.backgrounds[c.background] && gameData.backgrounds[c.background].sk) {
        const bs = gameData.backgrounds[c.background].sl;
        if (bs[0]==='Все' || bs.length === 18) gameData.allSkills.forEach(s => set[s] = true);
        else bs.forEach(s => set[s] = true);
    }
    if ((c.race === 'Человек' && c.subrace === 'Вариант') || c.race === 'Полуэльф') {
        gameData.allSkills.forEach(s => set[s] = true);
    }
    if (!Object.keys(set).length) gameData.allSkills.forEach(s => set[s] = true);
    GAS(c).forEach(s => delete set[s]);
    if (c.chosenSkills) c.chosenSkills.forEach(s => delete set[s]);
    if (c.race==='Кенку' && (!c.className)) {
        const ks=['Акробатика','Обман','Скрытность','Ловкость рук'];
        const f={}; ks.forEach(s=>{if(set[s])f[s]=true;}); set=f;
    }
    return Object.keys(set);
}

function GCST(c) {
    if (!c.className||!gameData.classes[c.className]) return {strength:false,dexterity:false,constitution:false,intelligence:false,wisdom:false,charisma:false};
    const st=gameData.classes[c.className].st;
    return {strength:st.includes('strength'),dexterity:st.includes('dexterity'),constitution:st.includes('constitution'),intelligence:st.includes('intelligence'),wisdom:st.includes('wisdom'),charisma:st.includes('charisma')};
}

function triggerAvatarUpload() {
    const inp = document.createElement('input'); inp.type='file'; inp.accept='image/*';
    inp.onchange=function(e){
        const f=e.target.files[0]; if(!f)return;
        const r=new FileReader();
        r.onload=function(ev){const cs=GC();if(!cs.length)return;cs[PI].avatar=ev.target.result;SC(cs);RMC();};
        r.readAsDataURL(f);
    };
    inp.click();
}

// Парсинг бросков кубиков: "2к4+2", "1к8" и т.п.
function ROLL(formula) {
    if (!formula) return 0;
    const str = formula.toLowerCase().replace(/\s/g, '');
    if (str.includes('-')) {
        const subParts = str.split('-');
        let subTotal = 0;
        subParts.forEach((p, i) => {
            if (i === 0) {
                subTotal = p.includes('к') ? (() => {
                    const [c, s] = p.split('к');
                    let st = 0;
                    for (let j = 0; j < (parseInt(c)||1); j++) st += Math.floor(Math.random() * (parseInt(s)||6)) + 1;
                    return st;
                })() : (parseInt(p) || 0);
            } else {
                if (p.includes('к')) {
                    const [c, s] = p.split('к');
                    for (let j = 0; j < (parseInt(c)||1); j++) subTotal -= (Math.floor(Math.random() * (parseInt(s)||6)) + 1);
                } else {
                    subTotal -= parseInt(p) || 0;
                }
            }
        });
        return subTotal;
    }
    const parts = str.split('+');
    let total = 0;
    parts.forEach(part => {
        part = part.trim();
        if (part.includes('к')) {
            const [count, rest] = part.split('к');
            const numDice = parseInt(count) || 1;
            const sides = parseInt(rest) || 6;
            for (let i = 0; i < numDice; i++) {
                total += Math.floor(Math.random() * sides) + 1;
            }
        } else {
            total += parseInt(part) || 0;
        }
    });
    return total;
}

let healCallback = null;
function showHealPrompt(itemName, callback) {
    document.getElementById('heal-prompt-text').textContent = 'Сколько ХП восстановит «' + itemName + '»?';
    document.getElementById('heal-amount').value = 10;
    healCallback = callback;
    OM('heal-prompt-modal');
}

// ================================================================
// ИНТЕРФЕЙС: КАРТОЧКА ПЕРСОНАЖА, ОТРЯД, МОДАЛКИ
// ================================================================
function GENERATE_BEAUTIFUL_SLOTS_HTML(c) {
    const maxSlots = GET_SPELL_SLOTS(c);
    if (!c.usedSpellSlots) c.usedSpellSlots = {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0};
    const usedSlots = c.usedSpellSlots;

    let totalMax = 0;
    let totalUsed = 0;
    let hasAnySlots = false;

    for (let i = 1; i <= 9; i++) {
        if (maxSlots[i] > 0) {
            totalMax += maxSlots[i];
            totalUsed += (usedSlots[i] || 0);
            hasAnySlots = true;
        }
    }

    if (!hasAnySlots) {
        return `<div class="slots-digital-counter">—</div>`;
    }

    let dotsHtml = '';
    let tooltipText = '';

    if (c.className === 'Колдун') {
        let pactLevel = 0, pactMax = 0, pactUsed = 0, arcanumMax = 0, arcanumUsed = 0;
        for (let i = 1; i <= 5; i++) {
            if (maxSlots[i] > 0) {
                pactLevel = i;
                pactMax = maxSlots[i];
                pactUsed = usedSlots[i] || 0;
            }
        }
        for (let i = 6; i <= 9; i++) {
            if (maxSlots[i] > 0) {
                arcanumMax += maxSlots[i];
                arcanumUsed += (usedSlots[i] || 0);
            }
        }
        for (let i = 0; i < pactMax; i++) {
            const isSpent = i < pactUsed;
            dotsHtml += `<div class="rpg-slot-pill pact ${isSpent ? 'spent' : ''}"></div>`;
        }
        for (let i = 0; i < arcanumMax; i++) {
            const isSpent = i < arcanumUsed;
            dotsHtml += `<div class="rpg-slot-pill arcanum ${isSpent ? 'spent' : ''}"></div>`;
        }
        tooltipText = `Магия договора (${pactLevel} круг): ${pactMax - pactUsed} из ${pactMax}`;
        if (arcanumMax > 0) {
            tooltipText += `\nТаинственные арканумы: ${arcanumMax - arcanumUsed} из ${arcanumMax}`;
        }
    } else {
        let tooltipLines = [];
        for (let i = 1; i <= 9; i++) {
            if (maxSlots[i] > 0) {
                const mx = maxSlots[i];
                const us = usedSlots[i] || 0;
                tooltipLines.push(`${i}-й круг: ${mx - us} из ${mx}`);
                for (let j = 0; j < mx; j++) {
                    const isSpent = j < us;
                    dotsHtml += `<div class="rpg-slot-pill regular ${isSpent ? 'spent' : ''}"></div>`;
                }
            }
        }
        tooltipText = tooltipLines.join('\n');
    }

    const currentAvailable = totalMax - totalUsed;
    return `
        <div class="main-slots-wrapper custom-tooltip" data-tooltip="${tooltipText}">
            <div class="slots-digital-counter text-underline-dashed">
                ${currentAvailable} / ${totalMax}
            </div>
            <div class="slots-indicator-row">
                ${dotsHtml}
            </div>
        </div>
    `;
}

function RMC() {
    const cs = GC(); 
    if (!cs.length) { 
        document.getElementById('main-char-name').textContent='—';
        document.getElementById('main-char-subtitle').textContent='';
        document.getElementById('main-char-hp').textContent='—';
        document.getElementById('main-char-ac').textContent='—';
        document.getElementById('main-char-mana').textContent='—';
        document.getElementById('main-char-hp-bar').style.width='100%';
        document.getElementById('main-char-avatar').classList.remove('show');
        document.getElementById('avatar-wrapper').classList.remove('has-image');
        document.getElementById('avatar-text').textContent='Нажми, чтобы загрузить аватар';
        RPL();
        return; 
    }
    
    const c = cs[PI]; 
    document.getElementById('main-char-name').textContent = c.name || 'Безымянный';
    document.getElementById('main-char-subtitle').textContent = (c.race||'')+(c.subrace?' ('+c.subrace+')':'')+' | '+(c.className||'')+(c.subclass?' ('+c.subclass+')':'')+' | Уровень '+(c.level||1);
    
    const thp = c.tempHP || 0; 
    let ht = (c.hp ?? 10) + ' / ' + (c.maxHp || 10); 
    if (thp > 0) ht += ' <span class="hp-temp">(+'+thp+')</span>'; 
    document.getElementById('main-char-hp').innerHTML = ht;
    document.getElementById('main-char-ac').textContent = CAC(c);
    document.getElementById('main-char-mana').innerHTML = GENERATE_BEAUTIFUL_SLOTS_HTML(c);

    document.getElementById('main-char-hp-bar').style.width = (c.maxHp > 0 ? Math.min(100, Math.max(0, (c.hp / c.maxHp * 100))) : 100) + '%';
    const ai=document.getElementById('main-char-avatar'),aw=document.getElementById('avatar-wrapper'),at=document.getElementById('avatar-text');
    if(c.avatar){ai.src=c.avatar;ai.classList.add('show');aw.classList.add('has-image');at.textContent='';}else{ai.classList.remove('show');aw.classList.remove('has-image');at.textContent='Нажми, чтобы загрузить аватар';}
    
    RPL();
}

function RPL() {
    const cs = GC();
    const con = document.getElementById('party-list');
    if (!con) return;
    con.innerHTML = '';
    const o = cs.filter((c, i) => i !== PI);

    if (!o.length) {
        con.innerHTML = '<p style="color:#888;text-align:center;">Нет других персонажей в отряде</p>';
    } else {
        cs.forEach((c, idx) => {
            if (idx === PI) return;
            const maxS = GET_SPELL_SLOTS(c);
            const usedS = c.usedSpellSlots || {};
            let totM = 0, totU = 0;
            for (let k = 1; k <= 9; k++) { if (maxS[k] > 0) { totM += maxS[k]; totU += (usedS[k] || 0); } }
            const slotsTxt = totM > 0 ? `${totM - totU}/${totM}` : '—';

            const d = document.createElement('div');
            d.className = 'party-member';
            const ah = c.avatar ? '<img class="party-avatar" src="' + c.avatar + '" alt="">' : '<div class="party-avatar-placeholder">?</div>';
            const combatBadge = c.inCombat ? ' <span style="color:#e06060;font-size:0.8em;">⚔️ В бою</span>' : '';
            d.innerHTML = ah +
                '<div class="party-info">' +
                    '<div class="party-name">' + (c.name || 'Безымянный') + combatBadge + '</div>' +
                    '<div class="party-detail">' + (c.race || 'Раса') + ' | ' + (c.className || 'Класс') + ' (Ур. ' + (c.level || 1) + ')</div>' +
                '</div>' +
                '<div class="party-stats">' +
                    '<div><div class="party-stat-val">' + (c.hp ?? 10) + '/' + (c.maxHp || 10) + '</div><div class="party-stat-lbl">ХП</div></div>' +
                    '<div><div class="party-stat-val">' + CAC(c) + '</div><div class="party-stat-lbl">КБ</div></div>' +
                    '<div><div class="party-stat-val">' + slotsTxt + '</div><div class="party-stat-lbl">Ячейки</div></div>' +
                '</div>';
            con.appendChild(d);
        });
    }

    // Панель для теста пачки (позволяет добавить тестового сопартийца и переключать активного игрока, чтобы проверить всплывающее окно голосования)
    const switcher = document.createElement('div');
    switcher.style.cssText = 'margin-top:10px; padding-top:8px; border-top:1px dashed #333; font-size:0.78em; color:#888; text-align:center;';
    let optionsHtml = '';
    cs.forEach((m, idx) => {
        optionsHtml += `<option value="${idx}" ${idx === PI ? 'selected' : ''}>👤 Экран игрока ${idx + 1}: ${m.name || 'Персонаж ' + (idx + 1)}</option>`;
    });
    switcher.innerHTML = `
        <div style="margin-bottom:4px;">🔧 <b>Тест мультиплеера (взгляд от лица другого игрока):</b></div>
        <div style="display:flex; gap:4px; justify-content:center; flex-wrap:wrap;">
            <select onchange="SWITCH_ACTIVE_PLAYER(parseInt(this.value))" style="background:#1a1a1a; color:#c9a96e; border:1px solid #444; padding:3px 6px; border-radius:4px; width:auto;">
                ${optionsHtml}
            </select>
            <button class="btn-small" style="padding:3px 7px;" onclick="ADD_TEST_PARTY_MEMBER()">+ Союзник</button>
            ${cs.length > 1 ? '<button class="btn-small btn-danger" style="padding:3px 7px;" onclick="REMOVE_LAST_PARTY_MEMBER()">− Убрать</button>' : ''}
        </div>
    `;
    con.appendChild(switcher);
}

function OM(id) { document.getElementById(id).classList.add('active'); }
function CM(id) { document.getElementById(id).classList.remove('active'); }
function showMessage(title, text) {
    document.getElementById('message-title').textContent = title;
    document.getElementById('message-body').innerHTML = text.replace(/\n/g, '<br>');
    OM('message-modal');
}

function CHECK_CONCENTRATION(c, damage) {
    if (!c.concentrating) return;
    const dc = Math.max(10, Math.floor(damage / 2));
    const roll = Math.floor(Math.random() * 20) + 1 + GM(c.con || 10);
    if (roll < dc) {
        c.concentrating = false;
        showMessage('Концентрация потеряна', 'Вы не смогли удержать заклинание.');
    }
}

function CONFIRM_HEAL() {
    const amount = parseInt(document.getElementById('heal-amount').value) || 0;
    if (healCallback) {
        healCallback(amount);
        healCallback = null;
    }
    closeModal('heal-prompt-modal');
}

function GRT(c) {
    if(!c.race||!gameData.races[c.race]) return 'Выберите расу';
    let t=[]; const r=gameData.races[c.race];
    t=t.concat(r.tr||[]);
    if(c.subrace&&r.sub&&r.sub[c.subrace]) t=t.concat(r.sub[c.subrace].tr||[]);
    return t.length ? t.join('<br>') : 'Нет';
}

// ================================================================
// ЯЗЫКИ И ЛИСТ ПЕРСОНАЖА
// ================================================================
function GAL(c) {
    let l = [];
    const addUnique = (arr) => { (arr || []).forEach(x => { if (x && !l.includes(x)) l.push(x); }); };
    if (c.race && gameData.races[c.race]) {
        const r = gameData.races[c.race];
        if (r.la) addUnique(r.la.a);
        if (c.subrace && r.sub && r.sub[c.subrace] && r.sub[c.subrace].la) addUnique(r.sub[c.subrace].la.a);
    }
    if (c.className && gameData.classes[c.className] && gameData.classes[c.className].la) addUnique(gameData.classes[c.className].la.a);
    if (c.background && gameData.backgrounds[c.background] && gameData.backgrounds[c.background].la) addUnique(gameData.backgrounds[c.background].la.a);
    if (c.chosenLanguages) {
        for (const key in c.chosenLanguages) {
            if (!c.chosenLanguages.hasOwnProperty(key)) continue;
            const val = c.chosenLanguages[key];
            if (typeof val === 'string') addUnique([val]);
            else if (val === true && isNaN(parseInt(key))) addUnique([key]);
        }
    }
    return l;
}

function GET_LANG_SLOTS(c) {
    let slots = [];
    if (c.race && gameData.races[c.race]) {
        const r = gameData.races[c.race];
        if (r.la && r.la.c) {
            r.la.c.forEach((ch, idx) => {
                for (let i = 0; i < (ch.n || 1); i++) slots.push({ key: 'race_' + idx + '_' + i, f: ch.f, label: (ch.d || 'Язык') + ' (от расы)' });
            });
        }
        if (c.subrace && r.sub && r.sub[c.subrace] && r.sub[c.subrace].la && r.sub[c.subrace].la.c) {
            r.sub[c.subrace].la.c.forEach((ch, idx) => {
                for (let i = 0; i < (ch.n || 1); i++) slots.push({ key: 'subrace_' + idx + '_' + i, f: ch.f, label: (ch.d || 'Язык') + ' (от подрасы)' });
            });
        }
    }
    if (c.background && gameData.backgrounds[c.background] && gameData.backgrounds[c.background].la && gameData.backgrounds[c.background].la.c) {
        gameData.backgrounds[c.background].la.c.forEach((ch, idx) => {
            for (let i = 0; i < (ch.n || 1); i++) slots.push({ key: 'bg_' + idx + '_' + i, f: ch.f, label: (ch.d || 'Язык') + ' (от предыстории)' });
        });
    }
    return slots;
}

function RLCH(c) {
    let h = '';
    if (c.languagesLocked) return h;
    const slots = GET_LANG_SLOTS(c);
    if (!slots.length) return h;
    if (!c.chosenLanguages) c.chosenLanguages = {};

    const knownLanguages = GAL(c);
    let unselectedCount = 0;
    let selectedSlotCount = 0;

    slots.forEach(slot => {
        const currentVal = c.chosenLanguages[slot.key];
        if (currentVal && typeof currentVal === 'string') {
            selectedSlotCount++;
            h += '<div class="lang-choice" style="margin:4px 0;"><span style="color:#c9a96e;">' + slot.label + ':</span> <b>' + currentVal + '</b> <button class="btn-small" onclick="RMLANG(\'' + slot.key + '\')">✕</button></div>';
        } else {
            unselectedCount++;
            const available = gameData.languages.getList(slot.f).filter(l => !knownLanguages.includes(l));
            if (available.length > 0) {
                h += '<div class="lang-choice"><label>' + slot.label + ':</label><br><select onchange="SAL(\'' + slot.key + '\', this.value)"><option value="">— Выберите язык —</option>';
                available.forEach(l => { h += '<option value="' + l + '">' + l + '</option>'; });
                h += '</select></div>';
            }
        }
    });

    if (selectedSlotCount > 0 && unselectedCount === 0) {
        h += '<br><button class="btn-small btn-save" onclick="LKL()">Сохранить языки</button>';
    }
    return h;
}

function SAL(slotKey, val) {
    if (!val) return;
    const cs = GC();
    const c = cs[PI];
    if (!c.chosenLanguages) c.chosenLanguages = {};
    c.chosenLanguages[slotKey] = val;
    SC(cs);
    ROS();
}

function RMLANG(slotKey) {
    const cs = GC();
    const c = cs[PI];
    if (c.chosenLanguages && c.chosenLanguages[slotKey]) {
        delete c.chosenLanguages[slotKey];
        SC(cs);
        ROS();
    }
}

function LKL() { const cs=GC(); cs[PI].languagesLocked=true; SC(cs); ROS(); }
function RTS(f,c,o){if(c[f+'Locked'])return'<p style="font-size:0.85em;">'+(c[f]||'—')+'</p>';let h='<div class="trait-select"><select onchange="STV(\''+f+'\',this.value)"><option value="">— Выберите или напишите —</option>';o.forEach(x=>{h+='<option value="'+x.replace(/"/g,'&quot;')+'"'+(c[f]===x?' selected':'')+'>'+x+'</option>';});h+='</select><br><input type="text" value="'+(c[f]||'')+'" onchange="STV(\''+f+'\',this.value)" placeholder="Своё..." style="margin-top:3px;"><br><button class="btn-small btn-save" onclick="LKT(\''+f+'\')">Сохранить</button></div>';return h;}
function STV(f,v){const cs=GC();cs[PI][f]=v;SC(cs);}
function LKT(f){const cs=GC();cs[PI][f+'Locked']=true;SC(cs);ROS();}
function RSF(c){if(c.storyLocked)return'<p style="font-size:0.85em;">'+(c.story||'—')+' <button class="btn-small" onclick="ULS()">Ред.</button></p>';return'<textarea id="story-textarea" onchange="UCF(\'story\',this.value)">'+(c.story||'')+'</textarea><br><button class="btn-small btn-save" onclick="LKS()">Сохранить</button>';}
function LKS(){const cs=GC();cs[PI].storyLocked=true;SC(cs);ROS();}
function ULS(){const cs=GC();cs[PI].storyLocked=false;SC(cs);ROS();}

// Авто-распределение стандартного набора (15, 14, 13, 12, 10, 8) под выбранный класс («кнопка для ленивых»)
function AUTO_STATS() {
    const cs = GC();
    const c = cs[PI];
    const presets = {
        'Варвар':    [15, 13, 14, 8, 12, 10],
        'Воин':      [15, 13, 14, 8, 12, 10],
        'Паладин':   [15, 10, 13, 8, 12, 14],
        'Монах':     [12, 15, 13, 8, 14, 10],
        'Плут':      [8, 15, 14, 13, 12, 10],
        'Следопыт':  [12, 15, 13, 8, 14, 10],
        'Волшебник': [8, 14, 13, 15, 12, 10],
        'Жрец':      [13, 10, 14, 8, 15, 12],
        'Друид':     [8, 14, 13, 12, 15, 10],
        'Бард':      [8, 14, 13, 10, 12, 15],
        'Колдун':    [8, 14, 13, 10, 12, 15],
        'Чародей':   [8, 13, 14, 10, 12, 15]
    };
    const arr = presets[c.className] || [15, 14, 13, 12, 10, 8];
    c.baseStr = arr[0]; c.baseDex = arr[1]; c.baseCon = arr[2];
    c.baseInt = arr[3]; c.baseWis = arr[4]; c.baseCha = arr[5];
    AB(c); SC(cs); RMC(); ROS();
}

// Честный бросок 4к6 (отбрасывая наименьший) — можно нажать только до фиксации характеристик
function ROLL_STATS_4D6() {
    const cs = GC();
    const c = cs[PI];
    function rollOne() {
        const r = [1,2,3,4].map(() => Math.floor(Math.random()*6)+1).sort((a,b)=>a-b);
        return r[1] + r[2] + r[3];
    }
    c.baseStr = rollOne(); c.baseDex = rollOne(); c.baseCon = rollOne();
    c.baseInt = rollOne(); c.baseWis = rollOne(); c.baseCha = rollOne();
    AB(c); SC(cs); RMC(); ROS();
}

function LKSTATS() {
    const cs = GC();
    cs[PI].statsLocked = true;
    SC(cs);
    ROS();
}

// Изменение базовых характеристик (Сила, Ловкость и т.д.) прямо из Листа Персонажа
function UBASE(baseKey, val) {
    const cs = GC();
    const c = cs[PI];
    if (c.statsLocked) return;
    c[baseKey] = Math.max(3, Math.min(18, parseInt(val) || 10));
    AB(c);
    SC(cs);
    RMC();
    ROS();
}

// Изменение текущих ХП и временных ХП из Листа Персонажа
function UHP(field, val) {
    const cs = GC();
    const c = cs[PI];
    if (field === 'hp') {
        c.hp = Math.max(0, Math.min(c.maxHp || 10, parseInt(val) || 0));
    } else if (field === 'tempHP') {
        c.tempHP = Math.max(0, parseInt(val) || 0);
    }
    SC(cs);
    RMC();
    ROS();
}

function LKR() {
    const cs = GC();
    const c = cs[PI];
    c.raceLocked = true;
    AB(c);
    if (!c.pendingChoices) c.pendingChoices = [];
    if (!c._completedChoices) c._completedChoices = [];

    // Вариант человека: +1 к двум разным хар-кам и 1 Черта
    if (c.race === 'Человек' && c.subrace === 'Вариант') {
        if (!c._completedChoices.includes('Черта (вариант человека)') && !c.pendingChoices.some(p => p.label === 'Черта (вариант человека)')) {
            c.pendingChoices.push({type:'feat', label:'Черта (вариант человека)', count:1, options:[]});
        }
        const statNames = ['Сила','Ловкость','Телосложение','Интеллект','Мудрость','Харизма'];
        const codeByRus = {'Сила':'baseStr','Ловкость':'baseDex','Телосложение':'baseCon','Интеллект':'baseInt','Мудрость':'baseWis','Харизма':'baseCha'};
        SC(cs);
        SHOW_OPTION_CHOICE('Вариант человека: Выберите 2 характеристики (+1)', statNames, 2, function(selected) {
            const fCs = GC(); const fC = fCs[PI];
            selected.forEach(s => { const k = codeByRus[s]; if (k) fC[k] = (fC[k] || 10) + 1; });
            AB(fC); SC(fCs); RMC(); ROS();
        });
        return;
    }

    // Полуэльф (+1 к двум хар-кам кроме Харизмы) или Чейнджлинг (+1 к одной)
    if (c.race === 'Полуэльф' || c.race === 'Чейнджлинг') {
        const count = c.race === 'Полуэльф' ? 2 : 1;
        const statNames = ['Сила','Ловкость','Телосложение','Интеллект','Мудрость'];
        const codeByRus = {'Сила':'baseStr','Ловкость':'baseDex','Телосложение':'baseCon','Интеллект':'baseInt','Мудрость':'baseWis'};
        SC(cs);
        SHOW_OPTION_CHOICE(c.race + ': Выберите ' + count + ' хар-ки (+1)', statNames, count, function(selected) {
            const fCs = GC(); const fC = fCs[PI];
            selected.forEach(s => { const k = codeByRus[s]; if (k) fC[k] = (fC[k] || 10) + 1; });
            AB(fC); SC(fCs); RMC(); ROS();
        });
        return;
    }

    SC(cs);
    RMC();
    ROS();
}

function LKC() {
    const cs = GC();
    const c = cs[PI];
    c.classLocked = true;
    c._spellsOffered = false;
    AB(c);
    CHECK_CLASS_FEATURES(c);
    SC(cs);
    RMC();
    ROS();
}

function LKSB() {
    const cs = GC();
    const c = cs[PI];
    c.subclassLocked = true;
    SC(cs);
    ADD_SUBCLASS_SPELLS(c);
    RMC();
    ROS();
}

function ADD_SUBCLASS_SPELLS(c) {
    if (!c.className || !c.subclass || !gameData.classSubSpells) return;
    const classSub = gameData.classSubSpells[c.className];
    if (!classSub || !classSub[c.subclass]) return;
    const spellsByLevel = classSub[c.subclass];
    if (!c.knownSpells) c.knownSpells = [];
    const aliasMap = { 'Сон': 'Усыпление' };
    let added = false;
    for (let [lvl, spells] of Object.entries(spellsByLevel)) {
        if (c.level >= parseInt(lvl)) {
            spells.forEach(rawName => {
                const spName = aliasMap[rawName] || rawName;
                const existsInDb = gameData.spells.some(s => s.name === spName);
                if (existsInDb && !c.knownSpells.includes(spName)) {
                    c.knownSpells.push(spName);
                    added = true;
                }
            });
        }
    }
    if (added) {
        const cs = GC();
        cs[PI] = c;
        SC(cs);
    }
}

function LKBG(){
    const cs=GC(); const c=cs[PI];
    c.bgLocked=true;
    c.traits=''; c.ideals=''; c.bonds=''; c.flaws='';
    c.traitsLocked=false; c.idealsLocked=false; c.bondsLocked=false; c.flawsLocked=false;
    const autoSk = GAS(c);
    if (c.chosenSkills) {
        c.chosenSkills = c.chosenSkills.filter(s => !autoSk.includes(s));
        if (c.chosenSkills.length < GSC(c)) c.skillsLocked = false;
    }
    AB(c); SC(cs); ROS();
}

function LRB(){
    const cs=GC(); const c=cs[PI];
    c.bgLocked=false; c.skillsLocked=false; c.chosenSkills=[];
    if (c.chosenLanguages) {
        for (const k in c.chosenLanguages) { if (k.startsWith('bg_')) delete c.chosenLanguages[k]; }
    }
    c.languagesLocked=false; AB(c); SC(cs); ROS();
}

function ACHS(s) {
    if (!s) return;
    const cs = GC();
    const c = cs[PI];
    if (!c.chosenSkills) c.chosenSkills = [];
    if (c.chosenSkills.includes(s) || GAS(c).includes(s)) return;
    c._prevSkills = c.chosenSkills.slice();

    const pendingIdx = c.pendingChoices ? c.pendingChoices.findIndex(p => p.type === 'skill') : -1;
    if (pendingIdx !== -1 && c.skillsLocked) {
        c.bonusSkillSlots = (c.bonusSkillSlots || 0) + 1;
        c.chosenSkills.push(s);
        const completed = c.pendingChoices.splice(pendingIdx, 1)[0];
        if (!c._completedChoices) c._completedChoices = [];
        c._completedChoices.push(completed.label);
        SC(cs);
        ROS();
        return;
    }

    if (GSC(c) - c.chosenSkills.length <= 0) return;
    c.chosenSkills.push(s);
    SC(cs);
    ROS();
}

function RCHS(s){
    const cs=GC(); const c=cs[PI];
    if(!c.chosenSkills) return;
    c._prevSkills = c.chosenSkills.slice();
    const i = c.chosenSkills.indexOf(s);
    if(i>=0) c.chosenSkills.splice(i,1);
    SC(cs); ROS();
}

function LKSK() {
    const cs = GC();
    const c = cs[PI];
    c.skillsLocked = true;
    c._prevSkills = (c.chosenSkills || []).slice();
    if (c.pendingChoices) {
        const idx = c.pendingChoices.findIndex(p => p.type === 'skill');
        if (idx !== -1) {
            const completed = c.pendingChoices.splice(idx, 1)[0];
            if (!c._completedChoices) c._completedChoices = [];
            c._completedChoices.push(completed.label);
        }
    }
    SC(cs);
    ROS();
}

function ULSK() {
    const cs = GC();
    const c = cs[PI];
    c.skillsLocked = false;
    SC(cs);
    ROS();
}

function SHOW_SPELL_CHOICE(availableSpells, count, title, onConfirm) {
    document.getElementById('spell-choice-title').textContent = title;
    document.getElementById('spell-choice-info').textContent = 'Доступно: ' + availableSpells.length + '. Выберите до ' + count + '.';
    
    let listHtml = '<div style="display:flex; flex-direction:column; gap:3px;">';
    availableSpells.forEach(sp => {
        listHtml += '<label style="display:flex; align-items:center; padding:3px; background:#333; border-radius:4px; cursor:pointer;">' +
                    '<input type="checkbox" class="spell-check" value="' + sp.name + '" style="margin-right:8px;">' +
                    '<span>' + sp.name + ' (' + (sp.level===0?'заговор':sp.level+' круг') + ')</span>' +
                    '</label>';
    });
    listHtml += '</div>';
    document.getElementById('spell-choice-list').innerHTML = listHtml;
    
    const confirmBtn = document.getElementById('spell-choice-confirm');
    confirmBtn.onclick = function() {
        const checked = document.querySelectorAll('.spell-check:checked');
        const selected = Array.from(checked).map(cb => cb.value);
        if (selected.length === 0) {
            showMessage('Ошибка', 'Выберите хотя бы одно заклинание.');
            return;
        }
        if (selected.length > count) {
            showMessage('Ошибка', 'Можно выбрать не более ' + count + ' заклинаний.');
            return;
        }
        onConfirm(selected);
    };
    
    OM('spell-choice-modal');
}

function SHOW_OPTION_CHOICE(title, options, count, onConfirm) {
    document.getElementById('option-choice-title').textContent = title;
    document.getElementById('option-choice-info').textContent = 'Выберите ' + count + ' вариант(ов).';
    const listDiv = document.getElementById('option-choice-list');
    let html = '';
    if (count === 1) {
        html = '<select id="opt-single-select" style="width:100%; background:#1a1a1a; color:#e0e0e0; border:1px solid #555; padding:6px; border-radius:4px;">';
        html += '<option value="">— Выберите —</option>';
        options.forEach(opt => {
            html += '<option value="' + opt + '">' + opt + '</option>';
        });
        html += '</select>';
    } else {
        html = '<div style="display:flex; flex-direction:column; gap:4px;">';
        options.forEach(opt => {
            html += '<label style="display:flex; align-items:center; padding:4px; background:#333; border-radius:4px; cursor:pointer;">' +
                    '<input type="checkbox" class="opt-check" value="' + opt + '" style="margin-right:8px;">' +
                    '<span>' + opt + '</span></label>';
        });
        html += '</div>';
    }
    listDiv.innerHTML = html;

    document.getElementById('option-choice-confirm').onclick = function() {
        let selected = [];
        if (count === 1) {
            const sel = document.getElementById('opt-single-select');
            if (!sel.value) {
                showMessage('Ошибка', 'Выберите вариант.');
                return;
            }
            selected = [sel.value];
        } else {
            const checked = document.querySelectorAll('.opt-check:checked');
            if (checked.length !== count) {
                showMessage('Ошибка', 'Выберите ровно ' + count + ' вариант(ов).');
                return;
            }
            selected = Array.from(checked).map(cb => cb.value);
        }
        closeModal('option-choice-modal');
        setTimeout(() => onConfirm(selected), 20);
    };
    OM('option-choice-modal');
}

function SHOW_FEAT_CHOICE_FROM_ASI() {
    if (document.getElementById('temp-asi-modal')) document.getElementById('temp-asi-modal').remove();
    const cs = GC();
    const c = cs[PI];
    const choice = window._asiChoice;
    SHOW_FEAT_CHOICE_FOR_CHOICE(cs, c, choice);
}

function ULV(lv) {
    const cs = GC();
    const c = cs[PI];
    c.level = Math.max(1, Math.min(20, lv || 1));
    c._spellsOffered = false;
    AB(c);
    ADD_SUBCLASS_SPELLS(c);
    CHECK_CLASS_FEATURES(c);
    SC(cs);
    ROS();
    RMC();
}

function ROS(){CM('char-sheet-modal');setTimeout(()=>OCS(),100);}
function CCS(){CM('char-sheet-modal');RMC();}
function UCF(f,v){const cs=GC();if(!cs.length)return;if(f==='race')cs[PI].subrace='';cs[PI][f]=v;SC(cs);}

function GET_KNOWN_SPELLS_DEFICIT(c) {
    if (!c.className || !gameData.knownSpellsTable || !gameData.knownSpellsTable[c.className]) return 0;
    const lv = c.level || 1;
    const target = gameData.knownSpellsTable[c.className][lv];
    if (!target) return 0;
    const current = c.knownSpells || [];
    
    let deficit = 0;

    if (c.className === 'Колдун') {
        const knownCantrips = current.filter(name => gameData.spells.some(sp => sp.name === name && sp.level === 0)).length;
        deficit += Math.max(0, (target[0] || 0) - knownCantrips);

        let expectedPactSpells = 0;
        for (let i = 1; i <= 5; i++) {
            expectedPactSpells += target[i] || 0;
        }
        const knownPactSpells = current.filter(name => 
            gameData.spells.some(sp => sp.name === name && sp.classes.includes('Колдун') && sp.level >= 1 && sp.level <= 5)
        ).length;
        deficit += Math.max(0, expectedPactSpells - knownPactSpells);

        for (let i = 6; i <= 9; i++) {
            if (target[i] && target[i] > 0) {
                const knownCount = current.filter(name => 
                    gameData.spells.some(sp => sp.name === name && sp.classes.includes('Колдун') && sp.level === i)
                ).length;
                deficit += Math.max(0, target[i] - knownCount);
            }
        }
    } else {
        const allSpells = gameData.spells.filter(sp => sp.classes.includes(c.className) && sp.level <= Math.max(...Object.keys(target).map(Number)));
        for (let [level, count] of Object.entries(target)) {
            const levelInt = parseInt(level);
            const knownCount = current.filter(name => allSpells.some(sp => sp.name === name && sp.level === levelInt)).length;
            deficit += Math.max(0, count - knownCount);
        }
    }

    return deficit;
}

// ================================================================
// ЗАКЛИНАНИЯ, УЛУЧШЕНИЯ ХАРАКТЕРИСТИК И ЧЕРТЫ
// ================================================================
function CHECK_CLASS_FEATURES(c) {
    if (!c.className) return;
    if (!c.pendingChoices) c.pendingChoices = [];
    if (!c._completedChoices) c._completedChoices = [];
    // У Воина и Плута дополнительные уровни повышений характеристик по правилам D&D 5e
    let featLevels = [4, 8, 12, 16, 19];
    if (c.className === 'Воин') featLevels = [4, 6, 8, 12, 14, 16, 19];
    if (c.className === 'Плут') featLevels = [4, 8, 10, 12, 16, 19];

    featLevels.forEach(lvl => {
        const label = 'ASI/Черта (ур.' + lvl + ')';
        if (c.level >= lvl && !c.pendingChoices.some(p => p.label === label) && !c._completedChoices.includes(label)) {
            c.pendingChoices.push({type:'asi_or_feat', label:label, count:1, options:[]});
        }
    });
    if (gameData.classFeatures && gameData.classFeatures[c.className]) {
        gameData.classFeatures[c.className].forEach(f => {
            if (c.level >= f.level && !c.pendingChoices.some(p => p.label === f.label) && !c._completedChoices.includes(f.label)) {
                c.pendingChoices.push({...f});
            }
        });
    }
}

function REMOVE_PENDING_CHOICE(char, label) {
    if (!char.pendingChoices) return;
    if (label) {
        const idx = char.pendingChoices.findIndex(p => p.label === label);
        if (idx !== -1) char.pendingChoices.splice(idx, 1);
    } else if (char.pendingChoices.length > 0) {
        char.pendingChoices.shift();
    }
    if (label) {
        if (!char._completedChoices) char._completedChoices = [];
        if (!char._completedChoices.includes(label)) char._completedChoices.push(label);
    }
}

function START_FEAT_SELECTION() {
    const cs = GC();
    const c = cs[PI];
    if (!c.pendingChoices || c.pendingChoices.length === 0) return;
    
    const featOnly = c.pendingChoices.find(p => p.type === 'feat');
    if (featOnly) {
        window._asiChoice = featOnly;
        SHOW_FEAT_CHOICE_FOR_CHOICE(cs, c, featOnly);
        return;
    }
    const expChoice = c.pendingChoices.find(p => p.type === 'expertise');
    if (expChoice) {
        let knownSkills = (c.chosenSkills || []).concat(GAS(c));
        const availableExp = knownSkills.filter(s => !(c.expertiseSkills || []).includes(s));
        if (availableExp.length === 0) {
            showMessage('Подсказка', 'Сначала выберите и сохраните обычные навыки, чтобы назначить в них Экспертность.');
            return;
        }
        SHOW_OPTION_CHOICE(expChoice.label, availableExp, Math.min(expChoice.count, availableExp.length), function(selected) {
            const freshCs = GC();
            const freshC = freshCs[PI];
            if (!freshC.expertiseSkills) freshC.expertiseSkills = [];
            freshC.expertiseSkills.push(...selected);
            REMOVE_PENDING_CHOICE(freshC, expChoice.label);
            SC(freshCs); RMC(); ROS();
        });
        return;
    }

    const choice = c.pendingChoices.find(p => p.type === 'asi_or_feat');
    if (!choice) {
        showMessage('Нет доступных улучшений', 'Все выборы уже обработаны.');
        return;
    }
    SHOW_ASI_OR_FEAT_CHOICE(c, choice);
}

function SHOW_ASI_OR_FEAT_CHOICE(c, choice) {
    if (document.getElementById('temp-asi-modal')) document.getElementById('temp-asi-modal').remove();
    let html = '<div class="modal-content" style="max-width:400px;">';
    html += '<h2>' + (choice.label || 'Улучшение характеристик или черта') + '</h2>';
    html += '<p>Выберите, что вы хотите сделать:</p>';
    html += '<button class="btn-save" onclick="START_ASI_CHOICE()">Повысить характеристики</button><br><br>';
    html += '<button class="btn-save" onclick="SHOW_FEAT_CHOICE_FROM_ASI()">Выбрать черту</button><br><br>';
    html += '<button onclick="CANCEL_ASI_CHOICE()">Пропустить</button>';
    html += '</div>';
    let modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'temp-asi-modal';
    modal.innerHTML = html;
    document.body.appendChild(modal);
    window._asiChoice = choice;
    window._asiChar = c;
}

function CANCEL_ASI_CHOICE() {
    if (document.getElementById('temp-asi-modal')) document.getElementById('temp-asi-modal').remove();
    const cs = GC();
    const c = cs[PI];
    REMOVE_PENDING_CHOICE(c, window._asiChoice ? window._asiChoice.label : '');
    SC(cs);
    ROS();
}

function START_ASI_CHOICE() {
    if (document.getElementById('temp-asi-modal')) document.getElementById('temp-asi-modal').remove();
    let html = '<div class="modal-content" style="max-width:500px;">';
    html += '<h2>Повышение характеристик</h2>';
    html += '<p>Выберите вариант улучшения:</p>';
    html += '<div id="asi-distribution"></div>';
    html += '<br><button class="btn-save" id="confirm-asi">Подтвердить</button> ';
    html += '<button onclick="document.getElementById(\'temp-asi-modal\').remove(); ROS();">Отмена</button>';
    html += '</div>';
    let modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = 'temp-asi-modal';
    modal.innerHTML = html;
    document.body.appendChild(modal);

    const c = GC()[PI];
    const stats = ['str','dex','con','intl','wis','cha'];
    const names = {str:'Сила', dex:'Ловкость', con:'Телосложение', intl:'Интеллект', wis:'Мудрость', cha:'Харизма'};
    const baseKeyMap = {str:'baseStr', dex:'baseDex', con:'baseCon', intl:'baseInt', wis:'baseWis', cha:'baseCha'};

    let distHTML = '<p><label><input type="radio" name="asi-mode" value="+2" checked> +2 к одной характеристике</label></p>';
    distHTML += '<select id="asi-single-stat">';
    stats.forEach(s => { distHTML += '<option value="'+s+'">'+names[s]+' (сейчас ' + (c[s] || 10) + ')</option>'; });
    distHTML += '</select>';
    distHTML += '<br><br><p><label><input type="radio" name="asi-mode" value="+1+1"> +1 к двум разным характеристикам</label></p>';
    distHTML += '<select id="asi-double-1"><option value="">—</option>';
    stats.forEach(s => { distHTML += '<option value="'+s+'">'+names[s]+' (сейчас ' + (c[s] || 10) + ')</option>'; });
    distHTML += '</select> и <select id="asi-double-2"><option value="">—</option>';
    stats.forEach(s => { distHTML += '<option value="'+s+'">'+names[s]+' (сейчас ' + (c[s] || 10) + ')</option>'; });
    distHTML += '</select>';
    document.getElementById('asi-distribution').innerHTML = distHTML;

    document.getElementById('confirm-asi').onclick = function() {
        const mode = document.querySelector('input[name="asi-mode"]:checked').value;
        const csList = GC();
        const c2 = csList[PI];
        if (mode === '+2') {
            const stat = document.getElementById('asi-single-stat').value;
            const capName = baseKeyMap[stat];
            c2[capName] = (c2[capName] || 10) + 2;
        } else {
            const s1 = document.getElementById('asi-double-1').value;
            const s2 = document.getElementById('asi-double-2').value;
            if (!s1 || !s2 || s1 === s2) {
                showMessage('Ошибка', 'Выберите две разные характеристики.');
                return;
            }
            const cap1 = baseKeyMap[s1];
            const cap2 = baseKeyMap[s2];
            c2[cap1] = (c2[cap1] || 10) + 1;
            c2[cap2] = (c2[cap2] || 10) + 1;
        }
        AB(c2);
        REMOVE_PENDING_CHOICE(c2, window._asiChoice ? window._asiChoice.label : '');
        c2._processingChoices = false;
        SC(csList);
        RMC();
        ROS();
        document.getElementById('temp-asi-modal').remove();
    };
}

function SHOW_FEAT_CHOICE(availableFeats, onConfirm) {
    const listDiv = document.getElementById('feat-choice-list');
    let html = '<div style="display:flex; flex-direction:column; gap:6px;">';
    availableFeats.forEach(f => {
        html += '<label style="display:flex; align-items:flex-start; padding:6px; background:#333; border-radius:4px; cursor:pointer;">' +
                '<input type="radio" name="feat-radio" value="' + f.name + '" style="margin-right:10px; margin-top:3px;">' +
                '<div><strong>' + f.name + '</strong><br><small style="color:#aaa;">' + f.desc + '</small></div>' +
                '</label>';
    });
    html += '</div>';
    listDiv.innerHTML = html;
    document.getElementById('feat-choice-confirm').onclick = function() {
        const selected = document.querySelector('input[name="feat-radio"]:checked');
        if (!selected) { showMessage('Ошибка', 'Выберите одну черту.'); return; }
        const chosen = selected.value;
        closeModal('feat-choice-modal');
        setTimeout(() => onConfirm(chosen), 10);
    };
    OM('feat-choice-modal');
}

function SHOW_FEAT_CHOICE_FOR_CHOICE(cs, c, choice) {
    const char = cs[PI];
    const allFeats = gameData.feats || [];
    const available = allFeats.filter(f => !(char.chosenFeats || []).includes(f.name));
    if (available.length === 0) {
        REMOVE_PENDING_CHOICE(char, choice ? choice.label : '');
        SC(cs); RMC(); ROS();
        return;
    }

    SHOW_FEAT_CHOICE(available, function(selectedFeat) {
        if (!char.chosenFeats) char.chosenFeats = [];
        char.chosenFeats.push(selectedFeat);
        APPLY_FEAT_EFFECTS(cs, char, selectedFeat, function() {
            const freshChar = cs[PI];
            REMOVE_PENDING_CHOICE(freshChar, choice ? choice.label : '');
            SC(cs);
            RMC();
            ROS();
        });
    });
}

function APPLY_FEAT_EFFECTS(cs, char, featName, doneCallback) {
    const feat = (gameData.feats || []).find(f => f.name === featName);
    if (!feat || !feat.effect) {
        if (doneCallback) doneCallback();
        return;
    }
    const effect = feat.effect;
    const statNames = {str:'Сила', dex:'Ловкость', con:'Телосложение', intl:'Интеллект', wis:'Мудрость', cha:'Харизма'};
    const codeByRus = {'Сила':'str', 'Ловкость':'dex', 'Телосложение':'con', 'Интеллект':'intl', 'Мудрость':'wis', 'Харизма':'cha'};

    function applyStatCode(statCode, bonus) {
        let cap = 'base' + statCode.charAt(0).toUpperCase() + statCode.slice(1);
        if (statCode === 'intl') cap = 'baseInt';
        char[cap] = (char[cap] || 10) + bonus;
        AB(char);
    }

    function stepStat() {
        if (effect.chooseStat && effect.chooseStat.options && effect.chooseStat.options.length > 0) {
            const opts = effect.chooseStat.options;
            const bonus = effect.chooseStat.bonus || 1;
            if (opts.length === 1) {
                applyStatCode(opts[0], bonus);
                stepLanguages();
            } else {
                const rusOptions = opts.map(code => statNames[code] || code);
                SHOW_OPTION_CHOICE(effect.chooseStat.label || 'Выберите характеристику (+1)', rusOptions, 1, function(selected) {
                    const chosenCode = codeByRus[selected[0]] || opts[0];
                    applyStatCode(chosenCode, bonus);
                    stepLanguages();
                });
                return;
            }
        } else {
            stepLanguages();
        }
    }

    function stepLanguages() {
        if (effect.chooseLanguages) {
            const allLangs = gameData.languages.all();
            const known = GAL(char);
            const available = allLangs.filter(l => !known.includes(l));
            if (available.length > 0) {
                SHOW_OPTION_CHOICE('Выберите языки', available, Math.min(effect.chooseLanguages.count, available.length), function(selected) {
                    if (!char.chosenLanguages) char.chosenLanguages = {};
                    selected.forEach(lang => { char.chosenLanguages[lang] = true; });
                    applyPassiveEffects();
                });
                return;
            }
        }
        applyPassiveEffects();
    }

    function applyPassiveEffects() {
        if (effect.autoAbilities) {
            char.abilities = (char.abilities ? char.abilities + '<br>• ' : '• ') + '<b>' + featName + ':</b> ' + effect.autoAbilities;
        }
        if (effect.initiativeBonus) char.initiativeBonus = (char.initiativeBonus || 0) + effect.initiativeBonus;
        if (effect.speedBonus) {
            char.featSpeedBonus = (char.featSpeedBonus || 0) + effect.speedBonus;
            char.speed = (char.speed || 30) + effect.speedBonus;
        }
        if (effect.toughBonus) {
            char.toughPerLevel = (char.toughPerLevel || 0) + effect.toughBonus;
            RHP(char);
        }
        stepSkills();
    }

    function stepSkills() {
        if (effect.chooseSkills || effect.chooseSkillOrTool) {
            const count = effect.chooseSkills ? effect.chooseSkills.count : effect.chooseSkillOrTool.countSkills;
            const label = effect.chooseSkills ? effect.chooseSkills.label : effect.chooseSkillOrTool.label;
            const alreadyKnown = (char.chosenSkills || []).concat(GAS(char));
            const availableSkills = gameData.allSkills.filter(s => !alreadyKnown.includes(s));
            if (availableSkills.length > 0) {
                SHOW_OPTION_CHOICE(label, availableSkills, Math.min(count, availableSkills.length), function(selected) {
                    if (!char.chosenSkills) char.chosenSkills = [];
                    char.chosenSkills.push(...selected);
                    char.bonusSkillSlots = (char.bonusSkillSlots || 0) + selected.length;
                    stepExpertise();
                });
                return;
            }
        }
        stepExpertise();
    }

    function stepExpertise() {
        if (effect.chooseExpertise) {
            const count = effect.chooseExpertise.count;
            let knownSkills = (char.chosenSkills || []).concat(GAS(char));
            const availableExp = knownSkills.filter(s => !(char.expertiseSkills || []).includes(s));
            if (availableExp.length > 0) {
                SHOW_OPTION_CHOICE('Выберите навыки для Экспертизы', availableExp, Math.min(count, availableExp.length), function(selected) {
                    if (!char.expertiseSkills) char.expertiseSkills = [];
                    char.expertiseSkills.push(...selected);
                    stepWeapons();
                });
                return;
            }
        }
        stepWeapons();
    }

    function stepWeapons() {
        if (effect.chooseWeapons) {
            SHOW_OPTION_CHOICE(effect.chooseWeapons.label, effect.chooseWeapons.options, effect.chooseWeapons.count, function(selected) {
                if (!char.weaponProficiencies) char.weaponProficiencies = [];
                char.weaponProficiencies.push(...selected);
                char.abilities = (char.abilities ? char.abilities + '<br>• ' : '• ') + '<b>Владение оружием:</b> ' + selected.join(', ');
                stepFeatSpells();
            });
            return;
        }
        stepFeatSpells();
    }

    function stepFeatSpells() {
        if (effect.chooseSpells) {
            const cfg = effect.chooseSpells;
            const avail = gameData.spells.filter(sp => sp.level === cfg.level && !(char.knownSpells || []).includes(sp.name));
            if (avail.length > 0) {
                SHOW_SPELL_CHOICE(avail, cfg.count || 1, cfg.label || 'Выберите заклинание', function(selected) {
                    if (!char.knownSpells) char.knownSpells = [];
                    char.knownSpells.push(...selected);
                    closeModal('spell-choice-modal');
                    finishFeatApply();
                });
                return;
            }
        }
        if (effect.chooseSpellsModal) {
            const cantripsAvail = gameData.spells.filter(sp => sp.level === 0 && !(char.knownSpells || []).includes(sp.name));
            SHOW_SPELL_CHOICE(cantripsAvail, effect.chooseSpellsModal.cantrips || 2, 'Зачинатель магии: Выберите 2 заговора', function(selCantrips) {
                if (!char.knownSpells) char.knownSpells = [];
                char.knownSpells.push(...selCantrips);
                closeModal('spell-choice-modal');
                const lvl1Avail = gameData.spells.filter(sp => sp.level === 1 && !(char.knownSpells || []).includes(sp.name));
                setTimeout(() => {
                    SHOW_SPELL_CHOICE(lvl1Avail, effect.chooseSpellsModal.level1 || 1, 'Зачинатель магии: Выберите 1 заклинание 1 круга', function(selLvl1) {
                        char.knownSpells.push(...selLvl1);
                        closeModal('spell-choice-modal');
                        finishFeatApply();
                    });
                }, 50);
            });
            return;
        }
        finishFeatApply();
    }

    function finishFeatApply() {
        AB(char);
        SC(cs);
        RMC();
        ROS();
        if (doneCallback) doneCallback();
    }

    stepStat();
}

function OPEN_SPELL_SELECTION() {
    const csList = GC();
    const char = csList[PI];
    if (!char.className || !gameData.classes[char.className]) return;
    const lv = char.level || 1;
    const classTable = gameData.knownSpellsTable && gameData.knownSpellsTable[char.className];
    if (!classTable) return;
    const cfg = classTable[lv];
    if (!cfg) return;

    const current = char.knownSpells || [];
    let groups = []; // [{ title, max, spells }]
    let totalNeed = 0;

    if (char.className === 'Колдун') {
        const needCantrips = (cfg[0] || 0) - current.filter(n => gameData.spells.some(s => s.name === n && s.level === 0)).length;
        if (needCantrips > 0) {
            const spList = gameData.spells.filter(s => s.classes.includes('Колдун') && s.level === 0 && !current.includes(s.name));
            if (spList.length > 0) {
                groups.push({ id: 'cantrips', title: `Заговоры (выберите ${needCantrips})`, max: needCantrips, spells: spList });
                totalNeed += needCantrips;
            }
        }
        const maxPactLevel = lv >= 9 ? 5 : lv >= 7 ? 4 : lv >= 5 ? 3 : lv >= 3 ? 2 : 1;
        const targetPactTotal = cfg[1] || 0;
        const knownPact = current.filter(n => gameData.spells.some(s => s.name === n && s.classes.includes('Колдун') && s.level >= 1 && s.level <= 5)).length;
        const needPact = targetPactTotal - knownPact;
        if (needPact > 0) {
            const spList = gameData.spells.filter(s => s.classes.includes('Колдун') && s.level >= 1 && s.level <= maxPactLevel && !current.includes(s.name));
            if (spList.length > 0) {
                groups.push({ id: 'pact', title: `Заклинания Договора 1–${maxPactLevel} круга (выберите ${needPact})`, max: needPact, spells: spList });
                totalNeed += needPact;
            }
        }
        for (let arcLv = 6; arcLv <= 9; arcLv++) {
            if (cfg[arcLv]) {
                const knownArc = current.filter(n => gameData.spells.some(s => s.name === n && s.classes.includes('Колдун') && s.level === arcLv)).length;
                const needArc = cfg[arcLv] - knownArc;
                if (needArc > 0) {
                    const spList = gameData.spells.filter(s => s.classes.includes('Колдун') && s.level === arcLv && !current.includes(s.name));
                    if (spList.length > 0) {
                        groups.push({ id: 'arc_' + arcLv, title: `Таинственный Арканум ${arcLv} круга (выберите ${needArc})`, max: needArc, spells: spList });
                        totalNeed += needArc;
                    }
                }
            }
        }
    } else {
        const allSpells = gameData.spells.filter(sp => sp.classes.includes(char.className) && sp.level <= Math.max(...Object.keys(cfg).map(Number)));
        for (let [level, count] of Object.entries(cfg)) {
            const levelInt = parseInt(level);
            const known = current.filter(name => allSpells.some(sp => sp.name === name && sp.level === levelInt)).length;
            const need = count - known;
            if (need > 0) {
                const spellsOfLevel = allSpells.filter(sp => sp.level === levelInt && !current.includes(sp.name));
                if (spellsOfLevel.length > 0) {
                    groups.push({
                        id: 'lvl_' + levelInt,
                        title: (levelInt === 0 ? 'Заговоры' : levelInt + '-й круг') + ` (выберите ${need})`,
                        max: need,
                        spells: spellsOfLevel
                    });
                    totalNeed += need;
                }
            }
        }
    }

    if (totalNeed <= 0 || groups.length === 0) {
        showMessage('Нет доступных заклинаний', 'Все заклинания для вашего уровня уже выбраны.');
        char._spellsOffered = true;
        SC(csList);
        ROS();
        return;
    }

    document.getElementById('spell-choice-title').textContent = 'Изучение заклинаний (' + char.className + ', ур. ' + lv + ')';
    document.getElementById('spell-choice-info').textContent = 'Отметьте нужные заклинания в каждой категории:';

    let listHtml = '<div style="display:flex; flex-direction:column; gap:10px; text-align:left;">';
    groups.forEach(g => {
        listHtml += `<div style="background:#222; border:1px solid #444; border-radius:6px; padding:8px;">` +
                    `<div style="color:#c9a96e; font-weight:bold; margin-bottom:6px;">${g.title}</div>` +
                    `<div style="display:flex; flex-direction:column; gap:4px;">`;
        g.spells.forEach(sp => {
            listHtml += `<label style="display:flex; align-items:flex-start; padding:5px 8px; background:#333; border-radius:4px; cursor:pointer; font-size:0.85em;">` +
                        `<input type="checkbox" class="spell-check-grouped" data-group="${g.id}" data-max="${g.max}" value="${sp.name}" style="width:auto; margin-right:8px; margin-top:3px;">` +
                        `<div><b>${sp.name}</b> <span style="color:#c9a96e;">(${sp.level === 0 ? 'заговор' : sp.level + ' круг'})</span><br><small style="color:#aaa;">${sp.desc}</small></div>` +
                        `</label>`;
        });
        listHtml += `</div></div>`;
    });
    listHtml += '</div>';
    document.getElementById('spell-choice-list').innerHTML = listHtml;

    const confirmBtn = document.getElementById('spell-choice-confirm');
    confirmBtn.onclick = function() {
        const allChecked = document.querySelectorAll('.spell-check-grouped:checked');
        if (allChecked.length === 0) {
            showMessage('Ошибка', 'Выберите хотя бы одно заклинание.');
            return;
        }
        for (const g of groups) {
            const gChecked = document.querySelectorAll(`.spell-check-grouped[data-group="${g.id}"]:checked`);
            if (gChecked.length > g.max) {
                showMessage('Превышен лимит', `В разделе «${g.title}» можно выбрать не более ${g.max} заклинаний (сейчас выбрано ${gChecked.length}).`);
                return;
            }
        }
        const selected = Array.from(allChecked).map(cb => cb.value);
        if (!char.knownSpells) char.knownSpells = [];
        selected.forEach(s => { if (!char.knownSpells.includes(s)) char.knownSpells.push(s); });
        if (GET_KNOWN_SPELLS_DEFICIT(char) <= 0) char._spellsOffered = true;
        csList[PI] = char;
        SC(csList);
        closeModal('spell-choice-modal');
        ROS();
        RMC();
    };

    OM('spell-choice-modal');
}

window._sheetTab = 'all'; // 'all' (Весь лист прокруткой) | 'main' | 'skills' | 'features' | 'bio'
function SET_SHEET_TAB(tab) {
    window._sheetTab = tab;
    OCS();
}

function OCS() {
    const cs = GC(); if (!cs.length) return; const c = cs[PI];
    CHECK_CLASS_FEATURES(c);
    SC(cs);
    const cont = document.getElementById('char-sheet-content');

    let topAlerts = '';
    if (gameData.classes[c.className] && gameData.spells.some(sp => sp.classes.includes(c.className)) && !c._spellsOffered && GET_KNOWN_SPELLS_DEFICIT(c) > 0) {
        topAlerts += '<button class="btn-save" style="margin-right:8px; margin-bottom:10px;" onclick="OPEN_SPELL_SELECTION()">✨ Выбрать новые заклинания (' + GET_KNOWN_SPELLS_DEFICIT(c) + ')</button>';
    }
    if (c.pendingChoices && c.pendingChoices.some(p => p.type === 'asi_or_feat' || p.type === 'feat' || p.type === 'expertise')) {
        topAlerts += '<button class="btn-save" style="margin-bottom:10px;" onclick="START_FEAT_SELECTION()">🌟 Доступно улучшение / Черта / Экспертность</button>';
    }

    const pb = GPB(c.level||1);
    const str=c.str||10,sm=GM(str); const dex=c.dex||10,dm=GM(dex); const con=c.con||10,cm=GM(con);
    const intl=c.intl||10,im=GM(intl); const wis=c.wis||10,wm=GM(wis); const cha=c.cha||10,hm=GM(cha);
    const rl=c.raceLocked||false,cl=c.classLocked||false,bl=c.bgLocked||false,sv=(c.level||1)>=3,ns=sv&&!c.subclass&&cl,sl=c.subclassLocked||false;

    let ro='<option value="">— Выберите расу —</option>'; for(const rn in gameData.races) ro+='<option value="'+rn+'"'+(c.race===rn?' selected':'')+'>'+rn+'</option>';
    let so='<option value="">— Выберите подрасу —</option>'; if(c.race&&gameData.races[c.race]&&gameData.races[c.race].sub) for(const sn in gameData.races[c.race].sub) so+='<option value="'+sn+'"'+(c.subrace===sn?' selected':'')+'>'+sn+'</option>';
    let co='<option value="">— Выберите класс —</option>'; for(const cn in gameData.classes) co+='<option value="'+cn+'"'+(c.className===cn?' selected':'')+'>'+cn+'</option>';
    let sso='<option value="">— Выберите подкласс —</option>'; if(c.className&&gameData.classes[c.className]&&gameData.classes[c.className].sub) gameData.classes[c.className].sub.forEach(sn=>{sso+='<option value="'+sn+'"'+(c.subclass===sn?' selected':'')+'>'+sn+'</option>';});
    let bo='<option value="">— Выберите предысторию —</option>'; for(const bn in gameData.backgrounds) bo+='<option value="'+bn+'"'+(c.background===bn?' selected':'')+'>'+bn+'</option>';
    const al=GAL(c),lch=RLCH(c);
    const as=GAS(c),sc=GSC(c),avail=GASC(c),chs=c.chosenSkills||[],rem=sc-chs.length,skl=c.skillsLocked||false,pv=c._prevSkills?c._prevSkills.slice():[];

    const pp=as.includes('Восприятие')||chs.includes('Восприятие'), isExpPerc=c.expertiseSkills&&c.expertiseSkills.includes(s=>'Восприятие'===s), obsBonus=(c.chosenFeats&&c.chosenFeats.includes('Наблюдатель'))?5:0, pw=10+(pp?(isExpPerc?wm+pb*2:wm+pb):wm)+obsBonus;
    const acv=CAC(c),cap=CC(c),cpt=cap+' фнт ('+LKG(cap)+' кг)';
    const rsp=RSP(c);

    const curTab = window._sheetTab || 'all';
    const tStyle = (t) => `flex:1; min-width:140px; padding:8px 10px; font-size:0.9rem; border-radius:6px; background:${curTab===t?'#c9a96e':'#181715'}; color:${curTab===t?'#181510':'#ccc'}; border:1px solid ${curTab===t?'#e0c58e':'#3d3830'};`;
    const skillWarnBadge = (rem > 0) ? ` <span style="background:#c97e2e; color:#fff; padding:1px 6px; border-radius:10px; font-size:0.78em;">+${rem}</span>` : '';

    const tabsNavHTML = `
        <div style="display:flex; gap:6px; margin-bottom:14px; flex-wrap:wrap;">
            <button style="${tStyle('all')}" onclick="SET_SHEET_TAB('all')">📜 Весь лист (Прокрутка)</button>
            <button style="${tStyle('main')}" onclick="SET_SHEET_TAB('main')">👤 Основное и Статы</button>
            <button style="${tStyle('skills')}" onclick="SET_SHEET_TAB('skills')">🎯 Навыки и Спасы${skillWarnBadge}</button>
            <button style="${tStyle('features')}" onclick="SET_SHEET_TAB('features')">🌟 Черты и Арсенал</button>
            <button style="${tStyle('bio')}" onclick="SET_SHEET_TAB('bio')">📖 Характер и Лор</button>
        </div>
    `;

    // --- БЛОК 1: ОСНОВНОЕ И ХАРАКТЕРИСТИКИ ---
    const sectionMainHTML = `
        <div class="sheet-grid-2col">
            <div>
                <h3 style="margin-top:0;">👤 Основная информация</h3>
                <table>
                    <colgroup><col style="width:38%;"><col style="width:62%;"></colgroup>
                    <tr><td>Имя героя</td><td><input type="text" value="${c.name||''}" onchange="UCF('name',this.value);RMC();"></td></tr>
                    <tr><td>Предыстория</td><td>${bl ? '<span class="locked-field">✅ '+(c.background||'—')+'</span>' : '<div style="display:flex; gap:4px;"><select onchange="UCF(\'background\',this.value);LRB();" class="'+(!c.background?'incomplete':'')+'">'+bo+'</select>'+(c.background?'<button class="btn-small btn-save" onclick="LKBG()">🔒</button>':'')+'</div>'}</td></tr>
                    <tr><td>Раса</td><td>${rl ? '<span class="locked-field">✅ '+(c.race||'—')+(c.subrace?' ('+c.subrace+')':'')+'</span>' : '<select onchange="UCF(\'race\',this.value);ROS();" class="'+(!c.race?'incomplete':'')+'">'+ro+'</select>'}</td></tr>
                    ${(!rl && c.race && gameData.races[c.race] && gameData.races[c.race].sub) ? '<tr><td>Подраса</td><td><select onchange="UCF(\'subrace\',this.value);ROS();">'+so+'</select></td></tr>' : ''}
                    ${(!rl && c.race) ? '<tr><td colspan="2"><button class="btn-small btn-save" style="width:100%;" onclick="LKR()">🔒 Сохранить расу</button></td></tr>' : ''}
                    <tr><td>Класс</td><td>${cl ? '<span class="locked-field">✅ '+(c.className||'—')+'</span>' : '<select onchange="UCF(\'className\',this.value);ROS();" class="'+(!c.className?'incomplete':'')+'">'+co+'</select>'}</td></tr>
                    ${sv ? '<tr><td>Подкласс</td><td>'+(sl?'<span class="locked-field">✅ '+(c.subclass||'—')+'</span>':'<div style="display:flex; gap:4px;"><select onchange="UCF(\'subclass\',this.value);ROS();" class="'+(ns?'incomplete':'')+'">'+sso+'</select>'+(cl&&!sl&&c.subclass?'<button class="btn-small btn-save" onclick="LKSB()">🔒</button>':'')+'</div>')+'</td></tr>' : ''}
                    ${(!cl && c.className) ? '<tr><td colspan="2"><button class="btn-small btn-save" style="width:100%;" onclick="LKC()">🔒 Сохранить класс</button></td></tr>' : ''}
                    <tr><td>Уровень и БМ</td><td><div style="display:flex; align-items:center; justify-content:center; gap:8px;"><input type="number" min="1" max="20" value="${c.level||1}" onchange="ULV(parseInt(this.value))" style="width:70px;"> <span style="color:#c9a96e;">БМ: <b>+${pb}</b></span></div></td></tr>
                    <tr><td>Опыт (XP)</td><td><div style="display:flex; align-items:center; justify-content:center; gap:6px;"><input type="number" value="${c.xp||0}" onchange="UCF('xp',parseInt(this.value));ROS();" style="width:95px;"> <span>/ ${XPL((c.level||1)+1)}</span></div></td></tr>
                </table>

                <h3>🛡️ Боевые параметры</h3>
                <table>
                    <colgroup><col style="width:46%;"><col style="width:54%;"></colgroup>
                    <tr><td>Хиты (тек. / макс.)</td><td><div style="display:flex; align-items:center; justify-content:center; gap:6px;"><input type="number" min="0" max="${c.maxHp||10}" value="${c.hp??10}" onchange="UHP('hp',this.value)" style="width:70px;"> <span>/ <b>${c.maxHp||10}</b></span></div></td></tr>
                    <tr><td>Временные ХП</td><td><input type="number" min="0" value="${c.tempHP||0}" onchange="UHP('tempHP',this.value)" style="width:75px;"></td></tr>
                    <tr><td>Класс Брони (КБ)</td><td><b>${acv}</b>${c.hasArmorPenalty?' <span style="color:#e06060;font-size:0.8em;">(Штраф)</span>':''}</td></tr>
                    <tr><td>Инициатива | Скорость</td><td><b>${MS(dm + (c.initiativeBonus || 0))}</b> &nbsp;|&nbsp; <b>${parseInt(c.speed) || 30} фт</b></td></tr>
                    <tr><td>Кость хитов</td><td>${c.hitDice||'—'} (${Math.max(0, (c.level||1)-(c.spentHitDice||0))}/${c.level||1})</td></tr>
                    <tr><td>Пассив. Внимательность</td><td><b>${pw}</b></td></tr>
                    <tr><td>Грузоподъёмность</td><td>${cpt}</td></tr>
                    <tr><td>Вдохновение</td><td><input type="text" value="${c.inspiration||'0'}" onchange="UCF('inspiration',this.value)" style="width:75px;"></td></tr>
                </table>
            </div>

            <div>
                <h3 style="margin-top:0;">💪 Характеристики</h3>
                ${!c.statsLocked ? `
                    <div style="margin-bottom:8px; display:flex; gap:6px; flex-wrap:wrap;">
                        <button class="btn-small" style="flex:1;" onclick="AUTO_STATS()">⚡ Авто-подбор</button>
                        <button class="btn-small" style="flex:1;" onclick="ROLL_STATS_4D6()">🎲 Бросить 4к6</button>
                        <button class="btn-small btn-save" style="flex:1;" onclick="LKSTATS()">🔒 Сохранить</button>
                    </div>` : ''}
                <table>
                    <colgroup>
                        <col style="width:34%;">
                        <col style="width:20%;">
                        <col style="width:14%;">
                        <col style="width:16%;">
                        <col style="width:16%;">
                    </colgroup>
                    <tr><th>Параметр</th><th>База</th><th>Раса</th><th>Итог</th><th>Мод</th></tr>
                    <tr><td><b>Сила</b></td><td>${c.statsLocked ? (c.baseStr||10) : `<input type="number" min="3" max="18" value="${c.baseStr||10}" onchange="UBASE('baseStr',this.value)" style="padding:4px;">`}</td><td style="color:#aaa;">${c.strBonus>0?'+'+c.strBonus:'—'}</td><td><b>${str}</b></td><td class="stat-mod">${MS(sm)}</td></tr>
                    <tr><td><b>Ловкость</b></td><td>${c.statsLocked ? (c.baseDex||10) : `<input type="number" min="3" max="18" value="${c.baseDex||10}" onchange="UBASE('baseDex',this.value)" style="padding:4px;">`}</td><td style="color:#aaa;">${c.dexBonus>0?'+'+c.dexBonus:'—'}</td><td><b>${dex}</b></td><td class="stat-mod">${MS(dm)}</td></tr>
                    <tr><td><b>Телослож.</b></td><td>${c.statsLocked ? (c.baseCon||10) : `<input type="number" min="3" max="18" value="${c.baseCon||10}" onchange="UBASE('baseCon',this.value)" style="padding:4px;">`}</td><td style="color:#aaa;">${c.conBonus>0?'+'+c.conBonus:'—'}</td><td><b>${con}</b></td><td class="stat-mod">${MS(cm)}</td></tr>
                    <tr><td><b>Интеллект</b></td><td>${c.statsLocked ? (c.baseInt||10) : `<input type="number" min="3" max="18" value="${c.baseInt||10}" onchange="UBASE('baseInt',this.value)" style="padding:4px;">`}</td><td style="color:#aaa;">${c.intBonus>0?'+'+c.intBonus:'—'}</td><td><b>${intl}</b></td><td class="stat-mod">${MS(im)}</td></tr>
                    <tr><td><b>Мудрость</b></td><td>${c.statsLocked ? (c.baseWis||10) : `<input type="number" min="3" max="18" value="${c.baseWis||10}" onchange="UBASE('baseWis',this.value)" style="padding:4px;">`}</td><td style="color:#aaa;">${c.wisBonus>0?'+'+c.wisBonus:'—'}</td><td><b>${wis}</b></td><td class="stat-mod">${MS(wm)}</td></tr>
                    <tr><td><b>Харизма</b></td><td>${c.statsLocked ? (c.baseCha||10) : `<input type="number" min="3" max="18" value="${c.baseCha||10}" onchange="UBASE('baseCha',this.value)" style="padding:4px;">`}</td><td style="color:#aaa;">${c.chaBonus>0?'+'+c.chaBonus:'—'}</td><td><b>${cha}</b></td><td class="stat-mod">${MS(hm)}</td></tr>
                </table>

                <h3>💎 Магические ячейки</h3>
                <div style="background:#181715; border:1px solid #36322b; padding:10px 12px; border-radius:8px; font-size:0.94rem;">
                    ${(() => {
                        const maxSlots = GET_SPELL_SLOTS(c);
                        const usedSlots = c.usedSpellSlots || {};
                        let result = '';
                        if (c.className === 'Колдун') {
                            let pactStr = '';
                            for (let i = 1; i <= 5; i++) {
                                if (maxSlots[i]) pactStr += `<b>${i} круг (Договор):</b> ${maxSlots[i] - (usedSlots[i] || 0)} / ${maxSlots[i]} `;
                            }
                            result += pactStr ? pactStr : '—';
                            let arcanumStr = '';
                            for (let i = 6; i <= 9; i++) {
                                if (maxSlots[i]) arcanumStr += `${i} кр.: ${maxSlots[i] - (usedSlots[i] || 0)}/${maxSlots[i]} `;
                            }
                            if (arcanumStr) result += '<br><b>Арканумы:</b> ' + arcanumStr;
                        } else {
                            for (let i = 1; i <= 9; i++) {
                                if (maxSlots[i]) result += `<span style="display:inline-block; margin-right:10px;"><b>${i} круг:</b> ${maxSlots[i] - (usedSlots[i] || 0)}/${maxSlots[i]}</span>`;
                            }
                        }
                        return result || '<span style="color:#888;">Нет ячеек заклинаний</span>';
                    })()}
                </div>
            </div>
        </div>
    `;

    // --- БЛОК 2: НАВЫКИ И СПАСБРОСКИ ---
    const cst=GCST(c);
    const hasRingProt = c.inventory && c.inventory.some(i => i.equipped && (i.name || '').toLowerCase().includes('кольцо защиты'));
    const ringBonus = hasRingProt ? 1 : 0;
    const svs=[{n:'Сила',m:sm,p:cst.strength},{n:'Ловкость',m:dm,p:cst.dexterity},{n:'Телосложение',m:cm,p:cst.constitution},{n:'Интеллект',m:im,p:cst.intelligence},{n:'Мудрость',m:wm,p:cst.wisdom},{n:'Харизма',m:hm,p:cst.charisma}];
    let svHTML=''; svs.forEach(s=>{svHTML+='<tr><td>'+(s.p?'● ':'○ ')+s.n+'</td><td class="stat-mod">'+MS((s.p?s.m+pb:s.m)+ringBonus)+'</td></tr>';});

    let sHTML='';
    const smods={'Атлетика':sm,'Акробатика':dm,'Ловкость рук':dm,'Скрытность':dm,'Магия':im,'История':im,'Расследование':im,'Природа':im,'Религия':im,'Обращение с животными':wm,'Проницательность':wm,'Медицина':wm,'Восприятие':wm,'Выживание':wm,'Обман':hm,'Запугивание':hm,'Выступление':hm,'Убеждение':hm};
    gameData.allSkills.forEach(s=>{
        const ia=as.includes(s),ic=chs.includes(s),ip=ia||ic;
        const isExpert = c.expertiseSkills && c.expertiseSkills.includes(s);
        const bn = ip ? (isExpert ? smods[s] + pb * 2 : smods[s] + pb) : smods[s];
        const bs=(bn>=0?'+':'')+bn;
        const pc=ip?'skill-prof':'skill-not-prof';
        const mk=isExpert?'★':(ip?'●':'○');
        sHTML+='<tr><td class="'+pc+'">'+mk+' '+s+'</td><td class="skill-bonus">'+bs+'</td></tr>';
    });

    let pendingSkillChoice = c.pendingChoices ? c.pendingChoices.find(p => p.type === 'skill') : null;
    let actualRem = rem, actualSkl = skl, actualAvail = avail;
    if (pendingSkillChoice) {
        actualSkl = false;
        actualRem = pendingSkillChoice.count || 1;
        actualAvail = pendingSkillChoice.options.filter(s => !(c.chosenSkills || []).includes(s) && !as.includes(s));
    }

    let scHTML = '';
    if (!actualSkl && actualRem > 0 && actualAvail.length > 0) {
        scHTML += '<div class="skill-choice"><strong>Доступно для выбора навыков: ' + actualRem + '</strong><br><select id="skill-select" onchange="ACHS(this.value)" style="margin-top:6px;"><option value="">— Выберите навык —</option>';
        actualAvail.forEach(s => { scHTML += '<option value="' + s + '">' + s + '</option>'; });
        scHTML += '</select></div>';
    }
    if (chs.length > 0) {
        scHTML += '<div style="margin:8px 0;">Выбранные навыки: ';
        if (!actualSkl) chs.forEach(s => { scHTML += '<span class="chosen-skill" onclick="RCHS(\'' + s + '\')">' + s + ' ✕</span> '; });
        else chs.forEach(s => { scHTML += '<span class="chosen-skill locked">' + s + '</span> '; });
        scHTML += '</div>';
        if (!actualSkl && actualRem <= 0) {
            scHTML += '<button class="btn-small btn-save" style="margin-bottom:8px;" onclick="LKSK()">🔒 Сохранить навыки</button>';
        }
    }
    if(skl&&rem===0)scHTML+='<p style="color:#52b758; margin-bottom:8px; font-size:0.9rem;">✅ Все навыки распределены и сохранены</p>';
    if(skl&&rem>0)scHTML+='<p style="color:#c97e2e; margin-bottom:8px; font-size:0.9rem;">⚠️ Свободные навыки ('+rem+')! <button class="btn-small btn-warn" onclick="ULSK()">Выбрать</button></p>';

    const sectionSkillsHTML = `
        ${scHTML}
        <div class="sheet-grid-skills">
            <div>
                <h3 style="margin-top:0;">🛡️ Спасброски</h3>
                <table><colgroup><col style="width:72%;"><col style="width:28%;"></colgroup><tr><th>Характеристика</th><th>Бонус</th></tr>${svHTML}</table>
                <div style="background:#181715; border:1px solid #36322b; padding:10px; border-radius:8px; margin-top:10px; font-size:0.92rem;">
                    👁️ <b>Пассивная Внимательность:</b> <span style="color:#e6c88c; font-weight:bold;">${pw}</span>
                </div>
            </div>
            <div>
                <h3 style="margin-top:0;">🎯 Навыки <small style="color:#888; font-weight:normal;">(● владение, ★ экспертность)</small></h3>
                <table><colgroup><col style="width:76%;"><col style="width:24%;"></colgroup><tr><th>Навык</th><th>Бонус</th></tr>${sHTML}</table>
            </div>
        </div>
    `;

    // --- БЛОК 3: ЧЕРТЫ И АРСЕНАЛ ---
    const sectionFeaturesHTML = `
        <div class="sheet-grid-2col">
            <div>
                <h3 style="margin-top:0;">⚔️ Сводка оружия и заклинаний</h3>
                ${GENERATE_SHEET_ATTACKS_SUMMARY(c)}
            </div>
            <div>
                <h3 style="margin-top:0;">🌟 Черты и Особенности расы</h3>
                <div style="background:#181715; border:1px solid #36322b; padding:10px 12px; border-radius:8px; margin-bottom:10px; font-size:0.92rem;">
                    <b style="color:#c9a96e;">Черты (Feats):</b> ${c.chosenFeats && c.chosenFeats.length > 0 ? c.chosenFeats.join(', ') : '<span style="color:#888;">Нет выбранных черт</span>'}
                </div>
                <div style="background:#181715; border:1px solid #36322b; padding:10px 12px; border-radius:8px; margin-bottom:10px; font-size:0.92rem;">
                    <b style="color:#c9a96e;">Особенности расы (${c.race || '—'}):</b><br>${GRT(c)}
                    ${rsp.length ? '<br><b style="color:#c9a96e;">Врождённые заклинания:</b> ' + rsp.join(', ') : ''}
                </div>
                <div style="background:#181715; border:1px solid #36322b; padding:10px 12px; border-radius:8px; font-size:0.92rem;">
                    <b style="color:#c9a96e;">Прочие способности:</b><br>${c.abilities || '<span style="color:#888;">Нет записей</span>'}
                </div>
            </div>
        </div>
    `;

    // --- БЛОК 4: ХАРАКТЕР И БИОГРАФИЯ ---
    let bt=[],bi=[],bb=[],bf=[];
    if(c.background&&gameData.backgrounds[c.background]){
        const bd=gameData.backgrounds[c.background];
        bt=bd.tr||[]; bi=bd.id||[]; bb=bd.bo||[]; bf=bd.fl||[];
    }
    let ao='<option value="">— Выберите или напишите своё —</option>';
    gameData.alignments.forEach(a=>{ao+='<option value="'+a+'"'+(c.alignment===a?' selected':'')+'>'+a+'</option>';});
    const alLock=c.alignmentLocked||false;

    const sectionBioHTML = `
        <div class="sheet-grid-2col">
            <div>
                <h3 style="margin-top:0;">🧭 Мировоззрение и Языки</h3>
                <table>
                    <colgroup><col style="width:38%;"><col style="width:62%;"></colgroup>
                    <tr><td>Мировоззрение</td><td>${alLock ? '<span class="locked-field">'+(c.alignment||'—')+'</span>' : '<select onchange="STV(\'alignment\',this.value)">'+ao+'</select><input type="text" value="'+(c.alignment||'')+'" onchange="STV(\'alignment\',this.value)" placeholder="Своё..." style="margin-top:4px;"><button class="btn-small btn-save" style="margin-top:4px; width:100%;" onclick="LKT(\'alignment\')">🔒 Сохранить</button>'}</td></tr>
                    <tr><td>Известные языки</td><td><b>${al.length ? al.join(', ') : '—'}</b></td></tr>
                    ${lch ? '<tr><td colspan="2">'+lch+'</td></tr>' : ''}
                </table>
                <h3>📖 Предыстория персонажа</h3>
                ${RSF(c)}
            </div>
            <div>
                <h3 style="margin-top:0;">🎭 Черты характера</h3>
                ${RTS('traits',c,bt)}
                <h3>⚖️ Идеалы</h3>
                ${RTS('ideals',c,bi)}
                <h3>🤝 Привязанности</h3>
                ${RTS('bonds',c,bb)}
                <h3>💔 Слабости</h3>
                ${RTS('flaws',c,bf)}
            </div>
        </div>
    `;

    // Сборка выбранной вкладки (или всего листа сразу при curTab === 'all')
    let finalBodyHTML = '';
    if (curTab === 'all') {
        finalBodyHTML = `
            ${sectionMainHTML}
            <hr style="border:none; border-top:1px solid #3d3830; margin:18px 0;">
            ${sectionSkillsHTML}
            <hr style="border:none; border-top:1px solid #3d3830; margin:18px 0;">
            ${sectionFeaturesHTML}
            <hr style="border:none; border-top:1px solid #3d3830; margin:18px 0;">
            ${sectionBioHTML}
        `;
    } else if (curTab === 'main') {
        finalBodyHTML = sectionMainHTML;
    } else if (curTab === 'skills') {
        finalBodyHTML = sectionSkillsHTML;
    } else if (curTab === 'features') {
        finalBodyHTML = sectionFeaturesHTML;
    } else if (curTab === 'bio') {
        finalBodyHTML = sectionBioHTML;
    }

    cont.innerHTML = '<h2>📋 Лист персонажа: ' + (c.name || 'Безымянный') + '</h2>' +
        topAlerts +
        tabsNavHTML +
        finalBodyHTML +
        '<div style="margin-top:16px; text-align:right; border-top:1px solid #3d3830; padding-top:12px;">' +
            '<button onclick="CCS()">Закрыть лист</button>' +
        '</div>';
    OM('char-sheet-modal');
}

// Переходные обёртки
function refreshMainCard() { RMC(); }
function openCharSheet() { OCS(); }
function openInventory() { OINV(); }
function openAttacks() { OAT(); }
function resetCharacter() { RST(); }
function startLongRest() { SLR(); }
function startShortRest() { SSR(); }
function editTasks() { EDT(); }
function saveTasks() { SVT(); }
function loadTasks() { LDT(); }
function getMessages() { return GMS(); }
function saveMessages(m) { SMS(m); }
function renderChat() { RCH(); }
function openModal(id) { OM(id); }
function closeModal(id) { CM(id); }

// ================================================================
// АТАКИ И ЗАКЛИНАНИЯ (НОВЫЙ УДОБНЫЙ ИНТЕРФЕЙС С ВКЛАДКАМИ И ТАБЛО)
// ================================================================
window._oatTab = 'weapons';         // 'all' | 'weapons' | 'spells' | 'notes'
window._spellFilterLv = 'all';  // 'all' | 0 | 1..9
window._lastCombatBanner = '';  // Текст последнего броска внутри окна

// Синхронизация ячеек Колдуна при смене уровня (чтобы потраченные ячейки 1 круга переносились на 2-5 круг)
function NORMALIZE_WARLOCK_SLOTS(c) {
    if (c.className !== 'Колдун') return;
    const maxSlots = GET_SPELL_SLOTS(c);
    if (!c.usedSpellSlots) c.usedSpellSlots = {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0};
    let activePactLv = 1;
    for (let i = 1; i <= 5; i++) {
        if (maxSlots[i] > 0) activePactLv = i;
    }
    let totalPactSpent = 0;
    for (let i = 1; i <= 5; i++) {
        totalPactSpent += (c.usedSpellSlots[i] || 0);
        c.usedSpellSlots[i] = 0;
    }
    c.usedSpellSlots[activePactLv] = Math.min(maxSlots[activePactLv] || 0, totalPactSpent);
}

// Чистая сводка для Листа Персонажа
function GENERATE_SHEET_ATTACKS_SUMMARY(c) {
    const pb = GPB(c.level || 1);
    const sm = GM(c.str || 10), dm = GM(c.dex || 10);
    let html = '<div style="background:#1a1a1a; padding:10px; border-radius:6px; font-size:0.85em; text-align:left; margin-bottom:8px;">';

    const weapons = (c.inventory || []).filter(i => i.isWeapon && i.equipped);
    html += '<div style="color:#c9a96e; font-weight:bold; margin-bottom:4px;">⚔️ Оружие:</div>';
    if (weapons.length > 0) {
        weapons.forEach(w => {
            const am = w.finesse ? Math.max(sm, dm) : (w.ranged ? dm : sm);
            html += `<div style="margin-left:8px; margin-bottom:2px;">• <b>${w.name}</b>: попадание <b>${MS(am + pb)}</b>, урон <b>${w.damage}${am ? MS(am) : ''}</b> (${w.damageType || 'обычный'})</div>`;
        });
    } else {
        const unarmedDmg = (c.chosenFeats && c.chosenFeats.includes('Драчун')) ? `1к4${MS(sm)}` : `${Math.max(1, 1 + sm)}`;
        html += `<div style="margin-left:8px; color:#aaa;">• Безоружный удар: попадание <b>${MS(sm + pb)}</b>, урон <b>${unarmedDmg}</b> (дробящий)</div>`;
    }

    const racial = RSP(c);
    const known = c.knownSpells || [];
    html += '<div style="color:#c9a96e; font-weight:bold; margin:8px 0 4px 0;">✨ Заклинания:</div>';
    if (racial.length === 0 && known.length === 0) {
        html += '<div style="margin-left:8px; color:#888;">Нет изученных заклинаний</div>';
    } else {
        if (racial.length > 0) {
            html += `<div style="margin-left:8px; margin-bottom:3px;"><span style="color:#aaa;">От расы:</span> ${racial.join(', ')}</div>`;
        }
        for (let lv = 0; lv <= 9; lv++) {
            const list = gameData.spells.filter(sp => sp.level === lv && known.includes(sp.name)).map(sp => sp.name);
            if (list.length > 0) {
                html += `<div style="margin-left:8px; margin-bottom:3px;"><span style="color:#aaa;">${lv === 0 ? 'Заговоры' : lv + ' круг'}:</span> ${list.join(', ')}</div>`;
            }
        }
    }
    html += '</div>';
    return html;
}

function LOG_COMBAT_TO_CHAT(actionText) {
    const c = GC()[PI];
    const sender = (c && c.name && c.name !== 'Мой персонаж') ? c.name : 'Игрок';
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const logs = GSYS();
    logs.push(`[${time}] ${sender}: ${actionText}`);
    if (logs.length > 100) logs.shift();
    SSYS(logs);
    if (window._chatTab !== 'sys') {
        window._unreadSysCount = (window._unreadSysCount || 0) + 1;
    }
    RCH();
}

function SET_COMBAT_BANNER(title, htmlText, borderColor = '#c9a96e') {
    window._lastCombatBanner = `
        <div style="background:#161b22; border-left:4px solid ${borderColor}; padding:10px 12px; border-radius:6px; margin-bottom:12px; text-align:left; font-size:0.9em; display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
            <div><div style="color:${borderColor}; font-weight:bold; margin-bottom:3px;">${title}</div><div>${htmlText}</div></div>
            <button class="btn-small" style="background:#333; color:#aaa; padding:2px 6px;" onclick="window._lastCombatBanner=''; OAT();">✕</button>
        </div>`;
}

function TOGGLE_COMBAT_MODE() {
    const cs = GC();
    const c = cs[PI];
    c.inCombat = !c.inCombat;
    SC(cs);
    if (c.inCombat) {
        CANCEL_REST_POLL_IF_COMBAT(c.name || 'Игрок');
    }
    CHECK_AND_RENDER_REST_POPUP();
    OAT();
}

function CHANGE_COMBAT_TARGET(val) {
    window._currentCombatTarget = val;
}

function SET_OAT_TAB(tab) {
    window._oatTab = tab;
    OAT();
}

function SET_SPELL_FILTER(lv) {
    window._spellFilterLv = lv;
    OAT();
}

function TOGGLE_SPELL_DESC(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = (el.style.display === 'none') ? 'block' : 'none';
}

// Ручное переключение ячейки заклинаний кликом по кружочку (потратить / восстановить)
function TOGGLE_MANUAL_SLOT(slotLv) {
    const cs = GC();
    const c = cs[PI];
    NORMALIZE_WARLOCK_SLOTS(c);
    const maxSlots = GET_SPELL_SLOTS(c);
    if (!c.usedSpellSlots) c.usedSpellSlots = {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0};
    const mx = maxSlots[slotLv] || 0;
    const us = c.usedSpellSlots[slotLv] || 0;
    if (mx <= 0) return;
    c.usedSpellSlots[slotLv] = (us < mx) ? (us + 1) : 0;
    SC(cs);
    RMC();
    OAT();
}

function GET_TARGET_LABEL() {
    const t = window._currentCombatTarget || 'enemy';
    const cs = GC();
    if (t === 'self') return (cs[PI] && cs[PI].name) ? cs[PI].name + ' (На себя)' : 'На себя';
    if (t.startsWith('party_')) {
        const idx = parseInt(t.replace('party_', ''));
        return (cs[idx] && cs[idx].name) ? cs[idx].name : 'Союзник';
    }
    return 'Противник';
}

// Автоматический подсчёт урона или лечения из текста описания заклинания
function PARSE_SPELL_DICE_FROM_DESC(desc) {
    if (!desc) return null;
    const match = desc.match(/(\d+к\d+(?:\s*\+\s*\d+)?)/i);
    return match ? match[1].replace(/\s+/g, '') : null;
}

function TRY_APPLY_SPELL_EFFECT_ON_CHAR(cs, caster, spellName, slotLevel, spellDesc) {
    const t = window._currentCombatTarget || 'enemy';
    let targetChar = null;
    if (t === 'self') targetChar = caster;
    else if (t.startsWith('party_')) {
        const idx = parseInt(t.replace('party_', ''));
        if (cs[idx]) targetChar = cs[idx];
    }
    const castStatMap = {'Волшебник':'intl', 'Жрец':'wis', 'Друид':'wis', 'Следопыт':'wis', 'Бард':'cha', 'Паладин':'cha', 'Колдун':'cha', 'Чародей':'cha'};
    const statKey = castStatMap[caster.className] || 'wis';
    const mod = GM(caster[statKey] || 10);

    // 1. Лечащие заклинания
    if (spellName.includes('Лечение ран') || spellName.includes('Лечащее слово') || spellName.includes('Массовое лечение ран')) {
        if (!targetChar) targetChar = caster;
        const diceCount = spellName.includes('Массовое') ? 3 : Math.max(1, slotLevel || 1);
        const healed = Math.max(1, ROLL(diceCount + 'к8') + mod);
        const oldHp = targetChar.hp || 0;
        targetChar.hp = Math.min((targetChar.maxHp || 10), oldHp + healed);
        return ` | 💚 Исцелено: <b>+${healed} ХП</b> (${targetChar.name}: ${targetChar.hp}/${targetChar.maxHp})`;
    }
    if (spellName === 'Доспех Агатиса') {
        const tempGain = 5 * Math.max(1, slotLevel || 1);
        caster.tempHP = Math.max(caster.tempHP || 0, tempGain);
        return ` | 🛡️ Получено <b>+${tempGain} врем. ХП</b>`;
    }
    if (spellName === 'Полное восстановление' || spellName === 'Массовое исцеление') {
        if (!targetChar) targetChar = caster;
        targetChar.hp = targetChar.maxHp || 10;
        return ` | 💚 ХП полностью восстановлены (${targetChar.hp}/${targetChar.maxHp})`;
    }

    // 2. Урон от боевых заклинаний (если в описании есть кубы урона вроде 8к6, 3к10, 1к10)
    const dmgFormula = PARSE_SPELL_DICE_FROM_DESC(spellDesc);
    if (dmgFormula && (spellDesc.includes('урон') || spellDesc.includes('некротик') || spellDesc.includes('огн') || spellDesc.includes('холод') || spellDesc.includes('молн') || spellDesc.includes('кислот') || spellDesc.includes('излучен') || spellDesc.includes('псих') || spellDesc.includes('гром') || spellDesc.includes('яд') || spellDesc.includes('стрел'))) {
        const rolledDmg = ROLL(dmgFormula);
        let dmgStr = ` | 💥 Бросок (${dmgFormula}): <b>${rolledDmg}</b>`;
        if (targetChar && (t === 'self' || t.startsWith('party_'))) {
            targetChar.hp = Math.max(0, (targetChar.hp || 0) - rolledDmg);
            dmgStr += ` (🩸 ${targetChar.name}: осталось ${targetChar.hp}/${targetChar.maxHp} ХП)`;
        }
        return dmgStr;
    }
    return '';
}

function CSP(sn) {
    const cs = GC();
    const c = cs[PI];
    if (!c.usedSpells) c.usedSpells = {};
    const cleanName = sn.replace(' (1/день)', '');
    const isCantrip = !sn.includes('/день');
    const spellAlias = { 'Танцующие огоньки': 'Пляшущие огоньки', 'Пламенные ладони': 'Огненные ладони', 'Палящая ладонь': 'Огненные ладони', 'Сон': 'Усыпление' };
    const lookupName = spellAlias[cleanName] || cleanName;
    const spObj = gameData.spells.find(x => x.name === lookupName);

    const isPeaceful = cleanName.includes('Леч') || cleanName.includes('Чудотворство') || cleanName.includes('Тауматургия') || cleanName.includes('Починка') || cleanName.includes('Маскировка') || cleanName.includes(' огоньки') || cleanName.includes('Обнаружение');
    if (!c.inCombat && !isPeaceful) {
        SET_COMBAT_BANNER('⚠️ Вы сейчас вне боя', 'Включите тумблер <b>«⚔️ В БОЮ»</b> в правом верхнем углу окна, чтобы использовать боевые способности.', '#c97e2e');
        OAT();
        return;
    }

    if (isCantrip) {
        const eff = TRY_APPLY_SPELL_EFFECT_ON_CHAR(cs, c, cleanName, 0, spObj ? spObj.desc : '');
        SC(cs); RMC();
        LOG_COMBAT_TO_CHAT(`использует «${cleanName}» (заговор) -> ${GET_TARGET_LABEL()}`);
        SET_COMBAT_BANNER(`✨ ${cleanName} (заговор)`, `🎯 Цель: <b>${GET_TARGET_LABEL()}</b>${eff}<br><small style="color:#aaa;">${spObj ? spObj.desc : ''}</small>`, '#38bdf8');
        OAT();
        return;
    }
    if (c.usedSpells[sn] || c.usedSpells[cleanName]) {
        SET_COMBAT_BANNER('Недоступно', `Способность «${cleanName}» уже потрачена сегодня (восстановится после длинного отдыха).`, '#e06060');
        OAT();
        return;
    }
    c.usedSpells[sn] = true;
    c.usedSpells[cleanName] = true;
    const effectHtml = TRY_APPLY_SPELL_EFFECT_ON_CHAR(cs, c, cleanName, 1, spObj ? spObj.desc : '');
    SC(cs);
    RMC();
    LOG_COMBAT_TO_CHAT(`использует «${cleanName}» (1/день) -> ${GET_TARGET_LABEL()}`);
    SET_COMBAT_BANNER(`✨ ${cleanName} (1/день)`, `🎯 Цель: <b>${GET_TARGET_LABEL()}</b>${effectHtml}<br><small style="color:#aaa;">${spObj ? spObj.desc : ''}</small>`, '#c084fc');
    OAT();
}

function USE_WEAPON(idx) {
    const cs = GC();
    const c = cs[PI];
    if (!c.inCombat) {
        SET_COMBAT_BANNER('⚠️ Вы сейчас вне боя', 'Нажмите кнопку <b>«⚔️ Начать бой»</b> сверху справа, чтобы атаковать оружием.', '#c97e2e');
        OAT();
        return;
    }
    const inv = c.inventory || [];
    const item = inv[idx];
    if (!item) return;
    
    const pb = GPB(c.level || 1);
    const sm = GM(c.str || 10), dm = GM(c.dex || 10);
    const am = item.finesse ? Math.max(sm, dm) : (item.ranged ? dm : sm);
    const attackRoll = Math.floor(Math.random() * 20) + 1;
    const attackTotal = attackRoll + am + pb;

    let dmgFormula = item.damage || '1к4';
    const hasShieldOrSecondWeapon = inv.filter(x => x.equipped && (x.isWeapon || x.isShield)).length > 1;
    if (item.properties && item.properties.includes('универсальное') && !hasShieldOrSecondWeapon) {
        const match = item.properties.match(/универсальное\s*\(([^)]+)\)/i);
        if (match && match[1]) dmgFormula = match[1];
    }

    const dmgRoll = Math.max(1, ROLL(dmgFormula) + am);
    const targetName = GET_TARGET_LABEL();

    const t = window._currentCombatTarget || 'enemy';
    let charDamageNote = '';
    if (t === 'self' || t.startsWith('party_')) {
        const targetChar = (t === 'self') ? c : cs[parseInt(t.replace('party_', ''))];
        if (targetChar) {
            targetChar.hp = Math.max(0, (targetChar.hp || 0) - dmgRoll);
            charDamageNote = ` | 🩸 Урон по <b>${targetChar.name}</b> (ХП: ${targetChar.hp}/${targetChar.maxHp})`;
        }
    }

    const critBadge = attackRoll === 20 ? ' <b style="color:#4caf50;">[КРИТ 20!]</b>' : (attackRoll === 1 ? ' <b style="color:#e06060;">[ПРОМАХ 1]</b>' : '');
    const rollLine = `🎯 Цель: <b>${targetName}</b> | 🎲 Попадание: ${attackRoll}${MS(am+pb)} = <b>${attackTotal}</b>${critBadge} | 💥 Урон: <b>${dmgRoll}</b> (${item.damageType || 'обычный'})${charDamageNote}`;

    const isThrown = item.properties && item.properties.includes('метательное');
    const isAmmo = item.properties && item.properties.includes('боеприпасы');

    if (isThrown && !item.consumable) {
        const throwIt = confirm('Метнуть «' + item.name + '» (ОК — предмет потратится) или ударить в ближнем бою (Отмена)?');
        if (throwIt) {
            if (item.qty && parseInt(item.qty) > 1) item.qty = String(parseInt(item.qty) - 1);
            else inv.splice(idx, 1);
        }
    } else if (isAmmo) {
        const ammoIdx = inv.findIndex(x => {
            const n = (x.name || '').toLowerCase();
            return (n.includes('стрел') || n.includes('болт') || n.includes('снаряд') || n.includes('камн')) && (parseInt(x.qty) || 0) > 0;
        });
        if (ammoIdx !== -1) {
            const ammoItem = inv[ammoIdx];
            if (parseInt(ammoItem.qty) > 1) ammoItem.qty = String(parseInt(ammoItem.qty) - 1);
            else inv.splice(ammoIdx, 1);
        }
    } else if (item.consumable) {
        if (item.qty && parseInt(item.qty) > 1) item.qty = String(parseInt(item.qty) - 1);
        else inv.splice(idx, 1);
    }

    SC(cs); RMC();
    LOG_COMBAT_TO_CHAT(`атакует («${item.name}») -> ${targetName} | Попадание: ${attackTotal} | Урон: ${dmgRoll}`);
    SET_COMBAT_BANNER(`⚔️ Атака: ${item.name}`, rollLine, '#4caf50');
    OAT();
}

function EXECUTE_UNARMED() {
    const cs = GC();
    const c = cs[PI];
    if (!c.inCombat) {
        SET_COMBAT_BANNER('⚠️ Вы сейчас вне боя', 'Нажмите кнопку <b>«⚔️ Начать бой»</b> сверху справа, чтобы наносить удары.', '#c97e2e');
        OAT();
        return;
    }
    const pb = GPB(c.level || 1);
    const sm = GM(c.str || 10);
    const roll = Math.floor(Math.random() * 20) + 1;
    const totalAtk = roll + sm + pb;
    const dmg = (c.chosenFeats && c.chosenFeats.includes('Драчун')) ? Math.max(1, Math.floor(Math.random() * 4) + 1 + sm) : Math.max(1, 1 + sm);
    const targetName = GET_TARGET_LABEL();

    LOG_COMBAT_TO_CHAT(`безоружный удар по ${targetName} | Попадание: ${totalAtk} | Урон: ${dmg}`);
    SET_COMBAT_BANNER('👊 Безоружный удар', `🎯 Цель: <b>${targetName}</b> | 🎲 Попадание: ${roll}${MS(sm+pb)} = <b>${totalAtk}</b> | 💥 Урон: <b>${dmg}</b> (дробящий)`, '#4caf50');
    OAT();
}

function CAST_SPELL(spellName) {
    const cs = GC();
    const c = cs[PI];
    NORMALIZE_WARLOCK_SLOTS(c);
    const spell = gameData.spells.find(s => s.name === spellName);
    if (!spell) return;
    const level = spell.level || 0;

    const isPeacefulAllowed = spellName.includes('Леч') || spellName.includes('Восстановление') || spellName.includes('Починка') || spellName.includes('Маскировка') || spellName.includes('Дружба') || spellName.includes('Сообщение') || spellName.includes('Тауматургия') || spellName.includes('Чудотворство') || spellName.includes('Доспех мага') || spellName.includes('Тёмное зрение') || spellName.includes('Обнаружение') || spellName.includes('Невидимость') || spellName.includes('Полёт') || spellName.includes('Полет');
    if (!c.inCombat && !isPeacefulAllowed) {
        SET_COMBAT_BANNER('⚠️ Вы сейчас вне боя', `Боевое заклинание «<b>${spellName}</b>» требует режима боя. Нажмите кнопку <b>«⚔️ Начать бой»</b> сверху справа.`, '#c97e2e');
        OAT();
        return;
    }

    const pb = GPB(c.level || 1);
    const castStatMap = {'Волшебник':'intl', 'Жрец':'wis', 'Друид':'wis', 'Следопыт':'wis', 'Бард':'cha', 'Паладин':'cha', 'Колдун':'cha', 'Чародей':'cha'};
    const statKey = castStatMap[c.className] || 'intl';
    const mod = GM(c[statKey] || 10);
    const spellDC = 8 + pb + mod;
    const spellAtkRoll = Math.floor(Math.random() * 20) + 1;
    const spellAtkTotal = spellAtkRoll + pb + mod;
    const targetName = GET_TARGET_LABEL();

    if (level === 0) {
        const eff = TRY_APPLY_SPELL_EFFECT_ON_CHAR(cs, c, spellName, 0, spell.desc);
        SC(cs); RMC();
        LOG_COMBAT_TO_CHAT(`колдует заговор «${spellName}» -> ${targetName} (Атака: ${spellAtkTotal}, Сл: ${spellDC})`);
        SET_COMBAT_BANNER(`✨ ${spellName} (заговор)`, `🎯 Цель: <b>${targetName}</b> | 🎲 Атака заклинанием: <b>${spellAtkTotal}</b> (Сл спасброска: <b>${spellDC}</b>)${eff}<br><small style="color:#aaa;">${spell.desc || ''}</small>`, '#38bdf8');
        OAT();
        return;
    }

    const maxSlots = GET_SPELL_SLOTS(c);
    if (!c.usedSpellSlots) c.usedSpellSlots = {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0};
    const usedSlots = c.usedSpellSlots;

    let targetSlotLevel = level;
    if (c.className === 'Колдун' && level <= 5) {
        for (let i = 5; i >= 1; i--) {
            if (maxSlots[i] > 0) {
                targetSlotLevel = i;
                break;
            }
        }
    }

    const available = (maxSlots[targetSlotLevel] || 0) - (usedSlots[targetSlotLevel] || 0);
    if (available <= 0) {
        if (level === 1 && c.chosenFeats && c.chosenFeats.includes('Зачинатель магии')) {
            if (!c.usedSpells) c.usedSpells = {};
            if (!c.usedSpells[spellName]) {
                c.usedSpells[spellName] = true;
                const eff = TRY_APPLY_SPELL_EFFECT_ON_CHAR(cs, c, spellName, 1, spell.desc);
                SC(cs); RMC();
                LOG_COMBAT_TO_CHAT(`колдует «${spellName}» (1/день от Черты) -> ${targetName}`);
                SET_COMBAT_BANNER(`✨ ${spellName} (Черта 1/день)`, `🎯 Цель: <b>${targetName}</b> | 🎲 Атака: <b>${spellAtkTotal}</b> (Сл: <b>${spellDC}</b>)${eff}<br><small style="color:#aaa;">${spell.desc || ''}</small>`, '#c084fc');
                OAT();
                return;
            }
        }
        SET_COMBAT_BANNER('❌ Недостаточно ячеек', `Все ячейки ${targetSlotLevel}-го круга потрачены! Используйте Короткий отдых (для Колдуна) или Длинный отдых.`, '#e06060');
        OAT();
        return;
    }

    usedSlots[targetSlotLevel] = (usedSlots[targetSlotLevel] || 0) + 1;
    const effectHtml = TRY_APPLY_SPELL_EFFECT_ON_CHAR(cs, c, spellName, targetSlotLevel, spell.desc);
    SC(cs);
    RMC();
    
    let castText = level + '-й круг';
    if (targetSlotLevel !== level) castText += ' (ячейкой Договора ' + targetSlotLevel + '-го круга)';
    
    LOG_COMBAT_TO_CHAT(`колдует «${spellName}» (${castText}) -> ${targetName} (Атака: ${spellAtkTotal}, Сл: ${spellDC})`);
    SET_COMBAT_BANNER(`✨ ${spellName} — ${castText}`, `🎯 Цель: <b>${targetName}</b> | 🎲 Атака: <b>${spellAtkTotal}</b> | 🛡️ Сл спасброска: <b>${spellDC}</b>${effectHtml}<br><small style="color:#aaa;">${spell.desc || ''}</small>`, '#c084fc');
    OAT();
}

function OAT() {
    const cs = GC();
    const c = cs[PI];
    NORMALIZE_WARLOCK_SLOTS(c);
    const cont = document.getElementById('attacks-content');
    const pb = GPB(c.level || 1);
    const sm = GM(c.str || 10), dm = GM(c.dex || 10);

    const castStatMap = {'Волшебник':'intl', 'Жрец':'wis', 'Друид':'wis', 'Следопыт':'wis', 'Бард':'cha', 'Паладин':'cha', 'Колдун':'cha', 'Чародей':'cha'};
    const statKey = castStatMap[c.className] || 'intl';
    const castMod = GM(c[statKey] || 10);
    const spellDC = 8 + pb + castMod;
    const spellAtk = pb + castMod;

    // Компактная информационная шапка справочника + кнопка быстрого перехода к бою
    const topBarHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; background:#181715; padding:10px 14px; border-radius:8px; border:1px solid #423c33; margin-bottom:12px;">
            <div style="font-size:0.9rem; color:#ccc;">
                🔮 Сл спасброска магии: <b style="color:#e6c88c;">${spellDC}</b> &nbsp;|&nbsp; 🎯 Бонус маг. атаки: <b style="color:#52b758;">${MS(spellAtk)}</b>
            </div>
            <button class="btn-small btn-danger" onclick="CM('attacks-modal'); OPEN_AMBUSH_MODAL();">
                🗡️ Напасть / Завязать бой на карте
            </button>
        </div>
    `;

    // Интерактивная панель Ячеек Заклинаний
    const maxSlots = GET_SPELL_SLOTS(c);
    const usedSlots = c.usedSpellSlots || (c.usedSpellSlots = {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0});
    let slotsBarHTML = '';
    const hasAnySlots = Object.values(maxSlots).some(v => v > 0);
    if (hasAnySlots) {
        let pillsGroups = '';
        for (let i = 1; i <= 9; i++) {
            if (!maxSlots[i]) continue;
            const mx = maxSlots[i], us = usedSlots[i] || 0;
            const isWarlockPact = (c.className === 'Колдун' && i <= 5);
            const label = isWarlockPact ? `Договор (${i} кр.)` : (c.className === 'Колдун' ? `Арканум ${i} кр.` : `${i} круг`);
            let dots = '';
            for (let j = 0; j < mx; j++) {
                const spent = j < us;
                const color = spent ? '#333' : (isWarlockPact ? '#c084fc' : '#38bdf8');
                dots += `<span style="display:inline-block; width:12px; height:12px; border-radius:3px; background:${color}; border:1px solid #888; margin-left:3px;"></span>`;
            }
            pillsGroups += `<div onclick="TOGGLE_MANUAL_SLOT(${i})" title="Нажмите, чтобы вручную потратить/восстановить ячейку" style="background:#252525; border:1px solid #444; padding:4px 8px; border-radius:5px; cursor:pointer; font-size:0.8em; display:flex; align-items:center; gap:4px;">` +
                           `<span style="color:#ccc;">${label}: <b>${mx - us}/${mx}</b></span>${dots}</div>`;
        }
        slotsBarHTML = `<div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px; align-items:center;">` +
                       `<span style="font-size:0.8em; color:#888;">💎 Ячейки:</span>${pillsGroups}</div>`;
    }

    const tab = window._oatTab || 'all';
    const tabBtnStyle = (t) => `padding:6px 12px; font-size:0.85em; border-radius:6px; background:${tab===t?'#c9a96e':'#333'}; color:${tab===t?'#1a1a1a':'#ccc'};`;
    const tabsHTML = `
        <div style="display:flex; gap:6px; margin-bottom:12px; border-bottom:1px solid #444; padding-bottom:8px; flex-wrap:wrap;">
            <button style="${tabBtnStyle('all')}" onclick="SET_OAT_TAB('all')">📋 Всё сразу</button>
            <button style="${tabBtnStyle('weapons')}" onclick="SET_OAT_TAB('weapons')">⚔️ Оружие</button>
            <button style="${tabBtnStyle('spells')}" onclick="SET_OAT_TAB('spells')">✨ Заклинания</button>
            <button style="${tabBtnStyle('notes')}" onclick="SET_OAT_TAB('notes')">📝 Заметки</button>
        </div>
    `;

    let weaponsSectionHTML = '';
    if (tab === 'all' || tab === 'weapons') {
        let wRows = '';
        const hasShieldOrSecondWeapon = (c.inventory || []).filter(x => x.equipped && (x.isWeapon || x.isShield)).length > 1;
        if (c.inventory) {
            c.inventory.forEach((i) => {
                if (i.isWeapon && i.equipped) {
                    const am = i.finesse ? Math.max(sm, dm) : (i.ranged ? dm : sm);
                    let dmgDisplay = i.damage || '1к4';
                    if (i.properties && i.properties.includes('универсальное') && !hasShieldOrSecondWeapon) {
                        const m = i.properties.match(/универсальное\s*\(([^)]+)\)/i);
                        if (m && m[1]) dmgDisplay = m[1] + ' (2р)';
                    }
                    wRows += `
                        <div class="spell-item" style="padding:8px 12px;">
                            <div style="text-align:left;">
                                <b>${i.icon || '⚔️'} ${i.name}</b> <small style="color:#888;">(${i.properties || 'одноручное'})</small><br>
                                <small style="color:#aaa;">Попадание: <b style="color:#4caf50;">${MS(am + pb)}</b> | Урон: <b style="color:#e0e0e0;">${dmgDisplay}${am>=0?'+'+am:am}</b> ${i.damageType || ''}</small>
                            </div>
                        </div>`;
                }
            });
        }
        const unarmedDmg = (c.chosenFeats && c.chosenFeats.includes('Драчун')) ? `1к4${MS(sm)}` : `${Math.max(1, 1 + sm)}`;
        wRows += `
            <div class="spell-item" style="padding:8px 12px;">
                <div style="text-align:left;">
                    <b>👊 Безоружный удар</b><br>
                    <small style="color:#aaa;">Попадание: <b style="color:#4caf50;">${MS(sm + pb)}</b> | Урон: <b style="color:#e0e0e0;">${unarmedDmg}</b> дробящий</small>
                </div>
            </div>`;
        weaponsSectionHTML = `<div style="margin-bottom:14px;"><h3 style="margin-top:0;">⚔️ Экипированное оружие</h3>${wRows}</div>`;
    }

    let spellsSectionHTML = '';
    if (tab === 'all' || tab === 'spells') {
        const rs = RSP(c);
        const knownList = c.knownSpells || [];
        const classSpells = gameData.spells.filter(sp => sp.level <= 9 && knownList.includes(sp.name));

        const availableCircles = [];
        for (let lv = 0; lv <= 9; lv++) {
            if (classSpells.some(sp => sp.level === lv)) availableCircles.push(lv);
        }

        let filterPills = '';
        if (availableCircles.length > 1) {
            const curF = window._spellFilterLv;
            const fStyle = (v) => `padding:3px 9px; font-size:0.75em; border-radius:12px; background:${curF===v?'#4a90d9':'#333'}; color:#fff;`;
            filterPills += `<div style="display:flex; gap:4px; flex-wrap:wrap; margin-bottom:8px;">` +
                           `<button style="${fStyle('all')}" onclick="SET_SPELL_FILTER('all')">Все</button>`;
            availableCircles.forEach(lv => {
                filterPills += `<button style="${fStyle(lv)}" onclick="SET_SPELL_FILTER(${lv})">${lv === 0 ? 'Заговоры' : lv + ' круг'}</button>`;
            });
            filterPills += `</div>`;
        }

        let sListHTML = '';
        if (rs.length > 0 && window._spellFilterLv === 'all') {
            sListHTML += `<div style="color:#c9a96e; font-size:0.85em; font-weight:bold; margin:6px 0 4px 0;">Врождённые (от расы):</div>`;
            rs.forEach((s, rIdx) => {
                const cleanName = s.replace(' (1/день)', '');
                const spObj = gameData.spells.find(x => x.name === cleanName);
                const descId = 'racial_desc_' + rIdx;
                sListHTML += `
                    <div class="spell-item" style="flex-direction:column; align-items:stretch; padding:7px 10px;">
                        <div onclick="TOGGLE_SPELL_DESC('${descId}')" style="cursor:pointer; text-align:left;">
                            <b>${s}</b> <small style="color:#888;">${spObj ? `[${spObj.time} | ${spObj.range}] ▾` : ''}</small>
                        </div>
                        ${spObj ? `<div id="${descId}" style="display:none; text-align:left; color:#aaa; font-size:0.85em; margin-top:5px; padding-top:4px; border-top:1px dashed #444;">${spObj.desc}</div>` : ''}
                    </div>`;
            });
        }

        for (let lv = 0; lv <= 9; lv++) {
            if (window._spellFilterLv !== 'all' && window._spellFilterLv !== lv) continue;
            const spellsOfLevel = classSpells.filter(sp => sp.level === lv);
            if (spellsOfLevel.length === 0) continue;

            sListHTML += `<div style="color:#c9a96e; font-size:0.85em; font-weight:bold; margin:8px 0 4px 0;">${lv === 0 ? 'Заговоры' : lv + '-й круг'}:</div>`;

            spellsOfLevel.forEach((sp, sIdx) => {
                const descId = `sp_desc_${lv}_${sIdx}`;
                const isPeaceful = sp.name.includes('Леч') || sp.name.includes('Восстановление') || sp.name.includes('Починка') || sp.name.includes('Маскировка') || sp.name.includes('Дружба') || sp.name.includes('Доспех');
                sListHTML += `
                    <div class="spell-item" style="flex-direction:column; align-items:stretch; padding:7px 10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; gap:8px;">
                            <div onclick="TOGGLE_SPELL_DESC('${descId}')" style="cursor:pointer; text-align:left; flex:1;">
                                <b>${sp.name}</b> <small style="color:#888;">[${sp.time} • ${sp.range}]</small> <small style="color:#c9a96e;">▾</small>
                            </div>
                            ${isPeaceful ? `<button class="btn-cast" style="padding:4px 10px;" onclick="CAST_SPELL('${sp.name}')">Применить</button>` : `<span style="color:#777; font-size:0.78em;">Боевое (на панели боя)</span>`}
                        </div>
                        <div id="${descId}" style="display:none; text-align:left; color:#aaa; font-size:0.85em; margin-top:5px; padding-top:4px; border-top:1px dashed #444;">
                            ${sp.desc} <span style="color:#666;">(${sp.school}, длит.: ${sp.duration})</span>
                        </div>
                    </div>`;
            });
        }

        if (!sListHTML) {
            sListHTML = `<p style="color:#888; font-size:0.9em;">Нет изученных заклинаний</p>`;
        }

        spellsSectionHTML = `<div style="margin-bottom:14px;"><h3 style="margin-top:0;">✨ Книга заклинаний <small style="color:#888; font-weight:normal; font-size:0.75em;">(нажмите на название для описания)</small></h3>${filterPills}${sListHTML}</div>`;
    }

    let notesSectionHTML = '';
    if (tab === 'all' || tab === 'notes') {
        notesSectionHTML = `<div><h3 style="margin-top:0;">📝 Боевые заметки</h3><textarea onchange="UCF('attacks',this.value)" placeholder="Запишите сюда комбо, баффы или особенности..." style="min-height:60px;">${c.attacks || ''}</textarea></div>`;
    }

    cont.innerHTML = '<h2>📖 Справочник атак и заклинаний</h2>' +
        topBarHTML +
        (window._lastCombatBanner || '') +
        slotsBarHTML +
        tabsHTML +
        weaponsSectionHTML +
        spellsSectionHTML +
        notesSectionHTML +
        '<br><button onclick="CM(\'attacks-modal\')">Закрыть</button>';
    OM('attacks-modal');
}

// ================================================================
// РЮКЗАК (ИНВЕНТАРЬ) — ЧИСТЫЙ ИНТЕРФЕЙС БЕЗ ЛИШНИХ ПАНЕЛЕЙ (ДЕЙСТВИЯ ЧЕРЕЗ ПКМ)
// ================================================================
let ctxItem = null;
let splitItemIdx = null;
window._invFilter = 'all'; // 'all' | 'weapon' | 'armor' | 'potion' | 'misc'

// Поиск в базе предметов, нечувствительный к регистру и букве «ё»
function FIND_CATALOG_ITEM(searchName) {
    if (!searchName || !gameData.items || !gameData.items.catalog) return null;
    const norm = (str) => (str || '').toLowerCase().replace(/ё/g, 'е').trim();
    const target = norm(searchName);
    return gameData.items.catalog.find(item => norm(item.name) === target) || null;
}

function SET_INV_FILTER(f) {
    window._invFilter = f;
    OINV();
}

// Складывает одинаковые неэкипированные предметы в одну стопку
function STACK_IDENTICAL_ITEMS() {
    const cs = GC();
    const c = cs[PI];
    if (!c.inventory || c.inventory.length < 2) return;
    const norm = (s) => (s || '').toLowerCase().replace(/ё/g, 'е').trim();
    const merged = [];
    c.inventory.forEach(item => {
        if (item.equipped) {
            merged.push(item);
            return;
        }
        const key = norm(item.name);
        const existing = merged.find(m => !m.equipped && norm(m.name) === key);
        if (existing) {
            existing.qty = String((parseInt(existing.qty) || 1) + (parseInt(item.qty) || 1));
        } else {
            merged.push(item);
        }
    });
    c.inventory = merged;
    SC(cs);
    RMC();
    OINV();
}

function OINV() {
    const cs = GC();
    const c = cs[PI];
    if (!c.inventory) c.inventory = [];
    if (!c.money) c.money = {gp:0, sp:0, cp:0};
    const inv = c.inventory;
    const cont = document.getElementById('inventory-content');
    const eq = inv.filter(i => i.equipped);
    const curFilter = window._invFilter || 'all';

    // Подсчёт общего богатства в золоте по курсу D&D (1 зм = 10 см = 100 мм)
    const gp = parseInt(c.money.gp) || 0;
    const sp = parseInt(c.money.sp) || 0;
    const cp = parseInt(c.money.cp) || 0;
    const totalInGold = Math.round((gp + sp / 10 + cp / 100) * 100) / 100;

    // 1. Секция Экипировки + подсчёт занятых рук
    let usedHands = 0;
    eq.forEach(item => {
        const t = GET_ITEM_TYPE(item);
        if (t === 'weapon' || t === 'shield') {
            const ip = (item.properties || '').toLowerCase().replace(/ё/g, 'е');
            const is2H = ip.includes('двуручное') || (ip.includes('тяжелое') && !ip.includes('универсальное'));
            usedHands += is2H ? 2 : 1;
        }
    });

    let eh = '';
    eq.forEach(i => {
        const idx = inv.indexOf(i);
        eh += `<div class="inv-slot equipped" title="ПКМ — меню действий" oncontextmenu="event.preventDefault();SCM(event,${idx});">` +
              `<span class="item-icon">${i.icon || '📦'}</span>` +
              `<span class="item-name">${i.name}</span>` +
              (i.qty && parseInt(i.qty) > 1 ? `<span class="item-qty">×${i.qty}</span>` : '') +
              `</div>`;
    });

    // 2. Секция Вещей в рюкзаке (с учётом фильтра)
    let uh = '';
    const uq = inv.filter(i => {
        if (i.equipped) return false;
        if (curFilter === 'all') return true;
        const t = GET_ITEM_TYPE(i);
        if (curFilter === 'armor') return (t === 'armor' || t === 'shield' || t === 'accessory');
        if (curFilter === 'misc') return (t === 'misc' || t === 'scroll' || t === 'tool');
        return t === curFilter;
    });

    uq.forEach(i => {
        const idx = inv.indexOf(i);
        uh += `<div class="inv-slot" title="ПКМ — меню действий" oncontextmenu="event.preventDefault();SCM(event,${idx});">` +
              `<span class="item-icon">${i.icon || '📦'}</span>` +
              `<span class="item-name">${i.name}</span>` +
              (i.qty && parseInt(i.qty) > 1 ? `<span class="item-qty">×${i.qty}</span>` : '') +
              `</div>`;
    });

    let em = '';
    if (curFilter === 'all') {
        const emptySlotsCount = Math.max(2, 15 - uq.length);
        for (let i = 0; i < emptySlotsCount; i++) {
            em += '<div class="inv-slot empty" title="Нажмите, чтобы перейти к добавлению предмета" onclick="AIS()">+</div>';
        }
    }

    // 3. Полоска веса и грузоподъёмности
    const cap = CC(c), iw = IW(c);
    const pct = Math.min(100, Math.round((iw / Math.max(1, cap)) * 100));
    const isOverweight = iw > cap;
    const barColor = isOverweight ? '#e06060' : (pct > 75 ? '#c97e2e' : '#4caf50');
    const hasBag = inv.some(i => (i.name || '').toLowerCase().replace(/ё/g, 'е').includes('мешок хранения'));

    const weightBarHTML = `
        <div class="carry-info" style="margin:12px 0;">
            <div style="display:flex; justify-content:space-between; font-size:0.9em; margin-bottom:4px;">
                <span>🏋️ <b>Вес снаряжения:</b> ${hasBag ? '<small style="color:#c084fc;">(с Мешком хранения +500 фнт)</small>' : ''}</span>
                <span style="${isOverweight ? 'color:#e06060;font-weight:bold;' : 'color:#ccc;'}">
                    ${iw} / ${cap} фнт (${LKG(iw)} / ${LKG(cap)} кг) ${isOverweight ? '⚠️ ПЕРЕГРУЗ!' : ''}
                </span>
            </div>
            <div style="width:100%; height:8px; background:#1a1a1a; border-radius:4px; overflow:hidden; border:1px solid #444;">
                <div style="width:${pct}%; height:100%; background:${barColor}; transition:width 0.25s;"></div>
            </div>
        </div>
    `;

    // 4. Кнопки фильтрации категорий
    const fBtn = (code, label) => `<button class="btn-small" style="background:${curFilter===code?'#c9a96e':'#333'}; color:${curFilter===code?'#1a1a1a':'#ccc'};" onclick="SET_INV_FILTER('${code}')">${label}</button>`;
    const filterBarHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:6px; margin-bottom:8px;">
            <div style="display:flex; gap:5px; flex-wrap:wrap;">
                ${fBtn('all', '📦 Все (' + inv.filter(x=>!x.equipped).length + ')')}
                ${fBtn('weapon', '⚔️ Оружие')}
                ${fBtn('armor', '🛡️ Защита и Кольца')}
                ${fBtn('potion', '🧪 Зелья')}
                ${fBtn('misc', '🔧 Снаряжение')}
            </div>
            <button class="btn-small" style="background:#3a3a3a;" title="Объединить одинаковые предметы в одну пачку" onclick="STACK_IDENTICAL_ITEMS()">🔗 Сложить одинаковые</button>
        </div>
    `;

    // 5. Автозаполнение (datalist) всех предметов из базы D&D
    let datalistOptions = '';
    if (gameData.items && gameData.items.catalog) {
        gameData.items.catalog.forEach(item => {
            const extra = item.damage ? ` (${item.damage})` : (item.ac ? ` (КБ ${item.ac})` : (item.heal ? ` (${item.heal})` : ''));
            datalistOptions += `<option value="${item.name}">${item.name}${extra} — ${item.price || ''}</option>`;
        });
    }

    cont.innerHTML = '<h2>🎒 Рюкзак</h2>' +
        // Кошелёк
        '<div class="money-row" style="align-items:center;">' +
            '<div class="money-item"><div class="coin-icon">🪙</div><div>Золотые (зм)</div><input type="number" min="0" value="'+gp+'" onchange="UMY(\'gp\',parseInt(this.value))"></div>' +
            '<div class="money-item"><div class="coin-icon">🥈</div><div>Серебряные (см)</div><input type="number" min="0" value="'+sp+'" onchange="UMY(\'sp\',parseInt(this.value))"></div>' +
            '<div class="money-item"><div class="coin-icon">🥉</div><div>Медные (мм)</div><input type="number" min="0" value="'+cp+'" onchange="UMY(\'cp\',parseInt(this.value))"></div>' +
            '<div style="font-size:0.8em; color:#c9a96e; padding:4px 8px;">Всего в золоте:<br><b style="font-size:1.15em;">≈ ' + totalInGold + ' зм</b></div>' +
        '</div>' +
        weightBarHTML +
        // Экипировано
        '<div class="inv-section">' +
            '<h3 style="display:flex; justify-content:space-between; align-items:center;">' +
                '<span>⚔️ Экипировано на персонаже</span>' +
                '<small style="color:#aaa; font-weight:normal;">Занято рук: <b>' + usedHands + ' / 2</b> | КБ: <b>' + CAC(c) + '</b></small>' +
            '</h3>' +
            (eq.length ? '<div class="inventory-grid">'+eh+'</div>' : '<p style="color:#777; font-size:0.85em; margin:4px 0 10px 0;">Ничего не экипировано (нажмите ПКМ по предмету ниже -> «Экипировать»).</p>') +
        '</div>' +
        // Сетка вещей
        '<div class="inv-section">' +
            '<h3>📦 Содержимое рюкзака <small style="color:#888;font-weight:normal;">(ПКМ по предмету — меню действий и информация)</small></h3>' +
            filterBarHTML +
            '<div class="inventory-grid">'+uh+em+'</div>' +
        '</div>' +
        // Панель добавления предмета с поиском по базе D&D
        '<div style="background:#1f1f1f; padding:10px; border-radius:6px; border:1px solid #444; margin-top:12px;">' +
            '<div style="color:#c9a96e; font-size:0.85em; font-weight:bold; margin-bottom:6px;">➕ Добавить предмет (выберите из базы D&D или впишите свой):</div>' +
            '<datalist id="dnd-items-datalist">' + datalistOptions + '</datalist>' +
            '<div style="display:flex;gap:5px;flex-wrap:wrap;">' +
                '<input type="text" id="new-item-name" list="dnd-items-datalist" oninput="AUTOFILL_ITEM_FROM_DB(this.value)" placeholder="Начните вводить (напр. Длинный меч, Зелье...)" style="flex:2;min-width:180px;">' +
                '<input type="number" id="new-item-qty" min="1" value="1" placeholder="Кол-во" style="width:65px;">' +
                '<input type="number" step="0.1" id="new-item-weight" placeholder="Вес(фнт)" style="width:80px;">' +
                '<input type="text" id="new-item-desc" placeholder="Описание (для своих вещей)" style="flex:2;min-width:140px;">' +
                '<button class="btn-save" onclick="ADDITEM()">+ В рюкзак</button>' +
            '</div>' +
        '</div>' +
        '<br><button onclick="CM(\'inventory-modal\')">Закрыть</button>';

    OM('inventory-modal');
}

function AUTOFILL_ITEM_FROM_DB(val) {
    const tpl = FIND_CATALOG_ITEM(val);
    if (!tpl) return;
    const wInp = document.getElementById('new-item-weight');
    const dInp = document.getElementById('new-item-desc');
    if (wInp) wInp.value = tpl.weight !== undefined ? tpl.weight : '';
    if (dInp) dInp.value = tpl.description || '';
}

function UMY(coin, val) {
    const cs = GC();
    const c = cs[PI];
    if (!c.money) c.money = {gp:0, sp:0, cp:0};
    c.money[coin] = Math.max(0, val || 0);
    SC(cs);
    OINV();
}

function SCM(e, idx) {
    e.preventDefault();
    e.stopPropagation();
    const menu = document.getElementById('context-menu');
    ctxItem = idx;
    const cs = GC();
    const c = cs[PI];
    const i = c.inventory[idx];
    if (!i) return;
    
    const itemType = GET_ITEM_TYPE(i);
    let h = '';
    
    h += '<button onclick="CA(\'info\')">📋 Информация</button>';

    if (i.qty && parseInt(i.qty) > 1 && !i.equipped) {
        h += '<button onclick="SHOW_SPLIT(' + idx + ')">✂️ Разделить</button>';
    }
    
    if (itemType === 'weapon' || itemType === 'armor' || itemType === 'shield' || itemType === 'accessory') {
        h += '<button onclick="CA(\'equip\')">' + (i.equipped ? '🔽 Снять' : '⚔️ Экипировать') + '</button>';
    } 
    
    if (itemType === 'potion') {
        h += '<button onclick="CA(\'use\')">🧪 Использовать</button>';
    }
    
    if (itemType === 'scroll') {
        h += '<button onclick="CA(\'read\')">📜 Прочитать</button>';
    }

    if (itemType === 'tool') {
        h += '<button onclick="CA(\'tool\')">🔧 Использовать инструмент</button>';
    }
    
    if (itemType === 'misc') {
        if (!i.isWeapon) h += '<button onclick="CA(\'weapon\')">⚔️ Сделать оружием</button>';
        if (!i.isShield) h += '<button onclick="CA(\'shield\')">🛡️ Сделать щитом</button>';
        if (!i.ac) h += '<button onclick="CA(\'armor\')">🛡️ Сделать доспехом</button>';
    }
    
    h += '<button onclick="CA(\'edit\')">✏️ Редактировать</button>';
    h += '<button onclick="CA(\'remove\')" style="color:#e06060;">🗑️ Удалить</button>';
    
    menu.innerHTML = h;
    menu.style.display = 'block';
    
    let menuX = e.clientX;
    let menuY = e.clientY;
    if (menuX + 200 > window.innerWidth) menuX = window.innerWidth - 210;
    if (menuY + menu.offsetHeight > window.innerHeight) menuY = window.innerHeight - menu.offsetHeight - 10;
    
    menu.style.left = menuX + 'px';
    menu.style.top = menuY + 'px';
    
    setTimeout(() => document.addEventListener('click', HCM, { once: true }), 10);
}

function APPLY_HEAL(c, amount) {
    const current = c.hp || 0;
    const max = c.maxHp || 1;
    const temp = c.tempHP || 0;
    if (current < max) {
        const room = max - current;
        const healToHp = Math.min(amount, room);
        c.hp = current + healToHp;
        amount -= healToHp;
    }
    if (amount > 0) {
        c.tempHP = temp + amount;
    }
}

function USE_ITEM_QUANTITY(c, idx) {
    const item = c.inventory[idx];
    if (!item) return;
    if (item.qty && parseInt(item.qty) > 1) {
        item.qty = String(parseInt(item.qty) - 1);
    } else {
        c.inventory.splice(idx, 1);
    }
}

function HCM() {
    document.getElementById('context-menu').style.display = 'none';
    ctxItem = null;
}

// Если экипируется предмет из стопки (например 2 Кинжала), отделяем 1 шт. для экипировки, а остаток оставляем в рюкзаке
function EQUIP_SINGLE_FROM_STACK(c, targetIdx) {
    const item = c.inventory[targetIdx];
    const qty = parseInt(item.qty) || 1;
    if (qty > 1) {
        item.qty = String(qty - 1);
        const eqCopy = Object.assign({}, item, { qty: '1', equipped: true });
        c.inventory.push(eqCopy);
    } else {
        item.equipped = true;
    }
}

function CA(act) {
    if (ctxItem === null) return;
    const targetIdx = ctxItem;
    const cs = GC();
    const c = cs[PI];
    const i = c.inventory[targetIdx];
    if (!i) { HCM(); return; }

    if (act === 'equip') {
        if (!i.equipped) {
            const itemType = GET_ITEM_TYPE(i);
            if (itemType === 'armor') {
                c.inventory.forEach(item => {
                    if (item !== i && item.equipped && GET_ITEM_TYPE(item) === 'armor') {
                        item.equipped = false;
                    }
                });
                EQUIP_SINGLE_FROM_STACK(c, targetIdx);
            } else if (itemType === 'weapon') {
                const props = (i.properties || '').toLowerCase().replace(/ё/g, 'е');
                const twoHanded = props.includes('двуручное') || (props.includes('тяжелое') && !props.includes('универсальное'));
                const handsNeeded = twoHanded ? 2 : 1;

                let usedHands = 0;
                const equippedWeapons = [];
                c.inventory.forEach(item => {
                    if (item !== i && item.equipped && (GET_ITEM_TYPE(item) === 'weapon' || GET_ITEM_TYPE(item) === 'shield')) {
                        const ip = (item.properties || '').toLowerCase().replace(/ё/g, 'е');
                        const isTwoHanded = ip.includes('двуручное') || (ip.includes('тяжелое') && !ip.includes('универсальное'));
                        usedHands += isTwoHanded ? 2 : 1;
                        if (GET_ITEM_TYPE(item) === 'weapon') equippedWeapons.push(item);
                    }
                });

                if (usedHands + handsNeeded > 2) {
                    HCM();
                    showMessage('Заняты руки', 'Не хватает свободных рук! Снимите щит или другое оружие (максимум 2 руки).');
                    return;
                }

                // Проверка правила Боя двумя оружиями D&D 5e
                const hasDualWielderFeat = c.chosenFeats && c.chosenFeats.includes('Использование двух оружий');
                if (equippedWeapons.length === 1 && !hasDualWielderFeat) {
                    const firstWepLight = (equippedWeapons[0].properties || '').toLowerCase().replace(/ё/g, 'е').includes('легкое');
                    const secondWepLight = props.includes('легкое');
                    if (!firstWepLight || !secondWepLight) {
                        HCM();
                        showMessage('Правило парного оружия D&D 5e', 'Держать оружие в обеих руках одновременно можно только если <b>оба оружия имеют свойство «лёгкое»</b> (например, Короткий меч или Кинжал), либо если у персонажа взята черта <b>«Использование двух оружий»</b>.');
                        return;
                    }
                }
                EQUIP_SINGLE_FROM_STACK(c, targetIdx);
            } else if (itemType === 'shield') {
                let usedHands = 0;
                c.inventory.forEach(item => {
                    if (item !== i && item.equipped && (GET_ITEM_TYPE(item) === 'weapon' || GET_ITEM_TYPE(item) === 'shield')) {
                        const ip = (item.properties || '').toLowerCase().replace(/ё/g, 'е');
                        const isTwoHanded = ip.includes('двуручное') || (ip.includes('тяжелое') && !ip.includes('универсальное'));
                        usedHands += isTwoHanded ? 2 : 1;
                    }
                });
                if (usedHands + 1 > 2) {
                    HCM();
                    showMessage('Заняты руки', 'Не хватает свободной руки для щита (снимите двуручное или второе оружие).');
                    return;
                }
                c.inventory.forEach(item => {
                    if (item !== i && item.equipped && GET_ITEM_TYPE(item) === 'shield') {
                        item.equipped = false;
                    }
                });
                EQUIP_SINGLE_FROM_STACK(c, targetIdx);
            } else if (itemType === 'accessory') {
                EQUIP_SINGLE_FROM_STACK(c, targetIdx);
            } else {
                HCM();
                showMessage('Ошибка', 'Этот предмет нельзя экипировать.');
                return;
            }
} else {
            i.equipped = false;
            const norm = (s) => (s || '').toLowerCase().replace(/ё/g, 'е').trim();
            const sameStack = c.inventory.find((item, idx) => idx !== targetIdx && !item.equipped && norm(item.name) === norm(i.name));
            if (sameStack) {
                sameStack.qty = String((parseInt(sameStack.qty) || 1) + (parseInt(i.qty) || 1));
                c.inventory.splice(targetIdx, 1);
            }
        }
        AB(c);
    } else if (act === 'edit') {
        const n = prompt('Название:', i.name);
        if (n !== null && n.trim() !== '') {
            i.name = n.trim();
            i.qty = String(Math.max(1, parseInt(prompt('Количество:', i.qty || '1')) || 1));
            i.weight = Math.max(0, parseFloat(prompt('Вес 1 шт. (фунты):', i.weight || 0)) || 0);
            i.desc = prompt('Описание:', i.desc || '') || '';
        }
    } else if (act === 'weapon') {
        i.isWeapon = true;
        i.type = 'weapon';
        i.damage = prompt('Урон (например 1к8):', '1к8') || '1к8';
        i.damageType = prompt('Тип урона:', 'рубящий') || 'рубящий';
        i.finesse = confirm('Фехтовальное (можно использовать Ловкость)?');
        i.ranged = confirm('Дальнобойное?');
        const light = confirm('Лёгкое (подходит для боя двумя оружиями)?');
        let props = [];
        if (light) props.push('лёгкое');
        if (i.finesse) props.push('фехтовальное');
        if (i.ranged) props.push('боеприпасы');
        i.properties = props.join(', ') || 'одноручное';
        i.icon = '⚔️';
    } else if (act === 'shield') {
        i.isShield = true;
        i.type = 'shield';
        i.ac = parseInt(prompt('Бонус щита к КБ:', '2')) || 2;
        i.properties = 'щит';
        i.icon = '🛡️';
    } else if (act === 'armor') {
        i.type = 'armor';
        i.ac = parseInt(prompt('Базовый КБ доспеха (например 12 для лёгкого, 14 для среднего, 18 для лат):', '12')) || 12;
        const typeChoice = prompt('Тип доспеха (напишите: лёгкий, средний или тяжёлый):', 'лёгкий') || 'лёгкий';
        i.properties = typeChoice.toLowerCase();
        i.icon = '🛡️';
    } else if (act === 'tool') {
        HCM();
        const pb = GPB(c.level || 1);
        const roll = Math.floor(Math.random() * 20) + 1;
        const total = roll + pb;
        LOG_COMBAT_TO_CHAT(`использует «${i.name}» | Бросок проверки: ${roll} + ${pb} (БМ) = ${total}`);
        showMessage('🔧 ' + i.name, `Вы используете инструмент «<b>${i.name}</b>»!<br><br>🎲 <b>Проверка владения (1к20 + БМ):</b> ${roll} + ${pb} = <b>${total}</b>`);
        return;
    } else if (act === 'use') {
        const catalogItem = FIND_CATALOG_ITEM(i.name);
        const lowName = (i.name || '').toLowerCase().replace(/ё/g, 'е');

        if (catalogItem && catalogItem.heal) {
            const healed = ROLL(catalogItem.heal);
            APPLY_HEAL(c, healed);
            USE_ITEM_QUANTITY(c, targetIdx);
            SC(cs); HCM(); RMC(); OINV();
            LOG_COMBAT_TO_CHAT(`выпивает «${i.name}» и восстанавливает +${healed} ХП!`);
            showMessage('🧪 Зелье выпито', `Вы выпили «<b>${i.name}</b>» (${catalogItem.heal}).<br>💚 Восстановлено: <b>+${healed} ХП</b> (текущие ХП: ${c.hp}/${c.maxHp}).`);
            return;
        }
        if (lowName.includes('зелье силы холмового гиганта')) {
            c.baseStr = Math.max(c.baseStr || 10, 21 - (c.strBonus || 0));
            AB(c);
            USE_ITEM_QUANTITY(c, targetIdx);
            SC(cs); HCM(); RMC(); OINV();
            LOG_COMBAT_TO_CHAT(`выпивает «${i.name}» — Сила увеличена до 21!`);
            showMessage('🧪 Эффект зелья', 'Вы выпили «<b>Зелье силы холмового гиганта</b>»!<br>💪 Ваша Сила увеличена до <b>21</b> на 1 час.');
            return;
        }
        if (lowName.includes('зелье силы огненного гиганта')) {
            c.baseStr = Math.max(c.baseStr || 10, 25 - (c.strBonus || 0));
            AB(c);
            USE_ITEM_QUANTITY(c, targetIdx);
            SC(cs); HCM(); RMC(); OINV();
            LOG_COMBAT_TO_CHAT(`выпивает «${i.name}» — Сила увеличена до 25!`);
            showMessage('🧪 Эффект зелья', 'Вы выпили «<b>Зелье силы огненного гиганта</b>»!<br>💪 Ваша Сила увеличена до <b>25</b> на 1 час.');
            return;
        }
        if (catalogItem && catalogItem.type === 'potion' && !catalogItem.heal) {
            USE_ITEM_QUANTITY(c, targetIdx);
            SC(cs); HCM(); RMC(); OINV();
            LOG_COMBAT_TO_CHAT(`выпивает «${i.name}» (${catalogItem.description})`);
            showMessage('🧪 Зелье использовано', `Вы выпили «<b>${i.name}</b>»!<br><br>✨ <b>Эффект:</b> ${catalogItem.description}`);
            return;
        }
        if (lowName.includes('лечен') || lowName.includes('исцел') || lowName.includes('здоров')) {
            HCM();
            showHealPrompt(i.name, function(amount) {
                const cs2 = GC();
                const c2 = cs2[PI];
                APPLY_HEAL(c2, amount);
                USE_ITEM_QUANTITY(c2, targetIdx);
                SC(cs2);
                RMC();
                OINV();
                showMessage('Предмет использован', 'Восстановлено ' + amount + ' ХП.');
            });
            return;
        } else {
            USE_ITEM_QUANTITY(c, targetIdx);
            SC(cs); HCM(); RMC(); OINV();
            showMessage('🧪 Зелье выпито', `Вы использовали «<b>${i.name}</b>».<br>${i.desc || ''}`);
            return;
        }
    } else if (act === 'remove') {
        c.inventory.splice(targetIdx, 1);
        AB(c);
    } else if (act === 'info') {
        HCM();
        const qty = parseInt(i.qty) || 1;
        const totalW = Math.round((parseFloat(i.weight) || 0) * qty * 100) / 100;
        const typeRus = { weapon: 'Оружие', armor: 'Доспех', shield: 'Щит', accessory: 'Чудесный предмет / Аксессуар', potion: 'Зелье', scroll: 'Свиток / Записка', tool: 'Инструмент', misc: 'Снаряжение' }[GET_ITEM_TYPE(i)] || 'Предмет';
        let infoHtml = `<b>Название:</b> ${i.icon || '📦'} ${i.name}<br>` +
                       `<b>Категория:</b> ${typeRus}${i.equipped ? ' <span style="color:#4caf50;">(Надето)</span>' : ''}<br>` +
                       `<b>Количество:</b> ${qty} шт.<br>` +
                       `<b>Вес:</b> ${i.weight || 0} фнт (общий вес: ${totalW} фнт)`;
        if (i.damage) infoHtml += `<br><b>Урон:</b> ${i.damage} (${i.damageType || 'обычный'})`;
        if (i.ac) infoHtml += `<br><b>Защита (КБ):</b> ${i.isShield ? '+' + i.ac : i.ac}`;
        if (i.properties) infoHtml += `<br><b>Свойства:</b> ${i.properties}`;
        if (i.price) infoHtml += `<br><b>Цена:</b> ${i.price}`;
        infoHtml += `<br><br><b>Описание:</b><br><span style="color:#ccc;">${i.desc || 'Нет описания'}</span>`;
        showMessage('📋 Информация о предмете', infoHtml);
        return;
    } else if (act === 'read') {
        HCM();
        showMessage('📜 ' + i.name, (i.desc || 'На этом свитке ничего не написано.'));
        return;
    }

    SC(cs);
    HCM();
    RMC();
    OINV();
}

function SHOW_SPLIT(idx) {
    HCM();
    const cs = GC();
    const c = cs[PI];
    const item = c.inventory[idx];
    if (!item || !item.qty || parseInt(item.qty) <= 1) return;

    splitItemIdx = idx;
    const currentQty = parseInt(item.qty);
    const maxQty = currentQty - 1;

    document.getElementById('split-item-name').textContent = item.name;
    document.getElementById('split-total').textContent = currentQty;
    
    const qtyInput = document.getElementById('split-qty');
    const rangeInput = document.getElementById('split-range');
    const remainSpan = document.getElementById('split-remain');
    
    qtyInput.max = maxQty;
    qtyInput.value = 1;
    rangeInput.max = maxQty;
    rangeInput.value = 1;
    remainSpan.textContent = currentQty - 1;

    function updateValues(val) {
        val = Math.max(1, Math.min(val, maxQty));
        qtyInput.value = val;
        rangeInput.value = val;
        remainSpan.textContent = currentQty - val;
    }

    qtyInput.oninput = function() { updateValues(parseInt(this.value) || 1); };
    rangeInput.oninput = function() { updateValues(parseInt(this.value)); };

    OM('split-modal');
}

function CONFIRM_SPLIT() {
    const cs = GC();
    const c = cs[PI];
    const item = c.inventory[splitItemIdx];
    if (!item) return;

    const qtyToSplit = parseInt(document.getElementById('split-qty').value) || 1;
    const currentQty = parseInt(item.qty) || 1;
    if (qtyToSplit >= currentQty || qtyToSplit <= 0) {
        showMessage('Ошибка', 'Некорректное количество.');
        return;
    }

    item.qty = String(currentQty - qtyToSplit);

    const newItem = Object.assign({}, item);
    newItem.qty = String(qtyToSplit);
    newItem.equipped = false;
    c.inventory.splice(splitItemIdx + 1, 0, newItem);

    SC(cs);
    closeModal('split-modal');
    RMC();
    OINV();
    splitItemIdx = null;
}

function GET_ITEM_TYPE(item) {
    const name = (item.name || '').toLowerCase().replace(/ё/g, 'е');
    if (item.isShield || item.type === 'shield' || name.includes('щит')) return 'shield';
    if (item.isWeapon || item.type === 'weapon') return 'weapon';
    if ((item.ac && item.type !== 'potion') || item.type === 'armor') return 'armor';
    if (name.includes('доспех') || name.includes('броня') || name.includes('панцирь') || name.includes('кольчуга') || name.includes('латы') || name.includes('кираса')) return 'armor';
    if (name.includes('зелье') || name.includes('элексир') || name.includes('напиток') || name.includes('противоядие') || item.type === 'potion') return 'potion';
    if (name.includes('свиток') || name.includes('записка') || name.includes('письмо') || name.includes('книга') || item.type === 'scroll') return 'scroll';
    if (item.type === 'tool' || name.includes('инструмент') || name.includes('отмычк') || name.includes('набор')) return 'tool';
    if (name.includes('меч') || name.includes('топор') || name.includes('кинжал') || name.includes('копье') || name.includes('лук') || name.includes('арбалет') || name.includes('молот') || name.includes('булава') || name.includes('дубинка') || name.includes('палица') || name.includes('серп') || name.includes('дротик') || name.includes('праща') || name.includes('алебарда') || name.includes('глефа') || name.includes('секира') || name.includes('рапира') || name.includes('скимитар') || name.includes('трезубец') || name.includes('цеп') || name.includes('моргенштерн') || name.includes('посох') || name.includes('пика')) return 'weapon';
    if (name.includes('кольцо') || name.includes('амулет') || name.includes('плащ') || name.includes('сапоги') || name.includes('пояс')) return 'accessory';
    return 'misc';
}

function CREATE_ITEM_OBJECT(nameInput, qtyInput, weightInput, descInput) {
    const template = FIND_CATALOG_ITEM(nameInput);
    if (template) {
        return {
            name: template.name,
            qty: String(Math.max(1, parseInt(qtyInput) || 1)),
            weight: weightInput !== '' && weightInput !== undefined ? parseFloat(weightInput) : template.weight,
            desc: descInput || template.description,
            icon: template.icon,
            equipped: false,
            isWeapon: template.type === 'weapon',
            isShield: template.type === 'shield',
            damage: template.damage || '',
            damageType: template.damageType || '',
            finesse: template.properties ? template.properties.includes('фехтовальное') : false,
            ranged: template.properties ? (template.properties.includes('метательное') || template.properties.includes('боеприпасы')) : false,
            properties: template.properties || '',
            ac: template.ac || 0,
            price: template.price || '',
            type: template.type,
            consumable: template.consumable || false
        };
    }
    let ic = '📦';
    const low = nameInput.toLowerCase().replace(/ё/g, 'е');
    if (low.includes('меч') || low.includes('топор') || low.includes('кинжал')) ic = '⚔️';
    else if (low.includes('лук') || low.includes('арбалет') || low.includes('стрел') || low.includes('болт')) ic = '🏹';
    else if (low.includes('зелье') || low.includes('элексир')) ic = '🧪';
    else if (low.includes('щит') || low.includes('доспех') || low.includes('латы') || low.includes('кольчуга')) ic = '🛡️';
    else if (low.includes('записка') || low.includes('свиток') || low.includes('книга')) ic = '📜';
    else if (low.includes('кольцо') || low.includes('амулет')) ic = '💍';
    else if (low.includes('инструмент')) ic = '🔧';
    return {
        name: nameInput,
        qty: String(Math.max(1, parseInt(qtyInput) || 1)),
        weight: parseFloat(weightInput) || 0,
        desc: descInput || '',
        icon: ic,
        equipped: false,
        isWeapon: false,
        isShield: false,
        price: '',
        type: '',
        consumable: false
    };
}

function ADDITEM() {
    const n = document.getElementById('new-item-name').value.trim();
    if (!n) return;
    const q = document.getElementById('new-item-qty').value.trim();
    const w = document.getElementById('new-item-weight').value.trim();
    const d = document.getElementById('new-item-desc').value.trim();
    const cs = GC();
    const c = cs[PI];
    if (!c.inventory) c.inventory = [];

    const norm = (s) => (s || '').toLowerCase().replace(/ё/g, 'е').trim();
    const tpl = FIND_CATALOG_ITEM(n);
    const canonicalName = tpl ? tpl.name : n;

    const existing = c.inventory.find(item => norm(item.name) === norm(canonicalName) && !item.equipped);
    if (existing) {
        const addQty = Math.max(1, parseInt(q) || 1);
        existing.qty = String((parseInt(existing.qty) || 1) + addQty);
        SC(cs);
        RMC();
        OINV();
        return;
    }

    c.inventory.push(CREATE_ITEM_OBJECT(canonicalName, q || '1', w, d));
    SC(cs);
    RMC();
    OINV();
}

// ================================================================
// ОТДЫХ (D&D 5E + BALDUR'S GATE 3 + ВСПЛЫВАЮЩЕЕ ГОЛОСОВАНИЕ ОТРЯДА)
// ================================================================
function AIS() {
    const inp = document.getElementById('new-item-name');
    if (inp) { inp.focus(); inp.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
}

function CREATE_DEFAULT_CHAR() {
    return {
        name: 'Мой персонаж', race: '', subrace: '', className: '', subclass: '', background: '',
        level: 1, xp: 0, hp: 10, maxHp: 10, tempHP: 0, mana: '0/0', hitDice: '1к12',
        spentHitDice: 0, shortRestsUsed: 0, arcaneRecoveryUsed: false,
        str: 10, dex: 10, con: 10, intl: 10, wis: 10, cha: 10,
        baseStr: 10, baseDex: 10, baseCon: 10, baseInt: 10, baseWis: 10, baseCha: 10,
        strBonus: 0, dexBonus: 0, conBonus: 0, intBonus: 0, wisBonus: 0, chaBonus: 0,
        alignment: '', speed: 30, featSpeedBonus: 0, inspiration: '0',
        deathSaveSuccess: '⬤⬤⬤', deathSaveFail: '⬤⬤⬤',
        languages: '', abilities: '', traits: '', ideals: '', bonds: '', flaws: '', story: '', attacks: '', avatar: '',
        inventory: [], money: { gp: 0, sp: 0, cp: 0 },
        chosenLanguages: {}, chosenSkills: [], bonusSkillSlots: 0,
        languagesLocked: false, skillsLocked: false, raceLocked: false, statsLocked: false, classLocked: false, subclassLocked: false,
        bgLocked: false, traitsLocked: false, idealsLocked: false, bondsLocked: false, flawsLocked: false,
        storyLocked: false, alignmentLocked: false,
        usedSpellSlots: {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0},
        usedSpells: {},
        _prevSkills: [],
        knownSpells: [],
        pendingChoices: [],
        _completedChoices: [],
        chosenFeats: [],
        chosenFeatsTarget: [],
        expertiseSkills: [],
        weaponProficiencies: [],
        initiativeBonus: 0,
        toughBonus: 0,
        toughPerLevel: 0,
        _hpRolls: {},
        _hpClass: '',
        _hpInitialized: false,
        _processingChoices: false,
        _spellsOffered: false,
        inCombat: false
    };
}

function RST() {
    if (!confirm('Уверены? Все данные текущего персонажа будут сброшены.')) return;
    const cs = GC();
    cs[PI] = CREATE_DEFAULT_CHAR();
    localStorage.removeItem('dnd_rest_poll');
    SC(cs);
    RMC();
    CHECK_AND_RENDER_REST_POPUP();
}

// Переключение между игроками отряда для тестирования всплывающего окна голосования на одном ПК
function SWITCH_ACTIVE_PLAYER(newIdx) {
    const cs = GC();
    if (newIdx < 0 || newIdx >= cs.length) return;
    PI = newIdx;
    RMC();
    CHECK_AND_RENDER_REST_POPUP();
}

function ADD_TEST_PARTY_MEMBER() {
    const cs = GC();
    const num = cs.length + 1;
    const classes = ['Воин', 'Жрец', 'Плут', 'Волшебник', 'Бард', 'Колдун'];
    const races = ['Эльф', 'Дварф', 'Человек', 'Тифлинг'];
    const newChar = CREATE_DEFAULT_CHAR();
    newChar.name = 'Союзник ' + num;
    newChar.race = races[(num - 2) % races.length];
    newChar.className = classes[(num - 2) % classes.length];
    AB(newChar);
    cs.push(newChar);
    SC(cs);
    RMC();
    CHECK_AND_RENDER_REST_POPUP();
}

function REMOVE_LAST_PARTY_MEMBER() {
    const cs = GC();
    if (cs.length <= 1) return;
    cs.pop();
    if (PI >= cs.length) PI = 0;
    localStorage.removeItem('dnd_rest_poll');
    SC(cs);
    RMC();
    CHECK_AND_RENDER_REST_POPUP();
}

// Хранилище активного голосования за Длинный отдых
function GET_REST_POLL() {
    const d = localStorage.getItem('dnd_rest_poll');
    return d ? JSON.parse(d) : null;
}
function SAVE_REST_POLL(poll) {
    if (!poll) localStorage.removeItem('dnd_rest_poll');
    else localStorage.setItem('dnd_rest_poll', JSON.stringify(poll));
}

// Если кто-то из пачки вступил в бой — активное голосование мгновенно прерывается!
function CANCEL_REST_POLL_IF_COMBAT(fighterName) {
    const poll = GET_REST_POLL();
    if (poll && poll.active) {
        SAVE_REST_POLL(null);
        CM('rest-modal');
        CHECK_AND_RENDER_REST_POPUP();
        LOG_COMBAT_TO_CHAT(`⚔️ Голосование за Длинный отдых прервано — ${fighterName} вступил в бой!`);
    }
}

// 1. Окно Длинного отдыха (открывается по кнопке «🌙 Длинный отдых»)
function SLR() {
    const cs = GC();
    const c = cs[PI];
    if (!c) return;

    // Проверка: не находится ли сам игрок или кто-то из отряда в бою
    const fightingMember = cs.find(m => m.inCombat);
    if (c.inCombat || fightingMember) {
        const who = c.inCombat ? 'Вы находитесь в бою!' : `Участник отряда «${fightingMember.name}» сейчас находится в бою!`;
        showMessage('⚔️ Отдых невозможен', `${who}<br><br>Нельзя разбить лагерь или начать голосование за Длинный отдых, пока идёт сражение.`);
        return;
    }

    const poll = GET_REST_POLL();
    const totalPlayers = cs.length || 1;
    const neededMajority = Math.floor(totalPlayers / 2) + 1;

    // Если игрок один в отряде — голосовать не с кем, можно сразу отдохнуть
    if (totalPlayers === 1) {
        document.getElementById('rest-content').innerHTML = `
            <h2>🌙 Лагерь: Длинный отдых</h2>
            <div style="background:#1a1a1a; padding:12px; border-radius:6px; border:1px solid #444; margin-bottom:15px; font-size:0.9em; color:#ccc; text-align:left;">
                <b>Эффекты Длинного отдыха (D&D 5e / BG3):</b><br>
                • Полное восстановление <b>ХП (100%)</b> и снятие Временных ХП<br>
                • Восстановление <b>всех ячеек заклинаний (1–9 круг)</b> и Арканумов<br>
                • Восстановление <b>Костей Хитов</b> и лимита <b>Коротких отдыхов (2/2)</b><br><br>
                <small style="color:#888;">💡 Сейчас вы путешествуете в одиночку. Если хотите протестировать голосование пачки со всплывающим окном — добавьте союзников кнопкой «+ Союзник» в блоке «Отряд» справа.</small>
            </div>
            <button class="btn-save" style="padding:8px 16px;" onclick="EXECUTE_LONG_REST_FOR_PARTY()">🔥 Разбить лагерь и отдохнуть</button>
            <button onclick="CM('rest-modal')">Отмена</button>
        `;
        OM('rest-modal');
        return;
    }

    // Если голосование ЕЩЁ НЕ НАЧАТО — показываем кнопку «Начать голосование»
    if (!poll || !poll.active) {
        document.getElementById('rest-content').innerHTML = `
            <h2>🌙 Лагерь: Длинный отдых</h2>
            <div style="background:#1a1a1a; padding:12px; border-radius:6px; border:1px solid #444; margin-bottom:15px; font-size:0.9em; color:#ccc; text-align:left;">
                <b>Эффекты Длинного отдыха:</b><br>
                • Полное восстановление <b>ХП</b>, <b>Костей Хитов</b> и <b>всех ячеек заклинаний</b> всему отряду.<br><br>
                <span style="color:#c9a96e;">👥 В отряде <b>${totalPlayers} чел.</b> Для ухода на Длинный отдых требуется согласие большинства (минимум <b>${neededMajority} из ${totalPlayers}</b>).</span><br>
                <small style="color:#888;">Когда вы нажмёте кнопку ниже, у всех остальных игроков отряда на экране всплывёт окно голосования.</small>
            </div>
            <button class="btn-save" style="padding:8px 16px;" onclick="START_LONG_REST_POLL()">📣 Начать голосование за Длинный отдых</button>
            <button onclick="CM('rest-modal')">Отмена</button>
        `;
        OM('rest-modal');
        return;
    }

    // Если голосование УЖЕ ИДЁТ — показываем текущий статус ожидания голосов
    let yesVotes = 0, noVotes = 0;
    let statusRows = '';
    cs.forEach((m, idx) => {
        const v = poll.votes[idx];
        if (v === 'yes') yesVotes++;
        if (v === 'no') noVotes++;
        const badge = v === 'yes' ? '<span style="color:#4caf50;">✅ Согласен</span>' : (v === 'no' ? '<span style="color:#e06060;">❌ Против</span>' : '<span style="color:#c9a96e;">⏳ Голосует...</span>');
        statusRows += `<div style="display:flex; justify-content:space-between; padding:6px 10px; background:#252525; border-radius:4px; margin-bottom:4px;"><span><b>${m.name || 'Игрок ' + (idx+1)}</b></span>${badge}</div>`;
    });

    document.getElementById('rest-content').innerHTML = `
        <h2>🏕️ Идёт голосование за Длинный отдых...</h2>
        <p style="color:#aaa; font-size:0.9em;">Инициатор: <b style="color:#c9a96e;">${poll.initiatorName}</b> | Голосов ЗА: <b>${yesVotes} / ${totalPlayers}</b> (нужно ${neededMajority})</p>
        <div style="margin:12px 0; text-align:left;">${statusRows}</div>
        <small style="color:#888; display:block; margin-bottom:12px;">У остальных игроков сейчас открыто всплывающее окно голосования. Как только наберётся большинство голосов «ЗА», отдых начнётся автоматически.</small>
        <button class="btn-danger" onclick="CANCEL_LONG_REST_POLL()">Отозвать голосование</button>
        <button onclick="CM('rest-modal')">Свернуть окно</button>
    `;
    OM('rest-modal');
}

// 2. Запуск голосования инициатором
function START_LONG_REST_POLL() {
    const cs = GC();
    const c = cs[PI];
    if (!c) return;

    if (cs.some(m => m.inCombat)) {
        showMessage('⚔️ Бой!', 'Кто-то из отряда находится в бою. Голосование невозможно.');
        return;
    }

    const initiatorName = c.name || ('Игрок ' + (PI + 1));
    const poll = {
        active: true,
        initiatorIdx: PI,
        initiatorName: initiatorName,
        votes: { [PI]: 'yes' }
    };
    SAVE_REST_POLL(poll);
    CM('rest-modal');

    const totalPlayers = cs.length || 1;
    const needed = Math.floor(totalPlayers / 2) + 1;
    LOG_COMBAT_TO_CHAT(`🏕️ предлагает разбить лагерь для Длинного отдыха! Запущено голосование (ЗА: 1/${totalPlayers}, нужно: ${needed}).`);

    CHECK_POLL_RESOLUTION();
    CHECK_AND_RENDER_REST_POPUP();
    showMessage('📣 Голосование запущено', `Предложение отправлено всему отряду!<br><br>У остальных игроков появилось всплывающее окно голосования.<br><small style="color:#aaa;">(Для проверки на одном ПК переключите игрока в блоке «Отряд» справа внизу или откройте вторую вкладку браузера).</small>`);
}

function CANCEL_LONG_REST_POLL() {
    SAVE_REST_POLL(null);
    CM('rest-modal');
    CHECK_AND_RENDER_REST_POPUP();
    LOG_COMBAT_TO_CHAT('❌ Голосование за Длинный отдых было отменено.');
}

// 3. Обработка голоса игрока из всплывающего окна
function CAST_REST_POLL_VOTE(voteVal) {
    const cs = GC();
    const poll = GET_REST_POLL();
    if (!poll || !poll.active) return;

    const fighting = cs.find(m => m.inCombat);
    if (fighting) {
        CANCEL_REST_POLL_IF_COMBAT(fighting.name || 'Игрок');
        showMessage('⚔️ Отряд в бою!', `Голосование прервано, так как ${fighting.name} вступил в бой.`);
        return;
    }

    poll.votes[PI] = voteVal;
    SAVE_REST_POLL(poll);

    const totalPlayers = cs.length || 1;
    const yesCount = Object.values(poll.votes).filter(v => v === 'yes').length;
    LOG_COMBAT_TO_CHAT(`${voteVal === 'yes' ? '✅ голосует ЗА Длинный отдых' : '❌ голосует ПРОТИВ Длинного отдыха'} (Голосов ЗА: ${yesCount}/${totalPlayers})`);

    CHECK_AND_RENDER_REST_POPUP();
    CHECK_POLL_RESOLUTION();
}

// 4. Проверка: набрано ли большинство ЗА или голосование провалилось
function CHECK_POLL_RESOLUTION() {
    const cs = GC();
    const poll = GET_REST_POLL();
    if (!poll || !poll.active) return;

    const totalPlayers = cs.length || 1;
    const neededMajority = Math.floor(totalPlayers / 2) + 1;
    let yesVotes = 0, noVotes = 0, votedCount = 0;

    for (let i = 0; i < totalPlayers; i++) {
        if (poll.votes[i] === 'yes') { yesVotes++; votedCount++; }
        else if (poll.votes[i] === 'no') { noVotes++; votedCount++; }
    }

    if (yesVotes >= neededMajority) {
        EXECUTE_LONG_REST_FOR_PARTY();
        return;
    }

    const remainingVotes = totalPlayers - votedCount;
    if (yesVotes + remainingVotes < neededMajority) {
        SAVE_REST_POLL(null);
        CM('rest-modal');
        CHECK_AND_RENDER_REST_POPUP();
        LOG_COMBAT_TO_CHAT(`🚫 Голосование за Длинный отдых отклонено большинством (ЗА: ${yesVotes}, ПРОТИВ: ${noVotes}). Отряд продолжает путь!`);
        showMessage('🚫 Отдых отклонён', `Большинство игроков проголосовало против привала (ЗА: ${yesVotes}, ПРОТИВ: ${noVotes}).`);
    }
}

// 5. Само выполнение Длинного отдыха (когда большинство проголосовало ЗА)
function EXECUTE_LONG_REST_FOR_PARTY() {
    const cs = GC();
    if (cs.some(m => m.inCombat)) {
        CANCEL_REST_POLL_IF_COMBAT('Участник отряда');
        return;
    }

    cs.forEach(member => {
        member.hp = member.maxHp || 10;
        member.tempHP = 0;
        member.usedSpellSlots = {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0};
        member.usedSpells = {};
        member.shortRestsUsed = 0;
        member.arcaneRecoveryUsed = false;
        member.spentHitDice = 0;
        member.deathSaveSuccess = '⬤⬤⬤';
        member.deathSaveFail = '⬤⬤⬤';
    });

    SAVE_REST_POLL(null);
    SC(cs);
    CM('rest-modal');
    CHECK_AND_RENDER_REST_POPUP();
    RMC();
    LOG_COMBAT_TO_CHAT('🌙 Отряд провёл Длинный отдых: здоровье, Кости Хитов и все ячейки заклинаний полностью восстановлены.');
    showMessage('🌙 Длинный отдых завершён!', 'Отряд разбил лагерь и спокойно провёл ночь.<br><br>💚 <b>Здоровье (100%)</b>, <b>Кости Хитов</b>, <b>Короткие отдыхи (2/2)</b> и <b>все ячейки магии</b> полностью восстановлены!');
}

function DLR() { EXECUTE_LONG_REST_FOR_PARTY(); }

// 6. ВСПЛЫВАЮЩЕЕ ИГРОВОЕ ОКНО ГОЛОСОВАНИЯ (появляется само у остальных игроков пачки)
function CHECK_AND_RENDER_REST_POPUP() {
    let popup = document.getElementById('party-rest-vote-popup');
    const poll = GET_REST_POLL();
    const cs = GC();

    if (!poll || !poll.active || cs.length <= 1) {
        if (popup) popup.remove();
        return;
    }

    const fighting = cs.find(m => m.inCombat);
    if (fighting) {
        CANCEL_REST_POLL_IF_COMBAT(fighting.name || 'Игрок');
        return;
    }

    const totalPlayers = cs.length;
    const neededMajority = Math.floor(totalPlayers / 2) + 1;
    const yesVotes = Object.values(poll.votes).filter(v => v === 'yes').length;
    const myVote = poll.votes[PI];
    const currentPlayerName = (cs[PI] && cs[PI].name) ? cs[PI].name : ('Игрок ' + (PI + 1));

    if (!popup) {
        popup = document.createElement('div');
        popup.id = 'party-rest-vote-popup';
        popup.style.cssText = 'position:fixed; top:18px; left:50%; transform:translateX(-50%); width:420px; max-width:94vw; background:#1c1917; border:2px solid #c9a96e; border-radius:12px; padding:16px 20px; box-shadow:0 12px 34px rgba(0,0,0,0.92); z-index:9999; color:#e0e0e0; font-family:Georgia,serif; text-align:center;';
        document.body.appendChild(popup);
    }

    if (!myVote) {
        popup.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
                <span style="color:#c9a96e; font-weight:bold; font-size:1.05em;">🏕️ Голосование за Длинный отдых</span>
                <span style="background:#3a3222; color:#c9a96e; padding:2px 7px; border-radius:10px; font-size:0.75em;">${yesVotes}/${totalPlayers} ЗА</span>
            </div>
            <p style="font-size:0.88em; color:#ccc; margin-bottom:10px; line-height:1.4;">
                Игрок <b style="color:#fff;">${poll.initiatorName}</b> предлагает отряду разбить лагерь на ночь.<br>
                <small style="color:#888;">Ваш персонаж: <b style="color:#c9a96e;">${currentPlayerName}</b> (нужно ${neededMajority} из ${totalPlayers} голосов)</small>
            </p>
            <div style="display:flex; gap:8px;">
                <button class="btn-save" style="flex:1; padding:8px;" onclick="CAST_REST_POLL_VOTE('yes')">✅ Согласиться</button>
                <button class="btn-danger" style="flex:1; padding:8px;" onclick="CAST_REST_POLL_VOTE('no')">❌ Отказаться</button>
            </div>
        `;
    } else {
        popup.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:space-between;">
                <div>
                    <div style="color:#c9a96e; font-weight:bold; font-size:0.9em;">🏕️ Ожидание отряда (${yesVotes}/${totalPlayers} ЗА)</div>
                    <small style="color:#aaa;">Вы проголосовали: <b>${myVote === 'yes' ? '✅ ЗА' : '❌ ПРОТИВ'}</b> (нужно ${neededMajority})</small>
                </div>
                <button class="btn-small" style="padding:4px 8px;" onclick="SLR()">Статус</button>
            </div>
        `;
    }
}

// ================================================================
// КОРОТКИЙ ОТДЫХ
// ================================================================
function SSR() {
    const cs = GC();
    const c = cs[PI];
    if (!c) return;

    if (c.inCombat) {
        showMessage('⚔️ Вы находитесь в бою!', 'Короткий отдых нельзя использовать во время боя!<br><br>Сначала завершите бой в окне «Атаки и заклинания».');
        return;
    }

    const lv = c.level || 1;
    const spentHD = c.spentHitDice || 0;
    const availHD = Math.max(0, lv - spentHD);
    const hdType = (c.hitDice || '1к8').replace('1к', 'к');
    const conMod = GM(c.con || 10);
    const shortUsed = c.shortRestsUsed || 0;

    const bardMember = cs.find(m => m.className === 'Бард' && (m.level || 1) >= 2);
    let songOfRestDice = '';
    if (bardMember) {
        const bLv = bardMember.level || 2;
        songOfRestDice = bLv >= 17 ? '1к12' : (bLv >= 13 ? '1к10' : (bLv >= 9 ? '1к8' : '1к6'));
    }
    const maxShortRests = bardMember ? 3 : 2;
    const noShortRestsLeft = shortUsed >= maxShortRests;

    let wizardRecoveryHTML = '';
    if (c.className === 'Волшебник') {
        const maxRecPoints = Math.ceil(lv / 2);
        const alreadyUsed = !!c.arcaneRecoveryUsed;
        wizardRecoveryHTML = `
            <div style="background:#1c2536; border:1px solid #38bdf8; padding:8px 10px; border-radius:6px; margin-top:10px; text-align:left; font-size:0.85em;">
                <b style="color:#38bdf8;">🔮 Магическое восстановление (Волшебник):</b><br>
                ${alreadyUsed
                    ? '<span style="color:#888;">Уже использовано сегодня (восстановится после Длинного отдыха).</span>'
                    : `Восстанавливает потраченные ячейки заклинаний (до <b>${maxRecPoints}</b> суммарного круга) во время Короткого отдыха.`}
            </div>`;
    }

    document.getElementById('rest-content').innerHTML = `
        <h2>☕ Короткий отдых</h2>
        <div style="background:#1a1a1a; padding:10px; border-radius:6px; border:1px solid #444; margin-bottom:12px; text-align:left; font-size:0.88em;">
            <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                <span>❤️ Ваше здоровье: <b>${c.hp ?? 10} / ${c.maxHp || 10} ХП</b></span>
                <span style="color:${noShortRestsLeft ? '#e06060' : '#c9a96e'};">Привалов за день: <b>${shortUsed} / ${maxShortRests}</b></span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <span>🎲 Доступно Костей Хитов (D&D 5e): <b>${availHD} / ${lv}</b> (1${hdType} ${MS(conMod)})</span>
            </div>
            ${songOfRestDice ? `<div style="color:#4caf50; margin-top:5px;">🎶 <b>Песнь отдыха (${bardMember.name}):</b> добавляет <b>+${songOfRestDice} ХП</b> к лечению на привале!</div>` : ''}
            ${c.className === 'Колдун' ? `<div style="color:#c084fc; margin-top:5px;">✨ <b>Магия Договора (Колдун):</b> все ячейки 1–5 круга будут полностью восстановлены!</div>` : ''}
            ${wizardRecoveryHTML}
        </div>

        ${noShortRestsLeft
            ? `<div style="background:#331a1a; border:1px solid #e06060; color:#e06060; padding:10px; border-radius:6px; margin-bottom:12px; font-size:0.9em;">
                   ⚠️ Вы уже использовали все доступные Короткие отдыхи за этот день (${maxShortRests}/${maxShortRests}). Чтобы снова делать привалы, проведите <b>🌙 Длинный отдых</b>!
               </div>`
            : `<div style="background:#252525; padding:10px; border-radius:6px; border:1px solid #555; margin-bottom:12px; text-align:left;">
                   <label style="color:#c9a96e; font-weight:bold; font-size:0.9em;">Выберите способ восстановления ХП:</label>
                   <div style="margin-top:8px; display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                       <span>Потратить Костей Хитов (D&D 5e):</span>
                       <input type="number" id="short-rest-hd-count" min="0" max="${availHD}" value="${availHD > 0 && (c.hp < c.maxHp) ? 1 : 0}" style="width:65px;">
                       <small style="color:#aaa;">(из ${availHD} доступных)</small>
                   </div>
                   <div style="margin-top:8px;">
                       <label style="cursor:pointer; font-size:0.85em; color:#ccc; display:flex; align-items:center; gap:6px;">
                           <input type="checkbox" id="short-rest-bg3-mode" style="width:auto;" ${availHD === 0 ? 'checked' : ''}>
                           <span>⚡ <b>В стиле Baldur's Gate 3:</b> восстановить <b>50% макс. ХП (+${Math.floor((c.maxHp || 10) / 2)} ХП)</b> без траты Костей Хитов</span>
                       </label>
                   </div>
               </div>`
        }

        <div style="display:flex; justify-content:center; gap:10px; flex-wrap:wrap;">
            <button class="btn-save" ${noShortRestsLeft ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : ''} onclick="DSR()">☕ Отдохнуть</button>
            <button onclick="CM('rest-modal')">Отмена</button>
        </div>
    `;
    OM('rest-modal');
}

function DSR() {
    const cs = GC();
    const c = cs[PI];
    if (!c) return;

    if (c.inCombat) {
        CM('rest-modal');
        showMessage('⚔️ В бою нельзя отдыхать', 'Сначала завершите бой!');
        return;
    }

    const bardMember = cs.find(m => m.className === 'Бард' && (m.level || 1) >= 2);
    const maxShortRests = bardMember ? 3 : 2;
    const shortUsed = c.shortRestsUsed || 0;

    if (shortUsed >= maxShortRests) {
        showMessage('Лимит привалов исчерпан', `Вы уже использовали все Короткие отдыхи за день (${maxShortRests}/${maxShortRests}). Проведите Длинный отдых!`);
        return;
    }

    const lv = c.level || 1;
    const spentHD = c.spentHitDice || 0;
    const availHD = Math.max(0, lv - spentHD);
    const hdSides = parseInt((c.hitDice || '1к8').replace('1к', '')) || 8;
    const conMod = GM(c.con || 10);

    const useBg3Mode = document.getElementById('short-rest-bg3-mode') && document.getElementById('short-rest-bg3-mode').checked;
    const diceToSpend = Math.max(0, Math.min(availHD, parseInt(document.getElementById('short-rest-hd-count')?.value) || 0));

    let totalHealed = 0;
    let rollDetails = [];

    if (useBg3Mode) {
        totalHealed = Math.max(1, Math.floor((c.maxHp || 10) / 2));
        rollDetails.push(`Привал BG3 (50% ХП): +${totalHealed}`);
    } else if (diceToSpend > 0) {
        for (let i = 0; i < diceToSpend; i++) {
            const r = Math.floor(Math.random() * hdSides) + 1;
            let oneDieHeal = r + conMod;
            if (c.chosenFeats && c.chosenFeats.includes('Крепкий')) {
                oneDieHeal = Math.max(oneDieHeal, Math.max(2, conMod * 2));
            } else {
                oneDieHeal = Math.max(1, oneDieHeal);
            }
            totalHealed += oneDieHeal;
            rollDetails.push(`${r}${MS(conMod)}=${oneDieHeal}`);
        }
        c.spentHitDice = spentHD + diceToSpend;
    }

    c.shortRestsUsed = shortUsed + 1;

    if (bardMember && (diceToSpend > 0 || useBg3Mode)) {
        const bLv = bardMember.level || 2;
        const songDice = bLv >= 17 ? '1к12' : (bLv >= 13 ? '1к10' : (bLv >= 9 ? '1к8' : '1к6'));
        const songHeal = ROLL(songDice);
        totalHealed += songHeal;
        rollDetails.push(`🎶 Песнь отдыха (${songDice}): +${songHeal}`);
    }

    const oldHp = c.hp ?? 10;
    c.hp = Math.min(oldHp + totalHealed, c.maxHp || 10);
    const actualHealed = c.hp - oldHp;

    let extraEffects = [];
    if (c.className === 'Колдун' && c.usedSpellSlots) {
        for (let i = 1; i <= 5; i++) {
            c.usedSpellSlots[i] = 0;
        }
        extraEffects.push('✨ Ячейки Магии Договора (Колдун) полностью восстановлены!');
    }

    if (c.className === 'Волшебник' && !c.arcaneRecoveryUsed && c.usedSpellSlots) {
        let budget = Math.ceil(lv / 2);
        let recoveredList = [];
        for (let slotLv = Math.min(5, budget); slotLv >= 1; slotLv--) {
            while ((c.usedSpellSlots[slotLv] || 0) > 0 && budget >= slotLv) {
                c.usedSpellSlots[slotLv]--;
                budget -= slotLv;
                recoveredList.push(slotLv + ' кр.');
            }
        }
        if (recoveredList.length > 0) {
            c.arcaneRecoveryUsed = true;
            extraEffects.push(`🔮 Магическое восстановление: возвращены ячейки (${recoveredList.join(', ')})!`);
        }
    }

    SC(cs);
    CM('rest-modal');
    RMC();

    const detailsStr = rollDetails.length > 0 ? `<br><small style="color:#aaa;">Броски: ${rollDetails.join(' | ')}</small>` : '';
    const extraStr = extraEffects.length > 0 ? '<br><br>' + extraEffects.join('<br>') : '';

    LOG_COMBAT_TO_CHAT(`☕ проводит Короткий отдых (${c.shortRestsUsed}/${maxShortRests}): восстановлено +${actualHealed} ХП (теперь ${c.hp}/${c.maxHp}). ${extraEffects.join(' ')}`);
    showMessage('☕ Короткий отдых завершён', `Восстановлено <b>+${actualHealed} ХП</b> (текущие ХП: <b>${c.hp} / ${c.maxHp}</b>).<br><small style="color:#c9a96e;">Использовано привалов за день: ${c.shortRestsUsed} / ${maxShortRests}</small>${detailsStr}${extraStr}`);
}

// ================================================================
// ЗАДАЧИ, ЧАТ И ИНИЦИАЛИЗАЦИЯ
// ================================================================
// ================================================================
// ЗАДАЧИ, ДВУХВКЛАДОЧНЫЙ ЧАТ (ИГРОКИ / СИСТЕМНЫЙ ЛОГ) И ИНИЦИАЛИЗАЦИЯ
// ================================================================
window._chatTab = 'players'; // 'players' | 'sys'
window._unreadSysCount = 0;

function EDT() {
    const co = document.getElementById('tasks-content');
    const ed = document.getElementById('tasks-edit');
    ed.value = co.textContent === 'Задачи не добавлены.' ? '' : co.textContent;
    co.style.display = 'none';
    ed.style.display = 'block';
    ed.focus();
}

function SVT() {
    const co = document.getElementById('tasks-content');
    const ed = document.getElementById('tasks-edit');
    const t = ed.value.trim();
    localStorage.setItem('dnd_tasks', t);
    co.textContent = t || 'Задачи не добавлены.';
    co.style.display = 'block';
    ed.style.display = 'none';
}

function LDT() {
    const s = localStorage.getItem('dnd_tasks');
    const co = document.getElementById('tasks-content');
    co.textContent = s || 'Задачи не добавлены.';
    co.style.display = 'block';
    document.getElementById('tasks-edit').style.display = 'none';
}

// Хранилище Чата Игроков
function GMS() { const d = localStorage.getItem('dnd_chat'); return d ? JSON.parse(d) : []; }
function SMS(m) { localStorage.setItem('dnd_chat', JSON.stringify(m)); }

// Хранилище Системного Лога (бои, проверки, отдых, голосования)
function GSYS() { const d = localStorage.getItem('dnd_sys_log'); return d ? JSON.parse(d) : []; }
function SSYS(m) { localStorage.setItem('dnd_sys_log', JSON.stringify(m)); }

// Автоматическое разделение старых смешанных сообщений (чтобы не потерять историю при переходе)
function MIGRATE_OLD_CHAT_MESSAGES() {
    if (localStorage.getItem('dnd_chat_migrated')) return;
    const oldMs = GMS();
    if (oldMs.length > 0) {
        const playerChat = [];
        const sysLog = GSYS();
        oldMs.forEach(msg => {
            if (msg.startsWith('⚔️') || msg.includes('проводит Короткий отдых') || msg.includes('Длинный отдых') || msg.includes('голосует') || msg.includes('выпивает «') || msg.includes('использует «')) {
                sysLog.push(msg.replace(/^⚔️\s*/, ''));
            } else {
                playerChat.push(msg);
            }
        });
        SMS(playerChat);
        SSYS(sysLog);
    }
    localStorage.setItem('dnd_chat_migrated', 'true');
}

function SET_CHAT_TAB(tab) {
    window._chatTab = tab;
    if (tab === 'sys') window._unreadSysCount = 0;
    RCH();
}

function CLEAR_CURRENT_CHAT_TAB() {
    const isSys = window._chatTab === 'sys';
    if (!confirm(isSys ? 'Очистить весь системный лог действий?' : 'Очистить историю сообщений чата игроков?')) return;
    if (isSys) SSYS([]);
    else SMS([]);
    RCH();
}

function RCH() {
    const con = document.getElementById('chat-messages');
    if (!con) return;
    const chatBox = con.parentElement; // Надёжно находим панель чата в #right-column!
    const chatInput = document.getElementById('chat-input');
    if (!chatBox) return;

    // Создаём шапку с вкладками внутри панели чата, если её ещё нет
    let tabsHeader = document.getElementById('chat-tabs-header');
    if (!tabsHeader) {
        const oldH2 = chatBox.querySelector('h2');
        tabsHeader = document.createElement('div');
        tabsHeader.id = 'chat-tabs-header';
        if (oldH2) oldH2.replaceWith(tabsHeader);
        else chatBox.prepend(tabsHeader);
    }

    const tab = window._chatTab || 'players';
    const unreadBadge = (window._unreadSysCount > 0 && tab !== 'sys')
        ? ` <span style="background:#e06060; color:#fff; border-radius:10px; padding:1px 6px; font-size:0.75em;">+${window._unreadSysCount}</span>`
        : '';

    tabsHeader.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #444; padding-bottom:8px; margin-bottom:8px; gap:6px;">
            <div style="display:flex; gap:5px; flex:1;">
                <button class="btn-small" style="flex:1; background:${tab==='players'?'#c9a96e':'#1f1f1f'}; color:${tab==='players'?'#1a1a1a':'#ccc'}; border:1px solid ${tab==='players'?'#c9a96e':'#444'}; font-weight:bold; padding:6px 6px;" onclick="SET_CHAT_TAB('players')">
                    💬 Игроки
                </button>
                <button class="btn-small" style="flex:1; background:${tab==='sys'?'#c9a96e':'#1f1f1f'}; color:${tab==='sys'?'#1a1a1a':'#ccc'}; border:1px solid ${tab==='sys'?'#c9a96e':'#444'}; font-weight:bold; padding:6px 6px;" onclick="SET_CHAT_TAB('sys')">
                    🎲 Лог${unreadBadge}
                </button>
            </div>
            <button class="btn-small" style="background:#1f1f1f; color:#888; border:1px solid #444; padding:5px 7px;" title="Очистить текущую вкладку" onclick="CLEAR_CURRENT_CHAT_TAB()">🗑️</button>
        </div>
    `;

    // Отрисовываем сообщения выбранной вкладки
    con.innerHTML = '';
    const list = (tab === 'sys') ? GSYS() : GMS();

    if (list.length === 0) {
        con.innerHTML = `<div style="color:#666; text-align:center; padding-top:30px; font-size:0.85em;">${tab === 'sys' ? 'Здесь отображаются броски кубиков, атаки, заклинания и отдых.' : 'Чат игроков пуст. Напишите сообщение внизу!'}</div>`;
    } else {
        list.forEach(m => {
            const d = document.createElement('div');
            if (tab === 'sys') {
                d.style.cssText = 'padding:6px 8px; margin-bottom:5px; background:#22262e; border-left:3px solid #c9a96e; border-radius:4px; font-size:0.82em; color:#d0d0d0; word-break:break-word; line-height:1.35;';
            } else {
                d.style.cssText = 'padding:6px 8px; margin-bottom:5px; background:#262626; border-left:3px solid #4caf50; border-radius:4px; font-size:0.88em; color:#e0e0e0; word-break:break-word; line-height:1.35;';
            }
            d.textContent = m;
            con.appendChild(d);
        });
    }
    con.scrollTop = con.scrollHeight;

    // Поле ввода активно во вкладке «Игроки», а в «Логе» скрыто
    if (chatInput) {
        if (tab === 'sys') {
            chatInput.style.display = 'none';
        } else {
            chatInput.style.display = 'block';
            chatInput.placeholder = 'Написать в чат игроков (Enter)...';
        }
    }
}


document.querySelectorAll('.modal').forEach(m => {
    m.addEventListener('click', function(e) {
        if (e.target === this) this.classList.remove('active');
    });
});

function INIT() {
    const cs = GC();
    if (!cs.length) {
        cs.push(CREATE_DEFAULT_CHAR());
        SC(cs);
    }
    if (cs.length > 0) {
        CHECK_CLASS_FEATURES(cs[PI]);
        SC(cs);
    }
    MIGRATE_OLD_CHAT_MESSAGES();
    RMC(); LDT(); RCH();
    CHECK_AND_RENDER_REST_POPUP();
}

INIT();

document.getElementById('chat-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter' && this.value.trim()) {
        const ms = GMS();
        const c = GC()[PI];
        const sender = (c && c.name && c.name !== 'Мой персонаж') ? c.name : 'Игрок';
        const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        ms.push(`[${time}] ${sender}: ${this.value.trim()}`);
        if (ms.length > 100) ms.shift();
        SMS(ms);
        window._chatTab = 'players';
        RCH();
        this.value = '';
    }
});

