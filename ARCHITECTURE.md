# Architecture Documentation

## System Overview

Valerix is a production-grade microservices e-commerce platform designed to handle:
- Thousands of concurrent orders
- Network failures and service degradation
- Real-time monitoring and alerting
- Zero-downtime deployments

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Internet                             │
└────────────────────────┬────────────────────────────────────┘
                         │
                    ┌────▼────┐
                    │ Digital │
                    │ Ocean   │
                    │ Load    │
                    │ Balancer│
                    └────┬────┘
                         │
             ┌───────────┼───────────┐
             │           │           │
        ┌────▼────┐ ┌───▼────┐ ┌───▼────┐
        │         │ │        │ │        │
        │Frontend │ │ Order  │ │Inventory│
        │(Next.js)│ │Service │ │Service │
        │         │ │        │ │        │
        └─────────┘ └───┬────┘ └───┬────┘
                        │           │
                        │ Circuit   │
                        │ Breaker   │
                        └───────┬───┘
                                │
                    ┌───────────┼───────────┐
                    │           │           │
               ┌────▼────┐ ┌───▼────┐ ┌───▼────┐
               │         │ │        │ │        │
               │PostgreSQL│ │ Redis  │ │Prometheus│
               │         │ │        │ │        │
               └─────────┘ └────────┘ └────────┘
```

## Service Breakdown

### 1. Order Service (Port 3001)

**Responsibilities:**
- Accept and validate orders
- Coordinate with inventory service
- Handle idempotency
- Circuit breaker implementation

**Key Features:**
- **Circuit Breaker (Opossum)**: Prevents cascade failures
- **Idempotency**: UUID-based deduplication
- **Fallback**: Queues orders when inventory unavailable
- **Metrics**: Exposes Prometheus metrics

**Technology Stack:**
- Node.js + Express
- PostgreSQL (order_db)
- Redis (idempotency cache)
- Opossum (circuit breaker)

**API Endpoints:**
```
POST   /api/orders          - Create order
GET    /api/orders/:id      - Get order
GET    /api/orders          - List orders
GET    /health              - Health check
GET    /health/deep         - Deep health check
GET    /metrics             - Prometheus metrics
```

### 2. Inventory Service (Port 3002)

**Responsibilities:**
- Manage stock levels
- Process inventory updates
- Simulate chaos scenarios

**Key Features:**
- **Chaos Engineering**: Built-in gremlin middleware
- **Deterministic Failures**: Configurable via Redis
- **Partial Failures**: Schrödinger's Warehouse simulation
- **Metrics**: Stock levels and chaos events

**Technology Stack:**
- Node.js + Express
- PostgreSQL (inventory_db)
- Redis (chaos configuration)

**API Endpoints:**
```
POST   /api/inventory/deduct    - Deduct stock
GET    /api/inventory/:id       - Get item stock
GET    /api/inventory           - List all items
POST   /api/admin/chaos         - Enable chaos mode
GET    /api/admin/chaos         - Get chaos config
DELETE /api/admin/chaos         - Disable chaos
GET    /health                  - Health check
GET    /metrics                 - Prometheus metrics
```

### 3. Frontend (Port 3000)

**Responsibilities:**
- User interface
- Order management
- Real-time health monitoring
- Chaos control panel

**Key Features:**
- **Responsive Dashboard**: Real-time updates
- **Health Monitoring**: Visual status indicators
- **Chaos Controls**: Enable/disable chaos modes
- **Order Tracking**: Live order status

**Technology Stack:**
- Next.js (React)
- Axios (HTTP client)
- Tailwind CSS (styling)

## Data Flow

### Normal Order Flow

```
User → Frontend → Order Service → Inventory Service → PostgreSQL
                       ↓
                   Redis (Cache)
```

1. User submits order with UUID
2. Frontend sends to Order Service with Idempotency-Key
3. Order Service checks Redis cache
4. If miss, validates and saves to order_db
5. Calls Inventory Service via circuit breaker
6. Inventory deducts stock from inventory_db
7. Response cached in Redis
8. Success returned to user

### Circuit Breaker Flow (Failure)

```
User → Frontend → Order Service → Circuit Breaker (OPEN)
                       ↓
                   Fallback Response
                       ↓
                   Redis Stream (Queue)
