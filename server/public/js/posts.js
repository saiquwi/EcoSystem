function initPostDeleteHandlers() {
    document.querySelectorAll('.btn-delete-post').forEach(btn => {
        btn.removeEventListener('click', handleDeletePost);
        btn.addEventListener('click', handleDeletePost);
    });
}

async function handleDeletePost(e) {
    const btn = e.currentTarget;
    const postId = btn.dataset.postId;
    
    if (!confirm('Are you sure you want to delete this post?')) return;
    
    try {
        const response = await fetch(`/organizations/posts/${postId}`, {
            method: 'DELETE'
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Post deleted successfully!', 'success');
            btn.closest('.post-card').remove();
        } else {
            showNotification(result.error || 'Failed to delete post', 'error');
        }
    } catch (error) {
        console.error('Error deleting post:', error);
        showNotification('Failed to delete post', 'error');
    }
}

let editSelectedPhotos = [];
let existingPhotos = [];

function createEditPostModal() {
    if (document.getElementById('editPostModal')) return;
    
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.id = 'editPostModal';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3>Edit Post</h3>
                <button class="modal-close" id="closeEditPostModal">&times;</button>
            </div>
            <form id="editPostForm" class="admin-form">
                <input type="hidden" id="editPostId">
                <div class="form-group">
                    <label for="editPostContent" class="form-label">Content</label>
                    <textarea id="editPostContent" name="content" rows="4" class="form-control" required></textarea>
                </div>
                <div class="form-group">
                    <div class="file-input-wrapper">
                        <input type="file" id="editPostPhotos" name="photos" multiple accept="image/*" style="display: none;">
                        <button type="button" id="editSelectPhotosBtn" class="btn btn-outline">📷 Change Photos</button>
                        <span id="editPostFileCount" class="file-count">0 / 5 files selected</span>
                    </div>
                    <div id="editPostPhotoPreview" class="photo-preview"></div>
                </div>
                <div class="form-actions">
                    <button type="button" class="btn btn-outline" id="cancelEditPostModalBtn">Cancel</button>
                    <button type="submit" class="btn btn-primary">Save Changes</button>
                </div>
            </form>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Привязываем обработчики
    const closeBtn = document.getElementById('closeEditPostModal');
    const cancelBtn = document.getElementById('cancelEditPostModalBtn');
    
    if (closeBtn) closeBtn.addEventListener('click', closeEditPostModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeEditPostModal);
    
    window.addEventListener('click', (e) => {
        if (e.target === modal) closeEditPostModal();
    });
    
    // Обработчики для фото
    const selectBtn = document.getElementById('editSelectPhotosBtn');
    const fileInput = document.getElementById('editPostPhotos');
    
    if (selectBtn && fileInput) {
        selectBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleEditPhotoSelect);
    }
    
    // Submit form
    const form = document.getElementById('editPostForm');
    if (form) {
        form.addEventListener('submit', handleEditPostSubmit);
    }
}

function handleEditPhotoSelect(e) {
    const files = Array.from(e.target.files);
    const remainingSlots = 5 - (existingPhotos.length + editSelectedPhotos.length);
    
    if (files.length > remainingSlots) {
        showNotification(`Only ${remainingSlots} more photos allowed`, 'warning');
        editSelectedPhotos.push(...files.slice(0, remainingSlots));
    } else {
        editSelectedPhotos.push(...files);
    }
    
    updateEditPostPhotoPreview();
    updateEditPostFileCount();
    document.getElementById('editPostPhotos').value = '';
}

function updateEditPostPhotoPreview() {
    const container = document.getElementById('editPostPhotoPreview');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Существующие фото
    existingPhotos.forEach((photo) => {
        const div = document.createElement('div');
        div.className = 'photo-preview-item';
        div.innerHTML = `
            <img src="${photo}" alt="Existing photo">
            <button type="button" class="photo-remove-existing" data-photo="${photo}">×</button>
        `;
        container.appendChild(div);
    });
    
    // Новые фото
    editSelectedPhotos.forEach((photo, index) => {
        const reader = new FileReader();
        reader.onload = function(e) {
            const div = document.createElement('div');
            div.className = 'photo-preview-item';
            div.innerHTML = `
                <img src="${e.target.result}" alt="Preview">
                <button type="button" class="photo-remove-new" data-index="${index}">×</button>
            `;
            container.appendChild(div);
        };
        reader.readAsDataURL(photo);
    });
    
    // Обработчики удаления
    document.querySelectorAll('.photo-remove-existing').forEach(btn => {
        btn.addEventListener('click', () => {
            const photoToRemove = btn.dataset.photo;
            existingPhotos = existingPhotos.filter(p => p !== photoToRemove);
            updateEditPostPhotoPreview();
            updateEditPostFileCount();
        });
    });
    
    document.querySelectorAll('.photo-remove-new').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.dataset.index);
            editSelectedPhotos.splice(idx, 1);
            updateEditPostPhotoPreview();
            updateEditPostFileCount();
        });
    });
}

function updateEditPostFileCount() {
    const total = existingPhotos.length + editSelectedPhotos.length;
    const countSpan = document.getElementById('editPostFileCount');
    const chooseBtn = document.getElementById('editSelectPhotosBtn');
    
    if (countSpan) countSpan.textContent = `${total} / 5 files selected`;
    if (chooseBtn) chooseBtn.disabled = total >= 5;
}

function openEditPostModal(postId, content, photos) {
    existingPhotos = photos || [];
    editSelectedPhotos = [];
    
    document.getElementById('editPostId').value = postId;
    document.getElementById('editPostContent').value = content;
    
    updateEditPostPhotoPreview();
    updateEditPostFileCount();
    
    document.getElementById('editPostModal').classList.add('show');
}

function closeEditPostModal() {
    document.getElementById('editPostModal').classList.remove('show');
    editSelectedPhotos = [];
    existingPhotos = [];
}

async function handleEditPostSubmit(e) {
    e.preventDefault();
    
    const postId = document.getElementById('editPostId').value;
    const content = document.getElementById('editPostContent').value;
    
    if (!content.trim()) {
        showNotification('Post content is required', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('content', content);
    formData.append('photosToKeep', JSON.stringify(existingPhotos));
    editSelectedPhotos.forEach(photo => formData.append('photos', photo));
    
    try {
        const response = await fetch(`/organizations/posts/${postId}`, {
            method: 'PUT',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Post updated successfully!', 'success');
            closeEditPostModal();
            setTimeout(() => location.reload(), 1000);
        } else {
            showNotification(result.error || 'Failed to update post', 'error');
        }
    } catch (error) {
        console.error('Error updating post:', error);
        showNotification('Failed to update post', 'error');
    }
}

function initEditPostHandlers() {
    createEditPostModal();
    
    document.querySelectorAll('.btn-edit-post').forEach(btn => {
        btn.removeEventListener('click', handleEditClick);
        btn.addEventListener('click', handleEditClick);
    });
}

function handleEditClick(e) {
    const btn = e.currentTarget;
    const postId = btn.dataset.postId;
    const content = btn.dataset.content;
    const photos = JSON.parse(btn.dataset.postPhotos);
    openEditPostModal(postId, content, photos);
}

function initPosts() {
    initPostDeleteHandlers();
    initEditPostHandlers();
}

window.initPosts = initPosts;