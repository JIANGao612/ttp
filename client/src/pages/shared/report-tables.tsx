import React, {useState, useEffect, useCallback, useRef, useMemo, useId} from 'react';
import {useLocation} from 'react-router-dom';
import {Inbox, ChevronDown} from 'lucide-react';
import {Button} from '@client/src/components/ui/button';
import ColumnPresetManager from '@client/src/components/ColumnPresetManager';
import {
    TableHeader,
    TableBody,
    TableRow,
} from '@client/src/components/ui/table';
import EnhancedPagination from '@client/src/components/ui/enhanced-pagination';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@client/src/components/ui/select';
import {Empty, EmptyMedia, EmptyTitle} from '@client/src/components/ui/empty';
import {logger} from '@client/src/utils/logger';
import {toast} from 'sonner';
import {getCountryDisplayCode} from '@shared/country-utils';
import {getAdDataList} from '@client/src/api/ad-data';
import type {
    AdDataFilterParams,
    AdRecordFull,
    DailyReportRow,
    MaterialTypeReportRow,
    ReportBaseFields,
    SourceTableSummary,
} from '@shared/api.interface';
import {useColumnWidths} from '@client/src/hooks/use-column-widths';
import {useTableFreeze} from '@client/src/hooks/use-table-freeze';
import TableFreezeOverlays from '@client/src/components/table-freeze-overlays';
import {useSort, sortItems, useScrollPreserve} from '@client/src/hooks/use-sort';
import {usePersistedScroll} from '@client/src/hooks/use-persisted-scroll';
import {
    Th,
    Td,
    SummaryTd,
    MetricColumns,
    MetricHeaders,
    ReportShell,
    fmtInt,
    fmtRate,
    fmtDateYMD,
} from './report-helpers';
import {CellInteractionProvider} from './cell-interaction';
import {useLoadMore} from './use-load-more';
import {SOURCE_COLUMN_DEFS} from '@shared/source-columns';
import {fmtPct} from '@shared/format-utils';

export {
    Th, Td, SummaryTd, MetricColumns, MetricHeaders, ReportShell, fmtInt, fmtRate, fmtCtr, fmtDateYMD
} from './report-helpers';

interface SourceColumn {
    key: keyof AdRecordFull;
    label: string;
    width: number;
    sortable?: boolean;
    format?: 'int' | 'rate' | 'date';
    truncate?: boolean;
}

const SOURCE_COLUMN_LAYOUT: Record<string, { width: number; truncate?: boolean; sortable?: boolean }> = {
    seriesName: {width: 280, truncate: true},
    campaignId: {width: 160, truncate: true},
    adGroupName: {width: 280, truncate: true},
    creativeName: {width: 280, truncate: true},
    creativeId: {width: 120, truncate: true},
    videoMaterialId: {width: 140, truncate: true},
    adGroupId: {width: 120, truncate: true},
    recordDate: {width: 100},
    cleanedMaterialName: {width: 220, truncate: true},
    cost: {width: 80, sortable: true},
    impressions: {width: 80, sortable: true},
    clicks: {width: 120, sortable: true},
    play2s: {width: 120, sortable: true},
    playComplete: {width: 120, sortable: true},
    avgVideoPlayDuration: {width: 130, sortable: true},
    conversions: {width: 110, sortable: true},
    cpaOriginal: {width: 80, sortable: true},
    country: {width: 100},
    materialType: {width: 100},
    agent: {width: 100},
    dateValue: {width: 100, sortable: true},
    materialCategory: {width: 100},
    newOrActive: {width: 100},
    newUserActivated: {width: 100, sortable: true},
    placer: {width: 100},
    bidType: {width: 100},
    materialDirection: {width: 100},
    bcDirection: {width: 100},
    materialDate: {width: 120},
    secondaryCategory: {width: 140},
    tertiaryCategory: {width: 140},
    creativeIdentityId: {width: 140, truncate: true},
    maxSettlementDate: {width: 120},
    nonSettlementCost: {width: 100, sortable: true},
};

const SOURCE_COLUMNS: SourceColumn[] = SOURCE_COLUMN_DEFS.map((def) => {
    const layout = SOURCE_COLUMN_LAYOUT[def.key];
    return {
        key: def.key,
        label: def.label,
        format: def.format,
        width: layout?.width ?? 100,
        truncate: layout?.truncate,
        sortable: layout?.sortable,
    };
});

