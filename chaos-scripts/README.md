# K6 Load Testing Scripts

This directory contains K6 load testing scripts for the Valerix platform.

## Prerequisites

Install K6:

### macOS
```bash
brew install k6
```

### Linux
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

### Windows
```bash
choco install k6
```

## Tests

### 1. Load Test (`load-test.js`)

Standard load test that simulates normal user behavior.

**Run locally:**
```bash
k6 run load-test.js
```

**Run against deployed service:**
```bash
k6 run --env BASE_URL=http://your-domain.com load-test.js
```

**Custom configuration:**
```bash
# 100 virtual users for 2 minutes
k6 run --vus 100 --duration 2m load-test.js

# Custom stages
k6 run --stage 30s:50,1m:100,30s:0 load-test.js
```

**Features:**
- Ramps up to 100 concurrent users
- Creates orders with random items
- Tests idempotency by retrying requests
- Verifies order retrieval
- Checks circuit breaker behavior

**Thresholds:**
- 95% of requests should complete in <3s
- Error rate should be <50%

### 2. Chaos Test (`chaos-test.js`)

Aggressive chaos engineering test that enables chaos mode and tests system resilience.

**Run locally:**
```bash
k6 run chaos-test.js
```

**Run against deployed service:**
```bash
k6 run \
  --env ORDER_API=http://your-domain.com/order \
  --env INVENTORY_API=http://your-domain.com/inventory \
  chaos-test.js
```

**Features:**
- Automatically enables chaos mode before test
- Simulates 150 concurrent users at peak
- Tests circuit breaker fallback
- Handles timeouts and failures gracefully
- Automatically disables chaos mode after test

**Chaos Configuration:**
- 5-second latency injection
- 30% crash rate
- 20% partial failure rate (Schrödinger's Warehouse)

**Expected Behavior:**
- Some requests will timeout (chaos latency)
- Some orders will be queued (circuit breaker)
- Overall success rate should be >70%
- System should not crash

### 3. Presentation Demo Script

For hackathon presentations:

```bash
# Terminal 1: Start Grafana port-forward
kubectl port-forward svc/monitoring-grafana -n valerix 3000:80

# Terminal 2: Run chaos test
cd chaos-scripts
k6 run \
  --vus 100 \
  --duration 2m \
  --env ORDER_API=http://your-domain.com/order \
  --env INVENTORY_API=http://your-domain.com/inventory \
  chaos-test.js

# Watch Grafana dashboard turn RED, then recover!
```

## Interpreting Results

### Good Signs ✅
- Circuit breaker activating (orders queued)
- P95 latency <5s even during chaos
- System recovers after chaos disabled
- No complete service failures

### Bad Signs ❌
- Total service crash
- Database connection failures
- >80% error rate
- Memory/CPU exhaustion

## Output Files

Tests generate JSON summaries:
- `summary.json` - Load test results
- `chaos-summary.json` - Chaos test results

Use these for analysis and reporting.

## CI/CD Integration

These tests are automatically run by GitHub Actions on every deployment.

See `.github/workflows/deploy.yml` for configuration.

## Tips

1. **Start small**: Begin with low VUs and short duration
2. **Monitor resources**: Watch Grafana while tests run
3. **Check logs**: `kubectl logs -f deployment/order-service -n valerix`
4. **Scale up**: Increase node count if needed
5. **Cost awareness**: Stop tests when done to save credits

## Custom Scenarios

Create your own test by copying a template:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 10,
  duration: '30s',
};

export default function () {
  const response = http.get('http://your-service/api/endpoint');
  check(response, {
    'status is 200': (r) => r.status === 200,
  });
  sleep(1);
}
```

## Troubleshooting

**Problem**: "Connection refused"
- **Solution**: Check if services are running: `kubectl get pods -n valerix`

**Problem**: "All requests timing out"
- **Solution**: Increase timeout in test: `timeout: '30s'`

**Problem**: "Too many failures"
- **Solution**: Normal during chaos test. Check if >70% succeed.

**Problem**: "Out of memory"
- **Solution**: Scale cluster nodes or reduce VUs

## Champion Tips for Hackathon 🏆

1. Run normal load test first to establish baseline
2. Enable chaos mode mid-test to show resilience
3. Show Grafana dashboard during test
4. Highlight circuit breaker messages
5. Demonstrate quick recovery when chaos disabled

This proves your system handles real-world failures!
