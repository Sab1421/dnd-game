// ================================================================
// 🖼️ ЕДИНЫЙ КАТАЛОГ ВСТРОЕННОЙ ГРАФИКИ И ШАБЛОНОВ САЙТА (assets.js)
// Все файлы, указанные здесь (или положенные в папку assets/),
// автоматически доступны всем Мастерам и Игрокам на сайте!
// ================================================================

window.SITE_ASSETS = {
    // Базовый цвет подложки тумана (чтобы не было щелей и просветов)
    fogBaseColor: '#d4dae0',

    // Текстура облаков тумана войны и краёв карты.
    // По умолчанию — встроенный бесшовный SVG (работает сразу без доп. файлов).
    // Если захочешь использовать свою картинку, положи её в папку assets/
    // и просто замени значение ниже на: 'assets/fog-clouds.png'
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

    // Встроенные шаблоны сцен/карт для Мастеров.
    // Если положишь картинку в папку assets/maps/, просто укажи путь в поле img: 'assets/maps/pritishye.jpg'
    mapScenes: [
        {
            icon: '🏘️',
            title: 'Деревня Притишье',
            desc: 'Маленькая деревня на границе цивилизации. Старый Смотритель встречает отряд.',
            img: '' // например: 'assets/maps/pritishye.jpg'
        },
        {
            icon: '🌲',
            title: 'Тёмная чаща у Древа',
            desc: 'Искажённый лес, где бродят порождения Ошибки.',
            img: '' // например: 'assets/maps/forest.jpg'
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
    ]
};

// Автоматически прокидываем текстуру облаков в CSS-переменные (чтобы не дублировать в style.css)
(function APPLY_SITE_ASSET_CSS_VARS() {
    if (!window.SITE_ASSETS) return;
    const root = document.documentElement;
    root.style.setProperty('--fog-base-color', window.SITE_ASSETS.fogBaseColor || '#d4dae0');
    root.style.setProperty('--fog-clouds-bg', `url("${window.SITE_ASSETS.fogClouds}")`);
})();