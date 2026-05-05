// Initialize map
let map;
let ProblemMarkers = [];
let currentCategoryFilter = 'all';      // фильтр по категории
let currentProblemStatusFilter = 'all'; // фильтр по статусу
let currentUserId = null;
let waitingForLocation = false;  // Режим выбора местоположения
let selectedPhotos = [];  // Массив выбранных фото (File objects)
let tempFormData = {};  // Временное хранилище данных формы при выборе локации
let currentContentType = 'problems'; // 'problems' or 'events'
let eventMarkers = [];
let currentEventFilter = 'all';
let currentEventStatusFilter = 'all';

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

function getCurrentUser() {
    const appData = document.getElementById('app-data');
    if (appData) {
        window.currentUserId = appData.dataset.currentUserId || null;
        window.isAuthenticated = appData.dataset.isAuthenticated === 'true';
    }
}

getCurrentUser();

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

    map.on('click', function(e) {
        if (waitingForEventLocation) {
            const lat = e.latlng.lat;
            const lng = e.latlng.lng;
            
            document.getElementById('eventLat').value = lat;
            document.getElementById('eventLng').value = lng;
            document.getElementById('eventLocationInfo').innerHTML = `<p class="text-muted">📍 Selected: ${lat.toFixed(6)}, ${lng.toFixed(6)}</p>`;

            fetch(`/organizations/api/timezone-offset?lat=${lat}&lng=${lng}`)
            .then(response => response.json())
            .then(data => {
                if (data.offset !== undefined) {
                    const sign = data.offset >= 0 ? '+' : '';
                    const tzInfo = document.getElementById('eventTimezoneInfo');
                    if (tzInfo) {
                        tzInfo.innerHTML = `UTC${sign}${data.offset}`;
                        window.selectedEventOffset = data.offset;
                    }
                }
            })
            .catch(err => console.error('Error getting timezone:', err));
            
            waitingForEventLocation = false;
            chooseEventLocationBtn.textContent = '📍 Choose location on the map';
            chooseEventLocationBtn.classList.remove('active-location-mode');
            document.getElementById('map').style.cursor = '';
            eventModal.classList.add('show');
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
        const url = `/problems?category=${currentCategoryFilter}&status=${currentProblemStatusFilter}`;
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
    ProblemMarkers.forEach(marker => map.removeLayer(marker));
    ProblemMarkers = [];
    
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
        ProblemMarkers.push(marker);
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
            <div class="problem-meta">
                <span class="problem-category">${problem.category}</span>
                <span class="problem-status">${problem.status}</span>
            </div>
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

        if (e.target === eventModal) {
            closeEventModalFunc();
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
            currentProblemStatusFilter = btn.dataset.status;
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

const eventModal = document.getElementById('eventModal');
const addEventBtn = document.getElementById('addEventBtn');
const closeEventModal = document.getElementById('closeEventModal');
const cancelEventModalBtn = document.getElementById('cancelEventModalBtn');
const chooseEventLocationBtn = document.getElementById('chooseEventLocationBtn');
const eventForm = document.getElementById('eventForm');
let waitingForEventLocation = false;

async function loadUserOrganizations() {
    try {
        const response = await fetch('/organizations/api/user-organizations');
        const orgs = await response.json();
        
        const select = document.getElementById('eventOrganization');
        select.innerHTML = '<option value="">Select organization...</option>';
        orgs.forEach(org => {
            const option = document.createElement('option');
            option.value = org.id;
            option.textContent = org.name;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading organizations:', error);
    }
}

function openEventModal() {
    loadUserOrganizations();
    eventModal.classList.add('show');
}

function closeEventModalFunc() {
    eventModal.classList.remove('show');
    eventForm.reset();
    document.getElementById('eventLocationInfo').innerHTML = '<p class="text-muted">No location selected</p>';
    document.getElementById('eventLat').value = '';
    document.getElementById('eventLng').value = '';
}

if (addEventBtn) addEventBtn.addEventListener('click', openEventModal);
if (closeEventModal) closeEventModal.addEventListener('click', closeEventModalFunc);
if (cancelEventModalBtn) cancelEventModalBtn.addEventListener('click', closeEventModalFunc);

if (chooseEventLocationBtn) {
    chooseEventLocationBtn.addEventListener('click', () => {
        saveFormData();
        eventModal.classList.remove('show');
        waitingForEventLocation = true;
        chooseEventLocationBtn.classList.add('active-location-mode');
        chooseEventLocationBtn.textContent = '📍 Click on the map...';
        const mapContainer = document.getElementById('map');
        if (mapContainer) {
            mapContainer.style.cursor = 'crosshair';
        }
    });
}

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && eventModal && eventModal.classList.contains('show')) {
        closeEventModalFunc();
    }
});

if (eventForm) {
    eventForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const eventData = {
            title: document.getElementById('eventTitle').value,
            description: document.getElementById('eventDescription').value,
            organizationId: document.getElementById('eventOrganization').value,
            eventDate: document.getElementById('eventDate').value,
            eventTime: document.getElementById('eventTime').value,
            maxVolunteers: document.getElementById('eventMaxVolunteers').value || null,
            latitude: document.getElementById('eventLat').value,
            longitude: document.getElementById('eventLng').value
        };
        
        if (!eventData.title || !eventData.organizationId || !eventData.eventDate || !eventData.eventTime || !eventData.latitude || !eventData.longitude) {
            showNotification('Please fill all required fields and select location', 'error');
            return;
        }
        
        try {
            const response = await fetch('/organizations/events', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(eventData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                showNotification('Event created successfully!', 'success');
                closeEventModalFunc();
                loadEvents();
            } else {
                showNotification(result.error || 'Failed to create event', 'error');
            }
        } catch (error) {
            console.error('Error creating event:', error);
            showNotification('Failed to create event', 'error');
        }
    });
}

async function loadEvents() {
    console.log('Loading events with filter:', currentEventStatusFilter);
    try {
        let url = '/organizations/api/events?';
        const params = [];
        
        if (currentEventFilter === 'following') {
            params.push(`organizationFilter=following`);
        }
        if (currentEventStatusFilter !== 'all') {
            params.push(`status=${currentEventStatusFilter}`);
        }
        
        url += params.join('&');
        console.log('Fetching URL:', url);
        
        const response = await fetch(url);
        const events = await response.json();
        console.log('Events received:', events.length);
        displayEventsOnMap(events);
        displayEventsList(events);
    } catch (error) {
        console.error('Error loading events:', error);
    }
}

function displayEventsOnMap(events) {
    eventMarkers.forEach(marker => map.removeLayer(marker));
    eventMarkers = [];
    
    events.forEach(event => {
        const marker = L.circleMarker([event.latitude, event.longitude], {
            radius: 10,
            fillColor: '#F59E0B', // оранжевый цвет для ивентов
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.8
        }).addTo(map);
        
        marker.bindPopup(`
            <strong>${escapeHtml(event.title)}</strong><br>
            Organization: ${escapeHtml(event.organization_name)}<br>
            Date: ${new Date(event.event_date).toLocaleDateString('ru-RU')}<br>
            Volunteers: ${event.current_volunteers || 0} ${event.max_volunteers ? `/ ${event.max_volunteers}` : ''}<br>
            Status: ${event.status}<br>
            <button onclick="viewEvent(${event.id})" class="popup-btn">View Details</button>
        `);
        
        marker.eventId = event.id;
        eventMarkers.push(marker);
    });
}

function displayEventsList(events) {
    const container = document.getElementById('eventsList');
    if (!container) return;
    
    if (!events || events.length === 0) {
        container.innerHTML = '<p class="empty-text">No events found</p>';
        return;
    }
    
    container.innerHTML = events.map(event => `
        <div class="event-item" onclick="viewEvent(${event.id})">
            <div class="event-title">${escapeHtml(event.title)}</div>
            <div class="event-meta">
                <span class="event-org">${escapeHtml(event.organization_name)}</span>
                <span class="event-date">${new Date(event.event_date).toLocaleDateString('ru-RU')}</span>
            </div>
        </div>
    `).join('');
}

async function viewEvent(eventId) {
    try {
        const response = await fetch(`/organizations/events/${eventId}`);
        const event = await response.json();
        
        if (response.ok) {
            renderEventDetails(event);
        }
    } catch (error) {
        console.error('Error loading event details:', error);
    }
}

function renderEventDetails(event) {
    let modal = document.getElementById('eventDetailsModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'eventDetailsModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content modal-large">
                <div class="modal-header">
                    <h3 id="eventDetailTitle">Event Details</h3>
                    <button class="modal-close" id="closeEventDetailsModal">&times;</button>
                </div>
                <div class="modal-body" id="eventDetailsBody"></div>
            </div>
        `;
        document.body.appendChild(modal);
        
        document.getElementById('closeEventDetailsModal').addEventListener('click', () => {
            modal.classList.remove('show');
        });
        
        window.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('show');
        });
    }
    
    const body = document.getElementById('eventDetailsBody');
    const isJoined = event.is_joined;
    const isStaff = event.is_staff;
    const canJoin = !isJoined && event.status === 'planned';
    const canCancel = isJoined && event.status !== 'completed' && event.status !== 'cancelled';

    console.log("renderEventDetails event_date: ", event.event_date);

    const { formatted: formattedDateTime, offsetText } = formatEventDateTime(event.event_date, event.timezone_offset);
    
    const parts = formattedDateTime.split(' ');
    const [day, month, year] = parts[0].split('.');
    let localDate = `${year}-${month}-${day}`; 
    let localTime = parts[1];

    const statusClass = {
        'planned': 'status-planned',
        'ongoing': 'status-ongoing',
        'completed': 'status-completed',
        'cancelled': 'status-cancelled'
    }[event.status] || 'status-planned';
    
    const statusTextMap = {
        'planned': 'Planned',
        'ongoing': 'Ongoing',
        'completed': 'Completed',
        'cancelled': 'Cancelled'
    };
    const statusTextValue = statusTextMap[event.status] || event.status;
    
    body.innerHTML = `
        <div class="event-detail-header">
            <h2>${escapeHtml(event.title)}</h2>
            <div class="event-detail-meta">
                <span>${escapeHtml(event.organization_name)}</span>
            </div>
        </div>
        <div class="event-detail-description">
            <p><strong>Description:</strong> ${escapeHtml(event.description) || 'No description'}</p>
        </div>
        <div class="event-detail-stats">
            <div>👥 Volunteers: ${event.current_volunteers || 0} ${event.max_volunteers ? `/ ${event.max_volunteers}` : ''}</div>
            <div>📍 Location: ${event.latitude.toFixed(6)}, ${event.longitude.toFixed(6)}</div>
        </div>
        ${isStaff ? `
            <div class="event-date-section">
                <div class="date-update">
                    <input type="date" id="eventDateInput" class="form-control" value="${localDate}" style="width: auto;">
                    <input type="time" id="eventTimeInput" class="form-control" value="${localTime}" step="60" style="width: auto;">
                    <input type="hidden" id="eventTimezoneOffset" value="${event.timezone_offset}">
                    <span class="timezone-note">(${offsetText})</span>
                    <button id="updateEventDateBtn" class="btn btn-primary btn-small">Update Date</button>
                </div>
            </div>
            <div class="event-status-section">
                <div class="status-update">
                    <select id="eventStatusSelect" class="form-control">
                        ${getStatusOptions(event.status, event.event_date)}
                    </select>
                    <button id="updateEventStatusBtn" class="btn btn-primary btn-small">Update Status</button>
                </div>
            </div>
        ` : `
            <div class="event-info-row">
                <div class="event-info-item">
                    <strong>Date & Time:</strong> ${formattedDateTime} (${offsetText})
                </div>
                <div class="event-info-item">
                    <strong>Status:</strong> <span class="event-status ${statusClass}">${statusTextValue}</span>
                </div>
            </div>
        `}
        <div class="event-actions">
            ${canJoin ? `<button class="btn btn-primary" onclick="joinEvent(${event.id})">Join Event</button>` : ''}
            ${canCancel ? `<button class="btn btn-danger" onclick="cancelJoinEvent(${event.id})">Cancel Participation</button>` : ''}
            ${event.status === 'cancelled' ? `<div class="alert alert-warning">This event has been cancelled</div>` : ''}
        </div>
        ${isStaff ? `
            <div class="event-participants-section">
                <h4>Participants (${event.current_volunteers || 0})</h4>
                <div id="participantsList" class="participants-list">
                    <div class="loading">Loading...</div>
                </div>
            </div>
        ` : ''}
    `;

    if (isStaff) {
        const updateStatusBtn = document.getElementById('updateEventStatusBtn');
        if (updateStatusBtn) {
            const newUpdateStatusBtn = updateStatusBtn.cloneNode(true);
            updateStatusBtn.parentNode.replaceChild(newUpdateStatusBtn, updateStatusBtn);
            newUpdateStatusBtn.addEventListener('click', async () => {
                const newStatus = document.getElementById('eventStatusSelect').value;
                await updateEventStatus(event.id, newStatus);
            });
        }

        const updateDateBtn = document.getElementById('updateEventDateBtn');
        if (updateDateBtn) {
            const newUpdateDateBtn = updateDateBtn.cloneNode(true);
            updateDateBtn.parentNode.replaceChild(newUpdateDateBtn, updateDateBtn);
            newUpdateDateBtn.addEventListener('click', async () => {
                const newDate = document.getElementById('eventDateInput').value;
                if (!newDate) {
                    showNotification('Please select a date', 'error');
                    return;
                }
                await updateEventDate(event.id, newDate);
            });
        }

        loadParticipants(event.id);
    }
    
    modal.classList.add('show');
}

function isEventDatePassed(eventDateUTC) {
    const nowUTC = new Date();
    const eventDate = new Date(eventDateUTC);
    return eventDate < nowUTC;
}

function getStatusOptions(currentStatus, eventDate) {
    const isPassed = isEventDatePassed(eventDate);
    
    let options = '';
    
    switch (currentStatus) {
        case 'planned':
            options += `<option value="planned" selected>Planned</option>`;
            if (isPassed) {
                options += `<option value="ongoing">Ongoing</option>`;
            }
            options += `<option value="cancelled">Cancelled</option>`;
            break;
            
        case 'ongoing':
            options += `<option value="ongoing" selected>Ongoing</option>`;
            options += `<option value="completed">Completed</option>`;
            options += `<option value="cancelled">Cancelled</option>`;
            break;
            
        case 'completed':
            options += `<option value="completed" selected>Completed</option>`;
            break;
            
        case 'cancelled':
            options += `<option value="planned">Planned</option>`;
            options += `<option value="cancelled" selected>Cancelled</option>`;
            break;
            
        default:
            options += `<option value="planned">Planned</option>`;
            options += `<option value="ongoing">Ongoing</option>`;
            options += `<option value="completed">Completed</option>`;
            options += `<option value="cancelled">Cancelled</option>`;
    }
    
    return options;
}

async function updateEventDate(eventId) {
    const localDate = document.getElementById('eventDateInput').value;
    const localTime = document.getElementById('eventTimeInput').value;
    const offsetHours = parseInt(document.getElementById('eventTimezoneOffset').value);
    console.log("offsetHours: ", offsetHours);

    if (!localDate || !localTime) {
        showNotification('Please select date and time', 'error');
        return;
    }

    const [year, month, day] = localDate.split('-');
    const [hour, minute] = localTime.split(':');
    const localAsUtc = Date.UTC(year, month - 1, day, hour, minute);
    console.log("localAsUtc: ", localAsUtc);
    const realUtcTimestamp = localAsUtc - (offsetHours * 60 * 60 * 1000);
    console.log("realUtcTimestamp: ", realUtcTimestamp);
    const utcDateForDB = new Date(realUtcTimestamp).toISOString().slice(0, 19).replace('T', ' ');
    
    try {
        const response = await fetch(`/organizations/events/${eventId}/date`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventDate: utcDateForDB })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Event date updated successfully', 'success');
            viewEvent(eventId);
            if (currentContentType === 'events') {
                loadEvents();
            }
        } else {
            showNotification(result.error || 'Failed to update date', 'error');
        }
    } catch (error) {
        console.error('Error updating event date:', error);
        showNotification('Failed to update date', 'error');
    }
}

async function loadParticipants(eventId) {
    const container = document.getElementById('participantsList');
    if (!container) return;
    
    try {
        const response = await fetch(`/organizations/events/${eventId}/participants`);
        const participants = await response.json();
        
        if (participants.length === 0) {
            container.innerHTML = '<p class="empty-text">No participants yet</p>';
            return;
        }
        
        container.innerHTML = participants.map(p => `
            <div class="participant-item" data-user-id="${p.user_id}">
                <div class="participant-info">
                    <span class="participant-name">${escapeHtml(p.name || p.email)}</span>
                    <span class="participant-status status-${p.participation_status}">${p.participation_status}</span>
                </div>
                <div class="participant-actions">
                    <select class="participant-status-select" data-user-id="${p.user_id}">
                        <option value="registered" ${p.participation_status === 'registered' ? 'selected' : ''}>Registered</option>
                        <option value="attended" ${p.participation_status === 'attended' ? 'selected' : ''}>Attended</option>
                        <option value="not_attended" ${p.participation_status === 'not_attended' ? 'selected' : ''}>Not Attended</option>
                    </select>
                    <button class="btn-remove-participant btn-danger btn-small" data-user-id="${p.user_id}">Remove</button>
                </div>
            </div>
        `).join('');
        
        attachParticipantHandlers(eventId);
    } catch (error) {
        console.error('Error loading participants:', error);
        container.innerHTML = '<p class="empty-text">Error loading participants</p>';
    }
}

function attachParticipantHandlers(eventId) {
    // Обработчик изменения статуса участника
    document.querySelectorAll('.participant-status-select').forEach(select => {
        select.removeEventListener('change', handleStatusChange);
        select.addEventListener('change', handleStatusChange);
    });
    
    // Обработчик удаления участника
    document.querySelectorAll('.btn-remove-participant').forEach(btn => {
        btn.removeEventListener('click', handleRemoveParticipant);
        btn.addEventListener('click', handleRemoveParticipant);
    });
    
    async function handleStatusChange(e) {
        const userId = this.dataset.userId;
        const newStatus = this.value;
        
        try {
            const response = await fetch(`/organizations/events/${eventId}/participants/${userId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: newStatus })
            });
            
            if (response.ok) {
                showNotification('Participant status updated', 'success');
                loadParticipants(eventId); // Обновляем список
            } else {
                const error = await response.json();
                showNotification(error.error || 'Failed to update status', 'error');
            }
        } catch (error) {
            console.error('Error updating participant status:', error);
            showNotification('Failed to update status', 'error');
        }
    }
    
    async function handleRemoveParticipant(e) {
        const userId = this.dataset.userId;
        
        if (!confirm('Remove this participant?')) return;
        
        try {
            const response = await fetch(`/organizations/events/${eventId}/participants/${userId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                showNotification('Participant removed', 'success');
                loadParticipants(eventId);
                viewEvent(eventId);
            } else {
                const error = await response.json();
                showNotification(error.error || 'Failed to remove participant', 'error');
            }
        } catch (error) {
            console.error('Error removing participant:', error);
            showNotification('Failed to remove participant', 'error');
        }
    }
}

async function updateEventStatus(eventId, status) {
    try {
        const response = await fetch(`/organizations/events/${eventId}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification(`Event status updated to ${status}`, 'success');
            viewEvent(eventId);
            if (currentContentType === 'events') {
                loadEvents();
            }
        } else {
            showNotification(result.error || 'Failed to update status', 'error');
        }
    } catch (error) {
        console.error('Error updating event status:', error);
        showNotification('Failed to update status', 'error');
    }
}

