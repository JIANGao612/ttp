import React from 'react';
import {useCellSelection} from './CellSelectionContext';
import {SelectionStatsView} from '@/components/selection-stats/SelectionStatsView';

interface SelectionStatsBarProps {
    className?: string;
}

const SelectionStatsBar: React.FC<SelectionStatsBarProps> = ({className}) => {
    const ctx = useCellSelection();

    if (!ctx || !ctx.selectionStats) return null;

    const {sum, count, average, hiddenRowsInRange, hiddenColsInRange} = ctx.selectionStats;

    return (
        <SelectionStatsView
            sum={sum}
            count={count}
            average={average}
            hiddenRowsInRange={hiddenRowsInRange}
            hiddenColsInRange={hiddenColsInRange}
            className={className}
        />
    );
};

export {SelectionStatsBar};
