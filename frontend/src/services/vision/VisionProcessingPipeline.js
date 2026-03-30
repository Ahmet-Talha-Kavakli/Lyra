/**
 * Vision Processing Pipeline - FRONTEND (Browser)
 *
 * This is where it BELONGS: In the user's browser
 * Processes WebRTC video stream and extracts FACS Action Units
 *
 * Why Frontend?
 * - Only the browser can access getUserMedia() (web camera)
 * - Computer vision is computationally intensive
 * - Better UX: real-time local processing, low latency
 * - Privacy: video never leaves user's device
 *
 * Architecture:
 * HTML5 Video Element (getUserMedia)
 *   ↓
 * Web Worker (heavy lifting in separate thread)
 *   → MediaPipe Facemesh face detection
 *   → FACS AU computation
 *   ↓
 * WebSocket → Backend (only lightweight AU JSON)
 */

import FacemeshWorker from './facemesh.worker.js';

export class VisionProcessingPipeline {
    constructor(options = {}) {
        this.config = {
            videoWidth: options.videoWidth || 1280,
            videoHeight: options.videoHeight || 720,
            fps: options.fps || 24,
            smoothingFactor: options.smoothingFactor || 0.8,
        };

        // Video capture
        this.videoElement = null;
        this.canvasElement = null;
        this.stream = null;

        // Web Worker for heavy lifting
        this.worker = null;

        // State
        this.isRunning = false;
        this.frameCount = 0;
        this.lastActionUnits = {};

        // Callbacks
        this.onFrameProcessed = null;
        this.onError = null;
    }

    /**
     * Initialize: request camera access, setup video element
     */
    async initialize(videoElement, canvasElement = null) {
        try {
            console.log('[VisionPipeline] Initializing (Frontend)...');

            this.videoElement = videoElement;
            this.canvasElement = canvasElement;

            // 1. Request camera access
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: this.config.videoWidth },
                    height: { ideal: this.config.videoHeight },
                    facingMode: 'user'
                },
                audio: false
            });

            // 2. Attach stream to video element
            this.videoElement.srcObject = this.stream;
            await new Promise(resolve => {
                this.videoElement.onloadedmetadata = () => {
                    this.videoElement.play();
                    resolve();
                };
            });

            // 3. Initialize Web Worker for FACS computation
            this.initializeWorker();

            console.log('[VisionPipeline] Initialized successfully');
            return true;
        } catch (error) {
            console.error('[VisionPipeline] Initialization failed:', error);
            if (this.onError) this.onError(error);
            throw error;
        }
    }

    /**
     * Initialize Web Worker for heavy computation
     * This runs in a separate thread so it doesn't block UI
     */
    initializeWorker() {
        try {
            // Create worker from external file
            this.worker = new Worker(new URL('./facemesh.worker.js', import.meta.url));

            // Handle messages from worker
            this.worker.onmessage = (event) => {
                const { actionUnits, confidence, landmarks } = event.data;

                // Smooth the AU values
                const smoothedAU = this.smoothActionUnits(actionUnits);

                // Invoke callback with results
                if (this.onFrameProcessed) {
                    this.onFrameProcessed({
                        success: true,
                        actionUnits: smoothedAU,
                        confidence: confidence,
                        landmarks: landmarks,
                        frameCount: this.frameCount,
                        timestamp: new Date().toISOString()
                    });
                }
            };

            this.worker.onerror = (error) => {
                console.error('[VisionPipeline] Worker error:', error);
                if (this.onError) this.onError(error);
            };

            console.log('[VisionPipeline] Web Worker initialized');
        } catch (error) {
            console.error('[VisionPipeline] Worker init failed:', error);
            throw error;
        }
    }

    /**
     * Start processing video frames
     * Captures frames and sends to Web Worker
     */
    start() {
        if (this.isRunning) {
            console.warn('[VisionPipeline] Already running');
            return;
        }

        this.isRunning = true;
        this.frameCount = 0;
        console.log('[VisionPipeline] Started processing');

        const processFrame = async () => {
            if (!this.isRunning) return;

            try {
                // Create canvas and draw current video frame
                if (!this.canvasElement) {
                    this.canvasElement = document.createElement('canvas');
                    this.canvasElement.width = this.videoElement.videoWidth;
                    this.canvasElement.height = this.videoElement.videoHeight;
                }

                const ctx = this.canvasElement.getContext('2d');
                ctx.drawImage(this.videoElement, 0, 0);

                // Convert canvas to ImageData
                const imageData = ctx.getImageData(
                    0, 0,
                    this.canvasElement.width,
                    this.canvasElement.height
                );

                // Send to Web Worker for processing
                this.worker.postMessage({
                    imageData: imageData,
                    width: this.canvasElement.width,
                    height: this.canvasElement.height,
                });

                this.frameCount++;
            } catch (error) {
                console.error('[VisionPipeline] Frame processing error:', error);
                if (this.onError) this.onError(error);
            }

            // Schedule next frame (respect FPS)
            const frameDelay = 1000 / this.config.fps;
            setTimeout(processFrame, frameDelay);
        };

        processFrame();
    }

    /**
     * Smooth AU values (reduce frame-to-frame jitter)
     */
    smoothActionUnits(newAU) {
        const smoothed = {};

        Object.entries(newAU).forEach(([key, newValue]) => {
            if (typeof newValue !== 'number') {
                smoothed[key] = newValue;
                return;
            }

            const oldValue = this.lastActionUnits[key] || newValue;
            const alpha = this.config.smoothingFactor;
            const smoothedValue = alpha * newValue + (1 - alpha) * oldValue;

            smoothed[key] = Math.round(smoothedValue * 100) / 100;
            this.lastActionUnits[key] = smoothedValue;
        });

        return smoothed;
    }

    /**
     * Stop processing
     */
    stop() {
        this.isRunning = false;

        // Stop camera stream
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }

        // Terminate worker
        if (this.worker) {
            this.worker.terminate();
        }

        console.log('[VisionPipeline] Stopped');
    }

    /**
     * Get current stats
     */
    getStats() {
        return {
            isRunning: this.isRunning,
            frameCount: this.frameCount,
            fps: this.config.fps,
            lastActionUnits: this.lastActionUnits
        };
    }
}

export default VisionProcessingPipeline;
