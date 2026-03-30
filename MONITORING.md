# Production Monitoring & Observability (100K+ Users)

## Monitoring Stack

```
Vercel Dashboard
    ↓
Sentry (Errors)
    ↓
Prometheus (Metrics)
    ↓
Grafana (Dashboards)
    ↓
Alert Rules → Slack/Email
```

---

## 1. Vercel Dashboard

**What to Monitor:**
- Deployment status
- Function duration
- Cold starts
- Region performance

**Access:** https://vercel.com → Lyra project → Overview

**Key Metrics:**
```
- Function duration (p50, p95, p99)
- Cold starts count
- Edge function cache hit rate
- Execution time by region
```

---

## 2. Sentry (Error Tracking)

### Setup

```bash
# Create account at sentry.io
# Create Node.js project
# Copy DSN

# Add to .env.production
SENTRY_DSN=https://[key]@[org].sentry.io/[project]
```

### Dashboard Alerts

**Critical Errors (Alert immediately):**
- Database connection failures
- Authentication system errors
- Payment processing errors
- 5xx API responses

**Warning Errors (Check daily):**
- 4xx client errors (spam/malformed requests)
- OpenAI API timeouts
- Redis connection issues

### Useful Queries

```
# High error rate
status:error level:error age:-1h

# By endpoint
url:/api/chat/ status:error

# By user
user.email:@important-company.com level:error

# By environment
environment:production level:error count:>100
```

---

## 3. Prometheus Metrics

### Metrics to Collect

**Application:**
```
# Request metrics
http_requests_total{endpoint,method,status}
http_request_duration_seconds{endpoint,quantile}
http_requests_in_progress

# Database
db_query_duration_seconds{query,quantile}
db_connection_pool_size
db_active_connections

# Cache
cache_hits_total
cache_misses_total
cache_evictions_total

# OpenAI
openai_requests_total{status,model}
openai_token_usage_total
openai_cost_usd_total
```

### Prometheus Configuration

```yaml
# prometheus.yml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'lyra-backend'
    static_configs:
      - targets: ['localhost:9090']
    metrics_path: '/metrics'
```

### Expose Metrics Endpoint

```javascript
// api/index.js
import express from 'express';

app.get('/metrics', async (req, res) => {
    res.set('Content-Type', 'text/plain');
    res.send(getMetricsOutput());
});

function getMetricsOutput() {
    const metrics = [];

    // Request count
    metrics.push(`# HELP http_requests_total Total HTTP requests`);
    metrics.push(`# TYPE http_requests_total counter`);
    metrics.push(`http_requests_total{endpoint="/chat",method="POST",status="200"} ${requestCount}`);

    // Database connections
    metrics.push(`# HELP db_active_connections Active database connections`);
    metrics.push(`# TYPE db_active_connections gauge`);
    metrics.push(`db_active_connections ${dbPool.idleCount}`);

    return metrics.join('\n');
}
```

---

## 4. Grafana Dashboards

### Create Dashboard

1. Login to Grafana (http://localhost:3000)
2. Create → Dashboard
3. Add panels:

### Panel 1: Request Rate

```
SELECT rate(http_requests_total[5m]) FROM prometheus
```

**Target:** > 100 req/s (100K users / 1000 = 100)

### Panel 2: Error Rate

```
SELECT rate(http_requests_total{status=~"5.."}[5m])
```

**Target:** < 0.5%

### Panel 3: API Response Time (p95)

```
SELECT histogram_quantile(0.95, http_request_duration_seconds)
```

**Target:** < 500ms

### Panel 4: Database Connection Pool

```
SELECT db_active_connections
```

**Target:** < 18/20 (90% utilization)

### Panel 5: Cache Hit Rate

```
SELECT rate(cache_hits_total[5m]) / (rate(cache_hits_total[5m]) + rate(cache_misses_total[5m]))
```

**Target:** > 50%

### Panel 6: OpenAI Cost

```
SELECT increase(openai_cost_usd_total[1d])
```

**Target:** Track daily spend

---

## 5. Alerting Rules

### Critical Alerts (Page on-call)

```yaml
alert: HighErrorRate
expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
for: 5m
actions:
  - slack: "@on-call"
  - pagerduty: trigger

alert: DatabaseDown
expr: db_active_connections == 0
for: 1m
actions:
  - slack: "@on-call"
  - pagerduty: trigger

alert: OutOfMemory
expr: process_resident_memory_bytes > 2.8e9
for: 5m
actions:
  - slack: "@on-call"
