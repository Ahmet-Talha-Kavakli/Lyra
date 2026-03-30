/**
 * Semantic Analyzer - NLP Enhancement
 *
 * Replaces regex-based pattern matching with GPT semantic understanding
 * Detects psychological patterns with context awareness:
 * - Attachment styles (from semantics, not keyword counting)
 * - Schemas (understanding meaning, not pattern matching)
 * - Defenses (recognizing protective mechanisms by context)
 * - Transference (detecting relationship patterns in language)
 * - Shame/trauma language (nuanced understanding)
 *
 * Uses GPT-4 for semantic depth while maintaining clinical validity
 */

import OpenAI from 'openai';
import { logger } from '../../../lib/infrastructure/logger.js';

export class SemanticAnalyzer {
    constructor(options = {}) {
        this.userId = options.userId;
        this.sessionId = options.sessionId;

        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        this.model = options.model || 'gpt-4o-mini';
        this.cacheMode = options.cacheMode !== false; // Prompt caching for efficiency

        logger.info('[SemanticAnalyzer] Initialized', {
            userId: this.userId,
            model: this.model
        });
    }

    /**
     * DETECT ATTACHMENT STYLE
     * Uses semantic understanding instead of keyword counting
     * Returns: { style, score (0-1), indicators, confidence }
     */
    async analyzeAttachmentStyle(transcript, conversationHistory = []) {
        try {
            const systemPrompt = `You are a clinical attachment theorist analyzing a person's attachment style based on their words.

Analyze for 4 attachment types:
1. SECURE: Trust, openness, balanced autonomy/intimacy, healthy conflict
2. ANXIOUS: Abandonment fear, seeking reassurance, jealousy, rumination
3. AVOIDANT: Independence overemphasis, discomfort with intimacy, minimization
4. FEARFUL (Disorganized): Contradictory signals, approach-avoid cycles, distrust

IMPORTANT: Look for SEMANTIC MEANING, not just keywords.
- "I don't need anyone" might be avoidant OR secure (context matters)
- "He might leave" might be anxious OR realistic concern (depends on evidence)

Return JSON:
{
  "primary_style": "anxious"|"avoidant"|"secure"|"fearful",
  "secondary_style": "...",
  "score": 0.85,
  "confidence": 0.9,
  "indicators": ["...", "..."],
  "evidence": "Direct quotes showing...",
  "clinical_interpretation": "This person's attachment likely stems from..."
}`;

            const conversationContext = conversationHistory
                .slice(-5)
                .map(msg => `${msg.role}: ${msg.content}`)
                .join('\n');

            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 500,
                system: systemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: `Analyze attachment style:\n\nRecent context:\n${conversationContext}\n\nCurrent statement:\n"${transcript}"`
                    }
                ]
            });

            const analysisText = response.content[0].type === 'text' ? response.content[0].text : '';
            let analysis = this.parseJSON(analysisText);

            // Fallback if parsing fails
            if (!analysis || !analysis.primary_style) {
                analysis = {
                    primary_style: 'unknown',
                    score: 0,
                    confidence: 0,
                    indicators: [],
                    evidence: transcript.substring(0, 100)
                };
            }

            logger.info('[SemanticAnalyzer] Attachment analysis complete', {
                style: analysis.primary_style,
                confidence: analysis.confidence
            });

            return analysis;

        } catch (error) {
            logger.error('[SemanticAnalyzer] Attachment analysis failed', {
                error: error.message
            });
            return {
                primary_style: 'unknown',
                score: 0,
                confidence: 0,
                indicators: [],
                error: error.message
            };
        }
    }

    /**
     * DETECT EARLY MALADAPTIVE SCHEMAS
     * Clinical pattern detection using semantic understanding
     */
    async detectSchemas(transcript) {
        try {
            const systemPrompt = `You are a schema therapy expert (Young's model). Analyze for active schemas.

The 18 Early Maladaptive Schemas (Young):
1. Abandonment - "People will leave me"
2. Mistrust - "People will hurt/betray me"
3. Emotional Deprivation - "Nobody understands my feelings"
4. Defectiveness - "I'm fundamentally flawed/broken"
5. Social Isolation - "I don't belong"
6. Dependence - "I can't function without help"
7. Vulnerability - "Catastrophe is imminent"
8. Enmeshment - "I'm responsible for parent's emotions"
9. Failure - "I'm incapable/will fail"
10. Entitlement - "Rules don't apply to me"
11. Insufficient Self-Control - "I can't manage impulses"
12. Approval-Seeking - "Everyone must love me"
13. Pessimism - "Only bad things happen"
14. Self-Sacrifice - "Others' needs come before mine"
15. Unrelenting Standards - "Perfect or worthless"
16. Emotional Inhibition - "Feelings are dangerous"
17. Punitiveness - "I deserve punishment"
18. Subjugation - "My needs don't matter"

Return JSON:
{
  "detected_schemas": [
    {
      "schema_name": "abandonment|mistrust|...",
      "score": 0.85,
      "triggers": ["...", "..."],
      "protective_behaviors": ["..."],
      "origin_hypothesis": "Likely stems from..."
    }
  ],
  "primary_schema": "...",
  "schema_mode": "vulnerable|demanding|protective",
  "clinical_recommendation": "..."
}`;

            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 800,
                system: systemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: `Detect schemas in: "${transcript}"`
                    }
                ]
            });

            const analysisText = response.content[0].type === 'text' ? response.content[0].text : '';
            let analysis = this.parseJSON(analysisText);

            if (!analysis || !analysis.detected_schemas) {
                analysis = {
                    detected_schemas: [],
                    primary_schema: null,
                    confidence: 0
                };
            }

            logger.info('[SemanticAnalyzer] Schema analysis complete', {
                schemaCount: analysis.detected_schemas?.length || 0
            });

            return analysis;

        } catch (error) {
            logger.error('[SemanticAnalyzer] Schema detection failed', { error: error.message });
            return {
                detected_schemas: [],
                error: error.message
            };
        }
    }

    /**
     * DETECT SHAME & TRAUMA LANGUAGE
     * Nuanced understanding of vulnerability and pain
     */
    async detectTraumaLanguage(transcript) {
        try {
            const systemPrompt = `You are a trauma-informed clinician analyzing for shame, trauma, and dissociative language.

Look for:
1. SHAME indicators:
   - Self-blame language ("My fault", "I'm broken")
   - Hiding/concealment desires
   - Judgment anxiety ("They'll think...")
   - Unworthiness language

2. TRAUMA indicators:
   - Fragmentation ("I don't remember", "It's like...")
   - Dissociation ("I left my body", "watching from outside")
   - Hypervigilance ("Always watching", "Can't relax")
   - Flashbacks ("Felt like it was happening again")

3. EMOTIONAL REGULATION CAPACITY:
   - Can they feel emotions? ("I'm numb")
   - Can they contain them? ("Might break apart")
   - Window of tolerance assessment

Return JSON:
{
  "shame_level": 0.85,
  "trauma_severity": "mild|moderate|severe",
  "dissociation_level": 0.3,
  "flashback_indicators": ["...", "..."],
  "emotional_capacity": "overwhelmed|contained|dissociated",
  "immediate_safety": true|false,
  "clinical_note": "..."
}`;

            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 600,
                system: systemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: `Analyze trauma/shame language: "${transcript}"`
                    }
                ]
            });

            const analysisText = response.content[0].type === 'text' ? response.content[0].text : '';
            let analysis = this.parseJSON(analysisText);

            if (!analysis) {
                analysis = {
                    shame_level: 0,
                    trauma_severity: 'unknown',
                    dissociation_level: 0,
                    immediate_safety: true
                };
            }

            return analysis;

        } catch (error) {
            logger.error('[SemanticAnalyzer] Trauma language detection failed', {
                error: error.message
            });
            return {
                shame_level: 0,
                trauma_severity: 'unknown',
                error: error.message
            };
        }
    }

    /**
     * DETECT TRANSFERENCE PATTERNS
     * How patient relates to therapist (Lyra) based on language
     */
    async detectTransference(transcript, conversationHistory = []) {
        try {
            const systemPrompt = `You are a psychodynamic clinician detecting transference patterns.

Transference = patient relating to therapist as if they were past figures (parent, authority, lover, etc.)

Look for:
1. Direct address patterns ("You're like my father...", "I feel safe with you")
2. Expectation language ("Will you abandon me?", "Are you judging?")
3. Projection ("You don't care" = patient doesn't care about themselves)
4. Idealization or devaluation of therapist

Types:
- Paternal/Maternal transference
- Romantic/Erotic transference
- Adversarial/Defensive transference
- Narcissistic mirroring

Return JSON:
{
  "transference_detected": true|false,
  "primary_transference_type": "paternal|maternal|romantic|adversarial|...",
  "intensity": 0.7,
  "evidence": ["...", "..."],
  "therapeutic_use": "Can use this relationship to heal...",
  "intervention": "Meta-communication suggestion..."
}`;

            const conversationContext = conversationHistory
                .slice(-8)
                .map(msg => `${msg.role}: ${msg.content}`)
                .join('\n');

            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 500,
                system: systemPrompt,
                messages: [
                    {
                        role: 'user',
                        content: `Detect transference:\n\nContext:\n${conversationContext}\n\nCurrent: "${transcript}"`
                    }
                ]
            });

            const analysisText = response.content[0].type === 'text' ? response.content[0].text : '';
            let analysis = this.parseJSON(analysisText);

            if (!analysis) {
                analysis = {
                    transference_detected: false,
                    intensity: 0
                };
            }

            logger.debug('[SemanticAnalyzer] Transference analysis complete', {
                detected: analysis.transference_detected,
                type: analysis.primary_transference_type
            });

            return analysis;

        } catch (error) {
            logger.error('[SemanticAnalyzer] Transference detection failed', {
                error: error.message
            });
            return {
                transference_detected: false,
                error: error.message
            };
        }
    }

    /**
     * BATCH ANALYZE
     * Efficient multi-analysis in one call to reduce token usage
     */
    async analyzeMultiple(transcript, conversationHistory = []) {
        try {
            const batchPrompt = `
You are a comprehensive psychological analyzer. Return JSON with all analyses:

Transcript: "${transcript}"

Return:
{
  "attachment": {
    "style": "secure|anxious|avoidant|fearful",
    "score": 0.8,
    "confidence": 0.9
  },
  "schemas": ["abandonment", "mistrust"],
  "trauma": {
    "severity": "none|mild|moderate|severe",
    "shame_level": 0.5
  },
  "transference": {
    "detected": true,
    "type": "paternal"
  },
  "defense_mechanism": "intellectualization|dissociation|projection",
  "current_emotional_state": "anxious|safe|overwhelmed",
  "therapeutic_readiness": "high|moderate|low"
}`;

            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: 1000,
                messages: [
                    {
                        role: 'user',
                        content: batchPrompt
                    }
                ]
            });

            const analysisText = response.content[0].type === 'text' ? response.content[0].text : '';
            const analysis = this.parseJSON(analysisText);

            return analysis || {};

        } catch (error) {
            logger.error('[SemanticAnalyzer] Batch analysis failed', { error: error.message });
            return {};
        }
    }

    /**
     * PARSE JSON from GPT response
     * Handles markdown code blocks and formatting
     */
    parseJSON(text) {
        try {
            // Remove markdown code blocks if present
            let jsonText = text.replace(/```json\n?/g, '').replace(/```\n?/g, '');

            // Find first { and last }
            const start = jsonText.indexOf('{');
            const end = jsonText.lastIndexOf('}');

            if (start === -1 || end === -1) {
                logger.warn('[SemanticAnalyzer] No JSON found in response');
                return null;
            }

            jsonText = jsonText.substring(start, end + 1);
            return JSON.parse(jsonText);

        } catch (error) {
            logger.error('[SemanticAnalyzer] JSON parsing failed', {
                error: error.message,
                text: text.substring(0, 200)
            });
            return null;
        }
    }
}

export default SemanticAnalyzer;
