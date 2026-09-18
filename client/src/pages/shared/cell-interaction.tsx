import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react';
import {toast} from 'sonner';

interface SelectionRange {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
}

interface CellInteractionProviderProps {
    children: React.ReactNode;
}

function getCellFromEvent(e: React.MouseEvent | MouseEvent): { row: number; col: number } | null {
    const target = e.target as HTMLElement;
    const td = target.closest('td');
    if (!td) return null;
    const tr = td.closest('tr');
    if (!tr || !tr.closest('tbody')) return null;
    const row = tr.sectionRowIndex;
    const col = td.cellIndex;
    if (row < 0 || col < 0) return null;
    return {row, col};
}

function applyHighlight(container: HTMLElement, sel: SelectionRange | null) {
    container.querySelectorAll('.cell-selected, .cell-active').forEach((el) => {
        el.classList.remove('cell-selected', 'cell-active');
    });
    if (!sel) return;
    const tbody = container.querySelector('tbody');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr');
    const minRow = Math.min(sel.startRow, sel.endRow);
    const maxRow = Math.max(sel.startRow, sel.endRow);
    const minCol = Math.min(sel.startCol, sel.endCol);
    const maxCol = Math.max(sel.startCol, sel.endCol);
    for (let r = minRow; r <= maxRow; r++) {
        const row = rows[r];
        if (!row) continue;
        const cells = row.querySelectorAll('td');
        for (let c = minCol; c <= maxCol; c++) {
            const cell = cells[c];
            if (!cell) continue;
            cell.classList.add('cell-selected');
            if (r === sel.startRow && c === sel.startCol) {
                cell.classList.add('cell-active');
            }
        }
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

function copyToClipboard(
    container: HTMLElement | null,
    sel: SelectionRange | null,
    withHeaders: boolean,
) {
    if (!container || !sel) return;
    const tbody = container.querySelector('tbody');
    if (!tbody) return;
    const rows = tbody.querySelectorAll('tr');
    const minRow = Math.min(sel.startRow, sel.endRow);
    const maxRow = Math.max(sel.startRow, sel.endRow);
    const minCol = Math.min(sel.startCol, sel.endCol);
    const maxCol = Math.max(sel.startCol, sel.endCol);

    let headerLine = '';
    if (withHeaders) {
        const thead = container.querySelector('thead');
        if (thead) {
            const headerCells = thead.querySelectorAll('th');
            const headers: string[] = [];
            for (let c = minCol; c <= maxCol; c++) {
                headers.push(headerCells[c]?.textContent?.trim() || '');
            }
            headerLine = headers.join('\t') + '\n';
        }
    }

    const lines: string[] = [];
    for (let r = minRow; r <= maxRow; r++) {
        const row = rows[r];
        if (!row) continue;
        const cells = row.querySelectorAll('td');
        const values: string[] = [];
        for (let c = minCol; c <= maxCol; c++) {
            values.push(cells[c]?.textContent?.trim() || '');
        }
        lines.push(values.join('\t'));
    }

    const text = headerLine + lines.join('\n');
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard
            .writeText(text)
            .then(() => toast.success('已复制到剪贴板'))
            .catch(() => {
                if (fallbackCopy(text)) {
                    toast.success('已复制到剪贴板');
                } else {
                    toast.error('复制失败');
                }
            });
    } else {
        if (fallbackCopy(text)) {
            toast.success('已复制到剪贴板');
        } else {
            toast.error('复制失败');
        }
    }
}

const DRAG_THRESHOLD_PX = 5;

export const CellInteractionProvider: React.FC<CellInteractionProviderProps> = ({
                                                                                    children,
                                                                                }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [selection, setSelection] = useState<SelectionRange | null>(null);
    const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);
    const isDragging = useRef(false);
    const dragStart = useRef<{ row: number; col: number } | null>(null);
    const lastCell = useRef<{ row: number; col: number } | null>(null);
    const mouseDownPos = useRef<{ x: number; y: number } | null>(null);
    const dragThresholdMet = useRef(false);

    const clearSelection = useCallback(() => {
        setSelection(null);
        setMenuPos(null);
        isDragging.current = false;
        dragStart.current = null;
        lastCell.current = null;
        mouseDownPos.current = null;
        dragThresholdMet.current = false;
    }, []);

    useLayoutEffect(() => {
        if (containerRef.current) {
            applyHighlight(containerRef.current, selection);
        }
    });

    useEffect(() => {
        const handleMouseUp = () => {
            isDragging.current = false;
            dragStart.current = null;
            mouseDownPos.current = null;
            dragThresholdMet.current = false;
        };
        document.addEventListener('mouseup', handleMouseUp);
        return () => document.removeEventListener('mouseup', handleMouseUp);
    }, []);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                clearSelection();
            }
            if ((e.ctrlKey || e.metaKey) && (e.key?.toLowerCase() === 'c' || e.code === 'KeyC') && selection) {
                const textSel = window.getSelection();
                if (!textSel || textSel.toString().length === 0) {
                    e.preventDefault();
                    copyToClipboard(containerRef.current, selection, false);
                }
            }
        };
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                clearSelection();
            }
        };
        document.addEventListener('keydown', handleKeyDown);
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [selection, clearSelection]);

    const handleMouseDown = (e: React.MouseEvent) => {
        if (e.button !== 0) return;
        const cell = getCellFromEvent(e);
        if (!cell) return;
        e.preventDefault();
        isDragging.current = true;
        dragStart.current = cell;
        lastCell.current = cell;
        mouseDownPos.current = {x: e.clientX, y: e.clientY};
        dragThresholdMet.current = false;
        setSelection({
            startRow: cell.row,
            startCol: cell.col,
            endRow: cell.row,
            endCol: cell.col,
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging.current || !dragStart.current) return;
        if (!dragThresholdMet.current && mouseDownPos.current) {
            const dx = Math.abs(e.clientX - mouseDownPos.current.x);
            const dy = Math.abs(e.clientY - mouseDownPos.current.y);
            if (dx < DRAG_THRESHOLD_PX && dy < DRAG_THRESHOLD_PX) return;
            dragThresholdMet.current = true;
        }
        const cell = getCellFromEvent(e);
        if (!cell) return;
        if (lastCell.current?.row === cell.row && lastCell.current?.col === cell.col) return;
        lastCell.current = cell;
        setSelection({
            startRow: dragStart.current.row,
            startCol: dragStart.current.col,
            endRow: cell.row,
            endCol: cell.col,
        });
    };

    const handleContextMenu = (e: React.MouseEvent) => {
        const cell = getCellFromEvent(e);
        if (!cell) return;
        e.preventDefault();

        const inSelection = (s: SelectionRange) =>
            cell.row >= Math.min(s.startRow, s.endRow) &&
            cell.row <= Math.max(s.startRow, s.endRow) &&
            cell.col >= Math.min(s.startCol, s.endCol) &&
            cell.col <= Math.max(s.startCol, s.endCol);

        if (!selection || !inSelection(selection)) {
            setSelection({
                startRow: cell.row,
                startCol: cell.col,
                endRow: cell.row,
                endCol: cell.col,
            });
        }
        setMenuPos({x: e.clientX, y: e.clientY});
    };

    const handleCopy = (withHeaders: boolean) => {
        copyToClipboard(containerRef.current, selection, withHeaders);
        setMenuPos(null);
    };

    const isMultiCell =
        selection &&
        (selection.startRow !== selection.endRow || selection.startCol !== selection.endCol);

    return (
        <div className="relative">
            <div
                ref={containerRef}
                className="select-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onContextMenu={handleContextMenu}
            >
                {children}
            </div>
            {menuPos && (
                <TableContextMenu
                    x={menuPos.x}
                    y={menuPos.y}
                    isMultiCell={!!isMultiCell}
                    onCopy={() => handleCopy(false)}
                    onCopyWithHeaders={() => handleCopy(true)}
                    onClose={() => setMenuPos(null)}
                />
            )}
        </div>
    );
};

