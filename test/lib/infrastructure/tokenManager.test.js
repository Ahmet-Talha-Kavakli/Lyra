/**
 * Token Manager Tests
 * Tests JWT token signing, verification, and revocation
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
    signAccessToken,
    signRefreshToken,
    verifyAccessToken,
    verifyRefreshToken,
    revokeToken,
    getBlacklistStats
} from '../../../lib/infrastructure/tokenManager.js';

describe('TokenManager', () => {
    const testUserId = '123e4567-e89b-12d3-a456-426614174000';
    const testEmail = 'test@example.com';

    afterEach(() => {
        // Clean up if needed
    });

    describe('signAccessToken', () => {
        it('should sign a valid access token', () => {
            const token = signAccessToken(testUserId, testEmail);
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
            expect(token.split('.')).toHaveLength(3); // JWT format: header.payload.signature
        });

        it('should create token with correct claims', () => {
            const token = signAccessToken(testUserId, testEmail);
            const verified = verifyAccessToken(token);

            expect(verified.valid).toBe(true);
            expect(verified.decoded.userId).toBe(testUserId);
            expect(verified.decoded.email).toBe(testEmail);
            expect(verified.decoded.type).toBe('access');
        });

        it('should accept empty userId (JWT lib allows it)', () => {
            // JWT library doesn't validate userId format, only signs it
            const token = signAccessToken('', testEmail);
            expect(token).toBeDefined();
        });
    });

    describe('verifyAccessToken', () => {
        let validToken;

        beforeEach(() => {
            validToken = signAccessToken(testUserId, testEmail);
        });

        it('should verify a valid token', () => {
            const result = verifyAccessToken(validToken);
            expect(result.valid).toBe(true);
            expect(result.decoded).toBeDefined();
        });

        it('should reject invalid signature', () => {
            const tampered = validToken.slice(0, -5) + 'xxxxx';
            const result = verifyAccessToken(tampered);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('Invalid token');
        });

        it('should reject malformed token', () => {
            const result = verifyAccessToken('not.a.token');
            expect(result.valid).toBe(false);
        });

        it('should reject empty token', () => {
            const result = verifyAccessToken('');
            expect(result.valid).toBe(false);
        });

        it('should reject refresh token when expecting access token', () => {
            const refreshToken = signRefreshToken(testUserId);
            const result = verifyAccessToken(refreshToken);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('type');
        });
    });

    describe('signRefreshToken', () => {
        it('should sign a valid refresh token', () => {
            const token = signRefreshToken(testUserId, 1);
            expect(token).toBeDefined();
            expect(typeof token).toBe('string');
        });

        it('should include version claim', () => {
            const token = signRefreshToken(testUserId, 2);
            const verified = verifyRefreshToken(token);

            expect(verified.valid).toBe(true);
            expect(verified.decoded.version).toBe(2);
        });
    });

    describe('verifyRefreshToken', () => {
        let validRefreshToken;

        beforeEach(() => {
            validRefreshToken = signRefreshToken(testUserId, 1);
        });

        it('should verify a valid refresh token', () => {
            const result = verifyRefreshToken(validRefreshToken);
            expect(result.valid).toBe(true);
        });

        it('should reject access token when expecting refresh token', () => {
            const accessToken = signAccessToken(testUserId, testEmail);
            const result = verifyRefreshToken(accessToken);

            expect(result.valid).toBe(false);
            expect(result.error).toContain('type');
        });
    });

    describe('revokeToken', () => {
        it('should revoke a valid token', () => {
            const token = signAccessToken(testUserId, testEmail);
            const result = revokeToken(token);

            expect(result).toBe(true);
        });

        it('should add token to blacklist', () => {
            const token = signAccessToken(testUserId, testEmail);

            revokeToken(token);

            // Just verify it's in blacklist by checking verification fails
            const verified = verifyAccessToken(token);
            expect(verified.valid).toBe(false);
            expect(verified.error).toContain('revoked');
        });

        it('should reject revoked token', () => {
            const token = signAccessToken(testUserId, testEmail);
            revokeToken(token);

            const result = verifyAccessToken(token);
            expect(result.valid).toBe(false);
            expect(result.error).toContain('revoked');
        });
    });

    describe('Token Expiry', () => {
        it('access token should expire in 15 minutes', () => {
            const token = signAccessToken(testUserId, testEmail);
            const decoded = require('jsonwebtoken').decode(token);

            const now = Math.floor(Date.now() / 1000);
            const expiryTime = decoded.exp - now;

            // Should be approximately 15 minutes (900 seconds)
            // Allow 10 second margin for test execution
            expect(expiryTime).toBeGreaterThan(890);
            expect(expiryTime).toBeLessThan(910);
        });

        it('refresh token should expire in 7 days', () => {
            const token = signRefreshToken(testUserId, 1);
            const decoded = require('jsonwebtoken').decode(token);

            const now = Math.floor(Date.now() / 1000);
            const expiryTime = decoded.exp - now;

            // Should be approximately 7 days (604800 seconds)
            // Allow 10 second margin for test execution
            const sevenDaysInSeconds = 7 * 24 * 60 * 60;
            expect(expiryTime).toBeGreaterThan(sevenDaysInSeconds - 10);
            expect(expiryTime).toBeLessThan(sevenDaysInSeconds + 10);
        });
    });
});
