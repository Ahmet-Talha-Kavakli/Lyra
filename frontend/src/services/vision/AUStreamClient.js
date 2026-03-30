/**
 * Action Units Stream Client (SSE replacement for WebSocket)
 *
 * Uses Server-Sent Events (EventSource API) for streaming from backend
 * Works in Vercel Serverless, browsers, and proxies
 *
 * Message format received:
 * event: au_frame
 * data: {
 *   type: 'au_frame',
 *   actionUnits: { AU12: 0.8, AU6: 0.6, ... },
 *   confidence: 0.95,
 *   symmetry: 0.92,
 *   smileAuthenticity: 'genuine',
 *   timestamp: '2026-03-30T...'
 * }
 *
 * Sending data (client → server):
 * POST /api/au-frame with AU frame data
 * POST /api/safety-alert with safety alerts
 */

export class AUStreamClient {
    constructor(options = {}) {
        this.apiUrl = options.apiUrl || 'http://localhost:3000';
        this.sessionId = options.sessionId || `session_${Date.now()}`;
        this.userId = options.userId;
        this.token = options.token; // JWT for authentication

        this.eventSource = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectDelay = 2000;
        this.backoffMultiplier = 1.5;
        this.currentEvent = null; // Track current SSE event type

        // Stats
        this.framesSent = 0;
        this.framesReceived = 0;
        this.bytesTransferred = 0;

        // Callbacks
        this.onConnected = null;
        this.onDisconnected = null;
        this.onError = null;
        this.onAUFrame = null;
        this.onSafetyAlert = null;
        this.onClinicalGuidance = null;
        this.onCalibrationStart = null;
        this.onCalibrationProgress = null;
        this.onCalibrationComplete = null;

        // Cleanup on page unload
        window.addEventListener('beforeunload', () => this.disconnect());
    }

    /**
     * Connect to Backend SSE Stream
     * Uses custom fetch-based streaming (EventSource doesn't support Authorization header)
     */
    connect() {
        return new Promise((resolve, reject) => {
            try {
                const streamUrl = `${this.apiUrl}/api/stream/${this.sessionId}`;
                console.log('[AUStream] Connecting to', streamUrl);

                // Use fetch for custom headers instead of EventSource
                // This gives us full control over authentication
                this.connectViaFetch(streamUrl)
                    .then(() => resolve())
                    .catch((error) => reject(error));

            } catch (error) {
                console.error('[AUStream] Connection failed:', error);
                reject(error);
            }
        });
    }

