/**
 * PRODUCTION POSTGRES OPTIMIZATION
 * For 100K concurrent users on Vercel + Supabase
 *
 * Execution Order:
 * 1. CREATE INDEXES (read performance)
 * 2. CREATE RLS POLICIES (security + performance)
 * 3. ANALYZE (query planner optimization)
 */

-- ============================================================================
-- PART 1: CRITICAL INDEXES
-- ============================================================================

-- **Auth & User Identification** (Every request needs this)
CREATE INDEX IF NOT EXISTS idx_profiles_user_id
  ON public.profiles(user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_email
  ON public.profiles(email)
  WHERE email IS NOT NULL;

-- **Session/Token Lookups** (Auth middleware)
CREATE INDEX IF NOT EXISTS idx_sessions_user_id_expires
  ON public.sessions(user_id, expires_at)
  WHERE expires_at > NOW();

-- **Conversation History** (AI therapy - high query volume)
CREATE INDEX IF NOT EXISTS idx_conversations_user_id_created
  ON public.conversations(user_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
  ON public.messages(conversation_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_messages_user_id
  ON public.messages(user_id, created_at DESC)
  WHERE deleted_at IS NULL;

-- **Audit Logs** (Compliance + debugging - high write volume)
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id
  ON public.audit_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action
  ON public.audit_logs(action, created_at DESC);

-- **Soft Deletes** (Logical deletes = faster than actual deletes)
CREATE INDEX IF NOT EXISTS idx_conversations_deleted_at
  ON public.conversations(deleted_at)
  WHERE deleted_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_messages_deleted_at
  ON public.messages(deleted_at)
  WHERE deleted_at IS NOT NULL;

-- **Full-text Search** (If using AI knowledge search)
CREATE INDEX IF NOT EXISTS idx_conversations_search
  ON public.conversations USING GIN (to_tsvector('english', title || ' ' || COALESCE(summary, '')))
  WHERE deleted_at IS NULL;

-- **Rate Limiting Data** (High cardinality, frequent updates)
-- NOTE: Stored in Redis, not Postgres. No index needed.

-- ============================================================================
-- PART 2: ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- **Enable RLS on all user-facing tables**
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- **Profiles: User can only see own profile**
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- **Conversations: User can only access own conversations**
DROP POLICY IF EXISTS "conversations_select_own" ON public.conversations;
CREATE POLICY "conversations_select_own" ON public.conversations
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "conversations_insert_own" ON public.conversations;
CREATE POLICY "conversations_insert_own" ON public.conversations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "conversations_update_own" ON public.conversations;
CREATE POLICY "conversations_update_own" ON public.conversations
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "conversations_delete_own" ON public.conversations;
CREATE POLICY "conversations_delete_own" ON public.conversations
  FOR DELETE USING (auth.uid() = user_id);

-- **Messages: User can only access own messages (via conversation)**
DROP POLICY IF EXISTS "messages_select_own" ON public.messages;
CREATE POLICY "messages_select_own" ON public.messages
  FOR SELECT USING (
    auth.uid() = user_id OR
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages_insert_own" ON public.messages;
CREATE POLICY "messages_insert_own" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

-- **Sessions: User can only see own sessions**
DROP POLICY IF EXISTS "sessions_select_own" ON public.sessions;
CREATE POLICY "sessions_select_own" ON public.sessions
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "sessions_delete_own" ON public.sessions;
CREATE POLICY "sessions_delete_own" ON public.sessions
  FOR DELETE USING (auth.uid() = user_id);

-- **Audit Logs: User can only see own logs (read-only)**
DROP POLICY IF EXISTS "audit_logs_select_own" ON public.audit_logs;
CREATE POLICY "audit_logs_select_own" ON public.audit_logs
  FOR SELECT USING (auth.uid() = user_id);

-- ============================================================================
-- PART 3: TABLE STRUCTURE OPTIMIZATION
-- ============================================================================

-- **Profiles Table** (Critical for every user request)
ALTER TABLE public.profiles ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_user_id
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- **Add indexes for frequently updated columns**
CREATE INDEX IF NOT EXISTS idx_profiles_updated_at
  ON public.profiles(updated_at DESC);

-- **Sessions Table** (Explicit TTL for cleanup)
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at
  ON public.sessions(expires_at)
  WHERE expires_at < NOW();

-- **Conversations Table** (Large dataset, needs efficient queries)**
ALTER TABLE public.conversations ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.conversations ADD CONSTRAINT fk_conversations_user_id
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- **Messages Table** (Highest write volume)**
ALTER TABLE public.messages ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.messages ALTER COLUMN conversation_id SET NOT NULL;
ALTER TABLE public.messages ADD CONSTRAINT fk_messages_conversation_id
  FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;
ALTER TABLE public.messages ADD CONSTRAINT fk_messages_user_id
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ============================================================================
-- PART 4: QUERY PERFORMANCE TUNING
-- ============================================================================

-- **Auto-vacuum config for high-write tables**
ALTER TABLE public.messages SET (
  autovacuum_vacuum_scale_factor = 0.01,
  autovacuum_analyze_scale_factor = 0.005
);

ALTER TABLE public.audit_logs SET (
  autovacuum_vacuum_scale_factor = 0.01,
  autovacuum_analyze_scale_factor = 0.005
);

-- **Refresh statistics for query planner**
ANALYZE public.profiles;
ANALYZE public.conversations;
ANALYZE public.messages;
ANALYZE public.sessions;
ANALYZE public.audit_logs;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check all indexes are created
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Check RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = true
ORDER BY tablename;

-- Check all policies
SELECT schemaname, tablename, policyname, permissive, cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
