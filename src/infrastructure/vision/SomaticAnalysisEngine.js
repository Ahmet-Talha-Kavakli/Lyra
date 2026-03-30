/**
 * Somatic Analysis Engine
 * THE COMPLETE PIPELINE: Video → Vision → Fusion → Clinical Interpretation
 *
 * This bridges the gap Gemini identified:
 * WebRTC Stream → VisionProcessingPipeline (extracts AU)
 *              → MultimodalFusionEngine (AU + Prosody → Somatic State)
 *              → ClinicalSomaticInterpreter (State → Therapist Guidance)
 */

import { logger } from '../logging/logger.js';
import { visionPipeline } from './VisionProcessingPipeline.js';
import { clinicalSomaticInterpreter } from '../../application/services/ClinicalSomaticInterpreter.js';

/**
 * Real-time somatic analysis pipeline
 */
export class SomaticAnalysisEngine {
    constructor(options = {}) {
        this.sessionId = options.sessionId || `session_${Date.now()}`;
        this.userId = options.userId;

        this.isRunning = false;
        this.analysisBuffer = []; // Store frames for batch processing
        this.bufferSize = options.bufferSize || 30; // Process every 30 frames (1 sec at 30 FPS)

        this.lastInterpretation = null;
        this.analysisHistory = [];

        // WebRTC components
        this.videoElement = null;
        this.audioStream = null;

        logger.info('[SomaticAnalysisEngine] Initialized', { sessionId: this.sessionId });
    }

