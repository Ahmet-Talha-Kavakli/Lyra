/**
 * Semantic Intent Classifier
 * Replaces regex-based module selection with LLM-powered semantic understanding
 * Understands intent even if exact keywords aren't used
 */

import { openai } from '../../infrastructure/llm/openaiClient.js';
import { logger } from '../../infrastructure/logging/logger.js';

const THERAPY_MODULES = [
    { name: 'metacognition', keywords: ['thought process', 'overthinking', 'rumination'], description: 'Awareness of own thinking patterns' },
    { name: 'executiveFunction', keywords: ['task initiation', 'organization', 'planning'], description: 'Task management and focus' },
    { name: 'dbtEmotionRegulation', keywords: ['emotional control', 'distress', 'overwhelm'], description: 'Emotional stability techniques' },
    { name: 'traumaInformed', keywords: ['trauma', 'triggers', 'flashbacks'], description: 'Trauma-sensitive approach' },
    { name: 'therapeuticBond', keywords: ['relationship', 'trust', 'connection'], description: 'Relationship and trust building' },
    { name: 'positivePsychology', keywords: ['strength', 'gratitude', 'meaning'], description: 'Strength-based approach' },
    { name: 'cbtCognitiveBehavioral', keywords: ['thought patterns', 'beliefs', 'behaviors'], description: 'Thought and behavior modification' },
    { name: 'resilienceBuilding', keywords: ['adversity', 'coping', 'resilience'], description: 'Resilience and coping strategies' },
    { name: 'communicationSkills', keywords: ['communication', 'expressing', 'listening'], description: 'Communication and interpersonal skills' },
    { name: 'familyDynamics', keywords: ['family', 'parents', 'siblings', 'relationships'], description: 'Family system understanding' },
    { name: 'exposureTherapy', keywords: ['anxiety', 'fear', 'avoidance'], description: 'Gradual exposure to feared situations' },
    { name: 'schemaTherapy', keywords: ['patterns', 'core beliefs', 'childhood'], description: 'Deep-seated pattern work' }
];

export class IntentClassifier {
    /**
     * Classify user intent and select relevant therapy modules
     * Uses LLM for semantic understanding, falls back to keyword matching
     */
    async classifyAndSelectModules(messages, userLanguage = 'en') {
        try {
            const lastUserMessage = messages
                .reverse()
                .find(m => m.role === 'user')?.content || '';

            logger.debug('[IntentClassifier] Processing message', { language: userLanguage });

            // If message is very short, use lightweight keyword matching
            if (lastUserMessage.length < 100) {
                return this.selectModulesByKeywords(lastUserMessage);
            }

            // For longer messages, use LLM semantic classification
            return await this.selectModulesBySemantic(lastUserMessage, userLanguage);
        } catch (error) {
            logger.error('[IntentClassifier] Classification error', { error: error.message });
            // Fallback: return safe default modules
            return ['therapeuticBond', 'positivePsychology'];
        }
    }

    /**
     * Lightweight keyword-based selection (for performance)
     */
    selectModulesByKeywords(text) {
        const lowerText = text.toLowerCase();
        const selected = new Set();

        for (const module of THERAPY_MODULES) {
            for (const keyword of module.keywords) {
                if (lowerText.includes(keyword.toLowerCase())) {
                    selected.add(module.name);
                    break;
                }
            }
        }

        // Always include therapeutic bond for continuity
        selected.add('therapeuticBond');

        return Array.from(selected);
    }

    /**
     * Semantic classification using LLM embeddings + classification
     * More powerful but slower — use for complex messages
     */
    async selectModulesBySemantic(message, userLanguage = 'en') {
        const moduleDescriptions = THERAPY_MODULES
            .map(m => `- ${m.name}: ${m.description}`)
            .join('\n');

        const prompt = `You are a clinical psychology expert assistant. Analyze the user's message and select relevant therapy modules.

User message (${userLanguage}):
"${message}"

Available therapy modules:
${moduleDescriptions}

Respond with a JSON array of module names. Example: ["metacognition", "cbtCognitiveBehavioral"]
Select 1-4 most relevant modules. Always include "therapeuticBond".`;

        try {
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                max_tokens: 100
            });

            const content = response.choices[0]?.message?.content || '[]';
            const parsed = JSON.parse(content);

            // Validate selected modules exist
            const selected = parsed.filter(m =>
                THERAPY_MODULES.some(tm => tm.name === m)
            );

            // Ensure therapeutic bond is included
            if (!selected.includes('therapeuticBond')) {
                selected.push('therapeuticBond');
            }

            return selected;
        } catch (parseError) {
            logger.warn('[IntentClassifier] Semantic parse failed, using keywords', { error: parseError.message });
            return this.selectModulesByKeywords(message);
        }
    }

    /**
     * Extract emotional indicators from message
     * Returns emotional intensity (1-10) and state
     */
    analyzeEmotionalTone(message) {
        const lowerText = message.toLowerCase();

        // Crisis indicators
        if (/suicid|ölüm|hayat bitti|artık dayanamıyorum|kendime zarar|canıma kıymak/i.test(lowerText)) {
            return { intensity: 9, state: 'crisis', requiresImmediate: true };
        }

        // High distress
        if (/çok üzgün|çökkün|despair|hopeless|çaresiz|boşluk|anlamı yok/i.test(lowerText)) {
            return { intensity: 8, state: 'severe_distress', requiresImmediate: false };
        }

        // Moderate distress
        if (/üzgün|kızgın|stres|endişe|korku|panik|kaygı|huzursuz/i.test(lowerText)) {
            return { intensity: 6, state: 'moderate_distress', requiresImmediate: false };
        }

        // Mild distress
        if (/biraz üzgün|endişeli|huzursuz|rahatız|mutsuz/i.test(lowerText)) {
            return { intensity: 4, state: 'mild_distress', requiresImmediate: false };
        }

        // Neutral/Positive
        return { intensity: 3, state: 'stable', requiresImmediate: false };
    }

    /**
     * Get module prompt for given modules
     * Concise, state-specific prompts instead of mega-prompt
     */
    getModulePrompts(selectedModules, sessionState = {}) {
        const prompts = {
            metacognition: `Help user observe their thought processes without judgment. Ask: "What are you noticing about how your mind is working right now?"`,
            executiveFunction: `Break down overwhelming tasks into smaller steps. Suggest time-blocking or single-tasking.`,
            dbtEmotionRegulation: `Teach distress tolerance: TIPP skills (Temperature, Intense exercise, Paced breathing, Paired support).`,
            traumaInformed: `Recognize trauma responses. Prioritize safety and control: "Would it help to talk about this?"`,
            therapeuticBond: `Show genuine interest. Validate emotions. Build trust through consistency.`,
            positivePsychology: `Identify strengths. Ask: "What are you doing well?" Focus on what's working.`,
            cbtCognitiveBehavioral: `Challenge automatic thoughts: "What evidence do you have?" Explore thought patterns.`,
            resilienceBuilding: `Ask about past victories: "Tell me how you got through..." Build coping strategies.`,
            communicationSkills: `Model clear, empathetic communication. Teach active listening.`,
            familyDynamics: `Understand relational patterns. Explore family history and current dynamics.`,
            exposureTherapy: `Gradual exposure to feared situations. Build tolerance step by step.`,
            schemaTherapy: `Explore core patterns from childhood. Work with deep-seated beliefs.`
        };

        return selectedModules
            .map(mod => prompts[mod] || '')
            .filter(Boolean)
            .join('\n\n');
    }
}

export const intentClassifier = new IntentClassifier();

export default IntentClassifier;
