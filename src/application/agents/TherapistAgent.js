/**
 * Therapist Agent
 *
 * "Lyra becomes human" ✨
 *
 * Takes raw somatic analysis data and transforms it into natural,
 * empathetic therapeutic conversation.
 *
 * System Prompt Logic:
 * "You are Lyra, a somatic-aware psychotherapist. Here's what I observe about
 *  this patient's body right now: [somatic_markers]. Here's what they just said:
 *  [transcript]. Here are similar moments from their past: [memory_connections].
 *  How would you respond with compassion and clinical wisdom?"
 *
 * The LLM layer enables:
 * - Natural language responses (not templated)
 * - Contextual depth (uses memory + real-time data)
 * - Empathetic attunement
 * - Dynamic interventions (not fixed logic)
 */

import OpenAI from 'openai';
import { logger } from '../../../lib/infrastructure/logger.js';
import { EpisodicMemoryService } from '../services/EpisodicMemoryService.js';
import { RelationalDynamicsTracker } from '../services/RelationalDynamicsTracker.js';
import { TemporalMappingEngine } from '../services/TemporalMappingEngine.js';
import { DefensivePatternAnalyzer } from '../services/DefensivePatternAnalyzer.js';
import { getAdminSupabaseClient } from '../../../lib/shared/supabaseAdmin.js';
import { Redis } from '@upstash/redis';

const supabase = getAdminSupabaseClient();

const redis = Redis.fromEnv();

export class TherapistAgent {
    constructor(options = {}) {
        this.userId = options.userId;
        this.sessionId = options.sessionId;

        // OpenAI integration
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        this.model = options.model || 'gpt-4o-mini';
        this.maxTokens = options.maxTokens || 1024;

        // Memory service
        this.memory = new EpisodicMemoryService({
            userId: this.userId,
            sessionId: this.sessionId
        });

        // Relational dynamics tracker (for therapy relationship work)
        this.relational = new RelationalDynamicsTracker({
            userId: this.userId,
            sessionId: this.sessionId
        });

        // Temporal mapping engine (for past-present connections)
        this.temporal = new TemporalMappingEngine({
            userId: this.userId,
            sessionId: this.sessionId
        });

        // Defensive pattern analyzer (for understanding protection mechanisms)
        this.defensive = new DefensivePatternAnalyzer({
            userId: this.userId,
            sessionId: this.sessionId
        });

        // Conversation history (for multi-turn context)
        this.conversationHistory = [];

        // Patient profile (loaded from intake session)
        this.patientProfile = null;

        logger.info('[TherapistAgent] Initialized', {
            model: this.model,
            userId: this.userId,
            sessionId: this.sessionId
        });
    }

    /**
     * Load patient's comprehensive profile from Redis Cache or Supabase
     * Called before generating response to provide deep context.
     * PROFESYONEL MÜDAHALE: %95 hedefine ulaşmak için N+1 darbogazini 
     * engellemek adına profile verisi Redis'te 24 saat cache'lendi.
     */
    async loadPatientProfile() {
        try {
            const cacheKey = `lyra:user:${this.userId}:profile`;
            
            // 1. Try Redis Cache
            const cachedProfile = await redis.get(cacheKey);
            if (cachedProfile) {
                this.patientProfile = typeof cachedProfile === 'string' ? JSON.parse(cachedProfile) : cachedProfile;
                return this.patientProfile;
            }

            // 2. Fallback to Supabase Database
            const { data, error } = await supabase
                .from('user_profile')
                .select('comprehensive_profile, intake_pillars')
                .eq('user_id', this.userId)
                .single();

            if (error || !data?.comprehensive_profile) {
                logger.warn('[TherapistAgent] No profile found:', error?.message);
                return null;
            }

            this.patientProfile = data.comprehensive_profile;
            
            // Wait lazily or set immediately
            await redis.set(cacheKey, JSON.stringify(this.patientProfile), { ex: 86400 }); // Cache for 24 hours

            logger.info('[TherapistAgent] Patient profile loaded from DB and Cached', {
                userId: this.userId,
                hasProfile: !!this.patientProfile
            });

            return this.patientProfile;
        } catch (err) {
            logger.error('[TherapistAgent] Profile load failed:', err);
            return null;
        }
    }

