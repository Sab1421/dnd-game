// ================================================================
// ⚔️ ПОШАГОВАЯ БОЕВАЯ СИСТЕМА В СТИЛЕ BALDUR'S GATE 3 (gm.js)
// ================================================================
window._bg3SelectedTargetIdx = 0;
window._bg3HotbarCategory = 'weapons';
window._bg3CombatLogBanner = '';

function GET_MAX_ATTACKS_PER_ACTION(c) {
    if (!c) return 1;
    const lv = c.level || 1;
    const cls = c.className || '';
    if (cls === 'Воин') return lv >= 20 ? 4 : (lv >= 11 ? 3 : (lv >= 5 ? 2 : 1));
    if (['Варвар', 'Паладин', 'Следопыт', 'Монах'].includes(cls) && lv >= 5) return 2;
    return 1;
}

function ENSURE_TURN_STATE(st) {
    if (!st.turnOrder) {
        st.turnOrder = { active: false, round: 1, currentIdx: 0, actionsLeft: 1, attacksLeft: 1, bonusLeft: 1 };
    }
    if (st.turnOrder.actionsLeft === undefined) st.turnOrder.actionsLeft = 1;
    if (st.turnOrder.attacksLeft === undefined) st.turnOrder.attacksLeft = 1;
    if (st.turnOrder.bonusLeft === undefined) st.turnOrder.bonusLeft = 1;
    return st.turnOrder;
}

function RESET_ACTIONS_FOR_CURRENT_FIGHTER(st) {
    const to = ENSURE_TURN_STATE(st);
    const tokens = st.tokens || [];
    if (!tokens.length) return;
    if (to.currentIdx >= tokens.length) to.currentIdx = 0;
    const activeTok = tokens[to.currentIdx];
    const cs = GC();

    if (activeTok && activeTok.isPlayer && cs[activeTok.charIdx]) {
        const ch = cs[activeTok.charIdx];
        to.actionsLeft = 1;
        to.attacksLeft = GET_MAX_ATTACKS_PER_ACTION(ch);
        to.bonusLeft = 1;
    } else {
        to.actionsLeft = 1;
        to.attacksLeft = 1;
        to.bonusLeft = 1;
    }
}

function SYNC_PLAYER_TOKENS_WITH_CHARS(st) {
    const cs = GC();
    if (!st || !st.tokens) return;
    st.tokens.forEach(tok => {
        if (tok.isPlayer && cs[tok.charIdx]) {
            const ch = cs[tok.charIdx];
            tok.name = ch.name || tok.name;
            tok.hp = ch.hp ?? 10;
            tok.maxHp = ch.maxHp || 10;
            tok.ac = CAC(ch);
            tok.avatar = ch.avatar || '';
        }
    });
}

const _ORIG_CLICK_MAP_TOKEN = CLICK_MAP_TOKEN;
CLICK_MAP_TOKEN = function(tIdx) {
    const cs = GC();
    const anyInCombat = cs.some(m => m.inCombat);
    if (anyInCombat) {
        window._bg3SelectedTargetIdx = tIdx;
        RENDER_MAP_AREA();
        return;
    }
    _ORIG_CLICK_MAP_TOKEN(tIdx);
};

GM_NEXT_TURN = function() {
    const st = GET_MAP_STATE();
    SYNC_PLAYER_TOKENS_WITH_CHARS(st);
    if (!st.tokens || !st.tokens.length) return;
    const to = ENSURE_TURN_STATE(st);
    to.active = true;

    let loops = 0;
    do {
        to.currentIdx = (to.currentIdx + 1);
        if (to.currentIdx >= st.tokens.length) {
            to.currentIdx = 0;
            to.round = (to.round || 1) + 1;
        }
        loops++;
    } while (st.tokens[to.currentIdx].hp <= 0 && loops < st.tokens.length);

    RESET_ACTIONS_FOR_CURRENT_FIGHTER(st);
    SAVE_MAP_STATE(st);

    const curTok = st.tokens[to.currentIdx];
    LOG_COMBAT_TO_CHAT(`⏭️ [Раунд ${to.round}] Очередь хода переходит к «${curTok ? curTok.name : 'Бойцу'}»!`);
    RENDER_MAP_AREA();
};

