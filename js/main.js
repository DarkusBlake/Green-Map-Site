// js/main.js
// Точка входа, инициализация всех модулей

(function() {
    // Состояние приложения
    let currentMode = 'green';
    
    // Инициализация при загрузке страницы
    document.addEventListener('DOMContentLoaded', async () => {
        // Инициализация UI
        UI.init();
        
        // Инициализация менеджера городов
        CityManager.init();
        
        // Инициализация карты
        const map = MapManager.init();
        
        // Инициализация менеджера слоёв
        LayerManager.init(map);
        
        // Инициализация поиска
        SearchManager.init(map);
        
        // Загрузка данных
        UI.showLoading();
        await LayerManager.loadQuarters();
        await LayerManager.loadParks();
        UI.hideLoading();
        
        // Подписка на смену города
        CityManager.onCityChange(async (cityId, cityData) => {
            UI.showLoading();
            UI.showDefaultPanel();
            MapManager.updateViewForCity(cityId, cityData);
            await LayerManager.loadQuarters();
            await LayerManager.loadParks();
            UI.hideLoading();
        });
        
        // Настройка кнопок режимов (если есть)
        setupModeButtons();
    });
    
    function setupModeButtons() {
        // Если есть кнопки для переключения режимов карты
        const modeButtons = document.querySelectorAll('.mode-btn');
        if (modeButtons.length) {
            modeButtons.forEach(btn => {
                btn.addEventListener('click', () => {
                    const mode = btn.getAttribute('data-mode');
                    if (mode === 'light') {
                        currentMode = 'light';
                        MapManager.switchToLightMode();
                    } else if (mode === 'green') {
                        currentMode = 'green';
                        MapManager.switchToGreenMode();
                    }
                    
                    // Обновляем активную кнопку
                    modeButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });
        }
    }
    
    // Экспортируем глобальные функции для обратной совместимости
    window.switchCity = (city) => CityManager.switchCity(city);
    window.toggleQuarters = () => LayerManager.toggleQuarters();
    window.switchMode = (mode) => {
        if (mode === 'light') MapManager.switchToLightMode();
        else MapManager.switchToGreenMode();
    };
})();
