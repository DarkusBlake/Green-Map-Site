// js/app.js
let map;
let quartersLayer = null;
let allQuarters = [];

// Функция для парсинга координат из нового формата
function parseCoordinates(coordString) {
    try {
        if (!coordString || coordString.trim() === '') {
            console.log('Пустая строка координат');
            return [];
        }
        
        console.log('Исходная строка координат:', coordString);
        
        // Разделяем по точкам с запятой
        const points = coordString.split(';').map(point => point.trim());
        console.log('Разделенные точки:', points);
        
        const coordinates = [];
        
        points.forEach(point => {
            if (point) {
                // Разделяем долготу и широту
                const [lon, lat] = point.split(',').map(coord => parseFloat(coord.trim()));
                if (!isNaN(lat) && !isNaN(lon)) {
                    coordinates.push([lat, lon]);
                }
            }
        });
        
        console.log('Парсинг успешен, координат:', coordinates.length);
        return coordinates;
        
    } catch (error) {
        console.error('Ошибка парсинга координат:', error, 'Строка:', coordString);
        return [];
    }
}

// Функция для получения цвета по NDVI
function getColorByNDVI(ndvi) {
    const value = parseFloat(ndvi);
    if (value > 0.6) return '#238823';
    if (value > 0.4) return '#7bc242';
    if (value > 0.3) return '#d6ce1f';
    if (value > 0.2) return '#ff8c00';
    return '#d2222d';
}

// Функция для получения цвета доступности
function getAccessibilityColor(accessibility) {
    const colors = ['#d2222d', '#ff8c00', '#d6ce1f', '#7bc242', '#238823'];
    return colors[accessibility - 1] || '#666666';
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
    document.getElementById('total-objects').textContent = allQuarters.reduce((sum, q) => sum + (parseInt(q.количество_точек) || 0), 0);
}