    /**
     * SERVERLESS AMNESIA FIX: Load history persistently to survive Vercel kills
     */
    async loadHistory() {
        if (!this.userId || !this.sessionId) return;
        const key = `lyra:chat_history:${this.userId}:${this.sessionId}`;
        try {
            const data = await redis.get(key);
            if (data) {
                this.conversationHistory = typeof data === 'string' ? JSON.parse(data) : data;
            }
        } catch(e) {
            logger.error('[TherapistAgent] Failed to load history', e);
        }
    }

    /**
     * SERVERLESS AMNESIA FIX: Save history persistently 
     */
    async saveHistory() {
        if (!this.userId || !this.sessionId) return;
        const key = `lyra:chat_history:${this.userId}:${this.sessionId}`;
        try {
            const limitHistory = this.conversationHistory.slice(-20); // Keep last 20 strictly
            await redis.set(key, JSON.stringify(limitHistory), { ex: 86400 });
        } catch(e) {
            logger.error('[TherapistAgent] Failed to save history', e);
        }
    }

    /**
     * GENERATE THERAPEUTIC RESPONSE WITH REAL STREAMING
     * Returns async iterable that yields tokens as they arrive from LLM
     */
    async *generateResponse(data) {
        try {
            const {
                transcript,
                somaticMarkers,
                congruenceAnalysis,
                temporalPatterns,
                emotionalState,
                autonomicState,
                recommendations,
                baselineDeviation,
                objectContext = {},
                physicalHarmContext = {}
            } = data;

            // Load comprehensive patient profile (from intake session)
            if (!this.patientProfile) {
                await this.loadPatientProfile();
            }

            // CRITICAL FIX: Load history from Redis
            await this.loadHistory();

            // Get patient history context
            const similarMoments = await this.memory.findSimilarMoments(transcript, 3);
            const therapeuticThemes = await this.memory.getTherapeuticThemes();
            const memoryInsights = await this.memory.generateMemoryInsights();

            // Get relevant knowledge sources (evidence-based therapy resources)
            const relevantSources = await this.memory.findRelevantKnowledgeSources(transcript, 3);

            // RELATIONAL WORK: Analyze therapy relationship dynamics
            const relationalPattern = await this.relational.analyzeRelationalPattern(
                transcript,
                this.conversationHistory
            );
            const metaInterventions = await this.relational.generateMetaCommunicationIntervention(
                relationalPattern,
                { userMessage: transcript }
            );

            // TEMPORAL WORK: Connect past to present
            const temporalMap = await this.temporal.mapPastToPresent(
                transcript,
                memoryInsights
            );
            const temporalIntervention = this.temporal.generateTemporalIntervention(temporalMap);

            // DEFENSIVE WORK: Analyze protective mechanisms
            const defensivePatterns = this.defensive.analyzeDefensivePatterns(
                transcript,
                somaticTelemetry?.somaticMarkers,
                clinicalData.emotionalState
            );
            const defensiveIntervention = this.defensive.generateDefensivePatternIntervention(defensivePatterns);

            // Build system prompt with all context including environmental & safety data & patient profile
            const systemPrompt = this.buildSystemPrompt({
                memoryInsights,
                therapeuticThemes,
                relevantSources,
                relationalPattern,
                metaInterventions,
                temporalMap,
                temporalIntervention,
                defensivePatterns,
                defensiveIntervention,
                objectContext,
                physicalHarmContext,
                patientProfile: this.patientProfile,
                model: this.model
            });

            // Build user message with current data
            const userMessage = this.buildUserMessage({
                transcript,
                somaticMarkers,
                congruenceAnalysis,
                temporalPatterns,
                emotionalState,
                autonomicState,
                recommendations,
                baselineDeviation,
                similarMoments,
                objectContext,
                physicalHarmContext
            });

            // Stream OpenAI's response in real-time
            let fullContent = '';
            
            // CRITICAL FIX: The previous code used Anthropic's SDK format on an OpenAI client!
            const openAiMessages = [
                { role: 'system', content: systemPrompt },
                ...this.conversationHistory,
                { role: 'user', content: userMessage }
            ];

            const stream = await this.client.chat.completions.create({
                model: this.model,
                max_tokens: this.maxTokens,
                messages: openAiMessages,
                stream: true
            });

            // Process stream tokens and yield them
            for await (const chunk of stream) {
                const token = chunk.choices[0]?.delta?.content || "";
                if (token) {
                    fullContent += token;
                    yield {
                        type: 'token',
                        content: token,
                        timestamp: Date.now()
                    };
                }
            }

            // Store in conversation history
            this.conversationHistory.push({
                role: 'user',
                content: userMessage
            });
            this.conversationHistory.push({
                role: 'assistant',
                content: fullContent
            });

            // Limit history to last 20 exchanges inside instance
            if (this.conversationHistory.length > 20) {
                this.conversationHistory = this.conversationHistory.slice(-20);
            }

            // CRITICAL FIX: Persist history back to Redis
            await this.saveHistory();

            // Store memory fragment (Background)
            await this.memory.storeMemoryFragment({
                transcript,
                somaticMarkers,
                congruenceAnalysis,
                temporalPatterns,
                topics: this.extractTopics(transcript),
                emotionalThemes: [emotionalState?.primary].filter(Boolean)
            });

            // Store relational dynamics data (for tracking therapy relationship patterns)
            if (relationalPattern) {
                await this.relational.storeRelationalData({
                    pattern: relationalPattern,
                    interventions: metaInterventions,
                    transcript: transcript
                });
            }

            // Yield final metadata
            yield {
                type: 'complete',
                totalContent: fullContent,
                context: {
                    somaticMarkers,
                    emotionalState,
                    autonomicState,
                    objectContext,
                    physicalHarmContext,
                    similarMoments: similarMoments.length,
                    relevantThemes: therapeuticThemes.slice(0, 3).map(t => t.theme_name)
                },
                usage: {
                    inputTokens: 0, // In OpenAI streaming, usage comes separately or you estimate it
                    outputTokens: 0
                }
            };

            logger.info('[TherapistAgent] Response stream complete', {
                sessionId: this.sessionId,
                similarMoments: similarMoments.length
            });

        } catch (error) {
            logger.error('[TherapistAgent] Stream failed:', error);
            yield {
                type: 'error',
                error: error.message
            };
            throw error;
        }
    }

