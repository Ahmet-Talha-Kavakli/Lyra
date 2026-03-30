/**
 * Data Acquisition Engine - Layer 1
 * Real-time video + audio + system metrics streaming
 * 24 FPS video, 16kHz audio, synchronized timestamps
 */

import { EventEmitter } from 'events';
import { logger } from '../logging/logger.js';

export class DataAcquisitionEngine extends EventEmitter {
    constructor() {
        super();
        this.videoStream = null;
        this.audioStream = null;
        this.videoTrack = null;
        this.audioTrack = null;
        this.frameBuffer = [];
        this.audioBuffer = [];
        this.fps = 24;
        this.sampleRate = 16000;
        this.isCapturing = false;
        this.startTime = null;
    }

    /**
     * Initialize all data sources: camera, mic, system
     */
    async initialize() {
        try {
            logger.info('[DataAcquisition] Initializing...');

            // 1. Request video stream
            this.videoStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: 'user',
                    frameRate: { ideal: 30 }
                }
            });
            this.videoTrack = this.videoStream.getVideoTracks()[0];

            // 2. Request audio stream
            this.audioStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    sampleRate: { ideal: 16000 },
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: false
                }
            });
            this.audioTrack = this.audioStream.getAudioTracks()[0];

            // 3. Start capture loops
            this.startTime = Date.now();
            this.isCapturing = true;
            this.startVideoCapture();
            this.startAudioCapture();

            logger.info('[DataAcquisition] Initialized successfully');
            return true;
        } catch (error) {
            logger.error('[DataAcquisition] Init failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Capture video frames at 24 FPS
     */
    startVideoCapture() {
        const video = document.createElement('video');
        video.srcObject = this.videoStream;
        video.play();

        const canvas = document.createElement('canvas');
        canvas.width = 1280;
        canvas.height = 720;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });

        const captureFrame = () => {
            if (!this.isCapturing) return;

            try {
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const frameData = canvas.toDataURL('image/jpeg', 0.85);

                const frame = {
                    data: frameData,
                    timestamp: Date.now(),
                    elapsedMs: Date.now() - this.startTime,
                    width: canvas.width,
                    height: canvas.height,
                    frameIndex: this.frameBuffer.length
                };

                // Keep last 60 frames (2.5 seconds at 24 FPS)
                this.frameBuffer.push(frame);
                if (this.frameBuffer.length > 60) {
                    this.frameBuffer.shift();
                }

                this.emit('frame', frame);
            } catch (error) {
                logger.error('[VideoCapture] Error', { error: error.message });
            }

            setTimeout(captureFrame, 1000 / this.fps);
        };

        captureFrame();
    }

    /**
     * Capture audio chunks in real-time
     */
    startAudioCapture() {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.8;

        const source = audioContext.createMediaStreamAudioSource(this.audioStream);
        source.connect(analyser);

        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        const timeDomainData = new Uint8Array(analyser.fftSize);

        const captureAudio = () => {
            if (!this.isCapturing) return;

            try {
                analyser.getByteFrequencyData(dataArray);
                analyser.getByteTimeDomainData(timeDomainData);

                const audioChunk = {
                    frequencies: Array.from(dataArray),
                    timeDomain: Array.from(timeDomainData),
                    timestamp: Date.now(),
                    elapsedMs: Date.now() - this.startTime,
                    sampleRate: audioContext.sampleRate,
                    fftSize: analyser.fftSize,
                    chunkIndex: this.audioBuffer.length
                };

                this.audioBuffer.push(audioChunk);
                if (this.audioBuffer.length > 120) { // Last 5 seconds at 24Hz
                    this.audioBuffer.shift();
                }

                this.emit('audio', audioChunk);
            } catch (error) {
                logger.error('[AudioCapture] Error', { error: error.message });
            }

            requestAnimationFrame(captureAudio);
        };

        captureAudio();
    }

    /**
     * Get last N frames
     */
    getFrameBuffer(lastNFrames = 30) {
        return this.frameBuffer.slice(Math.max(0, this.frameBuffer.length - lastNFrames));
    }

    /**
     * Get last N seconds of audio
     */
    getAudioBuffer(lastNSeconds = 2) {
        const requiredChunks = Math.ceil((lastNSeconds * 24)); // 24 chunks per second
        return this.audioBuffer.slice(Math.max(0, this.audioBuffer.length - requiredChunks));
    }

    /**
     * Get current frame
     */
    getCurrentFrame() {
        return this.frameBuffer.length > 0 ? this.frameBuffer[this.frameBuffer.length - 1] : null;
    }

    /**
     * Get current audio chunk
     */
    getCurrentAudioChunk() {
        return this.audioBuffer.length > 0 ? this.audioBuffer[this.audioBuffer.length - 1] : null;
    }

    /**
     * Stop capturing
     */
    stop() {
        this.isCapturing = false;
        if (this.videoTrack) this.videoTrack.stop();
        if (this.audioTrack) this.audioTrack.stop();
        logger.info('[DataAcquisition] Stopped');
    }

    /**
     * Get buffer statistics
     */
    getStats() {
        return {
            frameCount: this.frameBuffer.length,
            audioChunkCount: this.audioBuffer.length,
            elapsedSeconds: (Date.now() - this.startTime) / 1000,
            fps: this.fps,
            sampleRate: this.sampleRate,
            isCapturing: this.isCapturing
        };
    }
}

export const dataAcquisitionEngine = new DataAcquisitionEngine();

export default DataAcquisitionEngine;
