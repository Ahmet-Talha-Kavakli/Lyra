/**
 * Episodic Memory Service
 *
 * "Lyra remembers"
 *
 * Stores and retrieves past therapy moments:
 * - Every meaningful exchange is embedded and stored
 * - Similar moments are connected across sessions
 * - Therapeutic themes are identified and tracked
 * - Patient's somatic "body language" is learned
 *
 * Enables insights like:
 * "Last week when you talked about your mom, you looked down and held your breath.
 *  I just noticed you did exactly the same thing when you mentioned your boss."
 */

import { logger } from '../logging/logger.js';
import { supabase } from '../../infrastructure/database/supabase.js';

export class EpisodicMemoryService {
    constructor(options = {}) {
        this.userId = options.userId;
        this.sessionId = options.sessionId;
        this.embeddingModel = options.embeddingModel || 'text-embedding-3-small';

        logger.info('[EpisodicMemory] Initialized');
    }

    /**
     * STORE A THERAPY MOMENT
     * Called after each significant exchange
     */
    async storeMemoryFragment(data) {
        try {
            const {
                transcript,
                somaticMarkers,
                congruenceAnalysis,
                temporalPatterns,
                topics = [],
                emotionalThemes = []
            } = data;

            // Generate embedding for transcript
            const embedding = await this.generateEmbedding(transcript);

            if (!embedding) {
                logger.warn('[EpisodicMemory] Could not generate embedding');
                return null;
            }

            // Store in database
            const { data: fragment, error } = await supabase
                .from('memory_fragments')
                .insert({
                    session_id: this.sessionId,
                    user_id: this.userId,
                    transcript: transcript,
                    somatic_markers: somaticMarkers,
                    congruence_analysis: congruenceAnalysis,
                    temporal_patterns: temporalPatterns,
                    transcript_embedding: embedding,
                    topics: topics,
                    emotional_themes: emotionalThemes,
                    created_at: new Date().toISOString()
                })
                .select();

            if (error) {
                logger.error('[EpisodicMemory] Failed to store fragment:', error);
                return null;
            }

            logger.info('[EpisodicMemory] Fragment stored', {
                fragmentId: fragment[0]?.id,
                transcript: transcript.substring(0, 50) + '...',
                topics: topics
            });

            return fragment[0];
        } catch (error) {
            logger.error('[EpisodicMemory] storeMemoryFragment failed:', error);
            return null;
        }
    }

    /**
     * FIND SIMILAR MOMENTS from patient's history
     * Uses vector similarity search
     */
    async findSimilarMoments(transcript, limit = 5) {
        try {
            const embedding = await this.generateEmbedding(transcript);

            if (!embedding) {
                logger.warn('[EpisodicMemory] Could not generate embedding for similarity search');
                return [];
            }

            // Vector similarity search
            const { data: similar, error } = await supabase.rpc('match_memory_fragments', {
                query_embedding: embedding,
                match_threshold: 0.7,
                match_count: limit,
                user_id_param: this.userId
            });

            if (error) {
                logger.error('[EpisodicMemory] Similarity search failed:', error);
                return [];
            }

            logger.info('[EpisodicMemory] Found similar moments:', {
                count: similar?.length || 0,
                threshold: 0.7
            });

            return similar || [];
        } catch (error) {
            logger.error('[EpisodicMemory] findSimilarMoments failed:', error);
            return [];
        }
    }

    /**
     * GET THERAPEUTIC THEMES
     * What patterns have emerged across sessions?
     */
    async getTherapeuticThemes() {
        try {
            const { data: themes, error } = await supabase
                .from('therapeutic_themes')
                .select('*')
                .eq('user_id', this.userId)
                .order('frequency', { ascending: false })
                .limit(10);

            if (error) {
                logger.error('[EpisodicMemory] Failed to get themes:', error);
                return [];
            }

            logger.debug('[EpisodicMemory] Retrieved therapeutic themes', {
                count: themes?.length || 0
            });

            return themes || [];
        } catch (error) {
            logger.error('[EpisodicMemory] getTherapeuticThemes failed:', error);
            return [];
        }
    }

