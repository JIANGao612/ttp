import {
    getUserPreference,
    setUserPreference,
} from '@client/src/api/user-preferences';

const SAVE_DEBOUNCE_MS = 600;

const timers = new Map<string, ReturnType<typeof setTimeout>>();
const pendingValues = new Map<string, string>();

export function localGet(key: string): string | null {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
}

function tsKey(key: string): string {
    return `${key}:ts`;
}

export function localSet(key: string, value: string): void {
    try {
        localStorage.setItem(key, value);
        localStorage.setItem(tsKey(key), String(Date.now()));
    } catch {
        // ignore write errors (quota, private mode, etc.)
    }
}

export function getLocalTs(key: string): number | null {
    try {
        const raw = localStorage.getItem(tsKey(key));
        if (!raw) return null;
        const n = Number(raw);
        return Number.isFinite(n) ? n : null;
    } catch {
        return null;
    }
}

export function prefSet(scope: string, value: string): void {
    pendingValues.set(scope, value);
    const existing = timers.get(scope);
    if (existing) clearTimeout(existing);
    timers.set(scope, setTimeout(() => {
        timers.delete(scope);
        const next = pendingValues.get(scope);
        pendingValues.delete(scope);
        if (next === undefined) return;
        setUserPreference(scope, next).catch(() => {
            // 离线/未登录时允许失败，本地缓存仍生效
        });
    }, SAVE_DEBOUNCE_MS));
}

export async function prefGet(scope: string): Promise<string | null> {
    try {
        const pref = await getUserPreference(scope);
        return pref ? pref.value : null;
    } catch {
        return null;
    }
}

export async function prefGetFull(
    scope: string,
): Promise<{ value: string; updatedAt: string } | null> {
    try {
        const pref = await getUserPreference(scope);
        return pref ? {value: pref.value, updatedAt: pref.updatedAt} : null;
    } catch {
        return null;
    }
}

export function hydrateFromServer(
    scope: string,
    localKey: string,
    onServerValue: (value: string) => void,
): void {
    const localRaw = localGet(localKey);
    const localTs = getLocalTs(localKey);
    void prefGetFull(scope).then((pref: { value: string; updatedAt: string } | null) => {
        if (pref === null) {
            if (localRaw !== null) {
                prefSet(scope, localRaw);
            }
            return;
        }
        if (pref.value === localRaw) {
            return;
        }
        const serverTs = Date.parse(pref.updatedAt);
        if (
            localRaw !== null
            && localTs !== null
            && Number.isFinite(serverTs)
            && localTs > serverTs
        ) {
            // 本地比服务端新（服务端写入被防抖丢失或落后）：反向推送本地值，不用旧值覆盖本地
            prefSet(scope, localRaw);
            return;
        }
        localSet(localKey, pref.value);
        onServerValue(pref.value);
    });
}
