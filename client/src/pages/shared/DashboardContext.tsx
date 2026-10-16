import React, {createContext, useContext, useCallback, useState, useEffect, useSyncExternalStore} from 'react';
import {Outlet, useLocation} from 'react-router-dom';
import type {AdDataFilterParams} from '@shared/api.interface';
import {getDefaultFilters} from './default-date-range';
import {usePersistedState} from '@client/src/hooks/use-persisted-state';
import {resetExportAuth} from '@client/src/utils/export-guard';

export type ExportHandler = () => Promise<number>;

interface DashboardContextValue {
    filters: AdDataFilterParams;
    setFilters: (filters: AdDataFilterParams) => void;
    exportExtra: Record<string, unknown>;
    setExportExtra: (extra: Record<string, unknown>) => void;
    exportHandler: ExportHandler | null;
    setExportHandler: (handler: ExportHandler | null) => void;
}

const DashboardContext = createContext<DashboardContextValue | null>(null);

const DashboardContextInner: React.FC<{ routeKey: string }> = ({routeKey}) => {
    const [filters, setFilters] = usePersistedState<AdDataFilterParams>(
        `dashboard-${routeKey}`,
        'filters',
        getDefaultFilters(),
        true,
    );
    const [exportExtra, setExportExtra] = usePersistedState<Record<string, unknown>>(
        `dashboard-${routeKey}`,
        'exportExtra',
        {},
        true,
    );

    const handleSetFilters = useCallback((next: AdDataFilterParams) => {
        setFilters(next);
    }, [setFilters]);

    const handleSetExportExtra = useCallback((next: Record<string, unknown>) => {
        setExportExtra(next);
    }, [setExportExtra]);

    const [exportHandler, setExportHandlerState] = useState<ExportHandler | null>(null);

    useEffect(() => {
        resetExportAuth();
    }, []);

    const handleSetExportHandler = useCallback((handler: ExportHandler | null) => {
        setExportHandlerState(() => handler);
    }, []);

    return (
        <DashboardContext.Provider
            value={{
                filters,
                setFilters: handleSetFilters,
                exportExtra,
                setExportExtra: handleSetExportExtra,
                exportHandler,
                setExportHandler: handleSetExportHandler,
            }}
        >
            <Outlet/>
        </DashboardContext.Provider>
    );
};

export const DashboardProvider: React.FC = () => {
    const location = useLocation();
    const routeKey = location.pathname || 'index';
    return <DashboardContextInner key={routeKey} routeKey={routeKey}/>;
};

interface FallbackStore {
    filters: AdDataFilterParams;
    exportExtra: Record<string, unknown>;
    exportHandler: ExportHandler | null;
}

let fallbackStore: FallbackStore = {
    filters: getDefaultFilters(),
    exportExtra: {},
    exportHandler: null,
};
const fallbackListeners = new Set<() => void>();

const subscribeFallback = (listener: () => void): (() => void) => {
    fallbackListeners.add(listener);
    return () => {
        fallbackListeners.delete(listener);
    };
};
const getFallbackSnapshot = (): FallbackStore => fallbackStore;
const patchFallback = (patch: Partial<FallbackStore>): void => {
    fallbackStore = {...fallbackStore, ...patch};
    fallbackListeners.forEach((listener) => listener());
};

export function useDashboard(): DashboardContextValue {
    const ctx = useContext(DashboardContext);
    const fallback = useSyncExternalStore(subscribeFallback, getFallbackSnapshot);
    if (ctx) return ctx;
    return {
        filters: fallback.filters,
        setFilters: (filters: AdDataFilterParams) => patchFallback({filters}),
        exportExtra: fallback.exportExtra,
        setExportExtra: (exportExtra: Record<string, unknown>) => patchFallback({exportExtra}),
        exportHandler: fallback.exportHandler,
        setExportHandler: (exportHandler: ExportHandler | null) => patchFallback({exportHandler}),
    };
}

export function useRegisterExport(handler: ExportHandler | null): void {
    const {setExportHandler} = useDashboard();
    useEffect(() => {
        if (!handler) return;
        setExportHandler(handler);
        return () => setExportHandler(null);
    }, [handler, setExportHandler]);
}
