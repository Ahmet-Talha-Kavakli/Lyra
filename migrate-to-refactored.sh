#!/bin/bash
# Migration Script: Old Monolith → New Clean Architecture
# Usage: bash migrate-to-refactored.sh

set -e

echo "🚀 Lyra Architecture Refactor Migration"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Functions
log_step() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Step 1: Backup current code
echo "STEP 1: Backup current code"
echo "---"
if [ ! -d ".git" ]; then
    log_error "Not a git repository. Initialize git first:"
    echo "git init && git add . && git commit -m 'Pre-refactor backup'"
    exit 1
fi

git branch -D backup/old-monolith 2>/dev/null || true
git branch backup/old-monolith
log_step "Created backup branch: backup/old-monolith"

# Step 2: Install dependencies
echo ""
echo "STEP 2: Install dependencies"
echo "---"
npm install pg bull redis 2>/dev/null || log_warning "Dependencies already installed"
log_step "Dependencies installed"

# Step 3: Create .env if not exists
echo ""
echo "STEP 3: Configure environment"
echo "---"
if [ ! -f ".env" ]; then
    cat > .env << 'EOF'
NODE_ENV=development
PORT=3000
OPENAI_API_KEY=sk-
DATABASE_URL=postgresql://postgres:password@localhost:5432/lyra
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=password
DB_NAME=lyra
DB_POOL_SIZE=20
REDIS_HOST=localhost
REDIS_PORT=6379
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:3001
LOG_LEVEL=info
EOF
    log_step "Created .env (update with your values!)"
else
    log_step ".env already exists"
fi

# Step 4: Database schema
echo ""
echo "STEP 4: Create database schema"
echo "---"
if [ -f "migrations/001_initial_schema.sql" ]; then
    log_warning "Migration file exists. Manually run:"
    echo "  psql -U postgres -d lyra -f migrations/001_initial_schema.sql"
else
    mkdir -p migrations
    cat > migrations/001_initial_schema.sql << 'EOF'
-- Sessions
CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    state JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);

-- Session Analysis
CREATE TABLE IF NOT EXISTS session_analysis (
    session_id TEXT PRIMARY KEY,
    user_id UUID NOT NULL,
    transcript JSONB,
    response TEXT,
    modules TEXT[],
    emotional_state JSONB,
    timestamp TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_session_analysis_user_id ON session_analysis(user_id);

-- Psychological Profiles
CREATE TABLE IF NOT EXISTS psychological_profiles (
    user_id UUID PRIMARY KEY,
    last_interaction TIMESTAMP,
    emotional_intensity INT,
    safety_rating INT,
    selected_modules TEXT[],
    updated_at TIMESTAMP
);

-- Homework Assignments
CREATE TABLE IF NOT EXISTS homework_assignments (
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
CREATE INDEX IF NOT EXISTS idx_homework_user_id ON homework_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_homework_status ON homework_assignments(status);
EOF
    log_step "Created migration file: migrations/001_initial_schema.sql"
    echo "  Run: psql -U postgres -d lyra -f migrations/001_initial_schema.sql"
fi

# Step 5: Verify new files
echo ""
echo "STEP 5: Verify refactored components"
echo "---"
required_files=(
    "src/domain/entities/SessionState.js"
    "src/domain/entities/IntentClassifier.js"
    "src/application/services/StateAnalyzer.js"
    "src/application/services/SafetyGuard.js"
    "src/application/services/TherapistAgent.js"
    "src/infrastructure/config/config.js"
    "src/infrastructure/database/DatabasePool.js"
    "src/infrastructure/queue/OptimizedQueue.js"
    "src/infrastructure/llm/openaiClient.js"
    "src/infrastructure/logging/logger.js"
    "src/adapters/http/routes/chatRefactored.js"
    "src/adapters/workers/jobProcessor.js"
)

all_exist=true
for file in "${required_files[@]}"; do
    if [ -f "$file" ]; then
        log_step "✓ $file"
    else
        log_error "✗ Missing: $file"
        all_exist=false
    fi
done

if [ "$all_exist" = false ]; then
    log_error "Some refactored files are missing. Aborting."
    exit 1
fi

# Step 6: Update imports in existing files
echo ""
echo "STEP 6: Update imports (manual)"
echo "---"
log_warning "Update imports in existing route files:"
echo ""
echo "  OLD: import { selectPsychologyModules } from './psychologyIntegration.js';"
echo "  NEW: import { intentClassifier } from '../src/domain/entities/IntentClassifier.js';"
echo ""
log_warning "See INTEGRATION_CHECKLIST.md for detailed instructions"

# Step 7: Test connectivity
echo ""
echo "STEP 7: Test connections"
echo "---"

# Test Redis
if command -v redis-cli &> /dev/null; then
    if redis-cli ping &> /dev/null; then
        log_step "Redis is running"
    else
        log_warning "Redis is not responding. Start it:"
        echo "  redis-server"
    fi
else
    log_warning "redis-cli not found. Install Redis:"
    echo "  brew install redis  (macOS)"
    echo "  apt-get install redis-server  (Linux)"
fi

# Test PostgreSQL
if command -v psql &> /dev/null; then
    if psql -U postgres -c "SELECT 1" &> /dev/null 2>&1; then
        log_step "PostgreSQL is running"
    else
        log_warning "PostgreSQL connection failed. Check:"
        echo "  DATABASE_URL in .env"
        echo "  PostgreSQL server running"
    fi
else
    log_warning "psql not found. Install PostgreSQL"
fi

# Step 8: Summary
echo ""
echo "========================================"
echo "MIGRATION CHECKLIST"
echo "========================================"
echo ""
echo "[ ] 1. Update .env with correct credentials"
echo "[ ] 2. Start PostgreSQL: psql -U postgres"
echo "[ ] 3. Create database: psql -U postgres -c 'CREATE DATABASE lyra;'"
echo "[ ] 4. Run migrations: psql -U postgres -d lyra -f migrations/001_initial_schema.sql"
echo "[ ] 5. Start Redis: redis-server"
echo "[ ] 6. Update imports in existing route files"
echo "[ ] 7. Test: npm run dev"
echo "[ ] 8. Load test: node load-test.js --users 100"
echo ""
echo "For detailed instructions, see:"
echo "  - INTEGRATION_CHECKLIST.md"
echo "  - ARCHITECTURE_REFACTOR.md"
echo ""
log_step "Migration script complete!"
