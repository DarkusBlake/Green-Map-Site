let map;
let dataLayer;

// Nodes из данных
const quarterNodes = ["7992520835", "7992520834", "7992520833", "7992520832"];

// Конфигурация квартала
const quarterConfig = {
    "id": "857250677",
    "name": "Студ городок",
    "version": "#3",
    "description": "Линия: 857250677",
    "last_edit": "около 1 года назад",
    "editor": "Intellect",
    "changeset": "#155881192",
    "tags": {
        "landuse": "residential",
        "residential": "urban"
    },
    "ndvi": 0.48,
    "population": 1342,
    "accessibility": 78.5,
    "area_type": "жилая зона urban"
};

// Инициализация карты
function initMap() {
    console.log("Инициализация карты для Екатеринбурга...");
    
    const mapContainer = document.getElementById('map');
    mapContainer.style.height = 'calc(100vh - 140px)';
    
    // Центр карты - Екатеринбург (приблизительно)
    map = L.map('map').setView([56.8386, 60.6055], 13);
    
    // OSM слой
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    
    // Слой для данных
    dataLayer = L.layerGroup().addTo(map);
    
    window.dataLayer = dataLayer;
    window.map = map;
    
    console.log("Карта инициализирована для Екатеринбурга");
    
    setTimeout(() => {
        map.invalidateSize();
    }, 100);
}

// Получение координат nodes через OSM API
async function getNodeCoordinates(nodeId) {
    try {
        const response = await fetch(`https://api.openstreetmap.org/api/0.6/node/${nodeId}`);
        const text = await response.text();
        
        // Парсим XML ответ
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        
        const node = xmlDoc.getElementsByTagName('node')[0];
        if (node) {
            const lat = parseFloat(node.getAttribute('lat'));
            const lon = parseFloat(node.getAttribute('lon'));
            return [lon, lat]; // GeoJSON format: [lng, lat]
        }
    } catch (error) {
        console.error(`Ошибка получения координат для node ${nodeId}:`, error);
    }
    return null;
}

// Загрузка реальных данных квартала
async function loadQuarterData() {
    console.log("Загрузка реальных данных квартала...");
    showLoading(true);
    
    try {
        // Получаем координаты всех nodes
        const coordinates = [];
        for (const nodeId of quarterNodes) {
            const coords = await getNodeCoordinates(nodeId);
            if (coords) {
                coordinates.push(coords);
                console.log(`Node ${nodeId}:`, coords);
            } else {
                console.warn(`Не удалось получить координаты для node ${nodeId}`);
            }
        }
        
        if (coordinates.length < 3) {
            throw new Error("Недостаточно координат для создания полигона");
        }
        
        // Замыкаем полигон (добавляем первую точку в конец)
        coordinates.push(coordinates[0]);
        
        // Создаем GeoJSON с реальными координатами
        const realQuarter = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "properties": quarterConfig,
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [coordinates]
                    }
                }
            ]
        };
        
        // Очищаем карту и добавляем реальный полигон
        if (dataLayer) {
            dataLayer.clearLayers();
        }
        
        L.geoJSON(realQuarter, {
            style: getPolygonStyle(quarterConfig.ndvi),
            onEachFeature: function(feature, layer) {
                // Всплывающее окно при клике
                layer.bindPopup(createPopupContent(feature.properties));
                
                // Подсветка при наведении
                layer.on('mouseover', function(e) {
                    layer.setStyle({
                        weight: 4,
                        color: '#ff7800',
                        opacity: 1,
                        fillOpacity: 0.8
                    });
                    layer.bringToFront();
                });
                
                layer.on('mouseout', function(e) {
                    layer.setStyle(getPolygonStyle(feature.properties.ndvi));
                });
                
                // Информация в консоли при наведении
                layer.on('mouseover', function(e) {
                    console.log('Наведен на реальный квартал:', {
                        id: feature.properties.id,
                        nodes: quarterNodes,
                        coordinates: coordinates,
                        ndvi: feature.properties.ndvi
                    });
                });
            }
        }).addTo(dataLayer);
        
        // Центрируем карту на реальном полигоне
        const bounds = L.geoJSON(realQuarter).getBounds();
        map.fitBounds(bounds, { padding: [20, 20] });
        
        console.log("Реальные данные квартала загружены:", realQuarter);
        
    } catch (error) {
        console.error("Ошибка загрузки данных:", error);
        alert("Не удалось загрузить реальные координаты. Используем тестовые данные.");
        loadTestData(); // Фолбэк на тестовые данные
    } finally {
        showLoading(false);
    }
}