async function joinEvent(eventId) {
    try {
        const response = await fetch(`/organizations/events/${eventId}/join`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Successfully joined the event!', 'success');
            // Обновляем детали
            viewEvent(eventId);
            // Обновляем карту
            if (currentContentType === 'events') {
                loadEvents();
            }
        } else {
            showNotification(result.error || 'Failed to join event', 'error');
        }
    } catch (error) {
        console.error('Error joining event:', error);
        showNotification('Failed to join event', 'error');
    }
}

async function cancelJoinEvent(eventId) {
    if (!confirm('Are you sure you want to cancel your participation?')) return;
    
    try {
        const response = await fetch(`/organizations/events/${eventId}/join`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Participation cancelled', 'success');
            viewEvent(eventId);
            if (currentContentType === 'events') {
                loadEvents();
            }
        } else {
            showNotification(result.error || 'Failed to cancel participation', 'error');
        }
    } catch (error) {
        console.error('Error cancelling participation:', error);
        showNotification('Failed to cancel participation', 'error');
    }
}

const switchBtns = document.querySelectorAll('.switch-btn');
const problemsFilters = document.getElementById('problemsFilters');
const eventsFilters = document.getElementById('eventsFilters');
const problemsListContainer = document.getElementById('problemsListContainer');
const eventsListContainer = document.getElementById('eventsListContainer');

switchBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const type = btn.dataset.type;
        currentContentType = type;
        
        // Обновляем активную кнопку
        switchBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        clearAllMarkers();
        
        // Показываем/скрываем соответствующие блоки
        if (type === 'problems') {
            problemsFilters.style.display = 'block';
            eventsFilters.style.display = 'none';
            problemsListContainer.style.display = 'block';
            eventsListContainer.style.display = 'none';
            loadProblems(); // Обновляем проблемы
        } else {
            problemsFilters.style.display = 'none';
            eventsFilters.style.display = 'block';
            problemsListContainer.style.display = 'none';
            eventsListContainer.style.display = 'block';
            loadEvents(); // Загружаем ивенты
        }
    });
});

document.querySelectorAll('[data-org-filter]').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('[data-org-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentEventFilter = btn.dataset.orgFilter;
        
        if (currentEventFilter === 'following' && !window.currentUserId) {
            showNotification('Please login to see your subscriptions', 'warning');
            return;
        }
        
        loadEvents();
    });
});

// Дождись загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    const statusButtons = document.querySelectorAll('[data-event-status]');
    
    if (statusButtons.length === 0) {
        console.warn('No event status buttons found');
        return;
    }
    
    statusButtons.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            statusButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentEventStatusFilter = this.dataset.eventStatus;
            
            console.log('Filter changed to:', currentEventStatusFilter);
            
            loadEvents();
        });
    });
});

function clearAllMarkers() {
    // Очищаем маркеры проблем
    ProblemMarkers.forEach(marker => map.removeLayer(marker));
    ProblemMarkers = [];
    
    // Очищаем маркеры ивентов
    eventMarkers.forEach(marker => map.removeLayer(marker));
    eventMarkers = [];
}

function formatEventDateTime(datetime, offsetHours) {
    const date = new Date(datetime);
    
    const adjustedTimestamp = date.getTime() + (offsetHours * 60 * 60 * 1000);
    const adjustedDate = new Date(adjustedTimestamp);
    
    const year = adjustedDate.getUTCFullYear();
    const month = String(adjustedDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(adjustedDate.getUTCDate()).padStart(2, '0');
    const hour = String(adjustedDate.getUTCHours()).padStart(2, '0');
    const minute = String(adjustedDate.getUTCMinutes()).padStart(2, '0');
    
    const formatted = `${day}.${month}.${year} ${hour}:${minute}`;
    const sign = offsetHours >= 0 ? '+' : '';
    const offsetText = `UTC${sign}${offsetHours}`;
    
    return { formatted, offsetText };
}