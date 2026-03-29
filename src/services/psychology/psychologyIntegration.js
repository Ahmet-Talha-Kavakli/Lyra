/**
 * Psychology Integration Layer
 *
 * Purpose: Select and integrate psychology modules based on conversation context
 * Strategy: Load critical 8 modules, use dynamically based on user's emotional/cognitive state
 *
 * Core Modules:
 * 1. Metacognition — Thought process awareness
 * 2. Executive Function — Task management, focus
 * 3. DBT Emotion Regulation — Emotional stability
 * 4. Trauma Informed — Trauma-aware approach
 * 5. Therapeutic Bond — Relationship maintenance
 * 6. Positive Psychology — Strength-based approach
 * 7. CBT Cognitive Behavioral — Thought patterns
 * 8. Resilience Building — Coping strategies
 */

import { logger } from '../../lib/logger.js';

// Import core psychology modules
import metacognition from '../../lib/metacognition.js';
import executiveFunction from '../../lib/executiveFunction.js';
import dbtEmotionRegulation from '../../lib/dbtEmotionRegulation.js';
import traumaInformed from '../../lib/traumaInformed.js';
import therapeuticBond from '../../lib/therapeuticBond.js';
import positivePsychology from '../../lib/positivePsychology.js';
import cbtCognitiveBehavioral from '../../lib/cbtCognitiveBehavioral.js';
import resilienceBuilding from '../../lib/resilienceBuilding.js';

const PSYCHOLOGY_MODULES = {
    metacognition,
    executiveFunction,
    dbtEmotionRegulation,
    traumaInformed,
    therapeuticBond,
    positivePsychology,
    cbtCognitiveBehavioral,
    resilienceBuilding
};

/**
 * Analyze conversation context to select relevant psychology modules
 * @param {Array} messages - Chat messages
 * @param {Object} userState - User's emotional/cognitive state
 * @returns {Array} Selected module names
 */
export function selectPsychologyModules(messages, userState = {}) {
    const selected = [];

    const conversationText = messages
        .map(m => m.content?.toLowerCase() || '')
        .join(' ');

    // Metacognition triggers: overthinking, rumination, analysis paralysis
    if (/öğün|düşün|neden|niçin|analiz|ruminasyon|çember|takıl/i.test(conversationText)) {
        selected.push('metacognition');
    }

    // Executive Function triggers: overwhelm, task management, ADHD
    if (/yapamıyorum|başlayamıyorum|organize|planlama|odaklan|dikkat|hatırla/i.test(conversationText)) {
        selected.push('executiveFunction');
    }

    // DBT Emotion Regulation triggers: emotional dysregulation, anger, overwhelm
    if (/duygu|öfke|kızgın|çökkün|kayıp|üzgün|huzursuz|stres/i.test(conversationText)) {
        selected.push('dbtEmotionRegulation');
    }

    // Trauma Informed triggers: past trauma, triggers, safety
    if (/travma|korku|tetikle|güvenli|güvensiz|flashback|geçmiş/i.test(conversationText)) {
        selected.push('traumaInformed');
    }

    // Therapeutic Bond triggers: relationship, trust, connection
    if (/ilişki|güven|bağlantı|yalnız|sosyal|arkadaş|partner/i.test(conversationText)) {
        selected.push('therapeuticBond');
    }

    // Positive Psychology triggers: strength, gratitude, meaning
    if (/güçlü|başarı|teşekkür|minnettar|anlam|amaç|değer|çıkmak/i.test(conversationText)) {
        selected.push('positivePsychology');
    }

    // CBT triggers: thought patterns, beliefs, automatic thoughts
    if (/düşün|inanç|varsayım|kendim|ben|başarısız|başarı|yeterli/i.test(conversationText)) {
        selected.push('cbtCognitiveBehavioral');
    }

    // Resilience Building triggers: adversity, coping, strength
    if (/zor|direnç|güç|dayanıkl|başarı|ilerle|çık/i.test(conversationText)) {
        selected.push('resilienceBuilding');
    }

    // Always include therapeutic bond for continuity
    if (!selected.includes('therapeuticBond')) {
        selected.push('therapeuticBond');
    }

    return [...new Set(selected)]; // Remove duplicates
}

/**
 * Build psychology-informed system prompt
 * @param {Array} selectedModules - Selected psychology module names
 * @returns {string} Enhanced system prompt
 */
