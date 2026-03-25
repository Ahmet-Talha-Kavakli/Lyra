# Lyra Kusursuzlaştırma — Tam İmplementasyon Planı

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lyra'yı yasal uyumlu, güvenli, klinik kalitede ve terapötik olarak üstün bir AI asistana dönüştürmek — gerçek bir terapisti uygulamada geride bırakacak seviyeye çıkarmak.

**Architecture:** Mevcut Node.js/Express/Supabase stack korunur. Her görev bağımsız, kademeli iyileştirme. Yasal riskler (consent, disclaimer, veri gizliliği) önce; terapötik kalite sonra.

**Tech Stack:** Node.js ESM, Express 5, Supabase, OpenAI GPT-4o-mini, Vapi, Azure TTS, Vanilla JS frontend

---

## ÖNCELİK SIRASI

Görevler 4 gruba ayrılır:

| Grup | Kapsam | Neden Önce |
|------|--------|-----------|
| **A — Yasal Zorunluluk** | Consent, disclaimer, KVKK/GDPR, veri silme | Yasal sorumluluk sıfırlanmadan hiçbir şey |
| **B — Güvenlik Altyapısı** | Helmet, CORS, auth middleware, rate limit düzeltme | Kullanıcı verisi korunmadan ölçeklenemez |
| **C — Terapötik Kalite** | Duygu okuma, derinlik, çok-dönüşlü bağlam, sözel olmayan | Ürünün kalitesi |
| **D — Deneyim & Özerklik** | İlerleme görselleştirme, onboarding, erişilebilirlik | Kullanıcıyı tutan şey |

---

## GRUP A — YASAL ZORUNLULUK

---

### Görev A1: Kullanıcı Onay (Consent) Sistemi

**Neden:** Türkiye KVKK Madde 3, 5, 11 — kişisel ve sağlık verisi işlemek için açık rıza zorunlu. Psikolojik veriler "özel nitelikli kişisel veri" (KVKK Madde 6) — daha sıkı kural.

**Dosyalar:**
- Oluştur: `public/consent.html`
- Düzenle: `public/index.html` — login öncesi consent check
- Oluştur: `public/js/consent.js`
- Düzenle: `server.js` — `POST /consent-accept` endpoint
- Düzenle: Supabase — `user_consents` tablosu (SQL)

**Adımlar:**

- [ ] **A1.1 — Supabase tablosu oluştur**

Supabase SQL Editor'da çalıştır:
```sql
CREATE TABLE IF NOT EXISTS user_consents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_version VARCHAR(10) NOT NULL DEFAULT '1.0',
  accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address VARCHAR(45),
  user_agent TEXT,
  consent_text_hash VARCHAR(64), -- SHA256 of the displayed consent text
  UNIQUE(user_id, consent_version)
);

-- RLS
ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kullanıcı kendi onayını görebilir" ON user_consents
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Kullanıcı onay ekleyebilir" ON user_consents
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

- [ ] **A1.2 — Consent endpoint ekle (server.js)**

`server.js`'e aşağıdaki endpoint'i ekle (diğer POST endpoint'lerinin yanına):

```javascript
// ─── KULLANICI ONAYI ─────────────────────────────────────────
app.post('/consent-accept', async (req, res) => {
    const { userId, consentVersion = '1.0' } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId zorunlu' });

    const { error } = await supabase.from('user_consents').upsert({
        user_id: userId,
        consent_version: consentVersion,
        ip_address: req.ip,
        user_agent: req.headers['user-agent']?.substring(0, 500) || null,
        accepted_at: new Date().toISOString()
    }, { onConflict: 'user_id,consent_version' });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
});

app.get('/consent-status', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.json({ hasConsent: false });

    const { data } = await supabase.from('user_consents')
        .select('accepted_at, consent_version')
        .eq('user_id', userId)
        .eq('consent_version', '1.0')
        .single();

    res.json({ hasConsent: !!data, acceptedAt: data?.accepted_at });
});
```

- [ ] **A1.3 — Consent modal HTML (public/index.html içine)**

`index.html`'de login box'ın ÜSTÜNE consent overlay ekle:

```html
<!-- KVKK ONAY MODALI -->
<div id="consent-overlay" style="display:none; position:fixed; inset:0; z-index:9999;
     background:rgba(4,3,2,0.96); align-items:center; justify-content:center; padding:20px;">
  <div style="background:rgba(16,11,7,0.98); border:1px solid rgba(200,169,110,0.3);
       border-radius:16px; max-width:540px; width:100%; padding:36px; max-height:86vh;
       overflow-y:auto; display:flex; flex-direction:column; gap:20px;">

    <div style="display:flex; align-items:center; gap:12px;">
      <span style="font-size:1.8rem;">🔒</span>
      <div>
        <h2 style="margin:0; color:#c8a96e; font-size:1.1rem; font-weight:400; letter-spacing:0.04em;">
          Gizlilik ve Kullanım Onayı
        </h2>
        <p style="margin:4px 0 0; font-size:11px; color:rgba(200,180,140,0.5); letter-spacing:0.08em;">
          KVKK Kapsamında Bilgilendirme
        </p>
      </div>
    </div>

    <div style="font-size:13px; color:rgba(240,230,210,0.75); line-height:1.7; display:flex;
         flex-direction:column; gap:14px;">

      <p><strong style="color:#c8a96e;">Lyra nedir?</strong><br>
      Lyra, psikolojik destek odaklı bir yapay zeka asistanıdır. Lyra bir terapist değildir ve
      klinik tanı koyamaz, ilaç öneremez. Profesyonel psikolojik destek için bir uzmanla
      görüşmenizi öneririz.</p>

      <p><strong style="color:#c8a96e;">Hangi veriler işlenir?</strong><br>
      Konuşma içerikleriniz, duygusal durum analizleriniz ve oturum özetleriniz güvenli
      sunucularda şifrelenmiş olarak saklanır. Bu veriler yalnızca size daha iyi destek
      sunmak amacıyla kullanılır; üçüncü taraflarla paylaşılmaz.</p>

      <p><strong style="color:#c8a96e;">Kriz durumlarında ne olur?</strong><br>
      Ciddi risk sinyali algılandığında Lyra sizi acil destek hattına (182 — Psikososyal
      Destek Hattı) yönlendirir. Lyra bir acil müdahale servisi değildir.</p>

      <p><strong style="color:#c8a96e;">Haklarınız (KVKK Madde 11):</strong><br>
      Verilerinize erişme, düzeltme, silme ve işlemeye itiraz etme hakkınız vardır.
      Hesap silme talebinizi uygulama üzerinden iletebilirsiniz.</p>

      <p><strong style="color:#c8a96e;">18 Yaş Sınırı:</strong><br>
      Lyra yalnızca 18 yaş ve üzeri kullanıcılar içindir. Devam ederek 18 yaşında veya
      üzerinde olduğunuzu onaylıyorsunuz.</p>

    </div>

    <label style="display:flex; align-items:flex-start; gap:12px; cursor:pointer; padding:14px;
           background:rgba(200,169,110,0.06); border:1px solid rgba(200,169,110,0.15);
           border-radius:10px;">
      <input type="checkbox" id="consent-checkbox" style="margin-top:2px; accent-color:#c8a96e;">
      <span style="font-size:12.5px; color:rgba(240,230,210,0.8); line-height:1.55;">
        Yukarıdaki bilgilendirmeyi okudum ve anladım. Verilerimin belirtilen amaçlarla
        işlenmesine <strong>açıkça onay veriyorum</strong>. Lyra'nın bir yapay zeka
        olduğunu ve profesyonel tıbbi/psikolojik hizmet sunmadığını kabul ediyorum.
      </span>
    </label>

    <button id="consent-accept-btn" disabled
            style="padding:14px; background:rgba(200,169,110,0.15); border:1px solid rgba(200,169,110,0.3);
                   border-radius:10px; color:rgba(200,169,110,0.5); font-size:0.85rem;
                   cursor:not-allowed; transition:all 0.2s; letter-spacing:0.06em;">
      Onaylıyorum ve Devam Ediyorum
    </button>
  </div>
</div>
```

- [ ] **A1.4 — Consent JS mantığı (public/index.html script bölümüne)**

```javascript
// Consent sistemi
async function checkConsent(userId) {
    const res = await fetch(`/consent-status?userId=${userId}`);
    const data = await res.json();
    return data.hasConsent;
}

async function acceptConsent(userId) {
    await fetch('/consent-accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, consentVersion: '1.0' })
    });
}

function showConsentModal(onAccept) {
    const overlay = document.getElementById('consent-overlay');
    overlay.style.display = 'flex';
    const checkbox = document.getElementById('consent-checkbox');
    const btn = document.getElementById('consent-accept-btn');

    checkbox.addEventListener('change', () => {
        btn.disabled = !checkbox.checked;
        btn.style.background = checkbox.checked ? 'rgba(200,169,110,0.25)' : 'rgba(200,169,110,0.15)';
        btn.style.color = checkbox.checked ? '#c8a96e' : 'rgba(200,169,110,0.5)';
        btn.style.cursor = checkbox.checked ? 'pointer' : 'not-allowed';
    });

    btn.addEventListener('click', async () => {
        if (!checkbox.checked) return;
        overlay.style.display = 'none';
        onAccept();
    });
}

