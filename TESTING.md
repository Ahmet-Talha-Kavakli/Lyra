# Testing Strategy for 100K+ Users

## Test Coverage Goals

| Category | Target | Current |
|----------|--------|---------|
| Unit tests | >80% | 0% |
| Integration tests | >60% | 0% |
| E2E tests | >40% | 0% |
| **Overall** | **>70%** | **0%** |

## Test Types

### 1. Unit Tests (Fast, Isolated)

**Purpose:** Test individual functions in isolation

**Examples:**
- CircuitBreaker state transitions
- Token generation/validation
- Password hashing
- Utility functions

**Run:**
```bash
npm test -- --run unit/
```

**Coverage:**
```bash
npm test -- --coverage
```

### 2. Integration Tests (Medium speed, Database)

**Purpose:** Test components working together

**Examples:**
- Auth flow (signup → login → logout)
- Chat flow (create session → send message → save)
- Database transactions
- Error handling + fallbacks

**Run:**
```bash
npm test -- --run integration/
```

**Requirements:**
- Test database (Supabase test instance)
- Mock Redis
- Mock OpenAI

### 3. E2E Tests (Slow, Full flow)

**Purpose:** Test entire user journey

**Examples:**
- User signs up → creates session → sends message → receives response
- Crisis detection → safety alert
- Session history retrieval
- Export user data (GDPR)

**Tools:** Cypress or Playwright

**Run:**
```bash
npm run test:e2e
```

### 4. Load Tests (Performance)

**Purpose:** Test behavior under 100K+ concurrent users

**Examples:**
- 10K concurrent chat requests
- Rate limiting effectiveness
- Database connection pooling
- Cache hit rates

**Run:**
```bash
npm run test:load
```

---

## Test Setup

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run test/unit/",
    "test:integration": "vitest run test/integration/",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "cypress run",
    "test:load": "node load-test.js",
    "test:all": "npm run test:unit && npm run test:integration && npm run test:coverage"
  }
}
```

### Test Utilities

**File:** `test/setup.js`
- Mock database
- Mock Redis
- Mock OpenAI
- Test data generators
- Helper functions

---

## Running Tests Locally

### Setup

```bash
# Install test dependencies
npm install --save-dev vitest @vitest/ui cypress @cypress/schematic

# Create test database
createdb lyra_test

# Initialize
npm test -- --reporter=verbose
```

### Run All Tests

```bash
npm test
```

### Run Specific Suite

```bash
npm test -- --run unit/circuitBreaker.test.js
```

### Watch Mode (Development)

```bash
npm test -- --watch
```

### Coverage Report

```bash
npm test -- --coverage
```

Generates HTML report in `coverage/index.html`

---

## Test Examples

### Unit Test: CircuitBreaker

**File:** `test/unit/circuitBreaker.test.js`

Tests:
- ✅ CLOSED state: execute normally
- ✅ CLOSED → OPEN: after threshold failures
- ✅ OPEN state: reject immediately
- ✅ OPEN → HALF_OPEN: after timeout
- ✅ HALF_OPEN → CLOSED: on success
- ✅ Fallback behavior

### Integration Test: Auth Flow

**File:** `test/integration/auth.test.js`

Tests:
- ✅ Signup with valid credentials
- ✅ Reject duplicate email
- ✅ Reject weak password
- ✅ Login with valid credentials
- ✅ Reject invalid credentials
- ✅ Verify token
- ✅ Logout clears cookies

### Load Test: 100K Concurrent Users

**File:** `load-test.js`

Simulates:
- 10K concurrent users
- 100 messages/sec per user
- Database queries
- Cache lookups
- OpenAI API calls (with mock delays)

Measures:
- Response time (p50, p95, p99)
- Error rate
- Throughput
- Resource usage

---

## CI/CD Integration

### GitHub Actions Workflow

**File:** `.github/workflows/test.yml`

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: lyra_test
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18

      - run: npm install
      - run: npm run test:unit
      - run: npm run test:integration
      - run: npm run test:coverage

      - uses: codecov/codecov-action@v3
        with:
          files: ./coverage/coverage-final.json
```

### Pre-commit Hook

**File:** `.git/hooks/pre-commit`

```bash
#!/bin/bash
npm run test:unit || exit 1
```

---

## Load Testing

### Simulate 100K Users

**File:** `load-test.js`

```bash
npm run test:load

# Output:
# 10K concurrent users
# 100 req/sec/user
# Response time p95: 250ms
# Error rate: 0.1%
# Cache hit rate: 65%
```

### Load Test Metrics

| Metric | Target | Threshold |
|--------|--------|-----------|
| Response time (p95) | < 500ms | Alert: > 1s |
| Error rate | < 0.5% | Alert: > 2% |
| Cache hit rate | > 50% | Alert: < 30% |
| Database connections | < 18/20 pool | Alert: > 19/20 |

---

## Continuous Testing

### Daily

```bash
# Run all tests
npm run test:all

# Upload to Codecov
npm run test:coverage
```

### Weekly

```bash
# Full load test
npm run test:load

# E2E tests
npm run test:e2e
```

### Before Release

```bash
# Full suite
npm run test:all

# Load test at 100K users
npm run test:load

# Performance profiling
npm run test:profile
```

---

## Troubleshooting Tests

### Test Timeout

**Problem:** Test hangs/times out

**Solution:**
```javascript
vi.setConfig({ testTimeout: 30000 }) // 30s timeout
```

### Mock Database Not Working

**Problem:** Database queries return undefined

**Solution:**
```javascript
// In test setup
vi.mock('../lib/database', () => ({
    db: mockDatabase
}))
```

### Flaky Tests

**Problem:** Test passes sometimes, fails other times

**Solution:**
- Add `describe.skip()` temporarily
- Increase timeout
- Check for race conditions
- Mock time-dependent code

```javascript
vi.useFakeTimers(); // Mock Date.now()
```

---

## Test Quality Metrics

### Coverage Report

Aim for:
- **Statements:** > 80%
- **Branches:** > 75%
- **Functions:** > 80%
- **Lines:** > 80%

Check:
```bash
npm test -- --coverage
```

### Mutation Testing

Ensure tests catch real bugs:

```bash
npm install --save-dev stryker

# Run mutation tests
stryker run
```

---

## Future Test Improvements

1. **Contract testing:** API contract tests with frontend
2. **Chaos engineering:** Random failure injection to test resilience
3. **Performance regression:** Track perf over time
4. **Security testing:** OWASP vulnerability scanning
5. **Accessibility testing:** a11y checks for frontend

---

## References

- Vitest: https://vitest.dev/
- Testing Library: https://testing-library.com/
- Cypress: https://cypress.io/
- k6 (load testing): https://k6.io/
