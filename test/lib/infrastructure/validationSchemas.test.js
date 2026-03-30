/**
 * Validation Schemas Tests
 * Tests Zod validation schemas for API requests
 */

import { describe, it, expect } from 'vitest';
import {
    chatCompletionSchema,
    loginSchema,
    registerSchema,
    validateData,
} from '../../../lib/infrastructure/validationSchemas.js';

describe('Validation Schemas', () => {
    describe('chatCompletionSchema', () => {
        it('should accept valid chat completion request', () => {
            const valid = {
                messages: [
                    { role: 'user', content: 'Merhaba' }
                ],
                model: 'gpt-4o-mini'
            };

            const result = chatCompletionSchema.parse(valid);
            expect(result).toBeDefined();
            expect(result.messages).toHaveLength(1);
        });

        it('should reject empty messages array', () => {
            const invalid = {
                messages: []
            };

            expect(() => {
                chatCompletionSchema.parse(invalid);
            }).toThrow();
        });

        it('should reject missing messages', () => {
            const invalid = {
                model: 'gpt-4o-mini'
            };

            expect(() => {
                chatCompletionSchema.parse(invalid);
            }).toThrow();
        });

        it('should validate message role', () => {
            const invalid = {
                messages: [
                    { role: 'invalid', content: 'text' }
                ]
            };

            expect(() => {
                chatCompletionSchema.parse(invalid);
            }).toThrow();
        });

        it('should reject empty message content', () => {
            const invalid = {
                messages: [
                    { role: 'user', content: '' }
                ]
            };

            expect(() => {
                chatCompletionSchema.parse(invalid);
            }).toThrow();
        });

        it('should enforce max message length', () => {
            const invalid = {
                messages: [
                    { role: 'user', content: 'x'.repeat(10001) }
                ]
            };

            expect(() => {
                chatCompletionSchema.parse(invalid);
            }).toThrow();
        });

        it('should limit to 100 messages', () => {
            const invalid = {
                messages: Array(101).fill({ role: 'user', content: 'test' })
            };

            expect(() => {
                chatCompletionSchema.parse(invalid);
            }).toThrow();
        });

        it('should set default model if not provided', () => {
            const data = {
                messages: [{ role: 'user', content: 'test' }]
            };

            const result = chatCompletionSchema.parse(data);
            expect(result.model).toBe('gpt-4o-mini');
        });

        it('should trim whitespace from message content', () => {
            const data = {
                messages: [{ role: 'user', content: '  hello  ' }]
            };

            const result = chatCompletionSchema.parse(data);
            expect(result.messages[0].content).toBe('hello');
        });
    });

    describe('loginSchema', () => {
        it('should accept valid login credentials', () => {
            const valid = {
                email: 'test@example.com',
                password: 'Password123'
            };

            const result = loginSchema.parse(valid);
            expect(result.email).toBe('test@example.com');
        });

        it('should lowercase email', () => {
            const data = {
                email: 'Test@EXAMPLE.COM',
                password: 'Password123'
            };

            const result = loginSchema.parse(data);
            expect(result.email).toBe('test@example.com');
        });

        it('should reject invalid email format', () => {
            const invalid = {
                email: 'not-an-email',
                password: 'Password123'
            };

            expect(() => {
                loginSchema.parse(invalid);
            }).toThrow();
        });

        it('should enforce minimum password length', () => {
            const invalid = {
                email: 'test@example.com',
                password: '12345'
            };

            expect(() => {
                loginSchema.parse(invalid);
            }).toThrow();
        });

        it('should enforce maximum password length', () => {
            const invalid = {
                email: 'test@example.com',
                password: 'x'.repeat(129)
            };

            expect(() => {
                loginSchema.parse(invalid);
            }).toThrow();
        });
    });

    describe('registerSchema', () => {
        it('should accept valid registration data', () => {
            const valid = {
                email: 'newuser@example.com',
                password: 'SecurePass123',
                name: 'John Doe'
            };

            const result = registerSchema.parse(valid);
            expect(result).toBeDefined();
        });

        it('should require uppercase letter in password', () => {
            const invalid = {
                email: 'test@example.com',
                password: 'lowercase123',
                name: 'Test User'
            };

            expect(() => {
                registerSchema.parse(invalid);
            }).toThrow();
        });

        it('should require number in password', () => {
            const invalid = {
                email: 'test@example.com',
                password: 'NoNumbers',
                name: 'Test User'
            };

            expect(() => {
                registerSchema.parse(invalid);
            }).toThrow();
        });

        it('should enforce minimum password length (8 chars)', () => {
            const invalid = {
                email: 'test@example.com',
                password: 'Abc123',
                name: 'Test User'
            };

            expect(() => {
                registerSchema.parse(invalid);
            }).toThrow();
        });

        it('should enforce name minimum length', () => {
            const invalid = {
                email: 'test@example.com',
                password: 'SecurePass123',
                name: 'J'
            };

            expect(() => {
                registerSchema.parse(invalid);
            }).toThrow();
        });

        it('should trim name whitespace', () => {
            const data = {
                email: 'test@example.com',
                password: 'SecurePass123',
                name: '  John Doe  '
            };

            const result = registerSchema.parse(data);
            expect(result.name).toBe('John Doe');
        });
    });

    describe('validateData helper', () => {
        it('should return success with valid data', () => {
            const data = {
                email: 'test@example.com',
                password: 'Password123'
            };

            const result = validateData(loginSchema, data);
            expect(result.success).toBe(true);
            expect(result.data).toBeDefined();
        });

        it('should return error details with invalid data', () => {
            const data = {
                email: 'invalid',
                password: 'short'
            };

            const result = validateData(loginSchema, data);
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
            expect(result.errors).toBeDefined();
            expect(Array.isArray(result.errors)).toBe(true);
        });

        it('should include field path in error', () => {
            const data = {
                email: 'invalid-email',
                password: 'short'
            };

            const result = validateData(loginSchema, data);
            expect(result.success).toBe(false);
            expect(result.errors.some(e => e.path.includes('email'))).toBe(true);
        });
    });
});
