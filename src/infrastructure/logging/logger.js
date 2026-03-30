/**
 * Logger
 * Structured logging for debugging and monitoring
 */

import config from '../config/config.js';

const LOG_LEVELS = {
    error: 0,
    warn: 1,
    info: 2,
    debug: 3
};

class Logger {
    constructor() {
        this.level = LOG_LEVELS[config.LOG_LEVEL] || LOG_LEVELS.info;
    }

    log(level, message, data = {}) {
        if (LOG_LEVELS[level] > this.level) {
            return;
        }

        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level: level.toUpperCase(),
            message,
            ...data
        };

        const output = JSON.stringify(logEntry);

        if (level === 'error') {
            console.error(output);
        } else if (level === 'warn') {
            console.warn(output);
        } else {
            console.log(output);
        }
    }

    error(message, data) {
        this.log('error', message, data);
    }

    warn(message, data) {
        this.log('warn', message, data);
    }

    info(message, data) {
        this.log('info', message, data);
    }

    debug(message, data) {
        this.log('debug', message, data);
    }
}

export const logger = new Logger();

export default Logger;
