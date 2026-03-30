/**
 * Prosody Analyzer - Layer 2B
 * Analyzes voice: pitch, intensity, speed, rhythm
 * Detects emotional state from paralinguistics
 */

import { logger } from '../logging/logger.js';

export class ProsodyAnalyzer {
    constructor() {
        this.audioContext = null;
        this.analyser = null;
        this.pitchBuffer = [];
        this.intensityBuffer = [];
        this.pauseBuffer = [];
    }

    async initialize(audioStream) {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const source = this.audioContext.createMediaStreamAudioSource(audioStream);

            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;

            source.connect(this.analyser);

            logger.info('[ProsodyAnalyzer] Initialized');
        } catch (error) {
            logger.error('[ProsodyAnalyzer] Init failed', { error: error.message });
            throw error;
        }
    }

    /**
     * Analyze audio chunk for prosodic features
     */
    analyzeAudioChunk(audioChunk) {
        try {
            const frequencies = audioChunk.frequencies;
            const timeDomain = audioChunk.timeDomain;

            // Extract prosodic features
            const pitch = this.estimatePitch(frequencies);
            const intensity = this.calculateIntensity(frequencies);
            const voiceQuality = this.analyzeVoiceQuality(frequencies);
            const pauses = this.detectPauses(frequencies);
            const prosodyPattern = this.identifyProsodyPattern(frequencies);
            const vibrato = this.detectVibrato(pitch);

            const result = {
                pitch: pitch,
                intensity: intensity,
                voiceQuality: voiceQuality,
                pauses: pauses,
                prosodyPattern: prosodyPattern,
                vibrato: vibrato,
                timestamp: audioChunk.timestamp,
                sampleRate: audioChunk.sampleRate
            };

            // Store in history
            this.pitchBuffer.push(pitch);
            this.intensityBuffer.push(intensity);
            if (this.pitchBuffer.length > 30) this.pitchBuffer.shift();
            if (this.intensityBuffer.length > 30) this.intensityBuffer.shift();

            return result;
        } catch (error) {
            logger.error('[ProsodyAnalyzer] Analysis failed', { error: error.message });
            return { error: error.message };
        }
    }

    /**
     * Estimate fundamental frequency (pitch)
     * Using simplified autocorrelation method
     */
    estimatePitch(frequencies) {
        // Find dominant frequency
        let maxEnergy = 0;
        let maxIndex = 0;

        for (let i = 1; i < frequencies.length; i++) {
            if (frequencies[i] > maxEnergy) {
                maxEnergy = frequencies[i];
                maxIndex = i;
            }
        }

        // Convert frequency bin to Hz
        // Assuming 16kHz sample rate, 2048 FFT size
        const sampleRate = 16000;
        const fftSize = 2048;
        const pitchHz = (maxIndex * sampleRate) / fftSize;

        // Convert to MIDI note (for perceptual relevance)
        const midiNote = 12 * Math.log2(pitchHz / 440) + 69;

        return {
            hz: Math.round(pitchHz),
            midiNote: Math.round(midiNote),
            normalized: pitchHz / 100, // Relative to baseline
            confidence: maxEnergy / 255
        };
    }

    /**
     * Calculate voice intensity (loudness)
     */
    calculateIntensity(frequencies) {
        // RMS (Root Mean Square) Energy
        const sum = frequencies.reduce((a, b) => a + b * b, 0);
        const rms = Math.sqrt(sum / frequencies.length);

        // Normalize to 0-1
        const normalized = rms / 255;

        // Convert to decibels
        const dB = 20 * Math.log10(Math.max(rms, 1) / 255);

        return {
            rms: Math.round(rms),
            normalized: normalized,
            dB: Math.round(dB),
            loudnessLevel: this.categorizeIntensity(dB)
        };
    }

    /**
     * Categorize intensity level
     */
    categorizeIntensity(dB) {
        if (dB < -30) return 'very_quiet';
        if (dB < -15) return 'quiet';
        if (dB < -5) return 'normal';
        if (dB < 0) return 'loud';
        return 'very_loud';
    }

    /**
     * Analyze voice quality (breathy, tense, relaxed)
     */
    analyzeVoiceQuality(frequencies) {
        const highFreqEnergy = frequencies.slice(frequencies.length / 2).reduce((a, b) => a + b, 0);
        const totalEnergy = frequencies.reduce((a, b) => a + b, 0);

        const breathiness = highFreqEnergy / totalEnergy;
        const tension = this.estimateTension(frequencies);
        const resonance = this.estimateResonance(frequencies);

        return {
            breathiness: breathiness > 0.3 ? 'high' : breathiness > 0.15 ? 'moderate' : 'low',
            tension: tension,
            resonance: resonance,
            voiceType: this.classifyVoiceType(frequencies)
        };
    }

    /**
     * Estimate vocal tension
     * High frequency concentration = tension
     */
    estimateTension(frequencies) {
        const highFreq = frequencies.slice(frequencies.length / 2).reduce((a, b) => a + b, 0);
        const lowFreq = frequencies.slice(0, frequencies.length / 2).reduce((a, b) => a + b, 0);
        const ratio = highFreq / lowFreq;

        if (ratio > 0.7) return 'high';
        if (ratio > 0.4) return 'moderate';
        return 'low';
    }

    /**
     * Estimate vocal resonance (chest vs head)
     */
    estimateResonance(frequencies) {
        // Very simplified: low frequencies = chest, high = head
        const lowFreq = frequencies.slice(0, frequencies.length / 4).reduce((a, b) => a + b, 0);
        const highFreq = frequencies.slice(frequencies.length * 3 / 4).reduce((a, b) => a + b, 0);

        if (lowFreq > highFreq * 2) return 'chest';
        if (highFreq > lowFreq * 2) return 'head';
        return 'mixed';
    }

    /**
     * Classify voice type (male, female, child)
     */
    classifyVoiceType(frequencies) {
        // Simplified: based on dominant frequency
        let maxEnergy = 0;
        let maxIndex = 0;

        for (let i = 0; i < frequencies.length; i++) {
            if (frequencies[i] > maxEnergy) {
                maxEnergy = frequencies[i];
                maxIndex = i;
            }
        }

        const pitchHz = (maxIndex * 16000) / 2048;

        if (pitchHz < 85) return 'male_deep';
        if (pitchHz < 150) return 'male';
        if (pitchHz < 250) return 'female';
        return 'female_high';
    }

    /**
     * Detect pauses (silence)
     */
    detectPauses(frequencies) {
        const energyThreshold = 0.05 * 255; // 5% of max
        let pauseCount = 0;
        let isCurrentlyPaused = false;

        for (let i = 0; i < frequencies.length; i++) {
            if (frequencies[i] < energyThreshold) {
                if (!isCurrentlyPaused) {
                    pauseCount++;
                    isCurrentlyPaused = true;
                }
            } else {
                isCurrentlyPaused = false;
            }
        }

        return {
            pauseCount: pauseCount,
            isPaused: pauseCount > 5,
            pauseIntensity: 'low' // Would need temporal analysis for accuracy
        };
    }

    /**
     * Identify prosody pattern
     * Flat = monotone, Rising = questioning, Falling = assertive
     */
    identifyProsodyPattern(frequencies) {
        if (this.pitchBuffer.length < 5) {
            return { pattern: 'unknown', confidence: 0 };
        }

        const recentPitches = this.pitchBuffer.slice(-10);
        const trend = this.calculateTrend(recentPitches);

        let pattern = 'flat';
        let emotionIndicators = [];

        if (trend > 0.1) {
            pattern = 'rising';
            emotionIndicators = ['questioning', 'uncertain', 'excited'];
        } else if (trend < -0.1) {
            pattern = 'falling';
            emotionIndicators = ['assertive', 'determined', 'confident'];
        } else {
            pattern = 'flat';
            emotionIndicators = ['monotone', 'depressed', 'detached'];
        }

        return {
            pattern: pattern,
            trend: trend,
            emotionIndicators: emotionIndicators,
            confidence: Math.abs(trend)
        };
    }

    /**
     * Detect vibrato (natural oscillation in pitch)
     * Indicates relaxation/emotion
     */
    detectVibrato(pitch) {
        if (this.pitchBuffer.length < 10) {
            return { detected: false, confidence: 0 };
        }

        const recentPitches = this.pitchBuffer.slice(-10).map(p => p.hz);
        const variance = this.calculateVariance(recentPitches);

        return {
            detected: variance > 20,
            variance: variance,
            frequency: '5-7 Hz', // Typical vibrato rate
            emotionalSignificance: variance > 20 ? 'emotional_expression' : 'controlled'
        };
    }

    /**
     * Calculate trend from pitch buffer
     */
    calculateTrend(pitches) {
        if (pitches.length < 2) return 0;

        const first = pitches[0].hz;
        const last = pitches[pitches.length - 1].hz;
        const mid = pitches[Math.floor(pitches.length / 2)].hz;

        return (last - first) / first;
    }

    /**
     * Calculate variance from array of values
     */
    calculateVariance(values) {
        if (values.length === 0) return 0;
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
        return Math.sqrt(variance); // Standard deviation
    }

    /**
     * Get prosody statistics
     */
    getStats() {
        if (this.pitchBuffer.length === 0) {
            return null;
        }

        const pitches = this.pitchBuffer.map(p => p.hz);
        const intensities = this.intensityBuffer.map(i => i.dB);

        return {
            avgPitch: Math.round(pitches.reduce((a, b) => a + b, 0) / pitches.length),
            minPitch: Math.min(...pitches),
            maxPitch: Math.max(...pitches),
            avgIntensity: Math.round(intensities.reduce((a, b) => a + b, 0) / intensities.length),
            pitchVariability: this.calculateVariance(pitches)
        };
    }
}

export const prosodyAnalyzer = new ProsodyAnalyzer();

export default ProsodyAnalyzer;
