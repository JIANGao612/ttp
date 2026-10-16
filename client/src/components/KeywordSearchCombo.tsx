import React, {useMemo, useState} from 'react';
import {ChevronDown, Search, X} from 'lucide-react';
import {Button} from '@client/src/components/ui/button';
import {Checkbox} from '@client/src/components/ui/checkbox';
import {Input} from '@client/src/components/ui/input';
import {Popover, PopoverContent, PopoverTrigger} from '@client/src/components/ui/popover';
import {cn} from '@/lib/utils';

export interface KeywordFieldOption {
    key: string;
    label: string;
}

interface KeywordSearchComboProps {
    value: string;
    onInputChange: (next: string) => void;
    onEnter?: () => void;
    onClear?: () => void;
    fields: KeywordFieldOption[];
    selectedFields: string[];
    onFieldsChange: (next: string[]) => void;
    className?: string;
    placeholder?: string;
}

const KeywordSearchCombo: React.FC<KeywordSearchComboProps> = ({
                                                                   value,
                                                                   onInputChange,
                                                                   onEnter,
                                                                   onClear,
                                                                   fields,
                                                                   selectedFields,
                                                                   onFieldsChange,
                                                                   className,
                                                                   placeholder = '搜索关键词',
                                                               }) => {
    const [open, setOpen] = useState(false);
    const [fieldSearch, setFieldSearch] = useState('');

    const filteredFields = useMemo(() => {
        const kw = fieldSearch.trim().toLowerCase();
        if (!kw) return fields;
        return fields.filter(
            (f: KeywordFieldOption) =>
                f.label.toLowerCase().includes(kw) || f.key.toLowerCase().includes(kw),
        );
    }, [fields, fieldSearch]);

    const toggleField = (key: string) => {
        onFieldsChange(
            selectedFields.includes(key)
                ? selectedFields.filter((v: string) => v !== key)
                : [...selectedFields, key],
        );
    };

    const triggerLabel = useMemo(() => {
        if (selectedFields.length === 0) return '全部';
        if (selectedFields.length === 1) {
            const hit = fields.find((f: KeywordFieldOption) => f.key === selectedFields[0]);
            return hit ? hit.label : '已选 1 个';
        }
        return `已选 ${selectedFields.length} 个`;
    }, [selectedFields, fields]);

    return (
        <div
            className={cn(
                'flex h-8 items-stretch rounded-md border border-input bg-background transition-colors',
                'focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/25',
                className,
            )}
        >
            <div className="relative min-w-0 flex-1">
                <Input
                    className={cn(
                        'h-8 border-0 bg-transparent text-xs shadow-none focus-visible:ring-0',
                        value ? 'pr-7' : 'pr-2',
                    )}
                    placeholder={placeholder}
                    value={value}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => onInputChange(e.target.value)}
                    onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                        if (e.key === 'Enter' && onEnter) onEnter();
                    }}
                    aria-label="搜索关键词"
                />
                {value && (
                    <button
                        type="button"
                        className="absolute right-1.5 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                        onClick={() => {
                            if (onClear) onClear();
                            else onInputChange('');
                        }}
                        aria-label="清除关键词"
                    >
                        <X className="size-3"/>
                    </button>
                )}
            </div>
            <div aria-hidden className="my-1.5 w-px shrink-0 bg-border"/>
            <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        aria-label="选择搜索字段"
                        className="h-full min-w-[72px] shrink-0 justify-between gap-1 rounded-none px-2 text-xs font-normal hover:bg-accent"
                    >
            <span className="flex-1 truncate text-left text-muted-foreground">
              {triggerLabel}
            </span>
                        {selectedFields.length > 0 ? (
                            <span
                                role="button"
                                aria-label="清空搜索字段，回到全表搜索"
                                className="shrink-0 rounded-sm p-0.5 hover:bg-primary/10"
                                onClick={(e: React.MouseEvent) => {
                                    e.stopPropagation();
                                    e.preventDefault();
                                    onFieldsChange([]);
                                }}
                            >
                <X className="h-3 w-3"/>
              </span>
                        ) : (
                            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground"/>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[260px] p-2" align="start">
                    <div className="flex items-center gap-1 border-b border-border pb-2">
                        <Search className="h-3.5 w-3.5 text-muted-foreground"/>
                        <Input
                            className="h-7 border-0 p-0 text-xs shadow-none focus-visible:ring-0"
                            placeholder="搜索字段名..."
                            value={fieldSearch}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFieldSearch(e.target.value)}
                        />
                    </div>
                    <div className="mt-2 max-h-[260px] overflow-y-auto">
                        {filteredFields.length === 0 ? (
                            <div className="py-4 text-center text-xs text-muted-foreground">无匹配字段</div>
                        ) : (
                            filteredFields.map((field: KeywordFieldOption) => (
                                <label
                                    key={field.key}
                                    className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-xs hover:bg-accent"
                                >
                                    <Checkbox
                                        checked={selectedFields.includes(field.key)}
                                        onCheckedChange={() => toggleField(field.key)}
                                        aria-label={`搜索字段 ${field.label}`}
                                    />
                                    <span
                                        className={selectedFields.includes(field.key) ? 'font-medium text-accent-foreground' : ''}>
                    {field.label}
                  </span>
                                </label>
                            ))
                        )}
                    </div>
                    <div className="mt-2 flex justify-end border-t border-border pt-2">
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs"
                            onClick={() => onFieldsChange([])}
                        >
                            全部（全表搜索）
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
};

export default KeywordSearchCombo;
