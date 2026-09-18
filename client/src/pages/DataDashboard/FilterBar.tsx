import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ChevronDown, ChevronLeft, ChevronRight, RotateCcw, CalendarIcon, Search, X, RefreshCw} from 'lucide-react';
import {Button} from '@client/src/components/ui/button';
import {Input} from '@client/src/components/ui/input';
import {Checkbox} from '@client/src/components/ui/checkbox';
import {Popover, PopoverContent, PopoverTrigger} from '@client/src/components/ui/popover';
import {ScrollArea} from '@client/src/components/ui/scroll-area';
import {logger} from '@client/src/utils/logger';
import {getFilterOptions} from '@client/src/api/ad-data';
import type {AdDataFilterParams, FilterOptions} from '@shared/api.interface';
import {cn} from '@/lib/utils';
import {getDefaultFilters} from '../shared/default-date-range';
import {getCountryDisplayCode} from '@shared/country-utils';

function formatLocalDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

interface FilterBarProps {
    filters: AdDataFilterParams;
    onChange: (filters: AdDataFilterParams) => void;
    onRefresh?: () => void;
    hideFields?: string[];
    showInvestDays?: boolean;
    showProductionDate?: boolean;
    showYesterdayCostMin?: boolean;
    showRenovationStatus?: boolean;
}

// -----------------------------------------------------------------------
// MultiSelect — Popover + Checkbox list
// -----------------------------------------------------------------------

interface MultiSelectProps {
    label: string;
    options: string[];
    selected: string[];
    onChange: (values: string[]) => void;
    wide?: boolean;
    formatLabel?: (value: string) => string;
}

