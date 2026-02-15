import http from 'k6/http';
import { check, sleep } from 'k6';
import { uuidv4 } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js';

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 20 },  // Ramp up to 20 users
    { duration: '1m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 100 }, // Spike to 100 users
    { duration: '1m', target: 50 },   // Back down to 50
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<3000'], // 95% of requests should be below 3s
    'http_req_failed': ['rate<0.5'],     // Error rate should be below 50%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3001';

const ITEMS = ['ps5', 'xbox', 'switch', 'laptop', 'monitor'];

export default function () {
  // Test 1: Create Order
  const idempotencyKey = uuidv4();
  const itemId = ITEMS[Math.floor(Math.random() * ITEMS.length)];
  const quantity = Math.floor(Math.random() * 5) + 1;

  const orderPayload = JSON.stringify({
    item_id: itemId,
    quantity: quantity,
  });

  const orderParams = {
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': idempotencyKey,
    },
    timeout: '10s',
  };

  console.log(`Creating order: ${itemId} x ${quantity} (key: ${idempotencyKey})`);

  const orderResponse = http.post(
    `${BASE_URL}/api/orders`,
    orderPayload,
    orderParams
  );

  const orderSuccess = check(orderResponse, {
    'order created': (r) => r.status === 201,
    'order queued (circuit breaker)': (r) => r.status === 202,
    'order response has order_id': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.order && body.order.order_id;
      } catch (e) {
        return false;
      }
    },
  });

  if (orderSuccess) {
    const orderData = JSON.parse(orderResponse.body);
    console.log(`✅ Order ${orderData.order.order_id}: ${orderData.order.status}`);

    // Test 2: Fetch the created order
    sleep(1);
    
    const fetchResponse = http.get(
      `${BASE_URL}/api/orders/${orderData.order.order_id}`,
      { timeout: '5s' }
    );

    check(fetchResponse, {
      'order fetch successful': (r) => r.status === 200,
      'order data matches': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.order.order_id === orderData.order.order_id;
        } catch (e) {
          return false;
        }
      },
    });

    // Test 3: Test idempotency - retry with same key
    sleep(0.5);
    
    const retryResponse = http.post(
      `${BASE_URL}/api/orders`,
      orderPayload,
      orderParams
    );

    check(retryResponse, {
      'idempotency works': (r) => r.status === 200 || r.status === 201 || r.status === 202,
      'same order returned': (r) => {
        try {
          const body = JSON.parse(r.body);
          return body.order.order_id === orderData.order.order_id;
        } catch (e) {
          return false;
        }
      },
    });

  } else {
    console.log(`❌ Order creation failed: ${orderResponse.status} - ${orderResponse.body}`);
  }

  sleep(Math.random() * 2 + 1); // Random sleep 1-3 seconds
}

export function handleSummary(data) {
  return {
    'summary.json': JSON.stringify(data, null, 2),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const colors = options.enableColors !== false;

  let summary = '\n';
  summary += `${indent}✓ Load Test Results\n`;
  summary += `${indent}${'='.repeat(50)}\n\n`;

  summary += `${indent}Checks:\n`;
  if (data.metrics.checks && data.metrics.checks.values) {
    const passes = data.metrics.checks.values.passes || 0;
    const fails = data.metrics.checks.values.fails || 0;
    const total = passes + fails;
    const rate = total > 0 ? (passes / total * 100).toFixed(2) : 0;
    summary += `${indent}  Passed: ${rate}% (${passes}/${total})\n`;
  }

  summary += `\n${indent}HTTP Metrics:\n`;
  summary += `${indent}  Requests: ${data.metrics.http_reqs.values.count}\n`;
  summary += `${indent}  Failed: ${data.metrics.http_req_failed.values.rate.toFixed(2)}%\n`;
  summary += `${indent}  Duration (avg): ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms\n`;
  summary += `${indent}  Duration (p95): ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms\n`;
  summary += `${indent}  Duration (max): ${data.metrics.http_req_duration.values.max.toFixed(2)}ms\n`;

  return summary;
}
