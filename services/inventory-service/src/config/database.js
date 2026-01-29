const { Pool } = require('pg');
const logger = require('./logger');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  user: process.env.DB_USER || 'valerix',
  password: process.env.DB_PASSWORD || 'valerix123',
  database: process.env.DB_NAME || 'inventory_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Unexpected PostgreSQL error', { error: err.message });
});

pool.on('connect', () => {
  logger.info('PostgreSQL connection established');
});

// Health check function
const checkDatabaseHealth = async () => {
  try {
    const result = await pool.query('SELECT 1');
    // Also check if inventory table exists
    await pool.query('SELECT COUNT(*) FROM inventory LIMIT 1');
    return { healthy: true };
  } catch (error) {
    logger.error('Database health check failed', { error: error.message });
    return { healthy: false, error: error.message };
  }
};

module.exports = {
  pool,
  checkDatabaseHealth,
};
