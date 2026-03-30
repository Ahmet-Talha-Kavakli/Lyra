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
        this.bufferSize = 30; // Aggregate 30 frames per analysis

        logger.info('[AUWebSocket] Connection established');
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

        logger.info('[AUWebSocket] Session initialized', {
            sessionId: this.sessionId,
            userId: this.userId
        });

        // Send confirmation
        this.sendMessage({
            type: 'init_ack',
            sessionId: this.sessionId,
            message: 'Backend ready to receive AU data'
        });
    }

    /**
     * Handle incoming AU frame from Frontend
     * This is the KEY: Frontend sends lightweight JSON, Backend does clinical work
     */
    handleAUFrame(data) {
        try {
            const { actionUnits, confidence, symmetry, smileAuthenticity, timestamp } = data;

            // 1. Buffer the AU data
            this.analysisBuffer.push({
                timestamp: timestamp,
                actionUnits: actionUnits,
                confidence: confidence,
                symmetry: symmetry,
                smileAuthenticity: smileAuthenticity
            });

            // 2. When buffer reaches size, do clinical interpretation
            if (this.analysisBuffer.length >= this.bufferSize) {
                this.performClinicalInterpretation();
                this.analysisBuffer = [];
            }

            // 3. Log periodic stats
            if (this.analysisBuffer.length % 10 === 0) {
                logger.debug('[AUWebSocket] Buffering AU data', {
                    sessionId: this.sessionId,
                    bufferSize: this.analysisBuffer.length,
                    frameCount: this.analysisBuffer.length
                });
            }
        } catch (error) {
            logger.error('[AUWebSocket] AU frame processing error:', { error: error.message });
        }
    }

    /**
     * MAIN LOGIC: Process buffered AU data through Clinical Interpreter
     * This is where Frontend's vision data meets Backend's clinical logic
     */
    performClinicalInterpretation() {
        try {
            // 1. Aggregate AU data from buffer
            const aggregatedAU = this.aggregateActionUnits();

            // 2. Create somatic state from Frontend's vision data
            const fusedState = {
                sessionId: this.sessionId,
                userId: this.userId,
                timestamp: new Date().toISOString(),

                // REAL DATA from Frontend's Vision Pipeline
                modalities: {
                    facs: {
                        actionUnits: Object.keys(aggregatedAU.intensities),
                        actionUnitIntensities: aggregatedAU.intensities,
                        facialSymmetry: aggregatedAU.symmetry,
                        confidence: aggregatedAU.confidence,
                        smileAuthenticity: aggregatedAU.smileAuthenticity
                    },
                    prosody: null // Would come from separate audio processing
                },

                // Preliminary somatic markers
                somaticMarkers: this.inferSomaticMarkers(aggregatedAU)
            };

            // 3. Clinical Interpretation (THIS IS THE HEART)
            // ClinicalSomaticInterpreter now processes REAL vision data, not mocks
            const interpretation = clinicalSomaticInterpreter.interpretSomaticState(fusedState);

            this.lastInterpretation = interpretation;

            // 4. Send therapist guidance back to Frontend
            this.sendMessage({
                type: 'therapist_guidance',
                sessionId: this.sessionId,
                guidance: interpretation.therapistGuidance,
                emotionalState: interpretation.emotionalState,
                autonomicState: interpretation.autonomicState,
                somaticMarkers: interpretation.somaticMarkers,
                recommendations: interpretation.recommendations,
                timestamp: new Date().toISOString()
            });

            logger.info('[AUWebSocket] Clinical interpretation complete', {
                sessionId: this.sessionId,
                emotionalState: interpretation.emotionalState?.primary,
                autonomicState: interpretation.autonomicState?.vagalState
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
     * Infer somatic markers from AU data
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

        // SHAME: Brow lowering + Lip depression
        if ((au['AU4'] || 0) > 2 || (au['AU15'] || 0) > 2) {
            markers.shame.score = Math.min(1, (au['AU4'] || 0) / 5 * 0.5 + (au['AU15'] || 0) / 5 * 0.5);
            markers.shame.indicators.push('brow_lowering', 'lip_depression');
        }

        // FEAR: Eye widening + Jaw drop
        if ((au['AU5'] || 0) > 2 || (au['AU26'] || 0) > 2) {
            markers.fear.score = Math.min(1, (au['AU5'] || 0) / 5 * 0.5 + (au['AU26'] || 0) / 5 * 0.5);
            markers.fear.indicators.push('eye_widening', 'jaw_dropping');
        }

        // SADNESS: Inner brow + Lip corner down
        if ((au['AU1'] || 0) > 1) {
            markers.sadness.score = Math.min(1, (au['AU1'] || 0) / 5);
            markers.sadness.indicators.push('inner_brow_raise');
        }

        // DISGUST: Nose wrinkler + Upper lip raise
        if ((au['AU9'] || 0) > 2 || (au['AU10'] || 0) > 2) {
            markers.disgust.score = Math.min(1, (au['AU9'] || 0) / 5 * 0.5 + (au['AU10'] || 0) / 5 * 0.5);
            markers.disgust.indicators.push('nose_wrinkle');
        }

        // SAFETY: Genuine smile (AU6 + AU12)
        if ((au['AU12'] || 0) > 2 && (au['AU6'] || 0) > 2 && aggregatedAU.smileAuthenticity === 'genuine') {
            markers.safety.score = 0.8;
            markers.safety.indicators.push('genuine_smile');
        }

        // DISSOCIATION: Eye tension + Asymmetry
        if ((au['AU7'] || 0) > 2 && aggregatedAU.symmetry < 0.6) {
            markers.dissociation.score = 0.6;
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