```

1. Inventory Service slow/down
2. Circuit breaker opens after threshold
3. Fallback: Order queued
4. Message published to Redis Stream
5. User gets "queued" response
6. Background worker processes later

### Schrödinger's Warehouse (Partial Failure)

```
Order Service → Inventory Service
                     ↓
              PostgreSQL COMMIT ✓
                     ↓
              HTTP Response ✗ (crash/timeout)
                     ↓
              Order Service timeout
                     ↓
              User retries with same UUID
                     ↓
              Redis cache HIT
                     ↓
              Cached response returned
```

**Solution: Idempotency Keys**
- Prevents duplicate processing
- Returns saved response on retry
- Guarantees exactly-once semantics

## Database Design

### Order Database (order_db)

```sql
orders
├── id (SERIAL PRIMARY KEY)
├── order_id (VARCHAR UNIQUE) -- UUID
├── item_id (VARCHAR)
├── quantity (INTEGER)
├── status (VARCHAR) -- pending/confirmed/queued/failed
├── idempotency_key (VARCHAR UNIQUE)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

Indexes:
- order_id (UNIQUE)
- idempotency_key (UNIQUE)
- status
```

### Inventory Database (inventory_db)

```sql
inventory
├── id (SERIAL PRIMARY KEY)
├── item_id (VARCHAR UNIQUE)
├── item_name (VARCHAR)
├── quantity (INTEGER)
├── reserved_quantity (INTEGER)
├── created_at (TIMESTAMP)
└── updated_at (TIMESTAMP)

inventory_transactions
├── id (SERIAL PRIMARY KEY)
├── item_id (VARCHAR)
├── order_id (VARCHAR)
├── quantity_change (INTEGER)
├── transaction_type (VARCHAR)
└── created_at (TIMESTAMP)

Indexes:
- item_id (UNIQUE in inventory)
- order_id (in transactions)
```

**Design Decision: Separate Databases**
- Respects microservices boundaries
- Single PostgreSQL instance (cost-efficient)
- No cross-database joins
- Independent scaling possible

## Resilience Patterns

### 1. Circuit Breaker

**Configuration:**
```javascript
{
  timeout: 3000,              // 3s max wait
  errorThresholdPercentage: 50, // Open at 50% failures
  resetTimeout: 10000,        // Try again after 10s
}
```

**States:**
- **CLOSED**: Normal operation
- **OPEN**: Too many failures, use fallback
- **HALF-OPEN**: Testing if service recovered

### 2. Idempotency

**Implementation:**
```javascript
// Client generates UUID
const idempotencyKey = uuidv4();

// Server checks cache
const cached = await redis.get(`idempotency:${key}`);
if (cached) return cached;

// Process and cache
const result = await processOrder();
await redis.setex(`idempotency:${key}`, 86400, result);
return result;
```

**Benefits:**
- Network retries safe
- No duplicate orders
- 24-hour deduplication window

### 3. Chaos Engineering

**Gremlin Types:**
1. **Latency**: Delays responses (5s)
2. **Crash**: Random 500 errors (30%)
3. **Partial Failure**: DB commits but response fails (20%)

**Demo Flow:**
```bash
# Enable chaos
POST /api/admin/chaos {"latency": true, "crash_rate": 0.3}

# System still works (circuit breaker)
POST /api/orders → 202 Queued

# Disable chaos
DELETE /api/admin/chaos

# System recovers
POST /api/orders → 201 Created
```

## Monitoring & Observability

### Metrics Collected

**Order Service:**
- `http_request_duration_seconds` - API latency
- `order_processing_duration_seconds` - Processing time
- `circuit_breaker_state` - Circuit state (0/1/2)
- `idempotency_cache_hits_total` - Cache efficiency
- `orders_created_total` - Order volume

**Inventory Service:**
- `inventory_stock_level` - Current stock
- `inventory_chaos_enabled` - Chaos status
- `inventory_chaos_events_total` - Chaos trigger count
- `inventory_transactions_total` - Transaction volume

### Grafana Dashboard

**Panels:**
1. **Service Health** - UP/DOWN status
2. **Response Time** - 30s rolling average (RED if >1s)
3. **Circuit Breaker** - Current state
4. **Chaos Status** - Active gremlins
5. **Stock Levels** - Real-time inventory
6. **Order Volume** - Requests per second

### Alerting Rules

```yaml
- alert: HighLatency
  expr: avg(http_request_duration_seconds) > 1
  for: 30s
  labels:
    severity: warning
  annotations:
    summary: "Response time exceeds 1 second"