function BG3_EXECUTE_ENEMY_AI_TURN() {
    const st = GET_MAP_STATE();
    SYNC_PLAYER_TOKENS_WITH_CHARS(st);
    const to = ENSURE_TURN_STATE(st);
    const enemyTok = st.tokens && st.tokens[to.currentIdx];
    if (!enemyTok || enemyTok.isPlayer || enemyTok.hp <= 0) {
        GM_NEXT_TURN();
        return;
    }

    const cs = GC();
    const alivePlayers = st.tokens.filter(t => t.isPlayer && cs[t.charIdx] && (cs[t.charIdx].hp ?? 10) > 0);
    if (alivePlayers.length === 0) {
        GM_NEXT_TURN();
        return;
    }

    const targetTok = alivePlayers[Math.floor(Math.random() * alivePlayers.length)];
    const targetChar = cs[targetTok.charIdx];
    const targetAC = CAC(targetChar);

    const d20 = Math.floor(Math.random() * 20) + 1;
    const atkBonus = parseInt(enemyTok.atkBonus) || 4;
    const totalAtk = d20 + atkBonus;
    const isCrit = (d20 === 20);
    const isHit = isCrit || (d20 !== 1 && totalAtk >= targetAC);

    if (isHit) {
        let dmg = Math.max(1, ROLL(enemyTok.dmgFormula || '1к6+2'));
        if (isCrit) dmg *= 2;
        targetChar.hp = Math.max(0, (targetChar.hp ?? 10) - dmg);
        targetTok.hp = targetChar.hp;
        SC(cs);
        SAVE_MAP_STATE(st);

        window._bg3CombatLogBanner = `
            <div style="background:#3a1818; border-left:4px solid #ef4444; padding:10px 14px; border-radius:8px; margin-bottom:10px; font-size:0.92rem; color:#fca5a5; display:flex; justify-content:space-between; align-items:center;">
                <span>👹 Ход врага: «<b>${enemyTok.name}</b>» атакует «<b>${targetChar.name}</b>»! Попадание: <b>${totalAtk}</b> (против КБ ${targetAC}) ${isCrit ? '<b>[КРИТ!]</b>' : ''} -> Нанесено <b style="color:#fff;">${dmg} урона</b>! (У ${targetChar.name} осталось ${targetChar.hp}/${targetChar.maxHp} ХП)</span>
                <button class="btn-small" style="padding:2px 6px;" onclick="window._bg3CombatLogBanner=''; RENDER_BG3_COMBAT_HUD();">✕</button>
            </div>`;
        LOG_COMBAT_TO_CHAT(`👹 «${enemyTok.name}» атакует «${targetChar.name}»! Попадание: ${totalAtk} (КБ ${targetAC}) -> Урон: ${dmg} (ХП ${targetChar.name}: ${targetChar.hp}/${targetChar.maxHp})`);
    } else {
        window._bg3CombatLogBanner = `
            <div style="background:#22201d; border-left:4px solid #eab308; padding:10px 14px; border-radius:8px; margin-bottom:10px; font-size:0.92rem; color:#fde047; display:flex; justify-content:space-between; align-items:center;">
                <span>🛡️ Ход врага: «<b>${enemyTok.name}</b>» атакует «<b>${targetChar.name}</b>», но <b>ПРОМАХИВАЕТСЯ</b>! (Бросок ${totalAtk} против КБ ${targetAC})</span>
                <button class="btn-small" style="padding:2px 6px;" onclick="window._bg3CombatLogBanner=''; RENDER_BG3_COMBAT_HUD();">✕</button>
            </div>`;
        LOG_COMBAT_TO_CHAT(`👹 «${enemyTok.name}» атакует «${targetChar.name}», но промахивается (${totalAtk} против КБ ${targetAC}).`);
    }

    RMC();
    GM_NEXT_TURN();
}

