import React from 'react';
import {useTableSelection} from './CellInteractionContext';
import {SelectionStatsView} from '@/components/selection-stats/SelectionStatsView';

const TableSelectionStatsBar: React.FC = () => {
    const ctx = useTableSelection();

    if (!ctx || !ctx.selectionStats) return null;

    const {sum, count, average} = ctx.selectionStats;

    return (
        <SelectionStatsView
            sum={sum}
            count={count}
            average={average}
            className="gap-6 px-4 py-2"
        />
    );
};

export default TableSelectionStatsBar;
