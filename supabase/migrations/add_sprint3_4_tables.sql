-- Sprint 3 & 4: Alliance, Safety, Ethical Tables
-- Rupture/Repair logging, Safety plans, Ethics tracking

-- 1. Rupture & Repair Logging — terapötik ilişkideki kopuşlar
CREATE TABLE IF NOT EXISTS public.rupture_repair_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    severity TEXT NOT NULL, -- mild | moderate | severe
    triggers JSONB DEFAULT '[]',
    repair_action TEXT, -- acknowledged | validated | resolved
    resolved BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT rupture_log_unique UNIQUE (user_id, detected_at)
);

CREATE INDEX IF NOT EXISTS idx_rupture_log_user_id
    ON public.rupture_repair_log(user_id);

CREATE INDEX IF NOT EXISTS idx_rupture_log_severity
    ON public.rupture_repair_log(severity);

ALTER TABLE public.rupture_repair_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanıcı kendi rupture loglarını okuyabilir"
    ON public.rupture_repair_log FOR SELECT
    USING (auth.uid()::text = user_id);

-- 2. Safety Plans — self-harm, suicide riski yönetimi
CREATE TABLE IF NOT EXISTS public.safety_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    risk_level TEXT NOT NULL, -- low | moderate | high | critical
    indicators JSONB DEFAULT '[]',
    status TEXT DEFAULT 'active', -- active | resolved | archived
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT safety_plan_unique UNIQUE (user_id, created_at)
);

CREATE INDEX IF NOT EXISTS idx_safety_plans_user_id
    ON public.safety_plans(user_id);

CREATE INDEX IF NOT EXISTS idx_safety_plans_risk_level
    ON public.safety_plans(risk_level);

ALTER TABLE public.safety_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanıcı kendi safety planlarını okuyabilir"
    ON public.safety_plans FOR SELECT
    USING (auth.uid()::text = user_id);

-- 3. Cultural Profiles — kültürel bağlam ve tercihler
CREATE TABLE IF NOT EXISTS public.cultural_profiles (
    user_id TEXT PRIMARY KEY,
    religiosity TEXT DEFAULT 'unknown', -- low | moderate | high
    family_orientation TEXT DEFAULT 'moderate', -- independence_seeking | moderate | high_dependence
    gender_role TEXT DEFAULT 'modern', -- traditional | moderate | modern
    shame_level TEXT DEFAULT 'moderate', -- low | moderate | high
    tabu_topics JSONB DEFAULT '[]',
    cultural_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cultural_profiles_user_id
    ON public.cultural_profiles(user_id);

ALTER TABLE public.cultural_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Kullanıcı kendi kültürel profilini okuyabilir"
    ON public.cultural_profiles FOR SELECT
    USING (auth.uid()::text = user_id);

-- 4. Ethical Tracking — scope violations, referrals, boundary crossings
CREATE TABLE IF NOT EXISTS public.ethical_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    incident_type TEXT NOT NULL, -- scope_violation | referral_needed | boundary_crossing | out_of_scope
    category TEXT, -- medical_diagnosis | medication | legal | religious | etc
    severity TEXT DEFAULT 'low', -- low | medium | high
    action_taken TEXT,
    referred_to TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT ethical_tracking_unique UNIQUE (user_id, created_at)
);

CREATE INDEX IF NOT EXISTS idx_ethical_tracking_user_id
    ON public.ethical_tracking(user_id);

CREATE INDEX IF NOT EXISTS idx_ethical_tracking_type
    ON public.ethical_tracking(incident_type);

ALTER TABLE public.ethical_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Sistem etik takibi yapabilir"
    ON public.ethical_tracking FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' OR auth.uid()::text = user_id);

-- Sprint 3 & 4 complete!