// Загрузка данных из CSV
async function loadQuarterData() {
    showLoading(true);
    console.log('=== НАЧАЛО ЗАГРУЗКИ CSV ===');
    
    try {
        const response = await fetch('quartal_nodes.csv');
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const csvText = await response.text();
        console.log('CSV загружен, первые 500 символов:', csvText.substring(0, 500));
        
        const results = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            dynamicTyping: false
        });
        
        console.log('CSV распарсен, всего строк:', results.data.length);
        console.log('Заголовки:', results.meta.fields);
        
        // Выводим первые несколько строк для отладки
        console.log('Первые 3 строки данных:', results.data.slice(0, 3));
        
        // Фильтруем данные с валидными координатами
        allQuarters = results.data
            .filter(item => {
                if (!item.id) {
                    console.log('Пропускаем - нет ID');
                    return false;
                }
                
                console.log(`Проверяем квартал: ${item.id} - ${item.название}`);
                console.log(`Координаты: ${item.все_точки_границ}`);
                
                if (!item.все_точки_границ || item.все_точки_границ.trim() === '') {
                    console.log(`Пропускаем ${item.id} - пустые координаты`);
                    return false;
                }
                
                const coords = parseCoordinates(item.все_точки_границ);
                console.log(`Координаты для ${item.id}:`, coords);
                
                if (coords.length === 0) {
                    console.log(`Пропускаем ${item.id} - не удалось распарсить координаты`);
                    return false;
                }
                
                console.log(`✅ ${item.id} - ВАЛИДЕН, ${coords.length} точек`);
                return true;
            })
            .map(quarter => {
                const coords = parseCoordinates(quarter.все_точки_границ);
                
                return {
                    id: quarter.id,
                    name: quarter.название,
                    center_lat: parseFloat(quarter.широта_центра) || 0,
                    center_lon: parseFloat(quarter.долгота_центра) || 0,
                    parsedCoords: coords,
                    nodes_count: parseInt(quarter.количество_точек) || 0,
                    north_bound: parseFloat(quarter.северная_граница) || 0,
                    south_bound: parseFloat(quarter.южная_граница) || 0,
                    west_bound: parseFloat(quarter.западная_граница) || 0,
                    east_bound: parseFloat(quarter.восточная_граница) || 0,
                    server: quarter.сервер,
                    // Генерируем демо-данные
                    ndvi: (Math.random() * 0.5 + 0.3).toFixed(2),
                    accessibility: Math.floor(Math.random() * 5) + 1,
                    population: Math.floor(Math.random() * 5000) + 500,
                    area: (Math.random() * 10 + 2).toFixed(1)
                };
            });
        
        console.log('=== РЕЗУЛЬТАТЫ ФИЛЬТРАЦИИ ===');
        console.log(`Отфильтровано кварталов: ${allQuarters.length}`);
        console.log('Все отфильтрованные кварталы:', allQuarters);
        
        if (allQuarters.length === 0) {
            throw new Error(`Не найдено подходящих кварталов. Проверьте формат координат.`);
        }
        
        renderQuarters();
        updateStats();
        
    } catch (error) {
        console.error('Ошибка загрузки CSV:', error);
        alert('Ошибка загрузки данных: ' + error.message + '\n\nОткройте консоль браузера (F12) для подробной информации.');
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
    
    quartersLayer = L.layerGroup();
    let renderedCount = 0;
    
    allQuarters.forEach(quarter => {
        if (quarter.parsedCoords && quarter.parsedCoords.length > 0) {
            try {
                console.log(`Отрисовываем квартал ${quarter.id} с ${quarter.parsedCoords.length} точками`);
                
                const polygon = L.polygon(quarter.parsedCoords, {
                    fillColor: getColorByNDVI(quarter.ndvi),
                    fillOpacity: 0.6,
                    color: getColorByNDVI(quarter.ndvi),
                    weight: 2,
                    opacity: 0.8
                });
                
                // Попап с информацией
                const popupContent = `
                    <div class="popup-header">
                        <h3 class="popup-title">${quarter.name || `Квартал ${quarter.id}`}</h3>
                        <p class="popup-subtitle">ID: ${quarter.id} | Точек: ${quarter.nodes_count}</p>
                    </div>
                    
                    <div class="stats-grid">
                        <div class="stat-card">
                            <span class="stat-number">${quarter.ndvi}</span>
                            <span class="stat-label-popup">Индекс NDVI</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-number">${quarter.accessibility}/5</span>
                            <span class="stat-label-popup">Доступность</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-number">${quarter.population}</span>
                            <span class="stat-label-popup">Население</span>
                        </div>
                        <div class="stat-card">
                            <span class="stat-number">${quarter.area} га</span>
                            <span class="stat-label-popup">Площадь</span>
                        </div>
                    </div>
                    
                    <div class="indicators">
                        <div class="indicator">
                            <span class="indicator-name">Качество озеленения:</span>
                            <span class="indicator-badge" style="background-color: ${getColorByNDVI(quarter.ndvi)}">
                                ${getQualityText(quarter.ndvi)}
                            </span>
                        </div>
                        <div class="indicator">
                            <span class="indicator-name">Уровень доступности:</span>
                            <span class="indicator-badge" style="background-color: ${getAccessibilityColor(quarter.accessibility)}">
                                ${quarter.accessibility}/5
                            </span>
                        </div>
                        <div class="indicator">
                            <span class="indicator-name">Плотность населения:</span>
                            <span class="indicator-value">
                                ${Math.round(quarter.population / quarter.area)} чел/га
                            </span>
                        </div>
                    </div>
                    
                    <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #f0f0f0; font-size: 11px; color: #666;">
                        Центр: ${quarter.center_lat.toFixed(6)}, ${quarter.center_lon.toFixed(6)}
                    </div>
                `;
                
                polygon.bindPopup(popupContent);
                
                // Добавляем обработчики событий для hover эффекта
                polygon.on('mouseover', function(e) {
                    this.setStyle({
                        fillOpacity: 0.8,
                        weight: 3
                    });
                });
                
                polygon.on('mouseout', function(e) {
                    this.setStyle({
                        fillOpacity: 0.6,
                        weight: 2
                    });
                });
                
                quartersLayer.addLayer(polygon);
                renderedCount++;
                
            } catch (error) {
                console.error('Ошибка при создании полигона для квартала', quarter.id, error);
            }
        }
    });
    
    console.log('Успешно отрисовано полигонов:', renderedCount);
    
    quartersLayer.addTo(map);
    
    // Автоматически подстраиваем границы карты
    if (renderedCount > 0) {
        const group = new L.featureGroup(quartersLayer.getLayers());
        map.fitBounds(group.getBounds(), { padding: [20, 20] });
        console.log('Границы карты обновлены');
    } else {
        console.log('Нет полигонов для отображения');
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
}

// Показать статистику
function showStatistics() {
    if (allQuarters.length === 0) {
        alert('Сначала загрузите данные кварталов');
        return;
    }
    
    const totalPopulation = allQuarters.reduce((sum, q) => sum + parseInt(q.population), 0);
    const avgNDVI = (allQuarters.reduce((sum, q) => sum + parseFloat(q.ndvi), 0) / allQuarters.length).toFixed(2);
    const avgAccessibility = (allQuarters.reduce((sum, q) => sum + parseInt(q.accessibility), 0) / allQuarters.length).toFixed(1);
    
    alert(`Статистика по кварталам:
    
Всего кварталов: ${allQuarters.length}
Общее население: ${totalPopulation.toLocaleString()} чел.
Средний NDVI: ${avgNDVI}
Средняя доступность: ${avgAccessibility}/5
Общая площадь: ${allQuarters.reduce((sum, q) => sum + parseFloat(q.area), 0).toFixed(1)} га`);
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

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, инициализируем карту...');
    initMap();
});

// Добавляем глобальную функцию для отладки
window.debugData = function() {
    console.log('Все кварталы:', allQuarters);
    console.log('Слой кварталов:', quartersLayer);
    
    if (allQuarters.length > 0) {
        const firstQuarter = allQuarters[0];
        console.log('Первый квартал детально:', firstQuarter);
        console.log('Координаты первого квартала:', firstQuarter.parsedCoords);
    }
};