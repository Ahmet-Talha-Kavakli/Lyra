import express from 'express';
import jwt from 'jsonwebtoken';

const app = express();
const port = 3002;

// Token doğrulama
function requireAuth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Token gerekli' });
    }

    try {
        const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        req.userEmail = decoded.email;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token geçersiz: ' + err.message });
    }
}

// Test endpoints
app.get('/ping', (req, res) => {
    res.json({ status: 'OK' });
});

app.delete('/protected', requireAuth, (req, res) => {
    res.json({ success: true, userId: req.userId, message: 'Protected route works!' });
});

app.listen(port, () => {
    console.log(`\n✅ Test server başladı: http://localhost:${port}\n`);
});
