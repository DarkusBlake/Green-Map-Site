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
        LayerManager.loadRoads(); // предзагрузка дорог (не добавляется на карту, пока чекбокс не включён)
        UI.hideLoading();
        
        CityManager.onCityChange(async (cityId, cityData) => {
            UI.showLoading();
            UI.showDefaultPanel();
            MapManager.updateViewForCity(cityId, cityData);
            await LayerManager.loadQuarters();
            await LayerManager.loadParks();
            LayerManager.loadRoads(); // перезагружаем дороги при смене города
            UI.hideLoading();
        });
        
        setupModeButtons();
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
    
    window.switchCity = (city) => CityManager.switchCity(city);
    window.switchMode = (mode) => {
        if (mode === 'light') MapManager.switchToLightMode();
        else MapManager.switchToGreenMode();
    };
})();
