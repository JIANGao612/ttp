import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {persistedStorageKey} from '@client/src/hooks/use-persisted-state';
import {onPrefUserChanged, userPrefKey} from '@client/src/utils/user-pref';
import {hydrateFromServer, prefSet} from '@client/src/utils/user-pref-sync';

interface UseTableFreezeOptions {
    columnWidths: number[];
    rowCount: number;
    initialFrozenCols?: number;
    initialFrozenRows?: number;
    persistKey?: string;
}

export interface TableFreezeApi {
    frozenCols: number;
    frozenRows: number;
    headerHeight: number;
    leftOffsets: number[];
    rowTops: number[];
    colDividerX: number;
    rowDividerY: number;
    colDragX: number | null;
    rowDragY: number | null;
    registerHeader: (el: HTMLElement | null) => void;
    registerRow: (index: number) => (el: HTMLTableRowElement | null) => void;
    startColDrag: (e: React.PointerEvent) => void;
    startRowDrag: (e: React.PointerEvent) => void;
    contentRef: React.RefObject<HTMLDivElement | null>;
}

function freezeStorageKey(persistKey: string): string {
    return userPrefKey(persistedStorageKey(persistKey, 'frozenCols'));
}

function readFrozenCols(persistKey: string, fallback: number): number {
    try {
        const stored = localStorage.getItem(freezeStorageKey(persistKey));
        if (stored !== null) {
            const parsed: unknown = JSON.parse(stored);
            if (typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 0) {
                return parsed;
            }
        }
    } catch {
        // ignore storage/parse errors
    }
    return fallback;
}

export function useTableFreeze(options: UseTableFreezeOptions): TableFreezeApi {
    const {columnWidths, rowCount, persistKey, initialFrozenCols} = options;
    const [frozenCols, setFrozenCols] = useState<number>(() => {
        if (persistKey) return readFrozenCols(persistKey, initialFrozenCols ?? 0);
        return initialFrozenCols ?? 0;
    });
    const [frozenRows, setFrozenRows] = useState(options.initialFrozenRows ?? 0);
    const [colDragX, setColDragX] = useState<number | null>(null);
    const [rowDragY, setRowDragY] = useState<number | null>(null);
    const [headerHeight, setHeaderHeight] = useState(36);
    const [rowHeights, setRowHeights] = useState<number[]>([]);
    const headerElRef = useRef<HTMLElement | null>(null);
    const rowElsRef = useRef<(HTMLTableRowElement | null)[]>([]);
    const contentRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!persistKey) return;
        try {
            localStorage.setItem(freezeStorageKey(persistKey), JSON.stringify(frozenCols));
        } catch {
            // ignore write errors (quota, private mode, etc.)
        }
        prefSet(persistedStorageKey(persistKey, 'frozenCols'), JSON.stringify(frozenCols));
    }, [persistKey, frozenCols]);

    useEffect(() => {
        if (!persistKey) return;
        hydrateFromServer(
            persistedStorageKey(persistKey, 'frozenCols'),
            freezeStorageKey(persistKey),
            (raw: string) => {
                try {
                    const parsed: unknown = JSON.parse(raw);
                    if (typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 0) {
                        setFrozenCols(parsed);
                    }
                } catch {
                    // ignore
                }
            },
        );
    }, [persistKey]);

    useEffect(() => {
        if (!persistKey) return undefined;
        return onPrefUserChanged(() => {
            setFrozenCols(readFrozenCols(persistKey, initialFrozenCols ?? 0));
        });
    }, [persistKey, initialFrozenCols]);

    const leftOffsets = useMemo(() => {
        const acc: number[] = [];
        let sum = 0;
        for (const w of columnWidths) {
            acc.push(sum);
            sum += w;
        }
        return acc;
    }, [columnWidths]);

    useLayoutEffect(() => {
        if (headerElRef.current) {
            setHeaderHeight(headerElRef.current.offsetHeight);
        }
        const heights: number[] = [];
        for (let i = 0; i < rowCount; i += 1) {
            const el = rowElsRef.current[i];
            heights.push(el ? el.offsetHeight : 38);
        }
        setRowHeights(heights);
    }, [rowCount]);

    const rowTops = useMemo(() => {
        const tops: number[] = [];
        let top = headerHeight;
        for (const h of rowHeights) {
            tops.push(top);
            top += h;
        }
        return tops;
    }, [headerHeight, rowHeights]);

    const colDividerX = leftOffsets[frozenCols] ?? 0;
    const rowDividerY = frozenRows === 0
        ? headerHeight
        : (rowTops[frozenRows] ?? headerHeight);

    const registerHeader = useCallback((el: HTMLElement | null) => {
        headerElRef.current = el;
    }, []);

    const registerRow = useCallback((index: number) => (el: HTMLTableRowElement | null) => {
        rowElsRef.current[index] = el;
    }, []);

    const startColDrag = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        const divider = e.currentTarget as HTMLElement;
        const content = contentRef.current;
        if (!content) return;
        const contentRect = content.getBoundingClientRect();
        const dividerRect = divider.getBoundingClientRect();
        const startX = dividerRect.left - contentRect.left;
        const startClientX = e.clientX;
        let lastX = startX;
        document.body.style.cursor = 'grabbing';
        document.body.style.userSelect = 'none';
        const onMove = (ev: PointerEvent) => {
            lastX = Math.max(0, startX + (ev.clientX - startClientX));
            setColDragX(lastX);
        };
        const onUp = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            setColDragX(null);
            let count = 0;
            for (let i = 0; i < columnWidths.length; i += 1) {
                const rightEdge = (leftOffsets[i] ?? 0) + columnWidths[i];
                if (rightEdge <= lastX + columnWidths[i] / 2) count = i + 1;
            }
            setFrozenCols(Math.max(0, Math.min(columnWidths.length - 1, count)));
        };
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
    }, [columnWidths, leftOffsets]);

    const startRowDrag = useCallback((e: React.PointerEvent) => {
        e.preventDefault();
        const divider = e.currentTarget as HTMLElement;
        const content = contentRef.current;
        if (!content) return;
        const contentRect = content.getBoundingClientRect();
        const dividerRect = divider.getBoundingClientRect();
        const startY = dividerRect.top - contentRect.top;
        const startClientY = e.clientY;
        let lastY = startY;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';
        const onMove = (ev: PointerEvent) => {
            lastY = Math.max(headerHeight, startY + (ev.clientY - startClientY));
            setRowDragY(lastY);
        };
        const onUp = () => {
            document.removeEventListener('pointermove', onMove);
            document.removeEventListener('pointerup', onUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            setRowDragY(null);
            let count = 0;
            for (let i = 0; i < rowCount; i += 1) {
                const bottom = (rowTops[i] ?? 0) + (rowHeights[i] ?? 38);
                if (bottom <= lastY + (rowHeights[i] ?? 38) / 2) count = i + 1;
            }
            setFrozenRows(Math.max(0, Math.min(rowCount, count)));
        };
        document.addEventListener('pointermove', onMove);
        document.addEventListener('pointerup', onUp);
    }, [headerHeight, rowCount, rowTops, rowHeights]);

    return {
        frozenCols,
        frozenRows,
        headerHeight,
        leftOffsets,
        rowTops,
        colDividerX,
        rowDividerY,
        colDragX,
        rowDragY,
        registerHeader,
        registerRow,
        startColDrag,
        startRowDrag,
        contentRef,
    };
}
