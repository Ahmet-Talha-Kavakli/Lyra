/**
 * Baseline Calibration Module
 *
 * KRITIK: Her insan farklı "neutral" yüz ifadesine sahiptir
 *
 * Problem: "Resting Bitch Face" (RBF)
 * Bazı insanlar genetik olarak sinirli görünürler
 * Lyra bunları "hep sinirli" diye işaretlemesine KESINLIKLE izin vermeyecek
 *
 * Solution: "Tare" (Sıfırla) — Mutfak terazisindeki TARE tuşu gibi
 *
 * Process:
 * 1. Seans başında 60 saniye baseline measurement
 * 2. Neutral face'i kaydet (her AU'nun ortalama değeri)
 * 3. Sonraki tüm ölçümler bu baseline'a GÖRE yapılsın
 * 4. "Deviation from baseline" = actual emotional indicator
 *
 * Not: "Absolute AU4 = 3" ❌ YANLIŞ
 *      "AU4 = baseline + 2" ✅ DOĞRU
 */

import { logger } from '../logging/logger.js';

export class BaselineCalibration {
    constructor(options = {}) {
        this.userId = options.userId;
        this.sessionId = options.sessionId;

        // Calibration state
        this.isCalibrating = false;
        this.calibrationFrames = [];
        this.calibrationDuration = options.calibrationDuration || 60000; // 60 seconds
        this.frameThreshold = options.frameThreshold || 100; // Collect 100 frames minimum

        // Baseline data (the "TARE" point)
        this.baseline = null;
        this.baselineTimestamp = null;

        // Confidence in baseline
        this.calibrationQuality = 0; // 0-1

        logger.info('[BaselineCalibration] Initialized', {
            userId: this.userId,
            sessionId: this.sessionId
        });
    }

    /**
     * START CALIBRATION
     * Call this when session begins
     * Show user: "Please relax, we're measuring your baseline face"
     */
    async startCalibration() {
        try {
            logger.info('[BaselineCalibration] Starting 60-second calibration');

            this.isCalibrating = true;
            this.calibrationFrames = [];

            return new Promise((resolve) => {
                // Set timeout to end calibration after duration
                setTimeout(() => {
                    this.finishCalibration();
                    resolve(this.baseline);
                }, this.calibrationDuration);
            });
        } catch (error) {
            logger.error('[BaselineCalibration] Start failed', { error: error.message });
            throw error;
        }
    }

    /**
     * ADD FRAME DURING CALIBRATION
     * Frontend sends AU data, we collect it
     */
    addCalibrationFrame(auData) {
        if (!this.isCalibrating) {
            return; // Ignore if not calibrating
        }

        try {
            this.calibrationFrames.push({
                timestamp: Date.now(),
                actionUnits: auData.actionUnits,
                confidence: auData.confidence,
                symmetry: auData.symmetry
            });

            // Log progress (every 20 frames)
            if (this.calibrationFrames.length % 20 === 0) {
                logger.debug('[BaselineCalibration] Progress', {
                    frames: this.calibrationFrames.length,
                    target: this.frameThreshold
                });
            }
        } catch (error) {
            logger.error('[BaselineCalibration] Frame add failed', { error: error.message });
        }
    }

    /**
     * FINISH CALIBRATION
     * Calculate average baseline from collected frames
     */
    finishCalibration() {
        try {
            logger.info('[BaselineCalibration] Finishing calibration', {
                framesCollected: this.calibrationFrames.length
            });

            if (this.calibrationFrames.length < this.frameThreshold) {
                logger.warn('[BaselineCalibration] Low frame count', {
                    collected: this.calibrationFrames.length,
                    recommended: this.frameThreshold
                });
            }

            // Calculate baseline (average of all AU values)
            this.baseline = this.calculateBaseline();
            this.baselineTimestamp = new Date().toISOString();
            this.isCalibrating = false;

            logger.info('[BaselineCalibration] Calibration complete', {
                baseline: this.baseline,
                framesUsed: this.calibrationFrames.length,
                quality: this.calibrationQuality
            });

            return this.baseline;
        } catch (error) {
            logger.error('[BaselineCalibration] Finish failed', { error: error.message });
            throw error;
        }
    }

