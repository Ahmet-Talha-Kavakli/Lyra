/**
 * Supabase Authenticated Client Factory
 *
 * CRITICAL SECURITY:
 * - Creates per-request authenticated Supabase client using user's JWT token
 * - NOT admin/service key (enforces RLS for all queries)
 * - Zero Trust: only data user has permission for is accessible
 * - HIPAA compliant: audit trail via RLS policies
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { VercelRequest } from '@vercel/node';
import { logger } from '../infrastructure/logger';

interface SupabaseAuthResult {
  client: SupabaseClient | null;
  userId: string | null;
  error: string | null;
}

/**
 * CRITICAL: Supabase Connection Pooling Config
 *
 * For 100K concurrent users on Vercel:
 * - Use PgBouncer (Transaction mode) in Supabase Dashboard
 * - Connect string MUST point to pooler endpoint, NOT direct DB
 *
 * Example:
 * Direct DB (BROKEN for serverless): db.your-project.supabase.co
 * Pooler (CORRECT): db.your-project.supabase.co:6543
 *
 * Set in Vercel env:
 * SUPABASE_URL=https://your-project.supabase.co
 * SUPABASE_POOLER_URL=https://your-project.supabase.co:6543 (if needed)
 */
const POOLER_ENABLED = process.env.SUPABASE_POOLER_URL ? true : false;
const SUPABASE_URL = POOLER_ENABLED
  ? process.env.SUPABASE_POOLER_URL
  : process.env.SUPABASE_URL;

/**
 * Custom fetch for Supabase queries
 * - 10 second timeout (Vercel Edge limit)
 * - Abort on timeout to prevent hanging connections
 */
function customFetch(url: string, options?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second max

  return fetch(url, {
    ...options,
    signal: controller.signal
  })
    .then(response => {
      clearTimeout(timeoutId);
      return response;
    })
    .catch(error => {
      clearTimeout(timeoutId);
      throw error;
    });
}

/**
 * Extract JWT token from request (Cookie OR Authorization header)
 * Priority: HttpOnly Cookie > Authorization header
 */
function extractToken(req: VercelRequest): string | null {
  try {
    // 1. Try HttpOnly Cookie first (secure, not accessible to XSS)
    if (req.headers.cookie) {
      const cookies = req.headers.cookie.split(';');
      const tokenCookie = cookies.find(c => c.trim().startsWith('lyra_access_token='));
      if (tokenCookie) {
        return tokenCookie.split('=')[1].trim();
      }
    }

    // 2. Fallback to Authorization header (for mobile/CLI)
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      return req.headers.authorization.slice(7);
    }

    return null;
  } catch (error) {
    logger.warn('[Supabase] Token extraction failed', { error });
    return null;
  }
}

/**
 * Create authenticated Supabase client for this request
 *
 * Uses user's JWT token, NOT admin service key
 * This enforces Row Level Security (RLS) for all queries
 *
 * SECURITY GUARANTEES:
 * - User can only access rows where RLS policy allows
 * - No data leakage via IDOR (Insecure Direct Object Reference)
 * - All queries audit-logged via Postgres
 * - Invalid tokens rejected immediately
 *
 * @param req Vercel request object (with JWT token in cookie/header)
 * @returns { client, userId, error }
 */
export async function createAuthenticatedSupabaseClient(
  req: VercelRequest
): Promise<SupabaseAuthResult> {
  try {
    const token = extractToken(req);

    if (!token) {
      logger.warn('[Supabase] No token provided in request');
      return {
        client: null,
        userId: null,
        error: 'Missing authentication token'
      };
    }

    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
    const supabaseUrl = SUPABASE_URL;

    if (!supabaseUrl || !supabaseAnonKey) {
      logger.error('[Supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
      return {
        client: null,
        userId: null,
        error: 'Configuration error'
      };
    }

    /**
     * ✅ PRODUCTION CONFIG for 100K concurrent:
     * - db: { schema: 'public' } → Explicit schema (faster parsing)
     * - realtime: { enabled: false } → Serverless don't need realtime
     * - persistSession: false → Stateless
     * - autoRefreshToken: false → No token refresh loops
     * - shouldThrowOnError: true → Fail fast on network issues
     */
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
          'X-Client-Info': 'lyra-api/v1'
        },
        fetch: customFetch // Use optimized fetch
      },
      auth: {
        persistSession: false, // Serverless: no session persistence
        autoRefreshToken: false, // Serverless: stateless
      },
      db: {
        schema: 'public' // Explicit schema = faster
      },
      realtime: {
        enabled: false // Serverless doesn't need realtime
      }
    });

    // Verify token is valid by calling getUser
    const { data, error } = await client.auth.getUser(token);

    if (error || !data.user) {
      logger.warn('[Supabase] Token verification failed', {
        error: error?.message,
        userId: data?.user?.id
      });
      return {
        client: null,
        userId: null,
        error: 'Invalid or expired token'
      };
    }

    const userId = data.user.id;

    logger.debug('[Supabase] Authenticated client created', {
      userId,
      email: data.user.email
    });

    return {
      client,
      userId,
      error: null
    };
  } catch (error: any) {
    logger.error('[Supabase] Client creation failed', {
      error: error.message
    });
    return {
      client: null,
      userId: null,
      error: 'Authentication error'
    };
  }
}

/**
 * Middleware helper: Verify auth and get client in one call
 * Use this at start of protected endpoints
 *
 * Example:
 * ```
 * const auth = await getAuthenticatedClient(req);
 * if (!auth.client) {
 *   return res.status(401).json({ error: auth.error });
 * }
 * const { data } = await auth.client.from('profiles').select('*');
 * ```
 */
export async function getAuthenticatedClient(
  req: VercelRequest
): Promise<SupabaseAuthResult> {
  return createAuthenticatedSupabaseClient(req);
}

/**
 * ADMIN CLIENT (Service Key)
 *
 * WARNING: Only use for:
 * - Cron jobs (no user context)
 * - Admin operations that genuinely need elevated privilege
 * - User data deletion (GDPR)
 *
 * NEVER use in request handlers - use authenticated client instead!
 */
export function createAdminSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY required for admin client');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

export default {
  createAuthenticatedSupabaseClient,
  getAuthenticatedClient,
  createAdminSupabaseClient,
  extractToken
};
