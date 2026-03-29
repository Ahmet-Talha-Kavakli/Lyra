// therapy/homeworkEngine.js
// Ev Ödevi Takip Sistemi — Lyra seanslar arasında kullanıcıya küçük görevler verir,
// bir sonraki seansta bunları hatırlar ve tamamlanıp tamamlanmadığını sorar.
//
// Akış:
//   1. Seans sonunda Lyra uygun gördüğünde bir ev ödevi önerir (GPT ile)
//   2. Ödev homework_assignments tablosuna yazılır (status: pending)
//   3. Bir sonraki seans başında bekleyen ödevler prompt'a inject edilir
//   4. Seans içinde kullanıcı ödevden bahsederse status güncellenir (completed/skipped)
//   5. Hiç bahsedilmezse seans sonunda nazikçe hatırlatılır

import { supabase } from '../lib/supabase.js';
import { openai } from '../lib/openai.js';

// ─── ÖDEV ÜRETME ─────────────────────────────────────────────────────────────

/**
 * Seans transkriptinden GPT ile uygun bir ev ödevi üretir.
 * Ödev: küçük, yapılabilir, terapötik değeri olan bir eylem.
 *
 * @param {string} transcript
 * @param {Object|null} profile
 * @param {string} dominantEmotion
 * @returns {Promise<{title: string, description: string, category: string}|null>}
 */
export async function generateHomework(transcript, profile, dominantEmotion) {
    if (!transcript || transcript.length < 200) return null;

    const profileNote = profile?.session_count
        ? `Kullanıcı ${profile.session_count}. seanstasında.`
        : 'İlk seans.';

    const prompt = `Sen deneyimli bir terapistsin. Az önce bir seans yaptın. Bu seanstaki konuşmaya bakarak kullanıcıya verebileceğin küçük, somut ve yapılabilir bir ev ödevi öner.

${profileNote}
Baskın duygu: ${dominantEmotion || 'belirsiz'}

Seans özeti (son 2000 karakter):
${transcript.slice(-2000)}

Kurallar:
- Ödev basit ve 1 haftada yapılabilir olmalı
- Duygusal farkındalık, öz-şefkat veya davranışsal deneme kategorisinde olmalı
- Ezici değil, davet edici olmalı ("Yapmalısın" değil, "Denemek ister misin?")
- Seans içeriğiyle doğrudan bağlantılı olmalı

JSON formatında döndür (başka hiçbir şey yazma):
{
  "title": "kısa başlık (max 60 karakter)",
  "description": "ödevin tam açıklaması (max 200 karakter, kullanıcıya hitap eden, sen dili)",
  "category": "farkındalık|öz-şefkat|davranışsal|ilişki|günlük"
}

Eğer bu seans için uygun ödev yoksa sadece şunu yaz: null`;

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 200,
            temperature: 0.5,
        });

        const raw = response.choices[0]?.message?.content?.trim() || '';
        if (raw === 'null' || !raw) return null;

        const cleaned = raw.replace(/```json\s*/i, '').replace(/```\s*$/, '').trim();
        const parsed = JSON.parse(cleaned);

        if (!parsed?.title || !parsed?.description) return null;

        return {
            title: String(parsed.title).slice(0, 60),
            description: String(parsed.description).slice(0, 200),
            category: ['farkındalık', 'öz-şefkat', 'davranışsal', 'ilişki', 'günlük'].includes(parsed.category)
                ? parsed.category
                : 'farkındalık',
        };
    } catch {
        return null;
    }
}

// ─── ÖDEV KAYDETME ───────────────────────────────────────────────────────────

/**
 * Ödevi homework_assignments tablosuna yazar.
 * @param {string} userId
 * @param {string} sessionId
 * @param {{title, description, category}} homework
 */
export async function saveHomework(userId, sessionId, homework) {
    if (!userId || !homework) return;
    const { error } = await supabase.from('homework_assignments').insert({
        user_id: userId,
        session_id: sessionId || null,
        title: homework.title,
        description: homework.description,
        category: homework.category,
        status: 'pending',
        created_at: new Date().toISOString(),
    });
    if (error) throw new Error(`Ödev kaydedilemedi: ${error.message}`);
}

// ─── BEKLEYEN ÖDEVLERİ ÇEK ──────────────────────────────────────────────────

/**
 * Kullanıcının bekleyen (pending) ödevlerini çeker.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getPendingHomework(userId) {
    if (!userId) return [];
    const { data, error } = await supabase
        .from('homework_assignments')
        .select('id, title, description, category, created_at')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(3); // En fazla 3 bekleyen ödev

    if (error || !data) return [];
    return data;
}

// ─── ÖDEV DURUMU GÜNCELLE ────────────────────────────────────────────────────

/**
 * Ödev durumunu günceller.
 * @param {string} homeworkId
 * @param {'completed'|'skipped'|'partial'} status
 * @param {string|null} userNote — kullanıcının ödevle ilgili söylediği şey
 */
