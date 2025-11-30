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

// Загрузка данных из GeoJSON
async function loadGeoJSONData() {
    showLoading(true);
    console.log('=== НАЧАЛО ЗАГРУЗКИ GEOJSON ===');
    
    try {
        // Пытаемся найти GeoJSON файл
        const possiblePaths = [
            'data/With_wood.geojson',
            './data/With_wood.geojson',
            'With_wood.geojson',
            './With_wood.geojson',
            'data/Parks_Dataset.geojson',
            './data/Parks_Dataset.geojson'
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
            throw new Error('GeoJSON файл не найден. Проверьте путь к файлу.');
        }
        
        console.log('GeoJSON файл найден по пути:', usedPath);
        
        const geoJsonData = await response.json();
        console.log('GeoJSON загружен, тип:', geoJsonData.type);
        console.log('Количество объектов:', geoJsonData.features ? geoJsonData.features.length : 0);
        
        if (geoJsonData.features && geoJsonData.features.length > 0) {
            console.log('Первый объект GeoJSON:', geoJsonData.features[0]);
            
            // Обрабатываем данные GeoJSON
            processGeoJSONData(geoJsonData);
        } else {
            throw new Error('GeoJSON файл не содержит объектов (features)');
        }
        
        renderQuarters();
        updateStats();
        
    } catch (error) {
        console.error('Ошибка загрузки GeoJSON:', error);
        alert('Ошибка загрузки данных: ' + error.message);
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
    
    geoJsonData.features.forEach((feature, index) => {
        // Создаем обогащенный объект с дополнительными свойствами
        const enrichedFeature = {
            type: 'Feature',
            properties: {
                id: feature.id || feature.properties?.id || `feature-${index}`,
                name: getFeatureName(feature),
                ndvi: calculateNDVI(feature),
                population: getPopulation(feature),
                area: calculateArea(feature),
                natural_type: feature.properties?.natural || feature.properties?.type || 'unknown',
                // Дополнительные свойства из исходного GeoJSON
                ...feature.properties
            },
            geometry: feature.geometry
        };
        
        allQuarters.push(enrichedFeature);
    });
    
    console.log(`Обработано объектов: ${allQuarters.length}`);
}

// Получение названия объекта
function getFeatureName(feature) {
    if (feature.properties?.name) return feature.properties.name;
    if (feature.properties?.['@id']) return `Объект ${feature.properties['@id']}`;
    if (feature.id) return `Объект ${feature.id}`;
    if (feature.properties?.natural) {
        return `Природный объект (${feature.properties.natural})`;
    }
    return 'Неизвестный объект';
}

// Расчет NDVI на основе типа объекта
function calculateNDVI(feature) {
    // Если в свойствах уже есть NDVI, используем его
    if (feature.properties?.ndvi) return parseFloat(feature.properties.ndvi);
    
    // Иначе рассчитываем на основе типа объекта
    const naturalType = feature.properties?.natural;
    switch(naturalType) {
        case 'wood':
        case 'forest':
            return 0.7 + Math.random() * 0.2; // Высокий NDVI для леса
        case 'park':
        case 'garden':
            return 0.5 + Math.random() * 0.3; // Средний NDVI для парков
        case 'grass':
        case 'meadow':
            return 0.4 + Math.random() * 0.2; // NDVI для лугов
        case 'water':
            return -0.1 + Math.random() * 0.1; // Низкий NDVI для воды
        default:
            return 0.3 + Math.random() * 0.4; // Случайный NDVI по умолчанию
    }
}

// Получение населения (для совместимости со старой структурой)
function getPopulation(feature) {
    return feature.properties?.population || 0;
}

// Расчет площади объекта
function calculateArea(feature) {
    if (feature.properties?.area) return parseFloat(feature.properties.area);
    if (feature.properties?.['area_m2']) return parseFloat(feature.properties['area_m2']);
    
    // Простой расчет площади по bounding box (для демонстрации)
    try {
        const coordinates = feature.geometry?.coordinates;
        if (!coordinates) return 10000 + Math.random() * 50000;
        
        // Для полигонов берем первую внешнюю границу
        const polygon = coordinates[0];
        if (polygon && polygon.length > 2) {
            // Простой расчет: разница координат * приблизительный коэффициент
            const lats = polygon.map(coord => coord[1]);
            const lons = polygon.map(coord => coord[0]);
            const latDiff = Math.max(...lats) - Math.min(...lats);
            const lonDiff = Math.max(...lons) - Math.min(...lons);
            return Math.abs(latDiff * lonDiff * 111000 * 71000); // Приблизительный расчет в м²
        }
    } catch (error) {
        console.log('Ошибка расчета площади:', error);
    }
    
    return 10000 + Math.random() * 50000; // Случайная площадь по умолчанию
}

// Отрисовка кварталов на карте
function renderQuarters() {
    console.log('Начинаем отрисовку объектов...');
    
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
            const ndvi = props.ndvi || 0.3;
            
            return {
                fillColor: getColorByNDVI(ndvi),
                fillOpacity: 0.7,
                color: getColorByNDVI(ndvi),
                weight: 2,
                opacity: 0.9
            };
        },
        onEachFeature: function(feature, layer) {
            // Добавляем попап для каждого объекта
            const props = feature.properties;
            const popupContent = `
                <div class="popup-header">
                    <h3 class="popup-title">${props.name}</h3>
                    <p class="popup-subtitle">ID: ${props.id} | Тип: ${props.natural_type || 'не указан'}</p>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <span class="stat-number">${props.ndvi ? props.ndvi.toFixed(3) : '0.000'}</span>
                        <span class="stat-label-popup">NDVI индекс</span>
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
                
                ${props.natural_type ? `
                <div style="margin-top: 10px;">
                    <div style="font-size: 12px; color: #666; margin-bottom: 5px;">Дополнительная информация:</div>
                    <div style="font-size: 11px; color: #888;">
                        <div>🌳 Тип объекта: ${props.natural_type}</div>
                        ${props.type ? `<div>📝 Категория: ${props.type}</div>` : ''}
                        ${props['@id'] ? `<div>🔗 OSM ID: ${props['@id']}</div>` : ''}
                    </div>
                </div>
                ` : ''}
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
                    color: getColorByNDVI(props.ndvi || 0.3)
                });
            });
        }
    });
    
    quartersLayer.addTo(map);
    
    // Автоматически подстраиваем границы карты под загруженные данные
    if (allQuarters.length > 0) {
        map.fitBounds(quartersLayer.getBounds(), { 
            padding: [20, 20],
            maxZoom: 15
        });
        console.log('Границы карты обновлены');
    }
    
    console.log('Отрисовка завершена:', allQuarters.length, 'объектов');
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
    const typeStats = {};
    allQuarters.forEach(q => {
        const type = q.properties.natural_type || 'unknown';
        typeStats[type] = (typeStats[type] || 0) + 1;
    });
    
    const typeStatsHTML = Object.entries(typeStats)
        .map(([type, count]) => `<div style="display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #eee;">
            <span>${getTypeEmoji(type)} ${getTypeName(type)}:</span>
            <span style="font-weight: 600;">${count}</span>
        </div>`)
        .join('');
    
    // Создаем красивое модальное окно
    const statsHTML = `
        <div style="padding: 20px; max-width: 500px;">
            <h3 style="color: #2c7744; margin-bottom: 20px; text-align: center;">📊 Статистика по объектам</h3>
            <div style="display: grid; gap: 12px;">
                <div style="display: flex; justify-content: space-between; padding: 10px; background: #f8f9fa; border-radius: 8px;">
                    <span style="font-weight: 500;">Всего объектов:</span>
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
                    <div style="font-weight: 500; margin-bottom: 8px;">Распределение по типам:</div>
                    <div style="font-size: 13px;">
                        ${typeStatsHTML}
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

// Вспомогательные функции для статистики
function getTypeEmoji(type) {
    const emojiMap = {
        'wood': '🌲',
        'forest': '🌳',
        'park': '🏞️',
        'garden': '🌷',
        'grass': '🌿',
        'meadow': '🟩',
        'water': '💧',
        'unknown': '❓'
    };
    return emojiMap[type] || '📍';
}

function getTypeName(type) {
    const nameMap = {
        'wood': 'Лес',
        'forest': 'Лесной массив',
        'park': 'Парк',
        'garden': 'Сад',
        'grass': 'Трава',
        'meadow': 'Луг',
        'water': 'Водоём',
        'unknown': 'Неизвестно'
    };
    return nameMap[type] || type;
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
        loadGeoJSONData();
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
};
