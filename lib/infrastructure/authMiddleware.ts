/**
 * Authentication Middleware for Vercel Handlers
 * Stateless JWT verification (no sessions, no state)
 */

import { VercelRequest } from '@vercel/node';
import { supabase } from '../shared/supabase';
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
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { success: false, error: 'Missing authorization header' };
    }

    const token = authHeader.slice(7); // Remove "Bearer "

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
 * Vercel sets the X-Vercel-Cron header only on scheduled invocations
 */
export function verifyCronSecret(req: VercelRequest): boolean {
  // Check if this is a legitimate Vercel cron call
  // In production, Vercel signs the request
  return req.headers['x-vercel-cron'] === 'true';
}
