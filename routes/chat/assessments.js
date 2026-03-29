// routes/chat/assessments.js
// 48 assessment block'ını single function'a çekmek
// Her block try/catch ile wrapped, graceful degradation

import { logger } from '../../lib/logger.js';
import { supabase } from '../../lib/supabase.js';
import { userEmotions, sessionTranscriptStore, activeSessionUserId, activeSessionId } from '../../src/services/cache/redisService.js';

// Import all assessment modules
import { runRuleEngine } from '../../therapy/ruleEngine.js';
import { detectTopicBlindSpots, detectPatternBlindSpots, buildBlindSpotContext } from '../../therapy/blindSpotDetector.js';
import { recallSimilarMoments, buildSemanticMemoryContext } from '../../therapy/semanticMemory.js';
import { buildVoiceContext } from '../../therapy/voiceAnalyzer.js';
import { buildObjectContext } from '../../lib/objectTracker.js';
import { buildPhysicalHarmContext } from '../../lib/physicalHarmTracker.js';
import { buildVoiceBaselineContext } from '../../lib/voiceBaselineEngine.js';
import { buildWindowOfToleranceContext } from '../../lib/windowOfTolerance.js';
import { buildSomaticMarkerContext } from '../../lib/somaticMarkers.js';
import { buildResistanceContext } from '../../lib/resistancePatterns.js';
import { buildTransferenceContext } from '../../lib/transferenceEngine.js';
import { buildSessionContinuityContext } from '../../lib/sessionContinuity.js';
import { buildHomeworkRecallContext } from '../../lib/homeworkRecall.js';
import { assessBondQuality, buildBondStrengtheningContext } from '../../lib/therapeuticBond.js';
import { detectRupture, hypothesizeRuptureSource, buildRepairContext } from '../../lib/ruptureRepair.js';
import { assessCulturalProfile, buildCulturalSensitivityContext } from '../../lib/culturalSensitivity.js';
import { detectTrigger, assessTraumaRetraumatizationRisk } from '../../lib/traumaInformed.js';
import { assessSelfHarmRisk, detectPsychologicalCrisis } from '../../lib/safetyMonitoring.js';
import { checkScopeViolation } from '../../lib/ethicalBoundaries.js';
import { assessEmotionalRegulationNeed, buildEmotionRegulationContext } from '../../lib/dbtEmotionRegulation.js';
import { recommendUrgentDistressTechnique, buildDistressToleranceContext } from '../../lib/dbtDistressTolerance.js';
import { recommendMindfulnessExercise, buildMindfulnessContext } from '../../lib/dbtMindfulness.js';
import { assessInterpersonalNeed, buildInterpersonalEffectivenessContext } from '../../lib/dbtInterpersonal.js';
import { assessCognitiveDistortion, buildCBTContext } from '../../lib/cbtCognitiveBehavioral.js';
import { detectActiveSchemas, buildSchemaContext } from '../../lib/schemaTherapy.js';
import { detectFreezeState, buildSomaticGroundingContext, detectTraumaTriggers } from '../../lib/somaticExperiencing.js';
import { identifyActiveParts, buildIFSContext } from '../../lib/internalFamilySystems.js';
import { assessCulturalContext, buildTurkishSafetyContext } from '../../lib/turkishCulturalModule.js';
import { assessSuicideSeverity, detectSelfHarmEscalation, buildCrisisIntervention } from '../../lib/advancedCrisisProtocol.js';
import { detectMetacognitiveProcess, buildMetacognitionContext } from '../../lib/metacognition.js';
import { detectExecutiveFunction, buildExecutiveFunctionContext } from '../../lib/executiveFunction.js';
import { detectCognitiveRigidity, buildCognitiveFlexibilityContext } from '../../lib/cognitiveFlexibility.js';
import { detectMovementNeed, buildMovementContext } from '../../lib/movementTherapy.js';
import { detectSleepIssue, buildSleepHygieneContext } from '../../lib/sleepHygiene.js';
import { detectHabitPattern, buildHabitChangeContext } from '../../lib/habitTracking.js';
import { detectValueGaps, buildValuesClarificationContext } from '../../lib/valuesClarification.js';
import { detectExistentialCrisis, buildMeaningContext } from '../../lib/meaningAndPurpose.js';
import { assessResilienceFactors, buildResilienceContext } from '../../lib/resilienceBuilding.js';
import { detectAssessmentTiming, buildAssessmentsContext } from '../../lib/standardizedAssessments.js';
import { detectProgressSignals, buildProgressDashboard } from '../../lib/progressDashboard.js';
import { detectFamilyDynamics, buildFamilyDynamicsContext } from '../../lib/familyDynamics.js';
import { detectRelationshipConflict, buildGottmanContext } from '../../lib/relationshipTherapy.js';
import { detectReligionSpirituality, buildReligionSpiritualityContext } from '../../lib/religionSpirituality.js';
import { detectLGBTQPlusContext, buildLGBTQAffirmingContext } from '../../lib/lgbtqInclusion.js';
import { detectImmigrantExperience, buildCultureShockContext } from '../../lib/immigrantExperience.js';
import { detectPhobiaAvoidance, buildExposureHierarchy } from '../../lib/exposureTherapy.js';
import { assessPERMA, buildPERMAReport } from '../../lib/positivePsychology.js';

