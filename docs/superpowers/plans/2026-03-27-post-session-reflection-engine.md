# Post-Session Reflection Engine — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lyra'nın her seans sonunda kendi performansını GPT ile değerlendirip sonuçları Supabase'e kaydetmesi ve bir sonraki seansa bu bağlamla girmesi.

**Architecture:** Yeni `therapy/reflectionEngine.js` modülü tüm reflection mantığını barındırır. `server.js`'deki `end-of-call-report` bloğuna tek bir çağrı eklenir. `sessionBridge.js` reflection notunu okuyup prompt'a bağlam olarak enjekte eder. Hata izolasyonu tam — reflection başarısız olursa ana seans akışı etkilenmez.

**Tech Stack:** Node.js ES modules, OpenAI gpt-4o-mini, Supabase (session_records tablosu — 3 yeni alan), mevcut `openai` istemcisi (`server.js` satır 229)

**Spec:** `docs/superpowers/specs/2026-03-27-post-session-reflection-engine-design.md`

---

## Chunk 1: Supabase Şema + reflectionEngine.js Çekirdeği

### Task 1: Supabase session_records Tablosuna 3 Alan Ekle

**Files:**
- Modify: Supabase dashboard (SQL editor) — migration

- [ ] **Step 1: SQL migration'ı çalıştır**

Supabase dashboard → SQL Editor'e git ve şunu çalıştır:

```sql
ALTER TABLE session_records
  ADD COLUMN IF NOT EXISTS reflection       jsonb    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS next_session_note text    DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS dependency_signals jsonb  DEFAULT NULL;
```

- [ ] **Step 2: Doğrula**

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'session_records'
  AND column_name IN ('reflection', 'next_session_note', 'dependency_signals');
```

Beklenen: 3 satır dönsün.

- [ ] **Step 3: Commit (şema notu)**

```bash
git commit --allow-empty -m "chore: session_records tablosuna reflection/next_session_note/dependency_signals alanları eklendi (Supabase)"
```

---

### Task 2: therapy/reflectionEngine.js — Çekirdek Modül

**Files:**
- Create: `therapy/reflectionEngine.js`

- [ ] **Step 1: Dosyayı oluştur**

```javascript
// therapy/reflectionEngine.js
// Lyra seans sonu öz-değerlendirme motoru
// Her seans bitince çalışır — ana akıştan izole, hata yaymaz.

/**
 * GPT çıktısını güvenli şekilde parse eder ve doğrular.
 * @param {string} raw — GPT'nin döndürdüğü string
 * @returns {Object} — Doğrulanmış reflection nesnesi veya {}
 */
export function parseAndValidateReflection(raw) {
    try {
        // ```json ... ``` bloğunu temizle
        const cleaned = raw.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();
        const parsed = JSON.parse(cleaned);

        return {
            what_worked: Array.isArray(parsed.what_worked) ? parsed.what_worked.slice(0, 5) : [],
            what_felt_sensitive: Array.isArray(parsed.what_felt_sensitive) ? parsed.what_felt_sensitive.slice(0, 5) : [],
            opening_moment: typeof parsed.opening_moment === 'string' ? parsed.opening_moment.slice(0, 300) : '',
            closing_moment: typeof parsed.closing_moment === 'string' ? parsed.closing_moment.slice(0, 300) : '',
            mode_note: typeof parsed.mode_note === 'string' ? parsed.mode_note.slice(0, 300) : '',
            next_session_context: typeof parsed.next_session_context === 'string' ? parsed.next_session_context.slice(0, 500) : '',
            technique_signals: Array.isArray(parsed.technique_signals)
                ? parsed.technique_signals
                    .filter(t => t && typeof t.id === 'string' && (t.signal === 'positive' || t.signal === 'negative'))
                    .slice(0, 10)
                : [],
            self_score: (Number.isInteger(parsed.self_score) && parsed.self_score >= 1 && parsed.self_score <= 10)
                ? parsed.self_score
                : null,
        };
    } catch {
        return {};
    }
}

