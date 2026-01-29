const CircuitBreaker = require('opossum');
const axios = require('axios');
const logger = require('../config/logger');
const { circuitBreakerState } = require('../config/metrics');

const INVENTORY_SERVICE_URL = process.env.INVENTORY_SERVICE_URL || 'http://localhost:3002';

// Circuit breaker options
const options = {
  timeout: 3000, // 3 seconds timeout
  errorThresholdPercentage: 50, // Open circuit if 50% of requests fail
  resetTimeout: 10000, // Try again after 10 seconds
  rollingCountTimeout: 10000,
  rollingCountBuckets: 10,
  name: 'inventory-service',
};

/**
 * Call inventory service to deduct stock
 */
const callInventoryService = async (itemId, quantity, orderId) => {
  logger.info('Calling inventory service', { itemId, quantity, orderId });

  try {
    const response = await axios.post(
      `${INVENTORY_SERVICE_URL}/api/inventory/deduct`,
      {
        item_id: itemId,
        quantity: quantity,
        order_id: orderId,
      },
      {
        timeout: 3000,
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (error) {
    if (error.response) {
      // The request was made and the server responded with a status code
      logger.error('Inventory service error response', {
        status: error.response.status,
        data: error.response.data,
      });
      throw new Error(error.response.data.error || 'Inventory service error');
    } else if (error.request) {
      // The request was made but no response was received
      logger.error('No response from inventory service', { error: error.message });
      throw new Error('Inventory service not responding');
    } else {
      // Something happened in setting up the request
      logger.error('Error calling inventory service', { error: error.message });
      throw error;
    }
  }
};

// Create circuit breaker
const breaker = new CircuitBreaker(callInventoryService, options);

// Fallback function when circuit is open
breaker.fallback((itemId, quantity, orderId) => {
  logger.warn('Circuit breaker fallback triggered', { itemId, quantity, orderId });
  return {
    success: false,
    fallback: true,
    message: 'Inventory service is currently unavailable. Your order has been queued for processing.',
    orderId: orderId,
  };
});

// Event listeners for monitoring
breaker.on('open', () => {
  logger.warn('Circuit breaker opened - inventory service is failing');
  circuitBreakerState.set({ service: 'inventory' }, 1);
});

breaker.on('halfOpen', () => {
  logger.info('Circuit breaker half-open - testing inventory service');
  circuitBreakerState.set({ service: 'inventory' }, 2);
});

breaker.on('close', () => {
  logger.info('Circuit breaker closed - inventory service is healthy');
  circuitBreakerState.set({ service: 'inventory' }, 0);
});

breaker.on('success', (result) => {
  logger.debug('Circuit breaker success', { result });
});

breaker.on('failure', (error) => {
  logger.error('Circuit breaker failure', { error: error.message });
});

breaker.on('timeout', () => {
  logger.error('Circuit breaker timeout - inventory service too slow');
});

breaker.on('fallback', (result) => {
  logger.warn('Circuit breaker fallback executed', { result });
});

module.exports = {
  inventoryCircuitBreaker: breaker,
  INVENTORY_SERVICE_URL,
};
