import {useState, useEffect, useRef, useCallback} from 'react';
// 删除飞书 useCurrentUserProfile，改为从 JWT 存储的用户信息拿 id
import {getStoredUser} from '@/utils/axios';
import {logger} from '@client/src/utils/logger';
import {
    hydrateFromServer,
    localGet,
    localSet,
    prefSet,
} from '@client/src/utils/user-pref-sync';

export interface SpreadsheetViewState {
    hiddenCols: number[];
    hiddenRows: number[];
    hiddenCountryCodes: string[];
    explicitShowCodes: string[];
    scrollLeft: number;
    scrollTop: number;
}

const DEBOUNCE_MS = 500;
const READY_DELAY_MS = 1000;

const DEFAULT_STATE: SpreadsheetViewState = {
    hiddenCols: [],
    hiddenRows: [],
    hiddenCountryCodes: [],
    explicitShowCodes: [],
    scrollLeft: 0,
    scrollTop: 0,
};

function storageKey(userId: string, pageKey: string): string {
    return `view_state:${userId}:${pageKey}`;
}

function serverScope(pageKey: string): string {
    return `viewState:${pageKey}`;
}

function parseState(raw: string): SpreadsheetViewState {
    const parsed = JSON.parse(raw) as Partial<SpreadsheetViewState>;
    return {
        hiddenCols: Array.isArray(parsed.hiddenCols) ? parsed.hiddenCols : [],
        hiddenRows: Array.isArray(parsed.hiddenRows) ? parsed.hiddenRows : [],
        hiddenCountryCodes: Array.isArray(parsed.hiddenCountryCodes) ? parsed.hiddenCountryCodes : [],
        explicitShowCodes: Array.isArray(parsed.explicitShowCodes) ? parsed.explicitShowCodes : [],
        scrollLeft: parsed.scrollLeft ?? 0,
        scrollTop: parsed.scrollTop ?? 0,
    };
}

export function useViewState(pageKey: string) {
    // ✅ 改动3：从 JWT 登录信息里取用户 id，未登录时回退到 'anonymous'
    const userId = getStoredUser()?.id ?? 'anonymous';

    const [viewState, setViewState] = useState<SpreadsheetViewState | null>(null);
    const [hasSavedState, setHasSavedState] = useState(false);
    const loadedRef = useRef(false);
    const skipSaveRef = useRef(true);

    useEffect(() => {
        loadedRef.current = false;
        skipSaveRef.current = true;
        const localKey = storageKey(userId, pageKey);
        const localRaw = localGet(localKey);
        if (localRaw) {
            try {
                setHasSavedState(true);
                setViewState(parseState(localRaw));
            } catch (err) {
                logger.error('Failed to parse local view state:', err);
                setHasSavedState(false);
                setViewState({...DEFAULT_STATE});
            }
        } else {
            setHasSavedState(false);
            setViewState({...DEFAULT_STATE});
        }
        hydrateFromServer(serverScope(pageKey), localKey, (serverRaw: string) => {
            try {
                setHasSavedState(true);
                setViewState(parseState(serverRaw));
            } catch (err) {
                logger.error('Failed to parse server view state:', err);
            }
        });
        loadedRef.current = true;
        const readyTimer = setTimeout(() => {
            skipSaveRef.current = false;
        }, READY_DELAY_MS);
        return () => clearTimeout(readyTimer);
    }, [userId, pageKey]);

    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const updateViewState = useCallback((patch: Partial<SpreadsheetViewState>) => {
        setViewState((prev) => {
            const next = {...(prev ?? {...DEFAULT_STATE}), ...patch};
            if (!skipSaveRef.current && loadedRef.current) {
                const raw = JSON.stringify(next);
                localSet(storageKey(userId, pageKey), raw);
                if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                saveTimerRef.current = setTimeout(() => {
                    prefSet(serverScope(pageKey), raw);
                }, DEBOUNCE_MS);
            }
            return next;
        });
    }, [userId, pageKey]);

    const markReady = useCallback(() => {
        skipSaveRef.current = false;
    }, []);

    const resetViewState = useCallback(() => {
        const empty = {...DEFAULT_STATE};
        setViewState(empty);
        const raw = JSON.stringify(empty);
        localSet(storageKey(userId, pageKey), raw);
        prefSet(serverScope(pageKey), raw);
    }, [userId, pageKey]);

    return {viewState, updateViewState, markReady, hasSavedState, resetViewState};
}