/**
 * Son 7 gündeki seans sayısını çeker.
 * @param {string} userId
 * @param {Object} supabase
 * @returns {Promise<number|null>}
 */
export async function getSessionFrequency7d(userId, supabase) {
    if (!userId || !supabase) return null;
    try {
        const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { count, error } = await supabase
            .from('session_records')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', since);
        if (error) return null;
        return count ?? null;
    } catch {
        return null;
    }
}

/**
 * Transkriptten sosyal izolasyon sinyali var mı basit kontrol.
 * @param {string} transcript
 * @returns {boolean}
 */
export function detectSocialIsolationSignal(transcript) {
    if (!transcript) return false;
    const signals = [
        'kimse yok', 'yalnızım', 'konuşacak kimse', 'kimseyle konuşamıyorum',
        'arkadaşım yok', 'sosyal', 'izole', 'dışlandım', 'hiç kimse',
    ];
    const lower = transcript.toLowerCase();
    return signals.some(s => lower.includes(s));
}

/**
 * GPT'ye reflection prompt'u gönderir ve ham yanıt döner.
 * @param {string} transcript
 * @param {Object|null} sessionAnalysis
 * @param {Object|null} profile
 * @param {Object} openai — OpenAI istemci örneği
 * @returns {Promise<string>} — GPT'nin ham yanıtı
 */
export async function callReflectionGPT(transcript, sessionAnalysis, profile, openai) {
    const analysisContext = sessionAnalysis
        ? `Seans analizi: dominant_emotion=${sessionAnalysis.dominant_emotion}, ` +
          `session_quality=${sessionAnalysis.session_quality}, ` +
          `breakthrough=${sessionAnalysis.breakthrough_moment}`
        : 'Seans analizi mevcut değil.';

    const profileContext = profile
        ? `Kullanıcı profili: ${profile.session_count || 0}. seans, ` +
          `bağlanma_stili=${profile.attachment_style || 'belirsiz'}`
        : 'Profil bilgisi mevcut değil.';

    const prompt = `Sen Lyra adında bir AI terapistsin ve az önce tamamladığın seansı değerlendiriyorsun.

${profileContext}
${analysisContext}

Transkript:
---
${transcript.slice(0, 6000)}
---

Aşağıdaki soruları yanıtlayarak bir JSON döndür. Her alan için dürüst ve spesifik ol.
Önemli: "what_felt_sensitive" alanı YASAK veya TALİMAT değil — sadece "bu konu hassas hissettirdi" tarzında bağlam. Bir sonraki seansta sen karar vereceksin.

JSON formatı (başka hiçbir şey yazma):
{
  "what_worked": ["işe yarayan şey 1", "işe yarayan şey 2"],
  "what_felt_sensitive": ["hassas hissettiren konu veya an"],
  "opening_moment": "kullanıcının en çok açıldığı an",
  "closing_moment": "kullanıcının kapandığı veya kısaldığı an (yoksa boş string)",
  "mode_note": "mod seçimi veya geçiş zamanlaması hakkında not",
  "next_session_context": "bir sonraki seans için bağlam — talimat değil, sezgi notu",
  "technique_signals": [
    {"id": "TEKNİK_ID", "signal": "positive"},
    {"id": "TEKNİK_ID", "signal": "negative"}
  ],
  "self_score": 7
}`;

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 900,
        temperature: 0.3,
    });

    return response.choices[0]?.message?.content || '';
}

/**
 * Reflection ve dependency_signals'ı session_records'a yazar (UPDATE).
 * @param {string} sessionId
 * @param {Object} reflection — parseAndValidateReflection çıktısı
 * @param {string} nextSessionNote
 * @param {Object} dependencySignals
 * @param {Object} supabase
 */
export async function saveReflectionToDB(sessionId, reflection, nextSessionNote, dependencySignals, supabase) {
    const { error } = await supabase
        .from('session_records')
        .update({
            reflection,
            next_session_note: nextSessionNote || null,
            dependency_signals: dependencySignals,
        })
        .eq('session_id', sessionId);

    if (error) throw new Error(`Reflection DB yazma hatası: ${error.message}`);
}

