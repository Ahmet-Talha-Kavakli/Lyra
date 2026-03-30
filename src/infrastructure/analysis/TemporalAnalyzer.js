/**
 * Temporal Analyzer
 *
 * KRITIK: Micro-Expression vs Genuine Expression
 *
 * Problem: Bir insanın 200ms-500ms geçen yüz ifadesi (micro-expression)
 * ile 3-5 saniye süren gerçek duygu aynı mı?
 *
 * NO. Micro-expression = LEAKED emotion (bastırılan duygular)
 * Macro-expression = GENUINE emotion (gerçek duygu)
 *
 * Example:
 * - Micro: Patient smiles for 300ms → face back to neutral
 *   → Fear expression flashes (100ms) → controlled again
 *   → Clinical: Patient is MASKING fear with politeness
 *
 * - Macro: Patient maintains sad expression for 4 seconds
 *   → Gradually transitions to anger (2 seconds)
 *   → Clinical: Genuine emotional process, not defended
 *
 * Solution: Sliding window analysis
 * Not just "is AU4 active" but "how LONG is AU4 active"
 */

import { logger } from '../logging/logger.js';

export class TemporalAnalyzer {
    constructor(options = {}) {
        this.userId = options.userId;
        this.sessionId = options.sessionId;

        // Time windows (in frames)
        this.microExpressionWindow = options.microExpressionWindow || 15; // ~600ms at 24 FPS
        this.genuineExpressionWindow = options.genuineExpressionWindow || 120; // ~5 seconds
        this.transitionWindow = options.transitionWindow || 60; // ~2.5 seconds

        // Frame history for temporal analysis
        this.frameHistory = []; // Rolling buffer of AU frames
        this.maxHistorySize = options.maxHistorySize || 300; // Keep 12+ seconds at 24 FPS

        // Expression tracking
        this.currentExpression = null;
        this.expressionDuration = 0;
        this.expressionTransitions = [];

        logger.info('[TemporalAnalyzer] Initialized');
    }

    /**
     * ADD FRAME TO HISTORY
     * Every AU frame gets timestamped and stored
     */
    addFrame(auData) {
        try {
            const frame = {
                timestamp: Date.now(),
                actionUnits: auData.actionUnits,
                confidence: auData.confidence,
                primaryAU: this.identifyPrimaryAU(auData.actionUnits),
                frameIndex: this.frameHistory.length
            };

            this.frameHistory.push(frame);

            // Keep history size manageable
            if (this.frameHistory.length > this.maxHistorySize) {
                this.frameHistory.shift();
            }

            // Update expression tracking
            this.updateExpressionTracking();

            return frame;
        } catch (error) {
            logger.error('[TemporalAnalyzer] Frame add failed', { error: error.message });
            return null;
        }
    }

    /**
     * Identify primary AU from frame
     */
    identifyPrimaryAU(actionUnits) {
        let maxAU = null;
        let maxValue = 0;

        Object.entries(actionUnits).forEach(([key, value]) => {
            if (key.startsWith('AU') && typeof value === 'number' && value > maxValue) {
                maxAU = key;
                maxValue = value;
            }
        });

        return maxAU;
    }

    /**
     * UPDATE EXPRESSION TRACKING
     * Track current expression and how long it's been active
     */
    updateExpressionTracking() {
        if (this.frameHistory.length < 2) return;

        const currentFrame = this.frameHistory[this.frameHistory.length - 1];
        const previousFrame = this.frameHistory[this.frameHistory.length - 2];

        if (currentFrame.primaryAU === previousFrame.primaryAU) {
            // Same expression continues
            this.expressionDuration += 1; // Increment frame count
        } else {
            // Expression changed - record transition
            if (this.currentExpression) {
                this.recordTransition(this.currentExpression, currentFrame.primaryAU);
            }

            this.currentExpression = currentFrame.primaryAU;
            this.expressionDuration = 1;
        }
    }

    /**
     * RECORD EXPRESSION TRANSITION
     * When one expression changes to another
     */
    recordTransition(fromAU, toAU) {
        const transition = {
            fromAU: fromAU,
            toAU: toAU,
            duration_frames: this.expressionDuration,
            duration_seconds: this.expressionDuration / 24, // Assuming 24 FPS
            timestamp: new Date().toISOString(),
            expressionType: this.classifyExpression(this.expressionDuration)
        };

        this.expressionTransitions.push(transition);

        logger.debug('[TemporalAnalyzer] Transition recorded', {
            from: fromAU,
            to: toAU,
            durationMs: transition.duration_seconds * 1000,
            type: transition.expressionType
        });
    }

    /**
     * CLASSIFY EXPRESSION BASED ON DURATION
     *
     * < 500ms (12 frames): MICRO-EXPRESSION (leaked emotion)
     * 500ms - 3s (12-72 frames): BRIEF EXPRESSION
     * 3s+ (72+ frames): MACRO-EXPRESSION (genuine emotion)
     */
    classifyExpression(durationFrames) {
        const durationMs = (durationFrames / 24) * 1000; // Convert to milliseconds

        if (durationMs < 500) {
            return 'MICRO_EXPRESSION'; // Fleeting, emotional leak
        } else if (durationMs < 3000) {
            return 'BRIEF_EXPRESSION'; // Moderate duration
        } else {
            return 'MACRO_EXPRESSION'; // Sustained, genuine
        }
    }

