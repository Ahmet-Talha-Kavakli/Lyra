/**
 * Bayesian Confidence Scoring
 *
 * Intelligently combines signals from multiple modalities
 * - Prior: What we knew before
 * - Likelihood: How well does current data fit each hypothesis?
 * - Posterior: What we believe now (updated)
 *
 * Handles:
 * - Conflicting signals (smile + sad voice)
 * - Signal reliability (low-confidence vision → weight less)
 * - Temporal trends (is state changing?)
 * - Across-session updates (learning from patterns)
 */

import { logger } from '../../../lib/infrastructure/logger.js';

export class ConfidenceScorer {
    constructor(options = {}) {
        this.userId = options.userId;
        this.sessionId = options.sessionId;

        // Priors (baseline beliefs before seeing any data)
        // These get updated as we learn about the client
        this.priors = {
            emotions: {
                happy: 0.15,
                sad: 0.10,
                anxious: 0.25,
                safe: 0.30,
                angry: 0.10,
                neutral: 0.10
            },
            attachmentStyles: {
                secure: 0.25,
                anxious: 0.30,
                avoidant: 0.25,
                fearful: 0.20
            }
        };

        // Signal quality/reliability scores (0-1)
        // How trustworthy is each modality?
        this.signalQuality = {
            vision: 0.0,      // Starts low (not yet initialized)
            audio: 0.0,
            text: 1.0,        // Text is most reliable
            semantics: 0.95   // GPT semantic analysis is very reliable
        };

        // Historical signal patterns
        this.signalHistory = [];
        this.maxHistorySize = 100;

        // Conflicting signal cache
        this.recentConflicts = [];

        logger.info('[ConfidenceScorer] Initialized', { userId: this.userId });
    }

    /**
     * UPDATE PRIORS
     * Learn from this client's patterns across sessions
     * Call this at end of session with observed distributions
     */
    updatePriors(observedDistribution) {
        try {
            // Bayesian update: posterior becomes prior for next session
            // Simple averaging with exponential weighting
            const learningRate = 0.3; // How much to shift priors toward observations

            Object.entries(observedDistribution).forEach(([emotion, frequency]) => {
                if (this.priors.emotions[emotion]) {
                    // Weighted average: (old prior × 70%) + (observation × 30%)
                    this.priors.emotions[emotion] =
                        this.priors.emotions[emotion] * (1 - learningRate) +
                        frequency * learningRate;
                }
            });

            // Renormalize (ensure probabilities sum to 1)
            this.normalizePriors();

            logger.info('[ConfidenceScorer] Priors updated', {
                userId: this.userId,
                newPriors: this.priors.emotions
            });

        } catch (error) {
            logger.error('[ConfidenceScorer] Prior update failed', { error: error.message });
        }
    }

    /**
     * SCORE EMOTIONAL STATE
     * Combines Vision + Audio + Text + Semantic evidence using Bayes' rule
     */
    scoreEmotionalState(evidence) {
        try {
            const { visionData, audioData, textData, semanticData } = evidence;

            // Initialize posterior with priors
            const posterior = { ...this.priors.emotions };

            // ============ VISION LIKELIHOOD ============
            if (visionData && visionData.confidence > 0) {
                const visionLikelihood = this.calculateVisionLikelihood(visionData);

                // Weight vision by its confidence
                const visionWeight = visionData.confidence * this.signalQuality.vision;

                // Update posterior: P(emotion|vision) ∝ P(vision|emotion) × P(emotion)
                Object.entries(visionLikelihood).forEach(([emotion, likelihood]) => {
                    posterior[emotion] *= (1 + likelihood * visionWeight);
                });
            }

            // ============ AUDIO LIKELIHOOD ============
            if (audioData) {
                const audioLikelihood = this.calculateAudioLikelihood(audioData);
                const audioWeight = this.signalQuality.audio;

                Object.entries(audioLikelihood).forEach(([emotion, likelihood]) => {
                    posterior[emotion] *= (1 + likelihood * audioWeight);
                });
            }

            // ============ TEXT/SEMANTIC LIKELIHOOD ============
            if (semanticData) {
                const semanticLikelihood = this.calculateSemanticLikelihood(semanticData);
                const semanticWeight = this.signalQuality.semantics;

                Object.entries(semanticLikelihood).forEach(([emotion, likelihood]) => {
                    posterior[emotion] *= (1 + likelihood * semanticWeight);
                });
            }

            // ============ CONFLICT DETECTION ============
            const conflicts = this.detectConflicts(visionLikelihood, audioLikelihood, semanticLikelihood);
            if (conflicts.length > 0) {
                // Reduce overall confidence if signals contradict
                const conflictPenalty = 0.1 * conflicts.length;
                Object.keys(posterior).forEach(emotion => {
                    posterior[emotion] *= (1 - conflictPenalty);
                });

                logger.warn('[ConfidenceScorer] Signal conflicts detected', {
                    conflicts: conflicts.map(c => c.type)
                });
            }

            // Normalize posterior to probability distribution (sum = 1)
            this.normalizePosterior(posterior);

            // Get top emotion and confidence
            const topEmotion = Object.entries(posterior)
                .sort((a, b) => b[1] - a[1])[0];

            // Confidence = (top - second) / 2 → measures decisiveness
            const sorted = Object.values(posterior).sort((a, b) => b - a);
            const confidence = (sorted[0] - sorted[1]) / 2;

            const result = {
                primaryEmotion: topEmotion[0],
                primaryScore: topEmotion[1],
                confidence: Math.min(1, confidence), // Clamp to 1
                allScores: posterior,
                conflicts,
                reliability: this.assessReliability(evidence)
            };

            // Track in history
            this.addToHistory(result);

            logger.debug('[ConfidenceScorer] Emotion scored', {
                emotion: result.primaryEmotion,
                confidence: result.confidence.toFixed(2)
            });

            return result;

        } catch (error) {
            logger.error('[ConfidenceScorer] Scoring failed', { error: error.message });
            return {
                primaryEmotion: 'neutral',
                primaryScore: 0.5,
                confidence: 0.3,
                error: error.message
            };
        }
    }

