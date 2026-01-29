const { checkDatabaseHealth } = require('../config/database');
const { checkRedisHealth } = require('../config/redis');
const logger = require('../config/logger');

/**
 * Basic health check
 */
const healthCheck = async (req, res) => {
  const dbHealth = await checkDatabaseHealth();
  const redisHealth = await checkRedisHealth();

  const healthy = dbHealth.healthy && redisHealth.healthy;

  const response = {
    service: 'inventory-service',
    status: healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: {
      database: dbHealth.healthy ? 'up' : 'down',
      redis: redisHealth.healthy ? 'up' : 'down',
    },
  };

  if (!dbHealth.healthy) {
    response.checks.database_error = dbHealth.error;
  }

  if (!redisHealth.healthy) {
    response.checks.redis_error = redisHealth.error;
  }

  return res.status(healthy ? 200 : 503).json(response);
};

module.exports = {
  healthCheck,
};
