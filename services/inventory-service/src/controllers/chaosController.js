const { redis } = require('../config/redis');
const logger = require('../config/logger');

/**
 * Enable/Disable chaos engineering
 * This is the "demo switch" for presentations
 */
const setChaosMode = async (req, res) => {
  const { latency, latency_ms, crash_rate, partial_failure_rate } = req.body;

  const config = {
    latency: latency || false,
    latency_ms: latency_ms || 5000,
    crash_rate: crash_rate || 0,
    partial_failure_rate: partial_failure_rate || 0,
  };

  try {
    await redis.set('chaos_config', JSON.stringify(config));

    logger.info('Chaos mode updated', config);

    return res.json({
      success: true,
      message: 'Chaos configuration updated',
      config: config,
    });

  } catch (error) {
    logger.error('Error setting chaos mode', { error: error.message });

    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to update chaos configuration',
    });
  }
};

/**
 * Get current chaos configuration
 */
const getChaosMode = async (req, res) => {
  try {
    const chaosConfig = await redis.get('chaos_config');

    if (!chaosConfig) {
      return res.json({
        success: true,
        chaos_enabled: false,
        config: {
          latency: false,
          crash_rate: 0,
          partial_failure_rate: 0,
        },
      });
    }

    const config = JSON.parse(chaosConfig);

    return res.json({
      success: true,
      chaos_enabled: true,
      config: config,
    });

  } catch (error) {
    logger.error('Error getting chaos mode', { error: error.message });

    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to get chaos configuration',
    });
  }
};

/**
 * Disable all chaos engineering
 */
const disableChaos = async (req, res) => {
  try {
    await redis.del('chaos_config');

    logger.info('Chaos mode disabled');

    return res.json({
      success: true,
      message: 'Chaos engineering disabled',
    });

  } catch (error) {
    logger.error('Error disabling chaos mode', { error: error.message });

    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to disable chaos mode',
    });
  }
};

module.exports = {
  setChaosMode,
  getChaosMode,
  disableChaos,
};
