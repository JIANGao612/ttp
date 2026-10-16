import React, {useState, useCallback, useEffect, useMemo, useRef} from 'react';
import dayjs from 'dayjs';
import {logger} from '@client/src/utils/logger';
import {toast} from 'sonner';
import {Button} from '@client/src/components/ui/button';
import {getBeijingToday, formatLocalDate} from '../../shared/default-date-range';
import {getDailyBaseline, getCountryTimesReport} from '@client/src/api/ad-data';
import {getCountryRoiReport} from '@client/src/api/roi-data';
import {
    getActiveCountries,
    getReportCountries,
    getAllCountries,
    type ReportCountryItem
} from '@client/src/api/country-registry';
import type {AdDataFilterParams, DailyBaselineRow} from '@shared/api.interface';
import type {RoiCountryRoiRow, RoiCountryPeriodSummary} from '@shared/api.interface';
import type {CountryTimesReportRow} from '@shared/api.interface';
import Spreadsheet from '@client/src/components/spreadsheet/Spreadsheet';
import type {MergeCell, CellStyle, SheetData, CellData} from '@client/src/components/spreadsheet/types';
import {exportSheetToExcel} from '@client/src/utils/export-excel';
import {useRegisterExport} from '../../shared/DashboardContext';
import {SelectionStatsBar} from '@client/src/components/spreadsheet/SelectionStatsBar';

import {useViewState} from '@client/src/hooks/use-view-state';
import {useColumnWidths} from '@client/src/hooks/use-column-widths';
import ColumnSettingsButton, {type ColumnSettingItem} from '../components/ColumnSettingsButton';
import CountryMaterialDetailDialog from '../components/CountryMaterialDetailDialog';
import {getCountryDisplayCode} from '@shared/country-utils';
import {
    FIXED_COLS,
    HEADER_ROWS,
    DATE_COL_CONFIG,
    TOTAL_COLS,
    FILTER_TOTAL_COL,
    HEADER_BG,
    MONO_FONT,
    TOTAL_COLOR,
    normalizeRoiDate,
    formatDateDisplay,
    getWeekdayChinese,
    fmtCurrency,
    fmtCpa,
    fmtRoi,
    fmtCumulativeRoi,
    fmtAssessment,
    parseAssessmentValue,
    resolveAssessmentByDate,
    fmtAchievementRate,
    getAchievementStyle,
    fmtMom,
    calcMom,
    getChangeColor,
} from './country-pivot-config';

interface PivotData {
    roi: RoiCountryRoiRow[];
    roiPeriods: RoiCountryPeriodSummary[];
    baseline: DailyBaselineRow[];
    times: CountryTimesReportRow[];
}

