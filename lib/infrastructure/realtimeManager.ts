/**
 * Realtime Data Management for Vercel Serverless
 *
 * WebSocket is impossible on Vercel (stateless, no persistent connections)
 * Alternative: Supabase Realtime + HTTP polling on client
 *
 * How it works:
 * 1. Client subscribes to Supabase Realtime channels (wss:// connection)
 * 2. Server publishes changes to Supabase database
 * 3. Client receives updates automatically via WebSocket
 * 4. No server-side WebSocket handler needed on Vercel
 *
 * Supabase Realtime is separate from Supabase Postgres
 * It uses PostgreSQL LISTEN/NOTIFY under the hood
 */

import { supabase } from '../shared/supabase';
import { logger } from './logger';

/**
 * Publish a realtime event
 * Clients subscribed to this table will receive updates
 */
export async function publishRealtimeEvent(
  table: string,
  event: 'INSERT' | 'UPDATE' | 'DELETE',
  record: Record<string, any>,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    // Supabase Realtime is automatic for all table writes
    // No explicit publish needed - just write to database

    logger.debug('[Realtime] Event will broadcast', {
      table,
      event,
      recordId: record.id
    });

    // Optional: publish to custom channel
    // await supabase.realtime.channel(`public:${table}`).send('broadcast', {
    //   event,
    //   record,
    //   metadata
    // });
  } catch (error: any) {
    logger.error('[Realtime] Publish failed', { error: error.message });
  }
}

/**
 * Client subscription example (runs in browser)
 *
 * USAGE IN FRONTEND:
 * ```typescript
 * import { supabase } from '@supabase/supabase-js';
 *
 * // Subscribe to user_profile changes
 * const subscription = supabase
 *   .channel('public:user_profile')
 *   .on(
 *     'postgres_changes',
 *     {
 *       event: '*',
 *       schema: 'public',
 *       table: 'user_profile',
 *       filter: `user_id=eq.${userId}`
 *     },
 *     (payload) => {
 *       console.log('Profile updated:', payload.new);
 *       setUserProfile(payload.new);
 *     }
 *   )
 *   .subscribe();
 *
 * // Cleanup on unmount
 * return () => supabase.removeChannel(subscription);
 * ```
 */

export const realtimeChannels = {
  userProfile: (userId: string) => `user-profile:${userId}`,
  userSession: (userId: string, sessionId: string) => `session:${userId}:${sessionId}`,
  therapistResponse: (sessionId: string) => `therapist:${sessionId}`,
  safetyAlert: (userId: string) => `safety:${userId}`,
  moodUpdate: (userId: string) => `mood:${userId}`
};

/**
 * Server-side: Notify client of an event
 * Client will receive this via subscribed channel
 */
export async function notifyClient(
  channel: string,
  eventType: string,
  payload: Record<string, any>
): Promise<void> {
  try {
    // For table changes: just write to database (Realtime auto-broadcasts)
    // For custom events: use broadcast channel

    await supabase.realtime.channel(channel).send('broadcast', {
      event: eventType,
      payload,
      timestamp: new Date().toISOString()
    });

    logger.debug('[Realtime] Notification sent', { channel, eventType });
  } catch (error: any) {
    logger.warn('[Realtime] Notification failed', {
      channel,
      error: error.message
    });
    // Don't crash - realtime is optional
  }
}

/**
 * Broadcast to all connected clients in a channel
 * Used for updates that don't involve database writes
 */
export async function broadcastEvent(
  channelName: string,
  eventType: string,
  data: Record<string, any>
): Promise<void> {
  try {
    const channel = supabase.realtime.channel(channelName);

    await channel.send('broadcast', {
      event: eventType,
      data,
      timestamp: new Date().toISOString()
    });

    logger.debug('[Realtime] Broadcast sent', { channelName, eventType });
  } catch (error: any) {
    logger.warn('[Realtime] Broadcast failed', {
      channelName,
      error: error.message
    });
  }
}

export default {
  publishRealtimeEvent,
  notifyClient,
  broadcastEvent,
  realtimeChannels
};
