const filterChips = document.querySelectorAll('.filter-chip');
const tableRows = document.querySelectorAll('#requestsTableBody tr');

function filterRequests(status) {
    tableRows.forEach(row => {
        const rowStatus = row.getAttribute('data-status');
        row.style.display = (status === 'all' || rowStatus === status) ? '' : 'none';
    });
}

filterChips.forEach(chip => {
    chip.addEventListener('click', function() {
        const status = this.getAttribute('data-status');
        filterChips.forEach(c => c.classList.remove('active'));
        this.classList.add('active');
        filterRequests(status);
    });
});

// Approve request
document.querySelectorAll('.approve-request').forEach(btn => {
    btn.addEventListener('click', async function() {
        const requestId = this.getAttribute('data-id');
        const orgName = this.getAttribute('data-name');
        const row = this.closest('tr');
        
        if (confirm(`Approve request for "${orgName}"? This will create the organization.`)) {
            this.disabled = true;
            this.textContent = 'Processing...';

            try {
                const response = await fetch(`/admin/organization-requests/${requestId}/approve`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showNotification(`Organization "${orgName}" created successfully!`, 'success');
                    row.remove();
                } else {
                    showNotification(result.error || 'Failed to approve request', 'error');
                    this.disabled = false;
                    this.textContent = 'Approve';
                }
            } catch (error) {
                console.error('Error approving request:', error);
                showNotification('Failed to approve request', 'error');
                this.disabled = false;
                this.textContent = 'Approve';
            }
        }
    });
});

// Reject request
document.querySelectorAll('.reject-request').forEach(btn => {
    btn.addEventListener('click', async function() {
        const requestId = this.getAttribute('data-id');
        const orgName = this.getAttribute('data-name');
        const row = this.closest('tr');
        
        if (confirm(`Reject request for "${orgName}"?`)) {
            this.disabled = true;
            this.textContent = 'Processing...';
            
            try {
                const response = await fetch(`/admin/organization-requests/${requestId}/reject`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    showNotification(`Request for "${orgName}" rejected`, 'success');
                    const statusSpan = row.querySelector('.status-badge');
                    if (statusSpan) {
                        statusSpan.textContent = 'rejected';
                        statusSpan.className = 'status-badge status-rejected';
                    }
                } else {
                    showNotification(result.error || 'Failed to reject request', 'error');
                    this.disabled = false;
                    this.textContent = 'Reject';
                }
            } catch (error) {
                console.error('Error rejecting request:', error);
                showNotification('Failed to reject request', 'error');
                this.disabled = false;
                this.textContent = 'Reject';
            }
        }
    });
});