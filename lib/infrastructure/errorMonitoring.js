/**
 * Sentry Error Monitoring Integration
 * Captures errors, performance metrics, and custom events
 */

import * as Sentry from '@sentry/node';
import * as SentryTracing from '@sentry/tracing';
import { config } from './config.js';
import { logger } from './logging/logger.js';

/**
 * Initialize Sentry for backend
 * Call this FIRST in server.js, before other imports
 */
export function initializeSentry() {
    if (!config.SENTRY_DSN) {
        logger.warn('[Sentry] Skipped — SENTRY_DSN not configured');
        return;
    }

    try {
        Sentry.init({
            dsn: config.SENTRY_DSN,
            environment: config.NODE_ENV,
            tracesSampleRate: config.IS_PROD ? 0.1 : 1.0,
            sampleRate: config.IS_PROD ? 0.8 : 1.0,

            // Performance monitoring
            integrations: [
                new SentryTracing.HttpClientIntegration(),
                new SentryTracing.OnUncaughtExceptionIntegration(),
                new SentryTracing.OnUnhandledRejectionIntegration(),
            ],

            // Context
            beforeSend(event) {
                // Filter out health check spam
                if (event.request?.url?.includes('/health')) {
                    return null;
                }

                // Don't send 4xx errors (client errors) in production
                if (config.IS_PROD && event.exception) {
                    const statusCode = event.contexts?.response?.status_code;
                    if (statusCode && statusCode >= 400 && statusCode < 500) {
                        return null;
                    }
                }

                return event;
            }
        });

        logger.info('[Sentry] Initialized', { environment: config.NODE_ENV });
    } catch (error) {
        logger.error('[Sentry] Initialization failed', { error: error.message });
    }
}

/**
 * Express error handler middleware for Sentry
 * Use AFTER all other middleware/routes
 */
export function sentryErrorMiddleware(err, req, res, next) {
    Sentry.captureException(err, {
        contexts: {
            request: {
                url: req.url,
                method: req.method,
                headers: req.headers,
                ip: req.ip,
            },
            user: {
                id: req.userId,
                email: req.userEmail,
            }
        },
        tags: {
            endpoint: req.path,
            method: req.method,
        },
        level: 'error'
    });

    logger.error('[API Error] Sent to Sentry', {
        message: err.message,
        path: req.path,
        method: req.method,
        userId: req.userId,
        sentryEventId: Sentry.lastEventId()
    });

    // Pass to Express error handler
    next(err);
}

/**
 * Capture performance metrics
 * Use in critical operations
 */
export function capturePerformance(operationName, callback) {
    const transaction = Sentry.startTransaction({
        name: operationName,
        op: 'task',
    });

    try {
        const result = callback();

        if (result instanceof Promise) {
            return result
                .then(value => {
                    transaction.finish();
                    return value;
                })
                .catch(error => {
                    transaction.setStatus('error');
                    Sentry.captureException(error);
                    transaction.finish();
                    throw error;
                });
        }

        transaction.finish();
        return result;
    } catch (error) {
        transaction.setStatus('error');
        Sentry.captureException(error);
        transaction.finish();
        throw error;
    }
}

/**
 * Capture custom events
 */
export function captureEvent(eventName, data = {}) {
    Sentry.captureMessage(eventName, 'info');
    Sentry.captureEvent({
        message: eventName,
        level: 'info',
        contexts: { custom: data },
        tags: { event_type: eventName }
    });
}

/**
 * Set user context for error tracking
 */
export function setUserContext(userId, email) {
    Sentry.setUser({
        id: userId,
        email: email,
        username: email?.split('@')[0]
    });
}

/**
 * Clear user context on logout
 */
export function clearUserContext() {
    Sentry.setUser(null);
}