// ВАЖНО: В RENDER_MAP_AREA больше НЕТ SAVE_MAP_STATE(st) — устранена бесконечная рассылка пакетов при отрисовке!
const _ORIG_RENDER_MAP_AREA_BG3 = RENDER_MAP_AREA;
RENDER_MAP_AREA = function() {
    _ORIG_RENDER_MAP_AREA_BG3();
    const st = GET_MAP_STATE();
    SYNC_PLAYER_TOKENS_WITH_CHARS(st);

    const mapArea = document.getElementById('map-area');
    if (mapArea && st.tokens && st.tokens.length > 0 && st.turnOrder && st.turnOrder.active) {
        const curTurnIdx = (st.turnOrder.currentIdx || 0) % st.tokens.length;
        const selectedEl = document.getElementById('map-tok-' + window._bg3SelectedTargetIdx);
        if (selectedEl) {
            const circle = selectedEl.querySelector('div');
            if (circle) {
                circle.style.outline = '3px dashed #ef4444';
                circle.style.outlineOffset = '3px';
            }
        }

        let bg3TurnRibbon = document.getElementById('bg3-initiative-ribbon');
        if (!bg3TurnRibbon) {
            bg3TurnRibbon = document.createElement('div');
            bg3TurnRibbon.id = 'bg3-initiative-ribbon';
            mapArea.appendChild(bg3TurnRibbon);
        }
        bg3TurnRibbon.style.cssText = 'position:absolute; top:8px; left:50%; transform:translateX(-50%); z-index:9; display:flex; align-items:center; gap:6px; background:rgba(15,14,13,0.94); border:1px solid #c9a96e; padding:6px 12px; border-radius:10px; box-shadow:0 8px 24px rgba(0,0,0,0.9); max-width:96%; overflow-x:auto;';

        let cardsHTML = `<div style="color:#c9a96e; font-weight:bold; font-size:0.8rem; margin-right:4px; white-space:nowrap;">Раунд ${st.turnOrder.round || 1}</div>`;
        st.tokens.forEach((tok, idx) => {
            const isCur = (idx === curTurnIdx);
            const isDead = (tok.hp <= 0);
            const borderCol = isCur ? '#facc15' : (tok.isPlayer ? '#4cd964' : '#ef4444');
            cardsHTML += `
                <div onclick="event.stopPropagation(); window._bg3SelectedTargetIdx=${idx}; RENDER_MAP_AREA();"
                     title="Кликните, чтобы выбрать «${tok.name}» целью атаки"
                     style="cursor:pointer; display:flex; align-items:center; gap:6px; padding:4px 8px; border-radius:8px; background:${isCur ? '#332b17' : '#1c1a17'}; border:2px solid ${borderCol}; opacity:${isDead ? '0.35' : '1'}; transform:${isCur ? 'scale(1.06)' : 'none'}; transition:all 0.15s; flex-shrink:0;">
                    <span style="font-size:1.1rem;">${tok.icon || (tok.isPlayer ? '🛡️' : '👹')}</span>
                    <div style="text-align:left; line-height:1.1;">
                        <div style="font-size:0.76rem; font-weight:bold; color:${isCur ? '#fef08a' : '#ebe8e2'}; white-space:nowrap;">${tok.name}</div>
                        <div style="font-size:0.68rem; color:${tok.isPlayer ? '#86efac' : '#fca5a5'};">❤️ ${tok.hp}/${tok.maxHp}</div>
                    </div>
                </div>
            `;
        });
        bg3TurnRibbon.innerHTML = cardsHTML;
    }

    RENDER_BG3_COMBAT_HUD();
};