// Login sonrası consent kontrol — login fonksiyonuna entegre et:
// const hasConsent = await checkConsent(userId);
// if (!hasConsent) { showConsentModal(async () => { await acceptConsent(userId); /* devam */ }); }
```

- [ ] **A1.5 — Login akışına entegre et**

`index.html`'deki mevcut login success callback'inde (kullanıcı giriş yaptıktan hemen sonra):

```javascript
// Login başarılı olduktan sonra, chat'i açmadan önce:
const hasConsent = await checkConsent(user.id);
if (!hasConsent) {
    showConsentModal(async () => {
        await acceptConsent(user.id);
        // Mevcut chat başlatma kodunu buraya al
        initializeChat(user);
    });
} else {
    initializeChat(user);
}
```

- [ ] **A1.6 — Commit**
```bash
git add public/index.html server.js
git commit -m "feat: KVKK onay sistemi — consent modal, endpoint, Supabase tablosu"
```

---

### Görev A2: Gizlilik Politikası ve Kullanım Şartları

**Neden:** KVKK Madde 10 — aydınlatma yükümlülüğü. Kullanıcı veri işleme amacını bilmeden onay geçersiz sayılır.

**Dosyalar:**
- Oluştur: `public/privacy.html`
- Oluştur: `public/terms.html`
- Düzenle: `public/index.html` — footer linkleri
- Düzenle: `server.js` — static route'lar

**Adımlar:**

- [ ] **A2.1 — Privacy Policy sayfası (public/privacy.html)**

Sayfa şu başlıkları içermeli:
1. Veri Sorumlusu bilgileri
2. İşlenen kişisel veriler ve kategorileri (psikolojik veri = özel nitelikli)
3. İşleme amaçları ve hukuki dayanağı (KVKK 5/2-a açık rıza)
4. Veri saklama süreleri (seans verileri: hesap silinene kadar)
5. Veri güvenliği önlemleri
6. Yurt dışı aktarım (OpenAI/Azure — ABD)
7. KVKK 11. madde hakları
8. İletişim / başvuru yolu
9. Çerez politikası (None — cookie kullanılmıyor)
10. Güncelleme tarihi

Kritik paragraflar:

```html
<!-- Yurt dışı aktarım bölümü (ZORUNLU) -->
<section>
  <h2>Yurt Dışına Veri Aktarımı</h2>
  <p>
    Lyra, yapay zeka hizmetleri için OpenAI LLC (ABD) ve ses sentezi için
    Microsoft Azure (ABD/AB) ile çalışmaktadır. Konuşma verileriniz bu servisler
    aracılığıyla işlenmektedir. Bu aktarım, KVKK Madde 9 kapsamında açık rızanıza
    dayanmaktadır. OpenAI ve Microsoft'un veri işleme politikaları için ilgili
    şirketlerin gizlilik sayfalarını inceleyebilirsiniz.
  </p>
</section>

<!-- Psikolojik veri uyarısı (ZORUNLU) -->
<section>
  <h2>Özel Nitelikli Kişisel Veri</h2>
  <p>
    Psikolojik durum, duygusal hal ve ruh sağlığına ilişkin veriler KVKK Madde 6
    kapsamında "özel nitelikli kişisel veri" sayılır. Bu verilerin işlenmesi için
    açık rızanız alınmaktadır. Bu verileri silme talebinizi istediğiniz zaman
    iletebilirsiniz.
  </p>
</section>
```

- [ ] **A2.2 — Terms of Service (public/terms.html)**

Kritik maddeler:
1. Hizmetin yapay zeka olduğu ve profesyonel tıbbi/psikolojik hizmet olmadığı
2. 18 yaş sınırı
3. Kullanıcı sorumlulukları (yanlış bilgi vermeme, kötüye kullanmama)
4. Lyra'nın kriz durumlarında ne yapacağı
5. **Sorumluluk sınırlaması:** Lyra'nın önerilerinden doğabilecek sonuçlardan sorumluluk kabul edilmediği
6. Hesap silme ve veri taşınabilirliği
7. Türk hukuku geçerlilik maddesi

```html
<!-- Sorumluluk sınırlaması — ZORUNLU -->
<section>
  <h2>Sorumluluk Sınırlaması</h2>
  <p>
    Lyra bir yapay zeka destekli psikolojik destek aracıdır. Klinik tanı, tedavi
    ya da ilaç önerisi sunmaz; sunulan içerikler profesyonel psikolojik danışmanlık
    veya psikiyatrik hizmetin yerini tutmaz. Ciddi ruh sağlığı sorunları, kriz
    durumları veya acil durumlarda lütfen bir uzman veya acil yardım hizmetleriyle
    iletişime geçin (182 — Psikososyal Destek Hattı).
  </p>
  <p>
    Hizmetin kullanımından doğabilecek zararlar için Lyra ve geliştiricileri
    sorumluluk kabul etmez.
  </p>
</section>
```

- [ ] **A2.3 — Footer linkleri (public/index.html)**

```html
<!-- Chat ekranında footer -->
<div style="position:fixed; bottom:6px; left:0; right:0; text-align:center;
     font-size:10px; color:rgba(200,180,140,0.3); z-index:100; pointer-events:none;">
  <span style="pointer-events:auto;">
    <a href="/privacy.html" target="_blank"
       style="color:rgba(200,180,140,0.35); text-decoration:none;">Gizlilik</a>
    &nbsp;·&nbsp;
    <a href="/terms.html" target="_blank"
       style="color:rgba(200,180,140,0.35); text-decoration:none;">Kullanım Şartları</a>
    &nbsp;·&nbsp;
    <span>Lyra bir yapay zekadır, terapist değildir</span>
  </span>
</div>
```

- [ ] **A2.4 — Server route'ları (static serving zaten çalışıyor)**

`express.static('public')` zaten `/privacy.html` ve `/terms.html`'yi serve eder. Ekstra route gerekmez. Test et:
```bash
# Local test
curl http://localhost:3001/privacy.html | head -5
curl http://localhost:3001/terms.html | head -5
```

- [ ] **A2.5 — Commit**
```bash
git add public/privacy.html public/terms.html public/index.html
git commit -m "feat: gizlilik politikası ve kullanım şartları — KVKK uyumu"
```

---

### Görev A3: Veri Silme & GDPR/KVKK Hak Kullanımı

**Neden:** KVKK Madde 11/e — silme hakkı. "Sağ olunma" hakkı kapsamında kullanıcı tüm verisinin silinmesini talep edebilir.

**Dosyalar:**
- Düzenle: `server.js` — `DELETE /delete-my-data` endpoint
- Düzenle: `public/index.html` — ayarlar menüsüne "Hesabımı Sil" butonu

**Adımlar:**

- [ ] **A3.1 — Veri silme endpoint'i (server.js)**

```javascript
// ─── VERİ SİLME (KVKK Madde 11/e) ──────────────────────────
app.delete('/delete-my-data', async (req, res) => {
    const { userId, confirmPhrase } = req.body;

    // Double confirm
    if (!userId || confirmPhrase !== 'VERİLERİMİ SİL') {
        return res.status(400).json({
            error: 'Silme için confirmPhrase alanına tam olarak "VERİLERİMİ SİL" yazın'
        });
    }

    const errors = [];
    const deleted = [];

    const tables = [
        'psychological_profiles',
        'session_records',
        'emotion_logs',
        'memories',
        'crisis_logs',
        'knowledge_usage_logs',
        'progress_metrics',
        'technique_effectiveness',
        'user_consents',
    ];

    for (const table of tables) {
        const { error } = await supabase.from(table).delete().eq('user_id', userId);
        if (error) errors.push(`${table}: ${error.message}`);
        else deleted.push(table);
    }

    // pattern memory ayrı tablo adı olabilir
    await supabase.from('user_profiles').delete().eq('user_id', userId).catch(() => {});

    console.log(`[DATA DELETE] userId: ${userId} — ${deleted.length} tablo temizlendi`);

    if (errors.length > 0) {
        return res.status(207).json({ partialSuccess: true, deleted, errors });
    }

    res.json({ success: true, deleted, message: 'Tüm verileriniz silindi.' });
});
```

- [ ] **A3.2 — Veri dışa aktarma endpoint'i (KVKK 11/ç)**

```javascript
// ─── VERİ DIŞA AKTARMA (KVKK Madde 11/ç) ───────────────────
app.get('/export-my-data', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId zorunlu' });

    const exportData = {};

    const tables = [
        'psychological_profiles',
        'session_records',
        'progress_metrics',
    ];

    for (const table of tables) {
        const { data } = await supabase.from(table).select('*').eq('user_id', userId);
        exportData[table] = data || [];
    }

    res.setHeader('Content-Disposition', 'attachment; filename="lyra-data-export.json"');
    res.setHeader('Content-Type', 'application/json');
    res.json({
        export_date: new Date().toISOString(),
        user_id: userId,
        data: exportData,
        note: 'Bu dosya KVKK Madde 11/ç kapsamında kişisel veri dışa aktarımıdır.'
    });
});
```

- [ ] **A3.3 — Hesap silme UI (index.html — ayarlar)**

Mevcut ayarlar menüsünde (veya profile section'da):

```html
<div id="danger-zone" style="border-top:1px solid rgba(200,0,0,0.15); padding-top:16px; margin-top:16px;">
  <p style="font-size:11px; color:rgba(240,100,100,0.6); margin-bottom:10px;">
    Tehlikeli Alan — Bu işlem geri alınamaz
  </p>
  <button id="delete-data-btn"
          style="padding:10px 18px; background:rgba(200,0,0,0.08);
                 border:1px solid rgba(200,0,0,0.2); border-radius:8px;
                 color:rgba(240,100,100,0.7); font-size:12px; cursor:pointer;">
    Tüm Verilerimi Sil (KVKK)
  </button>
  <button id="export-data-btn"
          style="padding:10px 18px; background:rgba(200,169,110,0.06);
                 border:1px solid rgba(200,169,110,0.15); border-radius:8px;
                 color:rgba(200,169,110,0.6); font-size:12px; cursor:pointer; margin-left:8px;">
    Verilerimi İndir
  </button>
