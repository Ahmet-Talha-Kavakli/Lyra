/**
 * POST /api/auth/logout
 * Revoke JWT token + all user sessions (Denylist)
 */

import { VercelRequest, VercelResponse } from '@vercel/node';
import { TokenDenylist } from '../../lib/infrastructure/tokenDenylist';
import { logger } from '../../lib/infrastructure/logger';
import { verifyAuth } from '../../lib/infrastructure/authMiddleware';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Verify JWT token
    const auth = await verifyAuth(req);
    if (!auth.success) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const userId = auth.userId;
    const token = extractTokenFromRequest(req);

    // Add token to denylist (TTL = 1 hour)
    if (token) {
      await TokenDenylist.revokeToken(token, 3600);
    }

    // Revoke ALL user sessions
    await TokenDenylist.revokeUserSessions(userId, 86400);

    logger.info('Logout successful - user sessions revoked', { userId });

    // CLEAR SECURE HTTP-ONLY COOKIES
    const secureFlag = process.env.NODE_ENV === 'production' ? 'Secure;' : '';
    res.setHeader('Set-Cookie', [
      `lyra_access_token=; Path=/; HttpOnly; ${secureFlag} SameSite=Strict; Max-Age=0`,
      `lyra_refresh_token=; Path=/; HttpOnly; ${secureFlag} SameSite=Strict; Max-Age=0`
    ]);

    return res.status(200).json({ message: 'Logged out successfully' });

  } catch (error: any) {
    logger.error('Logout handler error', { error: error.message });
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