// Фолбэк: тестовые данные если API не работает
function loadTestData() {
    console.log("Используем тестовые данные...");
    
    const testCoordinates = [
        [60.5970, 56.8320],
        [60.6120, 56.8320], 
        [60.6120, 56.8250],
        [60.5970, 56.8250],
        [60.5970, 56.8320]
    ];
    
    const testQuarter = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "properties": quarterConfig,
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [testCoordinates]
                }
            }
        ]
    };
    
    if (dataLayer) {
        dataLayer.clearLayers();
    }
    
    L.geoJSON(testQuarter, {
        style: getPolygonStyle(quarterConfig.ndvi),
        onEachFeature: function(feature, layer) {
            layer.bindPopup(createPopupContent(feature.properties) + "<br><small><em>⚠️ Используются тестовые координаты</em></small>");
            
            layer.on('mouseover', function(e) {
                layer.setStyle({
                    weight: 4,
                    color: '#ff7800',
                    opacity: 1,
                    fillOpacity: 0.8
                });
            });
            
            layer.on('mouseout', function(e) {
                layer.setStyle(getPolygonStyle(feature.properties.ndvi));
            });
        }
    }).addTo(dataLayer);
    
    const bounds = L.geoJSON(testQuarter).getBounds();
    map.fitBounds(bounds, { padding: [20, 20] });
}

function getPolygonStyle(ndvi) {
    let color;
    
    if (ndvi < 0.2) {
        color = '#ff4444';
    } else if (ndvi < 0.5) {
        color = '#ffaa00';
    } else {
        color = '#44aa44';
    }
    
    return {
        fillColor: color,
        weight: 3,
        opacity: 0.9,
        color: '#ffffff',
        fillOpacity: 0.7
    };
}

function createPopupContent(properties) {
    const nodesList = quarterNodes.join(', ');
    
    return `
        <div class="popup-content">
            <h3>🏘️ ${properties.name}</h3>
            <p><em>${properties.description}</em></p>
            
            <div class="popup-stats">
                <div class="stat-row">
                    <span class="stat-label">🌿 NDVI:</span>
                    <span class="stat-value">${properties.ndvi.toFixed(3)}</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">👥 Жители:</span>
                    <span class="stat-value">${properties.population} чел.</span>
                </div>
                <div class="stat-row">
                    <span class="stat-label">♿ Доступность:</span>
                    <span class="stat-value">${properties.accessibility}%</span>
                </div>
            </div>
        </div>
    `;
}

function showLoading(show) {
    let spinner = document.getElementById('loadingSpinner');
    if (!spinner) {
        spinner = document.createElement('div');
        spinner.id = 'loadingSpinner';
        spinner.className = 'loading-spinner';
        document.body.appendChild(spinner);
    }
    
    if (show) {
        spinner.innerHTML = '🔄 Загрузка реальных координат из OSM...';
        spinner.style.display = 'block';
    } else {
        spinner.style.display = 'none';
    }
}

function clearMap() {
    if (dataLayer) {
        dataLayer.clearLayers();
        console.log("Карта очищена");
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM загружен, инициализируем карту...");
    initMap();
    
    // Автоматически загружаем реальные данные
    setTimeout(() => {
        loadQuarterData();
    }, 1000);
});