// lib/errorHandler.js
// Production-Grade Error Handling & Logging
// Kritik hatalar loglanır, grace-ful fallback sağlanır, user friendly mesajlar

import { supabase } from './supabase.js';

const LOG_LEVELS = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3,
  CRITICAL: 4,
};

const MIN_LOG_LEVEL = process.env.LOG_LEVEL ? LOG_LEVELS[process.env.LOG_LEVEL] : LOG_LEVELS.INFO;

/**
 * Merkez Logging Sistemi
 * @param {string} level — DEBUG | INFO | WARN | ERROR | CRITICAL
 * @param {string} module — 'chat', 'analysis', 'db', vs
 * @param {string} message — log mesajı
 * @param {Object} context — ilave bilgiler
 */
export async function logEvent(level, module, message, context = {}) {
  if (LOG_LEVELS[level] < MIN_LOG_LEVEL) return; // log seviyesi altında, görmez

  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    module,
    message,
    context,
    // Stack trace varsa al
    stack: context.error instanceof Error ? context.error.stack : null,
  };

  // Console'a log
  const consolePrefix = `[${level}] [${module}]`;
  if (level === 'ERROR' || level === 'CRITICAL') {
    console.error(consolePrefix, message, context);
  } else if (level === 'WARN') {
    console.warn(consolePrefix, message, context);
  } else {
    console.log(consolePrefix, message, context);
  }

  // DB'ye kaydet (sadece WARN+)
  if (LOG_LEVELS[level] >= LOG_LEVELS.WARN && process.env.SUPABASE_URL) {
    try {
      await supabase.from('logs').insert({
        level,
        module,
        message,
        context: JSON.stringify(context),
        created_at: timestamp,
      });
    } catch (dbErr) {
      // DB loglama başarısız, sessizce geç (tekrarlayan döngü risk)
      console.error('[LOG SYSTEM] DB loglama başarısız:', dbErr.message);
    }
  }
}

/**
 * Kritik hata — alert + fallback
 * @param {string} module
 * @param {Error} error
 * @param {Object} context
 * @returns {string} — user-friendly fallback mesaj
 */
export async function handleCriticalError(module, error, context = {}) {
  const errorId = Math.random().toString(36).substr(2, 9);

  await logEvent('CRITICAL', module, error.message, {
    error,
    errorId,
    ...context,
  });

  // Alert bir kişiye (admin)
  if (process.env.SLACK_WEBHOOK) {
    try {
      await fetch(process.env.SLACK_WEBHOOK, {
        method: 'POST',
        body: JSON.stringify({
          text: `🚨 KRITIK HATA: ${module}\nError ID: ${errorId}\n${error.message}`,
        }),
      });
    } catch (_) {
      // Slack başarısız, geç
    }
  }

  // User'a dönen fallback
  return `Bir şey yanlış gitti (Hata #${errorId}). Lütfen biraz sonra dene.`;
}

/**
 * DB hatalarını işle — retry mantığı
 * @param {Function} fn — çalıştırılacak DB fonksiyonu
 * @param {number} retries — kaç defa dene
 * @param {string} module — log modülü
 * @returns {any}
 */
export async function dbWithRetry(fn, retries = 2, module = 'db') {
  let lastError;

  for (let i = 0; i <= retries; i++) {
    try {
      const result = await fn();
      if (i > 0) {
        await logEvent('INFO', module, `DB retry başarılı (deneme ${i + 1})`);
      }
      return result;
    } catch (err) {
      lastError = err;
      const isRetryable = err.message.includes('ECONNREFUSED') || err.message.includes('timeout');

      if (i < retries && isRetryable) {
        await logEvent('WARN', module, `DB hatası, retry ${i + 1}/${retries}`, { error: err });
        await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i))); // exponential backoff
      } else {
        break;
      }
    }
  }

  await logEvent('ERROR', module, 'DB işlem başarısız (retries tükendi)', {
    error: lastError,
  });
  throw lastError;
}

