# INTEGRATION CHECKLIST

This checklist guides you through integrating the refactored architecture with the existing codebase.

## ✅ PREREQUISITES

- [ ] Node.js 18+ installed
- [ ] PostgreSQL 14+ or connection to managed database
- [ ] Redis 7+ installed
- [ ] Docker & Docker Compose (for production deployment)
- [ ] Environment variables configured (.env file)

---

## ✅ PHASE 1: ENVIRONMENT SETUP

### 1. Create .env file
```bash
cat > .env << 'EOF'
NODE_ENV=development
PORT=3000

# OpenAI
OPENAI_API_KEY=sk-...

# Database (PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/lyra
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=your_password
DB_NAME=lyra
DB_POOL_SIZE=20
DB_IDLE_TIMEOUT=30000

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# JWT
JWT_SECRET=your-secret-key-change-in-production

# Frontend
FRONTEND_URL=http://localhost:3001
FRONTEND_URL_PREVIEW=http://localhost:5173

# Logging
LOG_LEVEL=info
EOF
```

### 2. Install dependencies
```bash
npm install pg bull redis
npm install --save-dev vitest
```

### 3. Setup PostgreSQL
```bash
# Option A: Local PostgreSQL
psql -U postgres -c "CREATE DATABASE lyra;"

# Option B: Managed Database (Supabase, AWS RDS, etc.)
# Update DATABASE_URL in .env with your connection string
```

### 4. Start Redis
```bash
# Option A: Local Redis
redis-server

# Option B: Docker
docker run -d -p 6379:6379 redis:7-alpine
```

---

## ✅ PHASE 2: REFACTORED COMPONENTS INTEGRATION

### 1. Import new services in existing routes

**Old way** (routes/chat.js):
```javascript
import { selectPsychologyModules } from './psychologyIntegration.js';
```

**New way**:
```javascript
import { intentClassifier } from '../src/domain/entities/IntentClassifier.js';
import { stateAnalyzer } from '../src/application/services/StateAnalyzer.js';
import { safetyGuard } from '../src/application/services/SafetyGuard.js';
import { therapistAgent } from '../src/application/services/TherapistAgent.js';
```

### 2. Update Express app initialization

**In server.js**, after other imports:
```javascript
import chatRouterRefactored from './src/adapters/http/routes/chatRefactored.js';

// ... existing middleware ...

// Replace old chat route with new one
app.use(chatRouterRefactored);

// Or run both in parallel for migration:
// app.use('/v1/api/chat/completions', oldChatRouter);
// app.use('/v2/api/chat/completions', chatRouterRefactored);
```

### 3. Initialize database pool on startup

**In server.js**, before starting server:
```javascript
import { databasePool } from './src/infrastructure/database/DatabasePool.js';

// Initialize pool
await databasePool.initialize();

const server = app.listen(port, () => {
    logger.info('Server started', { port });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    await databasePool.shutdown();
    server.close();
});
```

### 4. Setup worker process

**In worker.js**:
```javascript
import JobProcessor from './src/adapters/workers/jobProcessor.js';

// Worker initializes itself
// Run with: node worker.js
```

---

## ✅ PHASE 3: DATABASE SCHEMA MIGRATION

### 1. Create tables
```bash
psql -U postgres -d lyra -f ./migrations/001_initial_schema.sql
```

**migrations/001_initial_schema.sql**:
```sql
-- Sessions
CREATE TABLE sessions (
    session_id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    state JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);

-- Session Analysis
CREATE TABLE session_analysis (
    session_id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    transcript JSONB,
    response TEXT,
    modules TEXT[],
    emotional_state JSONB,
    timestamp TIMESTAMP
);

CREATE INDEX idx_session_analysis_user_id ON session_analysis(user_id);

-- Psychological Profiles
CREATE TABLE psychological_profiles (
    user_id UUID PRIMARY KEY,
    last_interaction TIMESTAMP,
    emotional_intensity INT,
    safety_rating INT,
    selected_modules TEXT[],
    updated_at TIMESTAMP
);

-- Homework Assignments
CREATE TABLE homework_assignments (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL,
    session_id TEXT NOT NULL,
    task TEXT,
    modules TEXT[],
    status VARCHAR(20) DEFAULT 'pending',
    due_date TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_homework_user_id ON homework_assignments(user_id);
CREATE INDEX idx_homework_status ON homework_assignments(status);
```

---

## ✅ PHASE 4: GRADUAL CLIENT MIGRATION

