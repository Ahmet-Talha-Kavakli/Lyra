/**
 * Analysis Worker Thread
 *
 * Runs heavy mathematical operations in separate threads
 * Main thread stays responsive, serves 1000+ concurrent users
 *
 * Imported by Piscina worker pool
 */

/**
 * AGGREGATE ACTION UNITS
 * Average 30 AU frames → single aggregated AU
 */
function aggregateActionUnits(analysisBuffer) {
    const auMap = new Map();
    let totalSymmetry = 0;
    let totalConfidence = 0;
    let lastSmileAuthenticity = 'unknown';

    analysisBuffer.forEach(frame => {
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
        symmetry: totalSymmetry / analysisBuffer.length,
        confidence: totalConfidence / analysisBuffer.length,
        smileAuthenticity: lastSmileAuthenticity
    };
}

/**
 * CALCULATE DEVIATION
 * Convert absolute AU values to relative deviations from baseline
 */
function calculateDeviation(currentAU, baseline) {
    const deviation = {
        raw: currentAU,
        deviations: {},
        totalDeviation: 0,
        deviationPercentage: 0,
        baselineSet: baseline !== null,
        baselineQuality: baseline?.quality || 0
    };

    if (!baseline) {
        return { ...deviation, raw: currentAU };
    }

    let deviationCount = 0;

    Object.keys(currentAU).forEach(key => {
        if (key.startsWith('AU') && typeof currentAU[key] === 'number') {
            const baselineValue = baseline[key] || 0;
            const currentValue = currentAU[key];
            const dev = currentValue - baselineValue;

            deviation.deviations[key] = {
                baseline: baselineValue,
                current: currentValue,
                deviation: Math.round(dev * 100) / 100,
                deviationPercent: baselineValue > 0 ? ((dev / baselineValue) * 100) : 0
            };

            deviation.totalDeviation += Math.abs(dev);
            deviationCount++;
        }
    });

    deviation.deviationPercentage = deviationCount > 0
        ? Math.round((deviation.totalDeviation / deviationCount) * 100) / 100
        : 0;

    return deviation;
}

/**
 * INFER SOMATIC MARKERS
 * Detect shame, fear, sadness, disgust, safety, dissociation
 */
function inferSomaticMarkers(deviationAnalysis, aggregatedAU) {
    const markers = {
        shame: { score: 0, indicators: [] },
        fear: { score: 0, indicators: [] },
        sadness: { score: 0, indicators: [] },
        disgust: { score: 0, indicators: [] },
        safety: { score: 0, indicators: [] },
        dissociation: { score: 0, indicators: [] }
    };

    const deviations = deviationAnalysis.deviations || {};

    // SHAME: AU4 + AU15 deviation
    const au4Dev = deviations['AU4']?.deviation || 0;
    const au15Dev = deviations['AU15']?.deviation || 0;
    if (au4Dev > 1 || au15Dev > 1) {
        markers.shame.score = Math.min(1, Math.max(au4Dev, au15Dev) / 3);
        markers.shame.indicators.push('brow_lowering', 'lip_depression');
    }

    // FEAR: AU5 + AU26 deviation
    const au5Dev = deviations['AU5']?.deviation || 0;
    const au26Dev = deviations['AU26']?.deviation || 0;
    if (au5Dev > 1 || au26Dev > 1) {
        markers.fear.score = Math.min(1, Math.max(au5Dev, au26Dev) / 3);
        markers.fear.indicators.push('eye_widening', 'jaw_dropping');
    }

    // SADNESS: AU1 deviation
    const au1Dev = deviations['AU1']?.deviation || 0;
    if (au1Dev > 0.5) {
        markers.sadness.score = Math.min(1, au1Dev / 2);
        markers.sadness.indicators.push('inner_brow_raise');
    }

    // DISGUST: AU9 + AU10 deviation
    const au9Dev = deviations['AU9']?.deviation || 0;
    const au10Dev = deviations['AU10']?.deviation || 0;
    if (au9Dev > 1 || au10Dev > 1) {
        markers.disgust.score = Math.min(1, Math.max(au9Dev, au10Dev) / 3);
        markers.disgust.indicators.push('nose_wrinkle', 'upper_lip_raise');
    }

    // SAFETY: Genuine smile (AU6 + AU12)
    const au6Dev = deviations['AU6']?.deviation || 0;
    const au12Dev = deviations['AU12']?.deviation || 0;
    if ((au12Dev > 1 && au6Dev > 0.5) && aggregatedAU?.smileAuthenticity === 'genuine') {
        markers.safety.score = 0.8;
        markers.safety.indicators.push('genuine_smile', 'positive_engagement');
    }

    // DISSOCIATION: AU7 + asymmetry
    const au7Dev = deviations['AU7']?.deviation || 0;
    const symmetry = aggregatedAU?.symmetry || 1;
    if (au7Dev > 1 && symmetry < 0.65) {
        markers.dissociation.score = 0.7;
        markers.dissociation.indicators.push('eye_tension', 'facial_asymmetry');
    }

    return markers;
}

/**
 * ANALYZE TEMPORAL PATTERNS
 * Heavy array iteration for micro/macro expression detection
 */
function analyzeTemporalPatterns(frameHistory, temporalState) {
    if (!frameHistory || frameHistory.length < 2) {
        return {
            currentExpression: temporalState?.currentExpression || null,
            expressionDuration: temporalState?.expressionDuration || 0,
            stability: 1.0,
            microExpressions: 0,
            macroExpressions: 0
        };
    }

    // Calculate stability from recent transitions
    let totalDuration = 0;
    let transitionCount = 0;

    const recentWindow = Date.now() - (30 * 1000); // Last 30 seconds

    frameHistory.forEach(transition => {
        if (typeof transition.timestamp === 'number') {
            if (transition.timestamp > recentWindow) {
                totalDuration += transition.duration_seconds || 0;
                transitionCount++;
            }
        }
    });

    const avgDuration = transitionCount > 0 ? totalDuration / transitionCount : 30;
    const stability = Math.min(1, avgDuration / 3);

    // Count micro vs macro
    let microCount = 0;
    let macroCount = 0;

    frameHistory.forEach(transition => {
        const durationMs = (transition.duration_frames || 0) * (1000 / 24); // Convert to ms
        if (durationMs < 500) {
            microCount++;
        } else if (durationMs > 3000) {
            macroCount++;
        }
    });

    return {
        currentExpression: temporalState?.currentExpression || null,
        expressionDuration: temporalState?.expressionDuration || 0,
        stability: Math.round(stability * 100) / 100,
        microExpressions: microCount,
        macroExpressions: macroCount,
        totalTransitions: frameHistory.length
    };
}

/**
 * PERFORM FULL ANALYSIS
 * Batch operation: all heavy processing at once
 */
function performFullAnalysis(data) {
    const {
        analysisBuffer,
        baseline,
        aggregatedAU,
        frameHistory,
        temporalState
    } = data;

    // 1. Aggregate AU
    const aggregated = aggregateActionUnits(analysisBuffer);

    // 2. Calculate deviation
    const deviation = calculateDeviation(aggregated.intensities, baseline);

    // 3. Infer markers
    const markers = inferSomaticMarkers(deviation, aggregated);

    // 4. Analyze temporal
    const temporal = analyzeTemporalPatterns(frameHistory, temporalState);

    return {
        aggregated,
        deviation,
        markers,
        temporal,
        processingComplete: true
    };
}

/**
 * WORKER MESSAGE HANDLER
 * Receives task from main thread, processes, returns result
 */
module.exports = async function(message) {
    const { task, ...params } = message;

    switch (task) {
        case 'aggregateActionUnits':
            return aggregateActionUnits(params.analysisBuffer);

        case 'calculateDeviation':
            return calculateDeviation(params.currentAU, params.baseline);

        case 'inferSomaticMarkers':
            return inferSomaticMarkers(params.deviationAnalysis, params.aggregatedAU);

        case 'analyzeTemporalPatterns':
            return analyzeTemporalPatterns(params.frameHistory, params.temporalState);

        case 'performFullAnalysis':
            return performFullAnalysis(params.data);

        default:
            throw new Error(`Unknown task: ${task}`);
    }
};
