import express from 'express';
import jwt from 'jsonwebtoken';

const app = express();
const port = 3004;
app.use(express.json());

// Token doğrulama
function requireAuth(req, res, next) {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) {
        return res.status(401).json({ error: 'Token gerekli' });
    }

    try {
        const JWT_SECRET = 'your-super-secret-jwt-key-change-this-in-production';
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.userId;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Token geçersiz: ' + err.message });
    }
}

// Test endpoint - /record-thought gibi
app.post('/record-thought', requireAuth, async (req, res) => {
    const { userId, automatic_thought } = req.body;
    if (!userId || !automatic_thought) {
        return res.json({ error: 'userId ve automatic_thought gerekli' });
    }
    res.json({ success: true, message: 'Recorded' });
});

app.listen(port, () => {
    console.log(`\n✅ Test server başladı: http://localhost:${port}\n`);
});
