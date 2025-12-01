// js/app.js
let map;
let quartersLayer = null;
let allQuarters = [];

// Функция для получения цвета по NDVI
function getColorByNDVI(ndvi) {
    const value = parseFloat(ndvi);
    if (value > 0.6) return '#238823';
    if (value > 0.4) return '#7bc242';
    if (value > 0.3) return '#d6ce1f';
    if (value > 0.2) return '#ff8c00';
    return '#d2222d';
}

// Функция для получения текста качества
function getQualityText(ndvi) {
    const value = parseFloat(ndvi);
    if (value > 0.6) return 'Отличное';
    if (value > 0.4) return 'Хорошее';
    if (value > 0.3) return 'Удовлетворительное';
    if (value > 0.2) return 'Плохое';
    return 'Очень плохое';
}

// Показать/скрыть загрузку
function showLoading(show) {
    const loading = document.getElementById('loading');
    loading.style.display = show ? 'block' : 'none';
}

// Обновить статистику
function updateStats() {
    const quartersCount = allQuarters.length;
    const totalPopulation = allQuarters.reduce((sum, q) => sum + (q.properties.population || 0), 0);
    const totalArea = allQuarters.reduce((sum, q) => sum + (q.properties.area || 0), 0);
    
    document.getElementById('quarters-count').textContent = quartersCount;
    document.getElementById('total-objects').textContent = totalPopulation.toLocaleString();
    
    // Можно добавить дополнительные статистики
    if (document.getElementById('total-area')) {
        document.getElementById('total-area').textContent = Math.round(totalArea).toLocaleString();
    }
}

// Парсинг CSV данных
function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    
    if (lines.length === 0) {
        console.warn('CSV файл пустой');
        return [];
    }
    
    const headers = lines[0].split(',').map(header => header.trim());
    console.log('Заголовки CSV:', headers);
    
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.trim() === '') continue;
        
        // Более надежный парсинг CSV с учетом кавычек и запятых в координатах
        const values = [];
        let current = '';
        let inQuotes = false;
        
        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                values.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        values.push(current.trim());
        
        const row = {};
        headers.forEach((header, index) => {
            // Убираем кавычки из значений
            let value = values[index] || '';
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.substring(1, value.length - 1);
            }
            row[header] = value;
        });
        
        // Проверяем, что есть необходимые данные
        if (row.id || row.Coordinates || (row.Lat && row.Lon)) {
            data.push(row);
        }
    }
    
    console.log('Парсинг CSV завершен, строк:', data.length);
    return data;
}

// Парсинг координат из строки формата "[(lat1, lon1), (lat2, lon2), ...]"
function parseCoordinates(coordsString) {
    if (!coordsString || coordsString.trim() === '') {
        console.log('Пустая строка координат');
        return [];
    }
    
    console.log('Парсим координаты:', coordsString.substring(0, 100) + '...');
    
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
        
        // Теперь обрабатываем формат "(lat, lon), (lat, lon), ..."
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
        } else {
            // Альтернативный метод: ищем все числа
            console.log('Прямой парсинг не сработал, пробуем найти числа');
            const numberMatches = cleanString.match(/[-+]?\d*\.\d+/g);
            if (numberMatches) {
                for (let i = 0; i < numberMatches.length; i += 2) {
                    if (i + 1 < numberMatches.length) {
                        const lat = parseFloat(numberMatches[i]);
                        const lon = parseFloat(numberMatches[i + 1]);
                        if (!isNaN(lat) && !isNaN(lon)) {
                            coordinates.push([lon, lat]);
                        }
                    }
                }
            }
        }
        
        console.log('Распарсено координат:', coordinates.length);
        if (coordinates.length > 0) {
            console.log('Первые координаты:', coordinates[0]);
        }
        
        return coordinates;
        
    } catch (error) {
        console.error('Ошибка парсинга координат:', error);
        console.error('Проблемная строка:', coordsString.substring(0, 200));
        return [];
    }
}

