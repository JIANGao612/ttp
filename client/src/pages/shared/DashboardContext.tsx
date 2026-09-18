import React, {createContext, useContext, useCallback, useState, useEffect} from 'react';
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
    );
    const [exportExtra, setExportExtra] = usePersistedState<Record<string, unknown>>(
        `dashboard-${routeKey}`,
        'exportExtra',
        {},
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

export function useDashboard(): DashboardContextValue {
    const ctx = useContext(DashboardContext);
    if (!ctx) {
        throw new Error('useDashboard must be used within DashboardProvider');
    }
    return ctx;
}

export function useRegisterExport(handler: ExportHandler | null): void {
    const {setExportHandler} = useDashboard();
    useEffect(() => {
        if (!handler) return;
        setExportHandler(handler);
        return () => setExportHandler(null);
    }, [handler, setExportHandler]);
}
