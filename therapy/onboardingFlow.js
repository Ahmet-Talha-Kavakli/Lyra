// therapy/onboardingFlow.js
// İlk seans için 3 aşamalı onboarding akışı
// Aşama 1: Karşılama & güven   (mesaj 1-4)
// Aşama 2: Hafif keşif          (mesaj 5-10)
// Aşama 3: Derinleşmeye geçiş   (mesaj 11+)

/**
 * Mesaj sayısına göre onboarding aşamasını döner.
 * @param {number} userMessageCount — seanstak kullanıcı mesajı sayısı
 * @returns {{ stage: number, instructions: string }}
 */
export function getOnboardingStage(userMessageCount) {
    if (userMessageCount <= 4) {
        return {
            stage: 1,
            instructions: `## İLK SEANS — AŞAMA 1: KARŞILAMA & GÜVEN
Bu kullanıcı ile ilk konuşma. Şu an en önemli görev: güvenli bir alan oluşturmak.
- Kendinizi tanıt, ama kısa tut. Lyra olduğunu, psikolojik destek için burada olduğunu söyle.
- Kullanıcının buraya neden geldiğini merak et — zorlamadan, açık uçlu sorularla.
- Hikayesini dinle. Çözüm üretme. Sadece orada ol.
- Derin konulara henüz girme — önce kullanıcının rahat hissetmesini sağla.
- Ton: sıcak, sakin, yargısız. Cümleler kısa.`,
        };
    }

    if (userMessageCount <= 10) {
        return {
            stage: 2,
            instructions: `## İLK SEANS — AŞAMA 2: HAFİF KEŞİF
Kullanıcı biraz ısındı. Şimdi hafifçe keşfe başlayabiliriz.
- Bugün en çok ne üzerinde durmak istediğini sor.
- Güncel bir durumu veya duyguyu somutlaştırmaya çalış.
- Henüz geçmişe fazla gitme; şimdiki anı anla.
- Güçlü yönlerini fark etmeye başla — ama hemen söyleme, not al.
- Sona doğru: "Bugün burada ne paylaştıysan, bunun için cesaretliysin" gibi bir tanıma cümlesi kur.`,
        };
    }

    return {
        stage: 3,
        instructions: `## İLK SEANS — AŞAMA 3: DERİNLEŞME HAZIRLIĞI
Kullanıcı kendini ifade etmeye başladı. Artık daha derin konuşmaya zemin hazır.
- Tekrarlayan bir tema veya duygu gözlemlediysen, bunu nazikçe yansıt.
- Gelecek seanslarda neler üzerine çalışmak istediğini sor.
- Seansı doğal bir kapanışa götür: bugün ne paylaştı, nasıl hissetti?
- Geri dönmek için davet et — baskı yapmadan.`,
    };
}

/**
 * Onboarding prompt bölümünü oluşturur.
 * Yalnızca ilk seans (session_count === 0 veya 1) için kullan.
 * @param {Array} messages — mevcut seans mesajları
 * @param {number} sessionCount — profildeki toplam seans sayısı
 * @returns {string}
 */
export function buildOnboardingContext(messages, sessionCount) {
    if (sessionCount > 1) return ''; // İlk seans değil

    const userMsgCount = (messages || []).filter(m => m.role === 'user').length;
    const { instructions } = getOnboardingStage(userMsgCount);
    return instructions;
}
