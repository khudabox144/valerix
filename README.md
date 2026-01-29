# Valerix E-Commerce Microservices Platform

🏆 **Champion-Level Microservices Architecture for BUET Fest Hackathon**

## Architecture Overview

This is a production-grade microservices platform featuring:

- **Order Service**: Handles order processing with circuit breaker and idempotency
- **Inventory Service**: Manages stock with chaos engineering capabilities
- **Frontend**: Next.js dashboard for order management and monitoring
- **Redis Streams**: Event-driven async communication
- **PostgreSQL**: Separate databases for each service
- **Kubernetes**: Full orchestration with health checks and auto-scaling
- **Prometheus + Grafana**: Real-time monitoring and alerting
- **CI/CD**: Automated deployment via GitHub Actions

## Key Features

### 1. Resilience Patterns
- **Circuit Breaker** (Opossum): Prevents cascade failures
- **Idempotency Keys**: Handles network failures and duplicate requests
- **Chaos Engineering**: Built-in latency and crash simulation
- **Health Checks**: Deep dependency verification

### 2. The "Schrödinger's Warehouse" Solution
Handles partial failures where DB commits but response fails:
- UUID-based idempotency keys
- Redis-backed response caching
- Automatic retry handling
- Zero duplicate orders

### 3. Observability
- Prometheus metrics collection
- Grafana visual dashboards
- Latency-based color alerts (Green → Red when >1s)
- Real-time health monitoring

## Project Structure

```
valerix/
├── services/
│   ├── order-service/       # Order processing microservice
│   ├── inventory-service/   # Inventory management with chaos
│   └── frontend/            # Next.js UI
├── k8s/                     # Kubernetes manifests
│   ├── infrastructure/      # Postgres, Redis, Monitoring
│   ├── services/            # Service deployments
│   └── ingress.yaml         # Nginx routing
├── .github/workflows/       # CI/CD pipelines
├── chaos-scripts/           # K6 load testing
└── docker-compose.yml       # Local development
```

## Quick Start (Local Development)

### Prerequisites
- Docker & Docker Compose
- Node.js 18+
- kubectl & doctl (for deployment)

### 1. Start Infrastructure
```bash
docker-compose up -d postgres redis
```

### 2. Run Services
```bash
# Terminal 1: Order Service
cd services/order-service
npm install
npm run dev

# Terminal 2: Inventory Service
cd services/inventory-service
npm install
npm run dev

# Terminal 3: Frontend
cd services/frontend
npm install
npm run dev
```

### 3. Access Services
- Frontend: http://localhost:3000
- Order API: http://localhost:3001
- Inventory API: http://localhost:3002

## API Documentation

### Order Service (Port 3001)

#### Create Order
```bash
POST /api/orders
Headers: 
  Idempotency-Key: <uuid>
  Content-Type: application/json
Body:
{
  "item_id": "ps5",
  "quantity": 2
}
```

#### Get Order
```bash
GET /api/orders/:id
```

#### Health Check
```bash
GET /health        # Basic check
GET /health/deep   # Check all dependencies
```

### Inventory Service (Port 3002)

#### Deduct Stock
```bash
POST /api/inventory/deduct
Body:
{
  "item_id": "ps5",
  "quantity": 2
}
```

#### Enable Chaos Mode (Demo Feature)
```bash
POST /api/admin/chaos
Body:
{
  "latency": true,          # Enable 5s delays
  "crash_rate": 0.3         # 30% failure rate
}
```

#### Check Stock
```bash
GET /api/inventory/:item_id
```

## Chaos Engineering Demo

To demonstrate resilience during presentation:

```bash
# 1. Enable chaos mode
curl -X POST http://localhost:3002/api/admin/chaos \
  -H "Content-Type: application/json" \
  -d '{"latency": true, "crash_rate": 0.5}'

# 2. Watch Grafana dashboard turn RED (latency spike)

# 3. Create orders - they still work!
curl -X POST http://localhost:3001/api/orders \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"item_id": "ps5", "quantity": 1}'

# 4. Kill inventory pod
kubectl delete pod -l app=inventory-service

# 5. Orders still succeed (circuit breaker fallback)
```

## Kubernetes Deployment

### 1. Setup Digital Ocean Kubernetes
```bash
# Create cluster (2 nodes, 4GB RAM each)
doctl kubernetes cluster create valerix-prod \
  --region nyc1 \
  --node-pool "name=worker-pool;size=s-2vcpu-4gb;count=2"

# Get credentials
doctl kubernetes cluster kubeconfig save valerix-prod
```

