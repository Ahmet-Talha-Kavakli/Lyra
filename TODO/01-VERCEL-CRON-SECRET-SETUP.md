# ⚙️ VERCEL'DE CRON_SECRET SETUP

## STATUS: ❌ YAPILMADI

---

## 📋 GÖREV ÖZETI

Vercel'deki cron job'ları çalıştırabilmesi için güvenlik token'ı (CRON_SECRET) oluşturmak ve environment variable'a eklemek.

---

## 📌 ADIMLAR (TAKİP LİSTESİ)

### Adım 1: CRON_SECRET Değeri Oluştur
- [ ] Terminal/command line'ı aç
- [ ] Şu komutu çalıştır:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] Çıkan değeri **kopyala ve güvende sakla** (bu bir seferlik)
- [ ] Örnek çıktı:
  ```
  a3b5c7d9e1f3a5b7c9d1e3f5a7b9c1d3e5f7a9b1c3d5e7f9a1b3c5d7e9f1a3
  ```

### Adım 2: Vercel Dashboard'a Git
- [ ] https://vercel.com'a git
- [ ] Lyra projesini aç
- [ ] **Settings** → **Environment Variables** tıkla

### Adım 3: Environment Variable Ekle
- [ ] "Add Environment Variable" butonuna tıkla
- [ ] Şu değerleri doldur:
  ```
  Name: CRON_SECRET
  Value: <Adım 1'den kopyaladığın değer>
  ```
- [ ] **Production** seçili olduğundan emin ol
- [ ] **Save** tıkla

### Adım 4: Yeni Deploy Trigger Et
- [ ] Vercel dashboard'da "Deployments" tıkla
- [ ] Son deployment'ın yanında **⋮** (three dots) tıkla
- [ ] **Redeploy** seç
- [ ] **Redeploy** confirm et
- [ ] Deploy tamamlanmasını bekle (~2-3 dakika)

### Adım 5: Test Et
- [ ] Gece 02:00 UTC'ye kadar bekle VEYA
- [ ] Manuel test için:
  ```bash
  curl -X GET https://lyra-domain.vercel.app/api/cron/autonomousSourceDiscovery \
    -H "x-vercel-cron: true" \
    -H "Authorization: Bearer <CRON_SECRET_value>"
  ```
- [ ] Yanıt: `{"success": true}` olmalı
- [ ] Eğer `401 Unauthorized` dönerse → Secret yanlış

---

## 🔍 DOĞRULAMA KONTROL LİSTESİ

Cron'ların gerçekten çalışıp çalışmadığını kontrol et:

- [ ] **Vercel Logs kontrol et:**
  - Vercel Dashboard → Deployments → Latest → Logs
  - Tarihe göre filtele: bugünün tarihi
  - Ara: `/api/cron/autonomousSourceDiscovery`
  - Status: **200** olmalı

- [ ] **Supabase'de kontrol et:**
  ```sql
  SELECT COUNT(*), source_type, DATE(created_at) as date
  FROM knowledge_sources
  GROUP BY source_type, DATE(created_at)
  ORDER BY date DESC
  LIMIT 10;
  ```
  - `source_type = 'autonomous_agent'` varsa → Cron çalışmış ✅

- [ ] **Redis kontrol et:**
  - Upstash dashboard'a git
  - `cron:autonomousSourceDiscovery` lock'u kontrol et
  - Varsa → Cron birkaç saat önce çalıştı

---

## ⚠️ SORUN GİDERME

### Problem: 401 Unauthorized hatası
**Çözüm:**
1. CRON_SECRET'in tam değerini kopyaladığından emin ol (boşluk yok)
2. Vercel'de doğru ortamda (Production) kayıtlı mı kontrol et
3. Yeni deploy yaptığından emin ol

### Problem: 500 Server Error
**Çözüm:**
1. Vercel logs'unda tam error message'ı oku
2. Supabase bağlantısı çalışıyor mu kontrol et
3. OpenAI API key tanımlı mı kontrol et

### Problem: Cron hiç çalıştığının belgesi yok
**Çözüm:**
1. Gece 02:00 UTC'ye kadar bekle (tam zamanında)
2. Vercel logs'u kontrol et (logs 24 saat tutuluyor)
3. Supabase'de `knowledge_sources` tablosunun son eklenme tarihini kontrol et

---

## 📞 REFERANSLAR

- Vercel Cron Jobs: https://vercel.com/docs/crons
- Vercel Environment Variables: https://vercel.com/docs/projects/environment-variables
- Lyra'daki cronSecurity: `lib/infrastructure/cronSecurity.ts`
- Lyra'daki cron endpoints: `api/cron/` klasörü

---

## ✅ TAMAMLAMA KRITERI

Bu görev tamamlanmış olarak işaretlenebilir:
- [ ] CRON_SECRET Vercel'de tanımlı
- [ ] En son deployment Production ortamında
- [ ] Logs'ta `/api/cron/autonomousSourceDiscovery` 200 response'ı görülüyor
- [ ] Supabase'de son 24 saatte `source_type = 'autonomous_agent'` kaynaklar var
