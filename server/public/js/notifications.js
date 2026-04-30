function showNotification(message, type) {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <span class="notification-message">${escapeHtml(message)}</span>
    `;
    
    // Стили
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.zIndex = '1000';
    notification.style.padding = '12px 20px';
    notification.style.borderRadius = '8px';
    notification.style.fontSize = '14px';
    notification.style.fontWeight = '500';
    notification.style.display = 'flex';
    notification.style.alignItems = 'center';
    notification.style.gap = '10px';
    notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
    
    if (type === 'success') {
        notification.style.backgroundColor = '#D1FAE5';
        notification.style.color = '#059669';
        notification.style.borderLeft = '4px solid #10B981';
    } else if (type === 'warning') {
        notification.style.backgroundColor = '#FEF3C7';
        notification.style.color = '#D97706';
        notification.style.borderLeft = '4px solid #F59E0B';
    } else {
        notification.style.backgroundColor = '#FEE2E2';
        notification.style.color = '#DC2626';
        notification.style.borderLeft = '4px solid #EF4444';
    }
    
    document.body.appendChild(notification);
    
    // Автоматическое исчезновение через 3 секунды
    setTimeout(() => {
        if (notification && notification.remove) {
            notification.remove();
        }
    }, 3000);
}

// Функция экранирования HTML
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Проверка параметров URL при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('success') === 'true') {
        showNotification('Operation completed successfully!', 'success');
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
    }
    
    if (urlParams.get('error')) {
        showNotification(decodeURIComponent(urlParams.get('error')), 'error');
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
    }
});

// Глобальная функция для вызова из других скриптов
window.showNotification = showNotification;