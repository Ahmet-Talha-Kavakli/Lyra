/**
 * Auth Middleware Tests
 * Tests JWT extraction and authentication flows
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { authMiddleware, optionalAuthMiddleware } from '../../middleware/auth.js';
import { signAccessToken } from '../../lib/infrastructure/tokenManager.js';

describe('Auth Middleware', () => {
    const testUserId = '123e4567-e89b-12d3-a456-426614174000';
    const testEmail = 'test@example.com';
    let validToken;

    beforeEach(() => {
        validToken = signAccessToken(testUserId, testEmail);
    });

    describe('authMiddleware', () => {
        it('should extract token from Authorization header', () => {
            const req = {
                cookies: {},
                headers: {
                    authorization: `Bearer ${validToken}`
                },
                path: '/test'
            };
            const res = {
                status: () => ({
                    json: () => {}
                })
            };
            let nextCalled = false;

            const next = () => {
                nextCalled = true;
            };

            authMiddleware(req, res, next);

            expect(nextCalled).toBe(true);
            expect(req.userId).toBe(testUserId);
            expect(req.userEmail).toBe(testEmail);
        });

        it('should extract token from httpOnly cookie', () => {
            const req = {
                cookies: {
                    lyra_token: validToken
                },
                headers: {},
                path: '/test'
            };
            const res = {
                status: () => ({
                    json: () => {}
                })
            };
            let nextCalled = false;

            const next = () => {
                nextCalled = true;
            };

            authMiddleware(req, res, next);

            expect(nextCalled).toBe(true);
            expect(req.userId).toBe(testUserId);
        });

        it('should prefer cookie over Authorization header', () => {
            const otherToken = signAccessToken('other-user-id', 'other@example.com');
            const req = {
                cookies: {
                    lyra_token: validToken // Should use this
                },
                headers: {
                    authorization: `Bearer ${otherToken}` // Should not use this
                },
                path: '/test'
            };
            const res = {
                status: () => ({
                    json: () => {}
                })
            };
            let nextCalled = false;

            const next = () => {
                nextCalled = true;
            };

            authMiddleware(req, res, next);

            expect(nextCalled).toBe(true);
            expect(req.userId).toBe(testUserId); // From cookie, not header
        });

        it('should reject missing token', () => {
            const req = {
                cookies: {},
                headers: {},
                path: '/test'
            };
            let statusCode = null;
            const res = {
                status: (code) => {
                    statusCode = code;
                    return {
                        json: () => {}
                    };
                }
            };
            let nextCalled = false;

            const next = () => {
                nextCalled = true;
            };

            authMiddleware(req, res, next);

            expect(statusCode).toBe(401);
            expect(nextCalled).toBe(false);
        });

        it('should reject invalid token', () => {
            const req = {
                cookies: {},
                headers: {
                    authorization: 'Bearer invalid.token.here'
                },
                path: '/test'
            };
            let statusCode = null;
            const res = {
                status: (code) => {
                    statusCode = code;
                    return {
                        json: () => {}
                    };
                }
            };
            let nextCalled = false;

            const next = () => {
                nextCalled = true;
            };

            authMiddleware(req, res, next);

            expect(statusCode).toBe(401);
            expect(nextCalled).toBe(false);
        });

        it('should allow refresh endpoint with expired token', () => {
            const req = {
                cookies: {},
                headers: {
                    authorization: `Bearer ${validToken}`
                },
                path: '/v1/auth/refresh'
            };
            const res = {
                status: () => ({
                    json: () => {}
                })
            };
            let nextCalled = false;

            const next = () => {
                nextCalled = true;
            };

            authMiddleware(req, res, next);

            expect(nextCalled).toBe(true);
        });
    });

    describe('optionalAuthMiddleware', () => {
        it('should authenticate with valid token', () => {
            const req = {
                cookies: {
                    lyra_token: validToken
                },
                headers: {},
                path: '/test'
            };
            const res = {
                status: () => ({
                    json: () => {}
                })
            };
            let nextCalled = false;

            const next = () => {
                nextCalled = true;
            };

            optionalAuthMiddleware(req, res, next);

            expect(nextCalled).toBe(true);
            expect(req.userId).toBe(testUserId);
        });

        it('should continue without token', () => {
            const req = {
                cookies: {},
                headers: {},
                path: '/test'
            };
            const res = {
                status: () => ({
                    json: () => {}
                })
            };
            let nextCalled = false;

            const next = () => {
                nextCalled = true;
            };

            optionalAuthMiddleware(req, res, next);

            expect(nextCalled).toBe(true);
            expect(req.userId).toBeUndefined();
        });

        it('should reject invalid token even when optional', () => {
            const req = {
                cookies: {},
                headers: {
                    authorization: 'Bearer invalid.token.here'
                },
                path: '/test'
            };
            let statusCode = null;
            const res = {
                status: (code) => {
                    statusCode = code;
                    return {
                        json: () => {}
                    };
                }
            };
            let nextCalled = false;

            const next = () => {
                nextCalled = true;
            };

            optionalAuthMiddleware(req, res, next);

            expect(statusCode).toBe(401);
            expect(nextCalled).toBe(false);
        });
    });
});
