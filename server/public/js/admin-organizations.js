document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('orgModal');
    const showModal = modal && modal.dataset.show === 'true';
    const hasErrors = document.querySelectorAll('.is-invalid').length > 0;
    
    if (modal && (showModal || hasErrors)) {
        modal.classList.add('show');
    }
});

const newOrgBtn = document.getElementById('newOrgBtn');
const orgModal = document.getElementById('orgModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');
const orgForm = document.getElementById('orgForm');
const orgModalTitle = document.getElementById('orgModalTitle');

// Open modal for CREATE
if (newOrgBtn) {
    newOrgBtn.addEventListener('click', () => {
        resetForm();
        if (orgModalTitle) orgModalTitle.textContent = 'Create New Organization';
        if (orgForm) orgForm.action = '/admin/organizations';
        const orgIdInput = document.getElementById('orgId');
        if (orgIdInput) orgIdInput.value = '';
        if (orgModal) orgModal.classList.add('show');
    });
}

// Open modal for EDIT
const editButtons = document.querySelectorAll('.edit-org');

editButtons.forEach(btn => {
    btn.addEventListener('click', async function() {
        const orgId = this.dataset.orgId;
        console.log('Edit button clicked for orgId:', orgId);
        
        try {
            const response = await fetch(`/admin/organizations/${orgId}`);
            const org = await response.json();
            
            if (response.ok) {
                if (orgModalTitle) orgModalTitle.textContent = 'Edit Organization';

                if (orgForm) orgForm.action = `/admin/organizations/${orgId}`;

                const orgIdInput = document.getElementById('orgId');
                if (orgIdInput) orgIdInput.value = org.id;
                
                const nameInput = document.getElementById('name');
                if (nameInput) nameInput.value = org.name;
                
                const emailInput = document.getElementById('email');
                if (emailInput) emailInput.value = org.email;
                
                const websiteInput = document.getElementById('website');
                if (websiteInput) websiteInput.value = org.website || '';
                
                const descInput = document.getElementById('description');
                if (descInput) descInput.value = org.description || '';

                selectedOwners = org.owners || [];
                updateOwnersList();

                if (orgModal) orgModal.classList.add('show');
            } else {
                showNotification(org.error || 'Failed to load organization', 'error');
            }
        } catch (error) {
            console.error('Error loading organization:', error);
            showNotification('Failed to load organization', 'error');
        }

        console.log('Form action set to:', orgForm.action);
    });
});

function resetForm() {
    orgForm.reset();
    selectedOwners = [];
    updateOwnersList();
    document.querySelectorAll('.is-invalid').forEach(el => {
        el.classList.remove('is-invalid');
    });
}

// Close modal function
function closeModal() {
    orgModal.classList.remove('show');
    resetForm();
}

if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeModal);
}

if (cancelModalBtn) {
    cancelModalBtn.addEventListener('click', closeModal);
}

// Close on outside click
window.addEventListener('click', (e) => {
    if (e.target === orgModal) {
        closeModal();
    }
});

let selectedOwners = [];

function updateOwnersList() {
    const container = document.getElementById('ownersList');
    const ownersIdsInput = document.getElementById('ownersIds');
    
    if (!container) return;

    container.innerHTML = '';
    
    selectedOwners.forEach(owner => {
        const tag = document.createElement('div');
        tag.className = 'owner-tag';
        tag.innerHTML = `
            <span>${escapeHtml(owner.name)}</span>
            <button type="button" class="remove-owner" data-id="${owner.id}">×</button>
        `;
        container.appendChild(tag);
    });
    
    document.querySelectorAll('.remove-owner').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = parseInt(btn.dataset.id);
            selectedOwners = selectedOwners.filter(o => o.id !== id);
            updateOwnersList();
            updateOwnersInput();
        });
    });
    
    updateOwnersInput();
}

function updateOwnersInput() {
    const ownersIdsInput = document.getElementById('ownersIds');
    ownersIdsInput.value = selectedOwners.map(o => o.id).join(',');
}

function addOwner(userId, userName) {
    if (!userId) return;
    if (selectedOwners.some(o => o.id === userId)) {
        showNotification('This user is already an owner', 'warning');
        return;
    }
    selectedOwners.push({ id: parseInt(userId), name: userName });
    updateOwnersList();
}

// Add owner button
const addOwnerBtn = document.getElementById('addOwnerBtn');
const ownerSelect = document.getElementById('ownerSelect');

if (addOwnerBtn) {
    addOwnerBtn.addEventListener('click', () => {
        const selectedOption = ownerSelect.options[ownerSelect.selectedIndex];
        const userId = ownerSelect.value;
        const userName = selectedOption?.dataset.name || selectedOption?.text || '';
        
        if (userId) {
            addOwner(parseInt(userId), userName);
            ownerSelect.value = '';
        }
    });
}

const searchInput = document.getElementById('searchOrganizations');
const tableRows = document.querySelectorAll('#organizationsTable tbody tr');
const orgCountSpan = document.getElementById('orgCount');

if (searchInput) {
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        let visibleCount = 0;
        
        tableRows.forEach(row => {
            const name = row.getAttribute('data-name') || '';
            const email = row.getAttribute('data-email') || '';
            const matches = name.toLowerCase().includes(searchTerm) || 
                           email.toLowerCase().includes(searchTerm);
            if (matches) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });
        
        if (orgCountSpan) {
            orgCountSpan.textContent = visibleCount;
        }
    });
}

const deleteButtons = document.querySelectorAll('.delete-org');

deleteButtons.forEach(btn => {
    btn.addEventListener('click', async function() {
        const orgId = this.dataset.orgId;
        const orgName = this.dataset.orgName;
        
        if (!confirm(`Are you sure you want to delete organization "${orgName}"? This will also remove all associated staff. This action cannot be undone.`)) {
            return;
        }
        
        try {
            const response = await fetch(`/admin/organizations/${orgId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                const row = this.closest('tr');
                row.remove();
                showNotification('Organization deleted successfully!', 'success');
                
                const allRows = document.querySelectorAll('#organizationsTable tbody tr');
                let visibleCount = 0;
                allRows.forEach(row => {
                    if (row.style.display !== 'none') {
                        visibleCount++;
                    }
                });

                if (orgCountSpan) {
                    orgCountSpan.textContent = visibleCount;
                }
            } else {
                const error = await response.json().catch(() => ({ error: 'Unknown error' }));
                alert('Error: ' + (error.error || 'Failed to delete organization'));
            }
        } catch (error) {
            console.error('Error deleting organization:', error);
            alert('Failed to delete organization');
        }
    });
});

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