    /**
     * ANALYZE EXPRESSION PATTERN
     * Look at recent expression history and classify the pattern
     */
    analyzeExpressionPattern() {
        if (this.expressionTransitions.length === 0) {
            return {
                pattern: 'UNKNOWN',
                duration: 0,
                transitions: [],
                clinicalSignificance: 'LOW'
            };
        }

        // Get recent transitions (last 30 seconds)
        const recentWindow = Date.now() - (30 * 1000);
        const recentTransitions = this.expressionTransitions.filter(t => {
            const tTime = new Date(t.timestamp).getTime();
            return tTime > recentWindow;
        });

        const analysis = {
            transitionCount: recentTransitions.length,
            transitions: recentTransitions,
            expressionStability: this.calculateStability(),
            microExpressions: recentTransitions.filter(t => t.expressionType === 'MICRO_EXPRESSION'),
            macroExpressions: recentTransitions.filter(t => t.expressionType === 'MACRO_EXPRESSION'),
            clinicalInterpretation: this.generateClinicalInterpretation(recentTransitions)
        };

        return analysis;
    }

    /**
     * CALCULATE EXPRESSION STABILITY
     * How much is the person "flickering" between emotions?
     *
     * High = stable, person holding one expression
     * Low = unstable, person switching rapidly (anxiety, confusion)
     */
    calculateStability() {
        if (this.expressionTransitions.length < 2) {
            return 1.0; // Stable (no transitions)
        }

        // Look at transitions in last 30 seconds
        const recentWindow = Date.now() - (30 * 1000);
        const recentTransitions = this.expressionTransitions.filter(t => {
            const tTime = new Date(t.timestamp).getTime();
            return tTime > recentWindow;
        });

        // Calculate average duration between transitions
        let totalDuration = 0;
        recentTransitions.forEach(t => {
            totalDuration += t.duration_seconds;
        });

        const avgDuration = recentTransitions.length > 0
            ? totalDuration / recentTransitions.length
            : 30; // If no transitions, very stable

        // Normalize: 3 seconds = stable (1.0), 0.3 seconds = unstable (0.1)
        const stability = Math.min(1, avgDuration / 3);

        return Math.round(stability * 100) / 100;
    }

    /**
     * GENERATE CLINICAL INTERPRETATION
     */
    generateClinicalInterpretation(transitions) {
        const microCount = transitions.filter(t => t.expressionType === 'MICRO_EXPRESSION').length;
        const macroCount = transitions.filter(t => t.expressionType === 'MACRO_EXPRESSION').length;

        const interpretation = {
            microExpressionLeakCount: microCount,
            microExpressionMeaning: microCount > 2
                ? 'Multiple emotional leaks detected - patient suppressing feelings'
                : 'Few leaks - emotions relatively controlled',

            macroExpressionCount: macroCount,
            macroExpressionMeaning: macroCount > 1
                ? 'Multiple genuine expressions - patient is engaging authentically'
                : 'Few genuine expressions - expressions may be controlled/defended',

            stability: this.calculateStability(),
            overallClinicalPicture: this.generateOverallPicture(microCount, macroCount)
        };

        return interpretation;
    }

    /**
     * Generate overall clinical picture
     */
    generateOverallPicture(microCount, macroCount) {
        if (microCount > 5 && macroCount < 2) {
            return {
                pattern: 'DEFENDED_STATE',
                description: 'Patient showing many micro-expressions but few genuine ones',
                meaning: 'High suppression, emotions leaking but controlled',
                recommendation: 'Create more safety to allow authentic expression'
            };
        }

        if (macroCount > 3) {
            return {
                pattern: 'AUTHENTIC_ENGAGEMENT',
                description: 'Patient showing sustained genuine expressions',
                meaning: 'Good therapeutic engagement, not defended',
                recommendation: 'This is a good moment for deeper work'
            };
        }

        if (this.calculateStability() < 0.3) {
            return {
                pattern: 'EMOTIONAL_INSTABILITY',
                description: 'Rapid expression switching, high instability',
                meaning: 'Possible anxiety, confusion, or rapid emotional shifts',
                recommendation: 'Slow down, ground patient, check what\'s happening'
            };
        }

        return {
            pattern: 'NEUTRAL',
            description: 'Stable neutral state',
            meaning: 'Not much emotional expression',
            recommendation: 'Explore what\'s happening internally'
        };
    }

    /**
     * GET TEMPORAL INSIGHTS
     * Summary of temporal patterns
     */
    getTemporalInsights() {
        return {
            sessionId: this.sessionId,
            frameHistorySize: this.frameHistory.length,
            currentExpression: this.currentExpression,
            currentExpressionDuration_seconds: (this.expressionDuration / 24).toFixed(2),
            totalTransitions: this.expressionTransitions.length,
            expressionStability: this.calculateStability(),
            recentPattern: this.analyzeExpressionPattern(),
            lastUpdate: new Date().toISOString()
        };
    }

    /**
     * RESET for new analysis
     */
    reset() {
        this.frameHistory = [];
        this.currentExpression = null;
        this.expressionDuration = 0;
        this.expressionTransitions = [];
        logger.info('[TemporalAnalyzer] Reset');
    }
}

export default TemporalAnalyzer;
