/**
 * Clinical Somatic Interpreter - Layer 4
 * Translates somatic data into therapeutic decisions
 * Evidence-based: Porges (Polyvagal), Damasio (Somatic Markers),
 * van der Kolk (Trauma), Siegel (Mindsight), Levine (Somatic Experiencing)
 */

import { logger } from '../../infrastructure/logging/logger.js';

export class ClinicalSomaticInterpreter {
    constructor() {
        this.theories = this.loadClinicalTheories();
        this.sessionNotes = [];
    }

    /**
     * Load evidence-based theoretical frameworks
     */
    loadClinicalTheories() {
        return {
            polyvagal: {
                name: 'Polyvagal Theory (Porges)',
                description: 'Vagus nerve states determine therapeutic readiness',
                states: {
                    'social_engagement': {
                        vagalBranch: 'ventral_vagal',
                        indicators: ['soft_gaze', 'smooth_voice', 'open_posture'],
                        brainRegion: 'ventromedial_prefrontal_cortex',
                        therapeuticMeaning: 'Safe, connected, capable of insight',
                        therapeuticApproach: 'Deeper exploration, gentle challenge'
                    },
                    'fight_flight': {
                        vagalBranch: 'sympathetic_dorsal',
                        indicators: ['wide_eyes', 'tense_jaw', 'rapid_breathing'],
                        brainRegion: 'amygdala_insula',
                        therapeuticMeaning: 'Threat perceived, mobilized',
                        therapeuticApproach: 'Grounding, safety, slow down'
                    },
                    'freeze': {
                        vagalBranch: 'dorsal_vagal',
                        indicators: ['blank_stare', 'monotone', 'immobile'],
                        brainRegion: 'brainstem_parabrachial',
                        therapeuticMeaning: 'Shutdown, dissociation',
                        therapeuticApproach: 'DO NOT PUSH. Gentle activation'
                    }
                }
            },
            damasio: {
                name: 'Somatic Marker Hypothesis (Damasio)',
                description: 'Body signals are the basis of emotion and decision',
                markers: {
                    'shame': {
                        bodySystems: ['facial_flush', 'decreased_heart_rate', 'eye_gaze_down'],
                        brainRegion: 'anterior_insula_ventromedial_prefrontal',
                        cognitivePattern: 'Self-focus, blame, withdrawal',
                        therapeuticOpportunity: 'Self-compassion, perspective shift'
                    },
                    'fear': {
                        bodySystems: ['pupil_dilation', 'increased_heart_rate', 'muscle_tension'],
                        brainRegion: 'amygdala_periaqueductal_gray',
                        cognitivePattern: 'Threat detection, fight-or-flight',
                        therapeuticOpportunity: 'Safety assessment, resource building'
                    }
                }
            },
            traumaTheory: {
                name: 'Trauma and Memory (van der Kolk)',
                description: 'Trauma is stored in the body, not just the mind',
                indicators: {
                    'incomplete_processing': {
                        signs: ['dissociation', 'fragmented_speech', 'emotional_numbness'],
                        meaning: 'Traumatic memory not integrated',
                        approach: 'Somatic therapy, gradual processing'
                    },
                    'hypervigilance': {
                        signs: ['startle_response', 'constant_scanning', 'anxiety'],
                        meaning: 'Still perceiving threat',
                        approach: 'Safety building, nervous system regulation'
                    }
                }
            },
            mindsight: {
                name: 'Mindsight Integration (Siegel)',
                description: 'Integration across mind-brain-relationship dimensions',
                targets: ['horizontal_integration', 'vertical_integration', 'temporal_integration']
            }
        };
    }

