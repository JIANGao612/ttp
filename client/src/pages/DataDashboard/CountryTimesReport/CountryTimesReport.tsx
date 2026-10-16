import React, {useMemo, useState, useCallback, useEffect, useRef} from 'react';
import {ChevronDown, AlertTriangle, Copy} from 'lucide-react';
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
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@client/src/components/ui/select';
import {copyToClipboard} from '@client/src/utils/copy-text';
import {useLoadMore} from '../../shared/use-load-more';
import {useRegisterExport} from '../../shared/DashboardContext';
import {SelectionStatsBar} from '@client/src/components/spreadsheet/SelectionStatsBar';

import {getCountryDisplayCode} from '@shared/country-utils';
import {useViewState} from '@client/src/hooks/use-view-state';
import {useColumnWidths} from '@client/src/hooks/use-column-widths';
import {formatLocalDate} from '@client/src/pages/shared/default-date-range';
import ColumnSettingsButton, {type ColumnSettingItem} from '../components/ColumnSettingsButton';
import CountryMaterialDetailDialog from '../components/CountryMaterialDetailDialog';

const FIXED_COLS = 5;
const TOTAL_COST_COL = 3;
const TOTAL_MOM_COL = 4;
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
    return '$' + v.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
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

import {DAILY_TIME_SLOTS, slotDisplayName} from '@shared/time-slot-schedule';
import {buildImageExportName} from '@client/src/utils/mobile-env';

const SLOTS_PER_DAY = 4;

