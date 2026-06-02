// js/layers.js
// Управление слоями карты

window.LayerManager = (function() {
    let map = null;
    let quartersLayer = null;
    let parksLayer = null;
    let roadsLayer = null;
    
    let currentFeatures = [];
    
    function init(mapInstance) {
        map = mapInstance;
        setupCheckboxes();
    }
    
    function setupCheckboxes() {
        const quartersCheckbox = document.getElementById('layer-quarters-checkbox');
        const parksCheckbox = document.getElementById('layer-parks-checkbox');
        const roadsCheckbox = document.getElementById('layer-roads-checkbox');
        
        if (quartersCheckbox) {
            quartersCheckbox.addEventListener('change', (e) => {
                if (quartersLayer) {
                    if (e.target.checked) map.addLayer(quartersLayer);
                    else map.removeLayer(quartersLayer);
                }
            });
        }
        
        if (parksCheckbox) {
            parksCheckbox.addEventListener('change', (e) => {
                if (parksLayer) {
                    if (e.target.checked) map.addLayer(parksLayer);
                    else map.removeLayer(parksLayer);
                }
            });
        }
        
        if (roadsCheckbox) {
            roadsCheckbox.addEventListener('change', (e) => {
                if (roadsLayer) {
                    if (e.target.checked) map.addLayer(roadsLayer);
                    else map.removeLayer(roadsLayer);
                } else if (e.target.checked) {
                    loadRoadsMockData();
                }
            });
        }
        
        const toggleBtn = document.getElementById('toggle-quarters-btn');
        if (toggleBtn) {
            toggleBtn.addEventListener('click', toggleQuarters);
        }
    }
    
    async function loadQuarters() {
        try {
            UI.showLoading();
            const cityData = CityManager.getCityData();
            const response = await fetch(cityData.quartersUrl);
            const data = await response.json();
            
            if (quartersLayer && map) map.removeLayer(quartersLayer);
            
            const enrichedData = {
                ...data,
                features: data.features.map(feature => ({
                    ...feature,
                    properties: {
                        ...feature.properties,
                        calculated_quality: Utils.calculateQuality(feature)
                    }
                }))
            };
            
            currentFeatures = enrichedData.features;
            
            quartersLayer = L.geoJSON(enrichedData, {
                style: function(feature) {
                    const quality = feature.properties.calculated_quality;
                    return {
                        fillColor: Utils.getColorByQuality(quality),
                        fillOpacity: 0.7,
                        color: 'white',
                        weight: 1.5,
                        opacity: 0.8
                    };
                },
                onEachFeature: function(feature, layer) {
                    const quality = feature.properties.calculated_quality;
                    const qualityText = Utils.getQualityText(quality);
                    
                    layer.bindTooltip(`${qualityText} качество (${quality})`, {
                        sticky: true,
                        direction: 'center'
                    });
                    
                    layer.on('click', function(e) {
                        window.isClickOnQuarter = true;
                        if (e.originalEvent) {
                            L.DomEvent.stopPropagation(e.originalEvent);
                        }
                        UI.showQuarterInfo(feature.properties);
                        L.DomEvent.stopPropagation(e);
                        
                        layer.setStyle({ weight: 3, color: '#ffeb3b', opacity: 1 });
                        setTimeout(() => {
                            layer.setStyle({ weight: 1.5, color: 'white', opacity: 0.8 });
                        }, 2000);
                    });
                    
                    layer.on('mouseover', function() {
                        layer.setStyle({ weight: 2.5, color: '#ffeb3b', opacity: 1 });
                    });
                    
                    layer.on('mouseout', function() {
                        layer.setStyle({ weight: 1.5, color: 'white', opacity: 0.8 });
                    });
                }
            });
            
            const isChecked = document.getElementById('layer-quarters-checkbox')?.checked;
            if (isChecked !== false) {
                map.addLayer(quartersLayer);
            }
            
            UI.hideLoading();
            return quartersLayer;
            
        } catch (err) {
            console.error("Ошибка загрузки кварталов:", err);
            UI.hideLoading();
            UI.showError(err.message);
            return null;
        }
    }
    
    async function loadParks() {
        try {
            const cityData = CityManager.getCityData();
            const response = await fetch(cityData.parksUrl);
            const data = await response.json();
            
            if (parksLayer && map) map.removeLayer(parksLayer);
            
            parksLayer = L.geoJSON(data, {
                style: Utils.getParkStyle,
                onEachFeature: function(feature, layer) {
                    const props = feature.properties;
                    const ndvi = props.ndvi?.toFixed(2) || '?';
                    layer.bindTooltip(`Парк: ${props.quality_class || 'обычный'} (NDVI: ${ndvi})`, { sticky: true });
                }
            });
            
            const isChecked = document.getElementById('layer-parks-checkbox')?.checked;
            if (isChecked) {
                map.addLayer(parksLayer);
            }
            
            return parksLayer;
            
        } catch (err) {
            console.error("Ошибка загрузки парков:", err);
            return null;
        }
    }
    
    async function loadRoadsMockData() {
        if (roadsLayer) return;
        
        const mockRoadsGroup = L.layerGroup();
        L.popup()
            .setLatLng(map.getCenter())
            .setContent('<div style="padding:10px"><strong>Оценка дорог</strong><br>Функционал в разработке.<br>API для дорог будет добавлено позже.</div>')
            .openOn(map);
        
        roadsLayer = mockRoadsGroup;
        if (document.getElementById('layer-roads-checkbox')?.checked) {
            map.addLayer(roadsLayer);
        }
    }
    
    function toggleQuarters() {
        const btn = document.getElementById('toggle-quarters-btn');
        const chk = document.getElementById('layer-quarters-checkbox');
        
        if (quartersLayer) {
            if (map.hasLayer(quartersLayer)) {
                map.removeLayer(quartersLayer);
                btn.innerHTML = '<i class="fas fa-eye-slash"></i> Показать кварталы';
                if (chk) chk.checked = false;
            } else {
                map.addLayer(quartersLayer);
                btn.innerHTML = '<i class="fas fa-eye"></i> Скрыть кварталы';
                if (chk) chk.checked = true;
            }
        }
    }
    
    function hideAllLayers() {
        if (quartersLayer && map.hasLayer(quartersLayer)) map.removeLayer(quartersLayer);
        if (parksLayer && map.hasLayer(parksLayer)) map.removeLayer(parksLayer);
        if (roadsLayer && map.hasLayer(roadsLayer)) map.removeLayer(roadsLayer);
    }
    
    function getQuartersLayer() { return quartersLayer; }
    function getParksLayer() { return parksLayer; }
    function getCurrentFeatures() { return currentFeatures; }
    
    return {
        init,
        loadQuarters,
        loadParks,
        loadRoadsMockData,
        toggleQuarters,
        hideAllLayers,
        getQuartersLayer,
        getParksLayer,
        getCurrentFeatures
    };
})();
