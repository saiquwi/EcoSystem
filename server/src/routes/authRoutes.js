const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { isGuest, isAuthenticated } = require('../middleware/auth');
const { 
    validateRegistrationMiddleware, 
    validateLoginMiddleware,
    validateProfileUpdateMiddleware 
} = require('../middleware/validation');

router.get('/api/me', authController.getCurrentUser);

// Регистрация 
router.get('/register', isGuest, authController.getRegister);
router.post('/register', isGuest, validateRegistrationMiddleware, authController.postRegister);

// Вход 
router.get('/login', isGuest, authController.getLogin);
router.post('/login', isGuest, validateLoginMiddleware, authController.postLogin);

// Профиль
router.get('/profile', isAuthenticated, authController.getProfile);
router.post('/profile', isAuthenticated, validateProfileUpdateMiddleware, authController.updateProfile);

// Навыки
router.post('/profile/add-skill', isAuthenticated, authController.addSkill);
router.post('/profile/remove-skill', isAuthenticated, authController.removeSkill);

// Badges (только просмотр, выдача автоматическая)
router.get('/profile/badges', isAuthenticated, authController.getBadges);

// Выход
router.get('/logout', authController.logout);

module.exports = router;