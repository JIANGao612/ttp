import type {AdDataFilterParams} from '@shared/api.interface';

export function formatLocalDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function getBeijingToday(): Date {
    const now = new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const y = beijingTime.getUTCFullYear();
    const m = beijingTime.getUTCMonth();
    const d = beijingTime.getUTCDate();
    return new Date(y, m, d);
}

export const DEFAULT_RANGE_DAYS = 7;

export function getDefaultDateRange(): { start: string; end: string } {
    const today = getBeijingToday();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    const end = new Date(y, m, d - 1);
    const start = new Date(y, m, d - DEFAULT_RANGE_DAYS);
    return {start: formatLocalDate(start), end: formatLocalDate(end)};
}

export function getTabDefaultDateRange(
    tab: string,
): { start: string; end: string } | null {
    const build = (days: number, includeToday: boolean) => {
        const end = getBeijingToday();
        if (!includeToday) end.setDate(end.getDate() - 1);
        const start = new Date(end);
        start.setDate(start.getDate() - (days - 1));
        return {start: formatLocalDate(start), end: formatLocalDate(end)};
    };
    if (tab === 'country-pivot') return build(3, false);
    if (tab === 'country') return build(7, false);
    if (tab === 'country-times') return build(3, true);
    return null;
}

export const DEFAULT_AGENT = 'XB';

export function getDefaultFilters(): AdDataFilterParams {
    const {start, end} = getDefaultDateRange();
    return {investTimeStart: start, investTimeEnd: end, agent: [DEFAULT_AGENT]};
}

export function extendDateStart(
    currentStart: string | undefined,
    extraDays: number,
): string | undefined {
    if (!currentStart) return undefined;
    const d = new Date(currentStart);
    d.setDate(d.getDate() - extraDays);
    return formatLocalDate(d);
}
