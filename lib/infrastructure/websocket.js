/**
 * WebSocket Server Setup
 * Integrates WebSocket support into Express server
 *
 * Usage:
 * import { setupWebSocket } from './lib/infrastructure/websocket.js';
 * const wss = setupWebSocket(server);
 */

import { WebSocketServer } from 'ws';
import url from 'url';
import { logger } from './logger.js';
import { verifyAccessToken } from './tokenManager.js';
import { AUWebSocketHandler } from '../../src/infrastructure/websocket/AUWebSocketHandler.js';

/**
 * ENTERPRISE SECURITY: Token authentication for WebSocket upgrade
 * Validates JWT token from Cookie or URL parameter before handshake
 * Returns: { valid: boolean, userId?: string, error?: string }
 */
function authenticateWebSocketUpgrade(request) {
    try {
        // SECURITY: Token ONLY from Authorization header (no URL params)
        // URL params get logged by proxies, CDNs, browser history
        let token = null;

        // 1. Check Authorization header (HTTPS/WSS secure)
        const authHeader = request.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }

        // 2. Check httpOnly cookie (fallback, also secure)
        if (!token) {
            const cookieHeader = request.headers.cookie;
            if (cookieHeader) {
                const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
                    const [name, value] = cookie.trim().split('=');
                    acc[name] = decodeURIComponent(value);
                    return acc;
                }, {});
                token = cookies.lyra_token;
            }
        }

        if (!token) {
            logger.warn('[WebSocket Auth] No token in headers or cookies');
            return { valid: false, error: 'No authentication token provided' };
        }

        // 3. Verify token
        const verification = verifyAccessToken(token);
        if (!verification.valid) {
            logger.warn('[WebSocket Auth] Invalid token', { error: verification.error });
            return { valid: false, error: verification.error || 'Invalid token' };
        }

        logger.info('[WebSocket Auth] User authenticated', {
            userId: verification.decoded.userId
        });

        return {
            valid: true,
            userId: verification.decoded.userId,
            email: verification.decoded.email
        };
    } catch (error) {
        logger.error('[WebSocket Auth] Authentication error:', { error: error.message });
        return { valid: false, error: 'Authentication failed' };
    }
}

/**
 * Setup WebSocket server with security hardening
 * - Enforces authentication on upgrade
 * - Implements heartbeat (ping/pong) to detect dead connections
 * - Validates message payload sizes
 */
export function setupWebSocket(server) {
    const wss = new WebSocketServer({ noServer: true });

    // Track active connections for heartbeat
    const heartbeatInterval = setInterval(() => {
        wss.clients.forEach((ws) => {
            // If client didn't respond to last ping, mark for termination
            if (ws.isAlive === false) {
                logger.warn('[WebSocket] Terminating inactive connection', { userId: ws.userId });
                return ws.terminate();
            }
            // Mark as pending pong response
            ws.isAlive = false;
            ws.ping();
        });
    }, 30000); // Ping every 30 seconds

    // Cleanup on server close
    server.on('close', () => {
        clearInterval(heartbeatInterval);
    });

    // Handle upgrade request with AUTHENTICATION
    server.on('upgrade', (request, socket, head) => {
        const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

        if (pathname === '/somatic-analysis') {
            // ═══════════════════════════════════════════════════════════
            // ENTERPRISE SECURITY: Validate token before upgrade
            // ═══════════════════════════════════════════════════════════
            const auth = authenticateWebSocketUpgrade(request);
            if (!auth.valid) {
                logger.warn('[WebSocket] Upgrade rejected - auth failed:', { error: auth.error });
                // Send HTTP 401 Unauthorized before socket close
                socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
                socket.destroy();
                return;
            }

            // Authentication passed — proceed with upgrade
            wss.handleUpgrade(request, socket, head, (ws) => {
                // Attach authenticated user data to socket
                ws.userId = auth.userId;
                ws.userEmail = auth.email;
                ws.isAlive = true;

                // Handle pong response (heartbeat)
                ws.on('pong', () => {
                    ws.isAlive = true;
                });

                wss.emit('connection', ws, request);
            });
        } else {
            // Path not recognized — destroy socket
            logger.warn('[WebSocket] Upgrade rejected - invalid path:', { path: pathname });
            socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
            socket.destroy();
        }
    });

    // Handle new connections
    wss.on('connection', (ws, req) => {
        logger.info('[WebSocket] New authenticated connection', {
            userId: ws.userId,
            email: ws.userEmail
        });

        // Create handler for this connection
        const handler = new AUWebSocketHandler(ws, req);

        // Handle incoming messages with PAYLOAD SIZE VALIDATION
        ws.on('message', (message) => {
            try {
                // SECURITY: Reject oversized payloads before parsing
                // AU data is small (typically 100-500 bytes)
                // Limit to 5KB to prevent memory exhaustion DoS
                if (message.length > 5000) {
                    logger.warn('[WebSocket] Message rejected - exceeds size limit', {
                        userId: ws.userId,
                        size: message.length
                    });
                    // Close with code 1009 (MANDATORY_EXTENSION) to indicate policy violation
                    ws.close(1009, 'Payload too large');
                    return;
                }

                handler.handleMessage(message);
            } catch (error) {
                logger.error('[WebSocket] Message error:', {
                    userId: ws.userId,
                    error: error.message
                });
            }
        });

        // Handle errors
        ws.on('error', (error) => {
            logger.error('[WebSocket] Connection error:', {
                userId: ws.userId,
                error: error.message
            });
        });

        // Handle close
        ws.on('close', () => {
            handler.handleClose();
            logger.info('[WebSocket] Connection closed', { userId: ws.userId });
        });

        // Send initial message
        handler.sendMessage({
            type: 'welcome',
            message: 'Connected to Lyra somatic analysis backend',
            userId: ws.userId
        });
    });

    logger.info('[WebSocket] Server initialized on /somatic-analysis with authentication');
    return wss;
}

export default setupWebSocket;
