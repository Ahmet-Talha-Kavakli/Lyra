/**
 * Test Setup & Utilities
 * Shared test configuration for Vitest
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';

/**
 * Mock database
 */
export const mockDatabase = {
    users: [
        { id: 'user1', email: 'test@example.com', createdAt: new Date() }
    ],
    sessions: [
        { id: 'session1', userId: 'user1', status: 'active' }
    ],
    messages: [
        { id: 'msg1', sessionId: 'session1', role: 'user', content: 'Hello' }
    ],

    query: vi.fn().mockResolvedValue({ rows: [] }),
    queryOne: vi.fn().mockResolvedValue(null),
    queryAll: vi.fn().mockResolvedValue([]),
    transaction: vi.fn()
};

/**
 * Mock Redis
 */
export const mockRedis = {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue('OK'),
    setex: vi.fn().mockResolvedValue('OK'),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
    ttl: vi.fn().mockResolvedValue(-1),
    connect: vi.fn().mockResolvedValue(null),
    disconnect: vi.fn().mockResolvedValue(null)
};

/**
 * Mock OpenAI
 */
export const mockOpenAI = {
    chat: {
        completions: {
            create: vi.fn().mockResolvedValue({
                choices: [{ message: { content: 'Test response' } }],
                usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
            })
        }
    }
};

/**
 * Test user data
 */
export const testUser = {
    id: 'test-user-123',
    email: 'test@example.com',
    password: 'password123'
};

/**
 * Test session data
 */
export const testSession = {
    id: 'test-session-123',
    userId: testUser.id,
    startTime: new Date(),
    status: 'active',
    messages: []
};

/**
 * Helper: Create test message
 */
export function createTestMessage(content, role = 'user') {
    return {
        id: `msg-${Date.now()}`,
        sessionId: testSession.id,
        userId: testUser.id,
        role,
        content,
        createdAt: new Date()
    };
}

/**
 * Helper: Mock auth token
 */
export function createMockToken(userId = testUser.id) {
    // Simple JWT mock
    const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64');
    const payload = Buffer.from(JSON.stringify({ userId, iat: Math.floor(Date.now() / 1000) })).toString('base64');
    const signature = 'mock-signature';
    return `${header}.${payload}.${signature}`;
}

/**
 * Helper: Mock request context
 */
export function createMockRequest(overrides = {}) {
    return {
        userId: testUser.id,
        userEmail: testUser.email,
        path: '/api/test',
        method: 'POST',
        headers: { authorization: `Bearer ${createMockToken()}` },
        cookies: {},
        body: {},
        ...overrides
    };
}

/**
 * Helper: Mock response
 */
export function createMockResponse() {
    const response = {
        statusCode: 200,
        headers: {},
        body: null,
        status: vi.fn(function(code) { this.statusCode = code; return this; }),
        json: vi.fn(function(data) { this.body = data; return this; }),
        send: vi.fn(function(data) { this.body = data; return this; }),
        setHeader: vi.fn(function(key, val) { this.headers[key] = val; return this; }),
        cookie: vi.fn(function(name, val, opts) { this.cookies = this.cookies || {}; this.cookies[name] = val; return this; })
    };
    return response;
}
