/**
 * Temporal Mapping Engine
 *
 * "Connecting Past to Present"
 *
 * En iyi terapistler fark ederler ki bugünün tepkisi, geçmişteki
 * travmanın yankısıdır. Ve önemlisi: "O zaman çaresizdin ama
 * bugün başka seçeneklerin var."
 *
 * Bu engine:
 * 1. Memory fragments'tan geçmiş olayları bulur
 * 2. Bugünün trigger'ını tanımlar
 * 3. Geçmiş-bugün bağlantısını gösterir
 * 4. "O zaman vs. Şimdi" farkını vurgular
 * 5. Reprocessing windows'ı (değişim imkanları) önerir
 *
 * Örnek:
 * Geçmiş: "Babası aniden karar alıyor, çocuğu çaresiz"
 * Bugün: "Boss aniden değişiklik söylüyor, paniğe kapılıyor"
 * Bağlantı: "Bu tepki babadan geliyor"
 * Reframing: "O zaman çaresizdin. Şimdi seçin var."
 */

import { logger } from '../../../lib/infrastructure/logger.js';

export class TemporalMappingEngine {
    constructor(options = {}) {
        this.userId = options.userId;
        this.sessionId = options.sessionId;

        logger.info('[TemporalMapping] Initialized', {
            userId: this.userId
        });
    }

    /**
     * MAP PAST TO PRESENT
     * Geçmiş olaylar + bugünün tepkisi = connection
     *
     * Algorithm:
     * 1. Extract keywords from current transcript
     * 2. Search memory for similar patterns
     * 3. Calculate emotional resonance
     * 4. Build narrative chain
     */
    async mapPastToPresent(currentTranscript, memoryInsights = {}) {
        try {
            const temporalMap = {
                presentTrigger: this.extractPresentTrigger(currentTranscript),
                pastEchoes: this.findPastEchoes(currentTranscript, memoryInsights),
                emotionalResonance: this.calculateResonance(currentTranscript, memoryInsights),
                temporalChain: this.buildTemporalChain(currentTranscript, memoryInsights),
                reprocessingOpportunities: this.identifyReprocessingWindows(currentTranscript, memoryInsights)
            };

            logger.info('[TemporalMapping] Map created', {
                userId: this.userId,
                triggersFound: temporalMap.pastEchoes.length,
                resonanceScore: temporalMap.emotionalResonance.score
            });

            return temporalMap;
        } catch (error) {
            logger.error('[TemporalMapping] mapPastToPresent failed:', error);
            return null;
        }
    }

    /**
     * EXTRACT PRESENT TRIGGER
     * Bugün neyin tetiklediğini bulur
     *
     * Trigger types:
     * - Situation (benzer durum)
     * - Person (benzer insan özellikleri)
     * - Emotion (benzer hissediliş)
     * - Action (benzer davranış)
     */
    extractPresentTrigger(transcript) {
        const triggers = [];

        if (!transcript) {
            return triggers;
        }

        const lower = transcript.toLowerCase();

        // Situation triggers
        const situationKeywords = [
            'sudden', 'unexpected', 'no control', 'powerless', 'helpless',
            'criticism', 'rejection', 'abandonment', 'conflict', 'pressure'
        ];

        situationKeywords.forEach(kw => {
            if (lower.includes(kw)) {
                triggers.push({
                    type: 'situation',
                    trigger: kw,
                    confidence: 0.7
                });
            }
        });

        // Person triggers
        const personKeywords = [
            'boss', 'father', 'mother', 'partner', 'authority', 'leader',
            'aggressive', 'withdrawn', 'critical', 'controlling'
        ];

        personKeywords.forEach(kw => {
            if (lower.includes(kw)) {
                triggers.push({
                    type: 'person',
                    trigger: kw,
                    confidence: 0.6
                });
            }
        });

        // Emotion triggers
        const emotionKeywords = [
            'panic', 'freeze', 'shutdown', 'overwhelmed', 'numb',
            'rage', 'shame', 'worthless', 'unlovable'
        ];

        emotionKeywords.forEach(kw => {
            if (lower.includes(kw)) {
                triggers.push({
                    type: 'emotion',
                    trigger: kw,
                    confidence: 0.75
                });
            }
        });

        return triggers;
    }

