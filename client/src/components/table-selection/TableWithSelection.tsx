import React, {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {toast} from 'sonner';
import {
    CellInteractionContext,
    type SelectionRange,
} from './CellInteractionContext';
import {useColumnResizeDom} from '@client/src/hooks/use-column-resize-dom';
import {computeSelectionStatsFromDOM} from './stats';
import TableSelectionStatsBar from './TableSelectionStatsBar';

interface TableWithSelectionProps {
    children: React.ReactNode;
    enableContextMenu?: boolean;
    onCellDoubleClick?: (row: number, col: number) => void;
    statsBarPosition?: 'sticky-inside' | 'flow';
    onPaste?: (grid: string[][], anchor: { row: number; col: number }) => void;
}

let lastActiveContainer: HTMLElement | null = null;

function isEditableTarget(el: HTMLElement | null): boolean {
    return !!el?.closest('input, textarea, select, [contenteditable]');
}

function getLeafHeaderLabels(container: HTMLElement): string[] {
    const thead: HTMLElement | null = container.querySelector('thead');
    if (!thead) return [];
    const headerRows: NodeListOf<Element> = thead.querySelectorAll('tr');
    const row: Element | undefined = headerRows[headerRows.length - 1];
    if (!row) return [];
    const labels: string[] = [];
    for (const cell of Array.from(row.children)) {
        const colspan: number = Number(cell.getAttribute('colspan')) || 1;
        const text: string = cell.textContent?.trim() ?? '';
        for (let i = 0; i < colspan; i += 1) labels.push(text);
    }
    return labels;
}

function getBodyRows(container: HTMLElement | null): Element[] {
    if (!container) return [];
    return Array.from(container.querySelectorAll('tbody tr'));
}

function getCellsByLogicalCol(row: Element): Map<number, HTMLTableCellElement> {
    const byCol = new Map<number, HTMLTableCellElement>();
    row.querySelectorAll(':scope > td').forEach((el) => {
        const td = el as HTMLTableCellElement;
        byCol.set(td.cellIndex, td);
    });
    return byCol;
}

function getCellFromEvent(
    e: React.MouseEvent | MouseEvent,
    container: HTMLElement | null,
): { row: number; col: number } | null {
    const target = e.target as HTMLElement;
    const td = target.closest('td');
    if (!td) return null;
    const tbody = td.closest('tbody');
    if (!tbody) return null;
    const tr = td.closest('tr');
    if (!tr) return null;
    if (container && !container.contains(tbody)) return null;
    if (container && td.closest('.table-selection-container') !== container) return null;
    const row = getBodyRows(container).indexOf(tr);
    const col = td.cellIndex;
    if (row < 0 || col < 0) return null;
    return {row, col};
}

function matchModKey(e: KeyboardEvent, letter: string, code: string): boolean {
    return (
        (e.ctrlKey || e.metaKey) &&
        !e.altKey &&
        (e.key?.toLowerCase() === letter || e.code === code)
    );
}

function applyHighlight(container: HTMLElement, ranges: SelectionRange[]) {
    container.querySelectorAll('.cell-selected, .cell-active').forEach((el) => {
        if ((el as HTMLElement).closest('.table-selection-container') !== container) return;
        el.classList.remove('cell-selected', 'cell-active');
    });
    if (ranges.length === 0) return;
    const rows = getBodyRows(container);
    if (rows.length === 0) return;
    const anchor = ranges[ranges.length - 1];
    for (const sel of ranges) {
        const minRow = Math.min(sel.startRow, sel.endRow);
        const maxRow = Math.max(sel.startRow, sel.endRow);
        const minCol = Math.min(sel.startCol, sel.endCol);
        const maxCol = Math.max(sel.startCol, sel.endCol);
        for (let r = minRow; r <= maxRow; r++) {
            const row = rows[r];
            if (!row) continue;
            const byCol = getCellsByLogicalCol(row);
            for (let c = minCol; c <= maxCol; c++) {
                const cell = byCol.get(c);
                if (!cell) continue;
                cell.classList.add('cell-selected');
                if (sel === anchor && r === sel.endRow && c === sel.endCol) {
                    cell.classList.add('cell-active');
                }
            }
        }
    }
    if (ranges.some((sel) => sel.includeHeader)) {
        const thead = container.querySelector('thead');
        thead?.querySelectorAll('th, td').forEach((el) => {
            el.classList.add('cell-selected');
        });
    }
}

function fallbackCopy(text: string): boolean {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'absolute';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    let success = false;
    try {
        success = document.execCommand('copy');
    } catch {
        success = false;
    }
    document.body.removeChild(ta);
    return success;
}

function copyToClipboard(container: HTMLElement | null, ranges: SelectionRange[]) {
    if (!container || ranges.length === 0) return;
    const rows = getBodyRows(container);
    if (rows.length === 0) return;

    const allCells: { r: number; c: number }[] = [];
    for (const sel of ranges) {
        const minRow = Math.min(sel.startRow, sel.endRow);
        const maxRow = Math.max(sel.startRow, sel.endRow);
        const minCol = Math.min(sel.startCol, sel.endCol);
        const maxCol = Math.max(sel.startCol, sel.endCol);
        for (let r = minRow; r <= maxRow; r++) {
            for (let c = minCol; c <= maxCol; c++) {
                if (!allCells.some((x) => x.r === r && x.c === c)) {
                    allCells.push({r, c});
                }
            }
        }
    }

    const rowMap = new Map<number, Map<number, string>>();
    const rowCellCache = new Map<number, Map<number, HTMLTableCellElement>>();
    for (const {r, c} of allCells) {
        const rowEl = rows[r];
        if (!rowEl) continue;
        let byCol = rowCellCache.get(r);
        if (!byCol) {
            byCol = getCellsByLogicalCol(rowEl);
            rowCellCache.set(r, byCol);
        }
        const value = byCol.get(c)?.textContent?.trim() || '';
        if (!rowMap.has(r)) rowMap.set(r, new Map());
        rowMap.get(r)!.set(c, value);
    }

    const sortedRows = [...rowMap.keys()].sort((a, b) => a - b);
    const allCols = new Set<number>();
    for (const colMap of rowMap.values()) {
        for (const c of colMap.keys()) allCols.add(c);
    }
    const sortedCols = [...allCols].sort((a, b) => a - b);

    const lines: string[] = [];
    if (ranges.some((sel) => sel.includeHeader)) {
        const labels: string[] = getLeafHeaderLabels(container);
        const headerLine: string = sortedCols.map((c) => labels[c] ?? '').join('\t');
        if (headerLine.trim()) lines.push(headerLine);
    }
    for (const r of sortedRows) {
        const line = sortedCols.map((c) => rowMap.get(r)?.get(c) || '');
        lines.push(line.join('\t'));
    }
    const text = lines.join('\n');
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(() => toast.success('已复制到剪贴板')).catch(() => {
            if (!fallbackCopy(text)) toast.error('复制失败，请重试');
        });
    } else if (!fallbackCopy(text)) {
        toast.error('复制失败，请重试');
    }
}