    /**
     * MAIN: Generate complete clinical interpretation
     */
    interpretSomaticState(fusedState) {
        const timestamp = new Date().toISOString();

        const interpretation = {
            timestamp: timestamp,
            sessionId: fusedState.sessionId,
            userId: fusedState.userId,

            // 1. AUTONOMIC NERVOUS SYSTEM STATE
            autonomicState: this.assessAutonomicState(fusedState),

            // 2. SOMATIC MARKER INTERPRETATION
            somaticMarkerInterpretation: this.interpretSomaticMarkers(fusedState.somaticMarkers),

            // 3. EMOTIONAL PROCESSING ASSESSMENT
            emotionalProcessing: this.assessEmotionalProcessing(fusedState),

            // 4. TRAUMA RESPONSE DETECTION
            traumaResponse: this.assessTraumaResponse(fusedState),

            // 5. DEFENSIVE/PROTECTIVE PATTERNS
            defensivePatterns: this.identifyDefensivePatterns(fusedState),

            // 6. CONGRUENCE ANALYSIS (words vs body)
            congruence: this.analyzeCongruence(fusedState),

            // 7. THERAPEUTIC RECOMMENDATIONS
            recommendations: this.generateRecommendations(fusedState),

            // 8. REAL-TIME THERAPIST GUIDANCE
            therapistGuidance: this.generateTherapistGuidance(fusedState),

            // 9. SESSION NOTES (for documentation)
            sessionNotes: this.generateSessionNotes(fusedState)
        };

        // Store in history
        this.sessionNotes.push(interpretation);

        return interpretation;
    }

    /**
     * 1. ASSESS AUTONOMIC NERVOUS SYSTEM STATE (Polyvagal)
     */
    assessAutonomicState(fusedState) {
        const { somaticMarkers, bodyState } = fusedState;

        let vagalState = bodyState.vagalState || 'unknown';
        let therapeuticReadiness = '';
        let actionItems = [];

        if (vagalState === 'ventral_vagal') {
            therapeuticReadiness = 'HIGH - Client is ready for processing';
            actionItems = [
                'Explore patterns and beliefs',
                'Gentle challenges to assumptions',
                'Build autonomy and agency',
                'Explore childhood origins if relevant'
            ];
        } else if (vagalState === 'sympathetic_activation') {
            therapeuticReadiness = 'LOW - Focus on stabilization';
            actionItems = [
                'SLOW DOWN - match client pace',
                'Teach grounding (5 senses technique)',
                'Progressive muscle relaxation',
                'Box breathing (4-4-4-4)',
                'Validate fear response'
            ];
        } else if (vagalState === 'dorsal_vagal_shutdown') {
            therapeuticReadiness = 'VERY LOW - Do not push';
            actionItems = [
                'Gentle activation: movement, sound, color',
                'Build relationship safety first',
                'Present-moment anchoring (temperature, sound)',
                'Avoid trauma processing',
                'Warm, consistent presence'
            ];
        }

        return {
            vagalState: vagalState,
            therapeuticReadiness: therapeuticReadiness,
            actionItems: actionItems,
            rationale: this.getAutonomicRationale(vagalState, somaticMarkers)
        };
    }

    /**
     * 2. INTERPRET SOMATIC MARKERS (Damasio)
     */
    interpretSomaticMarkers(markers) {
        const interpretation = {};

        if (markers.shame) {
            interpretation.shame = {
                score: markers.shame.score,
                meaning: 'Client feeling exposed, judged, or defective',
                bodySignals: markers.shame.physiology,
                cognitivePattern: 'Self-blame, withdrawal, hiding',
                therapeuticOpportunity: [
                    'Normalize shame response',
                    'Build self-compassion',
                    'Challenge internalized critic',
                    'Reconnect with strengths'
                ],
                avoidDoing: 'Minimize or pathologize shame'
            };
        }

        if (markers.fear) {
            interpretation.fear = {
                score: markers.fear.score,
                meaning: 'Client perceiving threat (real or imagined)',
                bodySignals: markers.fear.physiology,
                cognitivePattern: 'Danger detection, hypervigilance',
                therapeuticOpportunity: [
                    'Reality-test the threat',
                    'Activate social safety system',
                    'Build coping resources',
                    'Gradual exposure (if appropriate)'
                ],
                avoidDoing: 'Shame them for being afraid'
            };
        }

        if (markers.sadness) {
            interpretation.sadness = {
                score: markers.sadness.score,
                meaning: 'Client experiencing loss, hopelessness, or grief',
                bodySignals: markers.sadness.physiology,
                cognitivePattern: 'Withdrawal, reduced agency, fatigue',
                therapeuticOpportunity: [
                    'Validate the loss',
                    'Honor the grief process',
                    'Build meaning from loss',
                    'Reconnect with purpose'
                ],
                avoidDoing: 'Minimize loss or push toward happiness'
            };
        }

        if (markers.safety) {
            interpretation.safety = {
                score: markers.safety.score,
                meaning: 'Client feeling safe, present, connected',
                bodySignals: markers.safety.physiology,
                cognitivePattern: 'Open to exploration, receptive',
                therapeuticOpportunity: [
                    'THIS is the window for deeper work',
                    'Explore vulnerable material',
                    'Build new neural patterns',
                    'Consolidate progress'
                ],
                avoidDoing: 'Waste this opportunity; stay surface level'
            };
        }

        if (markers.dissociation) {
            interpretation.dissociation = {
                score: markers.dissociation.score,
                meaning: 'Client disconnected from body, present moment, or emotion',
                bodySignals: 'Immobility, flat affect, minimal breathing',
                cognitivePattern: 'Absent, "watching from outside", no feeling',
                therapeuticOpportunity: [
                    'Gently guide back to present',
                    'Notice what brought on dissociation',
                    'Build tolerance gradually',
                    'Create safety first'
                ],
                avoidDoing: 'PUSH for emotion; this is protective'
            };
        }

        return interpretation;
    }

