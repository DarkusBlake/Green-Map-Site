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
    document.getElementById('quarters-count').textContent = allQuarters.length;
    document.getElementById('total-objects').textContent = allQuarters.reduce((sum, q) => sum + (q.properties.population || 0), 0);
}

// Парсинг CSV данных
function parseCSV(csvText) {
    const lines = csvText.split('\n').filter(line => line.trim() !== '');
    const headers = lines[0].split(',').map(header => header.trim());
    
    const data = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        // Более надежный парсинг CSV с учетом кавычек
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
            row[header] = values[index] || '';
        });
        data.push(row);
    }
    
    return data;
}

// Парсинг координат из строки - УПРОЩЕННАЯ ВЕРСИЯ
function parseCoordinates(coordsString) {
    console.log('Парсим координаты:', coordsString);
    
    try {
        // Убираем все скобки и кавычки
        const cleanString = coordsString.replace(/[\[\]()"]/g, '');
        console.log('Очищенная строка:', cleanString);
        
        // Разбиваем на пары координат
        const pairs = cleanString.split(',');
        console.log('Пары:', pairs);
        
        const coordinates = [];
        for (let i = 0; i < pairs.length; i += 2) {
            if (i + 1 < pairs.length) {
                const lat = parseFloat(pairs[i].trim());
                const lon = parseFloat(pairs[i + 1].trim());
                
                if (!isNaN(lat) && !isNaN(lon)) {
                    // GeoJSON использует порядок [долгота, широта]
                    coordinates.push([lon, lat]);
                }
            }
        }
        
        console.log('Распарсенные координаты:', coordinates);
        return coordinates;
        
    } catch (error) {
        console.error('Ошибка парсинга координат:', error, coordsString);
        return [];
    }
}

// Альтернативный парсинг координат
function parseCoordinatesAlternative(coordsString) {
    try {
        // Пытаемся найти все числа в строке
        const numberMatches = coordsString.match(/[-+]?[0-9]*\.?[0-9]+/g);
        if (!numberMatches) return [];
        
        const coordinates = [];
        for (let i = 0; i < numberMatches.length; i += 2) {
            if (i + 1 < numberMatches.length) {
                const lat = parseFloat(numberMatches[i]);
                const lon = parseFloat(numberMatches[i + 1]);
                coordinates.push([lon, lat]);
            }
        }
        return coordinates;
    } catch (error) {
        console.error('Ошибка альтернативного парсинга:', error);
        return [];
    }
}

// Создание GeoJSON из CSV данных
function createGeoJSONFromCSV(csvData) {
    const features = [];
    let successCount = 0;
    
    csvData.forEach((row, index) => {
        console.log(`Обрабатываем строку ${index}:`, row.quarter_id);
        
        let coordinates = parseCoordinates(row.coordinates);
        
        // Если первый метод не сработал, пробуем альтернативный
        if (coordinates.length === 0) {
            console.log('Первый метод не сработал, пробуем альтернативный');
            coordinates = parseCoordinatesAlternative(row.coordinates);
        }
        
        console.log(`Координаты для ${row.quarter_id}:`, coordinates.length, 'точек');
        
        if (coordinates.length >= 3) {
            // Замыкаем полигон (первая и последняя точка должны совпадать)
            if (coordinates.length > 1 && 
                (coordinates[0][0] !== coordinates[coordinates.length-1][0] || 
                 coordinates[0][1] !== coordinates[coordinates.length-1][1])) {
                coordinates.push([...coordinates[0]]);
            }
            
            const feature = {
                type: 'Feature',
                properties: {
                    id: row.quarter_id || `feature-${index}`,
                    name: `Квартал ${row.quarter_id || index}`,
                    // Используем general_ndvi как средний NDVI для квартала
                    ndvi: parseFloat(row.general_ndvi) || 0,
                    population: parseInt(row.population) || 0,
                    area: parseFloat(row.area) || 0,
                    // Статистика по паркам
                    great_parks_count: parseInt(row.great_parks_count) || 0,
                    great_parks_area: parseFloat(row.great_parks_area) || 0,
                    great_parks_ndvi: parseFloat(row.great_parks_ndvi) || 0,
                    good_parks_count: parseInt(row.good_parks_count) || 0,
                    good_parks_area: parseFloat(row.good_parks_area) || 0,
                    good_parks_ndvi: parseFloat(row.good_parks_ndvi) || 0,
                    ok_parks_count: parseInt(row.ok_parks_count) || 0,
                    ok_parks_area: parseFloat(row.ok_parks_area) || 0,
                    ok_parks_ndvi: parseFloat(row.ok_parks_ndvi) || 0,
                    general_area: parseFloat(row.general_area) || 0
                },
                geometry: {
                    type: 'Polygon',
                    coordinates: [coordinates]
                }
            };
            
            features.push(feature);
            successCount++;
            console.log(`✅ Успешно создан объект для ${row.quarter_id}`);
        } else {
            console.log(`❌ Недостаточно координат для ${row.quarter_id}: ${coordinates.length}`);
        }
    });
    
    console.log(`Успешно создано объектов: ${successCount} из ${csvData.length}`);
    return {
        type: 'FeatureCollection',
        features: features
    };
}

// Загрузка данных из CSV
async function loadQuarterData() {
    showLoading(true);
    console.log('=== НАЧАЛО ЗАГРУЗКИ CSV ===');
    
    try {
        // Пытаемся найти CSV файл
        const possiblePaths = [
            'data/50-100_Dataset.csv',
            './data/50-100_Dataset.csv',
            '50-100_Dataset.csv',
            './50-100_Dataset.csv'
        ];
        
        let response;
        let usedPath = '';
        
        for (const path of possiblePaths) {
            try {
                console.log(`Пробуем загрузить: ${path}`);
                response = await fetch(path);
                if (response.ok) {
                    usedPath = path;
                    break;
                }
            } catch (error) {
                console.log(`Путь не сработал: ${path}`, error);
            }
        }
        
        if (!response || !response.ok) {
            throw new Error('CSV файл не найден. Проверьте путь к файлу.');
        }
        
        console.log('CSV файл найден по пути:', usedPath);
        
        const csvText = await response.text();
        console.log('CSV загружен, первые 500 символов:', csvText.substring(0, 500));
        
        // Парсим CSV
        const csvData = parseCSV(csvText);
        console.log('Парсинг CSV завершен, строк:', csvData.length);
        
        if (csvData.length > 0) {
            console.log('Первая строка данных:', csvData[0]);
            console.log('Координаты первой строки:', csvData[0].coordinates);
        }
        
        // Создаем GeoJSON
        const geoJsonData = createGeoJSONFromCSV(csvData);
        console.log('GeoJSON создан, объектов:', geoJsonData.features.length);
        
        allQuarters = geoJsonData.features;
        
        if (allQuarters.length > 0) {
            console.log('Первый объект GeoJSON:', allQuarters[0]);
        }
        
        renderQuarters();
        updateStats();
        
    } catch (error) {
        console.error('Ошибка загрузки CSV:', error);
        alert('Ошибка загрузки данных: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Отрисовка кварталов на карте
function renderQuarters() {
    console.log('Начинаем отрисовку кварталов...');
    
    // Удаляем старый слой
    if (quartersLayer) {
        map.removeLayer(quartersLayer);
    }
    
    if (allQuarters.length === 0) {
        console.log('Нет данных для отрисовки');
        return;
    }
    
    // Создаем GeoJSON слой с кастомным стилем
    quartersLayer = L.geoJSON(allQuarters, {
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
            // Добавляем попап для каждого объекта
            const props = feature.properties;
            const popupContent = `
                <div class="popup-header">
                    <h3 class="popup-title">${props.name}</h3>
                    <p class="popup-subtitle">ID: ${props.id} | Население: ${props.population || 0}</p>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <span class="stat-number">${props.ndvi ? props.ndvi.toFixed(3) : '0.000'}</span>
                        <span class="stat-label-popup">Средний NDVI</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-number">${props.population || 0}</span>
                        <span class="stat-label-popup">Население</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-number">${props.area ? Math.round(props.area) : 0}</span>
                        <span class="stat-label-popup">Площадь (м²)</span>
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
                
                ${props.great_parks_count > 0 || props.good_parks_count > 0 || props.ok_parks_count > 0 ? `
                <div style="margin-top: 10px;">
                    <div style="font-size: 12px; color: #666; margin-bottom: 5px;">Статистика парков:</div>
                    <div style="font-size: 11px; color: #888;">
                        ${props.great_parks_count > 0 ? `<div>✅ Отличные парки: ${props.great_parks_count} (${Math.round(props.great_parks_area)} м², NDVI: ${props.great_parks_ndvi.toFixed(3)})</div>` : ''}
                        ${props.good_parks_count > 0 ? `<div>👍 Хорошие парки: ${props.good_parks_count} (${Math.round(props.good_parks_area)} м², NDVI: ${props.good_parks_ndvi.toFixed(3)})</div>` : ''}
                        ${props.ok_parks_count > 0 ? `<div>⚠️ Удовлетворительные парки: ${props.ok_parks_count} (${Math.round(props.ok_parks_area)} м², NDVI: ${props.ok_parks_ndvi.toFixed(3)})</div>` : ''}
                    </div>
                </div>
                ` : ''}
            `;
            
            layer.bindPopup(popupContent);
            
            // Добавляем обработчики событий для hover эффекта
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
    });
    
    quartersLayer.addTo(map);
    
    // Автоматически подстраиваем границы карты под загруженные данные
    if (allQuarters.length > 0) {
        map.fitBounds(quartersLayer.getBounds(), { 
            padding: [20, 20],
            maxZoom: 16
        });
        console.log('Границы карты обновлены');
    }
    
    console.log('Отрисовка завершена:', allQuarters.length, 'кварталов');
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
        alert('Сначала загрузите данные кварталов');
        return;
    }
    
    const totalPopulation = allQuarters.reduce((sum, q) => sum + (q.properties.population || 0), 0);
    const avgNDVI = (allQuarters.reduce((sum, q) => sum + (q.properties.ndvi || 0), 0) / allQuarters.length).toFixed(3);
    const maxNDVI = Math.max(...allQuarters.map(q => q.properties.ndvi || 0)).toFixed(3);
    const minNDVI = Math.min(...allQuarters.map(q => q.properties.ndvi || 0)).toFixed(3);
    const totalArea = allQuarters.reduce((sum, q) => sum + (q.properties.area || 0), 0).toFixed(0);
    
    // Статистика по паркам
    const totalGreatParks = allQuarters.reduce((sum, q) => sum + (q.properties.great_parks_count || 0), 0);
    const totalGoodParks = allQuarters.reduce((sum, q) => sum + (q.properties.good_parks_count || 0), 0);
    const totalOkParks = allQuarters.reduce((sum, q) => sum + (q.properties.ok_parks_count || 0), 0);
    
    // Создаем красивое модальное окно
    const statsHTML = `
        <div style="padding: 20px; max-width: 450px;">
            <h3 style="color: #2c7744; margin-bottom: 20px; text-align: center;">📊 Статистика по кварталам</h3>
            <div style="display: grid; gap: 12px;">
                <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                    <span style="font-weight: 500;">Всего кварталов:</span>
                    <span style="font-weight: 700; color: #2c7744;">${allQuarters.length}</span>
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
                <div style="padding: 10px; background: #f8f9fa; border-radius: 8px;">
                    <div style="font-weight: 500; margin-bottom: 8px;">Парки по категориям:</div>
                    <div style="display: flex; justify-content: space-between; font-size: 13px;">
                        <span>✅ Отличные: ${totalGreatParks}</span>
                        <span>👍 Хорошие: ${totalGoodParks}</span>
                        <span>⚠️ Удовлетворительные: ${totalOkParks}</span>
                    </div>
                </div>
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
        loadQuarterData();
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
    console.log('Все кварталы:', allQuarters);
    console.log('Слой кварталов:', quartersLayer);
    console.log('Текущие границы карты:', map.getBounds());
};