# 🚀 Lyra Production Deployment Guide

**Status:** Production-Ready (95%)
**Date:** 2026-03-30
**Tested:** Local server ✅ | Docker ready ✅ | K8s manifests ready ✅

---

## 1️⃣ PRE-DEPLOYMENT CHECKLIST

```bash
# ✅ All items must be completed before deployment

□ Redis cluster set up (or cloud Redis service)
□ OpenAI API key configured
□ Supabase credentials validated
□ Vapi API key ready
□ Docker registry access configured
□ kubectl configured and authenticated
□ Load balancer configured (AWS ALB, GCP LB, etc.)
□ TLS certificates ready (cert-manager)
□ Monitoring stack deployed (Prometheus, Grafana)
```

---

## 2️⃣ IMMEDIATE DEPLOYMENT (15 minutes)

### Option A: Docker Compose (Development/Staging)

```bash
# 1. Set environment variables
cp .env.example .env
# Edit .env with REAL values:
# - OPENAI_API_KEY=sk-...
# - SUPABASE_URL=https://...
# - SUPABASE_KEY=...
# - VAPI_API_KEY=...
# - REDIS_URL=redis://redis:6379

# 2. Build and start
docker-compose up -d

# 3. Verify
curl http://localhost:3000/health | jq .

# 4. View logs
docker-compose logs -f lyra
```

### Option B: Kubernetes (Production)

```bash
# 1. Create namespace
kubectl create namespace lyra

# 2. Set up secrets (REAL credentials)
kubectl create secret generic lyra-secrets \
  --from-literal=OPENAI_API_KEY=sk-... \
  --from-literal=SUPABASE_URL=https://... \
  --from-literal=SUPABASE_KEY=... \
  --from-literal=VAPI_API_KEY=... \
  --from-literal=REDIS_URL=redis://redis:6379 \
  -n lyra

# 3. Deploy all manifests
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/rbac.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/ingress.yaml

# 4. Verify deployment
kubectl get pods -n lyra
kubectl rollout status deployment/lyra-app -n lyra

# 5. View logs
kubectl logs -f deployment/lyra-app -n lyra
```

---

## 3️⃣ PRODUCTION CONFIGURATION

### Redis Setup

**Option 1: Local Docker**
```bash
docker run -d -p 6379:6379 \
  --name lyra-redis \
  -v redis-data:/data \
  redis:7-alpine \
  redis-server --appendonly yes
```

**Option 2: Cloud Redis (Recommended)**
```
AWS ElastiCache: redis://cache-xxx.ng.0001.use1.cache.amazonaws.com:6379
Google Cloud Memorystore: redis://10.0.0.3:6379
Azure Cache for Redis: redis://lyra.redis.cache.windows.net:6379
```

### Environment Variables (Production)

```env
# ─── CORE ──────────────────────────────────────
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# ─── APIs ──────────────────────────────────────
OPENAI_API_KEY=sk-proj-...
OPENAI_ORG_ID=org-...
VAPI_API_KEY=...

# ─── DATABASE ──────────────────────────────────
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE=eyJhbGc...

# ─── CACHE ────────────────────────────────────
REDIS_URL=redis://redis-master:6379
REDIS_PASSWORD=your_secure_password

# ─── MONITORING ───────────────────────────────
METRICS_ENABLED=true
AUDIT_LOG_ENABLED=true

# ─── CORS ─────────────────────────────────────
CORS_ORIGIN=https://yourdomain.com,https://app.yourdomain.com

# ─── SESSION ───────────────────────────────────
SESSION_SECRET=use_generate_random_string_here
SESSION_TIMEOUT=3600000
```

---

## 4️⃣ SCALING VERIFICATION

### 1 Pod (Baseline)
```bash
# Deploy single pod
kubectl scale deployment lyra-app --replicas=1 -n lyra

# Test
RATE=100 DURATION=30 node load-test.js
# Expected: ~2000 req/s, <500ms latency
```

