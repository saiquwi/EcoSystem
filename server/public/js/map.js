// Initialize map
let map;
let markers = [];
let currentCategoryFilter = 'all';      // фильтр по категории
let currentStatusFilter = 'all'; // фильтр по статусу
let currentUserId = null;
let waitingForLocation = false;  // Режим выбора местоположения
let selectedPhotos = [];  // Массив выбранных фото (File objects)
let tempFormData = {};  // Временное хранилище данных формы при выборе локации

// Category colors for markers
const categoryColors = {
    garbage: '#8B5A2B',
    water_pollution: '#3B82F6',
    air_pollution: '#9CA3AF',
    deforestation: '#10B981',
    illegal_dumping: '#EF4444',
    animal_rescue: '#F59E0B',
    other: '#6B7280'
};

// Initialize map when page loads
document.addEventListener('DOMContentLoaded', function() {
    getCurrentUser();
    initMap();
    loadProblems();
    setupEventListeners();
});

async function getCurrentUser() {
    try {
        const response = await fetch('/auth/api/me', { credentials: 'include' });
        if (response.ok) {
            const data = await response.json();
            window.currentUserId = data.user?.id;
        }
    } catch (error) {
        console.error('Error getting current user:', error);
    }
}

function initMap() {
    map = L.map('map').setView([51.505, -0.09], 13);
    
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; CartoDB',
        subdomains: 'abcd',
        maxZoom: 19
    }).addTo(map);
    
    map.on('click', function(e) {
        if (waitingForLocation) {
            setLocationAndClose(e.latlng.lat, e.latlng.lng);
        }
    });
}

function setLocationAndClose(lat, lng) {
    // Сохраняем текущие данные формы ПЕРЕД тем, как что-то менять
    saveFormData();
    
    // Сохраняем координаты
    document.getElementById('problemLat').value = lat;
    document.getElementById('problemLng').value = lng;
    
    // Обновляем отображение
    document.getElementById('locationInfo').innerHTML = `
        <p class="text-muted">📍 Selected: ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>
    `;
    
    // Выходим из режима выбора
    exitLocationSelectionMode();
    
    // Открываем форму обратно с сохраненными данными
    openModalWithSavedData();
}

function exitLocationSelectionMode() {
    waitingForLocation = false;
    
    // Убираем визуальный индикатор режима выбора
    const chooseBtn = document.getElementById('chooseLocationBtn');
    if (chooseBtn) {
        chooseBtn.classList.remove('active-location-mode');
        chooseBtn.textContent = '📍 Choose location on the map';
    }
    
    // Убираем специальный курсор с карты
    const mapContainer = document.getElementById('map');
    if (mapContainer) {
        mapContainer.style.cursor = '';
    }
}

function openModalWithSavedData() {
    const modal = document.getElementById('problemModal');
    modal.classList.add('show');
    
    // Восстанавливаем сохраненные данные формы
    if (tempFormData.title) {
        document.getElementById('problemTitle').value = tempFormData.title;
    }
    if (tempFormData.category) {
        document.getElementById('problemCategory').value = tempFormData.category;
    }
    if (tempFormData.description) {
        document.getElementById('problemDescription').value = tempFormData.description;
    }
    if (tempFormData.severity) {
        document.getElementById('problemSeverity').value = tempFormData.severity;
        document.getElementById('severityValue').textContent = tempFormData.severity;
    }
    if (tempFormData.photos) {
        selectedPhotos = tempFormData.photos;
        updatePhotoPreview();
        updateFileCount();
        enableFileInputIfNeeded();
    }
    
    console.log('Restored form data'); // для отладки
}

function saveFormData() {
    tempFormData = {
        title: document.getElementById('problemTitle').value,
        category: document.getElementById('problemCategory').value,
        description: document.getElementById('problemDescription').value,
        severity: document.getElementById('problemSeverity').value,
        photos: [...selectedPhotos]  // копия массива
    };
}

function clearFormData() {
    tempFormData = {};
    selectedPhotos = [];
    document.getElementById('problemTitle').value = '';
    document.getElementById('problemCategory').value = '';
    document.getElementById('problemDescription').value = '';
    document.getElementById('problemSeverity').value = 5;
    document.getElementById('severityValue').textContent = 5;
    document.getElementById('problemLat').value = '';
    document.getElementById('problemLng').value = '';
    document.getElementById('locationInfo').innerHTML = '<p class="text-muted">No location selected</p>';
    updatePhotoPreview();
    updateFileCount();
    enableFileInputIfNeeded();
}

