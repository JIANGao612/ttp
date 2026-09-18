import React, {useMemo, useState, useCallback, useEffect, useRef} from 'react';
import {ChevronDown} from 'lucide-react';
import {toast} from 'sonner';
import {logger} from '@client/src/utils/logger';
import {getCountryReport} from '@client/src/api/ad-data';
import {getActiveCountries, getReportCountries, type ReportCountryItem} from '@client/src/api/country-registry';
import type {AdDataFilterParams, CountryReportRow} from '@shared/api.interface';
import Spreadsheet from '@client/src/components/spreadsheet/Spreadsheet';
import type {MergeCell, CellStyle, SheetData, CellData} from '@client/src/components/spreadsheet/types';
import {exportSheetToExcel} from '@client/src/utils/export-excel';
import {SelectionStatsBar} from '@client/src/components/spreadsheet/SelectionStatsBar';
import {Button} from '@client/src/components/ui/button';
import {useLoadMore} from '../../shared/use-load-more';
import {useRegisterExport} from '../../shared/DashboardContext';
import {getCountryDisplayCode} from '@shared/country-utils';
import {useViewState} from '@client/src/hooks/use-view-state';
import {useColumnWidths} from '@client/src/hooks/use-column-widths';
import ColumnSettingsButton, {type ColumnSettingItem} from '../components/ColumnSettingsButton';

const FIXED_COLS = 3;
const HEADER_ROWS = 3;
const HEADER_BG = '#eff6ff';
const MONO_FONT = '"Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif';
const TOTAL_COLOR = '#1d4ed8';
const SUMMARY_ROWS = 1;

function getRegionColor(col: number, regionGroups: Array<{
    startCol: number;
    colSpan: number;
    color: string;
}>): string {
    for (const g of regionGroups) {
        if (col >= g.startCol && col < g.startCol + g.colSpan) return g.color;
    }
    return '';
}

function fmtCurrency(v: number): string {
    if (v === 0) return '$0';
    return '$' + Math.round(v).toLocaleString('en-US');
}

function formatDate(d: string): string {
    const parts = d.split('-');
    if (parts.length !== 3) return d;
    return `${parseInt(parts[0], 10)}/${String(parseInt(parts[1], 10)).padStart(2, '0')}/${String(parseInt(parts[2], 10)).padStart(2, '0')}`;
}

/** 1=周一 ... 7=周日 */
function getWeekday(dateStr: string): number {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    return day === 0 ? 7 : day;
}

function generateDateRange(minDate: string, maxDate: string): string[] {
    const dates: string[] = [];
    const start = new Date(minDate + 'T00:00:00');
    const end = new Date(maxDate + 'T00:00:00');
    const cur = new Date(start);
    while (cur <= end) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, '0');
        const d = String(cur.getDate()).padStart(2, '0');
        dates.push(`${y}-${m}-${d}`);
        cur.setDate(cur.getDate() + 1);
    }
    return dates;
}

