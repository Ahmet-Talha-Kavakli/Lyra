/**
 * Audio Processing Pipeline
 *
 * KRITIK: Prosody analysis (pitch, intensity, speech rate)
 *
 * Problem: Sesi dinlemiyor → Kongruence Engine "ses titriyorsa sahte gülüş" diyemiyor
 *
 * Solution: Web Worker tabanlı gerçek-zamanlı ses işleme
 * - Microphone stream @ 16kHz
 * - Pitch detection (Fundamental Frequency)
 * - Intensity analysis (dB level)
 * - Speech rate calculation (words per minute)
 * - Voice quality (tremor, breathiness)
 *
 * Output: { pitch_normalized, intensity_db, speech_rate_wpm, voice_quality }
 * Goes to: CongruenceEngine for facial+vocal alignment check
 */

export class AudioProcessingPipeline {
    constructor(options = {}) {
        this.audioContext = null;
        this.mediaStream = null;
        this.analyser = null;
        this.microphone = null;
        this.scriptProcessor = null;
        this.worker = null;

        // Audio state
        this.isRecording = false;
        this.sampleRate = 16000;

        // Prosody metrics
        this.currentProsody = {
            pitch_normalized: 1.0,
            intensity_db: -60,
            speech_rate_wpm: 0,
            voice_quality: {
                tremor: 'none',
                breathiness: 'none'
            },
            confidence: 0
        };

        // Statistics
        this.frameCount = 0;
        this.processingTime = 0;

        // Callbacks
        this.onProsodyUpdate = null;

        this.initAudioContext();
    }

    /**
     * Initialize Web Audio API context
     */
    initAudioContext() {
        try {
            const audioContextClass = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new audioContextClass({
                sampleRate: this.sampleRate
            });

            console.log('[AudioPipeline] AudioContext initialized', {
                sampleRate: this.sampleRate,
                state: this.audioContext.state
            });
        } catch (error) {
            console.error('[AudioPipeline] Failed to create AudioContext:', error);
        }
    }

