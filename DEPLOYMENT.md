# Lyra Deployment Guide

Enterprise-grade production deployment for 100K concurrent users.

## Quick Start

### Docker Compose (Development)
```bash
# Copy environment file
cp .env.example .env

# Start all services (app + Redis + Prometheus + Grafana)
docker-compose up -d

# View logs
docker-compose logs -f lyra

# Check health
curl http://localhost:3000/health
```

### Docker Build (Production)
```bash
# Build image
docker build -t lyra-therapist:1.0.0 .

# Run with environment
docker run -p 3000:3000 \
  -e OPENAI_API_KEY=$OPENAI_API_KEY \
  -e SUPABASE_URL=$SUPABASE_URL \
  -e SUPABASE_KEY=$SUPABASE_KEY \
  -e REDIS_URL=redis://redis:6379 \
  lyra-therapist:1.0.0
```

## Kubernetes Deployment (100K Scale)

### Prerequisites
- Kubernetes 1.24+
- kubectl configured
- Docker registry access
- cert-manager (for TLS)
- nginx-ingress controller

### Step 1: Set Environment Variables

```bash
# Edit k8s/secret.yaml with actual values
export VAPI_API_KEY="your_key"
export OPENAI_API_KEY="your_key"
export SUPABASE_URL="your_url"
# ... etc

# Create secret from file (recommended for CI/CD)
kubectl create secret generic lyra-secrets \
  --from-literal=VAPI_API_KEY=$VAPI_API_KEY \
  --from-literal=OPENAI_API_KEY=$OPENAI_API_KEY \
  -n lyra
```

### Step 2: Deploy

```bash
# Create namespace
kubectl apply -f k8s/namespace.yaml

# Create config and secrets
kubectl apply -f k8s/configmap.yaml
kubectl apply -f k8s/secret.yaml

# Create RBAC
kubectl apply -f k8s/rbac.yaml

# Deploy Redis
kubectl apply -f k8s/service.yaml

# Deploy application
kubectl apply -f k8s/deployment.yaml

# Create ingress
kubectl apply -f k8s/ingress.yaml

# Verify rollout
kubectl rollout status deployment/lyra-app -n lyra
```

### Step 3: Verify Deployment

```bash
# Check pods
kubectl get pods -n lyra

# Check services
kubectl get svc -n lyra

# Check ingress
kubectl get ingress -n lyra

# View logs
kubectl logs -f deployment/lyra-app -n lyra

# Port forward (local testing)
kubectl port-forward svc/lyra-internal 3000:3000 -n lyra
```

## Scaling to 100K Concurrent Users

### Application Layer
- **Replicas**: 3-10 pods (HPA scales automatically)
- **CPU**: 500m request, 1000m limit per pod
- **Memory**: 512Mi request, 1Gi limit per pod
- **Max throughput**: ~10K requests/minute per pod = 100K across cluster

### Redis Layer
- **StatefulSet**: Single master (read-write)
- **Storage**: 1Gi persistent volume
- **Upgrade path**: Redis Sentinel/Cluster for HA
- **Memory policy**: allkeys-lru (evict unused keys)

### Database (Supabase)
- **Connection pool**: 20 connections per pod
- **Max connections**: 200 (10 pods × 20)
- **Upgrade**: Supabase Enterprise plan for higher limits

### Load Balancing
- **Strategy**: Round-robin (K8s built-in)
- **Session affinity**: ClientIP (1 hour timeout)
- **Rate limiting**: 20 requests/minute per user (configurable)

## Monitoring & Observability

### Prometheus
- Access: http://localhost:9090
- Metrics: CPU, memory, request latency, error rates
- Scrape interval: 15s

### Grafana
- Access: http://localhost:3001
- Dashboards: Application, Redis, System
- Default: admin/admin (change in production)

### Health Checks
```bash
# Liveness (restart if fails)
GET /health

# Readiness (remove from LB if fails)
GET /health

# Custom metrics
GET /metrics
```

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Deploy to K8s

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build Docker image
        run: docker build -t lyra-therapist:${{ github.sha }} .
      
      - name: Push to registry
        run: docker push your-registry/lyra-therapist:${{ github.sha }}
      
      - name: Update K8s image
        run: kubectl set image deployment/lyra-app \
          lyra=your-registry/lyra-therapist:${{ github.sha }} \
          -n lyra
      
      - name: Wait for rollout
        run: kubectl rollout status deployment/lyra-app -n lyra
```

## Troubleshooting

### Pod not starting
```bash
kubectl describe pod <pod-name> -n lyra
kubectl logs <pod-name> -n lyra
```

### High memory usage
```bash
# Check pod metrics
kubectl top pods -n lyra

# Scale down replicas
kubectl scale deployment lyra-app --replicas=3 -n lyra
```

### Redis connection issues
```bash
# Check Redis service
kubectl get svc redis-service -n lyra

# Test connection
kubectl exec -it <pod-name> -n lyra -- redis-cli -h redis-service ping
```

### Load balancer not accessible
```bash
# Check ingress status
kubectl get ingress -n lyra

# Wait for external IP
kubectl get svc lyra-service -n lyra -w
```

## Rollback

```bash
# View deployment history
kubectl rollout history deployment/lyra-app -n lyra

# Rollback to previous version
kubectl rollout undo deployment/lyra-app -n lyra

# Rollback to specific revision
kubectl rollout undo deployment/lyra-app --to-revision=2 -n lyra
```

## Production Checklist

- [ ] All secrets configured (API keys, DB credentials)
- [ ] TLS certificates set up (cert-manager)
- [ ] Redis backup strategy defined
- [ ] Monitoring alerts configured
- [ ] Log aggregation set up (ELK, CloudWatch, etc.)
- [ ] Database backups automated
- [ ] Disaster recovery plan documented
- [ ] Load testing completed (100K simulation)
- [ ] Performance baselines established
- [ ] Security scan passed (OWASP, dependencies)

## Advanced Configuration

### Custom Resource Limits
Edit `k8s/deployment.yaml` resources section:
```yaml
resources:
  requests:
    cpu: 1000m        # Increase for high traffic
    memory: 1Gi
  limits:
    cpu: 2000m
    memory: 2Gi
```

### Custom HPA Thresholds
Edit HPA in `k8s/deployment.yaml`:
```yaml
metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 60  # More aggressive scaling
```

### Add Caching Layer (Redis Cluster)
1. Install Redis Operator
2. Create RedisCluster manifest
3. Update REDIS_URL in ConfigMap

## Support

For issues or questions:
1. Check logs: `kubectl logs -f deployment/lyra-app -n lyra`
2. Check metrics: Open Grafana dashboard
3. Check Kubernetes events: `kubectl get events -n lyra`
