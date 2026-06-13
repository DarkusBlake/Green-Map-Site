// js/city.js
// Управление городами и их данными

window.CityManager = (function() {
    let currentCity = 'ekaterinburg';
    let listeners = [];
    
    // Данные городов
    const cityData = {
        'moscow': {
            name: 'Москва',
            center: [55.7558, 37.6173],
            zoom: 11,
            quartersUrl: 'https://backend-project-sber.onrender.com/quarters?city=moscow',
            parksUrl: 'https://backend-project-sber.onrender.com/green-zones?city=moscow',
            roadsUrl: 'https://backend-project-sber.onrender.com/roads?city=moscow',
            viewBox: '37.3,55.9,37.9,55.6'
        },
        'ekaterinburg': {
            name: 'Екатеринбург',
            center: [56.838, 60.605],
            zoom: 12,
            quartersUrl: 'https://backend-project-sber.onrender.com/quarters?city=ekaterinburg',
            parksUrl: 'https://backend-project-sber.onrender.com/green-zones?city=ekaterinburg',
            roadsUrl: 'https://backend-project-sber.onrender.com/roads?city=ekaterinburg',
            viewBox: '60.4,56.9,60.8,56.75'
        },
        'peter': {
            name: 'Санкт-Петербург',
            center: [59.9343, 30.3351],
            zoom: 11,
            quartersUrl: 'https://backend-project-sber.onrender.com/quarters?city=saint-petersburg',
            parksUrl: 'https://backend-project-sber.onrender.com/green-zones?city=saint-petersburg',
            roadsUrl: 'https://backend-project-sber.onrender.com/roads?city=saint-petersburg',
            viewBox: '30.1,60.0,30.6,59.8'
        }
    };
    
    function getCurrentCity() {
        return currentCity;
    }
    
    function getCityData(city = currentCity) {
        return cityData[city];
    }
    
    function getAllCities() {
        return Object.keys(cityData);
    }
    
    function switchCity(cityId) {
        if (!cityData[cityId]) {
            console.error('Unknown city:', cityId);
            return false;
        }
        
        currentCity = cityId;
        
        // Очищаем метки поиска при смене города
        if (window.SearchManager && window.SearchManager.clearSearchMarkers) {
            window.SearchManager.clearSearchMarkers();
        }
        
        // Обновляем активную кнопку
        document.querySelectorAll('.city-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-city') === cityId) {
                btn.classList.add('active');
            }
        });
        
        // Уведомляем подписчиков
        listeners.forEach(listener => {
            listener(cityId, cityData[cityId]);
        });
        
        return true;
    }
    
    function onCityChange(callback) {
        listeners.push(callback);
        return () => {
            listeners = listeners.filter(l => l !== callback);
        };
    }
    
    // Инициализация кнопок городов
    function init() {
        document.querySelectorAll('.city-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const cityId = btn.getAttribute('data-city');
                switchCity(cityId);
            });
        });
    }
    
    return {
        init,
        getCurrentCity,
        getCityData,
        getAllCities,
        switchCity,
        onCityChange
    };
})();