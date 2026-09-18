import React from 'react';
import {useCellSelection} from './CellSelectionContext';
import {cn} from '@/lib/utils';

interface SelectionStatsBarProps {
    className?: string;
}

const SelectionStatsBar: React.FC<SelectionStatsBarProps> = ({className}) => {
    const ctx = useCellSelection();

    if (!ctx || !ctx.selectionStats) return null;

    const {sum, count, average} = ctx.selectionStats;

    return (
        <div
            className={cn(
                'flex items-center gap-4 text-xs text-gray-600',
                className,
            )}
        >
      <span className="truncate">
        求和：
        <span className="font-mono font-medium text-gray-800">
          {sum.toLocaleString('zh-CN', {
              maximumFractionDigits: 2,
              minimumFractionDigits: 2,
          })}
        </span>
      </span>
            <span className="truncate">
        平均值：
        <span className="font-mono font-medium text-gray-800">
          {average.toLocaleString('zh-CN', {
              maximumFractionDigits: 2,
              minimumFractionDigits: 2,
          })}
        </span>
      </span>
            <span className="truncate">
        计数：
        <span className="font-mono font-medium text-gray-800">{count}</span>
      </span>
        </div>
    );
};

export {SelectionStatsBar};