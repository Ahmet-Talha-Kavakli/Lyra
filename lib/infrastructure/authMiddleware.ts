/**
 * Authentication Middleware for Vercel Handlers
 * Stateless JWT verification (no sessions, no state)
 */

import { VercelRequest } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { logger } from './logger';

/**
 * Verify JWT from Authorization header
 * Returns { success: true, userId } or { success: false, error }
 */
export async function verifyAuth(req: VercelRequest): Promise<{
  success: boolean;
  userId?: string;
  error?: string;
}> {
  try {
    // Extract token from Cookie OR Authorization header
    let token = '';

    // 1. Try to get securely from HttpOnly Cookie
    if (req.headers.cookie) {
      const cookies = req.headers.cookie.split(';');
      const lyraTokenCookie = cookies.find(c => c.trim().startsWith('lyra_access_token='));
      if (lyraTokenCookie) {
        token = lyraTokenCookie.split('=')[1];
      }
    }

    // 2. Fallback to Authorization header
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.slice(7);
    }

    if (!token) {
      return { success: false, error: 'Missing authorization' };
    }

    // Create Supabase client for verification
    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || ''
    );

    // Verify token with Supabase
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      logger.warn('Token verification failed', { error: error?.message });
      return { success: false, error: 'Invalid token' };
    }

    return { success: true, userId: data.user.id };

  } catch (error: any) {
    logger.error('Auth middleware error', { error: error.message });
    return { success: false, error: 'Auth verification failed' };
  }
}

/**
 * Optional auth - returns userId if authenticated, null otherwise
 */
export async function verifyAuthOptional(req: VercelRequest): Promise<string | null> {
  const result = await verifyAuth(req);
  return result.success ? result.userId : null;
}

/**
 * Verify admin access (check against ADMIN_SECRET)
 */
export function verifyAdmin(req: VercelRequest): boolean {
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) {
    logger.error('ADMIN_SECRET not configured');
    return false;
  }

  const token = req.headers.authorization?.slice(7);
  return token === adminSecret;
}

/**
 * Verify Cron Secret (for Vercel Cron jobs)
 * Strictly verifies the Bearer token matches the CRON_SECRET env variable
 */
export function verifyCronSecret(req: VercelRequest | Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  
  if (!cronSecret) {
    logger.error('CRON_SECRET is not configured in Vercel. Cron jobs are vulnerable!');
    return false;
  }

  // Support for both Vercel Node (req.headers) and Edge Runtime (req.headers.get)
  const authHeader = typeof (req as Request).headers?.get === 'function' 
      ? (req as Request).headers.get('authorization') 
      : (req as VercelRequest).headers?.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }

  const token = authHeader.split(' ')[1];
  return token === cronSecret;
}
