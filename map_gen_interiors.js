// ================================================================
// 🏛️ ЭТАП 2: МНОГОКОМНАТНЫЕ ЖИВЫЕ ИНТЕРЬЕРЫ (ТАВЕРНА, ОСОБНЯК, ДАНЖ, ДВАРФЫ, ХРАМ)
// ================================================================
(function INSTALL_INTERIOR_GENERATORS_V2() {
    const _PREV_MB_GENERATE = MB_GENERATE_RANDOM;

    MB_GENERATE_RANDOM = function(biome) {
        const allBiomes = ['tavern', 'city', 'battlefield', 'forest', 'dungeon', 'mansion', 'dwarven', 'pirate', 'desert', 'fey', 'eastern', 'warcamp', 'snow'];
        const picked = (biome === 'random' || !biome) ? MB_PICK_NEXT_VARIANT('_global', allBiomes) : biome;

        if (!['tavern', 'mansion', 'dungeon', 'dwarven', 'eastern'].includes(picked)) {
            return _PREV_MB_GENERATE(picked);
        }

        MB_PUSH_UNDO();
        const cols = window._mbCols, rows = window._mbRows;

        const T = {
            grass:     Math.random() < 0.25 ? MB_PICK_TILE_FAMILY('moss', 'grass') : MB_PICK_TILE_FAMILY('grass', 'grass'),
            dirt:      MB_PICK_TILE_FAMILY('dirt', 'dirt'),
            stone:     MB_PICK_TILE_FAMILY('stone', 'stone'),
            flagstone: MB_PICK_TILE_FAMILY('flagstone', 'stone'),
            cobble:    Math.random() < 0.5 ? MB_PICK_TILE_FAMILY('cobble', 'flagstone') : MB_PICK_TILE_FAMILY('flagstone', 'stone'),
            wood:      MB_PICK_TILE_FAMILY('wood', 'wood'),
            woodAlt:   MB_PICK_TILE_FAMILY('wood', 'wood'),
            wall:      MB_PICK_TILE_FAMILY('wall', 'wall'),
            lava:      MB_PICK_TILE_FAMILY('lava', 'lava'),
            water:     'water',
            abyss:     'abyss',
            leafG:     'leaves_green'
        };

        const lightByBiome = {
            tavern:  MB_PICK(['tavern', 'tavern', 'sunset']),
            mansion: MB_PICK(['tavern', 'day']),
            dungeon: MB_PICK(['dungeon', 'night']),
            dwarven: 'dungeon',
            eastern: MB_PICK(['day', 'sunset'])
        };
        const baseByBiome = {
            tavern: T.grass, mansion: (cols >= 26 ? T.grass : T.wall),
            dungeon: T.wall, dwarven: T.wall, eastern: T.grass
        };

        window._mbLighting = lightByBiome[picked] || 'day';
        const data = CREATE_EMPTY_MB_DATA(baseByBiome[picked] || T.grass, cols, rows);
        data.lighting = window._mbLighting;

        const inBounds = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows;
        const getTile = (c, r) => inBounds(c, r) ? data.cells[r * cols + c].t : null;
        const setTile = (c, r, t) => { if (inBounds(c, r)) data.cells[r * cols + c].t = t; };
        const isWall = (c, r) => /^wall/.test(getTile(c, r) || '');
        const fillRect = (x1, y1, x2, y2, t) => {
            for (let r = Math.max(0, Math.floor(y1)); r <= Math.min(rows - 1, Math.floor(y2)); r++)
                for (let c = Math.max(0, Math.floor(x1)); c <= Math.min(cols - 1, Math.floor(x2)); c++) setTile(c, r, t);
        };
        const boxRoom = (x1, y1, x2, y2, floorT, wallT = T.wall) => {
            for (let r = y1; r <= y2; r++) for (let c = x1; c <= x2; c++) {
                setTile(c, r, (r === y1 || r === y2 || c === x1 || c === x2) ? wallT : floorT);
            }
        };

        const placedZones = [];
        const canPlace = (x, y, minDist = 1.0) => !placedZones.some(z => Math.hypot(z.x - x, z.y - y) < Math.max(minDist, z.r));
        const addObj = (poolOrId, x, y, scale = 1.0, rot = 0, reserveRadius = 0) => {
            const id = Array.isArray(poolOrId) ? MB_PICK(poolOrId) : poolOrId;
            if (!id) return false;
            const stObj = MB_FIND_STAMP_OBJ(id);
            if (!stObj) return false;
            if (stObj.img) MB_GET_LOADED_IMG(stObj.img);
            data.objects.push({ id, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, scale, rot });
            if (reserveRadius > 0) placedZones.push({ x, y, r: reserveRadius });
            return true;
        };

        // --- ЧИСТЫЕ ПУЛЫ РАБОЧИХ СПРАЙТОВ ---
        const P = {
            trees:       MB_GET_POOL(/^nature_tree_(large|small|big|bigger|[123])$|^nature_tree_(large|small)_[12]$/),
            bushes:      MB_GET_POOL(/^nature_bush_(2|3|4|5|6|7|8)_green|^nature_bush_shrub_|^nature_bush_[12]$|^other_fern_/),
            flowers:     MB_GET_POOL(/^nature_flower_|^nature_flowers_|^other_clovers_/),
            rocks:       MB_GET_POOL(/^nature_mossy_boulder_|^nature_rock(_small)?_[123]$|^nature_rocks_[1-5]$/),
            waterDec:    MB_GET_POOL(/^other_lily_pad|^nature_submerged_rocks_|^nature_river_rock_/),
            woodBridge:  MB_GET_POOL(/^nature_wooden_bridge_section_7x4$/),
            stoneBridge: MB_GET_POOL(/^nature_stone_bridge_section_7x4$/),

            doors:       MB_GET_POOL(/^dungeon_door_narrow_1x2$|^dungeon_door_[12]_base_2$/),
            doubleDoors: MB_GET_POOL(/^dungeon_door_wide_3x2$|^dungeon_double_door_[12]_base_2$/),
            eastDoors:   MB_GET_POOL(/^dungeon_door_shoji_[12]$/),
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
            trophies:    MB_GET_POOL(/^other_trophy_(antlers|deer|wolf_1|bear_1)$/),

            carts:       MB_GET_POOL(/^city_cart_|^city_wagon$/),
            horses:      MB_GET_POOL(/^other_horse2?$/),
            lamps:       MB_GET_POOL(/^city_woodlamp$|^other_light_stand_lit_iron$/),
            campfires:   MB_GET_POOL(/^camp_campfire(_fire|_pot_cooking)?$/),
            firewood:    MB_GET_POOL(/^other_firewood_pile$|^nature_stump_axe_chopping$/),

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

            eastMats:    MB_GET_POOL(/^furniture_tatami_mat_(large|small|round_[12])$/),
            eastTables:  MB_GET_POOL(/^furniture_table_(kotatsu|game|[1-5])$/),
            eastDecor:   MB_GET_POOL(/^other_bonsai_|^other_paper_screen_|^other_samurai_armor_[123]$|^camp_weapons_(katanas|daisho|sword_rack)$|^other_taiko_drum$|^other_vase_(large|medium)$/),
            eastFuton:   MB_GET_POOL(/^furniture_futon_bed$|^other_cushion_[1-4]$/),
            eastLights:  MB_GET_POOL(/^city_paper_lamp$|^other_paper_lantern_[123]$/)
        };

        // --- ПОМОЩНИКИ ДЛЯ АККУРАТНОЙ АРХИТЕКТУРЫ ---
        const placeDoor = (c, r, floorT, verticalWall, pool = P.doors) => {
            setTile(c, r, floorT);
            addObj(pool, c + 0.5, r + 0.5, 0.92, verticalWall ? 90 : 0, 1.15);
        };

        // Мост, который ГАРАНТИРОВАННО соединяет оба берега без обрывов в воде!
        const placeBridgeH = (xStart, xEnd, yCenter, isStone = false) => {
            const span = (xEnd - xStart + 1) + 1.3;
            const pool = isStone ? P.stoneBridge : P.woodBridge;
            const count = Math.max(1, Math.ceil(span / 3.4));
            const segLen = span / count;
            const scale = Math.max(0.75, segLen / 3.55);
            for (let i = 0; i < count; i++) {
                const bx = (xStart - 0.65) + segLen * (i + 0.5);
                addObj(pool, bx, yCenter, scale, 0, 1.6);
            }
        };

        const placeBridgeV = (xCenter, yStart, yEnd, isStone = false) => {
            const span = (yEnd - yStart + 1) + 1.3;
            const pool = isStone ? P.stoneBridge : P.woodBridge;
            const count = Math.max(1, Math.ceil(span / 3.4));
            const segLen = span / count;
            const scale = Math.max(0.75, segLen / 3.55);
            for (let i = 0; i < count; i++) {
                const by = (yStart - 0.65) + segLen * (i + 0.5);
                addObj(pool, xCenter, by, scale, 90, 1.6);
            }
        };

        const placeTableGroup = (cx, cy, isLong = false) => {
            if (!canPlace(cx, cy, isLong ? 2.1 : 1.8)) return;
            addObj(isLong ? P.tavLongTbl : P.tavTables, cx, cy, isLong ? 1.0 : MB_RAND_FLOAT(0.86, 0.98), isLong ? 0 : MB_PICK([0, 90]), isLong ? 1.85 : 1.55);
            addObj(P.tavChairs, cx, cy - 0.85, 0.78, 180, 0);
            addObj(P.tavChairs, cx, cy + 0.85, 0.78, 0, 0);
            if (isLong) {
                addObj(P.tavChairs, cx - 0.85, cy - 0.85, 0.78, 180, 0);
                addObj(P.tavChairs, cx + 0.85, cy + 0.85, 0.78, 0, 0);
            } else {
                if (Math.random() < 0.75) addObj(P.tavChairs, cx - 0.85, cy, 0.78, 90, 0);
                if (Math.random() < 0.75) addObj(P.tavChairs, cx + 0.85, cy, 0.78, 270, 0);
            }
            if (Math.random() < 0.85) addObj(P.food, cx - 0.16, cy + 0.05, 0.62, MB_RAND_INT(0, 359), 0);
            if (Math.random() < 0.78) addObj(P.candles, cx + 0.28, cy - 0.08, 0.60, 0, 0);
        };

        const placeBar = (bx, y1, y2, faceLeft = true) => {
            for (let y = y1; y <= y2; y += 1.05) {
                addObj(P.barStraight, bx, y, 0.92, 90, 0.85);
                addObj(P.tavStools, bx + (faceLeft ? -0.98 : 0.98), y, 0.75, 0, 0.45);
                if (Math.random() < 0.8) addObj(P.barrels, bx + (faceLeft ? 0.98 : -0.98), y, 0.78, MB_RAND_INT(0, 359), 0.45);
            }
            addObj(P.candles, bx, y1 + 0.3, 0.62, 0, 0);
            addObj(P.food, bx, (y1 + y2) / 2, 0.60, 0, 0);
        };

        const furnishBedroom = (x1, y1, x2, y2) => {
            const w = x2 - x1 - 1, h = y2 - y1 - 1;
            if (w < 2 || h < 2) return;
            const cx = (x1 + x2 + 1) / 2, cy = (y1 + y2 + 1) / 2;
            addObj(P.rugs, cx, cy, Math.min(1.05, Math.min(w, h) * 0.28), 0, 0);
            addObj(P.beds, x2 - 0.85, y1 + 1.45, 0.92, 270, 1.2);
            if (w >= 4 && h >= 4 && Math.random() < 0.45) {
                addObj(P.beds, x2 - 0.85, y2 - 0.85, 0.9, 270, 1.1);
            }
            addObj(P.shelves, x1 + 1.35, y1 + 1.15, 0.82, 0, 0.8);
            addObj(P.candles, x2 - 1.75, y1 + 1.15, 0.58, 0, 0);
            if (w >= 4 && h >= 3 && canPlace(x1 + 1.6, y2 - 0.9, 1.1)) {
                addObj(P.tavTables, x1 + 1.6, y2 - 0.9, 0.72, 0, 0.9);
            }
        };

        const furnishKitchen = (x1, y1, x2, y2) => {
            const w = x2 - x1 - 1, h = y2 - y1 - 1;
            if (w < 3 || h < 3) return;
            const cx = (x1 + x2 + 1) / 2, cy = (y1 + y2 + 1) / 2;
            fillRect(x1 + 1, y1 + 1, x2 - 1, y2 - 1, T.flagstone);
            addObj(P.fireplaces, cx, y1 + 1.25, 1.0, 0, 1.2);
            addObj(P.tavLongTbl, cx, cy + 0.3, 0.88, 0, 1.3);
            addObj(P.kitchenProp, cx - 0.3, cy + 0.3, 0.65, MB_RAND_INT(0, 359), 0);
            addObj(P.food, cx + 0.35, cy + 0.3, 0.60, MB_RAND_INT(0, 359), 0);
            addObj(P.barrels, x1 + 1.35, y1 + 1.35, 0.8, 0, 0.7);
            addObj(P.crates, x2 - 0.85, y2 - 0.85, 0.82, 15, 0.7);
            addObj(P.shelves, x1 + 1.4, y2 - 0.8, 0.82, 180, 0.7);
            addObj(P.candles, cx + 1.2, y1 + 1.3, 0.62, 0, 0);
        };

        const scatterYardForest = (avoidTileSet) => {
            for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
                const t = getTile(c, r);
                if (avoidTileSet.includes(t) || t !== T.grass) continue;
                const nearWall = [-1, 0, 1].some(dr => [-1, 0, 1].some(dc => isWall(c + dc, r + dr)));
                if (nearWall || !canPlace(c + 0.5, r + 0.5, 1.65)) continue;
                const rnd = Math.random();
                if (rnd < 0.19) addObj(P.trees, c + MB_RAND_FLOAT(0.25, 0.75), r + MB_RAND_FLOAT(0.25, 0.75), MB_RAND_FLOAT(0.9, 1.3), MB_RAND_INT(0, 359), 1.75);
                else if (rnd < 0.30) addObj(P.bushes, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.75, 1.1), MB_RAND_INT(0, 359), 1.0);
                else if (rnd < 0.35) addObj(P.flowers, c + 0.5, r + 0.5, 0.85, MB_RAND_INT(0, 359), 0.7);
                else if (rnd < 0.38) addObj(P.rocks, c + 0.5, r + 0.5, 0.9, MB_RAND_INT(0, 359), 1.0);
            }
        };

        let genTitle = 'Локация';

        // ============================================================
        // 1. 🍺 ТАВЕРНА / ПОСТОЯЛЫЙ ДВОР (4 МНОГОКОМНАТНЫЕ СХЕМЫ БЕЗ АНГАРОВ!)
        // ============================================================
        if (picked === 'tavern') {
            const variant = MB_PICK_NEXT_VARIANT('tavern', ['roadside_inn', 'courtyard_inn', 'river_tavern', 'guild_pub']);

            if (variant === 'roadside_inn') {
                genTitle = MB_PICK(['Трактир «Золотой Гоблин»', 'Постоялый двор «Старый Очаг»', 'Таверна на Тракте']);
                // Компактное реалистичное здание, даже если холст огромный 42×26!
                const bw = Math.min(cols - 4, Math.max(12, Math.min(24, Math.floor(cols * 0.64))));
                const bh = Math.min(rows - 3, Math.max(8, Math.min(16, Math.floor(rows * 0.68))));
                const x1 = Math.floor((cols - bw) / 2), y1 = Math.max(1, Math.floor((rows - bh) / 2) - 1);
                const x2 = x1 + bw - 1, y2 = y1 + bh - 1;

                // Дорога к таверне и площадка перед входом
                const roadY = Math.min(rows - 2, y2 + 2);
                fillRect(0, roadY - 1, cols - 1, roadY, T.dirt);
                const mainDoorX = x1 + Math.floor(bw * 0.34);
                fillRect(mainDoorX - 1, y2, mainDoorX + 1, roadY, T.cobble);

                boxRoom(x1, y1, x2, y2, T.wood, T.wall);

                // Делим здание: слева — уютный общий зал + кухня сверху; справа — крыло спален с коридором
                const hallRight = x1 + Math.max(7, Math.floor(bw * 0.58));
                for (let r = y1 + 1; r < y2; r++) setTile(hallRight, r, T.wall);

                // Кухня в верхнем левом углу, если хватает высоты
                let hallTop = y1;
                if (bh >= 12) {
                    const kitY = y1 + 5;
                    for (let c = x1 + 1; c < hallRight; c++) setTile(c, kitY, T.wall);
                    furnishKitchen(x1, y1, hallRight, kitY);
                    placeDoor(hallRight - 2, kitY, T.wood, false);
                    hallTop = kitY;
                }

                // Вход в общий зал и окна
                placeDoor(mainDoorX, y2, T.wood, false, P.doubleDoors);
                addObj(P.windows, x1 + 2.5, y2 + 0.5, 0.95, 0, 0);
                addObj(P.windows, hallRight - 2.5, y2 + 0.5, 0.95, 0, 0);
                addObj(P.lamps, mainDoorX - 1.4, y2 + 1.3, 0.85, 0, 0.7);
                addObj(P.lamps, mainDoorX + 1.6, y2 + 1.3, 0.85, 0, 0.7);

                // Интерьер общего зала (камин, ковёр, люстры, барная стойка, живые островки столиков)
                const hMidY = (hallTop + y2 + 1) / 2;
                addObj(P.fireplaces, x1 + 1.3, hMidY, 1.05, 90, 1.4);
                addObj(P.rugs, x1 + 3.2, hMidY, 1.15, 0, 0);
                addObj(P.chandeliers, (x1 + hallRight) / 2, hMidY, 1.0, 0, 0);
                placeBar(hallRight - 1.6, hallTop + 2.1, Math.min(y2 - 2.1, hallTop + 5.4), true);

                // Разнообразная расстановка столов (без марширующей сетки)
                const tableSpots = [
                    { x: x1 + 3.6, y: hallTop + 2.2, long: false },
                    { x: x1 + 3.8, y: y2 - 1.7, long: false },
                    { x: hallRight - 4.4, y: hallTop + 2.3, long: true },
                    { x: hallRight - 4.4, y: y2 - 1.9, long: false },
                    { x: (x1 + hallRight) / 2 - 0.5, y: hMidY, long: true }
                ];
                tableSpots.forEach(pt => {
                    if (pt.x > x1 + 2.0 && pt.x < hallRight - 2.6 && pt.y > hallTop + 1.5 && pt.y < y2 - 1.3) {
                        placeTableGroup(pt.x + MB_RAND_FLOAT(-0.25, 0.25), pt.y + MB_RAND_FLOAT(-0.2, 0.2), pt.long);
                    }
                });

                // Правое крыло: коридор + 2–3 уютных номера + лестница на 2-й этаж
                const hallDoorY = Math.floor((hallTop + y2) / 2);
                placeDoor(hallRight, hallDoorY, T.wood, true);
                const roomsCount = bh >= 13 ? 3 : 2;
                const roomH = Math.floor((y2 - y1) / roomsCount);
                for (let i = 0; i < roomsCount; i++) {
                    const ry1 = y1 + i * roomH;
                    const ry2 = (i === roomsCount - 1) ? y2 : (ry1 + roomH);
                    if (i > 0) for (let c = hallRight + 2; c < x2; c++) setTile(c, ry1, T.wall);
                    // Коридор вдоль стены hallRight+1..hallRight+2
                    if (x2 - hallRight >= 7) {
                        const corrX = hallRight + 2;
                        for (let r = ry1 + 1; r < ry2; r++) setTile(corrX, r, T.wall);
                        placeDoor(corrX, Math.floor((ry1 + ry2) / 2), T.wood, true);
                        furnishBedroom(corrX, ry1, x2, ry2);
                    } else {
                        furnishBedroom(hallRight, ry1, x2, ry2);
                    }
                }
                if (x2 - hallRight >= 7) {
                    addObj(P.woodStairs, hallRight + 1.5, y1 + 1.8, 0.78, 0, 1.1);
                }

                // Живой двор снаружи (колодец, повозка, лошади, костёр, дрова, деревья)
                if (x1 >= 4) {
                    addObj('city_well', x1 - 2.2, y2 - 1.5, 1.05, 0, 1.5);
                    addObj(P.firewood, x1 - 2.0, y1 + 2.2, 0.9, 15, 1.0);
                }
                if (cols - 1 - x2 >= 4) {
                    addObj(P.carts, x2 + 2.5, roadY - 1.4, 1.0, 10, 1.8);
                    addObj(P.horses, x2 + 2.8, y1 + 3.0, 0.95, 180, 1.2);
                    addObj(P.campfires, x2 + 3.0, y2 - 1.5, 1.0, 0, 1.4);
                }
                scatterYardForest([T.dirt, T.cobble, T.wood, T.flagstone, T.wall]);
            }
            else if (variant === 'courtyard_inn') {
                genTitle = MB_PICK(['Постоялый двор с конюшней', 'Подворье «Вольный Тракт»', 'Застава-корчма']);
                const bw = Math.min(cols - 4, Math.max(14, Math.min(28, Math.floor(cols * 0.72))));
                const bh = Math.min(rows - 3, Math.max(9, Math.min(18, Math.floor(rows * 0.74))));
                const x1 = Math.floor((cols - bw) / 2), y1 = Math.floor((rows - bh) / 2);
                const x2 = x1 + bw - 1, y2 = y1 + bh - 1;
                const splitY = y1 + Math.max(5, Math.floor(bh * 0.52));
                const stabX = x2 - Math.max(5, Math.floor(bw * 0.30));

                // Внутренний мощёный двор (снизу слева) + подъездная дорога
                fillRect(x1 + 1, splitY + 1, stabX - 1, y2, T.cobble);
                fillRect(Math.floor((x1 + stabX) / 2) - 1, y2, Math.floor((x1 + stabX) / 2) + 1, rows - 1, T.dirt);

                // Главное здание сверху (делим на Зал + Кухню/Спальню)
                boxRoom(x1, y1, x2, splitY, T.wood, T.wall);
                const divX = x1 + Math.floor(bw * 0.64);
                for (let r = y1 + 1; r < splitY; r++) setTile(divX, r, T.wall);
                placeDoor(divX, Math.floor((y1 + splitY) / 2), T.wood, true);

                // Конюшня справа
                boxRoom(stabX, splitY, x2, y2, T.dirt, T.wall);
                placeDoor(stabX, Math.floor((splitY + y2) / 2), T.dirt, true, P.doubleDoors);

                // Вход в зал из двора
                const doorX = Math.floor((x1 + divX) / 2);
                placeDoor(doorX, splitY, T.wood, false, P.doubleDoors);
                addObj(P.windows, x1 + 3.0, splitY + 0.5, 0.95, 0, 0);
                addObj(P.windows, divX + 2.5, splitY + 0.5, 0.95, 0, 0);

                // Интерьер зала
                addObj(P.fireplaces, doorX + 0.5, y1 + 1.3, 1.05, 0, 1.4);
                addObj(P.rugs, doorX + 0.5, (y1 + splitY) / 2, 1.2, 0, 0);
                addObj(P.chandeliers, doorX + 0.5, (y1 + splitY) / 2, 1.0, 0, 0);
                placeBar(x1 + 2.1, y1 + 2.0, Math.min(splitY - 1.8, y1 + 5.2), false);
                for (let c = x1 + 5.2; c <= divX - 2.2; c += 3.6) {
                    placeTableGroup(c, Math.floor((y1 + splitY) / 2) + 0.6, true);
                }

                // Правая верхняя комната — кухня или спальня
                if (Math.random() < 0.5) furnishKitchen(divX, y1, x2, splitY);
                else furnishBedroom(divX, y1, x2, splitY);

                // Конюшня + двор
                addObj(P.horses, x2 - 1.6, splitY + 1.9, 0.98, 270, 1.2);
                if (y2 - splitY >= 5) addObj(P.horses, x2 - 1.6, y2 - 1.6, 0.98, 270, 1.2);
                addObj(P.crates, stabX + 1.5, y2 - 1.3, 0.85, 10, 0.8);
                addObj(P.barrels, stabX + 1.5, splitY + 1.5, 0.85, 0, 0.8);

                addObj('city_well', x1 + 2.5, y2 - 1.5, 1.05, 0, 1.5);
                addObj(P.carts, Math.min(stabX - 2.2, doorX + 1.2), y2 - 1.6, 1.0, -15, 1.8);
                addObj(P.lamps, doorX - 1.6, splitY + 1.3, 0.82, 0, 0.7);
                addObj(P.lamps, stabX - 1.2, splitY + 1.4, 0.82, 0, 0.7);
                scatterYardForest([T.dirt, T.cobble, T.wood, T.flagstone, T.wall]);
            }
            else if (variant === 'river_tavern') {
                genTitle = MB_PICK(['Лесная корчма у реки', 'Таверна «У Брода»', 'Речной постоялый двор']);
                // Извилистая река справа с настоящим мостом от берега до берега!
                let rx = Math.max(12, Math.floor(cols * 0.72));
                const rW = cols >= 28 ? 4 : 3;
                const riverCols = [];
                for (let r = 0; r < rows; r++) {
                    if (r % 3 === 0 && Math.random() < 0.6) rx = Math.max(Math.floor(cols * 0.62), Math.min(cols - rW - 2, rx + MB_RAND_INT(-1, 1)));
                    riverCols[r] = rx;
                    for (let w = 0; w < rW; w++) setTile(rx + w, r, T.water);
                }

                const bw = Math.min(rx - 4, Math.max(10, Math.min(20, Math.floor(cols * 0.48))));
                const bh = Math.min(rows - 4, Math.max(8, Math.min(15, Math.floor(rows * 0.68))));
                const x1 = Math.max(2, Math.floor((rx - bw) / 2) - 1), y1 = Math.floor((rows - bh) / 2);
                const x2 = x1 + bw - 1, y2 = y1 + bh - 1;
                const midY = Math.floor((y1 + y2) / 2);

                // Тропа от таверны через мост на другой берег
                fillRect(x2, midY - 1, cols - 1, midY, T.dirt);
                for (let r = midY - 1; r <= midY; r++) for (let w = 0; w < rW; w++) setTile(riverCols[r] + w, r, T.water);
                const bLeft = Math.min(riverCols[midY - 1], riverCols[midY]);
                const bRight = Math.max(riverCols[midY - 1], riverCols[midY]) + rW - 1;
                placeBridgeH(bLeft, bRight, midY, false);

                // Само здание (зал + боковая комната)
                boxRoom(x1, y1, x2, y2, T.wood, T.wall);
                placeDoor(x2, midY, T.wood, true, P.doubleDoors);
                const splitX = x1 + Math.max(5, Math.floor(bw * 0.36));
                if (bw >= 13) {
                    for (let r = y1 + 1; r < y2; r++) setTile(splitX, r, T.wall);
                    const subY = Math.floor((y1 + y2) / 2);
                    for (let c = x1 + 1; c < splitX; c++) setTile(c, subY, T.wall);
                    placeDoor(splitX, Math.floor((y1 + subY) / 2), T.wood, true);
                    placeDoor(splitX, Math.floor((subY + y2) / 2), T.wood, true);
                    furnishKitchen(x1, y1, splitX, subY);
                    furnishBedroom(x1, subY, splitX, y2);
                }

                const hallL = bw >= 13 ? splitX : x1;
                addObj(P.fireplaces, (hallL + x2 + 1) / 2, y1 + 1.3, 1.05, 0, 1.4);
                addObj(P.rugs, (hallL + x2 + 1) / 2, midY + 0.5, 1.15, 0, 0);
                addObj(P.chandeliers, (hallL + x2 + 1) / 2, midY + 0.5, 0.95, 0, 0);
                placeBar(hallL + 1.9, y1 + 2.2, Math.min(y2 - 2.0, y1 + 5.2), false);
                placeTableGroup(x2 - 2.4, y1 + 2.8, false);
                placeTableGroup(x2 - 2.4, y2 - 2.2, false);
                if (x2 - hallL >= 9) placeTableGroup((hallL + x2) / 2 + 0.5, y2 - 2.0, true);

                // Летний столик и костёр у реки + декор воды
                if (bLeft - x2 >= 4) {
                    addObj(P.lamps, x2 + 1.3, midY - 1.5, 0.85, 0, 0.7);
                    addObj(P.campfires, x2 + 2.2, y1 + 1.8, 0.95, 0, 1.3);
                }
                for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
                    if (getTile(c, r) === T.water && canPlace(c + 0.5, r + 0.5, 1.6) && Math.random() < 0.14) {
                        addObj(P.waterDec, c + 0.5, r + 0.5, 0.9, MB_RAND_INT(0, 359), 0.9);
                    }
                }
                scatterYardForest([T.dirt, T.water, T.wood, T.flagstone, T.wall]);
            }
            else {
                genTitle = MB_PICK(['Городской трактир «Серебряный Кубок»', 'Игорный дом и винный зал', 'Таверна у Площади']);
                fillRect(0, 0, cols - 1, rows - 1, T.cobble);
                const bw = Math.min(cols - 4, Math.max(12, Math.min(28, Math.floor(cols * 0.76))));
                const bh = Math.min(rows - 4, Math.max(8, Math.min(17, Math.floor(rows * 0.72))));
                const x1 = Math.floor((cols - bw) / 2), y1 = Math.max(1, Math.floor((rows - bh) / 2) - 1);
                const x2 = x1 + bw - 1, y2 = y1 + bh - 1;

                boxRoom(x1, y1, x2, y2, T.wood, T.wall);
                const doorX = Math.floor((x1 + x2) / 2);
                placeDoor(doorX, y2, T.wood, false, P.doubleDoors);
                addObj(P.lamps, doorX - 2.0, y2 + 1.4, 0.88, 0, 0.8);
                addObj(P.lamps, doorX + 2.2, y2 + 1.4, 0.88, 0, 0.8);
                addObj(P.carts, Math.max(2.5, x1 + 2.5), Math.min(rows - 1.5, y2 + 2.1), 0.95, 0, 1.6);

                // 3 тематические зоны: слева — Игорный салон, центр — Зал с баром, справа — Винный погреб + Кухня
                const leftDiv = x1 + Math.max(5, Math.floor(bw * 0.30));
                const rightDiv = x2 - Math.max(5, Math.floor(bw * 0.26));
                for (let r = y1 + 1; r < y2; r++) {
                    if (bw >= 18) setTile(leftDiv, r, T.wall);
                    setTile(rightDiv, r, T.wall);
                }
                const midY = Math.floor((y1 + y2) / 2);
                if (bw >= 18) {
                    placeDoor(leftDiv, midY, T.wood, true, P.doubleDoors);
                    // Игорный салон слева (бильярд, рояль, диваны, камин)
                    addObj(P.rugs, (x1 + leftDiv) / 2 + 0.5, midY + 0.5, 1.25, 0, 0);
                    addObj('furniture_feature_billiards_table', (x1 + leftDiv) / 2 + 0.5, midY + 0.5, 1.0, 0, 1.7);
                    addObj('furniture_feature_piano_1_a', x1 + 2.0, y1 + 2.0, 0.95, 0, 1.4);
                    addObj(P.manSofas, x1 + 2.2, y2 - 1.6, 0.9, 180, 1.1);
                    addObj(P.chandeliers, (x1 + leftDiv) / 2 + 0.5, midY + 0.5, 0.9, 0, 0);
                }

                // Центральный зал
                const cL = bw >= 18 ? leftDiv : x1;
                addObj(P.fireplaces, (cL + rightDiv) / 2, y1 + 1.3, 1.05, 0, 1.4);
                addObj(P.rugs, (cL + rightDiv) / 2, midY + 0.5, 1.25, 0, 0);
                addObj(P.chandeliers, (cL + rightDiv) / 2, midY + 0.5, 1.05, 0, 0);
                placeBar(rightDiv - 1.6, y1 + 2.4, Math.min(y2 - 2.2, y1 + 6.0), true);
                placeTableGroup(cL + 2.6, y1 + 3.0, false);
                placeTableGroup(cL + 2.6, y2 - 2.2, false);
                if (rightDiv - cL >= 10) placeTableGroup((cL + rightDiv) / 2 - 0.3, midY + 0.4, true);

                // Правое крыло: винный зал с рядами бочек + кухня
                placeDoor(rightDiv, y1 + 2, T.wood, true);
                if (bh >= 11) {
                    for (let c = rightDiv + 1; c < x2; c++) setTile(c, midY, T.wall);
                    placeDoor(rightDiv, y2 - 2, T.wood, true);
                    furnishKitchen(rightDiv, y1, x2, midY);
                    fillRect(rightDiv + 1, midY + 1, x2 - 1, y2 - 1, T.stone);
                    for (let r = midY + 2; r < y2; r += 1.4) {
                        addObj(P.barrels, x2 - 1.1, r, 0.85, MB_RAND_INT(0, 359), 0.7);
                        addObj(P.crates, rightDiv + 1.6, r, 0.82, 10, 0.7);
                    }
                    addObj(P.candles, (rightDiv + x2) / 2, midY + 1.6, 0.65, 0, 0);
                } else {
                    furnishKitchen(rightDiv, y1, x2, y2);
                }
            }
            MB_APPLY_RANDOM_MIRROR(data, true, false);
        }

        // ============================================================
        // 2. 🏛️ БОГАТЫЙ ОСОБНЯК (3 МНОГОКОМНАТНЫЕ СХЕМЫ, НИКАКИХ ПУСТЫХ ЗАЛОВ!)
        // ============================================================
        else if (picked === 'mansion') {
            const variant = MB_PICK_NEXT_VARIANT('mansion', ['noble_manor', 'throne_palace', 'arcane_observatory']);
            const padX = cols >= 28 ? 4 : 1;
            const padY = rows >= 18 ? 3 : 1;
            const x1 = padX, x2 = cols - 1 - padX, y1 = padY, y2 = rows - 1 - padY;
            const bw = x2 - x1 + 1, bh = y2 - y1 + 1;
            const midX = Math.floor((x1 + x2) / 2), midY = Math.floor((y1 + y2) / 2);

            if (variant === 'noble_manor') {
                genTitle = MB_PICK(['Поместье аристократа', 'Особняк Торгового дома', 'Вилла Лорда']);
                boxRoom(x1, y1, x2, y2, T.wood, T.wall);
                // Делим особняк на 4 полноценные комнаты вокруг центрального холла
                const hallL = Math.max(x1 + 5, midX - Math.max(3, Math.floor(bw * 0.16)));
                const hallR = Math.min(x2 - 5, midX + Math.max(3, Math.floor(bw * 0.16)));
                for (let r = y1 + 1; r < y2; r++) { setTile(hallL, r, T.wall); setTile(hallR, r, T.wall); }
                for (let c = x1 + 1; c < hallL; c++) setTile(c, midY, T.wall);
                for (let c = hallR + 1; c < x2; c++) setTile(c, midY, T.wall);

                // Центральный мраморный/каменный парадный холл
                fillRect(hallL + 1, y1 + 1, hallR - 1, y2 - 1, T.flagstone);
                placeDoor(midX, y2, T.flagstone, false, P.doubleDoors);
                if (padY >= 2) fillRect(midX - 1, y2 + 1, midX + 1, rows - 1, T.cobble);
                for (let r = y1 + 2.5; r < y2 - 1.5; r += 2.6) addObj(P.rugs, midX + 0.5, r, 1.1, 90, 0);
                addObj(P.chandeliers, midX + 0.5, midY + 0.5, 1.1, 0, 0);
                addObj(P.stoneStairs, midX + 0.5, y1 + 2.0, 0.95, 0, 1.5);
                addObj('other_feature_suit_of_armor_2_gold', hallL + 1.3, y2 - 1.5, 0.85, 90, 0.8);
                addObj('other_feature_suit_of_armor_1_silver', hallR - 0.3, y2 - 1.5, 0.85, 270, 0.8);

                // Двери во все 4 крыла
                placeDoor(hallL, Math.floor((y1 + midY) / 2), T.wood, true);
                placeDoor(hallL, Math.floor((midY + y2) / 2), T.wood, true);
                placeDoor(hallR, Math.floor((y1 + midY) / 2), T.wood, true);
                placeDoor(hallR, Math.floor((midY + y2) / 2), T.wood, true);

                // 1) Верх-лево: Парадная столовая
                addObj(P.rugs, (x1 + hallL) / 2 + 0.5, (y1 + midY) / 2 + 0.5, 1.15, 0, 0);
                placeTableGroup((x1 + hallL) / 2 + 0.5, (y1 + midY) / 2 + 0.5, true);
                addObj(P.fireplaces, (x1 + hallL) / 2 + 0.5, y1 + 1.25, 1.0, 0, 1.2);
                addObj(P.chandeliers, (x1 + hallL) / 2 + 0.5, (y1 + midY) / 2 + 0.5, 0.9, 0, 0);

                // 2) Низ-лево: Музыкальная гостиная / Игровая
                const glX = (x1 + hallL) / 2 + 0.5, glY = (midY + y2) / 2 + 0.5;
                addObj(P.rugs, glX, glY, 1.15, 0, 0);
                addObj(P.manLuxury, glX, glY, 0.98, 0, 1.5);
                addObj(P.manSofas, x1 + 1.8, glY, 0.92, 90, 1.1);
                addObj(P.candles, x1 + 1.6, midY + 1.5, 0.65, 0, 0);
                addObj(P.manCats, glX + 1.4, glY + 1.1, 0.78, 30, 0);

                // 3) Верх-право: Хозяйская спальня и купальня
                furnishBedroom(hallR, y1, x2, midY);
                if (x2 - hallR >= 6) addObj(P.manBath, hallR + 1.8, midY - 1.2, 0.92, 0, 1.1);

                // 4) Низ-право: Библиотека и кабинет
                const libX = (hallR + x2) / 2 + 0.5, libY = (midY + y2) / 2 + 0.5;
                addObj(P.rugs, libX, libY, 1.1, 0, 0);
                for (let c = hallR + 2; c <= x2 - 2; c += 2.2) addObj(P.manBooks, c, y2 - 1.1, 0.9, 180, 0.9);
                addObj('furniture_table_writing_desk_dark', libX, libY, 0.95, 0, 1.3);
                addObj(P.manSofas, libX, libY - 1.1, 0.85, 0, 0.8);
                addObj(P.candles, libX + 0.5, libY, 0.6, 0, 0);
            }
            else if (variant === 'throne_palace') {
                genTitle = MB_PICK(['Тронный зал Министра', 'Дворец Империи', 'Зал Приёмов']);
                boxRoom(x1, y1, x2, y2, T.flagstone, T.wall);
                const sideH = Math.max(4, Math.floor(bh * 0.28));
                const hallY1 = bh >= 14 ? y1 + sideH : y1;
                const hallY2 = bh >= 14 ? y2 - sideH : y2;

                // Боковые залы (Совет сверху, Оружейная/Казна снизу), если карта высокая
                if (bh >= 14) {
                    for (let c = x1 + 1; c < x2; c++) { setTile(c, hallY1, T.wall); setTile(c, hallY2, T.wall); }
                    placeDoor(midX, hallY1, T.wood, false, P.doubleDoors);
                    placeDoor(midX, hallY2, T.flagstone, false, P.doubleDoors);
                    // Зал Совета сверху
                    fillRect(x1 + 1, y1 + 1, x2 - 1, hallY1 - 1, T.wood);
                    placeTableGroup(midX + 0.5, (y1 + hallY1) / 2 + 0.5, true);
                    if (bw >= 18) {
                        placeTableGroup(x1 + 4.5, (y1 + hallY1) / 2 + 0.5, false);
                        addObj(P.manBooks, x2 - 2.5, y1 + 1.5, 0.95, 0, 1.0);
                    }
                    addObj(P.chandeliers, midX + 0.5, (y1 + hallY1) / 2 + 0.5, 0.95, 0, 0);
                    // Казна и гвардия снизу
                    for (let c = x1 + 3; c <= x2 - 3; c += 4) {
                        addObj(Math.random() < 0.5 ? P.chests : P.manLuxury, c, (hallY2 + y2) / 2 + 0.5, 0.92, 0, 1.1);
                    }
                    addObj(P.braziers, x1 + 2.0, y2 - 1.5, 0.85, 0, 0.7);
                    addObj(P.braziers, x2 - 2.0, y2 - 1.5, 0.85, 0, 0.7);
                }

                // Главный тронный зал по центру
                placeDoor(x1, midY, T.flagstone, true, P.doubleDoors);
                for (let c = x1 + 2.5; c <= x2 - 3.5; c += 2.6) addObj(P.rugs, c, midY + 0.5, 1.18, 0, 0);
                addObj('furniture_chair_throne_stone', x2 - 2.2, midY + 0.5, 1.25, 270, 1.7);
                addObj(P.braziers, x2 - 2.2, midY - 1.6, 0.85, 0, 0.8);
                addObj(P.braziers, x2 - 2.2, midY + 2.6, 0.85, 0, 0);
                for (let c = x1 + 4; c <= x2 - 5; c += 4.2) {
                    addObj(P.pillars, c, hallY1 + 1.7, 0.95, 0, 0.9);
                    addObj(P.pillars, c, hallY2 - 1.7, 0.95, 0, 0.9);
                    addObj(P.chandeliers, c, midY + 0.5, 1.0, 0, 0);
                }
            }
            else {
                genTitle = MB_PICK(['Башня и библиотека архимага', 'Обсерватория Древа', 'Залы чародея']);
                boxRoom(x1, y1, x2, y2, T.wood, T.wall);
                const splitL = x1 + Math.max(5, Math.floor(bw * 0.30));
                const splitR = x2 - Math.max(5, Math.floor(bw * 0.30));
                for (let r = y1 + 1; r < y2; r++) { setTile(splitL, r, T.wall); setTile(splitR, r, T.wall); }
                placeDoor(splitL, midY, T.wood, true);
                placeDoor(splitR, midY, T.wood, true);
                placeDoor(midX, y2, T.flagstone, false, P.doubleDoors);

                // Центр: Зал Обсерватории с планетарием, кристаллами и звёздным полом
                fillRect(splitL + 1, y1 + 1, splitR - 1, y2 - 1, T.flagstone);
                addObj(P.rugs, midX + 0.5, midY + 0.5, 1.35, 0, 0);
                addObj('other_feature_orrery_huge_gold', midX + 0.5, midY + 0.5, 1.15, 0, 1.9);
                addObj(P.crystals, splitL + 1.8, y1 + 1.8, 0.9, 0, 0.9);
                addObj(P.crystals, splitR - 0.8, y1 + 1.8, 0.9, 0, 0.9);
                addObj(P.crystals, splitL + 1.8, y2 - 1.2, 0.9, 0, 0.9);
                addObj(P.crystals, splitR - 0.8, y2 - 1.2, 0.9, 0, 0.9);

                // Левое крыло: плотная библиотека
                for (let r = y1 + 2.2; r <= y2 - 1.8; r += 2.8) {
                    addObj(P.manBooks, x1 + 1.8, r, 0.95, 90, 1.0);
                    if (splitL - x1 >= 7) addObj(P.manBooks, splitL - 1.4, r, 0.95, 270, 1.0);
                }
                addObj('furniture_table_writing_desk_dark', (x1 + splitL) / 2 + 0.5, midY + 0.5, 0.95, 0, 1.2);
                addObj(P.candles, (x1 + splitL) / 2 + 0.8, midY + 0.5, 0.65, 0, 0);

                // Правое крыло: лаборатория + покои мага
                for (let c = splitR + 1; c < x2; c++) setTile(c, midY, T.wall);
                placeDoor(splitR + 2, midY, T.wood, false);
                furnishBedroom(splitR, y1, x2, midY);
                const labX = (splitR + x2) / 2 + 0.5, labY = (midY + y2) / 2 + 0.5;
                addObj(P.tavTables, labX, labY, 0.95, 0, 1.2);
                addObj(P.kitchenProp, labX - 0.4, labY, 0.72, 0, 0);
                addObj(P.candles, labX + 0.4, labY, 0.65, 0, 0);
                addObj(P.shelves, x2 - 1.3, y2 - 1.3, 0.9, 180, 0.9);
            }

            if (padX >= 3) scatterYardForest([T.cobble, T.wood, T.flagstone, T.wall]);
            MB_APPLY_RANDOM_MIRROR(data, true, false);
        }

        // ============================================================
        // 3. 🏰 ПОДЗЕМЕЛЬЕ / КАТАКОМБЫ (3 НАСЫЩЕННЫЕ СХЕМЫ НА ЛЮБОЙ РАЗМЕР!)
        // ============================================================
        else if (picked === 'dungeon') {
            const variant = MB_PICK_NEXT_VARIANT('dungeon', ['classic_complex', 'underground_river', 'cathedral_crypt']);
            const floorT = Math.random() < 0.5 ? T.stone : T.flagstone;

            if (variant === 'classic_complex') {
                genTitle = MB_PICK(['Забытые катакомбы', 'Тайные казематы', 'Подземелье Ошибки']);
                const rooms = [];
                const targetRooms = Math.max(5, Math.min(16, Math.floor((cols * rows) / 52)));
                for (let a = 0; a < targetRooms * 16 && rooms.length < targetRooms; a++) {
                    const rw = MB_RAND_INT(4, Math.min(8, Math.max(5, Math.floor(cols / 3.2))));
                    const rh = MB_RAND_INT(4, Math.min(7, Math.max(4, Math.floor(rows / 2.8))));
                    const rx = MB_RAND_INT(1, Math.max(1, cols - rw - 2));
                    const ry = MB_RAND_INT(1, Math.max(1, rows - rh - 2));
                    if (!rooms.some(rm => rx <= rm.x + rm.w + 1 && rx + rw + 1 >= rm.x && ry <= rm.y + rm.h + 1 && ry + rh + 1 >= rm.y)) {
                        rooms.push({ x: rx, y: ry, w: rw, h: rh, cx: rx + rw / 2, cy: ry + rh / 2 });
                        fillRect(rx, ry, rx + rw - 1, ry + rh - 1, floorT);
                    }
                }
                rooms.sort((a, b) => (a.cx + a.cy * 0.5) - (b.cx + b.cy * 0.5));

                // Соединяем ближайшие комнаты аккуратными коридорами
                const corrW = cols >= 26 ? 2 : 1;
                for (let i = 1; i < rooms.length; i++) {
                    const p = rooms[i - 1], n = rooms[i];
                    let x = Math.floor(p.cx), y = Math.floor(p.cy), tx = Math.floor(n.cx), ty = Math.floor(n.cy);
                    while (x !== tx) { for (let d = 0; d < corrW; d++) setTile(x, Math.min(rows - 2, y + d), floorT); x += (tx > x ? 1 : -1); }
                    while (y !== ty) { for (let d = 0; d < corrW; d++) setTile(Math.min(cols - 2, x + d), y, floorT); y += (ty > y ? 1 : -1); }
                }

                const hazard = MB_PICK([T.lava, T.water, T.abyss]);
                const roomThemes = ['crypt', 'prison', 'pit', 'barracks', 'storage', 'crystal', 'bones'];
                rooms.forEach((rm, idx) => {
                    addObj(P.braziers, rm.x + 0.8, rm.y + 0.8, 0.85, 0, 0.8);
                    if (rm.w >= 5 && rm.h >= 5) addObj(P.braziers, rm.x + rm.w - 0.8, rm.y + rm.h - 0.8, 0.85, 0, 0.8);
                    if (Math.random() < 0.7) addObj(P.webs, rm.x + rm.w - 0.6, rm.y + 0.6, 0.9, MB_RAND_INT(0, 359), 0);

                    if (idx === 0) {
                        addObj(P.stoneStairs, rm.cx, rm.cy, 0.88, 0, 1.3);
                        addObj(P.crates, rm.x + 1.0, rm.y + rm.h - 1.0, 0.8, 15, 0.7);
                    } else if (idx === rooms.length - 1) {
                        addObj(P.rugs, rm.cx, rm.cy, 1.25, 0, 0);
                        addObj(P.altars, rm.cx, rm.cy, 1.15, 0, 1.4);
                        addObj(P.chests, rm.cx + 1.5, rm.cy - 0.5, 0.9, 0, 0.9);
                        addObj(P.braziers, rm.x + rm.w - 0.8, rm.y + 0.8, 0.85, 0, 0.7);
                    } else {
                        const th = roomThemes[idx % roomThemes.length];
                        if (th === 'pit' && rm.w >= 5 && rm.h >= 5) {
                            fillRect(Math.floor(rm.cx) - 1, Math.floor(rm.cy) - 1, Math.floor(rm.cx), Math.floor(rm.cy), hazard);
                            addObj(P.pillars, rm.x + 1.2, rm.y + 1.2, 0.9, 0, 0.8);
                            addObj(P.pillars, rm.x + rm.w - 1.2, rm.y + 1.2, 0.9, 0, 0.8);
                        } else if (th === 'prison') {
                            addObj(P.cages, rm.cx - 0.8, rm.cy, 0.95, 0, 1.0);
                            addObj(P.bones, rm.cx + 0.9, rm.cy + 0.4, 0.9, MB_RAND_INT(0, 359), 0.8);
                            addObj(P.rubble, rm.x + 1.0, rm.y + rm.h - 1.0, 0.85, 0, 0.8);
                        } else if (th === 'crypt') {
                            addObj(P.altars, rm.cx, rm.cy, 0.95, MB_PICK([0, 90]), 1.2);
                            addObj(P.bones, rm.x + 1.1, rm.y + rm.h - 1.0, 0.85, 40, 0.8);
                        } else if (th === 'barracks') {
                            placeTableGroup(rm.cx, rm.cy, false);
                            addObj(P.barrels, rm.x + rm.w - 1.0, rm.y + 1.0, 0.82, 0, 0.7);
                        } else if (th === 'crystal') {
                            addObj(P.crystals, rm.cx, rm.cy, 1.05, MB_RAND_INT(0, 359), 1.0);
                            addObj(P.rubble, rm.cx + 1.2, rm.cy - 0.6, 0.85, 30, 0.8);
                        } else if (th === 'storage') {
                            addObj(P.crates, rm.cx - 0.9, rm.cy, 0.88, 12, 0.8);
                            addObj(P.barrels, rm.cx + 0.8, rm.cy + 0.3, 0.88, 0, 0.8);
                            addObj(P.chests, rm.x + rm.w - 1.0, rm.y + 1.0, 0.85, 90, 0.8);
                        } else {
                            addObj(P.bones, rm.cx, rm.cy, 1.0, MB_RAND_INT(0, 359), 0.9);
                            addObj(P.chests, rm.x + rm.w - 1.1, rm.cy, 0.85, 180, 0.8);
                        }
                    }
                });
            }
            else if (variant === 'underground_river') {
                genTitle = MB_PICK(['Подземная река и гробница', 'Огненный разлом', 'Затопленные чертоги']);
                const pit = Math.random() < 0.5 ? T.water : T.lava;
                fillRect(2, 2, cols - 3, rows - 3, floorT);
                const midX = Math.floor(cols / 2), midY = Math.floor(rows / 2);
                const rW = cols >= 26 ? 4 : 3;
                const pitCols = [];
                for (let r = 1; r < rows - 1; r++) {
                    const shift = Math.round(Math.sin(r * 0.42) * 1.8);
                    const startC = Math.max(6, Math.min(cols - rW - 6, midX - Math.floor(rW / 2) + shift));
                    pitCols[r] = startC;
                    fillRect(startC, r, startC + rW - 1, r, pit);
                }
                // Каменные мосты через разлом/реку (1 или 2, строго от берега к берегу!)
                const bridgeRows = rows >= 18 ? [Math.floor(rows * 0.32), Math.floor(rows * 0.68)] : [midY];
                bridgeRows.forEach(br => {
                    placeBridgeH(pitCols[br], pitCols[br] + rW - 1, br + 0.5, true);
                    addObj(P.braziers, pitCols[br] - 1.1, br - 0.8, 0.85, 0, 0.8);
                    addObj(P.braziers, pitCols[br] + rW + 1.1, br - 0.8, 0.85, 0, 0.8);
                });
                // Боковые комнаты слева и справа от реки
                addObj(P.stoneStairs, 3.6, midY + 0.5, 0.9, 90, 1.5);
                addObj(P.altars, cols - 4.0, midY + 0.5, 1.2, 270, 1.6);
                addObj(P.rugs, cols - 5.2, midY + 0.5, 1.25, 0, 0);
                addObj(P.chests, cols - 4.0, 3.6, 0.9, 0, 0.9);
                addObj(P.crystals, cols - 4.0, rows - 3.6, 0.95, 25, 1.0);
                for (let r = 4; r <= rows - 5; r += 4) {
                    if (canPlace(5.5, r, 1.5)) addObj(P.pillars, 5.5, r, 0.95, 0, 0.9);
                    if (canPlace(cols - 6.5, r, 1.5)) addObj(P.pillars, cols - 6.5, r, 0.95, 0, 0.9);
                }
                addObj(P.bones, 5.5, rows - 3.5, 1.0, 40, 0.9);
                addObj(P.rubble, 4.5, 3.5, 1.0, 0, 1.0);
            }
            else {
                genTitle = MB_PICK(['Зал Саркофагов', 'Усыпальница с нишами', 'Храм Мёртвых']);
                const naveH = Math.max(5, Math.min(9, Math.floor(rows * 0.42)));
                const ny1 = Math.floor((rows - naveH) / 2), ny2 = ny1 + naveH - 1;
                fillRect(2, ny1, cols - 3, ny2, floorT);
                const midY = Math.floor(rows / 2);
                addObj(P.stoneStairs, 3.4, midY + 0.5, 0.9, 90, 1.5);
                for (let c = 6; c <= cols - 7; c += 3) addObj(P.rugs, c, midY + 0.5, 1.15, 0, 0);
                addObj(P.altars, cols - 4.2, midY + 0.5, 1.2, 270, 1.6);
                addObj(P.braziers, cols - 4.2, ny1 + 1.0, 0.85, 0, 0.8);
                addObj(P.braziers, cols - 4.2, ny2, 0.85, 0, 0.8);

                // Отдельные боковые склепы-альковы сверху и снизу от главного зала!
                const alcoveW = 5;
                const alcoveH = Math.max(3, ny1 - 2);
                for (let c = 4; c + alcoveW <= cols - 4; c += alcoveW + 1) {
                    if (alcoveH >= 3) {
                        // Верхний склеп
                        fillRect(c, 1, c + alcoveW - 1, ny1 - 2, floorT);
                        placeDoor(c + Math.floor(alcoveW / 2), ny1 - 1, floorT, false);
                        addObj(Math.random() < 0.65 ? P.altars : P.chests, c + alcoveW / 2, 2.5, 0.95, 0, 1.1);
                        addObj(P.braziers, c + 0.9, 1.9, 0.78, 0, 0.7);
                        addObj(P.webs, c + alcoveW - 0.8, 1.8, 0.85, 90, 0);
                        // Нижний склеп
                        fillRect(c, ny2 + 2, c + alcoveW - 1, rows - 2, floorT);
                        placeDoor(c + Math.floor(alcoveW / 2), ny2 + 1, floorT, false);
                        addObj(Math.random() < 0.6 ? P.altars : P.cages, c + alcoveW / 2, rows - 3.2, 0.95, 180, 1.1);
                        addObj(P.bones, c + 1.2, rows - 2.6, 0.88, MB_RAND_INT(0, 359), 0.8);
                    }
                    addObj(P.pillars, c + alcoveW, ny1 + 1.0, 0.92, 0, 0.8);
                    addObj(P.pillars, c + alcoveW, ny2, 0.92, 0, 0.8);
                }
            }
            MB_APPLY_RANDOM_MIRROR(data, true, true);
        }

        // ============================================================
        // 4. ⚒️ КУЗНИЦА И ЧЕРТОГИ ДВАРФОВ (2 МНОГОЗАЛЬНЫЕ СХЕМЫ!)
        // ============================================================
        else if (picked === 'dwarven') {
            const variant = MB_PICK_NEXT_VARIANT('dwarven', ['great_foundry', 'mine_bastion']);
            const midY = Math.floor(rows / 2);

            if (variant === 'great_foundry') {
                genTitle = MB_PICK(['Великая Кузница Дварфов', 'Плавильные чертоги', 'Бастион Молота']);
                const leftW = cols >= 26 ? Math.floor(cols * 0.28) : 0;
                const rightW = cols >= 26 ? Math.floor(cols * 0.24) : 0;
                const fx1 = leftW > 0 ? leftW : 1, fx2 = rightW > 0 ? cols - 1 - rightW : cols - 2;

                // Центральный плавильный зал с каналами лавы и каменными мостиками
                boxRoom(fx1, 1, fx2, rows - 2, T.flagstone, T.wall);
                for (let c = fx1 + 2; c <= fx2 - 2; c++) { setTile(c, 2, T.lava); setTile(c, rows - 3, T.lava); }
                // Рабочие станции кузнецов по центру (горн + наковальня + тигель + слитки)
                for (let c = fx1 + 3.5; c <= fx2 - 3.5; c += 4.6) {
                    addObj(P.dwForge, c, midY - 1.4, 1.08, 0, 1.4);
                    addObj(P.dwAnvil, c + 1.2, midY + 0.6, 0.95, 0, 1.0);
                    addObj(P.dwLoot, c - 1.0, midY + 1.6, 0.9, MB_RAND_INT(0, 359), 0.9);
                    addObj(P.pillars, c, 4.0, 0.95, 0, 0.9);
                    addObj(P.pillars, c, rows - 4.0, 0.95, 0, 0.9);
                }

                // Левое крыло: Зал пиров дварфов + Оружейная
                if (leftW >= 7) {
                    boxRoom(1, 1, fx1, midY, T.wood, T.wall);
                    boxRoom(1, midY, fx1, rows - 2, T.stone, T.wall);
                    placeDoor(fx1, Math.floor((1 + midY) / 2), T.flagstone, true, P.doubleDoors);
                    placeDoor(fx1, Math.floor((midY + rows - 2) / 2), T.flagstone, true);
                    placeTableGroup((1 + fx1) / 2 + 0.5, (1 + midY) / 2 + 0.5, true);
                    addObj(P.barrels, 2.2, 2.3, 0.85, 0, 0.7);
                    addObj(P.barrels, 2.2, 3.6, 0.85, 45, 0.7);
                    addObj(P.fireplaces, (1 + fx1) / 2, 2.2, 1.0, 0, 1.2);
                    // Оружейная снизу-слева
                    addObj(P.dwLoot, (1 + fx1) / 2, (midY + rows - 2) / 2, 1.05, 0, 1.2);
                    addObj(P.dwAnvil, 2.5, rows - 3.2, 0.9, 0, 0.9);
                    addObj(P.braziers, fx1 - 1.2, midY + 1.5, 0.82, 0, 0.7);
                }

                // Правое крыло: Сокровищница дварфов за массивной дверью
                if (rightW >= 6) {
                    boxRoom(fx2, 2, cols - 2, rows - 3, T.flagstone, T.wall);
                    placeDoor(fx2, midY, T.flagstone, true, P.doubleDoors);
                    addObj(P.dwStatues, cols - 3.2, midY + 0.5, 1.2, 270, 1.6);
                    for (let r = 4; r <= rows - 5; r += 2.8) {
                        addObj(P.chests, fx2 + 2.0, r, 0.88, 90, 0.9);
                        addObj(P.dwLoot, cols - 3.4, r, 0.85, MB_RAND_INT(0, 359), 0.8);
                    }
                    addObj(P.braziers, fx2 + 1.6, 3.4, 0.82, 0, 0.7);
                    addObj(P.braziers, fx2 + 1.6, rows - 3.6, 0.82, 0, 0.7);
                }
            }
            else {
                genTitle = MB_PICK(['Подгорная шахта и плавильня', 'Рудник Самоцветов', 'Глубокий забой']);
                const splitX = Math.floor(cols * 0.46);
                // Слева — обжитая дварфийская база (кузница + склад)
                boxRoom(1, 2, splitX, rows - 3, T.flagstone, T.wall);
                for (let c = 2; c < splitX; c++) setTile(c, midY, T.wall);
                placeDoor(Math.floor(splitX / 2), midY, T.flagstone, false);
                placeDoor(splitX, Math.floor((2 + midY) / 2), T.stone, true, P.doubleDoors);
                addObj(P.dwForge, splitX / 2, 4.0, 1.1, 0, 1.5);
                addObj(P.dwAnvil, splitX / 2 + 1.8, 5.2, 0.95, 0, 1.0);
                addObj(P.dwLoot, 3.0, 4.5, 0.95, 25, 1.0);
                addObj(P.braziers, 2.5, 3.2, 0.85, 0, 0.7);
                placeTableGroup(splitX / 2, (midY + rows - 3) / 2 + 0.5, true);
                addObj(P.crates, 2.5, rows - 4.0, 0.85, 0, 0.8);
                addObj(P.barrels, splitX - 1.5, rows - 4.0, 0.85, 0, 0.8);

                // Справа — естественная пещера-шахта с озером лавы и светящимися кристаллами!
                const cx = (splitX + cols - 1) / 2, cy = rows / 2;
                for (let r = 1; r < rows - 1; r++) for (let c = splitX + 1; c < cols - 1; c++) {
                    const edge = Math.hypot((c - cx) / ((cols - splitX) * 0.48), (r - cy) / (rows * 0.45));
                    if (edge < 0.96 + (Math.random() - 0.5) * 0.16) setTile(c, r, T.stone);
                }
                // Озерцо лавы в глубине шахты
                const lx = cols - 5, ly = midY;
                for (let r = ly - 2; r <= ly + 2; r++) for (let c = lx - 2; c <= lx + 2; c++) {
                    if (Math.hypot(c - lx, r - ly) < 2.2) setTile(c, r, T.lava);
                }
                for (let r = 2; r < rows - 2; r++) for (let c = splitX + 2; c < cols - 2; c++) {
                    if (getTile(c, r) !== T.stone || !canPlace(c + 0.5, r + 0.5, 1.6)) continue;
                    const rnd = Math.random();
                    if (rnd < 0.09) addObj(P.crystals, c + 0.5, r + 0.5, MB_RAND_FLOAT(0.85, 1.15), MB_RAND_INT(0, 359), 1.2);
                    else if (rnd < 0.16) addObj(P.rocks, c + 0.5, r + 0.5, 0.95, MB_RAND_INT(0, 359), 1.1);
                    else if (rnd < 0.20) addObj(P.dwLoot, c + 0.5, r + 0.5, 0.85, MB_RAND_INT(0, 359), 0.9);
                }
            }
            MB_APPLY_RANDOM_MIRROR(data, true, false);
        }

        // ============================================================
        // 5. ⛩️ ВОСТОЧНЫЙ ХРАМ / ДОДЗЁ (2 ГАРМОНИЧНЫЕ СХЕМЫ + НОРМАЛЬНЫЕ МОСТЫ!)
        // ============================================================
        else if (picked === 'eastern') {
            const variant = MB_PICK_NEXT_VARIANT('eastern', ['zen_monastery', 'lake_pavilion']);
            const midY = Math.floor(rows / 2);

            if (variant === 'zen_monastery') {
                genTitle = MB_PICK(['Восточное додзё и сад', 'Монастырь Тихого Лотоса', 'Храм Сакуры']);
                // Здание разумного размера слева, а справа — живописный дзен-сад с извилистым прудом!
                const bw = Math.min(Math.floor(cols * 0.54), Math.max(10, Math.min(20, cols - 8)));
                const bh = Math.min(rows - 4, Math.max(8, Math.min(16, Math.floor(rows * 0.72))));
                const x1 = 2, y1 = Math.floor((rows - bh) / 2);
                const x2 = x1 + bw - 1, y2 = y1 + bh - 1;

                boxRoom(x1, y1, x2, y2, T.wood, T.wall);
                // Разделяем храм: главный зал додзё + чайная/спальня монахов слева
                const dojoL = bw >= 14 ? (x1 + 5) : x1;
                if (dojoL > x1) {
                    for (let r = y1 + 1; r < y2; r++) setTile(dojoL, r, T.wall);
                    for (let c = x1 + 1; c < dojoL; c++) setTile(c, midY, T.wall);
                    placeDoor(dojoL, Math.floor((y1 + midY) / 2), T.wood, true, P.eastDoors);
                    placeDoor(dojoL, Math.floor((midY + y2) / 2), T.wood, true, P.eastDoors);
                    // Чайная комната сверху
                    addObj(P.eastMats, (x1 + dojoL) / 2 + 0.5, (y1 + midY) / 2 + 0.5, 1.0, 0, 0);
                    addObj(P.eastTables, (x1 + dojoL) / 2 + 0.5, (y1 + midY) / 2 + 0.5, 0.9, 0, 1.1);
                    addObj(P.eastLights, x1 + 1.5, y1 + 1.5, 0.8, 0, 0.7);
                    // Комната монаха снизу
                    addObj(P.eastFuton, x1 + 2.2, y2 - 1.6, 0.95, 0, 1.1);
                    addObj(P.eastDecor, dojoL - 1.0, midY + 1.5, 0.85, 0, 0.9);
                }

                // Главный зал додзё
                placeDoor(x2, midY, T.wood, true, P.eastDoors);
                const dCx = (dojoL + x2 + 1) / 2;
                addObj(P.eastMats, dCx, midY + 0.5, 1.25, 0, 0);
                addObj('other_shrine_1', dojoL + 1.6, midY + 0.5, 1.1, 90, 1.4);
                addObj(P.eastLights, dojoL + 1.5, y1 + 1.6, 0.85, 0, 0.8);
                addObj(P.eastLights, dojoL + 1.5, y2 - 1.4, 0.85, 0, 0.8);
                addObj(P.eastLights, x2 - 1.2, y1 + 1.6, 0.85, 0, 0.8);
                addObj(P.eastLights, x2 - 1.2, y2 - 1.4, 0.85, 0, 0.8);
                addObj(P.eastDecor, dCx, y1 + 1.7, 0.92, 0, 1.1);
                addObj(P.eastDecor, dCx, y2 - 1.6, 0.92, 180, 1.1);

                // Органический пруд в саду справа + ДОРОЖКА И МОСТ ОТ БЕРЕГА ДО БЕРЕГА!
                const pCx = x2 + Math.floor((cols - x2) * 0.52);
                const pRx = Math.max(2.2, Math.min(4.2, (cols - x2) * 0.25));
                const pRy = Math.max(3.0, rows * 0.34);
                let wMin = 999, wMax = -1;
                for (let r = 1; r < rows - 1; r++) for (let c = x2 + 2; c < cols - 1; c++) {
                    const d = Math.hypot((c - pCx) / pRx, (r - midY) / pRy);
                    if (d < 1.0 + Math.sin(r * 0.7) * 0.14) {
                        setTile(c, r, T.water);
                        if (r === midY) { wMin = Math.min(wMin, c); wMax = Math.max(wMax, c); }
                    }
                }
                // Дорожка от входа через мост к краю сада
                for (let c = x2 + 1; c < cols; c++) if (getTile(c, midY) !== T.water) setTile(c, midY, T.dirt);
                if (wMax >= wMin) placeBridgeH(wMin, wMax, midY + 0.5, false);
                addObj(P.eastLights, x2 + 1.3, midY - 1.1, 0.82, 0, 0.7);
                addObj(P.eastLights, x2 + 1.3, midY + 1.8, 0.82, 0, 0.7);
            }
            else {
                genTitle = MB_PICK(['Чайный павильон на озере', 'Святилище на острове', 'Сад Лотосов']);
                const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
                const rx = Math.max(5, Math.floor(cols * 0.36)), ry = Math.max(4, Math.floor(rows * 0.38));
                // Красивое озеро с островом-павильоном в центре
                for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
                    const d = Math.hypot((c - cx) / rx, (r - cy) / ry);
                    if (d < 1.0 + Math.sin(c * 0.5 + r * 0.5) * 0.08) setTile(c, r, T.water);
                }
                const pw = Math.min(11, Math.max(7, Math.floor(cols * 0.28)));
                const ph = Math.min(9, Math.max(6, Math.floor(rows * 0.36)));
                const px1 = Math.floor(cx - pw / 2), py1 = Math.floor(cy - ph / 2);
                const px2 = px1 + pw - 1, py2 = py1 + ph - 1;
                boxRoom(px1, py1, px2, py2, T.wood, T.wall);
                placeDoor(px1, cy, T.wood, true, P.eastDoors);
                placeDoor(px2, cy, T.wood, true, P.eastDoors);

                // Находим реальные границы воды слева и справа от павильона и строим 2 полных моста!
                let leftWStart = px1 - 1; while (leftWStart > 0 && getTile(leftWStart, cy) === T.water) leftWStart--;
                if (leftWStart + 1 <= px1 - 1) placeBridgeH(leftWStart + 1, px1 - 1, cy + 0.5, false);
                let rightWEnd = px2 + 1; while (rightWEnd < cols - 1 && getTile(rightWEnd, cy) === T.water) rightWEnd++;
                if (px2 + 1 <= rightWEnd - 1) placeBridgeH(px2 + 1, rightWEnd - 1, cy + 0.5, false);
                fillRect(0, cy, Math.max(0, leftWStart), cy, T.dirt);
                fillRect(Math.min(cols - 1, rightWEnd), cy, cols - 1, cy, T.dirt);

                // Интерьер павильона
                addObj(P.eastMats, cx + 0.5, cy + 0.5, 1.2, 0, 0);
                addObj(P.eastTables, cx + 0.5, cy + 0.5, 0.95, 0, 1.1);
                addObj('other_shrine_2', cx + 0.5, py1 + 1.5, 1.0, 0, 1.1);
                addObj(P.eastLights, px1 + 1.4, py1 + 1.4, 0.8, 0, 0.7);
                addObj(P.eastLights, px2 - 0.6, py1 + 1.4, 0.8, 0, 0.7);
                addObj(P.eastLights, px1 + 1.4, py2 - 0.6, 0.8, 0, 0.7);
                addObj(P.eastLights, px2 - 0.6, py2 - 0.6, 0.8, 0, 0.7);
            }

            // Кувшинки в пруду + сад деревьев и камней вокруг
            for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
                if (getTile(c, r) === T.water && canPlace(c + 0.5, r + 0.5, 1.5) && Math.random() < 0.16) {
                    addObj(P.waterDec, c + 0.5, r + 0.5, 0.9, MB_RAND_INT(0, 359), 0.9);
                }
            }
            scatterYardForest([T.dirt, T.water, T.wood, T.wall]);
            MB_APPLY_RANDOM_MIRROR(data, true, false);
        }

        const titleInp = document.getElementById('mb-map-title-inp');
        if (titleInp) titleInp.value = genTitle;

        window._mbData = data;
        SAVE_MB_DATA(data);
        RENDER_GM_MAP_BUILDER_UI();
    };
})();

