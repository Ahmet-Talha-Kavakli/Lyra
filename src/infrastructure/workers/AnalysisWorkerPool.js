/**
 * Analysis Worker Pool
 *
 * KRITIK: Backend Event Loop Tıkanması
 *
 * Problem: AUWebSocketHandler'da heavy math (aggregate, deviation, temporal):
 * - 30 frame × 1000 users = 30.000 işlem/saniye
 * - Node.js single-threaded → Event loop blocks
 * - User 50'de latency 5-10 saniyeye çıkıyor
 *
 * Solution: Piscina worker pool
 * - Math-heavy operations run in separate threads
 * - Main thread stays responsive
 * - Scales to 1000+ concurrent users
 */

import Piscina from 'piscina';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../logging/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

class AnalysisWorkerPool {
    constructor(options = {}) {
        this.maxWorkers = options.maxWorkers || require('os').cpus().length;
        this.idleTimeout = options.idleTimeout || 30000; // 30 seconds

        // Create worker pool
        this.pool = new Piscina({
            filename: path.join(__dirname, 'analysis.worker.js'),
            maxWorkers: this.maxWorkers,
            idleTimeout: this.idleTimeout,
            concurrentTasksPerWorker: 10
        });

        // Stats
        this.tasksProcessed = 0;
        this.totalProcessingTime = 0;
        this.averageLatency = 0;

        logger.info('[AnalysisWorkerPool] Initialized', {
            maxWorkers: this.maxWorkers,
            idleTimeout: this.idleTimeout
        });
    }

    /**
     * AGGREGATE ACTION UNITS (offload to worker)
     * Takes buffer of 30 AU frames, averages them
     */
    async aggregateActionUnits(analysisBuffer) {
        try {
            const startTime = performance.now();

            const result = await this.pool.run({
                task: 'aggregateActionUnits',
                analysisBuffer: analysisBuffer
            });

            const latency = performance.now() - startTime;
            this.updateStats(latency);

            return result;
        } catch (error) {
            logger.error('[AnalysisWorkerPool] aggregateActionUnits failed:', error);
            throw error;
        }
    }

    /**
     * CALCULATE BASELINE DEVIATION (offload to worker)
     * Heavy array processing + math
     */
    async calculateDeviation(currentAU, baseline) {
        try {
            const startTime = performance.now();

            const result = await this.pool.run({
                task: 'calculateDeviation',
                currentAU: currentAU,
                baseline: baseline
            });

            const latency = performance.now() - startTime;
            this.updateStats(latency);

            return result;
        } catch (error) {
            logger.error('[AnalysisWorkerPool] calculateDeviation failed:', error);
            throw error;
        }
    }

    /**
     * INFER SOMATIC MARKERS (offload to worker)
     * Complex conditional logic + scoring
     */
    async inferSomaticMarkers(deviationAnalysis, aggregatedAU) {
        try {
            const startTime = performance.now();

            const result = await this.pool.run({
                task: 'inferSomaticMarkers',
                deviationAnalysis: deviationAnalysis,
                aggregatedAU: aggregatedAU
            });

            const latency = performance.now() - startTime;
            this.updateStats(latency);

            return result;
        } catch (error) {
            logger.error('[AnalysisWorkerPool] inferSomaticMarkers failed:', error);
            throw error;
        }
    }

    /**
     * ANALYZE TEMPORAL PATTERNS (offload to worker)
     * Heavy array iteration + pattern detection
     */
    async analyzeTemporalPatterns(frameHistory, temporalState) {
        try {
            const startTime = performance.now();

            const result = await this.pool.run({
                task: 'analyzeTemporalPatterns',
                frameHistory: frameHistory,
                temporalState: temporalState
            });

            const latency = performance.now() - startTime;
            this.updateStats(latency);

            return result;
        } catch (error) {
            logger.error('[AnalysisWorkerPool] analyzeTemporalPatterns failed:', error);
            throw error;
        }
    }

    /**
     * BATCH OPERATION: Process full analysis in worker
     * All heavy ops at once = less overhead
     */
    async performFullAnalysis(data) {
        try {
            const startTime = performance.now();

            const result = await this.pool.run({
                task: 'performFullAnalysis',
                data: data
            });

            const latency = performance.now() - startTime;
            this.updateStats(latency);

            logger.debug('[AnalysisWorkerPool] Full analysis complete', {
                latency: Math.round(latency),
                tasksProcessed: this.tasksProcessed,
                averageLatency: Math.round(this.averageLatency)
            });

            return result;
        } catch (error) {
            logger.error('[AnalysisWorkerPool] performFullAnalysis failed:', error);
            throw error;
        }
    }

    /**
     * Update performance statistics
     */
    updateStats(latency) {
        this.tasksProcessed++;
        this.totalProcessingTime += latency;
        this.averageLatency = this.totalProcessingTime / this.tasksProcessed;
    }

    /**
     * Get pool statistics
     */
    getStats() {
        return {
            tasksProcessed: this.tasksProcessed,
            averageLatency: Math.round(this.averageLatency * 100) / 100,
            totalProcessingTime: Math.round(this.totalProcessingTime),
            maxWorkers: this.maxWorkers,
            idleTimeout: this.idleTimeout
        };
    }

    /**
     * Drain pool (graceful shutdown)
     */
    async drain() {
        try {
            await this.pool.drain();
            logger.info('[AnalysisWorkerPool] Drained successfully');
        } catch (error) {
            logger.error('[AnalysisWorkerPool] Drain failed:', error);
        }
    }

    /**
     * Destroy pool (hard shutdown)
     */
    async destroy() {
        try {
            await this.pool.destroy();
            logger.info('[AnalysisWorkerPool] Destroyed');
        } catch (error) {
            logger.error('[AnalysisWorkerPool] Destroy failed:', error);
        }
    }
}

export default AnalysisWorkerPool;
