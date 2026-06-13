window.UI = (function() {
    let infoPanel = null;
    let loadingSpinner, loadingText;
    let currentInfoType = null; // 'quarter', 'park', null
    
    function init() {
        loadingSpinner = document.getElementById('loading');
        loadingText = loadingSpinner ? loadingSpinner.querySelector('.loading-text') : null;
        if (!loadingText && loadingSpinner) {
            loadingText = document.createElement('div');
            loadingText.className = 'loading-text';
            loadingSpinner.appendChild(loadingText);
        }
    }
    
    // Создание панели информации
    function createInfoPanel() {
        // Если панель уже существует, удаляем её
        if (infoPanel && infoPanel.parentNode) {
            infoPanel.parentNode.removeChild(infoPanel);
        }
        
        // Создаём новую панель
        infoPanel = document.createElement('div');
        infoPanel.id = 'info-panel';
        infoPanel.className = 'info-panel';
        document.body.appendChild(infoPanel);
        
        return infoPanel;
    }
    
    // Удаление панели информации
    function removeInfoPanel() {
        if (infoPanel && infoPanel.parentNode) {
            infoPanel.parentNode.removeChild(infoPanel);
            infoPanel = null;
        }
        currentInfoType = null;
    }
    
    // Скрытие панели (удаление из DOM)
    function hideInfoPanel() {
        removeInfoPanel();
    }
    
    function showDefaultPanel() {
        createInfoPanel();
        currentInfoType = null;
        infoPanel.innerHTML = `
            <div class="info-placeholder">
                <i class="fas fa-map-marker-alt"></i>
                <p>Кликните по кварталу, чтобы увидеть подробную информацию</p>
                <br>
                <small>💡 Используйте поиск в левом верхнем углу</small>
                <br>
                <small>🔘 Включайте слои парков и дорог через панель слева</small>
                <button class="close-info-btn" style="margin-top: 15px; background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer; font-size: 12px;">
                    <i class="fas fa-times"></i> Закрыть
                </button>
            </div>
        `;
        
        // Добавляем обработчик закрытия
        const closeBtn = infoPanel.querySelector('.close-info-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeInfoPanel();
            });
        }
    }
    
    function showQuarterInfo(props) {
        createInfoPanel();
        currentInfoType = 'quarter';
        
        const quality = props.calculated_quality;
        const qualityText = Utils.getQualityText(quality);
        const totalGreenArea = (props.great_parks_area || 0) + (props.good_parks_area || 0) + (props.ok_parks_area || 0);
        
        infoPanel.innerHTML = `
            <div class="info-details">
                <div class="info-title">
                    <i class="fas fa-building"></i> 
                    Квартал ${props.quarter_id || props.id || 'N/A'}
                    <button class="close-info-btn" style="float: right; background: none; border: none; font-size: 20px; cursor: pointer; color: #999;">&times;</button>
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
                    <div class="total-green-area">
                        <i class="fas fa-leaf"></i> Общая площадь парков: <strong>${Math.round(totalGreenArea).toLocaleString()} м²</strong>
                    </div>
                    <table class="parks-table">
                        <thead>
                            <tr><th>Тип</th><th>Кол-во</th><th>Площадь (м²)</th></tr>
                        </thead>
                        <tbody>
                            <tr><td>🏆 Отличные</td><td>${props.great_parks_count || 0}</td><td>${Math.round(props.great_parks_area || 0).toLocaleString()}</td></tr>
                            <tr><td>✅ Хорошие</td><td>${props.good_parks_count || 0}</td><td>${Math.round(props.good_parks_area || 0).toLocaleString()}</td></tr>
                            <tr><td>🌿 Обычные</td><td>${props.ok_parks_count || 0}</td><td>${Math.round(props.ok_parks_area || 0).toLocaleString()}</td></tr>
                        </tbody>
                    </table>
                </div>
                
                <div class="info-additional">
                    <div><i class="fas fa-chart-line"></i> Плотность зелени: ${(props.population_density_per_green_zone || 0).toFixed(2)} чел/га</div>
                    <div><i class="fas fa-percent"></i> Покрытие парками: ${((totalGreenArea / (props.area || 1)) * 100).toFixed(1)}%</div>
                </div>
            </div>
        `;
        
        // Добавляем обработчик закрытия
        const closeBtn = infoPanel.querySelector('.close-info-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeInfoPanel();
            });
        }
        
        infoPanel.scrollTop = 0;
    }
    
    function showParkInfo(props) {
        createInfoPanel();
        currentInfoType = 'park';
        const ndvi = props.ndvi ? props.ndvi.toFixed(3) : '?';
        const area = props.area ? Math.round(props.area).toLocaleString() : '?';
        infoPanel.innerHTML = `
            <div class="info-details">
                <div class="info-title">
                    <i class="fas fa-tree"></i> 
                    Зелёная зона
                    <button class="close-info-btn" style="float: right; background: none; border: none; font-size: 20px; cursor: pointer; color: #999;">&times;</button>
                </div>
                <div class="info-stats">
                    <div class="info-stat-card">
                        <div class="info-stat-number">${ndvi}</div>
                        <div class="info-stat-label">NDVI индекс</div>
                    </div>
                    <div class="info-stat-card">
                        <div class="info-stat-number">${area} м²</div>
                        <div class="info-stat-label">Площадь</div>
                    </div>
                </div>
                <div class="info-additional">
                    <small>Кликните по другому объекту для просмотра информации</small>
                </div>
            </div>
        `;
        
        // Добавляем обработчик закрытия
        const closeBtn = infoPanel.querySelector('.close-info-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeInfoPanel();
            });
        }
    }
    
    function showLightModeMessage() {
        createInfoPanel();
        currentInfoType = null;
        infoPanel.innerHTML = `
            <div class="info-placeholder">
                <i class="fas fa-lightbulb"></i>
                <p>Световая карта активна</p>
                <small>Кварталы скрыты для лучшей видимости</small>
                <br><br>
                <small>💡 Используйте поиск в левом верхнем углу</small>
                <br>
                <small>🔘 Включите "Оценка кварталов" в панели инструментов, чтобы показать их снова</small>
                <button class="close-info-btn" style="margin-top: 15px; background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer; font-size: 12px;">
                    <i class="fas fa-times"></i> Закрыть
                </button>
            </div>
        `;
        
        const closeBtn = infoPanel.querySelector('.close-info-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeInfoPanel();
            });
        }
    }
    
    function showError(message) {
        createInfoPanel();
        currentInfoType = null;
        infoPanel.innerHTML = `
            <div class="info-placeholder">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Ошибка загрузки данных</p>
                <small>${message}</small>
                <br><br>
                <small>Попробуйте переключить город или обновить страницу</small>
                <button class="close-info-btn" style="margin-top: 15px; background: #dc3545; color: white; border: none; padding: 8px 16px; border-radius: 20px; cursor: pointer; font-size: 12px;">
                    <i class="fas fa-times"></i> Закрыть
                </button>
            </div>
        `;
        
        const closeBtn = infoPanel.querySelector('.close-info-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                removeInfoPanel();
            });
        }
        
        console.error('[UI Error]', message);
    }
    
    // Очистка/закрытие панели (для совместимости с map.js)
    function clearInfoPanel() {
        removeInfoPanel();
    }
    
    function showLoading(message = 'Загрузка данных...') {
        if (loadingSpinner) {
            if (loadingText) loadingText.textContent = message;
            loadingSpinner.style.display = 'flex';
        }
    }
    
    function hideLoading() {
        if (loadingSpinner) {
            loadingSpinner.style.display = 'none';
            if (loadingText) loadingText.textContent = '';
        }
    }
    
    function showToast(message, duration = 3000) {
        const toast = document.createElement('div');
        toast.className = 'custom-toast';
        toast.innerHTML = `
            <i class="fas fa-info-circle"></i>
            <span>${message}</span>
        `;
        toast.style.cssText = `
            position: fixed;
            bottom: 80px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0,0,0,0.85);
            color: white;
            padding: 10px 20px;
            border-radius: 30px;
            font-size: 14px;
            z-index: 10000;
            display: flex;
            align-items: center;
            gap: 8px;
            backdrop-filter: blur(4px);
            animation: fadeInOut ${duration}ms ease forwards;
            pointer-events: none;
            white-space: nowrap;
        `;
        
        if (!document.querySelector('#toast-styles')) {
            const style = document.createElement('style');
            style.id = 'toast-styles';
            style.textContent = `
                @keyframes fadeInOut {
                    0% { opacity: 0; transform: translateX(-50%) translateY(10px); }
                    15% { opacity: 1; transform: translateX(-50%) translateY(0); }
                    85% { opacity: 1; transform: translateX(-50%) translateY(0); }
                    100% { opacity: 0; transform: translateX(-50%) translateY(-10px); }
                }
            `;
            document.head.appendChild(style);
        }
        
        document.body.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, duration);
        
        console.log('[Toast]', message);
    }
    
    return {
        init,
        clearInfoPanel,
        hideInfoPanel,
        showDefaultPanel,
        showQuarterInfo,
        showParkInfo,
        showLightModeMessage,
        showError,
        showLoading,
        hideLoading,
        showToast
    };
})();