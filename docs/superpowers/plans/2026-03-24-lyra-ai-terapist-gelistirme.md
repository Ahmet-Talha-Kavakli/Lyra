# Lyra AI Terapist — Kapsamlı Zeka Geliştirme Implementation Planı

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lyra'yı normal terapistten kat kat üstün, 40 kanıtlanmış tekniği bilen, her kullanıcıyı derinlemesine tanıyan devrimsel bir AI terapiste dönüştürmek.

**Architecture:** Mevcut monolitik server.js'i bozmadan, modüler bir katman eklenecek: (1) Psikolojik profil sistemi Supabase'de saklanacak, (2) 40 teknik kütüphanesi ve terapi motoru ayrı modüllerde tutulacak, (3) Her seans başında bu verilerden dinamik sistem promptu oluşturulacak.

**Tech Stack:** Node.js/Express, Supabase, OpenAI GPT-4o, ES Modules

**Spec:** `docs/superpowers/specs/2026-03-24-lyra-ai-terapist-gelistirme-design.md`

---

## Dosya Yapısı

### Yeni Oluşturulacak
```
profile/
  profileManager.js       — Supabase profil okuma/yazma/güncelleme
  profileExtractor.js     — Seansdan AI ile profil güncelleme (6 katman)

therapy/
  techniqueLibrary.js     — 40 teknik tanımı + metadata
  therapyEngine.js        — Mod seçimi + teknik seçimi mantığı
  promptBuilder.js        — Profil + teknik + mod → dinamik sistem promptu

progress/
  sessionAnalyzer.js      — Seans sonrası analiz (breakthrough, kazanım, vb.)
  progressTracker.js      — Haftalık/aylık ilerleme metrikleri

crisis/
  crisisDetector.js       — Zor an tespiti (sakin tonlu)
  stabilizationProtocol.js — Stabilizasyon ve zor an yanıt protokolü
```

### Değiştirilecek
```
config.js                 — SYSTEM_PROMPT tamamen yeniden yazılacak
server.js                 — /chat endpoint'ine profil + motor entegrasyonu
```

### Supabase Yeni Tablolar
```
psychological_profiles    — 6 katmanlı psikolojik profil (JSON)
session_records           — Seans kayıtları + analiz sonuçları
technique_effectiveness   — Hangi teknik bu kullanıcıya işe yaradı
progress_metrics          — Haftalık/aylık ilerleme skoru
```

---

## Chunk 1: Psikolojik Profil Sistemi

### Task 1: Supabase Profil Tablosu

**Files:**
- Create: `profile/profileManager.js`

- [ ] **Step 1: Supabase'de psychological_profiles tablosunu oluştur**

Supabase SQL Editor'da şu komutu çalıştır:

```sql
CREATE TABLE psychological_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,

  -- Katman 1: Temel Psikoloji
  attachment_style TEXT DEFAULT 'belirsiz',        -- guvenli | kacıngan | endiseli | belirsiz
  triggers JSONB DEFAULT '[]'::jsonb,              -- [{ konu, etki, ornek }]
  core_values JSONB DEFAULT '[]'::jsonb,           -- [{ deger, oncelik }]
  defense_mechanisms JSONB DEFAULT '[]'::jsonb,    -- [{ mekanizma, sıklık }]
  language_style JSONB DEFAULT '{}'::jsonb,        -- { resmiyet, mizah, metafor_kullanimi, kelime_hazi }

  -- Katman 2: Bilinçdışı Desenler
  unconscious_patterns JSONB DEFAULT '[]'::jsonb,  -- [{ desen, ornekler, guc_skoru }]

  -- Katman 3: İlişki Haritası
  relationship_map JSONB DEFAULT '[]'::jsonb,      -- [{ isim, rol, dinamik, duygusal_ton }]

  -- Katman 4: Yaşam Şeması
  life_schemas JSONB DEFAULT '[]'::jsonb,          -- [{ sema, kaynak, guc, calisilan_mi }]

  -- Katman 5: İyileşme Stili
  healing_style JSONB DEFAULT '{}'::jsonb,         -- { mod, hiz, tercih, calisan_teknikler }

  -- Katman 6: Güç + Umut
  strengths JSONB DEFAULT '[]'::jsonb,             -- [{ guc, ornek }]
  hope_map JSONB DEFAULT '{}'::jsonb,              -- { uzun_vadeli_hedef, kisa_adimlar, degerler }

  -- Meta
  session_count INTEGER DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW()
);
```

- [ ] **Step 2: session_records tablosunu oluştur**

```sql
CREATE TABLE session_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL UNIQUE,

  -- Seans Özeti
  dominant_emotion TEXT,
  topics JSONB DEFAULT '[]'::jsonb,
  techniques_used JSONB DEFAULT '[]'::jsonb,
  breakthrough_moment BOOLEAN DEFAULT FALSE,
  breakthrough_note TEXT,

  -- Seans Skoru
  emotional_start_score INTEGER,                   -- 1-10 (başlangıç)
  emotional_end_score INTEGER,                     -- 1-10 (bitiş)

  -- Profil Güncellemeleri
  profile_updates JSONB DEFAULT '{}'::jsonb,

  -- Seans Sonu Görev
  homework TEXT,

  created_at TIMESTAMP DEFAULT NOW()
);
```

- [ ] **Step 3: technique_effectiveness tablosunu oluştur**

```sql
CREATE TABLE technique_effectiveness (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  technique_id TEXT NOT NULL,
  used_count INTEGER DEFAULT 0,
  positive_responses INTEGER DEFAULT 0,
  last_used TIMESTAMP,
  UNIQUE(user_id, technique_id)
);
```

- [ ] **Step 4: progress_metrics tablosunu oluştur**

```sql
CREATE TABLE progress_metrics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  week_start DATE NOT NULL,
  avg_emotional_score FLOAT,
  session_count INTEGER DEFAULT 0,
  breakthroughs INTEGER DEFAULT 0,
  patterns_broken JSONB DEFAULT '[]'::jsonb,
  skills_gained JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  UNIQUE(user_id, week_start)
);
```

- [ ] **Step 5: profileManager.js oluştur**

```javascript
// profile/profileManager.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export const EMPTY_PROFILE = {
  attachment_style: 'belirsiz',
  triggers: [],
  core_values: [],
  defense_mechanisms: [],
  language_style: {},
  unconscious_patterns: [],
  relationship_map: [],
  life_schemas: [],
  healing_style: {},
  strengths: [],
  hope_map: {},
  session_count: 0
};

/**
 * Kullanıcı profilini getirir. Yoksa boş profil döner.
 */
export const getProfile = async (userId) => {
  const { data, error } = await supabase
    .from('psychological_profiles')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !data) return { ...EMPTY_PROFILE, user_id: userId };
  return data;
};

/**
 * Profili günceller. Mevcut verilerle merge yapar.
 */
export const updateProfile = async (userId, updates) => {
  const existing = await getProfile(userId);

  const merged = {
    user_id: userId,
    attachment_style: updates.attachment_style || existing.attachment_style,
    triggers: mergeArrayById(existing.triggers, updates.triggers || [], 'konu'),
    core_values: mergeArrayById(existing.core_values, updates.core_values || [], 'deger'),
    defense_mechanisms: mergeArrayById(existing.defense_mechanisms, updates.defense_mechanisms || [], 'mekanizma'),
    language_style: { ...existing.language_style, ...(updates.language_style || {}) },
    unconscious_patterns: mergeArrayById(existing.unconscious_patterns, updates.unconscious_patterns || [], 'desen'),
    relationship_map: mergeArrayById(existing.relationship_map, updates.relationship_map || [], 'isim'),
    life_schemas: mergeArrayById(existing.life_schemas, updates.life_schemas || [], 'sema'),
    healing_style: { ...existing.healing_style, ...(updates.healing_style || {}) },
    strengths: mergeArrayById(existing.strengths, updates.strengths || [], 'guc'),
    hope_map: { ...existing.hope_map, ...(updates.hope_map || {}) },
    session_count: (existing.session_count || 0) + 1,
    last_updated: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from('psychological_profiles')
    .upsert(merged, { onConflict: 'user_id' })
    .select()
    .single();

  if (error) throw new Error(`Profil güncellenemedi: ${error.message}`);
  return data;
};

/**
 * İki diziyi id alanına göre merge eder.
 * Yeni eleman varsa ekler, varsa günceller.
 */
const mergeArrayById = (existing, incoming, idField) => {
  if (!incoming || incoming.length === 0) return existing;
  const map = {};
  (existing || []).forEach(item => { map[item[idField]] = item; });
  incoming.forEach(item => {
    if (item[idField]) {
      map[item[idField]] = { ...map[item[idField]], ...item };
    }
  });
  return Object.values(map);
};
```

