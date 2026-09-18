/**
 * 本地开发用的简易 logger
 * 替代飞书的 @lark-apaas/client-toolkit/logger
 */
type LogArgs = unknown[];

export const logger = {
    log: (...args: LogArgs): void => {
        console.log('[LOG]', ...args);
    },
    info: (...args: LogArgs): void => {
        console.info('[INFO]', ...args);
    },
    warn: (...args: LogArgs): void => {
        console.warn('[WARN]', ...args);
    },
    error: (...args: LogArgs): void => {
        console.error('[ERROR]', ...args);
    },
    debug: (...args: LogArgs): void => {
        console.debug('[DEBUG]', ...args);
    },
};