/**
 * Defensive Pattern Analyzer
 *
 * "The Wisdom of Symptoms"
 *
 * Kaygı, sıkıntı, öfke - bunlar "sorun" değil, ÇÖZÜM'dür.
 * Vücut kendi kendini koruyor.
 *
 * En iyi terapistler fark ederler:
 * "Bu kaygı seni neden koruyor? Ne olur, rahatlarsan?"
 *
 * Örnek:
 * - Kaygı → Seni alertta tutuyor → Çünkü sürpriz saldırıdan korkmuyorsun
 * - Öfke → Seni güçlü tutuyor → Çünkü çaresiz/zayıf hissedişten korkuyorsun
 * - Shutdown → Seni gizliyor → Çünkü görülmek = bulunmak = saldırılmak
 *
 * Bu analyzer:
 * 1. Savunma mekanizmalarını tanır
 * 2. Onların fonksiyonunu anlar
 * 3. "Ne nöbeti bekliyor?" sorusunu sorar
 * 4. Dönüşüm imkanı gösterir
 */

import { logger } from '../../../lib/infrastructure/logger.js';

export class DefensivePatternAnalyzer {
    constructor(options = {}) {
        this.userId = options.userId;
        this.sessionId = options.sessionId;

        logger.info('[DefensiveAnalyzer] Initialized', {
            userId: this.userId
        });
    }

    /**
     * ANALYZE DEFENSIVE PATTERNS
     * Koruma mekanizmalarını bulur ve anlar
     */
    analyzeDefensivePatterns(transcript, somaticMarkers = {}, emotionalState = {}) {
        try {
            const patterns = {
                identifiedDefenses: this.identifyDefenses(transcript, somaticMarkers),
                primaryDefense: this.determinePrimaryDefense(transcript, somaticMarkers),
                defensiveFunction: this.analyzeFunction(transcript, emotionalState),
                originalWound: this.inferOriginalWound(transcript),
                transformationPath: this.identifyTransformationPath(transcript)
            };

            logger.info('[DefensiveAnalyzer] Patterns analyzed', {
                userId: this.userId,
                defenseCount: patterns.identifiedDefenses.length,
                primaryDefense: patterns.primaryDefense?.type
            });

            return patterns;
        } catch (error) {
            logger.error('[DefensiveAnalyzer] Analysis failed:', error);
            return null;
        }
    }

    /**
     * IDENTIFY DEFENSES
     * Hangi koruma mekanizmaları çalışıyor?
     *
     * Types:
     * - Anxiety (hyper-arousal)
     * - Numbness (hypo-arousal)
     * - Anger (fight response)
     * - Withdrawal (flight response)
     * - Compliance (freeze/submission)
     * - Dissociation (escape)
     */
    identifyDefenses(transcript, somaticMarkers = {}) {
        const defenses = [];

        if (!transcript) {
            return defenses;
        }

        const lower = transcript.toLowerCase();

        // Anxiety defense
        if (lower.includes('anxiety') || lower.includes('worried') ||
            lower.includes('scared') || lower.includes('panic')) {
            defenses.push({
                type: 'anxiety',
                description: 'Keeping body in alert state',
                function: 'Prevents being caught off-guard',
                somaticMarkers: ['muscle tension', 'racing heart', 'breath shallow'],
                cost: 'Exhaustion, sleep issues, hypervigilance'
            });
        }

        // Numbness/Shutdown
        if (lower.includes('numb') || lower.includes('cannot feel') ||
            lower.includes('empty') || lower.includes('disconnected')) {
            defenses.push({
                type: 'numbness',
                description: 'Disconnecting from overwhelming emotions',
                function: 'Prevents being overwhelmed by pain',
                somaticMarkers: ['flatness', 'disconnection', 'heaviness'],
                cost: 'Depression, inability to feel joy, relationships suffer'
            });
        }

        // Anger/Rage
        if (lower.includes('angry') || lower.includes('rage') ||
            lower.includes('furious') || lower.includes('snapped')) {
            defenses.push({
                type: 'anger',
                description: 'Fighting back / asserting power',
                function: 'Prevents feeling powerless/victimized',
                somaticMarkers: ['jaw clenching', 'fist tightening', 'heat/tension'],
                cost: 'Damaged relationships, isolation, guilt'
            });
        }

        // Withdrawal/Avoidance
        if (lower.includes('avoid') || lower.includes('isolate') ||
            lower.includes('hide') || lower.includes('pull away')) {
            defenses.push({
                type: 'withdrawal',
                description: 'Removing self from threat',
                function: 'Prevents rejection/attack by staying away',
                somaticMarkers: ['closing off', 'pulling inward', 'tension'],
                cost: 'Loneliness, lost relationships, missed opportunities'
            });
        }

        // Compliance/People-pleasing
        if (lower.includes('should') || lower.includes('have to') ||
            lower.includes('please') || lower.includes('appease')) {
            defenses.push({
                type: 'compliance',
                description: 'Complying/appeasing to prevent anger',
                function: 'Prevents triggering others\' harm',
                somaticMarkers: ['collapsed posture', 'soft voice', 'holding breath'],
                cost: 'Resentment, lost self, burnout'
            });
        }

        // Dissociation
        if (lower.includes('dissociate') || lower.includes('spacing out') ||
            lower.includes('zone out') || lower.includes('not there')) {
            defenses.push({
                type: 'dissociation',
                description: 'Leaving the body/mind',
                function: 'Escapes from unbearable reality',
                somaticMarkers: ['floating', 'detachment', 'unreality'],
                cost: 'Lost time, safety risks, fragmented memory'
            });
        }

        return defenses;
    }

