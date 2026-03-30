/**
 * Somatic Analysis Database Schema
 * Stores all multimodal analysis data
 */

-- Sessions table
CREATE TABLE somatic_sessions (
    id SERIAL PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL,
    user_id UUID NOT NULL,
    started_at TIMESTAMP DEFAULT NOW(),
    ended_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'active',
    duration_seconds INT GENERATED ALWAYS AS (EXTRACT(EPOCH FROM (ended_at - started_at))::INT) STORED,
    notes TEXT
);

CREATE INDEX idx_somatic_sessions_user_id ON somatic_sessions(user_id);
CREATE INDEX idx_somatic_sessions_status ON somatic_sessions(status);

-- Main analysis table
CREATE TABLE somatic_analysis (
    id BIGSERIAL PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES somatic_sessions(session_id),
    user_id UUID NOT NULL,
    timestamp TIMESTAMP DEFAULT NOW(),

    -- FACS Data (Layer 2A)
    facs_action_units TEXT[], -- ['AU6', 'AU12', ...]
    facs_action_unit_intensities JSONB, -- { "AU6": 3, "AU12": 4, ... }
    facs_face_symmetry FLOAT, -- 0-1
    facs_confidence FLOAT, -- 0-1

    -- Prosody Data (Layer 2B)
    prosody_pitch_hz INT,
    prosody_pitch_normalized FLOAT,
    prosody_voice_intensity_db INT,
    prosody_loudness_level VARCHAR(50), -- very_quiet, quiet, normal, loud
    prosody_speech_rate_wpm INT,
    prosody_pattern VARCHAR(50), -- rising, falling, flat
    prosody_vibrato_detected BOOLEAN,
    prosody_voice_quality JSONB, -- { "breathiness": "high", "tension": "low", ... }

    -- Fused State (Layer 3)
    somatic_markers JSONB, -- { "shame": { "score": 0.8, ... }, ... }
    emotional_state_primary VARCHAR(50), -- happiness, sadness, fear, etc
    emotional_state_primary_score FLOAT,
    emotional_state_secondary VARCHAR(50),
    emotional_state_secondary_score FLOAT,
    autonomic_state VARCHAR(50), -- ventral_vagal, sympathetic, dorsal_vagal
    emotional_valence FLOAT, -- -1 (negative) to +1 (positive)
    emotional_arousal FLOAT, -- 0 (low) to 1 (high)

    -- Clinical Interpretation (Layer 4)
    autonomic_therapeutic_readiness VARCHAR(50), -- HIGH, LOW, VERY_LOW
    defensive_patterns TEXT[], -- ['suppression', 'intellectualization', ...]
    trauma_response_detected BOOLEAN,
    trauma_severity_score FLOAT, -- 0-10
    authenticity_is_genuine BOOLEAN,
    authenticity_suppression_level FLOAT,

    -- Temporal analysis
    temporal_trend VARCHAR(50), -- stable, transitioning, escalating
    temporal_stability FLOAT, -- 0-1
    sustained_emotional_state VARCHAR(50),
    sustained_duration_seconds INT,

    -- Full interpretation (JSON for complex data)
    full_interpretation JSONB,
    therapist_guidance JSONB,
    recommendations TEXT[],

    -- Clinical notes
    observation TEXT,
    formulation TEXT,
    plan TEXT,

    -- Metadata
    frame_index INT,
    analysis_latency_ms INT, -- How long the analysis took
    confidence_score FLOAT

);

CREATE INDEX idx_somatic_analysis_session_id ON somatic_analysis(session_id);
CREATE INDEX idx_somatic_analysis_user_id ON somatic_analysis(user_id);
CREATE INDEX idx_somatic_analysis_timestamp ON somatic_analysis(timestamp);
CREATE INDEX idx_somatic_analysis_emotional_state ON somatic_analysis(emotional_state_primary);
CREATE INDEX idx_somatic_analysis_autonomic_state ON somatic_analysis(autonomic_state);

