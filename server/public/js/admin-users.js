// Search functionality
const searchInput = document.getElementById('searchUsers');
const tableRows = document.querySelectorAll('#usersTable tbody tr');

if (searchInput) {
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        
        tableRows.forEach(row => {
            const name = row.getAttribute('data-name') || '';
            const email = row.getAttribute('data-email') || '';
            const matches = name.toLowerCase().includes(searchTerm) || 
                           email.toLowerCase().includes(searchTerm);
            row.style.display = matches ? '' : 'none';
        });
    });
}

// Delete user handler
const deleteButtons = document.querySelectorAll('.delete-user');

deleteButtons.forEach(btn => {
    btn.addEventListener('click', async function() {
        const userId = this.dataset.userId;
        const userName = this.dataset.userName;
        
        if (!confirm(`Are you sure you want to delete user "${userName}"? This action cannot be undone.`)) {
            return;
        }
        
        try {
            const response = await fetch(`/admin/users/${userId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                // Remove row from table
                const row = this.closest('tr');
                row.remove();
                showNotification('User deleted successfully!', 'success');
                
                // Update stats counters
                updateStatsAfterDelete();
            } else {
                const error = await response.json();
                alert('Error: ' + (error.error || 'Failed to delete user'));
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('Failed to delete user');
        }
    });
});

document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('newUserModal');
    const showModal = modal && modal.dataset.show === 'true';
    const hasErrors = document.querySelectorAll('.is-invalid').length > 0;
    
    if (modal && (showModal || hasErrors)) {
        modal.classList.add('show');
    }
});

const newUserBtn = document.getElementById('newUserBtn');
const newUserModal = document.getElementById('newUserModal');
const closeModalBtn = document.getElementById('closeModalBtn');
const cancelModalBtn = document.getElementById('cancelModalBtn');

// Open modal
if (newUserBtn) {
    newUserBtn.addEventListener('click', () => {
        newUserModal.classList.add('show');
    });
}

// Close modal
function closeModal() {
    newUserModal.classList.remove('show');
}

if (closeModalBtn) {
    closeModalBtn.addEventListener('click', closeModal);
}

if (cancelModalBtn) {
    cancelModalBtn.addEventListener('click', closeModal);
}

// Close on outside click
window.addEventListener('click', (e) => {
    if (e.target === newUserModal) {
        closeModal();
    }
});

// Update stats after user deletion (optional)
function updateStatsAfterDelete() {
    // You can implement this to refresh the stats counters via AJAX
    // Or simply reload the page
    setTimeout(() => {
        location.reload();
    }, 500);
}