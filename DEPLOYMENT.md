# 🚀 LYRA DEPLOYMENT GUIDE - PRODUCTION (100K+ USERS)

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                   VERCEL (Frontend + API)               │
├─────────────────────────────────────────────────────────┤
│ Frontend (React) │ API Functions (Node.js)              │
└──────────┬───────────────────────────────┬──────────────┘
           │                               │
     [5173]                            [3000]
           │                               │
    ┌──────▼────────┐          ┌──────────▼──────────┐
    │   vercel.com   │          │  Supabase Database  │
    │   (static)     │          │  (PostgreSQL)       │
    └────────────────┘          └──────────┬──────────┘
                                           │
                          ┌────────────────┼────────────────┐
                          │                │                │
                    ┌─────▼──────┐   ┌─────▼──────┐   ┌────▼────────┐
                    │ Redis Cache │   │ Bull Queue │   │ Monitoring  │
                    │ (Rate Limit)│   │(Background)│   │   (Sentry)  │
                    └─────────────┘   └────────────┘   └─────────────┘
```

## Pre-Deployment Checklist

### 1. Environment Secrets

**Create in Vercel Dashboard:**
```
Settings → Environment Variables
```

Required variables:
- [ ] `OPENAI_API_KEY` — OpenAI API key
- [ ] `DATABASE_URL` — Supabase PostgreSQL connection string
- [ ] `SUPABASE_URL` — Supabase project URL
- [ ] `SUPABASE_SERVICE_KEY` — Supabase service role key
- [ ] `REDIS_URL` — Redis connection string (Upstash or Redis Cloud)
- [ ] `JWT_SECRET` — Random 32+ char secret
- [ ] `FRONTEND_URL` — Your production frontend domain
- [ ] `SESSION_SECRET` — Random secret for sessions

### 2. Database Setup

**In Supabase:**

```sql
-- Run these migrations
psql postgresql://user:password@db.supabase.co:5432/postgres

-- Create schema
CREATE SCHEMA IF NOT EXISTS public;

-- Create users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted BOOLEAN DEFAULT false,
    deleted_at TIMESTAMP
);

-- Create sessions table
CREATE TABLE therapy_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    status TEXT DEFAULT 'active'
);

-- Create messages table
CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES therapy_sessions(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user' | 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indices for performance
CREATE INDEX idx_sessions_user_id ON therapy_sessions(user_id);
CREATE INDEX idx_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_messages_user_id ON chat_messages(user_id);
```

### 3. Redis Setup

**Option A: Upstash (Recommended for Vercel)**
1. Create account at https://upstash.com
2. Create Redis database
3. Copy `REDIS_URL` (includes auth)
4. Add to Vercel environment variables

**Option B: Redis Cloud**
1. Create account at https://redis.com/cloud
2. Create database
3. Get connection string
4. Add to Vercel environment variables

### 4. Backend Deployment

#### Step 1: Push to GitHub

```bash
git add .
git commit -m "build: production-ready deployment config"
git push origin main
```

#### Step 2: Connect to Vercel

```bash
vercel --prod
```

Or via Vercel Dashboard:
1. Import project from GitHub
2. Select root directory (not `/frontend`)
3. Override build command: `npm install`
4. Add environment variables

#### Step 3: Verify Deployment

```bash
curl https://your-backend.vercel.app/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2026-03-30T...",
  "env": "production",
  "version": "1.0.0"
}
```

### 5. Frontend Deployment

#### Step 1: Build

```bash
cd frontend
npm run build
# Output: dist/
```

#### Step 2: Deploy

**Option A: Vercel (Recommended)**
```bash
vercel --prod
```

**Option B: Netlify**
```bash
npm install -g netlify-cli
netlify deploy --prod --dir=dist
```

#### Step 3: Configure CORS in Backend

Update `.env.production`:
```
FRONTEND_URL=https://your-frontend.vercel.app
```

Redeploy backend.

## Post-Deployment

### 1. Health Checks

```bash
# Backend health
curl https://api.your-domain.com/health

# Frontend load
# Open https://your-frontend.vercel.app in browser
```

### 2. Monitor Logs

**Vercel Dashboard:**
```
Settings → Functions → Logs
```

**Sentry (Error Tracking):**
1. Create account at sentry.io
2. Create Node.js project
3. Add `SENTRY_DSN` to environment variables
4. Monitor errors at https://sentry.io/projects/

### 3. Database Performance

Check Supabase dashboard:
```
Database → Logs
Database → Performance
```

Look for:
- Slow queries (> 1000ms)
- Connection pool exhaustion
- Index usage

### 4. Rate Limiting Status

Monitor Redis:
```bash
# If using Upstash, check web console
# Look for key patterns: rl:*
```

## Scaling Beyond 100K Users

### Database Optimization
```sql
-- Add read replicas in Supabase
-- Enable connection pooling (PgBouncer)
-- Archive old sessions to cold storage
```

### Cache Layer
```javascript
// Implement caching for:
// - Psychology module configs
// - User preferences
// - Session history
```

### Rate Limiting
```javascript
// Adjust limits based on monitoring:
// - Chat: 20 msgs/min per user
// - Auth: 5 attempts/15min per IP
// - API: 100 req/min per IP
```

## Troubleshooting

### Issue: 503 Service Unavailable

**Cause:** Database connection exhaustion

**Fix:**
```bash
# Check pool stats
curl https://api.your-domain.com/health | jq .checks.databaseOptimization

# Reduce concurrent connections
# Increase DB_POOL_SIZE in Supabase settings
```

### Issue: WebSocket Timeout

**Cause:** Vercel serverless timeout (30s default)

**Fix:**
- Move WebSocket to external service (Socket.io on Railway)
- OR use polling instead of WebSocket
- OR increase timeout in vercel.json (up to 60s)

### Issue: High OpenAI Costs

**Cause:** Inefficient prompt caching

**Fix:**
```javascript
// Implement:
// - Response caching (Redis)
// - Batch processing of similar requests
// - Cost monitoring per user
```

## Security Checklist

- [ ] All env vars set (no defaults in production)
- [ ] HTTPS/WSS enforced
- [ ] Rate limiting enabled
- [ ] CORS whitelist configured
- [ ] JWT secret is cryptographically random
- [ ] Database backups enabled
- [ ] Audit logging enabled
- [ ] Error monitoring (Sentry) active
- [ ] GDPR consent mechanism working
- [ ] Log sanitization removing PII

## Monitoring & Alerts

### Key Metrics to Monitor

1. **API Response Time**
   - Target: < 200ms (p95)
   - Alert: > 500ms (p95)

2. **Error Rate**
   - Target: < 0.1%
   - Alert: > 1%

3. **Database Connections**
   - Target: < 80% of pool
   - Alert: > 95% of pool

4. **Redis Hit Rate**
   - Target: > 80%
   - Alert: < 50%

5. **OpenAI API Usage**
   - Monitor: Tokens per user/day
   - Limit: Set hard caps per account

## Rollback Procedure

If critical issue discovered:

```bash
# Vercel: One-click rollback in dashboard
# Dashboard → Deployments → [Previous] → Redeploy

# Or via CLI:
vercel rollback
```

## Support & Resources

- **Vercel Docs:** https://vercel.com/docs
- **Supabase Docs:** https://supabase.com/docs
- **Redis Docs:** https://redis.io/docs
- **OpenAI Docs:** https://platform.openai.com/docs
