/**
 * Real-Time Synchronization Orchestrator
 *
 * Coordinates concurrent data streams:
 * - Video (Face detection at 24 FPS)
 * - Audio (Prosody analysis at 16 kHz)
 * - Text (Conversational input asynchronously)
 *
 * Ensures all three modalities are analyzed and fused at the right moment
 * Handles timing mismatches and data buffering
 */

import { logger } from '../logging/logger.js';

export class RealtimeSyncOrchestrator {
    constructor(options = {}) {
        this.sessionId = options.sessionId || `session_${Date.now()}`;
        this.userId = options.userId;

        // Stream buffers (circular, time-based)
        this.visionBuffer = [];      // Latest 60 frames (2.5 sec at 24 FPS)
        this.audioBuffer = [];       // Latest 80 frames (5 sec at 16 Hz prosody)
        this.textBuffer = [];        // Latest utterances + timestamps

        // Fusion timing
        this.lastFusionTime = null;
        this.fusionIntervalMs = options.fusionIntervalMs || 1000; // Fuse every 1 second
        this.fusionTimer = null;

        // Synchronization state
        this.isSynchronized = false;
        this.temporalShift = {       // ms offset between streams
            audioVsVideo: 0,
            textVsVideo: 0
        };

        // Quality metrics
        this.frameDropCount = 0;
        this.syncQuality = 1.0; // 0-1, where 1 = perfect sync

        // Callbacks
        this.onFusedState = options.onFusedState || (() => {});
        this.onSyncWarning = options.onSyncWarning || (() => {});

        logger.info('[RealtimeSyncOrchestrator] Initialized', {
            sessionId: this.sessionId,
            fusionInterval: this.fusionIntervalMs
        });
    }

    /**
     * START ORCHESTRATION
     * Begins real-time synchronization of all modalities
     */
    start() {
        if (this.fusionTimer) {
            logger.warn('[RealtimeSyncOrchestrator] Already running');
            return;
        }

        this.lastFusionTime = Date.now();

        // Schedule periodic fusion
        this.fusionTimer = setInterval(() => {
            this.performFusion();
        }, this.fusionIntervalMs);

        logger.info('[RealtimeSyncOrchestrator] Started');
    }

    /**
     * STOP ORCHESTRATION
     */
    stop() {
        if (this.fusionTimer) {
            clearInterval(this.fusionTimer);
            this.fusionTimer = null;
        }
        logger.info('[RealtimeSyncOrchestrator] Stopped');
    }

    /**
     * ADD VISION DATA (from VisionProcessingPipeline)
     * @param visionFrame { timestamp, actionUnits, confidence, landmarks, ... }
     */
    addVisionFrame(visionFrame) {
        if (!visionFrame || !visionFrame.timestamp) {
            this.frameDropCount++;
            return;
        }

        this.visionBuffer.push({
            ...visionFrame,
            modality: 'vision',
            receivedAt: Date.now(),
            sequenceNumber: this.visionBuffer.length
        });

        // Keep only last 60 frames (2.5 sec at 24 FPS)
        if (this.visionBuffer.length > 60) {
            this.visionBuffer.shift();
        }

        // Detect temporal shift (audio should arrive slightly after video)
        this.updateTemporalShift('vision');
    }

    /**
     * ADD AUDIO DATA (from ProsodyAnalyzer)
     * @param prosodyFrame { timestamp, pitch, intensity, voiceQuality, ... }
     */
    addAudioFrame(prosodyFrame) {
        if (!prosodyFrame || !prosodyFrame.timestamp) {
            return;
        }

        this.audioBuffer.push({
            ...prosodyFrame,
            modality: 'audio',
            receivedAt: Date.now(),
            sequenceNumber: this.audioBuffer.length
        });

        // Keep only last 80 frames (5 sec at 16 Hz)
        if (this.audioBuffer.length > 80) {
            this.audioBuffer.shift();
        }

        this.updateTemporalShift('audio');
    }

