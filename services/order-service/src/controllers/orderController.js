const { v4: uuidv4 } = require('uuid');
const { pool } = require('../config/database');
const { redis } = require('../config/redis');
const { inventoryCircuitBreaker } = require('../services/circuitBreaker');
const logger = require('../config/logger');
const { 
  orderProcessingDuration, 
  ordersCreated 
} = require('../config/metrics');

/**
 * Create a new order
 */
const createOrder = async (req, res) => {
  const startTime = Date.now();
  const { item_id, quantity } = req.body;
  const idempotencyKey = req.idempotencyKey;

  // Validation
  if (!item_id || !quantity) {
    return res.status(400).json({
      error: 'Missing required fields',
      message: 'item_id and quantity are required',
    });
  }

  if (typeof quantity !== 'number' || quantity <= 0) {
    return res.status(400).json({
      error: 'Invalid quantity',
      message: 'Quantity must be a positive number',
    });
  }

  const orderId = uuidv4();
  let client;

  try {
    // Start database transaction
    client = await pool.connect();
    await client.query('BEGIN');

    logger.info('Creating order', { orderId, item_id, quantity, idempotencyKey });

    // Insert order into database
    const insertQuery = `
      INSERT INTO orders (order_id, item_id, quantity, status, idempotency_key)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const result = await client.query(insertQuery, [
      orderId,
      item_id,
      quantity,
      'pending',
      idempotencyKey,
    ]);

    const order = result.rows[0];

    // Call inventory service via circuit breaker
    let inventoryResult;
    try {
      inventoryResult = await inventoryCircuitBreaker.fire(item_id, quantity, orderId);
      
      if (inventoryResult.fallback) {
        // Circuit breaker fallback - order queued
        await client.query(
          'UPDATE orders SET status = $1 WHERE order_id = $2',
          ['queued', orderId]
        );
        
        // Publish to Redis Stream for async processing
        await redis.xadd(
          'inventory-updates',
          '*',
          'order_id', orderId,
          'item_id', item_id,
          'quantity', quantity.toString(),
          'action', 'deduct'
        );

        await client.query('COMMIT');
        
        const duration = (Date.now() - startTime) / 1000;
        orderProcessingDuration.observe({ status: 'queued' }, duration);
        ordersCreated.inc({ status: 'queued' });

        logger.info('Order queued due to circuit breaker', { orderId });

        return res.status(202).json({
          success: true,
          message: inventoryResult.message,
          order: {
            order_id: orderId,
            item_id,
            quantity,
            status: 'queued',
            created_at: order.created_at,
          },
        });
      }

      // Inventory updated successfully
      await client.query(
        'UPDATE orders SET status = $1 WHERE order_id = $2',
        ['confirmed', orderId]
      );

      await client.query('COMMIT');

      const duration = (Date.now() - startTime) / 1000;
      orderProcessingDuration.observe({ status: 'confirmed' }, duration);
      ordersCreated.inc({ status: 'confirmed' });

      logger.info('Order created successfully', { orderId });

      return res.status(201).json({
        success: true,
        message: 'Order created successfully',
        order: {
          order_id: orderId,
          item_id,
          quantity,
          status: 'confirmed',
          created_at: order.created_at,
        },
      });

    } catch (inventoryError) {
      // Inventory service error (not circuit breaker fallback)
      logger.error('Inventory service error', { 
        orderId, 
        error: inventoryError.message 
      });

      await client.query(
        'UPDATE orders SET status = $1 WHERE order_id = $2',
        ['failed', orderId]
      );

      await client.query('COMMIT');

      const duration = (Date.now() - startTime) / 1000;
      orderProcessingDuration.observe({ status: 'failed' }, duration);
      ordersCreated.inc({ status: 'failed' });

      return res.status(422).json({
        success: false,
        error: 'Inventory update failed',
        message: inventoryError.message,
        order: {
          order_id: orderId,
          status: 'failed',
        },
      });
    }

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }

    logger.error('Error creating order', { error: error.message, stack: error.stack });

    const duration = (Date.now() - startTime) / 1000;
    orderProcessingDuration.observe({ status: 'error' }, duration);

    // Check for duplicate idempotency key
    if (error.constraint === 'orders_idempotency_key_key') {
      return res.status(409).json({
        error: 'Duplicate request',
        message: 'An order with this idempotency key already exists',
      });
    }

    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to create order',
    });

  } finally {
    if (client) {
      client.release();
    }
  }
};

/**
 * Get order by ID
 */
const getOrder = async (req, res) => {
  const { id } = req.params;

  try {
    const query = 'SELECT * FROM orders WHERE order_id = $1';
    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Order not found',
        message: `No order found with ID: ${id}`,
      });
    }

    const order = result.rows[0];

    return res.json({
      success: true,
      order: {
        order_id: order.order_id,
        item_id: order.item_id,
        quantity: order.quantity,
        status: order.status,
        created_at: order.created_at,
        updated_at: order.updated_at,
      },
    });

  } catch (error) {
    logger.error('Error fetching order', { orderId: id, error: error.message });

    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch order',
    });
  }
};

/**
 * Get all orders
 */
const getAllOrders = async (req, res) => {
  try {
    const query = 'SELECT * FROM orders ORDER BY created_at DESC LIMIT 100';
    const result = await pool.query(query);

    return res.json({
      success: true,
      count: result.rows.length,
      orders: result.rows.map(order => ({
        order_id: order.order_id,
        item_id: order.item_id,
        quantity: order.quantity,
        status: order.status,
        created_at: order.created_at,
      })),
    });

  } catch (error) {
    logger.error('Error fetching orders', { error: error.message });

    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch orders',
    });
  }
};

module.exports = {
  createOrder,
  getOrder,
  getAllOrders,
};
