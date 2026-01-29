#!/bin/bash

# Makefile-style commands for Valerix
# Usage: ./scripts/commands.sh [command]

set -e

COMMAND=$1

case $COMMAND in
  "local-start")
    echo "🚀 Starting local development..."
    docker-compose up -d
    echo "✅ Infrastructure running!"
    echo "Run services manually in separate terminals:"
    echo "  cd services/order-service && npm run dev"
    echo "  cd services/inventory-service && npm run dev"
    echo "  cd services/frontend && npm run dev"
    ;;

  "local-stop")
    echo "🛑 Stopping local environment..."
    docker-compose down
    echo "✅ Stopped!"
    ;;

  "local-clean")
    echo "🧹 Cleaning local environment..."
    docker-compose down -v
    echo "✅ Cleaned! (all data removed)"
    ;;

  "build")
    echo "🔨 Building Docker images..."
    docker build -t valerix/order-service:latest ./services/order-service
    docker build -t valerix/inventory-service:latest ./services/inventory-service
    docker build -t valerix/frontend:latest ./services/frontend
    echo "✅ Images built!"
    ;;

  "test")
    echo "🧪 Running tests..."
    cd chaos-scripts
    k6 run --vus 10 --duration 30s load-test.js
    ;;

  "chaos")
    echo "🔴 Running chaos tests..."
    cd chaos-scripts
    k6 run chaos-test.js
    ;;

  "deploy")
    echo "🚀 Deploying to Digital Ocean..."
    ./scripts/deploy.sh
    ;;

  "logs")
    SERVICE=$2
    if [ -z "$SERVICE" ]; then
      echo "Usage: ./scripts/commands.sh logs [order|inventory|frontend]"
      exit 1
    fi
    kubectl logs -f deployment/$SERVICE-service -n valerix
    ;;

  "pods")
    echo "📊 Checking pod status..."
    kubectl get pods -n valerix
    ;;

  "grafana")
    echo "📊 Opening Grafana..."
    kubectl port-forward svc/monitoring-grafana -n valerix 3000:80
    ;;

  "prometheus")
    echo "📈 Opening Prometheus..."
    kubectl port-forward svc/monitoring-kube-prometheus-prometheus -n valerix 9090:9090
    ;;

  "help")
    echo "Valerix Commands:"
    echo ""
    echo "Local Development:"
    echo "  local-start  - Start local infrastructure"
    echo "  local-stop   - Stop local environment"
    echo "  local-clean  - Clean local environment (removes data)"
    echo ""
    echo "Docker:"
    echo "  build        - Build Docker images"
    echo ""
    echo "Testing:"
    echo "  test         - Run load tests"
    echo "  chaos        - Run chaos engineering tests"
    echo ""
    echo "Deployment:"
    echo "  deploy       - Deploy to Digital Ocean"
    echo "  logs         - View service logs (usage: logs order)"
    echo "  pods         - Check pod status"
    echo ""
    echo "Monitoring:"
    echo "  grafana      - Port-forward Grafana"
    echo "  prometheus   - Port-forward Prometheus"
    echo ""
    ;;

  *)
    echo "Unknown command: $COMMAND"
    echo "Run './scripts/commands.sh help' for available commands"
    exit 1
    ;;
esac