    /**
     * CALCULATE VISION LIKELIHOOD
     * From FACS Action Units → emotion probabilities
     */
    calculateVisionLikelihood(visionData) {
        const likelihood = {
            happy: 0.1,
            sad: 0.1,
            anxious: 0.1,
            safe: 0.1,
            angry: 0.1,
            neutral: 0.1
        };

        if (!visionData.actionUnits) return likelihood;

        const au = visionData.actionUnits;

        // Happy: AU12 (smile) + AU6 (cheek raiser, Duchenne)
        if (au.AU12 && au.AU6) {
            likelihood.happy += 0.4;
            likelihood.safe += 0.2;
        }

        // Sad: AU15 (lip corner down) + AU1 (inner brow)
        if (au.AU15 && au.AU1) {
            likelihood.sad += 0.4;
        }

        // Anxious: AU5 (wide eyes) + AU1 (raised inner brow)
        if (au.AU5 && au.AU1) {
            likelihood.anxious += 0.35;
        }

        // Angry: AU4 (brow lowerer)
        if (au.AU4 > 2) {
            likelihood.angry += 0.4;
        }

        // Fear/Anxiety: AU26 (jaw drop) + AU5
        if (au.AU26) {
            likelihood.anxious += 0.2;
        }

        // Dissociation/Shutdown: blank expression
        if (!visionData.actionUnits || Object.keys(visionData.actionUnits).length === 0) {
            likelihood.anxious += 0.15; // Could be freeze
        }

        return likelihood;
    }

    /**
     * CALCULATE AUDIO LIKELIHOOD
     * From prosody → emotion probabilities
     */
    calculateAudioLikelihood(audioData) {
        const likelihood = {
            happy: 0.1,
            sad: 0.1,
            anxious: 0.1,
            safe: 0.1,
            angry: 0.1,
            neutral: 0.1
        };

        if (!audioData.pitch || !audioData.intensity) return likelihood;

        // Rising intonation = questionable/engaged → happy/safe
        if (audioData.prosodyPattern?.pattern === 'rising') {
            likelihood.happy += 0.2;
            likelihood.safe += 0.2;
        }

        // Falling intonation = assertive/sad
        if (audioData.prosodyPattern?.pattern === 'falling') {
            likelihood.sad += 0.2;
            likelihood.angry += 0.1;
        }

        // Monotone = depression/dissociation
        if (audioData.prosodyPattern?.pattern === 'flat') {
            likelihood.sad += 0.25;
            likelihood.anxious += 0.1;
        }

        // High pitch = anxiety/excitement
        if (audioData.pitch.hz > 150) {
            likelihood.anxious += 0.2;
            likelihood.happy += 0.15;
        }

        // Low pitch = sadness/control
        if (audioData.pitch.hz < 100) {
            likelihood.sad += 0.2;
            likelihood.angry += 0.1;
        }

        // Loud = anger/excitement
        if (audioData.intensity.dB > 0) {
            likelihood.angry += 0.2;
            likelihood.happy += 0.1;
        }

        // Quiet = sad/anxious/withdrawn
        if (audioData.intensity.dB < -20) {
            likelihood.sad += 0.2;
            likelihood.anxious += 0.15;
        }

        // Tremor = emotion/anxiety
        if (audioData.voiceQuality?.tremor) {
            likelihood.anxious += 0.25;
        }

        return likelihood;
    }

