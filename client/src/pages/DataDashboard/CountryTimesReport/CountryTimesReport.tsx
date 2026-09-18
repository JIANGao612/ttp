import React, {useMemo, useState, useCallback, useEffect, useRef} from 'react';
import {ChevronDown, AlertTriangle} from 'lucide-react';
import {toast} from 'sonner';
import {logger} from '@client/src/utils/logger';
import {getCountryTimesReport} from '@client/src/api/ad-data';
import {
    getActiveCountries,
    getReportCountries,
    getAllCountries,
    type ReportCountryItem
} from '@client/src/api/country-registry';
import type {AdDataFilterParams, CountryTimesReportRow} from '@shared/api.interface';
import Spreadsheet from '@client/src/components/spreadsheet/Spreadsheet';
import type {MergeCell, CellStyle, SheetData, CellData} from '@client/src/components/spreadsheet/types';
import {exportSheetToExcel} from '@client/src/utils/export-excel';
import {Button} from '@client/src/components/ui/button';
import {Dialog, DialogContent, DialogHeader, DialogTitle} from '@client/src/components/ui/dialog';
import {useLoadMore} from '../../shared/use-load-more';
import {useRegisterExport} from '../../shared/DashboardContext';
import {SelectionStatsBar} from '@client/src/components/spreadsheet/SelectionStatsBar';

import {getCountryDisplayCode} from '@shared/country-utils';
import {useViewState} from '@client/src/hooks/use-view-state';
import {useColumnWidths} from '@client/src/hooks/use-column-widths';
import {formatLocalDate} from '@client/src/pages/shared/default-date-range';
import ColumnSettingsButton, {type ColumnSettingItem} from '../components/ColumnSettingsButton';

const FIXED_COLS = 4;
const HEADER_ROWS = 2;
const HEADER_BG = '#eff6ff';
const MONO_FONT = '"Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif';
const TOTAL_COLOR = '#1d4ed8';
const SUMMARY_ROWS = 1;

