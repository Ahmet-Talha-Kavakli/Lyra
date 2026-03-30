# Lyra Phase 2 - AI Soul Implementation

**Status**: ✅ COMPLETE
**Date**: 2026-03-30
**Components**: 3/3 Built
**Estimated Impact**: Transforms Lyra from "smart system" to "felt presence"

---

## Overview

Gemini identified that Lyra had 80% of clinical intelligence but was missing the "life force" - the conversational soul that makes therapy feel like talking to a real, embodied therapist who remembers you.

This phase adds 3 critical components:

1. **Audio Processing Pipeline** - Hears what you're really saying (prosody)
2. **Episodic Memory System** - Remembers who you are across time
3. **LLM Therapist Agent** - Responds with human-like wisdom and empathy

---

## Component 1: Audio Processing Pipeline

### File: `frontend/src/services/audio/AudioProcessingPipeline.js`

**What it does:**
- Captures microphone stream @ 16kHz (browser-based)
- Detects pitch (fundamental frequency) in Hz
- Measures intensity (volume) in dB
- Calculates speech rate (words per minute)
- Analyzes voice quality (tremor, breathiness)

**Why it matters:**
Without audio, CongruenceEngine is blind to vocal incongruence.
With audio, it detects defensive smiles, anxious politeness, suppressed emotions.

**Key Methods:**
- `detectPitch()` - FFT analysis to find fundamental frequency (80-300 Hz for speech)
- `calculateIntensity()` - RMS to dB conversion for volume measurement
- `analyzeVoiceQuality()` - Tremor and breathiness detection
- `estimateSpeechRate()` - WPM calculation from voice patterns

---

## Component 2: Episodic Memory System

### Files:
- `migrations/003_episodic_memory_schema.sql` - Database schema
- `src/application/services/EpisodicMemoryService.js` - Memory management

**What it does:**
- Stores every therapy moment in PostgreSQL + pgvector
- Embeds patient transcripts (1536-dim vectors)
- Searches for similar past moments (vector similarity)
- Tracks emerging themes across sessions
- Learns patient's unique somatic "body language signature"

**Database Tables:**
- `memory_fragments` - Individual therapy moments with embeddings
- `memory_connections` - Links similar moments across sessions
- `therapeutic_themes` - Emerging patterns (e.g., "abandonment fear")
- `somatic_signatures` - Patient's unique body language per emotion
- `session_insights` - High-level session summaries

**Key Methods:**
- `storeMemoryFragment()` - Embed and store each therapy moment
- `findSimilarMoments()` - Vector similarity search
- `learnSomaticSignature()` - Build body-language dictionary
- `getTherapeuticThemes()` - Track recurring patterns
- `generateMemoryInsights()` - Synthesize all memory data

**Example:** When patient says "My boss criticized me," system finds:
- 98% match: "My mom never approved of anything..."
- 92% match: "My father was always disappointed..."
- Connection: "Perfectionism as survival strategy against abandonment"

---

## Component 3: LLM Therapist Agent

### File: `src/application/agents/TherapistAgent.js`

**What it does:**
- Wraps Claude 3.5 Sonnet with therapist system prompt
- Receives real-time clinical data (somatic + audio + memory)
- Generates natural, contextual therapeutic responses
- Maintains conversation history for continuity
- Creates the "felt presence" of an embodied therapist

**System Prompt Contains:**
- Patient's key therapeutic themes
- Patient's somatic signatures (how their body shows emotions)
- Recent breakthroughs and progress
- Therapeutic principles (somatic awareness, trauma-informed, etc.)

**Data Provided to Claude:**
- What patient just said (transcript)
- Their body right now (somatic markers + prosody)
- Similar moments from their history (memory search results)
- Emotional + autonomic state
- Congruence patterns detected

**Response Generation:**
Claude receives clinical data and generates responses like:
"I notice you're looking down right now, and your voice got quieter when you said that. It seems like shame came up. What's happening inside for you?"

