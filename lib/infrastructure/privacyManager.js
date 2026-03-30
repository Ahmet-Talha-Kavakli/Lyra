/**
 * Privacy & GDPR/KVKK Compliance Manager
 * Handles user consent, data collection tracking, right to deletion
 */

import { supabase } from '../shared/supabase.js';
import { logger } from './logger.js';

export class PrivacyManager {
    /**
     * Record user consent for data collection
     * Required before: audio recording, video analysis, psychological profiling
     */
    async recordConsent(userId, consentType, version = '1.0') {
        try {
            const { error } = await supabase
                .from('user_consents')
                .insert({
                    user_id: userId,
                    consent_type: consentType, // 'therapy_data' | 'audio_recording' | 'video_analysis'
                    version,
                    granted_at: new Date().toISOString(),
                    ip_address: this.getClientIP(),
                    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null
                });

            if (error) throw error;

            logger.info('[Privacy] Consent recorded', {
                userId,
                consentType,
                version
            });

            return true;
        } catch (error) {
            logger.error('[Privacy] Failed to record consent', {
                userId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Check if user has given consent for specific data collection
     */
    async hasConsent(userId, consentType) {
        try {
            const { data, error } = await supabase
                .from('user_consents')
                .select('id')
                .eq('user_id', userId)
                .eq('consent_type', consentType)
                .order('granted_at', { ascending: false })
                .limit(1);

            if (error) throw error;

            return data && data.length > 0;
        } catch (error) {
            logger.error('[Privacy] Failed to check consent', {
                userId,
                error: error.message
            });
            return false;
        }
    }

    /**
     * Right to deletion (GDPR Article 17)
     * Deletes user data except legally required records
     */
    async deleteUserData(userId, reason = 'user_request') {
        try {
            // Step 1: Delete therapy sessions (sensitive data first)
            await supabase
                .from('therapy_sessions')
                .delete()
                .eq('user_id', userId);

            // Step 2: Delete psychological profiles
            await supabase
                .from('psychological_profiles')
                .delete()
                .eq('user_id', userId);

            // Step 3: Delete chat history
            await supabase
                .from('chat_messages')
                .delete()
                .eq('user_id', userId);

            // Step 4: Anonymize user account (not delete — for audit trail)
            await supabase
                .from('users')
                .update({
                    email: `deleted_${Date.now()}@example.com`,
                    is_deleted: true,
                    deleted_at: new Date().toISOString(),
                    deletion_reason: reason
                })
                .eq('id', userId);

            logger.info('[Privacy] User data deleted (Right to Deletion)', {
                userId,
                reason
            });

            return true;
        } catch (error) {
            logger.error('[Privacy] Failed to delete user data', {
                userId,
                error: error.message
            });
            throw error;
        }
    }

    /**
     * Get user's data export (GDPR Article 20)
     * Provides personal data in portable format
     */
    async exportUserData(userId) {
        try {
            const [sessions, profile, messages] = await Promise.all([
                supabase.from('therapy_sessions').select('*').eq('user_id', userId),
                supabase.from('psychological_profiles').select('*').eq('user_id', userId),
                supabase.from('chat_messages').select('*').eq('user_id', userId)
            ]);

            return {
                sessions: sessions.data || [],
                profile: profile.data || [],
                messages: messages.data || [],
                exportDate: new Date().toISOString()
            };
        } catch (error) {
            logger.error('[Privacy] Failed to export user data', {
                userId,
                error: error.message
            });
            throw error;
        }
    }

    getClientIP() {
        // Placeholder — would use req.ip or similar in middleware
        return 'unknown';
    }
}

export const privacyManager = new PrivacyManager();