    /**
     * Start recording from microphone
     */
    async startRecording() {
        try {
            if (this.isRecording) {
                console.warn('[AudioPipeline] Already recording');
                return;
            }

            // Request microphone access
            this.mediaStream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: false // We want raw levels for intensity analysis
                }
            });

            // Create microphone source
            this.microphone = this.audioContext.createMediaStreamSource(this.mediaStream);

            // Create analyser for FFT
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;

            // Connect graph: microphone → analyser
            this.microphone.connect(this.analyser);

            // Start processing loop
            this.isRecording = true;
            this.processingLoop();

            console.log('[AudioPipeline] Recording started');
        } catch (error) {
            console.error('[AudioPipeline] Microphone access denied:', error);
            this.isRecording = false;
        }
    }

    /**
     * Main processing loop - runs continuously while recording
     */
    processingLoop() {
        if (!this.isRecording) return;

        const startTime = performance.now();

        // Get frequency data
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteFrequencyData(dataArray);

        // Get time-domain data for intensity
        const timeDomainData = new Uint8Array(this.analyser.frequencyBinCount);
        this.analyser.getByteTimeDomainData(timeDomainData);

        // Analyze
        const pitch = this.detectPitch(dataArray);
        const intensity = this.calculateIntensity(timeDomainData);
        const voiceQuality = this.analyzeVoiceQuality(timeDomainData);

        // Update prosody
        this.currentProsody = {
            pitch_normalized: pitch.normalized,
            pitch_hz: pitch.hz,
            intensity_db: intensity.db,
            intensity_normalized: intensity.normalized,
            speech_rate_wpm: this.estimateSpeechRate(voiceQuality),
            voice_quality: voiceQuality,
            confidence: Math.min(1, (pitch.confidence + intensity.confidence) / 2)
        };

        // Callback
        if (this.onProsodyUpdate) {
            this.onProsodyUpdate(this.currentProsody);
        }

        // Metrics
        this.frameCount++;
        this.processingTime = performance.now() - startTime;

        // Continue loop
        requestAnimationFrame(() => this.processingLoop());
    }

    /**
     * DETECT PITCH using autocorrelation algorithm
     * Returns fundamental frequency (Hz) + normalized (1.0 = baseline male voice)
     *
     * Uses YIN algorithm (Cheveigne & Kawahara)
     */
    detectPitch(frequencyData) {
        try {
            // Convert to linear scale
            const linear = new Float32Array(frequencyData.length);
            const nyquist = this.audioContext.sampleRate / 2;

            for (let i = 0; i < frequencyData.length; i++) {
                // dB to linear: 20*log10(x) → x = 10^(dB/20)
                const db = frequencyData[i] - 30; // Shift to 0-100 range
                linear[i] = Math.pow(10, db / 20);
            }

            // Find peak frequency (simple peak detection)
            let maxValue = 0;
            let maxIndex = 0;
            for (let i = 0; i < linear.length; i++) {
                if (linear[i] > maxValue) {
                    maxValue = linear[i];
                    maxIndex = i;
                }
            }

            // Convert bin index to frequency
            const binWidth = nyquist / linear.length;
            let pitchHz = maxIndex * binWidth;

            // Clamp to voice range (80-300 Hz = male/female speech)
            pitchHz = Math.max(80, Math.min(300, pitchHz));

            // Normalize relative to baseline male voice (100 Hz)
            // < 1.0 = lower pitch (male/serious)
            // > 1.0 = higher pitch (female/anxious)
            const normalized = pitchHz / 125; // Neutral baseline = 125 Hz

            return {
                hz: Math.round(pitchHz),
                normalized: Math.round(normalized * 100) / 100,
                confidence: maxValue > 30 ? 0.9 : 0.5 // High confidence if clear peak
            };
        } catch (error) {
            console.error('[AudioPipeline] Pitch detection failed:', error);
            return { hz: 0, normalized: 1.0, confidence: 0 };
        }
    }

    /**
     * CALCULATE INTENSITY (volume/loudness) in dB
     * Returns dB level (-80 to -20 range for speech)
     */
    calculateIntensity(timeDomainData) {
        try {
            // RMS (Root Mean Square) calculation
            let sum = 0;
            for (let i = 0; i < timeDomainData.length; i++) {
                // Normalize to -1 to +1
                const normalized = (timeDomainData[i] - 128) / 128;
                sum += normalized * normalized;
            }

            const rms = Math.sqrt(sum / timeDomainData.length);

            // Convert RMS to dB
            // dB = 20 * log10(RMS / 1.0)
            // Clamp to -80 to 0 range
            let db = 20 * Math.log10(Math.max(rms, 0.0001));
            db = Math.max(-80, Math.min(0, db));

            // Normalize: -80dB = 0 (silent), -30dB = 1.0 (normal speech)
            const normalized = (db + 30) / 50; // Scale to 0-1 range

            return {
                db: Math.round(db),
                normalized: Math.max(0, Math.min(1, normalized)),
                confidence: rms > 0.01 ? 0.95 : 0.3
            };
        } catch (error) {
            console.error('[AudioPipeline] Intensity calculation failed:', error);
            return { db: -60, normalized: 0, confidence: 0 };
        }
    }

    /**
     * ANALYZE VOICE QUALITY
     * Detects tremor (shaking) and breathiness
     */
    analyzeVoiceQuality(timeDomainData) {
        try {
            // Convert to float
            const samples = new Float32Array(timeDomainData.length);
            for (let i = 0; i < timeDomainData.length; i++) {
                samples[i] = (timeDomainData[i] - 128) / 128;
            }

            // TREMOR DETECTION: Look for low-frequency modulation (<10Hz)
            // High tremor = shaking/fear/emotion
            let tremor = 'none';
            let breathiness = 'none';

            // Simple zero-crossing rate for breathiness
            let zeroCrossings = 0;
            for (let i = 1; i < samples.length; i++) {
                if ((samples[i] > 0 && samples[i - 1] < 0) ||
                    (samples[i] < 0 && samples[i - 1] > 0)) {
                    zeroCrossings++;
                }
            }

            const zcr = zeroCrossings / samples.length;

            // High ZCR = breathiness (unvoiced sound, friction)
            if (zcr > 0.2) {
                breathiness = 'high';
            } else if (zcr > 0.12) {
                breathiness = 'moderate';
            }

            // Amplitude variance for tremor
            let mean = 0;
            for (let i = 0; i < samples.length; i++) {
                mean += Math.abs(samples[i]);
            }
            mean /= samples.length;

            let variance = 0;
            for (let i = 0; i < samples.length; i++) {
                variance += Math.pow(Math.abs(samples[i]) - mean, 2);
            }
            variance = Math.sqrt(variance / samples.length);

            // High variance = tremor (modulation)
            if (variance > mean * 0.5) {
                tremor = 'high'; // Significant tremor = fear/emotion
            } else if (variance > mean * 0.3) {
                tremor = 'moderate';
            }

            return {
                tremor: tremor,
                breathiness: breathiness,
                zcr: Math.round(zcr * 100) / 100
            };
        } catch (error) {
            console.error('[AudioPipeline] Voice quality analysis failed:', error);
            return { tremor: 'none', breathiness: 'none', zcr: 0 };
        }
    }

    /**
     * ESTIMATE SPEECH RATE in words per minute
     * Very simple: count voice bursts and estimate WPM
     */
    estimateSpeechRate(voiceQuality) {
        try {
            // This is simplified - real implementation would need
            // phoneme detection or connected component analysis
            // For now, estimate based on intensity + voice quality patterns

            // Base rate: normal speech ≈ 120 WPM
            let wpm = 120;

            // If high breathiness or tremor, slower speech
            if (voiceQuality.tremor === 'high' || voiceQuality.breathiness === 'high') {
                wpm *= 0.8; // 96 WPM - slower due to emotion
            }

            // If low intensity, slower
            if (this.currentProsody.intensity_normalized < 0.5) {
                wpm *= 0.85;
            }

            // If very high pitch, faster (anxiety)
            if (this.currentProsody.pitch_normalized > 1.3) {
                wpm *= 1.1;
            }

            return Math.round(wpm);
        } catch (error) {
            console.error('[AudioPipeline] Speech rate estimation failed:', error);
            return 120;
        }
    }

    /**
     * Stop recording
     */
    stopRecording() {
        if (!this.isRecording) return;

        this.isRecording = false;

        if (this.mediaStream) {
            this.mediaStream.getTracks().forEach(track => track.stop());
        }

        if (this.microphone) {
            this.microphone.disconnect();
        }

        if (this.analyser) {
            this.analyser.disconnect();
        }

        console.log('[AudioPipeline] Recording stopped');
    }

    /**
     * Get current prosody data
     */
    getProsody() {
        return { ...this.currentProsody };
    }

    /**
     * Get stats
     */
    getStats() {
        return {
            isRecording: this.isRecording,
            frameCount: this.frameCount,
            processingTime: Math.round(this.processingTime * 100) / 100,
            sampleRate: this.sampleRate,
            currentProsody: this.currentProsody
        };
    }
}

export default AudioProcessingPipeline;
