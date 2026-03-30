/**
 * Load Testing Script for Lyra AI Therapist
 *
 * Purpose: Simulate 100K concurrent users with realistic chat patterns
 * Tools: Artillery.io compatible format
 *
 * Usage:
 *   node load-test.js --target http://localhost:3000 --rate 1000 --duration 60
 */

import http from 'http';
import { performance } from 'perf_hooks';

// ─── CONFIGURATION ────────────────────────────────────────────────────────
const CONFIG = {
    target: process.env.TARGET || 'http://localhost:3000',
    rate: parseInt(process.env.RATE || 100),           // requests per second
    duration: parseInt(process.env.DURATION || 60),    // seconds
    concurrent: parseInt(process.env.CONCURRENT || 50), // concurrent connections
};

const SAMPLE_MESSAGES = [
    "Bugün çok yorgunum, neden böyle hissediyorum?",
    "İşte sorunlar var, nasıl başa çıkabilirim?",
    "Bazı kararlar vermekte zorlanıyorum.",
    "Geçmişimi unuttuk, nasıl yapabilirim?",
    "Duygularımı kontrol edemiyorum.",
    "Başarısız hissediyorum, neden?",
    "Arkadaşlarımla ilişkim sorunlu.",
    "Uyku sorunu yaşıyorum.",
    "Kaygılandığım biliyor musun?",
    "Umut yok gibi hissediyorum.",
];

// ─── METRICS ──────────────────────────────────────────────────────────────
const METRICS = {
    totalRequests: 0,
    totalErrors: 0,
    totalSuccess: 0,
    responseTimes: [],
    startTime: Date.now(),
    endTime: null,
    errorsByStatus: {},
    timeoutCount: 0,
};

// ─── LOAD TEST ────────────────────────────────────────────────────────────

/**
 * Make a single chat request to the Lyra API
 */
async function makeChatRequest(userId) {
    return new Promise((resolve, reject) => {
        const startTime = performance.now();
        const messages = [
            {
                role: 'user',
                content: SAMPLE_MESSAGES[Math.floor(Math.random() * SAMPLE_MESSAGES.length)]
            }
        ];

        const payload = JSON.stringify({
            messages,
            model: 'gpt-4o-mini',
            call: {
                metadata: { userId }
            }
        });

        const options = {
            hostname: new URL(CONFIG.target).hostname,
            port: new URL(CONFIG.target).port || 80,
            path: '/v1/api/chat/completions',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload),
            },
            timeout: 30000,
        };

        const req = http.request(options, (res) => {
            let data = '';

            res.on('data', (chunk) => {
                data += chunk;
            });

            res.on('end', () => {
                const endTime = performance.now();
                const responseTime = endTime - startTime;

                METRICS.totalRequests++;
                METRICS.responseTimes.push(responseTime);

                if (res.statusCode >= 200 && res.statusCode < 300) {
                    METRICS.totalSuccess++;
                    resolve({ statusCode: res.statusCode, responseTime });
                } else {
                    METRICS.totalErrors++;
                    METRICS.errorsByStatus[res.statusCode] = (METRICS.errorsByStatus[res.statusCode] || 0) + 1;
                    reject({ statusCode: res.statusCode, responseTime });
                }
            });
        });

        req.on('error', (err) => {
            METRICS.totalErrors++;
            METRICS.timeoutCount++;
            reject({ error: err.message });
        });

        req.on('timeout', () => {
            METRICS.totalErrors++;
            METRICS.timeoutCount++;
            req.destroy();
            reject({ error: 'timeout' });
        });

        req.write(payload);
        req.end();
    });
}

/**
 * Generate requests at target rate
 */
async function generateLoad(durationSeconds) {
    const endTime = Date.now() + (durationSeconds * 1000);
    let requestCount = 0;

    console.log(`📊 Load test starting...`);
    console.log(`   Target: ${CONFIG.target}`);
    console.log(`   Rate: ${CONFIG.rate} req/s`);
    console.log(`   Duration: ${durationSeconds}s`);
    console.log(`   Expected: ${CONFIG.rate * durationSeconds} total requests`);
    console.log(`   Concurrent connections: ${CONFIG.concurrent}\n`);

    while (Date.now() < endTime) {
        const promises = [];
        for (let i = 0; i < CONFIG.concurrent; i++) {
            const userId = `load-test-${Date.now()}-${requestCount}-${i}`;
            promises.push(
                makeChatRequest(userId).catch(() => {})
            );
            requestCount++;
        }

        await Promise.all(promises);

        if (requestCount % 1000 === 0) {
            const elapsed = (Date.now() - (endTime - durationSeconds * 1000)) / 1000;
            const rate = (requestCount / elapsed).toFixed(2);
            console.log(`   ✓ ${requestCount} requests sent (${rate} req/s)`);
        }
    }

    METRICS.endTime = Date.now();
    return requestCount;
}

