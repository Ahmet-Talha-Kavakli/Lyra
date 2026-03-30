/**
 * Multimodal Fusion Engine - Layer 3
 * Fuses FACS + Prosody + Temporal data into coherent somatic state
 * Based on Damasio's Somatic Markers, Porges' Polyvagal Theory, van der Kolk
 */

import { logger } from '../logging/logger.js';

export class MultimodalFusionEngine {
    constructor() {
        this.temporalBuffer = []; // Last 2 minutes
        this.somaticStateHistory = [];
        this.baselineState = null;
    }

    /**
     * Fuse FACS + Prosody + Context into single somatic state
     */
    fuseModalities(facsData, prosodyData, contextData = {}) {
        if (!facsData.detected) {
            return {
                timestamp: Date.now(),
                error: 'Face not detected',
                somaticMarkers: {},
                confidence: 0
            };
        }

        const fusedState = {
            timestamp: Date.now(),
            sessionId: contextData.sessionId,
            userId: contextData.userId,

            // Raw modality data
            modalities: {
                facs: facsData,
                prosody: prosodyData,
                context: contextData
            },

            // Computed somatic markers
            somaticMarkers: this.calculateSomaticMarkers(facsData, prosodyData),

            // Emotional state inference
            emotionalState: this.inferEmotionalState(facsData, prosodyData),

            // Body state (nervous system state)
            bodyState: this.inferBodyState(facsData, prosodyData),

            // Authenticity assessment
            authenticity: this.assessAuthenticity(facsData, prosodyData),

            // Confidence scores
            confidence: this.calculateConfidence(facsData, prosodyData),

            // Temporal analysis
            temporal: this.analyzeTemporalPatterns()
        };

        // Store in history
        this.temporalBuffer.push(fusedState);
        if (this.temporalBuffer.length > 120) { // 2 minutes at 1Hz
            this.temporalBuffer.shift();
        }

        return fusedState;
    }