</div>

<script>
document.getElementById('delete-data-btn')?.addEventListener('click', async () => {
    const confirm1 = window.confirm('Tüm psikolojik profil, seans geçmişi ve hafıza verileriniz kalıcı olarak silinecek. Devam etmek istiyor musunuz?');
    if (!confirm1) return;
    const phrase = window.prompt('Onaylamak için "VERİLERİMİ SİL" yazın:');
    if (phrase !== 'VERİLERİMİ SİL') return;

    const res = await fetch('/delete-my-data', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUserId, confirmPhrase: phrase })
    });
    const data = await res.json();
    if (data.success) {
        alert('Tüm verileriniz silindi. Oturumunuz kapatılıyor.');
        window.location.reload();
    }
});

document.getElementById('export-data-btn')?.addEventListener('click', () => {
    window.open(`/export-my-data?userId=${currentUserId}`, '_blank');
});
</script>
```

- [ ] **A3.4 — Commit**
```bash
git add server.js public/index.html
git commit -m "feat: KVKK veri silme ve dışa aktarma hakları — DELETE /delete-my-data, GET /export-my-data"
```

---

### Görev A4: "Lyra Bir Yapay Zekadır" Sürekli Hatırlatıcı

**Neden:** Türkiye'de sağlık alanında yapay zeka hizmetlerinin "tıbbi cihaz" sayılmaması için sınırlama beyanları kritik. Ayrıca etik AI prensipleri (kullanıcı AI ile konuştuğunu bilmeli).

**Dosyalar:**
- Düzenle: `config.js` — system prompt'a yasal disclaimer satırı
- Düzenle: `public/index.html` — chat başlığına küçük "AI" badge

**Adımlar:**

- [ ] **A4.1 — System prompt'a yasal sınır ekle (config.js veya promptBuilder.js)**

`therapy/promptBuilder.js` içindeki `identity` bölümüne ekle:

```javascript
const identity = `Senin adın Lyra. Sen psikolojik destek odaklı bir yapay zeka asistanısın.

ÖNEMLİ SINIRLAR (HER ZAMAN GEÇERLİ):
- Klinik tanı koyamazsın, ilaç öneremezsin, tedavi planı oluşturamazsın.
- Psikiyatrik değerlendirme yerine geçemezsin.
- Ciddi kriz durumlarında profesyonel destek için yönlendir (182 hattı).
- Seni bir AI olarak tanıtan herhangi bir soruya dürüstçe cevap ver.

Temel prensibin: Söylemek değil, hissettirmek. Cevap vermek değil, doğru soruyu sormak. Çözmek değil, kişinin kendi çözümüne ulaşmasını sağlamak.`;
```

- [ ] **A4.2 — Chat UI'da AI badge**

Chat başlığında (avatar/isim yanında):

```html
<span style="font-size:9px; background:rgba(200,169,110,0.12); border:1px solid rgba(200,169,110,0.2);
     color:rgba(200,169,110,0.5); padding:2px 7px; border-radius:100px; letter-spacing:0.08em;
     vertical-align:middle; margin-left:6px;">YAPAY ZEKA</span>
```

- [ ] **A4.3 — Periyodik in-chat disclaimer**

Her 20 mesajda bir Lyra şunu söyler (server.js'de sayaç):

```javascript
// /api/chat/completions içinde, mesaj sayacı kontrolü
const messageCount = messages.filter(m => m.role === 'assistant').length;
if (messageCount > 0 && messageCount % 20 === 0) {
    const disclaimerNote = `\n\n[SİSTEM NOTU — KULLANICIYA GÖSTER]: Lyra bir yapay zeka destekli psikolojik destek aracıdır. Profesyonel psikolojik yardım için bir uzmanla görüşmenizi hatırlatır. Acil durumlar için: 182 (Psikososyal Destek Hattı).`;
    dynamicSystemPrompt += disclaimerNote;
}
```

- [ ] **A4.4 — Commit**
```bash
git add therapy/promptBuilder.js public/index.html server.js
git commit -m "feat: AI kimlik beyanı — system prompt sınırlar, UI badge, periyodik disclaimer"
```

---

## GRUP B — GÜVENLİK ALTYAPISI

---

### Görev B1: Helmet + CORS Düzeltme

**Neden:** XSS, clickjacking, MIME sniffing, CORS açıkları.

**Dosyalar:**
- Düzenle: `package.json` — helmet bağımlılığı
- Düzenle: `server.js` — helmet + cors config

**Adımlar:**

- [ ] **B1.1 — Helmet kur**
```bash
npm install helmet
```

- [ ] **B1.2 — server.js'e helmet ve CORS config ekle**

Mevcut `app.use(cors())` satırını değiştir:

```javascript
import helmet from 'helmet';

// Helmet — güvenlik başlıkları
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net", "fonts.googleapis.com"],
            styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
            fontSrc: ["'self'", "fonts.gstatic.com"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "*.supabase.co", "api.openai.com", "api.vapi.ai"],
            mediaSrc: ["'self'", "blob:"],
            workerSrc: ["'self'", "blob:"],
        }
    },
    crossOriginEmbedderPolicy: false, // Three.js için gerekli
}));

// CORS — sadece izin verilen originler
const ALLOWED_ORIGINS = [
    process.env.FRONTEND_URL || 'http://localhost:3001',
    'https://lyra.vercel.app', // production URL buraya
    'https://vapi.ai',          // Vapi origin
    /\.vercel\.app$/,           // Vercel preview deployments
];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin) return callback(null, true); // Curl/Postman gibi araçlar
        const allowed = ALLOWED_ORIGINS.some(o =>
            typeof o === 'string' ? o === origin : o.test(origin)
        );
        callback(null, allowed);
    },
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));
```

- [ ] **B1.3 — .env'e FRONTEND_URL ekle**
```
FRONTEND_URL=https://lyra-siyah.vercel.app
```

- [ ] **B1.4 — Commit**
```bash
git add server.js package.json package-lock.json
git commit -m "feat: helmet middleware + CORS konfigürasyonu"
```

---

### Görev B2: Rate Limit Güvenlik Açığı Düzeltme

**Neden:** `skip: (req) => !req.body?.userId` — userId göndermeden rate limit atlanabiliyor.

**Dosyalar:**
- Düzenle: `server.js` — rate limit konfigürasyonları

**Adımlar:**

- [ ] **B2.1 — Rate limit skip kaldır, global chat rate limit ekle**

```javascript
// Duygu analizi — skip kaldır, IP bazlı fallback ekle
const emotionRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 30,
    keyGenerator: (req) => req.body?.userId || req.ip,
    // skip kaldırıldı
    handler: (req, res) => {
        res.status(429).json({ duygu: 'sakin', guven: 0, yuz_var: false, rate_limited: true });
    }
});

const humeRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    keyGenerator: (req) => req.body?.userId || req.ip,
    // skip kaldırıldı
    handler: (req, res) => {
        res.status(429).json({ hume_scores: null, rate_limited: true });
    }
});

// CHAT endpoint için rate limit (YENİ)
const chatRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 60, // 60 mesaj/dakika — kriz anında çok mesaj gönderebilir
    keyGenerator: (req) => {
        const messages = req.body?.messages || [];
        const userId = messages[0]?.content?.match(/userId:(\S+)/)?.[1];
        return userId || req.ip;
    },
    handler: (req, res) => {
        res.status(429).json({ error: 'Çok fazla mesaj gönderildi, lütfen bekleyin.' });
    }
});

// /api/chat/completions'a uygula
app.post('/api/chat/completions', chatRateLimit, async (req, res) => { ... });
```

- [ ] **B2.2 — Commit**
```bash
git add server.js
git commit -m "fix: rate limit güvenlik açığı — skip kaldırıldı, chat rate limit eklendi"
```

---

### Görev B3: Input Sanitizasyon

**Neden:** Prompt injection, XSS, uzun mesaj DDoS riski.

**Dosyalar:**
- Düzenle: `server.js` — mesaj uzunluk kontrolü, temel sanitizasyon

**Adımlar:**

- [ ] **B3.1 — Mesaj sanitizasyon fonksiyonu**

```javascript
// ─── INPUT SANİTİZASYON ──────────────────────────────────────
function sanitizeMessage(content) {
    if (typeof content !== 'string') return '';
    // Uzunluk sınırı
    if (content.length > 4000) content = content.substring(0, 4000);
    // Null byte temizle
    content = content.replace(/\0/g, '');
    // Unicode direction override temizle (sağdan sola metin atağı)
    content = content.replace(/[\u202A-\u202E\u2066-\u2069]/g, '');
    return content.trim();
}