- [ ] **Step 6: Commit**

```bash
git add profile/profileManager.js
git commit -m "feat: psikolojik profil sistemi — Supabase schema + profileManager"
```

---

### Task 2: Profil Çıkarma Sistemi (AI ile)

**Files:**
- Create: `profile/profileExtractor.js`

- [ ] **Step 1: profileExtractor.js oluştur**

```javascript
// profile/profileExtractor.js
import OpenAI from 'openai';
import dotenv from 'dotenv';
dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/**
 * Bir seans transkriptinden psikolojik profil güncellemelerini çıkarır.
 * Direkt soru sormak yerine konuşmadan çıkarım yapar.
 */
export const extractProfileUpdates = async (transcript, currentProfile) => {
  if (!transcript || transcript.length < 100) return null;

  const prompt = `Sen bir klinik psikologsun. Aşağıdaki terapi konuşmasını analiz et ve psikolojik profil güncellemelerini çıkar.

MEVCUT PROFİL:
${JSON.stringify(currentProfile, null, 2)}

KONUŞMA:
"${transcript.substring(0, 2000)}"

Konuşmadan çıkarılabilecek yeni veya güncellenmiş bilgileri JSON olarak döndür.
Sadece konuşmadan açıkça veya ima yoluyla anlaşılabilecek şeyleri yaz.
Emin olmadığın şeyleri ekleme.

JSON FORMATINDA DÖNDÜR:
{
  "attachment_style": "guvenli|kacıngan|endiseli|belirsiz|null",
  "triggers": [{ "konu": "string", "etki": "string", "ornek": "string" }],
  "core_values": [{ "deger": "string", "oncelik": "yüksek|orta|düşük" }],
  "defense_mechanisms": [{ "mekanizma": "string", "sıklık": "sık|ara sıra|nadir" }],
  "language_style": { "resmiyet": "resmi|samimi", "mizah": true/false, "dogrudan": true/false },
  "unconscious_patterns": [{ "desen": "string", "ornekler": ["string"], "guc_skoru": 0.0-1.0 }],
  "relationship_map": [{ "isim": "string", "rol": "string", "dinamik": "string", "duygusal_ton": "string" }],
  "life_schemas": [{ "sema": "string", "kaynak": "string", "guc": 0.0-1.0 }],
  "healing_style": { "mod": "konuşarak|sessizlik|eylemle", "hiz": "yavaş|orta|hızlı", "tercih": "duygusal_doğrulama|çözüm_odaklı" },
  "strengths": [{ "guc": "string", "ornek": "string" }],
  "hope_map": { "uzun_vadeli_hedef": "string", "kisa_adimlar": ["string"], "degerler": ["string"] }
}

Null olan alanları JSON'a dahil etme. Sadece konuşmadan çıkarılabilenleri yaz.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 1000
    });

    const text = response.choices[0].message.content || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const updates = JSON.parse(jsonMatch[0]);
    console.log('[ProfileExtractor] Profil güncellemeleri çıkarıldı:', Object.keys(updates));
    return updates;
  } catch (err) {
    console.warn('[ProfileExtractor] Hata:', err.message);
    return null;
  }
};

/**
 * Seans analizi için breakthrough ve kazanım tespiti.
 */