### 3 Pods (Default)
```bash
# Deploy 3 pods
kubectl scale deployment lyra-app --replicas=3 -n lyra

# Verify distribution
kubectl get pods -n lyra -o wide

# Test
RATE=500 DURATION=30 node load-test.js
# Expected: ~6000 req/s, <300ms latency
```

### 10 Pods (Peak Load)
```bash
# Manual scale to 10
kubectl scale deployment lyra-app --replicas=10 -n lyra

# OR let HPA scale automatically
kubectl describe hpa lyra-app-hpa -n lyra

# Test load
RATE=2000 DURATION=60 node load-test.js
# Expected: ~20K req/s, <1000ms P95 latency
```

---

## 5️⃣ HEALTH CHECKS & MONITORING

### Verify All Systems Running

```bash
# Check deployment status
kubectl get deployment lyra-app -n lyra

# Check pods
kubectl get pods -n lyra -o wide

# Check services
kubectl get svc -n lyra

# Check Redis
kubectl exec -it redis-0 -n lyra -- redis-cli ping
# Expected: PONG

# Test health endpoint
curl https://api.yourdomain.com/health | jq .

# Expected response:
# {
#   "status": "healthy",
#   "timestamp": "2026-03-30T...",
#   "checks": {
#     "database": "healthy",
#     "memory": { "status": "healthy", ... },
#     "cache": { ... },
#     "api": { ... }
#   }
# }
```

### Monitor Performance

```bash
# CPU/Memory per pod
kubectl top pods -n lyra

# Resource requests vs actual
kubectl describe nodes

# Pod logs
kubectl logs -f deployment/lyra-app -n lyra

# Specific errors
kubectl logs -f deployment/lyra-app -n lyra | grep ERROR

# Event stream
kubectl get events -n lyra --sort-by='.lastTimestamp'
```

---

## 6️⃣ PRODUCTION READINESS TESTS

### Test 1: Basic Connectivity

```bash
# Port forward (local testing)
kubectl port-forward svc/lyra-service 3000:80 -n lyra

# Test
curl http://localhost:3000/
curl http://localhost:3000/health
```

### Test 2: Chat Endpoint

```bash
curl -X POST http://localhost:3000/v1/api/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Merhaba"}],
    "model": "gpt-4o-mini",
    "call": {"metadata": {"userId": "test-user"}}
  }'

# Expected: SSE stream with tokens
```

### Test 3: Load Test (100K Users Simulation)

```bash
# Start load test
RATE=5000 DURATION=180 node load-test.js

# In another terminal, watch HPA scaling
kubectl get hpa lyra-app-hpa -n lyra --watch

# Expected behavior:
# - Pods: 3 → 5 → 8 → 10 (as load increases)
# - Latency: <1000ms
# - Error rate: <2%
```

### Test 4: Redis Persistence

```bash
# Kill a pod (simulate crash)
kubectl delete pod <pod-name> -n lyra

# Verify:
# - Pod automatically restarts
# - Jobs in queue are recovered
# - No data loss

kubectl get pods -n lyra
kubectl describe pod <pod-name> -n lyra
```

---

## 7️⃣ CI/CD PIPELINE (GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Kubernetes

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker image
        run: |
          docker build -t gcr.io/${{ secrets.GCP_PROJECT }}/lyra:${{ github.sha }} .
          docker push gcr.io/${{ secrets.GCP_PROJECT }}/lyra:${{ github.sha }}

      - name: Deploy to K8s
        env:
          KUBECONFIG: ${{ secrets.KUBECONFIG }}
        run: |
          kubectl set image deployment/lyra-app \
            lyra=gcr.io/${{ secrets.GCP_PROJECT }}/lyra:${{ github.sha }} \
            -n lyra
          kubectl rollout status deployment/lyra-app -n lyra

      - name: Verify deployment
        run: |
          kubectl get pods -n lyra
          kubectl get svc -n lyra
