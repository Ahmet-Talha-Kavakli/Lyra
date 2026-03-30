import { createClient } from 'redis';
import { logger } from '../infrastructure/logger.js';

let redisClient = null;

export async function getRedisClient() {
    if (!redisClient) {
        redisClient = createClient({
            url: process.env.REDIS_URL || 'redis://localhost:6379'
        });
        
        redisClient.on('error', (err) => logger.error('[Redis] Connection Error', err));
        
        try {
            await redisClient.connect();
            logger.info('[Redis] Successfully connected.');
        } catch (err) {
            logger.error('[Redis] Failed to connect:', err.message);
        }
    }
    return redisClient;
}

export default { getRedisClient };