    /**
     * CALCULATE SEMANTIC LIKELIHOOD
     * From GPT semantic analysis → emotion/state probabilities
     */
    calculateSemanticLikelihood(semanticData) {
        const likelihood = {
            happy: 0.1,
            sad: 0.1,
            anxious: 0.1,
            safe: 0.1,
            angry: 0.1,
            neutral: 0.1
        };

        if (!semanticData) return likelihood;

        // Use attachment style as predictor
        if (semanticData.attachment?.primary_style === 'anxious') {
            likelihood.anxious += 0.3;
        }
        if (semanticData.attachment?.primary_style === 'secure') {
            likelihood.safe += 0.3;
        }

        // Use trauma severity
        if (semanticData.trauma?.severity === 'severe') {
            likelihood.anxious += 0.25;
            likelihood.sad += 0.2;
        }

        // Use schema detection
        if (semanticData.schemas?.includes('abandonment')) {
            likelihood.anxious += 0.2;
        }
        if (semanticData.schemas?.includes('failure')) {
            likelihood.sad += 0.2;
        }

        // Transference indicates emotional engagement
        if (semanticData.transference?.detected) {
            likelihood.anxious += 0.1; // Transference = emotionally activated
        }

        return likelihood;
    }

    /**
     * DETECT SIGNAL CONFLICTS
     * When modalities disagree
     */
    detectConflicts(vision, audio, semantic) {
        const conflicts = [];

        if (!vision || !audio) return conflicts;

        // Smiling but sad voice?
        if ((vision.happy || 0) > 0.2 && (audio.sad || 0) > 0.2) {
            conflicts.push({
                type: 'happy_face_sad_voice',
                severity: 'medium',
                interpretation: 'Possible suppressed emotion or politeness'
            });
        }

        // Sad face but happy voice?
        if ((vision.sad || 0) > 0.2 && (audio.happy || 0) > 0.2) {
            conflicts.push({
                type: 'sad_face_happy_voice',
                severity: 'medium',
                interpretation: 'Possible forced cheerfulness (masking)'
            });
        }

        // Words say happy but everything else says sad?
        if (semantic && (semantic.happy || 0) > 0.2) {
            if ((vision.sad || 0) > 0.2 && (audio.sad || 0) > 0.2) {
                conflicts.push({
                    type: 'happy_words_sad_body',
                    severity: 'high',
                    interpretation: 'Significant incongruence - possible depression or dissociation'
                });
            }
        }

        return conflicts;
    }

    /**
     * ASSESS OVERALL RELIABILITY
     * How much should we trust this assessment?
     */
    assessReliability(evidence) {
        let reliabilityScore = 0.5; // Start at 50%

        // Vision quality improves reliability
        if (evidence.visionData?.confidence > 0.7) {
            reliabilityScore += 0.15;
        }

        // Audio consistency improves reliability
        if (evidence.audioData?.frameCount > 10) {
            reliabilityScore += 0.1;
        }

        // Semantic analysis adds reliability
        if (evidence.semanticData) {
            reliabilityScore += 0.15;
        }

        // Congruence improves reliability
        if (evidence.congruenceScore > 0.8) {
            reliabilityScore += 0.1;
        }

        return Math.min(1, reliabilityScore);
    }

    /**
     * NORMALIZE TO PROBABILITY DISTRIBUTION
     */
    normalizePosterior(posterior) {
        const sum = Object.values(posterior).reduce((a, b) => a + b, 0);
        Object.keys(posterior).forEach(key => {
            posterior[key] /= sum || 1;
        });
    }

    normalizePriors() {
        const sum = Object.values(this.priors.emotions).reduce((a, b) => a + b, 0);
        Object.keys(this.priors.emotions).forEach(key => {
            this.priors.emotions[key] /= sum || 1;
        });
    }

    /**
     * TRACK HISTORY
     */
    addToHistory(result) {
        this.signalHistory.push({
            timestamp: Date.now(),
            emotion: result.primaryEmotion,
            confidence: result.confidence,
            conflicts: result.conflicts.length
        });

        if (this.signalHistory.length > this.maxHistorySize) {
            this.signalHistory.shift();
        }
    }

    /**
     * GET TRENDING EMOTION
     * What has the trend been over the last N samples?
     */
    getTrend(windowSize = 10) {
        if (this.signalHistory.length < 2) return null;

        const recent = this.signalHistory.slice(-windowSize);

        // Count emotion frequencies
        const emotionFreq = {};
        recent.forEach(entry => {
            emotionFreq[entry.emotion] = (emotionFreq[entry.emotion] || 0) + 1;
        });

        // Calculate average confidence
        const avgConfidence = recent.reduce((a, b) => a + b.confidence, 0) / recent.length;

        // Detect trend (is emotion changing?)
        const first = recent[0].emotion;
        const last = recent[recent.length - 1].emotion;
        const trend = first === last ? 'stable' : 'shifting';

        return {
            dominantEmotion: Object.entries(emotionFreq).sort((a, b) => b[1] - a[1])[0][0],
            frequency: Object.entries(emotionFreq),
            trend,
            avgConfidence,
            samples: recent.length
        };
    }

    /**
     * GET STATISTICS
     */
    getStats() {
        return {
            userId: this.userId,
            sessionId: this.sessionId,
            historySize: this.signalHistory.length,
            signalQuality: this.signalQuality,
            priors: this.priors.emotions,
            trend: this.getTrend()
        };
    }
}

export default ConfidenceScorer;