export async function updateHomeworkStatus(homeworkId, status, userNote = null) {
    if (!homeworkId) return;
    const { error } = await supabase
        .from('homework_assignments')
        .update({
            status,
            completed_at: status === 'completed' ? new Date().toISOString() : null,
            user_note: userNote,
        })
        .eq('id', homeworkId);
    if (error) console.warn('[HOMEWORK] Status güncellenemedi:', error.message);
}

// ─── SEANS İÇİ ÖDEV TAKİBİ ──────────────────────────────────────────────────

/**
 * Kullanıcı mesajında bekleyen ödevlerden bahsedip bahsetmediğini kontrol eder.
 * Basit keyword matching — GPT gerektirmez.
 *
 * @param {string} message — son kullanıcı mesajı
 * @param {Array} pendingHomework — getPendingHomework() çıktısı
 * @returns {{ homeworkId: string, status: 'completed'|'skipped'|'partial', note: string }|null}
 */
export function detectHomeworkMention(message, pendingHomework) {
    if (!message || !pendingHomework?.length) return null;
    const lower = message.toLowerCase();

    // Tamamlama sinyalleri
    const completedSignals = ['yaptım', 'denedim', 'uyguladım', 'çalıştı', 'işe yaradı', 'başardım', 'tamamladım', 'oldu'];
    // Atlama sinyalleri
    const skippedSignals = ['yapamadım', 'unutdum', 'fırsat olmadı', 'yapmadım', 'olmadı', 'beceremedim'];
    // Kısmi tamamlama
    const partialSignals = ['biraz denedim', 'bir kez yaptım', 'yarım kaldı', 'bazen', 'birkaç kez'];

    for (const hw of pendingHomework) {
        // Ödev başlığının anahtar kelimeleri mesajda geçiyor mu?
        const titleWords = hw.title.toLowerCase().split(/\s+/).filter(w => w.length > 3);
        const titleMentioned = titleWords.some(w => lower.includes(w));

        // Doğrudan "ödev" kelimesi veya başlık eşleşmesi
        const mentioned = lower.includes('ödev') || titleMentioned;
        if (!mentioned) continue;

        if (partialSignals.some(s => lower.includes(s))) {
            return { homeworkId: hw.id, status: 'partial', note: message.slice(0, 200) };
        }
        if (completedSignals.some(s => lower.includes(s))) {
            return { homeworkId: hw.id, status: 'completed', note: message.slice(0, 200) };
        }
        if (skippedSignals.some(s => lower.includes(s))) {
            return { homeworkId: hw.id, status: 'skipped', note: message.slice(0, 200) };
        }
    }

    return null;
}

// ─── PROMPT INJECT ───────────────────────────────────────────────────────────

/**
 * Bekleyen ödevleri sistem promptuna eklenecek metin olarak döner.
 * Seans başında Lyra'nın ödevleri hatırlaması için.
 *
 * @param {Array} pendingHomework
 * @returns {string}
 */
export function buildHomeworkContext(pendingHomework) {
    if (!pendingHomework?.length) return '';

    const items = pendingHomework.map((hw, i) => {
        const daysAgo = Math.floor((Date.now() - new Date(hw.created_at).getTime()) / (1000 * 60 * 60 * 24));
        return `  ${i + 1}. "${hw.title}" (${daysAgo} gün önce verildi) — ${hw.description}`;
    }).join('\n');

    return `\n\n[EV ÖDEVİ TAKİBİ]\nKullanıcının bekleyen ev ödevleri var:\n${items}\nBu seansa başlarken doğal bir şekilde sor — baskı kurmadan: "Geçen seféránda bahsettiğimiz [ödev] hakkında nasıl gitti?" Cevabına göre devam et.`;
}

// ─── ANA GİRİŞ: SEANS SONU ÖDEV ÜRET ────────────────────────────────────────

/**
 * Seans sonu çağrılır. Uygun ödev varsa üretir ve kaydeder.
 * Hata yaymaz — arka planda sessizce çalışır.
 *
 * @param {string} userId
 * @param {string} sessionId
 * @param {string} transcript
 * @param {Object|null} profile
 * @param {string} dominantEmotion
 */
export async function runHomeworkEngine(userId, sessionId, transcript, profile, dominantEmotion) {
    if (!userId || !transcript || transcript.length < 200) return;

    // Zaten 2+ bekleyen ödev varsa yeni ödev verme — bunaltma
    try {
        const pending = await getPendingHomework(userId);
        if (pending.length >= 2) {
            console.log(`[HOMEWORK] ${pending.length} bekleyen ödev var, yeni ödev üretilmiyor.`);
            return;
        }

        const homework = await generateHomework(transcript, profile, dominantEmotion);
        if (!homework) {
            console.log('[HOMEWORK] Bu seans için uygun ödev bulunamadı.');
            return;
        }

        await saveHomework(userId, sessionId, homework);
        console.log(`[HOMEWORK] ✅ Ödev kaydedildi | "${homework.title}" | userId: ${userId}`);
    } catch (err) {
        console.error('[HOMEWORK] Hata (ana akış etkilenmedi):', err.message);
    }
}
