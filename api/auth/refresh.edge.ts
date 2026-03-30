/**
 * POST /api/auth/refresh
 * Edge Runtime - Token refresh with zero latency
 */

export const config = {
  runtime: 'edge'
};

import { createClient } from '@supabase/supabase-js';

function logEdge(level: 'info' | 'warn' | 'error', msg: string, data?: any) {
  console.log(JSON.stringify({ timestamp: new Date().toISOString(), level, message: msg, ...(data || {}) }));
}

/**
 * Extract refresh token from HttpOnly cookie
 */
function extractRefreshToken(request: Request): string | null {
  const cookieHeader = request.headers.get('cookie');
  if (!cookieHeader) return null;

  const cookies = cookieHeader.split(';');
  const refreshCookie = cookies.find(c => c.trim().startsWith('lyra_refresh_token='));

  return refreshCookie ? refreshCookie.split('=')[1].trim() : null;
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const refreshToken = extractRefreshToken(request);

    if (!refreshToken) {
      logEdge('warn', 'Refresh token missing');
      return new Response(JSON.stringify({ error: 'Refresh token required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || ''
    );

    // Refresh tokens
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken
    });

    if (error || !data.session) {
      logEdge('warn', 'Token refresh failed', { error: error?.message });
      return new Response(JSON.stringify({ error: 'Invalid refresh token' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    logEdge('info', 'Token refreshed', { userId: data.user?.id });

    const isProduction = process.env.NODE_ENV === 'production';
    const secure = isProduction ? '; Secure' : '';
    const sameSite = '; SameSite=Strict';
    const path = '; Path=/';
    const maxAge = `; Max-Age=${data.session.expires_in}`;
    const maxAgeRefresh = '; Max-Age=2592000';

    const accessTokenCookie = `lyra_access_token=${data.session.access_token}${path}${maxAge}; HttpOnly${secure}${sameSite}`;
    const refreshTokenCookie = `lyra_refresh_token=${data.session.refresh_token}${path}${maxAgeRefresh}; HttpOnly${secure}${sameSite}`;

    const response = new Response(
      JSON.stringify({
        session: {
          expiresIn: data.session.expires_in,
          expiresAt: data.session.expires_at
        }
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': [accessTokenCookie, refreshTokenCookie].join(', ')
        }
      }
    );

    return response;

  } catch (error: any) {
    logEdge('error', 'Refresh handler error', { error: error.message });
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
