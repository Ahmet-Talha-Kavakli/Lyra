/**
 * Relational Dynamics Tracker
 *
 * "Lyra'nın Aynası Olması"
 *
 * İnsan-terapist ilişkisinin kendisini çalışmaya çeviren servis.
 *
 * Konsept: En iyi terapistler fark ederler ki hasta-terapist ilişkisindeki
 * dinamikler, hastanın diğer ilişkilerinin **aynı modelini** taşır.
 *
 * Örnek:
 * - Hasta terapiste her şeyi söyler ama sorular sormaz (ilişkide tek yönlü)
 * - Terapist bunu fark eder: "Başkalarına da böyle mi davranıyorsun?"
 * - Bu ilişkinin çözülmesi = diğer ilişkiler de iyileşir
 *
 * Bu servis:
 * 1. Lyra-hasta ilişkisini gerçek zamanlı analiz eder
 * 2. İlişkisel pattern'ları bulur (transference, projection, etc.)
 * 3. Meta-communication intervention'ları oluşturur
 * 4. Hasta'nın kendi pattern'larını farkına vardırır
 */

import { logger } from '../../../lib/infrastructure/logger.js';
import { getAdminSupabaseClient } from '../../../lib/shared/supabaseAdmin.ts';
import { Redis } from '@upstash/redis';

const supabase = getAdminSupabaseClient();
const redis = Redis.fromEnv();

export class RelationalDynamicsTracker {
    constructor(options = {}) {
        this.userId = options.userId;
        this.sessionId = options.sessionId;

        logger.info('[RelationalDynamics] Initialized', {
            userId: this.userId,
            sessionId: this.sessionId
        });
    }

    /**
     * ANALYZE RELATIONAL PATTERN
     * Lyra-hasta ilişkisindeki dynamics'i analiz eder
     *
     * Neler kontrol eder:
     * 1. Reciprocity: Hasta terapiste sorular soruyor mu?
     * 2. Vulnerability: Hasta kendi duygularını açıyor mu, yoksa dış factorları mı?
     * 3. Trust building: Her turda biraz daha mı açılıyor?
     * 4. Defensiveness: Müdahaleye karşı dirençli mi?
     * 5. Dependency: Aşırı mı bağlıyor?
     */
    async analyzeRelationalPattern(currentTranscript, conversationHistory = []) {
        try {
            const pattern = {
                reciprocity: this.analyzeReciprocity(conversationHistory),
                vulnerability: this.analyzeVulnerability(currentTranscript),
                trustProgression: this.analyzeTrustProgression(conversationHistory),
                defensiveness: this.analyzeDefensiveness(currentTranscript),
                dependency: this.analyzeDependency(conversationHistory),
                detectedTransference: this.detectTransference(conversationHistory, currentTranscript)
            };

            logger.info('[RelationalDynamics] Pattern analyzed', {
                userId: this.userId,
                reciprocity: pattern.reciprocity,
                vulnerability: pattern.vulnerability.level
            });

            return pattern;
        } catch (error) {
            logger.error('[RelationalDynamics] Pattern analysis failed:', error);
            return null;
        }
    }

    /**
     * ANALYZE RECIPROCITY
     * Hasta-terapist iletişiminde tek yönlü mü, karşılıklı mı?
     *
     * Basit metrik:
     * - Hasta ne kadar soru soruyor?
     * - Terapistin cevaplarına tepki veriyor mu?
     */
    analyzeReciprocity(history) {
        if (!history || history.length === 0) {
            return { level: 'unknown', score: 0.5 };
        }

        const userMessages = history.filter(m => m.role === 'user');
        const totalQuestions = userMessages.filter(m => m.content.includes('?')).length;
        const reciprocityScore = totalQuestions / Math.max(userMessages.length, 1);

        let level = 'imbalanced';
        if (reciprocityScore > 0.3) level = 'healthy';
        if (reciprocityScore > 0.5) level = 'highly_reciprocal';
        if (reciprocityScore < 0.1) level = 'very_one_sided';

        return {
            level,
            score: Math.min(reciprocityScore, 1),
            totalQuestions,
            messageCount: userMessages.length
        };
    }

