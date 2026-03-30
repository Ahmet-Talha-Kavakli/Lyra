/**
 * ADMIN SUPABASE CLIENT
 * For Cron Jobs, Batch Operations, and System Tasks
 *
 * ⚠️ WARNING: Service Key has ELEVATED privileges - NO RLS enforcement
 * Use ONLY for:
 * - Scheduled jobs (no user context)
 * - Batch operations (data cleanup, migrations)
 * - GDPR data deletion
 *
 * NEVER use in request handlers!
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { logger } from '../infrastructure/logger';

let adminClientInstance: SupabaseClient | null = null;

/**
 * Custom fetch with timeout for admin operations
 * - 30 second timeout (cron jobs can run longer)
 * - Abort on timeout
 */
function adminCustomFetch(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s max

  return fetch(url, {
    ...options,
    signal: controller.signal
  })
    .then(response => {
      clearTimeout(timeoutId);
      return response;
    })
    .catch(error => {
      clearTimeout(timeoutId);
      throw error;
    });
}

/**
 * Get or create admin client (singleton pattern for efficiency)
 */
export function getAdminSupabaseClient(): SupabaseClient {
  if (adminClientInstance) {
    return adminClientInstance;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    const errorMsg = 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY';
    logger.error('[AdminSupabase] Configuration error', { error: errorMsg });
    throw new Error(errorMsg);
  }

  logger.debug('[AdminSupabase] Creating admin client');

  /**
   * ✅ PRODUCTION CONFIG for Admin Operations:
   * - db: { schema: 'public' } → Explicit schema
   * - realtime: { enabled: false } → No realtime
   * - persistSession: false → Stateless
   * - autoRefreshToken: false → No token loops
   */
  adminClientInstance = createClient(supabaseUrl, supabaseServiceKey, {
    global: {
      headers: {
        'X-Client-Info': 'lyra-admin-api/v1'
      },
      fetch: adminCustomFetch // Optimized fetch with timeout
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    },
    db: {
      schema: 'public'
    },
    realtime: {
      enabled: false
    }
  });

  return adminClientInstance;
}

/**
 * Batch insert helper (for high-volume data)
 * Splits large inserts into chunks to avoid payload limits
 *
 * @param table Supabase table name
 * @param data Array of rows to insert
 * @param batchSize Rows per batch (default: 1000)
 */
export async function batchInsert<T>(
  table: string,
  data: T[],
  batchSize: number = 1000
): Promise<void> {
  const client = getAdminSupabaseClient();
  const totalBatches = Math.ceil(data.length / batchSize);

  logger.info(`[AdminSupabase] Batch insert started`, {
    table,
    totalRows: data.length,
    batchSize,
    totalBatches
  });

  for (let i = 0; i < data.length; i += batchSize) {
    const batch = data.slice(i, i + batchSize);
    const batchNumber = Math.floor(i / batchSize) + 1;

    try {
      const { error } = await client.from(table).insert(batch);
      if (error) {
        throw error;
      }
      logger.debug(`[AdminSupabase] Batch ${batchNumber}/${totalBatches} inserted`);
    } catch (error: any) {
      logger.error(`[AdminSupabase] Batch ${batchNumber}/${totalBatches} failed`, {
        error: error.message,
        table
      });
      throw error;
    }
  }

  logger.info(`[AdminSupabase] Batch insert completed`, {
    table,
    totalRows: data.length
  });
}

/**
 * Cleanup soft-deleted records (GDPR compliance)
 * Permanently deletes records marked as deleted_at
 *
 * @param table Table name
 * @param daysOld Delete records older than N days (default: 30)
 */
export async function permanentlyDeleteOldRecords(
  table: string,
  daysOld: number = 30
): Promise<number> {
  const client = getAdminSupabaseClient();
  const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000).toISOString();

  logger.info(`[AdminSupabase] Deleting old records`, {
    table,
    cutoffDate,
    daysOld
  });

  const { error, count } = await client
    .from(table)
    .delete()
    .lt('deleted_at', cutoffDate)
    .not('deleted_at', 'is', null);

  if (error) {
    logger.error(`[AdminSupabase] Delete failed`, {
      table,
      error: error.message
    });
    throw error;
  }

  logger.info(`[AdminSupabase] Deleted old records`, {
    table,
    count
  });

  return count || 0;
}

/**
 * Execute RPC (Remote Procedure Call) for complex operations
 * Use when you need server-side logic (e.g., stats calculation)
 *
 * @param functionName Postgres function name
 * @param params Function parameters
 */
export async function callRPC<T = any>(
  functionName: string,
  params?: Record<string, any>
): Promise<T> {
  const client = getAdminSupabaseClient();

  logger.debug(`[AdminSupabase] Calling RPC`, {
    functionName,
    params: params ? Object.keys(params) : undefined
  });

  const { data, error } = await client.rpc(functionName, params);

  if (error) {
    logger.error(`[AdminSupabase] RPC failed`, {
      functionName,
      error: error.message
    });
    throw error;
  }

  return data as T;
}

export default {
  getAdminSupabaseClient,
  batchInsert,
  permanentlyDeleteOldRecords,
  callRPC
};