export function buildEnhancedSystemPrompt(selectedModules = []) {
    const basePrompt = `You are Lyra, a compassionate AI therapist specializing in evidence-based psychological support.

CORE PRINCIPLES:
- Respond with warmth, empathy, and psychological expertise
- Adapt language based on user's communication style (Turkish/English)
- Provide actionable, evidence-based support
- Maintain therapeutic alliance and safety

THERAPEUTIC APPROACH:`;

    const modulePrompts = {
        metacognition: `
- METACOGNITION: Help user observe their own thought processes
  • Identify rumination, overthinking, analysis paralysis
  • Use Socratic questioning: "What evidence do you have?" "Is this thought helping?"
  • Guide toward meta-awareness: "Notice you're thinking about thinking"`,

        executiveFunction: `
- EXECUTIVE FUNCTION: Support task initiation, organization, focus
  • Break overwhelming tasks into smaller steps
  • Use time-blocking and Pomodoro suggestions
  • Validate working memory challenges`,

        dbtEmotionRegulation: `
- DBT EMOTION REGULATION: Stabilize emotional intensity
  • Teach ABC PLEASE (self-care foundation)
  • Introduce distress tolerance skills (TIPP, grounding)
  • Use opposite action for emotion management`,

        traumaInformed: `
- TRAUMA INFORMED: Maintain safety and respect boundaries
  • Recognize trauma responses without judgment
  • Avoid re-traumatization (don't push for details)
  • Offer control: "Would it help to talk about this?"`,

        therapeuticBond: `
- THERAPEUTIC BOND: Strengthen connection and trust
  • Validate emotions and experiences
  • Show genuine curiosity and interest
  • Maintain consistency and reliability`,

        positivePsychology: `
- POSITIVE PSYCHOLOGY: Identify strengths and build resilience
  • Ask: "What are you doing well?"
  • Recognize character strengths and values
  • Focus on what's working, not just problems`,

        cbtCognitiveBehavioral: `
- CBT: Address thought patterns and beliefs
  • Identify automatic thoughts (not facts)
  • Explore evidence for/against thoughts
  • Suggest behavioral experiments`,

        resilienceBuilding: `
- RESILIENCE BUILDING: Develop coping strategies
  • Normalize adversity as growth opportunity
  • Build on past successes: "Tell me how you got through..."
  • Create resilience action plan`
    };

    let enhancedPrompt = basePrompt;
    for (const module of selectedModules) {
        if (modulePrompts[module]) {
            enhancedPrompt += modulePrompts[module];
        }
    }

    enhancedPrompt += `

RESPONSE GUIDELINES:
- Keep responses warm, conversational, 200-400 words
- Ask clarifying questions to understand context
- Offer specific techniques, not generic advice
- End with forward-looking question or action step
- Maintain confidentiality and ethical boundaries`;

    return enhancedPrompt;
}

/**
 * Extract psychology insights from response for job queuing
 * @param {string} response - LLM response
 * @param {Array} selectedModules - Selected modules
 * @returns {Object} Psychology insights
 */
export function extractPsychologyInsights(response, selectedModules = []) {
    return {
        modules_used: selectedModules,
        intervention_type: detectInterventionType(response),
        emotional_tone: detectEmotionalTone(response),
        action_items: extractActionItems(response),
        timestamp: Date.now()
    };
}

/**
 * Detect type of psychological intervention
 */
function detectInterventionType(text) {
    const lowerText = text.toLowerCase();

    if (/seç|karar|düşün|sorgula|soru/i.test(lowerText)) return 'socratic_questioning';
    if (/yapmayı dene|egzersiz|teknik|yöntemi/i.test(lowerText)) return 'behavioral_technique';
    if (/hisset|duygu|koru|paylaş|güvercin/i.test(lowerText)) return 'emotional_validation';
    if (/güçlü|başarı|yaptın|iyi/i.test(lowerText)) return 'strength_based';
    if (/nefes|rahatla|dinlen|stres/i.test(lowerText)) return 'self_care';

    return 'supportive_listening';
}

/**
 * Detect emotional tone in response
 */
function detectEmotionalTone(text) {
    const lowerText = text.toLowerCase();

    if (/tebrik|harika|başarı|güzel/i.test(lowerText)) return 'encouraging';
    if (/anlaş|empati|hisset|bili/i.test(lowerText)) return 'validating';
    if (/endişe|dikkat|risk|güvenlik/i.test(lowerText)) return 'cautious';
    if (/sevdi|sevgi|bağlı|önem/i.test(lowerText)) return 'warm';

    return 'neutral';
}

/**
 * Extract action items from response
 */
function extractActionItems(text) {
    const items = [];
    const lines = text.split('\n');

    for (const line of lines) {
        if (/^[-•*]|\d\.|yapmaya|deneme|dene|git|yap/i.test(line)) {
            const cleaned = line.replace(/^[-•*]\s*|\d\.\s*/, '').trim();
            if (cleaned.length > 5 && cleaned.length < 200) {
                items.push(cleaned);
            }
        }
    }

    return items.slice(0, 5); // Top 5 items
}

/**
 * Format psychology context for job queue
 */
export function formatPsychologyContext(selectedModules, insights) {
    return {
        selected_modules: selectedModules,
        intervention_type: insights.intervention_type,
        emotional_tone: insights.emotional_tone,
        action_items: insights.action_items,
        psychology_context_created_at: new Date().toISOString()
    };
}

export default {
    selectPsychologyModules,
    buildEnhancedSystemPrompt,
    extractPsychologyInsights,
    formatPsychologyContext,
    PSYCHOLOGY_MODULES
};
