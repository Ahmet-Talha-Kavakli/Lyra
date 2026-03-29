# Load Testing Guide - 100K Concurrent Users

Comprehensive load testing strategy for Lyra AI Therapist production deployment.

## Quick Start

### Local Testing (Single Machine)
```bash
# Test at 100 req/s for 60 seconds
node load-test.js

# Custom configuration
RATE=500 DURATION=120 CONCURRENT=100 node load-test.js

# Against production
TARGET=https://lyra.example.com RATE=1000 DURATION=180 node load-test.js
```

### Docker Compose Test Stack
```bash
# Start app + load test
docker-compose up -d
docker exec lyra-app node load-test.js

# View real-time metrics
curl http://localhost:3000/health | jq
curl http://localhost:9090/api/v1/query?query=http_request_duration_seconds
```

## Load Test Scenarios

### Scenario 1: Baseline (100 req/s)
```bash
node load-test.js
# Purpose: Verify basic functionality
# Expected: <500ms avg latency, <1% error rate
# Ramp: 30s steady state
```

### Scenario 2: Peak Hour (1K req/s)
```bash
RATE=1000 DURATION=180 CONCURRENT=100 node load-test.js
# Purpose: Peak traffic load (10x baseline)
# Expected: <1000ms avg latency, <5% error rate
# Ramp: 3 minutes sustained
```

### Scenario 3: Stress Test (5K req/s)
```bash
RATE=5000 DURATION=60 CONCURRENT=500 node load-test.js
# Purpose: Find breaking point
# Expected: Identify when system becomes degraded
# Ramp: 1 minute to find limits
```

### Scenario 4: Endurance (sustained 10h)
```bash
RATE=500 DURATION=36000 CONCURRENT=50 node load-test.js
# Purpose: Detect memory leaks, connection pool exhaustion
# Expected: Stable metrics over 10 hours
# Monitoring: Memory growth, GC pauses, connection count
```

### Scenario 5: Spike Test (100K users over 5 minutes)
```bash
# Simulate sudden traffic spike
RATE=100 DURATION=0 && \
RATE=500 DURATION=60 && \
RATE=2000 DURATION=120 && \
RATE=10000 DURATION=180
# Purpose: Verify HPA responsiveness, queue handling
# Expected: Graceful degradation, recovery after spike
```

## Metrics Explanation

### Throughput (req/s)
- **Goal**: Match or exceed target rate (100 req/s baseline)
- **100K users**: Need 10K req/s = 10 pods with 1000 req/s per pod
- **Scaling**: Linear — double pods → double throughput

### Latency (ms)
- **P50 (Median)**: 50% of requests faster than this
  - Target: <200ms
  - Acceptable: <500ms
  - Poor: >1000ms

- **P95**: 95% of requests faster than this
  - Target: <500ms
  - Acceptable: <1000ms
  - Poor: >2000ms

- **P99**: 99% of requests faster than this
  - Target: <1000ms
  - Acceptable: <2000ms
  - Poor: >5000ms

### Error Rate
- **Target**: <1% errors
- **Acceptable**: 1-5%
- **Poor**: >5%
- **Investigate**: Any 5xx errors

### Resource Usage
- **CPU**: <70% (HPA threshold)
- **Memory**: <80% (HPA threshold)
- **Connections**: <max pool size
- **Redis**: <512Mi memory usage

## Kubernetes Load Testing

### In-Cluster Testing
```bash
# Deploy test pod
kubectl run load-test \
  --image=node:20-alpine \
  --command -- node /load-test.js \
  -n lyra

# Monitor pods
kubectl top pods -n lyra
kubectl get hpa -n lyra -w

# Watch HPA scaling
kubectl describe hpa lyra-app-hpa -n lyra
```

### Test Different Scales
```bash
# Test at 1K req/s (1 pod baseline)
kubectl port-forward svc/lyra-service 3000:80 -n lyra
RATE=1000 node load-test.js

# Test at 10K req/s (10 pods needed)
RATE=10000 DURATION=300 node load-test.js

# Check scaling history
kubectl describe deployment lyra-app -n lyra | grep -A 50 Conditions
```

## Analyzing Results

### Good Results
```
✅ Throughput:   2000 req/s ✅ PASS
✅ Avg Latency:  250ms ✅ PASS
✅ Error Rate:   0.2% ✅ PASS
✅ P99 Latency:  800ms ✅ PASS
```

### Performance Issues
```
❌ Throughput:   500 req/s ❌ FAIL
   → Bottleneck in app code, check CPU usage

⚠️  Avg Latency:  1500ms ⚠️  WARN
   → Database queries slow, check connection pool

❌ Error Rate:   8% ❌ FAIL
   → High error rate: check logs, Redis status
```

### Scaling Estimates
From load test results, calculate pods needed:
```
Required Throughput: 100K users × 0.1 req/user/min ÷ 60s = 167 req/s
Test Throughput: 2000 req/s per instance
Pods Needed: 167 ÷ 2000 = 0.08 → 1 pod (+ reserve 2)
Recommended: 3 pods (baseline) → 10 (max HPA)
```

