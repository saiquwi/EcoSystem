const createOrgForm = document.getElementById('createOrgForm');
const createOrgModal = document.getElementById('createOrgModal');
const createOrgBtn = document.getElementById('createOrgBtn');
const emptyCreateOrgBtn = document.getElementById('emptyCreateOrgBtn');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const editOrgModal = document.getElementById('editOrgModal');
const editOrgForm = document.getElementById('editOrgForm');
const closeEditModalBtn = document.getElementById('closeEditModalBtn');
const cancelEditModalBtn = document.getElementById('cancelEditModalBtn');
const editModalTitle = document.getElementById('editModalTitle');
const ownerFields = document.getElementById('ownerFields');
const moderatorsSection = document.getElementById('moderatorsSection');
const tabs = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');
const filterChips = document.querySelectorAll('[data-filter]');
const orgCards = document.querySelectorAll('.org-card');
const reqFilterChips = document.querySelectorAll('[data-req-filter]');

if (createOrgForm) {
    createOrgForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const data = {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            website: document.getElementById('website').value,
            description: document.getElementById('description').value
        };
        
        try {
            const response = await fetch('/organizations/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                showNotification(result.message || 'Request sent successfully!', 'success');
                closeCreateModal();
                if (document.querySelector('[data-tab="requests"].active')) {
                    loadUserRequests();
                }
            } else {
                showNotification(result.error || 'Failed to send request', 'error');
            }
        } catch (error) {
            console.error('Error sending request:', error);
            showNotification('Failed to send request', 'error');
        }
    });
}

function openCreateModal() {
    if (createOrgModal) {
        createOrgModal.classList.add('show');
    }
}

function closeCreateModal() {
    if (createOrgModal) {
        createOrgModal.classList.remove('show');
        if (createOrgForm) createOrgForm.reset();
    }
}

if (createOrgBtn) {
    createOrgBtn.addEventListener('click', openCreateModal);
}

if (emptyCreateOrgBtn) {
    emptyCreateOrgBtn.addEventListener('click', openCreateModal);
}

if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeCreateModal);
}

if (cancelModalBtn) {
    cancelModalBtn.addEventListener('click', closeCreateModal);
}

// Close on outside click
window.addEventListener('click', (e) => {
    if (e.target === createOrgModal) {
        closeCreateModal();
    }
    if (e.target === editOrgModal) {
        closeEditModal();
    }
});

// Open edit modal
document.querySelectorAll('.edit-org').forEach(btn => {
    btn.addEventListener('click', async function() {
        const orgId = this.dataset.orgId;
        const orgName = this.dataset.orgName;
        const isOwner = this.dataset.isOwner === 'true';
        
        editModalTitle.textContent = `Edit: ${orgName}`;
        document.getElementById('editOrgId').value = orgId;
        document.getElementById('userRole').value = isOwner ? 'owner' : 'moderator';
        
        // Показываем/скрываем поля в зависимости от роли
        if (isOwner) {
            ownerFields.style.display = 'block';
            moderatorsSection.style.display = 'block';
        } else {
            ownerFields.style.display = 'none';
            moderatorsSection.style.display = 'none';
        }
        
        try {
            const response = await fetch(`/organizations/api/${orgId}/edit-data`);
            const data = await response.json();
            
            if (response.ok) {
                if (isOwner) {
                    document.getElementById('editName').value = data.name;
                    document.getElementById('editEmail').value = data.email;
                    document.getElementById('editWebsite').value = data.website || '';
                }
                document.getElementById('editDescription').value = data.description || '';
                
                if (isOwner && data.moderators) {
                    displayModerators(data.moderators);
                    await loadAvailableUsers(orgId);
                }
            }
        } catch (error) {
            console.error('Error loading organization data:', error);
        }
        
        editOrgModal.classList.add('show');
    });
});

function closeEditModal() {
    if (editOrgModal) {
        editOrgModal.classList.remove('show');
        if (editOrgForm) editOrgForm.reset();
    }
}

if (closeEditModalBtn) closeEditModalBtn.addEventListener('click', closeEditModal);
if (cancelEditModalBtn) cancelEditModalBtn.addEventListener('click', closeEditModal);

// Close on outside click
window.addEventListener('click', (e) => {
    if (e.target === editOrgModal) closeEditModal();
});

// Submit edit form
if (editOrgForm) {
    editOrgForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const orgId = document.getElementById('editOrgId').value;
        const userRole = document.getElementById('userRole').value;
        const isOwner = userRole === 'owner';
        
        const data = {
            description: document.getElementById('editDescription').value
        };
        
        if (isOwner) {
            data.name = document.getElementById('editName').value;
            data.email = document.getElementById('editEmail').value;
            data.website = document.getElementById('editWebsite').value;
        }
        
        try {
            const response = await fetch(`/organizations/api/${orgId}/edit`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                showNotification('Organization info updated successfully!', 'success');
                closeEditModal();
                setTimeout(() => location.reload(), 1000);
            } else {
                showNotification(result.error || 'Failed to update organization', 'error');
            }
        } catch (error) {
            console.error('Error updating organization:', error);
            showNotification('Failed to update organization', 'error');
        }
    });
}