function sanitizeMessages(messages) {
    if (!Array.isArray(messages)) return [];
    if (messages.length > 100) messages = messages.slice(-100); // Son 100 mesaj
    return messages.map(m => ({
        role: m.role === 'user' || m.role === 'assistant' || m.role === 'system' ? m.role : 'user',
        content: sanitizeMessage(m.content || '')
    }));
}
```

- [ ] **B3.2 — /api/chat/completions başında sanitize çağır**

```javascript
app.post('/api/chat/completions', chatRateLimit, async (req, res) => {
    const { model, temperature, max_tokens, call } = req.body;
    const messages = sanitizeMessages(req.body.messages);
    // ... devam
```

- [ ] **B3.3 — Commit**
```bash
git add server.js
git commit -m "feat: input sanitizasyon — uzunluk sınırı, null byte, unicode override koruması"
```

---

## GRUP C — TERAPÖTİK KALİTE

---

### Görev C1: Duygu Tespiti Kalitesi — Çok Kelimeli ve Bağlamsal

**Mevcut sorun:** "kaygı" kelimesi tek başına kaygı duygusu sayılıyor. "kaygılanma!" veya "kaygı yok" gibi durumlar yanlış sınıflandırılıyor.

**Dosyalar:**
- Düzenle: `server.js` — `detectEmotion()` fonksiyonu

**Adımlar:**

- [ ] **C1.1 — Gelişmiş detectEmotion fonksiyonu**

```javascript
const EMOTION_MAP = {
    üzüntü: {
        phrases: ['çok üzgünüm', 'ağlıyorum', 'kırıldım', 'içim sıkıştı', 'boğuluyorum'],
        keywords: ['üzgün', 'üzüldüm', 'ağladım', 'keder', 'mutsuz', 'hüzün', 'acı'],
        weight: 1.0
    },
    kaygı: {
        phrases: ['panik atak', 'nefes alamıyorum', 'her şeyden korkuyorum', 'sürekli endişeleniyorum'],
        keywords: ['kaygı', 'endişe', 'korku', 'panik', 'tedirgin', 'stres', 'anksiyete', 'gergin'],
        weight: 1.0
    },
    öfke: {
        phrases: ['çok sinirleniyorum', 'dayanamıyorum buna', 'nefret ediyorum'],
        keywords: ['sinirli', 'kızgın', 'öfkeli', 'kızdım', 'bezdim', 'bıktım'],
        weight: 1.0
    },
    utanç: {
        phrases: ['çok utandım', 'yerin dibine geçtim', 'mahcup hissediyorum'],
        keywords: ['utanç', 'utandım', 'mahcup', 'rezil', 'küçüldüm'],
        weight: 1.0
    },
    yalnızlık: {
        phrases: ['kimse anlamıyor beni', 'yapayalnızım', 'kimsem yok'],
        keywords: ['yalnız', 'izole', 'dışlanmış', 'görmezden', 'terk'],
        weight: 1.0
    },
    tükenmişlik: {
        phrases: ['artık devam edemiyorum', 'her şeyden bıktım', 'enerjim kalmadı'],
        keywords: ['tükendim', 'yoruldum', 'bitik', 'enerjisiz', 'motivasyonsuz'],
        weight: 1.0
    },
    umut: {
        phrases: ['daha iyi hissediyorum', 'bir şeyler değişti', 'umut var'],
        keywords: ['iyi', 'güzel', 'mutlu', 'sevinçli', 'heyecanlı', 'umutlu'],
        weight: 0.8
    },
    karmaşa: {
        phrases: ['ne hissettğimi bilmiyorum', 'kafam çok karışık', 'anlayamıyorum kendimi'],
        keywords: ['karmaşık', 'karışık', 'belirsiz', 'anlayamıyorum'],
        weight: 0.9
    },
};

// Basit negasyon listesi
const NEGATIONS = ['değil', 'yok', 'hayır', 'istemiyorum', 'etmiyorum', 'hissetmiyorum', 'olmaz', 'hiç'];

function hasNegationBefore(words, idx, window = 4) {
    const start = Math.max(0, idx - window);
    for (let i = start; i < idx; i++) {
        if (NEGATIONS.some(n => words[i].includes(n))) return true;
    }
    return false;
}

function detectEmotion(message) {
    if (!message) return 'sakin';
    const lower = message.toLowerCase();
    const words = lower.split(/\s+/);
    const scores = {};

    for (const [emotion, data] of Object.entries(EMOTION_MAP)) {
        let score = 0;

        // Phrase matching (ağırlıklı)
        for (const phrase of data.phrases) {
            if (lower.includes(phrase)) score += 2.5 * data.weight;
        }

        // Keyword matching (negasyon kontrolü ile)
        for (const keyword of data.keywords) {
            const idx = words.findIndex(w => w.includes(keyword));
            if (idx !== -1 && !hasNegationBefore(words, idx)) {
                score += 1.0 * data.weight;
            }
        }

        if (score > 0) scores[emotion] = score;
    }

    if (Object.keys(scores).length === 0) return 'sakin';
    return Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
}
```

- [ ] **C1.2 — Commit**
```bash
git add server.js
git commit -m "feat: detectEmotion — phrase matching, negasyon kontrolü, ağırlıklı scoring"
```

---

### Görev C2: Çok-Dönüşlü Bağlam Takibi (Cross-Turn Memory)

**Mevcut sorun:** Her mesajda bağlam yeniden kurulur. "Annem dedi ki..." 5 mesaj sonra unutulabilir.

**Dosyalar:**
- Oluştur: `therapy/contextTracker.js`
- Düzenle: `server.js` — `/api/chat/completions`'da kullan

**Adımlar:**

- [ ] **C2.1 — Context tracker modülü oluştur**

```javascript
// therapy/contextTracker.js
// Seans içi bağlam: adlar, konular, duygusal yoğunluk

/**
 * Son N mesajdan seans bağlamı çıkarır.
 * Kişi adları, tekrarlayan konular, duygusal ark.
 */
export function buildSessionContext(messages, maxMessages = 20) {
    if (!messages?.length) return '';

    const recent = messages.slice(-maxMessages);
    const userMessages = recent.filter(m => m.role === 'user').map(m => m.content || '');

    if (userMessages.length === 0) return '';

    const allText = userMessages.join(' ').toLowerCase();

    // İsim tespiti (basit: büyük harf ile başlayan, kısa kelimeler)
    const namePattern = /\b([A-ZÇĞİÖŞÜ][a-zçğışöüa-z]{2,12})\b/g;
    const rawNames = [...(userMessages.join(' ').matchAll(namePattern) || [])].map(m => m[1]);
    const uniqueNames = [...new Set(rawNames)].slice(0, 5);

    // Tekrarlayan konular
    const TOPIC_KEYWORDS = {
        'anne/baba': ['annem', 'babam', 'ailem', 'ebeveyn'],
        'iş': ['işim', 'patronum', 'meslek', 'kariyer'],
        'ilişki': ['sevgilim', 'eşim', 'partner', 'ayrılık'],
        'özgüven': ['başaramıyorum', 'yetersiz', 'değersiz'],
        'gelecek': ['gelecek', 'hedef', 'plan', 'üniversite'],
        'yas/kayıp': ['kaybettim', 'vefat', 'yas', 'özlüyorum'],
    };

    const mentionedTopics = [];
    for (const [topic, keys] of Object.entries(TOPIC_KEYWORDS)) {
        if (keys.some(k => allText.includes(k))) mentionedTopics.push(topic);
    }

    // Duygusal ark (ilk mesaj vs son mesaj)
    const firstEmotion = detectEmotionFromText(userMessages[0] || '');
    const lastEmotion = detectEmotionFromText(userMessages[userMessages.length - 1] || '');
    const emotionArc = firstEmotion !== lastEmotion
        ? `${firstEmotion} → ${lastEmotion}`
        : firstEmotion;

    const parts = [];
    if (uniqueNames.length > 0) parts.push(`Seansta bahsedilen isimler: ${uniqueNames.join(', ')}`);
    if (mentionedTopics.length > 0) parts.push(`Tekrarlayan konular: ${mentionedTopics.join(', ')}`);
    if (emotionArc) parts.push(`Duygusal ark: ${emotionArc}`);

    if (parts.length === 0) return '';
    return `## SEANS BAĞLAMI\n${parts.map(p => `- ${p}`).join('\n')}`;
}

function detectEmotionFromText(text) {
    const lower = text.toLowerCase();
    if (['üzgün', 'ağlı', 'kırıl'].some(k => lower.includes(k))) return 'üzüntü';
    if (['kaygı', 'endişe', 'korku', 'panik'].some(k => lower.includes(k))) return 'kaygı';
    if (['sinirli', 'kızgın', 'öfke'].some(k => lower.includes(k))) return 'öfke';
    if (['tükend', 'yorul', 'bitik'].some(k => lower.includes(k))) return 'tükenmişlik';
    if (['iyi', 'güzel', 'mutlu'].some(k => lower.includes(k))) return 'umut';
    return 'sakin';
}
```

- [ ] **C2.2 — server.js'e import et ve inject et**

```javascript
import { buildSessionContext } from './therapy/contextTracker.js';

// /api/chat/completions içinde, dinamik prompt'tan sonra:
const sessionContext = buildSessionContext(messages);
if (sessionContext) {
    dynamicSystemPrompt += '\n\n' + sessionContext;
}
```

- [ ] **C2.3 — Commit**
```bash
git add therapy/contextTracker.js server.js
git commit -m "feat: seans bağlamı takibi — isimler, tekrarlayan konular, duygusal ark"
```

---

### Görev C3: Konuşma Kalitesi Otomatik Değerlendirme (Post-Session)

**Neden:** Lyra'nın cevap kalitesini ölçmek için metriklere ihtiyaç var — klişe kullanımı, soru sayısı, cevap uzunluğu.

**Dosyalar:**
- Oluştur: `progress/qualityAnalyzer.js`
- Düzenle: `server.js` — seans sonu çağrısı

**Adımlar:**

- [ ] **C3.1 — Kalite analizörü oluştur**

```javascript
// progress/qualityAnalyzer.js
// Lyra'nın cevap kalitesini otomatik değerlendirir.

const CLICHE_PHRASES = [
    'bu çok normal', 'kendine iyi bak', 'her şey yoluna girecek',
    'merak etme', 'geçer', 'güçlüsün', 'yapabilirsin',
    'seni anlıyorum', 'haklısın', 'tabii ki'
];

const MAX_RESPONSE_LENGTH = 400; // karakter
const MIN_RESPONSE_LENGTH = 20;

/**
 * Lyra cevaplarını analiz eder, kalite skoru döner.
 * @param {Array} messages — tüm seans mesajları
 * @returns {{ score: number, issues: string[], strengths: string[] }}
 */
export function analyzeResponseQuality(messages) {
    const assistantMessages = messages.filter(m => m.role === 'assistant');
    if (assistantMessages.length === 0) return { score: null, issues: [], strengths: [] };

    const issues = [];
    const strengths = [];
    let totalScore = 100;

    for (const msg of assistantMessages) {
        const content = (msg.content || '').replace(/\[DUYGU:\w+\]/g, '').trim();
        const lower = content.toLowerCase();

        // Klişe kontrolü
        const usedCliches = CLICHE_PHRASES.filter(c => lower.includes(c));
        if (usedCliches.length > 0) {
            totalScore -= usedCliches.length * 5;
            issues.push(`Klişe kullanım: ${usedCliches.join(', ')}`);
        }

        // Uzunluk kontrolü
        if (content.length > MAX_RESPONSE_LENGTH) {
            totalScore -= 8;
            issues.push(`Uzun cevap (${content.length} karakter)`);
        }

        // Birden fazla soru kontrolü
        const questionCount = (content.match(/\?/g) || []).length;
        if (questionCount > 1) {
            totalScore -= 10;
            issues.push(`Birden fazla soru (${questionCount} soru işareti)`);
        }

        // "Neden?" kullanımı
        if (lower.includes('neden ') || lower.includes('niye ')) {
            totalScore -= 5;
            issues.push('"Neden?" yerine "Ne oldu?" kullanılmalı');
        }

        // Reflective listening kalıpları (iyi)
        const reflectives = ['hissettirmiş', 'duyuyorum', 'anlıyorum ki', 'demek ki seni'];
        if (reflectives.some(r => lower.includes(r))) {
            strengths.push('Yansıtıcı dinleme');
        }
    }

    return {
        score: Math.max(0, Math.min(100, totalScore)),
        issues: [...new Set(issues)].slice(0, 5),
        strengths: [...new Set(strengths)]
    };
}
```

- [ ] **C3.2 — Seans sonunda kalite analizi yap**

`server.js`'de seans sonu `setImmediate` bloğuna ekle:

```javascript
// Konuşma kalitesi değerlendirmesi (sessizce logla)
try {
    const { analyzeResponseQuality } = await import('./progress/qualityAnalyzer.js');
    const quality = analyzeResponseQuality(capturedMessages);
    if (quality.score !== null) {
        console.log(`[QUALITY] Seans kalite skoru: ${quality.score}/100`);
        if (quality.issues.length > 0) {
            console.log(`[QUALITY] Sorunlar: ${quality.issues.join(' | ')}`);
        }
        // Supabase'e kaydet (opsiyonel — kalite metriklerini izlemek için)
        await supabase.from('session_records')
            .update({ quality_score: quality.score, quality_issues: quality.issues })
            .eq('session_id', sessionId);
    }
} catch (qErr) { /* sessiz */ }
```

- [ ] **C3.3 — Commit**
```bash
git add progress/qualityAnalyzer.js server.js
git commit -m "feat: konuşma kalitesi otomatik değerlendirme — klişe, uzunluk, soru sayısı"
```

---

### Görev C4: Konu Derinliği — GPT Destekli Topic Extraction

**Mevcut sorun:** `extractTopics()` keyword tabanlı ve sadece 9 kategori. "Annem benden çok şey bekliyor" → "aile" etiketleniyor ama "performans baskısı" veya "onay ihtiyacı" gibi nüanslar kaybolur.

**Dosyalar:**
- Düzenle: `server.js` — `extractTopics()` fonksiyonu geliştirilir (GPT-4o-mini fallback ile)
- Oluştur: `therapy/topicExtractor.js`

**Adımlar:**

- [ ] **C4.1 — Gelişmiş topic extractor modülü**

```javascript
// therapy/topicExtractor.js
import OpenAI from 'openai';
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Hızlı keyword tabanlı (her mesajda çalışır — ücretsiz)
const TOPIC_MAP = {
    aile: ['anne', 'baba', 'kardeş', 'ebeveyn', 'aile', 'evlilik', 'boşanma', 'çocuk'],
    ilişki: ['sevgili', 'eş', 'partner', 'ayrılık', 'kıskançlık', 'aldatma', 'romantik'],
    iş: ['iş', 'patron', 'meslek', 'kariyer', 'işsiz', 'meslektaş', 'terfi', 'maaş'],
    özgüven: ['kendime güvenmiyorum', 'yetersiz', 'başaramıyorum', 'değersiz', 'beceriksiz'],
    kayıp: ['kaybettim', 'vefat', 'öldü', 'yas', 'özlüyorum', 'ayrıldı'],
    gelecek: ['gelecek', 'hedef', 'plan', 'üniversite', 'karar', 'seçim'],
    geçmiş: ['çocukluğum', 'geçmişte', 'travma', 'acı veren', 'eskiden'],
    sağlık: ['hastalık', 'ağrı', 'doktor', 'tedavi', 'ilaç', 'uyku'],
    yalnızlık: ['yalnız', 'arkadaş yok', 'sosyal', 'izole', 'dışlanmış'],
    performans_baskısı: ['beklenti', 'başarmak zorunda', 'yeterli değilim', 'onaylansın'],
    kimlik: ['kim olduğumu', 'kendimi tanımıyorum', 'kimliğim', 'değerlerim'],
    bağımlılık: ['bırakamıyorum', 'kontrol edemiyorum', 'alışkanlık', 'bağımlı'],
};

/**
 * Hızlı keyword bazlı topic extraction — her mesajda çalışır
 */
export function extractTopicsQuick(text) {
    if (!text) return [];
    const lower = text.toLowerCase();
    return Object.entries(TOPIC_MAP)
        .filter(([, keywords]) => keywords.some(k => lower.includes(k)))
        .map(([topic]) => topic);
}

/**
 * Derin GPT bazlı topic extraction — seans sonunda çalışır
 * Daha nüanslı, psikolojik alt temalar bulur
 */
export async function extractTopicsDeep(transcript) {
    if (!transcript || transcript.length < 100) return [];

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: 'Terapi seansından psikolojik temaları çıkar. Yüzeysel konular değil, altta yatan psikolojik temalar. Sadece JSON array döndür.'
                },
                {
                    role: 'user',
                    content: `Transkript:\n${transcript.substring(0, 2000)}\n\nEn fazla 5 psikolojik tema döndür (Türkçe, kısa kelime grupları): ["tema1", "tema2", ...]`
                }
            ],
            temperature: 0.2,
            max_tokens: 150,
            response_format: { type: 'json_object' }
        });

        const data = JSON.parse(response.choices[0]?.message?.content || '{}');
        return Array.isArray(data.topics || data) ? (data.topics || data).slice(0, 5) : [];
    } catch {
        return [];
    }
}
```

- [ ] **C4.2 — server.js'de import ve kullan**

```javascript
import { extractTopicsQuick, extractTopicsDeep } from './therapy/topicExtractor.js';