    /**
     * Calculate Damasio's Somatic Markers
     * Maps biological signals to emotional-cognitive states
     */
    calculateSomaticMarkers(facsData, prosodyData) {
        const markers = {};

        // ============================================
        // MARKER 1: SHAME / EMBARRASSMENT (Insula)
        // ============================================
        if (this.isShamePattern(facsData, prosodyData)) {
            markers.shame = {
                score: this.calculateShameScore(facsData, prosodyData),
                indicators: [
                    facsData.actionUnits.includes('AU15') && 'lip_corner_down',
                    facsData.actionUnits.includes('AU1') && 'inner_brow_raised',
                    prosodyData.intensity.dB < -20 && 'voice_quiet',
                    prosodyData.prosodyPattern.pattern === 'flat' && 'monotone_speech'
                ].filter(Boolean),
                brainRegion: 'insula_ventromedial_prefrontal',
                physiology: 'facial_flush, increased_heart_rate, decreased_eye_contact',
                clinical_meaning: 'Self-conscious, feeling judged or exposed',
                therapeutic_note: 'Validate, reduce shame, rebuild safety'
            };
        }

        // ============================================
        // MARKER 2: FEAR / ANXIETY (Amygdala)
        // ============================================
        if (this.isFearPattern(facsData, prosodyData)) {
            markers.fear = {
                score: this.calculateFearScore(facsData, prosodyData),
                indicators: [
                    facsData.actionUnits.includes('AU5') && 'eyes_wide_open',
                    facsData.actionUnits.includes('AU1') && 'brows_raised',
                    facsData.actionUnits.includes('AU26') && 'mouth_open',
                    prosodyData.pitch.hz > 150 && 'voice_pitch_high',
                    prosodyData.voiceQuality.breathiness === 'high' && 'breathing_shallow'
                ].filter(Boolean),
                brainRegion: 'amygdala_locus_coeruleus',
                physiology: 'pupil_dilation, increased_heart_rate, muscle_tension, shallow_breathing',
                clinical_meaning: 'Perceiving threat, fight-or-flight activation',
                therapeutic_note: 'Grounding, safety building, slow down'
            };
        }

        // ============================================
        // MARKER 3: SADNESS / GRIEF (Anterior Cingulate)
        // ============================================
        if (this.isSadnessPattern(facsData, prosodyData)) {
            markers.sadness = {
                score: this.calculateSadnessScore(facsData, prosodyData),
                indicators: [
                    facsData.actionUnits.includes('AU15') && 'lip_corner_depressed',
                    facsData.actionUnits.includes('AU4') && 'brows_lowered',
                    facsData.symmetry.overall < 0.7 && 'facial_asymmetry',
                    prosodyData.prosodyPattern.pattern === 'falling' && 'falling_intonation'
                ].filter(Boolean),
                brainRegion: 'anterior_cingulate_dorsolateral_prefrontal',
                physiology: 'slowed_movement, withdrawn_posture, quiet_voice, fatigue',
                clinical_meaning: 'Loss, hopelessness, need for connection',
                therapeutic_note: 'Validate loss, build hope, connect'
            };
        }

        // ============================================
        // MARKER 4: DISGUST (Insula + Prefrontal)
        // ============================================
        if (this.isDisgustPattern(facsData, prosodyData)) {
            markers.disgust = {
                score: this.calculateDisgustScore(facsData, prosodyData),
                indicators: [
                    facsData.actionUnits.includes('AU9') && 'nose_wrinkled',
                    facsData.actionUnits.includes('AU10') && 'upper_lip_raised'
                ].filter(Boolean),
                brainRegion: 'insula_ventromedial_prefrontal',
                physiology: 'gag_reflex, nausea, withdrawal',
                clinical_meaning: 'Rejection, contamination concern, moral rejection',
                therapeutic_note: 'Explore values, self-acceptance'
            };
        }

        // ============================================
        // MARKER 5: SAFETY / CALM (Ventral Vagal - Porges)
        // ============================================
        if (this.isSafetyPattern(facsData, prosodyData)) {
            markers.safety = {
                score: this.calculateSafetyScore(facsData, prosodyData),
                indicators: [
                    facsData.symmetry.overall > 0.85 && 'facial_symmetry_high',
                    facsData.actionUnits.includes('AU12') && 'genuine_smile',
                    facsData.actionUnits.includes('AU6') && 'cheek_raiser',
                    prosodyData.voiceQuality.tension === 'low' && 'relaxed_voice',
                    prosodyData.prosodyPattern.pattern === 'rising' && 'engaged_intonation'
                ].filter(Boolean),
                brainRegion: 'ventral_vagal_social_engagement',
                physiology: 'soft_gaze, relaxed_shoulders, open_posture, slow_deep_breathing',
                clinical_meaning: 'Safe, connected, ready to engage',
                therapeutic_note: 'Leverage safety for deeper work'
            };
        }

        // ============================================
        // MARKER 6: DISSOCIATION / FREEZE (Dorsal Vagal)
        // ============================================
        if (this.isDissociationPattern(facsData, prosodyData)) {
            markers.dissociation = {
                score: this.calculateDissociationScore(facsData, prosodyData),
                indicators: [
                    facsData.actionUnits.length === 0 && 'blank_expression',
                    prosodyData.intensity.dB < -30 && 'barely_audible',
                    prosodyData.voiceQuality.breathiness === 'high' && 'whispered_voice',
                    facsData.eyeOpenness < 5 && 'glazed_eyes'
                ].filter(Boolean),
                brainRegion: 'dorsal_vagal_shutdown',
                physiology: 'immobile, low_heart_rate, shallow_breathing, no_eye_contact',
                clinical_meaning: 'Freeze response, disconnected from body/present',
                therapeutic_note: 'DO NOT PUSH. Gentle activation, present-moment anchoring'
            };
        }

        return markers;
    }

    /**
     * Infer emotional state from fused data
     */
    inferEmotionalState(facsData, prosodyData) {
        const primaryEmotions = [];
        const emotionScores = {
            happiness: this.scoreHappiness(facsData),
            sadness: this.calculateSadnessScore(facsData, prosodyData),
            fear: this.calculateFearScore(facsData, prosodyData),
            anger: this.scoreAnger(facsData),
            surprise: this.scoreSurprise(facsData),
            disgust: this.calculateDisgustScore(facsData, prosodyData),
            shame: this.calculateShameScore(facsData, prosodyData)
        };

        // Get top 2-3 emotions
        const sorted = Object.entries(emotionScores)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 3);

