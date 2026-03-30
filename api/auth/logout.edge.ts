/**
 * POST /api/auth/logout
 * Edge Runtime - Instant session termination
 */

export const config = {
  runtime: 'edge'
};

import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL || '',
  token: process.env.UPSTASH_REDIS_REST_TOKEN || '',
});

function logEdge(level: 'info' | 'warn' | 'error', msg: string, data?: any) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, message: msg, ...(data || {}) }));
}

/**
 * Extract access token from HttpOnly cookie or header
 */
function extractToken(request: Request): string | null {
  // Try cookie first
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';');
    const accessCookie = cookies.find(c => c.trim().startsWith('lyra_access_token='));
    if (accessCookie) {
      return accessCookie.split('=')[1].trim();
    }
  }

  // Fallback to Authorization header
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const token = extractToken(request);

    if (!token) {
      logEdge('warn', 'No token provided');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || '',
      {
        global: {
          headers: { Authorization: `Bearer ${token}` }
        }
      }
    );

    // Get user to verify token
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      logEdge('warn', 'Token verification failed');
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = data.user.id;

    // Sign out (invalidate session in Supabase)
    const { error: logoutError } = await supabase.auth.signOut();

    if (logoutError) {
      logEdge('warn', 'Logout failed', { userId, error: logoutError.message });
      // Don't fail the request, just log it
    }

    logEdge('info', 'Logout successful', { userId });

    // Add token to Redis Denylist (30 days TTL matching refresh token or access token max lifespan)
    try {
      await redis.set(`lyra:denylist:${token}`, 'true', { ex: 2592000 });
      logEdge('info', 'Token successfully added to denylist');
    } catch (redisError: any) {
      logEdge('error', 'Redis Denylist Error during logout', { error: redisError.message });
      // We don't fail the logout process, fail-open concept
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const secure = isProduction ? '; Secure' : '';
    const sameSite = '; SameSite=Strict';
    const path = '; Path=/';

    // Clear cookies (set Max-Age=0)
    const clearAccessToken = `lyra_access_token=; ${path}; HttpOnly${secure}${sameSite}; Max-Age=0`;
    const clearRefreshToken = `lyra_refresh_token=; ${path}; HttpOnly${secure}${sameSite}; Max-Age=0`;

    const response = new Response(
      JSON.stringify({ message: 'Logged out successfully' }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': [clearAccessToken, clearRefreshToken].join(', ')
        }
      }
    );

    return response;

  } catch (error: any) {
    logEdge('error', 'Logout handler error', { error: error.message });
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
