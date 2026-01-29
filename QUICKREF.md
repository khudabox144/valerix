# 🚀 Quick Reference Guide

## Essential Commands

### Local Development

```bash
# Start infrastructure
docker-compose up -d

# Start services (3 terminals)
cd services/order-service && npm run dev
cd services/inventory-service && npm run dev
cd services/frontend && npm run dev

# Stop everything
docker-compose down
```

### Testing

```bash
# Health checks
curl http://localhost:3001/health
curl http://localhost:3002/health

# Create order
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"item_id": "ps5", "quantity": 2}'

# Enable chaos
curl -X POST http://localhost:3002/api/admin/chaos \
  -H "Content-Type: application/json" \
  -d '{"latency": true, "crash_rate": 0.3}'

# Disable chaos
curl -X DELETE http://localhost:3002/api/admin/chaos

# Load test
cd chaos-scripts && k6 run load-test.js

# Chaos test
cd chaos-scripts && k6 run chaos-test.js
```

### Kubernetes (Production)

```bash
# Deploy everything
./scripts/deploy.sh

# Check status
kubectl get pods -n valerix
kubectl get svc -n valerix
kubectl get ingress -n valerix

# View logs
kubectl logs -f deployment/order-service -n valerix
kubectl logs -f deployment/inventory-service -n valerix

# Scale services
kubectl scale deployment order-service --replicas=3 -n valerix

# Restart service
kubectl rollout restart deployment/order-service -n valerix

# Port forward for local access
kubectl port-forward svc/order-service -n valerix 3001:3001
kubectl port-forward svc/inventory-service -n valerix 3002:3002
kubectl port-forward svc/frontend -n valerix 3000:3000
```

### Monitoring

```bash
# Access Grafana
kubectl port-forward svc/monitoring-grafana -n valerix 3000:80
# Visit: http://localhost:3000 (admin/admin)

# Access Prometheus
kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n valerix 9090:9090
# Visit: http://localhost:9090

# View metrics
curl http://localhost:3001/metrics
curl http://localhost:3002/metrics
```

### Digital Ocean

```bash
# Login
doctl auth init

# Create cluster
doctl kubernetes cluster create valerix-prod \
  --region nyc1 \
  --node-pool "name=worker-pool;size=s-2vcpu-4gb;count=2"

# Get credentials
doctl kubernetes cluster kubeconfig save valerix-prod

# Registry login
doctl registry login

# Build and push
docker build -t registry.digitalocean.com/valerix/order-service:latest ./services/order-service
docker push registry.digitalocean.com/valerix/order-service:latest

# Delete cluster
doctl kubernetes cluster delete valerix-prod
```

## API Reference

### Order Service (3001)

| Method | Endpoint | Description | Headers |
|--------|----------|-------------|---------|
| POST | `/api/orders` | Create order | `Idempotency-Key: UUID` |
| GET | `/api/orders/:id` | Get order | - |
| GET | `/api/orders` | List orders | - |
| GET | `/health` | Health check | - |
| GET | `/health/deep` | Deep check | - |
| GET | `/metrics` | Prometheus | - |

### Inventory Service (3002)

| Method | Endpoint | Description | Body |
|--------|----------|-------------|------|
| POST | `/api/inventory/deduct` | Deduct stock | `{item_id, quantity, order_id}` |
| GET | `/api/inventory/:id` | Get stock | - |
| GET | `/api/inventory` | List all | - |
| POST | `/api/admin/chaos` | Enable chaos | `{latency, crash_rate, partial_failure_rate}` |
| GET | `/api/admin/chaos` | Get config | - |
| DELETE | `/api/admin/chaos` | Disable | - |
| GET | `/health` | Health check | - |

## File Structure

```
valerix/
├── services/
│   ├── order-service/           # Order microservice
│   │   ├── src/
│   │   │   ├── config/          # DB, Redis, Logger
│   │   │   ├── controllers/     # API logic
│   │   │   ├── middleware/      # Idempotency
│   │   │   ├── services/        # Circuit breaker
│   │   │   └── index.js         # Entry point
│   │   ├── Dockerfile
│   │   └── package.json
│   ├── inventory-service/       # Inventory microservice
│   │   ├── src/
│   │   │   ├── config/          # DB, Redis, Logger
│   │   │   ├── controllers/     # API + Chaos
│   │   │   ├── middleware/      # Gremlin
│   │   │   └── index.js
│   │   ├── Dockerfile
│   │   └── package.json
│   └── frontend/                # Next.js UI
│       ├── components/          # React components
│       ├── pages/               # Routes
│       ├── styles/              # CSS
│       ├── Dockerfile
│       └── package.json
├── k8s/                         # Kubernetes manifests
│   ├── infrastructure/          # Postgres, Redis, Backup
│   ├── services/                # Microservice deployments
│   ├── monitoring/              # Prometheus, Grafana
│   ├── ingress.yaml            # Nginx routing
│   └── namespace.yaml          
├── .github/workflows/           # CI/CD
│   └── deploy.yml              # Auto deployment
├── chaos-scripts/               # K6 tests
│   ├── load-test.js
│   ├── chaos-test.js
│   └── README.md
├── scripts/                     # Helper scripts
│   ├── deploy.sh               # Full deployment
│   ├── local-setup.sh          # Local dev setup
│   └── commands.sh             # Quick commands
├── docker-compose.yml           # Local infrastructure
├── README.md                    # Main docs
├── DEPLOYMENT.md                # Step-by-step guide
└── ARCHITECTURE.md              # Technical details
```