```

---

## 8️⃣ MONITORING SETUP (Prometheus + Grafana)

### Prometheus Configuration

```yaml
# k8s/prometheus-config.yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'lyra'
    kubernetes_sd_configs:
      - role: pod
        namespaces:
          names: [lyra]
    relabel_configs:
      - source_labels: [__meta_kubernetes_pod_label_app]
        action: keep
        regex: lyra
      - source_labels: [__meta_kubernetes_pod_container_port_number]
        action: keep
        regex: "3000"
```

### Grafana Dashboards

```bash
# Import dashboards
kubectl apply -f k8s/grafana-dashboards.yaml

# Access
kubectl port-forward svc/grafana 3001:3000 -n lyra
# http://localhost:3001 (admin/admin)
```

### Key Metrics to Monitor

```
HTTP Request Duration (P50, P95, P99)
Error Rate by Status Code (4xx, 5xx)
CPU Usage per Pod
Memory Usage per Pod
Redis Memory Usage
Queue Length (pending jobs)
Active Connections
Request Rate (req/s)
```

---

## 9️⃣ ROLLBACK PROCEDURE

If issues occur:

```bash
# View deployment history
kubectl rollout history deployment/lyra-app -n lyra

# Rollback to previous version
kubectl rollout undo deployment/lyra-app -n lyra

# Rollback to specific revision
kubectl rollout undo deployment/lyra-app --to-revision=2 -n lyra

# Verify
kubectl rollout status deployment/lyra-app -n lyra
kubectl logs -f deployment/lyra-app -n lyra
```

---

## 🔟 TROUBLESHOOTING

### Pod not starting
```bash
kubectl describe pod <pod-name> -n lyra
kubectl logs <pod-name> -n lyra
```

### High memory usage
```bash
kubectl top pods -n lyra
# If >80% → Scale up or increase pod memory
kubectl patch deployment lyra-app -n lyra -p '{"spec":{"template":{"spec":{"containers":[{"name":"lyra","resources":{"limits":{"memory":"2Gi"}}}]}}}}'
```

### Redis connection issues
```bash
# Check Redis service
kubectl get svc redis-service -n lyra

# Test connection
kubectl exec -it <lyra-pod> -n lyra -- \
  redis-cli -h redis-service ping
```

### Ingress not working
```bash
# Check ingress
kubectl get ingress -n lyra

# Check ingress controller
kubectl get pods -n ingress-nginx

# Verify DNS
nslookup api.yourdomain.com
```

---

## ✅ FINAL CHECKLIST BEFORE GOING LIVE

- [ ] All secrets configured (no dummy values)
- [ ] Redis tested and working
- [ ] OpenAI API key validated
- [ ] Supabase connection tested
- [ ] TLS certificates installed
- [ ] Ingress routing verified
- [ ] Health check passing
- [ ] Load test completed (100K simulation)
- [ ] Performance baselines documented
- [ ] Monitoring alerts configured
- [ ] Backup strategy in place
- [ ] Rollback procedure tested
- [ ] Team trained on deployment
- [ ] Incident response plan ready

---

## 📞 SUPPORT

**Production Issues:**
1. Check logs: `kubectl logs -f deployment/lyra-app -n lyra`
2. Check metrics: Grafana dashboard
3. Check events: `kubectl get events -n lyra`
4. Rollback if needed: `kubectl rollout undo deployment/lyra-app -n lyra`

**Performance Issues:**
1. Check load: `kubectl top pods -n lyra`
2. Check queue: `curl /v1/queue-status`
3. Scale up: `kubectl scale deployment lyra-app --replicas=<N> -n lyra`

**Data Issues:**
1. Check Redis: `redis-cli KEYS '*'`
2. Check database: Query Supabase directly
3. Check queue: BullMQ admin UI

---

**Status: ✅ READY FOR PRODUCTION DEPLOYMENT**
