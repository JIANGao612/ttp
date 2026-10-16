import React, {useState, useEffect, useRef} from 'react';
import {RefreshCw} from 'lucide-react';
import {toast} from 'sonner';
import {TableWithSelection} from '@client/src/components/table-selection';
import DashboardHeader from '../shared/DashboardHeader';
import DashboardToolbar from '../shared/DashboardToolbar';
import {useDashboard} from '../shared/DashboardContext';
import {SourceTable} from '../shared/report-tables';
import {getDefaultDateRange} from '../shared/default-date-range';
import {DATA_SOURCE_KEYWORD_FIELD_OPTIONS} from '@shared/source-columns';
import {backfillIdentityId, getBackfillStatus} from '@client/src/api/creative-asset-registry';

const SOURCE_PRIMARY_FIELDS: string[] = [
    'investTime', 'keyword', 'keywordFields', 'agent', 'materialType', 'materialDirection', 'country', 'newOrActive', 'group',
];

const DataSource: React.FC = () => {
    const {filters, setFilters} = useDashboard();
    const [refreshKey, setRefreshKey] = useState(0);
    const [backfilling, setBackfilling] = useState(false);
    const initRef = useRef(false);

    useEffect(() => {
        if (initRef.current) return;
        initRef.current = true;
        const {start, end} = getDefaultDateRange();
        setFilters({...filters, investTimeStart: start, investTimeEnd: end});
    }, [filters, setFilters]);

    useEffect(() => {
        const handler = () => setRefreshKey((k) => k + 1);
        window.addEventListener('promote-upload-success', handler);
        return () => window.removeEventListener('promote-upload-success', handler);
    }, []);

    const handleBackfill = async () => {
        if (backfilling) return;
        setBackfilling(true);
        try {
            const {taskId} = await backfillIdentityId();
            const poll = async (): Promise<void> => {
                const status = await getBackfillStatus(taskId);
                if (!status) {
                    setBackfilling(false);
                    toast.error('回填任务不存在');
                    return;
                }
                if (status.status === 'done' && status.result) {
                    toast.success(
                        `回填完成：扫描 ${status.result.total} 条，重新清洗 ${status.result.recleaned} 条，重新匹配 ${status.result.rematched} 条，实际更新 ${status.result.updated} 条，刷新缓存 ${status.result.refreshed} 条`,
                    );
                    setBackfilling(false);
                    setRefreshKey((k) => k + 1);
                    return;
                }
                if (status.status === 'failed') {
                    setBackfilling(false);
                    toast.error(`回填失败：${status.error ?? '未知错误'}`);
                    return;
                }
                setTimeout(() => {
                    void poll();
                }, 3000);
            };
            void poll();
        } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            toast.error(`回填失败：${msg}`);
            setBackfilling(false);
        }
    };

    return (
        <div key={refreshKey} className="flex flex-col gap-2">
            <DashboardHeader primaryFields={SOURCE_PRIMARY_FIELDS} idSearchPrimary={false} orderPrimaryByList
                             showGroupFilter showInvestTimeReset investTimeResetAll
                             keywordFieldOptions={DATA_SOURCE_KEYWORD_FIELD_OPTIONS}/>
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    onClick={handleBackfill}
                    disabled={backfilling}
                    className="inline-flex items-center gap-1.5 rounded-sm border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-40 transition-colors"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${backfilling ? 'animate-spin' : ''}`}/>
                    {backfilling ? '回填中...' : '全量回填派生字段'}
                </button>
            </div>
            <div className="rounded-sm border border-border bg-card p-4">
                <TableWithSelection>
                    <SourceTable filters={filters}/>
                </TableWithSelection>
            </div>
            <DashboardToolbar reportType="source"/>
        </div>
    );
};

export default DataSource;