// Создание GeoJSON из CSV данных
function createGeoJSONFromCSV(csvData) {
    const features = [];
    let successCount = 0;
    let errorCount = 0;
    
    csvData.forEach((row, index) => {
        console.log(`\n=== Обрабатываем строку ${index + 1} ===`);
        console.log('ID:', row.id);
        console.log('Население:', row.population);
        console.log('Площадь:', row.area_m2);
        
        // Определяем строку с координатами
        const coordsString = row.Coordinates || '';
        
        // Парсим координаты
        const coordinates = parseCoordinates(coordsString);
        console.log('Количество точек:', coordinates.length);
        
        if (coordinates.length >= 3) {
            // Замыкаем полигон (первая и последняя точка должны совпадать)
            if (coordinates.length > 1 && 
                (coordinates[0][0] !== coordinates[coordinates.length-1][0] || 
                 coordinates[0][1] !== coordinates[coordinates.length-1][1])) {
                coordinates.push([...coordinates[0]]);
                console.log('Добавлена замыкающая точка');
            }
            
            // Собираем свойства
            const properties = {
                id: row.id || `feature-${index}`,
                name: `Квартал ${row.id || index}`,
                population: parseInt(row.population) || 0,
                area: parseFloat(row.area_m2) || 0,
                lat: parseFloat(row.Lat) || 0,
                lon: parseFloat(row.Lon) || 0,
                // Поля для совместимости с существующим кодом
                ndvi: 0.4 + Math.random() * 0.3, // Генерация случайного NDVI
                great_parks_count: 0,
                great_parks_area: 0,
                great_parks_ndvi: 0,
                good_parks_count: 0,
                good_parks_area: 0,
                good_parks_ndvi: 0,
                ok_parks_count: 0,
                ok_parks_area: 0,
                ok_parks_ndvi: 0
            };
            
            const feature = {
                type: 'Feature',
                properties: properties,
                geometry: {
                    type: 'Polygon',
                    coordinates: [coordinates]
                }
            };
            
            features.push(feature);
            successCount++;
            console.log(`✅ Успешно создан объект для ${row.id}`);
        } else {
            errorCount++;
            console.log(`❌ Недостаточно координат для ${row.id}: ${coordinates.length}`);
            
            // Если есть Lat/Lon, создаем маркер вместо полигона
            if (row.Lat && row.Lon) {
                const lat = parseFloat(row.Lat);
                const lon = parseFloat(row.Lon);
                
                if (!isNaN(lat) && !isNaN(lon)) {
                    const properties = {
                        id: row.id || `marker-${index}`,
                        name: `Точка ${row.id || index}`,
                        population: parseInt(row.population) || 0,
                        area: parseFloat(row.area_m2) || 0,
                        ndvi: 0.4 + Math.random() * 0.3,
                        is_point: true
                    };
                    
                    const feature = {
                        type: 'Feature',
                        properties: properties,
                        geometry: {
                            type: 'Point',
                            coordinates: [lon, lat]
                        }
                    };
                    
                    features.push(feature);
                    successCount++;
                    console.log(`✅ Создан маркер вместо полигона для ${row.id}`);
                }
            }
        }
    });
    
    console.log(`\n=== ИТОГИ ===`);
    console.log(`Успешно: ${successCount} объектов`);
    console.log(`Ошибки: ${errorCount} объектов`);
    console.log(`Всего строк в CSV: ${csvData.length}`);
    
    return {
        type: 'FeatureCollection',
        features: features
    };
}

