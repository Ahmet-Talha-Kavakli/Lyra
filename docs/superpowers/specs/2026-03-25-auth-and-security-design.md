# Lyra — Auth & Güvenlik Sistemi Tasarımı

**Tarih:** 2026-03-25
**Kapsam:** Tam auth sistemi (kayıt/giriş/sosyal login) + güvenlik altyapısı
**Hedef:** 1000+ kullanıcıda sıfır kritik güvenlik açığı

---

## 1. Genel Mimari

```
[auth.html]  →  Supabase Auth  →  JWT token
     ↓                                ↓
[index.html] ←── redirect ────  token localStorage
     ↓
[server.js]  ←── Authorization: Bearer <JWT>
     ↓
verifyAuth() middleware  →  JWT decode  →  userId (server-side)
```

- Tüm auth işlemleri Supabase Auth üzerinden yürür
- Backend hiçbir zaman body/query'den userId almaz — her zaman JWT'den çıkarır
- Frontend ayrı `auth.html` sayfası olur; giriş yapılmadan `index.html`'e erişilemez

---

## 2. Auth Sayfası (auth.html)

**Tasarım:** 21st.dev dark minimal — Lyra renk paleti (`#0a0806` zemin, `#c8a96e` altın)

**Özellikler:**
- E-posta + şifre ile giriş ve kayıt (tek form, tab ile geçiş)
- Google, Facebook, Apple ile sosyal giriş (OAuth)
- Şifremi unuttum akışı (e-posta ile reset linki)
- KVKK onay checkbox'ı kayıt sırasında (zorunlu)
- Giriş yapılınca `index.html`'e yönlendir; token localStorage'a kayıt

**Güvenlik:**
- Supabase Auth tüm token yönetimini üstlenir (refresh, expire)
- Şifreler asla frontend/backend'e gelmez — direkt Supabase'e gider

---

## 3. Backend Auth Middleware

Her korumalı endpoint'e `verifyAuth` middleware eklenir:

```
Request gelir
  → Authorization header var mı?
  → Bearer token geçerli mi? (Supabase JWT verify)
  → userId = token.sub (UUID)
  → req.userId set edilir
  → next()
```

- userId artık `req.body.userId` veya `req.query.userId`'den değil, `req.userId`'den alınır
- Geçersiz token → 401 Unauthorized
- Token yoksa → 401

**Korunan endpoint'ler:** `/chat`, `/memory`, `/my-progress`, `/my-profile`, `/export-my-data`, `/delete-my-data`, `/session-history`, `/session-feedback`, `/emergency-contacts`, `/record-thought`, `/homework`, vb.

**Açık endpoint'ler (auth gerekmez):** `/ping`, `/config`, `/vapi-webhook`, `/consent-accept`

---

## 4. Vapi Webhook Güvenliği

Vapi her webhook isteğinde `x-vapi-signature` header'ı gönderir (HMAC-SHA256).

```
webhook gelir
  → x-vapi-signature header'ı al
  → HMAC-SHA256(secret, raw body) hesapla
  → imzalar eşleşiyor mu?
  → eşleşmiyorsa → 401 red
```

- `VAPI_WEBHOOK_SECRET` env variable olarak saklanır
- Raw body korunmalı (Express JSON parse öncesi)

---

## 5. CORS Düzeltmesi

Production'da sadece izinli origin'lere açık:

```javascript
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,        // Vercel production URL
  'https://*.vercel.app',          // Preview deployments
];
// Development'ta localhost eklenir
```

Mevcut "her origin geç" fallback kaldırılır.

---

## 6. CSP Düzeltmesi (Helmet)

`unsafe-eval` kaldırılır. Three.js gerektiriyorsa nonce tabanlı yaklaşım kullanılır.

```javascript
scriptSrc: ["'self'", "'unsafe-inline'"] // unsafe-eval kaldırıldı
```

---

## 7. Error Handling

`error.message` hiçbir endpoint'te client'a dönmez:

```javascript
// Kötü:
res.status(500).json({ error: error.message })
// İyi:
console.error('[ENDPOINT]', error);
res.status(500).json({ error: 'İşlem tamamlanamadı' })
```

---

## 8. Rate Limiting Tamamlama

Eksik olan endpoint'lere rate limit eklenir:

| Endpoint | Limit |
|----------|-------|
| `/vapi-webhook` | 30 req/dk/IP |
| `/memory` POST | 20 req/dk/user |
| `/delete-my-data` | 3 req/saat/user |
| `/export-my-data` | 5 req/saat/user |
| Auth endpoint'leri | Supabase tarafından yönetilir |

---

## 9. Supabase RLS Uyumu

Backend SERVICE_KEY kullandığından RLS bypass oluyor. Çözüm:

- Tüm Supabase sorgularına `.eq('user_id', req.userId)` filtresi eklenir (middleware'den gelen doğrulanmış userId)
- Bu şekilde RLS olmasa bile başka kullanıcının verisine erişilemez

---

## 10. Dosya Değişiklikleri

| Dosya | İşlem |
|-------|-------|
| `public/auth.html` | YENİ — login/register sayfası |
| `public/index.html` | DÜZENLE — auth check, userId body'den kaldır |
| `server.js` | DÜZENLE — verifyAuth middleware, userId → req.userId, CORS, CSP, error handling, rate limit |
| `.env` | DÜZENLE — VAPI_WEBHOOK_SECRET ekle |

---

## 11. Supabase OAuth Provider Kurulumu

Supabase Console → Authentication → Providers'da şunlar aktif edilir:

**Google:** Google Cloud Console'dan OAuth 2.0 Client ID + Secret alınır. Redirect URI: `https://<supabase-project>.supabase.co/auth/v1/callback`

**Facebook:** Meta Developer Console'dan App ID + Secret. Aynı redirect URI.

**Apple:** Apple Developer → Sign in with Apple. Service ID + private key. Aynı redirect URI.

Bu credentials Supabase Console'a girilir — backend'e gelmez.

---

## 12. Token & Session Yönetimi

- Supabase JS SDK `onAuthStateChange` ile token refresh otomatik yönetilir
- `supabase.auth.getSession()` ile aktif session kontrol edilir
- Access token expire olduğunda SDK otomatik refresh token kullanır
- Logout'ta: `supabase.auth.signOut()` çağrılır, localStorage temizlenir, `auth.html`'e yönlendirilir
- Backend'te her istekte JWT verify edilir — expire olmuş token → 401 → frontend yeniden login'e yönlendirir

---

## 13. CORS Spesifikasyonu

Wildcard yerine spesifik URL'ler:

```javascript
const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,           // Production: https://lyra-app.vercel.app
  process.env.FRONTEND_URL_PREVIEW,   // Preview deployment URL (opsiyonel)
  'http://localhost:3000',
  'http://localhost:5173',
].filter(Boolean);
```

---

## 14. Vercel Environment Variables

Vercel Dashboard → Project Settings → Environment Variables'a eklenmesi gerekenler:

| Key | Değer |
|-----|-------|
| `FRONTEND_URL` | `https://lyra-app.vercel.app` |
| `VAPI_WEBHOOK_SECRET` | Vapi Dashboard → Webhook Secret |
| Mevcut tüm .env değerleri | Zaten ekli olmalı |

---

## Kapsam Dışı

- Şifre politikası enforcement (Supabase halleder)
- 2FA / MFA (gelecek iterasyon)
- Audit log sistemi (gelecek iterasyon)