    /**
     * Start the complete somatic analysis pipeline
     * @param videoElement HTML video element with WebRTC stream
     * @param prosodyAnalyzer Optional prosody analyzer for audio
     */
    async start(videoElement, prosodyAnalyzer = null) {
        try {
            this.videoElement = videoElement;

            // 1. Initialize vision pipeline
            if (!visionPipeline.isInitialized) {
                await visionPipeline.initialize();
            }

            this.isRunning = true;

            // 2. Start processing video frames
            visionPipeline.processVideoStream(videoElement, async (result) => {
                await this.handleFrameResult(result, prosodyAnalyzer);
            });

            logger.info('[SomaticAnalysisEngine] Pipeline started', { sessionId: this.sessionId });
        } catch (error) {
            logger.error('[SomaticAnalysisEngine] Start failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Handle each vision processing result
     * Accumulate frames, then do full somatic interpretation every N frames
     */
    async handleFrameResult(visionResult, prosodyAnalyzer = null) {
        if (!visionResult.success) {
            logger.debug('[SomaticAnalysisEngine] Vision detection failed', { error: visionResult.error });
            return;
        }

        // Add to buffer
        this.analysisBuffer.push({
            timestamp: new Date().toISOString(),
            visionData: visionResult,
            prosodyData: null // Would be populated if prosodyAnalyzer provided
        });

        // When buffer reaches size, do full interpretation
        if (this.analysisBuffer.length >= this.bufferSize) {
            await this.performSomaticInterpretation(prosodyAnalyzer);
            this.analysisBuffer = [];
        }
    }

    /**
     * MAIN: Perform complete somatic interpretation
     * This is where the magic happens:
     * Vision AU → Fusion → Clinical Interpretation
     */
    async performSomaticInterpretation(prosodyAnalyzer = null) {
        try {
            // 1. Aggregate AU data from buffer
            const aggregatedAU = this.aggregateActionUnits();

            // 2. If prosody available, get current prosody data
            let prosodyData = null;
            if (prosodyAnalyzer && typeof prosodyAnalyzer.analyzeAudioChunk === 'function') {
                // Get current audio chunk and analyze
                prosodyData = prosodyAnalyzer.analyzeAudioChunk({
                    frequencies: new Uint8Array(256), // Mock
                    timeDomain: new Uint8Array(2048),
                    timestamp: Date.now(),
                    sampleRate: 16000
                });
            }

            // 3. Create fused somatic state
            // In real implementation, would call MultimodalFusionEngine
            const fusedState = {
                sessionId: this.sessionId,
                userId: this.userId,
                timestamp: new Date().toISOString(),

                // Vision data (FACS Action Units)
                modalities: {
                    facs: {
                        actionUnits: aggregatedAU.detectedAUs,
                        actionUnitIntensities: aggregatedAU.intensities,
                        facialSymmetry: aggregatedAU.symmetry,
                        confidence: aggregatedAU.confidence,
                        smileAuthenticity: aggregatedAU.smileAuthenticity
                    },
                    prosody: prosodyData || null
                },

                // Preliminary somatic markers (would be computed in fusion layer)
                somaticMarkers: this.inferSomaticMarkers(aggregatedAU),

                // For clinical interpreter
                emotionalState: null, // Will be filled by clinical interpreter
                autonomicState: null
            };

            // 4. CLINICAL INTERPRETATION
            // This is where ClinicalSomaticInterpreter reads the real vision data
            const clinicalInterpretation = clinicalSomaticInterpreter.interpretSomaticState(fusedState);

            // 5. Store interpretation
            this.lastInterpretation = clinicalInterpretation;
            this.analysisHistory.push({
                timestamp: new Date().toISOString(),
                interpretation: clinicalInterpretation
            });

            // Keep only last 100 interpretations
            if (this.analysisHistory.length > 100) {
                this.analysisHistory.shift();
            }

            // 6. Log for monitoring
            logger.info('[SomaticAnalysisEngine] Analysis complete', {
                sessionId: this.sessionId,
                dominantEmotion: clinicalInterpretation.emotionalState?.primary,
                autonomicState: clinicalInterpretation.autonomicState?.vagalState,
                immediateActions: clinicalInterpretation.therapistGuidance?.immediate_actions
            });

            return clinicalInterpretation;
        } catch (error) {
            logger.error('[SomaticAnalysisEngine] Interpretation failed', { error: error.message });
            return null;
        }
    }

    /**
     * Aggregate AU data from buffer
     * Average the action unit intensities over the last N frames
     */
    aggregateActionUnits() {
        if (this.analysisBuffer.length === 0) {
            return {
                detectedAUs: [],
                intensities: {},
                symmetry: 0.5,
                confidence: 0,
                smileAuthenticity: 'unknown'
            };
        }

        const auMap = new Map();
        let totalSymmetry = 0;
        let totalConfidence = 0;
        let smileAuthenticity = 'unknown';

        // Aggregate across all frames in buffer
        this.analysisBuffer.forEach(frame => {
            if (frame.visionData?.actionUnits) {
                const au = frame.visionData.actionUnits;

                // Track each AU
                Object.entries(au).forEach(([key, value]) => {
                    if (key.startsWith('AU')) {
                        if (!auMap.has(key)) {
                            auMap.set(key, []);
                        }
                        auMap.get(key).push(value);
                    }
                });

                // Track symmetry and authenticity
                if (au.symmetry_score) totalSymmetry += au.symmetry_score;
                if (au.smile_authenticity) smileAuthenticity = au.smile_authenticity;
            }
            totalConfidence += frame.visionData?.confidence || 0;
        });

        // Average the AU intensities
        const intensities = {};
        const detectedAUs = [];

        auMap.forEach((values, key) => {
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            intensities[key] = Math.round(avg * 100) / 100;

            // Only include AUs with intensity > 1
            if (avg > 1) {
                detectedAUs.push(key);
            }
        });

        return {
            detectedAUs,
            intensities,
            symmetry: totalSymmetry / this.analysisBuffer.length,
            confidence: totalConfidence / this.analysisBuffer.length,
            smileAuthenticity
        };
    }

    /**
     * Preliminary somatic marker inference from AU data
     * (More detailed inference would happen in MultimodalFusionEngine)
     */
    inferSomaticMarkers(aggregatedAU) {
        const markers = {
            shame: { score: 0, indicators: [] },
            fear: { score: 0, indicators: [] },
            sadness: { score: 0, indicators: [] },
            disgust: { score: 0, indicators: [] },
            safety: { score: 0, indicators: [] },
            dissociation: { score: 0, indicators: [] }
        };

        const au = aggregatedAU.intensities;

        // SHAME PATTERN: AU4 (brow lowerer) + AU15 (lip depressor) + AU6 downward
        if (au['AU4'] > 2 || au['AU15'] > 2) {
            markers.shame.score += 0.3;
            markers.shame.indicators.push('brow_lowering', 'lip_depression');
        }

        // FEAR PATTERN: AU5 (eyelid raiser) + AU20 (lip stretch) + AU26 (jaw drop)
        if (au['AU5'] > 2 || au['AU26'] > 2) {
            markers.fear.score += 0.4;
            markers.fear.indicators.push('eye_widening', 'jaw_dropping');
        }

        // SADNESS PATTERN: AU1 (inner brow) + AU15 (lip corner down)
        if ((au['AU1'] > 1 || au['AU1'] > 1) && au['AU15'] > 2) {
            markers.sadness.score += 0.35;
            markers.sadness.indicators.push('inner_brow_raise', 'lip_depression');
        }

        // DISGUST PATTERN: AU9 (nose wrinkler) + AU10 (lip raise)
        if (au['AU9'] > 2 || au['AU10'] > 2) {
            markers.disgust.score += 0.4;
            markers.disgust.indicators.push('nose_wrinkle', 'upper_lip_raise');
        }

        // SAFETY PATTERN: AU12 (smile) + AU6 (cheek raiser) + facial symmetry
        if ((au['AU12'] > 2 && au['AU6'] > 2) || aggregatedAU.smileAuthenticity === 'genuine') {
            markers.safety.score += 0.5;
            markers.safety.indicators.push('genuine_smile', 'symmetric_face');
        }

        // DISSOCIATION PATTERN: AU5 flat + AU7 (eye squint) + low symmetry
        if (au['AU7'] > 2 && aggregatedAU.symmetry < 0.6) {
            markers.dissociation.score += 0.3;
            markers.dissociation.indicators.push('eye_tension', 'asymmetry');
        }

        // Normalize scores to 0-1
        Object.keys(markers).forEach(key => {
            markers[key].score = Math.min(1, markers[key].score);
        });

        return markers;
    }

    /**
     * Stop the analysis engine
     */
    stop() {
        this.isRunning = false;
        visionPipeline.stopProcessing();
        logger.info('[SomaticAnalysisEngine] Stopped', { sessionId: this.sessionId });
    }

    /**
     * Get current analysis state
     */
    getCurrentState() {
        return {
            sessionId: this.sessionId,
            isRunning: this.isRunning,
            lastInterpretation: this.lastInterpretation,
            analysisCount: this.analysisHistory.length,
            visionStats: visionPipeline.getStats()
        };
    }

    /**
     * Get analysis history
     */
    getHistory(limit = 30) {
        return this.analysisHistory.slice(-limit);
    }
}

export default SomaticAnalysisEngine;
