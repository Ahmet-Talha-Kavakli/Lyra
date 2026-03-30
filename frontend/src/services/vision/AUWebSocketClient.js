/**
 * Action Units WebSocket Client
 *
 * Streams FACS AU data from Frontend → Backend
 * ONLY sends lightweight AU JSON, not video
 *
 * Message format:
 * {
 *   type: 'au_frame',
 *   sessionId: 'sess_123',
 *   actionUnits: { AU12: 4, AU6: 3, AU4: 1, ... },
 *   confidence: 0.95,
 *   symmetry: 0.92,
 *   smileAuthenticity: 'genuine',
 *   timestamp: '2026-03-30T...'
 * }
 */

export class AUWebSocketClient {
    constructor(options = {}) {
        this.baseUrl = options.baseUrl || 'ws://localhost:3001';
        this.sessionId = options.sessionId || `session_${Date.now()}`;
        this.userId = options.userId;

        this.ws = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;

        // Stats
        this.framesSent = 0;
        this.bytesTransferred = 0;

        // Callbacks
        this.onConnected = null;
        this.onDisconnected = null;
        this.onError = null;
        this.onClinicalGuidance = null;
        this.onCalibrationStart = null;
        this.onCalibrationProgress = null;
        this.onCalibrationComplete = null;
    }

    /**
     * Connect to Backend WebSocket
     */
    connect() {
        return new Promise((resolve, reject) => {
            try {
                const wsUrl = `${this.baseUrl}/somatic-analysis`;
                console.log('[AUWebSocket] Connecting to', wsUrl);

                this.ws = new WebSocket(wsUrl);

                this.ws.onopen = () => {
                    console.log('[AUWebSocket] Connected');
                    this.isConnected = true;
                    this.reconnectAttempts = 0;

                    // Send init message
                    this.sendMessage({
                        type: 'init',
                        sessionId: this.sessionId,
                        userId: this.userId,
                    });

                    if (this.onConnected) this.onConnected();
                    resolve();
                };

                this.ws.onmessage = (event) => {
                    this.handleMessage(event.data);
                };

                this.ws.onerror = (error) => {
                    console.error('[AUWebSocket] Error:', error);
                    if (this.onError) this.onError(error);
                    reject(error);
                };

                this.ws.onclose = () => {
                    console.log('[AUWebSocket] Disconnected');
                    this.isConnected = false;
                    if (this.onDisconnected) this.onDisconnected();
                    this.attemptReconnect();
                };
            } catch (error) {
                console.error('[AUWebSocket] Connection failed:', error);
                reject(error);
            }
        });
    }

    /**
     * Send AU frame to backend
     */
    sendAUFrame(auData) {
        if (!this.isConnected) {
            console.warn('[AUWebSocket] Not connected, dropping frame');
            return;
        }

        try {
            const message = {
                type: 'au_frame',
                sessionId: this.sessionId,
                userId: this.userId,
                actionUnits: auData.actionUnits,
                confidence: auData.confidence,
                symmetry: auData.actionUnits?.symmetry_score,
                smileAuthenticity: auData.actionUnits?.smile_authenticity,
                timestamp: new Date().toISOString(),
            };

            this.sendMessage(message);

            // Stats
            this.framesSent++;
            this.bytesTransferred += JSON.stringify(message).length;
        } catch (error) {
            console.error('[AUWebSocket] Send failed:', error);
        }
    }

    /**
     * Send message via WebSocket
     */
    sendMessage(message) {
        if (!this.isConnected) {
            console.warn('[AUWebSocket] Not connected');
            return;
        }

        try {
            this.ws.send(JSON.stringify(message));
        } catch (error) {
            console.error('[AUWebSocket] Message send error:', error);
        }
    }

    /**
     * Handle incoming messages from backend
     */
    handleMessage(data) {
        try {
            const message = JSON.parse(data);

            switch (message.type) {
                case 'init_ack':
                    // Backend acknowledged initialization
                    console.log('[AUWebSocket] Init acknowledged, calibration starting');
                    if (this.onCalibrationStart) {
                        this.onCalibrationStart(message);
                    }
                    break;

                case 'calibration_progress':
                    // Backend sending calibration progress
                    console.log('[AUWebSocket] Calibration progress:', message.progress);
                    if (this.onCalibrationProgress) {
                        this.onCalibrationProgress(message);
                    }
                    break;

                case 'therapist_guidance':
                    // Backend sent clinical guidance back
                    console.log('[AUWebSocket] Received guidance:', message.guidance);
                    if (this.onClinicalGuidance) {
                        this.onClinicalGuidance(message);
                    }
                    break;

                case 'analysis_result':
                    // Backend sent analysis result
                    console.log('[AUWebSocket] Analysis result:', message.result);
                    break;

                case 'pong':
                    // Ping-pong keep-alive
                    break;

                default:
                    console.log('[AUWebSocket] Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('[AUWebSocket] Message parse error:', error);
        }
    }

    /**
     * Attempt to reconnect if disconnected
     */
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[AUWebSocket] Max reconnect attempts reached');
            return;
        }

        this.reconnectAttempts++;
        console.log(`[AUWebSocket] Reconnecting (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);

        setTimeout(() => {
            this.connect().catch(err => {
                console.error('[AUWebSocket] Reconnect failed:', err);
            });
        }, this.reconnectDelay * this.reconnectAttempts);
    }

    /**
     * Send ping to keep connection alive
     */
    sendPing() {
        this.sendMessage({ type: 'ping' });
    }

    /**
     * Disconnect gracefully
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }

    /**
     * Get connection stats
     */
    getStats() {
        return {
            isConnected: this.isConnected,
            sessionId: this.sessionId,
            framesSent: this.framesSent,
            bytesTransferred: this.bytesTransferred,
            kbpsEstimate: this.framesSent > 0 ? (this.bytesTransferred / this.framesSent / 1024).toFixed(2) : 0
        };
    }
}

export default AUWebSocketClient;
