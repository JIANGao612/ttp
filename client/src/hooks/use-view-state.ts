import {useState, useEffect, useRef, useCallback} from 'react';
import {logger} from '@client/src/utils/logger';

export interface SpreadsheetViewState {
    hiddenCols: number[];
    hiddenRows: number[];
    hiddenCountryCodes: string[];
    explicitShowCodes: string[];
    scrollLeft: number;
    scrollTop: number;
}

const DEBOUNCE_MS = 500;

// 本地开发无用户系统，使用固定 userId
// 将来接入登录后，可以替换为从 auth context 里读取
const LOCAL_USER_ID = 'local-dev';

function storageKey(userId: string, pageKey: string): string {
    return `view_state:${userId}:${pageKey}`;
}

export function useViewState(pageKey: string) {
    const userId = LOCAL_USER_ID;
    const [viewState, setViewState] = useState<SpreadsheetViewState | null>(null);
    const [hasSavedState, setHasSavedState] = useState(false);
    const loadedRef = useRef(false);
    const skipSaveRef = useRef(true);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(storageKey(userId, pageKey));
            if (raw) {
                const parsed = JSON.parse(raw) as SpreadsheetViewState;
                setHasSavedState(true);
                setViewState({
                    hiddenCols: Array.isArray(parsed.hiddenCols) ? parsed.hiddenCols : [],
                    hiddenRows: Array.isArray(parsed.hiddenRows) ? parsed.hiddenRows : [],
                    hiddenCountryCodes: Array.isArray(parsed.hiddenCountryCodes) ? parsed.hiddenCountryCodes : [],
                    explicitShowCodes: Array.isArray(parsed.explicitShowCodes) ? parsed.explicitShowCodes : [],
                    scrollLeft: parsed.scrollLeft ?? 0,
                    scrollTop: parsed.scrollTop ?? 0,
                });
            } else {
                setHasSavedState(false);
                setViewState({
                    hiddenCols: [],
                    hiddenRows: [],
                    hiddenCountryCodes: [],
                    explicitShowCodes: [],
                    scrollLeft: 0,
                    scrollTop: 0,
                });
            }
        } catch (err) {
            logger.error('Failed to load view state:', err);
            setViewState({
                hiddenCols: [],
                hiddenRows: [],
                hiddenCountryCodes: [],
                explicitShowCodes: [],
                scrollLeft: 0,
                scrollTop: 0,
            });
        }
        loadedRef.current = true;
        skipSaveRef.current = true;
    }, [userId, pageKey]);

    const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const updateViewState = useCallback(
        (patch: Partial<SpreadsheetViewState>) => {
            setViewState((prev) => {
                const next = {
                    ...(prev ?? {
                        hiddenCols: [],
                        hiddenRows: [],
                        hiddenCountryCodes: [],
                        explicitShowCodes: [],
                        scrollLeft: 0,
                        scrollTop: 0,
                    }),
                    ...patch,
                };
                if (!skipSaveRef.current && loadedRef.current) {
                    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
                    saveTimerRef.current = setTimeout(() => {
                        try {
                            localStorage.setItem(storageKey(userId, pageKey), JSON.stringify(next));
                        } catch (err) {
                            logger.error('Failed to save view state:', err);
                        }
                    }, DEBOUNCE_MS);
                }
                return next;
            });
        },
        [userId, pageKey],
    );

    const markReady = useCallback(() => {
        skipSaveRef.current = false;
    }, []);

    const resetViewState = useCallback(() => {
        const empty = {
            hiddenCols: [],
            hiddenRows: [],
            hiddenCountryCodes: [],
            explicitShowCodes: [],
            scrollLeft: 0,
            scrollTop: 0,
        };
        setViewState(empty);
        try {
            localStorage.setItem(storageKey(userId, pageKey), JSON.stringify(empty));
        } catch (err) {
            logger.error('Failed to reset view state:', err);
        }
    }, [userId, pageKey]);

    return {viewState, updateViewState, markReady, hasSavedState, resetViewState};
}