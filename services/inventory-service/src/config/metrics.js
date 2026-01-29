const client = require('prom-client');

// Create a Registry
const register = new client.Registry();

// Add default metrics
client.collectDefaultMetrics({ register });

// Custom metrics
const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10],
  registers: [register],
});

const inventoryUpdateDuration = new client.Histogram({
  name: 'inventory_update_duration_seconds',
  help: 'Duration of inventory update operations',
  labelNames: ['operation'],
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

const inventoryChaosEnabled = new client.Gauge({
  name: 'inventory_chaos_enabled',
  help: 'Whether chaos engineering is enabled (1=yes, 0=no)',
  labelNames: ['type'],
  registers: [register],
});

const inventoryChaosEvents = new client.Counter({
  name: 'inventory_chaos_events_total',
  help: 'Total number of chaos events triggered',
  labelNames: ['type'],
  registers: [register],
});

const inventoryStockLevel = new client.Gauge({
  name: 'inventory_stock_level',
  help: 'Current stock level for items',
  labelNames: ['item_id'],
  registers: [register],
});

const inventoryTransactions = new client.Counter({
  name: 'inventory_transactions_total',
  help: 'Total number of inventory transactions',
  labelNames: ['type'],
  registers: [register],
});

module.exports = {
  register,
  httpRequestDuration,
  inventoryUpdateDuration,
  inventoryChaosEnabled,
  inventoryChaosEvents,
  inventoryStockLevel,
  inventoryTransactions,
};
