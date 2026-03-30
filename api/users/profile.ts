/**
 * GET /api/users/profile
 * Protected endpoint - validates token against Denylist
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { TokenDenylist } from '../../lib/infrastructure/tokenDenylist';
import { logger } from '../../lib/infrastructure/logger';
import { verifyAuth } from '../../lib/infrastructure/authMiddleware';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // ✅ Verify JWT token
    const auth = await verifyAuth(req);
    if (!auth.success) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = auth.userId;
    const token = extractTokenFromRequest(req);

    // ✅ CHECK: Is this token in the denylist?
    // (Middleware already checks this, but double-check here for safety)
    if (token && (await TokenDenylist.isTokenDenylisted(token))) {
      return res.status(401).json({ error: 'Token revoked' });
    }

    // ✅ CHECK: Are all user's sessions revoked?
    if (await TokenDenylist.areUserSessionsRevoked(userId)) {
      return res.status(401).json({ error: 'User sessions revoked' });
    }

    logger.info('Profile request', { userId });

    // Fetch user profile from Supabase
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || '';

    const profileResult = await fetch(
      `${supabaseUrl}/rest/v1/profiles?user_id=eq.${userId}`,
      {
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      }
    );

    if (!profileResult.ok) {
      logger.error('Failed to fetch profile from Supabase', {
        userId,
        status: profileResult.status,
      });
      return res.status(500).json({ error: 'Internal server error' });
    }

    const profiles = await profileResult.json();
    const profile = profiles[0] || null;

    return res.status(200).json({
      profile: {
        id: userId,
        ...profile,
      },
    });
  } catch (error: any) {
    logger.error('Profile handler error', { error: error.message });
    return res.status(500).json({ error: 'Internal server error' });
  }
}

function extractTokenFromRequest(req: VercelRequest): string | null {
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    const match = cookieHeader.match(/lyra_access_token=([^;]*)/);
    if (match) return match[1];
  }
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  return null;
}
