# Login Sayfası — Tasarım Spesifikasyonu

**Tarih:** 2026-03-27
**Durum:** Onaylandı
**Kapsam:** Lyra login/register sayfasının yeniden tasarımı — ayrı `public/login.html` olarak

---

## Problem

Mevcut login sistemi `public/index.html` içine gömülü bir overlay olarak çalışıyor. Bu yaklaşım:
- Ana sayfa yüklenmeden login gösterilemiyor
- Login ile uygulama kodu iç içe geçmiş durumda
- Tasarım iyileştirmesi yapmak zorlaşıyor

---

## Çözüm

Login/Register deneyimini ayrı bir `public/login.html` sayfasına taşı. Giriş başarılı olunca `index.html`'e yönlendir.

---

## Görsel Kimlik

| Özellik | Karar |
|---------|-------|
| Tema | Dark Gold — mevcut Lyra kimliği |
| Zemin | `#0a0806`, smokey WebGL canvas efekti (mevcut `index.html`'den taşınır) |
| Kart | Glassmorphism — `rgba(14, 10, 6, 0.72)`, `backdrop-filter: blur`, altın border |
| Font | Outfit (Google Fonts, mevcut) |
| Aksan rengi | `#c8a96e` (primary), `#e8c99a` (accent) |

---

## Layout

Tam ekran tek panel:
```
[     smokey WebGL canvas arka plan     ]
[                                        ]
[    ┌──────────────────────────────┐    ]
[    │   ✦  LYRA                    │    ]
[    │   ─────────────────────────  │    ]
[    │   [E-posta input]            │    ]
[    │   [Devam Et]                 │    ]
[    │   ─── veya ──────────────── │    ]
[    │   [G] [f] []                │    ]
[    │                              │    ]
[    │   Psikolog girişi linki      │    ]
[    └──────────────────────────────┘    ]
```

Kart genişliği: max `420px`, mobilde `90vw`.

---

## Form Akışı (Akıllı Tek Form)

### Adım 1 — E-posta
- Tek alan: e-posta input
- Buton: "Devam Et"
- Submit'te Supabase'den hesap kontrolü yapılır
- Kontrol sırasında buton spinner'a dönüşür

### Adım 2a — Giriş modu (hesap varsa)
- `fadeUp` animasyonuyla şifre alanı açılır
- "Şifremi Unuttum" linki
- Buton: "Giriş Yap"

### Adım 2b — Kayıt modu (hesap yoksa)
- `fadeUp` animasyonuyla şu alanlar açılır: Ad Soyad, Şifre, Şifre Tekrar
- Şifre gücü göstergesi + kriterleri checklist (`c-len`, `c-upper`, `c-num`, `c-special`) — mevcut sistemden taşınır
- "✨ Güçlü şifre öner" butonu — kapsam içinde, mevcut sistemden taşınır
- Buton: "Hesap Oluştur"

### Hata durumları
- Yanlış şifre, ağ hatası vb. → kart hafif shake animasyonu + altın renkli hata mesajı
- Validasyon hataları inline gösterilir

---

## Sosyal Giriş (UI Only)

Form kartının altında ince ayırıcı çizgi (`────── veya ──────`) ardından 3 ikon buton:

| Provider | İkon | Davranış |
|----------|------|----------|
| Google | SVG G logosu | Tıklanınca toast: "Yakında aktif olacak" |
| Facebook | f | Tıklanınca toast: "Yakında aktif olacak" |
| Apple | SVG Apple logosu (inline SVG) | Tıklanınca toast: "Yakında aktif olacak" |

Butonlar yuvarlak, border `rgba(200,169,110,0.25)`, hover'da altın glow.

---

## Psikolog Girişi (UI Only)

Kartın en altında küçük, soluk link:

```
Psikolog musunuz? Profesyonel girişi için tıklayın
```

- Renk: `rgba(200,169,110,0.5)` — ikincil, dikkat çekmiyor
- Tıklanınca toast: "Yakında aktif olacak"
- `href="#"` — sayfa yönlendirmesi yok

---

## Animasyonlar

| Element | Animasyon |
|---------|-----------|
| Kart ilk yüklenme | `fadeUp` 0.6s ease |
| Form alanı açılma | `fadeUp` 0.3s ease (staggered) |
| Hata durumu | `shake` 0.4s — `lyra.css`'te tanımlı değil, `login.html` içi `<style>` bloğuna eklenir |
| Buton loading | spinner (border-radius döndürme) |
| Toast | mevcut `toastIn/toastOut` keyframe |

---

## Teknik Yapı

### Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `public/login.html` | **Yeni** — tam login/register sayfası |
| `public/index.html` | Login overlay ve ilgili JS kaldırılır; sayfa başında session kontrolü eklenir (session yoksa `/login.html`'e yönlendir); `body` `visibility:hidden` başlar |
| `server.js` | `POST /auth/check-email` endpoint'i eklenir |

### Hesap varlığı kontrolü

Supabase SDK'da "bu e-posta kayıtlı mı?" diye soran direkt bir API yok. Güvenli yaklaşım:

`server.js`'e yeni bir endpoint eklenir:
```
POST /auth/check-email   { email }  →  { exists: true/false }
```

Bu endpoint sunucu tarafında Supabase admin client ile çalışır ve hesap enumerasyonu riskini istemciden gizler. İstemci bu sonuca göre Adım 2a veya 2b'yi gösterir.

Sunucu implementasyonu: `supabase.auth.admin.getUserByEmail(email)` çağrısı yapılır. Kullanıcı bulunursa `{ exists: true }`, `UserNotFound` hatası alınırsa `{ exists: false }` döner. `server.js`'deki mevcut service-role client (satır ~231) kullanılır.

### Kayıt alanları

Adım 2b'de şu alanlar gösterilir: **Ad Soyad** (zorunlu), **Şifre**, **Şifre Tekrar**.
- Ad Soyad Supabase `user_metadata.full_name` alanına yazılır (`signUp` sırasında `options.data` ile)
- Telefon alanı bu sayfada **kaldırılıyor** — mevcut `index.html`'deki opsiyonel telefon alanı yeni tasarıma taşınmıyor

### Supabase entegrasyonu

`login.html` içinde:
1. `/config` endpoint'inden Supabase credentials alınır (mevcut pattern)
2. E-posta kontrolü için `POST /auth/check-email` çağrısı
3. Hesap varsa: `supabase.auth.signInWithPassword({ email, password })`
4. Hesap yoksa: `supabase.auth.signUp({ email, password, options: { data: { full_name } } })`
5. Başarılı giriş → `window.location.href = '/'`

### Şifremi Unuttum

"Şifremi Unuttum" linki `supabase.auth.resetPasswordForEmail(email)` çağırır — Supabase'in kendi e-posta akışını kullanır, ayrıca backend gerekmez. Link tıklanınca:
1. `resetPasswordForEmail` çağrısı yapılır
2. Başarılı olursa: "Şifre sıfırlama e-postası gönderildi" toast'u gösterilir
3. Hatalıysa: hata mesajı gösterilir

### Session kontrolü (`index.html`)

Flash önlemek için `index.html` başında `body` gizli başlatılır, session kontrolü tamamlanınca ya yönlendirme yapılır ya da body gösterilir:

```js
// body başlangıçta: style="visibility:hidden"
const { data: { session } } = await supabaseClient.auth.getSession();
if (!session) {
    window.location.href = '/login.html';
} else {
    document.body.style.visibility = 'visible';
    // ... uygulama başlatma
}
```

### CSS stratejisi

`login.html` `lyra.css`'i direkt import eder. `lyra.css` design token'larını (CSS variables, keyframe animasyonlar) içeriyor; `index.html`'e özel selectorlar olsa da bunlar login sayfasında sessizce eşleşmez ve zarar vermez. Ayrı `login.css` gerekmez.

`shake` keyframe `lyra.css`'te bulunmuyor — `login.html` içindeki `<style>` bloğuna eklenir.

### Static serving

`server.js` satır ~215'te `express.static('public')` aktif. `window.location.href = '/'` login sonrası `public/index.html`'i doğru serve eder — ek route gerekmez.

---

## Kapsam Dışı (Bu Spec'te Yok)

- Google/Facebook/Apple OAuth gerçek entegrasyonu (ileride ayrı spec)
- Psikolog dashboard ve gerçek psikolog girişi (ileride ayrı spec)
- Şifre sıfırlama sonrası yeni şifre belirleme sayfası (Supabase redirect URL'i için ayrı sayfa gerekir — ileride)
- Mobil uygulama

---

## Başarı Kriterleri

- `public/login.html` standalone çalışıyor — `index.html` yüklemeden erişilebilir
- Hesap var/yok tespiti doğru çalışıyor, form buna göre açılıyor
- Sosyal giriş butonları görünüyor, tıklanınca "Yakında aktif olacak" toast'u çıkıyor
- Psikolog girişi linki görünüyor, tıklanınca toast çıkıyor
- Giriş başarılı olunca `index.html`'e yönlendirme çalışıyor
- Session yoksa `index.html` → `login.html`'e yönlendiriyor
- Animasyonlar çalışıyor: fadeUp, shake, spinner
- Mevcut `lyra.css` design token'ları kullanılıyor
