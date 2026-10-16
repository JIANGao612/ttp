/**
 * UploadHistory.tsx —— 上传历史表格
 *
 * 改动说明（相对妙搭版本）：
 *  - logger 从 '@lark-apaas/client-toolkit/logger' 改为 '@client/src/utils/logger'
 *  - 其余逻辑（分页、列宽调整、日期格式化、选择）保持不变
 */
import React, {useEffect, useState, useCallback} from 'react';
import {TableWithSelection} from '@client/src/components/table-selection';
import {getUploadRecords} from '@client/src/api/data-upload';
import {logger} from '@client/src/utils/logger';
import {Card, CardContent, CardHeader, CardTitle} from '@client/src/components/ui/card';
import {Badge} from '@client/src/components/ui/badge';
import {
    TableBody,
    TableRow,
    TableHead,
    TableCell,
} from '@client/src/components/ui/table';
import {History, RefreshCw} from 'lucide-react';
import {Button} from '@client/src/components/ui/button';
import type {UploadRecord} from '@shared/api.interface';
import EnhancedPagination from '@client/src/components/ui/enhanced-pagination';
import {useColumnWidths} from '@client/src/hooks/use-column-widths';
import {autoFitFromHandleEvent} from '@client/src/utils/column-resize-dom';
import {cn} from '@/lib/utils';

// ============================================================
// 状态映射
// ============================================================
const STATUS_MAP: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    success: {label: '成功', variant: 'default'},
    failed: {label: '失败', variant: 'destructive'},
    processing: {label: '处理中', variant: 'secondary'},
};

// 列默认宽度
const COL_DEFAULTS = [220, 80, 80, 80, 210, 150, 150, 220];

// ============================================================
// 工具函数
// ============================================================
function formatDateTime(iso: string): string {
    if (!iso) return '—';
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const pad = (n: number): string => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
        d.getDate(),
    )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ============================================================
// 可调整宽度的表头单元格
// ============================================================
const ResizableTh: React.FC<{
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    resizable?: boolean;
    onResizeStart?: (clientX: number) => void;
    onAutoFit?: (width: number) => void;
}> = ({children, className, style, resizable, onResizeStart, onAutoFit}) => (
    <TableHead
        className={cn('sticky top-0 z-10 relative whitespace-nowrap', className)}
        style={style}
    >
        {children}
        {resizable && onResizeStart && (
            <div
                className="absolute right-0 top-0 z-10 h-full w-1.5 cursor-col-resize select-none hover:bg-primary/60 active:bg-primary transition-colors"
                onMouseDown={(e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onResizeStart(e.clientX);
                }}
                onDoubleClick={(e: React.MouseEvent<HTMLDivElement>) => {
                    e.preventDefault();
                    e.stopPropagation();
                    autoFitFromHandleEvent(e.currentTarget, onAutoFit);
                }}
            />
        )}
    </TableHead>
);

// ============================================================
// 主组件
// ============================================================
interface UploadHistoryProps {
    refreshKey: number;
}

