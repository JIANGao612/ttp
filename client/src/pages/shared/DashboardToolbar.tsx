import React, {useCallback, useEffect, useRef, useState} from 'react';
import {Download, Loader2, Clock} from 'lucide-react';
import {Button} from '@client/src/components/ui/button';
import {toast} from 'sonner';
import {logger} from '@client/src/utils/logger';
import {exportData, getLastUpdated} from '@client/src/api/ad-data';
import {assertDownloadAllowed, authorizeExport} from '@client/src/utils/export-guard';
import type {ReportType, LastUpdatedResponse} from '@shared/api.interface';
import {useDashboard} from './DashboardContext';

interface DashboardToolbarProps {
    reportType: ReportType;
}

const DashboardToolbar: React.FC<DashboardToolbarProps> = ({reportType}) => {
    const {filters, exportExtra, exportHandler} = useDashboard();
    const [lastUpdated, setLastUpdated] = useState<LastUpdatedResponse | null>(null);
    const [exporting, setExporting] = useState(false);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    useEffect(() => {
        void (async () => {
            try {
                const {data} = await getLastUpdated();
                setLastUpdated(data);
            } catch (err) {
                logger.error('Failed to load lastUpdated:', err);
            }
        })();
    }, []);

    const handleExport = useCallback(async () => {
        setExporting(true);
        toast.info('正在导出，数据量较大时可能需要 1-2 分钟，请耐心等待');
        try {
            if (exportHandler) {
                authorizeExport();
                const rowCount = await exportHandler();
                toast.success(`导出成功，共 ${rowCount} 条数据`);
                return;
            }
            authorizeExport();
            const {data} = await exportData({
                ...filters, ...exportExtra,
                reportType
            } as Parameters<typeof exportData>[0]);
            if (!mountedRef.current) return;
            if (!assertDownloadAllowed(`toolbar_${reportType}.xlsx`, 'link')) return;
            const link = document.createElement('a');
            link.href = data.downloadUrl;
            link.download = '';
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success(`导出成功，共 ${data.rowCount} 条数据`);
        } catch (err) {
            if (err instanceof Error && err.message === 'EXPORT_CANCELLED_UNMOUNT') {
                return;
            }
            logger.error('Export failed:', err);
            const backendMsg = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
            let message: string;
            if (backendMsg) {
                message = backendMsg;
            } else if (err instanceof Error && err.message.includes('timeout')) {
                message = '导出超时：数据量过大，请缩小日期范围或筛选条件后重试';
            } else {
                message = '导出失败，请稍后重试';
            }
            toast.error(message);
        } finally {
            setExporting(false);
        }
    }, [filters, exportExtra, exportHandler, reportType]);

    const updatedText = lastUpdated
        ? new Date(lastUpdated.lastUpdated).toLocaleString('zh-CN')
        : '—';

    return (
        <div className="flex items-center justify-between border-t border-border pt-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5"/>
                <span>数据更新时间：{updatedText}</span>
            </div>
            <Button
                variant="default"
                size="sm"
                className="gap-1.5"
                disabled={exporting}
                onClick={() => void handleExport()}
            >
                {exporting ? (
                    <>
                        <Loader2 className="size-4 animate-spin"/>
                        导出中...
                    </>
                ) : (
                    <>
                        <Download className="size-4"/>
                        导出 Excel
                    </>
                )}
            </Button>
        </div>
    );
};

export default DashboardToolbar;