// Display moderators list
function displayModerators(moderators) {
    const container = document.getElementById('moderatorsList');
    container.innerHTML = '';
    
    moderators.forEach(mod => {
        const tag = document.createElement('div');
        tag.className = 'moderator-tag';
        tag.innerHTML = `
            <span>${escapeHtml(mod.name)} (${escapeHtml(mod.email)})</span>
            <button type="button" class="remove-moderator" data-user-id="${mod.id}">×</button>
        `;
        container.appendChild(tag);
    });
    
    // Add remove handlers
    document.querySelectorAll('.remove-moderator').forEach(btn => {
        btn.addEventListener('click', async function() {
            const userId = this.dataset.userId;
            const orgId = document.getElementById('editOrgId').value;
            
            if (confirm('Remove this moderator?')) {
                try {
                    const response = await fetch(`/organizations/api/${orgId}/moderators/${userId}`, {
                        method: 'DELETE'
                    });
                    
                    if (response.ok) {
                        showNotification('Moderator removed', 'success');
                        // Refresh moderators list
                        const data = await fetch(`/organizations/api/${orgId}/edit-data`).then(r => r.json());
                        displayModerators(data.moderators);
                    }
                } catch (error) {
                    console.error('Error removing moderator:', error);
                }
            }
        });
    });
}

// Load available users for moderator selection
async function loadAvailableUsers(orgId) {
    try {
        const response = await fetch(`/organizations/api/${orgId}/available-users`);
        const users = await response.json();
        
        const select = document.getElementById('newModeratorSelect');
        select.innerHTML = '<option value="">Select user...</option>';
        
        users.forEach(user => {
            const option = document.createElement('option');
            option.value = user.id;
            option.textContent = `${user.name || user.email} (${user.email})`;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading users:', error);
    }
}

// Add moderator
const addModeratorBtn = document.getElementById('addModeratorBtn');
if (addModeratorBtn) {
    addModeratorBtn.addEventListener('click', async () => {
        const select = document.getElementById('newModeratorSelect');
        const userId = select.value;
        const orgId = document.getElementById('editOrgId').value;
        
        if (!userId) {
            showNotification('Please select a user', 'error');
            return;
        }
        
        try {
            const response = await fetch(`/organizations/api/${orgId}/moderators`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId })
            });
            
            if (response.ok) {
                showNotification('Moderator added successfully!', 'success');
                // Refresh moderators list
                const data = await fetch(`/organizations/api/${orgId}/edit-data`).then(r => r.json());
                displayModerators(data.moderators);
                select.value = '';
            } else {
                const error = await response.json();
                showNotification(error.error || 'Failed to add moderator', 'error');
            }
        } catch (error) {
            console.error('Error adding moderator:', error);
        }
    });
}

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        const tabId = tab.dataset.tab;
        
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        tab.classList.add('active');
        document.getElementById(`${tabId}Tab`).classList.add('active');
        
        // Загружаем запросы только когда открываем вкладку
        if (tabId === 'requests') {
            loadUserRequests();
        }
    });
});

filterChips.forEach(chip => {
    chip.addEventListener('click', () => {
        const filter = chip.dataset.filter;
        
        filterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        
        orgCards.forEach(card => {
            if (filter === 'all' || card.dataset.position === filter) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    });
});

let currentRequests = [];
function filterRequests(status) {
    const container = document.getElementById('requestsList');
    if (!container) return;
    
    const filtered = status === 'all' 
        ? currentRequests 
        : currentRequests.filter(req => req.status === status);
    
    const pendingCount = currentRequests.filter(r => r.status === 'pending').length;
    const rejectedCount = currentRequests.filter(r => r.status === 'rejected').length;
    
    document.getElementById('pendingCount').textContent = pendingCount;
    document.getElementById('rejectedCount').textContent = rejectedCount;
    
    if (filtered.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>No requests found</p></div>';
        return;
    }
    
    container.innerHTML = filtered.map(req => `
        <div class="request-card">
            <div class="request-header">
                <span class="request-name">${escapeHtml(req.name)}</span>
                <span class="request-status ${req.status}">${req.status}</span>
            </div>
            <div class="request-details">
                <p>${escapeHtml(req.email)}</p>
                ${req.website ? `<p>${escapeHtml(req.website)}</p>` : ''}
                ${req.description ? `<p>${escapeHtml(req.description)}</p>` : ''}
            </div>
            <div class="request-date">
                Submitted: ${new Date(req.created_at).toLocaleDateString('ru-RU')}
            </div>
        </div>
    `).join('');
}

// Request filter handlers
reqFilterChips.forEach(chip => {
    chip.addEventListener('click', () => {
        const filter = chip.dataset.reqFilter;
        
        reqFilterChips.forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        
        filterRequests(filter);
    });
});

async function loadUserRequests() {
    const container = document.getElementById('requestsList');
    if (!container) return;
    
    container.innerHTML = '<div class="loading">Loading...</div>';
    
    try {
        const response = await fetch('/organizations/api/my-requests');
        currentRequests = await response.json();
        
        if (currentRequests.length === 0) {
            container.innerHTML = '<div class="empty-state"><p>No organization requests found</p></div>';
            document.getElementById('pendingCount').textContent = '0';
            document.getElementById('rejectedCount').textContent = '0';
            return;
        }
        
        // Применяем текущий фильтр (по умолчанию 'all')
        const activeFilter = document.querySelector('[data-req-filter].active');
        const currentFilter = activeFilter ? activeFilter.dataset.reqFilter : 'all';
        filterRequests(currentFilter);
        
    } catch (error) {
        console.error('Error loading requests:', error);
        container.innerHTML = '<div class="empty-state"><p>Error loading requests</p></div>';
    }
}