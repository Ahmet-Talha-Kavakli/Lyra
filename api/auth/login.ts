/**
 * POST /api/auth/login
 * Vercel EDGE Handler - Ultra Fast, Zero Cold Start
 */

import { logger } from '../../lib/infrastructure/logger';
import { validateEmail } from '../../lib/infrastructure/validationSchemas';

export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const body = await req.json();
    
    // (Rate limiting Edge uyumlu yapılandırılmalı, şimdilik atlıyoruz/kendi Redis Edge yapınızla entegre edebilirsiniz)

    const validation = validateEmail(body);
    if (!validation.success) {
      return new Response(JSON.stringify({ error: 'Validation failed' }), { status: 400 });
    }

    const { email, password } = validation.data;

    // Supabase signIn için servis anahtarı değil anon key kullanılmalı
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || '';
    
    // Edge ortamı için doğrudan native Fetch ile Supabase iletişimi (En hızlı, sıfır cold start)
    const authResult = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: {
        'apikey': supabaseAnonKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    const data = await authResult.json();

    if (!authResult.ok || !data.access_token) {
      logger.warn('Login failed', { email, error: data.error_description });
      return new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 });
    }

    logger.info('Login successful', { userId: data.user.id, email });

    const secureFlag = process.env.NODE_ENV === 'production' ? 'Secure;' : '';
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.append('Set-Cookie', `lyra_access_token=${data.access_token}; Path=/; HttpOnly; ${secureFlag} SameSite=Strict; Max-Age=${data.expires_in}`);
    headers.append('Set-Cookie', `lyra_refresh_token=${data.refresh_token}; Path=/; HttpOnly; ${secureFlag} SameSite=Strict; Max-Age=2592000`);

    return new Response(JSON.stringify({
      user: {
        id: data.user.id,
        email: data.user.email,
        firstName: data.user.user_metadata?.firstName || ''
      },
      session: {
        expiresIn: data.expires_in,
        expiresAt: Math.floor(Date.now() / 1000) + data.expires_in
      }
    }), { status: 200, headers });

  } catch (error: any) {
    logger.error('Login Edge handler error', { error: error.message });
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500 });
  }
}