    /**
     * FIND PAST ECHOES
     * Memory fragments'ta benzer olayları bulur
     */
    findPastEchoes(currentTranscript, memoryInsights = {}) {
        const echoes = [];

        if (!memoryInsights.recentBreakthroughs) {
            return echoes;
        }

        // Simplified: look for thematic connections
        const themes = memoryInsights.primaryThemes || [];
        const breakthroughs = memoryInsights.recentBreakthroughs || [];

        // If patient mentions a person/situation, look for it in themes
        const current_lower = currentTranscript.toLowerCase();

        themes.forEach(theme => {
            if (current_lower.includes(theme) || theme.toLowerCase().includes('father') ||
                theme.toLowerCase().includes('control') || theme.toLowerCase().includes('safety')) {
                echoes.push({
                    type: 'thematic_echo',
                    theme: theme,
                    significance: 'high',
                    suggestsConnection: true
                });
            }
        });

        breakthroughs.forEach(breakthrough => {
            if (typeof breakthrough === 'string' &&
                (breakthrough.includes('father') || breakthrough.includes('control') ||
                 breakthrough.includes('sudden'))) {
                echoes.push({
                    type: 'breakthrough_echo',
                    insight: breakthrough.substring(0, 100),
                    timeAgo: 'recent',
                    suggestsResonance: true
                });
            }
        });

        return echoes;
    }

    /**
     * CALCULATE EMOTIONAL RESONANCE
     * Geçmiş ve bugün arasındaki duygusal benzerlik
     *
     * Score: 0-1
     * 0.7+: Güçlü bağlantı (müdahale fırsatı)
     */
    calculateResonance(currentTranscript, memoryInsights = {}) {
        if (!currentTranscript) {
            return { score: 0, level: 'unknown' };
        }

        let resonanceScore = 0;

        // Check for defensive patterns (higher resonance = more trauma activated)
        const defensiveWords = ['freeze', 'panic', 'shutdown', 'numb', 'rage', 'shame'];
        const defensiveCount = defensiveWords.filter(w =>
            currentTranscript.toLowerCase().includes(w)
        ).length;
        resonanceScore += Math.min(defensiveCount * 0.15, 0.6);

        // Check for self-blame language
        if (currentTranscript.toLowerCase().includes('my fault') ||
            currentTranscript.toLowerCase().includes('i should')) {
            resonanceScore += 0.2;
        }

        // Check for helplessness language
        if (currentTranscript.toLowerCase().includes('cannot') ||
            currentTranscript.toLowerCase().includes('powerless') ||
            currentTranscript.toLowerCase().includes('cannot control')) {
            resonanceScore += 0.15;
        }

        // If memory has related themes, boost resonance
        if (memoryInsights.primaryThemes && memoryInsights.primaryThemes.length > 0) {
            resonanceScore += 0.05 * memoryInsights.primaryThemes.length;
        }

        const score = Math.min(resonanceScore, 1);
        let level = 'low';
        if (score > 0.6) level = 'strong';
        if (score > 0.75) level = 'very_strong';
        if (score > 0.4) level = 'moderate';

        return {
            score,
            level,
            indicators: defensiveCount,
            interpretation: level === 'strong' || level === 'very_strong'
                ? 'Past trauma is significantly activated'
                : 'Some past resonance detected'
        };
    }

    /**
     * BUILD TEMPORAL CHAIN
     * Geçmiş → Bugün ilişkisini narrative'e çevirme
     *
     * Structure:
     * Original Event → Survival Strategy → Current Trigger → Current Reaction
     */
    buildTemporalChain(currentTranscript, memoryInsights = {}) {
        return {
            originalEvent: {
                description: this.inferOriginalEvent(memoryInsights),
                timeframe: 'childhood or significant past',
                context: 'limited agency, unsafe environment',
                survival_strategy: 'developed protective mechanism'
            },
            survivalStrategy: {
                description: this.infertSurvivalStrategy(memoryInsights),
                purpose: 'kept you safe then',
                cost: 'limiting you now'
            },
            currentTrigger: {
                description: this.extractPresentTrigger(currentTranscript)[0]?.trigger || 'situation resembles original',
                similarity: 'surface level resemblance to original unsafe situation',
                automatic_activation: 'nervous system does not distinguish past from present'
            },
            currentReaction: {
                description: 'same protective response as then',
                appropriateness: 'was necessary then, not needed now',
                cost: 'limits choices, relationships, wellbeing'
            },
            intervention_point: 'Here is where the work happens - create NEW responses'
        };
    }