/**
 * Ana giriş noktası. server.js'den çağrılır.
 * Tüm hatalar içeride yakalanır — dışarıya hata yaymaz.
 *
 * @param {Object} params
 * @param {string} params.transcript
 * @param {string} params.sessionId
 * @param {string} params.userId
 * @param {Object|null} params.sessionAnalysis
 * @param {Object|null} params.profile
 * @param {Object} params.openai — OpenAI istemci örneği
 * @param {Object} params.supabase — Supabase istemci örneği
 */
export async function runPostSessionReflection({ transcript, sessionId, userId, sessionAnalysis, profile, openai, supabase, durationSeconds }) {
    if (!transcript || transcript.length < 100) {
        console.log('[REFLECTION] Transkript çok kısa, atlanıyor.');
        return;
    }
    if (!sessionId) {
        console.warn('[REFLECTION] sessionId yok, atlanıyor.');
        return;
    }
    if (durationSeconds !== undefined && durationSeconds !== null && durationSeconds < 180) {
        console.log(`[REFLECTION] Seans çok kısa (${durationSeconds}s < 180s), atlanıyor.`);
        return;
    }
    if (!sessionAnalysis) {
        // Seans analizi yoksa minimal reflection üret — transcript yeterli
        console.log('[REFLECTION] sessionAnalysis yok, transcript ile devam ediliyor.');
    }

    try {
        // 1. GPT reflection çağrısı
        const raw = await callReflectionGPT(transcript, sessionAnalysis, profile, openai);
        const reflection = parseAndValidateReflection(raw);

        const nextSessionNote = reflection.next_session_context || null;

        // 2. Dependency signals hesapla
        const freq7d = await getSessionFrequency7d(userId, supabase);
        const socialIsolation = detectSocialIsolationSignal(transcript);
        const dependencySignals = {
            session_frequency_7d: freq7d,
            social_isolation_mentioned: socialIsolation,
            real_therapist_bridge_suggested: false, // ileride otomatik tespite açık
            threshold_exceeded: (freq7d !== null && freq7d >= 5) || (socialIsolation && freq7d !== null && freq7d >= 3),
        };

        // 3. DB'ye yaz
        await saveReflectionToDB(sessionId, reflection, nextSessionNote, dependencySignals, supabase);

        console.log(`[REFLECTION] ✅ Tamamlandı | sessionId: ${sessionId} | self_score: ${reflection.self_score}`);
        if (dependencySignals.threshold_exceeded) {
            console.warn(`[REFLECTION] ⚠ Bağımlılık eşiği aşıldı | userId: ${userId} | freq7d: ${freq7d}`);
        }
    } catch (err) {
        // Ana akışı asla bozma — sadece logla
        console.error('[REFLECTION] Hata (ana akış etkilenmedi):', err.message);
    }
}
```

- [ ] **Step 2: Syntax kontrolü**

```bash
node --check therapy/reflectionEngine.js
```

Beklenen: çıktı yok (hata yok).

- [ ] **Step 3: Commit**

```bash
git add therapy/reflectionEngine.js
git commit -m "feat: reflection engine çekirdeği — parseAndValidate, GPT çağrısı, DB yazma"
```

---

## Chunk 2: server.js Entegrasyonu + sessionBridge.js Güncellemesi

### Task 3: server.js — end-of-call-report Bloğuna Reflection Çağrısı

**Files:**
- Modify: `server.js` — satır ~17 (import) ve ~2461 (profil/seans bloğu)

**Kapsam notu:** `currentProfile` ve `sessionId` şu an inner try bloğunun içinde tanımlanıyor (satır 2462-2480). Reflection çağrısı outer try'da yapılacak, dolayısıyla bu değişkenleri inner try'dan önce `let` ile dışarıda tanımlamak gerekiyor. Bu sayede hem kapsam sorunu çözülür hem de `sessionId` tutarsızlığı önlenir.

- [ ] **Step 1: Import ekle**

`server.js` satır 17 civarında şu satırı bul:
```javascript
import { saveSessionRecord, getTechniqueEffectiveness, updateTechniqueEffectiveness } from './progress/sessionAnalyzer.js';
```

Hemen altına ekle:
```javascript
import { runPostSessionReflection } from './therapy/reflectionEngine.js';
```

- [ ] **Step 2: currentProfile ve sessionId değişkenlerini inner try dışına taşı**

Satır 2461'deki yorum satırını (`// Psikolojik profil güncelle (yeni sistem)`) bul. Hemen **önüne** şunu ekle:

