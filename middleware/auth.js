import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
dotenv.config();

/**
 * Token'ı önce httpOnly cookie'den, sonra Authorization header'dan alır
 */
function extractToken(req) {
    if (req.cookies?.lyra_token) return req.cookies.lyra_token;
    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) return header.split(' ')[1];
    return null;
}

/**
 * JWT token'ı doğrula ve req.userId'ye ata
 */
export function authMiddleware(req, res, next) {
    try {
        const token = extractToken(req);

        if (!token) {
            return res.status(401).json({ error: 'Giriş yapmanız gerekliyor' });
        }

        const JWT_SECRET = process.env.JWT_SECRET;
        if (!JWT_SECRET) {
            console.error('[FATAL] JWT_SECRET not set');
            return res.status(500).json({ error: 'Sunucu yapılandırma hatası' });
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        req.userEmail = decoded.email;

        next();
    } catch (err) {
        console.error('[authMiddleware] Token hatası:', err.message);
        res.status(401).json({ error: 'Token geçersiz veya süresi dolmuş' });
    }
}

/**
 * Optional auth — token varsa doğrula, yoksa devam et
 */
export function optionalAuthMiddleware(req, res, next) {
    try {
        const token = extractToken(req);

        if (token) {
            const JWT_SECRET = process.env.JWT_SECRET;
            if (!JWT_SECRET) return next(); // yapılandırma eksikse optional auth geç
            const decoded = jwt.verify(token, JWT_SECRET);
            req.userId = decoded.userId;
            req.userEmail = decoded.email;
        }

        next();
    } catch (err) {
        if (req.headers.authorization || req.cookies?.lyra_token) {
            console.error('[optionalAuthMiddleware] Token hatası:', err.message);
            return res.status(401).json({ error: 'Token geçersiz' });
        }
        next();
    }
}
