-- Migration: Ev Ödevi Takip Sistemi
-- Supabase SQL Editor'da çalıştır

CREATE TABLE IF NOT EXISTS homework_assignments (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         TEXT NOT NULL,
    session_id      TEXT,
    title           TEXT NOT NULL,
    description     TEXT NOT NULL,
    category        TEXT NOT NULL DEFAULT 'farkındalık',
    status          TEXT NOT NULL DEFAULT 'pending', -- pending | completed | skipped | partial
    user_note       TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_homework_user_status ON homework_assignments (user_id, status);

-- RLS
ALTER TABLE homework_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "homework_owner_access" ON homework_assignments
    FOR ALL USING (auth.uid()::text = user_id);
