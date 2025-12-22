let map;
let quartersLayer = null;
let allQuarters = [];
let currentCity = 'ekaterinburg';
let isQuartersVisible = false;

// Данные о городах
const cityData = {
    'moscow': {
        name: 'Москва',
        center: [55.7558, 37.6173],
        zoom: 11,
        dataFile: 'data/moscow_data.geojson'
    },
    'ekaterinburg': {
        name: 'Екатеринбург',
        center: [56.838, 60.605],
        zoom: 12,
        dataFile: 'data/ekaterinburg_data.geojson'
    },
    'peter': {
        name: 'Санкт-Петербург',
        center: [59.9343, 30.3351],
        zoom: 11,
        dataFile: 'data/peter_data.geojson'
    }
};

// Функция для получения цвета по quality (0-3)
function getColorByQuality(quality) {
    const value = parseInt(quality);
    switch(value) { 
        case 1: return '#7fd968ff';
        case 2: return '#35b444ff';
        case 3: return '#096f0eff'
        default: return '#cccccc';
    }
}

// Функция для получения текста качества
function getQualityText(quality) {
    const value = parseInt(quality);
    switch(value) {
        case 1: return 'Плохое';
        case 2: return 'Нормальное';
        case 3: return 'Хорошее';
        default: return 'Неизвестно';
    }
}

// Парсинг координат из строки формата "[(lat1, lon1), (lat2, lon2), ...]"
function parseCoordinates(coordsString) {
    if (!coordsString || coordsString.trim() === '' || coordsString === 'null') {
        console.log('Пустая строка координат');
        return [];
    }
    
    try {
        // Очищаем строку от лишних символов
        let cleanString = coordsString.trim();
        
        // Убираем внешние квадратные скобки и кавычки
        if (cleanString.startsWith('[') && cleanString.endsWith(']')) {
            cleanString = cleanString.substring(1, cleanString.length - 1);
        }
        if (cleanString.startsWith('"') && cleanString.endsWith('"')) {
            cleanString = cleanString.substring(1, cleanString.length - 1);
        }
        
        const coordinates = [];
        
        // Разбиваем на пары координат
        const pairRegex = /\(([^)]+)\)/g;
        const matches = cleanString.match(pairRegex);
        
        if (matches) {
            for (const match of matches) {
                // Убираем скобки
                const pair = match.substring(1, match.length - 1);
                const parts = pair.split(',').map(p => p.trim());
                
                if (parts.length >= 2) {
                    const lat = parseFloat(parts[0]);
                    const lon = parseFloat(parts[1]);
                    
                    if (!isNaN(lat) && !isNaN(lon)) {
                        // GeoJSON использует порядок [долгота, широта]
                        coordinates.push([lon, lat]);
                    }
                }
            }
        }
        
        return coordinates;
        
    } catch (error) {
        console.error('Проблемная строка:', coordsString.substring(0, 200));
        return [];
    }
}

// Показать/скрыть загрузку
function showLoading(show) {
    const loading = document.getElementById('loading');
    loading.style.display = show ? 'flex' : 'none';
}

// Обновить статистику
function updateStats() {
    document.getElementById('quarters-count').textContent = allQuarters.length;
}