```javascript
            // Reflection için paylaşılan değişkenler — inner try dışında tanımlanıyor
            let _reflectionProfile = null;
            let _reflectionSessionId = message.call?.id || null;
            let _reflectionAnalysis = null;
```

- [ ] **Step 3: Inner try içinde bu değişkenleri ata**

Inner try bloğu (satır 2462-2477) içinde, mevcut `const currentProfile` ve `const sessionAnalysis` satırlarını şöyle güncelle:

Mevcut:
```javascript
            try {
                const currentProfile = await getProfile(userId);
                ...
                const sessionAnalysis = await analyzeSession(transcript, currentProfile);
                if (sessionAnalysis && userId) {
                    const sessionId = message.call?.id || `vapi_${userId}_${Date.now()}`;
                    await saveSessionRecord(userId, sessionId, sessionAnalysis, [], null);
                    await updateWeeklyMetrics(userId, sessionAnalysis);
                    await incrementSessionCount(userId);
                    console.log(`[VAPI] Seans kaydedildi: ${sessionId}`);
                }
```

Şu şekilde değiştir (sadece değişken isimleri ve atama ekleniyor):
```javascript
            try {
                const currentProfile = await getProfile(userId);
                _reflectionProfile = currentProfile;
                ...
                const sessionAnalysis = await analyzeSession(transcript, currentProfile);
                _reflectionAnalysis = sessionAnalysis;
                if (sessionAnalysis && userId) {
                    const sessionId = message.call?.id || `vapi_${userId}_${Date.now()}`;
                    _reflectionSessionId = sessionId; // aynı sessionId kullanılıyor
                    await saveSessionRecord(userId, sessionId, sessionAnalysis, [], null);
                    await updateWeeklyMetrics(userId, sessionAnalysis);
                    await incrementSessionCount(userId);
                    console.log(`[VAPI] Seans kaydedildi: ${sessionId}`);
                }
```

- [ ] **Step 4: Reflection çağrısını inner try/catch SONRASINA ekle**

Satır 2480'deki `}` (inner catch'in kapanışı) hemen sonrasına, `// Eski sistem uyumluluğu` yorumundan önce şunu ekle:

```javascript
            // Post-session reflection — tamamen izole, ana akışı etkilemez
            await runPostSessionReflection({
                transcript,
                sessionId: _reflectionSessionId,
                userId,
                sessionAnalysis: _reflectionAnalysis,
                profile: _reflectionProfile,
                openai,
                supabase,
                durationSeconds: message.durationSeconds ?? message.call?.durationSeconds ?? null,
            });
```

- [ ] **Step 5: Syntax kontrolü**

```bash
node --check server.js
```

Beklenen: çıktı yok.

- [ ] **Step 6: Commit**

```bash
git add server.js
git commit -m "feat: server.js — end-of-call-report bloğuna reflection engine entegrasyonu"
```

---

### Task 4: sessionBridge.js — Reflection Notunu Oku ve Prompt'a Enjekte Et

**Files:**
- Modify: `therapy/sessionBridge.js`

- [ ] **Step 1: getRecentSessionSummaries select sorgusunu güncelle**

Mevcut (satır 16):
```javascript
            .select('session_id, created_at, summary, topics, emotional_end_score, crisis_flag')
```

Şu şekilde değiştir:
```javascript
            .select('session_id, created_at, summary, topics, emotional_end_score, crisis_flag, next_session_note, dependency_signals, reflection')
```