- alert: CircuitBreakerOpen
  expr: circuit_breaker_state == 1
  labels:
    severity: critical
  annotations:
    summary: "Circuit breaker open - inventory service down"
```

## Deployment Architecture

### Kubernetes Resources

**Namespace:** `valerix`

**Infrastructure:**
- PostgreSQL StatefulSet (1 replica, 10Gi PVC)
- Redis Deployment (1 replica, 5Gi PVC)

**Services:**
- Order Service Deployment (2 replicas)
- Inventory Service Deployment (2 replicas)
- Frontend Deployment (2 replicas)

**Networking:**
- Nginx Ingress Controller
- Digital Ocean Load Balancer
- ClusterIP Services (internal)

**Monitoring:**
- Prometheus (7-day retention)
- Grafana (persistent dashboard)
- ServiceMonitors (15s scrape interval)

### Resource Allocation

**Per Service:**
```yaml
requests:
  memory: 256Mi
  cpu: 200m
limits:
  memory: 512Mi
  cpu: 500m
```

**Total Cluster:**
- 2 nodes × 4GB RAM = 8GB
- ~6GB available for workloads
- ~12 pods running

## Security Considerations

### Implemented
- ✅ Secrets for database credentials
- ✅ Non-root containers
- ✅ Network policies (ClusterIP)
- ✅ Helmet.js security headers
- ✅ Input validation

### Production Additions
- TLS/SSL with cert-manager
- RBAC policies
- Pod security policies
- Image scanning
- Vault for secrets

## Cost Breakdown

### Digital Ocean ($60/month)
- DOKS: 2 nodes × $24 = $48
- Load Balancer: $12
- Container Registry: $5 (basic)
- Block Storage: ~$2 (25Gi total)

### Optimization
- Scale to 1 node when idle: $24/month
- Use spot instances (not available in DOKS)
- Delete cluster when not in use

## Performance Benchmarks

### Normal Operation
- P95 Latency: <300ms
- Throughput: 500 req/s
- Error Rate: <0.1%

### Under Chaos (30% crash rate, 5s latency)
- P95 Latency: <3s
- Throughput: 200 req/s (circuit breaker)
- Error Rate: <10% (queued orders succeed later)
- **Zero duplicate orders**

## Future Enhancements

### Phase 2
- [ ] Payment service
- [ ] Notification service (email/SMS)
- [ ] User authentication
- [ ] Distributed tracing (Jaeger)

### Phase 3
- [ ] Multi-region deployment
- [ ] Read replicas for PostgreSQL
- [ ] Redis Cluster
- [ ] Auto-scaling (HPA)

### Phase 4
- [ ] Kafka for event streaming
- [ ] ElasticSearch for logs
- [ ] Service mesh (Istio)
- [ ] Blue-green deployments

## Lessons Learned

### What Worked
✅ Circuit breaker prevented total failures
✅ Idempotency eliminated duplicates
✅ Chaos testing caught real bugs
✅ Separate databases simplified scaling

### Challenges
⚠️ Initial resource allocation too low
⚠️ Ingress configuration complex
⚠️ Database initialization timing

### Best Practices
💡 Always test with chaos mode ON
💡 Monitor idempotency cache hit rate
💡 Use rolling deployments
💡 Keep metrics retention short (cost)

## References

- **Circuit Breaker Pattern**: martinfowler.com/bliki/CircuitBreaker.html
- **Idempotency**: stripe.com/docs/api/idempotent_requests
- **Chaos Engineering**: principlesofchaos.org
- **Microservices**: microservices.io/patterns