/**
 * Tüm 48 assessment block'ını single pass'te çalıştır
 * @param {Object} context — { userId, messages, lastUserMessage, psychProfile, emotionResult, topics, crisisEval, etc }
 * @returns {Object} — { techniqueBlock, ruleEngineBlock, ... (48 blocks) }
 */
export async function buildAllAssessmentBlocks(context) {
    const {
        userId,
        messages = [],
        lastUserMessage = '',
        psychProfile = {},
        emotionResult = {},
        topics = [],
        crisisEval = {},
        selfHarmRisk = {},
        psychiCrisis = {},
        scopeCheck = {},
        conversationSignal = '',
        sessionTranscriptStore: transcriptStoreParam,
    } = context;

    // Transcript state
    const transcriptStateForVoice = transcriptStoreParam?.get(userId) || transcriptStoreParam?.get(activeSessionUserId);
    const userStateNow = userEmotions.get(userId) || userEmotions.get(activeSessionUserId);

    // Reusable var
    let recentSessions = [];
    try {
        const { data: sessionRows } = await supabase
            .from('session_records')
            .select('dominant_emotion, session_quality, breakthrough_moment, topics, created_at')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(3);
        if (sessionRows) recentSessions = sessionRows;
    } catch { /* DB error */ }

    // Build blocks object
    const blocks = {};

    // ─── TECHNIQUE BLOCK ───────────────────────────────────────
    blocks.technique = '';
    const effectivenessData = context.effectivenessData || [];
    if (effectivenessData?.length > 0) {
        const positive = effectivenessData
            .filter(t => t.used_count > 0 && (t.positive_responses / t.used_count) >= 0.6)
            .sort((a, b) => (b.positive_responses / b.used_count) - (a.positive_responses / a.used_count))
            .slice(0, 3).map(t => t.technique_id);
        const negative = effectivenessData
            .filter(t => t.used_count > 1 && (t.positive_responses / t.used_count) < 0.3)
            .slice(0, 2).map(t => t.technique_id);
        if (positive.length > 0 || negative.length > 0) {
            blocks.technique = '\n\n[TEKNİK ETKİNLİĞİ — Bu kullanıcı için öğrenilmiş bilgi]';
            if (positive.length > 0) blocks.technique += `\nİşe yarayan: ${positive.join(', ')}`;
            if (negative.length > 0) blocks.technique += `\nAz işe yarayan: ${negative.join(', ')}`;
        }
    }

    // ─── RULE ENGINE + BLIND SPOT + SEMANTIC MEMORY ───────────
    blocks.ruleEngine = '';
    blocks.blindSpot = '';
    blocks.semanticMemory = '';
    try {
        blocks.ruleEngine = runRuleEngine({
            content: lastUserMessage,
            emotionResult,
            messageLength: lastUserMessage.length,
            silenceDurationSeconds: context.call?.silenceDuration ?? null,
            messageCount: messages.filter(m => m.role === 'user').length,
            recentSessions,
            psychProfile,
        });
        blocks.blindSpot = buildBlindSpotContext(
            detectTopicBlindSpots(recentSessions),
            detectPatternBlindSpots(messages)
        );
        const similarMoments = await recallSimilarMoments(userId, lastUserMessage, 3);
        blocks.semanticMemory = buildSemanticMemoryContext(similarMoments);
    } catch (err) { logger.warn('Assessment: rule engine', { error: err?.message }); }

    // ─── VOICE + OBJECT + PHYSICAL HARM + BASELINE ──────────────
    blocks.voice = buildVoiceContext(transcriptStateForVoice, emotionResult);
    blocks.nesne = buildObjectContext(userId);

    blocks.physicalHarm = '';
    try {
        const sonAnaliz = userStateNow?.son_analiz;
        if (sonAnaliz?.fiziksel_zarar && (context.sessionId || activeSessionId)) {
            blocks.physicalHarm = await buildPhysicalHarmContext(
                userId, context.sessionId || activeSessionId,
                sonAnaliz.fiziksel_zarar, sonAnaliz.ortam
            );
        }
    } catch { /* DB error */ }

    blocks.voiceBaseline = '';
    try {
        if (transcriptStateForVoice) {
            blocks.voiceBaseline = await buildVoiceBaselineContext(userId, {
                tempo: transcriptStateForVoice.konusmaTempo || 0,
                loudness: transcriptStateForVoice.sesYogunlukOrt || 0,
                tremor: !!transcriptStateForVoice.sesTitreme,
                monotone: !!transcriptStateForVoice.sesMonotonluk,
                vokalBreak: !!transcriptStateForVoice.vokalBreak,
                isWhisper: !!transcriptStateForVoice.isWhisper,
            });
        }
    } catch (err) { logger.warn('Assessment: voice baseline', { error: err?.message }); }

    // ─── PSYCHOLOGY BLOCKS (Window, Somatic, Resistance, Transference) ──────
    blocks.windowOfTolerance = '';
    try {
        const voiceDataW = transcriptStateForVoice || {};
        const breathDataW = userStateNow?.son_analiz?.landmarks?.breath || {};
        const gazeDataW = userStateNow?.son_analiz?.stable_gaze || userStateNow?.son_analiz?.landmarks?.stable_gaze || {};
        blocks.windowOfTolerance = buildWindowOfToleranceContext(
            { tempo: voiceDataW.konusmaTempo || 0, loudness: voiceDataW.sesYogunlukOrt || 0, tremor: !!voiceDataW.sesTitreme, monotone: !!voiceDataW.sesMonotonluk },
            breathDataW,
            gazeDataW,
            { avgTempo: psychProfile?.voice_baseline?.avg_tempo || 0, avgLoudness: psychProfile?.voice_baseline?.avg_loudness || 0 }
        );
    } catch (err) { logger.warn('Assessment: window of tolerance', { error: err?.message }); }

    blocks.somaticMarkers = '';
    try {
        const voiceDataS = transcriptStateForVoice || {};
        const breathDataS = userStateNow?.son_analiz?.landmarks?.breath || {};
        const gazeDataS = userStateNow?.son_analiz?.stable_gaze || {};
        const colorDataS = userStateNow?.son_analiz?.landmarks?.face_color || {};
        blocks.somaticMarkers = buildSomaticMarkerContext({
            breathData: breathDataS,
            voiceData: { tempo: voiceDataS.konusmaTempo || 0, loudness: voiceDataS.sesYogunlukOrt || 0, tremor: !!voiceDataS.sesTitreme, monotone: !!voiceDataS.sesMonotonluk },
            gazeData: gazeDataS,
            colorData: colorDataS,
            arousalState: userStateNow?.son_analiz?.arousal_state || 'normal',
        });
    } catch (err) { logger.warn('Assessment: somatic markers', { error: err?.message }); }

    blocks.resistance = '';
    try {
        blocks.resistance = buildResistanceContext({
            text: lastUserMessage,
            voiceData: { tempo: transcriptStateForVoice?.konusmaTempo || 0, loudness: transcriptStateForVoice?.sesYogunlukOrt || 0, tremor: !!transcriptStateForVoice?.sesTitreme, monotone: !!transcriptStateForVoice?.sesMonotonluk },
            gazeData: userStateNow?.son_analiz?.stable_gaze || {},
            breathData: userStateNow?.son_analiz?.landmarks?.breath || {},
            previousTopics: recentSessions.flatMap(s => (s.topics || []).slice(0, 2)),
        });
    } catch (err) { logger.warn('Assessment: resistance', { error: err?.message }); }

    blocks.transference = '';
    try {
        blocks.transference = await buildTransferenceContext(userId, {
            text: lastUserMessage,
            voiceData: { loudness: transcriptStateForVoice?.sesYogunlukOrt || 0, tempo: transcriptStateForVoice?.konusmaTempo || 0, tremor: !!transcriptStateForVoice?.sesTitreme, monotone: !!transcriptStateForVoice?.sesMonotonluk },
            gazeData: userStateNow?.son_analiz?.stable_gaze || {},
            sessionCount: psychProfile?.session_count || 1,
        });
    } catch (err) { logger.warn('Assessment: transference', { error: err?.message }); }

    // ─── ALLIANCE & INTERSESSION ──────────────────────────────
    blocks.sessionContinuity = '';
    try {
        const daysElapsed = Math.floor((new Date() - new Date(psychProfile?.last_session_date || 0)) / (1000 * 60 * 60 * 24));
        blocks.sessionContinuity = await buildSessionContinuityContext(userId, lastUserMessage, daysElapsed);
    } catch (err) { logger.warn('Assessment: session continuity', { error: err?.message }); }

    blocks.homeworkRecall = '';
    try {
        const userMentionedHomework = /ödev|task|yapıştım|yaptım|denedim|başladım/i.test(lastUserMessage);
        blocks.homeworkRecall = await buildHomeworkRecallContext(userId, userMentionedHomework);
    } catch (err) { logger.warn('Assessment: homework recall', { error: err?.message }); }

    blocks.bond = '';
    try {
        const bondAssessment = assessBondQuality(userId, messages);
        blocks.bond = buildBondStrengtheningContext(bondAssessment);
    } catch (err) { logger.warn('Assessment: bond', { error: err?.message }); }

    blocks.ruptureRepair = '';
    try {
        const ruptureAssess = detectRupture(messages?.slice(-10) || []);
        if (ruptureAssess.hasRupture) {
            const sourceHyp = hypothesizeRuptureSource(
                messages?.[messages.length - 2]?.content || '',
                lastUserMessage,
                { psychProfile }
            );
            blocks.ruptureRepair = buildRepairContext(ruptureAssess, sourceHyp);
        }
    } catch (err) { logger.warn('Assessment: rupture repair', { error: err?.message }); }

    // ─── CULTURE & SAFETY ─────────────────────────────────────
    blocks.cultural = '';
    try {
        const culturalProfile = assessCulturalProfile(userId, messages);
        blocks.cultural = buildCulturalSensitivityContext(culturalProfile);
    } catch (err) { logger.warn('Assessment: cultural', { error: err?.message }); }

    blocks.traumaSafety = '';
    blocks.grounding = '';
    try {
        const trigger = detectTrigger(lastUserMessage, topics);
        if (trigger.hasTrigger) blocks.grounding = trigger.grounding;
        const retraumatizationRisk = assessTraumaRetraumatizationRisk(userId, messages);
        if (retraumatizationRisk.riskLevel !== 'none') {
            blocks.traumaSafety = `[TRAUMA — ${retraumatizationRisk.riskLevel.toUpperCase()}]\n${retraumatizationRisk.recommendation}`;
        }
    } catch (err) { logger.warn('Assessment: trauma safety', { error: err?.message }); }

    blocks.safety = '';
    try {
        if (selfHarmRisk.riskLevel !== 'low') blocks.safety = selfHarmRisk.immediateAction;
        if (psychiCrisis.hasCrisis) blocks.safety = psychiCrisis.intervention;
    } catch (err) { logger.warn('Assessment: safety', { error: err?.message }); }

    blocks.ethical = '';
    try {
        if (scopeCheck.isOutOfScope) {
            blocks.ethical = `[ETHICAL — OUT OF SCOPE]\n${scopeCheck.suggestion}`;
        }
    } catch (err) { logger.warn('Assessment: ethical', { error: err?.message }); }

    // ─── GAZE + BREATH ────────────────────────────────────────
    blocks.gazeBreath = '';
    const sonAnalizLM = userStateNow?.son_analiz;
    if (sonAnalizLM) {
        const parts = [];
        const gazeInfo = sonAnalizLM.stable_gaze || sonAnalizLM.landmarks?.stable_gaze;
        if (gazeInfo?.psychological === 'kacis') parts.push('[GAZE — KAÇIŞ]: Dissosiyasyon sinyali.');
        else if (gazeInfo?.psychological === 'ic_ses') parts.push('[GAZE — İÇ SES]: İç diyalog, duygularla yüzleşiyor.');
        const breathInfo = sonAnalizLM.breath || sonAnalizLM.landmarks?.breath;
        if (breathInfo?.pattern === 'rapid') parts.push(`[NEFES — HIZLI]: ${breathInfo.bpm || '?'} bpm — anksiyete/panik.`);
        else if (breathInfo?.pattern === 'holding') parts.push('[NEFES — TUTUYOR]: Derin stres/donma tepkisi.');
        else if (breathInfo?.pattern === 'shallow') parts.push('[NEFES — YÜZEYSEL]: Vücut gergin.');
        if (sonAnalizLM.renk_context) parts.push(sonAnalizLM.renk_context);
        if (parts.length > 0) blocks.gazeBreath = '\n\n' + parts.join('\n');
    }

    // ─── DBT SKILLS ────────────────────────────────────────────
    blocks.emotionRegulation = '';
    try {
        const emotionAssess = assessEmotionalRegulationNeed(lastUserMessage);
        if (emotionAssess.regulations.length > 0) {
            const technique = emotionAssess.regulations[0];
            blocks.emotionRegulation = buildEmotionRegulationContext(
                technique === 'ABC PLEASE' ? 'abc_please' : technique === 'Opposite Action' ? 'opposite_action' : 'check_the_facts'
            );
        }
    } catch (err) { logger.warn('Assessment: emotion regulation', { error: err?.message }); }

    blocks.distressTolerance = '';
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
                blocks.distressTolerance = buildDistressToleranceContext(
                    technique.technique === 'TIPP' ? 'tipp' : technique.technique.includes('DISTRACT') ? 'distract' : technique.technique.includes('Self-Soothe') ? 'self_soothe' : 'radical_acceptance'
                );
            }
        }
    } catch (err) { logger.warn('Assessment: distress tolerance', { error: err?.message }); }

    blocks.mindfulness = '';
    try {
        const stressIndicators = {
            stress_level: emotionResult?.intensity >= 7 ? 'high' : emotionResult?.intensity >= 4 ? 'moderate' : 'low',
            racing_thoughts: lastUserMessage.split(' ').length > 100,
            anxiety: emotionResult?.primary === 'korku' || emotionResult?.primary === 'endişe',
        };
        const mindfulnessRec = recommendMindfulnessExercise(stressIndicators);
        if (mindfulnessRec.exercise) {
            blocks.mindfulness = buildMindfulnessContext(
                mindfulnessRec.exercise === 'observe' ? 'observe' : mindfulnessRec.exercise === 'breathing' ? 'participate' : 'observe'
            );
        }
    } catch (err) { logger.warn('Assessment: mindfulness', { error: err?.message }); }

    blocks.interpersonal = '';
    try {
        const interpersonalAssess = assessInterpersonalNeed(lastUserMessage);
        if (interpersonalAssess.recommendation) {
            let protocol = 'give';
            if (interpersonalAssess.needsDEARMAN && !interpersonalAssess.needsGIVE) protocol = 'dear_man';
            else if (interpersonalAssess.needsGIVEFAST && !interpersonalAssess.needsDEARMAN) protocol = 'give_fast';
            else if (interpersonalAssess.needsDEARMAN && interpersonalAssess.needsGIVE) protocol = 'dear_man';
            blocks.interpersonal = buildInterpersonalEffectivenessContext(protocol);
        }
    } catch (err) { logger.warn('Assessment: interpersonal', { error: err?.message }); }

    // ─── ADVANCED MODULES ─────────────────────────────────────
    blocks.cbt = '';
    try {
        const cbtAssess = assessCognitiveDistortion(lastUserMessage);
        if (cbtAssess.hasDistortion) blocks.cbt = buildCBTContext('thought_record');
    } catch (err) { logger.warn('Assessment: cbt', { error: err?.message }); }

    blocks.schema = '';
    try {
        const schemaAssess = detectActiveSchemas(lastUserMessage);
        if (schemaAssess.primarySchema) blocks.schema = buildSchemaContext(schemaAssess.primarySchema);
    } catch (err) { logger.warn('Assessment: schema', { error: err?.message }); }

    blocks.somatic = '';
    try {
        const freezeAssess = detectFreezeState({ tempo: transcriptStateForVoice?.konusmaTempo || 0, breathing: userStateNow?.son_analiz?.landmarks?.breath || {} });
        if (freezeAssess.isFrozen) blocks.somatic = buildSomaticGroundingContext({});
        const traumaTriggers = detectTraumaTriggers(lastUserMessage);
        if (traumaTriggers.hasTraumaTriggers && !blocks.somatic) blocks.somatic = buildSomaticGroundingContext({});
    } catch (err) { logger.warn('Assessment: somatic', { error: err?.message }); }

    blocks.ifs = '';
    try {
        const ifsAssess = identifyActiveParts(lastUserMessage);
        if (ifsAssess.activeParts.length > 0) blocks.ifs = buildIFSContext(ifsAssess.primaryPart);
    } catch (err) { logger.warn('Assessment: ifs', { error: err?.message }); }

    blocks.turkishCultural = '';
    try {
        const culturalAssess = assessCulturalContext(lastUserMessage, userId);
        if (culturalAssess.culturalFactors.length > 0) {
            blocks.turkishCultural = buildTurkishSafetyContext(culturalAssess.culturalFactors[0]);
        }
    } catch (err) { logger.warn('Assessment: turkish cultural', { error: err?.message }); }

    blocks.advancedCrisis = '';
    try {
        const suicideAssess = assessSuicideSeverity(lastUserMessage);
        if (suicideAssess.severity !== 'none') {
            blocks.advancedCrisis = buildCrisisIntervention(suicideAssess.severity);
        }
    } catch (err) { logger.warn('Assessment: advanced crisis', { error: err?.message }); }

    // ─── PHASE 1-7 NEW MODULES ────────────────────────────────
    blocks.metacognition = '';
    try {
        const metacogAssess = detectMetacognitiveProcess(lastUserMessage, messages);
        if (metacogAssess.hasMetacognition) blocks.metacognition = buildMetacognitionContext(metacogAssess);
    } catch (err) { logger.warn('Assessment: metacognition', { error: err?.message }); }

    blocks.executiveFunction = '';
    try {
        const execAssess = detectExecutiveFunction(lastUserMessage);
        if (execAssess.hasExecutiveIssue) blocks.executiveFunction = buildExecutiveFunctionContext(execAssess.primaryIssue);
    } catch (err) { logger.warn('Assessment: executive function', { error: err?.message }); }

    blocks.cognitiveFlexibility = '';
    try {
        const rigidAssess = detectCognitiveRigidity(lastUserMessage);
        if (rigidAssess.hasRigidity) blocks.cognitiveFlexibility = buildCognitiveFlexibilityContext(rigidAssess.rigidityType);
    } catch (err) { logger.warn('Assessment: cognitive flexibility', { error: err?.message }); }

    blocks.movement = '';
    try {
        const moveAssess = detectMovementNeed(lastUserMessage);
        if (moveAssess.hasNeed) blocks.movement = buildMovementContext(moveAssess.primaryNeed);
    } catch (err) { logger.warn('Assessment: movement', { error: err?.message }); }

    blocks.sleep = '';
    try {
        const sleepAssess = detectSleepIssue(lastUserMessage);
        if (sleepAssess.hasSleepIssue) blocks.sleep = buildSleepHygieneContext(sleepAssess.issueType);
    } catch (err) { logger.warn('Assessment: sleep', { error: err?.message }); }

    blocks.habitTracking = '';
    try {
        const habitAssess = detectHabitPattern(lastUserMessage);
        if (habitAssess.hasHabitIssue) blocks.habitTracking = buildHabitChangeContext(habitAssess.patternType);
    } catch (err) { logger.warn('Assessment: habit tracking', { error: err?.message }); }

    blocks.values = '';
    try {
        const valueAssess = detectValueGaps(lastUserMessage);
        if (valueAssess.hasValueGap) blocks.values = buildValuesClarificationContext(valueAssess.gapType);
    } catch (err) { logger.warn('Assessment: values', { error: err?.message }); }

    blocks.meaning = '';
    try {
        const meaningAssess = detectExistentialCrisis(lastUserMessage);
        if (meaningAssess.hasCrisis) blocks.meaning = buildMeaningContext(meaningAssess.crisisType);
    } catch (err) { logger.warn('Assessment: meaning', { error: err?.message }); }

    blocks.resilience = '';
    try {
        const resAssess = assessResilienceFactors(lastUserMessage);
        if (resAssess.lowResilience) blocks.resilience = buildResilienceContext(resAssess.primaryWeakness);
    } catch (err) { logger.warn('Assessment: resilience', { error: err?.message }); }

    blocks.standardizedAssessments = '';
    try {
        const assessTiming = detectAssessmentTiming(context.sessionCount || 0);
        if (assessTiming.shouldAssess) blocks.standardizedAssessments = buildAssessmentsContext(assessTiming.assessmentType);
    } catch (err) { logger.warn('Assessment: standardized', { error: err?.message }); }

    blocks.progressDashboard = '';
    try {
        const progressSignals = detectProgressSignals(messages);
        if (progressSignals.hasSignal) blocks.progressDashboard = buildProgressDashboard(progressSignals.signalType);
    } catch (err) { logger.warn('Assessment: progress', { error: err?.message }); }

    blocks.familyDynamics = '';
    try {
        const familyAssess = detectFamilyDynamics(lastUserMessage);
        if (familyAssess.hasFamilyIssue) blocks.familyDynamics = buildFamilyDynamicsContext(familyAssess.issueType);
    } catch (err) { logger.warn('Assessment: family', { error: err?.message }); }

    blocks.relationshipTherapy = '';
    try {
        const conflictAssess = detectRelationshipConflict(lastUserMessage);
        if (conflictAssess.hasConflict) blocks.relationshipTherapy = buildGottmanContext(conflictAssess.conflictType);
    } catch (err) { logger.warn('Assessment: relationship', { error: err?.message }); }

    blocks.religionSpirituality = '';
    try {
        const religionAssess = detectReligionSpirituality(lastUserMessage);
        if (religionAssess.hasReligiousContext) blocks.religionSpirituality = buildReligionSpiritualityContext(religionAssess.context);
    } catch (err) { logger.warn('Assessment: religion', { error: err?.message }); }

    blocks.lgbtqInclusion = '';
    try {
        const lgbtqAssess = detectLGBTQPlusContext(lastUserMessage);
        if (lgbtqAssess.hasLGBTQContext) blocks.lgbtqInclusion = buildLGBTQAffirmingContext(lgbtqAssess.contextType);
    } catch (err) { logger.warn('Assessment: lgbtq', { error: err?.message }); }

    blocks.immigrantExperience = '';
    try {
        const immigrantAssess = detectImmigrantExperience(lastUserMessage);
        if (immigrantAssess.hasImmigrantContext) blocks.immigrantExperience = buildCultureShockContext(immigrantAssess.shockStage);
    } catch (err) { logger.warn('Assessment: immigrant', { error: err?.message }); }

    blocks.exposureTherapy = '';
    try {
        const phobiaAssess = detectPhobiaAvoidance(lastUserMessage);
        if (phobiaAssess.hasPhobia) blocks.exposureTherapy = buildExposureHierarchy(phobiaAssess.phobiaType);
    } catch (err) { logger.warn('Assessment: exposure', { error: err?.message }); }

    blocks.positivePsychology = '';
    try {
        const permaAssess = assessPERMA(lastUserMessage);
        if (permaAssess.hasIssue) blocks.positivePsychology = buildPERMAReport(permaAssess.issueDomain);
    } catch (err) { logger.warn('Assessment: positive psych', { error: err?.message }); }

    return blocks;
}
