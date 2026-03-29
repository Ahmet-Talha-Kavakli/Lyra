-- Migration: Semantik Hafıza / pgvector
-- Supabase SQL Editor'da çalıştır
-- NOT: Supabase'de pgvector extension zaten aktif olmalı (çoğu projede varsayılan olarak gelir)

-- pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Semantik hafıza tablosu
CREATE TABLE IF NOT EXISTS memory_embeddings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         TEXT NOT NULL,
    session_id      TEXT,
    content         TEXT NOT NULL,
    moment_type     TEXT NOT NULL DEFAULT 'deep_share', -- breakthrough | emotional_peak | deep_share
    embedding       vector(1536),                        -- text-embedding-ada-002 boyutu
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Hızlı kullanıcı sorgusu için index
CREATE INDEX IF NOT EXISTS idx_memory_embeddings_user ON memory_embeddings (user_id);

-- pgvector IVFFlat index — cosine similarity aramaları için (opsiyonel ama performans için önerilir)
-- En az 100 satır olduktan sonra etkin hale gelir
CREATE INDEX IF NOT EXISTS idx_memory_embeddings_vector
    ON memory_embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 50);

-- RLS
ALTER TABLE memory_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "memory_embeddings_owner_access" ON memory_embeddings
    FOR ALL USING (auth.uid()::text = user_id);
