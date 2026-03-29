import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

/**
 * JWT token'ı doğrula ve req.userId'ye ata
 * Authorization header'dan token alır: "Bearer <token>"
 */
export function authMiddleware(req, res, next) {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ error: 'Giriş yapmanız gerekliyor' });
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
        const token = req.headers.authorization?.split(' ')[1];

        if (token) {
            const decoded = jwt.verify(token, JWT_SECRET);
            req.userId = decoded.userId;
            req.userEmail = decoded.email;
        }

        next();
    } catch (err) {
        // Token varsa ama geçersizse error
        if (req.headers.authorization) {
            console.error('[optionalAuthMiddleware] Token hatası:', err.message);
            return res.status(401).json({ error: 'Token geçersiz' });
        }
        // Token yoksa devam et
        next();
    }
}
