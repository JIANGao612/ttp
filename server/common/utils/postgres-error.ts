export function extractPostgresErrorCode(error: unknown): string | undefined {
    let current: unknown = error;
    for (let depth = 0; depth < 4 && current && typeof current === 'object'; depth += 1) {
        const {code, cause} = current as { code?: unknown; cause?: unknown };
        if (typeof code === 'string') return code;
        current = cause;
    }
    return undefined;
}
