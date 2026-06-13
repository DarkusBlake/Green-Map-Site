(function() {
    let currentMode = 'green';
    
    document.addEventListener('DOMContentLoaded', async () => {
        UI.init();
        CityManager.init();
        const map = MapManager.init();
        LayerManager.init(map);
        SearchManager.init(map);
        
        UI.showLoading();
        await LayerManager.loadQuarters();
        await LayerManager.loadParks();
        LayerManager.loadRoads();
        UI.hideLoading();
        
        CityManager.onCityChange(async (cityId, cityData) => {
            UI.showLoading();
            UI.showDefaultPanel();
            
            // Сбрасываем все чекбоксы и скрываем слои
            LayerManager.resetAllLayers();
            
            // Обновляем карту
            MapManager.updateViewForCity(cityId, cityData);
            
            // Перезагружаем данные (без автоматического добавления на карту)
            await LayerManager.loadQuarters();
            await LayerManager.loadParks();
            await LayerManager.loadRoads();
            
            UI.hideLoading();
        });
        
        setupModeButtons();
        initLegend();
    });
    
    function setupModeButtons() {
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
                    modeButtons.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                });
            });
        }
    }
    
    // Инициализация легенды (попап окно)
    function initLegend() {
        const legendBtn = document.getElementById('legend-btn');
        const modal = document.getElementById('legend-modal');
        const closeBtn = document.querySelector('.legend-close');
        
        if (!legendBtn || !modal) return;
        
        legendBtn.addEventListener('click', () => {
            modal.style.display = 'block';
        });
        
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                modal.style.display = 'none';
            });
        }
        
        window.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal.style.display === 'block') {
                modal.style.display = 'none';
            }
        });
    }
    
    window.switchCity = (city) => CityManager.switchCity(city);
    window.switchMode = (mode) => {
        if (mode === 'light') MapManager.switchToLightMode();
        else MapManager.switchToGreenMode();
    };
})();