        return {
            primary: sorted[0]?.[0] || 'neutral',
            primaryScore: sorted[0]?.[1] || 0,
            secondary: sorted[1]?.[0],
            secondaryScore: sorted[1]?.[1] || 0,
            allScores: emotionScores,
            valence: this.calculateValence(facsData, prosodyData),
            arousal: this.calculateArousal(facsData, prosodyData),
            authenticity: this.assessEmotionAuthenticity(facsData),
            suppressionScore: this.calculateSuppressionScore(facsData, prosodyData)
        };
    }

    /**
     * Infer nervous system state (Polyvagal Theory - Porges)
     */
    inferBodyState(facsData, prosodyData) {
        let vagalState = 'unknown';
        let meaning = '';
        let therapeuticReadiness = '';
        let recommendations = [];

        if (this.isSafetyPattern(facsData, prosodyData)) {
            vagalState = 'ventral_vagal';
            meaning = 'Social engagement system active, safe and connected';
            therapeuticReadiness = 'High - ready for deep work';
            recommendations = [
                'Explore core patterns',
                'Gentle challenges to beliefs',
                'Build autonomy'
            ];
        } else if (this.isFearPattern(facsData, prosodyData)) {
            vagalState = 'sympathetic_activation';
            meaning = 'Fight-or-flight response, mobilized';
            therapeuticReadiness = 'Low - focus on stabilization';
            recommendations = [
                'Grounding techniques',
                'Breathing exercises',
                'Resource building',
                'Slow down pace'
            ];
        } else if (this.isDissociationPattern(facsData, prosodyData)) {
            vagalState = 'dorsal_vagal_shutdown';
            meaning = 'Freeze response, disconnected from body';
            therapeuticReadiness = 'Very Low - avoid deeper processing';
            recommendations = [
                'Gentle activation (movement, sound)',
                'Safe relationship building',
                'Present-moment anchoring',
                'Body awareness gradually'
            ];
        }

        return {
            vagalState: vagalState,
            meaning: meaning,
            therapeuticReadiness: therapeuticReadiness,
            recommendations: recommendations,
            muscularArmor: this.assessMuscularArmor(facsData),
            brainStem: this.assessBrainStemState(facsData, prosodyData)
        };
    }

    /**
     * Assess if emotion is genuine vs suppressed
     */
    assessAuthenticity(facsData, prosodyData) {
        // Genuine Duchenne smile: AU6 + AU12 + symmetrical
        const hasDuchenne = facsData.actionUnits.includes('AU6') &&
                           facsData.actionUnits.includes('AU12');

        const isSymmetrical = facsData.symmetry.overall > 0.85;

        // Congruence: does voice match face?
        const faceVoiceCongruence = this.assessFaceVoiceCongruence(facsData, prosodyData);

        return {
            isGenuine: hasDuchenne && isSymmetrical,
            duChenne: hasDuchenne,
            symmetry: facsData.symmetry.overall,
            faceVoiceMatch: faceVoiceCongruence,
            suppressionLevel: this.calculateSuppressionScore(facsData, prosodyData)
        };
    }

    /**
     * Calculate overall confidence
     */
    calculateConfidence(facsData, prosodyData) {
        return {
            facs: facsData.confidence || 0.9,
            prosody: prosodyData.intensity.confidence || 0.8,
            fusion: (facsData.confidence + (prosodyData.intensity.confidence || 0.8)) / 2,
            sufficientData: facsData.detected && prosodyData.pitch !== undefined
        };
    }

    /**
     * Analyze temporal patterns (trends, stability, transitions)
     */
    analyzeTemporalPatterns() {
        if (this.temporalBuffer.length < 10) {
            return { sufficient_data: false, samples: this.temporalBuffer.length };
        }

        const recentStates = this.temporalBuffer.slice(-30);

        return {
            trend: this.calculateStateTrend(recentStates),
            stability: this.calculateStateStability(recentStates),
            oscillations: this.detectOscillations(recentStates),
            transitions: this.detectStateTransitions(recentStates),
            sustained: this.findSustainedState(recentStates),
            durationInCurrentState: this.calculateDurationInState(recentStates)
        };
    }

    // ============================================
    // HELPER METHODS: Pattern Detection
    // ============================================

    isShamePattern(facsData, prosodyData) {
        return (facsData.actionUnits.includes('AU15') || facsData.actionUnits.includes('AU4')) &&
               (prosodyData.intensity.dB < -20 || prosodyData.prosodyPattern.pattern === 'flat');
    }

    isFearPattern(facsData, prosodyData) {
        return facsData.actionUnits.includes('AU5') &&
               (facsData.actionUnits.includes('AU1') || facsData.actionUnits.includes('AU26')) &&
               prosodyData.pitch.hz > 150;
    }

    isSadnessPattern(facsData, prosodyData) {
        return facsData.actionUnits.includes('AU15') &&
               prosodyData.prosodyPattern.pattern === 'falling';
    }

    isDisgustPattern(facsData, prosodyData) {
        return facsData.actionUnits.includes('AU9') || facsData.actionUnits.includes('AU10');
    }

    isSafetyPattern(facsData, prosodyData) {
        return facsData.symmetry.overall > 0.85 &&
               facsData.actionUnits.includes('AU12') &&
               prosodyData.voiceQuality.tension === 'low';
    }

    isDissociationPattern(facsData, prosodyData) {
        return facsData.actionUnits.length === 0 &&
               prosodyData.intensity.dB < -30;
    }

    // ============================================
    // HELPER METHODS: Scoring Functions
    // ============================================

    calculateShameScore(facsData, prosodyData) {
        let score = 0;
        if (facsData.actionUnits.includes('AU15')) score += 0.3;
        if (facsData.actionUnits.includes('AU4')) score += 0.2;
        if (prosodyData.intensity.dB < -20) score += 0.2;
        if (facsData.symmetry.overall < 0.75) score += 0.1;
        if (prosodyData.prosodyPattern.pattern === 'flat') score += 0.2;
        return Math.min(score, 1);
    }

    calculateFearScore(facsData, prosodyData) {
        let score = 0;
        if (facsData.actionUnits.includes('AU5')) score += 0.3;
        if (facsData.actionUnits.includes('AU1')) score += 0.2;
        if (facsData.actionUnits.includes('AU26')) score += 0.2;
        if (prosodyData.pitch.hz > 150) score += 0.2;
        if (prosodyData.voiceQuality.breathiness === 'high') score += 0.1;
        return Math.min(score, 1);
    }

    calculateSadnessScore(facsData, prosodyData) {
        let score = 0;
        if (facsData.actionUnits.includes('AU15')) score += 0.3;
        if (facsData.actionUnits.includes('AU4')) score += 0.2;
        if (prosodyData.prosodyPattern.pattern === 'falling') score += 0.2;
        if (facsData.symmetry.overall < 0.75) score += 0.15;
        if (prosodyData.intensity.dB < -15) score += 0.15;
        return Math.min(score, 1);
    }

    calculateDisgustScore(facsData, prosodyData) {
        let score = 0;
        if (facsData.actionUnits.includes('AU9')) score += 0.5;
        if (facsData.actionUnits.includes('AU10')) score += 0.5;
        return Math.min(score, 1);
    }

    calculateSafetyScore(facsData, prosodyData) {
        let score = 0;
        if (facsData.actionUnits.includes('AU12')) score += 0.3;
        if (facsData.actionUnits.includes('AU6')) score += 0.2;
        if (facsData.symmetry.overall > 0.85) score += 0.2;
        if (prosodyData.voiceQuality.tension === 'low') score += 0.15;
        if (prosodyData.prosodyPattern.pattern === 'rising') score += 0.15;
        return Math.min(score, 1);
    }

    calculateDissociationScore(facsData, prosodyData) {
        let score = 0;
        if (facsData.actionUnits.length === 0) score += 0.4;
        if (prosodyData.intensity.dB < -30) score += 0.3;
        if (facsData.eyeOpenness < 5) score += 0.3;
        return Math.min(score, 1);
    }

    scoreHappiness(facsData) {
        if (facsData.actionUnits.includes('AU6') && facsData.actionUnits.includes('AU12')) {
            return 0.9;
        } else if (facsData.actionUnits.includes('AU12')) {
            return 0.5;
        }
        return 0;
    }

    scoreAnger(facsData) {
        if (facsData.actionUnits.includes('AU4')) {
            return 0.7;
        }
        return 0;
    }

    scoreSurprise(facsData) {
        if (facsData.actionUnits.includes('AU5') && facsData.actionUnits.includes('AU26')) {
            return 0.9;
        } else if (facsData.actionUnits.includes('AU5')) {
            return 0.5;
        }
        return 0;
    }

    calculateValence(facsData, prosodyData) {
        // Positive: smile, raised cheeks, rising pitch
        // Negative: sadness markers, lowered pitch
        const positiveIndicators = facsData.actionUnits.includes('AU12') +
                                 facsData.actionUnits.includes('AU6') +
                                 (prosodyData.prosodyPattern.pattern === 'rising' ? 1 : 0);

        const negativeIndicators = facsData.actionUnits.includes('AU15') +
                                 facsData.actionUnits.includes('AU4') +
                                 (prosodyData.prosodyPattern.pattern === 'falling' ? 1 : 0);

        return (positiveIndicators - negativeIndicators) / 3;
    }

    calculateArousal(facsData, prosodyData) {
        // High arousal: wide eyes, high pitch, intense expression
        // Low arousal: relaxed, low pitch, minimal expression
        const highArousal = facsData.actionUnits.includes('AU5') +
                          (prosodyData.pitch.hz > 150 ? 1 : 0) +
                          (facsData.actionUnits.length > 3 ? 1 : 0);

        const lowArousal = (facsData.actionUnits.length === 0 ? 1 : 0) +
                         (prosodyData.pitch.hz < 100 ? 1 : 0);

        return (highArousal - lowArousal) / 3;
    }

    assessEmotionAuthenticity(facsData) {
        // Genuine smile: Duchenne (AU6 + AU12)
        const isDuchenne = facsData.actionUnits.includes('AU6') &&
                          facsData.actionUnits.includes('AU12');

        return {
            isDuchenne: isDuchenne,
            confidence: isDuchenne ? 0.95 : 0.3
        };
    }

    calculateSuppressionScore(facsData, prosodyData) {
        // Suppression: minimal facial movement but high voice pitch/intensity
        const minimalFace = facsData.actionUnits.length < 3;
        const activeVoice = prosodyData.intensity.dB > -15;

        return (minimalFace && activeVoice) ? 0.8 : 0.2;
    }

    assessFaceVoiceCongruence(facsData, prosodyData) {
        // Happy face + happy voice = match
        // Sad face + happy voice = mismatch
        const faceValence = this.scoreHappiness(facsData) - this.calculateSadnessScore(facsData, prosodyData);
        const voiceValence = prosodyData.prosodyPattern.pattern === 'rising' ? 0.5 : -0.5;

        const congruence = 1 - Math.abs(faceValence - voiceValence);
        return { congruence: congruence, match: congruence > 0.7 };
    }

    assessMuscularArmor(facsData) {
        // Tension in jaw, face, neck → holding emotions
        const tension = facsData.actionUnits.includes('AU7') +
                       facsData.actionUnits.includes('AU17');
        return { presence: tension > 0, severity: tension / 2 };
    }

    assessBrainStemState(facsData, prosodyData) {
        // Based on prosody patterns
        if (prosodyData.voiceQuality.breathiness === 'high') {
            return 'hyperaroused';
        } else if (prosodyData.intensity.dB < -25) {
            return 'hypoaroused';
        }
        return 'regulated';
    }

    calculateStateTrend(states) {
        if (states.length < 2) return null;
        const first = states[0].emotionalState.primary;
        const last = states[states.length - 1].emotionalState.primary;
        return first === last ? 'stable' : 'transitioning';
    }

    calculateStateStability(states) {
        if (states.length < 2) return 1;
        let changes = 0;
        for (let i = 1; i < states.length; i++) {
            if (states[i].emotionalState.primary !== states[i - 1].emotionalState.primary) {
                changes++;
            }
        }
        return 1 - (changes / states.length);
    }

    detectOscillations(states) {
        // Rapid emotional shifts indicate instability
        return null; // TODO: implement
    }

    detectStateTransitions(states) {
        // Track when emotional state changes
        const transitions = [];
        for (let i = 1; i < states.length; i++) {
            if (states[i].emotionalState.primary !== states[i - 1].emotionalState.primary) {
                transitions.push({
                    from: states[i - 1].emotionalState.primary,
                    to: states[i].emotionalState.primary,
                    timestamp: states[i].timestamp
                });
            }
        }
        return transitions;
    }

    findSustainedState(states) {
        const lastState = states[states.length - 1];
        let duration = 0;
        for (let i = states.length - 1; i >= 0; i--) {
            if (states[i].emotionalState.primary === lastState.emotionalState.primary) {
                duration++;
            } else {
                break;
            }
        }
        return {
            emotion: lastState.emotionalState.primary,
            durationFrames: duration,
            durationSeconds: duration // Approximately at 1Hz
        };
    }

    calculateDurationInState(states) {
        return this.findSustainedState(states).durationSeconds;
    }
}

export const multimodalFusionEngine = new MultimodalFusionEngine();

export default MultimodalFusionEngine;
