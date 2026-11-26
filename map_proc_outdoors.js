// ================================================================
// 🌍 ПРОЦЕДУРНЫЙ ГЕНЕРАТОР УЛИЧНЫХ ЛОКАЦИЙ V6 (БЕЗ ШАБЛОНОВ, СЛОИ + ЛОГИКА)
// Покрывает: Город, Снег, Поле битвы, Лес, Пираты, Пустыня, Фейский лес, Лагерь
// ================================================================
(function INSTALL_TRUE_PROCEDURAL_OUTDOORS_V6() {
    const _PREV_GEN = MB_GENERATE_RANDOM;
    const TARGETS = ['city', 'battlefield', 'forest', 'pirate', 'desert', 'fey', 'warcamp', 'snow'];

    MB_GENERATE_RANDOM = function(biome) {
        const allBiomes = ['tavern', 'city', 'battlefield', 'forest', 'dungeon', 'mansion', 'dwarven', 'pirate', 'desert', 'fey', 'eastern', 'warcamp', 'snow'];
        const picked = (biome === 'random' || !biome) ? MB_PICK_NEXT_VARIANT('_global', allBiomes) : biome;
        if (!TARGETS.includes(picked)) return _PREV_GEN(picked);

        MB_PUSH_UNDO();
        const cols = window._mbCols, rows = window._mbRows;

        // Гармоничная палитра покрытий для текущего клика
        const T = {
            grass:     Math.random() < 0.25 ? MB_PICK_TILE_FAMILY('moss', 'grass') : MB_PICK_TILE_FAMILY('grass', 'grass'),
            dirt:      MB_PICK_TILE_FAMILY('dirt', 'dirt'),
            stone:     MB_PICK_TILE_FAMILY('stone', 'stone'),
            flagstone: MB_PICK_TILE_FAMILY('flagstone', 'stone'),
            cobble:    MB_PICK_TILE_FAMILY('cobble', 'stone'),
            wall:      MB_PICK_TILE_FAMILY('wall', 'wall'),
            snow:      MB_PICK_TILE_FAMILY('snow', 'snow'),
            ice:       MB_PICK_TILE_FAMILY('ice', 'snow'),
            water:     'water',
            sand:      'sand',
            leafG:     'leaves_green',
            leafR:     'leaves_red'
        };
        if (T.flagstone === T.cobble) T.flagstone = T.stone;

        const baseMap = {
            city: T.cobble, battlefield: T.grass, forest: T.grass,
            pirate: T.sand, desert: T.sand, fey: T.grass, warcamp: T.grass, snow: T.snow
        };
        const lightMap = {
            city:        ['day', 'day', 'sunset', 'night'],
            battlefield: ['sunset', 'day', 'sunset'],
            forest:      ['day', 'day', 'sunset'],
            pirate:      ['day', 'day', 'sunset'],
            desert:      ['day', 'sunset'],
            fey:         ['night', 'night', 'sunset'],
            warcamp:     ['sunset', 'night', 'day'],
            snow:        ['day', 'day', 'night']
        };
        window._mbLighting = MB_PICK(lightMap[picked] || ['day']);
        const data = CREATE_EMPTY_MB_DATA(baseMap[picked] || T.grass, cols, rows);
        data.lighting = window._mbLighting;

        const inB = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows;
        const getT = (c, r) => inB(c, r) ? data.cells[r * cols + c].t : null;
        const setT = (c, r, t) => { if (inB(c, r)) data.cells[r * cols + c].t = t; };
        const isWall = (c, r) => /^wall/.test(getT(c, r) || '');
        const isWater = (c, r) => /^water/.test(getT(c, r) || '');

        const fillRect = (x1, y1, x2, y2, t, onlyOn = null) => {
            for (let r = Math.max(0, Math.floor(y1)); r <= Math.min(rows - 1, Math.floor(y2)); r++)
                for (let c = Math.max(0, Math.floor(x1)); c <= Math.min(cols - 1, Math.floor(x2)); c++) {
                    if (onlyOn && !onlyOn.includes(getT(c, r))) continue;
                    setT(c, r, t);
                }
        };

        const placedZones = [];
        const canPlace = (x, y, minDist = 1.0) => {
            if (!inB(Math.floor(x), Math.floor(y))) return false;
            return !placedZones.some(z => Math.hypot(z.x - x, z.y - y) < Math.max(minDist, z.r));
        };
        const addObj = (poolOrId, x, y, scale = 1.0, rot = 0, reserve = 0) => {
            const id = Array.isArray(poolOrId) ? MB_PICK(poolOrId) : poolOrId;
            if (!id) return false;
            const stObj = MB_FIND_STAMP_OBJ(id);
            if (!stObj) return false;
            if (stObj.img) MB_GET_LOADED_IMG(stObj.img, false);
            data.objects.push({ id, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, scale, rot: Math.round(rot) });
            if (reserve > 0) placedZones.push({ x, y, r: reserve });
            return true;
        };

        // --- ЧИСТЫЕ ПРОВЕРЕННЫЕ ПУЛЫ СПРАЙТОВ (БЕЗ ЛИШНИХ И БИТЫХ ЭЛЕМЕНТОВ) ---
        const P = {
            trees:        MB_GET_POOL(/^nature_tree_(large|small|big|bigger|[123])$|^nature_tree_(large|small)_[12]$/),
            bushes:       MB_GET_POOL(/^nature_bush_(2|3|4|5|6|7|8)_green|^nature_bush_shrub_|^nature_bush_[12]$|^nature_thick_foliage_|^other_fern_/),
            autumnBushes: MB_GET_POOL(/^nature_bush_1_red$|^nature_bush_9_yellow$|^other_leaf_litter_/),
            flowers:      MB_GET_POOL(/^nature_flower_[1-7]|^nature_flowers_[1-6]|^other_clovers_/),
            rocks:        MB_GET_POOL(/^nature_mossy_boulder_|^nature_rock(_small)?_[123]$|^nature_rocks_[1-5]$|^nature_boulder$/),
            cliffs:       MB_GET_POOL(/^nature_cliff_[123]$|^nature_rock_formation_[2-6]$|^nature_rock_outcrop$/),
            logs:         MB_GET_POOL(/^nature_fallen_tree_|^nature_stump_[123]$|^nature_tree_stump_[1-5]_cut$|^nature_log_fallen_tree$/),
            deadwood:     MB_GET_POOL(/^other_deadwood3$|^nature_fallen_tree_[12]$|^nature_stump_[123]$|^nature_log_fallen_tree$/),
            fungi:        MB_GET_POOL(/^nature_mushrooms_[123]$|^nature_fungi_(1|3|5|14)_brown$|^nature_mushroom_(6|7)_brown$|^nature_mushroom_11_red$/),
            waterDec:     MB_GET_POOL(/^other_lily_pad|^nature_submerged_rocks_|^nature_river_rock_|^other_current_/),
            waterRocks:   MB_GET_POOL(/^nature_submerged_rocks_[1-4]$|^nature_river_rock_[123]$/),
            woodBridge:   MB_GET_POOL(/^nature_wooden_bridge_section_7x4$/),
            stoneBridge:  MB_GET_POOL(/^nature_stone_bridge_section_7x4$/),

            roofTile:     MB_GET_POOL(/^city_roof_tiled_6x4_shaded$|^city_roof_premade_8x6$/),
            roofThatch:   MB_GET_POOL(/^city_roof_thatch_6x4_shaded$|^city_roof_thatch_6x4$/),
            cityCenter:   MB_GET_POOL(/^city_fountain$|^city_well$|^city_feature_statue_[1-3]_stone$|^city_statue[1-3]$/),
            carts:        MB_GET_POOL(/^city_cart_|^city_wagon$/),
            horses:       MB_GET_POOL(/^other_horse2?$/),
            lamps:        MB_GET_POOL(/^city_woodlamp$|^other_light_stand_lit_iron$/),
            market:       MB_GET_POOL(/^other_apples$|^other_baskets$|^other_clutter_sacks_[12]$|^furniture_storage_crate_[12]_dark$|^furniture_storage_barrel_[12]_dark$|^other_cabbage$/),
            gardens:      MB_GET_POOL(/^other_garden[123]$|^nature_flower[123]$/),
            tables:       MB_GET_POOL(/^furniture_table_(rectangle_[1-3]|long_1)_dark$|^furniture_table_long_1$/),
            barrels:      MB_GET_POOL(/^furniture_storage_barrel_[1-5](_a)?_dark$|^other_keg(5tapped|6)$/),
            crates:       MB_GET_POOL(/^furniture_storage_crate_[1-4]_dark$|^other_clutter_sacks_[12]$|^furniture_crate_[12]$/),
            watchpost:    MB_GET_POOL(/^other_watchpost$/),

            campfires:    MB_GET_POOL(/^camp_campfire(_fire|_pot_cooking)?$/),
            campBigTents: MB_GET_POOL(/^camp_tent_round_large_pavillion$|^camp_tent_large_9x5$|^camp_tentlarge$/),
            campTents:    MB_GET_POOL(/^camp_tent_(round_small|square_[123]|narrow_[12])$|^camp_tent_small_5x4$/),
            campGear:     MB_GET_POOL(/^furniture_bedroll_[123]$|^camp_backpack_|^other_firewood_pile$|^nature_log_seat_[12]$|^nature_stump_axe_chopping$/),

            siege:        MB_GET_POOL(/^camp_ballista$|^camp_weapon_ballista_2x2$|^camp_cannon$|^other_catapult$|^effects_acidcauldron$|^dungeon_pitchcauldron$/),
            siegeAmmo:    MB_GET_POOL(/^camp_cannonballs2?$|^effects_ballistabolts$/),
            barricades:   MB_GET_POOL(/^furniture_barricade$|^other_woodenstakes$/),
            flags:        MB_GET_POOL(/^other_largeflag$/),
            battleLoot:   MB_GET_POOL(/^camp_(greatsword|longsword|weapon_sword|weapon_axe|weapon_shield)/),
            battleFire:   MB_GET_POOL(/^other_embers_5x5$|^other_fiery_area_1_4x4$|^other_flaming_sphere_/),
            rubble:       MB_GET_POOL(/^other_rubble_(small|medium|mixed_3x2|stone_pile_4x3)|^other_ruin_[1-4]_2x2$/),
            collapsed:    MB_GET_POOL(/^other_rubble_collapsed_wall_3x2$|^other_rubble_stone_pile_4x3$/),
            pillars:      MB_GET_POOL(/^dungeon_pillar_(round|square)_1x1$|^dungeon_stone_pillar_[12]$|^dungeon_pillar_base_2$/),
            altars:       MB_GET_POOL(/^dungeon_feature_altar_gold$|^dungeon_tomb_(1|open)$/),
            chests:       MB_GET_POOL(/^dungeon_chest_[12]_(steel|gold)$|^dungeon_chest2$/),
            braziers:     MB_GET_POOL(/^dungeon_light_brazier_[123]_[abc]$|^other_light_stand_lit_iron$/),

            palms:        MB_GET_POOL(/^nature_palmtree2?$|^nature_tree_(large|small)_palm_/),
            pirateLoot:   MB_GET_POOL(/^dungeon_chestoctopus$|^other_coinbag$|^other_coinlarge4$|^camp_pirateflag$|^other_anchor2$|^city_shipswheel$|^furniture_messagebottle$|^other_largerope$/),
            beachLife:    MB_GET_POOL(/^other_(crab|coconutcrab2?|shell|shell8|starfish4?|sharkjaw|parrot|seagull)$/),
            boats:        MB_GET_POOL(/^other_canoe$/),

            desertCacti:  MB_GET_POOL(/^nature_cactus_(ball|flowering|large|saguaro|small)_|^nature_desert_(shrubs|grass)_|^other_aeonium_/),
            desertRocks:  MB_GET_POOL(/^nature_rocks[678]$|^nature_rock_formation_[2-6]$/),
            desertTents:  MB_GET_POOL(/^camp_tent_(large_9x5|small_5x4)$|^camp_tentlarge$/),
            desertProps:  MB_GET_POOL(/^other_pot5?$|^other_deadwood3$|^furniture_carpet_[123]_3x2$|^dungeon_bones_cow_skull_1x1$|^other_snake3?$/),

            feyTrees:     MB_GET_POOL(/^nature_tree[234]$|^other_giantleafpurple/),
            feyFungi:     MB_GET_POOL(/^nature_fungi_(10_purple|2[678]_blue|[89]_orange|1[123]_yellow)$|^nature_mushroom_(5|2[123])_blue$|^other_spore_cloud_/),
            feyDecor:     MB_GET_POOL(/^nature_rootsorb2$|^nature_roots[246]$|^nature_giantroots5$|^nature_trumpetflower$|^dungeon_flytrap2?$|^other_lily[23]?$/),
            feyCrystals:  MB_GET_POOL(/^dungeon_crystal(blue|red)$|^dungeon_crystal_(horizontal|vertical)_/),

            orcTents:     MB_GET_POOL(/^other_shelter$|^camp_tentsmallround$|^camp_tent_square_[123]$/),
            orcProps:     MB_GET_POOL(/^camp_totemlarge$|^dungeon_giantskull$|^dungeon_skullstake$|^other_meatrack$|^other_tanningrack2$|^camp_weaponrack$|^other_warhorn$|^camp_(beaver|wolf|small)pelt$|^camp_campfire_hog$|^dungeon_campfire_cooking_spit$/),

            snowRocks:    MB_GET_POOL(/^nature_rock_[123]$|^nature_rock_small_[12]$|^nature_boulder$|^nature_rocks_[1-5]$/),
            snowPelts:    MB_GET_POOL(/^camp_(wolf|beaver)pelt$|^camp_pelt(wolf|fox)$|^furniture_bedroll_[123]$|^other_firewood_pile$|^nature_stump_axe_chopping$|^nature_log_seat_[12]$/),
            iceCrystals:  MB_GET_POOL(/^dungeon_crystalblue$|^dungeon_crystal_vertical_2x2$/)
        };

        // ============================================================
        // 🧩 УНИВЕРСАЛЬНЫЕ ПРОЦЕДУРНЫЕ ИНСТРУМЕНТЫ
        // ============================================================
        const phaseA = MB_RAND_FLOAT(0, 6.28), phaseB = MB_RAND_FLOAT(0, 6.28);

        function paintBlob(cx, cy, rx, ry, tile, wob = 0.17, onlyOn = null) {
            const rMin = Math.max(0, Math.floor(cy - ry - 3)), rMax = Math.min(rows - 1, Math.ceil(cy + ry + 3));
            const cMin = Math.max(0, Math.floor(cx - rx - 3)), cMax = Math.min(cols - 1, Math.ceil(cx + rx + 3));
            for (let r = rMin; r <= rMax; r++) for (let c = cMin; c <= cMax; c++) {
                if (onlyOn && !onlyOn.includes(getT(c, r))) continue;
                const ang = Math.atan2(r - cy, c - cx);
                const noise = Math.sin(ang * 3 + phaseA) * wob + Math.cos(ang * 5 + phaseB) * (wob * 0.45);
                const d = Math.hypot((c - cx) / Math.max(0.6, rx), (r - cy) / Math.max(0.6, ry));
                if (d <= 1.0 + noise) setT(c, r, tile);
            }
        }

        function randomEdgePoint(side) {
            if (side === 'N') return { x: MB_RAND_FLOAT(cols * 0.16, cols * 0.84), y: 0 };
            if (side === 'S') return { x: MB_RAND_FLOAT(cols * 0.16, cols * 0.84), y: rows - 1 };
            if (side === 'W') return { x: 0, y: MB_RAND_FLOAT(rows * 0.16, rows * 0.84) };
            return { x: cols - 1, y: MB_RAND_FLOAT(rows * 0.16, rows * 0.84) };
        }

        function randomEdgePair(allowDiagonal = true) {
            const pairs = allowDiagonal
                ? [['W', 'E'], ['N', 'S'], ['W', 'N'], ['W', 'S'], ['E', 'N'], ['E', 'S']]
                : [['W', 'E'], ['N', 'S']];
            const [s1, s2] = MB_PICK(pairs);
            return [randomEdgePoint(s1), randomEdgePoint(s2)];
        }

        function carveSpline(p0, p1, radius, tile, opts = {}) {
            const bend = (opts.bend !== undefined ? opts.bend : MB_RAND_FLOAT(-0.26, 0.26));
            const dx = p1.x - p0.x, dy = p1.y - p0.y;
            const len = Math.max(1, Math.hypot(dx, dy));
            const nx = -dy / len, ny = dx / len;
            const ctrl = { x: (p0.x + p1.x) / 2 + nx * len * bend, y: (p0.y + p1.y) / 2 + ny * len * bend };
            const steps = Math.max(24, Math.ceil(len * 3));
            const pts = [];
            for (let i = 0; i <= steps; i++) {
                const t = i / steps, u = 1 - t;
                const x = u * u * p0.x + 2 * u * t * ctrl.x + t * t * p1.x;
                const y = u * u * p0.y + 2 * u * t * ctrl.y + t * t * p1.y;
                const tx = 2 * u * (ctrl.x - p0.x) + 2 * t * (p1.x - ctrl.x);
                const ty = 2 * u * (ctrl.y - p0.y) + 2 * t * (p1.y - ctrl.y);
                const tLen = Math.max(0.01, Math.hypot(tx, ty));
                pts.push({ x, y, ux: tx / tLen, uy: ty / tLen, nx: -ty / tLen, ny: tx / tLen });

                if (opts.skipRanges && opts.skipRanges.some(([a, b]) => t > a && t < b)) continue;

                const rr = Math.ceil(radius + 0.5);
                for (let dr = -rr; dr <= rr; dr++) for (let dc = -rr; dc <= rr; dc++) {
                    const cx = Math.floor(x) + dc, cy = Math.floor(y) + dr;
                    if (!inB(cx, cy)) continue;
                    if (Math.hypot(cx + 0.5 - x, cy + 0.5 - y) <= radius) {
                        if (opts.keepWater && isWater(cx, cy)) continue;
                        if (opts.keepWall && isWall(cx, cy)) continue;
                        if (opts.onlyOn && !opts.onlyOn.includes(getT(cx, cy))) continue;
                        setT(cx, cy, tile);
                    }
                }
            }
            return pts;
        }

        function autoPlaceBridges(roadPts, isStone = false) {
            const pool = isStone ? P.stoneBridge : P.woodBridge;
            let inW = false, startIdx = 0;
            for (let i = 0; i < roadPts.length; i++) {
                const pt = roadPts[i];
                const wet = isWater(Math.floor(pt.x), Math.floor(pt.y));
                if (wet && !inW) { inW = true; startIdx = i; }
                else if ((!wet || i === roadPts.length - 1) && inW) {
                    inW = false;
                    const a = roadPts[startIdx], b = roadPts[wet ? i : i - 1];
                    const span = Math.hypot(b.x - a.x, b.y - a.y) + 1.85;
                    if (span < 1.5) continue;
                    const deg = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
                    const segs = Math.max(1, Math.ceil(span / 3.35));
                    const sc = Math.max(0.76, (span / segs) / 3.4);
                    for (let s = 0; s < segs; s++) {
                        const f = (s + 0.5) / segs;
                        addObj(pool, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, sc, deg, 1.4);
                    }
                }
            }
        }

        function findDrySpot(allowedTiles, margin = 3.5, clearR = 4.0) {
            for (let tries = 0; tries < 36; tries++) {
                const x = MB_RAND_FLOAT(margin, cols - margin);
                const y = MB_RAND_FLOAT(margin, rows - margin);
                const gx = Math.floor(x), gy = Math.floor(y);
                if (!allowedTiles.includes(getT(gx, gy)) || !canPlace(x, y, clearR)) continue;
                const ok = [-2, 0, 2].every(dy => [-2, 0, 2].every(dx => {
                    const t = getT(gx + dx, gy + dy);
                    return t && !isWater(gx + dx, gy + dy) && !isWall(gx + dx, gy + dy);
                }));
                if (ok) return { x, y };
            }
            return null;
        }

        function placeCampCluster(cx, cy, opts = {}) {
            const rad = opts.radius || 3.0;
            if (opts.groundTile) paintBlob(cx, cy, rad, rad * 0.85, opts.groundTile, 0.15, opts.onlyGround || null);
            addObj(opts.firePool || P.campfires, cx, cy, opts.fireScale || 1.12, 0, 1.45);
            const nTents = opts.tents || MB_RAND_INT(2, 4);
            const startAng = MB_RAND_FLOAT(0, 6.28);
            for (let i = 0; i < nTents; i++) {
                const ang = startAng + (i / nTents) * 6.28 + MB_RAND_FLOAT(-0.25, 0.25);
                const dist = MB_RAND_FLOAT(rad * 0.72, rad * 1.0);
                const tx = cx + Math.cos(ang) * dist, ty = cy + Math.sin(ang) * dist;
                if (!inB(Math.floor(tx), Math.floor(ty)) || isWater(Math.floor(tx), Math.floor(ty)) || isWall(Math.floor(tx), Math.floor(ty))) continue;
                if (!canPlace(tx, ty, 1.85)) continue;
                const useBig = (i === 0 && opts.bigTentPool);
                addObj(useBig ? opts.bigTentPool : (opts.tentPool || P.campTents), tx, ty, useBig ? 0.86 : 1.02, (ang * 180 / Math.PI) + 90, 1.9);
            }
            for (let i = 0; i < (opts.props || 3); i++) {
                const ang = MB_RAND_FLOAT(0, 6.28);
                const px = cx + Math.cos(ang) * MB_RAND_FLOAT(1.4, rad * 0.85);
                const py = cy + Math.sin(ang) * MB_RAND_FLOAT(1.4, rad * 0.85);
                if (canPlace(px, py, 1.0) && !isWater(Math.floor(px), Math.floor(py)) && !isWall(Math.floor(px), Math.floor(py))) {
                    addObj(opts.propPool || P.campGear, px, py, 0.9, MB_RAND_INT(0, 359), 0.9);
                }
            }
        }

        function placeRuinsCluster(cx, cy, floorT = T.stone, extraPool = null) {
            const rad = MB_RAND_FLOAT(2.8, 4.2);
            paintBlob(cx, cy, rad, rad * 0.82, floorT, 0.18);
            addObj(P.altars, cx, cy, 1.12, MB_PICK([0, 90, 180, 270]), 1.4);
            if (canPlace(cx + 1.6, cy - 0.6, 0.9)) addObj(P.chests, cx + 1.6, cy - 0.6, 0.88, MB_RAND_INT(0, 359), 0.85);
            const nP = MB_RAND_INT(4, 6);
            for (let i = 0; i < nP; i++) {
                const ang = (i / nP) * 6.28 + 0.35;
                const px = cx + Math.cos(ang) * (rad * 0.78), py = cy + Math.sin(ang) * (rad * 0.68);
                if (inB(Math.floor(px), Math.floor(py)) && canPlace(px, py, 1.0)) {
                    const pool = (i % 2 === 0) ? P.pillars : (extraPool && Math.random() < 0.5 ? extraPool : P.rubble);
                    addObj(pool, px, py, 0.94, MB_RAND_INT(0, 359), 0.95);
                }
            }
        }

        function scatterGroves(allowedTiles, treePool, bushPool, accentPool, density = 1.0) {
            const groves = Math.max(4, Math.floor((cols * rows) / 54 * density));
            for (let g = 0; g < groves; g++) {
                const gx = MB_RAND_FLOAT(1.5, cols - 1.5), gy = MB_RAND_FLOAT(1.5, rows - 1.5);
                if (!allowedTiles.includes(getT(Math.floor(gx), Math.floor(gy)))) continue;
                const count = MB_RAND_INT(3, 6);
                for (let k = 0; k < count; k++) {
                    const ox = gx + MB_RAND_FLOAT(-2.7, 2.7), oy = gy + MB_RAND_FLOAT(-2.3, 2.3);
                    if (!inB(Math.floor(ox), Math.floor(oy))) continue;
                    if (!allowedTiles.includes(getT(Math.floor(ox), Math.floor(oy)))) continue;
                    if (!canPlace(ox, oy, 1.55)) continue;
                    if (k < 3) addObj(treePool, ox, oy, MB_RAND_FLOAT(0.9, 1.32), MB_RAND_INT(0, 359), 1.65);
                    else addObj(bushPool, ox, oy, MB_RAND_FLOAT(0.82, 1.15), MB_RAND_INT(0, 359), 0.95);
                }
            }
            const accents = Math.floor((cols * rows) / 18 * density);
            for (let i = 0; i < accents; i++) {
                const ox = MB_RAND_FLOAT(1.2, cols - 1.2), oy = MB_RAND_FLOAT(1.2, rows - 1.2);
                if (!allowedTiles.includes(getT(Math.floor(ox), Math.floor(oy)))) continue;
                if (!canPlace(ox, oy, 1.1)) continue;
                addObj(accentPool, ox, oy, MB_RAND_FLOAT(0.76, 1.12), MB_RAND_INT(0, 359), 0.85);
            }
        }

        function scatterWaterDetails(pool = P.waterDec, prob = 0.14) {
            for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
                if (isWater(c, r) && canPlace(c + 0.5, r + 0.5, 1.5) && Math.random() < prob) {
                    addObj(pool, c + 0.5, r + 0.5, 0.9, MB_RAND_INT(0, 359), 0.85);
                }
            }
        }

        let genTitle = 'Локация';

        // ============================================================
        // 1. 👑 ГОРОД (КОМПОЗИЦИОННАЯ СЕТЬ УЛИЦ + КАНАЛЫ/СТЕНЫ + УМНАЯ ЗАСТРОЙКА)
        // ============================================================
        if (picked === 'city') {
            const occ = Array.from({ length: rows }, () => new Uint8Array(cols));
            const markOcc = (x1, y1, x2, y2, val = 1) => {
                for (let r = Math.max(0, Math.floor(y1)); r <= Math.min(rows - 1, Math.floor(y2)); r++)
                    for (let c = Math.max(0, Math.floor(x1)); c <= Math.min(cols - 1, Math.floor(x2)); c++) occ[r][c] = val;
            };

            const thatchProb = MB_PICK([0.05, 0.18, 0.35]);
            const hasWall = cols >= 20 && Math.random() < 0.32;
            const hasCanal = Math.random() < (hasWall ? 0.25 : 0.42);
            const hStreets = []; // { y, w, x1, x2 }
            const vStreets = []; // { x, w, y1, y2 }
            let canal = null;    // { horiz, pos, w }
            let wall = null;     // { side, cut, gate }

            // Слой А: Городская стена и зелёный пригород с любой из 4 сторон!
            if (hasWall) {
                const side = MB_PICK(['W', 'E', 'N', 'S']);
                const isVert = (side === 'W' || side === 'E');
                const cut = isVert
                    ? (side === 'W' ? MB_RAND_INT(Math.floor(cols * 0.28), Math.floor(cols * 0.42)) : MB_RAND_INT(Math.floor(cols * 0.56), Math.floor(cols * 0.70)))
                    : (side === 'N' ? MB_RAND_INT(Math.floor(rows * 0.28), Math.floor(rows * 0.40)) : MB_RAND_INT(Math.floor(rows * 0.56), Math.floor(rows * 0.68)));
                const gate = isVert
                    ? MB_RAND_INT(Math.floor(rows * 0.26), Math.floor(rows * 0.74))
                    : MB_RAND_INT(Math.floor(cols * 0.26), Math.floor(cols * 0.74));
                wall = { side, isVert, cut, gate };

                if (side === 'W') { fillRect(0, 0, cut - 1, rows - 1, T.grass); markOcc(0, 0, cut + 1, rows - 1, 2); }
                else if (side === 'E') { fillRect(cut + 2, 0, cols - 1, rows - 1, T.grass); markOcc(cut, 0, cols - 1, rows - 1, 2); }
                else if (side === 'N') { fillRect(0, 0, cols - 1, cut - 1, T.grass); markOcc(0, 0, cols - 1, cut + 1, 2); }
                else { fillRect(0, cut + 2, cols - 1, rows - 1, T.grass); markOcc(0, cut, cols - 1, rows - 1, 2); }
            }

            // Слой Б: Опциональный городской канал (горизонтальный или вертикальный в случайной позиции)
            if (hasCanal) {
                const horiz = wall ? !wall.isVert : (Math.random() < (cols >= rows ? 0.68 : 0.32));
                const cW = (horiz ? rows : cols) >= 18 ? 3 : 2;
                const pos = horiz
                    ? MB_RAND_INT(Math.max(4, Math.floor(rows * 0.28)), Math.min(rows - cW - 4, Math.floor(rows * 0.68)))
                    : MB_RAND_INT(Math.max(4, Math.floor(cols * 0.28)), Math.min(cols - cW - 4, Math.floor(cols * 0.68)));
                canal = { horiz, pos, w: cW };
                if (horiz) {
                    fillRect(0, pos - 1, cols - 1, pos + cW, T.flagstone, [T.cobble]);
                    fillRect(0, pos, cols - 1, pos + cW - 1, T.water);
                    markOcc(0, pos - 1, cols - 1, pos + cW, 2);
                } else {
                    fillRect(pos - 1, 0, pos + cW, rows - 1, T.flagstone, [T.cobble]);
                    fillRect(pos, 0, pos + cW - 1, rows - 1, T.water);
                    markOcc(pos - 1, 0, pos + cW, rows - 1, 2);
                }
            }

            // Слой В: Процедурная сеть улиц (1–3 горизонтальные и 1–3 вертикальные со случайными ответвлениями)
            const addStreet = (isHoriz, pos, w, a = 0, b = null) => {
                const lim = b !== null ? b : (isHoriz ? cols - 1 : rows - 1);
                if (isHoriz) {
                    for (let c = a; c <= lim; c++) for (let dy = 0; dy < w; dy++) {
                        const r = pos + dy;
                        if (!inB(c, r) || isWater(c, r)) continue;
                        setT(c, r, getT(c, r) === T.grass ? T.dirt : T.flagstone);
                    }
                    markOcc(a, pos, lim, pos + w - 1, 2);
                    hStreets.push({ y: pos, w, x1: a, x2: lim });
                } else {
                    for (let r = a; r <= lim; r++) for (let dx = 0; dx < w; dx++) {
                        const c = pos + dx;
                        if (!inB(c, r) || isWater(c, r)) continue;
                        setT(c, r, getT(c, r) === T.grass ? T.dirt : T.flagstone);
                    }
                    markOcc(pos, a, pos + w - 1, lim, 2);
                    vStreets.push({ x: pos, w, y1: a, y2: lim });
                }
            };

            const mainW = cols >= 28 ? 3 : 2;
            if (wall) {
                if (wall.isVert) addStreet(true, Math.max(2, Math.min(rows - 4, wall.gate - 1)), 3);
                else addStreet(false, Math.max(2, Math.min(cols - 4, wall.gate - 1)), 3);
            } else {
                if (!canal || !canal.horiz) addStreet(true, MB_RAND_INT(Math.floor(rows * 0.25), Math.floor(rows * 0.65)), mainW);
                if (!canal || canal.horiz) addStreet(false, MB_RAND_INT(Math.floor(cols * 0.25), Math.floor(cols * 0.65)), mainW);
            }

            // Добавляем 1–3 случайных переулка (или полные, или Т-образные до существующей улицы!)
            const extraCount = cols >= 30 ? MB_RAND_INT(2, 3) : MB_RAND_INT(1, 2);
            for (let i = 0; i < extraCount; i++) {
                const makeH = Math.random() < 0.5;
                if (makeH) {
                    const py = MB_RAND_INT(3, rows - 5);
                    if (hStreets.some(s => Math.abs(s.y - py) < 5)) continue;
                    if (canal && canal.horiz && Math.abs(canal.pos - py) < 5) continue;
                    const tCut = (vStreets.length && Math.random() < 0.45) ? MB_PICK(vStreets) : null;
                    const x1 = tCut && Math.random() < 0.5 ? tCut.x : 0;
                    const x2 = tCut && x1 === 0 ? (tCut.x + tCut.w - 1) : cols - 1;
                    addStreet(true, py, 2, x1, x2);
                } else {
                    const px = MB_RAND_INT(4, cols - 6);
                    if (vStreets.some(s => Math.abs(s.x - px) < 6)) continue;
                    if (canal && !canal.horiz && Math.abs(canal.pos - px) < 6) continue;
                    const tCut = (hStreets.length && Math.random() < 0.45) ? MB_PICK(hStreets) : null;
                    const y1 = tCut && Math.random() < 0.5 ? tCut.y : 0;
                    const y2 = tCut && y1 === 0 ? (tCut.y + tCut.w - 1) : rows - 1;
                    addStreet(false, px, 2, y1, y2);
                }
            }

            // Строим саму крепостную стену с воротами и башнями (поверх улиц)
            if (wall) {
                const { side, isVert, cut, gate } = wall;
                if (isVert) {
                    for (let r = 0; r < rows; r++) if (Math.abs(r - gate) > 1 && !isWater(cut, r)) { setT(cut, r, T.wall); setT(cut + 1, r, T.wall); }
                    const outS = (side === 'W') ? -1 : 1;
                    addObj(P.watchpost, cut + 1.0, Math.max(1.5, gate - 3.0), 1.08, 0, 1.8);
                    addObj(P.watchpost, cut + 1.0, Math.min(rows - 1.5, gate + 3.6), 1.08, 0, 1.8);
                    addObj(P.flags, cut + (side === 'W' ? -0.3 : 2.3), Math.max(1.2, gate - 2.3), 1.0, 0, 0.7);
                    addObj(P.flags, cut + (side === 'W' ? -0.3 : 2.3), Math.min(rows - 1.2, gate + 2.9), 1.0, 0, 0.7);
                    const cartX = Math.max(2.2, Math.min(cols - 2.2, cut + outS * 4.0));
                    if (!isWater(Math.floor(cartX), gate)) {
                        addObj(P.carts, cartX, gate + 0.5, 0.96, side === 'W' ? 0 : 180, 1.6);
                        addObj(P.horses, Math.max(1.2, Math.min(cols - 1.2, cartX - outS * 2.0)), gate + 0.5, 0.9, side === 'W' ? 0 : 180, 1.0);
                    }
                } else {
                    for (let c = 0; c < cols; c++) if (Math.abs(c - gate) > 1 && !isWater(c, cut)) { setT(c, cut, T.wall); setT(c, cut + 1, T.wall); }
                    const outS = (side === 'N') ? -1 : 1;
                    addObj(P.watchpost, Math.max(1.5, gate - 3.0), cut + 1.0, 1.08, 0, 1.8);
                    addObj(P.watchpost, Math.min(cols - 1.5, gate + 3.6), cut + 1.0, 1.08, 0, 1.8);
                    const cartY = Math.max(2.2, Math.min(rows - 2.2, cut + outS * 3.8));
                    if (!isWater(gate, Math.floor(cartY))) addObj(P.carts, gate + 0.5, cartY, 0.96, side === 'N' ? 90 : 270, 1.6);
                }
            }

            // Слой Г: Автоматические каменные мосты на КАЖДОМ пересечении улицы с каналом + лодки в воде!
            if (canal) {
                const placeCityBridge = (x1, y1, x2, y2) => {
                    const horiz = Math.abs(x2 - x1) >= Math.abs(y2 - y1);
                    const span = (horiz ? (x2 - x1 + 1) : (y2 - y1 + 1)) + 1.3;
                    const segs = Math.max(1, Math.ceil(span / 3.4));
                    const sc = Math.max(0.76, (span / segs) / 3.45);
                    for (let i = 0; i < segs; i++) {
                        const f = (i + 0.5) / segs;
                        const bx = horiz ? (x1 - 0.15 + (x2 - x1 + 1.3) * f) : (x1 + 0.5);
                        const by = horiz ? (y1 + 0.5) : (y1 - 0.15 + (y2 - y1 + 1.3) * f);
                        addObj(P.stoneBridge, bx, by, sc, horiz ? 0 : 90, 1.4);
                    }
                };
                if (canal.horiz) {
                    vStreets.forEach(vs => {
                        if (vs.y1 <= canal.pos && vs.y2 >= canal.pos + canal.w - 1) {
                            placeCityBridge(vs.x + (vs.w - 1) / 2, canal.pos, vs.x + (vs.w - 1) / 2, canal.pos + canal.w - 1);
                            addObj(P.lamps, vs.x - 0.4, canal.pos - 0.5, 0.84, 0, 0.7);
                            addObj(P.lamps, vs.x + vs.w + 0.4, canal.pos + canal.w + 0.5, 0.84, 0, 0.7);
                        }
                    });
                    for (let x = 3; x <= cols - 4; x += 8) {
                        if (canPlace(x, canal.pos + canal.w / 2, 2.2) && isWater(Math.floor(x), canal.pos)) {
                            addObj(P.boats, x, canal.pos + canal.w / 2, 0.98, MB_PICK([0, 180]), 1.4);
                        }
                    }
                } else {
                    hStreets.forEach(hs => {
                        if (hs.x1 <= canal.pos && hs.x2 >= canal.pos + canal.w - 1) {
                            placeCityBridge(canal.pos, hs.y + (hs.w - 1) / 2, canal.pos + canal.w - 1, hs.y + (hs.w - 1) / 2);
                            addObj(P.lamps, canal.pos - 0.5, hs.y - 0.4, 0.84, 0, 0.7);
                            addObj(P.lamps, canal.pos + canal.w + 0.5, hs.y + hs.w + 0.4, 0.84, 0, 0.7);
                        }
                    });
                    for (let y = 3; y <= rows - 4; y += 7) {
                        if (canPlace(canal.pos + canal.w / 2, y, 2.2) && isWater(canal.pos, Math.floor(y))) {
                            addObj(P.boats, canal.pos + canal.w / 2, y, 0.98, MB_PICK([90, 270]), 1.4);
                        }
                    }
                }
            }

            // Слой Д: Случайная площадь или городской парк на реальном перекрёстке улиц!
            const intersections = [];
            hStreets.forEach(hs => vStreets.forEach(vs => {
                if (vs.x >= hs.x1 && vs.x <= hs.x2 && hs.y >= vs.y1 && hs.y <= vs.y2) {
                    const ix = vs.x + Math.floor(vs.w / 2), iy = hs.y + Math.floor(hs.w / 2);
                    if (getT(ix, iy) === T.flagstone && (!wall || Math.abs((wall.isVert ? ix : iy) - wall.cut) > 4)) {
                        intersections.push({ x: ix, y: iy });
                    }
                }
            }));
            if (intersections.length && Math.random() < 0.82) {
                const hub = MB_PICK(intersections);
                const isPark = Math.random() < 0.30;
                const pRx = Math.min(4, Math.max(2, Math.floor(cols * 0.13)));
                const pRy = Math.min(3, Math.max(2, Math.floor(rows * 0.17)));
                const px1 = Math.max(2, hub.x - pRx), px2 = Math.min(cols - 3, hub.x + pRx);
                const py1 = Math.max(2, hub.y - pRy), py2 = Math.min(rows - 3, hub.y + pRy);
                // Не залезаем площадью в воду или стену
                let areaClear = true;
                for (let r = py1; r <= py2 && areaClear; r++) for (let c = px1; c <= px2 && areaClear; c++) {
                    if (isWater(c, r) || isWall(c, r) || getT(c, r) === T.grass) areaClear = false;
                }
                if (areaClear) {
                    fillRect(px1, py1, px2, py2, isPark ? T.grass : T.stone);
                    markOcc(px1, py1, px2, py2, 2);
                    const pcx = (px1 + px2 + 1) / 2, pcy = (py1 + py2 + 1) / 2;
                    addObj(P.cityCenter, pcx, pcy, 1.18, 0, 1.85);
                    [[px1 + 0.7, py1 + 0.7], [px2 + 0.3, py1 + 0.7], [px1 + 0.7, py2 + 0.3], [px2 + 0.3, py2 + 0.3]].forEach(([lx, ly]) => {
                        addObj(P.lamps, lx, ly, 0.84, 0, 0.7);
                    });
                    if (!isPark) {
                        [[px1 + 1.4, py1 + 1.3], [px2 - 0.4, py1 + 1.3], [px1 + 1.4, py2 - 0.3], [px2 - 0.4, py2 - 0.3]].forEach(([sx, sy]) => {
                            if (Math.hypot(sx - pcx, sy - pcy) > 2.2 && canPlace(sx, sy, 1.2)) {
                                addObj(P.tables, sx, sy, 0.86, 0, 1.15);
                                addObj(P.market, sx + (sx < pcx ? -0.45 : 0.45), sy + (sy < pcy ? 0.5 : -0.5), 0.72, MB_RAND_INT(0, 359), 0);
                            }
                        });
                    } else {
                        [[px1 + 1.3, py1 + 1.3], [px2 - 0.3, py2 - 0.3]].forEach(([tx, ty]) => {
                            if (canPlace(tx, ty, 1.4)) addObj(P.trees, tx, ty, 0.92, MB_RAND_INT(0, 359), 1.3);
                        });
                        addObj(P.gardens, px2 - 0.6, py1 + 1.2, 0.85, 0, 0.7);
                        addObj(P.gardens, px1 + 1.2, py2 - 0.6, 0.85, 90, 0.7);
                    }
                }
            }

            // Повозка на свободной улице, ориентированная строго вдоль движения
            if (hStreets.length && !wall) {
                const st = MB_PICK(hStreets);
                for (let tries = 0; tries < 12; tries++) {
                    const cx = MB_RAND_FLOAT(st.x1 + 2, st.x2 - 2), cy = st.y + st.w / 2;
                    if (getT(Math.floor(cx), Math.floor(cy)) === T.flagstone && canPlace(cx, cy, 2.0)) {
                        addObj(P.carts, cx, cy, 0.96, MB_PICK([0, 180]), 1.6);
                        break;
                    }
                }
            }

            // Слой Е: Умный упаковщик домов по свободным кварталам (со случайным направлением обхода!)
            const rectFree = (x1, y1, w, h) => {
                if (x1 < 0 || y1 < 0 || x1 + w > cols || y1 + h > rows) return false;
                for (let r = y1; r < y1 + h; r++) for (let c = x1; c < x1 + w; c++) {
                    if (occ[r][c] !== 0 || getT(c, r) !== T.cobble) return false;
                }
                return true;
            };
            const trySizes = cols <= 18
                ? [{ w: 4, h: 3, sc: 0.84, horiz: true }, { w: 3, h: 4, sc: 0.84, horiz: false }]
                : [
                    { w: 5, h: 3, sc: 0.98, horiz: true }, { w: 3, h: 5, sc: 0.98, horiz: false },
                    { w: 4, h: 3, sc: 0.84, horiz: true }, { w: 3, h: 4, sc: 0.84, horiz: false }
                ];

            const revR = Math.random() < 0.5, revC = Math.random() < 0.5;
            const rList = Array.from({ length: rows - 2 }, (_, i) => revR ? (rows - 3 - i) : i);
            const cList = Array.from({ length: cols - 2 }, (_, i) => revC ? (cols - 3 - i) : i);

            for (const r of rList) {
                for (const c of cList) {
                    if (occ[r][c] !== 0 || getT(c, r) !== T.cobble) continue;
                    const nearV = getT(c - 1, r) === T.flagstone || getT(c + 3, r) === T.flagstone || getT(c + 4, r) === T.flagstone;
                    const nearH = getT(c, r - 1) === T.flagstone || getT(c, r + 3) === T.flagstone;
                    const preferVert = nearV && !nearH;
                    const ordered = trySizes.slice().sort((a, b) => (a.horiz === !preferVert ? -1 : 1));

                    for (const sz of ordered) {
                        if (!rectFree(c, r, sz.w, sz.h)) continue;
                        if (Math.random() < 0.14 && sz.w >= 4 && sz.h >= 3) {
                            fillRect(c, r, c + sz.w - 1, r + sz.h - 1, T.grass);
                            markOcc(c, r, c + sz.w - 1, r + sz.h - 1, 3);
                            addObj(P.trees, c + sz.w / 2 - 0.5, r + sz.h / 2 - 0.1, 0.94, MB_RAND_INT(0, 359), 1.1);
                            addObj(P.gardens, c + sz.w / 2 + 0.8, r + sz.h / 2 + 0.3, 0.82, MB_RAND_INT(0, 359), 0.6);
                            break;
                        }
                        const cx = c + sz.w / 2, cy = r + sz.h / 2;
                        const rot = sz.horiz ? MB_PICK([0, 180]) : MB_PICK([90, 270]);
                        addObj(Math.random() < thatchProb ? P.roofThatch : P.roofTile, cx, cy, sz.sc, rot, 0);
                        if (Math.random() < 0.78) addObj('other_misc_chimney_1x1', cx + (sz.horiz ? 0.8 : 0.2), cy - (sz.horiz ? 0.35 : 0.7), 0.82, 0, 0);
                        markOcc(c, r, c + sz.w - 1, r + sz.h - 1, 1);
                        markOcc(c + sz.w, r, c + sz.w, r + sz.h - 1, 4);
                        markOcc(c, r + sz.h, c + sz.w - 1, r + sz.h, 4);
                        const decX = sz.horiz ? (c + sz.w + 0.5) : (c + 0.5);
                        const decY = sz.horiz ? (r + sz.h / 2) : (r + sz.h + 0.5);
                        if (inB(Math.floor(decX), Math.floor(decY)) && getT(Math.floor(decX), Math.floor(decY)) === T.cobble && canPlace(decX, decY, 0.8)) {
                            addObj(Math.random() < 0.55 ? P.market : P.gardens, decX, decY, 0.72, MB_RAND_INT(0, 359), 0.65);
                        }
                        if ((nearH || nearV) && Math.random() < 0.35) {
                            const lx = c + (nearV ? -0.35 : 0.2), ly = r + (nearH ? -0.35 : 0.2);
                            if (inB(Math.floor(lx), Math.floor(ly)) && getT(Math.floor(lx), Math.floor(ly)) === T.flagstone && canPlace(lx, ly, 3.2)) {
                                addObj(P.lamps, lx, ly, 0.82, 0, 0.7);
                            }
                        }
                        break;
                    }
                }
            }

            if (wall) {
                for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
                    if (getT(c, r) !== T.grass) continue;
                    if ([-2, -1, 0, 1, 2].some(d => isWall(c + d, r) || isWall(c, r + d))) continue;
                    if (!canPlace(c + 0.5, r + 0.5, 1.7)) continue;
                    const rnd = Math.random();
                    if (rnd < 0.18) addObj(P.trees, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.9, 1.25), MB_RAND_INT(0, 359), 1.65);
                    else if (rnd < 0.28) addObj(P.bushes, c + 0.5, r + 0.5, 0.88, MB_RAND_INT(0, 359), 0.95);
                    else if (rnd < 0.33) addObj(P.flowers, c + 0.5, r + 0.5, 0.8, MB_RAND_INT(0, 359), 0.7);
                }
            }

            genTitle = (hasWall && hasCanal) ? 'Речные ворота Столицы'
                     : (hasCanal ? MB_PICK(['Речной квартал', 'Набережная каналов', 'Мосты Купцов'])
                     : (hasWall ? MB_PICK(['Городские ворота', 'Застава Столицы', 'Въезд в Притишье'])
                     : MB_PICK(['Торговый квартал', 'Улочки Старого города', 'Ярмарочная площадь', 'Ремесленная слобода'])));
        }

        // ============================================================
        // 2. ❄️ СНЕЖНЫЙ ПЕРЕВАЛ (СКАЛЫ + ЛЁД/РЕКИ + ГЛАДКИЕ ТРОПЫ + ЗИМНИЕ ТОЧКИ)
        // ============================================================
        else if (picked === 'snow') {
            // 1) Независимый слой воды/льда: 0 = сухие горы, 1 = замёрзшая река, 2 = ледяное озеро с полыньёй
            const hydro = MB_PICK([0, 1, 2]);
            if (hydro === 1) {
                const [r0, r1] = randomEdgePair(true);
                const bend = MB_RAND_FLOAT(-0.24, 0.24);
                carveSpline(r0, r1, cols >= 26 ? 2.5 : 2.0, T.ice, { bend });
                carveSpline(r0, r1, cols >= 26 ? 1.25 : 1.0, T.water, { bend });
            } else if (hydro === 2) {
                const lx = cols * MB_RAND_FLOAT(0.28, 0.72), ly = rows * MB_RAND_FLOAT(0.28, 0.72);
                const rx = MB_RAND_FLOAT(3.4, Math.min(7.2, cols * 0.26)), ry = MB_RAND_FLOAT(2.6, Math.min(5.2, rows * 0.30));
                paintBlob(lx, ly, rx, ry, T.ice, 0.18);
                paintBlob(lx + MB_RAND_FLOAT(-1.0, 1.0), ly + MB_RAND_FLOAT(-0.8, 0.8), rx * 0.45, ry * 0.45, T.water, 0.16, [T.ice]);
            }

            // 2) Независимый слой дорог: 1 или 2 плавные грунтовые тропы (без ступенчатого камня!) + авто-мосты
            let mainRoad = null;
            if (Math.random() < 0.82 || hydro === 0) {
                const [t0, t1] = randomEdgePair(true);
                mainRoad = carveSpline(t0, t1, 1.15, T.dirt, { keepWater: true, bend: MB_RAND_FLOAT(-0.22, 0.22) });
                autoPlaceBridges(mainRoad, Math.random() < 0.4);
                if (cols >= 26 && Math.random() < 0.38) {
                    const anc = mainRoad[Math.floor(mainRoad.length * MB_RAND_FLOAT(0.3, 0.7))];
                    const br = carveSpline(anc, randomEdgePoint(MB_PICK(['N', 'S', 'E', 'W'])), 1.0, T.dirt, { keepWater: true });
                    autoPlaceBridges(br, false);
                }
            }

            // 3) Независимый слой скальных гряд (из реальных скал, никогда из кирпичных стен!)
            const hasPassRidges = (hydro === 0) || (Math.random() < 0.45);
            if (hasPassRidges && mainRoad) {
                const ridgeDist = Math.max(3.6, Math.min(cols, rows) * MB_RAND_FLOAT(0.30, 0.38));
                for (let i = 2; i < mainRoad.length - 2; i += 4) {
                    const pt = mainRoad[i];
                    for (const side of [-1, 1]) {
                        const rx = pt.x + pt.nx * side * (ridgeDist + MB_RAND_FLOAT(-0.5, 1.3));
                        const ry = pt.y + pt.ny * side * (ridgeDist + MB_RAND_FLOAT(-0.5, 1.3));
                        if (getT(Math.floor(rx), Math.floor(ry)) === T.snow && canPlace(rx, ry, 1.65)) {
                            addObj(P.cliffs, rx, ry, MB_RAND_FLOAT(1.0, 1.42), MB_RAND_INT(0, 359), 1.75);
                        }
                    }
                }
            } else if (Math.random() < 0.65) {
                // Случайные скальные массивы по краям/углам карты
                const nOutcrops = MB_RAND_INT(2, 4);
                for (let i = 0; i < nOutcrops; i++) {
                    const ox = MB_RAND_FLOAT(1.5, cols - 1.5), oy = MB_RAND_FLOAT(1.5, rows - 1.5);
                    if (getT(Math.floor(ox), Math.floor(oy)) !== T.snow) continue;
                    for (let k = 0; k < MB_RAND_INT(2, 4); k++) {
                        const cx = ox + MB_RAND_FLOAT(-2.0, 2.0), cy = oy + MB_RAND_FLOAT(-1.8, 1.8);
                        if (getT(Math.floor(cx), Math.floor(cy)) === T.snow && canPlace(cx, cy, 1.65)) {
                            addObj(P.cliffs, cx, cy, MB_RAND_FLOAT(0.95, 1.35), MB_RAND_INT(0, 359), 1.65);
                        }
                    }
                }
            }

            // 4) 1–2 случайные точки интереса: лагерь экспедиции, застава на тракте, заснеженные руины
            const poiDeck = ['camp', 'outpost', 'ruins'].sort(() => Math.random() - 0.5);
            const poiCount = cols >= 26 ? 2 : 1;
            let poiTitle = '';
            for (let p = 0; p < poiCount; p++) {
                const kind = poiDeck[p];
                if (kind === 'outpost' && mainRoad) {
                    const mid = mainRoad[Math.floor(mainRoad.length * MB_RAND_FLOAT(0.35, 0.65))];
                    if (mid && !isWater(Math.floor(mid.x), Math.floor(mid.y)) && canPlace(mid.x, mid.y, 2.2)) {
                        const rDeg = Math.atan2(mid.uy, mid.ux) * 180 / Math.PI;
                        addObj(P.watchpost, mid.x + mid.nx * 2.4, mid.y + mid.ny * 2.4, 1.06, 0, 1.75);
                        addObj(P.flags, mid.x + mid.nx * 1.4, mid.y + mid.ny * 1.4, 0.98, 0, 0.7);
                        addObj(P.barricades, mid.x + mid.ux * 2.1 - mid.nx * 0.9, mid.y + mid.uy * 2.1 - mid.ny * 0.9, 1.05, rDeg + 90, 1.1);
                        addObj(P.barricades, mid.x + mid.ux * 2.1 + mid.nx * 1.3, mid.y + mid.uy * 2.1 + mid.ny * 1.3, 1.05, rDeg + 90, 1.1);
                        addObj(P.braziers, mid.x + mid.ux * 1.0 + mid.nx * 1.5, mid.y + mid.uy * 1.0 + mid.ny * 1.5, 0.84, 0, 0.7);
                        addObj(P.braziers, mid.x + mid.ux * 1.0 - mid.nx * 1.5, mid.y + mid.uy * 1.0 - mid.ny * 1.5, 0.84, 0, 0.7);
                        poiTitle = 'Северная застава';
                        continue;
                    }
                }
                const spot = findDrySpot([T.snow], 3.5, 4.0);
                if (!spot) continue;
                if (kind === 'ruins') {
                    placeRuinsCluster(spot.x, spot.y, T.flagstone, P.iceCrystals);
                    addObj(P.braziers, spot.x - 1.5, spot.y + 1.2, 0.84, 0, 0.7);
                    poiTitle = poiTitle || 'Заснеженные руины';
                } else {
                    placeCampCluster(spot.x, spot.y, {
                        groundTile: T.dirt, onlyGround: [T.snow], radius: 2.8,
                        tents: MB_RAND_INT(2, 3), bigTentPool: cols >= 24 && Math.random() < 0.5 ? P.campBigTents : null,
                        propPool: P.snowPelts, props: 3
                    });
                    poiTitle = poiTitle || 'Привал на перевале';
                }
            }

            if (mainRoad && Math.random() < 0.45) {
                const cp = mainRoad[Math.floor(mainRoad.length * MB_PICK([0.18, 0.82]))];
                if (cp && !isWater(Math.floor(cp.x), Math.floor(cp.y)) && canPlace(cp.x, cp.y, 1.6)) {
                    addObj(P.carts, cp.x, cp.y, 0.94, Math.atan2(cp.uy, cp.ux) * 180 / Math.PI, 1.55);
                }
            }

            scatterWaterDetails(P.waterRocks, 0.12);
            scatterGroves([T.snow], P.trees, P.snowRocks, P.deadwood, 0.88);
            genTitle = poiTitle || (hydro === 1 ? 'Ледяная переправа' : (hydro === 2 ? 'Замёрзшее озеро' : 'Снежный перевал'));
        }

        // ============================================================
        // 3. ⚔️ ПОЛЕ БИТВЫ / ОСАДА (ПРОЦЕДУРНЫЙ ФРОНТ / РЕДУТ / ЗАСАДА)
        // ============================================================
        else if (picked === 'battlefield') {
            for (let i = 0; i < Math.floor((cols * rows) / 36); i++) {
                paintBlob(MB_RAND_FLOAT(2, cols - 2), MB_RAND_FLOAT(2, rows - 2), MB_RAND_FLOAT(1.8, 3.5), MB_RAND_FLOAT(1.4, 2.9), T.dirt, 0.22);
            }

            const mode = MB_PICK(['frontline', 'breach', 'ambush', 'redoubt']);
            if (mode === 'ambush') {
                const [p0, p1] = randomEdgePair(true);
                const roadPts = carveSpline(p0, p1, 1.4, T.dirt, { bend: MB_RAND_FLOAT(-0.28, 0.28) });
                const nWagons = Math.min(4, Math.max(2, Math.floor(cols / 9)));
                for (let w = 0; w < nWagons; w++) {
                    const pt = roadPts[Math.floor(roadPts.length * (0.22 + (w / Math.max(1, nWagons - 1)) * 0.54))];
                    const deg = Math.atan2(pt.uy, pt.ux) * 180 / Math.PI + MB_RAND_INT(-24, 24);
                    addObj(P.carts, pt.x, pt.y, 1.1, deg, 1.8);
                    if (w === 1) addObj(P.battleFire, pt.x + pt.nx * 1.3, pt.y + pt.ny * 1.3, 0.9, 0, 1.05);
                    addObj(w % 2 === 0 ? P.crates : P.barrels, pt.x - pt.nx * 1.5, pt.y - pt.ny * 1.5, 0.86, MB_RAND_INT(0, 359), 0.78);
                }
                const blockPt = roadPts[Math.floor(roadPts.length * 0.83)];
                addObj(P.logs, blockPt.x, blockPt.y, 1.32, Math.atan2(blockPt.uy, blockPt.ux) * 180 / Math.PI + 90, 1.55);
                scatterGroves([T.grass], P.trees, P.bushes, P.rocks, 1.15);
                genTitle = MB_PICK(['Засада на обоз', 'Разгромленный караван', 'Бой на лесном тракте']);
            }
            else if (mode === 'redoubt') {
                const hx = cols * MB_RAND_FLOAT(0.32, 0.68), hy = rows * MB_RAND_FLOAT(0.32, 0.68);
                const rx = Math.min(8.2, cols * MB_RAND_FLOAT(0.22, 0.28)), ry = Math.min(5.8, rows * MB_RAND_FLOAT(0.26, 0.32));
                paintBlob(hx, hy, rx + 2.0, ry + 1.8, T.dirt, 0.16);
                paintBlob(hx, hy, rx - 1.2, ry - 1.2, T.stone, 0.12);
                const ringN = Math.max(10, Math.floor((rx + ry) * 1.3));
                const gapA = MB_RAND_INT(0, ringN - 1), gapB = (gapA + Math.floor(ringN / 2)) % ringN;
                for (let i = 0; i < ringN; i++) {
                    if (i === gapA || i === gapB) continue;
                    const ang = (i / ringN) * 6.28;
                    const bx = hx + Math.cos(ang) * rx, by = hy + Math.sin(ang) * ry;
                    if (inB(Math.floor(bx), Math.floor(by))) addObj(P.barricades, bx, by, 1.06, ang * 180 / Math.PI + 90, 1.1);
                }
                placeCampCluster(hx, hy, { radius: rx * 0.46, tents: 2, bigTentPool: P.campBigTents, props: 2 });
                addObj(P.flags, hx + 1.6, hy - 1.4, 1.1, 0, 0.8);
                for (let s = 0; s < 3; s++) {
                    const ang = (s / 3) * 6.28 + MB_RAND_FLOAT(-0.35, 0.35);
                    const sx = hx + Math.cos(ang) * (rx + 4.0), sy = hy + Math.sin(ang) * (ry + 3.2);
                    if (inB(Math.floor(sx), Math.floor(sy)) && canPlace(sx, sy, 2.0)) {
                        addObj(P.siege, sx, sy, 1.18, Math.atan2(hy - sy, hx - sx) * 180 / Math.PI, 1.85);
                        addObj(P.siegeAmmo, sx - Math.cos(ang) * 1.3, sy - Math.sin(ang) * 1.3, 0.88, 0, 0.78);
                    }
                }
                scatterGroves([T.grass], P.trees, P.bushes, P.rocks, 0.72);
                genTitle = MB_PICK(['Оборона высоты', 'Укреплённый редут', 'Последний рубеж']);
            }
            else {
                const isBreach = (mode === 'breach');
                const [f0, f1] = randomEdgePair(false);
                const skipRanges = isBreach
                    ? (Math.random() < 0.45 && cols >= 28 ? [[0.24, 0.36], [0.64, 0.76]] : [[0.41, 0.59]])
                    : null;
                const linePts = carveSpline(f0, f1, isBreach ? 1.05 : 1.5, isBreach ? T.wall : T.water, { bend: MB_RAND_FLOAT(-0.2, 0.2), skipRanges });
                const midPt = linePts[Math.floor(linePts.length * 0.5)];
                const normalDeg = Math.atan2(midPt.ny, midPt.nx) * 180 / Math.PI;

                if (isBreach) {
                    skipRanges.forEach(([a, b]) => {
                        const pA = linePts[Math.floor(linePts.length * a)], pB = linePts[Math.floor(linePts.length * b)];
                        const pM = linePts[Math.floor(linePts.length * ((a + b) / 2))];
                        addObj(P.collapsed, pA.x, pA.y, 1.12, normalDeg, 1.35);
                        addObj(P.collapsed, pB.x, pB.y, 1.12, normalDeg + 180, 1.35);
                        addObj(P.battleFire, pM.x, pM.y, 0.95, 0, 1.1);
                    });
                    addObj('camp_batteringrambroken', midPt.x - midPt.nx * 3.3, midPt.y - midPt.ny * 3.3, 1.18, normalDeg, 1.75);
                } else {
                    const nCross = (cols >= 28 && Math.random() < 0.55) ? [0.30, 0.70] : [0.50];
                    nCross.forEach(frac => {
                        const mp = linePts[Math.floor(linePts.length * frac)];
                        const crossPts = carveSpline({ x: mp.x - mp.nx * 9, y: mp.y - mp.ny * 9 }, { x: mp.x + mp.nx * 9, y: mp.y + mp.ny * 9 }, 1.25, T.dirt, { keepWater: true, bend: 0 });
                        autoPlaceBridges(crossPts, Math.random() < 0.5);
                    });
                }

                for (let i = 6; i < linePts.length - 6; i += 7) {
                    const pt = linePts[i];
                    const bx = pt.x + pt.nx * 2.8, by = pt.y + pt.ny * 2.8;
                    if (canPlace(bx, by, 1.3) && !isWater(Math.floor(bx), Math.floor(by)) && !isWall(Math.floor(bx), Math.floor(by))) {
                        addObj(P.barricades, bx, by, 1.06, Math.atan2(pt.ny, pt.nx) * 180 / Math.PI + 180, 1.15);
                    }
                }
                for (const side of [-1, 1]) {
                    for (const frac of [0.28, 0.72]) {
                        const pt = linePts[Math.floor(linePts.length * frac)];
                        const sx = pt.x + pt.nx * side * 6.0, sy = pt.y + pt.ny * side * 6.0;
                        if (canPlace(sx, sy, 2.0) && !isWater(Math.floor(sx), Math.floor(sy)) && !isWall(Math.floor(sx), Math.floor(sy))) {
                            addObj(P.siege, sx, sy, 1.18, Math.atan2(-pt.ny * side, -pt.nx * side) * 180 / Math.PI, 1.85);
                            addObj(P.siegeAmmo, sx + pt.nx * side * 1.4, sy + pt.ny * side * 1.4, 0.88, 0, 0.78);
                        }
                    }
                    const cx = midPt.x + midPt.nx * side * 8.2, cy = midPt.y + midPt.ny * side * 8.2;
                    if (inB(Math.floor(cx), Math.floor(cy)) && canPlace(cx, cy, 2.0)) {
                        addObj(P.campTents, cx, cy, 1.08, normalDeg + (side > 0 ? 180 : 0), 1.95);
                        addObj(P.flags, cx - midPt.nx * side * 1.8, cy - midPt.ny * side * 1.8, 1.08, 0, 0.8);
                    }
                }
                genTitle = isBreach ? MB_PICK(['Пролом в стене', 'Осада цитадели', 'Штурм бастиона'])
                                    : MB_PICK(['Штурм переправы', 'Битва у реки', 'Кровавый брод']);
            }

            for (let i = 0; i < Math.floor((cols * rows) / 28); i++) {
                const fx = MB_RAND_FLOAT(2, cols - 2), fy = MB_RAND_FLOAT(2, rows - 2);
                if (!isWater(Math.floor(fx), Math.floor(fy)) && !isWall(Math.floor(fx), Math.floor(fy)) && canPlace(fx, fy, 1.25)) {
                    addObj(Math.random() < 0.62 ? P.battleLoot : P.rubble, fx, fy, 0.86, MB_RAND_INT(0, 359), 0.88);
                }
            }
        }

        // ============================================================
        // 4. 🌲 ДИКИЙ ЛЕС (СЕЗОНЫ + ВОДА + ВЕТВЯЩИЕСЯ ТРОПЫ + ПОЛЯНЫ)
        // ============================================================
        else if (picked === 'forest') {
            const isAutumn = Math.random() < 0.30;
            const leafT = isAutumn ? T.leafR : T.leafG;
            if (isAutumn) { window._mbLighting = 'sunset'; data.lighting = 'sunset'; }

            for (let i = 0; i < Math.floor((cols * rows) / 36); i++) {
                paintBlob(MB_RAND_FLOAT(2, cols - 2), MB_RAND_FLOAT(2, rows - 2), MB_RAND_FLOAT(1.8, 3.6), MB_RAND_FLOAT(1.4, 2.9), leafT, 0.22);
            }

            const hydro = MB_PICK([0, 1, 1, 2]);
            if (hydro === 1) {
                const [w0, w1] = randomEdgePair(true);
                carveSpline(w0, w1, cols >= 26 ? 1.8 : 1.4, T.water, { bend: MB_RAND_FLOAT(-0.3, 0.3) });
            } else if (hydro === 2) {
                const lx = cols * MB_RAND_FLOAT(0.28, 0.72), ly = rows * MB_RAND_FLOAT(0.28, 0.72);
                const rx = MB_RAND_FLOAT(3.4, Math.min(7.2, cols * 0.28)), ry = MB_RAND_FLOAT(2.6, Math.min(5.2, rows * 0.32));
                paintBlob(lx, ly, rx, ry, T.water, 0.18);
                if (rx >= 4.6 && Math.random() < 0.52) paintBlob(lx, ly, rx * 0.42, ry * 0.42, T.grass, 0.14);
            }

            const [t0, t1] = randomEdgePair(true);
            const mainTrail = carveSpline(t0, t1, 1.15, T.dirt, { keepWater: true, bend: MB_RAND_FLOAT(-0.25, 0.25) });
            autoPlaceBridges(mainTrail, Math.random() < 0.35);
            if (Math.random() < 0.48) {
                const anc = mainTrail[Math.floor(mainTrail.length * MB_RAND_FLOAT(0.28, 0.72))];
                const br = carveSpline(anc, randomEdgePoint(MB_PICK(['N', 'S', 'E', 'W'])), 1.0, T.dirt, { keepWater: true });
                autoPlaceBridges(br, false);
            }

            const poiCount = cols >= 28 ? 2 : 1;
            const poiTypes = ['camp', 'ruins', 'woodsman'].sort(() => Math.random() - 0.5);
            for (let p = 0; p < poiCount; p++) {
                const spot = findDrySpot([T.grass, leafT], 3.8, 4.4);
                if (!spot) continue;
                const kind = poiTypes[p];
                if (kind === 'camp') placeCampCluster(spot.x, spot.y, { groundTile: T.dirt, radius: 2.8, tents: MB_RAND_INT(1, 3) });
                else if (kind === 'ruins') placeRuinsCluster(spot.x, spot.y, T.stone);
                else {
                    paintBlob(spot.x, spot.y, 2.6, 2.2, T.dirt, 0.16);
                    addObj(P.carts, spot.x - 1.0, spot.y, 0.96, MB_RAND_INT(0, 359), 1.6);
                    addObj('other_firewood_pile', spot.x + 1.3, spot.y - 0.7, 0.95, 20, 1.0);
                    addObj('nature_stump_axe_chopping', spot.x + 1.1, spot.y + 1.0, 0.92, 0, 0.9);
                    addObj(P.campfires, spot.x - 0.3, spot.y + 1.4, 1.0, 0, 1.3);
                }
            }

            scatterWaterDetails(P.waterDec, 0.15);
            scatterGroves([T.grass, leafT], P.trees, isAutumn ? P.autumnBushes : P.bushes, Math.random() < 0.5 ? P.flowers : P.rocks, 1.15);
            scatterGroves([T.grass, leafT], P.logs, P.fungi, P.rocks, 0.30);
            genTitle = isAutumn ? MB_PICK(['Осенний тракт', 'Золотая чаща', 'Осенняя переправа'])
                                : MB_PICK(['Дикая чаща', 'Лесная переправа', 'Тропа через руины', 'Поляна путников']);
        }

        // ============================================================
        // 5. 🏴‍☠️ ПИРАТСКАЯ БУХТА (АРХИПЕЛАГ ИЛИ БЕРЕГ С ЛЮБОЙ СТОРОНЫ + ПИРС)
        // ============================================================
        else if (picked === 'pirate') {
            const isArchipelago = Math.random() < 0.45;
            if (isArchipelago) {
                fillRect(0, 0, cols - 1, rows - 1, T.water);
                const mx = cols * MB_RAND_FLOAT(0.36, 0.64), my = rows * MB_RAND_FLOAT(0.36, 0.64);
                paintBlob(mx, my, cols * MB_RAND_FLOAT(0.30, 0.36), rows * MB_RAND_FLOAT(0.32, 0.38), T.sand, 0.2);
                paintBlob(mx, my, cols * 0.18, rows * 0.20, T.grass, 0.18);

                // 0–2 дополнительных островка / отмели с кладом
                const extraIsles = cols >= 26 ? MB_RAND_INT(1, 2) : (Math.random() < 0.5 ? 1 : 0);
                for (let k = 0; k < extraIsles; k++) {
                    const ix = (mx > cols / 2 ? MB_RAND_FLOAT(3.2, cols * 0.24) : MB_RAND_FLOAT(cols * 0.76, cols - 3.2));
                    const iy = k === 0 ? MB_RAND_FLOAT(3.0, rows * 0.36) : MB_RAND_FLOAT(rows * 0.64, rows - 3.0);
                    paintBlob(ix, iy, MB_RAND_FLOAT(2.4, 3.5), MB_RAND_FLOAT(2.0, 3.0), T.sand, 0.18);
                    addObj(P.pirateLoot, ix, iy, 1.05, MB_RAND_INT(0, 359), 1.1);
                }

                placeCampCluster(mx, my, { radius: 2.7, tents: 2, propPool: P.pirateLoot, props: 3 });
                addObj('camp_pirateflag', mx + 1.6, my - 1.5, 1.1, 0, 0.8);
                for (let tries = 0; tries < 28; tries++) {
                    const bx = MB_RAND_INT(2, cols - 3), by = MB_RAND_INT(2, rows - 3);
                    if (isWater(bx, by) && [-2, 0, 2].some(d => getT(bx + d, by) === T.sand || getT(bx, by + d) === T.sand) && canPlace(bx, by, 2.2)) {
                        addObj(P.boats, bx + 0.5, by + 0.5, 1.12, MB_RAND_INT(0, 359), 1.6);
                        break;
                    }
                }
                genTitle = MB_PICK(['Остров Сокровищ', 'Атолл Корсаров', 'Архипелаг Черепа']);
            } else {
                const seaSide = MB_PICK(['W', 'E', 'N', 'S']);
                const freq = MB_RAND_FLOAT(0.14, 0.26), seaFrac = MB_RAND_FLOAT(0.32, 0.44);
                for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                    const depth = (seaSide === 'W') ? (c - cols * seaFrac - Math.sin(r * freq + phaseA) * 2.8)
                                : (seaSide === 'E') ? (cols * (1 - seaFrac) - c - Math.sin(r * freq + phaseA) * 2.8)
                                : (seaSide === 'N') ? (r - rows * seaFrac - Math.sin(c * freq + phaseA) * 2.4)
                                : (rows * (1 - seaFrac) - r - Math.sin(c * freq + phaseA) * 2.4);
                    if (depth < 0) setT(c, r, T.water);
                    else if (depth < 4.5) setT(c, r, T.sand);
                    else setT(c, r, T.grass);
                }

                // Ищем реальную кромку пляжа и выносим пирс строго в море!
                const targetC = Math.floor(cols * MB_RAND_FLOAT(0.35, 0.65));
                const targetR = Math.floor(rows * MB_RAND_FLOAT(0.35, 0.65));
                let sx = targetC, sy = targetR, bestD = 1e9;
                for (let r = 3; r < rows - 3; r++) for (let c = 3; c < cols - 3; c++) {
                    if (getT(c, r) === T.sand && (isWater(c - 1, r) || isWater(c + 1, r) || isWater(c, r - 1) || isWater(c, r + 1))) {
                        const d = Math.hypot(c - targetC, r - targetR);
                        if (d < bestD) { bestD = d; sx = c; sy = r; }
                    }
                }
                const seaDx = seaSide === 'W' ? -1 : (seaSide === 'E' ? 1 : 0);
                const seaDy = seaSide === 'N' ? -1 : (seaSide === 'S' ? 1 : 0);
                const pierDeg = Math.atan2(seaDy, seaDx) * 180 / Math.PI;
                addObj(P.woodBridge, sx + seaDx * 1.4, sy + seaDy * 1.4, 1.14, pierDeg, 1.9);
                addObj(P.boats, sx + seaDx * 3.6 + seaDy * 2.0, sy + seaDy * 3.6 - seaDx * 2.0, 1.1, pierDeg + 18, 1.55);
                const campX = Math.max(3, Math.min(cols - 3, sx - seaDx * 3.2));
                const campY = Math.max(3, Math.min(rows - 3, sy - seaDy * 3.2));
                placeCampCluster(campX, campY, { radius: 2.8, tents: 2, propPool: P.pirateLoot, props: 4 });
                addObj('camp_pirateflag', campX - seaDx * 1.5, campY - seaDy * 1.5, 1.1, 0, 0.8);
                genTitle = MB_PICK(['Бухта Контрабандистов', 'Пиратский причал', 'Берег Бурных Волн']);
            }
            scatterGroves([T.grass], P.palms, P.bushes, P.flowers, 1.05);
            scatterGroves([T.sand], P.beachLife, P.pirateLoot, P.rocks, 0.44);
        }

        // ============================================================
        // 6. 🏜️ ПУСТЫНЯ (0–2 ОАЗИСА + РУИНЫ + КАРАВАНЫ + СКАЛЬНЫЕ ГРЯДЫ)
        // ============================================================
        else if (picked === 'desert') {
            const nOases = Math.random() < 0.65 ? (cols >= 32 && Math.random() < 0.35 ? 2 : 1) : 0;
            const hasRuins = (nOases === 0) || (Math.random() < 0.55);

            for (let o = 0; o < nOases; o++) {
                const spot = findDrySpot([T.sand], 4.5, 6.0);
                if (!spot) continue;
                const rx = MB_RAND_FLOAT(2.5, Math.min(4.8, cols * 0.17)), ry = MB_RAND_FLOAT(2.0, Math.min(3.8, rows * 0.22));
                paintBlob(spot.x, spot.y, rx + 1.8, ry + 1.6, T.grass, 0.18);
                paintBlob(spot.x, spot.y, rx, ry, T.water, 0.15);
                for (let a = 0; a < 8; a++) {
                    const ang = (a / 8) * 6.28 + MB_RAND_FLOAT(-0.2, 0.2);
                    const px = spot.x + Math.cos(ang) * (rx + 1.25), py = spot.y + Math.sin(ang) * (ry + 1.15);
                    if (canPlace(px, py, 1.45)) addObj(P.palms, px, py, MB_RAND_FLOAT(0.9, 1.24), MB_RAND_INT(0, 359), 1.5);
                }
            }
            if (hasRuins) {
                const spot = findDrySpot([T.sand], 4.0, 4.8);
                if (spot) placeRuinsCluster(spot.x, spot.y, T.flagstone);
            }
            const campSpot = findDrySpot([T.sand], 4.0, 4.5);
            if (campSpot) {
                placeCampCluster(campSpot.x, campSpot.y, {
                    radius: 3.2, tents: MB_RAND_INT(2, 3), bigTentPool: P.desertTents,
                    tentPool: P.campTents, firePool: ['camp_desert_campfire_1x1'], propPool: P.desertProps, props: 4
                });
            }
            scatterGroves([T.sand], P.desertRocks, P.desertCacti, P.desertProps, 0.88);
            genTitle = (nOases && hasRuins) ? 'Оазис у древних руин' : (nOases ? 'Пустынный оазис каравана' : 'Занесённые песком руины');
        }

        // ============================================================
        // 7. 🍄 ФЕЙСКИЙ ЛЕС (МАГИЧЕСКИЕ ВОДЫ + ТРОННЫЙ КРУГ + СВЕТЯЩИЕСЯ РОЩИ)
        // ============================================================
        else if (picked === 'fey') {
            for (let i = 0; i < Math.floor((cols * rows) / 34); i++) {
                paintBlob(MB_RAND_FLOAT(2, cols - 2), MB_RAND_FLOAT(2, rows - 2), MB_RAND_FLOAT(2.0, 3.8), MB_RAND_FLOAT(1.7, 3.1), T.leafG, 0.22);
            }
            if (Math.random() < 0.55) {
                const nPools = cols >= 28 && Math.random() < 0.4 ? 2 : 1;
                for (let p = 0; p < nPools; p++) {
                    paintBlob(cols * MB_RAND_FLOAT(0.24, 0.76), rows * MB_RAND_FLOAT(0.24, 0.76), MB_RAND_FLOAT(2.6, 4.4), MB_RAND_FLOAT(2.2, 3.5), T.water, 0.2);
                }
            } else {
                const [f0, f1] = randomEdgePair(true);
                carveSpline(f0, f1, 1.3, T.water, { bend: MB_RAND_FLOAT(-0.3, 0.3) });
            }

            const spot = findDrySpot([T.grass, T.leafG], 3.8, 4.2);
            if (spot) {
                addObj('furniture_feythrone', spot.x, spot.y, 1.2, MB_RAND_INT(0, 359), 1.75);
                const ringN = MB_RAND_INT(5, 8);
                for (let a = 0; a < ringN; a++) {
                    const ang = (a / ringN) * 6.28;
                    const cx = spot.x + Math.cos(ang) * 3.3, cy = spot.y + Math.sin(ang) * 2.7;
                    if (!isWater(Math.floor(cx), Math.floor(cy)) && canPlace(cx, cy, 1.1)) {
                        addObj(a % 2 === 0 ? P.feyCrystals : P.feyDecor, cx, cy, 1.0, MB_RAND_INT(0, 359), 1.05);
                    }
                }
            }
            scatterWaterDetails(P.waterDec, 0.2);
            scatterGroves([T.grass, T.leafG], P.feyTrees, P.feyFungi, P.feyDecor, 1.2);
            genTitle = MB_PICK(['Фейская роща', 'Светящийся лес', 'Тронный круг грибов', 'Зачарованное озеро']);
        }

        // ============================================================
        // 8. ⛺ ЛАГЕРЬ ОХОТНИКОВ / ОРКОВ (ПОЛЯНА + ДОРОГИ + ЧАСТОКОЛ + РУЧЕЙ)
        // ============================================================
        else if (picked === 'warcamp') {
            const fortified = Math.random() < 0.54;
            const cx = cols * MB_RAND_FLOAT(0.35, 0.65), cy = rows * MB_RAND_FLOAT(0.35, 0.65);
            const rx = Math.min(9.2, cols * MB_RAND_FLOAT(0.25, 0.33)), ry = Math.min(6.6, rows * MB_RAND_FLOAT(0.28, 0.35));

            // 30% шанс на ручей у окраины лагеря
            if (cols >= 24 && Math.random() < 0.30) {
                const farX = cx > cols / 2 ? MB_RAND_FLOAT(2.5, 4.5) : MB_RAND_FLOAT(cols - 4.5, cols - 2.5);
                carveSpline({ x: farX, y: 0 }, { x: farX + MB_RAND_FLOAT(-2, 2), y: rows - 1 }, 1.25, T.water);
            }

            paintBlob(cx, cy, rx, ry, T.dirt, 0.16, [T.grass]);
            const gateSides = Math.random() < 0.42 ? MB_PICK([['W', 'E'], ['N', 'S'], ['W', 'N'], ['E', 'S']]) : [MB_PICK(['N', 'S', 'E', 'W'])];
            const gateAngles = [];
            gateSides.forEach(gs => {
                const edge = randomEdgePoint(gs);
                gateAngles.push(Math.atan2(edge.y - cy, edge.x - cx));
                const tr = carveSpline({ x: cx, y: cy }, edge, 1.15, T.dirt, { keepWater: true, bend: MB_RAND_FLOAT(-0.18, 0.18) });
                autoPlaceBridges(tr, false);
            });

            if (fortified) {
                const ringN = Math.max(12, Math.floor((rx + ry) * 1.35));
                for (let i = 0; i < ringN; i++) {
                    const ang = (i / ringN) * 6.28;
                    if (gateAngles.some(ga => Math.abs(Math.atan2(Math.sin(ang - ga), Math.cos(ang - ga))) < 0.42)) continue;
                    const bx = cx + Math.cos(ang) * rx, by = cy + Math.sin(ang) * ry;
                    if (inB(Math.floor(bx), Math.floor(by)) && !isWater(Math.floor(bx), Math.floor(by))) {
                        addObj(P.barricades, bx, by, 1.06, ang * 180 / Math.PI + 90, 1.15);
                    }
                }
                const ga0 = gateAngles[0];
                const wx = cx + Math.cos(ga0 + 0.44) * rx, wy = cy + Math.sin(ga0 + 0.44) * ry;
                if (!isWater(Math.floor(wx), Math.floor(wy))) addObj(P.watchpost, wx, wy, 1.04, 0, 1.75);
            }

            placeCampCluster(cx, cy, {
                radius: Math.min(rx, ry) * 0.72,
                tents: cols >= 28 ? MB_RAND_INT(4, 6) : MB_RAND_INT(3, 4),
                bigTentPool: fortified ? P.campBigTents : null,
                tentPool: P.orcTents,
                firePool: ['camp_campfire_hog', 'dungeon_campfire_cooking_spit'],
                fireScale: 1.24,
                propPool: P.orcProps,
                props: Math.max(4, Math.floor((rx * ry) / 8))
            });
            addObj('camp_totemlarge', cx - Math.cos(gateAngles[0]) * 2.1, cy - Math.sin(gateAngles[0]) * 2.1, 1.14, 0, 1.25);
            scatterGroves([T.grass], P.trees, P.bushes, P.rocks, 1.12);
            genTitle = fortified ? MB_PICK(['Укреплённый лагерь орков', 'Частокол налётчиков', 'Форт Охотников'])
                                 : MB_PICK(['Стойбище охотников', 'Лесной лагерь племени', 'Костёр на поляне']);
        }

        const titleInp = document.getElementById('mb-map-title-inp');
        if (titleInp) titleInp.value = genTitle;

        window._mbData = data;
        SAVE_MB_DATA(data);
        RENDER_GM_MAP_BUILDER_UI();
    };
})();