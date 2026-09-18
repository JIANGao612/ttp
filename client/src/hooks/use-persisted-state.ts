import {useState, useEffect, useCallback} from 'react';

const PREFIX = 'ps:';

export function usePersistedState<T>(
    pageKey: string,
    stateKey: string,
    initialValue: T,
): [T, (value: T | ((prev: T) => T)) => void] {
    const storageKey = `${PREFIX}${pageKey}:${stateKey}`;

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

    return [state, setPersistedState];
}
