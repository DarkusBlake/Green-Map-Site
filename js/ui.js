// js/ui.js
// Управление UI элементами

window.UI = (function() {
    let infoPanel, loadingSpinner;
    
    function init() {
        infoPanel = document.getElementById('info-panel');
        loadingSpinner = document.getElementById('loading');
    }
    
    function showDefaultPanel() {
        if (!infoPanel) return;
        infoPanel.innerHTML = `
            <div class="info-placeholder">
                <i class="fas fa-map-marker-alt"></i>
                <p>Кликните по кварталу, чтобы увидеть подробную информацию</p>
                <br>
                <small>💡 Используйте поиск в левом верхнем углу</small>
            </div>
        `;
    }
    
    function showQuarterInfo(props) {
        if (!infoPanel) return;
        
        const quality = props.calculated_quality;
        const qualityText = Utils.getQualityText(quality);
        
        infoPanel.innerHTML = `
            <div class="info-details">
                <div class="info-title">
                    <i class="fas fa-building"></i> 
                    Квартал ${props.quarter_id || 'N/A'}
                </div>
                
                <div class="info-stats">
                    <div class="info-stat-card">
                        <div class="info-stat-number">${Utils.formatNumber(props.population)}</div>
                        <div class="info-stat-label">Население</div>
                    </div>
                    <div class="info-stat-card">
                        <div class="info-stat-number">${Math.round(props.area || 0).toLocaleString()} м²</div>
                        <div class="info-stat-label">Площадь</div>
                    </div>
                    <div class="info-stat-card">
                        <div class="info-stat-number">${(props.general_ndvi || 0).toFixed(3)}</div>
                        <div class="info-stat-label">NDVI индекс</div>
                    </div>
                </div>
                
                <div class="info-quality">
                    <div class="quality-badge level-${quality}">
                        <i class="fas ${quality === 3 ? 'fa-star' : (quality === 2 ? 'fa-smile' : 'fa-exclamation-circle')}"></i>
                        Качество: ${qualityText} (${quality}/3)
                    </div>
                </div>
                
                <div class="info-parks">
                    <h4><i class="fas fa-tree"></i> Зелёные зоны</h4>
                    <table class="parks-table">
                        <thead>
                            <tr><th>Тип</th><th>Кол-во</th><th>Площадь</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>🏆 Отличные</td><td>${props.great_parks_count || 0}</td><td>${Math.round(props.great_parks_area || 0).toLocaleString()} м²</td></tr>
                            <tr><td>✅ Хорошие</td><td>${props.good_parks_count || 0}</td><td>${Math.round(props.good_parks_area || 0).toLocaleString()} м²</td></tr>
                            <tr><td>🌿 Обычные</td><td>${props.ok_parks_count || 0}</td><td>${Math.round(props.ok_parks_area || 0).toLocaleString()} м²</td></tr>
                        </tbody>
                    </table>
                </div>
                
                <div class="info-additional">
                    <div><i class="fas fa-chart-line"></i> Плотность зелени: ${(props.population_density_per_green_zone || 0).toFixed(2)} чел/га</div>
                    <div><i class="fas fa-leaf"></i> Покрытие парками: ${((((props.great_parks_area || 0) + (props.good_parks_area || 0) + (props.ok_parks_area || 0)) / (props.area || 1)) * 100).toFixed(1)}%</div>
                </div>
            </div>
        `;
        infoPanel.scrollTop = 0;
    }
    
    function showLightModeMessage() {
        if (!infoPanel) return;
        infoPanel.innerHTML = `
            <div class="info-placeholder">
                <i class="fas fa-lightbulb"></i>
                <p>Световая карта активна</p>
                <small>Кварталы скрыты для лучшей видимости</small>
                <br><br>
                <small>💡 Используйте поиск в левом верхнем углу</small>
            </div>
        `;
    }
    
    function showError(message) {
        if (!infoPanel) return;
        infoPanel.innerHTML = `
            <div class="info-placeholder">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Ошибка загрузки данных</p>
                <small>${message}</small>
            </div>
        `;
    }
    
    function showLoading() {
        if (loadingSpinner) {
            loadingSpinner.style.display = 'flex';
        }
    }
    
    function hideLoading() {
        if (loadingSpinner) {
            loadingSpinner.style.display = 'none';
        }
    }
    
    function showToast(message, duration = 3000) {
        // Простое уведомление (можно расширить)
        console.log('[Toast]', message);
        alert(message);
    }
    
    return {
        init,
        showDefaultPanel,
        showQuarterInfo,
        showLightModeMessage,
        showError,
        showLoading,
        hideLoading,
        showToast
    };
})();
