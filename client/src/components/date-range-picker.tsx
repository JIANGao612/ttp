import React, {useState} from 'react';
import {ChevronLeft, ChevronRight, CalendarIcon, X} from 'lucide-react';
import {Button} from '@client/src/components/ui/button';
import {Popover, PopoverContent, PopoverTrigger} from '@client/src/components/ui/popover';
import {cn} from '@/lib/utils';

export interface DateRangePickerProps {
    startDate?: string;
    endDate?: string;
    onChange: (start: string | undefined, end: string | undefined) => void;
    placeholder?: string;
    label?: string;
    className?: string;
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

export function formatLocalDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

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

export interface RangeCalendarPanelProps {
    startDate?: string;
    endDate?: string;
    onApply: (start: string | undefined, end: string | undefined) => void;
    onClose: () => void;
}

export const RangeCalendarPanel: React.FC<RangeCalendarPanelProps> = ({
                                                                          startDate, endDate, onApply, onClose,
                                                                      }) => {
    const today = getBeijingToday();
    const initialStart = startDate ? new Date(startDate) : undefined;

    const [viewMonth, setViewMonth] = useState<Date>(
        initialStart ? startOfMonth(initialStart) : startOfMonth(today),
    );
    const [localStart, setLocalStart] = useState<Date | undefined>(initialStart);
    const [localEnd, setLocalEnd] = useState<Date | undefined>(
        endDate ? new Date(endDate) : undefined,
    );
    const [clickCount, setClickCount] = useState(0);
    const [activePreset, setActivePreset] = useState<string>('');

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
        } else if (localStart) {
            setLocalEnd(day);
            setClickCount(0);
        }
    };

    const handleConfirm = () => {
        if (localStart && localEnd) {
            onApply(formatLocalDate(localStart), formatLocalDate(localEnd));
        } else if (localStart && !localEnd) {
            onApply(formatLocalDate(localStart), undefined);
        } else {
            onApply(undefined, undefined);
        }
        onClose();
    };

    const handleClear = () => {
        setLocalStart(undefined);
        setLocalEnd(undefined);
        setClickCount(0);
        setActivePreset('');
        onApply(undefined, undefined);
        onClose();
    };

    const secondMonth = addMonths(viewMonth, 1);
    const months: { year: number; monthIdx: number; side: 'left' | 'right' }[] = [
        {year: viewMonth.getFullYear(), monthIdx: viewMonth.getMonth(), side: 'left'},
        {year: secondMonth.getFullYear(), monthIdx: secondMonth.getMonth(), side: 'right'},
    ];

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
        const isStart = (d: Date) => !!localStart && d.getTime() === localStart.getTime();
        const isEnd = (d: Date) => !!localEnd && d.getTime() === localEnd.getTime();
        const isToday = (d: Date) => d.getTime() === today.getTime();

        const weekdays = ['日', '一', '二', '三', '四', '五', '六'];

        return (
            <div key={`${side}-${year}-${monthIdx}`} className="flex w-64 flex-col">
                <div className="mb-2 flex items-center justify-center">
                    <span className="text-sm font-medium">{year}年 {monthIdx + 1}月</span>
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
                                {todayCell && (
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
        <div>
            <div className="flex">
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
                <div className="p-3">
                    <div className="relative flex items-center justify-between px-2 pb-2">
                        <button
                            type="button"
                            onClick={() => setViewMonth(addMonths(viewMonth, -1))}
                            className="flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                            aria-label="上个月"
                        >
                            <ChevronLeft className="size-4"/>
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMonth(addMonths(viewMonth, 1))}
                            className="flex size-7 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                            aria-label="下个月"
                        >
                            <ChevronRight className="size-4"/>
                        </button>
                    </div>
                    <div className="flex gap-4">
                        {months.map((mo) => renderMonth(mo.year, mo.monthIdx, mo.side))}
                    </div>
                </div>
            </div>
            <div className="flex items-center justify-between border-t px-3 py-2">
                <button
                    type="button"
                    onClick={handleClear}
                    className="text-xs text-muted-foreground hover:text-foreground"
                >
                    清空
                </button>
                <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={onClose}>
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
        </div>
    );
};

export function DateRangePicker({
                                    startDate,
                                    endDate,
                                    onChange,
                                    placeholder,
                                    label,
                                    className,
                                }: DateRangePickerProps): React.ReactNode {
    const [open, setOpen] = useState(false);

    const fallbackText = placeholder ?? (label ? `选择${label}` : '选择日期范围');
    const hasValue = !!startDate;
    const displayText = startDate && endDate
        ? `${startDate} ~ ${endDate}`
        : startDate
            ? `${startDate} ~ ?`
            : fallbackText;

    return (
        <div className={cn('relative w-full', className)}>
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
                <PopoverContent
                    className="w-auto max-w-[calc(100vw-16px)] overflow-auto p-0"
                    align="start"
                    sideOffset={4}
                >
                    <RangeCalendarPanel
                        startDate={startDate}
                        endDate={endDate}
                        onApply={onChange}
                        onClose={() => setOpen(false)}
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
}

export default DateRangePicker;
