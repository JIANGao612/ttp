import React, {useCallback, useEffect, useRef, useState} from 'react';
import {ChevronDown, RotateCcw, Search, X, RefreshCw} from 'lucide-react';
import {Button} from '@client/src/components/ui/button';
import {Input} from '@client/src/components/ui/input';
import {Checkbox} from '@client/src/components/ui/checkbox';
import {Popover, PopoverContent, PopoverTrigger} from '@client/src/components/ui/popover';
import {ScrollArea} from '@client/src/components/ui/scroll-area';
import {logger} from '@client/src/utils/logger';
import {getFilterOptions} from '@client/src/api/ad-data';
import {getGroupNames} from '@client/src/api/team-member-mapping';
import type {AdDataFilterParams, FilterOptions} from '@shared/api.interface';
import {cn} from '@/lib/utils';
import {getDefaultFilters, getTabDefaultDateRange} from '../shared/default-date-range';
import {getCountryDisplayCode} from '@shared/country-utils';
import FilterRow from '@client/src/components/FilterRow';
import KeywordSearchCombo, {type KeywordFieldOption} from '@client/src/components/KeywordSearchCombo';
import {DateRangePicker} from '@client/src/components/date-range-picker';

interface FilterBarProps {
    filters: AdDataFilterParams;
    onChange: (filters: AdDataFilterParams) => void;
    onRefresh?: () => void;
    hideFields?: string[];
    showInvestDays?: boolean;
    showProductionDate?: boolean;
    showYesterdayCostMin?: boolean;
    showRenovationStatus?: boolean;
    /** 显示组别筛选（日报/时报页专用） */
    showGroupFilter?: boolean;
    /** 主筛选字段键白名单；提供时其余可见字段收进「更多筛选」折叠区，未提供则保持全部可见 */
    primaryFields?: string[];
    /** ID 搜索是否固定放主筛选区（默认 true；false 时按 primaryFields 白名单归位） */
    idSearchPrimary?: boolean;
    /** 主筛选区按 primaryFields 数组顺序排列（默认 false，保持字段定义顺序） */
    orderPrimaryByList?: boolean;
    /** 消耗日期筛选旁显示「恢复默认」按钮（近三天不含当天） */
    showInvestTimeReset?: boolean;
    /** 恢复默认按钮取哪个 tab 的默认范围 */
    investTimeResetTab?: string;
    /** 恢复默认点击后重置全部筛选为默认值（近七天 + 默认代理商） */
    investTimeResetAll?: boolean;
    /** 关键词搜索字段下拉选项；提供时在关键词旁显示「搜索字段」筛选 */
    keywordFieldOptions?: KeywordFieldOption[];
    /** 是否显示搜索字段筛选（隐藏时收入更多筛选之外） */
    showKeywordFields?: boolean;
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
// FilterBar
// -----------------------------------------------------------------------

const EMPTY_FILTERS: AdDataFilterParams = getDefaultFilters();

/** 筛选栏字段键（idSearch 为合并后的 ID 搜索，始终可见、不参与折叠） */
export type FilterFieldKey =
    | 'firstConsumptionDate'
    | 'agent'
    | 'materialType'
    | 'materialDirection'
    | 'newOrActive'
    | 'country'
    | 'advertiser'
    | 'group'
    | 'idSearch'
    | 'investTime'
    | 'yesterdayCost'
    | 'investDays'
    | 'productionDate'
    | 'keyword'
    | 'keywordFields'
    | 'trustedData'
    | 'renovationStatus';

interface FieldEntry {
    key: FilterFieldKey;
    node: React.ReactNode;
}

/** 将 ID搜索 输入按逗号/空格等分隔符拆分为去重后的 ID 列表 */
function parseIdSearch(value: string): string[] {
    const parts: string[] = value.split(/[,，、;；\s]+/u);
    const result: string[] = [];
    for (const part of parts) {
        const trimmed: string = part.trim();
        if (trimmed && !result.includes(trimmed)) result.push(trimmed);
    }
    return result;
}

/** 归一化 creativeIdentityId / videoMaterialId 参数为 ID 数组 */
function toIdArray(value: string | string[] | undefined): string[] {
    if (value === undefined) return [];
    if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
    return value.map((v: string) => v.trim()).filter((v: string) => v.length > 0);
}

function sameIdList(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    return a.every((v: string, i: number) => v === b[i]);
}

function arrEqualsDefault(arr: string[] | undefined, def: string[] | undefined): boolean {
    const left: string[] = arr ?? [];
    const right: string[] = def ?? [];
    if (left.length !== right.length) return false;
    return left.every((v: string) => right.includes(v));
}

/** 判断某筛选字段是否处于激活状态（相对默认值） */
function isFieldActive(key: FilterFieldKey, f: AdDataFilterParams): boolean {
    switch (key) {
        case 'firstConsumptionDate':
            return (
                (f.dateStart ?? '') !== (EMPTY_FILTERS.dateStart ?? '') ||
                (f.dateMode ?? '') !== (EMPTY_FILTERS.dateMode ?? '')
            );
        case 'agent':
            return !arrEqualsDefault(f.agent, EMPTY_FILTERS.agent);
        case 'materialType':
            return (f.materialType ?? []).length > 0;
        case 'materialDirection':
            return (f.materialDirection ?? []).length > 0;
        case 'newOrActive':
            return (f.newOrActive ?? []).length > 0;
        case 'country':
            return (f.country ?? []).length > 0;
        case 'advertiser':
            return (f.advertiser ?? []).length > 0;
        case 'group':
            return (f.group ?? []).length > 0;
        case 'investTime':
            return (
                (f.investTimeStart ?? '') !== (EMPTY_FILTERS.investTimeStart ?? '') ||
                (f.investTimeEnd ?? '') !== (EMPTY_FILTERS.investTimeEnd ?? '')
            );
        case 'yesterdayCost':
            return f.yesterdayCostMin !== undefined;
        case 'investDays':
            return f.investDaysMin !== undefined || f.investDaysMax !== undefined;
        case 'productionDate':
            return !!(f.productionDateStart || f.productionDateEnd) || !!f.productionDateEmpty;
        case 'keyword':
            return (!!f.keyword && f.keyword.trim().length > 0) || (f.keywordFields ?? []).length > 0;
        case 'keywordFields':
            return (f.keywordFields ?? []).length > 0;
        case 'trustedData':
            return !!f.trustedData;
        case 'renovationStatus':
            return !!f.renovationStatusFilter;
        default:
            return false;
    }
}

const FilterBar: React.FC<FilterBarProps> = ({
                                                 filters,
                                                 onChange,
                                                 onRefresh,
                                                 hideFields = [],
                                                 showInvestDays = false,
                                                 showProductionDate = false,
                                                 showYesterdayCostMin = false,
                                                 showRenovationStatus = false,
                                                 showGroupFilter = false,
                                                 primaryFields,
                                                 idSearchPrimary = true,
                                                 orderPrimaryByList = false,
                                                 showInvestTimeReset = false,
                                                 investTimeResetTab = 'country-pivot',
                                                 investTimeResetAll = false,
                                                 showKeywordFields = false,
                                                 keywordFieldOptions
                                             }) => {
    const [options, setOptions] = useState<FilterOptions | null>(null);
    const [groupOptions, setGroupOptions] = useState<string[]>([]);
    const [keywordInput, setKeywordInput] = useState(filters.keyword ?? '');
    const [idSearchInput, setIdSearchInput] = useState<string>(() =>
        toIdArray(filters.idSearch).join(', '));
    const lastPushedIdsRef = useRef<string[]>(toIdArray(filters.idSearch));
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
        if (!showGroupFilter) return;
        void (async () => {
            try {
                const {data} = await getGroupNames();
                setGroupOptions(data.groupNames ?? []);
            } catch (err) {
                logger.error('Failed to load group names:', err);
            }
        })();
    }, [showGroupFilter]);

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
            const ids: string[] = parseIdSearch(idSearchInput);
            if (!sameIdList(ids, toIdArray(filtersRef.current.idSearch))) {
                lastPushedIdsRef.current = ids;
                onChange({
                    ...filtersRef.current,
                    idSearch: ids.length > 0 ? ids : undefined,
                });
            }
        }, 500);
        return () => clearTimeout(timer);
    }, [idSearchInput, onChange]);

    useEffect(() => {
        const external = toIdArray(filters.idSearch);
        if (!sameIdList(external, lastPushedIdsRef.current)) {
            lastPushedIdsRef.current = external;
            setIdSearchInput(external.join(', '));
        }
    }, [filters.idSearch]);

    const update = useCallback(
        (patch: Partial<AdDataFilterParams>) => {
            onChange({...filters, ...patch});
        },
        [filters, onChange],
    );

    const handleReset = useCallback(() => {
        const base: AdDataFilterParams = {...EMPTY_FILTERS};
        if (showInvestTimeReset) {
            const range = getTabDefaultDateRange(investTimeResetTab);
            if (range) {
                base.investTimeStart = range.start;
                base.investTimeEnd = range.end;
            }
        }
        onChange(base);
        setKeywordInput('');
        setIdSearchInput('');
    }, [onChange, showInvestTimeReset, investTimeResetTab]);

    const fieldClass = 'flex flex-col gap-1 min-w-[140px]';

    const idSearchNode: React.ReactNode = (
        <div className={fieldClass}>
            <label className="text-xs font-medium text-muted-foreground">ID搜索</label>
            <div className="relative w-full">
                <Input
                    className={cn('h-8 w-56 text-xs', idSearchInput && 'pr-7')}
                    placeholder="ID搜索，逗号分隔"
                    value={idSearchInput}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setIdSearchInput(e.target.value)}
                />
                {idSearchInput && (
                    <button
                        type="button"
                        className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={() => {
                            setIdSearchInput('');
                            onChange({...filtersRef.current, idSearch: undefined});
                        }}
                        aria-label="清除ID搜索"
                    >
                        <X className="size-3"/>
                    </button>
                )}
            </div>
        </div>
    );

    const fcRangeMatch: RegExpMatchArray | null =
        filters.dateMode === 'range' && filters.dateStart
            ? filters.dateStart.match(/^(\d{4}-\d{2}-\d{2})~(\d{4}-\d{2}-\d{2})$/u)
            : null;
    const fcStartDate: string | undefined = fcRangeMatch ? fcRangeMatch[1] : undefined;
    const fcEndDate: string | undefined = fcRangeMatch ? fcRangeMatch[2] : undefined;

    const fieldEntries: FieldEntry[] = [
        {
            key: 'firstConsumptionDate',
            node: (
                <div className={fieldClass}>
                    <label className="text-xs font-medium text-muted-foreground">首消日期</label>
                    <DateRangePicker
                        startDate={fcStartDate}
                        endDate={fcEndDate}
                        onChange={(start: string | undefined, end: string | undefined) =>
                            start && end
                                ? update({dateMode: 'range', dateStart: `${start}~${end}`})
                                : update({dateMode: undefined, dateStart: undefined})
                        }
                    />
                </div>
            ),
        },
        {
            key: 'agent',
            node: (
                <div className={fieldClass}>
                    <label className="text-xs font-medium text-muted-foreground">代理商</label>
                    <MultiSelect
                        label="代理商"
                        options={options?.agents ?? []}
                        selected={filters.agent ?? []}
                        onChange={(v) => update({agent: v.length > 0 ? v : undefined})}
                    />
                </div>
            ),
        },
        {
            key: 'materialType',
            node: (
                <div className={fieldClass}>
                    <label className="text-xs font-medium text-muted-foreground">素材类型</label>
                    <MultiSelect
                        label="素材类型"
                        options={options?.materialTypes ?? []}
                        selected={filters.materialType ?? []}
                        onChange={(v) => update({materialType: v.length > 0 ? v : undefined})}
                    />
                </div>
            ),
        },
        {
            key: 'materialDirection',
            node: (
                <div className={fieldClass}>
                    <label className="text-xs font-medium text-muted-foreground">素材方向</label>
                    <MultiSelect
                        label="素材方向"
                        options={options?.materialDirections ?? []}
                        selected={filters.materialDirection ?? []}
                        onChange={(v) => update({materialDirection: v.length > 0 ? v : undefined})}
                    />
                </div>
            ),
        },
        {
            key: 'newOrActive',
            node: (
                <div className={fieldClass}>
                    <label className="text-xs font-medium text-muted-foreground">人群类型</label>
                    <MultiSelect
                        label="人群类型"
                        options={options?.newOrActive ?? []}
                        selected={filters.newOrActive ?? []}
                        onChange={(v) => update({newOrActive: v.length > 0 ? v : undefined})}
                    />
                </div>
            ),
        },
        {
            key: 'country',
            node: (
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
            ),
        },
        {
            key: 'advertiser',
            node: (
                <div className={fieldClass}>
                    <label className="text-xs font-medium text-muted-foreground">投放人</label>
                    <MultiSelect
                        label="投放人"
                        options={options?.advertisers ?? []}
                        selected={filters.advertiser ?? []}
                        onChange={(v) => update({advertiser: v.length > 0 ? v : undefined})}
                    />
                </div>
            ),
        },
        {
            key: 'group',
            node: (
                <div className={fieldClass}>
                    <label className="text-xs font-medium text-muted-foreground">组别</label>
                    <MultiSelect
                        label="组别"
                        options={groupOptions}
                        selected={filters.group ?? []}
                        onChange={(v) => update({group: v.length > 0 ? v : undefined})}
                    />
                </div>
            ),
        },
        {key: 'idSearch', node: idSearchNode},
        {
            key: 'investTime',
            node: (
                <div className={fieldClass}>
                    <div className="flex items-center justify-between gap-2">
                        <label className="text-xs font-medium text-muted-foreground">消耗日期</label>
                        {showInvestTimeReset && (
                            <button
                                type="button"
                                className="text-[11px] text-primary hover:underline"
                                onClick={() => {
                                    if (investTimeResetAll) {
                                        onChange(getDefaultFilters());
                                        return;
                                    }
                                    const range = getTabDefaultDateRange(investTimeResetTab);
                                    if (range) update({investTimeStart: range.start, investTimeEnd: range.end});
                                }}
                            >
                                恢复默认
                            </button>
                        )}
                    </div>
                    <DateRangePicker
                        startDate={filters.investTimeStart}
                        endDate={filters.investTimeEnd}
                        onChange={(start, end) => update({investTimeStart: start, investTimeEnd: end})}
                    />
                </div>
            ),
        },
        {
            key: 'yesterdayCost',
            node: (
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
            ),
        },
        {
            key: 'investDays',
            node: (
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
            ),
        },
        {
            key: 'productionDate',
            node: (
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
                                    update({productionDateStart: '', productionDateEnd: '', productionDateEmpty: true});
                                } else {
                                    update({productionDateEmpty: false});
                                }
                            }}
                        />
                        仅看制作日期为空
                    </label>
                </div>
            ),
        },
        {
            key: 'keyword',
            node: (
                <div className={fieldClass}>
                    <label className="text-xs font-medium text-muted-foreground">关键词</label>
                    {keywordFieldOptions && keywordFieldOptions.length > 0 ? (
                        <KeywordSearchCombo
                            className="w-full min-w-[240px]"
                            value={keywordInput}
                            onInputChange={setKeywordInput}
                            onEnter={() => onChange({...filtersRef.current, keyword: keywordInput || undefined})}
                            onClear={() => {
                                setKeywordInput('');
                                onChange({...filtersRef.current, keyword: undefined});
                            }}
                            fields={keywordFieldOptions}
                            selectedFields={filters.keywordFields ?? []}
                            onFieldsChange={(next: string[]) => onChange({
                                ...filtersRef.current,
                                keywordFields: next.length > 0 ? next : undefined
                            })}
                        />
                    ) : (
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
                    )}
                </div>
            ),
        },
        {
            key: 'trustedData',
            node: (
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
            ),
        },
        {
            key: 'renovationStatus',
            node: (
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
            ),
        },
    ];

    const hiddenKeys: FilterFieldKey[] = [];
    if (hideFields.includes('advertiser')) hiddenKeys.push('advertiser');
    if (hideFields.includes('keyword')) {
        hiddenKeys.push('keyword');
        hiddenKeys.push('keywordFields');
    }
    if (!showGroupFilter) hiddenKeys.push('group');
    if (!showYesterdayCostMin) hiddenKeys.push('yesterdayCost');
    if (!showInvestDays) hiddenKeys.push('investDays');
    if (!showProductionDate) hiddenKeys.push('productionDate');
    if (!showRenovationStatus) hiddenKeys.push('renovationStatus');

    const visibleEntries: FieldEntry[] = fieldEntries.filter((e: FieldEntry) => !hiddenKeys.includes(e.key));
    const collapseEnabled: boolean = primaryFields !== undefined;
    const primaryList: string[] = primaryFields ?? [];
    const basePrimary: FieldEntry[] = collapseEnabled
        ? visibleEntries.filter((e: FieldEntry) => (idSearchPrimary && e.key === 'idSearch') || primaryList.includes(e.key))
        : visibleEntries;
    const primaryEntries: FieldEntry[] = collapseEnabled && orderPrimaryByList
        ? [
            ...primaryList.flatMap((k: string) => {
                const hit = basePrimary.find((e: FieldEntry) => e.key === k);
                return hit ? [hit] : [];
            }),
            ...(idSearchPrimary ? basePrimary.filter((e: FieldEntry) => e.key === 'idSearch') : []),
        ]
        : basePrimary;
    const secondaryEntries: FieldEntry[] = collapseEnabled
        ? visibleEntries.filter((e: FieldEntry) => !(idSearchPrimary && e.key === 'idSearch') && !primaryList.includes(e.key))
        : [];
    const activeSecondaryCount: number = secondaryEntries.filter((e: FieldEntry) => isFieldActive(e.key, filters)).length;

    return (
        <FilterRow
            items={primaryEntries.map((e: FieldEntry) => (
                <React.Fragment key={e.key}>{e.node}</React.Fragment>
            ))}
            preCollapsed={secondaryEntries.map((e: FieldEntry) => (
                <React.Fragment key={e.key}>{e.node}</React.Fragment>
            ))}
            preCollapsedActiveCount={activeSecondaryCount}
            actions={
                <>
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
                </>
            }
        />
    );
};

export default FilterBar;
