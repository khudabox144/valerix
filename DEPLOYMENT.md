# Complete Deployment Guide for Digital Ocean

This guide will walk you through deploying the entire Valerix platform to Digital Ocean from scratch.

## 🎯 Prerequisites

### 1. Digital Ocean Account
- Sign up at https://www.digitalocean.com/
- Apply student pack ($200 credit): https://www.digitalocean.com/github-students
- Add payment method (required even with credits)

### 2. Install Required Tools

#### macOS
```bash
# Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# doctl (Digital Ocean CLI)
brew install doctl

# kubectl
brew install kubectl

# helm
brew install helm

# docker
brew install --cask docker
```

#### Linux (Ubuntu/Debian)
```bash
# doctl
cd ~
wget https://github.com/digitalocean/doctl/releases/download/v1.98.1/doctl-1.98.1-linux-amd64.tar.gz
tar xf doctl-1.98.1-linux-amd64.tar.gz
sudo mv doctl /usr/local/bin

# kubectl
curl -LO "https://dl.k6.io/key.gpg" | sudo apt-key add -
sudo curl -fsSLo /usr/share/keyrings/kubernetes-archive-keyring.gpg https://packages.cloud.google.com/apt/doc/apt-key.gpg
echo "deb [signed-by=/usr/share/keyrings/kubernetes-archive-keyring.gpg] https://apt.kubernetes.io/ kubernetes-xenial main" | sudo tee /etc/apt/sources.list.d/kubernetes.list
sudo apt-get update
sudo apt-get install -y kubectl

# helm
curl https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 | bash

# docker
sudo apt-get install docker.io
sudo usermod -aG docker $USER
```

### 3. Authenticate doctl
```bash
# Get API token from: https://cloud.digitalocean.com/account/api/tokens
doctl auth init

# Verify
doctl account get
```

## 📋 Step-by-Step Deployment

### Step 1: Clone Repository
```bash
git clone https://github.com/your-username/valerix.git
cd valerix
```

### Step 2: Create Container Registry
```bash
# Create registry
doctl registry create valerix --subscription-tier basic

# Login to registry
doctl registry login
```

### Step 3: Create Kubernetes Cluster
```bash
# Create cluster (takes 5-10 minutes)
doctl kubernetes cluster create valerix-prod \
  --region nyc1 \
  --node-pool "name=worker-pool;size=s-2vcpu-4gb;count=2" \
  --wait

# Get cluster credentials
doctl kubernetes cluster kubeconfig save valerix-prod

# Verify
kubectl cluster-info
kubectl get nodes
```

**Expected output:**
```
NAME              STATUS   ROLES    AGE   VERSION
worker-pool-xxx   Ready    <none>   2m    v1.28.2
worker-pool-yyy   Ready    <none>   2m    v1.28.2
```

### Step 4: Install Nginx Ingress Controller
```bash
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/do/deploy.yaml

# Wait for it to be ready (creates LoadBalancer)
kubectl wait --namespace ingress-nginx \
  --for=condition=ready pod \
  --selector=app.kubernetes.io/component=controller \
  --timeout=300s

# Get LoadBalancer IP (save this!)
kubectl get svc ingress-nginx-controller -n ingress-nginx
```

### Step 5: Build and Push Docker Images
```bash
# Build images
docker build -t registry.digitalocean.com/valerix/order-service:latest \
  ./services/order-service

docker build -t registry.digitalocean.com/valerix/inventory-service:latest \
  ./services/inventory-service

docker build -t registry.digitalocean.com/valerix/frontend:latest \
  ./services/frontend

# Push images
docker push registry.digitalocean.com/valerix/order-service:latest
docker push registry.digitalocean.com/valerix/inventory-service:latest
docker push registry.digitalocean.com/valerix/frontend:latest
```

### Step 6: Deploy Infrastructure
```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Deploy PostgreSQL and Redis
kubectl apply -f k8s/infrastructure/

# Wait for databases to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n valerix --timeout=300s
kubectl wait --for=condition=ready pod -l app=redis -n valerix --timeout=300s

# Verify
kubectl get pods -n valerix
```

