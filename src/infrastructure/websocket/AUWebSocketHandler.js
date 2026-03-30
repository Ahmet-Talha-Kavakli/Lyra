/**
 * Action Units WebSocket Handler
 *
 * Backend receives FACS AU data from Frontend
 * Processes it through Clinical Interpreter
 * Sends back therapeutic guidance
 *
 * Real Architecture:
 * Frontend (Camera → Vision Processing)
 *         ↓ (WebSocket: lightweight AU JSON)
 * Backend (Clinical Interpretation)
 *         ↓ (WebSocket: therapist guidance)
 * Frontend (Display to therapist)
 */

import { logger } from '../logging/logger.js';
import { clinicalSomaticInterpreter } from '../../application/services/ClinicalSomaticInterpreter.js';
import { BaselineCalibration } from '../calibration/BaselineCalibration.js';
import { CongruenceEngine } from '../analysis/CongruenceEngine.js';
import { TemporalAnalyzer } from '../analysis/TemporalAnalyzer.js';

/**
 * Handle WebSocket connection for AU stream
 */
export class AUWebSocketHandler {
    constructor(ws, req) {
        this.ws = ws;
        this.req = req;

        this.sessionId = null;
        this.userId = null;
        this.isActive = true;

        // Analysis state
        this.analysisBuffer = [];
        this.lastInterpretation = null;
        this.lastCongruenceData = null; // Store latest frame for congruence analysis
        this.bufferSize = 30; // Aggregate 30 frames per analysis

        // ═══════════════════════════════════════════════════════════
        // NEW: Clinical Analysis Modules
        // ═══════════════════════════════════════════════════════════

        // 1. BASELINE CALIBRATION (first 60 seconds)
        this.baselineCalibration = new BaselineCalibration({
            userId: null, // Will be set on init
            sessionId: null,
            calibrationDuration: 60000, // 60 seconds
            frameThreshold: 100
        });

        // 2. CONGRUENCE ANALYSIS (facial + vocal + verbal)
        this.congruenceEngine = new CongruenceEngine({
            userId: null,
            sessionId: null,
            congruenceThreshold: 0.7,
            incongruenceThreshold: 0.5
        });

        // 3. TEMPORAL ANALYSIS (micro vs macro expressions)
        this.temporalAnalyzer = new TemporalAnalyzer({
            userId: null,
            sessionId: null,
            microExpressionWindow: 15,
            genuineExpressionWindow: 120,
            maxHistorySize: 300
        });

        // Calibration state
        this.isCalibrating = false;
        this.calibrationComplete = false;

        logger.info('[AUWebSocket] Connection established with analysis modules');
    }

