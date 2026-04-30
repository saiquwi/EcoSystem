const multer = require('multer');
const path = require('path');
const fs = require('fs');

const uploadDir = path.join(__dirname, '../../public/uploads');
const problemsDir = path.join(uploadDir, 'problems');
const postsDir = path.join(uploadDir, 'posts');

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(problemsDir)) {
    fs.mkdirSync(problemsDir, { recursive: true });
}
if (!fs.existsSync(postsDir)) {
    fs.mkdirSync(postsDir, { recursive: true });
}

// Настройка хранилища для проблем
const problemStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, problemsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `problem-${uniqueSuffix}${ext}`);
    }
});

// Настройка хранилища для постов
const postStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, postsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `post-${uniqueSuffix}${ext}`);
    }
});

// Фильтр файлов (только изображения)
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Only images are allowed (jpeg, png, gif, webp)'), false);
    }
};

// Настройка multer для проблем
const uploadProblems = multer({
    storage: problemStorage,
    fileFilter: fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB max
        files: 5
    }
}).array('photos', 5);

// Настройка multer для постов
const uploadPosts = (req, res, next) => {
    const upload = multer({
        storage: postStorage,
        fileFilter: fileFilter,
        limits: {
            fileSize: 5 * 1024 * 1024, // 5MB max
            files: 5
        }
    }).array('photos', 5);
    
    upload(req, res, (err) => {
        if (err) {
            if (err.code === 'LIMIT_FILE_SIZE') {
                req.fileValidationError = 'Each photo must be less than 5MB';
            } else if (err.code === 'LIMIT_FILE_COUNT') {
                req.fileValidationError = 'Maximum 5 photos allowed per post';
            } else if (err.code === 'LIMIT_UNEXPECTED_FILE') {
                req.fileValidationError = 'Invalid file field name';
            } else {
                req.fileValidationError = err.message || 'Error uploading files';
            }
            return next();
        }
        next();
    });
};

module.exports = {
    uploadProblems,
    uploadPosts
};