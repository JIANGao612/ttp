import {useEffect, useLayoutEffect, useRef} from 'react';

type ScrollRef = React.RefObject<HTMLDivElement | null>;

export function usePersistedScroll(
    scrollRef: ScrollRef,
    pageKey: string,
    readyDep: unknown,
): void {
    const storageKey = `ps:${pageKey}:scroll`;
    const targetRef = useRef<number | null>(null);

    useEffect(() => {
        try {
            const raw = localStorage.getItem(storageKey);
            if (raw) {
                const parsed = JSON.parse(raw) as { left?: unknown };
                targetRef.current = typeof parsed.left === 'number' ? parsed.left : null;
            } else {
                targetRef.current = null;
            }
        } catch {
            targetRef.current = null;
        }
    }, [storageKey]);

    useEffect(() => {
        const el = scrollRef.current;
        if (!el) return;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const persist = (): void => {
            targetRef.current = el.scrollLeft;
            if (timer) clearTimeout(timer);
            timer = setTimeout(() => {
                try {
                    localStorage.setItem(storageKey, JSON.stringify({left: el.scrollLeft, top: el.scrollTop}));
                } catch {
                    // ignore write errors
                }
            }, 300);
        };
        el.addEventListener('scroll', persist, {passive: true});
        return () => {
            el.removeEventListener('scroll', persist);
            if (timer) clearTimeout(timer);
            try {
                localStorage.setItem(storageKey, JSON.stringify({left: el.scrollLeft, top: el.scrollTop}));
            } catch {
                // ignore write errors
            }
        };
    }, [scrollRef, storageKey, readyDep]);

    useLayoutEffect(() => {
        if (targetRef.current != null && scrollRef.current) {
            scrollRef.current.scrollLeft = targetRef.current;
        }
    }, [readyDep, scrollRef]);
}