const CountryPivotReport: React.FC<{ filters: AdDataFilterParams }> = ({filters}) => {
    const [pivotData, setPivotData] = useState<PivotData>({roi: [], roiPeriods: [], baseline: [], times: []});
    const [loading, setLoading] = useState(true);
    const [pausedCountrySet, setPausedCountrySet] = useState<Set<string> | null>(null);
    const [reportCountries, setReportCountries] = useState<ReportCountryItem[]>([]);
    const [countriesLoading, setCountriesLoading] = useState(true);
    const {viewState, updateViewState, markReady, resetViewState} = useViewState('country-pivot-report');
    const readyRef = useRef(false);
    const [colSettingsKey, setColSettingsKey] = useState(0);
    const [resetting, setResetting] = useState(false);
    const [detailTarget, setDetailTarget] = useState<{ date: string; countryName: string } | null>(null);

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
        }).finally(() => {
            setCountriesLoading(false);
        });
    }, []);

    const allDates = useMemo(() => {
        if (filters.investTimeStart && filters.investTimeEnd) {
            const dates: string[] = [];
            const start = dayjs(filters.investTimeStart);
            const end = dayjs(filters.investTimeEnd);
            let cur = start;
            while (cur.isBefore(end) || cur.isSame(end, 'day')) {
                dates.push(cur.format('YYYY-MM-DD'));
                cur = cur.add(1, 'day');
            }
            return dates;
        }
        const today = dayjs(formatLocalDate(getBeijingToday()));
        const dates: string[] = [];
        for (let i = 4; i >= 1; i--) dates.push(today.subtract(i, 'day').format('YYYY-MM-DD'));
        return dates;
    }, [filters.investTimeStart, filters.investTimeEnd]);

    const displayDates = useMemo(() => {
        if (allDates.length >= 3) return [allDates[allDates.length - 1], allDates[allDates.length - 2], allDates[allDates.length - 3]];
        return allDates;
    }, [allDates]);

    const handleCellDoubleClick = useCallback((row: number, col: number) => {
        if (row < HEADER_ROWS) return;
        const country = reportCountries[row - HEADER_ROWS];
        if (!country) return;
        let date: string | undefined;
        if (col === 3) {
            date = displayDates[0];
        } else {
            const dc = DATE_COL_CONFIG.find((c) => col === c.startCol);
            if (dc) date = displayDates[dc.dateOffset - 1];
        }
        if (!date) return;
        setDetailTarget({date, countryName: country.name});
    }, [reportCountries, displayDates]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const baselineStart = allDates[0];
            const baselineEnd = allDates[allDates.length - 1];
            const momBaselineStart = dayjs(allDates[0]).subtract(1, 'day').format('YYYY-MM-DD');
            const roiDateStart = dayjs(allDates[0]).subtract(30, 'day').format('YYYY-MM-DD');
            const roiDateEnd = allDates[allDates.length - 1];
            const [roiRes, baselineRes, timesRes] = await Promise.all([
                getCountryRoiReport({dateStart: roiDateStart, dateEnd: roiDateEnd}).catch(() => ({
                    items: [],
                    total: 0,
                    periodSummary: []
                })),
                getDailyBaseline(momBaselineStart, baselineEnd, filters.group).catch(() => ({data: {items: []}})),
                getCountryTimesReport({
                    investTimeStart: baselineStart,
                    investTimeEnd: baselineEnd,
                    group: filters.group
                }).then((r) => r.data).catch(() => ({items: [], total: 0})),
            ]);
            setPivotData({
                roi: roiRes.items,
                roiPeriods: roiRes.periodSummary ?? [],
                baseline: baselineRes.data.items,
                times: timesRes.items
            });
        } catch (err) {
            logger.error('Failed to load country pivot report:', err);
            setPivotData({roi: [], roiPeriods: [], baseline: [], times: []});
        } finally {
            setLoading(false);
        }
    }, [allDates, filters.group]);

    useEffect(() => {
        void fetchData();
    }, [fetchData]);

    const refreshActiveCountries = useCallback(() => {
        void getActiveCountries().then((res) => {
            setPausedCountrySet(new Set(res.pausedCountries ?? []));
        }).catch(() => {
        });
    }, []);

    useEffect(() => {
        refreshActiveCountries();
    }, [refreshActiveCountries]);

    useEffect(() => {
        const handler = () => {
            refreshActiveCountries();
            getReportCountries().then((res) => setReportCountries(res.countries)).catch(() => {
            });
            setColSettingsKey(k => k + 1);
        };
        window.addEventListener('country-registry-status-changed', handler);
        return () => window.removeEventListener('country-registry-status-changed', handler);
    }, [refreshActiveCountries]);

    useEffect(() => {
        if (pausedCountrySet) setColSettingsKey(k => k + 1);
    }, [pausedCountrySet]);

    const roiMatrix = useMemo(() => {
        const m = new Map<string, number>();
        for (const row of pivotData.roi) {
            const normalizedDate = normalizeRoiDate(row.date);
            const countryCode = row.country;
            m.set(`${normalizedDate}|${countryCode}`, row.totalRoi);
        }
        return m;
    }, [pivotData.roi]);

    const assessmentTiersByCountry = useMemo(() => {
        const m = new Map<string, { old: number | null; new: number | null; oct: number | null }>();
        for (const c of reportCountries) {
            m.set(c.code, {
                old: parseAssessmentValue(c.assessmentValue ?? ''),
                new: parseAssessmentValue(c.assessmentValueNew ?? ''),
                oct: parseAssessmentValue(c.assessmentValueOct ?? ''),
            });
        }
        return m;
    }, [reportCountries]);

    const assessmentByDateCountry = useMemo(() => {
        const m = new Map<string, number | null>();
        for (const row of pivotData.roi) {
            m.set(`${normalizeRoiDate(row.date)}|${row.country}`, row.assessmentForDate ?? null);
        }
        return m;
    }, [pivotData.roi]);

    const baselineCostMatrix = useMemo(() => {
        const m = new Map<string, number>();
        for (const row of pivotData.baseline) {
            m.set(`${row.date}|${row.country}`, row.totalCost);
        }
        return m;
    }, [pivotData.baseline]);

    const costPositiveSet = useMemo(() => {
        const s = new Set<string>();
        const inRange = new Set(allDates);
        for (const row of pivotData.baseline) {
            if (row.totalCost > 0 && inRange.has(row.date)) s.add(row.country);
        }
        return s;
    }, [pivotData.baseline, allDates]);

    const defaultHiddenSet = useMemo(() => {
        const s = new Set<string>();
        for (const c of reportCountries) {
            if (c.status !== '投放中' && !costPositiveSet.has(c.code)) s.add(c.code);
        }
        return s;
    }, [reportCountries, costPositiveSet]);

    const baselineConvMatrix = useMemo(() => {
        const m = new Map<string, number>();
        for (const row of pivotData.baseline) {
            m.set(`${row.date}|${row.country}`, row.totalConversions);
        }
        return m;
    }, [pivotData.baseline]);

    const latestHourlyCostMap = useMemo(() => {
        const m = new Map<string, number>();
        if (!pivotData.times || pivotData.times.length === 0) return m;
        let latestKey = '';
        for (const row of pivotData.times) {
            const k = `${row.date}|${row.timeSlot}`;
            if (k > latestKey) latestKey = k;
        }
        for (const row of pivotData.times) {
            const k = `${row.date}|${row.timeSlot}`;
            if (k === latestKey) {
                m.set(row.country, row.totalCost);
            }
        }
        return m;
    }, [pivotData.times]);

    const baselineCpa = (date: string, country: string): number | null => {
        const cost = baselineCostMatrix.get(`${date}|${country}`);
        const conv = baselineConvMatrix.get(`${date}|${country}`);
        if (cost === undefined || conv === undefined || conv === 0) return null;
        return cost / conv;
    };

    const roiAggMatrix = useMemo(() => {
        const costM = new Map<string, number>();
        const gmvM = new Map<string, number>();
        for (const row of pivotData.roi) {
            const normalizedDate = normalizeRoiDate(row.date);
            const countryCode = row.country;
            costM.set(`${normalizedDate}|${countryCode}`, (costM.get(`${normalizedDate}|${countryCode}`) ?? 0) + row.totalCost);
            gmvM.set(`${normalizedDate}|${countryCode}`, (gmvM.get(`${normalizedDate}|${countryCode}`) ?? 0) + row.totalGmv);
        }
        return {costM, gmvM};
    }, [pivotData.roi]);

    const latestValidRoiByCountry = useMemo(() => {
        const m = new Map<string, {
            date: string;
            totalRoi: number;
            totalCost: number;
            totalGmv: number;
            earlyCost: number;
            earlyGmv: number;
            earlyRoi: number;
            earlyAchievement: number | null;
            lateCost: number;
            lateGmv: number;
            lateRoi: number;
            lateAchievement: number | null;
        }>();
        for (const row of pivotData.roi) {
            const normalizedDate = normalizeRoiDate(row.date);
            if (normalizedDate === '0001-01-01') continue;
            if (row.totalCost <= 0 && row.totalGmv <= 0) continue;
            const existing = m.get(row.country);
            if (!existing || normalizedDate > existing.date) {
                m.set(row.country, {
                    date: normalizedDate,
                    totalRoi: row.totalRoi,
                    totalCost: row.totalCost,
                    totalGmv: row.totalGmv,
                    earlyCost: row.earlyCost,
                    earlyGmv: row.earlyGmv,
                    earlyRoi: row.earlyRoi,
                    earlyAchievement: row.earlyAchievement,
                    lateCost: row.lateCost,
                    lateGmv: row.lateGmv,
                    lateRoi: row.lateRoi,
                    lateAchievement: row.lateAchievement,
                });
            }
        }
        return m;
    }, [pivotData.roi]);

    const periodByCountry = useMemo(() => {
        const m = new Map<string, RoiCountryPeriodSummary>();
        for (const p of pivotData.roiPeriods) {
            m.set(p.country, p);
        }
        return m;
    }, [pivotData.roiPeriods]);

    const colWidths = useMemo<number[]>(() => {
        const widths: number[] = [110, 55, 60, 100, 100, 120, 100, 100, 100, 100, 115, 125];
        for (const dc of DATE_COL_CONFIG) {
            for (let i = 0; i < dc.colCount; i++) {
                widths.push(i === 0 ? 100 : 78);
            }
        }
        widths.push(100);
        return widths;
    }, []);

    const {
        widths: savedColWidths,
        handleResizeEnd,
        reset: resetColWidths
    } = useColumnWidths(colWidths, 'country-pivot-report');

    const rowItems: ColumnSettingItem[] = useMemo(() => {
        const active: ColumnSettingItem[] = [];
        const paused: ColumnSettingItem[] = [];
        const notDeployed: ColumnSettingItem[] = [];
        reportCountries.forEach((c, i) => {
            const rowIdx = HEADER_ROWS + i;
            const item: ColumnSettingItem = {
                label: `${c.name} (${getCountryDisplayCode(c.code)})`,
                colIndices: [rowIdx],
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

    const effectiveHiddenRows = useMemo(() => {
        const userHidden = new Set(viewState?.hiddenCountryCodes ?? []);
        const explicitShow = new Set(viewState?.explicitShowCodes ?? []);
        const indices: number[] = [];
        reportCountries.forEach((c, i) => {
            if (costPositiveSet.has(c.code)) return;
            const rowIdx = HEADER_ROWS + i;
            if (defaultHiddenSet.has(c.code)) {
                if (!explicitShow.has(c.code)) indices.push(rowIdx);
            } else if (userHidden.has(c.code)) {
                indices.push(rowIdx);
            }
        });
        return indices.length > 0 ? indices : undefined;
    }, [viewState, defaultHiddenSet, reportCountries, costPositiveSet]);

    const effectiveHiddenCols = useMemo(() => {
        if (!viewState) return undefined;
        const userHidden = viewState.hiddenCols ?? [];
        return userHidden.length > 0 ? userHidden : undefined;
    }, [viewState]);

    const columnItems: ColumnSettingItem[] = useMemo(() => {
        const items: ColumnSettingItem[] = [
            {label: 'T-1消耗', colIndices: [3], group: '固定列'},
            {label: 'T-1消耗环比', colIndices: [4], group: '固定列'},
            {label: '最近ROI', colIndices: [5], group: '固定列'},
            {label: '8/13-9/4累计ROI', colIndices: [6], group: '固定列'},
            {label: '8/13-9/4累计达成率', colIndices: [7], group: '固定列'},
            {label: '9/5-9/30累计ROI', colIndices: [8], group: '固定列'},
            {label: '9/5-9/30累计达成率', colIndices: [9], group: '固定列'},
            {label: '10/1-至今累计ROI', colIndices: [10], group: '固定列'},
            {label: '10/1-至今ROI累计达成率', colIndices: [11], group: '固定列'},
        ];
        DATE_COL_CONFIG.forEach((dc, i) => {
            const cols: number[] = [];
            for (let j = 0; j < dc.colCount; j++) cols.push(dc.startCol + j);
            items.push({label: `日期 ${i + 1}`, colIndices: cols, group: '日期列'});
        });
        return items;
    }, []);

    const handleToggleCol = useCallback((colIndices: number[]) => {
        const currentHidden = viewState?.hiddenCols ?? [];
        const allHidden = colIndices.every((c) => currentHidden.includes(c));
        const newHidden = allHidden
            ? currentHidden.filter((c) => !colIndices.includes(c))
            : [...currentHidden, ...colIndices.filter((c) => !currentHidden.includes(c))];
        updateViewState({hiddenCols: newHidden});
        setColSettingsKey((k) => k + 1);
    }, [viewState, updateViewState]);

    const handleToggleRow = useCallback((rowIndices: number[]) => {
        const effectiveHidden = effectiveHiddenRows ?? [];
        const effectiveHiddenSet = new Set(effectiveHidden);
        const rowToCode = new Map<number, string>();
        reportCountries.forEach((c, i) => rowToCode.set(HEADER_ROWS + i, c.code));
        const targetCodes = rowIndices.map(r => rowToCode.get(r)!).filter(Boolean)
            .filter(code => !costPositiveSet.has(code));
        const explicitShow = new Set(viewState?.explicitShowCodes ?? []);
        const userHidden = new Set(viewState?.hiddenCountryCodes ?? []);
        const allHidden = targetCodes.every(code => {
            if (defaultHiddenSet.has(code)) return !explicitShow.has(code);
            return userHidden.has(code);
        });
        const currentHidden = new Set(userHidden);
        const currentExplicit = new Set(explicitShow);
        if (allHidden) {
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
    }, [viewState, updateViewState, effectiveHiddenRows, defaultHiddenSet, reportCountries, costPositiveSet]);

    const handleShowAll = useCallback(() => {
        updateViewState({hiddenCountryCodes: [], explicitShowCodes: Array.from(defaultHiddenSet)});
        setColSettingsKey(k => k + 1);
    }, [updateViewState, defaultHiddenSet]);

    const handleShowAllCols = useCallback(() => {
        updateViewState({hiddenCols: []});
        setColSettingsKey((k) => k + 1);
    }, [updateViewState]);

    const handleReset = useCallback(() => {
        resetViewState();
        updateViewState({hiddenCountryCodes: [], explicitShowCodes: []});
        setColSettingsKey(k => k + 1);
        toast.success('已恢复默认设置');
    }, [resetViewState, updateViewState]);

    const handleStateChange = useCallback((s: { hiddenCols: number[]; hiddenRows: number[] }) => {
        const codes: string[] = [];
        reportCountries.forEach((c, i) => {
            const rowIdx = HEADER_ROWS + i;
            if (s.hiddenRows.includes(rowIdx) && !defaultHiddenSet.has(c.code) && !costPositiveSet.has(c.code)) codes.push(c.code);
        });
        updateViewState({...s, hiddenCountryCodes: codes});
    }, [updateViewState, reportCountries, defaultHiddenSet, costPositiveSet]);

    const totalRows = HEADER_ROWS + reportCountries.length;

    const rowHeights = useMemo<number[]>(
        () => [32, 26, 28, ...Array(reportCountries.length).fill(26)],
        [reportCountries.length],
    );

    const merges = useMemo<MergeCell[]>(() => {
        const list: MergeCell[] = [
            {row: 0, col: 0, rowSpan: 2, colSpan: FIXED_COLS},
            {row: 0, col: 3, rowSpan: 2, colSpan: 1},
            {row: 0, col: 4, rowSpan: 2, colSpan: 1},
            {row: 0, col: 5, rowSpan: 2, colSpan: 1},
            {row: 0, col: 6, rowSpan: 2, colSpan: 1},
            {row: 0, col: 7, rowSpan: 2, colSpan: 1},
            {row: 0, col: 8, rowSpan: 2, colSpan: 1},
            {row: 0, col: 9, rowSpan: 2, colSpan: 1},
            {row: 0, col: 10, rowSpan: 2, colSpan: 1},
            {row: 0, col: 11, rowSpan: 2, colSpan: 1},
            {row: 2, col: 0, rowSpan: 1, colSpan: FIXED_COLS},
        ];
        for (const dc of DATE_COL_CONFIG) {
            list.push({row: 0, col: dc.startCol, rowSpan: 1, colSpan: dc.colCount});
        }
        list.push({row: 0, col: FILTER_TOTAL_COL, rowSpan: 2, colSpan: 1});
        return list;
    }, []);

    const initialData = useMemo(() => {
        const cells: { row: number; col: number; value: string; style?: CellStyle }[] = [];
        const headerStyle: CellStyle = {align: 'center', bold: true, bgColor: HEADER_BG};
        const totalStyle: CellStyle = {bold: true, align: 'center', fontFamily: MONO_FONT};
        const dataStyle: CellStyle = {align: 'center', fontFamily: MONO_FONT};
        const countryStyle: CellStyle = {align: 'center', bold: true};
        const zeroStyle: CellStyle = {align: 'center', fontFamily: MONO_FONT, color: '#6b7280'};

        const allRoiDates = new Set<string>();
        for (const row of pivotData.roi) {
            const normalizedDate = normalizeRoiDate(row.date);
            if (normalizedDate === '0001-01-01') continue;
            if (row.totalCost <= 0 && row.totalGmv <= 0) continue;
            allRoiDates.add(normalizedDate);
        }
        const sortedRoiDates = Array.from(allRoiDates).sort();
        const lastRoiDate = sortedRoiDates.length > 0
            ? sortedRoiDates[sortedRoiDates.length - 1]
            : allDates[allDates.length - 1];

        cells.push({row: 0, col: 0, value: '国家/时间', style: headerStyle});
        const lastRoiDateLabel = sortedRoiDates.length > 0
            ? dayjs(sortedRoiDates[sortedRoiDates.length - 1]).format('MM/DD')
            : dayjs(lastRoiDate).format('MM/DD');
        const t1DateLabel = dayjs(displayDates[0]).format('MM/DD');
        cells.push({row: 0, col: 3, value: `${t1DateLabel}消耗`, style: headerStyle});
        cells.push({row: 0, col: 4, value: `${t1DateLabel}消耗环比`, style: headerStyle});
        cells.push({
            row: 0,
            col: 5,
            value: `${lastRoiDateLabel}ROI`,
            style: {...headerStyle, whiteSpace: 'normal', lineHeight: 16, verticalAlign: 'middle'},
        });
        const wrapHeaderStyle: CellStyle = {
            ...headerStyle,
            whiteSpace: 'normal',
            lineHeight: 16,
            verticalAlign: 'middle'
        };
        cells.push({row: 0, col: 6, value: '8/13-9/4累计ROI', style: wrapHeaderStyle});
        cells.push({row: 0, col: 7, value: '8/13-9/4累计达成率', style: wrapHeaderStyle});
        cells.push({row: 0, col: 8, value: '9/5-9/30累计ROI', style: wrapHeaderStyle});
        cells.push({row: 0, col: 9, value: '9/5-9/30累计达成率', style: wrapHeaderStyle});
        cells.push({row: 0, col: 10, value: '10/1-至今累计ROI', style: wrapHeaderStyle});
        cells.push({row: 0, col: 11, value: '10/1-至今ROI累计达成率', style: wrapHeaderStyle});
        for (let d = 0; d < displayDates.length; d++) {
            const dc = DATE_COL_CONFIG[d];
            const dateStr = displayDates[d];
            const dateLabel = `${formatDateDisplay(dateStr)} ${getWeekdayChinese(dateStr)}`;
            cells.push({row: 0, col: dc.startCol, value: dateLabel, style: headerStyle});
        }

        cells.push({row: 0, col: FILTER_TOTAL_COL, value: '筛选总消耗', style: headerStyle});

        for (let d = 0; d < displayDates.length; d++) {
            const dc = DATE_COL_CONFIG[d];
            const dateStr = displayDates[d];
            for (let s = 0; s < dc.subcols.length; s++) {
                let value = dc.subcols[s];
                if (value === 'ROI') {
                    value = `${dayjs(dateStr).format('M/D')} ROI`;
                }
                cells.push({row: 1, col: dc.startCol + s, value, style: headerStyle});
            }
        }

        const getPrevDate = (d: number): string => {
            return dayjs(displayDates[d]).subtract(1, 'day').format('YYYY-MM-DD');
        };

        cells.push({row: 2, col: 0, value: '总计', style: headerStyle});
        let totalEarlyCost = 0;
        let totalEarlyGmv = 0;
        let totalLateCost = 0;
        let totalLateGmv = 0;
        let totalNewCost = 0;
        let totalNewGmv = 0;
        for (let d = 0; d < displayDates.length; d++) {
            const dc = DATE_COL_CONFIG[d];
            const dateStr = displayDates[d];
            const prevDate = getPrevDate(d);
            const hasRoi = dc.subcols.includes('ROI');

            let totalRoiCost = 0;
            let totalRoiGmv = 0;
            let prevRoiCost = 0;
            let prevRoiGmv = 0;
            if (hasRoi) {
                for (const c of reportCountries) {
                    totalRoiCost += roiAggMatrix.costM.get(`${dateStr}|${c.code}`) ?? 0;
                    totalRoiGmv += roiAggMatrix.gmvM.get(`${dateStr}|${c.code}`) ?? 0;
                    prevRoiCost += roiAggMatrix.costM.get(`${prevDate}|${c.code}`) ?? 0;
                    prevRoiGmv += roiAggMatrix.gmvM.get(`${prevDate}|${c.code}`) ?? 0;
                }
            }
            const totalRoi = totalRoiCost > 0 ? totalRoiGmv / totalRoiCost : 0;
            const prevTotalRoi = prevRoiCost > 0 ? prevRoiGmv / prevRoiCost : 0;

            const baselineTotalCost = (() => {
                const precomputed = baselineCostMatrix.get(`${dateStr}|TOTAL`);
                if (precomputed !== undefined) return precomputed;
                let sum = 0;
                for (const c of reportCountries) {
                    sum += baselineCostMatrix.get(`${dateStr}|${c.code}`) ?? 0;
                }
                return sum;
            })();
            const baselinePrevTotalCost = (() => {
                const precomputed = baselineCostMatrix.get(`${prevDate}|TOTAL`);
                if (precomputed !== undefined) return precomputed;
                let sum = 0;
                for (const c of reportCountries) {
                    sum += baselineCostMatrix.get(`${prevDate}|${c.code}`) ?? 0;
                }
                return sum;
            })();
            const costMom = (baselineTotalCost !== null && baselinePrevTotalCost !== null)
                ? calcMom(baselineTotalCost, baselinePrevTotalCost)
                : null;
            const baselineTotalCpa = (() => {
                const conv = baselineConvMatrix.get(`${dateStr}|TOTAL`);
                if (conv !== undefined) {
                    const cost = baselineCostMatrix.get(`${dateStr}|TOTAL`);
                    if (cost !== undefined && conv !== 0) return cost / conv;
                }
                let sumCost = 0;
                let sumConv = 0;
                for (const c of reportCountries) {
                    sumCost += baselineCostMatrix.get(`${dateStr}|${c.code}`) ?? 0;
                    sumConv += baselineConvMatrix.get(`${dateStr}|${c.code}`) ?? 0;
                }
                return sumConv > 0 ? sumCost / sumConv : null;
            })();
            const baselinePrevTotalCpa = (() => {
                const conv = baselineConvMatrix.get(`${prevDate}|TOTAL`);
                if (conv !== undefined) {
                    const cost = baselineCostMatrix.get(`${prevDate}|TOTAL`);
                    if (cost !== undefined && conv !== 0) return cost / conv;
                }
                let sumCost = 0;
                let sumConv = 0;
                for (const c of reportCountries) {
                    sumCost += baselineCostMatrix.get(`${prevDate}|${c.code}`) ?? 0;
                    sumConv += baselineConvMatrix.get(`${prevDate}|${c.code}`) ?? 0;
                }
                return sumConv > 0 ? sumCost / sumConv : null;
            })();
            const cpaMom = (baselineTotalCpa !== null && baselinePrevTotalCpa !== null)
                ? calcMom(baselineTotalCpa, baselinePrevTotalCpa)
                : null;
            const roiMom = hasRoi ? calcMom(totalRoi, prevTotalRoi) : null;

            cells.push({row: 2, col: dc.startCol, value: fmtCurrency(baselineTotalCost ?? 0), style: totalStyle});
            cells.push({
                row: 2,
                col: dc.startCol + 1,
                value: costMom !== null ? fmtMom(costMom) : '—',
                style: totalStyle
            });
            cells.push({row: 2, col: dc.startCol + 2, value: fmtCpa(baselineTotalCpa), style: totalStyle});
            cells.push({
                row: 2,
                col: dc.startCol + 3,
                value: cpaMom !== null ? fmtMom(cpaMom) : '—',
                style: totalStyle
            });
            if (hasRoi) {
                cells.push({row: 2, col: dc.startCol + 4, value: fmtRoi(totalRoi), style: totalStyle});
                cells.push({
                    row: 2,
                    col: dc.startCol + 5,
                    value: roiMom !== null ? fmtMom(roiMom) : '—',
                    style: totalStyle
                });
                cells.push({row: 2, col: dc.startCol + 6, value: fmtAssessment(null), style: totalStyle});
            }
        }

        for (let i = 0; i < reportCountries.length; i++) {
            const row = HEADER_ROWS + i;
            const c = reportCountries[i];
            const regionStyle: CellStyle = {align: 'center', bold: true, bgColor: c.regionColor};
            cells.push({row, col: 0, value: c.name, style: countryStyle});
            cells.push({row, col: 1, value: getCountryDisplayCode(c.code), style: countryStyle});
            cells.push({row, col: 2, value: c.region, style: regionStyle});
            const latestValid = latestValidRoiByCountry.get(c.code);
            const earlyRoi = latestValid?.earlyRoi ?? 0;
            const earlyAchievement = latestValid?.earlyAchievement ?? null;
            const lateRoi = latestValid?.lateRoi ?? 0;
            const lateAchievement = latestValid?.lateAchievement ?? null;
            totalEarlyCost += latestValid?.earlyCost ?? 0;
            totalEarlyGmv += latestValid?.earlyGmv ?? 0;
            totalLateCost += latestValid?.lateCost ?? 0;
            totalLateGmv += latestValid?.lateGmv ?? 0;
            const latestRoi = latestValid?.totalRoi ?? 0;
            const t1Cost = baselineCostMatrix.get(`${displayDates[0]}|${c.code}`) ?? null;
            const t1PrevCost = baselineCostMatrix.get(`${displayDates[1]}|${c.code}`) ?? null;
            const t1CostMom = (t1Cost !== null && t1PrevCost !== null)
                ? calcMom(t1Cost, t1PrevCost)
                : null;
            cells.push({
                row,
                col: 3,
                value: t1Cost !== null ? fmtCurrency(t1Cost) : '—',
                style: (t1Cost ?? 0) > 0 ? dataStyle : zeroStyle
            });
            cells.push({
                row,
                col: 4,
                value: t1CostMom !== null ? fmtMom(t1CostMom) : '—',
                style: {align: 'center', fontFamily: MONO_FONT, color: getChangeColor('costMom', t1CostMom)}
            });
            cells.push({row, col: 5, value: fmtRoi(latestRoi), style: latestRoi > 0 ? dataStyle : zeroStyle});
            cells.push({row, col: 6, value: fmtCumulativeRoi(earlyRoi), style: earlyRoi > 0 ? dataStyle : zeroStyle});
            cells.push({
                row,
                col: 7,
                value: fmtAchievementRate(earlyAchievement),
                style: getAchievementStyle(earlyAchievement)
            });
            cells.push({row, col: 8, value: fmtCumulativeRoi(lateRoi), style: lateRoi > 0 ? dataStyle : zeroStyle});
            cells.push({
                row,
                col: 9,
                value: fmtAchievementRate(lateAchievement),
                style: getAchievementStyle(lateAchievement)
            });
            const period = periodByCountry.get(c.code);
            const newCumulativeRoi = period?.newRoi ?? 0;
            const newAchievement = period?.newAchievement ?? null;
            totalNewCost += period?.newCost ?? 0;
            totalNewGmv += period?.newGmv ?? 0;
            cells.push({
                row,
                col: 10,
                value: fmtCumulativeRoi(newCumulativeRoi),
                style: newCumulativeRoi > 0 ? dataStyle : zeroStyle
            });
            cells.push({
                row,
                col: 11,
                value: fmtAchievementRate(newAchievement),
                style: getAchievementStyle(newAchievement)
            });

            for (let d = 0; d < displayDates.length; d++) {
                const dc = DATE_COL_CONFIG[d];
                const dateStr = displayDates[d];
                const prevDate = getPrevDate(d);
                const hasRoi = dc.subcols.includes('ROI');

                const roi = roiMatrix.get(`${dateStr}|${c.code}`) ?? 0;
                const prevRoi = roiMatrix.get(`${prevDate}|${c.code}`) ?? 0;

                const normalizedDateStr = normalizeRoiDate(dateStr);
                const tiers = assessmentTiersByCountry.get(c.code);
                const assessmentForT3 = assessmentByDateCountry.get(`${normalizedDateStr}|${c.code}`)
                    ?? resolveAssessmentByDate(normalizedDateStr, tiers?.old ?? null, tiers?.new ?? null, tiers?.oct ?? null);

                const baselineCost = baselineCostMatrix.get(`${dateStr}|${c.code}`) ?? null;
                const baselinePrevCost = baselineCostMatrix.get(`${prevDate}|${c.code}`) ?? null;
                const costMom = (baselineCost !== null && baselinePrevCost !== null)
                    ? calcMom(baselineCost, baselinePrevCost)
                    : null;
                const baselineCpaCurr = baselineCpa(dateStr, c.code);
                const baselineCpaPrev = baselineCpa(prevDate, c.code);
                const cpaMom = (baselineCpaCurr !== null && baselineCpaPrev !== null)
                    ? calcMom(baselineCpaCurr, baselineCpaPrev)
                    : null;
                const roiMom = hasRoi ? calcMom(roi, prevRoi) : null;

                cells.push({
                    row,
                    col: dc.startCol,
                    value: fmtCurrency(baselineCost ?? 0),
                    style: (baselineCost ?? 0) > 0 ? dataStyle : zeroStyle
                });
                cells.push({
                    row,
                    col: dc.startCol + 1,
                    value: costMom !== null ? fmtMom(costMom) : '—',
                    style: {align: 'center', fontFamily: MONO_FONT, color: getChangeColor('costMom', costMom)}
                });
                cells.push({row, col: dc.startCol + 2, value: fmtCpa(baselineCpaCurr), style: dataStyle});
                cells.push({
                    row,
                    col: dc.startCol + 3,
                    value: cpaMom !== null ? fmtMom(cpaMom) : '—',
                    style: {align: 'center', fontFamily: MONO_FONT, color: getChangeColor('cpaMom', cpaMom)}
                });
                if (hasRoi) {
                    cells.push({
                        row,
                        col: dc.startCol + 4,
                        value: fmtRoi(roi),
                        style: {align: 'center', fontFamily: MONO_FONT, color: getChangeColor('roi', roi)}
                    });
                    cells.push({
                        row,
                        col: dc.startCol + 5,
                        value: roiMom !== null ? fmtMom(roiMom) : '—',
                        style: {align: 'center', fontFamily: MONO_FONT, color: getChangeColor('roiMom', roiMom)}
                    });
                    cells.push({row, col: dc.startCol + 6, value: fmtAssessment(assessmentForT3), style: dataStyle});
                }
            }

            let filterCost = 0;
            for (const date of allDates) {
                filterCost += baselineCostMatrix.get(`${date}|${c.code}`) ?? 0;
            }
            cells.push({
                row,
                col: FILTER_TOTAL_COL,
                value: filterCost > 0 ? fmtCurrency(filterCost) : '$0.00',
                style: filterCost > 0 ? dataStyle : zeroStyle,
            });
        }

        let totalLatestRoiCost = 0;
        let totalLatestRoiGmv = 0;
        let totalT1Cost = 0;
        let totalT1PrevCost = 0;
        for (const c of reportCountries) {
            const latestValid = latestValidRoiByCountry.get(c.code);
            totalLatestRoiCost += latestValid?.totalCost ?? 0;
            totalLatestRoiGmv += latestValid?.totalGmv ?? 0;
            totalT1Cost += baselineCostMatrix.get(`${displayDates[0]}|${c.code}`) ?? 0;
            totalT1PrevCost += baselineCostMatrix.get(`${displayDates[1]}|${c.code}`) ?? 0;
        }
        const totalLatestRoi = totalLatestRoiCost > 0 ? totalLatestRoiGmv / totalLatestRoiCost : 0;
        const totalEarlyRoiValue = totalEarlyCost > 0 ? totalEarlyGmv / totalEarlyCost : 0;
        const totalLateRoiValue = totalLateCost > 0 ? totalLateGmv / totalLateCost : 0;
        const totalT1CostMom = (totalT1Cost > 0 && totalT1PrevCost > 0)
            ? calcMom(totalT1Cost, totalT1PrevCost)
            : null;
        cells.push({row: 2, col: 3, value: totalT1Cost > 0 ? fmtCurrency(totalT1Cost) : '—', style: totalStyle});
        cells.push({row: 2, col: 4, value: totalT1CostMom !== null ? fmtMom(totalT1CostMom) : '—', style: totalStyle});
        cells.push({row: 2, col: 5, value: fmtRoi(totalLatestRoi), style: totalStyle});
        cells.push({row: 2, col: 6, value: fmtCumulativeRoi(totalEarlyRoiValue), style: totalStyle});
        cells.push({row: 2, col: 7, value: fmtAchievementRate(null), style: totalStyle});
        cells.push({row: 2, col: 8, value: fmtCumulativeRoi(totalLateRoiValue), style: totalStyle});
        cells.push({row: 2, col: 9, value: fmtAchievementRate(null), style: totalStyle});
        const totalNewRoiValue = totalNewCost > 0 ? totalNewGmv / totalNewCost : 0;
        cells.push({row: 2, col: 10, value: fmtCumulativeRoi(totalNewRoiValue), style: totalStyle});
        cells.push({row: 2, col: 11, value: fmtAchievementRate(null), style: totalStyle});

        let totalFilterCost = 0;
        for (const c of reportCountries) {
            for (const date of allDates) {
                totalFilterCost += baselineCostMatrix.get(`${date}|${c.code}`) ?? 0;
            }
        }
        cells.push({row: 2, col: FILTER_TOTAL_COL, value: fmtCurrency(totalFilterCost), style: totalStyle});

        return cells;
    }, [displayDates, allDates, roiMatrix, assessmentTiersByCountry, assessmentByDateCountry, roiAggMatrix, latestValidRoiByCountry, periodByCountry, baselineCostMatrix, baselineConvMatrix, reportCountries]);

    const handleExport = useCallback(async (): Promise<number> => {
        const cells = new Map<string, CellData>();
        for (const c of initialData) {
            cells.set(`${c.row},${c.col}`, {value: c.value, style: c.style});
        }
        const sheetData: SheetData = {rows: totalRows, cols: TOTAL_COLS, cells, merges};
        const hiddenRows: number[] = effectiveHiddenRows ?? [];
        await exportSheetToExcel(sheetData, {
            fileName: `新国家日报_${new Date().toISOString().slice(0, 10)}.xlsx`,
            hiddenRows,
        });
        return totalRows - hiddenRows.length - HEADER_ROWS;
    }, [initialData, merges, totalRows, effectiveHiddenRows]);
    useRegisterExport(handleExport);

    if (loading || countriesLoading || !viewState) {
        return (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                加载中...
            </div>
        );
    }

    return (
        <div>
            <Spreadsheet
                key={`pivot-${colSettingsKey}-${(effectiveHiddenRows ?? []).join('.')}-${(effectiveHiddenCols ?? []).join('.')}`}
                initialRows={totalRows}
                initialCols={TOTAL_COLS}
                initialData={initialData}
                initialMerges={merges}
                colWidths={savedColWidths}
                rowHeights={rowHeights}
                frozenRows={HEADER_ROWS}
                frozenCols={FIXED_COLS}
                showAddRows={false}
                hideToolbar
                initialHiddenCols={effectiveHiddenCols}
                initialHiddenRows={effectiveHiddenRows}
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
                />
            )}
            <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <SelectionStatsBar/>
                    <span className="text-xs text-muted-foreground">
            共 {reportCountries.length} 个国家 · {DATE_COL_CONFIG.length} 组日期
          </span>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground" onClick={() => {
                        resetColWidths();
                        window.location.reload();
                    }}>
                        重置列宽
                    </Button>
                    <ColumnSettingsButton
                        title="国家行设置"
                        buttonLabel="行设置"
                        items={rowItems}
                        hiddenCols={effectiveHiddenRows ?? []}
                        onToggle={handleToggleRow}
                        onShowAll={handleShowAll}
                        onReset={handleReset}
                        resetting={resetting}
                    />
                </div>
            </div>
        </div>
    );
};

export default CountryPivotReport;