function getRegionColor(col: number, regionGroups: Array<{
    startCol: number;
    colSpan: number;
    color: string
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

function fmtPct(v: number): string {
    if (!isFinite(v)) return '—';
    const pct = v * 100;
    const sign = pct > 0 ? '+' : '';
    return `${sign}${pct.toFixed(2)}%`;
}

function formatDate(d: string): string {
    const parts = d.split('-');
    if (parts.length !== 3) return d;
    return `${parseInt(parts[0], 10)}/${String(parseInt(parts[1], 10)).padStart(2, '0')}/${String(parseInt(parts[2], 10)).padStart(2, '0')}`;
}

function getWeekday(dateStr: string): number {
    const d = new Date(dateStr + 'T00:00:00');
    const day = d.getDay();
    return day === 0 ? 7 : day;
}

function addDays(dateStr: string, delta: number): string {
    const d = new Date(dateStr + 'T00:00:00');
    d.setDate(d.getDate() + delta);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
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

const TIME_SLOTS: Array<'12:00' | '16:00' | '22:00' | '24:00'> = ['12:00', '16:00', '22:00', '24:00'];

const CountryTimesReport: React.FC<{ filters: AdDataFilterParams }> = ({filters}) => {
    const [rawData, setRawData] = useState<CountryTimesReportRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [dataVersion, setDataVersion] = useState(0);
    const [registryPausedCols, setRegistryPausedCols] = useState<number[]>([]);
    const [pausedCountrySet, setPausedCountrySet] = useState<Set<string> | null>(null);
    const [reportCountries, setReportCountries] = useState<ReportCountryItem[]>([]);
    const {
        extendedFilters,
        extraDays,
        loadMore,
        canLoadMore,
        reset,
        showReset
    } = useLoadMore(filters, {defaultDays: 7});
    const {viewState, updateViewState, markReady, hasSavedState, resetViewState} = useViewState('country-times-report');
    const readyRef = useRef(false);
    const [colSettingsKey, setColSettingsKey] = useState(0);
    const [resetting, setResetting] = useState(false);
    const [anomalyDialogOpen, setAnomalyDialogOpen] = useState(false);
    const [anomalySelectedDate, setAnomalySelectedDate] = useState<string | null>(null);

    useEffect(() => {
        if (viewState && !readyRef.current) {
            readyRef.current = true;
            const t = setTimeout(markReady, 1000);
            return () => clearTimeout(t);
        }
    }, [viewState, markReady]);

    useEffect(() => {
        Promise.all([getReportCountries(), getAllCountries()]).then(([reportRes, allRes]) => {
            setReportCountries(reportRes.countries);
            const pausedSet = new Set<string>();
            allRes.countries.filter((c) => c.status === '已暂停').forEach((c) => pausedSet.add(c.code));
            setPausedCountrySet(pausedSet);
        }).catch(err => {
            logger.error('Failed to load countries:', err);
        });
    }, []);

    const countryCount = reportCountries.length;
    const dataCols = countryCount * 3;
    const totalCols = FIXED_COLS + dataCols;

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
                startCol: FIXED_COLS + i * 3,
                colSpan: (j - i) * 3,
                color,
            });
            i = j;
        }
        return groups;
    }, [reportCountries]);

    const fetchData = useCallback(async (f: AdDataFilterParams, isLoadMore: boolean) => {
        if (isLoadMore) setLoadingMore(true); else setLoading(true);
        try {
            const {data} = await getCountryTimesReport(f);
            setRawData(data.items);
            setDataVersion((v) => v + 1);
        } catch (err) {
            logger.error('Failed to load country times report:', err);
            setRawData([]);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }, []);

    const todayStr = useMemo(() => formatLocalDate(new Date()), []);

    const queryFilters = useMemo<AdDataFilterParams>(() => {
        if (!extendedFilters.investTimeEnd) return extendedFilters;
        if (extendedFilters.investTimeEnd >= todayStr) return extendedFilters;
        return {...extendedFilters, investTimeEnd: todayStr};
    }, [extendedFilters, todayStr]);

    useEffect(() => {
        void fetchData(queryFilters, extraDays > 0);
    }, [fetchData, queryFilters]);

    const refreshRegistryPausedCols = useCallback(() => {
        void getActiveCountries().then((res) => {
            const pausedCodes = new Set(res.pausedCountries ?? []);
            setPausedCountrySet(pausedCodes);
            const paused: number[] = [];
            reportCountries.forEach((c, i) => {
                if (pausedCodes.has(c.code)) {
                    const colBase = FIXED_COLS + i * 3;
                    paused.push(colBase, colBase + 1, colBase + 2);
                }
            });
            setRegistryPausedCols(paused);
        }).catch(() => {
        });
    }, [reportCountries]);

    useEffect(() => {
        refreshRegistryPausedCols();
    }, [refreshRegistryPausedCols]);

    useEffect(() => {
        const handler = () => {
            refreshRegistryPausedCols();
            setColSettingsKey(k => k + 1);
        };
        window.addEventListener('country-registry-status-changed', handler);
        return () => window.removeEventListener('country-registry-status-changed', handler);
    }, [refreshRegistryPausedCols]);

    useEffect(() => {
        if (pausedCountrySet) setColSettingsKey(k => k + 1);
    }, [pausedCountrySet]);

    const {dateList, costMatrix, bidMatrix, dateSlotTotalMap} = useMemo(() => {
        if (rawData.length === 0) {
            return {
                dateList: [] as string[],
                costMatrix: new Map<string, number>(),
                bidMatrix: new Map<string, { ccRatio: number; lcRatio: number }>(),
                dateSlotTotalMap: new Map<string, number>()
            };
        }
        const dates = new Set<string>();
        const matrix = new Map<string, number>();
        const bMatrix = new Map<string, { ccRatio: number; lcRatio: number }>();
        const slotTotalMap = new Map<string, number>();
        for (const row of rawData) {
            dates.add(row.date);
            matrix.set(`${row.date}|${row.timeSlot}|${row.country}`, row.totalCost);
            bMatrix.set(`${row.date}|${row.timeSlot}|${row.country}`, {
                ccRatio: row.ccRatio ?? 0,
                lcRatio: row.lcRatio ?? 0
            });
            const slotKey = `${row.date}|${row.timeSlot}`;
            slotTotalMap.set(slotKey, (slotTotalMap.get(slotKey) || 0) + row.totalCost);
        }
        const sortedDates = Array.from(dates).sort();
        const dataMaxDate = sortedDates[sortedDates.length - 1];
        const hasTodayData = dataMaxDate === todayStr;
        const displayEnd = hasTodayData ? todayStr : dataMaxDate;
        const fullDates = generateDateRange(sortedDates[0], displayEnd);
        return {dateList: fullDates, costMatrix: matrix, bidMatrix: bMatrix, dateSlotTotalMap: slotTotalMap};
    }, [rawData, todayStr]);

    interface AnomalyItem {
        country: string;
        timeSlot: string;
        momPct: number;
    }

    const anomalyMap = useMemo(() => {
        const map = new Map<string, AnomalyItem[]>();
        for (const date of dateList) {
            const prevDate = addDays(date, -1);
            const items: AnomalyItem[] = [];
            for (const slot of TIME_SLOTS) {
                for (const c of reportCountries) {
                    const cost = costMatrix.get(`${date}|${slot}|${c.code}`) || 0;
                    const prevCost = costMatrix.get(`${prevDate}|${slot}|${c.code}`) || 0;
                    if (prevCost <= 0 || cost <= 0) continue;
                    const mom = (cost - prevCost) / prevCost;
                    const momPct = mom * 100;
                    if (momPct >= 20 || momPct <= -20) {
                        items.push({country: c.name, timeSlot: slot, momPct: Math.round(momPct * 100) / 100});
                    }
                }
            }
            if (items.length > 0) {
                items.sort((a, b) => {
                    if (a.timeSlot !== b.timeSlot) return a.timeSlot.localeCompare(b.timeSlot);
                    return Math.abs(b.momPct) - Math.abs(a.momPct);
                });
                map.set(date, items);
            }
        }
        return map;
    }, [dateList, costMatrix, reportCountries]);

    const anomalyDates = useMemo(() => Array.from(anomalyMap.keys()).sort(), [anomalyMap]);
    const hasAnyAnomaly = anomalyDates.length > 0;

    const effectiveHiddenCols = useMemo(() => {
        if (!viewState) return undefined;
        const userHidden = new Set(viewState.hiddenCountryCodes ?? []);
        const explicitShow = new Set(viewState.explicitShowCodes ?? []);
        const hidden: number[] = [];
        reportCountries.forEach((c, i) => {
            const colBase = FIXED_COLS + i * 3;
            const isPaused = pausedCountrySet?.has(c.code);
            if (isPaused) {
                if (!explicitShow.has(c.code)) hidden.push(colBase, colBase + 1, colBase + 2);
            } else if (userHidden.has(c.code)) {
                hidden.push(colBase, colBase + 1, colBase + 2);
            }
        });
        return hidden.length > 0 ? hidden : undefined;
    }, [viewState, pausedCountrySet, reportCountries]);

    const columnItems: ColumnSettingItem[] = useMemo(() => {
        const active: ColumnSettingItem[] = [];
        const paused: ColumnSettingItem[] = [];
        reportCountries.forEach((c, i) => {
            const colBase = FIXED_COLS + i * 3;
            const item: ColumnSettingItem = {
                label: `${c.name} (${getCountryDisplayCode(c.code)})`,
                colIndices: [colBase, colBase + 1, colBase + 2],
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

    const handleToggleCol = useCallback((colIndices: number[]) => {
        const colToCode = new Map<number, string>();
        reportCountries.forEach((c, i) => {
            const colBase = FIXED_COLS + i * 3;
            colToCode.set(colBase, c.code);
            colToCode.set(colBase + 1, c.code);
            colToCode.set(colBase + 2, c.code);
        });
        const targetCodes = [...new Set(colIndices.map(c => colToCode.get(c)!).filter(Boolean))];
        const userHidden = new Set(viewState?.hiddenCountryCodes ?? []);
        const explicitShow = new Set(viewState?.explicitShowCodes ?? []);
        const isHidden = targetCodes.every(code => {
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
        setColSettingsKey(k => k + 1);
    }, [viewState, updateViewState, pausedCountrySet, reportCountries]);

    const handleShowAll = useCallback(() => {
        const allPaused = pausedCountrySet ? Array.from(pausedCountrySet) : [];
        updateViewState({hiddenCountryCodes: [], explicitShowCodes: allPaused});
        setColSettingsKey(k => k + 1);
    }, [updateViewState, pausedCountrySet]);

    const handleResetDefault = useCallback(() => {
        reset();
    }, [reset]);

    const handleResetView = useCallback(() => {
        resetViewState();
        updateViewState({hiddenCountryCodes: [], explicitShowCodes: []});
        setColSettingsKey(k => k + 1);
        toast.success('已恢复默认设置');
    }, [resetViewState, updateViewState]);

    const handleStateChange = useCallback((s: { hiddenCols: number[]; hiddenRows: number[] }) => {
        const hiddenCountryCodes: string[] = [];
        const hiddenSet = new Set(s.hiddenCols);
        reportCountries.forEach((c, i) => {
            const colBase = FIXED_COLS + i * 3;
            if (hiddenSet.has(colBase) && !pausedCountrySet?.has(c.code)) hiddenCountryCodes.push(c.code);
        });
        updateViewState({...s, hiddenCountryCodes});
    }, [updateViewState, reportCountries, pausedCountrySet]);

    const dataRowCount = dateList.length * TIME_SLOTS.length;
    const totalRows = HEADER_ROWS + dataRowCount + SUMMARY_ROWS;

    const colWidths = useMemo<number[]>(() => {
        const w: number[] = [100, 50, 70, 100];
        for (let i = 0; i < countryCount; i++) {
            w.push(85, 70, 60);
        }
        return w;
    }, [countryCount]);

    const {
        widths: savedColWidths,
        handleResizeEnd,
        reset: resetColWidths
    } = useColumnWidths(colWidths, 'country-times-report');

    const rowHeights = useMemo<number[]>(() => {
        const h: number[] = [];
        for (let i = 0; i < HEADER_ROWS; i++) h.push(28);
        for (let i = 0; i < dataRowCount; i++) h.push(26);
        for (let i = 0; i < SUMMARY_ROWS; i++) h.push(28);
        return h;
    }, [dataRowCount]);

    const merges = useMemo<MergeCell[]>(() => {
        const m: MergeCell[] = [
            {row: 0, col: 0, rowSpan: 2, colSpan: 1},
            {row: 0, col: 1, rowSpan: 2, colSpan: 1},
            {row: 0, col: 2, rowSpan: 2, colSpan: 1},
            {row: 0, col: 3, rowSpan: 2, colSpan: 1},
        ];
        for (const g of REGION_GROUPS) {
            m.push({row: 0, col: g.startCol, rowSpan: 1, colSpan: g.colSpan});
        }
        return m;
    }, [REGION_GROUPS]);

    const initialData = useMemo(() => {
        const data: { row: number; col: number; value: string; style?: CellStyle }[] = [];
        const colHeaderStyle: CellStyle = {align: 'center', bold: true, bgColor: HEADER_BG};

        data.push({row: 0, col: 0, value: '日期', style: colHeaderStyle});
        data.push({row: 0, col: 1, value: '星期', style: colHeaderStyle});
        data.push({row: 0, col: 2, value: '时间', style: colHeaderStyle});
        data.push({row: 0, col: 3, value: '总计', style: colHeaderStyle});

        for (let i = 0; i < countryCount; i++) {
            const costCol = FIXED_COLS + i * 3;
            const momCol = costCol + 1;
            const ccCol = costCol + 2;
            const style: CellStyle = {align: 'center', bold: true, bgColor: getRegionColor(costCol, REGION_GROUPS)};
            const momStyle: CellStyle = {align: 'center', bold: true, bgColor: getRegionColor(momCol, REGION_GROUPS)};
            const ccStyle: CellStyle = {
                align: 'center',
                bold: true,
                fontSize: 10,
                bgColor: getRegionColor(ccCol, REGION_GROUPS)
            };
            data.push({row: 1, col: costCol, value: getCountryDisplayCode(reportCountries[i].code), style});
            data.push({row: 1, col: momCol, value: '环比', style: momStyle});
            data.push({row: 1, col: ccCol, value: 'CC占比', style: ccStyle});
        }

        for (const g of REGION_GROUPS) {
            data.push({
                row: 0,
                col: g.startCol,
                value: g.name,
                style: {align: 'center', bold: true, bgColor: g.color},
            });
        }

        const totalStyle: CellStyle = {bold: true, color: TOTAL_COLOR, align: 'center', fontFamily: MONO_FONT};
        const countryStyle: CellStyle = {align: 'center', fontFamily: MONO_FONT};
        const momStyleNeg: CellStyle = {align: 'center', fontFamily: MONO_FONT, color: '#dc2626'};
        const dateStyle: CellStyle = {align: 'center'};
        const weekdayStyle: CellStyle = {align: 'center'};
        const timeStyle: CellStyle = {align: 'center'};

        for (let r = 0; r < dateList.length; r++) {
            const date = dateList[r];
            const prevDate = addDays(date, -1);
            const dateRowIdx = HEADER_ROWS + r * TIME_SLOTS.length;

            for (let s = 0; s < TIME_SLOTS.length; s++) {
                const row = dateRowIdx + s;
                const slot = TIME_SLOTS[s];

                if (s === 0) {
                    data.push({row, col: 0, value: formatDate(date), style: dateStyle});
                    data.push({row, col: 1, value: String(getWeekday(date)), style: weekdayStyle});
                } else {
                    data.push({row, col: 0, value: '', style: dateStyle});
                    data.push({row, col: 1, value: '', style: weekdayStyle});
                }
                data.push({row, col: 2, value: slot, style: timeStyle});

                let sum = 0;
                for (const row of rawData) {
                    if (row.date === date && row.timeSlot === slot) sum += row.totalCost;
                }
                data.push({row, col: 3, value: fmtCurrency(sum), style: totalStyle});

                for (let i = 0; i < countryCount; i++) {
                    const costCol = FIXED_COLS + i * 3;
                    const momCol = costCol + 1;
                    const ccCol = costCol + 2;
                    const cost = costMatrix.get(`${date}|${slot}|${reportCountries[i].code}`) || 0;
                    data.push({row, col: costCol, value: fmtCurrency(cost), style: countryStyle});

                    const prevCost = costMatrix.get(`${prevDate}|${slot}|${reportCountries[i].code}`) || 0;
                    if (prevCost > 0) {
                        const mom = (cost - prevCost) / prevCost;
                        const style = mom < 0 ? momStyleNeg : countryStyle;
                        data.push({row, col: momCol, value: fmtPct(mom), style});
                    } else {
                        data.push({row, col: momCol, value: '—', style: countryStyle});
                    }

                    const bid = bidMatrix.get(`${date}|${slot}|${reportCountries[i].code}`) || {ccRatio: 0, lcRatio: 0};
                    const ccStyle: CellStyle = {align: 'center', fontFamily: MONO_FONT, fontSize: 10};
                    data.push({
                        row,
                        col: ccCol,
                        value: bid.ccRatio > 0 ? `${bid.ccRatio.toFixed(1)}%` : '—',
                        style: ccStyle
                    });
                }
            }
        }

        // 汇总行
        const summaryRow = HEADER_ROWS + dataRowCount;
        const summaryLabelStyle: CellStyle = {bold: true, align: 'center', bgColor: HEADER_BG};
        const summaryValueStyle: CellStyle = {bold: true, color: TOTAL_COLOR, align: 'center', fontFamily: MONO_FONT};
        const summaryEmptyStyle: CellStyle = {align: 'center', bgColor: HEADER_BG, color: '#94a3b8'};
        data.push({row: summaryRow, col: 0, value: '汇总', style: summaryLabelStyle});
        data.push({row: summaryRow, col: 1, value: '', style: summaryLabelStyle});
        data.push({row: summaryRow, col: 2, value: '', style: summaryLabelStyle});
        let grandTotal = 0;
        for (const date of dateList) {
            for (const slot of TIME_SLOTS) {
                grandTotal += dateSlotTotalMap.get(`${date}|${slot}`) || 0;
            }
        }
        for (let i = 0; i < countryCount; i++) {
            let colSum = 0;
            for (const date of dateList) {
                for (const slot of TIME_SLOTS) {
                    colSum += costMatrix.get(`${date}|${slot}|${reportCountries[i].code}`) || 0;
                }
            }
            grandTotal += colSum;
            const costCol = FIXED_COLS + i * 3;
            data.push({row: summaryRow, col: costCol, value: fmtCurrency(colSum), style: summaryValueStyle});
            data.push({row: summaryRow, col: costCol + 1, value: '—', style: summaryEmptyStyle});
            data.push({row: summaryRow, col: costCol + 2, value: '—', style: summaryEmptyStyle});
        }
        data.push({row: summaryRow, col: 3, value: fmtCurrency(grandTotal), style: summaryValueStyle});

        return data;
    }, [dateList, costMatrix, bidMatrix, dateSlotTotalMap, rawData, reportCountries, REGION_GROUPS, countryCount]);

    const handleExport = useCallback(async (): Promise<number> => {
        const cells = new Map<string, CellData>();
        for (const c of initialData) {
            cells.set(`${c.row},${c.col}`, {value: c.value, style: c.style});
        }
        const sheetData: SheetData = {rows: totalRows, cols: totalCols, cells, merges};
        const hiddenRows: number[] = viewState?.hiddenRows ?? [];
        await exportSheetToExcel(sheetData, {
            fileName: `国家时报_${new Date().toISOString().slice(0, 10)}.xlsx`,
            hiddenRows,
            hiddenCols: effectiveHiddenCols,
        });
        return totalRows - hiddenRows.length - HEADER_ROWS;
    }, [initialData, merges, totalRows, totalCols, viewState, effectiveHiddenCols]);
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
                key={`times-${dataVersion}-${colSettingsKey}`}
                initialRows={totalRows}
                initialCols={totalCols}
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
            共 {dateList.length} 天 · {countryCount} 个国家 · 每日 4 个时段（12:00 / 16:00 / 22:00 / 24:00）
          </span>
                </div>
                <div className="flex items-center gap-2">
                    {hasAnyAnomaly && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => {
                                setAnomalySelectedDate(anomalyDates[anomalyDates.length - 1]);
                                setAnomalyDialogOpen(true);
                            }}
                        >
                            <AlertTriangle className="size-3 text-amber-500"/>
                            异动预警 ({anomalyDates.length}天)
                        </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => {
                        resetColWidths();
                        window.location.reload();
                    }}>
                        重置列宽
                    </Button>
                    <ColumnSettingsButton
                        items={columnItems}
                        hiddenCols={effectiveHiddenCols ?? []}
                        onToggle={handleToggleCol}
                        onShowAll={handleShowAll}
                        onReset={handleResetView}
                        resetting={resetting}
                    />
                    {showReset && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs text-muted-foreground"
                            onClick={handleResetDefault}
                        >
                            恢复默认
                        </Button>
                    )}
                    {canLoadMore && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 gap-1 text-xs text-muted-foreground"
                            onClick={loadMore}
                            disabled={loadingMore}
                        >
                            <ChevronDown className="size-3"/>
                            {loadingMore ? '加载中...' : '展示更多'}
                        </Button>
                    )}
                </div>
            </div>

            <Dialog open={anomalyDialogOpen} onOpenChange={setAnomalyDialogOpen}>
                <DialogContent className="max-w-[70vw] max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="size-4 text-amber-500"/>
                            环比异动预警
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex flex-wrap gap-1.5">
                            {anomalyDates.map((date) => {
                                const items = anomalyMap.get(date) || [];
                                const isActive = anomalySelectedDate === date;
                                return (
                                    <button
                                        key={date}
                                        onClick={() => setAnomalySelectedDate(date)}
                                        className={`px-2.5 py-1 rounded-sm text-xs border transition-colors ${
                                            isActive
                                                ? 'bg-primary text-primary-foreground border-primary'
                                                : 'bg-background text-foreground border-border hover:bg-accent'
                                        }`}
                                    >
                                        {formatDate(date)} ({items.length})
                                    </button>
                                );
                            })}
                        </div>
                        {anomalySelectedDate && (() => {
                            const items = anomalyMap.get(anomalySelectedDate) || [];
                            if (items.length === 0) {
                                return (
                                    <div className="text-center py-8 text-sm text-muted-foreground">
                                        当日无显著异动
                                    </div>
                                );
                            }
                            const grouped = new Map<string, AnomalyItem[]>();
                            for (const item of items) {
                                if (!grouped.has(item.timeSlot)) grouped.set(item.timeSlot, []);
                                grouped.get(item.timeSlot)!.push(item);
                            }
                            return (
                                <div className="space-y-3">
                                    {['12:00', '16:00', '22:00', '24:00'].map((slot) => {
                                        const slotItems = grouped.get(slot);
                                        if (!slotItems || slotItems.length === 0) {
                                            return (
                                                <div key={slot}>
                                                    <div className="text-xs font-medium text-muted-foreground mb-1">
                                                        【{slot}】
                                                    </div>
                                                    <div className="text-xs text-muted-foreground pl-3">数据待更新</div>
                                                </div>
                                            );
                                        }
                                        return (
                                            <div key={slot}>
                                                <div className="text-xs font-medium text-muted-foreground mb-1">
                                                    【{slot}】
                                                </div>
                                                {slotItems.map((item) => (
                                                    <div
                                                        key={`${item.country}-${item.timeSlot}`}
                                                        className="text-sm py-0.5 pl-3"
                                                    >
                                                        {item.country}：消耗环比{' '}
                                                        <span
                                                            className={`font-mono font-medium ${item.momPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {item.momPct >= 0 ? '+' : ''}{item.momPct.toFixed(2)}%
                            </span>
                                                        （{item.momPct >= 0 ? '增加' : '减少'}）
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
                            );
                        })()}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default CountryTimesReport;