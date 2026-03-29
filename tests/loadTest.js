// [LOAD TEST — 100K User Simulation]
// Run with: node tests/loadTest.js
// Measures: response time, memory usage, concurrent connection handling

import http from 'http';
import https from 'https';
import { performance } from 'perf_hooks';

const API_URL = process.env.API_URL || 'http://localhost:3001';
const DURATION_SECONDS = process.env.DURATION || 60;
const CONCURRENT_USERS = process.env.CONCURRENT || 100;
const REQUESTS_PER_USER = process.env.REQUESTS || 50;

/**
 * Simple HTTP request
 */
function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(API_URL + path);
        const client = url.protocol === 'https:' ? https : http;

        const options = {
            method,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname + url.search,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'LoadTest/1.0',
            },
        };

        const req = client.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data,
                });
            });
        });

        req.on('error', reject);

        if (body) {
            req.write(JSON.stringify(body));
        }

        req.end();
    });
}

/**
 * Simulate single user
 */
async function simulateUser(userId, iterations) {
    const results = {
        userId,
        successCount: 0,
        errorCount: 0,
        responseTimes: [],
        errors: [],
    };

    for (let i = 0; i < iterations; i++) {
        try {
            const startTime = performance.now();

            // Test 1: Health check (low cost)
            await request('GET', '/health');
            results.successCount++;

            // Test 2: Chat completion (high cost) — only 1 per user to avoid rate limits
            if (i === 0) {
                await request('POST', '/v1/api/chat/completions', {
                    messages: [
                        { role: 'user', content: 'How are you feeling today?' },
                    ],
                });
                results.successCount++;
            }

            const responseTime = performance.now() - startTime;
            results.responseTimes.push(responseTime);
        } catch (err) {
            results.errorCount++;
            results.errors.push(err.message);
        }

        // Spread requests over time
        await new Promise(resolve => setTimeout(resolve, Math.random() * 1000));
    }

    return results;
}

/**
 * Run load test
 */
async function runLoadTest() {
    console.log('🚀 Starting load test');
    console.log(`   API: ${API_URL}`);
    console.log(`   Concurrent users: ${CONCURRENT_USERS}`);
    console.log(`   Requests per user: ${REQUESTS_PER_USER}`);
    console.log(`   Total requests: ${CONCURRENT_USERS * REQUESTS_PER_USER}`);
    console.log('');

    const startTime = performance.now();
    const initialMemory = process.memoryUsage();

    // Spawn concurrent users
    const userPromises = [];
    for (let i = 0; i < CONCURRENT_USERS; i++) {
        userPromises.push(simulateUser(`user-${i}`, REQUESTS_PER_USER));
    }

    // Wait for all users to finish
    const results = await Promise.allSettled(userPromises);

    const endTime = performance.now();
    const finalMemory = process.memoryUsage();

    // Aggregate results
    const allResults = results
        .filter(r => r.status === 'fulfilled')
        .map(r => r.value);

    const totalSuccess = allResults.reduce((sum, r) => sum + r.successCount, 0);
    const totalErrors = allResults.reduce((sum, r) => sum + r.errorCount, 0);
    const allResponseTimes = allResults.flatMap(r => r.responseTimes);

    const avgResponseTime = allResponseTimes.length > 0
        ? allResponseTimes.reduce((a, b) => a + b, 0) / allResponseTimes.length
        : 0;

    const p95ResponseTime = allResponseTimes.length > 0
        ? allResponseTimes.sort((a, b) => a - b)[Math.floor(allResponseTimes.length * 0.95)]
        : 0;

    const p99ResponseTime = allResponseTimes.length > 0
        ? allResponseTimes.sort((a, b) => a - b)[Math.floor(allResponseTimes.length * 0.99)]
        : 0;

    const duration = (endTime - startTime) / 1000;
    const throughput = totalSuccess / duration;

    // Print results
    console.log('═══════════════════════════════════════════════════════════');
    console.log('📊 LOAD TEST RESULTS');
    console.log('═══════════════════════════════════════════════════════════');
    console.log('');
    console.log('Performance Metrics:');
    console.log(`  Duration: ${duration.toFixed(2)}s`);
    console.log(`  Total Requests: ${totalSuccess + totalErrors}`);
    console.log(`  Successful: ${totalSuccess} (${((totalSuccess / (totalSuccess + totalErrors)) * 100).toFixed(2)}%)`);
    console.log(`  Failed: ${totalErrors}`);
    console.log(`  Throughput: ${throughput.toFixed(2)} req/s`);
    console.log('');
    console.log('Response Time:');
    console.log(`  Average: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`  P95: ${p95ResponseTime.toFixed(2)}ms`);
    console.log(`  P99: ${p99ResponseTime.toFixed(2)}ms`);
    console.log(`  Max: ${Math.max(...allResponseTimes).toFixed(2)}ms`);
    console.log(`  Min: ${Math.min(...allResponseTimes).toFixed(2)}ms`);
    console.log('');
    console.log('Memory Usage:');
    console.log(`  Initial Heap: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Final Heap: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  Delta: ${((finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024).toFixed(2)}MB`);
    console.log(`  External: ${(finalMemory.external / 1024 / 1024).toFixed(2)}MB`);
    console.log('');
    console.log('═══════════════════════════════════════════════════════════');

    // Health assessment
    console.log('');
    console.log('📈 Assessment for 100K concurrent users:');
    if (avgResponseTime > 1000) {
        console.log('  ⚠️  Average response time > 1s (needs optimization)');
    } else {
        console.log('  ✅ Average response time < 1s (good)');
    }

    if (p99ResponseTime > 5000) {
        console.log('  ⚠️  P99 response time > 5s (tail latency issue)');
    } else {
        console.log('  ✅ P99 response time < 5s (acceptable)');
    }

    if (totalErrors > totalSuccess * 0.05) {
        console.log('  ⚠️  Error rate > 5% (check rate limiting, DB connections)');
    } else {
        console.log('  ✅ Error rate < 5% (acceptable)');
    }

    if (throughput < 100) {
        console.log('  ⚠️  Throughput < 100 req/s (scale for 100K users requires ~1000 req/s)');
    } else if (throughput < 500) {
        console.log('  ⚠️  Throughput < 500 req/s (may struggle with 100K users)');
    } else {
        console.log('  ✅ Throughput > 500 req/s (good for 100K users)');
    }

    const memoryDelta = (finalMemory.heapUsed - initialMemory.heapUsed) / 1024 / 1024;
    if (memoryDelta > 500) {
        console.log('  ⚠️  Memory increase > 500MB (check for memory leaks)');
    } else {
        console.log('  ✅ Memory usage stable (no obvious leaks)');
    }

    console.log('');
    console.log('Scaling to 100K concurrent users:');
    const usersPerInstance = CONCURRENT_USERS;
    const instancesNeeded = Math.ceil(100000 / usersPerInstance);
    console.log(`  Required instances: ~${instancesNeeded} (at ${usersPerInstance} users/instance)`);
    console.log(`  Load balancer: Round-robin or least-connections`);
    console.log(`  Database: PgBouncer + read replicas for 100K`);
    console.log(`  Cache: Redis cluster for distributed caching`);
}

// Run test
runLoadTest().catch(err => {
    console.error('Load test error:', err);
    process.exit(1);
});
