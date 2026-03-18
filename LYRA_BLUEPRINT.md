# MASTER BLUEPRINT v6.0 — Lyra AI Wellness Platform
## AI Execution Guide — Talha için

> **Bu döküman bir AI'a verilecek eksiksiz execution blueprint'idir.**
> Her bölüm, sıfırdan hayata geçirilebilecek düzeyde detaylandırılmıştır.
> Tasarım yönergelerini, kaynak listelerini ve teknik direktifleri içerir.

---

## 🏷️ BÖLÜM 0: UYGULAMA İSMİ SEÇİMİ

> **Mevcut isim "Kaira" değişecek. Aşağıdan seç:**

| # | İsim | Anlam | Ton | Neden Güçlü |
|---|------|-------|-----|-------------|
| 1 | **Lyra** | Takımyıldızı, müzikal, evrensel | Sakin, entelektüel | Tek heceli, logo-dostu, global |
| 2 | **Nura** | Arapça/Türkçe "ışık" | Sıcak, kapsayıcı | TR+MENA+EN markası için ideal |
| 3 | **Aura** | Zihinsel enerji alanı | Modern, premium | Wellness'ta evrensel anlam |
| 4 | **Mira** | Latince "harika", Slavca "barış" | Narin, uluslararası | Küresel pazarda tanıdık |
| 5 | **Ember** | Sıcak kor, içten gelen ışık | Rahatlatıcı, samimi | Duygusal rezonans yüksek |
| 6 | **Solace** | İngilizce "teselli, huzur" | Profesyonel, derin | Terapi alanında tanımlayıcı |
| 7 | **Zena** | Zen + modern imla | Minimalist, genç | App store'da eşsiz |
| 8 | **Elara** | Jüpiter'in uydusu, mitoloji | Mistik, farklı | Güçlü domain şansı |
| 9 | **Helia** | Güneş tanrıçası | Enerjik, sıcak | Pozitif psikoloji ile eşleşiyor |
| 10 | **Lumis** | "Luminosity" + "wisdom" fusion | Zeki, sofistike | AI-first imajı güçlü |

**Öneri:** `Lumis` (AI-wellness fusion), `Lyra` (global, premium), veya `Nura` (TR kökü + global)

---

## 🎯 BÖLÜM 1: PROJE GENEL BAKIŞ & AI DİREKTİFLERİ

### 1.1 Vizyon
Ruh sağlığı desteğini coğrafyadan, paradan ve bekleme listesinden bağımsız kılmak.
Dünyadaki her 1 milyar ruh sağlığı ihtiyacı olan insana 7/24 ulaşmak.

**Yasal Konum:** Lisanslı psikolojik tedavi DEĞIL — klinik protokollere dayalı kişisel gelişim koçluğu, psikoeğitim ve ruh sağlığı rehberliği.

### 1.2 AI Execution Direktifleri (Genel)

```
KURAL 1: Her UI bileşeni Tailwind CSS + shadcn/ui ile yaz
KURAL 2: Hiçbir zaman inline style kullanma
KURAL 3: Her sayfa mobile-first tasarla (önce 375px, sonra 1440px)
KURAL 4: Dark mode varsayılan olsun (light mode toggle ekle)
KURAL 5: Her animasyon Framer Motion kullan
KURAL 6: TypeScript strict mode — any kullanma
KURAL 7: Her API endpoint Zod ile validate et
KURAL 8: Supabase RLS (Row Level Security) her tabloda aktif olsun
KURAL 9: Error boundary her sayfa için implement et
KURAL 10: Web Vitals: LCP<2.5s, FID<100ms, CLS<0.1 hedefle
```

### 1.3 Tech Stack (Kesinleşmiş)

```
Frontend:    Next.js 15 (App Router) + TypeScript + Tailwind CSS v4
Components:  shadcn/ui + Radix UI + Aceternity UI
Animation:   Framer Motion + GSAP + Lottie React
3D:          Spline (spline.design) + Three.js (r3f)
State:       Zustand + TanStack Query v5
Forms:       React Hook Form + Zod
Icons:       Lucide React + Phosphor Icons
Fonts:       Geist Sans + Geist Mono (Vercel)

Backend:     Supabase (PostgreSQL + Auth + Storage + Realtime)
Cache:       Redis (Upstash)
Jobs:        Trigger.dev (background jobs)
Email:       Resend + React Email templates

AI/LLM:      GPT-4o (OpenAI) + Claude (fallback)
STT:         Whisper API (OpenAI)
TTS:         ElevenLabs (premium ses)
Voice:       VAPI.ai (real-time voice sessions)
Emotion:     Hume AI (duygu analizi)

Payments:    Stripe (subscription + one-time)
Deploy:      Vercel (frontend) + Railway (backend workers)
CDN:         Cloudflare R2 (media) + CloudFront (video)
Monitor:     Sentry + PostHog + Axiom (logs)
CI/CD:       GitHub Actions
```

---

## 🎨 BÖLÜM 2: TASARIM SİSTEMİ & UI/UX DİREKTİFLERİ

> **Hedef:** 2025-2026'nın en iyi wellness app tasarımı. Calm, Headspace, Linear seviyesi — ama daha modern.

### 2.1 Tasarım Felsefesi

```
TEK CÜMLELİK: "Liquid Glass meets Calm Brutalism"

- Liquid Glass: Translucent katmanlar, blur efektleri, yumuşak gradyanlar
- Calm Brutalism: Güçlü tipografi, bol whitespace, intentional contrast
- Sonuç: Hem sakin hem premium hem de güvenilir hissettiren UI
```

### 2.2 Renk Paleti (Dark Mode Primary)

```css
/* Primary Background */
--bg-base: #0A0A0F          /* Derin lacivert-siyah */
--bg-surface: #111118       /* Kart yüzeyi */
--bg-elevated: #1A1A24      /* Elevated elementler */

/* Accent (Seçilen isme göre değişecek) */
--accent-primary: #7C6FFF   /* İndigo-violet (sakin, premium) */
--accent-glow: #A78BFA      /* Parlak violet */
--accent-soft: #312E81      /* Derin violet */

/* Semantic */
--success: #10B981           /* Yeşil — pozitif mood */
--warning: #F59E0B           /* Amber — dikkat */
--danger: #EF4444            /* Kırmızı — kriz */
--info: #3B82F6              /* Mavi — bilgi */

/* Text */
--text-primary: #F8F8FF      /* Neredeyse beyaz */
--text-secondary: #9CA3AF    /* Gri */
--text-muted: #4B5563        /* Açıklama */
```

### 2.3 Tipografi

```
Ana Font: Geist Sans (Vercel — ücretsiz, modern)
  - H1: 72px / 900 weight (landing hero)
  - H2: 48px / 700 weight (section başlıkları)
  - H3: 32px / 600 weight (kart başlıkları)
  - Body: 16px / 400 weight
  - Small: 14px / 400 weight

Mono Font: Geist Mono (kod, metrikler)
Display Font (opsiyonel): Cal Sans (başlıklar için)

CDN: https://vercel.com/font
```

### 2.4 Tasarım Kaynakları & İlham

#### UI Bileşen Kütüphaneleri
| Kaynak | URL | Ne İçin |
|--------|-----|---------|
| **21st.dev** | https://21st.dev | AI-generated React components, hero sections, cards |
| **Aceternity UI** | https://ui.aceternity.com | Animated, premium UI components |
| **Magic UI** | https://magicui.design | Micro-animations, sparkles, gradients |
| **shadcn/ui** | https://ui.shadcn.com | Base component library (kuruluş) |
| **Origin UI** | https://originui.com | Modern component patterns |
| **cult/ui** | https://cult-ui.com | Unique, premium components |

#### Animasyon & 3D
| Kaynak | URL | Ne İçin |
|--------|-----|---------|
| **Spline** | https://spline.design | 3D web sahneleri, avatar preview |
| **LottieFiles** | https://lottiefiles.com | Micro-animation JSON files |
| **GSAP** | https://greensock.com | Complex timeline animations |
| **Framer Motion** | https://motion.dev | React animation library |
| **Theatre.js** | https://www.theatrejs.com | Sinematik animasyon |

#### Tasarım İlhamı
| Kaynak | URL | Ne İçin |
|--------|-----|---------|
| **Awwwards** | https://awwwards.com | Dünyanın en iyi web tasarımları |
| **Dribbble** | https://dribbble.com | UI mockup ilhamı |
| **Behance** | https://behance.net | Tam proje showcaseları |
| **Mobbin** | https://mobbin.com | Mobil app UI pattern'leri |
| **Screenlane** | https://screenlane.com | App UI detayları |
| **Godly** | https://godly.website | Animasyonlu web siteleri |

