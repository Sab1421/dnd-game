// ================================================================
// 🏛️ БЛОК 1: ПРОЦЕДУРНЫЙ ГЕНЕРАТОР ИНТЕРЬЕРОВ (100% РАНДОМ + ЛОГИКА)
// Покрывает: Таверна, Особняк, Подземелье, Кузница дварфов, Восточный храм
// ================================================================
(function INSTALL_PROCEDURAL_INTERIORS_V4() {
    const _PREV_GEN = MB_GENERATE_RANDOM;
    const TARGETS = ['tavern', 'mansion', 'dungeon', 'dwarven', 'eastern'];

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
            cobble:    Math.random() < 0.5 ? MB_PICK_TILE_FAMILY('cobble', 'flagstone') : MB_PICK_TILE_FAMILY('flagstone', 'stone'),
            wood:      MB_PICK_TILE_FAMILY('wood', 'wood'),
            wall:      MB_PICK_TILE_FAMILY('wall', 'wall'),
            lava:      MB_PICK_TILE_FAMILY('lava', 'lava'),
            water:     'water',
            abyss:     'abyss'
        };

        // Случайное окружение: городская таверна / лесной трактир / подземный комплекс
        const isUrbanTavern = (picked === 'tavern' && Math.random() < 0.35);
        const outdoorBase = (picked === 'dungeon' || picked === 'dwarven')
            ? T.wall
            : (isUrbanTavern ? T.cobble : T.grass);

        const lights = {
            tavern:  ['tavern', 'tavern', 'sunset', 'night'],
            mansion: ['tavern', 'day', 'sunset'],
            dungeon: ['dungeon', 'night'],
            dwarven: ['dungeon', 'tavern'],
            eastern: ['day', 'sunset', 'night']
        };
        window._mbLighting = MB_PICK(lights[picked] || ['day']);

        const data = CREATE_EMPTY_MB_DATA(outdoorBase, cols, rows);
        data.lighting = window._mbLighting;

        const inB = (c, r) => c >= 0 && c < cols && r >= 0 && r < rows;
        const getT = (c, r) => inB(c, r) ? data.cells[r * cols + c].t : null;
        const setT = (c, r, t) => { if (inB(c, r)) data.cells[r * cols + c].t = t; };
        const isWall = (c, r) => /^wall/.test(getT(c, r) || '');
        const fillRect = (x1, y1, x2, y2, t) => {
            for (let r = Math.max(0, Math.floor(y1)); r <= Math.min(rows - 1, Math.floor(y2)); r++)
                for (let c = Math.max(0, Math.floor(x1)); c <= Math.min(cols - 1, Math.floor(x2)); c++) setT(c, r, t);
        };
        const fillDisc = (cx, cy, rx, ry, t, wob = 0.16) => {
            for (let r = Math.max(0, Math.floor(cy - ry - 2)); r <= Math.min(rows - 1, Math.ceil(cy + ry + 2)); r++)
                for (let c = Math.max(0, Math.floor(cx - rx - 2)); c <= Math.min(cols - 1, Math.ceil(cx + rx + 2)); c++) {
                    const d = Math.hypot((c - cx) / Math.max(0.5, rx), (r - cy) / Math.max(0.5, ry));
                    if (d < 1.0 + Math.sin(c * 0.65 + r * 0.55) * wob) setT(c, r, t);
                }
        };

        const placedZones = [];
        const doorSpots = [];
        const canPlace = (x, y, minDist = 1.0, checkDoors = true, allowWall = false) => {
            const gx = Math.floor(x), gy = Math.floor(y);
            if (!inB(gx, gy)) return false;
            if (!allowWall && isWall(gx, gy)) return false;
            if (checkDoors && doorSpots.some(d => Math.hypot(d.x - x, d.y - y) < Math.max(1.35, minDist))) return false;
            return !placedZones.some(z => Math.hypot(z.x - x, z.y - y) < Math.max(minDist, z.r));
        };
        const addObj = (poolOrId, x, y, scale = 1.0, rot = 0, reserve = 0) => {
            const id = Array.isArray(poolOrId) ? MB_PICK(poolOrId) : poolOrId;
            if (!id) return false;
            const stObj = MB_FIND_STAMP_OBJ(id);
            if (!stObj) return false;
            if (stObj.img) MB_GET_LOADED_IMG(stObj.img);
            data.objects.push({ id, x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100, scale, rot });
            if (reserve > 0) placedZones.push({ x, y, r: reserve });
            return true;
        };

        // --- ПУЛЫ РАБОЧИХ СПРАЙТОВ (ПРОВЕРЕНЫ ПО ТВОЕМУ assets.js) ---
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

        // ============================================================
        // 🧩 ЯДРО 1: ПРОЦЕДУРНОЕ ВЫРАЩИВАНИЕ ГРАФА КОМНАТ
        // ============================================================
        function growRooms(cfg) {
            const rooms = [];
            const edges = [];
            const mX = cfg.marginX, mY = cfg.marginY;

            const sw = Math.min(cols - mX * 2, MB_RAND_INT(cfg.seedW[0], cfg.seedW[1]));
            const sh = Math.min(rows - mY * 2, MB_RAND_INT(cfg.seedH[0], cfg.seedH[1]));
            const sx1 = MB_RAND_INT(mX, Math.max(mX, cols - mX - sw));
            const sy1 = MB_RAND_INT(mY, Math.max(mY, rows - mY - sh));
            const sx2 = sx1 + sw - 1, sy2 = sy1 + sh - 1;

            rooms.push({
                id: 0, x1: sx1, y1: sy1, x2: sx2, y2: sy2,
                iw: sw - 2, ih: sh - 2, cx: (sx1 + sx2 + 1) / 2, cy: (sy1 + sy2 + 1) / 2,
                dist: 0, floor: cfg.defaultFloor, role: cfg.seedRole
            });

            const overlapsAny = (x1, y1, x2, y2, gap = 0) => rooms.some(r =>
                x1 < r.x2 + gap && x2 > r.x1 - gap && y1 < r.y2 + gap && y2 > r.y1 - gap
            );

            // Случайный стиль роста: «компактный куст» (от центра) или «вытянутые крылья» (от последних комнат)
            const preferSprawl = Math.random() < 0.5;
            let attempts = 0;
            while (rooms.length < cfg.targetRooms && attempts < 280) {
                attempts++;
                const parent = (preferSprawl && Math.random() < 0.6)
                    ? rooms[rooms.length - 1]
                    : MB_PICK(rooms);
                const dir = MB_PICK(['N', 'S', 'E', 'W']);
                const nw = MB_RAND_INT(cfg.roomW[0], cfg.roomW[1]);
                const nh = MB_RAND_INT(cfg.roomH[0], cfg.roomH[1]);

                let nx1, ny1, nx2, ny2;
                if (dir === 'E') {
                    nx1 = parent.x2; nx2 = nx1 + nw - 1;
                    const minY = Math.max(mY, parent.y1 - nh + 3);
                    const maxY = Math.min(rows - mY - nh, parent.y2 - 2);
                    if (minY > maxY) continue;
                    ny1 = MB_RAND_INT(minY, maxY); ny2 = ny1 + nh - 1;
                } else if (dir === 'W') {
                    nx2 = parent.x1; nx1 = nx2 - nw + 1;
                    const minY = Math.max(mY, parent.y1 - nh + 3);
                    const maxY = Math.min(rows - mY - nh, parent.y2 - 2);
                    if (minY > maxY) continue;
                    ny1 = MB_RAND_INT(minY, maxY); ny2 = ny1 + nh - 1;
                } else if (dir === 'S') {
                    ny1 = parent.y2; ny2 = ny1 + nh - 1;
                    const minX = Math.max(mX, parent.x1 - nw + 3);
                    const maxX = Math.min(cols - mX - nw, parent.x2 - 2);
                    if (minX > maxX) continue;
                    nx1 = MB_RAND_INT(minX, maxX); nx2 = nx1 + nw - 1;
                } else {
                    ny2 = parent.y1; ny1 = ny2 - nh + 1;
                    const minX = Math.max(mX, parent.x1 - nw + 3);
                    const maxX = Math.min(cols - mX - nw, parent.x2 - 2);
                    if (minX > maxX) continue;
                    nx1 = MB_RAND_INT(minX, maxX); nx2 = nx1 + nw - 1;
                }

                if (nx1 < mX || ny1 < mY || nx2 > cols - 1 - mX || ny2 > rows - 1 - mY) continue;
                if (overlapsAny(nx1, ny1, nx2, ny2, 0)) continue;

                const child = {
                    id: rooms.length, x1: nx1, y1: ny1, x2: nx2, y2: ny2,
                    iw: nw - 2, ih: nh - 2, cx: (nx1 + nx2 + 1) / 2, cy: (ny1 + ny2 + 1) / 2,
                    dist: parent.dist + 1, floor: cfg.defaultFloor, role: ''
                };
                rooms.push(child);
                edges.push({ a: parent, b: child });
            }

            // Случайные круговые переходы между смежными комнатами
            for (let i = 0; i < rooms.length; i++) {
                for (let j = i + 1; j < rooms.length; j++) {
                    if (edges.some(e => (e.a.id === i && e.b.id === j) || (e.a.id === j && e.b.id === i))) continue;
                    if (Math.random() > 0.35) continue;
                    const a = rooms[i], b = rooms[j];
                    const shareV = (a.x2 === b.x1 || b.x2 === a.x1) && (Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1) >= 2);
                    const shareH = (a.y2 === b.y1 || b.y2 === a.y1) && (Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1) >= 2);
                    if (shareV || shareH) edges.push({ a, b });
                }
            }
            return { rooms, edges };
        }

        function growDungeonGraph() {
            const rooms = [];
            const target = Math.max(5, Math.min(18, Math.floor((cols * rows) / 48) + MB_RAND_INT(-1, 2)));
            for (let a = 0; a < target * 22 && rooms.length < target; a++) {
                const rw = MB_RAND_INT(5, Math.min(10, Math.max(6, Math.floor(cols * 0.30))));
                const rh = MB_RAND_INT(5, Math.min(9, Math.max(6, Math.floor(rows * 0.34))));
                const rx1 = MB_RAND_INT(1, Math.max(1, cols - rw - 1));
                const ry1 = MB_RAND_INT(1, Math.max(1, rows - rh - 1));
                const rx2 = rx1 + rw - 1, ry2 = ry1 + rh - 1;
                const gap = Math.random() < 0.5 ? 1 : 0;
                if (rooms.some(r => rx1 < r.x2 + gap && rx2 > r.x1 - gap && ry1 < r.y2 + gap && ry2 > r.y1 - gap)) continue;
                rooms.push({
                    id: rooms.length, x1: rx1, y1: ry1, x2: rx2, y2: ry2,
                    iw: rw - 2, ih: rh - 2, cx: (rx1 + rx2 + 1) / 2, cy: (ry1 + ry2 + 1) / 2,
                    dist: 0, floor: Math.random() < 0.5 ? T.stone : T.flagstone, role: ''
                });
            }
            if (!rooms.length) {
                rooms.push({ id: 0, x1: 2, y1: 2, x2: cols - 3, y2: rows - 3, iw: cols - 6, ih: rows - 6, cx: cols / 2, cy: rows / 2, dist: 0, floor: T.stone, role: 'entry' });
            }
            return rooms;
        }

        const placeDoor = (c, r, floorT, verticalWall, pool = P.doors) => {
            setT(c, r, floorT);
            doorSpots.push({ x: c + 0.5, y: r + 0.5 });
            addObj(pool, c + 0.5, r + 0.5, 0.92, verticalWall ? 90 : 0, 0.9);
        };

        const placeBridge = (xStart, xEnd, yCenter, isStone = false) => {
            const span = (xEnd - xStart + 1) + 1.4;
            const pool = isStone ? P.stoneBridge : P.woodBridge;
            const count = Math.max(1, Math.ceil(span / 3.4));
            const seg = span / count;
            const sc = Math.max(0.76, seg / 3.5);
            for (let i = 0; i < count; i++) {
                addObj(pool, (xStart - 0.7) + seg * (i + 0.5), yCenter, sc, 0, 1.4);
            }
        };

        // Ищет глухие внутренние стены комнаты с аккуратным отступом внутрь (без захода в камень!)
        function getSolidWalls(rm) {
            const sides = [];
            const nearDoor = (x, y) => doorSpots.some(d => Math.hypot(d.x - x, d.y - y) < 1.75);
            if (rm.iw >= 3) {
                const mx = (rm.x1 + rm.x2 + 1) / 2;
                if (!nearDoor(mx, rm.y1 + 0.5)) sides.push({ dir: 'N', x: mx, y: rm.y1 + 1.55, rot: 0 });
                if (!nearDoor(mx, rm.y2 + 0.5)) sides.push({ dir: 'S', x: mx, y: rm.y2 - 0.55, rot: 180 });
            }
            if (rm.ih >= 3) {
                const my = (rm.y1 + rm.y2 + 1) / 2;
                if (!nearDoor(rm.x1 + 0.5, my)) sides.push({ dir: 'W', x: rm.x1 + 1.55, y: my, rot: 90 });
                if (!nearDoor(rm.x2 + 0.5, my)) sides.push({ dir: 'E', x: rm.x2 - 0.55, y: my, rot: 270 });
            }
            return sides;
        }

        // ============================================================
        // 🪑 ЯДРО 2: НАПОЛНЕНИЕ КОМНАТ ПО РОЛЯМ И ГАБАРИТАМ
        // ============================================================
        function placeTableCluster(cx, cy, isLong = false) {
            if (!canPlace(cx, cy, isLong ? 1.9 : 1.6)) return false;
            addObj(isLong ? P.tavLongTbl : P.tavTables, cx, cy, isLong ? 0.96 : MB_RAND_FLOAT(0.84, 0.96), isLong ? 0 : MB_PICK([0, 90]), isLong ? 1.65 : 1.45);
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

        function furnishRoom(rm) {
            const { x1, y1, x2, y2, iw, ih, cx, cy, role } = rm;
            const solidWalls = getSolidWalls(rm);
            const pickWall = () => solidWalls.length ? solidWalls.splice(Math.floor(Math.random() * solidWalls.length), 1)[0] : null;
            const corners = [
                { x: x1 + 1.55, y: y1 + 1.55 }, { x: x2 - 0.55, y: y1 + 1.55 },
                { x: x1 + 1.55, y: y2 - 0.55 }, { x: x2 - 0.55, y: y2 - 0.55 }
            ].filter(pt => canPlace(pt.x, pt.y, 0.85));

            if (role === 'tavern_hall') {
                const fw = pickWall();
                if (fw) addObj(P.fireplaces, fw.x, fw.y, 1.02, fw.rot, 1.35);
                addObj(P.rugs, cx, cy, Math.min(1.3, Math.min(iw, ih) * 0.22), 0, 0);
                addObj(P.chandeliers, cx, cy, 0.98, 0, 0);

                // Барная стойка вдоль глухой стены (строго внутри границ комнаты)
                const bw = pickWall();
                if (bw && (iw >= 5 || ih >= 5)) {
                    const horiz = (bw.dir === 'N' || bw.dir === 'S');
                    const span = Math.min(4, Math.max(2, Math.floor((horiz ? iw : ih) * 0.50)));
                    const inset = (bw.dir === 'N' || bw.dir === 'W') ? 0.95 : -0.95;
                    for (let i = 0; i < span; i++) {
                        const off = (i - (span - 1) / 2) * 1.05;
                        const bx = horiz ? (bw.x + off) : (bw.x + inset);
                        const by = horiz ? (bw.y + inset) : (bw.y + off);
                        if (!canPlace(bx, by, 0.85)) continue;
                        addObj(P.barStraight, bx, by, 0.9, horiz ? 0 : 90, 0.8);
                        const sx = horiz ? bx : (bx + inset * 0.92), sy = horiz ? (by + inset * 0.92) : by;
                        const brx = horiz ? bx : (bx - inset * 0.82), bry = horiz ? (by - inset * 0.82) : by;
                        if (canPlace(sx, sy, 0.35, true)) addObj(P.tavStools, sx, sy, 0.72, 0, 0.4);
                        if (Math.random() < 0.8 && canPlace(brx, bry, 0.35, true)) addObj(P.barrels, brx, bry, 0.75, MB_RAND_INT(0, 359), 0.4);
                    }
                    addObj(P.candles, bw.x, bw.y + (horiz ? inset : 0), 0.6, 0, 0);
                }

                // Несколько уютных групп столиков (живая посадка, не ряды столовой)
                let tablesLeft = Math.max(2, Math.min(6, Math.floor((iw * ih) / 14)));
                for (let t = 0; t < 36 && tablesLeft > 0; t++) {
                    const tx = MB_RAND_FLOAT(x1 + 2.1, x2 - 1.1);
                    const ty = MB_RAND_FLOAT(y1 + 2.1, y2 - 1.1);
                    if (placeTableCluster(tx, ty, Math.random() < 0.35)) tablesLeft--;
                }
            }
            else if (role === 'kitchen') {
                fillRect(x1 + 1, y1 + 1, x2 - 1, y2 - 1, T.flagstone);
                const fw = pickWall();
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
                const bw = pickWall();
                if (bw) addObj(P.beds, bw.x, bw.y, 0.92, bw.rot, 1.25);
                else if (canPlace(cx, cy, 1.0)) addObj(P.beds, cx, cy, 0.9, 0, 1.2);
                const sw = pickWall();
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
                if (canPlace(cx, cy, 1.3)) addObj(P.manLuxury, cx, cy, 0.95, MB_PICK([0, 90]), 1.4);
                const w1 = pickWall();
                if (w1 && canPlace(w1.x, w1.y, 0.9)) addObj(P.manSofas, w1.x, w1.y, 0.88, w1.rot, 1.0);
                const w2 = pickWall();
                if (w2 && canPlace(w2.x, w2.y, 0.9)) addObj(P.fireplaces, w2.x, w2.y, 0.95, w2.rot, 1.1);
                if (Math.random() < 0.5 && corners[0]) addObj(P.manCats, corners[0].x, corners[0].y, 0.78, MB_RAND_INT(0, 359), 0);
            }
            else if (role === 'foyer') {
                fillRect(x1 + 1, y1 + 1, x2 - 1, y2 - 1, T.flagstone);
                addObj(P.rugs, cx, cy, Math.min(1.15, Math.min(iw, ih) * 0.25), 0, 0);
                addObj(P.chandeliers, cx, cy, 1.0, 0, 0);
                const sw = pickWall();
                if (sw && canPlace(sw.x, sw.y, 1.1)) addObj(P.stoneStairs, sw.x, sw.y, 0.88, sw.rot, 1.3);
                corners.slice(0, 2).forEach(pt => addObj('other_feature_suit_of_armor_2_gold', pt.x, pt.y, 0.82, 0, 0.8));
            }
            else if (role === 'throne') {
                fillRect(x1 + 1, y1 + 1, x2 - 1, y2 - 1, T.flagstone);
                addObj(P.rugs, cx, cy, Math.min(1.35, Math.min(iw, ih) * 0.25), 0, 0);
                addObj(P.chandeliers, cx, cy, 1.05, 0, 0);
                const tw = pickWall();
                if (tw) addObj('furniture_chair_throne_stone', tw.x, tw.y, 1.15, tw.rot, 1.4);
                corners.forEach(pt => addObj(Math.random() < 0.5 ? P.braziers : P.pillars, pt.x, pt.y, 0.85, 0, 0.8));
            }
            else if (role === 'library' || role === 'observatory') {
                addObj(P.rugs, cx, cy, Math.min(1.15, Math.min(iw, ih) * 0.26), 0, 0);
                if (role === 'observatory' && canPlace(cx, cy, 1.4)) {
                    addObj('other_feature_orrery_huge_gold', cx, cy, 1.05, 0, 1.6);
                    corners.slice(0, 2).forEach(pt => addObj(P.crystals, pt.x, pt.y, 0.85, 0, 0.8));
                } else if (canPlace(cx, cy, 1.1)) {
                    addObj('furniture_table_writing_desk_dark', cx, cy, 0.92, 0, 1.2);
                    addObj(P.candles, cx + 0.4, cy, 0.6, 0, 0);
                }
                while (solidWalls.length) {
                    const w = pickWall();
                    if (w && canPlace(w.x, w.y, 0.9)) addObj(P.manBooks, w.x, w.y, 0.9, w.rot, 0.95);
                }
            }
            else if (role === 'dining') {
                addObj(P.rugs, cx, cy, Math.min(1.2, Math.min(iw, ih) * 0.28), 0, 0);
                addObj(P.chandeliers, cx, cy, 0.95, 0, 0);
                placeTableCluster(cx, cy, true);
                const fw = pickWall();
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
                const lw = pickWall();
                if (lw && iw >= 5 && ih >= 5) {
                    if (lw.dir === 'N') fillRect(x1 + 2, y1 + 1, x2 - 2, y1 + 1, T.lava);
                    else if (lw.dir === 'S') fillRect(x1 + 2, y2 - 1, x2 - 2, y2 - 1, T.lava);
                    else if (lw.dir === 'W') fillRect(x1 + 1, y1 + 2, x1 + 1, y2 - 2, T.lava);
                    else fillRect(x2 - 1, y1 + 2, x2 - 1, y2 - 2, T.lava);
                }
                const fw = pickWall();
                if (fw) addObj(P.dwForge, fw.x, fw.y, 1.08, fw.rot, 1.4);
                else if (canPlace(cx, cy, 1.2)) addObj(P.dwForge, cx, cy, 1.05, 0, 1.4);
                if (canPlace(cx, cy, 1.1)) addObj(P.dwAnvil, cx, cy, 0.95, 0, 1.0);
                corners.slice(0, 3).forEach(pt => {
                    if (getT(Math.floor(pt.x), Math.floor(pt.y)) !== T.lava) addObj(P.dwLoot, pt.x, pt.y, 0.88, MB_RAND_INT(0, 359), 0.85);
                });
            }
            else if (role === 'dojo') {
                addObj(P.eastMats, cx, cy, Math.min(1.25, Math.min(iw, ih) * 0.24), 0, 0);
                const sw = pickWall();
                if (sw) addObj(Math.random() < 0.5 ? 'other_shrine_1' : 'other_shrine_2', sw.x, sw.y, 1.08, sw.rot, 1.3);
                corners.slice(0, 2).forEach(pt => addObj(P.eastLights, pt.x, pt.y, 0.82, 0, 0.7));
                corners.slice(2, 4).forEach(pt => addObj(P.eastDecor, pt.x, pt.y, 0.88, MB_RAND_INT(0, 359), 0.85));
            }
            else if (role === 'tea_room') {
                addObj(P.eastMats, cx, cy, Math.min(1.05, Math.min(iw, ih) * 0.26), 0, 0);
                if (canPlace(cx, cy, 1.1)) addObj(P.eastTables, cx, cy, 0.92, 0, 1.1);
                if (corners[0]) addObj(P.eastLights, corners[0].x, corners[0].y, 0.8, 0, 0.7);
                if (corners[1]) addObj(P.eastDecor, corners[1].x, corners[1].y, 0.85, 0, 0.8);
            }
            else if (role === 'monk_room') {
                const fw = pickWall();
                if (fw) addObj(P.eastFuton, fw.x, fw.y, 0.95, fw.rot, 1.1);
                else if (canPlace(cx, cy, 1.0)) addObj(P.eastFuton, cx, cy, 0.92, 0, 1.1);
                if (corners[0]) addObj(P.eastLights, corners[0].x, corners[0].y, 0.78, 0, 0.7);
                if (corners[1]) addObj(P.eastDecor, corners[1].x, corners[1].y, 0.82, 0, 0.8);
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
        // 🏗️ ЯДРО 3: СБОРКА КОМПЛЕКСА + ВНЕШНЕГО МИРА
        // ============================================================
        let genTitle = 'Локация';

        if (picked === 'dungeon') {
            genTitle = MB_PICK(['Забытые катакомбы', 'Тайные казематы', 'Склепы Ошибки', 'Подземелье Древних', 'Лабиринт Теней']);
            const rooms = growDungeonGraph();

            rooms.forEach(rm => fillRect(rm.x1 + 1, rm.y1 + 1, rm.x2 - 1, rm.y2 - 1, rm.floor));

            // Минимальное остовное дерево + 1–2 кольцевых прохода
            const connected = [rooms[0]];
            const rest = rooms.slice(1);
            const links = [];
            while (rest.length) {
                let bestA = null, bestBIdx = 0, bestD = 1e9;
                rest.forEach((b, bi) => {
                    connected.forEach(a => {
                        const d = Math.hypot(a.cx - b.cx, a.cy - b.cy);
                        if (d < bestD) { bestD = d; bestA = a; bestBIdx = bi; }
                    });
                });
                const chosen = rest.splice(bestBIdx, 1)[0];
                chosen.dist = bestA.dist + 1;
                connected.push(chosen);
                links.push([bestA, chosen]);
            }
            if (rooms.length >= 4) links.push([rooms[0], rooms[rooms.length - 1]]);

            const corrW = cols >= 28 ? 2 : 1;
            const corrFloor = Math.random() < 0.5 ? T.stone : T.flagstone;
            links.forEach(([a, b]) => {
                let x = Math.floor(a.cx), y = Math.floor(a.cy);
                const tx = Math.floor(b.cx), ty = Math.floor(b.cy);
                const horizFirst = Math.random() < 0.5;
                if (horizFirst) {
                    while (x !== tx) { for (let d = 0; d < corrW; d++) if (inB(x, y + d) && y + d > 0 && y + d < rows - 1) setT(x, y + d, corrFloor); x += (tx > x ? 1 : -1); }
                    while (y !== ty) { for (let d = 0; d < corrW; d++) if (inB(x + d, y) && x + d > 0 && x + d < cols - 1) setT(x + d, y, corrFloor); y += (ty > y ? 1 : -1); }
                } else {
                    while (y !== ty) { for (let d = 0; d < corrW; d++) if (inB(x + d, y) && x + d > 0 && x + d < cols - 1) setT(x + d, y, corrFloor); y += (ty > y ? 1 : -1); }
                    while (x !== tx) { for (let d = 0; d < corrW; d++) if (inB(x, y + d) && y + d > 0 && y + d < rows - 1) setT(x, y + d, corrFloor); x += (tx > x ? 1 : -1); }
                }
            });

            // 35% шанс: подземный ручей или лавовый разлом с авто-мостами в местах проходов!
            if (cols >= 22 && Math.random() < 0.35) {
                const haz = Math.random() < 0.5 ? T.water : T.lava;
                let rx = MB_RAND_INT(Math.floor(cols * 0.35), Math.floor(cols * 0.65));
                const riverAtRow = [];
                for (let r = 1; r < rows - 1; r++) {
                    if (Math.random() < 0.4) rx = Math.max(4, Math.min(cols - 6, rx + MB_RAND_INT(-1, 1)));
                    riverAtRow[r] = rx;
                    for (let w = 0; w < 2; w++) if (!isWall(rx + w, r)) setT(rx + w, r, haz);
                }
                let lastBridgeR = -5;
                for (let r = 2; r < rows - 2; r++) {
                    const sc = riverAtRow[r];
                    if (r - lastBridgeR >= 4 && getT(sc, r) === haz && !isWall(sc - 1, r) && !isWall(sc + 2, r)) {
                        placeBridge(sc, sc + 1, r + 0.5, true);
                        lastBridgeR = r;
                    }
                }
            }

            rooms.sort((a, b) => a.dist - b.dist);
            const midRoles = ['crypt', 'prison', 'pit', 'crystal', 'treasury', 'rubble', 'cellar'];
            rooms.forEach((rm, idx) => {
                if (idx === 0) rm.role = 'entry';
                else if (idx === rooms.length - 1) rm.role = 'boss_sanctum';
                else rm.role = MB_PICK(midRoles);
                furnishRoom(rm);
            });
        }
        else {
            const isIndoorRock = (picked === 'dwarven');
            const mX = isIndoorRock ? 1 : Math.max(2, Math.floor(cols * 0.10));
            const mY = isIndoorRock ? 1 : Math.max(2, Math.floor(rows * 0.10));
            const targetRooms = Math.max(3, Math.min(11, Math.floor(((cols - mX * 2) * (rows - mY * 2)) / 42) + MB_RAND_INT(0, 2)));

            const defaultFloor = (picked === 'dwarven') ? T.flagstone : T.wood;
            const seedRoleByBiome = {
                tavern: 'tavern_hall',
                mansion: Math.random() < 0.5 ? 'foyer' : 'throne',
                dwarven: 'forge',
                eastern: 'dojo'
            };

            const { rooms, edges } = growRooms({
                marginX: mX, marginY: mY,
                targetRooms,
                seedW: [Math.min(10, Math.max(7, cols - mX * 2)), Math.min(13, Math.max(8, cols - mX * 2))],
                seedH: [Math.min(8, Math.max(6, rows - mY * 2)), Math.min(10, Math.max(7, rows - mY * 2))],
                roomW: [5, 8], roomH: [5, 7],
                defaultFloor, seedRole: seedRoleByBiome[picked]
            });

            // 1. Стены и полы всех выращенных комнат
            rooms.forEach(rm => {
                for (let r = rm.y1; r <= rm.y2; r++) for (let c = rm.x1; c <= rm.x2; c++) {
                    if (r === rm.y1 || r === rm.y2 || c === rm.x1 || c === rm.x2) setT(c, r, T.wall);
                }
            });
            rooms.forEach(rm => fillRect(rm.x1 + 1, rm.y1 + 1, rm.x2 - 1, rm.y2 - 1, rm.floor));

            // 2. Внутренние двери строго в общих стенах
            const doorPool = (picked === 'eastern') ? P.eastDoors : P.doors;
            edges.forEach(({ a, b }) => {
                if (a.x2 === b.x1 || b.x2 === a.x1) {
                    const wx = (a.x2 === b.x1) ? a.x2 : b.x2;
                    const yMin = Math.max(a.y1, b.y1) + 1, yMax = Math.min(a.y2, b.y2) - 1;
                    if (yMax >= yMin) placeDoor(wx, MB_RAND_INT(yMin, yMax), defaultFloor, true, doorPool);
                } else if (a.y2 === b.y1 || b.y2 === a.y1) {
                    const wy = (a.y2 === b.y1) ? a.y2 : b.y2;
                    const xMin = Math.max(a.x1, b.x1) + 1, xMax = Math.min(a.x2, b.x2) - 1;
                    if (xMax >= xMin) placeDoor(MB_RAND_INT(xMin, xMax), wy, defaultFloor, false, doorPool);
                }
            });

            // 3. Входная дверь и дорога к краю карты для наземных зданий
            if (!isIndoorRock) {
                const seed = rooms[0];
                const candidates = [];
                for (let c = seed.x1 + 1; c < seed.x2; c++) {
                    if (!isWall(c, seed.y1 - 1) && getT(c, seed.y1 - 1) === outdoorBase) candidates.push({ c, r: seed.y1, dx: 0, dy: -1, vert: false });
                    if (!isWall(c, seed.y2 + 1) && getT(c, seed.y2 + 1) === outdoorBase) candidates.push({ c, r: seed.y2, dx: 0, dy: 1, vert: false });
                }
                for (let r = seed.y1 + 1; r < seed.y2; r++) {
                    if (!isWall(seed.x1 - 1, r) && getT(seed.x1 - 1, r) === outdoorBase) candidates.push({ c: seed.x1, r, dx: -1, dy: 0, vert: true });
                    if (!isWall(seed.x2 + 1, r) && getT(seed.x2 + 1, r) === outdoorBase) candidates.push({ c: seed.x2, r, dx: 1, dy: 0, vert: true });
                }
                const extDoor = MB_PICK(candidates);
                if (extDoor) {
                    placeDoor(extDoor.c, extDoor.r, defaultFloor, extDoor.vert, picked === 'eastern' ? P.eastDoors : P.doubleDoors);
                    const roadT = isUrbanTavern ? T.flagstone : T.dirt;
                    let rc = extDoor.c + extDoor.dx, rr = extDoor.r + extDoor.dy;
                    while (inB(rc, rr)) {
                        if (getT(rc, rr) === outdoorBase) {
                            setT(rc, rr, roadT);
                            if (extDoor.dx === 0 && inB(rc + 1, rr) && getT(rc + 1, rr) === outdoorBase) setT(rc + 1, rr, roadT);
                            if (extDoor.dy === 0 && inB(rc, rr + 1) && getT(rc, rr + 1) === outdoorBase) setT(rc, rr + 1, roadT);
                        }
                        rc += extDoor.dx; rr += extDoor.dy;
                    }
                    const l1x = extDoor.c + extDoor.dx * 1.4 + (extDoor.vert ? 0 : -1.2) + 0.5;
                    const l1y = extDoor.r + extDoor.dy * 1.4 + (extDoor.vert ? -1.2 : 0) + 0.5;
                    const l2x = extDoor.c + extDoor.dx * 1.4 + (extDoor.vert ? 0 : 1.4) + 0.5;
                    const l2y = extDoor.r + extDoor.dy * 1.4 + (extDoor.vert ? 1.4 : 0) + 0.5;
                    addObj(picked === 'eastern' ? P.eastLights : P.lamps, l1x, l1y, 0.85, 0, 0.7);
                    addObj(picked === 'eastern' ? P.eastLights : P.lamps, l2x, l2y, 0.85, 0, 0.7);
                }

                // Окна в наружных стенах
                rooms.forEach(rm => {
                    for (let k = 0; k < 2; k++) {
                        const side = MB_PICK(['N', 'S', 'E', 'W']);
                        const wc = (side === 'W') ? rm.x1 : (side === 'E' ? rm.x2 : MB_RAND_INT(rm.x1 + 1, rm.x2 - 1));
                        const wr = (side === 'N') ? rm.y1 : (side === 'S' ? rm.y2 : MB_RAND_INT(rm.y1 + 1, rm.y2 - 1));
                        const ox = wc + (side === 'W' ? -1 : (side === 'E' ? 1 : 0));
                        const oy = wr + (side === 'N' ? -1 : (side === 'S' ? 1 : 0));
                        if (isWall(wc, wr) && getT(ox, oy) === outdoorBase && canPlace(wc + 0.5, wr + 0.5, 1.3, true, true)) {
                            addObj(P.windows, wc + 0.5, wr + 0.5, 0.92, (side === 'W' || side === 'E') ? 90 : 0, 0.8);
                        }
                    }
                });
            }

            // 4. Раздаём комнатам осмысленные роли
            const roleDecks = {
                tavern:  ['kitchen', 'bedroom', 'bedroom', 'cellar', 'vip_lounge', 'stable', 'bedroom', 'cellar'],
                mansion: ['dining', 'library', 'bedroom', 'parlor', 'observatory', 'bath', 'treasury', 'bedroom'],
                dwarven: ['treasury', 'dining', 'forge', 'cellar', 'crystal', 'treasury', 'bedroom'],
                eastern: ['tea_room', 'monk_room', 'monk_room', 'dojo', 'tea_room', 'treasury']
            };
            const deck = roleDecks[picked].slice();
            rooms.forEach((rm, idx) => {
                if (idx > 0) {
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

            // 5. Для дварфов: случайная подземная пещера с кристаллами и лавой
            if (picked === 'dwarven' && cols >= 22 && Math.random() < 0.55) {
                const lastRm = rooms[rooms.length - 1];
                const cavX = lastRm.cx < cols / 2 ? Math.min(cols - 5, lastRm.x2 + 5) : Math.max(4, lastRm.x1 - 5);
                const cavY = Math.max(4, Math.min(rows - 5, lastRm.cy));
                fillDisc(cavX, cavY, 4.2, 3.6, T.stone, 0.22);
                let cx = Math.floor(lastRm.cx), cy = Math.floor(lastRm.cy);
                while (cx !== Math.floor(cavX)) { setT(cx, cy, T.stone); cx += (cavX > cx ? 1 : -1); }
                fillDisc(cavX + (cavX > cols / 2 ? 1.2 : -1.2), cavY, 1.6, 1.4, T.lava, 0.15);
                for (let k = 0; k < 6; k++) {
                    const px = cavX + MB_RAND_FLOAT(-3.0, 3.0), py = cavY + MB_RAND_FLOAT(-2.5, 2.5);
                    if (getT(Math.floor(px), Math.floor(py)) === T.stone && canPlace(px, py, 1.2)) {
                        addObj(k < 3 ? P.crystals : P.rocks, px, py, 0.92, MB_RAND_INT(0, 359), 1.0);
                    }
                }
            }

            // 6. Живое окружение вокруг наземных зданий (пруд, двор, рощи деревьев)
            if (!isIndoorRock) {
                if (!isUrbanTavern && Math.random() < (picked === 'eastern' ? 0.65 : 0.35)) {
                    for (let tries = 0; tries < 22; tries++) {
                        const px = MB_RAND_INT(3, cols - 4), py = MB_RAND_INT(3, rows - 4);
                        const clear = [-3, 0, 3].every(dy => [-3, 0, 3].every(dx => getT(px + dx, py + dy) === T.grass));
                        if (clear) {
                            fillDisc(px, py, MB_RAND_FLOAT(2.4, 3.8), MB_RAND_FLOAT(2.0, 3.2), T.water, 0.18);
                            for (let k = 0; k < 4; k++) {
                                const wx = px + MB_RAND_FLOAT(-1.8, 1.8), wy = py + MB_RAND_FLOAT(-1.4, 1.4);
                                if (getT(Math.floor(wx), Math.floor(wy)) === T.water && canPlace(wx, wy, 1.1)) addObj(P.waterDec, wx, wy, 0.9, MB_RAND_INT(0, 359), 0.9);
                            }
                            break;
                        }
                    }
                }

                const yardProps = isUrbanTavern
                    ? [P.carts, P.barrels, P.crates, P.lamps]
                    : ['city_well', P.carts, P.horses, P.campfires, P.firewood];
                yardProps.forEach(prop => {
                    for (let tries = 0; tries < 25; tries++) {
                        const px = MB_RAND_FLOAT(2, cols - 2), py = MB_RAND_FLOAT(2, rows - 2);
                        const t = getT(Math.floor(px), Math.floor(py));
                        if (t !== outdoorBase) continue;
                        if ([-1, 0, 1].some(dr => [-1, 0, 1].some(dc => isWall(Math.floor(px) + dc, Math.floor(py) + dr)))) continue;
                        if (!canPlace(px, py, 2.0)) continue;
                        addObj(prop, px, py, 0.95, MB_RAND_INT(0, 359), 1.7);
                        break;
                    }
                });

                if (!isUrbanTavern) {
                    const groves = Math.max(3, Math.floor((cols * rows) / 70));
                    for (let g = 0; g < groves; g++) {
                        const gx = MB_RAND_FLOAT(1.5, cols - 1.5), gy = MB_RAND_FLOAT(1.5, rows - 1.5);
                        if (getT(Math.floor(gx), Math.floor(gy)) !== T.grass) continue;
                        for (let k = 0; k < MB_RAND_INT(3, 5); k++) {
                            const ox = gx + MB_RAND_FLOAT(-2.5, 2.5), oy = gy + MB_RAND_FLOAT(-2.2, 2.2);
                            if (getT(Math.floor(ox), Math.floor(oy)) !== T.grass) continue;
                            if ([-1, 0, 1].some(dr => [-1, 0, 1].some(dc => isWall(Math.floor(ox) + dc, Math.floor(oy) + dr)))) continue;
                            if (!canPlace(ox, oy, 1.6)) continue;
                            addObj(k < 3 ? P.trees : P.bushes, ox, oy, MB_RAND_FLOAT(0.9, 1.32), MB_RAND_INT(0, 359), 1.65);
                        }
                    }
                }
            }

            const titlePools = {
                tavern:  ['Трактир «Золотой Гоблин»', 'Постоялый двор «Старый Очаг»', 'Таверна «Вольный Тракт»', 'Корчма «У Древа»'],
                mansion: ['Поместье аристократа', 'Особняк Министра', 'Вилла Торгового Дома', 'Залы Архимага'],
                dwarven: ['Великая Кузница Дварфов', 'Подгорные чертоги', 'Плавильный бастион', 'Рудник Самоцветов'],
                eastern: ['Восточное додзё', 'Храм Тихого Лотоса', 'Монастырь Сакуры', 'Чайный дом у сада']
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

// ================================================================
// ⛩️ ЧАСТЬ 2: ОТДЕЛЬНЫЙ ПРОЦЕДУРНЫЙ ГЕНЕРАТОР ВОСТОЧНОГО ХРАМА / ДОДЗЁ
// ================================================================
(function INSTALL_EASTERN_TEMPLE_V5() {
    const _PREV_GEN = MB_GENERATE_RANDOM;

    MB_GENERATE_RANDOM = function(biome) {
        if (biome !== 'eastern') return _PREV_GEN(biome);

        MB_PUSH_UNDO();
        const cols = window._mbCols, rows = window._mbRows;

        const T = {
            grass:     Math.random() < 0.25 ? MB_PICK_TILE_FAMILY('moss', 'grass') : MB_PICK_TILE_FAMILY('grass', 'grass'),
            wood:      MB_PICK_TILE_FAMILY('wood', 'wood'),
            wall:      MB_PICK_TILE_FAMILY('wall', 'wall'),
            flagstone: MB_PICK_TILE_FAMILY('flagstone', 'stone'),
            sand:      'sand',
            water:     'water',
            leafR:     'leaves_red',
            leafG:     'leaves_green'
        };

        window._mbLighting = MB_PICK(['day', 'sunset', 'sunset', 'night']);
        const data = CREATE_EMPTY_MB_DATA(T.grass, cols, rows);
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

        const phase = MB_RAND_FLOAT(0, 6.28);
        const paintDisc = (cx, cy, rx, ry, t, wob = 0.16, onlyOn = null) => {
            for (let r = Math.max(0, Math.floor(cy - ry - 2)); r <= Math.min(rows - 1, Math.ceil(cy + ry + 2)); r++)
                for (let c = Math.max(0, Math.floor(cx - rx - 2)); c <= Math.min(cols - 1, Math.ceil(cx + rx + 2)); c++) {
                    if (onlyOn && !onlyOn.includes(getT(c, r))) continue;
                    const ang = Math.atan2(r - cy, c - cx);
                    const d = Math.hypot((c - cx) / Math.max(0.6, rx), (r - cy) / Math.max(0.6, ry));
                    if (d <= 1.0 + Math.sin(ang * 3 + phase) * wob) setT(c, r, t);
                }
        };

        const placedZones = [];
        const doorSpots = [];
        const canPlace = (x, y, minDist = 0.9, checkDoors = true, allowWall = false) => {
            const gx = Math.floor(x), gy = Math.floor(y);
            if (!inB(gx, gy)) return false;
            if (!allowWall && isWall(gx, gy)) return false;
            if (checkDoors && doorSpots.some(d => Math.hypot(d.x - x, d.y - y) < Math.max(1.3, minDist))) return false;
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

        // --- 100% ВОСТОЧНЫЕ ПУЛЫ СПРАЙТОВ ---
        const E = {
            shoji:       MB_GET_POOL(/^dungeon_door_shoji_[12]$|^furniture_door_tatami$/),
            tatamiBig:   MB_GET_POOL(/^furniture_tatami_mat_large$/),
            tatamiSmall: MB_GET_POOL(/^furniture_tatami_mat_(small|round_[12])$/),
            shrines:     MB_GET_POOL(/^other_shrine_[12]$/),
            screens:     MB_GET_POOL(/^other_paper_screen_[12]$/),
            lanterns:    MB_GET_POOL(/^city_paper_lamp$|^city_paperlamp2?$|^other_paper_lantern_[123]$/),
            tables:      MB_GET_POOL(/^furniture_table_(kotatsu|game|[1-4])$/),
            cushions:    MB_GET_POOL(/^other_cushion_[1-4]$|^other_seat_[12]$/),
            futons:      MB_GET_POOL(/^furniture_futon_bed$|^other_futon_matress$/),
            hearths:     MB_GET_POOL(/^dungeon_cooking_pit_(small_[123]|medium)$/),
            kettles:     MB_GET_POOL(/^other_kettle_[12]$/),
            bonsai:      MB_GET_POOL(/^other_bonsai_[123]$/),
            armor:       MB_GET_POOL(/^other_samurai_armor_([123]|rack)$/),
            weapons:     MB_GET_POOL(/^camp_weapons_(katanas|daisho|sword_rack)$/),
            drums:       MB_GET_POOL(/^other_taiko_drum(_big)?$/),
            shelves:     MB_GET_POOL(/^other_shelves_[1-6]$/),
            vases:       MB_GET_POOL(/^other_vase_(large|medium|small)$/),
            kimono:      MB_GET_POOL(/^other_kimono_clothing_[123]$/),
            props:       MB_GET_POOL(/^other_shamisen_instrument$|^other_scroll$|^other_hand_fan_[12]$/),
            slippers:    MB_GET_POOL(/^other_slippers_[12]$/),
            parasol:     MB_GET_POOL(/^other_parasol_open$/),

            woodBridge:  MB_GET_POOL(/^nature_wooden_bridge_section_7x4$/),
            stoneBridge: MB_GET_POOL(/^nature_stone_bridge_section_7x4$/),
            waterDec:    MB_GET_POOL(/^other_lily_pad|^nature_river_rock_[123]$/),
            trees:       MB_GET_POOL(/^nature_tree_(small_[12]|large_1|[123])$/),
            redBushes:   MB_GET_POOL(/^nature_bush_1_red$|^nature_bush_9_yellow$/),
            greenBushes: MB_GET_POOL(/^nature_bush_(2|4|5|7)_green|^nature_bush_shrub_[12]$/),
            flowers:     MB_GET_POOL(/^nature_flower_[1-6]$|^nature_flowers_[1-4]$/),
            zenRocks:    MB_GET_POOL(/^other_stone_[123]$|^nature_rocks_[1-4]$|^nature_rock_small_[12]$/)
        };

        const boxPavilion = (x1, y1, x2, y2) => {
            for (let r = y1; r <= y2; r++) for (let c = x1; c <= x2; c++) {
                setT(c, r, (r === y1 || r === y2 || c === x1 || c === x2) ? T.wall : T.wood);
            }
            return { x1, y1, x2, y2, iw: x2 - x1 - 1, ih: y2 - y1 - 1, cx: (x1 + x2 + 1) / 2, cy: (y1 + y2 + 1) / 2 };
        };

        const placeShojiDoor = (c, r, vert, inDx = 0, inDy = 0) => {
            setT(c, r, T.wood);
            doorSpots.push({ x: c + 0.5, y: r + 0.5 });
            addObj(E.shoji, c + 0.5, r + 0.5, 0.96, vert ? 90 : 0, 0.85);
            if ((inDx || inDy) && Math.random() < 0.75) {
                addObj(E.slippers, c + 0.5 + inDx * 0.95, r + 0.5 + inDy * 0.95, 0.78, vert ? 90 : 0, 0);
            }
            // Пара бумажных фонарей по бокам входа снаружи
            const outC = c - inDx, outR = r - inDy;
            if ((inDx || inDy) && inB(outC, outR) && !isWall(outC, outR) && !isWater(outC, outR)) {
                const px = vert ? 0 : 1.15, py = vert ? 1.15 : 0;
                if (canPlace(outC + 0.5 - px, outR + 0.5 - py, 0.6, false)) addObj(E.lanterns, outC + 0.5 - px, outR + 0.5 - py, 0.85, 0, 0.6);
                if (canPlace(outC + 0.5 + px, outR + 0.5 + py, 0.6, false)) addObj(E.lanterns, outC + 0.5 + px, outR + 0.5 + py, 0.85, 0, 0.6);
            }
        };

        const placeBridgeSpan = (c1, r1, c2, r2, isStone = false) => {
            const dx = c2 - c1, dy = r2 - r1;
            const span = Math.hypot(dx, dy) + 1.8;
            const deg = Math.atan2(dy, dx) * 180 / Math.PI;
            const pool = isStone ? E.stoneBridge : E.woodBridge;
            const segs = Math.max(1, Math.ceil(span / 3.3));
            const sc = Math.max(0.76, (span / segs) / 3.4);
            for (let i = 0; i < segs; i++) {
                const f = (i + 0.5) / segs;
                addObj(pool, c1 + 0.5 + dx * f, r1 + 0.5 + dy * f, sc, deg, 1.4);
            }
        };

        // Прямая каменная дорожка от точки к точке (автоматически ставит мост, если пересекает воду!)
        const layGardenPath = (x1, y1, x2, y2, isStoneBridge = false) => {
            const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
            if (steps < 1) return;
            let inW = false, ws = null, we = null;
            for (let i = 0; i <= steps; i++) {
                const c = Math.round(x1 + ((x2 - x1) * i) / steps);
                const r = Math.round(y1 + ((y2 - y1) * i) / steps);
                if (!inB(c, r) || isWall(c, r)) continue;
                if (isWater(c, r)) {
                    if (!inW) { inW = true; ws = { c, r }; }
                    we = { c, r };
                } else {
                    if (inW && ws && we) {
                        placeBridgeSpan(ws.c, ws.r, we.c, we.r, isStoneBridge);
                        inW = false;
                    }
                    if (getT(c, r) === T.grass || getT(c, r) === T.leafR || getT(c, r) === T.sand) {
                        setT(c, r, T.flagstone);
                    }
                }
            }
            if (inW && ws && we) placeBridgeSpan(ws.c, ws.r, we.c, we.r, isStoneBridge);
        };

        const getSolidWalls = (rm) => {
            const sides = [];
            const nearDoor = (x, y) => doorSpots.some(d => Math.hypot(d.x - x, d.y - y) < 1.8);
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
        };

        // Наполнение комнат ТОЛЬКО восточной мебелью и татами
        const furnishEastRoom = (rm, role) => {
            const { x1, y1, x2, y2, iw, ih, cx, cy } = rm;
            const walls = getSolidWalls(rm);
            const pickW = () => walls.length ? walls.splice(Math.floor(Math.random() * walls.length), 1)[0] : null;
            const corners = [
                { x: x1 + 1.5, y: y1 + 1.5 }, { x: x2 - 0.5, y: y1 + 1.5 },
                { x: x1 + 1.5, y: y2 - 0.5 }, { x: x2 - 0.5, y: y2 - 0.5 }
            ].filter(pt => canPlace(pt.x, pt.y, 0.75));

            // Устилаем пол татами!
            if (iw >= 5 && ih >= 4) {
                addObj(E.tatamiBig, cx - 1.15, cy, 0.92, 0, 0);
                addObj(E.tatamiBig, cx + 1.15, cy, 0.92, 0, 0);
            } else {
                addObj(iw >= 4 ? E.tatamiBig : E.tatamiSmall, cx, cy, Math.min(1.05, Math.min(iw, ih) * 0.28), 0, 0);
            }

            if (role === 'dojo') {
                const sw = pickW();
                if (sw) addObj(E.shrines, sw.x, sw.y, 1.18, sw.rot, 1.35);
                const w2 = pickW();
                if (w2 && canPlace(w2.x, w2.y, 0.9)) addObj(E.weapons, w2.x, w2.y, 0.95, w2.rot, 0.95);
                const w3 = pickW();
                if (w3 && canPlace(w3.x, w3.y, 0.9)) addObj(E.armor, w3.x, w3.y, 0.95, w3.rot, 0.95);
                if (iw >= 6 && ih >= 5 && canPlace(cx, cy, 1.1)) {
                    addObj(E.drums, cx, cy, 0.95, MB_PICK([0, 90]), 1.1);
                }
                corners.slice(0, 2).forEach(pt => addObj(E.lanterns, pt.x, pt.y, 0.85, 0, 0.7));
                if (corners[2]) addObj(E.bonsai, corners[2].x, corners[2].y, 0.9, 0, 0.8);
                if (corners[3]) addObj(E.armor, corners[3].x, corners[3].y, 0.88, 0, 0.8);
            }
            else if (role === 'tea_room') {
                if (canPlace(cx, cy, 1.1)) {
                    addObj(E.tables, cx, cy, 0.96, 0, 1.15);
                    addObj(E.kettles, cx + 0.12, cy - 0.08, 0.72, 0, 0);
                    if (canPlace(cx, cy - 0.95, 0.3, true)) addObj(E.cushions, cx, cy - 0.95, 0.85, 0, 0);
                    if (canPlace(cx, cy + 0.95, 0.3, true)) addObj(E.cushions, cx, cy + 0.95, 0.85, 180, 0);
                }
                const w1 = pickW();
                if (w1 && canPlace(w1.x, w1.y, 0.85)) addObj(E.screens, w1.x, w1.y, 0.95, w1.rot, 0.9);
                if (corners[0]) addObj(E.bonsai, corners[0].x, corners[0].y, 0.92, 0, 0.75);
                if (corners[1]) addObj(E.lanterns, corners[1].x, corners[1].y, 0.82, 0, 0.7);
                if (corners[2]) addObj(E.props, corners[2].x, corners[2].y, 0.82, MB_RAND_INT(0, 359), 0.7);
            }
            else if (role === 'hearth_room') {
                if (canPlace(cx, cy, 1.1)) {
                    addObj(E.hearths, cx, cy, 1.02, 0, 1.2);
                    addObj(E.kettles, cx + 0.25, cy, 0.74, 0, 0);
                    if (canPlace(cx - 1.1, cy, 0.3, true)) addObj(E.cushions, cx - 1.1, cy, 0.85, 90, 0);
                    if (canPlace(cx + 1.1, cy, 0.3, true)) addObj(E.cushions, cx + 1.1, cy, 0.85, 270, 0);
                }
                const w1 = pickW();
                if (w1 && canPlace(w1.x, w1.y, 0.85)) addObj(E.shelves, w1.x, w1.y, 0.9, w1.rot, 0.9);
                if (corners[0]) addObj(E.vases, corners[0].x, corners[0].y, 0.85, 0, 0.7);
                if (corners[1]) addObj(E.lanterns, corners[1].x, corners[1].y, 0.82, 0, 0.7);
            }
            else { // monk_room
                const w1 = pickW();
                if (w1 && canPlace(w1.x, w1.y, 0.95)) addObj(E.futons, w1.x, w1.y, 0.98, w1.rot, 1.1);
                else if (canPlace(cx, cy, 0.95)) addObj(E.futons, cx, cy, 0.95, 0, 1.1);
                const w2 = pickW();
                if (w2 && canPlace(w2.x, w2.y, 0.85)) addObj(Math.random() < 0.5 ? E.screens : E.shelves, w2.x, w2.y, 0.92, w2.rot, 0.85);
                if (corners[0]) addObj(E.lanterns, corners[0].x, corners[0].y, 0.82, 0, 0.7);
                if (corners[1]) addObj(Math.random() < 0.5 ? E.kimono : E.vases, corners[1].x, corners[1].y, 0.85, 0, 0.75);
                if (corners[2]) addObj(E.props, corners[2].x, corners[2].y, 0.8, 0, 0.65);
            }
        };

        // Открытая садовая беседка (татами на дереве + столик + зонт + фонари, без тяжёлых стен!)
        const placeGardenTeaDeck = (cx, cy) => {
            const x1 = Math.max(2, Math.floor(cx) - 2), y1 = Math.max(2, Math.floor(cy) - 2);
            const x2 = Math.min(cols - 3, x1 + 3), y2 = Math.min(rows - 3, y1 + 3);
            for (let r = y1; r <= y2; r++) for (let c = x1; c <= x2; c++) {
                if (isWall(c, r) || isWater(c, r)) return false;
            }
            fillRect(x1, y1, x2, y2, T.wood);
            const mx = (x1 + x2 + 1) / 2, my = (y1 + y2 + 1) / 2;
            addObj(E.tatamiSmall, mx, my, 1.1, 0, 0);
            addObj(E.tables, mx, my, 0.9, 0, 1.1);
            addObj(E.kettles, mx + 0.1, my, 0.7, 0, 0);
            addObj(E.parasol, mx - 1.15, my - 1.05, 1.05, MB_RAND_INT(0, 359), 0.9);
            addObj(E.lanterns, x2 + 0.6, y1 + 0.4, 0.82, 0, 0.7);
            addObj(E.bonsai, x1 + 0.4, y2 + 0.6, 0.85, 0, 0.7);
            return true;
        };

        // Сад камней (карэсансуй): песок + аккуратно расставленные камни и бонсай
        const placeZenRockGarden = (cx, cy, rx, ry) => {
            paintDisc(cx, cy, rx, ry, T.sand, 0.14, [T.grass, T.leafR]);
            const stones = MB_RAND_INT(3, 5);
            for (let i = 0; i < stones; i++) {
                const ang = (i / stones) * 6.28 + MB_RAND_FLOAT(-0.3, 0.3);
                const sx = cx + Math.cos(ang) * MB_RAND_FLOAT(0.6, rx * 0.68);
                const sy = cy + Math.sin(ang) * MB_RAND_FLOAT(0.5, ry * 0.65);
                if (getT(Math.floor(sx), Math.floor(sy)) === T.sand && canPlace(sx, sy, 1.25)) {
                    addObj(i === 0 ? E.bonsai : E.zenRocks, sx, sy, MB_RAND_FLOAT(0.85, 1.15), MB_RAND_INT(0, 359), 1.1);
                }
            }
        };

        // Осенние/сакуровые пятна листвы на траве
        for (let i = 0; i < Math.floor((cols * rows) / 38); i++) {
            paintDisc(MB_RAND_FLOAT(1.5, cols - 1.5), MB_RAND_FLOAT(1.5, rows - 1.5), MB_RAND_FLOAT(1.6, 3.0), MB_RAND_FLOAT(1.4, 2.5), T.leafR, 0.22, [T.grass]);
        }

        const style = MB_PICK_NEXT_VARIANT('eastern_v5', ['lake_sanctuary', 'zen_monastery', 'streamside_dojo']);
        let genTitle = 'Восточный храм';

        // ============================================================
        // ВАРИАНТ 1: СВЯТИЛИЩЕ НА ОЗЕРЕ (ОСТРОВ + МОСТЫ + ЧАЙНАЯ БЕСЕДКА)
        // ============================================================
        if (style === 'lake_sanctuary') {
            genTitle = MB_PICK(['Святилище на озере Лотосов', 'Островное додзё', 'Павильон Тихой Воды']);
            const cx = Math.floor(cols * MB_RAND_FLOAT(0.42, 0.58));
            const cy = Math.floor(rows * MB_RAND_FLOAT(0.42, 0.58));
            const rx = Math.max(5.5, cols * MB_RAND_FLOAT(0.32, 0.38));
            const ry = Math.max(4.5, rows * MB_RAND_FLOAT(0.36, 0.42));
            paintDisc(cx, cy, rx, ry, T.water, 0.14);

            const pw = Math.min(11, Math.max(7, Math.floor(cols * 0.29)));
            const ph = Math.min(9, Math.max(6, Math.floor(rows * 0.40)));
            const px1 = Math.max(3, Math.min(cols - pw - 3, cx - Math.floor(pw / 2)));
            const py1 = Math.max(2, Math.min(rows - ph - 2, cy - Math.floor(ph / 2)));
            const mainRm = boxPavilion(px1, py1, px1 + pw - 1, py1 + ph - 1);

            // 2 или 3 моста с разных сторон острова!
            const dirs = MB_PICK([['W', 'E'], ['W', 'E', 'S'], ['N', 'S', 'E'], ['W', 'N', 'S']]);
            const isStoneBr = Math.random() < 0.45;
            dirs.forEach(d => {
                if (d === 'W') { placeShojiDoor(mainRm.x1, cy, true, 1, 0); layGardenPath(mainRm.x1 - 1, cy, 0, cy, isStoneBr); }
                else if (d === 'E') { placeShojiDoor(mainRm.x2, cy, true, -1, 0); layGardenPath(mainRm.x2 + 1, cy, cols - 1, cy, isStoneBr); }
                else if (d === 'N') { placeShojiDoor(cx, mainRm.y1, false, 0, 1); layGardenPath(cx, mainRm.y1 - 1, cx, 0, isStoneBr); }
                else if (d === 'S') { placeShojiDoor(cx, mainRm.y2, false, 0, -1); layGardenPath(cx, mainRm.y2 + 1, cx, rows - 1, isStoneBr); }
            });
            furnishEastRoom(mainRm, 'dojo');

            // На берегу: чайная беседка и сад камней (если хватает места)
            if (cols >= 22) {
                const corners = [[3, 2], [cols - 5, 2], [3, rows - 4], [cols - 5, rows - 4]];
                let deckPlaced = false;
                for (const [bx, by] of corners) {
                    if (!deckPlaced && placeGardenTeaDeck(bx, by)) { deckPlaced = true; continue; }
                    if (getT(bx, by) === T.grass) { placeZenRockGarden(bx, by, 2.4, 2.0); break; }
                }
            }
        }

        // ============================================================
        // ВАРИАНТ 2: МОНАСТЫРЬ С ВНУТРЕННИМ САДОМ КАМНЕЙ И ПРУДОМ
        // ============================================================
        else if (style === 'zen_monastery') {
            genTitle = MB_PICK(['Монастырь Сада Камней', 'Храм Сакуры', 'Обитель Тихого Лотоса']);
            const flipH = Math.random() < 0.5;
            const mainW = Math.min(12, Math.max(7, Math.floor(cols * 0.34)));
            const mainH = Math.min(9, Math.max(6, Math.floor(rows * 0.44)));
            const mx1 = flipH ? (cols - 2 - mainW) : 2;
            const my1 = MB_RAND_INT(2, Math.max(2, Math.floor(rows * 0.24)));
            const dojo = boxPavilion(mx1, my1, mx1 + mainW - 1, my1 + mainH - 1);

            // Соседнее крыло (чайная или очаг ирори) пристыковано снизу или сбоку
            const rooms = [dojo];
            const wingW = Math.min(8, Math.max(5, Math.floor(cols * 0.22)));
            const wingH = Math.min(7, Math.max(5, rows - dojo.y2 - 2));
            if (wingH >= 5) {
                const wx1 = flipH ? (dojo.x2 - wingW + 1) : dojo.x1;
                const wing = boxPavilion(wx1, dojo.y2, wx1 + wingW - 1, dojo.y2 + wingH - 1);
                placeShojiDoor(Math.floor((wing.x1 + wing.x2) / 2), dojo.y2, false, 0, 1);
                const outX = flipH ? wing.x1 : wing.x2;
                placeShojiDoor(outX, Math.floor((wing.y1 + wing.y2) / 2), true, flipH ? 1 : -1, 0);
                rooms.push(wing);
            }

            // Главный вход из додзё в сад
            const dojoExitX = flipH ? dojo.x1 : dojo.x2;
            const dojoExitY = Math.floor((dojo.y1 + dojo.y2) / 2);
            placeShojiDoor(dojoExitX, dojoExitY, true, flipH ? 1 : -1, 0);

            // Садовая зона на свободной половине карты: сад камней + пруд с мостиком + павильон монаха
            const yardX1 = flipH ? 2 : (dojo.x2 + 2);
            const yardX2 = flipH ? (dojo.x1 - 2) : (cols - 3);
            const yardCx = (yardX1 + yardX2) / 2;

            // Пруд в одной части сада, сад камней в другой
            const pondTop = Math.random() < 0.5;
            const pondY = pondTop ? Math.max(3, Math.floor(rows * 0.28)) : Math.min(rows - 4, Math.floor(rows * 0.72));
            const zenY  = pondTop ? Math.min(rows - 4, Math.floor(rows * 0.74)) : Math.max(3, Math.floor(rows * 0.28));

            if (yardX2 - yardX1 >= 5) {
                paintDisc(yardCx, pondY, Math.min(4.2, (yardX2 - yardX1) * 0.36), Math.min(3.2, rows * 0.22), T.water, 0.16);
                placeZenRockGarden(yardCx, zenY, Math.min(3.8, (yardX2 - yardX1) * 0.34), Math.min(2.6, rows * 0.18));
            }

            // Отдельный домик-чайная или келья в дальнем углу на больших картах
            if (cols >= 26 && yardX2 - yardX1 >= 10) {
                const subW = 6, subH = 6;
                const sx1 = flipH ? 2 : (cols - 2 - subW);
                const sy1 = pondTop ? (rows - 2 - subH) : 2;
                const clear = [sx1, sx1 + subW - 1].every(cx => !isWater(cx, sy1) && !isWater(cx, sy1 + subH - 1));
                if (clear) {
                    const sub = boxPavilion(sx1, sy1, sx1 + subW - 1, sy1 + subH - 1);
                    const sdX = flipH ? sub.x2 : sub.x1;
                    const sdY = Math.floor((sub.y1 + sub.y2) / 2);
                    placeShojiDoor(sdX, sdY, true, flipH ? -1 : 1, 0);
                    layGardenPath(dojoExitX + (flipH ? -1 : 1), dojoExitY, sdX + (flipH ? 1 : -1), sdY, false);
                    furnishEastRoom(sub, Math.random() < 0.5 ? 'monk_room' : 'tea_room');
                }
            }

            // Дорожка от входа к краю карты (через пруд — с мостом!)
            const edgeX = flipH ? 0 : (cols - 1);
            layGardenPath(dojoExitX + (flipH ? -1 : 1), dojoExitY, edgeX, dojoExitY, Math.random() < 0.5);

            furnishEastRoom(rooms[0], 'dojo');
            if (rooms[1]) furnishEastRoom(rooms[1], Math.random() < 0.5 ? 'hearth_room' : 'tea_room');
        }

        // ============================================================
        // ВАРИАНТ 3: ДОДЗЁ У ГОРНОГО РУЧЬЯ + ТРЕНИРОВОЧНЫЙ ДВОР
        // ============================================================
        else {
            genTitle = MB_PICK(['Додзё у горного ручья', 'Школа Клинка и Бамбука', 'Тренировочный двор самураев']);
            const creekRight = Math.random() < 0.5;
            let cx = creekRight ? Math.floor(cols * 0.72) : Math.floor(cols * 0.24);
            const cw = cols >= 28 ? 3 : 2;
            for (let r = 0; r < rows; r++) {
                if (r % 3 === 0 && Math.random() < 0.65) {
                    cx = Math.max(creekRight ? Math.floor(cols * 0.64) : 3, Math.min(creekRight ? cols - cw - 3 : Math.floor(cols * 0.34), cx + MB_RAND_INT(-1, 1)));
                }
                for (let w = 0; w < cw; w++) setT(cx + w, r, T.water);
            }

            // Главное додзё на широком берегу + примыкающая комната отдыха
            const bankL = creekRight ? 2 : (cx + cw + 2);
            const bankR = creekRight ? (cx - 2) : (cols - 3);
            const bw = Math.min(11, Math.max(7, Math.floor((bankR - bankL) * 0.68)));
            const bh = Math.min(8, Math.max(6, Math.floor(rows * 0.48)));
            const px1 = creekRight ? bankL : Math.max(bankL, bankR - bw + 1);
            const py1 = 2;
            const dojo = boxPavilion(px1, py1, px1 + bw - 1, py1 + bh - 1);

            const doorToCreekX = creekRight ? dojo.x2 : dojo.x1;
            const doorY = Math.floor((dojo.y1 + dojo.y2) / 2);
            placeShojiDoor(doorToCreekX, doorY, true, creekRight ? -1 : 1, 0);

            // Вход вниз на открытый тренировочный двор (песок + стойки катаны + тайко + доспехи)
            const yardTop = dojo.y2 + 1;
            if (rows - yardTop >= 4) {
                const yardMidX = Math.floor((dojo.x1 + dojo.x2) / 2);
                placeShojiDoor(yardMidX, dojo.y2, false, 0, -1);
                const yRadX = Math.max(2.6, bw * 0.42), yRadY = Math.max(1.8, (rows - yardTop - 1) * 0.45);
                const yCy = yardTop + yRadY;
                paintDisc(yardMidX + 0.5, yCy, yRadX, yRadY, T.sand, 0.12, [T.grass, T.leafR]);
                addObj(E.weapons, dojo.x1 + 1.2, yCy, 0.96, 90, 1.0);
                addObj(E.armor, dojo.x2 - 0.2, yCy, 0.96, 270, 1.0);
                if (canPlace(yardMidX + 0.5, yCy + 0.8, 1.0)) addObj(E.drums, yardMidX + 0.5, yCy + 0.8, 1.0, 0, 1.1);
                addObj(E.lanterns, dojo.x1 + 0.8, Math.min(rows - 1.5, yCy + yRadY * 0.7), 0.85, 0, 0.7);
                addObj(E.lanterns, dojo.x2 + 0.2, Math.min(rows - 1.5, yCy + yRadY * 0.7), 0.85, 0, 0.7);
            }

            furnishEastRoom(dojo, 'dojo');

            // Каменная тропа через ручей (авто-мост!) к чайной беседке на другом берегу
            const farX = creekRight ? (cols - 1) : 0;
            layGardenPath(doorToCreekX + (creekRight ? 1 : -1), doorY, farX, doorY, false);

            const deckX = creekRight ? Math.min(cols - 3, cx + cw + 3) : Math.max(2, cx - 3);
            const deckY = doorY > rows / 2 ? 3 : (rows - 4);
            if (!placeGardenTeaDeck(deckX, deckY)) {
                if (inB(deckX, deckY) && !isWater(deckX, deckY)) addObj(E.shrines, deckX + 0.5, deckY + 0.5, 1.1, 0, 1.2);
            }
        }

        // Кувшинки и речные камни в воде
        for (let r = 1; r < rows - 1; r++) for (let c = 1; c < cols - 1; c++) {
            if (isWater(c, r) && canPlace(c + 0.5, r + 0.5, 1.45) && Math.random() < 0.17) {
                addObj(E.waterDec, c + 0.5, r + 0.5, 0.92, MB_RAND_INT(0, 359), 0.9);
            }
        }

        // Японский сад вокруг: рощи с красными/золотыми кустами, деревьями, бонсай и камнями
        const groves = Math.max(4, Math.floor((cols * rows) / 60));
        for (let g = 0; g < groves; g++) {
            const gx = MB_RAND_FLOAT(1.5, cols - 1.5), gy = MB_RAND_FLOAT(1.5, rows - 1.5);
            if (getT(Math.floor(gx), Math.floor(gy)) !== T.grass && getT(Math.floor(gx), Math.floor(gy)) !== T.leafR) continue;
            for (let k = 0; k < MB_RAND_INT(3, 5); k++) {
                const ox = gx + MB_RAND_FLOAT(-2.4, 2.4), oy = gy + MB_RAND_FLOAT(-2.1, 2.1);
                const t = getT(Math.floor(ox), Math.floor(oy));
                if (t !== T.grass && t !== T.leafR) continue;
                if ([-1, 0, 1].some(dr => [-1, 0, 1].some(dc => isWall(Math.floor(ox) + dc, Math.floor(oy) + dr)))) continue;
                if (!canPlace(ox, oy, 1.55)) continue;
                if (k < 2) addObj(E.trees, ox, oy, MB_RAND_FLOAT(0.88, 1.24), MB_RAND_INT(0, 359), 1.6);
                else if (k < 4) addObj(Math.random() < 0.6 ? E.redBushes : E.greenBushes, ox, oy, MB_RAND_FLOAT(0.82, 1.15), MB_RAND_INT(0, 359), 0.95);
                else addObj(Math.random() < 0.5 ? E.zenRocks : E.flowers, ox, oy, 0.85, MB_RAND_INT(0, 359), 0.8);
            }
        }

        const titleInp = document.getElementById('mb-map-title-inp');
        if (titleInp) titleInp.value = genTitle;

        window._mbData = data;
        SAVE_MB_DATA(data);
        RENDER_GM_MAP_BUILDER_UI();
    };
})();