import React, {createContext, useContext, useMemo} from 'react';
import {cellKey, isInMerge, isMergeOrigin} from './types';
import type {CellData, MergeCell} from './types';

export interface SelectionRange {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
}

export interface SelectionStats {
    sum: number;
    count: number;
    average: number;
    hiddenRowsInRange?: number;
    hiddenColsInRange?: number;
}

export interface CellSelectionState {
    selection: SelectionRange;
    cells: Map<string, CellData>;
    merges: MergeCell[];
    hiddenRows: Set<number>;
    hiddenCols: Set<number>;
    cols: number;
    rows: number;
    extraCells: Set<string>;
    getSelectionRange: () => {
        minR: number;
        maxR: number;
        minC: number;
        maxC: number;
    };
    isInSelection: (row: number, col: number) => boolean;
    selectionStats: SelectionStats | null;
}

const CellSelectionContext = createContext<CellSelectionState | null>(null);

export function useCellSelection(): CellSelectionState | null {
    return useContext(CellSelectionContext);
}

interface CellSelectionProviderProps {
    children: React.ReactNode;
    selection: SelectionRange;
    cells: Map<string, CellData>;
    merges: MergeCell[];
    hiddenRows: Set<number>;
    hiddenCols: Set<number>;
    cols: number;
    rows: number;
    extraCells: Set<string>;
}

export const CellSelectionProvider: React.FC<CellSelectionProviderProps> = ({
                                                                                children,
                                                                                selection,
                                                                                cells,
                                                                                merges,
                                                                                hiddenRows,
                                                                                hiddenCols,
                                                                                cols,
                                                                                rows,
                                                                                extraCells,
                                                                            }) => {
    const getSelectionRange = (): {
        minR: number;
        maxR: number;
        minC: number;
        maxC: number;
    } => {
        const minR = Math.min(selection.startRow, selection.endRow);
        const maxR = Math.max(selection.startRow, selection.endRow);
        const minC = Math.min(selection.startCol, selection.endCol);
        const maxC = Math.max(selection.startCol, selection.endCol);
        return {minR, maxR, minC, maxC};
    };

    const isInSelection = (row: number, col: number): boolean => {
        if (extraCells.has(cellKey(row, col))) return true;
        const {minR, maxR, minC, maxC} = getSelectionRange();
        return row >= minR && row <= maxR && col >= minC && col <= maxC;
    };

    const selectionStats = useMemo((): SelectionStats | null => {
        const {minR, maxR, minC, maxC} = getSelectionRange();

        let hiddenRowsInRange = 0;
        for (let r = minR; r <= maxR; r++) {
            if (hiddenRows.has(r)) hiddenRowsInRange += 1;
        }
        let hiddenColsInRange = 0;
        for (let c = minC; c <= maxC; c++) {
            if (hiddenCols.has(c)) hiddenColsInRange += 1;
        }

        let sum = 0;
        let count = 0;
        for (let r = minR; r <= maxR; r++) {
            for (let c = minC; c <= maxC; c++) {
                const merge = isInMerge(merges, r, c);
                if (merge && !isMergeOrigin(merge, r, c)) continue;
                const cell = cells.get(cellKey(r, c));
                const raw = cell?.value ?? '';
                if (!raw) continue;
                const cleaned = String(raw).replace(/[\s,\$¥€£，]/g, '');
                if (!cleaned) continue;
                const num = Number(cleaned);
                if (Number.isFinite(num)) {
                    sum += num;
                    count += 1;
                }
            }
        }
        for (const key of extraCells) {
            const cell = cells.get(key);
            const raw = cell?.value ?? '';
            if (!raw) continue;
            const cleaned = String(raw).replace(/[\s,\$¥€£，]/g, '');
            if (!cleaned) continue;
            const num = Number(cleaned);
            if (Number.isFinite(num)) {
                sum += num;
                count += 1;
            }
        }
        if (count === 0) return null;
        return {sum, count, average: sum / count, hiddenRowsInRange, hiddenColsInRange};
    }, [selection, cells, merges, hiddenRows, hiddenCols, extraCells]);

    const value: CellSelectionState = {
        selection,
        cells,
        merges,
        hiddenRows,
        hiddenCols,
        cols,
        rows,
        extraCells,
        getSelectionRange,
        isInSelection,
        selectionStats,
    };

    return (
        <CellSelectionContext.Provider value={value}>
            {children}
        </CellSelectionContext.Provider>
    );
};