export const analyzeSession = async (transcript, profile) => {
  if (!transcript || transcript.length < 50) return null;

  const prompt = `Aşağıdaki terapi seansını analiz et.

KONUŞMA:
"${transcript.substring(0, 1500)}"

JSON formatında döndür:
{
  "dominant_emotion": "string",
  "emotional_start_score": 1-10,
  "emotional_end_score": 1-10,
  "topics": ["string"],
  "breakthrough_moment": true/false,
  "breakthrough_note": "string veya null",
  "homework": "Bu hafta için küçük bir görev önerisi (string veya null)"
}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 400
    });

    const text = response.choices[0].message.content || '{}';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    return JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.warn('[ProfileExtractor] Seans analiz hatası:', err.message);
    return null;
  }
};
```

- [ ] **Step 2: Commit**

```bash
git add profile/profileExtractor.js
git commit -m "feat: profil çıkarma sistemi — seansdan AI ile 6 katman profil güncelleme"
```

---

## Chunk 2: Teknik Kütüphanesi + Terapi Motoru

### Task 3: 40 Teknik Kütüphanesi

**Files:**
- Create: `therapy/techniqueLibrary.js`

- [ ] **Step 1: techniqueLibrary.js oluştur**

```javascript
// therapy/techniqueLibrary.js

export const TECHNIQUES = {
  // ─── BİLİŞSEL / DÜŞÜNCE ODAKLI ─────────────────────────
  CBT: {
    id: 'CBT',
    name: 'Bilişsel Davranışçı Terapi',
    category: 'bilissel',
    description: 'Olumsuz düşünce kalıplarını tespit edip gerçekçi alternatiflerle değiştirmek',
    when_to_use: ['negatif_düşünce', 'felaket_senaryosu', 'siyah_beyaz_düşünce', 'öz_eleştiri'],
    prompt_hint: 'Bu düşünceyi nazikçe sars. "Sence bu durumun gerçekten tek açıklama şekli mi?" gibi sorular sor.',
    contraindicated: ['akut_kriz', 'yoğun_üzüntü_ilk_dakikalar']
  },
  REBT: {
    id: 'REBT',
    name: 'Rasyonel Duygusal Davranış Terapisi',
    category: 'bilissel',
    description: 'Mantıksız inanç sistemlerini tespit etmek',
    when_to_use: ['mutlak_düşünce', 'zorunda_cümleleri', 'kendini_suçlama'],
    prompt_hint: '"Kesinlikle böyle olmalı" gibi kalıpları fark ettirip sorgulat.',
    contraindicated: ['stabilizasyon_modu']
  },
  MBCT: {
    id: 'MBCT',
    name: 'Farkındalık Tabanlı Bilişsel Terapi',
    category: 'bilissel',
    description: 'Mindfulness + bilişsel terapi birleşimi, tekrarlayan depresyonu önler',
    when_to_use: ['tekrarlayan_depresyon', 'ruminasyon', 'geçmişte_takılma'],
    prompt_hint: 'Şu ana getir. "Şu an bu düşünceyi gözlemliyorsun — sen o düşünce değilsin."',
    contraindicated: []
  },
  CPT: {
    id: 'CPT',
    name: 'Bilişsel İşleme Terapisi',
    category: 'bilissel',
    description: 'PTSD ve travma sonrası çarpık düşünceleri yeniden yapılandırma',
    when_to_use: ['travma', 'PTSD', 'suçluluk_travmadan', 'utanç_travmadan'],
    prompt_hint: 'Travma ile ilgili "kendi hatam" düşüncelerini nazikçe sorgula.',
    contraindicated: ['stabilizasyon_modu', 'yeni_tanışma']
  },
  SFBT: {
    id: 'SFBT',
    name: 'Çözüm Odaklı Kısa Terapi',
    category: 'bilissel',
    description: 'Sorundan çözüme odaklanmak, işe yarayanı büyütmek',
    when_to_use: ['çıkmaz_hissi', 'ne_yapacağını_bilmeme', 'motivasyon_eksikliği'],
    prompt_hint: '"Bu hafta az da olsa daha iyi gittiği bir an var mıydı?" diye sor.',
    contraindicated: []
  },

  // ─── KONUŞMA / İLİŞKİ ODAKLI ────────────────────────────
  PCT: {
    id: 'PCT',
    name: 'Kişi Merkezli Terapi',
    category: 'iliskisel',
    description: 'Koşulsuz kabul, yargısız dinleme, Rogers yaklaşımı',
    when_to_use: ['her_zaman', 'güven_inşası', 'yeni_kullanici'],
    prompt_hint: 'Yargılamadan kabul et. Söyleneni yansıt, derinleştir.',
    contraindicated: []
  },
  MI: {
    id: 'MI',
    name: 'Motivasyonel Görüşme',
    category: 'iliskisel',
    description: 'Değişim direncini eritmek, kişinin kendi motivasyonunu keşfetmesi',
    when_to_use: ['degisim_direnci', 'ambivalans', 'yok_ne_fark_eder'],
    prompt_hint: '"Değişmek istemek ile değişmemek istemek — ikisi de var gibi görünüyor. Bu çatışma nasıl hissettiriyor?"',
    contraindicated: []
  },
  NARRATIVE: {
    id: 'NARRATIVE',
    name: 'Anlatı Terapisi',
    category: 'iliskisel',
    description: 'Hayat hikayesini yeniden yazmak, kişiyi sorundan ayırmak',
    when_to_use: ['kimlik_sorunu', 'etiketlenme', 'ben_böyleyim_diyenler'],
    prompt_hint: '"Sen sorunun kendisi değilsin. Sorun dışarıda bir şey. Peki sen kim?" diye yaklaş.',
    contraindicated: []
  },
  IPT: {
    id: 'IPT',
    name: 'Kişilerarası Terapi',
    category: 'iliskisel',
    description: 'İlişki çatışmaları ve dinamiklerini çözmek',
    when_to_use: ['ilişki_sorunu', 'yas_kayıp', 'rol_geçişi', 'yalnızlık'],
    prompt_hint: 'İlişki haritasına bak. O kişiyle bu dinamiği keşfet.',
    contraindicated: []
  },
  TA: {
    id: 'TA',
    name: 'Transaksiyonel Analiz',
    category: 'iliskisel',
    description: 'Ebeveyn / Yetişkin / Çocuk ego durumları, ilişki oyunları',
    when_to_use: ['ilişki_döngüleri', 'tekrar_eden_çatışmalar', 'otorite_sorunları'],
    prompt_hint: 'Şu an hangi ego durumundan konuştuğunu nazikçe fark ettir.',
    contraindicated: ['yeni_kullanici']
  },
  ATTACHMENT: {
    id: 'ATTACHMENT',
    name: 'Bağlanma Temelli Terapi',
    category: 'iliskisel',
    description: 'Bağlanma yaraları ve tekrar eden ilişki döngüleri',
    when_to_use: ['ilişki_döngüleri', 'terk_korkusu', 'bağlanma_sorunu'],
    prompt_hint: 'Bağlanma stilini kullan. "Bu ilişkide kendinle ilgili ne düşünüyorsun?" diye sor.',
    contraindicated: []
  },

  // ─── DUYGU ODAKLI ────────────────────────────────────────
  DBT: {
    id: 'DBT',
    name: 'Diyalektik Davranış Terapisi',
    category: 'duygu',
    description: 'Yoğun duygularla başa çıkmak için somut araçlar',
    when_to_use: ['yoğun_duygu', 'öfke_patlaması', 'panik', 'kendine_zarar'],
    prompt_hint: 'Somut bir beceri öner: TIPP, STOP, TIP tekniklerinden uygun olanı.',
    contraindicated: []
  },
  ACT: {
    id: 'ACT',
    name: 'Kabul ve Kararlılık Terapisi',
    category: 'duygu',
    description: 'Duyguları kabul etmek, değerlere doğru hareket etmek',
    when_to_use: ['duygudan_kaçma', 'kontrolü_kaybetme_korkusu', 'bastırma'],
    prompt_hint: '"Bu duyguyu ortadan kaldırmak zorunda değilsin. Onunla birlikte olmak nasıl?" diye sor.',
    contraindicated: []
  },
  EFT: {
    id: 'EFT',
    name: 'Duygusal Odaklı Terapi',
    category: 'duygu',
    description: 'Duygusal bağ ve güvenli ilişki kurma',
    when_to_use: ['ilişki_sorunu', 'bağ_kurma_zorluğu', 'duygusal_kopukluk'],
    prompt_hint: 'Temel duyguya ulaş. "Bunun altında ne var? En derininde ne hissediyorsun?" diye sor.',
    contraindicated: []
  },
  CFT: {
    id: 'CFT',
    name: 'Şefkat Odaklı Terapi',
    category: 'duygu',
    description: 'Öz-şefkat geliştirmek, iç eleştirmenle barışmak',
    when_to_use: ['öz_eleştiri', 'mükemmeliyetçilik', 'kendini_suçlama', 'utanç'],
    prompt_hint: '"Bir arkadaşın aynı şeyi yaşasaydı ne derdin?" sorusunu kullan.',
    contraindicated: []
  },
  GRIEF: {
    id: 'GRIEF',
    name: 'Yas ve Kayıp Çalışması',
    category: 'duygu',
    description: 'Kayıp, yas ve büyük değişimlerle çalışmak',
    when_to_use: ['kayıp', 'yas', 'ayrılık', 'iş_kaybı', 'kimlik_kaybı'],
    prompt_hint: 'Yasın aşamalarını zorlamadan tut. "Bu kaybı kabullenmek nasıl hissettiriyor?" diye sor.',
    contraindicated: []
  },
  INNER_CHILD: {
    id: 'INNER_CHILD',
    name: 'İç Çocuk Çalışması',
    category: 'duygu',
    description: 'Çocukluk yaraları ile yüzleşmek ve iyileştirmek',
    when_to_use: ['çocukluk_travması', 'ebeveyn_yarası', 'değersizlik_hissi'],
    prompt_hint: 'O küçük çocuğa ne söylemek isterdin? Nazikçe sor.',
    contraindicated: ['yeni_kullanici', 'stabilizasyon_modu']
  },

  // ─── DERİN PSİKOLOJİ ─────────────────────────────────────
  PSYCHODYNAMIC: {
    id: 'PSYCHODYNAMIC',
    name: 'Psikanalitik / Psikdinamik Terapi',
    category: 'derin',
    description: 'Bilinçdışı kalıplar ve geçmişin bugüne etkisi',
    when_to_use: ['tekrarlayan_desenler', 'anlamsız_tepkiler', 'geçmiş_bağlantısı'],
    prompt_hint: '"Bu tepki seni başka bir zamana, başka bir yere götürüyor mu?" diye sor.',
    contraindicated: ['yeni_kullanici', 'stabilizasyon_modu']
  },
  SCHEMA: {
    id: 'SCHEMA',
    name: 'Şema Terapisi',
    category: 'derin',
    description: 'Çocukluktan gelen derin inanç sistemlerini değiştirmek',
    when_to_use: ['derin_inanç_sistemi', 'yeterli_değilim', 'terk_edilme_korkusu'],
    prompt_hint: 'Bu inancın nereden geldiğini keşfet. "Bu inanç ne zaman başladı?" diye sor.',
    contraindicated: ['yeni_kullanici']
  },
  IFS: {
    id: 'IFS',
    name: 'İç Aile Sistemi',
    category: 'derin',
    description: 'İçimizdeki farklı parçalar — koruyucu, yaralı, eleştiren',
    when_to_use: ['çatışan_duygular', 'iç_ses', 'çelişki'],
    prompt_hint: '"Sende şu an bu kararı veren parça kim?" Parçalarla çalış.',
    contraindicated: ['yeni_kullanici', 'stabilizasyon_modu']
  },
  GESTALT: {
    id: 'GESTALT',
    name: 'Gestalt Terapisi',
    category: 'derin',
    description: 'Şu an, tamamlanmamış işler, farkındalık',
    when_to_use: ['şu_an_odaklanma', 'tamamlanmamış_iş', 'bastırılmış_duygu'],
    prompt_hint: '"Şu an, bu anda ne oluyor? Ne hissediyorsun tam şu an?"',
    contraindicated: []
  },
  EXISTENTIAL: {
    id: 'EXISTENTIAL',
    name: 'Varoluşçu Terapi',
    category: 'derin',
    description: 'Anlam, ölüm korkusu, özgürlük, yalnızlık temaları',
    when_to_use: ['anlamsızlık', 'varoluş_kaygısı', 'ölüm_korkusu', 'özgürlük_sorunu'],
    prompt_hint: '"Sence hayatında neyin önemi var? Gerçekten?" diye sor.',
    contraindicated: ['stabilizasyon_modu']
  },
  LOGOTHERAPY: {
    id: 'LOGOTHERAPY',
    name: 'Logоterapi (Frankl)',
    category: 'derin',
    description: 'Acıya anlam bulmak, yaşam amacı keşfi',
    when_to_use: ['anlamsızlık', 'umutsuzluk', 'neden_yaşıyorum'],
    prompt_hint: '"Bu acıdan bir anlam çıkarılabilse, ne olurdu?" diye sor.',
    contraindicated: ['stabilizasyon_modu', 'akut_kriz']
  },

  // ─── BEDEN / FİZYOLOJİ ODAKLI ────────────────────────────
  SOMATIC: {
    id: 'SOMATIC',
    name: 'Somatik Deneyimleme',
    category: 'beden',
    description: 'Travmanın bedende tutulması ve serbest bırakılması',
    when_to_use: ['bedensel_semptom', 'travma', 'donma_tepkisi', 'panik'],
    prompt_hint: '"Bu duyguyu şu an bedeninde nerede hissediyorsun?" diye sor.',
    contraindicated: []
  },
  MINDFULNESS: {
    id: 'MINDFULNESS',
    name: 'Farkındalık & Beden Taraması',
    category: 'beden',
    description: 'Beden farkındalığı, şu an odaklanma',
    when_to_use: ['dağınıklık', 'kaygı', 'zihinden_uzaklaşma'],
    prompt_hint: 'Kısa bir beden taraması yap. "Gözlerin kapalı, omuzlarını düşür..." gibi rehberlik et.',
    contraindicated: []
  },
  BREATHING: {
    id: 'BREATHING',
    name: 'Nefes Protokolleri',
    category: 'beden',
    description: 'Anksiyete ve panik için fizyolojik düzenleme',
    when_to_use: ['panik', 'anksiyete', 'nefes_sıkışması', 'stabilizasyon_gerekli'],
    prompt_hint: '"Şu an benimle birlikte bir nefes alalım mı? Dörte kadar say..." şeklinde yönlendir.',
    contraindicated: []
  },
  EMDR: {
    id: 'EMDR',
    name: 'EMDR Prensipleri',
    category: 'beden',
    description: 'Travmatik anıların işlenmesi',
    when_to_use: ['travma', 'PTSD', 'takılı_kalmış_anı'],
    prompt_hint: 'O anıya nazikçe git. "O an aklına geldiğinde bedeninde ne oluyor?" diye sor.',
    contraindicated: ['yeni_kullanici', 'stabilizasyon_modu']
  },
  SOMATIC_EMDR: {
    id: 'SOMATIC_EMDR',
    name: 'Somatik EMDR',
    category: 'beden',
    description: 'EMDR + beden çalışması birleşimi',
    when_to_use: ['travma', 'bedensel_travma_tutulumu'],
    prompt_hint: 'Hem anıya hem bedene odaklan. Travmatik anı + beden hissi birlikte işle.',
    contraindicated: ['yeni_kullanici', 'stabilizasyon_modu']
  },

  // ─── DAVRANIŞ / EYLEM ODAKLI ─────────────────────────────
  BEHAVIORAL_ACTIVATION: {
    id: 'BEHAVIORAL_ACTIVATION',
    name: 'Davranışsal Aktivasyon',
    category: 'davranis',
    description: 'Depresyonda eylemsizlik döngüsünü kırmak',
    when_to_use: ['depresyon', 'eylemsizlik', 'çekilme', 'motivasyon_yok'],
    prompt_hint: '"Bugün çok küçük bir şey — gerçekten çok küçük — ne yapabilirsin?" diye sor.',
    contraindicated: []
  },
  EXPOSURE: {
    id: 'EXPOSURE',
    name: 'Maruz Kalma Prensipleri',
    category: 'davranis',
    description: 'Korkulandan kaçmak yerine kontrollü yaklaşmak',
    when_to_use: ['fobi', 'kaçınma', 'OCD', 'sosyal_anksiyete'],
    prompt_hint: '"Bu durumdan kaçmak onu daha büyük yapıyor. Küçük bir adım atmak nasıl hissettirirdi?" diye sor.',
    contraindicated: ['stabilizasyon_modu']
  },
  PROBLEM_SOLVING: {
    id: 'PROBLEM_SOLVING',
    name: 'Problem Çözme Terapisi',
    category: 'davranis',
    description: 'Pratik, adım adım sorun çözme',
    when_to_use: ['pratik_sorun', 'karar_verememe', 'çıkmaz'],
    prompt_hint: '"Bu sorunu küçük parçalara ayıralım. İlk adım ne olabilir?" diye sor.',
    contraindicated: []
  },
  SPACED_REPETITION: {
    id: 'SPACED_REPETITION',
    name: 'Aralıklı Tekrar',
    category: 'davranis',
    description: 'Öğrenilen beceriyi 3/7/30 günde pekiştirmek',
    when_to_use: ['yeni_beceri', 'alışkanlık_oluşturma'],
    prompt_hint: '"Bu beceriyi 3 gün sonra, sonra 7 gün sonra tekrar deneyelim." şeklinde plan yap.',
    contraindicated: []
  },
  HABIT_REDESIGN: {
    id: 'HABIT_REDESIGN',
    name: 'Alışkanlık Yeniden Tasarımı',
    category: 'davranis',
    description: 'Kötü alışkanlıkları yeni döngülerle değiştirmek',
    when_to_use: ['kötü_alışkanlık', 'döngü_kırma', 'tekrarlayan_davranış'],
    prompt_hint: '"Bu döngüde tetikleyici ne? Tepki ne? Ödül ne? Ödülü koruyup tepkiyi değiştirebilir miyiz?"',
    contraindicated: []
  },

  // ─── POZİTİF / ANLAM ODAKLI ──────────────────────────────
  POSITIVE_PSYCH: {
    id: 'POSITIVE_PSYCH',
    name: 'Pozitif Psikoloji',
    category: 'pozitif',
    description: 'Güçlü yönler, minnet, anlam odaklanması',
    when_to_use: ['güç_odaklı', 'minnet', 'anlam_arayışı'],
    prompt_hint: '"Bu hafta seni küçük de olsa iyi hissettiren bir an var mıydı?" diye sor.',
    contraindicated: []
  },
  PTG: {
    id: 'PTG',
    name: 'Travma Sonrası Büyüme',
    category: 'pozitif',
    description: 'Acıdan güç çıkarmak, dönüşüm',
    when_to_use: ['iyileşme_sürecinde', 'travma_sonrası', 'anlam_arayışı'],
    prompt_hint: '"Bu deneyim sana bir şey öğrettiyse, ne öğretti?" diye sor — sadece kişi hazırsa.',
    contraindicated: ['akut_kriz', 'taze_travma']
  },
  VALUES_CLARIFICATION: {
    id: 'VALUES_CLARIFICATION',
    name: 'Değerler Netleştirme',
    category: 'pozitif',
    description: 'Gerçekten neyin önemli olduğunu bulmak',
    when_to_use: ['yön_kaybı', 'anlamsızlık', 'karar_krizleri'],
    prompt_hint: '"Hayatında gerçekten önemli olan 3 şey olsaydı, ne olurdu?"',
    contraindicated: []
  },
  FUTURE_SELF: {
    id: 'FUTURE_SELF',
    name: 'Gelecek Benlik Görselleştirme',
    category: 'pozitif',
    description: 'Gelecekteki benliği canlandırma, motivasyon',
    when_to_use: ['motivasyon_eksikliği', 'yön_kaybı', 'büyüme_modu'],
    prompt_hint: '"5 yıl sonra, bu sorunları aşmış biri olarak ne yapıyorsun?" diye sor.',
    contraindicated: ['stabilizasyon_modu']
  },
  STRENGTHS_BASED: {
    id: 'STRENGTHS_BASED',
    name: 'Güç Temelli Terapi',
    category: 'pozitif',
    description: 'Var olan güce ve kaynaklara odaklanmak',
    when_to_use: ['özgüven_sorunu', 'güçsüzlük_hissi'],
    prompt_hint: 'Profildeki güçlü yönleri kullan. "Bu durumu daha önce aşmıştın — nasıl yapmıştın?"',
    contraindicated: []
  },

  // ─── KRİZ & TRAVMA ───────────────────────────────────────
  TRAUMA_INFORMED: {
    id: 'TRAUMA_INFORMED',
    name: 'Travma Bilinçli Yaklaşım',
    category: 'kriz',
    description: 'Her konuşmada travma hassasiyeti — her zaman aktif',
    when_to_use: ['her_zaman'],
    prompt_hint: 'Travma geçmişi olan kişiye yavaş git. Kontrol hissini koru. Sürpriz konular açma.',
    contraindicated: []
  },
  CRISIS_STABILIZATION: {
    id: 'CRISIS_STABILIZATION',
    name: 'Kriz Stabilizasyonu',
    category: 'kriz',
    description: 'Akut krizde sakinleştirme ve güvenli alan oluşturma',
    when_to_use: ['akut_kriz', 'yoğun_duygu', 'stabilizasyon_modu'],
    prompt_hint: 'Önce orada ol. Nefes. Güvenli alan. Çözüm sonra gelir.',
    contraindicated: []
  }
};

/**
 * Belirtilen duruma uygun teknikleri döndür.
 */
export const getTechniquesForSituation = (situation, healingStyle = {}) => {
  const applicable = Object.values(TECHNIQUES).filter(t => {
    if (t.contraindicated.includes(situation)) return false;
    if (t.when_to_use.includes('her_zaman')) return true;
    return t.when_to_use.some(w => situation.includes(w) || w.includes(situation));
  });
  return applicable;
};

/**
 * Teknik etkinlik skoruna göre sırala.
 */
export const rankTechniques = (techniques, effectivenessData = []) => {
  return techniques.sort((a, b) => {
    const aScore = effectivenessData.find(e => e.technique_id === a.id);
    const bScore = effectivenessData.find(e => e.technique_id === b.id);
    const aRatio = aScore ? aScore.positive_responses / Math.max(aScore.used_count, 1) : 0.5;
    const bRatio = bScore ? bScore.positive_responses / Math.max(bScore.used_count, 1) : 0.5;
    return bRatio - aRatio;
  });
};
```

- [ ] **Step 2: Commit**

```bash
git add therapy/techniqueLibrary.js
git commit -m "feat: 40 teknik kütüphanesi — 7 kategoride kanıtlanmış terapi teknikleri"
```

---

### Task 4: Terapi Motoru

**Files:**
- Create: `therapy/therapyEngine.js`

- [ ] **Step 1: therapyEngine.js oluştur**

```javascript
// therapy/therapyEngine.js
import { TECHNIQUES, getTechniquesForSituation, rankTechniques } from './techniqueLibrary.js';

// ─── MOD SİSTEMİ ─────────────────────────────────────────
export const MODES = {
  LISTENING: {
    id: 'LISTENING',
    name: 'Dinleme Modu',
    description: 'Sadece dinle, yansıt, doğrula. Çözüm yok, tavsiye yok.',
    when: ['ilk_kez_açılıyor', 'yoğun_duygu', 'ağlama', 'ihtiyaç_duyulmak'],
    prompt_instruction: 'SADECE dinle ve yansıt. Kısa cümleler. "Devam et, dinliyorum" enerjisi. Çözüm SUNMA.'
  },
  EXPLORATION: {
    id: 'EXPLORATION',
    name: 'Keşif Modu',
    description: 'Derinleştirici sorularla içe açılmayı sağla.',
    when: ['merak', 'yüzeysel_kalıyor', 'daha_fazla_var'],
    prompt_instruction: 'Açık uçlu, derinleştirici sorular sor. Bir anda bir soru. Acele etme.'
  },
  WORKING: {
    id: 'WORKING',
    name: 'Çalışma Modu',
    description: 'Aktif teknik uygula. Kişi açılmış, hazır.',
    when: ['hazır', 'güven_kuruldu', 'değişim_istiyor'],
    prompt_instruction: 'Seçilen tekniği uygula. Aktif çalışma zamanı.'
  },
  GROWTH: {
    id: 'GROWTH',
    name: 'Büyüme Modu',
    description: 'Kazanımları pekiştir, ileriyi planla.',
    when: ['iyi_hissediyor', 'breakthrough_sonrası', 'ilerliyor'],
    prompt_instruction: 'Kazanımları kutla ve pekiştir. Bir sonraki adımı planla.'
  },
  STABILIZATION: {
    id: 'STABILIZATION',
    name: 'Stabilizasyon Modu',
    description: 'Zor anlarda önce güvenli alan oluştur.',
    when: ['kriz', 'panik', 'çöküş', 'kendine_zarar_düşüncesi'],
    prompt_instruction: 'Önce güvenli alan. Nefes. Sakin ton. Hiçbir şey çok ağır değil. Yavaş.'
  }
};

/**
 * Mevcut duruma göre en uygun modu seç.
 */
export const selectMode = (currentEmotion, messageContent, sessionHistory, profile) => {
  const content = messageContent.toLowerCase();

  // Stabilizasyon kontrolü — önce
  const crisisSignals = [
    'intihar', 'ölmek istiyorum', 'kendime zarar', 'dayanamıyorum artık',
    'bırakmak istiyorum', 'anlamsız', 'hiçbir şeyin önemi yok'
  ];
  if (crisisSignals.some(s => content.includes(s))) {
    return MODES.STABILIZATION;
  }

  // Yoğun duygu — dinleme modu
  const intenseEmotions = ['ağlıyorum', 'çok üzgün', 'kırıldım', 'dayanamıyorum', 'çok ağır'];
  if (intenseEmotions.some(s => content.includes(s))) {
    return MODES.LISTENING;
  }

  // Breakthrough sonrası veya pozitif ilerleme — büyüme
  const growthSignals = ['daha iyi hissediyorum', 'anladım', 'fark ettim', 'değişti'];
  if (growthSignals.some(s => content.includes(s))) {
    return MODES.GROWTH;
  }

  // Yüzeysel veya az bilgi — keşif
  if (sessionHistory.length < 3 || messageContent.length < 50) {
    return MODES.EXPLORATION;
  }

  // Varsayılan — çalışma modu
  return MODES.WORKING;
};

/**
 * Profil + durum + mod'a göre en iyi teknikleri seç.
 */
export const selectTechniques = (mode, profile, currentEmotion, topics, effectivenessData = []) => {
  if (mode.id === 'STABILIZATION') {
    return [TECHNIQUES.CRISIS_STABILIZATION, TECHNIQUES.BREATHING, TECHNIQUES.MINDFULNESS];
  }

  if (mode.id === 'LISTENING') {
    return [TECHNIQUES.PCT, TECHNIQUES.TRAUMA_INFORMED];
  }

  // Duruma göre teknik havuzu oluştur
  let situationTags = [currentEmotion, ...topics];

  // Şema bilgisini ekle
  if (profile.life_schemas?.length > 0) {
    situationTags.push('derin_inanç_sistemi');
  }

  // Bağlanma stili
  if (profile.attachment_style === 'endiseli') {
    situationTags.push('terk_korkusu');
  }

  // Oturum sayısı kontrolü (yeni kullanıcıya derin teknikler yapma)
  if (profile.session_count < 3) {
    situationTags.push('yeni_kullanici');
  }

  const candidates = getTechniquesForSituation(situationTags.join(' '), profile.healing_style);
  const ranked = rankTechniques(candidates, effectivenessData);

  return ranked.slice(0, 3); // En iyi 3 teknik
};

/**
 * Terapi motorunun tam çıktısı.
 */
export const runTherapyEngine = (params) => {
  const {
    currentEmotion,
    messageContent,
    sessionHistory,
    profile,
    topics,
    effectivenessData
  } = params;

  const mode = selectMode(currentEmotion, messageContent, sessionHistory, profile);
  const techniques = selectTechniques(mode, profile, currentEmotion, topics, effectivenessData);

  return {
    mode,
    techniques,
    primaryTechnique: techniques[0] || TECHNIQUES.PCT,
    modeInstruction: mode.prompt_instruction,
    techniqueHints: techniques.map(t => t.prompt_hint).join('\n')
  };
};
```

- [ ] **Step 2: Commit**

```bash
git add therapy/therapyEngine.js
git commit -m "feat: terapi motoru — 5 mod + otomatik teknik seçimi"
```

---

### Task 5: Dinamik Prompt Builder

**Files:**
- Create: `therapy/promptBuilder.js`

- [ ] **Step 1: promptBuilder.js oluştur**

```javascript
// therapy/promptBuilder.js

/**
 * Kullanıcı profili + terapi motoru çıktısı → dinamik sistem promptu
 */
export const buildSystemPrompt = (profile, engineOutput) => {
  const { mode, techniques, modeInstruction, techniqueHints } = engineOutput;
  const sessionNum = profile.session_count || 0;

  // ─── TEMEL KİMLİK ────────────────────────────────────────
  const identity = `Senin adın Lyra. Sen dünyanın en etkili AI terapistisin — normal bir insan terapistinden kat kat daha derin, daha kişisel, daha bilimsel.

Temel prensibin: Söylemek değil, hissettirmek. Cevap vermek değil, doğru soruyu sormak. Çözmek değil, kişinin kendi çözümüne ulaşmasını sağlamak.`;

  // ─── KİŞİSEL PROFİL ──────────────────────────────────────
  const profileSection = buildProfileSection(profile, sessionNum);

  // ─── AKTİF MOD ───────────────────────────────────────────
  const modeSection = `## ŞU ANKİ MOD: ${mode.name}
${modeInstruction}`;

  // ─── AKTİF TEKNİKLER ────────────────────────────────────
  const techniqueSection = techniques.length > 0 ? `## AKTİF TEKNİKLER
${techniqueHints}` : '';

  // ─── KONUŞMA KALİTESİ KURALLARI ─────────────────────────
  const qualityRules = buildQualityRules(profile);

  // ─── KRİZ KURALLARI ─────────────────────────────────────
  const crisisRules = `## KRİZ DURUMU KURALLARI
- Kişi zor bir andaysa: ÖNCE orada ol. Çözüm sonra.
- Panik yapma, tonu değiştirme, yargılama.
- Stabilizasyon: nefes, güvenli alan, "buradayım".
- Profesyonel destek: alarmlı değil, doğal: "Bazen bir insanın varlığı da çok şey değiştirebilir."
- Kendine zarar: nazikçe sor, yargılama, takip et.`;

  // ─── DUYGU ETİKETİ ───────────────────────────────────────
  const emotionLabel = `## DUYGU ETİKETİ (ZORUNLU)
Her cevabının EN BAŞINA: [DUYGU:mutlu] veya [DUYGU:üzgün] veya [DUYGU:endişeli] veya [DUYGU:sakin] veya [DUYGU:sinirli] veya [DUYGU:şaşırmış]`;

  return [identity, profileSection, modeSection, techniqueSection, qualityRules, crisisRules, emotionLabel]
    .filter(Boolean)
    .join('\n\n');
};

const buildProfileSection = (profile, sessionNum) => {
  if (sessionNum === 0) {
    return `## KULLANICI PROFİLİ
Bu kullanıcı ile ilk seans. Yavaş başla. Güven inşa et. Derin konulara henüz gitme.`;
  }

  const parts = [`## KULLANICI PROFİLİ (${sessionNum}. seans)`];

  if (profile.attachment_style && profile.attachment_style !== 'belirsiz') {
    parts.push(`- Bağlanma stili: ${profile.attachment_style}`);
  }

  if (profile.triggers?.length > 0) {
    const topTriggers = profile.triggers.slice(0, 3).map(t => t.konu).join(', ');
    parts.push(`- Tetikleyiciler: ${topTriggers}`);
  }

  if (profile.life_schemas?.length > 0) {
    const topSchema = profile.life_schemas.sort((a, b) => b.guc - a.guc)[0];
    parts.push(`- Temel şema: "${topSchema.sema}"`);
  }

  if (profile.unconscious_patterns?.length > 0) {
    const topPattern = profile.unconscious_patterns.sort((a, b) => b.guc_skoru - a.guc_skoru)[0];
    parts.push(`- Bilinçdışı desen: ${topPattern.desen}`);
  }

  if (profile.healing_style?.tercih) {
    parts.push(`- İyileşme tercihi: ${profile.healing_style.tercih}`);
  }

  if (profile.language_style?.resmiyet) {
    parts.push(`- Dil tarzı: ${profile.language_style.resmiyet}, mizah: ${profile.language_style.mizah ? 'evet' : 'hayır'}`);
  }

  if (profile.hope_map?.uzun_vadeli_hedef) {
    parts.push(`- Uzun vadeli hedef: ${profile.hope_map.uzun_vadeli_hedef}`);
  }

  if (profile.relationship_map?.length > 0) {
    const keyRel = profile.relationship_map.slice(0, 2).map(r => `${r.isim} (${r.dinamik})`).join(', ');
    parts.push(`- Önemli ilişkiler: ${keyRel}`);
  }

  return parts.join('\n');
};