export const SourceTable: React.FC<{ filters: AdDataFilterParams }> = ({filters}) => {
    const [items, setItems] = useState<AdRecordFull[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(50);
    const [summary, setSummary] = useState<SourceTableSummary | null>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const {sortField, sortOrder, handleSort} = useSort<string>('dateValue');
    const {saveScroll} = useScrollPreserve(scrollRef, `${sortField}-${sortOrder}`);
    const sourceLocation = useLocation();
    usePersistedScroll(scrollRef, `${sourceLocation.pathname}:source`, loading);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const {data} = await getAdDataList({...filters, page, pageSize});
            setItems(data.items);
            setTotal(data.total);
            setSummary(data.summary ?? null);
        } catch (err) {
            logger.error('Failed to load source list:', err);
            toast.error('加载数据失败，请稍后重试');
            setItems([]);
            setTotal(0);
            setSummary(null);
        } finally {
            setLoading(false);
        }
    }, [filters, page, pageSize]);

    useEffect(() => {
        setPage(1);
    }, [filters]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const {widths: colWidths, startResize} = useColumnWidths(SOURCE_COLUMNS.map((c) => c.width));

    const displayItems = sortField ? sortItems(items, sortField, sortOrder) : items;

    const freeze = useTableFreeze({columnWidths: colWidths, rowCount: displayItems.length});

    const onSort = (field: string) => {
        saveScroll();
        handleSort(field);
    };

    const thStyle = (i: number): React.CSSProperties => ({
        width: colWidths[i],
        minWidth: colWidths[i],
        ...(i < freeze.frozenCols
            ? {position: 'sticky', left: freeze.leftOffsets[i], zIndex: 40}
            : {}),
    });
    const tdStyle = (i: number, isFrozenRow: boolean): React.CSSProperties => ({
        width: colWidths[i],
        maxWidth: colWidths[i],
        ...(i < freeze.frozenCols
            ? {position: 'sticky', left: freeze.leftOffsets[i], zIndex: isFrozenRow ? 25 : 10}
            : {}),
    });

    const summaryCellStyle = (i: number): React.CSSProperties => ({
        width: colWidths[i],
        maxWidth: colWidths[i],
        ...(i < freeze.frozenCols
            ? {position: 'sticky', left: freeze.leftOffsets[i], zIndex: 26}
            : {}),
    });

    const summaryValue = (key: string): string => {
        if (!summary) return '';
        switch (key) {
            case 'cost':
                return fmtInt(summary.totalCost);
            case 'impressions':
                return fmtInt(summary.totalImpressions);
            case 'clicks':
                return fmtInt(summary.totalClicks);
            case 'play2s':
                return fmtInt(summary.totalPlay2s);
            case 'playComplete':
                return fmtInt(summary.totalPlayComplete);
            case 'avgVideoPlayDuration':
                return summary.avgVideoPlayDuration != null ? summary.avgVideoPlayDuration.toFixed(2) : '—';
            case 'conversions':
                return fmtInt(summary.totalConversions);
            case 'cpaOriginal':
                return summary.cpa != null ? summary.cpa.toFixed(2) : '—';
            case 'newUserActivated':
                return fmtInt(summary.totalNewUserActivated);
            default:
                return '';
        }
    };

    return (
        <ReportShell loading={loading} total={total}>
            <CellInteractionProvider>
                <div ref={scrollRef} className="max-h-[60vh] overflow-auto" style={{overflowAnchor: 'none'}}>
                    <div ref={freeze.contentRef} className="relative min-w-max">
                        <table className="w-max border-separate border-spacing-0" style={{tableLayout: 'fixed'}}>
                            <colgroup>
                                {colWidths.map((w, i) => (
                                    <col key={i} style={{width: w}}/>
                                ))}
                            </colgroup>
                            <TableHeader>
                                <TableRow ref={freeze.registerHeader}>
                                    {SOURCE_COLUMNS.map((col, i) => (
                                        <Th
                                            key={col.key}
                                            style={thStyle(i)}
                                            resizable={i < colWidths.length - 1}
                                            onResizeStart={i < colWidths.length - 1 ? (x: number) => startResize(i, x) : undefined}
                                            sortable={!!col.sortable}
                                            sortDirection={sortField === col.key ? sortOrder : null}
                                            onSort={col.sortable ? () => onSort(col.key) : undefined}
                                        >
                                            {col.label}
                                        </Th>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {displayItems.map((row, ri) => {
                                    const isFrozenRow = ri < freeze.frozenRows;
                                    return (
                                        <TableRow
                                            key={row.id}
                                            ref={freeze.registerRow(ri)}
                                            style={isFrozenRow ? {
                                                position: 'sticky',
                                                top: freeze.rowTops[ri],
                                                zIndex: 20
                                            } : undefined}
                                        >
                                            {SOURCE_COLUMNS.map((col, i) => {
                                                const value = row[col.key];
                                                if (col.truncate) {
                                                    return (
                                                        <Td key={col.key} className="truncate"
                                                            title={String(value ?? '')} style={tdStyle(i, isFrozenRow)}>
                                                            {value ?? ''}
                                                        </Td>
                                                    );
                                                }
                                                if (col.format === 'int') {
                                                    return <Td key={col.key} mono
                                                               style={tdStyle(i, isFrozenRow)}>{fmtInt(Number(value) || 0)}</Td>;
                                                }
                                                if (col.format === 'rate') {
                                                    const v = row[col.key];
                                                    return <Td key={col.key} mono
                                                               style={tdStyle(i, isFrozenRow)}>{v != null && v !== '' ? Number(v).toFixed(2) : '—'}</Td>;
                                                }
                                                if (col.format === 'date') {
                                                    return <Td key={col.key}
                                                               style={tdStyle(i, isFrozenRow)}>{fmtDateYMD(String(value ?? ''))}</Td>;
                                                }
                                                return <Td key={col.key}
                                                           style={tdStyle(i, isFrozenRow)}>{value ?? ''}</Td>;
                                            })}
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                            {summary && (
                                <tfoot>
                                <tr>
                                    {SOURCE_COLUMNS.map((col, i) => (
                                        <SummaryTd
                                            key={col.key}
                                            mono={col.format === 'int' || col.format === 'rate'}
                                            style={summaryCellStyle(i)}
                                        >
                                            {i === 0 ? '合计' : summaryValue(col.key)}
                                        </SummaryTd>
                                    ))}
                                </tr>
                                </tfoot>
                            )}
                        </table>
                        <TableFreezeOverlays freeze={freeze} showRowDivider={displayItems.length > 0}/>
                    </div>
                </div>
            </CellInteractionProvider>
            <EnhancedPagination page={page} totalPages={totalPages} total={total} onPageChange={setPage}/>
            <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-muted-foreground">每页显示</span>
                <Select
                    value={String(pageSize)}
                    onValueChange={(v: string) => {
                        setPageSize(Number(v));
                        setPage(1);
                    }}
                >
                    <SelectTrigger className="h-7 w-[80px] text-xs">
                        <SelectValue/>
                    </SelectTrigger>
                    <SelectContent>
                        {[50, 100, 200, 500].map((size) => (
                            <SelectItem key={size} value={String(size)} className="text-xs">
                                {size} 条
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </ReportShell>
    );
};

export interface ReportTableProps<T> {
    filters: AdDataFilterParams;
    fetcher: (filters: AdDataFilterParams) => Promise<{ items: T[]; total: number }>;
    extraHeaders: string[];
    renderRow: (row: T, colWidths: number[]) => React.ReactNode;
    defaultWidths: number[];
    summaryCells?: (colWidths: number[]) => React.ReactNode;
    preferenceKey?: string;
    /** External load-more handler — when provided, ReportTable delegates
     *  load-more to the parent and appends items instead of replacing. */
    onLoadMore?: () => void;
    /** Number of extra weeks loaded via external load-more; used to
     *  signal append mode. */
    loadMoreWeeks?: number;
    /** Optional key function for deduplication when appending items.
     *  When provided, items with duplicate keys are skipped during append. */
    dedupeKey?: (item: T) => string;
}

function sumReportBaseFields<T extends ReportBaseFields>(items: T[]): ReportBaseFields | null {
    if (items.length === 0) return null;
    let totalCost = 0;
    let totalImpressions = 0;
    let totalClicks = 0;
    let totalConversions = 0;
    for (const item of items) {
        totalCost += item.totalCost || 0;
        totalImpressions += item.totalImpressions || 0;
        totalClicks += item.totalClicks || 0;
        totalConversions += item.totalConversions || 0;
    }
    const cpa = totalConversions > 0 ? totalCost / totalConversions : null;
    const cpm = totalImpressions > 0 ? (totalCost / totalImpressions) * 1000 : null;
    const ctr = totalImpressions > 0 ? totalClicks / totalImpressions : null;
    return {totalCost, totalImpressions, totalClicks, totalConversions, cpa, cpm, ctr};
}

export function ReportTable<T extends ReportBaseFields>({
                                                            filters,
                                                            fetcher,
                                                            extraHeaders,
                                                            renderRow,
                                                            defaultWidths,
                                                            summaryCells,
                                                            preferenceKey,
                                                            onLoadMore,
                                                            loadMoreWeeks,
                                                            dedupeKey,
                                                        }: ReportTableProps<T>) {
    const [items, setItems] = useState<T[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const {widths: colWidths, startResize} = useColumnWidths(defaultWidths);
    const scrollRef = useRef<HTMLDivElement>(null);
    const {sortField, sortOrder, handleSort} = useSort<string>();
    const {saveScroll} = useScrollPreserve(scrollRef, `${sortField}-${sortOrder}`);
    const reportLocation = useLocation();
    usePersistedScroll(scrollRef, `${reportLocation.pathname}:report`, loading);
    const {
        extendedFilters: internalExtended,
        extraDays: internalExtraDays,
        loadMore: internalLoadMoreFn,
        canLoadMore: internalCanLoadMore
    } = useLoadMore(filters);

    const hasExternalLoadMore = !!onLoadMore;
    const effectiveFilters = hasExternalLoadMore ? filters : internalExtended;
    const effectiveExtraDays = hasExternalLoadMore ? (loadMoreWeeks ?? 0) : internalExtraDays;
    const effectiveCanLoadMore = hasExternalLoadMore ? !!filters.investTimeStart : internalCanLoadMore;

    const handleLoadMoreClick = useCallback(() => {
        if (onLoadMore) {
            onLoadMore();
        } else {
            internalLoadMoreFn();
        }
    }, [onLoadMore, internalLoadMoreFn]);

    const METRIC_LABELS = ['消耗', '展示', '点击', '付费量', 'CPA', 'CPM', 'CTR'];
    const allColumns = useMemo(() => {
        const cols: { key: string; label: string }[] = [];
        extraHeaders.forEach((label) => cols.push({key: `extra_${label}`, label}));
        METRIC_LABELS.forEach((label) => cols.push({key: `metric_${label}`, label}));
        return cols;
    }, [extraHeaders]);
    const allKeys = useMemo(() => allColumns.map((c) => c.key), [allColumns]);
    const [extraVisibleKeys, setExtraVisibleKeys] = useState<string[]>(allKeys);
    const extraVisibleSet = useMemo(() => new Set(extraVisibleKeys), [extraVisibleKeys]);
    const extraHiddenIndices = useMemo(() => {
        const hidden: number[] = [];
        allColumns.forEach((col, i) => {
            if (!extraVisibleSet.has(col.key)) hidden.push(i);
        });
        return hidden;
    }, [allColumns, extraVisibleSet]);
    const extraHiddenSet = useMemo(() => new Set(extraHiddenIndices), [extraHiddenIndices]);
    const visibleColWidths = useMemo(
        () => colWidths.map((w, i) => (extraHiddenSet.has(i) ? 0 : w)),
        [colWidths, extraHiddenSet],
    );

    const columnPresetBtn = preferenceKey ? (
        <div className="mb-2 flex items-center justify-end">
            <ColumnPresetManager
                preferenceKey={preferenceKey}
                columns={allColumns}
                visibleKeys={extraVisibleKeys}
                onChange={setExtraVisibleKeys}
                title="列设置"
                buttonLabel="列设置"
            />
        </div>
    ) : null;

    const fetchData = useCallback(async (f: AdDataFilterParams, isLoadMore: boolean) => {
        if (isLoadMore) setLoadingMore(true); else setLoading(true);
        try {
            const result = await fetcher(f);
            if (isLoadMore) {
                setItems((prev: T[]) => {
                    const keyFn = dedupeKey;   // 提取到局部变量，TypeScript 就能正确收窄类型
                    const existing = keyFn ? new Set(prev.map(keyFn)) : null;
                    const newItems = existing
                        ? result.items.filter((item: T) => !existing.has(keyFn!(item)))
                        : result.items;
                    return [...prev, ...newItems];
                });
            } else {
                setItems(result.items);
            }
            setTotal(result.total);
        } catch (err) {
            logger.error('Failed to load report:', err);
            toast.error('加载报表数据失败，请稍后重试');
            setItems([]);
            setTotal(0);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [fetcher]);

    useEffect(() => {
        void fetchData(effectiveFilters, effectiveExtraDays > 0);
    }, [fetchData, effectiveFilters, effectiveExtraDays]);

    const displayItems = sortField ? sortItems(items, sortField, sortOrder) : items;

    const freeze = useTableFreeze({columnWidths: colWidths, rowCount: displayItems.length});
    const freezeScopeId = useId().replace(/\W/g, '');

    const onSort = (field: string) => {
        saveScroll();
        handleSort(field);
    };

    const thStyle = (i: number): React.CSSProperties => ({
        width: visibleColWidths[i],
        minWidth: visibleColWidths[i],
        ...(i < freeze.frozenCols
            ? {position: 'sticky', left: freeze.leftOffsets[i], zIndex: 40}
            : {}),
    });

    const frozenColCss = Array.from({length: freeze.frozenCols}, (_: unknown, ci: number) => [
        `#${freezeScopeId} thead th:nth-child(${ci + 1}){left:${freeze.leftOffsets[ci]}px;z-index:40}`,
        `#${freezeScopeId} tbody td:nth-child(${ci + 1}){position:sticky;left:${freeze.leftOffsets[ci]}px;z-index:10}`,
        `#${freezeScopeId} tfoot td:nth-child(${ci + 1}){position:sticky;left:${freeze.leftOffsets[ci]}px;z-index:26}`,
    ].join('')).join('') + (freeze.frozenRows > 0
        ? Array.from({length: freeze.frozenCols}, (_: unknown, ci: number) =>
            `#${freezeScopeId} tbody tr:nth-child(-n+${freeze.frozenRows}) td:nth-child(${ci + 1}){z-index:25}`,
        ).join('')
        : '');

    const summary = sumReportBaseFields(items);
    const metricStartIndex = extraHeaders.length;

    return (
        <ReportShell loading={loading} total={total}>
            {columnPresetBtn}
            <CellInteractionProvider>
                <div ref={scrollRef} className="max-h-[60vh] overflow-auto" style={{overflowAnchor: 'none'}}>
                    <div id={freezeScopeId} ref={freeze.contentRef} className="relative min-w-max">
                        {freeze.frozenCols > 0 && <style>{frozenColCss}</style>}
                        <table className="w-max border-separate border-spacing-0" style={{tableLayout: 'fixed'}}>
                            <colgroup>
                                {visibleColWidths.map((w, i) => (
                                    <col key={i} style={{width: w}}/>
                                ))}
                            </colgroup>
                            <TableHeader>
                                <TableRow ref={freeze.registerHeader}>
                                    {extraHeaders.map((label, i) => (
                                        <Th
                                            key={i}
                                            style={thStyle(i)}
                                            resizable={i < colWidths.length - 1}
                                            onResizeStart={
                                                i < colWidths.length - 1 ? (x: number) => startResize(i, x) : undefined
                                            }
                                        >
                                            {label}
                                        </Th>
                                    ))}
                                    <MetricHeaders
                                        widths={visibleColWidths}
                                        startIndex={extraHeaders.length}
                                        startResize={startResize}
                                        colCount={colWidths.length}
                                        sortField={sortField}
                                        sortOrder={sortOrder}
                                        onSort={onSort}
                                    />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {displayItems.map((row, idx) => {
                                    const isFrozenRow = idx < freeze.frozenRows;
                                    return (
                                        <TableRow
                                            key={idx}
                                            ref={freeze.registerRow(idx)}
                                            style={isFrozenRow ? {
                                                position: 'sticky',
                                                top: freeze.rowTops[idx],
                                                zIndex: 20
                                            } : undefined}
                                        >
                                            {renderRow(row, visibleColWidths)}
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                            {summary && (
                                <tfoot>
                                <tr>
                                    {summaryCells ? (
                                        summaryCells(visibleColWidths)
                                    ) : (
                                        <SummaryTd colSpan={extraHeaders.length}
                                                   zIndex={freeze.frozenCols > 0 ? 26 : 5}>汇总</SummaryTd>
                                    )}
                                    <MetricColumns
                                        row={summary}
                                        startIndex={extraHeaders.length}
                                        widths={visibleColWidths}
                                    />
                                </tr>
                                </tfoot>
                            )}
                        </table>
                        <TableFreezeOverlays freeze={freeze} showRowDivider={displayItems.length > 0}/>
                    </div>
                </div>
            </CellInteractionProvider>
            {effectiveCanLoadMore && (
                <div className="flex justify-center py-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-xs text-muted-foreground"
                        onClick={handleLoadMoreClick}
                        disabled={loadingMore}
                    >
                        <ChevronDown className="size-3"/>
                        {loadingMore ? '加载中...' : '加载更多历史数据'}
                    </Button>
                </div>
            )}
        </ReportShell>
    );
}

const DAILY_HEADERS = [
    '消耗时间', '国家', '素材-拉新/拉活', '二级分类（人群）', '三级分类（方向）',
    '消耗', '付费量', 'New User Activated',
];
const DAILY_WIDTHS = [110, 100, 120, 140, 140, 100, 100, 140];
const DAILY_SORT_KEYS: (string | null)[] = [
    null, null, null, null, null,
    'totalCost', 'totalConversions', 'newUserActivated',
];

export const DailyReportTable: React.FC<{
    filters: AdDataFilterParams;
    fetcher: (f: AdDataFilterParams) => Promise<{ items: DailyReportRow[]; total: number }>;
}> = ({filters, fetcher}) => {
    const [items, setItems] = useState<DailyReportRow[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const {widths: colWidths, startResize} = useColumnWidths(DAILY_WIDTHS);
    const scrollRef = useRef<HTMLDivElement>(null);
    const {sortField, sortOrder, handleSort} = useSort<string>();
    const {saveScroll} = useScrollPreserve(scrollRef, `${sortField}-${sortOrder}`);
    const dailyReportLocation = useLocation();
    usePersistedScroll(scrollRef, `${dailyReportLocation.pathname}:daily-report`, loading);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const result = await fetcher(filters);
            setItems(result.items);
            setTotal(result.total);
        } catch (err) {
            logger.error('Failed to load daily report:', err);
            toast.error('加载日报表数据失败，请稍后重试');
            setItems([]);
            setTotal(0);
        } finally {
            setLoading(false);
        }
    }, [filters, fetcher]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    const displayItems = sortField ? sortItems(items, sortField, sortOrder) : items;

    const onSort = (field: string) => {
        saveScroll();
        handleSort(field);
    };

    const thStyle = (i: number): React.CSSProperties => ({
        width: colWidths[i],
        minWidth: colWidths[i],
    });

    return (
        <ReportShell loading={loading} total={total}>
            <CellInteractionProvider>
                <div ref={scrollRef} className="max-h-[60vh] overflow-auto">
                    <table className="w-max border-separate border-spacing-0" style={{tableLayout: 'fixed'}}>
                        <colgroup>
                            {colWidths.map((w, i) => (
                                <col key={i} style={{width: w}}/>
                            ))}
                        </colgroup>
                        <TableHeader>
                            <TableRow>
                                {DAILY_HEADERS.map((label, i) => {
                                    const sortKey = DAILY_SORT_KEYS[i];
                                    return (
                                        <Th
                                            key={i}
                                            style={thStyle(i)}
                                            resizable={i < colWidths.length - 1}
                                            onResizeStart={i < colWidths.length - 1 ? (x: number) => startResize(i, x) : undefined}
                                            sortable={!!sortKey}
                                            sortDirection={sortField === sortKey ? sortOrder : null}
                                            onSort={sortKey ? () => onSort(sortKey) : undefined}
                                        >
                                            {label}
                                        </Th>
                                    );
                                })}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {displayItems.map((row, idx) => (
                                <TableRow key={idx}>
                                    <Td style={{
                                        width: colWidths[0],
                                        maxWidth: colWidths[0]
                                    }}>{fmtDateYMD(row.date)}</Td>
                                    <Td style={{
                                        width: colWidths[1],
                                        maxWidth: colWidths[1]
                                    }}>{row.country ? getCountryDisplayCode(row.country) : '—'}</Td>
                                    <Td style={{
                                        width: colWidths[2],
                                        maxWidth: colWidths[2]
                                    }}>{row.materialNewOrActive || '—'}</Td>
                                    <Td style={{
                                        width: colWidths[3],
                                        maxWidth: colWidths[3]
                                    }}>{row.audienceCategory}</Td>
                                    <Td style={{
                                        width: colWidths[4],
                                        maxWidth: colWidths[4]
                                    }}>{row.directionCategory}</Td>
                                    <Td mono style={{
                                        width: colWidths[5],
                                        maxWidth: colWidths[5]
                                    }}>{fmtInt(row.totalCost)}</Td>
                                    <Td mono style={{
                                        width: colWidths[6],
                                        maxWidth: colWidths[6]
                                    }}>{fmtInt(row.totalConversions)}</Td>
                                    <Td mono style={{
                                        width: colWidths[7],
                                        maxWidth: colWidths[7]
                                    }}>{fmtInt(row.newUserActivated)}</Td>
                                </TableRow>
                            ))}
                        </TableBody>
                        {displayItems.length > 0 && (() => {
                            const sumCost = displayItems.reduce((s, r) => s + (r.totalCost || 0), 0);
                            const sumConv = displayItems.reduce((s, r) => s + (r.totalConversions || 0), 0);
                            const sumNua = displayItems.reduce((s, r) => s + (r.newUserActivated || 0), 0);
                            return (
                                <tfoot>
                                <tr>
                                    <SummaryTd colSpan={5}>汇总</SummaryTd>
                                    <SummaryTd mono style={{width: colWidths[5], maxWidth: colWidths[5]}}>
                                        {fmtInt(sumCost)}
                                    </SummaryTd>
                                    <SummaryTd mono style={{width: colWidths[6], maxWidth: colWidths[6]}}>
                                        {fmtInt(sumConv)}
                                    </SummaryTd>
                                    <SummaryTd mono style={{width: colWidths[7], maxWidth: colWidths[7]}}>
                                        {fmtInt(sumNua)}
                                    </SummaryTd>
                                </tr>
                                </tfoot>
                            );
                        })()}
                    </table>
                </div>
            </CellInteractionProvider>
        </ReportShell>
    );
};

const MATERIAL_TYPE_HEADERS = [
    '时间/素材类型', '总计', 'UGC/全球演员/Story', 'AIGC', 'AE', 'studio',
    '其他/repurposed', '实拍', '剪辑', '收益测算(1)', '收益测算(2)',
    'ugc消耗比例', 'ai消耗比例', 'ae消耗比例',
];
const MATERIAL_TYPE_WIDTHS = [110, 100, 150, 90, 90, 90, 130, 90, 90, 110, 110, 100, 100, 100];
const MATERIAL_TYPE_SORT_KEYS: (string | null)[] = [
    null, 'totalCost', 'ugcStory', 'aigc', 'ae', 'studio',
    'other', 'actualShoot', 'editing', 'revenueEstimate1', 'revenueEstimate2',
    'ugcRatio', 'aiRatio', 'aeRatio',
];


export const MaterialTypeDailyTable: React.FC<{
    filters: AdDataFilterParams;
    fetcher: (f: AdDataFilterParams) => Promise<{ items: MaterialTypeReportRow[]; total: number }>;
}> = ({filters, fetcher}) => {
    const [items, setItems] = useState<MaterialTypeReportRow[]>([]);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const {widths: colWidths, startResize} = useColumnWidths(MATERIAL_TYPE_WIDTHS);
    const scrollRef = useRef<HTMLDivElement>(null);
    const {sortField, sortOrder, handleSort} = useSort<string>();
    const {saveScroll} = useScrollPreserve(scrollRef, `${sortField}-${sortOrder}`);
    const materialTypeLocation = useLocation();
    usePersistedScroll(scrollRef, `${materialTypeLocation.pathname}:material-type`, loading);
    const {extendedFilters, extraDays, loadMore, canLoadMore} = useLoadMore(filters);

    const MATERIAL_TYPE_COLUMNS = useMemo(
        () => MATERIAL_TYPE_HEADERS.map((label, i) => ({key: `col_${i}`, label})),
        [],
    );
    const allKeys = useMemo(
        () => MATERIAL_TYPE_HEADERS.map((_, i) => `col_${i}`),
        [],
    );
    const [visibleKeys, setVisibleKeys] = useState<string[]>(allKeys);
    const visibleIndices = useMemo(
        () => visibleKeys.map((k) => Number(k.replace('col_', ''))),
        [visibleKeys],
    );
    const visibleSet = useMemo(() => new Set(visibleIndices), [visibleIndices]);

    const visibleHeaders = useMemo(
        () => MATERIAL_TYPE_HEADERS.filter((_, i) => visibleSet.has(i)),
        [visibleSet],
    );
    const visibleWidths = useMemo(
        () => MATERIAL_TYPE_WIDTHS.filter((_, i) => visibleSet.has(i)),
        [visibleSet],
    );
    const visibleSortKeys = useMemo(
        () => MATERIAL_TYPE_SORT_KEYS.filter((_, i) => visibleSet.has(i)),
        [visibleSet],
    );
    const cellRenderers: ((row: MaterialTypeReportRow) => React.ReactNode)[] = [
        (row) => fmtDateYMD(row.date),
        (row) => fmtInt(row.totalCost),
        (row) => fmtInt(row.ugcStory),
        (row) => fmtInt(row.aigc),
        (row) => fmtInt(row.ae),
        (row) => fmtInt(row.studio),
        (row) => fmtInt(row.other),
        (row) => fmtInt(row.actualShoot),
        (row) => fmtInt(row.editing),
        (row) => fmtInt(row.revenueEstimate1),
        (row) => fmtInt(row.revenueEstimate2),
        (row) => fmtPct(row.ugcRatio),
        (row) => fmtPct(row.aiRatio),
        (row) => fmtPct(row.aeRatio),
    ];

    const visibleRenderers = useMemo(
        () => cellRenderers.filter((_, i) => visibleSet.has(i)),
        [visibleSet],
    );

    const fetchData = useCallback(async (f: AdDataFilterParams, isLoadMore: boolean) => {
        if (isLoadMore) setLoadingMore(true); else setLoading(true);
        try {
            const result = await fetcher(f);
            setItems(result.items);
            setTotal(result.total);
        } catch (err) {
            logger.error('Failed to load material type report:', err);
            toast.error('加载素材类型报表失败，请稍后重试');
            setItems([]);
            setTotal(0);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, [fetcher]);

    useEffect(() => {
        void fetchData(extendedFilters, extraDays > 0);
    }, [fetchData, extendedFilters]);

    const displayItems = sortField ? sortItems(items, sortField, sortOrder) : [...items].reverse();

    const onSort = (field: string) => {
        saveScroll();
        handleSort(field);
    };

    const thStyle = (i: number): React.CSSProperties => ({
        width: visibleWidths[i],
        minWidth: visibleWidths[i],
    });
    const tdStyle = (i: number): React.CSSProperties => ({
        width: visibleWidths[i],
        maxWidth: visibleWidths[i],
    });

    const visibleColIndices = visibleIndices;
    const firstColVisible = visibleSet.has(0);

    return (
        <ReportShell loading={loading} total={total}>
            <div className="mb-2 flex items-center justify-end">
                <ColumnPresetManager
                    preferenceKey="daily-times:material-type"
                    columns={MATERIAL_TYPE_COLUMNS}
                    visibleKeys={visibleKeys}
                    onChange={setVisibleKeys}
                    title="素材日报列设置"
                    buttonLabel="列设置"
                />
            </div>
            <CellInteractionProvider>
                <div ref={scrollRef} className="max-h-[60vh] overflow-auto">
                    <table className="w-max border-separate border-spacing-0" style={{tableLayout: 'fixed'}}>
                        <colgroup>
                            {visibleWidths.map((w, i) => (
                                <col key={i} style={{width: w}}/>
                            ))}
                        </colgroup>
                        <TableHeader>
                            <TableRow>
                                {visibleHeaders.map((label, vi) => {
                                    const realIdx = visibleColIndices[vi];
                                    const sortKey = visibleSortKeys[vi];
                                    return (
                                        <Th
                                            key={realIdx}
                                            style={thStyle(vi)}
                                            resizable={vi < visibleWidths.length - 1}
                                            onResizeStart={vi < visibleWidths.length - 1 ? (x: number) => startResize(realIdx, x) : undefined}
                                            sortable={!!sortKey}
                                            sortDirection={sortKey && sortField === sortKey ? sortOrder : null}
                                            onSort={sortKey ? () => onSort(sortKey) : undefined}
                                        >
                                            {label}
                                        </Th>
                                    );
                                })}
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {displayItems.map((row, idx) => (
                                <TableRow key={idx}>
                                    {visibleRenderers.map((render, vi) => (
                                        <Td key={vi} mono={vi > 0 || !firstColVisible} style={tdStyle(vi)}>
                                            {render(row)}
                                        </Td>
                                    ))}
                                </TableRow>
                            ))}
                        </TableBody>
                        {displayItems.length > 0 && (() => {
                            const keys = [
                                'totalCost', 'ugcStory', 'aigc', 'ae', 'studio', 'other',
                                'actualShoot', 'editing', 'revenueEstimate1', 'revenueEstimate2',
                            ] as const;
                            const sums: Record<string, number> = {};
                            for (const k of keys) sums[k] = 0;
                            for (const row of displayItems) {
                                for (const k of keys) sums[k] += Number(row[k]) || 0;
                            }
                            const ugcRatio = sums.totalCost > 0 ? sums.ugcStory / sums.totalCost : 0;
                            const aiRatio = sums.totalCost > 0 ? sums.aigc / sums.totalCost : 0;
                            const aeRatio = sums.totalCost > 0 ? sums.ae / sums.totalCost : 0;
                            const allValues: string[] = [
                                '汇总',
                                fmtInt(sums.totalCost),
                                fmtInt(sums.ugcStory),
                                fmtInt(sums.aigc),
                                fmtInt(sums.ae),
                                fmtInt(sums.studio),
                                fmtInt(sums.other),
                                fmtInt(sums.actualShoot),
                                fmtInt(sums.editing),
                                fmtInt(sums.revenueEstimate1),
                                fmtInt(sums.revenueEstimate2),
                                fmtPct(ugcRatio),
                                fmtPct(aiRatio),
                                fmtPct(aeRatio),
                            ];
                            const visibleValues = visibleColIndices.map((idx) => allValues[idx]);
                            const firstIsDate = visibleColIndices[0] === 0;
                            return (
                                <tfoot>
                                <tr>
                                    {visibleValues.map((v, vi) => (
                                        <SummaryTd key={vi} mono={vi > 0 || !firstIsDate} style={tdStyle(vi)}>
                                            {v}
                                        </SummaryTd>
                                    ))}
                                </tr>
                                </tfoot>
                            );
                        })()}
                    </table>
                </div>
            </CellInteractionProvider>
            {canLoadMore && (
                <div className="flex justify-center py-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 gap-1 text-xs text-muted-foreground"
                        onClick={loadMore}
                        disabled={loadingMore}
                    >
                        <ChevronDown className="size-3"/>
                        {loadingMore ? '加载中...' : extraDays > 0 ? `已加载近 ${14 + extraDays} 天，点击加载更多` : '加载更多历史数据'}
                    </Button>
                </div>
            )}
        </ReportShell>
    );
};

export const AtomicReportTable: React.FC = () => {
    return (
        <ReportShell loading={false} total={0}>
            <div className="py-12 text-center">
                <Empty>
                    <EmptyMedia variant="icon">
                        <Inbox/>
                    </EmptyMedia>
                    <EmptyTitle>原子日报表</EmptyTitle>
                    <p className="text-sm text-muted-foreground mt-2">数据接入中，敬请期待</p>
                </Empty>
            </div>
        </ReportShell>
    );
};