    /**
     * ADD TEXT DATA (from conversation)
     * @param textFrame { timestamp, text, userId, sessionId }
     */
    addTextFrame(textFrame) {
        if (!textFrame || !textFrame.text) {
            return;
        }

        this.textBuffer.push({
            ...textFrame,
            modality: 'text',
            receivedAt: Date.now(),
            sequenceNumber: this.textBuffer.length
        });

        // Keep only last 20 utterances
        if (this.textBuffer.length > 20) {
            this.textBuffer.shift();
        }

        this.updateTemporalShift('text');
    }

    /**
     * DETECT TEMPORAL MISALIGNMENT
     * Warns if video/audio/text are out of sync
     */
    updateTemporalShift(modalityName) {
        if (this.visionBuffer.length === 0) return;

        const latestVisionTime = this.visionBuffer[this.visionBuffer.length - 1].receivedAt;

        if (modalityName === 'audio' && this.audioBuffer.length > 0) {
            const latestAudioTime = this.audioBuffer[this.audioBuffer.length - 1].receivedAt;
            this.temporalShift.audioVsVideo = latestAudioTime - latestVisionTime;

            // Warn if shift > 500ms (should be <200ms)
            if (Math.abs(this.temporalShift.audioVsVideo) > 500) {
                this.onSyncWarning({
                    type: 'temporal_shift_audio',
                    shiftMs: this.temporalShift.audioVsVideo,
                    severity: 'warning'
                });
                this.syncQuality *= 0.95; // Degrade quality slightly
            }
        }

        if (modalityName === 'text' && this.textBuffer.length > 0) {
            const latestTextTime = this.textBuffer[this.textBuffer.length - 1].receivedAt;
            this.temporalShift.textVsVideo = latestTextTime - latestVisionTime;

            // Text naturally lags video (user speaks after thinking)
            // Expected: 200-1000ms. Alert if > 3 seconds
            if (Math.abs(this.temporalShift.textVsVideo) > 3000) {
                this.onSyncWarning({
                    type: 'temporal_shift_text',
                    shiftMs: this.temporalShift.textVsVideo,
                    severity: 'alert'
                });
            }
        }
    }

    /**
     * PERFORM MULTIMODAL FUSION
     * Main orchestration: aggregate data from all streams and produce unified state
     */
    performFusion() {
        try {
            // 1. Aggregate data from each modality
            const visionAgg = this.aggregateVisionData();
            const audioAgg = this.aggregateAudioData();
            const textAgg = this.aggregateTextData();

            // 2. Check if we have minimum data from at least 2 modalities
            const hasVision = visionAgg && visionAgg.confidence > 0;
            const hasAudio = audioAgg && audioAgg.intensity;
            const hasText = textAgg && textAgg.text;

            const modalityCount = [hasVision, hasAudio, hasText].filter(Boolean).length;

            if (modalityCount < 2) {
                logger.debug('[RealtimeSyncOrchestrator] Insufficient data for fusion', {
                    modalityCount,
                    hasVision,
                    hasAudio,
                    hasText
                });
                return;
            }

            // 3. TIME-ALIGN DATA
            // Find the most recent timestamp across modalities
            const visionTime = visionAgg?.timestamp || 0;
            const audioTime = audioAgg?.timestamp || 0;
            const textTime = textAgg?.timestamp || 0;
            const alignmentTime = Math.max(visionTime, audioTime, textTime);

            // 4. CREATE FUSED STATE
            const fusedState = {
                sessionId: this.sessionId,
                userId: this.userId,
                alignmentTime: alignmentTime,
                fusionTimestamp: Date.now(),

                // Modality data
                modalities: {
                    vision: hasVision ? visionAgg : null,
                    audio: hasAudio ? audioAgg : null,
                    text: hasText ? textAgg : null
                },

                // Synchronization metadata
                sync: {
                    modalityCount,
                    audioVsVideoShift: this.temporalShift.audioVsVideo,
                    textVsVideoShift: this.temporalShift.textVsVideo,
                    quality: this.syncQuality,
                    frameDropCount: this.frameDropCount
                },

                // Buffer states (for debugging)
                buffers: {
                    visionSize: this.visionBuffer.length,
                    audioSize: this.audioBuffer.length,
                    textSize: this.textBuffer.length
                }
            };

            // 5. VALIDATE CONGRUENCE
            // Check if modalities agree with each other
            const congruenceCheck = this.validateCongruence(visionAgg, audioAgg, textAgg);
            fusedState.congruence = congruenceCheck;

            // 6. EMIT FUSED STATE
            this.onFusedState(fusedState);

            this.lastFusionTime = Date.now();

            logger.debug('[RealtimeSyncOrchestrator] Fusion complete', {
                modalityCount,
                quality: this.syncQuality.toFixed(2),
                congruence: congruenceCheck.score.toFixed(2)
            });

        } catch (error) {
            logger.error('[RealtimeSyncOrchestrator] Fusion error', {
                error: error.message,
                stack: error.stack
            });
        }
    }