```

### Warning Alerts (Check next business day)

```yaml
alert: SlowAPI
expr: histogram_quantile(0.95, http_request_duration_seconds) > 1
for: 15m
actions:
  - slack: "#incidents"
  - email: "team@company.com"

alert: HighOpenAICost
expr: increase(openai_cost_usd_total[1h]) > 10
for: 30m
actions:
  - slack: "#monitoring"
```

---

## 6. Monitoring Checklist

### Hourly
- [ ] Error rate (Sentry)
- [ ] Database connection pool
- [ ] Response times (p95)

### Daily
- [ ] OpenAI API cost
- [ ] Cache hit rate
- [ ] Request throughput
- [ ] Cold starts

### Weekly
- [ ] Overall uptime %
- [ ] Error trends
- [ ] Performance trends
- [ ] Cost analysis

### Monthly
- [ ] Capacity planning (growing?)
- [ ] Security audit
- [ ] Optimization opportunities
- [ ] Alerts effectiveness (false positives?)

---

## 7. Debugging with Logs

### Log Levels

```
ERROR: System failures, unhandled exceptions
WARN: Recoverable issues, degraded service
INFO: Important business events
DEBUG: Detailed technical info (dev only)
```

### Useful Log Queries

**Find slow requests:**
```
[INFO] Slow request detected duration:>5000
```

**Find OpenAI failures:**
```
[OpenAI] error:*
```

**Find circuit breaker opens:**
```
[CircuitBreaker] state:OPEN
```

**Find user errors:**
```
userId:"user-123" level:ERROR
```

---

## 8. Distributed Tracing

### Add Request Tracing

```javascript
import { v4 as uuid } from 'uuid';

app.use((req, res, next) => {
    const traceId = req.headers['x-trace-id'] || uuid();
    req.traceId = traceId;

    res.setHeader('X-Trace-ID', traceId);

    // Log with trace ID
    logger.info('Request received', { traceId, path: req.path });

    next();
});
```

### Trace a Request Through System

1. Get X-Trace-ID from response header
2. Search logs: `traceId:"[id]"`
3. See entire request lifecycle
4. Identify bottlenecks

---

## 9. Cost Monitoring

### Track OpenAI Costs

```javascript
// Track in Prometheus
openai_cost_usd_total += cost
```

### Monthly Budget Alerts

```
- Target: $500/month
- Warning: > $400/month (80%)
- Critical: > $475/month (95%)
```

### Cost Optimization

```
# If > $500/month:
1. Increase cache TTL
2. Batch similar requests
3. Reduce token usage
4. Switch to cheaper model (gpt-3.5)
5. Implement request deduplication
```

---

## 10. Performance Profiling

### Identify Slow Operations

```bash
# Node.js profiling
node --prof server.js

# Generate report
node --prof-process isolate-*.log > profile.txt
```

### Find Memory Leaks

```bash
# Heap snapshot
npm install -g clinic
clinic doctor -- node server.js

# Or via Chrome DevTools
node --inspect server.js
# Open chrome://inspect
```

---

## Alert Configuration Examples

### Slack Integration

```javascript
// Send to Slack
const slack = require('slack-sdk');

async function alertSlack(message, severity = 'warning') {
    const color = severity === 'critical' ? 'danger' : 'warning';

    await slack.webhook.send({
        text: `${severity.toUpperCase()}: ${message}`,
        color: color,
        channel: '#incidents',
        icon_emoji: ':warning:'
    });
}
```

### Email Alerts

```javascript
// Send critical alerts to on-call
const nodemailer = require('nodemailer');

async function alertEmail(subject, body) {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });

    await transporter.sendMail({
        from: 'alerts@lyra.app',
        to: process.env.ONCALL_EMAIL,
        subject: subject,
        html: body
    });
}
```

---

## Tools Summary

| Tool | Purpose | Cost |
|------|---------|------|
| Vercel Dashboard | Deployment metrics | Free |
| Sentry | Error tracking | $29/month |
| Prometheus | Metrics collection | Free (self-hosted) |
| Grafana | Dashboards | Free (self-hosted) |
| Datadog | All-in-one (optional) | $15-30/day |

---

## Production Readiness Monitoring

**Before shipping to 100K users:**

- [ ] Sentry DSN configured
- [ ] Prometheus metrics endpoint working
- [ ] Grafana dashboards created
- [ ] Alert rules configured
- [ ] On-call rotation setup
- [ ] Slack/email integration tested
- [ ] Runbooks written
- [ ] Team trained on tools

---

## References

- Sentry Docs: https://docs.sentry.io/
- Prometheus: https://prometheus.io/
- Grafana: https://grafana.com/
- Node.js Profiling: https://nodejs.org/en/docs/guides/simple-profiling/
