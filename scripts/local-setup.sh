#!/bin/bash

# Quick Start Script for Local Development
# Run this to get Valerix running locally in minutes

set -e

echo "🚀 Valerix Local Development Setup"
echo "===================================="
echo ""

# Check prerequisites
echo "🔍 Checking prerequisites..."

if ! command -v docker &> /dev/null; then
    echo "❌ Docker not found. Please install Docker Desktop."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose not found. Please install docker-compose."
    exit 1
fi

if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 18+."
    exit 1
fi

echo "✅ All prerequisites met!"
echo ""

# Start infrastructure
echo "🐳 Starting infrastructure (PostgreSQL + Redis)..."
docker-compose up -d postgres redis

echo "⏳ Waiting for databases to be ready..."
sleep 10

# Check if databases are ready
until docker-compose exec -T postgres pg_isready -U valerix > /dev/null 2>&1; do
    echo "Waiting for PostgreSQL..."
    sleep 2
done

until docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; do
    echo "Waiting for Redis..."
    sleep 2
done

echo "✅ Infrastructure ready!"
echo ""

# Install dependencies
echo "📦 Installing dependencies..."

echo "  → Order Service..."
cd services/order-service
npm install > /dev/null 2>&1
cd ../..

echo "  → Inventory Service..."
cd services/inventory-service
npm install > /dev/null 2>&1
cd ../..

echo "  → Frontend..."
cd services/frontend
npm install > /dev/null 2>&1
cd ../..

echo "✅ Dependencies installed!"
echo ""

# Instructions for running services
echo "🎯 Setup complete! Now start the services:"
echo ""
echo "Terminal 1 - Order Service:"
echo "  cd services/order-service && npm run dev"
echo ""
echo "Terminal 2 - Inventory Service:"
echo "  cd services/inventory-service && npm run dev"
echo ""
echo "Terminal 3 - Frontend:"
echo "  cd services/frontend && npm run dev"
echo ""
echo "Then visit:"
echo "  Frontend:  http://localhost:3000"
echo "  Order API: http://localhost:3001"
echo "  Inventory: http://localhost:3002"
echo ""
echo "💡 Tip: Use 'docker-compose logs -f' to see database logs"
echo ""