// Загрузка данных из CSV
async function loadCSVData() {
    showLoading(true);
    console.log('=== НАЧАЛО ЗАГРУЗКИ CSV ===');
    
    try {
        // Пытаемся найти CSV файл
        const possiblePaths = [
            'data/Resid_Dataset_with_area_population.csv',
            './data/Resid_Dataset_with_area_population.csv',
            'Resid_Dataset_with_area_population.csv',
            './Resid_Dataset_with_area_population.csv',
            'data/Resid_Dataset_with_area_population.csv',
            '../data/Resid_Dataset_with_area_population.csv'
        ];
        
        let response;
        let usedPath = '';
        
        for (const path of possiblePaths) {
            try {
                console.log(`Пробуем загрузить: ${path}`);
                response = await fetch(path);
                if (response.ok) {
                    usedPath = path;
                    console.log(`✓ Файл найден: ${path}`);
                    break;
                } else {
                    console.log(`✗ Файл не найден: ${path}`);
                }
            } catch (error) {
                console.log(`Ошибка при загрузке ${path}:`, error);
            }
        }
        
        if (!response || !response.ok) {
            throw new Error(`CSV файл не найден. Проверили пути: ${possiblePaths.join(', ')}`);
        }
        
        console.log('CSV файл найден по пути:', usedPath);
        
        const csvText = await response.text();
        console.log('CSV загружен, размер:', csvText.length, 'символов');
        console.log('Первые 500 символов:', csvText.substring(0, 500));
        
        // Парсим CSV
        const csvData = parseCSV(csvText);
        
        if (csvData.length === 0) {
            throw new Error('CSV файл не содержит данных или неверный формат');
        }
        
        console.log('Первая строка данных:', csvData[0]);
        console.log('Все колонки в CSV:', Object.keys(csvData[0]));
        
        // Создаем GeoJSON
        const geoJsonData = createGeoJSONFromCSV(csvData);
        console.log('GeoJSON создан, объектов:', geoJsonData.features.length);
        
        if (geoJsonData.features.length > 0) {
            console.log('Первый объект GeoJSON:', geoJsonData.features[0]);
            console.log('Координаты первого объекта:', geoJsonData.features[0].geometry.coordinates);
        }
        
        allQuarters = geoJsonData.features;
        
        renderQuarters();
        updateStats();
        
    } catch (error) {
        console.error('Ошибка загрузки CSV:', error);
        alert('Ошибка загрузки данных: ' + error.message + '\nПроверьте консоль для подробностей.');
    } finally {
        showLoading(false);
    }
}

// Отрисовка кварталов на карте
function renderQuarters() {
    console.log('Начинаем отрисовку объектов...');
    
    // Удаляем старый слой
    if (quartersLayer) {
        map.removeLayer(quartersLayer);
        quartersLayer = null;
    }
    
    if (allQuarters.length === 0) {
        console.log('Нет данных для отрисовки');
        alert('Нет данных для отрисовки. Проверьте файл данных.');
        return;
    }
    
    // Разделяем объекты на полигоны и точки
    const polygons = allQuarters.filter(f => f.geometry.type === 'Polygon');
    const points = allQuarters.filter(f => f.geometry.type === 'Point');
    
    console.log(`Полигонов: ${polygons.length}, Точек: ${points.length}`);
    
    // Создаем слой для полигонов
    if (polygons.length > 0) {
        quartersLayer = L.geoJSON(polygons, {
            style: function(feature) {
                const props = feature.properties;
                return {
                    fillColor: getColorByNDVI(props.ndvi || 0.3),
                    fillOpacity: 0.6,
                    color: getColorByNDVI(props.ndvi || 0.3),
                    weight: 2,
                    opacity: 0.8
                };
            },
            onEachFeature: function(feature, layer) {
                addPopupToFeature(feature, layer);
            }
        }).addTo(map);
    }
    
    // Создаем слой для точек (маркеров)
    if (points.length > 0) {
        const markersLayer = L.geoJSON(points, {
            pointToLayer: function(feature, latlng) {
                return L.circleMarker(latlng, {
                    radius: 8,
                    fillColor: getColorByNDVI(feature.properties.ndvi || 0.3),
                    fillOpacity: 0.7,
                    color: '#333',
                    weight: 1,
                    opacity: 1
                });
            },
            onEachFeature: function(feature, layer) {
                addPopupToFeature(feature, layer);
            }
        }).addTo(map);
        
        // Объединяем слои
        if (!quartersLayer) {
            quartersLayer = markersLayer;
        }
    }
    
    // Автоматически подстраиваем границы карты под загруженные данные
    if (allQuarters.length > 0 && quartersLayer) {
        map.fitBounds(quartersLayer.getBounds(), { 
            padding: [50, 50],
            maxZoom: 15
        });
        console.log('Границы карты обновлены');
    }
    
    console.log('Отрисовка завершена:', allQuarters.length, 'объектов');
}