#### Tasarım Araçları
| Araç | URL | Kullanım |
|------|-----|---------|
| **Figma** | https://figma.com | Ana tasarım aracı |
| **Framer** | https://framer.com | Prototip + production site |
| **Spline** | https://spline.design | 3D interaktif sahneler |
| **Rive** | https://rive.app | Avatar animasyonları |
| **Jitter** | https://jitter.video | Video animasyonları |

#### İkon & Görsel
| Kaynak | URL | Ne İçin |
|--------|-----|---------|
| **Lucide** | https://lucide.dev | Ana ikon seti |
| **Phosphor Icons** | https://phosphoricons.com | Alternatif ikon seti |
| **Heroicons** | https://heroicons.com | Tailwind ile uyumlu |
| **SVG Repo** | https://svgrepo.com | SVG ikonlar |
| **Unsplash** | https://unsplash.com | Stock fotoğraflar |
| **Pexels** | https://pexels.com | Ücretsiz video/fotoğraf |

### 2.5 UI Bileşen Direktifleri (AI İçin)

```
HERO SECTION:
- Full viewport height (100svh)
- Animated gradient mesh background (Framer Motion veya CSS)
- Floating glass cards (backdrop-blur + border-white/10)
- Spline 3D avatar preview (embed iframe)
- CTA button: "Ücretsiz Başla" — büyük, glowing, animated
- Referans: https://21st.dev/components/hero → "glassmorphism hero"

NAVİGASYON:
- Sticky + blur backdrop (backdrop-blur-xl)
- Logo sol, linkler orta, CTA sağ
- Mobile: hamburger → full screen overlay menu
- Scroll'da: border-bottom belirginleşir

KARTLAR:
- bg-white/5 + border border-white/10 (glass effect)
- hover: scale(1.02) + border-white/20 (Framer Motion)
- padding: 24px (desktop), 16px (mobile)

BUTONLAR:
- Primary: gradient (violet → indigo) + glow shadow
- Secondary: ghost (transparent + border)
- Danger: solid red
- Loading: animated spinner + disabled state

FORM ALANLARI:
- bg-white/5 + border border-white/15
- focus: ring-2 ring-accent-primary
- error: border-red-500 + error message

MODALLER:
- Radix Dialog component
- Backdrop blur + dark overlay
- Framer Motion scale-in animation
```

---

## 🏗️ BÖLÜM 3: PROJE DOSYA YAPISI

```
[uygulama-adi]/
├── apps/
│   ├── web/                    # Next.js 15 app
│   │   ├── app/
│   │   │   ├── (auth)/         # Auth sayfaları
│   │   │   │   ├── login/
│   │   │   │   └── signup/
│   │   │   ├── (dashboard)/    # Oturum açmış kullanıcı
│   │   │   │   ├── session/    # AI seans sayfası
│   │   │   │   ├── journal/    # Günlük
│   │   │   │   ├── progress/   # İlerleme
│   │   │   │   └── settings/   # Ayarlar
│   │   │   ├── (marketing)/    # Landing pages
│   │   │   │   ├── page.tsx    # Ana sayfa
│   │   │   │   ├── pricing/
│   │   │   │   └── about/
│   │   │   └── api/            # Route handlers
│   │   │       ├── session/
│   │   │       ├── webhook/
│   │   │       └── health/
│   │   ├── components/
│   │   │   ├── ui/             # shadcn base components
│   │   │   ├── marketing/      # Landing page bileşenleri
│   │   │   ├── session/        # Seans bileşenleri
│   │   │   ├── dashboard/      # Dashboard bileşenleri
│   │   │   └── shared/         # Ortak bileşenler
│   │   ├── lib/
│   │   │   ├── supabase/       # Supabase client
│   │   │   ├── ai/             # AI helpers
│   │   │   ├── stripe/         # Stripe helpers
│   │   │   └── utils/          # Yardımcı fonksiyonlar
│   │   └── styles/
│   │       └── globals.css     # Tailwind + custom CSS
│   └── mobile/                 # React Native (Expo)
├── packages/
│   ├── ui/                     # Shared UI components
│   ├── config/                 # Shared configs (TS, ESLint)
│   └── types/                  # Shared TypeScript types
├── supabase/
│   ├── migrations/             # DB migrations
│   └── seed.sql                # Test verisi
└── docs/
    └── api.md                  # API documentation
```

---

## 📱 BÖLÜM 4: SAYFA TASARIMLARI (Ekran Ekran)

### 4.1 Landing Page (Ana Sayfa)

```
SECTION 1 — HERO (100vh)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Navbar: Logo | Nav Links | "Ücretsiz Başla" CTA]

[Animated gradient mesh background]
[Spline 3D Avatar — sağda dönen, nefes alan]

H1: "Ruh sağlığın için
     7/24 yanında olan"

H1: "[uygulama adı]"  ← animated gradient text

Subtitle: "AI destekli wellness koçluğu.
           Terapi değil — gelişim."

[CTA: "Ücretsiz 3 Seans Başla" → büyük, glowing]
[Alt yazı: Kredi kartı gerekmez · GDPR uyumlu]

[Scroll indicator: animated arrow down]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION 2 — SOCIAL PROOF
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"50.000+ kişi [uygulama adı] ile günlük rutinini değiştirdi"
[Animated counter + star rating]
[Marquee: kullanıcı yorumları (infinite scroll)]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION 3 — ÜRÜN DEMO (sticky scroll)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Sol: Özellik listesi (scroll → aktif olur)
Sağ: Uygulama mockup (her özellikte değişir)

Özellikler:
1. "Seni dinleyen AI avatar"
2. "Mood takibi + pattern analizi"
3. "Nefes egzersizleri"
4. "Günlük progress görselleştirme"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION 4 — AVATAR SEÇIMI (showcase)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
"Kendi tarzına göre bir avatar seç"
[4 avatar kart: Gerçek | 3D | Anime | Çizgi Film]
[Hover → animasyon preview]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION 5 — FİYATLANDIRMA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[Pricing cards: Free | Basic | Pro | Premium]
[Toggle: Aylık / Yıllık (yıllıkta %20 indirim)]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SECTION 6 — FAQ + FOOTER
```

**Tasarım Kaynakları (Landing için):**
- Hero ilham: https://21st.dev/components/hero
- Animated gradient: https://ui.aceternity.com/components/background-gradient-animation
- Marquee bileşen: https://magicui.design/docs/components/marquee
- Sticky scroll: https://ui.aceternity.com/components/sticky-scroll-reveal
- Pricing cards: https://21st.dev/components/pricing

### 4.2 Onboarding Flow (5 Adım)

```
ADIM 1: İsim + Yaş
ADIM 2: Ana hedef seçimi (stres, kaygı, özgüven, uyku, vs.)
ADIM 3: Avatar seçimi (4 kategori — animasyonlu showcase)
ADIM 4: İlk mini değerlendirme (5 soru — PHQ-2 + GAD-2 benzeri)
ADIM 5: "Hazır!" → İlk seans başlat

Progress: Üstte animated progress bar
Back: Her adımda geri dönebilme
Skip: Bazı adımlar atlanabilir
```

### 4.3 Seans Ekranı (Core Feature)

```
LAYOUT:
┌─────────────────────────────────────────────────┐
│  [← Geri]    [SEANS DEVAM EDİYOR]    [⏱ 23:45] │
├─────────────────────────────────────────────────┤
│                                                   │
│          [AVATAR — BÜYÜK MERKEZ]                  │
│          (lipsync + emotion-aware animation)      │
│                                                   │
│   [Mood Indicator: 😌 Sakin]                      │
│                                                   │
├─────────────────────────────────────────────────┤
│  [Mikrofon Butonu — pulse animation]             │
│  [Chat Transcript Toggle]                        │
│  [Seans Sonlandır]                               │
└─────────────────────────────────────────────────┘

DETAYLAR:
- Avatar: Full-screen odaklanma modu (ESC ile çıkış)
- Waveform: Konuşma sırasında animated ses dalgası
- Emotion bar: Real-time duygu indikatörü (Hume AI)
- Background: Çok hafif animasyonlu gradient (dikkat dağıtmaz)
```

### 4.4 Dashboard (Ana Panel)

