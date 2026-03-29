// therapy/semanticMemory.js
// Semantik Hafıza Sistemi — Lyra geçmiş seans anlarını vektör olarak saklar.
// Kullanıcı bir konu açtığında semantik benzerlikle ilgili geçmiş anlar geri çağrılır.
//
// Mimari:
//   - Her seans sonunda kritik "an"lar (breakthrough, ağır duygu, önemli itiraf)
//     memory_embeddings tablosuna embedding + metin olarak kaydedilir.
//   - Her sohbet turunda son kullanıcı mesajı için embedding üretilir,
//     benzer geçmiş anlar cosine similarity ile bulunur,
//     en alakalı 2-3 an Lyra'nın promptuna inject edilir.
//
// Fallback: embedding başarısız olursa keyword overlap skoru kullanılır.

import { supabase } from '../lib/shared/supabase.js';
import { openai } from '../lib/shared/openai.js';

// ─── EMBEDDING ÜRETME ────────────────────────────────────────────────────────

/**
 * Metin için OpenAI embedding üretir.
 * @param {string} text
 * @returns {Promise<number[]|null>}
 */
async function embed(text) {
    if (!text || text.length < 5) return null;
    try {
        const res = await openai.embeddings.create({
            model: 'text-embedding-ada-002',
            input: text.substring(0, 800),
        });
        return res.data[0].embedding;
    } catch {
        return null;
    }
}

// ─── COSINE SİMİLARİTY ───────────────────────────────────────────────────────

function cosine(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
}

// ─── KEYWORD FALLBACK SKORU ──────────────────────────────────────────────────

function keywordScore(query, text) {
    if (!query || !text) return 0;
    const qWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    const tLower = text.toLowerCase();
    const matches = qWords.filter(w => tLower.includes(w)).length;
    return matches / Math.max(qWords.length, 1);
}

// ─── KRİTİK AN TESPİTİ ───────────────────────────────────────────────────────

/**
 * Seans transkriptinden kaydedilmeye değer kritik anları çıkarır.
 * Basit heuristic — GPT kullanmaz, hızlı çalışır.
 *
 * @param {Array} messages — seans mesajları [{role, content}]
 * @returns {Array<{text: string, type: string}>}
 */
export function extractMemoryMoments(messages) {
    if (!messages?.length) return [];

    const moments = [];
    const userMessages = messages.filter(m => m.role === 'user');

    // Breakthrough / önemli itiraf sinyalleri
    const breakthroughSignals = [
        'fark ettim', 'anladım şimdi', 'ilk kez', 'hiç düşünmemiştim',
        'değişti bir şey', 'şimdi görüyorum', 'aslında', 'sanırım hep',
    ];
    // Ağır duygusal ifadeler
    const heavySignals = [
        'ağlıyorum', 'dayanamıyorum', 'tükendim', 'çok korkuyorum',
        'kimse bilmiyor', 'ilk kez söylüyorum', 'utanıyorum', 'suçlu hissediyorum',
    ];

    for (const msg of userMessages) {
        const content = msg.content || '';
        if (content.length < 30) continue;

        const lower = content.toLowerCase();
        const isBreakthrough = breakthroughSignals.some(s => lower.includes(s));
        const isHeavy = heavySignals.some(s => lower.includes(s));

        if (isBreakthrough) {
            moments.push({ text: content.slice(0, 500), type: 'breakthrough' });
        } else if (isHeavy && content.length > 80) {
            moments.push({ text: content.slice(0, 500), type: 'emotional_peak' });
        }
    }

    // Uzun mesajlar (200+ karakter) — kullanıcı çok şey paylaştı
    for (const msg of userMessages) {
        const content = msg.content || '';
        if (content.length >= 200) {
            const alreadyAdded = moments.some(m => m.text === content.slice(0, 500));
            if (!alreadyAdded) {
                moments.push({ text: content.slice(0, 500), type: 'deep_share' });
            }
        }
    }

    // En fazla 5 an kaydet — kota aşımını önle
    return moments.slice(0, 5);
}

// ─── HAFIZAYA KAYDET ─────────────────────────────────────────────────────────

/**
 * Kritik anları embedding ile birlikte memory_embeddings tablosuna yazar.
 * Hata yaymaz.
 *
 * @param {string} userId
 * @param {string} sessionId
 * @param {Array<{text, type}>} moments
 */
