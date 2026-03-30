/**
 * Congruence Engine
 *
 * KRITIK: Paradoksal Duygular (Paradoxical Emotions)
 *
 * "Gülerek ağlama" — İnsan ruh sağlığının en derinlerinde olur
 *
 * Problem: Lyra şu an:
 * - AU12 (gülümseme) = "patient is happy"
 * - AU26 (gözyaşı ifadesi) = "patient is sad"
 * Aynı anda her ikisi varsa → NE DİYECEK?
 *
 * Solution: "Incongruence Detection" (Tutarsızlık Tespiti)
 * Vücut dili + Ses + Konuşma metni = üçü birleşince GERÇEK anlamı bul
 *
 * Example:
 * - Face: AU12 (smile) + AU6 (cheek raise) = "HAPPY"
 * - Prosody: Voice shaky, pitch up, speech rate fast = "FEAR/ANXIETY"
 * - Transcript: "I'm fine, everything's okay" = DEFENSIVE
 *
 * Clinical Interpretation:
 * ✅ "You're smiling, but I hear fear in your voice"
 * ✅ "That laugh seems to be protecting something painful"
 * ✅ "There's a gap between what you're saying and what your body shows"
 */

import { logger } from '../logging/logger.js';

export class CongruenceEngine {
    constructor(options = {}) {
        this.userId = options.userId;
        this.sessionId = options.sessionId;

        // Thresholds for detection
        this.congruenceThreshold = options.congruenceThreshold || 0.7; // 0-1
        this.incongruenceThreshold = options.incongruenceThreshold || 0.5;

        logger.info('[CongruenceEngine] Initialized');
    }

    /**
     * MAIN: Analyze congruence across three modalities
     *
     * Modalities:
     * 1. FACIAL: FACS AU data
     * 2. VOCAL: Prosody (pitch, intensity, rate, quality)
     * 3. VERBAL: Speech content/transcript
     */
    analyzeCongruence(currentState) {
        try {
            const analysis = {
                timestamp: new Date().toISOString(),
                facialState: this.analyzeFacialState(currentState.facs),
                vocalState: this.analyzeVocalState(currentState.prosody),
                verbalState: this.analyzeVerbalState(currentState.transcript),
                congruence: null,
                incongruencePatterns: [],
                clinicalSignificance: null
            };

            // Compare across modalities
            analysis.congruence = this.compareModalities(analysis);

            // Detect incongruence patterns
            analysis.incongruencePatterns = this.detectIncongruencePatterns(analysis);

            // Generate clinical significance
            analysis.clinicalSignificance = this.generateClinicalSignificance(analysis);

            return analysis;
        } catch (error) {
            logger.error('[CongruenceEngine] Analysis failed', { error: error.message });
            return null;
        }
    }

    /**
     * Analyze facial state (FACS data)
     */
    analyzeFacialState(facsData) {
        if (!facsData) return null;

        const facial = {
            primaryEmotion: null,
            emotionFamily: null,
            intensity: 0,
            authenticity: null,
            keyAUs: []
        };

        // Determine primary emotion from AUs
        if (facsData.AU12 > 2 && facsData.AU6 > 2) {
            facial.primaryEmotion = 'happiness';
            facial.emotionFamily = 'positive';
            facial.authenticity = 'genuine'; // Duchenne smile
            facial.intensity = Math.max(facsData.AU12, facsData.AU6) / 5;
            facial.keyAUs = ['AU12', 'AU6'];
        } else if (facsData.AU12 > 2) {
            facial.primaryEmotion = 'happiness';
            facial.emotionFamily = 'positive';
            facial.authenticity = 'social'; // Social smile only
            facial.intensity = facsData.AU12 / 5;
            facial.keyAUs = ['AU12'];
        } else if (facsData.AU5 > 2 || facsData.AU26 > 2) {
            facial.primaryEmotion = 'fear';
            facial.emotionFamily = 'negative';
            facial.authenticity = 'genuine';
            facial.intensity = Math.max(facsData.AU5 || 0, facsData.AU26 || 0) / 5;
            facial.keyAUs = ['AU5', 'AU26'];
        } else if (facsData.AU4 > 2) {
            facial.primaryEmotion = 'anger';
            facial.emotionFamily = 'negative';
            facial.authenticity = 'genuine';
            facial.intensity = facsData.AU4 / 5;
            facial.keyAUs = ['AU4'];
        } else if (facsData.AU1 > 1) {
            facial.primaryEmotion = 'sadness';
            facial.emotionFamily = 'negative';
            facial.authenticity = 'genuine';
            facial.intensity = facsData.AU1 / 5;
            facial.keyAUs = ['AU1'];
        } else {
            facial.primaryEmotion = 'neutral';
            facial.emotionFamily = 'neutral';
            facial.intensity = 0;
        }

        return facial;
    }

