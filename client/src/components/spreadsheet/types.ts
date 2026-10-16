export interface CellStyle {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    fontFamily?: string;
    fontSize?: number;
    color?: string;
    bgColor?: string;
    align?: 'left' | 'center' | 'right';
    decimals?: number;
    whiteSpace?: 'nowrap' | 'normal';
    lineHeight?: number;
    verticalAlign?: 'top' | 'middle' | 'bottom';
}

export interface CellData {
    value: string;
    style?: CellStyle;
}

export interface MergeCell {
    row: number;
    col: number;
    rowSpan: number;
    colSpan: number;
}

export interface SheetData {
    rows: number;
    cols: number;
    cells: Map<string, CellData>;
    merges: MergeCell[];
}

export type CellKey = string;

export const cellKey = (row: number, col: number): CellKey => `${row},${col}`;

export function colIndexToLetter(index: number): string {
    let result = '';
    let n = index;
    while (n >= 0) {
        result = String.fromCharCode(65 + (n % 26)) + result;
        n = Math.floor(n / 26) - 1;
    }
    return result;
}

export function letterToColIndex(letter: string): number {
    let result = 0;
    for (let i = 0; i < letter.length; i++) {
        result = result * 26 + (letter.charCodeAt(i) - 64);
    }
    return result - 1;
}

export function isInMerge(merges: MergeCell[], row: number, col: number): MergeCell | null {
    for (const m of merges) {
        if (row >= m.row && row < m.row + m.rowSpan && col >= m.col && col < m.col + m.colSpan) {
            return m;
        }
    }
    return null;
}

export function isMergeOrigin(m: MergeCell, row: number, col: number): boolean {
    return m.row === row && m.col === col;
}

export interface EffectiveMergeOrigin {
    row: number;
    col: number;
    colSpan: number;
    rowSpan: number;
}

export function effectiveMergeOrigin(
    m: MergeCell,
    hiddenCols: Set<number>,
    hiddenRows: Set<number>,
): EffectiveMergeOrigin | null {
    if (!hiddenCols.has(m.col) && !hiddenRows.has(m.row)) {
        return {row: m.row, col: m.col, colSpan: m.colSpan, rowSpan: m.rowSpan};
    }
    let firstRow = -1;
    for (let r = m.row; r < m.row + m.rowSpan; r++) {
        if (!hiddenRows.has(r)) {
            firstRow = r;
            break;
        }
    }
    let firstCol = -1;
    for (let c = m.col; c < m.col + m.colSpan; c++) {
        if (!hiddenCols.has(c)) {
            firstCol = c;
            break;
        }
    }
    if (firstRow === -1 || firstCol === -1) return null;
    return {
        row: firstRow,
        col: firstCol,
        colSpan: m.col + m.colSpan - firstCol,
        rowSpan: m.row + m.rowSpan - firstRow,
    };
}

export interface HistoryAction {
    type: string;
    undo: () => void;
    redo: () => void;
}

export class HistoryStack {
    private undoStack: HistoryAction[] = [];
    private redoStack: HistoryAction[] = [];

    push(action: HistoryAction) {
        this.undoStack.push(action);
        this.redoStack = [];
    }

    undo(): boolean {
        const action = this.undoStack.pop();
        if (!action) return false;
        action.undo();
        this.redoStack.push(action);
        return true;
    }

    redo(): boolean {
        const action = this.redoStack.pop();
        if (!action) return false;
        action.redo();
        this.undoStack.push(action);
        return true;
    }

    canUndo() {
        return this.undoStack.length > 0;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }
}

export const DEFAULT_FONT_SIZE = 12;
export const DEFAULT_FONT_FAMILY = '"Microsoft YaHei", "PingFang SC", "Helvetica Neue", Helvetica, Arial, sans-serif';
export const DEFAULT_ROW_HEIGHT = 26;
export const DEFAULT_COL_WIDTH = 90;
export const ROW_HEADER_WIDTH = 48;
export const COL_HEADER_HEIGHT = 24;
