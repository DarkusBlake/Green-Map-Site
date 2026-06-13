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
    
    // Функция для сброса всех чекбоксов и скрытия слоёв
    function resetAllLayers() {
        const quartersCheckbox = document.getElementById('layer-quarters-checkbox');
        const parksCheckbox = document.getElementById('layer-parks-checkbox');
        const roadsCheckbox = document.getElementById('layer-roads-checkbox');
        
        if (quartersCheckbox && quartersCheckbox.checked) {
            quartersCheckbox.checked = false;
            if (quartersLayer && map.hasLayer(quartersLayer)) map.removeLayer(quartersLayer);
        }
        
        if (parksCheckbox && parksCheckbox.checked) {
            parksCheckbox.checked = false;
            if (parksLayer && map.hasLayer(parksLayer)) map.removeLayer(parksLayer);
        }
        
        if (roadsCheckbox && roadsCheckbox.checked) {
            roadsCheckbox.checked = false;
            if (roadsLayer && map.hasLayer(roadsLayer)) map.removeLayer(roadsLayer);
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
                style: function(feature) {
                    const ndvi = feature.properties.ndvi;
                    // Цветовая классификация по NDVI
                    if (ndvi === undefined || ndvi === null) {
                        return { fillColor: '#aaaaaa', color: '#aaaaaa', weight: 1, fillOpacity: 0.6 };
                    }
                    
                    let color;
                    if (ndvi >= 0.7) color = '#004d00';      // очень тёмно-зелёный (выдающийся)
                    else if (ndvi >= 0.55) color = '#1a5c1a';  // тёмно-зелёный (хороший)
                    else if (ndvi >= 0.4) color = '#4CAF50';   // зелёный (средний)
                    else if (ndvi >= 0.25) color = '#8bc34a';  // светло-зелёный (низкий)
                    else color = '#cddc39';                    // жёлто-зелёный (очень низкий)
                    
                    return {
                        fillColor: color,
                        color: color,
                        weight: 1,
                        opacity: 0.8,
                        fillOpacity: 0.6
                    };
                },
                onEachFeature: function(feature, layer) {
                    const ndvi = feature.properties.ndvi?.toFixed(3) || 'нет данных';
                    const area = feature.properties.area ? Math.round(feature.properties.area).toLocaleString() : '?';
                    layer.bindTooltip(`🌿 Парк | NDVI: ${ndvi} | Площадь: ${area} м²`, { sticky: true });
                    
                    layer.on('click', function(e) {
                        L.DomEvent.stopPropagation(e);
                        UI.showParkInfo(feature.properties);
                    });
                }
            });
            
            return parksLayer;
            
        } catch (err) {
            console.error("Ошибка загрузки парков:", err);
            return null;
        }
    }
    
    async function loadRoads() {
        try {
            const cityData = CityManager.getCityData();
            const response = await fetch(cityData.roadsUrl);
            if (!response.ok) throw new Error(`Ошибка загрузки дорог: ${response.status}`);
            const data = await response.json();
            
            if (roadsLayer) map.removeLayer(roadsLayer);
            
            // Только для Москвы меняем координаты местами
            const needSwapCoords = cityData.name === 'Москва';
            
            roadsLayer = L.geoJSON(data, {
                coordsToLatLng: function(coords) {
                    if (needSwapCoords) {
                        return L.latLng(coords[1], coords[0]);
                    } else {
                        return L.latLng(coords[0], coords[1]);
                    }
                },
                style: function(feature) {
                    const props = feature.properties;
                    const good = props.good_num || 0;
                    const regular = props.regular_num || 0;
                    const bad = props.bad_num || 0;
                    
                    let maxValue = Math.max(good, regular, bad);
                    
                    if (maxValue === 0) {
                        return { color: '#6c757d', weight: 3, opacity: 0.8 };
                    }
                    
                    const candidates = [];
                    if (good === maxValue) candidates.push('good');
                    if (regular === maxValue) candidates.push('regular');
                    if (bad === maxValue) candidates.push('bad');
                    
                    let dominantCategory;
                    if (candidates.length > 1) {
                        if (candidates.includes('bad')) dominantCategory = 'bad';
                        else if (candidates.includes('regular')) dominantCategory = 'regular';
                        else dominantCategory = 'good';
                    } else {
                        dominantCategory = candidates[0];
                    }
                    
                    switch (dominantCategory) {
                        case 'good': return { color: '#221e18', weight: 3, opacity: 0.8 }; 
                        case 'regular': return { color: '#5a3a2b', weight: 3, opacity: 0.8 }; 
                        case 'bad': return { color: '#684226', weight: 3, opacity: 0.8 }; 
                        default: return { color: '#6c757d', weight: 3, opacity: 0.8 };
                    }
                },
                onEachFeature: function(feature, layer) {
                    const props = feature.properties;
                    const good = props.good_num || 0;
                    const regular = props.regular_num || 0;
                    const bad = props.bad_num || 0;
                    layer.bindTooltip(`🚦 Дорога | Хороших: ${good} | Обычных: ${regular} | Плохих: ${bad}`, { sticky: true });
                }
            });
            
            return roadsLayer;
            
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
        resetAllLayers,
        hideAllLayers,
        getQuartersLayer,
        getParksLayer,
        getCurrentFeatures
    };
})();