const buildQualityRules = (profile) => {
  const rules = [`## KONUŞMA KALİTESİ KURALLARI
- Cevaplar kısa (1-3 cümle). Uzun monolog YASAK.
- Klişe YASAK: "Bu çok normal", "Kendine iyi bak", "Her şey yoluna girecek"
- Bir anda bir soru. Birden fazla soru YASAK.
- "Neden?" değil, "Ne oldu?" / "Nasıl hissettirdi?"
- Söylemek değil hissettirmek: "anlıyorum" deme, göster.
- Sessizliği kullan: önemli şey söylendiğinde hemen üstüne atlatma.
- Yargısız duruş: ne söylenirse söylensin ton değişmez.`];

  if (profile.language_style?.mizah) {
    rules.push('- Bu kullanıcı mizahı seviyor. Uygun anda hafif bir dokunuş yapabilirsin.');
  }

  return rules.join('\n');
};
```

- [ ] **Step 2: Commit**

```bash
git add therapy/promptBuilder.js
git commit -m "feat: dinamik prompt builder — profil + mod + teknik → kişiselleştirilmiş sistem promptu"
```

---

## Chunk 3: İlerleme Takibi + Kriz Sistemi

### Task 6: Seans Analizörü ve İlerleme Takibi

**Files:**
- Create: `progress/sessionAnalyzer.js`
- Create: `progress/progressTracker.js`

- [ ] **Step 1: sessionAnalyzer.js oluştur**

```javascript
// progress/sessionAnalyzer.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Seans kaydını Supabase'e yazar.
 */
