const { redis } = require('../config/redis');
const logger = require('../config/logger');
const { inventoryChaosEnabled, inventoryChaosEvents } = require('../config/metrics');

/**
 * Chaos Engineering Middleware - The Gremlin
 * Introduces predictable latency and crashes based on Redis configuration
 */
const gremlinMiddleware = async (req, res, next) => {
  try {
    // Check if chaos mode is enabled
    const chaosConfig = await redis.get('chaos_config');
    
    if (!chaosConfig) {
      // Reset all chaos metrics to 0 when disabled
      inventoryChaosEnabled.set({ type: 'latency' }, 0);
      inventoryChaosEnabled.set({ type: 'crash' }, 0);
      inventoryChaosEnabled.set({ type: 'partial_failure' }, 0);
      return next();
    }

    const config = JSON.parse(chaosConfig);

    // Latency Gremlin - Introduces delays
    if (config.latency === true || config.latency === 'true') {
      const delay = config.latency_ms || 5000; // Default 5 seconds
      
      logger.warn('🔴 GREMLIN: Introducing latency', { 
        delay_ms: delay,
        path: req.path 
      });

      inventoryChaosEnabled.set({ type: 'latency' }, delay);
      inventoryChaosEvents.inc({ type: 'latency' });

      await new Promise(resolve => setTimeout(resolve, delay));
    } else {
      inventoryChaosEnabled.set({ type: 'latency' }, 0);
    }

    // Crash Gremlin - Random failures
    if (config.crash_rate && typeof config.crash_rate === 'number') {
      const shouldCrash = Math.random() < config.crash_rate;

      if (shouldCrash) {
        logger.error('🔴 GREMLIN: Simulating crash', { 
          crash_rate: config.crash_rate,
          path: req.path 
        });

        inventoryChaosEnabled.set({ type: 'crash' }, 1);
        inventoryChaosEvents.inc({ type: 'crash' });

        // Simulate different types of failures
        const failureType = Math.random();

        if (failureType < 0.33) {
          // Internal Server Error
          return res.status(500).json({
            error: 'Internal Server Error',
            message: 'Service crashed during processing (simulated)',
          });
        } else if (failureType < 0.66) {
          // Database timeout simulation
          return res.status(503).json({
            error: 'Service Unavailable',
            message: 'Database timeout (simulated)',
          });
        } else {
          // Connection reset - just close the connection without response
          if (req.socket && !req.socket.destroyed) {
            req.socket.destroy();
          }
          return;
        }
      }

      inventoryChaosEnabled.set({ type: 'crash' }, config.crash_rate);
    } else {
      inventoryChaosEnabled.set({ type: 'crash' }, 0);
    }

    // Partial Success Gremlin - "Schrödinger's Warehouse"
    // This will be handled in the controller after DB commit
    if (config.partial_failure_rate && typeof config.partial_failure_rate === 'number') {
      req.chaosPartialFailure = {
        enabled: true,
        rate: config.partial_failure_rate,
      };
      inventoryChaosEnabled.set({ type: 'partial_failure' }, config.partial_failure_rate);
    } else {
      inventoryChaosEnabled.set({ type: 'partial_failure' }, 0);
    }

    next();

  } catch (error) {
    logger.error('Gremlin middleware error', { error: error.message });
    // Don't let chaos middleware break the service
    next();
  }
};

/**
 * Simulate "crash after commit" scenario
 * Used in controllers after DB transaction
 */
const simulatePartialFailure = (req, res) => {
  if (req.chaosPartialFailure && req.chaosPartialFailure.enabled) {
    const shouldFail = Math.random() < req.chaosPartialFailure.rate;

    if (shouldFail) {
      logger.error('🔴 GREMLIN: Simulating partial failure (commit succeeded, response failed)', {
        rate: req.chaosPartialFailure.rate,
      });

      inventoryChaosEvents.inc({ type: 'partial_failure' });

      // Randomly choose failure type
      const failureType = Math.random();

      if (failureType < 0.5) {
        // Return 500 error even though DB commit succeeded
        res.status(500).json({
          error: 'Internal Server Error',
          message: 'Response failed after commit (simulated Schrödinger scenario)',
        });
        return true; // Indicate that response was sent
      } else {
        // Destroy connection without response
        if (res.socket && !res.socket.destroyed) {
          res.socket.destroy();
        }
        return true; // Indicate that connection was destroyed
      }
    }
  }

  return false; // No partial failure
};

module.exports = {
  gremlinMiddleware,
  simulatePartialFailure,
};
