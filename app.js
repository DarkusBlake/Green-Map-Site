let map;
let quartersLayer = null;
let allQuarters = [];
let currentCity = 'ekaterinburg';
let currentMode = 'green';
let searchControl = null;
let currentFeatures = [];

// Ссылки на бэкенд
const cityData = {
    'moscow': {
        name: 'Москва',
        center: [55.7558, 37.6173],
        zoom: 11,
        url: 'https://backendprojectsber-vladpimanov5834-q17o0eqs.leapcell.dev/quarters?city=moscow'
    },
    'ekaterinburg': {
        name: 'Екатеринбург',
        center: [56.838, 60.605],
        zoom: 12,
        url: 'https://backendprojectsber-vladpimanov5834-q17o0eqs.leapcell.dev/quarters?city=ekaterinburg'
    },
    'peter': {
        name: 'Санкт-Петербург',
        center: [59.9343, 30.3351],
        zoom: 11,
        url: 'https://backendprojectsber-vladpimanov5834-q17o0eqs.leapcell.dev/quarters?city=saint-petersburg'
    }
};

// Функция для расчёта качества квартала на основе данных
function calculateQuality(feature) {
    const props = feature.properties;
    
    if (props.quality >= 1 && props.quality <= 3) {
        return props.quality;
    }
    
    const ndvi = props.general_ndvi || 0;
    const greenDensity = props.population_density_per_green_zone || 0;
    
    let score = 0;
    
    if (ndvi >= 0.65) {
        score += 2;
    } else if (ndvi >= 0.55) {
        score += 1;
    } else if (ndvi >= 0.45) {
        score += 0;
    } else {
        score -= 1;
    }
    
    if (greenDensity === 0) {
        score += 1;
    } else if (greenDensity < 10) {
        score += 1;
    } else if (greenDensity < 50) {
        score += 0;
    } else if (greenDensity < 150) {
        score -= 1;
    } else {
        score -= 2;
    }
    
    const totalParksArea = (props.great_parks_area || 0) + 
                          (props.good_parks_area || 0) + 
                          (props.ok_parks_area || 0);
    const area = props.area || 1;
    const parkCoverage = (totalParksArea / area) * 100;
    
    if (parkCoverage > 20) {
        score += 1;
    } else if (parkCoverage > 10) {
        score += 0;
    } else if (parkCoverage > 5) {
        score -= 0.5;
    } else {
        score -= 1;
    }
    
    if (score >= 2) {
        return 3;
    } else if (score >= 0) {
        return 2;
    } else {
        return 1;
    }
}

function getColorByQuality(quality) {
    switch(quality) { 
        case 1: return '#7fd968ff';
        case 2: return '#35b444ff';
        case 3: return '#096f0eff';
        default: return '#cccccc';
    }
}

function getQualityText(quality) {
    switch(quality) {
        case 1: return 'Плохое';
        case 2: return 'Нормальное';
        case 3: return 'Хорошее';
        default: return 'Неизвестно';
    }
}

// ========== ПОИСКОВАЯ СТРОКА ==========

