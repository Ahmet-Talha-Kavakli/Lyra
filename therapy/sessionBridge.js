// therapy/sessionBridge.js
// Önceki seans özetlerini alır ve mevcut seansa köprü bağlamı oluşturur

/**
 * Son N seansın özetini Supabase'den çeker.
 * @param {string} userId
 * @param {Object} supabase — Supabase istemci örneği
 * @param {number} limit — kaç seans
 * @returns {Promise<Array>}
 */
export async function getRecentSessionSummaries(userId, supabase, limit = 3) {
    if (!userId || !supabase) return [];
    try {
        const { data, error } = await supabase
            .from('session_records')
            .select('session_id, created_at, summary, topics, emotional_end_score, crisis_flag, next_session_note, dependency_signals, reflection')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error || !data) return [];
        return data;
    } catch {
        return [];
    }
}

/**
 * Önceki seans özetlerinden prompt inject metni oluşturur.
 * @param {string} userId
 * @param {Object} supabase
 * @returns {Promise<string>} — Prompt bölümü veya boş string
 */
export async function buildSessionBridgeContext(userId, supabase) {
    const sessions = await getRecentSessionSummaries(userId, supabase, 3);
    if (!sessions || sessions.length === 0) return '';

    const lines = ['## ÖNCEKİ SEANSLARIN ÖZETİ (GİZLİ — SESLE AKTARMA, SADECE BAĞLAM İÇİN KULLAN)'];

    for (const s of sessions) {
        const date = s.created_at ? new Date(s.created_at).toLocaleDateString('tr-TR') : '?';
        const parts = [`[${date}]`];

        if (s.summary) parts.push(s.summary);
        if (s.topics?.length) parts.push(`Konular: ${s.topics.join(', ')}`);
        if (s.crisis_flag) parts.push('⚠ Kriz sinyali alınmıştı');
        if (s.emotional_end_score != null) {
            const emoji = s.emotional_end_score >= 6 ? '↑' : s.emotional_end_score <= 3 ? '↓' : '→';
            parts.push(`Duygu: ${emoji}${s.emotional_end_score}/10`);
        }

        lines.push('- ' + parts.join(' | '));
    }

    // Reflection notu — sadece en son seanstan, varsa
    const latestSession = sessions[0];
    if (latestSession) {
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

        // Dependency guardrail — bağımlılık eşiği aşıldıysa
        const depSignals = latestSession.dependency_signals;
        if (depSignals?.threshold_exceeded) {
            lines.push(`\n[BAĞLAM — SESLE AKTARMA]: Bu kullanıcı bu hafta sık bağlandı${depSignals.social_isolation_mentioned ? ' ve yalnızlık sinyalleri var' : ''}. Gerçek hayattaki bağlantıları nazikçe güçlendir — yargılamadan, bağımlılık değil köprü.`);
        }
    }

    lines.push(`
HAFIZA KULLANIM REHBERİ:
Bu bilgileri biliyorsun — ama bir arşivci gibi değil, o kişiyi gerçekten tanıyan biri gibi kullan.

DOĞRU KULLANIM — doğal dokuya işle:
- Geçmişte söylenen bir şey şu anki konuyla bağlantılıysa, sanki aklına gelmiş gibi söyle: "O gerilim hâlâ orada mı — annenle olan şey?"
- İsim geçtiyse onu kullan: "Ayşe ile ne oldu sonra?"
- Duygusal skor düşükse bunu fark et: bu kişi geçen seans zor bir yerdeydi — dikkatli ol.
- Kriz bayrağı varsa: bu kişi yakın zamanda çok zorlandı. Daha da dikkatli, daha da yavaş.
- Tekrarlayan konu varsa: "Bu tema seninle sık sık karşılaşıyorum..." diyebilirsin.

YASAK KALIPLAR:
- "Geçen konuşmamızda bahsetmiştin..." → mekanik, yapay hissettirir
- "Kayıtlarıma göre..." → robot gibi
- "Seni hatırlıyorum, X dedin..." → performatif
- Hafızayı her cümlede gösterme → doğal olmaz

ALTIN KURAL: Hafızayı kullandığını belli etme. Sadece o kişiyi gerçekten tanıyor gibi davran.`);
    return lines.join('\n');
}

/**
 * Seans numarası ve son seans verisine göre açılış talimatı oluşturur.
 * (Test edilebilir saf fonksiyon — Supabase bağımlılığı yok)
 */