// Добавление попапа к объекту
function addPopupToFeature(feature, layer) {
    const props = feature.properties;
    const isPoint = props.is_point || feature.geometry.type === 'Point';
    
    const popupContent = `
        <div class="popup-header">
            <h3 class="popup-title">${props.name}</h3>
            <p class="popup-subtitle">ID: ${props.id} | Тип: ${isPoint ? 'Точка' : 'Полигон'}</p>
        </div>
        
        <div class="stats-grid">
            <div class="stat-card">
                <span class="stat-number">${props.population ? props.population.toLocaleString() : 0}</span>
                <span class="stat-label-popup">Население</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${props.area ? Math.round(props.area).toLocaleString() : 0}</span>
                <span class="stat-label-popup">Площадь (м²)</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${props.ndvi ? props.ndvi.toFixed(3) : '0.000'}</span>
                <span class="stat-label-popup">NDVI индекс</span>
            </div>
        </div>
        
        <div class="indicators">
            <div class="indicator">
                <span class="indicator-name">Качество озеленения:</span>
                <span class="indicator-badge" style="background-color: ${getColorByNDVI(props.ndvi || 0.3)}">
                    ${getQualityText(props.ndvi || 0.3)}
                </span>
            </div>
        </div>
        
        ${props.lat && props.lon ? `
        <div style="margin-top: 10px; font-size: 11px; color: #666;">
            <div>Координаты центра: ${props.lat.toFixed(6)}, ${props.lon.toFixed(6)}</div>
        </div>
        ` : ''}
    `;
    
    layer.bindPopup(popupContent);
    
    // Добавляем обработчики событий для hover эффекта (только для полигонов)
    if (!isPoint) {
        layer.on('mouseover', function(e) {
            this.setStyle({
                fillOpacity: 0.8,
                weight: 3
            });
        });
        
        layer.on('mouseout', function(e) {
            this.setStyle({
                fillOpacity: 0.6,
                weight: 2
            });
        });
    }
}

// Очистка карты
function clearMap() {
    if (quartersLayer) {
        map.removeLayer(quartersLayer);
        quartersLayer = null;
    }
    allQuarters = [];
    updateStats();
    console.log('Карта очищена');
    
    // Возвращаем карту к виду по умолчанию
    map.setView([56.838, 60.605], 12);
}

