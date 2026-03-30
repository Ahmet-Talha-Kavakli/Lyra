/**
 * POST /api/auth/login
 * Edge Runtime - Zero cold start for authentication
 *
 * export const config = { runtime: 'edge' };
 * - Uses Web Standard APIs (Request/Response)
 * - ~10ms cold start (vs 400ms Node)
 * - HttpOnly cookies set via headers
 */

export const config = {
  runtime: 'edge'
};

import { createClient } from '@supabase/supabase-js';
import { validateEmail } from '../../lib/infrastructure/validationSchemas';

/**
 * Simple logger for Edge (no winston)
 */
function logEdge(level: 'info' | 'warn' | 'error', msg: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(
    JSON.stringify({
      timestamp,
      level,
      message: msg,
      ...(data || {})
    })
  );
}

export default async function handler(request: Request): Promise<Response> {
  // Only POST allowed
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Parse request body
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate input
    const validation = validateEmail(body);
    if (!validation.success) {
      return new Response(JSON.stringify({ error: 'Validation failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { email, password } = validation.data;

    // Create Supabase client
    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || ''
    );

    // Authenticate with Supabase
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error || !data.session) {
      logEdge('warn', 'Login failed', { email, error: error?.message });
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    logEdge('info', 'Login successful', {
      userId: data.user.id,
      email
    });

    // Set secure HttpOnly cookies
    const isProduction = process.env.NODE_ENV === 'production';
    const secure = isProduction ? '; Secure' : '';
    const sameSite = '; SameSite=Strict';
    const path = '; Path=/';
    const maxAge = `; Max-Age=${data.session.expires_in}`;
    const maxAgeRefresh = '; Max-Age=2592000'; // 30 days

    const accessTokenCookie = `lyra_access_token=${data.session.access_token}${path}${maxAge}; HttpOnly${secure}${sameSite}`;
    const refreshTokenCookie = `lyra_refresh_token=${data.session.refresh_token}${path}${maxAgeRefresh}; HttpOnly${secure}${sameSite}`;

    // Return response with cookies
    const response = new Response(
      JSON.stringify({
        user: {
          id: data.user.id,
          email: data.user.email,
          firstName: data.user.user_metadata?.firstName || ''
        },
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
    logEdge('error', 'Login handler error', { error: error.message });
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
