// ================================================================
// 🌍 БЛОК 2: ПРОЦЕДУРНЫЙ ГЕНЕРАТОР УЛИЧНЫХ ЛОКАЦИЙ (100% РАНДОМ + ЛОГИКА)
// Покрывает: Город, Поле битвы, Лес, Пираты, Пустыня, Фейский лес, Лагерь, Снег
// ================================================================
(function INSTALL_PROCEDURAL_OUTDOORS_V4() {
    const _PREV_GEN = MB_GENERATE_RANDOM;
    const TARGETS = ['city', 'battlefield', 'forest', 'pirate', 'desert', 'fey', 'warcamp', 'snow'];

    MB_GENERATE_RANDOM = function(biome) {
        const allBiomes = ['tavern', 'city', 'battlefield', 'forest', 'dungeon', 'mansion', 'dwarven', 'pirate', 'desert', 'fey', 'eastern', 'warcamp', 'snow'];
        const picked = (biome === 'random' || !biome) ? MB_PICK_NEXT_VARIANT('_global', allBiomes) : biome;
        if (!TARGETS.includes(picked)) return _PREV_GEN(picked);

        MB_PUSH_UNDO();
        const cols = window._mbCols, rows = window._mbRows;

        const T = {
            grass:     Math.random() < 0.25 ? MB_PICK_TILE_FAMILY('moss', 'grass') : MB_PICK_TILE_FAMILY('grass', 'grass'),
            dirt:      MB_PICK_TILE_FAMILY('dirt', 'dirt'),
            stone:     MB_PICK_TILE_FAMILY('stone', 'stone'),
            flagstone: MB_PICK_TILE_FAMILY('flagstone', 'stone'),
            cobble:    Math.random() < 0.55 ? MB_PICK_TILE_FAMILY('cobble', 'flagstone') : MB_PICK_TILE_FAMILY('flagstone', 'stone'),
            wood:      MB_PICK_TILE_FAMILY('wood', 'wood'),
            wall:      MB_PICK_TILE_FAMILY('wall', 'wall'),
            snow:      MB_PICK_TILE_FAMILY('snow', 'snow'),
            ice:       MB_PICK_TILE_FAMILY('ice', 'snow'),
            water:     'water',
            sand:      'sand',
            leafG:     'leaves_green',
            leafR:     'leaves_red'
        };

        const baseMap = {
            city: T.cobble, battlefield: T.grass, forest: T.grass,
            pirate: T.sand, desert: T.sand, fey: T.grass, warcamp: T.grass, snow: T.snow
        };
        const lightMap = {
            city:        ['day', 'day', 'sunset', 'night'],
            battlefield: ['sunset', 'day', 'sunset'],
            forest:      ['day', 'day', 'sunset'],
            pirate:      ['day', 'sunset'],
            desert:      ['day', 'sunset'],
            fey:         ['night', 'night', 'sunset'],
            warcamp:     ['sunset', 'night', 'day'],
            snow:        ['day', 'night', 'day']
        };
        window._mbLighting = MB_PICK(lightMap[picked] || ['day']);
        const data = CREATE_EMPTY_MB_DATA(baseMap[picked] || T.grass, cols, rows);
        data.lighting = window._mbLighting;

        const inB = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows;
        const getT = (c, r) => inB(c, r) ? data.cells[r * cols + c].t : null;
        const setT = (c, r, t) => { if (inB(c, r)) data.cells[r * cols + c].t = t; };
        const isWall = (c, r) => /^wall/.test(getT(c, r) || '');
        const isWater = (c, r) => /^water/.test(getT(c, r) || '');

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
            if (stObj.img) MB_GET_LOADED_IMG(stObj.img);
            data.objects.push({ id, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, scale, rot: Math.round(rot) });
            if (reserve > 0) placedZones.push({ x, y, r: reserve });
            return true;
        };

        // --- ЧИСТЫЕ ПУЛЫ РАБОЧИХ СПРАЙТОВ ---
        const P = {
            trees:        MB_GET_POOL(/^nature_tree_(large|small|big|bigger|[123])$|^nature_tree_(large|small)_[12]$/),
            bushes:       MB_GET_POOL(/^nature_bush_(2|3|4|5|6|7|8)_green|^nature_bush_shrub_|^nature_bush_[12]$|^nature_thick_foliage_|^other_fern_/),
            autumnBushes: MB_GET_POOL(/^nature_bush_1_red$|^nature_bush_9_yellow$|^other_leaf_litter_/),
            flowers:      MB_GET_POOL(/^nature_flower_|^nature_flowers_|^other_clovers_/),
            rocks:        MB_GET_POOL(/^nature_mossy_boulder_|^nature_rock(_small)?_[123]$|^nature_rocks_[1-5]$|^nature_boulder$/),
            rockBig:      MB_GET_POOL(/^nature_rock_formation_[2-6]$|^nature_rocks_1_2x2$|^nature_rocks_5_2x2$|^nature_rock_outcrop$/),
            logs:         MB_GET_POOL(/^nature_fallen_tree_|^nature_stump_|^nature_tree_stump_[1-5]_cut$|^nature_log_/),
            fungi:        MB_GET_POOL(/^nature_mushrooms_[123]$|^nature_fungi_(1|3|5|14)_brown$|^nature_mushroom_(6|7)_brown$|^nature_mushroom_11_red$/),
            waterDec:     MB_GET_POOL(/^other_lily_pad|^nature_submerged_rocks_|^nature_river_rock_|^other_current_/),
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
            campGear:     MB_GET_POOL(/^furniture_bedroll_[123]$|^camp_backpack_|^other_firewood_pile$|^nature_log_seat_[12]$/),

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

            snowRocks:    MB_GET_POOL(/^nature_rock_[123]$|^nature_boulder$|^nature_rocks_[1-5]$/),
            snowPelts:    MB_GET_POOL(/^camp_(wolf|beaver)pelt$|^camp_peltwolf$|^furniture_bedroll_[12]$/)
        };

        // ============================================================
        // 🧩 ПРИМИТИВЫ ПРОЦЕДУРНОГО РЕЛЬЕФА (БЕЗ ШАБЛОНОВ!)
        // ============================================================
        const phaseA = MB_RAND_FLOAT(0, 6.28), phaseB = MB_RAND_FLOAT(0, 6.28);

        function paintBlob(cx, cy, rx, ry, tile, wob = 0.18, onlyOn = null) {
            const rMin = Math.max(0, Math.floor(cy - ry - 3)), rMax = Math.min(rows - 1, Math.ceil(cy + ry + 3));
            const cMin = Math.max(0, Math.floor(cx - rx - 3)), cMax = Math.min(cols - 1, Math.ceil(cx + rx + 3));
            for (let r = rMin; r <= rMax; r++) for (let c = cMin; c <= cMax; c++) {
                if (onlyOn && !onlyOn.includes(getT(c, r))) continue;
                const ang = Math.atan2(r - cy, c - cx);
                const noise = Math.sin(ang * 3 + phaseA) * wob + Math.cos(ang * 5 + phaseB) * (wob * 0.5);
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

        // Прокладывает плавную кривую Безье с органическим изгибом и возвращает точки + углы
        function carveSpline(p0, p1, radius, tile, opts = {}) {
            const bend = (opts.bend !== undefined ? opts.bend : MB_RAND_FLOAT(-0.28, 0.28));
            const dx = p1.x - p0.x, dy = p1.y - p0.y;
            const len = Math.max(1, Math.hypot(dx, dy));
            const nx = -dy / len, ny = dx / len;
            const ctrl = {
                x: (p0.x + p1.x) / 2 + nx * len * bend,
                y: (p0.y + p1.y) / 2 + ny * len * bend
            };
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

                if (opts.skipRange && t > opts.skipRange[0] && t < opts.skipRange[1]) continue;

                const rr = Math.ceil(radius + 0.5);
                for (let dr = -rr; dr <= rr; dr++) for (let dc = -rr; dc <= rr; dc++) {
                    const cx = Math.floor(x) + dc, cy = Math.floor(y) + dr;
                    if (!inB(cx, cy)) continue;
                    if (Math.hypot(cx + 0.5 - x, cy + 0.5 - y) <= radius) {
                        if (opts.keepWater && isWater(cx, cy)) continue;
                        if (opts.keepWall && isWall(cx, cy)) continue;
                        setT(cx, cy, tile);
                    }
                }
            }
            return pts;
        }

        // Автоматический мост под точным углом в любом месте пересечения дороги и воды!
        function autoPlaceBridges(roadPts, isStone = false) {
            const pool = isStone ? P.stoneBridge : P.woodBridge;
            let inW = false, startIdx = 0;
            for (let i = 0; i < roadPts.length; i++) {
                const pt = roadPts[i];
                const wet = isWater(Math.floor(pt.x), Math.floor(pt.y));
                if (wet && !inW) { inW = true; startIdx = i; }
                else if ((!wet || i === roadPts.length - 1) && inW) {
                    inW = false;
                    const endIdx = wet ? i : i - 1;
                    const a = roadPts[startIdx], b = roadPts[endIdx];
                    const span = Math.hypot(b.x - a.x, b.y - a.y) + 1.8;
                    if (span < 1.6) continue;
                    const deg = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
                    const segs = Math.max(1, Math.ceil(span / 3.4));
                    const segLen = span / segs;
                    const sc = Math.max(0.76, segLen / 3.45);
                    for (let s = 0; s < segs; s++) {
                        const frac = (s + 0.5) / segs;
                        const bx = a.x + (b.x - a.x) * frac;
                        const by = a.y + (b.y - a.y) * frac;
                        addObj(pool, bx, by, sc, deg, 1.45);
                    }
                }
            }
        }

        // Универсальный блок: уютный лагерь (костёр + палатки лицом к огню + спальники)
        function placeCampCluster(cx, cy, opts = {}) {
            const rad = opts.radius || 3.2;
            if (opts.groundTile) paintBlob(cx, cy, rad, rad * 0.85, opts.groundTile, 0.15);
            const firePool = opts.firePool || P.campfires;
            const tentPool = opts.tentPool || P.campTents;
            const propPool = opts.propPool || P.campGear;
            addObj(firePool, cx, cy, opts.fireScale || 1.1, 0, 1.5);
            const nTents = opts.tents || MB_RAND_INT(2, 4);
            const startAng = MB_RAND_FLOAT(0, 6.28);
            for (let i = 0; i < nTents; i++) {
                const ang = startAng + (i / nTents) * 6.28 + MB_RAND_FLOAT(-0.25, 0.25);
                const dist = MB_RAND_FLOAT(rad * 0.72, rad * 1.02);
                const tx = cx + Math.cos(ang) * dist, ty = cy + Math.sin(ang) * dist;
                if (!inB(Math.floor(tx), Math.floor(ty)) || isWater(Math.floor(tx), Math.floor(ty)) || isWall(Math.floor(tx), Math.floor(ty))) continue;
                if (!canPlace(tx, ty, 2.0)) continue;
                const faceFire = (ang * 180 / Math.PI) + 90;
                addObj(i === 0 && opts.bigTentPool ? opts.bigTentPool : tentPool, tx, ty, i === 0 && opts.bigTentPool ? 0.88 : 1.05, faceFire, 2.0);
            }
            for (let i = 0; i < (opts.props || 3); i++) {
                const ang = MB_RAND_FLOAT(0, 6.28);
                const px = cx + Math.cos(ang) * MB_RAND_FLOAT(1.6, rad * 0.85);
                const py = cy + Math.sin(ang) * MB_RAND_FLOAT(1.6, rad * 0.85);
                if (canPlace(px, py, 1.1) && !isWater(Math.floor(px), Math.floor(py))) {
                    addObj(propPool, px, py, 0.92, MB_RAND_INT(0, 359), 1.0);
                }
            }
        }

        // Универсальный блок: древние руины (каменная площадка + алтарь/сундук + колонны + обломки)
        function placeRuinsCluster(cx, cy, floorT = T.stone) {
            const rad = MB_RAND_FLOAT(3.2, 4.6);
            paintBlob(cx, cy, rad, rad * 0.82, floorT, 0.2);
            addObj(P.altars, cx, cy, 1.15, MB_PICK([0, 90, 180, 270]), 1.5);
            if (canPlace(cx + 1.8, cy - 0.6, 1.0)) addObj(P.chests, cx + 1.8, cy - 0.6, 0.88, MB_RAND_INT(0, 359), 0.9);
            const pillarsN = MB_RAND_INT(4, 6);
            for (let i = 0; i < pillarsN; i++) {
                const ang = (i / pillarsN) * 6.28 + 0.3;
                const px = cx + Math.cos(ang) * (rad * 0.78), py = cy + Math.sin(ang) * (rad * 0.68);
                if (canPlace(px, py, 1.1)) addObj(Math.random() < 0.7 ? P.pillars : P.rubble, px, py, 0.98, MB_RAND_INT(0, 359), 1.0);
            }
        }

        // Естественные рощи растительности и камней (избегают дорог/воды/стен)
        function scatterGroves(allowedTiles, treePool, bushPool, accentPool, density = 1.0) {
            const groves = Math.max(4, Math.floor((cols * rows) / 52 * density));
            for (let g = 0; g < groves; g++) {
                const gx = MB_RAND_FLOAT(1.5, cols - 1.5), gy = MB_RAND_FLOAT(1.5, rows - 1.5);
                if (!allowedTiles.includes(getT(Math.floor(gx), Math.floor(gy)))) continue;
                const count = MB_RAND_INT(3, 6);
                for (let k = 0; k < count; k++) {
                    const ox = gx + MB_RAND_FLOAT(-2.9, 2.9), oy = gy + MB_RAND_FLOAT(-2.5, 2.5);
                    if (!inB(Math.floor(ox), Math.floor(oy))) continue;
                    if (!allowedTiles.includes(getT(Math.floor(ox), Math.floor(oy)))) continue;
                    if (!canPlace(ox, oy, 1.55)) continue;
                    if (k < 3) addObj(treePool, ox, oy, MB_RAND_FLOAT(0.92, 1.38), MB_RAND_INT(0, 359), 1.7);
                    else addObj(bushPool, ox, oy, MB_RAND_FLOAT(0.82, 1.18), MB_RAND_INT(0, 359), 0.95);
                }
            }
            const accents = Math.floor((cols * rows) / 16 * density);
            for (let i = 0; i < accents; i++) {
                const ox = MB_RAND_FLOAT(1.2, cols - 1.2), oy = MB_RAND_FLOAT(1.2, rows - 1.2);
                if (!allowedTiles.includes(getT(Math.floor(ox), Math.floor(oy)))) continue;
                if (!canPlace(ox, oy, 1.1)) continue;
                addObj(accentPool, ox, oy, MB_RAND_FLOAT(0.76, 1.12), MB_RAND_INT(0, 359), 0.85);
            }
        }

        function scatterWaterDetails(prob = 0.14) {
            for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
                if (isWater(c, r) && canPlace(c + 0.5, r + 0.5, 1.55) && Math.random() < prob) {
                    addObj(P.waterDec, c + 0.5, r + 0.5, 0.92, MB_RAND_INT(0, 359), 0.9);
                }
            }
        }

        let genTitle = 'Локация';

        // ============================================================
        // 1. 👑 ГОРОД (ПРОЦЕДУРНЫЕ УЛИЦЫ, КАНАЛЫ, ПЛОЩАДИ И КВАРТАЛЫ)
        // ============================================================
        if (picked === 'city') {
            const hasCanal = Math.random() < 0.36;
            const hasWallGate = !hasCanal && cols >= 22 && Math.random() < 0.30;
            const useThatchMix = Math.random() < 0.45 ? 0.35 : 0.10;
            const roads = [];

            // 1. Опциональный извилистый городской канал с каменной набережной
            let canalPts = null;
            if (hasCanal) {
                const [c0, c1] = randomEdgePair(false);
                carveSpline(c0, c1, 2.8, T.flagstone, { bend: MB_RAND_FLOAT(-0.22, 0.22) });
                canalPts = carveSpline(c0, c1, 1.55, T.water, { bend: MB_RAND_FLOAT(-0.22, 0.22) });
                // Лодки вдоль канала
                for (let i = 8; i < canalPts.length - 8; i += 16) {
                    const pt = canalPts[i];
                    if (isWater(Math.floor(pt.x), Math.floor(pt.y)) && canPlace(pt.x, pt.y, 1.8)) {
                        const deg = Math.atan2(pt.uy, pt.ux) * 180 / Math.PI;
                        addObj(P.boats, pt.x, pt.y, 1.0, deg, 1.5);
                    }
                }
            }

            // 2. Главная улица (произвольный угол/кривизна) + 1–2 поперечных переулка
            const [r0, r1] = randomEdgePair(true);
            roads.push(carveSpline(r0, r1, 1.35, T.flagstone, { keepWater: true, bend: MB_RAND_FLOAT(-0.2, 0.2) }));
            const sideCount = cols >= 28 ? 2 : 1;
            for (let s = 0; s < sideCount; s++) {
                const anchor = roads[0][Math.floor(roads[0].length * MB_RAND_FLOAT(0.25, 0.75))];
                const targetEdge = randomEdgePoint(MB_PICK(['N', 'S', 'E', 'W']));
                roads.push(carveSpline(anchor, targetEdge, 1.15, T.flagstone, { keepWater: true, bend: MB_RAND_FLOAT(-0.18, 0.18) }));
            }

            // 3. Если город с крепостной стеной — отсекаем пригород травой и возводим стену с воротами!
            if (hasWallGate) {
                const vertical = Math.random() < 0.65;
                const cut = vertical ? Math.floor(cols * MB_RAND_FLOAT(0.35, 0.65)) : Math.floor(rows * MB_RAND_FLOAT(0.35, 0.65));
                const greenSide = Math.random() < 0.5 ? -1 : 1;
                const gatePos = vertical ? Math.floor(rows * MB_RAND_FLOAT(0.3, 0.7)) : Math.floor(cols * MB_RAND_FLOAT(0.3, 0.7));
                for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                    const val = vertical ? c : r;
                    const dist = val - cut;
                    if (Math.abs(dist) <= 0) {
                        const along = vertical ? r : c;
                        if (Math.abs(along - gatePos) > 2) {
                            setT(c, r, T.wall);
                            if (vertical && inB(c + 1, r)) setT(c + 1, r, T.wall);
                            if (!vertical && inB(c, r + 1)) setT(c, r + 1, T.wall);
                        } else {
                            setT(c, r, T.flagstone);
                        }
                    } else if (dist * greenSide > 1 && getT(c, r) === T.cobble) {
                        setT(c, r, T.grass);
                    }
                }
                const gx = vertical ? cut + 0.5 : gatePos + 0.5;
                const gy = vertical ? gatePos + 0.5 : cut + 0.5;
                addObj(P.watchpost, gx + (vertical ? 0 : -3.4), gy + (vertical ? -3.4 : 0), 1.1, 0, 2.0);
                addObj(P.watchpost, gx + (vertical ? 0 : 3.4), gy + (vertical ? 3.4 : 0), 1.1, 0, 2.0);
                addObj(P.flags, gx + (vertical ? -1.4 : -2.6), gy + (vertical ? -2.6 : -1.4), 1.0, 0, 0.7);
                addObj(P.carts, gx + (vertical ? greenSide * 3.5 : 0), gy + (vertical ? 0 : greenSide * 3.5), 1.0, vertical ? 0 : 90, 1.7);
            }

            // 4. Авто-мосты через канал + повозки и фонари вдоль улиц
            roads.forEach(rPts => {
                if (hasCanal) autoPlaceBridges(rPts, true);
                for (let i = 8; i < rPts.length - 8; i += 14) {
                    const pt = rPts[i];
                    if (isWater(Math.floor(pt.x), Math.floor(pt.y)) || isWall(Math.floor(pt.x), Math.floor(pt.y))) continue;
                    const lx = pt.x + pt.nx * 1.9, ly = pt.y + pt.ny * 1.9;
                    if (canPlace(lx, ly, 1.0) && !isWater(Math.floor(lx), Math.floor(ly)) && !isWall(Math.floor(lx), Math.floor(ly))) {
                        addObj(P.lamps, lx, ly, 0.85, 0, 0.8);
                    }
                }
            });

            // 5. Случайная площадь или городской сквер на пересечении улиц
            const hub = roads[0][Math.floor(roads[0].length * MB_RAND_FLOAT(0.32, 0.68))];
            if (!isWater(Math.floor(hub.x), Math.floor(hub.y)) && !isWall(Math.floor(hub.x), Math.floor(hub.y))) {
                const isPark = Math.random() < 0.35;
                const pRad = Math.min(4.8, Math.max(3.0, cols * 0.14));
                paintBlob(hub.x, hub.y, pRad, pRad * 0.85, isPark ? T.grass : T.stone, 0.12, [T.cobble, T.flagstone]);
                addObj(P.cityCenter, hub.x, hub.y, 1.25, 0, 2.0);
                for (let a = 0; a < 4; a++) {
                    const ang = a * 1.57 + 0.78;
                    const sx = hub.x + Math.cos(ang) * (pRad * 0.68), sy = hub.y + Math.sin(ang) * (pRad * 0.62);
                    if (!canPlace(sx, sy, 1.3) || isWater(Math.floor(sx), Math.floor(sy))) continue;
                    if (isPark) {
                        addObj(a % 2 === 0 ? P.trees : P.gardens, sx, sy, 0.95, MB_RAND_INT(0, 359), 1.2);
                    } else {
                        addObj(P.tables, sx, sy, 0.9, a % 2 === 0 ? 0 : 90, 1.2);
                        addObj(P.market, sx + 0.5, sy + 0.5, 0.74, MB_RAND_INT(0, 359), 0);
                    }
                }
            }

            // 6. Плотная умная застройка всех свободных мощёных кварталов домами!
            for (let y = 2.4; y <= rows - 2.4; y += 4.3) {
                for (let x = 2.6; x <= cols - 2.6; x += 5.1) {
                    const jx = x + MB_RAND_FLOAT(-0.5, 0.5), jy = y + MB_RAND_FLOAT(-0.4, 0.4);
                    let ok = true;
                    for (let dy = -1; dy <= 1 && ok; dy++) for (let dx = -2; dx <= 2 && ok; dx++) {
                        if (getT(Math.floor(jx) + dx, Math.floor(jy) + dy) !== T.cobble) ok = false;
                    }
                    if (!ok || !canPlace(jx, jy, 3.0)) continue;

                    if (Math.random() < 0.82) {
                        const rot = Math.random() < 0.62 ? MB_PICK([0, 180]) : MB_PICK([90, 270]);
                        const sc = MB_RAND_FLOAT(0.92, 1.15);
                        addObj(Math.random() < useThatchMix ? P.roofThatch : P.roofTile, jx, jy, sc, rot, 2.75 * sc);
                        if (Math.random() < 0.78) addObj('other_misc_chimney_1x1', jx + 0.65, jy - 0.35, 0.88, 0, 0);
                        const px = jx + MB_PICK([-2.2, 2.2]), py = jy + MB_PICK([-1.7, 1.7]);
                        if (getT(Math.floor(px), Math.floor(py)) === T.cobble && canPlace(px, py, 0.8)) {
                            addObj(Math.random() < 0.6 ? P.market : P.gardens, px, py, 0.76, MB_RAND_INT(0, 359), 0.7);
                        }
                    } else {
                        paintBlob(jx, jy, 1.8, 1.5, T.grass, 0.14, [T.cobble]);
                        addObj(P.trees, jx - 0.4, jy, 1.0, MB_RAND_INT(0, 359), 1.3);
                        addObj(P.gardens, jx + 0.9, jy + 0.4, 0.88, MB_RAND_INT(0, 359), 0.7);
                    }
                }
            }
            if (hasWallGate) scatterGroves([T.grass], P.trees, P.bushes, P.flowers, 0.95);
            genTitle = hasCanal ? MB_PICK(['Речной квартал', 'Набережная каналов', 'Мосты Купцов'])
                     : (hasWallGate ? MB_PICK(['Городские ворота', 'Застава Столицы', 'Въезд в Притишье'])
                     : MB_PICK(['Торговый квартал', 'Улочки Старого города', 'Ярмарочная площадь', 'Ремесленная слобода']));
        }

        // ============================================================
        // 2. ⚔️ ПОЛЕ БИТВЫ / ОСАДА (ПРОЦЕДУРНЫЙ ФРОНТ, БАРРИКАДЫ, ОСАДА)
        // ============================================================
        else if (picked === 'battlefield') {
            const style = MB_PICK(['frontline', 'breach', 'ambush', 'encirclement']);
            // Случайные грязевые пятна и воронки от снарядов
            for (let i = 0; i < Math.floor((cols * rows) / 38); i++) {
                paintBlob(MB_RAND_FLOAT(2, cols - 2), MB_RAND_FLOAT(2, rows - 2), MB_RAND_FLOAT(1.8, 3.6), MB_RAND_FLOAT(1.5, 3.0), T.dirt, 0.22);
            }

            if (style === 'ambush') {
                const [p0, p1] = randomEdgePair(true);
                const roadPts = carveSpline(p0, p1, 1.45, T.dirt, { bend: MB_RAND_FLOAT(-0.28, 0.28) });
                const nWagons = Math.min(4, Math.max(2, Math.floor(cols / 9)));
                for (let w = 0; w < nWagons; w++) {
                    const pt = roadPts[Math.floor(roadPts.length * (0.24 + (w / Math.max(1, nWagons - 1)) * 0.52))];
                    const deg = Math.atan2(pt.uy, pt.ux) * 180 / Math.PI + MB_RAND_INT(-24, 24);
                    addObj(P.carts, pt.x, pt.y, 1.12, deg, 1.85);
                    if (w === 1) addObj(P.battleFire, pt.x + pt.nx * 1.4, pt.y + pt.ny * 1.4, 0.92, 0, 1.1);
                    addObj(w % 2 === 0 ? P.crates : P.barrels, pt.x - pt.nx * 1.6, pt.y - pt.ny * 1.6, 0.88, MB_RAND_INT(0, 359), 0.8);
                }
                const blockPt = roadPts[Math.floor(roadPts.length * 0.82)];
                addObj(P.logs, blockPt.x, blockPt.y, 1.35, Math.atan2(blockPt.uy, blockPt.ux) * 180 / Math.PI + 90, 1.6);
                scatterGroves([T.grass], P.trees, P.bushes, P.rocks, 1.15);
                genTitle = MB_PICK(['Засада на обоз', 'Разгромленный караван', 'Бой на лесном тракте']);
            }
            else if (style === 'encirclement') {
                const hx = MB_RAND_FLOAT(cols * 0.34, cols * 0.66), hy = MB_RAND_FLOAT(rows * 0.34, rows * 0.66);
                const rx = Math.min(8.5, cols * 0.26), ry = Math.min(6.0, rows * 0.29);
                paintBlob(hx, hy, rx + 2.0, ry + 2.0, T.dirt, 0.16);
                paintBlob(hx, hy, rx - 1.2, ry - 1.2, T.stone, 0.12);
                const ringN = Math.max(10, Math.floor((rx + ry) * 1.3));
                const gapA = MB_RAND_INT(0, ringN - 1), gapB = (gapA + Math.floor(ringN / 2)) % ringN;
                for (let i = 0; i < ringN; i++) {
                    if (i === gapA || i === gapB) continue;
                    const ang = (i / ringN) * 6.28;
                    const bx = hx + Math.cos(ang) * rx, by = hy + Math.sin(ang) * ry;
                    if (inB(Math.floor(bx), Math.floor(by))) addObj(P.barricades, bx, by, 1.08, ang * 180 / Math.PI + 90, 1.1);
                }
                placeCampCluster(hx, hy, { radius: rx * 0.48, tents: 2, bigTentPool: P.campBigTents, props: 2 });
                addObj(P.flags, hx + 1.8, hy - 1.6, 1.12, 0, 0.8);
                // Штурмовые орудия снаружи, направленные точно на центр редута!
                for (let s = 0; s < 3; s++) {
                    const ang = (s / 3) * 6.28 + MB_RAND_FLOAT(-0.3, 0.3);
                    const sx = hx + Math.cos(ang) * (rx + 4.2), sy = hy + Math.sin(ang) * (ry + 3.4);
                    if (inB(Math.floor(sx), Math.floor(sy)) && canPlace(sx, sy, 2.0)) {
                        const aimDeg = Math.atan2(hy - sy, hx - sx) * 180 / Math.PI;
                        addObj(P.siege, sx, sy, 1.2, aimDeg, 1.9);
                        addObj(P.siegeAmmo, sx - Math.cos(ang) * 1.4, sy - Math.sin(ang) * 1.4, 0.9, 0, 0.8);
                    }
                }
                scatterGroves([T.grass], P.trees, P.bushes, P.rocks, 0.7);
                genTitle = MB_PICK(['Оборона высоты', 'Укреплённый редут', 'Последний рубеж']);
            }
            else {
                // Линия фронта (река ИЛИ крепостная стена с проломом) под случайным направлением!
                const isBreach = (style === 'breach');
                const [f0, f1] = randomEdgePair(false);
                const linePts = carveSpline(f0, f1, isBreach ? 1.05 : 1.55, isBreach ? T.wall : T.water, {
                    bend: MB_RAND_FLOAT(-0.2, 0.2),
                    skipRange: isBreach ? [0.40, 0.58] : null
                });
                const midPt = linePts[Math.floor(linePts.length * 0.49)];
                const normalDeg = Math.atan2(midPt.ny, midPt.nx) * 180 / Math.PI;

                if (isBreach) {
                    const bA = linePts[Math.floor(linePts.length * 0.39)], bB = linePts[Math.floor(linePts.length * 0.59)];
                    addObj(P.collapsed, bA.x, bA.y, 1.15, normalDeg, 1.4);
                    addObj(P.collapsed, bB.x, bB.y, 1.15, normalDeg + 180, 1.4);
                    addObj(P.battleFire, midPt.x, midPt.y, 1.0, 0, 1.2);
                    addObj('camp_batteringrambroken', midPt.x - midPt.nx * 3.4, midPt.y - midPt.ny * 3.4, 1.2, normalDeg, 1.8);
                } else {
                    const rA = { x: midPt.x - midPt.nx * 10, y: midPt.y - midPt.ny * 10 };
                    const rB = { x: midPt.x + midPt.nx * 10, y: midPt.y + midPt.ny * 10 };
                    const crossPts = carveSpline(rA, rB, 1.3, T.dirt, { keepWater: true, bend: 0 });
                    autoPlaceBridges(crossPts, Math.random() < 0.5);
                }

                // Плотные баррикады защитников вдоль линии фронта
                for (let i = 6; i < linePts.length - 6; i += 7) {
                    const pt = linePts[i];
                    const bx = pt.x + pt.nx * 2.8, by = pt.y + pt.ny * 2.8;
                    if (canPlace(bx, by, 1.3) && !isWater(Math.floor(bx), Math.floor(by)) && !isWall(Math.floor(bx), Math.floor(by))) {
                        addObj(P.barricades, bx, by, 1.08, Math.atan2(pt.ny, pt.nx) * 180 / Math.PI + 180, 1.15);
                    }
                }
                // Осадные орудия и лагеря по обе стороны фронта
                for (const side of [-1, 1]) {
                    for (const frac of [0.28, 0.72]) {
                        const pt = linePts[Math.floor(linePts.length * frac)];
                        const sx = pt.x + pt.nx * side * 6.2, sy = pt.y + pt.ny * side * 6.2;
                        if (canPlace(sx, sy, 2.0) && !isWater(Math.floor(sx), Math.floor(sy)) && !isWall(Math.floor(sx), Math.floor(sy))) {
                            const aim = Math.atan2(-pt.ny * side, -pt.nx * side) * 180 / Math.PI;
                            addObj(P.siege, sx, sy, 1.2, aim, 1.9);
                            addObj(P.siegeAmmo, sx + pt.nx * side * 1.4, sy + pt.ny * side * 1.4, 0.9, 0, 0.8);
                        }
                    }
                    const cx = midPt.x + midPt.nx * side * 8.5, cy = midPt.y + midPt.ny * side * 8.5;
                    if (inB(Math.floor(cx), Math.floor(cy))) {
                        addObj(P.campTents, cx, cy, 1.1, normalDeg + (side > 0 ? 180 : 0), 2.0);
                        addObj(P.flags, cx - midPt.nx * side * 1.8, cy - midPt.ny * side * 1.8, 1.1, 0, 0.8);
                    }
                }
                addObj(P.battleFire, midPt.x - midPt.nx * 2.5 + midPt.ux * 3.0, midPt.y - midPt.ny * 2.5 + midPt.uy * 3.0, 0.92, 0, 1.1);
                genTitle = isBreach ? MB_PICK(['Пролом в стене', 'Осада цитадели', 'Штурм бастиона'])
                                    : MB_PICK(['Штурм переправы', 'Битва у реки', 'Кровавый брод']);
            }

            // Боевые следы (мечи, щиты, обломки) по всей карте
            for (let i = 0; i < Math.floor((cols * rows) / 28); i++) {
                const fx = MB_RAND_FLOAT(2, cols - 2), fy = MB_RAND_FLOAT(2, rows - 2);
                if (!isWater(Math.floor(fx), Math.floor(fy)) && !isWall(Math.floor(fx), Math.floor(fy)) && canPlace(fx, fy, 1.3)) {
                    addObj(Math.random() < 0.62 ? P.battleLoot : P.rubble, fx, fy, 0.88, MB_RAND_INT(0, 359), 0.9);
                }
            }
        }

        // ============================================================
        // 3. 🌲 ДИКИЙ ЛЕС (СЛУЧАЙНЫЕ РЕКИ, ТРОПЫ, РУИНЫ, ЛАГЕРЯ И РОЩИ)
        // ============================================================
        else if (picked === 'forest') {
            const isAutumn = Math.random() < 0.30;
            const leafT = isAutumn ? T.leafR : T.leafG;
            if (isAutumn) { window._mbLighting = 'sunset'; data.lighting = 'sunset'; }

            for (let i = 0; i < Math.floor((cols * rows) / 36); i++) {
                paintBlob(MB_RAND_FLOAT(2, cols - 2), MB_RAND_FLOAT(2, rows - 2), MB_RAND_FLOAT(1.8, 3.6), MB_RAND_FLOAT(1.5, 3.0), leafT, 0.22);
            }

            // 65% шанс на воду: либо извилистая река, либо лесное озеро (иногда с островком)
            const waterRoll = Math.random();
            if (waterRoll < 0.42) {
                const [w0, w1] = randomEdgePair(true);
                carveSpline(w0, w1, cols >= 26 ? 1.85 : 1.45, T.water, { bend: MB_RAND_FLOAT(-0.3, 0.3) });
            } else if (waterRoll < 0.68) {
                const lx = MB_RAND_FLOAT(cols * 0.28, cols * 0.72), ly = MB_RAND_FLOAT(rows * 0.28, rows * 0.72);
                const rx = MB_RAND_FLOAT(3.5, Math.min(7.5, cols * 0.28)), ry = MB_RAND_FLOAT(2.8, Math.min(5.5, rows * 0.32));
                paintBlob(lx, ly, rx, ry, T.water, 0.18);
                if (rx >= 4.8 && Math.random() < 0.5) paintBlob(lx, ly, rx * 0.42, ry * 0.42, T.grass, 0.15);
            }

            // 1 или 2 извилистые лесные тропы + автоматические мосты через любую воду!
            const trails = Math.random() < 0.45 ? 2 : 1;
            const mainPair = randomEdgePair(true);
            const mainTrail = carveSpline(mainPair[0], mainPair[1], 1.15, T.dirt, { keepWater: true, bend: MB_RAND_FLOAT(-0.25, 0.25) });
            autoPlaceBridges(mainTrail, Math.random() < 0.35);
            if (trails === 2) {
                const branchStart = mainTrail[Math.floor(mainTrail.length * MB_RAND_FLOAT(0.3, 0.7))];
                const branchTrail = carveSpline(branchStart, randomEdgePoint(MB_PICK(['N', 'S', 'E', 'W'])), 1.0, T.dirt, { keepWater: true });
                autoPlaceBridges(branchTrail, false);
            }

            // 1–2 случайные точки интереса на сухой поляне (лагерь путников или древние руины)
            const poiCount = cols >= 28 ? 2 : 1;
            const poiTypes = ['camp', 'ruins'];
            for (let p = 0; p < poiCount; p++) {
                for (let tries = 0; tries < 25; tries++) {
                    const px = MB_RAND_FLOAT(4, cols - 4), py = MB_RAND_FLOAT(4, rows - 4);
                    if (isWater(Math.floor(px), Math.floor(py)) || !canPlace(px, py, 4.5)) continue;
                    const dry = [-2, 0, 2].every(dy => [-2, 0, 2].every(dx => !isWater(Math.floor(px) + dx, Math.floor(py) + dy)));
                    if (!dry) continue;
                    const pType = poiTypes[p % poiTypes.length];
                    if (pType === 'camp') placeCampCluster(px, py, { groundTile: T.dirt, radius: 2.8, tents: MB_RAND_INT(1, 3) });
                    else placeRuinsCluster(px, py, T.stone);
                    break;
                }
            }

            scatterWaterDetails(0.15);
            scatterGroves([T.grass, leafT], P.trees, isAutumn ? P.autumnBushes : P.bushes, Math.random() < 0.5 ? P.flowers : P.rocks, 1.18);
            scatterGroves([T.grass, leafT], P.logs, P.fungi, P.rocks, 0.32);
            genTitle = isAutumn ? MB_PICK(['Осенний тракт', 'Золотая чаща', 'Осенняя переправа'])
                                : MB_PICK(['Дикая чаща', 'Лесная переправа', 'Тропа через руины', 'Поляна путников']);
        }

        // ============================================================
        // 4. 🏴‍☠️ ПИРАТСКАЯ БУХТА (СЛУЧАЙНЫЙ БЕРЕГ, ОСТРОВА, ПИРС И КЛАД)
        // ============================================================
        else if (picked === 'pirate') {
            const isIsland = Math.random() < 0.45;
            if (isIsland) {
                for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) setT(c, r, T.water);
                const mainX = MB_RAND_FLOAT(cols * 0.40, cols * 0.60), mainY = MB_RAND_FLOAT(rows * 0.40, rows * 0.60);
                paintBlob(mainX, mainY, cols * 0.34, rows * 0.36, T.sand, 0.2);
                paintBlob(mainX, mainY, cols * 0.19, rows * 0.21, T.grass, 0.18);
                // Опциональный второй маленький островок с сундуком
                if (cols >= 26 && Math.random() < 0.55) {
                    const sx = mainX > cols / 2 ? 4.5 : cols - 4.5, sy = mainY > rows / 2 ? 4.0 : rows - 4.0;
                    paintBlob(sx, sy, 3.2, 2.8, T.sand, 0.18);
                    addObj(P.pirateLoot, sx, sy, 1.05, 25, 1.1);
                }
                placeCampCluster(mainX, mainY, { radius: 2.8, tents: 2, propPool: P.pirateLoot, props: 3 });
                addObj('camp_pirateflag', mainX + 1.8, mainY - 1.6, 1.12, 0, 0.8);
                genTitle = MB_PICK(['Остров Сокровищ', 'Атолл Корсаров', 'Лагуна Черепа']);
            } else {
                // Случайный берег с любой из 4 сторон карты!
                const seaSide = MB_PICK(['W', 'E', 'N', 'S']);
                const curveFreq = MB_RAND_FLOAT(0.14, 0.26);
                for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                    const depth = (seaSide === 'W') ? (c - cols * 0.38 - Math.sin(r * curveFreq + phaseA) * 3.0)
                                : (seaSide === 'E') ? (cols * 0.62 - c - Math.sin(r * curveFreq + phaseA) * 3.0)
                                : (seaSide === 'N') ? (r - rows * 0.38 - Math.sin(c * curveFreq + phaseA) * 2.5)
                                : (rows * 0.62 - r - Math.sin(c * curveFreq + phaseA) * 2.5);
                    if (depth < 0) setT(c, r, T.water);
                    else if (depth < 4.5) setT(c, r, T.sand);
                    else setT(c, r, T.grass);
                }
                // Находим точку на берегу для пирса и лагеря
                const midC = Math.floor(cols / 2), midR = Math.floor(rows / 2);
                let shoreX = midC, shoreY = midR;
                for (let r = 3; r < rows - 3; r++) for (let c = 3; c < cols - 3; c++) {
                    if (getT(c, r) === T.sand && (isWater(c - 1, r) || isWater(c + 1, r) || isWater(c, r - 1) || isWater(c, r + 1))) {
                        if (Math.hypot(c - midC, r - midR) < Math.hypot(shoreX - midC, shoreY - midR) || getT(shoreX, shoreY) !== T.sand) {
                            shoreX = c; shoreY = r;
                        }
                    }
                }
                const seaDx = seaSide === 'W' ? -1 : (seaSide === 'E' ? 1 : 0);
                const seaDy = seaSide === 'N' ? -1 : (seaSide === 'S' ? 1 : 0);
                const pierDeg = Math.atan2(seaDy, seaDx) * 180 / Math.PI;
                addObj(P.woodBridge, shoreX + seaDx * 1.4, shoreY + seaDy * 1.4, 1.15, pierDeg, 2.0);
                addObj(P.boats, shoreX + seaDx * 3.8 + seaDy * 2.0, shoreY + seaDy * 3.8 - seaDx * 2.0, 1.12, pierDeg + 20, 1.6);
                const campX = Math.max(3, Math.min(cols - 3, shoreX - seaDx * 3.2));
                const campY = Math.max(3, Math.min(rows - 3, shoreY - seaDy * 3.2));
                placeCampCluster(campX, campY, { radius: 2.8, tents: 2, propPool: P.pirateLoot, props: 4 });
                addObj('camp_pirateflag', campX - seaDx * 1.5, campY - seaDy * 1.5, 1.1, 0, 0.8);
                genTitle = MB_PICK(['Бухта Контрабандистов', 'Пиратский причал', 'Берег Бурных Волн']);
            }
            // Лодки у кромки воды (для острова)
            if (isIsland) {
                for (let tries = 0; tries < 25; tries++) {
                    const bx = MB_RAND_INT(2, cols - 3), by = MB_RAND_INT(2, rows - 3);
                    if (isWater(bx, by) && [-2, 0, 2].some(d => getT(bx + d, by) === T.sand || getT(bx, by + d) === T.sand) && canPlace(bx, by, 2.2)) {
                        addObj(P.boats, bx + 0.5, by + 0.5, 1.15, MB_RAND_INT(0, 359), 1.6);
                        break;
                    }
                }
            }
            scatterGroves([T.grass], P.palms, P.bushes, P.flowers, 1.1);
            scatterGroves([T.sand], P.beachLife, P.pirateLoot, P.rocks, 0.45);
        }

        // ============================================================
        // 5. 🏜️ ПУСТЫНЯ (ОАЗИСЫ, РУИНЫ, КАРАВАНЫ, ДЮНЫ И КАКТУСЫ)
        // ============================================================
        else if (picked === 'desert') {
            const hasOasis = Math.random() < 0.62;
            const hasRuins = !hasOasis || (cols >= 26 && Math.random() < 0.45);
            let ox = cols / 2, oy = rows / 2;

            if (hasOasis) {
                ox = MB_RAND_FLOAT(cols * 0.28, cols * 0.72);
                oy = MB_RAND_FLOAT(rows * 0.28, rows * 0.72);
                const rx = MB_RAND_FLOAT(2.8, Math.min(5.2, cols * 0.18)), ry = MB_RAND_FLOAT(2.2, Math.min(4.0, rows * 0.22));
                paintBlob(ox, oy, rx + 2.0, ry + 1.8, T.grass, 0.18);
                paintBlob(ox, oy, rx, ry, T.water, 0.15);
                for (let a = 0; a < 8; a++) {
                    const ang = (a / 8) * 6.28 + MB_RAND_FLOAT(-0.2, 0.2);
                    const px = ox + Math.cos(ang) * (rx + 1.3), py = oy + Math.sin(ang) * (ry + 1.2);
                    if (canPlace(px, py, 1.5)) addObj(P.palms, px, py, MB_RAND_FLOAT(0.92, 1.25), MB_RAND_INT(0, 359), 1.55);
                }
            }
            if (hasRuins) {
                const rx = hasOasis ? (ox > cols / 2 ? cols * 0.24 : cols * 0.76) : MB_RAND_FLOAT(cols * 0.32, cols * 0.68);
                const ry = hasOasis ? (oy > rows / 2 ? rows * 0.28 : rows * 0.72) : MB_RAND_FLOAT(rows * 0.32, rows * 0.68);
                placeRuinsCluster(rx, ry, T.flagstone);
            }
            // Стоянка каравана в свободном месте
            for (let tries = 0; tries < 25; tries++) {
                const cx = MB_RAND_FLOAT(4, cols - 4), cy = MB_RAND_FLOAT(4, rows - 4);
                if (getT(Math.floor(cx), Math.floor(cy)) !== T.sand || !canPlace(cx, cy, 4.5)) continue;
                placeCampCluster(cx, cy, { radius: 3.3, tents: 2, bigTentPool: P.desertTents, tentPool: P.campTents, firePool: ['camp_desert_campfire_1x1'], propPool: P.desertProps, props: 4 });
                break;
            }
            scatterGroves([T.sand], P.desertRocks, P.desertCacti, P.desertProps, 0.9);
            genTitle = hasOasis && hasRuins ? 'Оазис у древних руин' : (hasOasis ? 'Пустынный оазис каравана' : 'Занесённые песком руины');
        }

        // ============================================================
        // 6. 🍄 ФЕЙСКИЙ ЛЕС (ВОЛШЕБНЫЕ ОЗЁРА, КРИСТАЛЛЫ, ГРИБНЫЕ КРУГИ)
        // ============================================================
        else if (picked === 'fey') {
            for (let i = 0; i < Math.floor((cols * rows) / 34); i++) {
                paintBlob(MB_RAND_FLOAT(2, cols - 2), MB_RAND_FLOAT(2, rows - 2), MB_RAND_FLOAT(2.0, 3.8), MB_RAND_FLOAT(1.8, 3.2), T.leafG, 0.22);
            }
            if (Math.random() < 0.55) {
                const wx = MB_RAND_FLOAT(cols * 0.28, cols * 0.72), wy = MB_RAND_FLOAT(rows * 0.28, rows * 0.72);
                paintBlob(wx, wy, MB_RAND_FLOAT(2.8, 4.8), MB_RAND_FLOAT(2.4, 3.8), T.water, 0.2);
            } else {
                const [f0, f1] = randomEdgePair(true);
                carveSpline(f0, f1, 1.35, T.water, { bend: MB_RAND_FLOAT(-0.3, 0.3) });
            }
            // Магический центр: Трон фей или Кристальный круг на случайной сухой поляне
            for (let tries = 0; tries < 25; tries++) {
                const tx = MB_RAND_FLOAT(4, cols - 4), ty = MB_RAND_FLOAT(4, rows - 4);
                if (isWater(Math.floor(tx), Math.floor(ty))) continue;
                addObj('furniture_feythrone', tx, ty, 1.22, MB_RAND_INT(0, 359), 1.8);
                const ringN = MB_RAND_INT(5, 8);
                for (let a = 0; a < ringN; a++) {
                    const ang = (a / ringN) * 6.28;
                    const cx = tx + Math.cos(ang) * 3.4, cy = ty + Math.sin(ang) * 2.8;
                    if (!isWater(Math.floor(cx), Math.floor(cy)) && canPlace(cx, cy, 1.1)) {
                        addObj(a % 2 === 0 ? P.feyCrystals : P.feyDecor, cx, cy, 1.0, MB_RAND_INT(0, 359), 1.05);
                    }
                }
                break;
            }
            scatterWaterDetails(0.22);
            scatterGroves([T.grass, T.leafG], P.feyTrees, P.feyFungi, P.feyDecor, 1.22);
            genTitle = MB_PICK(['Фейская роща', 'Светящийся лес', 'Тронный круг грибов', 'Зачарованное озеро']);
        }

        // ============================================================
        // 7. ⛺ ЛАГЕРЬ ОХОТНИКОВ / ОРКОВ (СЛУЧАЙНЫЕ ПОЛЯНЫ И ЧАСТОКОЛ)
        // ============================================================
        else if (picked === 'warcamp') {
            const fortified = Math.random() < 0.52;
            const cx = MB_RAND_FLOAT(cols * 0.36, cols * 0.64), cy = MB_RAND_FLOAT(rows * 0.36, rows * 0.64);
            const rx = Math.min(9.5, cols * MB_RAND_FLOAT(0.26, 0.34)), ry = Math.min(6.8, rows * MB_RAND_FLOAT(0.28, 0.35));
            paintBlob(cx, cy, rx, ry, T.dirt, 0.16);

            // Тропа, ведущая от лагеря к случайному краю карты
            const gateSide = MB_PICK(['N', 'S', 'E', 'W']);
            const gateEdge = randomEdgePoint(gateSide);
            const gateAng = Math.atan2(gateEdge.y - cy, gateEdge.x - cx);
            carveSpline({ x: cx, y: cy }, gateEdge, 1.15, T.dirt, { bend: MB_RAND_FLOAT(-0.18, 0.18) });

            if (fortified) {
                const ringN = Math.max(12, Math.floor((rx + ry) * 1.35));
                for (let i = 0; i < ringN; i++) {
                    const ang = (i / ringN) * 6.28;
                    const diff = Math.abs(Math.atan2(Math.sin(ang - gateAng), Math.cos(ang - gateAng)));
                    if (diff < 0.42) continue; // Ворота там, где выходит дорога!
                    const bx = cx + Math.cos(ang) * rx, by = cy + Math.sin(ang) * ry;
                    if (inB(Math.floor(bx), Math.floor(by))) addObj(P.barricades, bx, by, 1.08, ang * 180 / Math.PI + 90, 1.15);
                }
                addObj(P.watchpost, cx + Math.cos(gateAng + 0.45) * rx, cy + Math.sin(gateAng + 0.45) * ry, 1.05, 0, 1.8);
            }

            placeCampCluster(cx, cy, {
                radius: Math.min(rx, ry) * 0.72,
                tents: cols >= 28 ? MB_RAND_INT(4, 6) : MB_RAND_INT(3, 4),
                bigTentPool: fortified ? P.campBigTents : null,
                tentPool: P.orcTents,
                firePool: ['camp_campfire_hog', 'dungeon_campfire_cooking_spit'],
                fireScale: 1.25,
                propPool: P.orcProps,
                props: Math.max(4, Math.floor((rx * ry) / 8))
            });
            addObj('camp_totemlarge', cx - Math.cos(gateAng) * 2.2, cy - Math.sin(gateAng) * 2.2, 1.15, 0, 1.3);
            scatterGroves([T.grass], P.trees, P.bushes, P.rocks, 1.15);
            genTitle = fortified ? MB_PICK(['Укреплённый лагерь орков', 'Частокол налётчиков', 'Форт Охотников'])
                                 : MB_PICK(['Стойбище охотников', 'Лесной лагерь племени', 'Костёр на поляне']);
        }

        // ============================================================
        // 8. ❄️ СНЕЖНЫЙ ПЕРЕВАЛ (УЩЕЛЬЯ, ЛЕДЯНЫЕ ОЗЁРА И ПРИВАЛЫ)
        // ============================================================
        else if (picked === 'snow') {
            const isCanyon = Math.random() < 0.48;
            if (isCanyon) {
                // Органическое горное ущелье по произвольной кривой!
                for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) setT(c, r, T.wall);
                const [p0, p1] = randomEdgePair(true);
                const canyonW = Math.max(3.6, Math.min(cols, rows) * 0.28);
                carveSpline(p0, p1, canyonW, T.snow, { bend: MB_RAND_FLOAT(-0.25, 0.25) });
                const trailPts = carveSpline(p0, p1, 1.25, T.stone, { bend: MB_RAND_FLOAT(-0.25, 0.25) });
                const mid = trailPts[Math.floor(trailPts.length * MB_RAND_FLOAT(0.35, 0.65))];
                placeCampCluster(mid.x + mid.nx * 1.6, mid.y + mid.ny * 1.6, { radius: 2.6, tents: 2, propPool: P.snowPelts, props: 3 });
                if (Math.random() < 0.6) {
                    const bp = trailPts[Math.floor(trailPts.length * 0.72)];
                    addObj(P.barricades, bp.x, bp.y, 1.1, Math.atan2(bp.uy, bp.ux) * 180 / Math.PI + 90, 1.2);
                }
                genTitle = MB_PICK(['Снежное ущелье', 'Горный перевал', 'Заснеженная застава']);
            } else {
                // Замёрзшее озеро в случайном месте + горная тропа с мостом + лагерь экспедиции
                const lx = MB_RAND_FLOAT(cols * 0.30, cols * 0.70), ly = MB_RAND_FLOAT(rows * 0.30, rows * 0.70);
                const rx = MB_RAND_FLOAT(3.8, Math.min(7.5, cols * 0.26)), ry = MB_RAND_FLOAT(3.0, Math.min(5.5, rows * 0.30));
                paintBlob(lx, ly, rx, ry, T.ice, 0.18);
                paintBlob(lx, ly, rx * 0.54, ry * 0.54, T.water, 0.15);
                const [t0, t1] = randomEdgePair(true);
                const roadPts = carveSpline(t0, t1, 1.15, T.stone, { keepWater: true, bend: MB_RAND_FLOAT(-0.2, 0.2) });
                autoPlaceBridges(roadPts, false);
                for (let tries = 0; tries < 25; tries++) {
                    const cx = MB_RAND_FLOAT(4, cols - 4), cy = MB_RAND_FLOAT(4, rows - 4);
                    if (getT(Math.floor(cx), Math.floor(cy)) !== T.snow || !canPlace(cx, cy, 4.0)) continue;
                    placeCampCluster(cx, cy, { groundTile: T.dirt, radius: 2.8, tents: 2, bigTentPool: P.campBigTents, propPool: P.snowPelts, props: 3 });
                    break;
                }
                genTitle = MB_PICK(['Замёрзшее озеро', 'Привал в тундре', 'Ледяная переправа']);
            }
            scatterGroves([T.snow], P.trees, P.snowRocks, P.rockBig, 0.9);
        }

        const titleInp = document.getElementById('mb-map-title-inp');
        if (titleInp) titleInp.value = genTitle;

        window._mbData = data;
        SAVE_MB_DATA(data);
        RENDER_GM_MAP_BUILDER_UI();
    };
})();

