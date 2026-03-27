# Post-Session Reflection Engine — Tasarım Spesifikasyonu

**Tarih:** 2026-03-27
**Durum:** Onaylandı
**Kapsam:** Lyra'nın her seans sonunda kendi performansını değerlendirip bir sonraki seansa daha bilinçli girmesi

---

## Problem

Lyra şu an seans bitince transkripti özetliyor, hafızaya yazıyor, profili güncelliyor. Ama hiç şunu sormuyor:

> "Bu seansta iyi bir terapist miydin?"

Bilgi birikyor. Öğrenme olmuyor.

---

## Çözüm: Reflection Engine

Seans bitince Lyra kendine 4 soru sorar ve cevapları kaydeder. Bir sonraki seans bu notlar önüne gelir — talimat olarak değil, **bağlam olarak**. Lyra hâlâ kendi kararını verir, ama daha bilinçli verir.

---

## Mimari

### Yeni Modül

`therapy/reflectionEngine.js`

Mevcut hiçbir dosya yapısı bozulmaz. Sadece `server.js`'deki `end-of-call-report` bloğuna bir adım eklenir.

### Veri Akışı

```
Seans biter (end-of-call-report)
        ↓
[Mevcut] Transkript özetlenir → hafızaya yazılır
[Mevcut] Psikolojik profil güncellenir
[Mevcut] Seans kaydedilir (session_records)
        ↓
[YENİ] runPostSessionReflection(transcript, sessionAnalysis, profile)
        ↓
   GPT-4o-mini 4 soruyu yanıtlar
   → reflection JSON → session_records.reflection alanına yazılır
   → technique_effectiveness otomatik güncellenir (+/- etiket)
   → next_session_context → session_records.next_session_note alanına yazılır
        ↓
Bir sonraki seans açılır
        ↓
[YENİ] buildSessionBridgeContext reflection'ı da çeker
        ↓
Prompt'a enjekte edilir (bağlam olarak, talimat olarak değil)
```

---

## Reflection JSON Yapısı

```json
{
  "what_worked": [
    "CFT — utanç çalışması derin gitti, kullanıcı açıldı",
    "Anne konusu gelince bağlantı güçlendi"
  ],
  "what_felt_sensitive": [
    "Gelecek planı sorusu gelince kullanıcı kısaldı — bu konu hassas hissettirdi"
  ],
  "opening_moment": "Annesinden bahsetmeye başlayınca",
  "closing_moment": "Gelecek planı sorunca",
  "mode_note": "LISTENING'den WORKING'e geçiş biraz erkendi",
  "next_session_context": "Anne konusu bağlantı kapısı olabilir. Gelecek planı bu seans hassas hissettirdi — sezgini kullan.",
  "self_score": 7
}
```

**Kritik tasarım kararı:** `what_felt_sensitive` ve `next_session_context` alanları **talimat değil bağlam** içerir. "Yapma" değil, "dikkatli ol, ama sen karar ver" tonu.

---

## Prompt Enjeksiyonu

`buildSessionBridgeContext()` içinde, mevcut köprü bağlamının altına eklenir:

```
## GEÇMİŞ SEANSTAN ÖĞRENDIKLERIN
Bu notlar sana bağlam sunmak için — talimat değil. Sezgini kullan.

İşe yarayan: [what_worked listesi]
Hassas hissettiren: [what_felt_sensitive listesi]
Bu seans için not: [next_session_context]
```

---

## Technique Effectiveness Otomasyonu

Reflection sırasında Lyra hangi tekniklerin işe yarayıp yaramadığını etiketler. Bu etiketler `updateTechniqueEffectiveness()` ile otomatik kaydedilir. Mevcut `rankTechniques()` fonksiyonu zaten bu veriyi kullanıyor — yani teknikler zamanla o kullanıcı için gerçekten öğrenilmiş ağırlıklar kazanır.

---

## Dependency Guardrails (Aynı Modülde)

Seans sonu değerlendirmesinin parçası olarak bağımlılık sinyalleri de izlenir:

```json
{
  "dependency_signals": {
    "session_frequency_7d": 5,
    "social_isolation_mentioned": true,
    "real_therapist_bridge_suggested": false
  }
}
```

