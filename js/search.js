window.SearchManager = (function() {
    let map = null;
    
    function init(mapInstance) {
        map = mapInstance;
        addSearchControl();
        console.log('SearchManager инициализирован');
    }
    
    function addSearchControl() {
        const SearchControl = L.Control.extend({
            options: { position: 'topleft' },
            
            onAdd: function(map) {
                const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
                container.style.backgroundColor = 'white';
                container.style.padding = '5px';
                container.style.borderRadius = '4px';
                container.style.boxShadow = '0 1px 5px rgba(0,0,0,0.65)';
                container.style.display = 'flex';
                container.style.gap = '5px';
                
                this.input = L.DomUtil.create('input', '', container);
                this.input.type = 'text';
                this.input.placeholder = '🔍 Поиск адреса или места...';
                this.input.style.padding = '8px 12px';
                this.input.style.border = '1px solid #ddd';
                this.input.style.borderRadius = '3px';
                this.input.style.fontSize = '14px';
                this.input.style.width = '220px';
                this.input.style.outline = 'none';
                
                this.button = L.DomUtil.create('button', '', container);
                this.button.innerHTML = '🔍';
                this.button.style.padding = '8px 12px';
                this.button.style.backgroundColor = '#4CAF50';
                this.button.style.color = 'white';
                this.button.style.border = 'none';
                this.button.style.borderRadius = '3px';
                this.button.style.cursor = 'pointer';
                
                L.DomEvent.disableClickPropagation(container);
                
                this.button.onclick = () => this.search();
                this.input.onkeypress = (e) => {
                    if (e.key === 'Enter') this.search();
                };
                
                return container;
            },
            
            search: async function() {
                const query = this.input.value.trim();
                if (!query) return;
                
                UI.showLoading();
                const cityData = CityManager.getCityData();
                
                // Используем Photon вместо Nominatim (стабильнее)
                const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=10&lang=ru&bbox=${cityData.viewBox || ''}`;
                
                try {
                    const response = await fetch(url, {
                        headers: { 
                            'User-Agent': 'CityQuartersMap/1.0'
                        }
                    });
                    
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    
                    const data = await response.json();
                    UI.hideLoading();
                    
                    if (!data.features || data.features.length === 0) {
                        alert('Ничего не найдено');
                        return;
                    }
                    showPhotonResults(data.features);
                } catch (err) {
                    UI.hideLoading();
                    console.error(err);
                    alert('Ошибка поиска. Попробуйте другой запрос.');
                }
            }
        });
        
        const searchControl = new SearchControl();
        searchControl.addTo(map);
    }
    
    function showPhotonResults(features) {
        if (window.searchMarkersLayer) map.removeLayer(window.searchMarkersLayer);
        window.searchMarkersLayer = L.layerGroup().addTo(map);
        
        const results = features.map(f => ({
            lat: f.geometry.coordinates[1],
            lon: f.geometry.coordinates[0],
            name: f.properties.name,
            display_name: f.properties.street || f.properties.name
        }));
        
        results.forEach((result, idx) => {
            const marker = L.marker([result.lat, result.lon]).bindPopup(`
                <strong>${result.name || 'Место'}</strong><br>
                <small>${result.display_name || ''}</small><br>
                <button onclick="window.zoomToLocation(${result.lat}, ${result.lon})">Перейти</button>
            `).addTo(window.searchMarkersLayer);
        });
        
        const first = results[0];
        map.setView([first.lat, first.lon], 15);
    }
    
    function showResults(results) {
        if (window.searchMarkersLayer) map.removeLayer(window.searchMarkersLayer);
        window.searchMarkersLayer = L.layerGroup().addTo(map);
        
        results.forEach((result, idx) => {
            const lat = parseFloat(result.lat);
            const lon = parseFloat(result.lon);
            const marker = L.marker([lat, lon]).bindPopup(`
                <strong>${result.name || 'Место'}</strong><br>
                <small>${(result.display_name || '').substring(0, 100)}</small><br>
                <button onclick="window.zoomToLocation(${lat}, ${lon})">Перейти</button>
            `).addTo(window.searchMarkersLayer);
        });
        
        const first = results[0];
        map.setView([parseFloat(first.lat), parseFloat(first.lon)], 15);
    }
    
    window.zoomToLocation = function(lat, lon) {
        map.setView([lat, lon], 17);
        const marker = L.marker([lat, lon]).bindPopup('Вы здесь').addTo(map);
        setTimeout(() => map.removeLayer(marker), 3000);
    };
    
    return { init };
})();