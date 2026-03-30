# Operational Runbooks (100K+ Users)

Emergency procedures for production incidents.

---

## 🚨 INCIDENT: High Error Rate (>5%)

**Symptoms:** Sentry alerts, users complaining, error rate spike

### Investigation (5 min)

```bash
# 1. Check error patterns
# → Sentry dashboard → Filter by last hour

# 2. Check affected endpoint
curl https://api.your-domain.com/health
# → Look for "error rate" in response

# 3. Check database status
# → Vercel dashboard → Check database metrics
# → Supabase dashboard → Check connection pool

# 4. Check OpenAI status
# → OpenAI status page: status.openai.com
```

### Quick Mitigation (2 min)

```bash
# Option 1: Rollback deployment
vercel rollback

# Option 2: Disable problematic endpoint (if isolated)
# Update api/index.js, comment out route
git push && vercel --prod
```

### Resolution Steps

**If database issue:**
```bash
# 1. Check connection pool exhaustion
SELECT count(*) FROM pg_stat_activity;

# 2. Increase pool size (in .env)
DB_POOL_SIZE=30

# 3. Redeploy
vercel env add DB_POOL_SIZE 30
vercel --prod
```

**If OpenAI issue:**
```bash
# 1. Check circuit breaker status
curl https://api.your-domain.com/health | jq .

# 2. If circuit OPEN for >30min, manually close
# In api/index.js:
// circuitBreakers.openai.close()

# 3. Monitor fallback usage
# → Check cache hit rate
```

**If unidentified error:**
```bash
# 1. Get trace ID from user
# 2. Search Sentry: traceId:"[id]"
# 3. Follow request through logs
# 4. Identify root cause
# 5. Apply fix + redeploy
```

### Recovery (10 min)

```bash
# Verify error rate dropped
curl https://api.your-domain.com/health | jq .checks.errorRate

# Should be < 0.5%

# Post-incident
1. Create GitHub issue: "Incident: [date] error rate spike"
2. Document root cause
3. Create follow-up PR to prevent
```

---

## 🗄️ INCIDENT: Database Connection Pool Exhausted

**Symptoms:** "too many connections" errors, users can't send messages

### Emergency Response (1 min)

```bash
# IMMEDIATE: Kill idle connections
psql -h db.supabase.co -U postgres -d lyra << EOF
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE state = 'idle'
AND query_start < NOW() - INTERVAL '5 minutes';
EOF
```

### Investigation (5 min)

```sql
-- What's using connections?
SELECT usename, count(*) as connections
FROM pg_stat_activity
GROUP BY usename;

-- Which queries are slow?
SELECT pid, usename, query, query_start
FROM pg_stat_activity
WHERE state != 'idle'
ORDER BY query_start;
```

### Fix (15 min)

**Option 1: Increase pool size**
```bash
vercel env add DB_POOL_SIZE 40
# Wait for redeployment
vercel --prod
```

**Option 2: Reduce connection timeout**
```bash
# In .env
DB_IDLE_TIMEOUT=15000  # 15s instead of 30s
vercel env add DB_IDLE_TIMEOUT 15000
vercel --prod
```

**Option 3: Kill long-running query**
```sql
SELECT pg_terminate_backend(pid)
FROM pg_stat_activity
WHERE pid = [pid from above];
```

---

## 💰 INCIDENT: OpenAI API Rate Limited

**Symptoms:** "429 Too Many Requests" from OpenAI, users get cached responses

### Investigation (2 min)

```bash
# Check OpenAI cost
curl https://api.your-domain.com/health | jq .cost_usd_total

# Check request rate
# → Vercel dashboard → Function metrics → Requests/sec
```

### Response (5 min)

**Short-term:**
- Increase cache TTL (24h instead of 1h)
- Batch similar requests
- Reduce max_tokens in prompts

**Long-term:**
- Upgrade OpenAI tier
- Implement request deduplication
- Switch to cheaper model (gpt-3.5-turbo)

```bash
# Immediate: Update cache TTL
# In lib/infrastructure/responseCache.js
const ttl = 86400; // 24 hours instead of 3600

git add . && git commit -m "fix: increase cache TTL"
vercel --prod
```

---

## 🔓 INCIDENT: Security Breach (Token Leaked)

**Symptoms:** Invalid token used in unauthorized requests

### IMMEDIATE (30 sec)

```bash
# 1. Rotate JWT_SECRET
openssl rand -hex 32
# → Copy output

# 2. Update immediately
vercel env add JWT_SECRET "$(openssl rand -hex 32)"

# 3. Redeploy (all existing tokens become invalid)
vercel --prod
```

### Investigation (5 min)

```bash
# Check when leaked
# → Sentry → Filter by leaked token JWT
# → Look at first use timestamp

# Notify affected users
# → Database query: users with activity after [leak time]
```

### Recovery

