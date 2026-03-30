/**
 * OmniModalPipeline
 *
 * Orchestrates Vision + Audio + WebSocket for complete somatic analysis
 *
 * Flow:
 * 1. User grants camera permission
 * 2. VisionProcessingPipeline starts (faces + AU extraction)
 * 3. Request microphone permission
 * 4. AudioProcessingPipeline starts (prosody analysis)
 * 5. AUWebSocketClient connects to backend
 * 6. Every frame: Vision + Audio data → Backend via WebSocket
 *
 * This is the "glue" that binds all frontend systems together
 */

import { VisionProcessingPipeline } from './vision/VisionProcessingPipeline.js';
import { AudioProcessingPipeline } from './audio/AudioProcessingPipeline.js';
import { AUWebSocketClient } from './vision/AUWebSocketClient.js';

export class OmniModalPipeline {
    constructor(options = {}) {
        this.config = {
            videoElement: options.videoElement,
            baseWsUrl: options.baseWsUrl || 'ws://localhost:3001',
            userId: options.userId,
            sessionId: options.sessionId
        };

        // Pipeline components
        this.visionPipeline = null;
        this.audioPipeline = null;
        this.wsClient = null;

        // State
        this.isInitialized = false;
        this.isRunning = false;

        // Callbacks
        this.onReady = null;
        this.onError = null;

        console.log('[OmniModalPipeline] Constructed');
    }

    /**
     * Initialize all pipelines sequentially
     * 1. Vision (camera)
     * 2. Audio (microphone)
     * 3. WebSocket connection
     */
    async initialize() {
        try {
            console.log('[OmniModalPipeline] Initializing...');

            // STEP 1: Initialize Vision Pipeline (gets camera)
            this.visionPipeline = new VisionProcessingPipeline({
                videoWidth: 1280,
                videoHeight: 720,
                fps: 24
            });

            await this.visionPipeline.initialize(
                this.config.videoElement,
                null // canvas will be created internally
            );

            console.log('[OmniModalPipeline] Vision pipeline initialized ✓');

            // STEP 2: Initialize Audio Pipeline (gets microphone)
            this.audioPipeline = new AudioProcessingPipeline({});

            // This requests microphone permission
            await this.audioPipeline.startRecording();

            console.log('[OmniModalPipeline] Audio pipeline initialized ✓');

            // STEP 3: Initialize WebSocket Client
            this.wsClient = new AUWebSocketClient({
                baseUrl: this.config.baseWsUrl,
                userId: this.config.userId,
                sessionId: this.config.sessionId
            });

            // Connect WebSocket
            await this.wsClient.connect();

            console.log('[OmniModalPipeline] WebSocket connected ✓');

            // STEP 4: Wire vision frames to WebSocket + attach audio data
            this.wireVisionToWebSocket();

            this.isInitialized = true;

            if (this.onReady) {
                this.onReady();
            }

            return true;
        } catch (error) {
            console.error('[OmniModalPipeline] Initialization failed:', error);
            if (this.onError) {
                this.onError(error);
            }
            throw error;
        }
    }

    /**
     * Wire vision frame callback to WebSocket
     * Every time vision pipeline processes a frame:
     * - Get latest prosody data from audio
     * - Send both to backend
     */
    wireVisionToWebSocket() {
        if (!this.visionPipeline) return;

        this.visionPipeline.onFrameProcessed = (frameData) => {
            try {
                // Get latest prosody from audio pipeline
                const prosodyData = this.audioPipeline.getProsody();

                // Send AU frame + prosody to backend
                this.wsClient.sendAUFrame(frameData, prosodyData);
            } catch (error) {
                console.error('[OmniModalPipeline] Frame send error:', error);
            }
        };

        console.log('[OmniModalPipeline] Vision → WebSocket wired ✓');
    }

    /**
     * Start all pipelines running
     */
    start() {
        if (!this.isInitialized) {
            console.error('[OmniModalPipeline] Not initialized');
            return;
        }

        if (this.isRunning) {
            console.warn('[OmniModalPipeline] Already running');
            return;
        }

        this.visionPipeline.start();
        // Audio is already running (started during init)

        this.isRunning = true;

        console.log('[OmniModalPipeline] Started ✓');
    }

    /**
     * Stop all pipelines
     */
    stop() {
        if (!this.isRunning) return;

        this.visionPipeline.stop();
        this.audioPipeline.stopRecording();
        this.wsClient.disconnect();

        this.isRunning = false;

        console.log('[OmniModalPipeline] Stopped');
    }

    /**
     * Get statistics from all pipelines
     */
    getStats() {
        return {
            vision: this.visionPipeline?.getStats() || {},
            audio: this.audioPipeline?.getStats() || {},
            websocket: this.wsClient?.getStats() || {},
            isRunning: this.isRunning
        };
    }
}

export default OmniModalPipeline;