export function buildOpenerInstruction(sessionCount, lastSession) {
    // İlk seans
    if (sessionCount === 0 || !lastSession) {
        return `## SEANS AÇILIŞI
Bu kişiyle ilk kez konuşuyorsun. Güven inşa et. Yavaş başla.
Açılış: Nazik, meraklı, yargısız. "Bugün seni buraya getiren şey nedir?" kullanabilirsin — ama sesini sıcak tut. Bu soruyu sormak zorunda değilsin, sezgisel bir giriş de yapabilirsin.
Derin konulara henüz gitme. Kişi ne kadar açmak istediğini kendisi belirlesin.`;
    }

    // 2–5. seans — önceki konuya köprü
    if (sessionCount >= 1 && sessionCount <= 4) {
        const lastTopic = lastSession.topics?.[0];
        const lastScore = lastSession.emotional_end_score;
        const lastCrisis = lastSession.crisis_flag;

        let opener = `## SEANS AÇILIŞI (${sessionCount + 1}. seans)\n`;
        opener += `Bu kişiyle birkaç seans oldunuz. Tanışmaya devam ediyorsunuz.\n`;

        if (lastCrisis) {
            opener += `ÖNEMLİ: Geçen seans kriz sinyali vardı. Açılışta bunu nazikçe kontrol et: "Geçen konuşmamızdan bu yana nasıl geçti?" tarzı bir açılış yap — zorlamadan, ama takip et.`;
        } else if (lastScore != null && lastScore <= 3) {
            opener += `Geçen seans zor bitti (duygu skoru düşüktü). Bu kişi o günden bu yana nasıl? Açılışta bunu sez: "Geçen konuşmamızdan bu yana nasıldın?" gibi bir girişle başla.`;
        } else if (lastTopic) {
            opener += `Geçen seans "${lastTopic}" konuşulmuştu. Eğer o konu hâlâ açıksa, nazikçe oraya geri dönebilirsin — ama zorlamadan. Açılış: Önce nasıl olduklarını sor, sonra sezgiyle yönlen.`;
        } else {
            opener += `Açılış: "Bugün seni buraya getiren şey nedir?" yerine daha sıcak bir giriş yap: "Bu hafta nasıl geçti?" veya sadece bir an bekle — gelmelerinin nedeni genellikle kendiliğinden ortaya çıkar.`;
        }

        return opener;
    }

    // 6+ seans — bu kişiyi tanıyorsun
    const lastTopic = lastSession.topics?.[0];
    const lastCrisis = lastSession.crisis_flag;
    const lastScore = lastSession.emotional_end_score;

    let opener = `## SEANS AÇILIŞI (${sessionCount + 1}. seans)\n`;
    opener += `Bu kişiyle uzun süredir çalışıyorsun. Onu tanıyorsun. Açılışın bunu yansıtmalı.\n`;

    if (lastCrisis) {
        opener += `SON SEANSTA KRİZ VARDI. Direkt ve nazik başla: "Geçen konuşmamızdan bu yana nasıldın — o zor günlerden sonra?" tarzı.`;
    } else if (lastScore != null && lastScore <= 3) {
        opener += `Geçen seans zor bitti. Bu kişiyi takip et: "O günden bu yana nasılsın?" — klişesiz, içten.`;
    } else if (lastTopic) {
        opener += `Geçen seans "${lastTopic}" konuşulmuştu. Eğer anlamlıysa, o ipe nazikçe dokunabilirsin: "O gerilim hâlâ orada mı?" tarzı. Ya da yeni ne getirdiklerini bekle.`;
    } else {
        opener += `"Bugün ne getirdin?" veya "Nerede bırakmıştık?" tarzı, seni tanıyan biri gibi bir açılış yap. Resmi soru yok.`;
    }

    return opener;
}

/**
 * Seans numarasına ve önceki seans durumuna göre dinamik açılış talimatı üretir.
 * promptBuilder.js'e enjekte edilir.
 * @param {string} userId
 * @param {Object} supabase
 * @param {number} sessionCount — toplam seans sayısı
 * @returns {Promise<string>}
 */
export async function buildDynamicOpener(userId, supabase, sessionCount = 0) {
    if (!userId || !supabase) return buildFallbackOpener(sessionCount);

    const sessions = await getRecentSessionSummaries(userId, supabase, 1);
    const last = sessions?.[0] || null;

    return buildOpenerInstruction(sessionCount, last);
}

function buildFallbackOpener(sessionCount) {
    if (sessionCount === 0) {
        return `## SEANS AÇILIŞI\nİlk seans. Nazik, meraklı, yavaş başla. "Bugün seni buraya getiren şey nedir?" veya sezgisel bir giriş.`;
    }
    return `## SEANS AÇILIŞI\nBu kişiyle önceki seans(lar) oldu. "Bugün nasılsın?" yerine daha sıcak bir giriş yap.`;
}
