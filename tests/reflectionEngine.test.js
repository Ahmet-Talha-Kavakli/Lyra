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

// null input → {}
{
    const result = parseAndValidateReflection(null);
    assert.deepEqual(result, {}, 'null input → boş nesne');
    console.log('✅ null input → {}');
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

// durationSeconds < 180 → erken çıkmalı, hata atmamalı
{
    let threw = false;
    try {
        await runPostSessionReflection({
            transcript: 'a'.repeat(200),
            sessionId: 'test-456',
            userId: 'u1',
            sessionAnalysis: null,
            profile: null,
            openai: null,
            supabase: null,
            durationSeconds: 60,
        });
    } catch {
        threw = true;
    }
    assert.equal(threw, false, 'Kısa seans süresi hata atmamalı');
    console.log('✅ durationSeconds < 180 — erken çıkış, hata yok');
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