// ================================================================
// 🌍 ЭТАП 3: ПЛОТНЫЕ ЖИВЫЕ ОТКРЫТЫЕ ЛОКАЦИИ (ГОРОД, БОЙ, ЛЕС, ПРИРОДА)
// ================================================================
(function INSTALL_OUTDOOR_GENERATORS_V3() {
    const _PREV_MB_GENERATE = MB_GENERATE_RANDOM;
    const OUTDOOR_BIOMES = ['city', 'battlefield', 'forest', 'pirate', 'desert', 'fey', 'warcamp', 'snow'];

    MB_GENERATE_RANDOM = function(biome) {
        const allBiomes = ['tavern', 'city', 'battlefield', 'forest', 'dungeon', 'mansion', 'dwarven', 'pirate', 'desert', 'fey', 'eastern', 'warcamp', 'snow'];
        const picked = (biome === 'random' || !biome) ? MB_PICK_NEXT_VARIANT('_global', allBiomes) : biome;

        if (!OUTDOOR_BIOMES.includes(picked)) {
            return _PREV_MB_GENERATE(picked);
        }

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
            lava:      MB_PICK_TILE_FAMILY('lava', 'lava'),
            water:     'water',
            sand:      'sand',
            leafG:     'leaves_green',
            leafR:     'leaves_red'
        };

        const baseByBiome = {
            city: T.grass, battlefield: T.grass, forest: T.grass,
            pirate: T.sand, desert: T.sand, fey: T.grass,
            warcamp: T.grass, snow: T.snow
        };
        const lightByBiome = {
            city:        MB_PICK(['day', 'day', 'sunset', 'night']),
            battlefield: MB_PICK(['sunset', 'day', 'sunset']),
            forest:      MB_PICK(['day', 'day', 'sunset']),
            pirate:      MB_PICK(['day', 'sunset']),
            desert:      MB_PICK(['day', 'sunset']),
            fey:         'night',
            warcamp:     MB_PICK(['sunset', 'night']),
            snow:        MB_PICK(['day', 'night'])
        };

        window._mbLighting = lightByBiome[picked] || 'day';
        const data = CREATE_EMPTY_MB_DATA(baseByBiome[picked] || T.grass, cols, rows);
        data.lighting = window._mbLighting;

        const inBounds = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows;
        const getTile = (c, r) => inBounds(c, r) ? data.cells[r * cols + c].t : null;
        const setTile = (c, r, t) => { if (inBounds(c, r)) data.cells[r * cols + c].t = t; };
        const fillRect = (x1, y1, x2, y2, t) => {
            for (let r = Math.max(0, Math.floor(y1)); r <= Math.min(rows - 1, Math.floor(y2)); r++)
                for (let c = Math.max(0, Math.floor(x1)); c <= Math.min(cols - 1, Math.floor(x2)); c++) setTile(c, r, t);
        };
        const fillDisc = (cx, cy, rx, ry, t, noise = 0.14) => {
            for (let r = Math.max(0, Math.floor(cy - ry - 2)); r <= Math.min(rows - 1, Math.ceil(cy + ry + 2)); r++) {
                for (let c = Math.max(0, Math.floor(cx - rx - 2)); c <= Math.min(cols - 1, Math.ceil(cx + rx + 2)); c++) {
                    const d = Math.hypot((c - cx) / Math.max(0.5, rx), (r - cy) / Math.max(0.5, ry));
                    const wobble = Math.sin(c * 0.7 + r * 0.5) * noise;
                    if (d < 1.0 + wobble) setTile(c, r, t);
                }
            }
        };

        const placedZones = [];
        const canPlace = (x, y, minDist = 1.0) => !placedZones.some(z => Math.hypot(z.x - x, z.y - y) < Math.max(minDist, z.r));
        const addObj = (poolOrId, x, y, scale = 1.0, rot = 0, reserveRadius = 0) => {
            const id = Array.isArray(poolOrId) ? MB_PICK(poolOrId) : poolOrId;
            if (!id) return false;
            const stObj = MB_FIND_STAMP_OBJ(id);
            if (!stObj) return false;
            if (stObj.img) MB_GET_LOADED_IMG(stObj.img);
            data.objects.push({ id, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, scale, rot });
            if (reserveRadius > 0) placedZones.push({ x, y, r: reserveRadius });
            return true;
        };

        // --- ЧИСТЫЕ ПУЛЫ РАБОЧИХ СПРАЙТОВ ---
        const P = {
            trees:        MB_GET_POOL(/^nature_tree_(large|small|big|bigger|[123])$|^nature_tree_(large|small)_[12]$/),
            bushes:       MB_GET_POOL(/^nature_bush_(2|3|4|5|6|7|8)_green|^nature_bush_shrub_|^nature_bush_[12]$|^nature_thick_foliage_|^other_fern_/),
            autumnBushes: MB_GET_POOL(/^nature_bush_1_red$|^nature_bush_9_yellow$|^other_leaf_litter_/),
            flowers:      MB_GET_POOL(/^nature_flower_|^nature_flowers_|^other_clovers_/),
            rocks:        MB_GET_POOL(/^nature_mossy_boulder_|^nature_rock(_small)?_[123]$|^nature_rocks_[1-5]$/),
            rockBig:      MB_GET_POOL(/^nature_rock_formation_[2-6]$|^nature_rocks_1_2x2$|^nature_rocks_5_2x2$/),
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
            braziers:     MB_GET_POOL(/^dungeon_light_brazier_|^other_light_stand_lit_iron$/),

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

        // --- ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ---
        const placeBridgeH = (xStart, xEnd, yCenter, isStone = false) => {
            const span = (xEnd - xStart + 1) + 1.4;
            const pool = isStone ? P.stoneBridge : P.woodBridge;
            const count = Math.max(1, Math.ceil(span / 3.4));
            const segLen = span / count;
            const scale = Math.max(0.8, segLen / 3.5);
            for (let i = 0; i < count; i++) addObj(pool, (xStart - 0.7) + segLen * (i + 0.5), yCenter, scale, 0, 1.6);
        };

        const placeBridgeV = (xCenter, yStart, yEnd, isStone = false) => {
            const span = (yEnd - yStart + 1) + 1.4;
            const pool = isStone ? P.stoneBridge : P.woodBridge;
            const count = Math.max(1, Math.ceil(span / 3.4));
            const segLen = span / count;
            const scale = Math.max(0.8, segLen / 3.5);
            for (let i = 0; i < count; i++) addObj(pool, xCenter, (yStart - 0.7) + segLen * (i + 0.5), scale, 90, 1.6);
        };

        // Дом с крышей, дымоходом и обжитым двориком вокруг
        const placeCityHouse = (cx, cy, rotDeg, useThatch = false, scale = 1.05) => {
            const horiz = (rotDeg % 180 === 0);
            const hw = horiz ? Math.ceil(2.5 * scale) : Math.ceil(1.8 * scale);
            const hh = horiz ? Math.ceil(1.8 * scale) : Math.ceil(2.5 * scale);
            if (cx - hw < 0.5 || cx + hw > cols - 0.5 || cy - hh < 0.5 || cy + hh > rows - 0.5) return false;
            if (!canPlace(cx, cy, Math.max(hw, hh) * 1.15)) return false;

            const pool = useThatch ? P.roofThatch : P.roofTile;
            addObj(pool, cx, cy, scale, rotDeg, Math.max(hw, hh) * 1.15);
            if (Math.random() < 0.78) {
                addObj('other_misc_chimney_1x1', cx + (horiz ? 0.9 * scale : 0.3), cy - 0.45 * scale, 0.9, 0, 0);
            }
            // Маленькие детали рядом с домом (ящики, бочки или клумба)
            const sideX = cx + (horiz ? 0 : (hw + 0.75) * (Math.random() < 0.5 ? 1 : -1));
            const sideY = cy + (horiz ? (hh + 0.75) * (Math.random() < 0.5 ? 1 : -1) : 0);
            if (inBounds(Math.floor(sideX), Math.floor(sideY)) && getTile(Math.floor(sideX), Math.floor(sideY)) !== T.water && canPlace(sideX, sideY, 0.8)) {
                addObj(Math.random() < 0.6 ? P.market : P.gardens, sideX, sideY, 0.78, MB_RAND_INT(0, 359), 0.7);
            }
            return true;
        };

        // Плотное автозаполнение городских кварталов домами и уютными скверами (убирает «пустую парковку»!)
        const fillCityDistrictBlocks = (blockTileCheck, useThatchChance = 0.25) => {
            const stepX = 5.4, stepY = 4.6;
            for (let y = 2.6; y <= rows - 2.6; y += stepY) {
                for (let x = 2.8; x <= cols - 2.8; x += stepX) {
                    const jx = x + MB_RAND_FLOAT(-0.45, 0.45);
                    const jy = y + MB_RAND_FLOAT(-0.35, 0.35);
                    // Проверяем, чтобы под домом не было воды, стен или главной площади
                    let areaOk = true;
                    for (let dy = -1; dy <= 1 && areaOk; dy++) {
                        for (let dx = -2; dx <= 2 && areaOk; dx++) {
                            const t = getTile(Math.floor(jx) + dx, Math.floor(jy) + dy);
                            if (!t || !blockTileCheck(t)) areaOk = false;
                        }
                    }
                    if (!areaOk || !canPlace(jx, jy, 3.1)) continue;

                    if (Math.random() < 0.82) {
                        const rot = Math.random() < 0.65 ? MB_PICK([0, 180]) : MB_PICK([90, 270]);
                        placeCityHouse(jx, jy, rot, Math.random() < useThatchChance, MB_RAND_FLOAT(0.95, 1.18));
                    } else {
                        // Маленький зелёный дворик / скверик между домами
                        fillDisc(jx, jy, 1.8, 1.5, T.grass, 0.12);
                        addObj(P.trees, jx - 0.6, jy - 0.3, 1.05, MB_RAND_INT(0, 359), 1.4);
                        addObj(P.gardens, jx + 0.9, jy + 0.5, 0.9, MB_RAND_INT(0, 359), 0.7);
                        addObj(P.lamps, jx + 1.2, jy - 0.9, 0.82, 0, 0.6);
                    }
                }
            }
        };

        // Естественные рощи деревьев вместо «равномерного конфетти»
        const scatterNaturalGroves = (allowedTiles, treePool, bushPool, extraPool, density = 1.0) => {
            const groveCount = Math.max(4, Math.floor((cols * rows) / 48 * density));
            for (let g = 0; g < groveCount; g++) {
                const gx = MB_RAND_FLOAT(1.5, cols - 1.5);
                const gy = MB_RAND_FLOAT(1.5, rows - 1.5);
                const tBase = getTile(Math.floor(gx), Math.floor(gy));
                if (!allowedTiles.includes(tBase)) continue;
                const clusterSize = MB_RAND_INT(3, 6);
                for (let k = 0; k < clusterSize; k++) {
                    const ox = gx + MB_RAND_FLOAT(-2.8, 2.8);
                    const oy = gy + MB_RAND_FLOAT(-2.4, 2.4);
                    if (!inBounds(Math.floor(ox), Math.floor(oy))) continue;
                    if (!allowedTiles.includes(getTile(Math.floor(ox), Math.floor(oy)))) continue;
                    if (!canPlace(ox, oy, 1.55)) continue;
                    if (k < 3) addObj(treePool, ox, oy, MB_RAND_FLOAT(0.95, 1.45), MB_RAND_INT(0, 359), 1.75);
                    else addObj(bushPool, ox, oy, MB_RAND_FLOAT(0.85, 1.2), MB_RAND_INT(0, 359), 0.95);
                }
            }
            // Одиночные акценты (цветы, камни, грибы, пни)
            const scatterCount = Math.floor((cols * rows) / 14 * density);
            for (let i = 0; i < scatterCount; i++) {
                const ox = MB_RAND_FLOAT(1.2, cols - 1.2), oy = MB_RAND_FLOAT(1.2, rows - 1.2);
                if (!allowedTiles.includes(getTile(Math.floor(ox), Math.floor(oy)))) continue;
                if (!canPlace(ox, oy, 1.15)) continue;
                addObj(extraPool, ox, oy, MB_RAND_FLOAT(0.78, 1.15), MB_RAND_INT(0, 359), 0.85);
            }
        };

        let genTitle = 'Локация';

        // ============================================================
        // 1. 👑 ГОРОД / СТОЛИЦА (4 ПЛОТНЫХ ЖИВЫХ КВАРТАЛА!)
        // ============================================================
        if (picked === 'city') {
            const variant = MB_PICK_NEXT_VARIANT('city', ['market_square', 'canal_quarter', 'fortified_gate', 'old_town']);
            const isBig = cols >= 26;

            if (variant === 'market_square') {
                genTitle = isBig ? 'Ярмарочная площадь Столицы' : 'Торговая площадь Притишья';
                fillRect(0, 0, cols - 1, rows - 1, T.cobble);
                const mx = Math.floor(cols / 2), my = Math.floor(rows / 2);
                const pW = Math.min(7, Math.max(4, Math.floor(cols * 0.19)));
                const pH = Math.min(5, Math.max(3, Math.floor(rows * 0.22)));

                // Главные проспекты и мощёная центральная площадь (отличаются текстурой от кварталов!)
                fillRect(0, my - 1, cols - 1, my + 1, T.flagstone);
                fillRect(mx - 1, 0, mx + 1, rows - 1, T.flagstone);
                fillRect(mx - pW, my - pH, mx + pW, my + pH, T.stone);

                // Центр площади: фонтан/статуя + 4 фонаря + ярмарочные ряды
                addObj(P.cityCenter, mx + 0.5, my + 0.5, 1.35, 0, 2.2);
                [[-pW + 1, -pH + 1], [pW - 1, -pH + 1], [-pW + 1, pH - 1], [pW - 1, pH - 1]].forEach(([dx, dy]) => {
                    addObj(P.lamps, mx + dx + 0.5, my + dy + 0.5, 0.9, 0, 0.8);
                });
                // Торговые прилавки с тентами и товарами по краям площади
                for (let dx of [-pW + 2, pW - 2]) {
                    for (let dy of [-2, 2]) {
                        const sx = mx + dx + 0.5, sy = my + dy + 0.5;
                        if (canPlace(sx, sy, 1.5)) {
                            addObj(P.tables, sx, sy, 0.95, 0, 1.3);
                            addObj(P.market, sx - 0.6, sy + (dy < 0 ? -0.65 : 0.65), 0.78, MB_RAND_INT(0, 359), 0);
                            addObj(P.market, sx + 0.6, sy + (dy < 0 ? -0.65 : 0.65), 0.78, MB_RAND_INT(0, 359), 0);
                        }
                    }
                }
                // Повозки на улицах
                addObj(P.carts, mx - pW - 2.2, my + 0.4, 1.05, 0, 1.8);
                addObj(P.carts, mx + pW + 2.2, my + 0.4, 1.05, 180, 1.8);
                addObj(P.horses, mx + pW + 4.3, my + 0.4, 0.95, 180, 1.0);

                // Плотно застраиваем все 4 квартала вокруг площади!
                fillCityDistrictBlocks(t => t === T.cobble, isBig ? 0.15 : 0.45);
            }
            else if (variant === 'canal_quarter') {
                genTitle = MB_PICK(['Речной квартал и набережная', 'Канал Купцов', 'Мосты Старого города']);
                fillRect(0, 0, cols - 1, rows - 1, T.cobble);
                const cW = rows >= 18 ? 4 : 3;
                const canalRows = [];
                let cy = Math.floor(rows / 2);
                for (let c = 0; c < cols; c++) {
                    const wave = Math.round(Math.sin(c * 0.22) * (rows >= 18 ? 1.8 : 1.0));
                    const startR = Math.max(4, Math.min(rows - cW - 5, cy - Math.floor(cW / 2) + wave));
                    canalRows[c] = startR;
                    // Каменная набережная вдоль обеих сторон канала
                    fillRect(c, startR - 2, c, startR + cW + 1, T.flagstone);
                    fillRect(c, startR, c, startR + cW - 1, T.water);
                }

                // 2–3 полных каменных моста через извилистый канал
                const bridgeXs = cols >= 30
                    ? [Math.floor(cols * 0.22), Math.floor(cols * 0.50), Math.floor(cols * 0.78)]
                    : [Math.floor(cols * 0.30), Math.floor(cols * 0.70)];
                bridgeXs.forEach(bx => {
                    fillRect(bx - 1, 0, bx + 1, rows - 1, T.flagstone);
                    fillRect(bx - 1, canalRows[bx], bx + 1, canalRows[bx] + cW - 1, T.water);
                    placeBridgeV(bx + 0.5, canalRows[bx], canalRows[bx] + cW - 1, true);
                    addObj(P.lamps, bx - 1.5, canalRows[bx] - 1.0, 0.88, 0, 0.8);
                    addObj(P.lamps, bx + 2.5, canalRows[bx] + cW + 0.8, 0.88, 0, 0.8);
                });

                // Лодки в канале + ящики/рынок на набережной
                for (let x = 4; x < cols - 4; x += 9) {
                    if (!bridgeXs.some(bx => Math.abs(bx - x) < 3.5)) {
                        addObj(P.boats, x, canalRows[x] + cW / 2, 1.05, MB_RAND_INT(-12, 12), 1.5);
                        addObj(P.market, x + 0.8, canalRows[x] - 1.0, 0.82, MB_RAND_INT(0, 359), 0.7);
                        addObj(P.barrels, x - 0.8, canalRows[x] + cW + 1.0, 0.82, MB_RAND_INT(0, 359), 0.7);
                    }
                }

                // Плотные кварталы домов по обоим берегам!
                fillCityDistrictBlocks(t => t === T.cobble, 0.15);
            }
            else if (variant === 'fortified_gate') {
                genTitle = MB_PICK(['Городские ворота и пригород', 'Въезд в Столицу', 'Застава Империи']);
                const wallX = Math.floor(cols * 0.44);
                const midY = Math.floor(rows / 2);
                // Справа — мощёный город, слева — зелёный пригород с торговым трактом
                fillRect(wallX, 0, cols - 1, rows - 1, T.cobble);
                fillRect(0, midY - 1, cols - 1, midY + 1, T.flagstone);
                // Извилистая просёлочная дорога снаружи
                for (let c = 0; c < wallX; c++) {
                    const dy = Math.round(Math.sin(c * 0.3) * 0.8);
                    fillRect(c, midY - 1 + dy, c, midY + 1 + dy, T.dirt);
                }
                // Крепостная стена с бастионными выступами у ворот
                for (let r = 0; r < rows; r++) {
                    if (Math.abs(r - midY) > 2) {
                        setTile(wallX, r, T.wall);
                        setTile(wallX + 1, r, T.wall);
                        if (Math.abs(r - midY) === 3 || Math.abs(r - midY) === 4) {
                            setTile(wallX - 1, r, T.wall);
                        }
                    }
                }
                // Башни, флаги, фонари, караван у ворот
                addObj(P.watchpost, wallX + 0.5, midY - 3.6, 1.15, 0, 2.1);
                addObj(P.watchpost, wallX + 0.5, midY + 4.0, 1.15, 0, 2.1);
                addObj(P.flags, wallX - 1.2, midY - 3.2, 1.05, 0, 0.7);
                addObj(P.flags, wallX - 1.2, midY + 3.6, 1.05, 0, 0.7);
                addObj(P.lamps, wallX - 1.6, midY - 1.6, 0.88, 0, 0.7);
                addObj(P.lamps, wallX - 1.6, midY + 2.2, 0.88, 0, 0.7);
                addObj(P.carts, wallX - 4.2, midY + 0.3, 1.05, 5, 1.8);
                addObj(P.horses, wallX - 6.3, midY + 0.3, 0.95, 0, 1.1);
                if (wallX >= 11) {
                    addObj(P.campTents, 3.8, 3.4, 1.05, 20, 1.9);
                    addObj(P.campfires, 5.8, 4.4, 1.0, 0, 1.3);
                    placeCityHouse(4.6, rows - 3.6, 0, true, 1.05);
                }

                // Плотная городская застройка внутри стен + лес в пригороде
                fillCityDistrictBlocks(t => t === T.cobble, 0.12);
                scatterNaturalGroves([T.grass], P.trees, P.bushes, P.flowers, 0.9);
            }
            else {
                genTitle = MB_PICK(['Старый город и переулки', 'Уютная слобода', 'Ремесленный квартал']);
                fillRect(0, 0, cols - 1, rows - 1, T.cobble);
                // Кривая главная улица + пара переулков
                let sy = Math.floor(rows * 0.48);
                const mainRow = [];
                for (let c = 0; c < cols; c++) {
                    const wave = Math.round(Math.sin(c * 0.19) * (rows >= 18 ? 2.4 : 1.3));
                    mainRow[c] = Math.max(4, Math.min(rows - 5, sy + wave));
                    fillRect(c, mainRow[c] - 1, c, mainRow[c] + 1, T.flagstone);
                }
                const laneX1 = Math.floor(cols * 0.33), laneX2 = Math.floor(cols * 0.68);
                fillRect(laneX1, 0, laneX1 + 1, rows - 1, T.flagstone);
                if (cols >= 28) fillRect(laneX2, 0, laneX2 + 1, rows - 1, T.flagstone);

                // Центральный зелёный сквер на перекрёстке
                const parkX = Math.floor(cols * 0.5), parkY = mainRow[parkX];
                fillDisc(parkX, parkY, 3.4, 2.8, T.grass, 0.12);
                addObj(P.cityCenter, parkX + 0.5, parkY + 0.5, 1.25, 0, 2.0);
                addObj(P.trees, parkX - 2.0, parkY - 1.4, 1.05, 45, 1.4);
                addObj(P.trees, parkX + 2.4, parkY + 1.4, 1.05, 190, 1.4);
                addObj(P.lamps, parkX - 2.3, parkY + 1.5, 0.85, 0, 0.7);
                addObj(P.lamps, parkX + 2.3, parkY - 1.5, 0.85, 0, 0.7);
                addObj(P.carts, laneX1 + 0.5, mainRow[laneX1] + 0.4, 1.0, 90, 1.7);

                fillCityDistrictBlocks(t => t === T.cobble, 0.32);
            }
            MB_APPLY_RANDOM_MIRROR(data, true, true);
        }

        // ============================================================
        // 2. ⚔️ ПОЛЕ БИТВЫ / ОСАДА (4 ПЛОТНЫХ ТАКТИЧЕСКИХ СЦЕНАРИЯ!)
        // ============================================================
        else if (picked === 'battlefield') {
            const variant = MB_PICK_NEXT_VARIANT('battlefield', ['wall_breach', 'river_crossing', 'hill_redoubt', 'convoy_ambush']);
            const midX = Math.floor(cols / 2), midY = Math.floor(rows / 2);

            if (variant === 'wall_breach') {
                genTitle = MB_PICK(['Пролом в крепостной стене', 'Осада цитадели', 'Штурм бастиона']);
                // Ломаная (угловая) крепостная стена вместо прямой линейки!
                const wallAtRow = [];
                for (let r = 0; r < rows; r++) {
                    const bulge = Math.round(Math.cos(((r - midY) / Math.max(4, rows * 0.4)) * Math.PI * 0.65) * 3.0);
                    const wx = Math.max(8, Math.min(cols - 8, Math.floor(cols * 0.58) - bulge));
                    wallAtRow[r] = wx;
                    fillRect(wx, r, cols - 1, r, T.flagstone);
                    // Снаружи — изрытое воронками поле осады (пятна земли на траве)
                    for (let c = 0; c < wx; c++) {
                        const nearWall = (wx - c) < 7;
                        if (nearWall || Math.random() < 0.45) setTile(c, r, T.dirt);
                    }
                    if (Math.abs(r - midY) > 2) {
                        setTile(wx, r, T.wall); setTile(wx + 1, r, T.wall);
                    }
                }
                const breachX = wallAtRow[midY];
                // Завалы и горящие обломки в проломе
                addObj(P.collapsed, breachX + 0.8, midY - 2.0, 1.2, 85, 1.5);
                addObj(P.collapsed, breachX + 0.8, midY + 2.3, 1.2, 265, 1.5);
                addObj(P.battleFire, breachX - 0.5, midY + 0.2, 1.0, 0, 1.2);
                addObj('camp_batteringrambroken', breachX - 3.6, midY + 0.5, 1.25, 8, 1.9);

                // Полукруг внутренних баррикад защитников + орудия и знамёна
                for (let a = -3; a <= 3; a++) {
                    const ang = a * 0.34;
                    const bx = breachX + 2.2 + Math.cos(ang) * 4.2;
                    const by = midY + Math.sin(ang) * 4.6;
                    if (inBounds(Math.floor(bx), Math.floor(by))) addObj(P.barricades, bx, by, 1.1, Math.round(ang * 57) + 270, 1.2);
                }
                addObj(P.siege, Math.min(cols - 3.0, breachX + 7.5), midY - 2.6, 1.2, 180, 2.0);
                addObj(P.siege, Math.min(cols - 3.0, breachX + 7.5), midY + 2.6, 1.2, 180, 2.0);
                addObj(P.flags, Math.min(cols - 4.0, breachX + 5.5), midY, 1.15, 0, 0.9);
                addObj(P.campTents, cols - 3.4, 3.2, 1.15, 220, 2.0);
                addObj(P.crates, cols - 4.2, rows - 3.2, 1.0, 15, 0.9);

                // Осадная линия атакующих слева: катапульты/пушки + боеприпасы + шатры + щиты
                const attX = Math.max(3.8, breachX - 8.5);
                addObj(P.siege, attX, midY - 3.8, 1.25, 0, 2.1);
                addObj(P.siegeAmmo, attX - 1.5, midY - 2.6, 0.95, 0, 0.8);
                addObj(P.siege, attX, midY + 3.8, 1.25, 0, 2.1);
                addObj(P.siegeAmmo, attX - 1.5, midY + 2.6, 0.95, 0, 0.8);
                addObj(P.campBigTents, 3.5, 3.4, 0.95, 10, 2.5);
                addObj(P.campTents, 3.5, rows - 3.4, 1.1, -15, 2.0);
                addObj(P.battleFire, breachX - 4.8, midY - 3.2, 0.95, 0, 1.2);
                addObj(P.battleFire, breachX - 4.8, midY + 3.4, 0.95, 0, 1.2);
            }
            else if (variant === 'river_crossing') {
                genTitle = MB_PICK(['Штурм речной переправы', 'Кровавый брод', 'Битва у мостов']);
                const rW = cols >= 28 ? 4 : 3;
                const rCols = [];
                for (let r = 0; r < rows; r++) {
                    const shift = Math.round(Math.sin(r * 0.25) * 2.2);
                    const sc = Math.max(6, Math.min(cols - rW - 6, midX - Math.floor(rW / 2) + shift));
                    rCols[r] = sc;
                    fillRect(sc - 2, r, sc + rW + 1, r, T.dirt);
                    fillRect(sc, r, sc + rW - 1, r, T.water);
                }
                const crossings = rows >= 18 ? [Math.floor(rows * 0.30), Math.floor(rows * 0.70)] : [midY];
                crossings.forEach((cr, idx) => {
                    fillRect(0, cr - 1, cols - 1, cr + 1, T.dirt);
                    for (let r = cr - 1; r <= cr + 1; r++) fillRect(rCols[r], r, rCols[r] + rW - 1, r, T.water);
                    placeBridgeH(rCols[cr], rCols[cr] + rW - 1, cr + 0.5, idx === 0);
                    // Плотные предмостные укрепления на правом берегу
                    addObj(P.barricades, rCols[cr] + rW + 2.2, cr - 1.5, 1.1, 255, 1.2);
                    addObj(P.barricades, rCols[cr] + rW + 2.2, cr + 2.2, 1.1, 285, 1.2);
                    addObj(P.battleFire, rCols[cr] - 1.8, cr + 1.5, 0.9, 0, 1.1);
                });
                // Артиллерия и лагеря с обеих сторон
                addObj(P.siege, Math.min(cols - 3.5, midX + 7.5), midY - 2.5, 1.2, 180, 2.0);
                addObj(P.siege, Math.min(cols - 3.5, midX + 7.5), midY + 2.5, 1.2, 180, 2.0);
                addObj(P.campBigTents, cols - 4.0, midY, 0.9, 270, 2.4);
                addObj(P.flags, cols - 6.5, midY - 1.2, 1.1, 0, 0.8);
                addObj(P.siege, Math.max(3.5, midX - 7.5), midY, 1.25, 0, 2.0);
                addObj(P.campTents, 3.6, 3.2, 1.1, 15, 2.0);
                addObj(P.campTents, 3.6, rows - 3.2, 1.1, -15, 2.0);
            }
            else if (variant === 'hill_redoubt') {
                genTitle = MB_PICK(['Укреплённый редут в кольце осады', 'Высота Псов Империи', 'Последний рубеж']);
                const radX = Math.min(9.5, cols * 0.27), radY = Math.min(6.5, rows * 0.30);
                fillDisc(midX, midY, radX + 2.2, radY + 2.2, T.dirt, 0.14);
                fillDisc(midX, midY, radX - 1.0, radY - 1.0, T.stone, 0.1);

                // Кольцо баррикад и кольев с 3 проходами для штурма
                const ringN = Math.max(12, Math.floor((radX + radY) * 1.35));
                for (let i = 0; i < ringN; i++) {
                    if (i === 0 || i === Math.floor(ringN / 3) || i === Math.floor((ringN * 2) / 3)) continue;
                    const ang = (i / ringN) * Math.PI * 2;
                    const bx = midX + Math.cos(ang) * radX, by = midY + Math.sin(ang) * radY;
                    if (inBounds(Math.floor(bx), Math.floor(by))) {
                        addObj(P.barricades, bx, by, 1.1, Math.round((ang * 180) / Math.PI) + 90, 1.15);
                    }
                }
                // Внутри редута: штабной павильон, знамёна, костёр, пушки
                addObj(P.campBigTents, midX, midY, 0.92, 0, 2.4);
                addObj(P.flags, midX + 2.4, midY - 1.6, 1.15, 0, 0.8);
                addObj(P.campfires, midX - 2.6, midY + 1.4, 1.05, 0, 1.3);
                addObj(P.siege, midX + radX * 0.62, midY + 1.5, 1.1, 20, 1.7);
                addObj(P.siege, midX - radX * 0.62, midY - 1.5, 1.1, 200, 1.7);

                // Вокруг редута — штурмовые позиции, огонь и рощи укрытий
                [[3.5, 3.5, 35], [cols - 3.5, 3.5, 145], [3.5, rows - 3.5, 325], [cols - 3.5, rows - 3.5, 215]].forEach(([sx, sy, rot]) => {
                    addObj(P.siege, sx, sy, 1.2, rot, 2.0);
                    addObj(P.siegeAmmo, sx + (sx < midX ? 1.5 : -1.5), sy, 0.9, 0, 0.8);
                });
                addObj(P.battleFire, midX - radX - 2.2, midY, 0.95, 0, 1.2);
                addObj(P.battleFire, midX + radX + 2.2, midY - 1.2, 0.95, 0, 1.2);
                scatterNaturalGroves([T.grass], P.trees, P.bushes, P.rocks, 0.75);
            }
            else {
                genTitle = MB_PICK(['Засада на обоз в лесу', 'Разгромленный караван', 'Бой на лесном тракте']);
                // Извилистая дорога через весь лес
                const roadY = [];
                for (let c = 0; c < cols; c++) {
                    const wave = Math.round(Math.sin(c * 0.20) * (rows >= 18 ? 3.2 : 1.6));
                    const ry = Math.max(4, Math.min(rows - 5, midY + wave));
                    roadY[c] = ry;
                    fillRect(c, ry - 1, c, ry + 1, T.dirt);
                }
                // Цепочка из 3–4 остановленных повозок, лошадей, горящего груза и спешных укрытий
                const wagonXs = cols >= 28 ? [midX - 7, midX - 2, midX + 3, midX + 8] : [midX - 4, midX + 1, midX + 5];
                wagonXs.forEach((wx, idx) => {
                    const wy = roadY[Math.max(0, Math.min(cols - 1, wx))] || midY;
                    addObj(P.carts, wx, wy + MB_RAND_FLOAT(-0.5, 0.5), 1.15, MB_RAND_INT(-28, 28), 1.9);
                    if (idx === 1) addObj(P.battleFire, wx + 1.4, wy - 0.6, 0.95, 0, 1.1);
                    if (idx % 2 === 0) addObj(P.crates, wx - 1.2, wy + 1.5, 0.9, MB_RAND_INT(0, 359), 0.8);
                    else addObj(P.barrels, wx + 1.1, wy - 1.5, 0.9, MB_RAND_INT(0, 359), 0.8);
                });
                // Поваленное дерево перекрывает дорогу впереди обоза!
                const blockX = Math.min(cols - 3, wagonXs[wagonXs.length - 1] + 3);
                addObj(P.logs, blockX, roadY[blockX] || midY, 1.35, 90, 1.6);
                addObj(P.barricades, Math.max(2.5, wagonXs[0] - 3), roadY[Math.max(0, wagonXs[0] - 3)] || midY, 1.05, 90, 1.4);

                scatterNaturalGroves([T.grass], P.trees, P.bushes, P.rocks, 1.25);
            }

            // Боевые следы (разбросанное оружие, щиты, завалы) по всей арене
            for (let i = 0; i < Math.floor((cols * rows) / 30); i++) {
                const fx = MB_RAND_FLOAT(2, cols - 2), fy = MB_RAND_FLOAT(1.5, rows - 1.5);
                const t = getTile(Math.floor(fx), Math.floor(fy));
                if (t === T.wall || t === T.water || !canPlace(fx, fy, 1.3)) continue;
                addObj(Math.random() < 0.62 ? P.battleLoot : P.rubble, fx, fy, 0.88, MB_RAND_INT(0, 359), 0.9);
            }
            MB_APPLY_RANDOM_MIRROR(data, true, true);
        }

        // ============================================================
        // 3. 🌲 ДИКИЙ ЛЕС (4 ОРГАНИЧЕСКИЕ СХЕМЫ С РОЩАМИ И ПОЛЯНАМИ!)
        // ============================================================
        else if (picked === 'forest') {
            const variant = MB_PICK_NEXT_VARIANT('forest', ['river_crossing', 'ancient_ruins', 'crossroads_camp', 'island_lake']);
            const isAutumn = Math.random() < 0.28;
            const leafTile = isAutumn ? T.leafR : T.leafG;
            if (isAutumn) { window._mbLighting = 'sunset'; data.lighting = 'sunset'; }

            // Органические пятна листвы на траве
            for (let i = 0; i < Math.floor((cols * rows) / 36); i++) {
                fillDisc(MB_RAND_FLOAT(2, cols - 2), MB_RAND_FLOAT(2, rows - 2), MB_RAND_FLOAT(1.6, 3.2), MB_RAND_FLOAT(1.4, 2.8), leafTile, 0.2);
            }

            if (variant === 'river_crossing') {
                genTitle = isAutumn ? 'Осенняя переправа' : MB_PICK(['Лесная переправа', 'Тропа через реку', 'Чаща у брода']);
                const rW = cols >= 28 ? 4 : 3;
                const rCols = [];
                const baseRx = MB_RAND_INT(Math.floor(cols * 0.36), Math.floor(cols * 0.64));
                for (let r = 0; r < rows; r++) {
                    const wave = Math.round(Math.sin(r * 0.24) * 2.5);
                    const sc = Math.max(4, Math.min(cols - rW - 4, baseRx + wave));
                    rCols[r] = sc;
                    fillRect(sc, r, sc + rW - 1, r, T.water);
                }
                const midY = MB_RAND_INT(Math.floor(rows * 0.35), Math.floor(rows * 0.65));
                for (let c = 0; c < cols; c++) {
                    const py = Math.max(2, Math.min(rows - 3, midY + Math.round(Math.sin(c * 0.2) * 1.2)));
                    for (let dy = 0; dy <= 1; dy++) if (getTile(c, py + dy) !== T.water) setTile(c, py + dy, T.dirt);
                }
                placeBridgeH(rCols[midY], rCols[midY] + rW - 1, midY + 0.8, Math.random() < 0.45);
                // Уютный привал путников на берегу
                const cx = baseRx > cols / 2 ? Math.max(4, baseRx - 5) : Math.min(cols - 5, baseRx + rW + 4);
                const cy = midY > rows / 2 ? 3.5 : rows - 3.8;
                fillDisc(cx, cy, 2.4, 2.0, T.dirt, 0.15);
                addObj(P.campfires, cx, cy, 1.05, 0, 1.5);
                addObj(P.campTents, cx - 2.0, cy - 0.6, 1.05, 25, 1.9);
                addObj(P.campGear, cx + 1.8, cy + 0.5, 0.92, 90, 1.0);
            }
            else if (variant === 'ancient_ruins') {
                genTitle = 'Заросшие руины в чаще';
                const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
                fillDisc(cx, cy, Math.min(7, cols * 0.24), Math.min(5, rows * 0.28), T.stone, 0.18);
                addObj(P.altars, cx + 0.5, cy + 0.5, 1.2, 0, 1.6);
                addObj(P.campfires, cx - 2.2, cy + 1.4, 1.0, 0, 1.4);
                addObj(P.chests, cx + 2.4, cy - 1.2, 0.9, 25, 1.0);
                [[-3.5, -2.5], [3.5, -2.5], [-3.5, 2.5], [3.5, 2.5]].forEach(([dx, dy]) => {
                    addObj(P.pillars, cx + dx, cy + dy, 1.0, 0, 1.0);
                    addObj(P.rubble, cx + dx * 1.35, cy + dy * 1.1, 1.05, MB_RAND_INT(0, 359), 1.2);
                });
            }
            else if (variant === 'crossroads_camp') {
                genTitle = isAutumn ? 'Осенний тракт' : 'Лесной перекрёсток и лагерь';
                const mx = Math.floor(cols / 2), my = Math.floor(rows / 2);
                for (let c = 0; c < cols; c++) { const w = Math.round(Math.sin(c * 0.2) * 1.2); fillRect(c, my - 1 + w, c, my + w, T.dirt); }
                for (let r = 0; r < rows; r++) { const w = Math.round(Math.sin(r * 0.25) * 1.2); fillRect(mx - 1 + w, r, mx + w, r, T.dirt); }
                const cx = Math.min(cols - 5, mx + 5.5), cy = Math.max(4, my - 4.5);
                fillDisc(cx, cy, 3.2, 2.6, T.dirt, 0.15);
                addObj(P.campfires, cx, cy, 1.1, 0, 1.5);
                addObj(P.campBigTents, cx + 2.4, cy - 1.0, 0.85, -25, 2.3);
                addObj(P.campTents, cx - 2.2, cy - 1.2, 1.05, 35, 1.8);
                addObj(P.carts, cx - 1.6, cy + 2.0, 1.0, 15, 1.7);
                addObj(P.campGear, cx + 1.8, cy + 1.4, 0.9, 60, 0.9);
            }
            else {
                genTitle = 'Лесное озеро с островком';
                const cx = cols / 2, cy = rows / 2;
                const rx = Math.min(9, cols * 0.30), ry = Math.min(6.5, rows * 0.34);
                fillDisc(cx, cy, rx, ry, T.water, 0.14);
                fillDisc(cx, cy, rx * 0.44, ry * 0.44, T.grass, 0.12);
                // Находим реальную полосу воды слева до островка и ставим полный мост
                const midY = Math.floor(cy);
                let wL = 0; while (wL < cols && getTile(wL, midY) !== T.water) wL++;
                let wR = wL; while (wR < cols && getTile(wR, midY) === T.water) wR++;
                if (wR > wL) placeBridgeH(wL, wR - 1, midY + 0.5, false);
                addObj(P.campfires, cx, cy, 1.05, 0, 1.4);
                addObj(P.chests, cx + 1.4, cy - 0.8, 0.9, 0, 0.9);
            }

            // Декор воды + естественные рощи деревьев и подлесок
            for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
                if (getTile(c, r) === T.water && canPlace(c + 0.5, r + 0.5, 1.6) && Math.random() < 0.14) {
                    addObj(P.waterDec, c + 0.5, r + 0.5, 0.95, MB_RAND_INT(0, 359), 1.0);
                }
            }
            scatterNaturalGroves([T.grass, leafTile], P.trees, isAutumn ? P.autumnBushes : P.bushes, Math.random() < 0.5 ? P.flowers : P.rocks, 1.15);
            scatterNaturalGroves([T.grass, leafTile], P.logs, P.fungi, P.rocks, 0.35);
            MB_APPLY_RANDOM_MIRROR(data, true, true);
        }

        // ============================================================
        // 4. 🏴‍☠️ ПИРАТСКАЯ БУХТА (2 СОЧНЫЕ БЕРЕГОВЫЕ СХЕМЫ)
        // ============================================================
        else if (picked === 'pirate') {
            const variant = MB_PICK_NEXT_VARIANT('pirate', ['smuggler_cove', 'treasure_island']);
            if (variant === 'smuggler_cove') {
                genTitle = 'Бухта Контрабандистов';
                const shoreAtRow = [];
                for (let r = 0; r < rows; r++) {
                    const curve = Math.round(Math.sin((r / rows) * Math.PI * 1.4) * (cols * 0.12));
                    const sx = Math.max(5, Math.min(cols - 8, Math.floor(cols * 0.40) + curve));
                    shoreAtRow[r] = sx;
                    fillRect(0, r, sx, r, T.water);
                    fillRect(sx + 5, r, cols - 1, r, T.grass);
                }
                const pierY = Math.floor(rows / 2);
                const sx = shoreAtRow[pierY];
                // Полный деревянный пирс в бухту + лодки рядом
                placeBridgeH(Math.max(2, sx - 3), sx + 1, pierY + 0.5, false);
                addObj(P.boats, Math.max(2.2, sx - 4.5), pierY + 2.6, 1.15, -20, 1.6);
                addObj(P.boats, Math.max(2.2, sx - 2.6), pierY - 3.0, 1.1, 18, 1.6);
                // Пиратский лагерь с сокровищами на пляже
                const cx = Math.min(cols - 4, sx + 3.4), cy = Math.max(3.2, pierY - 1.5);
                addObj(P.campfires, cx, cy, 1.05, 0, 1.5);
                addObj(P.campTents, cx + 2.4, cy - 1.2, 1.1, -30, 1.9);
                addObj(P.pirateLoot, cx + 1.5, cy + 1.3, 1.05, 25, 1.0);
                addObj(P.pirateLoot, cx - 0.8, cy + 2.2, 1.0, 110, 1.0);
                addObj(P.barrels, cx + 2.2, cy + 1.2, 0.9, 0, 0.8);
                addObj('camp_pirateflag', cx - 1.4, cy - 1.5, 1.1, 0, 0.8);
            } else {
                genTitle = 'Остров Сокровищ';
                fillRect(0, 0, cols - 1, rows - 1, T.water);
                const cx = cols / 2, cy = rows / 2;
                fillDisc(cx, cy, cols * 0.37, rows * 0.39, T.sand, 0.16);
                fillDisc(cx, cy, cols * 0.22, rows * 0.24, T.grass, 0.16);
                addObj(P.boats, Math.max(2.5, cx - cols * 0.37), cy + 1.0, 1.15, 20, 1.6);
                addObj(P.campfires, cx - 1.2, cy, 1.1, 0, 1.5);
                addObj(P.pirateLoot, cx + 1.6, cy - 0.6, 1.1, 20, 1.1);
                addObj(P.pirateLoot, cx + 0.6, cy + 1.6, 1.0, 140, 1.1);
                addObj('camp_pirateflag', cx + 2.4, cy - 1.8, 1.15, 0, 0.8);
            }
            scatterNaturalGroves([T.grass], P.palms, P.bushes, P.flowers, 1.1);
            scatterNaturalGroves([T.sand], P.beachLife, P.pirateLoot, P.rocks, 0.45);
            MB_APPLY_RANDOM_MIRROR(data, true, true);
        }

        // ============================================================
        // 5. 🏜️ ПУСТЫНЯ (2 НАСЫЩЕННЫЕ СХЕМЫ)
        // ============================================================
        else if (picked === 'desert') {
            const variant = MB_PICK_NEXT_VARIANT('desert', ['caravan_oasis', 'sunken_temple']);
            if (variant === 'caravan_oasis') {
                genTitle = 'Оазис и стоянка каравана';
                const ox = Math.floor(cols * MB_RAND_FLOAT(0.38, 0.62));
                const oy = Math.floor(rows * MB_RAND_FLOAT(0.38, 0.62));
                const rx = Math.min(5.5, cols * 0.18), ry = Math.min(4.2, rows * 0.22);
                fillDisc(ox, oy, rx + 2.0, ry + 1.8, T.grass, 0.16);
                fillDisc(ox, oy, rx, ry, T.water, 0.14);
                for (let a = 0; a < 9; a++) {
                    const ang = (a / 9) * Math.PI * 2 + MB_RAND_FLOAT(-0.15, 0.15);
                    const px = ox + Math.cos(ang) * (rx + 1.3), py = oy + Math.sin(ang) * (ry + 1.2);
                    if (inBounds(Math.floor(px), Math.floor(py)) && canPlace(px, py, 1.6)) addObj(P.palms, px, py, MB_RAND_FLOAT(0.95, 1.28), MB_RAND_INT(0, 359), 1.6);
                }
                const tx = ox > cols / 2 ? 4.8 : cols - 4.8, ty = oy > rows / 2 ? 4.2 : rows - 4.2;
                addObj(P.desertTents, tx, ty, 0.95, -20, 2.5);
                addObj(P.campTents, tx + (ox > tx ? 0.5 : -0.5), ty + (oy > ty ? 3.2 : -3.2), 1.05, 15, 1.9);
                addObj('camp_desert_campfire_1x1', tx + (ox > tx ? 2.8 : -2.8), ty + 0.6, 1.1, 0, 1.4);
                addObj(P.desertProps, tx + (ox > tx ? 2.2 : -2.2), ty - 1.5, 1.0, 40, 1.0);
            } else {
                genTitle = 'Занесённые песком руины храма';
                const cx = Math.floor(cols / 2), cy = Math.floor(rows / 2);
                fillDisc(cx, cy, Math.min(7.5, cols * 0.26), Math.min(5.2, rows * 0.30), T.flagstone, 0.18);
                addObj(P.altars, cx + 0.5, cy + 0.5, 1.25, 0, 1.7);
                addObj(P.chests, cx + 2.2, cy + 0.5, 0.95, 0, 1.0);
                addObj('camp_desert_campfire_1x1', cx - 2.6, cy + 0.6, 1.1, 0, 1.4);
                [[-4, -2.6], [4, -2.6], [-4, 2.6], [4, 2.6], [0, -3.2], [0, 3.2]].forEach(([dx, dy]) => {
                    if (canPlace(cx + dx, cy + dy, 1.2)) addObj(P.pillars, cx + dx, cy + dy, 1.05, 0, 1.1);
                });
                addObj(P.desertTents, 4.4, rows - 3.8, 0.9, 25, 2.4);
            }
            scatterNaturalGroves([T.sand], P.desertRocks, P.desertCacti, P.desertProps, 0.85);
            MB_APPLY_RANDOM_MIRROR(data, true, true);
        }

        // ============================================================
        // 6. 🍄 ФЕЙСКИЙ ЛЕС (2 ВОЛШЕБНЫЕ СХЕМЫ)
        // ============================================================
        else if (picked === 'fey') {
            const variant = MB_PICK_NEXT_VARIANT('fey', ['fey_glade', 'mushroom_grove']);
            const cx = cols / 2, cy = rows / 2;
            for (let i = 0; i < Math.floor((cols * rows) / 38); i++) {
                fillDisc(MB_RAND_FLOAT(2, cols - 2), MB_RAND_FLOAT(2, rows - 2), 2.4, 2.0, T.leafG, 0.2);
            }
            if (variant === 'fey_glade') {
                genTitle = 'Фейское озеро и трон';
                fillDisc(cx, cy, Math.min(5.0, cols * 0.18), Math.min(3.8, rows * 0.22), T.water, 0.15);
                addObj('furniture_feythrone', cx, Math.max(2.5, cy - Math.min(4.5, rows * 0.26)), 1.25, 0, 1.8);
                for (let a = 0; a < 6; a++) {
                    const ang = (a / 6) * Math.PI * 2;
                    addObj(P.feyCrystals, cx + Math.cos(ang) * 5.2, cy + Math.sin(ang) * 4.0, 1.0, 0, 1.2);
                }
            } else {
                genTitle = 'Светящаяся грибная роща';
                for (let c = 0; c < cols; c++) {
                    const py = Math.max(3, Math.min(rows - 4, Math.floor(cy + Math.sin(c * 0.24) * 2.4)));
                    fillRect(c, py - 1, c, py, T.leafG);
                }
                addObj('furniture_feythrone', cx, cy, 1.25, 0, 1.8);
                for (let a = 0; a < 8; a++) {
                    const ang = (a / 8) * Math.PI * 2;
                    addObj(a % 2 === 0 ? P.feyCrystals : P.feyDecor, cx + Math.cos(ang) * 4.0, cy + Math.sin(ang) * 3.2, 1.05, 0, 1.2);
                }
            }
            for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
                if (getTile(c, r) === T.water && canPlace(c + 0.5, r + 0.5, 1.5) && Math.random() < 0.22) addObj(P.waterDec, c + 0.5, r + 0.5, 0.95, MB_RAND_INT(0, 359), 0.9);
            }
            scatterNaturalGroves([T.grass, T.leafG], P.feyTrees, P.feyFungi, P.feyDecor, 1.2);
        }

        // ============================================================
        // 7. ⛺ ЛАГЕРЬ ОХОТНИКОВ / ОРКОВ (2 ОБЖИТЫЕ СХЕМЫ)
        // ============================================================
        else if (picked === 'warcamp') {
            const variant = MB_PICK_NEXT_VARIANT('warcamp', ['hunting_camp', 'raider_fort']);
            const cx = cols / 2, cy = rows / 2;
            const rx = Math.min(10, cols * 0.34), ry = Math.min(7, rows * 0.35);
            fillDisc(cx, cy, rx, ry, T.dirt, 0.16);

            if (variant === 'hunting_camp') {
                genTitle = 'Стойбище охотников';
                addObj('camp_campfire_hog', cx, cy, 1.25, 0, 1.7);
                addObj('camp_totemlarge', cx - 2.4, cy - 1.5, 1.15, 0, 1.4);
                const tentN = cols >= 28 ? 7 : 5;
                for (let a = 0; a < tentN; a++) {
                    const ang = (a / tentN) * Math.PI * 2 + 0.25;
                    const tx = cx + Math.cos(ang) * (rx * 0.72), ty = cy + Math.sin(ang) * (ry * 0.72);
                    if (inBounds(Math.floor(tx), Math.floor(ty)) && canPlace(tx, ty, 2.2)) {
                        addObj(P.orcTents, tx, ty, 1.12, Math.round((ang * 180) / Math.PI) + 90, 2.2);
                    }
                }
            } else {
                genTitle = 'Укреплённый лагерь орков';
                // Кольцо частокола и баррикад по границе лагеря с воротами!
                const ringN = Math.max(14, Math.floor((rx + ry) * 1.4));
                for (let i = 0; i < ringN; i++) {
                    if (i === 0 || i === 1) continue; // Ворота в лагерь
                    const ang = (i / ringN) * Math.PI * 2;
                    const bx = cx + Math.cos(ang) * rx, by = cy + Math.sin(ang) * ry;
                    if (inBounds(Math.floor(bx), Math.floor(by))) addObj(P.barricades, bx, by, 1.08, Math.round((ang * 180) / Math.PI) + 90, 1.15);
                }
                addObj(P.watchpost, cx + rx * 0.92, cy - 2.4, 1.05, 0, 1.8);
                addObj('camp_campfire_hog', cx, cy, 1.25, 0, 1.7);
                addObj(P.campBigTents, cx - rx * 0.45, cy, 0.9, 90, 2.4);
                addObj(P.orcTents, cx + 1.5, cy - ry * 0.55, 1.1, 180, 2.0);
                addObj(P.orcTents, cx + 1.5, cy + ry * 0.55, 1.1, 0, 2.0);
            }
            // Внутри лагеря — тотемы, сушилки шкур, стойки оружия; снаружи — густой лес
            for (let i = 0; i < Math.floor((cols * rows) / 28); i++) {
                const px = cx + MB_RAND_FLOAT(-rx * 0.75, rx * 0.75);
                const py = cy + MB_RAND_FLOAT(-ry * 0.75, ry * 0.75);
                if (getTile(Math.floor(px), Math.floor(py)) === T.dirt && canPlace(px, py, 1.4)) {
                    addObj(P.orcProps, px, py, 1.0, MB_RAND_INT(0, 359), 1.2);
                }
            }
            scatterNaturalGroves([T.grass], P.trees, P.bushes, P.rocks, 1.15);
            MB_APPLY_RANDOM_MIRROR(data, true, true);
        }

        // ============================================================
        // 8. ❄️ СНЕЖНЫЙ ПЕРЕВАЛ (2 АТМОСФЕРНЫЕ ЗИМНИЕ СХЕМЫ)
        // ============================================================
        else if (picked === 'snow') {
            const variant = MB_PICK_NEXT_VARIANT('snow', ['frozen_lake', 'mountain_pass']);
            const midY = Math.floor(rows / 2);
            if (variant === 'frozen_lake') {
                genTitle = 'Замёрзшее озеро и привал';
                const lx = cols * 0.54, ly = rows * 0.50;
                const rx = Math.min(7.5, cols * 0.24), ry = Math.min(5.5, rows * 0.30);
                fillDisc(lx, ly, rx, ry, T.ice, 0.16);
                fillDisc(lx, ly, rx * 0.55, ry * 0.55, T.water, 0.14);
                // Горная тропа + полный мост через полынью
                let wL = 0; while (wL < cols && getTile(wL, midY) !== T.water) wL++;
                let wR = wL; while (wR < cols && getTile(wR, midY) === T.water) wR++;
                for (let c = 0; c < cols; c++) if (getTile(c, midY) === T.snow) { setTile(c, midY, T.stone); setTile(c, midY - 1, T.stone); }
                if (wR > wL) placeBridgeH(wL, wR - 1, midY + 0.5, false);

                // Тёплый лагерь экспедиции на берегу
                const cx = Math.max(4.0, cols * 0.18), cy = Math.max(3.6, rows * 0.28);
                fillDisc(cx, cy, 2.8, 2.2, T.dirt, 0.15);
                addObj(P.campfires, cx, cy, 1.15, 0, 1.5);
                addObj(P.campBigTents, cx - 1.5, cy + 2.0, 0.85, 25, 2.3);
                addObj(P.snowPelts, cx + 1.8, cy + 0.4, 1.0, 90, 1.0);
                addObj(P.crates, cx + 1.6, cy - 1.4, 0.9, 15, 0.9);
            } else {
                genTitle = 'Снежное ущелье и горный пост';
                // Органические неровные скалы-стены сверху и снизу (не прямоугольник!)
                for (let c = 0; c < cols; c++) {
                    const topEdge = Math.max(2, Math.min(Math.floor(rows * 0.32), Math.floor(rows * 0.20 + Math.sin(c * 0.25) * 2.0)));
                    const botEdge = Math.max(Math.floor(rows * 0.68), Math.min(rows - 3, Math.floor(rows * 0.80 + Math.cos(c * 0.22) * 2.0)));
                    fillRect(c, 0, c, topEdge, T.wall);
                    fillRect(c, botEdge, c, rows - 1, T.wall);
                    const py = Math.floor((topEdge + botEdge) / 2);
                    fillRect(c, py - 1, c, py + 1, T.stone);
                }
                const postX = Math.floor(cols * 0.52);
                addObj(P.campfires, postX, midY - 2.2, 1.15, 0, 1.5);
                addObj(P.campTents, postX - 2.4, midY - 2.4, 1.1, 15, 1.9);
                addObj(P.barricades, postX + 2.8, midY, 1.1, 270, 1.3);
                addObj(P.snowPelts, postX + 1.4, midY - 2.0, 0.95, 45, 0.9);
            }
            scatterNaturalGroves([T.snow], P.trees, P.snowRocks, P.rockBig, 0.9);
            MB_APPLY_RANDOM_MIRROR(data, true, true);
        }

        const titleInp = document.getElementById('mb-map-title-inp');
        if (titleInp) titleInp.value = genTitle;

        window._mbData = data;
        SAVE_MB_DATA(data);
        RENDER_GM_MAP_BUILDER_UI();
    };
})();