```
LAYOUT: Sol sidebar + sağ içerik (desktop) / Alt tab bar (mobil)

WIDGETS:
1. "Bugünkü Mood" — emoji picker + mood score
2. "Seans Özeti" — son seans AI özeti
3. "30 Günlük Mood Haritası" — ısı haritası
4. "Öğrenilen Beceriler" — progress rings
5. "Hatırlatıcılar" — bugünkü görevler
6. "Spaced Repetition" — bugün tekrar edilecek
```

---

## 🤖 BÖLÜM 5: AVATAR SİSTEMİ (Tam Teknik Detay)

### 5.1 Avatar Kategorileri

#### Kategori A — Fotorealistik İnsan (Simli.ai)
```
API: https://api.simli.ai
Endpoint: POST /startSession
Payload:
  {
    "faceId": "string",       // 100+ hazır yüz
    "ttsProvider": "ElevenLabs",
    "voiceId": "string"
  }
Latency: <150ms first frame
Maliyet: $0.05-0.10/dk
```
Kaynak: https://docs.simli.ai

#### Kategori B — UE5 MetaHuman (3D Gerçekçi)
```
Tutorial 1: https://dev.epicgames.com/community/learning/tutorials/dOm7/building-a-complete-conversational-metahuman-ai-system-with-lip-sync-in-unreal-engine-audio-driven-facial-animation-tutorial
Tutorial 2: https://dev.epicgames.com/community/learning/tutorials/qEWO/unreal-engine-real-time-voice-ai-facial-animation-for-metahuman-characters

Pipeline:
Audio → Audio2Face → MetaHuman blendshapes
Pixel Streaming → Web browser (WebRTC)
Latency: 150-300ms
Maliyet: $0.80/seans (GPU compute)
```

#### Kategori C — Anime/2D (Live2D)
```
SDK: Cubism SDK for Web
  https://www.live2d.com/en/sdk/download/web/
Animasyon: Canvas WebGL
Latency: <50ms (client-side)
Maliyet: $0.01/seans
```

#### Kategori D — Çocuk Karakterler (Rive)
```
Tool: https://rive.app
Runtime: @rive-app/react-canvas
State Machine: Emotion states → animasyon
Maliyet: $0.01/seans
```

### 5.2 Avatar Seçim UI

```typescript
// Direktif: Bu bileşeni Framer Motion ile yaz
// Kartlar hover'da 3D tilt effect yapacak
// Seçilen kart: glow + scale(1.05) + checkmark

const AvatarSelector = () => {
  // shadcn/ui Card bileşenini temel al
  // Framer Motion whileHover={{ scale: 1.05, rotateY: 5 }}
  // Seçim: Zustand store'a kaydet
}
```

---

## 🔧 BÖLÜM 6: BACKEND MİMARİSİ

### 6.1 Veritabanı Şeması (Supabase PostgreSQL)

```sql
-- KULLANICILAR
CREATE TABLE profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  name TEXT,
  age INTEGER,
  avatar_preference TEXT DEFAULT 'anime',
  tier TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- SEANS KAYITLARI
CREATE TABLE sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  mood_before INTEGER,     -- 1-10
  mood_after INTEGER,      -- 1-10
  ai_summary TEXT,
  transcript JSONB,
  emotion_data JSONB,      -- Hume AI sonuçları
  session_type TEXT        -- 'voice' | 'text' | 'breathing'
);

-- MOOD TAKIBI
CREATE TABLE mood_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  mood_score INTEGER,      -- 1-10
  mood_label TEXT,         -- 'anxious' | 'calm' | 'happy' etc.
  note TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- SPACED REPETITION
CREATE TABLE skills (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  skill_name TEXT,
  skill_type TEXT,
  learned_at TIMESTAMPTZ,
  next_review TIMESTAMPTZ,
  review_count INTEGER DEFAULT 0,
  ease_factor DECIMAL DEFAULT 2.5   -- SuperMemo SM-2 algoritması
);

-- SAĞLIK VERİSİ (Apple Watch / Android)
CREATE TABLE health_data (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  hrv_score DECIMAL,
  sleep_hours DECIMAL,
  step_count INTEGER,
  recorded_date DATE,
  source TEXT             -- 'apple_health' | 'google_fit' | 'manual'
);

-- ROW LEVEL SECURITY (ZORUNLU)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE mood_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_data ENABLE ROW LEVEL SECURITY;

-- Politikalar (her kullanıcı sadece kendi verisini görür)
CREATE POLICY "users_own_data" ON profiles
  FOR ALL USING (auth.uid() = id);
```

### 6.2 API Endpoint Listesi

```
POST   /api/session/start          → VAPI.ai seans başlat
POST   /api/session/end            → Seans bitir + AI özet oluştur
GET    /api/session/:id            → Seans detayı
GET    /api/sessions               → Tüm seanslar (paginated)

POST   /api/mood                   → Mood kaydı ekle
GET    /api/mood/history           → Son 30 gün mood

GET    /api/skills                 → Öğrenilen beceriler
POST   /api/skills/:id/review      → Spaced repetition güncelle

POST   /api/health/sync            → Apple Health / Google Fit sync
GET    /api/health/summary         → Sağlık özeti

POST   /api/stripe/checkout        → Ödeme başlat
POST   /api/stripe/webhook         → Stripe webhook handler
GET    /api/subscription           → Abonelik durumu

POST   /api/crisis/detect          → Kriz keyword tespiti
```

### 6.3 AI Pipeline

```
Kullanıcı konuşur
      ↓
VAPI.ai (real-time voice pipeline)
  ├── STT: Whisper (OpenAI)
  ├── LLM: GPT-4o (system prompt: terapi koçu)
  └── TTS: ElevenLabs (avatar sesi)
      ↓
Hume AI (paralel) → duygu skoru
      ↓
Supabase → transcript + emotion_data kaydet
      ↓
Trigger.dev (background)
  ├── AI özet oluştur (seans bitti sonra)
  ├── Spaced repetition hesapla
  └── Mood pattern analizi
```

### 6.4 VAPI.ai Entegrasyonu

```typescript
// Kaynak: https://docs.vapi.ai
import Vapi from '@vapi-ai/web'

const vapi = new Vapi(process.env.NEXT_PUBLIC_VAPI_KEY)

// Seans başlat
await vapi.start({
  model: {
    provider: 'openai',
    model: 'gpt-4o',
    systemPrompt: THERAPIST_SYSTEM_PROMPT
  },
  voice: {
    provider: 'elevenlabs',
    voiceId: 'YOUR_VOICE_ID'
  }
})

// Event listeners
vapi.on('speech-start', () => setAvatarSpeaking(true))
vapi.on('speech-end', () => setAvatarSpeaking(false))
vapi.on('transcript', (msg) => appendTranscript(msg))
```

---

## 💎 BÖLÜM 7: 10 TEMEL ÖZELLİK (Teknik Detay)

### F1: Real-time Emotion Sync (Hume AI)
```
Kaynak: https://dev.hume.ai/docs
SDK: @humeai/sdk-react
Pipeline:
  Audio stream → Hume EVI (Empathic Voice Interface)
  → Emotion vector [joy, sadness, anger, fear, ...]
  → Avatar blendshape weights güncelle
  → 50ms update cycle

UI: Real-time emotion bar (renkli indikatör)
```

### F2: Behavioral Pattern Mining
```
Algoritma: Time-series clustering (k-means basit)
Veri: sessions tablosu → mood_before trend
Çıktı: "Pazartesi stresli, Cuma enerjik" pattern
UI: Heatmap (react-calendar-heatmap paketi)
Kaynak: https://www.npmjs.com/package/react-calendar-heatmap
```

### F3: Synchronized Breathing
```
Mikrofon → Web Audio API → FFT analizi → nefes ritmi
Avatar: CSS animasyon (scale keyframes)
Nefes egzersizi: 4-7-8 veya box breathing
UI: Animated circle (Framer Motion + scale keyframes)
```

### F4: Attachment Style Assessment
```
20 soru → Secure / Anxious / Avoidant / Disorganized
Algoritma: Weighted scoring
UI: Step-by-step wizard (Radix UI Stepper)
Sonuç: Görsel kişilik kartı (paylaşılabilir)
```

### F5: Spaced Repetition
```
Algoritma: SuperMemo SM-2
  EF (ease factor) = 2.5 başlangıç
  Interval: 1 → 6 → 14 → 30 gün
  Güncelleme: Review kalitesine göre EF ayarla
Kaynak: https://www.supermemo.com/en/blog/application-of-a-computer-to-improve-the-results-obtained-in-working-with-the-supermemo-method
UI: Flashcard component (flip animasyonu)
```

