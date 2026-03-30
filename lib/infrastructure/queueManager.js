/**
 * Vercel Serverless uyumlu kuyruk sistemi
 * Bull yerine Upstash QStash kullanıyoruz
 * Lambda'dan sonra arka plan işleri çalışacak
 */

import { Client } from "@upstash/qstash";
import { logger } from "./logger.js";
import { config } from "./config.js";

if (!config.QSTASH_TOKEN) {
    throw new Error("QSTASH_TOKEN ortam değişkeni gerekli");
}

const qstash = new Client({
    token: config.QSTASH_TOKEN,
});

/**
 * Arka plan işi kuyruğa ekle
 * Vercel lambda döndükten sonra çalışacak
 */
export async function enqueueJob(jobType, data, options = {}) {
    const {
        delaySeconds = 0,
        retries = 3,
        callbackUrl = `${config.API_URL}/api/webhooks/qstash`
    } = options;

    try {
        const messageId = await qstash.publishJSON({
            topic: `lyra-jobs-${jobType}`,
            body: {
                jobType,
                data,
                timestamp: new Date().toISOString(),
                retryCount: 0
            },
            delay: delaySeconds,
            retries,
            callback: callbackUrl,
            failureCallback: `${config.API_URL}/api/webhooks/qstash/failed`
        });

        logger.info(`[Queue] Job enqueued`, {
            jobType,
            messageId,
            delaySeconds
        });

        return messageId;
    } catch (error) {
        logger.error(`[Queue] Failed to enqueue job`, {
            jobType,
            error: error.message
        });
        throw error;
    }
}

/**
 * Webhook handler — QStash iş tamamlandığında çağırır
 * API endpoint: POST /api/webhooks/qstash
 */
export async function handleQStashWebhook(req, res) {
    try {
        // QStash imzasını doğrula (optional, Vercel env kontrol)
        const signature = req.headers["upstash-signature"];
        if (!signature && config.IS_PROD) {
            return res.status(401).json({ error: "Signature missing" });
        }

        // Webhook payload
        const { jobType, data, retryCount } = req.body;

        logger.info(`[QStash Webhook] Job received`, {
            jobType,
            retryCount
        });

        // Job type'a göre router
        let result;
        switch (jobType) {
            case "process-message":
                result = await processMessageJob(data);
                break;

            case "safety-check":
                result = await safetyCheckJob(data);
                break;

            case "session-sync":
                result = await sessionSyncJob(data);
                break;

            case "export-user-data":
                result = await exportUserDataJob(data);
                break;

            default:
                logger.warn(`[QStash] Unknown job type: ${jobType}`);
                return res.status(400).json({ error: "Unknown job type" });
        }

        return res.status(200).json({ success: true, result });
    } catch (error) {
        logger.error(`[QStash Webhook] Error processing job`, {
            error: error.message
        });
        // Return 200 anyway so QStash doesn't retry infinitely
        res.status(200).json({ error: error.message, processed: false });
    }
}

/**
 * Job handlers
 */

async function processMessageJob(data) {
    const { userId, sessionId, content } = data;

    logger.info(`[Job] Processing message`, { userId, sessionId });

    // TODO: Implement actual message processing
    // - AI response generation
    // - Session persistence
    // - Analytics

    return { success: true };
}

async function safetyCheckJob(data) {
    const { userId, sessionId, messageContent } = data;

    logger.info(`[Job] Safety check`, { userId, sessionId });

    // TODO: Implement safety analysis
    // - Crisis detection
    // - Alert notifications
    // - Escalation

    return { safetyLevel: "low" };
}

async function sessionSyncJob(data) {
    const { userId, sessionId } = data;

    logger.info(`[Job] Session sync`, { userId, sessionId });

    // TODO: Sync session to persistent storage
    // - Write to database
    // - Update indices
    // - Invalidate cache

    return { synced: true };
}

async function exportUserDataJob(data) {
    const { userId, email } = data;

    logger.info(`[Job] Exporting user data (GDPR)`, { userId, email });

    // TODO: GDPR data export
    // - Gather all user data
    // - Format as JSON
    // - Send via email or S3

    return { exported: true };
}

/**
 * Job durumu kontrol et
 */
export async function getJobStatus(messageId) {
    try {
        // QStash message status API
        const response = await fetch(`https://api.upstash.com/v2/messages/${messageId}`, {
            headers: {
                Authorization: `Bearer ${config.QSTASH_TOKEN}`
            }
        });

        return await response.json();
    } catch (error) {
        logger.error(`[Queue] Failed to get job status`, { error: error.message });
        throw error;
    }
}
