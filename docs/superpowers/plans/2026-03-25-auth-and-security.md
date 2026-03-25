# Auth & Güvenlik Sistemi — Implementation Planı

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Supabase Auth tabanlı tam login/register sistemi (e-posta + Google/Facebook/Apple) + backend JWT middleware + güvenlik açıklarını kapatmak.

**Architecture:** `auth.html` ayrı sayfa olarak login/register/social login barındırır. Backend'e her istek `Authorization: Bearer <JWT>` header'ı ile gelir. `verifyAuth()` middleware JWT'yi doğrular, `req.userId`'yi set eder. Tüm korumalı endpoint'ler body/query yerine `req.userId` kullanır.

**Tech Stack:** Node.js ESM, Express 5, Supabase Auth (JS SDK v2), Vanilla JS, Vercel

---

## Chunk 1: Backend — verifyAuth Middleware & Güvenlik Düzeltmeleri

### Görev 1: verifyAuth Middleware

**Dosyalar:**
- Düzenle: `server.js` — middleware ekle, CORS/CSP/error handling düzelt

- [ ] **1.1 — jsonwebtoken paketi ekle**

```bash
npm install jsonwebtoken
```

- [ ] **1.2 — server.js'e verifyAuth middleware ekle**

Önce dosyanın üstündeki import bloğuna (diğer import'ların yanına) ekle:
```javascript
import jwt from 'jsonwebtoken';
```

Ardından `dotenv.config();` satırının hemen altına ekle:

```javascript
// ─── AUTH MIDDLEWARE ─────────────────────────────────────────────────────────

const SUPABASE_JWT_SECRET = process.env.SUPABASE_JWT_SECRET;

export function verifyAuth(req, res, next) {
    const authHeader = req.headers['authorization'];
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Yetkisiz erişim' });
    }
    const token = authHeader.slice(7);
    try {
        const decoded = jwt.verify(token, SUPABASE_JWT_SECRET);
        req.userId = decoded.sub; // Supabase user UUID
        next();
    } catch {
        return res.status(401).json({ error: 'Geçersiz veya süresi dolmuş token' });
    }
}
```

**Not:** `SUPABASE_JWT_SECRET` Supabase Dashboard → Project Settings → API → JWT Secret'tan alınır.

- [ ] **1.3 — .env dosyasına ekle**

`.env` dosyasına şu satırı ekle:
```
SUPABASE_JWT_SECRET=<supabase-dashboard-jwt-secret>
```

- [ ] **1.4 — Korumalı endpoint'lere middleware ekle**

Aşağıdaki her endpoint'in `app.get/post/delete(...)` çağrısına `verifyAuth` ekle:

```javascript
// Örnekler:
app.get('/my-progress', verifyAuth, async (req, res) => { ... })
app.get('/memory', verifyAuth, async (req, res) => { ... })
app.post('/save-local-memory', verifyAuth, async (req, res) => { ... })
app.delete('/delete-my-data', verifyAuth, async (req, res) => { ... })
app.get('/export-my-data', verifyAuth, async (req, res) => { ... })
app.get('/session-history/:userId', verifyAuth, async (req, res) => { ... })
app.post('/session-feedback', verifyAuth, async (req, res) => { ... })
app.get('/emergency-contacts', verifyAuth, async (req, res) => { ... })
app.post('/emergency-contacts', verifyAuth, async (req, res) => { ... })
app.post('/record-thought', verifyAuth, async (req, res) => { ... })
app.get('/thought-records/:userId', verifyAuth, async (req, res) => { ... })
app.post('/discover-values', verifyAuth, async (req, res) => { ... })
app.get('/user-values/:userId', verifyAuth, async (req, res) => { ... })
app.post('/assign-homework', verifyAuth, async (req, res) => { ... })
app.get('/homework/:userId', verifyAuth, async (req, res) => { ... })
app.post('/complete-homework/:taskId', verifyAuth, async (req, res) => { ... })
app.post('/log-crisis', verifyAuth, async (req, res) => { ... })
app.post('/end-session', verifyAuth, async (req, res) => { ... })
app.post('/session-start', verifyAuth, async (req, res) => { ... })
app.post('/session-prep', verifyAuth, async (req, res) => { ... })
app.get('/session-prep', verifyAuth, async (req, res) => { ... })
app.post('/hypothesis', verifyAuth, async (req, res) => { ... })
app.post('/save-insight', verifyAuth, async (req, res) => { ... })
app.get('/analytics/source-effectiveness/:userId', verifyAuth, async (req, res) => { ... })
app.get('/analytics/behavior-timeline/:userId', verifyAuth, async (req, res) => { ... })
app.post('/api/chat/completions', chatRateLimit, verifyAuth, async (req, res) => { ... })
```

**Açık kalacaklar (verifyAuth YOK):**
`/ping`, `/config`, `/vapi-webhook`, `/consent-accept`, `/consent-status`, `/start-visualization`, `/log-error`, `/analyze-emotion`, `/synthesize`, `/character`, `/retrieve-knowledge`, `/retrieve-knowledge-advanced`

- [ ] **1.5 — userId'yi body/query yerine req.userId'den al**

`verifyAuth` eklenmiş her endpoint içinde:
```javascript
// ESKİ:
const { userId } = req.body;
const { userId } = req.query;
const userId = req.params.userId;

// YENİ — req.userId kullan:
const userId = req.userId; // middleware'den geliyor
```

- [ ] **1.6 — Commit**

```bash
git add server.js .env
git commit -m "feat: verifyAuth middleware — JWT doğrulama, userId req.userId'den alınıyor"
```

---

### Görev 2: Vapi Webhook İmza Doğrulaması

**Dosyalar:**
- Düzenle: `server.js` — `/vapi-webhook` endpoint başına imza kontrolü

- [ ] **2.1 — Raw body middleware ekle**

`app.use(express.json())` satırının ÜSTÜNE ekle:

```javascript
// Raw body — Vapi webhook imza doğrulaması için gerekli
app.use('/vapi-webhook', express.raw({ type: 'application/json' }));
```

- [ ] **2.2 — Webhook imza doğrulaması ekle**

`/vapi-webhook` endpoint'inin en başına ekle:

```javascript
app.post('/vapi-webhook', async (req, res) => {
    // İmza doğrulama
    const secret = process.env.VAPI_WEBHOOK_SECRET;
    if (secret) {
        const sig = req.headers['x-vapi-signature'];
        const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
        const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
        if (!sig || sig !== expected) {
            console.warn('[VAPI] Geçersiz webhook imzası');
            return res.status(401).json({ error: 'Geçersiz imza' });
        }
    }
    // Raw body'yi parse et
    const { message } = Buffer.isBuffer(req.body)
        ? JSON.parse(req.body.toString())
        : req.body;
    // ... geri kalan kod aynı
```

- [ ] **2.3 — .env ve Vercel'e VAPI_WEBHOOK_SECRET ekle**

`.env` dosyasına:
```
VAPI_WEBHOOK_SECRET=<vapi-dashboard-webhook-secret>
```

Vercel Dashboard → Environment Variables'a da ekle.

- [ ] **2.4 — Commit**

```bash
git add server.js
git commit -m "security: Vapi webhook HMAC-SHA256 imza doğrulaması"
```

---

### Görev 3: CORS, CSP, Error Handling, Rate Limit Düzeltmeleri

**Dosyalar:**
- Düzenle: `server.js`

- [ ] **3.1 — CORS düzelt**

Mevcut CORS bloğunu tamamen şununla değiştir:

```javascript
const ALLOWED_ORIGINS = [
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL_PREVIEW,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:5173',
].filter(Boolean);

app.use(cors({
    origin: (origin, callback) => {
        // Aynı origin istekleri (Postman, server-side) geç
        if (!origin) return callback(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
        // Development'ta Vercel preview URL'leri izin ver
        if (process.env.NODE_ENV !== 'production' && /\.vercel\.app$/.test(origin)) {
            return callback(null, true);
        }
        callback(new Error('CORS: İzin verilmeyen origin'));
    },
    credentials: true,
}));
```

- [ ] **3.2 — CSP'den unsafe-eval kaldır**

Helmet config'de `scriptSrc` satırını güncelle:
```javascript
// ESKİ:
scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
// YENİ:
scriptSrc: ["'self'", "'unsafe-inline'"],
```

- [ ] **3.3 — error.message expose'ları düzelt**

Tüm `res.status(5xx).json({ error: error.message })` satırlarını bul ve şununla değiştir:
```javascript
console.error('[ENDPOINT_ADI]', error);
res.status(500).json({ error: 'İşlem tamamlanamadı' });
```

Etkilenen endpoint'ler (grep ile bul):
```bash
grep -n "error.message" server.js
```

- [ ] **3.4 — Eksik rate limit'leri ekle**

Mevcut rate limiter bloğunun yanına ekle:

```javascript
const webhookRateLimit = rateLimit({ windowMs: 60_000, max: 30, standardHeaders: true, legacyHeaders: false });
const deleteRateLimit  = rateLimit({ windowMs: 3_600_000, max: 3, standardHeaders: true, legacyHeaders: false });
const exportRateLimit  = rateLimit({ windowMs: 3_600_000, max: 5, standardHeaders: true, legacyHeaders: false });
const memoryRateLimit  = rateLimit({ windowMs: 60_000, max: 20, standardHeaders: true, legacyHeaders: false });
```

Endpoint'lere uygula:
```javascript
app.post('/vapi-webhook', webhookRateLimit, async (req, res) => { ... })
app.delete('/delete-my-data', deleteRateLimit, verifyAuth, async (req, res) => { ... })
app.get('/export-my-data', exportRateLimit, verifyAuth, async (req, res) => { ... })
app.post('/save-local-memory', memoryRateLimit, verifyAuth, async (req, res) => { ... })
```

- [ ] **3.5 — Commit**

```bash
git add server.js
git commit -m "security: CORS kısıtla, CSP unsafe-eval kaldır, error.message gizle, rate limit tamamla"
```

---

## Chunk 2: Frontend — auth.html Login/Register Sayfası

### Görev 4: auth.html Sayfası

**Dosyalar:**
- Yeni: `public/auth.html`

- [ ] **4.1 — public/auth.html oluştur**

21st.dev dark minimal tasarım — Lyra renk paleti:

```html
<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Lyra — Giriş</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #0a0806;
      color: rgba(240,230,210,0.85);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    /* Arka plan parıltısı */
    body::before {
      content: '';
      position: fixed;
      inset: 0;
      background: radial-gradient(ellipse 60% 50% at 50% 0%, rgba(200,169,110,0.06) 0%, transparent 70%);
      pointer-events: none;
    }

    .card {
      width: 100%;
      max-width: 400px;
      background: rgba(16,11,7,0.95);
      border: 1px solid rgba(200,169,110,0.15);
      border-radius: 20px;
      padding: 40px 36px;
      display: flex;
      flex-direction: column;
      gap: 28px;
      box-shadow: 0 24px 60px rgba(0,0,0,0.5);
    }

    /* Logo */
    .logo {
      text-align: center;
    }
    .logo-name {
      font-size: 1.8rem;
      font-weight: 300;
      letter-spacing: 0.15em;
      color: #c8a96e;
    }
    .logo-tagline {
      font-size: 12px;
      color: rgba(200,169,110,0.4);
      letter-spacing: 0.08em;
      margin-top: 4px;
    }

    /* Tab */
    .tabs {
      display: flex;
      gap: 0;
      border-bottom: 1px solid rgba(200,169,110,0.12);
    }
    .tab {
      flex: 1;
      padding: 10px;
      text-align: center;
      font-size: 13px;
      letter-spacing: 0.05em;
      color: rgba(200,169,110,0.4);
      cursor: pointer;
      border-bottom: 2px solid transparent;
      transition: all 0.2s;
      background: none;
      border-top: none;
      border-left: none;
      border-right: none;
    }
    .tab.active {
      color: #c8a96e;
      border-bottom-color: #c8a96e;
    }

    /* Form */
    .form { display: flex; flex-direction: column; gap: 14px; }

    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .field label {
      font-size: 11px;
      letter-spacing: 0.08em;
      color: rgba(200,169,110,0.5);
      text-transform: uppercase;
    }
    .field input {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(200,169,110,0.15);
      border-radius: 10px;
      padding: 12px 14px;
      font-size: 14px;
      color: rgba(240,230,210,0.9);
      outline: none;
      transition: border-color 0.2s;
      width: 100%;
    }
    .field input:focus {
      border-color: rgba(200,169,110,0.4);
    }
    .field input::placeholder {
      color: rgba(200,180,140,0.25);
    }

    /* Consent */
    .consent {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      font-size: 12px;
      color: rgba(200,180,140,0.55);
      line-height: 1.5;
    }
    .consent input[type="checkbox"] {
      width: 14px;
      height: 14px;
      margin-top: 2px;
      flex-shrink: 0;
      accent-color: #c8a96e;
      cursor: pointer;
    }
    .consent a { color: rgba(200,169,110,0.7); text-decoration: none; }
    .consent a:hover { color: #c8a96e; }

    /* Şifremi unuttum */
    .forgot {
      text-align: right;
      font-size: 12px;
      color: rgba(200,169,110,0.4);
      cursor: pointer;
      background: none;
      border: none;
      padding: 0;
    }
    .forgot:hover { color: #c8a96e; }

    /* Primary button */
    .btn-primary {
      background: linear-gradient(135deg, rgba(200,169,110,0.9), rgba(180,145,85,0.9));
      color: #0a0806;
      border: none;
      border-radius: 10px;
      padding: 13px;
      font-size: 14px;
      font-weight: 600;
      letter-spacing: 0.04em;
      cursor: pointer;
      transition: opacity 0.2s, transform 0.1s;
      width: 100%;
    }
    .btn-primary:hover { opacity: 0.9; }
    .btn-primary:active { transform: scale(0.99); }
    .btn-primary:disabled { opacity: 0.4; cursor: not-allowed; }

    /* Divider */
    .divider {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 11px;
      color: rgba(200,169,110,0.25);
      letter-spacing: 0.08em;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      height: 1px;
      background: rgba(200,169,110,0.1);
    }

    /* Social buttons */
    .social-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .btn-social {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(200,169,110,0.12);
      border-radius: 10px;
      padding: 11px 16px;
      font-size: 13px;
      color: rgba(240,230,210,0.75);
      cursor: pointer;
      transition: all 0.2s;
      width: 100%;
    }
    .btn-social:hover {
      background: rgba(255,255,255,0.07);
      border-color: rgba(200,169,110,0.25);
      color: rgba(240,230,210,0.95);
    }
    .btn-social svg { width: 18px; height: 18px; flex-shrink: 0; }

    /* Error / Success mesajları */
    .message {
      font-size: 12px;
      padding: 10px 14px;
      border-radius: 8px;
      text-align: center;
      display: none;
    }
    .message.error {
      background: rgba(200,60,60,0.1);
      border: 1px solid rgba(200,60,60,0.2);
      color: rgba(255,120,120,0.9);
    }
    .message.success {
      background: rgba(60,160,80,0.1);
      border: 1px solid rgba(60,160,80,0.2);
      color: rgba(100,200,120,0.9);
    }

    .hidden { display: none !important; }
  </style>
</head>
<body>
  <div class="card">

    <!-- Logo -->
    <div class="logo">
      <div class="logo-name">LYRA</div>
      <div class="logo-tagline">Psikolojik Destek Asistanı</div>
    </div>

    <!-- Tabs -->
    <div class="tabs">
      <button class="tab active" id="tab-login" onclick="switchTab('login')">Giriş Yap</button>
      <button class="tab" id="tab-register" onclick="switchTab('register')">Kayıt Ol</button>
    </div>

    <!-- Mesaj alanı -->
    <div class="message" id="msg"></div>

    <!-- Login Formu -->
    <div id="form-login" class="form">
      <div class="field">
        <label>E-posta</label>
        <input type="email" id="login-email" placeholder="ornek@email.com" autocomplete="email">
      </div>
      <div class="field">
        <label>Şifre</label>
        <input type="password" id="login-password" placeholder="••••••••" autocomplete="current-password">
      </div>
      <button class="forgot" onclick="showForgotPassword()">Şifremi unuttum</button>
      <button class="btn-primary" id="btn-login" onclick="handleLogin()">Giriş Yap</button>
    </div>

    <!-- Register Formu -->
    <div id="form-register" class="form hidden">
      <div class="field">
        <label>E-posta</label>
        <input type="email" id="reg-email" placeholder="ornek@email.com" autocomplete="email">
      </div>
      <div class="field">
        <label>Şifre</label>
        <input type="password" id="reg-password" placeholder="En az 8 karakter" autocomplete="new-password">
      </div>
      <label class="consent">
        <input type="checkbox" id="consent-check">
        <span>
          <a href="/terms.html" target="_blank">Kullanım Şartları</a>'nı ve
          <a href="/privacy.html" target="_blank">Gizlilik Politikası</a>'nı okudum, kabul ediyorum.
          (18 yaş ve üzerindeyim)
        </span>
      </label>
      <button class="btn-primary" id="btn-register" onclick="handleRegister()">Kayıt Ol</button>
    </div>

    <!-- Şifremi Unuttum Formu -->
    <div id="form-forgot" class="form hidden">
      <div class="field">
        <label>E-posta adresiniz</label>
        <input type="email" id="forgot-email" placeholder="ornek@email.com">
      </div>
      <button class="btn-primary" onclick="handleForgotPassword()">Sıfırlama Linki Gönder</button>
      <button class="forgot" onclick="switchTab('login')">← Giriş sayfasına dön</button>
    </div>

    <!-- Divider -->
    <div class="divider">veya</div>

    <!-- Social Login -->
    <div class="social-grid">
      <button class="btn-social" onclick="handleSocial('google')">
        <svg viewBox="0 0 24 24" fill="none">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Google ile devam et
      </button>
      <button class="btn-social" onclick="handleSocial('facebook')">
        <svg viewBox="0 0 24 24" fill="#1877F2">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
        </svg>
        Facebook ile devam et
      </button>
      <button class="btn-social" onclick="handleSocial('apple')">
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
        </svg>
        Apple ile devam et
      </button>
    </div>

  </div>

  <script type="module">
    // Supabase config — server'dan al
    const configResp = await fetch('/config');
    const { supabaseUrl, supabaseAnonKey } = await configResp.json();

    const { createClient } = await import(`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm`);
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Zaten giriş yapmışsa ana sayfaya yönlendir
    const { data: { session } } = await supabase.auth.getSession();
    if (session) window.location.href = '/';

    // Tab switch
    window.switchTab = (tab) => {
      document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
      document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
      document.getElementById('form-forgot').classList.toggle('hidden', tab !== 'forgot');
      document.getElementById('tab-login').classList.toggle('active', tab === 'login');
      document.getElementById('tab-register').classList.toggle('active', tab === 'register');
      hideMsg();
    };

    window.showForgotPassword = () => {
      document.getElementById('form-login').classList.add('hidden');
      document.getElementById('form-forgot').classList.remove('hidden');
      document.getElementById('tab-login').classList.remove('active');
    };

    function showMsg(text, type = 'error') {
      const el = document.getElementById('msg');
      el.textContent = text;
      el.className = `message ${type}`;
      el.style.display = 'block';
    }
    function hideMsg() {
      document.getElementById('msg').style.display = 'none';
    }

    function setLoading(btnId, loading) {
      const btn = document.getElementById(btnId);
      btn.disabled = loading;
      btn.textContent = loading ? 'Lütfen bekleyin...' : btn.dataset.label || btn.textContent;
    }

    // Login
    window.handleLogin = async () => {
      const email = document.getElementById('login-email').value.trim();
      const password = document.getElementById('login-password').value;
      if (!email || !password) return showMsg('E-posta ve şifre zorunlu.');
      setLoading('btn-login', true);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading('btn-login', false);
      if (error) return showMsg(error.message === 'Invalid login credentials' ? 'E-posta veya şifre hatalı.' : 'Giriş başarısız.');
      window.location.href = '/';
    };

    // Register
    window.handleRegister = async () => {
      const email = document.getElementById('reg-email').value.trim();
      const password = document.getElementById('reg-password').value;
      const consent = document.getElementById('consent-check').checked;
      if (!email || !password) return showMsg('E-posta ve şifre zorunlu.');
      if (password.length < 8) return showMsg('Şifre en az 8 karakter olmalı.');
      if (!consent) return showMsg('Devam etmek için kullanım şartlarını kabul etmeniz gerekiyor.');
      setLoading('btn-register', true);
      const { data, error } = await supabase.auth.signUp({ email, password });
      setLoading('btn-register', false);
      if (error) return showMsg('Kayıt başarısız: ' + (error.message || ''));
      if (data.user && !data.session) {
        showMsg('E-posta adresinize doğrulama linki gönderildi.', 'success');
      } else {
        // Consent kaydet
        await fetch('/consent-accept', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId: data.user.id })
        });
        window.location.href = '/';
      }
    };

    // Şifremi unuttum
    window.handleForgotPassword = async () => {
      const email = document.getElementById('forgot-email').value.trim();
      if (!email) return showMsg('E-posta adresi zorunlu.');
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/auth.html'
      });
      if (error) return showMsg('İşlem başarısız.');
      showMsg('Şifre sıfırlama linki gönderildi.', 'success');
    };

    // Social login
    window.handleSocial = async (provider) => {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: window.location.origin + '/' }
      });
      if (error) showMsg('Sosyal giriş başarısız.');
    };

    // Enter tuşu desteği
    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Enter') return;
      const loginVisible = !document.getElementById('form-login').classList.contains('hidden');
      const registerVisible = !document.getElementById('form-register').classList.contains('hidden');
      if (loginVisible) window.handleLogin();
      else if (registerVisible) window.handleRegister();
    });
  </script>
</body>
</html>
```

- [ ] **4.2 — Commit**

```bash
git add public/auth.html
git commit -m "feat: auth.html — login/register/social (Google, Facebook, Apple)"
```

---

### Görev 5: index.html Auth Guard

**Dosyalar:**
- Düzenle: `public/index.html` — giriş kontrolü, token header'a ekle

- [ ] **5.1 — index.html başına auth guard ekle**

`index.html`'deki ilk `<script>` bloğuna veya ayrı `<script type="module">` olarak en başa ekle:

```html
<script type="module">
  // Auth guard — giriş yapılmamışsa auth.html'e yönlendir
  const configResp = await fetch('/config');
  const { supabaseUrl, supabaseAnonKey } = await configResp.json();
  const { createClient } = await import(`https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm`);
  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/auth.html';
  }

  // Token'ı global erişim için sakla
  window.__supabase = supabase;
  window.__getAuthHeader = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {};
  };

  // Token expire olunca auth.html'e yönlendir
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.href = '/auth.html';
  });

  // Logout butonu (varsa)
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.href = '/auth.html';
  });
</script>
```

- [ ] **5.2 — API çağrılarına Authorization header ekle**

`index.html`'deki tüm `fetch('/...')` çağrılarına header ekle:

```javascript
// ESKİ:
fetch('/memory', { method: 'GET' })

// YENİ:
const authHeaders = await window.__getAuthHeader();
fetch('/memory', { method: 'GET', headers: { ...authHeaders } })
```

- [ ] **5.3 — body'den userId göndermeyi kaldır**

`index.html`'deki tüm `{ userId: ... }` içeren fetch body'lerinden userId'yi kaldır — artık sunucu JWT'den alıyor.

- [ ] **5.4 — Commit**

```bash
git add public/index.html
git commit -m "feat: index.html auth guard + Authorization header + userId body'den kaldırıldı"
```

---

## Chunk 3: Vercel & Supabase Kurulumu (Manuel Adımlar)

### Görev 6: Supabase OAuth Provider Kurulumu

Bu adımlar Supabase Dashboard'da manuel yapılır — kod değişikliği yok.

- [ ] **6.1 — Supabase JWT Secret'ı al**

Supabase Dashboard → Project Settings → API → **JWT Secret** kopyala → `.env` ve Vercel'e `SUPABASE_JWT_SECRET` olarak ekle.

- [ ] **6.2 — Google OAuth**

1. [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → OAuth 2.0 Client ID oluştur
2. Authorized redirect URI: `https://<supabase-project-ref>.supabase.co/auth/v1/callback`
3. Client ID ve Secret'ı kopyala
4. Supabase Dashboard → Authentication → Providers → Google → aktif et, credentials gir

- [ ] **6.3 — Facebook OAuth**

1. [developers.facebook.com](https://developers.facebook.com) → My Apps → Create App → Consumer
2. Facebook Login ürününü ekle → Settings → Valid OAuth Redirect URIs: Supabase callback URL
3. App ID ve Secret → Supabase → Providers → Facebook

- [ ] **6.4 — Apple OAuth**

1. [developer.apple.com](https://developer.apple.com) → Certificates, Identifiers & Profiles → Sign in with Apple
2. Service ID oluştur, domain ve redirect URI ekle
3. Key oluştur, private key indir
4. Supabase → Providers → Apple → tüm bilgileri gir

- [ ] **6.5 — Vercel Environment Variables**

Vercel Dashboard → Project → Settings → Environment Variables'a ekle:

| Key | Değer |
|-----|-------|
| `SUPABASE_JWT_SECRET` | Supabase JWT Secret |
| `VAPI_WEBHOOK_SECRET` | Vapi Dashboard → Webhook Secret |
| `FRONTEND_URL` | `https://<proje>.vercel.app` |

- [ ] **6.6 — index.html route'u auth.html'e yönlendir**

`vercel.json` dosyasında (yoksa oluştur):
```json
{
  "rewrites": [
    { "source": "/", "destination": "/index.html" },
    { "source": "/auth", "destination": "/auth.html" }
  ]
}
```

- [ ] **6.7 — Commit & Deploy**

```bash
git add .env vercel.json
git commit -m "config: Supabase JWT secret, Vapi webhook secret, Vercel env vars"
git push
```

---

## Notlar

- **Supabase Auth e-posta doğrulaması:** Dashboard → Authentication → Email → "Confirm email" açık kalabilir. Test için kapatılabilir.
- **Apple OAuth** en karmaşık olanı — Apple Developer hesabı gerektirir, ücretli üyelik ($99/yıl). Olmadan skip edilebilir.
- **Test:** `verifyAuth` middleware eklenince mevcut `/api/chat/completions` endpoint'i de korunuyor — frontend'den bu isteğe de Authorization header eklenmeli.