### F6: Boundary-Setting Coach
```
Senaryo DB: 20+ hazır rol-oyunu senaryosu
  - "Patronuma hayır de"
  - "Aile baskısını yönet"
  - "İlişkide sınır koy"
AI: GPT-4o ile rol-oyunu (system prompt: "Sen patronsun")
Feedback: Her konuşma sonrası AI değerlendirmesi
```

### F7: SAD (Seasonal) Helper
```
Tetik: Kullanıcı lokasyonu → günışığı süresi API
API: https://sunrise-sunset.org/api (ücretsiz)
Kış modu: Otomatik aktivasyon (Kasım-Mart)
Öneriler: Işık terapisi hatırlatıcıları, egzersiz reminderleri
```

### F8: Humor Injection
```
Kural motoru:
  IF mood_score > 6 AND session_duration > 10min
    THEN humor_probability = 0.3
  IF crisis_keywords_detected
    THEN humor_probability = 0
Mizah DB: 100+ onaylı terapötik mizah örneği
Safety: Hiçbir zaman kişisel durum hakkında değil
```

### F9: Voice Biofeedback (GDPR Conditional)
```
Veri: Web Audio API → pitch, tempo, amplitude
Analiz: Yüksek pitch + hızlı tempo = kaygı marker
GDPR: Consent ekranı ZORUNLU (biometric data)
UI: Real-time waveform visualizer
Library: Wavesurfer.js (https://wavesurfer.xyz)
```

### F10: Load Balancing
```
Stack: Vercel Edge Functions + Cloudflare Workers
Worker pool: Trigger.dev queue
Rate limiting: Upstash Ratelimit
Monitoring: Axiom logs + Sentry alerts
```

---

## 💰 BÖLÜM 8: FİYATLANDIRMA SİSTEMİ

### 8.1 Tier Yapısı

| Tier | Fiyat | Hedef |
|------|-------|-------|
| **Free** | $0 | 3 lifetime seans, metin modu, 1 anime avatar |
| **Basic** | $14.99/ay | Sınırsız metin, 8 ses seans/ay, 720p |
| **Pro** | $39.99/ay | Sınırsız her şey, Simli.ai, UE5, 1080p, Apple Watch |
| **Premium** | $79.99/ay | 4K, Tavus avatar klon, ElevenLabs ses klon, aile planı |
| **Enterprise** | $10-50/kullanıcı/ay | B2B, SSO, HIPAA BAA, white-label |

### 8.2 Stripe Entegrasyonu

```typescript
// Kaynak: https://stripe.com/docs/billing/subscriptions
// Library: stripe (npm) + @stripe/stripe-js

// Ürün IDs (Stripe Dashboard'da oluştur)
const PRICE_IDS = {
  basic_monthly: 'price_xxxx',
  pro_monthly: 'price_xxxx',
  premium_monthly: 'price_xxxx',
  basic_yearly: 'price_xxxx',
  pro_yearly: 'price_xxxx',
  premium_yearly: 'price_xxxx',
}

// Checkout oluştur
const session = await stripe.checkout.sessions.create({
  mode: 'subscription',
  payment_method_types: ['card'],
  line_items: [{ price: PRICE_IDS[tier], quantity: 1 }],
  success_url: `${baseUrl}/dashboard?success=true`,
  cancel_url: `${baseUrl}/pricing`,
})

// Webhook: subscription.created, subscription.updated,
//          invoice.payment_succeeded, customer.subscription.deleted
```

### 8.3 PPP (Purchasing Power Parity)

```
TR (Türkiye):    $14.99 → ₺199/ay  | $39.99 → ₺499/ay
IN (Hindistan):  $14.99 → ₹499/ay  | $39.99 → ₹999/ay
BR (Brezilya):   $14.99 → R$39/ay  | $39.99 → R$99/ay
PH (Filipinler): $14.99 → ₱449/ay  | $39.99 → ₱999/ay

Uygulama: Stripe Tax + lokasyon tespiti (Cloudflare IP)
```

---

## 📊 BÖLÜM 9: ANALİTİK & MONİTORİNG

### 9.1 Araçlar

| Araç | URL | Ne İzler |
|------|-----|---------|
| **PostHog** | https://posthog.com | Product analytics, funnel, retention |
| **Sentry** | https://sentry.io | Error tracking, performance |
| **Axiom** | https://axiom.co | Log management |
| **Stripe Dashboard** | — | Gelir, churn, MRR |
| **Supabase Dashboard** | — | DB queries, auth stats |

### 9.2 Kritik Metrikler

```
Activation: Onboarding tamamlama oranı (hedef: >80%)
Activation: İlk seans tamamlama (hedef: >70%)
Retention D7: %40+ (benchmark: Calm=%35)
Retention D30: %20+
Conversion: Free → Paid: %10+
NPS: 50+
Churn: <%5/ay
LTV/CAC: >3x
```

---

## 🔒 BÖLÜM 10: GÜVENLİK & YASAL UYUM

### 10.1 Teknik Güvenlik

```
Authentication: Supabase Auth + JWT
Authorization: Row Level Security (her tabloda)
Encryption: TLS 1.3 (transit) + AES-256 (rest)
CORS: İzin verilen origin listesi
Rate Limiting: Upstash Ratelimit (https://upstash.com/docs/redis/sdks/ratelimit-ts/overview)
Input Validation: Zod (her API endpoint)
SQL Injection: Parameterized queries (Supabase client)
XSS: Next.js built-in + DOMPurify (kullanıcı içeriği)
CSRF: SameSite cookies
Secrets: Vercel Environment Variables (ASLA frontend'e expose etme)
```

### 10.2 GDPR / KVKK Uyumu

```
Consent: İlk kayıtta açık onay (checkboxes)
Data Export: /api/gdpr/export → ZIP download
Data Delete: /api/gdpr/delete → hard delete
Cookie Banner: Cookiebot veya custom
Privacy Policy: Hukuki danışmanlık ile yaz
Biometric Consent: Voice biofeedback için ayrı onay
Data Retention: 3 yıl → otomatik anonymization
DPA: Tüm 3rd party servislerle Data Processing Agreement
```

### 10.3 Kriz Protokolü

```typescript
// Kriz keyword listesi (sürekli güncelle)
const CRISIS_KEYWORDS = [
  'intihar', 'kendime zarar', 'ölmek istiyorum',
  'suicide', 'self-harm', 'want to die',
  // + diğer diller
]

// Tespit → kapatılamaz modal
// Modal içeriği:
// - 182 (Türkiye intihar önleme hattı)
// - 911/112 (acil)
// - Yakın kişi irtibat (kullanıcı eklemiş ise)
// - "AI değilim, profesyonel yardım al" mesajı
```

---

## ⌚ BÖLÜM 11: APPLE WATCH & ANDROID WEAR

### 11.1 iOS HealthKit

```swift
// Kaynak: https://developer.apple.com/documentation/healthkit
// React Native: react-native-health

Adım 1: Xcode → Signing & Capabilities → HealthKit ekle
Adım 2: Info.plist:
  NSHealthShareUsageDescription: "Uyku ve stres verilerini analiz etmek için"
  NSHealthUpdateUsageDescription: "Nefes egzersizi verisi kaydetmek için"

Adım 3: İzin isteği (onboarding step 4'de):
  const permissions = {
    permissions: {
      read: ['SleepAnalysis', 'HeartRateVariability', 'StepCount', 'RestingHeartRate'],
      write: ['MindfulSession']
    }
  }

Adım 4: Background delivery — her gece 03:00 sync
Adım 5: Supabase → health_data tablosuna kaydet
```

### 11.2 Android Health Connect

```kotlin
// Kaynak: https://developer.android.com/health-and-fitness/guides/health-connect
// React Native: react-native-health-connect

val client = HealthConnectClient.getOrCreate(context)
val permissions = setOf(
  HealthPermission.getReadPermission(SleepSessionRecord::class),
  HealthPermission.getReadPermission(HeartRateVariabilityRmssdRecord::class),
  HealthPermission.getReadPermission(StepsRecord::class)
)
```

### 11.3 React Native (Cross-platform)

```
Library: react-native-health-connect
  https://www.npmjs.com/package/react-native-health-connect
  iOS → HealthKit / Android → Health Connect

Tek codebase, iki platform desteği
```

---

## 📅 BÖLÜM 12: 90 GÜN EYLEM PLANI (3 Kişilik Ekip)

