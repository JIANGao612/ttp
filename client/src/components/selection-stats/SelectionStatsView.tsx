import React from 'react';
import {cn} from '@/lib/utils';

interface SelectionStatsViewProps {
    sum: number;
    count: number;
    average: number;
    hiddenRowsInRange?: number;
    hiddenColsInRange?: number;
    className?: string;
}

const formatNumber = (value: number): string =>
    value.toLocaleString('zh-CN', {
        maximumFractionDigits: 2,
        minimumFractionDigits: 2,
    });

const SelectionStatsView: React.FC<SelectionStatsViewProps> = ({
                                                                   sum,
                                                                   count,
                                                                   average,
                                                                   hiddenRowsInRange = 0,
                                                                   hiddenColsInRange = 0,
                                                                   className,
                                                               }) => (
    <div
        className={cn(
            'flex items-center gap-4 text-xs text-muted-foreground',
            className,
        )}
    >
    <span className="truncate">
      求和：
      <span className="font-mono font-medium text-foreground">
        {formatNumber(sum)}
      </span>
    </span>
        <span className="truncate">
      平均值：
      <span className="font-mono font-medium text-foreground">
        {formatNumber(average)}
      </span>
    </span>
        <span className="truncate">
      计数：
      <span className="font-mono font-medium text-foreground">{count}</span>
    </span>
        {(hiddenColsInRange > 0 || hiddenRowsInRange > 0) && (
            <span className="truncate">
        含{hiddenColsInRange > 0 ? ` ${hiddenColsInRange} 隐藏列` : ''}{hiddenColsInRange > 0 && hiddenRowsInRange > 0 ? '、' : ''}{hiddenRowsInRange > 0 ? ` ${hiddenRowsInRange} 隐藏行` : ''}
      </span>
        )}
    </div>
);

export {SelectionStatsView};
