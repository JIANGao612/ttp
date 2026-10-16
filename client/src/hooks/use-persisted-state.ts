import {useState, useEffect, useCallback} from 'react';
import {onPrefUserChanged, userPrefKey} from '@client/src/utils/user-pref';
import {hydrateFromServer, prefSet} from '@client/src/utils/user-pref-sync';

const PREFIX = 'ps:';

export function persistedStorageKey(pageKey: string, stateKey: string): string {
    return `${PREFIX}${pageKey}:${stateKey}`;
}

export function usePersistedState<T>(
    pageKey: string,
    stateKey: string,
    initialValue: T,
    perUser = false,
): [T, (value: T | ((prev: T) => T)) => void] {
    const baseKey = persistedStorageKey(pageKey, stateKey);
    const storageKey = perUser ? userPrefKey(baseKey) : baseKey;

    const [state, setState] = useState<T>(() => {
        try {
            const stored = localStorage.getItem(storageKey);
            if (stored !== null) {
                return JSON.parse(stored) as T;
            }
        } catch {
            // ignore parse errors
        }
        return initialValue;
    });

    const setPersistedState = useCallback(
        (value: T | ((prev: T) => T)) => {
            setState((prev) => {
                const next =
                    typeof value === 'function'
                        ? (value as (prev: T) => T)(prev)
                        : value;
                try {
                    localStorage.setItem(storageKey, JSON.stringify(next));
                } catch {
                    // ignore write errors (quota, private mode, etc.)
                }
                prefSet(baseKey, JSON.stringify(next));
                return next;
            });
        },
        [storageKey],
    );

    useEffect(() => {
        const handler = (e: StorageEvent) => {
            if (e.key === storageKey && e.newValue !== null) {
                try {
                    setState(JSON.parse(e.newValue) as T);
                } catch {
                    // ignore
                }
            }
        };
        window.addEventListener('storage', handler);
        return () => window.removeEventListener('storage', handler);
    }, [storageKey]);

    useEffect(() => {
        hydrateFromServer(baseKey, storageKey, (raw: string) => {
            try {
                setState(JSON.parse(raw) as T);
            } catch {
                // ignore
            }
        });
    }, [baseKey, storageKey]);

    useEffect(() => {
        if (!perUser) return undefined;
        return onPrefUserChanged(() => {
            try {
                const stored = localStorage.getItem(userPrefKey(baseKey));
                if (stored !== null) {
                    setState(JSON.parse(stored) as T);
                    return;
                }
            } catch {
                // ignore
            }
            setState(initialValue);
            hydrateFromServer(baseKey, userPrefKey(baseKey), (raw: string) => {
                try {
                    setState(JSON.parse(raw) as T);
                } catch {
                    // ignore
                }
            });
        });
    }, [perUser, baseKey, initialValue]);

    return [state, setPersistedState];
}
