const orgData = document.getElementById('org-data');
const organizationId = orgData ? orgData.dataset.orgId : null;
const isStaff = orgData ? orgData.dataset.isStaff === 'true' : false;
let waitingForEventLocation = false;

if (typeof initPosts === 'function') {
    initPosts();
}

let selectedPostPhotos = [];

function updatePostPhotoPreview() {
    const container = document.getElementById('postPhotoPreview');
    if (!container) return;
    
    container.innerHTML = '';
    
    selectedPostPhotos.forEach((photo, index) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const div = document.createElement('div');
            div.className = 'photo-preview-item';
            div.innerHTML = `
                <img src="${e.target.result}" alt="Preview">
                <button type="button" class="photo-remove" data-index="${index}">×</button>
            `;
            container.appendChild(div);
            
            div.querySelector('.photo-remove').addEventListener('click', (e) => {
                e.stopPropagation();
                selectedPostPhotos.splice(index, 1);
                updatePostPhotoPreview();
                updatePostFileCount();
            });
        };
        reader.readAsDataURL(photo);
    });

    updatePostFileCount();
}

function updatePostFileCount() {
    const fileCountSpan = document.getElementById('postFileCount');
    if (fileCountSpan) {
        fileCountSpan.textContent = `${selectedPostPhotos.length} / 5 files selected`;
    }
    
    const chooseBtn = document.getElementById('selectPhotosBtn');
    if (chooseBtn) {
        chooseBtn.disabled = selectedPostPhotos.length >= 5;
    }
}

const selectPhotosBtn = document.getElementById('selectPhotosBtn');
const postPhotosInput = document.getElementById('postPhotos');

if (selectPhotosBtn && postPhotosInput) {
    selectPhotosBtn.addEventListener('click', () => {
        postPhotosInput.click();
    });
    
    postPhotosInput.addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        const slots = 5;
        
        if (files.length > slots) {
            showNotification(`Only ${slots} photos allowed`, 'warning');
            selectedPostPhotos.push(...files.slice(0, remainingSlots));
        } else {
            selectedPostPhotos.push(...files);
        }
        
        updatePostPhotoPreview();
        postPhotosInput.value = '';
    });
}

const createPostForm = document.getElementById('createPostForm');
if (createPostForm) {
    createPostForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const organizationId = document.getElementById('postOrgId').value;
        const content = document.getElementById('postContent').value;
        
        if (!content.trim()) {
            showNotification('Post content is required', 'error');
            return;
        }
        
        const formData = new FormData();
        formData.append('organizationId', organizationId);
        formData.append('content', content);
        selectedPostPhotos.forEach(photo => {
            formData.append('photos', photo);
        });
        
        try {
            const response = await fetch(`/organizations/${organizationId}/posts`, {
                method: 'POST',
                body: formData
            });
            
            const result = await response.json();
            
            if (response.ok) {
                showNotification('Post created successfully!', 'success');
                selectedPostPhotos = [];
                updatePostPhotoPreview();
                document.getElementById('postContent').value = '';
                setTimeout(() => location.reload(), 1000);
            } else {
                showNotification(result.error || 'Failed to create post', 'error');
            }
        } catch (error) {
            console.error('Error creating post:', error);
            showNotification('Failed to create post', 'error');
        }
    });
}

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

function switchTab(tabId) {
    tabContents.forEach(content => {
        content.classList.remove('active');
        content.style.display = 'none';
    });
    tabBtns.forEach(btn => btn.classList.remove('active'));
    
    const activeContent = document.getElementById(`${tabId}Tab`);
    if (activeContent) {
        activeContent.classList.add('active');
        activeContent.style.display = 'block';
    }
    
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    if (tabId === 'posts') {
        loadOrganizationPosts();
    } else if (tabId === 'events') {
        loadOrganizationEvents();
    }
}

tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const tabId = btn.dataset.tab;
        switchTab(tabId);
    });
});

async function loadOrganizationEvents() {
    const container = document.getElementById('orgEventsList');
    if (!container || !organizationId) return;
    
    try {
        const response = await fetch(`/organizations/api/events?organizationId=${parseInt(organizationId)}`);
        
        if (!response.ok) {
            throw new Error('Failed to load events');
        }
        
        const events = await response.json();
        
        if (events.length === 0) {
            container.innerHTML = '<p class="empty-text">No events yet</p>';
            return;
        }
        
        container.innerHTML = events.map(event => `
            <div class="event-card" onclick="viewEvent(${event.id})">
                <h3 class="event-title">${escapeHtml(event.title)}</h3>
                <p class="event-date">${new Date(event.event_date).toLocaleDateString('ru-RU')}</p>
                <p class="event-description">${escapeHtml(event.description) || 'No description'}</p>
                <span class="event-status status-${event.status}">${event.status}</span>
            </div>
        `).join('');
    } catch (error) {
        console.error('Error loading organization events:', error);
        container.innerHTML = '<p class="empty-text">Error loading events</p>';
    }
}

const addEventFromOrgBtn = document.getElementById('addEventFromOrgBtn');
if (addEventFromOrgBtn) {
    addEventFromOrgBtn.addEventListener('click', () => {
        window.location.href = `/map?createEvent=true&orgId=${organizationId}`;
    });
}

const addPostBtn = document.getElementById('addPostBtn');
const createPostContainer = document.getElementById('createPostFormContainer');
const cancelPostBtn = document.getElementById('cancelPostBtn');

if (addPostBtn) {
    addPostBtn.addEventListener('click', () => {
        createPostContainer.style.display = 'block';
        addPostBtn.style.display = 'none';
    });
}

if (cancelPostBtn) {
    cancelPostBtn.addEventListener('click', () => {
        createPostContainer.style.display = 'none';
        addPostBtn.style.display = 'inline-flex';
        document.getElementById('postContent').value = '';
        selectedPostPhotos = [];
        updatePostPhotoPreview();
        updatePostFileCount();
    });
}

async function loadOrganizationPosts() {
    const container = document.getElementById('orgPostsList');
    if (!container || !organizationId) return;
    
    try {
        const response = await fetch(`/organizations/${organizationId}/posts`);
        const posts = await response.json();
        
        if (posts.length === 0) {
            container.innerHTML = '<p class="empty-text">No posts yet</p>';
            return;
        }
        
        container.innerHTML = posts.map(post => `
            <div class="post-card">
                <div class="post-content">
                    <p>${escapeHtml(post.content)}</p>
                </div>
                ${post.photos && post.photos.length > 0 ? `
                    <div class="post-photos">
                        ${post.photos.map((photo, idx) => `
                            <img src="${photo}" alt="Post photo" class="post-photo" data-photos='${JSON.stringify(post.photos)}' data-index="${idx}">
                        `).join('')}
                    </div>
                ` : ''}
                <div class="post-header">
                    <div class="post-date">${new Date(post.created_at).toLocaleDateString('ru-RU')}</div>
                    ${isStaff ? `
                        <div class="post-actions">
                            <button class="btn-edit-post" data-post-id="${post.id}" data-content="${post.content.replace(/"/g, '&quot;')}" data-post-photos='${JSON.stringify(post.photos || [])}'>✏️</button>
                            <button class="btn-delete-post" data-post-id="${post.id}">🗑️</button>
                        </div>
                    ` : ''}
                </div>
            </div>
        `).join('');
        
        if (typeof attachPostPhotoHandlers === 'function') {
            attachPostPhotoHandlers();
        }
    } catch (error) {
        console.error('Error loading posts:', error);
        container.innerHTML = '<p class="empty-text">Error loading posts</p>';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    loadOrganizationPosts();
});