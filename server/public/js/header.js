// Mobile menu toggle
(function() {
    const mobileBtn = document.getElementById('mobileMenuBtn');
    const navLinks = document.querySelector('.nav-links');
    
    if (mobileBtn && navLinks) {
        mobileBtn.addEventListener('click', function() {
            navLinks.classList.toggle('show');
        });
        
        // Close menu when clicking outside (optional)
        document.addEventListener('click', function(event) {
            if (!navLinks.contains(event.target) && !mobileBtn.contains(event.target)) {
                navLinks.classList.remove('show');
            }
        });
    }
})();