// Переключение города
function switchCity(city) {
    // Обновляем активную кнопку
    document.querySelectorAll('.city-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    document.querySelector(`button[onclick="switchCity('${city}')"]`).classList.add('active');
    
    // Устанавливаем новый город
    currentCity = city;
    const cityInfo = cityData[city];
    
    // Меняем центр карты
    if (map) {
        map.setView(cityInfo.center, cityInfo.zoom);
    }
    
    // Удаляем старый слой (а не прячем)
    clearMap();
    
    // Загружаем данные для нового города
    loadCityData();
    
    console.log(`Переключен на город: ${cityInfo.name}`);
}

// Загрузка данных для текущего города
async function loadCityData() {
    showLoading(true);
    console.log(`=== ЗАГРУЗКА ДАННЫХ ДЛЯ ${cityData[currentCity].name} ===`);
    
    try {
        const cityInfo = cityData[currentCity];
        const dataFile = cityInfo.dataFile;
        
        console.log(`Пытаемся загрузить: ${dataFile}`);
        const response = await fetch(dataFile);
        
        if (!response.ok) {
            throw new Error(`Файл данных не найден: ${dataFile}`);
        }
        
        const geoJsonData = await response.json();
        console.log('GeoJSON загружен, тип:', geoJsonData.type);
        console.log('Количество объектов в файле:', geoJsonData.features ? geoJsonData.features.length : 0);
        
        if (geoJsonData.features && geoJsonData.features.length > 0) {
            console.log('Первый объект GeoJSON:', geoJsonData.features[0]);
            
            // Обрабатываем данные
            processGeoJSONData(geoJsonData);
        } else {
            throw new Error('GeoJSON файл не содержит объектов (features)');
        }
        
        renderQuarters();
        updateStats();
        
        // Показываем кварталы после загрузки
        isQuartersVisible = true;
        updateToggleButton();
        
    } catch (error) {
        console.error('Ошибка загрузки данных:', error);
        alert(`Ошибка загрузки данных для ${cityData[currentCity].name}: ${error.message}`);
    } finally {
        showLoading(false);
    }
}

// Обработка данных GeoJSON
function processGeoJSONData(geoJsonData) {
    allQuarters = [];
    
    if (!geoJsonData.features) {
        console.error('GeoJSON не содержит features');
        return;
    }
    
    let validFeatures = 0;
    let invalidFeatures = 0;
    
    geoJsonData.features.forEach((feature, index) => {
        // Проверяем наличие координат в свойствах
        const properties = feature.properties || {};
        const coordsString = properties.coordinates;
        
        // Если нет строки с координатами, пропускаем
        if (!coordsString || coordsString.trim() === '' || coordsString === 'null') {
            console.warn(`Объект ${index} пропущен: отсутствуют координаты`);
            invalidFeatures++;
            return;
        }
        
        // Парсим координаты из строки
        const coordinates = parseCoordinates(coordsString);
        
        if (coordinates.length < 3) {
            console.warn(`Объект ${index} пропущен: недостаточно координат (${coordinates.length})`);
            invalidFeatures++;
            return;
        }
        
        // Замыкаем полигон (первая и последняя точка должны совпадать)
        const polygonCoords = [...coordinates];
        if (polygonCoords.length > 1 && 
            (polygonCoords[0][0] !== polygonCoords[polygonCoords.length-1][0] || 
             polygonCoords[0][1] !== polygonCoords[polygonCoords.length-1][1])) {
            polygonCoords.push([...polygonCoords[0]]);
        }
        
        // Создаем обогащенный объект
        const enrichedFeature = {
            type: 'Feature',
            properties: {
                id: properties.id || properties.quarter_id || `feature-${index}`,
                name: properties.name || `Квартал ${index + 1}`,
                area: parseFloat(properties.area || properties.area_m2 || 0),
                population: parseInt(properties.population || 0),
                general_ndvi: parseFloat(properties.general_ndvi || 0),
                quality: parseInt(properties.quality || 0),
                great_parks_count: parseInt(properties.great_parks_count || 0),
                great_parks_area: parseFloat(properties.great_parks_area || 0),
                great_parks_ndvi: parseFloat(properties.great_parks_ndvi || 0),
                good_parks_count: parseInt(properties.good_parks_count || 0),
                good_parks_area: parseFloat(properties.good_parks_area || 0),
                good_parks_ndvi: parseFloat(properties.good_parks_ndvi || 0),
                ok_parks_count: parseInt(properties.ok_parks_count || 0),
                ok_parks_area: parseFloat(properties.ok_parks_area || 0),
                ok_parks_ndvi: parseFloat(properties.ok_parks_ndvi || 0),
                population_density_per_green_zone: parseFloat(properties.population_density_per_green_zone || 0),
                general_area: parseFloat(properties.general_area || 0)
            },
            geometry: {
                type: 'Polygon',
                coordinates: [polygonCoords]
            }
        };
        
        allQuarters.push(enrichedFeature);
        validFeatures++;
    });
    
    console.log(`Обработано объектов: ${validFeatures} валидных, ${invalidFeatures} пропущено`);
}

// Отрисовка кварталов на карте
function renderQuarters() {
    console.log('Начинаем отрисовку кварталов...');
    
    // Удаляем старый слой
    if (quartersLayer) {
        map.removeLayer(quartersLayer);
        quartersLayer = null;
    }
    
    if (allQuarters.length === 0) {
        console.log('Нет данных для отрисовки');
        alert('Нет объектов с координатами для отображения на карте.');
        return;
    }
    
    // Создаем GeoJSON слой с кастомным стилем
    quartersLayer = L.geoJSON(allQuarters, {
        style: function(feature) {
            const props = feature.properties;
            const quality = props.quality || 0;
            
            return {
                fillColor: getColorByQuality(quality),
                fillOpacity: 0.7,
                color: getColorByQuality(quality),
                weight: 2,
                opacity: 0.9
            };
        },
        onEachFeature: function(feature, layer) {
            // Добавляем попап для каждого объекта
            const props = feature.properties;
            const quality = props.quality || 0;
            
            // Собираем информацию о парках в таблицу
            let parksInfo = '';
            if (props.great_parks_count > 0 || props.good_parks_count > 0 || props.ok_parks_count > 0) {
                parksInfo = `
                <div class="parks-info">
                    <h4>Статистика парков:</h4>
                    <table class="parks-table">
                        <thead>
                            <tr>
                                <th>Качество</th>
                                <th>Кол-во</th>
                                <th>Площадь (м²)</th>
                                <th>NDVI</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${props.great_parks_count > 0 ? 
                                `<tr>
                                    <td>✅ Отличные</td>
                                    <td>${props.great_parks_count}</td>
                                    <td>${Math.round(props.great_parks_area)}</td>
                                    <td>${props.great_parks_ndvi ? props.great_parks_ndvi.toFixed(3) : '0.000'}</td>
                                </tr>` : ''}
                            ${props.good_parks_count > 0 ? 
                                `<tr>
                                    <td>👍 Хорошие</td>
                                    <td>${props.good_parks_count}</td>
                                    <td>${Math.round(props.good_parks_area)}</td>
                                    <td>${props.good_parks_ndvi ? props.good_parks_ndvi.toFixed(3) : '0.000'}</td>
                                </tr>` : ''}
                            ${props.ok_parks_count > 0 ? 
                                `<tr>
                                    <td>⚠️ Удовлетв.</td>
                                    <td>${props.ok_parks_count}</td>
                                    <td>${Math.round(props.ok_parks_area)}</td>
                                    <td>${props.ok_parks_ndvi ? props.ok_parks_ndvi.toFixed(3) : '0.000'}</td>
                                </tr>` : ''}
                        </tbody>
                    </table>
                </div>`;
            }
            
            const popupContent = `
                <div class="popup-header">
                    <h3 class="popup-title">${props.name}</h3>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-card-popup">
                        <div class="stat-number-popup">${props.area ? Math.round(props.area).toLocaleString() : '0'}</div>
                        <div class="stat-label-popup">Площадь (м²)</div>
                    </div>
                    <div class="stat-card-popup">
                        <div class="stat-number-popup">${props.population ? props.population.toLocaleString() : '0'}</div>
                        <div class="stat-label-popup">Население</div>
                    </div>
                    <div class="stat-card-popup">
                        <div class="stat-number-popup">${props.general_ndvi ? props.general_ndvi.toFixed(3) : '0.000'}</div>
                        <div class="stat-label-popup">Средний NDVI парков</div>
                    </div>
                </div>
                
                <div class="quality-indicator">
                    <div class="quality-label">Качество района:</div>
                    <div class="quality-badge" style="background-color: ${getColorByQuality(quality)}">
                        ${getQualityText(quality)}
                    </div>
                </div>
                
                ${props.population_density_per_green_zone ? `
                <div class="additional-info">
                    <div><strong>Жителей на гектар зелёной зоны:</strong> ${Math.round(props.population_density_per_green_zone)}</div> 
                </div>
                ` : ''}
                
                ${parksInfo}
            `;
            
            layer.bindPopup(popupContent);
            
            // Добавляем обработчики событий для hover эффекта
            layer.on('mouseover', function(e) {
                this.setStyle({
                    fillOpacity: 0.9,
                    weight: 3,
                    color: '#333'
                });
            });
            
            layer.on('mouseout', function(e) {
                this.setStyle({
                    fillOpacity: 0.7,
                    weight: 2,
                    color: getColorByQuality(quality)
                });
            });
        }
    });
    
    quartersLayer.addTo(map);
    
    // Сохраняем текущий зум и центр
    const currentZoom = map.getZoom();
    const currentCenter = map.getCenter();
    
    // Автоматически подстраиваем границы карты под загруженные данные
    if (allQuarters.length > 0 && quartersLayer.getBounds().isValid()) {
        const bounds = quartersLayer.getBounds();
        map.fitBounds(bounds, { 
            padding: [50, 50],
            maxZoom: 15
        });
        console.log('Границы карты обновлены');
    } else {
        console.warn('Невозможно обновить границы: нет валидных объектов или геометрии');
    }
    
    // Если зум был больше, чем после подстройки, восстанавливаем
    if (currentZoom > map.getZoom()) {
        map.setView(currentCenter, currentZoom);
    }
    
    console.log('Отрисовка завершена:', allQuarters.length, 'кварталов');
}

// Показать/скрыть кварталы
function toggleQuarters() {
    if (!quartersLayer) {
        alert('Сначала загрузите данные для города');
        return;
    }
    
    isQuartersVisible = !isQuartersVisible;
    
    if (isQuartersVisible) {
        map.addLayer(quartersLayer);
    } else {
        map.removeLayer(quartersLayer);
    }
    
    updateToggleButton();
}

// Обновить текст кнопки показа/скрытия
function updateToggleButton() {
    const toggleBtn = document.getElementById('toggle-quarters-btn');
    const icon = toggleBtn.querySelector('i');
    
    if (isQuartersVisible) {
        toggleBtn.innerHTML = '<i class="fas fa-eye-slash"></i> Скрыть кварталы';
    } else {
        toggleBtn.innerHTML = '<i class="fas fa-eye"></i> Показать кварталы';
    }
}

// Очистка карты (удаление слоя)
function clearMap() {
    if (quartersLayer) {
        map.removeLayer(quartersLayer);
        quartersLayer = null;
    }
    allQuarters = [];
    isQuartersVisible = false;
    updateStats();
    updateToggleButton();
    console.log('Карта очищена');
}

// Показать методологию
function showMethodology() {
    alert(`Оценка жилых кварталов была получена с помощью ИИ-модели, обученной на данных взятых с OpenStreetMap (https://www.openstreetmap.org/). Для обучения модели была произведена ручная разметка эмпирическим путём.`);
}

// Инициализация карты
function initMap() {
    const cityInfo = cityData[currentCity];
    
    map = L.map('map').setView(cityInfo.center, cityInfo.zoom);
    
    // Основной слой OpenStreetMap
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18
    }).addTo(map);
    
    console.log('Карта инициализирована для города:', cityInfo.name);
    
    // Загружаем данные для города по умолчанию
    loadCityData();
}

// Обработчик изменения размера окна
function handleResize() {
    if (map) {
        setTimeout(() => {
            map.invalidateSize();
        }, 100);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, инициализируем карту...');
    initMap();
    
    // Добавляем обработчик изменения размера окна
    window.addEventListener('resize', handleResize);
});