-- Session summary (pre-aggregated for fast queries)
CREATE TABLE somatic_session_summary (
    id SERIAL PRIMARY KEY,
    session_id TEXT UNIQUE NOT NULL REFERENCES somatic_sessions(session_id),
    user_id UUID NOT NULL,

    -- Emotion statistics
    analysis_count INT,
    dominant_emotion VARCHAR(50),
    emotion_distribution JSONB, -- { "sadness": 30, "fear": 20, ... }
    emotion_variability FLOAT, -- How much emotions changed

    -- Autonomic statistics
    dominant_autonomic_state VARCHAR(50),
    autonomic_distribution JSONB, -- { "ventral_vagal": 50, "sympathetic": 30, ... }

    -- Somatic markers
    highest_somatic_marker VARCHAR(50), -- Which marker was strongest
    somatic_marker_scores JSONB, -- { "shame": 0.7, "fear": 0.4, ... }

    -- Processing capacity
    average_emotional_valence FLOAT,
    average_emotional_arousal FLOAT,
    processing_mode VARCHAR(50), -- suppressed, authentic, intense

    -- Clinical synthesis
    primary_defensive_pattern VARCHAR(50),
    defensive_patterns TEXT[],
    trauma_detected BOOLEAN,
    trauma_severity_score FLOAT,

    -- Recommendations
    clinical_note TEXT,
    recommended_interventions TEXT[],
    pacing_recommendation VARCHAR(50), -- move_forward, slow_down, pause

    -- Timing
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_somatic_summary_user_id ON somatic_session_summary(user_id);

-- Temporal patterns (for trend analysis)
CREATE TABLE somatic_temporal_patterns (
    id SERIAL PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES somatic_sessions(session_id),
    user_id UUID NOT NULL,

    -- State transitions
    from_emotion VARCHAR(50),
    to_emotion VARCHAR(50),
    transition_timestamp TIMESTAMP,
    transition_latency_seconds INT, -- How long it took

    -- Trigger analysis
    trigger_event TEXT, -- What caused the change
    trigger_confidence FLOAT, -- How confident we are about the trigger

    -- Pattern info
    pattern_type VARCHAR(50), -- oscillating, escalating, de-escalating
    pattern_frequency INT -- How many times this pattern occurred

);

CREATE INDEX idx_somatic_temporal_session_id ON somatic_temporal_patterns(session_id);

-- Microexpression detection (< 500ms fleeting expressions)
CREATE TABLE somatic_microexpressions (
    id SERIAL PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES somatic_sessions(session_id),
    user_id UUID NOT NULL,

    detected_at TIMESTAMP,
    duration_ms INT, -- Usually < 500ms
    expression_type VARCHAR(50), -- fear_flash, anger_flash, etc
    intensity FLOAT, -- 0-1
    authenticity VARCHAR(50), -- genuine, suppressed
    clinical_significance TEXT -- What does it mean?
);

CREATE INDEX idx_somatic_microexp_session_id ON somatic_microexpressions(session_id);

-- Therapeutic readiness log
CREATE TABLE somatic_therapeutic_readiness (
    id SERIAL PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES somatic_sessions(session_id),
    user_id UUID NOT NULL,

    checked_at TIMESTAMP DEFAULT NOW(),
    vagal_state VARCHAR(50), -- ventral_vagal, sympathetic, dorsal_vagal
    readiness_level VARCHAR(50), -- HIGH, LOW, VERY_LOW
    reason TEXT, -- Why this readiness level
    recommendations TEXT[], -- What to do

    -- For tracking changes
    changed_from_previous BOOLEAN,
    change_magnitude FLOAT -- 0-1, how big was the change
);

CREATE INDEX idx_somatic_readiness_session_id ON somatic_therapeutic_readiness(session_id);
CREATE INDEX idx_somatic_readiness_vagal_state ON somatic_therapeutic_readiness(vagal_state);

-- Grants for queries
GRANT SELECT ON somatic_sessions TO postgres;
GRANT SELECT, INSERT ON somatic_analysis TO postgres;
GRANT SELECT ON somatic_session_summary TO postgres;
GRANT SELECT ON somatic_temporal_patterns TO postgres;
GRANT SELECT ON somatic_microexpressions TO postgres;
GRANT SELECT ON somatic_therapeutic_readiness TO postgres;