```bash
# 1. Force password reset for affected users
UPDATE users SET force_password_reset = true WHERE last_activity > '[leak time]';

# 2. Clear any compromised sessions
DELETE FROM auth_tokens WHERE created_at > '[leak time]';

# 3. Notify security@ and team
# 4. Write incident report
```

---

## 📊 INCIDENT: Disk Space Critical (>90%)

**Symptoms:** Errors about disk space, database write failures

### Emergency Response (1 min)

```bash
# Check space usage
df -h

# Check database size
SELECT pg_size_pretty(pg_database.datsize)
FROM pg_database;
```

### Cleanup (5 min)

```sql
-- Archive old sessions (older than 30 days)
INSERT INTO therapy_sessions_archive
SELECT * FROM therapy_sessions
WHERE ended_at < NOW() - INTERVAL '30 days';

DELETE FROM therapy_sessions
WHERE ended_at < NOW() - INTERVAL '30 days';

-- Vacuum
VACUUM ANALYZE;
```

### Long-term Fix

- Enable automatic partitioning (>500K users)
- Archive old data to S3 monthly
- Delete old audit logs (>90 days)

---

## 🔴 INCIDENT: Redis Completely Down

**Symptoms:** Rate limiting doesn't work, cache misses, slow performance

### Investigation

```bash
# Check Redis status
redis-cli PING
# Expected: PONG

# If down:
# 1. Check Upstash/Redis Cloud dashboard
# 2. Check error logs
# 3. Check if it's a network issue
```

### Fallback Mode (Automatic)

- Rate limiting → in-memory (less protected)
- Cache → disabled (API calls every time)
- Performance → degraded (no caching)

**Users won't notice if Redis is down for < 5 min**

### Recovery

```bash
# If Redis restarts automatically
# 1. Wait 2-3 min for reconnection
# 2. Verify cache is working
curl https://api.your-domain.com/health | jq .checks.cache

# If manual restart needed
# → Upstash dashboard → Click "Restart Database"
```

---

## 📈 INCIDENT: Unexpected Traffic Spike (DDoS/Viral)

**Symptoms:** 10x normal traffic, slow responses, errors

### Assessment (2 min)

```bash
# Check traffic source
# → Vercel dashboard → Analytics
# → Look for patterns (single IP? bad region? specific endpoint?)

# Check if legitimate
# → Social media mentions?
# → News article?
# → Competitor attack?
```

### Response (5 min)

**If legitimate (viral/feature launch):**
- Let it serve (infrastructure can scale)
- Monitor error rate + latency
- Be ready to rollback if issues

**If DDoS:**
```bash
# 1. Enable Vercel DDoS protection
# → Vercel dashboard → Project → Security

# 2. Block suspicious IPs
# → Add WAF rules to block patterns

# 3. Rate limit aggressively
# Set temporary lower limits
DB_RATE_LIMIT_CHAT=5  # Per user per minute
vercel env add DB_RATE_LIMIT_CHAT 5
vercel --prod
```

---

## ✅ Post-Incident Checklist

After **any** incident:

1. **Within 1 hour:**
   - [ ] Alert team + stakeholders
   - [ ] Start incident log in GitHub
   - [ ] Assess impact (how many users? how long?)

2. **Within 24 hours:**
   - [ ] Post-mortem meeting
   - [ ] Document root cause
   - [ ] Write action items

3. **Within 1 week:**
   - [ ] Implement preventive measures
   - [ ] Add monitoring/alerts
   - [ ] Update runbooks

4. **Within 2 weeks:**
   - [ ] Deploy fixes
   - [ ] Verify monitoring catches it next time

---

## On-Call Guide

### Responsibilities

- **Response time:** Answer alert within 5 min
- **Investigation:** Diagnosis within 10 min
- **Triage:** Critical vs warning vs info
- **Escalation:** Wake team if critical
- **Communication:** Update status channel

### Tools Needed

- Vercel account (access to dashboards)
- Sentry access (error tracking)
- Supabase access (database)
- Slack + email notifications

### Escalation Matrix

| Situation | Action |
|-----------|--------|
| Error rate > 10% | Page on-call immediately |
| Database down | Page on-call + CTO immediately |
| API completely down | Page on-call + CTO + CEO |
| Security breach | Page CTO + Head of Eng |
| Data loss detected | Page CTO + CEO + Legal |

---

## Weekly On-Call Responsibilities

```
Monday 9am: Assume on-call
Friday 5pm: Hand off to next person

Daily checks:
- [ ] Error rate (should be < 0.5%)
- [ ] API latency (should be < 500ms)
- [ ] Database connections (should be < 18/20)
- [ ] Cache hit rate (should be > 50%)
```

---

## Emergency Contacts

```
CTO: [phone] [email]
Head of Eng: [phone] [email]
CEO: [phone] [email]
DevOps Lead: [phone] [email]
```

**Keep updated + tested monthly!**

---

**Last Updated:** 2026-03-30
**Next Review:** 2026-04-30