// ================================================================
// 🎮 БОЕВОЙ ХОТБАР В СТИЛЕ BALDUR'S GATE 3 ПОД КАРТОЙ
// ================================================================
function RENDER_BG3_COMBAT_HUD() {
    const sess = GET_SESSION();
    const centerCol = document.getElementById('center-column');
    if (!centerCol) return;

    let hudBox = document.getElementById('bg3-player-combat-hud');
    if (!hudBox) {
        hudBox = document.createElement('div');
        hudBox.id = 'bg3-player-combat-hud';
        const mapPanel = centerCol.querySelector('.panel');
        if (mapPanel) mapPanel.appendChild(hudBox);
    }

    if (!sess || sess.role !== 'player') {
        hudBox.style.display = 'none';
        return;
    }
    hudBox.style.display = 'block';

    SYNC_MY_PLAYER_INDEX();
    const cs = GC();
    const c = cs[PI];
    if (!c) return;
    const st = GET_MAP_STATE();
    SYNC_PLAYER_TOKENS_WITH_CHARS(st);

    if (!c.inCombat) {
        hudBox.innerHTML = `
            <div style="margin-top:12px; display:flex; justify-content:space-between; align-items:center; background:#181715; border:1px solid #423c33; padding:10px 16px; border-radius:10px; gap:10px; flex-wrap:wrap;">
                <span style="color:#aba498; font-size:0.92rem;">🕊️ Вы вне боя. Хотите внезапно атаковать цель и начать сражение?</span>
                <button class="btn-danger" style="padding:9px 18px;" onclick="OPEN_AMBUSH_MODAL()">
                    🗡️ Внезапная атака / Начать бой
                </button>
            </div>
        `;
        return;
    }

    const tokens = st.tokens || [];
    const to = ENSURE_TURN_STATE(st);
    const curTurnIdx = tokens.length > 0 ? (to.currentIdx % tokens.length) : 0;
    const activeTurnTok = tokens[curTurnIdx] || null;

    const isMyTurn = !tokens.length || (activeTurnTok && activeTurnTok.isPlayer && activeTurnTok.charIdx === PI);
    const isEnemyTurn = activeTurnTok && !activeTurnTok.isPlayer;

    if (!tokens[window._bg3SelectedTargetIdx] || (tokens[window._bg3SelectedTargetIdx].isPlayer && tokens[window._bg3SelectedTargetIdx].charIdx === PI)) {
        const firstEnemyIdx = tokens.findIndex((t) => (!t.isPlayer || t.charIdx !== PI) && t.hp > 0);
        if (firstEnemyIdx !== -1) window._bg3SelectedTargetIdx = firstEnemyIdx;
    }

    let targetsPillsHTML = '';
    tokens.forEach((tok, idx) => {
        if (tok.isPlayer && tok.charIdx === PI) return;
        if (tok.hp <= 0) return;
        const isSel = (idx === window._bg3SelectedTargetIdx);
        const isEnemy = !tok.isPlayer;
        targetsPillsHTML += `
            <button class="btn-small" onclick="window._bg3SelectedTargetIdx=${idx}; RENDER_MAP_AREA();"
                style="background:${isSel ? '#7f1d1d' : '#181715'}; color:#fff; border:2px solid ${isSel ? '#facc15' : (isEnemy ? '#ef4444' : '#38bdf8')}; padding:4px 10px; border-radius:8px; font-size:0.82rem; display:inline-flex; align-items:center; gap:5px;">
                <span>${isSel ? '🎯' : (tok.icon || (isEnemy ? '👹' : '🛡️'))}</span>
                <b>${tok.name}</b>
                <small style="color:#fca5a5;">(${tok.hp}/${tok.maxHp} ХП • КБ ${tok.ac || 12})</small>
            </button>
        `;
    });

    if (!targetsPillsHTML) {
        targetsPillsHTML = `<span style="color:#888; font-size:0.85rem;">На карте нет целей (Мастер может выставить врагов в Бестиарии)</span>`;
    }

    const pb = GPB(c.level || 1);
    const sm = GM(c.str || 10), dm = GM(c.dex || 10);
    const cat = window._bg3HotbarCategory || 'weapons';

    let hotbarButtonsHTML = '';
    if (cat === 'weapons') {
        const eqWeapons = (c.inventory || []).map((item, idx) => ({ item, idx })).filter(x => x.item.isWeapon && x.item.equipped);
        eqWeapons.forEach(({ item, idx }) => {
            const am = item.finesse ? Math.max(sm, dm) : (item.ranged ? dm : sm);
            const canAtk = isMyTurn && to.attacksLeft > 0;
            hotbarButtonsHTML += `
                <button class="btn-cast" ${!canAtk ? 'disabled style="opacity:0.45;"' : ''} onclick="BG3_PLAYER_USE_WEAPON(${idx})"
                    style="padding:8px 12px; display:flex; flex-direction:column; align-items:flex-start; gap:2px; min-width:135px; background:#2b231d; border:1px solid #c9a96e;">
                    <span style="font-weight:bold; color:#e6c88c;">${item.icon || '⚔️'} ${item.name}</span>
                    <small style="color:#86efac;">Попадание ${MS(am + pb)} | ${item.damage || '1к4'}${MS(am)}</small>
                </button>
            `;
        });
        const unarmedDmg = (c.chosenFeats && c.chosenFeats.includes('Драчун')) ? `1к4${MS(sm)}` : `${Math.max(1, 1 + sm)}`;
        const canUnarmed = isMyTurn && to.attacksLeft > 0;
        hotbarButtonsHTML += `
            <button class="btn-cast" ${!canUnarmed ? 'disabled style="opacity:0.45;"' : ''} onclick="BG3_PLAYER_UNARMED()"
                style="padding:8px 12px; display:flex; flex-direction:column; align-items:flex-start; gap:2px; min-width:130px; background:#25221e; border:1px solid #665c4e;">
                <span style="font-weight:bold; color:#fff;">👊 Рукопашная</span>
                <small style="color:#ccc;">Попадание ${MS(sm + pb)} | Урон ${unarmedDmg}</small>
            </button>
        `;
    } else if (cat === 'spells') {
        const known = c.knownSpells || [];
        const mySpells = gameData.spells.filter(sp => known.includes(sp.name));
        if (mySpells.length === 0) {
            hotbarButtonsHTML = `<span style="color:#777; font-size:0.85rem;">Нет изученных заклинаний</span>`;
        } else {
            mySpells.forEach(sp => {
                const isBonus = (sp.time || '').toLowerCase().includes('бонус');
                const canCast = isMyTurn && (isBonus ? to.bonusLeft > 0 : to.actionsLeft > 0);
                hotbarButtonsHTML += `
                    <button class="btn-cast" ${!canCast ? 'disabled style="opacity:0.45;"' : ''} onclick="BG3_PLAYER_CAST_SPELL('${sp.name}')"
                        style="padding:7px 11px; display:flex; flex-direction:column; align-items:flex-start; gap:2px; min-width:135px; background:#1e1b2e; border:1px solid #a855f7;">
                        <span style="font-weight:bold; color:#e9d5ff;">✨ ${sp.name}</span>
                        <small style="color:#c4b5fd;">${sp.level === 0 ? 'Заговор' : sp.level + ' круг'} • ${isBonus ? '🔶 Бонус' : '🟢 Действие'}</small>
                    </button>
                `;
            });
        }
    } else if (cat === 'items') {
        const potions = (c.inventory || []).map((item, idx) => ({ item, idx })).filter(x => GET_ITEM_TYPE(x.item) === 'potion');
        if (potions.length === 0) {
            hotbarButtonsHTML = `<span style="color:#777; font-size:0.85rem;">В рюкзаке нет зелий</span>`;
        } else {
            potions.forEach(({ item, idx }) => {
                const canDrink = isMyTurn && to.bonusLeft > 0;
                hotbarButtonsHTML += `
                    <button class="btn-cast" ${!canDrink ? 'disabled style="opacity:0.45;"' : ''} onclick="BG3_PLAYER_DRINK_POTION(${idx})"
                        style="padding:7px 11px; display:flex; flex-direction:column; align-items:flex-start; gap:2px; min-width:135px; background:#1a2e22; border:1px solid #4cd964;">
                        <span style="font-weight:bold; color:#86efac;">🧪 ${item.name} (×${item.qty || 1})</span>
                        <small style="color:#a7f3d0;">🔶 Бонусное действие</small>
                    </button>
                `;
            });
        }
    }

    const turnStatusHTML = isMyTurn
        ? `<span style="color:#4cd964; font-weight:bold;">🟢 ВАШ ХОД!</span> <small style="color:#ccc;">(Действий: <b>${to.actionsLeft}</b> | Атак: <b>${to.attacksLeft}</b> | Бонусных: <b>${to.bonusLeft}</b>)</small>`
        : (isEnemyTurn
            ? `<span style="color:#ef4444; font-weight:bold;">👹 Ходит враг: ${activeTurnTok ? activeTurnTok.name : 'Монстр'}</span> <button class="btn-small btn-danger" style="margin-left:8px; padding:3px 9px;" onclick="BG3_EXECUTE_ENEMY_AI_TURN()">⚡ Выполнить ход за врага</button>`
            : `<span style="color:#eab308; font-weight:bold;">⏳ Сейчас ходит союзник: ${activeTurnTok ? activeTurnTok.name : 'Герой'}</span>`);

    hudBox.innerHTML = `
        <div style="margin-top:12px; background:linear-gradient(180deg, #1f1c18 0%, #141210 100%); border:2px solid ${isMyTurn ? '#c9a96e' : '#3d3830'}; border-radius:12px; padding:12px 14px; box-shadow:0 8px 24px rgba(0,0,0,0.85);">
            ${window._bg3CombatLogBanner || ''}
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; border-bottom:1px solid #332e27; padding-bottom:8px; margin-bottom:8px;">
                <div>${turnStatusHTML}</div>
                <div style="display:flex; gap:6px;">
                    <button class="btn-small ${isMyTurn ? 'btn-save' : ''}" onclick="GM_NEXT_TURN()">⏭️ Завершить ход</button>
                </div>
            </div>

            <div style="display:flex; align-items:center; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
                <span style="color:#c9a96e; font-size:0.82rem; font-weight:bold;">🎯 Цель на карте:</span>
                ${targetsPillsHTML}
            </div>

            <div style="display:flex; gap:6px; margin-bottom:8px;">
                <button class="btn-small" style="background:${cat==='weapons'?'#c9a96e':'#26231f'}; color:${cat==='weapons'?'#141210':'#ccc'};" onclick="window._bg3HotbarCategory='weapons'; RENDER_BG3_COMBAT_HUD();">⚔️ Оружие</button>
                <button class="btn-small" style="background:${cat==='spells'?'#c9a96e':'#26231f'}; color:${cat==='spells'?'#141210':'#ccc'};" onclick="window._bg3HotbarCategory='spells'; RENDER_BG3_COMBAT_HUD();">✨ Заклинания</button>
                <button class="btn-small" style="background:${cat==='items'?'#c9a96e':'#26231f'}; color:${cat==='items'?'#141210':'#ccc'};" onclick="window._bg3HotbarCategory='items'; RENDER_BG3_COMBAT_HUD();">🧪 Зелья</button>
            </div>

            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:stretch;">
                ${hotbarButtonsHTML}
            </div>
        </div>
    `;
}