    /**
     * ANALYZE VULNERABILITY
     * Hasta kendi duygularını açığa çıkarıyor mu,
     * yoksa dış olayları mı anlatıyor?
     */
    analyzeVulnerability(transcript) {
        if (!transcript) {
            return { level: 'unknown', score: 0.5 };
        }

        const vulnerabilityKeywords = [
            'hissediyorum', 'korkuyorum', 'üzülüyorum', 'utanıyorum',
            'yetersiz', 'değersiz', 'çaresiz', 'yalnız',
            'duygusal', 'acı', 'ağlıyorum', 'özel', 'güvensiz'
        ];

        const externalKeywords = [
            'baba', 'anne', 'bos', 'arkadaş', 'başkası', 'diğer',
            'yapıyor', 'yapıp', 'etti', 'söyledi', 'dedi'
        ];

        const lowerTranscript = transcript.toLowerCase();
        const vulnerabilityCount = vulnerabilityKeywords.filter(kw =>
            lowerTranscript.includes(kw)
        ).length;
        const externalCount = externalKeywords.filter(kw =>
            lowerTranscript.includes(kw)
        ).length;

        const totalRelevant = vulnerabilityCount + externalCount;
        const score = totalRelevant > 0 ? vulnerabilityCount / totalRelevant : 0.5;

        let level = 'moderate';
        if (score > 0.7) level = 'highly_vulnerable';
        if (score < 0.3) level = 'defended';

        return {
            level,
            score: Math.min(score, 1),
            vulnerabilityKeywords: vulnerabilityCount,
            externalFocus: externalCount
        };
    }

    /**
     * ANALYZE TRUST PROGRESSION
     * Her session'da hastanın daha mı açılıyor?
     */
    analyzeTrustProgression(history) {
        if (!history || history.length < 2) {
            return { level: 'insufficient_data', trend: null };
        }

        const userMessages = history.filter(m => m.role === 'user');
        if (userMessages.length < 2) {
            return { level: 'insufficient_data', trend: null };
        }

        // İlk 3 message vs. son 3 message'ı karşılaştır
        const earlyMessages = userMessages.slice(0, 3);
        const recentMessages = userMessages.slice(-3);

        const earlyWordCount = earlyMessages.reduce((sum, m) =>
            sum + m.content.split(' ').length, 0
        );
        const recentWordCount = recentMessages.reduce((sum, m) =>
            sum + m.content.split(' ').length, 0
        );

        const trend = recentWordCount > earlyWordCount ? 'increasing_openness' :
                     recentWordCount < earlyWordCount ? 'decreasing_openness' :
                     'stable';

        return {
            level: trend === 'increasing_openness' ? 'building' :
                   trend === 'decreasing_openness' ? 'withdrawing' : 'stable',
            trend,
            earlyWordCount,
            recentWordCount
        };
    }

    /**
     * ANALYZE DEFENSIVENESS
     * Terapistin müdahalelerine karşı ne kadar dirençli?
     */
    analyzeDefensiveness(transcript) {
        if (!transcript) {
            return { level: 'unknown', score: 0.5 };
        }

        const defensiveKeywords = [
            'ama', 'fakat', 'hayır', 'değil', 'olmaz', 'başka',
            'bu değil', 'yanlış', 'anlamadın', 'tam olarak değil'
        ];

        const lowerTranscript = transcript.toLowerCase();
        const defensiveCount = defensiveKeywords.filter(kw =>
            lowerTranscript.includes(kw)
        ).length;

        const defensiveScore = Math.min(defensiveCount / 3, 1);

        let level = 'open';
        if (defensiveScore > 0.6) level = 'quite_defensive';
        if (defensiveScore > 0.8) level = 'highly_defensive';
        if (defensiveScore < 0.2) level = 'very_open';

        return {
            level,
            score: defensiveScore,
            defensiveMarkers: defensiveCount
        };
    }

