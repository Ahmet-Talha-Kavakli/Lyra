-- Migration: Terapötik Hipotez Motoru için sütunlar
-- Supabase SQL Editor'da çalıştır

ALTER TABLE psychological_profiles
    ADD COLUMN IF NOT EXISTS therapeutic_hypothesis TEXT,
    ADD COLUMN IF NOT EXISTS hypothesis_updated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS hypothesis_session_count INTEGER;