    /**
     * Analyze vocal state (Prosody data)
     */
    analyzeVocalState(prosodyData) {
        if (!prosodyData) return null;

        const vocal = {
            primaryEmotion: null,
            emotionFamily: null,
            keyIndicators: [],
            confidence: 0
        };

        let emotionScore = 0;

        // High pitch + fast speech rate = anxiety/fear
        if ((prosodyData.pitch_normalized > 1.2) && (prosodyData.speech_rate_wpm > 150)) {
            vocal.primaryEmotion = 'anxiety';
            vocal.emotionFamily = 'negative';
            vocal.keyIndicators.push('high_pitch', 'fast_speech');
            emotionScore = 0.7;
        }

        // Low pitch + slow speech = sadness/depression
        if ((prosodyData.pitch_normalized < 0.8) && (prosodyData.speech_rate_wpm < 100)) {
            vocal.primaryEmotion = 'sadness';
            vocal.emotionFamily = 'negative';
            vocal.keyIndicators.push('low_pitch', 'slow_speech');
            emotionScore = 0.7;
        }

        // Voice quality: shaky/tremor = fear/emotion
        if (prosodyData.voice_quality?.tremor === 'high') {
            vocal.keyIndicators.push('voice_tremor');
            emotionScore = Math.max(emotionScore, 0.6);
            if (!vocal.primaryEmotion) {
                vocal.primaryEmotion = 'emotional_arousal';
                vocal.emotionFamily = 'aroused';
            }
        }

        // Voice quality: breathy = nervousness
        if (prosodyData.voice_quality?.breathiness === 'high') {
            vocal.keyIndicators.push('breathy_voice');
            emotionScore = Math.max(emotionScore, 0.5);
        }

        vocal.confidence = emotionScore;

        if (!vocal.primaryEmotion) {
            vocal.primaryEmotion = 'neutral';
            vocal.emotionFamily = 'neutral';
        }

        return vocal;
    }

    /**
     * Analyze verbal state (Transcript/speech content)
     */
    analyzeVerbalState(transcript) {
        if (!transcript) return null;

        const verbal = {
            contentEmotion: null,
            emotionFamily: null,
            defenseMechanisms: [],
            keyPhrases: [],
            confidence: 0
        };

        const text = transcript.toLowerCase();

        // Defensive phrases (minimization, intellectualization)
        const defensiveKeywords = [
            'i\'m fine', 'everything\'s okay', 'no worries', 'it\'s not that bad',
            'i don\'t care', 'whatever', 'doesn\'t matter', 'i\'m over it',
            'it is what it is', 'that\'s just how i am'
        ];

        defensiveKeywords.forEach(keyword => {
            if (text.includes(keyword)) {
                verbal.defenseMechanisms.push('minimization');
                verbal.keyPhrases.push(keyword);
            }
        });

        // Intellectualization (explaining feelings away)
        const intellectualKeywords = [
            'probably', 'i think', 'logically', 'the thing is', 'you see',
            'the reason is', 'it\'s because', 'the way i see it'
        ];

        intellectualKeywords.forEach(keyword => {
            if (text.includes(keyword)) {
                verbal.defenseMechanisms.push('intellectualization');
            }
        });

        // Sad content
        const sadKeywords = ['sad', 'depressed', 'lonely', 'alone', 'hurt', 'pain', 'loss'];
        const hasSadContent = sadKeywords.some(k => text.includes(k));
        if (hasSadContent) {
            verbal.contentEmotion = 'sadness';
            verbal.emotionFamily = 'negative';
            verbal.confidence = 0.8;
        }

        // Anxious content
        const anxiousKeywords = ['worried', 'anxious', 'nervous', 'scared', 'afraid', 'terrified'];
        const hasAnxiousContent = anxiousKeywords.some(k => text.includes(k));
        if (hasAnxiousContent) {
            verbal.contentEmotion = 'anxiety';
            verbal.emotionFamily = 'negative';
            verbal.confidence = 0.8;
        }

        if (!verbal.contentEmotion) {
            verbal.contentEmotion = 'neutral';
            verbal.emotionFamily = 'neutral';
            verbal.confidence = 0.5;
        }

        return verbal;
    }

    /**
     * COMPARE MODALITIES
     * Check if facial, vocal, and verbal are aligned
     */
    compareModalities(analysis) {
        const { facialState, vocalState, verbalState } = analysis;

        const comparison = {
            faceVsVoice: this.compareEmotions(facialState?.primaryEmotion, vocalState?.primaryEmotion),
            faceVsVerbal: this.compareEmotions(facialState?.primaryEmotion, verbalState?.contentEmotion),
            voiceVsVerbal: this.compareEmotions(vocalState?.primaryEmotion, verbalState?.contentEmotion),
            congruenceScore: 0,
            isCongruent: false,
            isIncongruent: false
        };

        // Calculate overall congruence
        const matches = [
            comparison.faceVsVoice.match ? 1 : 0,
            comparison.faceVsVerbal.match ? 1 : 0,
            comparison.voiceVsVerbal.match ? 1 : 0
        ].reduce((a, b) => a + b, 0);

        comparison.congruenceScore = matches / 3;
        comparison.isCongruent = comparison.congruenceScore >= this.congruenceThreshold;
        comparison.isIncongruent = comparison.congruenceScore <= this.incongruenceThreshold;

        return comparison;
    }