### Step 7: Deploy Services
```bash
# Deploy microservices
kubectl apply -f k8s/services/

# Wait for services
kubectl wait --for=condition=ready pod -l app=order-service -n valerix --timeout=300s
kubectl wait --for=condition=ready pod -l app=inventory-service -n valerix --timeout=300s
kubectl wait --for=condition=ready pod -l app=frontend -n valerix --timeout=300s

# Verify all pods running
kubectl get pods -n valerix
```

**Expected output:**
```
NAME                                  READY   STATUS    RESTARTS   AGE
postgres-0                            1/1     Running   0          5m
redis-xxx                             1/1     Running   0          5m
order-service-xxx                     1/1     Running   0          2m
order-service-yyy                     1/1     Running   0          2m
inventory-service-xxx                 1/1     Running   0          2m
inventory-service-yyy                 1/1     Running   0          2m
frontend-xxx                          1/1     Running   0          2m
frontend-yyy                          1/1     Running   0          2m
```

### Step 8: Configure Ingress

#### Option A: Using IP Address (Quick Test)
```bash
# Get LoadBalancer IP
LOAD_BALANCER_IP=$(kubectl get svc ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

echo "Your LoadBalancer IP: $LOAD_BALANCER_IP"

# Test with curl
curl http://$LOAD_BALANCER_IP/order/health
curl http://$LOAD_BALANCER_IP/inventory/health
```

#### Option B: Using Domain (Production)
```bash
# 1. Point your domain to LoadBalancer IP
#    Add A record: valerix.yourdomain.com -> LOAD_BALANCER_IP

# 2. Update ingress with your domain
# Edit k8s/ingress.yaml and replace 'valerix.example.com' with your domain

# 3. Apply ingress
kubectl apply -f k8s/ingress.yaml

# 4. Verify
kubectl get ingress -n valerix
```

### Step 9: Install Monitoring
```bash
# Run monitoring setup script
chmod +x k8s/monitoring/setup-monitoring.sh
./k8s/monitoring/setup-monitoring.sh

# Wait for Prometheus and Grafana
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=grafana -n valerix --timeout=300s

# Access Grafana
kubectl port-forward svc/monitoring-grafana -n valerix 3000:80

# Visit http://localhost:3000
# Login: admin / admin
```

### Step 10: Import Grafana Dashboard
1. Open Grafana at http://localhost:3000
2. Login (admin/admin)
3. Go to Dashboards → Import
4. Upload `k8s/monitoring/grafana-dashboard.json`
5. Select Prometheus data source
6. Click Import

### Step 11: Set Up GitHub Actions (Optional)
```bash
# Generate deploy key
ssh-keygen -t ed25519 -C "github-actions-valerix"

# Add to GitHub secrets:
# 1. Go to GitHub repo → Settings → Secrets
# 2. Add secret: DIGITALOCEAN_ACCESS_TOKEN
#    Value: Your Digital Ocean API token

# Push to main branch to trigger deployment
git add .
git commit -m "Initial deployment"
git push origin main
```

## 🧪 Testing Your Deployment

### Basic Health Checks
```bash
# Check all services
kubectl get pods -n valerix

# Check logs
kubectl logs -f deployment/order-service -n valerix
kubectl logs -f deployment/inventory-service -n valerix

# Port-forward for local testing
kubectl port-forward svc/order-service -n valerix 3001:3001
kubectl port-forward svc/inventory-service -n valerix 3002:3002
kubectl port-forward svc/frontend -n valerix 3000:3000

# Test APIs
curl http://localhost:3001/health
curl http://localhost:3002/health
```

### Create Test Order
```bash
# Generate UUID for idempotency
IDEMPOTENCY_KEY=$(uuidgen)

# Create order
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d '{
    "item_id": "ps5",
    "quantity": 2
  }'
```

### Enable Chaos Mode
```bash
# Enable chaos for demo
curl -X POST http://localhost:3002/api/admin/chaos \
  -H "Content-Type: application/json" \
  -d '{
    "latency": true,
    "latency_ms": 5000,
    "crash_rate": 0.3,
    "partial_failure_rate": 0.2
  }'

# Disable chaos
curl -X DELETE http://localhost:3002/api/admin/chaos
```

### Run Load Tests
```bash
cd chaos-scripts

# Install K6
brew install k6  # macOS
# OR
sudo apt-get install k6  # Linux

# Run load test
k6 run --vus 50 --duration 30s load-test.js

# Run chaos test
k6 run chaos-test.js
```

## 💰 Cost Management