    /**
     * LEARN SOMATIC SIGNATURE
     * How does THIS patient show emotions?
     */
    async learnSomaticSignature(emotion, auData, prosodyData) {
        try {
            // Check if signature exists
            const { data: existing } = await supabase
                .from('somatic_signatures')
                .select('*')
                .eq('user_id', this.userId)
                .eq('emotion_or_state', emotion)
                .single();

            if (existing) {
                // Update existing signature
                const updatedAU = {
                    ...existing.typical_action_units,
                    ...auData // Merge new observations
                };

                const { error } = await supabase
                    .from('somatic_signatures')
                    .update({
                        typical_action_units: updatedAU,
                        typical_prosody: prosodyData,
                        observation_count: existing.observation_count + 1,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);

                if (error) throw error;

                logger.debug('[EpisodicMemory] Updated somatic signature', {
                    emotion: emotion,
                    observations: existing.observation_count + 1
                });
            } else {
                // Create new signature
                const { error } = await supabase
                    .from('somatic_signatures')
                    .insert({
                        user_id: this.userId,
                        emotion_or_state: emotion,
                        typical_action_units: auData,
                        typical_prosody: prosodyData,
                        observation_count: 1,
                        created_at: new Date().toISOString()
                    });

                if (error) throw error;

                logger.debug('[EpisodicMemory] Created new somatic signature', {
                    emotion: emotion
                });
            }

            return true;
        } catch (error) {
            logger.error('[EpisodicMemory] learnSomaticSignature failed:', error);
            return false;
        }
    }

    /**
     * GET SESSION INSIGHTS
     * What was the arc of this session?
     */
    async getSessionInsights(sessionId) {
        try {
            const { data: insights, error } = await supabase
                .from('session_insights')
                .select('*')
                .eq('session_id', sessionId)
                .single();

            if (error && error.code !== 'PGRST116') { // PGRST116 = no rows found
                logger.error('[EpisodicMemory] Failed to get session insights:', error);
                return null;
            }

            return insights || null;
        } catch (error) {
            logger.error('[EpisodicMemory] getSessionInsights failed:', error);
            return null;
        }
    }

    /**
     * STORE SESSION INSIGHTS
     * Called at end of session to summarize
     */
    async storeSessionInsights(sessionId, data) {
        try {
            const {
                primaryThemes = [],
                emotionalTrajectory = [],
                breakthroughs = [],
                somaticObservations = {},
                recommendations = '',
                depthScore = 0.5
            } = data;

            const { data: insights, error } = await supabase
                .from('session_insights')
                .insert({
                    session_id: sessionId,
                    user_id: this.userId,
                    primary_themes: primaryThemes,
                    emotional_trajectory: emotionalTrajectory,
                    breakthroughs: breakthroughs,
                    somatic_observations: somaticObservations,
                    recommendations: recommendations,
                    depth_score: depthScore,
                    created_at: new Date().toISOString()
                })
                .select();

            if (error) {
                logger.error('[EpisodicMemory] Failed to store session insights:', error);
                return null;
            }

            logger.info('[EpisodicMemory] Session insights stored', {
                sessionId: sessionId,
                themes: primaryThemes.length,
                breakthroughs: breakthroughs.length,
                depthScore: depthScore
            });

            return insights[0];
        } catch (error) {
            logger.error('[EpisodicMemory] storeSessionInsights failed:', error);
            return null;
        }
    }

    /**
     * GENERATE EMBEDDING for text
     * Uses OpenAI API
     */
    async generateEmbedding(text) {
        try {
            if (!process.env.OPENAI_API_KEY) {
                logger.warn('[EpisodicMemory] OpenAI API key not configured');
                return null;
            }

            // TODO: Call OpenAI embeddings API
            // For now, return mock embedding
            const mockEmbedding = new Array(1536).fill(0.1);
            return mockEmbedding;

            // Real implementation:
            // const { OpenAI } = require('openai');
            // const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            // const response = await openai.embeddings.create({
            //     model: this.embeddingModel,
            //     input: text
            // });
            // return response.data[0].embedding;
        } catch (error) {
            logger.error('[EpisodicMemory] generateEmbedding failed:', error);
            return null;
        }
    }

    /**
     * GENERATE MEMORY INSIGHTS
     * What should the therapist know about this patient?
     */
    async generateMemoryInsights() {
        try {
            // Get top themes
            const themes = await this.getTherapeuticThemes();

            // Get somatic signatures
            const { data: signatures } = await supabase
                .from('somatic_signatures')
                .select('*')
                .eq('user_id', this.userId)
                .order('observation_count', { ascending: false })
                .limit(5);

            // Get recent breakthroughs
            const { data: recentInsights } = await supabase
                .from('session_insights')
                .select('*')
                .eq('user_id', this.userId)
                .order('created_at', { ascending: false })
                .limit(5);

            const insights = {
                primaryThemes: themes.slice(0, 3).map(t => t.theme_name),
                somaticSignatures: signatures || [],
                recentBreakthroughs: recentInsights
                    ?.flatMap(i => i.breakthroughs || [])
                    .slice(0, 5) || [],
                therapeuticProgress: this.calculateProgress(themes),
                recommendations: this.generateRecommendations(themes)
            };

            logger.debug('[EpisodicMemory] Generated memory insights', {
                themes: insights.primaryThemes.length,
                signatures: insights.somaticSignatures.length
            });

            return insights;
        } catch (error) {
            logger.error('[EpisodicMemory] generateMemoryInsights failed:', error);
            return {};
        }
    }

    /**
     * Helper: Calculate therapeutic progress
     */
    calculateProgress(themes) {
        if (themes.length === 0) return 'insufficient_data';

        // Look at intensity trends
        const improving = themes.filter(t => t.intensity_trend < -0.2).length;
        const stable = themes.filter(t => Math.abs(t.intensity_trend) <= 0.2).length;
        const worsening = themes.filter(t => t.intensity_trend > 0.2).length;

        if (improving > worsening) return 'improving';
        if (worsening > improving) return 'worsening';
        return 'stable';
    }

    /**
     * Helper: Generate recommendations
     */
    generateRecommendations(themes) {
        const recommendations = [];

        // Most frequent theme
        if (themes.length > 0) {
            recommendations.push(
                `Focus on "${themes[0].theme_name}" - your most recurring theme`
            );
        }

        // Emerging patterns
        const recent = themes.filter(t => {
            const daysSince = (Date.now() - new Date(t.last_occurrence).getTime()) / (1000 * 86400);
            return daysSince < 7; // Last week
        });

        if (recent.length > 0) {
            recommendations.push(
                `Recent themes: ${recent.map(t => t.theme_name).join(', ')}`
            );
        }

        return recommendations;
    }
}

export default EpisodicMemoryService;