// detectTopics fonksiyonunu kaldır, yerine:
const topics = extractTopicsQuick(recentMessages);

// Seans sonu setImmediate içinde:
const deepTopics = await extractTopicsDeep(transcript);
if (deepTopics.length > 0 && sessionAnalysis) {
    sessionAnalysis.topics = [...new Set([...(sessionAnalysis.topics || []), ...deepTopics])].slice(0, 5);
}
```

- [ ] **C4.3 — Commit**
```bash
git add therapy/topicExtractor.js server.js
git commit -m "feat: topic extraction — keyword quick + GPT deep (seans sonu), 12 kategori"
```

---

### Görev C5: Terapötik Hafıza — Seans Arası Köprü

**Mevcut sorun:** Bir sonraki seansa "geçen sefer bahsetmiştin" bağlantısı kuramıyor.

**Dosyalar:**
- Oluştur: `therapy/sessionBridge.js`
- Düzenle: `server.js` — prompt inject

**Adımlar:**

- [ ] **C5.1 — Session bridge modülü**

```javascript
// therapy/sessionBridge.js
// Önceki seanslardan bugüne taşınan bağlantılar

import { supabase } from '../lib/supabase.js';

/**
 * Son 3 seansın önemli öğelerini alır, bugünkü seansa köprü kurar.
 * @param {string} userId
 * @returns {string} Sistem promptuna eklenecek bağlam
 */