- [ ] **Step 2: buildSessionBridgeContext içine reflection notu enjeksiyonu ekle**

Mevcut `buildSessionBridgeContext` fonksiyonunda `lines.push(...)` döngüsünü bul (satır 40-52). Döngünün hemen altına, `HAFIZA KULLANIM REHBERİ` bloğundan önce şunu ekle:

```javascript
    // Reflection notu — sadece en son seanstan, varsa
    const latestSession = sessions[0];
    if (latestSession) {
        // En son seansin reflection JSON'unu çek
        const ref = latestSession.reflection || {};
        const hasReflection = (ref.what_worked?.length > 0) || (ref.what_felt_sensitive?.length > 0) || latestSession.next_session_note;

        if (hasReflection) {
            const reflLines = ['\n## GEÇMİŞ SEANSTAN ÖĞRENDIKLERIN (GİZLİ — SESLE AKTARMA)\nBu notlar sana bağlam sunmak için — talimat değil. Sezgini kullan.'];
            if (ref.what_worked?.length > 0) {
                reflLines.push(`İşe yarayan: ${ref.what_worked.join('; ')}`);
            }
            if (ref.what_felt_sensitive?.length > 0) {
                reflLines.push(`Hassas hissettiren: ${ref.what_felt_sensitive.join('; ')}`);
            }
            if (latestSession.next_session_note) {
                reflLines.push(`Bu seans için not: ${latestSession.next_session_note}`);
            }
            lines.push(reflLines.join('\n'));
        }
    }

    // Dependency guardrail — bağımlılık eşiği aşıldıysa
    const depSignals = latestSession?.dependency_signals;
    if (depSignals?.threshold_exceeded) {
        lines.push(`\n[BAĞLAM — SESLE AKTARMA]: Bu kullanıcı bu hafta sık bağlandı${depSignals.social_isolation_mentioned ? ' ve yalnızlık sinyalleri var' : ''}. Gerçek hayattaki bağlantıları nazikçe güçlendir — yargılamadan, bağımlılık değil köprü.`);
    }
```

- [ ] **Step 3: Syntax kontrolü**

```bash
node --check therapy/sessionBridge.js
```

Beklenen: çıktı yok.

- [ ] **Step 4: Tüm therapy dosyalarını kontrol et**

```bash
node --check therapy/reflectionEngine.js therapy/sessionBridge.js therapy/promptBuilder.js therapy/therapyEngine.js
```

Beklenen: çıktı yok.

- [ ] **Step 5: Commit**

```bash
git add therapy/sessionBridge.js
git commit -m "feat: sessionBridge — reflection notu ve dependency guardrail prompt enjeksiyonu"
```

---

## Chunk 3: Birim Testleri + Smoke Test

### Task 5: parseAndValidateReflection Birim Testleri

**Files:**
- Create: `tests/reflectionEngine.test.js`

- [ ] **Step 1: Test dosyasını oluştur**

