const session = require('express-session');
const { RedisStore } = require('connect-redis');
const redisClient = require('./redis');

module.exports = session({
    store: new RedisStore({ 
        client: redisClient,
        prefix: 'session:'
    }),
    secret: process.env.SESSION_SECRET || 'ecosystem-secret-key-change-in-production',
    resave: false,
    saveUninitialized: false,
    name: 'ecosystem.sid', // имя куки
    cookie: {
        secure: process.env.NODE_ENV === 'production', // HTTPS в продакшене
        httpOnly: true, // нельзя получить через JavaScript
        maxAge: 1000 * 60 * 60 * 24 * 7, // 7 дней
        sameSite: 'lax'
    },
    rolling: true // обновлять куку при каждом запросе
});