### Current Setup Cost (~$60/month)
- **Kubernetes Cluster**: 2 × $24/month = $48
- **Load Balancer**: $12/month
- **Container Registry**: $5/month (basic tier)
- **Storage (PVCs)**: ~$2/month
- **Total**: ~$67/month

### With $200 Student Credit
You have **~3 months** of free usage!

### Cost Optimization Tips
```bash
# Scale down nodes when not in use
doctl kubernetes cluster node-pool update valerix-prod worker-pool --count=1

# Scale back up
doctl kubernetes cluster node-pool update valerix-prod worker-pool --count=2

# Delete cluster when done (SAVE YOUR DATA FIRST!)
doctl kubernetes cluster delete valerix-prod
```

## 🔧 Troubleshooting

### Issue: Pods in CrashLoopBackOff
```bash
# Check logs
kubectl logs POD_NAME -n valerix

# Common causes:
# - Database not ready → Wait longer
# - Environment variables missing → Check secrets
# - Image pull error → Verify registry authentication
```

### Issue: Can't pull images
```bash
# Re-authenticate
doctl registry login

# Verify images exist
doctl registry repository list-v2

# Manual pull test
docker pull registry.digitalocean.com/valerix/order-service:latest
```

### Issue: Services not accessible
```bash
# Check ingress
kubectl get ingress -n valerix
kubectl describe ingress valerix-ingress -n valerix

# Check services
kubectl get svc -n valerix

# Check endpoints
kubectl get endpoints -n valerix
```

### Issue: Database connection errors
```bash
# Check PostgreSQL pod
kubectl logs postgres-0 -n valerix

# Test connection from order service
kubectl exec -it deployment/order-service -n valerix -- sh
psql -h postgres.valerix.svc.cluster.local -U valerix -d order_db
```

### Issue: Out of resources
```bash
# Check node resources
kubectl top nodes

# Check pod resources
kubectl top pods -n valerix

# Scale up cluster
doctl kubernetes cluster node-pool update valerix-prod worker-pool --count=3
```

## 🎬 Presentation Demo Checklist

### Pre-Demo Setup (5 minutes before)
- [ ] All pods running: `kubectl get pods -n valerix`
- [ ] Grafana accessible: `kubectl port-forward svc/monitoring-grafana -n valerix 3000:80`
- [ ] Frontend accessible (separate tab)
- [ ] Chaos mode disabled
- [ ] Terminal windows ready

### Demo Flow (10-15 minutes)
1. **Show Architecture** (2 min)
   - Explain microservices separation
   - Show Kubernetes dashboard

2. **Normal Operations** (3 min)
   - Create orders via frontend
   - Show Grafana dashboard (green)
   - Show fast response times

3. **Enable Chaos** (5 min)
   - Enable chaos mode in frontend
   - Watch Grafana turn RED
   - Create orders - they still work!
   - Show circuit breaker messages

4. **Extreme Chaos** (3 min)
   - `kubectl delete pod inventory-service-xxx`
   - Orders still succeed
   - Show automatic recovery

5. **Wrap Up** (2 min)
   - Disable chaos
   - Show system recovery (GREEN)
   - Highlight key metrics

## 🏆 Winning Points for Judges

Emphasize these features:
- ✅ **Microservices Architecture** - Proper separation
- ✅ **Circuit Breaker** - Graceful degradation
- ✅ **Idempotency** - Zero duplicate orders
- ✅ **Chaos Engineering** - Built-in resilience testing
- ✅ **Observability** - Prometheus + Grafana
- ✅ **CI/CD** - Automated deployment
- ✅ **Production-Ready** - Health checks, backups, monitoring
- ✅ **Cost-Efficient** - $60/month for full stack

## 📞 Support

If you encounter issues:
1. Check logs: `kubectl logs -f deployment/SERVICE_NAME -n valerix`
2. Check events: `kubectl get events -n valerix --sort-by='.lastTimestamp'`
3. Verify resources: `kubectl top pods -n valerix`

## 🧹 Cleanup

When done with the hackathon:
```bash
# Delete cluster (saves money!)
doctl kubernetes cluster delete valerix-prod

# Delete registry
doctl registry delete valerix

# Verify deletion
doctl kubernetes cluster list
doctl registry list
```

**Congratulations! Your champion-level microservices platform is now live! 🏆**
