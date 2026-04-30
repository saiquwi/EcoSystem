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