```javascript
// tests/reflectionEngine.test.js
import { parseAndValidateReflection, detectSocialIsolationSignal, runPostSessionReflection, saveReflectionToDB } from '../therapy/reflectionEngine.js';
import assert from 'node:assert/strict';

// ─── parseAndValidateReflection ────────────────────────────────────────────

// Geçerli JSON
{
    const raw = JSON.stringify({
        what_worked: ['CFT iyi gitti'],
        what_felt_sensitive: ['gelecek konusu hassas'],
        opening_moment: 'anne konusunda açıldı',
        closing_moment: 'gelecek sorusunda kapandı',
        mode_note: 'LISTENING erken bitti',
        next_session_context: 'sezgini kullan',
        technique_signals: [{ id: 'CFT', signal: 'positive' }],
        self_score: 7,
    });
    const result = parseAndValidateReflection(raw);
    assert.deepEqual(result.what_worked, ['CFT iyi gitti'], 'what_worked dizi olmalı');
    assert.equal(result.self_score, 7, 'self_score 7 olmalı');
    assert.equal(result.technique_signals.length, 1, 'technique_signals 1 eleman');
    console.log('✅ Geçerli JSON parse edildi');
}

// self_score sınır dışı → null
{
    const raw = JSON.stringify({ self_score: 15, what_worked: [] });
    const result = parseAndValidateReflection(raw);
    assert.equal(result.self_score, null, 'self_score 15 → null olmalı');
    console.log('✅ self_score sınır dışı → null');
}

// self_score string → null
{
    const raw = JSON.stringify({ self_score: 'seven', what_worked: [] });
    const result = parseAndValidateReflection(raw);
    assert.equal(result.self_score, null, 'self_score string → null olmalı');
    console.log('✅ self_score string → null');
}

// Bozuk JSON → {}
{
    const result = parseAndValidateReflection('bu json değil {{{');
    assert.deepEqual(result, {}, 'Bozuk JSON → boş nesne');
    console.log('✅ Bozuk JSON → {}');
}

// ```json bloğu temizleme
{
    const raw = '```json\n{"what_worked": ["test"], "self_score": 8}\n```';
    const result = parseAndValidateReflection(raw);
    assert.equal(result.self_score, 8, '```json bloğu temizlenmeli');
    console.log('✅ ```json bloğu temizlendi');
}

// what_worked dizi değil → []
{
    const raw = JSON.stringify({ what_worked: 'string geldi', self_score: 5 });
    const result = parseAndValidateReflection(raw);
    assert.deepEqual(result.what_worked, [], 'what_worked dizi değilse → []');
    console.log('✅ what_worked dizi değil → []');
}

// technique_signals geçersiz signal → filtrelenir
{
    const raw = JSON.stringify({
        technique_signals: [
            { id: 'CBT', signal: 'positive' },
            { id: 'ACT', signal: 'INVALID' },
            { id: 'DBT', signal: 'negative' },
        ]
    });
    const result = parseAndValidateReflection(raw);
    assert.equal(result.technique_signals.length, 2, 'Geçersiz signal filtrelenmeli');
    console.log('✅ Geçersiz technique_signals filtrelendi');
}

// ─── detectSocialIsolationSignal ───────────────────────────────────────────

{
    assert.equal(detectSocialIsolationSignal('kimse yok etrafımda'), true, 'sosyal izolasyon tespiti');
    assert.equal(detectSocialIsolationSignal('bugün çok iyiyim'), false, 'normal metin → false');
    assert.equal(detectSocialIsolationSignal(''), false, 'boş string → false');
    assert.equal(detectSocialIsolationSignal(null), false, 'null → false');
    console.log('✅ detectSocialIsolationSignal testleri geçti');
}

// ─── runPostSessionReflection — kısa devre davranışları ───────────────────

// Transkript çok kısa → erken çıkmalı, hata atmamalı
{
    let threw = false;
    try {
        await runPostSessionReflection({
            transcript: 'kısa',
            sessionId: 'test-123',
            userId: 'u1',
            sessionAnalysis: null,
            profile: null,
            openai: null,
            supabase: null,
        });
    } catch {
        threw = true;
    }
    assert.equal(threw, false, 'Kısa transkript hata atmamalı');
    console.log('✅ Kısa transkript — erken çıkış, hata yok');
}

// sessionId yok → erken çıkmalı, hata atmamalı
{
    let threw = false;
    try {
        await runPostSessionReflection({
            transcript: 'a'.repeat(200),
            sessionId: null,
            userId: 'u1',
            sessionAnalysis: null,
            profile: null,
            openai: null,
            supabase: null,
        });
    } catch {
        threw = true;
    }
    assert.equal(threw, false, 'sessionId null — hata atmamalı');
    console.log('✅ sessionId null — erken çıkış, hata yok');
}

// ─── saveReflectionToDB — hata durumu ─────────────────────────────────────

