-- Sprint 1: Vision & Voice Tracking Tables
-- Physical Harm, Voice Baseline, Object History

-- 1. Physical Harm Logs — seanslar arası fiziksel zarar geçmişi
CREATE TABLE IF NOT EXISTS public.physical_harm_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    snapshot JSONB NOT NULL DEFAULT '{}',
    detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT physical_harm_logs_user_session_unique UNIQUE (user_id, session_id)
);

CREATE INDEX IF NOT EXISTS idx_physical_harm_logs_user_id
    ON public.physical_harm_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_physical_harm_logs_detected_at
    ON public.physical_harm_logs(detected_at DESC);

ALTER TABLE public.physical_harm_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanıcı kendi fiziksel zarar kayıtlarını okuyabilir"
    ON public.physical_harm_logs FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Sistem fiziksel zarar kaydedebilir"
    ON public.physical_harm_logs FOR INSERT
    WITH CHECK (auth.uid()::text = user_id OR auth.role() = 'authenticated');

-- 2. Voice Baselines — kişisel ses norm'u (baseline)
CREATE TABLE IF NOT EXISTS public.voice_baselines (
    user_id TEXT PRIMARY KEY,
    avg_tempo FLOAT DEFAULT 0,
    avg_loudness FLOAT DEFAULT 0,
    avg_tremor_rate FLOAT DEFAULT 0,
    typical_pitch_pattern TEXT,
    baseline_sessions INTEGER DEFAULT 0,
    is_expressive BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_voice_baselines_user_id
    ON public.voice_baselines(user_id);

ALTER TABLE public.voice_baselines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanıcı kendi ses baseline'ını okuyabilir"
    ON public.voice_baselines FOR SELECT
    USING (auth.uid()::text = user_id);

CREATE POLICY "Sistem ses baseline güncelleyebilir"
    ON public.voice_baselines FOR ALL
    USING (auth.uid()::text = user_id OR auth.role() = 'authenticated');

-- 3. Object Tracking — (optional: persistence için DB'ye yazılabilir, şu an in-memory)
-- Gözlemi kolaylaştırmak için session'da persistent threat'ler kaydedebiliriz
CREATE TABLE IF NOT EXISTS public.threat_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    object_name TEXT NOT NULL,
    risk_level TEXT NOT NULL, -- yuksek | orta | davranissal | dusuk
    duration_seconds INTEGER,
    first_seen_at TIMESTAMPTZ DEFAULT NOW(),
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT threat_logs_unique UNIQUE (user_id, session_id, object_name)
);

CREATE INDEX IF NOT EXISTS idx_threat_logs_user_id
    ON public.threat_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_threat_logs_session_id
    ON public.threat_logs(session_id);

ALTER TABLE public.threat_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanıcı kendi threat loglarını okuyabilir"
    ON public.threat_logs FOR SELECT
    USING (auth.uid()::text = user_id);

-- Sprint 1 complete!
