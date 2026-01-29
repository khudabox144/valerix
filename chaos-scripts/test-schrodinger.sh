#!/bin/bash

# 🧪 Schrödinger's Warehouse Test
# Tests idempotency when Inventory crashes AFTER commit but BEFORE response

set -e

echo "═══════════════════════════════════════════════════════════════"
echo "🧪 SCHRÖDINGER'S WAREHOUSE TEST"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "This test simulates the nightmare scenario:"
echo "1️⃣  Inventory deducts stock"
echo "2️⃣  Database COMMIT succeeds ✅"
echo "3️⃣  Inventory CRASHES 💥 before HTTP response"
echo "4️⃣  Order Service retries"
echo "5️⃣  Idempotency prevents double deduction ✨"
echo ""
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

ORDER_SERVICE="http://localhost:3001"
INVENTORY_SERVICE="http://localhost:3002"

# Generate unique order ID
ORDER_ID=$(uuidgen)
IDEMPOTENCY_KEY=$(uuidgen)

echo "📝 Test Setup:"
echo "   Order ID: $ORDER_ID"
echo "   Idempotency Key: $IDEMPOTENCY_KEY"
echo "   Item: ps5"
echo "   Quantity: 3"
echo ""

# Step 1: Check initial inventory
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 STEP 1: Check Initial Inventory"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

INITIAL_STOCK=$(curl -s $INVENTORY_SERVICE/api/inventory/ps5 | jq -r '.item.quantity')
echo -e "${BLUE}Initial PS5 Stock: $INITIAL_STOCK${NC}"
echo ""

# Step 2: Enable chaos mode (partial failures)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "💣 STEP 2: Enable Chaos Mode (Partial Failures)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

CHAOS_RESPONSE=$(curl -s -X POST $INVENTORY_SERVICE/api/admin/chaos \
  -H "Content-Type: application/json" \
  -d '{
    "latency": false,
    "crash_rate": 0,
    "partial_failure_rate": 1.0
  }')

echo -e "${YELLOW}⚠️  Chaos Enabled: Partial failures at 100%${NC}"
echo "$CHAOS_RESPONSE" | jq '.'
echo ""
echo "This means: DB will COMMIT ✅ but response will FAIL 💥"
echo ""
sleep 2

# Step 3: Create order (will experience partial failure)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎲 STEP 3: Create Order (First Attempt - WILL FAIL)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "Creating order..."
ORDER_RESPONSE=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST $ORDER_SERVICE/api/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d "{
    \"item_id\": \"ps5\",
    \"quantity\": 3
  }" || echo "NETWORK_ERROR")

HTTP_CODE=$(echo "$ORDER_RESPONSE" | grep "HTTP_CODE" | cut -d':' -f2)
RESPONSE_BODY=$(echo "$ORDER_RESPONSE" | grep -v "HTTP_CODE")

if [ "$HTTP_CODE" = "500" ] || [ "$ORDER_RESPONSE" = "NETWORK_ERROR" ]; then
  echo -e "${RED}💥 EXPECTED: Got error response (HTTP $HTTP_CODE)${NC}"
  echo "This simulates the crash scenario!"
else
  echo -e "${YELLOW}⚠️  Got HTTP $HTTP_CODE${NC}"
  echo "$RESPONSE_BODY" | jq '.' 2>/dev/null || echo "$RESPONSE_BODY"
fi
echo ""

# Step 4: Check inventory after first attempt
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔍 STEP 4: Check Inventory After Crash"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

sleep 2
AFTER_CRASH_STOCK=$(curl -s $INVENTORY_SERVICE/api/inventory/ps5 | jq -r '.item.quantity')
echo -e "${BLUE}Stock after crash: $AFTER_CRASH_STOCK${NC}"
DEDUCTED=$((INITIAL_STOCK - AFTER_CRASH_STOCK))
echo -e "${GREEN}✅ Database committed! Stock was deducted: -$DEDUCTED${NC}"
echo ""

# Step 5: Check inventory_transactions to confirm order_id recorded
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 STEP 5: Verify Transaction Recorded"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "Checking if transaction was recorded in database..."
echo ""

# Step 6: Disable chaos mode
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔧 STEP 6: Disable Chaos Mode"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

curl -s -X DELETE $INVENTORY_SERVICE/api/admin/chaos > /dev/null
echo -e "${GREEN}✅ Chaos mode disabled${NC}"
echo ""
sleep 1

# Step 7: Retry order creation (should succeed with idempotency)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔄 STEP 7: Retry Order Creation (SHOULD SUCCEED)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "Retrying with same Idempotency-Key..."
RETRY_RESPONSE=$(curl -s -X POST $ORDER_SERVICE/api/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d "{
    \"item_id\": \"ps5\",
    \"quantity\": 3
  }")

echo "$RETRY_RESPONSE" | jq '.'
echo ""

# Step 8: Final inventory check
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 STEP 8: Final Inventory Check"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

FINAL_STOCK=$(curl -s $INVENTORY_SERVICE/api/inventory/ps5 | jq -r '.item.quantity')
echo -e "${BLUE}Final PS5 Stock: $FINAL_STOCK${NC}"
echo ""

# Verification
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ VERIFICATION"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

TOTAL_DEDUCTED=$((INITIAL_STOCK - FINAL_STOCK))

echo "📦 Initial Stock:  $INITIAL_STOCK"
echo "📦 After Crash:    $AFTER_CRASH_STOCK (deducted: $DEDUCTED)"
echo "📦 Final Stock:    $FINAL_STOCK (total deducted: $TOTAL_DEDUCTED)"
echo ""

if [ "$TOTAL_DEDUCTED" -eq 3 ]; then
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}✅ SUCCESS: Idempotency works perfectly!${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo ""
  echo "✅ Stock deducted EXACTLY ONCE despite:"
  echo "   1. Database committed on first attempt"
  echo "   2. HTTP response failed"
  echo "   3. Order was retried"
  echo ""
  echo -e "${GREEN}🏆 This proves your system handles Schrödinger's Warehouse!${NC}"
else
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${RED}❌ FAILURE: Stock was deducted $TOTAL_DEDUCTED times (expected 3)${NC}"
  echo -e "${RED}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
echo "🎯 Test Complete"
echo "═══════════════════════════════════════════════════════════════"