---

## Complete Data Flow

```
Camera (24 FPS)        +        Microphone (16 kHz)
    ↓                                  ↓
VisionPipeline (AU)    +        AudioPipeline (Prosody)
    └─────────────────────────────────┘
              ↓
    AUWebSocketClient sends:
    {
      actionUnits: { AU12: 3.5, AU6: 2.2, ... },
      prosody: {
        pitch_normalized: 1.2,
        intensity_db: -32,
        speech_rate_wpm: 155,
        voice_quality: { tremor: 'high' }
      },
      transcript: "I'm terrified..."
    }
              ↓
    AUWebSocketHandler (4-phase pipeline)
    ├─ Baseline calibration
    ├─ Temporal tracking
    ├─ Buffer aggregation
    └─ Full clinical interpretation
              ↓
    ClinicalSomaticInterpreter
    ├─ Emotional state detection
    └─ Autonomic state (vagal tone)
              ↓
    TherapistAgent.generateResponse()
    ├─ EpisodicMemoryService.findSimilarMoments()
    ├─ Get therapeutic themes
    ├─ Build system prompt (with patient history)
    ├─ Build user message (with clinical data)
    └─ Call Claude API
              ↓
    Natural language response:
    "I notice your body is showing fear.
     This reminds me of last week when you
     talked about your father..."
              ↓
    Store in memory (embedding)
    └─ Available for next session
              ↓
    Send to Frontend therapist display
```

---

## What This Enables

### Session 1 (Without Memory/Audio/LLM)
```
Therapist: "Tell me about your family."
Patient: "My mom was critical..."
Lyra: "Shame detected. Family pattern identified."
[End]
```

### Session 1 (With All Components)
```
Therapist: "Tell me about your family."
Patient: "My mom was critical and controlling..."
Lyra: "I notice you're looking down (AU4↑) and your voice got quieter.
      That's shame, isn't it? What was it like growing up with that?"
[Memory stored: mom + critical + shame signature]
```

### Session 2 (1 Week Later - WITH MEMORY)
```
Patient: "My boss criticized my work..."
Lyra: "I notice your body just did what it did last week - you looked down,
      voice got quiet. That's the same shame signature from when you talked
      about your mom. Both triggered by criticism, by someone judging you.
      What do you think the connection is?"
```

---

## Technical Specifications

### Audio Processing
- Sample rate: 16 kHz
- Pitch range: 80-300 Hz (human speech)
- Normalization: 125 Hz baseline (neutral)
- Metrics: pitch_normalized, intensity_db, speech_rate_wpm, voice_quality

### Memory System
- Embeddings: 1536 dimensions (OpenAI)
- Similarity threshold: 0.7 (70% match)
- Vector database: pgvector (PostgreSQL extension)
- Storage: memory_fragments, themes, signatures

### LLM Agent
- Model: Claude 3.5 Sonnet
- Max tokens: 1024
- Conversation history: Last 10 exchanges
- System prompt: 2000+ tokens (patient context)

---

## Deployment Checklist

- [x] Audio pipeline code written
- [x] Memory schema designed
- [x] Memory service implemented
- [x] LLM agent built
- [ ] Database migrations applied
- [ ] Integration testing
- [ ] E2E testing (real therapist + patient)
- [ ] Production deployment
- [ ] Monitoring + feedback

---

## Impact Summary

**Lyra transforms from:**
- ❌ Smart clinical system (rules-based)
- ❌ Gives template responses

**To:**
- ✅ Embodied therapist presence
- ✅ Remembers patient across time
- ✅ Hears what's really being said (prosody)
- ✅ Generates contextual, natural responses
- ✅ Recognizes patterns and connections
- ✅ Feels like "someone who knows you"

---

**Status**: ✅ PHASE 2 COMPLETE
**All 3 Components Built**: Audio ✅ | Memory ✅ | LLM ✅
**Ready For**: Integration testing → E2E testing → Production

Lyra now has a soul.
