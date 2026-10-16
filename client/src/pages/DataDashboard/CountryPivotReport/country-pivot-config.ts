import type {CellStyle} from '@client/src/components/spreadsheet/types';

export const FIXED_COLS = 3;
export const HEADER_ROWS = 3;

const SUBCOLS_T1 = ['消耗', '消耗环比', 'CPA', 'CPA环比'];
const SUBCOLS_T2 = ['消耗', '消耗环比', 'CPA', 'CPA环比'];
const SUBCOLS_T3 = ['消耗', '消耗环比', 'CPA', 'CPA环比', 'ROI', 'ROI环比', '考核ROI'];

export interface DateColConfig {
    dateOffset: number;
    subcols: string[];
    startCol: number;
    colCount: number;
}

export const FIXED_METRIC_COLS = 9;

export const DATE_COL_CONFIG: DateColConfig[] = [
    {dateOffset: 1, subcols: SUBCOLS_T1, startCol: FIXED_COLS + FIXED_METRIC_COLS, colCount: SUBCOLS_T1.length},
    {
        dateOffset: 2,
        subcols: SUBCOLS_T2,
        startCol: FIXED_COLS + FIXED_METRIC_COLS + SUBCOLS_T1.length,
        colCount: SUBCOLS_T2.length
    },
    {
        dateOffset: 3,
        subcols: SUBCOLS_T3,
        startCol: FIXED_COLS + FIXED_METRIC_COLS + SUBCOLS_T1.length + SUBCOLS_T2.length,
        colCount: SUBCOLS_T3.length
    },
];

export const FILTER_TOTAL_COL = FIXED_COLS + FIXED_METRIC_COLS + SUBCOLS_T1.length + SUBCOLS_T2.length + SUBCOLS_T3.length;
export const TOTAL_COLS = FILTER_TOTAL_COL + 1;

export const HEADER_BG = '#eff6ff';
export const MONO_FONT = '"Helvetica Neue", Helvetica, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", Arial, sans-serif';
export const TOTAL_COLOR = '#1d4ed8';
export const COLOR_NEG = '#dc2626';
export const COLOR_ZERO = '#6b7280';

export function normalizeRoiDate(dateStr: string): string {
    return dateStr.replace(/\//g, '-');
}

export function formatDateDisplay(d: string): string {
    return d.replace(/-/g, '/');
}

export function getWeekdayChinese(dateStr: string): string {
    const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
    const d = new Date(dateStr + 'T00:00:00');
    return weekdays[d.getDay()];
}

export function fmtCurrency(v: number): string {
    return '$' + v.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2});
}

export function fmtCpa(v: number | null): string {
    if (v === null) return '—';
    return '$' + v.toFixed(2);
}

export function fmtRoi(v: number): string {
    if (v === 0) return '—';
    return (v * 100).toFixed(2) + '%';
}

export function fmtCumulativeRoi(v: number): string {
    if (v === 0) return '—';
    return (v * 100).toFixed(2) + '%';
}

export function parseAssessmentValue(raw: string): number | null {
    const v = (raw ?? '').trim();
    if (!v || v === '-') return null;
    if (v.includes('%')) {
        const n = Number(v.replace(/%/g, '').replace(/,/g, ''));
        return isNaN(n) ? null : n / 100;
    }
    const n = Number(v.replace(/,/g, ''));
    return isNaN(n) ? null : n;
}

export const ASSESSMENT_SEG1_END = '2026-09-04';
export const ASSESSMENT_OLD_END = '2026-09-30';

export function resolveAssessmentByDate(
    date: string,
    oldV: number | null,
    newV: number | null,
    octV: number | null,
): number | null {
    if (date <= ASSESSMENT_SEG1_END) return oldV ?? newV ?? octV;
    if (date <= ASSESSMENT_OLD_END) return newV ?? oldV ?? octV;
    return octV ?? newV ?? oldV;
}

export function fmtAssessment(v: number | null): string {
    if (v === null || v === 0) return '—';
    return (v * 100).toFixed(2) + '%';
}

export function fmtAchievementRate(achievement: number | null): string {
    if (achievement === null || achievement === 0) return '—';
    return (achievement * 100).toFixed(2) + '%';
}

export function getAchievementStyle(achievement: number | null): CellStyle {
    if (achievement === null || achievement === 0) {
        return {align: 'center', fontFamily: MONO_FONT, color: COLOR_ZERO};
    }
    if (achievement < 0.8) {
        return {align: 'center', fontFamily: MONO_FONT, bgColor: '#ffe4e6'};
    }
    return {align: 'center', fontFamily: MONO_FONT};
}

export function fmtMom(v: number): string {
    const pct = (v * 100).toFixed(2);
    return v > 0 ? `+${pct}%` : `${pct}%`;
}

export function calcMom(curr: number, prev: number): number | null {
    if (prev === 0) return null;
    return (curr - prev) / prev;
}

export function getChangeColor(metricName: string, value: number | null): string | undefined {
    if (value === null || value === 0) return undefined;
    switch (metricName) {
        case 'costMom':
        case 'roiMom':
        case 'roi':
            return value < 0 ? '#dc2626' : undefined;
        case 'cpaMom':
            return value > 0 ? '#dc2626' : undefined;
        default:
            return undefined;
    }
}