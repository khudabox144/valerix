const { pool } = require('../config/database');
const logger = require('../config/logger');
const { simulatePartialFailure } = require('../middleware/gremlin');
const { 
  inventoryUpdateDuration, 
  inventoryStockLevel,
  inventoryTransactions 
} = require('../config/metrics');

/**
 * Deduct stock from inventory
 */
const deductStock = async (req, res) => {
  const startTime = Date.now();
  const { item_id, quantity, order_id } = req.body;

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

  let client;

  try {
    // Start database transaction
    client = await pool.connect();
    await client.query('BEGIN');

    // 🔑 IDEMPOTENCY CHECK: Check if this order_id was already processed
    if (order_id) {
      const idempotencyCheck = `
        SELECT * FROM inventory_transactions 
        WHERE order_id = $1 AND transaction_type = 'deduct'
        LIMIT 1
      `;
      const existingTransaction = await client.query(idempotencyCheck, [order_id]);
      
      if (existingTransaction.rows.length > 0) {
        await client.query('COMMIT');
        logger.info('⚡ IDEMPOTENCY: Order already processed, returning success', { 
          order_id, 
          item_id 
        });
        
        // Get current item state
        const itemQuery = 'SELECT * FROM inventory WHERE item_id = $1';
        const itemResult = await client.query(itemQuery, [item_id]);
        
        return res.status(200).json({
          success: true,
          message: 'Stock already deducted (idempotent response)',
          idempotent: true,
          item: itemResult.rows[0] ? {
            item_id: itemResult.rows[0].item_id,
            item_name: itemResult.rows[0].item_name,
            quantity: itemResult.rows[0].quantity,
            reserved_quantity: itemResult.rows[0].reserved_quantity,
          } : null,
        });
      }
    }

    logger.info('Deducting stock', { item_id, quantity, order_id });

    // Check current stock
    const checkQuery = 'SELECT * FROM inventory WHERE item_id = $1 FOR UPDATE';
    const checkResult = await client.query(checkQuery, [item_id]);

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        error: 'Item not found',
        message: `Item ${item_id} does not exist in inventory`,
      });
    }

    const item = checkResult.rows[0];

    if (item.quantity < quantity) {
      await client.query('ROLLBACK');
      return res.status(422).json({
        error: 'Insufficient stock',
        message: `Only ${item.quantity} units available, requested ${quantity}`,
        available: item.quantity,
        requested: quantity,
      });
    }

    // Deduct stock
    const updateQuery = `
      UPDATE inventory 
      SET quantity = quantity - $1, 
          updated_at = CURRENT_TIMESTAMP 
      WHERE item_id = $2 
      RETURNING *
    `;
    const updateResult = await client.query(updateQuery, [quantity, item_id]);
    const updatedItem = updateResult.rows[0];

    // Record transaction
    const transactionQuery = `
      INSERT INTO inventory_transactions (item_id, order_id, quantity_change, transaction_type)
      VALUES ($1, $2, $3, $4)
    `;
    await client.query(transactionQuery, [item_id, order_id || 'unknown', -quantity, 'deduct']);

    // Commit transaction - THIS IS THE CRITICAL POINT
    await client.query('COMMIT');

    logger.info('Stock deducted successfully', { 
      item_id, 
      quantity, 
      remaining: updatedItem.quantity 
    });

    // Update metrics
    const duration = (Date.now() - startTime) / 1000;
    inventoryUpdateDuration.observe({ operation: 'deduct' }, duration);
    inventoryStockLevel.set({ item_id }, updatedItem.quantity);
    inventoryTransactions.inc({ type: 'deduct' });

    // ⚠️ SCHRÖDINGER'S WAREHOUSE SIMULATION ⚠️
    // Check if we should simulate partial failure
    // This happens AFTER commit but BEFORE response
    const partialFailureOccurred = simulatePartialFailure(req, res);
    if (partialFailureOccurred) {
      // Response already sent or connection destroyed
      logger.error('⚠️ PARTIAL FAILURE: DB committed but response failed', {
        item_id,
        quantity,
        order_id,
      });
      return; // Don't send another response
    }

    // Normal success response
    return res.status(200).json({
      success: true,
      message: 'Stock deducted successfully',
      item: {
        item_id: updatedItem.item_id,
        item_name: updatedItem.item_name,
        quantity: updatedItem.quantity,
        reserved_quantity: updatedItem.reserved_quantity,
      },
    });

  } catch (error) {
    if (client) {
      await client.query('ROLLBACK');
    }

    logger.error('Error deducting stock', { 
      item_id, 
      error: error.message, 
      stack: error.stack 
    });

    const duration = (Date.now() - startTime) / 1000;
    inventoryUpdateDuration.observe({ operation: 'deduct_error' }, duration);

    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to deduct stock',
    });

  } finally {
    if (client) {
      client.release();
    }
  }
};

/**
 * Get stock information for an item
 */
const getStock = async (req, res) => {
  const { item_id } = req.params;

  try {
    const query = 'SELECT * FROM inventory WHERE item_id = $1';
    const result = await pool.query(query, [item_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: 'Item not found',
        message: `Item ${item_id} does not exist in inventory`,
      });
    }

    const item = result.rows[0];

    return res.json({
      success: true,
      item: {
        item_id: item.item_id,
        item_name: item.item_name,
        quantity: item.quantity,
        reserved_quantity: item.reserved_quantity,
        created_at: item.created_at,
        updated_at: item.updated_at,
      },
    });

  } catch (error) {
    logger.error('Error fetching stock', { item_id, error: error.message });

    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch stock information',
    });
  }
};

/**
 * Get all inventory items
 */
const getAllInventory = async (req, res) => {
  try {
    const query = 'SELECT * FROM inventory ORDER BY item_name';
    const result = await pool.query(query);

    // Update metrics for all items
    result.rows.forEach(item => {
      inventoryStockLevel.set({ item_id: item.item_id }, item.quantity);
    });

    return res.json({
      success: true,
      count: result.rows.length,
      items: result.rows.map(item => ({
        item_id: item.item_id,
        item_name: item.item_name,
        quantity: item.quantity,
        reserved_quantity: item.reserved_quantity,
      })),
    });

  } catch (error) {
    logger.error('Error fetching inventory', { error: error.message });

    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to fetch inventory',
    });
  }
};

module.exports = {
  deductStock,
  getStock,
  getAllInventory,
};
