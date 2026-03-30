/**
 * Validation Schemas
 * Centralized Zod schemas for API request validation
 */

import { z } from 'zod';

/**
 * Chat completion request validation
 * Ensures messages array is properly formatted and safe
 */
export const chatCompletionSchema = z.object({
    messages: z.array(
        z.object({
            role: z.enum(['system', 'user', 'assistant', 'function']),
            content: z.string()
                .min(1, 'Mesaj boş olamaz')
                .max(10000, 'Mesaj çok uzun (max 10000 karakter)')
                .trim(),
            // Optional: function call info
            function_call: z.object({
                name: z.string(),
                arguments: z.string(),
            }).optional(),
        })
    )
        .min(1, 'En az 1 mesaj gereklidir')
        .max(100, 'Çok fazla mesaj'),

    model: z.string()
        .optional()
        .default('gpt-4o-mini'),

    call: z.object({
        metadata: z.object({
            userId: z.string().uuid().optional(),
        }).optional(),
        assistantOverrides: z.object({
            variableValues: z.object({
                userId: z.string().uuid().optional(),
            }).optional(),
        }).optional(),
    }).optional(),
});

/**
 * User login validation
 */
export const loginSchema = z.object({
    email: z.string()
        .email('Geçerli email adresi giriniz')
        .toLowerCase(),
    password: z.string()
        .min(6, 'Şifre en az 6 karakter olmalı')
        .max(128, 'Şifre çok uzun'),
});

/**
 * User registration validation
 */
export const registerSchema = z.object({
    email: z.string()
        .email('Geçerli email adresi giriniz')
        .toLowerCase(),
    password: z.string()
        .min(8, 'Şifre en az 8 karakter olmalı')
        .regex(/[A-Z]/, 'Şifre büyük harf içermeli')
        .regex(/[0-9]/, 'Şifre rakam içermeli'),
    name: z.string()
        .min(2, 'Ad en az 2 karakter olmalı')
        .max(50, 'Ad çok uzun')
        .trim(),
});

/**
 * Password reset request validation
 */
export const passwordResetSchema = z.object({
    email: z.string()
        .email('Geçerli email adresi giriniz')
        .toLowerCase(),
});

/**
 * Password reset confirmation validation
 */
export const passwordResetConfirmSchema = z.object({
    token: z.string()
        .min(20, 'Geçersiz token'),
    newPassword: z.string()
        .min(8, 'Yeni şifre en az 8 karakter olmalı')
        .regex(/[A-Z]/, 'Şifre büyük harf içermeli')
        .regex(/[0-9]/, 'Şifre rakam içermeli'),
});

/**
 * Session creation validation
 */
export const sessionCreateSchema = z.object({
    title: z.string()
        .min(3, 'Oturum başlığı en az 3 karakter olmalı')
        .max(200, 'Başlık çok uzun')
        .trim()
        .optional(),
    context: z.string()
        .max(5000, 'Bağlam çok uzun')
        .optional(),
});

/**
 * Session update validation
 */
export const sessionUpdateSchema = z.object({
    title: z.string()
        .min(3, 'Başlık en az 3 karakter olmalı')
        .max(200, 'Başlık çok uzun')
        .optional(),
    status: z.enum(['active', 'paused', 'completed'])
        .optional(),
});

/**
 * Profile update validation
 */
export const profileUpdateSchema = z.object({
    name: z.string()
        .min(2, 'Ad en az 2 karakter olmalı')
        .max(50, 'Ad çok uzun')
        .optional(),
    email: z.string()
        .email('Geçerli email adresi giriniz')
        .optional(),
    bio: z.string()
        .max(500, 'Bio çok uzun')
        .optional(),
    preferences: z.object({
        language: z.enum(['tr', 'en']).optional(),
        notifications: z.boolean().optional(),
        theme: z.enum(['light', 'dark']).optional(),
    }).optional(),
});

/**
 * Knowledge source validation
 */
export const knowledgeSourceSchema = z.object({
    title: z.string()
        .min(3, 'Başlık en az 3 karakter olmalı')
        .max(200, 'Başlık çok uzun'),
    url: z.string()
        .url('Geçerli URL giriniz')
        .optional(),
    content: z.string()
        .min(10, 'İçerik en az 10 karakter olmalı')
        .max(50000, 'İçerik çok uzun')
        .optional(),
    category: z.string()
        .max(50, 'Kategori çok uzun')
        .optional(),
});

/**
 * Somatic analysis session start validation
 */
export const somaticSessionStartSchema = z.object({
    sessionId: z.string()
        .min(1, 'Session ID gereklidir'),
    userId: z.string()
        .uuid('Geçerli user ID giriniz'),
});

/**
 * Generic validation helper
 * @param schema Zod schema
 * @param data Data to validate
 * @returns { success: boolean, data?: T, error?: string }
 */
export function validateData(schema, data) {
    try {
        const result = schema.parse(data);
        return { success: true, data: result };
    } catch (err) {
        if (err instanceof z.ZodError) {
            const errors = err.errors.map(e => ({
                path: e.path.join('.'),
                message: e.message,
            }));
            return {
                success: false,
                error: 'Validation failed',
                errors,
            };
        }
        return {
            success: false,
            error: 'Unknown validation error',
        };
    }
}

/**
 * Express middleware factory for automatic validation
 * Usage: router.post('/endpoint', validateRequest(chatCompletionSchema), handler)
 */
export function validateRequest(schema) {
    return (req, res, next) => {
        const result = validateData(schema, req.body);

        if (!result.success) {
            return res.status(400).json({
                error: result.error,
                details: result.errors,
            });
        }

        req.validated = result.data;
        next();
    };
}