    /**
     * AGGREGATE VISION DATA
     * Average latest vision frames
     */
    aggregateVisionData() {
        if (this.visionBuffer.length === 0) return null;

        // Use last 10 frames (for smoothing)
        const frames = this.visionBuffer.slice(-10);

        // Average action unit intensities
        const auMap = {};
        frames.forEach(frame => {
            if (frame.actionUnits) {
                Object.entries(frame.actionUnits).forEach(([au, intensity]) => {
                    if (!auMap[au]) auMap[au] = [];
                    auMap[au].push(intensity);
                });
            }
        });

        const averagedAU = {};
        Object.entries(auMap).forEach(([au, values]) => {
            averagedAU[au] = values.reduce((a, b) => a + b, 0) / values.length;
        });

        return {
            timestamp: frames[frames.length - 1].timestamp,
            actionUnits: averagedAU,
            confidence: frames.reduce((a, b) => a + (b.confidence || 0), 0) / frames.length,
            frameCount: frames.length,
            detectedAUs: Object.keys(averagedAU).filter(au => au.startsWith('AU'))
        };
    }

    /**
     * AGGREGATE AUDIO DATA
     * Average latest prosody frames
     */
    aggregateAudioData() {
        if (this.audioBuffer.length === 0) return null;

        // Use last 16 frames (1 second at 16 Hz)
        const frames = this.audioBuffer.slice(-16);

        // Average prosodic features
        const avgPitch = frames.reduce((a, b) => a + (b.pitch?.hz || 0), 0) / frames.length;
        const avgIntensity = frames.reduce((a, b) => a + (b.intensity?.dB || 0), 0) / frames.length;
        const voiceQuality = frames[frames.length - 1]?.voiceQuality || {};
        const prosodyPattern = frames[frames.length - 1]?.prosodyPattern || {};

        return {
            timestamp: frames[frames.length - 1].timestamp,
            pitch: { hz: Math.round(avgPitch), trend: this.detectPitchTrend(frames) },
            intensity: { dB: Math.round(avgIntensity), category: this.categorizeIntensity(avgIntensity) },
            voiceQuality,
            prosodyPattern,
            frameCount: frames.length
        };
    }

    /**
     * AGGREGATE TEXT DATA
     * Get latest utterance(s)
     */
    aggregateTextData() {
        if (this.textBuffer.length === 0) return null;

        const recentFrames = this.textBuffer.slice(-3); // Last 3 utterances
        const combinedText = recentFrames.map(f => f.text).join(' ');
        const latestFrame = recentFrames[recentFrames.length - 1];

        return {
            timestamp: latestFrame.timestamp,
            text: combinedText,
            latestUtterance: latestFrame.text,
            utteranceCount: recentFrames.length,
            speakers: [...new Set(recentFrames.map(f => f.userId))]
        };
    }

