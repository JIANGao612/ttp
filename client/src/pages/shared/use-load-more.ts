import {useState, useEffect, useMemo, useCallback} from 'react';
import type {AdDataFilterParams} from '@shared/api.interface';
import {extendDateStart, formatLocalDate} from './default-date-range';

const LOAD_MORE_STEP = 30;

interface UseLoadMoreOptions {
    defaultDays?: number;
}

export function useLoadMore(filters: AdDataFilterParams, options?: UseLoadMoreOptions) {
    const defaultDays = options?.defaultDays;
    const [extraDays, setExtraDays] = useState(0);
    const [showReset, setShowReset] = useState(false);

    useEffect(() => {
        setExtraDays(0);
        setShowReset(false);
    }, [filters]);

    const baseStart = useMemo(() => {
        if (!defaultDays || !filters.investTimeStart) return filters.investTimeStart;
        const end = filters.investTimeEnd ? new Date(filters.investTimeEnd + 'T00:00:00') : new Date();
        const start = new Date(end);
        start.setDate(start.getDate() - (defaultDays - 1));
        const defaultStart = formatLocalDate(start);
        if (defaultStart > filters.investTimeStart) return defaultStart;
        return filters.investTimeStart;
    }, [defaultDays, filters.investTimeStart, filters.investTimeEnd]);

    const extendedFilters = useMemo<AdDataFilterParams>(() => {
        if (extraDays <= 0) {
            return baseStart && baseStart !== filters.investTimeStart
                ? {...filters, investTimeStart: baseStart}
                : filters;
        }
        return {
            ...filters,
            investTimeStart: extendDateStart(baseStart || filters.investTimeStart, extraDays),
        };
    }, [filters, baseStart, extraDays]);

    const loadMore = useCallback(() => {
        setExtraDays((prev) => prev + LOAD_MORE_STEP);
        setShowReset(true);
    }, []);

    const reset = useCallback(() => {
        setExtraDays(0);
        setShowReset(false);
    }, []);

    const canLoadMore = !!(baseStart || filters.investTimeStart);

    return {extendedFilters, extraDays, loadMore, canLoadMore, reset, showReset};
}
