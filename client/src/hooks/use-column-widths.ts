import {useCallback, useEffect, useRef, useState} from 'react';

const MIN_WIDTH = 40;
const MAX_WIDTH = 800;

export interface UseColumnWidthsResult {
    widths: number[];
    startResize: (index: number, clientX: number) => void;
    handleResizeEnd: (widths: number[]) => void;
    reset: () => void;
}

export function useColumnWidths(
    defaults: number[],
    storageKey?: string,
): UseColumnWidthsResult {
    const loadWidths = (): number[] => {
        if (!storageKey) return defaults;
        try {
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                const parsed = JSON.parse(saved) as number[];
                if (Array.isArray(parsed) && parsed.length === defaults.length) {
                    return parsed.map((w: number, i: number) =>
                        Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, w || defaults[i])),
                    );
                }
            }
        } catch {
            // ignore
        }
        return defaults;
    };

    const [widths, setWidths] = useState<number[]>(loadWidths);
    const defaultsRef = useRef(defaults);
    defaultsRef.current = defaults;

    // 当 defaults 长度变化时（比如国家数改变），重新加载
    useEffect(() => {
        setWidths(loadWidths());
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [defaults.length, storageKey]);

    const startResize = useCallback(
        (index: number, clientX: number) => {
            const startWidth = widths[index];
            const onMove = (e: MouseEvent) => {
                const newWidth = Math.max(
                    MIN_WIDTH,
                    Math.min(MAX_WIDTH, startWidth + (e.clientX - clientX)),
                );
                setWidths((prev) => {
                    if (prev[index] === newWidth) return prev;
                    const next = [...prev];
                    next[index] = newWidth;
                    return next;
                });
            };
            const onUp = () => {
                document.removeEventListener('mousemove', onMove);
                document.removeEventListener('mouseup', onUp);
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
            };
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
        },
        [widths],
    );

    /** 由 Spreadsheet 组件在拖拽结束时回调，用于持久化 */
    const handleResizeEnd = useCallback(
        (finalWidths: number[]) => {
            if (!storageKey) return;
            try {
                localStorage.setItem(storageKey, JSON.stringify(finalWidths));
            } catch {
                // ignore
            }
        },
        [storageKey],
    );

    /** 恢复默认列宽 */
    const reset = useCallback(() => {
        setWidths(defaultsRef.current);
        if (storageKey) {
            try {
                localStorage.removeItem(storageKey);
            } catch {
                // ignore
            }
        }
    }, [storageKey]);

    return {widths, startResize, handleResizeEnd, reset};
}