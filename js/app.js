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
    document.getElementById('total-objects').textContent = allQuarters.reduce((sum, q) => sum + (q.properties.nodes_count || 0), 0);
}

// Обновить прогресс-бар
function updateProgress(percent, text) {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (progressFill) progressFill.style.width = percent + '%';
    if (progressText) progressText.textContent = text;
}

// Загрузка данных из GeoJSON
async function loadQuarterData() {
    showLoading(true);
    updateProgress(0, 'Начинаем загрузку...');
    console.log('=== НАЧАЛО ЗАГРУЗКИ GEOJSON ===');
    
    try {
        // Пытаемся найти GeoJSON файл
        const possiblePaths = [
            'data/quarters.geojson',
            './data/quarters.geojson',
            'quarters.geojson',
            './quarters.geojson'
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
        
        updateProgress(30, 'Загружаем данные...');
        console.log('GeoJSON файл найден по пути:', usedPath);
        
        const geoJsonData = await response.json();
        console.log('GeoJSON загружен:', geoJsonData);
        
        updateProgress(60, 'Обрабатываем кварталы...');
        
        // Проверяем структуру GeoJSON
        if (!geoJsonData.features || !Array.isArray(geoJsonData.features)) {
            throw new Error('Неверный формат GeoJSON: отсутствует features array');
        }
        
        allQuarters = geoJsonData.features;
        console.log(`Загружено объектов: ${allQuarters.length}`);
        
        updateProgress(90, 'Отображаем на карте...');
        renderQuarters();
        updateStats();
        
        updateProgress(100, 'Загрузка завершена!');
        
    } catch (error) {
        console.error('Ошибка загрузки GeoJSON:', error);
        alert('Ошибка загрузки данных: ' + error.message);
        updateProgress(0, 'Ошибка загрузки');
    } finally {
        showLoading(false);
        // Через 2 секунды скрываем прогресс-бар
        setTimeout(() => updateProgress(0, 'Готов к работе'), 2000);
    }
}

// Отрисовка кварталов на карте
function renderQuarters() {
    console.log('Начинаем отрисовку кварталов...');
    
    // Удаляем старый слой
    if (quartersLayer) {
        map.removeLayer(quartersLayer);
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
                    <h3 class="popup-title">${props.name || `Квартал ${feature.id}`}</h3>
                    <p class="popup-subtitle">ID: ${feature.id} | Точек: ${props.nodes_count || 0}</p>
                </div>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <span class="stat-number">${props.ndvi || '0.3'}</span>
                        <span class="stat-label-popup">Индекс NDVI</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-number">${props.accessibility || 3}/5</span>
                        <span class="stat-label-popup">Доступность</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-number">${props.population || 0}</span>
                        <span class="stat-label-popup">Население</span>
                    </div>
                    <div class="stat-card">
                        <span class="stat-number">${props.area || '0'} га</span>
                        <span class="stat-label-popup">Площадь</span>
                    </div>
                </div>
                
                <div class="indicators">
                    <div class="indicator">
                        <span class="indicator-name">Качество озеленения:</span>
                        <span class="indicator-badge" style="background-color: ${getColorByNDVI(props.ndvi || 0.3)}">
                            ${getQualityText(props.ndvi || 0.3)}
                        </span>
                    </div>
                    <div class="indicator">
                        <span class="indicator-name">Уровень доступности:</span>
                        <span class="indicator-badge" style="background-color: ${getAccessibilityColor(props.accessibility || 3)}">
                            ${props.accessibility || 3}/5
                        </span>
                    </div>
                    <div class="indicator">
                        <span class="indicator-name">Плотность населения:</span>
                        <span class="indicator-value">
                            ${props.population && props.area ? Math.round(props.population / props.area) : 0} чел/га
                        </span>
                    </div>
                </div>
                
                <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid #f0f0f0; font-size: 11px; color: #666;">
                    Центр: ${props.center_lat ? props.center_lat.toFixed(6) : 'N/A'}, ${props.center_lon ? props.center_lon.toFixed(6) : 'N/A'}
                </div>
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
    
    // Автоматически подстраиваем границы карты
    if (allQuarters.length > 0) {
        map.fitBounds(quartersLayer.getBounds(), { padding: [20, 20] });
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
    updateProgress(0, 'Карта очищена');
    console.log('Карта очищена');
}

// Показать статистику
function showStatistics() {
    if (allQuarters.length === 0) {
        alert('Сначала загрузите данные кварталов');
        return;
    }
    
    const totalPopulation = allQuarters.reduce((sum, q) => sum + (q.properties.population || 0), 0);
    const avgNDVI = (allQuarters.reduce((sum, q) => sum + (q.properties.ndvi || 0), 0) / allQuarters.length).toFixed(2);
    const avgAccessibility = (allQuarters.reduce((sum, q) => sum + (q.properties.accessibility || 0), 0) / allQuarters.length).toFixed(1);
    const totalArea = allQuarters.reduce((sum, q) => sum + (q.properties.area || 0), 0).toFixed(1);
    
    alert(`Статистика по кварталам:
    
Всего кварталов: ${allQuarters.length}
Общее население: ${totalPopulation.toLocaleString()} чел.
Средний NDVI: ${avgNDVI}
Средняя доступность: ${avgAccessibility}/5
Общая площадь: ${totalArea} га`);
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
};