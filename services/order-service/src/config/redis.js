const Redis = require('ioredis');
const logger = require('./logger');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  reconnectOnError: (err) => {
    logger.error('Redis reconnect on error', { error: err.message });
    return true;
  },
});

redis.on('connect', () => {
  logger.info('Redis connection established');
});

redis.on('error', (err) => {
  logger.error('Redis error', { error: err.message });
});

redis.on('ready', () => {
  logger.info('Redis client ready');
});

// Health check function
const checkRedisHealth = async () => {
  try {
    await redis.ping();
    return { healthy: true };
  } catch (error) {
    logger.error('Redis health check failed', { error: error.message });
    return { healthy: false, error: error.message };
  }
};

module.exports = {
  redis,
  checkRedisHealth,
};