### Ekip
- **Talha** — PM + Full-stack (97 saat)
- **Kız 1** — Frontend Lead (93 saat)
- **Kız 2** — Backend Lead (126 saat)

### HAFTA 1-2 (60 saat) — Infrastructure

```
TALHA:
□ GitHub monorepo kur (Turborepo)
□ Supabase proje oluştur + şema yaz
□ Vercel deploy + domain bağla
□ GPT-4o system prompt v1 yaz
□ CI/CD: GitHub Actions pipeline

KIZ 1:
□ Next.js 15 + Tailwind v4 + shadcn kurulumu
□ Design system: renkler, tipografi, spacing
□ Dark mode implementasyonu
□ Navbar + Footer bileşenleri
□ Landing page hero section

KIZ 2:
□ Supabase auth (email + Google OAuth)
□ profiles tablosu + RLS politikaları
□ Middleware: korumalı route'lar
□ API route template (Zod validation)
□ Sentry + PostHog kurulumu
```

### HAFTA 3-4 (80 saat) — AI Core + Onboarding

```
TALHA:
□ VAPI.ai entegrasyonu + sistem prompt
□ PHQ-2/GAD-2 değerlendirme algoritması
□ Seans memory sistemi (Supabase vector)
□ ElevenLabs ses testi + seçim

KIZ 1:
□ Onboarding flow (5 adım wizard)
□ Avatar seçim ekranı (animasyonlu)
□ Seans ekranı layout
□ Chat transcript bileşeni

KIZ 2:
□ sessions tablosu + API endpoint'leri
□ mood_entries tablosu + CRUD API
□ Session end → AI özet trigger (Trigger.dev)
□ Kredi/kullanım takip sistemi
```

### HAFTA 5-6 (100 saat) — Özellikler #2-5 + Dashboard

```
TALHA:
□ Behavioral Pattern Mining algoritması
□ Attachment Assessment: soru seti + skorlama
□ Spaced Repetition: SM-2 implementasyonu
□ Pattern → insight → öneri pipeline

KIZ 1:
□ Dashboard layout + sidebar
□ Mood heatmap (react-calendar-heatmap)
□ Skills progress ring bileşeni
□ Attachment sonuç kartı (paylaşılabilir)

KIZ 2:
□ skills tablosu + SM-2 API
□ health_data tablosu
□ Behavioral pattern API (aggregation)
□ Scheduler: daily review notifications
```

### HAFTA 7-8 (90 saat) — Özellikler #6-8 + Ödeme

```
TALHA:
□ Synchronized Breathing algoritması
□ Boundary-Setting Coach: 20 senaryo yaz
□ SAD Helper: Sunrise-Sunset API entegrasyonu
□ Stripe: ürünler + fiyatlar + checkout

KIZ 1:
□ Breathing animation (Framer Motion)
□ Role-play coach UI
□ Pricing sayfası (toggle aylık/yıllık)
□ Stripe checkout flow

KIZ 2:
□ Stripe webhook handler
□ Subscription tablosu + tier yönetimi
□ PPP lokasyon tespiti
□ Feature flag sistemi (tier'a göre erişim)
```

### HAFTA 9-10 (80 saat) — Özellikler #9-10 + Polish

```
TALHA:
□ Humor Injection kural motoru + DB
□ Voice Biofeedback + GDPR onay ekranı
□ Kriz protokolü implementasyonu
□ GDPR data export/delete API

KIZ 1:
□ Waveform visualizer (Wavesurfer.js)
□ Privacy ayarları sayfası
□ Mobile responsive polish
□ PWA manifest + service worker

KIZ 2:
□ Voice API (pitch/tempo analizi)
□ Email servisi (Resend)
□ GDPR consent kayıt sistemi
□ Load balancing: Trigger.dev queue
```

### HAFTA 11-12 (42 saat) — Test + Launch

```
TALHA:
□ Load testing (k6 veya Artillery)
□ Security audit (OWASP checklist)
□ App Store / Play Store submission
□ Launch checklist ✓

KIZ 1:
□ E2E testler (Playwright)
□ Accessibility audit (axe-core)
□ Bug fix sprint
□ Marketing site son düzenlemeler

KIZ 2:
□ Integration testler
□ Performance tuning (DB sorgu optimizasyonu)
□ Monitoring alertleri kur
□ Backup + recovery test
```

---

## 🚀 BÖLÜM 13: LAUNCH KRİTERLERİ

```
Teknik:
□ Uptime: 99%+
□ API latency p99: <200ms
□ Web Vitals: LCP<2.5s, FID<100ms, CLS<0.1
□ Mobil: iOS + Android build hazır
□ 0 kritik hata

Ürün:
□ Onboarding: <5 dakika
□ İlk seans: çalışıyor
□ Ödeme: test edildi (Stripe test mode)
□ Kriz protokolü: test edildi
□ GDPR consent: çalışıyor

Güvenlik:
□ OWASP Top 10 kontrol edildi
□ RLS tüm tablolarda aktif
□ Sentry alertleri kurulu
□ Secrets rotation planı hazır
```

---

## 📚 BÖLÜM 14: EK KAYNAKLAR

### Frontend
| Kaynak | URL | Konu |
|--------|-----|------|
| Next.js Docs | https://nextjs.org/docs | App Router, RSC |
| Tailwind v4 | https://tailwindcss.com/docs | Yeni sözdizimi |
| shadcn/ui | https://ui.shadcn.com | Component kurulumu |
| Framer Motion | https://www.framer.com/motion | Animation API |
| TanStack Query | https://tanstack.com/query | Server state |
| Zustand | https://zustand-demo.pmnd.rs | Client state |

### Backend / Infra
| Kaynak | URL | Konu |
|--------|-----|------|
| Supabase Docs | https://supabase.com/docs | DB, Auth, RLS |
| Trigger.dev | https://trigger.dev/docs | Background jobs |
| Upstash | https://upstash.com/docs | Redis, ratelimit |
| Vercel Docs | https://vercel.com/docs | Deploy, Edge |
| Resend | https://resend.com/docs | Email API |

### AI / Ses
| Kaynak | URL | Konu |
|--------|-----|------|
| VAPI.ai | https://docs.vapi.ai | Voice AI |
| Hume AI | https://dev.hume.ai/docs | Emotion AI |
| ElevenLabs | https://elevenlabs.io/docs | TTS |
| OpenAI | https://platform.openai.com/docs | GPT-4o, Whisper |
| Simli.ai | https://docs.simli.ai | Avatar |

### Ödeme / Analytics
| Kaynak | URL | Konu |
|--------|-----|------|
| Stripe | https://stripe.com/docs | Billing |
| PostHog | https://posthog.com/docs | Analytics |
| Sentry | https://docs.sentry.io | Error tracking |

### UE5 (MetaHuman)
| Kaynak | URL | Konu |
|--------|-----|------|
| Epic Tutorial 1 | https://dev.epicgames.com/community/learning/tutorials/dOm7/building-a-complete-conversational-metahuman-ai-system-with-lip-sync-in-unreal-engine-audio-driven-facial-animation-tutorial | Full pipeline |
| Epic Tutorial 2 | https://dev.epicgames.com/community/learning/tutorials/qEWO/unreal-engine-real-time-voice-ai-facial-animation-for-metahuman-characters | Voice animation |
| MetaHuman Creator | https://metahuman.unrealengine.com | Karakter oluştur |

---

## ⚠️ BÖLÜM 15: KRİTİK UYARILAR (AI için)

```
1. Asla API key'leri frontend code'a yazma
2. Asla .env dosyasını git'e push etme
3. Her Supabase tablosunda RLS aktif olmalı
4. PHQ/GAD değerlendirmeleri tanı DEĞİL, eğitim amaçlı
5. Kriz modunda mizah ASLA çalışmamalı
6. Voice biofeedback için GDPR consent olmadan başlatma
7. Stripe webhook'ları imzayı doğrula (stripe.webhooks.constructEvent)
8. Çocuk kullanıcılar (7-16) için ebeveyn onay akışı ekle
9. Tüm kullanıcı girdilerini sanitize et (DOMPurify)
10. Rate limit: max 10 seans/gün (free tier) → abuse önle
```

---

---

## 🌍 BÖLÜM 16: LOKALİZASYON & ÇOKLU DİL (i18n)

### 16.1 Strateji

```
Başlangıç dilleri: TR (Türkçe) + EN (İngilizce)
Ay 6 hedef: + AR (Arapça) + DE (Almanca)
Ay 12 hedef: + ES (İspanyolca) + FR (Fransızca)

Library: next-intl (Next.js 15 ile native uyumlu)
  https://next-intl-docs.vercel.app
```

