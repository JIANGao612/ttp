import {useState, useCallback, useRef, useLayoutEffect} from 'react';
import {usePersistedState} from './use-persisted-state';

export type SortDirection = 'asc' | 'desc';

export function useSort<F extends string>(initialField: F | null = null) {
    const [sortField, setSortField] = useState<F | null>(initialField);
    const [sortOrder, setSortOrder] = useState<SortDirection>('desc');

    const handleSort = useCallback((field: F) => {
        if (sortField === field) {
            setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
    }, [sortField]);

    return {sortField, sortOrder, handleSort};
}

export function usePersistedSort<F extends string>(
    pageKey: string,
    initialField: F | null = null,
) {
    const [sortField, setSortField] = usePersistedState<F | null>(
        pageKey,
        'sortField',
        initialField,
    );
    const [sortOrder, setSortOrder] = usePersistedState<SortDirection>(
        pageKey,
        'sortOrder',
        'desc',
    );

    const handleSort = useCallback((field: F) => {
        if (sortField === field) {
            setSortOrder((prev) => (prev === 'desc' ? 'asc' : 'desc'));
        } else {
            setSortField(field);
            setSortOrder('desc');
        }
    }, [sortField]);

    return {sortField, sortOrder, handleSort};
}

export function sortItems<T>(items: T[], field: string, order: SortDirection): T[] {
    return [...items].sort((a: T, b: T) => {
        const aVal = (a as Record<string, unknown>)[field];
        const bVal = (b as Record<string, unknown>)[field];
        const aIsNull = aVal === null || aVal === undefined || aVal === '';
        const bIsNull = bVal === null || bVal === undefined || bVal === '';
        if (aIsNull && bIsNull) return 0;
        if (aIsNull) return 1;
        if (bIsNull) return -1;
        const aNum = Number(aVal);
        const bNum = Number(bVal);
        if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
            return order === 'asc' ? aNum - bNum : bNum - aNum;
        }
        const aStr = String(aVal);
        const bStr = String(bVal);
        return order === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
    });
}

export function useScrollPreserve(
    scrollRef: React.RefObject<HTMLDivElement | null>,
    dep: unknown,
) {
    const savedPos = useRef<{ left: number; top: number } | null>(null);

    const saveScroll = useCallback(() => {
        if (scrollRef.current) {
            savedPos.current = {
                left: scrollRef.current.scrollLeft,
                top: scrollRef.current.scrollTop,
            };
        }
    }, [scrollRef]);

    useLayoutEffect(() => {
        if (savedPos.current && scrollRef.current) {
            scrollRef.current.scrollLeft = savedPos.current.left;
            scrollRef.current.scrollTop = savedPos.current.top;
            savedPos.current = null;
        }
    }, [dep, scrollRef]);

    return {saveScroll};
}
