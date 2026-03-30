/**
 * Profile Synthesis Job - Intake Session'dan Comprehensive Profile Oluştur
 *
 * İşlem:
 * 1. 20 dakikalık intake transkriptini al
 * 2. GPT-4o-mini ile analiz et → Comprehensive Patient Profile (JSON)
 * 3. Supabase user_profile tablosuna kaydet
 * 4. 2. seans başladığında TherapistAgent bu profili okuyor
 *
 * Sonuç: Agent hastayı 10 yıl tanıyormuş gibi davranabilir 🧠
 */

import { openai } from '../../lib/shared/openai.js';
import { supabase } from '../../lib/shared/supabase.js';
import { logger } from '../../src/application/logging/logger.js';

/**
 * Main: Generate comprehensive patient profile from intake transcript
 */
export async function generateComprehensiveProfile(userId, sessionId, intakeSummary) {
    try {
        const { transcript, exploredPillars, messageCount } = intakeSummary;

        logger.info('[PROFILE_SYNTHESIS] Starting profile generation', {
            userId,
            sessionId,
            messageCount,
            pillars: exploredPillars
        });

        // ── STEP 1: Call GPT-4o-mini to analyze intake transcript ──
        const analysisPrompt = buildProfileAnalysisPrompt(transcript, exploredPillars);

        const gptResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [{
                role: 'user',
                content: analysisPrompt
            }],
            temperature: 0.7,
            max_tokens: 2000,
            response_format: { type: 'json_object' }
        });

        // ── STEP 2: Parse the JSON profile ──
        let profileJson;
        try {
            const rawResponse = gptResponse.choices[0].message.content;
            profileJson = JSON.parse(rawResponse);
        } catch (parseErr) {
            logger.error('[PROFILE_SYNTHESIS] JSON parse failed:', parseErr);
            profileJson = buildFallbackProfile(intakeSummary);
        }

        // ── STEP 3: Save to Supabase ──
        const { error: saveError } = await supabase
            .from('user_profile')
            .update({
                comprehensive_profile: profileJson,
                profile_generated_at: new Date().toISOString(),
                intake_pillars: exploredPillars,
                intake_message_count: messageCount,
                is_first_session: false
            })
            .eq('user_id', userId);

        if (saveError) {
            logger.error('[PROFILE_SYNTHESIS] Save to Supabase failed:', saveError);
            throw saveError;
        }

        logger.info('[PROFILE_SYNTHESIS] Profile generated and saved', {
            userId,
            sessionId,
            profileKeys: Object.keys(profileJson)
        });

        return profileJson;

    } catch (error) {
        logger.error('[PROFILE_SYNTHESIS] Job failed:', error);
        throw error;
    }
}

/**
 * Build the prompt for GPT-4o-mini to analyze intake
 */
function buildProfileAnalysisPrompt(transcript, exploredPillars) {
    return `You are a clinical psychologist analyzing a patient's intake session transcript.

INTAKE SESSION TRANSCRIPT:
${transcript}

PILLARS EXPLORED:
${exploredPillars.join(', ')}

Analyze this transcript and generate a COMPREHENSIVE PATIENT PROFILE in JSON format.

The profile should include (be thorough and deeply inferential):

{
  "presenting_concern": "Primary reason they sought help (1-2 sentences)",
  "chief_complaints": ["List of main symptoms/concerns"],
  "history": {
    "onset": "When did this start?",
    "progression": "How has it evolved?",
    "family_history": "Any family patterns mentioned?",
    "trauma_or_losses": "Significant life events",
    "timeline": "Key dates/periods that shaped them"
  },
  "support_system": {
    "primary_supports": "Who do they lean on?",
    "relationship_quality": "Are supports reliable/healthy?",
    "isolation_level": "How alone do they feel? (0-10)",
    "social_integration": "How connected to community?"
  },
  "coping_mechanisms": {
    "healthy_coping": ["Things that help: music, walking, etc."],
    "unhealthy_coping": ["Things that hurt them"],
    "resilience_factors": "What keeps them alive/functioning",
    "strengths": "What they're good at despite struggle"
  },
  "somatic_baseline": {
    "primary_tension_location": "Where they hold stress (chest, shoulders, etc.)",
    "physical_symptoms": ["Headaches, tension, numbness, etc."],
    "body_awareness": "How connected to their body?",
    "trauma_responses": "Physical manifestations of triggers"
  },
  "therapeutic_goals": {
    "explicit_goals": "What they want to change",
    "implicit_goals": "What they seem to want but didn't say",
    "vision_of_wellbeing": "What does healing look like to them?",
    "therapy_hopes": "What do they hope therapy will do?"
  },
  "clinical_impressions": {
    "primary_diagnosis_hypothesis": "What this might be (depression, anxiety, trauma, etc.)",
    "secondary_factors": "Co-occurring patterns",
    "risk_factors": "Anything concerning mentioned?",
    "protective_factors": "What works against the struggle"
  },
  "therapeutic_approach": {
    "recommended_modality": "What kind of therapy fits (somatic, talk, CBT, etc.)",
    "key_interventions": ["Things to try first"],
    "pacing": "Go slow / they can handle intensity (slow/moderate/fast)",
    "attachment_style_guess": "Based on how they relate (secure/anxious/avoidant/disorganized)"
  },
  "psychoeducation_needs": [
    "What would help them understand themselves better?"
  ],
  "cultural_context": "Any cultural/spiritual factors that matter?",
  "next_session_priorities": [
    "What to focus on next"
  ]
}

Return ONLY valid JSON, no markdown.`;
}

