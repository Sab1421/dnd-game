// ================================================================
// 🖼️ ЕДИНЫЙ КАТАЛОГ ВСТРОЕННОЙ ГРАФИКИ И ШАБЛОНОВ САЙТА (assets.js)
// ================================================================

window.SITE_ASSETS = {
    fogBaseColor: '#d4dae0',

    fogClouds: "data:image/svg+xml," + encodeURIComponent(
        `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
            <defs>
                <filter id="c" x="0" y="0" width="100%" height="100%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.008 0.011" numOctaves="3" seed="7" stitchTiles="stitch" result="n"/>
                    <feColorMatrix type="matrix" values="0.86 0 0 0 0.41  0.86 0 0 0 0.43  0.86 0 0 0 0.45  0 0 0 0 1" in="n"/>
                </filter>
            </defs>
            <rect width="512" height="512" fill="#d4dae0"/>
            <rect width="512" height="512" filter="url(#c)"/>
        </svg>`
    ),

    // Встроенные сцены кампании (можно указать путь 'assets/maps/имя.jpg')
    mapScenes: [
        {
            icon: '🏘️',
            title: 'Деревня Притишье',
            desc: 'Маленькая деревня на границе цивилизации. Старый Смотритель встречает отряд.',
            img: ''
        },
        {
            icon: '🌲',
            title: 'Тёмная чаща у Древа',
            desc: 'Искажённый лес, где бродят порождения Ошибки.',
            img: ''
        },
        {
            icon: '🏰',
            title: 'Застава Псов Империи',
            desc: 'Укреплённый гарнизон Генерала Псов.',
            img: ''
        },
        {
            icon: '🔥',
            title: 'Лагерь у костра',
            desc: 'Безопасная поляна для ночного привала.',
            img: ''
        }
    ],

    // Текстуры покрытия клеток для Конструктора Карт (если файла нет — рисуется встроенная фактура)
    builderTiles: {
        grass:  { name: 'Трава',       icon: '🌿', bg: '#31542c', border: '#233d1f', img: 'assets/tiles/grass.png' },
        dirt:   { name: 'Тропа/Земля', icon: '🛤️', bg: '#694f37', border: '#4f3a27', img: 'assets/tiles/dirt.png' },
        cobble: { name: 'Брусчатка',   icon: '🏛️', bg: '#64666b', border: '#484a4f', img: 'assets/tiles/cobble.png' },
        stone:  { name: 'Каменный пол',icon: '🪨', bg: '#4b4e54', border: '#35383d', img: 'assets/tiles/stone.png' },
        wood:   { name: 'Доски (Пол)', icon: '🪵', bg: '#734b2c', border: '#54351d', img: 'assets/tiles/wood.png' },
        wall:   { name: 'Стена',       icon: '🧱', bg: '#262422', border: '#57534e', img: 'assets/tiles/wall.png' },
        water:  { name: 'Вода',        icon: '🌊', bg: '#1e527d', border: '#153c5c', img: 'assets/tiles/water.png' },
        lava:   { name: 'Лава',        icon: '🔥', bg: '#b91c1c', border: '#f97316', img: 'assets/tiles/lava.png' },
        snow:   { name: 'Снег/Лёд',    icon: '❄️', bg: '#cbd5e1', border: '#94a3b8', img: 'assets/tiles/snow.png' },
        sand:   { name: 'Песок',       icon: '🏜️', bg: '#c2a878', border: '#9e8559', img: 'assets/tiles/sand.png' },
        abyss:  { name: 'Пропасть',    icon: '🕳️', bg: '#0c0c0e', border: '#1d1d21', img: 'assets/tiles/abyss.png' }
    },

    // Объекты/штампы поверх клеток (PNG с прозрачным фоном; если файла нет — используется иконка с тенью)
    builderStamps: [
        { id: 'pine',     icon: '🌲', label: 'Ель',         img: 'assets/stamps/pine.png' },
        { id: 'oak',      icon: '🌳', label: 'Дуб',         img: 'assets/stamps/oak.png' },
        { id: 'rock',     icon: '🪨', label: 'Валун',       img: 'assets/stamps/rock.png' },
        { id: 'house',    icon: '🏠', label: 'Дом',         img: 'assets/stamps/house.png' },
        { id: 'tower',    icon: '🏰', label: 'Башня',       img: 'assets/stamps/tower.png' },
        { id: 'door',     icon: '🚪', label: 'Дверь',       img: 'assets/stamps/door.png' },
        { id: 'table',    icon: '🪑', label: 'Стол',        img: 'assets/stamps/table.png' },
        { id: 'barrel',   icon: '🍺', label: 'Бочки/Бар',   img: 'assets/stamps/barrel.png' },
        { id: 'crate',    icon: '📦', label: 'Ящик',        img: 'assets/stamps/crate.png' },
        { id: 'chest',    icon: '💰', label: 'Сундук',      img: 'assets/stamps/chest.png' },
        { id: 'campfire', icon: '🔥', label: 'Костёр',      img: 'assets/stamps/campfire.png' },
        { id: 'torch',    icon: '🕯️', label: 'Факел',       img: 'assets/stamps/torch.png' },
        { id: 'bed',      icon: '🛏️', label: 'Кровать',     img: 'assets/stamps/bed.png' },
        { id: 'altar',    icon: '⛩️', label: 'Алтарь',      img: 'assets/stamps/altar.png' },
        { id: 'fountain', icon: '⛲', label: 'Фонтан',      img: 'assets/stamps/fountain.png' },
        { id: 'bridge',   icon: '🌉', label: 'Мост',        img: 'assets/stamps/bridge.png' },
        { id: 'web',      icon: '🕸️', label: 'Паутина',     img: 'assets/stamps/web.png' },
        { id: 'bones',    icon: '💀', label: 'Кости',       img: 'assets/stamps/bones.png' }
    ]
};

(function APPLY_SITE_ASSET_CSS_VARS() {
    if (!window.SITE_ASSETS) return;
    const root = document.documentElement;
    root.style.setProperty('--fog-base-color', window.SITE_ASSETS.fogBaseColor || '#d4dae0');
    root.style.setProperty('--fog-clouds-bg', `url("${window.SITE_ASSETS.fogClouds}")`);
})();