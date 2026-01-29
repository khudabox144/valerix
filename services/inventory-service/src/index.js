const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { register, httpRequestDuration } = require('./config/metrics');
const { healthCheck } = require('./controllers/healthController');
const { 
  deductStock, 
  getStock, 
  getAllInventory 
} = require('./controllers/inventoryController');
const { 
  setChaosMode, 
  getChaosMode, 
  disableChaos 
} = require('./controllers/chaosController');
const { gremlinMiddleware } = require('./middleware/gremlin');
const logger = require('./config/logger');

const app = express();
const PORT = process.env.PORT || 3002;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.observe(
      {
        method: req.method,
        route: req.route ? req.route.path : req.path,
        status_code: res.statusCode,
      },
      duration
    );

    logger.info('HTTP request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration.toFixed(3)}s`,
      userAgent: req.get('user-agent'),
    });
  });

  next();
});

// Health endpoint (no chaos)
app.get('/health', healthCheck);

// Metrics endpoint for Prometheus (no chaos)
app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Admin endpoints for chaos control (no chaos applied here)
app.post('/api/admin/chaos', setChaosMode);
app.get('/api/admin/chaos', getChaosMode);
app.delete('/api/admin/chaos', disableChaos);

// Apply chaos middleware to API routes
app.use('/api', gremlinMiddleware);

// Inventory API routes (chaos applied)
app.post('/api/inventory/deduct', deductStock);
app.get('/api/inventory/:item_id', getStock);
app.get('/api/inventory', getAllInventory);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not found',
    message: `Route ${req.method} ${req.url} not found`,
  });
});

// Error handler
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });

  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong',
  });
});

// Graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, closing gracefully...');
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    const { pool } = require('./config/database');
    await pool.end();
    logger.info('Database connections closed');
    
    const { redis } = require('./config/redis');
    redis.disconnect();
    logger.info('Redis connection closed');
    
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const server = app.listen(PORT, () => {
  logger.info(`Inventory Service listening on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info(`Health check: http://localhost:${PORT}/health`);
  logger.info(`Metrics: http://localhost:${PORT}/metrics`);
  logger.info(`⚡ Chaos Control: http://localhost:${PORT}/api/admin/chaos`);
});

module.exports = app;