Eşik aşılınca (7 günde 5+ seans veya sosyal izolasyon + yüksek frekans) bir sonraki seansta Lyra'nın kimlik bölümüne sessizce enjekte edilir:

> "Bu kullanıcı bu hafta çok sık bağlandı. Gerçek hayattaki bağlantıları güçlendirmeye nazikçe alan aç. Bağımlılık değil, köprü."

---

## Değişecek Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `therapy/reflectionEngine.js` | **Yeni** — tüm reflection mantığı |
| `therapy/sessionBridge.js` | `buildSessionBridgeContext()` + `getRecentSessionSummaries()` — reflection ve next_session_note alanlarını select sorgusuna ekle |
| `server.js` | `end-of-call-report` bloğuna `runPostSessionReflection()` çağrısı |
| Supabase `session_records` | `reflection` (jsonb) + `next_session_note` (text) + `dependency_signals` (jsonb) alanları |

---

## Hata Yönetimi

- Reflection başarısız olursa seans kaydı etkilenmez — ayrı try/catch ile tamamen izole
- GPT çağrısı timeout'a girerse sessizce atlanır, log yazılır
- Supabase yazma hatası seans akışını durdurmaz
- `sessionAnalysis` null gelirse reflection engine erken çıkar, sadece transcript ile minimal reflection üretir
- GPT JSON çıktısı her zaman doğrulanır: `self_score` 1-10 arasında integer olmalı, diziler gerçekten dizi olmalı — parse hatası varsa boş nesneyle devam edilir

---

## Yazma Stratejisi (Update vs Upsert)

`saveSessionRecord()` önce çalışır ve `session_records` kaydını oluşturur. `runPostSessionReflection()` her zaman **sonra** çalışır ve kayıtlı session_id'ye karşı bir **UPDATE** yapar (`reflection`, `next_session_note`, `dependency_signals` alanlarını günceller). Bu iki işlem birbirinden bağımsızdır — reflection güncellemesi `saveSessionRecord`'un başarısına bağlıdır ama başarısızlığı onu etkilemez.

---

## Technique Effectiveness — Çifte Sayım Önlemi

Mevcut sistemde `technique_effectiveness` zaten birden fazla noktada güncelleniyor. Reflection engine bu tabloyu **doğrudan güncellemez**. Bunun yerine reflection JSON içine `technique_signals` dizisi yazar:

```json
{
  "technique_signals": [
    { "id": "CFT", "signal": "positive" },
    { "id": "CBT", "signal": "negative" }
  ]
}
```

Bu sinyaller `session_records.reflection` içinde tutulur. `rankTechniques()` ileride bu veriyi okuyabilmek için ayrı bir query ile erişir — direkt güncelleme yapmaz. Böylece çifte sayım tamamen ortadan kalkar.

---

## Dependency Guardrails — Kayıt ve Enjeksiyon

**Kayıt:** `dependency_signals` (jsonb) alanı `session_records` tablosuna eklenir. Reflection engine bu alanı ayrı bir UPDATE ile yazar.

**7 günlük frekans hesabı:** `session_records` tablosundan `created_at > now() - interval '7 days'` sorgusu ile çekilir. Bu sorgu başarısız olursa `session_frequency_7d: null` olarak kaydedilir, eşik kontrolü atlanır.

**Enjeksiyon noktası:** Eşik aşılınca `buildSessionBridgeContext()` içinde, köprü bağlamının sonuna eklenir — `promptBuilder.js`'deki kimlik bölümüne değil. Bu şekilde her seans yeniden hesaplanır ve Lyra'nın temel kimliği kirletilmez.

---

## Başarı Kriterleri

- Her seans sonunda `session_records.reflection` alanı dolmuş olmalı
- `session_records.next_session_note` bir sonraki seans bridge context'ine yansımalı
- `dependency_signals` alanı her seans güncellenmeli
- Reflection hatası ana seans akışını hiçbir zaman bozmamalı
- Aynı teknik aynı seans için `technique_effectiveness`'te birden fazla sayılmamalı