const CountryDailyReport: React.FC<{ filters: AdDataFilterParams }> = ({filters}) => {
    const [rawData, setRawData] = useState<CountryReportRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [dataVersion, setDataVersion] = useState(0);
    const [pausedCountrySet, setPausedCountrySet] = useState<Set<string> | null>(null);
    const [reportCountries, setReportCountries] = useState<ReportCountryItem[]>([]);
    const {extendedFilters, extraDays, loadMore, canLoadMore} = useLoadMore(filters);
    const {viewState, updateViewState, markReady, resetViewState} = useViewState('country-daily-report');
    const readyRef = useRef(false);
    const [colSettingsKey, setColSettingsKey] = useState(0);
    const [resetting, setResetting] = useState(false);

    useEffect(() => {
        if (viewState && !readyRef.current) {
            readyRef.current = true;
            const t = setTimeout(markReady, 1000);
            return () => clearTimeout(t);
        }
    }, [viewState, markReady]);

    useEffect(() => {
        getReportCountries()
            .then((res) => {
                setReportCountries(res.countries);
            })
            .catch((err) => {
                logger.error('Failed to load countries:', err);
            });
    }, []);

    const COUNTRY_COUNT = reportCountries.length;
    const TOTAL_COLS = useMemo(() => FIXED_COLS + COUNTRY_COUNT, [COUNTRY_COUNT]);

    const REGION_GROUPS = useMemo(() => {
        const groups: Array<{ name: string; startCol: number; colSpan: number; color: string }> = [];
        let i = 0;
        while (i < reportCountries.length) {
            const region = reportCountries[i].region;
            const color = reportCountries[i].regionColor;
            let j = i + 1;
            while (j < reportCountries.length && reportCountries[j].region === region) j++;
            groups.push({
                name: region,
                startCol: FIXED_COLS + i,
                colSpan: j - i,
                color,
            });
            i = j;
        }
        return groups;
    }, [reportCountries]);

    const fetchData = useCallback(async (f: AdDataFilterParams, isLoadMore: boolean) => {
        if (isLoadMore) setLoadingMore(true);
        else setLoading(true);
        try {
            const {data} = await getCountryReport(f);
            setRawData(data.items);
            setDataVersion((v) => v + 1);
        } catch (err) {
            logger.error('Failed to load country report:', err);
            setRawData([]);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, []);

    useEffect(() => {
        void fetchData(extendedFilters, extraDays > 0);
    }, [fetchData, extendedFilters]);

    const refreshRegistryPausedCols = useCallback(() => {
        void getActiveCountries()
            .then((res) => {
                const pausedCodes = new Set(res.pausedCountries ?? []);
                setPausedCountrySet(pausedCodes);
            })
            .catch(() => {
                // ignore
            });
    }, []);

    useEffect(() => {
        refreshRegistryPausedCols();
    }, [refreshRegistryPausedCols]);

    useEffect(() => {
        const handler = () => {
            refreshRegistryPausedCols();
            setColSettingsKey((k) => k + 1);
        };
        window.addEventListener('country-registry-status-changed', handler);
        return () => window.removeEventListener('country-registry-status-changed', handler);
    }, [refreshRegistryPausedCols]);

    useEffect(() => {
        if (pausedCountrySet) setColSettingsKey((k) => k + 1);
    }, [pausedCountrySet]);

    const {dateList, costMatrix, dateTotalMap} = useMemo(() => {
        if (rawData.length === 0) {
            return {
                dateList: [] as string[],
                costMatrix: new Map<string, number>(),
                dateTotalMap: new Map<string, number>(),
            };
        }
        const dates = new Set<string>();
        const matrix = new Map<string, number>();
        const totalMap = new Map<string, number>();
        for (const row of rawData) {
            dates.add(row.date);
            matrix.set(`${row.date}|${row.country}`, row.totalCost);
            totalMap.set(row.date, (totalMap.get(row.date) || 0) + row.totalCost);
        }
        const sortedDates = Array.from(dates).sort();
        const fullDates = generateDateRange(sortedDates[0], sortedDates[sortedDates.length - 1]);
        return {dateList: fullDates, costMatrix: matrix, dateTotalMap: totalMap};
    }, [rawData]);

    const effectiveHiddenCols = useMemo(() => {
        if (!viewState) return undefined;
        const userHidden = new Set(viewState.hiddenCountryCodes ?? []);
        const explicitShow = new Set(viewState.explicitShowCodes ?? []);
        const hidden: number[] = [];
        reportCountries.forEach((c, i) => {
            const col = FIXED_COLS + i;
            const isPaused = pausedCountrySet?.has(c.code);
            if (isPaused) {
                if (!explicitShow.has(c.code)) hidden.push(col);
            } else if (userHidden.has(c.code)) {
                hidden.push(col);
            }
        });
        return hidden.length > 0 ? hidden : undefined;
    }, [viewState, pausedCountrySet, reportCountries]);

    const columnItems: ColumnSettingItem[] = useMemo(() => {
        const active: ColumnSettingItem[] = [];
        const paused: ColumnSettingItem[] = [];
        reportCountries.forEach((c, i) => {
            const col = FIXED_COLS + i;
            const item: ColumnSettingItem = {
                label: `${c.name} (${getCountryDisplayCode(c.code)})`,
                colIndices: [col],
            };
            if (pausedCountrySet?.has(c.code)) {
                item.tag = '已暂停';
                item.group = '已暂停国家';
                paused.push(item);
            } else {
                item.group = '投放中';
                active.push(item);
            }
        });
        return [...active, ...paused];
    }, [pausedCountrySet, reportCountries]);

    const handleToggleCol = useCallback(
        (colIndices: number[]) => {
            const colToCode = new Map<number, string>();
            reportCountries.forEach((c, i) => colToCode.set(FIXED_COLS + i, c.code));
            const targetCodes = colIndices.map((c) => colToCode.get(c)!).filter(Boolean);
            const userHidden = new Set(viewState?.hiddenCountryCodes ?? []);
            const explicitShow = new Set(viewState?.explicitShowCodes ?? []);
            const isHidden = targetCodes.every((code) => {
                if (pausedCountrySet?.has(code)) return !explicitShow.has(code);
                return userHidden.has(code);
            });
            const currentHidden = new Set(userHidden);
            const currentExplicit = new Set(explicitShow);
            if (isHidden) {
                for (const code of targetCodes) {
                    currentHidden.delete(code);
                    if (pausedCountrySet?.has(code)) currentExplicit.add(code);
                    else currentExplicit.delete(code);
                }
            } else {
                for (const code of targetCodes) {
                    if (pausedCountrySet?.has(code)) {
                        currentExplicit.delete(code);
                    } else {
                        currentHidden.add(code);
                    }
                }
            }
            updateViewState({
                hiddenCountryCodes: Array.from(currentHidden),
                explicitShowCodes: Array.from(currentExplicit),
            });
            setColSettingsKey((k) => k + 1);
        },
        [viewState, updateViewState, pausedCountrySet, reportCountries],
    );

    const handleShowAll = useCallback(() => {
        const allPaused = pausedCountrySet ? Array.from(pausedCountrySet) : [];
        updateViewState({hiddenCountryCodes: [], explicitShowCodes: allPaused});
        setColSettingsKey((k) => k + 1);
    }, [updateViewState, pausedCountrySet]);

    const handleReset = useCallback(() => {
        resetViewState();
        updateViewState({hiddenCountryCodes: [], explicitShowCodes: []});
        setColSettingsKey((k) => k + 1);
        toast.success('已恢复默认设置');
    }, [resetViewState, updateViewState]);

    const handleStateChange = useCallback(
        (s: { hiddenCols: number[]; hiddenRows: number[] }) => {
            const hiddenCountryCodes: string[] = [];
            reportCountries.forEach((c, i) => {
                const colIdx = FIXED_COLS + i;
                if (s.hiddenCols.includes(colIdx) && !pausedCountrySet?.has(c.code)) {
                    hiddenCountryCodes.push(c.code);
                }
            });
            updateViewState({...s, hiddenCountryCodes});
        },
        [updateViewState, reportCountries, pausedCountrySet],
    );

    const totalRows = HEADER_ROWS + dateList.length + SUMMARY_ROWS;

    const colWidths = useMemo<number[]>(() => {
        const w: number[] = [110, 60, 100];
        for (let i = 0; i < COUNTRY_COUNT; i++) w.push(85);
        return w;
    }, [COUNTRY_COUNT]);

    const {
        widths: savedColWidths,
        handleResizeEnd,
        reset: resetColWidths,
    } = useColumnWidths(colWidths, 'country-daily-report');

    const rowHeights = useMemo<number[]>(() => {
        const h: number[] = [];
        for (let i = 0; i < HEADER_ROWS; i++) h.push(28);
        for (let i = 0; i < dateList.length; i++) h.push(26);
        for (let i = 0; i < SUMMARY_ROWS; i++) h.push(28);
        return h;
    }, [dateList.length]);

    const merges = useMemo<MergeCell[]>(() => {
        const m: MergeCell[] = [
            {row: 0, col: 0, rowSpan: 3, colSpan: 1},
            {row: 0, col: 1, rowSpan: 3, colSpan: 1},
            {row: 0, col: 2, rowSpan: 3, colSpan: 1},
        ];
        for (const g of REGION_GROUPS) {
            m.push({row: 2, col: g.startCol, rowSpan: 1, colSpan: g.colSpan});
        }
        return m;
    }, [REGION_GROUPS]);

    const initialData = useMemo(() => {
        const data: { row: number; col: number; value: string; style?: CellStyle }[] = [];
        const colHeaderStyle: CellStyle = {align: 'center', bold: true, bgColor: HEADER_BG};

        data.push({row: 0, col: 0, value: '时间/国家', style: colHeaderStyle});
        data.push({row: 0, col: 1, value: '星期', style: colHeaderStyle});
        data.push({row: 0, col: 2, value: '总计', style: colHeaderStyle});

        for (let i = 0; i < COUNTRY_COUNT; i++) {
            const col = FIXED_COLS + i;
            const style: CellStyle = {
                align: 'center',
                bold: true,
                bgColor: getRegionColor(col, REGION_GROUPS),
            };
            data.push({row: 0, col, value: reportCountries[i].name, style});
            data.push({row: 1, col, value: getCountryDisplayCode(reportCountries[i].code), style});
        }

        for (const g of REGION_GROUPS) {
            data.push({
                row: 2,
                col: g.startCol,
                value: g.name,
                style: {align: 'center', bold: true, bgColor: g.color},
            });
        }

        const totalStyle: CellStyle = {bold: true, color: TOTAL_COLOR, align: 'center', fontFamily: MONO_FONT};
        const countryStyle: CellStyle = {align: 'center', fontFamily: MONO_FONT};
        const dateStyle: CellStyle = {align: 'center'};
        const weekdayStyle: CellStyle = {align: 'center'};

        for (let r = 0; r < dateList.length; r++) {
            const row = HEADER_ROWS + r;
            const date = dateList[r];
            data.push({row, col: 0, value: formatDate(date), style: dateStyle});
            data.push({row, col: 1, value: String(getWeekday(date)), style: weekdayStyle});

            const sum = dateTotalMap.get(date) || 0;
            data.push({row, col: 2, value: fmtCurrency(sum), style: totalStyle});

            for (let i = 0; i < COUNTRY_COUNT; i++) {
                const col = FIXED_COLS + i;
                const cost = costMatrix.get(`${date}|${reportCountries[i].code}`) || 0;
                data.push({row, col, value: fmtCurrency(cost), style: countryStyle});
            }
        }

        const summaryRow = HEADER_ROWS + dateList.length;
        const summaryLabelStyle: CellStyle = {bold: true, align: 'center', bgColor: HEADER_BG};
        const summaryValueStyle: CellStyle = {
            bold: true,
            color: TOTAL_COLOR,
            align: 'center',
            fontFamily: MONO_FONT,
        };
        data.push({row: summaryRow, col: 0, value: '汇总', style: summaryLabelStyle});
        data.push({row: summaryRow, col: 1, value: '', style: summaryLabelStyle});
        let grandTotal = 0;
        for (const date of dateList) grandTotal += dateTotalMap.get(date) || 0;
        for (let i = 0; i < COUNTRY_COUNT; i++) {
            let colSum = 0;
            for (const date of dateList) colSum += costMatrix.get(`${date}|${reportCountries[i].code}`) || 0;
            data.push({
                row: summaryRow,
                col: FIXED_COLS + i,
                value: fmtCurrency(colSum),
                style: summaryValueStyle,
            });
        }
        data.push({row: summaryRow, col: 2, value: fmtCurrency(grandTotal), style: summaryValueStyle});

        return data;
    }, [dateList, costMatrix, dateTotalMap, reportCountries, REGION_GROUPS]);

    const handleExport = useCallback(async (): Promise<number> => {
        const cells = new Map<string, CellData>();
        for (const c of initialData) {
            cells.set(`${c.row},${c.col}`, {value: c.value, style: c.style});
        }
        const sheetData: SheetData = {rows: totalRows, cols: TOTAL_COLS, cells, merges};
        const hiddenRows: number[] = viewState?.hiddenRows ?? [];
        await exportSheetToExcel(sheetData, {
            fileName: `国家日报_${new Date().toISOString().slice(0, 10)}.xlsx`,
            hiddenRows,
            hiddenCols: effectiveHiddenCols,
        });
        return totalRows - hiddenRows.length - HEADER_ROWS;
    }, [initialData, merges, totalRows, TOTAL_COLS, viewState, effectiveHiddenCols]);

    useRegisterExport(handleExport);

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                加载中...
            </div>
        );
    }

    if (dateList.length === 0) {
        return (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                暂无数据
            </div>
        );
    }

    return (
        <div>
            <Spreadsheet
                key={`daily-${dataVersion}-${colSettingsKey}`}
                initialRows={totalRows}
                initialCols={TOTAL_COLS}
                initialData={initialData}
                initialMerges={merges}
                colWidths={savedColWidths}
                rowHeights={rowHeights}
                frozenRows={HEADER_ROWS}
                frozenCols={FIXED_COLS}
                bottomFrozenRows={SUMMARY_ROWS}
                hideToolbar
                showAddRows={false}
                initialHiddenCols={effectiveHiddenCols}
                initialHiddenRows={viewState?.hiddenRows}
                initialScrollLeft={viewState?.scrollLeft ?? 0}
                initialScrollTop={viewState?.scrollTop ?? 0}
                onStateChange={handleStateChange}
                onScrollChange={(s) => updateViewState(s)}
                onColumnResizeEnd={handleResizeEnd}
            />
            <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <SelectionStatsBar/>
                    <span className="text-xs text-muted-foreground">
            共 {dateList.length} 天 · {COUNTRY_COUNT} 个国家
          </span>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => {
                            resetColWidths();
                            window.location.reload();
                        }}
                    >
                        重置列宽
                    </Button>
                    <ColumnSettingsButton
                        items={columnItems}
                        hiddenCols={effectiveHiddenCols ?? []}
                        onToggle={handleToggleCol}
                        onShowAll={handleShowAll}
                        onReset={handleReset}
                        resetting={resetting}
                    />
                    {canLoadMore && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs text-muted-foreground"
                            onClick={loadMore}
                            disabled={loadingMore}
                        >
                            <ChevronDown className="size-3"/>
                            {loadingMore
                                ? '加载中...'
                                : extraDays > 0
                                    ? `已加载近 ${14 + extraDays} 天，点击加载更多`
                                    : '加载更多历史数据'}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CountryDailyReport;