function BG3_APPLY_DAMAGE_TO_SELECTED_TOKEN(dmg, atkTotal, isCrit, actionTitle) {
    const st = GET_MAP_STATE();
    SYNC_PLAYER_TOKENS_WITH_CHARS(st);
    const tokens = st.tokens || [];
    const targetTok = tokens[window._bg3SelectedTargetIdx];
    const cs = GC();
    const attacker = cs[PI];

    if (!targetTok) {
        LOG_COMBAT_TO_CHAT(`⚔️ «${attacker.name}» использует «${actionTitle}» | Попадание: ${atkTotal} | Урон: ${dmg}`);
        return;
    }

    const targetAC = targetTok.ac || 12;
    const isHit = isCrit || (atkTotal >= targetAC);

    if (isHit) {
        targetTok.hp = Math.max(0, (targetTok.hp || 0) - dmg);
        if (targetTok.isPlayer && cs[targetTok.charIdx]) {
            cs[targetTok.charIdx].hp = targetTok.hp;
            SC(cs);
        }
        SAVE_MAP_STATE(st);
        const deadNote = targetTok.hp <= 0 ? ' 💀 <b>ЦЕЛЬ ПОВЕРЖЕНА!</b>' : ` (Осталось ${targetTok.hp}/${targetTok.maxHp} ХП)`;
        window._bg3CombatLogBanner = `
            <div style="background:#192e1e; border-left:4px solid #4cd964; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#d8f3dc;">
                🎯 <b>${actionTitle}</b> по «<b>${targetTok.name}</b>»: Попадание <b>${atkTotal}</b> (против КБ ${targetAC}) ${isCrit ? '💥 <b>КРИТ!</b>' : ''} -> Нанесено <b>${dmg} урона</b>!${deadNote}
            </div>`;
        LOG_COMBAT_TO_CHAT(`⚔️ «${attacker.name}» (${actionTitle}) атакует «${targetTok.name}»: Попадание ${atkTotal} (КБ ${targetAC}) -> Нанесено ${dmg} урона!${targetTok.hp <= 0 ? ' [ПОВЕРЖЕН]' : ''}`);
    } else {
        window._bg3CombatLogBanner = `
            <div style="background:#2d2118; border-left:4px solid #f59e0b; padding:8px 12px; border-radius:6px; margin-bottom:8px; font-size:0.9rem; color:#fde68a;">
                🛡️ <b>${actionTitle}</b> по «<b>${targetTok.name}</b>»: <b>ПРОМАХ!</b> (Бросок ${atkTotal} против КБ ${targetAC})
            </div>`;
        LOG_COMBAT_TO_CHAT(`🛡️ «${attacker.name}» (${actionTitle}) промахивается по «${targetTok.name}» (Бросок ${atkTotal} против КБ ${targetAC}).`);
    }
}

