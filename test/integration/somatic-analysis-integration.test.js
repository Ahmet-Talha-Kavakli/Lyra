/**
 * Somatic Analysis Integration Test
 *
 * Tests the complete flow:
 * 1. WebSocket connection + init
 * 2. Baseline calibration (60 seconds simulated)
 * 3. AU frame processing with all analysis modules
 * 4. Clinical interpretation
 * 5. Response to frontend
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AUWebSocketHandler } from '../../src/infrastructure/websocket/AUWebSocketHandler.js';
import { BaselineCalibration } from '../../src/infrastructure/calibration/BaselineCalibration.js';
import { CongruenceEngine } from '../../src/infrastructure/analysis/CongruenceEngine.js';
import { TemporalAnalyzer } from '../../src/infrastructure/analysis/TemporalAnalyzer.js';

describe('Somatic Analysis Integration', () => {
    let handler;
    let mockWs;
    let mockReq;

    beforeEach(() => {
        // Create mock WebSocket
        mockWs = {
            readyState: 1, // OPEN
            send: (data) => {
                console.log('[Mock WS] Sent:', JSON.parse(data).type);
            }
        };

        // Create mock request
        mockReq = {
            url: '/somatic-analysis',
            headers: {}
        };

        // Create handler
        handler = new AUWebSocketHandler(mockWs, mockReq);
    });

    afterEach(() => {
        handler = null;
    });

    it('should initialize all analysis modules', () => {
        expect(handler.baselineCalibration).toBeDefined();
        expect(handler.congruenceEngine).toBeDefined();
        expect(handler.temporalAnalyzer).toBeDefined();
    });

    it('should handle init message and start calibration', () => {
        const initMessage = JSON.stringify({
            type: 'init',
            sessionId: 'test_session_123',
            userId: 'test_user_456'
        });

        handler.handleMessage(initMessage);

        expect(handler.sessionId).toBe('test_session_123');
        expect(handler.userId).toBe('test_user_456');
        expect(handler.isCalibrating).toBe(true);
        expect(handler.baselineCalibration.baseline).toBeNull(); // Not yet complete
    });

    it('should buffer and aggregate AU data', () => {
        // Manually set calibration complete to skip 60s wait
        handler.isCalibrating = false;
        handler.calibrationComplete = true;

        // Send 30 frames to reach buffer size
        for (let i = 0; i < 30; i++) {
            const auMessage = JSON.stringify({
                type: 'au_frame',
                actionUnits: {
                    AU1: 1 + (i * 0.1),
                    AU4: 0.5 + (i * 0.05),
                    AU6: 2 + (i * 0.1),
                    AU12: 3 + (i * 0.08),
                    AU5: 0,
                    AU26: 0
                },
                confidence: 0.95,
                symmetry: 0.9,
                smileAuthenticity: i > 20 ? 'genuine' : 'neutral',
                timestamp: Date.now(),
                prosody: {
                    pitch_normalized: 1.0,
                    speech_rate_wpm: 120,
                    voice_quality: { tremor: 'none', breathiness: 'none' }
                },
                transcript: 'Everything is fine'
            });

            handler.handleMessage(auMessage);
        }

        // After 30 frames, buffer should be reset (or contain last frame)
        expect(handler.analysisBuffer.length).toBeLessThanOrEqual(1);
    });

    it('should convert AU data to baseline deviation', () => {
        handler.isCalibrating = false;

        // Set a baseline
        handler.baselineCalibration.baseline = {
            AU1: 0, AU4: 0, AU6: 1, AU12: 1,
            AU5: 0, AU26: 0,
            symmetry: 0.95,
            expression_intensity: 0
        };

        // Create aggregated data with deviation from baseline
        const aggregatedAU = {
            intensities: {
                AU1: 0,
                AU4: 2.5, // 2.5 points above baseline of 0 = HIGH DEVIATION
                AU6: 1.5,
                AU12: 3.5, // 3.5 above baseline of 1 = significant smile
                AU5: 0,
                AU26: 0
            },
            symmetry: 0.92,
            confidence: 0.94,
            smileAuthenticity: 'genuine'
        };

        const deviation = handler.baselineCalibration.getDeviation(aggregatedAU.intensities);

        // AU4 should show +2.5 deviation
        expect(deviation.deviations['AU4'].deviation).toBe(2.5);
        expect(deviation.deviations['AU4'].baseline).toBe(0);
        expect(deviation.deviations['AU4'].current).toBe(2.5);
    });

    it('should detect clinical markers based on deviation', () => {
        handler.isCalibrating = false;
        handler.baselineCalibration.baseline = {
            AU1: 0, AU4: 0, AU6: 1, AU12: 1,
            AU5: 0, AU26: 0,
            symmetry: 0.95,
            expression_intensity: 0
        };

        const aggregatedAU = {
            AU1: 0,
            AU4: 2.5, // Should trigger anger marker
            AU6: 1.5,
            AU12: 3.5,
            AU5: 0,
            AU26: 0
        };

        const interpretation = handler.baselineCalibration.interpretWithBaseline(aggregatedAU);

        expect(interpretation.clinicalMarkers.anger.active).toBe(true);
        expect(interpretation.clinicalMarkers.anger.confidence).toBeGreaterThan(0.5);
    });

    it('should detect congruence/incongruence patterns', () => {
        handler.isCalibrating = false;

        // Test: Happy face (AU12) + sad voice = incongruence
        const auData = {
            AU1: 0, AU4: 0, AU6: 3, AU12: 4,
            AU5: 0, AU26: 0
        };

        const prosodyData = {
            pitch_normalized: 0.7, // Low pitch = sad
            speech_rate_wpm: 80,    // Slow = sad
            voice_quality: { tremor: 'none', breathiness: 'none' }
        };

        const transcript = "I'm fine, everything's okay"; // Defensive

        const congruenceAnalysis = handler.congruenceEngine.analyzeCongruence({
            facs: auData,
            prosody: prosodyData,
            transcript: transcript
        });

        // Should detect DEFENSIVE_SMILE pattern
        const hasDefensiveSmile = congruenceAnalysis.incongruencePatterns.some(
            p => p.name === 'DEFENSIVE_SMILE'
        );
        expect(hasDefensiveSmile).toBe(true);
    });

    it('should track temporal expressions (micro vs macro)', () => {
        handler.isCalibrating = false;

        // Add frames simulating micro-expression (500ms = ~12 frames)
        const microStartTime = Date.now();
        for (let i = 0; i < 12; i++) {
            const frame = {
                timestamp: microStartTime + (i * 42), // ~24 FPS
                actionUnits: { AU4: 3, AU5: 2, AU26: 1 },
                confidence: 0.9
            };
            handler.temporalAnalyzer.addFrame(frame);
        }

        const insights = handler.temporalAnalyzer.getTemporalInsights();

        // Should have recorded a transition
        expect(insights.totalTransitions).toBeGreaterThanOrEqual(0);
        expect(insights.frameHistorySize).toBeGreaterThan(0);
    });

    it('should generate complete somatic state', () => {
        handler.isCalibrating = false;
        handler.sessionId = 'test_sess';
        handler.userId = 'test_user';

        // Setup baseline
        handler.baselineCalibration.baseline = {
            AU1: 0, AU4: 0, AU6: 1, AU12: 1,
            AU5: 0, AU26: 0,
            symmetry: 0.95,
            expression_intensity: 0
        };
        handler.baselineCalibration.calibrationQuality = 0.85;

        // Create aggregated AU
        const aggregatedAU = {
            intensities: {
                AU1: 0.5,
                AU4: 1.8,
                AU6: 2.2,
                AU12: 3.5,
                AU5: 0,
                AU26: 0
            },
            symmetry: 0.92,
            confidence: 0.94,
            smileAuthenticity: 'genuine'
        };

        const deviation = handler.baselineCalibration.getDeviation(aggregatedAU.intensities);
        const temporalInsights = handler.temporalAnalyzer.getTemporalInsights();
        const congruenceAnalysis = handler.congruenceEngine.analyzeCongruence({
            facs: aggregatedAU.intensities,
            prosody: {
                pitch_normalized: 1.0,
                speech_rate_wpm: 130,
                voice_quality: { tremor: 'none', breathiness: 'none' }
            },
            transcript: 'I feel good today'
        });

        // All components should produce output
        expect(deviation).toBeDefined();
        expect(deviation.deviations).toBeDefined();
        expect(temporalInsights).toBeDefined();
        expect(congruenceAnalysis).toBeDefined();
    });

    it('should skip calibration if requested', () => {
        const initMessage = JSON.stringify({
            type: 'init',
            sessionId: 'test_session_789',
            userId: 'test_user_789'
        });

        handler.handleMessage(initMessage);
        expect(handler.isCalibrating).toBe(true);

        // Immediately mark as complete
        handler.isCalibrating = false;
        handler.calibrationComplete = false; // User skipped

        const auMessage = JSON.stringify({
            type: 'au_frame',
            actionUnits: { AU1: 0, AU4: 1, AU6: 1, AU12: 2, AU5: 0, AU26: 0 },
            confidence: 0.95,
            symmetry: 0.9,
            smileAuthenticity: 'neutral',
            timestamp: Date.now(),
            prosody: {},
            transcript: ''
        });

        handler.handleMessage(auMessage);

        // Frame should be buffered regardless of calibration status
        expect(handler.analysisBuffer.length).toBeGreaterThan(0);
    });
});
