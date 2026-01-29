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
  buckets: [0.1, 0.5, 1, 2, 5],
  registers: [register],
});

const orderProcessingDuration = new client.Histogram({
  name: 'order_processing_duration_seconds',
  help: 'Duration of order processing in seconds',
  labelNames: ['status'],
  buckets: [0.5, 1, 2, 5, 10],
  registers: [register],
});

const circuitBreakerState = new client.Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state (0=closed, 1=open, 2=half-open)',
  labelNames: ['service'],
  registers: [register],
});

const idempotencyHits = new client.Counter({
  name: 'idempotency_cache_hits_total',
  help: 'Number of idempotency cache hits',
  registers: [register],
});

const idempotencyMisses = new client.Counter({
  name: 'idempotency_cache_misses_total',
  help: 'Number of idempotency cache misses',
  registers: [register],
});

const ordersCreated = new client.Counter({
  name: 'orders_created_total',
  help: 'Total number of orders created',
  labelNames: ['status'],
  registers: [register],
});

const gremlinLatency = new client.Gauge({
  name: 'gremlin_latency_ms',
  help: 'Current chaos latency injection in milliseconds',
  registers: [register],
});

const gremlinCrashRate = new client.Gauge({
  name: 'gremlin_crash_rate',
  help: 'Current chaos crash rate percentage (0-100)',
  registers: [register],
});

const gremlinPartialFailure = new client.Gauge({
  name: 'gremlin_partial_failure_rate',
  help: 'Current chaos partial failure rate percentage (0-100)',
  registers: [register],
});

module.exports = {
  register,
  httpRequestDuration,
  orderProcessingDuration,
  circuitBreakerState,
  idempotencyHits,
  idempotencyMisses,
  ordersCreated,
  gremlinLatency,
  gremlinCrashRate,
  gremlinPartialFailure,
};
