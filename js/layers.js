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
            roadsCheckbox.addEventListener('change', async (e) => {
                if (e.target.checked) {
                    if (!roadsLayer) await loadRoads();
                    if (roadsLayer) map.addLayer(roadsLayer);
                } else {
                    if (roadsLayer) map.removeLayer(roadsLayer);
                }
            });
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
                style: {
                    fillColor: '#4CAF50',
                    color: '#4CAF50',
                    weight: 1,
                    opacity: 0.8,
                    fillOpacity: 0.6
                },
                onEachFeature: function(feature, layer) {
                    const ndvi = feature.properties.ndvi?.toFixed(2) || '?';
                    const area = feature.properties.area ? Math.round(feature.properties.area).toLocaleString() : '?';
                    layer.bindTooltip(`Парк (NDVI: ${ndvi})`, { sticky: true });
                    
                    layer.on('click', function(e) {
                        L.DomEvent.stopPropagation(e);
                        UI.showParkInfo(feature.properties);
                    });
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
    
    async function loadRoads() {
        try {
            const response = await fetch('https://backend-project-sber.onrender.com/roads');
            if (!response.ok) throw new Error('Ошибка загрузки дорог');
            const data = await response.json();
            
            if (roadsLayer) map.removeLayer(roadsLayer);
            
            roadsLayer = L.geoJSON(data, {
                style: function(feature) {
                    let maxScore = 0;
                    for (const key in feature.properties) {
                        const val = parseFloat(feature.properties[key]);
                        if (!isNaN(val) && val > maxScore) maxScore = val;
                    }
                    const intensity = Math.min(1, Math.max(0, maxScore));
                    const r = Math.floor(255 * (1 - intensity));
                    const g = Math.floor(255 * intensity);
                    const b = 0;
                    return {
                        color: `rgb(${r}, ${g}, ${b})`,
                        weight: 3,
                        opacity: 0.8
                    };
                },
                onEachFeature: function(feature, layer) {
                    layer.bindTooltip(`Дорога (оценка: ${feature.properties.quality || 'средняя'})`, { sticky: true });
                }
            });
            
            const isChecked = document.getElementById('layer-roads-checkbox')?.checked;
            if (isChecked) {
                map.addLayer(roadsLayer);
            }
        } catch (err) {
            console.error("Ошибка загрузки дорог:", err);
            UI.showError('Не удалось загрузить слой дорог');
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
        loadRoads,
        hideAllLayers,
        getQuartersLayer,
        getParksLayer,
        getCurrentFeatures
    };
})();