    /**
     * 3. ASSESS EMOTIONAL PROCESSING
     */
    assessEmotionalProcessing(fusedState) {
        const { emotionalState, temporal } = fusedState;

        return {
            processingMode: this.identifyProcessingMode(emotionalState),
            emotionalFlow: temporal?.trend,
            stuckPoints: this.identifyStuckPoints(temporal),
            processingCapacity: this.assessProcessingCapacity(emotionalState),
            paceRecommendation: this.recommendPace(fusedState)
        };
    }

    /**
     * 4. ASSESS TRAUMA RESPONSE
     */
    assessTraumaResponse(fusedState) {
        const { somaticMarkers, modalities } = fusedState;
        const indicators = [];

        // Threat response
        if (somaticMarkers.fear?.score > 0.6) {
            indicators.push({
                type: 'threat_response',
                severity: 'high',
                note: 'Client perceiving danger (may or may not be present)',
                suggestion: 'Safety assessment, resource building'
            });
        }

        // Dissociation
        if (somaticMarkers.dissociation?.score > 0.6) {
            indicators.push({
                type: 'dissociation',
                severity: 'high',
                note: 'Protective disconnection from overwhelming experience',
                suggestion: 'Gentle reorientation, do not push'
            });
        }

        // Body constriction (holding tension)
        if (modalities.facs.symmetry.overall < 0.7) {
            indicators.push({
                type: 'body_constriction',
                severity: 'moderate',
                note: 'Physical holding, muscle armor, bracing',
                suggestion: 'Gentle movement, tension release'
            });
        }

        // Incomplete emotional expression
        if (modalities.facs.actionUnits.length < 2) {
            indicators.push({
                type: 'emotional_numbing',
                severity: 'moderate',
                note: 'Limited facial expression, emotional flattening',
                suggestion: 'Titration, gradual feeling access'
            });
        }

        return {
            detected: indicators.length > 0,
            indicators: indicators,
            overallTraumaSeverity: this.calculateTraumaSeverity(indicators),
            clinicalNote: 'Trauma response is protective. Honor it.'
        };
    }

    /**
     * 5. IDENTIFY DEFENSIVE PATTERNS
     */
    identifyDefensivePatterns(fusedState) {
        const { somaticMarkers, modalities } = fusedState;
        const patterns = [];

        // Suppression
        if (modalities.facs.actionUnits.length === 0 && modalities.prosody.intensity.dB > -15) {
            patterns.push({
                pattern: 'suppression',
                meaning: 'Hiding feelings through lack of expression',
                function: 'Protect self from vulnerability',
                therapeutic_approach: 'Gentle curiosity about the hiding'
            });
        }

        // Intellectualization
        if (modalities.prosody.prosodyPattern.pattern === 'flat') {
            patterns.push({
                pattern: 'intellectualization',
                meaning: 'Talking about feelings rather than feeling them',
                function: 'Maintain control, avoid overwhelm',
                therapeutic_approach: 'Bridge from mind to body'
            });
        }

        // Hypervigilance
        if (somaticMarkers.fear?.score > 0.7) {
            patterns.push({
                pattern: 'hypervigilance',
                meaning: 'Constant scanning for threat',
                function: 'Anticipate danger, stay ready',
                therapeutic_approach: 'Actual vs perceived threat'
            });
        }

        // Withdrawal
        if (somaticMarkers.sadness?.score > 0.7 && somaticMarkers.safety?.score < 0.3) {
            patterns.push({
                pattern: 'withdrawal',
                meaning: 'Pulling away from connection',
                function: 'Protect from further hurt',
                therapeutic_approach: 'Reach out, rebuild trust'
            });
        }

        return patterns;
    }