function BG3_PLAYER_USE_WEAPON(invIdx) {
    const cs = GC();
    const c = cs[PI];
    const item = c && c.inventory && c.inventory[invIdx];
    if (!item) return;

    const st = GET_MAP_STATE();
    const to = ENSURE_TURN_STATE(st);
    if (to.attacksLeft <= 0) return;

    const pb = GPB(c.level || 1);
    const sm = GM(c.str || 10), dm = GM(c.dex || 10);
    const am = item.finesse ? Math.max(sm, dm) : (item.ranged ? dm : sm);
    const d20 = Math.floor(Math.random() * 20) + 1;
    const atkTotal = d20 + am + pb;
    const isCrit = (d20 === 20);
    let dmg = Math.max(1, ROLL(item.damage || '1к4') + am);
    if (isCrit) dmg += ROLL(item.damage || '1к4');

    to.attacksLeft = Math.max(0, to.attacksLeft - 1);
    if (to.attacksLeft === 0) to.actionsLeft = 0;
    SAVE_MAP_STATE(st);

    BG3_APPLY_DAMAGE_TO_SELECTED_TOKEN(dmg, d20 === 1 ? 1 : atkTotal, isCrit, item.name);
    RMC();
    RENDER_MAP_AREA();
}

function BG3_PLAYER_UNARMED() {
    const cs = GC();
    const c = cs[PI];
    if (!c) return;

    const st = GET_MAP_STATE();
    const to = ENSURE_TURN_STATE(st);
    if (to.attacksLeft <= 0) return;

    const pb = GPB(c.level || 1);
    const sm = GM(c.str || 10);
    const d20 = Math.floor(Math.random() * 20) + 1;
    const atkTotal = d20 + sm + pb;
    const isCrit = (d20 === 20);
    const dmg = (c.chosenFeats && c.chosenFeats.includes('Драчун')) ? Math.max(1, Math.floor(Math.random() * 4) + 1 + sm) : Math.max(1, 1 + sm);

    to.attacksLeft = Math.max(0, to.attacksLeft - 1);
    if (to.attacksLeft === 0) to.actionsLeft = 0;
    SAVE_MAP_STATE(st);

    BG3_APPLY_DAMAGE_TO_SELECTED_TOKEN(isCrit ? dmg * 2 : dmg, d20 === 1 ? 1 : atkTotal, isCrit, 'Безоружный удар');
    RMC();
    RENDER_MAP_AREA();
}

