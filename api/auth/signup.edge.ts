/**
 * POST /api/auth/signup
 * Edge Runtime - Zero cold start for registration
 */

export const config = {
  runtime: 'edge'
};

import { createClient } from '@supabase/supabase-js';
import { validateUserRegistration } from '../../lib/infrastructure/validationSchemas';

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
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const validation = validateUserRegistration(body);
    if (!validation.success) {
      return new Response(JSON.stringify({ error: 'Validation failed' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const { email, password, firstName, lastName } = validation.data;

    const supabase = createClient(
      process.env.SUPABASE_URL || '',
      process.env.SUPABASE_ANON_KEY || ''
    );

    // Create auth user (using admin client would bypass RLS)
    // Instead, use client.auth.signUp() which respects auth rules
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { firstName, lastName }
      }
    });

    if (authError || !authData.user) {
      logEdge('error', 'Auth user creation failed', { email, error: authError?.message });

      if (authError?.message?.includes('already exists')) {
        return new Response(JSON.stringify({ error: 'Email already registered' }), {
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response(JSON.stringify({ error: 'Failed to create account' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const userId = authData.user.id;

    // Create profile in database
    // This should use authenticated client, but signup creates implicit session
    const { error: profileError } = await supabase
      .from('user_profile')
      .insert({
        user_id: userId,
        email,
        first_name: firstName,
        last_name: lastName,
        created_at: new Date().toISOString(),
        session_count: 0,
        is_first_session: true,
        psychological_profile: null
      });

    if (profileError) {
      logEdge('error', 'Profile creation failed', { userId, error: profileError.message });
      return new Response(JSON.stringify({ error: 'Failed to create profile' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Create session
    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (sessionError || !sessionData.session) {
      logEdge('error', 'Session creation failed', { userId, error: sessionError?.message });
      return new Response(JSON.stringify({ error: 'Failed to create session' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    logEdge('info', 'User signup successful', { userId, email });

    const isProduction = process.env.NODE_ENV === 'production';
    const secure = isProduction ? '; Secure' : '';
    const sameSite = '; SameSite=Strict';
    const path = '; Path=/';
    const maxAge = `; Max-Age=${sessionData.session.expires_in}`;
    const maxAgeRefresh = '; Max-Age=2592000';

    const accessTokenCookie = `lyra_access_token=${sessionData.session.access_token}${path}${maxAge}; HttpOnly${secure}${sameSite}`;
    const refreshTokenCookie = `lyra_refresh_token=${sessionData.session.refresh_token}${path}${maxAgeRefresh}; HttpOnly${secure}${sameSite}`;

    const response = new Response(
      JSON.stringify({
        user: {
          id: userId,
          email,
          firstName,
          lastName
        },
        session: {
          expiresIn: sessionData.session.expires_in,
          expiresAt: sessionData.session.expires_at
        }
      }),
      {
        status: 201,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': [accessTokenCookie, refreshTokenCookie].join(', ')
        }
      }
    );

    return response;

  } catch (error: any) {
    logEdge('error', 'Signup handler error', { error: error.message });
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
