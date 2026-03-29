# Lyra Deployment Checklist — 100K User Scale

## Pre-Deployment (Before Production)

### Environment Setup
- [ ] JWT_SECRET set (64-char hexadecimal)
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] OPENAI_API_KEY configured
- [ ] SUPABASE_URL set
- [ ] SUPABASE_SERVICE_KEY set
- [ ] NODE_ENV=production
- [ ] LOG_LEVEL=info (production)

### Database
- [ ] Supabase project created
- [ ] Tables created (psychological_profiles, memories, sessions)
- [ ] Indexes on frequently queried columns
  ```sql
  -- Recommended indexes
  CREATE INDEX idx_user_id ON memories(user_id);
  CREATE INDEX idx_user_profile_user_id ON psychological_profiles(user_id);
  CREATE INDEX idx_session_user_id ON sessions(user_id);
  CREATE INDEX idx_audit_timestamp ON audit_logs(timestamp DESC);
  ```
- [ ] Backups configured (daily)
- [ ] Read replicas deployed (for 10K+ users)
- [ ] PgBouncer configured (for 10K+ users)

### Security
- [ ] SSL/TLS certificate installed
- [ ] CORS origins whitelisted (no wildcard)
- [ ] Rate limiting rules reviewed
- [ ] Audit logging directory writable
- [ ] Secrets stored in secure vault (not .env file)

### Infrastructure
- [ ] Load balancer configured (round-robin or least-connections)
- [ ] Redis cluster deployed (for caching)
- [ ] Monitoring agent installed (Datadog/New Relic)
- [ ] Log aggregation setup (Splunk/ELK)
- [ ] CDN configured (CloudFlare for static assets)

### Testing
- [ ] Unit tests passing (`npm test`)
- [ ] Load test passing (`node tests/loadTest.js`)
- [ ] Health check working (`GET /health`)
- [ ] API docs accessible (`GET /api/docs`)

---

## Deployment Execution

### Docker Build & Push
```bash
# Build image
docker build -t lyra:1.0.0 .

# Tag for registry
docker tag lyra:1.0.0 gcr.io/project-id/lyra:1.0.0

# Push to registry
docker push gcr.io/project-id/lyra:1.0.0
```

### Initial Deployment (Staging)
```bash
# Deploy single instance
docker run -d \
  --name lyra-staging \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e JWT_SECRET=$JWT_SECRET \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -e SUPABASE_URL=$SUPABASE_URL \
  -e SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY \
  --memory 512m \
  --cpus 1 \
  gcr.io/project-id/lyra:1.0.0

# Verify health
sleep 5
curl http://localhost:3000/health
```

### Production Rollout (Gradual)
- [ ] Deploy 10% of instances (canary)
- [ ] Monitor for 1 hour (error rate, latency, memory)
- [ ] Deploy 50% of instances (ramp-up)
- [ ] Monitor for 1 hour
- [ ] Deploy 100% (full rollout)
- [ ] Keep old version running (rollback ready) for 24 hours

---

## Post-Deployment Verification

### Endpoint Tests
```bash
# Health check
curl https://api.lyra.ai/health | jq '.status'
# Expected: "healthy"

# Authentication
curl -X POST https://api.lyra.ai/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Password123!"}'
# Expected: 200 with token

# Rate limiting (should block)
for i in {1..10}; do
  curl -X POST https://api.lyra.ai/v1/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done
# Expected: 5th+ request returns 429

# API documentation
curl https://api.lyra.ai/api/docs.json | jq '.info.version'
# Expected: "1.0.0"
```

### Monitoring Checks
- [ ] Error rate < 0.1%
- [ ] P99 latency < 500ms (excluding OpenAI)
- [ ] Memory usage stable (no growth > 50MB/hour)
- [ ] Database query time < 100ms (p95)
- [ ] Cache hit rate > 60%
- [ ] All instances healthy (health check 200)

### Security Verification
```bash
# Check security headers
curl -I https://api.lyra.ai | grep -i "x-frame-options"
# Expected: X-Frame-Options: SAMEORIGIN

curl -I https://api.lyra.ai | grep -i "strict-transport"
# Expected: Strict-Transport-Security: max-age=31536000

# Check audit logging
tail -f logs/audit.jsonl | head -5
# Expected: JSONL format with timestamp, eventType, userId
```

### Load Testing
```bash
# Run load test against production
CONCURRENT=100 REQUESTS=50 \
  API_URL=https://api.lyra.ai \
  node tests/loadTest.js

# Expected:
# - Throughput: 500+ req/sec
# - P99 latency: <500ms
# - Error rate: <1%
# - Memory delta: <100MB
```

---

## Ongoing Monitoring (Daily)

### Dashboards to Create
- [ ] **Error Rate** — Real-time error percentage
- [ ] **Latency** — P50, P95, P99 response times
- [ ] **Memory** — Heap usage per instance
- [ ] **Database** — Query count, slow queries
- [ ] **Cache** — Hit rate, miss rate
- [ ] **Rate Limits** — Triggered per hour
- [ ] **Audit Logs** — Failed login attempts, admin actions
- [ ] **Endpoints** — Requests/sec per endpoint

### Alerts to Configure
- [ ] Error rate > 1% → Page on-call
- [ ] P99 latency > 2 seconds → Page on-call
- [ ] Memory > 85% → Page on-call
- [ ] Database unavailable → Page on-call (critical)
- [ ] Failed login attempts spike → Alert
- [ ] DDoS detected (>1000 req/min from IP) → Alert

