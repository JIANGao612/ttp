import React from 'react';
import {Inbox, ArrowUp, ArrowDown, ArrowUpDown, Loader2} from 'lucide-react';
import type {SortDirection} from '@client/src/hooks/use-sort';
import {
    TableHead,
    TableCell,
} from '@client/src/components/ui/table';
import {Skeleton} from '@client/src/components/ui/skeleton';
import {Empty, EmptyMedia, EmptyTitle} from '@client/src/components/ui/empty';
import type {ReportBaseFields} from '@shared/api.interface';
import {cn} from '@/lib/utils';

import {fmtInt, fmtRate, fmtCtr, fmtDateYMD} from '@shared/format-utils';

export {fmtInt, fmtRate, fmtCtr, fmtDateYMD};

export const METRIC_FIELDS = [
    'totalCost', 'totalImpressions', 'totalClicks', 'totalConversions',
    'cpa', 'cpm', 'ctr',
] as const;

export const Th: React.FC<{
    children: React.ReactNode;
    className?: string;
    style?: React.CSSProperties;
    resizable?: boolean;
    onResizeStart?: (clientX: number) => void;
    sortable?: boolean;
    sortDirection?: SortDirection | null;
    onSort?: () => void;
}> = ({children, className, style, resizable, onResizeStart, sortable, sortDirection, onSort}) => (
    <TableHead
        className={cn(
            'sticky top-0 z-10 bg-accent text-xs uppercase tracking-wider whitespace-nowrap text-left',
            className,
        )}
        style={style}
    >
        <div className="flex items-center gap-1.5">
            {children}
            {sortable && (
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        onSort?.();
                    }}
                    className="inline-flex items-center hover:text-primary transition-colors"
                >
                    {sortDirection === 'asc'
                        ? <ArrowUp className="w-3.5 h-3.5 text-primary"/>
                        : sortDirection === 'desc'
                            ? <ArrowDown className="w-3.5 h-3.5 text-primary"/>
                            : <ArrowUpDown className="w-3.5 h-3.5 text-muted-foreground/50"/>}
                </button>
            )}
        </div>
        {resizable && onResizeStart && (
            <div
                className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize select-none hover:bg-primary/60 active:bg-primary transition-colors"
                onMouseDown={(e: React.MouseEvent) => {
                    e.preventDefault();
                    e.stopPropagation();
                    onResizeStart(e.clientX);
                }}
            />
        )}
    </TableHead>
);

export const Td: React.FC<{
    children: React.ReactNode;
    mono?: boolean;
    className?: string;
    title?: string;
    style?: React.CSSProperties;
    onDoubleClick?: () => void;
}> = ({children, mono, className, title, style, onDoubleClick}) => (
    <TableCell
        title={title}
        onDoubleClick={onDoubleClick}
        className={cn('bg-card', mono ? 'tabular-nums text-xs text-left' : 'text-xs text-left', className)}
        style={{
            fontFamily:
                '"Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif',
            ...style,
        }}
    >
        {children}
    </TableCell>
);

export const SummaryTd: React.FC<{
    children: React.ReactNode;
    mono?: boolean;
    className?: string;
    style?: React.CSSProperties;
    colSpan?: number;
    zIndex?: number;
}> = ({children, mono, className, style, colSpan, zIndex}) => (
    <TableCell
        colSpan={colSpan}
        className={cn(
            'sticky bottom-0 z-[5] border-t border-border bg-blue-50 text-xs font-semibold text-blue-800',
            mono ? 'tabular-nums text-left' : 'text-left',
            className,
        )}
        style={{
            fontFamily:
                '"Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif',
            ...(zIndex !== undefined ? {zIndex} : {}),
            ...style,
        }}
    >
        {children}
    </TableCell>
);

export function MetricColumns({
                                  row,
                                  startIndex = 0,
                                  widths,
                              }: {
    row: ReportBaseFields;
    startIndex?: number;
    widths?: number[];
}) {
    const styleFor = (offset: number) =>
        widths
            ? {width: widths[startIndex + offset], maxWidth: widths[startIndex + offset]}
            : undefined;
    return (
        <>
            <Td mono style={styleFor(0)}>{fmtInt(row.totalCost)}</Td>
            <Td mono style={styleFor(1)}>{fmtInt(row.totalImpressions)}</Td>
            <Td mono style={styleFor(2)}>{fmtInt(row.totalClicks)}</Td>
            <Td mono style={styleFor(3)}>{fmtInt(row.totalConversions)}</Td>
            <Td mono style={styleFor(4)}>{fmtRate(row.cpa)}</Td>
            <Td mono style={styleFor(5)}>{fmtRate(row.cpm)}</Td>
            <Td mono style={styleFor(6)}>{fmtCtr(row.ctr)}</Td>
        </>
    );
}

export function MetricHeaders({
                                  widths,
                                  startIndex,
                                  startResize,
                                  colCount,
                                  sortField,
                                  sortOrder,
                                  onSort,
                              }: {
    widths: number[];
    startIndex: number;
    startResize: (index: number, clientX: number) => void;
    colCount: number;
    sortField?: string | null;
    sortOrder?: SortDirection;
    onSort?: (field: string) => void;
}) {
    const labels = ['消耗', '展示', '点击', '付费量', 'CPA', 'CPM', 'CTR'];
    const mk = (offset: number) => {
        const i = startIndex + offset;
        return {
            style: {width: widths[i], minWidth: widths[i]},
            resizable: i < colCount - 1,
            onResizeStart: i < colCount - 1 ? (x: number) => startResize(i, x) : undefined,
        } as { style: React.CSSProperties; resizable?: boolean; onResizeStart?: (x: number) => void };
    };
    return (
        <>
            {labels.map((label, i) => (
                <Th
                    key={i}
                    {...mk(i)}
                    sortable={!!onSort}
                    sortDirection={sortField === METRIC_FIELDS[i] ? (sortOrder ?? null) : null}
                    onSort={onSort ? () => onSort(METRIC_FIELDS[i]) : undefined}
                >
                    {label}
                </Th>
            ))}
        </>
    );
}

export const ReportShell: React.FC<{
    loading: boolean;
    total: number;
    children: React.ReactNode;
}> = ({loading, total, children}) => {
    if (loading && total === 0) {
        return (
            <div className="space-y-2 py-4">
                {Array.from({length: 6}).map((_, i) => (
                    <Skeleton key={i} className="h-8 w-full"/>
                ))}
            </div>
        );
    }
    if (!loading && total === 0) {
        return (
            <Empty className="py-12">
                <EmptyMedia variant="icon">
                    <Inbox/>
                </EmptyMedia>
                <EmptyTitle>暂无数据</EmptyTitle>
            </Empty>
        );
    }
    return (
        <div className="relative">
            {loading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60">
                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground"/>
                </div>
            )}
            {children}
        </div>
    );
};