function BG3_PLAYER_CAST_SPELL(spellName) {
    const cs = GC();
    const c = cs[PI];
    const sp = gameData.spells.find(s => s.name === spellName);
    if (!c || !sp) return;

    const st = GET_MAP_STATE();
    const to = ENSURE_TURN_STATE(st);
    const isBonus = (sp.time || '').toLowerCase().includes('бонус');
    if (isBonus && to.bonusLeft <= 0) return;
    if (!isBonus && to.actionsLeft <= 0) return;

    CAST_SPELL(spellName);

    const freshSt = GET_MAP_STATE();
    const freshTo = ENSURE_TURN_STATE(freshSt);
    if (isBonus) freshTo.bonusLeft = Math.max(0, freshTo.bonusLeft - 1);
    else { freshTo.actionsLeft = 0; freshTo.attacksLeft = 0; }
    SAVE_MAP_STATE(freshSt);
    RENDER_MAP_AREA();
}

function BG3_PLAYER_DRINK_POTION(invIdx) {
    const st = GET_MAP_STATE();
    const to = ENSURE_TURN_STATE(st);
    if (to.bonusLeft <= 0) return;

    ctxItem = invIdx;
    CA('use');

    const freshSt = GET_MAP_STATE();
    const freshTo = ENSURE_TURN_STATE(freshSt);
    freshTo.bonusLeft = Math.max(0, freshTo.bonusLeft - 1);
    SAVE_MAP_STATE(freshSt);
    RENDER_MAP_AREA();
}

function OPEN_AMBUSH_MODAL() {
    const cs = GC();
    const bestiary = GET_BESTIARY();
    const vn = GET_ACTIVE_VN_DIALOG();
    const cont = document.getElementById('gm-tool-modal-content');
    cont.style.maxWidth = '640px';

    let ambushTargetsHTML = '';
    if (vn && vn.active && vn.name) {
        ambushTargetsHTML += `
            <button class="btn-danger" style="width:100%; padding:12px; text-align:left; margin-bottom:8px;" onclick="START_PLAYER_AMBUSH('${vn.name.replace(/'/g, "\\'")}', '🎭', 35, 14)">
                🗡️ Напасть на собеседника: <b>${vn.name}</b> (${vn.role || 'NPC'})
            </button>`;
    }

    bestiary.forEach(m => {
        ambushTargetsHTML += `
            <button class="btn-small" style="width:100%; padding:10px; text-align:left; margin-bottom:6px; display:flex; justify-content:space-between;" onclick="START_PLAYER_AMBUSH('${m.name.replace(/'/g, "\\'")}', '${m.icon || '👹'}', ${m.hp || 20}, ${m.ac || 13})">
                <span>${m.icon || '👹'} <b>${m.name}</b> (ХП ${m.hp}, КБ ${m.ac})</span>
                <span style="color:#ef4444;">⚔️ Атаковать</span>
            </button>`;
    });

    cs.forEach((member, idx) => {
        if (idx === PI) return;
        ambushTargetsHTML += `
            <button class="btn-small" style="width:100%; padding:10px; text-align:left; margin-bottom:6px; display:flex; justify-content:space-between;" onclick="START_PLAYER_AMBUSH_PARTY_DUEL(${idx})">
                <span>🛡️ <b>${member.name || 'Союзник'}</b> (Дуэль / PvP с игроком отряда)</span>
                <span style="color:#f59e0b;">⚔️ Вызвать на бой</span>
            </button>`;
    });

    cont.innerHTML = `
        <h2>🗡️ Внезапная атака (Инициация боя)</h2>
        <p style="color:#aba498; font-size:0.92rem; margin-bottom:14px;">
            Выберите, на кого вы хотите напасть. Отряд автоматически перейдёт в пошаговый боевой режим, а вы получите право первого удара!
        </p>
        <div style="max-height:340px; overflow-y:auto; margin-bottom:14px;">
            ${ambushTargetsHTML}
        </div>
        <div style="text-align:right;"><button onclick="CM('gm-tool-modal')">Отмена</button></div>
    `;
    OM('gm-tool-modal');
}