    /**
     * DETERMINE PRIMARY DEFENSE
     * Hangisi en dominant?
     */
    determinePrimaryDefense(transcript, somaticMarkers = {}) {
        const defenses = this.identifyDefenses(transcript, somaticMarkers);

        if (defenses.length === 0) {
            return null;
        }

        // Primary = en çok mention edilen
        return defenses[0];
    }

    /**
     * ANALYZE FUNCTION
     * Bu savunma neyi koruyor? Ne korkusundan?
     *
     * Her defense'in altında bir korku var.
     */
    analyzeFunction(transcript, emotionalState = {}) {
        const lower = transcript.toLowerCase();
        const primaryEmotion = emotionalState.primary || 'unknown';

        let fears = [];
        let protectsAgainst = [];

        // Map emotions to fears
        if (lower.includes('anxiety') || primaryEmotion.includes('anxious')) {
            fears.push('Being caught off-guard');
            fears.push('Surprise attack or loss of control');
            protectsAgainst.push('Sudden harm');
            protectsAgainst.push('Being unaware when danger comes');
        }

        if (lower.includes('numb') || primaryEmotion.includes('empty')) {
            fears.push('Being overwhelmed by pain');
            fears.push('Feelings becoming unbearable');
            protectsAgainst.push('Drowning in emotion');
            protectsAgainst.push('Breakdown');
        }

        if (lower.includes('angry') || primaryEmotion.includes('rage')) {
            fears.push('Being weak/powerless');
            fears.push('Being victimized');
            protectsAgainst.push('Humiliation');
            protectsAgainst.push('Submission');
        }

        if (lower.includes('avoid') || lower.includes('isolate')) {
            fears.push('Being rejected');
            fears.push('Being hurt by others');
            protectsAgainst.push('Closer relationships');
            protectsAgainst.push('Vulnerability');
        }

        if (lower.includes('please') || lower.includes('comply')) {
            fears.push('Triggering others\' anger');
            fears.push('Being abandoned if not "good enough"');
            protectsAgainst.push('Rejection');
            protectsAgainst.push('Abandonment');
        }

        return {
            underlyingFears: [...new Set(fears)],
            protectsAgainst: [...new Set(protectsAgainst)],
            makeSense: 'These defenses made perfect sense given what happened',
            wereBrilliant: 'They kept you alive/safe at the time'
        };
    }

    /**
     * INFER ORIGINAL WOUND
     * Bu defense neyin cevabı?
     */
    inferOriginalWound(transcript) {
        const lower = transcript.toLowerCase();

        if (lower.includes('father') || lower.includes('authority')) {
            return {
                wound: 'Encountered overwhelming authority without ability to protest',
                impact: 'Learned: Speaking up is dangerous. Stay alert or go silent.',
                result: 'Anxiety or compliance defense developed'
            };
        }

        if (lower.includes('abandonment') || lower.includes('left alone')) {
            return {
                wound: 'Experienced loss when vulnerable',
                impact: 'Learned: Connection = pain. Stay detached.',
                result: 'Numbness or withdrawal defense developed'
            };
        }

        if (lower.includes('powerless') || lower.includes('helpless')) {
            return {
                wound: 'Lost control repeatedly without being able to do anything',
                impact: 'Learned: Powerlessness = danger. Must regain control.',
                result: 'Anger or hypercontrol defense developed'
            };
        }

        if (lower.includes('criticized') || lower.includes('shame')) {
            return {
                wound: 'Was shamed for being self',
                impact: 'Learned: Being seen = being judged/attacked.',
                result: 'Withdrawal or compliance defense developed'
            };
        }

        return {
            wound: 'Experienced threat or loss that required protection',
            impact: 'Developed defensive strategy to stay safe',
            result: 'Current pattern emerged'
        };
    }

