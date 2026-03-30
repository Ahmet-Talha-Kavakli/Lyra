# QUICK START - Lyra Refactored Architecture

Fastest way to get started with the new Clean Architecture.

## ⚡ 5-MINUTE SETUP

### 1. Clone & Install
```bash
cd /c/Users/TUF/Desktop/Lyra
npm install pg bull redis
```

### 2. Configure Environment
```bash
cp .env.example .env
# Edit .env with your credentials:
# OPENAI_API_KEY=sk-...
# DATABASE_URL=postgresql://...
# JWT_SECRET=your-secret
```

### 3. Start Services
```bash
# Terminal 1: PostgreSQL
psql -U postgres -c "CREATE DATABASE lyra;" 2>/dev/null || true
psql -U postgres -d lyra -f migrations/001_initial_schema.sql

# Terminal 2: Redis
redis-server &

# Terminal 3: Node server + worker
npm run dev
```

### 4. Test
```bash
# In new terminal:
curl -X POST http://localhost:3000/v1/api/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test-token" \
  -d '{
    "messages": [{"role": "user", "content": "I feel anxious"}],
    "call": {"metadata": {"userId": "test-user-123"}}
  }'
```

---

## 📁 FILES YOU NEED TO KNOW

### 🧠 Domain Layer (Business Logic)
- **SessionState.js** — State machine (DISCOVERY → DEEPENING → CLOSURE)
  - Methods: `transitionState()`, `updateEmotionalIntensity()`, `getSummary()`
  - Use: Tracks session progress automatically

- **IntentClassifier.js** — Semantic intent understanding
  - Methods: `classifyAndSelectModules()`, `analyzeEmotionalTone()`
  - Use: Replace regex with LLM-powered semantic routing

### 🎭 Application Layer (Use Cases)
- **StateAnalyzer.js** — Determines therapeutic phase
  - Methods: `analyzeState()`, `getStateSpecificPrompt()`
  - Use: Keeps track of where we are in session

- **SafetyGuard.js** — Crisis detection (parallel)
  - Methods: `checkSafetyAsync()`, `shouldEscalate()`
  - Use: Runs in background while generating response

- **TherapistAgent.js** — Response generation
  - Methods: `generateResponse()`, `extractInsights()`
  - Use: Generates therapy response with state-specific prompts

### ⚙️ Infrastructure Layer (Technical Details)
- **DatabasePool.js** — PostgreSQL connection pooling
  - Methods: `initialize()`, `query()`, `transaction()`
  - Use: Manage DB connections for 100K concurrent users

- **OptimizedQueue.js** — BullMQ job queue with Redis
  - Methods: `addJob()`, `registerProcessor()`, `getQueueStatus()`
  - Use: Queue background jobs (guaranteed processing)

- **openaiClient.js** — OpenAI wrapper
  - Methods: `chat.completions.create()` (streaming)
  - Use: Call OpenAI with error handling

- **config.js** — Configuration management
  - Loads from .env file
  - Use: Access config vars anywhere in app

- **logger.js** — Structured logging
  - Methods: `info()`, `warn()`, `error()`, `debug()`
  - Use: Log events with context

### 🌐 Adapters Layer (External Interfaces)
- **chatRefactored.js** — New chat endpoint (**USE THIS**)
  - Endpoint: `POST /v1/api/chat/completions`
  - Flow: Intent → State → Safety → Response → Queue jobs
  - Use: Replace old routes/chat.js with this

- **jobProcessor.js** — Background worker
  - Processes queued jobs: session_analysis, profile_update, homework_generation
  - Use: Run as separate process: `node src/adapters/workers/jobProcessor.js`

---

## 🔄 WORKFLOW: How a Chat Request Flows

```
1. Client sends message to /v1/api/chat/completions
                ↓
2. IntentClassifier determines relevant therapy modules
                ↓
3. StateAnalyzer determines session phase (DISCOVERY/DEEPENING/CLOSURE/CRISIS)
                ↓
4. PARALLEL:
   ├─ SafetyGuard checks for crisis (async, non-blocking)
   ├─ TherapistAgent generates response (streaming, state-specific prompt)
   └─ Both run simultaneously
                ↓
5. Response streamed to client via SSE (non-blocking)
                ↓
6. res.end() — Client response complete
                ↓
7. BACKGROUND:
   ├─ Session analysis job → Redis queue
   ├─ Profile update job → Redis queue
   └─ Homework generation job → Redis queue
                ↓
8. Worker process picks up jobs asynchronously
   ├─ Stores in database
   ├─ Updates user profile
   └─ Generates homework
```

---

## 🎯 COMMON TASKS

### Use Semantic Intent Classification
```javascript
import { intentClassifier } from './src/domain/entities/IntentClassifier.js';

const modules = await intentClassifier.classifyAndSelectModules(messages);
console.log(modules);  // ['exposureTherapy', 'dbtEmotionRegulation', ...]
```

### Track Session State
```javascript
import { SessionState } from './src/domain/entities/SessionState.js';

const session = new SessionState(sessionId, userId);
session.updateEmotionalIntensity(7);  // 1-10 scale
session.transitionState('deepening');
console.log(session.currentState);  // 'deepening'
```

### Check Safety
```javascript
import { safetyGuard } from './src/application/services/SafetyGuard.js';

const check = safetyGuard.checkSafetyAsync(userMessage, sessionState);
if (!check.isSafe) {
    console.log(`Crisis detected! Risk level: ${check.riskLevel}`);
    console.log(`Resources: ${check.recommendations}`);
}
```