/**
 * Calculate and print statistics
 */
function printStats() {
    const duration = (METRICS.endTime - METRICS.startTime) / 1000;
    const avgResponseTime = METRICS.responseTimes.reduce((a, b) => a + b, 0) / METRICS.responseTimes.length;
    const sortedTimes = METRICS.responseTimes.sort((a, b) => a - b);
    const p50 = sortedTimes[Math.floor(sortedTimes.length * 0.5)];
    const p95 = sortedTimes[Math.floor(sortedTimes.length * 0.95)];
    const p99 = sortedTimes[Math.floor(sortedTimes.length * 0.99)];

    console.log('\n📊 LOAD TEST RESULTS\n');
    console.log('─'.repeat(60));
    console.log('Summary:');
    console.log(`  Total Requests:    ${METRICS.totalRequests}`);
    console.log(`  Successful:        ${METRICS.totalSuccess} (${((METRICS.totalSuccess / METRICS.totalRequests) * 100).toFixed(2)}%)`);
    console.log(`  Failed:            ${METRICS.totalErrors} (${((METRICS.totalErrors / METRICS.totalRequests) * 100).toFixed(2)}%)`);
    console.log(`  Timeouts:          ${METRICS.timeoutCount}`);
    console.log(`  Duration:          ${duration.toFixed(2)}s`);
    console.log(`  Throughput:        ${(METRICS.totalRequests / duration).toFixed(2)} req/s`);

    console.log('\nResponse Times (ms):');
    console.log(`  Average:           ${avgResponseTime.toFixed(2)}ms`);
    console.log(`  Min:               ${Math.min(...METRICS.responseTimes).toFixed(2)}ms`);
    console.log(`  Max:               ${Math.max(...METRICS.responseTimes).toFixed(2)}ms`);
    console.log(`  P50 (Median):      ${p50.toFixed(2)}ms`);
    console.log(`  P95:               ${p95.toFixed(2)}ms`);
    console.log(`  P99:               ${p99.toFixed(2)}ms`);

    if (Object.keys(METRICS.errorsByStatus).length > 0) {
        console.log('\nError Status Codes:');
        for (const [status, count] of Object.entries(METRICS.errorsByStatus)) {
            console.log(`  ${status}: ${count}`);
        }
    }

    console.log('\n─'.repeat(60));
    console.log('\n🎯 PERFORMANCE ASSESSMENT\n');

    const assessment = {
        throughput: METRICS.totalRequests / duration > CONFIG.rate ? '✅ PASS' : '❌ FAIL',
        latency: avgResponseTime < 500 ? '✅ PASS' : avgResponseTime < 1000 ? '⚠️  WARN' : '❌ FAIL',
        errorRate: METRICS.totalErrors / METRICS.totalRequests < 0.01 ? '✅ PASS' : '❌ FAIL',
        p99: p99 < 1000 ? '✅ PASS' : p99 < 2000 ? '⚠️  WARN' : '❌ FAIL',
    };

    console.log(`Throughput:        ${(METRICS.totalRequests / duration).toFixed(2)} req/s ${assessment.throughput}`);
    console.log(`Avg Latency:       ${avgResponseTime.toFixed(2)}ms ${assessment.latency}`);
    console.log(`Error Rate:        ${((METRICS.totalErrors / METRICS.totalRequests) * 100).toFixed(2)}% ${assessment.errorRate}`);
    console.log(`P99 Latency:       ${p99.toFixed(2)}ms ${assessment.p99}`);

    console.log('\n' + '─'.repeat(60) + '\n');
}

// ─── MAIN ─────────────────────────────────────────────────────────────────
(async () => {
    try {
        const totalRequests = await generateLoad(CONFIG.duration);
        console.log(`\n✅ Load test completed: ${totalRequests} requests sent\n`);
        printStats();
    } catch (err) {
        console.error('❌ Load test failed:', err);
        process.exit(1);
    }
})();