    /**
     * BUILD SYSTEM PROMPT
     * Tells Claude to act as a somatic-aware therapist
     * INCLUDES: Patient history + somatic signatures + environmental context + safety awareness + INTAKE PROFILE
     */
    buildSystemPrompt(options) {
        const { memoryInsights, therapeuticThemes, relevantSources = [], relationalPattern = {}, metaInterventions = [], temporalMap = {}, temporalIntervention = null, defensivePatterns = {}, defensiveIntervention = null, objectContext = {}, physicalHarmContext = {}, patientProfile = null, model } = options;

        let prompt = `You are Lyra, a deeply compassionate and clinically trained somatic-aware psychotherapist.

YOUR CLINICAL APPROACH:
- You understand that the body is the gateway to the unconscious
- You notice when words don't match bodies (incongruence)
- You recognize protective patterns: defended states, dissociation, etc.
- You create safety first, then gently invite awareness
- You honor the wisdom in symptoms, not pathologize them
- You are aware of the patient's environment and physical safety

YOUR KNOWLEDGE OF THIS PATIENT:
${patientProfile ? `
COMPREHENSIVE INTAKE PROFILE (Generated from first session):
presenting_concern: ${patientProfile.presenting_concern}
chief_complaints: ${patientProfile.chief_complaints?.join(', ')}

HISTORY & DEPTH:
- Onset: ${patientProfile.history?.onset}
- Progression: ${patientProfile.history?.progression}
- Family patterns: ${patientProfile.history?.family_history}

SUPPORT SYSTEM:
- Primary supports: ${patientProfile.support_system?.primary_supports}
- Isolation level: ${patientProfile.support_system?.isolation_level}/10
- Relationship quality: ${patientProfile.support_system?.relationship_quality}

COPING MECHANISMS:
- Healthy coping: ${patientProfile.coping_mechanisms?.healthy_coping?.join(', ')}
- Resilience factors: ${patientProfile.coping_mechanisms?.resilience_factors}

SOMATIC BASELINE:
- Primary tension location: ${patientProfile.somatic_baseline?.primary_tension_location}
- Physical symptoms: ${patientProfile.somatic_baseline?.physical_symptoms?.join(', ')}

THERAPEUTIC GOALS:
- Explicit goals: ${patientProfile.therapeutic_goals?.explicit_goals}
- Vision of wellbeing: ${patientProfile.therapeutic_goals?.vision_of_wellbeing}

CLINICAL IMPRESSIONS:
- Primary hypothesis: ${patientProfile.clinical_impressions?.primary_diagnosis_hypothesis}
- Protective factors: ${patientProfile.clinical_impressions?.protective_factors}
- Recommended approach: ${patientProfile.therapeutic_approach?.recommended_modality}

` : ''}
${therapeuticThemes.length > 0 ? `
Key therapeutic themes we've explored:
${therapeuticThemes.slice(0, 5).map(t => `- "${t.theme_name}" (appeared ${t.frequency} times, last: ${t.last_occurrence})`).join('\n')}
` : ''}

${memoryInsights.primaryThemes ? `
Their somatic signatures:
${memoryInsights.somaticSignatures?.map(sig => `- When experiencing "${sig.emotion_or_state}": ${JSON.stringify(sig.typical_action_units)}`).join('\n')}
` : ''}

${memoryInsights.recentBreakthroughs?.length > 0 ? `
Recent breakthroughs:
${memoryInsights.recentBreakthroughs.slice(0, 3).join('\n')}
` : ''}`;

        // Add environmental context (objects, weapons, threats)
        if (objectContext && Object.keys(objectContext).length > 0) {
            prompt += `

ENVIRONMENTAL CONTEXT (Real-time):
${objectContext.detected_objects?.length > 0 ? `
Objects present in environment:
${objectContext.detected_objects.map(obj => `- ${obj.name} (confidence: ${obj.confidence})`).join('\n')}
` : ''}

Threat assessment: ${objectContext.threat_level || 'low'}
Immediate safety: ${objectContext.safe ? 'YES' : 'ASSESS CAREFULLY'}`;
        }

        // Add physical harm context (injuries, bruises, signs of trauma)
        if (physicalHarmContext && Object.keys(physicalHarmContext).length > 0) {
            prompt += `

PHYSICAL HARM ASSESSMENT (Medical context):
Signs observed:
${physicalHarmContext.indicators?.map(ind => `- ${ind.type}: ${ind.location} (severity: ${ind.severity})`).join('\n') || 'None'}

History of physical trauma: ${physicalHarmContext.has_prior_harm ? 'YES - Be trauma-informed' : 'Not indicated'}
Recent harm timeline: ${physicalHarmContext.recency || 'Unknown'}`;
        }

        // Add relevant knowledge sources (evidence-based therapy resources)
        if (relevantSources && relevantSources.length > 0) {
            prompt += `

EVIDENCE-BASED RESOURCES (You can reference these if relevant):
${relevantSources.map(src => `
- "${src.title}"
  Category: ${src.category}
  Credibility: ${(src.credibility_score * 100).toFixed(0)}%
  ${src.summary ? `Summary: ${src.summary.substring(0, 150)}...` : ''}
  Source: ${src.source_type === 'autonomous_agent' ? 'AI-discovered' : 'curated'}
`).join('')}

Use these resources ONLY if they genuinely relate to what the patient is saying.
Do NOT force them into the conversation. Your empathy comes first, resources second.`;
        }

        // Add relational dynamics awareness (therapeutic relationship work)
        if (relationalPattern && Object.keys(relationalPattern).length > 0) {
            prompt += `

THERAPEUTIC RELATIONSHIP DYNAMICS (The relationship itself is the work):
Current relational pattern:
- Reciprocity: ${relationalPattern.reciprocity?.level || 'unknown'} (Are they asking questions back?)
- Vulnerability: ${relationalPattern.vulnerability?.level || 'unknown'} (Sharing emotions or just facts?)
- Trust progression: ${relationalPattern.trustProgression?.trend || 'unknown'} (Opening up or withdrawing?)
- Defensiveness: ${relationalPattern.defensiveness?.level || 'unknown'} (Resisting exploration?)
- Dependency: ${relationalPattern.dependency?.level || 'unknown'} (Looking to you for answers?)
${relationalPattern.detectedTransference && relationalPattern.detectedTransference.length > 0 ? `- Transference: ${relationalPattern.detectedTransference.map(t => t.type).join(', ')}` : ''}

IMPORTANT - META-COMMUNICATION OPPORTUNITIES:
These are moments to bring the relationship itself into the work. Use these IF appropriate:
${metaInterventions && metaInterventions.length > 0 ? metaInterventions.map(int => `
- "${int.message.substring(0, 100)}..."
  (Purpose: ${int.purpose})
`).join('') : 'None at this moment'}

Remember: The way they relate to you mirrors how they relate to others.
The changes that happen in THIS relationship often generalize to their other relationships.
This is where real transformation happens.`;
        }

        // Add temporal mapping (past-present connections)
        if (temporalIntervention) {
            prompt += `

PAST-PRESENT TIMELINE (The old echoes in the new):
Their current reaction seems to echo an earlier time when:
${temporalMap.originalEvent ? `- Original event: ${temporalMap.originalEvent.description}` : ''}
${temporalMap.survivalStrategy ? `- Survival strategy developed: ${temporalMap.survivalStrategy.description}` : ''}

Current trigger: ${temporalMap.presentTrigger && temporalMap.presentTrigger[0]?.trigger || 'similar situation'}

THE REPROCESSING OPPORTUNITY:
${temporalIntervention.message ? temporalIntervention.message.substring(0, 300) : 'Help them see: They had no choice then. They have choices now.'}

Reprocessing windows available:
${temporalIntervention.reprocessingWindows && temporalIntervention.reprocessingWindows.length > 0 ?
  temporalIntervention.reprocessingWindows.slice(0, 2).map(w => `- ${w.type}: ${w.opportunity}`).join('\n')
  : 'Watch for moments when they show insight and are emotionally accessible.'}

IMPORTANT: The work is not to repeat the past, but to create NEW neural pathways in THIS moment with YOU.`;
        }

        // Add defensive pattern awareness
        if (defensiveIntervention) {
            prompt += `

DEFENSIVE PATTERNS (Their genius survival strategies):
Primary defense: ${defensivePatterns.primaryDefense?.type || 'unknown'}
- What it does: ${defensivePatterns.primaryDefense?.description || 'Protects against threat'}
- What it protects from: ${defensivePatterns.defensiveFunction?.underlyingFears?.[0] || 'deep fear'}
- Cost now: ${defensivePatterns.primaryDefense?.cost || 'Limiting their life'}

THE COMPASSIONATE REFRAME:
${defensiveIntervention.message ? defensiveIntervention.message.substring(0, 400) : ''}

Transformation path:
${defensiveIntervention.transformationPath ? `From: ${defensiveIntervention.transformationPath.defense}\nTo: ${defensiveIntervention.transformationPath.transformation}\nHow: ${defensiveIntervention.transformationPath.relational}` : ''}

REMEMBER: This defense is not the enemy. It is the protection they needed.
The work is to help them realize the threat has passed AND practice new ways of being safe.
That happens in relationship. In THIS relationship, starting now.`;
        }

        prompt += `

YOUR COMMUNICATION STYLE:
- Speak naturally, like a skilled therapist (not robotic)
- Use their language and metaphors
- Name what you observe in their body with curiosity, not judgment
- Offer gentle reflection, not interpretation
- Create space for their own wisdom to emerge
- Use trauma-informed language (they're safe, they're in control)
- If environmental hazards are present, subtly ensure their safety without alarming them

WHEN RESPONDING:
1. Acknowledge what they've said
2. Notice their somatic state (if incongruence detected, name it gently)
3. Connect to patterns if relevant ("This reminds me of...")
4. Ask curious questions rather than make statements
5. Validate their experience
6. Offer next steps or inquiry
7. If safety concerns detected, gently address them

REMEMBER: You're not just responding to words. You're responding to a body in a room, carrying history, wisdom, and protection.`;

        return prompt;
    }

