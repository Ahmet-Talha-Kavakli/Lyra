-- ============================================================
-- LYRA — Row Level Security Politikaları
-- Supabase Dashboard → SQL Editor'da çalıştır
-- ============================================================
-- TEXT user_id olan tablolar (auth.uid()::text kullanıldı):
--   session_records, psychological_profiles, progress_metrics,
--   technique_effectiveness, error_logs
-- UUID user_id olan tüm diğer tablolar: auth.uid() = user_id
-- ============================================================

-- ── MEMORIES ─────────────────────────────────────────────────
ALTER TABLE memories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "memories_own" ON memories;
CREATE POLICY "memories_own" ON memories
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ── USER_CONSENTS ─────────────────────────────────────────────
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_consents_own" ON user_consents;
CREATE POLICY "user_consents_own" ON user_consents
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ── USER_PROFILE ──────────────────────────────────────────────
ALTER TABLE user_profile ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_profile_own" ON user_profile;
CREATE POLICY "user_profile_own" ON user_profile
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ── SESSION_RECORDS (user_id = TEXT) ──────────────────────────
ALTER TABLE session_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "session_records_own" ON session_records;
CREATE POLICY "session_records_own" ON session_records
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- ── WEEKLY_METRICS ────────────────────────────────────────────
ALTER TABLE weekly_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "weekly_metrics_own" ON weekly_metrics;
CREATE POLICY "weekly_metrics_own" ON weekly_metrics
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ── EMERGENCY_CONTACTS ────────────────────────────────────────
ALTER TABLE emergency_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "emergency_contacts_own" ON emergency_contacts;
CREATE POLICY "emergency_contacts_own" ON emergency_contacts
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ── SESSION_FEEDBACK ──────────────────────────────────────────
ALTER TABLE session_feedback ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "session_feedback_own" ON session_feedback;
CREATE POLICY "session_feedback_own" ON session_feedback
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ── SESSION_PREPARATION ───────────────────────────────────────
ALTER TABLE session_preparation ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "session_preparation_own" ON session_preparation;
CREATE POLICY "session_preparation_own" ON session_preparation
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ── EMOTION_LOGS ──────────────────────────────────────────────
ALTER TABLE emotion_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "emotion_logs_own" ON emotion_logs;
CREATE POLICY "emotion_logs_own" ON emotion_logs
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ── HYPOTHESIS_ACCURACY ───────────────────────────────────────
ALTER TABLE hypothesis_accuracy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "hypothesis_accuracy_own" ON hypothesis_accuracy;
CREATE POLICY "hypothesis_accuracy_own" ON hypothesis_accuracy
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ── KNOWLEDGE_BANK ────────────────────────────────────────────
ALTER TABLE knowledge_bank ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "knowledge_bank_own" ON knowledge_bank;
CREATE POLICY "knowledge_bank_own" ON knowledge_bank
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ── THOUGHT_RECORDS ───────────────────────────────────────────
ALTER TABLE thought_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "thought_records_own" ON thought_records;
CREATE POLICY "thought_records_own" ON thought_records
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ── USER_VALUES ───────────────────────────────────────────────
ALTER TABLE user_values ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_values_own" ON user_values;
CREATE POLICY "user_values_own" ON user_values
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ── HOMEWORK_TASKS ────────────────────────────────────────────
ALTER TABLE homework_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "homework_tasks_own" ON homework_tasks;
CREATE POLICY "homework_tasks_own" ON homework_tasks
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ── CRISIS_LOGS ───────────────────────────────────────────────
ALTER TABLE crisis_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crisis_logs_own" ON crisis_logs;
CREATE POLICY "crisis_logs_own" ON crisis_logs
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ── KNOWLEDGE_USAGE_LOGS ──────────────────────────────────────
ALTER TABLE knowledge_usage_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "knowledge_usage_logs_own" ON knowledge_usage_logs;
CREATE POLICY "knowledge_usage_logs_own" ON knowledge_usage_logs
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ── BEHAVIOR_ANALYSIS ─────────────────────────────────────────
ALTER TABLE behavior_analysis ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "behavior_analysis_own" ON behavior_analysis;
CREATE POLICY "behavior_analysis_own" ON behavior_analysis
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ── CHARACTER_STATES ──────────────────────────────────────────
ALTER TABLE character_states ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "character_states_own" ON character_states;
CREATE POLICY "character_states_own" ON character_states
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ── PSYCHOLOGICAL_PROFILES (user_id = TEXT) ───────────────────
ALTER TABLE psychological_profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "psychological_profiles_own" ON psychological_profiles;
CREATE POLICY "psychological_profiles_own" ON psychological_profiles
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- ── PROGRESS_METRICS (user_id = TEXT) ────────────────────────
ALTER TABLE progress_metrics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "progress_metrics_own" ON progress_metrics;
CREATE POLICY "progress_metrics_own" ON progress_metrics
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- ── TECHNIQUE_EFFECTIVENESS (user_id = TEXT) ─────────────────
ALTER TABLE technique_effectiveness ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "technique_effectiveness_own" ON technique_effectiveness;
CREATE POLICY "technique_effectiveness_own" ON technique_effectiveness
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- ── KNOWLEDGE_SOURCES ─────────────────────────────────────────
-- Herkese okuma (terapi kaynakları), yazma sadece service role
ALTER TABLE knowledge_sources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "knowledge_sources_read" ON knowledge_sources;
CREATE POLICY "knowledge_sources_read" ON knowledge_sources
    FOR SELECT USING (true);

-- ── ERROR_LOGS ────────────────────────────────────────────────
-- Sadece service role erişir, politika yok
ALTER TABLE error_logs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ÖNEMLİ NOT:
-- Sunucu SUPABASE_SERVICE_KEY kullandığı için RLS bypass eder.
-- Bu politikalar Supabase Studio, direct DB veya anon key ile
-- yapılan yetkisiz erişimleri engeller.
-- ============================================================