/**
 * GPT API hatalarını işle
 * @param {Error} error
 * @param {string} userMessage
 * @returns {{ fallback: string, loggable: boolean }}
 */
export function handleGPTError(error, userMessage = '') {
  const message = error.message || '';

  // Rate limit
  if (message.includes('429') || message.includes('rate limit')) {
    return {
      fallback: 'İstek çok yoğun. Biraz sonra dene lütfen.',
      loggable: false, // normal, alert gereksiz
    };
  }

  // Token limit
  if (message.includes('context_length') || message.includes('token')) {
    return {
      fallback: 'Mesaj çok uzun. Kısaltıp dene lütfen.',
      loggable: true,
    };
  }

  // API key problem
  if (message.includes('401') || message.includes('invalid_api_key')) {
    return {
      fallback: 'Sistem konfigürasyon sorunu. Yöneticiye rapor et.',
      loggable: true,
    };
  }

  // Bilinmeyen GPT hatası
  return {
    fallback: 'Düşünmekte zorlanıyorum. Biraz sonra dene.',
    loggable: true,
  };
}

/**
 * Request validation — XSS, injection koruması
 * @param {string} input
 * @param {string} type — 'text' | 'email' | 'url'
 * @returns {{ valid: boolean, sanitized: string }}
 */
export function validateInput(input, type = 'text') {
  if (!input || typeof input !== 'string') {
    return { valid: false, sanitized: '' };
  }

  // XSS koruması
  const sanitized = input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();

  if (type === 'email') {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return {
      valid: emailRegex.test(sanitized),
      sanitized,
    };
  }

  if (type === 'url') {
    try {
      new URL(sanitized);
      return { valid: true, sanitized };
    } catch {
      return { valid: false, sanitized };
    }
  }

  // Maksimum length
  if (sanitized.length > 10000) {
    return {
      valid: false,
      sanitized: sanitized.substring(0, 10000),
    };
  }

  return { valid: true, sanitized };
}

/**
 * Seans hatası recovery — user deneyimi kurtarma
 * @param {string} userId
 * @param {Error} error
 * @param {Object} context
 * @returns {string}
 */
export async function recoverSessionError(userId, error, context = {}) {
  const errorId = Math.random().toString(36).substr(2, 9);

  await logEvent('ERROR', 'session', `Session error: ${error.message}`, {
    userId,
    errorId,
    ...context,
  });

  // Partial recovery — son seans kaydı geri al
  try {
    const { data: lastSession } = await supabase
      .from('session_records')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (lastSession) {
      return (
        `Biraz arızalandı, ama daha önceki konuşmamızı hatırlıyorum. ` +
        `Geçen sefer "${lastSession.closing_state}" durumunda bırakmıştık. ` +
        `Devam et mi? (Hata #${errorId})`
      );
    }
  } catch (_) {
    // Recovery başarısız
  }

  return `Bir sıkıntı oldu (Hata #${errorId}). Baştan başlayabiliriz.`;
}

/**
 * Logs tablosu oluşturma (migration)
 * Supabase SQL Editor'a çalıştır:
 */
export const LOGS_MIGRATION = `
CREATE TABLE IF NOT EXISTS public.logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    level TEXT NOT NULL,
    module TEXT NOT NULL,
    message TEXT NOT NULL,
    context JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT logs_level_check CHECK (level IN ('DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'))
);

CREATE INDEX IF NOT EXISTS idx_logs_level ON public.logs(level);
CREATE INDEX IF NOT EXISTS idx_logs_module ON public.logs(module);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON public.logs(created_at DESC);

-- Retention: 30 gün
CREATE OR REPLACE FUNCTION delete_old_logs()
RETURNS void AS $$
BEGIN
    DELETE FROM public.logs
    WHERE created_at < NOW() - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql;

-- Her gün 2am'de çalıştır (pgcron gerekli)
-- SELECT cron.schedule('delete-old-logs', '0 2 * * *', 'SELECT delete_old_logs()');
`;