export async function saveMemoryMoments(userId, sessionId, moments) {
    if (!userId || !moments?.length) return;

    for (const moment of moments) {
        try {
            const embedding = await embed(moment.text);
            const { error } = await supabase.from('memory_embeddings').insert({
                user_id: userId,
                session_id: sessionId || null,
                content: moment.text,
                moment_type: moment.type,
                embedding: embedding,
                created_at: new Date().toISOString(),
            });
            if (error) console.warn('[SEMANTIC MEM] Kayıt hatası:', error.message);
        } catch (err) {
            console.warn('[SEMANTIC MEM] An kaydedilemedi:', err.message);
        }
    }

    console.log(`[SEMANTIC MEM] ✅ ${moments.length} an kaydedildi | userId: ${userId}`);
}

// ─── SEMANTİK GERİ ÇAĞIRMA ───────────────────────────────────────────────────

/**
 * Mevcut mesaja semantik olarak benzer geçmiş anları bulur.
 *
 * @param {string} userId
 * @param {string} query — son kullanıcı mesajı
 * @param {number} limit
 * @returns {Promise<Array<{content, moment_type, similarity, created_at}>>}
 */
export async function recallSimilarMoments(userId, query, limit = 3) {
    if (!userId || !query || query.length < 10) return [];

    try {
        // Tüm kullanıcı anlarını çek (embedding dahil)
        const { data, error } = await supabase
            .from('memory_embeddings')
            .select('id, content, moment_type, embedding, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(100); // Son 100 an — daha eskisini alma

        if (error || !data?.length) return [];

        // Query embedding
        const queryEmbedding = await embed(query);

        // Skorla
        const scored = data.map(row => {
            let similarity;
            if (queryEmbedding && row.embedding) {
                similarity = cosine(queryEmbedding, row.embedding);
            } else {
                // Fallback: keyword overlap
                similarity = keywordScore(query, row.content) * 0.7;
            }
            return { ...row, similarity };
        });

        return scored
            .filter(r => r.similarity > 0.75) // Yüksek eşik — alakasız anları filtrele
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, limit)
            .map(({ embedding: _e, ...rest }) => rest);
    } catch (err) {
        console.warn('[SEMANTIC MEM] Geri çağırma hatası:', err.message);
        return [];
    }
}

// ─── PROMPT INJECT ───────────────────────────────────────────────────────────

/**
 * Benzer geçmiş anları sistem promptuna eklenecek metin olarak döner.
 *
 * @param {Array} similarMoments — recallSimilarMoments() çıktısı
 * @returns {string}
 */
export function buildSemanticMemoryContext(similarMoments) {
    if (!similarMoments?.length) return '';

    const typeLabel = {
        breakthrough: 'kırılım anı',
        emotional_peak: 'duygusal doruk',
        deep_share: 'derin paylaşım',
    };

    const items = similarMoments.map(m => {
        const daysAgo = Math.floor((Date.now() - new Date(m.created_at).getTime()) / (1000 * 60 * 60 * 24));
        const label = typeLabel[m.moment_type] || 'geçmiş an';
        return `  — [${label}, ${daysAgo} gün önce]: "${m.content.slice(0, 150)}${m.content.length > 150 ? '...' : ''}"`;
    }).join('\n');

    return `\n\n[SEMANTİK HAFIZA — Bu konuyla ilgili geçmiş anlar]\n${items}\nBu anları doğrudan alıntılama — içgörüyle sindir. Uygunsa "Daha önce de benzer bir şeyden bahsetmiştin..." diyebilirsin.`;
}

// ─── ANA GİRİŞ: SEANS SONU KAYIT ────────────────────────────────────────────

/**
 * Seans sonu çağrılır. Kritik anları tespit edip kaydeder.
 * Hata yaymaz.
 *
 * @param {string} userId
 * @param {string} sessionId
 * @param {Array} messages
 */
export async function runSemanticMemoryEngine(userId, sessionId, messages) {
    if (!userId || !messages?.length) return;
    try {
        const moments = extractMemoryMoments(messages);
        if (moments.length === 0) {
            console.log('[SEMANTIC MEM] Kaydedilecek an bulunamadı.');
            return;
        }
        await saveMemoryMoments(userId, sessionId, moments);
    } catch (err) {
        console.error('[SEMANTIC MEM] Hata (ana akış etkilenmedi):', err.message);
    }
}
