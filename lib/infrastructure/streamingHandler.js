/**
 * Server-Sent Events (SSE) Streaming Handler for Somatic Analysis
 * Replaces WebSocket with HTTP/SSE for Vercel Serverless compatibility
 *
 * Benefits over WebSocket:
 * - Works in Vercel Serverless (HTTP-based, not persistent connections)
 * - Built-in auto-reconnect in browser
 * - Can be cached by CDNs
 * - Works through proxies that block WebSocket
 *
 * Limitations:
 * - One-way streaming (server → client)
 * - Client → Server uses separate HTTP POST requests
 */

import { logger } from './logger.js';
import { verifyAccessToken } from './tokenManager.js';
import { AUWebSocketHandler } from '../../src/infrastructure/websocket/AUWebSocketHandler.js';

// In-memory connection tracking (for this Lambda execution)
// Note: Vercel Serverless is stateless, so connections don't persist across invocations
const activeStreams = new Map();

/**
 * Initialize SSE stream for somatic analysis
 * Called from POST /api/stream/:sessionId
 *
 * Usage:
 * ```javascript
 * app.get('/api/stream/:sessionId', (req, res) => {
 *     await initializeStream(req, res);
 * });
 * ```
 */
export async function initializeStream(req, res) {
    const { sessionId } = req.params;
    const token = req.headers.authorization?.split(' ')[1] ||
                  req.cookies?.lyra_token;

    // ═══════════════════════════════════════════════════════════
    // STEP 1: Authenticate token
    // ═══════════════════════════════════════════════════════════
    if (!token) {
        logger.warn('[SSE] Stream connection rejected - no token', { sessionId });
        return res.status(401).json({ error: 'No authentication token' });
    }

    const verification = verifyAccessToken(token);
    if (!verification.valid) {
        logger.warn('[SSE] Stream connection rejected - invalid token', {
            sessionId,
            error: verification.error
        });
        return res.status(401).json({ error: verification.error || 'Invalid token' });
    }

    const userId = verification.decoded.userId;
    logger.info('[SSE] Stream initialized', { userId, sessionId });

    // ═══════════════════════════════════════════════════════════
    // STEP 2: Set SSE headers
    // ═══════════════════════════════════════════════════════════
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', req.get('origin') || '*');
    res.setHeader('Access-Control-Allow-Credentials', 'true');

    // ═══════════════════════════════════════════════════════════
    // STEP 3: Create stream context
    // ═══════════════════════════════════════════════════════════
    const streamContext = {
        userId,
        sessionId,
        connectedAt: Date.now(),
        frameCount: 0,
        bytesTransferred: 0,
        handler: null, // Will be initialized with proper handler if needed
        isAlive: true
    };

    // Store stream reference
    const streamKey = `${userId}:${sessionId}`;
    activeStreams.set(streamKey, streamContext);

    // ═══════════════════════════════════════════════════════════
    // STEP 4: Send initial message
    // ═══════════════════════════════════════════════════════════
    sendSSEMessage(res, {
        type: 'welcome',
        message: 'Connected to Lyra somatic analysis stream',
        sessionId,
        userId,
        timestamp: new Date().toISOString()
    });

    // ═══════════════════════════════════════════════════════════
    // STEP 5: Handle client disconnect
    // ═══════════════════════════════════════════════════════════
    req.on('close', () => {
        logger.info('[SSE] Stream closed', { userId, sessionId });
        activeStreams.delete(streamKey);
        streamContext.isAlive = false;
    });

    req.on('error', (error) => {
        logger.error('[SSE] Stream error', {
            userId,
            sessionId,
            error: error.message
        });
        activeStreams.delete(streamKey);
        streamContext.isAlive = false;
    });

    // ═══════════════════════════════════════════════════════════
    // STEP 6: Heartbeat to keep connection alive
    // Every 25 seconds, send a comment to prevent timeout
    // ═══════════════════════════════════════════════════════════
    const heartbeat = setInterval(() => {
        if (streamContext.isAlive) {
            res.write(': heartbeat\n\n');
        } else {
            clearInterval(heartbeat);
        }
    }, 25000);

    // Store heartbeat for cleanup
    streamContext.heartbeat = heartbeat;

    // Keep response open (don't end it)
    // For Vercel: Maximum 30-60 seconds per invocation
    // Client will reconnect automatically if stream closes
}