    /**
     * 6. ANALYZE CONGRUENCE (Words vs Body)
     */
    analyzeCongruence(fusedState) {
        const { modalities } = fusedState;

        // Compare face emotion with voice emotion
        const faceHappiness = modalities.facs.actionUnits.includes('AU12') ? 1 : 0;
        const voiceHappiness = modalities.prosody.prosodyPattern.pattern === 'rising' ? 1 : 0;

        const congruence = {
            faceVoiceMatch: Math.abs(faceHappiness - voiceHappiness) < 0.5,
            interpretation: '',
            clinicalNote: ''
        };

        if (congruence.faceVoiceMatch) {
            congruence.interpretation = 'Congruent - Client is authentic';
            congruence.clinicalNote = 'Internal consistency suggests genuine emotion';
        } else {
            congruence.interpretation = 'Incongruent - Mismatch between verbal and nonverbal';
            congruence.clinicalNote = 'Explore: What is the discrepancy about?';
        }

        return congruence;
    }

    /**
     * 7. GENERATE THERAPEUTIC RECOMMENDATIONS
     */
    generateRecommendations(fusedState) {
        const { autonomicState, somaticMarkers } = this.assessAutonomicState(fusedState);
        const recommendations = [];

        if (autonomicState === 'ventral_vagal') {
            recommendations.push(
                '✅ OPTIMAL WINDOW: Client is physiologically ready',
                '→ Explore core beliefs or patterns',
                '→ Gentle challenges to help shift perspective',
                '→ Validate progress, build confidence'
            );
        }

        if (autonomicState === 'sympathetic_activation') {
            recommendations.push(
                '⚠️ ACTIVATION STATE: Client is mobilized',
                '→ SLOW DOWN - match their pace',
                '→ Teach grounding (5-senses, body scan)',
                '→ Box breathing: 4-4-4-4 counts',
                '→ Normalize fear response'
            );
        }

        if (autonomicState === 'dorsal_vagal_shutdown') {
            recommendations.push(
                '🛑 SHUTDOWN STATE: Client is protective frozen',
                '→ DO NOT PUSH for emotions',
                '→ Gentle activation: sound, movement, temperature',
                '→ Build safety through presence and consistency',
                '→ Present-moment anchoring'
            );
        }

        return recommendations;
    }

    /**
     * 8. GENERATE REAL-TIME THERAPIST GUIDANCE
     */
    generateTherapistGuidance(fusedState) {
        const guidance = {
            immediate_action: '',
            tone_of_voice: '',
            body_language: '',
            words_to_use: [],
            words_to_avoid: [],
            next_step: ''
        };

        if (fusedState.somaticMarkers.shame?.score > 0.6) {
            guidance.immediate_action = 'Normalize and validate shame';
            guidance.tone_of_voice = 'Warm, non-judgmental, gentle';
            guidance.body_language = 'Open posture, soft eye contact, slight smile';
            guidance.words_to_use = [
                'I notice you seem to be feeling some shame',
                'That\'s so human',
                'You\'re not alone in this',
                'Let\'s be curious together'
            ];
            guidance.words_to_avoid = [
                'Don\'t be so hard on yourself',
                'You should feel better',
                'Get over it'
            ];
            guidance.next_step = 'Build self-compassion through somatic awareness';
        }

        if (fusedState.somaticMarkers.fear?.score > 0.7) {
            guidance.immediate_action = 'Activate social safety, slow pace';
            guidance.tone_of_voice = 'Calm, steady, reassuring';
            guidance.body_language = 'Still, present, grounded';
            guidance.words_to_use = [
                'You\'re safe right now, in this room',
                'Let\'s slow down',
                'I\'m here with you',
                'What would help you feel safer?'
            ];
            guidance.words_to_avoid = [
                'Don\'t be scared',
                'There\'s nothing to fear',
                'You\'re overreacting'
            ];
            guidance.next_step = 'Ground in present, build resources';
        }

        if (fusedState.somaticMarkers.dissociation?.score > 0.6) {
            guidance.immediate_action = 'Gently orient to present without forcing';
            guidance.tone_of_voice = 'Soft, simple, repetitive';
            guidance.body_language = 'Warm, open, non-threatening';
            guidance.words_to_use = [
                'You\'re here with me now',
                'Notice the chair supporting you',
                'What do you hear right now?',
                'Take your time coming back'
            ];
            guidance.words_to_avoid = [
                'Come back to me',
                'Wake up',
                'Pay attention'
            ];
            guidance.next_step = 'Build tolerance for presence gradually';
        }

        if (fusedState.somaticMarkers.safety?.score > 0.8) {
            guidance.immediate_action = 'Leverage this window for deeper work';
            guidance.tone_of_voice = 'Engaged, curious, empowering';
            guidance.body_language = 'Open, forward, present';
            guidance.words_to_use = [
                'This feels like a good moment to explore...',
                'I\'m noticing you seem more settled',
                'What are you noticing in your body?',
                'Let\'s go a little deeper'
            ];
            guidance.words_to_avoid = [
                'Stay surface level',
                'Don\'t go there',
                'That\'s too much'
            ];
            guidance.next_step = 'Explore vulnerable material, build new neural patterns';
        }

        return guidance;
    }