const MultiSelect: React.FC<MultiSelectProps> = ({label, options, selected, onChange, wide, formatLabel}) => {
    const fmt = formatLabel ?? ((v: string) => v);
    const [open, setOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [localSelected, setLocalSelected] = useState<string[]>(selected);

    useEffect(() => {
        if (open) {
            setLocalSelected(selected);
        }
    }, [open]);

    const toggle = (value: string) => {
        if (localSelected.includes(value)) {
            setLocalSelected(localSelected.filter((v) => v !== value));
        } else {
            setLocalSelected([...localSelected, value]);
        }
    };

    const handleClear = (e: React.MouseEvent) => {
        e.stopPropagation();
        onChange([]);
        setLocalSelected([]);
    };

    const filteredOptions = searchQuery.trim()
        ? options.filter((opt) => opt.toLowerCase().includes(searchQuery.trim().toLowerCase()))
        : options;

    const allFilteredSelected = filteredOptions.length > 0 && filteredOptions.every((opt) => localSelected.includes(opt));

    const shouldLimit = !searchQuery.trim() && filteredOptions.length > 100;
    const displayOptions = shouldLimit ? filteredOptions.slice(0, 100) : filteredOptions;

    const handleSelectAll = () => {
        const newSet = new Set(localSelected);
        for (const opt of filteredOptions) newSet.add(opt);
        setLocalSelected(Array.from(newSet));
    };

    const handleDeselectAll = () => {
        const filteredSet = new Set(filteredOptions);
        setLocalSelected(localSelected.filter((v) => !filteredSet.has(v)));
    };

    return (
        <div className="relative w-full">
            <Popover
                open={open}
                onOpenChange={(v) => {
                    setOpen(v);
                    if (!v) {
                        setSearchQuery('');
                    }
                }}
            >
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                            'h-8 w-full justify-between text-xs font-normal',
                            selected.length > 0 && 'border-primary text-primary',
                            selected.length > 0 && 'pr-7',
                        )}
                    >
            <span
                className="flex-1 overflow-x-auto whitespace-nowrap text-left scrollbar-hide"
                style={{scrollbarWidth: 'none', msOverflowStyle: 'none'}}
            >
              {(open ? localSelected : selected).length > 0
                  ? (open ? localSelected : selected).map(fmt).join(' | ')
                  : label}
            </span>
                        <ChevronDown className="size-3 shrink-0 opacity-50"/>
                    </Button>
                </PopoverTrigger>
                {selected.length > 0 && (
                    <button
                        type="button"
                        className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={handleClear}
                        aria-label="清除筛选"
                    >
                        <X className="size-3"/>
                    </button>
                )}
                <PopoverContent className={cn('p-0', wide ? 'w-80' : 'w-56')} align="start">
                    <div className="border-b p-2">
                        <div className="relative">
                            <Search
                                className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"/>
                            <Input
                                className="h-7 pl-7 pr-2 text-xs"
                                placeholder="搜索..."
                                value={searchQuery}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>
                    {wide ? (
                        <div className="h-48 overflow-auto">
                            <div className="p-1">
                                {filteredOptions.length === 0 ? (
                                    <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                                        {options.length === 0 ? '暂无选项' : '无匹配项'}
                                    </p>
                                ) : (
                                    <>
                                        {displayOptions.map((opt) => (
                                            <button
                                                key={opt}
                                                type="button"
                                                className="flex items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                                                onClick={() => toggle(opt)}
                                            >
                                                <Checkbox checked={localSelected.includes(opt)}
                                                          className="size-4 shrink-0"/>
                                                <span className="whitespace-nowrap">{fmt(opt)}</span>
                                            </button>
                                        ))}
                                        {shouldLimit && (
                                            <p className="px-2 py-2 text-center text-xs text-muted-foreground">
                                                共 {filteredOptions.length} 项，仅显示前 100 项，请搜索筛选
                                            </p>
                                        )}
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <ScrollArea className="h-48">
                            <div className="p-1">
                                {filteredOptions.length === 0 ? (
                                    <p className="px-2 py-4 text-center text-xs text-muted-foreground">
                                        {options.length === 0 ? '暂无选项' : '无匹配项'}
                                    </p>
                                ) : (
                                    filteredOptions.map((opt) => (
                                        <button
                                            key={opt}
                                            type="button"
                                            className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent"
                                            onClick={() => toggle(opt)}
                                        >
                                            <Checkbox checked={localSelected.includes(opt)} className="size-4"/>
                                            <span className="truncate">{fmt(opt)}</span>
                                        </button>
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    )}
                    <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
                        <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={allFilteredSelected ? handleDeselectAll : handleSelectAll}
                            disabled={filteredOptions.length === 0 && !allFilteredSelected}
                        >
                            {allFilteredSelected ? '取消全选' : '全选'}
                        </Button>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(false)}>
                                取消
                            </Button>
                            <Button
                                size="sm"
                                className="h-7 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                                onClick={() => {
                                    onChange(localSelected);
                                    setOpen(false);
                                }}
                            >
                                确认
                            </Button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
};

// -----------------------------------------------------------------------
// DateRangePicker — dual-month calendar with quick presets & confirm/cancel
// -----------------------------------------------------------------------

interface DateRangePickerProps {
    startDate?: string;
    endDate?: string;
    onChange: (start: string | undefined, end: string | undefined) => void;
}

const PRESETS: { key: string; label: string }[] = [
    {key: 'today', label: '今天'},
    {key: 'yesterday', label: '昨天'},
    {key: 'last7', label: '过去7天'},
    {key: 'last14', label: '过去14天'},
    {key: 'last30', label: '过去30天'},
    {key: 'thisWeek', label: '本周'},
    {key: 'lastWeek', label: '上周'},
    {key: 'thisMonth', label: '本月'},
    {key: 'lastMonth', label: '上个月'},
];

function getBeijingToday(): Date {
    const now = new Date();
    const beijingTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const y = beijingTime.getUTCFullYear();
    const m = beijingTime.getUTCMonth();
    const d = beijingTime.getUTCDate();
    return new Date(y, m, d);
}

function addMonths(date: Date, n: number): Date {
    const d = new Date(date);
    d.setMonth(d.getMonth() + n);
    return d;
}

function startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

function calcPresetRange(key: string): { from: Date; to: Date } {
    const today = getBeijingToday();
    const y = today.getFullYear();
    const m = today.getMonth();
    const d = today.getDate();
    const dayOfWeek = today.getDay();

    switch (key) {
        case 'today':
            return {from: today, to: today};
        case 'yesterday': {
            const yest = new Date(y, m, d - 1);
            return {from: yest, to: yest};
        }
        case 'last7': {
            const to = new Date(y, m, d - 1);
            const from = new Date(y, m, d - 7);
            return {from, to};
        }
        case 'last14': {
            const to = new Date(y, m, d - 1);
            const from = new Date(y, m, d - 14);
            return {from, to};
        }
        case 'last30': {
            const to = new Date(y, m, d - 1);
            const from = new Date(y, m, d - 30);
            return {from, to};
        }
        case 'thisWeek': {
            const from = new Date(y, m, d - dayOfWeek);
            return {from, to: today};
        }
        case 'lastWeek': {
            const from = new Date(y, m, d - dayOfWeek - 7);
            const to = new Date(y, m, d - dayOfWeek - 1);
            return {from, to};
        }
        case 'thisMonth': {
            const from = new Date(y, m, 1);
            return {from, to: today};
        }
        case 'lastMonth': {
            const from = new Date(y, m - 1, 1);
            const to = new Date(y, m, 0);
            return {from, to};
        }
        default:
            return {from: today, to: today};
    }
}

const DateRangePicker: React.FC<DateRangePickerProps> = ({startDate, endDate, onChange}) => {
    const [open, setOpen] = useState(false);
    const today = getBeijingToday();

    const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(today));
    const [localStart, setLocalStart] = useState<Date | undefined>(
        startDate ? new Date(startDate) : undefined,
    );
    const [localEnd, setLocalEnd] = useState<Date | undefined>(
        endDate ? new Date(endDate) : undefined,
    );
    const [clickCount, setClickCount] = useState(0);
    const [activePreset, setActivePreset] = useState<string>('');

    useEffect(() => {
        if (open) {
            const s = startDate ? new Date(startDate) : undefined;
            const e = endDate ? new Date(endDate) : undefined;
            setLocalStart(s);
            setLocalEnd(e);
            setClickCount(0);
            setViewMonth(s ? startOfMonth(s) : startOfMonth(today));
            setActivePreset('');
        }
    }, [open]);

    const handlePresetClick = (key: string) => {
        const {from, to} = calcPresetRange(key);
        setLocalStart(from);
        setLocalEnd(to);
        setClickCount(0);
        setActivePreset(key);
        setViewMonth(startOfMonth(from));
    };

    const handleDayClick = (day: Date) => {
        setActivePreset('');
        if (clickCount === 0 || (clickCount === 1 && localStart && day < localStart)) {
            setLocalStart(day);
            setLocalEnd(undefined);
            setClickCount(1);
        } else {
            if (localStart) {
                setLocalEnd(day);
                setClickCount(0);
            }
        }
    };

    const handlePrevMonth = () => setViewMonth(addMonths(viewMonth, -1));
    const handleNextMonth = () => setViewMonth(addMonths(viewMonth, 1));

    const handleConfirm = () => {
        if (localStart && localEnd) {
            onChange(formatLocalDate(localStart), formatLocalDate(localEnd));
        } else if (localStart && !localEnd) {
            onChange(formatLocalDate(localStart), undefined);
        } else {
            onChange(undefined, undefined);
        }
        setOpen(false);
    };

    const handleCancel = () => {
        setOpen(false);
    };

    const handleClear = () => {
        setLocalStart(undefined);
        setLocalEnd(undefined);
        setClickCount(0);
        setActivePreset('');
    };

    const hasValue = !!startDate;
    const displayText = startDate && endDate
        ? `${startDate} ~ ${endDate}`
        : startDate
            ? `${startDate} ~ ?`
            : '选择日期范围';

    const secondMonth = addMonths(viewMonth, 1);
    const leftMonthYear = viewMonth.getFullYear();
    const leftMonthIdx = viewMonth.getMonth();
    const rightMonthYear = secondMonth.getFullYear();
    const rightMonthIdx = secondMonth.getMonth();

    const renderMonth = (year: number, monthIdx: number, side: 'left' | 'right') => {
        const firstDay = new Date(year, monthIdx, 1);
        const lastDay = new Date(year, monthIdx + 1, 0);
        const startWeekday = firstDay.getDay();
        const daysInMonth = lastDay.getDate();
        const prevMonthLastDay = new Date(year, monthIdx, 0).getDate();

        const cells: { date: Date; inMonth: boolean }[] = [];
        for (let i = startWeekday - 1; i >= 0; i--) {
            cells.push({
                date: new Date(year, monthIdx - 1, prevMonthLastDay - i),
                inMonth: false,
            });
        }
        for (let i = 1; i <= daysInMonth; i++) {
            cells.push({date: new Date(year, monthIdx, i), inMonth: true});
        }
        while (cells.length % 7 !== 0 || cells.length < 42) {
            const last = cells[cells.length - 1].date;
            cells.push({
                date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
                inMonth: false,
            });
            if (cells.length >= 42) break;
        }

        const isInRange = (d: Date) => {
            if (!localStart) return false;
            if (localEnd) return d >= localStart && d <= localEnd;
            return d.getTime() === localStart.getTime();
        };
        const isStart = (d: Date) => localStart && d.getTime() === localStart.getTime();
        const isEnd = (d: Date) => localEnd && d.getTime() === localEnd.getTime();
        const isToday = (d: Date) => d.getTime() === today.getTime();

        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        const monthLabel = `${year}年 ${monthIdx + 1}月`;

        return (
            <div key={`${side}-${year}-${monthIdx}`} className="flex w-64 flex-col">
                <div className="mb-2 flex items-center justify-center">
                    <span className="text-sm font-medium">{monthLabel}</span>
                </div>
                <div className="mb-1 grid grid-cols-7 gap-0">
                    {weekdays.map((w) => (
                        <div key={w} className="py-1 text-center text-xs text-muted-foreground">
                            {w}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-0">
                    {cells.map(({date, inMonth}, idx) => {
                        const start = inMonth && isStart(date);
                        const end = inMonth && isEnd(date);
                        const inRange = inMonth && isInRange(date);
                        const todayCell = inMonth && isToday(date);
                        const single = start && end;
                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => inMonth && handleDayClick(date)}
                                disabled={!inMonth}
                                className={cn(
                                    'relative flex h-8 w-full items-center justify-center text-xs transition-colors',
                                    inMonth ? 'text-foreground' : 'text-muted-foreground/40',
                                    inRange && !start && !end && 'bg-primary/10 text-foreground',
                                    start && 'rounded-l-sm bg-primary text-primary-foreground',
                                    end && 'rounded-r-sm bg-primary text-primary-foreground',
                                    single && 'rounded-sm',
                                    inMonth && !inRange && !start && !end && 'hover:bg-accent',
                                )}
                            >
                                <span>{date.getDate()}</span>
                                {todayCell && inMonth && (
                                    <span
                                        className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary"/>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="relative w-full">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                            'h-8 w-full justify-start text-xs font-normal',
                            hasValue && 'border-primary text-primary pr-7',
                        )}
                    >
                        <CalendarIcon className="size-3 shrink-0 opacity-50"/>
                        <span className={cn('truncate', !hasValue && 'text-muted-foreground')}>
              {displayText}
            </span>
                    </Button>
                </PopoverTrigger>
                {hasValue && (
                    <button
                        type="button"
                        className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange(undefined, undefined);
                        }}
                        aria-label="清除筛选"
                    >
                        <X className="size-3"/>
                    </button>
                )}
                <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
                    <div className="flex">
                        {/* 左侧快捷按钮 */}
                        <div className="flex w-28 flex-col gap-0.5 border-r p-2">
                            {PRESETS.map((p) => (
                                <button
                                    key={p.key}
                                    type="button"
                                    onClick={() => handlePresetClick(p.key)}
                                    className={cn(
                                        'rounded-sm px-2 py-1.5 text-left text-xs transition-colors',
                                        activePreset === p.key
                                            ? 'bg-primary/10 text-primary font-medium'
                                            : 'text-foreground hover:bg-accent',
                                    )}
                                >
                                    {p.label}
                                </button>
                            ))}
                        </div>
                        {/* 右侧双月日历 */}
                        <div className="p-3">
                            <div className="relative flex items-center justify-between px-2 pb-2">
                                <button
                                    type="button"
                                    onClick={handlePrevMonth}
                                    className="flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                                    aria-label="上个月"
                                >
                                    <ChevronLeft className="size-4"/>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleNextMonth}
                                    className="flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                                    aria-label="下个月"
                                >
                                    <ChevronRight className="size-4"/>
                                </button>
                            </div>
                            <div className="flex gap-4">
                                {renderMonth(leftMonthYear, leftMonthIdx, 'left')}
                                {renderMonth(rightMonthYear, rightMonthIdx, 'right')}
                            </div>
                        </div>
                    </div>
                    {/* 底部操作按钮 */}
                    <div className="flex items-center justify-between border-t px-3 py-2">
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-xs text-muted-foreground hover:text-foreground"
                        >
                            清空
                        </button>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleCancel}>
                                取消
                            </Button>
                            <Button
                                size="sm"
                                className="h-7 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                                onClick={handleConfirm}
                            >
                                确认
                            </Button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
};

// -----------------------------------------------------------------------
// FirstConsumptionDatePicker — dual-month calendar with before/after mode
// -----------------------------------------------------------------------

interface FirstConsumptionDatePickerProps {
    dateMode?: 'before' | 'after' | 'range';
    dateValue?: string;
    onChange: (mode: 'before' | 'after' | 'range' | undefined, date: string | undefined) => void;
}

type FcMode = 'preset' | 'before' | 'after';

const FirstConsumptionDatePicker: React.FC<FirstConsumptionDatePickerProps> = ({
                                                                                   dateMode,
                                                                                   dateValue,
                                                                                   onChange,
                                                                               }) => {
    const [open, setOpen] = useState(false);
    const today = getBeijingToday();

    const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(today));
    const [localMode, setLocalMode] = useState<FcMode>('preset');
    const [localPreset, setLocalPreset] = useState<string>('');
    const [localPresetStart, setLocalPresetStart] = useState<Date | undefined>(undefined);
    const [localPresetEnd, setLocalPresetEnd] = useState<Date | undefined>(undefined);
    const [localSingleDate, setLocalSingleDate] = useState<Date | undefined>(undefined);

    useEffect(() => {
        if (open) {
            if (dateMode === 'before' && dateValue) {
                setLocalMode('before');
                setLocalSingleDate(new Date(dateValue));
                setViewMonth(startOfMonth(new Date(dateValue)));
            } else if (dateMode === 'after' && dateValue) {
                setLocalMode('after');
                setLocalSingleDate(new Date(dateValue));
                setViewMonth(startOfMonth(new Date(dateValue)));
            } else {
                setLocalMode('preset');
                setLocalPreset('');
                setLocalPresetStart(undefined);
                setLocalPresetEnd(undefined);
                setLocalSingleDate(undefined);
                setViewMonth(startOfMonth(today));
            }
        }
    }, [open]);

    const handlePresetClick = (key: string) => {
        const {from, to} = calcPresetRange(key);
        setLocalMode('preset');
        setLocalPreset(key);
        setLocalPresetStart(from);
        setLocalPresetEnd(to);
        setLocalSingleDate(undefined);
        setViewMonth(startOfMonth(from));
    };

    const handleModeClick = (mode: 'before' | 'after') => {
        setLocalMode(mode);
        setLocalPreset('');
        setLocalPresetStart(undefined);
        setLocalPresetEnd(undefined);
        setLocalSingleDate(undefined);
    };

    const handleDayClick = (day: Date) => {
        if (localMode === 'preset') {
            setLocalPreset('');
            if (!localPresetStart || (localPresetStart && localPresetEnd && day < localPresetStart)) {
                setLocalPresetStart(day);
                setLocalPresetEnd(undefined);
            } else if (localPresetStart && !localPresetEnd) {
                setLocalPresetEnd(day);
            } else {
                setLocalPresetStart(day);
                setLocalPresetEnd(undefined);
            }
        } else {
            setLocalSingleDate(day);
        }
    };

    const handlePrevMonth = () => setViewMonth(addMonths(viewMonth, -1));
    const handleNextMonth = () => setViewMonth(addMonths(viewMonth, 1));

    const handleConfirm = () => {
        if (localMode === 'preset') {
            if (localPresetStart && localPresetEnd) {
                onChange('range', formatLocalDate(localPresetStart) + '~' + formatLocalDate(localPresetEnd));
            } else {
                onChange(undefined, undefined);
            }
        } else if (localMode === 'before' && localSingleDate) {
            onChange('before', formatLocalDate(localSingleDate));
        } else if (localMode === 'after' && localSingleDate) {
            onChange('after', formatLocalDate(localSingleDate));
        } else {
            onChange(undefined, undefined);
        }
        setOpen(false);
    };

    const handleCancel = () => setOpen(false);

    const handleClear = () => {
        setLocalMode('preset');
        setLocalPreset('');
        setLocalPresetStart(undefined);
        setLocalPresetEnd(undefined);
        setLocalSingleDate(undefined);
    };

    const hasValue = !!dateMode && !!dateValue;
    let displayText = '选择日期';
    if (dateMode === 'before') displayText = `早于 ${dateValue}`;
    else if (dateMode === 'after') displayText = `晚于 ${dateValue}`;
    else if (dateMode === 'range') displayText = dateValue || '选择日期';

    const secondMonth = addMonths(viewMonth, 1);
    const leftMonthYear = viewMonth.getFullYear();
    const leftMonthIdx = viewMonth.getMonth();
    const rightMonthYear = secondMonth.getFullYear();
    const rightMonthIdx = secondMonth.getMonth();

    const getRangeStart = (): Date | undefined => {
        if (localMode === 'preset') return localPresetStart;
        return undefined;
    };
    const getRangeEnd = (): Date | undefined => {
        if (localMode === 'preset') return localPresetEnd;
        return undefined;
    };
    const getSingleDate = (): Date | undefined => {
        if (localMode === 'before' || localMode === 'after') return localSingleDate;
        return undefined;
    };

    const renderMonth = (year: number, monthIdx: number, side: 'left' | 'right') => {
        const firstDay = new Date(year, monthIdx, 1);
        const lastDay = new Date(year, monthIdx + 1, 0);
        const startWeekday = firstDay.getDay();
        const daysInMonth = lastDay.getDate();
        const prevMonthLastDay = new Date(year, monthIdx, 0).getDate();

        const cells: { date: Date; inMonth: boolean }[] = [];
        for (let i = startWeekday - 1; i >= 0; i--) {
            cells.push({
                date: new Date(year, monthIdx - 1, prevMonthLastDay - i),
                inMonth: false,
            });
        }
        for (let i = 1; i <= daysInMonth; i++) {
            cells.push({date: new Date(year, monthIdx, i), inMonth: true});
        }
        while (cells.length % 7 !== 0 || cells.length < 42) {
            const last = cells[cells.length - 1].date;
            cells.push({
                date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1),
                inMonth: false,
            });
            if (cells.length >= 42) break;
        }

        const rangeStart = getRangeStart();
        const rangeEnd = getRangeEnd();
        const singleDate = getSingleDate();

        const isInRange = (d: Date) => {
            if (!rangeStart) return false;
            if (rangeEnd) return d >= rangeStart && d <= rangeEnd;
            return d.getTime() === rangeStart.getTime();
        };
        const isStart = (d: Date) => rangeStart && d.getTime() === rangeStart.getTime();
        const isEnd = (d: Date) => rangeEnd && d.getTime() === rangeEnd.getTime();
        const isSingle = (d: Date) => singleDate && d.getTime() === singleDate.getTime();
        const isToday = (d: Date) => d.getTime() === today.getTime();

        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];
        const monthLabel = `${year}年 ${monthIdx + 1}月`;

        return (
            <div key={`${side}-${year}-${monthIdx}`} className="flex w-64 flex-col">
                <div className="mb-2 flex items-center justify-center">
                    <span className="text-sm font-medium">{monthLabel}</span>
                </div>
                <div className="mb-1 grid grid-cols-7 gap-0">
                    {weekdays.map((w) => (
                        <div key={w} className="py-1 text-center text-xs text-muted-foreground">
                            {w}
                        </div>
                    ))}
                </div>
                <div className="grid grid-cols-7 gap-0">
                    {cells.map(({date, inMonth}, idx) => {
                        const start = inMonth && !!isStart(date);
                        const end = inMonth && !!isEnd(date);
                        const inRange = inMonth && isInRange(date);
                        const single = inMonth && !!isSingle(date);
                        const todayCell = inMonth && isToday(date);
                        const singleRange = start && end;
                        return (
                            <button
                                key={idx}
                                type="button"
                                onClick={() => inMonth && handleDayClick(date)}
                                disabled={!inMonth}
                                className={cn(
                                    'relative flex h-8 w-full items-center justify-center text-xs transition-colors',
                                    inMonth ? 'text-foreground' : 'text-muted-foreground/40',
                                    inRange && !start && !end && 'bg-primary/10 text-foreground',
                                    start && 'rounded-l-sm bg-primary text-primary-foreground',
                                    end && 'rounded-r-sm bg-primary text-primary-foreground',
                                    singleRange && 'rounded-sm',
                                    single && 'rounded-sm bg-primary text-primary-foreground',
                                    inMonth && !inRange && !start && !end && !single && 'hover:bg-accent',
                                )}
                            >
                                <span>{date.getDate()}</span>
                                {todayCell && inMonth && (
                                    <span
                                        className="absolute bottom-1 left-1/2 size-1 -translate-x-1/2 rounded-full bg-primary"/>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    };

    return (
        <div className="relative w-full">
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        size="sm"
                        className={cn(
                            'h-8 w-full justify-start text-xs font-normal',
                            hasValue && 'border-primary text-primary pr-7',
                        )}
                    >
                        <CalendarIcon className="size-3 shrink-0 opacity-50"/>
                        <span className={cn('truncate', !hasValue && 'text-muted-foreground')}>
              {displayText}
            </span>
                    </Button>
                </PopoverTrigger>
                {hasValue && (
                    <button
                        type="button"
                        className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={(e) => {
                            e.stopPropagation();
                            onChange(undefined, undefined);
                        }}
                        aria-label="清除筛选"
                    >
                        <X className="size-3"/>
                    </button>
                )}
                <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
                    <div className="flex">
                        {/* 左侧快捷选项 */}
                        <div className="flex w-28 flex-col gap-0.5 border-r p-2">
                            {PRESETS.map((p) => (
                                <button
                                    key={p.key}
                                    type="button"
                                    onClick={() => handlePresetClick(p.key)}
                                    className={cn(
                                        'rounded-sm px-2 py-1.5 text-left text-xs transition-colors',
                                        localMode === 'preset' && localPreset === p.key
                                            ? 'bg-primary/10 text-primary font-medium'
                                            : 'text-foreground hover:bg-accent',
                                    )}
                                >
                                    {p.label}
                                </button>
                            ))}
                            <div className="my-1 border-t border-border"/>
                            {(['before', 'after'] as const).map((mode) => (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => handleModeClick(mode)}
                                    className={cn(
                                        'rounded-sm px-2 py-1.5 text-left text-xs transition-colors',
                                        localMode === mode
                                            ? 'bg-primary/10 text-primary font-medium'
                                            : 'text-foreground hover:bg-accent',
                                    )}
                                >
                                    {mode === 'before' ? '早于' : '晚于'}
                                </button>
                            ))}
                        </div>
                        {/* 右侧双月日历 */}
                        <div className="p-3">
                            <div className="relative flex items-center justify-between px-2 pb-2">
                                <button
                                    type="button"
                                    onClick={handlePrevMonth}
                                    className="flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                                    aria-label="上个月"
                                >
                                    <ChevronLeft className="size-4"/>
                                </button>
                                <button
                                    type="button"
                                    onClick={handleNextMonth}
                                    className="flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                                    aria-label="下个月"
                                >
                                    <ChevronRight className="size-4"/>
                                </button>
                            </div>
                            <div className="flex gap-4">
                                {renderMonth(leftMonthYear, leftMonthIdx, 'left')}
                                {renderMonth(rightMonthYear, rightMonthIdx, 'right')}
                            </div>
                        </div>
                    </div>
                    {/* 底部操作按钮 */}
                    <div className="flex items-center justify-between border-t px-3 py-2">
                        <button
                            type="button"
                            onClick={handleClear}
                            className="text-xs text-muted-foreground hover:text-foreground"
                        >
                            清空
                        </button>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleCancel}>
                                取消
                            </Button>
                            <Button
                                size="sm"
                                className="h-7 bg-emerald-600 text-xs text-white hover:bg-emerald-700"
                                onClick={handleConfirm}
                            >
                                确认
                            </Button>
                        </div>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
};

// -----------------------------------------------------------------------
// FilterBar
// -----------------------------------------------------------------------

const EMPTY_FILTERS: AdDataFilterParams = getDefaultFilters();

const FilterBar: React.FC<FilterBarProps> = ({
                                                 filters,
                                                 onChange,
                                                 onRefresh,
                                                 hideFields = [],
                                                 showInvestDays = false,
                                                 showProductionDate = false,
                                                 showYesterdayCostMin = false,
                                                 showRenovationStatus = false
                                             }) => {
    const [options, setOptions] = useState<FilterOptions | null>(null);
    const [keywordInput, setKeywordInput] = useState(filters.keyword ?? '');
    const [creativeIdInput, setCreativeIdInput] = useState(filters.creativeIdentityId ?? '');
    const [videoMaterialIdInput, setVideoMaterialIdInput] = useState(filters.videoMaterialId ?? '');
    const filtersRef = useRef(filters);
    filtersRef.current = filters;

    useEffect(() => {
        void (async () => {
            try {
                const {data} = await getFilterOptions();
                setOptions(data);
            } catch (err) {
                logger.error('Failed to load filter options:', err);
            }
        })();
    }, []);

    useEffect(() => {
        const timer = setTimeout(() => {
            const current = filtersRef.current.keyword ?? '';
            if (keywordInput !== current) {
                onChange({...filtersRef.current, keyword: keywordInput || undefined});
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [keywordInput, onChange]);

    useEffect(() => {
        setKeywordInput(filters.keyword ?? '');
    }, [filters.keyword]);

    useEffect(() => {
        const timer = setTimeout(() => {
            const current = filtersRef.current.creativeIdentityId ?? '';
            if (creativeIdInput !== current) {
                onChange({...filtersRef.current, creativeIdentityId: creativeIdInput || undefined});
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [creativeIdInput, onChange]);

    useEffect(() => {
        setCreativeIdInput(filters.creativeIdentityId ?? '');
    }, [filters.creativeIdentityId]);

    useEffect(() => {
        const timer = setTimeout(() => {
            const current = filtersRef.current.videoMaterialId ?? '';
            if (videoMaterialIdInput !== current) {
                onChange({...filtersRef.current, videoMaterialId: videoMaterialIdInput || undefined});
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [videoMaterialIdInput, onChange]);

    useEffect(() => {
        setVideoMaterialIdInput(filters.videoMaterialId ?? '');
    }, [filters.videoMaterialId]);

    const update = useCallback(
        (patch: Partial<AdDataFilterParams>) => {
            onChange({...filters, ...patch});
        },
        [filters, onChange],
    );

    const handleReset = useCallback(() => {
        onChange({...EMPTY_FILTERS});
        setKeywordInput('');
    }, [onChange]);

    const fieldClass = 'flex flex-col gap-1 min-w-[140px]';

    return (
        <div>
            <div className="flex flex-wrap items-end gap-3">
                {/* 首消日期 */}
                <div className={fieldClass}>
                    <label className="text-xs font-medium text-muted-foreground">首消日期</label>
                    <FirstConsumptionDatePicker
                        dateMode={filters.dateMode}
                        dateValue={filters.dateStart}
                        onChange={(mode, date) => update({dateMode: mode, dateStart: date})}
                    />
                </div>

                {/* 代理商 */}
                <div className={fieldClass}>
                    <label className="text-xs font-medium text-muted-foreground">代理商</label>
                    <MultiSelect
                        label="代理商"
                        options={options?.agents ?? []}
                        selected={filters.agent ?? []}
                        onChange={(v) => update({agent: v.length > 0 ? v : undefined})}
                    />
                </div>

                {/* 素材类型 */}
                <div className={fieldClass}>
                    <label className="text-xs font-medium text-muted-foreground">素材类型</label>
                    <MultiSelect
                        label="素材类型"
                        options={options?.materialTypes ?? []}
                        selected={filters.materialType ?? []}
                        onChange={(v) => update({materialType: v.length > 0 ? v : undefined})}
                    />
                </div>

                {/* 素材方向 */}
                <div className={fieldClass}>
                    <label className="text-xs font-medium text-muted-foreground">素材方向</label>
                    <MultiSelect
                        label="素材方向"
                        options={options?.materialDirections ?? []}
                        selected={filters.materialDirection ?? []}
                        onChange={(v) => update({materialDirection: v.length > 0 ? v : undefined})}
                    />
                </div>

                {/* 人群类型 */}
                <div className={fieldClass}>
                    <label className="text-xs font-medium text-muted-foreground">人群类型</label>
                    <MultiSelect
                        label="人群类型"
                        options={options?.newOrActive ?? []}
                        selected={filters.newOrActive ?? []}
                        onChange={(v) => update({newOrActive: v.length > 0 ? v : undefined})}
                    />
                </div>

                {/* 国家 */}
                <div className={fieldClass}>
                    <label className="text-xs font-medium text-muted-foreground">国家</label>
                    <MultiSelect
                        label="国家"
                        options={options?.countries ?? []}
                        selected={filters.country ?? []}
                        onChange={(v) => update({country: v.length > 0 ? v : undefined})}
                        formatLabel={getCountryDisplayCode}
                    />
                </div>

                {/* 投放人 */}
                {!hideFields.includes('advertiser') && (
                    <div className={fieldClass}>
                        <label className="text-xs font-medium text-muted-foreground">投放人</label>
                        <MultiSelect
                            label="投放人"
                            options={options?.advertisers ?? []}
                            selected={filters.advertiser ?? []}
                            onChange={(v) => update({advertiser: v.length > 0 ? v : undefined})}
                        />
                    </div>
                )}

                {/* 创意身份ID */}
                <div className={fieldClass}>
                    <label className="text-xs font-medium text-muted-foreground">创意身份ID</label>
                    <Input
                        placeholder="输入创意身份ID"
                        value={creativeIdInput}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCreativeIdInput(e.target.value)}
                        className="h-8 text-xs"
                    />
                </div>

                {/* 视频素材ID */}
                <div className={fieldClass}>
                    <label className="text-xs font-medium text-muted-foreground">视频素材ID</label>
                    <Input
                        placeholder="输入视频素材ID"
                        value={videoMaterialIdInput}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVideoMaterialIdInput(e.target.value)}
                        className="h-8 text-xs"
                    />
                </div>

                {/* 消耗时间（两次点击选范围） */}
                <div className={fieldClass}>
                    <label className="text-xs font-medium text-muted-foreground">消耗时间</label>
                    <DateRangePicker
                        startDate={filters.investTimeStart}
                        endDate={filters.investTimeEnd}
                        onChange={(start, end) => update({investTimeStart: start, investTimeEnd: end})}
                    />
                </div>

                {/* 昨天消耗 */}
                {showYesterdayCostMin && (
                    <div className={fieldClass}>
                        <label className="text-xs font-medium text-muted-foreground">昨天消耗</label>
                        <div className="flex h-8 items-center gap-1">
                            <Input
                                type="number"
                                min={0}
                                className="h-8 w-20 text-xs"
                                placeholder="≥"
                                value={filters.yesterdayCostMin ?? ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const v = e.target.value;
                                    update({yesterdayCostMin: v ? Number(v) : undefined});
                                }}
                            />
                            <span className="text-xs text-muted-foreground">美元</span>
                        </div>
                    </div>
                )}

                {/* 在投天数 */}
                {showInvestDays && (
                    <div className={fieldClass}>
                        <label className="text-xs font-medium text-muted-foreground">在投天数</label>
                        <div className="flex h-8 items-center gap-1">
                            <Input
                                type="number"
                                min={1}
                                className="h-8 w-16 text-xs"
                                placeholder="≥"
                                value={filters.investDaysMin ?? ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const v = e.target.value;
                                    update({investDaysMin: v ? Number(v) : undefined});
                                }}
                            />
                            <span className="text-xs text-muted-foreground">—</span>
                            <Input
                                type="number"
                                min={1}
                                className="h-8 w-16 text-xs"
                                placeholder="≤"
                                value={filters.investDaysMax ?? ''}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                                    const v = e.target.value;
                                    update({investDaysMax: v ? Number(v) : undefined});
                                }}
                            />
                        </div>
                    </div>
                )}

                {/* 制作日期 */}
                {showProductionDate && (
                    <div className={fieldClass}>
                        <label className="text-xs font-medium text-muted-foreground">制作日期</label>
                        <DateRangePicker
                            startDate={filters.productionDateStart}
                            endDate={filters.productionDateEnd}
                            onChange={(start, end) => update({
                                productionDateStart: start,
                                productionDateEnd: end,
                                productionDateEmpty: false
                            })}
                        />
                        <label
                            className="flex items-center gap-1.5 mt-1.5 text-[11px] text-muted-foreground cursor-pointer select-none">
                            <input
                                type="checkbox"
                                className="size-3 accent-primary"
                                checked={!!filters.productionDateEmpty}
                                onChange={(e) => {
                                    if (e.target.checked) {
                                        update({
                                            productionDateStart: '',
                                            productionDateEnd: '',
                                            productionDateEmpty: true
                                        });
                                    } else {
                                        update({productionDateEmpty: false});
                                    }
                                }}
                            />
                            仅看制作日期为空
                        </label>
                    </div>
                )}

                {/* 关键词 */}
                <div className={fieldClass}>
                    <label className="text-xs font-medium text-muted-foreground">关键词</label>
                    <div className="relative w-full">
                        <Input
                            className={cn('h-8 text-xs', keywordInput && 'pr-7')}
                            placeholder="搜索关键词"
                            value={keywordInput}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                setKeywordInput(e.target.value)
                            }
                            onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                                if (e.key === 'Enter') {
                                    onChange({...filtersRef.current, keyword: keywordInput || undefined});
                                }
                            }}
                        />
                        {keywordInput && (
                            <button
                                type="button"
                                className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                                onClick={() => {
                                    setKeywordInput('');
                                    onChange({...filtersRef.current, keyword: undefined});
                                }}
                                aria-label="清除筛选"
                            >
                                <X className="size-3"/>
                            </button>
                        )}
                    </div>
                </div>

                {/* 已置信数据 */}
                <div className={fieldClass}>
                    <label className="text-xs font-medium text-muted-foreground">已置信数据</label>
                    <label className="flex h-8 cursor-pointer items-center gap-2">
                        <Checkbox
                            checked={!!filters.trustedData}
                            onCheckedChange={(checked) => update({trustedData: checked === true ? true : undefined})}
                        />
                        <span className="text-xs text-muted-foreground">仅显示T-8天前数据</span>
                    </label>
                </div>

                {showRenovationStatus && (
                    <div className={fieldClass}>
                        <label className="text-xs font-medium text-muted-foreground">二改提需状态</label>
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button variant="outline" size="sm"
                                        className="h-8 w-[130px] justify-between text-xs font-normal">
                                    {filters.renovationStatusFilter ?? '全部'}
                                    <ChevronDown className="size-3 opacity-50"/>
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[140px] p-1" align="start">
                                {['全部', '已提二改需求', '未提'].map((opt) => (
                                    <button
                                        key={opt}
                                        type="button"
                                        className={cn(
                                            'w-full rounded-sm px-2 py-1.5 text-left text-xs hover:bg-accent',
                                            (filters.renovationStatusFilter ?? '全部') === opt && 'bg-accent font-medium',
                                        )}
                                        onClick={() => update({renovationStatusFilter: opt === '全部' ? undefined : opt})}
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </PopoverContent>
                        </Popover>
                    </div>
                )}

                {/* 刷新 + 重置按钮 */}
                <div className="ml-auto flex items-center gap-1">
                    {onRefresh && (
                        <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={onRefresh}>
                            <RefreshCw className="size-3"/>
                            刷新
                        </Button>
                    )}
                    <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={handleReset}>
                        <RotateCcw className="size-3"/>
                        重置筛选
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default FilterBar;
