window.Utils = (function() {
    function calculateQuality(feature) {
        const props = feature.properties;
        
        if (props.quality >= 1 && props.quality <= 3) {
            return props.quality;
        }
        
        const ndvi = props.general_ndvi || 0;
        const greenDensity = props.population_density_per_green_zone || 0;
        
        let score = 0;
        
        if (ndvi >= 0.65) {
            score += 2;
        } else if (ndvi >= 0.55) {
            score += 1;
        } else if (ndvi >= 0.45) {
            score += 0;
        } else {
            score -= 1;
        }
        
        if (greenDensity === 0) {
            score += 1;
        } else if (greenDensity < 10) {
            score += 1;
        } else if (greenDensity < 50) {
            score += 0;
        } else if (greenDensity < 150) {
            score -= 1;
        } else {
            score -= 2;
        }
        
        const totalParksArea = (props.great_parks_area || 0) + 
                              (props.good_parks_area || 0) + 
                              (props.ok_parks_area || 0);
        const area = props.area || 1;
        const parkCoverage = (totalParksArea / area) * 100;
        
        if (parkCoverage > 20) {
            score += 1;
        } else if (parkCoverage > 10) {
            score += 0;
        } else if (parkCoverage > 5) {
            score -= 0.5;
        } else {
            score -= 1;
        }
        
        if (score >= 2) {
            return 3;
        } else if (score >= 0) {
            return 2;
        } else {
            return 1;
        }
    }
    
    function getColorByQuality(quality) {
        switch(quality) { 
            case 1: return '#a6c8ff';  // светло-синий
            case 2: return '#4a8fe7';  // насыщенный синий
            case 3: return '#0a4b8a';  // тёмно-синий
            default: return '#cccccc';
        }
    }
    
    function getQualityText(quality) {
        switch(quality) {
            case 1: return 'Плохое';
            case 2: return 'Нормальное';
            case 3: return 'Хорошее';
            default: return 'Неизвестно';
        }
    }
    
    function getParkStyle(feature) {
        const ndvi = feature.properties.ndvi;
        const intensity = (ndvi !== undefined && ndvi !== null) ? Math.min(1, Math.max(0, ndvi)) : 0.5;
        const r = Math.floor(200 * (1 - intensity));
        const g = Math.floor(100 + 155 * intensity);
        const b = Math.floor(100 * (1 - intensity));
        const color = `rgb(${r}, ${g}, ${b})`;
        return {
            fillColor: color,
            color: color,
            weight: 1,
            opacity: 0.8,
            fillOpacity: 0.6
        };
    }
    
    function formatNumber(num) {
        if (!num) return '0';
        if (num > 1000000) return (num / 1000000).toFixed(1) + ' млн';
        if (num > 1000) return (num / 1000).toFixed(0) + ' тыс';
        return Math.round(num).toString();
    }
    
    return {
        calculateQuality,
        getColorByQuality,
        getQualityText,
        getParkStyle,
        formatNumber
    };
})();