import React, {useState} from 'react';
import {Settings2, Check, RotateCcw} from 'lucide-react';
import {Button} from '@client/src/components/ui/button';
import {Popover, PopoverContent, PopoverTrigger} from '@client/src/components/ui/popover';

export interface ColumnSettingItem {
    label: string;
    colIndices: number[];
    tag?: string;
    group?: string;
}

interface ColumnSettingsButtonProps {
    items: ColumnSettingItem[];
    hiddenCols: number[];
    onToggle: (colIndices: number[]) => void;
    onShowAll: () => void;
    onReset?: () => void;
    resetting?: boolean;
    title?: string;
    buttonLabel?: string;
}

const ColumnSettingsButton: React.FC<ColumnSettingsButtonProps> = ({
                                                                       items,
                                                                       hiddenCols,
                                                                       onToggle,
                                                                       onShowAll,
                                                                       onReset,
                                                                       resetting = false,
                                                                       title = '国家列设置',
                                                                       buttonLabel = '列设置',
                                                                   }) => {
    const [open, setOpen] = useState(false);
    const hiddenSet = new Set(hiddenCols);
    const hiddenCount = items.filter(
        (item: ColumnSettingItem) => item.colIndices.every((c: number) => hiddenSet.has(c))
    ).length;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                    <Settings2 className="size-3"/>
                    {buttonLabel}
                    {hiddenCount > 0 && (
                        <span className="ml-1 rounded bg-muted px-1.5 py-0.5 text-[10px]">
              {hiddenCount}隐藏
            </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-0" align="end">
                <div className="flex items-center justify-between border-b px-3 py-2">
                    <span className="text-xs font-medium">{title}</span>
                    <div className="flex items-center gap-1">
                        {onReset && (
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-xs"
                                onClick={onReset}
                                disabled={resetting}
                            >
                                <RotateCcw className="mr-1 h-3 w-3"/>
                                {resetting ? '恢复中...' : '恢复默认'}
                            </Button>
                        )}
                        <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={onShowAll}
                        >
                            全部显示
                        </Button>
                    </div>
                </div>
                <div className="max-h-72 overflow-y-auto py-1">
                    {items.map((item: ColumnSettingItem, idx: number) => {
                        const isVisible = !item.colIndices.every((c: number) => hiddenSet.has(c));
                        const showGroupHeader = item.group && (idx === 0 || items[idx - 1].group !== item.group);
                        const itemKey = item.label + '-' + item.colIndices.join(',');
                        return (
                            <div key={itemKey}>
                                {showGroupHeader && (
                                    <div
                                        className="border-t px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                                        {item.group}
                                    </div>
                                )}
                                <div
                                    className="flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 hover:bg-muted/50"
                                    onClick={() => onToggle(item.colIndices)}
                                >
                                    <div className="flex items-center gap-2">
                                        <div
                                            className="flex h-4 w-4 items-center justify-center rounded border border-input">
                                            {isVisible && <Check className="size-3"/>}
                                        </div>
                                        <span
                                            className={`text-xs ${item.tag ? 'text-muted-foreground' : ''}`}>{item.label}</span>
                                    </div>
                                    {item.tag && (
                                        <span
                                            className="shrink-0 rounded-sm bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      {item.tag}
                    </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default ColumnSettingsButton;
