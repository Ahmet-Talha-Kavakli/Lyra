/**
 * Intake Agent - İlk Seans Uzmanı
 *
 * "First Impression Matters" ✨
 *
 * Hastanın ilk 20 dakikalık seansında 6 Klinik Sütunu (Pillars) çıkarmak için
 * tasarlanmış. Soruları sohbet akışı içinde empati kurarak soruyorum.
 *
 * 6 Klinik Sütunu:
 * 1. Presenting Complaint - Şu an buraya seni getiren iç dürtü
 * 2. History & Depth - Bu hisler hayatına ne zaman sızmaya başladı
 * 3. Support System - Düştüğünde yaslanabileceğin duvarlar
 * 4. Coping Mechanisms - Karanlıklaştığında nasıl ayakta kalıyorsun
 * 5. Somatic Baseline - Bedeninde en çok nerede ağırlık/gerginlik
 * 6. Therapy Goals - Yolculuğun sonunda kendini nasıl görmek istersin
 */

import OpenAI from 'openai';
import { logger } from '../logging/logger.js';
import { EpisodicMemoryService } from './EpisodicMemoryService.js';

export class IntakeAgent {
    constructor(options = {}) {
        this.userId = options.userId;
        this.sessionId = options.sessionId;

        // OpenAI integration
        this.client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY
        });

        this.model = options.model || 'gpt-4o-mini';
        this.maxTokens = options.maxTokens || 1024;

        // Memory service for storing intake data
        this.memory = new EpisodicMemoryService({
            userId: this.userId,
            sessionId: this.sessionId
        });

        // Conversation history
        this.conversationHistory = [];

        // Track which pillars have been explored
        this.exploredPillars = new Set();
        this.messageCount = 0;
        this.maxIntakeMessages = 20; // ~20 dakika sohbet hedefi

        logger.info('[IntakeAgent] Initialized', {
            userId: this.userId,
            sessionId: this.sessionId
        });
    }

    /**
     * GENERATE INTAKE RESPONSE
     * Async generator that yields tokens in real-time
     * Each message explores one pillar naturally
     *
     * CRITICAL: Receives full clinicalData context including:
     * - somaticMarkers (facial emotion)
     * - objectContext (dangerous objects in environment)
     * - physicalHarmContext (injuries/trauma signs)
     *
     * If safety concern detected → CRISIS MODE (override intake)
     */
    async *generateResponse(clinicalData) {
        try {
            this.messageCount++;

            // Extract data from clinicalData object
            const transcript = clinicalData.transcript;
            const objectContext = clinicalData.objectContext || {};
            const physicalHarmContext = clinicalData.physicalHarmContext || {};
            const somaticMarkers = clinicalData.somaticMarkers || {};

            // ── CRITICAL: Check for safety concerns FIRST ──
            const crisisDetected = this.detectCrisis(objectContext, physicalHarmContext);

            // If crisis detected, override intake flow and address safety
            if (crisisDetected) {
                logger.warn('[IntakeAgent] CRISIS DETECTED - Entering safety mode', {
                    userId: this.userId,
                    crisisReason: crisisDetected.reason,
                    threatLevel: objectContext.threat_level,
                    harmIndicators: physicalHarmContext.indicators?.length
                });

                // Yield crisis response instead of normal intake
                yield* this.generateCrisisResponse(transcript, crisisDetected, objectContext, physicalHarmContext);
                return;
            }

            // Determine which pillar to explore next
            const nextPillar = this.getNextPillar();

            // Build system prompt with intake-specific instructions
            const systemPrompt = this.buildIntakeSystemPrompt(nextPillar);

            // Build user message with context (including somatic + environmental data)
            const userMessage = this.buildIntakeUserMessage(transcript, nextPillar, clinicalData);

            // Stream Claude's response
            let fullContent = '';
            const stream = await this.client.messages.stream({
                model: this.model,
                max_tokens: this.maxTokens,
                system: systemPrompt,
                messages: [
                    ...this.conversationHistory,
                    { role: 'user', content: userMessage }
                ]
            });

            // Process stream tokens
            for await (const event of stream) {
                if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                    const token = event.delta.text;
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
                content: transcript
            });
            this.conversationHistory.push({
                role: 'assistant',
                content: fullContent
            });

            // Mark pillar as explored
            this.exploredPillars.add(nextPillar);

            // Yield metadata
            yield {
                type: 'complete',
                totalContent: fullContent,
                pillarExplored: nextPillar,
                messageCount: this.messageCount,
                isIntakeComplete: this.isIntakeSessionComplete(),
                context: {
                    exploredPillars: Array.from(this.exploredPillars),
                    nextPillar: this.messageCount < this.maxIntakeMessages ? this.getNextPillar() : 'COMPLETE'
                }
            };

            logger.info('[IntakeAgent] Message processed', {
                sessionId: this.sessionId,
                messageCount: this.messageCount,
                pillar: nextPillar
            });

        } catch (error) {
            logger.error('[IntakeAgent] Stream failed:', error);
            yield {
                type: 'error',
                error: error.message
            };
            throw error;
        }
    }

    /**
     * Determine next pillar to explore
     * Intelligently cycles through 6 pillars based on conversation flow
     */
    getNextPillar() {
        const allPillars = [
            'PRESENTING_COMPLAINT',  // 1. Şu an buraya getiren iç dürtü
            'HISTORY',               // 2. Ne zaman başladı
            'SUPPORT_SYSTEM',        // 3. Yaslanabileceğin duvarlar
            'COPING',                // 4. Nasıl ayakta kalıyorsun
            'SOMATIC',               // 5. Bedeninde ağırlık/gerginlik
            'GOALS'                  // 6. Sonunda kendini nasıl görmek istersin
        ];

        // Find first unexplored pillar
        for (const pillar of allPillars) {
            if (!this.exploredPillars.has(pillar)) {
                return pillar;
            }
        }

        // All pillars explored, cycle back
        return allPillars[this.exploredPillars.size % allPillars.length];
    }

    /**
     * Detect if there are immediate safety concerns
     * Returns { crisis: true, reason: "..." } or null
     */
    detectCrisis(objectContext, physicalHarmContext) {
        // High threat level (weapons, danger)
        if (objectContext.threat_level === 'high') {
            return {
                crisis: true,
                reason: 'HIGH_THREAT_ENVIRONMENT',
                threatLevel: 'high',
                objects: objectContext.detected_objects || []
            };
        }

        // Severe physical harm indicators
        if (physicalHarmContext.indicators?.length > 0) {
            const severe = physicalHarmContext.indicators.some(
                ind => ind.severity === 'severe' || ind.type === 'bleeding'
            );
            if (severe) {
                return {
                    crisis: true,
                    reason: 'SEVERE_PHYSICAL_HARM',
                    indicators: physicalHarmContext.indicators,
                    requiresMedicalAttention: true
                };
            }
        }

        // Multiple harm indicators (pattern of abuse)
        if (physicalHarmContext.indicators?.length >= 2 && physicalHarmContext.has_prior_harm) {
            return {
                crisis: true,
                reason: 'PATTERN_OF_HARM',
                indicators: physicalHarmContext.indicators,
                hasHistory: true
            };
        }

        return null;
    }

    /**
     * Generate crisis response instead of normal intake
     * Safety supersedes intake protocol
     */
    async *generateCrisisResponse(transcript, crisisInfo, objectContext, physicalHarmContext) {
        try {
            const crisisSystemPrompt = `You are Lyra. THIS IS A CRISIS SITUATION.

SAFETY FIRST PROTOCOL:
Your intake session is PAUSED. The patient's safety is the only priority right now.

CRISIS DETAILS:
${crisisInfo.reason === 'HIGH_THREAT_ENVIRONMENT' ? `
THREAT IN ENVIRONMENT:
Objects detected: ${objectContext.detected_objects?.map(o => o.name).join(', ')}
Threat level: HIGH
This patient may be in immediate danger.
` : ''}

${crisisInfo.reason === 'SEVERE_PHYSICAL_HARM' ? `
SEVERE PHYSICAL HARM DETECTED:
Injuries: ${crisisInfo.indicators?.map(i => \`\${i.type} on \${i.location}\`).join(', ')}
Severity: SEVERE (requires medical attention)
This may indicate abuse, violence, or self-harm.
` : ''}

${crisisInfo.reason === 'PATTERN_OF_HARM' ? `
PATTERN OF HARM DETECTED:
Multiple injuries: ${crisisInfo.indicators?.map(i => \`\${i.type}\`).join(', ')}
Prior harm history: YES
Pattern indicates ongoing abuse or crisis cycle.
` : ''}

YOUR RESPONSE:
1. Express immediate concern without judgment
2. Validate their safety needs as priority
3. Ask: "Are you safe right now?"
4. Offer immediate resources (hotline, emergency contact, hospital)
5. Make clear: This conversation continues, but first we handle safety

TONE: Warm, urgent, caring. Not alarming. Professional crisis protocol.`;

            const crisisUserMessage = `Patient said: "${transcript}"

CONTEXT: Safety concern detected. Proceed with crisis protocol.
Remember: You're not giving up on intake, just prioritizing their immediate safety.`;

            let fullContent = '';
            const stream = await this.client.messages.stream({
                model: this.model,
                max_tokens: this.maxTokens,
                system: crisisSystemPrompt,
                messages: [
                    { role: 'user', content: crisisUserMessage }
                ]
            });

            for await (const event of stream) {
                if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                    const token = event.delta.text;
                    fullContent += token;
                    yield {
                        type: 'token',
                        content: token,
                        timestamp: Date.now()
                    };
                }
            }

            yield {
                type: 'complete',
                totalContent: fullContent,
                crisisMode: true,
                crisisReason: crisisInfo.reason,
                isSafetyCheck: true,
                context: {
                    crisisDetected: true,
                    threatLevel: objectContext.threat_level,
                    harmIndicators: physicalHarmContext.indicators?.length || 0
                }
            };

            logger.info('[IntakeAgent] Crisis response completed', {
                userId: this.userId,
                crisisReason: crisisInfo.reason
            });

        } catch (error) {
            logger.error('[IntakeAgent] Crisis response failed:', error);
            yield {
                type: 'error',
                error: error.message
            };
            throw error;
        }
    }

    /**
     * Build intake-specific system prompt
     */
    buildIntakeSystemPrompt(currentPillar) {
        const pillarGuidance = {
            'PRESENTING_COMPLAINT': `
Current Pillar: PRESENTING COMPLAINT
Your goal: Understand what brought them here TODAY.
Question focus: "Seni tam olarak bugün, şu an buraya getiren içsel dürtü neydi?"
Approach: Ask warmly, listen deeply. Don't judge. Validate their courage in being here.`,

            'HISTORY': `
Current Pillar: HISTORY & DEPTH
Your goal: Trace when these feelings started.
Question focus: "Bu bahsettiğin hisler hayatına ilk ne zaman sızmaya başladı? Eskiden de var mıydı?"
Approach: Listen for patterns, family echoes, childhood roots. Connect dots gently.`,

            'SUPPORT_SYSTEM': `
Current Pillar: SUPPORT SYSTEM
Your goal: Understand their relational world.
Question focus: "Düştüğünde yaslanabildiğin duvarlar var mı? Ailen, dostların ya da kendini tamamen yalnız mı hissediyorsun?"
Approach: Explore belonging, loneliness, safe people. Affirm existing supports.`,

            'COPING': `
Current Pillar: COPING MECHANISMS
Your goal: Identify how they survive darkness.
Question focus: "Peki işler çok karanlıklaştığında nasıl ayakta kalıyorsun? Seni ne rahatlatıyor? (Müzik, yürüyüş, sessizlik, vb.)"
Approach: Celebrate what works. Build on existing strengths.`,

            'SOMATIC': `
Current Pillar: SOMATIC BASELINE
Your goal: Map where they hold the pain.
Question focus: "Şu an bana bunları anlatırken bedeninde en çok nerede bir ağırlık, bir gerginlik hissediyorsun?"
Approach: Connect emotion to body. Teach somatic awareness. This is foundational for therapy.`,

            'GOALS': `
Current Pillar: THERAPY GOALS
Your goal: Envision the desired future self.
Question focus: "Benimle geçireceğin bu yolculuğun sonunda, aynaya baktığında nasıl bir [Name] görmek istersin?"
Approach: Dream together. Help them articulate hope. This is the north star of therapy.`
        };

        return `You are Lyra, a deeply empathetic and clinically wise psychotherapist conducting an INTAKE SESSION.

INTAKE SESSION RULES:
1. You are listening to build a comprehensive psychological map
2. Ask ONE clear question per message (never multiple questions)
3. Respond warmly to their answer - validate, appreciate, normalize
4. Use natural bridge language to move toward the next pillar ("Thank you for sharing that... I'm curious...")
5. This is a 20-message conversation (about 20 minutes) to gather 6 pillars
6. Your role: GUIDE + LISTENER (not judge, not fixer - yet)
7. Every response should feel like genuine conversation, not interrogation

${pillarGuidance[currentPillar] || pillarGuidance['PRESENTING_COMPLAINT']}

COMMUNICATION STYLE:
- Warm, curious, unhurried
- Use their language and metaphors
- Normalize pain and complexity
- Affirm their courage in seeking help
- Create psychological safety with every word

STRUCTURE OF EACH RESPONSE:
1. Brief acknowledgment/validation of what they shared
2. ONE clear, open-ended question that naturally explores current pillar
3. Optional: Short reflective observation if clinically relevant

Remember: You're building trust and gathering a map. No rushing. No judgment. Pure human connection.`;
    }

    /**
     * Build intake-specific user message
     * Now includes somatic + environmental context for richer understanding
     */
    buildIntakeUserMessage(transcript, currentPillar, clinicalData = {}) {
        const contextByPillar = {
            'PRESENTING_COMPLAINT': 'This is their first message. Welcome them warmly and begin exploring what brought them here today.',
            'HISTORY': 'They shared about their presenting complaint. Now explore the history and roots of these feelings.',
            'SUPPORT_SYSTEM': 'You understand their complaint and history. Now explore who and what supports them.',
            'COPING': 'You know their background and support system. Now explore what keeps them functional and alive.',
            'SOMATIC': 'You understand their coping strategies. Now help them locate these feelings in their body.',
            'GOALS': 'You have gathered pillars 1-5. Now invite them to envision the desired future self - this is the north star of therapy.'
        };

        let message = `PATIENT MESSAGE:\n"${transcript}"\n\n`;

        // Add somatic context if available
        if (clinicalData.somaticMarkers && Object.keys(clinicalData.somaticMarkers).length > 0) {
            message += `BODY LANGUAGE RIGHT NOW:\n`;
            Object.entries(clinicalData.somaticMarkers).forEach(([marker, data]) => {
                if (data.score > 0) {
                    message += `- ${marker} (${Math.round(data.score * 100)}%)\n`;
                }
            });
            message += `\n`;
        }

        // Add emotional state if available
        if (clinicalData.emotionalState?.primary) {
            message += `EMOTIONAL STATE: ${clinicalData.emotionalState.primary}\n`;
            if (clinicalData.emotionalState.secondary) {
                message += `Secondary: ${clinicalData.emotionalState.secondary}\n`;
            }
            message += `\n`;
        }

        message += `CONTEXT: ${contextByPillar[currentPillar] || 'Continue the intake conversation.'}\n`;
        message += `CURRENT PILLAR: ${currentPillar}\n`;
        message += `MESSAGES SO FAR: ${this.messageCount}/${this.maxIntakeMessages}\n`;
        message += `PILLARS EXPLORED: ${Array.from(this.exploredPillars).join(', ') || 'None yet'}\n\n`;

        message += `Your response:`;

        return message;
    }

    /**
     * Check if intake session is complete
     * Complete when max messages reached or all pillars explored
     */
    isIntakeSessionComplete() {
        const allPillarsExplored = this.exploredPillars.size >= 6;
        const maxMessagesReached = this.messageCount >= this.maxIntakeMessages;
        return allPillarsExplored || maxMessagesReached;
    }

    /**
     * Get intake summary for profile generation
     */
    getIntakeSummary() {
        return {
            userId: this.userId,
            sessionId: this.sessionId,
            messageCount: this.messageCount,
            exploredPillars: Array.from(this.exploredPillars),
            isComplete: this.isIntakeSessionComplete(),
            conversationHistory: this.conversationHistory,
            transcript: this.conversationHistory
                .filter(msg => msg.role === 'user')
                .map(msg => msg.content)
                .join('\n\n---\n\n')
        };
    }
}

export default IntakeAgent;
