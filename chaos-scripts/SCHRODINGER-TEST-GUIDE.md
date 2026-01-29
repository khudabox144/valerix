# 🧪 Testing Schrödinger's Warehouse Scenario

This guide shows you how to test the exact nightmare scenario where:
1. Inventory deducts stock
2. Database COMMIT succeeds ✅
3. Inventory crashes 💥 BEFORE sending HTTP response
4. Order Service sees failure and retries
5. Idempotency prevents double deduction

## 🚀 Quick Test (Automated)

Run the automated test script:

```bash
cd /home/sakib/valerix
./chaos-scripts/test-schrodinger.sh
```

This will:
- Enable partial failure mode (100% crash rate after commit)
- Create an order
- Verify stock was deducted
- Retry the order
- Verify stock was NOT deducted again

## 🔬 Manual Test (Step-by-Step)

### Step 1: Check Initial Inventory

```bash
curl http://localhost:3002/api/inventory/ps5 | jq '.item.quantity'
# Example output: 99
```

### Step 2: Enable Chaos (Partial Failures)

```bash
curl -X POST http://localhost:3002/api/admin/chaos \
  -H "Content-Type: application/json" \
  -d '{
    "latency": false,
    "crash_rate": 0,
    "partial_failure_rate": 1.0
  }'
```

This sets partial failures to 100%, meaning:
- ✅ Database WILL commit
- 💥 HTTP response WILL fail

### Step 3: Create Order (Will Fail)

```bash
# Generate a unique order ID
ORDER_ID=$(uuidgen)
IDEMPOTENCY_KEY=$(uuidgen)

# Create order
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d "{
    \"item_id\": \"ps5\",
    \"quantity\": 2
  }"
```

**Expected Result:** 
- HTTP 500 or connection error
- BUT stock IS deducted in database!

### Step 4: Verify Stock Was Deducted

```bash
curl http://localhost:3002/api/inventory/ps5 | jq '.item.quantity'
# Example output: 97 (was 99, now 97 - deducted 2!)
```

🔥 **This proves the database committed even though HTTP response failed!**

### Step 5: Check Inventory Service Logs

Look for this log entry in the inventory service terminal:

```
⚠️ PARTIAL FAILURE: DB committed but response failed
```

This confirms the Schrödinger scenario happened.

### Step 6: Disable Chaos Mode

```bash
curl -X DELETE http://localhost:3002/api/admin/chaos
```

### Step 7: Retry the SAME Order

```bash
# Use the SAME idempotency key from Step 3
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $IDEMPOTENCY_KEY" \
  -d "{
    \"item_id\": \"ps5\",
    \"quantity\": 2
  }"
```

**Expected Result:**
- HTTP 200 Success ✅
- Order created or returned from cache
- Message: "Order created successfully"

### Step 8: Verify Stock NOT Deducted Again

```bash
curl http://localhost:3002/api/inventory/ps5 | jq '.item.quantity'
# Example output: 97 (SAME as Step 4 - NOT deducted again!)
```

🎉 **SUCCESS!** Stock was NOT deducted a second time!

### Step 9: Verify in Order Service

Check that only ONE order was created:

```bash
curl http://localhost:3001/api/orders | jq '.count'
# Should show 1 order (not 2)
```

## 🧠 What This Proves

This test demonstrates:

1. **Database commits are durable** - Even if the process crashes, the transaction is saved
2. **HTTP is unreliable** - Response can fail even when operation succeeded
3. **Idempotency works** - Retries don't cause duplicate state changes
4. **Order ID is the key** - Inventory uses order_id to detect duplicates
5. **System converges to correct state** - Eventually consistent despite failures

## 🎯 Timeline Visualization

```
Time  Event                           DB State    HTTP Response
────────────────────────────────────────────────────────────────
T1    Order Service receives request  -           -
T2    Inventory begins transaction    LOCKED      -
T3    Stock deducted (100 → 98)       UPDATED     -
T4    Transaction recorded            INSERTED    -
T5    Database COMMIT ✅              COMMITTED   -
T6    💥 CRASH 💥                     COMMITTED   FAILED ❌
T7    Order Service sees error        COMMITTED   TIMEOUT
T8    User/System retries             COMMITTED   -
T9    Idempotency check finds order   COMMITTED   -
T10   Return success (no deduction)   COMMITTED   SUCCESS ✅
```

## 🏆 Explaining to Judges (30 seconds)

> "Let me show you the hardest distributed systems problem: Schrödinger's Warehouse.
> 
> Watch: I enable partial failures. Now when I create an order... [show HTTP error]
> But look at the database: stock WAS deducted! The commit succeeded but the response failed.
> 
> Now I retry with the same idempotency key... [show success]
> And check the stock: it wasn't deducted twice! 
> 
> This is because inventory tracks every order_id. When it sees the retry, it knows 'I already processed this' and returns success without deducting again.
> 
> This proves our system handles the worst-case distributed systems failure correctly."

## 📊 Key Logs to Watch

**Order Service:**
```
info: Creating order
error: Inventory service error (should show timeout or 500)
info: Order queued for retry OR Circuit breaker opened
info: Idempotency cache hit (on retry)
```

**Inventory Service:**
```
info: Deducting stock
info: Stock deducted successfully
⚠️  PARTIAL FAILURE: DB committed but response failed
info: ⚡ IDEMPOTENCY: Order already processed (on retry)
```

## 🐛 Troubleshooting

**If stock gets deducted twice:**
- Check that `order_id` is being passed from Order Service
- Verify the idempotency check in inventory controller
- Look for duplicate entries in `inventory_transactions` table

**If test doesn't trigger chaos:**
- Verify chaos mode is enabled: `curl http://localhost:3002/api/admin/chaos`
- Check that `partial_failure_rate` is 1.0
- Look for gremlin middleware logs

**If you can't reproduce:**
- Make sure both services are running
- Clear Redis cache: `redis-cli FLUSHALL`
- Restart services to reset circuit breaker state

## 📚 Database Verification Queries

Connect to PostgreSQL and run:

```sql
-- Check inventory_transactions for order_id
SELECT * FROM inventory_transactions 
WHERE order_id = 'YOUR_ORDER_ID_HERE' 
ORDER BY created_at DESC;

-- Should see exactly ONE entry per order_id

-- Check inventory stock levels
SELECT item_id, quantity FROM inventory WHERE item_id = 'ps5';
```

## 🎬 Recording for Demo

When presenting to judges:

1. Open 3 terminals side-by-side:
   - Terminal 1: Order Service logs
   - Terminal 2: Inventory Service logs  
   - Terminal 3: Running commands

2. Run commands slowly, narrating each step

3. Point out the key logs as they appear

4. Show the final verification clearly

Good luck! 🚀
