#!/bin/bash

# Valerix Digital Ocean Deployment Script
# Complete setup script for deploying to Digital Ocean Kubernetes

set -e

echo "🚀 Valerix Platform Deployment Script"
echo "======================================"
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v doctl &> /dev/null; then
    echo "❌ doctl not found. Please install: https://docs.digitalocean.com/reference/doctl/how-to/install/"
    exit 1
fi

if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install: https://kubernetes.io/docs/tasks/tools/"
    exit 1
fi

if ! command -v helm &> /dev/null; then
    echo "❌ helm not found. Please install: https://helm.sh/docs/intro/install/"
    exit 1
fi

echo "✅ All prerequisites met!"
echo ""

# Configuration
CLUSTER_NAME="${CLUSTER_NAME:-valerix-prod}"
REGION="${REGION:-nyc1}"
NODE_SIZE="${NODE_SIZE:-s-2vcpu-4gb}"
NODE_COUNT="${NODE_COUNT:-2}"
REGISTRY_NAME="valerix"

echo "📋 Configuration:"
echo "  Cluster Name: $CLUSTER_NAME"
echo "  Region: $REGION"
echo "  Node Size: $NODE_SIZE"
echo "  Node Count: $NODE_COUNT"
echo ""

read -p "Continue with deployment? (y/n) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Deployment cancelled."
    exit 0
fi

# Create Digital Ocean Container Registry
echo ""
echo "📦 Step 1: Setting up Container Registry..."
if doctl registry get $REGISTRY_NAME &> /dev/null; then
    echo "✅ Registry '$REGISTRY_NAME' already exists"
else
    echo "Creating registry..."
    doctl registry create $REGISTRY_NAME --subscription-tier basic
    echo "✅ Registry created"
fi

# Create Kubernetes Cluster
echo ""
echo "☸️  Step 2: Creating Kubernetes Cluster..."
if doctl kubernetes cluster get $CLUSTER_NAME &> /dev/null; then
    echo "✅ Cluster '$CLUSTER_NAME' already exists"
else
    echo "Creating cluster (this takes 5-10 minutes)..."
    doctl kubernetes cluster create $CLUSTER_NAME \
        --region $REGION \
        --node-pool "name=worker-pool;size=$NODE_SIZE;count=$NODE_COUNT" \
        --wait
    echo "✅ Cluster created"
fi

# Get cluster credentials
echo ""
echo "🔑 Step 3: Configuring kubectl..."
doctl kubernetes cluster kubeconfig save $CLUSTER_NAME
echo "✅ kubectl configured"

# Install Nginx Ingress Controller
echo ""
echo "🌐 Step 4: Installing Nginx Ingress Controller..."
if kubectl get namespace ingress-nginx &> /dev/null; then
    echo "✅ Nginx Ingress already installed"
else
    kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/do/deploy.yaml
    echo "⏳ Waiting for Nginx Ingress to be ready..."
    kubectl wait --namespace ingress-nginx \
        --for=condition=ready pod \
        --selector=app.kubernetes.io/component=controller \
        --timeout=300s
    echo "✅ Nginx Ingress installed"
fi

# Build and push Docker images
echo ""
echo "🐳 Step 5: Building and pushing Docker images..."
doctl registry login

echo "Building Order Service..."
docker build -t registry.digitalocean.com/$REGISTRY_NAME/order-service:latest ./services/order-service

echo "Building Inventory Service..."
docker build -t registry.digitalocean.com/$REGISTRY_NAME/inventory-service:latest ./services/inventory-service

echo "Building Frontend..."
docker build -t registry.digitalocean.com/$REGISTRY_NAME/frontend:latest ./services/frontend

echo "Pushing images..."
docker push registry.digitalocean.com/$REGISTRY_NAME/order-service:latest
docker push registry.digitalocean.com/$REGISTRY_NAME/inventory-service:latest
docker push registry.digitalocean.com/$REGISTRY_NAME/frontend:latest

echo "✅ Images built and pushed"

# Deploy infrastructure
echo ""
echo "🏗️  Step 6: Deploying infrastructure..."
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/infrastructure/

echo "⏳ Waiting for PostgreSQL to be ready..."
kubectl wait --for=condition=ready pod -l app=postgres -n valerix --timeout=300s

echo "⏳ Waiting for Redis to be ready..."
kubectl wait --for=condition=ready pod -l app=redis -n valerix --timeout=300s

echo "✅ Infrastructure deployed"

# Deploy services
echo ""
echo "🚀 Step 7: Deploying services..."
kubectl apply -f k8s/services/
kubectl apply -f k8s/ingress.yaml

echo "⏳ Waiting for deployments to be ready..."
kubectl wait --for=condition=ready pod -l app=order-service -n valerix --timeout=300s
kubectl wait --for=condition=ready pod -l app=inventory-service -n valerix --timeout=300s
kubectl wait --for=condition=ready pod -l app=frontend -n valerix --timeout=300s

echo "✅ Services deployed"

# Install monitoring
echo ""
echo "📊 Step 8: Installing monitoring stack..."
./k8s/monitoring/setup-monitoring.sh

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Access your services:"
echo ""

# Get LoadBalancer IP
INGRESS_IP=$(kubectl get svc ingress-nginx-controller -n ingress-nginx -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
if [ -z "$INGRESS_IP" ]; then
    echo "⏳ LoadBalancer IP not yet assigned. Run this command to check:"
    echo "   kubectl get svc ingress-nginx-controller -n ingress-nginx"
else
    echo "🌐 LoadBalancer IP: $INGRESS_IP"
    echo ""
    echo "To access your services:"
    echo "  1. Point your domain to: $INGRESS_IP"
    echo "  2. Update k8s/ingress.yaml with your domain"
    echo "  3. Apply changes: kubectl apply -f k8s/ingress.yaml"
    echo ""
    echo "For testing, you can use port-forwarding:"
fi

echo ""
echo "📊 Grafana Dashboard:"
echo "   kubectl port-forward svc/monitoring-grafana -n valerix 3000:80"
echo "   Visit: http://localhost:3000 (admin/admin)"
echo ""
echo "📈 Prometheus:"
echo "   kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n valerix 9090:9090"
echo "   Visit: http://localhost:9090"
echo ""
echo "🎯 Next steps:"
echo "  1. Configure your domain DNS"
echo "  2. Set up SSL with cert-manager (optional)"
echo "  3. Import Grafana dashboard from k8s/monitoring/grafana-dashboard.json"
echo "  4. Run chaos tests: cd chaos-scripts && k6 run load-test.js"
echo ""
echo "💰 Current cluster cost: ~$60/month"
echo ""