export async function buildSessionBridge(userId) {
    if (!userId) return '';

    try {
        const { data: sessions } = await supabase
            .from('session_records')
            .select('created_at, topics, homework, breakthrough_note, dominant_emotion, emotional_end_score')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(3);

        if (!sessions?.length) return '';

        const lines = ['## ÖNCEKİ SEANS BİLGİSİ (Doğal kullan, ayna gibi yansıt)'];

        const lastSession = sessions[0];
        if (lastSession) {
            const tarih = new Date(lastSession.created_at).toLocaleDateString('tr-TR');
            lines.push(`\nSon seans (${tarih}):`);

            if (lastSession.topics?.length > 0) {
                lines.push(`- Konuşulan konular: ${lastSession.topics.slice(0, 3).join(', ')}`);
            }
            if (lastSession.homework) {
                lines.push(`- Verilen ödev/pratik: "${lastSession.homework}"`);
                lines.push(`  → Bu seansa ödevin nasıl gittiğini doğal bir şekilde sor.`);
            }
            if (lastSession.breakthrough_note) {
                lines.push(`- Kırılma anı: "${lastSession.breakthrough_note}"`);
                lines.push(`  → Bu farkındalığı bu seansla ilişkilendirebilirsin.`);
            }
            if (lastSession.dominant_emotion) {
                lines.push(`- Baskın duygu: ${lastSession.dominant_emotion} (bitiş skoru: ${lastSession.emotional_end_score}/10)`);
            }
        }

        // Tekrarlayan temalar (son 3 seans)
        const allTopics = sessions.flatMap(s => s.topics || []);
        const topicCounts = allTopics.reduce((acc, t) => { acc[t] = (acc[t] || 0) + 1; return acc; }, {});
        const recurring = Object.entries(topicCounts)
            .filter(([, count]) => count >= 2)
            .map(([topic]) => topic);

        if (recurring.length > 0) {
            lines.push(`\nSon 3 seansın tekrarlayan temaları: ${recurring.join(', ')}`);
            lines.push(`→ Bu temalar için bugün bir adım atmaya alan aç.`);
        }

        return lines.join('\n');
    } catch {
        return '';
    }
}
```

- [ ] **C5.2 — server.js inject**

```javascript
import { buildSessionBridge } from './therapy/sessionBridge.js';

// /api/chat/completions içinde, progressContext'ten sonra:
const sessionBridge = await buildSessionBridge(userId);
if (sessionBridge) {
    dynamicSystemPrompt += '\n\n' + sessionBridge;
}
```

- [ ] **C5.3 — Commit**
```bash
git add therapy/sessionBridge.js server.js
git commit -m "feat: seans arası köprü — ödev takibi, tekrarlayan temalar, kırılma anı bağlantısı"
```

---

### Görev C6: Terapi Tekniği Etkinliği — Geri Bildirim Döngüsü

**Neden:** Hangi tekniğin bu kullanıcı için işe yarayıp yaramadığını öğrenmek.

**Dosyalar:**
- Düzenle: `server.js` — teknik etkinlik değerlendirmesini geliştirilmiş hale getir
- Düzenle: `therapy/therapyEngine.js` — teknik seçimde etkinlik ağırlığı artır

**Adımlar:**

- [ ] **C6.1 — Etkinlik skoru hesaplama mantığını güçlendir**

`server.js`'de seans sonu bloğunda:

```javascript
// Teknik etkinliği değerlendir
// Pozitif: duygusal skor arttı, breakthrough oldu
// Negatif: duygusal skor düştü
if (sessionAnalysis && capturedEngine?.techniques?.length > 0) {
    const startScore = sessionAnalysis.emotional_start_score || 5;
    const endScore = sessionAnalysis.emotional_end_score || 5;
    const breakthrough = sessionAnalysis.breakthrough_moment || false;

    const isPositive = (endScore > startScore + 1) || breakthrough;
    const isNegative = endScore < startScore - 1;

    for (const technique of (capturedEngine.techniques || [])) {
        if (isPositive || isNegative) {
            await updateTechniqueEffectiveness(userId, technique.id, isPositive);
        }
    }
}
```

- [ ] **C6.2 — Commit**
```bash
git add server.js
git commit -m "feat: teknik etkinlik değerlendirme — duygusal skor farkı + breakthrough sinyali"
```

---

## GRUP D — DENEYİM & ÖZERKLİK

---

### Görev D1: İlerleme Görselleştirme (Frontend)

**Neden:** Kullanıcı iyileştiğini görmeden motivasyonu düşer.

**Dosyalar:**
- Düzenle: `public/index.html` — ilerleme overlay
- Düzenle: `public/css/lyra.css` — progress styles
- Düzenle: `server.js` — `GET /my-progress` endpoint

**Adımlar:**

- [ ] **D1.1 — Progress endpoint**

```javascript
app.get('/my-progress', async (req, res) => {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId zorunlu' });

    const { data: sessions } = await supabase
        .from('session_records')
        .select('created_at, emotional_start_score, emotional_end_score, breakthrough_moment, topics, session_quality')
        .eq('user_id', userId)
        .order('created_at', { ascending: true })
        .limit(20);

    const { data: profile } = await supabase
        .from('psychological_profiles')
        .select('session_count, attachment_style, strengths')
        .eq('user_id', userId)
        .single();

    if (!sessions?.length) return res.json({ sessions: [], profile: null });

    // Duygusal eğri hesapla
    const emotionCurve = sessions.map(s => ({
        date: s.created_at,
        start: s.emotional_start_score || 5,
        end: s.emotional_end_score || 5,
        breakthrough: s.breakthrough_moment || false,
        quality: s.session_quality
    }));

    // Toplam breakthrough sayısı
    const totalBreakthroughs = sessions.filter(s => s.breakthrough_moment).length;

    // Ortalama iyileşme (son seans vs ilk seans)
    const first = sessions[0]?.emotional_end_score || 5;
    const last = sessions[sessions.length - 1]?.emotional_end_score || 5;
    const improvement = Math.round((last - first) * 10) / 10;

    res.json({
        emotionCurve,
        totalSessions: sessions.length,
        totalBreakthroughs,
        improvement,
        profile: {
            sessionCount: profile?.session_count || 0,
            attachmentStyle: profile?.attachment_style,
            strengthsCount: profile?.strengths?.length || 0
        }
    });
});
```

- [ ] **D1.2 — Progress butonu ve overlay (index.html)**

Mevcut history butonu yanına progress butonu:

```html
<button class="camera-btn" id="progress-btn" title="İlerleme">📈</button>
```

Overlay HTML (history overlay benzeri yapı):
```html
<div id="progress-overlay" class="overlay-base">
  <div id="progress-panel">
    <div id="progress-header">
      <!-- başlık + kapat -->
    </div>
    <div id="progress-content">
      <!-- JS ile doldurulacak -->
    </div>
  </div>
</div>
```

- [ ] **D1.3 — Progress JS**

```javascript
async function progressAc() {
    document.getElementById('progress-overlay').classList.add('active');
    const res = await fetch(`/my-progress?userId=${currentUserId}`);
    const data = await res.json();
    renderProgress(data);
}

