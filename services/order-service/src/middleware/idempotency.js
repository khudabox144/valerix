const { redis } = require('../config/redis');
const logger = require('../config/logger');
const { idempotencyHits, idempotencyMisses } = require('../config/metrics');

const IDEMPOTENCY_TTL = 86400; // 24 hours

/**
 * Middleware to handle idempotency keys
 * Prevents duplicate order processing when requests are retried
 */
const idempotencyMiddleware = async (req, res, next) => {
  const idempotencyKey = req.headers['idempotency-key'];

  if (!idempotencyKey) {
    return res.status(400).json({
      error: 'Missing idempotency-key header',
      message: 'Idempotency-Key header is required for this operation',
    });
  }

  // Validate idempotency key is a non-empty string
  if (typeof idempotencyKey !== 'string' || idempotencyKey.trim().length === 0) {
    return res.status(400).json({
      error: 'Invalid idempotency-key format',
      message: 'Idempotency-Key must be a non-empty string',
    });
  }

  try {
    const cacheKey = `idempotency:${idempotencyKey}`;
    const cachedResponse = await redis.get(cacheKey);

    if (cachedResponse) {
      // This request was already processed
      idempotencyHits.inc();
      logger.info('Idempotency cache hit', { idempotencyKey });
      
      const response = JSON.parse(cachedResponse);
      return res.status(response.statusCode || 200).json(response.body);
    }

    // Cache miss - this is a new request
    idempotencyMisses.inc();
    logger.info('Idempotency cache miss', { idempotencyKey });

    // Store the idempotency key for this request
    req.idempotencyKey = idempotencyKey;

    // Override res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      const responseToCache = {
        statusCode: res.statusCode,
        body: body,
      };

      // Cache the response asynchronously (don't wait)
      redis.setex(cacheKey, IDEMPOTENCY_TTL, JSON.stringify(responseToCache))
        .then(() => {
          logger.info('Response cached for idempotency', { idempotencyKey });
        })
        .catch((error) => {
          logger.error('Failed to cache response', { 
            idempotencyKey, 
            error: error.message 
          });
        });

      return originalJson(body);
    };

    next();
  } catch (error) {
    logger.error('Idempotency middleware error', { 
      idempotencyKey, 
      error: error.message 
    });
    
    // Don't block the request if Redis is down
    req.idempotencyKey = idempotencyKey;
    next();
  }
};

module.exports = idempotencyMiddleware;
