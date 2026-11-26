// ================================================================
// 🏛️ ПРОЦЕДУРНЫЙ ГЕНЕРАТОР ИНТЕРЬЕРОВ V6 (БЕЗ ШАБЛОНОВ, ЧИСТАЯ ТОПОЛОГИЯ + ЛОГИКА)
// Покрывает: Таверна, Особняк, Подземелье, Кузница дварфов, Восточный храм
// ================================================================
(function INSTALL_TRUE_PROCEDURAL_INTERIORS_V6() {
    const _PREV_GEN = MB_GENERATE_RANDOM;
    const TARGETS = ['tavern', 'mansion', 'dungeon', 'dwarven', 'eastern'];

    MB_GENERATE_RANDOM = function(biome) {
        const allBiomes = ['tavern', 'city', 'battlefield', 'forest', 'dungeon', 'mansion', 'dwarven', 'pirate', 'desert', 'fey', 'eastern', 'warcamp', 'snow'];
        const picked = (biome === 'random' || !biome) ? MB_PICK_NEXT_VARIANT('_global', allBiomes) : biome;
        if (!TARGETS.includes(picked)) return _PREV_GEN(picked);

        MB_PUSH_UNDO();
        const cols = window._mbCols, rows = window._mbRows;

        // Единая гармоничная палитра на всю карту (без «винегрета» из разных полов)
        const T = {
            grass:     Math.random() < 0.25 ? MB_PICK_TILE_FAMILY('moss', 'grass') : MB_PICK_TILE_FAMILY('grass', 'grass'),
            dirt:      MB_PICK_TILE_FAMILY('dirt', 'dirt'),
            stone:     MB_PICK_TILE_FAMILY('stone', 'stone'),
            flagstone: MB_PICK_TILE_FAMILY('flagstone', 'stone'),
            cobble:    MB_PICK_TILE_FAMILY('cobble', 'flagstone'),
            wood:      MB_PICK_TILE_FAMILY('wood', 'wood'),
            wall:      MB_PICK_TILE_FAMILY('wall', 'wall'),
            lava:      MB_PICK_TILE_FAMILY('lava', 'lava'),
            water:     'water',
            sand:      'sand',
            abyss:     'abyss',
            leafR:     'leaves_red',
            leafG:     'leaves_green'
        };

        const isUnderground = (picked === 'dungeon' || picked === 'dwarven');
        const isUrbanTavern = (picked === 'tavern' && Math.random() < 0.32);
        const outdoorBase = isUnderground ? T.wall : (isUrbanTavern ? T.cobble : T.grass);

        const lightPools = {
            tavern:  ['tavern', 'tavern', 'sunset', 'night'],
            mansion: ['tavern', 'day', 'sunset'],
            dungeon: ['dungeon', 'night'],
            dwarven: ['dungeon', 'tavern'],
            eastern: ['day', 'sunset', 'sunset', 'night']
        };
        window._mbLighting = MB_PICK(lightPools[picked] || ['day']);

        const data = CREATE_EMPTY_MB_DATA(outdoorBase, cols, rows);
        data.lighting = window._mbLighting;

        const inB = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows;
        const getT = (c, r) => inB(c, r) ? data.cells[r * cols + c].t : null;
        const setT = (c, r, t) => { if (inB(c, r)) data.cells[r * cols + c].t = t; };
        const isWall = (c, r) => /^wall/.test(getT(c, r) || '');
        const isWater = (c, r) => /^water/.test(getT(c, r) || '');
        const isHazard = (c, r) => /^(water|lava|abyss)/.test(getT(c, r) || '');

        const fillRect = (x1, y1, x2, y2, t, onlyOn = null) => {
            for (let r = Math.max(0, Math.floor(y1)); r <= Math.min(rows - 1, Math.floor(y2)); r++)
                for (let c = Math.max(0, Math.floor(x1)); c <= Math.min(cols - 1, Math.floor(x2)); c++) {
                    if (onlyOn && !onlyOn.includes(getT(c, r))) continue;
                    setT(c, r, t);
                }
        };

        const phaseA = MB_RAND_FLOAT(0, 6.28), phaseB = MB_RAND_FLOAT(0, 6.28);
        const paintBlob = (cx, cy, rx, ry, t, wob = 0.16, onlyOn = null) => {
            for (let r = Math.max(0, Math.floor(cy - ry - 2)); r <= Math.min(rows - 1, Math.ceil(cy + ry + 2)); r++)
                for (let c = Math.max(0, Math.floor(cx - rx - 2)); c <= Math.min(cols - 1, Math.ceil(cx + rx + 2)); c++) {
                    if (onlyOn && !onlyOn.includes(getT(c, r))) continue;
                    const ang = Math.atan2(r - cy, c - cx);
                    const d = Math.hypot((c - cx) / Math.max(0.6, rx), (r - cy) / Math.max(0.6, ry));
                    if (d <= 1.0 + Math.sin(ang * 3 + phaseA) * wob + Math.cos(ang * 5 + phaseB) * (wob * 0.4)) setT(c, r, t);
                }
        };

        const placedZones = [];
        const doorSpots = [];
        const canPlace = (x, y, minDist = 0.95, checkDoors = true, allowWall = false) => {
            const gx = Math.floor(x), gy = Math.floor(y);
            if (!inB(gx, gy)) return false;
            if (!allowWall && (isWall(gx, gy) || isHazard(gx, gy))) return false;
            if (checkDoors && doorSpots.some(d => Math.hypot(d.x - x, d.y - y) < Math.max(1.35, minDist))) return false;
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

        // --- ЧИСТЫЕ ТЕМАТИЧЕСКИЕ ПУЛЫ СПРАЙТОВ ---
        const P = {
            trees:       MB_GET_POOL(/^nature_tree_(large|small|big|bigger|[123])$|^nature_tree_(large|small)_[12]$/),
            bushes:      MB_GET_POOL(/^nature_bush_(2|3|4|5|6|7|8)_green|^nature_bush_shrub_|^nature_bush_[12]$|^other_fern_/),
            redBushes:   MB_GET_POOL(/^nature_bush_1_red$|^nature_bush_9_yellow$/),
            flowers:     MB_GET_POOL(/^nature_flower_[1-7]|^nature_flowers_[1-6]|^other_clovers_/),
            rocks:       MB_GET_POOL(/^nature_mossy_boulder_|^nature_rock(_small)?_[123]$|^nature_rocks_[1-5]$/),
            zenRocks:    MB_GET_POOL(/^other_stone_[123]$|^nature_rocks_[1-4]$|^nature_rock_small_[12]$/),
            waterDec:    MB_GET_POOL(/^other_lily_pad|^nature_submerged_rocks_|^nature_river_rock_/),
            woodBridge:  MB_GET_POOL(/^nature_wooden_bridge_section_7x4$/),
            stoneBridge: MB_GET_POOL(/^nature_stone_bridge_section_7x4$/),

            doors:       MB_GET_POOL(/^dungeon_door_narrow_1x2$|^dungeon_door_[12]_base_2$/),
            doubleDoors: MB_GET_POOL(/^dungeon_door_wide_3x2$|^dungeon_double_door_[12]_base_2$/),
            windows:     MB_GET_POOL(/^other_window_(wide|narrow)_1x2$/),
            woodStairs:  MB_GET_POOL(/^other_stairs_wood_(up|down)$/),
            stoneStairs: MB_GET_POOL(/^other_stairs_stone_(up|down)$|^other_stairs_[12]_base_2$/),

            barStraight: MB_GET_POOL(/^furniture_table_modular_straight_dark$/),
            tavTables:   MB_GET_POOL(/^furniture_table_(round|rectangle)_[1-4]_dark$|^furniture_tableround(large|small)2$/),
            tavLongTbl:  MB_GET_POOL(/^furniture_table_long_1$|^furniture_tabledinning2$|^furniture_table_rectangle_[23]_dark$/),
            tavChairs:   MB_GET_POOL(/^furniture_chair_(simple_[1-5]|bench_[12])_dark$|^furniture_bench3$|^furniture_chair3$/),
            tavStools:   MB_GET_POOL(/^furniture_chair_stool_[12]_dark$|^furniture_chair_stool_cushioned_1$/),
            rugs:        MB_GET_POOL(/^furniture_rug_(6_[a-g]|bear_1|animal_skin)$/),
            beds:        MB_GET_POOL(/^furniture_bed_pattern_1_[a-f]$|^furniture_bedframed(single|double)2$/),
            barrels:     MB_GET_POOL(/^furniture_storage_barrel_[1-5](_a)?_dark$|^other_keg(5tapped|6)$/),
            crates:      MB_GET_POOL(/^furniture_storage_crate_[1-4]_dark$|^other_clutter_sacks_[12]$|^furniture_crate_[12]$/),
            shelves:     MB_GET_POOL(/^furniture_storage_(bookshelf_[1-3]|shelf_[12])|^other_storage_dresser_[12]_dark$|^other_cupboard2$/),
            food:        MB_GET_POOL(/^other_clutter_tankards_full$|^furniture_clutter_food_[12]$|^other_clutter_playing_cards$|^other_pie$|^other_hamroast$|^other_chicken$|^other_ribs$/),
            kitchenProp: MB_GET_POOL(/^other_stewpot$|^other_cooking_cauldron_empty$|^other_cabbage$|^other_apples$|^other_clutter_sacks_[12]$/),
            candles:     MB_GET_POOL(/^other_light_candle_(small|cluster)_lit$|^other_light_lantern_lit$|^other_candles2?$/),
            fireplaces:  MB_GET_POOL(/^other_cooking_oven_fireplace_3$|^other_cooking_stove$|^other_cooking_oven_[12]$/),
            chandeliers: MB_GET_POOL(/^other_light_chandelier_[1-4]_lit_|^other_light_chandelier_antler_lit$/),

            carts:       MB_GET_POOL(/^city_cart_|^city_wagon$/),
            horses:      MB_GET_POOL(/^other_horse2?$/),
            lamps:       MB_GET_POOL(/^city_woodlamp$|^other_light_stand_lit_iron$/),
            campfires:   MB_GET_POOL(/^camp_campfire(_fire|_pot_cooking)?$/),
            firewood:    MB_GET_POOL(/^other_firewood_pile$|^nature_stump_axe_chopping$/),
            fountains:   MB_GET_POOL(/^city_fountain$|^city_feature_statue_[1-3]_stone$/),

            manSofas:    MB_GET_POOL(/^furniture_chair_(sofa_1_[abc]|armchair_1_[a-d])$/),
            manLuxury:   MB_GET_POOL(/^furniture_feature_(piano_1_a|billiards_table)$|^other_feature_(orrery_small_gold|armillary_sphere_brass|telescope_medium_gold|suit_of_armor_1_silver|suit_of_armor_2_gold|globe)$/),
            manBooks:    MB_GET_POOL(/^furniture_storage_bookshelf_|^furniture_table_writing_desk_dark$|^furniture_clutter_book_pile_[1-4]_a$/),
            manBath:     MB_GET_POOL(/^other_feature_bath_tub_(oval|large)_full_dark$/),
            manCats:     MB_GET_POOL(/^other_cat_(1_a|3_b|6_c)$/),

            braziers:    MB_GET_POOL(/^dungeon_light_brazier_|^other_light_stand_lit_iron$/),
            chests:      MB_GET_POOL(/^dungeon_chest_[12]_(steel|gold)$|^dungeon_chest2$|^furniture_chest_lockbox_1_iron$/),
            bones:       MB_GET_POOL(/^dungeon_bones_(adventurer|human_skull|misc)|^dungeon_bonepile$|^dungeon_clutter_skull_human$/),
            webs:        MB_GET_POOL(/^dungeon_clutter_webs_(1|2|3|4|5|6)_full$/),
            pillars:     MB_GET_POOL(/^dungeon_pillar_(round|square)_1x1$|^dungeon_stone_pillar_[12]$|^dungeon_pillar_base_2$/),
            altars:      MB_GET_POOL(/^dungeon_feature_altar_gold$|^dungeon_tomb_(1|open)$/),
            cages:       MB_GET_POOL(/^dungeon_feature_metal_cage_gold$/),
            rubble:      MB_GET_POOL(/^other_rubble_(small|medium|mixed_3x2)|^dungeon_blood_[1-5]$|^other_ruin_[1-4]_2x2$/),
            crystals:    MB_GET_POOL(/^dungeon_crystal(blue|red)$|^dungeon_crystal_(horizontal|vertical)_/),

            dwForge:     MB_GET_POOL(/^dungeon_forge$|^dungeon_melting_pot(_pouring)?$/),
            dwAnvil:     MB_GET_POOL(/^dungeon_forge_anvil$|^dungeon_anvil$|^dungeon_clutter_anvil_1$/),
            dwLoot:      MB_GET_POOL(/^dungeon_(gold|iron|bronze)_ingot$|^furniture_casting_table_axes$|^dungeon_axe_[12]$|^dungeon_hammer_1$|^dungeon_small_keg$|^other_clutter_grindstone_dark$/),
            dwStatues:   MB_GET_POOL(/^city_large_statue$|^dungeon_pillar$/),

            // 100% восточные спрайты
            eastDoors:   MB_GET_POOL(/^dungeon_door_shoji_[12]$|^furniture_door_tatami$/),
            eastTatamiB: MB_GET_POOL(/^furniture_tatami_mat_large$/),
            eastTatamiS: MB_GET_POOL(/^furniture_tatami_mat_(small|round_[12])$/),
            eastShrines: MB_GET_POOL(/^other_shrine_[12]$/),
            eastScreens: MB_GET_POOL(/^other_paper_screen_[12]$/),
            eastLights:  MB_GET_POOL(/^city_paper_lamp$|^city_paperlamp2?$|^other_paper_lantern_[123]$/),
            eastTables:  MB_GET_POOL(/^furniture_table_(kotatsu|game|[1-4])$/),
            eastCushion: MB_GET_POOL(/^other_cushion_[1-4]$|^other_seat_[12]$/),
            eastFuton:   MB_GET_POOL(/^furniture_futon_bed$|^other_futon_matress$/),
            eastHearth:  MB_GET_POOL(/^dungeon_cooking_pit_(small_[123]|medium)$/),
            eastKettle:  MB_GET_POOL(/^other_kettle_[12]$/),
            eastBonsai:  MB_GET_POOL(/^other_bonsai_[123]$/),
            eastArmor:   MB_GET_POOL(/^other_samurai_armor_([123]|rack)$/),
            eastWeapons: MB_GET_POOL(/^camp_weapons_(katanas|daisho|sword_rack)$/),
            eastDrums:   MB_GET_POOL(/^other_taiko_drum(_big)?$/),
            eastShelves: MB_GET_POOL(/^other_shelves_[1-6]$/),
            eastVases:   MB_GET_POOL(/^other_vase_(large|medium|small)$/),
            eastKimono:  MB_GET_POOL(/^other_kimono_clothing_[123]$/),
            eastProps:   MB_GET_POOL(/^other_shamisen_instrument$|^other_scroll$|^other_hand_fan_[12]$/),
            eastSlipper: MB_GET_POOL(/^other_slippers_[12]$/),
            eastParasol: MB_GET_POOL(/^other_parasol_open$/)
        };

        // ============================================================
        // 🧩 УНИВЕРСАЛЬНЫЕ ПРИМИТИВЫ: МОСТЫ, КРИВЫЕ, ДВЕРИ, ДОРОЖКИ
        // ============================================================
        const placeBridgeSpan = (x1, y1, x2, y2, isStone = false) => {
            const dx = x2 - x1, dy = y2 - y1;
            const span = Math.hypot(dx, dy) + 1.85;
            if (span < 1.5) return;
            const deg = Math.atan2(dy, dx) * 180 / Math.PI;
            const pool = isStone ? P.stoneBridge : P.woodBridge;
            const segs = Math.max(1, Math.ceil(span / 3.35));
            const sc = Math.max(0.76, (span / segs) / 3.4);
            for (let i = 0; i < segs; i++) {
                const f = (i + 0.5) / segs;
                addObj(pool, x1 + dx * f, y1 + dy * f, sc, deg, 1.35);
            }
        };

        const carveSpline = (p0, p1, radius, tile, opts = {}) => {
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
                pts.push({ x, y });
                const rr = Math.ceil(radius + 0.5);
                for (let dr = -rr; dr <= rr; dr++) for (let dc = -rr; dc <= rr; dc++) {
                    const cx = Math.floor(x) + dc, cy = Math.floor(y) + dr;
                    if (!inB(cx, cy)) continue;
                    if (Math.hypot(cx + 0.5 - x, cy + 0.5 - y) <= radius) {
                        if (opts.onlyOn && !opts.onlyOn.includes(getT(cx, cy))) continue;
                        if (opts.avoidWall && isWall(cx, cy)) continue;
                        setT(cx, cy, tile);
                    }
                }
            }
            return pts;
        };

        // Прокладывает дорожку от (x1, y1) к (x2, y2), автоматически ставя мосты на любой воде!
        const layPathWithBridges = (x1, y1, x2, y2, pathTile, isStoneBridge = false, width = 1) => {
            const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
            if (steps < 1) return;
            let inH = false, hs = null, he = null;
            for (let i = 0; i <= steps; i++) {
                const c = Math.round(x1 + ((x2 - x1) * i) / steps);
                const r = Math.round(y1 + ((y2 - y1) * i) / steps);
                if (!inB(c, r) || isWall(c, r)) continue;
                if (isHazard(c, r)) {
                    if (!inH) { inH = true; hs = { x: c + 0.5, y: r + 0.5 }; }
                    he = { x: c + 0.5, y: r + 0.5 };
                } else {
                    if (inH && hs && he) { placeBridgeSpan(hs.x, hs.y, he.x, he.y, isStoneBridge); inH = false; }
                    if (getT(c, r) === T.grass || getT(c, r) === T.leafR || getT(c, r) === T.sand) {
                        setT(c, r, pathTile);
                        if (width >= 2 && inB(c + 1, r) && getT(c + 1, r) === T.grass) setT(c + 1, r, pathTile);
                    }
                }
            }
            if (inH && hs && he) placeBridgeSpan(hs.x, hs.y, he.x, he.y, isStoneBridge);
        };

        const placeDoor = (c, r, floorT, vert, pool = P.doors, extraEastIn = null) => {
            setT(c, r, floorT);
            doorSpots.push({ x: c + 0.5, y: r + 0.5 });
            addObj(pool, c + 0.5, r + 0.5, 0.94, vert ? 90 : 0, 0.85);
            if (extraEastIn && (extraEastIn.dx || extraEastIn.dy)) {
                if (Math.random() < 0.7) addObj(P.eastSlipper, c + 0.5 + extraEastIn.dx * 0.95, r + 0.5 + extraEastIn.dy * 0.95, 0.78, vert ? 90 : 0, 0);
                const oc = c - extraEastIn.dx, or = r - extraEastIn.dy;
                if (inB(oc, or) && !isWall(oc, or) && !isHazard(oc, or)) {
                    const px = vert ? 0 : 1.15, py = vert ? 1.15 : 0;
                    if (canPlace(oc + 0.5 - px, or + 0.5 - py, 0.55, false)) addObj(P.eastLights, oc + 0.5 - px, or + 0.5 - py, 0.84, 0, 0.55);
                    if (canPlace(oc + 0.5 + px, or + 0.5 + py, 0.55, false)) addObj(P.eastLights, oc + 0.5 + px, or + 0.5 + py, 0.84, 0, 0.55);
                }
            }
        };

        // ============================================================
        // 🧩 3 АЛГОРИТМА ПРОЦЕДУРНОЙ ТОПОЛОГИИ (БЕЗ ШАБЛОНОВ!)
        // ============================================================
        const makeRoomObj = (id, x1, y1, x2, y2, floor, role = '') => ({
            id, x1, y1, x2, y2,
            iw: x2 - x1 - 1, ih: y2 - y1 - 1,
            cx: (x1 + x2 + 1) / 2, cy: (y1 + y2 + 1) / 2,
            dist: 0, floor, role, isCourtyard: false
        });

        // АЛГОРИТМ 1: Органический рост графа комнат (каждый раз уникальная форма крыльев)
        function buildRoomGraph(cfg) {
            const rooms = [];
            const edges = [];
            const { mX, mY } = cfg;
            const sw = Math.min(cols - mX * 2, MB_RAND_INT(cfg.seedW[0], cfg.seedW[1]));
            const sh = Math.min(rows - mY * 2, MB_RAND_INT(cfg.seedH[0], cfg.seedH[1]));
            const sx1 = MB_RAND_INT(mX, Math.max(mX, cols - mX - sw));
            const sy1 = MB_RAND_INT(mY, Math.max(mY, rows - mY - sh));
            rooms.push(makeRoomObj(0, sx1, sy1, sx1 + sw - 1, sy1 + sh - 1, cfg.defaultFloor, cfg.seedRole));

            const areaValid = (x1, y1, x2, y2) => {
                if (x1 < mX || y1 < mY || x2 > cols - 1 - mX || y2 > rows - 1 - mY) return false;
                if (rooms.some(r => x1 < r.x2 && x2 > r.x1 && y1 < r.y2 && y2 > r.y1)) return false;
                if (cfg.avoidWater) {
                    for (let r = y1; r <= y2; r++) for (let c = x1; c <= x2; c++) if (isWater(c, r)) return false;
                }
                return true;
            };

            const sprawl = Math.random(); // Непрерывный коэффициент вытянутости 0..1
            for (let att = 0; att < 320 && rooms.length < cfg.targetRooms; att++) {
                const parent = (Math.random() < sprawl) ? rooms[rooms.length - 1] : MB_PICK(rooms);
                const dir = MB_PICK(['N', 'S', 'E', 'W']);
                const nw = MB_RAND_INT(cfg.roomW[0], cfg.roomW[1]);
                const nh = MB_RAND_INT(cfg.roomH[0], cfg.roomH[1]);
                let nx1, ny1, nx2, ny2;
                if (dir === 'E') {
                    nx1 = parent.x2; nx2 = nx1 + nw - 1;
                    const lo = Math.max(mY, parent.y1 - nh + 3), hi = Math.min(rows - mY - nh, parent.y2 - 2);
                    if (lo > hi) continue;
                    ny1 = MB_RAND_INT(lo, hi); ny2 = ny1 + nh - 1;
                } else if (dir === 'W') {
                    nx2 = parent.x1; nx1 = nx2 - nw + 1;
                    const lo = Math.max(mY, parent.y1 - nh + 3), hi = Math.min(rows - mY - nh, parent.y2 - 2);
                    if (lo > hi) continue;
                    ny1 = MB_RAND_INT(lo, hi); ny2 = ny1 + nh - 1;
                } else if (dir === 'S') {
                    ny1 = parent.y2; ny2 = ny1 + nh - 1;
                    const lo = Math.max(mX, parent.x1 - nw + 3), hi = Math.min(cols - mX - nw, parent.x2 - 2);
                    if (lo > hi) continue;
                    nx1 = MB_RAND_INT(lo, hi); nx2 = nx1 + nw - 1;
                } else {
                    ny2 = parent.y1; ny1 = ny2 - nh + 1;
                    const lo = Math.max(mX, parent.x1 - nw + 3), hi = Math.min(cols - mX - nw, parent.x2 - 2);
                    if (lo > hi) continue;
                    nx1 = MB_RAND_INT(lo, hi); nx2 = nx1 + nw - 1;
                }
                if (!areaValid(nx1, ny1, nx2, ny2)) continue;
                const child = makeRoomObj(rooms.length, nx1, ny1, nx2, ny2, cfg.defaultFloor, '');
                child.dist = parent.dist + 1;
                rooms.push(child);
                edges.push({ a: parent, b: child });
            }
            addRandomLoops(rooms, edges, 0.35);
            return { rooms, edges };
        }

        // АЛГОРИТМ 2: Рекурсивное BSP-деление контура (с возможным открытым внутренним двором!)
        function buildBSPBuilding(cfg) {
            const { mX, mY } = cfg;
            const maxW = cols - mX * 2, maxH = rows - mY * 2;
            const bw = Math.max(9, Math.min(maxW, Math.floor(maxW * MB_RAND_FLOAT(0.68, 0.96))));
            const bh = Math.max(7, Math.min(maxH, Math.floor(maxH * MB_RAND_FLOAT(0.68, 0.96))));
            const bx1 = MB_RAND_INT(mX, Math.max(mX, cols - mX - bw));
            const by1 = MB_RAND_INT(mY, Math.max(mY, rows - mY - bh));
            const bx2 = bx1 + bw - 1, by2 = by1 + bh - 1;

            const leaves = [];
            const split = (x1, y1, x2, y2, depth) => {
                const w = x2 - x1 + 1, h = y2 - y1 + 1;
                const canV = w >= 9, canH = h >= 9;
                const stopProb = depth >= 2 ? 0.25 : 0;
                if ((!canV && !canH) || depth >= 4 || (leaves.length >= cfg.targetRooms - 1) || (Math.random() < stopProb && w <= 11 && h <= 10)) {
                    leaves.push({ x1, y1, x2, y2 });
                    return;
                }
                let doV = canV && (!canH || (w > h * 1.15 ? true : (h > w * 1.15 ? false : Math.random() < 0.5)));
                if (doV) {
                    const sx = MB_RAND_INT(x1 + 4, x2 - 4);
                    split(x1, y1, sx, y2, depth + 1);
                    split(sx, y1, x2, y2, depth + 1);
                } else {
                    const sy = MB_RAND_INT(y1 + 4, y2 - 4);
                    split(x1, y1, x2, sy, depth + 1);
                    split(x1, sy, x2, y2, depth + 1);
                }
            };
            split(bx1, by1, bx2, by2, 0);

            // Иногда вырезаем 1 угловую комнату, чтобы здание было Г-образным или ступенчатым, а не просто коробкой!
            if (leaves.length >= 5 && Math.random() < 0.55) {
                const cornerLeaves = leaves.filter(l => (l.x1 === bx1 || l.x2 === bx2) && (l.y1 === by1 || l.y2 === by2));
                if (cornerLeaves.length) {
                    const drop = MB_PICK(cornerLeaves);
                    const idx = leaves.indexOf(drop);
                    if (idx !== -1) leaves.splice(idx, 1);
                }
            }

            // Самая крупная комната становится главным залом (id = 0)
            leaves.sort((a, b) => ((b.x2 - b.x1) * (b.y2 - b.y1)) - ((a.x2 - a.x1) * (a.y2 - a.y1)));
            const rooms = leaves.map((l, idx) => makeRoomObj(idx, l.x1, l.y1, l.x2, l.y2, cfg.defaultFloor, idx === 0 ? cfg.seedRole : ''));

            // Связываем все смежные комнаты в единый связный граф + случайные петли
            const adj = [];
            for (let i = 0; i < rooms.length; i++) {
                for (let j = i + 1; j < rooms.length; j++) {
                    if (roomsShareWall(rooms[i], rooms[j])) adj.push({ a: rooms[i], b: rooms[j] });
                }
            }
            const edges = [];
            const visited = new Set([0]);
            let progressed = true;
            while (progressed) {
                progressed = false;
                const cand = adj.filter(e => (visited.has(e.a.id) && !visited.has(e.b.id)) || (visited.has(e.b.id) && !visited.has(e.a.id)));
                if (cand.length) {
                    const pick = MB_PICK(cand);
                    edges.push(pick);
                    visited.add(pick.a.id); visited.add(pick.b.id);
                    progressed = true;
                }
            }
            // Отбрасываем случайную отрезанную комнату (если угловой вырез её отделил)
            const kept = rooms.filter(r => visited.has(r.id));
            addRandomLoops(kept, edges, 0.35);

            // 40% шанс: центральная комната превращается в открытый внутренний дворик (сад / атриум)!
            if (cfg.allowCourtyard && kept.length >= 5 && Math.random() < 0.42) {
                const inner = kept.slice(1).find(r => r.x1 > bx1 && r.x2 < bx2 && r.y1 > by1 && r.y2 < by2)
                           || kept.slice(1).find(r => r.iw >= 4 && r.ih >= 4);
                if (inner) {
                    inner.isCourtyard = true;
                    inner.role = 'courtyard';
                }
            }
            return { rooms: kept, edges };
        }

        function roomsShareWall(a, b) {
            const v = (a.x2 === b.x1 || b.x2 === a.x1) && (Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) >= 2);
            const h = (a.y2 === b.y1 || b.y2 === a.y1) && (Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) >= 2);
            return v || h;
        }

        function addRandomLoops(rooms, edges, prob) {
            for (let i = 0; i < rooms.length; i++) {
                for (let j = i + 1; j < rooms.length; j++) {
                    const a = rooms[i], b = rooms[j];
                    if (edges.some(e => (e.a.id === a.id && e.b.id === b.id) || (e.a.id === b.id && e.b.id === a.id))) continue;
                    if (roomsShareWall(a, b) && Math.random() < prob) edges.push({ a, b });
                }
            }
        }

        // Ищет глухие внутренние стены комнаты с точным отступом внутрь
        function getSolidWalls(rm) {
            const sides = [];
            const nearDoor = (x, y) => doorSpots.some(d => Math.hypot(d.x - x, d.y - y) < 1.75);
            if (rm.iw >= 3) {
                const mx = rm.cx;
                if (!nearDoor(mx, rm.y1 + 0.5)) sides.push({ dir: 'N', x: mx, y: rm.y1 + 1.55, rot: 0 });
                if (!nearDoor(mx, rm.y2 + 0.5)) sides.push({ dir: 'S', x: mx, y: rm.y2 - 0.55, rot: 180 });
            }
            if (rm.ih >= 3) {
                const my = rm.cy;
                if (!nearDoor(rm.x1 + 0.5, my)) sides.push({ dir: 'W', x: rm.x1 + 1.55, y: my, rot: 90 });
                if (!nearDoor(rm.x2 + 0.5, my)) sides.push({ dir: 'E', x: rm.x2 - 0.55, y: my, rot: 270 });
            }
            return sides;
        }

        function placeTableCluster(cx, cy, isLong = false) {
            if (!canPlace(cx, cy, isLong ? 1.85 : 1.55)) return false;
            addObj(isLong ? P.tavLongTbl : P.tavTables, cx, cy, isLong ? 0.96 : MB_RAND_FLOAT(0.84, 0.96), isLong ? 0 : MB_PICK([0, 90]), isLong ? 1.6 : 1.4);
            if (canPlace(cx, cy - 0.82, 0.3, false)) addObj(P.tavChairs, cx, cy - 0.82, 0.76, 180, 0);
            if (canPlace(cx, cy + 0.82, 0.3, false)) addObj(P.tavChairs, cx, cy + 0.82, 0.76, 0, 0);
            if (isLong) {
                if (canPlace(cx - 0.82, cy - 0.82, 0.3, false)) addObj(P.tavChairs, cx - 0.82, cy - 0.82, 0.76, 180, 0);
                if (canPlace(cx + 0.82, cy + 0.82, 0.3, false)) addObj(P.tavChairs, cx + 0.82, cy + 0.82, 0.76, 0, 0);
            } else if (Math.random() < 0.7) {
                if (canPlace(cx - 0.82, cy, 0.3, false)) addObj(P.tavChairs, cx - 0.82, cy, 0.76, 90, 0);
                if (canPlace(cx + 0.82, cy, 0.3, false)) addObj(P.tavChairs, cx + 0.82, cy, 0.76, 270, 0);
            }
            if (Math.random() < 0.85) addObj(P.food, cx - 0.15, cy + 0.05, 0.60, MB_RAND_INT(0, 359), 0);
            if (Math.random() < 0.75) addObj(P.candles, cx + 0.28, cy - 0.08, 0.58, 0, 0);
            return true;
        }

        // ============================================================
        // 🪑 МЕБЛИРОВКА ПО РОЛЯМ И ТЕМАТИКЕ БИОМА
        // ============================================================
        function furnishRoom(rm) {
            const { x1, y1, x2, y2, iw, ih, cx, cy, role } = rm;
            const walls = getSolidWalls(rm);
            const pickW = () => walls.length ? walls.splice(Math.floor(Math.random() * walls.length), 1)[0] : null;
            const corners = [
                { x: x1 + 1.55, y: y1 + 1.55 }, { x: x2 - 0.55, y: y1 + 1.55 },
                { x: x1 + 1.55, y: y2 - 0.55 }, { x: x2 - 0.55, y: y2 - 0.55 }
            ].filter(pt => canPlace(pt.x, pt.y, 0.8));

            if (role === 'courtyard') {
                if (picked === 'eastern') {
                    const isZenSand = Math.random() < 0.6;
                    fillRect(x1 + 1, y1 + 1, x2 - 1, y2 - 1, isZenSand ? T.sand : T.grass);
                    addObj(isZenSand ? P.eastBonsai : P.eastShrines, cx, cy, 1.05, 0, 1.2);
                    corners.slice(0, 2).forEach(pt => addObj(P.eastLights, pt.x, pt.y, 0.82, 0, 0.65));
                    corners.slice(2, 4).forEach(pt => addObj(P.zenRocks, pt.x, pt.y, 0.85, MB_RAND_INT(0, 359), 0.75));
                } else {
                    fillRect(x1 + 1, y1 + 1, x2 - 1, y2 - 1, T.grass);
                    addObj(P.fountains, cx, cy, 1.15, 0, 1.5);
                    corners.slice(0, 2).forEach(pt => addObj(P.flowers, pt.x, pt.y, 0.88, MB_RAND_INT(0, 359), 0.7));
                    corners.slice(2, 4).forEach(pt => addObj(P.lamps, pt.x, pt.y, 0.82, 0, 0.7));
                }
                return;
            }

            // --- ВОСТОЧНЫЕ КОМНАТЫ (СТРОГО ВОСТОЧНЫЕ АССЕТЫ) ---
            if (picked === 'eastern') {
                if (iw >= 5 && ih >= 4) {
                    addObj(P.eastTatamiB, cx - 1.1, cy, 0.9, 0, 0);
                    addObj(P.eastTatamiB, cx + 1.1, cy, 0.9, 0, 0);
                } else {
                    addObj(iw >= 4 ? P.eastTatamiB : P.eastTatamiS, cx, cy, Math.min(1.02, Math.min(iw, ih) * 0.27), 0, 0);
                }

                if (role === 'dojo') {
                    const sw = pickW();
                    if (sw) addObj(P.eastShrines, sw.x, sw.y, 1.15, sw.rot, 1.3);
                    const w2 = pickW();
                    if (w2 && canPlace(w2.x, w2.y, 0.9)) addObj(P.eastWeapons, w2.x, w2.y, 0.95, w2.rot, 0.95);
                    const w3 = pickW();
                    if (w3 && canPlace(w3.x, w3.y, 0.9)) addObj(P.eastArmor, w3.x, w3.y, 0.94, w3.rot, 0.95);
                    if (iw >= 6 && ih >= 5 && canPlace(cx, cy, 1.1)) addObj(P.eastDrums, cx, cy, 0.94, MB_PICK([0, 90]), 1.1);
                    corners.slice(0, 2).forEach(pt => addObj(P.eastLights, pt.x, pt.y, 0.84, 0, 0.7));
                    if (corners[2]) addObj(P.eastBonsai, corners[2].x, corners[2].y, 0.88, 0, 0.75);
                } else if (role === 'tea_room') {
                    if (canPlace(cx, cy, 1.05)) {
                        addObj(P.eastTables, cx, cy, 0.95, 0, 1.1);
                        addObj(P.eastKettle, cx + 0.12, cy - 0.06, 0.7, 0, 0);
                        if (canPlace(cx, cy - 0.92, 0.3, true)) addObj(P.eastCushion, cx, cy - 0.92, 0.84, 0, 0);
                        if (canPlace(cx, cy + 0.92, 0.3, true)) addObj(P.eastCushion, cx, cy + 0.92, 0.84, 180, 0);
                    }
                    const w1 = pickW();
                    if (w1 && canPlace(w1.x, w1.y, 0.85)) addObj(P.eastScreens, w1.x, w1.y, 0.94, w1.rot, 0.9);
                    if (corners[0]) addObj(P.eastBonsai, corners[0].x, corners[0].y, 0.9, 0, 0.7);
                    if (corners[1]) addObj(P.eastLights, corners[1].x, corners[1].y, 0.82, 0, 0.65);
                } else if (role === 'hearth_room') {
                    if (canPlace(cx, cy, 1.05)) {
                        addObj(P.eastHearth, cx, cy, 1.0, 0, 1.15);
                        addObj(P.eastKettle, cx + 0.24, cy, 0.72, 0, 0);
                        if (canPlace(cx - 1.05, cy, 0.3, true)) addObj(P.eastCushion, cx - 1.05, cy, 0.84, 90, 0);
                        if (canPlace(cx + 1.05, cy, 0.3, true)) addObj(P.eastCushion, cx + 1.05, cy, 0.84, 270, 0);
                    }
                    const w1 = pickW();
                    if (w1 && canPlace(w1.x, w1.y, 0.85)) addObj(P.eastShelves, w1.x, w1.y, 0.9, w1.rot, 0.85);
                    if (corners[0]) addObj(P.eastVases, corners[0].x, corners[0].y, 0.85, 0, 0.7);
                    if (corners[1]) addObj(P.eastLights, corners[1].x, corners[1].y, 0.82, 0, 0.65);
                } else {
                    const w1 = pickW();
                    if (w1 && canPlace(w1.x, w1.y, 0.95)) addObj(P.eastFuton, w1.x, w1.y, 0.96, w1.rot, 1.05);
                    else if (canPlace(cx, cy, 0.9)) addObj(P.eastFuton, cx, cy, 0.94, 0, 1.05);
                    const w2 = pickW();
                    if (w2 && canPlace(w2.x, w2.y, 0.85)) addObj(Math.random() < 0.5 ? P.eastScreens : P.eastShelves, w2.x, w2.y, 0.9, w2.rot, 0.85);
                    if (corners[0]) addObj(P.eastLights, corners[0].x, corners[0].y, 0.8, 0, 0.65);
                    if (corners[1]) addObj(Math.random() < 0.5 ? P.eastKimono : P.eastVases, corners[1].x, corners[1].y, 0.85, 0, 0.7);
                    if (corners[2]) addObj(P.eastProps, corners[2].x, corners[2].y, 0.8, MB_RAND_INT(0, 359), 0.65);
                }
                return;
            }

            // --- ОСТАЛЬНЫЕ ИНТЕРЬЕРЫ ---
            if (role === 'tavern_hall') {
                const fw = pickW();
                if (fw) addObj(P.fireplaces, fw.x, fw.y, 1.02, fw.rot, 1.35);
                addObj(P.rugs, cx, cy, Math.min(1.25, Math.min(iw, ih) * 0.22), 0, 0);
                addObj(P.chandeliers, cx, cy, 0.98, 0, 0);
                const bw = pickW();
                if (bw && (iw >= 5 || ih >= 5)) {
                    const horiz = (bw.dir === 'N' || bw.dir === 'S');
                    const span = Math.min(4, Math.max(2, Math.floor((horiz ? iw : ih) * 0.48)));
                    const inset = (bw.dir === 'N' || bw.dir === 'W') ? 0.95 : -0.95;
                    for (let i = 0; i < span; i++) {
                        const off = (i - (span - 1) / 2) * 1.05;
                        const bx = horiz ? (bw.x + off) : (bw.x + inset);
                        const by = horiz ? (bw.y + inset) : (bw.y + off);
                        if (!canPlace(bx, by, 0.82)) continue;
                        addObj(P.barStraight, bx, by, 0.9, horiz ? 0 : 90, 0.78);
                        const sx = horiz ? bx : (bx + inset * 0.9), sy = horiz ? (by + inset * 0.9) : by;
                        const brx = horiz ? bx : (bx - inset * 0.82), bry = horiz ? (by - inset * 0.82) : by;
                        if (canPlace(sx, sy, 0.35, true)) addObj(P.tavStools, sx, sy, 0.72, 0, 0.38);
                        if (Math.random() < 0.8 && canPlace(brx, bry, 0.35, true)) addObj(P.barrels, brx, bry, 0.75, MB_RAND_INT(0, 359), 0.38);
                    }
                    addObj(P.candles, bw.x, bw.y + (horiz ? inset : 0), 0.6, 0, 0);
                }
                let tablesLeft = Math.max(2, Math.min(6, Math.floor((iw * ih) / 14)));
                for (let t = 0; t < 36 && tablesLeft > 0; t++) {
                    const tx = MB_RAND_FLOAT(x1 + 2.0, x2 - 1.0), ty = MB_RAND_FLOAT(y1 + 2.0, y2 - 1.0);
                    if (placeTableCluster(tx, ty, Math.random() < 0.35)) tablesLeft--;
                }
            }
            else if (role === 'kitchen') {
                fillRect(x1 + 1, y1 + 1, x2 - 1, y2 - 1, T.flagstone);
                const fw = pickW();
                if (fw) addObj(P.fireplaces, fw.x, fw.y, 1.0, fw.rot, 1.25);
                if (canPlace(cx, cy, 1.15)) {
                    addObj(P.tavLongTbl, cx, cy, 0.86, iw >= ih ? 0 : 90, 1.2);
                    addObj(P.kitchenProp, cx - 0.25, cy, 0.65, MB_RAND_INT(0, 359), 0);
                    addObj(P.food, cx + 0.3, cy, 0.58, MB_RAND_INT(0, 359), 0);
                }
                corners.slice(0, 3).forEach((pt, idx) => addObj(idx % 2 === 0 ? P.barrels : P.crates, pt.x, pt.y, 0.8, MB_RAND_INT(0, 359), 0.7));
                if (corners[3]) addObj(P.candles, corners[3].x, corners[3].y, 0.62, 0, 0);
            }
            else if (role === 'bedroom') {
                addObj(P.rugs, cx, cy, Math.min(1.0, Math.min(iw, ih) * 0.26), 0, 0);
                const bw = pickW();
                if (bw) addObj(P.beds, bw.x, bw.y, 0.92, bw.rot, 1.25);
                else if (canPlace(cx, cy, 1.0)) addObj(P.beds, cx, cy, 0.9, 0, 1.2);
                const sw = pickW();
                if (sw && canPlace(sw.x, sw.y, 0.85)) addObj(P.shelves, sw.x, sw.y, 0.82, sw.rot, 0.85);
                if (corners[0]) addObj(P.candles, corners[0].x, corners[0].y, 0.58, 0, 0);
                if (iw >= 4 && ih >= 4 && corners[1] && Math.random() < 0.45) addObj(P.beds, corners[1].x, corners[1].y, 0.88, 0, 1.1);
            }
            else if (role === 'cellar') {
                fillRect(x1 + 1, y1 + 1, x2 - 1, y2 - 1, T.stone);
                for (let c = x1 + 1.6; c <= x2 - 0.6; c += 1.45) {
                    if (canPlace(c, y1 + 1.55, 0.8)) addObj(Math.random() < 0.6 ? P.barrels : P.crates, c, y1 + 1.55, 0.82, MB_RAND_INT(0, 359), 0.7);
                    if (ih >= 4 && canPlace(c, y2 - 0.55, 0.8)) addObj(Math.random() < 0.5 ? P.crates : P.barrels, c, y2 - 0.55, 0.82, MB_RAND_INT(0, 359), 0.7);
                }
                addObj(P.candles, cx, cy, 0.65, 0, 0);
            }
            else if (role === 'stable') {
                fillRect(x1 + 1, y1 + 1, x2 - 1, y2 - 1, T.dirt);
                if (canPlace(cx - 0.7, cy, 0.9)) addObj(P.horses, cx - 0.7, cy, 0.92, MB_PICK([0, 90, 180, 270]), 1.1);
                if (iw >= 4 && canPlace(cx + 0.9, cy, 0.9)) addObj(P.horses, cx + 0.9, cy, 0.92, MB_PICK([0, 90, 180, 270]), 1.1);
                if (corners[0]) addObj(P.crates, corners[0].x, corners[0].y, 0.82, 15, 0.7);
                if (corners[1]) addObj(P.barrels, corners[1].x, corners[1].y, 0.82, 0, 0.7);
            }
            else if (role === 'vip_lounge' || role === 'parlor') {
                addObj(P.rugs, cx, cy, Math.min(1.2, Math.min(iw, ih) * 0.28), 0, 0);
                addObj(P.chandeliers, cx, cy, 0.92, 0, 0);
                if (canPlace(cx, cy, 1.25)) addObj(P.manLuxury, cx, cy, 0.95, MB_PICK([0, 90]), 1.35);
                const w1 = pickW();
                if (w1 && canPlace(w1.x, w1.y, 0.9)) addObj(P.manSofas, w1.x, w1.y, 0.88, w1.rot, 1.0);
                const w2 = pickW();
                if (w2 && canPlace(w2.x, w2.y, 0.9)) addObj(P.fireplaces, w2.x, w2.y, 0.95, w2.rot, 1.1);
                if (Math.random() < 0.5 && corners[0]) addObj(P.manCats, corners[0].x, corners[0].y, 0.78, MB_RAND_INT(0, 359), 0);
            }
            else if (role === 'foyer') {
                fillRect(x1 + 1, y1 + 1, x2 - 1, y2 - 1, T.flagstone);
                addObj(P.rugs, cx, cy, Math.min(1.15, Math.min(iw, ih) * 0.25), 0, 0);
                addObj(P.chandeliers, cx, cy, 1.0, 0, 0);
                const sw = pickW();
                if (sw && canPlace(sw.x, sw.y, 1.1)) addObj(P.stoneStairs, sw.x, sw.y, 0.88, sw.rot, 1.3);
                corners.slice(0, 2).forEach(pt => addObj('other_feature_suit_of_armor_2_gold', pt.x, pt.y, 0.82, 0, 0.8));
            }
            else if (role === 'throne') {
                fillRect(x1 + 1, y1 + 1, x2 - 1, y2 - 1, T.flagstone);
                addObj(P.rugs, cx, cy, Math.min(1.3, Math.min(iw, ih) * 0.25), 0, 0);
                addObj(P.chandeliers, cx, cy, 1.05, 0, 0);
                const tw = pickW();
                if (tw) addObj('furniture_chair_throne_stone', tw.x, tw.y, 1.15, tw.rot, 1.4);
                corners.forEach(pt => addObj(Math.random() < 0.5 ? P.braziers : P.pillars, pt.x, pt.y, 0.85, 0, 0.8));
            }
            else if (role === 'library' || role === 'observatory') {
                addObj(P.rugs, cx, cy, Math.min(1.15, Math.min(iw, ih) * 0.26), 0, 0);
                if (role === 'observatory' && canPlace(cx, cy, 1.35)) {
                    addObj('other_feature_orrery_huge_gold', cx, cy, 1.05, 0, 1.5);
                    corners.slice(0, 2).forEach(pt => addObj(P.crystals, pt.x, pt.y, 0.85, 0, 0.8));
                } else if (canPlace(cx, cy, 1.1)) {
                    addObj('furniture_table_writing_desk_dark', cx, cy, 0.92, 0, 1.2);
                    addObj(P.candles, cx + 0.4, cy, 0.6, 0, 0);
                }
                while (walls.length) {
                    const w = pickW();
                    if (w && canPlace(w.x, w.y, 0.9)) addObj(P.manBooks, w.x, w.y, 0.9, w.rot, 0.95);
                }
            }
            else if (role === 'dining') {
                addObj(P.rugs, cx, cy, Math.min(1.2, Math.min(iw, ih) * 0.28), 0, 0);
                addObj(P.chandeliers, cx, cy, 0.95, 0, 0);
                placeTableCluster(cx, cy, true);
                const fw = pickW();
                if (fw && canPlace(fw.x, fw.y, 1.0)) addObj(P.fireplaces, fw.x, fw.y, 0.95, fw.rot, 1.1);
            }
            else if (role === 'bath') {
                fillRect(x1 + 1, y1 + 1, x2 - 1, y2 - 1, T.flagstone);
                if (canPlace(cx, cy, 1.1)) addObj(P.manBath, cx, cy, 0.98, MB_PICK([0, 90]), 1.2);
                if (corners[0]) addObj(P.candles, corners[0].x, corners[0].y, 0.65, 0, 0);
            }
            else if (role === 'treasury') {
                fillRect(x1 + 1, y1 + 1, x2 - 1, y2 - 1, T.flagstone);
                corners.slice(0, 3).forEach(pt => addObj(P.chests, pt.x, pt.y, 0.88, MB_RAND_INT(0, 359), 0.85));
                if (canPlace(cx, cy, 1.1)) addObj(P.dwStatues, cx, cy, 1.05, 0, 1.2);
                if (corners[3]) addObj(P.braziers, corners[3].x, corners[3].y, 0.82, 0, 0.7);
            }
            else if (role === 'forge') {
                fillRect(x1 + 1, y1 + 1, x2 - 1, y2 - 1, T.flagstone);
                const lw = pickW();
                if (lw && iw >= 5 && ih >= 5) {
                    if (lw.dir === 'N') fillRect(x1 + 2, y1 + 1, x2 - 2, y1 + 1, T.lava);
                    else if (lw.dir === 'S') fillRect(x1 + 2, y2 - 1, x2 - 2, y2 - 1, T.lava);
                    else if (lw.dir === 'W') fillRect(x1 + 1, y1 + 2, x1 + 1, y2 - 2, T.lava);
                    else fillRect(x2 - 1, y1 + 2, x2 - 1, y2 - 2, T.lava);
                }
                const fw = pickW();
                if (fw) addObj(P.dwForge, fw.x, fw.y, 1.08, fw.rot, 1.35);
                else if (canPlace(cx, cy, 1.2)) addObj(P.dwForge, cx, cy, 1.05, 0, 1.35);
                if (canPlace(cx, cy, 1.05)) addObj(P.dwAnvil, cx, cy, 0.95, 0, 1.0);
                corners.slice(0, 3).forEach(pt => {
                    if (!isHazard(Math.floor(pt.x), Math.floor(pt.y))) addObj(P.dwLoot, pt.x, pt.y, 0.88, MB_RAND_INT(0, 359), 0.85);
                });
            }
            else if (role === 'entry') {
                if (canPlace(cx, cy, 1.1)) addObj(P.stoneStairs, cx, cy, 0.88, MB_PICK([0, 90, 180, 270]), 1.3);
                if (corners[0]) addObj(P.braziers, corners[0].x, corners[0].y, 0.82, 0, 0.7);
                if (corners[1]) addObj(P.crates, corners[1].x, corners[1].y, 0.8, 20, 0.7);
            }
            else if (role === 'boss_sanctum') {
                addObj(P.rugs, cx, cy, Math.min(1.25, Math.min(iw, ih) * 0.26), 0, 0);
                addObj(P.altars, cx, cy, 1.15, MB_PICK([0, 90, 180, 270]), 1.4);
                corners.slice(0, 2).forEach(pt => addObj(P.braziers, pt.x, pt.y, 0.85, 0, 0.75));
                if (corners[2]) addObj(P.chests, corners[2].x, corners[2].y, 0.9, 0, 0.85);
            }
            else if (role === 'pit' && iw >= 4 && ih >= 4) {
                const haz = MB_PICK([T.lava, T.water, T.abyss]);
                fillRect(Math.floor(cx) - 1, Math.floor(cy) - 1, Math.floor(cx), Math.floor(cy), haz);
                corners.slice(0, 2).forEach(pt => addObj(P.pillars, pt.x, pt.y, 0.9, 0, 0.8));
                if (corners[2]) addObj(P.braziers, corners[2].x, corners[2].y, 0.8, 0, 0.7);
            }
            else if (role === 'prison') {
                if (canPlace(cx, cy, 1.0)) addObj(P.cages, cx, cy, 0.95, 0, 1.1);
                if (corners[0]) addObj(P.bones, corners[0].x, corners[0].y, 0.9, MB_RAND_INT(0, 359), 0.8);
                if (corners[1]) addObj(P.braziers, corners[1].x, corners[1].y, 0.8, 0, 0.7);
                if (corners[2]) addObj(P.webs, corners[2].x, corners[2].y, 0.88, 0, 0);
            }
            else if (role === 'crypt') {
                if (canPlace(cx, cy, 1.1)) addObj(P.altars, cx, cy, 0.95, MB_PICK([0, 90]), 1.2);
                if (corners[0]) addObj(P.braziers, corners[0].x, corners[0].y, 0.8, 0, 0.7);
                if (corners[1]) addObj(P.bones, corners[1].x, corners[1].y, 0.88, MB_RAND_INT(0, 359), 0.8);
                if (corners[2]) addObj(P.webs, corners[2].x, corners[2].y, 0.88, 90, 0);
            }
            else if (role === 'crystal') {
                if (canPlace(cx, cy, 1.1)) addObj(P.crystals, cx, cy, 1.05, MB_RAND_INT(0, 359), 1.1);
                corners.slice(0, 2).forEach(pt => addObj(Math.random() < 0.5 ? P.crystals : P.rubble, pt.x, pt.y, 0.88, MB_RAND_INT(0, 359), 0.85));
            }
            else {
                if (corners[0]) addObj(P.braziers, corners[0].x, corners[0].y, 0.8, 0, 0.7);
                if (canPlace(cx, cy, 1.1)) addObj(Math.random() < 0.5 ? P.bones : P.rubble, cx, cy, 0.92, MB_RAND_INT(0, 359), 0.95);
                if (corners[1]) addObj(Math.random() < 0.5 ? P.chests : P.crates, corners[1].x, corners[1].y, 0.85, MB_RAND_INT(0, 359), 0.8);
                if (corners[2]) addObj(P.webs, corners[2].x, corners[2].y, 0.88, 0, 0);
            }
        }

        // ============================================================
        // 🏗️ СБОРКА ЛОКАЦИЙ ПО БИОМАМ (100% ПРОЦЕДУРНО)
        // ============================================================
        let genTitle = 'Локация';

        // 1. 🏰 ПОДЗЕМЕЛЬЕ (ЗАЛЫ + ОРГАНИЧЕСКИЕ ПЕЩЕРЫ + СЛУЧАЙНЫЙ РАЗЛОМ/РЕКА)
        if (picked === 'dungeon') {
            const rooms = [];
            const target = Math.max(5, Math.min(18, Math.floor((cols * rows) / 46) + MB_RAND_INT(-1, 2)));
            const hasCaves = Math.random() < 0.45;

            for (let a = 0; a < target * 24 && rooms.length < target; a++) {
                const rw = MB_RAND_INT(5, Math.min(10, Math.max(6, Math.floor(cols * 0.30))));
                const rh = MB_RAND_INT(5, Math.min(9, Math.max(6, Math.floor(rows * 0.34))));
                const rx1 = MB_RAND_INT(1, Math.max(1, cols - rw - 1));
                const ry1 = MB_RAND_INT(1, Math.max(1, rows - rh - 1));
                const rx2 = rx1 + rw - 1, ry2 = ry1 + rh - 1;
                const gap = Math.random() < 0.55 ? 1 : 0;
                if (rooms.some(r => rx1 < r.x2 + gap && rx2 > r.x1 - gap && ry1 < r.y2 + gap && ry2 > r.y1 - gap)) continue;
                const rm = makeRoomObj(rooms.length, rx1, ry1, rx2, ry2, Math.random() < 0.5 ? T.stone : T.flagstone, '');
                rm.isCave = hasCaves && rooms.length > 0 && Math.random() < 0.38;
                rooms.push(rm);
            }
            if (!rooms.length) rooms.push(makeRoomObj(0, 2, 2, cols - 3, rows - 3, T.stone, 'entry'));

            // Вырезаем комнаты (прямоугольные залы или органические пещеры)
            rooms.forEach(rm => {
                if (rm.isCave) {
                    paintBlob(rm.cx, rm.cy, rm.iw * 0.62, rm.ih * 0.62, T.stone, 0.22);
                } else {
                    fillRect(rm.x1 + 1, rm.y1 + 1, rm.x2 - 1, rm.y2 - 1, rm.floor);
                }
            });

            // Минимальное остовное дерево + 1–2 кольцевых прохода
            const connected = [rooms[0]], rest = rooms.slice(1), links = [];
            while (rest.length) {
                let bestA = null, bestBi = 0, bestD = 1e9;
                rest.forEach((b, bi) => connected.forEach(a => {
                    const d = Math.hypot(a.cx - b.cx, a.cy - b.cy);
                    if (d < bestD) { bestD = d; bestA = a; bestBi = bi; }
                }));
                const ch = rest.splice(bestBi, 1)[0];
                ch.dist = bestA.dist + 1;
                connected.push(ch);
                links.push([bestA, ch]);
            }
            if (rooms.length >= 4) links.push([rooms[0], rooms[rooms.length - 1]]);
            if (rooms.length >= 7) links.push([rooms[1], rooms[rooms.length - 2]]);

            const corrW = cols >= 26 ? 2 : 1;
            const corrFloor = Math.random() < 0.5 ? T.stone : T.flagstone;
            links.forEach(([a, b]) => {
                let x = Math.floor(a.cx), y = Math.floor(a.cy);
                const tx = Math.floor(b.cx), ty = Math.floor(b.cy);
                const hFirst = Math.random() < 0.5;
                const dig = (cx, cy) => { if (inB(cx, cy) && cx > 0 && cx < cols - 1 && cy > 0 && cy < rows - 1) setT(cx, cy, corrFloor); };
                if (hFirst) {
                    while (x !== tx) { for (let d = 0; d < corrW; d++) dig(x, y + d); x += (tx > x ? 1 : -1); }
                    while (y !== ty) { for (let d = 0; d < corrW; d++) dig(x + d, y); y += (ty > y ? 1 : -1); }
                } else {
                    while (y !== ty) { for (let d = 0; d < corrW; d++) dig(x + d, y); y += (ty > y ? 1 : -1); }
                    while (x !== tx) { for (let d = 0; d < corrW; d++) dig(x, y + d); x += (tx > x ? 1 : -1); }
                }
            });

            // 42% шанс: подземная река / лавовый разлом / пропасть в произвольном направлении + авто-мосты!
            let hazName = '';
            if (cols >= 20 && Math.random() < 0.42) {
                const haz = MB_PICK([T.water, T.lava, T.abyss]);
                hazName = haz === T.water ? 'Подземная река' : (haz === T.lava ? 'Лавовый разлом' : 'Бездна катакомб');
                const vert = Math.random() < 0.65;
                const p0 = vert ? { x: cols * MB_RAND_FLOAT(0.32, 0.68), y: 1 } : { x: 1, y: rows * MB_RAND_FLOAT(0.32, 0.68) };
                const p1 = vert ? { x: cols * MB_RAND_FLOAT(0.32, 0.68), y: rows - 2 } : { x: cols - 2, y: rows * MB_RAND_FLOAT(0.32, 0.68) };
                const pts = carveSpline(p0, p1, 1.15, haz, { avoidWall: true, bend: MB_RAND_FLOAT(-0.22, 0.22) });
                let lastBx = -99, lastBy = -99;
                for (let i = 4; i < pts.length - 4; i += 3) {
                    const c = Math.floor(pts[i].x), r = Math.floor(pts[i].y);
                    if (getT(c, r) !== haz || Math.hypot(c - lastBx, r - lastBy) < 4.5) continue;
                    if (vert && !isWall(c - 2, r) && !isWall(c + 2, r) && !isHazard(c - 2, r) && !isHazard(c + 2, r)) {
                        placeBridgeSpan(c - 1, r + 0.5, c + 2, r + 0.5, true); lastBx = c; lastBy = r;
                    } else if (!vert && !isWall(c, r - 2) && !isWall(c, r + 2) && !isHazard(c, r - 2) && !isHazard(c, r + 2)) {
                        placeBridgeSpan(c + 0.5, r - 1, c + 0.5, r + 2, true); lastBx = c; lastBy = r;
                    }
                }
            }

            rooms.sort((a, b) => a.dist - b.dist);
            const midRoles = ['crypt', 'prison', 'pit', 'crystal', 'treasury', 'rubble', 'cellar'];
            rooms.forEach((rm, idx) => {
                if (idx === 0) rm.role = 'entry';
                else if (idx === rooms.length - 1) rm.role = 'boss_sanctum';
                else rm.role = rm.isCave ? MB_PICK(['crystal', 'rubble', 'pit']) : MB_PICK(midRoles);
                furnishRoom(rm);
            });
            genTitle = hazName || (hasCaves ? MB_PICK(['Пещеры и катакомбы', 'Подземные гроты', 'Склепы в скале']) : MB_PICK(['Забытые катакомбы', 'Тайные казематы', 'Лабиринт Теней']));
        }

        // 2. ⛩️ ВОСТОЧНЫЙ ХРАМ / ДОДЗЁ (100% ПРОЦЕДУРНЫЙ КОМПЛЕКС + ВОСТОЧНЫЙ САД, БЕЗ ШАБЛОНОВ!)
        else if (picked === 'eastern') {
            // 1) Осенняя листва пятнами по саду
            for (let i = 0; i < Math.floor((cols * rows) / 36); i++) {
                paintBlob(MB_RAND_FLOAT(1.5, cols - 1.5), MB_RAND_FLOAT(1.5, rows - 1.5), MB_RAND_FLOAT(1.6, 3.0), MB_RAND_FLOAT(1.3, 2.4), T.leafR, 0.22, [T.grass]);
            }

            // 2) Независимый слой воды: 0 = сухой сад камней, 1 = пруд/озеро в случайном месте, 2 = ручей с произвольным изгибом
            const waterMode = MB_PICK([0, 1, 1, 2]);
            let waterTag = '';
            if (waterMode === 1) {
                const wx = cols * MB_RAND_FLOAT(0.24, 0.76), wy = rows * MB_RAND_FLOAT(0.24, 0.76);
                const wrx = Math.min(cols * 0.36, MB_RAND_FLOAT(3.2, cols * 0.34));
                const wry = Math.min(rows * 0.40, MB_RAND_FLOAT(2.6, rows * 0.36));
                paintBlob(wx, wy, wrx, wry, T.water, 0.16);
                waterTag = 'пруда';
            } else if (waterMode === 2) {
                const sides = MB_PICK([['N', 'S'], ['W', 'E'], ['N', 'E'], ['S', 'W']]);
                const ptOnSide = s => s === 'N' ? { x: cols * MB_RAND_FLOAT(0.2, 0.8), y: 0 }
                                    : s === 'S' ? { x: cols * MB_RAND_FLOAT(0.2, 0.8), y: rows - 1 }
                                    : s === 'W' ? { x: 0, y: rows * MB_RAND_FLOAT(0.2, 0.8) }
                                    : { x: cols - 1, y: rows * MB_RAND_FLOAT(0.2, 0.8) };
                carveSpline(ptOnSide(sides[0]), ptOnSide(sides[1]), cols >= 26 ? 1.45 : 1.15, T.water);
                waterTag = 'ручья';
            }

            // 3) Независимая архитектура павильонов: либо единый комплекс (граф/BSP с атриумом), либо 2–3 отдельных павильона!
            const useMultiPavilion = (cols >= 20 && Math.random() < 0.48);
            const rooms = [];
            const edges = [];

            if (useMultiPavilion) {
                const nPav = cols >= 30 ? MB_RAND_INT(3, 4) : MB_RAND_INT(2, 3);
                for (let p = 0; p < nPav; p++) {
                    for (let att = 0; att < 55; att++) {
                        const pw = p === 0 ? MB_RAND_INT(7, Math.min(11, Math.floor(cols * 0.42))) : MB_RAND_INT(5, 8);
                        const ph = p === 0 ? MB_RAND_INT(6, Math.min(9, Math.floor(rows * 0.48))) : MB_RAND_INT(5, 7);
                        const px1 = MB_RAND_INT(2, Math.max(2, cols - pw - 2));
                        const py1 = MB_RAND_INT(2, Math.max(2, rows - ph - 2));
                        const px2 = px1 + pw - 1, py2 = py1 + ph - 1;
                        if (rooms.some(r => px1 < r.x2 + 2 && px2 > r.x1 - 2 && py1 < r.y2 + 2 && py2 > r.y1 - 2)) continue;
                        // Если павильон 0 — разрешаем ему стать островом прямо в центре большого озера!
                        let waterCells = 0;
                        for (let r = py1; r <= py2; r++) for (let c = px1; c <= px2; c++) if (isWater(c, r)) waterCells++;
                        const totalCells = pw * ph;
                        if (p > 0 && waterCells > totalCells * 0.15) continue;
                        if (p === 0 && waterCells > totalCells * 0.15 && waterCells < totalCells * 0.72) continue;
                        rooms.push(makeRoomObj(rooms.length, px1, py1, px2, py2, T.wood, p === 0 ? 'dojo' : ''));
                        break;
                    }
                }
            }

            if (!rooms.length) {
                const mX = Math.max(2, Math.floor(cols * 0.10)), mY = Math.max(2, Math.floor(rows * 0.10));
                const tRooms = Math.max(3, Math.min(7, Math.floor(((cols - mX * 2) * (rows - mY * 2)) / 52) + MB_RAND_INT(0, 1)));
                const built = (Math.random() < 0.45 && cols >= 22 && rows >= 14)
                    ? buildBSPBuilding({ mX, mY, targetRooms: tRooms, defaultFloor: T.wood, seedRole: 'dojo', allowCourtyard: true })
                    : buildRoomGraph({ mX, mY, targetRooms: tRooms, seedW: [7, 11], seedH: [6, 9], roomW: [5, 7], roomH: [5, 7], defaultFloor: T.wood, seedRole: 'dojo', avoidWater: false });
                built.rooms.forEach(r => rooms.push(r));
                built.edges.forEach(e => edges.push(e));
            }

            // Строим стены и полы павильонов
            rooms.forEach(rm => {
                for (let r = rm.y1; r <= rm.y2; r++) for (let c = rm.x1; c <= rm.x2; c++) {
                    if (r === rm.y1 || r === rm.y2 || c === rm.x1 || c === rm.x2) setT(c, r, T.wall);
                }
            });
            rooms.forEach(rm => fillRect(rm.x1 + 1, rm.y1 + 1, rm.x2 - 1, rm.y2 - 1, rm.floor));

            // Внутренние сёдзи-двери между смежными комнатами
            edges.forEach(({ a, b }) => {
                if (a.x2 === b.x1 || b.x2 === a.x1) {
                    const wx = (a.x2 === b.x1) ? a.x2 : b.x2;
                    const lo = Math.max(a.y1, b.y1) + 1, hi = Math.min(a.y2, b.y2) - 1;
                    if (hi >= lo) placeDoor(wx, MB_RAND_INT(lo, hi), T.wood, true, P.eastDoors);
                } else if (a.y2 === b.y1 || b.y2 === a.y1) {
                    const wy = (a.y2 === b.y1) ? a.y2 : b.y2;
                    const lo = Math.max(a.x1, b.x1) + 1, hi = Math.min(a.x2, b.x2) - 1;
                    if (hi >= lo) placeDoor(MB_RAND_INT(lo, hi), wy, T.wood, false, P.eastDoors);
                }
            });

            // Входы наружу для каждого независимого павильона + каменные дорожки с авто-мостами!
            const extExits = [];
            const isStoneBr = Math.random() < 0.45;
            rooms.forEach((rm, idx) => {
                if (rm.isCourtyard) return;
                // Если это не первый павильон и он уже соединён внутренней дверью — внешний выход нужен только иногда
                const hasInner = edges.some(e => e.a.id === rm.id || e.b.id === rm.id);
                if (idx > 0 && hasInner && Math.random() < 0.72) return;

                const cands = [];
                for (let c = rm.x1 + 1; c < rm.x2; c++) {
                    if (inB(c, rm.y1 - 1) && !isWall(c, rm.y1 - 1)) cands.push({ c, r: rm.y1, dx: 0, dy: 1, vert: false });
                    if (inB(c, rm.y2 + 1) && !isWall(c, rm.y2 + 1)) cands.push({ c, r: rm.y2, dx: 0, dy: -1, vert: false });
                }
                for (let r = rm.y1 + 1; r < rm.y2; r++) {
                    if (inB(rm.x1 - 1, r) && !isWall(rm.x1 - 1, r)) cands.push({ c: rm.x1, r, dx: 1, dy: 0, vert: true });
                    if (inB(rm.x2 + 1, r) && !isWall(rm.x2 + 1, r)) cands.push({ c: rm.x2, r, dx: -1, dy: 0, vert: true });
                }
                const ex = MB_PICK(cands);
                if (ex) {
                    placeDoor(ex.c, ex.r, T.wood, ex.vert, P.eastDoors, { dx: ex.dx, dy: ex.dy });
                    extExits.push(ex);
                }
            });

            // Соединяем выходы между собой и с краем карты (авто-мосты через любую воду!)
            if (extExits.length) {
                const mainEx = extExits[0];
                const edgeX = mainEx.dx === 1 ? 0 : (mainEx.dx === -1 ? cols - 1 : mainEx.c);
                const edgeY = mainEx.dy === 1 ? 0 : (mainEx.dy === -1 ? rows - 1 : mainEx.r);
                layPathWithBridges(mainEx.c - mainEx.dx, mainEx.r - mainEx.dy, edgeX, edgeY, T.flagstone, isStoneBr, 1);
                for (let i = 1; i < extExits.length; i++) {
                    const a = extExits[i - 1], b = extExits[i];
                    layPathWithBridges(a.c - a.dx, a.r - a.dy, b.c - b.dx, b.r - b.dy, T.flagstone, isStoneBr, 1);
                }
            }

            // Раздаём роли комнатам и наполняем восточной мебелью
            const eastDeck = ['tea_room', 'hearth_room', 'monk_room', 'monk_room', 'dojo', 'tea_room'];
            rooms.forEach((rm, idx) => {
                if (idx > 0 && !rm.isCourtyard) rm.role = eastDeck.length ? eastDeck.splice(Math.floor(Math.random() * Math.min(3, eastDeck.length)), 1)[0] : MB_PICK(['tea_room', 'monk_room', 'hearth_room']);
                furnishRoom(rm);
            });

            // Уличные восточные элементы на свободной земле: сад камней + чайная площадка с зонтом / тренировочный двор
            for (let tries = 0; tries < 24; tries++) {
                const zx = MB_RAND_INT(3, cols - 4), zy = MB_RAND_INT(3, rows - 4);
                const ok = [-2, 0, 2].every(dy => [-2, 0, 2].every(dx => getT(zx + dx, zy + dy) === T.grass || getT(zx + dx, zy + dy) === T.leafR));
                if (!ok) continue;
                paintBlob(zx, zy, MB_RAND_FLOAT(2.2, 3.3), MB_RAND_FLOAT(1.8, 2.7), T.sand, 0.14, [T.grass, T.leafR]);
                if (Math.random() < 0.45) {
                    // Тренировочный песчаный двор
                    addObj(P.eastWeapons, zx - 1.2, zy, 0.94, 90, 0.9);
                    addObj(P.eastArmor, zx + 1.2, zy, 0.94, 270, 0.9);
                    addObj(P.eastDrums, zx, zy + 0.8, 0.95, 0, 1.0);
                } else {
                    // Сад камней карэсансуй
                    addObj(P.eastBonsai, zx, zy, 0.96, 0, 1.0);
                    for (let k = 0; k < 3; k++) {
                        const sx = zx + MB_RAND_FLOAT(-1.8, 1.8), sy = zy + MB_RAND_FLOAT(-1.4, 1.4);
                        if (getT(Math.floor(sx), Math.floor(sy)) === T.sand && canPlace(sx, sy, 1.0)) addObj(P.zenRocks, sx, sy, 0.92, MB_RAND_INT(0, 359), 0.9);
                    }
                }
                break;
            }
            if (cols >= 22 && Math.random() < 0.65) {
                for (let tries = 0; tries < 24; tries++) {
                    const dx = MB_RAND_INT(2, cols - 5), dy = MB_RAND_INT(2, rows - 5);
                    let clear = true;
                    for (let r = dy; r <= dy + 3 && clear; r++) for (let c = dx; c <= dx + 3 && clear; c++) {
                        if (getT(c, r) !== T.grass && getT(c, r) !== T.leafR) clear = false;
                    }
                    if (!clear) continue;
                    fillRect(dx, dy, dx + 3, dy + 3, T.wood);
                    const mx = dx + 2, my = dy + 2;
                    addObj(P.eastTatamiS, mx, my, 1.05, 0, 0);
                    addObj(P.eastTables, mx, my, 0.88, 0, 1.0);
                    addObj(P.eastKettle, mx + 0.1, my, 0.68, 0, 0);
                    addObj(P.eastParasol, mx - 1.1, my - 1.0, 1.02, MB_RAND_INT(0, 359), 0.9);
                    addObj(P.eastLights, dx + 3.5, dy + 0.5, 0.82, 0, 0.65);
                    break;
                }
            }

            // Кувшинки + японский сад вокруг
            for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
                if (isWater(c, r) && canPlace(c + 0.5, r + 0.5, 1.45) && Math.random() < 0.16) addObj(P.waterDec, c + 0.5, r + 0.5, 0.9, MB_RAND_INT(0, 359), 0.85);
            }
            const groves = Math.max(4, Math.floor((cols * rows) / 58));
            for (let g = 0; g < groves; g++) {
                const gx = MB_RAND_FLOAT(1.5, cols - 1.5), gy = MB_RAND_FLOAT(1.5, rows - 1.5);
                if (getT(Math.floor(gx), Math.floor(gy)) !== T.grass && getT(Math.floor(gx), Math.floor(gy)) !== T.leafR) continue;
                for (let k = 0; k < MB_RAND_INT(3, 5); k++) {
                    const ox = gx + MB_RAND_FLOAT(-2.4, 2.4), oy = gy + MB_RAND_FLOAT(-2.1, 2.1);
                    const t = getT(Math.floor(ox), Math.floor(oy));
                    if (t !== T.grass && t !== T.leafR) continue;
                    if ([-1, 0, 1].some(dr => [-1, 0, 1].some(dc => isWall(Math.floor(ox) + dc, Math.floor(oy) + dr)))) continue;
                    if (!canPlace(ox, oy, 1.55)) continue;
                    if (k < 2) addObj(P.trees, ox, oy, MB_RAND_FLOAT(0.88, 1.22), MB_RAND_INT(0, 359), 1.6);
                    else if (k < 4) addObj(Math.random() < 0.6 ? P.redBushes : P.bushes, ox, oy, MB_RAND_FLOAT(0.82, 1.12), MB_RAND_INT(0, 359), 0.95);
                    else addObj(Math.random() < 0.5 ? P.zenRocks : P.flowers, ox, oy, 0.84, MB_RAND_INT(0, 359), 0.78);
                }
            }
            genTitle = waterTag ? `Восточное додзё у ${waterTag}` : MB_PICK(['Монастырь Сада Камней', 'Храм Тихого Лотоса', 'Обитель Сакуры', 'Школа Клинка']);
        }

        // 3. 🍺 ТАВЕРНА, 🏛️ ОСОБНЯК, ⚒️ КУЗНИЦА ДВАРФОВ (ГРАФ ИЛИ BSP С АТРИУМОМ!)
        else {
            const isIndoorRock = (picked === 'dwarven');
            const mX = isIndoorRock ? 1 : Math.max(2, Math.floor(cols * (picked === 'mansion' ? 0.08 : 0.11)));
            const mY = isIndoorRock ? 1 : Math.max(2, Math.floor(rows * (picked === 'mansion' ? 0.08 : 0.11)));
            const targetRooms = Math.max(3, Math.min(11, Math.floor(((cols - mX * 2) * (rows - mY * 2)) / 42) + MB_RAND_INT(0, 2)));
            const defaultFloor = isIndoorRock ? T.flagstone : T.wood;
            const seedRoleByBiome = {
                tavern: 'tavern_hall',
                mansion: Math.random() < 0.5 ? 'foyer' : 'throne',
                dwarven: 'forge'
            };

            const useBSP = (cols >= 20 && rows >= 13 && Math.random() < (picked === 'mansion' ? 0.60 : 0.45));
            const { rooms, edges } = useBSP
                ? buildBSPBuilding({ mX, mY, targetRooms, defaultFloor, seedRole: seedRoleByBiome[picked], allowCourtyard: picked === 'mansion' })
                : buildRoomGraph({
                    mX, mY, targetRooms,
                    seedW: [Math.min(10, Math.max(7, cols - mX * 2)), Math.min(13, Math.max(8, cols - mX * 2))],
                    seedH: [Math.min(8, Math.max(6, rows - mY * 2)), Math.min(10, Math.max(7, rows - mY * 2))],
                    roomW: [5, 8], roomH: [5, 7], defaultFloor, seedRole: seedRoleByBiome[picked]
                });

            rooms.forEach(rm => {
                for (let r = rm.y1; r <= rm.y2; r++) for (let c = rm.x1; c <= rm.x2; c++) {
                    if (r === rm.y1 || r === rm.y2 || c === rm.x1 || c === rm.x2) setT(c, r, T.wall);
                }
            });
            rooms.forEach(rm => fillRect(rm.x1 + 1, rm.y1 + 1, rm.x2 - 1, rm.y2 - 1, rm.floor));

            edges.forEach(({ a, b }) => {
                if (a.x2 === b.x1 || b.x2 === a.x1) {
                    const wx = (a.x2 === b.x1) ? a.x2 : b.x2;
                    const lo = Math.max(a.y1, b.y1) + 1, hi = Math.min(a.y2, b.y2) - 1;
                    if (hi >= lo) placeDoor(wx, MB_RAND_INT(lo, hi), defaultFloor, true, P.doors);
                } else if (a.y2 === b.y1 || b.y2 === a.y1) {
                    const wy = (a.y2 === b.y1) ? a.y2 : b.y2;
                    const lo = Math.max(a.x1, b.x1) + 1, hi = Math.min(a.x2, b.x2) - 1;
                    if (hi >= lo) placeDoor(MB_RAND_INT(lo, hi), wy, defaultFloor, false, P.doors);
                }
            });

            if (!isIndoorRock) {
                // Опциональный ручей/пруд на свободной земле ДО прокладки дороги (чтобы дорога сама построила мост!)
                if (!isUrbanTavern && Math.random() < 0.35) {
                    for (let tries = 0; tries < 22; tries++) {
                        const px = MB_RAND_INT(3, cols - 4), py = MB_RAND_INT(3, rows - 4);
                        const clear = [-3, 0, 3].every(dy => [-3, 0, 3].every(dx => getT(px + dx, py + dy) === T.grass));
                        if (clear) {
                            paintBlob(px, py, MB_RAND_FLOAT(2.3, 3.6), MB_RAND_FLOAT(1.9, 3.0), T.water, 0.18, [T.grass]);
                            for (let k = 0; k < 4; k++) {
                                const wx = px + MB_RAND_FLOAT(-1.7, 1.7), wy = py + MB_RAND_FLOAT(-1.3, 1.3);
                                if (isWater(Math.floor(wx), Math.floor(wy)) && canPlace(wx, wy, 1.0)) addObj(P.waterDec, wx, wy, 0.9, MB_RAND_INT(0, 359), 0.85);
                            }
                            break;
                        }
                    }
                }

                // Входная дверь и дорога к краю карты (с авто-мостом, если на пути вода!)
                const seed = rooms[0];
                const cands = [];
                for (let c = seed.x1 + 1; c < seed.x2; c++) {
                    if (inB(c, seed.y1 - 1) && !isWall(c, seed.y1 - 1) && getT(c, seed.y1 - 1) === outdoorBase) cands.push({ c, r: seed.y1, dx: 0, dy: -1, vert: false });
                    if (inB(c, seed.y2 + 1) && !isWall(c, seed.y2 + 1) && getT(c, seed.y2 + 1) === outdoorBase) cands.push({ c, r: seed.y2, dx: 0, dy: 1, vert: false });
                }
                for (let r = seed.y1 + 1; r < seed.y2; r++) {
                    if (inB(seed.x1 - 1, r) && !isWall(seed.x1 - 1, r) && getT(seed.x1 - 1, r) === outdoorBase) cands.push({ c: seed.x1, r, dx: -1, dy: 0, vert: true });
                    if (inB(seed.x2 + 1, r) && !isWall(seed.x2 + 1, r) && getT(seed.x2 + 1, r) === outdoorBase) cands.push({ c: seed.x2, r, dx: 1, dy: 0, vert: true });
                }
                const ext = MB_PICK(cands);
                if (ext) {
                    placeDoor(ext.c, ext.r, defaultFloor, ext.vert, P.doubleDoors);
                    const roadT = isUrbanTavern ? T.flagstone : T.dirt;
                    const ex = ext.dx === -1 ? 0 : (ext.dx === 1 ? cols - 1 : ext.c);
                    const ey = ext.dy === -1 ? 0 : (ext.dy === 1 ? rows - 1 : ext.r);
                    layPathWithBridges(ext.c + ext.dx, ext.r + ext.dy, ex, ey, roadT, isUrbanTavern, 2);
                    const l1x = ext.c + ext.dx * 1.4 + (ext.vert ? 0 : -1.2) + 0.5;
                    const l1y = ext.r + ext.dy * 1.4 + (ext.vert ? -1.2 : 0) + 0.5;
                    const l2x = ext.c + ext.dx * 1.4 + (ext.vert ? 0 : 1.4) + 0.5;
                    const l2y = ext.r + ext.dy * 1.4 + (ext.vert ? 1.4 : 0) + 0.5;
                    addObj(P.lamps, l1x, l1y, 0.85, 0, 0.7);
                    addObj(P.lamps, l2x, l2y, 0.85, 0, 0.7);
                }

                // Окна в наружных стенах
                rooms.forEach(rm => {
                    if (rm.isCourtyard) return;
                    for (let k = 0; k < 2; k++) {
                        const side = MB_PICK(['N', 'S', 'E', 'W']);
                        const wc = side === 'W' ? rm.x1 : (side === 'E' ? rm.x2 : MB_RAND_INT(rm.x1 + 1, rm.x2 - 1));
                        const wr = side === 'N' ? rm.y1 : (side === 'S' ? rm.y2 : MB_RAND_INT(rm.y1 + 1, rm.y2 - 1));
                        const ox = wc + (side === 'W' ? -1 : (side === 'E' ? 1 : 0));
                        const oy = wr + (side === 'N' ? -1 : (side === 'S' ? 1 : 0));
                        if (isWall(wc, wr) && getT(ox, oy) === outdoorBase && canPlace(wc + 0.5, wr + 0.5, 1.3, true, true)) {
                            addObj(P.windows, wc + 0.5, wr + 0.5, 0.92, (side === 'W' || side === 'E') ? 90 : 0, 0.8);
                        }
                    }
                });
            }

            // Раздаём роли комнатам и наполняем
            const roleDecks = {
                tavern:  ['kitchen', 'bedroom', 'bedroom', 'cellar', 'vip_lounge', 'stable', 'bedroom', 'cellar'],
                mansion: ['dining', 'library', 'bedroom', 'parlor', 'observatory', 'bath', 'treasury', 'bedroom'],
                dwarven: ['treasury', 'dining', 'forge', 'cellar', 'crystal', 'treasury', 'bedroom']
            };
            const deck = roleDecks[picked].slice();
            rooms.forEach((rm, idx) => {
                if (idx > 0 && !rm.isCourtyard) {
                    if (rm.iw * rm.ih <= 12 && (picked === 'tavern' || picked === 'mansion')) {
                        rm.role = MB_PICK(['bedroom', 'cellar', 'bath']);
                    } else if (deck.length) {
                        rm.role = deck.splice(Math.floor(Math.random() * Math.min(3, deck.length)), 1)[0];
                    } else {
                        rm.role = MB_PICK(roleDecks[picked]);
                    }
                }
                furnishRoom(rm);
            });

            // Для дварфов: случайная подземная пещера с кристаллами и лавой или лавовый канал
            if (picked === 'dwarven' && cols >= 20 && Math.random() < 0.62) {
                const lastRm = rooms[rooms.length - 1];
                const cavX = lastRm.cx < cols / 2 ? Math.min(cols - 5, lastRm.x2 + 5) : Math.max(4, lastRm.x1 - 5);
                const cavY = Math.max(4, Math.min(rows - 5, lastRm.cy));
                paintBlob(cavX, cavY, 4.2, 3.6, T.stone, 0.22);
                let cx = Math.floor(lastRm.cx), cy = Math.floor(lastRm.cy);
                while (cx !== Math.floor(cavX)) { setT(cx, cy, T.stone); cx += (cavX > cx ? 1 : -1); }
                paintBlob(cavX + (cavX > cols / 2 ? 1.1 : -1.1), cavY, 1.6, 1.4, T.lava, 0.15);
                for (let k = 0; k < 6; k++) {
                    const px = cavX + MB_RAND_FLOAT(-3.0, 3.0), py = cavY + MB_RAND_FLOAT(-2.5, 2.5);
                    if (getT(Math.floor(px), Math.floor(py)) === T.stone && canPlace(px, py, 1.15)) {
                        addObj(k < 3 ? P.crystals : P.rocks, px, py, 0.92, MB_RAND_INT(0, 359), 1.0);
                    }
                }
            }

            // Окружение вокруг наземных зданий (двор + естественные рощи)
            if (!isIndoorRock) {
                const yardProps = isUrbanTavern
                    ? [P.carts, P.barrels, P.crates, P.lamps]
                    : (picked === 'mansion' ? [P.fountains, P.carts, P.lamps, P.flowers] : ['city_well', P.carts, P.horses, P.campfires, P.firewood]);
                yardProps.forEach(prop => {
                    for (let tries = 0; tries < 24; tries++) {
                        const px = MB_RAND_FLOAT(2, cols - 2), py = MB_RAND_FLOAT(2, rows - 2);
                        if (getT(Math.floor(px), Math.floor(py)) !== outdoorBase) continue;
                        if ([-1, 0, 1].some(dr => [-1, 0, 1].some(dc => isWall(Math.floor(px) + dc, Math.floor(py) + dr)))) continue;
                        if (!canPlace(px, py, 2.0)) continue;
                        addObj(prop, px, py, 0.94, MB_RAND_INT(0, 359), 1.65);
                        break;
                    }
                });

                if (!isUrbanTavern) {
                    const groves = Math.max(3, Math.floor((cols * rows) / 68));
                    for (let g = 0; g < groves; g++) {
                        const gx = MB_RAND_FLOAT(1.5, cols - 1.5), gy = MB_RAND_FLOAT(1.5, rows - 1.5);
                        if (getT(Math.floor(gx), Math.floor(gy)) !== T.grass) continue;
                        for (let k = 0; k < MB_RAND_INT(3, 5); k++) {
                            const ox = gx + MB_RAND_FLOAT(-2.5, 2.5), oy = gy + MB_RAND_FLOAT(-2.2, 2.2);
                            if (getT(Math.floor(ox), Math.floor(oy)) !== T.grass) continue;
                            if ([-1, 0, 1].some(dr => [-1, 0, 1].some(dc => isWall(Math.floor(ox) + dc, Math.floor(oy) + dr)))) continue;
                            if (!canPlace(ox, oy, 1.6)) continue;
                            addObj(k < 3 ? P.trees : P.bushes, ox, oy, MB_RAND_FLOAT(0.9, 1.3), MB_RAND_INT(0, 359), 1.65);
                        }
                    }
                }
            }

            const titlePools = {
                tavern:  isUrbanTavern ? ['Городской трактир «Серебряный Кубок»', 'Корчма у Площади'] : ['Трактир «Золотой Гоблин»', 'Постоялый двор «Старый Очаг»', 'Таверна «Вольный Тракт»'],
                mansion: ['Поместье аристократа', 'Особняк Министра', 'Вилла Торгового Дома', 'Залы Архимага'],
                dwarven: ['Великая Кузница Дварфов', 'Подгорные чертоги', 'Плавильный бастион', 'Рудник Самоцветов']
            };
            genTitle = MB_PICK(titlePools[picked] || ['Локация']);
        }

        const titleInp = document.getElementById('mb-map-title-inp');
        if (titleInp) titleInp.value = genTitle;

        window._mbData = data;
        SAVE_MB_DATA(data);
        RENDER_GM_MAP_BUILDER_UI();
    };
})();