function renderProgress(data) {
    const el = document.getElementById('progress-content');
    if (!data.totalSessions) {
        el.innerHTML = '<p style="text-align:center; color:var(--text-dim)">Henüz tamamlanan seans yok.</p>';
        return;
    }

    const improvementText = data.improvement > 0
        ? `+${data.improvement} puan iyileşme`
        : data.improvement < 0
        ? `${data.improvement} puan gerileme`
        : 'Stabil seyir';

    el.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:20px;">
        <div style="text-align:center; padding:16px; background:rgba(200,169,110,0.06); border:1px solid var(--border); border-radius:10px;">
          <div style="font-size:1.8rem; color:var(--accent);">${data.totalSessions}</div>
          <div style="font-size:11px; color:var(--text-muted); letter-spacing:0.06em; margin-top:4px;">SEANS</div>
        </div>
        <div style="text-align:center; padding:16px; background:rgba(112,200,150,0.06); border:1px solid rgba(112,200,150,0.2); border-radius:10px;">
          <div style="font-size:1.8rem; color:#a8e6c0;">${data.totalBreakthroughs}</div>
          <div style="font-size:11px; color:var(--text-muted); letter-spacing:0.06em; margin-top:4px;">KIRILIMLARI</div>
        </div>
        <div style="text-align:center; padding:16px; background:rgba(200,169,110,0.06); border:1px solid var(--border); border-radius:10px;">
          <div style="font-size:1.2rem; color:${data.improvement >= 0 ? '#a8e6c0' : '#e88'};">${improvementText}</div>
          <div style="font-size:11px; color:var(--text-muted); letter-spacing:0.06em; margin-top:4px;">DUYGUSAL EĞİM</div>
        </div>
      </div>

      <div style="font-size:12px; color:var(--text-muted); margin-bottom:10px; letter-spacing:0.06em;">
        DUYGUSAL YOLCULUK
      </div>
      <div id="emotion-chart" style="height:80px; display:flex; align-items:flex-end; gap:4px; padding:8px; background:rgba(255,255,255,0.02); border-radius:8px;">
        ${data.emotionCurve.map((s, i) => {
          const height = Math.round((s.end / 10) * 60);
          const color = s.breakthrough ? '#a8e6c0' : 'rgba(200,169,110,0.5)';
          return `<div style="flex:1; background:${color}; height:${height}px; border-radius:3px 3px 0 0; min-width:6px; transition:height 0.3s ${i * 0.05}s;"
                       title="${new Date(s.date).toLocaleDateString('tr-TR')}: ${s.end}/10${s.breakthrough ? ' 🌟' : ''}">
                  </div>`;
        }).join('')}
      </div>
    `;
}

document.getElementById('progress-btn')?.addEventListener('click', progressAc);
document.getElementById('progress-overlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'progress-overlay') e.target.classList.remove('active');
});
```

- [ ] **D1.4 — CSS (lyra.css)**

```css
/* Progress overlay — history-overlay ile aynı base */
#progress-overlay {
  display: none;
  position: fixed; inset: 0; z-index: 8800;
  background: rgba(4, 3, 2, 0.88);
  backdrop-filter: var(--blur-lg);
  align-items: center; justify-content: center;
  padding: 20px;
}
#progress-overlay.active { display: flex; }

#progress-panel {
  background: linear-gradient(145deg, rgba(16,11,7,0.97), rgba(10,7,4,0.99));
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  width: 100%; max-width: 580px;
  max-height: 80vh;
  display: flex; flex-direction: column;
  box-shadow: 0 32px 80px rgba(0,0,0,0.6);
  overflow: hidden;
  animation: scaleIn 0.3s ease both;
}
```

- [ ] **D1.5 — Commit**
```bash
git add public/index.html public/css/lyra.css server.js
git commit -m "feat: ilerleme görselleştirme — seans sayısı, kırılma anları, duygusal eğim grafiği"
```

---

### Görev D2: Gelişmiş Onboarding — İlk Seans Deneyimi

**Neden:** İlk izlenim kalıcıdır. Şu an onboarding sadece sistem prompt'ta "sıcak karşıla" talimatı var.

**Dosyalar:**
- Oluştur: `therapy/onboardingFlow.js`
- Düzenle: `server.js`

**Adımlar:**

- [ ] **D2.1 — Onboarding flow modülü**

```javascript
// therapy/onboardingFlow.js
// İlk 3 seansın her birine özel rehber

export const ONBOARDING_STAGES = {
    0: { // İlk mesaj
        name: 'Karşılama',
        instruction: `[İLK SEANS — KARŞILAMA AŞAMASI]
Bu kullanıcı Lyra'yı ilk kez kullanıyor. Şu sırayla ilerle:

ADIM 1 — SICAK KARŞILA (İlk mesaj):
"Merhaba. Buraya geldiğin için teşekkür ederim. Ben Lyra — seninle konuşmak, dinlemek ve birlikte düşünmek için buradayım. Yapay zeka olduğumu biliyorum, ama seni gerçekten duymaya çalışıyorum."

ADIM 2 — GİZLİLİK GÜVENCESI (İlk mesajda):
"Burada söylediklerin güvende. Yargılamak ya da tavsiye vermek için değil, anlamak için buradayım."

ADIM 3 — NEDENi SOR (İkinci cevap):
"Sana bugün en çok ne konusunda eşlik etmemi istersin?" — SADECE BU SORUYU SOR, başka hiçbir şey ekleme.

YASAK: Ödev verme, ağır teknikler, birden fazla soru, Lyra'nın yeteneklerini liste halinde sayma.`,
    },
    1: { // 2-5. mesajlar
        name: 'Keşif',
        instruction: `[İLK SEANS — KEŞİF AŞAMASI]
Kullanıcı açılmaya başlıyor. Güven inşa et.
- Yavaş, meraklı, yargısız
- "Bu konuyu daha önce biriyle konuştun mu?" gibi bağlantılar kur
- Güçlü yanlarını fark ettiğinde nazikçe yansıt
- Bu seansı bir terapötik ilişkinin başlangıcı gibi ele al, sprint gibi değil`,
    },
    2: { // 6-10. mesajlar
        name: 'Derinleşme',
        instruction: `[İLK SEANS — DERİNLEŞME AŞAMASI]
İlk seans sonuna doğru. Bir kırılma anı için alan aç.
- Konuşulan en önemli şeye nazikçe geri dön
- "Bugün paylaştıklarından bir tanesini seninle taşımak istiyorum..." gibi bağlantı kur
- Ödev yerine "Bu hafta kendine şunu sormana izin ver: ..." şeklinde çerçevele`,
    },
};

export function getOnboardingInstruction(messageCount) {
    if (messageCount <= 1) return ONBOARDING_STAGES[0].instruction;
    if (messageCount <= 5) return ONBOARDING_STAGES[1].instruction;
    if (messageCount <= 10) return ONBOARDING_STAGES[2].instruction;
    return null;
}
```

- [ ] **D2.2 — server.js entegrasyon**

```javascript
import { getOnboardingInstruction } from './therapy/onboardingFlow.js';

// /api/chat/completions içinde, mevcut onboarding inject'i bul ve güncelle:
if (toplamSeans === 0) {
    const msgCount = messages.filter(m => m.role === 'assistant').length;
    const onboardingInject = getOnboardingInstruction(msgCount);
    if (onboardingInject) {
        dynamicSystemPrompt += '\n\n' + onboardingInject;
    }
}
```

- [ ] **D2.3 — Commit**
```bash
git add therapy/onboardingFlow.js server.js
git commit -m "feat: onboarding flow — 3 aşamalı ilk seans rehberi (karşılama, keşif, derinleşme)"
```

---

### Görev D3: Erişilebilirlik — Türkiye Acil Hattı Entegrasyonu

**Neden:** Kriz anında kullanıcı hızla hatta ulaşabilmeli. Şu an 182 numarası metin olarak geçiyor.

**Dosyalar:**
- Düzenle: `public/index.html` — acil yardım floating button
- Düzenle: `public/css/lyra.css`

**Adımlar:**

- [ ] **D3.1 — Acil yardım floating button**

```html
<!-- Sağ alt köşe — her zaman görünür -->
<div id="emergency-btn" title="Acil Yardım Hattı"
     style="position:fixed; bottom:70px; right:20px; z-index:9000;
            width:42px; height:42px; border-radius:50%;
            background:rgba(200,0,0,0.15); border:1px solid rgba(200,0,0,0.3);
            display:flex; align-items:center; justify-content:center;
            cursor:pointer; transition:all 0.2s; font-size:16px;"
     onclick="document.getElementById('emergency-modal').style.display='flex'">
  🆘
</div>

<!-- Acil yardım modal -->
<div id="emergency-modal"
     style="display:none; position:fixed; inset:0; z-index:9999; background:rgba(4,3,2,0.92);
            align-items:center; justify-content:center; padding:20px;"
     onclick="if(event.target===this)this.style.display='none'">
  <div style="background:rgba(16,11,7,0.98); border:1px solid rgba(200,0,0,0.25);
       border-radius:16px; max-width:400px; width:100%; padding:32px; display:flex;
       flex-direction:column; gap:16px;">
    <h3 style="margin:0; color:#e88; font-size:1rem; font-weight:400; letter-spacing:0.04em;">
      Acil Yardım Hatları
    </h3>
    <div style="display:flex; flex-direction:column; gap:10px;">
      <a href="tel:182" style="display:flex; align-items:center; gap:12px; padding:14px;
         background:rgba(200,169,110,0.08); border:1px solid rgba(200,169,110,0.2);
         border-radius:10px; text-decoration:none; color:#c8a96e;">
        <span style="font-size:1.4rem;">📞</span>
        <div>
          <div style="font-size:1rem; font-weight:500;">182</div>
          <div style="font-size:11px; color:rgba(200,180,140,0.5);">Psikososyal Destek Hattı — 7/24</div>
        </div>
      </a>
      <a href="tel:112" style="display:flex; align-items:center; gap:12px; padding:14px;
         background:rgba(200,0,0,0.06); border:1px solid rgba(200,0,0,0.15);
         border-radius:10px; text-decoration:none; color:#e88;">
        <span style="font-size:1.4rem;">🚑</span>
        <div>
          <div style="font-size:1rem; font-weight:500;">112</div>
          <div style="font-size:11px; color:rgba(240,100,100,0.4);">Acil Yardım</div>
        </div>
      </a>
    </div>
    <p style="font-size:11px; color:rgba(200,180,140,0.35); margin:0; line-height:1.6;">
      Kendinize ya da başkasına zarar verme düşünceniz varsa lütfen hemen arayın.
    </p>
  </div>