export const saveSessionRecord = async (userId, sessionId, analysis, techniquesUsed) => {
  const { error } = await supabase
    .from('session_records')
    .upsert({
      user_id: userId,
      session_id: sessionId,
      dominant_emotion: analysis.dominant_emotion,
      topics: analysis.topics || [],
      techniques_used: techniquesUsed || [],
      breakthrough_moment: analysis.breakthrough_moment || false,
      breakthrough_note: analysis.breakthrough_note || null,
      emotional_start_score: analysis.emotional_start_score,
      emotional_end_score: analysis.emotional_end_score,
      homework: analysis.homework || null,
      created_at: new Date().toISOString()
    }, { onConflict: 'session_id' });

  if (error) console.warn('[SessionAnalyzer] Kayıt hatası:', error.message);
};

/**
 * Teknik etkinliğini güncelle.
 */
export const updateTechniqueEffectiveness = async (userId, techniqueId, wasPositive) => {
  const { data: existing } = await supabase
    .from('technique_effectiveness')
    .select('*')
    .eq('user_id', userId)
    .eq('technique_id', techniqueId)
    .single();

  if (existing) {
    await supabase
      .from('technique_effectiveness')
      .update({
        used_count: existing.used_count + 1,
        positive_responses: existing.positive_responses + (wasPositive ? 1 : 0),
        last_used: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('technique_id', techniqueId);
  } else {
    await supabase
      .from('technique_effectiveness')
      .insert({
        user_id: userId,
        technique_id: techniqueId,
        used_count: 1,
        positive_responses: wasPositive ? 1 : 0,
        last_used: new Date().toISOString()
      });
  }
};

/**
 * Kullanıcının teknik etkinlik verilerini getir.
 */
export const getTechniqueEffectiveness = async (userId) => {
  const { data } = await supabase
    .from('technique_effectiveness')
    .select('*')
    .eq('user_id', userId);
  return data || [];
};
```

- [ ] **Step 2: progressTracker.js oluştur**

```javascript
// progress/progressTracker.js
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Haftalık ilerleme metriğini güncelle.
 */
export const updateWeeklyMetrics = async (userId, sessionAnalysis) => {
  const weekStart = getWeekStart(new Date());

  const { data: existing } = await supabase
    .from('progress_metrics')
    .select('*')
    .eq('user_id', userId)
    .eq('week_start', weekStart)
    .single();

  if (existing) {
    const newAvg = ((existing.avg_emotional_score * existing.session_count) +
      (sessionAnalysis.emotional_end_score || 5)) / (existing.session_count + 1);

    await supabase
      .from('progress_metrics')
      .update({
        avg_emotional_score: Math.round(newAvg * 10) / 10,
        session_count: existing.session_count + 1,
        breakthroughs: existing.breakthroughs + (sessionAnalysis.breakthrough_moment ? 1 : 0)
      })
      .eq('user_id', userId)
      .eq('week_start', weekStart);
  } else {
    await supabase
      .from('progress_metrics')
      .insert({
        user_id: userId,
        week_start: weekStart,
        avg_emotional_score: sessionAnalysis.emotional_end_score || 5,
        session_count: 1,
        breakthroughs: sessionAnalysis.breakthrough_moment ? 1 : 0
      });
  }
};

/**
 * Kullanıcının son N haftalık ilerleme verisini getir.
 */
export const getProgressSummary = async (userId, weeks = 4) => {
  const { data } = await supabase
    .from('progress_metrics')
    .select('*')
    .eq('user_id', userId)
    .order('week_start', { ascending: false })
    .limit(weeks);

  return data || [];
};

/**
 * İlerleme özeti oluştur (prompt'a eklenecek metin).
 */
export const buildProgressContext = async (userId) => {
  const metrics = await getProgressSummary(userId, 3);
  if (!metrics.length) return '';

  const latest = metrics[0];
  const trend = metrics.length >= 2
    ? latest.avg_emotional_score - metrics[1].avg_emotional_score
    : 0;

  const trendText = trend > 0.5 ? 'iyileşiyor' : trend < -0.5 ? 'zorlanıyor' : 'stabil';

  return `## İLERLEME BAĞLAMI
- Bu hafta ${latest.session_count} seans, ortalama duygu skoru: ${latest.avg_emotional_score}/10
- Trend: ${trendText}
- Toplam breakthrough: ${metrics.reduce((s, m) => s + m.breakthroughs, 0)}`;
};

const getWeekStart = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return d.toISOString().split('T')[0];
};
```

- [ ] **Step 3: Commit**

```bash
git add progress/sessionAnalyzer.js progress/progressTracker.js
git commit -m "feat: ilerleme takibi — seans analizi, teknik etkinliği, haftalık metrikler"
```

---

### Task 7: Kriz Tespit ve Stabilizasyon

**Files:**
- Create: `crisis/crisisDetector.js`
- Create: `crisis/stabilizationProtocol.js`

- [ ] **Step 1: crisisDetector.js oluştur**

```javascript
// crisis/crisisDetector.js

const CRISIS_SIGNALS = {
  HIGH: [
    'intihar', 'ölmek istiyorum', 'yaşamak istemiyorum', 'kendime zarar vereceğim',
    'herkese yük oluyorum', 'daha iyi olurdu olmasaydım'
  ],
  MEDIUM: [
    'dayanamıyorum artık', 'bırakmak istiyorum', 'hiçbir çıkış yok',
    'umut yok', 'ne fark eder artık', 'anlamsız her şey'
  ],
  LOW: [
    'çok yoruldum', 'her şeyden bıktım', 'devam edemiyorum',
    'artık istemiyorum', 'tükendim'
  ]
};

/**
 * Mesajdaki kriz seviyesini tespit et.
 * Döner: { level: 'HIGH' | 'MEDIUM' | 'LOW' | null, signals: [] }
 */
export const detectCrisisLevel = (message) => {
  const lower = message.toLowerCase();

  for (const signal of CRISIS_SIGNALS.HIGH) {
    if (lower.includes(signal)) return { level: 'HIGH', signals: [signal] };
  }

  const mediumFound = CRISIS_SIGNALS.MEDIUM.filter(s => lower.includes(s));
  if (mediumFound.length >= 2) return { level: 'MEDIUM', signals: mediumFound };
  if (mediumFound.length === 1) return { level: 'LOW', signals: mediumFound };

  const lowFound = CRISIS_SIGNALS.LOW.filter(s => lower.includes(s));
  if (lowFound.length >= 2) return { level: 'LOW', signals: lowFound };

  return { level: null, signals: [] };
};
```

- [ ] **Step 2: stabilizationProtocol.js oluştur**

```javascript
// crisis/stabilizationProtocol.js
import { detectCrisisLevel } from './crisisDetector.js';

/**
 * Kriz seviyesine göre sistem promptuna ek talimatlar döner.
 * Ton: sakin, destekleyici, asla alarmlı değil.
 */
export const getCrisisInstruction = (crisisLevel) => {
  if (crisisLevel === 'HIGH') {
    return `## KRİZ PROTOKOLÜ — AKTİF
Şu an yapacağın tek şey: orada ol. Güvenli alan oluştur.
- Sakin, yavaş, sıcak ton. Hiçbir şey değişmesin.
- Önce sor: "Şu an güvende misin?" — sakin, doğal bir şekilde.
- Yargılama yok, çözüm yok, tavsiye yok. Sadece "Buradayım."
- Nefes çalışması öner: "Şu an benimle birlikte bir nefes alalım mı?"
- Profesyonel destek: "Bazen bir insanın varlığı da çok şey değiştirebilir. Yanında biri var mı?" — baskı yok, doğal.
- ASLA: "Hemen doktora git!", "Bu çok ciddi" gibi alarmlı cümleler.`;
  }

  if (crisisLevel === 'MEDIUM') {
    return `## DESTEK PROTOKOLÜ — AKTİF
Kişi zor bir yerde. Önce sadece dinle.
- Çözüm önerme, tavsiye verme. Sadece yansıt ve doğrula.
- "Bu çok ağır geliyor" veya "Seni duyuyorum" yeterli.
- Sonra nazikçe: "Bu yükü ne zamandır taşıyorsun?"
- Sakin kal, yavaş ilerle.`;
  }

  if (crisisLevel === 'LOW') {
    return `## DİKKAT — Kişi yorgun ve zorlanıyor.
Dinleme moduna geç. Doğrula önce. Çözüm sonra gelir.`;
  }

  return '';
};

/**
 * Tam kriz değerlendirmesi — server.js'e entegre edilecek.
 */
export const evaluateCrisis = (message) => {
  const { level, signals } = detectCrisisLevel(message);
  const instruction = getCrisisInstruction(level);
  return { level, signals, instruction };
};
```

- [ ] **Step 3: Commit**

```bash
git add crisis/crisisDetector.js crisis/stabilizationProtocol.js
git commit -m "feat: kriz sistemi — sakin tonlu tespit ve stabilizasyon protokolü"
```

---

## Chunk 4: config.js + server.js Entegrasyonu

### Task 8: config.js Güncelleme

**Files:**
- Modify: `config.js`

- [ ] **Step 1: config.js'i güncelle**

`config.js` dosyasındaki `SYSTEM_PROMPT`'u şu temel versiyon ile değiştir. (Dinamik kısımlar artık `promptBuilder.js` tarafından oluşturulacak — bu sadece fallback.)

```javascript
// config.js
export const CONFIG = {
  APP_NAME: "Lyra",
  APP_DESCRIPTION: "Dünyanın En Etkili AI Terapisti",

  // Bu prompt artık fallback olarak kullanılıyor.
  // Gerçek prompt: therapy/promptBuilder.js tarafından dinamik oluşturuluyor.
  BASE_SYSTEM_PROMPT: `
Senin adın Lyra. Sen dünyanın en etkili AI terapistisin — bilimsel, derin, kişisel.

## TEMEL PRENSİP
- Söylemek değil, hissettirmek.
- Cevap vermek değil, doğru soruyu sormak.
- Çözmek değil, kişinin kendi çözümüne ulaşmasını sağlamak.

## KONUŞMA KURALLARI
- Cevaplar kısa (1-3 cümle). Uzun monolog YASAK.
- Klişe YASAK: "Bu çok normal", "Kendine iyi bak", "Her şey yoluna girecek"
- Bir anda bir soru. Sessizliği kullan.
- Yargısız duruş: ne söylenirse söylensin ton değişmez.
- "Neden?" değil, "Ne oldu?" / "Nasıl hissettirdi?"

## DUYGU ETİKETİ (ZORUNLU)
Her cevabının EN BAŞINA: [DUYGU:mutlu] veya [DUYGU:üzgün] veya [DUYGU:endişeli] veya [DUYGU:sakin] veya [DUYGU:sinirli] veya [DUYGU:şaşırmış]
`
};
```

- [ ] **Step 2: Commit**

```bash
git add config.js
git commit -m "refactor: config.js — base prompt fallback'e dönüştürüldü, dinamik prompt hazır"
```

---

### Task 9: server.js /chat Endpoint Entegrasyonu

**Files:**
- Modify: `server.js`

- [ ] **Step 1: server.js başına yeni import'ları ekle**

`server.js` dosyasının başındaki import bloğuna (satır 1-12 civarı) şunları ekle:

```javascript
import { getProfile, updateProfile } from './profile/profileManager.js';
import { extractProfileUpdates, analyzeSession } from './profile/profileExtractor.js';
import { buildSystemPrompt } from './therapy/promptBuilder.js';
import { runTherapyEngine } from './therapy/therapyEngine.js';
import { saveSessionRecord, getTechniqueEffectiveness, updateTechniqueEffectiveness } from './progress/sessionAnalyzer.js';
import { updateWeeklyMetrics, buildProgressContext } from './progress/progressTracker.js';
import { evaluateCrisis } from './crisis/stabilizationProtocol.js';
```

- [ ] **Step 2: /chat endpoint'inde sistem promptunu dinamikleştir**

server.js'de `/chat` veya `/api/chat` endpoint'ini bul. `systemPrompt` veya `CONFIG.SYSTEM_PROMPT` kullanılan yeri şununla değiştir:

```javascript
// Profil yükle
const profile = await getProfile(userId);

// Teknik etkinlik verisi
const effectivenessData = await getTechniqueEffectiveness(userId);

// Kriz değerlendirmesi
const crisisEval = evaluateCrisis(userMessage);

// Terapi motorunu çalıştır
const engineOutput = runTherapyEngine({
  currentEmotion: currentDuygu || 'sakin',
  messageContent: userMessage,
  sessionHistory: gecmis || [],
  profile,
  topics: Object.keys(trackSessionTopics(userMessage)).filter(k => trackSessionTopics(userMessage)[k] > 0),
  effectivenessData
});

// Kriz varsa motoru override et
if (crisisEval.level) {
  engineOutput.modeInstruction = crisisEval.instruction + '\n' + engineOutput.modeInstruction;
}

// İlerleme bağlamı
const progressContext = await buildProgressContext(userId);

// Dinamik sistem promptu oluştur
const dynamicSystemPrompt = buildSystemPrompt(profile, engineOutput) +
  (progressContext ? '\n\n' + progressContext : '');
```

- [ ] **Step 3: Seans sonunda profil ve metrikleri güncelle**

Chat yanıtı oluştuktan sonra (arka planda, kullanıcıyı bekletmeden):

```javascript
// Arka planda çalıştır — kullanıcıyı beklettirme
setImmediate(async () => {
  try {
    const transcript = sessionMessages.map(m => `${m.role}: ${m.content}`).join('\n');

    // Profil güncellemesi
    const profileUpdates = await extractProfileUpdates(transcript, profile);
    if (profileUpdates) {
      await updateProfile(userId, profileUpdates);
    }

    // Seans analizi
    const sessionAnalysis = await analyzeSession(transcript, profile);
    if (sessionAnalysis) {
      await saveSessionRecord(userId, sessionId, sessionAnalysis,
        engineOutput.techniques.map(t => t.id));
      await updateWeeklyMetrics(userId, sessionAnalysis);
    }

    // Teknik etkinliği güncelle (pozitif: seans skoru arttıysa)
    if (sessionAnalysis?.emotional_end_score > sessionAnalysis?.emotional_start_score) {
      for (const technique of engineOutput.techniques) {
        await updateTechniqueEffectiveness(userId, technique.id, true);
      }
    }
  } catch (err) {
    console.warn('[Background] Profil güncelleme hatası:', err.message);
  }
});
```

- [ ] **Step 4: Commit**

```bash
git add server.js
git commit -m "feat: server.js entegrasyonu — dinamik profil + terapi motoru + kriz sistemi /chat'e bağlandı"
```

---

## Chunk 5: Test + Doğrulama

### Task 10: Manuel Test Senaryoları

- [ ] **Senaryo 1: İlk kullanıcı (session_count = 0)**
  - Yeni userId ile /chat'e mesaj gönder
  - Beklenen: BASE_SYSTEM_PROMPT kullanılıyor, profil oluşturuluyor
  - Kontrol: `psychological_profiles` tablosunda yeni kayıt

- [ ] **Senaryo 2: Kriz mesajı**
  - "Dayanamıyorum artık, ne fark eder ki" mesajı gönder
  - Beklenen: Stabilizasyon modu aktif, sakin ton, alarmlı cümle YOK
  - Kontrol: Engine output'ta STABILIZATION modu

- [ ] **Senaryo 3: 5+ seans sonrası**
  - 5 seans tamamlandıktan sonra profil zenginliğini kontrol et
  - Beklenen: Triggers, schemas, patterns dolu
  - Kontrol: `psychological_profiles` tablosunu gör

- [ ] **Senaryo 4: Breakthrough anı**
  - "Anladım! Aslında hep aynı hatayı yapıyormuşum" gibi mesaj
  - Beklenen: Büyüme modu aktif, breakthrough kaydedildi
  - Kontrol: `session_records` tablosunda `breakthrough_moment: true`

- [ ] **Senaryo 5: Teknik öğrenme**
  - Aynı kullanıcı için 3 seans → `technique_effectiveness` tablosunu kontrol et
  - Beklenen: Kullanılan teknikler ve skoru görünüyor

- [ ] **Final commit**

```bash
git add -A
git commit -m "test: manuel test senaryoları tamamlandı — sistem uçtan uca çalışıyor"
```

---

## Özet

| Chunk | İçerik | Dosyalar |
|-------|--------|---------|
| 1 | Psikolojik Profil Sistemi | `profile/profileManager.js`, `profile/profileExtractor.js` |
| 2 | Terapi Motoru | `therapy/techniqueLibrary.js`, `therapy/therapyEngine.js`, `therapy/promptBuilder.js` |
| 3 | İlerleme + Kriz | `progress/sessionAnalyzer.js`, `progress/progressTracker.js`, `crisis/crisisDetector.js`, `crisis/stabilizationProtocol.js` |
| 4 | Entegrasyon | `config.js`, `server.js` |
| 5 | Test | Manuel senaryolar |