### 16.2 Kurulum

```typescript
// next.config.ts
import createNextIntlPlugin from 'next-intl/plugin'
const withNextIntl = createNextIntlPlugin()
export default withNextIntl({})

// Klasör yapısı:
// messages/
//   tr.json   ← Türkçe
//   en.json   ← İngilizce
//   ar.json   ← Arapça (RTL!)

// URL yapısı:
// lyra.app/tr/dashboard
// lyra.app/en/dashboard
// lyra.app/ar/dashboard  ← dir="rtl" otomatik
```

### 16.3 AI Sistem Promptları (Çok Dilli)

```
Her dil için ayrı system prompt:
  - TR: "Sen Lyra'sın, Türkçe konuşan wellness koçusun..."
  - EN: "You are Lyra, a wellness coach speaking English..."
  - AR: "أنت ليرا، مدربة رفاهية تتحدث العربية..."

Kullanıcı dili → VAPI.ai systemPrompt otomatik değişir
ElevenLabs: Her dil için ayrı ses klonu
```

### 16.4 RTL (Sağdan Sola) Desteği

```typescript
// Arapça için otomatik RTL:
// tailwind.config: rtl: true
// className: "rtl:text-right ltr:text-left"
// Framer Motion animasyonları: x değerlerini ters çevir
```

### 16.5 Para Birimi & Tarih Formatı

```typescript
// Intl API kullan — kütüphane gerekmez
const price = new Intl.NumberFormat(locale, {
  style: 'currency',
  currency: locale === 'tr' ? 'TRY' : 'USD'
}).format(amount)

const date = new Intl.DateTimeFormat(locale, {
  dateStyle: 'medium'
}).format(new Date())
```

---

## 📲 BÖLÜM 17: BİLDİRİM SİSTEMİ

### 17.1 Bildirim Türleri

```
1. Web Push Notifications (tarayıcı)
   → Spaced repetition hatırlatıcıları
   → Günlük mood check-in
   → SAD helper uyarıları

2. Email Bildirimleri (Resend)
   → Haftalık progress özeti
   → Seans hatırlatıcısı
   → Ödeme/fatura bildirimleri

3. In-app Notifications (Supabase Realtime)
   → Başarı rozeti kazandın
   → Streak milestone
   → Yeni özellik duyurusu

4. Mobile Push (Expo Notifications)
   → Nefes egzersizi zamanı
   → Günlük seans hatırlatıcısı
```

### 17.2 Web Push Kurulum

```typescript
// Library: web-push (npm)
// Kaynak: https://web.dev/push-notifications-overview/

// Service worker (public/sw.js):
self.addEventListener('push', (event) => {
  const data = event.data.json()
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/badge-72.png',
    data: { url: data.url }
  })
})

// Permission isteği (onboarding son adımda):
const sub = await registration.pushManager.subscribe({
  userVisibleOnly: true,
  applicationServerKey: process.env.NEXT_PUBLIC_VAPID_KEY
})
// → Supabase push_subscriptions tablosuna kaydet
```

### 17.3 Bildirim Zamanlaması (Trigger.dev)

```typescript
// Her gece 20:00 → yarınki review listesini kontrol et
// Kullanıcının timezone'una göre gönder

client.defineJob({
  id: 'daily-reminder',
  name: 'Daily Review Reminder',
  trigger: cronTrigger({ cron: '0 20 * * *' }),
  run: async (payload, io) => {
    const usersWithReviews = await getReviewsDuetomorrow()
    for (const user of usersWithReviews) {
      await sendWebPush(user.pushSubscription, {
        title: 'Lyra hatırlatıcı',
        body: `Yarın ${user.reviewCount} tekrar var`
      })
    }
  }
})
```

### 17.4 Veritabanı (Ek Tablo)

```sql
CREATE TABLE push_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE TABLE notification_preferences (
  user_id UUID REFERENCES profiles(id) PRIMARY KEY,
  daily_reminder BOOLEAN DEFAULT true,
  reminder_time TIME DEFAULT '20:00',
  weekly_summary BOOLEAN DEFAULT true,
  spaced_rep BOOLEAN DEFAULT true,
  timezone TEXT DEFAULT 'Europe/Istanbul'
);
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
```

---

## 🔍 BÖLÜM 18: SEO & OPEN GRAPH

### 18.1 Next.js Metadata API

```typescript
// app/layout.tsx — global metadata
export const metadata: Metadata = {
  metadataBase: new URL('https://lyra.app'),
  title: {
    default: 'Lyra — AI Destekli Wellness Koçluğu',
    template: '%s | Lyra'
  },
  description: 'Ruh sağlığın için 7/24 yanında olan AI koç. Stres, kaygı ve özgüven için kişisel gelişim seansları.',
  keywords: ['wellness', 'ruh sağlığı', 'AI terapi', 'meditasyon', 'stres yönetimi'],
  authors: [{ name: 'Lyra' }],
  openGraph: {
    type: 'website',
    locale: 'tr_TR',
    alternateLocale: 'en_US',
    url: 'https://lyra.app',
    siteName: 'Lyra',
    images: [{
      url: '/og-image.png',     // 1200x630px
      width: 1200,
      height: 630,
      alt: 'Lyra AI Wellness'
    }]
  },
  twitter: {
    card: 'summary_large_image',
    site: '@lyraapp',
    creator: '@lyraapp',
    images: '/og-image.png'
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true }
  }
}
```

### 18.2 Structured Data (JSON-LD)

```typescript
// Landing page'e ekle:
const structuredData = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Lyra',
  applicationCategory: 'HealthApplication',
  offers: {
    '@type': 'Offer',
    price: '0',
    priceCurrency: 'USD',
    description: 'Ücretsiz başla'
  },
  aggregateRating: {
    '@type': 'AggregateRating',
    ratingValue: '4.8',
    reviewCount: '1250'
  }
}
```

### 18.3 OG Image Oluşturma (Dinamik)

```typescript
// app/api/og/route.tsx — Vercel @vercel/og
import { ImageResponse } from 'next/og'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const title = searchParams.get('title') ?? 'Lyra'

  return new ImageResponse(
    <div style={{ background: '#0A0A0F', display: 'flex', /* ... */ }}>
      <h1 style={{ color: '#7C6FFF' }}>{title}</h1>
    </div>,
    { width: 1200, height: 630 }
  )
}
// Kullanım: /api/og?title=Seans+Özeti
```

### 18.4 Sitemap & Robots

```typescript
// app/sitemap.ts
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: 'https://lyra.app', lastModified: new Date(), changeFrequency: 'weekly', priority: 1 },
    { url: 'https://lyra.app/pricing', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.8 },
    { url: 'https://lyra.app/about', lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
  ]
}

// app/robots.ts
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/dashboard/', '/api/'] },
    sitemap: 'https://lyra.app/sitemap.xml'
  }
}
```

### 18.5 Blog / İçerik Stratejisi (SEO için)

```
Platform: MDX (Next.js built-in) veya Contentful CMS
Hedef: Organik trafik + güven inşası

İçerik kategorileri:
  - "Stres yönetimi teknikleri" (arama hacmi yüksek)
  - "Nefes egzersizleri nasıl yapılır"
  - "Attachment style nedir"
  - "SAD nedir, kış depresyonu"
  - "AI terapi güvenli mi?"

Yayın sıklığı: Haftada 2 yazı (Talha + AI yardımı)
Tool: Notion → MDX export → GitHub PR → otomatik publish
```

---

## 🎯 BÖLÜM 19: REFERRAL & BÜYÜME SİSTEMİ

### 19.1 Referral Mekanizması

```
Nasıl çalışır:
  1. Her kullanıcıya benzersiz referral kodu (lyra.app/r/XXXX)
  2. Arkadaş kayıt olur → her iki taraf 1 ay ücretsiz Pro
  3. Referrer dashboard'da takip edebilir

Kural:
  - Minimum: 7 günlük kullanıcı (abuse önle)
  - Maksimum: 5 referral/ay (free tier)
  - Pro/Premium: Sınırsız referral
```

### 19.2 Veritabanı

```sql
CREATE TABLE referrals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_id UUID REFERENCES profiles(id),
  referred_id UUID REFERENCES profiles(id),
  referral_code TEXT UNIQUE NOT NULL,
  status TEXT DEFAULT 'pending',  -- 'pending' | 'completed' | 'rewarded'
  reward_given_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
```

### 19.3 Viral Loop Tasarımı