const TableContextMenu: React.FC<{
    x: number;
    y: number;
    isMultiCell: boolean;
    onCopy: () => void;
    onCopyWithHeaders: () => void;
    onClose: () => void;
}> = ({x, y, isMultiCell, onCopy, onCopyWithHeaders, onClose}) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose]);

    useLayoutEffect(() => {
        if (!menuRef.current) return;
        const rect = menuRef.current.getBoundingClientRect();
        if (rect.right > window.innerWidth) {
            menuRef.current.style.left = `${window.innerWidth - rect.width - 8}px`;
        }
        if (rect.bottom > window.innerHeight) {
            menuRef.current.style.top = `${window.innerHeight - rect.height - 8}px`;
        }
    }, [x, y]);

    return (
        <div
            ref={menuRef}
            className="fixed z-50 min-w-[160px] rounded-sm border border-border bg-popover py-1 shadow-md"
            style={{left: x, top: y}}
        >
            <button
                type="button"
                onClick={onCopy}
                className="flex w-full items-center px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors"
            >
                <span>复制</span>
                <span className="ml-auto text-xs text-muted-foreground">Ctrl+C</span>
            </button>
            {isMultiCell && (
                <>
                    <div className="my-1 h-px bg-border"/>
                    <button
                        type="button"
                        onClick={onCopyWithHeaders}
                        className="flex w-full items-center px-3 py-1.5 text-sm text-foreground hover:bg-accent transition-colors"
                    >
                        <span>复制带表头</span>
                    </button>
                </>
            )}
        </div>
    );
};