## Continuous Load Testing

### Daily Load Test (CI/CD)
```yaml
name: Daily Load Test
on:
  schedule:
    - cron: '0 2 * * *'  # 2 AM daily

jobs:
  load-test:
    runs-on: ubuntu-latest
    services:
      lyra:
        image: lyra-therapist:latest
    steps:
      - run: npm install artillery
      - run: artillery run load-test-config.yml
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: results.json
```

### Alerting on Load Test Failures
```bash
# Set up Slack webhook in CI/CD
if [ $ERROR_RATE -gt 5 ]; then
    curl -X POST $SLACK_WEBHOOK \
    -d "Load test FAILED: Error rate $ERROR_RATE%"
fi
```

## Production Monitoring During Load Tests

### Watch Metrics in Real-Time
```bash
# Terminal 1: Monitor pods
kubectl top pods -n lyra --watch

# Terminal 2: Watch HPA
kubectl get hpa -n lyra --watch

# Terminal 3: View logs
kubectl logs -f deployment/lyra-app -n lyra | grep -E "ERROR|WARN|latency"

# Terminal 4: Check Redis
kubectl exec -it redis-0 -n lyra -- redis-cli INFO memory
```

### Grafana Dashboard
1. Open http://localhost:3001
2. Import dashboard: `Kubernetes Cluster Monitoring`
3. Filter by namespace: lyra
4. Watch:
   - HTTP Request Duration (P50, P95, P99)
   - Error Rate by Status Code
   - CPU/Memory Usage
   - Network I/O

## Performance Baseline

Expected metrics for healthy system:

| Metric | 100 req/s | 1K req/s | 10K req/s |
|--------|-----------|----------|-----------|
| P50 Latency | <100ms | <300ms | <500ms |
| P95 Latency | <300ms | <800ms | <1500ms |
| P99 Latency | <500ms | <1500ms | <3000ms |
| Error Rate | <0.5% | <1% | <2% |
| CPU/Pod | 10% | 40% | 70% |
| Memory/Pod | 100Mi | 400Mi | 800Mi |
| Pods Active | 1 | 2 | 10 |

## Troubleshooting Load Test Issues

### Timeout Errors
```
Problem: Many "timeout" errors in results
Causes:
  1. Server overloaded (CPU/memory maxed)
  2. Network congestion
  3. Database connection pool exhausted

Solutions:
  - Reduce load test rate
  - Increase pod replicas manually
  - Check database connection pool settings
  - Check network latency: ping target
```

### High Error Rate
```
Problem: >5% of requests returning 5xx
Causes:
  1. Out of memory (OOM)
  2. Database connection failure
  3. Redis unavailable
  4. LLM API rate limit hit

Solutions:
  - Check pod logs: kubectl logs <pod-name>
  - Check metrics: kubectl describe node
  - Verify Redis is running: kubectl get pods redis-*
  - Check OpenAI API status
```

### Memory Leak Detection
```
Problem: Memory grows during 10-hour endurance test
Causes:
  1. Connection pool not releasing
  2. Cache growing unbounded
  3. Job queue backlog

Solutions:
  - Check memory growth rate: (mem_end - mem_start) / duration_hours
  - If >10Mi/hour, investigate leak
  - Add explicit cleanup in background jobs
  - Monitor: kubectl top pods --watch
```

## Advanced Load Testing Tools

### Artillery.io (Recommended for CI/CD)
```bash
npm install -g artillery

# Create config
artillery quick --count 1000 --num 10 http://localhost:3000/health

# Run test
artillery run load-test-config.yml
artillery report results.json
```

### k6 (Performance testing language)
```javascript
// load-test-k6.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
    stages: [
        { duration: '2m', target: 100 },
        { duration: '5m', target: 1000 },
        { duration: '2m', target: 0 },
    ],
};

export default function () {
    let response = http.post('http://localhost:3000/v1/api/chat/completions', {
        messages: [{ role: 'user', content: 'Test' }],
    });
    check(response, { 'status is 200': r => r.status === 200 });
    sleep(1);
}
```

Run: `k6 run load-test-k6.js`

## Checklist for 100K User Deployment

- [ ] Baseline load test passed (100 req/s, <1% error)
- [ ] Peak hour test passed (1K req/s, <5% error)
- [ ] Stress test completed (found breaking point)
- [ ] Endurance test (10h, stable memory)
- [ ] HPA scaling verified (pods scale up/down correctly)
- [ ] Redis performance under load (no key evictions)
- [ ] Database connection pool verified
- [ ] Error logging captures all failures
- [ ] Grafana dashboards monitoring all metrics
- [ ] Alerts configured for anomalies
- [ ] Runbook created for common issues
- [ ] Performance baseline documented

## Next Steps

1. **Run baseline test**: `node load-test.js`
2. **Analyze results**: Compare against baselines
3. **Fix bottlenecks**: If latency >500ms or errors >1%
4. **Scale up**: Test at 10K req/s with full K8s cluster
5. **Monitor production**: Continuous load testing in CI/CD
