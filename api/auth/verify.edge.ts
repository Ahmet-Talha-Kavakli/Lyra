/**
 * GET /api/auth/verify
 * Edge Runtime - Check if user is authenticated
 *
 * Returns 200 + user info if authenticated
 * Returns 401 if token invalid/expired
 */

export const config = {
  runtime: 'edge'
};

import { createClient } from '@supabase/supabase-js';

function logEdge(level: 'info' | 'warn' | 'error', msg: string, data?: any) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, message: msg, ...(data || {}) }));
}

/**
 * Extract token from HttpOnly cookie or header
 */
function extractToken(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (cookieHeader) {
    const cookies = cookieHeader.split(';');
    const accessCookie = cookies.find(c => c.trim().startsWith('lyra_access_token='));
    if (accessCookie) {
      return accessCookie.split('=')[1].trim();
    }
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const token = extractToken(request);

    if (!token) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
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

    // Verify token
    const { data, error } = await supabase.auth.getUser(token);

    if (error || !data.user) {
      logEdge('warn', 'Token verification failed');
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    logEdge('info', 'User verified', { userId: data.user.id });

    return new Response(
      JSON.stringify({
        user: {
          id: data.user.id,
          email: data.user.email,
          firstName: data.user.user_metadata?.firstName || ''
        }
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    logEdge('error', 'Verify handler error', { error: error.message });
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