    /**
     * CALCULATE BASELINE
     * Average all AU values across calibration period
     *
     * This becomes the "ZERO POINT" for this patient
     */
    calculateBaseline() {
        const baseline = {
            AU1: 0, AU2: 0, AU4: 0, AU5: 0, AU6: 0, AU7: 0,
            AU9: 0, AU10: 0, AU12: 0, AU14: 0, AU15: 0,
            AU17: 0, AU20: 0, AU26: 0,
            symmetry: 0,
            expression_intensity: 0
        };

        // Sum all values
        this.calibrationFrames.forEach(frame => {
            Object.keys(baseline).forEach(key => {
                const value = frame.actionUnits[key] || 0;
                baseline[key] += value;
            });

            if (frame.symmetry) {
                baseline.symmetry += frame.symmetry;
            }
        });

        const frameCount = this.calibrationFrames.length;

        // Average
        Object.keys(baseline).forEach(key => {
            baseline[key] = Math.round((baseline[key] / frameCount) * 100) / 100;
        });

        // Calculate calibration quality
        // (How stable were the values? Low variance = high quality)
        this.calibrationQuality = this.calculateCalibrationQuality();

        return baseline;
    }

    /**
     * Calculate calibration quality
     * Variance in baseline indicates fidgeting/movement
     * Low variance = good baseline
     */
    calculateCalibrationQuality() {
        try {
            const baselineAUs = Object.keys(this.baseline).filter(k => k.startsWith('AU'));

            let totalVariance = 0;

            baselineAUs.forEach(auKey => {
                const values = this.calibrationFrames.map(f => f.actionUnits[auKey] || 0);
                const mean = values.reduce((a, b) => a + b, 0) / values.length;
                const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
                totalVariance += variance;
            });

            // Average variance across AUs
            const avgVariance = totalVariance / baselineAUs.length;

            // Convert to quality score (0-1, higher = better/more stable)
            // If avgVariance < 0.5 = great, > 2 = poor
            const quality = Math.max(0, 1 - (avgVariance / 3));

            logger.debug('[BaselineCalibration] Quality score', {
                quality: quality,
                avgVariance: avgVariance
            });

            return quality;
        } catch (error) {
            logger.error('[BaselineCalibration] Quality calc failed', { error: error.message });
            return 0.5; // Neutral if calculation fails
        }
    }

    /**
     * CONVERT TO DEVIATION
     *
     * THIS IS THE KEY FUNCTION
     * Takes raw AU data and converts to "deviation from baseline"
     *
     * Input:  { AU4: 3, AU12: 4, ... } (current measurement)
     * Output: { AU4_deviation: +1, AU12_deviation: +1 } (relative to baseline)
     *
     * Interpretation changes:
     * ❌ "AU4 = 3" → might mean angry
     * ✅ "AU4 baseline = 3, current = 3" → NOT angry (no change)
     * ✅ "AU4 baseline = 0, current = 3" → ANGRY (big change)
     */
    getDeviation(currentAU) {
        if (!this.baseline) {
            logger.warn('[BaselineCalibration] No baseline set, returning raw values');
            return currentAU; // Return raw if no baseline
        }

        const deviation = {
            // Raw values (for reference)
            raw: currentAU,

            // DEVIATION from baseline (the important part)
            deviations: {},

            // Summary stats
            totalDeviation: 0,
            deviationPercentage: 0,

            // Calibration metadata
            baselineSet: true,
            baselineQuality: this.calibrationQuality
        };

        let deviationCount = 0;

        // Calculate deviation for each AU
        Object.keys(currentAU).forEach(key => {
            if (key.startsWith('AU') && typeof currentAU[key] === 'number') {
                const baselineValue = this.baseline[key] || 0;
                const currentValue = currentAU[key];
                const dev = currentValue - baselineValue;

                deviation.deviations[key] = {
                    baseline: baselineValue,
                    current: currentValue,
                    deviation: Math.round(dev * 100) / 100, // Relative change
                    deviationPercent: baselineValue > 0 ? ((dev / baselineValue) * 100) : 0
                };

                deviation.totalDeviation += Math.abs(dev);
                deviationCount++;
            }
        });

        // Average deviation across AUs
        deviation.deviationPercentage = deviationCount > 0
            ? Math.round((deviation.totalDeviation / deviationCount) * 100) / 100
            : 0;

        return deviation;
    }

