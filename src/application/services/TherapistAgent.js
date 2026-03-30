/**
 * Therapist Agent
 * Generates therapeutic response based on:
 * - Session state
 * - Selected modules
 * - Safety assessment
 * Uses focused, state-specific prompts (NOT mega-prompts)
 */

import { openai } from '../../infrastructure/llm/openaiClient.js';
import { logger } from '../../infrastructure/logging/logger.js';

export class TherapistAgent {
    /**
     * Generate therapeutic response
     * streams response via callback
     */
    async generateResponse(
        messages,
        sessionState,
        stateSpecificPrompt,
        safetyCheck,
        onTokenCallback = null
    ) {
        try {
            const systemPrompt = this.buildSystemPrompt(stateSpecificPrompt, safetyCheck);

            logger.debug('[TherapistAgent] Generating response', {
                state: sessionState.currentState,
                phase: sessionState.currentPhase
            });

            const stream = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: systemPrompt },
                    ...messages
                ],
                max_tokens: 800,
                temperature: 0.7,
                stream: true
            });

            let fullContent = '';

            // Stream tokens and call callback
            for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta;
                if (!delta) continue;

                if (delta.content) {
                    fullContent += delta.content;
                    if (onTokenCallback) {
                        onTokenCallback(delta.content);
                    }
                }
            }

            return {
                content: fullContent,
                tokensUsed: Math.ceil(fullContent.length / 4), // Rough estimate
                state: sessionState.currentState
            };
        } catch (error) {
            logger.error('[TherapistAgent] Generation failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Build system prompt from state + safety context
     * Concise, focused — NOT a mega-prompt
     */
    buildSystemPrompt(stateSpecificPrompt, safetyCheck) {
        let prompt = `You are Lyra, a compassionate, evidence-based AI therapist.

${stateSpecificPrompt}

RESPONSE GUIDELINES:
- Warm, conversational tone (200-400 words)
- Ask clarifying questions
- Offer specific techniques, not generic advice
- End with forward-looking question or action
- Maintain confidentiality and ethical boundaries`;

        // If safety concern, prioritize stabilization
        if (!safetyCheck.isSafe) {
            prompt += `

⚠️ SAFETY PRIORITY:
The client may be experiencing crisis indicators.
1. Ensure immediate safety first
2. Validate their pain
3. Offer concrete coping strategies
4. Provide crisis resources if needed
Do NOT explore trauma or deep issues right now. Focus on stabilization.`;
        }

        return prompt;
    }

    /**
     * Extract and store insights from response
     * For later analysis/homework generation
     */
    extractInsights(response, selectedModules, sessionState) {
        const lowerResponse = response.toLowerCase();

        return {
            interventionType: this.detectIntervention(response),
            emotionalTone: this.detectTone(response),
            actionItems: this.extractActionItems(response),
            therapyPhase: sessionState.currentPhase,
            modulesUsed: selectedModules,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Detect type of intervention used
     */
    detectIntervention(text) {
        const lowerText = text.toLowerCase();

        if (/soru|neden|nasıl|niçin|kanıt|düşün|sorgulaş|sokratik/i.test(lowerText)) {
            return 'socratic_questioning';
        }
        if (/dene|egzersiz|teknik|pratik|yapabilirsiniz|yapmalısınız|çalış/i.test(lowerText)) {
            return 'behavioral_technique';
        }
        if (/anlaş|hisset|empati|duygu|sürüyorum|çok zor|anlıyorum/i.test(lowerText)) {
            return 'emotional_validation';
        }
        if (/güçlü|başarı|iyi|harika|tebrik|gurur/i.test(lowerText)) {
            return 'strength_based';
        }
        if (/nefes|rahatla|dinlen|meditasyon|yoga|hareket/i.test(lowerText)) {
            return 'self_care';
        }

        return 'supportive_listening';
    }

    /**
     * Detect emotional tone in response
     */
    detectTone(text) {
        const lowerText = text.toLowerCase();

        if (/tebrik|harika|başarı|güzel|mükemmel|iyi iş|gurur/i.test(lowerText)) {
            return 'encouraging';
        }
        if (/anlıyorum|empatiziyorum|hissediyorum|haklı|mantıklı|önemli/i.test(lowerText)) {
            return 'validating';
        }
        if (/dikkat|endişeli|kontrol|önemli|güvenlik/i.test(lowerText)) {
            return 'cautious';
        }
        if (/önem ver|değerli|güzel|özel|kıymetli|önemli/i.test(lowerText)) {
            return 'warm';
        }

        return 'neutral';
    }

    /**
     * Extract action items (homework) from response
     */
    extractActionItems(text) {
        const items = [];
        const lines = text.split('\n');

        for (const line of lines) {
            // Match bullet points, numbered lists, action words
            if (/^[-•*]\s*|^\d+\.\s*|dene:|yapın:|egzersiz:|çalış:/i.test(line)) {
                const cleaned = line
                    .replace(/^[-•*]\s*|^\d+\.\s*|dene:|yapın:|egzersiz:|çalış:/i, '')
                    .trim();

                if (cleaned.length > 5 && cleaned.length < 200) {
                    items.push(cleaned);
                }
            }
        }

        return items.slice(0, 5); // Top 5 items
    }
}

export const therapistAgent = new TherapistAgent();

export default TherapistAgent;