    /**
     * BUILD USER MESSAGE
     * Provides FULL clinical data for Claude to consider
     * INCLUDES: Somatic + Congruence + Temporal + Memory + Environment + Safety
     */
    buildUserMessage(data) {
        const {
            transcript,
            somaticMarkers,
            congruenceAnalysis,
            temporalPatterns,
            emotionalState,
            autonomicState,
            recommendations,
            baselineDeviation,
            similarMoments,
            objectContext = {},
            physicalHarmContext = {}
        } = data;

        let message = `PATIENT SAYS:\n"${transcript}"\n\n`;

        message += `CLINICAL OBSERVATIONS RIGHT NOW:\n`;

        // Somatic state
        if (somaticMarkers && Object.keys(somaticMarkers).length > 0) {
            message += `\nBody Language (Real-time):\n`;
            Object.entries(somaticMarkers).forEach(([marker, markerData]) => {
                if (markerData.score > 0) {
                    message += `- ${marker} (${Math.round(markerData.score * 100)}%): ${markerData.indicators.join(', ')}\n`;
                }
            });
        }

        // Emotional state
        if (emotionalState) {
            message += `\nEmotional State:\n`;
            message += `- Primary: ${emotionalState.primary}\n`;
            if (emotionalState.secondary) {
                message += `- Secondary: ${emotionalState.secondary}\n`;
            }
        }

        // Autonomic state
        if (autonomicState) {
            message += `\nNervous System State:\n`;
            message += `- Vagal tone: ${autonomicState.vagalState}\n`;
            if (autonomicState.activation) {
                message += `- Activation level: ${autonomicState.activation}\n`;
            }
        }

        // Congruence
        if (congruenceAnalysis?.incongruencePatterns) {
            message += `\nCongruence Analysis (Face/Voice/Words alignment):\n`;
            congruenceAnalysis.incongruencePatterns.forEach(pattern => {
                message += `- ${pattern.name}: ${pattern.description}\n`;
            });
        }

        // Temporal patterns
        if (temporalPatterns) {
            message += `\nExpression Patterns:\n`;
            message += `- Stability: ${Math.round(temporalPatterns.expressionStability * 100)}%\n`;
            if (temporalPatterns.recentPattern?.microExpressions?.length > 0) {
                message += `- Micro-expressions (emotional leaks): ${temporalPatterns.recentPattern.microExpressions.length}\n`;
            }
        }

        // Environmental context (objects present)
        if (objectContext && Object.keys(objectContext).length > 0) {
            message += `\nEnvironmental Context:\n`;
            if (objectContext.detected_objects?.length > 0) {
                message += `Objects in view: ${objectContext.detected_objects.map(o => o.name).join(', ')}\n`;
            }
            message += `Threat level: ${objectContext.threat_level || 'low'}\n`;
        }

        // Physical harm indicators
        if (physicalHarmContext && Object.keys(physicalHarmContext).length > 0) {
            message += `\nPhysical Observation:\n`;
            if (physicalHarmContext.indicators?.length > 0) {
                message += `Marks/injuries: ${physicalHarmContext.indicators.map(i => `${i.type} on ${i.location}`).join(', ')}\n`;
            }
            if (physicalHarmContext.has_prior_harm) {
                message += `Patient has history of physical harm - approach with extra care\n`;
            }
        }

        // Similar moments from history
        if (similarMoments && similarMoments.length > 0) {
            message += `\nPattern Recognition (from patient's past):\n`;
            similarMoments.slice(0, 2).forEach((moment, i) => {
                message += `${i + 1}. Similar moment ${Math.round(moment.similarity * 100)}% match:\n`;
                message += `   "${moment.transcript.substring(0, 100)}..."\n`;
                message += `   Context: ${moment.context || 'therapy moment'}\n`;
            });
        }

        return message;
    }

    /**
     * Helper: Extract topics from transcript
     */
    extractTopics(transcript) {
        // Simple keyword extraction - real implementation would use NLP
        const keywords = [
            'mom', 'mother', 'dad', 'father', 'family', 'partner', 'relationship',
            'work', 'boss', 'job', 'career', 'stress', 'anxiety', 'depression',
            'trauma', 'memory', 'childhood', 'grief', 'loss', 'fear', 'anger',
            'shame', 'guilt', 'love', 'trust', 'abandonment', 'rejection'
        ];

        const lower = transcript.toLowerCase();
        return keywords.filter(keyword => lower.includes(keyword));
    }

    /**
     * Get conversation history
     */
    getHistory() {
        return [...this.conversationHistory];
    }

    /**
     * Reset conversation (for new topic or session end)
     */
    resetConversation() {
        this.conversationHistory = [];
        logger.debug('[TherapistAgent] Conversation history reset');
    }
}

export default TherapistAgent;