const CountryTimesReport: React.FC<{ filters: AdDataFilterParams }> = ({filters}) => {
    const [rawData, setRawData] = useState<CountryTimesReportRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [dataVersion, setDataVersion] = useState(0);
    const [registryPausedCols, setRegistryPausedCols] = useState<number[]>([]);
    const [pausedCountrySet, setPausedCountrySet] = useState<Set<string> | null>(null);
    const [reportCountries, setReportCountries] = useState<ReportCountryItem[]>([]);
    const {extendedFilters, extraDays, loadMore, canLoadMore, reset, showReset} = useLoadMore(filters);
    const {viewState, updateViewState, markReady, hasSavedState, resetViewState} = useViewState('country-times-report');
    const readyRef = useRef(false);
    const [colSettingsKey, setColSettingsKey] = useState(0);
    const [resetting, setResetting] = useState(false);
    const [anomalyDialogOpen, setAnomalyDialogOpen] = useState(false);
    const [anomalySelectedDate, setAnomalySelectedDate] = useState<string | null>(null);
    const [anomalyShowDays, setAnomalyShowDays] = useState(1);
    const [detailTarget, setDetailTarget] = useState<{
        date: string;
        countryName: string;
        timeSlot?: string
    } | null>(null);

    useEffect(() => {
        if (viewState && !readyRef.current) {
            readyRef.current = true;
            const t = setTimeout(markReady, 1000);
            return () => clearTimeout(t);
        }
    }, [viewState, markReady]);

    useEffect(() => {
        Promise.all([getReportCountries(), getAllCountries()]).then(([reportRes, allRes]) => {
            setReportCountries((reportRes.countries ?? []).filter((c) => !!c));
            const pausedSet = new Set<string>();
            (allRes.countries ?? []).filter((c) => !!c && c.status === '已暂停').forEach((c) => pausedSet.add(c.code));
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

    const fetchFilters = useMemo<AdDataFilterParams>(() => {
        if (!queryFilters.investTimeStart) return queryFilters;
        return {...queryFilters, investTimeStart: addDays(queryFilters.investTimeStart, -1)};
    }, [queryFilters]);

    useEffect(() => {
        void fetchData(fetchFilters, extraDays > 0);
    }, [fetchData, fetchFilters]);

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
            getReportCountries().then((res) => setReportCountries(res.countries)).catch(() => {
            });
            setColSettingsKey(k => k + 1);
        };
        window.addEventListener('country-registry-status-changed', handler);
        return () => window.removeEventListener('country-registry-status-changed', handler);
    }, [refreshRegistryPausedCols]);

    useEffect(() => {
        if (pausedCountrySet) setColSettingsKey(k => k + 1);
    }, [pausedCountrySet]);

    const {dateList, costMatrix, bidMatrix, dateSlotTotalMap, costPositiveSet, cpaMatrix} = useMemo(() => {
        if (rawData.length === 0) {
            return {
                dateList: [] as string[],
                costMatrix: new Map<string, number>(),
                bidMatrix: new Map<string, { ccRatio: number; lcRatio: number }>(),
                dateSlotTotalMap: new Map<string, number>(),
                costPositiveSet: new Set<string>(),
                cpaMatrix: new Map<string, number | null>()
            };
        }
        const dates = new Set<string>();
        const matrix = new Map<string, number>();
        const bMatrix = new Map<string, { ccRatio: number; lcRatio: number }>();
        const slotTotalMap = new Map<string, number>();
        const cpaMap = new Map<string, number | null>();
        for (const row of rawData) {
            dates.add(row.date);
            matrix.set(`${row.date}|${row.timeSlot}|${row.country}`, row.totalCost);
            bMatrix.set(`${row.date}|${row.timeSlot}|${row.country}`, {
                ccRatio: row.ccRatio ?? 0,
                lcRatio: row.lcRatio ?? 0
            });
            cpaMap.set(`${row.date}|${row.timeSlot}|${row.country}`, row.cpa ?? null);
            const slotKey = `${row.date}|${row.timeSlot}`;
            slotTotalMap.set(slotKey, (slotTotalMap.get(slotKey) || 0) + row.totalCost);
        }
        const sortedDates = Array.from(dates).sort();
        const dataMaxDate = sortedDates[sortedDates.length - 1];
        const hasTodayData = dataMaxDate === todayStr;
        const displayEnd = hasTodayData ? todayStr : dataMaxDate;
        const requestedStart = queryFilters.investTimeStart;
        const displayStart = requestedStart
            ? (sortedDates.find((d) => d >= requestedStart) ?? dataMaxDate)
            : sortedDates[0];
        const fullDates = generateDateRange(displayStart, displayEnd);
        const costPositive = new Set<string>();
        for (const row of rawData) {
            if (row.totalCost > 0 && row.date >= displayStart && row.date <= displayEnd) costPositive.add(row.country);
        }
        return {
            dateList: fullDates,
            costMatrix: matrix,
            bidMatrix: bMatrix,
            dateSlotTotalMap: slotTotalMap,
            costPositiveSet: costPositive,
            cpaMatrix: cpaMap
        };
    }, [rawData, todayStr, queryFilters]);

    const defaultHiddenSet = useMemo(() => {
        const s = new Set<string>();
        for (const c of reportCountries) {
            if (c.status !== '投放中' && !costPositiveSet.has(c.code)) s.add(c.code);
        }
        return s;
    }, [reportCountries, costPositiveSet]);

    interface AnomalyItem {
        country: string;
        countryCode: string;
        timeSlot: string;
        cost: number;
        momPct: number;
        cpaMomPct: number | null;
    }

    const anomalyMap = useMemo(() => {
        const map = new Map<string, AnomalyItem[]>();
        for (const date of dateList) {
            const prevDate = addDays(date, -1);
            const items: AnomalyItem[] = [];
            for (const slot of DAILY_TIME_SLOTS) {
                for (const c of reportCountries) {
                    const cost = costMatrix.get(`${date}|${slot}|${c.code}`) || 0;
                    const prevCost = costMatrix.get(`${prevDate}|${slot}|${c.code}`) || 0;
                    if (prevCost <= 0 || cost <= 0) continue;
                    const mom = (cost - prevCost) / prevCost;
                    const momPct = mom * 100;
                    if (momPct >= 20 || momPct <= -20) {
                        const cpa = cpaMatrix.get(`${date}|${slot}|${c.code}`) ?? null;
                        const prevCpa = cpaMatrix.get(`${prevDate}|${slot}|${c.code}`) ?? null;
                        let cpaMomPct: number | null = null;
                        if (cpa !== null && prevCpa !== null && prevCpa > 0) {
                            cpaMomPct = Math.round(((cpa - prevCpa) / prevCpa) * 10000) / 100;
                        }
                        items.push({
                            country: c.name,
                            countryCode: c.code,
                            timeSlot: slot,
                            cost,
                            momPct: Math.round(momPct * 100) / 100,
                            cpaMomPct
                        });
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
    }, [dateList, costMatrix, cpaMatrix, reportCountries]);

    const anomalyDates = useMemo(() => Array.from(anomalyMap.keys()).sort(), [anomalyMap]);
    const hasAnyAnomaly = anomalyDates.length > 0;

    const visibleAnomalyDates = useMemo(() => {
        return anomalyDates.slice(-anomalyShowDays);
    }, [anomalyDates, anomalyShowDays]);

    const handleAnomalyShowDaysChange = (value: string) => {
        const n = Number(value);
        setAnomalyShowDays(n);
        if (anomalySelectedDate && !anomalyDates.slice(-n).includes(anomalySelectedDate)) {
            setAnomalySelectedDate(anomalyDates[anomalyDates.length - 1] ?? null);
        }
        if (dateList.length < n && canLoadMore) loadMore();
    };

    const filterDefaultDays = useMemo(() => {
        if (!filters.investTimeStart || !filters.investTimeEnd) return 1;
        const ms = new Date(filters.investTimeEnd + 'T00:00:00').getTime() - new Date(filters.investTimeStart + 'T00:00:00').getTime();
        const days = Math.round(ms / 86400000) + 1;
        return Math.min(30, Math.max(1, days));
    }, [filters.investTimeStart, filters.investTimeEnd]);

    const handleAnomalyReset = () => {
        setAnomalyShowDays(filterDefaultDays);
        setAnomalySelectedDate(anomalyDates[anomalyDates.length - 1] ?? null);
    };

    const groupAnomalyItems = (items: AnomalyItem[]) => {
        const grouped = new Map<string, AnomalyItem[]>();
        for (const item of items) {
            if (!grouped.has(item.timeSlot)) grouped.set(item.timeSlot, []);
            grouped.get(item.timeSlot)!.push(item);
        }
        return grouped;
    };

    const selectedAnomalyItems: AnomalyItem[] = anomalySelectedDate
        ? anomalyMap.get(anomalySelectedDate) ?? []
        : [];
    const selectedAnomalyGrouped = selectedAnomalyItems.length > 0
        ? groupAnomalyItems(selectedAnomalyItems)
        : null;

    const handleCopySlot = async (slot: string, slotItems: AnomalyItem[] | undefined) => {
        const lines: string[] = [];
        if (!slotItems || slotItems.length === 0) {
            lines.push('数据待更新');
        } else {
            for (const item of slotItems) {
                const cpaPart = item.cpaMomPct !== null
                    ? `，CPA环比 ${item.cpaMomPct >= 0 ? '+' : ''}${item.cpaMomPct.toFixed(2)}%`
                    : '，CPA环比 -';
                lines.push(`${item.country}（${item.countryCode}）：消耗${item.cost.toFixed(2)}，环比 ${item.momPct >= 0 ? '+' : ''}${item.momPct.toFixed(2)}%${cpaPart}`);
            }
        }
        const ok = await copyToClipboard(lines.join('\n'));
        if (ok) toast.success(`已复制 ${slot} 时段内容`);
        else toast.error('复制失败，请手动复制');
    };

    const effectiveHiddenCols = useMemo(() => {
        if (!viewState) return undefined;
        const userHidden = new Set(viewState.hiddenCountryCodes ?? []);
        const explicitShow = new Set(viewState.explicitShowCodes ?? []);
        const hidden: number[] = [];
        reportCountries.forEach((c, i) => {
            if (costPositiveSet.has(c.code)) return;
            const colBase = FIXED_COLS + i * 3;
            if (defaultHiddenSet.has(c.code)) {
                if (!explicitShow.has(c.code)) hidden.push(colBase, colBase + 1, colBase + 2);
            } else if (userHidden.has(c.code)) {
                hidden.push(colBase, colBase + 1, colBase + 2);
            }
        });
        return hidden.length > 0 ? hidden : undefined;
    }, [viewState, defaultHiddenSet, reportCountries, costPositiveSet]);

    const columnItems: ColumnSettingItem[] = useMemo(() => {
        const active: ColumnSettingItem[] = [];
        const paused: ColumnSettingItem[] = [];
        const notDeployed: ColumnSettingItem[] = [];
        reportCountries.forEach((c, i) => {
            const colBase = FIXED_COLS + i * 3;
            const item: ColumnSettingItem = {
                label: `${c.name} (${getCountryDisplayCode(c.code)})`,
                colIndices: [colBase, colBase + 1, colBase + 2],
            };
            if (c.status === '已暂停') {
                item.tag = '已暂停';
                item.group = '已暂停国家';
                paused.push(item);
            } else if (c.status === '未投放') {
                item.tag = '未投放';
                item.group = '未投放国家';
                notDeployed.push(item);
            } else {
                item.group = '投放中';
                active.push(item);
            }
        });
        return [...active, ...paused, ...notDeployed];
    }, [reportCountries]);

    const handleToggleCol = useCallback((colIndices: number[]) => {
        const colToCode = new Map<number, string>();
        reportCountries.forEach((c, i) => {
            const colBase = FIXED_COLS + i * 3;
            colToCode.set(colBase, c.code);
            colToCode.set(colBase + 1, c.code);
            colToCode.set(colBase + 2, c.code);
        });
        const targetCodes = [...new Set(colIndices.map(c => colToCode.get(c)!).filter(Boolean))]
            .filter(code => !costPositiveSet.has(code));
        const userHidden = new Set(viewState?.hiddenCountryCodes ?? []);
        const explicitShow = new Set(viewState?.explicitShowCodes ?? []);
        const isHidden = targetCodes.every(code => {
            if (defaultHiddenSet.has(code)) return !explicitShow.has(code);
            return userHidden.has(code);
        });
        const currentHidden = new Set(userHidden);
        const currentExplicit = new Set(explicitShow);
        if (isHidden) {
            for (const code of targetCodes) {
                currentHidden.delete(code);
                if (defaultHiddenSet.has(code)) currentExplicit.add(code);
                else currentExplicit.delete(code);
            }
        } else {
            for (const code of targetCodes) {
                if (defaultHiddenSet.has(code)) {
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
    }, [viewState, updateViewState, defaultHiddenSet, reportCountries, costPositiveSet]);

    const handleShowAll = useCallback(() => {
        updateViewState({hiddenCountryCodes: [], explicitShowCodes: Array.from(defaultHiddenSet)});
        setColSettingsKey(k => k + 1);
    }, [updateViewState, defaultHiddenSet]);

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
            if (hiddenSet.has(colBase) && !defaultHiddenSet.has(c.code) && !costPositiveSet.has(c.code)) hiddenCountryCodes.push(c.code);
        });
        updateViewState({...s, hiddenCountryCodes});
    }, [updateViewState, reportCountries, defaultHiddenSet, costPositiveSet]);

    const dataRowCount = dateList.length * SLOTS_PER_DAY;
    const totalRows = HEADER_ROWS + dataRowCount + SUMMARY_ROWS;

    const handleCellDoubleClick = useCallback((row: number, col: number) => {
        if (row < HEADER_ROWS || row >= HEADER_ROWS + dataRowCount) return;
        if (col < FIXED_COLS || (col - FIXED_COLS) % 3 !== 0) return;
        const country = reportCountries[(col - FIXED_COLS) / 3];
        if (!country) return;
        const offset = row - HEADER_ROWS;
        const date = dateList[Math.floor(offset / SLOTS_PER_DAY)];
        if (!date) return;
        const slot = DAILY_TIME_SLOTS[offset % SLOTS_PER_DAY];
        setDetailTarget({date, countryName: country.name, timeSlot: slot});
    }, [dataRowCount, dateList, reportCountries]);

    const colWidths = useMemo<number[]>(() => {
        const w: number[] = [100, 50, 70, 100, 70];
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
            {row: 0, col: 3, rowSpan: 1, colSpan: 2},
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
        data.push({row: 1, col: 3, value: '消耗', style: {...colHeaderStyle, fontSize: 12}});
        data.push({row: 1, col: 4, value: '环比', style: {...colHeaderStyle, fontSize: 12}});

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
        const notUploadedStyle: CellStyle = {align: 'center', fontFamily: MONO_FONT, color: '#94a3b8'};
        const momStyleNeg: CellStyle = {align: 'center', fontFamily: MONO_FONT, color: '#dc2626'};
        const dateStyle: CellStyle = {align: 'center'};
        const weekdayStyle: CellStyle = {align: 'center'};
        const timeStyle: CellStyle = {align: 'center'};

        for (let r = 0; r < dateList.length; r++) {
            const date = dateList[r];
            const prevDate = addDays(date, -1);
            const daySlots = DAILY_TIME_SLOTS;
            const dateRowIdx = HEADER_ROWS + r * SLOTS_PER_DAY;

            for (let s = 0; s < daySlots.length; s++) {
                const row = dateRowIdx + s;
                const slot = daySlots[s];

                if (s === 0) {
                    data.push({row, col: 0, value: formatDate(date), style: dateStyle});
                    data.push({row, col: 1, value: String(getWeekday(date)), style: weekdayStyle});
                } else {
                    data.push({row, col: 0, value: '', style: dateStyle});
                    data.push({row, col: 1, value: '', style: weekdayStyle});
                }
                data.push({row, col: 2, value: slotDisplayName(slot), style: timeStyle});

                const slotUploaded = dateSlotTotalMap.has(`${date}|${slot}`);
                let sum = 0;
                for (const row of rawData) {
                    if (row.date === date && row.timeSlot === slot) sum += row.totalCost;
                }
                data.push({
                    row,
                    col: TOTAL_COST_COL,
                    value: slotUploaded ? fmtCurrency(sum) : '—',
                    style: slotUploaded ? totalStyle : notUploadedStyle
                });

                const prevSum = dateSlotTotalMap.get(`${prevDate}|${slot}`) || 0;
                if (slotUploaded && prevSum > 0) {
                    const totalMom = (sum - prevSum) / prevSum;
                    const totalMomStyle = totalMom < 0 ? momStyleNeg : countryStyle;
                    data.push({
                        row,
                        col: TOTAL_MOM_COL,
                        value: fmtPct(totalMom),
                        style: {...totalMomStyle, bold: true, color: totalMom < 0 ? '#dc2626' : TOTAL_COLOR}
                    });
                } else {
                    data.push({row, col: TOTAL_MOM_COL, value: '—', style: totalStyle});
                }

                for (let i = 0; i < countryCount; i++) {
                    const costCol = FIXED_COLS + i * 3;
                    const momCol = costCol + 1;
                    const ccCol = costCol + 2;
                    const cost = costMatrix.get(`${date}|${slot}|${reportCountries[i].code}`) || 0;
                    data.push({
                        row,
                        col: costCol,
                        value: slotUploaded ? fmtCurrency(cost) : '—',
                        style: slotUploaded ? countryStyle : notUploadedStyle
                    });

                    const prevCost = costMatrix.get(`${prevDate}|${slot}|${reportCountries[i].code}`) || 0;
                    if (slotUploaded && prevCost > 0) {
                        const mom = (cost - prevCost) / prevCost;
                        const style = mom < 0 ? momStyleNeg : countryStyle;
                        data.push({row, col: momCol, value: fmtPct(mom), style});
                    } else {
                        data.push({row, col: momCol, value: '—', style: countryStyle});
                    }

                    const bid = bidMatrix.get(`${date}|${slot}|${reportCountries[i].code}`) || {ccRatio: 0, lcRatio: 0};
                    const ccStyle: CellStyle = {align: 'center', fontFamily: MONO_FONT, fontSize: 10};
                    data.push({row, col: ccCol, value: cost > 0 ? `${bid.ccRatio.toFixed(1)}%` : '—', style: ccStyle});
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
            for (const slot of DAILY_TIME_SLOTS) {
                grandTotal += dateSlotTotalMap.get(`${date}|${slot}`) || 0;
            }
        }
        data.push({row: summaryRow, col: TOTAL_COST_COL, value: fmtCurrency(grandTotal), style: summaryValueStyle});
        data.push({row: summaryRow, col: TOTAL_MOM_COL, value: '—', style: summaryEmptyStyle});

        for (let i = 0; i < countryCount; i++) {
            let colSum = 0;
            for (const date of dateList) {
                for (const slot of DAILY_TIME_SLOTS) {
                    colSum += costMatrix.get(`${date}|${slot}|${reportCountries[i].code}`) || 0;
                }
            }
            grandTotal += colSum;
            const costCol = FIXED_COLS + i * 3;
            data.push({row: summaryRow, col: costCol, value: fmtCurrency(colSum), style: summaryValueStyle});
            data.push({row: summaryRow, col: costCol + 1, value: '—', style: summaryEmptyStyle});
            data.push({row: summaryRow, col: costCol + 2, value: '—', style: summaryEmptyStyle});
        }

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

    if (loading || !viewState) {
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
                imageExportName={buildImageExportName('国家时报', filters.investTimeStart, filters.investTimeEnd)}
                initialRows={totalRows}
                initialCols={totalCols}
                initialData={initialData}
                initialMerges={merges}
                colWidths={savedColWidths}
                rowHeights={rowHeights}
                frozenRows={HEADER_ROWS}
                frozenCols={FIXED_COLS}
                freezeKey="country-times-report"
                bottomFrozenRows={SUMMARY_ROWS}
                hideToolbar
                showAddRows={false}
                initialHiddenCols={effectiveHiddenCols}
                initialHiddenRows={viewState?.hiddenRows}
                initialScrollLeft={viewState?.scrollLeft ?? 0}
                initialScrollTop={viewState?.scrollTop ?? 0}
                onStateChange={handleStateChange}
                onCellDoubleClick={handleCellDoubleClick}
                onScrollChange={(s) => updateViewState(s)}
                onColumnResizeEnd={handleResizeEnd}
            />
            {detailTarget && (
                <CountryMaterialDetailDialog
                    open
                    onOpenChange={(open: boolean) => {
                        if (!open) setDetailTarget(null);
                    }}
                    date={detailTarget.date}
                    countryName={detailTarget.countryName}
                    timeSlot={detailTarget.timeSlot}
                    group={queryFilters.group}
                />
            )}
            <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <SelectionStatsBar/>
                    <span className="text-xs text-muted-foreground">
            共 {dateList.length} 天 · {countryCount} 个国家 · 每日 4 个时段（{DAILY_TIME_SLOTS.map(slotDisplayName).join(' / ')}）
          </span>
                </div>
                <div className="flex items-center gap-2">
                    {hasAnyAnomaly && (
                        <Button
                            variant="outline"
                            size="sm"
                            className="h-7 gap-1 text-xs"
                            onClick={() => {
                                setAnomalyShowDays(filterDefaultDays);
                                setAnomalySelectedDate(anomalyDates[anomalyDates.length - 1]);
                                setAnomalyDialogOpen(true);
                            }}
                        >
                            <AlertTriangle className="size-3 text-amber-500"/>
                            波动预警 ({anomalyDates.length}天)
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
                    <DialogHeader className="flex flex-row items-center justify-between space-y-0">
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="size-4 text-amber-500"/>
                            环比波动预警
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex flex-wrap gap-1.5">
                                {visibleAnomalyDates.map((date) => {
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
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                展示
                                <Select value={String(anomalyShowDays)} onValueChange={handleAnomalyShowDaysChange}>
                                    <SelectTrigger className="h-7 w-[76px] text-xs">
                                        <SelectValue/>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Array.from({length: 30}, (_, i) => i + 1).map((n) => (
                                            <SelectItem key={n} value={String(n)}>{n} 天</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs text-muted-foreground"
                                    onClick={handleAnomalyReset}
                                >
                                    恢复默认
                                </Button>
                            </div>
                        </div>
                        {anomalySelectedDate && (
                            <div className="space-y-3">
                                {selectedAnomalyItems.length === 0 ? (
                                    <div className="text-center py-8 text-sm text-muted-foreground">
                                        当日无显著波动
                                    </div>
                                ) : (
                                    DAILY_TIME_SLOTS.map((slot) => {
                                        const slotItems = selectedAnomalyGrouped ? selectedAnomalyGrouped.get(slot) : undefined;
                                        if (!slotItems || slotItems.length === 0) {
                                            return (
                                                <div key={slot}>
                                                    <div className="mb-1 flex items-center justify-between">
                                                        <div className="text-xs font-medium text-muted-foreground">
                                                            【{slotDisplayName(slot)}】
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            title={`复制 ${slotDisplayName(slot)} 时段`}
                                                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                                            onClick={() => {
                                                                void handleCopySlot(slot, undefined);
                                                            }}
                                                        >
                                                            <Copy className="size-3"/>
                                                        </Button>
                                                    </div>
                                                    <div className="text-xs text-muted-foreground pl-3">数据待更新</div>
                                                </div>
                                            );
                                        }
                                        return (
                                            <div key={slot}>
                                                <div className="mb-1 flex items-center justify-between">
                                                    <div className="text-xs font-medium text-muted-foreground">
                                                        【{slotDisplayName(slot)}】
                                                    </div>
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        title={`复制 ${slotDisplayName(slot)} 时段`}
                                                        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                                                        onClick={() => {
                                                            void handleCopySlot(slot, slotItems);
                                                        }}
                                                    >
                                                        <Copy className="size-3"/>
                                                    </Button>
                                                </div>
                                                {slotItems.map((item) => (
                                                    <div
                                                        key={`${item.country}-${item.timeSlot}`}
                                                        className="text-sm py-0.5 pl-3"
                                                    >
                                                        {item.country}（{item.countryCode}）：消耗{' '}
                                                        <span
                                                            className="font-mono font-medium">{item.cost.toFixed(2)}</span>
                                                        ，环比{' '}
                                                        <span
                                                            className={`font-mono font-medium ${item.momPct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                              {item.momPct >= 0 ? '+' : ''}{item.momPct.toFixed(2)}%
                            </span>
                                                        <span className="ml-1">
                              ，CPA环比{' '}
                                                            {item.cpaMomPct !== null ? (
                                                                <span
                                                                    className={`font-mono font-medium ${item.cpaMomPct > 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                                  {item.cpaMomPct >= 0 ? '+' : ''}{item.cpaMomPct.toFixed(2)}%
                                </span>
                                                            ) : (
                                                                '-'
                                                            )}
                            </span>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default CountryTimesReport;