function START_PLAYER_AMBUSH(enemyName, icon, hp, ac) {
    CM('gm-tool-modal');
    const cs = GC();
    cs.forEach(m => { m.inCombat = true; });
    SC(cs);

    SAVE_ACTIVE_VN_DIALOG(null);
    GM_SPAWN_PARTY_TOKENS();

    const st = GET_MAP_STATE();
    st.tokens.push({
        id: Date.now() + 999,
        isPlayer: false,
        name: enemyName,
        icon: icon || '👹',
        x: 50,
        y: 32,
        hp: hp || 25,
        maxHp: hp || 25,
        ac: ac || 13,
        atkBonus: 5,
        dmgFormula: '1к8+3',
        init: 10
    });

    const myTokIdx = st.tokens.findIndex(t => t.isPlayer && t.charIdx === PI);
    st.turnOrder = {
        active: true,
        round: 1,
        currentIdx: myTokIdx !== -1 ? myTokIdx : 0,
        actionsLeft: 1,
        attacksLeft: GET_MAX_ATTACKS_PER_ACTION(cs[PI]),
        bonusLeft: 1
    };
    window._bg3SelectedTargetIdx = st.tokens.length - 1;
    SAVE_MAP_STATE(st);

    CANCEL_REST_POLL_IF_COMBAT(cs[PI]?.name || 'Игрок');
    LOG_COMBAT_TO_CHAT(`🗡️ ВНЕЗАПНАЯ АТАКА! «${cs[PI]?.name || 'Герой'}» нападает на «${enemyName}»! Начинается Раунд 1!`);
    RMC();
    RENDER_MAP_AREA();
}

function START_PLAYER_AMBUSH_PARTY_DUEL(targetCharIdx) {
    CM('gm-tool-modal');
    const cs = GC();
    cs.forEach(m => { m.inCombat = true; });
    SC(cs);

    GM_SPAWN_PARTY_TOKENS();
    const st = GET_MAP_STATE();
    const myTokIdx = st.tokens.findIndex(t => t.isPlayer && t.charIdx === PI);
    const targetTokIdx = st.tokens.findIndex(t => t.isPlayer && t.charIdx === targetCharIdx);

    st.turnOrder = {
        active: true,
        round: 1,
        currentIdx: myTokIdx !== -1 ? myTokIdx : 0,
        actionsLeft: 1,
        attacksLeft: GET_MAX_ATTACKS_PER_ACTION(cs[PI]),
        bonusLeft: 1
    };
    if (targetTokIdx !== -1) window._bg3SelectedTargetIdx = targetTokIdx;
    SAVE_MAP_STATE(st);

    LOG_COMBAT_TO_CHAT(`⚔️ «${cs[PI]?.name || 'Герой'}» вступает в поединок против «${cs[targetCharIdx]?.name || 'Союзника'}»!`);
    RMC();
    RENDER_MAP_AREA();
}

// Гарантирует, что у каждого персонажа в массиве есть все обязательные поля для корректного открытия Листа (OCS)
function ENSURE_ALL_CHARS_VALID() {
    const cs = GC();
    let fixed = false;
    cs.forEach((c, idx) => {
        if (!c) return;
        if (!c.id) { c.id = 'hero_' + idx + '_' + (c.name || 'char'); fixed = true; }
        if (!c.usedSpellSlots) { c.usedSpellSlots = {1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0}; fixed = true; }
        if (!c.usedSpells) { c.usedSpells = {}; fixed = true; }
        if (!c.chosenSkills) { c.chosenSkills = []; fixed = true; }
        if (!c.knownSpells) { c.knownSpells = []; fixed = true; }
        if (!c.inventory) { c.inventory = []; fixed = true; }
        if (!c.money) { c.money = { gp: 0, sp: 0, cp: 0 }; fixed = true; }
        if (!c.chosenLanguages) { c.chosenLanguages = {}; fixed = true; }
    });
    if (fixed) {
        try { localStorage.setItem('dnd_characters', JSON.stringify(cs)); } catch (e) {}
    }
}

// Перестраховка для окна «Атаки и заклинания» (OAT), чтобы оно всегда открывалось для текущего игрока
const _ORIG_OAT = OAT;
OAT = function() {
    const sess = GET_SESSION();
    if (sess && sess.role === 'player') SYNC_MY_PLAYER_INDEX();
    ENSURE_ALL_CHARS_VALID();
    _ORIG_OAT();
};

ENSURE_ALL_CHARS_VALID();
APPLY_ROLE_VIEW();