// ================================================================
// 👑❄️ ЧАСТЬ 3: ЛОГИЧНЫЕ ПРОЦЕДУРНЫЕ ГОРОД И СНЕЖНЫЙ ПЕРЕВАЛ (V5)
// ================================================================
(function INSTALL_CITY_AND_SNOW_V5() {
    const _PREV_GEN = MB_GENERATE_RANDOM;
    const TARGETS = ['city', 'snow'];

    MB_GENERATE_RANDOM = function(biome) {
        const allBiomes = ['tavern', 'city', 'battlefield', 'forest', 'dungeon', 'mansion', 'dwarven', 'pirate', 'desert', 'fey', 'eastern', 'warcamp', 'snow'];
        const picked = (biome === 'random' || !biome) ? MB_PICK_NEXT_VARIANT('_global', allBiomes) : biome;
        if (!TARGETS.includes(picked)) return _PREV_GEN(picked);

        MB_PUSH_UNDO();
        const cols = window._mbCols, rows = window._mbRows;

        const T = {
            grass:     Math.random() < 0.25 ? MB_PICK_TILE_FAMILY('moss', 'grass') : MB_PICK_TILE_FAMILY('grass', 'grass'),
            dirt:      MB_PICK_TILE_FAMILY('dirt', 'dirt'),
            stone:     MB_PICK_TILE_FAMILY('stone', 'stone'),
            flagstone: MB_PICK_TILE_FAMILY('flagstone', 'stone'),
            cobble:    MB_PICK_TILE_FAMILY('cobble', 'stone'),
            wall:      MB_PICK_TILE_FAMILY('wall', 'wall'),
            snow:      MB_PICK_TILE_FAMILY('snow', 'snow'),
            ice:       MB_PICK_TILE_FAMILY('ice', 'snow'),
            water:     'water'
        };
        // Гарантируем, чтобы улицы и кварталы города отличались по текстуре
        if (T.flagstone === T.cobble) T.flagstone = T.stone;

        const lightMap = {
            city: ['day', 'day', 'sunset', 'night'],
            snow: ['day', 'day', 'night']
        };
        window._mbLighting = MB_PICK(lightMap[picked]);
        const data = CREATE_EMPTY_MB_DATA(picked === 'city' ? T.cobble : T.snow, cols, rows);
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

        const phaseA = MB_RAND_FLOAT(0, 6.28), phaseB = MB_RAND_FLOAT(0, 6.28);
        const paintBlob = (cx, cy, rx, ry, tile, wob = 0.16, onlyOn = null) => {
            const rMin = Math.max(0, Math.floor(cy - ry - 3)), rMax = Math.min(rows - 1, Math.ceil(cy + ry + 3));
            const cMin = Math.max(0, Math.floor(cx - rx - 3)), cMax = Math.min(cols - 1, Math.ceil(cx + rx + 3));
            for (let r = rMin; r <= rMax; r++) for (let c = cMin; c <= cMax; c++) {
                if (onlyOn && !onlyOn.includes(getT(c, r))) continue;
                const ang = Math.atan2(r - cy, c - cx);
                const noise = Math.sin(ang * 3 + phaseA) * wob + Math.cos(ang * 5 + phaseB) * (wob * 0.45);
                const d = Math.hypot((c - cx) / Math.max(0.6, rx), (r - cy) / Math.max(0.6, ry));
                if (d <= 1.0 + noise) setT(c, r, tile);
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

        const P = {
            roofTile:    MB_GET_POOL(/^city_roof_tiled_6x4_shaded$|^city_roof_premade_8x6$/),
            roofThatch:  MB_GET_POOL(/^city_roof_thatch_6x4_shaded$|^city_roof_thatch_6x4$/),
            cityCenter:  MB_GET_POOL(/^city_fountain$|^city_well$|^city_feature_statue_[1-3]_stone$|^city_statue[1-3]$/),
            carts:       MB_GET_POOL(/^city_cart_|^city_wagon$/),
            horses:      MB_GET_POOL(/^other_horse2?$/),
            lamps:       MB_GET_POOL(/^city_woodlamp$|^other_light_stand_lit_iron$/),
            market:      MB_GET_POOL(/^other_apples$|^other_baskets$|^other_clutter_sacks_[12]$|^furniture_storage_crate_[12]_dark$|^furniture_storage_barrel_[12]_dark$|^other_cabbage$/),
            gardens:     MB_GET_POOL(/^other_garden[123]$|^nature_flower[123]$/),
            tables:      MB_GET_POOL(/^furniture_table_(rectangle_[1-3]|long_1)_dark$|^furniture_table_long_1$/),
            barrels:     MB_GET_POOL(/^furniture_storage_barrel_[1-3]_dark$|^other_keg(5tapped|6)$/),
            crates:      MB_GET_POOL(/^furniture_storage_crate_[1-4]_dark$|^other_clutter_sacks_[12]$|^furniture_crate_[12]$/),
            watchpost:   MB_GET_POOL(/^other_watchpost$/),
            flags:       MB_GET_POOL(/^other_largeflag$/),
            boats:       MB_GET_POOL(/^other_canoe$/),
            stoneBridge: MB_GET_POOL(/^nature_stone_bridge_section_7x4$/),
            woodBridge:  MB_GET_POOL(/^nature_wooden_bridge_section_7x4$/),

            trees:       MB_GET_POOL(/^nature_tree_(small_[12]|large_[12]|[123])$/),
            bushes:      MB_GET_POOL(/^nature_bush_(2|3|4|5|7)_green|^nature_bush_shrub_[12]$/),
            flowers:     MB_GET_POOL(/^nature_flower_[1-4]$|^nature_flowers_[1-3]$/),

            // Строго природные зимние скалы и сухостой (без летних цветов и без новогодних игрушек!)
            cliffs:      MB_GET_POOL(/^nature_cliff_[123]$|^nature_rock_formation_[2-6]$|^nature_rock_outcrop$/),
            snowRocks:   MB_GET_POOL(/^nature_rock_[123]$|^nature_rock_small_[12]$|^nature_boulder$|^nature_rocks_[1-5]$/),
            deadwood:    MB_GET_POOL(/^other_deadwood3$|^nature_fallen_tree_[12]$|^nature_stump_[123]$|^nature_log_fallen_tree$/),
            waterRocks:  MB_GET_POOL(/^nature_submerged_rocks_[1-4]$|^nature_river_rock_[123]$/),
            campfires:   MB_GET_POOL(/^camp_campfire(_fire|_pot_cooking)?$/),
            bigTents:    MB_GET_POOL(/^camp_tent_round_large_pavillion$|^camp_tent_large_9x5$/),
            tents:       MB_GET_POOL(/^camp_tent_(round_small|square_[123]|narrow_[12])$|^other_shelter$/),
            pelts:       MB_GET_POOL(/^camp_(wolf|beaver)pelt$|^camp_pelt(wolf|fox)$|^furniture_bedroll_[123]$|^other_firewood_pile$|^nature_stump_axe_chopping$|^nature_log_seat_[12]$/),
            barricades:  MB_GET_POOL(/^furniture_barricade$|^other_woodenstakes$/),
            braziers:    MB_GET_POOL(/^dungeon_light_brazier_[123]_[abc]$|^other_light_stand_lit_iron$/),
            pillars:     MB_GET_POOL(/^dungeon_pillar_(round|square)_1x1$|^dungeon_stone_pillar_[12]$/),
            ruins:       MB_GET_POOL(/^other_ruin_[1-4]_2x2$|^other_rubble_(small|medium|mixed_3x2)$/),
            altars:      MB_GET_POOL(/^dungeon_feature_altar_gold$|^dungeon_tomb_(1|open)$/),
            chests:      MB_GET_POOL(/^dungeon_chest_[12]_(steel|gold)$/),
            iceCrystals: MB_GET_POOL(/^dungeon_crystalblue$|^dungeon_crystal_vertical_2x2$/)
        };

        let genTitle = 'Локация';

        // ============================================================
        // 👑 1. ГОРОД: СТРОГИЕ КВАРТАЛЫ, РО́ВНЫЕ УЛИЦЫ И УМНАЯ ЗАСТРОЙКА
        // ============================================================
        if (picked === 'city') {
            const style = MB_PICK_NEXT_VARIANT('city_v5', ['plaza_crossroads', 'canal_city', 'city_gates']);
            const thatchProb = Math.random() < 0.45 ? 0.30 : 0.08;

            // Карта занятости клеток под дома, улицы, площади, каналы и стены
            const occ = Array.from({ length: rows }, () => new Uint8Array(cols));
            const markOcc = (x1, y1, x2, y2, val = 1) => {
                for (let r = Math.max(0, Math.floor(y1)); r <= Math.min(rows - 1, Math.floor(y2)); r++)
                    for (let c = Math.max(0, Math.floor(x1)); c <= Math.min(cols - 1, Math.floor(x2)); c++) occ[r][c] = val;
            };
            const rectFreeForHouse = (x1, y1, w, h) => {
                if (x1 < 0 || y1 < 0 || x1 + w > cols || y1 + h > rows) return false;
                for (let r = y1; r < y1 + h; r++) for (let c = x1; c < x1 + w; c++) {
                    if (occ[r][c] !== 0 || getT(c, r) !== T.cobble) return false;
                }
                return true;
            };
            const touchesStreet = (x1, y1, w, h) => {
                let hTouch = false, vTouch = false;
                for (let c = x1; c < x1 + w; c++) {
                    if (getT(c, y1 - 1) === T.flagstone || getT(c, y1 + h) === T.flagstone) hTouch = true;
                }
                for (let r = y1; r < y1 + h; r++) {
                    if (getT(x1 - 1, r) === T.flagstone || getT(x1 + w, r) === T.flagstone) vTouch = true;
                }
                return { hTouch, vTouch };
            };

            const placeBridgeStraight = (x1, y1, x2, y2, isStone = true) => {
                const horiz = (Math.abs(x2 - x1) >= Math.abs(y2 - y1));
                const span = (horiz ? (x2 - x1 + 1) : (y2 - y1 + 1)) + 1.3;
                const segs = Math.max(1, Math.ceil(span / 3.4));
                const sc = Math.max(0.76, (span / segs) / 3.45);
                const pool = isStone ? P.stoneBridge : P.woodBridge;
                for (let i = 0; i < segs; i++) {
                    const f = (i + 0.5) / segs;
                    const bx = horiz ? (x1 - 0.15 + (x2 - x1 + 1.3) * f) : (x1 + 0.5);
                    const by = horiz ? (y1 + 0.5) : (y1 - 0.15 + (y2 - y1 + 1.3) * f);
                    addObj(pool, bx, by, sc, horiz ? 0 : 90, 1.35);
                }
            };

            const placeStreet = (isHoriz, pos, width = 2, start = 0, end = null) => {
                const lim = end !== null ? end : (isHoriz ? cols - 1 : rows - 1);
                if (isHoriz) {
                    fillRect(start, pos, lim, pos + width - 1, T.flagstone);
                    markOcc(start, pos, lim, pos + width - 1, 2);
                } else {
                    fillRect(pos, start, pos + width - 1, lim, T.flagstone);
                    markOcc(pos, start, pos + width - 1, lim, 2);
                }
            };

            // Умный упаковщик домов: выравнивает крыши по улицам, оставляет проулки и дворики!
            const packDistrictHouses = () => {
                const trySizes = cols <= 18
                    ? [{ w: 4, h: 3, sc: 0.84, horiz: true }, { w: 3, h: 4, sc: 0.84, horiz: false }]
                    : [
                        { w: 5, h: 3, sc: 0.98, horiz: true }, { w: 3, h: 5, sc: 0.98, horiz: false },
                        { w: 4, h: 3, sc: 0.84, horiz: true }, { w: 3, h: 4, sc: 0.84, horiz: false }
                    ];

                // Проходим по карте и сажаем дома с аккуратным зазором (1 клетка между домами)
                for (let r = 0; r < rows - 2; r++) {
                    for (let c = 0; c < cols - 2; c++) {
                        if (occ[r][c] !== 0 || getT(c, r) !== T.cobble) continue;

                        // Сначала смотрим, к какой улице ближе эта клетка, чтобы выбрать правильную ориентацию крыши
                        const preferVert = (getT(c - 1, r) === T.flagstone || getT(c + 3, r) === T.flagstone || getT(c + 4, r) === T.flagstone) &&
                                           !(getT(c, r - 1) === T.flagstone || getT(c, r + 3) === T.flagstone);
                        const ordered = trySizes.slice().sort((a, b) => (a.horiz === !preferVert ? -1 : 1));

                        let placed = false;
                        for (const sz of ordered) {
                            if (!rectFreeForHouse(c, r, sz.w, sz.h)) continue;
                            const touch = touchesStreet(c, r, sz.w, sz.h);
                            // Маленький шанс оставить на участке зелёный дворик с деревом и клумбой вместо дома
                            if (Math.random() < 0.14 && sz.w >= 4 && sz.h >= 3) {
                                fillRect(c, r, c + sz.w - 1, r + sz.h - 1, T.grass);
                                markOcc(c, r, c + sz.w - 1, r + sz.h - 1, 3);
                                const gx = c + sz.w / 2, gy = r + sz.h / 2;
                                addObj(P.trees, gx - 0.6, gy - 0.2, 0.95, MB_RAND_INT(0, 359), 1.1);
                                addObj(P.gardens, gx + 0.8, gy + 0.3, 0.82, MB_RAND_INT(0, 359), 0.6);
                                placed = true;
                                break;
                            }

                            const cx = c + sz.w / 2, cy = r + sz.h / 2;
                            const rot = sz.horiz ? MB_PICK([0, 180]) : MB_PICK([90, 270]);
                            const useThatch = Math.random() < thatchProb;
                            addObj(useThatch ? P.roofThatch : P.roofTile, cx, cy, sz.sc, rot, 0);
                            if (Math.random() < 0.78) {
                                addObj('other_misc_chimney_1x1', cx + (sz.horiz ? 0.8 : 0.2), cy - (sz.horiz ? 0.35 : 0.7), 0.82, 0, 0);
                            }
                            // Бронируем сам дом + узкий 1-клеточный переулок сбоку, чтобы крыши не слипались в кашу
                            markOcc(c, r, c + sz.w - 1, r + sz.h - 1, 1);
                            markOcc(c + sz.w, r, c + sz.w, r + sz.h - 1, 4);
                            markOcc(c, r + sz.h, c + sz.w - 1, r + sz.h, 4);

                            // Клумба или ящики у стены со стороны переулка (никогда посреди дороги!)
                            const decX = sz.horiz ? (c + sz.w + 0.5) : (c + 0.5);
                            const decY = sz.horiz ? (r + sz.h / 2) : (r + sz.h + 0.5);
                            if (inB(Math.floor(decX), Math.floor(decY)) && getT(Math.floor(decX), Math.floor(decY)) === T.cobble && canPlace(decX, decY, 0.8)) {
                                addObj(Math.random() < 0.55 ? P.market : P.gardens, decX, decY, 0.72, MB_RAND_INT(0, 359), 0.65);
                            }
                            // Если дом выходит к улице — ставим иногда уличный фонарь у угла
                            if ((touch.hTouch || touch.vTouch) && Math.random() < 0.35) {
                                const lx = c + (touch.vTouch ? -0.35 : 0.2), ly = r + (touch.hTouch ? -0.35 : 0.2);
                                if (inB(Math.floor(lx), Math.floor(ly)) && getT(Math.floor(lx), Math.floor(ly)) === T.flagstone && canPlace(lx, ly, 3.2)) {
                                    addObj(P.lamps, lx, ly, 0.82, 0, 0.7);
                                }
                            }
                            placed = true;
                            break;
                        }
                        if (placed) c += 2;
                    }
                }
            };

            // ВАРИАНТ 1: ТОРГОВАЯ ПЛОЩАДЬ И КВАРТАЛЫ
            if (style === 'plaza_crossroads') {
                genTitle = MB_PICK(['Торговая площадь', 'Ярмарочный квартал', 'Перекрёсток Купцов', 'Старый город']);
                const stW = cols >= 26 ? 3 : 2;
                const mx = MB_RAND_INT(Math.floor(cols * 0.38), Math.floor(cols * 0.60));
                const my = MB_RAND_INT(Math.floor(rows * 0.38), Math.floor(rows * 0.60));

                placeStreet(true, my - Math.floor(stW / 2), stW);
                placeStreet(false, mx - Math.floor(stW / 2), stW);

                // Дополнительный переулок на больших картах
                if (cols >= 32) {
                    const secX = mx > cols / 2 ? Math.max(4, mx - 11) : Math.min(cols - 6, mx + 11);
                    placeStreet(false, secX, 2);
                }

                // Прямоугольная мощёная площадь в центре перекрёстка
                const pRx = Math.min(5, Math.max(3, Math.floor(cols * 0.14)));
                const pRy = Math.min(4, Math.max(2, Math.floor(rows * 0.19)));
                const px1 = Math.max(2, mx - pRx), px2 = Math.min(cols - 3, mx + pRx);
                const py1 = Math.max(2, my - pRy), py2 = Math.min(rows - 3, my + pRy);
                fillRect(px1, py1, px2, py2, T.stone);
                markOcc(px1, py1, px2, py2, 2);

                const pcx = (px1 + px2 + 1) / 2, pcy = (py1 + py2 + 1) / 2;
                addObj(P.cityCenter, pcx, pcy, cols >= 26 ? 1.25 : 1.1, 0, 1.9);

                // Фонари по 4 углам площади
                [[px1 + 0.7, py1 + 0.7], [px2 + 0.3, py1 + 0.7], [px1 + 0.7, py2 + 0.3], [px2 + 0.3, py2 + 0.3]].forEach(([lx, ly]) => {
                    addObj(P.lamps, lx, ly, 0.85, 0, 0.7);
                });

                // Прилавки рынка ровно по углам площади (не перекрывая проезд по улицам!)
                const stallSpots = [
                    { x: px1 + 1.5, y: py1 + 1.4, rot: 0 }, { x: px2 - 0.5, y: py1 + 1.4, rot: 0 },
                    { x: px1 + 1.5, y: py2 - 0.4, rot: 0 }, { x: px2 - 0.5, y: py2 - 0.4, rot: 0 }
                ];
                stallSpots.forEach(s => {
                    if (Math.hypot(s.x - pcx, s.y - pcy) > 2.3 && canPlace(s.x, s.y, 1.2)) {
                        addObj(P.tables, s.x, s.y, 0.88, s.rot, 1.15);
                        addObj(P.market, s.x + (s.x < pcx ? -0.5 : 0.5), s.y + (s.y < pcy ? 0.55 : -0.55), 0.72, MB_RAND_INT(0, 359), 0);
                    }
                });

                // Повозка, едущая РОВНО вдоль горизонтальной улицы!
                const cartX = mx > cols / 2 ? Math.max(2.5, px1 - 2.6) : Math.min(cols - 2.5, px2 + 2.6);
                addObj(P.carts, cartX, my + 0.5, 0.96, mx > cols / 2 ? 0 : 180, 1.6);

                packDistrictHouses();
            }

            // ВАРИАНТ 2: РЕЧНОЙ КВАРТАЛ С КАНАЛОМ И НАБЕРЕЖНЫМИ
            else if (style === 'canal_city') {
                genTitle = MB_PICK(['Речной квартал', 'Набережная каналов', 'Мосты Старого города']);
                const horizCanal = (cols >= rows); // На широких картах канал горизонтальный, дома сверху и снизу
                const cW = (horizCanal ? rows : cols) >= 18 ? 3 : 2;
                const pos = horizCanal
                    ? MB_RAND_INT(Math.floor(rows * 0.38), Math.floor(rows * 0.56))
                    : MB_RAND_INT(Math.floor(cols * 0.38), Math.floor(cols * 0.56));

                // Каменная набережная + сам канал
                if (horizCanal) {
                    fillRect(0, pos - 1, cols - 1, pos + cW, T.flagstone);
                    fillRect(0, pos, cols - 1, pos + cW - 1, T.water);
                    markOcc(0, pos - 1, cols - 1, pos + cW, 2);

                    const bridges = cols >= 28
                        ? [Math.floor(cols * 0.24), Math.floor(cols * 0.52), Math.floor(cols * 0.78)]
                        : [Math.floor(cols * 0.32), Math.floor(cols * 0.68)];
                    bridges.forEach(bx => {
                        placeStreet(false, bx, 2, 0, pos - 1);
                        placeStreet(false, bx, 2, pos + cW, rows - 1);
                        placeBridgeStraight(bx + 0.5, pos, bx + 0.5, pos + cW - 1, true);
                        addObj(P.lamps, bx - 0.5, pos - 0.5, 0.85, 0, 0.7);
                        addObj(P.lamps, bx + 2.5, pos + cW + 0.5, 0.85, 0, 0.7);
                    });

                    // Лодки ровно вдоль канала + ящики на набережной
                    for (let x = 3; x <= cols - 4; x += 8) {
                        if (bridges.some(bx => Math.abs(bx + 1 - x) < 3.5)) continue;
                        addObj(P.boats, x, pos + cW / 2, 1.0, MB_PICK([0, 180]), 1.4);
                        if (canPlace(x, pos - 0.5, 0.9)) addObj(P.crates, x, pos - 0.5, 0.76, 0, 0.7);
                        if (canPlace(x + 1.2, pos + cW + 0.5, 0.9)) addObj(P.barrels, x + 1.2, pos + cW + 0.5, 0.76, 0, 0.7);
                    }
                } else {
                    fillRect(pos - 1, 0, pos + cW, rows - 1, T.flagstone);
                    fillRect(pos, 0, pos + cW - 1, rows - 1, T.water);
                    markOcc(pos - 1, 0, pos + cW, rows - 1, 2);

                    const bridges = [Math.floor(rows * 0.32), Math.floor(rows * 0.68)];
                    bridges.forEach(by => {
                        placeStreet(true, by, 2, 0, pos - 1);
                        placeStreet(true, by, 2, pos + cW, cols - 1);
                        placeBridgeStraight(pos, by + 0.5, pos + cW - 1, by + 0.5, true);
                        addObj(P.lamps, pos - 0.5, by - 0.5, 0.85, 0, 0.7);
                        addObj(P.lamps, pos + cW + 0.5, by + 2.5, 0.85, 0, 0.7);
                    });
                    addObj(P.boats, pos + cW / 2, rows / 2, 1.0, 90, 1.4);
                }

                packDistrictHouses();
            }

            // ВАРИАНТ 3: ГОРОДСКИЕ ВОРОТА И ПРИГОРОД
            else {
                genTitle = MB_PICK(['Городские ворота', 'Застава Столицы', 'Въезд в Притишье']);
                const cityRight = Math.random() < 0.5;
                const wallX = cityRight ? Math.floor(cols * MB_RAND_FLOAT(0.34, 0.42)) : Math.floor(cols * MB_RAND_FLOAT(0.56, 0.64));
                const gateY = MB_RAND_INT(Math.floor(rows * 0.35), Math.floor(rows * 0.65));

                // Пригород за стеной — зелёная трава + грунтовый тракт
                if (cityRight) {
                    fillRect(0, 0, wallX - 1, rows - 1, T.grass);
                    markOcc(0, 0, wallX + 1, rows - 1, 2);
                    fillRect(0, gateY - 1, wallX - 1, gateY + 1, T.dirt);
                    placeStreet(true, gateY - 1, 3, wallX, cols - 1);
                } else {
                    fillRect(wallX + 2, 0, cols - 1, rows - 1, T.grass);
                    markOcc(wallX, 0, cols - 1, rows - 1, 2);
                    fillRect(wallX + 2, gateY - 1, cols - 1, gateY + 1, T.dirt);
                    placeStreet(true, gateY - 1, 3, 0, wallX + 1);
                }

                // Внутренняя поперечная улица вдоль стены на расстоянии квартала
                const innerStX = cityRight ? Math.min(cols - 5, wallX + 7) : Math.max(3, wallX - 7);
                if (cols >= 24) placeStreet(false, innerStX, 2);

                // Ровная крепостная стена толщиной 2 клетки с широким проездом ворот
                for (let r = 0; r < rows; r++) {
                    if (Math.abs(r - gateY) > 1) {
                        setT(wallX, r, T.wall);
                        setT(wallX + 1, r, T.wall);
                    }
                }

                // Сторожевые башни, флаги и фонари точно у ворот
                const outSign = cityRight ? -1 : 1;
                addObj(P.watchpost, wallX + 1.0, Math.max(1.5, gateY - 3.0), 1.08, 0, 1.8);
                addObj(P.watchpost, wallX + 1.0, Math.min(rows - 1.5, gateY + 3.6), 1.08, 0, 1.8);
                addObj(P.flags, wallX + (cityRight ? -0.3 : 2.3), Math.max(1.2, gateY - 2.4), 1.0, 0, 0.7);
                addObj(P.flags, wallX + (cityRight ? -0.3 : 2.3), Math.min(rows - 1.2, gateY + 3.0), 1.0, 0, 0.7);
                addObj(P.lamps, wallX + (cityRight ? -0.6 : 2.6), gateY - 1.4, 0.85, 0, 0.6);
                addObj(P.lamps, wallX + (cityRight ? -0.6 : 2.6), gateY + 2.2, 0.85, 0, 0.6);

                // Подъезжающая к воротам повозка с лошадью
                const cartX = Math.max(2.2, Math.min(cols - 2.2, wallX + outSign * 4.2));
                const horseX = Math.max(1.2, Math.min(cols - 1.2, cartX - outSign * 2.0));
                addObj(P.carts, cartX, gateY + 0.5, 0.98, cityRight ? 0 : 180, 1.6);
                addObj(P.horses, horseX, gateY + 0.5, 0.92, cityRight ? 0 : 180, 1.0);

                // Небольшой колодец внутри города у ворот + плотная застройка городской половины
                const wellX = cityRight ? Math.min(cols - 3, wallX + 3.8) : Math.max(2.5, wallX - 2.8);
                const wellY = gateY > rows / 2 ? Math.max(2.5, gateY - 3.5) : Math.min(rows - 2.5, gateY + 3.8);
                if (getT(Math.floor(wellX), Math.floor(wellY)) === T.cobble) {
                    addObj('city_well', wellX, wellY, 1.05, 0, 1.5);
                    markOcc(wellX - 1, wellY - 1, wellX + 1, wellY + 1, 3);
                }

                packDistrictHouses();

                // Живой пригород снаружи стен (рощи деревьев и кустов, без прилипания к стене)
                for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
                    if (getT(c, r) !== T.grass) continue;
                    if (Math.abs(c - wallX) <= 2 || Math.abs(c - (wallX + 1)) <= 2) continue;
                    if (!canPlace(c + 0.5, r + 0.5, 1.75)) continue;
                    const rnd = Math.random();
                    if (rnd < 0.18) addObj(P.trees, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.9, 1.25), MB_RAND_INT(0, 359), 1.65);
                    else if (rnd < 0.28) addObj(P.bushes, c + 0.5, r + 0.5, 0.9, MB_RAND_INT(0, 359), 0.95);
                    else if (rnd < 0.33) addObj(P.flowers, c + 0.5, r + 0.5, 0.8, MB_RAND_INT(0, 359), 0.7);
                }
            }
        }

        // ============================================================
        // ❄️ 2. СНЕЖНЫЙ ПЕРЕВАЛ: ПРИРОДНЫЕ СКАЛЫ, ГЛАДКИЕ ТРОПЫ И ЛЁД
        // ============================================================
        else if (picked === 'snow') {
            const style = MB_PICK_NEXT_VARIANT('snow_v5', ['frozen_river_crossing', 'mountain_pass_outpost', 'frozen_lake_ruins']);

            const carveSnowSpline = (p0, p1, radius, tile, opts = {}) => {
                const bend = (opts.bend !== undefined ? opts.bend : MB_RAND_FLOAT(-0.24, 0.24));
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

                    const rr = Math.ceil(radius + 0.5);
                    for (let dr = -rr; dr <= rr; dr++) for (let dc = -rr; dc <= rr; dc++) {
                        const cx = Math.floor(x) + dc, cy = Math.floor(y) + dr;
                        if (!inB(cx, cy)) continue;
                        if (Math.hypot(cx + 0.5 - x, cy + 0.5 - y) <= radius) {
                            if (opts.keepWater && isWater(cx, cy)) continue;
                            if (opts.onlyOn && !opts.onlyOn.includes(getT(cx, cy))) continue;
                            setT(cx, cy, tile);
                        }
                    }
                }
                return pts;
            };

            const autoBridgeSnow = (roadPts, isStone = false) => {
                const pool = isStone ? P.stoneBridge : P.woodBridge;
                let inW = false, sIdx = 0;
                for (let i = 0; i < roadPts.length; i++) {
                    const pt = roadPts[i];
                    const wet = isWater(Math.floor(pt.x), Math.floor(pt.y));
                    if (wet && !inW) { inW = true; sIdx = i; }
                    else if ((!wet || i === roadPts.length - 1) && inW) {
                        inW = false;
                        const a = roadPts[sIdx], b = roadPts[wet ? i : i - 1];
                        const span = Math.hypot(b.x - a.x, b.y - a.y) + 1.9;
                        if (span < 1.5) continue;
                        const deg = Math.atan2(b.y - a.y, b.x - a.x) * 180 / Math.PI;
                        const segs = Math.max(1, Math.ceil(span / 3.4));
                        const sc = Math.max(0.76, (span / segs) / 3.45);
                        for (let s = 0; s < segs; s++) {
                            const f = (s + 0.5) / segs;
                            addObj(pool, a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f, sc, deg, 1.45);
                        }
                    }
                }
            };

            const placeWinterCamp = (cx, cy, bigTent = false) => {
                paintBlob(cx, cy, 2.7, 2.3, T.dirt, 0.16, [T.snow]);
                addObj(P.campfires, cx, cy, 1.15, 0, 1.5);
                const nTents = bigTent ? 2 : MB_RAND_INT(2, 3);
                const baseAng = MB_RAND_FLOAT(0, 6.28);
                for (let i = 0; i < nTents; i++) {
                    const ang = baseAng + (i / nTents) * 6.28 + MB_RAND_FLOAT(-0.25, 0.25);
                    const tx = cx + Math.cos(ang) * 2.55, ty = cy + Math.sin(ang) * 2.25;
                    if (!inB(Math.floor(tx), Math.floor(ty)) || isWater(Math.floor(tx), Math.floor(ty))) continue;
                    if (!canPlace(tx, ty, 1.8)) continue;
                    const useBig = (i === 0 && bigTent);
                    addObj(useBig ? P.bigTents : P.tents, tx, ty, useBig ? 0.85 : 1.0, (ang * 180 / Math.PI) + 90, 1.9);
                }
                for (let k = 0; k < 3; k++) {
                    const ang = MB_RAND_FLOAT(0, 6.28);
                    const px = cx + Math.cos(ang) * MB_RAND_FLOAT(1.4, 2.3);
                    const py = cy + Math.sin(ang) * MB_RAND_FLOAT(1.3, 2.1);
                    if (canPlace(px, py, 0.9) && !isWater(Math.floor(px), Math.floor(py))) {
                        addObj(P.pelts, px, py, 0.92, MB_RAND_INT(0, 359), 0.85);
                    }
                }
            };

            // ВАРИАНТ 1: ЛЕДЯНАЯ ПЕРЕПРАВА И ПРИВАЛ ЭКСПЕДИЦИИ
            if (style === 'frozen_river_crossing') {
                genTitle = MB_PICK(['Ледяная переправа', 'Замёрзшая река и привал', 'Мост на Северном тракте']);
                const verticalRiver = (cols >= rows);
                const bend = MB_RAND_FLOAT(-0.22, 0.22);
                const r0 = verticalRiver ? { x: cols * MB_RAND_FLOAT(0.38, 0.62), y: 0 } : { x: 0, y: rows * MB_RAND_FLOAT(0.38, 0.62) };
                const r1 = verticalRiver ? { x: cols * MB_RAND_FLOAT(0.38, 0.62), y: rows - 1 } : { x: cols - 1, y: rows * MB_RAND_FLOAT(0.38, 0.62) };

                // Широкий замёрзший берег (лёд) + узкая тёмная полынья (вода) по центру русла
                carveSnowSpline(r0, r1, cols >= 26 ? 2.6 : 2.1, T.ice, { bend });
                carveSnowSpline(r0, r1, cols >= 26 ? 1.35 : 1.05, T.water, { bend });

                // Плавная снежно-земляная дорога поперёк реки + автоматический мост!
                const t0 = verticalRiver ? { x: 0, y: rows * MB_RAND_FLOAT(0.30, 0.70) } : { x: cols * MB_RAND_FLOAT(0.30, 0.70), y: 0 };
                const t1 = verticalRiver ? { x: cols - 1, y: rows * MB_RAND_FLOAT(0.30, 0.70) } : { x: cols * MB_RAND_FLOAT(0.30, 0.70), y: rows - 1 };
                const roadPts = carveSnowSpline(t0, t1, 1.15, T.dirt, { keepWater: true, bend: MB_RAND_FLOAT(-0.18, 0.18) });
                autoBridgeSnow(roadPts, Math.random() < 0.45);

                // Повозка на подходе к мосту
                const cartPt = roadPts[Math.floor(roadPts.length * 0.20)];
                if (cartPt && !isWater(Math.floor(cartPt.x), Math.floor(cartPt.y))) {
                    addObj(P.carts, cartPt.x, cartPt.y, 0.96, Math.atan2(cartPt.uy, cartPt.ux) * 180 / Math.PI, 1.6);
                }

                // Тёплый лагерь экспедиции на сухом снежном берегу
                for (let tries = 0; tries < 30; tries++) {
                    const cx = MB_RAND_FLOAT(3.5, cols - 3.5), cy = MB_RAND_FLOAT(3.5, rows - 3.5);
                    if (getT(Math.floor(cx), Math.floor(cy)) !== T.snow || !canPlace(cx, cy, 4.2)) continue;
                    const dry = [-2, 0, 2].every(dy => [-2, 0, 2].every(dx => getT(Math.floor(cx) + dx, Math.floor(cy) + dy) === T.snow));
                    if (!dry) continue;
                    placeWinterCamp(cx, cy, cols >= 24);
                    break;
                }
            }

            // ВАРИАНТ 2: ГОРНЫЙ ПЕРЕВАЛ И ЗАСТАВА (НАСТОЯЩИЕ СКАЛЫ, НИКАКИХ КИРПИЧНЫХ СТЕН!)
            else if (style === 'mountain_pass_outpost') {
                genTitle = MB_PICK(['Горный перевал', 'Северная застава', 'Снежное ущелье']);
                const horizPass = (cols >= rows);
                const p0 = horizPass ? { x: 0, y: rows * MB_RAND_FLOAT(0.36, 0.64) } : { x: cols * MB_RAND_FLOAT(0.36, 0.64), y: 0 };
                const p1 = horizPass ? { x: cols - 1, y: rows * MB_RAND_FLOAT(0.36, 0.64) } : { x: cols * MB_RAND_FLOAT(0.36, 0.64), y: rows - 1 };

                // Прокладываем извилистый горный тракт через перевал
                const roadPts = carveSnowSpline(p0, p1, 1.25, T.dirt, { bend: MB_RAND_FLOAT(-0.22, 0.22) });

                // Природные скальные гребни по обе стороны перевала (из скал, утёсов и валунов!)
                const ridgeOffset = Math.max(3.8, Math.min(cols, rows) * 0.34);
                for (let i = 2; i < roadPts.length - 2; i += 4) {
                    const pt = roadPts[i];
                    for (const side of [-1, 1]) {
                        const rx = pt.x + pt.nx * side * (ridgeOffset + MB_RAND_FLOAT(-0.6, 1.4));
                        const ry = pt.y + pt.ny * side * (ridgeOffset + MB_RAND_FLOAT(-0.6, 1.4));
                        if (!inB(Math.floor(rx), Math.floor(ry)) || getT(Math.floor(rx), Math.floor(ry)) !== T.snow) continue;
                        if (canPlace(rx, ry, 1.7)) {
                            addObj(P.cliffs, rx, ry, MB_RAND_FLOAT(1.05, 1.45), MB_RAND_INT(0, 359), 1.85);
                        }
                    }
                }
                // Дополнительная каменная гряда вдоль самых краёв карты
                for (let c = 1; c < cols - 1; c += 3) {
                    if (horizPass) {
                        if (getT(c, 1) === T.snow && canPlace(c + 0.5, 1.2, 1.5)) addObj(P.cliffs, c + 0.5, 1.2, MB_RAND_FLOAT(0.95, 1.3), MB_RAND_INT(0, 359), 1.5);
                        if (getT(c, rows - 2) === T.snow && canPlace(c + 0.5, rows - 1.2, 1.5)) addObj(P.cliffs, c + 0.5, rows - 1.2, MB_RAND_FLOAT(0.95, 1.3), MB_RAND_INT(0, 359), 1.5);
                    }
                }

                // Пограничная застава в самом узком месте перевала
                const mid = roadPts[Math.floor(roadPts.length * MB_RAND_FLOAT(0.45, 0.58))];
                const roadDeg = Math.atan2(mid.uy, mid.ux) * 180 / Math.PI;
                addObj(P.watchpost, mid.x + mid.nx * 2.5, mid.y + mid.ny * 2.5, 1.08, 0, 1.8);
                addObj(P.flags, mid.x + mid.nx * 1.4, mid.y + mid.ny * 1.4, 1.0, 0, 0.7);
                addObj(P.barricades, mid.x + mid.ux * 2.2 - mid.nx * 0.9, mid.y + mid.uy * 2.2 - mid.ny * 0.9, 1.05, roadDeg + 90, 1.15);
                addObj(P.barricades, mid.x + mid.ux * 2.2 + mid.nx * 1.4, mid.y + mid.uy * 2.2 + mid.ny * 1.4, 1.05, roadDeg + 90, 1.15);
                addObj(P.braziers, mid.x + mid.ux * 1.1 + mid.nx * 1.6, mid.y + mid.uy * 1.1 + mid.ny * 1.6, 0.85, 0, 0.7);
                addObj(P.braziers, mid.x + mid.ux * 1.1 - mid.nx * 1.6, mid.y + mid.uy * 1.1 - mid.ny * 1.6, 0.85, 0, 0.7);

                // Тёплый лагерь гарнизона за заставой
                const campX = Math.max(3, Math.min(cols - 3, mid.x - mid.ux * 3.8 - mid.nx * 2.2));
                const campY = Math.max(3, Math.min(rows - 3, mid.y - mid.uy * 3.8 - mid.ny * 2.2));
                placeWinterCamp(campX, campY, false);
            }

            // ВАРИАНТ 3: ЗАМЁРЗШЕЕ ОЗЕРО И ЗАСНЕЖЕННЫЕ ДРЕВНИЕ РУИНЫ
            else {
                genTitle = MB_PICK(['Замёрзшее озеро и руины', 'Ледяное святилище', 'Полынья в тундре']);
                const lx = cols * MB_RAND_FLOAT(0.38, 0.62), ly = rows * MB_RAND_FLOAT(0.38, 0.62);
                const rx = Math.min(7.5, Math.max(3.6, cols * 0.25)), ry = Math.min(5.2, Math.max(2.8, rows * 0.29));
                paintBlob(lx, ly, rx, ry, T.ice, 0.18);
                // 1–2 тёмные полыньи внутри льда
                paintBlob(lx + MB_RAND_FLOAT(-1.2, 1.2), ly + MB_RAND_FLOAT(-0.8, 0.8), rx * 0.44, ry * 0.42, T.water, 0.16, [T.ice]);

                // Заснеженные руины на одном берегу
                const rSide = lx > cols / 2 ? -1 : 1;
                const rX = Math.max(4, Math.min(cols - 4, lx + rSide * (rx + 2.8)));
                const rY = Math.max(3.5, Math.min(rows - 3.5, ly + MB_RAND_FLOAT(-1.5, 1.5)));
                paintBlob(rX, rY, 2.8, 2.3, T.flagstone, 0.16, [T.snow]);
                addObj(P.altars, rX, rY, 1.15, MB_PICK([0, 90, 180, 270]), 1.4);
                if (canPlace(rX + 1.5, rY - 0.6, 0.8)) addObj(P.chests, rX + 1.5, rY - 0.6, 0.88, 20, 0.85);
                for (let i = 0; i < 5; i++) {
                    const ang = (i / 5) * 6.28 + 0.4;
                    const px = rX + Math.cos(ang) * 2.5, py = rY + Math.sin(ang) * 2.1;
                    if (inB(Math.floor(px), Math.floor(py)) && canPlace(px, py, 0.9)) {
                        addObj(i % 2 === 0 ? P.pillars : (Math.random() < 0.5 ? P.ruins : P.iceCrystals), px, py, 0.92, MB_RAND_INT(0, 359), 0.9);
                    }
                }
                addObj(P.braziers, rX - 1.6, rY + 1.2, 0.85, 0, 0.7);

                // Лагерь исследователей на противоположном берегу
                const cX = Math.max(3.5, Math.min(cols - 3.5, lx - rSide * (rx + 2.6)));
                const cY = Math.max(3.5, Math.min(rows - 3.5, ly > rows / 2 ? 3.5 : rows - 3.5));
                if (getT(Math.floor(cX), Math.floor(cY)) === T.snow) placeWinterCamp(cX, cY, false);
            }

            // Камни в ледяной воде
            for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
                if (isWater(c, r) && canPlace(c + 0.5, r + 0.5, 1.5) && Math.random() < 0.12) {
                    addObj(P.waterRocks, c + 0.5, r + 0.5, 0.88, MB_RAND_INT(0, 359), 0.9);
                }
            }

            // Редкие северные рощи: хвойные деревья, валуны и сухостой строго на снегу
            const groves = Math.max(4, Math.floor((cols * rows) / 56));
            for (let g = 0; g < groves; g++) {
                const gx = MB_RAND_FLOAT(1.5, cols - 1.5), gy = MB_RAND_FLOAT(1.5, rows - 1.5);
                if (getT(Math.floor(gx), Math.floor(gy)) !== T.snow) continue;
                for (let k = 0; k < MB_RAND_INT(3, 5); k++) {
                    const ox = gx + MB_RAND_FLOAT(-2.5, 2.5), oy = gy + MB_RAND_FLOAT(-2.2, 2.2);
                    if (getT(Math.floor(ox), Math.floor(oy)) !== T.snow || !canPlace(ox, oy, 1.55)) continue;
                    if (k < 2) addObj(P.trees, ox, oy, MB_RAND_FLOAT(0.85, 1.22), MB_RAND_INT(0, 359), 1.65);
                    else if (k < 4) addObj(P.snowRocks, ox, oy, MB_RAND_FLOAT(0.82, 1.18), MB_RAND_INT(0, 359), 1.05);
                    else addObj(P.deadwood, ox, oy, 0.88, MB_RAND_INT(0, 359), 1.0);
                }
            }
        }

        const titleInp = document.getElementById('mb-map-title-inp');
        if (titleInp) titleInp.value = genTitle;

        window._mbData = data;
        SAVE_MB_DATA(data);
        RENDER_GM_MAP_BUILDER_UI();
    };
})();