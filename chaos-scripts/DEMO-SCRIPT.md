# 🎯 Quick Demo Script for Judges (2 Minutes)

## Setup (Before Demo)
```bash
# Have 3 terminals open side-by-side:
# Terminal 1: Order Service logs (running)
# Terminal 2: Inventory Service logs (running)
# Terminal 3: Commands
```

## The Demo

### 🎬 Opening (10 seconds)
> "Let me show you the hardest distributed systems problem: **Schrödinger's Warehouse**. 
> Watch what happens when a service crashes AFTER the database commits but BEFORE sending a response."

### 📊 Step 1: Show Initial State (10 seconds)
```bash
# Terminal 3
curl http://localhost:3002/api/inventory/ps5 | jq '.item.quantity'
```
> "We have 97 PS5s in stock."

### 💣 Step 2: Enable Chaos (15 seconds)
```bash
curl -X POST http://localhost:3002/api/admin/chaos \
  -H "Content-Type: application/json" \
  -d '{"partial_failure_rate": 1.0}'
```
> "I'm enabling partial failures at 100%. This means the database WILL commit, but the HTTP response WILL fail."

### 🎲 Step 3: Create Order (20 seconds)
```bash
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-crash-test" \
  -d '{"item_id": "ps5", "quantity": 2}'
```

**Point to Terminal 2 (Inventory logs):**
> "Look here - you'll see: 'Stock deducted successfully' followed by 'PARTIAL FAILURE: DB committed but response failed'"

**Point to Terminal 1 (Order logs):**
> "And here - Order Service sees 'Inventory service error' and opens the circuit breaker."

### 🔍 Step 4: Check Inventory (15 seconds)
```bash
curl http://localhost:3002/api/inventory/ps5 | jq '.item.quantity'
```
> "Look at this! Stock is now 95. The database DID commit, even though we got an error!"

### 🔧 Step 5: Disable Chaos (5 seconds)
```bash
curl -X DELETE http://localhost:3002/api/admin/chaos
```

### 🔄 Step 6: Retry (20 seconds)
```bash
curl -X POST http://localhost:3001/api/orders \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: demo-crash-test" \
  -d '{"item_id": "ps5", "quantity": 2}'
```

**Point to Terminal 1:**
> "Idempotency cache hit - same response returned"

### ✅ Step 7: Final Verification (15 seconds)
```bash
curl http://localhost:3002/api/inventory/ps5 | jq '.item.quantity'
```
> "Still 95! Stock was NOT deducted twice!"

### 🎓 Closing (20 seconds)
> "This demonstrates three critical patterns:
> 
> 1. **Idempotency**: Same request, same result, no duplicate operations
> 2. **Circuit Breaker**: Fails fast when downstream is broken
> 3. **Database as Truth**: We trust the commit, not the HTTP response
> 
> Most systems fail this test. Ours passes because inventory tracks every order_id, 
> so retries are safe and stock is never double-deducted."

---

## 🎯 Judge Questions & Answers

### Q: "What if the database crashes before commit?"
**A:** "Then the transaction rolls back automatically. Nothing is saved. 
When retried, it processes normally as a new request."

### Q: "What happens to the queued orders?"
**A:** "They're stored in Redis Streams. A background worker would process them 
when inventory recovers. We can demo this with a manual retry."

### Q: "How do you prevent race conditions?"
**A:** "We use `SELECT FOR UPDATE` in the inventory check. 
The row is locked during the transaction, preventing concurrent modifications."

### Q: "What about network retries causing duplicates?"
**A:** "That's exactly what we're demonstrating! The idempotency key at the 
Order Service level prevents duplicate orders. The order_id at the Inventory level 
prevents duplicate stock deductions. Two layers of protection."

### Q: "Can you show the database state?"
**A:** 
```bash
# Show order
curl http://localhost:3001/api/orders | jq '.orders[-1]'

# Or connect to PostgreSQL
psql -U valerix -d inventory_db -c \
  "SELECT * FROM inventory_transactions ORDER BY created_at DESC LIMIT 5;"
```

---

## 🚨 Troubleshooting During Demo

**If chaos doesn't trigger:**
- Check: `curl http://localhost:3002/api/admin/chaos`
- Re-enable with higher rate: `{"partial_failure_rate": 1.0}`

**If services are down:**
- Quick check: `curl http://localhost:3001/health && curl http://localhost:3002/health`
- Restart if needed (have terminal ready)

**If inventory isn't deducted:**
- Check circuit breaker might be open
- Wait 10 seconds for half-open state
- Or restart Order Service to reset

**If demo freezes:**
- Have backup recorded video
- Or show logs from previous test run
- Have screenshots ready

---

## 📸 Screenshots to Have Ready

1. **Architecture Diagram** - Show microservices layout
2. **Logs Screenshot** - With "PARTIAL FAILURE" highlighted
3. **Grafana Dashboard** - Showing circuit breaker state
4. **Code Snippet** - The idempotency check in inventory controller

---

## 🏆 Why This Wins

Most teams:
- ❌ Trust HTTP responses
- ❌ Don't handle partial failures
- ❌ Can't explain Schrödinger's Warehouse
- ❌ Have race conditions

Your team:
- ✅ Understands distributed systems deeply
- ✅ Implements production-grade patterns
- ✅ Can demonstrate AND explain
- ✅ Handles the worst-case scenario

This is **champion-level** engineering.
