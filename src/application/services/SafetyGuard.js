/**
 * Safety Guard Agent
 * Runs in PARALLEL with chat response generation
 * Detects: suicide risk, self-harm, abuse, crisis indicators
 * Non-blocking — doesn't delay response, but flags issues
 */

import { openai } from '../../infrastructure/llm/openaiClient.js';
import { logger } from '../../infrastructure/logging/logger.js';

const CRISIS_KEYWORDS = [
    'suicid', 'ölüm', 'ölmek', 'hayatı bitir', 'kendime zarar', 'kesme', 'zehir', 'astı',
    'artık dayanamıyorum', 'dayanacak güçüm yok', 'çaresiz', 'hopeless', 'hiçbir anlam yok',
    'çocuk istismarı', 'cinsel saldırı', 'tecavüz', 'dışlanma', 'aile şiddeti'
];

export class SafetyGuard {
    /**
     * Run safety check in parallel (async, non-blocking)
     * Returns immediately with initial assessment, more thorough check happens in background
     */
    checkSafetyAsync(message, sessionState) {
        // Quick keyword check (sync)
        const quickCheck = this.quickSafetyCheck(message);

        // Detailed LLM check in background (async, non-blocking)
        this.detailedSafetyCheckAsync(message, sessionState, quickCheck)
            .then(result => {
                if (result.riskLevel > 5) {
                    logger.warn('[SafetyGuard] Risk detected', {
                        riskLevel: result.riskLevel,
                        riskType: result.riskType,
                        timestamp: new Date()
                    });

                    // TODO: Alert human therapist, store for review
                }
            })
            .catch(err => logger.error('[SafetyGuard] Detailed check failed', { error: err.message }));

        return quickCheck;
    }

    /**
     * Quick synchronous check using keywords
     * Returns immediately
     */
    quickSafetyCheck(message) {
        const lowerMessage = message.toLowerCase();

        for (const keyword of CRISIS_KEYWORDS) {
            if (lowerMessage.includes(keyword)) {
                return {
                    isSafe: false,
                    riskLevel: 7,
                    riskType: 'detected_keywords',
                    requiresIntervention: true,
                    recommendations: [
                        'Immediately assess suicide risk',
                        'Provide crisis resources',
                        'Consider escalation to human therapist'
                    ]
                };
            }
        }

        return {
            isSafe: true,
            riskLevel: 2,
            riskType: 'none',
            requiresIntervention: false,
            recommendations: []
        };
    }

    /**
     * Detailed safety assessment using LLM
     * Runs async in background, doesn't block response
     */
    async detailedSafetyCheckAsync(message, sessionState, quickCheck) {
        // Skip detailed check if keyword already triggered
        if (!quickCheck.isSafe) {
            return quickCheck;
        }

        try {
            const recentTranscript = sessionState?.sessionTranscript
                ?.slice(-10)
                .map(m => `${m.role}: ${m.content}`)
                .join('\n') || '';

            const prompt = `You are a clinical psychologist assessing client safety. Analyze this message for suicide risk, self-harm, abuse, or crisis indicators.

Recent conversation:
${recentTranscript}

Latest message:
"${message}"

Provide assessment in JSON:
{
  "riskLevel": 1-10,
  "riskType": "suicide/self_harm/abuse/crisis/none",
  "isImmediateThreat": boolean,
  "reasoning": "brief explanation",
  "recommendations": ["action1", "action2"]
}`;

            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 200
            });

            const content = response.choices[0]?.message?.content || '{}';
            const assessment = JSON.parse(content);

            return {
                isSafe: assessment.riskLevel <= 4,
                riskLevel: assessment.riskLevel,
                riskType: assessment.riskType,
                requiresIntervention: assessment.isImmediateThreat,
                reasoning: assessment.reasoning,
                recommendations: assessment.recommendations
            };
        } catch (error) {
            logger.error('[SafetyGuard] Detailed check failed', { error: error.message });
            // Return conservative assessment on error
            return {
                isSafe: true,
                riskLevel: 3,
                riskType: 'none',
                requiresIntervention: false,
                recommendations: []
            };
        }
    }

    /**
     * Generate safety-aware response preamble
     * If risk detected, include crisis resources
     */
    generateSafetyPreamble(safetyCheck) {
        if (safetyCheck.isSafe) {
            return '';
        }

        const preamble = `
⚠️ I'm noticing signs of distress. Your safety matters to me.

If you're thinking of harming yourself:
• National Suicide Prevention Lifeline (US): 988
• Crisis Text Line: Text HOME to 741741
• International Association for Suicide Prevention: https://www.iasp.info/resources/Crisis_Centres/

Let's focus on immediate safety first. Can you tell me what's happening right now?
`;

        return preamble;
    }

    /**
     * Check if response needs human escalation
     */
    shouldEscalate(safetyCheck, sessionState) {
        if (!safetyCheck.requiresIntervention) {
            return false;
        }

        const riskLevel = safetyCheck.riskLevel;
        const safetyRating = sessionState?.safetyRating || 5;

        // Escalate if high risk or multiple crisis markers
        return riskLevel >= 7 || safetyRating <= 3;
    }
}

export const safetyGuard = new SafetyGuard();

export default SafetyGuard;
