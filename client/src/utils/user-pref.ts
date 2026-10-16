const USER_ID_CACHE_KEY = 'pref:user-id';
const CHANGE_EVENT = 'pref-user-id-changed';

function readCachedUserId(): string {
    try {
        return localStorage.getItem(USER_ID_CACHE_KEY) || 'anonymous';
    } catch {
        return 'anonymous';
    }
}

let prefUserId: string = readCachedUserId();

export function getPrefUserId(): string {
    return prefUserId;
}

export function setPrefUserId(userId: string): void {
    if (!userId || userId === prefUserId) return;
    prefUserId = userId;
    try {
        localStorage.setItem(USER_ID_CACHE_KEY, userId);
    } catch {
        /* ignore */
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function userPrefKey(scope: string): string {
    return `u:${prefUserId}:${scope}`;
}

export function onPrefUserChanged(cb: () => void): () => void {
    window.addEventListener(CHANGE_EVENT, cb);
    return () => window.removeEventListener(CHANGE_EVENT, cb);
}
