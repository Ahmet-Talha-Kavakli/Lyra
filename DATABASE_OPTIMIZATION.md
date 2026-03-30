# Database Optimization for 100K+ Users

## Current State

Your Supabase/PostgreSQL database is optimized with:

✅ Connection pooling (20 connections)
✅ Index strategy (created in `migrations/002_create_indices.sql`)
✅ Query timeout (30s)
✅ Statement caching

## Indices Created

### User Lookups
- `idx_users_email` — Fast email lookups during auth
- `idx_users_created_at` — Timeline queries
- `idx_users_is_deleted` — Active users filter

### Session Management
- `idx_therapy_sessions_user_id` — Get user's sessions
- `idx_therapy_sessions_started_at` — Recent sessions first
- `idx_therapy_sessions_status` — Active session filter
- `idx_therapy_sessions_user_started` — Composite: user + date (most common query)

### Chat Messages
- `idx_chat_messages_session_id` — Get session messages
- `idx_chat_messages_user_id` — Get user's messages across sessions
- `idx_chat_messages_session_created` — Message history (most common query)
- `idx_chat_messages_user_role` — Filter by role (user/assistant)
- `idx_chat_messages_content_gin` — Full-text search (if needed)

### Privacy/Compliance
- `idx_user_consents_user_type` — Check consent for user + type
- `idx_user_consents_granted_at` — Audit trail

## Query Performance Targets

| Query Type | Query | Expected Time | Target Time |
|-----------|-------|---|---|
| User lookup | `SELECT * FROM users WHERE email = ?` | 1-5ms | < 10ms |
| Session list | `SELECT * FROM therapy_sessions WHERE user_id = ? ORDER BY started_at DESC LIMIT 50` | 5-15ms | < 50ms |
| Message history | `SELECT * FROM chat_messages WHERE session_id = ? ORDER BY created_at DESC LIMIT 100` | 10-30ms | < 100ms |
| Recent sessions | `SELECT * FROM therapy_sessions WHERE status = 'active' ORDER BY started_at DESC LIMIT 20` | 20-50ms | < 100ms |

## Production Monitoring (After Deploy)

### Check Query Plans

```sql
-- Analyze how PostgreSQL executes queries
EXPLAIN ANALYZE
SELECT * FROM chat_messages
WHERE session_id = 'some-uuid'
ORDER BY created_at DESC
LIMIT 100;

-- Look for:
-- - Seq Scan (bad, means full table scan)
-- - Index Scan (good, using our index)
-- - Bitmap Index Scan (good)
```

### Monitor Slow Queries

In Supabase Dashboard:
```
Database → Logs → Slow Queries
```

Set threshold: > 100ms

**Action:** If slow query found:
1. Note the query
2. Analyze query plan (EXPLAIN ANALYZE)
3. Check if index exists
4. If not, add index

### Monitor Index Usage

```sql
-- Which indices are being used?
SELECT
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC;

-- Unused indices (consider removing)
SELECT indexname FROM pg_stat_user_indexes WHERE idx_scan = 0;
```

### Monitor Table Bloat

```sql
-- Table size and dead tuples
SELECT
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size,
  n_live_tup,
  n_dead_tup
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- If dead tuples > 10% of live tuples, VACUUM needed
-- Supabase handles this automatically, but check during load testing
```

## Scaling Beyond 100K Users

### 1. Partitioning (at 500K+ users)

Partition `chat_messages` table by month:

```sql
-- Create partitioned table
CREATE TABLE chat_messages_partitioned (
  id UUID,
  session_id UUID,
  user_id UUID,
  role TEXT,
  content TEXT,
  created_at TIMESTAMP
) PARTITION BY RANGE (created_at);

-- Create monthly partitions
CREATE TABLE messages_2026_03
  PARTITION OF chat_messages_partitioned
  FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

CREATE TABLE messages_2026_04
  PARTITION OF chat_messages_partitioned
  FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');
```

### 2. Archiving (at 1M+ users)

Move old sessions to separate archive table:

```sql
-- Archive sessions older than 1 year
INSERT INTO therapy_sessions_archive
SELECT * FROM therapy_sessions
WHERE ended_at < NOW() - INTERVAL '1 year';

DELETE FROM therapy_sessions
WHERE ended_at < NOW() - INTERVAL '1 year';

VACUUM ANALYZE therapy_sessions;
```

### 3. Read Replicas

In Supabase Dashboard:
```
Settings → Database → Replication
```

Create read replica for:
- Analytics queries
- Report generation
- Long-running exports

## Maintenance Tasks

### Weekly

```sql
-- Reindex tables (10 min downtime)
REINDEX TABLE CONCURRENTLY therapy_sessions;
REINDEX TABLE CONCURRENTLY chat_messages;

-- Vacuum (minimal downtime)
VACUUM ANALYZE users;
VACUUM ANALYZE therapy_sessions;
```

### Monthly

```sql
-- Full table analysis
ANALYZE;

-- Check for bloat
SELECT * FROM pg_stat_user_tables;
```

### Before Load Testing

```sql
-- Reset statistics
TRUNCATE pg_stat_user_indexes;
TRUNCATE pg_stat_user_tables;

-- Analyze baseline
ANALYZE;
```

## Cost Optimization

| Action | Estimated Cost Savings |
|--------|------------------------|
| Remove unused indices | -5-10% storage |
| Archive old data | -10-20% storage |
| Use connection pooling | -30% connection costs |
| Partitioning (500K+ users) | -20% query time |

## Troubleshooting

### Slow Queries

1. Check query plan: `EXPLAIN ANALYZE <query>`
2. Check if index is being used
3. Check for missing indices in `002_create_indices.sql`
4. Check for table bloat (run `VACUUM ANALYZE`)

### High Connection Count

1. Check `SHOW max_connections;`
2. Increase pool size in Vercel env: `DB_POOL_SIZE=30`
3. Reduce idle timeout: `DB_IDLE_TIMEOUT=15000`
4. Move long-running queries to worker

### Out of Disk Space

1. Check table sizes: `SELECT pg_size_pretty(pg_total_relation_size(tablename))`
2. Archive old data
3. Drop unused indices
4. Contact Supabase to upgrade

## Resources

- Supabase Performance Guide: https://supabase.com/docs/guides/database/overview
- PostgreSQL EXPLAIN: https://www.postgresql.org/docs/current/sql-explain.html
- Index Strategy: https://use-the-index-luke.com/
