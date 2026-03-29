// routes/chat.js
import express from 'express';
import { rateLimit } from 'express-rate-limit';
import { validateChatMessage } from '../lib/validators.js';
import { logger } from '../lib/logger.js';
import { supabase } from '../lib/supabase.js';
import { openai } from '../lib/openai.js';
import { sanitizeMessages, detectEmotion, extractTopics } from '../lib/helpers.js';
import {
    userEmotions, sessionTranscriptStore,
    activeSessionUserId, activeSessionId
} from '../lib/state.js';
import { getProfile, updateProfile, incrementSessionCount } from '../profile/profileManager.js';
import { extractProfileUpdates, analyzeSession } from '../profile/profileExtractor.js';
import { buildSystemPrompt } from '../therapy/promptBuilder.js';
import { runTherapyEngine } from '../therapy/therapyEngine.js';
import { saveSessionRecord, getTechniqueEffectiveness, updateTechniqueEffectiveness } from '../progress/sessionAnalyzer.js';
import { updateWeeklyMetrics, buildProgressContext } from '../progress/progressTracker.js';
import { evaluateCrisis } from '../crisis/stabilizationProtocol.js';
import { buildSessionContext } from '../therapy/contextTracker.js';
import { analyzeResponseQuality } from '../progress/qualityAnalyzer.js';
import { buildSessionBridgeContext, buildDynamicOpener } from '../therapy/sessionBridge.js';
import { extractTopicsCombined } from '../therapy/topicExtractor.js';
import { buildOnboardingContext } from '../therapy/onboardingFlow.js';
import { analyzeConversationRhythm, decideConversationSignal, getLastLyraAction } from '../therapy/conversationSignal.js';
import { detectScenario } from '../therapy/deepScenarios.js';
import { runRuleEngine } from '../therapy/ruleEngine.js';
import { runHypothesisEngine, buildHypothesisContext } from '../therapy/hypothesisEngine.js';
import { detectTopicBlindSpots, detectPatternBlindSpots, buildBlindSpotContext } from '../therapy/blindSpotDetector.js';
import {
    getPendingHomework, detectHomeworkMention,
    updateHomeworkStatus, buildHomeworkContext, runHomeworkEngine
} from '../therapy/homeworkEngine.js';
import {
    recallSimilarMoments, buildSemanticMemoryContext, runSemanticMemoryEngine
} from '../therapy/semanticMemory.js';
import { optimizePrompt, estimateTokens } from '../therapy/promptOptimizer.js';
import { buildVoiceContext } from '../therapy/voiceAnalyzer.js';
import {
    detectAndTranslate, translateResponse,
    cacheUserLanguage, getCachedLanguage, clearLanguageCache,
} from '../lib/languageDetector.js';
import { buildObjectContext } from '../lib/objectTracker.js';
import { buildPhysicalHarmContext } from '../lib/physicalHarmTracker.js';
import { buildVoiceBaselineContext } from '../lib/voiceBaselineEngine.js';
import { buildWindowOfToleranceContext } from '../lib/windowOfTolerance.js';
import { buildSomaticMarkerContext } from '../lib/somaticMarkers.js';
import { buildResistanceContext } from '../lib/resistancePatterns.js';
import { buildTransferenceContext } from '../lib/transferenceEngine.js';
import { buildSessionContinuityContext, analyzeSessionOpening } from '../lib/sessionContinuity.js';
import { buildHomeworkRecallContext, getPendingHomeworkFromLastSession } from '../lib/homeworkRecall.js';
import { assessBondQuality, buildBondStrengtheningContext, buildMirroringContext } from '../lib/therapeuticBond.js';
import { detectRupture, hypothesizeRuptureSource, buildRepairContext } from '../lib/ruptureRepair.js';
import { assessCulturalProfile, buildCulturalSensitivityContext, identifyTabuTopics } from '../lib/culturalSensitivity.js';
import { detectTrigger, buildTraumaSafetyContext, buildTraumaStabilizationContext, assessTraumaRetraumatizationRisk } from '../lib/traumaInformed.js';
import { assessSelfHarmRisk, detectPsychologicalCrisis, getTurkishMentalHealthResources } from '../lib/safetyMonitoring.js';
import { buildEthicalBoundaryStatement, checkScopeViolation, determineReferralNeed } from '../lib/ethicalBoundaries.js';
import { assessAttachmentStyle, buildAttachmentContext, buildAttachmentHealingStrategy } from '../lib/attachmentStyles.js';
import { analyzeNVCStructure, reframeWithNVC, buildEmpathyExercise, buildHealthyBoundaryScript, buildConflictResolutionSteps } from '../lib/communicationSkills.js';
import { detectLanguage, analyzeEmotionsMultilingual, getUserLanguagePreference } from '../lib/multilingualEngine.js';
import { assessEmotionalRegulationNeed, buildEmotionRegulationContext } from '../lib/dbtEmotionRegulation.js';
import { recommendUrgentDistressTechnique, buildDistressToleranceContext } from '../lib/dbtDistressTolerance.js';
import { recommendMindfulnessExercise, buildMindfulnessContext } from '../lib/dbtMindfulness.js';
import { assessInterpersonalNeed, buildInterpersonalEffectivenessContext, buildDifficultConversationScript } from '../lib/dbtInterpersonal.js';
import { detectAutomaticThoughts, buildThoughtRecord, assessCognitiveDistortion, buildCBTContext } from '../lib/cbtCognitiveBehavioral.js';
import { detectActiveSchemas, buildSchemaContext, suggestSchemaHealing } from '../lib/schemaTherapy.js';
import { detectFreezeState, buildSomaticGroundingContext, detectTraumaTriggers, assessTraumaLevel } from '../lib/somaticExperiencing.js';
import { identifyActiveParts, buildPartDialogueScript, buildIFSContext, buildSelfLeadershipGuide } from '../lib/internalFamilySystems.js';
import { assessCulturalContext, buildTurkishSafetyContext, identifyShamePatterns, getLocalResources as getTurkishResources } from '../lib/turkishCulturalModule.js';
import { assessSuicideSeverity, detectSelfHarmEscalation, buildCrisisIntervention, buildCrisisPhaseGuidance, getLocalResources as getCrisisResources } from '../lib/advancedCrisisProtocol.js';
import { detectMetacognitiveProcess, buildMetacognitionContext, buildMetacognitionExercise, analyzeMetacognitiveTrap } from '../lib/metacognition.js';
import { detectExecutiveFunction, buildExecutiveFunctionContext, buildDailyStructurePlan, buildExecutiveFunctionSummary } from '../lib/executiveFunction.js';
import { detectCognitiveRigidity, buildCognitiveFlexibilityContext, buildPerspectiveTakingExercise } from '../lib/cognitiveFlexibility.js';
import { detectMovementNeed, buildMovementContext, buildWeeklyMovementPlan } from '../lib/movementTherapy.js';
import { detectSleepIssue, buildSleepHygieneContext, buildPersonalSleepPlan, buildCircadianRhythmReset } from '../lib/sleepHygiene.js';
import { detectHabitPattern, buildHabitChangeContext, build30DayHabitChangePlan } from '../lib/habitTracking.js';
import { detectValueGaps, buildValuesClarificationContext, buildValueActionAlignmentPlan } from '../lib/valuesClarification.js';
import { detectExistentialCrisis, buildMeaningContext, buildIkigaiMap, buildPurposeFindingExercise } from '../lib/meaningAndPurpose.js';
import { assessResilienceFactors, buildResilienceContext, buildPostTraumaticGrowthPlan } from '../lib/resilienceBuilding.js';
import { detectAssessmentTiming, buildAssessmentsContext } from '../lib/standardizedAssessments.js';
import { detectProgressSignals, buildProgressDashboard } from '../lib/progressDashboard.js';
import { detectFamilyDynamics, buildFamilyDynamicsContext, buildFamilyRoleAnalysis, buildDifferentiationMap } from '../lib/familyDynamics.js';
import { detectRelationshipConflict, buildGottmanContext, buildRelationshipRepairGuide, buildConflictResolutionTactics } from '../lib/relationshipTherapy.js';
import { detectReligionSpirituality, buildReligionSpiritualityContext, buildSpiritualCrisisMudahale } from '../lib/religionSpirituality.js';
import { detectLGBTQPlusContext, buildLGBTQAffirmingContext, buildComingOutGuide } from '../lib/lgbtqInclusion.js';
import { detectImmigrantExperience, detectRefugeeTrauma, buildCultureShockContext, buildHomesicknessHealing } from '../lib/immigrantExperience.js';
import { detectPhobiaAvoidance, buildExposureHierarchy, buildSUDSFeedback, buildExposureTherapyGuide } from '../lib/exposureTherapy.js';
import { assessPERMA, identifyCharacterStrengths, buildPERMAReport, buildCharacterStrengthsProfile, buildGratitudePractice } from '../lib/positivePsychology.js';