    /**
     * VALIDATE MULTIMODAL CONGRUENCE
     * Check if modalities agree (body language matches words + voice)
     */
    validateCongruence(vision, audio, text) {
        let congruenceScore = 1.0; // Perfect
        const conflicts = [];

        // 1. AUDIO-VISION CONGRUENCE
        // Does the voice tone match the facial expression?
        if (vision && audio) {
            // Positive emotion (smile) should have rising pitch or high intensity
            if (vision.actionUnits?.AU12 > 2) { // Smile detected
                if (audio.pitch.trend < 0) {
                    conflicts.push('smile_but_falling_pitch');
                    congruenceScore *= 0.9;
                }
            }

            // Sadness (AU15) should have low intensity
            if (vision.actionUnits?.AU15 > 2) {
                if (audio.intensity.dB > -10) {
                    conflicts.push('sadness_but_loud_voice');
                    congruenceScore *= 0.85;
                }
            }

            // Fear (AU5+AU26) should have high pitch
            if ((vision.actionUnits?.AU5 > 2 || vision.actionUnits?.AU26 > 2)) {
                if (audio.pitch.hz < 120) {
                    conflicts.push('fear_but_low_pitch');
                    congruenceScore *= 0.85;
                }
            }
        }

        // 2. TEXT-VISION CONGRUENCE
        // Do words match facial expression?
        if (vision && text) {
            const positiveWords = ['happy', 'great', 'good', 'love', 'excited'];
            const negativeWords = ['sad', 'bad', 'hate', 'angry', 'depressed'];

            const hasPositiveWords = positiveWords.some(w => text.text.toLowerCase().includes(w));
            const hasNegativeWords = negativeWords.some(w => text.text.toLowerCase().includes(w));

            // Positive words but sad face
            if (hasPositiveWords && vision.actionUnits?.AU15 > 2) {
                conflicts.push('positive_words_but_sad_face');
                congruenceScore *= 0.8;
            }

            // Negative words but happy face
            if (hasNegativeWords && vision.actionUnits?.AU12 > 2 && vision.actionUnits?.AU6 > 2) {
                conflicts.push('negative_words_but_happy_face');
                congruenceScore *= 0.8;
            }
        }

        // 3. TEXT-AUDIO CONGRUENCE
        // Do words match voice tone?
        if (audio && text) {
            const positiveWords = ['happy', 'great', 'good'];
            const hasPositiveWords = positiveWords.some(w => text.text.toLowerCase().includes(w));

            // Positive words but monotone/depressed voice
            if (hasPositiveWords && audio.prosodyPattern.pattern === 'flat') {
                conflicts.push('positive_words_but_monotone');
                congruenceScore *= 0.85;
            }
        }

        return {
            score: Math.max(0, congruenceScore),
            conflicts,
            interpretation: congruenceScore > 0.85 ? 'congruent' : 'conflicted'
        };
    }

    /**
     * DETECT PITCH TREND
     * Rising vs falling intonation
     */
    detectPitchTrend(frames) {
        if (frames.length < 3) return 0;

        const pitches = frames.map(f => f.pitch?.hz || 0);
        const first = pitches[0];
        const last = pitches[pitches.length - 1];

        return (last - first) / (first || 1);
    }

    /**
     * CATEGORIZE INTENSITY
     */
    categorizeIntensity(dB) {
        if (dB < -30) return 'very_quiet';
        if (dB < -15) return 'quiet';
        if (dB < -5) return 'normal';
        if (dB < 0) return 'loud';
        return 'very_loud';
    }

    /**
     * GET ORCHESTRATION STATE
     */
    getState() {
        return {
            sessionId: this.sessionId,
            isRunning: !!this.fusionTimer,
            buffers: {
                vision: this.visionBuffer.length,
                audio: this.audioBuffer.length,
                text: this.textBuffer.length
            },
            sync: {
                quality: this.syncQuality.toFixed(2),
                audioVsVideo: this.temporalShift.audioVsVideo,
                textVsVideo: this.temporalShift.textVsVideo,
                frameDrops: this.frameDropCount
            },
            timeSinceLastFusion: Date.now() - (this.lastFusionTime || 0)
        };
    }
}

export default RealtimeSyncOrchestrator;