## Environment Variables

### Order Service
```bash
NODE_ENV=production
PORT=3001
DB_HOST=postgres
DB_PORT=5432
DB_USER=valerix
DB_PASSWORD=your_password
DB_NAME=order_db
REDIS_HOST=redis
REDIS_PORT=6379
INVENTORY_SERVICE_URL=http://inventory-service:3002
```

### Inventory Service
```bash
NODE_ENV=production
PORT=3002
DB_HOST=postgres
DB_PORT=5432
DB_USER=valerix
DB_PASSWORD=your_password
DB_NAME=inventory_db
REDIS_HOST=redis
REDIS_PORT=6379
```

### Frontend
```bash
NODE_ENV=production
NEXT_PUBLIC_ORDER_API_URL=http://your-domain/order
NEXT_PUBLIC_INVENTORY_API_URL=http://your-domain/inventory
```

## Troubleshooting

### Pods not starting
```bash
kubectl describe pod POD_NAME -n valerix
kubectl logs POD_NAME -n valerix
```

### Can't connect to database
```bash
kubectl exec -it postgres-0 -n valerix -- psql -U valerix -d order_db
```

### Images not pulling
```bash
doctl registry login
kubectl delete pod POD_NAME -n valerix  # Force recreate
```

### High latency
```bash
# Check chaos mode
curl http://localhost:3002/api/admin/chaos

# Disable if needed
curl -X DELETE http://localhost:3002/api/admin/chaos
```

### Circuit breaker stuck open
```bash
# Check inventory health
curl http://localhost:3002/health

# Restart if needed
kubectl rollout restart deployment/inventory-service -n valerix
```

## Metrics Queries (Prometheus)

```promql
# Average response time (30s window)
avg(rate(http_request_duration_seconds_sum[30s]) / 
    rate(http_request_duration_seconds_count[30s]))

# Circuit breaker state
circuit_breaker_state{service="inventory"}

# Idempotency hit rate
rate(idempotency_cache_hits_total[5m]) / 
  (rate(idempotency_cache_hits_total[5m]) + 
   rate(idempotency_cache_misses_total[5m]))

# Orders per minute
rate(orders_created_total[1m]) * 60

# Stock levels
inventory_stock_level

# Chaos events
rate(inventory_chaos_events_total[5m])
```

## Demo Checklist

### Pre-Demo (5 min before)
- [ ] All services running
- [ ] Grafana accessible
- [ ] Frontend open in browser
- [ ] Chaos mode OFF
- [ ] Terminal windows ready

### Demo Flow (15 min)
1. **Show Normal Operations** (3 min)
   - Create orders
   - Show Grafana (green)

2. **Enable Chaos** (5 min)
   - Enable via frontend
   - Watch dashboard turn RED
   - Orders still work (queued)

3. **Extreme Chaos** (4 min)
   - Delete pod
   - Show recovery
   - Highlight metrics

4. **Disable & Summary** (3 min)
   - Turn off chaos
   - Show recovery (green)
   - Explain architecture

### Key Points to Mention
- ✅ Microservices architecture
- ✅ Circuit breaker pattern
- ✅ Idempotency for zero duplicates
- ✅ Chaos engineering built-in
- ✅ Production-ready monitoring
- ✅ Full CI/CD pipeline
- ✅ Cost-efficient ($60/month)

## Cost Management

```bash
# Scale down when idle
doctl kubernetes cluster node-pool update valerix-prod worker-pool --count=1

# Scale up for demo
doctl kubernetes cluster node-pool update valerix-prod worker-pool --count=2

# Delete when done (SAVES MONEY!)
doctl kubernetes cluster delete valerix-prod
```

## Support Links

- **Digital Ocean Docs**: https://docs.digitalocean.com/
- **Kubernetes Docs**: https://kubernetes.io/docs/
- **Prometheus Docs**: https://prometheus.io/docs/
- **Grafana Docs**: https://grafana.com/docs/
- **K6 Docs**: https://k6.io/docs/

## Emergency Commands

```bash
# System is broken - restart everything
kubectl rollout restart deployment -n valerix

# Database is corrupt - reset (LOSES DATA!)
kubectl delete pvc postgres-pvc -n valerix
kubectl delete pod postgres-0 -n valerix

# Redis issues - clear cache
kubectl exec -it $(kubectl get pod -l app=redis -n valerix -o name) -n valerix -- redis-cli FLUSHALL

# Complete reset (NUCLEAR OPTION)
kubectl delete namespace valerix
kubectl apply -f k8s/
```

## Success Metrics

### Local Development
- All services start without errors
- Can create orders via UI
- Health checks return 200
- Grafana shows metrics

### Production
- All pods in Running state
- LoadBalancer has external IP
- Chaos test completes successfully
- >70% success rate under chaos
- Dashboard shows green status

---

**Need help?** Check `DEPLOYMENT.md` for detailed steps or `ARCHITECTURE.md` for technical details.

**Ready to deploy?** Run `./scripts/deploy.sh`

**Good luck at BUET Fest! 🏆**