const DRAG_THRESHOLD_PX = 5;
const DOUBLE_CLICK_DELAY = 350;

function isModKey(e: React.MouseEvent | MouseEvent): boolean {
    return e.metaKey || e.ctrlKey;
}

const TableWithSelection: React.FC<TableWithSelectionProps> = ({
                                                                   children,
                                                                   enableContextMenu = false,
                                                                   onCellDoubleClick,
                                                                   statsBarPosition = 'sticky-inside',
                                                                   onPaste,
                                                               }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    useColumnResizeDom(containerRef);
    const [ranges, setRanges] = useState<SelectionRange[]>([]);
    const rangesRef = useRef<SelectionRange[]>(ranges);
    rangesRef.current = ranges;
    const onPasteRef = useRef(onPaste);
    onPasteRef.current = onPaste;
    const isDragging = useRef(false);
    const dragStart = useRef<{ row: number; col: number } | null>(null);
    const lastCell = useRef<{ row: number; col: number } | null>(null);
    const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
    const dragThresholdMet = useRef(false);
    const hasMoved = useRef(false);
    const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const clickCount = useRef(0);
    const lastClickCell = useRef<{ row: number; col: number } | null>(null);

    const clearSelection = useCallback(() => {
        setRanges([]);
        isDragging.current = false;
        dragStart.current = null;
        lastCell.current = null;
        mouseDownPos.current = null;
        dragThresholdMet.current = false;
        hasMoved.current = false;
        clickCount.current = 0;
        lastClickCell.current = null;
        if (clickTimer.current) {
            clearTimeout(clickTimer.current);
            clickTimer.current = null;
        }
    }, []);

    const selection = useMemo(() => {
        if (ranges.length === 0) return null;
        return ranges[ranges.length - 1];
    }, [ranges]);

    const selectionStats = useMemo(() => {
        if (ranges.length === 0 || !containerRef.current) return null;
        return computeSelectionStatsFromDOM(containerRef.current, ranges);
    }, [ranges]);

    useLayoutEffect(() => {
        if (containerRef.current) {
            applyHighlight(containerRef.current, ranges);
        }
    });

    useEffect(() => {
        const handleMouseUp = () => {
            isDragging.current = false;
            dragStart.current = null;
            mouseDownPos.current = null;
            dragThresholdMet.current = false;
            hasMoved.current = false;
        };
        document.addEventListener('mouseup', handleMouseUp);
        return () => document.removeEventListener('mouseup', handleMouseUp);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                clearSelection();
                return;
            }
            if (matchModKey(e, 'a', 'KeyA')) {
                const target: HTMLElement | null = e.target as HTMLElement | null;
                if (
                    containerRef.current &&
                    containerRef.current === lastActiveContainer &&
                    !isEditableTarget(target)
                ) {
                    e.preventDefault();
                    const rows: Element[] = getBodyRows(containerRef.current);
                    const firstRow: Element | undefined = rows[0];
                    let colCount = 0;
                    firstRow?.querySelectorAll(':scope > td').forEach((el) => {
                        const td = el as HTMLTableCellElement;
                        colCount = Math.max(colCount, td.cellIndex + (td.colSpan || 1));
                    });
                    if (rows.length > 0 && colCount > 0) {
                        setRanges([
                            {
                                startRow: 0,
                                startCol: 0,
                                endRow: rows.length - 1,
                                endCol: colCount - 1,
                                includeHeader: true,
                            },
                        ]);
                    }
                }
                return;
            }
            if (matchModKey(e, 'c', 'KeyC')) {
                const target: HTMLElement | null = e.target as HTMLElement | null;
                if (isEditableTarget(target)) return;
                const currentRanges: SelectionRange[] = rangesRef.current;
                if (currentRanges.length === 0) return;
                if (!containerRef.current || containerRef.current !== lastActiveContainer) return;
                e.preventDefault();
                copyToClipboard(containerRef.current, currentRanges);
                return;
            }
        };
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                clearSelection();
            }
        };
        const handlePasteEvent = (e: ClipboardEvent) => {
            const target: HTMLElement | null = e.target as HTMLElement | null;
            const pasteHandler = onPasteRef.current;
            const currentRanges: SelectionRange[] = rangesRef.current;
            if (isEditableTarget(target) || !pasteHandler || currentRanges.length === 0) return;
            if (!containerRef.current || containerRef.current !== lastActiveContainer) return;
            const raw = e.clipboardData?.getData('text/plain') ?? '';
            if (!raw) return;
            e.preventDefault();
            const lines = raw.replace(/\r\n?/g, '\n').split('\n');
            if (lines.length > 0 && lines[lines.length - 1] === '') lines.pop();
            if (lines.length === 0) return;
            const anchorRange = currentRanges[currentRanges.length - 1];
            const anchor = {
                row: Math.min(anchorRange.startRow, anchorRange.endRow),
                col: Math.min(anchorRange.startCol, anchorRange.endCol),
            };
            pasteHandler(lines.map((line: string) => line.split('\t')), anchor);
        };
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('paste', handlePasteEvent);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('paste', handlePasteEvent);
        };
    }, [clearSelection]);

    const makeRange = (r1: number, c1: number, r2: number, c2: number): SelectionRange => ({
        startRow: r1,
        startCol: c1,
        endRow: r2,
        endCol: c2,
    });

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        const target = e.target as HTMLElement;
        if (target.closest('input, textarea, select, button, [contenteditable]')) return;
        const cell = getCellFromEvent(e, containerRef.current);
        if (!cell) {
            clearSelection();
            return;
        }
        if (containerRef.current) {
            lastActiveContainer = containerRef.current;
        }
        e.preventDefault();

        isDragging.current = true;
        dragStart.current = cell;
        lastCell.current = cell;
        mouseDownPos.current = {x: e.clientX, y: e.clientY};
        dragThresholdMet.current = false;
        hasMoved.current = false;

        // Shift+click → extend selection
        if (e.shiftKey && ranges.length > 0) {
            const anchor = ranges[ranges.length - 1];
            const newRanges = [...ranges.slice(0, -1), makeRange(anchor.startRow, anchor.startCol, cell.row, cell.col)];
            setRanges(newRanges);
            clickCount.current = 0;
            return;
        }

        // Ctrl/Cmd+click → toggle/add range
        if (isModKey(e)) {
            const existingIdx = ranges.findIndex(
                (r) =>
                    r.startRow === cell.row &&
                    r.startCol === cell.col &&
                    r.endRow === cell.row &&
                    r.endCol === cell.col,
            );
            if (existingIdx >= 0) {
                const newRanges = ranges.filter((_, i) => i !== existingIdx);
                setRanges(newRanges);
            } else {
                setRanges([...ranges, makeRange(cell.row, cell.col, cell.row, cell.col)]);
            }
            clickCount.current = 0;
            return;
        }

        // Single click: check for double-click detection
        const isSameCell =
            lastClickCell.current?.row === cell.row && lastClickCell.current?.col === cell.col;

        if (isSameCell) {
            clickCount.current += 1;
        } else {
            clickCount.current = 1;
            lastClickCell.current = cell;
        }

        if (clickTimer.current) {
            clearTimeout(clickTimer.current);
        }

        clickTimer.current = setTimeout(() => {
            if (clickCount.current === 2 && onCellDoubleClick) {
                onCellDoubleClick(cell.row, cell.col);
            }
            clickCount.current = 0;
            clickTimer.current = null;
        }, DOUBLE_CLICK_DELAY);

        setRanges([makeRange(cell.row, cell.col, cell.row, cell.col)]);
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current || !dragStart.current) return;
        if (!dragThresholdMet.current && mouseDownPos.current) {
            const dx = Math.abs(e.clientX - mouseDownPos.current.x);
            const dy = Math.abs(e.clientY - mouseDownPos.current.y);
            if (dx < DRAG_THRESHOLD_PX && dy < DRAG_THRESHOLD_PX) return;
            dragThresholdMet.current = true;
            hasMoved.current = true;
        }
        if (!hasMoved.current) return;
        const cell = getCellFromEvent(e, containerRef.current);
        if (!cell) return;
        if (lastCell.current?.row === cell.row && lastCell.current?.col === cell.col) return;
        lastCell.current = cell;
        setRanges([makeRange(dragStart.current.row, dragStart.current.col, cell.row, cell.col)]);
    };

    const contextValue = useMemo(
        () => ({selection, selectionStats, containerRef, clearSelection}),
        [selection, selectionStats, clearSelection],
    );

    return (
        <CellInteractionContext.Provider value={contextValue}>
            <div className="relative flex h-full flex-col">
                <div
                    ref={containerRef}
                    className="table-selection-container min-h-0 flex-1"
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onContextMenu={
                        enableContextMenu
                            ? (e) => {
                                const cell = getCellFromEvent(e, containerRef.current);
                                if (cell) e.preventDefault();
                            }
                            : undefined
                    }
                >
                    {children}
                </div>
                {statsBarPosition === 'flow'
                    ? selectionStats && (
                    <div className="shrink-0 border-t border-gray-200 bg-gray-50">
                        <TableSelectionStatsBar/>
                    </div>
                )
                    : (
                        <div className="sticky bottom-0 z-20 shrink-0 border-t border-gray-200 bg-gray-50">
                            <TableSelectionStatsBar/>
                        </div>
                    )}
            </div>
        </CellInteractionContext.Provider>
    );
};

export default TableWithSelection;