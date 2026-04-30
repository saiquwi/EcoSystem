const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'ecosystem',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || 'postgres',
});

pool.on('connect', () => {
    console.log('Подключено к PostgreSQL');
});

pool.on('error', (err) => {
    console.error('Ошибка PostgreSQL:', err);
});

module.exports = {
    query: (text, params) => pool.query(text, params),
    pool
};