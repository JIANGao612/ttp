import React, {createContext, useContext, useMemo, useRef} from 'react';

export interface SelectionRange {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
    includeHeader?: boolean;
}

export interface SelectionStats {
    sum: number;
    count: number;
    average: number;
}

interface CellInteractionContextValue {
    selection: SelectionRange | null;
    selectionStats: SelectionStats | null;
    containerRef: React.RefObject<HTMLDivElement | null>;
    clearSelection: () => void;
}

const CellInteractionContext = createContext<CellInteractionContextValue | null>(null);

export function useTableSelection(): CellInteractionContextValue | null {
    return useContext(CellInteractionContext);
}

export {CellInteractionContext};
export type {CellInteractionContextValue};