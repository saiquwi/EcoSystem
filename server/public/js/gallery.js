let currentPhotos = [];
let currentIndex = 0;

// Открыть галерею
function openGallery(photos, index) {
    if (!photos || photos.length === 0) return;
    
    currentPhotos = photos;
    currentIndex = index;
    
    const modal = document.getElementById('photoGalleryModal');
    const img = document.getElementById('galleryImage');
    const counter = document.getElementById('galleryCounter');
    
    if (!modal) return;
    
    img.src = currentPhotos[currentIndex];
    counter.textContent = `${currentIndex + 1} / ${currentPhotos.length}`;
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

// Закрыть галерею
function closeGallery() {
    const modal = document.getElementById('photoGalleryModal');
    if (modal) modal.style.display = 'none';
    document.body.style.overflow = '';
}

// Следующее фото
function nextPhoto() {
    if (currentIndex < currentPhotos.length - 1) {
        currentIndex++;
        const img = document.getElementById('galleryImage');
        const counter = document.getElementById('galleryCounter');
        img.src = currentPhotos[currentIndex];
        counter.textContent = `${currentIndex + 1} / ${currentPhotos.length}`;
    }
}

// Предыдущее фото
function prevPhoto() {
    if (currentIndex > 0) {
        currentIndex--;
        const img = document.getElementById('galleryImage');
        const counter = document.getElementById('galleryCounter');
        img.src = currentPhotos[currentIndex];
        counter.textContent = `${currentIndex + 1} / ${currentPhotos.length}`;
    }
}

// Привязываем обработчики к кнопкам
document.addEventListener('DOMContentLoaded', function() {
    const closeBtn = document.getElementById('closeGalleryModal');
    const prevBtn = document.getElementById('galleryPrev');
    const nextBtn = document.getElementById('galleryNext');
    const modal = document.getElementById('photoGalleryModal');
    
    if (closeBtn) closeBtn.onclick = closeGallery;
    if (prevBtn) prevBtn.onclick = prevPhoto;
    if (nextBtn) nextBtn.onclick = nextPhoto;
    if (modal) modal.onclick = function(e) {
        if (e.target === modal) closeGallery();
    };
    
    // Клавиатура
    document.onkeydown = function(e) {
        if (modal && modal.style.display === 'flex') {
            if (e.key === 'ArrowLeft') prevPhoto();
            if (e.key === 'ArrowRight') nextPhoto();
            if (e.key === 'Escape') closeGallery();
        }
    };
});

// Обработчик кликов по любым элементам с data-photos
document.addEventListener('click', function(e) {
    // Ищем ближайший элемент с data-photos (сама картинка или ее родитель)
    const target = e.target.closest('[data-photos]');
    if (!target) return;
    
    const photosJson = target.getAttribute('data-photos');
    const index = parseInt(target.getAttribute('data-index'));
    
    if (photosJson) {
        try {
            const photos = JSON.parse(photosJson);
            openGallery(photos, index);
        } catch(err) {
            console.error('Failed to parse photos:', err);
        }
    }
});

// Делаем функции глобальными
window.openGallery = openGallery;
window.closeGallery = closeGallery;
window.nextPhoto = nextPhoto;
window.prevPhoto = prevPhoto;