    /**
     * ANALYZE DEPENDENCY
     * Hasta terapiste aşırı bağımlı mı?
     */
    analyzeDependency(history) {
        if (!history || history.length === 0) {
            return { level: 'unknown', score: 0.5 };
        }

        const dependencyKeywords = [
            'sen söyle', 'sen karar ver', 'ne yapmalı', 'ne yapıyım',
            'lütfen yardım', 'sen bil', 'seninle olmak', 'ayrılmak istemiyorum'
        ];

        const lastMessages = history.slice(-5);
        const dependencyCount = lastMessages.filter(m =>
            m.role === 'user' &&
            dependencyKeywords.some(kw => m.content.toLowerCase().includes(kw))
        ).length;

        const dependencyScore = dependencyCount / Math.max(lastMessages.length, 1);

        let level = 'healthy';
        if (dependencyScore > 0.4) level = 'moderate_dependency';
        if (dependencyScore > 0.6) level = 'high_dependency';

        return {
            level,
            score: dependencyScore,
            dependencyMarkers: dependencyCount
        };
    }

    /**
     * DETECT TRANSFERENCE
     * Hasta, başkasını (baba/anne/eski partner) terapiste yansıtıyor mu?
     *
     * Transference = Geçmişteki önemli insanın özellikleri,
     *                terapiste atfediliyor
     */
    detectTransference(history, currentTranscript) {
        const transferences = [];

        if (!history || !currentTranscript) {
            return transferences;
        }

        // Pattern: "Baba da bana böyle yapıyordu" + "Sen de bana böyle..."
        const parentPatterns = [
            { keyword: 'baba', name: 'paternal_transference' },
            { keyword: 'anne', name: 'maternal_transference' },
            { keyword: 'eski partner', name: 'romantic_transference' },
            { keyword: 'boss', name: 'authority_transference' }
        ];

        parentPatterns.forEach(pattern => {
            const mentionedInHistory = history.some(m =>
                m.content.toLowerCase().includes(pattern.keyword)
            );

            // Eğer history'de parent mention varsa ve şu an terapiste karşı benzer tepki varsa
            if (mentionedInHistory) {
                const current_lower = currentTranscript.toLowerCase();

                // Temel transference indicator: tension/trust/power dinamiği
                if (current_lower.includes('sen de') ||
                    current_lower.includes('seninle de') ||
                    current_lower.includes('tıpkı gibi')) {

                    transferences.push({
                        type: pattern.name,
                        indicator: `Patient comparing therapist to ${pattern.keyword}`,
                        confidence: 0.7
                    });
                }
            }
        });

        return transferences;
    }

