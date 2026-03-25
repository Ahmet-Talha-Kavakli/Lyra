// therapy/topicExtractor.js
// İki katmanlı konu çıkarımı: hızlı keyword + GPT derin analiz

const KEYWORD_TOPICS = {
    'aile':         ['anne', 'baba', 'kardeş', 'aile', 'ebeveyn', 'çocuk', 'annem', 'babam'],
    'ilişki':       ['ilişki', 'sevgili', 'partner', 'ayrılık', 'evlilik', 'eş', 'kıskançlık', 'aldatma'],
    'iş':           ['iş', 'kariyer', 'patron', 'çalışma', 'işten', 'mesleki', 'proje', 'toplantı', 'maaş'],
    'kaygı':        ['kaygı', 'endişe', 'panik', 'korku', 'anksiyete', 'stres', 'gergin'],
    'depresyon':    ['depresyon', 'mutsuz', 'üzüntü', 'umutsuz', 'boşluk', 'anlamsız', 'hüzün'],
    'özgüven':      ['özgüven', 'kendime güvenmiyorum', 'yetersiz', 'değersiz', 'başaramıyorum'],
    'yalnızlık':    ['yalnız', 'kimsem yok', 'yalnızlık', 'izole', 'yapayalnız'],
    'kayıp':        ['kayıp', 'yas', 'vefat', 'ölüm', 'kaybettim', 'özlüyorum'],
    'travma':       ['travma', 'şiddet', 'taciz', 'istismar', 'kötü anı', 'flashback'],
    'öfke':         ['öfke', 'sinir', 'kızgın', 'öfkeli', 'nefret', 'haksızlık'],
    'sınır':        ['sınır', 'hayır diyemiyorum', 'istismar ediliyorum', 'sömürü', 'kullanılıyorum'],
    'kimlik':       ['kim olduğumu', 'kimliğim', 'kendimi bilmiyorum', 'anlam', 'amaç', 'varoluş'],
    'beden':        ['beden', 'kilo', 'görünüm', 'hastalık', 'kronik', 'ağrı', 'uyku'],
    'bağımlılık':   ['bağımlılık', 'sigara', 'alkol', 'madde', 'bırakamıyorum', 'kontrol edemiyorum'],
    'sosyal':       ['sosyal kaygı', 'insanlardan korkuyorum', 'topluluk', 'arkadaş', 'dışlanma'],
};

/**
 * Hızlı keyword tabanlı konu çıkarımı.
 * @param {string} text
 * @returns {string[]} — konu listesi
 */
export function extractTopicsQuick(text) {
    if (!text) return [];
    const lower = text.toLowerCase();
    const found = [];
    for (const [topic, keywords] of Object.entries(KEYWORD_TOPICS)) {
        if (keywords.some(k => lower.includes(k))) {
            found.push(topic);
        }
    }
    return found;
}

/**
 * GPT ile derinlemesine konu analizi. Yalnızca kısa transkriptte çalışır.
 * @param {string} transcript — seans transkripti (max 2000 karakter)
 * @param {Object} openai — OpenAI istemci örneği
 * @returns {Promise<string[]>} — konu listesi
 */
export async function extractTopicsDeep(transcript, openai) {
    if (!transcript || !openai) return [];

    const trimmed = transcript.length > 2000 ? transcript.slice(-2000) : transcript;

    try {
        const resp = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                {
                    role: 'system',
                    content: `Psikolojik destek seansı transkriptini analiz et.
Konuşmada yer alan 2-6 ana psikolojik konu veya tema çıkar.
Sadece JSON döndür: { "topics": ["konu1", "konu2", ...] }
Her konu kısa ve Türkçe olsun (1-3 kelime).`
                },
                {
                    role: 'user',
                    content: trimmed
                }
            ],
            response_format: { type: 'json_object' },
            max_tokens: 150,
            temperature: 0.3,
        });

        const parsed = JSON.parse(resp.choices[0]?.message?.content || '{}');
        return Array.isArray(parsed.topics) ? parsed.topics.slice(0, 6) : [];
    } catch {
        return [];
    }
}

/**
 * İki katmanı birleştirir: önce keyword, sonra GPT ile zenginleştirir.
 * @param {string} transcript
 * @param {Object} openai
 * @returns {Promise<string[]>}
 */
export async function extractTopicsCombined(transcript, openai) {
    const quick = extractTopicsQuick(transcript);
    try {
        const deep = await extractTopicsDeep(transcript, openai);
        // Tekrarları kaldır, quick'i öne al
        const merged = [...new Set([...quick, ...deep])];
        return merged.slice(0, 8);
    } catch {
        return quick;
    }
}
