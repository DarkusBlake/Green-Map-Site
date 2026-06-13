(function() {
    let currentMode = 'green';
    
    document.addEventListener('DOMContentLoaded', async () => {
        UI.init();
        CityManager.init();
        const map = MapManager.init();
        LayerManager.init(map);
        SearchManager.init(map);
        
        UI.showLoading('Загрузка данных города...');
        await LayerManager.loadQuarters();
        await LayerManager.loadParks();
        await LayerManager.loadRoads();
        
        // Автоматически показываем кварталы и синхронизируем чекбокс
        const quartersLayer = LayerManager.getQuartersLayer();
        if (quartersLayer) {
            map.addLayer(quartersLayer);
            // Синхронизируем чекбокс с видимостью слоя
            const quartersCheckbox = document.getElementById('layer-quarters-checkbox');
            if (quartersCheckbox) quartersCheckbox.checked = true;
        }
        
        // Показываем приветственную панель при загрузке
        UI.showDefaultPanel();
        
        UI.hideLoading();
        
        CityManager.onCityChange(async (cityId, cityData) => {
            UI.showLoading(`Переключение на ${cityData.name}...`);
            UI.hideInfoPanel(); // Скрываем панель при смене города
            
            // Полностью очищаем все слои с карты и сбрасываем состояние
            LayerManager.clearAllLayersFromMap();
            LayerManager.resetAllLayers();
            
            // Обновляем карту (центр и зум)
            MapManager.updateViewForCity(cityId, cityData);
            
            // Загружаем данные для нового города
            await LayerManager.loadQuarters();
            await LayerManager.loadParks();
            await LayerManager.loadRoads();
            
            // Автоматически показываем кварталы и синхронизируем чекбокс
            const newQuartersLayer = LayerManager.getQuartersLayer();
            if (newQuartersLayer) {
                map.addLayer(newQuartersLayer);
                const quartersCheckbox = document.getElementById('layer-quarters-checkbox');
                if (quartersCheckbox) quartersCheckbox.checked = true;
            }
            
            // Сбрасываем флаг клика
            window.isClickOnQuarter = false;
            
            UI.hideLoading();
            UI.showToast(`Город ${cityData.name} загружен`, 3000);
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