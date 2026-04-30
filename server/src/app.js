const express = require('express');
const path = require('path');
require('dotenv').config();

// Новые подключения
const sessionConfig = require('../config/session');
const { loadUser, isAuthenticated } = require('./middleware/auth');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));
app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

// Сессии
app.use(sessionConfig);

// Загрузка пользователя для шаблонов
app.use(loadUser);

// Настройка шаблонизатора
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../views'));

const methodOverride = require('method-override');
app.use(methodOverride('_method'));

// Маршруты
const authRoutes = require('./routes/authRoutes');
app.use('/auth', authRoutes);

const adminRoutes = require('./routes/adminRoutes');
app.use('/admin', adminRoutes);

// Главная страница
app.get('/', (req, res) => {
    res.render('pages/index', { 
        title: 'EcoSystem - Environmental Platform'
    });
});

app.get('/dashboard', isAuthenticated, async (req, res) => {
    try {
        const User = require('./models/User');
        const user = await User.findById(req.session.userId);
        const stats = await User.getUserStats(req.session.userId);
        const badges = await User.getUserBadges(req.session.userId);
        const skills = await User.getUserSkills(req.session.userId);
        
        res.render('pages/dashboard', {
            title: 'Dashboard',
            user,
            stats,
            badges,
            skills,
            currentPage: 'dashboard'
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.redirect('/');
    }
});

app.get('/map', (req, res) => {
    res.render('pages/map', { 
        title: 'Environmental Map'
    });
});

const problemRoutes = require('./routes/problemRoutes');
app.use('/problems', problemRoutes);

const organizationRoutes = require('./routes/organizationRoutes');
app.use('/organizations', organizationRoutes);

// Тестовый маршрут для проверки БД
app.get('/db-test', async (req, res) => {
    try {
        const db = require('../config/db');
        const result = await db.query('SELECT NOW() as time');
        res.json({ 
            status: '✅ Database connected',
            time: result.rows[0].time,
            message: 'EcoSystem is running!'
        });
    } catch (error) {
        console.error('DB test error:', error);
        res.status(500).json({ 
            status: '❌ Database connection failed',
            error: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server running on http://localhost:${PORT}`);
});