function addSearchControl() {
    const SearchControl = L.Control.extend({
        options: {
            position: 'topleft'
        },
        
        onAdd: function(map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom-search');
            container.style.backgroundColor = 'white';
            container.style.padding = '5px';
            container.style.borderRadius = '4px';
            container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.65)';
            container.style.display = 'flex';
            container.style.alignItems = 'center';
            container.style.gap = '5px';
            
            this.input = L.DomUtil.create('input', 'search-input', container);
            this.input.type = 'text';
            this.input.placeholder = '🔍 Поиск адреса или места...';
            this.input.style.padding = '8px 12px';
            this.input.style.border = 'none';
            this.input.style.outline = 'none';
            this.input.style.fontSize = '14px';
            this.input.style.width = '250px';
            this.input.style.borderRadius = '3px';
            
            this.button = L.DomUtil.create('button', 'search-button', container);
            this.button.innerHTML = '🔍';
            this.button.style.padding = '8px 12px';
            this.button.style.border = 'none';
            this.button.style.backgroundColor = '#4CAF50';
            this.button.style.color = 'white';
            this.button.style.borderRadius = '3px';
            this.button.style.cursor = 'pointer';
            this.button.style.fontSize = '14px';
            
            L.DomEvent.disableClickPropagation(container);
            L.DomEvent.disableScrollPropagation(container);
            
            this.button.onclick = () => {
                this.search();
            };
            
            this.input.onkeypress = (e) => {
                if (e.key === 'Enter') {
                    this.search();
                }
            };
            
            return container;
        },
        
        search: function() {
            const query = this.input.value.trim();
            if (!query) {
                console.warn('Введите запрос для поиска');
                return;
            }
            
            console.log('Поиск:', query);
            showLoading();
            
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&addressdetails=1&lang=ru`;
            
            fetch(url, {
                headers: {
                    'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8'
                }
            })
            .then(response => response.json())
            .then(data => {
                hideLoading();
                
                if (!data || data.length === 0) {
                    showSearchResults([]);
                    return;
                }
                
                console.log('Найдено результатов:', data.length);
                showSearchResults(data);
            })
            .catch(error => {
                hideLoading();
                console.error('Ошибка поиска:', error);
                alert('Ошибка при поиске. Попробуйте позже.');
            });
        }
    });
    
    searchControl = new SearchControl();
    searchControl.addTo(map);
}

function showSearchResults(results) {
    if (window.searchMarkersLayer) {
        map.removeLayer(window.searchMarkersLayer);
    }
    
    if (!results || results.length === 0) {
        alert('Ничего не найдено. Попробуйте изменить запрос.');
        return;
    }
    
    window.searchMarkersLayer = L.layerGroup().addTo(map);
    
    let resultsHtml = '<div style="max-height: 300px; overflow-y: auto;"><strong>Результаты поиска:</strong><ul style="list-style: none; padding: 0; margin: 10px 0;">';
    
    results.forEach((result, index) => {
        const lat = parseFloat(result.lat);
        const lon = parseFloat(result.lon);
        const displayName = result.display_name;
        
        const marker = L.marker([lat, lon], {
            icon: L.divIcon({
                className: 'search-marker',
                html: `<div style="background: #4CAF50; color: white; border-radius: 50%; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border: 2px solid white; box-shadow: 0 2px 4px rgba(0,0,0,0.3);">${index + 1}</div>`,
                iconSize: [24, 24],
                popupAnchor: [0, -12]
            })
        })
        .bindPopup(`
            <div style="min-width: 200px;">
                <strong>📍 ${result.name || 'Место'}</strong>
                <p style="font-size: 11px; color: #666; margin: 5px 0;">${result.display_name.substring(0, 150)}...</p>
                <button onclick="zoomToLocation(${lat}, ${lon}, '${displayName.replace(/'/g, "\\'")}')" 
                        style="width: 100%; padding: 5px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer; margin-top: 5px;">
                    🔍 Перейти к месту
                </button>
            </div>
        `)
        .addTo(window.searchMarkersLayer);
        
        resultsHtml += `<li style="margin: 5px 0; padding: 5px; border-bottom: 1px solid #eee;">
            <strong>${index + 1}.</strong> ${result.display_name.substring(0, 100)}...
            <button onclick="zoomToLocation(${lat}, ${lon}, '${displayName.replace(/'/g, "\\'")}')" 
                    style="margin-left: 10px; padding: 2px 8px; background: #4CAF50; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 11px;">
                Перейти
            </button>
        </li>`;
    });
    
    resultsHtml += '</ul></div>';
    
    const firstResult = results[0];
    const lat = parseFloat(firstResult.lat);
    const lon = parseFloat(firstResult.lon);
    
    L.popup()
        .setLatLng([lat, lon])
        .setContent(resultsHtml)
        .openOn(map);
    
    setTimeout(() => {
        const bounds = window.searchMarkersLayer.getBounds();
        if (bounds.isValid()) {
            map.fitBounds(bounds, { padding: [50, 50] });
        } else {
            map.setView([lat, lon], 15);
        }
    }, 100);
}

window.zoomToLocation = function(lat, lon, name) {
    map.setView([lat, lon], 17);
    
    const marker = L.marker([lat, lon], {
        icon: L.divIcon({
            className: 'temp-marker',
            html: '<div style="background: #ff4444; color: white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; font-size: 20px; animation: pulse 0.5s ease;">📍</div>',
            iconSize: [30, 30],
            popupAnchor: [0, -15]
        })
    })
    .bindPopup(`<strong>${name}</strong><br>Вы перешли к этому месту`)
    .addTo(map);
    
    setTimeout(() => {
        map.removeLayer(marker);
    }, 3000);
    
    if (!document.querySelector('#pulse-animation')) {
        const style = document.createElement('style');
        style.id = 'pulse-animation';
        style.textContent = `
            @keyframes pulse {
                0% { transform: scale(0.8); opacity: 1; }
                100% { transform: scale(1.2); opacity: 0; }
            }
            .temp-marker div {
                animation: pulse 0.5s ease-out !important;
            }
        `;
        document.head.appendChild(style);
    }
};

// Инициализация карты
function initMap() {
    const city = cityData[currentCity];
    map = L.map('map', {
        zoomControl: false,
        closePopupOnClick: false
    }).setView(city.center, city.zoom);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    // Исправлено: показываем дефолтную панель сразу, без задержки
    map.on('click', function (e) {
        // Сбрасываем флаг клика по кварталу
        if (!window.isClickOnQuarter) {
            showDefaultPanel();
        }
        // Сбрасываем флаг после обработки
        setTimeout(() => {
            window.isClickOnQuarter = false;
        }, 50);
    });
    
    addSearchControl();
    
    L.control.zoom({
        position: 'topleft'
    }).addTo(map);
    
    loadCityData();
    
    map.on('zoomend', function() {
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
}

// Функция для отображения дефолтной панели
function showDefaultPanel() {
    const panel = document.getElementById('info-panel');
    if (!panel) return;
    
    panel.style.display = 'block';
    panel.innerHTML = `
        <div class="info-placeholder">
            <i class="fas fa-map-marker-alt"></i>
            <p>Кликните по кварталу, чтобы увидеть подробную информацию</p>
            <br>
            <small>💡 Используйте поиск в левом верхнем углу</small>
        </div>
    `;
}

// ========== ГЛОБАЛЬНЫЕ ФУНКЦИИ ==========

window.switchCity = async function(city) {
    console.log('Переключение на город:', city);
    currentCity = city;
    
    document.querySelectorAll('.city-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('onclick')?.includes(city)) {
            btn.classList.add('active');
        }
    });
    
    showLoading();
    const cityInfo = cityData[currentCity];
    
    // Сначала показываем дефолтную панель
    showDefaultPanel();
    
    // Устанавливаем вид с правильным зумом
    map.setView(cityInfo.center, cityInfo.zoom);
    
    // Загружаем данные
    await loadCityData();
    
    // После загрузки не делаем fitBounds, чтобы сохранить установленный зум
    // Просто применяем текущий режим
    if (currentMode === 'light' && quartersLayer) {
        map.removeLayer(quartersLayer);
    } else if (currentMode === 'green' && quartersLayer && !map.hasLayer(quartersLayer)) {
        map.addLayer(quartersLayer);
    }
    
    hideLoading();
};

window.switchMode = function(mode) {
    currentMode = mode;
    
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.closest('.mode-btn').classList.add('active');
    
    if (mode === 'green') {
        if (quartersLayer && !map.hasLayer(quartersLayer)) {
            map.addLayer(quartersLayer);
        }
        
        map.eachLayer(layer => {
            if (layer instanceof L.TileLayer && layer._url.includes('cartocdn')) {
                map.removeLayer(layer);
            }
        });
        if (!window.defaultTileLayer) {
            window.defaultTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '&copy; OpenStreetMap contributors'
            });
        }
        if (!map.hasLayer(window.defaultTileLayer)) {
            window.defaultTileLayer.addTo(map);
        }
        
        showDefaultPanel();
        
    } else if (mode === 'light') {
        if (quartersLayer && map.hasLayer(quartersLayer)) {
            map.removeLayer(quartersLayer);
        }
        
        if (window.defaultTileLayer) {
            map.removeLayer(window.defaultTileLayer);
        }
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(map);
        
        const panel = document.getElementById('info-panel');
        panel.innerHTML = `
            <div class="info-placeholder">
                <i class="fas fa-lightbulb"></i>
                <p>Световая карта активна</p>
                <small>Кварталы скрыты для лучшей видимости</small>
                <br><br>
                <small>💡 Используйте поиск в левом верхнем углу</small>
            </div>
        `;
    }
};

window.toggleQuarters = function() {
    const button = document.getElementById('toggle-quarters-btn');
    
    if (quartersLayer) {
        if (map.hasLayer(quartersLayer)) {
            map.removeLayer(quartersLayer);
            button.innerHTML = '<i class="fas fa-eye-slash"></i> Показать кварталы';
            button.style.opacity = '0.7';
        } else {
            map.addLayer(quartersLayer);
            button.innerHTML = '<i class="fas fa-eye"></i> Скрыть кварталы';
            button.style.opacity = '1';
        }
    }
};

async function loadCityData() {
    try {
        showLoading();
        
        const response = await fetch(cityData[currentCity].url);
        const data = await response.json();
        
        console.log(`Загружено ${data.features?.length || 0} кварталов для ${cityData[currentCity].name}`);
        
        if (quartersLayer) {
            map.removeLayer(quartersLayer);
        }
        
        const enrichedData = {
            ...data,
            features: data.features.map(feature => ({
                ...feature,
                properties: {
                    ...feature.properties,
                    calculated_quality: calculateQuality(feature)
                }
            }))
        };
        
        currentFeatures = enrichedData.features;
        
        quartersLayer = L.geoJSON(enrichedData, {
            style: function(feature) {
                const quality = feature.properties.calculated_quality;
                return {
                    fillColor: getColorByQuality(quality),
                    fillOpacity: 0.7,
                    color: 'white',
                    weight: 1.5,
                    opacity: 0.8
                };
            },
            onEachFeature: function(feature, layer) {
                const quality = feature.properties.calculated_quality;
                const qualityText = getQualityText(quality);
                
                layer.bindTooltip(`${qualityText} качество (${quality})`, {
                    sticky: true,
                    direction: 'center'
                });
                
                layer.on('click', function (e) {
                    window.isClickOnQuarter = true;
                    
                    if (e.originalEvent) {
                        L.DomEvent.stopPropagation(e.originalEvent);
                    }

                    showInfoPanel(feature.properties);
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
        }).addTo(map);
        
        // Убираем автоматический fitBounds
        console.log(`Загружено ${enrichedData.features.length} кварталов`);
        
        if (currentMode === 'light') {
            map.removeLayer(quartersLayer);
        }
        
        hideLoading();
        
    } catch (err) {
        console.error("Ошибка загрузки данных:", err);
        hideLoading();
        
        const panel = document.getElementById('info-panel');
        panel.innerHTML = `
            <div class="info-placeholder">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Ошибка загрузки данных</p>
                <small>${err.message}</small>
            </div>
        `;
    }
}

function showInfoPanel(props) {
    const panel = document.getElementById('info-panel');
    if (!panel) return;
    
    panel.style.display = 'block';
    
    const quality = props.calculated_quality || calculateQuality({ properties: props });
    const qualityText = getQualityText(quality);
    
    const formatNumber = (num) => {
        if (!num) return '0';
        if (num > 1000000) return (num / 1000000).toFixed(1) + ' млн';
        if (num > 1000) return (num / 1000).toFixed(0) + ' тыс';
        return Math.round(num).toString();
    };
    
    panel.innerHTML = `
        <div class="info-details">
            <div class="info-title">
                <i class="fas fa-building"></i> 
                Квартал ${props.quarter_id || 'N/A'}
            </div>
            
            <div class="info-stats">
                <div class="info-stat-card">
                    <div class="info-stat-number">${formatNumber(props.population)}</div>
                    <div class="info-stat-label">Население</div>
                </div>
                <div class="info-stat-card">
                    <div class="info-stat-number">${Math.round(props.area || 0).toLocaleString()} м²</div>
                    <div class="info-stat-label">Площадь</div>
                </div>
                <div class="info-stat-card">
                    <div class="info-stat-number">${(props.general_ndvi || 0).toFixed(3)}</div>
                    <div class="info-stat-label">NDVI индекс</div>
                </div>
            </div>
            
            <div class="info-quality">
                <div class="quality-badge level-${quality}">
                    <i class="fas ${quality === 3 ? 'fa-star' : (quality === 2 ? 'fa-smile' : 'fa-exclamation-circle')}"></i>
                    Качество: ${qualityText} (${quality}/3)
                </div>
            </div>
            
            <div class="info-parks">
                <h4><i class="fas fa-tree"></i> Зелёные зоны</h4>
                <table class="parks-table">
                    <thead>
                        <tr><th>Тип</th><th>Кол-во</th><th>Площадь</th></tr>
                    </thead>
                    <tbody>
                        <tr><td>🏆 Отличные</td><td>${props.great_parks_count || 0}</td><td>${Math.round(props.great_parks_area || 0).toLocaleString()} м²</td></tr>
                        <tr><td>✅ Хорошие</td><td>${props.good_parks_count || 0}</td><td>${Math.round(props.good_parks_area || 0).toLocaleString()} м²</td></tr>
                        <tr><td>🌿 Обычные</td><td>${props.ok_parks_count || 0}</td><td>${Math.round(props.ok_parks_area || 0).toLocaleString()} м²</td></tr>
                    </tbody>
                </table>
            </div>
            
            <div class="info-additional">
                <div><i class="fas fa-chart-line"></i> Плотность зелени: ${(props.population_density_per_green_zone || 0).toFixed(2)} чел/га</div>
                <div><i class="fas fa-leaf"></i> Покрытие парками: ${((((props.great_parks_area || 0) + (props.good_parks_area || 0) + (props.ok_parks_area || 0)) / (props.area || 1)) * 100).toFixed(1)}%</div>
            </div>
        </div>
    `;
    
    panel.scrollTop = 0;
}

function showLoading() {
    const spinner = document.getElementById('loading');
    if (spinner) {
        spinner.style.display = 'flex';
    }
}

function hideLoading() {
    const spinner = document.getElementById('loading');
    if (spinner) {
        spinner.style.display = 'none';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initMap();
    
    const toggleBtn = document.getElementById('toggle-quarters-btn');
    if (toggleBtn && !toggleBtn.hasAttribute('data-listener')) {
        toggleBtn.setAttribute('data-listener', 'true');
        toggleBtn.onclick = window.toggleQuarters;
    }
});