    /**
     * IDENTIFY TRANSFORMATION PATH
     * Bu defense'den nasıl dışarı çıkılır?
     *
     * Key: Defense'i "bad" olarak görmek değil,
     * onun yerini yeni, daha adaptive responses'larla almak
     */
    identifyTransformationPath(transcript) {
        const lower = transcript.toLowerCase();

        if (lower.includes('anxiety')) {
            return {
                defense: 'Anxiety',
                transformation: 'From hypervigilance to discriminating vigilance',
                step: 'Learn what is actually dangerous vs. what just FEELS dangerous',
                experiential: 'In safe moments, practice staying calm. Build a new nervous system memory.',
                relational: 'With therapist, experience: I can stay present. I can be surprised and survive.'
            };
        }

        if (lower.includes('numb')) {
            return {
                defense: 'Numbness',
                transformation: 'From disconnection to grounded feeling',
                step: 'Safely reconnect with body, one sensation at a time',
                experiential: 'In safe moments, notice small sensations. Build tolerance for emotion.',
                relational: 'With therapist, experience: I can feel. The feelings do not destroy me.'
            };
        }

        if (lower.includes('angry') || lower.includes('rage')) {
            return {
                defense: 'Anger',
                transformation: 'From aggression to assertiveness',
                step: 'Channel anger into clean boundaries and honest expression',
                experiential: 'Practice saying "no" without attacking, requesting without collapsing',
                relational: 'With therapist, experience: I can assert myself. I can be powerful without harming.'
            };
        }

        if (lower.includes('avoid') || lower.includes('isolate')) {
            return {
                defense: 'Withdrawal',
                transformation: 'From isolation to selective engagement',
                step: 'Build tolerance for connection in small, safe doses',
                experiential: 'Practice staying present with another person even when nervous',
                relational: 'With therapist, experience: Closeness does not mean I will be hurt.'
            };
        }

        if (lower.includes('please') || lower.includes('comply')) {
            return {
                defense: 'Compliance',
                transformation: 'From self-abandonment to authentic presence',
                step: 'Learn to listen to own needs and express them',
                experiential: 'Practice saying what you truly want, even if it disappoints someone',
                relational: 'With therapist, experience: I can be myself. I am worthy as I am.'
            };
        }

        return {
            defense: 'Current pattern',
            transformation: 'Toward more flexible, adaptive responding',
            step: 'Understand the wisdom in your defense. Then choose when to use it.',
            experiential: 'Build new nervous system memories in safe moments',
            relational: 'This relationship is the laboratory for change'
        };
    }

    /**
     * GENERATE DEFENSIVE PATTERN INTERVENTION
     * Lyra'nın savunmayı şefkatle karşılaması
     */
    generateDefensivePatternIntervention(defensivePatterns) {
        if (!defensivePatterns || !defensivePatterns.primaryDefense) {
            return null;
        }

        const primary = defensivePatterns.primaryDefense;
        const func = defensivePatterns.defensiveFunction;
        const transform = defensivePatterns.transformationPath;

        const intervention = {
            type: 'defensive_pattern_reframing',
            defensiveType: primary.type,
            message: `
Let me tell you what I notice about your ${primary.type}.

It is protecting you from ${func.underlyingFears[0] || 'something deep'}.
That makes complete sense, because ${defensivePatterns.originalWound.impact}

Your ${primary.type} is BRILLIANT. It kept you safe.
It makes sense. It is not wrong.

Here is the thing though: The threat you are guarding against?
That threat is not here anymore.

So now your ${primary.type} is like a fire alarm going off when someone is just making toast.
It was warning you about real fire. But now it is just... exhausting.

What would happen if we helped you realize: the real danger has passed?
What if you could feel ${transform.step.toLowerCase()}?

That does not mean you lose all protection. You just get more flexibility.
You get to choose when to use this defense and when to relax.

Would you be willing to explore that with me?
            `,
            confidence: 0.8,
            originalWound: defensivePatterns.originalWound,
            transformationPath: transform,
            purpose: 'Help patient see their defense with compassion and recognize it can evolve'
        };

        return intervention;
    }
}

export default DefensivePatternAnalyzer;