    /**
     * Connect using fetch streaming (supports custom headers)
     * Parses SSE format manually
     */
    async connectViaFetch(streamUrl) {
        try {
            const response = await fetch(streamUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.token}`,
                    'Accept': 'text/event-stream'
                },
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`Connection failed: HTTP ${response.status}`);
            }

            this.isConnected = true;
            this.reconnectAttempts = 0;

            // Send welcome callback
            if (this.onConnected) {
                this.onConnected({ sessionId: this.sessionId });
            }

            // Read stream using ReadableStream API
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (this.isConnected) {
                const { value, done } = await reader.read();

                if (done) {
                    console.log('[AUStream] Stream ended');
                    this.attemptReconnect();
                    break;
                }

                buffer += decoder.decode(value, { stream: true });

                // Parse SSE messages
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line in buffer

                for (const line of lines) {
                    this.parseSSELine(line);
                }
            }
        } catch (error) {
            console.error('[AUStream] Fetch streaming error:', error);
            this.isConnected = false;
            this.attemptReconnect();

            if (this.onError) {
                this.onError(error);
            }
        }
    }

    /**
     * Parse SSE formatted line
     * Format: "event: type\ndata: {...}\n\n"
     */
    parseSSELine(line) {
        if (line.startsWith(':')) {
            // Comment line (heartbeat)
            return;
        }

        if (line.startsWith('event: ')) {
            this.currentEvent = line.substring(7);
            return;
        }

        if (line.startsWith('data: ')) {
            const data = line.substring(6);

            try {
                const parsed = JSON.parse(data);

                switch (this.currentEvent) {
                    case 'welcome':
                        // Already handled in connect
                        break;

                    case 'au_frame':
                        this.framesReceived++;
                        this.bytesTransferred += data.length;
                        if (this.onAUFrame) {
                            this.onAUFrame(parsed);
                        }
                        break;

                    case 'safety_alert':
                        console.warn('[AUStream] Safety alert:', parsed.severity);
                        if (this.onSafetyAlert) {
                            this.onSafetyAlert(parsed);
                        }
                        break;

                    case 'clinical_guidance':
                        if (this.onClinicalGuidance) {
                            this.onClinicalGuidance(parsed);
                        }
                        break;

                    case 'calibration_start':
                        if (this.onCalibrationStart) {
                            this.onCalibrationStart(parsed);
                        }
                        break;

                    case 'calibration_progress':
                        if (this.onCalibrationProgress) {
                            this.onCalibrationProgress(parsed);
                        }
                        break;

                    case 'calibration_complete':
                        if (this.onCalibrationComplete) {
                            this.onCalibrationComplete(parsed);
                        }
                        break;

                    default:
                        console.log('[AUStream] Received event:', this.currentEvent);
                }
            } catch (error) {
                console.error('[AUStream] Failed to parse SSE data:', error, data);
            }

            this.currentEvent = null;
        }
    }

    /**
     * Send AU frame to backend
     * Uses HTTP POST (client → server) since SSE is one-way
     */
    async sendAUFrame(auData, prosodyData = null) {
        if (!this.isConnected) {
            console.warn('[AUStream] Not connected, queuing frame');
            return false;
        }

        try {
            const payload = {
                sessionId: this.sessionId,
                actionUnits: auData.actionUnits,
                confidence: auData.confidence,
                symmetry: auData.symmetry,
                smileAuthenticity: auData.smileAuthenticity,
                timestamp: auData.timestamp,
                prosodyData
            };

            const response = await fetch(`${this.apiUrl}/api/au-frame`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify(payload),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            this.framesSent++;
            this.bytesTransferred += JSON.stringify(payload).length;

            return true;
        } catch (error) {
            console.error('[AUStream] Failed to send frame:', error);
            return false;
        }
    }

    /**
     * Report safety alert to backend
     */
    async reportSafetyAlert(severity, type, indicators, confidence) {
        try {
            const response = await fetch(`${this.apiUrl}/api/safety-alert`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.token}`
                },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    severity,
                    type,
                    indicators,
                    confidence
                }),
                credentials: 'include'
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return true;
        } catch (error) {
            console.error('[AUStream] Failed to report safety alert:', error);
            return false;
        }
    }

    /**
     * Attempt to reconnect with exponential backoff
     */
    attemptReconnect() {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.error('[AUStream] Max reconnection attempts reached');
            if (this.onDisconnected) {
                this.onDisconnected();
            }
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * Math.pow(this.backoffMultiplier, this.reconnectAttempts - 1);

        console.log(`[AUStream] Reconnecting in ${Math.round(delay)}ms (attempt ${this.reconnectAttempts})`);

        setTimeout(() => {
            this.connect().catch((error) => {
                console.error('[AUStream] Reconnection failed:', error);
            });
        }, delay);
    }

    /**
     * Disconnect from stream
     */
    disconnect() {
        // Mark as disconnected so fetch loop will exit
        this.isConnected = false;

        console.log('[AUStream] Disconnected');

        if (this.onDisconnected) {
            this.onDisconnected();
        }
    }

    /**
     * Get stream statistics
     */
    getStats() {
        return {
            isConnected: this.isConnected,
            framesSent: this.framesSent,
            framesReceived: this.framesReceived,
            bytesTransferred: this.bytesTransferred,
            reconnectAttempts: this.reconnectAttempts,
            sessionId: this.sessionId
        };
    }
}

export default AUStreamClient;