// Supabase hata döndürürse throw etmeli
{
    const fakeSupabase = {
        from: () => ({
            update: () => ({
                eq: () => Promise.resolve({ error: { message: 'DB hatası' } }),
            }),
        }),
    };
    let threw = false;
    try {
        await saveReflectionToDB('session-xyz', {}, null, {}, fakeSupabase);
    } catch (e) {
        threw = true;
        assert.ok(e.message.includes('DB hatası'), 'Hata mesajı iletilmeli');
    }
    assert.equal(threw, true, 'saveReflectionToDB DB hatası → throw etmeli');
    console.log('✅ saveReflectionToDB DB hatası → throw etti');
}

// Supabase başarılı → hata atmamalı
{
    const fakeSupabase = {
        from: () => ({
            update: () => ({
                eq: () => Promise.resolve({ error: null }),
            }),
        }),
    };
    let threw = false;
    try {
        await saveReflectionToDB('session-xyz', {}, 'not', {}, fakeSupabase);
    } catch {
        threw = true;
    }
    assert.equal(threw, false, 'saveReflectionToDB başarılı → hata yok');
    console.log('✅ saveReflectionToDB başarılı → hata yok');
}

console.log('\n🎉 Tüm birim testleri geçti.');
```

- [ ] **Step 2: Testleri çalıştır**

```bash
node tests/reflectionEngine.test.js
```

Beklenen:
```
✅ Geçerli JSON parse edildi
✅ self_score sınır dışı → null
✅ self_score string → null
✅ Bozuk JSON → {}
✅ ```json bloğu temizlendi
✅ what_worked dizi değil → []
✅ Geçersiz technique_signals filtrelendi
✅ detectSocialIsolationSignal testleri geçti

🎉 Tüm birim testleri geçti.
```

- [ ] **Step 3: Commit**

```bash
git add tests/reflectionEngine.test.js
git commit -m "test: reflectionEngine birim testleri — parseAndValidate + detectSocialIsolation"
```

---

### Task 6: Smoke Test — Sunucu Ayağa Kalkıyor mu?

**Files:**
- Sadece çalıştırma

- [ ] **Step 1: Tüm dosyaların syntax kontrolü**

```bash
node --check server.js && node --check therapy/reflectionEngine.js && node --check therapy/sessionBridge.js
```

Beklenen: çıktı yok (hata yok).

- [ ] **Step 2: Import kontrolü**

```bash
node -e "import('./therapy/reflectionEngine.js').then(m => console.log('✅ export\'lar:', Object.keys(m).join(', ')))"
```

Beklenen:
```
✅ export'lar: parseAndValidateReflection, getSessionFrequency7d, detectSocialIsolationSignal, callReflectionGPT, saveReflectionToDB, runPostSessionReflection
```

- [ ] **Step 3: Final commit**

```bash
git add therapy/reflectionEngine.js therapy/sessionBridge.js server.js tests/reflectionEngine.test.js
git commit -m "feat: post-session reflection engine — tüm entegrasyon tamamlandı"
```

---

---

## Teknik Not: technique_signals Okuma Yolu

`reflection.technique_signals` şu an `session_records.reflection` JSONB alanında saklanıyor. `rankTechniques()` fonksiyonu (`therapy/techniqueLibrary.js`) bu veriyi doğrudan okumuyor — bu bilinçli bir karar (çifte sayım önlemi).

İleride `getTechniqueEffectiveness()` fonksiyonu (`progress/sessionAnalyzer.js`) genişletilerek `session_records.reflection->technique_signals` alanından da veri toplayabilir. Bu gelecek bir geliştirme adımı — bu plan kapsamında değil.

---

## Özet — Değişen Dosyalar

| Dosya | İşlem | Açıklama |
|-------|-------|----------|
| Supabase `session_records` | ALTER TABLE | 3 yeni alan: reflection, next_session_note, dependency_signals |
| `therapy/reflectionEngine.js` | Yeni | Tüm reflection mantığı |
| `server.js` | +import +5 satır | end-of-call-report'a reflection çağrısı |
| `therapy/sessionBridge.js` | +2 satır select, +10 satır enjeksiyon | Reflection notu + dependency guardrail |
| `tests/reflectionEngine.test.js` | Yeni | 8 birim testi |
