interface BackendErrorBody {
    message?: unknown;
    error?: { message?: unknown };
}

export function getBackendErrorMsg(err: unknown, fallback: string): string {
    const data = (err as { response?: { data?: BackendErrorBody } })?.response?.data;
    if (data && typeof data === 'object') {
        const m = data.error?.message ?? data.message;
        if (typeof m === 'string' && m) return m;
        if (Array.isArray(m) && typeof m[0] === 'string' && m[0]) return m[0];
    }
    return fallback;
}