/**
 * Fallback profile if GPT analysis fails
 * Builds from intake summary data
 */
function buildFallbackProfile(intakeSummary) {
    const { transcript, exploredPillars } = intakeSummary;

    // Simple extraction from transcript
    const sentences = transcript.split(/[.!?]+/).filter(s => s.trim());

    return {
        presenting_concern: sentences[0] || 'Patient seeking therapy',
        chief_complaints: ['Emotional distress', 'Seeking mental health support'],
        history: {
            onset: 'Timeline mentioned in session',
            progression: 'Ongoing concerns',
            family_history: 'Explored in intake',
            trauma_or_losses: exploredPillars.includes('HISTORY') ? 'See transcript' : 'Not explored',
            timeline: 'Session date: ' + new Date().toISOString()
        },
        support_system: {
            primary_supports: exploredPillars.includes('SUPPORT_SYSTEM') ? 'Explored' : 'Unknown',
            relationship_quality: 'To be assessed',
            isolation_level: 5,
            social_integration: 'Moderate'
        },
        coping_mechanisms: {
            healthy_coping: exploredPillars.includes('COPING') ? ['Mentioned in session'] : [],
            unhealthy_coping: [],
            resilience_factors: 'Seeking help is a strength',
            strengths: 'Willingness to engage in therapy'
        },
        somatic_baseline: {
            primary_tension_location: exploredPillars.includes('SOMATIC') ? 'Identified' : 'To explore',
            physical_symptoms: [],
            body_awareness: 'To develop',
            trauma_responses: 'To assess'
        },
        therapeutic_goals: {
            explicit_goals: exploredPillars.includes('GOALS') ? 'Articulated in session' : 'To determine',
            implicit_goals: 'Healing and growth',
            vision_of_wellbeing: 'A life of greater freedom',
            therapy_hopes: 'Support and understanding'
        },
        clinical_impressions: {
            primary_diagnosis_hypothesis: 'To be determined',
            secondary_factors: 'Complex presentation',
            risk_factors: 'Assess at next session',
            protective_factors: 'Motivation for change'
        },
        therapeutic_approach: {
            recommended_modality: 'Somatic + talk therapy',
            key_interventions: ['Build safety', 'Develop awareness', 'Connect to body'],
            pacing: 'slow',
            attachment_style_guess: 'To assess'
        },
        psychoeducation_needs: ['Understanding their patterns', 'Body-mind connection'],
        cultural_context: 'To explore',
        next_session_priorities: ['Continue building trust', 'Deepen one pillar', 'Begin somatic work']
    };
}

/**
 * Export queue function for BullMQ
 */
export async function processProfileSynthesisJob(job) {
    const { userId, sessionId, intakeSummary } = job.data;
    return await generateComprehensiveProfile(userId, sessionId, intakeSummary);
}

export default {
    generateComprehensiveProfile,
    processProfileSynthesisJob
};
