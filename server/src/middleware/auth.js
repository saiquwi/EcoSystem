const User = require('../models/User');

// Проверка, что пользователь авторизован
const isAuthenticated = (req, res, next) => {
    if (req.session.userId) {
        return next();
    }
    
    // Если это API запрос
    if (req.xhr || req.path.startsWith('/api/')) {
        return res.status(401).json({ error: 'Not authenticated' });
    }
    
    // Если это запрос страницы
    req.session.returnTo = req.originalUrl;
    res.redirect('/auth/login');
};

// Проверка, что пользователь НЕ авторизован (для страниц входа/регистрации)
const isGuest = (req, res, next) => {
    if (!req.session.userId) {
        return next();
    }
    res.redirect('/');
};

const isAdmin = async (req, res, next) => {
    if (!req.session.userId) {
        if (req.xhr || req.path.startsWith('/api/')) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
        return res.redirect('/auth/login');
    }
    
    try {
        const user = await User.findById(req.session.userId);
        if (user && user.role === 'admin') {
            req.user = user;
            return next();
        }
        
        if (req.xhr || req.path.startsWith('/api/')) {
            return res.status(403).json({ error: 'Forbidden: Admin access required' });
        }
        res.redirect('/dashboard');
    } catch (error) {
        console.error('Error checking admin role:', error);
        res.status(500).send('Server error');
    }
};

// Загрузка пользователя в res.locals для шаблонов
const loadUser = async (req, res, next) => {
    if (req.session.userId) {
        try {
            const user = await User.findById(req.session.userId);
            res.locals.user = user;
            res.locals.isAuthenticated = true;
            res.locals.isAdmin = user && user.role === 'admin';
        } catch (error) {
            console.error('Error loading user:', error);
            res.locals.isAuthenticated = false;
            res.locals.isAdmin = false;
        }
    } else {
        res.locals.isAuthenticated = false;
        res.locals.isAdmin = false;
    }
    next();
};

module.exports = {
    isAuthenticated,
    isGuest,
    isAdmin,
    loadUser
};