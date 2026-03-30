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

import { Anthropic } from '@anthropic-ai/sdk';
import { logger } from '../logging/logger.js';
import { EpisodicMemoryService } from './EpisodicMemoryService.js';

export class TherapistAgent {
    constructor(options = {}) {
        this.userId = options.userId;
        this.sessionId = options.sessionId;

        // Claude integration
        this.client = new Anthropic({
            apiKey: process.env.ANTHROPIC_API_KEY
        });

        this.model = options.model || 'claude-3-5-sonnet-20241022';
        this.maxTokens = options.maxTokens || 1024;

        // Memory service
        this.memory = new EpisodicMemoryService({
            userId: this.userId,
            sessionId: this.sessionId
        });

        // Conversation history (for multi-turn context)
        this.conversationHistory = [];

        logger.info('[TherapistAgent] Initialized', {
            model: this.model,
            userId: this.userId,
            sessionId: this.sessionId
        });
    }

    /**
     * GENERATE THERAPEUTIC RESPONSE
     * Main entry point: takes somatic data + transcript, returns compassionate guidance
     */
    async generateResponse(data) {
        try {
            const {
                transcript,
                somaticMarkers,
                congruenceAnalysis,
                temporalPatterns,
                emotionalState,
                autonomicState,
                recommendations,
                baselineDeviation
            } = data;

            // Get patient history context
            const similarMoments = await this.memory.findSimilarMoments(transcript, 3);
            const therapeuticThemes = await this.memory.getTherapeuticThemes();
            const memoryInsights = await this.memory.generateMemoryInsights();

            // Build system prompt with all context
            const systemPrompt = this.buildSystemPrompt({
                memoryInsights,
                therapeuticThemes,
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
                similarMoments
            });

            // Get Claude's response
            const response = await this.client.messages.create({
                model: this.model,
                max_tokens: this.maxTokens,
                system: systemPrompt,
                messages: [
                    ...this.conversationHistory,
                    { role: 'user', content: userMessage }
                ]
            });

            const therapistResponse = response.content[0].text;

            // Store in conversation history
            this.conversationHistory.push({
                role: 'user',
                content: userMessage
            });
            this.conversationHistory.push({
                role: 'assistant',
                content: therapistResponse
            });

            // Limit history to last 10 exchanges (for efficiency)
            if (this.conversationHistory.length > 20) {
                this.conversationHistory = this.conversationHistory.slice(-20);
            }

            // Store memory fragment
            await this.memory.storeMemoryFragment({
                transcript,
                somaticMarkers,
                congruenceAnalysis,
                temporalPatterns,
                topics: this.extractTopics(transcript),
                emotionalThemes: [emotionalState?.primary].filter(Boolean)
            });

            logger.info('[TherapistAgent] Response generated', {
                sessionId: this.sessionId,
                tokensUsed: response.usage?.output_tokens,
                similarMoments: similarMoments.length
            });

            return {
                response: therapistResponse,
                context: {
                    somaticMarkers,
                    emotionalState,
                    autonomicState,
                    similarMoments: similarMoments.length,
                    relevantThemes: therapeuticThemes.slice(0, 3).map(t => t.theme_name)
                },
                usage: {
                    inputTokens: response.usage?.input_tokens,
                    outputTokens: response.usage?.output_tokens
                }
            };
        } catch (error) {
            logger.error('[TherapistAgent] Failed to generate response:', error);
            throw error;
        }
    }

    /**
     * BUILD SYSTEM PROMPT
     * Tells Claude to act as a somatic-aware therapist
     */
    buildSystemPrompt(options) {
        const { memoryInsights, therapeuticThemes, model } = options;

        return `You are Lyra, a deeply compassionate and clinically trained somatic-aware psychotherapist.

YOUR CLINICAL APPROACH:
- You understand that the body is the gateway to the unconscious
- You notice when words don't match bodies (incongruence)
- You recognize protective patterns: defended states, dissociation, etc.
- You create safety first, then gently invite awareness
- You honor the wisdom in symptoms, not pathologize them

YOUR KNOWLEDGE OF THIS PATIENT:
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
` : ''}

YOUR COMMUNICATION STYLE:
- Speak naturally, like a skilled therapist (not robotic)
- Use their language and metaphors
- Name what you observe in their body with curiosity, not judgment
- Offer gentle reflection, not interpretation
- Create space for their own wisdom to emerge
- Use trauma-informed language (they're safe, they're in control)

WHEN RESPONDING:
1. Acknowledge what they've said
2. Notice their somatic state (if incongruence detected, name it gently)
3. Connect to patterns if relevant ("This reminds me of...")
4. Ask curious questions rather than make statements
5. Validate their experience
6. Offer next steps or inquiry

REMEMBER: You're not just responding to words. You're responding to a body in a room, carrying history, wisdom, and protection.`;
    }

    /**
     * BUILD USER MESSAGE
     * Provides current clinical data for Claude to consider
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
            similarMoments
        } = data;

        let message = `${transcript}\n\n`;

        message += `CLINICAL OBSERVATIONS:\n`;

        // Somatic state
        if (somaticMarkers) {
            message += `\nBody Language:\n`;
            Object.entries(somaticMarkers).forEach(([marker, data]) => {
                if (data.score > 0) {
                    message += `- ${marker} (${Math.round(data.score * 100)}%): ${data.indicators.join(', ')}\n`;
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
            message += `\nCongruence Analysis:\n`;
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

        // Similar moments from history
        if (similarMoments && similarMoments.length > 0) {
            message += `\nPattern Connection (from past):\n`;
            similarMoments.slice(0, 2).forEach((moment, i) => {
                message += `${i + 1}. "${moment.transcript.substring(0, 100)}..."\n`;
                message += `   Similarity: ${Math.round(moment.similarity * 100)}%\n`;
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