    /**
     * CLINICAL INTERPRETATION WITH BASELINE
     *
     * Old (wrong): "AU4 > 2.5 = angry"
     * New (right): "AU4 deviation > +1 from baseline = angry"
     */
    interpretWithBaseline(currentAU) {
        const deviation = this.getDeviation(currentAU);

        const interpretation = {
            timestamp: new Date().toISOString(),
            deviation: deviation,
            clinicalMarkers: this.detectMarkers(deviation),
            confidence: this.getConfidence(deviation)
        };

        return interpretation;
    }

    /**
     * DETECT EMOTIONAL MARKERS BASED ON DEVIATION
     *
     * This is where clinical logic lives now
     */
    detectMarkers(deviation) {
        const markers = {
            anger: { active: false, confidence: 0, reason: '' },
            fear: { active: false, confidence: 0, reason: '' },
            sadness: { active: false, confidence: 0, reason: '' },
            contempt: { active: false, confidence: 0, reason: '' }
        };

        // ═══════════════════════════════════════════════════════════
        // ANGER: AU4 (brow lower) deviation > +1
        // ═══════════════════════════════════════════════════════════
        const au4Dev = deviation.deviations['AU4'];
        if (au4Dev && au4Dev.deviation > 1) {
            markers.anger.active = true;
            markers.anger.confidence = Math.min(1, au4Dev.deviation / 3);
            markers.anger.reason = `AU4 elevated by ${au4Dev.deviation} from baseline ${au4Dev.baseline}`;
        }

        // ═══════════════════════════════════════════════════════════
        // FEAR: AU5 (eyelid raiser) + AU26 (jaw drop) deviations
        // ═══════════════════════════════════════════════════════════
        const au5Dev = deviation.deviations['AU5'];
        const au26Dev = deviation.deviations['AU26'];
        if ((au5Dev && au5Dev.deviation > 1) || (au26Dev && au26Dev.deviation > 1)) {
            markers.fear.active = true;
            const au5Score = au5Dev ? au5Dev.deviation / 3 : 0;
            const au26Score = au26Dev ? au26Dev.deviation / 3 : 0;
            markers.fear.confidence = Math.min(1, (au5Score + au26Score) / 2);
            markers.fear.reason = `Eyes/jaw elevation above baseline`;
        }

        // ═══════════════════════════════════════════════════════════
        // SADNESS: AU1 (inner brow) elevation
        // ═══════════════════════════════════════════════════════════
        const au1Dev = deviation.deviations['AU1'];
        if (au1Dev && au1Dev.deviation > 1) {
            markers.sadness.active = true;
            markers.sadness.confidence = Math.min(1, au1Dev.deviation / 3);
            markers.sadness.reason = `Inner brow elevated by ${au1Dev.deviation}`;
        }

        // ═══════════════════════════════════════════════════════════
        // CONTEMPT: AU10 (upper lip raiser) elevation
        // ═══════════════════════════════════════════════════════════
        const au10Dev = deviation.deviations['AU10'];
        if (au10Dev && au10Dev.deviation > 1) {
            markers.contempt.active = true;
            markers.contempt.confidence = Math.min(1, au10Dev.deviation / 2);
            markers.contempt.reason = `Upper lip raiser elevated by ${au10Dev.deviation}`;
        }

        return markers;
    }

    /**
     * Get confidence score for interpretation
     * Lower if: baseline quality is poor, deviations are small, etc
     */
    getConfidence(deviation) {
        let confidence = 0.5; // Base

        // Adjust for calibration quality
        confidence *= this.calibrationQuality;

        // Adjust for deviation magnitude
        if (deviation.deviationPercentage > 30) {
            confidence += 0.3; // High deviation = high confidence
        } else if (deviation.deviationPercentage > 10) {
            confidence += 0.1;
        }

        return Math.min(1, confidence);
    }

    /**
     * GET CALIBRATION STATUS
     */
    getStatus() {
        return {
            isCalibrating: this.isCalibrating,
            baselineSet: this.baseline !== null,
            baselineQuality: this.calibrationQuality,
            framesCollected: this.calibrationFrames.length,
            baseline: this.baseline,
            baselineTimestamp: this.baselineTimestamp
        };
    }

    /**
     * RESET CALIBRATION (for new patient or recalibration)
     */
    reset() {
        this.baseline = null;
        this.calibrationFrames = [];
        this.isCalibrating = false;
        this.baselineTimestamp = null;
        this.calibrationQuality = 0;

        logger.info('[BaselineCalibration] Reset for new calibration');
    }
}

export default BaselineCalibration;