const UploadHistory: React.FC<UploadHistoryProps> = ({refreshKey}) => {
    const [records, setRecords] = useState<UploadRecord[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(false);
    const pageSize = 20;

    const {widths: colWidths, startResize, setColumnWidth} = useColumnWidths(COL_DEFAULTS);

    const thStyle = (i: number) => ({width: colWidths[i], minWidth: colWidths[i]});
    const tdStyle = (i: number) => ({width: colWidths[i], maxWidth: colWidths[i]});

    /** 拉取上传历史 */
    const fetchRecords = useCallback(async (p: number) => {
        setLoading(true);
        try {
            const res = await getUploadRecords({page: p, pageSize});
            const items = res?.data?.items ?? [];
            const total = res?.data?.total ?? 0;
            setRecords(Array.isArray(items) ? items : []);
            setTotal(typeof total === 'number' ? total : 0);
        } catch (err) {
            logger.error(`获取上传历史失败: ${String(err)}`);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void fetchRecords(page);
    }, [page, fetchRecords, refreshKey]);

    const totalPages = Math.ceil(total / pageSize);

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                    <History className="size-5"/>
                    上传历史
                </CardTitle>
                <Button
                    variant="ghost"
                    size="icon"
                    title="刷新历史记录"
                    disabled={loading}
                    onClick={() => void fetchRecords(page)}
                >
                    <RefreshCw className={cn('size-4', loading && 'animate-spin')}/>
                </Button>
            </CardHeader>
            <CardContent>
                {loading && records.length === 0 ? (
                    <div className="flex justify-center py-12 text-sm text-muted-foreground">加载中...</div>
                ) : records.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
                        <History className="size-8 opacity-40"/>
                        <p className="text-sm">暂无上传记录</p>
                    </div>
                ) : (
                    <>
                        <div className="max-h-[40vh] overflow-auto">
                            <TableWithSelection>
                                <table className="w-max border-separate border-spacing-0"
                                       style={{tableLayout: 'fixed'}}>
                                    <colgroup>
                                        {colWidths.map((w, i) => (
                                            <col key={i} style={{width: w}}/>
                                        ))}
                                    </colgroup>
                                    <thead>
                                    <TableRow>
                                        <ResizableTh
                                            className="bg-accent text-xs uppercase tracking-wider border-r border-border"
                                            style={thStyle(0)} resizable
                                            onResizeStart={(x: number) => startResize(0, x)}
                                            onAutoFit={(w: number) => setColumnWidth(0, w)}>文件名</ResizableTh>
                                        <ResizableTh
                                            className="bg-accent text-xs uppercase tracking-wider border-r border-border"
                                            style={thStyle(1)} resizable
                                            onResizeStart={(x: number) => startResize(1, x)}
                                            onAutoFit={(w: number) => setColumnWidth(1, w)}>状态</ResizableTh>
                                        <ResizableTh
                                            className="bg-accent text-xs uppercase tracking-wider text-center border-r border-border"
                                            style={thStyle(2)} resizable
                                            onResizeStart={(x: number) => startResize(2, x)}
                                            onAutoFit={(w: number) => setColumnWidth(2, w)}>总行数</ResizableTh>
                                        <ResizableTh
                                            className="bg-accent text-xs uppercase tracking-wider text-center border-r border-border"
                                            style={thStyle(3)} resizable
                                            onResizeStart={(x: number) => startResize(3, x)}
                                            onAutoFit={(w: number) => setColumnWidth(3, w)}>有效行数</ResizableTh>
                                        <ResizableTh
                                            className="bg-accent text-xs uppercase tracking-wider border-r border-border"
                                            style={thStyle(4)} resizable
                                            onResizeStart={(x: number) => startResize(4, x)}
                                            onAutoFit={(w: number) => setColumnWidth(4, w)}>数据日期范围</ResizableTh>
                                        <ResizableTh
                                            className="bg-accent text-xs uppercase tracking-wider border-r border-border"
                                            style={thStyle(5)} resizable
                                            onResizeStart={(x: number) => startResize(5, x)}
                                            onAutoFit={(w: number) => setColumnWidth(5, w)}>开始时间</ResizableTh>
                                        <ResizableTh
                                            className="bg-accent text-xs uppercase tracking-wider border-r border-border"
                                            style={thStyle(6)} resizable
                                            onResizeStart={(x: number) => startResize(6, x)}
                                            onAutoFit={(w: number) => setColumnWidth(6, w)}>结束时间</ResizableTh>
                                        <ResizableTh className="bg-accent text-xs uppercase tracking-wider"
                                                     style={thStyle(7)}>错误信息</ResizableTh>
                                    </TableRow>
                                    </thead>
                                    <TableBody>
                                        {records.map((r) => {
                                            const statusInfo = STATUS_MAP[r.status] ?? {
                                                label: r.status,
                                                variant: 'outline' as const
                                            };
                                            return (
                                                <TableRow key={r.id}>
                                                    <TableCell
                                                        className="bg-card truncate text-xs font-medium border-r border-border"
                                                        title={r.fileName} style={tdStyle(0)}>
                                                        {r.fileName}
                                                    </TableCell>
                                                    <TableCell className="bg-card border-r border-border"
                                                               style={tdStyle(1)}>
                                                        <Badge variant={statusInfo.variant} className="rounded-sm">
                                                            {statusInfo.label}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell
                                                        className="bg-card text-center font-mono text-xs border-r border-border"
                                                        style={tdStyle(2)}>{r.totalRows}</TableCell>
                                                    <TableCell
                                                        className="bg-card text-center font-mono text-xs border-r border-border"
                                                        style={tdStyle(3)}>{r.validRows}</TableCell>
                                                    <TableCell
                                                        className="bg-card font-mono text-xs border-r border-border"
                                                        style={tdStyle(4)}>
                                                        {r.dataDateStart && r.dataDateEnd
                                                            ? `${r.dataDateStart} ~ ${r.dataDateEnd}`
                                                            : '—'}
                                                    </TableCell>
                                                    <TableCell
                                                        className="bg-card font-mono text-xs whitespace-nowrap border-r border-border"
                                                        style={tdStyle(5)}>
                                                        {formatDateTime(r.startedAt)}
                                                    </TableCell>
                                                    <TableCell
                                                        className="bg-card font-mono text-xs whitespace-nowrap border-r border-border"
                                                        style={tdStyle(6)}>
                                                        {formatDateTime(r.processedAt)}
                                                    </TableCell>
                                                    <TableCell
                                                        className="bg-card truncate text-xs text-muted-foreground"
                                                        title={r.errorMessage} style={tdStyle(7)}>
                                                        {r.errorMessage || '—'}
                                                    </TableCell>
                                                </TableRow>
                                            );
                                        })}
                                    </TableBody>
                                </table>
                            </TableWithSelection>
                        </div>

                        <div className="pt-4">
                            <EnhancedPagination
                                page={page}
                                totalPages={Math.max(1, totalPages)}
                                total={total}
                                onPageChange={setPage}
                            />
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
};

export default UploadHistory;