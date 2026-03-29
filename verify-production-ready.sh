#!/bin/bash

# Production Readiness Verification Script
# Checks all systems before deployment to production

set -e

echo "🚀 LYRA PRODUCTION READINESS CHECK"
echo "=================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

PASSED=0
FAILED=0
WARNINGS=0

# Helper functions
pass() {
    echo -e "${GREEN}✅ PASS${NC}: $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}❌ FAIL${NC}: $1"
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠️  WARN${NC}: $1"
    ((WARNINGS++))
}

# 1. Node.js and dependencies
echo "1️⃣  DEPENDENCIES CHECK"
echo "====================="

if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v)
    pass "Node.js installed: $NODE_VERSION"
else
    fail "Node.js not installed"
fi

if command -v npm &> /dev/null; then
    pass "npm installed"
else
    fail "npm not installed"
fi

if [ -f "package.json" ]; then
    pass "package.json exists"
else
    fail "package.json not found"
fi

if [ -f "package-lock.json" ]; then
    pass "package-lock.json exists (dependencies locked)"
else
    warn "package-lock.json not found (consider running npm ci)"
fi

# 2. Environment variables
echo ""
echo "2️⃣  ENVIRONMENT VARIABLES"
echo "=========================="

if [ -f ".env" ]; then
    pass ".env file exists"

    # Check required variables
    REQUIRED_VARS=("OPENAI_API_KEY" "SUPABASE_URL" "SUPABASE_KEY" "VAPI_API_KEY" "REDIS_URL")

    for var in "${REQUIRED_VARS[@]}"; do
        if grep -q "^$var=" .env; then
            VALUE=$(grep "^$var=" .env | cut -d'=' -f2 | cut -c1-20)
            if [[ $VALUE == *"your_"* ]] || [[ $VALUE == *"SET_"* ]]; then
                fail "$var is set to dummy value"
            else
                pass "$var configured"
            fi
        else
            fail "$var not found in .env"
        fi
    done
else
    fail ".env file not found (use cp .env.example .env)"
fi

# 3. Code quality
echo ""
echo "3️⃣  CODE QUALITY"
echo "================"

# Check syntax
echo "  Checking syntax..."
if node --check server.js 2>/dev/null; then
    pass "server.js syntax OK"
else
    fail "server.js has syntax errors"
fi

if node --check routes/chat-simple.js 2>/dev/null; then
    pass "chat-simple.js syntax OK"
else
    fail "chat-simple.js has syntax errors"
fi

if node --check src/services/cache/redisService.js 2>/dev/null; then
    pass "redisService.js syntax OK"
else
    fail "redisService.js has syntax errors"
fi

# 4. Docker
echo ""
echo "4️⃣  DOCKER"
echo "==========="

if command -v docker &> /dev/null; then
    pass "Docker installed"

    if [ -f "Dockerfile" ]; then
        pass "Dockerfile exists"
    else
        fail "Dockerfile not found"
    fi

    if [ -f "docker-compose.yml" ]; then
        pass "docker-compose.yml exists"
    else
        fail "docker-compose.yml not found"
    fi
else
    warn "Docker not installed (required for containerization)"
fi

# 5. Kubernetes
echo ""
echo "5️⃣  KUBERNETES"
echo "==============="

if command -v kubectl &> /dev/null; then
    pass "kubectl installed"

    KUBE_FILES=("k8s/namespace.yaml" "k8s/configmap.yaml" "k8s/deployment.yaml" "k8s/service.yaml" "k8s/ingress.yaml" "k8s/rbac.yaml")

    for file in "${KUBE_FILES[@]}"; do
        if [ -f "$file" ]; then
            pass "$(basename $file) exists"
        else
            fail "$(basename $file) not found"
        fi
    done
else
    warn "kubectl not installed (required for K8s deployment)"
fi

# 6. Documentation
echo ""
echo "6️⃣  DOCUMENTATION"
echo "==================="

DOC_FILES=("README.md" "DEPLOYMENT.md" "LOAD-TESTING.md" "PRODUCTION_DEPLOYMENT.md")

for file in "${DOC_FILES[@]}"; do
    if [ -f "$file" ]; then
        pass "$file exists"
    else
        warn "$file not found"
    fi
done

# 7. Git status
echo ""
echo "7️⃣  GIT STATUS"
echo "==============="

if command -v git &> /dev/null; then
    pass "Git installed"

    if git rev-parse --git-dir > /dev/null 2>&1; then
        pass "Git repository initialized"

        UNCOMMITTED=$(git status --short | wc -l)
        if [ $UNCOMMITTED -eq 0 ]; then
            pass "All changes committed"
        else
            warn "$UNCOMMITTED uncommitted changes"
        fi
    else
        fail "Not a git repository"
    fi
else
    warn "Git not installed"
fi

# 8. Production readiness
echo ""
echo "8️⃣  PRODUCTION READINESS"
echo "========================="

# Check critical files
CRITICAL_FILES=("server.js" "package.json" "src/services/cache/redisService.js" "src/services/cron/cronManager.js" "src/services/queue/persistentQueue.js" "routes/chat-simple.js")

for file in "${CRITICAL_FILES[@]}"; do
    if [ -f "$file" ]; then
        pass "$file exists"
    else
        fail "$file not found (CRITICAL)"
    fi
done

# Summary
echo ""
echo "=================================="
echo "📊 SUMMARY"
echo "=================================="
echo -e "${GREEN}✅ Passed: $PASSED${NC}"
echo -e "${RED}❌ Failed: $FAILED${NC}"
echo -e "${YELLOW}⚠️  Warnings: $WARNINGS${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    if [ $WARNINGS -eq 0 ]; then
        echo -e "${GREEN}🚀 ALL CHECKS PASSED - READY FOR PRODUCTION${NC}"
        exit 0
    else
        echo -e "${YELLOW}✅ READY FOR PRODUCTION (with minor warnings)${NC}"
        exit 0
    fi
else
    echo -e "${RED}❌ NOT READY FOR PRODUCTION - Fix $FAILED issue(s)${NC}"
    exit 1
fi