const router = express.Router();

// ─── CUSTOM LLM ENDPOINT (VAPI BEYİN) ─────────────────────
const chatRateLimit = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    // userId varsa per-user, yoksa IP bazlı (Vapi gibi sistem çağrıları için)
    keyGenerator: (req) => req.userId || req.ip,
    handler: (req, res) => {
        logger.warn('Rate limit aşıldı', { userId: req.userId, ip: req.ip });
        res.status(429).json({ error: 'Çok fazla mesaj gönderildi, lütfen bekleyin.' });
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Helper: yogunlukToNum (needed for rule engine)
const yogunlukToNum = (y) => ({ 'düşük': 30, 'orta': 60, 'yüksek': 90 }[y] ?? 60);

// Helper: retrieveKnowledge (inline from server.js)
async function retrieveKnowledge(query, opts = {}) {
    const { limit = 3, category } = opts;
    if (!query || query.length < 3) return [];

    try {
        let queryEmbedding = null;
        try {
            const embRes = await openai.embeddings.create({
                model: 'text-embedding-ada-002',
                input: query.substring(0, 500)
            });
            queryEmbedding = embRes.data[0].embedding;
        } catch (_) {
            // embedding başarısız — keyword fallback'e geç
        }

        let q = supabase
            .from('knowledge_sources')
            .select('id, source_type, title, author, summary, category, subcategory, tags, credibility_score, embedding')
            .eq('is_active', true);
        if (category && category !== 'all') q = q.eq('category', category);
        const { data: sources, error } = await q.limit(80);
        if (error || !sources?.length) return [];

        const queryLower = query.toLowerCase();
        const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);

        const scored = sources.map(source => {
            let score = 0;

            if (queryEmbedding && source.embedding) {
                const a = queryEmbedding;
                const b = source.embedding;
                let dot = 0, normA = 0, normB = 0;
                for (let i = 0; i < a.length; i++) {
                    dot += a[i] * b[i];
                    normA += a[i] * a[i];
                    normB += b[i] * b[i];
                }
                score = dot / (Math.sqrt(normA) * Math.sqrt(normB) + 1e-8);
            } else {
                const titleLower = (source.title || '').toLowerCase();
                const summaryLower = (source.summary || '').toLowerCase();
                const tagsLower = (source.tags || []).join(' ').toLowerCase();

                for (const word of queryWords) {
                    if (titleLower.includes(word)) score += 0.4;
                    if (summaryLower.includes(word)) score += 0.25;
                    if (tagsLower.includes(word)) score += 0.2;
                }
                score += (source.credibility_score || 0.8) * 0.05;
                score = Math.min(score, 1);
            }

            return { ...source, relevance: Math.round(score * 100) / 100 };
        });

        return scored
            .filter(s => s.relevance > 0.1)
            .sort((a, b) => b.relevance - a.relevance)
            .slice(0, limit)
            .map(({ embedding: _e, ...rest }) => rest);
    } catch (err) {
        console.warn('[retrieveKnowledge] Hata:', err.message);
        return [];
    }
}