### 2. Deploy Infrastructure
```bash
# Install Nginx Ingress
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/do/deploy.yaml

# Install Prometheus Stack
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install monitoring prometheus-community/kube-prometheus-stack

# Deploy databases
kubectl apply -f k8s/infrastructure/
```

### 3. Deploy Services
```bash
# Build and push images
docker build -t registry.digitalocean.com/valerix/order-service:latest ./services/order-service
docker build -t registry.digitalocean.com/valerix/inventory-service:latest ./services/inventory-service
docker build -t registry.digitalocean.com/valerix/frontend:latest ./services/frontend

docker push registry.digitalocean.com/valerix/order-service:latest
docker push registry.digitalocean.com/valerix/inventory-service:latest
docker push registry.digitalocean.com/valerix/frontend:latest

# Deploy to K8s
kubectl apply -f k8s/services/
kubectl apply -f k8s/ingress.yaml
```

### 4. Access Services
```bash
# Get Load Balancer IP
kubectl get ingress

# Visit http://<EXTERNAL-IP>
```

## Monitoring & Observability

### Grafana Dashboard
```bash
# Port forward Grafana
kubectl port-forward svc/monitoring-grafana 3000:80

# Login at http://localhost:3000
# Default: admin / prom-operator
```

### Prometheus Metrics
```bash
kubectl port-forward svc/monitoring-kube-prometheus-prometheus 9090:9090
# Visit http://localhost:9090
```

### Key Metrics
- `order_processing_duration_seconds`: Order latency
- `circuit_breaker_state`: Circuit state (open/closed)
- `inventory_chaos_enabled`: Chaos mode status
- `http_request_duration_seconds`: API response times

## Backup Strategy (Bonus Challenge)

**Problem**: Only ONE backup call per day allowed.

**Solution**: K8s CronJob that:
1. Runs at midnight
2. Does `pg_dump` for both databases
3. Creates single compressed archive
4. Uploads ONCE to Digital Ocean Spaces

```bash
kubectl apply -f k8s/infrastructure/backup-cronjob.yaml
```

## Testing

### Load Testing with K6
```bash
cd chaos-scripts
k6 run --vus 100 --duration 30s load-test.js
```

### Integration Tests
```bash
npm test
```

## Cost Breakdown (Digital Ocean)

- **DOKS Cluster**: 2 nodes × $24/mo = $48
- **Load Balancer**: $12/mo
- **Container Registry**: $5/mo
- **Total**: ~$65/month (well within $100 budget)

## Architecture Decisions

### Why PostgreSQL over MySQL?
- JSONB support for flexible schemas
- Superior transaction handling (critical for financial data)
- Better concurrent write performance

### Why Redis Streams over Kafka?
- Lighter footprint (important for budget)
- Consumer groups support (for distributed processing)
- Sub-millisecond latency
- Native K8s deployment (no ZooKeeper complexity)

### Why Separate Databases in One Instance?
- Respects logical boundaries
- Saves RAM (critical with 2-node cluster)
- Still allows independent scaling later
- Zero cross-database queries (proper microservices)

### The Idempotency Solution
Traditional approaches fail when:
1. DB commits ✓
2. Response prepared ✓
3. **Network fails before client receives** ✗
4. Client retries → Duplicate order

Our solution:
- Client generates UUID before request
- Server checks Redis cache first
- Cache response AFTER commit
- Retry hits cache, returns saved response
- **Zero duplicates, even with crashes**

## Presentation Tips

1. **Start with Grafana open** - show green status
2. **Create normal orders** - show quick response
3. **Enable chaos mode** - POST to `/api/admin/chaos`
4. **Watch dashboard turn RED** - latency spike visible
5. **Orders still work** - circuit breaker fallback message
6. **Kill a pod** - `kubectl delete pod <inventory>`
7. **System recovers** - new pod spawns, health restored

## Winning Points

✅ **Microservices**: Proper separation with independent scaling  
✅ **Resilience**: Circuit breaker, idempotency, chaos engineering  
✅ **DevOps**: Full CI/CD, K8s, monitoring, automated backups  
✅ **Production-Ready**: Health checks, metrics, graceful degradation  
✅ **Demo-Friendly**: Chaos mode toggle, visual alerts, live recovery  

## License

MIT

## Team

Built for BUET Fest Hackathon - Champion Edition 🏆