    /**
     * IDENTIFY REPROCESSING WINDOWS
     * Değişim imkanları - "Bunun farkındasın, şimdi neler yapabilirsin?"
     *
     * Window = moment when patient is:
     * 1. Aware of the pattern
     * 2. Not fully triggered (accessible)
     * 3. Showing insight
     * 4. In relationship with therapist
     */
    identifyReprocessingWindows(currentTranscript, memoryInsights = {}) {
        const windows = [];

        const lower = currentTranscript.toLowerCase();

        // Window 1: Self-awareness
        if (lower.includes('i realize') || lower.includes('i notice') ||
            lower.includes('maybe') || lower.includes('i think')) {
            windows.push({
                type: 'self_awareness_window',
                indicator: 'Patient is making connections',
                opportunity: 'Build on this insight',
                intervention: 'Now that you see it, what do you want to change?',
                readiness: 'high'
            });
        }

        // Window 2: Safe relationship
        if (lower.includes('with you') || lower.includes('here') ||
            lower.includes('you are') && !lower.includes('you are wrong')) {
            windows.push({
                type: 'relational_safety_window',
                indicator: 'Patient feels safe in therapeutic relationship',
                opportunity: 'Practice new responses WITH therapist',
                intervention: 'Try something different right now, here with me',
                readiness: 'high'
            });
        }

        // Window 3: Emotional containment
        if (lower.includes('feeling') || lower.includes('emotion') ||
            lower.includes('scared') || lower.includes('hurt')) {
            windows.push({
                type: 'emotional_processing_window',
                indicator: 'Patient is in touch with emotions',
                opportunity: 'Process emotions that were frozen/blocked',
                intervention: 'What is this emotion trying to tell you?',
                readiness: 'medium'
            });
        }

        // Window 4: Choice/agency window
        if (lower.includes('i can') || lower.includes('i could') ||
            lower.includes('maybe i') || lower.includes('what if')) {
            windows.push({
                type: 'agency_expansion_window',
                indicator: 'Patient is accessing sense of agency',
                opportunity: 'Expand sense of choices and power',
                intervention: 'What choices do you have NOW that you did not have THEN?',
                readiness: 'high'
            });
        }

        // Window 5: Intergenerational healing
        if (lower.includes('father') || lower.includes('mother') ||
            lower.includes('parent') || lower.includes('family')) {
            windows.push({
                type: 'intergenerational_window',
                indicator: 'Patient is working with family patterns',
                opportunity: 'Break the cycle',
                intervention: 'What did you need from them that you never got?',
                readiness: 'depends on safety'
            });
        }

        return windows;
    }

    /**
     * INFER ORIGINAL EVENT
     * Memory insights'tan orijinal traumayı tahmin etme
     */
    inferOriginalEvent(memoryInsights = {}) {
        const themes = memoryInsights.primaryThemes || [];
        const themes_str = themes.join(' ').toLowerCase();

        if (themes_str.includes('father') || themes_str.includes('authority')) {
            return 'Experienced overwhelming authority without ability to protest or escape';
        } else if (themes_str.includes('abandonment') || themes_str.includes('alone')) {
            return 'Experienced loss of connection or rejection when vulnerable';
        } else if (themes_str.includes('control') || themes_str.includes('powerless')) {
            return 'Experienced loss of agency or control over own safety';
        } else {
            return 'Experienced a situation where current protective strategy developed';
        }
    }

    /**
     * INFER SURVIVAL STRATEGY
     * Nasıl hayatta kaldığını anlamak
     */
    infertSurvivalStrategy(memoryInsights = {}) {
        const themes = memoryInsights.primaryThemes || [];
        const themes_str = themes.join(' ').toLowerCase();

        if (themes_str.includes('freeze') || themes_str.includes('shutdown')) {
            return 'Developed strategy of going quiet and internal (freeze response)';
        } else if (themes_str.includes('control') || themes_str.includes('vigilant')) {
            return 'Developed hypervigilance - staying alert to control outcomes';
        } else if (themes_str.includes('comply') || themes_str.includes('please')) {
            return 'Developed people-pleasing - trying to prevent others\' anger';
        } else if (themes_str.includes('rage') || themes_str.includes('anger')) {
            return 'Developed aggressive defense - asserting power to prevent powerlessness';
        } else {
            return 'Developed protective strategy that kept you safe then';
        }
    }

    /**
     * GENERATE TEMPORAL INTERVENTION
     * Lyra'nın geçmiş-bugün bağlantısını göstermesi
     */
    generateTemporalIntervention(temporalMap) {
        if (!temporalMap) {
            return null;
        }

        const { presentTrigger, emotionalResonance, temporalChain, reprocessingOpportunities } = temporalMap;

        if (emotionalResonance.score < 0.4) {
            return null; // Not strong enough resonance to intervene
        }

        const triggerDesc = presentTrigger[0]?.trigger || 'this situation';
        const originalDesc = temporalChain.originalEvent.description;

        const intervention = {
            type: 'temporal_awareness',
            resonanceLevel: emotionalResonance.level,
            message: `
I notice something. When you talk about ${triggerDesc}, your nervous system seems to be
responding as if you are back in that time when ${originalDesc}.

But here is the thing: Then, you had no choice. You HAD to protect yourself that way.
Your body learned: "This means danger. I must react."

Today? You actually have choices that you did not have then.
You can speak up. You can leave. You can ask for help. You can say no.

Your old protection strategy? It was brilliant for then. But now it is keeping you small.

Would you be willing to try something different here, with me, while you are thinking about this?
            `,
            confidence: emotionalResonance.score,
            reprocessingWindows,
            purpose: 'Help patient see past-present link and access new choices'
        };

        return intervention;
    }
}

export default TemporalMappingEngine;
