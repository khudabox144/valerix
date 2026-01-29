import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// Chaos test configuration - aggressive load
export const options = {
  stages: [
    { duration: '10s', target: 50 },   // Quick ramp to 50 users
    { duration: '30s', target: 100 },  // Increase to 100
    { duration: '20s', target: 150 },  // Spike to 150
    { duration: '30s', target: 50 },   // Back down
    { duration: '10s', target: 0 },    // End
  ],
  thresholds: {
    'http_req_duration': ['p(95)<5000'], // More lenient during chaos
    'checks': ['rate>0.7'],              // 70% success rate during chaos
  },
};

const ORDER_API = __ENV.ORDER_API || 'http://localhost:3001';
const INVENTORY_API = __ENV.INVENTORY_API || 'http://localhost:3002';

const ITEMS = ['ps5', 'xbox', 'switch', 'laptop', 'monitor'];

export function setup() {
  // Enable chaos mode before test
  console.log('🔴 Enabling chaos mode...');
  
  const chaosConfig = JSON.stringify({
    latency: true,
    latency_ms: 5000,
    crash_rate: 0.3,
    partial_failure_rate: 0.2,
  });

  const response = http.post(
    `${INVENTORY_API}/api/admin/chaos`,
    chaosConfig,
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (response.status === 200) {
    console.log('✅ Chaos mode enabled!');
  } else {
    console.log('⚠️ Failed to enable chaos mode');
  }

  return { chaosEnabled: response.status === 200 };
}

export default function (data) {
  const idempotencyKey = uuidv4();
  const itemId = ITEMS[Math.floor(Math.random() * ITEMS.length)];
  const quantity = Math.floor(Math.random() * 3) + 1;

  const payload = JSON.stringify({
    item_id: itemId,
    quantity: quantity,
  });

  const params = {
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    timeout: '15s', // Longer timeout for chaos
  };

  const startTime = new Date().getTime();
  const response = http.post(`${ORDER_API}/api/orders`, payload, params);
  const duration = new Date().getTime() - startTime;

  const result = check(response, {
    'request completed': (r) => r.status !== 0, // Any response is good during chaos
    'order created or queued': (r) => r.status === 201 || r.status === 202,
    'circuit breaker active': (r) => r.status === 202,
    'has response body': (r) => r.body && r.body.length > 0,
  });

  if (response.status === 201) {
    console.log(`✅ [${duration}ms] Order confirmed: ${itemId} x ${quantity}`);
  } else if (response.status === 202) {
    console.log(`⚠️ [${duration}ms] Order queued (circuit breaker): ${itemId} x ${quantity}`);
  } else if (response.status === 422) {
    console.log(`❌ [${duration}ms] Order failed (inventory): ${response.body.substring(0, 50)}`);
  } else if (response.status === 0) {
    console.log(`💀 [${duration}ms] Request timeout/failed: ${itemId} x ${quantity}`);
  } else {
    console.log(`⚠️ [${duration}ms] Unexpected response ${response.status}: ${response.body.substring(0, 50)}`);
  }

  sleep(Math.random() * 1); // Short random sleep
}

export function teardown(data) {
  // Disable chaos mode after test
  console.log('🟢 Disabling chaos mode...');
  
  const response = http.del(`${INVENTORY_API}/api/admin/chaos`);
  
  if (response.status === 200) {
    console.log('✅ Chaos mode disabled');
  } else {
    console.log('⚠️ Failed to disable chaos mode');
  }
}

export function handleSummary(data) {
  console.log('\n' + '='.repeat(60));
  console.log('🎯 CHAOS TEST SUMMARY');
  console.log('='.repeat(60));

  const httpReqs = data.metrics.http_reqs.values.count;
  const failedReqs = data.metrics.http_req_failed.values.rate * 100;
  const avgDuration = data.metrics.http_req_duration.values.avg;
  const p95Duration = data.metrics.http_req_duration.values['p(95)'];
  const maxDuration = data.metrics.http_req_duration.values.max;

  console.log(`\nTotal Requests: ${httpReqs}`);
  console.log(`Failed Requests: ${failedReqs.toFixed(2)}%`);
  console.log(`Avg Duration: ${avgDuration.toFixed(2)}ms`);
  console.log(`P95 Duration: ${p95Duration.toFixed(2)}ms`);
  console.log(`Max Duration: ${maxDuration.toFixed(2)}ms`);

  if (data.metrics.checks) {
    const checksPassed = data.metrics.checks.values.passes || 0;
    const checksFailed = data.metrics.checks.values.fails || 0;
    const checksTotal = checksPassed + checksFailed;
    const checksRate = checksTotal > 0 ? (checksPassed / checksTotal * 100).toFixed(2) : 0;
    console.log(`\nChecks Passed: ${checksRate}% (${checksPassed}/${checksTotal})`);
  }

  console.log('\n' + '='.repeat(60));

  return {
    'chaos-summary.json': JSON.stringify(data, null, 2),
  };
}
