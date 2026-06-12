window.MapManager = (function() {
    let map = null;
    let currentTileLayer = null;
    
    // Список серверов: стандартный OSM первым, остальные запасные
    const tileServers = [
        { url: 'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png', name: 'OSM Default' },
        { url: 'https://tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', name: 'OSM France' },
        { url: 'https://tiles.wmflabs.org/osm/{z}/{x}/{y}.png', name: 'WMFLabs' },
        { url: 'https://tile.openstreetmap.de/{z}/{x}/{y}.png', name: 'OSM Germany' },
        { url: 'https://tiles.nakarte.me/{z}/{x}/{y}.png', name: 'Nakarte.me' }
    ];
    
    let serverIndex = 0;
    
    function init() {
        const cityData = CityManager.getCityData();
        
        map = L.map('map', {
            zoomControl: false,
            closePopupOnClick: false
        }).setView(cityData.center, cityData.zoom);
        
        // Пытаемся загрузить тайлы с первого сервера (стандартный OSM)
        loadTileServer(0);
        
        // Контрол зума
        L.control.zoom({ position: 'topleft' }).addTo(map);
        
        // Обработчик клика по карте
        map.on('click', function(e) {
            if (!window.isClickOnQuarter) {
                if (window.UI) UI.showDefaultPanel();
            }
            setTimeout(() => { window.isClickOnQuarter = false; }, 50);
        });
        
        // Адаптация прозрачности кварталов при зуме
        map.on('zoomend', function() {
            const quartersLayer = window.LayerManager ? LayerManager.getQuartersLayer() : null;
            if (quartersLayer) {
                const zoom = map.getZoom();
                quartersLayer.eachLayer(function(layer) {
                    if (zoom < 12) {
                        layer.setStyle({ fillOpacity: 0.4, weight: 0.5 });
                    } else {
                        layer.setStyle({ fillOpacity: 0.7, weight: 1.5 });
                    }
                });
            }
        });
        
        console.log('MapManager инициализирован (стандартный OSM)');
        return map;
    }
    
    function loadTileServer(index) {
        if (currentTileLayer && map) map.removeLayer(currentTileLayer);
        if (index >= tileServers.length) {
            console.error('Все серверы тайлов недоступны');
            if (window.UI) UI.showError('Не удалось загрузить карту. Проверьте интернет.');
            return;
        }
        
        serverIndex = index;
        const server = tileServers[serverIndex];
        console.log(`Пробуем сервер: ${server.name} - ${server.url}`);
        
        currentTileLayer = L.tileLayer(server.url, {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            errorTileUrl: '',
            maxRetries: 2,
            maxNativeZoom: 19
        }).addTo(map);
        
        // При ошибке переключаемся на следующий сервер
        currentTileLayer.on('tileerror', function(err) {
            console.warn(`Ошибка на ${server.name}, переключаемся на следующий сервер...`);
            loadTileServer(serverIndex + 1);
        });
    }
    
    function getMap() { return map; }
    
    function updateViewForCity(cityId, cityData) {
        if (map) {
            map.setView(cityData.center, cityData.zoom);
            console.log(`Карта перемещена к городу ${cityData.name}`);
        }
    }
    
    function switchToLightMode() {
        if (currentTileLayer) {
            map.removeLayer(currentTileLayer);
        }
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(map);
        
        const quartersLayer = window.LayerManager ? LayerManager.getQuartersLayer() : null;
        if (quartersLayer && map.hasLayer(quartersLayer)) {
            map.removeLayer(quartersLayer);
        }
        
        if (window.UI) UI.showLightModeMessage();
    }
    
    function switchToGreenMode() {
        map.eachLayer(layer => {
            if (layer instanceof L.TileLayer && layer._url && layer._url.includes('cartocdn')) {
                map.removeLayer(layer);
            }
        });
        
        loadTileServer(0);
        
        const quartersLayer = window.LayerManager ? LayerManager.getQuartersLayer() : null;
        const isChecked = document.getElementById('layer-quarters-checkbox')?.checked;
        if (quartersLayer && isChecked && !map.hasLayer(quartersLayer)) {
            map.addLayer(quartersLayer);
        }
        
        if (window.UI) UI.showDefaultPanel();
    }
    
    return { 
        init, 
        getMap, 
        updateViewForCity,
        switchToLightMode,
        switchToGreenMode
    };
})();