async function loadProblems() {
    try {
        const url = `/problems?category=${currentCategoryFilter}&status=${currentStatusFilter}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to load');
        const problems = await response.json();
        displayProblemsOnMap(problems);
        displayProblemsList(problems);
    } catch (error) {
        console.error('Error loading problems:', error);
    }
}

function displayProblemsOnMap(problems) {
    markers.forEach(marker => map.removeLayer(marker));
    markers = [];
    
    problems.forEach(problem => {
        const marker = L.circleMarker([problem.latitude, problem.longitude], {
            radius: 10,
            fillColor: categoryColors[problem.category] || '#6B7280',
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map);
        
        marker.bindPopup(`
            <strong>${escapeHtml(problem.title)}</strong><br>
            Category: ${problem.category}<br>
            Status: ${problem.status}<br>
            Severity: ${problem.severity}/10<br>
            <button onclick="viewProblem(${problem.id})" class="popup-btn">View Details</button>
        `);
        
        marker.problemId = problem.id;
        markers.push(marker);
    });
}

function displayProblemsList(problems) {
    const container = document.getElementById('problemsContainer');
    
    if (!problems || problems.length === 0) {
        container.innerHTML = '<p class="empty-text">No problems found in this area</p>';
        return;
    }
    
    container.innerHTML = problems.map(problem => `
        <div class="problem-item" onclick="viewProblem(${problem.id})">
            <div class="problem-title">${escapeHtml(problem.title)}</div>
            <div class="problem-category">${problem.category}</div>
            <div class="problem-status">Status: ${problem.status}</div>
        </div>
    `).join('');
}

function updatePhotoPreview() {
    const container = document.getElementById('photoPreview');
    if (!container) return;
    
    container.innerHTML = '';
    
    selectedPhotos.forEach((photo, index) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const div = document.createElement('div');
            div.className = 'photo-preview-item';
            div.innerHTML = `
                <img src="${e.target.result}" alt="Preview">
                <button type="button" class="photo-remove" data-index="${index}">×</button>
            `;
            container.appendChild(div);
            
            // Добавляем обработчик удаления
            div.querySelector('.photo-remove').addEventListener('click', () => {
                removePhoto(index);
            });
        };
        reader.readAsDataURL(photo);
    });
}

function removePhoto(index) {
    selectedPhotos.splice(index, 1);
    updatePhotoPreview();
    updateFileCount();
    enableFileInputIfNeeded();
}

function updateFileCount() {
    const fileCountSpan = document.getElementById('fileCount');
    if (fileCountSpan) {
        fileCountSpan.textContent = `${selectedPhotos.length} / 5 files selected`;
    }
}

function enableFileInputIfNeeded() {
    const fileInput = document.getElementById('problemPhotos');
    const chooseBtn = document.getElementById('choosePhotosBtn');
    
    if (selectedPhotos.length >= 5) {
        if (fileInput) fileInput.disabled = true;
        if (chooseBtn) {
            chooseBtn.classList.add('disabled');
            chooseBtn.disabled = true;
        }
        document.getElementById('photoError').textContent = 'Maximum 5 photos reached';
    } else {
        if (fileInput) fileInput.disabled = false;
        if (chooseBtn) {
            chooseBtn.classList.remove('disabled');
            chooseBtn.disabled = false;
        }
        document.getElementById('photoError').textContent = '';
    }
}

function handleFileSelect(event) {
    const files = Array.from(event.target.files);
    const remainingSlots = 5 - selectedPhotos.length;
    
    if (files.length > remainingSlots) {
        document.getElementById('photoError').textContent = `Too many photos selected. Only ${remainingSlots} more allowed. Added first ${remainingSlots} photos.`;
        // Добавляем только первые remainingSlots фото
        for (let i = 0; i < remainingSlots; i++) {
            selectedPhotos.push(files[i]);
        }
    } else {
        selectedPhotos.push(...files);
        document.getElementById('photoError').textContent = '';
    }
    
    updatePhotoPreview();
    updateFileCount();
    enableFileInputIfNeeded();
    
    // Очищаем input, чтобы можно было снова выбрать те же файлы
    event.target.value = '';
}

let currentProblemId = null;

// Функция открытия деталей проблемы
async function viewProblem(problemId) {

    if (!window.currentUserId) {
        await getCurrentUser();
    }

    currentProblemId = problemId;
    const modal = document.getElementById('problemDetailsModal');
    const body = document.getElementById('problemDetailsBody');
    
    // Показываем загрузку
    body.innerHTML = '<div class="loading">Loading problem details...</div>';
    modal.classList.add('show');
    
    try {
        const response = await fetch(`/problems/${problemId}`);
        if (!response.ok) throw new Error('Failed to load problem');
        const problem = await response.json();
        renderProblemDetails(problem);
    } catch (error) {
        console.error('Error loading problem details:', error);
        body.innerHTML = '<div class="alert alert-error">Failed to load problem details</div>';
    }
}

// Рендер деталей проблемы
function renderProblemDetails(problem) {
    const body = document.getElementById('problemDetailsBody');
    
    // Определяем класс для категории
    const categoryClass = problem.category || 'other';

    const user = problem.current_user || {};
    const isAuthor = user.isAuthor;
    const isAssigned = user.isAssigned;
    const isAuthenticated = user.isAuthenticated;
    
    // Определяем статус
    const statusText = {
        'pending': 'Pending Confirmation',
        'confirmed': 'Confirmed',
        'in_progress': 'In Progress',
        'completed': 'Completed',
        'closed': 'Closed'
    }[problem.status] || problem.status;
    
    const statusClass = {
        'pending': 'status-pending',
        'confirmed': 'status-confirmed',
        'in_progress': 'status-in_progress',
        'completed': 'status-completed',
        'closed': 'status-closed'
    }[problem.status] || 'status-pending';
    
    // Проверяем, может ли пользователь подтвердить
    const canConfirm = problem.status === 'pending' && 
                       isAuthenticated && 
                       !isAuthor && 
                       !user.hasConfirmed;
    
    // Проверяем, может ли пользователь взять в работу
    const canTake = (problem.status === 'pending' || problem.status === 'confirmed') && 
                    isAuthenticated &&
                    !problem.assigned_to_user;
    
    // Проверяем, может ли пользователь удалить
    const canDelete = (problem.status === 'pending' || problem.status === 'confirmed') && 
                      isAuthor;
    
    // Проверяем, может ли пользователь завершить
    const canComplete = problem.status === 'in_progress' && isAssigned;
    
    // Проверяем, может ли пользователь подтвердить решение
    const canConfirmResolution = problem.status === 'completed' && 
                                 isAuthenticated &&
                                 !isAuthor && 
                                 !isAssigned &&
                                 !user.hasConfirmedResolution;
    
    body.innerHTML = `
        <div class="problem-detail-header">
            <h2 class="problem-detail-title">${escapeHtml(problem.title)}</h2>
            <div class="problem-detail-meta">
                <span class="problem-detail-meta-item">
                    📅 ${new Date(problem.created_at).toLocaleDateString()}
                </span>
                <span class="problem-detail-meta-item">
                    👤 ${escapeHtml(problem.author_name || 'Anonymous')}
                </span>
                <span class="problem-detail-category ${categoryClass}">
                    ${escapeHtml(problem.category || 'Other')}
                </span>
                <span class="problem-detail-status ${statusClass}">
                    ${statusText}
                </span>
            </div>
        </div>
        
        <div class="problem-detail-description">
            <strong>Description:</strong>
            <p>${escapeHtml(problem.description) || 'No description provided'}</p>
        </div>
        
        <div class="problem-detail-location">
            <strong>📍 Location:</strong>
            <p>Lat: ${problem.latitude.toFixed(6)}, Lng: ${problem.longitude.toFixed(6)}</p>
        </div>
        
        <div class="problem-detail-stats">
            <div class="problem-detail-stat">
                <div class="problem-detail-stat-value">${problem.confirmations || 0}</div>
                <div class="problem-detail-stat-label">Confirmations</div>
            </div>
            <div class="problem-detail-stat">
                <div class="problem-detail-stat-value">${problem.severity || 1}/10</div>
                <div class="problem-detail-stat-label">Severity</div>
            </div>
        </div>
        
        ${problem.confirmations_list && problem.confirmations_list.length > 0 ? `
            <div class="confirmations-list">
                <strong>Confirmed by:</strong>
                ${problem.confirmations_list.map(c => `
                    <div class="confirmation-item">
                        <div class="confirmation-avatar">${(c.name || 'U').charAt(0).toUpperCase()}</div>
                        <div class="confirmation-name">${escapeHtml(c.name || 'Unknown')}</div>
                        <div class="confirmation-date">${new Date(c.created_at).toLocaleDateString()}</div>
                    </div>
                `).join('')}
            </div>
        ` : ''}

        ${problem.photos_list && problem.photos_list.length > 0 ? `
            <div class="problem-detail-photos">
                <strong>Photos (${problem.photos_list.length}):</strong>
                <div class="photos-grid">
                    ${problem.photos_list.map((photo, idx) => `
                        <div class="photo-item" data-photos='${JSON.stringify(problem.photos_list)}' data-index="${idx}">
                            <img src="${photo}" alt="Problem photo">
                        </div>
                    `).join('')}
                </div>
            </div>
        ` : ''}
        
        <div class="problem-actions">
            ${canConfirm ? `<button class="btn btn-primary" onclick="confirmProblem(${problem.id})">Confirm Problem</button>` : ''}
            ${canTake ? `<button class="btn btn-secondary" onclick="takeProblem(${problem.id})">Take in work</button>` : ''}
            ${canComplete ? `<button class="btn btn-success" onclick="completeProblem(${problem.id})">Complete Problem</button>` : ''}
            ${canConfirmResolution ? `<button class="btn btn-primary" onclick="confirmResolution(${problem.id})">Confirm Resolution</button>` : ''}
            ${canDelete ? `<button class="btn btn-danger" onclick="deleteProblem(${problem.id})">Delete problem</button>` : ''}
            ${problem.assigned_to_user && !isAssigned && problem.status === 'in_progress' ? `<div class="alert alert-info">👤 Assigned to: ${escapeHtml(problem.assigned_to_name || 'Someone')}</div>` : ''}
        </div>
    `;
}

// Функция подтверждения проблемы
async function confirmProblem(problemId) {
    try {
        const response = await fetch(`/problems/${problemId}/confirm`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            alert('Problem confirmed successfully!');
            // Обновляем детали
            viewProblem(problemId);
            // Обновляем карту
            loadProblems();
        } else {
            const error = await response.json();
            alert('Error: ' + (error.error || 'Failed to confirm'));
        }
    } catch (error) {
        console.error('Error confirming problem:', error);
        alert('Failed to confirm problem');
    }
}

// Функция взятия проблемы в работу
async function takeProblem(problemId) {
    try {
        const response = await fetch(`/problems/${problemId}/take`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            alert('Problem taken successfully! You are now working on it.');
            // Обновляем детали
            viewProblem(problemId);
            // Обновляем карту
            loadProblems();
        } else {
            const error = await response.json();
            alert('Error: ' + (error.error || 'Failed to take problem'));
        }
    } catch (error) {
        console.error('Error taking problem:', error);
        alert('Failed to take problem');
    }
}

async function completeProblem(problemId) {
    try {
        const response = await fetch(`/problems/${problemId}/complete`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (response.ok) {
            alert('Problem completed successfully! Waiting for confirmations.');
            viewProblem(problemId);
            loadProblems();
        } else {
            const error = await response.json();
            alert('Error: ' + (error.error || 'Failed to complete problem'));
        }
    } catch (error) {
        console.error('Error completing problem:', error);
        alert('Failed to complete problem');
    }
}

async function confirmResolution(problemId) {
    try {
        const response = await fetch(`/problems/${problemId}/confirm-resolution`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'include'
        });
        
        if (response.ok) {
            const result = await response.json();
            alert('Resolution confirmed!');
            viewProblem(problemId);
            loadProblems();
        } else {
            const error = await response.json();
            alert('Error: ' + (error.error || 'Failed to confirm resolution'));
        }
    } catch (error) {
        console.error('Error confirming resolution:', error);
        alert('Failed to confirm resolution');
    }
}

async function deleteProblem(problemId) {
    const isConfirmed = confirm('⚠️ Are you sure you want to delete this problem?\n\nThis action cannot be undone!');
    
    if (!isConfirmed) {
        return;
    }
    
    try {
        const response = await fetch(`/problems/${problemId}`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            alert('Problem deleted successfully!');
            
            // Закрываем модальное окно
            const modal = document.getElementById('problemDetailsModal');
            modal.classList.remove('show');
            
            // Обновляем карту
            loadProblems();
        } else {
            const error = await response.json();
            alert('Error: ' + (error.error || 'Failed to delete problem'));
        }
    } catch (error) {
        console.error('Error deleting problem:', error);
        alert('Failed to delete problem');
    }
}

function setupEventListeners() {
    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebarToggle');
    const sidebar = document.querySelector('.map-sidebar');
    
    if (sidebarToggle && sidebar) {
        sidebarToggle.addEventListener('click', () => {
            sidebar.classList.toggle('collapsed');
        });
    }
    
    // Modal
    const addProblemBtn = document.getElementById('addProblemBtn');
    const modal = document.getElementById('problemModal');
    const closeModal = document.getElementById('closeModal');
    
    if (addProblemBtn) {
        addProblemBtn.addEventListener('click', () => {
            clearFormData();
            modal.classList.add('show');
        });
    }
    
    if (closeModal) {
        closeModal.addEventListener('click', () => {
            modal.classList.remove('show');
            exitLocationSelectionMode();
            clearFormData();
        });
    }
    
    // Закрытие по клику вне модалки
    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.classList.remove('show');
            exitLocationSelectionMode();
            clearFormData();
        }
    });
    
    // Severity slider
    const severitySlider = document.getElementById('problemSeverity');
    const severityValue = document.getElementById('severityValue');
    
    if (severitySlider) {
        severitySlider.addEventListener('input', (e) => {
            severityValue.textContent = e.target.value;
        });
    }
    
    // Category filter buttons
    const categoryFilterBtns = document.querySelectorAll('#categoryFilterButtons .filter-btn');
    categoryFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            categoryFilterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentCategoryFilter = btn.dataset.category;
            loadProblems();
        });
    });

    // Status filter buttons
    const statusFilterBtns = document.querySelectorAll('#statusFilterButtons .filter-btn');
    statusFilterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            statusFilterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentStatusFilter = btn.dataset.status;
            loadProblems();
        });
    });
    
    const chooseLocationBtn = document.getElementById('chooseLocationBtn');
    
    if (chooseLocationBtn) {
        chooseLocationBtn.addEventListener('click', () => {
            // Сохраняем текущие данные формы
            saveFormData();
            
            // Закрываем модальное окно
            modal.classList.remove('show');
            
            // Включаем режим выбора местоположения
            waitingForLocation = true;
            
            // Визуальный индикатор
            chooseLocationBtn.classList.add('active-location-mode');
            chooseLocationBtn.textContent = '📍 Click on the map to select location...';
            
            // Меняем курсор на карте
            const mapContainer = document.getElementById('map');
            if (mapContainer) {
                mapContainer.style.cursor = 'crosshair';
            }
        });
    }
    
    const choosePhotosBtn = document.getElementById('choosePhotosBtn');
    const fileInput = document.getElementById('problemPhotos');
    
    if (choosePhotosBtn && fileInput) {
        choosePhotosBtn.addEventListener('click', () => {
            fileInput.click();
        });
        
        fileInput.addEventListener('change', handleFileSelect);
    }
    
    const problemForm = document.getElementById('problemForm');
    
    if (problemForm) {
        problemForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const title = document.getElementById('problemTitle').value;
        const category = document.getElementById('problemCategory').value;
        const lat = document.getElementById('problemLat').value;
        const lng = document.getElementById('problemLng').value;
        
        if (!title || !category || !lat || !lng) {
            alert('Please fill in all required fields (Title, Category, and Location)');
            return;
        }
        
        // Используем FormData для отправки файлов
        const formData = new FormData();
        formData.append('title', title);
        formData.append('category', category);
        formData.append('description', document.getElementById('problemDescription').value);
        formData.append('severity', document.getElementById('problemSeverity').value);
        formData.append('latitude', lat);
        formData.append('longitude', lng);
        
        // Добавляем фото
        selectedPhotos.forEach(photo => {
            formData.append('photos', photo);
        });
        
        try {
            const response = await fetch('/problems', {
                method: 'POST',
                body: formData  // Не добавляем Content-Type, браузер сам установит multipart/form-data
            });
            
            if (response.ok) {
                const result = await response.json();
                modal.classList.remove('show');
                clearFormData();
                loadProblems();
                alert('Problem reported successfully!');
            } else {
                const error = await response.json();
                alert('Error: ' + (error.error || 'Failed to report problem'));
            }
        } catch (error) {
            console.error('Error submitting problem:', error);
            alert('Failed to submit problem');
        }
    });
    }

    // Problem Details Modal
    const detailsModal = document.getElementById('problemDetailsModal');
    const closeDetailsModal = document.getElementById('closeDetailsModal');

    if (closeDetailsModal) {
        closeDetailsModal.addEventListener('click', () => {
            detailsModal.classList.remove('show');
        });
    }

    // Закрытие по клику вне модалки
    window.addEventListener('click', (e) => {
        if (e.target === detailsModal) {
            detailsModal.classList.remove('show');
        }
    });
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Try to get user's location
if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
        (position) => {
            map.setView([position.coords.latitude, position.coords.longitude], 13);
        },
        () => {
            console.log('Could not get user location');
        }
    );
}