const redis = require('redis');

const redisClient = redis.createClient({
    url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
});

redisClient.on('error', (err) => {
    console.error('❌ Redis Client Error:', err);
});

redisClient.on('connect', () => {
    console.log('✅ Redis Client Connected');
});

// Подключаемся при старте
(async () => {
    try {
        await redisClient.connect();
    } catch (error) {
        console.error('❌ Failed to connect to Redis:', error);
    }
})();

module.exports = redisClient;