// Показать статистику
function showStatistics() {
    if (allQuarters.length === 0) {
        alert('Сначала загрузите данные');
        return;
    }
    
    const totalPopulation = allQuarters.reduce((sum, q) => sum + (q.properties.population || 0), 0);
    const avgNDVI = (allQuarters.reduce((sum, q) => sum + (q.properties.ndvi || 0), 0) / allQuarters.length).toFixed(3);
    const maxNDVI = Math.max(...allQuarters.map(q => q.properties.ndvi || 0)).toFixed(3);
    const minNDVI = Math.min(...allQuarters.map(q => q.properties.ndvi || 0)).toFixed(3);
    const totalArea = allQuarters.reduce((sum, q) => sum + (q.properties.area || 0), 0).toFixed(0);
    
    // Статистика по типам объектов
    const polygonsCount = allQuarters.filter(q => q.geometry.type === 'Polygon').length;
    const pointsCount = allQuarters.filter(q => q.geometry.type === 'Point').length;
    
    // Находим кварталы с наибольшим населением
    const sortedByPopulation = [...allQuarters].sort((a, b) => (b.properties.population || 0) - (a.properties.population || 0));
    const top5Population = sortedByPopulation.slice(0, 5).map(q => ({
        name: q.properties.name,
        population: q.properties.population || 0
    }));
    
    // Создаем красивое модальное окно
    const statsHTML = `
        <div style="padding: 20px; max-width: 500px; max-height: 500px; overflow-y: auto;">
            <h3 style="color: #2c7744; margin-bottom: 20px; text-align: center;">📊 Статистика по данным</h3>
            <div style="display: grid; gap: 12px;">
                <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                    <span style="font-weight: 500;">Всего объектов:</span>
                    <span style="font-weight: 700; color: #2c7744;">${allQuarters.length}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                    <span style="font-weight: 500;">Полигоны / Точки:</span>
                    <span style="font-weight: 700; color: #2c7744;">${polygonsCount} / ${pointsCount}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                    <span style="font-weight: 500;">Общее население:</span>
                    <span style="font-weight: 700; color: #2c7744;">${totalPopulation.toLocaleString()} чел.</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                    <span style="font-weight: 500;">Общая площадь:</span>
                    <span style="font-weight: 700; color: #2c7744;">${totalArea.toLocaleString()} м²</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                    <span style="font-weight: 500;">Средний NDVI:</span>
                    <span style="font-weight: 700; color: #2c7744;">${avgNDVI}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                    <span style="font-weight: 500;">Макс. NDVI:</span>
                    <span style="font-weight: 700; color: #2c7744;">${maxNDVI}</span>
                </div>
                <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                    <span style="font-weight: 500;">Мин. NDVI:</span>
                    <span style="font-weight: 700; color: #2c7744;">${minNDVI}</span>
                </div>
                
                ${top5Population.length > 0 ? `
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px;">
                    <div style="font-weight: 500; margin-bottom: 8px;">Топ-5 по населению:</div>
                    <div style="font-size: 12px;">
                        ${top5Population.map((item, index) => `
                            <div style="display: flex; justify-content: space-between; padding: 3px 0; border-bottom: 1px solid #eee;">
                                <span>${index + 1}. ${item.name}</span>
                                <span style="font-weight: 600;">${item.population.toLocaleString()}</span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    // Создаем кастомное модальное окно
    const modal = L.popup()
        .setLatLng(map.getCenter())
        .setContent(statsHTML)
        .openOn(map);
}

// Инициализация карты
function initMap() {
    map = L.map('map').setView([56.838, 60.605], 12);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 18
    }).addTo(map);
    
    console.log('Карта инициализирована');
    
    // Автоматически загружаем данные при запуске
    setTimeout(() => {
        loadCSVData();
    }, 1000);
}

// Обработчик изменения размера окна
function handleResize() {
    if (map) {
        setTimeout(() => {
            map.invalidateSize();
        }, 250);
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, инициализируем карту...');
    initMap();
    
    // Добавляем обработчик изменения размера окна
    window.addEventListener('resize', handleResize);
});

// Добавляем глобальную функцию для отладки
window.debugData = function() {
    console.log('Все объекты:', allQuarters);
    console.log('Слой объектов:', quartersLayer);
    console.log('Текущие границы карты:', map.getBounds());
    
    if (allQuarters.length > 0) {
        console.log('Статистика:');
        console.log('- Всего объектов:', allQuarters.length);
        console.log('- Общее население:', allQuarters.reduce((sum, q) => sum + (q.properties.population || 0), 0));
        console.log('- Общая площадь:', allQuarters.reduce((sum, q) => sum + (q.properties.area || 0), 0));
    }
};

// Тест парсинга координат
window.testParseCoordinates = function() {
    const testString = '[(56.9095127, 60.6013431), (56.9094715, 60.6012413), (56.9090569, 60.601831), (56.9090906, 60.601925)]';
    console.log('Тест парсинга координат:', testString);
    const result = parseCoordinates(testString);
    console.log('Результат:', result);
    return result;
};