const axios = require('axios');
const { checkDatabaseHealth } = require('../config/database');
const { checkRedisHealth } = require('../config/redis');
const { INVENTORY_SERVICE_URL } = require('../services/circuitBreaker');
const logger = require('../config/logger');

/**
 * Basic health check
 */
const healthCheck = async (req, res) => {
  const dbHealth = await checkDatabaseHealth();
  const redisHealth = await checkRedisHealth();

  const healthy = dbHealth.healthy && redisHealth.healthy;

  const response = {
    service: 'order-service',
    status: healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: {
      database: dbHealth.healthy ? 'up' : 'down',
      redis: redisHealth.healthy ? 'up' : 'down',
    },
    details: {
      database: dbHealth.details || {},
      redis: redisHealth.details || {},
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

/**
 * Deep health check - includes downstream dependencies
 */
const deepHealthCheck = async (req, res) => {
  const dbHealth = await checkDatabaseHealth();
  const redisHealth = await checkRedisHealth();
  
  // Check inventory service
  let inventoryHealth = { healthy: false };
  try {
    const response = await axios.get(`${INVENTORY_SERVICE_URL}/health`, {
      timeout: 2000,
    });
    inventoryHealth = { 
      healthy: response.status === 200,
      status: response.data.status 
    };
  } catch (error) {
    logger.error('Inventory service health check failed', { error: error.message });
    inventoryHealth = { 
      healthy: false, 
      error: error.message 
    };
  }

  const healthy = dbHealth.healthy && redisHealth.healthy && inventoryHealth.healthy;

  const response = {
    service: 'order-service',
    status: healthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    checks: {
      database: dbHealth.healthy ? 'up' : 'down',
      redis: redisHealth.healthy ? 'up' : 'down',
      inventory_service: inventoryHealth.healthy ? 'up' : 'down',
    },
  };

  if (!dbHealth.healthy) {
    response.checks.database_error = dbHealth.error;
  }

  if (!redisHealth.healthy) {
    response.checks.redis_error = redisHealth.error;
  }

  if (!inventoryHealth.healthy) {
    response.checks.inventory_error = inventoryHealth.error;
  }

  return res.status(healthy ? 200 : 503).json(response);
};

module.exports = {
  healthCheck,
  deepHealthCheck,
};
