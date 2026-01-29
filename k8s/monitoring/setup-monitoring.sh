#!/bin/bash

# Valerix Monitoring Setup Script
# This script installs Prometheus and Grafana using Helm

set -e

echo "🚀 Setting up Valerix Monitoring Stack..."

# Add Helm repositories
echo "📦 Adding Helm repositories..."
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install kube-prometheus-stack (Prometheus + Grafana + Alertmanager)
echo "📊 Installing Prometheus and Grafana..."
helm install monitoring prometheus-community/kube-prometheus-stack \
  --namespace valerix \
  --create-namespace \
  --set prometheus.prometheusSpec.serviceMonitorSelectorNilUsesHelmValues=false \
  --set grafana.adminPassword=admin \
  --set grafana.persistence.enabled=true \
  --set grafana.persistence.size=5Gi \
  --set prometheus.prometheusSpec.retention=7d \
  --set prometheus.prometheusSpec.resources.requests.memory=1Gi \
  --set prometheus.prometheusSpec.resources.limits.memory=2Gi

echo "⏳ Waiting for monitoring stack to be ready..."
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=grafana -n valerix --timeout=300s
kubectl wait --for=condition=ready pod -l app.kubernetes.io/name=prometheus -n valerix --timeout=300s

echo "✅ Monitoring stack installed successfully!"
echo ""
echo "📊 Access Grafana:"
echo "  kubectl port-forward svc/monitoring-grafana -n valerix 3000:80"
echo "  Then visit: http://localhost:3000"
echo "  Username: admin"
echo "  Password: admin"
echo ""
echo "📈 Access Prometheus:"
echo "  kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n valerix 9090:9090"
echo "  Then visit: http://localhost:9090"
echo ""
echo "🎯 Next steps:"
echo "  1. Apply ServiceMonitors: kubectl apply -f k8s/monitoring/service-monitors.yaml"
echo "  2. Import Grafana dashboard from k8s/monitoring/grafana-dashboard.json"
echo ""