router.post('/v1/v1/api/chat/completions', chatRateLimit, validateChatMessage, async (req, res) => {
    // Vapi Custom LLM secret doğrulaması
    const VAPI_SECRET = process.env.VAPI_SECRET;
    if (VAPI_SECRET) {
        const incoming = req.headers.authorization?.split(' ')[1];
        if (incoming !== VAPI_SECRET) {
            return res.status(401).json({ error: 'Unauthorized' });
        }
    }

    try {
        const { messages: rawMessages, model, temperature, max_tokens, call } = req.body;

        // B3 — Input sanitizasyon
        const messages = sanitizeMessages(rawMessages);
        console.log(`[CUSTOM LLM] İstek alındı! Gelen mesaj sayısı: ${messages?.length}`);

        // Serverless ortamda activeSessionUserId güvenilmez — Vapi'nin call.assistantOverrides'ından al
        // userId çözümleme — 3 katmanlı fallback
        // 1. Vapi assistantOverrides (en güvenilir — frontend'den set edilir)
        // 2. Vapi call metadata (webhook'tan set edilir)
        // 3. In-memory fallback (single instance için)
        const userId =
            call?.assistantOverrides?.variableValues?.userId ||
            call?.metadata?.userId ||
            activeSessionUserId;

        if (!userId) {
            console.warn('[CUSTOM LLM] userId tespit edilemedi — kişiselleştirme devre dışı');
        }

        // ─── DİL TESPİTİ + ÇEVİRİ ──────────────────────────────────────
        const lastRawMessage = messages?.[messages.length - 1]?.content || '';
        let userLang = getCachedLanguage(userId) || 'tr';
        let translatedLastMessage = lastRawMessage;
        try {
            // İlk 3 mesajda her seferinde tespit et — sonra cache'den oku
            const msgCount = messages.filter(m => m.role === 'user').length;
            if (msgCount <= 3 || !getCachedLanguage(userId)) {
                const langResult = await detectAndTranslate(lastRawMessage);
                userLang = langResult.lang;
                translatedLastMessage = langResult.translatedToTurkish;
                cacheUserLanguage(userId, userLang);
                if (langResult.isTranslated) {
                    console.log(`[LANG] ${userLang} → Türkçe çevrildi`);
                    // Mesaj listesinde son kullanıcı mesajını Türkçe'ye çevir — NLP için
                    const lastIdx = messages.map(m => m.role).lastIndexOf('user');
                    if (lastIdx !== -1) {
                        messages[lastIdx] = { ...messages[lastIdx], content: translatedLastMessage };
                    }
                }
            }
        } catch (langErr) {
            console.warn('[LANG] Dil tespiti başarısız:', langErr.message);
        }
        // ─── LYRA AI TERAPİST — DİNAMİK PROMPT SİSTEMİ ─────────────────
        let dynamicSystemPrompt = null;
        let therapyEngineOutput = null;
        let psychProfile = null;
        let crisisEval = { level: null };
        try {
            if (userId) {
                // 1. Psikolojik profili yükle
                psychProfile = await getProfile(userId);

                // 2. Teknik etkinlik verisi
                const effectivenessData = await getTechniqueEffectiveness(userId);

                // 3. Son kullanıcı mesajını al
                const lastUserMessage = messages?.[messages.length - 1]?.content || '';

                // 4. Duygu tespiti — phrase matching, negasyon filtresi, çoklu duygu
                const emotionResult = detectEmotion(lastUserMessage);
                const currentEmotion = emotionResult.primary; // geriye dönük uyumluluk

                // 5. Kriz değerlendirmesi
                const prevUserMessages = (messages || []).slice(-3, -1).filter(m => m.role === 'user');
                const prevMessage = prevUserMessages[prevUserMessages.length - 1]?.content || '';
                const prevCrisis = prevMessage ? evaluateCrisis(prevMessage) : { level: null };
                crisisEval = evaluateCrisis(lastUserMessage, { previousCrisisLevel: prevCrisis.level });

                // 6. Seans konularını son mesajlardan çıkar
                const recentMessages = (messages || []).slice(-6)
                    .filter(m => m.role === 'user')
                    .map(m => m.content || '')
                    .join(' ');
                const topics = extractTopics(recentMessages);

                // 6b. Konuşma ritmi ve sinyali — topics'ten SONRA hesaplanır
                const rhythmState = analyzeConversationRhythm(messages || []);
                const conversationSignal = decideConversationSignal({
                    emotionResult,
                    messageLength: lastUserMessage.length,
                    messageCount: (messages || []).filter(m => m.role === 'user').length,
                    lastLyraAction: getLastLyraAction(messages || []),
                    dominantTopics: topics,
                    rhythmState,
                    messageContent: lastUserMessage,
                });
                console.log(`[SIGNAL] ${conversationSignal} | Ritim: ${rhythmState.writerType}/${rhythmState.trend} | Duygu: ${currentEmotion}/${emotionResult.intensity}`);

                // 6c. Aktif senaryo tespiti — topics + emotion'dan sonra
                const activeScenario = detectScenario(messages || [], currentEmotion, topics);
                if (activeScenario) console.log(`[SCENARIO] ${activeScenario}`);

                // ── SPRINT 4: Culture & Safety Kontrolleri (İlk) ──────────────────

                // Scope Violation kontrol (hukuk, ilaç, vs)
                const scopeCheck = checkScopeViolation(lastUserMessage);
                if (scopeCheck.isOutOfScope) {
                    console.warn(`[ETHICS] Out of scope: ${scopeCheck.category}`);
                }

                // Self-harm ve suicide riski kontrol
                const selfHarmRisk = assessSelfHarmRisk(lastUserMessage, emotionResult, messages || []);
                if (selfHarmRisk.riskLevel !== 'low') {
                    console.error(`[SAFETY] Self-harm risk: ${selfHarmRisk.riskLevel} | Indicators: ${selfHarmRisk.indicators.join(',')}`);
                }

                // Psikolojik kriz kontrol
                const psychiCrisis = detectPsychologicalCrisis(lastUserMessage);
                if (psychiCrisis.hasCrisis) {
                    console.error(`[SAFETY] Psychological crisis: ${psychiCrisis.crisisType} | Severity: ${psychiCrisis.severity}`);
                }

                // 7. Terapi motorunu çalıştır
                therapyEngineOutput = runTherapyEngine({
                    currentEmotion,
                    emotionIntensity: emotionResult.intensity,
                    messageContent: lastUserMessage,
                    sessionHistory: messages || [],
                    profile: psychProfile,
                    topics,
                    effectivenessData
                });

                // 8. Kriz / kriz-sonrası modu tamamen override et
                if (crisisEval.instruction) {
                    therapyEngineOutput.modeInstruction = crisisEval.instruction;
                    if (crisisEval.level === 'HIGH' || crisisEval.postCrisis) {
                        therapyEngineOutput.techniqueHints = '';
                    }
                }

                // 7. İlerleme bağlamı
                const progressContext = await buildProgressContext(userId);

                // Ev ödevi takibi — bekleyen ödevleri al ve seans içi tamamlama tespiti yap
                let pendingHomework = [];
                try {
                    pendingHomework = await getPendingHomework(userId);
                    // Kullanıcı bu mesajda ödevden bahsetti mi?
                    const hwMention = detectHomeworkMention(lastUserMessage, pendingHomework);
                    if (hwMention) {
                        await updateHomeworkStatus(hwMention.homeworkId, hwMention.status, hwMention.note);
                        console.log(`[HOMEWORK] Ödev durumu güncellendi: ${hwMention.status}`);
                        // Güncellenen ödev listeden çıkar
                        pendingHomework = pendingHomework.filter(hw => hw.id !== hwMention.homeworkId);
                    }
                } catch (hwErr) {
                    console.warn('[HOMEWORK] Takip hatası:', hwErr.message);
                }

                // 7b. Önceki seans köprüsü
                const sessionBridgeContext = await buildSessionBridgeContext(userId, supabase);

                // 7c. Dinamik seans açılışı
                const sessionOpener = await buildDynamicOpener(
                    userId,
                    supabase,
                    psychProfile?.session_count || 0
                );

                // 8. Seans içi bağlam
                const sessionContext = buildSessionContext(messages || []);

                // 9. Temel sistem promptu
                const basePrompt = buildSystemPrompt(psychProfile, therapyEngineOutput, currentEmotion, conversationSignal, rhythmState, emotionResult, activeScenario, sessionOpener);

                // ─── PROMPT BLOKLARINI TOPLA ─────────────────────────────────

                // Teknik etkinliği metni
                let techniqueBlock = '';
                if (effectivenessData?.length > 0) {
                    const positive = effectivenessData
                        .filter(t => t.used_count > 0 && (t.positive_responses / t.used_count) >= 0.6)
                        .sort((a, b) => (b.positive_responses / b.used_count) - (a.positive_responses / a.used_count))
                        .slice(0, 3).map(t => t.technique_id);
                    const negative = effectivenessData
                        .filter(t => t.used_count > 1 && (t.positive_responses / t.used_count) < 0.3)
                        .slice(0, 2).map(t => t.technique_id);
                    if (positive.length > 0 || negative.length > 0) {
                        techniqueBlock = '\n\n[TEKNİK ETKİNLİĞİ — Bu kullanıcı için öğrenilmiş bilgi]';
                        if (positive.length > 0) techniqueBlock += `\nİşe yarayan: ${positive.join(', ')}`;
                        if (negative.length > 0) techniqueBlock += `\nAz işe yarayan: ${negative.join(', ')}`;
                    }
                }

                // L4-L6 + kör nokta + semantik hafıza
                let ruleEngineBlock = '';
                let blindSpotBlock = '';
                let semanticMemoryBlock = '';
                try {
                    let recentSessions = [];
                    const { data: sessionRows } = await supabase
                        .from('session_records')
                        .select('dominant_emotion, session_quality, breakthrough_moment, topics, created_at')
                        .eq('user_id', userId)
                        .order('created_at', { ascending: false })
                        .limit(3);
                    if (sessionRows) recentSessions = sessionRows;

                    ruleEngineBlock = runRuleEngine({
                        content: lastUserMessage,
                        emotionResult,
                        messageLength: lastUserMessage.length,
                        silenceDurationSeconds: call?.silenceDuration ?? null,
                        messageCount: (messages || []).filter(m => m.role === 'user').length,
                        recentSessions,
                        psychProfile,
                    });

                    blindSpotBlock = buildBlindSpotContext(
                        detectTopicBlindSpots(recentSessions),
                        detectPatternBlindSpots(messages || [])
                    );

                    const similarMoments = await recallSimilarMoments(userId, lastUserMessage, 3);
                    semanticMemoryBlock = buildSemanticMemoryContext(similarMoments);
                } catch (ruleErr) {
                    console.warn('[RULE ENGINE] Hata:', ruleErr.message);
                }

                // Ses analizi — transcriptStore'dan voice context üret
                const transcriptStateForVoice = sessionTranscriptStore.get(userId) || sessionTranscriptStore.get(activeSessionUserId);
                const voiceBlock = buildVoiceContext(transcriptStateForVoice, emotionResult);

                // ── YENİ: Nesne takibi + fiziksel zarar + ses baseline ────────
                const nesneContextBlock = buildObjectContext(userId);

                // Fiziksel zarar context (seanslar arası, async)
                let physicalHarmBlock = '';
                try {
                    const userStateNow = userEmotions.get(userId) || userEmotions.get(activeSessionUserId);
                    const sonAnaliz = userStateNow?.son_analiz;
                    if (sonAnaliz?.fiziksel_zarar && (sessionId || activeSessionId)) {
                        physicalHarmBlock = await buildPhysicalHarmContext(
                            userId, sessionId || activeSessionId,
                            sonAnaliz.fiziksel_zarar, sonAnaliz.ortam
                        );
                    }
                } catch { /* DB hatası — devam et */ }

                // Ses baseline — kişisel norm sapması
                let voiceBaselineBlock = '';
                try {
                    if (transcriptStateForVoice) {
                        voiceBaselineBlock = await buildVoiceBaselineContext(userId, {
                            tempo: transcriptStateForVoice.konusmaTempo || 0,
                            loudness: transcriptStateForVoice.sesYogunlukOrt || 0,
                            tremor: !!transcriptStateForVoice.sesTitreme,
                            monotone: !!transcriptStateForVoice.sesMonotonluk,
                            vokalBreak: !!transcriptStateForVoice.vokalBreak,
                            isWhisper: !!transcriptStateForVoice.isWhisper,
                        });
                    }
                } catch { /* DB hatası — devam et */ }

                // ── SPRINT 2: Psikolojik Derinlik Blokları ──────────────────

                // Window of Tolerance (hypo/hyperarousal)
                let windowOfToleranceBlock = '';
                try {
                    const userStateW = userEmotions.get(userId) || userEmotions.get(activeSessionUserId);
                    const voiceDataW = transcriptStateForVoice || {};
                    const breathDataW = userStateW?.son_analiz?.landmarks?.breath || {};
                    const gazeDataW = userStateW?.son_analiz?.stable_gaze || userStateW?.son_analiz?.landmarks?.stable_gaze || {};

                    windowOfToleranceBlock = buildWindowOfToleranceContext(
                        {
                            tempo: voiceDataW.konusmaTempo || 0,
                            loudness: voiceDataW.sesYogunlukOrt || 0,
                            tremor: !!voiceDataW.sesTitreme,
                            monotone: !!voiceDataW.sesMonotonluk,
                        },
                        breathDataW,
                        gazeDataW,
                        {
                            avgTempo: psychProfile?.voice_baseline?.avg_tempo || 0,
                            avgLoudness: psychProfile?.voice_baseline?.avg_loudness || 0,
                        }
                    );
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Somatic Markers (beden sinyalleri)
                let somaticMarkersBlock = '';
                try {
                    const userStateS = userEmotions.get(userId) || userEmotions.get(activeSessionUserId);
                    const voiceDataS = transcriptStateForVoice || {};
                    const breathDataS = userStateS?.son_analiz?.landmarks?.breath || {};
                    const gazeDataS = userStateS?.son_analiz?.stable_gaze || {};
                    const colorDataS = userStateS?.son_analiz?.landmarks?.face_color || {};

                    somaticMarkersBlock = buildSomaticMarkerContext({
                        breathData: breathDataS,
                        voiceData: {
                            tempo: voiceDataS.konusmaTempo || 0,
                            loudness: voiceDataS.sesYogunlukOrt || 0,
                            tremor: !!voiceDataS.sesTitreme,
                            monotone: !!voiceDataS.sesMonotonluk,
                        },
                        gazeData: gazeDataS,
                        colorData: colorDataS,
                        arousalState: userStateS?.son_analiz?.arousal_state || 'normal',
                    });
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Resistance Patterns (savunma mekanizmaları)
                let resistanceBlock = '';
                try {
                    resistanceBlock = buildResistanceContext({
                        text: lastUserMessage,
                        voiceData: {
                            tempo: transcriptStateForVoice?.konusmaTempo || 0,
                            loudness: transcriptStateForVoice?.sesYogunlukOrt || 0,
                            tremor: !!transcriptStateForVoice?.sesTitreme,
                            monotone: !!transcriptStateForVoice?.sesMonotonluk,
                        },
                        gazeData: (userEmotions.get(userId) || userEmotions.get(activeSessionUserId))?.son_analiz?.stable_gaze || {},
                        breathData: (userEmotions.get(userId) || userEmotions.get(activeSessionUserId))?.son_analiz?.landmarks?.breath || {},
                        previousTopics: (recentSessions || []).flatMap(s => (s.topics || []).slice(0, 2)),
                    });
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Transference (Lyra'ya duygusal yönelim)
                let transferenceBlock = '';
                try {
                    transferenceBlock = await buildTransferenceContext(userId, {
                        text: lastUserMessage,
                        voiceData: {
                            loudness: transcriptStateForVoice?.sesYogunlukOrt || 0,
                            tempo: transcriptStateForVoice?.konusmaTempo || 0,
                            tremor: !!transcriptStateForVoice?.sesTitreme,
                            monotone: !!transcriptStateForVoice?.sesMonotonluk,
                        },
                        gazeData: (userEmotions.get(userId) || userEmotions.get(activeSessionUserId))?.son_analiz?.stable_gaze || {},
                        sessionCount: psychProfile?.session_count || 1,
                    });
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // ── SPRINT 3: Alliance & Intersession ────────────────────────

                // Session Continuity (seanslar arası bağlantı)
                let sessionContinuityBlock = '';
                try {
                    const daysElapsed = Math.floor((new Date() - new Date(psychProfile?.last_session_date || 0)) / (1000 * 60 * 60 * 24));
                    sessionContinuityBlock = await buildSessionContinuityContext(userId, lastUserMessage, daysElapsed);
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Homework Recall (ödev hatırlaması ve geri bildirim)
                let homeworkRecallBlock = '';
                try {
                    const userMentionedHomework = /ödev|task|yapıştım|yaptım|denedim|başladım/i.test(lastUserMessage);
                    homeworkRecallBlock = await buildHomeworkRecallContext(userId, userMentionedHomework);
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Therapeutic Bond Assessment (uyum ve güven değerlendirmesi)
                let bondBlock = '';
                try {
                    const bondAssessment = assessBondQuality(userId, messages || []);
                    bondBlock = buildBondStrengtheningContext(bondAssessment);
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Rupture Detection & Repair (kopuş tespit ve onarma)
                let ruptureRepairBlock = '';
                try {
                    const ruptureAssess = detectRupture(messages?.slice(-10) || []);
                    if (ruptureAssess.hasRupture) {
                        const sourceHyp = hypothesizeRuptureSource(
                            messages?.[messages.length - 2]?.content || '',
                            lastUserMessage,
                            { psychProfile }
                        );
                        ruptureRepairBlock = buildRepairContext(ruptureAssess, sourceHyp);
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // ── SPRINT 4: Culture & Safety Blokları ────────────────────────

                // Cultural Sensitivity (kültürel bağlam ve hassasiyet)
                let culturalBlock = '';
                try {
                    const culturalProfile = assessCulturalProfile(userId, messages || []);
                    culturalBlock = buildCulturalSensitivityContext(culturalProfile);
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Trauma-Informed Safety (tetikleyici, grounding)
                let traumaSafetyBlock = '';
                let groundingBlock = '';
                try {
                    const trigger = detectTrigger(lastUserMessage, topics || []);
                    if (trigger.hasTrigger) {
                        groundingBlock = trigger.grounding;
                    }
                    const retraumatizationRisk = assessTraumaRetraumatizationRisk(userId, messages || []);
                    if (retraumatizationRisk.riskLevel !== 'none') {
                        traumaSafetyBlock = `[TRAUMA — ${retraumatizationRisk.riskLevel.toUpperCase()}]\n${retraumatizationRisk.recommendation}`;
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Safety Monitoring Blocks (self-harm, suicide, crisis)
                let safetyBlock = '';
                try {
                    // Eğer önceki kontrollerde risk bulunduysa, blok oluştur
                    if (selfHarmRisk.riskLevel !== 'low') {
                        safetyBlock = selfHarmRisk.immediateAction;
                    }
                    if (psychiCrisis.hasCrisis) {
                        safetyBlock = psychiCrisis.intervention;
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Ethical Boundaries (Lyra'nın sınırları)
                let ethicalBlock = '';
                try {
                    if (scopeCheck.isOutOfScope) {
                        ethicalBlock = `[ETHICAL — OUT OF SCOPE]\n${scopeCheck.suggestion}`;
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Gaze direction + nefes — landmark'tan gelen veriler
                let gazeBreathBlock = '';
                const userStateNow2 = userEmotions.get(userId) || userEmotions.get(activeSessionUserId);
                const sonAnalizLM = userStateNow2?.son_analiz;
                if (sonAnalizLM) {
                    const parts = [];
                    // Gaze
                    const stableGaze = sonAnalizLM.nesne_context ? null : null; // nesne_context değil
                    const gazeInfo = sonAnalizLM.stable_gaze || (sonAnalizLM.landmarks?.stable_gaze);
                    if (gazeInfo?.psychological === 'kacis') {
                        parts.push('[GAZE — KAÇIŞ]: Kullanıcı ekrandan kaçıyor — dissosiyasyon veya konudan kaçınma sinyali.');
                    } else if (gazeInfo?.psychological === 'ic_ses') {
                        parts.push('[GAZE — İÇ SES]: Sol-aşağı bakış — aktif iç diyalog, duygularla yüzleşiyor olabilir. Beklemeyi tercih et.');
                    }
                    // Nefes
                    const breathInfo = sonAnalizLM.breath || (sonAnalizLM.landmarks?.breath);
                    if (breathInfo?.pattern === 'rapid') {
                        parts.push(`[NEFES — HIZLI]: Nefes hızlanmış (${breathInfo.bpm || '?'} bpm) — anksiyete/panik yüklü an.`);
                    } else if (breathInfo?.pattern === 'holding') {
                        parts.push('[NEFES — TUTUYOR]: Nefes tutuluyor — derin stres/donma tepkisi. Yavaşlatıcı bir an yarat.');
                    } else if (breathInfo?.pattern === 'shallow') {
                        parts.push('[NEFES — YÜZEYSEL]: Yüzeysel nefes — vücut gergin, dikkat et.');
                    }
                    // Yüz rengi
                    if (sonAnalizLM.renk_context) parts.push(sonAnalizLM.renk_context);
                    if (parts.length > 0) gazeBreathBlock = '\n\n' + parts.join('\n');
                }

                // ── DBT SKİLLS BLOCKS ────────────────────────────────────────

                // Emotion Regulation (ABC PLEASE, Opposite Action, Check Facts)
                let emotionRegulationBlock = '';
                try {
                    const emotionAssess = assessEmotionalRegulationNeed(lastUserMessage);
                    if (emotionAssess.regulations.length > 0) {
                        const technique = emotionAssess.regulations[0];
                        emotionRegulationBlock = buildEmotionRegulationContext(
                            technique === 'ABC PLEASE' ? 'abc_please' :
                            technique === 'Opposite Action' ? 'opposite_action' :
                            'check_the_facts'
                        );
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Distress Tolerance (DISTRACT, SELF-SOOTHE, TIPP, Radical Acceptance)
                let distressToleranceBlock = '';
                try {
                    const crisisIndicators = {
                        panic: crisisEval?.level === 'HIGH' && emotionResult?.primary === 'korku',
                        dissociation: topics?.some(t => ['dissosiasyon', 'gerçeklik hissi', 'uzaklaştırma'].includes(t)),
                        selfHarm: selfHarmRisk.riskLevel !== 'low',
                        suicidal: selfHarmRisk.riskLevel === 'critical',
                    };
                    if (Object.values(crisisIndicators).some(v => v)) {
                        const technique = recommendUrgentDistressTechnique(crisisIndicators);
                        if (technique.technique) {
                            distressToleranceBlock = buildDistressToleranceContext(
                                technique.technique === 'TIPP' ? 'tipp' :
                                technique.technique.includes('DISTRACT') ? 'distract' :
                                technique.technique.includes('Self-Soothe') ? 'self_soothe' :
                                'radical_acceptance'
                            );
                        }
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Mindfulness (Observe, Describe, Participate)
                let mindfulnessBlock = '';
                try {
                    const stressIndicators = {
                        stress_level: emotionResult?.intensity >= 7 ? 'high' : emotionResult?.intensity >= 4 ? 'moderate' : 'low',
                        racing_thoughts: lastUserMessage.split(' ').length > 100,
                        anxiety: emotionResult?.primary === 'korku' || emotionResult?.primary === 'endişe',
                    };
                    const mindfulnessRec = recommendMindfulnessExercise(stressIndicators);
                    if (mindfulnessRec.exercise) {
                        mindfulnessBlock = buildMindfulnessContext(
                            mindfulnessRec.exercise === 'observe' ? 'observe' :
                            mindfulnessRec.exercise === 'breathing' ? 'participate' :
                            'observe'
                        );
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Interpersonal Effectiveness (GIVE, DEAR MAN, GIVE FAST)
                let interpersonalBlock = '';
                try {
                    const interpersonalAssess = assessInterpersonalNeed(lastUserMessage);
                    if (interpersonalAssess.recommendation) {
                        let protocol = 'give';
                        if (interpersonalAssess.needsDEARMAN && !interpersonalAssess.needsGIVE) protocol = 'dear_man';
                        else if (interpersonalAssess.needsGIVEFAST && !interpersonalAssess.needsDEARMAN) protocol = 'give_fast';
                        else if (interpersonalAssess.needsDEARMAN && interpersonalAssess.needsGIVE) protocol = 'dear_man';

                        interpersonalBlock = buildInterpersonalEffectivenessContext(protocol);
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // ── 6 YENİ İLERİ MODÜL BLOCKS ──────────────────────────────

                // CBT — Bilişsel Davranış Terapisi
                let cbtBlock = '';
                try {
                    const cbtAssess = assessCognitiveDistortion(lastUserMessage);
                    if (cbtAssess.hasDistortion) {
                        cbtBlock = buildCBTContext('thought_record');
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Şema Terapisi
                let schemaBlock = '';
                try {
                    const schemaAssess = detectActiveSchemas(lastUserMessage);
                    if (schemaAssess.primarySchema) {
                        schemaBlock = buildSchemaContext(schemaAssess.primarySchema);
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Somatic Experiencing — Travma + Vücut
                let somaticBlock = '';
                try {
                    const userStateS = userEmotions.get(userId) || userEmotions.get(activeSessionUserId);
                    const freezeAssess = detectFreezeState({
                        tempo: transcriptStateForVoice?.konusmaTempo || 0,
                        breathing: userStateS?.son_analiz?.landmarks?.breath || {},
                    });
                    if (freezeAssess.isFrozen) {
                        somaticBlock = buildSomaticGroundingContext({});
                    }
                    const traumaTriggers = detectTraumaTriggers(lastUserMessage);
                    if (traumaTriggers.hasTraumaTriggers && !somaticBlock) {
                        somaticBlock = buildSomaticGroundingContext({});
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // IFS — İç Parçalar Sistemi
                let ifsBlock = '';
                try {
                    const ifsAssess = identifyActiveParts(lastUserMessage);
                    if (ifsAssess.activeParts.length > 0) {
                        ifsBlock = buildIFSContext(ifsAssess.primaryPart);
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Türkiye Kültürü — Kültürel Güvenlik
                let turkishCulturalBlock = '';
                try {
                    const culturalAssess = assessCulturalContext(lastUserMessage, userId);
                    if (culturalAssess.culturalFactors.length > 0) {
                        turkishCulturalBlock = buildTurkishSafetyContext(culturalAssess.culturalFactors);
                    }
                    const shameAssess = identifyShamePatterns(lastUserMessage);
                    if (shameAssess.hasShame && shameAssess.severityLevel > 50 && !turkishCulturalBlock) {
                        turkishCulturalBlock = buildTurkishSafetyContext(['shame_culture']);
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // İleri Kriz Protokolü — Hayat Tehdidi
                let advancedCrisisBlock = '';
                // ─── AŞAMA 1 — KOGNİTİF DERINLIK ──────────────────────────────
                // Metakognition — Düşünce hakkında düşünme
                let metacognitionBlock = '';
                try {
                    const metacogAssess = detectMetacognitiveProcess(lastUserMessage, messages || []);
                    if (metacogAssess.hasMetacognition && metacogAssess.severity !== 'low') {
                        const trapAnalysis = analyzeMetacognitiveTrap(lastUserMessage);
                        if (trapAnalysis.isMetacognitiveTrap) {
                            metacognitionBlock = '\n\n' + trapAnalysis.message;
                        } else if (metacogAssess.primaryProcess) {
                            metacognitionBlock = buildMetacognitionContext(metacogAssess.primaryProcess);
                        }
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Executive Function — ADHD/Odaklanma/Planlama
                let executiveFunctionBlock = '';
                try {
                    const execAssess = detectExecutiveFunction(lastUserMessage);
                    if (execAssess.hasExecutiveFunctionDeficit && execAssess.severity !== 'low') {
                        if (execAssess.primaryDeficit) {
                            executiveFunctionBlock = buildExecutiveFunctionContext(execAssess.primaryDeficit);
                        }
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Cognitive Flexibility — Katı Düşüncelerden Çıkış
                let cognitiveFlexibilityBlock = '';
                try {
                    const rigidAssess = detectCognitiveRigidity(lastUserMessage);
                    if (rigidAssess.hasCognitiveRigidity && rigidAssess.rigidityScore > 30) {
                        if (rigidAssess.primaryPattern) {
                            cognitiveFlexibilityBlock = buildCognitiveFlexibilityContext(rigidAssess.primaryPattern);
                        }
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // ─── AŞAMA 2 — BEDEN & YAŞAM ──────────────────────────────────
                // Movement Therapy — Hareket ve Ruh Sağlığı
                let movementBlock = '';
                try {
                    const moveAssess = detectMovementNeed(lastUserMessage);
                    if (moveAssess.hasMovementNeed && moveAssess.urgency === 'high') {
                        if (moveAssess.recommendedMovement) {
                            movementBlock = buildMovementContext(moveAssess.recommendedMovement);
                        }
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Sleep Hygiene — Uyku Kalitesi
                let sleepBlock = '';
                try {
                    const sleepAssess = detectSleepIssue(lastUserMessage);
                    if (sleepAssess.hasSleeIssue && sleepAssess.severity !== 'low') {
                        if (sleepAssess.detectedIssue) {
                            sleepBlock = buildSleepHygieneContext(sleepAssess.detectedIssue);
                        }
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Habit Tracking — Alışkanlık Analizi
                let habitBlock = '';
                try {
                    const habitAssess = detectHabitPattern(lastUserMessage);
                    if (habitAssess.hasHabitIssue && habitAssess.severity !== 'Düşük') {
                        if (habitAssess.habitType) {
                            habitBlock = buildHabitChangeContext(habitAssess.habitType);
                        }
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // ─── AŞAMA 3 — ANLAM & DEĞERLER ────────────────────────────────
                // Values Clarification — Yaşam Değerleri
                let valuesBlock = '';
                try {
                    const valueAssess = detectValueGaps(lastUserMessage);
                    if (valueAssess.hasValueGap && valueAssess.primaryGap) {
                        valuesBlock = buildValuesClarificationContext(valueAssess.primaryGap);
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Meaning and Purpose — Yaşam Amacı
                let meaningBlock = '';
                try {
                    const meaningAssess = detectExistentialCrisis(lastUserMessage);
                    if (meaningAssess.hasExistentialCrisis && meaningAssess.crisisType !== 'mild') {
                        if (meaningAssess.meaningGaps.length > 0) {
                            const gap = meaningAssess.meaningGaps[0];
                            meaningBlock = buildMeaningContext(gap === 'purpose' ? 'love_connection' : gap);
                        }
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Resilience Building — Dayanıklılık
                let resilienceBlock = '';
                try {
                    const resilAssess = assessResilienceFactors(lastUserMessage);
                    if (resilAssess.vulnerableAreas.length > 0 && resilAssess.overallResilience !== 'Yüksek') {
                        if (resilAssess.vulnerableAreas[0]) {
                            resilienceBlock = buildResilienceContext(resilAssess.vulnerableAreas[0]);
                        }
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // ─── AŞAMA 4 — ÖLÇÜM & DEĞERLENDİRME ─────────────────────────
                // Standardized Assessments — PHQ-9, GAD-7, PCL-5, AUDIT
                let assessmentsBlock = '';
                try {
                    const sessionData = {
                        sessionNumber: sessionCount,
                        lastAssessmentSession: profile?.lastAssessmentSession || 0,
                        userMessage: lastUserMessage,
                    };
                    const assessTiming = detectAssessmentTiming(sessionData);
                    if (assessTiming.shouldAssess && assessTiming.assessmentType) {
                        assessmentsBlock = buildAssessmentsContext({});
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Progress Dashboard — İlerleme Gösterge Paneli
                let progressDashboardBlock = '';
                try {
                    const sessionHistory = profile?.sessionHistory || [];
                    if (sessionHistory.length >= 2) {
                        const signals = detectProgressSignals(sessionHistory, lastUserMessage);
                        if (signals.hasProgress || signals.regressionRisk || signals.stagnationRisk) {
                            progressDashboardBlock = buildProgressDashboard(sessionHistory, sessionCount);
                        }
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // ─── AŞAMA 5 — AİLE & İLİŞKİ ──────────────────────────────────
                // Family Dynamics — Aile Sistemleri
                let familyDynamicsBlock = '';
                try {
                    const familyAssess = detectFamilyDynamics(lastUserMessage);
                    if (familyAssess.hasFamilyIssue && familyAssess.primaryPattern) {
                        familyDynamicsBlock = buildFamilyDynamicsContext(familyAssess.primaryPattern);
                    } else if (familyAssess.roleName) {
                        familyDynamicsBlock = buildFamilyRoleAnalysis(familyAssess.roleName);
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Relationship Therapy — Çift Terapisi
                let relationshipTherapyBlock = '';
                try {
                    const conflictAssess = detectRelationshipConflict(lastUserMessage);
                    if (conflictAssess.hasConflict && conflictAssess.primaryHorseman) {
                        relationshipTherapyBlock = buildGottmanContext(conflictAssess.primaryHorseman);
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // ─── AŞAMA 6 — KÜLTÜR GENİŞLETME ───────────────────────────────
                // Religion & Spirituality — Din ve Maneviyat
                let religionSpiritualityBlock = '';
                try {
                    const religionAssess = detectReligionSpirituality(lastUserMessage);
                    if (religionAssess.hasReligiousConcern && religionAssess.faith) {
                        religionSpiritualityBlock = buildReligionSpiritualityContext(religionAssess.faith);
                    } else if (religionAssess.crisisType) {
                        religionSpiritualityBlock = buildSpiritualCrisisMudahale(religionAssess.crisisType);
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // LGBTQ+ Inclusion — LGBTQ+ Kapsayıcılık
                let lgbtqInclusionBlock = '';
                try {
                    const lgbtqAssess = detectLGBTQPlusContext(lastUserMessage);
                    if (lgbtqAssess.isLGBTQPlus && lgbtqAssess.identityTheme) {
                        lgbtqInclusionBlock = buildLGBTQAffirmingContext(lgbtqAssess.identityTheme);
                    } else if (lgbtqAssess.comingOutPhase) {
                        lgbtqInclusionBlock = buildComingOutGuide(lgbtqAssess.comingOutPhase);
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Immigrant Experience — Göçmen Deneyimi
                let immigrantExperienceBlock = '';
                try {
                    const immigrantAssess = detectImmigrantExperience(lastUserMessage, { migrationMonths: sessionCount * 2 });
                    if (immigrantAssess.isMigrant && immigrantAssess.cultureShockStage) {
                        immigrantExperienceBlock = buildCultureShockContext(immigrantAssess.cultureShockStage);
                    }
                    const refugeeAssess = detectRefugeeTrauma(lastUserMessage);
                    if (refugeeAssess.isRefugee && refugeeAssess.urgency === 'critical') {
                        immigrantExperienceBlock = '[KRİZ] Mülteci travması tespit edildi. Acil destek gerekli.';
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // ─── AŞAMA 7 — DAVRANIŞSAL ARAÇLAR ────────────────────────────
                // Exposure Therapy — Maruziyet Terapisi
                let exposureTherapyBlock = '';
                try {
                    const phobiaAssess = detectPhobiaAvoidance(lastUserMessage);
                    if (phobiaAssess.hasPhobia && phobiaAssess.phobiaType) {
                        exposureTherapyBlock = buildExposureHierarchy(phobiaAssess.phobiaType);
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Positive Psychology — Pozitif Psikoloji
                let positivePsychologyBlock = '';
                try {
                    const permaAssess = assessPERMA(lastUserMessage);
                    if (permaAssess.lowestDimension) {
                        positivePsychologyBlock = buildPERMAReport(permaAssess.permaScores);
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                try {
                    const suicideAssess = assessSuicideSeverity(lastUserMessage, messages || []);
                    if (suicideAssess.severityLevel >= 2) {
                        advancedCrisisBlock = buildCrisisIntervention({
                            level: suicideAssess.severityLevel,
                            hasSubstanceUse: /alkol|uyuştur|madde|ilaç|eroin|uyuş/.test(lastUserMessage),
                        });
                    }
                } catch (err) { logger.warn('Assessment block hatası', { block: err?.stack?.split('\n')[1]?.trim(), error: err?.message }); }

                // Disclaimer
                const assistantMsgCount = (messages || []).filter(m => m.role === 'assistant').length;
                const disclaimerBlock = (assistantMsgCount > 0 && assistantMsgCount % 20 === 0)
                    ? `\n\n[PERİYODİK HATIRLATMA — BU MESAJDA DOĞAL BİR ŞEKİLDE SÖYLE]: Zaman zaman hatırlatmak isterim: Ben bir yapay zekayım ve profesyonel psikolojik desteğin yerini tutamam. İhtiyaç duyduğunda bir uzmana ulaşmak her zaman değerli bir adım. Bunu sohbetin akışına uygun, liste/uyarı formatında değil, doğal bir cümle olarak söyle.`
                    : '';

                // ─── TOKEN OPTİMİZASYONU ─────────────────────────────────────
                const { prompt: optimizedPrompt, stats: promptStats } = optimizePrompt(
                    basePrompt,
                    {
                        progress:           progressContext ? '\n\n' + progressContext : '',
                        homework:           buildHomeworkContext(pendingHomework),
                        hypothesis:         buildHypothesisContext(psychProfile),
                        technique:          techniqueBlock,
                        sessionBridge:      sessionBridgeContext ? '\n\n' + sessionBridgeContext : '',
                        sessionContext:     sessionContext ? '\n\n' + sessionContext : '',
                        onboarding:         (() => { const o = buildOnboardingContext(messages, psychProfile?.session_count || 0); return o ? '\n\n' + o : ''; })(),
                        ruleEngine:         ruleEngineBlock,
                        blindSpot:          blindSpotBlock,
                        semanticMemory:     semanticMemoryBlock,
                        voice:              voiceBlock,
                        nesne:              nesneContextBlock ? '\n\n' + nesneContextBlock : '',
                        physicalHarm:       physicalHarmBlock ? '\n\n' + physicalHarmBlock : '',
                        voiceBaseline:      voiceBaselineBlock ? '\n\n' + voiceBaselineBlock : '',
                        gazeBreath:         gazeBreathBlock,
                        windowOfTolerance:  windowOfToleranceBlock ? '\n\n' + windowOfToleranceBlock : '',
                        somaticMarkers:     somaticMarkersBlock ? '\n\n' + somaticMarkersBlock : '',
                        resistance:         resistanceBlock ? '\n\n' + resistanceBlock : '',
                        transference:       transferenceBlock ? '\n\n' + transferenceBlock : '',
                        sessionContinuity:  sessionContinuityBlock ? '\n\n' + sessionContinuityBlock : '',
                        homeworkRecall:     homeworkRecallBlock ? '\n\n' + homeworkRecallBlock : '',
                        bond:               bondBlock ? '\n\n' + bondBlock : '',
                        ruptureRepair:      ruptureRepairBlock ? '\n\n' + ruptureRepairBlock : '',
                        cultural:           culturalBlock ? '\n\n' + culturalBlock : '',
                        traumaSafety:       traumaSafetyBlock ? '\n\n' + traumaSafetyBlock : '',
                        grounding:          groundingBlock ? '\n\n' + groundingBlock : '',
                        safety:             safetyBlock ? '\n\n' + safetyBlock : '',
                        ethical:            ethicalBlock ? '\n\n' + ethicalBlock : '',
                        emotionRegulation:  emotionRegulationBlock ? '\n\n' + emotionRegulationBlock : '',
                        distressTolerance:  distressToleranceBlock ? '\n\n' + distressToleranceBlock : '',
                        mindfulness:        mindfulnessBlock ? '\n\n' + mindfulnessBlock : '',
                        interpersonal:      interpersonalBlock ? '\n\n' + interpersonalBlock : '',
                        cbt:                cbtBlock ? '\n\n' + cbtBlock : '',
                        schema:             schemaBlock ? '\n\n' + schemaBlock : '',
                        somatic:            somaticBlock ? '\n\n' + somaticBlock : '',
                        ifs:                ifsBlock ? '\n\n' + ifsBlock : '',
                        turkishCultural:    turkishCulturalBlock ? '\n\n' + turkishCulturalBlock : '',
                        metacognition:      metacognitionBlock ? '\n\n' + metacognitionBlock : '',
                        executiveFunction:  executiveFunctionBlock ? '\n\n' + executiveFunctionBlock : '',
                        cognitiveFlexibility: cognitiveFlexibilityBlock ? '\n\n' + cognitiveFlexibilityBlock : '',
                        movement:           movementBlock ? '\n\n' + movementBlock : '',
                        sleep:              sleepBlock ? '\n\n' + sleepBlock : '',
                        habitTracking:      habitBlock ? '\n\n' + habitBlock : '',
                        values:             valuesBlock ? '\n\n' + valuesBlock : '',
                        meaning:            meaningBlock ? '\n\n' + meaningBlock : '',
                        resilience:         resilienceBlock ? '\n\n' + resilienceBlock : '',
                        advancedCrisis:     advancedCrisisBlock ? '\n\n' + advancedCrisisBlock : '',
                        standardizedAssessments: assessmentsBlock ? '\n\n' + assessmentsBlock : '',
                        progressDashboard:  progressDashboardBlock ? '\n\n' + progressDashboardBlock : '',
                        familyDynamics:     familyDynamicsBlock ? '\n\n' + familyDynamicsBlock : '',
                        relationshipTherapy: relationshipTherapyBlock ? '\n\n' + relationshipTherapyBlock : '',
                        religionSpirituality: religionSpiritualityBlock ? '\n\n' + religionSpiritualityBlock : '',
                        lgbtqInclusion:     lgbtqInclusionBlock ? '\n\n' + lgbtqInclusionBlock : '',
                        immigrantExperience: immigrantExperienceBlock ? '\n\n' + immigrantExperienceBlock : '',
                        exposureTherapy:    exposureTherapyBlock ? '\n\n' + exposureTherapyBlock : '',
                        positivePsychology: positivePsychologyBlock ? '\n\n' + positivePsychologyBlock : '',
                        disclaimer:         disclaimerBlock,
                    },
                    {
                        sessionCount: psychProfile?.session_count || 0,
                        tokenBudget: 2200,
                        isCrisis: crisisEval?.level === 'HIGH',
                    }
                );

                dynamicSystemPrompt = optimizedPrompt;
                console.log(`[OPTIMIZER] Phase: ${promptStats.phase} | Tokens: ~${promptStats.tokensUsed} | Dahil: [${promptStats.blocksIncluded.join(',')}] | Çıkarılan: [${promptStats.blocksDropped.join(',')}]`);
            }
        } catch (promptErr) {
            console.warn('[LYRA ENGINE] Dinamik prompt oluşturulamadı, devam ediliyor:', promptErr.message);
        }
        console.log(`[CUSTOM LLM] Kullanıcı ID: ${userId}`);

        // ─── OPTİMİZED: Tüm hafıza verisini tek query'de çek (N+1 fix) ─────────
        let userMemory = '';
        let isimInjection = '';
        let toplamSeans = 1;
        try {
            const { data: memoryRow } = await supabase
                .from('memories')
                .select('content, user_profile, pattern_memory')
                .eq('user_id', userId)
                .single();

            if (memoryRow) {
                // 1. Content (encryption)
                const raw = memoryRow.content || '';
                if (raw && String(raw).startsWith('ENC:')) {
                    try {
                        const cryptoMod = await import('crypto');
                        const ENC_KEY = process.env.ENCRYPTION_KEY ? Buffer.from(process.env.ENCRYPTION_KEY, 'hex') : null;
                        if (ENC_KEY) {
                            const [, ivHex, encHex, tagHex] = String(raw).split(':');
                            const iv = Buffer.from(ivHex, 'hex');
                            const enc = Buffer.from(encHex, 'hex');
                            const tag = Buffer.from(tagHex, 'hex');
                            const decipher = cryptoMod.default.createDecipheriv('aes-256-gcm', ENC_KEY, iv);
                            decipher.setAuthTag(tag);
                            userMemory = Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
                        } else {
                            userMemory = raw;
                        }
                    } catch { userMemory = raw; }
                } else {
                    userMemory = raw;
                }

                // 2. User profile (special names)
                const ozelIsimler = memoryRow.user_profile?.ozel_isimler || {};
                if (Object.keys(ozelIsimler).length > 0) {
                    const isimStr = Object.entries(ozelIsimler).map(([k, v]) => `${k}: ${v}`).join(', ');
                    isimInjection = `\n\n[KULLANICININ YAKIN KİŞİLERİ]: ${isimStr}. Bu isimleri sohbette doğal şekilde kullan, kişisel bağlantı kur.`;
                }

                // 3. Pattern memory (session count for onboarding)
                toplamSeans = memoryRow.pattern_memory?.toplam_seans || 1;
            }
        } catch (err) {
            logger.warn('Memory fetch (combined)', { error: err?.message });
        }

        const enrichedMessages = [...messages];

        // RAG — Bilgi Bankası Knowledge Injection
        let knowledgeInjection = '';
        try {
            const lastUserMsg = messages?.[messages.length - 1]?.content || '';
            if (lastUserMsg.length > 10) {
                const insights = await retrieveKnowledge(lastUserMsg, { limit: 3 });

                if (insights && insights.length > 0) {
                    const insightTexts = insights.map(i => {
                        const line = `- ${i.title} (${i.author}): ${i.summary}`;
                        return line;
                    }).join('\n');

                    knowledgeInjection = `\n\n## ARKA PLAN BİLGİSİ (İçselleştir, Doğrudan Söyleme)\nBu konuyla ilgili bilgi tabanında şunlar var — teknik bilgini bu kaynaklar üzerinden şekillendir, ama kaynak adı söyleme:\n${insightTexts}`;
                    console.log(`[RAG] ${insights.length} kaynak inject edildi`);
                }
            }
        } catch (e) {
            console.warn('[RAG INJECTION] Hata:', e.message);
        }

        // ─── DİNAMİK PROMPT INJECT ───────────────────────────────────────
        if (dynamicSystemPrompt) {
            const sysIdx = enrichedMessages.findIndex(m => m.role === 'system');
            if (sysIdx !== -1) {
                enrichedMessages[sysIdx] = {
                    ...enrichedMessages[sysIdx],
                    content: dynamicSystemPrompt + '\n\n' + enrichedMessages[sysIdx].content
                };
            } else {
                enrichedMessages.unshift({ role: 'system', content: dynamicSystemPrompt });
            }
            console.log(`[LYRA ENGINE] ✅ Dinamik prompt inject edildi | Mod: ${therapyEngineOutput?.mode?.name} | Profil seans: ${psychProfile?.session_count}`);
        }
        const systemIdx = enrichedMessages.findIndex(m => m.role === 'system');
        if (userMemory) {
            let fullInjection = `\n\n[BU KULLANICI HAKKINDAKİ HAFIZA]:\n${userMemory}\n\nBu bilgileri doğal şekilde kullan, asla "seni hatırlıyorum" diyerek açıkça belirtme.${isimInjection}`;

            // Knowledge bankası ekle
            if (knowledgeInjection) {
                fullInjection += knowledgeInjection;
            }

            if (systemIdx !== -1) {
                enrichedMessages[systemIdx] = { ...enrichedMessages[systemIdx], content: enrichedMessages[systemIdx].content + fullInjection };
            } else {
                enrichedMessages.unshift({ role: 'system', content: fullInjection });
            }
            console.log(`[CUSTOM LLM] 🧠 Hafıza inject edildi! userId: ${userId}${isimInjection ? ' + isimler' : ''}${knowledgeInjection ? ' + RAG' : ''}`);
        } else if (isimInjection || knowledgeInjection) {
            let combined = isimInjection + (knowledgeInjection || '');
            if (systemIdx !== -1) {
                enrichedMessages[systemIdx] = { ...enrichedMessages[systemIdx], content: enrichedMessages[systemIdx].content + combined };
            } else {
                enrichedMessages.unshift({ role: 'system', content: combined });
            }
        }

        // ── İLK SEANS ONBOARDING INJECT ─────────────────────
        // toplamSeans değişkeni combined query'den geliyor (N+1 optimization)
        if (toplamSeans === 0 || toplamSeans === 1) {
                const onboardingInject = `\n\n[İLK SEANS PROTOKOLÜ — KRİTİK]\nBu kullanıcı Lyra'yı ilk kez kullanıyor. Şu akışı TAKİP ET:\n1. SICAK KARŞILAMA: "Merhaba, buraya geldiğin için teşekkür ederim. Seninle tanışmak güzel." de.\n2. LYRA'YI TANIT: Ne yapabildiğini kısaca anlat. Yapay zeka olduğunu doğal şekilde kabul et.\n3. GİZLİLİK: "Burada söylediklerin güvende, yargılamadan dinliyorum." de.\n4. HEDEF SOR: "Sana bugün en çok ne konuda yardımcı olmamı istersin?" diye sor. Cevaba göre seansı şekillendir.\n5. BEKLENTI: Kullanıcı çok büyük beklenti içindeyse: "Birlikte çalışarak süreci hızlandırabiliriz, ama bu yolculuk senin." de.\n6. DOĞAL GEÇİŞ: Tanışma sonrası keşif moduna geç.\nYASAK: İlk seansta ödev verme, ağır teknikler kullanma, hızlıca mod geçme.\nHEDEF: Güvende hissetmesi ve bir sonraki seansa gelmek istemesi.`;
                const sysIdx2 = enrichedMessages.findIndex(m => m.role === 'system');
                if (sysIdx2 !== -1) {
                    enrichedMessages[sysIdx2] = { ...enrichedMessages[sysIdx2], content: enrichedMessages[sysIdx2].content + onboardingInject };
                } else {
                    enrichedMessages.unshift({ role: 'system', content: onboardingInject });
                }
                console.log('[CUSTOM LLM] 🌱 İlk seans onboarding inject edildi');
            }
        } catch { /* onboarding inject hatası — devam et */ }

        // userId eşleşmezse activeSessionUserId ile de dene
        const userState = userEmotions.get(userId) || userEmotions.get(activeSessionUserId);
        console.log(`[KURAL MOTORU] userState var mı: ${!!userState} | userEmotions boyutu: ${userEmotions.size} | userId: ${userId}`);
        if (userState) {
            const { son_analiz, trend, dominant_duygu, aktif_sinyal, gecmis, yogunluk_ort } = userState;
            console.log(`[KURAL MOTORU] son_analiz: ${son_analiz?.duygu} | yogunluk: ${son_analiz?.yogunluk} | guven: ${son_analiz?.guven}`);

            // Transcript verileri hepsi için gerekli
            const transcriptState = sessionTranscriptStore.get(userId);

            // Rule layers are defined in server.js — they reference many server.js-local functions
            // For now we inject a note that user state is available
            // The full rule engine (L1-L7) still lives in server.js as they depend on many closures
            // In a future refactor these can be moved to lib/ruleEngine.js
            console.log(`[KURAL MOTORU] trend:${trend} | dominant:${dominant_duygu}`);
        }

        // Hibrit model seçimi — kritik anlarda gpt-4o, rutin anlarda gpt-4o-mini
        const selectModel = () => {
            // Kriz — her zaman en iyi model
            if (crisisEval?.level === 'HIGH') return 'gpt-4o';
            // İlk 3 seans + yüksek yoğunluk — güven inşasının temeli
            const sessionCount = psychProfile?.session_count || 0;
            const intensity = therapyEngineOutput?.emotionIntensity || null;
            if (sessionCount <= 3 && intensity === 'yüksek') return 'gpt-4o';
            // Ağır duygusal sinyal — PRESENCE veya VALIDATE
            const signal = typeof conversationSignal !== 'undefined' ? conversationSignal : null;
            if (signal === 'PRESENCE' || signal === 'VALIDATE') return 'gpt-4o';
            // Diğer her şey
            return 'gpt-4o-mini';
        };
        const selectedModel = model || selectModel();
        console.log(`[MODEL] ${selectedModel} | sinyal: ${typeof conversationSignal !== 'undefined' ? conversationSignal : 'n/a'} | kriz: ${crisisEval?.level || 'yok'}`);

        const response = await openai.chat.completions.create({
            model: selectedModel,
            messages: enrichedMessages,
            stream: true,
            temperature: temperature || 0.7,
            max_tokens: max_tokens || 500,
        });

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        let fullResponseContent = '';
        const allChunks = [];
        for await (const chunk of response) {
            allChunks.push(chunk);
            const delta = chunk.choices?.[0]?.delta?.content || '';
            fullResponseContent += delta;
        }

        // [DUYGU:X] tag'ini baştaki konumundan soy (Vapi okumasın)
        const cleanedContent = fullResponseContent.replace(/^\s*\[DUYGU:[^\]]+\]\s*/i, '');

        // Kullanıcı dili Türkçe değilse cevabı çevir
        let finalContent = cleanedContent;
        if (userLang && userLang !== 'tr' && cleanedContent) {
            try {
                finalContent = await translateResponse(cleanedContent, userLang);
                console.log(`[LANG] Cevap ${userLang} diline çevrildi`);
            } catch (trErr) {
                console.warn('[LANG] Cevap çevirisi başarısız:', trErr.message);
                finalContent = cleanedContent;
            }
        }

        if (finalContent) {
            const firstChunk = allChunks[0] || {};
            const contentChunk = {
                ...firstChunk,
                choices: [{ index: 0, delta: { role: 'assistant', content: finalContent }, finish_reason: null }],
            };
            const finishChunk = {
                ...firstChunk,
                choices: [{ index: 0, delta: {}, finish_reason: 'stop' }],
            };
            res.write(`data: ${JSON.stringify(contentChunk)}\n\n`);
            res.write(`data: ${JSON.stringify(finishChunk)}\n\n`);
        }
        res.write('data: [DONE]\n\n');
        res.end();
        console.log(`[CUSTOM LLM] 🧠 Cevap akıtıldı | Dil: ${userLang} | Temizlendi: ${fullResponseContent !== cleanedContent ? 'evet' : 'hayır'}`);

        // ─── ARKA PLANDA PROFİL GÜNCELLE ─────────────────────────────────
        if (userId && therapyEngineOutput) {
            const capturedMessages = [...messages];
            const capturedProfile = psychProfile;
            const capturedEngine = therapyEngineOutput;
            const capturedCrisisLevel = crisisEval?.level || null;
            setImmediate(async () => {
                try {
                    const transcript = capturedMessages.map(m => `${m.role}: ${m.content}`).join('\n');

                    // Profil güncellemesi
                    const profileUpdates = await extractProfileUpdates(transcript, capturedProfile);
                    if (profileUpdates && Object.keys(profileUpdates).length > 0) {
                        await updateProfile(userId, profileUpdates);
                    }

                    // Cevap kalitesi analizi
                    const qualityResult = analyzeResponseQuality(capturedMessages || []);
                    if (qualityResult.score !== null) {
                        console.log(`[QUALITY] Skor: ${qualityResult.score} | Sorunlar: ${qualityResult.issues.join(', ') || 'yok'}`);
                    }

                    // Konu çıkarımı
                    const extractedTopics = await extractTopicsCombined(transcript, openai);

                    // Seans analizi
                    const sessionAnalysis = await analyzeSession(transcript, capturedProfile);
                    if (sessionAnalysis) {
                        const sessionId = `${userId}_${Date.now()}`;
                        if (qualityResult.score !== null) sessionAnalysis.session_quality = qualityResult.score;
                        if (!sessionAnalysis.topics?.length && extractedTopics.length) {
                            sessionAnalysis.topics = extractedTopics;
                        } else if (extractedTopics.length) {
                            sessionAnalysis.topics = [...new Set([...(sessionAnalysis.topics || []), ...extractedTopics])].slice(0, 8);
                        }
                        await saveSessionRecord(userId, sessionId, sessionAnalysis,
                            capturedEngine.techniques?.map(t => t.id) || [],
                            capturedCrisisLevel);
                        await updateWeeklyMetrics(userId, sessionAnalysis);
                        await incrementSessionCount(userId);

                        // Teknik etkinliği güncelle
                        if ((sessionAnalysis.emotional_end_score || 0) > (sessionAnalysis.emotional_start_score || 5)) {
                            for (const technique of (capturedEngine.techniques || [])) {
                                await updateTechniqueEffectiveness(userId, technique.id, true);
                            }
                        }
                    }
                    // Terapötik hipotez motoru — her 3 seansta bir sessizce çalışır
                    await runHypothesisEngine(userId, capturedProfile);

                    // Semantik hafıza motoru — kritik anları embedding ile kaydet
                    const semSessionId = `${userId}_${Date.now()}`;
                    await runSemanticMemoryEngine(userId, semSessionId, capturedMessages);

                    // Ev ödevi motoru — seans sonu ödev üret (uygunsa)
                    if (sessionAnalysis) {
                        const fullTranscript = capturedMessages.map(m => `${m.role}: ${m.content}`).join('\n');
                        const sessionIdForHw = `${userId}_${Date.now()}`;
                        await runHomeworkEngine(
                            userId,
                            sessionIdForHw,
                            fullTranscript,
                            capturedProfile,
                            sessionAnalysis.dominant_emotion || 'belirsiz'
                        );
                    }

                    console.log(`[LYRA ENGINE] ✅ Arka plan profil güncellendi | userId: ${userId}`);
                } catch (bgErr) {
                    console.warn('[LYRA ENGINE] Arka plan güncelleme hatası:', bgErr.message);
                }
            });
        }
    } catch (error) {
        console.error("[CUSTOM LLM] ❌ Hata:", error);
        res.status(500).json({ error: error.message });
    }
});

export default router;