### Queue a Background Job
```javascript
import { optimizedQueue } from './src/infrastructure/queue/OptimizedQueue.js';

await optimizedQueue.addJob('session_analysis', {
    userId,
    sessionId,
    transcript,
    timestamp: new Date()
});
```

### Query Database
```javascript
import { databasePool } from './src/infrastructure/database/DatabasePool.js';

await databasePool.initialize();

// Single row
const user = await databasePool.queryOne(
    'SELECT * FROM psychological_profiles WHERE user_id = $1',
    [userId]
);

// Multiple rows
const sessions = await databasePool.queryAll(
    'SELECT * FROM sessions WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
);

// Transaction
await databasePool.transaction(async (client) => {
    await client.query('UPDATE profiles SET ...');
    await client.query('INSERT INTO audit_log ...');
});
```

### Log Events
```javascript
import { logger } from './src/infrastructure/logging/logger.js';

logger.info('[Chat] User sent message', {
    userId,
    sessionId,
    messageLength: msg.length
});

logger.warn('[SafetyGuard] Risk detected', {
    riskLevel: 7,
    riskType: 'anxiety'
});

logger.error('[Database] Query failed', {
    sql: 'SELECT ...',
    error: err.message
});
```

---

## 📊 MONITORING & DEBUGGING

### Check Queue Status
```bash
curl http://localhost:3000/v1/chat/status
# Returns: { status: 'healthy', queues: [...], database: {...} }
```

### View Logs
```bash
# Development (console)
npm run dev

# Production (Docker)
docker-compose -f docker-compose.prod.yml logs -f app
docker-compose -f docker-compose.prod.yml logs -f worker
```

### Database Connection Health
```bash
# Check pool stats
psql -U postgres -d lyra -c "SELECT * FROM pg_stat_activity;"

# Check queue in Redis
redis-cli
> KEYS bull:*
> LRANGE bull:session_analysis:0:delayed 0 -1
```

### Load Test
```bash
node load-test.js --users 100 --duration 30
```

---

## 🚀 PRODUCTION DEPLOYMENT

### Option 1: Docker Compose (Recommended)
```bash
docker-compose -f docker-compose.prod.yml up -d
```

### Option 2: Manual Kubernetes
```bash
kubectl apply -f k8s/deployment.yaml
```

### Option 3: Vercel (App Server Only)
```bash
vercel deploy
```

---

## 🐛 TROUBLESHOOTING

### "Cannot find module 'pg'"
```bash
npm install pg
```

### "Redis connection refused"
```bash
redis-server &  # or docker run -d -p 6379:6379 redis:7-alpine
```

### "Database connection timeout"
```
Check .env DATABASE_URL
Verify PostgreSQL is running: psql -U postgres
```

### "Queue jobs not processing"
```bash
# Ensure worker is running
node src/adapters/workers/jobProcessor.js

# Check Redis has jobs
redis-cli LRANGE bull:session_analysis:0 0 -1
```

### "Sessions not persisting"
```bash
# Create database schema
psql -U postgres -d lyra -f migrations/001_initial_schema.sql

# Verify tables
psql -U postgres -d lyra -c "\dt"
```

---

## 📚 DOCUMENTATION REFERENCE

- **Architecture Deep Dive**: [ARCHITECTURE_REFACTOR.md](./ARCHITECTURE_REFACTOR.md)
- **Before/After Comparison**: [BEFORE_AFTER_COMPARISON.md](./BEFORE_AFTER_COMPARISON.md)
- **Integration Checklist**: [INTEGRATION_CHECKLIST.md](./INTEGRATION_CHECKLIST.md)
- **Migration Script**: [migrate-to-refactored.sh](./migrate-to-refactored.sh)

---

## 🎓 LEARNING PATH

1. **Start here**: This file (QUICK_START.md)
2. **Understand architecture**: [ARCHITECTURE_REFACTOR.md](./ARCHITECTURE_REFACTOR.md)
3. **See code changes**: [BEFORE_AFTER_COMPARISON.md](./BEFORE_AFTER_COMPARISON.md)
4. **Integrate**: [INTEGRATION_CHECKLIST.md](./INTEGRATION_CHECKLIST.md)
5. **Deploy**: [docker-compose.prod.yml](./docker-compose.prod.yml)

---

## 💡 KEY CONCEPTS

### State Machine
Session flows through states: DISCOVERY → DEEPENING → CLOSURE → COMPLETED
Each state has specific therapeutic goals and valid responses.

### Multi-Agent Decomposition
Instead of one mega-prompt, three agents run (mostly parallel):
1. StateAnalyzer: "What phase are we in?"
2. SafetyGuard: "Is client safe?" (async)
3. TherapistAgent: "Generate response" (streaming)

### Semantic Intent Classification
Instead of regex, LLM understands meaning.
"Panic" and "Extreme anxiety" both trigger exposureTherapy.

### Connection Pooling
Instead of new DB connection per request, pool of 20 connections
multiplexed across 1000+ concurrent users via PgBouncer.

---

## 🆘 GET HELP

**Still have questions?**

1. Check code comments (each file has detailed comments)
2. Review test files (see how to use each class)
3. Read ARCHITECTURE_REFACTOR.md section by section
4. Check docker-compose.prod.yml for real-world example

**Report issues:**
- Open GitHub issue with BEFORE/AFTER code
- Include error logs and .env (without secrets)
- Describe expected vs actual behavior

---

**Version**: 1.0
**Last Updated**: 2026-03-30
**Status**: Ready for production