    /**
     * GENERATE META-COMMUNICATION INTERVENTION
     * Lyra'nın ilişkinin kendisini gözlemlemesi
     *
     * Meta-communication = "Şu an aramızda olan şeyin kendisinden konuşmak"
     *
     * Örnek:
     * Hasta: "Seni seviyorum, ama koruyucu buluyorum"
     * Lyra (meta-communication):
     *   "Fark ettin mi şu an bunu söyledikten sonra biraz sessiz kaldın?
     *    Benimle bu zor duygulardan bahsetmek zor mu?"
     */
    generateMetaCommunicationIntervention(pattern, lastExchange) {
        const interventions = [];

        // 1. One-sidedness hakkında
        if (pattern.reciprocity.level === 'very_one_sided') {
            interventions.push({
                type: 'reciprocity_awareness',
                message: `Fark ettin mi, şu ana kadar sen bana çok şey söyledin ama bana hiç soru sormadın?
                         Başka insanlarla da böyle mi konuşuyorsun - onlara çok açılıp, onların hayatından hiçbir şey öğrenmeden?`,
                confidence: 0.8,
                purpose: 'Help patient see their own role in the relationship'
            });
        }

        // 2. Defensiveness hakkında
        if (pattern.defensiveness.level === 'highly_defensive') {
            interventions.push({
                type: 'defensiveness_awareness',
                message: `Şu an söyledikten hemen sonra biraz "hayır ama..." dedi gibi oldun.
                         Benimle olan bu bağlantıyı korumaya çalışıyor musun?
                         Başka kişilerle de böyle yapınca, onlar sana yaklaşmayı bırakıyor mu?`,
                confidence: 0.75,
                purpose: 'Help see how defensive pattern operates in relationships'
            });
        }

        // 3. Dependency hakkında
        if (pattern.dependency.level === 'high_dependency') {
            interventions.push({
                type: 'autonomy_awareness',
                message: `Dikkat ettin mi, "ne yapmalı" diye soruyor musun?
                         Kendi cevabının ne olduğunu biliyorsun aslında.
                         Benim söylediklerime mi bağımlı olmaya başlıyorsun?
                         Yoksa çocukluğunda birisi "sana söylemek gerekirse yapamazsın" mi demişti?`,
                confidence: 0.7,
                purpose: 'Help patient reconnect with their own inner wisdom'
            });
        }

        // 4. Transference
        if (pattern.detectedTransference && pattern.detectedTransference.length > 0) {
            pattern.detectedTransference.forEach(trans => {
                interventions.push({
                    type: 'transference_awareness',
                    message: `Şu an benimle olan bu tepki, ${trans.type.replace('_', ' ')}'e benziyor.
                             Bildin mi bunu? Belki benimle ilişkinde, bir başkasının rolünü oynuyorum biraz?`,
                    confidence: trans.confidence,
                    purpose: 'Help patient see past-present relationship connection within the therapeutic relationship'
                });
            });
        }

        // 5. Trust progression
        if (pattern.trustProgression.trend === 'decreasing_openness') {
            interventions.push({
                type: 'trust_decline_awareness',
                message: `Başta daha açık konuşuyordun, şimdi biraz geri çekiliyor musun?
                         Benimle ilişkiye karşı biraz daha mı dikkatli olmaya başladın?`,
                confidence: 0.7,
                purpose: 'Discover reason for trust decline'
            });
        }

        return interventions;
    }

    /**
     * STORE RELATIONAL SESSION DATA
     * Session'ın relational dynamics'ini kaydet (sonra pattern görebilmek için)
     */
    async storeRelationalData(sessionData) {
        try {
            const { pattern, interventions, transcript } = sessionData;

            const { data, error } = await supabase
                .from('relational_dynamics_sessions')
                .insert({
                    user_id: this.userId,
                    session_id: this.sessionId,
                    relational_pattern: pattern,
                    meta_interventions: interventions,
                    transcript_summary: transcript?.substring(0, 500),
                    created_at: new Date().toISOString()
                })
                .select();

            if (error) {
                logger.warn('[RelationalDynamics] Failed to store session data:', error);
                return null;
            }

            logger.info('[RelationalDynamics] Session data stored', {
                sessionId: this.sessionId,
                patternType: pattern?.reciprocity?.level
            });

            return data;
        } catch (error) {
            logger.error('[RelationalDynamics] Storage failed:', error);
            return null;
        }
    }

    /**
     * GET PATTERN HISTORY
     * Bu hasta'nın ilişkisel pattern'larının zaman içindeki değişimi
     */
    async getPatternHistory(limit = 10) {
        try {
            const cacheKey = `lyra:user:${this.userId}:relational_history`;
            const cached = await redis.get(cacheKey);

            if (cached) {
                return typeof cached === 'string' ? JSON.parse(cached) : cached;
            }

            const { data, error } = await supabase
                .from('relational_dynamics_sessions')
                .select('relational_pattern, created_at')
                .eq('user_id', this.userId)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) {
                logger.error('[RelationalDynamics] History fetch failed:', error);
                return [];
            }

            await redis.set(cacheKey, JSON.stringify(data || []), { ex: 3600 });
            return data || [];
        } catch (error) {
            logger.error('[RelationalDynamics] getPatternHistory failed:', error);
            return [];
        }
    }
}

export default RelationalDynamicsTracker;
