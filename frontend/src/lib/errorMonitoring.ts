/**
 * Frontend Error Monitoring with Sentry
 */

import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

export function initializeSentry() {
    const sentryDsn = import.meta.env.VITE_SENTRY_DSN;

    if (!sentryDsn) {
        console.warn('[Sentry] Skipped — VITE_SENTRY_DSN not configured');
        return;
    }

    Sentry.init({
        dsn: sentryDsn,
        environment: import.meta.env.MODE,
        tracesSampleRate: import.meta.env.PROD ? 0.1 : 1.0,
        sampleRate: import.meta.env.PROD ? 0.8 : 1.0,

        // Performance monitoring
        integrations: [
            new BrowserTracing({
                // Set sampling for performance monitoring
                tracingOrigins: [
                    'localhost',
                    /^\//,
                    // Your API server
                    import.meta.env.VITE_API_URL || 'http://localhost:3000',
                ],
            }),
        ],

        // Hooks
        beforeSend(event) {
            // Don't send health check errors
            if (event.request?.url?.includes('/health')) {
                return null;
            }

            return event;
        },
    });
}

/**
 * Set user context for error tracking
 */
export function setUserContext(userId: string, email: string) {
    Sentry.setUser({
        id: userId,
        email: email,
        username: email.split('@')[0],
    });
}

/**
 * Clear user context on logout
 */
export function clearUserContext() {
    Sentry.setUser(null);
}

/**
 * Capture custom events
 */
export function captureEvent(eventName: string, data: Record<string, any> = {}) {
    Sentry.captureMessage(eventName, 'info');
}

/**
 * Capture errors
 */
export function captureError(error: Error, context: Record<string, any> = {}) {
    Sentry.captureException(error, {
        contexts: { custom: context },
    });
}
