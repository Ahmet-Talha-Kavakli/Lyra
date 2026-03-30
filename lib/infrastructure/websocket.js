/**
 * WebSocket Server Setup
 * Integrates WebSocket support into Express server
 *
 * Usage:
 * import { setupWebSocket } from './lib/infrastructure/websocket.js';
 * const wss = setupWebSocket(server);
 */

import WebSocket from 'ws';
import { logger } from './logger.js';
import { AUWebSocketHandler } from '../../src/infrastructure/websocket/AUWebSocketHandler.js';

/**
 * Setup WebSocket server
 */
export function setupWebSocket(server) {
    const wss = new WebSocket.Server({ noServer: true });

    // Handle upgrade request
    server.on('upgrade', (request, socket, head) => {
        const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

        if (pathname === '/somatic-analysis') {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        } else {
            socket.destroy();
        }
    });

    // Handle new connections
    wss.on('connection', (ws, req) => {
        logger.info('[WebSocket] New connection');

        // Create handler for this connection
        const handler = new AUWebSocketHandler(ws, req);

        // Handle incoming messages
        ws.on('message', (message) => {
            try {
                handler.handleMessage(message);
            } catch (error) {
                logger.error('[WebSocket] Message error:', { error: error.message });
            }
        });

        // Handle errors
        ws.on('error', (error) => {
            logger.error('[WebSocket] Connection error:', { error: error.message });
        });

        // Handle close
        ws.on('close', () => {
            handler.handleClose();
        });

        // Send initial message
        handler.sendMessage({
            type: 'welcome',
            message: 'Connected to Lyra somatic analysis backend'
        });
    });

    logger.info('[WebSocket] Server initialized on /somatic-analysis');
    return wss;
}

export default setupWebSocket;
