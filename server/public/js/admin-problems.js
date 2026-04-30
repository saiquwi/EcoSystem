const categoryFilter = document.getElementById('categoryFilter');
const statusFilter = document.getElementById('statusFilter');
const searchInput = document.getElementById('searchProblems');

function applyFilters() {
    const category = categoryFilter ? categoryFilter.value : 'all';
    const status = statusFilter ? statusFilter.value : 'all';
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    
    const url = new URL(window.location.href);
    url.searchParams.set('category', category);
    url.searchParams.set('status', status);
    window.location.href = url.toString();
}

if (categoryFilter) {
    categoryFilter.addEventListener('change', applyFilters);
}

if (statusFilter) {
    statusFilter.addEventListener('change', applyFilters);
}

if (searchInput) {
    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase();
        const rows = document.querySelectorAll('#problemsTable tbody tr');
        let visibleCount = 0;
        
        rows.forEach(row => {
            const title = row.getAttribute('data-title') || '';
            const matches = title.toLowerCase().includes(searchTerm);
            row.style.display = matches ? '' : 'none';
            if (matches) visibleCount++;
        });
        
        const countSpan = document.getElementById('problemCount');
        if (countSpan) {
            countSpan.textContent = visibleCount;
        }
    });
}

const deleteButtons = document.querySelectorAll('.delete-problem');

deleteButtons.forEach(btn => {
    btn.addEventListener('click', async function() {
        const problemId = this.dataset.problemId;
        const problemTitle = this.dataset.problemTitle;
        
        if (!confirm(`Are you sure you want to delete problem "${problemTitle}"? This action cannot be undone.`)) {
            return;
        }
        
        try {
            const response = await fetch(`/admin/problems/${problemId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                const row = this.closest('tr');
                row.remove();
                showNotification('Problem deleted successfully!', 'success');
                
                // Update count
                const remainingRows = document.querySelectorAll('#problemsTable tbody tr:visible').length;
                const countSpan = document.getElementById('problemCount');
                if (countSpan) {
                    countSpan.textContent = remainingRows;
                }
            } else {
                const error = await response.json();
                alert('Error: ' + (error.error || 'Failed to delete problem'));
            }
        } catch (error) {
            console.error('Error deleting problem:', error);
            alert('Failed to delete problem');
        }
    });
});