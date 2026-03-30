/**
 * Episodic Memory Schema
 *
 * Enables Lyra to "remember" what happened in past sessions
 * and recognize patterns: "Last time you talked about X, your face did Y"
 *
 * Uses pgvector for semantic similarity search:
 * - Store embeddings of patient speech + somatic state
 * - Find similar moments from history
 * - Generate contextual insights
 */

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- ════════════════════════════════════════════════════════════
-- TABLE: memory_fragments
-- Stores individual moments from therapy sessions
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS memory_fragments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    transcript TEXT NOT NULL,
    somatic_markers JSONB NOT NULL,
    congruence_analysis JSONB,
    temporal_patterns JSONB,
    transcript_embedding vector(1536),
    topics TEXT[] DEFAULT '{}',
    emotional_themes TEXT[] DEFAULT '{}'
);

CREATE INDEX idx_memory_user ON memory_fragments(user_id);
CREATE INDEX idx_memory_session ON memory_fragments(session_id);
CREATE INDEX idx_memory_created ON memory_fragments(created_at DESC);
CREATE INDEX idx_memory_embedding ON memory_fragments USING ivfflat (transcript_embedding vector_cosine_ops);

-- ════════════════════════════════════════════════════════════
-- TABLE: memory_connections
-- Links similar moments across sessions
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS memory_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    memory_fragment_1_id UUID NOT NULL REFERENCES memory_fragments(id) ON DELETE CASCADE,
    memory_fragment_2_id UUID NOT NULL REFERENCES memory_fragments(id) ON DELETE CASCADE,
    similarity_score FLOAT NOT NULL,
    connection_type TEXT,
    clinical_insight TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_connections_user ON memory_connections(user_id);
CREATE INDEX idx_connections_score ON memory_connections(similarity_score DESC);

-- ════════════════════════════════════════════════════════════
-- TABLE: therapeutic_themes
-- Patterns that emerge across sessions
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS therapeutic_themes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    theme_name TEXT NOT NULL,
    frequency INT DEFAULT 1,
    session_ids TEXT[] DEFAULT '{}',
    somatic_signature JSONB,
    emotional_patterns TEXT[] DEFAULT '{}',
    last_occurrence TIMESTAMP WITH TIME ZONE,
    intensity_trend FLOAT DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, theme_name)
);

CREATE INDEX idx_themes_user ON therapeutic_themes(user_id);
CREATE INDEX idx_themes_frequency ON therapeutic_themes(frequency DESC);
CREATE INDEX idx_themes_last ON therapeutic_themes(last_occurrence DESC);

-- ════════════════════════════════════════════════════════════
-- TABLE: somatic_signatures
-- Stores the "body language signature" of emotions for this patient
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS somatic_signatures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    emotion_or_state TEXT NOT NULL,
    typical_action_units JSONB,
    typical_prosody JSONB,
    typical_movement JSONB,
    consistency_score FLOAT,
    observation_count INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, emotion_or_state)
);

CREATE INDEX idx_signature_user ON somatic_signatures(user_id);
CREATE INDEX idx_signature_emotion ON somatic_signatures(emotion_or_state);

-- ════════════════════════════════════════════════════════════
-- TABLE: session_insights
-- High-level summaries of what happened in each session
-- ════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS session_insights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL UNIQUE,
    user_id TEXT NOT NULL,
    primary_themes TEXT[] DEFAULT '{}',
    emotional_trajectory JSONB,
    breakthroughs TEXT[] DEFAULT '{}',
    somatic_observations JSONB,
    recommendations TEXT,
    depth_score FLOAT DEFAULT 0.5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_insights_user ON session_insights(user_id);
CREATE INDEX idx_insights_depth ON session_insights(depth_score DESC);

-- ════════════════════════════════════════════════════════════
-- Trigger for updating therapeutic_themes
-- ════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION update_therapeutic_themes()
RETURNS TRIGGER AS $$
DECLARE
    theme_name TEXT;
BEGIN
    IF NEW.topics IS NOT NULL AND array_length(NEW.topics, 1) > 0 THEN
        FOREACH theme_name IN ARRAY NEW.topics LOOP
            INSERT INTO therapeutic_themes (user_id, theme_name, frequency, session_ids, last_occurrence, created_at, updated_at)
            VALUES (NEW.user_id, theme_name, 1, ARRAY[NEW.session_id], NEW.created_at, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, theme_name) DO UPDATE SET
                frequency = therapeutic_themes.frequency + 1,
                session_ids = array_append(therapeutic_themes.session_ids, NEW.session_id),
                last_occurrence = NEW.created_at,
                updated_at = CURRENT_TIMESTAMP;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_therapeutic_themes
AFTER INSERT ON memory_fragments
FOR EACH ROW
EXECUTE FUNCTION update_therapeutic_themes();