    /**
     * 9. GENERATE SESSION NOTES (Clinical Documentation)
     */
    generateSessionNotes(fusedState) {
        return {
            observation: this.createObservation(fusedState),
            formulation: this.createFormulation(fusedState),
            plan: this.createPlan(fusedState),
            timestamp: new Date().toISOString()
        };
    }

    // ============================================
    // HELPER METHODS
    // ============================================

    getAutonomicRationale(vagalState, markers) {
        if (vagalState === 'ventral_vagal') {
            return 'Client's vagus nerve is in "social engagement" mode. Brain is integrating. This is the optimal window for processing and change.';
        } else if (vagalState === 'sympathetic_activation') {
            return 'Client\'s body is in survival mode (fight/flight). Processing deep emotions now would be overwhelming. Stabilize first.';
        } else if (vagalState === 'dorsal_vagal_shutdown') {
            return 'Client\'s body is in protective shutdown (freeze). Pushing would deepen disconnection. Gentle activation and safety first.';
        }
        return '';
    }

    identifyProcessingMode(emotionalState) {
        if (emotionalState.suppressionScore > 0.7) {
            return 'suppressed';
        } else if (emotionalState.authenticity.isDuchenne) {
            return 'authentic';
        } else if (emotionalState.primaryScore > 0.8) {
            return 'intense';
        }
        return 'moderate';
    }

    identifyStuckPoints(temporal) {
        if (!temporal) return [];
        if (temporal.sustained?.durationSeconds > 30) {
            return [`Stuck in ${temporal.sustained.emotion} for ${temporal.sustained.durationSeconds}s`];
        }
        return [];
    }

    assessProcessingCapacity(emotionalState) {
        const intensity = emotionalState.arousal;
        if (intensity > 0.8) return 'overwhelmed';
        if (intensity > 0.5) return 'adequate';
        return 'underutilized';
    }

    recommendPace(fusedState) {
        const { bodyState } = fusedState;
        if (bodyState.vagalState === 'ventral_vagal') return 'move_forward';
        if (bodyState.vagalState === 'sympathetic_activation') return 'slow_down';
        if (bodyState.vagalState === 'dorsal_vagal_shutdown') return 'pause_and_connect';
        return 'neutral';
    }

    calculateTraumaSeverity(indicators) {
        return (indicators.length / 4) * 10; // 0-10 scale
    }

    createObservation(fusedState) {
        return `Client appears ${fusedState.emotionalState.primary}. Facial expression shows ${fusedState.modalities.facs.actionUnits.join(', ') || 'minimal movement'}. Voice is ${fusedState.modalities.prosody.voiceQuality.tension} and ${fusedState.modalities.prosody.intensity.loudnessLevel}.`;
    }

    createFormulation(fusedState) {
        const markers = Object.keys(fusedState.somaticMarkers).filter(k => fusedState.somaticMarkers[k].score > 0.5);
        return `Client may be experiencing: ${markers.join(', ')}. This aligns with their stated concerns.`;
    }

    createPlan(fusedState) {
        const recs = this.generateRecommendations(fusedState);
        return recs.join(' ');
    }
}

export const clinicalSomaticInterpreter = new ClinicalSomaticInterpreter();

export default ClinicalSomaticInterpreter;