### Option A: Shadow Mode (Recommended)
```javascript
// Run new endpoint in parallel, log differences
router.post('/v1/api/chat/completions', async (req, res) => {
    // Run both old and new
    const oldResult = await oldChat(req);
    const newResult = await newChat(req);

    // Log differences
    if (JSON.stringify(oldResult) !== JSON.stringify(newResult)) {
        logger.warn('Results differ', { old: oldResult, new: newResult });
    }

    // Return new result
    res.json(newResult);
});
```

### Option B: Gradual Rollout
```javascript
const ROLLOUT_PERCENTAGE = 10; // Start at 10% of users

router.post('/v1/api/chat/completions', async (req, res) => {
    if (Math.random() * 100 < ROLLOUT_PERCENTAGE) {
        // New route (refactored)
        return chatRouterRefactored(req, res);
    } else {
        // Old route (current)
        return chatRouterOld(req, res);
    }
});

// Increase ROLLOUT_PERCENTAGE over time: 10% → 25% → 50% → 100%
```

### Option C: Header-Based
```javascript
router.post('/v1/api/chat/completions', async (req, res) => {
    if (req.headers['x-use-refactored'] === 'true') {
        return chatRouterRefactored(req, res);
    } else {
        return chatRouterOld(req, res);
    }
});
```

---

## ✅ PHASE 5: PRODUCTION DEPLOYMENT

### 1. Docker Compose
```bash
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

### 2. Verify services
```bash
# Check app health
curl http://localhost:3000/health

# Check queue status
curl http://localhost:3000/v1/chat/status

# Check Prometheus metrics (optional)
curl http://localhost:9090/api/v1/targets
```

### 3. Monitor logs
```bash
docker-compose -f docker-compose.prod.yml logs -f app
docker-compose -f docker-compose.prod.yml logs -f worker
```

---

## ✅ PHASE 6: TESTING & VALIDATION

### 1. Unit tests
```bash
npm run test
```

### 2. Load test
```bash
node load-test.js --users 1000 --duration 60
```

### 3. Manual smoke test
```bash
curl -X POST http://localhost:3000/v1/api/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "messages": [{"role": "user", "content": "I am feeling anxious today"}],
    "call": {"metadata": {"userId": "test-user-123"}}
  }'
```

---

## ✅ PHASE 7: CLEANUP

### Remove old code (after migration complete)
```bash
# Backup old code
git branch backup/old-monolith

# Delete obsolete folders
rm -rf lib/domain
rm -rf lib/infrastructure (partially)

# Delete old route files
rm routes/chat.js (keep backup)
```

---

## 🚨 ROLLBACK PROCEDURE

If issues occur:

```bash
# Revert to old code
git checkout backup/old-monolith

# Restart services
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

# Or revert in code with header flag
# Keep both routes running, toggle via header
```

---

## 📊 MONITORING CHECKLIST

- [ ] Response latency < 1000ms
- [ ] Queue jobs completing (check Redis)
- [ ] Database pool health (check pg_stat_activity)
- [ ] Memory usage stable (<500MB per process)
- [ ] No unhandled promise rejections in logs
- [ ] Safety guard detecting crisis indicators
- [ ] Session state persisting correctly

---

## 🔍 COMMON ISSUES

### Issue: "Cannot find module 'pg'"
```bash
npm install pg
```

### Issue: "Redis connection refused"
```bash
# Start Redis
redis-server &
# Or: docker run -d -p 6379:6379 redis:7-alpine
```

### Issue: "Database pool timeout"
```bash
# Check DATABASE_URL in .env
# Verify PostgreSQL is running
psql -U postgres -c "SELECT version();"
```

### Issue: "Queue jobs not processing"
```bash
# Check worker.js is running
ps aux | grep jobProcessor

# Check Redis connection
redis-cli ping  # Should return PONG

# View queue status
curl http://localhost:3000/v1/chat/status
```

---

## 📝 NOTES

- **Database migrations**: Use `migrations/` folder for schema changes
- **Environment variables**: Never commit .env file
- **Secrets rotation**: Change JWT_SECRET and DB_PASSWORD monthly
- **Log retention**: Keep logs for 30+ days (for compliance)
- **Backup strategy**: Daily backups of PostgreSQL database

---

**Version**: 1.0
**Last Updated**: 2026-03-30
**Questions?** Check ARCHITECTURE_REFACTOR.md for detailed explanations.