</div>
```

- [ ] **D3.2 — Commit**
```bash
git add public/index.html public/css/lyra.css
git commit -m "feat: acil yardım floating button — 182 ve 112 tıklanabilir linkler"
```

---

### Görev D4: Kullanıcı Geri Bildirimi — Seans Değerlendirme

**Neden:** Kullanıcıdan kısa geri bildirim almak hem ürünü geliştirir hem kullanıcıya söz hakkı verir.

**Dosyalar:**
- Düzenle: `public/index.html` — seans sonu mini anket
- Düzenle: `server.js` — `POST /session-feedback` endpoint

**Adımlar:**

- [ ] **D4.1 — Session feedback endpoint**

```javascript
app.post('/session-feedback', async (req, res) => {
    const { userId, sessionId, rating, felt_heard, would_return, note } = req.body;
    if (!userId) return res.status(400).json({ error: 'userId zorunlu' });

    const { error } = await supabase.from('session_feedback').upsert({
        user_id: userId,
        session_id: sessionId || `fb_${Date.now()}`,
        rating: Math.min(5, Math.max(1, rating || 3)),
        felt_heard: !!felt_heard,
        would_return: !!would_return,
        note: (note || '').substring(0, 500),
        created_at: new Date().toISOString()
    }, { onConflict: 'session_id' });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ ok: true });
});
```

Supabase tablosu:
```sql
CREATE TABLE IF NOT EXISTS session_feedback (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id VARCHAR(100) NOT NULL,
  rating SMALLINT CHECK (rating BETWEEN 1 AND 5),
  felt_heard BOOLEAN,
  would_return BOOLEAN,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(session_id)
);
ALTER TABLE session_feedback ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Kullanıcı kendi geri bildirimlerini yönetir" ON session_feedback
  FOR ALL USING (auth.uid() = user_id);
```

- [ ] **D4.2 — Seans sonu mini anket UI**

Seans sonlandığında (kullanıcı seans bitir butonuna bastığında) göster:

```html
<div id="feedback-modal" style="display:none; position:fixed; inset:0; z-index:9500;
     background:rgba(4,3,2,0.88); align-items:center; justify-content:center; padding:20px;">
  <div style="background:rgba(16,11,7,0.98); border:1px solid var(--border);
       border-radius:16px; max-width:380px; width:100%; padding:28px; display:flex;
       flex-direction:column; gap:16px;">
    <h3 style="margin:0; color:var(--accent); font-size:1rem; font-weight:400; letter-spacing:0.04em;">
      Bu seans nasıl geçti?
    </h3>

    <!-- Yıldız rating -->
    <div id="star-rating" style="display:flex; gap:8px; justify-content:center; font-size:1.8rem;">
      ${[1,2,3,4,5].map(i => `<span data-val="${i}" style="cursor:pointer; opacity:0.3; transition:opacity 0.15s;">★</span>`).join('')}
    </div>

    <!-- Checkboxlar -->
    <label style="display:flex; gap:10px; align-items:center; cursor:pointer; font-size:13px; color:rgba(240,230,210,0.7);">
      <input type="checkbox" id="felt-heard-cb" style="accent-color:#c8a96e;">
      Kendimi duyulmuş hissettim
    </label>
    <label style="display:flex; gap:10px; align-items:center; cursor:pointer; font-size:13px; color:rgba(240,230,210,0.7);">
      <input type="checkbox" id="would-return-cb" style="accent-color:#c8a96e;">
      Geri dönmek isterim
    </label>

    <!-- Opsiyonel not -->
    <textarea id="feedback-note" placeholder="İstersen birkaç kelime ekleyebilirsin..."
              style="background:rgba(255,255,255,0.03); border:1px solid var(--border);
                     border-radius:8px; padding:10px; color:rgba(240,230,210,0.7);
                     font-size:12px; resize:none; height:60px; outline:none;">
    </textarea>

    <div style="display:flex; gap:10px;">
      <button id="skip-feedback" style="flex:1; padding:11px; background:transparent;
              border:1px solid var(--border); border-radius:8px; color:var(--text-dim);
              font-size:12px; cursor:pointer;">Atla</button>
      <button id="submit-feedback" style="flex:2; padding:11px; background:rgba(200,169,110,0.15);
              border:1px solid rgba(200,169,110,0.3); border-radius:8px; color:#c8a96e;
              font-size:12px; cursor:pointer;">Gönder</button>
    </div>
  </div>
</div>
```

- [ ] **D4.3 — Feedback JS**

```javascript
let selectedRating = 0;
document.querySelectorAll('#star-rating span').forEach(star => {
    star.addEventListener('click', () => {
        selectedRating = parseInt(star.dataset.val);
        document.querySelectorAll('#star-rating span').forEach((s, i) => {
            s.style.opacity = i < selectedRating ? '1' : '0.3';
        });
    });
});

document.getElementById('submit-feedback')?.addEventListener('click', async () => {
    await fetch('/session-feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            userId: currentUserId,
            rating: selectedRating || 3,
            felt_heard: document.getElementById('felt-heard-cb').checked,
            would_return: document.getElementById('would-return-cb').checked,
            note: document.getElementById('feedback-note').value
        })
    });
    document.getElementById('feedback-modal').style.display = 'none';
});

document.getElementById('skip-feedback')?.addEventListener('click', () => {
    document.getElementById('feedback-modal').style.display = 'none';
});
```

- [ ] **D4.4 — Commit**
```bash
git add public/index.html server.js
git commit -m "feat: seans geri bildirim sistemi — yıldız rating, duyulma hissi, Supabase kaydı"
```

---

## UYGULAMA SIRASI ÖZETİ

```
HAFTA 1 — YASAL ZORUNLULUK (A grubu):
  A1: Consent modal + endpoint + Supabase        → 2-3 saat
  A2: Privacy policy + Terms of service          → 3-4 saat
  A3: Veri silme + dışa aktarma                  → 2 saat
  A4: AI kimlik beyanı (sürekli hatırlatıcı)     → 1 saat

HAFTA 2 — GÜVENLİK (B grubu):
  B1: Helmet + CORS düzeltme                     → 1 saat
  B2: Rate limit güvenlik açığı                  → 30 dk
  B3: Input sanitizasyon                         → 1 saat

HAFTA 3 — TERAPÖTİK KALİTE (C grubu):
  C1: Duygu tespiti kalitesi                     → 2 saat
  C2: Çok-dönüşlü bağlam takibi                 → 2 saat
  C3: Konuşma kalitesi otomatik değerlendirme    → 2 saat
  C4: Konu derinliği (GPT destekli)              → 2 saat
  C5: Seans arası köprü                          → 2 saat
  C6: Teknik etkinlik geri bildirim döngüsü      → 1 saat

HAFTA 4 — DENEYİM (D grubu):
  D1: İlerleme görselleştirme                    → 3 saat
  D2: Gelişmiş onboarding                        → 2 saat
  D3: Acil yardım floating button                → 1 saat
  D4: Seans geri bildirimi                       → 2 saat
```

---

## YENİ DOSYA/MODÜL ENVANTERİ

| Yeni dosya | Sorumluluk |
|------------|-----------|
| `therapy/contextTracker.js` | Seans içi bağlam (isimler, ark, tekrarlayan temalar) |
| `therapy/topicExtractor.js` | Keyword + GPT topic extraction |
| `therapy/sessionBridge.js` | Seans arası köprü (ödev, breakthrough bağlantısı) |
| `therapy/onboardingFlow.js` | İlk 3 seans aşamalı onboarding |
| `progress/qualityAnalyzer.js` | Lyra cevap kalitesi değerlendirme |
| `public/privacy.html` | KVKK gizlilik politikası |
| `public/terms.html` | Kullanım şartları |

---

## YASAL RİSK MATRİSİ

| Risk | Mevcut Durum | Plan Sonrası |
|------|-------------|-------------|
| KVKK açık rıza eksikliği | ❌ YOK | ✅ Consent modal + DB kaydı |
| Özel nitelikli veri bildirimi | ❌ YOK | ✅ Privacy policy + aydınlatma |
| Veri silme hakkı | ❌ YOK | ✅ DELETE endpoint |
| Veri taşınabilirliği | ❌ YOK | ✅ Export endpoint |
| AI kimlik beyanı | ⚠️ Sadece prompt'ta | ✅ UI badge + periyodik disclaimer |
| Tıbbi tavsiye sorumluluktan kaçınma | ⚠️ Sadece prompt'ta | ✅ Terms + system prompt sınırları |
| 18 yaş sınırı | ❌ YOK | ✅ Consent modal |
| Yurt dışı aktarım bildirimi | ❌ YOK | ✅ Privacy policy |

---

*Plan hazırlandı: 2026-03-25*
*Toplam görev: 4 grup × ~17 görev = 17 iş paketi*
*Tahmini toplam süre: ~28-32 saat geliştirme*
