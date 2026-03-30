/**
 * SessionState Entity
 * Represents the current state of a therapeutic session
 * Using State Machine pattern: DISCOVERY → DEEPENING → CLOSURE → COMPLETED
 */

export const SESSION_STATES = {
    DISCOVERY: 'discovery',
    DEEPENING: 'deepening',
    CLOSURE: 'closure',
    COMPLETED: 'completed',
    CRISIS: 'crisis'
};

export const SESSION_PHASES = {
    INITIAL_RAPPORT: 'initial_rapport',
    ISSUE_EXPLORATION: 'issue_exploration',
    HYPOTHESIS_FORMATION: 'hypothesis_formation',
    INTERVENTION_DELIVERY: 'intervention_delivery',
    INTEGRATION_CONSOLIDATION: 'integration_consolidation'
};

export class SessionState {
    constructor(sessionId, userId) {
        this.sessionId = sessionId;
        this.userId = userId;
        this.currentState = SESSION_STATES.DISCOVERY;
        this.currentPhase = SESSION_PHASES.INITIAL_RAPPORT;
        this.emotionalIntensity = 5; // 1-10 scale
        this.safetyRating = 10; // 1-10 scale (10 = safe, 1 = severe risk)
        this.therapeuticAlliance = 5; // 1-10 scale
        this.selectedModules = [];
        this.interventionsApplied = [];
        this.sessionTranscript = [];
        this.createdAt = new Date();
        this.updatedAt = new Date();
        this.metadata = {};
    }

    /**
     * Transition to next state based on therapeutic progress
     */
    transitionState(newState) {
        const validTransitions = {
            [SESSION_STATES.DISCOVERY]: [SESSION_STATES.DEEPENING, SESSION_STATES.CRISIS],
            [SESSION_STATES.DEEPENING]: [SESSION_STATES.CLOSURE, SESSION_STATES.CRISIS],
            [SESSION_STATES.CLOSURE]: [SESSION_STATES.COMPLETED],
            [SESSION_STATES.CRISIS]: [SESSION_STATES.DISCOVERY, SESSION_STATES.DEEPENING],
            [SESSION_STATES.COMPLETED]: []
        };

        if (!validTransitions[this.currentState]?.includes(newState)) {
            throw new Error(`Invalid transition from ${this.currentState} to ${newState}`);
        }

        this.currentState = newState;
        this.updatedAt = new Date();
    }

    /**
     * Update emotional intensity (detected from sentiment analysis)
     */
    updateEmotionalIntensity(intensity) {
        if (intensity < 1 || intensity > 10) throw new Error('Intensity must be 1-10');
        this.emotionalIntensity = intensity;

        // Auto-trigger crisis state if intensity critical
        if (intensity >= 8 && this.currentState !== SESSION_STATES.CRISIS) {
            this.transitionState(SESSION_STATES.CRISIS);
        }
    }

    /**
     * Update safety rating (from SafetyGuard)
     */
    updateSafetyRating(rating, reason = '') {
        if (rating < 1 || rating > 10) throw new Error('Rating must be 1-10');
        this.safetyRating = rating;
        if (reason) this.metadata.lastSafetyCheck = reason;
    }

    /**
     * Update therapeutic alliance (relationship strength)
     */
    updateTherapeuticAlliance(alliance) {
        if (alliance < 1 || alliance > 10) throw new Error('Alliance must be 1-10');
        this.therapeuticAlliance = alliance;
    }

    /**
     * Add message to transcript
     */
    addMessage(role, content, metadata = {}) {
        this.sessionTranscript.push({
            role,
            content,
            timestamp: new Date(),
            metadata
        });
    }

    /**
     * Get summary for LLM context
     */
    getSummary() {
        return {
            state: this.currentState,
            phase: this.currentPhase,
            emotionalIntensity: this.emotionalIntensity,
            safetyRating: this.safetyRating,
            therapeuticAlliance: this.therapeuticAlliance,
            selectedModules: this.selectedModules,
            lastMessages: this.sessionTranscript.slice(-5).map(m => ({
                role: m.role,
                content: m.content
            }))
        };
    }
}

export default SessionState;
