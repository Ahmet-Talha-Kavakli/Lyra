-- Migration: Create Indices for Production Scale
-- Optimizes queries for 100K+ users
-- Run: psql postgresql://user:password@db.supabase.co:5432/postgres < migrations/002_create_indices.sql

-- ─── USER INDICES ──────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);
CREATE INDEX IF NOT EXISTS idx_users_is_deleted ON users(is_deleted) WHERE is_deleted = false;

-- ─── SESSION INDICES ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_therapy_sessions_user_id ON therapy_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_therapy_sessions_started_at ON therapy_sessions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_therapy_sessions_status ON therapy_sessions(status) WHERE status = 'active';

-- Composite index for common query: user + start date range
CREATE INDEX IF NOT EXISTS idx_therapy_sessions_user_started
    ON therapy_sessions(user_id, started_at DESC);

-- ─── MESSAGE INDICES ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at ON chat_messages(created_at DESC);

-- Composite index for session message history
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_created
    ON chat_messages(session_id, created_at DESC);

-- Role filtering (common query: get all user messages)
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_role
    ON chat_messages(user_id, role, created_at DESC);

-- ─── PROFILE INDICES ───────────────────────────────────────────────────────
-- If you have psychological_profiles table
CREATE INDEX IF NOT EXISTS idx_psychological_profiles_user_id
    ON psychological_profiles(user_id) WHERE user_id IS NOT NULL;

-- ─── CONSENT INDICES ───────────────────────────────────────────────────────
-- GDPR/KVKK compliance
CREATE INDEX IF NOT EXISTS idx_user_consents_user_type
    ON user_consents(user_id, consent_type);

CREATE INDEX IF NOT EXISTS idx_user_consents_granted_at
    ON user_consents(granted_at DESC);

-- ─── SEARCH & FILTERING INDICES ────────────────────────────────────────────
-- For potential text search on message content
CREATE INDEX IF NOT EXISTS idx_chat_messages_content_gin
    ON chat_messages USING GIN (to_tsvector('english', content));

-- ─── STATISTICS ────────────────────────────────────────────────────────────
-- Analyze tables for query planner optimization
ANALYZE users;
ANALYZE therapy_sessions;
ANALYZE chat_messages;
ANALYZE psychological_profiles;
ANALYZE user_consents;

-- ─── VERIFY INDICES ────────────────────────────────────────────────────────
-- Run this query to check which indices exist:
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public' ORDER BY indexname;
