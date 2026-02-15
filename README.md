<div align="center">

# ⚡ Valerix — Resilient E-Commerce Microservices Platform

**A production-grade microservices architecture built to survive chaos.**

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?style=flat-square&logo=docker&logoColor=white)](https://www.docker.com/)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-Ready-326CE5?style=flat-square&logo=kubernetes&logoColor=white)](https://kubernetes.io/)
[![Prometheus](https://img.shields.io/badge/Prometheus-Monitoring-E6522C?style=flat-square&logo=prometheus&logoColor=white)](https://prometheus.io/)
[![Next.js](https://img.shields.io/badge/Next.js-14-000000?style=flat-square&logo=next.js&logoColor=white)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?style=flat-square&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Redis](https://img.shields.io/badge/Redis-7.2-DC382D?style=flat-square&logo=redis&logoColor=white)](https://redis.io/)

[Quick Start](#-quick-start) · [Architecture](#-architecture) · [API Reference](#-api-reference) · [Chaos Engineering](#-chaos-engineering) · [Deployment](#-deployment)

</div>

---

## 📋 Table of Contents

- [Problem Statement](#-problem-statement)
- [Key Features](#-key-features)
- [Architecture](#-architecture)
- [Quick Start](#-quick-start)
- [Project Structure](#-project-structure)
- [API Reference](#-api-reference)
- [Resilience Patterns](#-resilience-patterns)
- [Chaos Engineering](#-chaos-engineering)
- [Health Monitoring](#-health-monitoring)
- [Deployment](#-deployment)
- [Tech Stack](#-tech-stack)

---

## 🎯 Problem Statement

Valerix operates a massive e-commerce platform that was built as a **monolithic application**.
A single failure — a slow database query, a network hiccup — would cascade and take down the
entire order flow for thousands of users.

**This project decomposes that monolith into resilient microservices** that can:

- Survive partial failures (Schrödinger's Warehouse problem)
- Handle inventory service latency without freezing orders
- Process orders exactly once even during retries and crashes
- Self-heal through circuit breakers and fallback queues
- Be observed in real-time through health dashboards and Prometheus metrics

---

## ✨ Key Features

| Feature | Description |
|---|---|
| **Microservice Architecture** | Separate Order & Inventory services with independent databases |
| **Circuit Breaker** | [Opossum](https://github.com/nodeshift/opossum)-based circuit breaker protects the Order Service when Inventory is slow/down |
| **Idempotency** | Every order request requires an `Idempotency-Key` header — safe to retry without duplicates |
| **Schrödinger's Warehouse** | Handles the case where DB commits but response fails — solved via server-side idempotency checks |
| **Gremlin Middleware** | Configurable chaos injection: latency, crashes, and partial failures — all toggled at runtime via API |
| **Health Endpoints** | `/health` verifies downstream dependencies (DB tables, Redis, peer services) — not just `200 OK` |
| **Visual Alert Dashboard** | Response time monitor turns 🟢→🔴 when 30-second rolling average exceeds 1 second |
| **Prometheus + Grafana** | Custom metrics: circuit breaker state, chaos events, order durations, stock levels |
| **Redis Streams** | Failed inventory updates are queued for async retry processing |
| **Kubernetes-Ready** | Full K8s manifests: StatefulSets, ConfigMaps, Secrets, Ingress, CronJobs |
| **Automated Load Testing** | k6 scripts for load testing and chaos testing with summary reports |
| **Backup Strategy** | Kubernetes CronJob for daily PostgreSQL backups |

---

## 🏗 Architecture

```
┌─────────────┐       ┌─────────────────┐       ┌──────────────────┐
│   Frontend   │──────▶│  Order Service   │──────▶│ Inventory Service │
│  (Next.js)   │       │   (Express.js)   │       │   (Express.js)    │
│  Port 3000   │       │   Port 3001      │       │   Port 3002       │
└─────────────┘       └────────┬─────────┘       └────────┬──────────┘
                               │                          │
                    ┌──────────┴──────────┐    ┌──────────┴──────────┐
                    │   order_db (PG)     │    │  inventory_db (PG)  │
                    └─────────────────────┘    └─────────────────────┘
                               │                          │
                               └──────────┬───────────────┘
                                          │
                                    ┌─────┴─────┐
                                    │   Redis    │
                                    │ (Streams + │
                                    │  Caching)  │
                                    └─────┬─────┘
                                          │
                              ┌───────────┴───────────┐
                              │     Prometheus        │
                              │   ──▶ Grafana         │
                              └───────────────────────┘
```

**Data flow when an order is placed:**

1. Frontend sends `POST /api/orders` with an `Idempotency-Key` header
2. Order Service checks Redis idempotency cache → returns cached response if duplicate
3. Order is persisted in `order_db` with status `pending`
4. Order Service calls Inventory Service **through a circuit breaker** (3 s timeout)
5. If inventory responds → stock deducted, order marked `confirmed`
6. If circuit breaker opens → order marked `queued`, pushed to Redis Stream for async retry
7. If Schrödinger failure occurs → Inventory's own idempotency check prevents double-deduction on retry

---

## 🚀 Quick Start

### Prerequisites

- [Docker](https://www.docker.com/) & Docker Compose
- [Node.js 18+](https://nodejs.org/) (for local dev without Docker)

### Option A: Docker Compose (Recommended)

```bash
# Clone the repository
git clone https://github.com/<your-username>/valerix.git
cd valerix

# Copy environment variables
cp .env.example .env

# Start everything (PostgreSQL, Redis, Services, Frontend, Prometheus, Grafana)
docker-compose up --build
```

Once running, open:

| Service | URL |
|---|---|
| **Frontend** | http://localhost:3000 |
| **Order Service API** | http://localhost:3001 |
| **Inventory Service API** | http://localhost:3002 |
| **Prometheus** | http://localhost:9090 |
| **Grafana** | http://localhost:3100 (admin / admin123) |

### Option B: Local Development

```bash
# Start only infrastructure
docker-compose up -d postgres redis

# Wait ~10 seconds for DBs to initialize, then in separate terminals:

# Terminal 1 — Order Service
cd services/order-service && npm install && npm run dev

# Terminal 2 — Inventory Service
cd services/inventory-service && npm install && npm run dev

# Terminal 3 — Frontend
cd services/frontend && npm install && npm run dev
```

---

## 📁 Project Structure

```
valerix/
├── services/
│   ├── order-service/          # Order processing microservice
│   │   ├── src/
│   │   │   ├── controllers/    # Route handlers (orderController, healthController)
│   │   │   ├── middleware/      # Idempotency middleware
│   │   │   ├── services/       # Circuit breaker wrapper
│   │   │   └── config/         # DB, Redis, Logger, Prometheus metrics
│   │   └── Dockerfile
│   ├── inventory-service/      # Stock management microservice
│   │   ├── src/
│   │   │   ├── controllers/    # Inventory, health, chaos admin handlers
│   │   │   ├── middleware/      # Gremlin (chaos injection) middleware
│   │   │   └── config/         # DB, Redis, Logger, Prometheus metrics
│   │   └── Dockerfile
│   └── frontend/               # Next.js 14 dashboard
│       ├── components/         # HealthDashboard, ChaosControls, etc.
│       ├── pages/              # App pages
│       └── Dockerfile
├── scripts/
│   ├── init-db.sql             # Database schema & seed data
│   ├── deploy.sh               # DigitalOcean K8s deployment
│   └── local-setup.sh          # Local dev bootstrapper
├── chaos-scripts/              # k6 load & chaos test scripts
├── k8s/                        # Kubernetes manifests
├── monitoring/                 # Prometheus config
├── grafana/                    # Grafana provisioning (dashboards + datasources)
├── docker-compose.yml          # Full local stack
└── .env.example                # Environment variable template
```

---

## 📡 API Reference

### Order Service — `http://localhost:3001`

| Method | Endpoint | Headers | Description |
|--------|----------|---------|-------------|
| `POST` | `/api/orders` | `Idempotency-Key: <uuid>` | Create a new order |
| `GET` | `/api/orders/:id` | — | Get order by ID |
| `GET` | `/api/orders` | — | List recent orders (last 100) |
| `GET` | `/health` | — | Basic health (DB + Redis) |
| `GET` | `/health/deep` | — | Deep health (includes Inventory Service) |
| `GET` | `/metrics` | — | Prometheus metrics |

**Create Order example:**

```bash
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"item_id": "ps5", "quantity": 2}'
```

**Possible responses:**

| Status | Meaning |
|--------|---------|
| `201` | Order confirmed — inventory deducted successfully |
| `202` | Order queued — circuit breaker active, will process later via Redis Stream |
| `400` | Missing `Idempotency-Key` header or invalid body |
| `422` | Inventory error (insufficient stock, item not found) |
| `500` | Internal server error |

### Inventory Service — `http://localhost:3002`

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/inventory/deduct` | Deduct stock (called by Order Service) |
| `GET` | `/api/inventory/:item_id` | Get stock for an item |
| `GET` | `/api/inventory` | List all inventory |
| `POST` | `/api/admin/chaos` | Enable chaos injection |
| `GET` | `/api/admin/chaos` | Get current chaos config |
| `DELETE` | `/api/admin/chaos` | Disable all chaos |
| `GET` | `/health` | Health check (DB tables + Redis) |
| `GET` | `/metrics` | Prometheus metrics |

---

## 🛡 Resilience Patterns

### 1. Circuit Breaker (Opossum)

When the Inventory Service is slow or failing, the circuit breaker prevents cascading failures:

```
CLOSED ──(50% failures)──▶ OPEN ──(10s cooldown)──▶ HALF-OPEN ──(success)──▶ CLOSED
                                                         │
                                                     (failure)
                                                         │
                                                         ▼
                                                       OPEN
```

- **Timeout:** 3 seconds per request
- **Error threshold:** 50% failure rate opens the circuit
- **Reset timeout:** 10 seconds before trying again
- **Fallback:** Order is saved as `queued` and pushed to Redis Stream

### 2. Idempotency Keys

Every `POST /api/orders` must include an `Idempotency-Key` header. The middleware:

1. Checks Redis for a cached response under that key
2. If found → returns the cached response (no duplicate processing)
3. If not → processes the request and caches the response for 24 hours

This solves **the Schrödinger's Warehouse problem**: even if the Inventory Service commits
to DB but crashes before responding, the Order Service can safely retry. The Inventory Service
also performs a server-side idempotency check on `order_id` in the `inventory_transactions`
table — preventing double-deduction at the database level.

### 3. Gremlin Middleware (Chaos Injection)

The Inventory Service has a middleware that reads chaos configuration from Redis and
introduces controlled failures:

| Chaos Type | What It Does |
|---|---|
| **Latency** | Adds configurable delay (1–15 seconds) before processing |
| **Crash** | Randomly returns 500, 503, or destroys the socket |
| **Partial Failure** | DB commits successfully, then response fails — the Schrödinger scenario |

---

## 🔥 Chaos Engineering

### Quick Demo (from the UI)

1. Open the **Chaos Control** tab in the frontend
2. Click a preset: **Mild**, **Moderate**, or **Extreme**
3. Switch to the **Health** tab — watch the alert banner turn red
4. Create orders on the **Products** tab — they still succeed via circuit breaker fallback
5. Click **Disable All Chaos** — system recovers to green

### CLI Demo

```bash
# Enable moderate chaos
curl -X POST http://localhost:3002/api/admin/chaos \
  -H "Content-Type: application/json" \
  -d '{"latency": true, "latency_ms": 5000, "crash_rate": 0.3, "partial_failure_rate": 0.2}'

# Create an order (should get 201 or 202 depending on circuit state)
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: test-$(date +%s)" \
  -d '{"item_id": "ps5", "quantity": 1}'

# Disable chaos
curl -X DELETE http://localhost:3002/api/admin/chaos
```

### Automated Load Testing (k6)

```bash
# Install k6: https://k6.io/docs/getting-started/installation/

# Normal load test
k6 run chaos-scripts/load-test.js

# Chaos test (auto-enables chaos, runs load, auto-disables)
k6 run chaos-scripts/chaos-test.js
```

---

## 📊 Health Monitoring

### Health Endpoint Behavior

The `/health` endpoint is **not** a simple `200 OK`. It verifies:

- ✅ PostgreSQL connection is alive
- ✅ The expected tables exist (`orders` / `inventory`)
- ✅ Tables are queryable
- ✅ Redis can be pinged and can perform read/write operations

If any check fails, the endpoint returns **503** with detailed error information.

The Order Service's `/health/deep` additionally pings the Inventory Service's health endpoint.

### Visual Alert Dashboard

The frontend **Health** tab implements a **rolling 30-second average** of Order Service
response times. The status indicator changes:

| Average Response Time | Color | Status |
|---|---|---|
| < 500ms | 🟢 Green | OPTIMAL |
| 500ms – 1000ms | 🟡 Yellow | WARNING |
| > 1000ms | 🔴 Red | CRITICAL — alert banner appears |

### Prometheus Metrics

Key custom metrics exported by both services:

| Metric | Type | Description |
|---|---|---|
| `http_request_duration_seconds` | Histogram | Request latency by route |
| `order_processing_duration_seconds` | Histogram | End-to-end order time |
| `circuit_breaker_state` | Gauge | 0=closed, 1=open, 2=half-open |
| `idempotency_cache_hits_total` | Counter | Duplicate request detections |
| `inventory_chaos_events_total` | Counter | Chaos events by type |
| `inventory_stock_level` | Gauge | Current stock per item |

---

## ☁️ Deployment

### Option 1: DigitalOcean Kubernetes (Production)

The project includes a full deployment script at [scripts/deploy.sh](scripts/deploy.sh).

**Prerequisites:** `doctl`, `kubectl`, `helm`, Docker

```bash
# Authenticate with DigitalOcean
doctl auth init

# Run the deployment script
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

The script will:
1. Create a container registry
2. Provision a 2-node Kubernetes cluster (~$48/mo)
3. Install Nginx Ingress Controller
4. Build & push all Docker images
5. Deploy PostgreSQL (StatefulSet) + Redis
6. Deploy Order Service, Inventory Service, Frontend
7. Install Prometheus + Grafana monitoring

**Estimated cost:** ~$65/month

### Option 2: Single VPS with Docker Compose

For a budget-friendly deployment on any VPS (DigitalOcean Droplet, AWS EC2, etc.):

```bash
# SSH into your server
ssh root@your-server-ip

# Clone and start
git clone https://github.com/<your-username>/valerix.git
cd valerix
cp .env.example .env

# Edit .env to set production passwords
nano .env

# Start all services
docker-compose up -d --build

# Verify
curl http://localhost:3001/health
curl http://localhost:3002/health
```

**Recommended VPS:** 2 vCPU, 4 GB RAM (~$24/month on DigitalOcean)

### Backup Strategy

The K8s manifests include a CronJob ([k8s/infrastructure/backup-cronjob.yaml](k8s/infrastructure/backup-cronjob.yaml))
that runs a daily `pg_dump` of both databases into a single compressed archive.
This satisfies the "one backup call per day" constraint by batching both databases
into one operation.

---

## 🧰 Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| **Backend** | Node.js 18 + Express.js | Microservice runtime |
| **Frontend** | Next.js 14 + Tailwind CSS | Dashboard UI |
| **Database** | PostgreSQL 15 | Persistent storage (separate DBs per service) |
| **Cache/Queue** | Redis 7.2 (Streams) | Idempotency cache + async job queue |
| **Circuit Breaker** | Opossum | Fault tolerance for inter-service calls |
| **Monitoring** | Prometheus + Grafana | Metrics collection + visualization |
| **Containerization** | Docker + Docker Compose | Local dev + production packaging |
| **Orchestration** | Kubernetes (DOKS) | Production deployment |
| **Load Testing** | k6 | Automated load & chaos tests |
| **Logging** | Winston | Structured JSON logging |

---

## 📜 License

MIT — feel free to use this as a reference for your own microservice projects.

---

<div align="center">

**Built with ❤️ for BUET Fest Hackathon 2026**

*Demonstrating production-grade microservice design, chaos engineering, and DevOps practices.*

</div>
