const appData = document.getElementById('app-data');
const currentUserId = appData ? appData.dataset.currentUserId : null;
const isAuthenticated = appData ? appData.dataset.isAuthenticated === 'true' : false;

if (typeof initPosts === 'function') {
    initPosts();
}

function attachFollowHandlers() {
    document.querySelectorAll('.follow-btn, .follow-btn-small').forEach(btn => {
        btn.removeEventListener('click', handleFollowClick);
        btn.addEventListener('click', handleFollowClick);
    });
}

async function handleFollowClick() {
    const orgId = this.dataset.orgId;
    const isFollowing = this.classList.contains('following');
    const method = isFollowing ? 'DELETE' : 'POST';
    
    try {
        const response = await fetch(`/organizations/${orgId}/follow`, {
            method: method,
            headers: { 'Content-Type': 'application/json' }
        });
        
        const result = await response.json();
        
        if (response.ok) {
            if (result.following) {
                this.classList.add('following');
                this.textContent = 'Unfollow';
                showNotification('Followed successfully!', 'success');
            } else {
                this.classList.remove('following');
                this.textContent = 'Follow';
                showNotification('Unfollowed successfully!', 'success');
            }
        } else {
            showNotification(result.error || 'Failed to update follow status', 'error');
        }
    } catch (error) {
        console.error('Error toggling follow:', error);
        showNotification('Failed to update follow status', 'error');
    }
}

const loadMoreBtn = document.getElementById('loadMoreBtn');
let currentPage = 1;

const urlParams = new URLSearchParams(window.location.search);
currentPage = parseInt(urlParams.get('page')) || 1;

if (loadMoreBtn) {
    loadMoreBtn.addEventListener('click', async function() {
        currentPage++;
        const newUrlParams = new URLSearchParams(window.location.search);
        newUrlParams.set('page', currentPage);
        
        try {
            const response = await fetch(`/organizations/feed?${newUrlParams.toString()}`);
            const html = await response.text();
            
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const newPosts = doc.querySelector('.posts-list');
            
            if (newPosts) {
                document.querySelector('.posts-list').insertAdjacentHTML('beforeend', newPosts.innerHTML);
                
                attachFollowHandlers();
                attachPhotoHandlers();
                
                const hasMore = doc.querySelector('#loadMoreBtn');
                if (!hasMore) {
                    loadMoreBtn.remove();
                }
            }
        } catch (error) {
            console.error('Error loading more posts:', error);
        }
    });
}

const orgSearchInput = document.getElementById('orgSearchInput');
const orgSearchResults = document.getElementById('orgSearchResults');
let searchTimeout = null;

if (orgSearchInput) {
    orgSearchInput.addEventListener('input', function() {
        const query = this.value.trim();
        
        if (searchTimeout) clearTimeout(searchTimeout);
        
        if (orgSearchResults) {
            orgSearchResults.innerHTML = '<div class="org-search-loading">Searching...</div>';
        }
        
        searchTimeout = setTimeout(() => {
            if (query.length === 0) {
                if (orgSearchResults) orgSearchResults.innerHTML = '';
                return;
            }
            fetchOrganizations(query);
        }, 300);
    });
}

async function fetchOrganizations(query) {
    try {
        const response = await fetch(`/organizations/api/search?q=${encodeURIComponent(query)}`);
        const organizations = await response.json();
        displaySearchResults(organizations);
    } catch (error) {
        console.error('Error searching organizations:', error);
        if (orgSearchResults) {
            orgSearchResults.innerHTML = '<div class="org-search-error">Error loading results</div>';
        }
    }
}

function displaySearchResults(organizations) {
    if (!orgSearchResults) return;
    
    if (organizations.length === 0) {
        orgSearchResults.innerHTML = '<div class="org-search-empty">No organizations found</div>';
        return;
    }
    
    orgSearchResults.innerHTML = '';
    
    organizations.forEach(org => {
        const item = document.createElement('div');
        item.className = 'org-search-item';
        item.innerHTML = `
            <a href="/organizations/${org.id}" class="org-search-name">${escapeHtml(org.name)}</a>
            ${isAuthenticated ? `<button class="follow-btn-small ${org.is_following ? 'following' : ''}" data-org-id="${org.id}">
                ${org.is_following ? 'Unfollow' : 'Follow'}
            </button>` : ''}
        `;
        orgSearchResults.appendChild(item);
    });
    
    attachFollowHandlers();
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', function() {
    attachFollowHandlers();
});