    /**
     * Helper: Compare two emotions (are they aligned?)
     */
    compareEmotions(emotion1, emotion2) {
        if (!emotion1 || !emotion2) {
            return { match: true, difference: 0 };
        }

        // Map emotions to families
        const emotionFamilies = {
            happiness: 'positive',
            joy: 'positive',
            sadness: 'negative',
            fear: 'negative',
            anxiety: 'negative',
            anger: 'negative',
            contempt: 'negative',
            neutral: 'neutral',
            emotional_arousal: 'aroused'
        };

        const family1 = emotionFamilies[emotion1] || 'unknown';
        const family2 = emotionFamilies[emotion2] || 'unknown';

        const match = family1 === family2;

        return {
            emotion1,
            emotion2,
            family1,
            family2,
            match
        };
    }

    /**
     * DETECT INCONGRUENCE PATTERNS
     * These are clinically significant misalignments
     */
    detectIncongruencePatterns(analysis) {
        const patterns = [];
        const { facialState, vocalState, verbalState, congruence } = analysis;

        // Pattern 1: DEFENSIVE SMILE
        // Happy face + sad/anxious voice/content = defense mechanism
        if (facialState?.primaryEmotion === 'happiness' &&
            (vocalState?.primaryEmotion === 'sadness' || verbalState?.contentEmotion === 'sadness')) {
            patterns.push({
                name: 'DEFENSIVE_SMILE',
                description: 'Patient smiling but voice/content shows sadness',
                defenseMechanism: 'repression/avoidance',
                clinicalSignificance: 'HIGH',
                recommendation: 'Gently point out: "I notice you\'re smiling, but your voice sounds sad. What\'s going on underneath?"'
            });
        }

        // Pattern 2: ANXIOUS DEFENSE
        // Happy/social smile + anxious voice = anxiety masked by politeness
        if (facialState?.primaryEmotion === 'happiness' &&
            vocalState?.primaryEmotion === 'anxiety') {
            patterns.push({
                name: 'ANXIOUS_POLITENESS',
                description: 'Patient masking anxiety with social smile',
                defenseMechanism: 'suppression',
                clinicalSignificance: 'MEDIUM',
                recommendation: 'Validate: "I hear some nervousness underneath. This might be worth exploring."'
            });
        }

        // Pattern 3: VERBAL DEFENSIVENESS
        // Any emotion + defensive speech = minimization
        if (verbalState?.defenseMechanisms.length > 0 &&
            facialState?.primaryEmotion !== 'neutral') {
            patterns.push({
                name: 'VERBAL_DEFENSIVENESS',
                description: `Patient using defense mechanism: ${verbalState.defenseMechanisms.join(', ')}`,
                defenseMechanism: verbalState.defenseMechanisms[0],
                clinicalSignificance: 'MEDIUM',
                recommendation: 'Gentle confrontation: "I notice you\'re saying it\'s fine, but your face/voice tells me something else."'
            });
        }

        // Pattern 4: AUTHENTIC CONGRUENCE
        // All three align = trust, authenticity
        if (congruence.isCongruent) {
            patterns.push({
                name: 'CONGRUENCE_WINDOW',
                description: 'Patient is congruent - face, voice, and words align',
                defenseMechanism: 'none',
                clinicalSignificance: 'THERAPEUTIC_OPPORTUNITY',
                recommendation: 'This is a good moment for deeper exploration. Patient is authentic.'
            });
        }

        return patterns;
    }

    /**
     * GENERATE CLINICAL SIGNIFICANCE
     */
    generateClinicalSignificance(analysis) {
        const { incongruencePatterns, congruence } = analysis;

        const significance = {
            level: 'LOW',
            patterns: incongruencePatterns,
            therapistActions: [],
            immediateResponses: []
        };

        if (congruence.isCongruent) {
            significance.level = 'THERAPEUTIC_OPPORTUNITY';
            significance.therapistActions.push(
                'Explore deeper material - patient is authentic',
                'Build on this safety window'
            );
        } else if (congruence.isIncongruent) {
            significance.level = 'HIGH';
            significance.therapistActions.push(
                'Gently point out the incongruence',
                'Create safety to explore what\'s being protected',
                'Normalize the defense mechanism'
            );

            incongruencePatterns.forEach(pattern => {
                significance.immediateResponses.push(pattern.recommendation);
            });
        }

        return significance;
    }

    /**
     * Get status
     */
    getStatus() {
        return {
            sessionId: this.sessionId,
            userId: this.userId,
            thresholds: {
                congruenceThreshold: this.congruenceThreshold,
                incongruenceThreshold: this.incongruenceThreshold
            }
        };
    }
}

export default CongruenceEngine;