    /**
     * Handle incoming messages from Frontend
     */
    handleMessage(message) {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'init':
                    this.handleInit(data);
                    break;

                case 'au_frame':
                    this.handleAUFrame(data);
                    break;

                case 'ping':
                    this.sendMessage({ type: 'pong' });
                    break;

                default:
                    logger.warn('[AUWebSocket] Unknown message type:', { type: data.type });
            }
        } catch (error) {
            logger.error('[AUWebSocket] Message handling error:', { error: error.message });
        }
    }

    /**
     * Handle initialization message from Frontend
     */
    handleInit(data) {
        this.sessionId = data.sessionId;
        this.userId = data.userId;

        // ═══════════════════════════════════════════════════════════
        // INITIALIZE ANALYSIS MODULES WITH SESSION DATA
        // ═══════════════════════════════════════════════════════════

        this.baselineCalibration.userId = this.userId;
        this.baselineCalibration.sessionId = this.sessionId;

        this.congruenceEngine.userId = this.userId;
        this.congruenceEngine.sessionId = this.sessionId;

        this.temporalAnalyzer.userId = this.userId;
        this.temporalAnalyzer.sessionId = this.sessionId;

        logger.info('[AUWebSocket] Session initialized', {
            sessionId: this.sessionId,
            userId: this.userId
        });

        // START BASELINE CALIBRATION
        this.isCalibrating = true;
        this.baselineCalibration.startCalibration().then(() => {
            this.isCalibrating = false;
            this.calibrationComplete = true;
            logger.info('[AUWebSocket] Baseline calibration complete', {
                sessionId: this.sessionId,
                baseline: this.baselineCalibration.baseline
            });
        });

        // Send confirmation + calibration status
        this.sendMessage({
            type: 'init_ack',
            sessionId: this.sessionId,
            message: 'Backend ready. Starting 60-second baseline calibration...',
            calibrationStarted: true,
            calibrationDuration: 60
        });
    }

    /**
     * Handle incoming AU frame from Frontend
     * INTEGRATED: Calibration + Congruence + Temporal + Clinical
     */
    handleAUFrame(data) {
        try {
            const { actionUnits, confidence, symmetry, smileAuthenticity, timestamp, prosody, transcript } = data;

            const frameData = {
                timestamp: timestamp,
                actionUnits: actionUnits,
                confidence: confidence,
                symmetry: symmetry,
                smileAuthenticity: smileAuthenticity,
                prosody: prosody,
                transcript: transcript
            };

            // Store for congruence analysis (will be used when buffer is full)
            this.lastCongruenceData = frameData;

            // ═══════════════════════════════════════════════════════════
            // PHASE 1: BASELINE CALIBRATION (first 60 seconds)
            // ═══════════════════════════════════════════════════════════

            if (this.isCalibrating) {
                // Add frame to baseline calibration
                this.baselineCalibration.addCalibrationFrame(frameData);

                // Send calibration progress
                const status = this.baselineCalibration.getStatus();
                this.sendMessage({
                    type: 'calibration_progress',
                    framesCollected: status.framesCollected,
                    progress: Math.round((status.framesCollected / 100) * 100) + '%'
                });

                return; // Don't process clinically during calibration
            }

            // ═══════════════════════════════════════════════════════════
            // PHASE 2: TEMPORAL ANALYSIS (track expression duration)
            // ═══════════════════════════════════════════════════════════

            this.temporalAnalyzer.addFrame(frameData);

            // ═══════════════════════════════════════════════════════════
            // PHASE 3: BUFFER FOR BATCH PROCESSING
            // ═══════════════════════════════════════════════════════════

            this.analysisBuffer.push(frameData);

            // When buffer reaches size, do FULL clinical interpretation
            if (this.analysisBuffer.length >= this.bufferSize) {
                this.performFullClinicalInterpretation();
                // Keep last frame for next batch's context
                this.analysisBuffer = [this.analysisBuffer[this.analysisBuffer.length - 1]];
            }

            // Log progress
            if (this.analysisBuffer.length % 10 === 0) {
                logger.debug('[AUWebSocket] Buffering AU data', {
                    sessionId: this.sessionId,
                    bufferSize: this.analysisBuffer.length
                });
            }
        } catch (error) {
            logger.error('[AUWebSocket] AU frame processing error:', { error: error.message });
        }
    }

    /**
     * FULL CLINICAL INTERPRETATION
     * Integrates: Baseline → Deviation → Congruence → Temporal → Clinical
     *
     * This is THE HEART of Lyra's intelligence:
     * 1. Convert absolute AU values to RELATIVE deviation from baseline
     * 2. Analyze congruence across facial + vocal + verbal modalities
     * 3. Track temporal patterns (micro vs macro expressions)
     * 4. Generate comprehensive clinical interpretation
     */
    performFullClinicalInterpretation() {
        try {
            // ═══════════════════════════════════════════════════════════
            // STEP 1: AGGREGATE AU DATA FROM BUFFER
            // ═══════════════════════════════════════════════════════════
            const aggregatedAU = this.aggregateActionUnits();

            // ═══════════════════════════════════════════════════════════
            // STEP 2: BASELINE DEVIATION ANALYSIS
            // Convert absolute values → relative deviations
            // ═══════════════════════════════════════════════════════════
            const deviationAnalysis = this.baselineCalibration.interpretWithBaseline(aggregatedAU);

            // ═══════════════════════════════════════════════════════════
            // STEP 3: TEMPORAL PATTERN ANALYSIS
            // Micro-expressions vs macro-expressions
            // ═══════════════════════════════════════════════════════════
            const temporalInsights = this.temporalAnalyzer.getTemporalInsights();

            // ═══════════════════════════════════════════════════════════
            // STEP 4: CONGRUENCE ANALYSIS
            // Facial + Vocal + Verbal alignment
            // ═══════════════════════════════════════════════════════════
            // Note: Store congruenceData BEFORE aggregation clears buffer
            const congruenceData = this.lastCongruenceData || {};
            const congruenceAnalysis = this.congruenceEngine.analyzeCongruence({
                facs: aggregatedAU,
                prosody: congruenceData.prosody,
                transcript: congruenceData.transcript
            });

            // ═══════════════════════════════════════════════════════════
            // STEP 5: CREATE COMPREHENSIVE SOMATIC STATE
            // This goes to ClinicalSomaticInterpreter
            // ═══════════════════════════════════════════════════════════

            // CRITICAL: Infer somatic markers from DEVIATIONS (not absolute AU values)
            // This ensures markers match ClinicalSomaticInterpreter's expectations:
            // shame, fear, sadness, disgust, safety, dissociation
            const somaticMarkers = this.inferSomaticMarkers(deviationAnalysis, aggregatedAU);

            const fusedState = {
                sessionId: this.sessionId,
                userId: this.userId,
                timestamp: new Date().toISOString(),

                // Vision data (with baseline deviation)
                modalities: {
                    facs: {
                        actionUnits: Object.keys(aggregatedAU.intensities),
                        actionUnitIntensities: aggregatedAU.intensities,
                        baselineDeviation: deviationAnalysis.deviations,
                        facialSymmetry: aggregatedAU.symmetry,
                        confidence: aggregatedAU.confidence,
                        smileAuthenticity: aggregatedAU.smileAuthenticity
                    },
                    prosody: congruenceData.prosody
                },

                // Clinical markers (based on DEVIATION from baseline, not absolute)
                // These are: shame, fear, sadness, disgust, safety, dissociation
                somaticMarkers: somaticMarkers,

                // Congruence data
                congruenceAnalysis: congruenceAnalysis,

                // Temporal data
                temporalPatterns: temporalInsights,

                // Metadata
                calibrationQuality: this.baselineCalibration.calibrationQuality,
                analysisConfidence: deviationAnalysis.confidence
            };

            // ═══════════════════════════════════════════════════════════
            // STEP 6: CLINICAL INTERPRETATION
            // ClinicalSomaticInterpreter receives CALIBRATED data
            // ═══════════════════════════════════════════════════════════
            const interpretation = clinicalSomaticInterpreter.interpretSomaticState(fusedState);

            this.lastInterpretation = interpretation;

            // ═══════════════════════════════════════════════════════════
            // STEP 7: ENHANCE WITH INCONGRUENCE INSIGHTS
            // ═══════════════════════════════════════════════════════════
            if (congruenceAnalysis?.incongruencePatterns?.length > 0) {
                interpretation.incongruencePatterns = congruenceAnalysis.incongruencePatterns;
                interpretation.clinicalSignificance = congruenceAnalysis.clinicalSignificance;
            }

            // ═══════════════════════════════════════════════════════════
            // STEP 8: SEND TO FRONTEND
            // ═══════════════════════════════════════════════════════════
            this.sendMessage({
                type: 'therapist_guidance',
                sessionId: this.sessionId,
                guidance: interpretation.therapistGuidance,
                emotionalState: interpretation.emotionalState,
                autonomicState: interpretation.autonomicState,
                somaticMarkers: interpretation.somaticMarkers,
                recommendations: interpretation.recommendations,

                // NEW: Rich clinical data
                baselineDeviation: deviationAnalysis.deviations,
                congruencePatterns: congruenceAnalysis?.incongruencePatterns,
                temporalAnalysis: temporalInsights,
                calibrationQuality: this.baselineCalibration.calibrationQuality,

                timestamp: new Date().toISOString()
            });

            logger.info('[AUWebSocket] Full clinical analysis complete', {
                sessionId: this.sessionId,
                emotionalState: interpretation.emotionalState?.primary,
                autonomicState: interpretation.autonomicState?.vagalState,
                congruenceScore: congruenceAnalysis?.congruence?.congruenceScore,
                calibrationQuality: this.baselineCalibration.calibrationQuality
            });
        } catch (error) {
            logger.error('[AUWebSocket] Clinical interpretation failed:', { error: error.message });
        }
    }

    /**
     * Aggregate AU data from buffer
     */
    aggregateActionUnits() {
        const auMap = new Map();
        let totalSymmetry = 0;
        let totalConfidence = 0;
        let lastSmileAuthenticity = 'unknown';

        this.analysisBuffer.forEach(frame => {
            const au = frame.actionUnits;

            // Aggregate each AU
            Object.entries(au).forEach(([key, value]) => {
                if (key.startsWith('AU') && typeof value === 'number') {
                    if (!auMap.has(key)) {
                        auMap.set(key, []);
                    }
                    auMap.get(key).push(value);
                }
            });

            totalSymmetry += frame.symmetry || 0;
            totalConfidence += frame.confidence || 0;
            lastSmileAuthenticity = frame.smileAuthenticity;
        });

        // Average
        const intensities = {};
        const detectedAUs = [];

        auMap.forEach((values, key) => {
            const avg = values.reduce((a, b) => a + b, 0) / values.length;
            intensities[key] = Math.round(avg * 100) / 100;

            if (avg > 1) {
                detectedAUs.push(key);
            }
        });

        return {
            detectedAUs,
            intensities,
            symmetry: totalSymmetry / this.analysisBuffer.length,
            confidence: totalConfidence / this.analysisBuffer.length,
            smileAuthenticity: lastSmileAuthenticity
        };
    }

    /**
     * Infer somatic markers from DEVIATION-BASED AU data
     *
     * CRITICAL: Uses deviations from baseline, NOT absolute AU values
     * This ensures markers match what ClinicalSomaticInterpreter expects:
     * shame, fear, sadness, disgust, safety, dissociation
     *
     * @param {Object} deviationAnalysis - Output from baselineCalibration.interpretWithBaseline()
     * @param {Object} aggregatedAU - Aggregated AU data with symmetry and authenticity
     */
    inferSomaticMarkers(deviationAnalysis, aggregatedAU) {
        const markers = {
            shame: { score: 0, indicators: [] },
            fear: { score: 0, indicators: [] },
            sadness: { score: 0, indicators: [] },
            disgust: { score: 0, indicators: [] },
            safety: { score: 0, indicators: [] },
            dissociation: { score: 0, indicators: [] }
        };

        const deviations = deviationAnalysis.deviations || {};

        // ═══════════════════════════════════════════════════════════
        // SHAME: Brow lowering (AU4) + Lip depression (AU15)
        // Relative deviation from baseline indicates shame/guilt
        // ═══════════════════════════════════════════════════════════
        const au4Dev = deviations['AU4']?.deviation || 0;
        const au15Dev = deviations['AU15']?.deviation || 0;
        if (au4Dev > 1 || au15Dev > 1) {
            markers.shame.score = Math.min(1, Math.max(au4Dev, au15Dev) / 3);
            markers.shame.indicators.push('brow_lowering', 'lip_depression');
        }

        // ═══════════════════════════════════════════════════════════
        // FEAR: Eye widening (AU5) + Jaw drop (AU26)
        // Deviation indicates fear/threat response
        // ═══════════════════════════════════════════════════════════
        const au5Dev = deviations['AU5']?.deviation || 0;
        const au26Dev = deviations['AU26']?.deviation || 0;
        if (au5Dev > 1 || au26Dev > 1) {
            markers.fear.score = Math.min(1, (Math.max(au5Dev, au26Dev) / 3));
            markers.fear.indicators.push('eye_widening', 'jaw_dropping');
        }

        // ═══════════════════════════════════════════════════════════
        // SADNESS: Inner brow raise (AU1)
        // Elevation from baseline indicates sadness/grief
        // ═══════════════════════════════════════════════════════════
        const au1Dev = deviations['AU1']?.deviation || 0;
        if (au1Dev > 0.5) {
            markers.sadness.score = Math.min(1, au1Dev / 2);
            markers.sadness.indicators.push('inner_brow_raise');
        }

        // ═══════════════════════════════════════════════════════════
        // DISGUST: Nose wrinkler (AU9) + Upper lip raise (AU10)
        // Deviation indicates disgust/rejection
        // ═══════════════════════════════════════════════════════════
        const au9Dev = deviations['AU9']?.deviation || 0;
        const au10Dev = deviations['AU10']?.deviation || 0;
        if (au9Dev > 1 || au10Dev > 1) {
            markers.disgust.score = Math.min(1, Math.max(au9Dev, au10Dev) / 3);
            markers.disgust.indicators.push('nose_wrinkle', 'upper_lip_raise');
        }

        // ═══════════════════════════════════════════════════════════
        // SAFETY: Genuine smile (AU6 + AU12) with positive baseline
        // Indicates felt safety, ventral vagal engagement
        // ═══════════════════════════════════════════════════════════
        const au6Dev = deviations['AU6']?.deviation || 0;
        const au12Dev = deviations['AU12']?.deviation || 0;
        if ((au12Dev > 1 && au6Dev > 0.5) && aggregatedAU?.smileAuthenticity === 'genuine') {
            markers.safety.score = Math.min(1, 0.8);
            markers.safety.indicators.push('genuine_smile', 'positive_engagement');
        }

        // ═══════════════════════════════════════════════════════════
        // DISSOCIATION: Eye tension (AU7) + Facial asymmetry
        // Indicates shutdown, protective disconnection
        // ═══════════════════════════════════════════════════════════
        const au7Dev = deviations['AU7']?.deviation || 0;
        const symmetry = aggregatedAU?.symmetry || 1;
        if (au7Dev > 1 && symmetry < 0.65) {
            markers.dissociation.score = Math.min(1, 0.7);
            markers.dissociation.indicators.push('eye_tension', 'facial_asymmetry');
        }

        return markers;
    }

    /**
     * Send message to Frontend
     */
    sendMessage(data) {
        if (this.ws.readyState === 1) { // OPEN
            try {
                this.ws.send(JSON.stringify(data));
            } catch (error) {
                logger.error('[AUWebSocket] Send failed:', { error: error.message });
            }
        }
    }

    /**
     * Handle connection close
     */
    handleClose() {
        this.isActive = false;
        logger.info('[AUWebSocket] Connection closed', { sessionId: this.sessionId });
    }

    /**
     * Get handler stats
     */
    getStats() {
        return {
            sessionId: this.sessionId,
            userId: this.userId,
            isActive: this.isActive,
            bufferSize: this.analysisBuffer.length,
            lastInterpretation: this.lastInterpretation ? {
                timestamp: this.lastInterpretation.timestamp,
                emotionalState: this.lastInterpretation.emotionalState?.primary
            } : null
        };
    }
}

export default AUWebSocketHandler;