```
Tetikleyiciler (kullanıcıyı paylaşmaya itmek için):
  1. Seans bitti → "Bu seanstan çıkarımını paylaş" butonu
     → Twitter/Instagram story card (OG image + alıntı)

  2. Attachment test bitti → "Bağlanma stilini öğren"
     → Paylaşılabilir sonuç kartı (branded)

  3. 30 günlük mood özeti → "Bir aylık yolculuğum"
     → Infographic (Vercel OG ile oluştur)

  4. Milestone: 10. seans → konfeti + "Arkadaşını davet et"
```

### 19.4 Referral UI

```
Dashboard → "Arkadaşlarını Davet Et" bölümü:
  - Benzersiz link (kopyala butonu)
  - Kaç kişi davet ettin (counter)
  - Kazanılan ödüller (badge'ler)
  - Arkadaşın durumu: "Kayıt oldu / İlk seans yaptı / Pro'ya geçti"
```

---

## 📧 BÖLÜM 20: EMAIL SERİSİ & LIFECYCLE MARKETING

### 20.1 Welcome Serisi (7 Gün)

```
Platform: Resend + React Email (https://react.email)

Gün 0 (kayıt anında):
  Konu: "Lyra'ya hoş geldin, [isim] 👋"
  İçerik: İlk seans CTA + ne beklemeli

Gün 1 (24 saat sonra):
  Konu: "İlk seanstan nasıldın?"
  Koşul: Seans yapmadıysa → hatırlatıcı
  Koşul: Seans yaptıysa → "Nasıl geçti?" + mood check

Gün 3:
  Konu: "Bugün için bir nefes egzersizi"
  İçerik: F3 özelliğini tanıt + direkt link

Gün 5:
  Konu: "Bağlanma stilin nedir? (2 dakika)"
  İçerik: F4 attachment test CTA

Gün 7:
  Konu: "1 haftalık ilerleme özetin hazır"
  İçerik: Kişiselleştirilmiş özet + premium upgrade CTA
```

### 20.2 Retention Serisi

```
D14 (aktif değilse):
  Konu: "Seni özledik, [isim]"
  İçerik: Son seans özeti + "Nerede kaldın?"

D30 (aktif değilse — churn riski):
  Konu: "Lyra'nı kaybetmek üzeresin"
  İçerik: Özellik güncelleme + 1 hafta ücretsiz Pro

Haftalık (aktif kullanıcılar):
  Konu: "Bu haftanın mood özeti"
  İçerik: Haftalık heatmap + en iyi gün vurgusu + önümüzdeki hafta önerisi
```

### 20.3 React Email Template Örneği

```tsx
// emails/welcome.tsx
import { Html, Head, Body, Container, Heading, Text, Button } from '@react-email/components'

export default function WelcomeEmail({ name, sessionUrl }: Props) {
  return (
    <Html>
      <Head />
      <Body style={{ background: '#0A0A0F', color: '#F8F8FF' }}>
        <Container>
          <Heading>Merhaba {name} 👋</Heading>
          <Text>İlk seansın seni bekliyor.</Text>
          <Button href={sessionUrl} style={{ background: '#7C6FFF' }}>
            Seans Başlat
          </Button>
        </Container>
      </Body>
    </Html>
  )
}

// Gönderim (Trigger.dev job):
await resend.emails.send({
  from: 'lyra@lyra.app',
  to: user.email,
  subject: `Lyra'ya hoş geldin, ${user.name}!`,
  react: WelcomeEmail({ name: user.name, sessionUrl })
})
```

---

## 🧪 BÖLÜM 21: A/B TEST & CONVERSION OPTİMİZASYON

### 21.1 PostHog Feature Flags ile A/B Test

```typescript
// Kaynak: https://posthog.com/docs/feature-flags
import { useFeatureFlagVariantKey } from 'posthog-js/react'

// Örnek: Hero CTA metni A/B testi
const ctaVariant = useFeatureFlagVariantKey('hero-cta')

const ctaText = {
  'control': 'Ücretsiz Başla',
  'variant-a': 'İlk Seansi Ücretsiz Dene',
  'variant-b': '3 Dakikada Başla'
}[ctaVariant ?? 'control']
```

### 21.2 Test Listesi (Öncelikli)

```
1. Hero CTA metni (conversion etkisi en yüksek)
   A: "Ücretsiz Başla"
   B: "İlk 3 Seans Ücretsiz"
   C: "Hemen Dene — Kart Gerekmez"
   Metrik: Signup rate

2. Pricing page — en popüler planı vurgula
   A: Pro planı vurgula
   B: Basic planı vurgula
   Metrik: Paid conversion

3. Onboarding — adım sayısı
   A: 5 adım (mevcut)
   B: 3 adım (daha kısa)
   Metrik: Onboarding tamamlama

4. Free tier seans limiti
   A: 3 lifetime seans
   B: 7 günlük sınırsız deneme
   Metrik: Paid conversion sonrası churn
```

### 21.3 Funnel Tracking

```typescript
// Her kritik adımda PostHog event gönder:
posthog.capture('onboarding_started')
posthog.capture('onboarding_step_completed', { step: 2 })
posthog.capture('onboarding_completed')
posthog.capture('first_session_started')
posthog.capture('first_session_completed', { duration_seconds: 900 })
posthog.capture('upgrade_modal_shown', { trigger: 'session_limit' })
posthog.capture('upgrade_clicked', { plan: 'pro' })
posthog.capture('payment_completed', { plan: 'pro', amount: 39.99 })
```

---

## 🚀 BÖLÜM 22: PERFORMANS OPTİMİZASYON

> **Önemi:** Wellness app → kullanıcı seans sırasında konsantre olmalı. Lag = güven kaybı.

### 22.1 GPU Kullanımı Kuralları

```
KURAL: GPU-ağır işlemleri minimize et

✅ İZİN VERİLEN (hafif GPU):
  - CSS transform + opacity animasyonları
  - Framer Motion (transform tabanlı)
  - Tailwind backdrop-blur (max 3-4 element)

⚠️ DİKKATLİ KULLAN (orta GPU):
  - backdrop-filter: blur() — çok fazla element olmasın
  - Canvas 2D (waveform, breathing circle)

❌ YASAK (ağır GPU):
  - Particle efektleri (tsparticles, vanta.js)
  - WebGL background efektleri
  - Spline 3D — sadece landing hero'da, lazy-load ET

KURAL: Spline iframe → sadece viewport'a girince yükle:
  import dynamic from 'next/dynamic'
  const SplineScene = dynamic(() => import('./SplineScene'), {
    ssr: false,
    loading: () => <div className="skeleton" />
  })
```

### 22.2 Next.js Optimizasyonlar

```typescript
// Image optimization — her zaman next/image kullan
import Image from 'next/image'
<Image src="/avatar.png" width={400} height={400} priority={false} loading="lazy" />

// Font optimization — local font, no flash
import localFont from 'next/font/local'
const geist = localFont({ src: './GeistVF.woff2', display: 'swap' })

// Bundle analizi:
// next.config.ts → @next/bundle-analyzer ekle
// Hedef: main bundle < 200KB gzipped

// Route-level code splitting otomatik (App Router)
// Ağır bileşenler için dynamic import:
const HeavyChart = dynamic(() => import('./HeavyChart'), { ssr: false })
```

### 22.3 Supabase Query Optimizasyonu

```sql
-- Her sık kullanılan sorgu için index ekle:
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_started_at ON sessions(started_at DESC);
CREATE INDEX idx_mood_entries_user_recorded ON mood_entries(user_id, recorded_at DESC);
CREATE INDEX idx_skills_user_next_review ON skills(user_id, next_review);

-- N+1 query önle — ilişkili veriyi JOIN ile çek:
-- Yanlış: sessions için ayrı, profiles için ayrı sorgu
-- Doğru: SELECT s.*, p.name FROM sessions s JOIN profiles p ON s.user_id = p.id
```

### 22.4 Caching Stratejisi

```
Supabase sorguları → TanStack Query ile cache:
  staleTime: 5 * 60 * 1000  // 5 dakika
  gcTime: 10 * 60 * 1000    // 10 dakika

Static sayfalar → Next.js ISR:
  revalidate: 3600           // 1 saat

API responses → Upstash Redis:
  /api/health/summary → 30 dakika cache
  /api/skills → 5 dakika cache
  /api/mood/history → 1 saat cache

CDN (Cloudflare):
  Media (ses/görsel) → Cache-Control: max-age=31536000
