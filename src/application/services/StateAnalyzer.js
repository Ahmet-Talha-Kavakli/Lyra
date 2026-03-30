/**
 * State Analyzer Agent
 * Determines current session state and phase
 * Lightweight, runs synchronously
 */

import { SessionState, SESSION_STATES, SESSION_PHASES } from '../../domain/entities/SessionState.js';
import { logger } from '../../infrastructure/logging/logger.js';

export class StateAnalyzer {
    /**
     * Analyze message and determine/update session state
     */
    analyzeState(sessionState, newMessage, emotionalIntensity) {
        if (!sessionState) {
            sessionState = new SessionState();
        }

        // Update emotional intensity
        sessionState.updateEmotionalIntensity(emotionalIntensity);

        // Determine appropriate session phase
        const phase = this.determinePhase(sessionState, newMessage);
        sessionState.currentPhase = phase;

        // Determine if state transition needed
        const shouldTransition = this.checkStateTransition(sessionState);
        if (shouldTransition) {
            sessionState.transitionState(shouldTransition);
        }

        logger.debug('[StateAnalyzer] State updated', {
            state: sessionState.currentState,
            phase: sessionState.currentPhase,
            intensity: sessionState.emotionalIntensity
        });

        return sessionState;
    }

    /**
     * Determine the current therapeutic phase
     */
    determinePhase(sessionState, message) {
        const messageCount = sessionState.sessionTranscript?.length || 0;
        const lowerMessage = message?.toLowerCase() || '';

        // Crisis mode — immediate return to safety
        if (sessionState.currentState === SESSION_STATES.CRISIS) {
            return SESSION_PHASES.INITIAL_RAPPORT;
        }

        // Very early session
        if (messageCount < 3) {
            return SESSION_PHASES.INITIAL_RAPPORT;
        }

        // Exploration phase: user is sharing issues
        if (messageCount < 10 || /açıkla|anlat|sorun|endişe|stres/i.test(lowerMessage)) {
            return SESSION_PHASES.ISSUE_EXPLORATION;
        }

        // Hypothesis formation: patterns emerging
        if (messageCount < 20 || /neden|nasıl|sebep|örüntü|desen/i.test(lowerMessage)) {
            return SESSION_PHASES.HYPOTHESIS_FORMATION;
        }

        // Intervention delivery: applying techniques
        if (messageCount < 40 || /dene|yap|egzersiz|teknik/i.test(lowerMessage)) {
            return SESSION_PHASES.INTERVENTION_DELIVERY;
        }

        // Integration: wrapping up session
        return SESSION_PHASES.INTEGRATION_CONSOLIDATION;
    }

    /**
     * Check if session state should transition
     */
    checkStateTransition(sessionState) {
        const state = sessionState.currentState;
        const intensity = sessionState.emotionalIntensity;
        const alliance = sessionState.therapeuticAlliance;
        const messageCount = sessionState.sessionTranscript?.length || 0;

        // Crisis → Recovery
        if (state === SESSION_STATES.CRISIS && intensity <= 6 && sessionState.safetyRating >= 7) {
            return SESSION_STATES.DEEPENING;
        }

        // Discovery → Deepening
        if (state === SESSION_STATES.DISCOVERY && messageCount >= 8 && alliance >= 6) {
            return SESSION_STATES.DEEPENING;
        }

        // Deepening → Closure
        if (state === SESSION_STATES.DEEPENING && messageCount >= 25 && alliance >= 7) {
            return SESSION_STATES.CLOSURE;
        }

        // Closure → Completed
        if (state === SESSION_STATES.CLOSURE && /teşekkür|iyi|çok iyi|tamamlandı/i.test(
            sessionState.sessionTranscript?.[sessionState.sessionTranscript.length - 1]?.content || ''
        )) {
            return SESSION_STATES.COMPLETED;
        }

        return null;
    }

    /**
     * Get state-specific prompt instructions
     * Instead of mega-prompt, use targeted prompts per state
     */
    getStateSpecificPrompt(sessionState, selectedModules) {
        const basePrompt = `You are Lyra, a compassionate AI therapist. Current session state: ${sessionState.currentState}, Phase: ${sessionState.currentPhase}`;

        const statePrompts = {
            [SESSION_STATES.DISCOVERY]: `
This is early in the session. Focus on:
1. Building therapeutic alliance
2. Understanding the core issue
3. Validating emotions
4. Creating psychological safety
Ask open questions. Don't jump to solutions yet.`,

            [SESSION_STATES.DEEPENING]: `
The client is ready to go deeper. Focus on:
1. Exploring patterns and underlying beliefs
2. Connecting current issues to past experiences
3. Building awareness of automatic patterns
4. Introducing evidence-based techniques gradually
Use Socratic questioning and gentle challenges.`,

            [SESSION_STATES.CLOSURE]: `
Approaching end of session. Focus on:
1. Summarizing key insights
2. Creating actionable homework
3. Building confidence in client's ability
4. Planning next steps
5. Ending on hopeful, empowering note
Make clear what they can do between sessions.`,

            [SESSION_STATES.CRISIS]: `
Client is in crisis. Priority:
1. ENSURE IMMEDIATE SAFETY
2. De-escalate emotional intensity
3. Use coping skills (grounding, breathing)
4. Assess suicide/self-harm risk
5. Provide crisis resources
Don't explore underlying issues right now. Focus on stabilization.`,

            [SESSION_STATES.COMPLETED]: `
Session is complete. Acknowledge their progress and encourage continued work.`
        };

        let prompt = basePrompt + '\n' + (statePrompts[sessionState.currentState] || '');

        // Add module-specific guidance
        const moduleGuidance = this.getModuleGuidance(selectedModules, sessionState.currentState);
        if (moduleGuidance) {
            prompt += '\n\n## Therapeutic Approach\n' + moduleGuidance;
        }

        return prompt;
    }

    /**
     * Get concise module guidance for current state
     */
    getModuleGuidance(selectedModules, sessionState) {
        const guidance = {
            metacognition: '• Help client notice their thinking patterns',
            executiveFunction: '• Break tasks into manageable steps',
            dbtEmotionRegulation: '• Teach coping skills (TIPP, grounding)',
            traumaInformed: '• Respect boundaries, avoid re-traumatization',
            therapeuticBond: '• Validate, show genuine interest',
            positivePsychology: '• Identify strengths and what\'s working',
            cbtCognitiveBehavioral: '• Challenge unhelpful thought patterns',
            resilienceBuilding: '• Focus on coping strategies and past victories'
        };

        return selectedModules
            .map(m => guidance[m])
            .filter(Boolean)
            .join('\n');
    }
}

export const stateAnalyzer = new StateAnalyzer();

export default StateAnalyzer;
