# Graceful Degradation Strategy - 100K+ Users

## Architecture Overview

When services fail, Lyra gracefully degrades:

```
User Request
    ↓
Circuit Breaker (Check state: CLOSED/OPEN/HALF_OPEN)
    ↓
Try Request (max 3 retries with exponential backoff)
    ↓
Success? → Return response
    ↓
Failure? → Check for cached response
    ↓
Found cache? → Return cached response + "This is from cache"
    ↓
No cache? → Use fallback response + user-friendly message
```

## Circuit Breakers

### OpenAI API Failures

**Scenario:** OpenAI rate limited or down

**Response:**
```json
{
  "message": "AI service temporarily unavailable. Please try again in a moment.",
  "isCache": true,
  "isFallback": true
}
```

**Fallback Logic:**
1. Try circuit breaker (1 request through)
2. If fails → return cached recent response
3. If no cache → return generic therapeutic message

**Recovery:** Automatic after 30 seconds

### Supabase Database Failures

**Scenario:** Database connection lost

**Response:** User-friendly error + retry button

**Fallback Logic:**
1. Queue message for later processing
2. Show "Message saved locally, will sync when online"
3. Sync when connection restored

**Recovery:** Automatic after 60 seconds

### Redis Cache Failures

**Scenario:** Redis unavailable

**Impact:** Rate limiting degraded to in-memory

**Response:** Requests still process, just less protected

**Recovery:** Automatic after 30 seconds

---

## Implementation Details

### Circuit Breaker States

| State | Behavior | Transition |
|-------|----------|-----------|
| **CLOSED** | All requests pass through | → OPEN (after 5 failures) |
| **OPEN** | Reject requests immediately | → HALF_OPEN (after 60s) |
| **HALF_OPEN** | Allow 1-2 test requests | → CLOSED (if success) / OPEN (if fail) |

### Retry Strategy

```javascript
// Exponential backoff: 1s, 2s, 4s
Attempt 1: Fail → wait 1s → Attempt 2
Attempt 2: Fail → wait 2s → Attempt 3
Attempt 3: Fail → use fallback
```

### Response Caching

**What's cached:**
- Chat responses (24h TTL)
- Psychology module configs (1h TTL)
- User session metadata (1h TTL)

**Cost savings:**
- ~50% reduction in OpenAI API calls
- ~$0.0005 per cached response
- At 100K users: potential $50/month savings

---

## Testing Graceful Degradation

### Simulate OpenAI Failure

```bash
# In development, modify resilientOpenAI.js:
// Force failure for testing
throw new Error('Simulated OpenAI timeout');

# Then test:
curl -X POST http://localhost:3000/chat \
  -H "Authorization: Bearer test-token" \
  -d '{"message": "Hello"}'

# Expected: Cached response or fallback message
```

### Simulate Database Failure

```sql
-- In Supabase, create test user
SELECT PG_TERMINATE_BACKEND(pid)
FROM pg_stat_activity
WHERE datname = 'lyra' LIMIT 1;

# Restart immediately after test
```

### Monitor in Production

**Sentry Dashboard:**
```
Issues → Filter by 'Circuit Breaker'
```

**Metrics to monitor:**
- Circuit breaker state changes
- Retry counts per request
- Cache hit rate
- Fallback usage frequency

---

## Cost Impact

### OpenAI API Costs (100K users, 10 messages/user/day)

| Scenario | API Calls | Cost/Month |
|----------|-----------|-----------|
| No caching | 1M calls | $800 |
| With caching (50% hit) | 500K calls | $400 |
| Savings | - | **-$400** |

### Database Optimization

| Scenario | Cost |
|----------|------|
| Full reads (no caching) | 1000s connections |
| With connection pool | 20 connections |
| Savings | **-95%** |

---

## User Experience

### When Services Fail

1. **Instant Response:** Circuit breaker rejects request immediately (no 30s timeout)
2. **Cached Content:** Recent conversations still available
3. **Clear Messaging:** "Service is temporarily down, your message is saved"
4. **Automatic Retry:** No user action needed

### Example: OpenAI Timeout

**User sends message:**
```
"What should I do about anxiety?"
```

**Timeline:**
- t=0ms: Request enters API
- t=100ms: OpenAI request sent
- t=15s: OpenAI timeout
- t=15.1s: Cache checked
- t=15.2s: Cache hit (response from 1 hour ago)
- t=15.3s: User sees cached response: "This is from earlier, but here's what we discussed about anxiety..."
- t=0s (after 30s): Circuit breaker HALF_OPEN, new requests tested
- t=5s (if success): Circuit breaker CLOSED, normal operation resumed

---

## Monitoring Checklist

### Daily

- [ ] Check Sentry for error patterns
- [ ] Monitor OpenAI API status page
- [ ] Review circuit breaker logs

### Weekly

- [ ] Cache hit rate (target: >50%)
- [ ] Retry counts (target: <2 avg)
- [ ] Fallback usage (target: <1% requests)

### Monthly

- [ ] Cost analysis vs baseline
- [ ] Circuit breaker effectiveness
- [ ] Update fallback messages based on usage

---

## Troubleshooting

### High Fallback Usage

**Symptom:** Users seeing "Service temporarily unavailable" frequently

**Diagnosis:**
```sql
-- Check OpenAI API error rate
SELECT COUNT(*) as errors FROM audit_logs
WHERE service = 'openai' AND level = 'error'
AND created_at > NOW() - INTERVAL '1 hour';
```

**Fix:**
1. Check OpenAI status page
2. Increase circuit breaker timeout (default 30s)
3. Add more API keys / upgrade tier

### Low Cache Hit Rate

**Symptom:** Cache hit rate < 30%

**Diagnosis:**
- User messages too varied (each is unique)
- TTL too short (cache expires)
- Cache keys not matching similar queries

**Fix:**
- Increase TTL (24h instead of 1h)
- Implement semantic similarity for cache keys
- Use Redis fuzzy matching

### Circuit Breaker Stuck in OPEN

**Symptom:** All requests failing even after service recovered

**Diagnosis:**
- Service recovered but circuit still OPEN
- HALF_OPEN test requests also failing

**Fix:**
```javascript
// Manual recovery
circuitBreakers.openai.close();
```

---

## Future Improvements

1. **Prediction-based fallback:** ML model predicts user's likely response need
2. **Offline mode:** Queue messages for sync when online
3. **Partial responses:** Return partial AI response while waiting for completion
4. **Service degradation levels:** 3-tier fallback (full → cached → minimal)

---

## References

- Circuit Breaker Pattern: https://martinfowler.com/bliki/CircuitBreaker.html
- OpenAI Rate Limiting: https://platform.openai.com/docs/guides/rate-limits
- Redis Caching Best Practices: https://redis.io/docs/manual/client-side-caching/
