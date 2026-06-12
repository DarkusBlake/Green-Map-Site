window.SearchManager = (function() {
    let map = null;
    
    function init(mapInstance) {
        map = mapInstance;
        addSearchControl();
        console.log('SearchManager инициализирован (Nominatim + Photon)');
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
                const viewBox = cityData.viewBox; // например "37.3,55.9,37.9,55.6"
                
                // 1. Пробуем Nominatim с ограничением по viewbox
                let url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=10&addressdetails=1&accept-language=ru&countrycodes=ru&dedupe=1&bounded=1`;
                if (viewBox) url += `&viewbox=${viewBox}`;
                
                try {
                    const response = await fetch(url, {
                        headers: { 'User-Agent': 'CityQuartersMap/1.0' }
                    });
                    if (!response.ok) throw new Error(`HTTP ${response.status}`);
                    const data = await response.json();
                    
                    if (data && data.length > 0) {
                        UI.hideLoading();
                        showResults(data);
                        return;
                    }
                    
                    // Если ничего не найдено, пробуем Photon
                    console.log('Nominatim не дал результатов, пробуем Photon');
                    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=10&lang=ru&bbox=${viewBox || ''}`;
                    const photonResp = await fetch(photonUrl);
                    if (!photonResp.ok) throw new Error('Photon error');
                    const photonData = await photonResp.json();
                    UI.hideLoading();
                    
                    if (!photonData.features || photonData.features.length === 0) {
                        alert('Ничего не найдено в выбранном городе');
                        return;
                    }
                    showPhotonResults(photonData.features);
                    
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
    
    function showResults(results) {
        if (window.searchMarkersLayer) map.removeLayer(window.searchMarkersLayer);
        window.searchMarkersLayer = L.layerGroup().addTo(map);
        
        results.forEach((result) => {
            const lat = parseFloat(result.lat);
            const lon = parseFloat(result.lon);
            const displayName = result.display_name || result.name;
            const marker = L.marker([lat, lon]).bindPopup(`
                <strong>${result.name || 'Место'}</strong><br>
                <small>${displayName.substring(0, 100)}</small><br>
                <button onclick="window.zoomToLocation(${lat}, ${lon})">Перейти</button>
            `).addTo(window.searchMarkersLayer);
        });
        
        const first = results[0];
        map.setView([parseFloat(first.lat), parseFloat(first.lon)], 15);
    }
    
    function showPhotonResults(features) {
        if (window.searchMarkersLayer) map.removeLayer(window.searchMarkersLayer);
        window.searchMarkersLayer = L.layerGroup().addTo(map);
        
        features.forEach((feature) => {
            const coords = feature.geometry.coordinates;
            const lon = coords[0];
            const lat = coords[1];
            const name = feature.properties.name || 'Место';
            const street = feature.properties.street || '';
            const marker = L.marker([lat, lon]).bindPopup(`
                <strong>${name}</strong><br>
                <small>${street}</small><br>
                <button onclick="window.zoomToLocation(${lat}, ${lon})">Перейти</button>
            `).addTo(window.searchMarkersLayer);
        });
        
        const first = features[0];
        const coords = first.geometry.coordinates;
        map.setView([coords[1], coords[0]], 15);
    }
    
    window.zoomToLocation = function(lat, lon) {
        map.setView([lat, lon], 17);
        const marker = L.marker([lat, lon]).bindPopup('Вы здесь').addTo(map);
        setTimeout(() => map.removeLayer(marker), 3000);
    };
    
    return { init };
})();