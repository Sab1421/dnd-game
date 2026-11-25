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