```

---

## 🛠️ BÖLÜM 23: DEPLOYMENT & DEVOPS

### 23.1 Ortam Yapısı

```
development  → local (localhost:3000)
preview      → Vercel preview (her PR için otomatik)
staging      → staging.lyra.app (haftalık deploy)
production   → lyra.app (manuel onay)
```

### 23.2 Environment Variables

```bash
# .env.local (ASLA git'e ekleme!)
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=    # sadece server-side

# AI
OPENAI_API_KEY=
VAPI_API_KEY=
NEXT_PUBLIC_VAPI_KEY=         # sadece public olanlar NEXT_PUBLIC_ prefix
ELEVENLABS_API_KEY=
HUME_API_KEY=

# Payments
STRIPE_SECRET_KEY=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
STRIPE_WEBHOOK_SECRET=

# Notifications
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=

# Email
RESEND_API_KEY=

# Analytics
NEXT_PUBLIC_POSTHOG_KEY=
SENTRY_DSN=
AXIOM_DATASET=
AXIOM_TOKEN=

# Referral
REFERRAL_REWARD_DAYS=30
```

### 23.3 GitHub Actions CI/CD

```yaml
# .github/workflows/ci.yml
name: CI/CD Pipeline
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint
      - run: npm run test:unit
      - run: npm run test:e2e   # Playwright

  deploy-preview:
    needs: test
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - run: vercel deploy --token ${{ secrets.VERCEL_TOKEN }}

  deploy-production:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - run: vercel deploy --prod --token ${{ secrets.VERCEL_TOKEN }}
```

### 23.4 Rollback Planı

```
Vercel: Her deploy snapshot → tek tık rollback
Supabase: Her migration öncesi backup
Database rollback: migration down() her zaman yaz

Monitoring alerti → 5 dakika içinde otomatik rollback trigger:
  IF error_rate > 5% → Sentry alert → Slack #ops → manual rollback
  IF latency p99 > 2s → PostHog alert → investigate
```

---

## 🧪 BÖLÜM 24: TEST STRATEJİSİ (Detaylı)

### 24.1 Test Piramidi

```
          /\
         /  \
        / E2E \     ← 10% (Playwright — kritik user flows)
       /────────\
      /Integration\  ← 20% (API endpoints, DB operations)
     /────────────\
    /   Unit Tests  \  ← 70% (components, utils, algorithms)
   /────────────────\
```

### 24.2 Unit Test (Vitest)

```typescript
// Kaynak: https://vitest.dev
// Test edilecekler:
//   - SM-2 spaced repetition algoritması
//   - Crisis keyword detection
//   - Humor injection kural motoru
//   - PPP fiyat hesaplama
//   - Mood pattern mining

// Örnek:
describe('SM-2 Algorithm', () => {
  it('should increase interval after quality 5 response', () => {
    const result = calculateNextReview({ easeFactor: 2.5, interval: 1, quality: 5 })
    expect(result.interval).toBe(6)
    expect(result.easeFactor).toBeGreaterThan(2.5)
  })
  it('should reset interval after quality < 3', () => {
    const result = calculateNextReview({ easeFactor: 2.5, interval: 14, quality: 2 })
    expect(result.interval).toBe(1)
  })
})
```

### 24.3 E2E Test (Playwright)

```typescript
// Kaynak: https://playwright.dev
// Kritik flow'lar (bunlar MUTLAKA test edilmeli):

test('complete onboarding flow', async ({ page }) => {
  await page.goto('/signup')
  await page.fill('[name=email]', 'test@example.com')
  await page.fill('[name=password]', 'TestPass123!')
  await page.click('button[type=submit]')
  // Onboarding adımları...
  await expect(page).toHaveURL('/dashboard')
})

test('crisis keyword triggers modal', async ({ page }) => {
  // Seans sayfasına git
  // Kriz kelimesi yaz
  await expect(page.locator('[data-testid=crisis-modal]')).toBeVisible()
  await expect(page.locator('[data-testid=crisis-modal]')).toContainText('182')
})

test('payment flow', async ({ page }) => {
  // Stripe test card kullan
  await page.fill('[data-stripe=card]', '4242424242424242')
  // Ödeme tamamla → Pro tier aktif oldu mu?
})
```

### 24.4 Test Coverage Hedefleri

```
Unit tests:    %80+ coverage
Integration:   Tüm API endpoint'ler test edilmiş
E2E:           5 kritik user journey test edilmiş
              (signup, onboarding, session, payment, crisis)
Performance:   Lighthouse CI → her PR'da otomatik
```

---

## 🆘 BÖLÜM 25: ERROR RECOVERY & GRACEFUL DEGRADATION

### 25.1 AI Servisleri Down Olursa

```typescript
// VAPI.ai down → text-only moda geç
// OpenAI down → Claude fallback (zaten tech stack'te var)
// ElevenLabs down → tarayıcı Web Speech API fallback
// Hume AI down → emotion sync devre dışı, seans devam eder

const aiWithFallback = async (input: string) => {
  try {
    return await openai.chat(input)
  } catch (error) {
    if (error.status === 503) {
      return await anthropic.messages.create({ model: 'claude-sonnet-4-6', ... })
    }
    throw error
  }
}
```

### 25.2 Error Boundary Yapısı

```tsx
// Her sayfa için ayrı Error Boundary:
// app/dashboard/error.tsx
'use client'
export default function DashboardError({ error, reset }) {
  return (
    <div className="flex flex-col items-center gap-4 p-8">
      <h2>Bir şeyler ters gitti</h2>
      <p className="text-muted">Lütfen tekrar dene.</p>
      <Button onClick={reset}>Tekrar Dene</Button>
      <Button variant="ghost" onClick={() => window.location.href = '/dashboard'}>
        Ana sayfaya dön
      </Button>
    </div>
  )
}
```

### 25.3 Offline Deneyimi (PWA)

```typescript
// public/sw.js — Service Worker
const CACHE_NAME = 'lyra-v1'
const OFFLINE_URLS = [
  '/dashboard',
  '/session/breathing',   // Nefes egzersizi offline çalışır
  '/journal',             // Günlük offline yazılabilir
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_URLS))
  )
})

// Offline → cache'den sun
// Online → network'e git, cache güncelle (stale-while-revalidate)
```

---

## 🏢 BÖLÜM 26: ADMİN PANELİ (İç Kullanım)

### 26.1 Admin Dashboard Sayfaları

```
/admin                → Genel özet (MRR, DAU, churn)
/admin/users          → Kullanıcı listesi + arama + tier yönetimi
/admin/sessions       → Seans istatistikleri
/admin/crisis-alerts  → Kriz tetikleyen kullanıcılar (acil)
/admin/content        → Humor DB, Boundary Coach senaryoları yönetimi
/admin/flags          → Feature flags yönetimi (PostHog)
/admin/emails         → Email kampanyaları (Resend dashboard linki)
```

### 26.2 Admin Auth

```typescript
// Supabase'de admin role:
// profiles tablosuna role: 'admin' | 'user' | 'moderator' ekle

// Middleware:
if (pathname.startsWith('/admin')) {
  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', session.user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')
}
```

### 26.3 Metrikler (Admin Dashboard)

```
Finansal:
  - MRR (Monthly Recurring Revenue)
  - ARR, churn rate, LTV
  - Tier dağılımı (Free/Basic/Pro/Premium)

Ürün:
  - DAU/MAU (Daily/Monthly Active Users)
  - Ortalama seans süresi
  - Feature kullanım oranları
  - Onboarding funnel dönüşümü

Teknik:
  - API error rate
  - Ortalama response time
  - AI servis uptime
```

---

## 📋 ÖZET

```
Uygulama İsmi: Lyra
Stack: Next.js 15 + Supabase + VAPI.ai + ElevenLabs
Süre: 12 hafta (352 saat)
Ekip: 3 kişi (Talha + 2)
Maliyet Dev: ~$1,400 toplam
Maliyet Prod: ~$1,370/ay (sabit)
Launch: Hafta 12 sonu

Toplam Bölüm: 26
Yeni eklenenler (16-26):
  ✅ Lokalizasyon (TR/EN/AR)
  ✅ Bildirim Sistemi (Push + Email + In-app)
  ✅ SEO & Open Graph
  ✅ Referral & Viral Loop
  ✅ Email Lifecycle Serisi
  ✅ A/B Test & Conversion
  ✅ Performans Optimizasyon
  ✅ Deployment & DevOps
  ✅ Test Stratejisi
  ✅ Error Recovery & PWA Offline
  ✅ Admin Paneli
```