### Daily Checklist
```bash
# 9 AM: Check overnight errors
curl https://api.lyra.ai/health | jq '.checks | keys'

# 12 PM: Verify cache hit rate
curl https://api.lyra.ai/health | jq '.checks.cache.hitRate'
# Expected: >60%

# 3 PM: Check slow queries
grep "latencyMs.*: [0-9]{3,}" logs/audit.jsonl | tail -10

# 6 PM: Monitor memory trend
curl https://api.lyra.ai/health | jq '.checks.memory.percentUsed'
# Expected: <85%

# 8 PM: Review failed logins
grep "auth.failed_login" logs/audit.jsonl | wc -l
# Track unusual spikes
```

---

## Incident Response

### Service Degradation (Slow Responses)
1. Check memory usage: `curl /health | jq '.checks.memory'`
2. Check database: `curl /health | jq '.checks.database'`
3. Check cache hit rate: `curl /health | jq '.checks.cache.hitRate'`
4. Check slow queries: `grep "latencyMs" logs/audit.jsonl | tail -100`
5. **Action**: Restart instances if memory > 90%

### High Error Rate
1. Check error logs: `curl /health | jq '.checks'`
2. Check rate limiting: `grep "rate_limit_triggered" logs/audit.jsonl | tail -50`
3. Check database connection pool: `grep "Connection" logs/audit.jsonl`
4. **Action**: Increase rate limit thresholds if legitimate traffic

### Security Incident (Possible Breach)
1. Check failed login attempts: `grep "auth.failed_login" logs/audit.jsonl | wc -l`
2. Check suspicious activity: `grep "suspicious_activity" logs/audit.jsonl`
3. Check DDoS detection: `grep "DDoS" logs/audit.jsonl`
4. **Action**:
   - Rotate JWT_SECRET immediately
   - Notify users to change passwords
   - Enable MFA for admin accounts
   - Archive audit logs to S3

### Database Failure
1. Check replica status: Connect to Supabase console
2. Check connection pool: `grep "Pool" logs/audit.jsonl`
3. **Action**:
   - Failover to read replica (if using)
   - Scale up PgBouncer instances
   - Temporarily disable audit logging to reduce load

---

## Scaling Operations

### When to Scale Up (Add More Instances)
```
CPU utilization > 70% → Add 10% more instances
Memory > 70% → Review for leaks, then add instances
Request latency P99 > 1s → Add instances
Error rate > 0.1% → Check DB, then add instances
```

### Horizontal Scaling Procedure
1. Build new Docker image with latest code
2. Push to registry: `docker push gcr.io/.../lyra:1.0.1`
3. Deploy canary: 1-2 new instances
4. Monitor for 1 hour
5. Scale up by 20% total capacity
6. Monitor for 1 hour
7. Fully deploy if no errors

### Cache Scaling (Redis)
```bash
# When cache hit rate drops below 50%
1. Increase cache TTL (from 5min to 10min)
2. Add Redis cluster nodes
3. Review cache invalidation patterns
```

### Database Scaling
```bash
# When database queries exceed 5000/sec
1. Enable read replicas
2. Implement query caching
3. Add PgBouncer instances
4. Consider database sharding (by user_id)
```

---

## Rollback Procedure

### If Something Goes Wrong
1. **Stop deployment** — Don't roll out further instances
2. **Assess impact** — Check error rate, affected users
3. **Decide rollback** — If error rate > 2%, rollback
4. **Execute**:
   ```bash
   # Scale down new version
   kubectl scale deployment lyra --replicas=0

   # Scale up old version
   kubectl scale deployment lyra-old --replicas=10
   ```
5. **Verify**: Check health, error rate, latency
6. **Communicate**: Notify team, users (if affected)

### Prevention
- Always keep old version running 24 hours
- Have automated health checks per instance
- Run load tests before each deployment
- Monitor first hour closely

---

## Compliance & Auditing

### Regular Audits
- [ ] Monthly: Review audit logs for suspicious activity
- [ ] Quarterly: Security assessment (penetration testing)
- [ ] Quarterly: Performance review (load test results)
- [ ] Annually: Full security audit + compliance review

### Retention Policies
- Audit logs: 30 days (hot), 1 year (archived to S3)
- Error logs: 7 days
- Access logs: 7 days
- Database backups: 30 days

### Disaster Recovery Test
- [ ] Monthly: Restore database from backup (test environment)
- [ ] Monthly: Failover to read replica
- [ ] Quarterly: Full system recovery simulation

---

## Maintenance Window

### Scheduled Maintenance (Communicate 24 hours in advance)
```
Window: Tuesday 2-3 AM UTC
Duration: 30 minutes max

Actions:
1. Deploy updated code (if any)
2. Run database maintenance (VACUUM, ANALYZE)
3. Rotate API keys
4. Archive old audit logs
5. Run load test verification
```

### Zero-Downtime Deployments
Use blue-green deployment:
1. Deploy new version (green) alongside old (blue)
2. Route 10% traffic to green, monitor
3. Route 50% traffic to green, monitor
4. Route 100% traffic to green
5. Keep blue running 24 hours (rollback ready)
6. Decommission blue

---

## Success Criteria

✅ **100K User Readiness Achieved When:**
- [ ] Throughput: 1000+ req/sec per instance
- [ ] Latency P99: <500ms (excluding OpenAI)
- [ ] Error rate: <0.1%
- [ ] Memory: Stable, no leaks
- [ ] Cache hit rate: >60%
- [ ] Audit logs: Complete, tamper-proof
- [ ] Security: All headers present, no vulnerabilities
- [ ] Load test: All 100K user simulation metrics passing

---

## Emergency Contacts

```
On-Call: [team on-call]
Security Lead: [security lead]
Database Admin: [DBA]
DevOps: [devops lead]
Executive: [CTO]
```

---

**Last Updated:** 2026-03-30
**Version:** 1.0.0
**Production Status:** Ready for deployment