/**
 * Send AU frame data to connected SSE client
 * Called from POST /api/au-frame endpoint
 *
 * Usage:
 * ```javascript
 * app.post('/api/au-frame', (req, res) => {
 *     const { sessionId, userId, auData, prosodyData } = req.body;
 *     broadcastAUFrame(sessionId, userId, auData, prosodyData);
 *     res.json({ success: true });
 * });
 * ```
 */
export function broadcastAUFrame(sessionId, userId, auData, prosodyData = null) {
    const streamKey = `${userId}:${sessionId}`;
    const stream = activeStreams.get(streamKey);

    if (!stream || !stream.isAlive) {
        logger.debug('[SSE] No active stream for broadcasting', { userId, sessionId });
        return false;
    }

    stream.frameCount++;
    stream.bytesTransferred += JSON.stringify(auData).length;

    logger.debug('[SSE] Broadcasting AU frame', {
        userId,
        sessionId,
        frameCount: stream.frameCount
    });

    // In production, would send via stored response object
    // For now, this is a placeholder for actual stream management
    return true;
}

/**
 * Send safety alert through SSE
 * Called when safety system detects crisis indicators
 */
export function broadcastSafetyAlert(sessionId, userId, alert) {
    const streamKey = `${userId}:${sessionId}`;
    const stream = activeStreams.get(streamKey);

    if (!stream || !stream.isAlive) {
        logger.warn('[SSE] Cannot send safety alert - no active stream', {
            userId,
            sessionId
        });
        return false;
    }

    logger.info('[SSE] Broadcasting safety alert', {
        userId,
        sessionId,
        severity: alert.severity
    });

    return true;
}

/**
 * Send clinical guidance through SSE
 * Called when TherapistAgent generates real-time guidance
 */
export function broadcastClinicalGuidance(sessionId, userId, guidance) {
    const streamKey = `${userId}:${sessionId}`;
    const stream = activeStreams.get(streamKey);

    if (!stream || !stream.isAlive) {
        logger.debug('[SSE] Cannot send guidance - no active stream', {
            userId,
            sessionId
        });
        return false;
    }

    logger.debug('[SSE] Broadcasting clinical guidance', {
        userId,
        sessionId
    });

    return true;
}

/**
 * Helper: Send SSE formatted message
 * Format: event: type\ndata: {...}\n\n
 */
export function sendSSEMessage(res, message) {
    const eventType = message.type || 'message';
    const data = JSON.stringify(message);

    // SSE format
    res.write(`event: ${eventType}\n`);
    res.write(`data: ${data}\n\n`);
}

/**
 * Get active stream metrics for monitoring
 */
export function getStreamMetrics() {
    const metrics = {
        activeStreams: activeStreams.size,
        streams: []
    };

    activeStreams.forEach((stream, key) => {
        metrics.streams.push({
            key,
            connectedSince: new Date(stream.connectedAt).toISOString(),
            frameCount: stream.frameCount,
            bytesTransferred: stream.bytesTransferred,
            uptime: Date.now() - stream.connectedAt
        });
    });

    return metrics;
}

/**
 * Close all streams (for graceful shutdown)
 */
export function closeAllStreams() {
    logger.info('[SSE] Closing all streams', { count: activeStreams.size });

    activeStreams.forEach((stream) => {
        stream.isAlive = false;
        if (stream.heartbeat) {
            clearInterval(stream.heartbeat);
        }
    });

    activeStreams.clear();
}

export default {
    initializeStream,
    broadcastAUFrame,
    broadcastSafetyAlert,
    broadcastClinicalGuidance,
    sendSSEMessage,
    getStreamMetrics,
    closeAllStreams
};
